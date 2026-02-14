// Vercel Serverless Function — thumbnail + video в один endpoint (лимит 12 на Hobby)
// POST type=thumbnail: { url, shortcode } → thumbnails bucket
// POST type=video: { shortcode, url } → videos bucket
import { createClient } from '@supabase/supabase-js';

const THUMBNAIL_HOSTS = ['cdninstagram.com', 'instagram.com', 'fbcdn.net', 'scontent.', 'workers.dev', 'socialapi'];
const VIDEO_HOSTS = ['cdninstagram.com', 'fbcdn.net', 'scontent', 'cdn.fbsbx.com'];
const MAX_VIDEO_MB = 80;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { type, url, shortcode } = req.body || {};
  const mode = type === 'video' ? 'video' : 'thumbnail';

  if (mode === 'video') {
    if (!shortcode || !url) return res.status(400).json({ error: 'shortcode and url required' });
    const decodedUrl = decodeURIComponent(url);
    if (!VIDEO_HOSTS.some((h) => decodedUrl.includes(h))) {
      return res.status(403).json({ error: 'URL not allowed' });
    }
    return handleVideo(req, res, shortcode, decodedUrl);
  }

  if (!url || !shortcode) return res.status(400).json({ error: 'url and shortcode required' });
  const decodedUrl = decodeURIComponent(url);
  if (!THUMBNAIL_HOSTS.some((h) => decodedUrl.includes(h)) && !decodedUrl.startsWith('http')) {
    return res.status(400).json({ error: 'URL not allowed' });
  }
  return handleThumbnail(req, res, shortcode, decodedUrl);
}

async function handleThumbnail(req, res, shortcode, decodedUrl) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Storage not configured' });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
    };
    if (decodedUrl.includes('cdninstagram.com') || decodedUrl.includes('instagram.com') || decodedUrl.includes('fbcdn.net') || decodedUrl.includes('scontent.')) {
      headers['Referer'] = 'https://www.instagram.com/';
    }
    const imgRes = await fetch(decodedUrl, { headers });
    if (!imgRes.ok) {
      return res.status(502).json({ error: 'Failed to fetch image', status: imgRes.status });
    }
    const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('webp') ? 'webp' : 'jpg';
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const path = `${shortcode}.${ext}`;

    const doUpload = () => supabase.storage.from('thumbnails').upload(path, buffer, { contentType, upsert: true });
    let result = await doUpload();
    const isBucketNotFound = (e) => (e?.message || '').includes('Bucket not found') || (e?.message || '').toLowerCase().includes('not found') || e?.statusCode === '404';
    if (result.error && isBucketNotFound(result.error)) {
      await supabase.storage.createBucket('thumbnails', { public: true });
      result = await doUpload();
    }
    if (result.error) {
      return res.status(503).json({ error: 'Storage upload failed', details: result.error.message });
    }
    const { data: urlData } = supabase.storage.from('thumbnails').getPublicUrl(path);
    return res.status(200).json({ success: true, storageUrl: urlData.publicUrl });
  } catch (err) {
    console.error('save-media thumbnail:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}

async function handleVideo(req, res, shortcode, decodedUrl) {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Storage not configured' });
  }
  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    const fetchRes = await fetch(decodedUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VideoStorage/1.0)' } });
    if (!fetchRes.ok) {
      return res.status(502).json({ error: 'Failed to fetch video', status: fetchRes.status });
    }
    const contentLength = parseInt(fetchRes.headers.get('content-length') || '0', 10);
    if (contentLength > MAX_VIDEO_MB * 1024 * 1024) {
      return res.status(413).json({ error: `Video too large (max ${MAX_VIDEO_MB}MB)` });
    }
    const buffer = Buffer.from(await fetchRes.arrayBuffer());
    const path = `${shortcode}.mp4`;
    const contentType = fetchRes.headers.get('content-type') || 'video/mp4';

    let { error: uploadErr } = await supabase.storage.from('videos').upload(path, buffer, { contentType, upsert: true });
    if (uploadErr && (uploadErr.message?.includes('Bucket not found') || uploadErr.message?.includes('not found'))) {
      await supabase.storage.createBucket('videos', { public: true });
      uploadErr = (await supabase.storage.from('videos').upload(path, buffer, { contentType, upsert: true })).error;
    }
    if (uploadErr) {
      return res.status(503).json({ error: 'Storage upload failed' });
    }

    const { data: urlData } = supabase.storage.from('videos').getPublicUrl(path);
    const storageUrl = urlData.publicUrl;
    await supabase.from('videos').update({ storage_video_url: storageUrl }).eq('shortcode', shortcode);
    await supabase.from('saved_videos').update({ storage_video_url: storageUrl }).eq('shortcode', shortcode);

    return res.status(200).json({ success: true, storageUrl });
  } catch (err) {
    console.error('save-media video:', err);
    return res.status(500).json({ error: err.message || 'Internal error' });
  }
}
