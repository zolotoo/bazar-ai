"use client";

import * as React from "react";
import { cn } from "../../utils/cn";
import { motion } from "framer-motion";

export interface GlassTabButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isActive?: boolean;
  icon?: React.ReactNode;
  size?: "sm" | "default" | "lg";
}

const GlassTabButton = React.forwardRef<HTMLButtonElement, GlassTabButtonProps>(
  ({ className, children, isActive, icon, size = "default", ...props }, ref) => {
    const sizeClasses = {
      sm: "px-3 py-1.5 text-xs gap-1.5",
      default: "px-4 py-2.5 text-sm gap-2",
      lg: "px-6 py-3 text-base gap-2.5",
    };

    return (
      <motion.div
        className="relative"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        <button
          ref={ref}
          className={cn(
            "group relative z-10 flex items-center justify-center rounded-xl font-medium transition-all duration-300",
            sizeClasses[size],
            isActive
              ? "text-white"
              : "text-slate-600 hover:text-slate-800",
            className
          )}
          {...props}
        >
          {/* Background layers — iOS 26 / glass style */}
          {isActive ? (
            <>
              {/* Active: slate-600, glass depth */}
              <div className="absolute inset-0 rounded-xl bg-slate-600 shadow-glass-sm" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent via-white/10 to-white/20" />
              <div className="absolute inset-[1px] rounded-[10px] bg-gradient-to-b from-white/15 to-transparent opacity-60" />
            </>
          ) : (
            <>
              {/* Inactive: glass */}
              <div className="absolute inset-0 rounded-xl bg-glass-white/80 backdrop-blur-glass border border-white/[0.35] shadow-glass-sm" />
              <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-gradient-to-t from-slate-500/0 via-slate-500/0 to-slate-500/5" />
            </>
          )}

          {/* Content */}
          <span className="relative z-10 flex items-center gap-inherit">
            {icon && <span className="flex-shrink-0">{icon}</span>}
            {children}
          </span>
        </button>

        {/* Active glow — subtle */}
        {isActive && (
          <div className="absolute inset-0 rounded-xl bg-slate-600/15 blur-xl -z-10" />
        )}
      </motion.div>
    );
  }
);

GlassTabButton.displayName = "GlassTabButton";

// Tab Group component for multiple tabs
interface GlassTabGroupProps {
  children: React.ReactNode;
  className?: string;
}

const GlassTabGroup = ({ children, className }: GlassTabGroupProps) => {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 p-1.5 rounded-card-xl",
        "bg-glass-white/60 backdrop-blur-glass-xl border border-white/[0.35]",
        "shadow-glass-sm",
        className
      )}
    >
      {children}
    </div>
  );
};

export { GlassTabButton, GlassTabGroup };
