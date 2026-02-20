/**
 * Framer Motion presets — iOS 17 feel.
 *
 * Правило для боковых панелей / шитов:
 *   критическое демпфирование = 2 * sqrt(stiffness * mass)
 *   чтобы не было рингования — damping > критического
 *
 * panelSpring: crit ≈ 2*sqrt(600*0.85) ≈ 45.2 → damping 52 → overdamped ✓
 * dialogSpring: crit ≈ 2*sqrt(520*0.9) ≈ 43.2 → damping 48 → overdamped ✓
 */

import type { Transition, Variants } from 'framer-motion';

// ---------------------------------------------------------------------------
// Base springs
// ---------------------------------------------------------------------------

/** Боковая панель — overdamped, нет рингования, быстрый сетл */
export const panelSpring: Transition = {
  type: 'spring',
  stiffness: 600,
  damping: 52,
  mass: 0.85,
};

/** Выход панели — быстрый ease-in, пропадает моментально */
export const panelExit: Transition = {
  type: 'tween',
  duration: 0.2,
  ease: [0.4, 0, 1, 1],
};

/** iOS-шит снизу */
export const dialogSpring: Transition = {
  type: 'spring',
  stiffness: 520,
  damping: 48,
  mass: 0.9,
};

/** Мелкий UI-фидбек (кнопки, тапы) */
export const iosSpringSnap: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 38,
  mass: 0.65,
};

// legacy aliases — не ломаем старые импорты
export const iosSpring = panelSpring;
export const iosSpringSoft = dialogSpring;
export const iosSpringCalm = panelSpring;

// ---------------------------------------------------------------------------
// Backdrop
// ---------------------------------------------------------------------------

export const backdropFade: Variants = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.22, ease: 'easeOut' } },
  exit:    { opacity: 0, transition: { duration: 0.18, ease: 'easeIn' } },
};

// ---------------------------------------------------------------------------
// Side panels (sidebar left, folder panel right)
// ---------------------------------------------------------------------------

export const sidebarSlideVariants: Variants = {
  hidden:  { x: '-100%' },
  visible: { x: 0,      transition: panelSpring },
  exit:    { x: '-100%', transition: panelExit },
};

export const folderPanelVariants: Variants = {
  hidden:  { x: '100%' },
  visible: { x: 0,      transition: panelSpring },
  exit:    { x: '100%', transition: panelExit },
};

// legacy alias
export const sidebarSlide = sidebarSlideVariants;

// ---------------------------------------------------------------------------
// Dialogs / sheets
// ---------------------------------------------------------------------------

export const dialogSlideUp: Variants = {
  hidden:  { opacity: 0, y: '6%' },
  visible: {
    opacity: 1,
    y: 0,
    transition: dialogSpring,
  },
  exit: {
    opacity: 0,
    y: '4%',
    transition: { type: 'tween', duration: 0.2, ease: [0.4, 0, 1, 1] },
  },
};

export const dialogScale: Variants = {
  hidden:  { opacity: 0, scale: 0.97 },
  visible: { opacity: 1, scale: 1, transition: dialogSpring },
  exit:    { opacity: 0, scale: 0.97, transition: { type: 'tween', duration: 0.18, ease: [0.4, 0, 1, 1] } },
};

// ---------------------------------------------------------------------------
// Cards / lists
// ---------------------------------------------------------------------------

export const panelEnter: Variants = {
  hidden:  { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0,  transition: panelSpring },
  exit:    { opacity: 0, y: 6,  transition: panelExit },
};

export const hoverLiftVariants: Variants = {
  rest:  { y: 0 },
  hover: { y: -6 },
  tap:   { y: -2 },
};
export const hoverLift = hoverLiftVariants;

export const glassHoverVariants: Variants = {
  rest:  { y: 0, scale: 1 },
  hover: { y: -6, scale: 1.01 },
  tap:   { y: -2, scale: 0.99 },
};
export const glassHover = glassHoverVariants;

export const staggerContainer = {
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
} as const;

export const staggerItem = {
  hidden:  { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: panelSpring },
} as const;
