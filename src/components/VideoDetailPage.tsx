import { useState, useEffect } from 'react';
import { 
  ChevronLeft, Play, Eye, Heart, MessageCircle, Calendar, 
  Sparkles, FileText, Copy, ExternalLink, Loader2, Check,
  Wand2
} from 'lucide-react';
import { cn } from '../utils/cn';
import { checkTranscriptionStatus } from '../services/transcriptionService';
import { supabase } from '../utils/supabase';
import { toast } from 'sonner';

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

export function VideoDetailPage({ video, onBack }: VideoDetailPageProps) {
  const [activeTab, setActiveTab] = useState<'transcript' | 'script'>('transcript');
  const [transcript, setTranscript] = useState(video.transcript_text || '');
  const [transcriptStatus, setTranscriptStatus] = useState(video.transcript_status || 'pending');
  const [script, setScript] = useState('');
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [copied, setCopied] = useState(false);

  // Polling для статуса транскрибации
  useEffect(() => {
    if (video.transcript_id && transcriptStatus !== 'completed' && transcriptStatus !== 'error') {
      const interval = setInterval(async () => {
        const result = await checkTranscriptionStatus(video.transcript_id!);
        setTranscriptStatus(result.status);
        
        if (result.status === 'completed' && result.text) {
          setTranscript(result.text);
          // Сохраняем в БД
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
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    toast.success('Транскрибация скопирована');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateScript = async () => {
    if (!transcript) {
      toast.error('Сначала дождитесь транскрибации');
      return;
    }
    
    setIsGeneratingScript(true);
    // TODO: Интеграция с AI для генерации сценария
    setTimeout(() => {
      setScript(`# Сценарий на основе видео\n\n## Хук (0-3 сек)\n"${transcript.slice(0, 50)}..."\n\n## Основная часть\n[Ваш контент здесь]\n\n## Призыв к действию\n[CTA]`);
      setIsGeneratingScript(false);
      setActiveTab('script');
      toast.success('Сценарий сгенерирован');
    }, 2000);
  };

  const thumbnailUrl = video.preview_url || 'https://via.placeholder.com/400x600';

  return (
    <div className="h-full overflow-hidden flex flex-col bg-[#f5f5f5]">
      <div className="max-w-6xl mx-auto w-full p-6 flex flex-col h-full">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4 transition-colors active:scale-95"
          >
            <ChevronLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Назад</span>
          </button>
          
          <h1 className="text-2xl md:text-3xl font-serif italic text-neutral-900 tracking-tighter">
            Работа с видео
          </h1>
          <p className="text-neutral-500 text-sm">
            @{video.owner_username || 'instagram'}
          </p>
        </div>

        {/* Main content */}
        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Left: Video preview */}
          <div className="w-72 flex-shrink-0 flex flex-col gap-4">
            {/* Video card */}
            <div className="relative rounded-2xl overflow-hidden shadow-xl group">
              <img
                src={thumbnailUrl}
                alt=""
                className="w-full aspect-[9/16] object-cover"
              />
              
              {/* Play button overlay */}
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <div className="w-16 h-16 rounded-full bg-white/95 flex items-center justify-center shadow-2xl">
                  <Play className="w-7 h-7 text-slate-800 ml-1" fill="currentColor" />
                </div>
              </a>
              
              {/* Status badge */}
              <div className="absolute top-3 left-3">
                {transcriptStatus === 'processing' || transcriptStatus === 'downloading' ? (
                  <div className="px-3 py-1.5 rounded-full bg-amber-500 text-white text-xs font-semibold flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Обработка
                  </div>
                ) : transcriptStatus === 'completed' ? (
                  <div className="px-3 py-1.5 rounded-full bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5">
                    <Check className="w-3 h-3" />
                    Готово
                  </div>
                ) : transcriptStatus === 'error' ? (
                  <div className="px-3 py-1.5 rounded-full bg-red-500 text-white text-xs font-semibold">
                    Ошибка
                  </div>
                ) : (
                  <div className="px-3 py-1.5 rounded-full bg-slate-500 text-white text-xs font-semibold">
                    Ожидание
                  </div>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Статистика</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Eye className="w-4 h-4" />
                    <span className="text-sm">Просмотры</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{formatNumber(video.view_count)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Heart className="w-4 h-4" />
                    <span className="text-sm">Лайки</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{formatNumber(video.like_count)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-500">
                    <MessageCircle className="w-4 h-4" />
                    <span className="text-sm">Комментарии</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{formatNumber(video.comment_count)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Calendar className="w-4 h-4" />
                    <span className="text-sm">Дата</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800">{formatDate(video.taken_at)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-slate-500">
                    <Sparkles className="w-4 h-4" />
                    <span className="text-sm">Виральность</span>
                  </div>
                  <span className="text-sm font-semibold text-emerald-600">Высокая</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="space-y-2">
              <a
                href={video.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                Открыть в Instagram
              </a>
            </div>
          </div>

          {/* Right: Transcript & Script */}
          <div className="flex-1 flex flex-col min-w-0">
            {/* Tabs */}
            <div className="flex items-center gap-2 mb-4">
              <button
                onClick={() => setActiveTab('transcript')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                  activeTab === 'transcript'
                    ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Транскрибация
                </div>
              </button>
              <button
                onClick={() => setActiveTab('script')}
                className={cn(
                  "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                  activeTab === 'script'
                    ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg"
                    : "bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <Wand2 className="w-4 h-4" />
                  Мой сценарий
                </div>
              </button>
              
              <div className="flex-1" />
              
              {activeTab === 'transcript' && transcript && (
                <button
                  onClick={handleCopyTranscript}
                  className="px-3 py-2 rounded-xl bg-white text-slate-600 hover:bg-slate-50 text-sm font-medium transition-colors flex items-center gap-2"
                >
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Скопировано' : 'Копировать'}
                </button>
              )}
              
              {activeTab === 'transcript' && transcript && (
                <button
                  onClick={handleGenerateScript}
                  disabled={isGeneratingScript}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-medium hover:from-violet-400 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/30 flex items-center gap-2 disabled:opacity-50"
                >
                  {isGeneratingScript ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4" />
                  )}
                  Создать сценарий
                </button>
              )}
            </div>

            {/* Content area */}
            <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden">
              {activeTab === 'transcript' ? (
                <div className="h-full flex flex-col">
                  {transcriptStatus === 'processing' || transcriptStatus === 'downloading' ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-4">
                        <Loader2 className="w-8 h-8 text-amber-600 animate-spin" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-800 mb-2">Транскрибация в процессе</h3>
                      <p className="text-slate-500 text-sm max-w-md">
                        Видео обрабатывается. Это может занять несколько минут в зависимости от длины видео.
                      </p>
                    </div>
                  ) : transcript ? (
                    <div className="flex-1 overflow-y-auto p-6">
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{transcript}</p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8 text-slate-400" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-800 mb-2">Транскрибация недоступна</h3>
                      <p className="text-slate-500 text-sm max-w-md">
                        {transcriptStatus === 'error' 
                          ? 'Произошла ошибка при обработке видео. Попробуйте ещё раз.'
                          : 'Транскрибация будет доступна после обработки видео.'
                        }
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-full flex flex-col">
                  {script ? (
                    <div className="flex-1 overflow-y-auto p-6">
                      <textarea
                        value={script}
                        onChange={(e) => setScript(e.target.value)}
                        className="w-full h-full resize-none text-slate-700 leading-relaxed focus:outline-none"
                        placeholder="Ваш сценарий..."
                      />
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                      <div className="w-16 h-16 rounded-2xl bg-violet-100 flex items-center justify-center mb-4">
                        <Wand2 className="w-8 h-8 text-violet-500" />
                      </div>
                      <h3 className="text-lg font-medium text-slate-800 mb-2">Создайте свой сценарий</h3>
                      <p className="text-slate-500 text-sm max-w-md mb-4">
                        Используйте транскрибацию как основу и создайте свой уникальный сценарий с помощью AI.
                      </p>
                      <button
                        onClick={handleGenerateScript}
                        disabled={!transcript || isGeneratingScript}
                        className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium hover:from-violet-400 hover:to-purple-500 transition-all shadow-lg shadow-violet-500/30 flex items-center gap-2 disabled:opacity-50"
                      >
                        {isGeneratingScript ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <Wand2 className="w-5 h-5" />
                        )}
                        Сгенерировать из транскрибации
                      </button>
                    </div>
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
