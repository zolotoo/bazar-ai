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
          "md:hidden fixed left-0 right-0 z-[9998] flex justify-center",
          "pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 px-4",
          "touch-manipulation",
          className
        )}
        style={{ bottom: 0, paddingLeft: "max(16px, env(safe-area-inset-left))", paddingRight: "max(16px, env(safe-area-inset-right))" }}
        {...props}
      >
        {/* Плавающая капсула как на референсах iOS 26 */}
        <ul
          className={cn(
            "flex items-center justify-around gap-1 rounded-full w-full max-w-[320px] mx-auto",
            "bg-white/75 backdrop-blur-2xl",
            "border border-white/60",
            "shadow-[0_4px_24px_rgba(0,0,0,0.08),0_1px_0_rgba(255,255,255,0.6)_inset]",
            "py-2 px-3"
          )}
        >
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === activeId;

            return (
              <li key={item.id} className="flex-1 min-w-0 flex justify-center">
                <button
                  type="button"
                  onClick={() => onTabClick(item.id)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-0.5 py-1 px-1 min-h-[40px] w-full max-w-[48px]",
                    "rounded-full transition-all duration-200 active:scale-95",
                    isActive ? "text-[#f97316]" : "text-slate-500"
                  )}
                  aria-label={item.label}
                  aria-current={isActive ? "true" : undefined}
                >
                  <span
                    className={cn(
                      "flex items-center justify-center w-8 h-8 rounded-full transition-all flex-shrink-0",
                      isActive
                        ? "bg-[#f97316] text-white"
                        : "bg-transparent"
                    )}
                  >
                    <Icon
                      className={cn(
                        "w-4 h-4 flex-shrink-0",
                        isActive ? "text-white" : "text-slate-600"
                      )}
                      strokeWidth={isActive ? 2.5 : 2}
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
