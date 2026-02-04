/**
 * Сервис для работы с глобальной таблицей videos
 * 
 * Логика:
 * 1. Все видео по shortcode хранятся в таблице videos (общая для всех пользователей)
 * 2. Транскрибация делается ОДИН раз и используется всеми
 * 3. При добавлении видео - сначала проверяем videos, потом saved_videos
 * 4. Статистика (views, likes) обновляется при каждом новом запросе
 */

import { supabase } from '../utils/supabase';
import { downloadAndTranscribe, checkTranscriptionStatus } from './transcriptionService';
import { toast } from 'sonner';

export interface GlobalVideo {
  id: string;
  shortcode: string;
  instagram_id?: string;
  url?: string;
  thumbnail_url?: string;
  caption?: string;
  owner_username?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  taken_at?: number;
  download_url?: string;
  transcript_id?: string;
  transcript_status?: string | null;
  transcript_text?: string | null;
}

interface VideoData {
  shortcode: string;
  url?: string;
  thumbnailUrl?: string;
  caption?: string;
  ownerUsername?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  takenAt?: number;
  instagramId?: string;
}

// Извлекаем shortcode из Instagram URL (reel, reels, p, tv)
export function extractShortcode(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

/**
 * Получить или создать видео в глобальной таблице
 * Возвращает существующую транскрибацию если есть
 */
export async function getOrCreateGlobalVideo(data: VideoData): Promise<GlobalVideo | null> {
  const { shortcode } = data;
  if (!shortcode) return null;
  
  console.log('[GlobalVideo] getOrCreate:', shortcode);
  
  try {
    // 1. Проверяем есть ли видео в общей таблице
    const { data: existing, error: selectError } = await supabase
      .from('videos')
      .select('*')
      .eq('shortcode', shortcode)
      .maybeSingle();
    
    if (selectError) {
      console.error('[GlobalVideo] Select error:', selectError);
      // Если таблицы нет - возвращаем null, не блокируем работу
      return null;
    }
    
    if (existing) {
      console.log('[GlobalVideo] Found existing:', shortcode, 'transcript:', existing.transcript_status);
      
      // Обновляем статистику если есть новые данные
      if (data.viewCount || data.likeCount || data.commentCount) {
        await supabase
          .from('videos')
          .update({
            view_count: data.viewCount ?? existing.view_count,
            like_count: data.likeCount ?? existing.like_count,
            comment_count: data.commentCount ?? existing.comment_count,
            thumbnail_url: data.thumbnailUrl || existing.thumbnail_url,
          })
          .eq('id', existing.id);
      }
      
      return existing as GlobalVideo;
    }
    
    // 2. Создаём новое видео в общей таблице
    console.log('[GlobalVideo] Creating new:', shortcode);
    
    const { data: newVideo, error: insertError } = await supabase
      .from('videos')
      .insert({
        shortcode,
        instagram_id: data.instagramId,
        url: data.url,
        thumbnail_url: data.thumbnailUrl || '',
        caption: data.caption?.slice(0, 500) || '',
        owner_username: data.ownerUsername,
        view_count: data.viewCount || 0,
        like_count: data.likeCount || 0,
        comment_count: data.commentCount || 0,
        taken_at: data.takenAt,
      })
      .select()
      .single();
    
    if (insertError) {
      console.error('[GlobalVideo] Insert error:', insertError);
      return null;
    }
    
    console.log('[GlobalVideo] Created:', newVideo.id);
    return newVideo as GlobalVideo;
    
  } catch (err) {
    console.error('[GlobalVideo] Error:', err);
    return null;
  }
}

/**
 * Проверяет есть ли готовая транскрибация для shortcode
 */
export async function getTranscriptionByShortcode(shortcode: string): Promise<{
  hasTranscription: boolean;
  transcriptStatus?: string | null;
  transcriptText?: string | null;
  globalVideoId?: string;
}> {
  if (!shortcode) {
    return { hasTranscription: false };
  }
  
  try {
    const { data, error } = await supabase
      .from('videos')
      .select('id, transcript_status, transcript_text')
      .eq('shortcode', shortcode)
      .maybeSingle();
    
    if (error || !data) {
      return { hasTranscription: false };
    }
    
    return {
      hasTranscription: data.transcript_status === 'completed' && !!data.transcript_text,
      transcriptStatus: data.transcript_status,
      transcriptText: data.transcript_text,
      globalVideoId: data.id,
    };
  } catch {
    return { hasTranscription: false };
  }
}

/**
 * Запускает транскрибацию и сохраняет в обе таблицы
 * - videos (глобальная)
 * - saved_videos (все пользователи с этим shortcode)
 */
export async function startGlobalTranscription(
  userVideoId: string,
  globalVideoId: string | undefined,
  shortcode: string | null,
  instagramUrl: string
): Promise<void> {
  console.log('[GlobalVideo] Starting transcription:', { shortcode, instagramUrl });
  
  try {
    // 1. Обновляем статус в обеих таблицах
    const updateStatus = async (status: string) => {
      if (globalVideoId) {
        await supabase
          .from('videos')
          .update({ transcript_status: status })
          .eq('id', globalVideoId);
      }
      
      // Обновляем у текущего пользователя
      await supabase
        .from('saved_videos')
        .update({ transcript_status: status })
        .eq('id', userVideoId);
    };
    
    await updateStatus('downloading');
    
    // 2. Скачиваем и запускаем транскрибацию
    const result = await downloadAndTranscribe(instagramUrl);
    
    if (!result.success) {
      console.error('[GlobalVideo] Download failed:', result.error);
      await updateStatus('error');
      toast.error('Ошибка транскрибации', { description: result.error || 'Не удалось скачать видео' });
      return;
    }
    
    // 3. Сохраняем данные о скачивании
    if (globalVideoId) {
      await supabase
        .from('videos')
        .update({
          download_url: result.videoUrl,
          transcript_id: result.transcriptId,
          transcript_status: 'processing',
        })
        .eq('id', globalVideoId);
    }
    
    await supabase
      .from('saved_videos')
      .update({
        download_url: result.videoUrl,
        transcript_id: result.transcriptId,
        transcript_status: 'processing',
      })
      .eq('id', userVideoId);
    
    console.log('[GlobalVideo] Transcription started, id:', result.transcriptId);
    
    // 4. Запускаем polling для проверки статуса
    if (result.transcriptId) {
      pollGlobalTranscriptionStatus(userVideoId, globalVideoId, shortcode, result.transcriptId);
    }
    
  } catch (err) {
    console.error('[GlobalVideo] Transcription error:', err);
    
    await supabase
      .from('saved_videos')
      .update({ transcript_status: 'error' })
      .eq('id', userVideoId);
    toast.error('Ошибка транскрибации', { description: err instanceof Error ? err.message : 'Неизвестная ошибка' });
  }
}

/**
 * Polling статуса транскрибации
 * При завершении - обновляет ВСЕ записи с этим shortcode
 */
async function pollGlobalTranscriptionStatus(
  userVideoId: string,
  globalVideoId: string | undefined,
  shortcode: string | null,
  transcriptId: string
): Promise<void> {
  const maxAttempts = 60; // 5 минут
  let attempts = 0;
  
  const checkStatus = async () => {
    attempts++;
    
    try {
      const result = await checkTranscriptionStatus(transcriptId);
      
      if (result.status === 'completed') {
        console.log('[GlobalVideo] Transcription completed for:', shortcode);
        
        // 1. Сохраняем в глобальную таблицу
        if (globalVideoId) {
          await supabase
            .from('videos')
            .update({
              transcript_status: 'completed',
              transcript_text: result.text,
            })
            .eq('id', globalVideoId);
        }
        
        // 2. Обновляем ВСЕХ пользователей с этим shortcode
        if (shortcode) {
          const { error } = await supabase
            .from('saved_videos')
            .update({
              transcript_status: 'completed',
              transcript_text: result.text,
            })
            .eq('shortcode', shortcode);
          
          if (error) {
            console.error('[GlobalVideo] Error syncing to users:', error);
          } else {
            console.log('[GlobalVideo] Synced transcription to all users with shortcode:', shortcode);
          }
        } else {
          // Fallback - только текущий пользователь
          await supabase
            .from('saved_videos')
            .update({
              transcript_status: 'completed',
              transcript_text: result.text,
            })
            .eq('id', userVideoId);
        }
        
        return;
      }
      
      if (result.status === 'error') {
        console.error('[GlobalVideo] Transcription failed for:', shortcode);
        
        if (globalVideoId) {
          await supabase
            .from('videos')
            .update({ transcript_status: 'error' })
            .eq('id', globalVideoId);
        }
        
        await supabase
          .from('saved_videos')
          .update({ transcript_status: 'error' })
          .eq('id', userVideoId);
        
        return;
      }
      
      // Продолжаем проверку
      if (attempts < maxAttempts) {
        setTimeout(checkStatus, 5000);
      } else {
        console.warn('[GlobalVideo] Transcription timeout for:', shortcode);
        await supabase
          .from('saved_videos')
          .update({ transcript_status: 'timeout' })
          .eq('id', userVideoId);
      }
      
    } catch (err) {
      console.error('[GlobalVideo] Poll error:', err);
    }
  };
  
  // Первая проверка через 10 секунд
  setTimeout(checkStatus, 10000);
}

/**
 * Синхронизирует транскрибацию из глобальной таблицы в saved_videos пользователя
 */
export async function syncTranscriptionToUser(
  userVideoId: string,
  globalVideo: GlobalVideo
): Promise<boolean> {
  if (!globalVideo.transcript_text || globalVideo.transcript_status !== 'completed') {
    return false;
  }
  
  try {
    await supabase
      .from('saved_videos')
      .update({
        transcript_status: globalVideo.transcript_status,
        transcript_text: globalVideo.transcript_text,
        download_url: globalVideo.download_url,
        transcript_id: globalVideo.transcript_id,
      })
      .eq('id', userVideoId);
    
    console.log('[GlobalVideo] Synced transcription to user video:', userVideoId);
    return true;
  } catch (err) {
    console.error('[GlobalVideo] Sync error:', err);
    return false;
  }
}
