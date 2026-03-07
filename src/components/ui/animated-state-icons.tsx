"use client";

import { cn } from "../../utils/cn";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

// ─── Auto-toggle hook (for demos only) ───────────────────────────────────────
function useAutoToggle(interval: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), interval);
    return () => clearInterval(id);
  }, [interval]);
  return on;
}

interface StateIconProps {
  size?: number;
  color?: string;
  className?: string;
  duration?: number;
}

interface ControlledIconProps {
  size?: number;
  color?: string;
  className?: string;
  active: boolean;
}

// ─── 1. COPY → COPIED ────────────────────────────────────────────────────────
// Controlled: pass active=true when copied, false when not
export function AnimatedCopyIcon({ size = 20, color = "currentColor", className, active }: ControlledIconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <rect x="12" y="10" width="18" height="22" rx="2" stroke={color} strokeWidth={2} />
      <path
        d="M10 14h-0a2 2 0 00-2 2v18a2 2 0 002 2h14"
        stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.3}
      />
      <AnimatePresence mode="wait">
        {active ? (
          <motion.path
            key="check"
            d="M16 21l4 4 6-8"
            stroke="#10b981" strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            exit={{ pathLength: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
          />
        ) : (
          <motion.g
            key="lines"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <line x1="17" y1="18" x2="25" y2="18" stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.4} />
            <line x1="17" y1="23" x2="25" y2="23" stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.4} />
            <line x1="17" y1="28" x2="22" y2="28" stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.4} />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

// ─── 2. MENU ↔ CLOSE ─────────────────────────────────────────────────────────
// Controlled: pass active=true for close (X), false for hamburger (☰)
export function AnimatedMenuIcon({ size = 20, color = "currentColor", className, active }: ControlledIconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.line
        x1="10" x2="30" stroke={color} strokeWidth={2.5} strokeLinecap="round"
        animate={active ? { y1: 20, y2: 20, rotate: 45 } : { y1: 12, y2: 12, rotate: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        style={{ transformOrigin: "20px 20px" }}
      />
      <motion.line
        x1="10" y1="20" x2="30" y2="20" stroke={color} strokeWidth={2.5} strokeLinecap="round"
        animate={active ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.2 }}
        style={{ transformOrigin: "20px 20px" }}
      />
      <motion.line
        x1="10" x2="30" stroke={color} strokeWidth={2.5} strokeLinecap="round"
        animate={active ? { y1: 20, y2: 20, rotate: -45 } : { y1: 28, y2: 28, rotate: 0 }}
        transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
        style={{ transformOrigin: "20px 20px" }}
      />
    </svg>
  );
}

// ─── 3. SEND ─────────────────────────────────────────────────────────────────
// Controlled: active=true animates the plane flying off, then resets after delay
export function AnimatedSendIcon({ size = 20, color = "currentColor", className, active }: ControlledIconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.g
        animate={active
          ? { x: 22, y: -22, opacity: 0, scale: 0.5 }
          : { x: 0, y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.32, 0.72, 0, 1] }}
      >
        <path d="M34 6L16 20l-6-2L34 6z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        <path d="M34 6L22 34l-6-14" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        <line x1="16" y1="20" x2="22" y2="34" stroke={color} strokeWidth={2} />
      </motion.g>
    </svg>
  );
}

// ─── 4. LOADING → SUCCESS ────────────────────────────────────────────────────
// Controlled: active=true shows checkmark, false shows spinner
export function AnimatedSuccessIcon({ size = 20, color = "currentColor", className, active }: ControlledIconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.circle
        cx="20" cy="20" r="16" stroke={color} strokeWidth={2}
        animate={active ? { pathLength: 1, opacity: 1 } : { pathLength: 0.7, opacity: 0.4 }}
        transition={{ duration: 0.5 }}
      />
      {!active && (
        <motion.circle
          cx="20" cy="20" r="16" stroke={color} strokeWidth={2}
          strokeLinecap="round" strokeDasharray="25 75"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "20px 20px" }}
        />
      )}
      <motion.path
        d="M12 20l6 6 10-12" stroke={color} strokeWidth={2.5}
        strokeLinecap="round" strokeLinejoin="round"
        animate={active ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        transition={{ duration: 0.4, delay: active ? 0.2 : 0 }}
      />
    </svg>
  );
}

// ─── 5. HEART ────────────────────────────────────────────────────────────────
// Controlled: active=true fills the heart
export function AnimatedHeartIcon({ size = 20, color = "currentColor", className, active }: ControlledIconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.path
        d="M20 34s-12-7.5-12-16a7.5 7.5 0 0112-6 7.5 7.5 0 0112 6c0 8.5-12 16-12 16z"
        stroke={active ? "#ef4444" : color}
        strokeWidth={2}
        fill={active ? "#ef4444" : "none"}
        animate={active ? { scale: [1, 1.25, 1] } : { scale: 1 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        style={{ transformOrigin: "20px 22px" }}
      />
    </svg>
  );
}

// ─── 6. DOWNLOAD → DONE ──────────────────────────────────────────────────────
// Controlled: active=true shows checkmark
export function AnimatedDownloadIcon({ size = 20, color = "currentColor", className, active }: ControlledIconProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <path d="M8 28v4a2 2 0 002 2h20a2 2 0 002-2v-4" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <AnimatePresence mode="wait">
        {active ? (
          <motion.path
            key="check"
            d="M14 22l6 6 8-10"
            stroke={color} strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            exit={{ pathLength: 0, opacity: 0 }}
            transition={{ duration: 0.35 }}
          />
        ) : (
          <motion.g
            key="arrow"
            initial={{ y: -4, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
          >
            <line x1="20" y1="6" x2="20" y2="24" stroke={color} strokeWidth={2} strokeLinecap="round" />
            <polyline points="14,18 20,24 26,18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

// ─── AUTO-TOGGLE DEMOS ───────────────────────────────────────────────────────
// These are the original auto-toggling versions (useful for previews / demos)

export function SuccessIconDemo({ size = 40, color = "currentColor", className, duration = 2200 }: StateIconProps) {
  const done = useAutoToggle(duration);
  return <AnimatedSuccessIcon size={size} color={color} className={className} active={done} />;
}

export function MenuCloseIconDemo({ size = 40, color = "currentColor", className, duration = 2000 }: StateIconProps) {
  const open = useAutoToggle(duration);
  return <AnimatedMenuIcon size={size} color={color} className={className} active={open} />;
}

export function CopiedIconDemo({ size = 40, color = "currentColor", className, duration = 2200 }: StateIconProps) {
  const copied = useAutoToggle(duration);
  return <AnimatedCopyIcon size={size} color={color} className={className} active={copied} />;
}

export function SendIconDemo({ size = 40, color = "currentColor", className, duration = 2600 }: StateIconProps) {
  const sent = useAutoToggle(duration);
  return <AnimatedSendIcon size={size} color={color} className={className} active={sent} />;
}

export function HeartIconDemo({ size = 40, color = "currentColor", className, duration = 2000 }: StateIconProps) {
  const filled = useAutoToggle(duration);
  return <AnimatedHeartIcon size={size} color={color} className={className} active={filled} />;
}

export function DownloadDoneIconDemo({ size = 40, color = "currentColor", className, duration = 2400 }: StateIconProps) {
  const done = useAutoToggle(duration);
  return <AnimatedDownloadIcon size={size} color={color} className={className} active={done} />;
}
