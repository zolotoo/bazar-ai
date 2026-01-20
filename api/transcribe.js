// Vercel Serverless Function - транскрибация видео через AssemblyAI
export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const ASSEMBLYAI_KEY = process.env.ASSEMBLYAI_KEY || '5be12ca7de974d5bbdda7084c37ab4e0';

  // GET - проверка статуса транскрипции
  if (req.method === 'GET') {
    const { transcriptId } = req.query;
    
    if (!transcriptId) {
      return res.status(400).json({ error: 'transcriptId is required' });
    }

    try {
      const response = await fetch(`https://api.assemblyai.com/v2/transcript/${transcriptId}`, {
        headers: {
          'Authorization': ASSEMBLYAI_KEY,
        },
      });

      const data = await response.json();
      
      return res.status(200).json({
        status: data.status,
        text: data.text,
        words: data.words,
        error: data.error,
      });
    } catch (error) {
      console.error('AssemblyAI status error:', error);
      return res.status(500).json({ error: 'Failed to check transcription status' });
    }
  }

  // POST - создание транскрипции
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { audioUrl } = req.body;

  if (!audioUrl) {
    return res.status(400).json({ error: 'audioUrl is required' });
  }

  try {
    console.log('Starting transcription for:', audioUrl);
    
    // Создаем задачу на транскрибацию
    const response = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_detection: true, // Автоопределение языка
      }),
    });

    if (!response.ok) {
      console.error('AssemblyAI error:', response.status);
      const errorData = await response.json();
      return res.status(response.status).json({ 
        error: 'AssemblyAI error', 
        details: errorData 
      });
    }

    const data = await response.json();
    console.log('Transcription started, id:', data.id);
    
    return res.status(200).json({
      success: true,
      transcriptId: data.id,
      status: data.status,
    });
  } catch (error) {
    console.error('Transcription error:', error);
    return res.status(500).json({ 
      error: 'Failed to start transcription', 
      details: error.message 
    });
  }
}
