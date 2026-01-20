import React from 'react';
import { X, ExternalLink, Loader2, Video, Eye, Heart, Sparkles } from 'lucide-react';
import { IncomingVideo } from '../../types';
import { useFlowStore } from '../../stores/flowStore';
import { useInboxVideos } from '../../hooks/useInboxVideos';
import { cn } from '../../utils/cn';

interface IncomingVideosDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function IncomingVideosDrawer({ isOpen, onClose }: IncomingVideosDrawerProps) {
  const { incomingVideos } = useFlowStore();
  const { loading } = useInboxVideos();

  const handleDragStart = (e: React.DragEvent, video: IncomingVideo) => {
    e.dataTransfer.setData('application/reactflow/video', JSON.stringify(video));
    e.dataTransfer.effectAllowed = 'move';
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/20 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-[90%] max-w-sm z-50',
          'bg-[#f5f5f5]',
          'transform transition-transform duration-300 ease-in-out',
          'flex flex-col shadow-2xl shadow-black/20'
        )}
      >
        {/* Gradient blob inside drawer */}
        <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-gradient-to-bl from-orange-500/30 to-transparent rounded-full blur-[60px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[150px] h-[150px] bg-gradient-to-tr from-neutral-900/10 to-transparent rounded-full blur-[50px] pointer-events-none" />
        
        {/* Header */}
        <div className="flex items-center justify-between p-5 relative z-10">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/30">
              <Video className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-base text-slate-800 font-serif italic tracking-tighter leading-none">Входящие</h2>
              <p className="text-[10px] text-slate-500 leading-none mt-0.5">Перетащите на холст</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl glass text-slate-500 hover:text-slate-700 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar-light p-4 relative z-10">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full gap-3">
              <div className="p-4 rounded-xl bg-orange-100">
                <Loader2 className="w-7 h-7 animate-spin text-orange-500" />
              </div>
              <p className="text-sm text-slate-500">Загрузка...</p>
            </div>
          ) : incomingVideos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3">
              <div className="p-5 rounded-2xl glass">
                <Sparkles className="w-10 h-10 text-orange-500" />
              </div>
              <div>
                <p className="text-slate-700 font-medium text-sm leading-tight">Нет видео</p>
                <p className="text-[11px] text-slate-500 mt-1 leading-tight">Добавьте через поиск</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {incomingVideos.map((video) => {
                const videoData = video as any;
                
                return (
                  <div
                    key={video.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, video)}
                    className={cn(
                      'group overflow-hidden rounded-3xl',
                      'cursor-grab active:cursor-grabbing',
                      'shadow-lg hover:shadow-xl',
                      'transition-all duration-300 hover:scale-[1.02]'
                    )}
                  >
                    <div className="relative aspect-[9/16] overflow-hidden">
                      <img
                        src={video.previewUrl || 'https://via.placeholder.com/320x500'}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        onError={(e) => { e.currentTarget.src = 'https://via.placeholder.com/320x500'; }}
                      />
                      
                      {/* Top badge */}
                      <div className="absolute top-3 left-3">
                        <div className="px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm flex items-center gap-1.5 shadow-md">
                          <div className="w-2 h-2 rounded-full bg-emerald-500" />
                          <span className="text-xs font-medium text-slate-700">Готово</span>
                        </div>
                      </div>

                      {/* Bottom glass panel */}
                      <div className="absolute bottom-0 left-0 right-0">
                        {/* Avatar */}
                        <div className="flex justify-center -mb-3 relative z-10">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-400 to-pink-500 ring-2 ring-white flex items-center justify-center">
                            <span className="text-white text-xs font-bold">
                              {video.title?.charAt(0)?.toUpperCase() || 'V'}
                            </span>
                          </div>
                        </div>
                        
                        {/* Glass info panel */}
                        <div className="bg-white/70 backdrop-blur-xl p-4 pt-5">
                          <h3 className="text-center font-semibold text-slate-900 text-sm leading-tight mb-1 line-clamp-2">
                            {video.title?.slice(0, 40)}...
                          </h3>
                          
                          {/* Stats */}
                          <div className="flex items-center justify-center gap-3 text-slate-600 text-xs mt-2">
                            <span className="flex items-center gap-1">
                              <Eye className="w-3.5 h-3.5" />
                              {formatNumber(videoData.view_count)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Heart className="w-3.5 h-3.5" />
                              {formatNumber(videoData.like_count)}
                            </span>
                          </div>
                          
                          {/* Open button */}
                          <a
                            href={video.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Открыть
                          </a>
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
    </>
  );
}
