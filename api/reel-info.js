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

  // Используем ТОЛЬКО оплаченный API instagram-scraper-20251
  try {
    // Endpoint: postdetail/?code_or_url=CODE
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
      console.log('API raw response:', JSON.stringify(data).slice(0, 2000));
      
      // Пробуем разные структуры ответа
      const media = data?.data || data?.graphql?.shortcode_media || data?.media || data;
      
      if (media) {
        console.log('Media keys:', Object.keys(media));
        
        // Извлекаем view_count из разных возможных полей
        const viewCount = media.play_count || media.video_play_count || media.video_view_count || 
                         media.view_count || media.clip_music_attribution_info?.view_count || 0;
        
        const result = {
          success: true,
          shortcode: code,
          url: url || `https://www.instagram.com/reel/${code}/`,
          thumbnail_url: media.image_versions2?.candidates?.[0]?.url || media.thumbnail_url || 
                        media.display_url || media.thumbnail_src || '',
          caption: media.caption?.text || media.edge_media_to_caption?.edges?.[0]?.node?.text || 
                  (typeof media.caption === 'string' ? media.caption : '') || '',
          view_count: viewCount,
          like_count: media.like_count || media.edge_media_preview_like?.count || 0,
          comment_count: media.comment_count || media.edge_media_to_comment?.count || 0,
          taken_at: media.taken_at || media.taken_at_timestamp,
          owner: {
            username: media.user?.username || media.owner?.username || '',
            full_name: media.user?.full_name || media.owner?.full_name || '',
          },
          is_video: media.media_type === 2 || media.is_video || media.__typename === 'GraphVideo',
          api_used: 'instagram-scraper-20251',
        };
        
        console.log('Extracted reel info:', result);
        
        // Если получили хоть какие-то данные - возвращаем
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
