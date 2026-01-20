import { useState } from 'react';
import { useWorkspaceZones, ZoneVideo } from '../hooks/useWorkspaceZones';
import { useInboxVideos } from '../hooks/useInboxVideos';
import { useProjectContext } from '../contexts/ProjectContext';
import { Sparkles, Star, FileText, Trash2, ExternalLink, ChevronLeft, Plus, Inbox, Lightbulb, Camera, Scissors, Check, FolderOpen } from 'lucide-react';
import { cn } from '../utils/cn';
import { AnimatedFolder3D, FolderVideo } from './ui/Folder3D';
import { VideoGradientCard } from './ui/VideoGradientCard';
import { VideoDetailPage } from './VideoDetailPage';


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
  
  // Используем папки из текущего проекта или дефолтные
  const folderConfigs = defaultFolderConfigs;

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
    const isInboxFolder = selectedFolder.id === null;
    
    return (
      <div className="h-full overflow-hidden flex flex-col bg-[#f5f5f5]">
        <div className="max-w-6xl mx-auto w-full p-6 pt-6 flex flex-col h-full">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={() => setSelectedFolder(null)}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-4 transition-colors active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Назад к папкам</span>
            </button>
            
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
          </div>

          {/* Videos Grid */}
          <div className="flex-1 overflow-y-auto custom-scrollbar-light">
            {folderVideos.length === 0 ? (
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
                {folderVideos.map((video, idx) => {
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
                      folderMenu={
                        <div className="absolute bottom-12 right-0 bg-white rounded-2xl shadow-2xl p-2 min-w-[140px] z-50 animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <button
                            onClick={(e) => { e.stopPropagation(); setSelectedVideo(video); }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-orange-50 transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center">
                              <FileText className="w-4 h-4 text-orange-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-700">Работать</span>
                          </button>
                          <a
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-blue-50 transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
                              <ExternalLink className="w-4 h-4 text-blue-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-700">Открыть</span>
                          </a>
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDeleteVideo(video.id, isInboxFolder); }}
                            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-red-50 transition-colors text-left"
                          >
                            <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </div>
                            <span className="text-sm font-medium text-slate-700">Удалить</span>
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

  return (
    <div className="h-full overflow-y-auto custom-scrollbar-light">
      <div className="max-w-6xl mx-auto p-6 pt-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-serif italic text-neutral-900 tracking-tighter">
            Рабочий стол
          </h1>
          <p className="text-neutral-500 text-base mt-1">
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
