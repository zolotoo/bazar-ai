'use client';

import { useRef, useEffect, useState, useId } from 'react';
import { createPortal } from 'react-dom';
import { FolderOpen, Check, ChevronDown } from 'lucide-react';
import { cn } from '../../utils/cn';
import { GlassFolderIcon } from './GlassFolderIcons';

export type GlassFolderPickItem = {
  id: string | null;
  title: string;
  color: string;
  iconType: string;
};

type GlassFolderPickButtonProps = {
  folders: GlassFolderPickItem[];
  value: string | null;
  onChange: (folderId: string | null) => void;
  disabled?: boolean;
  className?: string;
  /** Портал в body — чтобы выпадало поверх хедера */
  usePortal?: boolean;
};

/**
 * Кнопка выбора папки в стиле iOS / Liquid Glass: отдельная от «Добавить», кастомный список вместо native select.
 */
export function GlassFolderPickButton({
  folders,
  value,
  onChange,
  disabled,
  className,
  usePortal = true,
}: GlassFolderPickButtonProps) {
  const popoverId = useId();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });

  const selected = value === null
    ? null
    : folders.find((f) => f.id === value);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (wrapRef.current?.contains(t)) return;
      const portal = document.getElementById(popoverId);
      if (portal?.contains(t)) return;
      setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open, popoverId]);

  useEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setCoords({
      top: r.bottom + 8,
      left: r.left,
      width: Math.max(r.width, 220),
    });
  }, [open]);

  const list = (
    <div
      id={popoverId}
      role="listbox"
      className={cn(
        'rounded-2xl p-1.5 min-w-[220px] max-h-[min(320px,50vh)] overflow-y-auto',
        'bg-glass-white/92 backdrop-blur-glass-xl border border-white/[0.38] shadow-glass',
        'animate-in fade-in zoom-in-95 duration-150 custom-scrollbar-light'
      )}
      style={
        usePortal
          ? {
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: coords.width,
              zIndex: 10050,
            }
          : undefined
      }
    >
      <button
        type="button"
        role="option"
        aria-selected={value === null}
        onClick={() => {
          onChange(null);
          setOpen(false);
        }}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-xl text-left transition-colors touch-manipulation',
          value === null
            ? 'bg-white/88 border border-white/60 shadow-glass-sm'
            : 'hover:bg-white/65 active:bg-white/50'
        )}
      >
        <GlassFolderIcon iconType="inbox" color="#64748b" size={20} simple />
        <span className="text-sm font-medium text-slate-800 flex-1">Без папки</span>
        {value === null && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" strokeWidth={2.5} />}
      </button>
      <div className="h-px bg-white/45 my-1 mx-1" aria-hidden />
      {folders.map((f) => {
        if (f.id === null) return null;
        const isSel = value === f.id;
        return (
          <button
            key={f.id}
            type="button"
            role="option"
            aria-selected={isSel}
            onClick={() => {
              onChange(f.id);
              setOpen(false);
            }}
            className={cn(
              'w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px] rounded-xl text-left transition-colors touch-manipulation',
              isSel
                ? 'bg-white/88 border border-white/60 shadow-glass-sm'
                : 'hover:bg-white/65 active:bg-white/50'
            )}
          >
            <GlassFolderIcon iconType={f.iconType} color={f.color} size={20} simple />
            <span className="text-sm font-medium text-slate-800 flex-1 truncate">{f.title}</span>
            {isSel && <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" strokeWidth={2.5} />}
          </button>
        );
      })}
    </div>
  );

  return (
    <div ref={wrapRef} className={cn('relative', className)}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          'flex items-center gap-2 px-4 py-2.5 min-h-[44px] rounded-2xl w-full sm:w-auto sm:min-w-[140px]',
          'bg-white/82 backdrop-blur-glass border border-white/60 shadow-glass-sm',
          'text-slate-800 text-sm font-semibold transition-colors',
          'hover:bg-white/90 active:scale-[0.98] touch-manipulation',
          'disabled:opacity-50 disabled:pointer-events-none',
          open && 'ring-2 ring-slate-200/80 bg-white/90'
        )}
      >
        <FolderOpen className="w-4 h-4 text-slate-500 flex-shrink-0" strokeWidth={2.5} />
        <span className="truncate flex-1 text-left">{selected?.title ?? 'Папка'}</span>
        <ChevronDown
          className={cn('w-4 h-4 text-slate-400 flex-shrink-0 transition-transform', open && 'rotate-180')}
          strokeWidth={2.5}
        />
      </button>
      {open && !usePortal && <div className="absolute z-[100] left-0 right-0 mt-2">{list}</div>}
      {open && usePortal && typeof document !== 'undefined' && createPortal(list, document.body)}
    </div>
  );
}
