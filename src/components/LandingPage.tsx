import { useState } from 'react';
import { ArrowRight, ArrowLeft, Sparkles, TrendingUp, Video, Zap, Send, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { useAuth } from '../hooks/useAuth';
import ScrollMorphHero from './ui/ScrollMorphHero';
import { GlassCardStatic } from './ui/GlassCard';

export function LandingPage() {
  const [showAuth, setShowAuth] = useState(false);
  const [showHero, setShowHero] = useState(false); // Отключаем заставку
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');
  const { sendCode, verifyCode, sendingCode, verifying, error, codeSent, resetAuth } = useAuth();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendCode(username);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyCode(code);
  };

  const handleBack = () => {
    resetAuth();
    setShowAuth(false);
    setUsername('');
    setCode('');
  };

  // Show hero animation on first visit
  if (showHero && !showAuth) {
    return (
      <div className="relative w-full h-screen">
        <ScrollMorphHero 
          title="Найдите вирусный контент"
          subtitle="ПРОКРУТИТЕ ВНИЗ"
          activeTitle="Bazar AI"
          activeSubtitle="Платформа для поиска трендового контента из Instagram. Анализируйте, сохраняйте и создавайте свой контент."
        />
        {/* Skip button */}
        <button
          onClick={() => setShowHero(false)}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 px-6 py-3 rounded-card-xl bg-slate-600 text-white font-medium shadow-glass hover:shadow-glass-hover transition-all flex items-center gap-2 group"
        >
          Начать
          <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full min-h-screen overflow-hidden bg-base">
      {/* Subtle dusty gray blobs */}
      <div className="absolute top-[-15%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-bl from-slate-200/30 via-slate-100/15 to-transparent rounded-full blur-[100px]" />
      <div className="absolute bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-tr from-slate-100/20 via-slate-50/10 to-transparent rounded-full blur-[120px]" />
      
      {/* Noise texture */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
      }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen px-6 py-16 safe-top safe-bottom safe-left safe-right">
        {!showAuth ? (
          // Landing content
          <>
            {/* Badge — floating pill */}
            <div className="mb-8 px-5 py-2 rounded-pill bg-glass-white/80 backdrop-blur-glass shadow-glass-sm border border-white/[0.4]">
              <span className="text-sm text-slate-600 font-semibold tracking-wide">
                AI-ПОИСК КОНТЕНТА
              </span>
            </div>

            {/* Main Heading */}
            <h1 className="text-center mb-5">
              <span className="block text-4xl md:text-5xl lg:text-7xl font-bold text-slate-800">
                Найди
              </span>
              <span className="block text-4xl md:text-5xl lg:text-7xl font-light text-slate-600 tracking-tight">
                свой контент
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-center text-slate-600 text-base md:text-lg max-w-lg mb-2">
              <span className="text-slate-800 font-semibold">Bazar AI</span> — персональный ассистент для поиска вирусного контента
            </p>
            <p className="text-center text-slate-500 text-sm max-w-md mb-12">
              Ищи трендовые видео, сохраняй идеи, создавай сценарии
            </p>

            {/* CTA Button */}
            <button
              onClick={() => setShowAuth(true)}
              className={cn(
                "group px-8 py-4 rounded-card-xl mb-14",
                "bg-slate-600 hover:bg-slate-700",
                "active:scale-95",
                "text-white font-semibold text-base",
                "transition-all duration-300",
                "shadow-glass hover:shadow-glass-hover",
                "flex items-center gap-3",
                "min-h-[44px]", // iOS touch target
                "touch-manipulation"
              )}
            >
              НАЧАТЬ РАБОТУ
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Features — floating pills */}
            <div className="flex flex-wrap justify-center gap-6 md:gap-8">
              <Feature icon={TrendingUp} label="Трендовые видео" />
              <Feature icon={Sparkles} label="AI рекомендации" />
              <Feature icon={Video} label="1M+ рилсов" />
              <Feature icon={Zap} label="Мгновенный поиск" />
            </div>
          </>
        ) : (
          // Auth form
          <div className="w-full max-w-md">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-slate-500 hover:text-slate-700 mb-6 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Назад
            </button>

            <GlassCardStatic className="p-8 md:p-10">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-card-xl bg-slate-500 flex items-center justify-center mx-auto mb-5 shadow-glass">
                  <Video className="w-8 h-8 text-white" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-1">
                  Вход в Bazar AI
                </h2>
                <p className="text-sm text-slate-500">
                  Авторизуйся через Telegram
                </p>
              </div>

              <div className="space-y-5">
              {!codeSent ? (
                // Step 1: Enter username
                <form onSubmit={handleSendCode} className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Telegram username
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">@</span>
                      <input
                        type="text"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="username"
                        className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200/50 outline-none transition-all bg-white"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={sendingCode || !username.trim()}
                    className={cn(
                      "w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                      sendingCode || !username.trim()
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-slate-600 hover:bg-slate-700 text-white shadow-glass hover:shadow-glass-hover"
                    )}
                  >
                    {sendingCode ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Отправка...
                      </>
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Получить код
                      </>
                    )}
                  </button>

                  {/* Bot hint */}
                  <div className="p-4 rounded-xl bg-slate-100/60 border border-slate-200/60">
                    <div className="flex items-start gap-3">
                      <Sparkles className="w-5 h-5 text-slate-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">Важно!</p>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Сначала напишите /start боту{' '}
                          <a 
                            href="https://t.me/bazarai_bot" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-medium underline"
                          >
                            @bazarai_bot
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                </form>
              ) : (
                // Step 2: Enter code
                <form onSubmit={handleVerifyCode} className="space-y-5">
                  <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 mb-4">
                    <p className="text-sm text-emerald-700">
                      Код отправлен в Telegram на @{username.replace('@', '')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Код из Telegram
                    </label>
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength={6}
                      className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-slate-400 focus:ring-2 focus:ring-slate-200/50 outline-none transition-all text-center text-2xl font-mono tracking-widest bg-white"
                    />
                  </div>

                  {error && (
                    <div className="p-3 rounded-xl bg-red-50 border border-red-200">
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={verifying || code.length !== 6}
                    className={cn(
                      "w-full py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2",
                      verifying || code.length !== 6
                        ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                        : "bg-slate-600 hover:bg-slate-700 text-white shadow-glass hover:shadow-glass-hover"
                    )}
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Проверка...
                      </>
                    ) : (
                      'Войти'
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => resetAuth()}
                    className="w-full text-sm text-slate-500 hover:text-slate-700"
                  >
                    Изменить username
                  </button>
                </form>
              )}
              </div>
            </GlassCardStatic>
          </div>
        )}
      </div>
    </div>
  );
}

function Feature({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-3 text-slate-600">
      <div className="p-2.5 rounded-pill bg-glass-white/80 backdrop-blur-glass shadow-glass-sm border border-white/[0.4]">
        <Icon className="w-4 h-4 text-slate-600" />
      </div>
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}
