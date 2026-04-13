import Typo from 'typo-js';

let dictionary: any = null;
let loading = false;
let loadPromise: Promise<void> | null = null;

// Custom words that should NOT be flagged (construction/engineering terms)
const CUSTOM_WORDS = new Set([
  'hvac', 'mep', 'bim', 'rfi', 'submittal', 'punchlist', 'redline', 'conduit',
  'ductwork', 'flashing', 'joist', 'lintel', 'mullion', 'parapet', 'rebar',
  'soffit', 'stanchion', 'truss', 'fascia', 'furring', 'grout', 'sheathing',
  'subfloor', 'drywall', 'cmmu', 'elev', 'mech', 'elec', 'plmb', 'struct',
  'dwg', 'spec', 'qty', 'approx', 'typ', 'sim', 'eqp', 'mtl', 'assy',
  'precast', 'rebar', 'cmmu', 'reinf', 'conc', 'slab', 'footing', 'penthouse',
  'plenum', 'damper', 'diffuser', 'vav', 'ahu', 'chiller', 'boiler', 'piping',
  'firestopping', 'caulking', 'waterproofing', 'flameproofing', 'fireproofing',
]);

export async function loadDictionary(): Promise<void> {
  if (dictionary) return;
  if (loadPromise) return loadPromise;
  loading = true;
  loadPromise = (async () => {
    const [affRes, dicRes] = await Promise.all([
      fetch('/dictionaries/en_US.aff').then(r => r.text()),
      fetch('/dictionaries/en_US.dic').then(r => r.text()),
    ]);
    dictionary = new Typo('en_US', affRes, dicRes);
    loading = false;
  })();
  return loadPromise;
}

export interface SpellError {
  word: string;
  suggestions: string[];
  context: string;
  pageNumber: number;
  // Position on page for navigation
  x?: number;
  y?: number;
}

// Extract words, skipping numbers, abbreviations with dots, and very short words
function extractWords(text: string): Array<{ word: string; index: number }> {
  const results: Array<{ word: string; index: number }> = [];
  const regex = /[a-zA-Z']+/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const w = match[0];
    if (w.length < 2) continue;
    if (/^[A-Z]+$/.test(w) && w.length <= 5) continue; // skip acronyms
    results.push({ word: w, index: match.index });
  }
  return results;
}

/**
 * Check PDF text for spelling errors using pdfjs.
 * Scans text content of each page via pdfDoc.getPage().getTextContent().
 */
export async function checkPdfText(
  pdfDoc: any,
  pages: number[] | 'all',
  onProgress?: (page: number, total: number) => void,
): Promise<SpellError[]> {
  if (!dictionary || !pdfDoc) return [];
  const errors: SpellError[] = [];
  const numPages = pdfDoc.numPages;
  const pageList = pages === 'all' ? Array.from({ length: numPages }, (_, i) => i) : pages;

  for (let pi = 0; pi < pageList.length; pi++) {
    const pageIdx = pageList[pi];
    onProgress?.(pi + 1, pageList.length);
    try {
      const page = await pdfDoc.getPage(pageIdx + 1); // 1-based
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });
      const items = textContent.items as any[];

      for (const item of items) {
        if (!item.str || typeof item.str !== 'string') continue;
        const words = extractWords(item.str);
        for (const { word, index } of words) {
          const lower = word.toLowerCase();
          if (CUSTOM_WORDS.has(lower)) continue;
          if (dictionary.check(word)) continue;
          // Misspelled
          const start = Math.max(0, index - 15);
          const end = Math.min(item.str.length, index + word.length + 15);
          const context = (start > 0 ? '...' : '') + item.str.slice(start, end) + (end < item.str.length ? '...' : '');
          // Get position on page (normalized 0-1)
          const tx = item.transform ? item.transform[4] / viewport.width : 0;
          const ty = item.transform ? 1 - (item.transform[5] / viewport.height) : 0;
          errors.push({
            word,
            suggestions: dictionary.suggest(word, 5),
            context,
            pageNumber: pageIdx,
            x: tx,
            y: ty,
          });
        }
      }
    } catch { /* skip page */ }
  }
  return errors;
}

export function isLoaded() { return !!dictionary; }
export function isLoading() { return loading; }
