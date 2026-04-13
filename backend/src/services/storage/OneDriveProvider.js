const https = require('https');
const prisma = require('../../prismaClient');
const IStorageProvider = require('./IStorageProvider');
const path = require('path');

class OneDriveProvider extends IStorageProvider {
  constructor(companyId) {
    super();
    this.companyId = companyId;
  }

  async _getTokens() {
    const company = await prisma.company.findUnique({ where: { id: this.companyId } });
    if (!company?.oneDriveRefreshToken) throw new Error('OneDrive not connected for this company');

    const now = new Date();
    if (company.oneDriveAccessToken && company.oneDriveTokenExpiry && company.oneDriveTokenExpiry > now) {
      return { accessToken: company.oneDriveAccessToken, driveId: company.oneDriveDriveId };
    }

    // Refresh token
    const tokens = await this._refreshAccessToken(company.oneDriveRefreshToken);
    await prisma.company.update({
      where: { id: this.companyId },
      data: {
        oneDriveAccessToken: tokens.access_token,
        oneDriveRefreshToken: tokens.refresh_token || company.oneDriveRefreshToken,
        oneDriveTokenExpiry: new Date(Date.now() + tokens.expires_in * 1000),
      }
    });
    return { accessToken: tokens.access_token, driveId: company.oneDriveDriveId };
  }

  async _refreshAccessToken(refreshToken) {
    const params = new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID,
      client_secret: process.env.AZURE_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
      scope: 'Files.ReadWrite.All Sites.ReadWrite.All offline_access User.Read',
    });

    return new Promise((resolve, reject) => {
      const postData = params.toString();
      const options = {
        hostname: 'login.microsoftonline.com',
        path: `/common/oauth2/v2.0/token`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try { 
            const parsed = JSON.parse(data);
            if (parsed.error) return reject(new Error(parsed.error_description || parsed.error));
            resolve(parsed); 
          } catch(e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  async _graphRequest(method, path, body = null, accessToken, driveId) {
    const fullPath = path.startsWith('https') ? path : `https://graph.microsoft.com/v1.0${path}`;
    const url = new URL(fullPath);

    return new Promise((resolve, reject) => {
      const postData = body ? JSON.stringify(body) : null;
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        },
      };
      const req = https.request(options, (res) => {
        if (method === 'GET' && path.includes('/content')) {
          if (res.statusCode >= 400) {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
              reject(new Error(`Graph API error ${res.statusCode}: ${data}`));
            });
            return;
          }
          if (res.statusCode === 302 || res.statusCode === 301) {
            const redirectUrl = res.headers.location;
            console.log(`[OneDrive] Following redirect to: ${redirectUrl}`);
            https.get(redirectUrl, (redirectRes) => {
              if (redirectRes.statusCode >= 400) {
                let data = '';
                redirectRes.on('data', (chunk) => data += chunk);
                redirectRes.on('end', () => {
                  reject(new Error(`Redirected Graph API error ${redirectRes.statusCode}: ${data}`));
                });
                return;
              }
              resolve(redirectRes);
            }).on('error', reject);
            return;
          }
          resolve(res); // Return the stream for file downloads
          return;
        }
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(data ? JSON.parse(data) : {}); } catch(e) { resolve({}); }
          } else {
            console.error(`[OneDrive Graph Error] ${res.statusCode}: ${data}`);
            reject(new Error(`Graph API error ${res.statusCode}: ${data}`));
          }
        });
      });
      req.on('error', reject);
      if (postData) req.write(postData);
      req.end();
    });
  }

  async uploadFile(fileBuffer, fileName, mimeType, parentFolderId = null) {
    const { accessToken, driveId } = await this._getTokens();
    if (!driveId) throw new Error('OneDrive driveId not configured');

    const encodedName = encodeURIComponent(fileName);
    const basePath = (!parentFolderId || parentFolderId === 'root') ? '/root' : `/items/${parentFolderId}`;

    console.log(`[OneDrive] Uploading ${fileName} (${fileBuffer.length} bytes) to ${basePath}`);

    if (fileBuffer.length <= 4 * 1024 * 1024) {
      // Simple upload <=4MB
      const path = `/drives/${driveId}${basePath}:/${encodedName}:/content`;
      const url = new URL(`https://graph.microsoft.com/v1.0${path}`);
      
      return new Promise((resolve, reject) => {
        const options = {
          hostname: url.hostname,
          path: url.pathname + url.search,
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': mimeType || 'application/octet-stream',
            'Content-Length': fileBuffer.length,
          },
        };
        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            if (res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const result = JSON.parse(data);
                resolve(result.id);
              } catch(e) { reject(new Error('Invalid JSON response on upload')); }
            } else {
              reject(new Error(`Upload failed (${res.statusCode}): ${data}`));
            }
          });
        });
        req.on('error', reject);
        req.write(fileBuffer);
        req.end();
      });
    } else {
      // Large file: create upload session then upload in chunks
      const sessionPath = `/drives/${driveId}${basePath}:/${encodedName}:/createUploadSession`;
      const sessionData = await this._graphRequest('POST', sessionPath, { 
        item: { "@microsoft.graph.conflictBehavior": "rename" } 
      }, accessToken, driveId);
      
      const uploadUrl = sessionData.uploadUrl;
      const chunkSize = 4 * 1024 * 1024;
      let offset = 0;
      let result;

      while (offset < fileBuffer.length) {
        const end = Math.min(offset + chunkSize, fileBuffer.length);
        const chunk = fileBuffer.slice(offset, end);
        
        result = await new Promise((resolve, reject) => {
          const url = new URL(uploadUrl);
          const options = {
            hostname: url.hostname,
            path: url.pathname + url.search,
            method: 'PUT',
            headers: {
              'Content-Length': chunk.length,
              'Content-Range': `bytes ${offset}-${end-1}/${fileBuffer.length}`,
            },
          };
          const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (c) => data += c);
            res.on('end', () => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                try { resolve(data ? JSON.parse(data) : {}); } catch(e) { resolve({}); }
              } else {
                reject(new Error(`Chunk upload failed (${res.statusCode}): ${data}`));
              }
            });
          });
          req.on('error', reject);
          req.write(chunk);
          req.end();
        });
        offset = end;
      }
      return result?.id;
    }
  }

  async downloadFile(itemId) {
    // Retry once on 401 — redirect tempauth can expire if access token was just refreshed
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { accessToken, driveId } = await this._getTokens();
        return await this._graphRequest('GET', `/drives/${driveId}/items/${itemId}/content`, null, accessToken, driveId);
      } catch (err) {
        if (attempt === 0 && err.message && err.message.includes('401')) {
          console.log('[OneDrive] 401 on download, forcing token refresh and retry...');
          // Force token refresh by clearing cached access token
          await prisma.company.update({
            where: { id: this.companyId },
            data: { oneDriveAccessToken: null, oneDriveTokenExpiry: null },
          });
          continue;
        }
        throw err;
      }
    }
  }

  async deleteFile(itemId) {
    const { accessToken, driveId } = await this._getTokens();
    await this._graphRequest('DELETE', `/drives/${driveId}/items/${itemId}`, null, accessToken, driveId);
    return true;
  }

  async getFileUrl(itemId) {
    // Return item ID — actual content is served via proxy
    return itemId;
  }

  // Find existing folder by name, or create it — avoids duplicates on reconnect
  async findOrCreateFolder(name, parentFolderId) {
    try {
      const children = await this.listFolder(parentFolderId);
      const existing = children.find(f => f.name.toLowerCase() === name.toLowerCase());
      if (existing) return existing.id;
    } catch { /* if listing fails, fall through to create */ }
    return this.createFolder(name, parentFolderId);
  }

  async createFolder(name, parentFolderId) {
    const { accessToken, driveId } = await this._getTokens();
    
    // Use /root/children if parent is root, otherwise use /items/id/children
    const path = (!parentFolderId || parentFolderId === 'root')
      ? `/drives/${driveId}/root/children` 
      : `/drives/${driveId}/items/${parentFolderId}/children`;

    const result = await this._graphRequest('POST', path, {
      name,
      folder: {},
      "@microsoft.graph.conflictBehavior": "rename"
    }, accessToken, driveId);
    return result.id;
  }

  async deleteFolder(folderId) {
    return this.deleteFile(folderId);
  }

  async renameItem(itemId, newName) {
    const { accessToken, driveId } = await this._getTokens();
    await this._graphRequest('PATCH', `/drives/${driveId}/items/${itemId}`, { name: newName }, accessToken, driveId);
    return true;
  }

  async moveItem(itemId, newParentId) {
    const { accessToken, driveId } = await this._getTokens();
    const parentRef = (!newParentId || newParentId === 'root') 
      ? { path: '/drive/root' } 
      : { id: newParentId };

    await this._graphRequest('PATCH', `/drives/${driveId}/items/${itemId}`, {
      parentReference: parentRef
    }, accessToken, driveId);
    return true;
  }

  async listFolder(folderId) {
    const { accessToken, driveId } = await this._getTokens();
    const path = (!folderId || folderId === 'root')
      ? `/drives/${driveId}/root/children?$filter=folder ne null`
      : `/drives/${driveId}/items/${folderId}/children?$filter=folder ne null`;

    const result = await this._graphRequest('GET', path, null, accessToken, driveId);
    return result.value || [];
  }

  async getDelta(deltaLink) {
    // Retry once on 401 — token may have expired between syncs
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { accessToken, driveId } = await this._getTokens();
        const company = await prisma.company.findUnique({ where: { id: this.companyId } });

        let url = deltaLink;
        if (!url) {
          const rootId = company.oneDriveRootItemId || 'root';
          url = `/drives/${driveId}/items/${rootId}/delta`;
        }

        const result = await this._graphRequest('GET', url, null, accessToken, driveId);
        return {
          changes: result.value || [],
          nextDeltaLink: result['@odata.deltaLink'] || result['@odata.nextLink'] || null,
        };
      } catch (err) {
        if (attempt === 0 && err.message && (err.message.includes('401') || err.message.includes('InvalidAuthenticationToken'))) {
          console.log('[OneDrive] 401 on getDelta, forcing token refresh and retry...');
          await prisma.company.update({
            where: { id: this.companyId },
            data: { oneDriveAccessToken: null, oneDriveTokenExpiry: null },
          });
          continue;
        }
        throw err;
      }
    }
  }

  // Static method: exchange auth code for tokens (used in OAuth callback)
  static async exchangeCodeForTokens(code) {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3030';
    const params = new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID,
      client_secret: process.env.AZURE_CLIENT_SECRET,
      code,
      redirect_uri: `${backendUrl}/api/onedrive/auth/callback`,
      grant_type: 'authorization_code',
    });

    return new Promise((resolve, reject) => {
      const postData = params.toString();
      const options = {
        hostname: 'login.microsoftonline.com',
        path: `/common/oauth2/v2.0/token`,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(postData),
        },
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try { 
            const parsed = JSON.parse(data);
            resolve(parsed); 
          } catch(e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.write(postData);
      req.end();
    });
  }

  // Get user profile and drive info using access token
  static async getUserInfo(accessToken) {
    const getJson = (path) => new Promise((resolve, reject) => {
      const options = {
        hostname: 'graph.microsoft.com',
        path: `/v1.0${path}`,
        method: 'GET',
        headers: { 'Authorization': `Bearer ${accessToken}` },
      };
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.end();
    });

    const [user, drive] = await Promise.all([
      getJson('/me'),
      getJson('/me/drive'),
    ]);
    return { email: user.mail || user.userPrincipalName, driveId: drive.id };
  }
}

module.exports = OneDriveProvider;
