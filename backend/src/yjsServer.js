const { setupWSConnection, setPersistence } = require('y-websocket/bin/utils');
const Y = require('yjs');
const prisma = require('./prismaClient');

setPersistence({
  bindState: async (documentId, ydoc) => {
    console.log(`[Yjs] Binding state for doc: ${documentId}`);
    try {
      // 1. Load from DB
      const markups = await prisma.markup.findMany({
        where: { documentId },
        include: { author: { select: { id: true, name: true, email: true } } },
      });

      const ymap = ydoc.getMap('markups');

      // 2. Populate Yjs map
      ydoc.transact(() => {
        for (const m of markups) {
          if (!ymap.has(m.id)) {
            // ENSURE DATE IS ISO STRING FOR FRONTEND
            const cleanMarkup = {
              id: m.id,
              type: m.type,
              pageNumber: m.pageNumber,
              documentId: m.documentId,
              authorId: m.authorId,
              author: m.author,
              createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
              allowedEditUserIds: m.allowedEditUserIds || [],
              allowedDeleteUserIds: m.allowedDeleteUserIds || [],
              coordinates: typeof m.coordinates === 'string' ? JSON.parse(m.coordinates) : m.coordinates,
              properties: typeof m.properties === 'string' ? JSON.parse(m.properties) : m.properties,
            };
            ymap.set(m.id, cleanMarkup);
          }
        }
      }, 'server-init');

      console.log(`[Yjs] Loaded ${markups.length} markups from DB for doc ${documentId}`);

      // 3. Observe changes
      ymap.observe(async (event) => {
        if (event.transaction.origin === 'server-init') return;

        for (const key of event.keysChanged) {
          const change = event.changes.keys.get(key);
          if (!change) continue;

          try {
            if (change.action === 'add' || change.action === 'update') {
              const m = ymap.get(key);
              if (!m) continue;

              if (!m.id || !m.type || m.pageNumber === undefined) continue;

              await prisma.markup.upsert({
                where: { id: key },
                update: {
                  coordinates: m.coordinates || {},
                  properties: m.properties || {},
                  allowedEditUserIds: m.allowedEditUserIds || [],
                  allowedDeleteUserIds: m.allowedDeleteUserIds || [],
                },
                create: {
                  id: key,
                  documentId: m.documentId || documentId,
                  type: m.type,
                  pageNumber: m.pageNumber,
                  coordinates: m.coordinates || {},
                  properties: m.properties || {},
                  authorId: m.authorId,
                  allowedEditUserIds: m.allowedEditUserIds || [],
                  allowedDeleteUserIds: m.allowedDeleteUserIds || [],
                }
              });
            } else if (change.action === 'delete') {
              await prisma.markup.delete({ where: { id: key } }).catch(() => {});
            }
          } catch (err) {
            console.error(`[Yjs] Persistence error for markup ${key}:`, err);
          }
        }
      });
    } catch (err) {
      console.error(`[Yjs] Bind error for document ${documentId}:`, err);
    }
  },
  writeState: async (documentId, ydoc) => {
    return Promise.resolve();
  }
});

module.exports = function setupYjsWebSocket(wss) {
  wss.on('connection', (ws, req) => {
    const documentId = req.url.split('/yjs/')[1]?.split('?')[0];
    if (!documentId) {
      ws.close(1008, 'Missing document ID');
      return;
    }
    ws.user = req.user;
    setupWSConnection(ws, req, { docName: documentId });
  });
};
