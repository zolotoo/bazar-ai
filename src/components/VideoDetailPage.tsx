import { useState, useEffect } from 'react';
import { 
  ChevronLeft, Play, Eye, Heart, MessageCircle, Calendar, 
  Sparkles, FileText, Copy, ExternalLink, Loader2, Check,
  Languages, ChevronDown, Mic, Save, RefreshCw
} from 'lucide-react';
import { cn } from '../utils/cn';
import { checkTranscriptionStatus, downloadAndTranscribe } from '../services/transcriptionService';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { useInboxVideos } from '../hooks/useInboxVideos';
import { useProjectContext } from '../contexts/ProjectContext';
import { calculateViralMultiplier, getOrUpdateProfileStats, applyViralMultiplierToCoefficient } from '../services/profileStatsService';

interface VideoData {
  id: string;
  title?: string;
  preview_url?: string;
  url?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  owner_username?: string;
  taken_at?: string | number;
  transcript_id?: string;
  transcript_status?: string;
  transcript_text?: string;
  translation_text?: string; // Перевод
  script_text?: string;
  download_url?: string;
  folder_id?: string;
  draft_link?: string;
  final_link?: string;
  script_responsible?: string;
  editing_responsible?: string;
}

interface VideoDetailPageProps {
  video: VideoData;
  onBack: () => void;
  onRefreshData?: () => Promise<void>;
}

function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Проксирование Instagram изображений через наш API
function proxyImageUrl(url?: string): string {
  if (!url) return 'https://via.placeholder.com/400x600';
  if (url.includes('/api/proxy-image') || url.includes('placeholder.com')) return url;
  if (url.includes('cdninstagram.com') || url.includes('instagram.com')) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function parseDate(dateValue?: string | number): Date | null {
  if (!dateValue) return null;
  
  // Если строка
  if (typeof dateValue === 'string') {
    // ISO формат или дата
    if (dateValue.includes('T') || dateValue.includes('-')) {
      const date = new Date(dateValue);
      if (!isNaN(date.getTime())) return date;
    }
    // Числовой timestamp в строке
    const ts = Number(dateValue);
    if (!isNaN(ts)) {
      // Если > 1e12 - миллисекунды, иначе секунды
      return ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
    }
  }
  
  // Если число
  if (typeof dateValue === 'number') {
    return dateValue > 1e12 ? new Date(dateValue) : new Date(dateValue * 1000);
  }
  
  return null;
}

function formatDate(dateValue?: string | number): string {
  const date = parseDate(dateValue);
  if (!date || isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function calculateViralCoefficient(views?: number, takenAt?: string | number): number {
  if (!views) return 0;
  
  const videoDate = parseDate(takenAt);
  
  // Если нет даты - используем 30 дней по умолчанию
  if (!videoDate || isNaN(videoDate.getTime())) {
    return Math.round((views / 30 / 1000) * 10) / 10;
  }
  
  const daysOld = Math.max(1, Math.floor((Date.now() - videoDate.getTime()) / (1000 * 60 * 60 * 24)));
  
  // K просмотров в день
  return Math.round((views / daysOld / 1000) * 10) / 10;
}

export function VideoDetailPage({ video, onBack, onRefreshData }: VideoDetailPageProps) {
  const [transcriptTab, setTranscriptTab] = useState<'original' | 'translation'>('original');
  const [transcript, setTranscript] = useState(video.transcript_text || '');
  const [translation, setTranslation] = useState(video.translation_text || ''); // Загружаем из БД
  const [transcriptStatus, setTranscriptStatus] = useState(video.transcript_status || 'pending');
  const [script, setScript] = useState(video.script_text || '');
  const [isTranslating, setIsTranslating] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(video.folder_id || null);
  const [isStartingTranscription, setIsStartingTranscription] = useState(false);
  const [localTranscriptId, setLocalTranscriptId] = useState(video.transcript_id);
  const [directVideoUrl, setDirectVideoUrl] = useState<string | null>(video.download_url || null);
  const [isLoadingVideo, setIsLoadingVideo] = useState(false);
  const [isSavingScript, setIsSavingScript] = useState(false);
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);
  const [viralMultiplier, setViralMultiplier] = useState<number | null>(null);
  const [isCalculatingViral, setIsCalculatingViral] = useState(false);
  const [draftLink, setDraftLink] = useState(video.draft_link || '');
  const [finalLink, setFinalLink] = useState(video.final_link || '');
  const [scriptResponsible, setScriptResponsible] = useState(video.script_responsible || '');
  const [editingResponsible, setEditingResponsible] = useState(video.editing_responsible || '');
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const [isSavingResponsible, setIsSavingResponsible] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);
  
  const { updateVideoFolder, updateVideoScript, updateVideoTranscript, updateVideoResponsible, updateVideoLinks } = useInboxVideos();
  
  // Сохранение ссылок (через хук — обновляет БД и локальное состояние)
  const handleSaveLinks = async () => {
    setIsSavingLinks(true);
    const success = await updateVideoLinks(video.id, draftLink, finalLink);
    setIsSavingLinks(false);
    if (success) {
      toast.success('Ссылки сохранены');
    } else {
      toast.error('Ошибка сохранения ссылок. Проверьте, что миграция add_video_fields.sql применена.');
    }
  };
  
  // Сохранение ответственных (через хук — обновляет БД и локальное состояние)
  const handleSaveResponsible = async () => {
    setIsSavingResponsible(true);
    const success = await updateVideoResponsible(video.id, scriptResponsible, editingResponsible);
    setIsSavingResponsible(false);
    if (success) {
      toast.success('Ответственные сохранены');
    } else {
      toast.error('Ошибка сохранения ответственных. Проверьте, что миграция add_video_fields.sql применена.');
    }
  };

  // Обновить данные видео (перезагрузка из БД / API)
  const handleRefreshData = async () => {
    if (!onRefreshData) return;
    setIsRefreshingData(true);
    try {
      await onRefreshData();
      toast.success('Данные обновлены');
    } catch {
      toast.error('Не удалось обновить данные');
    } finally {
      setIsRefreshingData(false);
    }
  };

  const { currentProject } = useProjectContext();
  const viralCoef = calculateViralCoefficient(video.view_count, video.taken_at);
  
  // Применяем множитель к коэффициенту виральности
  const finalViralCoef = applyViralMultiplierToCoefficient(viralCoef, viralMultiplier);
  
  // Получить папки из проекта
  const folderConfigs = currentProject?.folders
    ?.slice()
    .sort((a, b) => a.order - b.order)
    .map(f => ({ id: f.id, title: f.name, color: f.color })) || [];
  
  // Получить текущую папку
  const currentFolder = currentFolderId 
    ? folderConfigs.find(f => f.id === currentFolderId) 
    : null;
  
  // Перемещение в папку
  const handleMoveToFolder = async (folderId: string) => {
    const success = await updateVideoFolder(video.id, folderId);
    if (success) {
      setCurrentFolderId(folderId);
      const folder = folderConfigs.find(f => f.id === folderId);
      toast.success(`Перемещено в "${folder?.title || 'папку'}"`);
    }
    setShowFolderMenu(false);
  };
  
  // Запуск транскрибации вручную
  const handleStartTranscription = async () => {
    if (!video.url) {
      toast.error('URL видео не найден');
      return;
    }
    
    setIsStartingTranscription(true);
    setTranscriptStatus('downloading');
    toast.info('Запускаю транскрибацию...', { description: 'Это займёт несколько минут' });
    
    try {
      // Обновляем статус в базе
      await supabase
        .from('saved_videos')
        .update({ transcript_status: 'downloading' })
        .eq('id', video.id);
      
      // Запускаем скачивание и транскрибацию
      const result = await downloadAndTranscribe(video.url);
      
      if (!result.success) {
        setTranscriptStatus('error');
        toast.error('Ошибка транскрибации', { description: result.error });
        await supabase
          .from('saved_videos')
          .update({ transcript_status: 'error' })
          .eq('id', video.id);
        return;
      }
      
      // Сохраняем данные
      await supabase
        .from('saved_videos')
        .update({ 
          download_url: result.videoUrl,
          transcript_id: result.transcriptId,
          transcript_status: 'processing',
        })
        .eq('id', video.id);
      
      setLocalTranscriptId(result.transcriptId);
      setTranscriptStatus('processing');
      toast.success('Транскрибация запущена', { description: 'Ожидайте результат...' });
      
    } catch (err) {
      console.error('Transcription error:', err);
      setTranscriptStatus('error');
      toast.error('Ошибка при запуске транскрибации');
    } finally {
      setIsStartingTranscription(false);
    }
  };
  
  // Загрузка прямой ссылки на видео
  const handleLoadVideo = async () => {
    if (directVideoUrl) {
      setShowVideo(true);
      return;
    }
    
    if (!video.url) {
      toast.error('URL видео не найден');
      return;
    }
    
    setIsLoadingVideo(true);
    
    try {
      const response = await fetch('/api/download-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: video.url }),
      });
      
      const data = await response.json();
      
      if (data.success && data.videoUrl) {
        setDirectVideoUrl(data.videoUrl);
        setShowVideo(true);
        
        // Сохраняем URL в базу для будущего использования
        await supabase
          .from('saved_videos')
          .update({ download_url: data.videoUrl })
          .eq('id', video.id);
      } else {
        toast.error('Не удалось загрузить видео');
        console.error('Video download failed:', data);
      }
    } catch (err) {
      console.error('Error loading video:', err);
      toast.error('Ошибка загрузки видео');
    } finally {
      setIsLoadingVideo(false);
    }
  };

  // При открытии - проверяем есть ли транскрибация и перевод в глобальной таблице
  useEffect(() => {
    const checkGlobalData = async () => {
      // Извлекаем shortcode из URL
      const match = video.url?.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/);
      const shortcode = match ? match[2] : null;
      
      if (!shortcode) return;
      
      // Проверяем глобальную таблицу
      const { data: globalVideo } = await supabase
        .from('videos')
        .select('transcript_status, transcript_text, translation_text')
        .eq('shortcode', shortcode)
        .maybeSingle();
      
      if (!globalVideo) return;
      
      // Загружаем транскрипцию если нет локально
      if (!transcript && !video.transcript_text && globalVideo.transcript_status === 'completed' && globalVideo.transcript_text) {
        setTranscript(globalVideo.transcript_text);
        setTranscriptStatus('completed');
        
        // Сохраняем в saved_videos
        await supabase
          .from('saved_videos')
          .update({ 
            transcript_text: globalVideo.transcript_text, 
            transcript_status: 'completed' 
          })
          .eq('id', video.id);
        
        toast.success('Транскрибация загружена', { description: 'Найдена в общей базе' });
      } else if (globalVideo.transcript_status && globalVideo.transcript_status !== 'completed' && globalVideo.transcript_status !== 'error') {
        setTranscriptStatus(globalVideo.transcript_status);
      }
      
      // Загружаем перевод если нет локально
      if (!translation && !video.translation_text && globalVideo.translation_text) {
        setTranslation(globalVideo.translation_text);
        
        // Сохраняем в saved_videos
        await supabase
          .from('saved_videos')
          .update({ translation_text: globalVideo.translation_text })
          .eq('id', video.id);
      }
    };
    
    checkGlobalData();
  }, [video.id, video.url, video.transcript_text, video.translation_text, transcript, translation]);
  
  // Загружаем статистику профиля при открытии
  useEffect(() => {
    const loadProfileStats = async () => {
      if (!video.owner_username) return;
      
      const stats = await getOrUpdateProfileStats(video.owner_username, false);
      if (stats) {
        const mult = calculateViralMultiplier(video.view_count || 0, stats);
        setViralMultiplier(mult);
      }
    };
    
    loadProfileStats();
  }, [video.owner_username, video.view_count]);
  
  // Расчет точной виральности (принудительное обновление статистики)
  const handleCalculateViral = async () => {
    if (!video.owner_username) {
      toast.error('Нет информации об авторе видео');
      return;
    }
    
    setIsCalculatingViral(true);
    try {
      const stats = await getOrUpdateProfileStats(video.owner_username, true);
      if (stats) {
        const mult = calculateViralMultiplier(video.view_count || 0, stats);
        setViralMultiplier(mult);
        toast.success('Виральность рассчитана', {
          description: mult ? `В ${mult.toFixed(1)}x раз ${mult >= 1 ? 'больше' : 'меньше'} среднего` : 'Нет данных для сравнения',
        });
      } else {
        toast.error('Не удалось получить статистику профиля');
      }
    } catch (err) {
      console.error('Error calculating viral:', err);
      toast.error('Ошибка расчета виральности');
    } finally {
      setIsCalculatingViral(false);
    }
  };
  
  // Автосохранение сценария при изменении (с debounce)
  useEffect(() => {
    if (!script || script === video.script_text) return;
    
    const timer = setTimeout(async () => {
      await supabase
        .from('saved_videos')
        .update({ script_text: script })
        .eq('id', video.id);
      console.log('[VideoDetail] Script auto-saved');
    }, 2000); // Сохраняем через 2 секунды после последнего изменения
    
    return () => clearTimeout(timer);
  }, [script, video.id, video.script_text]);

  // Polling для статуса транскрибации
  useEffect(() => {
    const transcriptId = localTranscriptId || video.transcript_id;
    if (transcriptId && transcriptStatus !== 'completed' && transcriptStatus !== 'error') {
      const interval = setInterval(async () => {
        const result = await checkTranscriptionStatus(transcriptId);
        setTranscriptStatus(result.status);
        
        if (result.status === 'completed' && result.text) {
          setTranscript(result.text);
          await supabase
            .from('saved_videos')
            .update({ transcript_text: result.text, transcript_status: 'completed' })
            .eq('id', video.id);
          clearInterval(interval);
        } else if (result.status === 'error') {
          clearInterval(interval);
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [localTranscriptId, video.transcript_id, video.id, transcriptStatus]);

  const handleCopyTranscript = () => {
    const textToCopy = transcriptTab === 'original' ? transcript : translation;
    navigator.clipboard.writeText(textToCopy);
    setCopiedTranscript(true);
    toast.success('Скопировано');
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const handleCopyScript = () => {
    navigator.clipboard.writeText(script);
    setCopiedScript(true);
    toast.success('Сценарий скопирован');
    setTimeout(() => setCopiedScript(false), 2000);
  };

  const handleTranslate = async () => {
    if (!transcript) {
      toast.error('Сначала дождитесь транскрибации');
      return;
    }
    
    // Если уже есть перевод - просто переключаем таб
    if (translation) {
      setTranscriptTab('translation');
      return;
    }
    
    setIsTranslating(true);
    toast.info('Перевожу текст...', { description: 'Это займёт несколько секунд' });
    
    try {
      const response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: transcript,
          to: 'ru',
        }),
      });
      
      const data = await response.json();
      
      if (data.success && data.translated) {
        setTranslation(data.translated);
        setTranscriptTab('translation');
        
        // Сохраняем перевод в БД
        await supabase
          .from('saved_videos')
          .update({ translation_text: data.translated })
          .eq('id', video.id);
        
        // Также сохраняем в глобальную таблицу по shortcode
        const match = video.url?.match(/\/(reel|p)\/([A-Za-z0-9_-]+)/);
        const shortcode = match ? match[2] : null;
        if (shortcode) {
          await supabase
            .from('videos')
            .update({ translation_text: data.translated })
            .eq('shortcode', shortcode);
        }
        
        toast.success('Перевод сохранён');
      } else {
        toast.error('Ошибка перевода', { description: data.error || 'Попробуйте позже' });
      }
    } catch (err) {
      console.error('Translation error:', err);
      toast.error('Ошибка при переводе');
    } finally {
      setIsTranslating(false);
    }
  };

  // Сохранение сценария
  const handleSaveScript = async () => {
    setIsSavingScript(true);
    const success = await updateVideoScript(video.id, script);
    setIsSavingScript(false);
    if (success) {
      toast.success('Сценарий сохранён');
    } else {
      toast.error('Ошибка сохранения');
    }
  };

  // Сохранение транскрипции (если редактировали вручную)
  const handleSaveTranscript = async () => {
    setIsSavingTranscript(true);
    const success = await updateVideoTranscript(video.id, transcript);
    setIsSavingTranscript(false);
    if (success) {
      toast.success('Транскрипция сохранена');
    } else {
      toast.error('Ошибка сохранения');
    }
  };

  const thumbnailUrl = proxyImageUrl(video.preview_url);

  return (
    <div className="h-full overflow-hidden flex flex-col bg-base">
      <div className="w-full h-full p-4 md:p-6 flex flex-col overflow-hidden min-h-0">
        {/* Header — на мобильных компактнее */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 min-h-[44px] min-w-[44px] pr-2 -ml-2 rounded-xl text-slate-500 hover:text-slate-700 hover:bg-slate-100/80 transition-colors active:scale-95 touch-manipulation"
            >
              <ChevronLeft className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm font-medium">Назад</span>
            </button>
            
            <div>
              <h1 className="text-xl font-semibold text-neutral-900">
                Работа с видео
              </h1>
              <p className="text-neutral-500 text-sm">
                @{video.owner_username || 'instagram'}
              </p>
            </div>
          </div>

          {/* Actions: Refresh data + Status badge */}
          <div className="flex flex-wrap items-center gap-2">
            {onRefreshData && (
              <button
                onClick={handleRefreshData}
                disabled={isRefreshingData}
                className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-slate-700 text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isRefreshingData ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Обновить данные
              </button>
            )}
            {transcriptStatus === 'processing' || transcriptStatus === 'downloading' ? (
              <div className="px-4 py-2 rounded-full bg-amber-100 text-amber-700 text-sm font-medium flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Обработка видео...
              </div>
            ) : transcriptStatus === 'completed' ? (
              <div className="px-4 py-2 rounded-full bg-emerald-100 text-emerald-700 text-sm font-medium flex items-center gap-2">
                <Check className="w-4 h-4" />
                Транскрибация готова
              </div>
            ) : transcriptStatus === 'error' ? (
              <div className="px-4 py-2 rounded-full bg-red-100 text-red-700 text-sm font-medium">
                Ошибка обработки
              </div>
            ) : (
              <div className="px-4 py-2 rounded-full bg-slate-100 text-slate-600 text-sm font-medium">
                Ожидает обработки
              </div>
            )}
          </div>
        </div>

        {/* Main content — на мобильных колонка, на десктопе 3 колонки */}
        <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-y-auto md:overflow-hidden">
          {/* Left: превью 9:16 — по клику загружается и проигрывается тут же */}
          <div className="flex-shrink-0 flex flex-col gap-3 overflow-y-auto custom-scrollbar-light w-full md:w-auto md:min-w-[256px] md:max-w-[min(256px,28vw)]">
            <div className="relative rounded-2xl overflow-hidden shadow-xl bg-black w-full max-w-[240px] mx-auto md:max-w-none md:mx-0" style={{ aspectRatio: '9/16' }}>
              {showVideo && directVideoUrl ? (
                <video
                  src={directVideoUrl}
                  className="w-full h-full object-cover"
                  controls
                  autoPlay
                  playsInline
                />
              ) : (
                <button
                  type="button"
                  onClick={handleLoadVideo}
                  disabled={isLoadingVideo}
                  className="absolute inset-0 w-full h-full flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors group"
                >
                  <img
                    src={thumbnailUrl}
                    alt=""
                    className="w-full h-full object-cover absolute inset-0"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                      {isLoadingVideo ? (
                        <Loader2 className="w-6 h-6 text-slate-800 animate-spin" />
                      ) : (
                        <Play className="w-6 h-6 text-slate-800 ml-1" fill="currentColor" />
                      )}
                    </div>
                  </div>
                </button>
              )}
            </div>

            {/* Current folder + move */}
            <div className="rounded-card-xl p-3 shadow-glass bg-glass-white/80 backdrop-blur-glass-xl border border-white/[0.35] relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">Папка</span>
              </div>
                <button
                onClick={() => setShowFolderMenu(!showFolderMenu)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl border border-slate-200/80 bg-white/60 hover:bg-slate-50/80 transition-colors"
              >
                <div className="flex items-center gap-2">
                  {currentFolder ? (
                    <>
                      <div 
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: currentFolder.color }}
                      />
                      <span className="text-sm font-medium text-slate-700">{currentFolder.title}</span>
                    </>
                  ) : (
                    <>
                      <div className="w-3 h-3 rounded bg-slate-300" />
                      <span className="text-sm font-medium text-slate-400">Ожидает</span>
                    </>
                  )}
                </div>
                <ChevronDown className={cn(
                  "w-4 h-4 text-slate-400 transition-transform",
                  showFolderMenu && "rotate-180"
                )} />
              </button>
              
              {/* Folder dropdown */}
              {showFolderMenu && folderConfigs.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 rounded-card-xl shadow-glass-lg bg-glass-white/90 backdrop-blur-glass-xl border border-white/[0.35] p-1.5 z-50">
                  {folderConfigs.map(folder => (
                    <button
                      key={folder.id}
                      onClick={() => handleMoveToFolder(folder.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-left",
                        folder.id === currentFolderId ? "bg-slate-100" : "hover:bg-slate-50"
                      )}
                    >
                      <div 
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: folder.color }}
                      />
                      <span className="text-sm text-slate-700">{folder.title}</span>
                      {folder.id === currentFolderId && (
                        <Check className="w-4 h-4 text-emerald-500 ml-auto" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick stats */}
            <div className="rounded-card-xl p-3 shadow-glass bg-glass-white/80 backdrop-blur-glass-xl border border-white/[0.35]">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 text-slate-600">
                  <Eye className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium">{formatNumber(video.view_count)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Heart className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium">{formatNumber(video.like_count)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <MessageCircle className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium">{formatNumber(video.comment_count)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span className="text-sm font-medium">{formatDate(video.taken_at)}</span>
                </div>
              </div>
              
              <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm">Виральность</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-sm font-bold",
                      finalViralCoef > 10 ? "text-emerald-600" : finalViralCoef > 5 ? "text-amber-600" : "text-slate-600"
                    )}>
                      {Math.round(finalViralCoef)}K/день
                    </span>
                    {viralMultiplier !== null && viralMultiplier !== undefined && (
                      <span 
                        className={cn(
                          "text-xs px-2 py-0.5 rounded-full font-semibold",
                          viralMultiplier >= 4 ? "bg-red-100 text-red-700" :
                          viralMultiplier >= 3 ? "bg-amber-100 text-amber-700" :
                          viralMultiplier >= 2 ? "bg-lime-100 text-lime-700" :
                          viralMultiplier >= 1.5 ? "bg-green-100 text-green-700" :
                          "bg-slate-100 text-slate-600"
                        )}
                        title={`В ${Math.round(viralMultiplier)}x раз ${viralMultiplier >= 1 ? 'больше' : 'меньше'} среднего у автора`}
                      >
                        {Math.round(viralMultiplier)}x
                      </span>
                    )}
                  </div>
                </div>
                {video.owner_username && (
                  <button
                    onClick={handleCalculateViral}
                    disabled={isCalculatingViral}
                    className={cn(
                      "w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                      "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border border-slate-200/60",
                      "disabled:opacity-50 disabled:cursor-not-allowed"
                    )}
                  >
                    {isCalculatingViral ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Расчёт...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        Полный расчёт виральности
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Actions */}
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-card-xl bg-glass-white/80 backdrop-blur-glass-xl border border-white/[0.35] shadow-glass hover:shadow-glass-hover text-slate-700 text-sm font-medium transition-all"
            >
              <ExternalLink className="w-4 h-4" />
              Открыть в Instagram
            </a>
            
            {/* Links section */}
            <div className="rounded-card-xl p-3 shadow-glass bg-glass-white/80 backdrop-blur-glass-xl border border-white/[0.35] space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">Ссылки</span>
                <button
                  onClick={handleSaveLinks}
                  disabled={isSavingLinks}
                  className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-all flex items-center gap-1 disabled:opacity-50"
                >
                  {isSavingLinks ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                </button>
              </div>
              
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Заготовка</label>
                  <textarea
                    value={draftLink}
                    onChange={(e) => setDraftLink(e.target.value)}
                    placeholder="Ссылка на заготовку (можно несколько строк)"
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200/50 focus:border-slate-400/50 resize-y min-h-[60px]"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">Готовое</label>
                  <textarea
                    value={finalLink}
                    onChange={(e) => setFinalLink(e.target.value)}
                    placeholder="Ссылка на готовое (можно несколько строк)"
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200/50 focus:border-slate-400/50 resize-y min-h-[60px]"
                  />
                </div>
              </div>
            </div>
            
            {/* Responsible section */}
            <div className="rounded-card-xl p-3 shadow-glass bg-glass-white/80 backdrop-blur-glass-xl border border-white/[0.35] space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">Ответственные</span>
                <button
                  onClick={handleSaveResponsible}
                  disabled={isSavingResponsible}
                  className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-all flex items-center gap-1 disabled:opacity-50"
                >
                  {isSavingResponsible ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Save className="w-3 h-3" />
                  )}
                </button>
              </div>
              
              <div className="space-y-2">
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">За сценарий</label>
                  <textarea
                    value={scriptResponsible}
                    onChange={(e) => setScriptResponsible(e.target.value)}
                    placeholder="Кто отвечает за сценарий (можно несколько строк)"
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200/50 focus:border-slate-400/50 resize-y min-h-[60px]"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1 block">За монтаж</label>
                  <textarea
                    value={editingResponsible}
                    onChange={(e) => setEditingResponsible(e.target.value)}
                    placeholder="Кто отвечает за монтаж (можно несколько строк)"
                    rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200/80 bg-white/80 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200/50 focus:border-slate-400/50 resize-y min-h-[60px]"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Middle: Transcript — на мобильных с мин. высотой для скролла */}
          <div className="flex-1 flex flex-col min-w-0 min-h-[320px] md:min-h-0 rounded-card-xl shadow-glass bg-glass-white/80 backdrop-blur-glass-xl border border-white/[0.35] overflow-hidden">
            {/* Transcript header — на мобильных кнопки переносятся */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <h3 className="font-semibold text-slate-800">Транскрибация</h3>
              </div>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* Tabs: Original / Translation */}
                <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setTranscriptTab('original')}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                      transcriptTab === 'original'
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Оригинал
                  </button>
                  <button
                    onClick={() => setTranscriptTab('translation')}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-xs font-medium transition-all",
                      transcriptTab === 'translation'
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700"
                    )}
                  >
                    Перевод
                  </button>
                </div>

                {transcript && (
                  <>
                    <button
                      onClick={handleSaveTranscript}
                      disabled={isSavingTranscript}
                      className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
                      title="Сохранить транскрипцию"
                    >
                      {isSavingTranscript ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Сохранить
                    </button>
                    <button
                      onClick={handleTranslate}
                      disabled={isTranslating}
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                      title="Перевести"
                    >
                      {isTranslating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Languages className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      onClick={handleCopyTranscript}
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                      title="Копировать"
                    >
                      {copiedTranscript ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Transcript content */}
            <div className="flex-1 overflow-y-auto p-4">
              {transcriptStatus === 'processing' || transcriptStatus === 'downloading' ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Loader2 className="w-10 h-10 text-amber-500 animate-spin mb-3" />
                  <p className="text-slate-600 font-medium">Транскрибация в процессе...</p>
                  <p className="text-slate-400 text-sm">Это займёт несколько минут</p>
                </div>
              ) : transcriptTab === 'original' && transcript ? (
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="w-full h-full resize-none text-slate-700 text-sm leading-relaxed focus:outline-none border border-slate-200 rounded-xl p-4 focus:border-amber-300 focus:ring-2 focus:ring-amber-100 transition-all"
                  placeholder="Текст транскрипции..."
                />
              ) : transcriptTab === 'translation' && translation ? (
                <textarea
                  value={translation}
                  onChange={(e) => setTranslation(e.target.value)}
                  className="w-full h-full resize-none text-slate-700 text-sm leading-relaxed focus:outline-none border border-slate-200 rounded-xl p-4 focus:border-amber-300 focus:ring-2 focus:ring-amber-100 transition-all"
                  placeholder="Перевод..."
                />
              ) : transcriptTab === 'translation' && !translation ? (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Languages className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="text-slate-600 font-medium">Перевод не выполнен</p>
                  <button
                    onClick={handleTranslate}
                    disabled={!transcript || isTranslating}
                    className="mt-3 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
                    Перевести текст
                  </button>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Mic className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="text-slate-600 font-medium">
                    {transcriptStatus === 'error' 
                      ? 'Ошибка транскрибации'
                      : 'Транскрибация не запущена'
                    }
                  </p>
                  <p className="text-slate-400 text-sm mb-4">
                    {transcriptStatus === 'error' 
                      ? 'Попробуйте запустить заново'
                      : 'Запустите для получения текста из видео'
                    }
                  </p>
                  <button
                    onClick={handleStartTranscription}
                    disabled={isStartingTranscription}
                    className="px-4 py-2.5 rounded-card-xl bg-slate-600 hover:bg-slate-700 text-white font-medium transition-all shadow-glass flex items-center gap-2 disabled:opacity-50"
                  >
                    {isStartingTranscription ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Запускаю...
                      </>
                    ) : (
                      <>
                        <Mic className="w-4 h-4" />
                        Запустить транскрибацию
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right: Script — на мобильных с мин. высотой */}
          <div className="flex-1 flex flex-col min-w-0 min-h-[280px] md:min-h-0 rounded-card-xl shadow-glass bg-glass-white/80 backdrop-blur-glass-xl border border-white/[0.35] overflow-hidden">
            {/* Script header — на мобильных кнопки переносятся */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-violet-500 flex-shrink-0" />
                <h3 className="font-semibold text-slate-800">Мой сценарий</h3>
                {video.script_text && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-medium">
                    сохранён
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {script && (
                  <>
                    <button
                      onClick={handleSaveScript}
                      disabled={isSavingScript}
                      className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-medium hover:from-violet-400 hover:to-purple-500 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                    >
                      {isSavingScript ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5" />
                      )}
                      Сохранить
                    </button>
                    <button
                      onClick={handleCopyScript}
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors"
                      title="Копировать"
                    >
                      {copiedScript ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </>
                )}
              </div>
            </div>
            
            {/* Script content - всегда textarea */}
            <div className="flex-1 overflow-hidden p-4">
              <textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                className="w-full h-full resize-none text-slate-700 text-sm leading-relaxed focus:outline-none border border-slate-200 rounded-xl p-4 focus:border-violet-300 focus:ring-2 focus:ring-violet-100 transition-all"
                placeholder="Напишите ваш сценарий здесь...

# Хук (0-3 сек)
Что зацепит внимание?

# Основная часть
Главный контент видео

# Призыв к действию (CTA)
Что должен сделать зритель?"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
