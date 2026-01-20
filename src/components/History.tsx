import { useState } from 'react';
import { useSearchHistory, SearchHistoryEntry } from '../hooks/useSearchHistory';
import { useFlowStore } from '../stores/flowStore';
import { useInboxVideos } from '../hooks/useInboxVideos';
import { InstagramSearchResult } from '../services/videoService';
import { Search, Clock, Video, Eye, Heart, ExternalLink, Trash2, X, ChevronLeft, Plus, Sparkles } from 'lucide-react';
import { cn } from '../utils/cn';

type TabType = 'queries' | 'videos';

function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Расчёт коэффициента виральности
function calculateViralCoefficient(views?: number, takenAt?: string): number {
  if (!views || views < 30000 || !takenAt) return 0;
  
  let videoDate: Date;
  if (takenAt.includes('T') || takenAt.includes('-')) {
    videoDate = new Date(takenAt);
  } else {
    videoDate = new Date(Number(takenAt) * 1000);
  }
  
  if (isNaN(videoDate.getTime())) return 0;
  
  const today = new Date();
  const diffTime = today.getTime() - videoDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return 0;
  
  return Math.round((views / (diffDays * 1000)) * 100) / 100;
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
    } catch (err) {
      console.error('Ошибка сохранения видео:', err);
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
                  
                  return (
                    <div
                      key={`history-${reel.shortcode || reel.id}-${idx}`}
                      className="group relative rounded-[1.75rem] overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      {/* Blurred background */}
                      <div 
                        className="absolute inset-0 bg-cover bg-center"
                        style={{ 
                          backgroundImage: `url(${thumbnailUrl})`,
                          filter: 'blur(20px) brightness(0.9)',
                          transform: 'scale(1.1)'
                        }}
                      />
                      
                      {/* Content */}
                      <div className="relative z-10">
                        {/* Image */}
                        <div className="relative w-full m-2 mb-0" style={{ aspectRatio: '3/4' }}>
                          <img
                            src={thumbnailUrl}
                            alt=""
                            className="w-[calc(100%-16px)] h-full object-cover rounded-[1.25rem]"
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/270x360?text=Video';
                            }}
                          />
                          
                          {/* Viral coefficient badge */}
                          <div className="absolute top-2 left-2 z-10">
                            <div className={cn(
                              "px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 shadow-lg",
                              viralCoef > 10 ? "bg-emerald-500 text-white" : 
                              viralCoef > 5 ? "bg-amber-500 text-white" :
                              viralCoef > 0 ? "bg-white/90 text-slate-700" :
                              "bg-slate-200/90 text-slate-500"
                            )}>
                              <Sparkles className="w-2.5 h-2.5" />
                              <span className="text-[10px] font-bold">{viralCoef > 0 ? viralCoef : '—'}</span>
                            </div>
                          </div>
                          
                          {/* Hover overlay */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleAddToInbox(reel)}
                                className="p-2.5 rounded-full bg-white/95 text-slate-800 shadow-lg active:scale-95"
                              >
                                <Plus className="w-4 h-4" />
                              </button>
                              <a
                                href={reel.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2.5 rounded-full bg-white/95 text-slate-800 shadow-lg active:scale-95"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            </div>
                          </div>
                        </div>
                        
                        {/* Info section */}
                        <div className="p-4 pt-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <h3 className="font-sans font-semibold text-slate-900 text-[15px] truncate italic">
                              @{reel.owner?.username || 'instagram'}
                            </h3>
                          </div>
                          
                          <p className="font-sans text-slate-700 text-xs leading-relaxed line-clamp-2 mb-3">
                            {captionText.slice(0, 50)}{captionText.length > 50 ? '...' : ''}
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-slate-600">
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
                              onClick={() => handleAddToInbox(reel)}
                              className="px-3 py-1.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-medium transition-all active:scale-95"
                            >
                              Follow +
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
                    
                    return (
                      <div
                        key={`saved-${video.id}-${idx}`}
                        className="group relative rounded-[1.75rem] overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                      >
                        {/* Blurred background */}
                        <div 
                          className="absolute inset-0 bg-cover bg-center"
                          style={{ 
                            backgroundImage: `url(${thumbnailUrl})`,
                            filter: 'blur(20px) brightness(0.9)',
                            transform: 'scale(1.1)'
                          }}
                        />
                        
                        {/* Content */}
                        <div className="relative z-10">
                          {/* Image */}
                          <div className="relative w-full m-2 mb-0" style={{ aspectRatio: '3/4' }}>
                            <img
                              src={thumbnailUrl}
                              alt=""
                              className="w-[calc(100%-16px)] h-full object-cover rounded-[1.25rem]"
                              onError={(e) => {
                                e.currentTarget.src = 'https://via.placeholder.com/270x360?text=Video';
                              }}
                            />
                            
                            {/* Viral coefficient badge */}
                            <div className="absolute top-2 left-2 z-10">
                              <div className={cn(
                                "px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 shadow-lg",
                                viralCoef > 10 ? "bg-emerald-500 text-white" : 
                                viralCoef > 5 ? "bg-amber-500 text-white" :
                                viralCoef > 0 ? "bg-white/90 text-slate-700" :
                                "bg-slate-200/90 text-slate-500"
                              )}>
                                <Sparkles className="w-2.5 h-2.5" />
                                <span className="text-[10px] font-bold">{viralCoef > 0 ? viralCoef : '—'}</span>
                              </div>
                            </div>
                            
                            {/* Hover overlay */}
                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="flex gap-2">
                                <button
                                  onClick={() => removeVideo(video.id)}
                                  className="p-2.5 rounded-full bg-red-500 text-white shadow-lg active:scale-95"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                                <a
                                  href={video.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2.5 rounded-full bg-white/95 text-slate-800 shadow-lg active:scale-95"
                                >
                                  <ExternalLink className="w-4 h-4" />
                                </a>
                              </div>
                            </div>
                          </div>
                          
                          {/* Info section */}
                          <div className="p-4 pt-3">
                            <h3 className="font-sans font-semibold text-slate-900 text-sm leading-tight line-clamp-2 mb-2 italic">
                              {video.title?.slice(0, 45)}...
                            </h3>
                            
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 text-slate-600">
                                <div className="flex items-center gap-1">
                                  <Eye className="w-3.5 h-3.5" />
                                  <span className="text-xs font-medium">{formatNumber(videoData.view_count)}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                  <Heart className="w-3.5 h-3.5" />
                                  <span className="text-xs font-medium">{formatNumber(videoData.like_count)}</span>
                                </div>
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
