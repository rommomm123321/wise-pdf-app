const prisma = require('../src/prismaClient');

async function main() {
  console.log('🧹 Cleaning database...');

  // Clean in order (respect FK constraints)
  await prisma.auditLog.deleteMany();
  await prisma.markup.deleteMany();
  await prisma.folderPermission.deleteMany();
  await prisma.projectAssignment.deleteMany();
  await prisma.invitation.deleteMany();
  await prisma.document.deleteMany();
  await prisma.folder.deleteMany();
  await prisma.project.deleteMany();
  await prisma.user.deleteMany();
  await prisma.companyTag.deleteMany();
  await prisma.role.deleteMany();
  await prisma.company.deleteMany();

  console.log('🌱 Seeding...');

  // ===== COMPANIES =====
  const companies = [];
  const companyData = [
    'Tesla Giga Berlin Engineering',
    'SpaceX Launch Systems',
    'Apple Campus Infrastructure',
    'Amazon Logistics Center',
    'Google Data Center Ops',
  ];

  for (const name of companyData) {
    const company = await prisma.company.create({ data: { name } });
    companies.push(company);
  }

  // ===== GLOBAL ROLES =====
  const systemRolesData = [
    { name: 'Admin', color: '#FF9800', isSystem: true, defaultCanView: true, defaultCanEdit: true, defaultCanDelete: true, defaultCanDownload: true, defaultCanMarkup: true, defaultCanManage: true },
    { name: 'Team Lead', color: '#2196F3', isSystem: true, defaultCanView: true, defaultCanEdit: true, defaultCanDelete: false, defaultCanDownload: true, defaultCanMarkup: true, defaultCanManage: true },
    { name: 'Manager', color: '#9C27B0', isSystem: true, defaultCanView: true, defaultCanEdit: true, defaultCanDelete: false, defaultCanDownload: true, defaultCanMarkup: true, defaultCanManage: true },
    { name: 'BIM Specialist', color: '#00BCD4', isSystem: true, defaultCanView: true, defaultCanEdit: true, defaultCanDelete: false, defaultCanDownload: true, defaultCanMarkup: true, defaultCanManage: false },
    { name: 'BIM Engineer', color: '#3F51B5', isSystem: true, defaultCanView: true, defaultCanEdit: true, defaultCanDelete: false, defaultCanDownload: true, defaultCanMarkup: true, defaultCanManage: false },
    { name: 'Client', color: '#9E9E9E', isSystem: true, defaultCanView: true, defaultCanEdit: false, defaultCanDelete: false, defaultCanDownload: true, defaultCanMarkup: false, defaultCanManage: false },
  ];

  const systemRoles = {}; // roleName -> roleObj
  for (const r of systemRolesData) {
    const role = await prisma.role.create({ data: { ...r, companyId: null, projectId: null } });
    systemRoles[role.name] = role;
  }

  // ===== TAGS per company =====
  const tagNames = ['Electrical', 'Mechanical', 'Plumbing', 'HVAC', 'Fire Safety', 'Structural', 'Finishing', 'Exterior', 'Interior', 'Low Voltage'];
  const tagColors = ['#F44336', '#E91E63', '#9C27B0', '#3F51B5', '#2196F3', '#009688', '#4CAF50', '#FF9800', '#795548', '#607D8B'];

  const allTags = {};
  for (const company of companies) {
    allTags[company.id] = [];
    for (let i = 0; i < tagNames.length; i++) {
      const tag = await prisma.companyTag.create({
        data: { text: tagNames[i], color: tagColors[i], companyId: company.id }
      });
      allTags[company.id].push(tag);
    }
  }

  // ===== USERS =====
  // Super admin
  const admin = await prisma.user.create({
    data: {
      email: 'rommomm123321@gmail.com',
      name: 'Roman (Super Admin)',
      systemRole: 'GENERAL_ADMIN',
      companyId: companies[0].id,
      roleId: systemRoles['Admin'].id,
    }
  });

  // Generate 50 users across companies
  const firstNames = ['Alex', 'Ivan', 'Maria', 'Olena', 'Dmytro', 'Anna', 'Mykola', 'Natalia', 'Sergiy', 'Kateryna', 'Petro', 'Yulia', 'Oleg', 'Svitlana', 'Viktor', 'Iryna', 'Andriy', 'Oksana', 'Maxym', 'Tetiana', 'Pavlo', 'Larysa', 'Bohdan', 'Halyna', 'Taras'];
  const lastNames = ['Kovalenko', 'Shevchenko', 'Bondarenko', 'Tkachenko', 'Kravchenko', 'Oliynyk', 'Melnyk', 'Lysenko', 'Marchenko', 'Savchenko', 'Rudenko', 'Moroz', 'Polishchuk', 'Boyko', 'Levchenko', 'Hrytsenko', 'Zhuk', 'Koval', 'Ponomarenko', 'Sydorenko', 'Bilous', 'Tymoshenko', 'Kyrylenko', 'Zaitsev', 'Ivanenko'];
  const roleNames = ['Team Lead', 'Manager', 'BIM Specialist', 'BIM Engineer', 'Client'];

  const users = [admin];
  for (let i = 0; i < 50; i++) {
    const companyIdx = i % companies.length;
    const company = companies[companyIdx];
    const firstName = firstNames[i % firstNames.length];
    const lastName = lastNames[Math.floor(i / 2) % lastNames.length];
    const roleName = roleNames[i % roleNames.length];
    const role = systemRoles[roleName];

    const user = await prisma.user.create({
      data: {
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}${i}@wise.pro`,
        name: `${firstName} ${lastName}`,
        companyId: company.id,
        roleId: role.id,
      }
    });
    users.push(user);

    // Assign random tags
    const companyTags = allTags[company.id];
    const numTags = Math.floor(Math.random() * 3) + 1;
    const shuffled = [...companyTags].sort(() => 0.5 - Math.random());
    await prisma.user.update({
      where: { id: user.id },
      data: { tags: { connect: shuffled.slice(0, numTags).map(t => ({ id: t.id })) } }
    });
  }

  // ===== PROJECTS (many per company) =====
  const projectTemplates = [
    'Electrical Phase 1', 'Electrical Phase 2', 'HVAC System', 'Plumbing Layout',
    'Fire Alarm System', 'Low Voltage Network', 'Structural Reinforcement',
    'Interior Finishing', 'Exterior Cladding', 'Roof System',
    'Parking Garage', 'Security Systems', 'Elevator Installation',
    'Solar Panel Array', 'Water Treatment', 'Emergency Lighting',
  ];

  const allProjects = [];
  for (const company of companies) {
    const count = 8 + Math.floor(Math.random() * 9); // 8-16 projects per company
    for (let i = 0; i < count; i++) {
      const tmpl = projectTemplates[i % projectTemplates.length];
      const project = await prisma.project.create({
        data: {
          name: `${company.name.split(' ')[0]} - ${tmpl}`,
          description: `${tmpl} project for ${company.name}. Phase ${Math.floor(i / 4) + 1}.`,
          companyId: company.id,
        }
      });
      allProjects.push(project);

      // Root folder
      const root = await prisma.folder.create({
        data: { name: 'Root', projectId: project.id }
      });

      // Create folder structure (3-6 top folders, some with subfolders)
      const folderNames = ['Drawings', 'Specs', 'Reports', 'Submittals', 'RFIs', 'Photos', 'As-Built', 'Shop Drawings'];
      const subFolderNames = ['Rev A', 'Rev B', 'Rev C', 'Final', 'Draft', 'Approved', 'For Review'];

      const numTopFolders = 3 + Math.floor(Math.random() * 4);
      for (let f = 0; f < numTopFolders; f++) {
        const topFolder = await prisma.folder.create({
          data: { name: folderNames[f % folderNames.length], projectId: project.id, parentId: root.id }
        });

        // Subfolders
        const numSub = Math.floor(Math.random() * 4);
        for (let s = 0; s < numSub; s++) {
          const subFolder = await prisma.folder.create({
            data: { name: subFolderNames[s % subFolderNames.length], projectId: project.id, parentId: topFolder.id }
          });

          // Documents in subfolders
          const numDocs = Math.floor(Math.random() * 3) + 1;
          for (let d = 0; d < numDocs; d++) {
            await prisma.document.create({
              data: {
                name: `${tmpl.replace(/\s/g, '-')}-${folderNames[f]}-${s + 1}-${d + 1}.pdf`,
                storageUrl: `/uploads/placeholder-${project.id}-${f}-${s}-${d}.pdf`,
                folderId: subFolder.id,
                version: 1,
                isLatest: true,
              }
            });
          }
        }

        // Documents directly in top folder
        const numDirectDocs = 1 + Math.floor(Math.random() * 4);
        for (let d = 0; d < numDirectDocs; d++) {
          await prisma.document.create({
            data: {
              name: `${tmpl.replace(/\s/g, '-')}-${folderNames[f]}-${d + 1}.pdf`,
              storageUrl: `/uploads/placeholder-${project.id}-${f}-${d}.pdf`,
              folderId: topFolder.id,
              version: 1,
              isLatest: true,
            }
          });
        }
      }
    }
  }

  // ===== PROJECT ASSIGNMENTS =====
  // Assign users to 2-5 projects in their company
  for (const user of users) {
    if (user.systemRole === 'GENERAL_ADMIN') continue; // admin sees all
    const companyProjects = allProjects.filter(p => p.companyId === user.companyId);
    if (companyProjects.length === 0) continue;

    const numAssign = Math.min(companyProjects.length, 2 + Math.floor(Math.random() * 4));
    const shuffled = [...companyProjects].sort(() => 0.5 - Math.random());

    for (let a = 0; a < numAssign; a++) {
      const userRole = user.roleId ? Object.values(systemRoles).find(r => r.id === user.roleId) : null;
      await prisma.projectAssignment.create({
        data: {
          userId: user.id,
          projectId: shuffled[a].id,
          roleId: user.roleId,
          canView: true,
          canEdit: userRole?.defaultCanEdit ?? false,
          canDelete: userRole?.defaultCanDelete ?? false,
          canDownload: userRole?.defaultCanDownload ?? true,
          canMarkup: userRole?.defaultCanMarkup ?? false,
          canManage: userRole?.defaultCanManage ?? false,
        }
      });
    }
  }

  // Count results
  const counts = {
    companies: await prisma.company.count(),
    roles: await prisma.role.count(),
    tags: await prisma.companyTag.count(),
    users: await prisma.user.count(),
    projects: await prisma.project.count(),
    folders: await prisma.folder.count(),
    documents: await prisma.document.count(),
    assignments: await prisma.projectAssignment.count(),
  };

  console.log('✅ Seed complete!');
  console.log(counts);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
