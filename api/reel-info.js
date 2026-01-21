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

  // Используем instagram-scraper2 API - он возвращает view_count!
  try {
    const scraperUrl = `https://instagram-scraper2.p.rapidapi.com/media_info?short_code=${code}`;
    console.log('Trying instagram-scraper2:', scraperUrl);
    
    const response = await fetch(scraperUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'instagram-scraper2.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY,
      },
    });

    console.log('instagram-scraper2 status:', response.status);
    
    if (response.ok) {
      const data = await response.json();
      console.log('instagram-scraper2 raw response:', JSON.stringify(data).slice(0, 1000));
      
      // Пробуем разные структуры ответа
      const media = data?.data?.shortcode_media || data?.data || data?.graphql?.shortcode_media || data;
      
      if (media) {
        console.log('instagram-scraper2 media keys:', Object.keys(media));
        
        // Извлекаем view_count из разных возможных полей
        const viewCount = media.video_view_count || media.play_count || media.view_count || 
                         media.video_play_count || media.clip_music_attribution_info?.view_count || 0;
        
        const result = {
          success: true,
          shortcode: code,
          url: url || `https://www.instagram.com/reel/${code}/`,
          thumbnail_url: media.thumbnail_src || media.display_url || media.image_versions2?.candidates?.[0]?.url || '',
          caption: media.edge_media_to_caption?.edges?.[0]?.node?.text || media.caption?.text || '',
          view_count: viewCount,
          like_count: media.edge_media_preview_like?.count || media.like_count || 0,
          comment_count: media.edge_media_to_comment?.count || media.comment_count || 0,
          taken_at: media.taken_at_timestamp || media.taken_at,
          owner: {
            username: media.owner?.username || media.user?.username || '',
            full_name: media.owner?.full_name || media.user?.full_name || '',
          },
          is_video: media.__typename === 'GraphVideo' || media.is_video || media.media_type === 2,
          api_used: 'instagram-scraper2',
        };
        
        console.log('Extracted from instagram-scraper2:', result);
        
        // Если получили хоть какие-то данные - возвращаем
        if (result.view_count || result.like_count || result.thumbnail_url || result.owner.username) {
          return res.status(200).json(result);
        }
      }
    }
  } catch (e) {
    console.warn('instagram-scraper2 error:', e.message);
  }

  // Fallback APIs
  const apis = [
    {
      name: 'instagram-scraper-api2',
      host: 'instagram-scraper-api2.p.rapidapi.com',
      url: `https://instagram-scraper-api2.p.rapidapi.com/v1/post_info?code_or_id_or_url=${code}`,
      method: 'GET',
    },
    {
      name: 'instagram-scraper-20251',
      host: 'instagram-scraper-20251.p.rapidapi.com',
      url: `https://instagram-scraper-20251.p.rapidapi.com/v1/media/${code}`,
      method: 'GET',
    },
    {
      name: 'instagram120',
      host: 'instagram120.p.rapidapi.com',
      url: `https://instagram120.p.rapidapi.com/api/instagram/media/info?code=${code}`,
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
      console.log(`${api.name} response:`, JSON.stringify(data).slice(0, 500));

      // Для instagram-scraper-api2 - структура data.data
      if (api.name === 'instagram-scraper-api2' && data?.data) {
        const item = data.data;
        console.log('instagram-scraper-api2 item keys:', Object.keys(item));
        
        const result = {
          success: true,
          shortcode: code,
          url: url || `https://www.instagram.com/reel/${code}/`,
          thumbnail_url: item.thumbnail_url || item.display_url || item.image_versions2?.candidates?.[0]?.url || '',
          caption: item.caption?.text || '',
          view_count: item.play_count || item.view_count || item.video_view_count || 0,
          like_count: item.like_count || 0,
          comment_count: item.comment_count || 0,
          taken_at: item.taken_at,
          owner: {
            username: item.user?.username || item.owner?.username || '',
            full_name: item.user?.full_name || item.owner?.full_name || '',
          },
          is_video: item.media_type === 2 || item.is_video,
          api_used: api.name,
        };
        
        if (result.view_count || result.like_count || result.thumbnail_url) {
          console.log('Extracted from instagram-scraper-api2:', result);
          return res.status(200).json(result);
        }
      }

      // Для instagram-scraper-stable API
      if (api.name === 'instagram-scraper-stable' && data) {
        // Этот API возвращает данные напрямую
        const result = {
          success: true,
          shortcode: code,
          url: url || `https://www.instagram.com/reel/${code}/`,
          thumbnail_url: data.thumbnail_url || data.display_url || data.image_versions2?.candidates?.[0]?.url || '',
          caption: data.caption?.text || (typeof data.caption === 'string' ? data.caption : '') || '',
          view_count: data.play_count || data.view_count || data.video_view_count || 0,
          like_count: data.like_count || data.likes_count || 0,
          comment_count: data.comment_count || data.comments_count || 0,
          taken_at: data.taken_at || data.taken_at_timestamp,
          owner: {
            username: data.user?.username || data.owner?.username || '',
            full_name: data.user?.full_name || data.owner?.full_name || '',
          },
          is_video: data.is_video !== false || data.media_type === 2,
          api_used: api.name,
        };
        
        // Проверяем что получили хоть какие-то данные
        if (result.view_count || result.like_count || result.thumbnail_url) {
          console.log('Extracted reel info:', result);
          return res.status(200).json(result);
        }
      }

      // Для других API - общий парсинг
      const item = data.data || data.media || data.post || data.graphql?.shortcode_media || data;
      
      if (item && (item.play_count || item.view_count || item.like_count || item.thumbnail_url)) {
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
