import { useState, useEffect } from 'react';
import { 
  ChevronLeft, Play, Eye, Heart, MessageCircle, Calendar, 
  Sparkles, FileText, Copy, ExternalLink, Loader2, Check,
  Wand2, Languages, RefreshCw, ChevronDown
} from 'lucide-react';
import { cn } from '../utils/cn';
import { checkTranscriptionStatus } from '../services/transcriptionService';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';
import { useInboxVideos } from '../hooks/useInboxVideos';
import { useProjectContext } from '../contexts/ProjectContext';

interface VideoData {
  id: string;
  title?: string;
  preview_url?: string;
  url?: string;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  owner_username?: string;
  taken_at?: string;
  transcript_id?: string;
  transcript_status?: string;
  transcript_text?: string;
  download_url?: string;
  folder_id?: string;
}

interface VideoDetailPageProps {
  video: VideoData;
  onBack: () => void;
}

function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const date = new Date(Number(dateStr) * 1000);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function calculateViralCoefficient(views?: number, takenAt?: string): number {
  if (!views) return 0;
  
  let daysOld = 30; // по умолчанию
  
  if (takenAt) {
    const ts = Number(takenAt);
    if (!isNaN(ts)) {
      const videoDate = ts > 1e12 ? new Date(ts) : new Date(ts * 1000);
      if (!isNaN(videoDate.getTime())) {
        daysOld = Math.max(1, Math.floor((Date.now() - videoDate.getTime()) / (1000 * 60 * 60 * 24)));
      }
    }
  }
  
  // K просмотров в день
  return Math.round((views / daysOld / 1000) * 10) / 10;
}

export function VideoDetailPage({ video, onBack }: VideoDetailPageProps) {
  const [transcriptTab, setTranscriptTab] = useState<'original' | 'translation'>('original');
  const [transcript, setTranscript] = useState(video.transcript_text || '');
  const [translation, setTranslation] = useState('');
  const [transcriptStatus, setTranscriptStatus] = useState(video.transcript_status || 'pending');
  const [script, setScript] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState(video.folder_id || null);
  
  const { updateVideoFolder } = useInboxVideos();
  const { currentProject } = useProjectContext();
  const viralCoef = calculateViralCoefficient(video.view_count, video.taken_at);
  
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

  // Polling для статуса транскрибации
  useEffect(() => {
    if (video.transcript_id && transcriptStatus !== 'completed' && transcriptStatus !== 'error') {
      const interval = setInterval(async () => {
        const result = await checkTranscriptionStatus(video.transcript_id!);
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
  }, [video.transcript_id, video.id, transcriptStatus]);

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
    
    setIsTranslating(true);
    // TODO: Интеграция с API перевода
    setTimeout(() => {
      setTranslation(`[Перевод на русский]\n\n${transcript.split(' ').slice(0, 20).join(' ')}...\n\n(Здесь будет полный перевод текста)`);
      setIsTranslating(false);
      setTranscriptTab('translation');
      toast.success('Текст переведён');
    }, 1500);
  };

  const handleGenerateScript = async () => {
    if (!transcript) {
      toast.error('Сначала дождитесь транскрибации');
      return;
    }
    
    setIsGeneratingScript(true);
    // TODO: Интеграция с AI для генерации сценария
    setTimeout(() => {
      setScript(`# Сценарий на основе видео

## Хук (0-3 сек)
"${transcript.slice(0, 50)}..."

## Основная часть
[Ваш контент здесь]

## Призыв к действию
[CTA]`);
      setIsGeneratingScript(false);
      toast.success('Сценарий сгенерирован');
    }, 2000);
  };

  const thumbnailUrl = video.preview_url || 'https://via.placeholder.com/400x600';
  
  // Извлекаем video ID из URL для embed
  const getInstagramEmbedUrl = (url?: string) => {
    if (!url) return null;
    const match = url.match(/reel\/([^\/\?]+)/);
    if (match) {
      return `https://www.instagram.com/reel/${match[1]}/embed`;
    }
    return null;
  };

  const embedUrl = getInstagramEmbedUrl(video.url);

  return (
    <div className="h-full overflow-hidden flex flex-col bg-[#f5f5f5]">
      <div className="w-full h-full p-6 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-700 transition-colors active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
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

          {/* Status badge */}
          <div>
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

        {/* Main content - 3 columns */}
        <div className="flex-1 flex gap-4 overflow-hidden min-h-0">
          {/* Left: Video preview */}
          <div className="w-64 flex-shrink-0 flex flex-col gap-3 overflow-y-auto custom-scrollbar-light">
            {/* Video card */}
            <div className="relative rounded-2xl overflow-hidden shadow-xl bg-black">
              {showVideo && embedUrl ? (
                <div className="aspect-[9/16] w-full">
                  <iframe
                    src={embedUrl}
                    className="w-full h-full"
                    frameBorder="0"
                    scrolling="no"
                    allowTransparency
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="relative group">
                  <img
                    src={thumbnailUrl}
                    alt=""
                    className="w-full aspect-[9/16] object-cover"
                  />
                  
                  {/* Play button overlay */}
                  <button
                    onClick={() => setShowVideo(true)}
                    className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-2xl">
                      <Play className="w-6 h-6 text-slate-800 ml-1" fill="currentColor" />
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Current folder + move */}
            <div className="bg-white rounded-xl p-3 shadow-sm relative">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">Папка</span>
              </div>
              <button
                onClick={() => setShowFolderMenu(!showFolderMenu)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
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
                <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-slate-100 p-1.5 z-50">
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
            <div className="bg-white rounded-xl p-3 shadow-sm">
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
              
              <div className="mt-3 pt-3 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm">Виральность</span>
                  </div>
                  <span className={cn(
                    "text-sm font-bold",
                    viralCoef > 10 ? "text-emerald-600" : viralCoef > 5 ? "text-amber-600" : "text-slate-600"
                  )}>
                    {viralCoef.toFixed(1)}K/день
                  </span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <a
              href={video.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors shadow-sm"
            >
              <ExternalLink className="w-4 h-4" />
              Открыть в Instagram
            </a>
          </div>

          {/* Middle: Transcript */}
          <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Transcript header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" />
                <h3 className="font-semibold text-slate-800">Транскрибация</h3>
              </div>
              
              <div className="flex items-center gap-2">
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
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">{transcript}</p>
              ) : transcriptTab === 'translation' && translation ? (
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap text-sm">{translation}</p>
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
                  <FileText className="w-10 h-10 text-slate-300 mb-3" />
                  <p className="text-slate-600 font-medium">Транскрибация недоступна</p>
                  <p className="text-slate-400 text-sm">
                    {transcriptStatus === 'error' 
                      ? 'Произошла ошибка при обработке'
                      : 'Добавьте видео в "Идеи" для обработки'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Script */}
          <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* Script header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Wand2 className="w-5 h-5 text-violet-500" />
                <h3 className="font-semibold text-slate-800">Мой сценарий</h3>
              </div>
              
              <div className="flex items-center gap-2">
                {!script && transcript && (
                  <button
                    onClick={handleGenerateScript}
                    disabled={isGeneratingScript}
                    className="px-3 py-1.5 rounded-lg bg-gradient-to-r from-violet-500 to-purple-600 text-white text-xs font-medium hover:from-violet-400 hover:to-purple-500 transition-all shadow-sm flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {isGeneratingScript ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Wand2 className="w-3.5 h-3.5" />
                    )}
                    Сгенерировать
                  </button>
                )}
                
                {script && (
                  <>
                    <button
                      onClick={handleGenerateScript}
                      disabled={isGeneratingScript}
                      className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors disabled:opacity-50"
                      title="Перегенерировать"
                    >
                      {isGeneratingScript ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
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
            
            {/* Script content */}
            <div className="flex-1 overflow-hidden p-4">
              {script ? (
                <textarea
                  value={script}
                  onChange={(e) => setScript(e.target.value)}
                  className="w-full h-full resize-none text-slate-700 text-sm leading-relaxed focus:outline-none"
                  placeholder="Ваш сценарий..."
                />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                  <Wand2 className="w-10 h-10 text-violet-300 mb-3" />
                  <p className="text-slate-600 font-medium">Создайте свой сценарий</p>
                  <p className="text-slate-400 text-sm mb-4">
                    На основе транскрибации или с нуля
                  </p>
                  {transcript ? (
                    <button
                      onClick={handleGenerateScript}
                      disabled={isGeneratingScript}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-medium hover:from-violet-400 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/30 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isGeneratingScript ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wand2 className="w-4 h-4" />
                      )}
                      Сгенерировать из транскрибации
                    </button>
                  ) : (
                    <button
                      onClick={() => setScript('# Мой сценарий\n\n## Хук\n\n\n## Основная часть\n\n\n## CTA\n')}
                      className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <FileText className="w-4 h-4" />
                      Начать с шаблона
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
