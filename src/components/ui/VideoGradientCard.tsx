'use client'
import React, { useRef, useState } from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";
import { Eye, Heart, Sparkles, Plus, Play } from "lucide-react";

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
  const [rotation, setRotation] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (cardRef.current) {
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const rotateX = -(y / rect.height) * 6;
      const rotateY = (x / rect.width) * 6;
      setRotation({ x: rotateX, y: rotateY });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setRotation({ x: 0, y: 0 });
  };

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
    >
      <motion.div
        ref={cardRef}
        className={cn(
          "relative rounded-[24px] overflow-hidden cursor-pointer group",
          className
        )}
        style={{
          transformStyle: "preserve-3d",
          boxShadow: isHovered 
            ? "0 -8px 60px 4px rgba(251, 146, 60, 0.35), 0 25px 50px -12px rgba(0, 0, 0, 0.25)"
            : "0 -5px 40px 2px rgba(251, 146, 60, 0.2), 0 10px 25px -5px rgba(0, 0, 0, 0.15)",
          aspectRatio: "10/16",
        }}
        initial={{ y: 0 }}
        animate={{
          y: isHovered ? -6 : 0,
          rotateX: rotation.x,
          rotateY: rotation.y,
          scale: isHovered ? 1.02 : 1,
        }}
        transition={{
          type: "spring",
          stiffness: 400,
          damping: 25
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={handleMouseLeave}
        onMouseMove={handleMouseMove}
        onClick={onClick}
      >
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        <img
          src={thumbnailUrl}
          alt=""
          className="w-full h-full object-cover"
          onError={(e) => {
            e.currentTarget.src = 'https://via.placeholder.com/270x360?text=Video';
          }}
        />
      </div>

      {/* Glass reflection overlay */}
      <motion.div
        className="absolute inset-0 z-[35] pointer-events-none"
        style={{
          background: "linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 40%, rgba(255,255,255,0) 70%, rgba(255,255,255,0.08) 100%)",
        }}
        animate={{
          opacity: isHovered ? 0.9 : 0.6,
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Dark gradient overlay */}
      <motion.div
        className="absolute inset-0 z-[5]"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.35) 50%, rgba(0,0,0,0.85) 100%)",
        }}
        animate={{
          opacity: isHovered ? 0.95 : 1,
        }}
      />

      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-10 mix-blend-overlay z-10 pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='5' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Orange glow effect */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-2/3 z-20 pointer-events-none"
        style={{
          background: `
            radial-gradient(ellipse at bottom right, rgba(251, 146, 60, 0.5) -10%, rgba(245, 158, 11, 0) 70%),
            radial-gradient(ellipse at bottom left, rgba(249, 115, 22, 0.5) -10%, rgba(234, 88, 12, 0) 70%)
          `,
          filter: "blur(30px)",
        }}
        animate={{
          opacity: isHovered ? 0.9 : 0.7,
          y: isHovered ? rotation.x * 0.3 : 0,
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Central glow */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-1/2 z-[21] pointer-events-none"
        style={{
          background: "radial-gradient(circle at bottom center, rgba(251, 146, 60, 0.6) -20%, rgba(249, 115, 22, 0) 60%)",
          filter: "blur(35px)",
        }}
        animate={{
          opacity: isHovered ? 0.85 : 0.65,
        }}
      />

      {/* Bottom border glow */}
      <motion.div
        className="absolute bottom-0 left-0 right-0 h-[2px] z-25 pointer-events-none"
        style={{
          background: "linear-gradient(90deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.6) 50%, rgba(255, 255, 255, 0.05) 100%)",
        }}
        animate={{
          boxShadow: isHovered
            ? "0 0 15px 3px rgba(251, 146, 60, 0.9), 0 0 25px 5px rgba(249, 115, 22, 0.7)"
            : "0 0 10px 2px rgba(251, 146, 60, 0.7), 0 0 20px 4px rgba(249, 115, 22, 0.5)",
          opacity: isHovered ? 1 : 0.85,
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Edge glows */}
      <motion.div
        className="absolute bottom-0 left-0 h-1/4 w-[1px] z-25 rounded-full pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0) 80%)",
        }}
        animate={{
          boxShadow: isHovered
            ? "0 0 15px 3px rgba(251, 146, 60, 0.8)"
            : "0 0 10px 2px rgba(251, 146, 60, 0.6)",
        }}
      />
      <motion.div
        className="absolute bottom-0 right-0 h-1/4 w-[1px] z-25 rounded-full pointer-events-none"
        style={{
          background: "linear-gradient(to top, rgba(255, 255, 255, 0.6) 0%, rgba(255, 255, 255, 0) 80%)",
        }}
        animate={{
          boxShadow: isHovered
            ? "0 0 15px 3px rgba(251, 146, 60, 0.8)"
            : "0 0 10px 2px rgba(251, 146, 60, 0.6)",
        }}
      />

      {/* Content */}
      <div className="relative flex flex-col h-full p-4 z-40">
        {/* Top badges */}
        <div className="flex items-center justify-between">
          {/* Viral badge */}
          <motion.div
            className={cn(
              "px-2.5 py-1 rounded-full backdrop-blur-md flex items-center gap-1.5 shadow-lg",
              viralCoef > 10 ? "bg-emerald-500/90 text-white" : 
              viralCoef > 5 ? "bg-amber-500/90 text-white" :
              viralCoef > 0 ? "bg-white/90 text-slate-700" :
              "bg-black/40 text-white/70"
            )}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Sparkles className="w-3 h-3" />
            <span className="text-xs font-bold">{viralCoef > 0 ? viralCoef : '—'}</span>
          </motion.div>
          
          {/* Date badge */}
          {date && (
            <motion.div
              className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-white text-xs font-semibold shadow-lg"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
            >
              {date}
            </motion.div>
          )}
        </div>

        {/* Play button on hover */}
        <div className="flex-1 flex items-center justify-center">
          <motion.div
            className="w-14 h-14 rounded-full bg-white/95 flex items-center justify-center shadow-2xl pointer-events-none"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ 
              opacity: isHovered ? 1 : 0, 
              scale: isHovered ? 1 : 0.8 
            }}
            transition={{ duration: 0.2 }}
          >
            <Play className="w-6 h-6 text-slate-800 ml-1" fill="currentColor" />
          </motion.div>
        </div>

        {/* Bottom content */}
        <motion.div
          animate={{
            rotateX: isHovered ? -rotation.x * 0.2 : 0,
            rotateY: isHovered ? -rotation.y * 0.2 : 0
          }}
          transition={{ duration: 0.3 }}
        >
          {/* Username */}
          {username && (
            <div className="flex items-center gap-1.5 mb-1">
              <span className="text-sm font-semibold text-white truncate drop-shadow-lg">
                @{username}
              </span>
              {viralCoef > 5 && (
                <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
          )}

          {/* Caption */}
          {caption && (
            <p className="text-white/80 text-xs leading-relaxed line-clamp-2 mb-3 drop-shadow">
              {caption.slice(0, 60)}{caption.length > 60 ? '...' : ''}
            </p>
          )}

          {/* Stats and action row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-white/90">
              {viewCount !== undefined && (
                <div className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{formatNumber(viewCount)}</span>
                </div>
              )}
              {likeCount !== undefined && (
                <div className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">{formatNumber(likeCount)}</span>
                </div>
              )}
            </div>

            {/* Add button */}
            {(onAdd || onFolderMenuToggle) && (
              <div className="relative">
                <motion.button
                  onClick={(e) => {
                    e.stopPropagation();
                    onFolderMenuToggle?.() || onAdd?.();
                  }}
                  className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-all shadow-lg",
                    showFolderMenu 
                      ? "bg-orange-500 text-white rotate-45" 
                      : "bg-white/95 text-slate-800 hover:bg-orange-500 hover:text-white"
                  )}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Plus className="w-5 h-5" />
                </motion.button>
                
                {/* Folder menu */}
                {showFolderMenu && folderMenu}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
    </div>
  );
};

export default VideoGradientCard;
