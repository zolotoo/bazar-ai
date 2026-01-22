import { useState, useCallback } from 'react';

export type ActionType = 'delete_video' | 'delete_folder' | 'move_video';

export interface ActionHistoryEntry {
  id: string;
  type: ActionType;
  data: any; // Данные для восстановления
  timestamp: number;
}

/**
 * Хук для управления историей действий с возможностью отмены
 */
export function useActionHistory() {
  const [history, setHistory] = useState<ActionHistoryEntry[]>([]);

  /**
   * Добавить действие в историю
   */
  const addAction = useCallback((type: ActionType, data: any) => {
    const entry: ActionHistoryEntry = {
      id: `action-${Date.now()}-${Math.random()}`,
      type,
      data,
      timestamp: Date.now(),
    };
    
    setHistory(prev => [entry, ...prev].slice(0, 50)); // Храним последние 50 действий
    return entry.id;
  }, []);

  /**
   * Отменить последнее действие
   */
  const undoLastAction = useCallback((): ActionHistoryEntry | null => {
    if (history.length === 0) return null;
    
    const lastAction = history[0];
    setHistory(prev => prev.slice(1));
    return lastAction;
  }, [history]);

  /**
   * Получить последнее действие
   */
  const getLastAction = useCallback((): ActionHistoryEntry | null => {
    return history.length > 0 ? history[0] : null;
  }, [history]);

  /**
   * Очистить историю
   */
  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  /**
   * Удалить действие по ID
   */
  const removeAction = useCallback((actionId: string) => {
    setHistory(prev => prev.filter(a => a.id !== actionId));
  }, []);

  return {
    history,
    addAction,
    undoLastAction,
    getLastAction,
    clearHistory,
    removeAction,
    canUndo: history.length > 0,
  };
}
