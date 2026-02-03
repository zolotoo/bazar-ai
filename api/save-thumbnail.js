// Vercel Serverless Function - скачивает превью с Instagram и сохраняет в Supabase Storage
import { createClient } from '@supabase/supabase-js';

const BUCKET = 'thumbnails';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { url, shortcode } = req.body || {};
  if (!url || !shortcode) {
    return res.status(400).json({ error: 'url and shortcode required' });
  }

  const decodedUrl = decodeURIComponent(url);
  const isAllowed =
    decodedUrl.includes('cdninstagram.com') ||
    decodedUrl.includes('instagram.com') ||
    decodedUrl.includes('fbcdn.net') ||
    decodedUrl.includes('scontent.') ||
    decodedUrl.includes('workers.dev') ||
    decodedUrl.includes('socialapi') ||
    decodedUrl.startsWith('http');
  if (!isAllowed) {
    return res.status(400).json({ error: 'URL not allowed' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('Supabase credentials missing');
    return res.status(500).json({ error: 'Storage not configured' });
  }

  let buffer, path, uploadOpts;

  try {
    // 1. Скачиваем изображение
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    };
    if (decodedUrl.includes('cdninstagram.com') || decodedUrl.includes('instagram.com') || decodedUrl.includes('fbcdn.net') || decodedUrl.includes('scontent.')) {
      headers['Referer'] = 'https://www.instagram.com/';
    }

    const imgRes = await fetch(decodedUrl, { headers });
    if (!imgRes.ok) {
      console.error('Failed to fetch thumbnail:', imgRes.status, decodedUrl?.slice(0, 80));
      return res.status(502).json({
        error: 'Failed to fetch image',
        status: imgRes.status,
        hint: imgRes.status === 403 ? 'Source blocks server requests. Try adding video again later.' : undefined,
      });
    }

    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('webp') ? 'webp' : 'jpg';
    buffer = Buffer.from(await imgRes.arrayBuffer());

    // 2. Загружаем в Supabase Storage
    const supabase = createClient(supabaseUrl, serviceKey);
    path = `${shortcode}.${ext}`;
    uploadOpts = { contentType, upsert: true };

    const doUpload = () => supabase.storage.from(BUCKET).upload(path, buffer, uploadOpts);

    let result = await doUpload();

    // Supabase может выбросить StorageApiError или вернуть error при "Bucket not found"
    const isBucketNotFound = (e) =>
      (e?.message || '').includes('Bucket not found') ||
      (e?.message || '').toLowerCase().includes('not found') ||
      e?.statusCode === '404';

    if (result.error && isBucketNotFound(result.error)) {
      const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true });
      if (!createErr) {
        result = await doUpload();
      }
    }

    if (result.error) {
      console.error('Storage upload error:', result.error);
      return res.status(503).json({
        error: 'Storage not configured',
        details: 'Create bucket "thumbnails" in Supabase: Dashboard → Storage → New bucket, or run the SQL from supabase/migrations/create_thumbnails_bucket.sql',
      });
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return res.status(200).json({ success: true, storageUrl: urlData.publicUrl });
  } catch (err) {
    // Supabase Storage может выбросить StorageApiError при отсутствии bucket — пробуем создать и повторить
    const isBucketNotFound = (e) =>
      (e?.message || '').includes('Bucket not found') ||
      (e?.message || '').toLowerCase().includes('not found') ||
      e?.statusCode === '404';

    if (isBucketNotFound(err)) {
      try {
        const supabase = createClient(supabaseUrl, serviceKey);
        const { error: createErr } = await supabase.storage.createBucket(BUCKET, { public: true });
        if (!createErr) {
          const retry = await supabase.storage.from(BUCKET).upload(path, buffer, uploadOpts);
          if (!retry.error) {
            const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
            return res.status(200).json({ success: true, storageUrl: urlData.publicUrl });
          }
        }
      } catch (retryErr) {
        console.error('Bucket create/retry failed:', retryErr);
      }
      return res.status(503).json({
        error: 'Storage bucket not found',
        details: 'Create bucket "thumbnails" in Supabase Dashboard → Storage, or run supabase/migrations/create_thumbnails_bucket.sql in SQL Editor',
      });
    }

    console.error('save-thumbnail error:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
