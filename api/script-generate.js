// Vercel Serverless — генерация сценария по промту стиля + исходник (и опционально перевод) через Gemini
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { prompt, transcript_text, translation_text } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'prompt is required' });
  }
  if (!transcript_text || typeof transcript_text !== 'string') {
    return res.status(400).json({ error: 'transcript_text is required' });
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
  if (!geminiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });
  }

  const userParts = [];
  userParts.push('Исходный сценарий (оригинал):\n' + transcript_text.trim());
  if (translation_text && typeof translation_text === 'string' && translation_text.trim()) {
    userParts.push('\nПеревод на русский:\n' + translation_text.trim());
  }
  userParts.push('\n\nСгенерируй мой сценарий (адаптацию) по этим данным. Выводи только текст сценария, без пояснений.');

  const userText = userParts.join('');

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: userText }],
            },
          ],
          systemInstruction: {
            parts: [{ text: prompt.trim() }],
          },
          generationConfig: { temperature: 0.4 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errBody);
      return res.status(502).json({ error: 'Gemini API error', details: errBody });
    }

    const data = await geminiRes.json();
    const script =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

    if (!script) {
      return res.status(502).json({ error: 'Gemini returned empty script' });
    }

    return res.status(200).json({
      success: true,
      script,
    });
  } catch (err) {
    console.error('script-generate error:', err);
    return res.status(500).json({
      error: 'Failed to generate script',
      details: err.message,
    });
  }
}
