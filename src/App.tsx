import { useState, useEffect } from 'react';
import { Workspace } from './components/Workspace';
import { LandingPage } from './components/LandingPage';
import { History } from './components/History';
import { ProfilePage } from './components/ProfilePage';
import { IncomingVideosDrawer } from './components/sidebar/IncomingVideosDrawer';
import { SearchPanel } from './components/ui/SearchPanel';
import { ProjectMembersModal } from './components/ui/ProjectMembersModal';
import { 
  Sidebar, SidebarBody, SidebarLink, SidebarSection, SidebarProject, 
  SidebarLogo, SidebarDivider 
} from './components/ui/AnimatedSidebar';
import { useAuth } from './hooks/useAuth';
import { useInboxVideos } from './hooks/useInboxVideos';
import { ProjectProvider, useProjectContext } from './contexts/ProjectContext';
import { 
  Video, Settings, Search, LayoutGrid, Clock, User, LogOut, 
  Link, Radar, Plus, FolderOpen, X, Palette, Sparkles, Trash2, Users
} from 'lucide-react';
import { cn } from './utils/cn';
import { Toaster, toast } from 'sonner';


type ViewMode = 'workspace' | 'canvas' | 'history' | 'profile';
type SearchTab = 'search' | 'link' | 'radar';

// Цвета для проектов
const PROJECT_COLORS = [
  '#f97316', // orange (мягкий)
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
  onSave: (name: string, color: string) => void;
  onClose: () => void;
}

function CreateProjectModal({ onSave, onClose }: CreateProjectModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(name.trim(), color);
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
      <div className="relative w-full max-w-md mx-4 bg-white/90 backdrop-blur-[28px] backdrop-saturate-[180%] rounded-3xl shadow-2xl border border-white/60 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-[#f97316] via-[#fb923c] to-[#fdba74] flex items-center justify-center shadow-lg shadow-[#f97316]/20">
              <Sparkles className="w-5 h-5 text-white" strokeWidth={2.5} />
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
              className="w-full px-5 py-3.5 rounded-2xl border border-slate-200/80 bg-white/60 backdrop-blur-sm outline-none focus:ring-2 focus:ring-[#f97316]/20 focus:border-[#f97316]/30 transition-all text-slate-800 placeholder:text-slate-400 font-medium"
              autoFocus
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" strokeWidth={2.5} />
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
                <FolderOpen className="w-5 h-5" style={{ color }} strokeWidth={2.5} />
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
              className="flex-1 px-5 py-3.5 rounded-2xl border border-slate-200/80 bg-white/60 backdrop-blur-sm text-slate-600 font-medium hover:bg-white/80 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 px-5 py-3.5 rounded-2xl bg-gradient-to-r from-[#f97316] via-[#fb923c] to-[#fdba74] text-white font-medium hover:from-[#f97316] hover:via-[#fb923c] hover:to-[#fdba74] transition-all shadow-lg shadow-[#f97316]/20 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
            >
              Создать проект
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Модальное окно редактирования проекта
interface EditProjectModalProps {
  project: { id: string; name: string; color: string } | null;
  onClose: () => void;
  onSave: (projectId: string, name: string, color: string) => void;
  onDelete: (projectId: string) => void;
}

function EditProjectModal({ project, onSave, onDelete, onClose }: EditProjectModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Обновляем состояние когда проект меняется
  useEffect(() => {
    if (project) {
      setName(project.name);
      setColor(project.color || PROJECT_COLORS[0]);
      setShowDeleteConfirm(false);
    }
  }, [project]);

  if (!project) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave(project.id, name.trim(), color);
      onClose();
    }
  };

  const handleDelete = () => {
    onDelete(project.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white/90 backdrop-blur-[28px] backdrop-saturate-[180%] rounded-3xl shadow-2xl border border-white/60 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div 
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ backgroundColor: color + '20' }}
            >
              <FolderOpen className="w-5 h-5" style={{ color }} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Редактировать проект</h2>
              <p className="text-sm text-slate-500">Изменить название и цвет</p>
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
              className="w-full px-5 py-3.5 rounded-2xl border border-slate-200/80 bg-white/60 backdrop-blur-sm outline-none focus:ring-2 focus:ring-[#f97316]/20 focus:border-[#f97316]/30 transition-all text-slate-800 placeholder:text-slate-400 font-medium"
              autoFocus
            />
          </div>

          {/* Color picker */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4" strokeWidth={2.5} />
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
                <FolderOpen className="w-5 h-5" style={{ color }} strokeWidth={2.5} />
              </div>
              <span className="font-medium text-slate-800">
                {name || 'Название проекта'}
              </span>
            </div>
          </div>

          {/* Delete section */}
          <div className="pt-4 border-t border-slate-100">
            {!showDeleteConfirm ? (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Удалить проект
              </button>
            ) : (
              <div className="p-3 rounded-xl bg-red-50 border border-red-100">
                <p className="text-sm text-red-600 mb-3">
                  Вы уверены? Все видео проекта будут удалены.
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="flex-1 px-3 py-2 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex-1 px-3 py-2 rounded-lg text-sm bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2 flex-wrap">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-w-[120px] px-5 py-3.5 rounded-2xl border border-slate-200/80 bg-white/60 backdrop-blur-sm text-slate-600 font-medium hover:bg-white/80 transition-colors"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="flex-1 min-w-[120px] px-5 py-3.5 rounded-2xl bg-gradient-to-r from-[#f97316] via-[#fb923c] to-[#fdba74] text-white font-medium hover:from-[#f97316] hover:via-[#fb923c] hover:to-[#fdba74] transition-all shadow-lg shadow-[#f97316]/20 disabled:opacity-50 disabled:cursor-not-allowed backdrop-blur-sm"
            >
              Сохранить
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
  const [editingProject, setEditingProject] = useState<{ id: string; name: string; color: string } | null>(null);
  const [isMembersModalOpen, setIsMembersModalOpen] = useState(false);
  const { logout } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>('workspace');
  const { videos } = useInboxVideos();
  
  // Используем контекст проектов
  const { projects, currentProject, currentProjectId, selectProject, createProject, updateProject, deleteProject, loading: projectsLoading } = useProjectContext();

  // Создание проекта
  const handleCreateProject = async (name: string, color: string) => {
    const project = await createProject(name, color);
    if (project) {
      toast.success(`Проект "${name}" создан`);
      selectProject(project.id);
    }
  };

  // Редактирование проекта
  const handleEditProject = async (projectId: string, name: string, color: string) => {
    await updateProject(projectId, { name, color });
    toast.success(`Проект "${name}" обновлён`);
  };

  // Удаление проекта
  const handleDeleteProject = async (projectId: string) => {
    const projectName = projects.find(p => p.id === projectId)?.name || 'Проект';
    await deleteProject(projectId);
    toast.success(`Проект "${projectName}" удалён`);
  };

  if (projectsLoading) {
    return (
      <div className="w-full h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f97316] via-[#fb923c] to-[#fdba74] flex items-center justify-center shadow-lg shadow-[#f97316]/20 animate-pulse">
            <Video className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <p className="text-slate-500 text-sm font-medium">Загрузка проектов...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-screen text-foreground overflow-hidden bg-[#fafafa] flex">
      {/* Clean gradient blobs - orange gradient from top - более контрастный */}
      <div className="fixed top-[-10%] right-[-5%] w-[70%] h-[70%] bg-gradient-to-b from-[#f97316]/60 via-[#fb923c]/40 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed top-[-5%] left-[-5%] w-[60%] h-[60%] bg-gradient-to-br from-[#f97316]/55 via-[#fb923c]/35 to-transparent rounded-full blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-20%] left-[-10%] w-[60%] h-[60%] bg-gradient-to-tr from-neutral-900/20 via-neutral-800/12 to-transparent rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed top-[40%] left-[30%] w-[40%] h-[40%] bg-gradient-to-r from-[#f97316]/30 via-[#fb923c]/20 to-neutral-900/10 rounded-full blur-[100px] pointer-events-none" />
      
      {/* Noise texture overlay */}
      <div className="fixed inset-0 opacity-[0.02] pointer-events-none" style={{
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
      }} />

      {/* Animated Sidebar */}
      <Sidebar open={sidebarExpanded} setOpen={setSidebarExpanded}>
        <SidebarBody className="justify-between gap-6">
          <div className={cn(
            "flex flex-col flex-1 overflow-y-auto overflow-x-hidden",
            sidebarExpanded ? "custom-scrollbar-light" : "scrollbar-hide"
          )}>
            {/* Logo */}
            <SidebarLogo />
            
            {/* Navigation */}
            <SidebarSection title="Навигация">
              <div className="space-y-0.5">
                <SidebarLink
                  icon={<LayoutGrid className="w-4 h-4" strokeWidth={2.5} />}
                  label="Лента"
                  onClick={() => setViewMode('workspace')}
                  isActive={viewMode === 'workspace'}
                  badge={videos.length}
                />
                <SidebarLink
                  icon={<Radar className="w-4 h-4" strokeWidth={2.5} />}
                  label="Радар"
                  onClick={() => { setSearchTab('radar'); setIsSearchOpen(true); }}
                />
                <SidebarLink
                  icon={<Link className="w-4 h-4" strokeWidth={2.5} />}
                  label="Поиск по ссылке"
                  onClick={() => { setSearchTab('link'); setIsSearchOpen(true); }}
                />
                <SidebarLink
                  icon={<Search className="w-4 h-4" strokeWidth={2.5} />}
                  label="Глобальный поиск"
                  onClick={() => { setSearchTab('search'); setIsSearchOpen(true); }}
                />
                <SidebarLink
                  icon={<Clock className="w-4 h-4" strokeWidth={2.5} />}
                  label="История"
                  onClick={() => setViewMode('history')}
                  isActive={viewMode === 'history'}
                />
              </div>
            </SidebarSection>
            
            {/* Projects */}
            <SidebarSection title="Проекты" onAdd={() => setIsCreateProjectOpen(true)}>
              <div className="space-y-1">
                {projects.length === 0 ? (
                  <button
                  onClick={() => setIsCreateProjectOpen(true)}
                  className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl border-2 border-dashed border-slate-200/60 text-slate-400 hover:border-[#f97316]/30 hover:text-[#f97316] transition-all hover:bg-white/30 backdrop-blur-sm"
                  >
                    <Plus className="w-5 h-5 flex-shrink-0" strokeWidth={2.5} />
                  </button>
                ) : (
                  <>
                    {/* Свои проекты */}
                    {projects.filter((p: any) => !p.isShared).length > 0 && (
                      <div className="space-y-1">
                        {projects.filter((p: any) => !p.isShared).map((project: any) => (
                          <div key={project.id} className="relative group">
                            <SidebarProject
                              name={project.name}
                              color={project.color}
                              isActive={currentProjectId === project.id}
                              onClick={() => selectProject(project.id)}
                              onEdit={() => setEditingProject({ id: project.id, name: project.name, color: project.color })}
                              icon={<FolderOpen className="w-4 h-4" style={{ color: project.color || '#f97316' }} strokeWidth={2.5} />}
                            />
                            {currentProjectId === project.id && (
                              <button
                                onClick={() => setIsMembersModalOpen(true)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/80"
                                title="Управление участниками"
                              >
                                <Users className="w-3.5 h-3.5 text-slate-600" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Общие проекты */}
                    {projects.filter((p: any) => p.isShared).length > 0 && (
                      <>
                        <div className="pt-2 mt-2 border-t border-slate-200/60">
                          <p className="px-3 py-1 text-xs font-medium text-slate-500 uppercase tracking-wider">Общие проекты</p>
                        </div>
                        <div className="space-y-1">
                          {projects.filter((p: any) => p.isShared).map((project: any) => (
                            <div key={project.id} className="relative group">
                              <SidebarProject
                                name={project.name}
                                color={project.color}
                                isActive={currentProjectId === project.id}
                                onClick={() => selectProject(project.id)}
                                onEdit={() => setEditingProject({ id: project.id, name: project.name, color: project.color })}
                                icon={<FolderOpen className="w-4 h-4" style={{ color: project.color || '#f97316' }} strokeWidth={2.5} />}
                              />
                              {currentProjectId === project.id && (
                                <button
                                  onClick={() => setIsMembersModalOpen(true)}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg bg-white/60 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/80"
                                  title="Управление участниками"
                                >
                                  <Users className="w-3.5 h-3.5 text-slate-600" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>
            </SidebarSection>
          </div>
          
          {/* Bottom Actions */}
          <div className="space-y-0.5">
            <SidebarDivider />
            <SidebarLink
              icon={<User className="w-4 h-4" strokeWidth={2.5} />}
              label="Профиль"
              onClick={() => setViewMode('profile')}
              isActive={viewMode === 'profile'}
            />
            <SidebarLink
              icon={<Settings className="w-4 h-4" strokeWidth={2.5} />}
              label="Настройки"
              onClick={() => toast.info('Настройки скоро будут доступны')}
            />
            <SidebarLink
              icon={<LogOut className="w-4 h-4" strokeWidth={2.5} />}
              label="Выйти"
              onClick={logout}
              variant="danger"
            />
          </div>
        </SidebarBody>
      </Sidebar>

      {/* Main Content */}
      <div className="flex-1 h-screen overflow-hidden">
        {viewMode === 'workspace' && <Workspace />}
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
      {isCreateProjectOpen && (
        <CreateProjectModal
          onSave={handleCreateProject}
          onClose={() => setIsCreateProjectOpen(false)}
        />
      )}

      {/* Edit Project Modal */}
      {editingProject && (
        <EditProjectModal
          project={editingProject}
          onSave={handleEditProject}
          onDelete={handleDeleteProject}
          onClose={() => setEditingProject(null)}
        />
      )}

      {/* Members Modal */}
      {isMembersModalOpen && currentProjectId && (
        <ProjectMembersModal
          projectId={currentProjectId}
          isOpen={isMembersModalOpen}
          onClose={() => setIsMembersModalOpen(false)}
        />
      )}

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
      <div className="w-full h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="flex flex-col items-center gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#f97316] via-[#fb923c] to-[#fdba74] flex items-center justify-center shadow-lg shadow-[#f97316]/20 animate-pulse">
            <Video className="w-8 h-8 text-white" strokeWidth={2.5} />
          </div>
          <p className="text-slate-500 text-sm font-medium">Загрузка...</p>
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
