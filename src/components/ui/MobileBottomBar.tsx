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
          "mobile-tab-bar",
          "md:hidden fixed left-0 right-0 bottom-0 z-[9998]",
          "touch-manipulation",
          "pointer-events-none [&_ul]:pointer-events-auto",
          className
        )}
        style={{
          paddingBottom: "max(16px, env(safe-area-inset-bottom, 16px))",
          paddingLeft: "max(12px, env(safe-area-inset-left, 12px))",
          paddingRight: "max(12px, env(safe-area-inset-right, 12px))",
          paddingTop: 12,
        }}
        {...props}
      >
        <ul className="flex items-center justify-around gap-0">
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
                    "flex flex-col items-center justify-center gap-1 min-w-[44px] min-h-[48px] py-2 px-4 rounded-full flex-1 max-w-[76px]",
                    "transition-all duration-200 touch-manipulation active:scale-95",
                    isActive
                      ? "bg-slate-600 text-white"
                      : "bg-transparent text-slate-700"
                  )}
                  aria-label={item.label}
                  aria-selected={isActive}
                  title={item.label}
                >
                  <Icon
                    className="w-5 h-5 flex-shrink-0"
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                  <span className={cn(
                    "text-[11px] font-medium font-heading tracking-[-0.01em] truncate w-full text-center",
                    isActive ? "text-white" : "text-slate-700"
                  )}>
                    {item.label}
                  </span>
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
