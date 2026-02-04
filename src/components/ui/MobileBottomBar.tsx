"use client";

import * as React from "react";
import { cn } from "../../utils/cn";
import type { LucideIcon } from "lucide-react";

export type MobileTabId = "dashboard" | "workspace" | "folders" | "search" | "profile" | "menu";

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

export const MobileBottomBar = React.forwardRef<HTMLElement, MobileBottomBarProps>(
  ({ className, items, activeId, onTabClick, ...props }, ref) => {
    return (
      <nav
        ref={ref}
        className={cn(
          "md:hidden fixed left-0 right-0 z-[9998] flex items-center justify-center gap-0",
          "pb-[max(0.375rem,env(safe-area-inset-bottom))] pt-1.5",
          "touch-manipulation",
          className
        )}
        style={{ bottom: 0, paddingLeft: "max(12px, env(safe-area-inset-left))", paddingRight: "max(12px, env(safe-area-inset-right))" }}
        {...props}
      >
        {/* Отдельные мелкие кнопки без подложки и без подписей */}
        <ul className="flex items-center justify-center gap-2">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeId;

            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onTabClick(item.id)}
                  className={cn(
                    "flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-200 touch-manipulation",
                    "active:scale-90",
                    isActive
                      ? "bg-[#f97316] text-white"
                      : "text-slate-600 active:bg-slate-100"
                  )}
                  aria-label={item.label}
                  aria-current={isActive ? "true" : undefined}
                  title={item.label}
                >
                  <Icon
                    className="w-5 h-5 flex-shrink-0"
                    strokeWidth={isActive ? 2.5 : 2}
                  />
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
