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
      >
        <button
          ref={ref}
          className={cn(
            "relative z-10 flex items-center justify-center rounded-xl font-medium transition-all duration-300",
            sizeClasses[size],
            isActive
              ? "text-white"
              : "text-slate-600 hover:text-slate-800",
            className
          )}
          {...props}
        >
          {/* Background layers */}
          {isActive ? (
            <>
              {/* Active gradient background */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-orange-500 to-amber-500 shadow-lg shadow-orange-500/30" />
              {/* Glass overlay */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-transparent via-white/10 to-white/20" />
              {/* Inner glow */}
              <div className="absolute inset-[1px] rounded-[10px] bg-gradient-to-b from-white/20 to-transparent opacity-50" />
            </>
          ) : (
            <>
              {/* Inactive glass background */}
              <div className="absolute inset-0 rounded-xl bg-white/60 backdrop-blur-md border border-white/80 shadow-sm" />
              {/* Hover effect */}
              <div className="absolute inset-0 rounded-xl bg-gradient-to-t from-orange-500/0 via-orange-500/0 to-orange-500/0 group-hover:from-orange-500/5 group-hover:to-orange-500/10 transition-all" />
            </>
          )}

          {/* Content */}
          <span className="relative z-10 flex items-center gap-inherit">
            {icon && <span className="flex-shrink-0">{icon}</span>}
            {children}
          </span>
        </button>

        {/* Active glow effect */}
        {isActive && (
          <div className="absolute inset-0 rounded-xl bg-orange-500/20 blur-xl -z-10" />
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
        "inline-flex items-center gap-1.5 p-1.5 rounded-2xl",
        "bg-white/40 backdrop-blur-xl border border-white/60",
        "shadow-lg shadow-black/5",
        className
      )}
    >
      {children}
    </div>
  );
};

export { GlassTabButton, GlassTabGroup };
