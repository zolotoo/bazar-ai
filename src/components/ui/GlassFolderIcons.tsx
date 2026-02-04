'use client';

import { cn } from '../../utils/cn';

/** hex → rgba для translucent фона */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

interface GlassFolderIconProps {
  iconType: string;
  color: string;
  size?: 12 | 16 | 20 | 24;
  className?: string;
  /** На тёмном фоне — инвертировать (белый иконка) */
  invert?: boolean;
}

/**
 * Иконки папок и проектов в стиле iOS 26 / glass.
 * Округлый контейнер + символ в наших цветах (slate + accent).
 */
export function GlassFolderIcon({
  iconType,
  color,
  size = 20,
  className,
  invert = false,
}: GlassFolderIconProps) {
  const solid = invert ? '#fff' : color;
  const bg = invert ? 'rgba(255,255,255,0.2)' : hexToRgba(color, 0.22);

  const vb = 24;

  const iconEl = (() => {
    switch (iconType) {
      case 'inbox':
      case 'all':
        return (
          <path d="M5 8h14l-2 4H7L5 8zm0 0v10h14V8" stroke={solid} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        );
      case 'lightbulb':
        return (
          <path d="M9 21h6M12 3a5.5 5.5 0 015 6c0 2.5-2 4-2 6h-6c0-2-2-3.5-2-6a5.5 5.5 0 015-6z" stroke={solid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        );
      case 'file':
        return (
          <path d="M14 2H8a2 2 0 00-2 2v16a2 2 0 002 2h8a2 2 0 002-2V8l-6-6zm0 0v6h6M10 13h4M10 17h4" stroke={solid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        );
      case 'camera':
        return (
          <path d="M4 8h2l2-2h8l2 2h2a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-8a2 2 0 012-2zm8 6a3 3 0 100-6 3 3 0 000 6z" stroke={solid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        );
      case 'scissors':
        return (
          <path d="M6 9a3 3 0 100 6 3 3 0 100-6zM6 9l6 6M18 9a3 3 0 100 6 3 3 0 100-6zM6 15l6-6" stroke={solid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        );
      case 'check':
        return (
          <path d="M6 12l4 4 8-8" stroke={solid} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        );
      case 'rejected':
        return (
          <path d="M4 6h16l-2 14H6L4 6zm4 0V5a1 1 0 011-1h4a1 1 0 011 1v1M9 10v6M12 10v6M15 10v6" stroke={solid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        );
      case 'sparkles':
        return (
          <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3zM6 15l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3zM18 15l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3z" stroke={solid} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        );
      case 'folder':
      default:
        return (
          <path d="M4 8h6l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2v-8a2 2 0 012-2z" stroke={solid} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        );
    }
  })();

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-xl flex-shrink-0',
        'border border-white/30 shadow-[0_1px_3px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.5)]',
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
      }}
    >
      <svg width={Math.max(10, size - 4)} height={Math.max(10, size - 4)} viewBox={`0 0 ${vb} ${vb}`} fill="none" className="flex-shrink-0">
        {iconEl}
      </svg>
    </span>
  );
}
