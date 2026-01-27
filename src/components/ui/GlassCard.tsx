'use client';

import * as React from 'react';
import { motion, type HTMLMotionProps } from 'framer-motion';
import { cn } from '../../utils/cn';
import { iosSpring, glassHoverVariants } from '../../utils/motionPresets';

export interface GlassCardProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children?: React.ReactNode;
  className?: string;
  /** Enable hover lift + shadow. Default true. */
  interactive?: boolean;
  /** Render as different element (e.g. Radix Slot). Default div. */
  as?: keyof typeof motion;
}

/**
 * GlassCard — etalon primitive for iOS 26 / visionOS–style UI.
 * Glassmorphism, soft 3D depth, floating shadow. Use for panels, video cards, widgets, dialogs.
 */
export const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(
  (
    {
      children,
      className,
      interactive = true,
      as: AsProp = 'div',
      ...props
    },
    ref
  ) => {
    const MotionComponent =
      AsProp === 'div'
        ? motion.div
        : typeof (motion as unknown as { create?: (c: unknown) => React.ComponentType }).create === 'function'
          ? (motion as unknown as { create: (c: unknown) => React.ComponentType }).create(AsProp)
          : motion.div;

    return (
      <MotionComponent
        ref={ref}
        className={cn(
          'rounded-card-xl overflow-hidden',
          'bg-glass-white/80 backdrop-blur-glass-xl',
          'border border-white/[0.35]',
          interactive && 'cursor-default shadow-glass hover:shadow-glass-hover',
          !interactive && 'shadow-glass',
          className
        )}
        initial="rest"
        whileHover={interactive ? 'hover' : undefined}
        whileTap={interactive ? 'tap' : undefined}
        variants={interactive ? glassHoverVariants : undefined}
        transition={iosSpring}
        {...props}
      >
        {children}
      </MotionComponent>
    );
  }
);

GlassCard.displayName = 'GlassCard';

/**
 * Static glass panel — no motion. Use when wrapping Radix content or when motion is handled elsewhere.
 */
export const GlassCardStatic = React.forwardRef<
  HTMLDivElement,
  Omit<GlassCardProps, 'interactive'> & { interactive?: never }
>(
  (
    {
      children,
      className,
      as: AsProp = 'div',
      ...props
    },
    ref
  ) => {
    const MotionComponent =
      AsProp === 'div'
        ? motion.div
        : typeof (motion as unknown as { create?: (c: unknown) => React.ComponentType }).create === 'function'
          ? (motion as unknown as { create: (c: unknown) => React.ComponentType }).create(AsProp)
          : motion.div;

    return (
      <MotionComponent
        ref={ref}
        className={cn(
          'rounded-card-xl overflow-hidden',
          'bg-glass-white/80 backdrop-blur-glass-xl shadow-glass',
          'border border-white/[0.35]',
          className
        )}
        {...props}
      >
        {children}
      </MotionComponent>
    );
  }
);

GlassCardStatic.displayName = 'GlassCardStatic';
