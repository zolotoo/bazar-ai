import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/cn';
import { ProjectPresence } from '../hooks/useProjectPresence';

interface PresenceIndicatorProps {
  presence: ProjectPresence[];
  getUsername: (userId: string) => string;
}

export function PresenceIndicator({ presence, getUsername }: PresenceIndicatorProps) {
  if (presence.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-40 flex items-center gap-2">
      <AnimatePresence>
        {presence.slice(0, 5).map((p) => {
          const username = getUsername(p.user_id);
          const initials = username[0].toUpperCase();
          
          return (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, scale: 0.8, x: 20 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 20 }}
              className="relative group"
            >
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#f97316] via-[#fb923c] to-[#fdba74] flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-[#f97316]/30 border-2 border-white/80 backdrop-blur-sm">
                {initials}
              </div>
              {/* Индикатор активности */}
              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white shadow-sm animate-pulse" />
              
              {/* Tooltip */}
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-slate-900/90 backdrop-blur-sm text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                @{username}
                {p.entity_type && (
                  <span className="block text-slate-400 text-[10px] mt-0.5">
                    {p.entity_type === 'video' ? 'Смотрит видео' : 'Работает над проектом'}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
      
      {presence.length > 5 && (
        <div className="w-10 h-10 rounded-full bg-slate-200/80 backdrop-blur-sm flex items-center justify-center text-slate-600 text-xs font-semibold border-2 border-white/80">
          +{presence.length - 5}
        </div>
      )}
    </div>
  );
}
