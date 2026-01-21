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

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '60b367f230mshd3ca48b7e1fa21cp18f206jsn57b97472bcca';
  
  // Очищаем username от @ если есть
  const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
  
  console.log('Fetching reels for user:', cleanUsername);

  // Попробуем несколько API - с улучшенным парсингом
  const apis = [
    {
      name: 'instagram-scraper2-reels',
      url: `https://instagram-scraper2.p.rapidapi.com/user_reels?username_or_id=${cleanUsername}&count=12`,
      host: 'instagram-scraper2.p.rapidapi.com',
      method: 'GET',
      parseResponse: (data) => {
        console.log('instagram-scraper2-reels full response:', JSON.stringify(data).slice(0, 1000));
        // Пробуем разные пути к данным
        let items = data?.data?.items || data?.items || data?.data?.user?.edge_owner_to_timeline_media?.edges;
        if (!items || !Array.isArray(items)) return null;
        
        return items.map(item => {
          // Если edges формат (GraphQL)
          const node = item.node || item;
          return {
            id: node.id || node.pk,
            shortcode: node.code || node.shortcode,
            url: `https://www.instagram.com/reel/${node.code || node.shortcode}/`,
            thumbnail_url: node.image_versions2?.candidates?.[0]?.url || node.thumbnail_url || node.display_url || node.thumbnail_src,
            caption: node.caption?.text || node.edge_media_to_caption?.edges?.[0]?.node?.text || '',
            view_count: node.play_count || node.view_count || node.video_view_count || 0,
            like_count: node.like_count || node.edge_liked_by?.count || 0,
            comment_count: node.comment_count || node.edge_media_to_comment?.count || 0,
            taken_at: node.taken_at || node.taken_at_timestamp,
            owner: { username: cleanUsername },
          };
        }).filter(r => r.shortcode);
      },
    },
    {
      name: 'instagram-scraper-api2-reels',
      url: `https://instagram-scraper-api2.p.rapidapi.com/v1/reels?username_or_id_or_url=${cleanUsername}`,
      host: 'instagram-scraper-api2.p.rapidapi.com',
      method: 'GET',
      parseResponse: (data) => {
        console.log('instagram-scraper-api2-reels full response:', JSON.stringify(data).slice(0, 1000));
        let items = data?.data?.items || data?.data || data?.items;
        if (!items || !Array.isArray(items)) return null;
        
        return items.map(item => ({
          id: item.id || item.pk,
          shortcode: item.code || item.shortcode,
          url: `https://www.instagram.com/reel/${item.code || item.shortcode}/`,
          thumbnail_url: item.thumbnail_url || item.display_url || item.image_versions2?.candidates?.[0]?.url,
          caption: item.caption?.text || '',
          view_count: item.play_count || item.view_count || item.video_view_count || 0,
          like_count: item.like_count || 0,
          comment_count: item.comment_count || 0,
          taken_at: item.taken_at,
          owner: { username: cleanUsername },
        })).filter(r => r.shortcode);
      },
    },
    {
      // Альтернативный endpoint - получаем посты пользователя (включая reels)
      name: 'instagram-scraper2-posts',
      url: `https://instagram-scraper2.p.rapidapi.com/user_posts?username_or_id=${cleanUsername}&count=20`,
      host: 'instagram-scraper2.p.rapidapi.com',
      method: 'GET',
      parseResponse: (data) => {
        console.log('instagram-scraper2-posts full response:', JSON.stringify(data).slice(0, 1000));
        let items = data?.data?.items || data?.items || data?.data;
        if (!items || !Array.isArray(items)) return null;
        
        // Фильтруем только видео (reels)
        return items
          .filter(item => item.media_type === 2 || item.is_video || item.video_versions)
          .map(item => ({
            id: item.id || item.pk,
            shortcode: item.code || item.shortcode,
            url: `https://www.instagram.com/reel/${item.code || item.shortcode}/`,
            thumbnail_url: item.image_versions2?.candidates?.[0]?.url || item.thumbnail_url || item.display_url,
            caption: item.caption?.text || '',
            view_count: item.play_count || item.view_count || item.video_view_count || 0,
            like_count: item.like_count || 0,
            comment_count: item.comment_count || 0,
            taken_at: item.taken_at,
            owner: { username: cleanUsername },
          })).filter(r => r.shortcode);
      },
    },
    {
      name: 'instagram120-user-feed',
      url: `https://instagram120.p.rapidapi.com/api/instagram/user-feed?username=${cleanUsername}`,
      host: 'instagram120.p.rapidapi.com',
      method: 'GET',
      parseResponse: (data) => {
        console.log('instagram120-user-feed full response:', JSON.stringify(data).slice(0, 1000));
        let items = data?.items || data?.data?.items || data?.feed?.items;
        if (!items || !Array.isArray(items)) return null;
        
        return items
          .filter(item => item.media_type === 2 || item.is_video || item.video_versions)
          .map(item => ({
            id: item.id || item.pk,
            shortcode: item.code || item.shortcode,
            url: `https://www.instagram.com/reel/${item.code || item.shortcode}/`,
            thumbnail_url: item.image_versions2?.candidates?.[0]?.url || item.thumbnail_url || item.display_url,
            caption: item.caption?.text || '',
            view_count: item.play_count || item.view_count || item.video_view_count || 0,
            like_count: item.like_count || 0,
            comment_count: item.comment_count || 0,
            taken_at: item.taken_at,
            owner: { username: cleanUsername },
          })).filter(r => r.shortcode);
      },
    },
  ];

  for (const api of apis) {
    try {
      console.log(`Trying ${api.name}...`);
      
      const response = await fetch(api.url, {
        method: api.method,
        headers: {
          'x-rapidapi-host': api.host,
          'x-rapidapi-key': RAPIDAPI_KEY,
        },
      });

      console.log(`${api.name} status:`, response.status);

      if (response.ok) {
        const data = await response.json();
        console.log(`${api.name} raw response keys:`, Object.keys(data));
        
        const reels = api.parseResponse(data);
        
        if (reels && reels.length > 0) {
          console.log(`${api.name} found ${reels.length} reels`);
          return res.status(200).json({
            success: true,
            username: cleanUsername,
            reels,
            api_used: api.name,
          });
        }
      }
    } catch (e) {
      console.warn(`${api.name} error:`, e.message);
    }
  }

  // Если API не работают, возвращаем пустой результат с сообщением
  return res.status(200).json({
    success: false,
    username: cleanUsername,
    reels: [],
    message: 'Could not fetch user reels. API quota may be exceeded.',
  });
}
