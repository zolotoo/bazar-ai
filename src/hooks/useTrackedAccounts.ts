import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';
import { getUserReels, InstagramSearchResult } from '../services/videoService';

export interface TrackedAccount {
  id: string;
  instagram_username: string;
  update_frequency_hours: number;
  last_checked_at: string | null;
  created_at: string;
  reels_count?: number;
}

export function useTrackedAccounts() {
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState<string | null>(null);
  const { user } = useAuth();

  const getUserId = useCallback((): string => {
    return user?.id || 'anonymous';
  }, [user]);

  // Загрузка отслеживаемых аккаунтов
  const fetchAccounts = useCallback(async () => {
    const userId = getUserId();
    if (userId === 'anonymous') {
      setAccounts([]);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('tracked_accounts')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tracked accounts:', error);
        setAccounts([]);
      } else if (data) {
        setAccounts(data);
      }
    } catch (err) {
      console.error('Error loading tracked accounts:', err);
    } finally {
      setLoading(false);
    }
  }, [getUserId]);

  // Добавить аккаунт для отслеживания
  const addAccount = useCallback(async (instagramUsername: string, frequencyHours: number = 24) => {
    const userId = getUserId();
    const cleanUsername = instagramUsername.replace('@', '').trim().toLowerCase();
    
    if (!cleanUsername) return null;

    // Оптимистичное добавление
    const newAccount: TrackedAccount = {
      id: `local-${Date.now()}`,
      instagram_username: cleanUsername,
      update_frequency_hours: frequencyHours,
      last_checked_at: null,
      created_at: new Date().toISOString(),
    };
    
    setAccounts(prev => [newAccount, ...prev]);

    try {
      const { data, error } = await supabase
        .from('tracked_accounts')
        .insert({
          user_id: userId,
          instagram_username: cleanUsername,
          update_frequency_hours: frequencyHours,
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding tracked account:', error);
        // Откатываем оптимистичное добавление
        setAccounts(prev => prev.filter(a => a.id !== newAccount.id));
        return null;
      }

      if (data) {
        // Заменяем локальный на реальный
        setAccounts(prev => prev.map(a => a.id === newAccount.id ? data : a));
        return data;
      }
    } catch (err) {
      console.error('Error adding account:', err);
      setAccounts(prev => prev.filter(a => a.id !== newAccount.id));
    }
    
    return null;
  }, [getUserId]);

  // Удалить аккаунт из отслеживания
  const removeAccount = useCallback(async (accountId: string) => {
    const userId = getUserId();
    
    setAccounts(prev => prev.filter(a => a.id !== accountId));

    try {
      await supabase
        .from('tracked_accounts')
        .delete()
        .eq('user_id', userId)
        .eq('id', accountId);
    } catch (err) {
      console.error('Error removing tracked account:', err);
      fetchAccounts();
    }
  }, [getUserId, fetchAccounts]);

  // Обновить частоту проверки
  const updateFrequency = useCallback(async (accountId: string, frequencyHours: number) => {
    const userId = getUserId();
    
    setAccounts(prev => prev.map(a => 
      a.id === accountId ? { ...a, update_frequency_hours: frequencyHours } : a
    ));

    try {
      await supabase
        .from('tracked_accounts')
        .update({ update_frequency_hours: frequencyHours })
        .eq('user_id', userId)
        .eq('id', accountId);
    } catch (err) {
      console.error('Error updating frequency:', err);
    }
  }, [getUserId]);

  // Проверить и загрузить рилсы аккаунта
  const checkAccountReels = useCallback(async (account: TrackedAccount): Promise<InstagramSearchResult[]> => {
    const userId = getUserId();
    setChecking(account.id);
    
    try {
      // Получаем рилсы через API
      const reels = await getUserReels(account.instagram_username);
      
      // Сохраняем новые рилсы в saved_videos
      for (const reel of reels.slice(0, 10)) { // Ограничиваем до 10 последних
        const caption = typeof reel.caption === 'string' ? reel.caption : '';
        
        await supabase
          .from('saved_videos')
          .upsert({
            user_id: userId,
            video_id: reel.shortcode || reel.id,
            shortcode: reel.shortcode,
            thumbnail_url: reel.thumbnail_url,
            video_url: reel.url,
            caption: caption.slice(0, 500),
            owner_username: account.instagram_username,
            view_count: reel.view_count,
            like_count: reel.like_count,
            comment_count: reel.comment_count,
            taken_at: reel.taken_at ? Number(reel.taken_at) : null,
          }, {
            onConflict: 'user_id,video_id'
          });
      }

      // Обновляем время последней проверки
      await supabase
        .from('tracked_accounts')
        .update({ last_checked_at: new Date().toISOString() })
        .eq('id', account.id);

      // Обновляем локальное состояние
      setAccounts(prev => prev.map(a => 
        a.id === account.id 
          ? { ...a, last_checked_at: new Date().toISOString(), reels_count: reels.length }
          : a
      ));

      return reels;
    } catch (err) {
      console.error('Error checking account reels:', err);
      return [];
    } finally {
      setChecking(null);
    }
  }, [getUserId]);

  // Проверить все аккаунты, которым пора обновиться
  const checkAllDueAccounts = useCallback(async () => {
    const now = new Date();
    
    for (const account of accounts) {
      if (!account.last_checked_at) {
        // Никогда не проверялся - проверяем
        await checkAccountReels(account);
        continue;
      }

      const lastChecked = new Date(account.last_checked_at);
      const hoursSinceCheck = (now.getTime() - lastChecked.getTime()) / (1000 * 60 * 60);
      
      if (hoursSinceCheck >= account.update_frequency_hours) {
        await checkAccountReels(account);
      }
    }
  }, [accounts, checkAccountReels]);

  useEffect(() => {
    if (user) {
      fetchAccounts();
    }
  }, [user, fetchAccounts]);

  return {
    accounts,
    loading,
    checking,
    addAccount,
    removeAccount,
    updateFrequency,
    checkAccountReels,
    checkAllDueAccounts,
    refetch: fetchAccounts,
  };
}
