'use client'
import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";
import { Eye, Heart, Sparkles, Plus, Play, ArrowRight } from "lucide-react";

export interface VideoGradientCardProps {
  thumbnailUrl: string;
  username?: string;
  caption?: string;
  viewCount?: number;
  likeCount?: number;
  date?: string;
  viralCoef?: number;
  onClick?: () => void;
  onAdd?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  showFolderMenu?: boolean;
  onFolderMenuToggle?: () => void;
  folderMenu?: React.ReactNode;
  className?: string;
}

function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export const VideoGradientCard = ({
  thumbnailUrl,
  username,
  caption,
  viewCount,
  likeCount,
  date,
  viralCoef = 0,
  onClick,
  onAdd,
  onDragStart,
  showFolderMenu,
  onFolderMenuToggle,
  folderMenu,
  className,
}: VideoGradientCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      className="group"
    >
      <motion.div
        ref={cardRef}
        className={cn(
          "relative rounded-2xl overflow-hidden cursor-pointer",
          className
        )}
        style={{
          aspectRatio: "9/16",
          boxShadow: isHovered 
            ? "0 25px 50px -12px rgba(0, 0, 0, 0.4)"
            : "0 10px 25px -5px rgba(0, 0, 0, 0.2)",
        }}
        initial={{ y: 0 }}
        animate={{
          y: isHovered ? -4 : 0,
          scale: isHovered ? 1.03 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
      >
        {/* Background image with parallax */}
        <motion.div 
          className="absolute inset-0 z-0 bg-cover bg-center"
          style={{ 
            backgroundImage: `url(${thumbnailUrl})`,
          }}
          animate={{
            scale: isHovered ? 1.08 : 1,
          }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        />

        {/* Gradient overlay - серый/тёмный как на референсе */}
        <div
          className="absolute inset-0 z-10"
          style={{
            background: `linear-gradient(to top, 
              rgba(30, 30, 35, 0.98) 0%, 
              rgba(40, 40, 48, 0.85) 25%, 
              rgba(50, 50, 60, 0.5) 45%, 
              rgba(60, 60, 70, 0.2) 60%, 
              transparent 75%
            )`,
          }}
        />

        {/* Content */}
        <div className="relative flex flex-col justify-end h-full p-5 z-20 text-white">
          {/* Top badges - абсолютное позиционирование */}
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
            {/* Viral badge */}
            <motion.div
              className={cn(
                "px-2.5 py-1 rounded-full backdrop-blur-sm flex items-center gap-1.5",
                viralCoef > 10 ? "bg-emerald-500/90 text-white" : 
                viralCoef > 5 ? "bg-amber-500/90 text-white" :
                viralCoef > 0 ? "bg-white/90 text-slate-700" :
                "bg-black/30 text-white/80"
              )}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Sparkles className="w-3 h-3" />
              <span className="text-xs font-bold">{viralCoef > 0 ? viralCoef : '—'}</span>
            </motion.div>
            
            {/* Date badge */}
            {date && (
              <motion.div
                className="px-2.5 py-1 rounded-full bg-black/30 backdrop-blur-sm text-white/90 text-xs font-medium"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
              >
                {date}
              </motion.div>
            )}
          </div>

          {/* Play button on hover - центр карточки */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-2xl pointer-events-none z-30"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: isHovered ? 1 : 0, 
              scale: isHovered ? 1 : 0.8 
            }}
            transition={{ duration: 0.2 }}
          >
            <Play className="w-6 h-6 text-slate-800 ml-1" fill="currentColor" />
          </motion.div>

          {/* Bottom content */}
          <div>
            {/* Username with verified badge */}
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-xl font-bold tracking-tight">
                @{username || 'instagram'}
              </h3>
              {viralCoef > 5 && (
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>

            {/* Stats line */}
            <p className="text-sm text-white/70 font-medium mb-4">
              {viewCount !== undefined && <>{formatNumber(viewCount)} views</>}
              {viewCount !== undefined && likeCount !== undefined && ' • '}
              {likeCount !== undefined && <>{formatNumber(likeCount)} likes</>}
            </p>

            {/* Caption - показываем только если есть */}
            {caption && (
              <p className="text-white/60 text-xs leading-relaxed line-clamp-2 mb-4">
                {caption.slice(0, 80)}{caption.length > 80 ? '...' : ''}
              </p>
            )}

            {/* Action button - стиль как на референсе */}
            {(onAdd || onFolderMenuToggle) && (
              <div className="relative">
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFolderMenuToggle?.() || onAdd?.();
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300",
                    "bg-white/10 backdrop-blur-md border border-white/20",
                    "hover:bg-white/20 hover:border-white/30",
                    showFolderMenu && "bg-white/25 border-white/40"
                  )}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-sm font-semibold tracking-wide">
                    {showFolderMenu ? 'Выберите папку' : 'Добавить'}
                  </span>
                  <motion.div
                    animate={{ 
                      rotate: showFolderMenu ? 45 : 0,
                      x: isHovered && !showFolderMenu ? 3 : 0 
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    {showFolderMenu ? (
                      <Plus className="h-4 w-4" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                  </motion.div>
                </motion.button>
                
                {/* Folder menu */}
                {showFolderMenu && folderMenu}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default VideoGradientCard;
