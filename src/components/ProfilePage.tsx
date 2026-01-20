import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { useFlowStore } from '../stores/flowStore';
import { 
  User, 
  LogOut, 
  Search, 
  Video, 
  Clock, 
  Shield, 
  Sparkles,
  ChevronRight,
  Settings,
  Bell,
  HelpCircle,
  Send,
  ArrowLeft,
  Loader2
} from 'lucide-react';
import { cn } from '../utils/cn';

export function ProfilePage() {
  const { 
    user, 
    isAuthenticated, 
    sendCode, 
    verifyCode, 
    resetAuth,
    logout, 
    sendingCode, 
    verifying, 
    error, 
    codeSent 
  } = useAuth();
  const { historyEntries } = useSearchHistory();
  const { incomingVideos } = useFlowStore();
  
  const [username, setUsername] = useState('');
  const [code, setCode] = useState('');

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await sendCode(username);
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    await verifyCode(code);
  };

  // Не авторизован — показываем страницу входа
  if (!isAuthenticated) {
    return (
      <div className="h-full overflow-hidden flex flex-col">
        <div className="max-w-lg mx-auto w-full p-6 pt-20 flex flex-col items-center justify-center h-full">
          {/* Logo */}
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center mb-6 shadow-xl shadow-orange-500/30">
            <User className="w-10 h-10 text-white" />
          </div>

          <h1 className="text-3xl md:text-4xl font-serif italic text-neutral-900 tracking-tighter text-center mb-2">
            Личный кабинет
          </h1>
          <p className="text-neutral-500 text-center mb-8 max-w-sm">
            Войди через Telegram, чтобы сохранять историю и синхронизировать данные
          </p>

          {/* Benefits */}
          <div className="w-full space-y-3 mb-8">
            <div className="flex items-center gap-3 bg-white rounded-2xl p-4">
              <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
                <Clock className="w-5 h-5 text-orange-500" />
              </div>
              <div>
                <p className="font-medium text-slate-800">История поиска</p>
                <p className="text-xs text-slate-500">Сохраняется на всех устройствах</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white rounded-2xl p-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Video className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <p className="font-medium text-slate-800">Сохранённые видео</p>
                <p className="text-xs text-slate-500">Доступ к коллекции откуда угодно</p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-white rounded-2xl p-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="font-medium text-slate-800">Безопасность</p>
                <p className="text-xs text-slate-500">Вход по коду из Telegram</p>
              </div>
            </div>
          </div>

          {/* Auth Form */}
          <div className="w-full">
            {!codeSent ? (
              // Шаг 1: Ввод username
              <form onSubmit={handleSendCode} className="space-y-4">
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
                      className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all"
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
                      : "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40"
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
              </form>
            ) : (
              // Шаг 2: Ввод кода
              <form onSubmit={handleVerifyCode} className="space-y-4">
                <button
                  type="button"
                  onClick={resetAuth}
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Изменить username
                </button>

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
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20 outline-none transition-all text-center text-2xl font-mono tracking-widest"
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
                      : "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30 hover:shadow-xl hover:shadow-orange-500/40"
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
              </form>
            )}
            
            <p className="text-xs text-slate-400 text-center mt-4">
              Нажимая "Получить код", вы соглашаетесь с условиями использования
            </p>
          </div>

          {/* Bot hint */}
          <div className="mt-8 p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Важно!</p>
                <p className="text-xs text-amber-600 mt-0.5">
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
        </div>
      </div>
    );
  }

  // Авторизован — показываем профиль
  return (
    <div className="h-full overflow-y-auto custom-scrollbar-light">
      <div className="max-w-lg mx-auto w-full p-6 pt-8">
        {/* User Info */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center mb-4 shadow-xl shadow-orange-500/30">
            <span className="text-3xl font-bold text-white">
              {user?.telegram_username?.[0]?.toUpperCase() || 'U'}
            </span>
          </div>
          <h2 className="text-2xl font-serif italic text-neutral-900">
            @{user?.telegram_username}
          </h2>
          <div className="flex items-center gap-1 mt-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-emerald-600">Подключен к Telegram</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center mx-auto mb-2">
              <Search className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{historyEntries.length}</p>
            <p className="text-xs text-slate-500">Поисковых запросов</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center mx-auto mb-2">
              <Video className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{incomingVideos.length}</p>
            <p className="text-xs text-slate-500">Сохранённых видео</p>
          </div>
        </div>

        {/* Settings Menu */}
        <div className="bg-white rounded-2xl overflow-hidden mb-8">
          <button className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-slate-500" />
            </div>
            <span className="flex-1 text-left font-medium text-slate-800">Уведомления</span>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
          <button className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors border-b border-slate-100">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Settings className="w-5 h-5 text-slate-500" />
            </div>
            <span className="flex-1 text-left font-medium text-slate-800">Настройки</span>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
          <button className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-slate-500" />
            </div>
            <span className="flex-1 text-left font-medium text-slate-800">Помощь</span>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Выйти</span>
        </button>

        {/* Version */}
        <p className="text-center text-xs text-slate-400 mt-8">
          Bazar AI v1.0
        </p>
      </div>
    </div>
  );
}
