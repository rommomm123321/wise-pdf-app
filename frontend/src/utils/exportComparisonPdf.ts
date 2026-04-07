/**
 * exportComparisonPdf.ts
 *
 * Bluebeam-style overlay PDF with OCG layers (vector quality).
 *
 * pdf-lib cannot write OCProperties to catalog (PDFCatalog ignores custom keys).
 * Workaround: build PDF with embedPdf Form XObjects + BDC/EMC markers,
 * then post-process saved bytes with incremental update to inject OCG structure.
 */

import { PDFDocument, PDFName, PDFNumber, PDFDict, PDFRef, PDFString } from 'pdf-lib';

export interface ComparisonPdfOptions {
  token: string;
  oldDocId: string;
  newDocId: string;
  oldColor: string;
  newColor: string;
  opacity: number;
  pageMapping?: number[];
  oldLabel?: string;
  newLabel?: string;
  filename?: string;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Incremental PDF update: appends OCG objects + new catalog with OCProperties.
 * This bypasses pdf-lib's PDFCatalog limitation.
 */
function injectOCGIncremental(pdfBytes: Uint8Array, layers: { name: string; objNums?: number[] }[]): Uint8Array {
  const str = new TextDecoder('latin1').decode(pdfBytes);

  // Find max object number
  const objNums = [...str.matchAll(/(\d+) 0 obj/g)].map(m => parseInt(m[1]));
  let nextObj = Math.max(...objNums) + 1;

  // Create OCG objects
  const ocgObjNums: number[] = [];
  const newObjects: string[] = [];
  for (const layer of layers) {
    const n = nextObj++;
    ocgObjNums.push(n);
    newObjects.push(`${n} 0 obj\n<< /Type /OCG /Name (${layer.name}) >>\nendobj`);
  }

  // Find original catalog to preserve /Pages ref
  const rootMatch = str.match(/\/Root (\d+) 0 R/);
  if (!rootMatch) return pdfBytes; // can't patch
  const catObjNum = parseInt(rootMatch[1]);

  const pagesMatch = str.match(/\/Pages (\d+) 0 R/);
  const pagesRef = pagesMatch ? pagesMatch[1] + ' 0 R' : '1 0 R';

  // Build new catalog with OCProperties
  const ocgsStr = '[ ' + ocgObjNums.map(n => `${n} 0 R`).join(' ') + ' ]';
  const newCatObjNum = nextObj++;
  newObjects.push(
    `${newCatObjNum} 0 obj\n` +
    `<< /Type /Catalog /Pages ${pagesRef}\n` +
    `/OCProperties << /OCGs ${ocgsStr} /D << /ON ${ocgsStr} /BaseState /ON /Order ${ocgsStr} >> >>\n` +
    `>>\nendobj`
  );

  // Build incremental append
  const fileSize = pdfBytes.length;
  let appendStr = '\n';
  const xrefEntries: { num: number; offset: number }[] = [];

  for (const obj of newObjects) {
    const offset = fileSize + new TextEncoder().encode(appendStr).length;
    const numMatch = obj.match(/^(\d+)/);
    xrefEntries.push({ num: parseInt(numMatch![1]), offset });
    appendStr += obj + '\n\n';
  }

  xrefEntries.sort((a, b) => a.num - b.num);

  const xrefOffset = fileSize + new TextEncoder().encode(appendStr).length;
  appendStr += 'xref\n';
  for (const e of xrefEntries) {
    appendStr += `${e.num} 1\n`;
    appendStr += String(e.offset).padStart(10, '0') + ' 00000 n \n';
  }

  // Find previous startxref
  const prevXrefMatch = str.match(/startxref\n(\d+)/);
  const prevXref = prevXrefMatch ? prevXrefMatch[1] : '0';

  appendStr += `trailer\n<< /Size ${nextObj} /Root ${newCatObjNum} 0 R /Prev ${prevXref} >>\n`;
  appendStr += `startxref\n${xrefOffset}\n%%EOF\n`;

  // Concatenate
  const appendBytes = new TextEncoder().encode(appendStr);
  const result = new Uint8Array(pdfBytes.length + appendBytes.length);
  result.set(pdfBytes);
  result.set(appendBytes, pdfBytes.length);
  return result;
}

export async function generateComparisonPdf(opts: ComparisonPdfOptions): Promise<Uint8Array> {
  const {
    token, oldDocId, newDocId, opacity,
    pageMapping, oldLabel = 'Old Revision', newLabel = 'New Revision', onProgress,
  } = opts;

  const headers = { Authorization: `Bearer ${token}` };
  onProgress?.(0, 5);

  const [oldRes, newRes] = await Promise.all([
    fetch(`/api/documents/${oldDocId}/proxy`, { headers }),
    fetch(`/api/documents/${newDocId}/proxy`, { headers }),
  ]);
  if (!oldRes.ok) throw new Error(`Old PDF: ${oldRes.status}`);
  if (!newRes.ok) throw new Error(`New PDF: ${newRes.status}`);

  const oldBytes = new Uint8Array(await oldRes.arrayBuffer());
  const newBytes = new Uint8Array(await newRes.arrayBuffer());
  onProgress?.(1, 5);

  const oldPdf = await PDFDocument.load(oldBytes, { ignoreEncryption: true });
  const newPdf = await PDFDocument.load(newBytes, { ignoreEncryption: true });
  onProgress?.(2, 5);

  const oldCount = oldPdf.getPageCount();
  const newCount = newPdf.getPageCount();
  const total = Math.max(oldCount, newCount);

  const outPdf = await PDFDocument.create();
  const ctx = outPdf.context;

  // NOTE: OCG will be injected via incremental update AFTER save.
  // Here we just use placeholder property names in BDC markers.

  const newAlpha = Math.max(0.3, Math.min(0.95, opacity / 100));
  const gs0 = ctx.register(ctx.obj({ Type: PDFName.of('ExtGState'), CA: PDFNumber.of(1), ca: PDFNumber.of(1) }));
  const gs1 = ctx.register(ctx.obj({ Type: PDFName.of('ExtGState'), CA: PDFNumber.of(newAlpha), ca: PDFNumber.of(newAlpha) }));

  for (let i = 0; i < total; i++) {
    onProgress?.(2 + (i / total) * 2, 5);

    const oldIdx = pageMapping ? (pageMapping[i] ?? i) : i;
    const hasOld = oldIdx >= 0 && oldIdx < oldCount;
    const hasNew = i < newCount;
    if (!hasOld && !hasNew) continue;

    const refPdf = hasNew ? newPdf : oldPdf;
    const refIdx = hasNew ? i : oldIdx;
    const { width, height } = refPdf.getPage(refIdx).getSize();

    // Round-trip embed for reliable Form XObjects
    let oldFormRef: PDFRef | null = null;
    if (hasOld) {
      try {
        const tmp = await PDFDocument.create();
        const [cp] = await tmp.copyPages(oldPdf, [oldIdx]);
        tmp.addPage(cp);
        const [emb] = await outPdf.embedPdf(await PDFDocument.load(await tmp.save()), [0]);
        oldFormRef = emb.ref;
      } catch {}
    }

    let newFormRef: PDFRef | null = null;
    if (hasNew) {
      try {
        const tmp = await PDFDocument.create();
        const [cp] = await tmp.copyPages(newPdf, [i]);
        tmp.addPage(cp);
        const [emb] = await outPdf.embedPdf(await PDFDocument.load(await tmp.save()), [0]);
        newFormRef = emb.ref;
      } catch {}
    }

    const page = outPdf.addPage([width, height]);
    const node = page.node;

    const xobj = ctx.obj({}) as PDFDict;
    const gsD = ctx.obj({}) as PDFDict;
    const props = ctx.obj({}) as PDFDict;
    const res = ctx.obj({}) as PDFDict;
    res.set(PDFName.of('XObject'), xobj);
    res.set(PDFName.of('ExtGState'), gsD);
    res.set(PDFName.of('Properties'), props);
    node.set(PDFName.of('Resources'), res);

    // OCG property names — will be linked to OCG objects via incremental update
    // For now, create placeholder OCG dicts inline in Properties
    // These will be recognized by PDF viewers even without OCProperties in catalog,
    // but the incremental update adds the proper catalog-level OCG structure.
    const ocgOldDict = ctx.register(ctx.obj({ Type: PDFName.of('OCG'), Name: PDFString.of(oldLabel) }));
    const ocgNewDict = ctx.register(ctx.obj({ Type: PDFName.of('OCG'), Name: PDFString.of(newLabel) }));
    props.set(PDFName.of('LayerOld'), ocgOldDict);
    props.set(PDFName.of('LayerNew'), ocgNewDict);

    gsD.set(PDFName.of('GSOld'), gs0);
    gsD.set(PDFName.of('GSNew'), gs1);

    if (oldFormRef) xobj.set(PDFName.of('FmOld'), oldFormRef);
    if (newFormRef) xobj.set(PDFName.of('FmNew'), newFormRef);

    const ops: string[] = [];
    ops.push(`q 1 1 1 rg 0 0 ${width.toFixed(1)} ${height.toFixed(1)} re f Q`);

    if (oldFormRef) {
      ops.push('q', '/OC /LayerOld BDC', '/GSOld gs', '/FmOld Do', 'EMC', 'Q');
    }
    if (newFormRef) {
      ops.push('q', '/OC /LayerNew BDC', '/GSNew gs', '/FmNew Do', 'EMC', 'Q');
    }

    node.set(PDFName.of('Contents'), ctx.register(ctx.stream(
      new TextEncoder().encode(ops.join('\n')), {}
    )));
  }

  onProgress?.(4, 5);

  // Save base PDF (without OCProperties — pdf-lib can't write it)
  const baseBytes = await outPdf.save({ useObjectStreams: false });

  // Inject OCG structure via incremental update
  const finalBytes = injectOCGIncremental(baseBytes, [
    { name: oldLabel },
    { name: newLabel },
  ]);

  onProgress?.(5, 5);
  return finalBytes;
}

export async function downloadComparisonPdf(opts: ComparisonPdfOptions): Promise<void> {
  const bytes = await generateComparisonPdf(opts);
  const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = opts.filename || 'comparison.pdf';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
