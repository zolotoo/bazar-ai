import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { InstagramSearchResult } from '../services/videoService';
import { useAuth } from './useAuth';

export interface SearchHistoryEntry {
  id: string;
  query: string;
  results: InstagramSearchResult[];
  searchedAt: Date;
  resultsCount: number;
}

export function useSearchHistory() {
  const [historyEntries, setHistoryEntries] = useState<SearchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  
  // Получаем user_id из контекста авторизации
  const getUserId = useCallback((): string => {
    if (user?.telegram_username) {
      return `tg-${user.telegram_username}`;
    }
    return 'anonymous';
  }, [user]);

  // Простой список запросов для обратной совместимости
  const history = historyEntries.map(e => e.query);

  // Загрузка истории из Supabase
  const fetchHistory = useCallback(async () => {
    const userId = getUserId();
    console.log('[SearchHistory] Fetching history for user:', userId);
    
    try {
      const { data, error } = await supabase
        .from('search_history')
        .select('*')
        .eq('user_id', userId)
        .order('searched_at', { ascending: false })
        .limit(50);

      console.log('[SearchHistory] Fetch result:', { count: data?.length, error });

      if (error) {
        console.error('Error fetching search history:', error);
        setHistoryEntries([]);
      } else if (data) {
        const entries: SearchHistoryEntry[] = data.map(item => ({
          id: item.id,
          query: item.query,
          results: (item.results as InstagramSearchResult[]) || [],
          searchedAt: new Date(item.searched_at),
          resultsCount: item.results_count || 0,
        }));
        setHistoryEntries(entries);
        console.log('[SearchHistory] Loaded', entries.length, 'entries');
      }
    } catch (err) {
      console.error('Error loading search history:', err);
      setHistoryEntries([]);
    } finally {
      setLoading(false);
    }
  }, [getUserId]);

  // Добавление запроса с результатами
  const addToHistory = useCallback(async (query: string, results: InstagramSearchResult[] = []) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    const userId = getUserId();
    console.log('[SearchHistory] Adding to history for user:', userId, 'query:', trimmedQuery);
    
    const newEntry: SearchHistoryEntry = {
      id: `search-${Date.now()}`,
      query: trimmedQuery,
      results: results.slice(0, 20),
      searchedAt: new Date(),
      resultsCount: results.length,
    };

    // Оптимистичное обновление UI
    setHistoryEntries(prev => {
      const filtered = prev.filter(e => e.query.toLowerCase() !== trimmedQuery.toLowerCase());
      return [newEntry, ...filtered].slice(0, 50);
    });

    // Сохраняем в Supabase
    try {
      await supabase
        .from('search_history')
        .insert({
          user_id: userId,
          query: trimmedQuery,
          results: results.slice(0, 20),
          results_count: results.length,
        });
    } catch (err) {
      console.error('Error saving search history:', err);
    }
  }, [getUserId]);

  // Удаление запроса из истории
  const removeFromHistory = useCallback(async (query: string) => {
    const userId = getUserId();
    
    setHistoryEntries(prev => prev.filter(e => e.query !== query));

    try {
      await supabase
        .from('search_history')
        .delete()
        .eq('user_id', userId)
        .eq('query', query);
    } catch (err) {
      console.error('Error removing from history:', err);
    }
  }, [getUserId]);

  // Очистка всей истории
  const clearHistory = useCallback(async () => {
    const userId = getUserId();
    
    setHistoryEntries([]);

    try {
      await supabase
        .from('search_history')
        .delete()
        .eq('user_id', userId);
    } catch (err) {
      console.error('Error clearing history:', err);
    }
  }, [getUserId]);

  // Получение результатов по запросу
  const getResultsByQuery = useCallback((query: string): InstagramSearchResult[] => {
    const entry = historyEntries.find(e => e.query.toLowerCase() === query.toLowerCase());
    return entry?.results || [];
  }, [historyEntries]);

  // Получение записи по ID
  const getEntryById = useCallback((id: string): SearchHistoryEntry | undefined => {
    return historyEntries.find(e => e.id === id);
  }, [historyEntries]);

  // Загружаем историю при монтировании и смене пользователя
  useEffect(() => {
    if (user) {
      fetchHistory();
    }
  }, [user, fetchHistory]);

  return {
    history,
    historyEntries,
    loading,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getResultsByQuery,
    getEntryById,
    refetch: fetchHistory,
  };
}
