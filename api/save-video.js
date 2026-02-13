// Vercel Serverless Function — сохраняет видео с Instagram в Supabase Storage
// POST: { shortcode, url } — скачивает по url, загружает в videos/{shortcode}.mp4
// После сохранения воспроизведение идёт с Supabase (без Vercel Fast Origin Transfer)
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'videos';
const MAX_SIZE_MB = 80;
const ALLOWED_HOSTS = ['cdninstagram.com', 'fbcdn.net', 'scontent', 'cdn.fbsbx.com'];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { shortcode, url } = req.body || {};
  if (!shortcode || !url) {
    return res.status(400).json({ error: 'shortcode and url required' });
  }

  const decodedUrl = decodeURIComponent(url);
  if (!ALLOWED_HOSTS.some((h) => decodedUrl.includes(h))) {
    return res.status(403).json({ error: 'URL not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Supabase missing');
    return res.status(500).json({ error: 'Storage not configured' });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // 1. Скачиваем видео
    const fetchRes = await fetch(decodedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VideoStorage/1.0)' },
    });
    if (!fetchRes.ok) {
      return res.status(502).json({ error: 'Failed to fetch video', status: fetchRes.status });
    }
    const contentLength = parseInt(fetchRes.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_SIZE_MB * 1024 * 1024) {
      return res.status(413).json({ error: `Video too large (max ${MAX_SIZE_MB}MB)` });
    }

    const arrayBuffer = await fetchRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const path = `${shortcode}.mp4`;
    const contentType = fetchRes.headers.get('content-type') || 'video/mp4';

    // 2. Загружаем в Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, { contentType, upsert: true });

    if (uploadErr) {
      if (uploadErr.message?.includes('Bucket not found') || uploadErr.message?.includes('not found')) {
        await supabase.storage.createBucket(BUCKET, { public: true });
        const { error: retryErr } = await supabase.storage
          .from(BUCKET)
          .upload(path, buffer, { contentType, upsert: true });
        if (retryErr) {
          console.error('Storage upload retry error:', retryErr);
          return res.status(503).json({ error: 'Storage upload failed' });
        }
      } else {
        console.error('Storage upload error:', uploadErr);
        return res.status(503).json({ error: 'Storage upload failed' });
      }
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const storageUrl = urlData.publicUrl;

    // 3. Обновляем БД (videos + saved_videos по shortcode)
    await supabase.from('videos').update({ storage_video_url: storageUrl }).eq('shortcode', shortcode);
    await supabase.from('saved_videos').update({ storage_video_url: storageUrl }).eq('shortcode', shortcode);

    return res.status(200).json({ success: true, storageUrl });
  } catch (err) {
    console.error('save-video error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
