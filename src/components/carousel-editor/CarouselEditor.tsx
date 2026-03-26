import { useState, useRef, useCallback } from 'react';
import { toPng } from 'html-to-image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ChevronLeft, ChevronRight, Download, Plus, Trash2,
  ArrowLeft
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { SlidePreview } from './SlidePreview';
import {
  CAROUSEL_TEMPLATES,
  createEmptySlidesData,
  createEmptySlideData,
  type CarouselTemplate,
  type SlideData,
} from './templates';

// ─── Template picker ────────────────────────────────────────────
function TemplatePicker({ onSelect }: { onSelect: (t: CarouselTemplate) => void }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h2 className="mb-6 text-xl font-bold text-gray-900">Выбери шаблон</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {CAROUSEL_TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t)}
            className={cn(
              'group relative aspect-square rounded-2xl overflow-hidden border-2 border-transparent',
              'hover:border-indigo-400 transition-all duration-200',
              t.bgClass,
            )}
          >
            <div className="flex h-full flex-col items-center justify-center gap-2 p-4">
              <span className="text-3xl">{t.previewEmoji}</span>
              <span className={cn('text-sm font-semibold', t.textColorClass)}>{t.name}</span>
              <span className={cn('text-xs opacity-60', t.textColorClass)}>{t.description}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Editor ─────────────────────────────────────────────────────
export function CarouselEditor() {
  const [template, setTemplate] = useState<CarouselTemplate | null>(null);
  const [slidesData, setSlidesData] = useState<SlideData[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [exporting, setExporting] = useState(false);
  const slideRef = useRef<HTMLDivElement>(null);

  // Pick template
  const handleSelectTemplate = useCallback((t: CarouselTemplate) => {
    setTemplate(t);
    setSlidesData(createEmptySlidesData(t));
    setCurrentSlide(0);
  }, []);

  // Update field
  const updateField = useCallback((slideIdx: number, fieldId: string, value: string) => {
    setSlidesData((prev) => {
      const next = [...prev];
      next[slideIdx] = { ...next[slideIdx], [fieldId]: value };
      return next;
    });
  }, []);

  // Add slide
  const addSlide = useCallback(() => {
    if (!template) return;
    if (slidesData.length >= template.maxSlides) return;
    const standardSlide = template.slides[1] || template.slides[0];
    setSlidesData((prev) => {
      const next = [...prev];
      // Insert before the last slide (CTA)
      next.splice(next.length - 1, 0, createEmptySlideData(standardSlide));
      return next;
    });
    setCurrentSlide(slidesData.length - 1); // go to new slide
  }, [template, slidesData.length]);

  // Remove slide
  const removeSlide = useCallback((idx: number) => {
    if (slidesData.length <= 2) return; // keep at least cover + CTA
    setSlidesData((prev) => prev.filter((_, i) => i !== idx));
    setCurrentSlide((prev) => Math.min(prev, slidesData.length - 2));
  }, [slidesData.length]);

  // Export all slides as PNGs
  const exportSlides = useCallback(async () => {
    if (!slideRef.current || !template) return;
    setExporting(true);

    try {
      for (let i = 0; i < slidesData.length; i++) {
        setCurrentSlide(i);
        // Wait for render
        await new Promise((r) => setTimeout(r, 100));

        const dataUrl = await toPng(slideRef.current, {
          width: 1080,
          height: 1080,
          pixelRatio: 2,
          style: {
            width: '1080px',
            height: '1080px',
            maxWidth: '1080px',
          },
        });

        const link = document.createElement('a');
        link.download = `slide-${i + 1}.png`;
        link.href = dataUrl;
        link.click();
      }
    } catch (err) {
      console.error('Export error:', err);
    } finally {
      setExporting(false);
    }
  }, [slidesData, template]);

  // Back to picker
  const reset = useCallback(() => {
    setTemplate(null);
    setSlidesData([]);
    setCurrentSlide(0);
  }, []);

  // ── No template selected → show picker ──
  if (!template) {
    return <TemplatePicker onSelect={handleSelectTemplate} />;
  }

  const slideTemplate = currentSlide < template.slides.length
    ? template.slides[currentSlide]
    : template.slides[1] || template.slides[0]; // for added slides, use standard

  const slideData = slidesData[currentSlide] || {};

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
        >
          <ArrowLeft size={16} />
          Назад к шаблонам
        </button>

        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">
            {template.previewEmoji} {template.name}
          </span>
          <button
            onClick={exportSlides}
            disabled={exporting}
            className={cn(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition-all',
              exporting
                ? 'bg-gray-400 cursor-wait'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95',
            )}
          >
            <Download size={16} />
            {exporting ? 'Экспорт...' : 'Скачать PNG'}
          </button>
        </div>
      </div>

      {/* Main area: preview + fields */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Preview */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-full overflow-hidden rounded-2xl border border-gray-200 shadow-lg">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.15 }}
              >
                <SlidePreview
                  ref={slideRef}
                  template={template}
                  slideTemplate={slideTemplate}
                  slideData={slideData}
                  slideIndex={currentSlide}
                  totalSlides={slidesData.length}
                />
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Slide nav */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCurrentSlide((p) => Math.max(0, p - 1))}
              disabled={currentSlide === 0}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronLeft size={20} />
            </button>

            {/* Dots */}
            <div className="flex items-center gap-1.5">
              {slidesData.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={cn(
                    'h-2 rounded-full transition-all duration-200',
                    i === currentSlide
                      ? 'w-6 bg-indigo-500'
                      : 'w-2 bg-gray-300 hover:bg-gray-400',
                  )}
                />
              ))}
            </div>

            <button
              onClick={() => setCurrentSlide((p) => Math.min(slidesData.length - 1, p + 1))}
              disabled={currentSlide === slidesData.length - 1}
              className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        {/* Fields panel */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700">
              Слайд {currentSlide + 1} из {slidesData.length}
              {currentSlide === 0 && ' — Обложка'}
              {currentSlide === slidesData.length - 1 && ' — Финал'}
            </h3>
            <div className="flex items-center gap-2">
              {currentSlide > 0 && currentSlide < slidesData.length - 1 && (
                <button
                  onClick={() => removeSlide(currentSlide)}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 size={14} />
                  Удалить
                </button>
              )}
              {slidesData.length < template.maxSlides && (
                <button
                  onClick={addSlide}
                  className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50 transition-colors"
                >
                  <Plus size={14} />
                  Слайд
                </button>
              )}
            </div>
          </div>

          {slideTemplate.fields.map((field) => (
            <div key={field.id} className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                {field.label}
              </label>
              {field.type === 'body' ? (
                <textarea
                  value={slideData[field.id] || ''}
                  onChange={(e) => updateField(currentSlide, field.id, e.target.value)}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  rows={4}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 resize-none transition-all"
                />
              ) : (
                <input
                  type="text"
                  value={slideData[field.id] || ''}
                  onChange={(e) => updateField(currentSlide, field.id, e.target.value)}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  className="rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100 transition-all"
                />
              )}
              {field.maxLength && (
                <span className="text-right text-[10px] text-gray-400">
                  {(slideData[field.id] || '').length}/{field.maxLength}
                </span>
              )}
            </div>
          ))}

          {/* Slide thumbnails strip */}
          <div className="mt-4 border-t border-gray-100 pt-4">
            <p className="mb-2 text-xs font-medium text-gray-400 uppercase tracking-wider">Все слайды</p>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {slidesData.map((data, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={cn(
                      'flex-shrink-0 w-16 rounded-lg overflow-hidden border-2 transition-all',
                      i === currentSlide ? 'border-indigo-500 shadow-md' : 'border-gray-200',
                    )}
                  >
                    <div className={cn('aspect-square flex items-center justify-center', template.bgClass)}>
                      <span className={cn('text-[8px] font-bold truncate px-1', template.textColorClass)}>
                        {data.title || `${i + 1}`}
                      </span>
                    </div>
                  </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
