import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, setUserContext } from '../utils/supabase';
import { useAuth } from './useAuth';

export interface ProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: 'read' | 'write' | 'admin';
  invited_by: string;
  invited_at: string;
  joined_at: string | null;
  status: 'pending' | 'active' | 'removed';
  created_at: string;
  updated_at: string;
}

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
 * Хук для управления участниками проекта
 */
export function useProjectMembers(projectId: string | null) {
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { user } = useAuth();

  const userId = user?.telegram_username ? `tg-${user.telegram_username}` : null;

  // Загрузка участников проекта
  const fetchMembers = useCallback(async () => {
    if (!projectId || !userId) {
      setLoading(false);
      return;
    }

    try {
      // Устанавливаем контекст пользователя для RLS
      await setUserContext(userId);
      
      const { data, error: fetchError } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .in('status', ['active', 'pending'])
        .order('joined_at', { ascending: false, nullsFirst: false });

      if (fetchError) {
        // Если таблица не существует, просто возвращаем пустой массив
        if (fetchError.code === 'PGRST116' || fetchError.message?.includes('relation') || fetchError.message?.includes('does not exist')) {
          console.warn('[ProjectMembers] Table project_members does not exist. Please run the migration.');
          setMembers([]);
          setLoading(false);
          return;
        }
        throw fetchError;
      }

      setMembers(data || []);
    } catch (err) {
      console.error('Error fetching project members:', err);
      // Graceful fallback - если таблица не существует, просто показываем пустой список
      if (err instanceof Error && (err.message?.includes('relation') || err.message?.includes('does not exist'))) {
        setMembers([]);
      } else {
        setError(err instanceof Error ? err : new Error('Failed to fetch members'));
      }
    } finally {
      setLoading(false);
    }
  }, [projectId, userId]);

  // Приглашение участника через API
  const inviteMember = useCallback(async (
    username: string,
    role: 'read' | 'write' | 'admin' = 'write'
  ) => {
    if (!projectId || !userId) {
      throw new Error('Project ID or user ID is missing');
    }

    const response = await fetch('/api/project/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        username,
        userId,
        role,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to invite member');
    }

    await fetchMembers();
    return await response.json();
  }, [projectId, userId, fetchMembers]);

  // Удаление участника через API
  const removeMember = useCallback(async (memberId: string) => {
    if (!projectId || !userId) {
      throw new Error('Project ID or user ID is missing');
    }

    const response = await fetch('/api/project/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        memberId,
        userId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to remove member');
    }

    await fetchMembers();
  }, [projectId, userId, fetchMembers]);

  // Изменение роли участника через API
  const updateMemberRole = useCallback(async (
    memberId: string,
    newRole: 'read' | 'write' | 'admin'
  ) => {
    if (!projectId || !userId) {
      throw new Error('Project ID or user ID is missing');
    }

    const response = await fetch('/api/project/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        projectId,
        memberId,
        role: newRole,
        userId,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update member role');
    }

    await fetchMembers();
  }, [projectId, userId, fetchMembers]);

  // Принятие приглашения
  const acceptInvitation = useCallback(async (memberId: string) => {
    if (!userId) {
      throw new Error('User ID is missing');
    }

    const { error: acceptError } = await supabase
      .from('project_members')
      .update({ 
        status: 'active',
        joined_at: new Date().toISOString(),
      })
      .eq('id', memberId)
      .eq('user_id', userId);

    if (acceptError) {
      throw acceptError;
    }

    await fetchMembers();
  }, [userId, fetchMembers]);

  // Загрузка при монтировании и смене проекта
  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Синхронизация в реальном времени: слушаем событие members-updated
  useEffect(() => {
    const handleMembersUpdated = (event: CustomEvent<{ projectId: string }>) => {
      if (event.detail?.projectId === projectId) {
        fetchMembers();
      }
    };
    window.addEventListener('members-updated', handleMembersUpdated as EventListener);
    return () => window.removeEventListener('members-updated', handleMembersUpdated as EventListener);
  }, [projectId, fetchMembers]);

  // Прямая подписка на изменения project_members (если таблица в realtime)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  useEffect(() => {
    if (!projectId || !userId) return;

    const channel = supabase
      .channel(`project_members:${projectId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'project_members',
          filter: `project_id=eq.${projectId}`,
        },
        () => {
          fetchMembers();
        }
      )
      .subscribe((_status, err) => {
        if (err && !err.message?.includes('relation') && !err.message?.includes('does not exist')) {
          console.warn('[ProjectMembers] Realtime subscription error:', err);
        }
      });

    channelRef.current = channel;
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [projectId, userId, fetchMembers]);

  return {
    members,
    loading,
    error,
    inviteMember,
    removeMember,
    updateMemberRole,
    acceptInvitation,
    refetch: fetchMembers,
  };
}
