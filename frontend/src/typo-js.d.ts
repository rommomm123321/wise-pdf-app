declare module 'typo-js' {
  class Typo {
    constructor(dictionary: string, affData?: string, dicData?: string, settings?: Record<string, unknown>);
    check(word: string): boolean;
    suggest(word: string, limit?: number): string[];
  }
  export default Typo;
}
