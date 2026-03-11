// Serverless endpoint для статистики использования API.
// Только для администратора — проверяем userId в запросе.
// Использует service role key для доступа ко всем записям без RLS.

const ADMIN_USERNAME = 'sergeyzolotykh';
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { userId, period } = req.body || {};

  // Проверяем что запрос от администратора
  if (!userId || userId.toLowerCase() !== ADMIN_USERNAME.toLowerCase()) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Supabase service key not configured' });
  }

  try {
    // Формируем фильтр по дате
    let dateFilter = '';
    if (period && period !== 'all') {
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const since = new Date();
      since.setDate(since.getDate() - days);
      dateFilter = `&created_at=gte.${since.toISOString()}`;
    }

    const url = `${SUPABASE_URL}/rest/v1/api_usage_log?select=*&order=created_at.desc&limit=5000${dateFilter}`;

    const response = await fetch(url, {
      headers: {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('[usage-stats] Supabase error:', response.status, text);
      // Таблица не создана — понятная подсказка
      if (response.status === 404 || text.includes('does not exist')) {
        return res.status(404).json({ error: 'table_not_found', message: 'Запусти миграцию create_api_usage_log.sql в Supabase SQL Editor' });
      }
      return res.status(500).json({ error: 'Supabase query failed', details: text });
    }

    const data = await response.json();
    return res.status(200).json({ success: true, rows: data });
  } catch (err) {
    console.error('[usage-stats] Error:', err?.message);
    return res.status(500).json({ error: err?.message || 'Internal error' });
  }
}
