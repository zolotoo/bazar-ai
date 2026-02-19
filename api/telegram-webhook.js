import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const botToken = process.env.TELEGRAM_BOT_TOKEN;

  if (!supabaseUrl || !supabaseServiceKey || !botToken) {
    return res.status(500).json({ error: 'Not configured' });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const update = req.body;

  if (!update || !update.message) {
    return res.status(200).json({ ok: true });
  }

  const { message } = update;
  const from = message.from;

  if (!from) {
    return res.status(200).json({ ok: true });
  }

  const chatId = message.chat?.id || from.id;
  const username = from.username?.toLowerCase();

  if (username) {
    await supabase.from('telegram_chats').upsert({
      username,
      chat_id: chatId,
      first_name: from.first_name || null,
      last_name: from.last_name || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'username' });
  }

  if (message.text === '/start') {
    const name = from.first_name || 'друг';
    const usernameNote = username
      ? `\n\n✅ Теперь я знаю тебя! Можешь войти в приложение через @${from.username}.`
      : '\n\n⚠️ У тебя не задан username в Telegram. Установи его в настройках Telegram, чтобы войти в приложение.';

    const text = `👋 Привет, ${name}!` +
      `\n\nЯ Riri AI — твой помощник для поиска трендового контента.` +
      usernameNote +
      `\n\nОткрой приложение и нажми «Получить код» — я отправлю его сюда.`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  }

  return res.status(200).json({ ok: true });
}
