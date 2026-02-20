"use client";

import * as React from "react";
import { motion } from "framer-motion";
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
        // data-floating сбрасывает глобальные nav/tablist CSS-правила
        data-floating="true"
        role="tablist"
        className={cn(
          "md:hidden fixed left-0 right-0 bottom-0 z-[9998]",
          "pointer-events-none flex justify-center",
          className
        )}
        style={{
          background: "transparent",
          border: "none",
          paddingBottom: "max(10px, env(safe-area-inset-bottom, 10px))",
          paddingLeft: 24,
          paddingRight: 24,
          paddingTop: 6,
        }}
        {...props}
      >
        {/* Floating frosted-glass pill */}
        <div
          className="pointer-events-auto"
          style={{
            background: "rgba(255, 255, 255, 0.76)",
            backdropFilter: "blur(40px) saturate(210%)",
            WebkitBackdropFilter: "blur(40px) saturate(210%)",
            borderRadius: 36,
            border: "1px solid rgba(255, 255, 255, 0.70)",
            boxShadow:
              "0 2px 14px rgba(0,0,0,0.055), 0 1px 3px rgba(0,0,0,0.04), inset 0 1px 0 rgba(255,255,255,0.85)",
            padding: "5px 2px",
          }}
        >
          <ul
            role="presentation"
            className="flex items-center"
            style={{ background: "transparent", border: "none", padding: 0 }}
          >
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeId;

              return (
                <li
                  key={item.id}
                  style={{ padding: 0, minHeight: "unset", borderRadius: 0 }}
                >
                  <motion.button
                    type="button"
                    aria-label={item.label}
                    aria-selected={isActive}
                    onClick={() => onTabClick(item.id)}
                    className="flex flex-col items-center justify-center touch-manipulation"
                    style={{
                      width: 60,
                      paddingTop: 6,
                      paddingBottom: 6,
                      background: "transparent",
                      border: "none",
                      willChange: "transform",
                      minHeight: "unset",
                      minWidth: "unset",
                      padding: 0,
                      paddingTop: 6,
                      paddingBottom: 6,
                      cursor: "pointer",
                    }}
                    whileTap={{ scale: 0.88 }}
                    transition={spring}
                  >
                    <Icon
                      style={{
                        width: 21,
                        height: 21,
                        color: isActive ? "#18181b" : "#a1a1aa",
                        strokeWidth: isActive ? 2.2 : 1.6,
                        transition: "color 0.15s ease, stroke-width 0.15s ease",
                      }}
                    />

                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: isActive ? 600 : 400,
                        letterSpacing: "-0.01em",
                        color: isActive ? "#18181b" : "#a1a1aa",
                        lineHeight: 1.2,
                        marginTop: 2,
                        transition: "color 0.15s ease",
                      }}
                    >
                      {item.label}
                    </span>

                    {/* Dot indicator under active tab */}
                    <div
                      style={{
                        marginTop: 3,
                        width: 4,
                        height: 4,
                        borderRadius: "50%",
                        background: isActive ? "#18181b" : "transparent",
                        transition: "background 0.15s ease",
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
