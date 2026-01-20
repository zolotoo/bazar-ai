import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, ExternalLink, Plus, Eye, Heart, MessageCircle, ChevronLeft, ChevronRight, Sparkles, Play, Link, Loader2, Radar, UserPlus, Check } from 'lucide-react';
import { TextShimmer } from './TextShimmer';
import { VideoGradientCard } from './VideoGradientCard';
import { GlassTabButton, GlassTabGroup } from './GlassTabButton';
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
import { useProjectContext } from '../../contexts/ProjectContext';
import { IncomingVideo } from '../../types';
import { cn } from '../../utils/cn';
import { supabase } from '../../utils/supabase';
import { FolderPlus, Star, Sparkles as SparklesIcon, FileText, CheckCircle, ChevronDown as ChevronDownIcon } from 'lucide-react';
import { toast } from 'sonner';

interface SearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'search' | 'link' | 'radar';
  currentProjectId?: string | null;
  currentProjectName?: string;
}

function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

// Проксирование Instagram изображений через наш API
function proxyImageUrl(url?: string): string {
  if (!url) return 'https://via.placeholder.com/270x360';
  // Если уже проксировано или это placeholder - возвращаем как есть
  if (url.includes('/api/proxy-image') || url.includes('placeholder.com')) return url;
  // Если это Instagram CDN - проксируем
  if (url.includes('cdninstagram.com') || url.includes('instagram.com')) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
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

// Search tab type
type SearchTab = 'search' | 'link' | 'radar';

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

export function SearchPanel({ isOpen, onClose, initialTab = 'search', currentProjectId, currentProjectName = 'Проект' }: SearchPanelProps) {
  const [query, setQuery] = useState('');
  const [reels, setReels] = useState<InstagramSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [_error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('carousel');
  const [activeIndex, setActiveIndex] = useState(0);
  const [sortBy, setSortBy] = useState<SortOption>('views');
  const [selectedVideo, setSelectedVideo] = useState<InstagramSearchResult | null>(null);
  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkLoading, setLinkLoading] = useState(false);
  const [linkPreview, setLinkPreview] = useState<InstagramSearchResult | null>(null);
  const [showFolderSelect, setShowFolderSelect] = useState(false);
  const [cardFolderSelect, setCardFolderSelect] = useState<string | null>(null);
  const [radarUsername, setRadarUsername] = useState('');
  const [isSpinning, setIsSpinning] = useState(false);
  const [_spinOffset, setSpinOffset] = useState(0);
  const [showProjectSelect, setShowProjectSelect] = useState(false);
  const [selectedProjectForAdd, setSelectedProjectForAdd] = useState<string | null>(currentProjectId || null);
  const { incomingVideos } = useFlowStore();
  const { addVideoToInbox } = useInboxVideos();
  const { history: searchHistory, addToHistory, refetch: refetchHistory, getTodayCache, getAllResultsByQuery } = useSearchHistory();
  useWorkspaceZones(); // keep hook for potential future use
  const { projects, currentProject } = useProjectContext();
  
  // Минимум просмотров для показа в поиске
  const MIN_VIEWS = 30000;
  const inputRef = useRef<HTMLInputElement>(null);
  const spinIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Используем папки из выбранного проекта или текущего
  const activeProjectId = selectedProjectForAdd || currentProjectId;
  const activeProject = projects.find(p => p.id === activeProjectId) || currentProject;
  const activeProjectName = activeProject?.name || currentProjectName;
  
  // Папки из проекта (или дефолтные)
  const projectFolders = activeProject?.folders || [];
  
  // Маппинг иконок по названию
  const getIconByName = (iconName: string) => {
    const iconMap: Record<string, typeof SparklesIcon> = {
      'lightbulb': SparklesIcon,
      'file': FileText,
      'camera': Star,
      'scissors': SparklesIcon,
      'check': CheckCircle,
      'rejected': FolderPlus,
      'all': FolderPlus,
    };
    return iconMap[iconName] || FolderPlus;
  };
  
  // Конфигурация папок для добавления (из проекта), исключая "Все видео"
  const folderConfigs = projectFolders
    .filter(f => f.icon !== 'all') // "Все видео" - это отсутствие папки
    .map(f => ({
      id: f.id,
      title: f.name,
      color: f.color,
      icon: getIconByName(f.icon),
    }));

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
      setActiveTab(initialTab);
      
      // Всегда загружаем популярные видео из общей базы для карусели
      loadPopularFromDatabase();
    }
  }, [isOpen, initialTab]);

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

  // Запуск анимации барабана
  const startSpinAnimation = useCallback(() => {
    setIsSpinning(true);
    setViewMode('trending');
    
    // Быстрая прокрутка карусели как барабан
    let speed = 50; // начальная скорость (мс)
    let count = 0;
    
    const spin = () => {
      setSpinOffset(prev => prev + 1);
      setActiveIndex(prev => (prev + 1) % Math.max(reels.length, 10));
      count++;
      
      // Постепенно замедляем
      if (count < 20) {
        speed = 50;
      } else if (count < 35) {
        speed = 80;
      } else if (count < 45) {
        speed = 120;
      } else if (count < 52) {
        speed = 180;
      } else {
        // Останавливаем
        setIsSpinning(false);
        if (spinIntervalRef.current) {
          clearTimeout(spinIntervalRef.current);
          spinIntervalRef.current = null;
        }
        return;
      }
      
      spinIntervalRef.current = setTimeout(spin, speed);
    };
    
    spin();
  }, [reels.length]);

  // Остановка анимации при размонтировании
  useEffect(() => {
    return () => {
      if (spinIntervalRef.current) {
        clearTimeout(spinIntervalRef.current);
      }
    };
  }, []);

  const handleSearch = useCallback(async (searchQuery?: string) => {
    const queryToSearch = searchQuery || query;
    if (!queryToSearch.trim()) return;

    const cleanQuery = queryToSearch.trim();
    
    if (searchQuery) {
      setQuery(searchQuery);
    }

    // Проверяем кэш - если запрос был сегодня, используем кэш + добавляем старые результаты
    const cachedResults = getTodayCache(cleanQuery);
    const historicalResults = getAllResultsByQuery(cleanQuery);
    
    if (cachedResults && cachedResults.length > 0) {
      console.log('[Search] Using cached results from today:', cachedResults.length);
      
      // Объединяем кэш с историческими результатами
      const existingCodes = new Set(cachedResults.map(r => r.shortcode));
      const combinedResults = [...cachedResults];
      
      for (const reel of historicalResults) {
        if (reel.shortcode && !existingCodes.has(reel.shortcode)) {
          combinedResults.push(reel);
          existingCodes.add(reel.shortcode);
        }
      }
      
      // Фильтруем по минимуму просмотров и сортируем по виральности
      const filteredResults = combinedResults
        .filter(r => (r.view_count || 0) >= MIN_VIEWS)
        .sort((a, b) => calculateViralCoefficient(b.view_count, b.taken_at) - calculateViralCoefficient(a.view_count, a.taken_at));
      
      setReels(filteredResults);
      
      // Запускаем анимацию барабана с кэшированными результатами
      setViewMode('trending');
      startSpinAnimation();
      
      setTimeout(() => {
        setViewMode('results');
        toast.success(`Из кэша: ${filteredResults.length} видео`, {
          description: `Запрос уже был сегодня`,
        });
      }, 3000);
      
      return;
    }

    // Запускаем анимацию барабана сразу с текущими видео
    if (reels.length > 0) {
      startSpinAnimation();
    }
    
    setLoading(true);
    setError(null);

    try {
      // Параллельный поиск по нескольким вариациям запроса
      const hashtagQuery = cleanQuery.replace(/^#/, '').replace(/\s+/g, '');
      
      // Генерируем вариации для расширения поиска
      const variations = generateSearchVariations(cleanQuery);
      
      // Запускаем все запросы параллельно:
      // 1. Основной поиск по ключевому слову
      // 2. Поиск по хэштегу
      // 3. Поиск по вариациям (reels, viral, тренд)
      const searchPromises: Promise<InstagramSearchResult[]>[] = [
        searchInstagramVideos(cleanQuery),
        cleanQuery.startsWith('#') ? Promise.resolve([]) : getHashtagReels(hashtagQuery),
        ...variations.map(v => searchInstagramVideos(v).catch(() => [])),
      ];
      
      const results = await Promise.all(searchPromises);
      
      // Объединяем результаты, убираем дубликаты по shortcode
      const existingCodes = new Set<string>();
      const allResults: InstagramSearchResult[] = [];
      
      // Добавляем новые результаты
      for (const resultSet of results) {
        for (const reel of resultSet) {
          if (reel.shortcode && !existingCodes.has(reel.shortcode)) {
            allResults.push(reel);
            existingCodes.add(reel.shortcode);
          }
        }
      }
      
      // Добавляем исторические результаты по этому запросу
      for (const reel of historicalResults) {
        if (reel.shortcode && !existingCodes.has(reel.shortcode)) {
          allResults.push(reel);
          existingCodes.add(reel.shortcode);
        }
      }
      
      // Фильтруем по минимуму просмотров (30,000+) и сортируем по виральности
      const filteredResults = allResults
        .filter(r => (r.view_count || 0) >= MIN_VIEWS)
        .sort((a, b) => calculateViralCoefficient(b.view_count, b.taken_at) - calculateViralCoefficient(a.view_count, a.taken_at));
      
      setReels(filteredResults);
      
      // Если барабан не крутится (не было видео), запускаем
      if (!isSpinning && filteredResults.length > 0) {
        startSpinAnimation();
      }
      
      // Сохраняем в историю ВСЕ результаты (без фильтра), чтобы при повторном поиске их использовать
      addToHistory(cleanQuery, allResults);
      
      // Показываем результаты после завершения анимации
      setTimeout(() => {
        setViewMode('results');
        
        if (filteredResults.length === 0) {
          setError('Видео с 30K+ просмотрами не найдены');
          setViewMode('carousel');
        } else {
          const totalFound = allResults.length;
          const filtered = totalFound - filteredResults.length;
          
          toast.success(`Найдено ${filteredResults.length} видео`, {
            description: filtered > 0 ? `${filtered} скрыто (<30K просмотров)` : undefined,
          });
        }
      }, isSpinning ? 3500 : 500);
      
    } catch (err) {
      console.error('Search error:', err);
      setError('Ошибка поиска');
      setViewMode('carousel');
    } finally {
      setLoading(false);
    }
  }, [query, addToHistory, getTodayCache, getAllResultsByQuery, reels.length, isSpinning, startSpinAnimation]);

  // Генерация вариаций поискового запроса
  const generateSearchVariations = (query: string): string[] => {
    const cleanQuery = query.toLowerCase().replace(/^#/, '').trim();
    const variations: string[] = [];
    
    if (cleanQuery.length >= 3) {
      // Английские вариации
      variations.push(`${cleanQuery} reels`);
      variations.push(`${cleanQuery} viral`);
      
      // Для русских запросов добавляем русские вариации
      if (/[а-яё]/i.test(cleanQuery)) {
        variations.push(`${cleanQuery} тренд`);
        variations.push(`${cleanQuery} рилс`);
      }
    }
    
    return variations;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSearch();
    }
  };

  const handleAddToCanvas = async (result: InstagramSearchResult, folderId: string = 'ideas') => {
    let captionText = typeof result.caption === 'string' ? result.caption : '';
    if (captionText.length > 200) {
      captionText = captionText.substring(0, 200) + '...';
    }
    
    const folderName = folderConfigs.find(f => f.id === folderId)?.title || 'Идеи';
    
    try {
      await addVideoToInbox({
        title: captionText || 'Видео из Instagram',
        previewUrl: result.thumbnail_url || result.display_url || '',
        url: result.url,
        viewCount: result.view_count,
        likeCount: result.like_count,
        commentCount: result.comment_count,
        ownerUsername: result.owner?.username,
        projectId: currentProjectId || undefined,
        folderId: folderId,
        takenAt: result.taken_at,
      });
      toast.success(`Добавлено в "${folderName}"`, {
        description: `Проект: ${currentProjectName} • @${result.owner?.username || 'instagram'}`,
      });
    } catch (err) {
      console.error('Ошибка сохранения видео:', err);
      toast.error('Ошибка сохранения видео');
    }
  };

  // Обработка ссылки на рилс - показать превью
  const handleParseLink = async () => {
    if (!linkUrl.trim()) return;
    
    setLinkLoading(true);
    setLinkPreview(null);
    try {
      const reel = await getReelByUrl(linkUrl);
      
      if (reel) {
        // Показываем превью карточки
        setLinkPreview(reel);
        toast.success('Видео найдено!', {
          description: 'Нажмите "Добавить в Идеи" для сохранения',
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

  // Добавление видео из превью в "Все видео" (без папки)
  const handleAddLinkPreviewToAllVideos = async (folderId?: string) => {
    if (!linkPreview) return;
    
    // Проверяем что проект выбран
    if (!activeProjectId) {
      setShowProjectSelect(true);
      toast.error('Сначала выберите проект');
      return;
    }
    
    try {
      const captionText = typeof linkPreview.caption === 'string' ? linkPreview.caption.slice(0, 200) : 'Видео из Instagram';
      
      await addVideoToInbox({
        title: captionText,
        previewUrl: linkPreview.thumbnail_url || linkPreview.display_url || '',
        url: linkPreview.url,
        viewCount: linkPreview.view_count,
        likeCount: linkPreview.like_count,
        commentCount: linkPreview.comment_count,
        ownerUsername: linkPreview.owner?.username,
        projectId: activeProjectId,
        folderId: folderId, // undefined = "Все видео", или конкретная папка
        takenAt: linkPreview.taken_at,
      });
      
      const folderName = folderId ? folderConfigs.find(f => f.id === folderId)?.title || 'папку' : 'Все видео';
      
      setLinkUrl('');
      setLinkPreview(null);
      setShowProjectSelect(false);
      toast.success(`Добавлено в "${folderName}"`, {
        description: `Проект: ${activeProjectName} • @${linkPreview.owner?.username || 'instagram'}`,
      });
    } catch (err) {
      console.error('Ошибка добавления:', err);
      toast.error('Ошибка при добавлении');
    }
  };

  // Добавление видео в папку
  const handleAddToFolder = async (result: InstagramSearchResult, folderId: string) => {
    // Проверяем что проект выбран
    if (!activeProjectId) {
      setShowProjectSelect(true);
      toast.error('Сначала выберите проект');
      return;
    }
    
    const captionText = typeof result.caption === 'string' ? result.caption.slice(0, 500) : 'Видео из Instagram';
    const folderName = folderConfigs.find(f => f.id === folderId)?.title || 'папку';
    
    try {
      // Всегда используем addVideoToInbox для сохранения в Supabase
      await addVideoToInbox({
        title: captionText,
        previewUrl: result.thumbnail_url || result.display_url || '',
        url: result.url,
        viewCount: result.view_count,
        likeCount: result.like_count,
        commentCount: result.comment_count,
        ownerUsername: result.owner?.username,
        projectId: activeProjectId,
        folderId: folderId,
        takenAt: result.taken_at,
      });
      
      setShowFolderSelect(false);
      setSelectedVideo(null);
      setCardFolderSelect(null);
      toast.success(`Добавлено в "${folderName}"`, {
        description: `Проект: ${activeProjectName} • @${result.owner?.username || 'instagram'}`,
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
        
        {/* Header with Tabs and Search */}
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

            {/* Project indicator */}
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="px-3 py-1.5 rounded-full bg-orange-100 text-orange-700 text-xs font-medium flex items-center gap-1.5">
                <FolderPlus className="w-3.5 h-3.5" />
                Проект: {currentProjectName}
              </div>
            </div>

            {/* Glass Tab Buttons */}
            <div className="flex justify-center mb-4">
              <GlassTabGroup>
                <GlassTabButton
                  isActive={activeTab === 'search'}
                  onClick={() => setActiveTab('search')}
                  icon={<Search className="w-4 h-4" />}
                >
                  Поиск
                </GlassTabButton>
                <GlassTabButton
                  isActive={activeTab === 'link'}
                  onClick={() => setActiveTab('link')}
                  icon={<Link className="w-4 h-4" />}
                >
                  По ссылке
                </GlassTabButton>
                <GlassTabButton
                  isActive={activeTab === 'radar'}
                  onClick={() => setActiveTab('radar')}
                  icon={<Radar className="w-4 h-4" />}
                >
                  Радар
                </GlassTabButton>
              </GlassTabGroup>
            </div>

            {/* Search Tab Content */}
            {activeTab === 'search' && (
              <>
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
              </>
            )}

            {/* Link Tab Content */}
            {activeTab === 'link' && (
              <div className="space-y-4">
                <div className="glass rounded-2xl p-5 shadow-xl shadow-orange-500/10">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                      <Link className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-800">Добавить по ссылке</h3>
                      <p className="text-xs text-slate-500">Вставьте ссылку на рилс Instagram</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={linkUrl}
                      onChange={(e) => setLinkUrl(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleParseLink()}
                      placeholder="https://instagram.com/reel/ABC123..."
                      className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-white/80 outline-none focus:ring-2 focus:ring-orange-500/30 text-sm"
                    />
                    <button
                      onClick={handleParseLink}
                      disabled={!linkUrl.trim() || linkLoading}
                      className={cn(
                        "px-5 py-3 rounded-xl font-medium text-sm transition-all active:scale-95 flex items-center gap-2",
                        "bg-gradient-to-r from-orange-500 to-amber-600 text-white",
                        "hover:from-orange-400 hover:to-amber-500",
                        "disabled:opacity-40 disabled:cursor-not-allowed",
                        "shadow-lg shadow-orange-500/30"
                      )}
                    >
                      {linkLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Search className="w-4 h-4" />
                      )}
                      Найти
                    </button>
                  </div>
                </div>

                {/* Link Preview Card */}
                {linkPreview && (
                  <div className="glass rounded-2xl p-5 shadow-xl shadow-orange-500/10 animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex gap-5">
                      {/* Video Thumbnail */}
                      <div className="relative w-48 flex-shrink-0">
                        <div className="aspect-[9/16] rounded-xl overflow-hidden shadow-lg">
                          <img
                            src={proxyImageUrl(linkPreview.thumbnail_url || linkPreview.display_url)}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                          {/* Play overlay */}
                          <a
                            href={linkPreview.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
                          >
                            <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
                              <Play className="w-5 h-5 text-slate-800 ml-0.5" fill="currentColor" />
                            </div>
                          </a>
                        </div>
                      </div>

                      {/* Video Info */}
                      <div className="flex-1 flex flex-col">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                            {(linkPreview.owner?.username || 'U')[0].toUpperCase()}
                          </div>
                          <span className="text-sm font-medium text-slate-800">@{linkPreview.owner?.username || 'instagram'}</span>
                        </div>

                        <p className="text-sm text-slate-600 line-clamp-3 mb-4">
                          {typeof linkPreview.caption === 'string' ? linkPreview.caption.slice(0, 200) : 'Видео из Instagram'}
                        </p>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                          <div className="flex items-center gap-1.5">
                            <Eye className="w-4 h-4" />
                            <span>{formatNumber(linkPreview.view_count)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <Heart className="w-4 h-4" />
                            <span>{formatNumber(linkPreview.like_count)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <MessageCircle className="w-4 h-4" />
                            <span>{formatNumber(linkPreview.comment_count)}</span>
                          </div>
                        </div>

                        {/* Viral coefficient */}
                        <div className="flex items-center gap-2 mb-4">
                          <SparklesIcon className="w-4 h-4 text-amber-500" />
                          <span className="text-sm text-slate-600">
                            Виральность: <span className="font-semibold text-amber-600">
                              {calculateViralCoefficient(linkPreview.view_count, linkPreview.taken_at).toFixed(1)}
                            </span>
                          </span>
                        </div>

                        {/* Выбор проекта */}
                        <div className="mb-4">
                          <label className="text-xs text-slate-500 mb-1.5 block">Добавить в проект:</label>
                          <div className="relative">
                            <button
                              onClick={() => setShowProjectSelect(!showProjectSelect)}
                              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors text-left"
                            >
                              <span className="text-sm font-medium text-slate-700">
                                {activeProjectName || 'Выберите проект'}
                              </span>
                              <ChevronDownIcon className={cn(
                                "w-4 h-4 text-slate-400 transition-transform",
                                showProjectSelect && "rotate-180"
                              )} />
                            </button>
                            {showProjectSelect && (
                              <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-slate-200 z-50 py-1 max-h-48 overflow-auto">
                                {projects.map(project => (
                                  <button
                                    key={project.id}
                                    onClick={() => {
                                      setSelectedProjectForAdd(project.id);
                                      setShowProjectSelect(false);
                                    }}
                                    className={cn(
                                      "w-full flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left",
                                      activeProjectId === project.id && "bg-orange-50"
                                    )}
                                  >
                                    <div 
                                      className="w-3 h-3 rounded-full"
                                      style={{ backgroundColor: project.color || '#f97316' }}
                                    />
                                    <span className="text-sm text-slate-700">{project.name}</span>
                                    {activeProjectId === project.id && (
                                      <Check className="w-4 h-4 text-orange-500 ml-auto" />
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Выбор папки */}
                        <div className="mb-4">
                          <label className="text-xs text-slate-500 mb-1.5 block">Выберите папку:</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              onClick={() => handleAddLinkPreviewToAllVideos(undefined)}
                              disabled={!activeProjectId}
                              className={cn(
                                "flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-left",
                                "border-slate-200 hover:border-orange-300 hover:bg-orange-50",
                                !activeProjectId && "opacity-50 cursor-not-allowed"
                              )}
                            >
                              <FolderPlus className="w-4 h-4 text-slate-500" />
                              <span className="text-sm text-slate-700">Все видео</span>
                            </button>
                            {folderConfigs.map((folder) => {
                              const FolderIcon = folder.icon;
                              return (
                                <button
                                  key={folder.id}
                                  onClick={() => handleAddLinkPreviewToAllVideos(folder.id)}
                                  disabled={!activeProjectId}
                                  className={cn(
                                    "flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all text-left",
                                    "border-slate-200 hover:border-orange-300 hover:bg-orange-50",
                                    !activeProjectId && "opacity-50 cursor-not-allowed"
                                  )}
                                >
                                  <FolderIcon className="w-4 h-4" style={{ color: folder.color }} />
                                  <span className="text-sm text-slate-700 truncate">{folder.title}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="mt-auto flex items-center gap-2">
                          <button
                            onClick={() => setLinkPreview(null)}
                            className="flex-1 px-4 py-3 rounded-xl font-medium text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Radar Tab Content */}
            {activeTab === 'radar' && (
              <div className="glass rounded-2xl p-5 shadow-xl shadow-orange-500/10">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center relative">
                    <Radar className="w-5 h-5 text-white" />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-800">Радар профилей</h3>
                    <p className="text-xs text-slate-500">Отслеживайте новые видео от авторов</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mb-4">
                  <div className="relative flex-1">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">@</span>
                    <input
                      type="text"
                      value={radarUsername}
                      onChange={(e) => setRadarUsername(e.target.value)}
                      placeholder="username"
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 bg-white/80 outline-none focus:ring-2 focus:ring-orange-500/30 text-sm"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (radarUsername.trim()) {
                        toast.success(`@${radarUsername} добавлен в радар`, {
                          description: 'Вы будете получать уведомления о новых видео',
                        });
                        setRadarUsername('');
                      }
                    }}
                    disabled={!radarUsername.trim()}
                    className={cn(
                      "px-5 py-3 rounded-xl font-medium text-sm transition-all active:scale-95 flex items-center gap-2",
                      "bg-gradient-to-r from-orange-500 to-amber-600 text-white",
                      "hover:from-orange-400 hover:to-amber-500",
                      "disabled:opacity-40 disabled:cursor-not-allowed",
                      "shadow-lg shadow-orange-500/30"
                    )}
                  >
                    <UserPlus className="w-4 h-4" />
                    Добавить
                  </button>
                </div>

                {/* Tracked profiles placeholder */}
                <div className="border-t border-slate-200/50 pt-4">
                  <p className="text-xs text-slate-500 mb-3">Отслеживаемые профили</p>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white/60 border border-slate-200/50">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-pink-500 to-purple-600" />
                      <span className="text-sm text-slate-700">@example_user</span>
                      <button className="text-slate-400 hover:text-red-500 transition-colors">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <button className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-dashed border-slate-300 text-slate-500 hover:border-orange-400 hover:text-orange-500 transition-all text-sm">
                      <Plus className="w-4 h-4" />
                      Добавить
                    </button>
                  </div>
                </div>
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
              {/* Spinning indicator */}
              {isSpinning && (
                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30">
                  <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-lg animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-semibold">Ищем лучшие видео...</span>
                  </div>
                </div>
              )}
              
              {/* 3D Carousel */}
              <div className="relative w-full flex items-center justify-center" style={{ height: '480px' }}>
                {!isSpinning && (
                  <>
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
                  </>
                )}

                <div className={cn(
                  "relative w-full h-full flex items-center justify-center perspective-1000",
                  isSpinning && "pointer-events-none"
                )}>
                  {reels.map((reel, index) => {
                    const offset = index - activeIndex;
                    const absOffset = Math.abs(offset);
                    const isActive = index === activeIndex;
                    const viralCoef = calculateViralCoefficient(reel.view_count, reel.taken_at);
                    const dateText = formatVideoDate(reel.taken_at);
                    
                    if (absOffset > 3) return null;

                    // При спиннинге - более быстрая анимация и размытие
                    const translateX = offset * (isSpinning ? 160 : 190);
                    const translateZ = isActive ? (isSpinning ? 60 : 80) : -absOffset * (isSpinning ? 60 : 80);
                    const rotateY = offset * (isSpinning ? -18 : -12);
                    const scale = isActive ? 1 : Math.max(0.75, 1 - absOffset * 0.12);
                    const opacity = isActive ? 1 : Math.max(0.5, 1 - absOffset * 0.25);

                    const thumbnailUrl = proxyImageUrl(reel.thumbnail_url || reel.display_url);
                    
                    return (
                      <div
                        key={`carousel-${reel.shortcode || reel.id}-${index}`}
                        onClick={() => !isSpinning && (isActive ? setSelectedVideo(reel) : setActiveIndex(index))}
                        draggable={isActive && !isSpinning}
                        onDragStart={(e) => isActive && !isSpinning && handleDragStart(e, reel)}
                        className={cn(
                          'absolute cursor-pointer group',
                          isActive && !isSpinning && 'cursor-grab active:cursor-grabbing z-10',
                          isSpinning ? 'transition-all duration-75 ease-linear' : 'transition-all duration-500 ease-out'
                        )}
                        style={{
                          transform: `translateX(${translateX}px) translateZ(${translateZ}px) rotateY(${rotateY}deg) scale(${scale})`,
                          opacity,
                          zIndex: 10 - absOffset,
                          filter: isSpinning && !isActive ? 'blur(2px)' : 'none',
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
                            
                            {/* Date badge - always show */}
                            <div className="absolute top-3 right-3 z-10">
                              <div className="px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-xs font-semibold shadow-lg">
                                {dateText || '—'}
                              </div>
                            </div>
                              
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
                          onClick={() => handleAddToCanvas(reels[activeIndex], 'ideas')}
                          className="px-3 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white transition-all shadow-lg shadow-orange-500/30 flex items-center gap-1.5 text-sm font-medium"
                        >
                          <Plus className="w-4 h-4" />
                          В Идеи
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
                    <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-sm rounded-2xl p-1.5 shadow-lg border border-white/50">
                      {[
                        { value: 'views', label: 'Просмотры', icon: Eye, color: 'from-blue-500 to-cyan-500' },
                        { value: 'likes', label: 'Лайки', icon: Heart, color: 'from-pink-500 to-rose-500' },
                        { value: 'viral', label: 'Вирал', icon: Sparkles, color: 'from-orange-500 to-amber-500' },
                      ].map(({ value, label, icon: Icon, color }) => (
                        <button
                          key={value}
                          onClick={() => setSortBy(value as SortOption)}
                          className={cn(
                            "flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition-all active:scale-95",
                            sortBy === value 
                              ? `bg-gradient-to-r ${color} text-white shadow-md` 
                              : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                          )}
                        >
                          <Icon className="w-4 h-4" />
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
                    const thumbnailUrl = proxyImageUrl(reel.thumbnail_url || reel.display_url);
                    const cardId = `grid-${reel.shortcode || reel.id}-${idx}`;
                    const dateText = formatVideoDate(reel.taken_at);
                    const isMenuOpen = cardFolderSelect === cardId;
                    
                    return (
                      <VideoGradientCard
                        key={cardId}
                        thumbnailUrl={thumbnailUrl}
                        username={reel.owner?.username || 'instagram'}
                        caption={captionText}
                        viewCount={reel.view_count}
                        likeCount={reel.like_count}
                        date={dateText || '—'}
                        viralCoef={viralCoef}
                        onClick={() => !isMenuOpen && setSelectedVideo(reel)}
                        onDragStart={(e) => handleDragStart(e, reel)}
                        showFolderMenu={isMenuOpen}
                        onFolderMenuToggle={() => setCardFolderSelect(isMenuOpen ? null : cardId)}
                        folderMenu={
                          <div 
                            className="absolute bottom-12 right-0 bg-white rounded-2xl shadow-2xl p-2 min-w-[180px] z-50 animate-in fade-in slide-in-from-bottom-2 duration-200"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Название проекта */}
                            <div className="px-3 py-2 text-xs text-slate-400 font-medium">
                              Добавить в: {currentProjectName}
                            </div>
                            
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
                        }
                      />
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
                      src={proxyImageUrl(selectedVideo.thumbnail_url || selectedVideo.display_url)}
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
                        handleAddToCanvas(selectedVideo, 'ideas');
                        setSelectedVideo(null);
                      }}
                      className="flex-1 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium flex items-center justify-center gap-2 hover:from-orange-400 hover:to-amber-400 transition-all shadow-lg shadow-orange-500/30 active:scale-95"
                    >
                      <Plus className="w-5 h-5" />
                      В Идеи
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
