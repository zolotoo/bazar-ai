import { useState } from 'react';
import { useWorkspaceZones, ZoneVideo } from '../hooks/useWorkspaceZones';
import { Plus, Sparkles, Star, FileText, CheckCircle, ArrowUpRight } from 'lucide-react';
import { cn } from '../utils/cn';

interface MiniVideoCardProps {
  video: ZoneVideo;
  index: number;
}

function MiniVideoCard({ video, index }: MiniVideoCardProps) {
  // Position cards in a fan layout
  const rotation = (index - 1) * 8; // -8, 0, 8 degrees
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
}

function FolderCard({ title, videos, color, icon, zoneId, onDragOver, onDrop, isDropTarget, onDragEnter }: FolderCardProps) {
  const previewVideos = videos.slice(0, 3);
  
  return (
    <div
      onDragOver={onDragOver}
      onDragEnter={onDragEnter}
      onDrop={(e) => onDrop(e, zoneId)}
      className={cn(
        "group relative bg-white rounded-3xl p-6 transition-all duration-300 cursor-pointer",
        "hover:shadow-xl hover:shadow-black/5 hover:scale-[1.01]",
        isDropTarget && "ring-2 ring-orange-500 shadow-xl shadow-orange-500/20 scale-[1.02]"
      )}
    >
      {/* Folder illustration with video previews */}
      <div className="relative w-full h-40 mb-6 flex items-center justify-center">
        {/* Folder back */}
        <div 
          className="absolute inset-x-4 bottom-0 h-28 rounded-2xl"
          style={{ backgroundColor: `${color}15` }}
        />
        
        {/* Folder front with blur effect */}
        <div 
          className="absolute inset-x-0 bottom-0 h-20 rounded-2xl backdrop-blur-md"
          style={{ backgroundColor: `${color}08` }}
        />
        
        {/* Video previews */}
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
        
        {/* Arrow button */}
        <div 
          className="absolute bottom-2 right-2 w-10 h-10 rounded-full flex items-center justify-center transition-all group-hover:scale-110"
          style={{ backgroundColor: color }}
        >
          <ArrowUpRight className="w-5 h-5 text-white" />
        </div>
      </div>
      
      {/* Title */}
      <h3 className="text-xl font-medium text-neutral-900 tracking-tight mb-1">
        {title}
      </h3>
      
      {/* Year/Count badge */}
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

const folderConfigs = [
  { id: null, title: 'Входящие', subtitle: 'Новые видео', color: '#f97316', iconType: 'plus' },
  { id: '1', title: 'Избранное', subtitle: 'Лучшие идеи', color: '#6366f1', iconType: 'star' },
  { id: '2', title: 'В работе', subtitle: 'Активные', color: '#f59e0b', iconType: 'sparkles' },
  { id: '3', title: 'Сценарии', subtitle: 'Готовые', color: '#10b981', iconType: 'file' },
  { id: '4', title: 'Завершено', subtitle: 'Архив', color: '#8b5cf6', iconType: 'check' },
];

const iconMap: Record<string, React.ReactNode> = {
  plus: <Plus className="w-8 h-8 text-orange-500" />,
  star: <Star className="w-8 h-8 text-indigo-500" />,
  sparkles: <Sparkles className="w-8 h-8 text-amber-500" />,
  file: <FileText className="w-8 h-8 text-emerald-500" />,
  check: <CheckCircle className="w-8 h-8 text-violet-500" />,
};

export function Workspace() {
  const { videos, loading, moveVideoToZone, getVideosByZone } = useWorkspaceZones();
  const [draggedVideo, setDraggedVideo] = useState<ZoneVideo | null>(null);
  const [dropTargetZone, setDropTargetZone] = useState<string | null>(null);

  const _handleDragStart = (_e: React.DragEvent, video: ZoneVideo) => {
    setDraggedVideo(video);
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

  const unassignedVideos = videos.filter(v => !v.zone_id);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-slate-400 text-lg">Загрузка...</div>
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
            const folderVideos = config.id === null 
              ? unassignedVideos 
              : getVideosByZone(config.id);
            
            return (
              <FolderCard
                key={config.id || 'incoming'}
                title={config.title}
                subtitle={config.subtitle}
                videos={folderVideos}
                color={config.color}
                icon={iconMap[config.iconType]}
                zoneId={config.id}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                isDropTarget={dropTargetZone === (config.id || 'unassigned')}
                onDragEnter={() => handleDragEnter(config.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
