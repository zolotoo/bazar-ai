import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { InstagramSearchResult } from '../services/videoService';

export interface SearchHistoryEntry {
  id: string;
  query: string;
  results: InstagramSearchResult[];
  searchedAt: Date;
  resultsCount: number;
}

// Получаем user_id из localStorage
const getUserId = (): string => {
  try {
    const stored = localStorage.getItem('bazar-ai-user');
    if (stored) {
      const user = JSON.parse(stored);
      return user.id || 'anonymous';
    }
  } catch {}
  return 'anonymous';
};

export function useSearchHistory() {
  const [historyEntries, setHistoryEntries] = useState<SearchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Простой список запросов для обратной совместимости
  const history = historyEntries.map(e => e.query);

  // Загрузка истории из Supabase
  const fetchHistory = useCallback(async () => {
    const userId = getUserId();
    
    try {
      const { data, error } = await supabase
        .from('search_history')
        .select('*')
        .eq('user_id', userId)
        .order('searched_at', { ascending: false })
        .limit(50);

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
      }
    } catch (err) {
      console.error('Error loading search history:', err);
      setHistoryEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Добавление запроса с результатами
  const addToHistory = useCallback(async (query: string, results: InstagramSearchResult[] = []) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    const userId = getUserId();
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
  }, []);

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
  }, []);

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
  }, []);

  // Получение результатов по запросу
  const getResultsByQuery = useCallback((query: string): InstagramSearchResult[] => {
    const entry = historyEntries.find(e => e.query.toLowerCase() === query.toLowerCase());
    return entry?.results || [];
  }, [historyEntries]);

  // Получение записи по ID
  const getEntryById = useCallback((id: string): SearchHistoryEntry | undefined => {
    return historyEntries.find(e => e.id === id);
  }, [historyEntries]);

  // Загружаем историю при монтировании
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

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
