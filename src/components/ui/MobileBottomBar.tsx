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

const spring = { type: "spring" as const, stiffness: 480, damping: 36, mass: 0.8 };

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
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
          paddingLeft: 20,
          paddingRight: 20,
          paddingTop: 8,
        }}
        {...props}
      >
        {/* iOS-style frosted glass pill */}
        <div
          className="pointer-events-auto relative"
          style={{
            background: "rgba(255, 255, 255, 0.82)",
            backdropFilter: "blur(40px) saturate(200%)",
            WebkitBackdropFilter: "blur(40px) saturate(200%)",
            borderRadius: 26,
            border: "1px solid rgba(255, 255, 255, 0.75)",
            boxShadow:
              "0 2px 20px rgba(0,0,0,0.07), 0 1px 4px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
            padding: "5px 6px",
          }}
        >
          <ul className="flex items-center">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeId;

              return (
                <li key={item.id} className="flex justify-center">
                  <motion.button
                    type="button"
                    role="tab"
                    onClick={() => onTabClick(item.id)}
                    className="relative flex flex-col items-center justify-center touch-manipulation"
                    style={{ minWidth: 64, paddingTop: 6, paddingBottom: 6, paddingLeft: 4, paddingRight: 4 }}
                    whileTap={{ scale: 0.9 }}
                    transition={spring}
                    aria-label={item.label}
                    aria-selected={isActive}
                  >
                    {/* Active pill background */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          layoutId="ios-active-bg"
                          className="absolute inset-0"
                          style={{ borderRadius: 18 }}
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.85 }}
                          transition={spring}
                        >
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              borderRadius: 18,
                              background: "rgba(30, 30, 40, 0.08)",
                            }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Icon */}
                    <Icon
                      className="relative z-10 transition-colors duration-200"
                      style={{
                        width: 22,
                        height: 22,
                        color: isActive ? "#1c1c28" : "#a1a1aa",
                        strokeWidth: isActive ? 2.2 : 1.7,
                      }}
                    />

                    {/* Label */}
                    <span
                      className="relative z-10 transition-colors duration-200 mt-0.5"
                      style={{
                        fontSize: 10,
                        fontWeight: isActive ? 600 : 400,
                        letterSpacing: "-0.01em",
                        color: isActive ? "#1c1c28" : "#a1a1aa",
                        lineHeight: 1.2,
                      }}
                    >
                      {item.label}
                    </span>
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
