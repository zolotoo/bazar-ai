import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, ExternalLink, Plus, Eye, Heart, MessageCircle, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { TextShimmer } from './TextShimmer';
import { 
  searchInstagramVideos,
  InstagramSearchResult
} from '../../services/videoService';
import { useFlowStore } from '../../stores/flowStore';
import { useInboxVideos } from '../../hooks/useInboxVideos';
import { useSearchHistory } from '../../hooks/useSearchHistory';
import { IncomingVideo } from '../../types';
import { cn } from '../../utils/cn';
import { supabase } from '../../utils/supabase';

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// View mode: 'carousel' for saved videos, 'trending' for trending videos, 'results' for search
type ViewMode = 'carousel' | 'loading' | 'results' | 'trending';

export function SearchPanel({ isOpen, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [reels, setReels] = useState<InstagramSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [_error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('carousel');
  const [activeIndex, setActiveIndex] = useState(0);
  const { incomingVideos } = useFlowStore();
  const { addVideoToInbox } = useInboxVideos();
  const { history: searchHistory, addToHistory, refetch: refetchHistory } = useSearchHistory();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      refetchHistory();
      setReels([]);
      setQuery('');
      
      // Если нет сохранённых видео пользователя — загружаем популярные из общей базы
      if (incomingVideos.length === 0) {
        loadPopularFromDatabase();
      } else {
        setViewMode('carousel');
        setActiveIndex(Math.floor(incomingVideos.length / 2));
      }
    }
  }, [isOpen]);

  // Загрузка популярных видео из общей базы данных (все пользователи)
  const loadPopularFromDatabase = async () => {
    setViewMode('loading');
    setLoading(true);
    try {
      // Берём видео за последний месяц, сортируем по просмотрам
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      
      const { data, error } = await supabase
        .from('saved_videos')
        .select('*')
        .gte('added_at', oneMonthAgo.toISOString())
        .order('view_count', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading popular videos:', error);
        setViewMode('carousel');
        return;
      }

      if (data && data.length > 0) {
        // Преобразуем в формат InstagramSearchResult
        const popular: InstagramSearchResult[] = data.map(video => ({
          id: video.id,
          shortcode: video.shortcode || video.video_id,
          url: video.video_url || `https://instagram.com/reel/${video.shortcode}`,
          thumbnail_url: video.thumbnail_url,
          caption: video.caption,
          view_count: video.view_count,
          like_count: video.like_count,
          comment_count: video.comment_count,
          owner: {
            username: video.owner_username,
          },
        }));
        
        setReels(popular);
        setViewMode('trending');
        setActiveIndex(Math.floor(popular.length / 2));
      } else {
        // Если в базе пусто — показываем пустую карусель
        setViewMode('carousel');
      }
    } catch (err) {
      console.error('Failed to load popular videos:', err);
      setViewMode('carousel');
    } finally {
      setLoading(false);
    }
  };

  // Loading animation progress
  useEffect(() => {
    if (loading) {
      setLoadingProgress(0);
      const interval = setInterval(() => {
        setLoadingProgress(prev => {
          if (prev >= 90) return prev;
          return prev + Math.random() * 15;
        });
      }, 200);
      return () => clearInterval(interval);
    } else {
      setLoadingProgress(100);
      setTimeout(() => setLoadingProgress(0), 300);
    }
  }, [loading]);

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const queryToSearch = searchQuery || query;
    if (!queryToSearch.trim()) return;

    setViewMode('loading');
    setLoading(true);
    setError(null);
    setReels([]);
    
    if (searchQuery) {
      setQuery(searchQuery);
    }

    try {
      const foundReels = await searchInstagramVideos(queryToSearch.trim());
      setReels(foundReels);
      setViewMode('results');
      
      // Сохраняем в историю вместе с результатами
      addToHistory(queryToSearch.trim(), foundReels);
      
      if (foundReels.length === 0) {
        setError('Видео не найдены');
        setViewMode('carousel');
      }
    } catch (err) {
      console.error('Search error:', err);
      setError('Ошибка поиска');
      setViewMode('carousel');
    } finally {
      setLoading(false);
    }
  }, [query, addToHistory]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSearch();
    }
  };

  const handleAddToCanvas = async (result: InstagramSearchResult) => {
    let captionText = typeof result.caption === 'string' ? result.caption : '';
    if (captionText.length > 200) {
      captionText = captionText.substring(0, 200) + '...';
    }
    
    try {
      await addVideoToInbox({
        title: captionText || 'Видео из Instagram',
        previewUrl: result.thumbnail_url || result.display_url || '',
        url: result.url,
        viewCount: result.view_count,
        likeCount: result.like_count,
        commentCount: result.comment_count,
        ownerUsername: result.owner?.username,
      });
      console.log('Видео сохранено в Supabase');
    } catch (err) {
      console.error('Ошибка сохранения видео:', err);
    }
  };

  const handleDragStart = async (e: React.DragEvent, result: InstagramSearchResult) => {
    let captionText = typeof result.caption === 'string' ? result.caption : '';
    if (captionText.length > 200) {
      captionText = captionText.substring(0, 200) + '...';
    }
    
    // Сначала сохраняем в Supabase
    try {
      const savedVideo = await addVideoToInbox({
        title: captionText || 'Видео из Instagram',
        previewUrl: result.thumbnail_url || result.display_url || '',
        url: result.url,
        viewCount: result.view_count,
        likeCount: result.like_count,
        commentCount: result.comment_count,
        ownerUsername: result.owner?.username,
      });
      
      if (savedVideo) {
        e.dataTransfer.setData('application/reactflow/video', JSON.stringify(savedVideo));
      }
    } catch (err) {
      // Если не удалось сохранить, используем временный объект
      const video: IncomingVideo = {
        id: `search-${result.id}-${Date.now()}`,
        title: captionText || 'Видео из Instagram',
        previewUrl: result.thumbnail_url || result.display_url || '',
        url: result.url,
        receivedAt: new Date(),
      };
      e.dataTransfer.setData('application/reactflow/video', JSON.stringify(video));
    }
    
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragStartSaved = (e: React.DragEvent, video: IncomingVideo) => {
    e.dataTransfer.setData('application/reactflow/video', JSON.stringify(video));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleClose = () => {
    setQuery('');
    setReels([]);
    setError(null);
    setViewMode('carousel');
    onClose();
  };

  const goToPrev = () => {
    setActiveIndex(prev => (prev > 0 ? prev - 1 : incomingVideos.length - 1));
  };

  const goToNext = () => {
    setActiveIndex(prev => (prev < incomingVideos.length - 1 ? prev + 1 : 0));
  };

  const backToCarousel = () => {
    setViewMode('carousel');
    setReels([]);
    setQuery('');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') handleClose();
      
      // Навигация для карусели (saved или trending)
      if (viewMode === 'carousel' && incomingVideos.length > 0) {
        if (e.key === 'ArrowLeft') goToPrev();
        if (e.key === 'ArrowRight') goToNext();
      }
      if (viewMode === 'trending' && reels.length > 0) {
        if (e.key === 'ArrowLeft') setActiveIndex(prev => (prev > 0 ? prev - 1 : reels.length - 1));
        if (e.key === 'ArrowRight') setActiveIndex(prev => (prev < reels.length - 1 ? prev + 1 : 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, viewMode, incomingVideos.length, reels.length]);

  if (!isOpen) return null;

  const activeVideo = incomingVideos[activeIndex];

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#f5f5f5]">
      {/* Clean gradient blobs - white, orange, black */}
      <div className="absolute top-[-10%] right-[10%] w-[45%] h-[45%] bg-gradient-to-bl from-orange-500/35 via-orange-400/15 to-transparent rounded-full blur-[80px] pointer-events-none" />
      <div className="absolute bottom-[5%] left-[-5%] w-[50%] h-[50%] bg-gradient-to-tr from-neutral-900/15 via-neutral-800/8 to-transparent rounded-full blur-[100px] pointer-events-none" />
      
      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
      }} />

      {/* Content */}
      <div className="relative w-full h-full flex flex-col">
        
        {/* Header with Search */}
        <div className="flex-shrink-0 p-6 pb-4">
          <div className="max-w-2xl mx-auto">
            {/* Close button */}
            <button
              onClick={handleClose}
              className="absolute top-4 right-4 p-2.5 rounded-2xl glass text-slate-500 hover:text-slate-700 transition-all z-20"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Back button when in results */}
            {viewMode === 'results' && (
              <button
                onClick={backToCarousel}
                className="absolute top-4 left-4 px-4 py-2 rounded-2xl glass text-slate-600 hover:text-slate-800 transition-all z-20 flex items-center gap-2 text-sm font-medium"
              >
                <ChevronLeft className="w-4 h-4" />
                Назад
              </button>
            )}

            {/* Search Bar */}
            <div className="glass rounded-2xl shadow-xl shadow-orange-500/10">
              <div className="flex items-center gap-3 px-5 py-3.5">
                <Search className="w-5 h-5 text-orange-500" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Поиск видео в Instagram..."
                  className="flex-1 bg-transparent text-slate-800 placeholder:text-slate-400 outline-none text-base tracking-tight"
                />
                <button
                  onClick={() => handleSearch()}
                  disabled={!query.trim() || loading}
                  className={cn(
                    "px-4 py-2 rounded-xl font-medium text-sm transition-all",
                    "bg-gradient-to-r from-orange-500 to-amber-600 text-white",
                    "hover:from-orange-400 hover:to-amber-500",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    "shadow-lg shadow-orange-500/30"
                  )}
                >
                  Найти
                </button>
              </div>
            </div>

            {/* History pills */}
            {(viewMode === 'carousel' || viewMode === 'trending') && searchHistory.length > 0 && (
              <div className="flex flex-wrap justify-center gap-2 mt-3">
                {searchHistory.map((item, index) => (
                  <button
                    key={index}
                    onClick={() => handleSearch(item)}
                    className="px-3 py-1.5 rounded-full glass text-slate-600 hover:text-slate-800 text-sm font-medium transition-all"
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden">
          
          {/* CAROUSEL VIEW - Saved Videos */}
          {viewMode === 'carousel' && incomingVideos.length > 0 && (
            <div className="h-full flex flex-col items-center justify-center">
              {/* 3D Carousel */}
              <div className="relative w-full flex items-center justify-center" style={{ height: '400px' }}>
                <button
                  onClick={goToPrev}
                  className="absolute left-8 z-20 p-3 rounded-full glass text-slate-500 hover:text-slate-700 transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={goToNext}
                  className="absolute right-8 z-20 p-3 rounded-full glass text-slate-500 hover:text-slate-700 transition-all"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                <div className="relative w-full h-full flex items-center justify-center perspective-1000">
                  {incomingVideos.map((video, index) => {
                    const offset = index - activeIndex;
                    const absOffset = Math.abs(offset);
                    const isActive = index === activeIndex;
                    
                    if (absOffset > 3) return null;

                    const translateX = offset * 160;
                    const translateZ = isActive ? 60 : -absOffset * 60;
                    const rotateY = offset * -10;
                    const scale = isActive ? 1 : Math.max(0.75, 1 - absOffset * 0.12);
                    const opacity = isActive ? 1 : Math.max(0.4, 1 - absOffset * 0.3);

                    return (
                      <div
                        key={video.id}
                        onClick={() => setActiveIndex(index)}
                        draggable={isActive}
                        onDragStart={(e) => isActive && handleDragStartSaved(e, video)}
                        className={cn(
                          'absolute transition-all duration-500 ease-out cursor-pointer',
                          isActive && 'cursor-grab active:cursor-grabbing z-10'
                        )}
                        style={{
                          transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                          opacity,
                          zIndex: 10 - absOffset,
                        }}
                      >
                        <div className={cn(
                          'w-[180px] rounded-2xl overflow-hidden shadow-2xl shadow-orange-500/20',
                          'bg-white',
                          isActive && 'ring-2 ring-orange-500/50'
                        )}>
                          <div className="relative w-full" style={{ aspectRatio: '9/16' }}>
                            <img
                              src={video.previewUrl || 'https://via.placeholder.com/200x356'}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = 'https://via.placeholder.com/200x356?text=Video';
                              }}
                            />
                            {/* Gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                            
                            {isActive && (
                              <div className="absolute top-3 left-3">
                                <div className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm text-slate-700 text-[10px] font-semibold flex items-center gap-1 shadow-md">
                                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Сохранено
                                </div>
                              </div>
                            )}
                            
                            {/* Bottom info */}
                            <div className="absolute bottom-3 left-3 right-3">
                              <p className="text-white font-semibold text-sm line-clamp-2 leading-tight">
                                {video.title.slice(0, 40)}...
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {activeVideo && (
                <div className="w-full max-w-sm mt-4">
                  <div className="glass rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white flex-shrink-0">
                        <Sparkles className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800 truncate leading-tight">
                          {activeVideo.title.slice(0, 35)}...
                        </p>
                        <p className="text-[10px] text-slate-500 leading-tight">Сохранённое видео</p>
                      </div>
                      <a
                        href={activeVideo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-xl glass text-orange-500 hover:text-orange-600 transition-all"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-1 mt-4">
                {incomingVideos.slice(0, Math.min(incomingVideos.length, 12)).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      index === activeIndex 
                        ? 'w-6 bg-slate-600' 
                        : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                    )}
                  />
                ))}
              </div>

              <p className="text-slate-400 text-xs mt-4 tracking-tight">
                Перетащите на холст или используйте ← → для навигации
              </p>
            </div>
          )}

          {/* EMPTY STATE - No videos in database */}
          {(viewMode === 'carousel' || viewMode === 'trending') && incomingVideos.length === 0 && reels.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center px-6">
              <div className="w-24 h-24 rounded-3xl bg-gradient-to-br from-orange-500/20 to-amber-600/20 flex items-center justify-center mb-6">
                <Search className="w-10 h-10 text-orange-500" />
              </div>
              <h3 className="text-2xl font-serif italic text-neutral-900 mb-2">
                Начните поиск
              </h3>
              <p className="text-slate-500 text-center max-w-sm mb-6">
                Введите запрос в поисковую строку, чтобы найти вирусные видео из Instagram
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {['нейросети', 'маркетинг', 'стартапы', 'бизнес', 'AI'].map(tag => (
                  <button
                    key={tag}
                    onClick={() => handleSearch(tag)}
                    className="px-4 py-2 rounded-full bg-white shadow-md text-slate-700 hover:text-orange-600 text-sm font-medium transition-all hover:shadow-lg"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* TRENDING VIEW - Carousel with Instagram trending videos */}
          {viewMode === 'trending' && reels.length > 0 && (
            <div className="h-full flex flex-col items-center justify-center">
              {/* 3D Carousel */}
              <div className="relative w-full flex items-center justify-center" style={{ height: '420px' }}>
                <button
                  onClick={() => setActiveIndex(prev => (prev > 0 ? prev - 1 : reels.length - 1))}
                  className="absolute left-8 z-20 p-3 rounded-full bg-white/70 hover:bg-white text-slate-500 hover:text-slate-700 transition-all shadow-lg"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setActiveIndex(prev => (prev < reels.length - 1 ? prev + 1 : 0))}
                  className="absolute right-8 z-20 p-3 rounded-full bg-white/70 hover:bg-white text-slate-500 hover:text-slate-700 transition-all shadow-lg"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>

                <div className="relative w-full h-full flex items-center justify-center perspective-1000">
                  {reels.map((reel, index) => {
                    const offset = index - activeIndex;
                    const absOffset = Math.abs(offset);
                    const isActive = index === activeIndex;
                    
                    if (absOffset > 3) return null;

                    const translateX = offset * 180;
                    const translateZ = isActive ? 80 : -absOffset * 80;
                    const rotateY = offset * -12;
                    const scale = isActive ? 1 : Math.max(0.75, 1 - absOffset * 0.12);
                    const opacity = isActive ? 1 : Math.max(0.5, 1 - absOffset * 0.25);

                    return (
                      <div
                        key={reel.id}
                        onClick={() => setActiveIndex(index)}
                        draggable={isActive}
                        onDragStart={(e) => isActive && handleDragStart(e, reel)}
                        className={cn(
                          'absolute transition-all duration-500 ease-out cursor-pointer',
                          isActive && 'cursor-grab active:cursor-grabbing z-10'
                        )}
                        style={{
                          transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                          opacity,
                          zIndex: 10 - absOffset,
                        }}
                      >
                        <div className={cn(
                          'w-[200px] bg-white rounded-3xl overflow-hidden shadow-2xl',
                          isActive && 'ring-4 ring-white/80'
                        )}>
                          <div className="relative w-full" style={{ aspectRatio: '9/16' }}>
                            <img
                              src={reel.thumbnail_url || reel.display_url || 'https://via.placeholder.com/200x356'}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = 'https://via.placeholder.com/200x356?text=Video';
                              }}
                            />
                            {/* Stats overlay */}
                            <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/60 to-transparent">
                              <div className="flex items-center gap-2 text-white text-[10px]">
                                <span className="flex items-center gap-0.5">
                                  <Eye className="w-3 h-3" />
                                  {formatNumber(reel.view_count)}
                                </span>
                                <span className="flex items-center gap-0.5">
                                  <Heart className="w-3 h-3" />
                                  {formatNumber(reel.like_count)}
                                </span>
                              </div>
                            </div>
                            {isActive && (
                              <button className="absolute top-2 right-2 px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-sm text-slate-700 text-[10px] font-semibold flex items-center gap-1 shadow-md">
                                <Sparkles className="w-3 h-3" />
                                Expand
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active reel info */}
              {reels[activeIndex] && (
                <div className="w-full max-w-sm mt-4">
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-lg border border-white/50">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                        {reels[activeIndex].owner?.username?.[0]?.toUpperCase() || 'T'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 truncate">
                          @{reels[activeIndex].owner?.username || 'trending'}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>❤️ {formatNumber(reels[activeIndex].like_count)}</span>
                          <span>👁️ {formatNumber(reels[activeIndex].view_count)}</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleAddToCanvas(reels[activeIndex])}
                          className="p-2 rounded-xl bg-violet-100 hover:bg-violet-200 text-violet-600 transition-all"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <a
                          href={reels[activeIndex].url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dots */}
              <div className="flex items-center justify-center gap-1 mt-4">
                {reels.slice(0, Math.min(reels.length, 12)).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      'h-1.5 rounded-full transition-all',
                      index === activeIndex 
                        ? 'w-6 bg-slate-600' 
                        : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                    )}
                  />
                ))}
              </div>

              <p className="text-slate-400 text-xs mt-4 tracking-tight">
                Трендовые видео • Перетащите на холст или используйте ← →
              </p>
            </div>
          )}

          {/* LOADING VIEW - Orange Glowing Sun */}
          {viewMode === 'loading' && (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="relative">
                <div 
                  className="absolute inset-0 rounded-full blur-3xl transition-all duration-300"
                  style={{
                    background: `radial-gradient(circle, rgba(251,146,60,${0.2 + loadingProgress * 0.006}) 0%, rgba(251,146,60,0) 70%)`,
                    transform: `scale(${2 + loadingProgress * 0.02})`,
                  }}
                />
                <div 
                  className="absolute inset-0 rounded-full blur-xl transition-all duration-300"
                  style={{
                    background: `radial-gradient(circle, rgba(251,146,60,${0.3 + loadingProgress * 0.005}) 0%, rgba(249,115,22,0) 70%)`,
                    transform: `scale(${1.5 + loadingProgress * 0.01})`,
                  }}
                />
                <div 
                  className="relative w-32 h-32 rounded-full transition-all duration-300"
                  style={{
                    background: `radial-gradient(circle at 30% 30%, 
                      rgba(255,255,255,${0.9 - loadingProgress * 0.003}) 0%, 
                      rgba(253,186,116,1) 20%, 
                      rgba(251,146,60,1) 50%, 
                      rgba(249,115,22,1) 80%, 
                      rgba(234,88,12,1) 100%)`,
                    boxShadow: `
                      0 0 ${20 + loadingProgress}px rgba(251,146,60,${0.5 + loadingProgress * 0.005}),
                      0 0 ${40 + loadingProgress * 2}px rgba(251,146,60,${0.3 + loadingProgress * 0.004}),
                      0 0 ${80 + loadingProgress * 3}px rgba(249,115,22,${0.2 + loadingProgress * 0.003}),
                      inset 0 0 30px rgba(255,255,255,0.3)
                    `,
                  }}
                >
                  <div 
                    className="absolute inset-2 rounded-full"
                    style={{
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 50%, rgba(0,0,0,0.1) 100%)',
                    }}
                  />
                </div>
                <div 
                  className="absolute inset-0 animate-spin"
                  style={{ animationDuration: '8s' }}
                >
                  {[...Array(8)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute top-1/2 left-1/2 w-1 bg-gradient-to-t from-orange-400/60 to-transparent rounded-full"
                      style={{
                        height: `${60 + loadingProgress * 0.5}px`,
                        transform: `translate(-50%, -100%) rotate(${i * 45}deg)`,
                        transformOrigin: 'bottom center',
                        opacity: 0.4 + loadingProgress * 0.006,
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="mt-12">
                <TextShimmer 
                  duration={1.5} 
                  className="text-lg font-medium [--base-color:theme(colors.orange.400)] [--base-gradient-color:theme(colors.orange.100)]"
                >
                  Ищем трендовые видео...
                </TextShimmer>
              </div>
              <p className="mt-3 text-slate-400 text-sm">по запросу "{query}"</p>
            </div>
          )}

          {/* RESULTS VIEW - Grid */}
          {viewMode === 'results' && reels.length > 0 && (
            <div className="h-full overflow-y-auto px-6 pb-6 custom-scrollbar-light">
              <div className="max-w-6xl mx-auto">
                <p className="text-sm text-slate-500 mb-4 font-medium">
                  Найдено {reels.length} видео по запросу "{query}"
                </p>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {reels.map((reel) => {
                    const takenDate = reel.taken_at ? new Date(Number(reel.taken_at) * 1000) : null;
                    const dateStr = takenDate ? takenDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : null;
                    
                    return (
                      <div
                        key={reel.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, reel)}
                        className="group relative rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-grab active:cursor-grabbing hover:scale-[1.02]"
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
                          
                          {/* Top badge */}
                          <div className="absolute top-3 left-3">
                            <div className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm flex items-center gap-1.5 shadow-md">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-xs font-medium text-slate-700">Да</span>
                            </div>
                          </div>
                          
                          {/* Add button on hover */}
                          <div className="absolute top-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCanvas(reel);
                              }}
                              className="p-2.5 rounded-full bg-white/90 hover:bg-white text-orange-500 transition-all shadow-lg"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          
                          {/* Bottom glass panel with info */}
                          <div className="absolute bottom-0 left-0 right-0">
                            {/* Avatars row */}
                            <div className="flex justify-center -mb-3 relative z-10">
                              <div className="flex -space-x-2">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 ring-2 ring-white flex items-center justify-center">
                                  <span className="text-white text-xs font-bold">
                                    {reel.owner?.username?.[0]?.toUpperCase() || 'V'}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {/* Glass info panel */}
                            <div className="bg-white/70 backdrop-blur-xl p-4 pt-5">
                              {/* Title */}
                              <h3 className="text-center font-semibold text-slate-900 text-base leading-tight mb-1">
                                {typeof reel.caption === 'string' 
                                  ? reel.caption.slice(0, 30) + (reel.caption.length > 30 ? '...' : '')
                                  : 'Видео'}
                              </h3>
                              
                              {/* Date and stats */}
                              <p className="text-center text-slate-500 text-xs mb-2">
                                {dateStr && `${dateStr} • `}
                                {reel.owner?.username ? `@${reel.owner.username}` : 'Instagram'}
                              </p>
                              
                              {/* Stats row */}
                              <div className="flex items-center justify-center gap-3 text-slate-600 text-xs">
                                <span className="flex items-center gap-1">
                                  <Eye className="w-3.5 h-3.5" />
                                  {formatNumber(reel.view_count)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Heart className="w-3.5 h-3.5" />
                                  {formatNumber(reel.like_count)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <MessageCircle className="w-3.5 h-3.5" />
                                  {formatNumber(reel.comment_count)}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
