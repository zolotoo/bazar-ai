/**
 * Inline SVG placeholder — не требует внешних запросов, работает везде.
 * Решает проблему DNS блокировки via.placeholder.com.
 */
export function getPlaceholderDataUri(width = 270, height = 360): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect fill="#e2e8f0" width="100%" height="100%"/><text x="50%" y="50%" fill="#94a3b8" font-size="14" text-anchor="middle" dy=".3em" font-family="system-ui,sans-serif">?</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Плейсхолдер 270x360 (карточки видео) */
export const PLACEHOLDER_270x360 = getPlaceholderDataUri(270, 360);
/** Плейсхолдер 200x356 */
export const PLACEHOLDER_200x356 = getPlaceholderDataUri(200, 356);
/** Плейсхолдер 200x267 */
export const PLACEHOLDER_200x267 = getPlaceholderDataUri(200, 267);
/** Плейсхолдер 320x400 */
export const PLACEHOLDER_320x400 = getPlaceholderDataUri(320, 400);
/** Плейсхолдер 320x420 */
export const PLACEHOLDER_320x420 = getPlaceholderDataUri(320, 420);
/** Плейсхолдер 64x96 */
export const PLACEHOLDER_64x96 = getPlaceholderDataUri(64, 96);
/** Плейсхолдер 400x600 */
export const PLACEHOLDER_400x600 = getPlaceholderDataUri(400, 600);

/**
 * Проксирование Instagram изображений.
 * Использует images.weserv.nl вместо нашего /api/proxy-image — Instagram блокирует
 * запросы с IP облачных провайдеров (Vercel), weserv.nl обычно не блокируется.
 * @param emptyPlaceholder — плейсхолдер при отсутствии url (по умолчанию 270x360)
 */
export function proxyImageUrl(url?: string, emptyPlaceholder = PLACEHOLDER_270x360): string {
  if (!url) return emptyPlaceholder;
  if (url.startsWith('data:')) return url;
  const isInstagram =
    url.includes('cdninstagram.com') ||
    url.includes('instagram.com') ||
    url.includes('fbcdn.net') ||
    url.includes('scontent.') ||
    url.includes('workers.dev') ||
    url.includes('socialapi');
  if (isInstagram) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}&n=-1`;
  }
  return url;
}
