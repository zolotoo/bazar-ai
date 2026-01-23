import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useFlowStore } from '../stores/flowStore';
import { IncomingVideo } from '../types';
import { useAuth } from './useAuth';
import { useProjectContext } from '../contexts/ProjectContext';
import { toast } from 'sonner';
import { 
  getOrCreateGlobalVideo, 
  getTranscriptionByShortcode,
  startGlobalTranscription,
} from '../services/globalVideoService';

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
  // Транскрибация и перевод
  download_url?: string;
  transcript_id?: string;
  transcript_status?: string;
  transcript_text?: string;
  translation_text?: string;
  // Сценарий
  script_text?: string;
  // Проекты
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
  const { currentProjectId } = useProjectContext();
  
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
    translation_text?: string;
    script_text?: string;
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
    folder_id: video.folder_id || undefined,
    project_id: video.project_id,
    transcript_id: video.transcript_id,
    transcript_status: video.transcript_status,
    transcript_text: video.transcript_text,
    translation_text: video.translation_text,
    script_text: video.script_text,
    download_url: video.download_url,
    taken_at: video.taken_at,
  }), []);

  // Загрузка видео пользователя
  const fetchVideos = useCallback(async () => {
    const userId = getUserId();
    console.log('[InboxVideos] Fetching videos for user:', userId, 'project:', currentProjectId);
    
    try {
      let query = supabase
        .from('saved_videos')
        .select('*')
        .eq('user_id', userId);
      
      // Фильтруем по проекту если он выбран
      if (currentProjectId) {
        query = query.eq('project_id', currentProjectId);
      }
      
      const { data, error: fetchError } = await query
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

  // Перезагружаем видео при смене пользователя или проекта
  useEffect(() => {
    if (user) {
      fetchVideos();
    }
  }, [user, currentProjectId, fetchVideos]);

  /**
   * Добавляет видео в сохранённые
   * Использует глобальную таблицу videos для транскрибаций
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
    
    // Извлекаем shortcode из URL если его нет
    const shortcode = video.shortcode || extractShortcode(video.url) || undefined;
    const videoId = video.videoId || shortcode || `video-${Date.now()}`;
    
    console.log('[InboxVideos] Adding video:', { 
      userId, 
      videoId, 
      shortcode,
      projectId: video.projectId, 
      folderId: video.folderId,
      url: video.url 
    });
    
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
      // 1. СНАЧАЛА проверяем/создаём видео в ГЛОБАЛЬНОЙ таблице videos
      let globalVideo = null;
      let existingTranscription = null;
      
      if (shortcode) {
        // Проверяем есть ли уже транскрибация
        existingTranscription = await getTranscriptionByShortcode(shortcode);
        console.log('[InboxVideos] Existing transcription check:', existingTranscription);
        
        // Получаем или создаём глобальное видео
        globalVideo = await getOrCreateGlobalVideo({
          shortcode,
          url: video.url,
          thumbnailUrl: video.previewUrl,
          caption: video.title,
          ownerUsername: video.ownerUsername,
          viewCount: video.viewCount,
          likeCount: video.likeCount,
          commentCount: video.commentCount,
          takenAt: takenAtTimestamp,
        });
        
        console.log('[InboxVideos] Global video:', globalVideo?.id, 'transcript:', globalVideo?.transcript_status);
      }
      
      // 2. Проверяем есть ли у ПОЛЬЗОВАТЕЛЯ это видео
      let existingUserVideo = null;
      if (shortcode) {
        const { data: existing } = await supabase
          .from('saved_videos')
          .select('id, transcript_status, transcript_text')
          .eq('user_id', userId)
          .eq('shortcode', shortcode)
          .maybeSingle();
        existingUserVideo = existing;
      }
      
      let data;
      let error;
      let needsTranscription = true;
      
      if (existingUserVideo) {
        // 3a. Обновляем существующее видео пользователя
        console.log('[InboxVideos] User video exists, updating:', existingUserVideo.id);
        
        // Если у пользователя нет транскрибации, но есть в глобальной - копируем
        const updateData: Record<string, unknown> = {
          thumbnail_url: video.previewUrl,
          video_url: video.url,
          caption: video.title,
          owner_username: video.ownerUsername,
          view_count: video.viewCount,
          like_count: video.likeCount,
          comment_count: video.commentCount,
          project_id: video.projectId,
          folder_id: video.folderId || null,
          taken_at: takenAtTimestamp,
        };
        
        // Копируем транскрибацию из глобальной таблицы если есть
        if (existingTranscription?.hasTranscription) {
          updateData.transcript_status = existingTranscription.transcriptStatus;
          updateData.transcript_text = existingTranscription.transcriptText;
          needsTranscription = false;
          console.log('[InboxVideos] Copying transcription from global DB');
        } else if (existingUserVideo.transcript_status === 'completed') {
          needsTranscription = false;
        }
        
        const result = await supabase
          .from('saved_videos')
          .update(updateData)
          .eq('id', existingUserVideo.id)
          .select()
          .single();
        data = result.data;
        error = result.error;
        
      } else {
        // 3b. Создаём новое видео для пользователя
        console.log('[InboxVideos] Creating new user video');
        
        const insertData: Record<string, unknown> = {
          user_id: userId,
          video_id: videoId,
          shortcode: shortcode,
          thumbnail_url: video.previewUrl,
          video_url: video.url,
          caption: video.title,
          owner_username: video.ownerUsername,
          view_count: video.viewCount,
          like_count: video.likeCount,
          comment_count: video.commentCount,
          project_id: video.projectId,
          folder_id: video.folderId || null,
          taken_at: takenAtTimestamp,
        };
        
        // Копируем транскрибацию из глобальной таблицы если есть
        if (existingTranscription?.hasTranscription) {
          insertData.transcript_status = existingTranscription.transcriptStatus;
          insertData.transcript_text = existingTranscription.transcriptText;
          needsTranscription = false;
          console.log('[InboxVideos] Copying transcription from global DB to new user video');
        }
        
        const result = await supabase
          .from('saved_videos')
          .insert(insertData)
          .select()
          .single();
        data = result.data;
        error = result.error;
      }

      if (error) {
        console.error('[InboxVideos] Error saving video:', error);
        return localVideo;
      }

      if (data) {
        const savedVideo = transformVideo(data);
        // Заменяем локальное видео на сохранённое
        setVideos(prev => [savedVideo, ...prev.filter(v => v.id !== localVideo.id)]);
        setIncomingVideos([savedVideo, ...useFlowStore.getState().incomingVideos.filter(v => v.id !== localVideo.id)]);
        
        // 4. Запускаем транскрибацию ТОЛЬКО если нет готовой
        if (needsTranscription && shortcode) {
          console.log('[InboxVideos] Starting new transcription');
          startGlobalTranscription(
            data.id,
            globalVideo?.id,
            shortcode,
            video.url
          );
        } else {
          console.log('[InboxVideos] Skipping transcription - already exists');
          if (existingTranscription?.hasTranscription) {
            toast.success('Транскрибация найдена', {
              description: 'Видео уже было обработано ранее',
            });
          }
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
   * Ручной запуск транскрибации (для кнопки "Транскрибировать")
   * Использует глобальный сервис
   */
  const startVideoProcessing = useCallback(async (videoDbId: string, instagramUrl: string) => {
    console.log('[InboxVideos] Manual transcription request for:', instagramUrl);
    
    const shortcode = extractShortcode(instagramUrl);
    
    // Сначала проверяем есть ли уже транскрибация в глобальной таблице
    if (shortcode) {
      const existing = await getTranscriptionByShortcode(shortcode);
      
      if (existing.hasTranscription) {
        console.log('[InboxVideos] Found existing transcription in global DB');
        
        // Копируем к пользователю
        await supabase
          .from('saved_videos')
          .update({
            transcript_status: existing.transcriptStatus,
            transcript_text: existing.transcriptText,
          })
          .eq('id', videoDbId);
        
        toast.success('Транскрибация найдена', {
          description: 'Видео уже было обработано ранее',
        });
        
        fetchVideos();
        return;
      }
      
      // Получаем или создаём глобальное видео
      const globalVideo = await getOrCreateGlobalVideo({
        shortcode,
        url: instagramUrl,
      });
      
      // Запускаем глобальную транскрибацию
      toast.success('Видео обрабатывается', {
        description: 'Транскрибация запущена',
      });
      
      startGlobalTranscription(videoDbId, globalVideo?.id, shortcode, instagramUrl);
    } else {
      console.error('[InboxVideos] No shortcode found for:', instagramUrl);
      toast.error('Не удалось определить видео');
    }
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
   * Возвращает данные удаленного видео для возможности отмены
   */
  const removeVideo = useCallback(async (videoId: string) => {
    const userId = getUserId();
    
    // Сохраняем данные видео перед удалением (для отмены)
    const videoToDelete = videos.find(v => v.id === videoId);
    const videoData = videoToDelete ? {
      id: videoToDelete.id,
      title: videoToDelete.title,
      previewUrl: videoToDelete.previewUrl,
      url: videoToDelete.url,
      view_count: (videoToDelete as any).view_count,
      like_count: (videoToDelete as any).like_count,
      comment_count: (videoToDelete as any).comment_count,
      owner_username: (videoToDelete as any).owner_username,
      folder_id: (videoToDelete as any).folder_id,
      project_id: (videoToDelete as any).project_id,
      taken_at: (videoToDelete as any).taken_at,
      transcript_text: (videoToDelete as any).transcript_text,
      translation_text: (videoToDelete as any).translation_text,
      script_text: (videoToDelete as any).script_text,
    } : null;
    
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
      // Восстанавливаем при ошибке
      if (videoToDelete) {
        setVideos(prev => [...prev, videoToDelete]);
      }
    }
    
    return videoData;
  }, [setIncomingVideos, getUserId, videos]);

  /**
   * Восстановить удаленное видео
   */
  const restoreVideo = useCallback(async (videoData: any) => {
    const userId = getUserId();
    
    if (!videoData) return false;
    
    try {
      // Восстанавливаем в БД
      const { error } = await supabase
        .from('saved_videos')
        .insert({
          id: videoData.id,
          user_id: userId,
          video_id: videoData.id, // Используем id как video_id
          shortcode: extractShortcode(videoData.url),
          thumbnail_url: videoData.previewUrl,
          video_url: videoData.url,
          caption: videoData.title,
          owner_username: videoData.owner_username,
          view_count: videoData.view_count,
          like_count: videoData.like_count,
          comment_count: videoData.comment_count,
          folder_id: videoData.folder_id,
          project_id: videoData.project_id,
          taken_at: videoData.taken_at,
          transcript_text: videoData.transcript_text,
          translation_text: videoData.translation_text,
          script_text: videoData.script_text,
        });
      
      if (error) {
        console.error('Error restoring video:', error);
        return false;
      }
      
      // Перезагружаем видео
      await fetchVideos();
      return true;
    } catch (err) {
      console.error('Error restoring video:', err);
      return false;
    }
  }, [getUserId, fetchVideos]);

  // Вспомогательная функция для извлечения shortcode
  const extractShortcode = (url: string): string | undefined => {
    const match = url.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/);
    return match ? match[2] : undefined;
  };

  /**
   * Для совместимости со старым кодом
   */
  const markVideoAsOnCanvas = useCallback(async (videoId: string) => {
    // Просто удаляем из списка входящих
    setVideos(prev => prev.filter(v => v.id !== videoId));
    setIncomingVideos(useFlowStore.getState().incomingVideos.filter(v => v.id !== videoId));
  }, [setIncomingVideos]);

  /**
   * Обновляет сценарий видео
   */
  const updateVideoScript = useCallback(async (videoId: string, scriptText: string) => {
    try {
      const { error } = await supabase
        .from('saved_videos')
        .update({ script_text: scriptText })
        .eq('id', videoId);
      
      if (error) {
        console.error('Error updating video script:', error);
        return false;
      }
      
      // Обновляем локальное состояние
      setVideos(prev => prev.map(v => 
        v.id === videoId ? { ...v, script_text: scriptText } as any : v
      ));
      
      return true;
    } catch (err) {
      console.error('Error updating video script:', err);
      return false;
    }
  }, []);

  /**
   * Обновляет транскрипцию видео
   * Синхронизирует с глобальной таблицей videos
   */
  const updateVideoTranscript = useCallback(async (videoId: string, transcriptText: string) => {
    try {
      // 1. Получаем shortcode видео
      const { data: video } = await supabase
        .from('saved_videos')
        .select('shortcode')
        .eq('id', videoId)
        .single();
      
      const shortcode = video?.shortcode;
      
      // 2. Обновляем у пользователя
      const { error } = await supabase
        .from('saved_videos')
        .update({ 
          transcript_text: transcriptText,
          transcript_status: 'completed',
        })
        .eq('id', videoId);
      
      if (error) {
        console.error('Error updating video transcript:', error);
        return false;
      }
      
      // 3. Обновляем в глобальной таблице
      if (shortcode) {
        await supabase
          .from('videos')
          .update({ 
            transcript_text: transcriptText,
            transcript_status: 'completed',
          })
          .eq('shortcode', shortcode);
        
        console.log('[InboxVideos] Synced transcript to global table for:', shortcode);
      }
      
      // 4. Обновляем локальное состояние
      setVideos(prev => prev.map(v => 
        v.id === videoId ? { ...v, transcript_text: transcriptText, transcript_status: 'completed' } as any : v
      ));
      
      return true;
    } catch (err) {
      console.error('Error updating video transcript:', err);
      return false;
    }
  }, []);

  return {
    videos,
    loading,
    error,
    addVideoToInbox,
    removeVideo,
    updateVideoFolder,
    updateVideoScript,
    updateVideoTranscript,
    restoreVideo,
    startVideoProcessing, // Ручной запуск транскрибации
    markVideoAsOnCanvas,
    refetch: fetchVideos,
    isConfigured: true,
  };
}
