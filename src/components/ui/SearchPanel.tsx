import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, ExternalLink, Plus, Eye, Heart, MessageCircle, ChevronLeft, ChevronRight, Sparkles, Play, Link, Loader2 } from 'lucide-react';
import { TextShimmer } from './TextShimmer';
import { 
  searchInstagramVideos,
  getReelByUrl,
  getHashtagReels,
  InstagramSearchResult
} from '../../services/videoService';
import { useFlowStore } from '../../stores/flowStore';
import { useInboxVideos } from '../../hooks/useInboxVideos';
import { useSearchHistory } from '../../hooks/useSearchHistory';
import { useWorkspaceZones } from '../../hooks/useWorkspaceZones';
import { IncomingVideo } from '../../types';
import { cn } from '../../utils/cn';
import { supabase } from '../../utils/supabase';
import { FolderPlus, Star, Sparkles as SparklesIcon, FileText, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

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

// Расчёт коэффициента виральности: views / (days * 1000)
// Если просмотров < 30000 или дней = 0, то 0
function calculateViralCoefficient(views?: number, takenAt?: string | number | Date): number {
  if (!views || views < 30000 || !takenAt) return 0;
  
  let videoDate: Date;
  
  // Обработка разных типов
  if (takenAt instanceof Date) {
    videoDate = takenAt;
  } else if (typeof takenAt === 'string') {
    if (takenAt.includes('T') || takenAt.includes('-')) {
      // ISO формат: "2026-01-20T01:51:06.217499+00:00"
      videoDate = new Date(takenAt);
    } else {
      // Unix timestamp в секундах (строка)
      videoDate = new Date(Number(takenAt) * 1000);
    }
  } else if (typeof takenAt === 'number') {
    // Unix timestamp в секундах или миллисекундах
    videoDate = takenAt > 1e12 ? new Date(takenAt) : new Date(takenAt * 1000);
  } else {
    return 0;
  }
  
  // Проверка валидности даты
  if (isNaN(videoDate.getTime())) return 0;
  
  const today = new Date();
  const diffTime = today.getTime() - videoDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) return 0;
  
  return Math.round((views / (diffDays * 1000)) * 100) / 100;
}

type SortOption = 'views' | 'likes' | 'viral' | 'date';

// View mode: 'carousel' for saved videos, 'trending' for trending videos, 'results' for search
type ViewMode = 'carousel' | 'loading' | 'results' | 'trending';

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

export function SearchPanel({ isOpen, onClose }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [reels, setReels] = useState<InstagramSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [_error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('carousel');
  const [activeIndex, setActiveIndex] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('views');
  const [selectedVideo, setSelectedVideo] = useState<InstagramSearchResult | null>(null);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [showFolderSelect, setShowFolderSelect] = useState(false);
  const [cardFolderSelect, setCardFolderSelect] = useState<string | null>(null); // ID карточки с открытым меню папок
  const { incomingVideos } = useFlowStore();
  const { addVideoToInbox } = useInboxVideos();
  const { history: searchHistory, addToHistory, refetch: refetchHistory } = useSearchHistory();
  const { addVideoToWorkspace } = useWorkspaceZones();
  const inputRef = useRef<HTMLInputElement>(null);

  // Конфигурация папок
  const folderConfigs = [
    { id: '1', title: 'Избранное', color: '#6366f1', icon: Star },
    { id: '2', title: 'В работе', color: '#f59e0b', icon: SparklesIcon },
    { id: '3', title: 'Сценарии', color: '#10b981', icon: FileText },
    { id: '4', title: 'Завершено', color: '#8b5cf6', icon: CheckCircle },
  ];

  // Сортировка видео
  const sortedReels = [...reels].sort((a, b) => {
    switch (sortBy) {
      case 'views':
        return (b.view_count || 0) - (a.view_count || 0);
      case 'likes':
        return (b.like_count || 0) - (a.like_count || 0);
      case 'viral':
        return calculateViralCoefficient(b.view_count, b.taken_at) - calculateViralCoefficient(a.view_count, a.taken_at);
      case 'date':
        return Number(b.taken_at || 0) - Number(a.taken_at || 0);
      default:
        return 0;
    }
  });

  useEffect(() => {
    if (isOpen) {
      refetchHistory();
      setReels([]);
      setQuery('');
      
      // Всегда загружаем популярные видео из общей базы для карусели
      loadPopularFromDatabase();
    }
  }, [isOpen]);

  // Загрузка популярных видео из общей базы данных (все пользователи)
  const loadPopularFromDatabase = async () => {
    setViewMode('loading');
    setLoading(true);
    try {
      // Берём все видео, сортируем по просмотрам (без ограничения по дате)
      const { data, error } = await supabase
        .from('saved_videos')
        .select('*')
        .order('view_count', { ascending: false, nullsFirst: false })
        .limit(30);

      console.log('[Search] Loaded videos from DB:', data?.length || 0);

      if (error) {
        console.error('Error loading popular videos:', error);
        setViewMode('carousel');
        return;
      }

      if (data && data.length > 0) {
        // Преобразуем в формат InstagramSearchResult
        // Убираем дубликаты по shortcode
        const uniqueData = data.filter((video, index, self) => 
          index === self.findIndex(v => v.shortcode === video.shortcode || v.video_id === video.video_id)
        );
        
        const popular: InstagramSearchResult[] = uniqueData.map(video => ({
          id: video.id,
          shortcode: video.shortcode || video.video_id,
          url: video.video_url || `https://instagram.com/reel/${video.shortcode}`,
          thumbnail_url: video.thumbnail_url,
          caption: video.caption,
          view_count: video.view_count,
          like_count: video.like_count,
          comment_count: video.comment_count,
          // Используем taken_at если есть, иначе конвертируем added_at в timestamp
          taken_at: video.taken_at?.toString() || (new Date(video.added_at).getTime() / 1000).toString(),
          owner: {
            username: video.owner_username,
          },
        }));
        
        setReels(popular);
        setViewMode('trending');
        setActiveIndex(Math.floor(popular.length / 2));
      } else {
        // Если в базе совсем пусто — показываем empty state
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

  // Close folder menu on outside click
  useEffect(() => {
    if (cardFolderSelect) {
      const handleClickOutside = () => setCardFolderSelect(null);
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [cardFolderSelect]);

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
      // Параллельный поиск: основной запрос + хэштег
      const cleanQuery = queryToSearch.trim();
      const hashtagQuery = cleanQuery.replace(/^#/, '').replace(/\s+/g, '');
      
      const [keywordResults, hashtagResults] = await Promise.all([
        searchInstagramVideos(cleanQuery),
        // Ищем по хэштегу только если запрос не начинается с #
        cleanQuery.startsWith('#') ? Promise.resolve([]) : getHashtagReels(hashtagQuery),
      ]);
      
      // Объединяем результаты, убираем дубликаты по shortcode
      const allResults = [...keywordResults];
      const existingCodes = new Set(keywordResults.map(r => r.shortcode));
      
      for (const reel of hashtagResults) {
        if (!existingCodes.has(reel.shortcode)) {
          allResults.push(reel);
          existingCodes.add(reel.shortcode);
        }
      }
      
      setReels(allResults);
      setViewMode('results');
      
      // Сохраняем в историю вместе с результатами
      addToHistory(cleanQuery, allResults);
      
      if (allResults.length === 0) {
        setError('Видео не найдены');
        setViewMode('carousel');
      } else {
        toast.success(`Найдено ${allResults.length} видео`, {
          description: hashtagResults.length > 0 ? `+${hashtagResults.length} по #${hashtagQuery}` : undefined,
        });
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
      toast.success('Видео добавлено во входящие', {
        description: `@${result.owner?.username || 'instagram'}`,
      });
    } catch (err) {
      console.error('Ошибка сохранения видео:', err);
      toast.error('Ошибка сохранения видео');
    }
  };

  // Обработка ссылки на рилс
  const handleParseLink = async () => {
    if (!linkUrl.trim()) return;
    
    setLinkLoading(true);
    try {
      const reel = await getReelByUrl(linkUrl);
      
      if (reel) {
        // Добавляем в inbox
        const captionText = typeof reel.caption === 'string' ? reel.caption.slice(0, 200) : 'Видео из Instagram';
        
        await addVideoToInbox({
          title: captionText,
          previewUrl: reel.thumbnail_url || reel.display_url || '',
          url: reel.url,
          viewCount: reel.view_count,
          likeCount: reel.like_count,
          commentCount: reel.comment_count,
          ownerUsername: reel.owner?.username,
        });
        
        setLinkUrl('');
        setShowLinkInput(false);
        toast.success('Рилс добавлен', {
          description: `@${reel.owner?.username || 'instagram'}`,
        });
      } else {
        toast.error('Не удалось получить данные рилса');
      }
    } catch (err) {
      console.error('Ошибка парсинга ссылки:', err);
      toast.error('Ошибка при добавлении ссылки');
    } finally {
      setLinkLoading(false);
    }
  };

  // Добавление видео в папку
  const handleAddToFolder = async (result: InstagramSearchResult, folderId: string) => {
    const captionText = typeof result.caption === 'string' ? result.caption.slice(0, 500) : 'Видео из Instagram';
    const folderName = folderConfigs.find(f => f.id === folderId)?.title || 'папку';
    
    try {
      await addVideoToWorkspace({
        videoId: result.shortcode || result.id,
        shortcode: result.shortcode,
        thumbnailUrl: result.thumbnail_url || result.display_url,
        caption: captionText,
        ownerUsername: result.owner?.username,
        viewCount: result.view_count,
        likeCount: result.like_count,
        zoneId: folderId,
      });
      setShowFolderSelect(false);
      setSelectedVideo(null);
      toast.success(`Добавлено в "${folderName}"`, {
        description: `@${result.owner?.username || 'instagram'}`,
      });
    } catch (err) {
      console.error('Ошибка добавления в папку:', err);
      toast.error('Ошибка добавления в папку');
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
                  onClick={() => setShowLinkInput(!showLinkInput)}
                  className={cn(
                    "p-2 rounded-xl transition-all active:scale-95",
                    showLinkInput 
                      ? "bg-orange-100 text-orange-600" 
                      : "bg-slate-100 text-slate-500 hover:bg-orange-100 hover:text-orange-500"
                  )}
                  title="Добавить по ссылке"
                >
                  <Link className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleSearch()}
                  disabled={!query.trim() || loading}
                  className={cn(
                    "px-4 py-2 rounded-xl font-medium text-sm transition-all active:scale-95",
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

            {/* Link Input Form */}
            {showLinkInput && (
              <div className="mt-3 glass rounded-2xl p-4 shadow-lg border border-orange-100">
                <div className="flex items-center gap-2 mb-2">
                  <Link className="w-4 h-4 text-orange-500" />
                  <span className="text-sm font-medium text-slate-700">Добавить рилс по ссылке</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleParseLink()}
                    placeholder="https://instagram.com/reel/ABC123..."
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 bg-white/80 outline-none focus:ring-2 focus:ring-orange-500/30 text-sm"
                  />
                  <button
                    onClick={handleParseLink}
                    disabled={!linkUrl.trim() || linkLoading}
                    className={cn(
                      "px-4 py-2 rounded-xl font-medium text-sm transition-all active:scale-95 flex items-center gap-2",
                      "bg-gradient-to-r from-orange-500 to-amber-600 text-white",
                      "hover:from-orange-400 hover:to-amber-500",
                      "disabled:opacity-40 disabled:cursor-not-allowed"
                    )}
                  >
                    {linkLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Добавить
                  </button>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Вставьте ссылку на рилс Instagram для добавления во входящие
                </p>
              </div>
            )}

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
              <div className="relative w-full flex items-center justify-center" style={{ height: '480px' }}>
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
                    const viralCoef = calculateViralCoefficient(reel.view_count, reel.taken_at);
                    const dateText = formatVideoDate(reel.taken_at);
                    
                    if (absOffset > 3) return null;

                    const translateX = offset * 190;
                    const translateZ = isActive ? 80 : -absOffset * 80;
                    const rotateY = offset * -12;
                    const scale = isActive ? 1 : Math.max(0.75, 1 - absOffset * 0.12);
                    const opacity = isActive ? 1 : Math.max(0.5, 1 - absOffset * 0.25);

                    const thumbnailUrl = reel.thumbnail_url || reel.display_url || 'https://via.placeholder.com/200x300';
                    
                    return (
                      <div
                        key={`carousel-${reel.shortcode || reel.id}-${index}`}
                        onClick={() => isActive ? setSelectedVideo(reel) : setActiveIndex(index)}
                        draggable={isActive}
                        onDragStart={(e) => isActive && handleDragStart(e, reel)}
                        className={cn(
                          'absolute transition-all duration-500 ease-out cursor-pointer group',
                          isActive && 'cursor-grab active:cursor-grabbing z-10'
                        )}
                        style={{
                          transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                          opacity,
                          zIndex: 10 - absOffset,
                        }}
                      >
                        <div className={cn(
                          'w-[200px] rounded-[1.5rem] overflow-hidden shadow-2xl relative',
                          isActive && 'ring-4 ring-orange-400/50'
                        )}>
                          {/* Image with gradient overlay */}
                          <div className="relative w-full" style={{ aspectRatio: '3/4' }}>
                            <img
                              src={thumbnailUrl}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = 'https://via.placeholder.com/200x267?text=Video';
                              }}
                            />
                            
                            {/* Dark gradient overlay */}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                            
                            {/* Viral badge */}
                            <div className="absolute top-3 left-3 z-10">
                              <div className={cn(
                                "px-2 py-0.5 rounded-full backdrop-blur-md flex items-center gap-1 shadow-lg",
                                viralCoef > 10 ? "bg-emerald-500 text-white" : 
                                viralCoef > 5 ? "bg-amber-500 text-white" :
                                viralCoef > 0 ? "bg-white/90 text-slate-700" :
                                "bg-black/40 text-white/70"
                              )}>
                                <Sparkles className="w-2.5 h-2.5" />
                                <span className="text-[10px] font-bold">{viralCoef > 0 ? viralCoef : '—'}</span>
                              </div>
                            </div>
                            
                            {/* Date badge */}
                            {dateText && (
                              <div className="absolute top-3 right-3 z-10">
                                <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-semibold shadow-lg">
                                  {dateText}
                                </div>
                              </div>
                            )}
                              
                            {/* Play button on active */}
                            {isActive && (
                              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-12 h-12 rounded-full bg-white/95 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                                  <Play className="w-5 h-5 text-slate-800 ml-0.5" fill="currentColor" />
                                </div>
                              </div>
                            )}
                            
                            {/* Bottom info */}
                            <div className="absolute bottom-0 left-0 right-0 p-3">
                              {/* Username with verified */}
                              <div className="flex items-center gap-1 mb-1">
                                <p className="text-[12px] font-semibold text-white truncate drop-shadow-lg">
                                  @{reel.owner?.username || 'instagram'}
                                </p>
                                {viralCoef > 5 && (
                                  <div className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                                    <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                              
                              {/* Stats row */}
                              <div className="flex items-center gap-2.5 text-white/90">
                                <div className="flex items-center gap-0.5">
                                  <Eye className="w-3 h-3" />
                                  <span className="text-[10px] font-medium">{formatNumber(reel.view_count)}</span>
                                </div>
                                <div className="flex items-center gap-0.5">
                                  <Heart className="w-3 h-3" />
                                  <span className="text-[10px] font-medium">{formatNumber(reel.like_count)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Active reel info - simplified */}
              {reels[activeIndex] && (
                <div className="w-full max-w-md mt-2">
                  <div className="bg-white/80 backdrop-blur-xl rounded-2xl px-5 py-3 shadow-lg border border-white/50">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-sans text-sm font-medium text-slate-700 truncate">
                          @{reels[activeIndex].owner?.username || 'trending'}
                        </p>
                        <p className="font-sans text-xs text-slate-400 truncate">
                          {typeof reels[activeIndex].caption === 'string' 
                            ? reels[activeIndex].caption?.slice(0, 40) + '...'
                            : 'Популярное видео'}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleAddToCanvas(reels[activeIndex])}
                          className="p-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white transition-all shadow-lg shadow-orange-500/30"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                        <a
                          href={reels[activeIndex].url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 transition-all"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Dots */}
              <div className="flex items-center justify-center gap-1.5 mt-3">
                {reels.slice(0, Math.min(reels.length, 15)).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveIndex(index)}
                    className={cn(
                      'h-2 rounded-full transition-all',
                      index === activeIndex 
                        ? 'w-8 bg-gradient-to-r from-orange-500 to-amber-500' 
                        : 'w-2 bg-slate-300 hover:bg-slate-400'
                    )}
                  />
                ))}
              </div>

              <p className="font-sans text-slate-400 text-xs mt-3">
                Популярные видео • Нажмите для просмотра • ← →
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
                {/* Header with count and sorting */}
                <div className="flex flex-col gap-4 mb-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-500 font-medium">
                      Найдено {reels.length} видео по запросу "{query}"
                    </p>
                    
                    {/* Sort buttons */}
                    <div className="flex items-center gap-1 bg-white rounded-2xl p-1 shadow-sm border border-slate-100">
                      {[
                        { value: 'views', label: 'Просмотры', icon: Eye },
                        { value: 'likes', label: 'Лайки', icon: Heart },
                        { value: 'viral', label: 'Вирал', icon: Sparkles },
                      ].map(({ value, label, icon: Icon }) => (
                        <button
                          key={value}
                          onClick={() => setSortBy(value as SortOption)}
                          className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all",
                            sortBy === value 
                              ? "bg-slate-900 text-white" 
                              : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  {/* Related search suggestions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-slate-400">Похожие:</span>
                    {[
                      `#${query.replace(/\s+/g, '')}`,
                      `${query} тренды`,
                      `${query} 2025`,
                      `${query} советы`,
                    ].map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => handleSearch(suggestion)}
                        className="px-3 py-1 rounded-full bg-white hover:bg-orange-50 border border-slate-200 hover:border-orange-300 text-xs text-slate-600 hover:text-orange-600 transition-all"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
                  {sortedReels.map((reel, idx) => {
                    const viralCoef = calculateViralCoefficient(reel.view_count, reel.taken_at);
                    const captionText = typeof reel.caption === 'string' ? reel.caption : 'Видео из Instagram';
                    const thumbnailUrl = reel.thumbnail_url || reel.display_url || 'https://via.placeholder.com/270x360';
                    const cardId = `grid-${reel.shortcode || reel.id}-${idx}`;
                    const dateText = formatVideoDate(reel.taken_at);
                    const isMenuOpen = cardFolderSelect === cardId;
                    
                    return (
                      <div
                        key={cardId}
                        draggable
                        onDragStart={(e) => handleDragStart(e, reel)}
                        onClick={() => !isMenuOpen && setSelectedVideo(reel)}
                        className="group relative rounded-[1.5rem] overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer hover:scale-[1.02] active:scale-[0.98] bg-white"
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
                          
                          {/* Dark gradient overlay for text readability */}
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
                          {dateText && (
                            <div className="absolute top-3 right-3 z-10">
                              <div className="px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-white text-sm font-semibold shadow-lg">
                                {dateText}
                              </div>
                            </div>
                          )}
                          
                          {/* Play button on hover */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            <div className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-2xl">
                              <Play className="w-6 h-6 text-slate-800 ml-1" fill="currentColor" />
                            </div>
                          </div>
                          
                          {/* Bottom info overlay */}
                          <div className="absolute bottom-0 left-0 right-0 p-4">
                            {/* Username with verified badge */}
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
                            
                            {/* Stats and add button row */}
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
                              
                              {/* Add button with folder menu */}
                              <div className="relative">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCardFolderSelect(isMenuOpen ? null : cardId);
                                  }}
                                  className={cn(
                                    "w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-lg",
                                    isMenuOpen 
                                      ? "bg-orange-500 text-white rotate-45" 
                                      : "bg-white text-slate-800 hover:bg-orange-500 hover:text-white"
                                  )}
                                >
                                  <Plus className="w-5 h-5" />
                                </button>
                                
                                {/* Folder selection menu */}
                                {isMenuOpen && (
                                  <div 
                                    className="absolute bottom-12 right-0 bg-white rounded-2xl shadow-2xl p-2 min-w-[160px] z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <button
                                      onClick={() => {
                                        handleAddToCanvas(reel);
                                        setCardFolderSelect(null);
                                      }}
                                      className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-orange-50 transition-colors text-left"
                                    >
                                      <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                                        <Plus className="w-4 h-4 text-orange-600" />
                                      </div>
                                      <span className="text-sm font-medium text-slate-700">Входящие</span>
                                    </button>
                                    
                                    <div className="h-px bg-slate-100 my-1" />
                                    
                                    {folderConfigs.map((folder) => {
                                      const FolderIcon = folder.icon;
                                      return (
                                        <button
                                          key={folder.id}
                                          onClick={() => {
                                            handleAddToFolder(reel, folder.id);
                                            setCardFolderSelect(null);
                                          }}
                                          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-slate-50 transition-colors text-left"
                                        >
                                          <div 
                                            className="w-8 h-8 rounded-lg flex items-center justify-center"
                                            style={{ backgroundColor: `${folder.color}20` }}
                                          >
                                            <FolderIcon className="w-4 h-4" style={{ color: folder.color }} />
                                          </div>
                                          <span className="text-sm font-medium text-slate-700">{folder.title}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
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

          {/* VIDEO DETAIL MODAL - Horizontal Layout */}
          {selectedVideo && (
            <div 
              className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
              onClick={() => { setSelectedVideo(null); setShowFolderSelect(false); }}
            >
              <div 
                className="relative bg-white rounded-3xl overflow-hidden max-w-4xl w-full max-h-[85vh] shadow-2xl flex flex-col md:flex-row"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close button */}
                <button
                  onClick={() => { setSelectedVideo(null); setShowFolderSelect(false); }}
                  className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>

                {/* Left side - Video thumbnail */}
                <div className="relative w-full md:w-2/5 flex-shrink-0">
                  <div className="relative w-full h-64 md:h-full md:min-h-[500px]">
                    <img
                      src={selectedVideo.thumbnail_url || selectedVideo.display_url || 'https://via.placeholder.com/400x711'}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    
                    {/* Dark gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent md:bg-gradient-to-r md:from-transparent md:via-transparent md:to-black/30" />
                    
                    {/* Play button */}
                    <a
                      href={selectedVideo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute inset-0 flex items-center justify-center group"
                    >
                      <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-white/95 flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                        <Play className="w-6 h-6 md:w-8 md:h-8 text-slate-800 ml-1" fill="currentColor" />
                      </div>
                    </a>

                    {/* Viral coefficient badge */}
                    {(() => {
                      const viralCoef = calculateViralCoefficient(selectedVideo.view_count, selectedVideo.taken_at);
                      return (
                        <div className="absolute top-4 left-4">
                          <div className={cn(
                            "px-3 py-1.5 rounded-xl backdrop-blur-md flex items-center gap-2 shadow-lg border",
                            viralCoef > 10 ? "bg-emerald-500/90 text-white border-emerald-400/50" : 
                            viralCoef > 5 ? "bg-amber-500/90 text-white border-amber-400/50" :
                            viralCoef > 0 ? "bg-white/90 text-slate-700 border-white/50" :
                            "bg-black/40 text-white/90 border-white/20"
                          )}>
                            <Sparkles className="w-4 h-4" />
                            <span className="font-sans font-bold">{viralCoef || '—'}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                {/* Right side - Info panel */}
                <div className="flex-1 p-6 flex flex-col overflow-y-auto">
                  {/* Username and date */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white font-bold text-sm">
                          {selectedVideo.owner?.username?.[0]?.toUpperCase() || 'V'}
                        </span>
                      </div>
                      <div>
                        <p className="font-sans font-medium text-slate-800">@{selectedVideo.owner?.username || 'instagram'}</p>
                        {selectedVideo.taken_at && (
                          <p className="font-sans text-xs text-slate-500">
                            {(() => {
                              const d = selectedVideo.taken_at.includes?.('T') 
                                ? new Date(selectedVideo.taken_at) 
                                : new Date(Number(selectedVideo.taken_at) * 1000);
                              return !isNaN(d.getTime()) ? d.toLocaleDateString('ru-RU', {
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                              }) : '';
                            })()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 mb-5">
                    <div className="flex-1 bg-blue-50 rounded-xl px-3 py-3 text-center">
                      <Eye className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                      <span className="font-sans text-sm font-bold text-slate-800 block">{formatNumber(selectedVideo.view_count)}</span>
                      <span className="font-sans text-[10px] text-slate-400">просмотров</span>
                    </div>
                    <div className="flex-1 bg-rose-50 rounded-xl px-3 py-3 text-center">
                      <Heart className="w-5 h-5 text-rose-500 mx-auto mb-1" />
                      <span className="font-sans text-sm font-bold text-slate-800 block">{formatNumber(selectedVideo.like_count)}</span>
                      <span className="font-sans text-[10px] text-slate-400">лайков</span>
                    </div>
                    <div className="flex-1 bg-emerald-50 rounded-xl px-3 py-3 text-center">
                      <MessageCircle className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
                      <span className="font-sans text-sm font-bold text-slate-800 block">{formatNumber(selectedVideo.comment_count)}</span>
                      <span className="font-sans text-[10px] text-slate-400">комментов</span>
                    </div>
                  </div>

                  {/* Caption */}
                  <div className="flex-1 mb-5">
                    <p className="font-sans text-slate-500 text-xs mb-2">Описание</p>
                    <p className="font-sans text-slate-700 text-sm leading-relaxed">
                      {typeof selectedVideo.caption === 'string' 
                        ? (selectedVideo.caption.length > 300 
                            ? selectedVideo.caption.slice(0, 300) + '...' 
                            : selectedVideo.caption)
                        : 'Без описания'}
                    </p>
                  </div>

                  {/* Folder selection */}
                  {showFolderSelect && (
                    <div className="mb-4 p-4 bg-slate-50 rounded-2xl">
                      <p className="font-sans text-sm font-medium text-slate-700 mb-3">Выберите папку</p>
                      <div className="grid grid-cols-2 gap-2">
                        {folderConfigs.map((folder) => {
                          const Icon = folder.icon;
                          return (
                            <button
                              key={folder.id}
                              onClick={() => handleAddToFolder(selectedVideo, folder.id)}
                              className="flex items-center gap-2 p-3 rounded-xl bg-white hover:bg-slate-100 transition-all active:scale-95 border border-slate-200"
                            >
                              <div 
                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                style={{ backgroundColor: `${folder.color}20` }}
                              >
                                <Icon className="w-4 h-4" style={{ color: folder.color }} />
                              </div>
                              <span className="font-sans text-sm font-medium text-slate-700">{folder.title}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-3 mt-auto">
                    <button
                      onClick={() => {
                        handleAddToCanvas(selectedVideo);
                        setSelectedVideo(null);
                      }}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium flex items-center justify-center gap-2 hover:from-orange-400 hover:to-amber-400 transition-all shadow-lg shadow-orange-500/30 active:scale-95"
                    >
                      <Plus className="w-5 h-5" />
                      Во входящие
                    </button>
                    <button
                      onClick={() => setShowFolderSelect(!showFolderSelect)}
                      className={cn(
                        "px-4 py-3 rounded-xl font-medium flex items-center justify-center gap-2 transition-all active:scale-95",
                        showFolderSelect 
                          ? "bg-indigo-500 text-white" 
                          : "bg-slate-100 hover:bg-slate-200 text-slate-700"
                      )}
                    >
                      <FolderPlus className="w-5 h-5" />
                      <span className="hidden sm:inline">В папку</span>
                    </button>
                    <a
                      href={selectedVideo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
                    >
                      <ExternalLink className="w-5 h-5" />
                      <span className="hidden sm:inline">Открыть</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
