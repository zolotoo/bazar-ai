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

  // ОСНОВНОЙ КЛЮЧ - оплаченный instagram-scraper-20251
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '959a088626msh74020d3fb11ad19p1e067bjsnb273d9fac830';
  
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

  // Используем оплаченный API instagram-scraper-20251
  try {
    // Endpoint: postdetail/?code_or_url=CODE (только shortcode!)
    const apiUrl = `https://instagram-scraper-20251.p.rapidapi.com/postdetail/?code_or_url=${code}`;
    console.log('Calling instagram-scraper-20251:', apiUrl);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'instagram-scraper-20251.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    });

    console.log('API status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('API raw response keys:', data?.data ? Object.keys(data.data).slice(0, 20) : 'no data');
      
      const media = data?.data;
      
      if (media) {
        // Статистика в metrics
        const metrics = media.metrics || {};
        
        // Извлекаем view_count из metrics.play_count или metrics.ig_play_count
        const viewCount = metrics.play_count || metrics.ig_play_count || metrics.view_count || 
                         media.play_count || media.video_view_count || 0;
        
        const likeCount = metrics.like_count || media.like_count || 0;
        const commentCount = metrics.comment_count || media.comment_count || 0;
        
        const result = {
          success: true,
          shortcode: code,
          url: url || `https://www.instagram.com/reel/${code}/`,
          thumbnail_url: media.thumbnail_url || media.image_versions?.items?.[0]?.url || '',
          video_url: media.video_url || media.video_versions?.[0]?.url || '',
          caption: media.caption?.text || (typeof media.caption === 'string' ? media.caption : '') || '',
          view_count: viewCount,
          like_count: likeCount,
          comment_count: commentCount,
          taken_at: media.taken_at || media.taken_at_ts,
          owner: {
            username: media.user?.username || '',
            full_name: media.user?.full_name || '',
          },
          is_video: media.is_video || media.media_type === 2 || !!media.video_url,
          api_used: 'instagram-scraper-20251',
        };
        
        console.log('Extracted reel info:', {
          shortcode: result.shortcode,
          view_count: result.view_count,
          like_count: result.like_count,
          comment_count: result.comment_count,
          owner: result.owner.username,
        });
        
        // Если получили данные - возвращаем
        if (result.view_count || result.like_count || result.thumbnail_url || result.owner.username) {
          return res.status(200).json(result);
        }
      }
    } else {
      const errorText = await response.text();
      console.log('API error:', response.status, errorText);
    }
  } catch (e) {
    console.error('API error:', e.message);
  }

  // Если ничего не сработало - возвращаем минимум
  return res.status(200).json({
    success: false,
    shortcode: code,
    url: url || `https://www.instagram.com/reel/${code}/`,
    error: 'Could not fetch reel info',
  });
}
