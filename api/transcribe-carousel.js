// Vercel Serverless — «транскрибация» карусели через Gemini Flash (картинки → текст по слайдам)
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const body = req.body || {};
  const imageUrls = Array.isArray(body.imageUrls) ? body.imageUrls : [];
  const imagesBase64 = Array.isArray(body.images) ? body.images : [];

  const MAX_IMAGES = 10;
  let parts = [];

  // Вариант 1: массив URL — качаем картинки и переводим в base64
  if (imageUrls.length > 0) {
    if (imageUrls.length > MAX_IMAGES) {
      return res.status(400).json({ error: `Maximum ${MAX_IMAGES} images per request` });
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
        parts.push({ inlineData: { mimeType, data: base64 } });
      } catch (e) {
        console.error('Failed to fetch image:', url, e.message);
        return res.status(400).json({ error: `Failed to fetch image: ${e.message}` });
      }
    }
  }
  // Вариант 2: массив { mimeType, data } (base64)
  else if (imagesBase64.length > 0) {
    if (imagesBase64.length > MAX_IMAGES) {
      return res.status(400).json({ error: `Maximum ${MAX_IMAGES} images per request` });
    }
    for (const img of imagesBase64) {
      if (!img.data) {
        return res.status(400).json({ error: 'Each image must have "data" (base64)' });
      }
      parts.push({
        inlineData: {
          mimeType: img.mimeType || 'image/jpeg',
          data: img.data.replace(/^data:image\/\w+;base64,/, ''),
        },
      });
    }
  } else {
    return res.status(400).json({
      error: 'Provide imageUrls[] (array of image URLs) or images[] (array of { mimeType, data })',
    });
  }

  const prompt = `You are given ${parts.length} image(s) — slides of an Instagram carousel post.

For each image, in order (slide 1, slide 2, ...):
1) Extract ALL visible text exactly as it appears (captions, overlays, quotes, hashtags).
2) Write a very brief description of the visual content in 1–2 sentences (what is shown: people, scene, product, etc.).

Reply with a single JSON object only, no markdown, no extra text. Use this exact structure (slide_index is 0-based):
{
  "slides": [
    { "slide_index": 0, "text": "extracted text from slide 1", "description": "brief visual description" },
    { "slide_index": 1, "text": "...", "description": "..." }
  ],
  "full_text": "All extracted text from all slides combined, in order, separated by newlines or spaces as appropriate."
}`;

  const contentsParts = [{ text: prompt }, ...parts];

  try {
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
      return res.status(502).json({
        error: 'Gemini API error',
        details: errBody.slice(0, 500),
      });
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
      console.error('Gemini JSON parse error:', rawText.slice(0, 300));
      return res.status(502).json({
        error: 'Invalid JSON from Gemini',
        raw: rawText.slice(0, 500),
      });
    }

    const slides = Array.isArray(parsed.slides) ? parsed.slides : [];
    const fullText = typeof parsed.full_text === 'string' ? parsed.full_text : slides.map((s) => s.text).join('\n\n');

    return res.status(200).json({
      success: true,
      transcript_text: fullText,
      transcript_slides: slides,
    });
  } catch (e) {
    console.error('Transcribe carousel error:', e);
    return res.status(500).json({
      error: 'Transcribe carousel failed',
      details: e.message,
    });
  }
}
