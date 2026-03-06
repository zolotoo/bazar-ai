import { useState, useCallback, useRef } from 'react';
import { useProjectContext } from '../contexts/ProjectContext';
import { useScriptDrafts, type ScriptDraft } from '../hooks/useScriptDrafts';
import { useTokenBalance } from '../contexts/TokenBalanceContext';
import type { ScriptStructureAnalysis } from '../hooks/useProjects';
import {
  getOrUpdateProfileStats,
  calculateViralMultiplier,
  getViralMultiplierColor,
} from '../services/profileStatsService';
import { uploadScriptCover } from '../utils/generateScriptCover';
import { getTokenCost } from '../constants/tokenCosts';
import { TokenBadge } from './ui/TokenBadge';
import { cn } from '../utils/cn';
import { toast } from 'sonner';
import {
  Sparkles, Plus, ArrowLeft, Loader2, Trash2,
  FileText, MessageSquare, Pencil, LayoutGrid,
  AlertTriangle, Link as LinkIcon, Type,
  RotateCcw, Check, FolderOpen, ChevronRight,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────────

type Screen =
  | 'styles-list'
  | 'train-mode-select'
  | 'train-reels'
  | 'train-scripts'
  | 'train-format-select'
  | 'train-analyzing'
  | 'train-verify'
  | 'drafts'
  // Stepped generation flow
  | 'gen-topic'
  | 'gen-clarify'
  | 'gen-hooks'
  | 'gen-body'
  | 'gen-final'
  | 'gen-retrain';

interface ClarifyQuestion {
  question: string;
  options: string[];
}

interface HookVariant {
  text: string;
  approach: string;
}

interface BodyVariant {
  text: string;
  approach: string;
}

interface ReelInput {
  url: string;
  loading: boolean;
  views: number | null;
  ownerUsername: string | null;
  viralMultiplier: number | null;
  error: string | null;
  transcriptText: string | null;
  transcriptLoading: boolean;
}

interface ScriptInput {
  text: string;
}

// ─── Shared UI Components ────────────────────────────────────────────────────

function GlassCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn(
      'rounded-card-xl bg-white/72 backdrop-blur-glass-xl border border-white/55 shadow-glass',
      className
    )}>
      {children}
    </div>
  );
}

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={cn(
            'h-1 rounded-full transition-all duration-300',
            i < current ? 'bg-slate-600 w-6' : i === current ? 'bg-slate-400 w-4' : 'bg-slate-200 w-3'
          )}
        />
      ))}
    </div>
  );
}

function CostButton({
  onClick,
  disabled,
  loading,
  cost,
  children,
  variant = 'primary',
}: {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  cost?: number;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        'flex items-center justify-center gap-2 min-h-[44px] rounded-card-xl font-medium text-sm transition-all active:scale-[0.97] touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed',
        variant === 'primary'
          ? 'bg-slate-600 hover:bg-slate-700 text-white shadow-glass'
          : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
      )}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : children}
      {cost != null && cost > 0 && <TokenBadge tokens={cost} size="sm" variant={variant === 'primary' ? 'dark' : 'default'} />}
    </button>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function AIScriptwriter() {
  const { currentProject, currentProjectId, addProjectStyle, updateProjectStyle } = useProjectContext();
  const { drafts, loading: draftsLoading, createDraft, updateDraft, deleteDraft, addDraftToFeed } = useScriptDrafts();
  const { canAfford, deduct } = useTokenBalance();

  const [screen, setScreen] = useState<Screen>('styles-list');
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);

  // Training state
  const [trainStyleName, setTrainStyleName] = useState('');
  const [trainMode, setTrainMode] = useState<'reels' | 'scripts'>('reels');
  const [reelInputs, setReelInputs] = useState<ReelInput[]>(
    Array.from({ length: 5 }, () => ({
      url: '', loading: false, views: null, ownerUsername: null,
      viralMultiplier: null, error: null, transcriptText: null, transcriptLoading: false,
    }))
  );
  const [scriptInputs, setScriptInputs] = useState<ScriptInput[]>(
    Array.from({ length: 5 }, () => ({ text: '' }))
  );
  const [preferredFormat, setPreferredFormat] = useState<'short' | 'long' | null>(null);
  const [trainAnalyzing, setTrainAnalyzing] = useState(false);
  const [draftPrompt, setDraftPrompt] = useState('');
  const [draftMeta, setDraftMeta] = useState<{ rules?: string[]; doNot?: string[]; summary?: string }>({});
  const [draftStructure, setDraftStructure] = useState<ScriptStructureAnalysis | null>(null);
  const [clarifyQuestions, setClarifyQuestions] = useState<string[]>([]);
  const [clarifyAnswers, setClarifyAnswers] = useState<Record<number, string>>({});
  const [isRefining, setIsRefining] = useState(false);

  // Stepped generation state
  const [genTopic, setGenTopic] = useState('');
  const [genQuestions, setGenQuestions] = useState<ClarifyQuestion[]>([]);
  const [genAnswers, setGenAnswers] = useState<string[]>([]);
  const [genHooks, setGenHooks] = useState<HookVariant[]>([]);
  const [genSelectedHook, setGenSelectedHook] = useState<string>('');
  const [genHookEdited, setGenHookEdited] = useState(false);
  const [genBodies, setGenBodies] = useState<BodyVariant[]>([]);
  const [genSelectedBody, setGenSelectedBody] = useState<string>('');
  const [genBodyEdited, setGenBodyEdited] = useState(false);
  const [genFinalScript, setGenFinalScript] = useState('');
  const [genImproveText, setGenImproveText] = useState('');
  const [genLoading, setGenLoading] = useState(false);
  const currentDraftIdRef = useRef<string | null>(null);

  // Add to feed modal
  const [showAddToFeedModal, setShowAddToFeedModal] = useState(false);
  const [addToFeedDraftId, setAddToFeedDraftId] = useState<string | null>(null);
  const [addToFeedFolder, setAddToFeedFolder] = useState<string | null>(null);
  const [addingToFeed, setAddingToFeed] = useState(false);

  const styles = currentProject?.projectStyles || [];
  const selectedStyle = styles.find(s => s.id === selectedStyleId) || null;

  // ─── Reel Validation ────────────────────────────────────────────────────────

  const validateReelUrl = useCallback(async (index: number, url: string) => {
    if (!url.trim()) return;
    const cost = getTokenCost('sw_validate_reel');
    if (!canAfford(cost)) { toast.error('Недостаточно коинов'); return; }

    setReelInputs(prev => {
      const next = [...prev];
      next[index] = { ...next[index], url, loading: true, error: null, views: null, viralMultiplier: null };
      return next;
    });

    try {
      const res = await fetch('/api/reel-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!data || data.error) {
        setReelInputs(prev => { const n = [...prev]; n[index] = { ...n[index], loading: false, error: data?.error || 'Не удалось получить данные' }; return n; });
        return;
      }
      await deduct(cost);

      const views = data.view_count || 0;
      const ownerUsername = data.owner?.username || data.owner_username || '';
      let viralMultiplier: number | null = null;
      if (ownerUsername) {
        try {
          const profileStats = await getOrUpdateProfileStats(ownerUsername);
          viralMultiplier = calculateViralMultiplier(views, profileStats);
        } catch { /* no stats */ }
      }

      setReelInputs(prev => {
        const n = [...prev];
        n[index] = {
          ...n[index], loading: false, views, ownerUsername, viralMultiplier,
          error: viralMultiplier !== null && viralMultiplier < 10 ? `x${viralMultiplier.toFixed(1)} — не залёт (нужен x10+)` : null,
        };
        return n;
      });
    } catch {
      setReelInputs(prev => { const n = [...prev]; n[index] = { ...n[index], loading: false, error: 'Ошибка загрузки' }; return n; });
    }
  }, [canAfford, deduct]);

  // ─── Training ──────────────────────────────────────────────────────────────

  const transcribeReels = useCallback(async () => {
    const validReels = reelInputs.filter(r => r.url.trim() && r.views !== null);
    for (let i = 0; i < validReels.length; i++) {
      const reel = validReels[i];
      const idx = reelInputs.indexOf(reel);
      if (reel.transcriptText) continue;
      setReelInputs(prev => { const n = [...prev]; n[idx] = { ...n[idx], transcriptLoading: true }; return n; });
      try {
        const cost = getTokenCost('transcribe_video');
        if (!canAfford(cost)) { toast.error('Недостаточно коинов'); return; }
        const res = await fetch('/api/transcribe', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: reel.url }) });
        const data = await res.json();
        await deduct(cost);
        setReelInputs(prev => { const n = [...prev]; n[idx] = { ...n[idx], transcriptLoading: false, transcriptText: data.transcript || data.text || '' }; return n; });
      } catch {
        setReelInputs(prev => { const n = [...prev]; n[idx] = { ...n[idx], transcriptLoading: false, error: 'Ошибка транскрибации' }; return n; });
      }
    }
  }, [reelInputs, canAfford, deduct]);

  const startTraining = useCallback(async () => {
    const cost = getTokenCost('train_style');
    if (!canAfford(cost)) { toast.error('Недостаточно коинов'); return; }
    setTrainAnalyzing(true);

    let scripts: { transcript_text?: string; script_text?: string }[] = [];
    if (trainMode === 'reels') {
      await transcribeReels();
      scripts = reelInputs.filter(r => r.url.trim() && (r.transcriptText || r.views !== null)).map(r => ({ transcript_text: r.transcriptText || '', script_text: r.transcriptText || '' }));
    } else {
      scripts = scriptInputs.filter(s => s.text.trim()).map(s => ({ transcript_text: s.text, script_text: s.text }));
    }
    if (scripts.length < 2) { toast.error('Нужно минимум 2 примера'); setTrainAnalyzing(false); return; }

    const lengths = scripts.map(s => (s.script_text || '').split(/\s+/).length);
    const ratio = Math.max(...lengths) / Math.max(Math.min(...lengths), 1);
    if (ratio > 2 && !preferredFormat) { setTrainAnalyzing(false); setScreen('train-format-select'); return; }

    try {
      await deduct(cost);
      const res = await fetch('/api/scriptwriter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'analyze-structure', scripts, training_mode: trainMode, preferred_format: preferredFormat }) });
      const data = await res.json();
      if (!data.success) { toast.error(data.error || 'Ошибка анализа'); setTrainAnalyzing(false); return; }

      setDraftPrompt(data.prompt);
      setDraftMeta(data.meta || {});
      setDraftStructure(data.structure_analysis || null);

      if (data.clarifying_questions?.length) {
        setClarifyQuestions(data.clarifying_questions);
        setClarifyAnswers({});
        setTrainAnalyzing(false);
        setScreen('train-verify');
      } else {
        await saveStyle(data.prompt, data.meta, data.structure_analysis);
        setTrainAnalyzing(false);
        setScreen('styles-list');
        toast.success('Подчерк создан!');
      }
    } catch { toast.error('Ошибка обучения'); setTrainAnalyzing(false); }
  }, [trainMode, reelInputs, scriptInputs, preferredFormat, transcribeReels, canAfford, deduct]);

  const saveStyle = useCallback(async (prompt: string, meta: { rules?: string[]; doNot?: string[]; summary?: string }, structureAnalysis?: ScriptStructureAnalysis | null) => {
    if (!currentProjectId) return;
    const examplesCount = trainMode === 'reels' ? reelInputs.filter(r => r.url.trim()).length : scriptInputs.filter(s => s.text.trim()).length;
    const trainingExamples = trainMode === 'reels'
      ? reelInputs.filter(r => r.url.trim()).map(r => ({ url: r.url, viralMultiplier: r.viralMultiplier ?? undefined, scriptLength: (r.transcriptText || '').split(/\s+/).length }))
      : scriptInputs.filter(s => s.text.trim()).map(s => ({ scriptLength: s.text.split(/\s+/).length }));
    await addProjectStyle(currentProjectId, { name: trainStyleName || 'Новый подчерк', prompt, meta, examplesCount, trainingMode: trainMode, preferredFormat: preferredFormat || undefined, structureAnalysis: structureAnalysis || undefined, trainingExamples });
  }, [currentProjectId, trainMode, trainStyleName, reelInputs, scriptInputs, preferredFormat, addProjectStyle]);

  const handleClarifySubmit = useCallback(async () => {
    const cost = getTokenCost('refine_prompt');
    if (!canAfford(cost)) { toast.error('Недостаточно коинов'); return; }
    const allAnswers = Object.entries(clarifyAnswers).map(([i, a]) => `Уточняющий вопрос: ${clarifyQuestions[Number(i)]}\nОтвет: ${a}`).join('\n\n');
    setIsRefining(true);
    try {
      await deduct(cost);
      const res = await fetch('/api/scriptwriter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refine', prompt: draftPrompt, feedback: `Ответы на уточняющие вопросы по обучению:\n${allAnswers}`, structure_analysis: draftStructure }) });
      const data = await res.json();
      if (data.success) {
        await saveStyle(data.prompt || draftPrompt, data.meta || draftMeta, draftStructure);
        toast.success('Подчерк создан!');
        setScreen('styles-list');
      } else { toast.error('Ошибка верификации'); }
    } catch { toast.error('Ошибка сети'); }
    finally { setIsRefining(false); }
  }, [clarifyAnswers, clarifyQuestions, draftPrompt, draftMeta, draftStructure, saveStyle, canAfford, deduct]);

  // ─── Stepped Generation ────────────────────────────────────────────────────

  const startGeneration = useCallback((styleId: string) => {
    setSelectedStyleId(styleId);
    setGenTopic('');
    setGenQuestions([]);
    setGenAnswers([]);
    setGenHooks([]);
    setGenSelectedHook('');
    setGenHookEdited(false);
    setGenBodies([]);
    setGenSelectedBody('');
    setGenBodyEdited(false);
    setGenFinalScript('');
    setGenImproveText('');
    currentDraftIdRef.current = null;
    setScreen('gen-topic');
  }, []);

  // Step 1: Clarify topic
  const handleClarifyTopicSubmit = useCallback(async () => {
    if (!genTopic.trim() || !selectedStyle) return;
    const cost = getTokenCost('sw_clarify');
    if (!canAfford(cost)) { toast.error('Недостаточно коинов'); return; }
    setGenLoading(true);
    try {
      await deduct(cost);
      const res = await fetch('/api/scriptwriter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'clarify-topic', prompt: selectedStyle.prompt, topic: genTopic, structure_analysis: selectedStyle.structureAnalysis }) });
      const data = await res.json();
      if (data.success && data.questions?.length) {
        setGenQuestions(data.questions);
        setGenAnswers(data.questions.map((q: ClarifyQuestion) => q.options[0] || ''));
        setScreen('gen-clarify');
      } else { toast.error('Ошибка уточнения'); }
    } catch { toast.error('Ошибка сети'); }
    finally { setGenLoading(false); }
  }, [genTopic, selectedStyle, canAfford, deduct]);

  // Step 2: Generate hooks
  const handleGenerateHooks = useCallback(async () => {
    if (!selectedStyle) return;
    const cost = getTokenCost('sw_hooks');
    if (!canAfford(cost)) { toast.error('Недостаточно коинов'); return; }
    setGenLoading(true);
    try {
      await deduct(cost);
      const res = await fetch('/api/scriptwriter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate-hooks', prompt: selectedStyle.prompt, topic: genTopic, answers: genAnswers, structure_analysis: selectedStyle.structureAnalysis }) });
      const data = await res.json();
      if (data.success && data.hooks?.length) {
        setGenHooks(data.hooks);
        setGenSelectedHook(data.hooks[0]?.text || '');
        setScreen('gen-hooks');
      } else { toast.error('Ошибка генерации хуков'); }
    } catch { toast.error('Ошибка сети'); }
    finally { setGenLoading(false); }
  }, [selectedStyle, genTopic, genAnswers, canAfford, deduct]);

  // Step 3: Generate body
  const handleGenerateBody = useCallback(async () => {
    if (!selectedStyle || !genSelectedHook) return;
    const cost = getTokenCost('sw_body');
    if (!canAfford(cost)) { toast.error('Недостаточно коинов'); return; }
    setGenLoading(true);
    try {
      await deduct(cost);
      const res = await fetch('/api/scriptwriter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate-body', prompt: selectedStyle.prompt, topic: genTopic, answers: genAnswers, selected_hook: genSelectedHook, structure_analysis: selectedStyle.structureAnalysis }) });
      const data = await res.json();
      if (data.success && data.bodies?.length) {
        setGenBodies(data.bodies);
        setGenSelectedBody(data.bodies[0]?.text || '');
        setScreen('gen-body');
      } else { toast.error('Ошибка генерации тела'); }
    } catch { toast.error('Ошибка сети'); }
    finally { setGenLoading(false); }
  }, [selectedStyle, genTopic, genAnswers, genSelectedHook, canAfford, deduct]);

  // Step 4: Assemble final
  const handleAssemble = useCallback(async () => {
    if (!selectedStyle || !genSelectedHook || !genSelectedBody) return;
    const cost = getTokenCost('sw_assemble');
    if (!canAfford(cost)) { toast.error('Недостаточно коинов'); return; }
    setGenLoading(true);
    try {
      await deduct(cost);
      const res = await fetch('/api/scriptwriter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'assemble-script', prompt: selectedStyle.prompt, topic: genTopic, answers: genAnswers, selected_hook: genSelectedHook, selected_body: genSelectedBody, structure_analysis: selectedStyle.structureAnalysis }) });
      const data = await res.json();
      if (data.success && data.script) {
        setGenFinalScript(data.script);
        // Auto-save draft
        const draft = await createDraft({ title: genTopic.slice(0, 60) || 'Сценарий', script_text: data.script, style_id: selectedStyleId || undefined, source_type: 'topic', source_data: { topic: genTopic, answers: genAnswers, hook: genSelectedHook, body: genSelectedBody } });
        if (draft) currentDraftIdRef.current = draft.id;
        setScreen('gen-final');
      } else { toast.error('Ошибка сборки'); }
    } catch { toast.error('Ошибка сети'); }
    finally { setGenLoading(false); }
  }, [selectedStyle, selectedStyleId, genTopic, genAnswers, genSelectedHook, genSelectedBody, canAfford, deduct, createDraft]);

  // Step 5: Improve
  const handleImprove = useCallback(async () => {
    if (!selectedStyle || !genImproveText.trim()) return;
    const cost = getTokenCost('sw_improve');
    if (!canAfford(cost)) { toast.error('Недостаточно коинов'); return; }
    setGenLoading(true);
    try {
      await deduct(cost);
      const res = await fetch('/api/scriptwriter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'improve-script', prompt: selectedStyle.prompt, script_text: genFinalScript, feedback: genImproveText, structure_analysis: selectedStyle.structureAnalysis }) });
      const data = await res.json();
      if (data.success && data.script) {
        setGenFinalScript(data.script);
        setGenImproveText('');
        if (currentDraftIdRef.current) await updateDraft(currentDraftIdRef.current, { script_text: data.script });
        toast.success('Сценарий улучшен');
      } else { toast.error('Ошибка улучшения'); }
    } catch { toast.error('Ошибка сети'); }
    finally { setGenLoading(false); }
  }, [selectedStyle, genFinalScript, genImproveText, canAfford, deduct, updateDraft]);

  // Retrain style
  const handleRetrain = useCallback(async () => {
    if (!selectedStyle || !currentProjectId) return;
    const cost = getTokenCost('refine_prompt');
    if (!canAfford(cost)) { toast.error('Недостаточно коинов'); return; }
    setGenLoading(true);
    try {
      await deduct(cost);
      const feedbackParts: string[] = [];
      if (genHookEdited) feedbackParts.push(`Пользователь отредактировал хук: «${genSelectedHook}»`);
      if (genBodyEdited) feedbackParts.push(`Пользователь отредактировал тело: «${genSelectedBody.slice(0, 200)}...»`);
      if (genImproveText.trim()) feedbackParts.push(`Комментарий по финалу: «${genImproveText}»`);
      feedbackParts.push(`Финальный сценарий:\n${genFinalScript}`);

      const res = await fetch('/api/scriptwriter', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refine', prompt: selectedStyle.prompt, feedback: feedbackParts.join('\n\n'), script_text: genFinalScript, structure_analysis: selectedStyle.structureAnalysis }) });
      const data = await res.json();
      if (data.success && data.prompt) {
        await updateProjectStyle(currentProjectId, selectedStyle.id, { prompt: data.prompt, meta: data.meta });
        toast.success('Подчерк дообучен!');
      } else { toast.error('Ошибка дообучения'); }
    } catch { toast.error('Ошибка сети'); }
    finally { setGenLoading(false); setScreen('styles-list'); }
  }, [selectedStyle, currentProjectId, genSelectedHook, genSelectedBody, genHookEdited, genBodyEdited, genImproveText, genFinalScript, canAfford, deduct, updateProjectStyle]);

  // ─── Add to feed ───────────────────────────────────────────────────────────

  const handleAddToFeed = useCallback(async () => {
    if (!addToFeedDraftId) return;
    setAddingToFeed(true);
    try {
      const draft = drafts.find(d => d.id === addToFeedDraftId);
      const coverUrl = await uploadScriptCover(draft?.title || 'Сценарий', addToFeedDraftId);
      const success = await addDraftToFeed(addToFeedDraftId, addToFeedFolder, coverUrl || undefined);
      if (success) { toast.success('Сценарий добавлен в Ленту!'); setShowAddToFeedModal(false); setAddToFeedDraftId(null); }
      else { toast.error('Ошибка добавления'); }
    } catch { toast.error('Ошибка'); }
    finally { setAddingToFeed(false); }
  }, [addToFeedDraftId, addToFeedFolder, drafts, addDraftToFeed]);

  // ─── Resume draft ─────────────────────────────────────────────────────────

  const resumeDraft = useCallback((draft: ScriptDraft) => {
    setSelectedStyleId(draft.style_id);
    currentDraftIdRef.current = draft.id;
    setGenFinalScript(draft.script_text || '');
    setGenTopic(typeof draft.source_data === 'object' && draft.source_data !== null ? (draft.source_data as Record<string, string>).topic || '' : '');
    setScreen('gen-final');
  }, []);

  // ─── Reset training ────────────────────────────────────────────────────────

  const resetTraining = useCallback(() => {
    setTrainStyleName(''); setTrainMode('reels'); setPreferredFormat(null);
    setClarifyQuestions([]); setClarifyAnswers({});
    setReelInputs(Array.from({ length: 5 }, () => ({ url: '', loading: false, views: null, ownerUsername: null, viralMultiplier: null, error: null, transcriptText: null, transcriptLoading: false })));
    setScriptInputs(Array.from({ length: 5 }, () => ({ text: '' })));
  }, []);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!currentProject) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <p className="text-slate-400 text-sm">Выберите проект</p>
      </div>
    );
  }

  const pageHeader = (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-500 to-slate-700 flex items-center justify-center shadow-glass">
        <Sparkles className="w-5 h-5 text-white" />
      </div>
      <div>
        <h1 className="text-xl font-bold text-slate-800 font-heading tracking-tight">ИИ-сценарист</h1>
        <p className="text-xs text-slate-500">Создавай сценарии в стиле залётных видео</p>
      </div>
    </div>
  );

  // ── Styles List ──────────────────────────────────────────────────────────
  if (screen === 'styles-list' || screen === 'drafts') {
    const isStylesTab = screen === 'styles-list';
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar-light bg-[#fafafa]">
        <div className="max-w-2xl mx-auto px-4 py-8 md:py-12 safe-bottom">
          {pageHeader}

          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 rounded-xl bg-slate-100/80">
            <button onClick={() => setScreen('styles-list')} className={cn('flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all min-h-[44px] touch-manipulation', isStylesTab ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>
              Подчерки ({styles.length})
            </button>
            <button onClick={() => setScreen('drafts')} className={cn('flex-1 py-2.5 px-3 rounded-lg text-sm font-medium transition-all min-h-[44px] touch-manipulation', !isStylesTab ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700')}>
              Черновики ({drafts.length})
            </button>
          </div>

          {isStylesTab ? (
            <div className="space-y-3">
              {styles.map(style => (
                <GlassCard key={style.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-800 text-sm truncate">{style.name}</h3>
                      {style.meta?.summary && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{style.meta.summary}</p>}
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      {style.trainingMode && <span className="px-2 py-0.5 rounded-pill text-[10px] font-medium bg-slate-100 text-slate-500">{style.trainingMode === 'reels' ? 'Рилсы' : 'Сценарии'}</span>}
                      {style.examplesCount ? <span className="px-2 py-0.5 rounded-pill text-[10px] font-medium bg-slate-100 text-slate-500">{style.examplesCount} прим.</span> : null}
                    </div>
                  </div>
                  {style.structureAnalysis && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {style.structureAnalysis.hookDuration && <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-50 text-slate-600 border border-slate-100">Хук: {style.structureAnalysis.hookDuration}</span>}
                      {style.structureAnalysis.ctaType && <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-50 text-slate-600 border border-slate-100">CTA: {style.structureAnalysis.ctaType}</span>}
                      {style.structureAnalysis.bodyPhases?.length ? <span className="px-2 py-0.5 rounded-md text-[10px] bg-slate-50 text-slate-600 border border-slate-100">{style.structureAnalysis.bodyPhases.length} фаз</span> : null}
                    </div>
                  )}
                  <button onClick={() => startGeneration(style.id)} className="w-full py-2.5 rounded-card-xl bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium active:scale-[0.97] transition-all shadow-glass min-h-[44px] touch-manipulation flex items-center justify-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Создать сценарий
                  </button>
                </GlassCard>
              ))}
              <button onClick={() => { resetTraining(); setScreen('train-mode-select'); }} className="w-full p-4 rounded-card-xl border-2 border-dashed border-slate-200/60 text-slate-400 hover:border-slate-400 hover:text-slate-600 transition-all flex items-center justify-center gap-2 min-h-[44px] touch-manipulation">
                <Plus className="w-5 h-5" /> <span className="text-sm font-medium">Создать подчерк</span>
              </button>
            </div>
          ) : (
            /* Drafts */
            draftsLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
            ) : drafts.length === 0 ? (
              <div className="text-center py-12"><FileText className="w-10 h-10 text-slate-300 mx-auto mb-3" /><p className="text-sm text-slate-400">Черновиков пока нет</p></div>
            ) : (
              <div className="space-y-2">
                {drafts.map(draft => (
                  <GlassCard key={draft.id} className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-slate-800 text-sm truncate">{draft.title}</h3>
                        <div className="flex items-center gap-2 mt-0.5">
                          {styles.find(s => s.id === draft.style_id)?.name && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500 font-medium">{styles.find(s => s.id === draft.style_id)?.name}</span>}
                          <span className="text-[10px] text-slate-400">{new Date(draft.updated_at).toLocaleDateString('ru-RU')}</span>
                          {draft.status === 'done' && <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-600 font-medium">В Ленте</span>}
                        </div>
                      </div>
                    </div>
                    {draft.script_text && <p className="text-xs text-slate-500 line-clamp-2 mb-3">{draft.script_text}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => resumeDraft(draft)} className="flex-1 py-2.5 rounded-card-xl bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation">
                        <MessageSquare className="w-3.5 h-3.5" /> Продолжить
                      </button>
                      {draft.status !== 'done' && (
                        <button onClick={() => { setAddToFeedDraftId(draft.id); setAddToFeedFolder(null); setShowAddToFeedModal(true); }} className="flex-1 py-2.5 rounded-card-xl border border-slate-200 text-slate-600 text-xs font-medium hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5 min-h-[44px] touch-manipulation">
                          <LayoutGrid className="w-3.5 h-3.5" /> В Ленту
                        </button>
                      )}
                      <button onClick={async () => { if (confirm('Удалить черновик?')) { await deleteDraft(draft.id); toast.success('Удалён'); } }} className="p-2.5 rounded-card-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all min-h-[44px] touch-manipulation">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )
          )}
        </div>

        {/* Add to Feed Modal */}
        {showAddToFeedModal && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowAddToFeedModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Добавить в Ленту</h3>
              <p className="text-xs text-slate-500 mb-4">Выберите папку для сценария</p>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {(currentProject.folders || []).map(folder => (
                  <button key={folder.id} onClick={() => setAddToFeedFolder(folder.id)} className={cn('w-full px-3 py-2.5 rounded-xl text-left text-sm transition-all flex items-center gap-2 min-h-[44px] touch-manipulation', addToFeedFolder === folder.id ? 'bg-slate-100 text-slate-800 border border-slate-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent')}>
                    <FolderOpen className="w-4 h-4" style={{ color: folder.color }} /> {folder.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAddToFeedModal(false)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all min-h-[44px]">Отмена</button>
                <button onClick={handleAddToFeed} disabled={addingToFeed} className="flex-1 py-2.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium transition-all disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-1.5">
                  {addingToFeed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Добавить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Training: Mode Select ────────────────────────────────────────────────
  if (screen === 'train-mode-select') {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar-light bg-[#fafafa]">
        <div className="max-w-lg mx-auto px-4 py-8 md:py-12 safe-bottom">
          <button onClick={() => setScreen('styles-list')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors min-h-[44px] touch-manipulation"><ArrowLeft className="w-4 h-4" /> Назад</button>
          <h2 className="text-lg font-bold text-slate-800 mb-1 font-heading">Создать подчерк</h2>
          <p className="text-sm text-slate-500 mb-6">Обучите ИИ на примерах залётных видео</p>
          <div className="mb-6">
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Название подчерка</label>
            <input type="text" value={trainStyleName} onChange={e => setTrainStyleName(e.target.value)} placeholder="Например: Мотивация 30с" className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all" />
          </div>
          <div className="space-y-3">
            <button onClick={() => { setTrainMode('reels'); setScreen('train-reels'); }} className="w-full p-4 rounded-card-xl bg-white/72 backdrop-blur-glass-xl border border-white/55 shadow-glass hover:bg-white/85 transition-all text-left group touch-manipulation">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors"><LinkIcon className="w-4 h-4 text-slate-600" /></div>
                <div><h3 className="font-semibold text-sm text-slate-800">5 залётных рилсов</h3><p className="text-xs text-slate-500">Ссылки на Instagram рилсы одного формата</p></div>
                <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
              </div>
            </button>
            <button onClick={() => { setTrainMode('scripts'); setScreen('train-scripts'); }} className="w-full p-4 rounded-card-xl bg-white/72 backdrop-blur-glass-xl border border-white/55 shadow-glass hover:bg-white/85 transition-all text-left group touch-manipulation">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center group-hover:bg-slate-200 transition-colors"><Type className="w-4 h-4 text-slate-600" /></div>
                <div><h3 className="font-semibold text-sm text-slate-800">5 своих сценариев</h3><p className="text-xs text-slate-500">Вставьте тексты своих лучших сценариев</p></div>
                <ChevronRight className="w-4 h-4 text-slate-400 ml-auto" />
              </div>
              <div className="ml-12 mt-1 px-2 py-1 rounded-md bg-amber-50/80 inline-block"><p className="text-[10px] text-amber-700 font-medium">⚠ ИИ будет опираться только на ваш опыт</p></div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Training: Reels ──────────────────────────────────────────────────────
  if (screen === 'train-reels') {
    const validCount = reelInputs.filter(r => r.url.trim() && r.views !== null && !r.error).length;
    const anyLoading = reelInputs.some(r => r.loading || r.transcriptLoading);
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar-light bg-[#fafafa]">
        <div className="max-w-lg mx-auto px-4 py-8 md:py-12 safe-bottom">
          <button onClick={() => setScreen('train-mode-select')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors min-h-[44px] touch-manipulation"><ArrowLeft className="w-4 h-4" /> Назад</button>
          <h2 className="text-lg font-bold text-slate-800 mb-1 font-heading">Загрузите 5 залётных рилсов</h2>
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-100 mb-6">
            <div className="flex gap-2"><AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs text-amber-800 space-y-1"><p className="font-semibold">Важно!</p><p>Все видео должны быть <strong>залётами (x10+)</strong> — в 10 раз больше просмотров, чем средний ролик аккаунта.</p><p>Все видео должны иметь <strong>одну суть и схожую структуру</strong>.</p></div>
            </div>
          </div>
          <div className="space-y-3 mb-6">
            {reelInputs.map((reel, i) => (
              <div key={i}>
                <div className="flex gap-2">
                  <input type="url" value={reel.url} onChange={e => { const url = e.target.value; setReelInputs(prev => { const n = [...prev]; n[i] = { ...n[i], url }; return n; }); }} onBlur={() => reel.url.trim() && !reel.views && validateReelUrl(i, reel.url)} placeholder={`Ссылка на рилс ${i + 1}`} className={cn('flex-1 px-3 py-2.5 rounded-xl bg-white border text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all', reel.error ? 'border-red-200 focus:border-red-300' : 'border-slate-200 focus:border-slate-400')} />
                  {reel.loading && <div className="flex items-center"><Loader2 className="w-4 h-4 animate-spin text-slate-400" /></div>}
                  {reel.viralMultiplier !== null && !reel.error && <div className="flex items-center"><span className="px-2 py-1 rounded-lg text-xs font-bold" style={{ color: getViralMultiplierColor(reel.viralMultiplier), backgroundColor: `${getViralMultiplierColor(reel.viralMultiplier)}15` }}>x{reel.viralMultiplier.toFixed(0)}</span></div>}
                </div>
                {reel.error && <p className="text-[11px] text-red-500 mt-1 ml-1">{reel.error}</p>}
                {reel.transcriptLoading && <p className="text-[11px] text-slate-400 mt-1 ml-1 flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" /> Транскрибация...</p>}
              </div>
            ))}
          </div>
          <CostButton onClick={startTraining} disabled={validCount < 2 || anyLoading || trainAnalyzing} loading={trainAnalyzing} cost={getTokenCost('train_style')} variant="primary">
            <Sparkles className="w-4 h-4" /> Обучить подчерк ({validCount}/5)
          </CostButton>
        </div>
      </div>
    );
  }

  // ── Training: Scripts ────────────────────────────────────────────────────
  if (screen === 'train-scripts') {
    const validCount = scriptInputs.filter(s => s.text.trim()).length;
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar-light bg-[#fafafa]">
        <div className="max-w-lg mx-auto px-4 py-8 md:py-12 safe-bottom">
          <button onClick={() => setScreen('train-mode-select')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors min-h-[44px] touch-manipulation"><ArrowLeft className="w-4 h-4" /> Назад</button>
          <h2 className="text-lg font-bold text-slate-800 mb-1 font-heading">Загрузите 5 своих сценариев</h2>
          <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-100 mb-6">
            <div className="flex gap-2"><AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" /><p className="text-xs text-amber-800">ИИ-сценарист может <strong>не идеально делать залёты</strong>, так как будет опираться лишь на ваш опыт.</p></div>
          </div>
          <div className="space-y-4 mb-6">
            {scriptInputs.map((s, i) => (
              <div key={i}><label className="text-xs font-medium text-slate-500 mb-1 block">Сценарий {i + 1}</label>
                <textarea value={s.text} onChange={e => { const text = e.target.value; setScriptInputs(prev => { const n = [...prev]; n[i] = { text }; return n; }); }} placeholder="Вставьте текст сценария..." rows={4} className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all resize-none" />
              </div>
            ))}
          </div>
          <CostButton onClick={startTraining} disabled={validCount < 2 || trainAnalyzing} loading={trainAnalyzing} cost={getTokenCost('train_style')} variant="primary">
            <Sparkles className="w-4 h-4" /> Обучить подчерк ({validCount}/5)
          </CostButton>
        </div>
      </div>
    );
  }

  // ── Training: Format Select ──────────────────────────────────────────────
  if (screen === 'train-format-select') {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar-light bg-[#fafafa]">
        <div className="max-w-lg mx-auto px-4 py-8 md:py-12 safe-bottom">
          <button onClick={() => setScreen(trainMode === 'reels' ? 'train-reels' : 'train-scripts')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors min-h-[44px] touch-manipulation"><ArrowLeft className="w-4 h-4" /> Назад</button>
          <h2 className="text-lg font-bold text-slate-800 mb-2 font-heading">Сценарии разной длины</h2>
          <p className="text-sm text-slate-500 mb-6">Выберите, какой формат взять за основу:</p>
          <div className="space-y-3">
            <button onClick={() => { setPreferredFormat('short'); setScreen(trainMode === 'reels' ? 'train-reels' : 'train-scripts'); setTimeout(startTraining, 100); }} className="w-full p-4 rounded-card-xl bg-white/72 backdrop-blur-glass-xl border border-white/55 shadow-glass hover:bg-white/85 transition-all text-left touch-manipulation"><h3 className="font-semibold text-sm text-slate-800 mb-1">Короткий формат</h3><p className="text-xs text-slate-500">Ориентироваться на короткие сценарии</p></button>
            <button onClick={() => { setPreferredFormat('long'); setScreen(trainMode === 'reels' ? 'train-reels' : 'train-scripts'); setTimeout(startTraining, 100); }} className="w-full p-4 rounded-card-xl bg-white/72 backdrop-blur-glass-xl border border-white/55 shadow-glass hover:bg-white/85 transition-all text-left touch-manipulation"><h3 className="font-semibold text-sm text-slate-800 mb-1">Длинный формат</h3><p className="text-xs text-slate-500">Ориентироваться на длинные сценарии</p></button>
          </div>
        </div>
      </div>
    );
  }

  // ── Training: Verify ─────────────────────────────────────────────────────
  if (screen === 'train-verify') {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar-light bg-[#fafafa]">
        <div className="max-w-lg mx-auto px-4 py-8 md:py-12 safe-bottom">
          <h2 className="text-lg font-bold text-slate-800 mb-1 font-heading">Уточняющие вопросы</h2>
          <p className="text-sm text-slate-500 mb-6">Подтвердите или скорректируйте понимание ИИ</p>
          <div className="space-y-4 mb-6">
            {clarifyQuestions.map((q, i) => (
              <GlassCard key={i} className="p-4">
                <p className="text-sm text-slate-700 mb-2">{q}</p>
                <input type="text" value={clarifyAnswers[i] || ''} onChange={e => setClarifyAnswers(prev => ({ ...prev, [i]: e.target.value }))} placeholder="Ваш ответ" className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all" />
              </GlassCard>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={async () => { await saveStyle(draftPrompt, draftMeta, draftStructure); toast.success('Подчерк создан'); setScreen('styles-list'); }} className="flex-1 py-3 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all min-h-[44px]">Пропустить</button>
            <CostButton onClick={handleClarifySubmit} disabled={isRefining} loading={isRefining} cost={getTokenCost('refine_prompt')} variant="primary"><Check className="w-4 h-4" /> Подтвердить</CostButton>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // STEPPED GENERATION FLOW
  // ══════════════════════════════════════════════════════════════════════════

  // ── Step 1: Enter Topic ──────────────────────────────────────────────────
  if (screen === 'gen-topic') {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar-light bg-[#fafafa]">
        <div className="max-w-lg mx-auto px-4 py-8 md:py-12 safe-bottom">
          <button onClick={() => setScreen('styles-list')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors min-h-[44px] touch-manipulation"><ArrowLeft className="w-4 h-4" /> Назад</button>
          <div className="flex items-center justify-between mb-6">
            <div><h2 className="text-lg font-bold text-slate-800 font-heading">Шаг 1 из 5</h2><p className="text-xs text-slate-500">Тема сценария</p></div>
            <StepIndicator current={0} total={5} />
          </div>
          <GlassCard className="p-4 mb-2">
            <p className="text-xs text-slate-500 mb-1">Подчерк: <strong className="text-slate-700">{selectedStyle?.name || '—'}</strong></p>
          </GlassCard>
          <div className="mt-4 mb-6">
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">О чём будет сценарий?</label>
            <textarea value={genTopic} onChange={e => setGenTopic(e.target.value)} placeholder="Опишите тему, идею или проблему для сценария..." rows={4} className="w-full px-4 py-3 rounded-xl bg-white border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all resize-none" />
          </div>
          <CostButton onClick={handleClarifyTopicSubmit} disabled={!genTopic.trim() || genLoading} loading={genLoading} cost={getTokenCost('sw_clarify')} variant="primary">
            Далее <ChevronRight className="w-4 h-4" />
          </CostButton>
        </div>
      </div>
    );
  }

  // ── Step 2: Clarify Questions ────────────────────────────────────────────
  if (screen === 'gen-clarify') {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar-light bg-[#fafafa]">
        <div className="max-w-lg mx-auto px-4 py-8 md:py-12 safe-bottom">
          <button onClick={() => setScreen('gen-topic')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors min-h-[44px] touch-manipulation"><ArrowLeft className="w-4 h-4" /> Назад</button>
          <div className="flex items-center justify-between mb-6">
            <div><h2 className="text-lg font-bold text-slate-800 font-heading">Шаг 2 из 5</h2><p className="text-xs text-slate-500">Уточним детали</p></div>
            <StepIndicator current={1} total={5} />
          </div>
          <div className="space-y-4 mb-6">
            {genQuestions.map((q, i) => (
              <GlassCard key={i} className="p-4">
                <p className="text-sm font-medium text-slate-700 mb-3">{q.question}</p>
                <div className="space-y-2">
                  {q.options.map((opt, j) => (
                    <button key={j} onClick={() => setGenAnswers(prev => { const n = [...prev]; n[i] = opt; return n; })} className={cn('w-full px-3 py-2.5 rounded-xl text-left text-sm transition-all border min-h-[44px] touch-manipulation', genAnswers[i] === opt ? 'bg-slate-100 border-slate-300 text-slate-800 font-medium' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50')}>
                      {opt}
                    </button>
                  ))}
                </div>
                <input type="text" value={!q.options.includes(genAnswers[i] || '') ? genAnswers[i] || '' : ''} onChange={e => setGenAnswers(prev => { const n = [...prev]; n[i] = e.target.value; return n; })} placeholder="Или свой вариант..." className="w-full mt-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all" />
              </GlassCard>
            ))}
          </div>
          <CostButton onClick={handleGenerateHooks} disabled={genAnswers.some(a => !a?.trim()) || genLoading} loading={genLoading} cost={getTokenCost('sw_hooks')} variant="primary">
            Генерировать хуки <ChevronRight className="w-4 h-4" />
          </CostButton>
        </div>
      </div>
    );
  }

  // ── Step 3: Choose Hook ──────────────────────────────────────────────────
  if (screen === 'gen-hooks') {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar-light bg-[#fafafa]">
        <div className="max-w-lg mx-auto px-4 py-8 md:py-12 safe-bottom">
          <button onClick={() => setScreen('gen-clarify')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors min-h-[44px] touch-manipulation"><ArrowLeft className="w-4 h-4" /> Назад</button>
          <div className="flex items-center justify-between mb-6">
            <div><h2 className="text-lg font-bold text-slate-800 font-heading">Шаг 3 из 5</h2><p className="text-xs text-slate-500">Выберите хук</p></div>
            <StepIndicator current={2} total={5} />
          </div>
          <div className="space-y-3 mb-4">
            {genHooks.map((hook, i) => (
              <button key={i} onClick={() => { setGenSelectedHook(hook.text); setGenHookEdited(false); }} className={cn('w-full p-4 rounded-card-xl text-left transition-all border touch-manipulation', genSelectedHook === hook.text ? 'bg-slate-100 border-slate-300 shadow-glass-sm' : 'bg-white/72 backdrop-blur-glass-xl border-white/55 shadow-glass hover:bg-white/85')}>
                <p className="text-sm text-slate-800 mb-1 whitespace-pre-wrap">{hook.text}</p>
                <p className="text-[11px] text-slate-400">{hook.approach}</p>
              </button>
            ))}
          </div>
          <GlassCard className="p-4 mb-6">
            <label className="text-xs font-medium text-slate-500 mb-1.5 block flex items-center gap-1.5"><Pencil className="w-3 h-3" /> Или отредактируйте</label>
            <textarea value={genSelectedHook} onChange={e => { setGenSelectedHook(e.target.value); setGenHookEdited(true); }} rows={3} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all resize-none" />
          </GlassCard>
          <CostButton onClick={handleGenerateBody} disabled={!genSelectedHook.trim() || genLoading} loading={genLoading} cost={getTokenCost('sw_body')} variant="primary">
            Генерировать тело <ChevronRight className="w-4 h-4" />
          </CostButton>
        </div>
      </div>
    );
  }

  // ── Step 4: Choose Body ──────────────────────────────────────────────────
  if (screen === 'gen-body') {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar-light bg-[#fafafa]">
        <div className="max-w-lg mx-auto px-4 py-8 md:py-12 safe-bottom">
          <button onClick={() => setScreen('gen-hooks')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors min-h-[44px] touch-manipulation"><ArrowLeft className="w-4 h-4" /> Назад</button>
          <div className="flex items-center justify-between mb-6">
            <div><h2 className="text-lg font-bold text-slate-800 font-heading">Шаг 4 из 5</h2><p className="text-xs text-slate-500">Выберите тело</p></div>
            <StepIndicator current={3} total={5} />
          </div>
          {/* Selected hook preview */}
          <GlassCard className="p-3 mb-4">
            <p className="text-[11px] text-slate-400 mb-1">Выбранный хук:</p>
            <p className="text-xs text-slate-600 line-clamp-2">{genSelectedHook}</p>
          </GlassCard>
          <div className="space-y-3 mb-4">
            {genBodies.map((body, i) => (
              <button key={i} onClick={() => { setGenSelectedBody(body.text); setGenBodyEdited(false); }} className={cn('w-full p-4 rounded-card-xl text-left transition-all border touch-manipulation', genSelectedBody === body.text ? 'bg-slate-100 border-slate-300 shadow-glass-sm' : 'bg-white/72 backdrop-blur-glass-xl border-white/55 shadow-glass hover:bg-white/85')}>
                <p className="text-sm text-slate-800 mb-1 whitespace-pre-wrap line-clamp-6">{body.text}</p>
                <p className="text-[11px] text-slate-400">{body.approach}</p>
              </button>
            ))}
          </div>
          <GlassCard className="p-4 mb-6">
            <label className="text-xs font-medium text-slate-500 mb-1.5 block flex items-center gap-1.5"><Pencil className="w-3 h-3" /> Или отредактируйте</label>
            <textarea value={genSelectedBody} onChange={e => { setGenSelectedBody(e.target.value); setGenBodyEdited(true); }} rows={6} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all resize-none" />
          </GlassCard>
          <CostButton onClick={handleAssemble} disabled={!genSelectedBody.trim() || genLoading} loading={genLoading} cost={getTokenCost('sw_assemble')} variant="primary">
            Собрать сценарий <ChevronRight className="w-4 h-4" />
          </CostButton>
        </div>
      </div>
    );
  }

  // ── Step 5: Final Script ─────────────────────────────────────────────────
  if (screen === 'gen-final') {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar-light bg-[#fafafa]">
        <div className="max-w-lg mx-auto px-4 py-8 md:py-12 safe-bottom">
          <button onClick={() => setScreen('styles-list')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors min-h-[44px] touch-manipulation"><ArrowLeft className="w-4 h-4" /> К подчеркам</button>
          <div className="flex items-center justify-between mb-6">
            <div><h2 className="text-lg font-bold text-slate-800 font-heading">Шаг 5 из 5</h2><p className="text-xs text-slate-500">Финальный сценарий</p></div>
            <StepIndicator current={4} total={5} />
          </div>

          {/* Final script */}
          <GlassCard className="p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-slate-500">Готовый сценарий</p>
              <div className="flex gap-1.5">
                <button onClick={() => { navigator.clipboard.writeText(genFinalScript); toast.success('Скопировано'); }} className="px-2 py-1 rounded-lg bg-slate-100 text-slate-500 text-[11px] font-medium hover:bg-slate-200 transition-all touch-manipulation">Копировать</button>
              </div>
            </div>
            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{genFinalScript}</p>
          </GlassCard>

          {/* Improve */}
          <GlassCard className="p-4 mb-4">
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Улучшить сценарий</label>
            <textarea value={genImproveText} onChange={e => setGenImproveText(e.target.value)} placeholder="Что изменить? Например: хук слабый, убери CTA, добавь интригу..." rows={3} className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 focus:border-slate-400 transition-all resize-none mb-3" />
            <CostButton onClick={handleImprove} disabled={!genImproveText.trim() || genLoading} loading={genLoading} cost={getTokenCost('sw_improve')} variant="secondary">
              <RotateCcw className="w-3.5 h-3.5" /> Улучшить
            </CostButton>
          </GlassCard>

          {/* Actions */}
          <div className="space-y-2">
            <button onClick={() => { if (currentDraftIdRef.current) { setAddToFeedDraftId(currentDraftIdRef.current); setAddToFeedFolder(null); setShowAddToFeedModal(true); } }} className="w-full py-3 rounded-card-xl bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium transition-all shadow-glass min-h-[44px] touch-manipulation flex items-center justify-center gap-2">
              <LayoutGrid className="w-4 h-4" /> Добавить в Ленту
            </button>
            <button onClick={() => setScreen('gen-retrain')} className="w-full py-3 rounded-card-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all min-h-[44px] touch-manipulation flex items-center justify-center gap-2">
              <Sparkles className="w-4 h-4" /> Дообучить подчерк на этих правках?
            </button>
          </div>
        </div>

        {/* Add to Feed Modal (same as in styles list) */}
        {showAddToFeedModal && (
          <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowAddToFeedModal(false)}>
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-6 w-full max-w-sm" onClick={e => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-slate-800 mb-1">Добавить в Ленту</h3>
              <p className="text-xs text-slate-500 mb-4">Выберите папку для сценария</p>
              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                {(currentProject?.folders || []).map(folder => (
                  <button key={folder.id} onClick={() => setAddToFeedFolder(folder.id)} className={cn('w-full px-3 py-2.5 rounded-xl text-left text-sm transition-all flex items-center gap-2 min-h-[44px] touch-manipulation', addToFeedFolder === folder.id ? 'bg-slate-100 text-slate-800 border border-slate-300' : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-transparent')}>
                    <FolderOpen className="w-4 h-4" style={{ color: folder.color }} /> {folder.name}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowAddToFeedModal(false)} className="flex-1 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all min-h-[44px]">Отмена</button>
                <button onClick={handleAddToFeed} disabled={addingToFeed} className="flex-1 py-2.5 rounded-lg bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium transition-all disabled:opacity-50 min-h-[44px] flex items-center justify-center gap-1.5">
                  {addingToFeed ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Добавить
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Step 6: Retrain Confirmation ─────────────────────────────────────────
  if (screen === 'gen-retrain') {
    return (
      <div className="flex-1 overflow-y-auto custom-scrollbar-light bg-[#fafafa]">
        <div className="max-w-lg mx-auto px-4 py-8 md:py-12 safe-bottom">
          <button onClick={() => setScreen('gen-final')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors min-h-[44px] touch-manipulation"><ArrowLeft className="w-4 h-4" /> Назад к сценарию</button>
          <h2 className="text-lg font-bold text-slate-800 mb-2 font-heading">Дообучить подчерк?</h2>
          <p className="text-sm text-slate-500 mb-6">ИИ проанализирует ваши выборы и правки, чтобы улучшить будущие сценарии в этом подчерке.</p>

          <GlassCard className="p-4 mb-4">
            <p className="text-xs font-medium text-slate-500 mb-3">Что будет учтено:</p>
            <div className="space-y-2">
              {genHookEdited && <div className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /><p className="text-xs text-slate-600">Ваши правки хука</p></div>}
              {genBodyEdited && <div className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /><p className="text-xs text-slate-600">Ваши правки тела</p></div>}
              <div className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /><p className="text-xs text-slate-600">Выбранные варианты хука и тела</p></div>
              <div className="flex items-start gap-2"><Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /><p className="text-xs text-slate-600">Финальный сценарий</p></div>
            </div>
          </GlassCard>

          <div className="flex gap-2">
            <button onClick={() => { toast.info('Подчерк не изменён'); setScreen('styles-list'); }} className="flex-1 py-3 rounded-lg border border-slate-200 text-slate-600 text-sm font-medium hover:bg-slate-50 transition-all min-h-[44px] touch-manipulation">Нет, не стоит</button>
            <CostButton onClick={handleRetrain} disabled={genLoading} loading={genLoading} cost={getTokenCost('refine_prompt')} variant="primary">
              <Sparkles className="w-4 h-4" /> Дообучить
            </CostButton>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
