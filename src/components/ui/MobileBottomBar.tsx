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

const spring = { type: "spring" as const, stiffness: 500, damping: 38, mass: 0.7 };

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
          paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))",
          paddingLeft: 24,
          paddingRight: 24,
          paddingTop: 6,
        }}
        {...props}
      >
        {/* iOS frosted glass pill — compact */}
        <div
          className="pointer-events-auto"
          style={{
            background: "rgba(255, 255, 255, 0.78)",
            backdropFilter: "blur(36px) saturate(200%)",
            WebkitBackdropFilter: "blur(36px) saturate(200%)",
            borderRadius: 32,
            border: "1px solid rgba(255, 255, 255, 0.72)",
            boxShadow:
              "0 2px 16px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.88)",
            padding: "4px 4px",
          }}
        >
          <ul className="flex items-center gap-0.5">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeId;

              return (
                <li key={item.id}>
                  <motion.button
                    type="button"
                    role="tab"
                    onClick={() => onTabClick(item.id)}
                    className="relative flex flex-col items-center justify-center touch-manipulation"
                    style={{ width: 58, paddingTop: 7, paddingBottom: 7 }}
                    whileTap={{ scale: 0.88 }}
                    transition={spring}
                    aria-label={item.label}
                    aria-selected={isActive}
                  >
                    {/* Active pill */}
                    <AnimatePresence>
                      {isActive && (
                        <motion.div
                          layoutId="ios-pill"
                          className="absolute inset-0"
                          style={{ borderRadius: 22 }}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={spring}
                        >
                          <div
                            style={{
                              position: "absolute",
                              inset: 0,
                              borderRadius: 22,
                              background: "rgba(15, 15, 20, 0.07)",
                            }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Icon
                      className="relative z-10"
                      style={{
                        width: 20,
                        height: 20,
                        color: isActive ? "#18181b" : "#9ca3af",
                        strokeWidth: isActive ? 2.1 : 1.6,
                        transition: "color 0.18s ease",
                      }}
                    />

                    <span
                      className="relative z-10 mt-0.5"
                      style={{
                        fontSize: 9.5,
                        fontWeight: isActive ? 600 : 400,
                        letterSpacing: "-0.01em",
                        color: isActive ? "#18181b" : "#9ca3af",
                        lineHeight: 1.2,
                        transition: "color 0.18s ease",
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
