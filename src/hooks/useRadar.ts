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

// Функция для добавления видео в saved_videos (inbox)
async function saveReelToInbox(reel: RadarReel, projectId: string, userId: string) {
  try {
    // Извлекаем shortcode из URL
    const shortcode = reel.shortcode || extractShortcode(reel.url);
    
    // Проверяем, нет ли уже такого видео (по video_url или shortcode)
    const { data: existing } = await supabase
      .from('saved_videos')
      .select('id')
      .eq('project_id', projectId)
      .or(`video_url.eq.${reel.url},shortcode.eq.${shortcode}`)
      .single();

    if (existing) {
      // Обновляем статистику
      await supabase
        .from('saved_videos')
        .update({
          view_count: reel.view_count,
          like_count: reel.like_count,
          comment_count: reel.comment_count,
        })
        .eq('id', existing.id);
      return { updated: true, id: existing.id };
    }

    // Конвертируем taken_at в число (unix timestamp)
    let takenAtTimestamp: number | undefined;
    if (reel.taken_at) {
      const ts = typeof reel.taken_at === 'number' ? reel.taken_at : Number(reel.taken_at);
      if (!isNaN(ts)) {
        takenAtTimestamp = ts > 1e12 ? Math.floor(ts / 1000) : ts;
      }
    }

    // Добавляем новое видео
    const { data, error } = await supabase
      .from('saved_videos')
      .insert({
        user_id: userId,
        video_id: shortcode || `radar-${Date.now()}`,
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
        folder_id: null, // Во "Все видео" (без папки)
        source: 'radar',
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving reel to inbox:', error);
      return null;
    }

    return { created: true, id: data?.id, videoUrl: reel.url };
  } catch (e) {
    console.error('Failed to save reel to inbox:', e);
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
async function startVideoTranscription(videoDbId: string, instagramUrl: string) {
  console.log('[Radar] Starting transcription for:', instagramUrl);
  
  try {
    // Обновляем статус
    await supabase
      .from('saved_videos')
      .update({ transcript_status: 'downloading' })
      .eq('id', videoDbId);
    
    // Получаем ссылку на скачивание и запускаем транскрибацию
    const result = await downloadAndTranscribe(instagramUrl);
    
    if (!result.success) {
      console.error('[Radar] Video processing failed:', result.error);
      await supabase
        .from('saved_videos')
        .update({ transcript_status: 'error' })
        .eq('id', videoDbId);
      return;
    }
    
    // Сохраняем данные о скачивании и транскрибации
    await supabase
      .from('saved_videos')
      .update({ 
        download_url: result.videoUrl,
        transcript_id: result.transcriptId,
        transcript_status: 'processing',
      })
      .eq('id', videoDbId);
    
    console.log('[Radar] Transcription started, id:', result.transcriptId);
    
    // Запускаем проверку статуса транскрибации
    if (result.transcriptId) {
      pollTranscriptionStatus(videoDbId, result.transcriptId);
    }
  } catch (err) {
    console.error('[Radar] Video processing error:', err);
    await supabase
      .from('saved_videos')
      .update({ transcript_status: 'error' })
      .eq('id', videoDbId);
  }
}

// Проверяет статус транскрибации с polling
async function pollTranscriptionStatus(videoDbId: string, transcriptId: string) {
  const maxAttempts = 60; // 5 минут при интервале 5 сек
  let attempts = 0;
  
  const checkStatus = async () => {
    attempts++;
    
    try {
      const result = await checkTranscriptionStatus(transcriptId);
      
      if (result.status === 'completed') {
        // Сохраняем результат
        await supabase
          .from('saved_videos')
          .update({ 
            transcript_status: 'completed',
            transcript_text: result.text,
          })
          .eq('id', videoDbId);
        
        console.log('[Radar] Transcription completed for:', videoDbId);
        return;
      }
      
      if (result.status === 'error') {
        await supabase
          .from('saved_videos')
          .update({ transcript_status: 'error' })
          .eq('id', videoDbId);
        
        console.error('[Radar] Transcription error for:', videoDbId);
        return;
      }
      
      // Продолжаем проверку
      if (attempts < maxAttempts) {
        setTimeout(checkStatus, 5000);
      } else {
        await supabase
          .from('saved_videos')
          .update({ transcript_status: 'timeout' })
          .eq('id', videoDbId);
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
    
    if (!targetProjectId || !userId) {
      console.warn('No projectId or userId for fetching reels');
      return [];
    }
    
    setLoadingUsername(cleanUsername);
    
    try {
      const response = await fetch('/api/user-reels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUsername }),
      });

      if (!response.ok) {
        console.error('Failed to fetch user reels:', response.status);
        return [];
      }

      const data = await response.json();
      
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
            
            // Запускаем транскрибацию для нового видео в фоне
            startVideoTranscription(result.id, reel.url);
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
    if (loading || projectProfiles.length === 0) return;
    
    setLoading(true);
    setStats({ newVideos: 0, updatedVideos: 0 });
    
    for (const profile of projectProfiles) {
      await fetchUserReels(profile.username, profile.projectId);
      // Небольшая задержка между запросами
      await new Promise(r => setTimeout(r, 1000));
    }
    
    setLoading(false);
  }, [projectProfiles, loading, fetchUserReels]);

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
