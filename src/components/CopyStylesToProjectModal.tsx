import { useState } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useProjectContext, type Project, type ProjectStyle } from '../contexts/ProjectContext';

interface CopyStylesToProjectModalProps {
  open: boolean;
  onClose: () => void;
  /** Проект-источник (текущий): из него копируем все стили */
  sourceProject: Project | null;
}

/** Собирает все стили проекта для копирования: project_styles + legacy stylePrompt */
function getStylesToCopy(project: Project | null): Omit<ProjectStyle, 'id'>[] {
  if (!project) return [];
  const list: Omit<ProjectStyle, 'id'>[] = [];
  const styles = project.projectStyles || [];
  const realStyles = styles.filter((s) => s.id !== 'legacy');
  realStyles.forEach((s) => list.push({ name: s.name, prompt: s.prompt, meta: s.meta, examplesCount: s.examplesCount }));
  if (project.stylePrompt && realStyles.length === 0) {
    list.push({
      name: 'Подчерк по умолчанию',
      prompt: project.stylePrompt,
      meta: project.styleMeta,
      examplesCount: project.styleExamplesCount ?? 0,
    });
  }
  return list;
}

export function CopyStylesToProjectModal({
  open,
  onClose,
  sourceProject,
}: CopyStylesToProjectModalProps) {
  const { projects, addProjectStyle, refetch } = useProjectContext();
  const [targetProjectId, setTargetProjectId] = useState<string>('');
  const [isCopying, setIsCopying] = useState(false);

  const stylesToCopy = getStylesToCopy(sourceProject);
  const otherProjects = (projects || []).filter((p) => p.id !== sourceProject?.id);

  const handleCopy = async () => {
    if (!sourceProject?.id || !targetProjectId || stylesToCopy.length === 0) return;
    setIsCopying(true);
    try {
      for (const style of stylesToCopy) {
        await addProjectStyle(targetProjectId, style);
      }
      await refetch();
      const targetName = otherProjects.find((p) => p.id === targetProjectId)?.name || 'проект';
      toast.success(
        stylesToCopy.length === 1
          ? `Подчерк «${stylesToCopy[0].name}» скопирован в «${targetName}»`
          : `ИИ-сценарист (${stylesToCopy.length} подчерков) скопирован в «${targetName}»`
      );
      onClose();
      setTargetProjectId('');
    } catch (err) {
      console.error('Copy styles error:', err);
      toast.error('Не удалось скопировать подчерки');
    } finally {
      setIsCopying(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={() => !isCopying && onClose()}
    >
      <div
        className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-semibold text-slate-800 mb-1">Скопировать подчерки в другой проект</h3>
        <p className="text-slate-500 text-sm mb-4">
          Все подчерки сценариев из «{sourceProject?.name}» ({stylesToCopy.length}{' '}
          {stylesToCopy.length === 1 ? 'подчерк' : stylesToCopy.length < 5 ? 'подчерка' : 'подчерков'}) будут добавлены в выбранный проект.
        </p>
        {otherProjects.length === 0 ? (
          <p className="text-slate-500 text-sm mb-4">Нет других проектов. Создайте проект в боковой панели.</p>
        ) : (
          <>
            <label className="block text-sm font-medium text-slate-700 mb-2">Куда копировать?</label>
            <select
              value={targetProjectId}
              onChange={(e) => setTargetProjectId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-slate-800 text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400 mb-4"
            >
              <option value="">Выберите проект</option>
              {otherProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </>
        )}
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={isCopying}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleCopy}
            disabled={isCopying || !targetProjectId || otherProjects.length === 0}
            className="px-4 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
          >
            {isCopying ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Копирую...
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Скопировать
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
