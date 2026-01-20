import { useAuth } from '../hooks/useAuth';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { useFlowStore } from '../stores/flowStore';
import { TelegramLoginButton } from './TelegramLoginButton';
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
  HelpCircle
} from 'lucide-react';

export function ProfilePage() {
  const { user, isAuthenticated, handleTelegramAuth, logout, botUsername } = useAuth();
  const { historyEntries } = useSearchHistory();
  const { incomingVideos } = useFlowStore();

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
              <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Video className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <p className="font-medium text-slate-800">Коллекция видео</p>
                <p className="text-xs text-slate-500">Доступ к сохранённым видео везде</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 bg-white rounded-2xl p-4">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-emerald-500" />
              </div>
              <div>
                <p className="font-medium text-slate-800">Безопасность</p>
                <p className="text-xs text-slate-500">Авторизация через Telegram</p>
              </div>
            </div>
          </div>

          {/* Telegram Login */}
          <div className="w-full">
            <TelegramLoginButton
              botName={botUsername}
              onAuth={handleTelegramAuth}
              buttonSize="large"
              cornerRadius={16}
            />
            
            <p className="text-xs text-slate-400 text-center mt-4">
              Нажимая "Войти", вы соглашаетесь с условиями использования
            </p>
          </div>

          {/* Demo mode hint */}
          <div className="mt-8 p-4 rounded-2xl bg-amber-50 border border-amber-200">
            <div className="flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-amber-800">Демо-режим</p>
                <p className="text-xs text-amber-600 mt-0.5">
                  Без авторизации данные сохраняются только локально в браузере
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
      <div className="max-w-lg mx-auto w-full p-6 pt-20">
        {/* Profile Header */}
        <div className="bg-white rounded-3xl p-6 mb-6 shadow-sm">
          <div className="flex items-center gap-4">
            {user?.photo_url ? (
              <img
                src={user.photo_url}
                alt={user.first_name}
                className="w-16 h-16 rounded-2xl object-cover"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center">
                <span className="text-2xl font-bold text-white">
                  {user?.first_name?.[0]?.toUpperCase()}
                </span>
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-slate-900 truncate">
                {user?.first_name} {user?.last_name || ''}
              </h2>
              {user?.username && (
                <p className="text-slate-500 text-sm">@{user.username}</p>
              )}
              <div className="flex items-center gap-1 mt-1">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-xs text-emerald-600 font-medium">Подключен к Telegram</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-2xl p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center mx-auto mb-2">
              <Search className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{historyEntries.length}</p>
            <p className="text-xs text-slate-500">Поисковых запросов</p>
          </div>
          
          <div className="bg-white rounded-2xl p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center mx-auto mb-2">
              <Video className="w-5 h-5 text-violet-500" />
            </div>
            <p className="text-2xl font-bold text-slate-900">{incomingVideos.length}</p>
            <p className="text-xs text-slate-500">Сохранённых видео</p>
          </div>
        </div>

        {/* Menu */}
        <div className="bg-white rounded-3xl overflow-hidden mb-6">
          <button className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Settings className="w-5 h-5 text-slate-600" />
            </div>
            <span className="flex-1 text-left font-medium text-slate-800">Настройки</span>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
          
          <div className="h-px bg-slate-100 mx-4" />
          
          <button className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-slate-600" />
            </div>
            <span className="flex-1 text-left font-medium text-slate-800">Уведомления</span>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
          
          <div className="h-px bg-slate-100 mx-4" />
          
          <button className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 transition-colors">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <HelpCircle className="w-5 h-5 text-slate-600" />
            </div>
            <span className="flex-1 text-left font-medium text-slate-800">Помощь</span>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-red-50 text-red-600 font-medium hover:bg-red-100 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Выйти из аккаунта
        </button>

        {/* Version */}
        <p className="text-center text-xs text-slate-400 mt-6">
          Bazar AI v1.0.0
        </p>
      </div>
    </div>
  );
}
