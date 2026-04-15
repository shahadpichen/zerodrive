import React, { createContext, useContext, useState, useEffect, useRef } from 'react';

interface SidebarContextType {
  isOpen: boolean;
  isMobile: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

const SIDEBAR_STORAGE_KEY = 'zerodrive-sidebar-state';

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 768;
    }
    return false;
  });

  const [isOpen, setIsOpen] = useState(() => {
    // Only load from localStorage on desktop
    if (typeof window !== 'undefined' && window.innerWidth >= 768) {
      const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      return stored ? JSON.parse(stored) : true;
    }
    return false; // Mobile always starts closed
  });

  const previousMobileRef = useRef(isMobile);

  // Detect mobile/desktop on mount and resize
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      const wasMobile = previousMobileRef.current;

      if (mobile !== wasMobile) {
        setIsMobile(mobile);
        previousMobileRef.current = mobile;

        // Only update isOpen if we're switching between mobile/desktop
        if (mobile) {
          // Switching to mobile - close sidebar
          setIsOpen(false);
        } else {
          // Switching to desktop - restore from localStorage
          const stored = localStorage.getItem(SIDEBAR_STORAGE_KEY);
          setIsOpen(stored ? JSON.parse(stored) : true);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Run only once on mount

  // Persist state to localStorage (desktop only)
  useEffect(() => {
    if (!isMobile) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(isOpen));
    }
  }, [isOpen, isMobile]);

  const toggle = () => setIsOpen((prev: boolean) => !prev);
  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return (
    <SidebarContext.Provider value={{ isOpen, isMobile, toggle, open, close }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (context === undefined) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
}
