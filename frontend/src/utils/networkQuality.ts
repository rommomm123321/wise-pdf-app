// Утилиты для определения качества сети и адаптивного качества WebP

export interface NetworkQuality {
  type: 'slow' | 'medium' | 'fast' | 'unknown';
  effectiveType?: string;
  downlink?: number; // Мбит/с
  rtt?: number; // мс
  saveData?: boolean;
}

export interface AdaptiveQualityConfig {
  // Качество WebP для разных типов сети
  webpQuality: {
    slow: number;    // 2G / медленные сети
    medium: number;  // 3G / средние сети  
    fast: number;    // 4G / WiFi / быстрые сети
    unknown: number; // По умолчанию
  };
  
  // Минимальное качество (даже на медленных сетях)
  minQuality: number;
  
  // Максимальное качество
  maxQuality: number;
  
  // Использовать ли saveData режим браузера
  respectSaveData: boolean;
}

// Конфигурация по умолчанию
export const DEFAULT_CONFIG: AdaptiveQualityConfig = {
  webpQuality: {
    slow: 50,    // Низкое качество для медленных сетей
    medium: 65,  // Среднее качество
    fast: 75,    // Высокое качество (стандартное)
    unknown: 70  // По умолчанию
  },
  minQuality: 40,
  maxQuality: 85,
  respectSaveData: true
};

// Определить качество сети
export function getNetworkQuality(): NetworkQuality {
  const connection = (navigator as any).connection || 
                    (navigator as any).mozConnection || 
                    (navigator as any).webkitConnection;
  
  if (!connection) {
    return { type: 'unknown' };
  }
  
  const { effectiveType, downlink, rtt, saveData } = connection;
  
  let type: NetworkQuality['type'] = 'unknown';
  
  if (effectiveType) {
    switch (effectiveType) {
      case 'slow-2g':
      case '2g':
        type = 'slow';
        break;
      case '3g':
        type = 'medium';
        break;
      case '4g':
      case 'wifi':
        type = 'fast';
        break;
      default:
        type = 'unknown';
    }
  } else if (downlink) {
    // Определяем по скорости (Мбит/с)
    if (downlink < 1) type = 'slow';
    else if (downlink < 5) type = 'medium';
    else type = 'fast';
  }
  
  return {
    type,
    effectiveType,
    downlink,
    rtt,
    saveData
  };
}

// Получить качество WebP на основе качества сети
export function getAdaptiveWebpQuality(
  config: AdaptiveQualityConfig = DEFAULT_CONFIG
): number {
  const network = getNetworkQuality();
  
  // Если включен saveData режим, используем минимальное качество
  if (config.respectSaveData && network.saveData) {
    return config.minQuality;
  }
  
  // Получаем качество на основе типа сети
  let quality = config.webpQuality[network.type];
  
  // Корректируем на основе downlink если доступно
  if (network.downlink !== undefined) {
    if (network.downlink < 0.5) {
      quality = Math.max(config.minQuality, quality - 15);
    } else if (network.downlink < 2) {
      quality = Math.max(config.minQuality, quality - 5);
    } else if (network.downlink > 10) {
      quality = Math.min(config.maxQuality, quality + 5);
    }
  }
  
  // Корректируем на основе RTT если доступно
  if (network.rtt !== undefined && network.rtt > 300) {
    quality = Math.max(config.minQuality, quality - 10);
  }
  
  // Ограничиваем минимальным и максимальным качеством
  return Math.max(config.minQuality, Math.min(config.maxQuality, quality));
}

// Слушатель изменений качества сети
export function onNetworkChange(
  callback: (quality: NetworkQuality, webpQuality: number) => void,
  config: AdaptiveQualityConfig = DEFAULT_CONFIG
): () => void {
  const connection = (navigator as any).connection || 
                    (navigator as any).mozConnection || 
                    (navigator as any).webkitConnection;
  
  if (!connection || !connection.addEventListener) {
    // API не поддерживается
    return () => {};
  }
  
  const handleChange = () => {
    const network = getNetworkQuality();
    const quality = getAdaptiveWebpQuality(config);
    callback(network, quality);
  };
  
  connection.addEventListener('change', handleChange);
  
  // Вызываем сразу для текущего состояния
  setTimeout(handleChange, 0);
  
  return () => {
    connection.removeEventListener('change', handleChange);
  };
}

// Хук React для адаптивного качества (отдельный файл если нужно)
// export function useAdaptiveQuality(
//   config: AdaptiveQualityConfig = DEFAULT_CONFIG
// ): { network: NetworkQuality; webpQuality: number } {
//   const [network, setNetwork] = useState<NetworkQuality>(getNetworkQuality());
//   const [webpQuality, setWebpQuality] = useState(getAdaptiveWebpQuality(config));
//   
//   useEffect(() => {
//     const unsubscribe = onNetworkChange((newNetwork, newQuality) => {
//       setNetwork(newNetwork);
//       setWebpQuality(newQuality);
//     }, config);
//     
//     return unsubscribe;
//   }, [config]);
//   
//   return { network, webpQuality };
// }

// Утилита для добавления параметра качества в URL тайла
export function addQualityToTileUrl(
  url: string, 
  quality: number,
  config: AdaptiveQualityConfig = DEFAULT_CONFIG
): string {
  // Ограничиваем качество
  const clampedQuality = Math.max(
    config.minQuality, 
    Math.min(config.maxQuality, quality)
  );
  
  // Добавляем параметр качества если его еще нет
  const urlObj = new URL(url, window.location.origin);
  
  // Удаляем старый параметр качества если есть
  urlObj.searchParams.delete('q');
  
  // Добавляем новый
  urlObj.searchParams.set('q', clampedQuality.toString());
  
  return urlObj.toString();
}

// Получить качество из URL
export function getQualityFromUrl(url: string): number | null {
  try {
    const urlObj = new URL(url, window.location.origin);
    const quality = urlObj.searchParams.get('q');
    return quality ? parseInt(quality, 10) : null;
  } catch {
    return null;
  }
}

// Определить нужно ли использовать адаптивное качество
export function shouldUseAdaptiveQuality(): boolean {
  // Проверяем поддержку Network Information API
  const hasNetworkAPI = !!(navigator as any).connection || 
                       !!(navigator as any).mozConnection || 
                       !!(navigator as any).webkitConnection;
  
  // Проверяем, не на десктопе ли мы (на десктопе обычно быстрый интернет)
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  
  return hasNetworkAPI && isMobile;
}