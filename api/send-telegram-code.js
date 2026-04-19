import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!supabaseUrl || !supabaseServiceKey || !botToken) {
    return res.status(500).json({ error: 'Not configured' });
  }

  const { username, code } = req.body;
  if (!username || !code) {
    return res.status(400).json({ error: 'username and code are required' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const cleanUsername = username.replace('@', '').trim().toLowerCase();

  // 1. Ищем chat_id в постоянном хранилище
  let chatId = null;
  const { data: chatRow } = await supabase
    .from('telegram_chats')
    .select('chat_id')
    .eq('username', cleanUsername)
    .maybeSingle();

  if (chatRow?.chat_id) {
    chatId = chatRow.chat_id;
  }

  // 2. Fallback: getUpdates (запрос идёт с сервера Vercel, не блокируется в России)
  if (!chatId) {
    try {
      const updatesRes = await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates`
      );
      const updatesData = await updatesRes.json();
      if (updatesData.ok && updatesData.result) {
        for (const update of updatesData.result) {
          const from = update.message?.from;
          if (from?.username?.toLowerCase() === cleanUsername) {
            chatId = from.id;
            await supabase.from('telegram_chats').upsert(
              {
                username: cleanUsername,
                chat_id: chatId,
                first_name: from.first_name || null,
                last_name: from.last_name || null,
                updated_at: new Date().toISOString(),
              },
              { onConflict: 'username' }
            );
            break;
          }
        }
      }
    } catch (e) {
      console.warn('[send-telegram-code] getUpdates failed:', e);
    }
  }

  if (!chatId) {
    return res.status(404).json({
      error: 'chat_not_found',
      message: 'Напиши @ririai_bot — /start и нажми «Получить код» заново',
    });
  }

  // 3. Отправляем код (запрос идёт с сервера Vercel, не блокируется в России)
  const message = `🔐 Привет! Вот твой код для входа:\n\n<b>${code}</b>\n\nОн действует 10 минут.`;
  const sendRes = await fetch(
    `https://api.telegram.org/bot${botToken}/sendMessage`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
    }
  );
  const sendData = await sendRes.json();

  if (!sendData.ok) {
    return res.status(500).json({ error: 'send_failed', details: sendData });
  }

  return res.status(200).json({ ok: true });
}
