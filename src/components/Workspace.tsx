import { useState } from 'react';
import { useWorkspaceZones, ZoneVideo } from '../hooks/useWorkspaceZones';
import { useInboxVideos } from '../hooks/useInboxVideos';
import { useProjectContext, ProjectFolder } from '../contexts/ProjectContext';
import { Sparkles, Star, FileText, Trash2, ExternalLink, ChevronLeft, Plus, Inbox, Lightbulb, Camera, Scissors, Check, FolderOpen, ArrowDownUp, Settings, GripVertical, X, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../utils/cn';
import { AnimatedFolder3D, FolderVideo } from './ui/Folder3D';
import { VideoGradientCard } from './ui/VideoGradientCard';
import { VideoDetailPage } from './VideoDetailPage';
import { GlowingEffect } from './ui/GlowingEffect';


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
    // ISO формат или timestamp строкой
    if (takenAt.includes('T') || takenAt.includes('-')) {
      videoDate = new Date(takenAt);
    } else {
      // Unix timestamp в секундах
      const ts = Number(takenAt);
      if (!isNaN(ts)) {
        videoDate = new Date(ts * 1000);
      }
    }
  } else if (typeof takenAt === 'number') {
    // Если > 1e12 - это миллисекунды, иначе секунды
    videoDate = takenAt > 1e12 ? new Date(takenAt) : new Date(takenAt * 1000);
  }
  
  // Если нет даты - используем 30 дней по умолчанию
  if (!videoDate || isNaN(videoDate.getTime())) {
    return Math.round((views / 30000) * 10) / 10; // K/день при 30 днях
  }
  
  const today = new Date();
  const diffTime = today.getTime() - videoDate.getTime();
  const diffDays = Math.max(1, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  
  // Возвращаем K просмотров в день (views / days / 1000)
  return Math.round((views / diffDays / 1000) * 10) / 10;
}

// Конвертация ZoneVideo в FolderVideo для 3D папки
function toFolderVideos(videos: ZoneVideo[]): FolderVideo[] {
  return videos.map(v => ({
    id: v.id,
    image: proxyImageUrl(v.preview_url),
    title: v.owner_username ? `@${v.owner_username}` : v.title?.slice(0, 20) || 'Video',
    views: v.view_count,
    likes: v.like_count,
  }));
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

// Дефолтные папки (используются если у проекта нет папок)
const defaultFolderConfigs: FolderConfig[] = [
  { id: 'all', title: 'Все видео', color: '#64748b', iconType: 'all' },
  { id: 'ideas', title: 'Идеи', color: '#f97316', iconType: 'lightbulb' },
  { id: '1', title: 'Ожидает сценария', color: '#6366f1', iconType: 'file' },
  { id: '2', title: 'Ожидает съёмок', color: '#f59e0b', iconType: 'camera' },
  { id: '3', title: 'Ожидает монтажа', color: '#10b981', iconType: 'scissors' },
  { id: '4', title: 'Готовое', color: '#8b5cf6', iconType: 'check' },
  { id: 'rejected', title: 'Не подходит', color: '#ef4444', iconType: 'rejected' },
];

// Иконки маппинг
const getIconComponent = (iconType: string, color: string) => {
  const iconClass = "w-8 h-8";
  const style = { color };
  
  switch (iconType) {
    case 'all': return <Inbox className={iconClass} style={style} />;
    case 'lightbulb': return <Lightbulb className={iconClass} style={style} />;
    case 'plus': return <Plus className={iconClass} style={style} />;
    case 'star': return <Star className={iconClass} style={style} />;
    case 'sparkles': return <Sparkles className={iconClass} style={style} />;
    case 'file': return <FileText className={iconClass} style={style} />;
    case 'camera': return <Camera className={iconClass} style={style} />;
    case 'scissors': return <Scissors className={iconClass} style={style} />;
    case 'check': return <Check className={iconClass} style={style} />;
    case 'rejected': return <Trash2 className={iconClass} style={style} />;
    default: return <FolderOpen className={iconClass} style={style} />;
  }
};

// Доступные иконки для выбора

export function Workspace() {
  const { loading, moveVideoToZone, deleteVideo } = useWorkspaceZones();
  const { videos: inboxVideos, removeVideo: removeInboxVideo, updateVideoFolder } = useInboxVideos();
  const { 
    currentProject, 
    currentProjectId, 
    addFolder, 
    removeFolder, 
    updateFolder, 
    reorderFolders 
  } = useProjectContext();
  const [draggedVideo, setDraggedVideo] = useState<ZoneVideo | null>(null);
  const [dropTargetZone, setDropTargetZone] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<FolderConfig | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<ZoneVideo | null>(null);
  const [moveMenuVideoId, setMoveMenuVideoId] = useState<string | null>(null);
  const [cardMenuVideoId, setCardMenuVideoId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'viral' | 'views' | 'likes' | 'date' | 'folder'>('viral');
  const [filterByFolder, setFilterByFolder] = useState<string | null>(null); // null = все
  const [showFolderSettings, setShowFolderSettings] = useState(false);
  const [editingFolder, setEditingFolder] = useState<ProjectFolder | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [draggedFolderIndex, setDraggedFolderIndex] = useState<number | null>(null);
  
  // Преобразуем папки проекта в FolderConfig формат
  const projectFolders: FolderConfig[] = currentProject?.folders
    ?.slice()
    .sort((a, b) => a.order - b.order)
    .map(f => ({
      id: f.id,
      title: f.name,
      color: f.color,
      iconType: f.icon,
    })) || [];
  
  // Добавляем системную папку "Все видео" в начало
  const folderConfigs: FolderConfig[] = [
    { id: 'all', title: 'Все видео', color: '#64748b', iconType: 'all' },
    ...projectFolders.length > 0 ? projectFolders : defaultFolderConfigs.slice(1),
  ];
  
  // Папки для фильтрации (без "Все видео")
  const filterableFolders = folderConfigs.filter(f => f.id !== 'all');

  // Перемещение видео в другую папку
  const handleMoveToFolder = async (video: ZoneVideo, targetFolderId: string) => {
    const targetFolder = folderConfigs.find(f => f.id === targetFolderId);
    try {
      // Используем updateVideoFolder для видео из inbox
      const success = await updateVideoFolder(video.id, targetFolderId);
      if (success) {
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (zoneId: string | null) => {
    setDropTargetZone(zoneId === null ? 'unassigned' : zoneId);
  };

  const handleDrop = (e: React.DragEvent, zoneId: string | null) => {
    e.preventDefault();
    setDropTargetZone(null);
    if (draggedVideo) {
      moveVideoToZone(draggedVideo.id, zoneId);
    }
    setDraggedVideo(null);
  };

  const handleDeleteVideo = async (videoId: string, isInbox: boolean) => {
    if (isInbox) {
      await removeInboxVideo(videoId);
    } else {
      await deleteVideo(videoId);
    }
  };

  // Преобразование inbox видео в ZoneVideo формат
  const transformInboxVideo = (v: any, folderId: string): ZoneVideo => ({
    id: v.id,
    title: v.title,
    preview_url: v.previewUrl,
    url: v.url,
    zone_id: folderId,
    folder_id: (v as any).folder_id || 'ideas',
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
    download_url: (v as any).download_url,
    status: 'active',
  });

  // Получаем видео для папки по folderId
  const getFolderVideos = (folderId: string | null): ZoneVideo[] => {
    // Для "all" - показываем ВСЕ видео проекта
    if (folderId === 'all') {
      return inboxVideos.map(v => {
        const videoFolderId = (v as any).folder_id || null;
        return transformInboxVideo(v, videoFolderId);
      });
    }
    
    // Для любой папки - фильтруем по folder_id
    return inboxVideos
      .filter(v => {
        const videoFolderId = (v as any).folder_id;
        return videoFolderId === folderId;
      })
      .map(v => transformInboxVideo(v, folderId || 'ideas'));
  };
  
  // Получить название папки по ID
  const getFolderName = (folderId: string | null): string => {
    const folder = filterableFolders.find(f => f.id === folderId);
    return folder?.title || 'Неизвестно';
  };
  
  // Получить цвет папки по ID
  const getFolderColor = (folderId: string | null): string => {
    const folder = filterableFolders.find(f => f.id === folderId);
    return folder?.color || '#64748b';
  };

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
          download_url: (selectedVideo as any).download_url,
          folder_id: selectedVideo.folder_id,
        }}
        onBack={() => setSelectedVideo(null)}
      />
    );
  }

  // Модалка папки
  if (selectedFolder) {
    const folderVideos = getFolderVideos(selectedFolder.id);
    const isAllVideos = selectedFolder.id === 'all';
    const isInboxFolder = selectedFolder.id === 'ideas' || isAllVideos;
    
    // Фильтрация по папке (только для "Все видео")
    const filteredVideos = isAllVideos && filterByFolder
      ? folderVideos.filter(v => v.folder_id === filterByFolder)
      : folderVideos;
    
    // Сортировка видео
    const sortedVideos = [...filteredVideos].sort((a, b) => {
      switch (sortBy) {
        case 'viral':
          return calculateViralCoefficient(b.view_count, b.taken_at || b.created_at) - 
                 calculateViralCoefficient(a.view_count, a.taken_at || a.created_at);
        case 'views':
          return (b.view_count || 0) - (a.view_count || 0);
        case 'likes':
          return (b.like_count || 0) - (a.like_count || 0);
        case 'date':
          const dateA = a.taken_at || a.created_at || '';
          const dateB = b.taken_at || b.created_at || '';
          return String(dateB).localeCompare(String(dateA));
        case 'folder':
          // Сортировка по порядку папок
          const orderA = filterableFolders.findIndex(f => f.id === a.folder_id);
          const orderB = filterableFolders.findIndex(f => f.id === b.folder_id);
          return orderA - orderB;
        default:
          return 0;
      }
    });
    
    return (
      <div className="h-full overflow-hidden flex flex-col bg-[#f5f5f5]">
        <div className="max-w-6xl mx-auto w-full p-6 pt-6 flex flex-col h-full">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => { setSelectedFolder(null); setCardMenuVideoId(null); setFilterByFolder(null); }}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4 transition-colors active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Назад к папкам</span>
            </button>
            
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div 
                  className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{ backgroundColor: selectedFolder.color }}
                >
                  <FolderOpen className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-serif italic text-neutral-900 tracking-tighter">
                    {selectedFolder.title}
                  </h1>
                  <p className="text-neutral-500 text-sm">
                    {filteredVideos.length} видео {filterByFolder && `в "${getFolderName(filterByFolder)}"`}
                  </p>
                </div>
              </div>

              {/* Фильтры и сортировка */}
              <div className="flex items-center gap-3">
                {/* Фильтр по папке (только для "Все видео") */}
                {isAllVideos && (
                  <select
                    value={filterByFolder || ''}
                    onChange={(e) => setFilterByFolder(e.target.value || null)}
                    className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-500/30 cursor-pointer"
                  >
                    <option value="">Все папки</option>
                    {filterableFolders.map(f => (
                      <option key={f.id} value={f.id || ''}>{f.title}</option>
                    ))}
                  </select>
                )}
                
                {/* Сортировка */}
                {filteredVideos.length > 1 && (
                  <div className="flex items-center gap-2">
                    <ArrowDownUp className="w-4 h-4 text-slate-400" />
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                      className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-orange-500/30 cursor-pointer"
                    >
                      <option value="viral">По виральности</option>
                      <option value="views">По просмотрам</option>
                      <option value="likes">По лайкам</option>
                      <option value="date">По дате</option>
                      {isAllVideos && <option value="folder">По стадии</option>}
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Videos Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar-light">
            {sortedVideos.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-center">
                <div 
                  className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
                  style={{ backgroundColor: `${selectedFolder.color}20` }}
                >
                  {getIconComponent(selectedFolder.iconType, selectedFolder.color)}
                </div>
                <h3 className="text-lg font-medium text-slate-800 mb-1">Папка пуста</h3>
                <p className="text-slate-500 text-sm">Перетащите видео сюда из поиска</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 pb-6">
                {sortedVideos.map((video, idx) => {
                  const thumbnailUrl = proxyImageUrl(video.preview_url);
                  const viralCoef = calculateViralCoefficient(video.view_count, video.taken_at || video.created_at);
                  
                  // Бейдж папки - показываем только в "Все видео"
                  const folderBadge = isAllVideos ? {
                    name: video.folder_id ? getFolderName(video.folder_id) : 'Ожидает',
                    color: video.folder_id ? getFolderColor(video.folder_id) : '#94a3b8'
                  } : undefined;
                  
                  return (
                    <VideoGradientCard
                      key={`folder-${video.id}-${idx}`}
                      thumbnailUrl={thumbnailUrl}
                      username={video.owner_username || 'instagram'}
                      caption={video.title}
                      viewCount={video.view_count}
                      likeCount={video.like_count}
                      viralCoef={viralCoef}
                      folderBadge={folderBadge}
                      onClick={() => setSelectedVideo(video)}
                      onDragStart={() => setDraggedVideo(video)}
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
                                {folderConfigs
                                  .filter(f => f.id !== selectedFolder?.id)
                                  .map(folder => (
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
                                        {folder.iconType === 'inbox' && <Inbox className="w-2.5 h-2.5" style={{ color: folder.color }} />}
                                        {folder.iconType === 'lightbulb' && <Lightbulb className="w-2.5 h-2.5" style={{ color: folder.color }} />}
                                        {folder.iconType === 'file' && <FileText className="w-2.5 h-2.5" style={{ color: folder.color }} />}
                                        {folder.iconType === 'camera' && <Camera className="w-2.5 h-2.5" style={{ color: folder.color }} />}
                                        {folder.iconType === 'scissors' && <Scissors className="w-2.5 h-2.5" style={{ color: folder.color }} />}
                                        {folder.iconType === 'check' && <Check className="w-2.5 h-2.5" style={{ color: folder.color }} />}
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
                              handleDeleteVideo(video.id, isInboxFolder); 
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
      </div>
    );
  }

  // Подсчёт общего количества видео
  const totalVideos = folderConfigs.reduce((sum, config) => sum + getFolderVideos(config.id).length, 0);
  
  // Обработчик создания папки
  const handleCreateFolder = async () => {
    if (!currentProjectId || !newFolderName.trim()) return;
    await addFolder(currentProjectId, newFolderName.trim());
    setNewFolderName('');
    toast.success('Папка создана');
  };
  
  // Обработчик удаления папки
  const handleDeleteFolder = async (folderId: string) => {
    if (!currentProjectId) return;
    await removeFolder(currentProjectId, folderId);
    toast.success('Папка удалена');
  };
  
  // Обработчик обновления папки
  const handleUpdateFolder = async (folderId: string, updates: Partial<Omit<ProjectFolder, 'id'>>) => {
    if (!currentProjectId) return;
    await updateFolder(currentProjectId, folderId, updates);
    setEditingFolder(null);
  };
  
  // Drag & drop для перестановки папок
  const handleFolderDragStart = (index: number) => {
    setDraggedFolderIndex(index);
  };
  
  const handleFolderDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedFolderIndex === null || draggedFolderIndex === index) return;
    
    // Визуальная обратная связь
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

  return (
    <div className="h-full overflow-y-auto custom-scrollbar-light">
      <div className="max-w-6xl mx-auto p-6 pt-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <h1 className="text-4xl md:text-5xl font-serif italic text-neutral-900 tracking-tighter">
                Рабочий стол
              </h1>
              {totalVideos > 0 && (
                <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm font-semibold">
                  {totalVideos} видео
                </span>
              )}
            </div>
            <button
              onClick={() => setShowFolderSettings(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 text-sm font-medium transition-colors shadow-sm"
            >
              <Settings className="w-4 h-4" />
              Настроить папки
            </button>
          </div>
          <p className="text-neutral-500 text-base">
            Организуй контент по категориям
          </p>
        </div>

        {/* Folder Grid - 3D Folders with Glowing Effect - 3 columns */}
        <div 
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 justify-items-center"
        >
          {folderConfigs.map((config) => {
            const folderVideos = getFolderVideos(config.id);
            const folder3DVideos = toFolderVideos(folderVideos);
            
            return (
              <div
                key={config.id || 'incoming'}
                onDragOver={handleDragOver}
                onDragEnter={() => handleDragEnter(config.id)}
                onDrop={(e) => handleDrop(e, config.id)}
                className={cn(
                  "relative transition-all duration-300",
                  dropTargetZone === (config.id || 'unassigned') && "scale-105"
                )}
              >
                {/* Glowing Effect Container */}
                <div className="relative rounded-[1.5rem] p-1">
                  <GlowingEffect
                    spread={40}
                    glow={true}
                    disabled={false}
                    proximity={64}
                    inactiveZone={0.01}
                    borderWidth={2}
                  />
                  <div className="relative">
                    <AnimatedFolder3D
                      title={config.title}
                      videos={folder3DVideos}
                      count={folderVideos.length}
                      color={config.color}
                      icon={getIconComponent(config.iconType, config.color)}
                      onClick={() => setSelectedFolder(config)}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Folder Settings Modal */}
      {showFolderSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
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
                          <Palette className="w-4 h-4 text-slate-400" />
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
    </div>
  );
}
