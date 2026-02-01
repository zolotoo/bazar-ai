'use client'
import React, { useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "../../utils/cn";
import { Sparkles, MoreVertical, ArrowRight, Eye, Heart, Loader2, FileText, AlertCircle, MessageCircle, TrendingUp, Calendar } from "lucide-react";

// Проксирование Instagram изображений через наш API
function proxyImageUrl(url?: string): string {
  if (!url) return 'https://via.placeholder.com/270x360';
  if (url.includes('/api/proxy-image') || url.includes('placeholder.com')) return url;
  if (url.includes('cdninstagram.com') || url.includes('instagram.com') || url.includes('workers.dev') || url.includes('socialapi')) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

export interface VideoGradientCardProps {
  thumbnailUrl: string;
  username?: string;
  caption?: string;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  date?: string;
  viralCoef?: number;
  viralMultiplier?: number | null; // Множитель залётности (во сколько раз больше среднего автора)
  folderBadge?: { name: string; color: string }; // Бейдж папки
  transcriptStatus?: string | null; // null, downloading, processing, completed, error
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
  commentCount,
  date,
  viralCoef = 0,
  viralMultiplier,
  folderBadge,
  transcriptStatus,
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
  const [isMobile, setIsMobile] = useState(false);
  const [imgError, setImgError] = useState(false);
  useEffect(() => {
    const m = () => setIsMobile(window.matchMedia('(max-width: 768px)').matches);
    m();
    window.addEventListener('resize', m);
    return () => window.removeEventListener('resize', m);
  }, []);

  // Сброс ошибки при смене превью
  useEffect(() => {
    setImgError(false);
  }, [thumbnailUrl]);

  return (
    <div
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      className="group relative"
    >
      {/* Folder menu - вынесен наружу для корректного z-index */}
      {showFolderMenu && folderMenu && (
        <div className="absolute top-10 right-0 z-[100]">
          {folderMenu}
        </div>
      )}
      <motion.div
        ref={cardRef}
        className={cn(
          "relative rounded-card-xl overflow-hidden cursor-pointer",
          "backdrop-blur-sm",
          "touch-manipulation",
          className
        )}
        style={{
          aspectRatio: "9/16",
          boxShadow: isHovered 
            ? "0 20px 56px rgba(0, 0, 0, 0.08), 0 8px 24px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.03)"
            : "0 8px 32px rgba(0, 0, 0, 0.06), 0 2px 12px rgba(0, 0, 0, 0.03), 0 0 0 1px rgba(0, 0, 0, 0.02)",
        }}
        initial={false}
        animate={{
          y: isMobile ? 0 : isHovered ? -8 : 0,
          scale: isMobile ? 1 : isHovered ? 1.03 : 1,
        }}
        transition={{
          type: "tween",
          duration: isMobile ? 0.15 : 0.35,
          ease: [0.25, 0.46, 0.45, 0.94],
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={() => !isMobile && setIsHovered(true)}
        onTouchEnd={() => !isMobile && setTimeout(() => setIsHovered(false), 150)}
        onClick={onClick}
      >
        {/* Превью: img для надёжной загрузки на мобильных, плейсхолдер пока грузится */}
        <motion.div
          className="absolute inset-0 z-0 bg-slate-200/80 overflow-hidden"
          animate={{ scale: isMobile ? 1 : isHovered ? 1.08 : 1 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
        >
          <img
            src={imgError ? 'https://via.placeholder.com/270x360' : proxyImageUrl(thumbnailUrl)}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onError={() => setImgError(true)}
          />
        </motion.div>

        {/* Gradient overlay */}
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
        <div className="relative flex flex-col justify-end h-full p-3 md:p-4 z-20 text-white min-h-0">
          {/* Top badges */}
          <div className="absolute top-2 md:top-3 left-2 md:left-3 right-2 md:right-3 flex items-center justify-between gap-1">
            {/* Badges container */}
            <div className="flex items-center gap-1 md:gap-1.5 flex-wrap">
              {/* Viral badge */}
              <motion.div
                className={cn(
                  "px-1.5 md:px-2.5 py-0.5 md:py-1 rounded-pill backdrop-blur-[20px] backdrop-saturate-[180%] flex items-center gap-1 md:gap-1.5",
                  "border border-white/20",
                  "shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.25)]",
                  viralCoef > 10 ? "bg-accent-positive/90 text-white" : 
                  viralCoef > 5 ? "bg-amber-400/80 text-slate-800" :
                  viralCoef > 0 ? "bg-white/80 text-slate-700" :
                  "bg-black/40 text-white/80"
                )}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <Sparkles className="w-2.5 h-2.5 md:w-3 md:h-3 flex-shrink-0" strokeWidth={2} />
                <span className="text-[10px] md:text-xs font-semibold whitespace-nowrap tabular-nums">{viralCoef > 0 ? Math.round(viralCoef) : '—'}</span>
              </motion.div>
              
              {/* Viral multiplier badge (отдельно рядом) */}
              {viralMultiplier !== null && viralMultiplier !== undefined && (
                <motion.div
                  className={cn(
                    "px-1.5 md:px-2 py-0.5 md:py-1 rounded-pill backdrop-blur-[20px] backdrop-saturate-[180%] flex items-center gap-0.5 md:gap-1",
                    "border border-white/20",
                    "shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.25)]",
                    viralMultiplier >= 10 ? "bg-accent-negative/90 text-white" :
                    viralMultiplier >= 5 ? "bg-amber-400/80 text-slate-800" :
                    viralMultiplier >= 3 ? "bg-accent-positive/80 text-white" :
                    viralMultiplier >= 2 ? "bg-accent-positive/70 text-white" :
                    viralMultiplier >= 1.5 ? "bg-accent-positive/60 text-white" :
                    "bg-slate-500/80 text-white"
                  )}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  title={`В ${Math.round(viralMultiplier)}x раз ${viralMultiplier >= 1 ? 'больше' : 'меньше'} среднего у автора`}
                >
                  <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3 flex-shrink-0" strokeWidth={2} />
                  <span className="text-[9px] md:text-[10px] font-semibold whitespace-nowrap tabular-nums">{Math.round(viralMultiplier)}x</span>
                </motion.div>
              )}
            </div>
            
            {/* Menu button — на мобильных всегда виден, на десктопе при наведении */}
            {onFolderMenuToggle && (
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  onFolderMenuToggle();
                }}
                className={cn(
                  "p-2.5 min-w-[44px] min-h-[44px] rounded-full backdrop-blur-sm transition-all touch-manipulation flex items-center justify-center",
                  "max-md:!opacity-100 max-md:bg-black/40 max-md:text-white",
                  showFolderMenu 
                    ? "bg-white text-slate-800" 
                    : "bg-black/30 text-white hover:bg-white/20"
                )}
                initial={{ opacity: 0 }}
                animate={{ opacity: isMobile || isHovered || showFolderMenu ? 1 : 0 }}
                transition={{ duration: 0.15 }}
              >
                <MoreVertical className="w-4 h-4 md:w-4 md:h-4" strokeWidth={2.5} />
              </motion.button>
            )}
            
            {/* Date badge - если нет кнопки меню */}
            {date && !onFolderMenuToggle && (
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


          {/* Bottom content */}
          <div>
            {/* Username as iOS 26 button - маленький и белый */}
            <motion.div
              className="px-2 py-0.5 md:px-2.5 md:py-1 rounded-pill backdrop-blur-[20px] backdrop-saturate-[180%] flex items-center gap-1 border border-white/30 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.3)] bg-white/20 mb-2 inline-flex max-w-full"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15 }}
            >
              <span className="text-[9px] md:text-[10px] font-semibold text-white/90 truncate max-w-[100px] md:max-w-[120px]">@{username || 'instagram'}</span>
              {viralCoef > 5 && (
                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <svg className="w-1.5 h-1.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </motion.div>

            {/* Stats line with icons - iOS 26 style liquid glass buttons */}
            <div className="flex items-center gap-1.5 md:gap-2 mb-2 flex-wrap">
              {viewCount !== undefined && (
                <motion.div
                  className="px-2 py-1 md:px-2.5 md:py-1.5 rounded-pill backdrop-blur-[20px] backdrop-saturate-[180%] flex items-center gap-1 border border-white/30 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.3)] bg-white/20"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                >
                  <Eye className="w-2.5 h-2.5 md:w-3 md:h-3 flex-shrink-0" strokeWidth={2} />
                  <span className="text-[10px] md:text-[11px] font-semibold text-white/90 whitespace-nowrap tabular-nums">{formatNumber(viewCount)}</span>
                </motion.div>
              )}
              {likeCount !== undefined && (
                <motion.div
                  className="px-2 py-1 md:px-2.5 md:py-1.5 rounded-pill backdrop-blur-[20px] backdrop-saturate-[180%] flex items-center gap-1 border border-white/30 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.3)] bg-white/20"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.25 }}
                >
                  <Heart className="w-2.5 h-2.5 md:w-3 md:h-3 flex-shrink-0" strokeWidth={2} />
                  <span className="text-[10px] md:text-[11px] font-semibold text-white/90 whitespace-nowrap tabular-nums">{formatNumber(likeCount)}</span>
                </motion.div>
              )}
              {commentCount !== undefined && (
                <motion.div
                  className="px-2 py-1 md:px-2.5 md:py-1.5 rounded-pill backdrop-blur-[20px] backdrop-saturate-[180%] flex items-center gap-1 border border-white/30 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.3)] bg-white/20"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <MessageCircle className="w-2.5 h-2.5 md:w-3 md:h-3 flex-shrink-0" strokeWidth={2} />
                  <span className="text-[10px] md:text-[11px] font-semibold text-white/90 whitespace-nowrap tabular-nums">{formatNumber(commentCount)}</span>
                </motion.div>
              )}
              {date && (
                <motion.div
                  className="px-2.5 py-1.5 rounded-pill backdrop-blur-[20px] backdrop-saturate-[180%] flex items-center gap-1.5 border border-white/30 shadow-[0_2px_8px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.3)] bg-white/20"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35 }}
                >
                  <Calendar className="w-3 h-3 flex-shrink-0" strokeWidth={2} />
                  <span className="text-[11px] font-semibold text-white/90">{date}</span>
                </motion.div>
              )}
            </div>

            {/* Transcript status badge */}
            {transcriptStatus && transcriptStatus !== 'completed' && (
              <div className="mb-2">
                <span 
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-semibold backdrop-blur-sm",
                    transcriptStatus === 'error' || transcriptStatus === 'timeout'
                      ? "bg-red-500/20 text-red-200 border border-red-500/30"
                      : "bg-violet-500/20 text-violet-200 border border-violet-500/30"
                  )}
                >
                  {transcriptStatus === 'downloading' && (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2.5} />
                      Скачивание...
                    </>
                  )}
                  {transcriptStatus === 'processing' && (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2.5} />
                      Транскрибация...
                    </>
                  )}
                  {transcriptStatus === 'queued' && (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2.5} />
                      В очереди...
                    </>
                  )}
                  {transcriptStatus === 'error' && (
                    <>
                      <AlertCircle className="w-3 h-3" strokeWidth={2.5} />
                      Ошибка
                    </>
                  )}
                  {transcriptStatus === 'timeout' && (
                    <>
                      <AlertCircle className="w-3 h-3" strokeWidth={2.5} />
                      Таймаут
                    </>
                  )}
                </span>
              </div>
            )}

            {/* Transcript completed badge */}
            {transcriptStatus === 'completed' && (
              <div className="mb-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-500/20 text-emerald-200 border border-emerald-500/30">
                  <FileText className="w-3 h-3" strokeWidth={2.5} />
                  Текст готов
                </span>
              </div>
            )}

            {/* Folder badge - показывает в какой папке находится видео */}
            {folderBadge && !transcriptStatus && (
              <div className="mb-2">
                <span 
                  className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold"
                  style={{ 
                    backgroundColor: folderBadge.color + '30',
                    color: 'white',
                    border: `1px solid ${folderBadge.color}50`
                  }}
                >
                  {folderBadge.name}
                </span>
              </div>
            )}

            {/* Caption */}
            {caption && !folderBadge && (
              <p className="text-white/60 text-xs leading-relaxed line-clamp-2 mb-3 break-words overflow-hidden">
                {caption}
              </p>
            )}

            {/* Action button - для добавления (когда нет folderMenu) */}
            {onAdd && !onFolderMenuToggle && (
              <motion.button
                onClick={(e) => {
                  e.stopPropagation();
                  onAdd();
                }}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all"
                whileTap={{ scale: 0.98 }}
              >
                <span className="text-sm font-semibold">Добавить</span>
                <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
              </motion.button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default VideoGradientCard;
