import { useState } from 'react';
import { useSearchHistory, SearchHistoryEntry } from '../hooks/useSearchHistory';
import { useFlowStore } from '../stores/flowStore';
import { useInboxVideos } from '../hooks/useInboxVideos';
import { InstagramSearchResult } from '../services/videoService';
import { Search, Clock, Video, Eye, Heart, ExternalLink, Trash2, X, Calendar, ChevronLeft, Plus, MessageCircle } from 'lucide-react';
import { cn } from '../utils/cn';

type TabType = 'queries' | 'videos';

function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
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
  const { addVideoToInbox } = useInboxVideos();

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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {selectedEntry.results.map((reel) => {
                  const takenDate = reel.taken_at ? new Date(Number(reel.taken_at) * 1000) : null;
                  const dateStr = takenDate ? takenDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : null;
                  
                  return (
                    <div
                      key={reel.id}
                      className="group relative rounded-3xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                    >
                      <div className="relative w-full" style={{ aspectRatio: '9/16' }}>
                        <img
                          src={reel.thumbnail_url || reel.display_url || 'https://via.placeholder.com/270x480'}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = 'https://via.placeholder.com/270x480?text=Video';
                          }}
                        />
                        
                        {/* Add button on hover */}
                        <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleAddToInbox(reel)}
                            className="p-2.5 rounded-full bg-white/90 hover:bg-white text-orange-500 transition-all shadow-lg"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                          <a
                            href={reel.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2.5 rounded-full bg-white/90 hover:bg-white text-slate-600 transition-all shadow-lg"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        </div>
                        
                        {/* Bottom glass panel */}
                        <div className="absolute bottom-0 left-0 right-0">
                          <div className="flex justify-center -mb-3 relative z-10">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 ring-2 ring-white flex items-center justify-center">
                              <span className="text-white text-xs font-bold">
                                {reel.owner?.username?.[0]?.toUpperCase() || 'V'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="bg-white/70 backdrop-blur-xl p-4 pt-5">
                            <h3 className="text-center font-semibold text-slate-900 text-sm leading-tight mb-1 line-clamp-1">
                              {typeof reel.caption === 'string' 
                                ? reel.caption.slice(0, 30) + (reel.caption.length > 30 ? '...' : '')
                                : 'Видео'}
                            </h3>
                            
                            <p className="text-center text-slate-500 text-xs mb-2">
                              {dateStr && `${dateStr} • `}
                              @{reel.owner?.username || 'instagram'}
                            </p>
                            
                            <div className="flex items-center justify-center gap-3 text-slate-600 text-xs">
                              <span className="flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" />
                                {formatNumber(reel.view_count)}
                              </span>
                              <span className="flex items-center gap-1">
                                <Heart className="w-3.5 h-3.5" />
                                {formatNumber(reel.like_count)}
                              </span>
                            </div>
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
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {incomingVideos.map((video) => {
                    const videoData = video as any;
                    
                    return (
                      <div
                        key={video.id}
                        className="group relative rounded-3xl overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]"
                      >
                        <div className="relative w-full" style={{ aspectRatio: '9/16' }}>
                          <img
                            src={video.previewUrl || 'https://via.placeholder.com/270x480'}
                            alt=""
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = 'https://via.placeholder.com/270x480?text=Video';
                            }}
                          />
                          
                          {/* Date badge */}
                          <div className="absolute top-3 left-3">
                            <div className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm flex items-center gap-1.5 shadow-md">
                              <Calendar className="w-3 h-3 text-slate-500" />
                              <span className="text-xs font-medium text-slate-700">
                                {formatDate(video.receivedAt)}
                              </span>
                            </div>
                          </div>
                          
                          {/* Actions on hover */}
                          <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity">
                            <a
                              href={video.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2.5 rounded-full bg-white/90 hover:bg-white text-slate-600 transition-all shadow-lg flex items-center justify-center"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          </div>
                          
                          {/* Bottom glass panel */}
                          <div className="absolute bottom-0 left-0 right-0">
                            <div className="flex justify-center -mb-3 relative z-10">
                              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 ring-2 ring-white flex items-center justify-center">
                                <span className="text-white text-xs font-bold">
                                  {video.title?.charAt(0)?.toUpperCase() || 'V'}
                                </span>
                              </div>
                            </div>
                            
                            <div className="bg-white/70 backdrop-blur-xl p-4 pt-5">
                              <h3 className="text-center font-semibold text-slate-900 text-sm leading-tight mb-1 line-clamp-2">
                                {video.title?.slice(0, 40)}...
                              </h3>
                              
                              <div className="flex items-center justify-center gap-3 text-slate-600 text-xs mt-2">
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3.5 h-3.5" />
                                  {formatNumber(videoData.view_count)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Heart className="w-3.5 h-3.5" />
                                  {formatNumber(videoData.like_count)}
                                </span>
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
