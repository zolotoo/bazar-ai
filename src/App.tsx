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
import { ProjectProvider, useProjectContext } from './contexts/ProjectContext';
import { 
  Video, Settings, Search, LayoutGrid, GitBranch, Clock, User, LogOut, 
  Link, Radar, ChevronLeft, ChevronRight, Plus, FolderOpen, X, Palette, Sparkles
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

// Цвета для проектов
const PROJECT_COLORS = [
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#06b6d4', // cyan
  '#10b981', // emerald
  '#84cc16', // lime
  '#eab308', // yellow
];

// Модальное окно создания проекта
interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, color: string) => void;
}

function CreateProjectModal({ isOpen, onClose, onCreate }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim(), color);
      setName('');
      setColor(PROJECT_COLORS[0]);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white rounded-3xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Новый проект</h2>
              <p className="text-sm text-slate-500">Создайте проект для организации контента</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name input */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Название проекта
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: Кулинарный блог"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500 transition-all text-slate-800 placeholder:text-slate-400"
              autoFocus
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Цвет проекта
              </div>
            </label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "w-10 h-10 rounded-xl transition-all",
                    color === c 
                      ? "ring-2 ring-offset-2 ring-slate-400 scale-110" 
                      : "hover:scale-105"
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
            <p className="text-xs text-slate-500 mb-2">Предпросмотр</p>
            <div className="flex items-center gap-3">
              <div 
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: color + '20' }}
              >
                <FolderOpen className="w-5 h-5" style={{ color }} />
              </div>
              <span className="font-medium text-slate-800">
                {name || 'Название проекта'}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-slate-600 font-medium hover:bg-slate-50 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 text-white font-medium hover:from-orange-400 hover:to-amber-400 transition-all shadow-lg shadow-orange-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Создать проект
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AppContent() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchTab, setSearchTab] = useState<SearchTab>('search');
  const [sidebarExpanded, setSidebarExpanded] = useState(true);
  const [isCreateProjectOpen, setIsCreateProjectOpen] = useState(false);
  const { logout } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('workspace');
  const { videos } = useInboxVideos();
  
  // Используем контекст проектов
  const { projects, currentProject, currentProjectId, selectProject, createProject, loading: projectsLoading } = useProjectContext();

  // Создание проекта
  const handleCreateProject = async (name: string, color: string) => {
    const project = await createProject(name, color);
    if (project) {
      toast.success(`Проект "${name}" создан`);
      selectProject(project.id);
    }
  };

  if (projectsLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#f5f5f5]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/30 animate-pulse">
            <Video className="w-8 h-8 text-white" />
          </div>
          <p className="text-slate-500 text-sm">Загрузка проектов...</p>
        </div>
      </div>
    );
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
            onAdd={() => setIsCreateProjectOpen(true)}
          />
          
          <div className="space-y-1">
            {projects.length === 0 ? (
              <button
                onClick={() => setIsCreateProjectOpen(true)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl border-2 border-dashed border-slate-200 text-slate-400 hover:border-orange-300 hover:text-orange-500 transition-all"
              >
                <Plus className="w-5 h-5" />
                {sidebarExpanded && <span className="text-sm font-medium">Создать проект</span>}
              </button>
            ) : (
              projects.map(project => (
                <button
                  key={project.id}
                  onClick={() => selectProject(project.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all",
                    currentProjectId === project.id
                      ? "bg-white shadow-sm border border-slate-100"
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <div 
                    className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: (project.color || '#f97316') + '20' }}
                  >
                    <FolderOpen className="w-4 h-4" style={{ color: project.color || '#f97316' }} />
                  </div>
                  {sidebarExpanded && (
                    <>
                      <span className={cn(
                        "flex-1 text-sm font-medium text-left truncate",
                        currentProjectId === project.id ? "text-slate-800" : "text-slate-600"
                      )}>
                        {project.name}
                      </span>
                      {currentProjectId === project.id && (
                        <div className="w-2 h-2 rounded-full bg-orange-500" />
                      )}
                    </>
                  )}
                </button>
              ))
            )}
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
        currentProjectId={currentProjectId}
        currentProjectName={currentProject?.name || 'Проект'}
      />

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateProjectOpen}
        onClose={() => setIsCreateProjectOpen(false)}
        onCreate={handleCreateProject}
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

// Wrapper component with auth check
function App() {
  const { isAuthenticated, loading } = useAuth();

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

  if (!isAuthenticated) {
    return <LandingPage />;
  }

  return (
    <ProjectProvider>
      <AppContent />
    </ProjectProvider>
  );
}

export default App;
