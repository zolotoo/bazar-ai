import { useState, useEffect, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useWorkspaceZones, ZoneVideo } from '../hooks/useWorkspaceZones';
import { useInboxVideos } from '../hooks/useInboxVideos';
import { useProjectContext, ProjectFolder } from '../contexts/ProjectContext';
import { useActionHistory } from '../hooks/useActionHistory';
import { useProjectSync } from '../hooks/useProjectSync';
import { useProjectPresence } from '../hooks/useProjectPresence';
import { PresenceIndicator } from './ui/PresenceIndicator';
import { Sparkles, Star, FileText, Trash2, ExternalLink, Plus, Inbox, Lightbulb, Camera, Scissors, Check, FolderOpen, Settings, GripVertical, X, Palette, Eye, Heart, ChevronDown, ChevronRight, Undo2, Images, Link2, Loader2, MessageCircle, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../utils/cn';
import { proxyImageUrl } from '../utils/imagePlaceholder';
import { VideoGradientCard } from './ui/VideoGradientCard';
import { VideoDetailPage } from './VideoDetailPage';
import { CarouselDetailPage } from './CarouselDetailPage';
import { useCarousels, type SavedCarousel } from '../hooks/useCarousels';
import { calculateViralMultiplier, applyViralMultiplierToCoefficient, getProfileStats } from '../services/profileStatsService';
import { dialogScale, backdropFade, iosSpringSoft } from '../utils/motionPresets';
import { TokenBadge } from './ui/TokenBadge';
import { getTokenCost } from '../constants/tokenCosts';


function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

// Расчёт коэффициента виральности (K просмотров в день)
function calculateViralCoefficient(views?: number, takenAt?: string | number | Date): number {
  if (!views) return 0;
  
  let videoDate: Date | null = null;
  
  if (takenAt instanceof Date) {
    videoDate = takenAt;
  } else if (typeof takenAt === 'string') {
    if (takenAt.includes('T') || takenAt.includes('-')) {
      videoDate = new Date(takenAt);
    } else {
      const ts = Number(takenAt);
      if (!isNaN(ts)) {
        videoDate = new Date(ts * 1000);
      }
    }
  } else if (typeof takenAt === 'number') {
    videoDate = takenAt > 1e12 ? new Date(takenAt) : new Date(takenAt * 1000);
  }
  
  if (!videoDate || isNaN(videoDate.getTime())) {
    return Math.round((views / 30000) * 10) / 10;
  }
  
  const today = new Date();
  const diffTime = today.getTime() - videoDate.getTime();
  const diffDays = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  
  return Math.round((views / diffDays / 1000) * 10) / 10;
}

// Виральность карусели: likes / (days * 1000)
function calculateCarouselViralCoefficient(likes?: number, takenAt?: number | string | null): number {
  if (!likes || likes < 30000 || takenAt == null) return 0;
  let postDate: Date;
  if (typeof takenAt === 'number') {
    postDate = takenAt > 1e12 ? new Date(takenAt) : new Date(takenAt * 1000);
  } else {
    postDate = new Date(takenAt);
  }
  if (isNaN(postDate.getTime())) return 0;
  const diffDays = Math.floor((Date.now() - postDate.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return 0;
  return Math.round((likes / (diffDays * 1000)) * 100) / 100;
}

interface FolderConfig {
  id: string | null;
  title: string;
  color: string;
  iconType: string;
}

// Цвета для папок
const FOLDER_COLORS = [
  '#64748b', '#94a3b8', '#6366f1', '#10b981', '#94a3b8', 
  '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#84cc16'
];

// Дефолтные папки
const defaultFolderConfigs: FolderConfig[] = [
  { id: 'ideas', title: 'Идеи', color: '#94a3b8', iconType: 'lightbulb' },
  { id: '1', title: 'Ожидает сценария', color: '#6366f1', iconType: 'file' },
  { id: '2', title: 'Ожидает съёмок', color: '#f59e0b', iconType: 'camera' },
  { id: '3', title: 'Ожидает монтажа', color: '#10b981', iconType: 'scissors' },
  { id: '4', title: 'Готовое', color: '#8b5cf6', iconType: 'check' },
  { id: 'rejected', title: 'Не подходит', color: '#ef4444', iconType: 'rejected' },
];

// Иконки маппинг
const getIconComponent = (iconType: string, color: string, size: string = "w-5 h-5") => {
  const style = { color };
  
  switch (iconType) {
    case 'all': return <Inbox className={size} style={style} />;
    case 'lightbulb': return <Lightbulb className={size} style={style} />;
    case 'plus': return <Plus className={size} style={style} />;
    case 'star': return <Star className={size} style={style} />;
    case 'sparkles': return <Sparkles className={size} style={style} />;
    case 'file': return <FileText className={size} style={style} />;
    case 'camera': return <Camera className={size} style={style} />;
    case 'scissors': return <Scissors className={size} style={style} />;
    case 'check': return <Check className={size} style={style} />;
    case 'rejected': return <Trash2 className={size} style={style} />;
    default: return <FolderOpen className={size} style={style} />;
  }
};

interface WorkspaceProps {
  externalFolderPanelOpen?: boolean;
  onExternalFolderPanelClose?: () => void;
}

export function Workspace(props?: WorkspaceProps) {
  const { externalFolderPanelOpen, onExternalFolderPanelClose } = props ?? {};
  const { loading } = useWorkspaceZones();
  const { videos: inboxVideos, removeVideo: removeInboxVideo, restoreVideo, updateVideoFolder, loadMore, hasMore, loadingMore, refetch: refetchInboxVideos, refreshThumbnail, saveThumbnailFromUrl } = useInboxVideos();
  const { 
    currentProject, 
    currentProjectId, 
    addFolder, 
    removeFolder,
    restoreFolder, 
    updateFolder, 
    reorderFolders,
    refetch: refetchProjects,
  } = useProjectContext();
  const { addAction, undoLastAction, canUndo } = useActionHistory();
  const { sendChange } = useProjectSync(currentProjectId);
  const { presence, getUsername } = useProjectPresence(currentProjectId);
  const [selectedVideo, setSelectedVideo] = useState<ZoneVideo | null>(null);
  const [moveMenuVideoId, setMoveMenuVideoId] = useState<string | null>(null);
  const [cardMenuVideoId, setCardMenuVideoId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'viral' | 'views' | 'likes' | 'date' | 'recent'>('viral');
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null); // null = все видео (кроме "не подходит")
  const [showFolderSettings, setShowFolderSettings] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ProjectFolder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [draggedFolderIndex, setDraggedFolderIndex] = useState<number | null>(null);
  const [isFolderWidgetOpen, setIsFolderWidgetOpen] = useState(true);
  const [profileStatsCache, setProfileStatsCache] = useState<Map<string, any>>(new Map());
  // Раздел контента в проекте: рилсы или карусели
  const [contentSection, setContentSection] = useState<'reels' | 'carousels'>('reels');
  const [selectedCarousel, setSelectedCarousel] = useState<SavedCarousel | null>(null);
  const [carouselLinkUrl, setCarouselLinkUrl] = useState('');
  const [isAddingCarouselByLink, setIsAddingCarouselByLink] = useState(false);
  const [descriptionModalText, setDescriptionModalText] = useState<string | null>(null);
  const { carousels, loading: carouselsLoading, addCarousel, refetch: refetchCarousels } = useCarousels();

  // Открытие панели папок с нижнего бара (мобильные)
  useEffect(() => {
    if (externalFolderPanelOpen) {
      setIsFolderWidgetOpen(true);
    }
  }, [externalFolderPanelOpen]);

  const closeFolderPanel = () => {
    setIsFolderWidgetOpen(false);
    onExternalFolderPanelClose?.();
  };
  
  // Преобразуем папки проекта в FolderConfig формат
  const projectFolders: FolderConfig[] = currentProject?.folders
    ?.slice()
    .sort((a, b) => a.order - b.order)
    .filter(f => f.icon !== 'all') // Исключаем системную папку "Все видео"
    .map(f => ({
      id: f.id,
      title: f.name,
      color: f.color,
      iconType: f.icon,
    })) || [];
  
  // Папки для фильтрации
  const folderConfigs: FolderConfig[] = projectFolders.length > 0 ? projectFolders : defaultFolderConfigs;
  
  // ID папки "Не подходит"
  const rejectedFolderId = folderConfigs.find(f => f.iconType === 'rejected')?.id;

  // Перемещение видео в другую папку
  const handleMoveToFolder = async (video: ZoneVideo, targetFolderId: string) => {
    const targetFolder = folderConfigs.find(f => f.id === targetFolderId);
    const oldFolderId = (video as any).folder_id || null;
    
    try {
      const success = await updateVideoFolder(video.id, targetFolderId);
      if (success) {
        // Отправляем изменение для синхронизации
        if (currentProjectId) {
          await sendChange(
            'video_moved',
            'video',
            video.id,
            { folder_id: oldFolderId },
            { folder_id: targetFolderId }
          );
        }
        
        setMoveMenuVideoId(null);
        setCardMenuVideoId(null);
        toast.success(`Перемещено в "${targetFolder?.title || 'папку'}"`);
      } else {
        toast.error('Ошибка перемещения');
      }
    } catch (err) {
      console.error('Ошибка перемещения:', err);
      toast.error('Ошибка перемещения');
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    const video = inboxVideos.find(v => v.id === videoId);
    const videoData = await removeInboxVideo(videoId);
    
    if (videoData) {
      // Отправляем изменение для синхронизации
      if (currentProjectId && video) {
        await sendChange(
          'video_deleted',
          'video',
          videoId,
          { folder_id: (video as any).folder_id },
          null
        );
      }
      
      addAction('delete_video', videoData);
      toast.success('Видео удалено', {
        action: {
          label: 'Отменить',
          onClick: handleUndo,
        },
        duration: 5000,
      });
    }
  };

  const handleUndo = async () => {
    const lastAction = undoLastAction();
    if (!lastAction) return;
    
    if (lastAction.type === 'delete_video') {
      const success = await restoreVideo(lastAction.data);
      if (success) {
        toast.success('Видео восстановлено');
      } else {
        toast.error('Не удалось восстановить видео');
      }
    } else if (lastAction.type === 'delete_folder') {
      const success = await restoreFolder(lastAction.data);
      if (success) {
        toast.success('Папка восстановлена');
        await refetchProjects();
      } else {
        toast.error('Не удалось восстановить папку');
      }
    }
  };

  // Преобразование inbox видео в ZoneVideo формат
  const transformInboxVideo = (v: any, folderId: string | null): ZoneVideo => ({
    id: v.id,
    title: v.title,
    preview_url: v.previewUrl,
    url: v.url,
    zone_id: folderId,
    folder_id: (v as any).folder_id || null,
    position_x: 0,
    position_y: 0,
    view_count: (v as any).view_count,
    like_count: (v as any).like_count,
    comment_count: (v as any).comment_count,
    owner_username: (v as any).owner_username,
    taken_at: (v as any).taken_at,
    created_at: v.receivedAt?.toISOString(),
    transcript_id: (v as any).transcript_id,
    transcript_status: (v as any).transcript_status,
    transcript_text: (v as any).transcript_text,
    translation_text: (v as any).translation_text,
    script_text: (v as any).script_text,
    download_url: (v as any).download_url,
    script_responsible: (v as any).script_responsible,
    editing_responsible: (v as any).editing_responsible,
    draft_link: (v as any).draft_link,
    final_link: (v as any).final_link,
    links: (v as any).links,
    responsibles: (v as any).responsibles,
    status: 'active',
  });

  // Получаем видео для ленты
  const getVideosForFeed = (): ZoneVideo[] => {
    // Если выбрана конкретная папка - фильтруем по ней
    if (selectedFolderId) {
      return inboxVideos
        .filter(v => (v as any).folder_id === selectedFolderId)
        .map(v => transformInboxVideo(v, (v as any).folder_id));
    }
    
    // Иначе показываем только видео БЕЗ папки (folder_id === null)
    // Видео, которые перемещены в папки, не показываются в ленте "Все видео"
    return inboxVideos
      .filter(v => {
        const folderId = (v as any).folder_id;
        return folderId === null || folderId === undefined;
      })
      .map(v => transformInboxVideo(v, (v as any).folder_id));
  };
  
  // Сортировка видео с применением множителя залётности
  const getSortedVideos = (videos: ZoneVideo[]): ZoneVideo[] => {
    return [...videos].sort((a, b) => {
      switch (sortBy) {
        case 'viral':
          const coefA = calculateViralCoefficient(a.view_count, a.taken_at || a.created_at);
          const coefB = calculateViralCoefficient(b.view_count, b.taken_at || b.created_at);
          
          // Получаем статистику профилей для применения множителя
          const profileA = a.owner_username ? profileStatsCache.get(a.owner_username.toLowerCase()) : null;
          const profileB = b.owner_username ? profileStatsCache.get(b.owner_username.toLowerCase()) : null;
          
          const multA = calculateViralMultiplier(a.view_count || 0, profileA);
          const multB = calculateViralMultiplier(b.view_count || 0, profileB);
          
          const finalCoefA = applyViralMultiplierToCoefficient(coefA, multA);
          const finalCoefB = applyViralMultiplierToCoefficient(coefB, multB);
          
          return finalCoefB - finalCoefA;
        case 'views':
          return (b.view_count || 0) - (a.view_count || 0);
        case 'likes':
          return (b.like_count || 0) - (a.like_count || 0);
        case 'date':
          const dateA = a.taken_at || a.created_at || '';
          const dateB = b.taken_at || b.created_at || '';
          return String(dateB).localeCompare(String(dateA));
        case 'recent':
          // По недавно добавленным (по created_at из saved_videos)
          const createdA = a.created_at || '';
          const createdB = b.created_at || '';
          return String(createdB).localeCompare(String(createdA));
        default:
          return 0;
      }
    });
  };
  
  // Получить название папки по ID
  const getFolderName = (folderId: string | null): string => {
    const folder = folderConfigs.find(f => f.id === folderId);
    return folder?.title || 'Без папки';
  };
  
  // Получить цвет папки по ID
  const getFolderColor = (folderId: string | null): string => {
    const folder = folderConfigs.find(f => f.id === folderId);
    return folder?.color || '#94a3b8';
  };
  
  // Подсчёт видео в папке
  const getVideoCountInFolder = (folderId: string | null): number => {
    if (folderId === null) {
      // Все видео кроме "Не подходит"
      return inboxVideos.filter(v => (v as any).folder_id !== rejectedFolderId).length;
    }
    return inboxVideos.filter(v => (v as any).folder_id === folderId).length;
  };

  // ВСЕ ХУКИ ДОЛЖНЫ БЫТЬ ДО УСЛОВНЫХ ВОЗВРАТОВ!
  const videosForFeed = useMemo(() => getVideosForFeed(), [inboxVideos, selectedFolderId, rejectedFolderId]);
  const feedVideos = useMemo(() => {
    return getSortedVideos(videosForFeed);
  }, [videosForFeed, sortBy, profileStatsCache]);
  const totalVideos = inboxVideos.filter(v => (v as any).folder_id !== rejectedFolderId).length;
  
  // Создаем стабильную строку зависимостей для usernames
  const usernamesKey = useMemo(() => {
    const usernames = new Set<string>();
    videosForFeed.forEach(v => {
      if (v.owner_username) {
        usernames.add(v.owner_username.toLowerCase());
      }
    });
    return Array.from(usernames).sort().join(',');
  }, [videosForFeed]);
  
  // Загружаем статистику профилей для видео
  useEffect(() => {
    const loadProfileStats = async () => {
      const usernames = new Set<string>();
      videosForFeed.forEach(v => {
        if (v.owner_username) {
          usernames.add(v.owner_username.toLowerCase());
        }
      });
      
      for (const username of usernames) {
        if (!profileStatsCache.has(username)) {
          const stats = await getProfileStats(username);
          if (stats) {
            setProfileStatsCache(prev => new Map(prev).set(username, stats));
          }
        }
      }
    };
    
    if (videosForFeed.length > 0) {
      loadProfileStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [usernamesKey]);

  // Синхронизация выбранного видео с лентой после обновления данных (только при смене ссылки на объект)
  useEffect(() => {
    if (!selectedVideo) return;
    const updated = feedVideos.find(v => v.id === selectedVideo.id);
    if (updated && updated !== selectedVideo) setSelectedVideo(updated);
  }, [feedVideos, selectedVideo]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-slate-400 text-lg">Загрузка...</div>
      </div>
    );
  }

  const videoDetailProps = selectedVideo ? {
    video: {
      id: selectedVideo.id,
      title: selectedVideo.title,
      preview_url: selectedVideo.preview_url,
      url: selectedVideo.url,
      view_count: selectedVideo.view_count,
      like_count: selectedVideo.like_count,
      comment_count: selectedVideo.comment_count,
      owner_username: selectedVideo.owner_username,
      taken_at: selectedVideo.taken_at,
      transcript_id: (selectedVideo as any).transcript_id,
      transcript_status: (selectedVideo as any).transcript_status,
      transcript_text: (selectedVideo as any).transcript_text,
      translation_text: (selectedVideo as any).translation_text,
      script_text: (selectedVideo as any).script_text,
      download_url: (selectedVideo as any).download_url,
      folder_id: selectedVideo.folder_id,
      script_responsible: (selectedVideo as any).script_responsible,
      editing_responsible: (selectedVideo as any).editing_responsible,
      draft_link: (selectedVideo as any).draft_link,
      final_link: (selectedVideo as any).final_link,
      links: (selectedVideo as any).links,
      responsibles: (selectedVideo as any).responsibles,
    },
    onBack: () => setSelectedVideo(null),
    onRefreshData: async () => { await refetchInboxVideos(); },
  } : null;

  // Обработчик создания папки
  const handleCreateFolder = async () => {
    if (!currentProjectId || !newFolderName.trim()) return;
    const folderName = newFolderName.trim();
    await addFolder(currentProjectId, folderName);
    setNewFolderName('');
    await refetchProjects();
    
    // Отправляем изменение для синхронизации после обновления проектов
    if (currentProjectId) {
      const updatedProject = currentProject;
      const newFolder = updatedProject?.folders?.find(f => f.name === folderName);
      if (newFolder) {
        await sendChange(
          'folder_created',
          'folder',
          newFolder.id,
          null,
          { name: newFolder.name, color: newFolder.color, icon: newFolder.icon, order: newFolder.order }
        );
      }
    }
    
    toast.success('Папка создана');
  };
  
  // Обработчик удаления папки
  const handleDeleteFolder = async (folderId: string) => {
    if (!currentProjectId) return;
    const folderData = await removeFolder(currentProjectId, folderId);
    
    if (folderData) {
      // Отправляем изменение для синхронизации
      if (currentProjectId) {
        await sendChange(
          'folder_deleted',
          'folder',
          folderId,
          { name: folderData.name, color: folderData.color, icon: folderData.icon },
          null
        );
      }
      
      addAction('delete_folder', folderData);
      toast.success('Папка удалена', {
        action: {
          label: 'Отменить',
          onClick: handleUndo,
        },
        duration: 5000,
      });
    }
  };
  
  // Обработчик обновления папки
  const handleUpdateFolder = async (folderId: string, updates: Partial<Omit<ProjectFolder, 'id'>>) => {
    if (!currentProjectId) return;
    const folder = currentProject?.folders?.find(f => f.id === folderId);
    const oldData = folder ? { name: folder.name, color: folder.color, icon: folder.icon } : null;
    
    await updateFolder(currentProjectId, folderId, updates);
    
    // Отправляем изменение для синхронизации
    if (currentProjectId && oldData) {
      const changeType = updates.name ? 'folder_renamed' : 'project_updated';
      await sendChange(
        changeType,
        'folder',
        folderId,
        oldData,
        { ...oldData, ...updates }
      );
    }
    
    setEditingFolder(null);
  };
  
  // Drag & drop для перестановки папок
  const handleFolderDragStart = (index: number) => {
    setDraggedFolderIndex(index);
  };
  
  const handleFolderDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedFolderIndex === null || draggedFolderIndex === index) return;
  };
  
  const handleFolderDrop = async (targetIndex: number) => {
    if (!currentProjectId || draggedFolderIndex === null) return;
    
    const projectFoldersList = currentProject?.folders?.slice().sort((a, b) => a.order - b.order) || [];
    if (draggedFolderIndex === targetIndex) {
      setDraggedFolderIndex(null);
      return;
    }
    
    const newOrder = [...projectFoldersList];
    const [moved] = newOrder.splice(draggedFolderIndex, 1);
    newOrder.splice(targetIndex, 0, moved);
    
    await reorderFolders(currentProjectId, newOrder.map(f => f.id));
    setDraggedFolderIndex(null);
    toast.success('Порядок папок изменён');
  };

  // Текущая выбранная папка для заголовка
  const currentFolderConfig = selectedFolderId 
    ? folderConfigs.find(f => f.id === selectedFolderId) 
    : null;

  return (
    <>
      <AnimatePresence>
        {selectedCarousel && (
          <motion.div
            key="carousel-detail-overlay"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={backdropFade}
          >
            <div className="absolute inset-0 bg-black/25 backdrop-blur-glass-2xl" onClick={() => setSelectedCarousel(null)} aria-hidden />
            <motion.div
              className="relative w-full max-w-[95vw] md:max-w-6xl h-[90vh] max-h-[900px] rounded-card-2xl overflow-hidden shadow-float-lg bg-base-alt border border-white/[0.35]"
              variants={dialogScale}
              transition={iosSpringSoft}
              onClick={e => e.stopPropagation()}
            >
              <CarouselDetailPage
                carousel={selectedCarousel}
                onBack={() => setSelectedCarousel(null)}
                onRefreshData={refetchCarousels}
              />
            </motion.div>
          </motion.div>
        )}
        {selectedVideo && videoDetailProps && (
          <motion.div
            key="video-detail-overlay"
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-6"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={backdropFade}
          >
            <div
              className="absolute inset-0 bg-black/25 backdrop-blur-glass-2xl"
              onClick={() => setSelectedVideo(null)}
              aria-hidden
            />
            <motion.div
              className="relative w-full max-w-[95vw] md:max-w-6xl h-[90vh] max-h-[900px] rounded-card-2xl overflow-hidden shadow-float-lg bg-base-alt border border-white/[0.35]"
              variants={dialogScale}
              transition={iosSpringSoft}
              onClick={e => e.stopPropagation()}
            >
              <VideoDetailPage
                video={videoDetailProps.video}
                onBack={() => setSelectedVideo(null)}
                onRefreshData={videoDetailProps.onRefreshData}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="h-full overflow-hidden relative flex flex-col">
      {/* Floating Folder Widget - Desktop */}
      <div className={cn(
        "hidden md:block absolute top-4 right-4 z-40 bg-glass-white/80 backdrop-blur-glass-xl rounded-card-xl shadow-glass border border-white/[0.35] transition-all duration-300",
        isFolderWidgetOpen ? "w-56" : "w-auto"
      )}>
        {/* Widget Header */}
          <div 
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-white/[0.08] rounded-t-card-xl transition-colors"
          onClick={() => setIsFolderWidgetOpen(!isFolderWidgetOpen)}
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-slate-600" strokeWidth={2.5} />
            <span className="text-sm font-semibold text-slate-700">Папки</span>
          </div>
          {isFolderWidgetOpen ? (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronRight className="w-4 h-4 text-slate-400" />
          )}
        </div>
        
        {/* Widget Content */}
        {isFolderWidgetOpen && (
          <div className="px-2 pb-3">
            {/* Все видео (лента) */}
            <button
              onClick={() => setSelectedFolderId(null)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-card transition-all text-left mb-2",
                selectedFolderId === null 
                  ? "bg-slate-200/40 text-slate-800 shadow-glass-sm" 
                  : "hover:bg-glass-white/60 text-slate-600"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                selectedFolderId === null ? "bg-slate-200/30" : "bg-slate-100/80"
              )}>
                <Inbox className="w-4 h-4" style={{ color: selectedFolderId === null ? '#64748b' : '#64748b' }} strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium block truncate">Все видео</span>
                <span className="text-xs text-slate-400 tabular-nums">{totalVideos} видео</span>
              </div>
            </button>
            
            <div className="my-3" aria-hidden />
            
            {/* Папки */}
            {folderConfigs.map(folder => {
              const count = getVideoCountInFolder(folder.id);
              const isSelected = selectedFolderId === folder.id;
              const isRejected = folder.iconType === 'rejected';
              
              return (
                <button
                  key={folder.id}
                  onClick={() => setSelectedFolderId(folder.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all text-left",
                    isSelected 
                      ? "bg-slate-100" 
                      : "hover:bg-slate-50 text-slate-600",
                    isRejected && "opacity-70"
                  )}
                >
                  <div 
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: `${folder.color}20` }}
                  >
                    {getIconComponent(folder.iconType, folder.color, "w-4 h-4")}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className={cn(
                      "text-sm font-medium block truncate",
                      isSelected && "text-slate-800"
                    )}>{folder.title}</span>
                    <span className="text-xs text-slate-400 tabular-nums">{count} видео</span>
                  </div>
                </button>
              );
            })}
            
            {/* Settings button */}
            <div className="my-3" aria-hidden />
            <button
              onClick={() => setShowFolderSettings(true)}
              className="w-full flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-xl hover:bg-slate-50 active:bg-slate-100 text-slate-500 text-sm transition-colors touch-manipulation"
            >
              <Settings className="w-4 h-4" />
              Настроить папки
            </button>
          </div>
        )}
      </div>

      {/* Панель Папки на мобильных — плавное появление */}
      <AnimatePresence>
        {isFolderWidgetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="md:hidden fixed inset-0 z-[200] bg-black/30 backdrop-blur-sm touch-manipulation safe-top safe-bottom safe-left safe-right"
              onClick={closeFolderPanel}
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={cn(
                "md:hidden fixed inset-0 z-[201] flex flex-col",
                "bg-white/60 backdrop-blur-3xl",
                "safe-top safe-bottom safe-left safe-right overflow-hidden"
              )}
            >
            <div className="flex items-center justify-between px-4 pt-4 pb-3 shrink-0 safe-top">
              <span className="text-[15px] font-semibold text-slate-700">Папки</span>
              <button
                onClick={closeFolderPanel}
                className="p-2.5 -m-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/50 backdrop-blur-sm text-slate-500 active:bg-white/70 transition-colors touch-manipulation border border-white/60"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-6 safe-bottom">
              {/* Сетка карточек как Invoices/Figma — 2 колонки, полупрозрачные карточки */}
              <div className="grid grid-cols-2 gap-3">
                {/* Карточка «Все видео» */}
                <button
                  onClick={() => { setSelectedFolderId(null); closeFolderPanel(); }}
                  className={cn(
                    "flex flex-col items-center rounded-2xl p-4 min-h-[120px] transition-all active:scale-[0.97] touch-manipulation",
                    "bg-white/50 backdrop-blur-md border border-white/60",
                    "shadow-[0_2px_12px_rgba(0,0,0,0.06)]",
                    selectedFolderId === null && "ring-2 ring-slate-300/40 bg-white/70"
                  )}
                >
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center mb-2 flex-shrink-0",
                    selectedFolderId === null ? "bg-slate-200/40" : "bg-slate-100/80"
                  )}>
                    <Inbox className="w-6 h-6" style={{ color: selectedFolderId === null ? '#64748b' : '#64748b' }} strokeWidth={2.5} />
                  </div>
                  <span className={cn("text-sm font-semibold truncate w-full text-center", selectedFolderId === null ? "text-slate-700" : "text-slate-700")}>Все видео</span>
                  <span className="text-xs text-slate-400 mt-0.5">{totalVideos}</span>
                </button>

                {folderConfigs.map(folder => {
                  const count = getVideoCountInFolder(folder.id);
                  const isSelected = selectedFolderId === folder.id;
                  const isRejected = folder.iconType === 'rejected';
                  return (
                    <button
                      key={folder.id}
                      onClick={() => { setSelectedFolderId(folder.id); closeFolderPanel(); }}
                      className={cn(
                        "flex flex-col items-center rounded-2xl p-4 min-h-[120px] transition-all active:scale-[0.97] touch-manipulation",
                        "bg-white/50 backdrop-blur-md border border-white/60",
                        "shadow-[0_2px_12px_rgba(0,0,0,0.06)]",
                        isSelected && "ring-2 ring-slate-300/50 bg-white/70",
                        isRejected && "opacity-70"
                      )}
                    >
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-2 flex-shrink-0"
                        style={{ backgroundColor: `${folder.color}22` }}
                      >
                        {getIconComponent(folder.iconType, folder.color, "w-6 h-6")}
                      </div>
                      <span className={cn("text-sm font-semibold truncate w-full text-center", isSelected && "text-slate-800")}>{folder.title}</span>
                      <span className="text-xs text-slate-400 mt-0.5">{count}</span>
                    </button>
                  );
                })}

                {/* Карточка «Настроить папки» — на всю ширину */}
                <button
                  onClick={() => { setShowFolderSettings(true); closeFolderPanel(); }}
                  className={cn(
                    "col-span-2 flex items-center justify-center gap-2 rounded-2xl py-3 px-4 mt-1 transition-all active:scale-[0.99] touch-manipulation",
                    "bg-white/40 backdrop-blur-md border border-white/50 text-slate-500",
                    "hover:bg-white/50 active:bg-white/60"
                  )}
                >
                  <Settings className="w-5 h-5" strokeWidth={2.5} />
                  <span className="text-sm font-medium">Настроить папки</span>
                </button>
              </div>
            </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Кнопка «Папки» на мобильных убрана — открытие только через нижний таб-бар */}

      {/* Main Content - Video Feed or Carousels */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 md:px-6 safe-left safe-right custom-scrollbar-light" style={{ maxHeight: '100%' }}>
        <div className="max-w-6xl mx-auto py-5 md:py-8 safe-top safe-bottom">
          {/* Tabs: Рилсы | Карусели (в каждом проекте два раздела) */}
          <div className="flex gap-1.5 p-1.5 mb-4 md:mb-6 rounded-card-xl bg-glass-white/60 backdrop-blur-glass border border-white/[0.35] w-fit">
            <button
              onClick={() => setContentSection('reels')}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all touch-manipulation',
                contentSection === 'reels'
                  ? 'bg-slate-200/50 text-slate-800 shadow-glass-sm'
                  : 'text-slate-600 hover:bg-white/50 hover:text-slate-800'
              )}
            >
              <Sparkles className="w-4 h-4" strokeWidth={2.5} />
              Рилсы
              <span className="tabular-nums text-slate-500">{totalVideos}</span>
            </button>
            <button
              onClick={() => setContentSection('carousels')}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all touch-manipulation',
                contentSection === 'carousels'
                  ? 'bg-slate-200/50 text-slate-800 shadow-glass-sm'
                  : 'text-slate-600 hover:bg-white/50 hover:text-slate-800'
              )}
            >
              <Images className="w-4 h-4" strokeWidth={2.5} />
              Карусели
              <span className="tabular-nums text-slate-500">{carousels.length}</span>
            </button>
          </div>

          {/* Рилсы: текущая лента */}
          {contentSection === 'reels' && (
          <>
          {/* Header — glass bar */}
          <div className="mb-6 md:mb-8 rounded-card-xl bg-glass-white/80 backdrop-blur-glass-xl shadow-glass border border-white/[0.35] px-5 py-4 md:px-6 md:py-5">
            <div className="flex items-start md:items-center justify-between flex-wrap gap-4 md:gap-5">
              <div className="flex items-center gap-3">
                {currentFolderConfig ? (
                  <>
                    <div 
                      className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ backgroundColor: currentFolderConfig.color }}
                    >
                      {getIconComponent(currentFolderConfig.iconType, '#ffffff', "w-6 h-6")}
                    </div>
                    <div>
                      <h1 className="text-xl md:text-2xl font-bold text-slate-800">{currentFolderConfig.title}</h1>
                      <p className="text-slate-500 text-xs md:text-sm tabular-nums">{feedVideos.length} видео</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-card-xl bg-slate-200/40 flex items-center justify-center shadow-glass-sm">
                      <Sparkles className="w-6 h-6 text-slate-700" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h1 className="text-xl md:text-2xl font-bold text-slate-800">Все видео</h1>
                      <p className="text-slate-500 text-xs md:text-sm tabular-nums">{feedVideos.length} видео • отсортировала по виральности</p>
                    </div>
                  </>
                )}
              </div>

              {/* Сортировка и кнопка отмены */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Undo button */}
                {canUndo && (
                  <button
                    onClick={handleUndo}
                    className="flex items-center gap-2 px-3 py-1.5 min-h-[44px] rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 text-xs font-medium transition-all shadow-sm touch-manipulation"
                    title="Отменить последнее действие"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Отменить</span>
                  </button>
                )}
                <div className="flex items-center gap-1.5 md:gap-2 bg-glass-white/60 backdrop-blur-glass rounded-pill p-1.5 md:p-2 shadow-glass-sm border border-white/[0.35] overflow-x-auto flex-1 min-w-0">
                {[
                  { value: 'viral', label: 'Виральность', icon: Sparkles },
                  { value: 'views', label: 'Просмотры', icon: Eye },
                  { value: 'likes', label: 'Лайки', icon: Heart },
                  { value: 'recent', label: 'Недавно', icon: Inbox },
                ].map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => setSortBy(value as typeof sortBy)}
                    className={cn(
                      "flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-2 min-h-[44px] rounded-pill text-[10px] md:text-xs font-semibold transition-all active:scale-95 touch-manipulation whitespace-nowrap",
                      sortBy === value 
                        ? "bg-slate-200/50 text-slate-800 shadow-glass-sm border border-slate-300/40" 
                        : "text-slate-600 hover:text-slate-800 hover:bg-glass-white/60"
                    )}
                  >
                    <Icon className="w-3.5 h-3.5 md:w-4 md:h-4 flex-shrink-0" strokeWidth={2.5} />
                    <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
                </div>
              </div>
            </div>
          </div>

          {/* Videos Grid */}
          {feedVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                <Inbox className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-lg font-medium text-slate-800 mb-1">
                {selectedFolderId ? 'Папка пуста' : 'Нет видео'}
              </h3>
              <p className="text-slate-500 text-sm">
                {selectedFolderId ? 'Перетащите видео сюда' : 'Добавьте видео через поиск или радар'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-5 pb-20 md:pb-6 safe-bottom">
              {feedVideos.map((video, idx) => {
                const thumbnailUrl = video.preview_url;
                const viralCoef = calculateViralCoefficient(video.view_count, video.taken_at || video.created_at);
                
                // Получаем статистику профиля для расчёта множителя
                const profileStats = video.owner_username 
                  ? profileStatsCache.get(video.owner_username.toLowerCase()) 
                  : null;
                const viralMult = calculateViralMultiplier(video.view_count || 0, profileStats);
                const finalViralCoef = applyViralMultiplierToCoefficient(viralCoef, viralMult);
                
                // Бейдж папки - показываем если не выбрана конкретная папка
                const folderBadge = !selectedFolderId ? {
                  name: video.folder_id ? getFolderName(video.folder_id) : 'Без папки',
                  color: video.folder_id ? getFolderColor(video.folder_id) : '#94a3b8'
                } : undefined;
                
                return (
                  <div key={`wrap-${video.id}-${idx}`} className={cn("relative", cardMenuVideoId === video.id && "z-[60]")}>
                  <VideoGradientCard
                    key={`feed-${video.id}-${idx}`}
                    thumbnailUrl={thumbnailUrl}
                    username={video.owner_username || 'instagram'}
                    caption={video.title}
                    viewCount={video.view_count}
                    likeCount={video.like_count}
                    commentCount={video.comment_count}
                    viralCoef={finalViralCoef}
                    viralMultiplier={viralMult}
                    folderBadge={folderBadge}
                    transcriptStatus={video.transcript_status}
                    onClick={() => setSelectedVideo(video)}
                    showFolderMenu={cardMenuVideoId === video.id}
                    videoId={!String(video.id).startsWith('local-') ? video.id : undefined}
                    shortcode={video.url?.match(/(?:reel|p)\/([A-Za-z0-9_-]+)/)?.[1]}
                    onThumbnailError={refreshThumbnail}
                    onThumbnailLoad={saveThumbnailFromUrl}
                    onFolderMenuToggle={() => {
                      setCardMenuVideoId(cardMenuVideoId === video.id ? null : video.id);
                      setMoveMenuVideoId(null);
                    }}
                    folderMenu={
                      <div className="bg-glass-white/90 backdrop-blur-glass-xl rounded-card-xl shadow-glass border border-white/[0.35] p-1.5 min-w-[140px] animate-in fade-in slide-in-from-top-2 duration-200">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedVideo(video); setCardMenuVideoId(null); }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100/60 transition-colors text-left"
                        >
                          <FileText className="w-4 h-4 text-slate-600" />
                          <span className="text-sm text-slate-700">Работать</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDescriptionModalText(video.title || 'Нет описания');
                            setCardMenuVideoId(null);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-slate-100/60 transition-colors text-left"
                        >
                          <BookOpen className="w-4 h-4 text-slate-600" />
                          <span className="text-sm text-slate-700">Описание</span>
                        </button>
                        
                        {/* Переместить в папку */}
                        <div className="relative">
                          <button
                            onClick={(e) => { 
                              e.stopPropagation(); 
                              setMoveMenuVideoId(moveMenuVideoId === video.id ? null : video.id);
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-indigo-50 transition-colors text-left"
                          >
                            <FolderOpen className="w-4 h-4 text-indigo-500" />
                            <span className="text-sm text-slate-700">Переместить</span>
                          </button>
                          
                          {/* Подменю с папками */}
                          {moveMenuVideoId === video.id && (
                            <div className="absolute left-full top-0 ml-1 bg-glass-white/90 backdrop-blur-glass-xl rounded-card shadow-glass border border-white/[0.35] p-1.5 min-w-[140px] z-[110] animate-in fade-in slide-in-from-left-2 duration-150">
                              {folderConfigs.map(folder => (
                                <button
                                  key={folder.id}
                                  onClick={(e) => { 
                                    e.stopPropagation(); 
                                    handleMoveToFolder(video, folder.id || 'inbox');
                                    setCardMenuVideoId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md hover:bg-slate-50 transition-colors text-left"
                                >
                                  <div 
                                    className="w-4 h-4 rounded flex items-center justify-center"
                                    style={{ backgroundColor: `${folder.color}20` }}
                                  >
                                    {getIconComponent(folder.iconType, folder.color, "w-2.5 h-2.5")}
                                  </div>
                                  <span className="text-xs text-slate-600">{folder.title}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <a
                          href={video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-blue-50 transition-colors text-left"
                        >
                          <ExternalLink className="w-4 h-4 text-blue-500" />
                          <span className="text-sm text-slate-700">Открыть</span>
                        </a>
                        
                        <div className="h-px bg-slate-100 my-1" />
                        
                        <button
                          onClick={(e) => { 
                            e.stopPropagation(); 
                            handleDeleteVideo(video.id); 
                            setCardMenuVideoId(null);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-red-50 transition-colors text-left"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                          <span className="text-sm text-red-600">Удалить</span>
                        </button>
                      </div>
                    }
                  />
                  </div>
                );
              })}
            </div>
          )}
          {feedVideos.length > 0 && hasMore && (
            <div className="flex justify-center py-6 pb-20 md:pb-6">
              <button
                type="button"
                onClick={() => loadMore()}
                disabled={loadingMore}
                className="px-5 py-2.5 rounded-xl bg-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-300 disabled:opacity-60 flex items-center gap-2 transition-colors"
              >
                {loadingMore ? (
                  <>
                    <span className="animate-pulse">Загрузка...</span>
                  </>
                ) : (
                  'Загрузить ещё видео'
                )}
              </button>
            </div>
          )}
          </>
          )}

          {/* Карусели: список + добавление по ссылке */}
          {contentSection === 'carousels' && (
            <>
              <div className="mb-6 md:mb-8 rounded-card-xl bg-glass-white/80 backdrop-blur-glass-xl shadow-glass border border-white/[0.35] px-5 py-4 md:px-6 md:py-5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-200/40 flex items-center justify-center">
                      <Images className="w-6 h-6 text-slate-600" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h1 className="text-xl md:text-2xl font-bold text-slate-800">Карусели</h1>
                      <p className="text-slate-500 text-xs md:text-sm">Посты с несколькими фото — транскрипт по слайдам (Gemini)</p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <div className="flex gap-2 flex-1 sm:min-w-[280px]">
                      <input
                        type="url"
                        value={carouselLinkUrl}
                        onChange={e => setCarouselLinkUrl(e.target.value)}
                        placeholder="Ссылка на пост с каруселью (instagram.com/p/...)"
                        className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border border-slate-200/80 bg-white/80 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-200 focus:border-violet-300"
                      />
                      <button
                        onClick={async () => {
                          const url = carouselLinkUrl.trim();
                          if (!url || !url.includes('instagram.com')) {
                            toast.error('Вставьте ссылку на пост Instagram');
                            return;
                          }
                          setIsAddingCarouselByLink(true);
                          try {
                            const res = await fetch('/api/reel-info', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ url }),
                            });
                            const data = await res.json();
                            if (data.success && data.is_carousel && Array.isArray(data.carousel_slides) && data.carousel_slides.length > 0) {
                              const added = await addCarousel({
                                shortcode: data.shortcode,
                                url: data.url,
                                caption: data.caption,
                                owner_username: data.owner?.username,
                                like_count: data.like_count,
                                comment_count: data.comment_count,
                                taken_at: data.taken_at,
                                slide_count: data.slide_count ?? data.carousel_slides.length,
                                thumbnail_url: data.thumbnail_url ?? data.carousel_slides[0],
                                slide_urls: data.carousel_slides,
                              });
                              if (added) {
                                setCarouselLinkUrl('');
                                toast.success('Карусель добавлена');
                              }
                            } else if (data.success && !data.is_carousel) {
                              toast.error('Это не карусель — один пост. Добавляйте посты с несколькими фото.');
                            } else {
                              toast.error(data.error || 'Не удалось загрузить пост. Проверьте ссылку.');
                            }
                          } catch (e) {
                            toast.error('Ошибка при добавлении карусели');
                          } finally {
                            setIsAddingCarouselByLink(false);
                          }
                        }}
                        disabled={isAddingCarouselByLink || !carouselLinkUrl.trim()}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-500 hover:bg-violet-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-medium transition-colors shrink-0"
                      >
                        {isAddingCarouselByLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                        Добавить
                        <TokenBadge tokens={getTokenCost('add_carousel')} />
                      </button>
                    </div>
                  </div>
                </div>
                {carouselsLoading ? (
                  <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-10 h-10 text-slate-300 animate-spin" />
                  </div>
                ) : carousels.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-center">
                    <div className="w-20 h-20 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                      <Images className="w-10 h-10 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-800 mb-1">Пока каруселей нет</h3>
                    <p className="text-slate-500 text-sm max-w-sm mb-4">
                      Вставьте ссылку на пост с каруселью (несколько фото) выше и нажмите «Добавить». Транскрипт по слайдам — через Gemini.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4 pb-20 md:pb-6">
                    {carousels.map(c => (
                      <div
                        key={c.id}
                        className="group rounded-2xl overflow-hidden bg-white/80 border border-slate-200/80 shadow-sm hover:shadow-lg hover:border-violet-200/80 transition-all relative"
                      >
                        <button
                          onClick={() => setSelectedCarousel(c)}
                          className="w-full text-left"
                        >
                          <div className="aspect-[4/3] min-h-[120px] relative bg-slate-100">
                            <img
                              src={proxyImageUrl(c.thumbnail_url || c.slide_urls?.[0] || undefined)}
                              alt=""
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium flex items-center gap-0.5">
                              <Images className="w-2.5 h-2.5" />
                              {c.slide_count || 0}
                            </div>
                            {c.transcript_status === 'completed' && (
                              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded-md bg-emerald-500/90 text-white text-[10px] font-medium">
                                Транскрипт
                              </div>
                            )}
                            <button
                                onClick={e => {
                                  e.stopPropagation();
                                  setDescriptionModalText(c.caption || 'Нет описания');
                                }}
                                className="absolute top-1.5 right-1.5 p-1.5 rounded-md bg-black/50 hover:bg-black/70 text-white transition-colors"
                                title="Описание"
                              >
                                <BookOpen className="w-3.5 h-3.5" strokeWidth={2} />
                              </button>
                          </div>
                          <div className="px-2 py-1.5">
                            <p className="text-xs font-medium text-slate-800 truncate">{c.caption?.slice(0, 50) || 'Без подписи'}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-500">
                            <span className="flex items-center gap-0.5">
                              <Heart className="w-2.5 h-2.5" />
                              {formatNumber(c.like_count)}
                            </span>
                            <span className="flex items-center gap-0.5">
                              <MessageCircle className="w-2.5 h-2.5" />
                              {formatNumber(c.comment_count)}
                            </span>
                            {calculateCarouselViralCoefficient(c.like_count, c.taken_at) > 0 && (
                              <span className="flex items-center gap-0.5">
                                <Sparkles className="w-2.5 h-2.5" />
                                {calculateCarouselViralCoefficient(c.like_count, c.taken_at).toFixed(1)}
                              </span>
                            )}
                          </div>
                        </div>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Folder Settings Modal */}
      {showFolderSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end md:items-center justify-center z-50 p-0 md:p-4 safe-top safe-bottom safe-left safe-right">
          <div className="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] md:max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200 safe-bottom">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <h2 className="text-xl font-semibold text-slate-800">Настройка папок</h2>
              <button
                onClick={() => {
                  setShowFolderSettings(false);
                  setEditingFolder(null);
                }}
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            
            {/* Content */}
            <div className="p-6">
              {/* Add new folder */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-slate-600 mb-2">
                  Создать новую папку
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Название папки..."
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200/50 outline-none transition-all text-slate-700"
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                  />
                  <button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim()}
                    className="px-4 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-slate-200 text-white disabled:text-slate-400 font-medium transition-colors"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>
              
              {/* Folder list */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-600 mb-3">
                  Папки проекта (перетащите для изменения порядка)
                </label>
                
                {(currentProject?.folders?.slice().sort((a, b) => a.order - b.order) || []).map((folder, index) => (
                  <div
                    key={folder.id}
                    draggable
                    onDragStart={() => handleFolderDragStart(index)}
                    onDragOver={(e) => handleFolderDragOver(e, index)}
                    onDrop={() => handleFolderDrop(index)}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50 cursor-move transition-all",
                      draggedFolderIndex === index && "opacity-50 scale-95"
                    )}
                  >
                    <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />
                    
                    <div
                      className="w-4 h-4 rounded flex-shrink-0"
                      style={{ backgroundColor: folder.color }}
                    />
                    
                    {editingFolder?.id === folder.id ? (
                      <input
                        type="text"
                        value={editingFolder.name}
                        onChange={(e) => setEditingFolder({ ...editingFolder, name: e.target.value })}
                        className="flex-1 px-2 py-1 rounded-lg border border-slate-200 text-sm outline-none focus:border-orange-400"
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateFolder(folder.id, { name: editingFolder.name });
                          if (e.key === 'Escape') setEditingFolder(null);
                        }}
                      />
                    ) : (
                      <span className="flex-1 text-sm font-medium text-slate-700">{folder.name}</span>
                    )}
                    
                    <div className="flex items-center gap-1">
                      {/* Color picker */}
                      <div className="relative group">
                        <button className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                          <Palette className="w-4 h-4 text-slate-400" strokeWidth={2.5} />
                        </button>
                        <div className="absolute right-0 top-full mt-1 p-2 bg-white rounded-xl shadow-xl border border-slate-100 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 grid grid-cols-5 gap-1">
                          {FOLDER_COLORS.map(color => (
                            <button
                              key={color}
                              onClick={() => handleUpdateFolder(folder.id, { color })}
                              className={cn(
                                "w-6 h-6 rounded-lg transition-transform hover:scale-110",
                                folder.color === color && "ring-2 ring-offset-1 ring-slate-400"
                              )}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>
                      
                      {/* Edit name */}
                      <button
                        onClick={() => setEditingFolder(folder)}
                        className="p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        <FileText className="w-4 h-4 text-slate-400" />
                      </button>
                      
                      {/* Delete */}
                      <button
                        onClick={() => handleDeleteFolder(folder.id)}
                        className="p-1.5 rounded-lg hover:bg-red-100 transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </div>
                ))}
                
                {(!currentProject?.folders || currentProject.folders.length === 0) && (
                  <div className="text-center py-8 text-slate-400">
                    Нет папок. Создайте первую папку выше.
                  </div>
                )}
              </div>
            </div>
            
            {/* Footer */}
            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <button
                onClick={() => {
                  setShowFolderSettings(false);
                  setEditingFolder(null);
                }}
                className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-medium transition-colors"
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Description Modal */}
      {descriptionModalText !== null && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setDescriptionModalText(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-slate-600" />
                Описание
              </h3>
              <button
                onClick={() => setDescriptionModalText(null)}
                className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[60vh]">
              <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap break-words">
                {descriptionModalText}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Presence Indicator */}
      <PresenceIndicator presence={presence} getUsername={getUsername} />
    </div>
    </>
  );
}
