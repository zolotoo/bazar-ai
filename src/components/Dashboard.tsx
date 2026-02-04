'use client';

import { motion } from 'framer-motion';
import { Link, Radar, LayoutGrid, FileText, Users, ArrowRight } from 'lucide-react';
import { cn } from '../utils/cn';

const DISPLAY_NAME_KEY = 'riri-display-name';
const ONBOARDING_DONE_KEY = 'riri-onboarding-done';

export function getDisplayName(): string | null {
  try {
    return localStorage.getItem(DISPLAY_NAME_KEY);
  } catch {
    return null;
  }
}

export function setDisplayName(name: string): void {
  try {
    localStorage.setItem(DISPLAY_NAME_KEY, name.trim());
    localStorage.setItem(ONBOARDING_DONE_KEY, '1');
  } catch {}
}

export function isOnboardingDone(): boolean {
  try {
    return !!localStorage.getItem(ONBOARDING_DONE_KEY);
  } catch {
    return false;
  }
}

/** Приветствие по времени МСК */
function getGreeting(): string {
  const msk = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow', hour: 'numeric' });
  const h = parseInt(msk, 10);
  if (h >= 5 && h < 12) return 'Доброе утро';
  if (h >= 12 && h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

interface DashboardProps {
  onOpenSearch: (tab: 'link' | 'radar') => void;
  onOpenFeed: () => void;
  onOpenTeam: () => void;
  videosCount?: number;
}

const SECTIONS = [
  {
    id: 'link',
    title: 'Найти ролик по ссылке',
    subtitle: 'Вставь ссылку на Instagram — получи данные и сохрани',
    icon: Link,
    gradient: 'from-blue-400 via-blue-500 to-blue-600',
    shadow: 'shadow-blue-500/20',
    onClick: (onOpenSearch: (t: 'link') => void) => onOpenSearch('link'),
  },
  {
    id: 'radar',
    title: 'Добавить в радар',
    subtitle: 'Отслеживай новые видео с профилей',
    icon: Radar,
    gradient: 'from-emerald-400 via-emerald-500 to-emerald-600',
    shadow: 'shadow-emerald-500/20',
    onClick: (onOpenSearch: (t: 'radar') => void) => onOpenSearch('radar'),
  },
  {
    id: 'feed',
    title: 'Мини лента',
    subtitle: 'Твои сохранённые видео по папкам',
    icon: LayoutGrid,
    gradient: 'from-slate-500 via-slate-600 to-slate-700',
    shadow: 'shadow-slate-500/20',
    onClick: (onOpenFeed: () => void) => onOpenFeed(),
  },
  {
    id: 'script',
    title: 'ИИ-сценарист',
    subtitle: 'Сценарии по стилю и примерам',
    icon: FileText,
    gradient: 'from-rose-700 via-rose-800 to-rose-900',
    shadow: 'shadow-rose-700/25',
    onClick: (onOpenFeed: () => void) => onOpenFeed(),
  },
  {
    id: 'team',
    title: 'Команда',
    subtitle: 'Участники проекта и приглашения',
    icon: Users,
    gradient: 'from-violet-500 via-violet-600 to-violet-700',
    shadow: 'shadow-violet-500/20',
    onClick: (onOpenTeam: () => void) => onOpenTeam(),
  },
];

export function Dashboard({ onOpenSearch, onOpenFeed, onOpenTeam, videosCount = 0 }: DashboardProps) {
  const displayName = getDisplayName();
  const greeting = getGreeting();
  const name = displayName || 'друг';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-4 md:px-6 py-6 md:py-8 safe-top safe-bottom safe-left safe-right custom-scrollbar-light">
      <div className="max-w-4xl mx-auto">
        {/* Greeting */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="mb-8 md:mb-10"
        >
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-1">
            {greeting}, {name}
          </h1>
          <p className="text-slate-500 text-base md:text-lg">
            Что хочешь сделать сегодня?
          </p>
        </motion.div>

        {/* Main action cards — 2 large */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5 mb-6">
          {SECTIONS.slice(0, 2).map((section, i) => (
            <DashboardCard
              key={section.id}
              section={section}
              index={i}
              onAction={() => {
                if (section.id === 'link' || section.id === 'radar') {
                  onOpenSearch(section.id as 'link' | 'radar');
                } else {
                  onOpenFeed();
                }
              }}
            />
          ))}
        </div>

        {/* Secondary cards — 3 smaller */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {SECTIONS.slice(2).map((section, i) => (
            <DashboardCard
              key={section.id}
              section={section}
              index={i + 2}
              compact
              badge={section.id === 'feed' ? videosCount : undefined}
              onAction={() => {
                if (section.id === 'team') {
                  onOpenTeam();
                } else {
                  onOpenFeed();
                }
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface DashboardCardProps {
  section: (typeof SECTIONS)[0];
  index: number;
  compact?: boolean;
  badge?: number;
  onAction: () => void;
}

function DashboardCard({ section, index, compact, badge, onAction }: DashboardCardProps) {
  const Icon = section.icon;
  const isAccentCard = !compact && index < 2; // Первые 2 карточки — полный градиент

  return (
    <motion.button
      type="button"
      onClick={onAction}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={cn(
        'group',
        'relative rounded-2xl md:rounded-3xl overflow-hidden text-left',
        isAccentCard
          ? cn(
              'bg-gradient-to-br text-white border border-white/30',
              section.gradient,
              'shadow-[0_12px_40px_rgba(0,0,0,0.12),inset_0_1px_0_rgba(255,255,255,0.3)]',
              'hover:shadow-[0_20px_56px_rgba(0,0,0,0.15),inset_0_1px_0_rgba(255,255,255,0.4)]'
            )
          : cn(
              'bg-white/70 backdrop-blur-xl border border-white/60',
              'shadow-[0_8px_32px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.8)]',
              'hover:shadow-[0_16px_48px_rgba(0,0,0,0.08),0_4px_16px_rgba(0,0,0,0.05),inset_0_1px_0_rgba(255,255,255,0.9)]'
            ),
        'active:scale-[0.99] transition-all duration-300',
        'touch-manipulation',
        compact ? 'p-5 min-h-[140px]' : 'p-6 md:p-8 min-h-[180px]'
      )}
    >
      {!isAccentCard && (
        <div
          className={cn(
            'absolute top-0 left-0 right-0 h-1.5 md:h-2 bg-gradient-to-r',
            section.gradient
          )}
        />
      )}

      <div className={cn('flex flex-col', compact ? 'gap-2' : 'gap-4')}>
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              'rounded-xl flex items-center justify-center flex-shrink-0',
              isAccentCard ? 'bg-white/25' : 'bg-gradient-to-br text-white',
              !isAccentCard && section.gradient,
              compact ? 'w-10 h-10' : 'w-12 h-12'
            )}
          >
            <Icon className={cn(compact ? 'w-5 h-5' : 'w-6 h-6', 'text-white')} strokeWidth={2.5} />
          </div>
          {badge !== undefined && badge > 0 && (
            <span className={cn(
              'px-2.5 py-1 rounded-full text-xs font-semibold tabular-nums',
              isAccentCard ? 'bg-white/30 text-white' : 'bg-white/90 text-slate-700'
            )}>
              {badge}
            </span>
          )}
        </div>

        <div>
          <h3 className={cn(
            'font-semibold',
            isAccentCard ? 'text-white' : 'text-slate-800',
            compact ? 'text-sm' : 'text-lg md:text-xl'
          )}>
            {section.title}
          </h3>
          <p className={cn(
            'mt-0.5',
            isAccentCard ? 'text-white/90' : 'text-slate-500',
            compact ? 'text-xs' : 'text-sm'
          )}>
            {section.subtitle}
          </p>
        </div>

        <div className={cn(
          'mt-auto flex items-center gap-1.5 font-medium',
          isAccentCard ? 'text-white/95' : 'text-slate-600 group-hover:text-slate-800'
        )}>
          <span className={compact ? 'text-xs' : 'text-sm'}>
            {section.id === 'link' || section.id === 'radar' ? 'Открыть' : 'Перейти'}
          </span>
          <ArrowRight className={cn('group-hover:translate-x-0.5 transition-transform', compact ? 'w-3.5 h-3.5' : 'w-4 h-4')} />
        </div>
      </div>
    </motion.button>
  );
}
