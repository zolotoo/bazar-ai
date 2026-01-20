import { useState } from 'react';
import { useWorkspaceZones, ZoneVideo } from '../hooks/useWorkspaceZones';
import { useInboxVideos } from '../hooks/useInboxVideos';
import { useProjectContext } from '../contexts/ProjectContext';
import { Sparkles, Star, FileText, Trash2, ExternalLink, ChevronLeft, Plus, Inbox, Lightbulb, Camera, Scissors, Check, FolderOpen, ArrowRightLeft, ArrowDownUp } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../utils/cn';
import { AnimatedFolder3D, FolderVideo } from './ui/Folder3D';
import { VideoGradientCard } from './ui/VideoGradientCard';
import { VideoDetailPage } from './VideoDetailPage';


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
    image: v.preview_url || 'https://via.placeholder.com/64x96',
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

const defaultFolderConfigs: FolderConfig[] = [
  { id: 'inbox', title: 'Входящие', color: '#64748b', iconType: 'inbox' },
  { id: 'ideas', title: 'Идеи', color: '#f97316', iconType: 'lightbulb' },
  { id: '1', title: 'Ожидает сценария', color: '#6366f1', iconType: 'file' },
  { id: '2', title: 'Ожидает съёмок', color: '#f59e0b', iconType: 'camera' },
  { id: '3', title: 'Ожидает монтажа', color: '#10b981', iconType: 'scissors' },
  { id: '4', title: 'Готовое', color: '#8b5cf6', iconType: 'check' },
];

const iconMap: Record<string, React.ReactNode> = {
  inbox: <Inbox className="w-8 h-8 text-slate-500" />,
  lightbulb: <Lightbulb className="w-8 h-8 text-orange-500" />,
  plus: <Plus className="w-8 h-8 text-orange-500" />,
  star: <Star className="w-8 h-8 text-indigo-500" />,
  sparkles: <Sparkles className="w-8 h-8 text-amber-500" />,
  file: <FileText className="w-8 h-8 text-indigo-500" />,
  camera: <Camera className="w-8 h-8 text-amber-500" />,
  scissors: <Scissors className="w-8 h-8 text-emerald-500" />,
  check: <Check className="w-8 h-8 text-violet-500" />,
};

export function Workspace() {
  const { loading, moveVideoToZone, deleteVideo, getVideosByZone } = useWorkspaceZones();
  const { videos: inboxVideos, removeVideo: removeInboxVideo } = useInboxVideos();
  const { currentProject: _currentProject, currentProjectId: _currentProjectId } = useProjectContext();
  const [draggedVideo, setDraggedVideo] = useState<ZoneVideo | null>(null);
  const [dropTargetZone, setDropTargetZone] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<FolderConfig | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<ZoneVideo | null>(null);
  const [moveMenuVideoId, setMoveMenuVideoId] = useState<string | null>(null);
  const [cardMenuVideoId, setCardMenuVideoId] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'viral' | 'views' | 'likes' | 'date'>('viral');
  
  // Используем папки из текущего проекта или дефолтные
  const folderConfigs = defaultFolderConfigs;

  // Перемещение видео в другую папку
  const handleMoveToFolder = async (video: ZoneVideo, targetFolderId: string) => {
    const targetFolder = folderConfigs.find(f => f.id === targetFolderId);
    try {
      await moveVideoToZone(video.id, targetFolderId);
      setMoveMenuVideoId(null);
      toast.success(`Перемещено в "${targetFolder?.title || 'папку'}"`);
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

  // Получаем видео для папки по folderId
  const getFolderVideos = (folderId: string | null): ZoneVideo[] => {
    // Для "inbox" и "ideas" показываем видео из inboxVideos, фильтруя по folder_id
    if (folderId === 'inbox' || folderId === 'ideas') {
      return inboxVideos
        .filter(v => {
          const videoFolderId = (v as any).folder_id || 'inbox';
          return videoFolderId === folderId;
        })
        .map(v => ({
          id: v.id,
          title: v.title,
          preview_url: v.previewUrl,
          url: v.url,
          zone_id: folderId,
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
        }));
    }
    return getVideosByZone(folderId);
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
        }}
        onBack={() => setSelectedVideo(null)}
      />
    );
  }

  // Модалка папки
  if (selectedFolder) {
    const folderVideos = getFolderVideos(selectedFolder.id);
    const isInboxFolder = selectedFolder.id === 'inbox' || selectedFolder.id === 'ideas';
    
    // Сортировка видео
    const sortedVideos = [...folderVideos].sort((a, b) => {
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
              onClick={() => { setSelectedFolder(null); setCardMenuVideoId(null); }}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4 transition-colors active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Назад к папкам</span>
            </button>
            
            <div className="flex items-center justify-between">
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
                    {folderVideos.length} видео
                  </p>
                </div>
              </div>

              {/* Сортировка */}
              {folderVideos.length > 1 && (
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
                  </select>
                </div>
              )}
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
                  {iconMap[selectedFolder.iconType]}
                </div>
                <h3 className="text-lg font-medium text-slate-800 mb-1">Папка пуста</h3>
                <p className="text-slate-500 text-sm">Перетащите видео сюда из поиска</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5 pb-6">
                {sortedVideos.map((video, idx) => {
                  const thumbnailUrl = video.preview_url || 'https://via.placeholder.com/270x360';
                  const viralCoef = calculateViralCoefficient(video.view_count, video.taken_at || video.created_at);
                  
                  return (
                    <VideoGradientCard
                      key={`folder-${video.id}-${idx}`}
                      thumbnailUrl={thumbnailUrl}
                      username={video.owner_username || 'instagram'}
                      caption={video.title}
                      viewCount={video.view_count}
                      likeCount={video.like_count}
                      viralCoef={viralCoef}
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
                              <ArrowRightLeft className="w-4 h-4 text-indigo-500" />
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

  return (
    <div className="h-full overflow-y-auto custom-scrollbar-light">
      <div className="max-w-6xl mx-auto p-6 pt-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-4xl md:text-5xl font-serif italic text-neutral-900 tracking-tighter">
              Рабочий стол
            </h1>
            {totalVideos > 0 && (
              <span className="px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-sm font-semibold">
                {totalVideos} видео
              </span>
            )}
          </div>
          <p className="text-neutral-500 text-base">
            Организуй контент по категориям
          </p>
        </div>

        {/* Folder Grid - 3D Folders - 3 columns */}
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
                  "transition-all duration-300",
                  dropTargetZone === (config.id || 'unassigned') && "scale-105 ring-2 ring-orange-500 rounded-2xl"
                )}
              >
                <AnimatedFolder3D
                  title={config.title}
                  videos={folder3DVideos}
                  count={folderVideos.length}
                  color={config.color}
                  icon={iconMap[config.iconType]}
                  onClick={() => setSelectedFolder(config)}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
