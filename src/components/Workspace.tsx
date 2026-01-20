import { useState } from 'react';
import { useWorkspaceZones, ZoneVideo } from '../hooks/useWorkspaceZones';
import { useInboxVideos } from '../hooks/useInboxVideos';
import { Plus, Sparkles, Star, FileText, CheckCircle, ArrowUpRight, Trash2, Eye, Heart, ExternalLink, FolderOpen, ChevronLeft } from 'lucide-react';
import { cn } from '../utils/cn';

function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

interface MiniVideoCardProps {
  video: ZoneVideo;
  index: number;
}

function MiniVideoCard({ video, index }: MiniVideoCardProps) {
  const rotation = (index - 1) * 8;
  const translateX = (index - 1) * 15;
  const translateY = index === 1 ? 0 : 10;
  
  return (
    <div
      className="absolute w-20 h-28 rounded-xl overflow-hidden shadow-lg transition-all duration-300 group-hover:shadow-xl"
      style={{
        transform: `translateX(${translateX}px) translateY(${translateY}px) rotate(${rotation}deg)`,
        zIndex: index === 1 ? 3 : 3 - Math.abs(index - 1),
      }}
    >
      <img
        src={video.preview_url || 'https://via.placeholder.com/80x112'}
        alt=""
        className="w-full h-full object-cover"
        onError={(e) => {
          e.currentTarget.src = 'https://via.placeholder.com/80x112?text=V';
        }}
      />
    </div>
  );
}

interface FolderCardProps {
  title: string;
  videos: ZoneVideo[];
  color: string;
  icon: React.ReactNode;
  zoneId: string | null;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent, zoneId: string | null) => void;
  isDropTarget: boolean;
  onDragEnter: () => void;
  onClick: () => void;
}

function FolderCard({ title, videos, color, icon, zoneId, onDragOver, onDrop, isDropTarget, onDragEnter, onClick }: FolderCardProps) {
  const previewVideos = videos.slice(0, 3);
  
  return (
    <div
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDrop={(e) => onDrop(e, zoneId)}
      onClick={onClick}
      className={cn(
        "group relative bg-white rounded-3xl p-6 transition-all duration-300 cursor-pointer",
        "hover:shadow-xl hover:shadow-black/5 hover:scale-[1.01] active:scale-[0.98]",
        isDropTarget && "ring-2 ring-orange-500 shadow-xl shadow-orange-500/20 scale-[1.02]"
      )}
    >
      {/* Folder illustration with video previews */}
      <div className="relative w-full h-40 mb-6 flex items-center justify-center">
        <div 
          className="absolute inset-x-4 bottom-0 h-28 rounded-2xl"
          style={{ backgroundColor: `${color}15` }}
        />
        
        <div 
          className="absolute inset-x-0 bottom-0 h-20 rounded-2xl backdrop-blur-md"
          style={{ backgroundColor: `${color}08` }}
        />
        
        <div className="relative h-28 w-32 mt-2">
          {previewVideos.length > 0 ? (
            previewVideos.map((video, index) => (
              <MiniVideoCard key={video.id} video={video} index={index} />
            ))
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div 
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ backgroundColor: `${color}20` }}
              >
                {icon}
              </div>
            </div>
          )}
        </div>
        
        <div 
          className="absolute bottom-2 right-2 w-10 h-10 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
          style={{ backgroundColor: color }}
        >
          <ArrowUpRight className="w-5 h-5 text-white" />
        </div>
      </div>
      
      <h3 className="text-xl font-medium text-neutral-900 tracking-tight mb-1">
        {title}
      </h3>
      
      <div className="inline-flex items-center gap-2">
        <span 
          className="text-sm font-medium px-3 py-1 rounded-full"
          style={{ backgroundColor: `${color}15`, color }}
        >
          {videos.length} видео
        </span>
      </div>
    </div>
  );
}

interface FolderConfig {
  id: string | null;
  title: string;
  color: string;
  iconType: string;
}

const folderConfigs: FolderConfig[] = [
  { id: null, title: 'Входящие', color: '#f97316', iconType: 'plus' },
  { id: '1', title: 'Избранное', color: '#6366f1', iconType: 'star' },
  { id: '2', title: 'В работе', color: '#f59e0b', iconType: 'sparkles' },
  { id: '3', title: 'Сценарии', color: '#10b981', iconType: 'file' },
  { id: '4', title: 'Завершено', color: '#8b5cf6', iconType: 'check' },
];

const iconMap: Record<string, React.ReactNode> = {
  plus: <Plus className="w-8 h-8 text-orange-500" />,
  star: <Star className="w-8 h-8 text-indigo-500" />,
  sparkles: <Sparkles className="w-8 h-8 text-amber-500" />,
  file: <FileText className="w-8 h-8 text-emerald-500" />,
  check: <CheckCircle className="w-8 h-8 text-violet-500" />,
};

export function Workspace() {
  const { loading, moveVideoToZone, deleteVideo, getVideosByZone } = useWorkspaceZones();
  const { videos: inboxVideos, removeVideo: removeInboxVideo } = useInboxVideos();
  const [draggedVideo, setDraggedVideo] = useState<ZoneVideo | null>(null);
  const [dropTargetZone, setDropTargetZone] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<FolderConfig | null>(null);

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

  // Получаем видео для папки "Входящие" - это inboxVideos
  const getFolderVideos = (folderId: string | null): ZoneVideo[] => {
    if (folderId === null) {
      // Для "Входящих" показываем видео из inbox
      return inboxVideos.map(v => ({
        id: v.id,
        title: v.title,
        preview_url: v.previewUrl,
        url: v.url,
        zone_id: null,
        position_x: 0,
        position_y: 0,
        view_count: (v as any).view_count,
        like_count: (v as any).like_count,
        comment_count: (v as any).comment_count,
        owner_username: (v as any).owner_username,
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

  // Модалка папки
  if (selectedFolder) {
    const folderVideos = getFolderVideos(selectedFolder.id);
    const isInboxFolder = selectedFolder.id === null;
    
    return (
      <div className="h-full overflow-hidden flex flex-col bg-[#f5f5f5]">
        <div className="max-w-6xl mx-auto w-full p-6 pt-20 flex flex-col h-full">
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
                  
                  return (
                    <div
                      key={`folder-${video.id}-${idx}`}
                      draggable
                      onDragStart={() => setDraggedVideo(video)}
                      className="group relative rounded-[1.75rem] overflow-hidden shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] cursor-grab active:cursor-grabbing"
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
                          
                          {/* Move to folder dropdown - only show if not in inbox */}
                          {!isInboxFolder && (
                            <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                              <select
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  const newZoneId = e.target.value === 'null' ? null : e.target.value;
                                  moveVideoToZone(video.id, newZoneId);
                                }}
                                value={video.zone_id || 'null'}
                                className="px-2 py-0.5 rounded-full bg-white/95 text-slate-600 text-[9px] font-medium shadow-lg cursor-pointer outline-none"
                              >
                                {folderConfigs.map(f => (
                                  <option key={f.id || 'null'} value={f.id || 'null'}>
                                    {f.title}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                          
                          {/* Hover overlay with actions */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="flex gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteVideo(video.id, isInboxFolder);
                                }}
                                className="p-2.5 rounded-full bg-red-500 text-white shadow-lg active:scale-95"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                              <a
                                href={video.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
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
                              @{video.owner_username || 'instagram'}
                            </h3>
                          </div>
                          
                          <p className="font-sans text-slate-700 text-xs leading-relaxed line-clamp-2 mb-3">
                            {video.title?.slice(0, 50)}...
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 text-slate-600">
                              <div className="flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">{formatNumber(video.view_count)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Heart className="w-3.5 h-3.5" />
                                <span className="text-xs font-medium">{formatNumber(video.like_count)}</span>
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
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto custom-scrollbar-light">
      <div className="max-w-6xl mx-auto p-6 pt-20">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-serif italic text-neutral-900 tracking-tighter">
            Рабочий стол
          </h1>
          <p className="text-neutral-500 text-base mt-1">
            Организуй контент по категориям
          </p>
        </div>

        {/* Folder Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {folderConfigs.map((config) => {
            const folderVideos = getFolderVideos(config.id);
            
            return (
              <FolderCard
                key={config.id || 'incoming'}
                title={config.title}
                videos={folderVideos}
                color={config.color}
                icon={iconMap[config.iconType]}
                zoneId={config.id}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDropTarget={dropTargetZone === (config.id || 'unassigned')}
                onDragEnter={() => handleDragEnter(config.id)}
                onClick={() => setSelectedFolder(config)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
