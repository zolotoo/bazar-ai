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
import { Video, Settings, Search, LayoutGrid, GitBranch, Clock, User, LogOut, Link, Radar, Plus } from 'lucide-react';
import { cn } from './utils/cn';
import { Toaster } from 'sonner';

type ViewMode = 'workspace' | 'canvas' | 'history' | 'profile';
type SearchTab = 'search' | 'link' | 'radar';

function App() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<SearchTab>('search');
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

      {/* Left Sidebar */}
      <div className="fixed left-0 top-0 bottom-0 w-16 z-40 flex flex-col items-center py-4 glass border-r border-slate-200/50">
        {/* Logo */}
        <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/30 mb-6">
          <Video className="w-5 h-5 text-white" />
        </div>
        
        {/* Main Navigation */}
        <div className="flex-1 flex flex-col items-center gap-2">
          <button
            onClick={() => setViewMode('workspace')}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95",
              viewMode === 'workspace' 
                ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30" 
                : "text-slate-500 hover:text-slate-800 hover:bg-white/80"
            )}
            title="Рабочий стол"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('canvas')}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95",
              viewMode === 'canvas' 
                ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30" 
                : "text-slate-500 hover:text-slate-800 hover:bg-white/80"
            )}
            title="Холст"
          >
            <GitBranch className="w-5 h-5" />
          </button>
          <button
            onClick={() => setViewMode('history')}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95",
              viewMode === 'history' 
                ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30" 
                : "text-slate-500 hover:text-slate-800 hover:bg-white/80"
            )}
            title="История"
          >
            <Clock className="w-5 h-5" />
          </button>
          
          {/* Divider */}
          <div className="w-8 h-px bg-slate-200 my-2" />
          
          {/* Search Actions */}
          <button
            onClick={() => { setSearchTab('search'); setIsSearchOpen(true); }}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95",
              "text-slate-500 hover:text-slate-800 hover:bg-white/80"
            )}
            title="Поиск"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setSearchTab('link'); setIsSearchOpen(true); }}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95",
              "text-slate-500 hover:text-slate-800 hover:bg-white/80"
            )}
            title="Добавить по ссылке"
          >
            <Link className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setSearchTab('radar'); setIsSearchOpen(true); }}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95",
              "text-slate-500 hover:text-slate-800 hover:bg-white/80"
            )}
            title="Радар"
          >
            <Radar className="w-5 h-5" />
          </button>
        </div>
        
        {/* Bottom Actions */}
        <div className="flex flex-col items-center gap-2 mt-auto">
          <button
            onClick={() => setViewMode('profile')}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-95",
              viewMode === 'profile' 
                ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30" 
                : "text-slate-500 hover:text-slate-800 hover:bg-white/80"
            )}
            title="Личный кабинет"
          >
            <User className="w-5 h-5" />
          </button>
          <button 
            className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-white/80 transition-all active:scale-95"
            title="Настройки"
          >
            <Settings className="w-5 h-5" />
          </button>
          <button 
            onClick={logout}
            className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all active:scale-95"
            title="Выйти"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full h-screen pl-16">
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
        initialTab={searchTab}
      />

      {/* Toast notifications */}
      <Toaster 
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#18181b',
            color: '#fff',
            border: 'none',
            borderRadius: '1rem',
          },
        }}
      />
    </div>
  );
}

export default App;
