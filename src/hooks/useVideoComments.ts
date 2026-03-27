import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

export interface VideoComment {
  id: string;
  video_id: string;
  project_id?: string;
  user_id: string;
  username?: string;
  content: string;
  created_at: string;
}

export function useVideoComments(videoId: string | null) {
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const { user } = useAuth();

  const load = useCallback(async () => {
    if (!videoId) return;
    setLoading(true);
    const { data } = await supabase
      .from('video_comments')
      .select('*')
      .eq('video_id', videoId)
      .order('created_at', { ascending: true });
    setComments(data || []);
    setLoading(false);
  }, [videoId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!videoId) return;
    const channel = supabase
      .channel(`video_comments:${videoId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'video_comments', filter: `video_id=eq.${videoId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setComments((prev) => [...prev, payload.new as VideoComment]);
          } else if (payload.eventType === 'DELETE') {
            setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
          }
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [videoId]);

  const addComment = useCallback(async (content: string, projectId?: string): Promise<boolean> => {
    if (!videoId || !content.trim() || !user) return false;
    setIsAdding(true);
    const username =
      user.telegram_username
        ? `@${user.telegram_username}`
        : user.email
        ? user.email.split('@')[0]
        : 'Аноним';
    const { error } = await supabase.from('video_comments').insert({
      video_id: videoId,
      project_id: projectId || null,
      user_id: user.id,
      username,
      content: content.trim(),
    });
    setIsAdding(false);
    return !error;
  }, [videoId, user]);

  const deleteComment = useCallback(async (commentId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('video_comments')
      .delete()
      .eq('id', commentId);
    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    }
    return !error;
  }, []);

  return { comments, loading, isAdding, addComment, deleteComment, reload: load };
}
