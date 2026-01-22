import { createContext, useContext, ReactNode } from 'react';
import { useProjects, Project, ProjectFolder } from '../hooks/useProjects';

interface ProjectContextType {
  projects: Project[];
  currentProject: Project | null;
  currentProjectId: string | null;
  loading: boolean;
  createProject: (name: string, color?: string) => Promise<Project | null>;
  updateProject: (projectId: string, updates: Partial<Pick<Project, 'name' | 'color' | 'icon' | 'folders'>>) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  selectProject: (projectId: string) => void;
  addFolder: (projectId: string, folderName: string) => Promise<void>;
  removeFolder: (projectId: string, folderId: string) => Promise<ProjectFolder | null>;
  restoreFolder: (folderData: any) => Promise<boolean>;
  updateFolder: (projectId: string, folderId: string, updates: Partial<Omit<ProjectFolder, 'id'>>) => Promise<void>;
  reorderFolders: (projectId: string, newOrder: string[]) => Promise<void>;
  refetch: () => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const projectsState = useProjects();

  return (
    <ProjectContext.Provider value={projectsState}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProjectContext() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }
  return context;
}

export type { Project, ProjectFolder };
