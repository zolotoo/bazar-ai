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
          "px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]",
          "bg-white/70 backdrop-blur-2xl",
          "rounded-t-[20px] border-t border-x border-white/50",
          "shadow-[0_-8px_32px_rgba(0,0,0,0.08),0_-1px_0_rgba(255,255,255,0.5)_inset]",
          "touch-manipulation",
          className
        )}
        style={{ paddingLeft: "max(8px, env(safe-area-inset-left))", paddingRight: "max(8px, env(safe-area-inset-right))" }}
        {...props}
      >
        <ul className="flex items-center justify-around gap-0.5 max-w-sm mx-auto">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeId;

            return (
              <li key={item.id} className="flex-1 min-w-0 flex justify-center">
                <button
                  type="button"
                  onClick={() => onTabClick(item.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 min-h-[44px] w-full max-w-[56px]",
                    "rounded-2xl transition-all duration-200 active:scale-95",
                    isActive
                      ? "bg-[#f97316]/10 text-[#f97316]"
                      : "text-slate-500 active:bg-black/5"
                  )}
                  aria-label={item.label}
                  aria-current={isActive ? "true" : undefined}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center w-7 h-7 rounded-full transition-colors flex-shrink-0",
                      isActive ? "bg-[#f97316]/15" : ""
                    )}
                  >
                    <Icon
                      className={cn("w-[22px] h-[22px] flex-shrink-0", isActive ? "text-[#f97316]" : "text-slate-600")}
                      strokeWidth={2.25}
                    />
                  </span>
                  <span
                    className={cn(
                      "text-[9px] font-medium truncate w-full text-center leading-tight",
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
