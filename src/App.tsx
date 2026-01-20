import { useState } from 'react';
import { FlowCanvas } from './components/FlowCanvas';
import { Workspace } from './components/Workspace';
import { LandingPage } from './components/LandingPage';
import { History } from './components/History';
import { ProfilePage } from './components/ProfilePage';
import { IncomingVideosDrawer } from './components/sidebar/IncomingVideosDrawer';
import { SearchPanel } from './components/ui/SearchPanel';
import { useAuth } from './hooks/useAuth';
import { useInboxVideos } from './hooks/useInboxVideos';
import { Menu, Video, Settings, Search, LayoutGrid, GitBranch, Clock, User, LogOut } from 'lucide-react';
import { cn } from './utils/cn';

type ViewMode = 'workspace' | 'canvas' | 'history' | 'profile';

function App() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const { isAuthenticated, loading, logout } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('workspace');
  
  // Загружаем сохранённые видео при старте
  useInboxVideos();

  // Пока проверяем авторизацию — показываем загрузку
  if (loading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#f5f5f5]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/30 animate-pulse">
            <Video className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-500 text-sm">Загрузка...</p>
        </div>
      </div>
    );
  }

  // Если не авторизован — показываем Landing Page
  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <div className="w-full h-screen text-foreground overflow-hidden bg-[#f5f5f5]">
      {/* Clean gradient blobs - white, orange, black */}
      <div className="fixed top-[-15%] right-[-10%] w-[50%] h-[50%] bg-gradient-to-bl from-orange-500/40 via-orange-400/20 to-transparent rounded-full blur-[100px] pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-tr from-neutral-900/20 via-neutral-800/10 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed top-[40%] left-[30%] w-[40%] h-[40%] bg-gradient-to-r from-orange-400/25 via-orange-500/15 to-neutral-900/10 rounded-full blur-[80px] pointer-events-none" />
      
      {/* Noise texture overlay */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
      }} />

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/30">
            <Video className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg text-slate-800 font-medium font-serif italic tracking-tighter">
              Bazar AI
            </h1>
            <p className="text-[9px] text-slate-500 tracking-tight mt-[-2px]">Поиск вирусного контента</p>
          </div>
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center glass rounded-xl p-0.5">
          <button
            onClick={() => setViewMode('workspace')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5",
              viewMode === 'workspace' 
                ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg" 
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Рабочий стол</span>
          </button>
          <button
            onClick={() => setViewMode('canvas')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5",
              viewMode === 'canvas' 
                ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg" 
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Холст</span>
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5",
              viewMode === 'history' 
                ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg" 
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <Clock className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">История</span>
          </button>
          <button
            onClick={() => setViewMode('profile')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200 flex items-center gap-1.5",
              viewMode === 'profile' 
                ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg" 
                : "text-slate-600 hover:text-slate-900 hover:bg-white/50"
            )}
          >
            <User className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Личный кабинет</span>
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsSearchOpen(true)}
            className="glass-button px-3 py-2 rounded-xl text-slate-700 hover:text-slate-900 transition-all flex items-center gap-1.5 font-medium text-sm"
          >
            <Search className="w-4 h-4" />
            <span className="hidden sm:inline">Поиск</span>
          </button>

          <button
            onClick={() => setIsDrawerOpen(true)}
            className={cn(
              "relative px-3 py-2 rounded-xl",
              "bg-gradient-to-r from-orange-500 to-amber-600",
              "hover:from-orange-400 hover:to-amber-500",
              "text-white transition-all",
              "flex items-center gap-1.5 font-medium text-sm",
              "shadow-lg shadow-orange-500/30"
            )}
          >
            <Menu className="w-4 h-4" />
            <span className="hidden sm:inline">Входящие</span>
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full" />
          </button>
          
          <button className="glass-button p-2 rounded-xl text-slate-600 hover:text-slate-900 transition-all">
            <Settings className="w-4 h-4" />
          </button>

          <button 
            onClick={logout}
            className="glass-button p-2 rounded-xl text-slate-600 hover:text-red-500 transition-all"
            title="Выйти"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full h-screen pt-[72px]">
        {viewMode === 'workspace' && <Workspace />}
        {viewMode === 'canvas' && <FlowCanvas />}
        {viewMode === 'history' && <History />}
        {viewMode === 'profile' && <ProfilePage />}
      </div>

      {/* Incoming Videos Drawer */}
      <IncomingVideosDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
      />

      {/* Search Panel */}
      <SearchPanel
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </div>
  );
}

export default App;
