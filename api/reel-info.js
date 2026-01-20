// Vercel Serverless Function - получение информации о рилсе по URL/shortcode
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, shortcode } = req.body;

  if (!url && !shortcode) {
    return res.status(400).json({ error: 'url or shortcode is required' });
  }

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '60b367f230mshd3ca48b7e1fa21cp18f206jsn57b97472bcca';
  
  // Извлекаем shortcode из URL если нужно
  let code = shortcode;
  if (!code && url) {
    const match = url.match(/(?:reel|p)\/([A-Za-z0-9_-]+)/);
    code = match ? match[1] : null;
  }

  if (!code) {
    return res.status(400).json({ error: 'Could not extract shortcode from URL' });
  }

  console.log('Fetching reel info for shortcode:', code);

  // Пробуем разные API для получения статистики
  const apis = [
    {
      name: 'instagram-scraper-20251',
      host: 'instagram-scraper-20251.p.rapidapi.com',
      url: `https://instagram-scraper-20251.p.rapidapi.com/v1/media/${code}`,
      method: 'GET',
    },
    {
      name: 'instagram-scraper-20251-post',
      host: 'instagram-scraper-20251.p.rapidapi.com', 
      url: `https://instagram-scraper-20251.p.rapidapi.com/v1/post/${code}`,
      method: 'GET',
    },
    {
      name: 'instagram-looter2',
      host: 'instagram-looter2.p.rapidapi.com',
      url: `https://instagram-looter2.p.rapidapi.com/media/${code}`,
      method: 'GET',
    },
    {
      name: 'instagram-bulk-scraper',
      host: 'instagram-bulk-scraper-latest.p.rapidapi.com',
      url: `https://instagram-bulk-scraper-latest.p.rapidapi.com/media_info/${code}`,
      method: 'GET',
    },
  ];

  for (const api of apis) {
    try {
      console.log(`Trying ${api.name}:`, api.url);
      
      const response = await fetch(api.url, {
        method: api.method,
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': api.host,
        },
      });

      if (!response.ok) {
        console.log(`${api.name} returned ${response.status}`);
        continue;
      }

      const data = await response.json();
      console.log(`${api.name} response keys:`, Object.keys(data));

      // Извлекаем данные из разных форматов ответа
      const item = data.data || data.media || data.post || data.graphql?.shortcode_media || data;
      
      if (item) {
        const result = {
          success: true,
          shortcode: code,
          url: url || `https://www.instagram.com/reel/${code}/`,
          thumbnail_url: item.thumbnail_url || item.display_url || item.image_versions2?.candidates?.[0]?.url || item.thumbnail_src || '',
          caption: item.caption?.text || item.caption || item.edge_media_to_caption?.edges?.[0]?.node?.text || '',
          view_count: item.play_count || item.view_count || item.video_view_count || item.video_play_count || 0,
          like_count: item.like_count || item.likes?.count || item.edge_media_preview_like?.count || 0,
          comment_count: item.comment_count || item.comments?.count || item.edge_media_to_comment?.count || 0,
          taken_at: item.taken_at || item.taken_at_timestamp,
          owner: {
            username: item.owner?.username || item.user?.username || '',
            full_name: item.owner?.full_name || item.user?.full_name || '',
          },
          is_video: item.is_video !== false,
          api_used: api.name,
        };
        
        console.log('Extracted reel info:', result);
        return res.status(200).json(result);
      }
    } catch (e) {
      console.warn(`Error with ${api.name}:`, e.message);
      continue;
    }
  }

  // Если ничего не сработало - возвращаем минимум
  return res.status(200).json({
    success: false,
    shortcode: code,
    url: url || `https://www.instagram.com/reel/${code}/`,
    error: 'Could not fetch reel info from any API',
  });
}
