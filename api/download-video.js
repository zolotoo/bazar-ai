// Vercel Serverless Function - скачивание видео через Instagram API
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

  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '60b367f230mshd3ca48b7e1fa21cp18f206jsn57b97472bcca';
  const RAPIDAPI_HOST = 'instagram120.p.rapidapi.com';

  try {
    console.log('Fetching download link for:', url);
    
    const response = await fetch(`https://${RAPIDAPI_HOST}/api/instagram/links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
      body: JSON.stringify({ url }),
    });

    if (!response.ok) {
      console.error('Instagram API error:', response.status);
      return res.status(response.status).json({ 
        error: 'Instagram API error', 
        status: response.status 
      });
    }

    const data = await response.json();
    console.log('Download API response keys:', Object.keys(data));
    
    // Извлекаем URL видео из ответа
    let videoUrl = null;
    
    if (data.video_url) {
      videoUrl = data.video_url;
    } else if (data.download_url) {
      videoUrl = data.download_url;
    } else if (data.url) {
      videoUrl = data.url;
    } else if (data.data?.video_url) {
      videoUrl = data.data.video_url;
    } else if (data.media?.[0]?.video_url) {
      videoUrl = data.media[0].video_url;
    } else if (Array.isArray(data) && data[0]?.video_url) {
      videoUrl = data[0].video_url;
    }
    
    return res.status(200).json({
      success: true,
      videoUrl,
      rawResponse: data,
    });
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ 
      error: 'Failed to get download link', 
      details: error.message 
    });
  }
}
