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

const GRADIENT_CARDS = [
  {
    id: 'link',
    title: 'Найти ролик по ссылке',
    subtitle: 'Вставь ссылку на Instagram — получи данные и сохрани',
    icon: Link,
    gradient: 'from-blue-500 via-blue-600 to-blue-700',
    cta: 'Открыть',
    onAction: (fn: (t: 'link') => void) => fn('link'),
  },
  {
    id: 'radar',
    title: 'Добавить в радар',
    subtitle: 'Отслеживай новые видео с профилей',
    icon: Radar,
    gradient: 'from-emerald-500 via-emerald-600 to-emerald-700',
    cta: 'Открыть',
    onAction: (fn: (t: 'radar') => void) => fn('radar'),
  },
];

const WHITE_CARDS = [
  { id: 'feed', title: 'Мини лента', subtitle: 'Твои сохранённые видео по папкам', icon: LayoutGrid, onAction: (fn: () => void) => fn() },
  { id: 'script', title: 'ИИ-сценарист', subtitle: 'Сценарии по стилю и примерам', icon: FileText, onAction: (fn: () => void) => fn() },
  { id: 'team', title: 'Команда', subtitle: 'Участники проекта и приглашения', icon: Users, onAction: (fn: () => void) => fn() },
];

export function Dashboard({ onOpenSearch, onOpenFeed, onOpenTeam, videosCount = 0 }: DashboardProps) {
  const displayName = getDisplayName();
  const greeting = getGreeting();
  const name = displayName || 'друг';

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden bg-[#fafafa] safe-top safe-bottom safe-left safe-right custom-scrollbar-light">
      {/* Main content card — floating white container like reference */}
      <div className="mx-4 md:mx-6 lg:mx-8 py-6 md:py-8 lg:py-10">
        <div className="max-w-5xl mx-auto">
          <div
            className="bg-white rounded-3xl p-6 md:p-8 lg:p-10"
            style={{
              boxShadow: '0 4px 24px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
            }}
          >
            {/* Greeting — friendly headline */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="mb-8 md:mb-10"
            >
              <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-1">
                {greeting}, {name}
              </h1>
              <p className="text-slate-500 text-base md:text-lg font-normal">
                Что хочешь сделать сегодня?
              </p>
            </motion.div>

            {/* Two main gradient action cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6 mb-8">
              {GRADIENT_CARDS.map((card, i) => (
                <motion.div
                  key={card.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: i * 0.05 }}
                  className={cn(
                    'relative rounded-2xl md:rounded-3xl overflow-hidden',
                    'bg-gradient-to-br text-white',
                    card.gradient
                  )}
                  style={{
                    boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 4px 12px rgba(0,0,0,0.08)',
                  }}
                >
                  <div className="p-6 md:p-8 flex flex-col h-full min-h-[200px] md:min-h-[220px]">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                        <card.icon className="w-6 h-6" strokeWidth={2.5} />
                      </div>
                    </div>
                    <h3 className="text-lg md:text-xl font-bold mb-2">{card.title}</h3>
                    <p className="text-white/90 text-sm md:text-base mb-6 flex-1">
                      {card.subtitle}
                    </p>
                    <button
                      type="button"
                      onClick={() => card.onAction(onOpenSearch)}
                      className="self-start px-5 py-2.5 rounded-xl bg-white/25 hover:bg-white/30 text-white font-semibold text-sm flex items-center gap-2 transition-colors"
                    >
                      {card.cta}
                      <ArrowRight className="w-4 h-4" strokeWidth={2.5} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Three white cards below — clean, soft shadow */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-5">
              {WHITE_CARDS.map((card, i) => (
                <motion.button
                  key={card.id}
                  type="button"
                  onClick={() => (card.id === 'team' ? onOpenTeam() : onOpenFeed())}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 + i * 0.05 }}
                  className="bg-white rounded-2xl p-5 md:p-6 text-left border border-slate-100 hover:border-slate-200 transition-colors group"
                  style={{
                    boxShadow: '0 2px 12px rgba(0,0,0,0.04), 0 1px 4px rgba(0,0,0,0.02)',
                  }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <card.icon className="w-5 h-5 text-slate-600" strokeWidth={2.5} />
                    </div>
                    {card.id === 'feed' && videosCount > 0 && (
                      <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold tabular-nums">
                        {videosCount}
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-slate-800 text-sm md:text-base mb-1">
                    {card.title}
                  </h3>
                  <p className="text-slate-500 text-xs md:text-sm mb-4">{card.subtitle}</p>
                  <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium text-sm group-hover:text-slate-800 transition-colors">
                    Перейти
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </motion.button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
