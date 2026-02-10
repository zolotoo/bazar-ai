import { useState, useEffect } from 'react';
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
  onSuccess?: (prompt: string) => void | Promise<void>;
  /** При true — спрашиваем название стиля сразу (для каруселей) */
  fromCarousel?: boolean;
  /** Явный projectId — когда открыто из карусели, чтобы сохранить подчерк в проект карусели */
  targetProjectId?: string | null;
}

export function StyleTrainModal({
  open,
  onClose,
  creatingNewStyle = false,
  newStyleName = '',
  setNewStyleName = () => {},
  editingStyle = null,
  onSuccess,
  fromCarousel = false,
  targetProjectId,
}: StyleTrainModalProps) {
  const { videos: projectVideos } = useInboxVideos();
  const { carousels: projectCarousels } = useCarousels();
  const { currentProject, updateProject, addProjectStyle, updateProjectStyle } = useProjectContext();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [trainStep, setTrainStep] = useState<'select' | 'verify'>('select');
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftMeta, setDraftMeta] = useState<{ rules?: string[]; doNot?: string[]; summary?: string }>({});
  const [trainClarifyQuestions, setTrainClarifyQuestions] = useState<string[]>([]);
  const [trainClarifyIndex, setTrainClarifyIndex] = useState(0);
  const [trainClarifyAnswers, setTrainClarifyAnswers] = useState<Record<number, string>>({});
  const [isRefining, setIsRefining] = useState(false);

  useEffect(() => {
    if (!open) {
      setTrainStep('select');
      setDraftPrompt('');
      setTrainClarifyQuestions([]);
      setTrainClarifyIndex(0);
      setTrainClarifyAnswers({});
    }
  }, [open]);

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

  const needStyleName = creatingNewStyle || editingStyle?.id === 'legacy';
  const projectId = targetProjectId || currentProject?.id;

  const saveStyle = async (
    pid: string,
    styleName: string,
    prompt: string,
    meta: { rules?: string[]; doNot?: string[]; summary?: string },
    examplesCount: number,
    editing?: { id: string; name: string } | null,
    creating?: boolean
  ) => {
    if (creating || editing?.id === 'legacy') {
      const finalName = editing?.id === 'legacy' ? (styleName || editing.name || 'Подчерк по умолчанию') : styleName;
      await addProjectStyle(pid, { name: finalName, prompt, meta, examplesCount });
      toast.success(`Подчерк «${finalName}» создан по ${examplesCount} пример${examplesCount === 1 ? 'у' : examplesCount < 5 ? 'ам' : 'ам'}`);
    } else if (editing) {
      await updateProjectStyle(pid, editing.id, { prompt, meta, examplesCount });
      toast.success(`Подчерк «${editing.name}» обновлён`);
    } else {
      await addProjectStyle(pid, { name: 'Подчерк по умолчанию', prompt, meta, examplesCount });
      await updateProject(pid, { stylePrompt: undefined, styleMeta: undefined, styleExamplesCount: 0 });
      toast.success(`Подчерк обучен по ${examplesCount} пример${examplesCount === 1 ? 'у' : examplesCount < 5 ? 'ам' : 'ам'}`);
    }
  };

  const handleTrain = async () => {
    if (!projectId || selectedIds.length === 0) return;
    const name = needStyleName ? newStyleName.trim() : editingStyle?.name || 'Подчерк';
    if (needStyleName && !name) {
      toast.error('Введите название подчерка');
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
        const questions = data.clarifying_questions || [];
        if (questions.length > 0) {
          setDraftPrompt(data.prompt);
          setDraftMeta(data.meta || {});
          setTrainClarifyQuestions(questions);
          setTrainClarifyIndex(0);
          setTrainClarifyAnswers({});
          setTrainStep('verify');
          return;
        }
        await saveStyle(projectId, name, data.prompt, data.meta, examples.length, editingStyle, creatingNewStyle);
        await onSuccess?.(data.prompt);
        onClose();
        setSelectedIds([]);
      } else {
        toast.error(data.error || 'Ошибка анализа подчерка');
      }
    } catch (err) {
      console.error('Train style error:', err);
      const msg = err instanceof Error ? err.message : '';
      toast.error(msg?.includes('сохранить') ? msg : 'Ошибка обучения подчерка');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const currentAnswer = trainClarifyAnswers[trainClarifyIndex] ?? '';
  const isLastQuestion = trainClarifyIndex >= trainClarifyQuestions.length - 1;

  const handleVerifySubmit = async () => {
    const q = trainClarifyQuestions[trainClarifyIndex];
    if (!q || !projectId) return;
    const answer = currentAnswer.trim();
    const nextAnswers = { ...trainClarifyAnswers, [trainClarifyIndex]: answer };
    setTrainClarifyAnswers(nextAnswers);
    if (!isLastQuestion) {
      setTrainClarifyIndex((i) => i + 1);
      return;
    }
    await finishVerify(nextAnswers);
  };

  const finishVerify = async (answers: Record<number, string>) => {
    if (!projectId || !draftPrompt) return;
    const examples = selectedIds
      .map((id) => candidates.find((x) => x.id === id))
      .filter((x): x is ExampleWithScript => Boolean(x))
      .map((x) => ({
        transcript_text: x.transcript_text,
        translation_text: isRussian(x.transcript_text || '') ? '' : (x.translation_text || ''),
        script_text: x.script_text,
      }));
    const firstEx = examples[0];
    if (!firstEx?.transcript_text || !firstEx?.script_text) {
      await saveStyle(projectId, needStyleName ? newStyleName.trim() : editingStyle?.name || 'Подчерк', draftPrompt, draftMeta, examples.length, editingStyle, creatingNewStyle);
      await onSuccess?.(draftPrompt);
      onClose();
      setSelectedIds([]);
      setTrainStep('select');
      return;
    }
    const answersText = trainClarifyQuestions
      .map((question, i) => {
        const a = answers[i] ?? '';
        return `Уточняющий вопрос: ${question}\nОтвет: ${a || '(пропущено)'}`;
      })
      .join('\n\n');
    const feedback = `Ответы на уточняющие вопросы по обучению (примени изменения к промту):\n\n${answersText}`;
    setIsRefining(true);
    try {
      const res = await fetch('/api/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: draftPrompt,
          transcript_text: firstEx.transcript_text,
          translation_text: firstEx.translation_text || '',
          script_text: firstEx.script_text,
          feedback,
        }),
      });
      const data = await res.json();
      if (data.success && data.prompt) {
        await saveStyle(projectId, needStyleName ? newStyleName.trim() : editingStyle?.name || 'Подчерк', data.prompt, data.meta || draftMeta, examples.length, editingStyle, creatingNewStyle);
        await onSuccess?.(data.prompt);
        onClose();
        setSelectedIds([]);
        setTrainStep('select');
      } else {
        toast.error(data.error || 'Ошибка уточнения');
      }
    } catch (err) {
      console.error('Verify refine error:', err);
      toast.error('Ошибка уточнения промта');
    } finally {
      setIsRefining(false);
    }
  };

  const handleVerifySkipAll = async () => {
    if (!projectId || !draftPrompt) return;
    const examples = selectedIds
      .map((id) => candidates.find((x) => x.id === id))
      .filter((x): x is ExampleWithScript => Boolean(x));
    await saveStyle(projectId, needStyleName ? newStyleName.trim() : editingStyle?.name || 'Подчерк', draftPrompt, draftMeta, examples.length, editingStyle, creatingNewStyle);
    await onSuccess?.(draftPrompt);
    onClose();
    setSelectedIds([]);
    setTrainStep('select');
    toast.success('Подчерк сохранён без уточнений');
  };

  const handleVerifyBack = () => {
    if (trainClarifyIndex > 0) {
      setTrainClarifyIndex((i) => i - 1);
    } else {
      setTrainStep('select');
      setDraftPrompt('');
      setTrainClarifyQuestions([]);
    }
  };

  if (!open) return null;

  const showVerifyStep = trainStep === 'verify' && trainClarifyQuestions.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => !isAnalyzing && !isRefining && onClose()}>
      <div className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-md w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {showVerifyStep ? (
          <>
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">Уточнение понимания</h3>
              <p className="text-slate-500 text-sm mt-1">
                Нейросеть сформировала промт. Подтвердите или скорректируйте ключевые моменты — это улучшит результат.
              </p>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-slate-600 text-sm mb-4">{trainClarifyQuestions[trainClarifyIndex]}</p>
              <textarea
                value={currentAnswer}
                onChange={(e) => setTrainClarifyAnswers((prev) => ({ ...prev, [trainClarifyIndex]: e.target.value }))}
                placeholder="Ваш ответ..."
                className="w-full min-h-[80px] p-3 rounded-xl border border-slate-200 text-sm text-slate-700 focus:ring-2 focus:ring-slate-200 focus:border-slate-400 resize-y"
                disabled={isRefining}
              />
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-xs text-slate-400">
                {trainClarifyIndex + 1} из {trainClarifyQuestions.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleVerifyBack}
                  disabled={isRefining}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  {trainClarifyIndex > 0 ? 'Назад' : 'Отмена'}
                </button>
                <button
                  type="button"
                  onClick={handleVerifySkipAll}
                  disabled={isRefining}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
                >
                  Сохранить без уточнений
                </button>
                <button
                  type="button"
                  onClick={handleVerifySubmit}
                  disabled={isRefining}
                  className="px-4 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-2"
                >
                  {isRefining ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Уточняю...
                    </>
                  ) : isLastQuestion ? (
                    'Готово'
                  ) : (
                    'Далее'
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
        <div className="p-4 border-b border-slate-100 flex flex-col gap-3">
          {fromCarousel && creatingNewStyle && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Как назвать этот подчерк?</label>
              <input
                type="text"
                value={newStyleName}
                onChange={(e) => setNewStyleName(e.target.value)}
                placeholder="Например: Карусели Гальв, Короткие посты"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
                autoFocus
              />
            </div>
          )}
          <div>
            <h3 className="font-semibold text-slate-800">
              {creatingNewStyle ? 'Создать новый подчерк' : editingStyle ? `Переобучить «${editingStyle.name}»` : 'Обучить подчерк по примерам'}
            </h3>
            <p className="text-slate-500 text-sm mt-1">
              {creatingNewStyle
                ? fromCarousel
                  ? 'Выберите 1–5 каруселей или рилсов с транскриптом и сценарием. Нейросеть создаст промт.'
                  : 'Выберите 1–5 рилсов или каруселей с транскриптом и вашим сценарием. Нейросеть создаст промт и вы назовёте этот подчерк.'
                : editingStyle
                ? 'Выберите примеры заново. Промт подчерка будет заменён.'
                : currentProject?.stylePrompt
                ? 'Выберите примеры заново (можно добавить новые). Текущий промт будет заменён.'
                : 'Выберите 1–5 рилсов или каруселей с транскриптом и сценарием. Нейросеть выявит закономерности.'}
            </p>
          </div>
          {needStyleName && !(fromCarousel && creatingNewStyle) && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Название подчерка</label>
              <input
                type="text"
                value={newStyleName}
                onChange={(e) => setNewStyleName(e.target.value)}
                placeholder="Например: Короткие, С хуками, Без воды"
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm focus:ring-2 focus:ring-slate-200 focus:border-slate-400"
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
                  selectedIds.includes(item.id) ? 'border-slate-300 bg-slate-50' : 'border-slate-200 hover:bg-slate-50'
                )}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggle(item.id)}
                  className="rounded border-slate-300 text-slate-600 focus:ring-slate-500"
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
              disabled={isAnalyzing || selectedIds.length === 0 || (needStyleName && !newStyleName.trim())}
              className="px-4 py-1.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium flex items-center gap-2 disabled:opacity-50"
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
          </>
        )}
      </div>
    </div>
  );
}
