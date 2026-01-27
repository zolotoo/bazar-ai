/**
 * Framer Motion presets — iOS 26 / visionOS feel.
 * No sharp easings; spring-based, slight overshoot, fast settle.
 */

import type { Transition, Variants } from 'framer-motion';

/** Spring: calm, slight overshoot, fast settle */
export const iosSpring: Transition = {
  type: 'spring',
  stiffness: 400,
  damping: 30,
  mass: 0.8,
};

/** Softer spring for heavier/larger elements */
export const iosSpringSoft: Transition = {
  type: 'spring',
  stiffness: 300,
  damping: 28,
  mass: 1,
};

/** Snappier spring for small UI feedback */
export const iosSpringSnap: Transition = {
  type: 'spring',
  stiffness: 500,
  damping: 35,
  mass: 0.6,
};

/** Slow, calm spring for panels/sidebars */
export const iosSpringCalm: Transition = {
  type: 'spring',
  stiffness: 260,
  damping: 30,
  mass: 1,
};

/** Hover elevation — slight lift, subtle shadow feel. Use with transition={iosSpring}. */
export const hoverLiftVariants: Variants = {
  rest: { y: 0 },
  hover: { y: -6 },
  tap: { y: -2 },
};

/** Legacy alias */
export const hoverLift = hoverLiftVariants;

/** Glass card hover — lift + scale. Use with transition={iosSpring}. */
export const glassHoverVariants: Variants = {
  rest: { y: 0, scale: 1 },
  hover: { y: -6, scale: 1.01 },
  tap: { y: -2, scale: 0.99 },
};

/** Legacy alias */
export const glassHover = glassHoverVariants;

/** Panel enter — fade + rise on mount */
export const panelEnter: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: iosSpring,
  },
  exit: {
    opacity: 0,
    y: 8,
    transition: { type: 'spring', stiffness: 400, damping: 35 },
  },
};

/** Sidebar slide — open/close with spring */
export const sidebarSlide = {
  open: { x: 0 },
  closed: { x: '-100%' },
  transition: iosSpringCalm,
} as const;

/** Sidebar slide variants for AnimatePresence */
export const sidebarSlideVariants: Variants = {
  hidden: { x: '-100%' },
  visible: { x: 0, transition: iosSpringCalm },
  exit: { x: '-100%', transition: iosSpringCalm },
};

/** Dialog / overlay — soft scale-in */
export const dialogScale: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: iosSpringSoft,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    transition: { type: 'spring', stiffness: 400, damping: 32 },
  },
};

/** Backdrop fade for overlays */
export const backdropFade: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/** Stagger children — for lists / cards */
export const staggerContainer = {
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    },
  },
} as const;

export const staggerItem = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: iosSpring },
} as const;
