"use client";

import * as React from "react";
import { cn } from "../../utils/cn";
import type { LucideIcon } from "lucide-react";

export type MobileTabId = "workspace" | "folders" | "search" | "profile" | "menu";

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
          "md:hidden fixed bottom-0 left-0 right-0 z-[9998]",
          "px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]",
          "bg-white/80 backdrop-blur-xl border-t border-white/60",
          "shadow-[0_-4px_24px_rgba(0,0,0,0.06)]",
          "touch-manipulation",
          className
        )}
        {...props}
      >
        <ul className="flex items-center justify-around gap-1 max-w-lg mx-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeId;

            return (
              <li key={item.id} className="flex-1 min-w-0 flex justify-center">
                <button
                  type="button"
                  onClick={() => onTabClick(item.id)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 py-2 px-1.5 min-h-[52px] rounded-xl w-full max-w-[72px]",
                    "transition-colors duration-200 active:scale-95",
                    isActive
                      ? "text-[#f97316]"
                      : "text-slate-500"
                  )}
                  aria-label={item.label}
                  aria-current={isActive ? "true" : undefined}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-xl transition-colors",
                      isActive ? "bg-[#f97316]/12" : ""
                    )}
                  >
                    <Icon
                      className={cn("w-5 h-5 flex-shrink-0", isActive ? "text-[#f97316]" : item.iconColor)}
                      strokeWidth={2.5}
                    />
                  </span>
                  <span
                    className={cn(
                      "text-[10px] font-medium truncate w-full text-center",
                      isActive ? "text-[#f97316]" : "text-slate-500"
                    )}
                  >
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
