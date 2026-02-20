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

const spring = { type: "spring" as const, stiffness: 420, damping: 34, mass: 0.85 };

export const MobileBottomBar = React.forwardRef<HTMLElement, MobileBottomBarProps>(
  ({ className, items, activeId, onTabClick, ...props }, ref) => {
    return (
      <nav
        ref={ref}
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
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
          paddingLeft: 20,
          paddingRight: 20,
          paddingTop: 8,
        }}
        {...props}
      >
        {/* iOS 17 frosted glass pill */}
        <div
          className="pointer-events-auto"
          style={{
            background: "rgba(248, 248, 252, 0.84)",
            backdropFilter: "blur(44px) saturate(200%)",
            WebkitBackdropFilter: "blur(44px) saturate(200%)",
            borderRadius: 34,
            border: "1px solid rgba(255,255,255,0.72)",
            boxShadow:
              "0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.05), inset 0 1px 0 rgba(255,255,255,0.9)",
            padding: "6px 4px",
          }}
        >
          <ul
            role="presentation"
            style={{ display: "flex", alignItems: "center", background: "transparent", border: "none", padding: 0, margin: 0, listStyle: "none" }}
          >
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeId;

              return (
                <li
                  key={item.id}
                  style={{ padding: 0, minHeight: "unset", borderRadius: 0, listStyle: "none" }}
                >
                  <motion.button
                    type="button"
                    aria-label={item.label}
                    aria-selected={isActive}
                    onClick={() => onTabClick(item.id)}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 72,
                      paddingTop: 9,
                      paddingBottom: 9,
                      background: "transparent",
                      border: "none",
                      willChange: "transform",
                      minHeight: "unset",
                      minWidth: "unset",
                      cursor: "pointer",
                      WebkitTapHighlightColor: "transparent",
                      gap: 3,
                    }}
                    whileTap={{ scale: 0.87 }}
                    transition={spring}
                  >
                    <Icon
                      style={{
                        width: 24,
                        height: 24,
                        color: isActive ? "#18181b" : "#a8a8b0",
                        strokeWidth: isActive ? 2.1 : 1.65,
                        transition: "color 0.18s ease",
                        flexShrink: 0,
                      }}
                    />

                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: isActive ? 600 : 400,
                        letterSpacing: "-0.01em",
                        color: isActive ? "#18181b" : "#a8a8b0",
                        lineHeight: 1,
                        transition: "color 0.18s ease, font-weight 0.18s ease",
                        whiteSpace: "nowrap",
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
