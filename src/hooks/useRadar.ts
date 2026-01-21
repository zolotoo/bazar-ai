import { useState, useEffect, useCallback } from 'react';
import { InstagramSearchResult } from '../services/videoService';

export interface TrackedProfile {
  username: string;
  addedAt: string;
  lastChecked?: string;
  avatarUrl?: string;
  fullName?: string;
  reelsCount?: number;
}

export interface RadarReel extends InstagramSearchResult {
  isNew?: boolean;
}

const STORAGE_KEY = 'radar_profiles';
const REELS_CACHE_KEY = 'radar_reels_cache';

export function useRadar() {
  const [profiles, setProfiles] = useState<TrackedProfile[]>([]);
  const [reels, setReels] = useState<RadarReel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingUsername, setLoadingUsername] = useState<string | null>(null);

  // Загрузка профилей из localStorage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setProfiles(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to parse radar profiles:', e);
      }
    }
    
    // Загрузка кэша рилсов
    const cachedReels = localStorage.getItem(REELS_CACHE_KEY);
    if (cachedReels) {
      try {
        setReels(JSON.parse(cachedReels));
      } catch (e) {
        console.error('Failed to parse radar reels cache:', e);
      }
    }
  }, []);

  // Сохранение профилей в localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  }, [profiles]);

  // Сохранение рилсов в кэш
  useEffect(() => {
    localStorage.setItem(REELS_CACHE_KEY, JSON.stringify(reels));
  }, [reels]);

  // Добавить профиль в радар
  const addProfile = useCallback((username: string) => {
    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
    
    if (!cleanUsername) return false;
    
    // Проверяем, не добавлен ли уже
    if (profiles.some(p => p.username.toLowerCase() === cleanUsername)) {
      return false;
    }

    const newProfile: TrackedProfile = {
      username: cleanUsername,
      addedAt: new Date().toISOString(),
    };

    setProfiles(prev => [...prev, newProfile]);
    
    // Сразу загружаем рилсы для нового профиля
    fetchUserReels(cleanUsername);
    
    return true;
  }, [profiles]);

  // Удалить профиль из радара
  const removeProfile = useCallback((username: string) => {
    const cleanUsername = username.toLowerCase();
    setProfiles(prev => prev.filter(p => p.username.toLowerCase() !== cleanUsername));
    // Удаляем рилсы этого пользователя из кэша
    setReels(prev => prev.filter(r => r.owner?.username?.toLowerCase() !== cleanUsername));
  }, []);

  // Получить рилсы одного пользователя
  const fetchUserReels = useCallback(async (username: string) => {
    const cleanUsername = username.replace(/^@/, '').trim().toLowerCase();
    
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
        // Получаем существующие shortcode для определения новых
        const existingShortcodes = new Set(reels.map(r => r.shortcode));
        
        const newReels: RadarReel[] = data.reels.map((reel: RadarReel) => ({
          ...reel,
          isNew: !existingShortcodes.has(reel.shortcode),
        }));

        // Добавляем новые рилсы, избегая дубликатов
        setReels(prev => {
          const updated = [...prev];
          for (const reel of newReels) {
            if (!updated.some(r => r.shortcode === reel.shortcode)) {
              updated.unshift(reel); // Новые в начало
            }
          }
          // Ограничиваем до 100 рилсов
          return updated.slice(0, 100);
        });

        // Обновляем lastChecked для профиля
        setProfiles(prev => prev.map(p => 
          p.username.toLowerCase() === cleanUsername
            ? { ...p, lastChecked: new Date().toISOString(), reelsCount: data.reels.length }
            : p
        ));

        return newReels;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching user reels:', error);
      return [];
    } finally {
      setLoadingUsername(null);
    }
  }, [reels]);

  // Обновить все профили
  const refreshAll = useCallback(async () => {
    if (loading || profiles.length === 0) return;
    
    setLoading(true);
    
    for (const profile of profiles) {
      await fetchUserReels(profile.username);
      // Небольшая задержка между запросами
      await new Promise(r => setTimeout(r, 500));
    }
    
    setLoading(false);
  }, [profiles, loading, fetchUserReels]);

  // Очистить все
  const clearAll = useCallback(() => {
    setProfiles([]);
    setReels([]);
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(REELS_CACHE_KEY);
  }, []);

  // Рилсы сгруппированные по пользователю
  const reelsByUser = profiles.map(profile => ({
    profile,
    reels: reels.filter(r => r.owner?.username?.toLowerCase() === profile.username.toLowerCase()),
  }));

  return {
    profiles,
    reels,
    reelsByUser,
    loading,
    loadingUsername,
    addProfile,
    removeProfile,
    fetchUserReels,
    refreshAll,
    clearAll,
  };
}
