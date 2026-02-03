'use client';

import { cn } from '../../utils/cn';

/** Цвета glassmorphism — accent-blue для соответствия референсу */
const GLASS_BG = 'rgba(94, 159, 237, 0.35)';
const GLASS_SOLID = '#5E9FED';
const GLASS_WHITE = 'rgba(255, 255, 255, 0.9)';

interface GlassIconProps {
  className?: string;
  size?: number;
}

const defaultSize = 48;

/** Папка — translucent body + solid tab */
export function GlassFolder({ className, size = defaultSize }: GlassIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn(className)}>
      <rect x="6" y="14" width="36" height="28" rx="6" fill={GLASS_BG} stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.6" />
      <path d="M6 22h12l4-4h20" stroke={GLASS_SOLID} strokeWidth="2" strokeLinecap="round" fill="none" />
      <rect x="6" y="14" width="16" height="8" rx="2" fill={GLASS_SOLID} fillOpacity="0.9" />
    </svg>
  );
}

/** Галочка — solid check в translucent circle */
export function GlassCheck({ className, size = defaultSize }: GlassIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn(className)}>
      <circle cx="24" cy="24" r="20" fill={GLASS_BG} stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.6" />
      <path d="M14 24l8 8 16-16" stroke={GLASS_SOLID} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/** Замок — translucent body + solid shackle */
export function GlassLock({ className, size = defaultSize }: GlassIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn(className)}>
      <rect x="12" y="22" width="24" height="18" rx="4" fill={GLASS_BG} stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.6" />
      <path d="M16 22V16a8 8 0 0116 0v6" stroke={GLASS_SOLID} strokeWidth="2.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Календарь — translucent square + 31 */
export function GlassCalendar({ className, size = defaultSize }: GlassIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn(className)}>
      <rect x="8" y="10" width="32" height="30" rx="6" fill={GLASS_BG} stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="8" y="10" width="32" height="10" rx="6" fill={GLASS_SOLID} fillOpacity="0.8" />
      <text x="24" y="32" textAnchor="middle" fill={GLASS_WHITE} fontSize="14" fontWeight="600" fontFamily="Inter, sans-serif">31</text>
    </svg>
  );
}

/** Видео / плёнка — translucent reel + solid circle */
export function GlassVideo({ className, size = defaultSize }: GlassIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn(className)}>
      <circle cx="24" cy="24" r="18" fill={GLASS_BG} stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.6" />
      <circle cx="24" cy="24" r="8" fill={GLASS_SOLID} fillOpacity="0.9" />
      <circle cx="24" cy="12" r="3" fill={GLASS_SOLID} fillOpacity="0.5" />
      <circle cx="36" cy="24" r="3" fill={GLASS_SOLID} fillOpacity="0.5" />
      <circle cx="24" cy="36" r="3" fill={GLASS_SOLID} fillOpacity="0.5" />
      <circle cx="12" cy="24" r="3" fill={GLASS_SOLID} fillOpacity="0.5" />
    </svg>
  );
}

/** Облако — translucent cloud + solid circle */
export function GlassCloud({ className, size = defaultSize }: GlassIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn(className)}>
      <ellipse cx="24" cy="28" rx="16" ry="10" fill={GLASS_BG} stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.6" />
      <path d="M12 28a12 6 0 0118-4 10 6 0 01-2 12" fill={GLASS_BG} stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.6" />
      <circle cx="36" cy="18" r="6" fill={GLASS_SOLID} fillOpacity="0.9" />
    </svg>
  );
}

/** Геолокация — solid pin + translucent base */
export function GlassLocation({ className, size = defaultSize }: GlassIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn(className)}>
      <path d="M24 8c-6 0-10 5-10 10 0 8 10 18 10 18s10-10 10-18c0-5-4-10-10-10z" fill={GLASS_BG} stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.6" />
      <circle cx="24" cy="18" r="4" fill={GLASS_SOLID} fillOpacity="0.9" />
    </svg>
  );
}

/** Переключатель — oval + translucent handle */
export function GlassToggle({ className, size = defaultSize }: GlassIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn(className)}>
      <rect x="4" y="16" width="40" height="16" rx="8" fill={GLASS_SOLID} fillOpacity="0.9" />
      <circle cx="32" cy="24" r="6" fill={GLASS_WHITE} fillOpacity="0.95" />
    </svg>
  );
}

/** Карта оплаты / коины — translucent card + символ */
export function GlassPayment({ className, size = defaultSize }: GlassIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn(className)}>
      <rect x="6" y="12" width="36" height="24" rx="6" fill={GLASS_BG} stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="6" y="12" width="36" height="8" rx="6" fill={GLASS_SOLID} fillOpacity="0.6" />
      <text x="24" y="32" textAnchor="middle" fill={GLASS_SOLID} fontSize="12" fontWeight="700" fontFamily="Inter, sans-serif">R</text>
    </svg>
  );
}

/** Слои / overlap — два translucent прямоугольника */
export function GlassLayers({ className, size = defaultSize }: GlassIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn(className)}>
      <rect x="8" y="20" width="28" height="20" rx="4" fill={GLASS_BG} stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="12" y="8" width="28" height="20" rx="4" fill={GLASS_BG} fillOpacity="0.7" stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.6" />
    </svg>
  );
}

/** Ценник — overlapping tags */
export function GlassPriceTag({ className, size = defaultSize }: GlassIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn(className)}>
      <path d="M8 8h16l16 16-12 12L8 24V8z" fill={GLASS_SOLID} fillOpacity="0.8" />
      <path d="M12 12h12l12 12-8 8L12 28V12z" fill={GLASS_BG} stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.6" />
      <text x="20" y="28" textAnchor="middle" fill={GLASS_WHITE} fontSize="10" fontWeight="700" fontFamily="Inter, sans-serif">%</text>
    </svg>
  );
}

/** Калькулятор — translucent square + symbols */
export function GlassCalculator({ className, size = defaultSize }: GlassIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn(className)}>
      <rect x="8" y="8" width="32" height="32" rx="6" fill={GLASS_BG} stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.6" />
      <rect x="8" y="8" width="32" height="10" rx="6" fill={GLASS_SOLID} fillOpacity="0.6" />
      <line x1="14" y1="24" x2="22" y2="24" stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.8" />
      <line x1="26" y1="24" x2="34" y2="24" stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.8" />
      <line x1="20" y1="30" x2="28" y2="30" stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.8" />
    </svg>
  );
}

/** Профиль с уведомлением — person + bubble */
export function GlassProfileNotify({ className, size = defaultSize }: GlassIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn(className)}>
      <circle cx="24" cy="18" r="8" fill={GLASS_SOLID} fillOpacity="0.9" />
      <path d="M12 40c0-8 5-14 12-14s12 6 12 14" fill={GLASS_SOLID} fillOpacity="0.8" />
      <circle cx="36" cy="12" r="10" fill={GLASS_BG} stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.6" />
      <text x="36" y="16" textAnchor="middle" fill={GLASS_WHITE} fontSize="12" fontWeight="700" fontFamily="Inter, sans-serif">1</text>
    </svg>
  );
}

/** Command key */
export function GlassCommand({ className, size = defaultSize }: GlassIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn(className)}>
      <rect x="8" y="12" width="32" height="24" rx="4" fill={GLASS_BG} stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.6" />
      <path d="M18 24h4M26 20v8M22 24h4" stroke={GLASS_SOLID} strokeWidth="2" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Два overlapping circles */
export function GlassOverlap({ className, size = defaultSize }: GlassIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={cn(className)}>
      <circle cx="28" cy="24" r="14" fill={GLASS_SOLID} fillOpacity="0.9" />
      <circle cx="20" cy="24" r="14" fill={GLASS_BG} stroke={GLASS_SOLID} strokeWidth="1.5" strokeOpacity="0.6" />
    </svg>
  );
}
