// Vercel Serverless Function - прокси для Instagram изображений
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: 'url parameter is required' });
  }

  try {
    const decodedUrl = decodeURIComponent(url);
    
    // Разрешённые источники: Instagram CDN (в т.ч. fbcdn, scontent) и социальные API
    const isAllowed =
      decodedUrl.includes('cdninstagram.com') ||
      decodedUrl.includes('instagram.com') ||
      decodedUrl.includes('fbcdn.net') ||
      decodedUrl.includes('scontent.') ||
      decodedUrl.includes('workers.dev') ||
      decodedUrl.includes('socialapi');
    if (!isAllowed) {
      return res.status(400).json({ error: 'URL not allowed' });
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    };
    if (decodedUrl.includes('cdninstagram.com') || decodedUrl.includes('instagram.com') || decodedUrl.includes('fbcdn.net') || decodedUrl.includes('scontent.')) {
      headers['Referer'] = 'https://www.instagram.com/';
    }

    const response = await fetch(decodedUrl, { headers });

    if (!response.ok) {
      console.error('Failed to fetch image:', response.status);
      return res.status(response.status).json({ error: 'Failed to fetch image' });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Кешируем на 24 часа
    res.send(Buffer.from(buffer));
  } catch (error) {
    console.error('Proxy image error:', error);
    return res.status(500).json({ error: 'Failed to proxy image' });
  }
}
