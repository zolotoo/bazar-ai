import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, setUserContext } from '@/utils/supabase';
import { useAuth } from './useAuth';

export interface ProjectPresence {
  id: string;
  project_id: string;
  user_id: string;
  entity_type: string | null;
  entity_id: string | null;
  cursor_position: any;
  last_seen: string;
}

/**
 * Хук для управления presence (кто сейчас работает над проектом)
 */
export function useProjectPresence(projectId: string | null) {
  const { user } = useAuth();
  const [presence, setPresence] = useState<ProjectPresence[]>([]);
  const channelRef = useRef<any>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const userId = user?.telegram_username ? `tg-${user.telegram_username}` : null;

  // Обновление своего presence
  const updatePresence = useCallback(async (
    entityType: string | null = null,
    entityId: string | null = null,
    cursorPosition: any = null
  ) => {
    if (!projectId || !userId) return;

    try {
      // Устанавливаем контекст пользователя для RLS
      await setUserContext(userId);
      
      // Из-за уникального индекса с COALESCE, используем DELETE + INSERT вместо upsert
      // Удаляем все записи для этого пользователя в проекте (для упрощения)
      await supabase
        .from('project_presence')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);
      
      // Затем вставляем новую запись
      const { error } = await supabase
        .from('project_presence')
        .insert({
          project_id: projectId,
          user_id: userId,
          entity_type: entityType,
          entity_id: entityId,
          cursor_position: cursorPosition,
          last_seen: new Date().toISOString(),
        });

      if (error) {
        // Игнорируем ошибки если таблица не существует
        if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          console.warn('[ProjectPresence] Table project_presence does not exist. Please run the migration.');
          return;
        }
        throw error;
      }
    } catch (err) {
      // Если таблица не существует, просто игнорируем
      if (err instanceof Error && (err.message?.includes('relation') || err.message?.includes('does not exist'))) {
        console.warn('[ProjectPresence] Table project_presence does not exist. Please run the migration.');
      } else {
        console.error('Error updating presence:', err);
      }
    }
  }, [projectId, userId]);

  // Подписка на изменения presence
  useEffect(() => {
    if (!projectId || !userId) return;

    // Загружаем текущий presence
    const fetchPresence = async () => {
      try {
        // Устанавливаем контекст пользователя для RLS
        await setUserContext(userId);
        
        const { data, error } = await supabase
          .from('project_presence')
          .select('*')
          .eq('project_id', projectId)
          .gt('last_seen', new Date(Date.now() - 30000).toISOString()); // Только активные за последние 30 секунд

        if (error) {
          // Игнорируем ошибки если таблица не существует
          if (error.code === 'PGRST116' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
            console.warn('[ProjectPresence] Table project_presence does not exist. Please run the migration.');
            setPresence([]);
            return;
          }
          throw error;
        }

        if (data) {
          setPresence(data.filter(p => p.user_id !== userId)); // Исключаем себя
        }
      } catch (err) {
        // Если таблица не существует, просто игнорируем
        if (err instanceof Error && (err.message?.includes('relation') || err.message?.includes('does not exist'))) {
          console.warn('[ProjectPresence] Table project_presence does not exist. Please run the migration.');
          setPresence([]);
        } else {
          console.error('Error fetching presence:', err);
        }
      }
    };

    fetchPresence();

    // Подписываемся на изменения
    const channel = supabase
      .channel(`presence:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_presence',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          // Игнорируем ошибки если таблица не существует
          if (payload.new && typeof payload.new === 'object' && 'user_id' in payload.new) {
            const newPresence = payload.new as ProjectPresence;
            if (newPresence.user_id !== userId) {
              // Обновляем presence других пользователей
              setPresence(prev => {
                const filtered = prev.filter(p => p.user_id !== newPresence.user_id);
                if (payload.eventType !== 'DELETE') {
                  return [...filtered, newPresence];
                }
                return filtered;
              });
            }
          }
        }
      )
      .subscribe((_status, err) => {
        if (err) {
          // Игнорируем ошибки подписки если таблица не существует
          if (err.message?.includes('relation') || err.message?.includes('does not exist')) {
            console.warn('[ProjectPresence] Table project_presence does not exist. Please run the migration.');
          } else {
            console.error('[ProjectPresence] Subscription error:', err);
          }
        }
      });

    channelRef.current = channel;

    // Обновляем свой presence каждые 10 секунд
    updateIntervalRef.current = setInterval(() => {
      updatePresence();
    }, 10000);

    // Первоначальное обновление
    updatePresence();

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [projectId, userId, updatePresence]);

  // Получить username из user_id
  const getUsername = useCallback((userId: string): string => {
    return userId.replace('tg-@', '').replace('tg-', '');
  }, []);

  return {
    presence,
    updatePresence,
    getUsername,
  };
}
