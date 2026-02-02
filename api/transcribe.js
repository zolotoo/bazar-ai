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

  // POST - создание транскрипции (видео: audioUrl | карусель: imageUrls/images)
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const { audioUrl } = body;
  const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls : [];
  const imagesBase64 = Array.isArray(body.images) ? body.images : [];

  // Карусель: imageUrls или images → Gemini Flash (батчами по 10, если больше)
  if (imageUrls.length > 0 || imagesBase64.length > 0) {
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
    if (!geminiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
    }
    const BATCH_SIZE = 10;
    const MAX_TOTAL = 50;
    let allParts = [];
    if (imageUrls.length > 0) {
      if (imageUrls.length > MAX_TOTAL) {
        return res.status(400).json({ error: `Maximum ${MAX_TOTAL} images per request` });
      }
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      };
      for (const url of imageUrls) {
        if (url.includes('cdninstagram.com') || url.includes('instagram.com')) {
          headers['Referer'] = 'https://www.instagram.com/';
        }
        try {
          const resp = await fetch(url, { headers });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          const buf = await resp.arrayBuffer();
          const base64 = Buffer.from(buf).toString('base64');
          const contentType = resp.headers.get('content-type') || 'image/jpeg';
          const mimeType = contentType.split(';')[0].trim() || 'image/jpeg';
          allParts.push({ inlineData: { mimeType, data: base64 } });
        } catch (e) {
          console.error('Failed to fetch image:', url, e.message);
          return res.status(400).json({ error: `Failed to fetch image: ${e.message}` });
        }
      }
    } else {
      if (imagesBase64.length > MAX_TOTAL) {
        return res.status(400).json({ error: `Maximum ${MAX_TOTAL} images per request` });
      }
      for (const img of imagesBase64) {
        if (!img.data) {
          return res.status(400).json({ error: 'Each image must have "data" (base64)' });
        }
        allParts.push({
          inlineData: {
            mimeType: img.mimeType || 'image/jpeg',
            data: img.data.replace(/^data:image\/\w+;base64,/, ''),
          },
        });
      }
    }
    const promptTemplate = (batchSize, offset) => `You are given ${batchSize} image(s) — slides ${offset + 1} to ${offset + batchSize} of an Instagram carousel post.

For each image, in order (slide 1, slide 2, ...):
1) Extract ALL visible text exactly as it appears (captions, overlays, quotes, hashtags).
2) Write a very brief description of the visual content in 1–2 sentences (what is shown: people, scene, product, etc.).

Reply with a single JSON object only, no markdown, no extra text. Use this exact structure (slide_index is 0-based within THIS batch):
{
  "slides": [
    { "slide_index": 0, "text": "extracted text from slide 1", "description": "brief visual description" },
    { "slide_index": 1, "text": "...", "description": "..." }
  ],
  "full_text": "All extracted text from these slides combined, in order, separated by newlines or spaces as appropriate."
}`;
    const allSlides = [];
    const fullTexts = [];
    try {
      for (let i = 0; i < allParts.length; i += BATCH_SIZE) {
        const batch = allParts.slice(i, i + BATCH_SIZE);
        const prompt = promptTemplate(batch.length, i);
        const contentsParts = [{ text: prompt }, ...batch];
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: contentsParts }],
              generationConfig: {
                temperature: 0.2,
                responseMimeType: 'application/json',
                maxOutputTokens: 8192,
              },
            }),
          }
        );
        if (!geminiRes.ok) {
          const errBody = await geminiRes.text();
          console.error('Gemini API error:', geminiRes.status, errBody);
          return res.status(502).json({ error: 'Gemini API error', details: errBody.slice(0, 500) });
        }
        const data = await geminiRes.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
        if (!rawText) {
          return res.status(502).json({ error: 'Gemini returned empty response' });
        }
        let jsonStr = (rawText.match(/\{[\s\S]*\}/) || [null])[0] || rawText;
        jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
        let parsed;
        try {
          parsed = JSON.parse(jsonStr);
        } catch (e) {
          return res.status(502).json({ error: 'Invalid JSON from Gemini', raw: rawText.slice(0, 500) });
        }
        const slides = Array.isArray(parsed.slides) ? parsed.slides : [];
        for (const s of slides) {
          allSlides.push({
            slide_index: i + s.slide_index,
            text: s.text || '',
            description: s.description || '',
          });
        }
        if (typeof parsed.full_text === 'string' && parsed.full_text.trim()) {
          fullTexts.push(parsed.full_text);
        } else {
          fullTexts.push(slides.map((s) => s.text).join('\n\n'));
        }
      }
      const fullText = fullTexts.join('\n\n');
      return res.status(200).json({
        success: true,
        transcript_text: fullText,
        transcript_slides: allSlides,
      });
    } catch (e) {
      console.error('Transcribe carousel error:', e);
      return res.status(500).json({ error: 'Transcribe carousel failed', details: e.message });
    }
  }

  // Видео: audioUrl → AssemblyAI
  if (!audioUrl) {
    return res.status(400).json({ error: 'audioUrl is required (video) or imageUrls/images (carousel)' });
  }

  try {
    console.log('Starting transcription for:', audioUrl);
    const response = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: {
        'Authorization': ASSEMBLYAI_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        audio_url: audioUrl,
        language_detection: true,
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
