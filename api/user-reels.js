// Vercel Serverless Function - получение видео пользователя по username
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

  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'username is required' });
  }

  // ОСНОВНОЙ КЛЮЧ - оплаченный instagram-scraper-20251
  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '959a088626msh74020d3fb11ad19p1e067bjsnb273d9fac830';
  
  // Очищаем username от @ если есть
  const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
  
  console.log('Fetching reels for user:', cleanUsername);

  // Используем ТОЛЬКО оплаченный API instagram-scraper-20251
  try {
    const apiUrl = `https://instagram-scraper-20251.p.rapidapi.com/userreels/?username_or_id=${cleanUsername}&url_embed_safe=true`;
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
      console.log('API raw response keys:', Object.keys(data));
      console.log('API full response:', JSON.stringify(data).slice(0, 2000));
      
      // Парсим ответ - пробуем разные структуры
      let items = data?.data?.items || data?.items || data?.data || data?.reels;
      
      if (!items || !Array.isArray(items)) {
        // Может быть объект с edge_owner_to_timeline_media
        if (data?.data?.user?.edge_owner_to_timeline_media?.edges) {
          items = data.data.user.edge_owner_to_timeline_media.edges.map(e => e.node);
        }
      }
      
      if (items && Array.isArray(items)) {
        const reels = items.map(item => ({
          id: item.id || item.pk,
          shortcode: item.code || item.shortcode,
          url: `https://www.instagram.com/reel/${item.code || item.shortcode}/`,
          thumbnail_url: item.image_versions2?.candidates?.[0]?.url || item.thumbnail_url || item.display_url || item.thumbnail_src,
          caption: item.caption?.text || item.edge_media_to_caption?.edges?.[0]?.node?.text || '',
          view_count: item.play_count || item.view_count || item.video_view_count || 0,
          like_count: item.like_count || item.edge_liked_by?.count || 0,
          comment_count: item.comment_count || item.edge_media_to_comment?.count || 0,
          taken_at: item.taken_at || item.taken_at_timestamp,
          owner: { username: cleanUsername },
        })).filter(r => r.shortcode);
        
        if (reels.length > 0) {
          console.log(`Found ${reels.length} reels`);
          return res.status(200).json({
            success: true,
            username: cleanUsername,
            reels,
            api_used: 'instagram-scraper-20251',
          });
        }
      }
      
      console.log('No reels parsed from response');
    } else {
      const errorText = await response.text();
      console.log('API error:', response.status, errorText);
    }
  } catch (e) {
    console.error('API error:', e.message);
  }

  // Если не удалось - возвращаем пустой результат
  return res.status(200).json({
    success: false,
    username: cleanUsername,
    reels: [],
    message: 'Could not fetch user reels',
  });
}
