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

const spring = { type: "spring" as const, stiffness: 520, damping: 34, mass: 0.75 };

export const MobileBottomBar = React.forwardRef<HTMLElement, MobileBottomBarProps>(
  ({ className, items, activeId, onTabClick, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        role="tablist"
        className={cn(
          "md:hidden fixed left-0 right-0 bottom-0 z-[9998]",
          "pointer-events-none flex justify-center",
          className
        )}
        style={{
          paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))",
          paddingLeft: 20,
          paddingRight: 20,
          paddingTop: 8,
        }}
        {...props}
      >
        {/* Dark glass pill */}
        <div
          className="pointer-events-auto relative"
          style={{
            background: "rgba(22, 22, 30, 0.72)",
            backdropFilter: "blur(32px) saturate(180%)",
            WebkitBackdropFilter: "blur(32px) saturate(180%)",
            borderRadius: 28,
            border: "1px solid rgba(255,255,255,0.10)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.28), 0 2px 8px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.07)",
            padding: "6px 8px",
          }}
        >
          {/* Top shine line */}
          <div
            className="absolute top-0 left-4 right-4 h-px pointer-events-none"
            style={{
              background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.12) 40%, rgba(255,255,255,0.12) 60%, transparent)",
              borderRadius: 1,
            }}
          />

          <ul className="flex items-center gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeId;

              return (
                <li key={item.id} className="flex justify-center">
                  <motion.button
                    type="button"
                    role="tab"
                    onClick={() => onTabClick(item.id)}
                    className="relative flex items-center justify-center touch-manipulation"
                    style={{ width: 56, height: 52 }}
                    whileTap={{ scale: 0.88 }}
                    transition={spring}
                    aria-label={item.label}
                    aria-selected={isActive}
                  >
                    {/* Active circular background */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          layoutId="active-bg"
                          className="absolute inset-0 m-auto"
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 16,
                            background: "linear-gradient(145deg, #4a7cf7 0%, #3563e9 100%)",
                            boxShadow: "0 4px 16px rgba(59,99,247,0.45), inset 0 1px 0 rgba(255,255,255,0.20)",
                          }}
                          initial={{ scale: 0.6, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          exit={{ scale: 0.6, opacity: 0 }}
                          transition={spring}
                        />
                      )}
                    </AnimatePresence>

                    {/* Icon */}
                    <Icon
                      className="relative z-10 transition-all duration-200"
                      style={{
                        width: 21,
                        height: 21,
                        color: isActive ? "rgba(255,255,255,1)" : "rgba(255,255,255,0.45)",
                        strokeWidth: isActive ? 2.2 : 1.8,
                        filter: isActive
                          ? "drop-shadow(0 1px 4px rgba(255,255,255,0.25))"
                          : "none",
                      }}
                    />
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
