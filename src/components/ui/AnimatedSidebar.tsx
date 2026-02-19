"use client";

import { cn } from "../../utils/cn";
import React, { useState, createContext, useContext, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { GlassFolderIcon } from "./GlassFolderIcons";

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

type SidebarBodyProps = { className?: string; children?: React.ReactNode; variant?: 'default' | 'minimal' };

export const SidebarBody = (props: SidebarBodyProps) => {
  const { variant = 'default', ...rest } = props;
  return (
    <>
      <DesktopSidebar {...rest} variant={variant} />
      <MobileSidebar {...(rest as React.ComponentProps<"div">)} />
    </>
  );
};

type DesktopSidebarProps = SidebarBodyProps;

export const DesktopSidebar = ({
  className,
  children,
  variant = 'default',
}: DesktopSidebarProps) => {
  return (
    <motion.div
      className={cn(
        "h-full px-4 py-4 hidden md:flex md:flex-col flex-shrink-0",
        variant === 'minimal'
          ? "bg-slate-50/95 border-r border-slate-200/60"
          : "bg-glass-white/80 backdrop-blur-glass-xl backdrop-saturate-[180%] border-r border-white/[0.35] shadow-glass",
        className
      )}
      animate={{
        width: "260px",
      }}
      transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
    >
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
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden fixed inset-0 z-[9999] bg-black/20 backdrop-blur-[2px] touch-none safe-top safe-bottom safe-left safe-right"
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
            transition={{ type: "spring", stiffness: 380, damping: 34, mass: 0.9 }}
            className={cn(
              "md:hidden fixed inset-y-0 left-0 z-[9999] w-[min(320px,92vw)] flex flex-col",
              "bg-white/95 backdrop-blur-2xl backdrop-saturate-[180%]",
              "rounded-r-[20px] border-r border-slate-200/60",
              "shadow-[8px_0_32px_rgba(0,0,0,0.1)]",
              "safe-top safe-bottom safe-left safe-right overflow-hidden"
            )}
            style={{ willChange: "transform", WebkitOverflowScrolling: "touch" }}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0 safe-top border-b border-slate-100">
              <span className="text-[15px] font-semibold text-slate-700 font-heading tracking-[-0.01em]">Меню</span>
              <button
                onClick={() => setOpen(false)}
                className="p-2.5 -m-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-slate-100 text-slate-600 active:bg-slate-200 transition-colors touch-manipulation"
                aria-label="Закрыть"
              >
                <X className="w-5 h-5" strokeWidth={2.5} />
              </button>
            </div>
            <div className={cn(
              "flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain p-4 pt-3 space-y-1",
              "[&_button]:min-h-[44px] [&_button]:touch-manipulation",
              "[&_[role='button']]:min-h-[44px]"
            )} style={{ WebkitOverflowScrolling: 'touch' }}>
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
  /** Кастомный элемент справа (например, баланс коинов) */
  rightElement?: ReactNode;
  variant?: 'default' | 'danger';
  className?: string;
}

export const SidebarLink = ({
  icon,
  label,
  onClick,
  isActive,
  badge,
  rightElement,
  variant = 'default',
  className,
}: SidebarLinkProps) => {
  const { open, animate } = useSidebar();
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 py-1.5 min-h-[44px] rounded-xl transition-all w-full text-left group/sidebar touch-manipulation",
        "font-medium",
        open ? "px-2.5" : "px-2 justify-center",
        isActive 
          ? "bg-slate-200/40 backdrop-blur-glass text-slate-800 shadow-glass-sm" 
          : variant === 'danger'
            ? "text-accent-negative hover:bg-glass-white/60 hover:backdrop-blur-glass"
            : "text-slate-700 hover:bg-glass-white/60 hover:backdrop-blur-glass",
        className
      )}
    >
      <div className={cn(
        "flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-xl transition-all",
        isActive && "bg-slate-200/30",
        !open && isActive && "bg-slate-200/40"
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
          "text-sm font-medium whitespace-nowrap overflow-hidden font-heading tracking-[-0.01em]",
          "group-hover/sidebar:translate-x-0.5 transition-transform duration-150"
        )}
      >
        {label}
      </motion.span>
      {rightElement != null && (
        <motion.span
          animate={{
            display: animate ? (open ? "flex" : "none") : "flex",
            opacity: animate ? (open ? 1 : 0) : 1,
          }}
          className="ml-auto flex-shrink-0"
        >
          {rightElement}
        </motion.span>
      )}
      {rightElement == null && badge !== undefined && badge > 0 && (
        <motion.span
          animate={{
            display: animate ? (open ? "flex" : "none") : "flex",
            opacity: animate ? (open ? 1 : 0) : 1,
          }}
          className="ml-auto px-2.5 py-1 rounded-pill bg-accent-negative/15 text-accent-negative text-xs font-semibold shadow-glass-sm"
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
    <div className="mb-4">
      <motion.div
        animate={{
          opacity: animate ? (open ? 1 : 0) : 1,
          height: animate ? (open ? "auto" : 0) : "auto",
        }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
        className="flex items-center justify-between px-3 mb-1.5 overflow-hidden"
      >
        <span className="text-xs font-semibold text-slate-500 font-heading tracking-[-0.01em]">
          {title}
        </span>
        {onAdd && (
          <button
            onClick={onAdd}
            className="p-2 min-w-[44px] min-h-[44px] rounded-pill hover:bg-glass-white/60 backdrop-blur-glass text-slate-400 hover:text-slate-700 transition-all flex items-center justify-center touch-manipulation"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </motion.div>
      <div className={cn(
        "space-y-0.5",
        !open && "flex flex-col items-center gap-1"
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
  /** iOS 26 glass иконка вместо Lucide */
  useGlassIcon?: boolean;
}

export const SidebarProject = ({ 
  name, 
  color, 
  isActive, 
  onClick, 
  onEdit,
  icon,
  badge,
  useGlassIcon = true,
}: SidebarProjectProps) => {
  const { open, animate } = useSidebar();
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 py-2 rounded-xl transition-all cursor-pointer relative",
        open ? "px-4 pl-3" : "px-3 justify-center",
        isActive 
          ? "bg-glass-white/80 backdrop-blur-glass shadow-glass-sm" 
          : "hover:bg-glass-white/50 hover:backdrop-blur-glass"
      )}
    >
      {open && (
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full flex-shrink-0"
          style={{ backgroundColor: color || '#64748b' }}
          aria-hidden
        />
      )}
      <div className="flex items-center justify-center flex-shrink-0">
        {useGlassIcon ? (
          <GlassFolderIcon iconType="folder" color={color || '#64748b'} size={open ? 22 : 24} simple />
        ) : icon ? (
          React.cloneElement(icon as React.ReactElement, { 
            className: open ? "w-5 h-5" : "w-6 h-6",
            strokeWidth: 2.5
          })
        ) : (
          <div 
            className={cn("rounded transition-all", open ? "w-5 h-5" : "w-6 h-6")} 
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
          "flex-1 text-sm font-medium truncate font-heading tracking-[-0.01em]",
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
          className="px-2 py-0.5 rounded-full bg-slate-200/40 text-slate-700 text-xs font-semibold font-heading tracking-[-0.01em]"
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
        <div className="w-2 h-2 rounded-full bg-slate-500 flex-shrink-0 shadow-sm" />
      )}
    </div>
  );
};

export const SidebarLogo = () => {
  const { open, animate } = useSidebar();
  
  return (
    <div className={cn(
      "flex items-center gap-3 py-2 mb-6 transition-all",
      open ? "px-3" : "px-2 justify-center"
    )}>
      <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-glass-sm flex-shrink-0 bg-slate-100">
        <img src="/riri-logo.png" alt="Riri AI" className="w-full h-full object-contain p-0.5" />
      </div>
      <motion.div
        animate={{
          display: animate ? (open ? "block" : "none") : "block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="overflow-hidden leading-none"
      >
        <h1 className="text-base font-semibold text-slate-800 whitespace-nowrap font-heading tracking-[-0.01em]">Riri AI</h1>
        <p className="text-[10px] text-slate-500 whitespace-nowrap font-medium mt-px font-heading tracking-[-0.01em]">Твой ассистент</p>
      </motion.div>
    </div>
  );
};

export const SidebarDivider = () => {
  const { open } = useSidebar();
  return (
    <div className={cn(
      "h-px bg-gradient-to-r from-transparent via-slate-200/80 to-transparent my-4 transition-all",
      open ? "mx-4" : "mx-3"
    )} />
  );
};
