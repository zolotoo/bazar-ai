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

/** Light theme tab bar — transparent, labels only when active, 4 buttons */
export const MobileBottomBar = React.forwardRef<HTMLElement, MobileBottomBarProps>(
  ({ className, items, activeId, onTabClick, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        role="tablist"
        className={cn(
          "md:hidden fixed left-0 right-0 bottom-0 z-[9998]",
          "bg-transparent",
          "pt-2 touch-manipulation",
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
                    isActive
                      ? "text-slate-800 bg-white/70 backdrop-blur-xl"
                      : "text-slate-500 active:bg-white/30"
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
