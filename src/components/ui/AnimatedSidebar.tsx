"use client";

import { cn } from "../../utils/cn";
import React, { useState, createContext, useContext, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, PanelLeftClose, PanelRightOpen } from "lucide-react";

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

type SidebarBodyProps = { className?: string; children?: React.ReactNode };

export const SidebarBody = (props: SidebarBodyProps) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

type DesktopSidebarProps = SidebarBodyProps;

export const DesktopSidebar = ({
  className,
  children,
}: DesktopSidebarProps) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        "h-full px-5 py-6 hidden md:flex md:flex-col flex-shrink-0",
        "bg-white/75 backdrop-blur-[28px] backdrop-saturate-[180%]",
        "border-r border-white/60",
        "shadow-[0_0_0_1px_rgba(255,255,255,0.85)_inset,0_8px_32px_rgba(0,0,0,0.06)]",
        className
      )}
      animate={{
        width: animate ? (open ? "260px" : "88px") : "260px",
      }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Кнопка «Скрыть меню» / «Развернуть» — меню постоянно, сворачивается только по клику */}
      <div className={cn(
        "flex items-center shrink-0 mb-3 -mx-1",
        open ? "justify-end px-2" : "justify-center"
      )}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className={cn(
            "flex items-center gap-2 py-2 rounded-xl transition-colors touch-manipulation",
            "text-slate-500 hover:text-slate-700 hover:bg-white/50",
            !open && "w-full justify-center min-h-[44px]"
          )}
          title={open ? "Скрыть меню" : "Показать меню"}
          aria-label={open ? "Скрыть меню" : "Показать меню"}
        >
          {open ? (
            <>
              <PanelLeftClose className="w-5 h-5 flex-shrink-0" strokeWidth={2.5} />
              <span className="text-sm font-medium whitespace-nowrap">Скрыть меню</span>
            </>
          ) : (
            <PanelRightOpen className="w-5 h-5" strokeWidth={2.5} />
          )}
        </button>
      </div>
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  children,
}: { className?: string; children?: React.ReactNode }) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      {/* Верхняя полоска убрана: на мобильных меню открывается из нижнего таб-бара (Меню) */}
      {/* Оверлей меню — поверх всего, высокий z-index */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden fixed inset-0 z-[9999] bg-black/30 touch-none"
            style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
            onClick={() => setOpen(false)}
            aria-hidden
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "tween", duration: 0.2 }}
            className={cn(
              "md:hidden fixed inset-y-0 left-0 z-[9999] w-[min(320px,85vw)] flex flex-col",
              "bg-white shadow-2xl",
              "safe-top safe-bottom safe-left safe-right overflow-hidden"
            )}
            style={{ willChange: "transform" }}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 shrink-0">
              <span className="text-sm font-semibold text-slate-500 uppercase">Меню</span>
              <button
                onClick={() => setOpen(false)}
                className="p-3 -m-1 min-w-[48px] min-h-[48px] flex items-center justify-center touch-manipulation active:bg-slate-100 rounded-xl text-slate-600"
                aria-label="Закрыть"
              >
                <X className="w-6 h-6" strokeWidth={2.5} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 -mt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

interface SidebarLinkProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  isActive?: boolean;
  badge?: number;
  variant?: 'default' | 'danger';
  className?: string;
}

export const SidebarLink = ({
  icon,
  label,
  onClick,
  isActive,
  badge,
  variant = 'default',
  className,
}: SidebarLinkProps) => {
  const { open, animate } = useSidebar();
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 py-1.5 rounded-xl transition-all w-full text-left group/sidebar",
        "font-medium",
        open ? "px-3" : "px-2 justify-center",
        isActive 
          ? "bg-white/80 backdrop-blur-sm text-[#f97316] shadow-sm" 
          : variant === 'danger'
            ? "text-red-500 hover:bg-white/50 hover:backdrop-blur-sm"
            : "text-slate-700 hover:bg-white/50 hover:backdrop-blur-sm",
        className
      )}
    >
      <div className={cn(
        "flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg transition-all",
        isActive && "bg-[#f97316]/10",
        !open && isActive && "bg-[#f97316]/15"
      )}>
        {React.cloneElement(icon as React.ReactElement, { 
          className: "w-3.5 h-3.5",
          strokeWidth: 2.5
        })}
      </div>
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className={cn(
          "text-sm font-medium whitespace-nowrap overflow-hidden",
          "group-hover/sidebar:translate-x-0.5 transition-transform duration-150"
        )}
      >
        {label}
      </motion.span>
      {badge !== undefined && badge > 0 && (
        <motion.span
          animate={{
            display: animate ? (open ? "flex" : "none") : "flex",
            opacity: animate ? (open ? 1 : 0) : 1,
          }}
          className="ml-auto px-2.5 py-1 rounded-full bg-[#f97316]/10 text-[#f97316] text-xs font-semibold"
        >
          {badge}
        </motion.span>
      )}
    </button>
  );
};

interface SidebarSectionProps {
  title: string;
  children: ReactNode;
  onAdd?: () => void;
}

export const SidebarSection = ({ title, children, onAdd }: SidebarSectionProps) => {
  const { open, animate } = useSidebar();
  
  return (
    <div className="mb-6">
      <motion.div
        animate={{
          opacity: animate ? (open ? 1 : 0) : 1,
          height: animate ? (open ? "auto" : 0) : "auto",
        }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="flex items-center justify-between px-4 mb-3 overflow-hidden"
      >
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
          {title}
        </span>
        {onAdd && (
          <button
            onClick={onAdd}
            className="p-1.5 rounded-xl hover:bg-white/60 backdrop-blur-sm text-slate-400 hover:text-[#f97316] transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </motion.div>
      <div className={cn(
        "space-y-1.5",
        !open && "flex flex-col items-center gap-2"
      )}>
        {children}
      </div>
    </div>
  );
};

interface SidebarProjectProps {
  name: string;
  color: string;
  isActive?: boolean;
  onClick?: () => void;
  onEdit?: () => void;
  icon?: ReactNode;
  badge?: string; // Текст бейджа (например, "Новое")
}

export const SidebarProject = ({ 
  name, 
  color, 
  isActive, 
  onClick, 
  onEdit,
  icon,
  badge
}: SidebarProjectProps) => {
  const { open, animate } = useSidebar();
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 py-2 rounded-2xl transition-all cursor-pointer relative",
        open ? "px-4" : "px-3 justify-center",
        isActive 
          ? "bg-white/80 backdrop-blur-sm shadow-sm" 
          : "hover:bg-white/50 hover:backdrop-blur-sm"
      )}
    >
      <div 
        className={cn(
          "rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
          open ? "w-7 h-7" : "w-10 h-10"
        )}
        style={{ backgroundColor: color + '15' }}
      >
        {icon ? React.cloneElement(icon as React.ReactElement, { 
          className: open ? "w-4 h-4" : "w-5 h-5",
          strokeWidth: 2.5
        }) : (
          <div 
            className={cn("rounded-lg transition-all", open ? "w-4 h-4" : "w-5 h-5")} 
            style={{ backgroundColor: color }} 
          />
        )}
      </div>
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className={cn(
          "flex-1 text-sm font-medium truncate",
          isActive ? "text-slate-800" : "text-slate-700"
        )}
      >
        {name}
      </motion.span>
      {badge && open && (
        <motion.span
          animate={{
            opacity: animate ? (open ? 1 : 0) : 1,
          }}
          className="px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 text-xs font-semibold"
        >
          {badge}
        </motion.span>
      )}
      {open && onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1.5 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-white/60 backdrop-blur-sm text-slate-400 hover:text-slate-700 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}
      {isActive && open && (
        <div className="w-2 h-2 rounded-full bg-[#f97316] flex-shrink-0 shadow-sm" />
      )}
    </div>
  );
};

export const SidebarLogo = () => {
  const { open, animate } = useSidebar();
  
  return (
    <div className={cn(
      "flex items-center gap-4 py-3 mb-8 transition-all",
      open ? "px-4" : "px-3 justify-center"
    )}>
      <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#f97316] via-[#fb923c] to-[#fdba74] flex items-center justify-center shadow-lg shadow-[#f97316]/20 flex-shrink-0">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      <motion.div
        animate={{
          display: animate ? (open ? "block" : "none") : "block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="overflow-hidden"
      >
        <h1 className="text-xl font-semibold text-slate-800 whitespace-nowrap font-display">Bazar AI</h1>
        <p className="text-xs text-slate-500 whitespace-nowrap font-medium">Content Manager</p>
      </motion.div>
    </div>
  );
};

export const SidebarDivider = () => {
  const { open } = useSidebar();
  return (
    <div className={cn(
      "h-px bg-slate-200/60 my-6 transition-all",
      open ? "mx-4" : "mx-3"
    )} />
  );
};
