import { useState, useEffect } from 'react';
import {
  ChevronLeft, FileText, Copy, ExternalLink, Loader2, Check,
  Languages, ChevronDown, Save, Plus, Trash2, Wand2, Images, Heart, MessageCircle, RefreshCw
} from 'lucide-react';
import { cn } from '../utils/cn';
import { toast } from 'sonner';
import { useCarousels, type SavedCarousel } from '../hooks/useCarousels';
import { useProjectContext } from '../contexts/ProjectContext';
import type { ProjectTemplateItem, ProjectStyle } from '../hooks/useProjects';
import { transcribeCarouselByUrls } from '../services/carouselTranscriptionService';

const DEFAULT_LINKS: ProjectTemplateItem[] = [
  { id: 'link-0', label: 'Заготовка' },
  { id: 'link-1', label: 'Готовое' },
];
const DEFAULT_RESPONSIBLES: ProjectTemplateItem[] = [
  { id: 'resp-0', label: 'За сценарий' },
  { id: 'resp-1', label: 'За монтаж' },
];

type MergedRow = { id: string; label: string; value: string };

function mergeLinks(template: ProjectTemplateItem[], carouselLinks: any[] | null, draft?: string, final?: string): MergedRow[] {
  return template.map((t, i) => {
    const byId = carouselLinks?.find((r: any) => r.templateId === t.id);
    const legacy = i === 0 ? draft : i === 1 ? final : undefined;
    return { id: t.id, label: t.label, value: byId?.value ?? legacy ?? '' };
  });
}
function mergeResponsibles(template: ProjectTemplateItem[], carouselResp: any[] | null, script?: string, edit?: string): MergedRow[] {
  return template.map((t, i) => {
    const byId = carouselResp?.find((r: any) => r.templateId === t.id);
    const legacy = i === 0 ? script : i === 1 ? edit : undefined;
    return { id: t.id, label: t.label, value: byId?.value ?? legacy ?? '' };
  });
}

function formatNumber(num?: number): string {
  if (num === undefined || num === null) return '0';
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

function proxyImageUrl(url?: string): string {
  if (!url) return '';
  if (url.startsWith('/api/') || url.includes('placeholder.com')) return url;
  if (
    url.includes('instagram.com') ||
    url.includes('cdninstagram.com') ||
    url.includes('fbcdn.net') ||
    url.includes('scontent.') ||
    url.includes('workers.dev')
  ) {
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

interface CarouselDetailPageProps {
  carousel: SavedCarousel;
  onBack: () => void;
  onRefreshData?: () => Promise<void>;
}

export function CarouselDetailPage({ carousel, onBack, onRefreshData }: CarouselDetailPageProps) {
  const [transcriptTab, setTranscriptTab] = useState<'original' | 'translation'>('original');
  const [transcript, setTranscript] = useState(carousel.transcript_text || '');
  const [translation, setTranslation] = useState(carousel.translation_text || '');
  const [transcriptStatus, setTranscriptStatus] = useState(carousel.transcript_status || null);
  const [script, setScript] = useState(carousel.script_text || '');
  const [isTranslating, setIsTranslating] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(carousel.folder_id);
  const [isSavingScript, setIsSavingScript] = useState(false);
  const [isSavingLinks, setIsSavingLinks] = useState(false);
  const [isSavingResponsible, setIsSavingResponsible] = useState(false);
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [showStylePickerPopover, setShowStylePickerPopover] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const [mainImageError, setMainImageError] = useState(false);
  const [localSlideUrls, setLocalSlideUrls] = useState<string[]>(() => (carousel.slide_urls && carousel.slide_urls.length > 0 ? carousel.slide_urls : carousel.thumbnail_url ? [carousel.thumbnail_url] : []));
  const [isRefreshingSlides, setIsRefreshingSlides] = useState(false);

  const { currentProject, updateProject } = useProjectContext();
  const {
    updateCarouselTranscript,
    updateCarouselTranslation,
    updateCarouselScript,
    updateCarouselFolder,
    updateCarouselSlideUrls,
    updateCarouselLinks,
    updateCarouselResponsibles,
  } = useCarousels();

  const projectStyles = currentProject?.projectStyles || [];
  const linksTemplate = currentProject?.linksTemplate ?? DEFAULT_LINKS;
  const responsiblesTemplate = currentProject?.responsiblesTemplate ?? DEFAULT_RESPONSIBLES;

  const buildLinks = () => mergeLinks(linksTemplate, carousel.links, carousel.draft_link ?? undefined, carousel.final_link ?? undefined);
  const buildResponsibles = () => mergeResponsibles(responsiblesTemplate, carousel.responsibles, carousel.script_responsible ?? undefined, carousel.editing_responsible ?? undefined);

  const [links, setLinks] = useState<MergedRow[]>(buildLinks);
  const [responsibles, setResponsibles] = useState<MergedRow[]>(buildResponsibles);

  useEffect(() => {
    setLinks(buildLinks());
    setResponsibles(buildResponsibles());
  }, [carousel.id, carousel.links, carousel.responsibles, carousel.draft_link, carousel.final_link, carousel.script_responsible, carousel.editing_responsible]);

  useEffect(() => {
    const urls = carousel.slide_urls?.length ? carousel.slide_urls : carousel.thumbnail_url ? [carousel.thumbnail_url] : [];
    setLocalSlideUrls(urls);
  }, [carousel.id, carousel.slide_urls, carousel.thumbnail_url]);

  const folderConfigs = currentProject?.folders?.slice().sort((a, b) => a.order - b.order).map(f => ({ id: f.id, title: f.name, color: f.color })) || [];
  const currentFolder = currentFolderId ? folderConfigs.find(f => f.id === currentFolderId) : null;

  const slideUrls = localSlideUrls.length > 0 ? localSlideUrls : (carousel.thumbnail_url ? [carousel.thumbnail_url] : []);
  const displayUrl = slideUrls[slideIndex] || carousel.thumbnail_url || '';

  const handleRefreshSlides = async () => {
    const url = carousel.url || `https://www.instagram.com/p/${carousel.shortcode}/`;
    setIsRefreshingSlides(true);
    setMainImageError(false);
    try {
      const res = await fetch('/api/reel-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (data.success && data.is_carousel && Array.isArray(data.carousel_slides) && data.carousel_slides.length > 0) {
        await updateCarouselSlideUrls(carousel.id, data.carousel_slides, data.thumbnail_url || data.carousel_slides[0]);
        setLocalSlideUrls(data.carousel_slides);
        setSlideIndex(0);
        toast.success(`Загружено ${data.carousel_slides.length} слайдов`);
      } else {
        toast.error('Не удалось загрузить слайды. Проверьте ссылку.');
      }
    } catch (e) {
      toast.error('Ошибка при загрузке слайдов');
    } finally {
      setIsRefreshingSlides(false);
    }
  };

  const handleTranscribe = async () => {
    if (slideUrls.length === 0) {
      toast.error('Нет URL слайдов для транскрибации. Добавьте карусель по ссылке с поста.');
      return;
    }
    setIsTranscribing(true);
    setTranscriptStatus('processing');
    try {
      const result = await transcribeCarouselByUrls(slideUrls);
      if (result?.success && result.transcript_text) {
        setTranscript(result.transcript_text);
        setTranscriptTab('original');
        setTranscriptStatus('completed');
        await updateCarouselTranscript(carousel.id, result.transcript_text, result.transcript_slides);
        toast.success('Транскрибация по слайдам готова');
      } else {
        setTranscriptStatus('error');
        toast.error('Ошибка транскрибации');
      }
    } catch (e) {
      setTranscriptStatus('error');
      toast.error('Ошибка транскрибации');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleTranslate = async () => {
    if (!transcript.trim()) {
      toast.error('Сначала получите транскрипт по слайдам');
      return;
    }
    setIsTranslating(true);
    try {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: transcript, to: 'ru' }),
      });
      const data = await res.json();
      if (data.success && data.translated) {
        setTranslation(data.translated);
        setTranscriptTab('translation');
        await updateCarouselTranslation(carousel.id, data.translated);
        toast.success('Перевод сохранён');
      } else {
        toast.error(data.error || 'Ошибка перевода');
      }
    } catch (e) {
      toast.error('Ошибка перевода');
    } finally {
      setIsTranslating(false);
    }
  };

  const handleGenerateByStyle = async (style: ProjectStyle) => {
    if (!style?.prompt?.trim() || !transcript?.trim()) {
      toast.error('Нужен стиль и транскрипция');
      return;
    }
    setShowStylePickerPopover(false);
    setIsGeneratingScript(true);
    try {
      let translationToUse = translation;
      if (transcript.trim() && !translation.trim()) {
        try {
          const trRes = await fetch('/api/translate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: transcript, to: 'ru' }) });
          const trData = await trRes.json();
          if (trData.success && trData.translated) {
            setTranslation(trData.translated);
            await updateCarouselTranslation(carousel.id, trData.translated);
            translationToUse = trData.translated;
          }
        } catch (_) {}
      }
      const res = await fetch('/api/script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: style.prompt,
          transcript_text: transcript,
          translation_text: translationToUse || undefined,
        }),
      });
      const data = await res.json();
      if (data.success && data.script) {
        setScript(data.script);
        toast.success(`Сценарий по стилю «${style.name}»`);
      } else {
        toast.error(data.error || 'Ошибка генерации');
      }
    } catch (err) {
      toast.error('Ошибка генерации');
    } finally {
      setIsGeneratingScript(false);
    }
  };

  const handleSaveScript = async () => {
    setIsSavingScript(true);
    const ok = await updateCarouselScript(carousel.id, script);
    setIsSavingScript(false);
    if (ok) toast.success('Сценарий сохранён'); else toast.error('Ошибка сохранения');
  };

  const handleMoveToFolder = async (folderId: string) => {
    const ok = await updateCarouselFolder(carousel.id, folderId);
    if (ok) {
      setCurrentFolderId(folderId);
      toast.success('Папка обновлена');
    }
    setShowFolderMenu(false);
  };

  const handleSaveLinks = async () => {
    if (!currentProject?.id) return;
    setIsSavingLinks(true);
    await updateProject(currentProject.id, { linksTemplate: links.map(({ id, label }) => ({ id, label })) });
    const ok = await updateCarouselLinks(carousel.id, links.map(({ id, value }) => ({ templateId: id, value })));
    setIsSavingLinks(false);
    if (ok) toast.success('Ссылки сохранены'); else toast.error('Ошибка');
  };

  const handleSaveResponsible = async () => {
    if (!currentProject?.id) return;
    setIsSavingResponsible(true);
    await updateProject(currentProject.id, { responsiblesTemplate: responsibles.map(({ id, label }) => ({ id, label })) });
    const ok = await updateCarouselResponsibles(carousel.id, responsibles.map(({ id, value }) => ({ templateId: id, value })));
    setIsSavingResponsible(false);
    if (ok) toast.success('Ответственные сохранены'); else toast.error('Ошибка');
  };

  const addLinkRow = () => setLinks(prev => [...prev, { id: `link-${Date.now()}`, label: '', value: '' }]);
  const removeLinkRow = (id: string) => setLinks(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  const updateLinkRow = (id: string, field: 'label' | 'value', value: string) =>
    setLinks(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  const addResponsibleRow = () => setResponsibles(prev => [...prev, { id: `resp-${Date.now()}`, label: '', value: '' }]);
  const removeResponsibleRow = (id: string) => setResponsibles(prev => prev.length > 1 ? prev.filter(r => r.id !== id) : prev);
  const updateResponsibleRow = (id: string, field: 'label' | 'value', value: string) =>
    setResponsibles(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  const handleRefreshData = async () => {
    if (onRefreshData) {
      await onRefreshData();
      toast.success('Данные обновлены');
    }
  };

  const thumbnailUrl = displayUrl ? proxyImageUrl(displayUrl) : '';
  const hasMainImage = Boolean(thumbnailUrl);

  return (
    <div className="flex flex-col h-full bg-slate-50/80 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between gap-4 p-4 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBack}
            className="p-2 -m-2 rounded-xl hover:bg-slate-100 text-slate-600 touch-manipulation"
            aria-label="Назад"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-slate-200/80 flex items-center justify-center flex-shrink-0">
              <Images className="w-5 h-5 text-slate-600" />
            </div>
            <div className="min-w-0">
              <h1 className="font-semibold text-slate-800 truncate">
                {carousel.caption?.slice(0, 50) || `Карусель · ${carousel.slide_count || 0} слайдов`}
              </h1>
              <p className="text-xs text-slate-500">
                @{carousel.owner_username || 'instagram'} · {formatNumber(carousel.like_count)} лайков
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onRefreshData && (
            <button onClick={handleRefreshData} className="p-2 rounded-xl hover:bg-slate-100 text-slate-600">
              Обновить
            </button>
          )}
          <a
            href={carousel.url || `https://www.instagram.com/p/${carousel.shortcode}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            Instagram
          </a>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row gap-4 min-h-0 overflow-y-auto p-4">
        {/* Left: slides + folder + stats + links + responsibles */}
        <div className="flex-shrink-0 flex flex-col gap-3 w-full md:w-72 lg:w-80">
          <div className="relative rounded-2xl overflow-hidden shadow-lg bg-slate-200 aspect-square max-w-[280px] mx-auto md:mx-0 w-full">
            {hasMainImage && !mainImageError ? (
              <img
                src={thumbnailUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setMainImageError(true)}
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-200 text-slate-400">
                <Images className="w-12 h-12" />
              </div>
            )}
            {slideUrls.length > 1 && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1">
                {slideUrls.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setSlideIndex(i)}
                    className={cn(
                      'w-2 h-2 rounded-full transition-colors',
                      i === slideIndex ? 'bg-white' : 'bg-white/50'
                    )}
                  />
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleRefreshSlides}
            disabled={isRefreshingSlides}
            className="flex items-center justify-center gap-2 w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium disabled:opacity-60 transition-colors"
          >
            {isRefreshingSlides ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Обновить слайды
          </button>
          {slideUrls.length > 1 && (
            <div className="flex gap-1 overflow-x-auto pb-1">
              {slideUrls.slice(0, 10).map((url, i) => {
                const thumbSrc = proxyImageUrl(url);
                return (
                  <button
                    key={i}
                    onClick={() => { setSlideIndex(i); setMainImageError(false); }}
                    className={cn(
                      'flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border-2 bg-slate-100',
                      i === slideIndex ? 'border-violet-500' : 'border-transparent'
                    )}
                  >
                    {thumbSrc ? (
                      <img src={thumbSrc} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400">
                        <Images className="w-5 h-5" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="rounded-xl p-3 bg-white/80 border border-slate-200/80">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-1.5 text-slate-600">
                <Heart className="w-4 h-4 text-slate-400" />
                {formatNumber(carousel.like_count)}
              </div>
              <div className="flex items-center gap-1.5 text-slate-600">
                <MessageCircle className="w-4 h-4 text-slate-400" />
                {formatNumber(carousel.comment_count)}
              </div>
            </div>
          </div>

          <div className={cn('rounded-xl p-3 bg-white/80 border border-slate-200/80 relative', showFolderMenu && 'z-10')}>
            <span className="text-xs text-slate-400 font-medium">Папка</span>
            <button
              onClick={() => setShowFolderMenu(!showFolderMenu)}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-slate-200/80 mt-1"
            >
              <span className="text-sm text-slate-700">{currentFolder ? currentFolder.title : 'Ожидает'}</span>
              <ChevronDown className={cn('w-4 h-4', showFolderMenu && 'rotate-180')} />
            </button>
            {showFolderMenu && folderConfigs.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-20">
                {folderConfigs.map(f => (
                  <button
                    key={f.id}
                    onClick={() => handleMoveToFolder(f.id)}
                    className={cn('w-full flex items-center gap-2 px-3 py-2 text-left text-sm', f.id === currentFolderId ? 'bg-slate-100' : 'hover:bg-slate-50')}
                  >
                    <div className="w-3 h-3 rounded" style={{ backgroundColor: f.color }} />
                    {f.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl p-3 bg-white/80 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Ссылки</span>
              <div className="flex gap-1">
                <button type="button" onClick={addLinkRow} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Plus className="w-3.5 h-3.5" /></button>
                <button onClick={handleSaveLinks} disabled={isSavingLinks} className="px-2 py-1 rounded-lg bg-emerald-500 text-white text-xs disabled:opacity-50">
                  {isSavingLinks ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                </button>
              </div>
            </div>
            {links.map(row => (
              <div key={row.id} className="flex gap-2 items-center">
                <input value={row.label} onChange={e => updateLinkRow(row.id, 'label', e.target.value)} placeholder="Название" className="w-20 px-2 py-1 rounded border text-xs" />
                <input value={row.value} onChange={e => updateLinkRow(row.id, 'value', e.target.value)} placeholder="URL" className="flex-1 min-w-0 px-2 py-1 rounded border text-xs" />
                <button type="button" onClick={() => removeLinkRow(row.id)} disabled={links.length <= 1} className="p-1 rounded hover:bg-red-100 text-slate-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>

          <div className="rounded-xl p-3 bg-white/80 border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400">Ответственные</span>
              <div className="flex gap-1">
                <button type="button" onClick={addResponsibleRow} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Plus className="w-3.5 h-3.5" /></button>
                <button onClick={handleSaveResponsible} disabled={isSavingResponsible} className="px-2 py-1 rounded-lg bg-emerald-500 text-white text-xs disabled:opacity-50">
                  {isSavingResponsible ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                </button>
              </div>
            </div>
            {responsibles.map(row => (
              <div key={row.id} className="flex gap-2 items-center">
                <input value={row.label} onChange={e => updateResponsibleRow(row.id, 'label', e.target.value)} placeholder="Роль" className="w-24 px-2 py-1 rounded border text-xs" />
                <input value={row.value} onChange={e => updateResponsibleRow(row.id, 'value', e.target.value)} placeholder="Имя" className="flex-1 min-w-0 px-2 py-1 rounded border text-xs" />
                <button type="button" onClick={() => removeResponsibleRow(row.id)} disabled={responsibles.length <= 1} className="p-1 rounded hover:bg-red-100 text-slate-400"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        </div>

        {/* Middle: Transcript — высота шапки как у Сценария для одного уровня текста */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 rounded-xl bg-white/80 border border-slate-200/80 overflow-hidden">
          <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 h-[72px] box-border overflow-hidden">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-400" />
              <h3 className="font-semibold text-slate-800">Транскрипт по слайдам</h3>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex bg-slate-100 rounded-lg p-0.5">
                <button
                  onClick={() => setTranscriptTab('original')}
                  className={cn('px-3 py-1.5 rounded-md text-xs font-medium', transcriptTab === 'original' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600')}
                >
                  Оригинал
                </button>
                <button
                  onClick={() => setTranscriptTab('translation')}
                  className={cn('px-3 py-1.5 rounded-md text-xs font-medium', transcriptTab === 'translation' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-600')}
                >
                  Перевод
                </button>
              </div>
              <button
                onClick={handleTranslate}
                disabled={!transcript.trim() || isTranslating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium disabled:opacity-50"
              >
                {isTranslating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Languages className="w-3.5 h-3.5" />}
                Перевести
              </button>
              <button
                onClick={handleTranscribe}
                disabled={slideUrls.length === 0 || isTranscribing}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-medium transition-colors',
                  slideUrls.length === 0 || isTranscribing
                    ? 'bg-violet-400 cursor-not-allowed'
                    : 'bg-violet-500 hover:bg-violet-600'
                )}
              >
                {isTranscribing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Images className="w-3.5 h-3.5" />}
                Транскрибировать
              </button>
              {(transcriptTab === 'original' ? transcript : translation) && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(transcriptTab === 'original' ? transcript : translation);
                    setCopiedTranscript(true);
                    setTimeout(() => setCopiedTranscript(false), 2000);
                  }}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  {copiedTranscript ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-4">
            {transcriptStatus === 'processing' && !transcript && (
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="w-5 h-5 animate-spin" />
                Анализ слайдов...
              </div>
            )}
            {transcriptTab === 'original' && (
              <textarea
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                className="w-full min-h-[200px] p-3 rounded-xl border border-slate-200 text-sm text-slate-700 resize-y focus:outline-none focus:ring-2 focus:ring-violet-200"
                placeholder="Нажмите «Транскрибировать» — текст будет извлечён из слайдов через Gemini."
              />
            )}
            {transcriptTab === 'translation' && (
              <textarea
                value={translation}
                onChange={e => setTranslation(e.target.value)}
                className="w-full min-h-[200px] p-3 rounded-xl border border-slate-200 text-sm text-slate-700 resize-y focus:outline-none focus:ring-2 focus:ring-violet-200"
                placeholder="Нажмите «Перевести» для перевода на русский."
              />
            )}
          </div>
        </div>

        {/* Right: Script — высота шапки 72px как у Транскрипта */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0 rounded-xl bg-white/80 border border-slate-200/80 overflow-hidden">
          <div className="flex-shrink-0 flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100 h-[72px] box-border overflow-hidden">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-violet-500" />
              <h3 className="font-semibold text-slate-800">Сценарий</h3>
              {(projectStyles.length > 0 || currentProject?.stylePrompt) && (
                <div className="relative">
                  <button
                    onClick={() => setShowStylePickerPopover(!showStylePickerPopover)}
                    disabled={isGeneratingScript || !transcript.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium disabled:opacity-50"
                  >
                    {isGeneratingScript ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
                    По стилю
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  {showStylePickerPopover && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowStylePickerPopover(false)} aria-hidden />
                      <div className="absolute top-full left-0 mt-1 z-50 min-w-[200px] rounded-xl border border-slate-200 bg-white shadow-xl py-1.5">
                        {projectStyles.map(s => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => handleGenerateByStyle(s)}
                            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            {s.name}
                          </button>
                        ))}
                        {currentProject?.stylePrompt && projectStyles.length === 0 && (
                          <button
                            type="button"
                            onClick={() => handleGenerateByStyle({
                              id: 'legacy',
                              name: 'Стиль по умолчанию',
                              prompt: currentProject.stylePrompt!,
                              meta: currentProject.styleMeta,
                              examplesCount: currentProject.styleExamplesCount,
                            })}
                            className="w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50"
                          >
                            Стиль по умолчанию
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {script && (
              <>
                <button onClick={handleSaveScript} disabled={isSavingScript} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-500 text-white text-xs font-medium disabled:opacity-50">
                  {isSavingScript ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  Сохранить
                </button>
                <button
                  onClick={() => { navigator.clipboard.writeText(script); setCopiedScript(true); setTimeout(() => setCopiedScript(false), 2000); }}
                  className="p-2 rounded-lg hover:bg-slate-100 text-slate-500"
                >
                  {copiedScript ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
                </button>
              </>
            )}
          </div>
          <div className="flex-1 min-h-0 overflow-auto p-4">
            <textarea
              value={script}
              onChange={e => setScript(e.target.value)}
              className="w-full h-full min-h-[200px] p-3 rounded-xl border border-slate-200 text-sm text-slate-700 resize-none focus:outline-none focus:ring-2 focus:ring-violet-200"
              placeholder="Сгенерируйте сценарий по стилю или напишите вручную."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
