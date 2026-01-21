"use client";

import { cn } from "../../utils/cn";
import React, { useState, createContext, useContext, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

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

export const SidebarBody = (props: React.ComponentProps<typeof motion.div>) => {
  return (
    <>
      <DesktopSidebar {...props} />
      <MobileSidebar {...(props as React.ComponentProps<"div">)} />
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        "h-full px-4 py-4 hidden md:flex md:flex-col bg-white/80 backdrop-blur-xl border-r border-slate-200/50 flex-shrink-0",
        className
      )}
      animate={{
        width: animate ? (open ? "280px" : "72px") : "280px",
      }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <div
        className={cn(
          "h-14 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-white/80 backdrop-blur-xl border-b border-slate-200/50 w-full"
        )}
        {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <Menu
            className="text-slate-600 cursor-pointer"
            onClick={() => setOpen(!open)}
          />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 bg-white p-6 z-[100] flex flex-col justify-between",
                className
              )}
            >
              <div
                className="absolute right-6 top-6 z-50 text-slate-600 cursor-pointer"
                onClick={() => setOpen(!open)}
              >
                <X />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
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
        "flex items-center gap-3 py-2.5 rounded-xl transition-all w-full text-left group/sidebar",
        open ? "px-3" : "px-0 justify-center",
        isActive 
          ? "bg-gradient-to-r from-orange-500/10 to-amber-500/10 text-orange-600" 
          : variant === 'danger'
            ? "text-red-500 hover:bg-red-50"
            : "text-slate-600 hover:bg-slate-50",
        className
      )}
    >
      <div className={cn(
        "flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-xl transition-all",
        !open && isActive && "bg-orange-100"
      )}>
        {icon}
      </div>
      <motion.span
        animate={{
          display: animate ? (open ? "inline-block" : "none") : "inline-block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        transition={{ duration: 0.2 }}
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
          className="ml-auto px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 text-xs font-semibold"
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
        transition={{ duration: 0.2 }}
        className="flex items-center justify-between px-3 mb-2 overflow-hidden"
      >
        <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          {title}
        </span>
        {onAdd && (
          <button
            onClick={onAdd}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-orange-500 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        )}
      </motion.div>
      <div className={cn(
        "space-y-1",
        !open && "flex flex-col items-center"
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
}

export const SidebarProject = ({ 
  name, 
  color, 
  isActive, 
  onClick, 
  onEdit,
  icon 
}: SidebarProjectProps) => {
  const { open, animate } = useSidebar();
  
  return (
    <div
      onClick={onClick}
      className={cn(
        "group flex items-center gap-3 py-2 rounded-xl transition-all cursor-pointer",
        open ? "px-3" : "px-0 justify-center",
        isActive 
          ? "bg-white shadow-sm border border-slate-100" 
          : "hover:bg-slate-50"
      )}
    >
      <div 
        className={cn(
          "rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
          open ? "w-6 h-6" : "w-10 h-10"
        )}
        style={{ backgroundColor: color + '20' }}
      >
        {icon || (
          <div 
            className={cn("rounded transition-all", open ? "w-3 h-3" : "w-4 h-4")} 
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
          isActive ? "text-slate-800" : "text-slate-600"
        )}
      >
        {name}
      </motion.span>
      {open && onEdit && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="p-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-all"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}
      {isActive && open && (
        <div className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
      )}
    </div>
  );
};

export const SidebarLogo = () => {
  const { open, animate } = useSidebar();
  
  return (
    <div className={cn(
      "flex items-center gap-3 py-2 mb-6 transition-all",
      open ? "px-3" : "px-0 justify-center"
    )}>
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-500/30 flex-shrink-0">
        <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      </div>
      <motion.div
        animate={{
          display: animate ? (open ? "block" : "none") : "block",
          opacity: animate ? (open ? 1 : 0) : 1,
        }}
        className="overflow-hidden"
      >
        <h1 className="text-lg font-bold text-slate-800 whitespace-nowrap">Bazar AI</h1>
        <p className="text-xs text-slate-400 whitespace-nowrap">Content Manager</p>
      </motion.div>
    </div>
  );
};

export const SidebarDivider = () => {
  const { open } = useSidebar();
  return (
    <div className={cn(
      "h-px bg-slate-200/50 my-4 transition-all",
      open ? "mx-3" : "mx-2"
    )} />
  );
};
