import { useState, useEffect, useCallback } from 'react';
import { InstagramSearchResult } from '../services/videoService';
import { supabase } from '../utils/supabase';
import { downloadAndTranscribe, checkTranscriptionStatus } from '../services/transcriptionService';

export interface TrackedProfile {
  id?: string;
  username: string;
  projectId: string;
  addedAt: string;
  lastChecked?: string;
  avatarUrl?: string;
  fullName?: string;
  reelsCount?: number;
}

export interface RadarReel extends InstagramSearchResult {
  isNew?: boolean;
  projectId?: string;
  savedToInbox?: boolean;
}

const STORAGE_KEY = 'radar_profiles';

// Функция для получения/создания видео в общей таблице videos
async function getOrCreateGlobalVideo(reel: RadarReel): Promise<{
  id: string;
  shortcode: string;
  transcript_status: string | null;
  transcript_text: string | null;
  needsTranscription: boolean;
} | null> {
  const shortcode = reel.shortcode || extractShortcode(reel.url);
  if (!shortcode) return null;
  
  // Конвертируем taken_at
  let takenAtTimestamp: number | undefined;
  if (reel.taken_at) {
    const ts = typeof reel.taken_at === 'number' ? reel.taken_at : Number(reel.taken_at);
    if (!isNaN(ts)) {
      takenAtTimestamp = ts > 1e12 ? Math.floor(ts / 1000) : ts;
    }
  }
  
  // Проверяем есть ли видео в общей таблице
  const { data: existing } = await supabase
    .from('videos')
    .select('id, shortcode, transcript_status, transcript_text')
    .eq('shortcode', shortcode)
    .maybeSingle();
  
  if (existing) {
    console.log('[Radar] Global video exists:', shortcode, 'transcript:', existing.transcript_status);
    
    // Обновляем статистику
    await supabase
      .from('videos')
      .update({
        view_count: reel.view_count,
        like_count: reel.like_count,
        comment_count: reel.comment_count,
        thumbnail_url: reel.thumbnail_url || reel.display_url,
      })
      .eq('id', existing.id);
    
    return {
      ...existing,
      needsTranscription: !existing.transcript_status || existing.transcript_status === 'error',
    };
  }
  
  // Создаём новое видео в общей таблице
  console.log('[Radar] Creating global video:', shortcode);
  const { data: newVideo, error } = await supabase
    .from('videos')
    .insert({
      shortcode,
      instagram_id: reel.id,
      url: reel.url,
      thumbnail_url: reel.thumbnail_url || reel.display_url || '',
      caption: typeof reel.caption === 'string' ? reel.caption.slice(0, 500) : '',
      owner_username: reel.owner?.username,
      view_count: reel.view_count || 0,
      like_count: reel.like_count || 0,
      comment_count: reel.comment_count || 0,
      taken_at: takenAtTimestamp,
    })
    .select()
    .single();
  
  if (error) {
    console.error('[Radar] Error creating global video:', error);
    return null;
  }
  
  return {
    id: newVideo.id,
    shortcode,
    transcript_status: null,
    transcript_text: null,
    needsTranscription: true,
  };
}

// Функция для добавления видео в saved_videos пользователя (inbox)
async function saveReelToInbox(reel: RadarReel, projectId: string, userId: string) {
  try {
    const shortcode = reel.shortcode || extractShortcode(reel.url);
    
    console.log('[Radar] Saving reel:', { shortcode, projectId, userId, url: reel.url });
    
    // 1. Сначала получаем/создаём видео в общей таблице
    const globalVideo = await getOrCreateGlobalVideo(reel);
    
    // 2. Проверяем, есть ли уже у пользователя это видео
    let existingUserVideo = null;
    if (shortcode) {
      const { data } = await supabase
        .from('saved_videos')
        .select('id')
        .eq('user_id', userId)
        .eq('shortcode', shortcode)
        .maybeSingle();
      existingUserVideo = data;
    }

    if (existingUserVideo) {
      console.log('[Radar] User already has this video:', existingUserVideo.id);
      
      // Обновляем статистику у пользователя
      await supabase
        .from('saved_videos')
        .update({
          view_count: reel.view_count,
          like_count: reel.like_count,
          comment_count: reel.comment_count,
          // Копируем транскрибацию из общей таблицы если есть
          transcript_status: globalVideo?.transcript_status,
          transcript_text: globalVideo?.transcript_text,
        })
        .eq('id', existingUserVideo.id);
      
      return { updated: true, id: existingUserVideo.id, globalVideoId: globalVideo?.id };
    }

    // 3. Добавляем видео пользователю
    let takenAtTimestamp: number | undefined;
    if (reel.taken_at) {
      const ts = typeof reel.taken_at === 'number' ? reel.taken_at : Number(reel.taken_at);
      if (!isNaN(ts)) {
        takenAtTimestamp = ts > 1e12 ? Math.floor(ts / 1000) : ts;
      }
    }

    const videoId = shortcode || `radar-${Date.now()}`;
    
    const { data, error } = await supabase
      .from('saved_videos')
      .insert({
        user_id: userId,
        video_id: videoId,
        shortcode: shortcode,
        project_id: projectId,
        caption: typeof reel.caption === 'string' ? reel.caption.slice(0, 500) : 'Видео из Instagram',
        thumbnail_url: reel.thumbnail_url || reel.display_url || '',
        video_url: reel.url,
        view_count: reel.view_count,
        like_count: reel.like_count,
        comment_count: reel.comment_count,
        owner_username: reel.owner?.username,
        taken_at: takenAtTimestamp,
        folder_id: null,
        // Копируем транскрибацию если уже есть в общей таблице
        transcript_status: globalVideo?.transcript_status,
        transcript_text: globalVideo?.transcript_text,
      })
      .select()
      .single();

    if (error) {
      console.error('[Radar] Error saving reel to inbox:', error);
      return null;
    }

    console.log('[Radar] Video saved successfully:', data?.id);
    return { 
      created: true, 
      id: data?.id, 
      videoUrl: reel.url,
      globalVideoId: globalVideo?.id,
      needsTranscription: globalVideo?.needsTranscription ?? true,
    };
  } catch (e) {
    console.error('[Radar] Failed to save reel to inbox:', e);
    return null;
  }
}

// Извлекаем shortcode из Instagram URL
function extractShortcode(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/);
  return match ? match[2] : null;
}

// Запускает скачивание и транскрибацию видео в фоне
// Сохраняет в ОБЕИХ таблицах: videos (общая) и saved_videos (пользователя)
async function startVideoTranscription(userVideoId: string, globalVideoId: string | undefined, instagramUrl: string) {
  console.log('[Radar] Starting transcription for:', instagramUrl);
  
  const shortcode = extractShortcode(instagramUrl);
  
  try {
    // Обновляем статус в обеих таблицах
    await supabase
      .from('saved_videos')
      .update({ transcript_status: 'downloading' })
      .eq('id', userVideoId);
    
    if (globalVideoId) {
      await supabase
        .from('videos')
        .update({ transcript_status: 'downloading' })
        .eq('id', globalVideoId);
    }
    
    // Получаем ссылку на скачивание и запускаем транскрибацию
    const result = await downloadAndTranscribe(instagramUrl);
    
    if (!result.success) {
      console.error('[Radar] Video processing failed:', result.error);
      await supabase
        .from('saved_videos')
        .update({ transcript_status: 'error' })
        .eq('id', userVideoId);
      if (globalVideoId) {
        await supabase
          .from('videos')
          .update({ transcript_status: 'error' })
          .eq('id', globalVideoId);
      }
      return;
    }
    
    // Сохраняем данные в обеих таблицах
    await supabase
      .from('saved_videos')
      .update({ 
        download_url: result.videoUrl,
        transcript_id: result.transcriptId,
        transcript_status: 'processing',
      })
      .eq('id', userVideoId);
    
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
    
    console.log('[Radar] Transcription started, id:', result.transcriptId);
    
    // Запускаем проверку статуса транскрибации
    if (result.transcriptId) {
      pollTranscriptionStatus(userVideoId, globalVideoId, shortcode, result.transcriptId);
    }
  } catch (err) {
    console.error('[Radar] Video processing error:', err);
    await supabase
      .from('saved_videos')
      .update({ transcript_status: 'error' })
      .eq('id', userVideoId);
  }
}

// Проверяет статус транскрибации с polling
// Сохраняет результат в обе таблицы + обновляет всех пользователей с этим shortcode
async function pollTranscriptionStatus(
  userVideoId: string, 
  globalVideoId: string | undefined, 
  shortcode: string | null,
  transcriptId: string
) {
  const maxAttempts = 60; // 5 минут при интервале 5 сек
  let attempts = 0;
  
  const checkStatus = async () => {
    attempts++;
    
    try {
      const result = await checkTranscriptionStatus(transcriptId);
      
      if (result.status === 'completed') {
        // 1. Сохраняем в общую таблицу videos
        if (globalVideoId) {
          await supabase
            .from('videos')
            .update({ 
              transcript_status: 'completed',
              transcript_text: result.text,
            })
            .eq('id', globalVideoId);
        }
        
        // 2. Обновляем ВСЕХ пользователей у кого есть это видео по shortcode
        if (shortcode) {
          await supabase
            .from('saved_videos')
            .update({ 
              transcript_status: 'completed',
              transcript_text: result.text,
            })
            .eq('shortcode', shortcode);
          
          console.log('[Radar] Transcription completed and synced for shortcode:', shortcode);
        } else {
          // Fallback - обновляем только конкретное видео пользователя
          await supabase
            .from('saved_videos')
            .update({ 
              transcript_status: 'completed',
              transcript_text: result.text,
            })
            .eq('id', userVideoId);
        }
        
        console.log('[Radar] Transcription completed for:', userVideoId);
        return;
      }
      
      if (result.status === 'error') {
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
        
        console.error('[Radar] Transcription error for:', userVideoId);
        return;
      }
      
      // Продолжаем проверку
      if (attempts < maxAttempts) {
        setTimeout(checkStatus, 5000);
      } else {
        await supabase
          .from('saved_videos')
          .update({ transcript_status: 'timeout' })
          .eq('id', userVideoId);
      }
    } catch (err) {
      console.error('[Radar] Poll error:', err);
    }
  };
  
  // Первая проверка через 10 секунд
  setTimeout(checkStatus, 10000);
}

export function useRadar(currentProjectId?: string | null, userId?: string) {
  const [profiles, setProfiles] = useState<TrackedProfile[]>([]);
  const [recentReels, setRecentReels] = useState<RadarReel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsername, setLoadingUsername] = useState<string | null>(null);
  const [stats, setStats] = useState({ newVideos: 0, updatedVideos: 0 });

  // Загрузка профилей из localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const allProfiles = JSON.parse(saved) as TrackedProfile[];
        // Миграция старых профилей без projectId
        const migrated = allProfiles.map(p => ({
          ...p,
          projectId: p.projectId || 'default',
        }));
        setProfiles(migrated);
      } catch (e) {
        console.error('Failed to parse radar profiles:', e);
      }
    }
  }, []);

  // Сохранение профилей в localStorage
  useEffect(() => {
    if (profiles.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
    }
  }, [profiles]);

  // Профили текущего проекта
  const projectProfiles = currentProjectId 
    ? profiles.filter(p => p.projectId === currentProjectId)
    : profiles;

  // Добавить профиль в радар для текущего проекта
  const addProfile = useCallback((username: string, projectId?: string) => {
    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
    const targetProjectId = projectId || currentProjectId;
    
    if (!cleanUsername || !targetProjectId) return false;
    
    // Проверяем, не добавлен ли уже в этот проект
    if (profiles.some(p => 
      p.username.toLowerCase() === cleanUsername && 
      p.projectId === targetProjectId
    )) {
      return false;
    }

    const newProfile: TrackedProfile = {
      id: `${targetProjectId}-${cleanUsername}-${Date.now()}`,
      username: cleanUsername,
      projectId: targetProjectId,
      addedAt: new Date().toISOString(),
    };

    setProfiles(prev => [...prev, newProfile]);
    
    // Сразу загружаем рилсы для нового профиля
    if (userId) {
      fetchUserReels(cleanUsername, targetProjectId);
    }
    
    return true;
  }, [profiles, currentProjectId, userId]);

  // Удалить профиль из радара
  const removeProfile = useCallback((username: string, projectId?: string) => {
    const cleanUsername = username.toLowerCase();
    const targetProjectId = projectId || currentProjectId;
    
    setProfiles(prev => prev.filter(p => 
      !(p.username.toLowerCase() === cleanUsername && 
        (targetProjectId ? p.projectId === targetProjectId : true))
    ));
    
    // Убираем из recent reels
    setRecentReels(prev => prev.filter(r => 
      r.owner?.username?.toLowerCase() !== cleanUsername
    ));
  }, [currentProjectId]);

  // Получить рилсы одного пользователя и сохранить в inbox проекта
  const fetchUserReels = useCallback(async (username: string, projectId?: string) => {
    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
    const targetProjectId = projectId || currentProjectId;
    
    console.log('[Radar] fetchUserReels:', { cleanUsername, targetProjectId, userId });
    
    if (!targetProjectId || !userId) {
      console.error('[Radar] Missing projectId or userId:', { targetProjectId, userId });
      return [];
    }
    
    setLoadingUsername(cleanUsername);
    
    try {
      console.log('[Radar] Calling /api/user-reels for:', cleanUsername);
      const response = await fetch('/api/user-reels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername }),
      });

      console.log('[Radar] API response status:', response.status);
      
      if (!response.ok) {
        console.error('[Radar] Failed to fetch user reels:', response.status);
        return [];
      }

      const data = await response.json();
      console.log('[Radar] API full response:', JSON.stringify(data).slice(0, 500));
      console.log('[Radar] API response parsed:', { 
        success: data.success, 
        reelsCount: data.reels?.length,
        message: data.message,
        apiUsed: data.api_used 
      });
      
      if (data.success && data.reels?.length > 0) {
        let newCount = 0;
        let updatedCount = 0;
        
        // Сохраняем каждый рилс в inbox проекта
        const savedReels: RadarReel[] = [];
        
        for (const reel of data.reels) {
          const result = await saveReelToInbox(reel, targetProjectId, userId);
          
          if (result?.created && result.id) {
            newCount++;
            savedReels.push({ ...reel, isNew: true, projectId: targetProjectId, savedToInbox: true });
            
            // Запускаем транскрибацию ТОЛЬКО если нужно (нет в общей базе)
            if (result.needsTranscription) {
              startVideoTranscription(result.id, result.globalVideoId, reel.url);
            } else {
              console.log('[Radar] Skipping transcription - already exists in global DB');
            }
          } else if (result?.updated) {
            updatedCount++;
            savedReels.push({ ...reel, isNew: false, projectId: targetProjectId, savedToInbox: true });
          }
        }

        // Обновляем recent reels для UI
        setRecentReels(prev => {
          const filtered = prev.filter(r => r.owner?.username?.toLowerCase() !== cleanUsername);
          return [...savedReels.slice(0, 6), ...filtered].slice(0, 30);
        });

        // Обновляем статистику
        setStats(prev => ({
          newVideos: prev.newVideos + newCount,
          updatedVideos: prev.updatedVideos + updatedCount,
        }));

        // Обновляем lastChecked для профиля
        setProfiles(prev => prev.map(p => 
          p.username.toLowerCase() === cleanUsername && p.projectId === targetProjectId
            ? { ...p, lastChecked: new Date().toISOString(), reelsCount: data.reels.length }
            : p
        ));

        return savedReels;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching user reels:', error);
      return [];
    } finally {
      setLoadingUsername(null);
    }
  }, [currentProjectId, userId]);

  // Обновить все профили текущего проекта
  const refreshAll = useCallback(async () => {
    console.log('[Radar] refreshAll called:', { 
      loading, 
      profilesCount: projectProfiles.length,
      userId,
      currentProjectId,
      profiles: projectProfiles.map(p => p.username)
    });
    
    if (loading) {
      console.log('[Radar] Already loading, skip');
      return;
    }
    
    if (projectProfiles.length === 0) {
      console.log('[Radar] No profiles to refresh');
      return;
    }
    
    if (!userId) {
      console.error('[Radar] No userId for refreshAll');
      return;
    }
    
    setLoading(true);
    setStats({ newVideos: 0, updatedVideos: 0 });
    
    for (const profile of projectProfiles) {
      console.log('[Radar] Fetching reels for:', profile.username);
      await fetchUserReels(profile.username, profile.projectId);
      // Небольшая задержка между запросами
      await new Promise(r => setTimeout(r, 1000));
    }
    
    setLoading(false);
    console.log('[Radar] refreshAll completed');
  }, [projectProfiles, loading, fetchUserReels, userId, currentProjectId]);

  // Очистить профили текущего проекта
  const clearProject = useCallback(() => {
    if (!currentProjectId) return;
    
    setProfiles(prev => prev.filter(p => p.projectId !== currentProjectId));
    setRecentReels(prev => prev.filter(r => r.projectId !== currentProjectId));
  }, [currentProjectId]);

  // Очистить все
  const clearAll = useCallback(() => {
    setProfiles([]);
    setRecentReels([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    profiles: projectProfiles,
    allProfiles: profiles,
    recentReels: currentProjectId 
      ? recentReels.filter(r => r.projectId === currentProjectId)
      : recentReels,
    loading,
    loadingUsername,
    stats,
    addProfile,
    removeProfile,
    fetchUserReels,
    refreshAll,
    clearProject,
    clearAll,
  };
}
