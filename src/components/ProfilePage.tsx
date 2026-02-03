import { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSearchHistory } from '../hooks/useSearchHistory';
import { useFlowStore } from '../stores/flowStore';
import { useTrackedAccounts } from '../hooks/useTrackedAccounts';
import { 
  LogOut, 
  Search, 
  Video, 
  ChevronRight,
  Settings,
  Bell,
  HelpCircle,
  UserPlus,
  Trash2,
  RefreshCw,
  Clock,
  Instagram,
  Loader2,
  X,
  Plus,
} from 'lucide-react';
import { cn } from '../utils/cn';

export function ProfilePage() {
  const { user, logout } = useAuth();
  const { historyEntries } = useSearchHistory();
  const { incomingVideos } = useFlowStore();
  const { 
    accounts, 
    loading: accountsLoading, 
    checking,
    addAccount, 
    removeAccount, 
    checkAccountReels 
  } = useTrackedAccounts();
  
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newFrequency, setNewFrequency] = useState(24);
  const [adding, setAdding] = useState(false);

  const handleAddAccount = async () => {
    if (!newUsername.trim()) return;
    setAdding(true);
    await addAccount(newUsername, newFrequency);
    setNewUsername('');
    setShowAddAccount(false);
    setAdding(false);
  };

  const formatLastChecked = (date: string | null) => {
    if (!date) return 'Никогда';
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Только что';
    if (hours < 24) return `${hours}ч назад`;
    const days = Math.floor(hours / 24);
    return `${days}д назад`;
  };

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
          <h2 className="text-xl font-bold text-slate-800">
            @{user?.telegram_username}
          </h2>
          <div className="flex items-center gap-1 mt-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-emerald-600">Подключен к Telegram</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white rounded-2xl p-4 text-center active:scale-95 transition-transform">
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center mx-auto mb-2">
              <Search className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{historyEntries.length}</p>
            <p className="text-xs text-slate-500">Поисковых запросов</p>
          </div>
          <div className="bg-white rounded-2xl p-4 text-center active:scale-95 transition-transform">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-2">
              <Video className="w-5 h-5 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{incomingVideos.length}</p>
            <p className="text-xs text-slate-500">Сохранённых видео</p>
          </div>
        </div>

        {/* Tracked Accounts Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-slate-800">Отслеживаемые аккаунты</h3>
            <button
              onClick={() => setShowAddAccount(true)}
              className="p-2 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-400 hover:to-amber-400 transition-all active:scale-95 shadow-lg shadow-orange-500/30"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          </div>

          {/* Add Account Modal */}
          {showAddAccount && (
            <div className="bg-white rounded-2xl p-4 mb-4 shadow-lg border border-orange-100">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-slate-800">Добавить аккаунт</h4>
                <button
                  onClick={() => setShowAddAccount(false)}
                  className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 active:scale-95"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-slate-500 mb-1 block">Instagram username</label>
                  <div className="flex items-center gap-2">
                    <Instagram className="w-5 h-5 text-pink-500" />
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="username"
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-orange-500/30 text-sm"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-slate-500 mb-1 block">Частота проверки</label>
                  <select
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 outline-none focus:ring-2 focus:ring-orange-500/30 text-sm"
                  >
                    <option value={1}>Каждый час</option>
                    <option value={6}>Каждые 6 часов</option>
                    <option value={12}>Каждые 12 часов</option>
                    <option value={24}>Раз в день</option>
                    <option value={168}>Раз в неделю</option>
                  </select>
                </div>
                
                <button
                  onClick={handleAddAccount}
                  disabled={!newUsername.trim() || adding}
                  className={cn(
                    "w-full py-2.5 rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2",
                    "bg-gradient-to-r from-orange-500 to-amber-500 text-white",
                    "hover:from-orange-400 hover:to-amber-400 active:scale-95",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                >
                  {adding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  Добавить
                </button>
              </div>
            </div>
          )}

          {/* Accounts List */}
          {accountsLoading ? (
            <div className="bg-white rounded-2xl p-8 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="bg-white rounded-2xl p-6 text-center">
              <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center mx-auto mb-3">
                <Instagram className="w-6 h-6 text-pink-500" />
              </div>
              <p className="text-slate-500 text-sm">
                Добавьте Instagram аккаунты для автоматического отслеживания новых рилсов
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div 
                  key={account.id}
                  className="bg-white rounded-2xl p-4 flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-xl bg-slate-600 flex items-center justify-center flex-shrink-0">
                    <span className="text-white font-bold text-lg">
                      {account.instagram_username[0].toUpperCase()}
                    </span>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate">
                      @{account.instagram_username}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatLastChecked(account.last_checked_at)}</span>
                      <span>•</span>
                      <span>каждые {account.update_frequency_hours}ч</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => checkAccountReels(account)}
                      disabled={checking === account.id}
                      className={cn(
                        "p-2 rounded-xl transition-all active:scale-95",
                        checking === account.id 
                          ? "bg-orange-100 text-orange-500" 
                          : "bg-slate-100 text-slate-500 hover:bg-orange-100 hover:text-orange-500"
                      )}
                    >
                      <RefreshCw className={cn("w-4 h-4", checking === account.id && "animate-spin")} />
                    </button>
                    <button
                      onClick={() => removeAccount(account.id)}
                      className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-500 transition-all active:scale-95"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Settings Menu */}
        <div className="bg-white rounded-2xl overflow-hidden mb-8">
          <button className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 active:scale-[0.98]">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Bell className="w-5 h-5 text-slate-500" />
            </div>
            <span className="flex-1 text-left font-medium text-slate-800">Уведомления</span>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
          <button className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors border-b border-slate-100 active:scale-[0.98]">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <Settings className="w-5 h-5 text-slate-500" />
            </div>
            <span className="flex-1 text-left font-medium text-slate-800">Настройки</span>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
          <button className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors active:scale-[0.98]">
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
          className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl bg-red-50 text-red-600 hover:bg-red-100 transition-colors active:scale-95"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Выйти</span>
        </button>

        {/* Version */}
        <p className="text-center text-xs text-slate-400 mt-8">
          Riri AI v1.0
        </p>
      </div>
    </div>
  );
}
