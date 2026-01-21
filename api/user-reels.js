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
  const RAPIDAPI_KEY_2 = process.env.RAPIDAPI_KEY_2 || 'b0c8ed7c19msha2cdb96d5b4b6e8p1498c0jsncd589edf5d8b';
  const HIKERAPI_KEY = process.env.HIKERAPI_KEY || '2gcewt5ly7xqjncxbamzb9i9kg1y81ka';
  
  // Очищаем username от @ если есть
  const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
  
  console.log('Fetching reels for user:', cleanUsername);

  // ПРИОРИТЕТ 0: HikerAPI - надёжный платный сервис
  try {
    console.log('Trying HikerAPI...');
    
    // Шаг 1: Получаем user_id по username
    const userInfoUrl = `https://api.hikerapi.com/v1/user/by/username?username=${cleanUsername}`;
    console.log('HikerAPI - getting user info:', userInfoUrl);
    
    const userResponse = await fetch(userInfoUrl, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-access-key': HIKERAPI_KEY,
      },
    });
    
    console.log('HikerAPI user info status:', userResponse.status);
    
    if (userResponse.ok) {
      const userData = await userResponse.json();
      console.log('HikerAPI user data:', JSON.stringify(userData).slice(0, 500));
      
      const userId = userData?.pk || userData?.id || userData?.user?.pk;
      
      if (userId) {
        // Шаг 2: Получаем clips (reels) пользователя
        const clipsUrl = `https://api.hikerapi.com/v1/user/clips/chunk?user_id=${userId}`;
        console.log('HikerAPI - getting clips:', clipsUrl);
        
        const clipsResponse = await fetch(clipsUrl, {
          method: 'GET',
          headers: {
            'accept': 'application/json',
            'x-access-key': HIKERAPI_KEY,
          },
        });
        
        console.log('HikerAPI clips status:', clipsResponse.status);
        
        if (clipsResponse.ok) {
          const clipsData = await clipsResponse.json();
          console.log('HikerAPI clips data:', JSON.stringify(clipsData).slice(0, 1000));
          
          // Парсим ответ - может быть items или edges
          let items = clipsData?.items || clipsData?.data?.items || clipsData?.clips || [];
          
          if (items.length > 0) {
            const reels = items.map(item => ({
              id: item.pk || item.id,
              shortcode: item.code,
              url: `https://www.instagram.com/reel/${item.code}/`,
              thumbnail_url: item.image_versions2?.candidates?.[0]?.url || item.thumbnail_url || item.display_url,
              caption: item.caption?.text || '',
              view_count: item.play_count || item.view_count || 0,
              like_count: item.like_count || 0,
              comment_count: item.comment_count || 0,
              taken_at: item.taken_at,
              owner: { username: cleanUsername },
            })).filter(r => r.shortcode);
            
            if (reels.length > 0) {
              console.log(`HikerAPI found ${reels.length} reels`);
              return res.status(200).json({
                success: true,
                username: cleanUsername,
                reels,
                api_used: 'hikerapi',
              });
            }
          }
        }
      }
    }
  } catch (e) {
    console.warn('HikerAPI error:', e.message);
  }

  // Fallback на RapidAPI если HikerAPI не сработал
  const apis = [
    // ПРИОРИТЕТ 1: instagram-scraper-20251 с новым ключом
    {
      name: 'instagram-scraper-20251-userreels',
      url: `https://instagram-scraper-20251.p.rapidapi.com/userreels/?username_or_id=${cleanUsername}&url_embed_safe=true`,
      host: 'instagram-scraper-20251.p.rapidapi.com',
      apiKey: RAPIDAPI_KEY_2, // Используем второй ключ
      method: 'GET',
      parseResponse: (data) => {
        console.log('instagram-scraper-20251-userreels full response:', JSON.stringify(data).slice(0, 1500));
        // Пробуем разные структуры
        let items = data?.data?.items || data?.items || data?.data || data?.reels;
        if (!items || !Array.isArray(items)) {
          // Может быть объект с edge_owner_to_timeline_media
          if (data?.data?.user?.edge_owner_to_timeline_media?.edges) {
            items = data.data.user.edge_owner_to_timeline_media.edges.map(e => e.node);
          }
        }
        if (!items || !Array.isArray(items)) return null;
        
        return items.map(item => ({
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
      },
    },
    // Fallback APIs с первым ключом
    {
      name: 'instagram-scraper2-reels',
      url: `https://instagram-scraper2.p.rapidapi.com/user_reels?username_or_id=${cleanUsername}&count=12`,
      host: 'instagram-scraper2.p.rapidapi.com',
      apiKey: RAPIDAPI_KEY,
      method: 'GET',
      parseResponse: (data) => {
        console.log('instagram-scraper2-reels full response:', JSON.stringify(data).slice(0, 1000));
        let items = data?.data?.items || data?.items || data?.data?.user?.edge_owner_to_timeline_media?.edges;
        if (!items || !Array.isArray(items)) return null;
        
        return items.map(item => {
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
      apiKey: RAPIDAPI_KEY,
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
  ];

  for (const api of apis) {
    try {
      console.log(`Trying ${api.name}...`);
      
      const response = await fetch(api.url, {
        method: api.method,
        headers: {
          'x-rapidapi-host': api.host,
          'x-rapidapi-key': api.apiKey || RAPIDAPI_KEY,
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
        } else {
          console.log(`${api.name} returned OK but no reels parsed`);
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
