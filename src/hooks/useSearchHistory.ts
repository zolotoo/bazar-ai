import { useState, useEffect, useCallback } from 'react';
import { InstagramSearchResult } from '../services/videoService';

export interface SearchHistoryEntry {
  id: string;
  query: string;
  results: InstagramSearchResult[];
  searchedAt: Date;
  resultsCount: number;
}

interface StoredSearchHistory {
  id: string;
  query: string;
  results: InstagramSearchResult[];
  searched_at: string;
  results_count: number;
}

const STORAGE_KEY = 'instagram-search-history-v2';

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

// Ключ хранилища с учётом пользователя
const getStorageKey = (): string => {
  const userId = getUserId();
  return `${STORAGE_KEY}-${userId}`;
};

export function useSearchHistory() {
  const [historyEntries, setHistoryEntries] = useState<SearchHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Простой список запросов для обратной совместимости
  const history = historyEntries.map(e => e.query);

  // Загрузка истории из localStorage (Supabase не поддерживает большие JSON)
  const fetchHistory = useCallback(async () => {
    try {
      const storageKey = getStorageKey();
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: StoredSearchHistory[] = JSON.parse(stored);
        const entries: SearchHistoryEntry[] = parsed.map(item => ({
          id: item.id,
          query: item.query,
          results: item.results || [],
          searchedAt: new Date(item.searched_at),
          resultsCount: item.results_count || item.results?.length || 0,
        }));
        setHistoryEntries(entries);
      } else {
        setHistoryEntries([]);
      }
    } catch (err) {
      console.error('Error loading search history:', err);
      setHistoryEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Сохранение в localStorage
  const saveToStorage = useCallback((entries: SearchHistoryEntry[]) => {
    try {
      const storageKey = getStorageKey();
      const toStore: StoredSearchHistory[] = entries.map(e => ({
        id: e.id,
        query: e.query,
        results: e.results,
        searched_at: e.searchedAt.toISOString(),
        results_count: e.resultsCount,
      }));
      localStorage.setItem(storageKey, JSON.stringify(toStore));
    } catch (err) {
      console.error('Error saving search history:', err);
    }
  }, []);

  // Добавление запроса с результатами
  const addToHistory = useCallback((query: string, results: InstagramSearchResult[] = []) => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return;

    setHistoryEntries(prev => {
      // Удаляем старую запись с таким же запросом
      const filtered = prev.filter(e => e.query.toLowerCase() !== trimmedQuery.toLowerCase());
      
      const newEntry: SearchHistoryEntry = {
        id: `search-${Date.now()}`,
        query: trimmedQuery,
        results: results.slice(0, 20), // Ограничиваем до 20 результатов
        searchedAt: new Date(),
        resultsCount: results.length,
      };
      
      const newEntries = [newEntry, ...filtered].slice(0, 20); // Храним до 20 поисков
      saveToStorage(newEntries);
      return newEntries;
    });
  }, [saveToStorage]);

  // Удаление запроса из истории
  const removeFromHistory = useCallback((query: string) => {
    setHistoryEntries(prev => {
      const filtered = prev.filter(e => e.query !== query);
      saveToStorage(filtered);
      return filtered;
    });
  }, [saveToStorage]);

  // Очистка всей истории
  const clearHistory = useCallback(() => {
    setHistoryEntries([]);
    localStorage.removeItem(getStorageKey());
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
    history, // string[] для обратной совместимости
    historyEntries, // полные записи с результатами
    loading,
    addToHistory,
    removeFromHistory,
    clearHistory,
    getResultsByQuery,
    getEntryById,
    refetch: fetchHistory,
  };
}
