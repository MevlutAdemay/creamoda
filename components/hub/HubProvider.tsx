// components/hub/HubProvider.tsx

'use client';

import React, { createContext, useContext, useMemo, useState, useCallback } from 'react';

type HubContextValue = {
  open: boolean;
  openHub: () => void;
  closeHub: () => void;
  toggleHub: () => void;
};

const HubContext = createContext<HubContextValue | null>(null);

export function HubProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  const openHub = useCallback(() => setOpen(true), []);
  const closeHub = useCallback(() => setOpen(false), []);
  const toggleHub = useCallback(() => setOpen((v) => !v), []);

  const value = useMemo(
    () => ({ open, openHub, closeHub, toggleHub }),
    [open, openHub, closeHub, toggleHub]
  );

  return <HubContext.Provider value={value}>{children}</HubContext.Provider>;
}

export function useHub() {
  const ctx = useContext(HubContext);
  if (!ctx) throw new Error('useHub must be used within HubProvider');
  return ctx;
}
