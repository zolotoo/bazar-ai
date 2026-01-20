import { useState } from 'react';
import { useSearchHistory, SearchHistoryEntry } from '../hooks/useSearchHistory';
import { useFlowStore } from '../stores/flowStore';
import { useInboxVideos } from '../hooks/useInboxVideos';
import { InstagramSearchResult } from '../services/videoService';
import { Search, Clock, Video, Eye, Heart, ExternalLink, Trash2, X, ChevronLeft, Plus, Sparkles } from 'lucide-react';
import { cn } from '../utils/cn';
import { toast } from 'sonner';

type TabType = 'queries' | 'videos';

function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Расчёт коэффициента виральности
function calculateViralCoefficient(views?: number, takenAt?: string | number | Date): number {
  if (!views || views < 30000 || !takenAt) return 0;
  
  let videoDate: Date;
  
  if (takenAt instanceof Date) {
    videoDate = takenAt;
  } else if (typeof takenAt === 'string') {
    if (takenAt.includes('T') || takenAt.includes('-')) {
      videoDate = new Date(takenAt);
    } else {
      videoDate = new Date(Number(takenAt) * 1000);
    }
  } else if (typeof takenAt === 'number') {
    videoDate = takenAt > 1e12 ? new Date(takenAt) : new Date(takenAt * 1000);
  } else {
    return 0;
  }
  
  if (isNaN(videoDate.getTime())) return 0;
  
  const today = new Date();
  const diffTime = today.getTime() - videoDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return 0;
  
  return Math.round((views / (diffDays * 1000)) * 100) / 100;
}

// Форматирование даты видео
function formatVideoDate(takenAt?: string | number | Date): string {
  if (!takenAt) return '';
  
  let videoDate: Date;
  
  if (takenAt instanceof Date) {
    videoDate = takenAt;
  } else if (typeof takenAt === 'string') {
    if (takenAt.includes('T') || takenAt.includes('-')) {
      videoDate = new Date(takenAt);
    } else {
      videoDate = new Date(Number(takenAt) * 1000);
    }
  } else if (typeof takenAt === 'number') {
    videoDate = takenAt > 1e12 ? new Date(takenAt) : new Date(takenAt * 1000);
  } else {
    return '';
  }
  
  if (isNaN(videoDate.getTime())) return '';
  
  const now = new Date();
  const diffTime = now.getTime() - videoDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  if (diffDays < 7) return `${diffDays} дн.`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} нед.`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)} мес.`;
  return `${Math.floor(diffDays / 365)} г.`;
}

function formatDate(date: Date): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Вчера';
  if (days < 7) return `${days} дн. назад`;
  
  return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function History() {
  const [activeTab, setActiveTab] = useState<TabType>('queries');
  const [selectedEntry, setSelectedEntry] = useState<SearchHistoryEntry | null>(null);
  const { historyEntries, removeFromHistory, clearHistory } = useSearchHistory();
  const { incomingVideos } = useFlowStore();
  const { addVideoToInbox, removeVideo } = useInboxVideos();

  const handleAddToInbox = async (reel: InstagramSearchResult) => {
    let captionText = typeof reel.caption === 'string' ? reel.caption : '';
    if (captionText.length > 200) {
      captionText = captionText.substring(0, 200) + '...';
    }
    
    try {
      await addVideoToInbox({
        title: captionText || 'Видео из Instagram',
        previewUrl: reel.thumbnail_url || reel.display_url || '',
        url: reel.url,
        viewCount: reel.view_count,
        likeCount: reel.like_count,
        commentCount: reel.comment_count,
        ownerUsername: reel.owner?.username,
      });
      toast.success('Видео добавлено', {
        description: `@${reel.owner?.username || 'instagram'}`,
      });
    } catch (err) {
      console.error('Ошибка сохранения видео:', err);
      toast.error('Ошибка сохранения');
    }
  };

  // Детальный просмотр результатов запроса
  if (selectedEntry) {
    return (
      <div className="h-full overflow-hidden flex flex-col">
        <div className="max-w-6xl mx-auto w-full p-6 pt-20 flex flex-col h-full">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => setSelectedEntry(null)}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4 transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Назад к истории</span>
            </button>
            
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Search className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-serif italic text-neutral-900 tracking-tighter">
                  "{selectedEntry.query}"
                </h1>
                <p className="text-neutral-500 text-sm">
                  {formatDate(selectedEntry.searchedAt)} в {formatTime(selectedEntry.searchedAt)} • {selectedEntry.resultsCount} результатов
                </p>
              </div>
            </div>
          </div>

          {/* Results Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar-light">
            {selectedEntry.results.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center mb-4">
                  <Video className="w-8 h-8 text-slate-300" />
                </div>
                <h3 className="text-lg font-medium text-slate-800 mb-1">Результаты не сохранены</h3>
                <p className="text-slate-500 text-sm">Этот поиск был выполнен до обновления</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                {selectedEntry.results.map((reel, idx) => {
                  const captionText = typeof reel.caption === 'string' ? reel.caption : 'Видео из Instagram';
                  const thumbnailUrl = reel.thumbnail_url || reel.display_url || 'https://via.placeholder.com/270x360';
                  const viralCoef = calculateViralCoefficient(reel.view_count, reel.taken_at);
                  const dateText = formatVideoDate(reel.taken_at);
                  
                  return (
                    <div
                      key={`history-${reel.shortcode || reel.id}-${idx}`}
                      className="group relative rounded-[1.5rem] overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-white"
                    >
                      {/* Image section */}
                      <div className="relative w-full" style={{ aspectRatio: '3/4' }}>
                        <img
                          src={thumbnailUrl}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://via.placeholder.com/270x360?text=Video';
                          }}
                        />
                        
                        {/* Dark gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                        
                        {/* Viral coefficient badge (top left) */}
                        <div className="absolute top-3 left-3 z-10">
                          <div className={cn(
                            "px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1.5 shadow-lg",
                            viralCoef > 10 ? "bg-emerald-500 text-white" : 
                            viralCoef > 5 ? "bg-amber-500 text-white" :
                            viralCoef > 0 ? "bg-white/90 text-slate-700" :
                            "bg-black/40 text-white/70"
                          )}>
                            <Sparkles className="w-3 h-3" />
                            <span className="text-xs font-bold">{viralCoef > 0 ? viralCoef : '—'}</span>
                          </div>
                        </div>
                        
                        {/* Date badge (top right) */}
                        <div className="absolute top-3 right-3 z-10">
                          <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-sm font-semibold shadow-lg">
                            {dateText || '—'}
                          </div>
                        </div>
                        
                        {/* Hover overlay with actions */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                          <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-2xl">
                            <Plus className="w-6 h-6 text-slate-800" />
                          </div>
                        </div>
                        
                        {/* Bottom info overlay */}
                        <div className="absolute bottom-0 left-0 right-0 p-4">
                          {/* Username */}
                          <div className="flex items-center gap-1.5 mb-1">
                            <h3 className="font-semibold text-white text-sm truncate drop-shadow-lg">
                              @{reel.owner?.username || 'instagram'}
                            </h3>
                            {viralCoef > 5 && (
                              <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              </div>
                            )}
                          </div>
                          
                          {/* Description */}
                          <p className="text-white/80 text-xs leading-relaxed line-clamp-2 mb-3 drop-shadow">
                            {captionText.slice(0, 60)}{captionText.length > 60 ? '...' : ''}
                          </p>
                          
                          {/* Stats and add button */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-white/90">
                              <div className="flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">{formatNumber(reel.view_count)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Heart className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">{formatNumber(reel.like_count)}</span>
                              </div>
                            </div>
                            
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToInbox(reel);
                              }}
                              className="w-9 h-9 rounded-full bg-white text-slate-800 hover:bg-orange-500 hover:text-white flex items-center justify-center transition-all active:scale-95 shadow-lg"
                            >
                              <Plus className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="max-w-5xl mx-auto w-full p-6 pt-20 flex flex-col h-full">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-4xl md:text-5xl font-serif italic text-neutral-900 tracking-tighter">
            История
          </h1>
          <p className="text-neutral-500 text-base mt-1">
            Все твои поиски и сохранённые видео
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-6">
          <button
            onClick={() => setActiveTab('queries')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
              activeTab === 'queries'
                ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/20"
                : "bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            <Search className="w-4 h-4" />
            Запросы
            <span className={cn(
              "ml-1 px-1.5 py-0.5 rounded-full text-xs",
              activeTab === 'queries' ? "bg-white/20" : "bg-slate-100"
            )}>
              {historyEntries.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('videos')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2",
              activeTab === 'videos'
                ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/20"
                : "bg-white text-slate-600 hover:bg-slate-50"
            )}
          >
            <Video className="w-4 h-4" />
            Сохранённые
            <span className={cn(
              "ml-1 px-1.5 py-0.5 rounded-full text-xs",
              activeTab === 'videos' ? "bg-white/20" : "bg-slate-100"
            )}>
              {incomingVideos.length}
            </span>
          </button>
          
          {activeTab === 'queries' && historyEntries.length > 0 && (
            <button
              onClick={clearHistory}
              className="ml-auto px-3 py-2 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4" />
              Очистить
            </button>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar-light">
          {/* Queries Tab */}
          {activeTab === 'queries' && (
            <>
              {historyEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center mb-4">
                    <Search className="w-8 h-8 text-orange-500" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-800 mb-1">Нет запросов</h3>
                  <p className="text-slate-500 text-sm">История поиска пуста</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {historyEntries.map((entry) => (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedEntry(entry)}
                      className="group bg-white rounded-2xl p-4 flex items-center gap-4 hover:shadow-md transition-all cursor-pointer"
                    >
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center flex-shrink-0">
                        <Search className="w-5 h-5 text-orange-500" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-800 truncate">{entry.query}</p>
                        <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDate(entry.searchedAt)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Video className="w-3 h-3" />
                            {entry.resultsCount} видео
                          </span>
                        </div>
                      </div>

                      {/* Preview thumbnails */}
                      {entry.results.length > 0 && (
                        <div className="hidden sm:flex -space-x-2">
                          {entry.results.slice(0, 3).map((reel, idx) => (
                            <div
                              key={reel.id}
                              className="w-10 h-14 rounded-lg overflow-hidden ring-2 ring-white shadow-sm"
                              style={{ zIndex: 3 - idx }}
                            >
                              <img
                                src={reel.thumbnail_url || reel.display_url}
                                alt=""
                                className="w-full h-full object-cover"
                              />
                            </div>
                          ))}
                          {entry.results.length > 3 && (
                            <div className="w-10 h-14 rounded-lg bg-slate-100 ring-2 ring-white flex items-center justify-center text-xs font-medium text-slate-500">
                              +{entry.results.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          removeFromHistory(entry.query);
                        }}
                        className="p-2 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* Videos Tab */}
          {activeTab === 'videos' && (
            <>
              {incomingVideos.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-64 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white shadow-lg flex items-center justify-center mb-4">
                    <Video className="w-8 h-8 text-orange-500" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-800 mb-1">Нет сохранённых видео</h3>
                  <p className="text-slate-500 text-sm">Добавьте видео через поиск</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                  {incomingVideos.map((video, idx) => {
                    const videoData = video as any;
                    const thumbnailUrl = video.previewUrl || 'https://via.placeholder.com/270x360';
                    const viralCoef = calculateViralCoefficient(videoData.view_count, videoData.taken_at || videoData.receivedAt?.toISOString());
                    const dateText = formatVideoDate(videoData.taken_at || video.receivedAt);
                    
                    return (
                      <div
                        key={`saved-${video.id}-${idx}`}
                        className="group relative rounded-[1.5rem] overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] bg-white"
                      >
                        {/* Image section */}
                        <div className="relative w-full" style={{ aspectRatio: '3/4' }}>
                          <img
                            src={thumbnailUrl}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/270x360?text=Video';
                            }}
                          />
                          
                          {/* Dark gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          
                          {/* Viral coefficient badge (top left) */}
                          <div className="absolute top-3 left-3 z-10">
                            <div className={cn(
                              "px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1.5 shadow-lg",
                              viralCoef > 10 ? "bg-emerald-500 text-white" : 
                              viralCoef > 5 ? "bg-amber-500 text-white" :
                              viralCoef > 0 ? "bg-white/90 text-slate-700" :
                              "bg-black/40 text-white/70"
                            )}>
                              <Sparkles className="w-3 h-3" />
                              <span className="text-xs font-bold">{viralCoef > 0 ? viralCoef : '—'}</span>
                            </div>
                          </div>
                          
                          {/* Date badge (top right) */}
                          <div className="absolute top-3 right-3 z-10">
                            <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-sm font-semibold shadow-lg">
                              {dateText || '—'}
                            </div>
                          </div>
                          
                          {/* Bottom info overlay */}
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            {/* Username */}
                            <div className="flex items-center gap-1.5 mb-1">
                              <h3 className="font-semibold text-white text-sm truncate drop-shadow-lg">
                                @{videoData.owner_username || 'instagram'}
                              </h3>
                            </div>
                            
                            {/* Description */}
                            <p className="text-white/80 text-xs leading-relaxed line-clamp-2 mb-3 drop-shadow">
                              {video.title?.slice(0, 60)}...
                            </p>
                            
                            {/* Stats and buttons */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 text-white/90">
                                <div className="flex items-center gap-1">
                                  <Eye className="w-3.5 h-3.5" />
                                  <span className="text-xs font-medium">{formatNumber(videoData.view_count)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Heart className="w-3.5 h-3.5" />
                                  <span className="text-xs font-medium">{formatNumber(videoData.like_count)}</span>
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <a
                                  href={video.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm text-white hover:bg-white hover:text-slate-800 flex items-center justify-center transition-all active:scale-95"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeVideo(video.id);
                                  }}
                                  className="w-8 h-8 rounded-full bg-red-500/80 backdrop-blur-sm text-white hover:bg-red-500 flex items-center justify-center transition-all active:scale-95"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
