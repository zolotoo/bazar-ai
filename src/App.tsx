import { useState, ReactNode } from 'react';
import { FlowCanvas } from './components/FlowCanvas';
import { Workspace } from './components/Workspace';
import { LandingPage } from './components/LandingPage';
import { History } from './components/History';
import { ProfilePage } from './components/ProfilePage';
import { IncomingVideosDrawer } from './components/sidebar/IncomingVideosDrawer';
import { SearchPanel } from './components/ui/SearchPanel';
import { useAuth } from './hooks/useAuth';
import { useInboxVideos } from './hooks/useInboxVideos';
import { 
  Video, Settings, Search, LayoutGrid, GitBranch, Clock, User, LogOut, 
  Link, Radar, ChevronLeft, ChevronRight, Plus, FolderOpen, Trash2
} from 'lucide-react';
import { cn } from './utils/cn';
import { Toaster, toast } from 'sonner';

// Sidebar item component
interface SidebarItemProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  isActive?: boolean;
  isExpanded: boolean;
  variant?: 'default' | 'danger';
  badge?: number;
}

function SidebarItem({ icon, label, onClick, isActive, isExpanded, variant = 'default', badge }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 active:scale-[0.98]",
        isActive 
          ? "bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30" 
          : variant === 'danger'
            ? "text-slate-500 hover:text-red-500 hover:bg-red-50"
            : "text-slate-600 hover:text-slate-900 hover:bg-white/80"
      )}
    >
      <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
        {icon}
      </div>
      {isExpanded && (
        <>
          <span className="flex-1 text-sm font-medium text-left truncate">{label}</span>
          {badge !== undefined && badge > 0 && (
            <span className={cn(
              "px-2 py-0.5 rounded-full text-xs font-bold",
              isActive ? "bg-white/20 text-white" : "bg-orange-100 text-orange-600"
            )}>
              {badge}
            </span>
          )}
        </>
      )}
    </button>
  );
}

// Section header
interface SectionHeaderProps {
  title: string;
  isExpanded: boolean;
  onAdd?: () => void;
}

function SectionHeader({ title, isExpanded, onAdd }: SectionHeaderProps) {
  if (!isExpanded) return <div className="w-8 h-px bg-slate-200 mx-auto my-2" />;
  
  return (
    <div className="flex items-center justify-between px-3 py-2">
      <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{title}</span>
      {onAdd && (
        <button 
          onClick={onAdd}
          className="p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

type ViewMode = 'workspace' | 'canvas' | 'history' | 'profile';
type SearchTab = 'search' | 'link' | 'radar';

function App() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<SearchTab>('search');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const { isAuthenticated, loading, logout } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('workspace');
  const { videos } = useInboxVideos();
  
  // Mock projects for now
  const [projects] = useState([
    { id: '1', name: 'Мой проект', color: '#f97316' },
  ]);
  const [currentProjectId, setCurrentProjectId] = useState('1');

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

  const sidebarWidth = sidebarExpanded ? 'w-56' : 'w-16';

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

      {/* Left Sidebar - Expandable */}
      <div className={cn(
        "fixed left-0 top-0 bottom-0 z-40 flex flex-col py-3 glass border-r border-slate-200/50 transition-all duration-300",
        sidebarWidth
      )}>
        {/* Header with Logo */}
        <div className={cn(
          "flex items-center gap-3 px-3 mb-4",
          !sidebarExpanded && "justify-center"
        )}>
          <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 shadow-lg shadow-orange-500/30 flex-shrink-0">
            <Video className="w-5 h-5 text-white" />
          </div>
          {sidebarExpanded && (
            <div className="flex-1 min-w-0">
              <h1 className="text-base text-slate-800 font-semibold truncate">Bazar AI</h1>
              <p className="text-[10px] text-slate-400 truncate">Поиск контента</p>
            </div>
          )}
        </div>

        {/* Toggle button */}
        <button
          onClick={() => setSidebarExpanded(!sidebarExpanded)}
          className="absolute -right-3 top-16 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors z-50"
        >
          {sidebarExpanded ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        
        {/* Main Navigation */}
        <div className="flex-1 flex flex-col px-2 overflow-y-auto custom-scrollbar-light">
          <SectionHeader title="Навигация" isExpanded={sidebarExpanded} />
          
          <div className="space-y-1">
            <SidebarItem
              icon={<LayoutGrid className="w-5 h-5" />}
              label="Рабочий стол"
              onClick={() => setViewMode('workspace')}
              isActive={viewMode === 'workspace'}
              isExpanded={sidebarExpanded}
              badge={videos.length}
            />
            <SidebarItem
              icon={<GitBranch className="w-5 h-5" />}
              label="Холст"
              onClick={() => setViewMode('canvas')}
              isActive={viewMode === 'canvas'}
              isExpanded={sidebarExpanded}
            />
            <SidebarItem
              icon={<Clock className="w-5 h-5" />}
              label="История"
              onClick={() => setViewMode('history')}
              isActive={viewMode === 'history'}
              isExpanded={sidebarExpanded}
            />
          </div>
          
          <SectionHeader 
            title="Поиск" 
            isExpanded={sidebarExpanded} 
          />
          
          <div className="space-y-1">
            <SidebarItem
              icon={<Search className="w-5 h-5" />}
              label="Поиск видео"
              onClick={() => { setSearchTab('search'); setIsSearchOpen(true); }}
              isExpanded={sidebarExpanded}
            />
            <SidebarItem
              icon={<Link className="w-5 h-5" />}
              label="По ссылке"
              onClick={() => { setSearchTab('link'); setIsSearchOpen(true); }}
              isExpanded={sidebarExpanded}
            />
            <SidebarItem
              icon={<Radar className="w-5 h-5" />}
              label="Радар"
              onClick={() => { setSearchTab('radar'); setIsSearchOpen(true); }}
              isExpanded={sidebarExpanded}
            />
          </div>

          <SectionHeader 
            title="Проекты" 
            isExpanded={sidebarExpanded}
            onAdd={() => toast.info('Создание проектов скоро будет доступно')}
          />
          
          <div className="space-y-1">
            {projects.map(project => (
              <button
                key={project.id}
                onClick={() => setCurrentProjectId(project.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all",
                  currentProjectId === project.id
                    ? "bg-slate-100 text-slate-900"
                    : "text-slate-600 hover:bg-slate-50"
                )}
              >
                <div 
                  className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: project.color + '20' }}
                >
                  <FolderOpen className="w-3.5 h-3.5" style={{ color: project.color }} />
                </div>
                {sidebarExpanded && (
                  <span className="flex-1 text-sm font-medium text-left truncate">{project.name}</span>
                )}
              </button>
            ))}
          </div>
        </div>
        
        {/* Bottom Actions */}
        <div className="px-2 pt-2 border-t border-slate-200/50 space-y-1">
          <SidebarItem
            icon={<User className="w-5 h-5" />}
            label="Профиль"
            onClick={() => setViewMode('profile')}
            isActive={viewMode === 'profile'}
            isExpanded={sidebarExpanded}
          />
          <SidebarItem
            icon={<Settings className="w-5 h-5" />}
            label="Настройки"
            onClick={() => toast.info('Настройки скоро будут доступны')}
            isExpanded={sidebarExpanded}
          />
          <SidebarItem
            icon={<LogOut className="w-5 h-5" />}
            label="Выйти"
            onClick={logout}
            isExpanded={sidebarExpanded}
            variant="danger"
          />
        </div>
      </div>

      {/* Main Content */}
      <div 
        className="w-full h-screen transition-all duration-300"
        style={{ paddingLeft: sidebarExpanded ? '14rem' : '4rem' }}
      >
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
