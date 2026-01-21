// Vercel Serverless Function - перевод текста через MyMemory API (бесплатно)
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

  const { text, from = 'en', to = 'ru' } = req.body;

  if (!text) {
    return res.status(400).json({ error: 'text is required' });
  }

  console.log(`Translating ${text.length} chars from ${from} to ${to}`);

  try {
    // MyMemory API - бесплатно до 5000 слов/день
    // Разбиваем длинный текст на части (лимит ~500 символов на запрос)
    const chunks = splitText(text, 450);
    const translations = [];
    
    for (const chunk of chunks) {
      const response = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${from}|${to}`
      );
      
      if (!response.ok) {
        console.error('MyMemory error:', response.status);
        continue;
      }
      
      const data = await response.json();
      
      if (data.responseStatus === 200 && data.responseData?.translatedText) {
        translations.push(data.responseData.translatedText);
      } else {
        console.error('MyMemory response error:', data);
        translations.push(chunk); // Оставляем оригинал если не удалось перевести
      }
      
      // Небольшая задержка между запросами чтобы не превысить лимит
      if (chunks.length > 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }
    
    const translatedText = translations.join(' ');
    
    return res.status(200).json({
      success: true,
      original: text,
      translated: translatedText,
      from,
      to,
    });
    
  } catch (error) {
    console.error('Translation error:', error);
    return res.status(500).json({ 
      error: 'Failed to translate', 
      details: error.message 
    });
  }
}

// Разбивает текст на части с сохранением предложений
function splitText(text, maxLength) {
  if (text.length <= maxLength) {
    return [text];
  }
  
  const chunks = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';
  
  for (const sentence of sentences) {
    if (currentChunk.length + sentence.length + 1 <= maxLength) {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      // Если предложение само по себе слишком длинное - разбиваем по словам
      if (sentence.length > maxLength) {
        const words = sentence.split(' ');
        currentChunk = '';
        for (const word of words) {
          if (currentChunk.length + word.length + 1 <= maxLength) {
            currentChunk += (currentChunk ? ' ' : '') + word;
          } else {
            if (currentChunk) chunks.push(currentChunk);
            currentChunk = word;
          }
        }
      } else {
        currentChunk = sentence;
      }
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}
