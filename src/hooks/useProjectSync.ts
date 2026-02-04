import { useEffect, useCallback, useRef } from 'react';
import { supabase, setUserContext } from '../utils/supabase';
import { useAuth } from './useAuth';
import { useInboxVideos } from './useInboxVideos';
import { toast } from 'sonner';

export interface ProjectChange {
  id: string;
  project_id: string;
  user_id: string;
  change_type: string;
  entity_type: string;
  entity_id: string | null;
  old_data: any;
  new_data: any;
  timestamp: string;
  vector_clock: Record<string, number>;
}

/**
 * Хук для синхронизации изменений проекта в реальном времени
 */
export function useProjectSync(projectId: string | null) {
  const { user } = useAuth();
  const { updateVideoFolder } = useInboxVideos();
  const channelRef = useRef<any>(null);
  const lastChangeIdRef = useRef<string | null>(null);

  const userId = user?.telegram_username ? `tg-${user.telegram_username}` : null;

  // Генерация Vector Clock
  const generateVectorClock = useCallback((currentClock?: Record<string, number>): Record<string, number> => {
    if (!userId) return {};
    return {
      ...currentClock,
      [userId]: (currentClock?.[userId] || 0) + 1,
    };
  }, [userId]);

  // entity_id в project_changes — UUID; folder ID вида "folder-123" невалиден, передаём null
  const toValidEntityId = (id: string | null): string | null => {
    if (!id) return null;
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(id) ? id : null;
  };

  // Отправка изменения на сервер (синхронизация опциональна — не блокирует основной flow)
  const sendChange = useCallback(async (
    changeType: string,
    entityType: string,
    entityId: string | null,
    oldData: any,
    newData: any
  ) => {
    if (!projectId || !userId) {
      console.warn('Cannot send change: missing projectId or userId');
      return;
    }

    try {
      await setUserContext(userId);
      const validEntityId = toValidEntityId(entityId);
      
      const { data, error } = await supabase
        .from('project_changes')
        .insert({
          project_id: projectId,
          user_id: userId,
          change_type: changeType,
          entity_type: entityType,
          entity_id: validEntityId,
          old_data: oldData,
          new_data: newData,
          vector_clock: generateVectorClock(),
        })
        .select()
        .single();

      if (error) {
        console.error('Failed to send change:', error);
        toast.error('Не удалось синхронизировать изменение');
        throw error;
      }

      lastChangeIdRef.current = data.id;
      return data;
    } catch (err) {
      console.error('Error sending change:', err);
      throw err;
    }
  }, [projectId, userId, generateVectorClock]);

  // Применение изменения локально
  const applyChange = useCallback(async (change: ProjectChange) => {
    // Пропускаем свои собственные изменения (они уже применены оптимистично)
    if (change.user_id === userId) {
      return;
    }

    try {
      switch (change.change_type) {
        case 'video_moved':
          if (change.entity_type === 'video' && change.entity_id) {
            await updateVideoFolder(change.entity_id, change.new_data?.folder_id || null);
          }
          break;

        case 'video_deleted':
          if (change.entity_type === 'video' && change.entity_id) {
            toast.info('Видео было удалено другим участником');
          }
          break;

        case 'folder_created':
        case 'folder_renamed':
        case 'folder_deleted':
          window.dispatchEvent(new CustomEvent('project-updated', { detail: { projectId } }));
          break;

        case 'member_added':
        case 'member_removed':
        case 'member_role_changed':
          window.dispatchEvent(new CustomEvent('members-updated', { detail: { projectId } }));
          break;

        default:
          console.log('Unknown change type:', change.change_type);
      }
    } catch (err) {
      console.error('Error applying change:', err);
    }
  }, [userId, updateVideoFolder, projectId]);

  // Подписка на изменения проекта
  useEffect(() => {
    if (!projectId || !userId) return;

    const channel = supabase
      .channel(`project:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'project_changes',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          const change = payload.new as ProjectChange;
          if (change.id !== lastChangeIdRef.current) {
            applyChange(change);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'saved_videos',
          filter: `project_id=eq.${projectId}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && payload.new.last_modified_by !== userId) {
            toast.info('Видео было обновлено другим участником');
            window.dispatchEvent(new CustomEvent('videos-updated', { detail: { projectId } }));
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log(`[ProjectSync] Subscribed to project:${projectId}`);
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [projectId, userId, applyChange]);

  return {
    sendChange,
    applyChange,
  };
}
