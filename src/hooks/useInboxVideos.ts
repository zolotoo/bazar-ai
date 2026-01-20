import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useFlowStore } from '../stores/flowStore';
import { IncomingVideo } from '../types';
import { useAuth } from './useAuth';
import { downloadAndTranscribe, checkTranscriptionStatus } from '../services/transcriptionService';
import { toast } from 'sonner';

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
  // Новые поля для транскрибации
  download_url?: string;
  transcript_id?: string;
  transcript_status?: string;
  transcript_text?: string;
  // Новые поля для проектов
  project_id?: string;
  folder_id?: string;
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
    folder_id?: string;
    project_id?: string;
    transcript_id?: string;
    transcript_status?: string;
    transcript_text?: string;
    download_url?: string;
    taken_at?: number;
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
    folder_id: video.folder_id || 'inbox',
    project_id: video.project_id,
    transcript_id: video.transcript_id,
    transcript_status: video.transcript_status,
    transcript_text: video.transcript_text,
    download_url: video.download_url,
    taken_at: video.taken_at,
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
    projectId?: string;
    folderId?: string;
    takenAt?: string | number;
  }) => {
    const userId = getUserId();
    const videoId = video.videoId || video.shortcode || `video-${Date.now()}`;
    
    // Конвертируем taken_at в число (unix timestamp)
    let takenAtTimestamp: number | undefined;
    if (video.takenAt) {
      if (typeof video.takenAt === 'number') {
        takenAtTimestamp = video.takenAt > 1e12 ? Math.floor(video.takenAt / 1000) : video.takenAt;
      } else if (typeof video.takenAt === 'string') {
        const ts = Number(video.takenAt);
        if (!isNaN(ts)) {
          takenAtTimestamp = ts > 1e12 ? Math.floor(ts / 1000) : ts;
        }
      }
    }
    
    // Создаём локальное видео сразу для быстрого UI
    const localVideo: IncomingVideo & { 
      view_count?: number; 
      like_count?: number; 
      comment_count?: number;
      owner_username?: string;
      taken_at?: number;
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
      taken_at: takenAtTimestamp,
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
          project_id: video.projectId,
          folder_id: video.folderId || 'inbox',
          taken_at: takenAtTimestamp,
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
        
        // Запускаем скачивание и транскрибацию только для папки "Идеи"
        if (video.folderId === 'ideas') {
          startVideoProcessing(data.id, video.url);
        }
        
        return savedVideo;
      }

      return localVideo;
    } catch (err) {
      console.error('Error saving video:', err);
      return localVideo;
    }
  }, [setIncomingVideos, transformVideo, getUserId]);

  /**
   * Запускает скачивание и транскрибацию видео в фоне
   */
  const startVideoProcessing = useCallback(async (videoDbId: string, instagramUrl: string) => {
    console.log('[InboxVideos] Starting video processing for:', instagramUrl);
    
    try {
      // Обновляем статус
      await supabase
        .from('saved_videos')
        .update({ transcript_status: 'downloading' })
        .eq('id', videoDbId);
      
      // Получаем ссылку на скачивание и запускаем транскрибацию
      const result = await downloadAndTranscribe(instagramUrl);
      
      if (!result.success) {
        console.error('[InboxVideos] Video processing failed:', result.error);
        await supabase
          .from('saved_videos')
          .update({ transcript_status: 'error' })
          .eq('id', videoDbId);
        return;
      }
      
      // Сохраняем данные о скачивании и транскрибации
      await supabase
        .from('saved_videos')
        .update({ 
          download_url: result.videoUrl,
          transcript_id: result.transcriptId,
          transcript_status: 'processing',
        })
        .eq('id', videoDbId);
      
      toast.success('Видео обрабатывается', {
        description: 'Транскрибация запущена',
      });
      
      // Запускаем проверку статуса транскрибации
      if (result.transcriptId) {
        pollTranscriptionStatus(videoDbId, result.transcriptId);
      }
    } catch (err) {
      console.error('[InboxVideos] Video processing error:', err);
    }
  }, []);

  /**
   * Проверяет статус транскрибации с polling
   */
  const pollTranscriptionStatus = useCallback(async (videoDbId: string, transcriptId: string) => {
    const maxAttempts = 60; // 5 минут при интервале 5 сек
    let attempts = 0;
    
    const checkStatus = async () => {
      attempts++;
      
      try {
        const result = await checkTranscriptionStatus(transcriptId);
        
        if (result.status === 'completed') {
          // Сохраняем результат
          await supabase
            .from('saved_videos')
            .update({ 
              transcript_status: 'completed',
              transcript_text: result.text,
            })
            .eq('id', videoDbId);
          
          toast.success('Транскрибация завершена', {
            description: result.text?.slice(0, 50) + '...',
          });
          
          // Обновляем локальный список
          fetchVideos();
          return;
        }
        
        if (result.status === 'error') {
          await supabase
            .from('saved_videos')
            .update({ transcript_status: 'error' })
            .eq('id', videoDbId);
          
          toast.error('Ошибка транскрибации');
          return;
        }
        
        // Продолжаем проверку
        if (attempts < maxAttempts) {
          setTimeout(checkStatus, 5000);
        } else {
          await supabase
            .from('saved_videos')
            .update({ transcript_status: 'timeout' })
            .eq('id', videoDbId);
        }
      } catch (err) {
        console.error('[InboxVideos] Poll error:', err);
      }
    };
    
    // Первая проверка через 10 секунд
    setTimeout(checkStatus, 10000);
  }, [fetchVideos]);

  /**
   * Обновляет папку видео
   */
  const updateVideoFolder = useCallback(async (videoId: string, newFolderId: string) => {
    const userId = getUserId();
    
    // Оптимистичное обновление
    setVideos(prev => prev.map(v => 
      v.id === videoId ? { ...v, folder_id: newFolderId } as any : v
    ));

    try {
      const { error } = await supabase
        .from('saved_videos')
        .update({ folder_id: newFolderId })
        .eq('user_id', userId)
        .eq('id', videoId);
      
      if (error) {
        console.error('Error updating video folder:', error);
        // Откатываем изменения
        fetchVideos();
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Error updating video folder:', err);
      fetchVideos();
      return false;
    }
  }, [getUserId, fetchVideos]);

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
    updateVideoFolder,
    markVideoAsOnCanvas,
    refetch: fetchVideos,
    isConfigured: true,
  };
}
