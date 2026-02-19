"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../utils/cn";
import type { LucideIcon } from "lucide-react";

export type MobileTabId = "dashboard" | "workspace" | "profile" | "menu";

interface TabItem {
  id: MobileTabId;
  icon: LucideIcon;
  label: string;
  iconColor: string;
}

interface MobileBottomBarProps extends React.HTMLAttributes<HTMLElement> {
  items: TabItem[];
  activeId: MobileTabId | null;
  onTabClick: (id: MobileTabId) => void;
}

const springTab = { type: "spring" as const, stiffness: 500, damping: 32, mass: 0.8 };

export const MobileBottomBar = React.forwardRef<HTMLElement, MobileBottomBarProps>(
  ({ className, items, activeId, onTabClick, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        role="tablist"
        className={cn(
          "md:hidden fixed left-0 right-0 bottom-0 z-[9998]",
          "pointer-events-none",
          className
        )}
        style={{
          paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))",
          paddingLeft: "max(16px, env(safe-area-inset-left, 16px))",
          paddingRight: "max(16px, env(safe-area-inset-right, 16px))",
          paddingTop: 8,
        }}
        {...props}
      >
        <div
          className={cn(
            "pointer-events-auto mx-auto",
            "rounded-[22px]",
            "bg-white/60 backdrop-blur-2xl backdrop-saturate-[180%]",
            "border border-white/70",
            "shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.7)]",
          )}
          style={{ maxWidth: 320 }}
        >
          <ul className="flex items-center justify-around px-2 py-1.5 gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeId;

              return (
                <li key={item.id} className="flex-1 flex justify-center min-w-0">
                  <motion.button
                    type="button"
                    role="tab"
                    onClick={() => onTabClick(item.id)}
                    className={cn(
                      "relative flex items-center justify-center gap-1.5 touch-manipulation",
                      "rounded-2xl transition-colors duration-150",
                      "min-h-[40px]",
                      isActive
                        ? "px-4 py-2"
                        : "px-3 py-2 active:scale-90"
                    )}
                    layout
                    transition={springTab}
                    aria-label={item.label}
                    aria-selected={isActive}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="tab-pill"
                        className="absolute inset-0 rounded-2xl bg-slate-700 shadow-sm"
                        transition={springTab}
                      />
                    )}
                    <Icon
                      className={cn(
                        "relative z-10 w-[20px] h-[20px] flex-shrink-0 transition-colors duration-150",
                        isActive ? "text-white" : "text-slate-500"
                      )}
                      strokeWidth={isActive ? 2.2 : 1.8}
                    />
                    <AnimatePresence mode="wait">
                      {isActive && (
                        <motion.span
                          key={item.id}
                          initial={{ opacity: 0, width: 0 }}
                          animate={{ opacity: 1, width: "auto" }}
                          exit={{ opacity: 0, width: 0 }}
                          transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                          className="relative z-10 text-[12px] font-semibold text-white whitespace-nowrap overflow-hidden"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </motion.button>
                </li>
              );
            })}
          </ul>
        </div>
      </nav>
    );
  }
);

MobileBottomBar.displayName = "MobileBottomBar";
