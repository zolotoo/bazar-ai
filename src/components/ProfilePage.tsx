import { useAuth } from '../hooks/useAuth';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { useFlowStore } from '../stores/flowStore';
import { 
  User, 
  LogOut, 
  Search, 
  Video, 
  ChevronRight,
  Settings,
  Bell,
  HelpCircle,
} from 'lucide-react';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const { historyEntries } = useSearchHistory();
  const { incomingVideos } = useFlowStore();

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
