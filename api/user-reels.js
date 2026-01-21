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

  // Попробуем несколько API
  const apis = [
    {
      name: 'instagram-scraper2',
      url: `https://instagram-scraper2.p.rapidapi.com/user_reels?username_or_id=${cleanUsername}&count=12`,
      host: 'instagram-scraper2.p.rapidapi.com',
      method: 'GET',
      parseResponse: (data) => {
        console.log('instagram-scraper2 response structure:', JSON.stringify(data).slice(0, 500));
        if (!data?.data?.items) return null;
        return data.data.items.map(item => ({
          id: item.id || item.pk,
          shortcode: item.code,
          url: `https://www.instagram.com/reel/${item.code}/`,
          thumbnail_url: item.image_versions2?.candidates?.[0]?.url || item.thumbnail_url,
          caption: item.caption?.text || '',
          view_count: item.play_count || item.view_count,
          like_count: item.like_count,
          comment_count: item.comment_count,
          taken_at: item.taken_at,
          owner: {
            username: cleanUsername,
          },
        }));
      },
    },
    {
      name: 'instagram-scraper-api2',
      url: `https://instagram-scraper-api2.p.rapidapi.com/v1/reels?username_or_id_or_url=${cleanUsername}`,
      host: 'instagram-scraper-api2.p.rapidapi.com',
      method: 'GET',
      parseResponse: (data) => {
        console.log('instagram-scraper-api2 response structure:', JSON.stringify(data).slice(0, 500));
        if (!data?.data?.items) return null;
        return data.data.items.map(item => ({
          id: item.id,
          shortcode: item.code,
          url: `https://www.instagram.com/reel/${item.code}/`,
          thumbnail_url: item.thumbnail_url || item.display_url,
          caption: item.caption?.text || '',
          view_count: item.play_count || item.view_count,
          like_count: item.like_count,
          comment_count: item.comment_count,
          taken_at: item.taken_at,
          owner: {
            username: cleanUsername,
          },
        }));
      },
    },
    {
      name: 'instagram-scraper-20251',
      url: `https://instagram-scraper-20251.p.rapidapi.com/v1/reels?username_or_id_or_url=${cleanUsername}`,
      host: 'instagram-scraper-20251.p.rapidapi.com',
      method: 'GET',
      parseResponse: (data) => {
        console.log('instagram-scraper-20251 response structure:', JSON.stringify(data).slice(0, 500));
        // Пробуем разные структуры
        let items = data?.data?.items || data?.data || data?.items || data?.reels;
        if (!items || !Array.isArray(items)) return null;
        return items.filter(item => item.code || item.shortcode).map(item => ({
          id: item.id || item.pk,
          shortcode: item.code || item.shortcode,
          url: `https://www.instagram.com/reel/${item.code || item.shortcode}/`,
          thumbnail_url: item.image_versions2?.candidates?.[0]?.url || item.thumbnail_url || item.display_url,
          caption: item.caption?.text || item.caption || '',
          view_count: item.play_count || item.view_count || item.video_view_count,
          like_count: item.like_count,
          comment_count: item.comment_count,
          taken_at: item.taken_at,
          owner: {
            username: cleanUsername,
          },
        }));
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
