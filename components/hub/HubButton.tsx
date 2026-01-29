'use client';

import React from 'react';
import { useHub } from './HubProvider';
import { Menu } from 'lucide-react';

export function HubButton() {
  const { toggleHub } = useHub();

  return (
    <button
      type="button"
      onClick={toggleHub}
      className="fixed left-4 top-4 z-9999 rounded-lg p-2
                 border border-border/60 bg-(--card)/40 backdrop-blur
                 shadow-lg hover:bg-(--card)/55 transition-all duration-200
                 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Open Hub"
    >
      <Menu className="size-5" />
    </button>
  );
}
