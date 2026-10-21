/** A source file can be large, but only the compressed copy is persisted. */
const MAX_SOURCE_BYTES = 10 * 1024 * 1024;
/** Six base64 photos must still fit comfortably into the localStorage quota. */
const MAX_DATA_URL_LENGTH = 450_000;

const ATTEMPTS = [
  { maxDimension: 1200, quality: 0.82 },
  { maxDimension: 1000, quality: 0.74 },
  { maxDimension: 800, quality: 0.68 },
  { maxDimension: 640, quality: 0.6 },
] as const;

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Не удалось прочитать изображение. Попробуйте другой файл.'));
    };
    image.src = objectUrl;
  });
}

function renderPhoto(
  image: HTMLImageElement,
  maxDimension: number,
  quality: number,
): string {
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const scale = Math.min(1, maxDimension / longestSide);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement('canvas');

  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Браузер не смог обработать изображение.');
  }

  // JPEG has no alpha channel, so transparent PNGs get a neutral white backing.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', quality);
}

/**
 * Validates and compresses a user photo before it goes into localStorage.
 * The result is always a `data:image/jpeg` URL; originals never leave the device.
 */
export async function prepareMarketPhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Можно прикладывать только изображения.');
  }

  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Файл больше 10 МБ — выберите изображение поменьше.');
  }

  const image = await loadImage(file);

  if (image.naturalWidth === 0 || image.naturalHeight === 0) {
    throw new Error('Не удалось определить размер изображения.');
  }

  let dataUrl = '';

  for (const attempt of ATTEMPTS) {
    dataUrl = renderPhoto(image, attempt.maxDimension, attempt.quality);

    if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
      break;
    }
  }

  return dataUrl;
}
