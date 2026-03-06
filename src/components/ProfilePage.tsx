import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import { getDisplayName, getEffectiveDisplayName, setDisplayName } from './Dashboard';
import { TokenBalanceDisplay } from './ui/TokenBalanceDisplay';
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
  const [displayName, setDisplayNameState] = useState('');
  const [editingName, setEditingName] = useState(false);

  useEffect(() => {
    setDisplayNameState(getDisplayName() || user?.telegram_username || '');
  }, [user?.telegram_username]);

  const handleSaveDisplayName = () => {
    if (displayName.trim()) {
      setDisplayName(displayName.trim());
      setEditingName(false);
    }
  };

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
    <div className="h-full overflow-y-auto custom-scrollbar-light" style={{ WebkitOverflowScrolling: 'touch' }}>
      <div className="max-w-lg mx-auto w-full p-6 pt-8 pb-24 md:pb-6">
        {/* User Info */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-24 h-24 rounded-full bg-white/72 backdrop-blur-glass-xl border border-white/60 flex items-center justify-center mb-4 shadow-glass">
            <div className="w-[84px] h-[84px] rounded-full bg-gradient-to-br from-slate-500 via-slate-600 to-slate-700 flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_22px_rgba(15,23,42,0.18)]">
            <span className="text-3xl font-bold text-white font-heading">
              {user?.telegram_username?.[0]?.toUpperCase() || 'U'}
            </span>
            </div>
          </div>
          {editingName ? (
            <div className="flex items-center gap-2 mt-2 rounded-2xl bg-white/72 backdrop-blur-glass border border-white/60 p-2 shadow-glass-sm">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayNameState(e.target.value)}
                placeholder="Твоё имя"
                className="px-3 py-2 rounded-xl border border-white/60 bg-white/75 text-slate-800 text-sm outline-none focus:ring-2 focus:ring-slate-200/70"
                autoFocus
              />
              <button onClick={handleSaveDisplayName} className="px-3 py-2 rounded-xl bg-slate-700 text-white text-sm shadow-glass-sm">Сохранить</button>
              <button onClick={() => { setEditingName(false); setDisplayNameState(getDisplayName() || user?.telegram_username || ''); }} className="px-3 py-2 rounded-xl bg-white/80 border border-white/60 text-slate-600 text-sm">Отмена</button>
            </div>
          ) : (
            <button onClick={() => setEditingName(true)} className="text-left">
              <h2 className="text-xl font-bold text-slate-800">
                {displayName || getEffectiveDisplayName(user?.telegram_username)}
              </h2>
              <p className="text-sm text-slate-500 mt-0.5">@{user?.telegram_username}</p>
            </button>
          )}
          <div className="flex items-center gap-3 mt-3 flex-wrap justify-center">
            <div className="flex items-center gap-1.5 rounded-pill bg-white/58 border border-white/55 backdrop-blur-glass px-3 py-1.5 shadow-glass-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-sm text-emerald-700">Подключен к Telegram</span>
            </div>
            <div className="flex items-center gap-2 rounded-pill bg-white/58 border border-white/55 backdrop-blur-glass px-3 py-1.5 shadow-glass-sm">
              <span className="text-sm text-slate-500">Баланс</span>
              <TokenBalanceDisplay variant="card" />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <div className="bg-white/68 backdrop-blur-glass border border-white/60 rounded-3xl p-4 text-center active:scale-95 transition-transform shadow-glass">
            <div className="w-10 h-10 rounded-2xl bg-white/80 border border-white/60 flex items-center justify-center mx-auto mb-2 shadow-glass-sm">
              <Search className="w-5 h-5 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{historyEntries.length}</p>
            <p className="text-xs text-slate-500">Поисковых запросов</p>
          </div>
          <div className="bg-white/68 backdrop-blur-glass border border-white/60 rounded-3xl p-4 text-center active:scale-95 transition-transform shadow-glass">
            <div className="w-10 h-10 rounded-2xl bg-white/80 border border-white/60 flex items-center justify-center mx-auto mb-2 shadow-glass-sm">
              <Video className="w-5 h-5 text-slate-600" />
            </div>
            <p className="text-2xl font-bold text-slate-800">{incomingVideos.length}</p>
            <p className="text-xs text-slate-500">Сохранённых видео</p>
          </div>
        </div>

        {/* Tracked Accounts Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800 font-heading tracking-[-0.01em]">Отслеживаемые аккаунты</h3>
            <button
              onClick={() => setShowAddAccount(true)}
              className="p-2 rounded-2xl bg-white/72 backdrop-blur-glass border border-white/60 text-slate-700 hover:bg-white/82 transition-all active:scale-95 shadow-glass"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          </div>

          {/* Add Account Modal */}
          {showAddAccount && (
            <div className="bg-white/72 backdrop-blur-glass-xl rounded-3xl p-4 mb-4 shadow-glass border border-white/60">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-slate-800">Добавить аккаунт</h4>
                <button
                  onClick={() => setShowAddAccount(false)}
                  className="p-2 min-w-[44px] min-h-[44px] rounded-lg hover:bg-slate-100 text-slate-400 active:scale-95 flex items-center justify-center touch-manipulation"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-slate-500 mb-1 block">Instagram username</label>
                  <div className="flex items-center gap-2">
                    <Instagram className="w-5 h-5 text-slate-500" />
                    <input
                      type="text"
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      placeholder="username"
                      className="flex-1 px-3 py-2 rounded-xl border border-white/60 bg-white/80 outline-none focus:ring-2 focus:ring-slate-300/40 text-sm"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-slate-500 mb-1 block">Частота проверки</label>
                  <select
                    value={newFrequency}
                    onChange={(e) => setNewFrequency(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl border border-white/60 bg-white/80 outline-none focus:ring-2 focus:ring-slate-300/40 text-sm"
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
                    "bg-slate-700 text-white shadow-glass-sm",
                    "hover:bg-slate-800 active:scale-95",
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
            <div className="bg-white/68 backdrop-blur-glass border border-white/60 rounded-3xl p-8 flex items-center justify-center shadow-glass">
              <Loader2 className="w-6 h-6 animate-spin text-slate-500" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="bg-white/68 backdrop-blur-glass border border-white/60 rounded-3xl p-6 text-center shadow-glass">
              <div className="w-12 h-12 rounded-2xl bg-white/80 border border-white/60 flex items-center justify-center mx-auto mb-3 shadow-glass-sm">
                <Instagram className="w-6 h-6 text-slate-500" />
              </div>
              <p className="text-slate-500 text-sm">
                Добавь Instagram аккаунты — я буду автоматически отслеживать новые рилсы
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div 
                  key={account.id}
                  className="bg-white/68 backdrop-blur-glass border border-white/60 rounded-3xl p-4 flex items-center gap-3 shadow-glass"
                >
                  <div className="w-12 h-12 rounded-2xl bg-white/80 border border-white/60 flex items-center justify-center flex-shrink-0 shadow-glass-sm">
                    <span className="text-white font-bold text-lg">
                      <span className="text-slate-700">{account.instagram_username[0].toUpperCase()}</span>
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
                        "p-2 min-w-[44px] min-h-[44px] rounded-xl transition-all active:scale-95 flex items-center justify-center touch-manipulation",
                        checking === account.id 
                          ? "bg-white/90 border border-white/60 text-slate-700 shadow-glass-sm" 
                          : "bg-white/80 border border-white/60 text-slate-500 hover:bg-white/90 hover:text-slate-700"
                      )}
                    >
                      <RefreshCw className={cn("w-4 h-4", checking === account.id && "animate-spin")} />
                    </button>
                    <button
                      onClick={() => removeAccount(account.id)}
                      className="p-2 min-w-[44px] min-h-[44px] rounded-xl bg-white/80 border border-white/60 text-slate-500 hover:bg-red-50 hover:text-red-500 transition-all active:scale-95 flex items-center justify-center touch-manipulation"
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
        <div className="bg-white/68 backdrop-blur-glass border border-white/60 rounded-3xl overflow-hidden mb-8 shadow-glass">
          <button className="w-full flex items-center gap-3 p-4 min-h-[56px] hover:bg-white/70 transition-colors border-b border-white/55 active:scale-[0.98] touch-manipulation">
            <div className="w-10 h-10 rounded-2xl bg-white/82 border border-white/60 flex items-center justify-center shadow-glass-sm">
              <Bell className="w-5 h-5 text-slate-500" />
            </div>
            <span className="flex-1 text-left font-medium text-slate-800">Уведомления</span>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
          <button className="w-full flex items-center gap-3 p-4 min-h-[56px] hover:bg-white/70 transition-colors border-b border-white/55 active:scale-[0.98] touch-manipulation">
            <div className="w-10 h-10 rounded-2xl bg-white/82 border border-white/60 flex items-center justify-center shadow-glass-sm">
              <Settings className="w-5 h-5 text-slate-500" />
            </div>
            <span className="flex-1 text-left font-medium text-slate-800">Настройки</span>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
          <button className="w-full flex items-center gap-3 p-4 min-h-[56px] hover:bg-white/70 transition-colors active:scale-[0.98] touch-manipulation">
            <div className="w-10 h-10 rounded-2xl bg-white/82 border border-white/60 flex items-center justify-center shadow-glass-sm">
              <HelpCircle className="w-5 h-5 text-slate-500" />
            </div>
            <span className="flex-1 text-left font-medium text-slate-800">Помощь</span>
            <ChevronRight className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* Logout */}
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 p-4 min-h-[56px] rounded-3xl bg-white/68 backdrop-blur-glass border border-white/60 text-red-600 hover:bg-red-50 transition-colors active:scale-95 touch-manipulation shadow-glass"
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
