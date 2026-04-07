// Web Worker для декодирования WebP тайлов
// Цель: вынести createImageBitmap из main thread для более плавного UI

self.onmessage = async function(e) {
  const data = e.data;
  
  // Обработка batch декодирования
  if (data.type === 'batch') {
    const { tiles } = data;
    const results = [];
    
    for (const tile of tiles) {
      try {
        const imageBitmap = await createImageBitmap(tile.blob, tile.options);
        results.push({
          id: tile.id,
          success: true,
          imageBitmap
        });
      } catch (error) {
        results.push({
          id: tile.id,
          success: false,
          error: error.message
        });
      }
    }
    
    // Извлекаем все ImageBitmap для передачи
    const transferables = results
      .filter(r => r.success)
      .map(r => r.imageBitmap);
    
    self.postMessage({
      type: 'batch-result',
      results
    }, transferables);
    return;
  }
  
  // Поддержка progressive decoding
  if (data.type === 'progressive') {
    const { id, chunks } = data;
    
    try {
      // Собираем chunks в полный blob
      const blob = new Blob(chunks, { type: 'image/webp' });
      
      // Декодируем с опциями для лучшей производительности
      const options = {
        premultiplyAlpha: 'none',
        colorSpaceConversion: 'none',
        imageOrientation: 'none'
      };
      
      const imageBitmap = await createImageBitmap(blob, options);
      
      self.postMessage({
        id,
        success: true,
        imageBitmap
      }, [imageBitmap]);
      
    } catch (error) {
      self.postMessage({
        id,
        success: false,
        error: error.message
      });
    }
    return;
  }
  
  // Обычное декодирование одного тайла
  const { id, blob, options } = data;
  
  try {
    // Декодируем WebP blob в ImageBitmap
    const imageBitmap = await createImageBitmap(blob, options);
    
    // Передаем ImageBitmap как Transferable object (без копирования)
    self.postMessage({
      id,
      success: true,
      imageBitmap
    }, [imageBitmap]);
    
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: error.message
    });
  }
};