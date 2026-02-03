import { useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '../utils/cn';
import { toast } from 'sonner';
import { useInboxVideos } from '../hooks/useInboxVideos';
import { useCarousels } from '../hooks/useCarousels';
import { useProjectContext } from '../contexts/ProjectContext';
import { isRussian } from '../utils/language';
import { TokenBadge } from './ui/TokenBadge';
import { getTokenCost } from '../constants/tokenCosts';

type ExampleWithScript = {
  id: string;
  title?: string;
  type: 'video' | 'carousel';
  transcript_text?: string;
  translation_text?: string;
  script_text?: string;
};

interface StyleTrainModalProps {
  open: boolean;
  onClose: () => void;
  creatingNewStyle?: boolean;
  newStyleName?: string;
  setNewStyleName?: (v: string) => void;
  editingStyle?: { id: string; name: string } | null;
  onSuccess?: (prompt: string) => void;
}

export function StyleTrainModal({
  open,
  onClose,
  creatingNewStyle = false,
  newStyleName = '',
  setNewStyleName = () => {},
  editingStyle = null,
  onSuccess,
}: StyleTrainModalProps) {
  const { videos: projectVideos } = useInboxVideos();
  const { carousels: projectCarousels } = useCarousels();
  const { currentProject, updateProject, addProjectStyle, updateProjectStyle } = useProjectContext();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const videoCandidates: ExampleWithScript[] = ((projectVideos || []) as { id: string; title?: string; transcript_text?: string; translation_text?: string; script_text?: string }[])
    .filter((v) => v.transcript_text?.trim() && v.script_text?.trim())
    .map((v) => ({ ...v, id: `v-${v.id}`, type: 'video' as const }));
  const carouselCandidates: ExampleWithScript[] = (projectCarousels || [])
    .filter((c) => c.transcript_text?.trim() && c.script_text?.trim())
    .map((c) => ({
      id: `c-${c.id}`,
      title: c.caption?.slice(0, 50) || `Карусель ${c.slide_count || 0} слайдов`,
      type: 'carousel' as const,
      transcript_text: c.transcript_text ?? undefined,
      translation_text: c.translation_text ?? undefined,
      script_text: c.script_text ?? undefined,
    }));
  const candidates = [...videoCandidates, ...carouselCandidates];

  const toggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 5 ? prev : [...prev, id]
    );
  };

  const handleTrain = async () => {
    if (!currentProject?.id || selectedIds.length === 0) return;
    const name = creatingNewStyle ? newStyleName.trim() : editingStyle?.name || 'Стиль';
    if (creatingNewStyle && !name) {
      toast.error('Введите название стиля');
      return;
    }
    const examples = selectedIds
      .map((id) => candidates.find((x) => x.id === id))
      .filter((x): x is ExampleWithScript => Boolean(x))
      .map((x) => ({
        transcript_text: x.transcript_text,
        translation_text: isRussian(x.transcript_text || '') ? '' : (x.translation_text || ''),
        script_text: x.script_text,
      }));
    if (examples.length === 0) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ examples }),
      });
      const data = await res.json();
      if (data.success && data.prompt) {
        if (creatingNewStyle) {
          await addProjectStyle(currentProject.id, {
            name: name || 'Новый стиль',
            prompt: data.prompt,
            meta: data.meta,
            examplesCount: examples.length,
          });
          toast.success(`Стиль «${name}» создан по ${examples.length} пример${examples.length === 1 ? 'у' : examples.length < 5 ? 'ам' : 'ам'}`);
        } else if (editingStyle) {
          await updateProjectStyle(currentProject.id, editingStyle.id, {
            prompt: data.prompt,
            meta: data.meta,
            examplesCount: examples.length,
          });
          toast.success(`Стиль «${editingStyle.name}» обновлён`);
        } else {
          await updateProject(currentProject.id, {
            stylePrompt: data.prompt,
            styleMeta: data.meta,
            styleExamplesCount: examples.length,
          });
          toast.success(`Стиль обучен по ${examples.length} пример${examples.length === 1 ? 'у' : examples.length < 5 ? 'ам' : 'ам'}`);
        }
        onSuccess?.(data.prompt);
        onClose();
        setSelectedIds([]);
      } else {
        toast.error(data.error || 'Ошибка анализа стиля');
      }
    } catch (err) {
      console.error('Train style error:', err);
      toast.error('Ошибка обучения стиля');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !isAnalyzing && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800">
            {creatingNewStyle ? 'Создать новый стиль' : editingStyle ? `Переобучить «${editingStyle.name}»` : 'Обучить стиль по примерам'}
          </h3>
          <p className="text-slate-500 text-sm mt-1">
            {creatingNewStyle
              ? 'Выберите 1–5 рилсов или каруселей с транскриптом и вашим сценарием. Нейросеть создаст промт и вы назовёте этот стиль.'
              : editingStyle
              ? 'Выберите примеры заново. Промт стиля будет заменён.'
              : currentProject?.stylePrompt
              ? 'Выберите примеры заново (можно добавить новые). Текущий промт будет заменён.'
              : 'Выберите 1–5 рилсов или каруселей с транскриптом и сценарием. Нейросеть выявит закономерности.'}
          </p>
          {creatingNewStyle && (
            <div className="mt-3">
              <label className="block text-xs font-medium text-slate-500 mb-1">Название стиля</label>
              <input
                type="text"
                value={newStyleName}
                onChange={(e) => setNewStyleName(e.target.value)}
                placeholder="Например: Короткие, С хуками, Без воды"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400"
              />
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {candidates.length === 0 ? (
            <p className="text-slate-500 text-sm">Нет подходящих рилсов или каруселей: нужны транскрипция и ваш сценарий.</p>
          ) : (
            candidates.map((item) => (
              <label
                key={item.id}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors',
                  selectedIds.includes(item.id) ? 'border-violet-300 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggle(item.id)}
                  className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                  {item.type === 'video' ? 'Рилс' : 'Карусель'}
                </span>
                <span className="text-sm text-slate-700 truncate min-w-0">{item.title || item.id}</span>
              </label>
            ))
          )}
        </div>
        <div className="p-4 border-t border-slate-100 flex justify-between items-center">
          <span className="text-xs text-slate-400">Выбрано: {selectedIds.length} из 5</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isAnalyzing}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={handleTrain}
              disabled={isAnalyzing || selectedIds.length === 0}
              className="px-4 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Анализ...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Анализировать и сохранить
                  <TokenBadge tokens={getTokenCost('train_style')} variant="dark" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
