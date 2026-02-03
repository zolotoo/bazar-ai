import { useState, useEffect, useRef } from 'react';
import { 
  ChevronLeft, Play, Eye, Heart, MessageCircle, Calendar, 
  Sparkles, FileText, Copy, ExternalLink, Loader2, Check,
  Languages, ChevronDown, Mic, Save, RefreshCw, Plus, Trash2, Wand2, BookOpen, Pencil
} from 'lucide-react';
import { cn } from '../utils/cn';
import { checkTranscriptionStatus, downloadAndTranscribe } from '../services/transcriptionService';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { useInboxVideos } from '../hooks/useInboxVideos';
import { StyleTrainModal } from './StyleTrainModal';
import { useProjectContext } from '../contexts/ProjectContext';
import type { ProjectTemplateItem, ProjectStyle } from '../hooks/useProjects';
import { calculateViralMultiplier, getOrUpdateProfileStats, applyViralMultiplierToCoefficient } from '../services/profileStatsService';
import { isRussian } from '../utils/language';
import { TokenBadge } from './ui/TokenBadge';
import { getTokenCost } from '../constants/tokenCosts';

/** Сырые данные ссылок/ответственных из БД (по templateId или legacy label) */
type VideoLinkRow = { templateId?: string; label?: string; value: string };
type VideoResponsibleRow = { templateId?: string; label?: string; value: string };

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
  translation_text?: string;
  script_text?: string;
  download_url?: string;
  folder_id?: string;
  draft_link?: string;
  final_link?: string;
  script_responsible?: string;
  editing_responsible?: string;
  links?: VideoLinkRow[];
  responsibles?: VideoResponsibleRow[];
}

interface VideoDetailPageProps {
  video: VideoData;
  onBack: () => void;
  onRefreshData?: () => Promise<void>;
}

const DEFAULT_LINKS_TEMPLATE: ProjectTemplateItem[] = [
  { id: 'link-0', label: 'Заготовка' },
  { id: 'link-1', label: 'Готовое' },
];
const DEFAULT_RESPONSIBLES_TEMPLATE: ProjectTemplateItem[] = [
  { id: 'resp-0', label: 'За сценарий' },
  { id: 'resp-1', label: 'За монтаж' },
];

/** Строка для UI: id = templateId, label из шаблона проекта, value из видео */
type MergedLinkRow = { id: string; label: string; value: string };
type MergedResponsibleRow = { id: string; label: string; value: string };

function mergeLinksWithTemplate(
  template: ProjectTemplateItem[],
  videoLinks: VideoLinkRow[] | undefined,
  draftLink?: string,
  finalLink?: string
): MergedLinkRow[] {
  return template.map((t, i) => {
    const byId = videoLinks?.find((r) => r.templateId === t.id);
    const byIndex = videoLinks?.[i];
    const legacy = i === 0 ? draftLink : i === 1 ? finalLink : undefined;
    const value = byId?.value ?? byIndex?.value ?? legacy ?? '';
    return { id: t.id, label: t.label, value };
  });
}

function mergeResponsiblesWithTemplate(
  template: ProjectTemplateItem[],
  videoResponsibles: VideoResponsibleRow[] | undefined,
  scriptResponsible?: string,
  editingResponsible?: string
): MergedResponsibleRow[] {
  return template.map((t, i) => {
    const byId = videoResponsibles?.find((r) => r.templateId === t.id);
    const byIndex = videoResponsibles?.[i];
    const legacy = i === 0 ? scriptResponsible : i === 1 ? editingResponsible : undefined;
    const value = byId?.value ?? byIndex?.value ?? legacy ?? '';
    return { id: t.id, label: t.label, value };
  });
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
  if (url.includes('cdninstagram.com') || url.includes('instagram.com') || url.includes('workers.dev') || url.includes('socialapi')) {
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
  const { currentProject, updateProject, updateProjectStyle, addProjectStyle, refetch: refetchProjects } = useProjectContext();

  // Стиль сценария проекта: обучение по примерам + генерация по стилю + просмотр/редактирование промта
  const [showStyleTrainModal, setShowStyleTrainModal] = useState(false);
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [editedPromptText, setEditedPromptText] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);
  const [scriptGeneratedByStyle, setScriptGeneratedByStyle] = useState(false);
  const [showChoiceModal, setShowChoiceModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [showEditScriptModal, setShowEditScriptModal] = useState(false);
  const [scriptAiForRefine, setScriptAiForRefine] = useState('');
  const [scriptHumanForRefine, setScriptHumanForRefine] = useState('');
  const [editScriptLeftTab, setEditScriptLeftTab] = useState<'original' | 'translation' | 'ai'>('ai');
  const [feedbackText, setFeedbackText] = useState('');
  const [isRefiningPrompt, setIsRefiningPrompt] = useState(false);
  const [clarifyingQuestions, setClarifyingQuestions] = useState<string[]>([]);
  const [clarifyingIndex, setClarifyingIndex] = useState(0);
  const [clarifyAnswer, setClarifyAnswer] = useState('');
  const [showClarifyModal, setShowClarifyModal] = useState(false);
  const [lastRefinedPrompt, setLastRefinedPrompt] = useState('');
  const [showPromptChat, setShowPromptChat] = useState(false);
  const [promptChatMessages, setPromptChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [promptChatInput, setPromptChatInput] = useState('');
  const [isPromptChatLoading, setIsPromptChatLoading] = useState(false);
  const [pendingSuggestedPrompt, setPendingSuggestedPrompt] = useState<string | null>(null);
  const [showStylePickerPopover, setShowStylePickerPopover] = useState(false);
  const stylePickerRef = useRef<HTMLDivElement>(null);
  const [editingStyle, setEditingStyle] = useState<ProjectStyle | null>(null);
  const [creatingNewStyle, setCreatingNewStyle] = useState(false);
  const [newStyleName, setNewStyleName] = useState('');
  const [lastGeneratedStyleId, setLastGeneratedStyleId] = useState<string | null>(null);
  const [isRenamingStyle, setIsRenamingStyle] = useState(false);
  const [renamingStyleName, setRenamingStyleName] = useState('');

  const projectStyles = currentProject?.projectStyles || [];
  const currentPromptStyle = editingStyle || (projectStyles.length === 1 ? projectStyles[0] : null);
  const linksTemplate = currentProject?.linksTemplate ?? DEFAULT_LINKS_TEMPLATE;
  const responsiblesTemplate = currentProject?.responsiblesTemplate ?? DEFAULT_RESPONSIBLES_TEMPLATE;

  const buildMergedLinks = () => mergeLinksWithTemplate(
    linksTemplate,
    video.links,
    video.draft_link,
    video.final_link
  );
  const buildMergedResponsibles = () => mergeResponsiblesWithTemplate(
    responsiblesTemplate,
    video.responsibles,
    video.script_responsible,
    video.editing_responsible
  );

  const [links, setLinks] = useState<MergedLinkRow[]>(() => buildMergedLinks());
  const [responsibles, setResponsibles] = useState<MergedResponsibleRow[]>(() => buildMergedResponsibles());
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const [isSavingResponsible, setIsSavingResponsible] = useState(false);
  const [isRefreshingData, setIsRefreshingData] = useState(false);

  useEffect(() => {
    setLinks(buildMergedLinks());
    setResponsibles(buildMergedResponsibles());
  }, [video.id, video.links, video.responsibles, video.draft_link, video.final_link, video.script_responsible, video.editing_responsible, linksTemplate, responsiblesTemplate]);

  useEffect(() => {
    setScriptGeneratedByStyle(false);
  }, [video.id]);

  const { updateVideoFolder, updateVideoScript, updateVideoTranscript, updateVideoTranslation, updateVideoResponsible, updateVideoLinks } = useInboxVideos();

  const addLinkRow = () => setLinks(prev => [...prev, { id: `link-${Date.now()}`, label: '', value: '' }]);
  const removeLinkRow = (id: string) => setLinks(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  const updateLinkRow = (id: string, field: 'label' | 'value', value: string) =>
    setLinks(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const addResponsibleRow = () => setResponsibles(prev => [...prev, { id: `resp-${Date.now()}`, label: '', value: '' }]);
  const removeResponsibleRow = (id: string) => setResponsibles(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  const updateResponsibleRow = (id: string, field: 'label' | 'value', value: string) =>
    setResponsibles(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const handleSaveLinks = async () => {
    if (!currentProject?.id) {
      toast.error('Выберите проект для сохранения шаблона ссылок');
      return;
    }
    setIsSavingLinks(true);
    const newTemplate = links.map(({ id, label }) => ({ id, label }));
    await updateProject(currentProject.id, { linksTemplate: newTemplate });
    const success = await updateVideoLinks(video.id, links.map(({ id, value }) => ({ templateId: id, value })));
    setIsSavingLinks(false);
    if (success) toast.success('Ссылки сохранены');
    else toast.error('Ошибка сохранения ссылок. Примените миграцию add_video_links_responsibles_json.sql.');
  };

  const handleSaveResponsible = async () => {
    if (!currentProject?.id) {
      toast.error('Выберите проект для сохранения шаблона ответственных');
      return;
    }
    setIsSavingResponsible(true);
    const newTemplate = responsibles.map(({ id, label }) => ({ id, label }));
    await updateProject(currentProject.id, { responsiblesTemplate: newTemplate });
    const success = await updateVideoResponsible(video.id, responsibles.map(({ id, value }) => ({ templateId: id, value })));
    setIsSavingResponsible(false);
    if (success) toast.success('Ответственные сохранены');
    else toast.error('Ошибка сохранения ответственных. Примените миграцию add_video_links_responsibles_json.sql.');
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

        // Сохраняем перевод в saved_videos (с проверкой ошибок и обновлением списка)
        const saved = await updateVideoTranslation(video.id, data.translated);
        if (!saved) {
          toast.error('Не удалось сохранить перевод в БД. Примените миграцию add_saved_videos_translation_text.sql.');
          return;
        }

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

  // Генерация сценария по выбранному стилю (Gemini). При отсутствии перевода — авто-перевод (если транскрипт не на русском).
  const handleGenerateByStyle = async (style: ProjectStyle) => {
    if (!style?.prompt?.trim() || !transcript?.trim()) {
      toast.error('Нужен стиль с промтом и транскрипция');
      return;
    }
    setShowStylePickerPopover(false);
    setIsGeneratingScript(true);
    try {
      let translationToUse: string | undefined;
      if (isRussian(transcript)) {
        translationToUse = undefined;
      } else {
        translationToUse = translation?.trim() || undefined;
        if (!translationToUse) {
          try {
            const trRes = await fetch('/api/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: transcript, to: 'ru' }),
            });
            const trData = await trRes.json();
            if (trData.success && trData.translated) {
              setTranslation(trData.translated);
              await updateVideoTranslation(video.id, trData.translated);
              translationToUse = trData.translated;
              toast.success('Перевод сохранён');
            }
          } catch (e) {
            console.error('Auto translate on По стилю:', e);
            toast.error('Не удалось перевести');
          }
        }
      }
      const res = await fetch('/api/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: style.prompt,
          transcript_text: transcript,
          translation_text: translationToUse,
        }),
      });
      const data = await res.json();
      if (data.success && data.script) {
        setScript(data.script);
        setScriptGeneratedByStyle(true);
        setLastGeneratedStyleId(style.id);
        toast.success(`Сценарий сгенерирован по стилю «${style.name}»`);
      } else {
        toast.error(data.error || 'Ошибка генерации');
      }
    } catch (err) {
      console.error('Generate by style error:', err);
      toast.error('Ошибка генерации сценария');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const openPromptModal = (style?: ProjectStyle | null) => {
    const s = style || (projectStyles.length === 1 ? projectStyles[0] : null);
    setEditingStyle(s);
    setEditedPromptText(s?.prompt || currentProject?.stylePrompt || '');
    setIsEditingPrompt(false);
    setShowPromptModal(true);
  };
  const styleForRefine = lastGeneratedStyleId
    ? projectStyles.find((s) => s.id === lastGeneratedStyleId)
    : projectStyles[0];
  const promptForRefine = styleForRefine?.prompt || currentProject?.stylePrompt || '';

  // Дообучение промта по обратной связи (текст)
  const handleRefinePrompt = async () => {
    if (!currentProject?.id || !feedbackText.trim() || !script?.trim() || !promptForRefine) return;
    setIsRefiningPrompt(true);
    try {
      const res = await fetch('/api/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: feedbackText.trim(),
          prompt: promptForRefine,
          transcript_text: transcript,
          translation_text: translation || undefined,
          script_text: script,
        }),
      });
      const data = await res.json();
      if (data.success && data.prompt) {
        if (styleForRefine) {
          await updateProjectStyle(currentProject.id, styleForRefine.id, { prompt: data.prompt, meta: data.meta });
        } else {
          await updateProject(currentProject.id, { stylePrompt: data.prompt, styleMeta: data.meta });
        }
        setLastRefinedPrompt(data.prompt);
        setShowFeedbackModal(false);
        setFeedbackText('');
        setScriptGeneratedByStyle(false);
        toast.success('Промт обновлён');
        if (data.clarifying_questions?.length) {
          setClarifyingQuestions(data.clarifying_questions);
          setClarifyingIndex(0);
          setClarifyAnswer('');
          setShowClarifyModal(true);
        }
      } else {
        toast.error(data.error || 'Ошибка дообучения');
      }
    } catch (err) {
      console.error('Refine prompt error:', err);
      toast.error('Ошибка дообучения промта');
    } finally {
      setIsRefiningPrompt(false);
    }
  };

  // Дообучение по diff: сценарий ИИ vs ваш идеальный
  const handleRefineByDiff = async () => {
    if (!currentProject?.id || scriptAiForRefine.trim() === '' || scriptHumanForRefine.trim() === '') return;
    setIsRefiningPrompt(true);
    try {
      const res = await fetch('/api/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: promptForRefine,
          transcript_text: transcript,
          translation_text: translation || undefined,
          script_ai: scriptAiForRefine.trim(),
          script_human: scriptHumanForRefine.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.prompt) {
        if (styleForRefine) {
          await updateProjectStyle(currentProject.id, styleForRefine.id, { prompt: data.prompt, meta: data.meta });
        } else {
          await updateProject(currentProject.id, { stylePrompt: data.prompt, styleMeta: data.meta });
        }
        setScript(scriptHumanForRefine.trim());
        setLastRefinedPrompt(data.prompt);
        setShowEditScriptModal(false);
        setScriptAiForRefine('');
        setScriptHumanForRefine('');
        setScriptGeneratedByStyle(false);
        toast.success('Промт дообучен на ваших правках');
        if (data.clarifying_questions?.length) {
          setClarifyingQuestions(data.clarifying_questions);
          setClarifyingIndex(0);
          setClarifyAnswer('');
          setShowClarifyModal(true);
        }
      } else {
        toast.error(data.error || 'Ошибка дообучения');
      }
    } catch (err) {
      console.error('Refine by diff error:', err);
      toast.error('Ошибка дообучения промта');
    } finally {
      setIsRefiningPrompt(false);
    }
  };

  // Ответ на уточняющий вопрос нейросети — ещё один раунд refine
  const handleClarifySubmit = async () => {
    const question = clarifyingQuestions[clarifyingIndex];
    if (!currentProject?.id || !question || !clarifyAnswer.trim() || !lastRefinedPrompt) return;
    setIsRefiningPrompt(true);
    try {
      const res = await fetch('/api/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: `Уточняющий вопрос: ${question}\nОтвет: ${clarifyAnswer.trim()}`,
          prompt: lastRefinedPrompt,
          transcript_text: transcript,
          translation_text: translation || undefined,
          script_text: script,
        }),
      });
      const data = await res.json();
      if (data.success && data.prompt) {
        if (styleForRefine) {
          await updateProjectStyle(currentProject.id, styleForRefine.id, { prompt: data.prompt, meta: data.meta });
        } else {
          await updateProject(currentProject.id, { stylePrompt: data.prompt, styleMeta: data.meta });
        }
        setLastRefinedPrompt(data.prompt);
        setClarifyAnswer('');
        if (data.clarifying_questions?.length) {
          setClarifyingQuestions(data.clarifying_questions);
          setClarifyingIndex(0);
        } else {
          setShowClarifyModal(false);
          setClarifyingQuestions([]);
          toast.success('Промт уточнён по вашим ответам');
        }
      } else {
        toast.error(data.error || 'Ошибка');
      }
    } catch (err) {
      console.error('Clarify submit error:', err);
      toast.error('Ошибка отправки');
    } finally {
      setIsRefiningPrompt(false);
    }
  };

  const handleSaveEditedPrompt = async () => {
    const currentVal = editingStyle ? editingStyle.prompt : currentProject?.stylePrompt;
    if (!currentProject?.id || editedPromptText.trim() === currentVal) {
      setIsEditingPrompt(false);
      return;
    }
    setIsSavingPrompt(true);
    try {
      if (editingStyle) {
        await updateProjectStyle(currentProject.id, editingStyle.id, { prompt: editedPromptText.trim() });
      } else {
        await updateProject(currentProject.id, { stylePrompt: editedPromptText.trim() });
      }
      toast.success('Промт сохранён');
      setIsEditingPrompt(false);
    } catch (e) {
      toast.error('Не удалось сохранить промт');
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handlePromptChatSend = async () => {
    const text = promptChatInput.trim();
    const promptToUse = editingStyle?.prompt || currentProject?.stylePrompt;
    if (!text || !promptToUse || isPromptChatLoading) return;
    const userMsg = { role: 'user' as const, content: text };
    const newMessages = [...promptChatMessages, userMsg];
    setPromptChatMessages(newMessages);
    setPromptChatInput('');
    setIsPromptChatLoading(true);
    setPendingSuggestedPrompt(null);
    try {
      const res = await fetch('/api/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'chat',
          messages: newMessages,
          prompt: promptToUse,
          transcript_text: transcript || undefined,
          translation_text: translation || undefined,
          script_text: script || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.reply) {
        setPromptChatMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
        if (data.suggested_prompt) setPendingSuggestedPrompt(data.suggested_prompt);
      } else {
        toast.error(data.error || 'Ошибка');
      }
    } catch (err) {
      console.error('Prompt chat error:', err);
      toast.error('Ошибка отправки');
    } finally {
      setIsPromptChatLoading(false);
    }
  };

  const handleApplySuggestedPrompt = async () => {
    if (!currentProject?.id || !pendingSuggestedPrompt) return;
    setIsSavingPrompt(true);
    try {
      if (editingStyle) {
        await updateProjectStyle(currentProject.id, editingStyle.id, { prompt: pendingSuggestedPrompt });
      } else {
        await updateProject(currentProject.id, { stylePrompt: pendingSuggestedPrompt });
      }
      setEditedPromptText(pendingSuggestedPrompt);
      setPendingSuggestedPrompt(null);
      toast.success('Промт применён');
    } catch (e) {
      toast.error('Не удалось применить промт');
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const openPromptChat = () => {
    setShowPromptChat(true);
    setPromptChatMessages([]);
    setPromptChatInput('');
    setPendingSuggestedPrompt(null);
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
                  <div className="absolute bottom-2 right-2">
                    <TokenBadge tokens={getTokenCost('load_video')} size="sm" />
                  </div>
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

            {/* Current folder + move — z-[60] чтобы дропдаун был поверх раздела параметров */}
            <div className={cn(
              "rounded-card-xl p-3 shadow-glass bg-glass-white/80 backdrop-blur-glass-xl border border-white/[0.35] relative",
              showFolderMenu && "z-[60]"
            )}>
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
              
              {/* Folder dropdown — рисуется поверх Quick stats благодаря z-[60] у родителя */}
              {showFolderMenu && folderConfigs.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 rounded-card-xl shadow-glass-lg bg-glass-white/95 backdrop-blur-glass-xl border border-white/[0.35] p-1.5 z-[70] shadow-xl">
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
                        <TokenBadge tokens={getTokenCost('calculate_viral')} />
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
            
            {/* Links section — динамические пункты с переименованием и добавлением */}
            <div className="rounded-card-xl p-3 shadow-glass bg-glass-white/80 backdrop-blur-glass-xl border border-white/[0.35] space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">Ссылки</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={addLinkRow}
                    className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-500 hover:text-slate-700 transition-colors"
                    title="Добавить пункт"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleSaveLinks}
                    disabled={isSavingLinks}
                    className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-all flex items-center gap-1 disabled:opacity-50"
                  >
                    {isSavingLinks ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {links.map((row) => (
                  <div key={row.id} className="flex gap-2 items-start">
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) => updateLinkRow(row.id, 'label', e.target.value)}
                      placeholder="Название"
                      className="flex-shrink-0 w-24 px-2 py-1.5 rounded-lg border border-slate-200/80 bg-white/80 text-xs focus:outline-none focus:ring-2 focus:ring-slate-200/50 focus:border-slate-400/50"
                    />
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) => updateLinkRow(row.id, 'value', e.target.value)}
                      placeholder="URL"
                      className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-slate-200/80 bg-white/80 text-xs focus:outline-none focus:ring-2 focus:ring-slate-200/50 focus:border-slate-400/50"
                    />
                    <button
                      type="button"
                      onClick={() => removeLinkRow(row.id)}
                      disabled={links.length <= 1}
                      className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                      title="Удалить пункт"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Ответственные — динамические пункты с переименованием и добавлением */}
            <div className="rounded-card-xl p-3 shadow-glass bg-glass-white/80 backdrop-blur-glass-xl border border-white/[0.35] space-y-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">Ответственные</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={addResponsibleRow}
                    className="p-1.5 rounded-lg hover:bg-slate-200/80 text-slate-500 hover:text-slate-700 transition-colors"
                    title="Добавить пункт"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleSaveResponsible}
                    disabled={isSavingResponsible}
                    className="px-2 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-medium transition-all flex items-center gap-1 disabled:opacity-50"
                  >
                    {isSavingResponsible ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {responsibles.map((row) => (
                  <div key={row.id} className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={row.label}
                      onChange={(e) => updateResponsibleRow(row.id, 'label', e.target.value)}
                      placeholder="Роль (название)"
                      className="flex-shrink-0 w-28 px-2 py-1.5 rounded-lg border border-slate-200/80 bg-white/80 text-xs focus:outline-none focus:ring-2 focus:ring-slate-200/50 focus:border-slate-400/50"
                    />
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) => updateResponsibleRow(row.id, 'value', e.target.value)}
                      placeholder="Имя"
                      className="flex-1 min-w-0 px-2 py-1.5 rounded-lg border border-slate-200/80 bg-white/80 text-xs focus:outline-none focus:ring-2 focus:ring-slate-200/50 focus:border-slate-400/50"
                    />
                    <button
                      type="button"
                      onClick={() => removeResponsibleRow(row.id)}
                      disabled={responsibles.length <= 1}
                      className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                      title="Удалить пункт"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
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
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50 flex items-center gap-1"
                      title="Перевести"
                    >
                      {isTranslating ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Languages className="w-4 h-4" />
                      )}
                      <TokenBadge tokens={getTokenCost('translate')} />
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
                    <TokenBadge tokens={getTokenCost('translate')} />
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
                        <TokenBadge tokens={getTokenCost('transcribe_video')} />
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
              <div className="flex items-center gap-2 flex-wrap">
                <FileText className="w-5 h-5 text-violet-500 flex-shrink-0" />
                <h3 className="font-semibold text-slate-800">Мой сценарий</h3>
                {(projectStyles.length > 0 || currentProject?.stylePrompt) && (
                  <button
                    type="button"
                    onClick={() => openPromptModal(projectStyles[0] || null)}
                    className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-medium hover:bg-violet-200 transition-colors"
                    title="Промт стиля"
                  >
                    {projectStyles.length || 1} стил{projectStyles.length === 1 || !projectStyles.length ? 'ь' : 'я'} · Промт
                  </button>
                )}
                {video.script_text && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 text-[10px] font-medium">
                    сохранён
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                {(projectStyles.length > 0 || currentProject?.stylePrompt) && transcript?.trim() && (
                  <div className="relative" ref={stylePickerRef}>
                    <button
                      onClick={() => setShowStylePickerPopover(!showStylePickerPopover)}
                      disabled={isGeneratingScript}
                      className="px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium transition-all flex items-center gap-1.5 disabled:opacity-50"
                      title="Выбрать стиль и сгенерировать"
                    >
                      {isGeneratingScript ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="w-3.5 h-3.5" />
                      )}
                      По стилю
                      <TokenBadge tokens={getTokenCost('generate_script')} variant="dark" />
                      <ChevronDown className="w-3 h-3" />
                    </button>
                    {showStylePickerPopover && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowStylePickerPopover(false)} aria-hidden />
                        <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] rounded-xl border border-slate-200 bg-white shadow-xl py-1.5 animate-in fade-in slide-in-from-top-2 duration-150">
                          {projectStyles.map((s) => (
                            <div key={s.id} className="flex items-center gap-1 group">
                              <button
                                type="button"
                                onClick={() => handleGenerateByStyle(s)}
                                className="flex-1 px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 truncate"
                              >
                                {s.name}
                              </button>
                              <button
                                type="button"
                                onClick={() => { setShowStylePickerPopover(false); setEditingStyle(s); setCreatingNewStyle(false); setShowStyleTrainModal(true); }}
                                className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-slate-100 text-slate-400"
                                title="Переобучить по примерам"
                              >
                                <BookOpen className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => { setShowStylePickerPopover(false); openPromptModal(s); }}
                                className="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-slate-100 text-slate-400"
                                title="Редактировать промт"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                          {currentProject?.stylePrompt && projectStyles.length === 0 && (
                            <button
                              type="button"
                              onClick={() => handleGenerateByStyle({
                                id: 'legacy',
                                name: 'Стиль по умолчанию',
                                prompt: currentProject.stylePrompt!,
                                meta: currentProject.styleMeta,
                                examplesCount: currentProject.styleExamplesCount,
                              })}
                              className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                            >
                              Стиль по умолчанию
                            </button>
                          )}
                          <div className="h-px bg-slate-100 my-1" />
                          <button
                            type="button"
                            onClick={() => {
                              setShowStylePickerPopover(false);
                              setCreatingNewStyle(true);
                              setNewStyleName('');
                              setShowStyleTrainModal(true);
                            }}
                            className="w-full px-3 py-2 text-left text-sm text-violet-600 hover:bg-violet-50 flex items-center gap-2"
                          >
                            <Plus className="w-4 h-4" />
                            Создать новый стиль
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
                {scriptGeneratedByStyle && script?.trim() && (
                  <button
                    type="button"
                    onClick={() => setShowChoiceModal(true)}
                    className="px-3 py-1.5 rounded-lg border border-amber-200 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-medium transition-all flex items-center gap-1.5"
                    title="Дать обратную связь — промт дообучится"
                  >
                    Что не так сделал?
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setCreatingNewStyle(true); setEditingStyle(null); setNewStyleName(''); setShowStyleTrainModal(true); }}
                  className="px-3 py-1.5 rounded-lg border border-violet-200 bg-violet-50 hover:bg-violet-100 text-violet-700 text-xs font-medium transition-all flex items-center gap-1.5"
                  title="Создать новый стиль по 1–5 примерам"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  Обучить стиль
                </button>
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
                onChange={(e) => { setScript(e.target.value); setScriptGeneratedByStyle(false); }}
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

      <StyleTrainModal
        open={showStyleTrainModal}
        onClose={() => {
          setShowStyleTrainModal(false);
          setCreatingNewStyle(false);
          setEditingStyle(null);
          setNewStyleName('');
        }}
        creatingNewStyle={creatingNewStyle}
        newStyleName={newStyleName}
        setNewStyleName={setNewStyleName}
        editingStyle={editingStyle}
        onSuccess={(prompt) => setEditedPromptText(prompt)}
      />

      {/* Модальное окно: просмотр и редактирование промта стиля */}
      {showPromptModal && (currentPromptStyle || currentProject?.stylePrompt) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => { if (!isSavingPrompt && !isPromptChatLoading) { setShowPromptModal(false); setShowPromptChat(false); } }}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {projectStyles.length > 1 ? (
                  <div className="flex items-center gap-2">
                    <select
                      value={editingStyle?.id || projectStyles[0]?.id}
                      onChange={(e) => {
                        const s = projectStyles.find((x) => x.id === e.target.value);
                        if (s) { setEditingStyle(s); setEditedPromptText(s.prompt); setIsRenamingStyle(false); }
                      }}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-medium text-slate-800 bg-white"
                    >
                      {projectStyles.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                    {currentPromptStyle && (
                      isRenamingStyle ? (
                        <input
                          value={renamingStyleName}
                          onChange={(e) => setRenamingStyleName(e.target.value)}
                          onBlur={async () => {
                            if (!currentProject?.id || !currentPromptStyle || !renamingStyleName.trim() || renamingStyleName.trim() === currentPromptStyle.name) {
                              setIsRenamingStyle(false);
                              return;
                            }
                            const newName = renamingStyleName.trim();
                            if (currentPromptStyle.id === 'legacy') {
                              await addProjectStyle(currentProject.id, {
                                name: newName,
                                prompt: currentPromptStyle.prompt,
                                meta: currentPromptStyle.meta,
                                examplesCount: currentPromptStyle.examplesCount ?? 0,
                              });
                              await updateProject(currentProject.id, { stylePrompt: undefined, styleMeta: undefined, styleExamplesCount: 0 });
                              await refetchProjects();
                              setEditingStyle(null);
                            } else {
                              await updateProjectStyle(currentProject.id, currentPromptStyle.id, { name: newName });
                              setEditingStyle({ ...currentPromptStyle, name: newName });
                            }
                            toast.success('Стиль переименован');
                            setIsRenamingStyle(false);
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          autoFocus
                          className="px-2 py-1 rounded-lg border border-violet-200 text-sm w-32 focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setIsRenamingStyle(true); setRenamingStyleName(currentPromptStyle.name); }}
                          className="px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-500 text-xs font-medium flex items-center gap-1"
                          title="Переименовать стиль"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Переименовать
                        </button>
                      )
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800">
                      {currentPromptStyle ? `Промт: ${currentPromptStyle.name}` : 'Промт стиля проекта'}
                    </h3>
                    {currentPromptStyle && (
                      isRenamingStyle ? (
                        <input
                          value={renamingStyleName}
                          onChange={(e) => setRenamingStyleName(e.target.value)}
                          onBlur={async () => {
                            if (!currentProject?.id || !currentPromptStyle || !renamingStyleName.trim() || renamingStyleName.trim() === currentPromptStyle.name) {
                              setIsRenamingStyle(false);
                              return;
                            }
                            const newName = renamingStyleName.trim();
                            if (currentPromptStyle.id === 'legacy') {
                              await addProjectStyle(currentProject.id, {
                                name: newName,
                                prompt: currentPromptStyle.prompt,
                                meta: currentPromptStyle.meta,
                                examplesCount: currentPromptStyle.examplesCount ?? 0,
                              });
                              await updateProject(currentProject.id, { stylePrompt: undefined, styleMeta: undefined, styleExamplesCount: 0 });
                              await refetchProjects();
                              setEditingStyle(null);
                            } else {
                              await updateProjectStyle(currentProject.id, currentPromptStyle.id, { name: newName });
                              setEditingStyle({ ...currentPromptStyle, name: newName });
                            }
                            toast.success('Стиль переименован');
                            setIsRenamingStyle(false);
                          }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                          autoFocus
                          className="px-2 py-1 rounded-lg border border-violet-200 text-sm w-40 focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => { setIsRenamingStyle(true); setRenamingStyleName(currentPromptStyle.name); }}
                          className="px-2 py-1 rounded-lg hover:bg-slate-100 text-slate-500 text-xs font-medium flex items-center gap-1"
                          title="Переименовать стиль"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          Переименовать
                        </button>
                      )
                    )}
                  </div>
                )}
                {showPromptChat && (
                  <button type="button" onClick={() => setShowPromptChat(false)} className="p-1.5 -ml-1 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center gap-1">
                    <ChevronLeft className="w-4 h-4" />
                    <span className="text-sm">К промту</span>
                  </button>
                )}
              </div>
              <button type="button" onClick={() => { setShowPromptModal(false); setShowPromptChat(false); }} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">×</button>
            </div>
            {showPromptChat ? (
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {promptChatMessages.length === 0 && (
                    <p className="text-slate-500 text-sm">Напишите, что хотите изменить в промте. Например: «сделай короче», «добавь больше хуков в начале», «убери воду».</p>
                  )}
                  {promptChatMessages.map((m, i) => (
                    <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                        m.role === 'user' ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-800'
                      )}>
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      </div>
                    </div>
                  ))}
                  {isPromptChatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-100 rounded-2xl px-4 py-2.5 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-slate-500" />
                        <span className="text-sm text-slate-600">Думаю...</span>
                      </div>
                    </div>
                  )}
                </div>
                {pendingSuggestedPrompt && (
                  <div className="px-4 pb-2">
                    <button
                      type="button"
                      onClick={handleApplySuggestedPrompt}
                      disabled={isSavingPrompt}
                      className="w-full py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium flex items-center justify-center gap-2"
                    >
                      {isSavingPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      Применить предложенный промт
                    </button>
                  </div>
                )}
                <div className="p-4 border-t border-slate-100">
                  <div className="flex gap-2">
                    <textarea
                      value={promptChatInput}
                      onChange={(e) => setPromptChatInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handlePromptChatSend(); } }}
                      placeholder="Что изменить в промте?"
                      rows={2}
                      disabled={isPromptChatLoading}
                      className="flex-1 p-3 rounded-xl border border-slate-200 text-sm resize-none focus:ring-2 focus:ring-violet-200 focus:border-violet-400 disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={handlePromptChatSend}
                      disabled={isPromptChatLoading || !promptChatInput.trim()}
                      className="self-end px-4 py-2 rounded-xl bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                    >
                      {isPromptChatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                      Отправить
                      <TokenBadge tokens={getTokenCost('chat_with_prompt')} variant="dark" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Текст промта (используется при генерации «По стилю»)</label>
                {isEditingPrompt ? (
                  <textarea
                    value={editedPromptText}
                    onChange={(e) => setEditedPromptText(e.target.value)}
                    className="w-full min-h-[200px] p-3 rounded-xl border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-400 resize-y"
                    placeholder="Промт..."
                  />
                ) : (
                  <pre className="w-full p-3 rounded-xl border border-slate-100 bg-slate-50 text-sm text-slate-700 whitespace-pre-wrap font-sans max-h-[300px] overflow-y-auto">{currentPromptStyle?.prompt || currentProject?.stylePrompt}</pre>
                )}
              </div>
              {((currentPromptStyle?.meta || currentProject?.styleMeta) && ((currentPromptStyle?.meta || currentProject?.styleMeta)?.rules?.length || (currentPromptStyle?.meta || currentProject?.styleMeta)?.doNot?.length || (currentPromptStyle?.meta || currentProject?.styleMeta)?.summary)) && (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-2">
                  {(currentPromptStyle?.meta || currentProject?.styleMeta)?.summary && (
                    <p className="text-sm text-slate-600"><span className="font-medium text-slate-700">Кратко:</span> {(currentPromptStyle?.meta || currentProject?.styleMeta)?.summary}</p>
                  )}
                  {((currentPromptStyle?.meta || currentProject?.styleMeta)?.rules?.length) ? (
                    <div>
                      <span className="text-xs font-medium text-slate-500">Правила:</span>
                      <ul className="list-disc list-inside text-sm text-slate-600 mt-1">{(currentPromptStyle?.meta || currentProject?.styleMeta)?.rules?.map((r, i) => <li key={i}>{r}</li>)}</ul>
                    </div>
                  ) : null}
                  {((currentPromptStyle?.meta || currentProject?.styleMeta)?.doNot?.length) ? (
                    <div>
                      <span className="text-xs font-medium text-slate-500">Избегать:</span>
                      <ul className="list-disc list-inside text-sm text-slate-600 mt-1">{(currentPromptStyle?.meta || currentProject?.styleMeta)?.doNot?.map((d, i) => <li key={i}>{d}</li>)}</ul>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
            )}
            <div className="p-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
              {!showPromptChat ? (
                <>
                  <button
                    type="button"
                    onClick={openPromptChat}
                    className="px-3 py-1.5 rounded-lg border border-violet-200 text-violet-600 text-sm font-medium hover:bg-violet-50 flex items-center gap-1.5"
                  >
                    <MessageCircle className="w-4 h-4" /> Пообщаться с нейронкой
                  </button>
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(isEditingPrompt ? editedPromptText : (currentPromptStyle?.prompt || currentProject?.stylePrompt || ''))}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 flex items-center gap-1.5"
                  >
                    <Copy className="w-4 h-4" /> Копировать промт
                  </button>
              {isEditingPrompt ? (
                <>
                  <button type="button" onClick={handleSaveEditedPrompt} disabled={isSavingPrompt} className="px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1.5">
                    {isSavingPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Сохранить
                  </button>
                  <button type="button" onClick={() => { setIsEditingPrompt(false); setEditedPromptText(currentPromptStyle?.prompt || currentProject?.stylePrompt || ''); }} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
                    Отмена
                  </button>
                </>
              ) : (
                <button type="button" onClick={() => { setIsEditingPrompt(true); setEditedPromptText(currentPromptStyle?.prompt || currentProject?.stylePrompt || ''); }} className="px-3 py-1.5 rounded-lg border border-violet-200 text-violet-600 text-sm font-medium hover:bg-violet-50">
                  Редактировать промт
                </button>
              )}
                </>
              ) : null}
              <button type="button" onClick={() => { setShowPromptModal(false); setShowPromptChat(false); }} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 ml-auto">
                Закрыть
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно: выбор способа обратной связи */}
      {showChoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setShowChoiceModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 mb-1">Как хотите дать обратную связь?</h3>
            <p className="text-slate-500 text-sm mb-4">Нейросеть дообучится на ваших правках или пояснениях.</p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => { setShowChoiceModal(false); setShowFeedbackModal(true); }}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="font-medium">Написать текстом</span> — что не так и что отлично
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowChoiceModal(false);
                  setScriptAiForRefine(script || '');
                  setScriptHumanForRefine(script || '');
                  setEditScriptLeftTab('ai');
                  setShowEditScriptModal(true);
                }}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-left text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <span className="font-medium">Сам допилю сценарий</span> — отредактировать сценарий ИИ, нейросеть дообучится на ваших правках
              </button>
            </div>
            <button type="button" onClick={() => setShowChoiceModal(false)} className="mt-4 w-full py-2 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50">
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Модальное окно: обратная связь по сгенерированному сценарию — дообучение промта */}
      {showFeedbackModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !isRefiningPrompt && setShowFeedbackModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Что не так сделал сценарий?</h3>
              <p className="text-slate-500 text-sm mt-1">
                Опишите, что не так и что хорошо. Промт проекта обновится, и в следующий раз генерация учтёт вашу обратную связь.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <textarea
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Например: слишком длинные предложения, не хватало хука в начале, хорошо что сохранил структуру по пунктам..."
                className="w-full min-h-[120px] p-3 rounded-xl border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-400 resize-y"
                disabled={isRefiningPrompt}
              />
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" onClick={() => setShowFeedbackModal(false)} disabled={isRefiningPrompt} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
                Отмена
              </button>
              <button type="button" onClick={handleRefinePrompt} disabled={isRefiningPrompt || !feedbackText.trim()} className="px-4 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50">
                {isRefiningPrompt ? <><Loader2 className="w-4 h-4 animate-spin" /> Дообучение...</> : <>Отправить и дообучить промт <TokenBadge tokens={getTokenCost('refine_prompt')} variant="dark" /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно: сценарий ИИ → ваш идеальный — дообучение на правках */}
      {showEditScriptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !isRefiningPrompt && setShowEditScriptModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Сценарий ИИ-помощник → ваш идеальный</h3>
              <p className="text-slate-500 text-sm mt-1">
                Слева — переключайте вкладки (исходник, перевод, сценарий ИИ). Справа — ваш идеальный сценарий. Промт дообучится на ваших правках.
              </p>
            </div>
            <div className="flex-1 overflow-hidden flex flex-col md:flex-row gap-4 p-4 min-h-0">
              <div className="flex-1 flex flex-col min-h-0">
                <div className="flex rounded-lg p-0.5 bg-slate-100 mb-2">
                  {(['original', 'translation', 'ai'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setEditScriptLeftTab(tab)}
                      className={cn(
                        'flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                        editScriptLeftTab === tab
                          ? 'bg-white text-slate-800 shadow-sm'
                          : 'text-slate-500 hover:text-slate-700'
                      )}
                    >
                      {tab === 'original' ? 'Изначальный' : tab === 'translation' ? 'Перевод' : 'Сценарий ИИ'}
                    </button>
                  ))}
                </div>
                <pre className="flex-1 min-h-[200px] p-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-700 overflow-auto whitespace-pre-wrap font-sans">
                  {editScriptLeftTab === 'original'
                    ? (transcript || '—')
                    : editScriptLeftTab === 'translation'
                    ? (translation || '—')
                    : (scriptAiForRefine || '—')}
                </pre>
              </div>
              <div className="flex-1 flex flex-col min-h-0">
                <label className="text-xs font-medium text-slate-500 mb-1">Ваш идеальный сценарий</label>
                <textarea
                  value={scriptHumanForRefine}
                  onChange={(e) => setScriptHumanForRefine(e.target.value)}
                  className="flex-1 min-h-[200px] p-3 rounded-xl border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-400 resize-none"
                  placeholder="Отредактируйте сценарий..."
                  disabled={isRefiningPrompt}
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button type="button" onClick={() => setShowEditScriptModal(false)} disabled={isRefiningPrompt} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
                Отмена
              </button>
              <button
                type="button"
                onClick={handleRefineByDiff}
                disabled={isRefiningPrompt || scriptHumanForRefine.trim() === scriptAiForRefine.trim()}
                className="px-4 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
              >
                {isRefiningPrompt ? <><Loader2 className="w-4 h-4 animate-spin" /> Дообучение...</> : <>Дообучить промт на этом примере <TokenBadge tokens={getTokenCost('refine_prompt')} variant="dark" /></>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно: уточняющий вопрос нейросети */}
      {showClarifyModal && clarifyingQuestions[clarifyingIndex] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !isRefiningPrompt && setShowClarifyModal(false)}>
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-slate-800 mb-1">Нейросеть уточняет</h3>
            <p className="text-slate-600 text-sm mb-4">{clarifyingQuestions[clarifyingIndex]}</p>
            <textarea
              value={clarifyAnswer}
              onChange={(e) => setClarifyAnswer(e.target.value)}
              placeholder="Ваш ответ..."
              className="w-full min-h-[80px] p-3 rounded-xl border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-violet-200 focus:border-violet-400 resize-y mb-4"
              disabled={isRefiningPrompt}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">
                {clarifyingIndex + 1} из {clarifyingQuestions.length}
              </span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setShowClarifyModal(false)} disabled={isRefiningPrompt} className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50">
                  Пропустить
                </button>
                <button
                  type="button"
                  onClick={handleClarifySubmit}
                  disabled={isRefiningPrompt || !clarifyAnswer.trim()}
                  className="px-4 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {isRefiningPrompt ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Отправить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
