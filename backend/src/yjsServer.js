const { setupWSConnection, setPersistence } = require('y-websocket/bin/utils');
const Y = require('yjs');
const prisma = require('./prismaClient');
const { processMentions } = require('./services/notificationService');

module.exports = function setupYjsWebSocket(wss, io) {
  // Per-doc debounce timers: { [docId]: { [markupId]: timeout } }
  const debounceMap = new Map();
  // Per-markup property snapshot for change detection: { [markupId]: { comment, subject } }
  const prevPropsMap = new Map();

  setPersistence({
    bindState: async (documentId, ydoc) => {
      console.log(`[Yjs] Binding state for doc: ${documentId}`);
      try {
        const markups = await prisma.markup.findMany({
          where: { documentId },
          include: { author: { select: { id: true, name: true, email: true } } },
        });

        const ymap = ydoc.getMap('markups');

        ydoc.transact(() => {
          for (const m of markups) {
            if (!ymap.has(m.id)) {
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
              // Snapshot initial props for change detection
              prevPropsMap.set(m.id, { comment: cleanMarkup.properties?.comment, subject: cleanMarkup.properties?.subject });
            }
          }
        }, 'server-init');

        console.log(`[Yjs] Loaded ${markups.length} markups from DB for doc ${documentId}`);

        if (!debounceMap.has(documentId)) debounceMap.set(documentId, new Map());
        const docDebounce = debounceMap.get(documentId);

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

                const isNew = change.action === 'add';
                const actorId = m.updatedBy?.id || m.authorId;

                // Check if mentions-relevant fields changed (comment, subject, or canvas text)
                const prev = prevPropsMap.get(key) || {};
                const commentChanged = (m.properties?.comment || '') !== (prev.comment || '');
                const subjectChanged = (m.properties?.subject || '') !== (prev.subject || '');
                const canvasTextChanged = (m.properties?.text || '') !== (prev.text || '');
                const mentionsChanged = commentChanged || subjectChanged || canvasTextChanged;

                // Update snapshot
                prevPropsMap.set(key, {
                  comment: m.properties?.comment,
                  subject: m.properties?.subject,
                  text: m.properties?.text,
                });

                // Debounce DB write to avoid hammering DB during drag
                if (docDebounce.has(key)) clearTimeout(docDebounce.get(key));

                const timeout = setTimeout(async () => {
                  docDebounce.delete(key);
                  try {
                    const toIds = (v) => (v == null || !Array.isArray(v)) ? ['*'] : v;
                    const editIds = toIds(m.allowedEditUserIds);
                    const delIds  = toIds(m.allowedDeleteUserIds);

                    await prisma.markup.upsert({
                      where: { id: key },
                      update: {
                        coordinates: m.coordinates || {},
                        properties: m.properties || {},
                        allowedEditUserIds: editIds,
                        allowedDeleteUserIds: delIds,
                      },
                      create: {
                        id: key,
                        documentId: m.documentId || documentId,
                        type: m.type,
                        pageNumber: m.pageNumber,
                        coordinates: m.coordinates || {},
                        properties: m.properties || {},
                        authorId: m.authorId,
                        allowedEditUserIds: editIds,
                        allowedDeleteUserIds: delIds,
                      }
                    });

                    // Audit log
                    if (actorId) {
                      await prisma.auditLog.create({
                        data: {
                          action: isNew ? 'MARKUP_CREATE' : 'MARKUP_UPDATE',
                          userId: actorId,
                          documentId: m.documentId || documentId,
                          details: {
                            markupId: key,
                            type: m.type,
                            pageNumber: m.pageNumber,
                            ...(isNew ? {} : { updatedBy: m.updatedBy }),
                          },
                        }
                      }).catch(() => {});
                    }

                    // Process @mentions — only when relevant fields actually changed (prevents spam)
                    if (mentionsChanged && actorId && (m.properties?.subject || m.properties?.comment || m.properties?.text)) {
                      if (!m.properties?.isPastedOrDuplicated) {
                        const docInfo = await prisma.document.findUnique({
                          where: { id: m.documentId || documentId },
                          select: { folder: { select: { projectId: true } } },
                        });
                        const projectId = docInfo?.folder?.projectId;
                        if (projectId) {
                          await processMentions({
                            markupId: key,
                            documentId: m.documentId || documentId,
                            projectId,
                            actorId,
                            properties: m.properties,
                            io,
                          });
                        }
                      }
                    }
                  } catch (dbErr) {
                    console.error(`[Yjs] DB persist error for ${key}:`, dbErr.message);
                  }
                }, 400); // 400ms debounce — smooth during drag, still responsive

                docDebounce.set(key, timeout);

              } else if (change.action === 'delete') {
                // Cancel any pending debounce
                if (docDebounce.has(key)) { clearTimeout(docDebounce.get(key)); docDebounce.delete(key); }
                prevPropsMap.delete(key);

                // Get authorId from Prisma before deleting for audit
                const existing = await prisma.markup.findUnique({ where: { id: key }, select: { authorId: true, documentId: true, type: true } }).catch(() => null);
                await prisma.markup.delete({ where: { id: key } }).catch(() => {});

                if (existing?.authorId) {
                  await prisma.auditLog.create({
                    data: {
                      action: 'MARKUP_DELETE',
                      userId: existing.authorId,
                      documentId: existing.documentId || documentId,
                      details: { markupId: key, type: existing.type },
                    }
                  }).catch(() => {});
                }
              }
            } catch (err) {
              console.error(`[Yjs] Observer error for ${key}:`, err.message);
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
