import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabase';
import { useAuth } from './useAuth';

export interface ProjectFolder {
  id: string;
  name: string;
  color: string;
  icon: string;
  order: number;
}

export interface Project {
  id: string;
  name: string;
  color: string;
  icon: string;
  folders: ProjectFolder[];
  createdAt: Date;
  isShared?: boolean; // Флаг для общих проектов
}

const DEFAULT_FOLDERS: Omit<ProjectFolder, 'id'>[] = [
  { name: 'Все видео', color: '#64748b', icon: 'all', order: 0 },
  { name: 'Идеи', color: '#f97316', icon: 'lightbulb', order: 1 },
  { name: 'Ожидает сценария', color: '#6366f1', icon: 'file', order: 2 },
  { name: 'Ожидает съёмок', color: '#f59e0b', icon: 'camera', order: 3 },
  { name: 'Ожидает монтажа', color: '#10b981', icon: 'scissors', order: 4 },
  { name: 'Готовое', color: '#8b5cf6', icon: 'check', order: 5 },
  { name: 'Не подходит', color: '#ef4444', icon: 'rejected', order: 6 },
];

const PROJECT_COLORS = [
  '#f97316', // orange
  '#6366f1', // indigo
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#ef4444', // red
];

export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const getUserId = useCallback((): string => {
    if (user?.telegram_username) {
      return `tg-${user.telegram_username}`;
    }
    return 'anonymous';
  }, [user]);

  // Загрузка проектов (включая общие)
  const fetchProjects = useCallback(async () => {
    const userId = getUserId();
    setLoading(true);
    
    try {
      // Загружаем собственные проекты
      const { data: ownProjects, error: ownError } = await supabase
        .from('projects')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: true });

      // Загружаем общие проекты (где пользователь является участником)
      const { data: sharedMemberships } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', userId)
        .eq('status', 'active');

      let sharedProjects = [];
      if (sharedMemberships && sharedMemberships.length > 0) {
        const sharedProjectIds = sharedMemberships.map(m => m.project_id);
        const { data: shared } = await supabase
          .from('projects')
          .select('*')
          .in('id', sharedProjectIds)
          .order('created_at', { ascending: true });
        sharedProjects = shared || [];
      }

      if (ownError) {
        throw ownError;
      }

      const allProjects = [
        ...(ownProjects || []).map(p => ({ ...p, isShared: false })),
        ...sharedProjects.map(p => ({ ...p, isShared: true })),
      ];

      if (allProjects.length > 0) {
        const loadedProjects: Project[] = allProjects.map(p => ({
          id: p.id,
          name: p.name,
          color: p.color || '#f97316',
          icon: p.icon || 'folder',
          folders: p.folders || DEFAULT_FOLDERS.map((f, i) => ({ ...f, id: `folder-${i}` })),
          createdAt: new Date(p.created_at),
        }));
        setProjects(loadedProjects);
        
        // Устанавливаем текущий проект
        const savedProjectId = localStorage.getItem('currentProjectId');
        if (savedProjectId && loadedProjects.find(p => p.id === savedProjectId)) {
          setCurrentProjectId(savedProjectId);
        } else {
          setCurrentProjectId(loadedProjects[0].id);
        }
      } else {
          setCurrentProjectId(loadedProjects[0].id);
        }
      } else {
        // Создаем дефолтный проект
        const defaultProject: Project = {
          id: `project-${Date.now()}`,
          name: 'Мой проект',
          color: '#f97316',
          icon: 'folder',
          folders: DEFAULT_FOLDERS.map((f, i) => ({ ...f, id: `folder-${Date.now()}-${i}` })),
          createdAt: new Date(),
        };
        
        // Пробуем сохранить в базу
        try {
          await supabase.from('projects').insert({
            id: defaultProject.id,
            user_id: userId,
            owner_id: userId, // Устанавливаем владельца
            name: defaultProject.name,
            color: defaultProject.color,
            icon: defaultProject.icon,
            folders: defaultProject.folders,
          });
        } catch (e) {
          console.error('Failed to save default project:', e);
        }
        
        setProjects([defaultProject]);
        setCurrentProjectId(defaultProject.id);
      }
    } catch (err) {
      console.error('Failed to load projects:', err);
      // Fallback - создаём локальный проект
      const defaultProject: Project = {
        id: `project-${Date.now()}`,
        name: 'Мой проект',
        color: '#f97316',
        icon: 'folder',
        folders: DEFAULT_FOLDERS.map((f, i) => ({ ...f, id: `folder-${Date.now()}-${i}` })),
        createdAt: new Date(),
      };
      setProjects([defaultProject]);
      setCurrentProjectId(defaultProject.id);
    } finally {
      setLoading(false);
    }
  }, [getUserId]);

  // Создание проекта
  const createProject = useCallback(async (name: string, customColor?: string): Promise<Project | null> => {
    const userId = getUserId();
    const color = customColor || PROJECT_COLORS[projects.length % PROJECT_COLORS.length];
    
    const newProject: Omit<Project, 'createdAt'> = {
      id: `project-${Date.now()}`,
      name,
      color,
      icon: 'folder',
      folders: DEFAULT_FOLDERS.map((f, i) => ({ ...f, id: `folder-${Date.now()}-${i}` })),
    };

    const project: Project = { ...newProject, createdAt: new Date() };

    try {
      const { error } = await supabase
        .from('projects')
        .insert({
          id: newProject.id,
          user_id: userId,
          owner_id: userId, // Устанавливаем владельца
          name: newProject.name,
          color: newProject.color,
          icon: newProject.icon,
          folders: newProject.folders,
        });

      if (error) {
        console.error('Error creating project:', error);
        // Всё равно добавляем в локальный state (fallback)
      }
    } catch (err) {
      console.error('Failed to create project:', err);
    }
    
    // Всегда добавляем проект в state (даже если Supabase не работает)
    setProjects(prev => [...prev, project]);
    return project;
  }, [getUserId, projects.length]);

  // Обновление проекта
  const updateProject = useCallback(async (projectId: string, updates: Partial<Pick<Project, 'name' | 'color' | 'icon' | 'folders'>>) => {
    try {
      const { error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', projectId);

      if (error) {
        console.error('Error updating project:', error);
        return;
      }

      setProjects(prev => prev.map(p => 
        p.id === projectId ? { ...p, ...updates } : p
      ));
    } catch (err) {
      console.error('Failed to update project:', err);
    }
  }, []);

  // Удаление проекта
  const deleteProject = useCallback(async (projectId: string) => {
    if (projects.length <= 1) {
      console.warn('Cannot delete the last project');
      return;
    }

    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', projectId);

      if (error) {
        console.error('Error deleting project:', error);
        return;
      }

      setProjects(prev => {
        const newProjects = prev.filter(p => p.id !== projectId);
        if (currentProjectId === projectId && newProjects.length > 0) {
          setCurrentProjectId(newProjects[0].id);
        }
        return newProjects;
      });
    } catch (err) {
      console.error('Failed to delete project:', err);
    }
  }, [projects.length, currentProjectId]);

  // Выбор текущего проекта
  const selectProject = useCallback((projectId: string) => {
    setCurrentProjectId(projectId);
    localStorage.setItem('currentProjectId', projectId);
  }, []);

  // Добавление папки в проект
  const addFolder = useCallback(async (projectId: string, folderName: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newFolder: ProjectFolder = {
      id: `folder-${Date.now()}`,
      name: folderName,
      color: PROJECT_COLORS[project.folders.length % PROJECT_COLORS.length],
      icon: 'folder',
      order: project.folders.length,
    };

    const updatedFolders = [...project.folders, newFolder];
    await updateProject(projectId, { folders: updatedFolders });
  }, [projects, updateProject]);

  // Удаление папки из проекта
  // Возвращает данные удаленной папки для возможности отмены
  const removeFolder = useCallback(async (projectId: string, folderId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return null;

    // Сохраняем данные папки перед удалением
    const folderToDelete = project.folders.find(f => f.id === folderId);
    const folderData = folderToDelete ? { ...folderToDelete, projectId } : null;

    const updatedFolders = project.folders.filter(f => f.id !== folderId);
    await updateProject(projectId, { folders: updatedFolders });
    
    return folderData;
  }, [projects, updateProject]);

  // Восстановление удаленной папки
  const restoreFolder = useCallback(async (folderData: any) => {
    if (!folderData || !folderData.projectId) return false;
    
    const project = projects.find(p => p.id === folderData.projectId);
    if (!project) return false;
    
    // Проверяем что папки с таким ID еще нет
    const folderExists = project.folders.some(f => f.id === folderData.id);
    if (folderExists) return false;
    
    // Восстанавливаем папку
    const updatedFolders = [...project.folders, folderData].sort((a, b) => a.order - b.order);
    await updateProject(folderData.projectId, { folders: updatedFolders });
    
    return true;
  }, [projects, updateProject]);

  // Обновление папки
  const updateFolder = useCallback(async (
    projectId: string, 
    folderId: string, 
    updates: Partial<Omit<ProjectFolder, 'id'>>
  ) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const updatedFolders = project.folders.map(f => 
      f.id === folderId ? { ...f, ...updates } : f
    );
    await updateProject(projectId, { folders: updatedFolders });
  }, [projects, updateProject]);

  // Изменение порядка папок
  const reorderFolders = useCallback(async (projectId: string, newOrder: string[]) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const reorderedFolders = newOrder
      .map((id, index) => {
        const folder = project.folders.find(f => f.id === id);
        return folder ? { ...folder, order: index } : null;
      })
      .filter((f): f is ProjectFolder => f !== null);

    await updateProject(projectId, { folders: reorderedFolders });
  }, [projects, updateProject]);

  // Текущий проект
  const currentProject = projects.find(p => p.id === currentProjectId) || null;

  useEffect(() => {
    if (user) {
      fetchProjects();
    }
  }, [user, fetchProjects]);

  return {
    projects,
    currentProject,
    currentProjectId,
    loading,
    createProject,
    updateProject,
    deleteProject,
    selectProject,
    addFolder,
    removeFolder,
    restoreFolder,
    updateFolder,
    reorderFolders,
    refetch: fetchProjects,
  };
}
