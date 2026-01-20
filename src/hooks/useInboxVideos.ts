import { useEffect, useState } from 'react';
import { supabase, InboxVideo } from '../utils/supabase';
import { useFlowStore } from '../stores/flowStore';
import { IncomingVideo } from '../types';

// Проверяем, настроен ли Supabase
const isSupabaseConfigured = () => {
  const url = import.meta.env.VITE_SUPABASE_URL || '';
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
  return !!(url && key && url !== 'https://placeholder.supabase.co');
};

/**
 * Хук для подписки на таблицу inbox_videos в реальном времени
 * Автоматически обновляет список входящих видео при изменениях в Supabase
 */
export function useInboxVideos() {
  const [videos, setVideos] = useState<IncomingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { setIncomingVideos } = useFlowStore();

  useEffect(() => {
    // Если Supabase не настроен, просто возвращаем пустой список
    if (!isSupabaseConfigured()) {
      console.log('Supabase not configured, using empty video list');
      setVideos([]);
      setIncomingVideos([]);
      setLoading(false);
      return;
    }

    // Функция для преобразования InboxVideo в IncomingVideo
    const transformVideo = (video: InboxVideo): IncomingVideo & { view_count?: number; like_count?: number; comment_count?: number } => ({
      id: video.id,
      title: video.title,
      previewUrl: video.preview_url,
      url: video.url,
      receivedAt: new Date(video.created_at),
      view_count: video.view_count,
      like_count: video.like_count,
      comment_count: video.comment_count,
    });

    // Загружаем начальные данные
    const fetchVideos = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('inbox_videos')
          .select('*')
          .eq('status', 'pending')
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        const transformedVideos = (data || []).map(transformVideo);
        setVideos(transformedVideos);
        setIncomingVideos(transformedVideos);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching inbox videos:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch videos'));
        setLoading(false);
      }
    };

    fetchVideos();

    // Подписываемся на изменения в реальном времени
    let channel: any;
    try {
      channel = supabase
        .channel('inbox_videos_changes')
        .on(
          'postgres_changes',
          {
            event: '*', // Подписываемся на все события (INSERT, UPDATE, DELETE)
            schema: 'public',
            table: 'inbox_videos',
            filter: 'status=eq.pending', // Только видео со статусом pending
          },
          (payload) => {
            console.log('Supabase real-time event:', payload);

            if (payload.eventType === 'INSERT') {
              const newVideo = transformVideo(payload.new as InboxVideo);
              setVideos((prev) => [newVideo, ...prev]);
              setIncomingVideos([newVideo, ...useFlowStore.getState().incomingVideos]);
            } else if (payload.eventType === 'UPDATE') {
              const updatedVideo = payload.new as InboxVideo;
              if (updatedVideo.status === 'on_canvas') {
                // Видео переместили на холст - удаляем из списка
                setVideos((prev) => prev.filter((v) => v.id !== updatedVideo.id));
                setIncomingVideos(
                  useFlowStore.getState().incomingVideos.filter((v) => v.id !== updatedVideo.id)
                );
              } else {
                // Обновляем существующее видео
                const transformedVideo = transformVideo(updatedVideo);
                setVideos((prev) =>
                  prev.map((v) => (v.id === transformedVideo.id ? transformedVideo : v))
                );
                setIncomingVideos(
                  useFlowStore.getState().incomingVideos.map((v) =>
                    v.id === transformedVideo.id ? transformedVideo : v
                  )
                );
              }
            } else if (payload.eventType === 'DELETE') {
              const deletedId = payload.old.id;
              setVideos((prev) => prev.filter((v) => v.id !== deletedId));
              setIncomingVideos(
                useFlowStore.getState().incomingVideos.filter((v) => v.id !== deletedId)
              );
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('Failed to subscribe to Supabase real-time updates:', err);
    }

    return () => {
      if (channel && channel.unsubscribe) {
        channel.unsubscribe();
      }
    };
  }, [setIncomingVideos]);

  /**
   * Обновляет статус видео на 'on_canvas' в Supabase
   */
  const markVideoAsOnCanvas = async (videoId: string) => {
    if (!isSupabaseConfigured()) {
      console.log('Supabase not configured, skipping status update');
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('inbox_videos')
        .update({ status: 'on_canvas', updated_at: new Date().toISOString() })
        .eq('id', videoId);

      if (updateError) {
        throw updateError;
      }
    } catch (err) {
      console.error('Error updating video status:', err);
      throw err;
    }
  };

  /**
   * Добавляет новое видео в Supabase
   */
  const addVideoToInbox = async (video: {
    title: string;
    previewUrl: string;
    url: string;
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;
    ownerUsername?: string;
  }) => {
    // Создаём локальное видео сразу
    const localVideo: IncomingVideo & { view_count?: number; like_count?: number; comment_count?: number } = {
      id: `local-${Date.now()}`,
      title: video.title,
      previewUrl: video.previewUrl,
      url: video.url,
      receivedAt: new Date(),
      view_count: video.viewCount,
      like_count: video.likeCount,
      comment_count: video.commentCount,
    };
    
    if (!isSupabaseConfigured()) {
      console.log('Supabase not configured, adding to local store only');
      setVideos(prev => [localVideo, ...prev]);
      setIncomingVideos([localVideo, ...useFlowStore.getState().incomingVideos]);
      return localVideo;
    }

    try {
      const { data, error: insertError } = await supabase
        .from('inbox_videos')
        .insert({
          title: video.title,
          preview_url: video.previewUrl,
          url: video.url,
          status: 'pending',
          view_count: video.viewCount,
          like_count: video.likeCount,
          comment_count: video.commentCount,
          owner_username: video.ownerUsername,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Supabase insert error, using local:', insertError);
        // При ошибке добавляем локально
        setVideos(prev => [localVideo, ...prev]);
        setIncomingVideos([localVideo, ...useFlowStore.getState().incomingVideos]);
        return localVideo;
      }

      console.log('Video saved to Supabase:', data);
      
      // Real-time подписка обновит список автоматически,
      // но на всякий случай добавим и локально
      if (data) {
        const newVideo: IncomingVideo & { view_count?: number; like_count?: number; comment_count?: number } = {
          id: data.id,
          title: data.title,
          previewUrl: data.preview_url,
          url: data.url,
          receivedAt: new Date(data.created_at),
          view_count: data.view_count,
          like_count: data.like_count,
          comment_count: data.comment_count,
        };
        // Добавляем локально чтобы UI обновился сразу
        setVideos(prev => [newVideo, ...prev.filter(v => v.id !== newVideo.id)]);
        setIncomingVideos([newVideo, ...useFlowStore.getState().incomingVideos.filter(v => v.id !== newVideo.id)]);
        return newVideo;
      }
      
      return localVideo;
    } catch (err) {
      console.error('Error saving video to Supabase:', err);
      // При любой ошибке добавляем локально
      setVideos(prev => [localVideo, ...prev]);
      setIncomingVideos([localVideo, ...useFlowStore.getState().incomingVideos]);
      return localVideo;
    }
  };

  return {
    videos,
    loading,
    error,
    markVideoAsOnCanvas,
    addVideoToInbox,
    isConfigured: isSupabaseConfigured(),
  };
}
