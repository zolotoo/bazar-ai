// Прокси для видео — обходит CORS на мобильном Safari (Instagram CDN блокирует прямой доступ)
// GET /api/video-proxy?url=<encoded-video-url>
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const url = req.query.url;
  if (!url) {
    return res.status(400).json({ error: 'url query param is required' });
  }

  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(url);
  } catch {
    return res.status(400).json({ error: 'Invalid url' });
  }

  // Только Instagram CDN и известные источники
  const allowedHosts = ['cdninstagram.com', 'fbcdn.net', 'scontent', 'cdn.fbsbx.com'];
  const isAllowed = allowedHosts.some(h => decodedUrl.includes(h));
  if (!isAllowed) {
    return res.status(403).json({ error: 'URL not allowed' });
  }

  try {
    const range = req.headers.range || '';
    const fetchOpts = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VideoProxy/1.0)',
        ...(range && { Range: range }),
      },
    };

    const response = await fetch(decodedUrl, fetchOpts);

    if (!response.ok) {
      return res.status(response.status).json({ error: 'Upstream error' });
    }

    const contentType = response.headers.get('content-type') || 'video/mp4';
    const contentLength = response.headers.get('content-length');
    const acceptRanges = response.headers.get('accept-ranges');

    res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);

    if (response.status === 206) {
      res.setHeader('Content-Range', response.headers.get('content-range'));
      res.status(206);
    }

    // Стриминг — обходим лимит 4.5MB у Vercel
    const { Readable } = await import('stream');
    const reader = response.body.getReader();
    const stream = new Readable({
      async read() {
        try {
          const { done, value } = await reader.read();
          if (done) {
            this.push(null);
          } else {
            this.push(Buffer.from(value));
          }
        } catch (e) {
          this.destroy(e);
        }
      },
    });
    stream.on('error', () => res.end());
    stream.pipe(res);
  } catch (err) {
    console.error('Video proxy error:', err);
    return res.status(502).json({ error: 'Proxy failed' });
  }
}
