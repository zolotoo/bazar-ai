import { useState, useEffect, useMemo } from 'react';
import { useWorkspaceZones, ZoneVideo } from '../hooks/useWorkspaceZones';
import { useInboxVideos } from '../hooks/useInboxVideos';
import { useProjectContext, ProjectFolder } from '../contexts/ProjectContext';
import { useActionHistory } from '../hooks/useActionHistory';
import { useProjectSync } from '../hooks/useProjectSync';
import { useProjectPresence } from '../hooks/useProjectPresence';
import { PresenceIndicator } from './ui/PresenceIndicator';
import { Sparkles, Star, FileText, Trash2, ExternalLink, Plus, Inbox, Lightbulb, Camera, Scissors, Check, FolderOpen, Settings, GripVertical, X, Palette, Eye, Heart, ChevronDown, ChevronRight, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../utils/cn';
import { VideoGradientCard } from './ui/VideoGradientCard';
import { VideoDetailPage } from './VideoDetailPage';
import { calculateViralMultiplier, applyViralMultiplierToCoefficient, getProfileStats } from '../services/profileStatsService';


// Проксирование Instagram изображений через наш API
function proxyImageUrl(url?: string): string {
  if (!url) return 'https://via.placeholder.com/270x360';
  if (url.includes('/api/proxy-image') || url.includes('placeholder.com')) return url;
  if (url.includes('cdninstagram.com') || url.includes('instagram.com')) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
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

interface FolderConfig {
  id: string | null;
  title: string;
  color: string;
  iconType: string;
}

// Цвета для папок
const FOLDER_COLORS = [
  '#64748b', '#f97316', '#6366f1', '#10b981', '#f59e0b', 
  '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#84cc16'
];

// Дефолтные папки
const defaultFolderConfigs: FolderConfig[] = [
  { id: 'ideas', title: 'Идеи', color: '#f97316', iconType: 'lightbulb' },
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

export function Workspace() {
  const { loading } = useWorkspaceZones();
  const { videos: inboxVideos, removeVideo: removeInboxVideo, restoreVideo, updateVideoFolder } = useInboxVideos();
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

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-slate-400 text-lg">Загрузка...</div>
      </div>
    );
  }

  // Детальная страница видео
  if (selectedVideo) {
    return (
      <VideoDetailPage
        video={{
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
        }}
        onBack={() => setSelectedVideo(null)}
      />
    );
  }
  
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
    <div className="h-full overflow-hidden relative">
      {/* Floating Folder Widget */}
      <div className={cn(
        "absolute top-4 right-4 z-40 bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border border-white/50 transition-all duration-300",
        "md:top-4 md:right-4",
        "top-safe-top right-safe-right",
        isFolderWidgetOpen ? "w-56 md:w-56" : "w-auto"
      )}>
        {/* Widget Header */}
        <div 
          className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50/50 rounded-t-2xl transition-colors"
          onClick={() => setIsFolderWidgetOpen(!isFolderWidgetOpen)}
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-[#f97316]" strokeWidth={2.5} />
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
          <div className="px-2 pb-3 max-h-[60vh] overflow-y-auto custom-scrollbar-light">
            {/* Все видео (лента) */}
            <button
              onClick={() => setSelectedFolderId(null)}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all text-left mb-1",
                selectedFolderId === null 
                  ? "bg-orange-100 text-orange-700" 
                  : "hover:bg-slate-100 text-slate-600"
              )}
            >
              <div className={cn(
                "w-8 h-8 rounded-lg flex items-center justify-center",
                selectedFolderId === null ? "bg-orange-200" : "bg-slate-100"
              )}>
                <Inbox className="w-4 h-4" style={{ color: selectedFolderId === null ? '#f97316' : '#64748b' }} strokeWidth={2.5} />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium block truncate">Все видео</span>
                <span className="text-xs text-slate-400">{totalVideos} видео</span>
              </div>
            </button>
            
            <div className="h-px bg-slate-100 my-2" />
            
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
                    <span className="text-xs text-slate-400">{count} видео</span>
                  </div>
                </button>
              );
            })}
            
            {/* Settings button */}
            <div className="h-px bg-slate-100 my-2" />
            <button
              onClick={() => setShowFolderSettings(true)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 text-slate-500 text-sm transition-colors"
            >
              <Settings className="w-4 h-4" />
              Настроить папки
            </button>
          </div>
        )}
      </div>

      {/* Main Content - Video Feed */}
      <div className="h-full overflow-y-auto custom-scrollbar-light px-4 safe-left safe-right">
        <div className="max-w-6xl mx-auto py-6 safe-top safe-bottom">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
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
                      <h1 className="text-2xl font-bold text-slate-800">{currentFolderConfig.title}</h1>
                      <p className="text-slate-500 text-sm">{feedVideos.length} видео</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#f97316] via-[#fb923c] to-[#fdba74] flex items-center justify-center shadow-lg shadow-[#f97316]/20 backdrop-blur-sm">
                      <Sparkles className="w-6 h-6 text-white" strokeWidth={2.5} />
                    </div>
                    <div>
                      <h1 className="text-2xl font-bold text-slate-800">Все видео</h1>
                      <p className="text-slate-500 text-sm">{feedVideos.length} видео • отсортировано по виральности</p>
                    </div>
                  </>
                )}
              </div>

              {/* Сортировка и кнопка отмены */}
              <div className="flex items-center gap-2">
                {/* Undo button */}
                {canUndo && (
                  <button
                    onClick={handleUndo}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-all shadow-sm"
                    title="Отменить последнее действие"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Отменить
                  </button>
                )}
                <div className="flex items-center gap-2 bg-white/80 backdrop-blur-sm rounded-2xl p-1.5 shadow-lg border border-white/50 md:mr-72 overflow-x-auto">
                {[
                  { value: 'viral', label: 'Виральность', icon: Sparkles, color: 'from-[#f97316] via-[#fb923c] to-[#fdba74]' },
                  { value: 'views', label: 'Просмотры', icon: Eye, color: 'from-blue-500 to-cyan-500' },
                  { value: 'likes', label: 'Лайки', icon: Heart, color: 'from-pink-500 to-rose-500' },
                  { value: 'recent', label: 'Недавно', icon: Inbox, color: 'from-purple-500 to-indigo-500' },
                ].map(({ value, label, icon: Icon, color }) => (
                  <button
                    key={value}
                    onClick={() => setSortBy(value as typeof sortBy)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold transition-all active:scale-95",
                      sortBy === value 
                        ? `bg-gradient-to-r ${color} text-white shadow-md backdrop-blur-sm` 
                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                    )}
                  >
                    <Icon className="w-4 h-4" strokeWidth={2.5} />
                    {label}
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
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5 pb-6 safe-bottom">
              {feedVideos.map((video, idx) => {
                const thumbnailUrl = proxyImageUrl(video.preview_url);
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
                    onFolderMenuToggle={() => {
                      setCardMenuVideoId(cardMenuVideoId === video.id ? null : video.id);
                      setMoveMenuVideoId(null);
                    }}
                    folderMenu={
                      <div className="bg-white rounded-xl shadow-2xl border border-slate-100 p-1.5 min-w-[140px] animate-in fade-in slide-in-from-top-2 duration-200">
                        <button
                          onClick={(e) => { e.stopPropagation(); setSelectedVideo(video); setCardMenuVideoId(null); }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-orange-50 transition-colors text-left"
                        >
                          <FileText className="w-4 h-4 text-orange-500" />
                          <span className="text-sm text-slate-700">Работать</span>
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
                            <div className="absolute left-full top-0 ml-1 bg-white rounded-lg shadow-xl border border-slate-100 p-1.5 min-w-[140px] z-[110] animate-in fade-in slide-in-from-left-2 duration-150">
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
                );
              })}
            </div>
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
            <div className="p-6 overflow-y-auto max-h-[60vh]">
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
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 outline-none transition-all text-slate-700"
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
      {/* Presence Indicator */}
      <PresenceIndicator presence={presence} getUsername={getUsername} />
    </div>
  );
}
