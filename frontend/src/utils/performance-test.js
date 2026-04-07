// Тест производительности Web Workers vs Main Thread декодирования

class PerformanceTest {
  constructor() {
    this.results = {
      mainThread: [],
      worker: [],
      batchMainThread: [],
      batchWorker: []
    };
  }

  async generateTestBlob(size = 512) {
    // Создаем тестовое изображение
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    // Рисуем градиент для сложного декодирования
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#ff0000');
    gradient.addColorStop(0.5, '#00ff00');
    gradient.addColorStop(1, '#0000ff');
    
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    
    // Добавляем текст для сложности
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Arial';
    ctx.fillText('Test Image', 10, 30);
    
    // Конвертируем в WebP blob
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/webp', 0.8);
    });
  }

  async testMainThreadDecode(blob, iterations = 10) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await createImageBitmap(blob, {
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none',
        imageOrientation: 'none'
      });
      const end = performance.now();
      times.push(end - start);
    }
    
    return {
      times,
      average: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      stdDev: this.calculateStdDev(times)
    };
  }

  async testWorkerDecode(blob, iterations = 10) {
    if (typeof Worker === 'undefined') {
      throw new Error('Web Workers not supported');
    }

    const worker = new Worker(new URL('../workers/tile-decoder.worker.js', import.meta.url));
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      
      await new Promise((resolve, reject) => {
        worker.onmessage = (e) => {
          if (e.data.success) {
            resolve(e.data.imageBitmap);
          } else {
            reject(new Error(e.data.error));
          }
        };
        
        worker.postMessage({
          id: `test-${i}`,
          blob,
          options: {
            premultiplyAlpha: 'none',
            colorSpaceConversion: 'none',
            imageOrientation: 'none'
          }
        });
      });
      
      const end = performance.now();
      times.push(end - start);
    }
    
    worker.terminate();
    
    return {
      times,
      average: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      stdDev: this.calculateStdDev(times)
    };
  }

  async testBatchDecoding(blob, batchSize = 4, iterations = 5) {
    const mainThreadTimes = [];
    const workerTimes = [];
    
    // Создаем worker для batch теста
    const worker = new Worker(new URL('../workers/tile-decoder.worker.js', import.meta.url));
    
    for (let i = 0; i < iterations; i++) {
      // Main thread batch
      const mainStart = performance.now();
      const mainPromises = [];
      for (let j = 0; j < batchSize; j++) {
        mainPromises.push(createImageBitmap(blob, {
          premultiplyAlpha: 'none',
          colorSpaceConversion: 'none',
          imageOrientation: 'none'
        }));
      }
      await Promise.all(mainPromises);
      const mainEnd = performance.now();
      mainThreadTimes.push(mainEnd - mainStart);
      
      // Worker batch
      const workerStart = performance.now();
      await new Promise((resolve) => {
        worker.onmessage = (e) => {
          if (e.data.type === 'batch-result') {
            resolve();
          }
        };
        
        const tiles = [];
        for (let j = 0; j < batchSize; j++) {
          tiles.push({
            id: `batch-test-${i}-${j}`,
            blob,
            options: {
              premultiplyAlpha: 'none',
              colorSpaceConversion: 'none',
              imageOrientation: 'none'
            }
          });
        }
        
        worker.postMessage({
          type: 'batch',
          tiles
        });
      });
      const workerEnd = performance.now();
      workerTimes.push(workerEnd - workerStart);
    }
    
    worker.terminate();
    
    return {
      mainThread: {
        times: mainThreadTimes,
        average: mainThreadTimes.reduce((a, b) => a + b, 0) / mainThreadTimes.length,
        min: Math.min(...mainThreadTimes),
        max: Math.max(...mainThreadTimes)
      },
      worker: {
        times: workerTimes,
        average: workerTimes.reduce((a, b) => a + b, 0) / workerTimes.length,
        min: Math.min(...workerTimes),
        max: Math.max(...workerTimes)
      }
    };
  }

  calculateStdDev(numbers) {
    const avg = numbers.reduce((a, b) => a + b, 0) / numbers.length;
    const squareDiffs = numbers.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / squareDiffs.length;
    return Math.sqrt(avgSquareDiff);
  }

  async runFullTest() {
    console.log('🚀 Starting Web Worker Performance Test...');
    
    // Генерируем тестовый blob
    console.log('📦 Generating test image...');
    const testBlob = await this.generateTestBlob(512);
    console.log(`Test blob size: ${(testBlob.size / 1024).toFixed(2)} KB`);
    
    // Тест Main Thread
    console.log('🧪 Testing Main Thread decoding...');
    const mainThreadResult = await this.testMainThreadDecode(testBlob, 20);
    this.results.mainThread = mainThreadResult;
    console.log('Main Thread:', mainThreadResult);
    
    // Тест Worker
    console.log('👷 Testing Web Worker decoding...');
    try {
      const workerResult = await this.testWorkerDecode(testBlob, 20);
      this.results.worker = workerResult;
      console.log('Web Worker:', workerResult);
    } catch (error) {
      console.warn('Web Worker test failed:', error.message);
    }
    
    // Тест Batch декодирования
    console.log('📦 Testing Batch decoding (4 tiles)...');
    const batchResult = await this.testBatchDecoding(testBlob, 4, 10);
    this.results.batchMainThread = batchResult.mainThread;
    this.results.batchWorker = batchResult.worker;
    console.log('Batch Main Thread:', batchResult.mainThread);
    console.log('Batch Web Worker:', batchResult.worker);
    
    // Анализ результатов
    this.analyzeResults();
    
    return this.results;
  }

  analyzeResults() {
    console.log('\n📊 ========== PERFORMANCE ANALYSIS ==========');
    
    if (this.results.worker.average && this.results.mainThread.average) {
      const speedup = this.results.mainThread.average / this.results.worker.average;
      console.log(`⚡ Single tile speedup: ${speedup.toFixed(2)}x`);
      console.log(`   Main Thread: ${this.results.mainThread.average.toFixed(2)}ms`);
      console.log(`   Web Worker: ${this.results.worker.average.toFixed(2)}ms`);
    }
    
    if (this.results.batchWorker.average && this.results.batchMainThread.average) {
      const batchSpeedup = this.results.batchMainThread.average / this.results.batchWorker.average;
      console.log(`📦 Batch (4 tiles) speedup: ${batchSpeedup.toFixed(2)}x`);
      console.log(`   Main Thread: ${this.results.batchMainThread.average.toFixed(2)}ms`);
      console.log(`   Web Worker: ${this.results.batchWorker.average.toFixed(2)}ms`);
    }
    
    // Рекомендации
    console.log('\n💡 RECOMMENDATIONS:');
    
    if (this.results.worker.average < this.results.mainThread.average * 0.9) {
      console.log('✅ Web Workers provide significant performance benefit');
      console.log('   Consider enabling them for all users');
    } else if (this.results.worker.average > this.results.mainThread.average * 1.1) {
      console.log('⚠️  Web Workers are slower than Main Thread');
      console.log('   Check worker initialization overhead');
    } else {
      console.log('⚖️  Web Workers and Main Thread have similar performance');
      console.log('   Use Workers for better UI responsiveness');
    }
    
    if (this.results.batchWorker.average < this.results.batchMainThread.average * 0.7) {
      console.log('✅ Batch decoding with Workers is highly efficient');
      console.log('   Use batch size 4-8 for optimal performance');
    }
    
    // Проверка поддержки
    console.log('\n🔧 SYSTEM INFO:');
    console.log(`   User Agent: ${navigator.userAgent}`);
    console.log(`   Cores: ${navigator.hardwareConcurrency || 'Unknown'}`);
    console.log(`   Memory: ${navigator.deviceMemory || 'Unknown'} GB`);
    console.log(`   Worker support: ${typeof Worker !== 'undefined' ? 'Yes' : 'No'}`);
    console.log(`   OffscreenCanvas: ${typeof OffscreenCanvas !== 'undefined' ? 'Yes' : 'No'}`);
  }

  generateReport() {
    return {
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: navigator.deviceMemory,
      results: this.results,
      summary: {
        singleTileSpeedup: this.results.worker.average ? 
          (this.results.mainThread.average / this.results.worker.average).toFixed(2) : null,
        batchSpeedup: this.results.batchWorker.average ?
          (this.results.batchMainThread.average / this.results.batchWorker.average).toFixed(2) : null
      }
    };
  }
}

// Экспорт для использования в консоли разработчика
if (typeof window !== 'undefined') {
  window.PerformanceTest = PerformanceTest;
  console.log('🎯 PerformanceTest loaded. Run: await new PerformanceTest().runFullTest()');
}

export default PerformanceTest;