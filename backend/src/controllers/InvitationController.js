const prisma = require('../prismaClient');
const { logAction } = require('../services/auditService');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_for_redlines';
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

class InvitationController {
  // POST /api/invitations — создать приглашение
  static async createInvitation(req, res) {
    try {
      const { email, roleId, projectIds = [] } = req.body;
      if (!email) return res.status(400).json({ error: 'Email is required' });
      if (!roleId) return res.status(400).json({ error: 'Role is required' });

      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { role: true }
      });

      const isGeneralAdmin = currentUser.systemRole === 'GENERAL_ADMIN';
      const isAdmin = isGeneralAdmin || currentUser.role?.name === 'Admin';

      if (!isAdmin) {
        return res.status(403).json({ error: 'Only admins can send invitations' });
      }

      if (!currentUser.companyId) {
        return res.status(400).json({ error: 'You must belong to a company to send invitations' });
      }

      // Проверяем что юзер ещё не в этой компании
      const existingUser = await prisma.user.findUnique({ where: { email } });
      if (existingUser && existingUser.companyId === currentUser.companyId) {
        return res.status(400).json({ error: 'User already belongs to your company' });
      }

      const invitation = await prisma.invitation.create({
        data: {
          email,
          roleId,
          companyId: currentUser.companyId,
          invitedById: currentUser.id,
          projectIds,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/invite/${invitation.token}`;

      await logAction({
        action: 'INVITE',
        userId: currentUser.id,
        targetUserId: null,
        details: { email, roleId, projectIds, inviteUrl },
      });

      res.status(201).json({ status: 'ok', data: { ...invitation, inviteUrl } });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/invitations
  static async getInvitations(req, res) {
    try {
      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.userId },
        include: { role: true }
      });

      const isGeneralAdmin = currentUser.systemRole === 'GENERAL_ADMIN';
      const isAdmin = isGeneralAdmin || currentUser.role?.name === 'Admin';

      if (!isAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const where = isGeneralAdmin ? {} : { companyId: currentUser.companyId };

      const invitations = await prisma.invitation.findMany({
        where,
        include: {
          invitedBy: { select: { name: true, email: true } },
          company: { select: { name: true } },
          role: { select: { name: true, color: true } },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({ status: 'ok', data: invitations });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // DELETE /api/invitations/:id
  static async cancelInvitation(req, res) {
    try {
      const { id } = req.params;
      const invitation = await prisma.invitation.findUnique({ where: { id } });

      if (!invitation) return res.status(404).json({ error: 'Invitation not found' });
      if (invitation.status !== 'PENDING') {
        return res.status(400).json({ error: 'Can only cancel pending invitations' });
      }

      await prisma.invitation.update({
        where: { id },
        data: { status: 'CANCELLED' },
      });

      res.json({ status: 'ok' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // GET /api/invitations/info/:token — публичный
  static async getInvitationInfo(req, res) {
    try {
      const { token } = req.params;
      const invitation = await prisma.invitation.findUnique({
        where: { token },
        include: {
          company: { select: { name: true } },
          role: { select: { name: true, color: true } },
        },
      });

      if (!invitation) return res.status(404).json({ error: 'Invitation not found' });

      if (invitation.status !== 'PENDING') {
        return res.status(400).json({ error: `Invitation is ${invitation.status.toLowerCase()}` });
      }

      if (new Date() > invitation.expiresAt) {
        await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
        return res.status(400).json({ error: 'Invitation has expired' });
      }

      let projects = [];
      if (invitation.projectIds.length > 0) {
        projects = await prisma.project.findMany({
          where: { id: { in: invitation.projectIds } },
          select: { id: true, name: true },
        });
      }

      res.json({
        status: 'ok',
        data: {
          email: invitation.email,
          role: invitation.role,
          companyName: invitation.company.name,
          projects,
          expiresAt: invitation.expiresAt,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  // POST /api/invitations/accept/:token
  static async acceptInvitation(req, res) {
    try {
      const { token } = req.params;
      const { credential } = req.body;

      if (!credential) return res.status(400).json({ error: 'Google credential is required' });

      const invitation = await prisma.invitation.findUnique({
        where: { token },
        include: { role: true },
      });
      if (!invitation) return res.status(404).json({ error: 'Invitation not found' });

      if (invitation.status !== 'PENDING') {
        return res.status(400).json({ error: `Invitation is ${invitation.status.toLowerCase()}` });
      }

      if (new Date() > invitation.expiresAt) {
        await prisma.invitation.update({ where: { id: invitation.id }, data: { status: 'EXPIRED' } });
        return res.status(400).json({ error: 'Invitation has expired' });
      }

      // Verify Google token
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
      const payload = ticket.getPayload();
      const { sub: googleId, email, name } = payload;

      if (email.toLowerCase() !== invitation.email.toLowerCase()) {
        return res.status(400).json({ error: 'Email does not match invitation' });
      }

      const userSelect = {
        id: true, email: true, name: true, systemRole: true, roleId: true, googleId: true, companyId: true,
      };

      let user = await prisma.user.findUnique({ where: { email }, select: userSelect });

      if (user) {
        user = await prisma.user.update({
          where: { email },
          data: {
            googleId: user.googleId || googleId,
            name: name || user.name,
            roleId: invitation.roleId,
            companyId: invitation.companyId,
          },
          select: userSelect,
        });
      } else {
        user = await prisma.user.create({
          data: { email, name, googleId, roleId: invitation.roleId, companyId: invitation.companyId },
          select: userSelect,
        });
      }

      // Auto-assign to projects with role-based defaults
      if (invitation.projectIds.length > 0) {
        const role = invitation.role;
        const perms = {
          canView: role?.defaultCanView ?? true,
          canEdit: role?.defaultCanEdit ?? false,
          canDelete: role?.defaultCanDelete ?? false,
          canDownload: role?.defaultCanDownload ?? true,
          canMarkup: role?.defaultCanMarkup ?? false,
          canManage: role?.defaultCanManage ?? false,
        };

        for (const projectId of invitation.projectIds) {
          await prisma.projectAssignment.upsert({
            where: { userId_projectId: { userId: user.id, projectId } },
            create: { userId: user.id, projectId, roleId: invitation.roleId, ...perms },
            update: { roleId: invitation.roleId, ...perms },
          });
        }
      }

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { status: 'ACCEPTED' },
      });

      const jwtToken = jwt.sign(
        { userId: user.id, email: user.email, role: user.systemRole },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      res.json({ status: 'ok', token: jwtToken, user });
    } catch (error) {
      console.error('[InvitationController] Accept error:', error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = InvitationController;
