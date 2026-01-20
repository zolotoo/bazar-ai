import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useFlowStore } from '../stores/flowStore';
import { IncomingVideo } from '../types';
import { useAuth } from './useAuth';

interface SavedVideo {
  id: string;
  user_id: string;
  video_id: string;
  shortcode?: string;
  thumbnail_url?: string;
  video_url?: string;
  caption?: string;
  owner_username?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  taken_at?: number;
  added_at: string;
}

/**
 * Хук для работы с сохранёнными видео пользователя
 */
export function useInboxVideos() {
  const [videos, setVideos] = useState<IncomingVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { setIncomingVideos } = useFlowStore();
  const { user } = useAuth();
  
  // Получаем user_id из контекста авторизации
  const getUserId = useCallback((): string => {
    if (user?.telegram_username) {
      return `tg-${user.telegram_username}`;
    }
    return 'anonymous';
  }, [user]);

  // Преобразование из БД в IncomingVideo
  const transformVideo = useCallback((video: SavedVideo): IncomingVideo & { 
    view_count?: number; 
    like_count?: number; 
    comment_count?: number;
    owner_username?: string;
  } => ({
    id: video.id,
    title: video.caption || 'Без названия',
    previewUrl: video.thumbnail_url || '',
    url: video.video_url || `https://instagram.com/reel/${video.shortcode}`,
    receivedAt: new Date(video.added_at),
    view_count: video.view_count,
    like_count: video.like_count,
    comment_count: video.comment_count,
    owner_username: video.owner_username,
  }), []);

  // Загрузка видео пользователя
  const fetchVideos = useCallback(async () => {
    const userId = getUserId();
    console.log('[InboxVideos] Fetching videos for user:', userId);
    
    try {
      const { data, error: fetchError } = await supabase
        .from('saved_videos')
        .select('*')
        .eq('user_id', userId)
        .order('added_at', { ascending: false });

      console.log('[InboxVideos] Fetch result:', { count: data?.length, error: fetchError });

      if (fetchError) {
        console.error('Error fetching saved videos:', fetchError);
        setVideos([]);
        setIncomingVideos([]);
      } else if (data) {
        const transformedVideos = data.map(transformVideo);
        setVideos(transformedVideos);
        setIncomingVideos(transformedVideos);
        console.log('[InboxVideos] Loaded', transformedVideos.length, 'videos');
      }
    } catch (err) {
      console.error('Error loading saved videos:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch videos'));
    } finally {
      setLoading(false);
    }
  }, [setIncomingVideos, transformVideo, getUserId]);

  // Перезагружаем видео при смене пользователя
  useEffect(() => {
    if (user) {
      fetchVideos();
    }
  }, [user, fetchVideos]);

  /**
   * Добавляет видео в сохранённые
   */
  const addVideoToInbox = useCallback(async (video: {
    title: string;
    previewUrl: string;
    url: string;
    viewCount?: number;
    likeCount?: number;
    commentCount?: number;
    ownerUsername?: string;
    shortcode?: string;
    videoId?: string;
  }) => {
    const userId = getUserId();
    const videoId = video.videoId || video.shortcode || `video-${Date.now()}`;
    
    // Создаём локальное видео сразу для быстрого UI
    const localVideo: IncomingVideo & { 
      view_count?: number; 
      like_count?: number; 
      comment_count?: number;
      owner_username?: string;
    } = {
      id: `local-${Date.now()}`,
      title: video.title,
      previewUrl: video.previewUrl,
      url: video.url,
      receivedAt: new Date(),
      view_count: video.viewCount,
      like_count: video.likeCount,
      comment_count: video.commentCount,
      owner_username: video.ownerUsername,
    };

    // Оптимистичное обновление UI
    setVideos(prev => [localVideo, ...prev]);
    setIncomingVideos([localVideo, ...useFlowStore.getState().incomingVideos]);

    try {
      const { data, error: insertError } = await supabase
        .from('saved_videos')
        .upsert({
          user_id: userId,
          video_id: videoId,
          shortcode: video.shortcode,
          thumbnail_url: video.previewUrl,
          video_url: video.url,
          caption: video.title,
          owner_username: video.ownerUsername,
          view_count: video.viewCount,
          like_count: video.likeCount,
          comment_count: video.commentCount,
        }, {
          onConflict: 'user_id,video_id'
        })
        .select()
        .single();

      if (insertError) {
        console.error('Error saving video:', insertError);
        return localVideo;
      }

      if (data) {
        const savedVideo = transformVideo(data);
        // Заменяем локальное видео на сохранённое
        setVideos(prev => [savedVideo, ...prev.filter(v => v.id !== localVideo.id)]);
        setIncomingVideos([savedVideo, ...useFlowStore.getState().incomingVideos.filter(v => v.id !== localVideo.id)]);
        return savedVideo;
      }

      return localVideo;
    } catch (err) {
      console.error('Error saving video:', err);
      return localVideo;
    }
  }, [setIncomingVideos, transformVideo, getUserId]);

  /**
   * Удаляет видео из сохранённых
   */
  const removeVideo = useCallback(async (videoId: string) => {
    const userId = getUserId();
    
    // Оптимистичное удаление
    setVideos(prev => prev.filter(v => v.id !== videoId));
    setIncomingVideos(useFlowStore.getState().incomingVideos.filter(v => v.id !== videoId));

    try {
      await supabase
        .from('saved_videos')
        .delete()
        .eq('user_id', userId)
        .eq('id', videoId);
    } catch (err) {
      console.error('Error removing video:', err);
    }
  }, [setIncomingVideos, getUserId]);

  /**
   * Для совместимости со старым кодом
   */
  const markVideoAsOnCanvas = useCallback(async (videoId: string) => {
    // Просто удаляем из списка входящих
    setVideos(prev => prev.filter(v => v.id !== videoId));
    setIncomingVideos(useFlowStore.getState().incomingVideos.filter(v => v.id !== videoId));
  }, [setIncomingVideos]);

  return {
    videos,
    loading,
    error,
    addVideoToInbox,
    removeVideo,
    markVideoAsOnCanvas,
    refetch: fetchVideos,
    isConfigured: true,
  };
}
