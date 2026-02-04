/**
 * Прокси URL видео через наш API — обходит CORS на мобильном Safari.
 * Instagram CDN блокирует прямое воспроизведение в <video> на iOS.
 */
const INSTAGRAM_CDN_HOSTS = ['cdninstagram.com', 'fbcdn.net', 'scontent', 'cdn.fbsbx.com'];

export function proxyVideoUrl(url: string | null | undefined): string | null | undefined {
  if (!url) return url;
  if (url.startsWith('/') || url.startsWith('data:')) return url;
  if (url.includes('supabase.co')) return url; // Наш storage — без прокси
  const needsProxy = INSTAGRAM_CDN_HOSTS.some(h => url.includes(h));
  if (!needsProxy) return url;
  return `/api/video-proxy?url=${encodeURIComponent(url)}`;
}
