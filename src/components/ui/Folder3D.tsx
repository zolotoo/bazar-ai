import React, { useState, useRef, forwardRef } from 'react';
import { cn } from '../../utils/cn';

// --- Interfaces ---

export interface FolderVideo {
  id: string;
  image: string;
  title: string;
  views?: number;
  likes?: number;
}

interface VideoCardProps {
  image: string;
  title: string;
  delay: number;
  isVisible: boolean;
  index: number;
  totalCount: number;
  onClick: () => void;
  isSelected: boolean;
}

const VideoCard = forwardRef<HTMLDivElement, VideoCardProps>(
  ({ image, title, delay, isVisible, index, totalCount, onClick, isSelected }, ref) => {
    const middleIndex = (totalCount - 1) / 2;
    const factor = totalCount > 1 ? (index - middleIndex) / middleIndex : 0;
    
    const rotation = factor * 25; 
    const translationX = factor * 85; 
    const translationY = Math.abs(factor) * 12;

    return (
      <div
        ref={ref}
        className={cn(
          "absolute w-16 h-24 cursor-pointer group/card",
          isSelected && "opacity-0",
        )}
        style={{
          transform: isVisible
            ? `translateY(calc(-90px + ${translationY}px)) translateX(${translationX}px) rotate(${rotation}deg) scale(1)`
            : "translateY(0px) translateX(0px) rotate(0deg) scale(0.4)",
          opacity: isSelected ? 0 : isVisible ? 1 : 0,
          transition: `all 700ms cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
          zIndex: 10 + index,
          left: "-32px",
          top: "-48px",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <div className={cn(
          "w-full h-full rounded-xl overflow-hidden shadow-xl bg-slate-900 border border-white/10 relative",
          "transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "group-hover/card:-translate-y-4 group-hover/card:shadow-2xl group-hover/card:ring-2 group-hover/card:ring-orange-400 group-hover/card:scale-110"
        )}>
          <img 
            src={image || 'https://via.placeholder.com/64x96'} 
            alt={title} 
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/64x96?text=Video';
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent" />
          <p className="absolute bottom-1 left-1 right-1 text-[7px] font-bold uppercase tracking-tight text-white truncate drop-shadow-md">
            {title}
          </p>
        </div>
      </div>
    );
  }
);
VideoCard.displayName = "VideoCard";

interface AnimatedFolder3DProps {
  title: string;
  videos: FolderVideo[];
  count: number;
  color: string;
  icon: React.ReactNode;
  className?: string;
  onClick?: () => void;
  onVideoClick?: (video: FolderVideo, index: number) => void;
}

export const AnimatedFolder3D: React.FC<AnimatedFolder3DProps> = ({ 
  title, 
  videos, 
  count,
  color,
  icon,
  className, 
  onClick,
  onVideoClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [hiddenCardId, setHiddenCardId] = useState<string | null>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  const previewVideos = videos.slice(0, 5);

  const handleVideoClick = (video: FolderVideo, index: number) => {
    setHiddenCardId(video.id);
    onVideoClick?.(video, index);
    setTimeout(() => setHiddenCardId(null), 300);
  };

  // Генерируем градиенты на основе цвета
  const lighterColor = color;
  const darkerColor = `${color}dd`;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center justify-center p-6 rounded-2xl cursor-pointer",
        "bg-white/80 backdrop-blur-sm border border-slate-200/50",
        "transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
        "hover:shadow-2xl hover:border-orange-300/50 group",
        className
      )}
      style={{ 
        minWidth: "200px", 
        minHeight: "240px", 
        perspective: "1200px",
        transform: isHovered ? "scale(1.02)" : "scale(1)",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Glow effect on hover */}
      <div
        className="absolute inset-0 rounded-2xl transition-opacity duration-700 pointer-events-none"
        style={{ 
          background: `radial-gradient(circle at 50% 70%, ${color}40 0%, transparent 70%)`,
          opacity: isHovered ? 1 : 0,
        }}
      />
      
      {/* Folder container */}
      <div className="relative flex items-center justify-center mb-2" style={{ height: "140px", width: "160px" }}>
        {/* Back of folder */}
        <div 
          className="absolute w-28 h-20 rounded-lg shadow-md border border-white/20"
          style={{ 
            background: `linear-gradient(135deg, ${lighterColor} 0%, ${darkerColor} 100%)`,
            transformOrigin: "bottom center",
            transform: isHovered ? "rotateX(-20deg) scaleY(1.05)" : "rotateX(0deg) scaleY(1)",
            transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)",
            zIndex: 10,
          }} 
        />
        
        {/* Folder tab */}
        <div 
          className="absolute w-10 h-3 rounded-t-md border-t border-x border-white/20"
          style={{ 
            background: darkerColor,
            top: "calc(50% - 40px - 10px)",
            left: "calc(50% - 56px + 12px)",
            transformOrigin: "bottom center",
            transform: isHovered ? "rotateX(-30deg) translateY(-2px)" : "rotateX(0deg) translateY(0)",
            transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)",
            zIndex: 10,
          }} 
        />
        
        {/* Video cards container */}
        <div 
          className="absolute"
          style={{ 
            top: "50%", 
            left: "50%", 
            transform: "translate(-50%, -50%)",
            zIndex: 20,
          }}
        >
          {previewVideos.map((video, index) => (
            <VideoCard 
              key={video.id} 
              ref={(el) => { cardRefs.current[index] = el; }} 
              image={video.image} 
              title={video.title} 
              delay={index * 50} 
              isVisible={isHovered} 
              index={index} 
              totalCount={previewVideos.length} 
              onClick={() => handleVideoClick(video, index)} 
              isSelected={hiddenCardId === video.id} 
            />
          ))}
        </div>
        
        {/* Front of folder */}
        <div 
          className="absolute w-28 h-20 rounded-lg shadow-lg border border-white/30"
          style={{ 
            background: `linear-gradient(135deg, ${lighterColor} 0%, ${darkerColor} 100%)`,
            top: "calc(50% - 40px + 4px)",
            transformOrigin: "bottom center",
            transform: isHovered ? "rotateX(35deg) translateY(10px)" : "rotateX(0deg) translateY(0)",
            transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)",
            zIndex: 30,
          }} 
        />
        
        {/* Shine effect on front */}
        <div 
          className="absolute w-28 h-20 rounded-lg overflow-hidden pointer-events-none"
          style={{ 
            top: "calc(50% - 40px + 4px)",
            background: "linear-gradient(135deg, rgba(255,255,255,0.4) 0%, transparent 60%)",
            transformOrigin: "bottom center",
            transform: isHovered ? "rotateX(35deg) translateY(10px)" : "rotateX(0deg) translateY(0)",
            transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1)",
            zIndex: 31,
          }} 
        />
        
        {/* Icon on front when closed */}
        <div 
          className="absolute w-28 h-20 rounded-lg flex items-center justify-center pointer-events-none"
          style={{ 
            top: "calc(50% - 40px + 4px)",
            transformOrigin: "bottom center",
            transform: isHovered ? "rotateX(35deg) translateY(10px)" : "rotateX(0deg) translateY(0)",
            transition: "transform 700ms cubic-bezier(0.16, 1, 0.3, 1), opacity 400ms ease",
            zIndex: 32,
            opacity: isHovered ? 0 : 1,
          }} 
        >
          <div className="text-white/80">
            {icon}
          </div>
        </div>
      </div>
      
      {/* Title and count */}
      <div className="text-center relative z-40">
        <h3 
          className="text-base font-bold text-slate-800 transition-all duration-500"
          style={{ 
            transform: isHovered ? "translateY(2px)" : "translateY(0)",
          }}
        >
          {title}
        </h3>
        <p 
          className="text-sm font-medium text-slate-500 transition-all duration-500"
          style={{ opacity: isHovered ? 0.7 : 1 }}
        >
          {count} видео
        </p>
      </div>
      
      {/* Hover hint */}
      <div 
        className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-slate-400 transition-all duration-500"
        style={{ 
          opacity: isHovered ? 0 : 0.6,
          transform: isHovered ? "translateY(10px)" : "translateY(0)",
        }}
      >
        <span>Наведите</span>
      </div>
    </div>
  );
};

export default AnimatedFolder3D;
