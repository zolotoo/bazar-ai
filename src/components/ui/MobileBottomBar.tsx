"use client";

import * as React from "react";
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

/** iOS 26 style tab bar — glass morphism, frosted glass, labels only when active */
export const MobileBottomBar = React.forwardRef<HTMLElement, MobileBottomBarProps>(
  ({ className, items, activeId, onTabClick, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        role="tablist"
        className={cn(
          "md:hidden fixed left-0 right-0 bottom-0 z-[9998]",
          "bg-white/60 backdrop-blur-2xl backdrop-saturate-[180%]",
          "border-t border-white/[0.4]",
          "pt-2 touch-manipulation",
          "shadow-[0_-4px_24px_rgba(0,0,0,0.04),inset_0_1px_0_rgba(255,255,255,0.6)]",
          className
        )}
        style={{
          paddingBottom: "max(12px, env(safe-area-inset-bottom, 12px))",
          paddingLeft: "max(8px, env(safe-area-inset-left))",
          paddingRight: "max(8px, env(safe-area-inset-right))",
        }}
        {...props}
      >
        <ul className="flex items-center justify-around gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeId;

            return (
              <li key={item.id} className="flex-1 flex justify-center min-w-0">
                <button
                  type="button"
                  role="tab"
                  onClick={() => onTabClick(item.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1 min-w-[44px] min-h-[52px] py-2 px-2 rounded-2xl flex-1 max-w-[80px]",
                    "transition-all duration-200 touch-manipulation active:scale-95",
                    "backdrop-blur-xl backdrop-saturate-[180%]",
                    isActive
                      ? "text-slate-800 bg-white/70 border border-white/60 shadow-[0_2px_12px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.9)]"
                      : "text-slate-500 bg-white/30 border border-white/40 shadow-[0_1px_4px_rgba(0,0,0,0.03),inset_0_1px_0_rgba(255,255,255,0.5)] active:bg-white/50"
                  )}
                  aria-label={item.label}
                  aria-selected={isActive}
                  title={item.label}
                >
                  <Icon
                    className="w-6 h-6 flex-shrink-0"
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  {isActive && (
                    <span className="text-[10px] font-medium font-heading tracking-[-0.01em] truncate w-full text-center text-slate-800">
                      {item.label}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    );
  }
);

MobileBottomBar.displayName = "MobileBottomBar";
