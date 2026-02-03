import { useState, useEffect, useCallback } from 'react';
import { InstagramSearchResult } from '../services/videoService';
import { supabase } from '../utils/supabase';
import { 
  getOrCreateGlobalVideo, 
  startGlobalTranscription,
  extractShortcode,
} from '../services/globalVideoService';
import {
  getOrUpdateProfileStats,
  InstagramProfileStats,
} from '../services/profileStatsService';

export interface TrackedProfile {
  id?: string;
  username: string;
  projectId: string;
  addedAt: string;
  lastChecked?: string;
  /** Частота автообновления в днях (1, 3, 7, 14) */
  updateFrequencyDays?: number;
  avatarUrl?: string;
  fullName?: string;
  reelsCount?: number;
  // Статистика профиля
  profileStats?: InstagramProfileStats | null;
}

export interface RadarReel extends InstagramSearchResult {
  isNew?: boolean;
  projectId?: string;
  savedToInbox?: boolean;
}

const STORAGE_KEY = 'radar_profiles';
const STORAGE_MIGRATED_KEY = 'radar_profiles_migrated';

/** Преобразует строку из БД в TrackedProfile */
function dbRowToProfile(row: {
  id: string;
  project_id: string;
  user_id: string;
  instagram_username: string;
  update_frequency_days?: number;
  last_checked_at?: string | null;
  added_at: string;
  avatar_url?: string | null;
  full_name?: string | null;
  reels_count?: number | null;
}): TrackedProfile {
  return {
    id: row.id,
    username: row.instagram_username,
    projectId: row.project_id,
    addedAt: row.added_at,
    lastChecked: row.last_checked_at ?? undefined,
    updateFrequencyDays: row.update_frequency_days ?? 7,
    avatarUrl: row.avatar_url ?? undefined,
    fullName: row.full_name ?? undefined,
    reelsCount: row.reels_count ?? undefined,
  };
}

// Функция для добавления видео в saved_videos пользователя (inbox)
// Использует глобальный сервис для транскрибаций
async function saveReelToInbox(reel: RadarReel, projectId: string, userId: string) {
  try {
    const shortcode = reel.shortcode || extractShortcode(reel.url);
    
    console.log('[Radar] Saving reel:', { shortcode, projectId, userId, url: reel.url });
    
    // Конвертируем taken_at
    let takenAtTimestamp: number | undefined;
    if (reel.taken_at) {
      const ts = typeof reel.taken_at === 'number' ? reel.taken_at : Number(reel.taken_at);
      if (!isNaN(ts)) {
        takenAtTimestamp = ts > 1e12 ? Math.floor(ts / 1000) : ts;
      }
    }
    
    // 1. Получаем/создаём видео в ГЛОБАЛЬНОЙ таблице videos
    const globalVideo = shortcode ? await getOrCreateGlobalVideo({
      shortcode,
      url: reel.url,
      thumbnailUrl: reel.thumbnail_url || reel.display_url,
      caption: typeof reel.caption === 'string' ? reel.caption.slice(0, 500) : '',
      ownerUsername: reel.owner?.username,
      viewCount: reel.view_count,
      likeCount: reel.like_count,
      commentCount: reel.comment_count,
      takenAt: takenAtTimestamp,
      instagramId: reel.id,
    }) : null;
    
    const needsTranscription = !globalVideo?.transcript_status || globalVideo.transcript_status === 'error';
    
    // 2. Проверяем, есть ли уже у ПОЛЬЗОВАТЕЛЯ это видео
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
      
      // Обновляем статистику и копируем транскрибацию из глобальной таблицы
      await supabase
        .from('saved_videos')
        .update({
          view_count: reel.view_count,
          like_count: reel.like_count,
          comment_count: reel.comment_count,
          transcript_status: globalVideo?.transcript_status,
          transcript_text: globalVideo?.transcript_text,
        })
        .eq('id', existingUserVideo.id);
      
      return { updated: true, id: existingUserVideo.id, globalVideoId: globalVideo?.id, needsTranscription: false };
    }

    // 3. Создаём новое видео для пользователя
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
        // Копируем транскрибацию если уже есть в глобальной таблице
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
      shortcode,
      needsTranscription,
    };
  } catch (e) {
    console.error('[Radar] Failed to save reel to inbox:', e);
    return null;
  }
}

export function useRadar(currentProjectId?: string | null, userId?: string) {
  const [profiles, setProfiles] = useState<TrackedProfile[]>([]);
  const [recentReels, setRecentReels] = useState<RadarReel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsername, setLoadingUsername] = useState<string | null>(null);
  const [stats, setStats] = useState({ newVideos: 0, updatedVideos: 0 });
  const [profileStatsCache, setProfileStatsCache] = useState<Map<string, InstagramProfileStats>>(new Map());

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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
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
    
    // Загружаем статистику профиля (асинхронно, не блокируя)
    getOrUpdateProfileStats(cleanUsername).then(stats => {
      if (stats) {
        setProfileStatsCache(prev => new Map(prev).set(cleanUsername, stats));
        setProfiles(prev => prev.map(p => 
          p.username.toLowerCase() === cleanUsername && p.projectId === targetProjectId
            ? { ...p, profileStats: stats }
            : p
        ));
        console.log(`[Radar] Profile stats loaded for @${cleanUsername}:`, {
          avg_views: stats.avg_views,
          median_views: stats.median_views,
          videos_analyzed: stats.videos_analyzed,
        });
      }
    });
    
    return true;
  }, [profiles, currentProjectId, userId]);

  // Удалить профиль из радара
  const removeProfile = useCallback((username: string, projectId?: string) => {
    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
    const targetProjectId = projectId || currentProjectId;
    
    console.log('[Radar] removeProfile called:', { cleanUsername, targetProjectId, currentProjectId });
    
    setProfiles(prev => {
      const filtered = prev.filter(p => {
        const matchesUsername = p.username.toLowerCase() === cleanUsername;
        const matchesProject = targetProjectId ? p.projectId === targetProjectId : true;
        return !(matchesUsername && matchesProject);
      });
      console.log('[Radar] Profiles after removal:', filtered.length, 'from', prev.length);
      return filtered;
    });
    
    // Убираем из recent reels
    setRecentReels(prev => prev.filter(r => {
      const reelUsername = r.owner?.username?.toLowerCase();
      const reelProjectId = r.projectId;
      return !(reelUsername === cleanUsername && 
               (targetProjectId ? reelProjectId === targetProjectId : true));
    }));
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
            if (result.needsTranscription && result.shortcode) {
              startGlobalTranscription(result.id, result.globalVideoId, result.shortcode, reel.url);
            } else {
              console.log('[Radar] Skipping transcription - already exists in global DB');
            }
          } else if (result?.updated) {
            updatedCount++;
            savedReels.push({ ...reel, isNew: false, projectId: targetProjectId, savedToInbox: true });
          }
        }

        // Обновляем recent reels для UI (только последние 6 для мини-превью)
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

        // Возвращаем ВСЕ видео профиля (не только последние 6)
        return data.reels.map((reel: any) => ({
          ...reel,
          isNew: savedReels.some(sr => sr.shortcode === reel.shortcode && sr.isNew),
          projectId: targetProjectId,
          savedToInbox: savedReels.some(sr => sr.shortcode === reel.shortcode),
        }));
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching user reels:', error);
      return [];
    } finally {
      setLoadingUsername(null);
    }
  }, [currentProjectId, userId]);

  // Обновить статистику одного профиля
  const updateProfileStats = useCallback(async (username: string, forceUpdate = false) => {
    const cleanUsername = username.toLowerCase().replace('@', '');
    
    try {
      const stats = await getOrUpdateProfileStats(cleanUsername, forceUpdate);
      if (stats) {
        setProfileStatsCache(prev => new Map(prev).set(cleanUsername, stats));
        setProfiles(prev => prev.map(p => 
          p.username.toLowerCase() === cleanUsername
            ? { ...p, profileStats: stats }
            : p
        ));
        return stats;
      }
    } catch (err) {
      console.error(`[Radar] Error updating profile stats for @${username}:`, err);
    }
    return null;
  }, []);

  // Получить статистику профиля (из кэша или загрузить)
  const getProfileStats = useCallback((username: string): InstagramProfileStats | undefined => {
    return profileStatsCache.get(username.toLowerCase().replace('@', ''));
  }, [profileStatsCache]);

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
      
      // Обновляем статистику профиля (раз в 7 дней автоматически)
      await updateProfileStats(profile.username);
      
      // Небольшая задержка между запросами
      await new Promise(r => setTimeout(r, 1000));
    }
    
    setLoading(false);
    console.log('[Radar] refreshAll completed');
  }, [projectProfiles, loading, fetchUserReels, userId, currentProjectId, updateProfileStats]);

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
    profileStatsCache,
    addProfile,
    removeProfile,
    fetchUserReels,
    refreshAll,
    updateProfileStats,
    getProfileStats,
    clearProject,
    clearAll,
  };
}
