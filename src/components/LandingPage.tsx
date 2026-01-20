import { useState, useEffect } from 'react';
import { ArrowRight, Search, Sparkles, TrendingUp, Video, Zap } from 'lucide-react';
import { cn } from '../utils/cn';

interface LandingPageProps {
  onEnter: () => void;
  onOpenSearch: () => void;
}

export function LandingPage({ onEnter, onOpenSearch }: LandingPageProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typingText, setTypingText] = useState('');
  const placeholders = [
    'Найти вирусные рилсы про маркетинг...',
    'Топовые видео про стартапы...',
    'Трендовые рилсы про AI...',
    'Популярные видео про бизнес...',
  ];
  const [placeholderIndex, setPlaceholderIndex] = useState(0);

  useEffect(() => {
    const text = placeholders[placeholderIndex];
    let charIndex = 0;
    setTypingText('');

    const typeInterval = setInterval(() => {
      if (charIndex < text.length) {
        setTypingText(text.slice(0, charIndex + 1));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setTimeout(() => {
          setPlaceholderIndex((prev) => (prev + 1) % placeholders.length);
        }, 2000);
      }
    }, 50);

    return () => clearInterval(typeInterval);
  }, [placeholderIndex]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      onOpenSearch();
    }
  };

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-[#f5f5f5]">
      {/* Clean gradient blobs - white, orange, black */}
      <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-bl from-orange-500/40 via-orange-400/20 to-transparent rounded-full blur-[100px]" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-tr from-neutral-900/20 via-neutral-800/10 to-transparent rounded-full blur-[120px]" />
      <div className="absolute top-[40%] left-[30%] w-[40%] h-[40%] bg-gradient-to-r from-orange-400/25 via-orange-500/15 to-neutral-900/10 rounded-full blur-[80px]" />
      
      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
      }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-16">
        {/* Badge */}
        <div className="mb-6 px-4 py-1.5 rounded-full glass">
          <span className="text-sm text-orange-600 font-semibold tracking-wide">
            ✨ AI ПОИСК КОНТЕНТА
          </span>
        </div>

        {/* Main Heading */}
        <h1 className="text-center mb-5">
          <span className="block text-5xl md:text-7xl font-serif italic text-neutral-900 tracking-tighter">
            Найди
          </span>
          <span className="block text-5xl md:text-7xl font-light text-orange-500 tracking-tight">
            свой контент
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-center text-slate-600 text-base md:text-lg max-w-lg mb-2">
          <span className="text-slate-800 font-semibold">Bazar AI</span> — персональный ассистент для поиска вирусного контента
        </p>
        <p className="text-center text-slate-500 text-sm max-w-md mb-8">
          Ищи трендовые видео, сохраняй идеи, создавай сценарии
        </p>

        {/* CTA Button */}
        <button
          onClick={onEnter}
          className={cn(
            "group px-6 py-3 rounded-xl mb-10",
            "bg-gradient-to-r from-orange-500 to-amber-600",
            "hover:from-orange-400 hover:to-amber-500",
            "text-white font-semibold text-sm",
            "transition-all duration-300",
            "shadow-2xl shadow-orange-900/60",
            "flex items-center gap-2"
          )}
        >
          НАЧАТЬ РАБОТУ
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>

        {/* Search Bar */}
        <div className="w-full max-w-xl mb-6">
          <div className="glass rounded-xl shadow-xl shadow-orange-500/10">
            <div className="flex items-center gap-3 px-5 py-3">
              <Search className="w-5 h-5 text-orange-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={typingText}
                className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 text-base outline-none"
              />
              <button
                onClick={handleSearch}
                className="p-2.5 rounded-lg bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-white transition-all shadow-lg shadow-orange-500/30"
              >
                <Search className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Tagline */}
        <p className="text-slate-500 text-xs mb-10">
          Ищи тренды • Сохраняй идеи • Создавай контент
        </p>

        {/* Features */}
        <div className="flex flex-wrap justify-center gap-5 md:gap-10">
          <Feature icon={TrendingUp} label="Трендовые видео" />
          <Feature icon={Sparkles} label="AI рекомендации" />
          <Feature icon={Video} label="1M+ рилсов" />
          <Feature icon={Zap} label="Мгновенный поиск" />
        </div>
      </div>
    </div>
  );
}

function Feature({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 text-slate-600">
      <div className="p-2 rounded-lg glass-button">
        <Icon className="w-3.5 h-3.5 text-orange-500" />
      </div>
      <span className="text-xs font-medium">{label}</span>
    </div>
  );
}
