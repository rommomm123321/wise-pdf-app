// TypeScript обертка для Web Worker декодера тайлов

export interface TileDecodeRequest {
  id: string;
  blob: Blob;
  options?: ImageBitmapOptions;
}

export interface TileDecodeResult {
  id: string;
  success: boolean;
  imageBitmap?: ImageBitmap;
  error?: string;
}

export interface BatchDecodeRequest {
  type: 'batch';
  tiles: TileDecodeRequest[];
}

export interface ProgressiveDecodeRequest {
  type: 'progressive';
  id: string;
  chunks: BlobPart[];
}

export type WorkerRequest = 
  | TileDecodeRequest 
  | BatchDecodeRequest 
  | ProgressiveDecodeRequest;

export type WorkerResponse = 
  | TileDecodeResult 
  | { type: 'batch-result', results: TileDecodeResult[] };

class TileDecoderWorker {
  private worker: Worker | null = null;
  private pendingRequests = new Map<string, (result: TileDecodeResult) => void>();
  private batchCallback: ((results: TileDecodeResult[]) => void) | null = null;
  
  constructor() {
    this.initWorker();
  }
  
  private initWorker() {
    if (typeof Worker === 'undefined') {
      console.warn('Web Workers not supported, falling back to main thread');
      return;
    }
    
    try {
      this.worker = new Worker(new URL('./tile-decoder.worker.js', import.meta.url));
      
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
        if ('type' in e.data && e.data.type === 'batch-result') {
          if (this.batchCallback) {
            this.batchCallback(e.data.results);
            this.batchCallback = null;
          }
        } else {
          const result = e.data as TileDecodeResult;
          const callback = this.pendingRequests.get(result.id);
          if (callback) {
            callback(result);
            this.pendingRequests.delete(result.id);
          }
        }
      };
      
      this.worker.onerror = (error) => {
        console.error('Tile decoder worker error:', error);
        // Fallback to main thread on worker failure
        this.worker = null;
      };
      
    } catch (error) {
      console.error('Failed to create tile decoder worker:', error);
      this.worker = null;
    }
  }
  
  async decodeTile(request: TileDecodeRequest): Promise<TileDecodeResult> {
    if (!this.worker) {
      // Fallback to main thread
      return this.decodeInMainThread(request);
    }
    
    return new Promise((resolve) => {
      this.pendingRequests.set(request.id, resolve);
      this.worker!.postMessage(request);
    });
  }
  
  async decodeBatch(requests: TileDecodeRequest[]): Promise<TileDecodeResult[]> {
    if (!this.worker || requests.length === 0) {
      // Fallback to main thread
      const results = await Promise.all(
        requests.map(req => this.decodeInMainThread(req))
      );
      return results;
    }
    
    return new Promise((resolve) => {
      this.batchCallback = resolve;
      this.worker!.postMessage({
        type: 'batch',
        tiles: requests
      } as BatchDecodeRequest);
    });
  }
  
  async decodeProgressive(id: string, chunks: BlobPart[]): Promise<TileDecodeResult> {
    if (!this.worker) {
      // Fallback to main thread - собираем chunks в blob
      const blob = new Blob(chunks, { type: 'image/webp' });
      return this.decodeInMainThread({ id, blob });
    }
    
    return new Promise((resolve) => {
      this.pendingRequests.set(id, resolve);
      this.worker!.postMessage({
        type: 'progressive',
        id,
        chunks
      } as ProgressiveDecodeRequest);
    });
  }
  
  private async decodeInMainThread(request: TileDecodeRequest): Promise<TileDecodeResult> {
    try {
      const imageBitmap = await createImageBitmap(
        request.blob, 
        request.options || {
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'none',
          imageOrientation: 'none'
        }
      );
      
      return {
        id: request.id,
        success: true,
        imageBitmap
      };
    } catch (error) {
      return {
        id: request.id,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.pendingRequests.clear();
    this.batchCallback = null;
  }
  
  isSupported(): boolean {
    return typeof Worker !== 'undefined' && 
           typeof createImageBitmap !== 'undefined' &&
           typeof OffscreenCanvas !== 'undefined';
  }
  
  getStatus(): 'active' | 'fallback' | 'unsupported' {
    if (!this.isSupported()) return 'unsupported';
    return this.worker ? 'active' : 'fallback';
  }
}

// Singleton instance
let instance: TileDecoderWorker | null = null;

export function getTileDecoder(): TileDecoderWorker {
  if (!instance) {
    instance = new TileDecoderWorker();
  }
  return instance;
}

export function terminateTileDecoder() {
  if (instance) {
    instance.terminate();
    instance = null;
  }
}

// React hook удален из этого файла, должен быть в отдельном файле если нужен