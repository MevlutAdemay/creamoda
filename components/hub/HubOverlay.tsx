'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter, usePathname } from 'next/navigation';
import { useHub } from './HubProvider';
import Image from 'next/image';
import { X } from 'lucide-react';

type DockItem = {
  key: string;
  title: string;
  subtitle?: string;
  href: string;
  imageSrc: string;
  imageFit?: 'contain' | 'cover';
};

const HUB_ITEMS: DockItem[] = [
  { key: 'messages', title: 'Inbox', href: '/player/messages', imageSrc: '/menu_ico/messages.webp', imageFit: 'contain' },
  { key: 'player', title: 'HeadQuarters', href: '/player', imageSrc: '/menu_ico/management.webp', imageFit: 'contain' },
  { key: 'wholesale', title: 'Wholesale Marketplace', href: '/player/wholesale', imageSrc: '/menu_ico/wholesale.webp', imageFit: 'contain' },
  { key: 'designoffices', title: 'Product Pool', href: '/player/designoffices', imageSrc: '/menu_ico/design.webp', imageFit: 'contain' },
  { key: 'procurement', title: 'Merchandising', href: '/player/procurement', imageSrc: '/menu_ico/procurement.webp', imageFit: 'contain' },
  { key: 'marketing', title: 'Marketing Campaigns', href: '/player/marketing', imageSrc: '/menu_ico/marketing.webp', imageFit: 'contain' },
  { key: 'warehouse', title: 'Warehouse & Logistics', href: '/player/warehouse', imageSrc: '/menu_ico/warehouse.webp', imageFit: 'contain' },
  { key: 'sales', title: 'MODAVERSE Platform', href: '/player/sales', imageSrc: '/menu_ico/Sales.webp', imageFit: 'contain' },
  { key: 'finance', title: 'Finance Reports', href: '/player/finance', imageSrc: '/menu_ico/finance.webp', imageFit: 'contain' },
  { key: 'events', title: 'Events Calendar', href: '/player/events', imageSrc: '/menu_ico/events.webp', imageFit: 'contain' },
];

export function HubOverlay() {
  const { open, closeHub, openHub } = useHub();
  const router = useRouter();
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  // Global keyboard shortcuts: Ctrl+K to open, Esc to close
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to open
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (!open) {
          openHub();
        }
      }
      // Esc to close (only when open)
      if (e.key === 'Escape' && open) {
        closeHub();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, openHub, closeHub]);

  // Scroll lock when open
  useEffect(() => {
    if (!mounted) return;

    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [open, mounted]);

  if (!mounted) return null;
  if (!open) return null;

  const go = (href: string) => {
    closeHub();
    if (href !== pathname) {
      router.push(href);
    }
  };

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-9998 bg-black/60 backdrop-blur-md text-gray-200"
      onMouseDown={(e) => {
        if (e.target === overlayRef.current) closeHub();
      }}
      aria-modal="true"
      role="dialog"
    >
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div
          ref={panelRef}
          className="w-full max-w-4xl rounded-3xl border backdrop-blur-xl shadow-2xl"
          style={{
            background: 'linear-gradient(180deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
            borderColor: 'rgba(255,255,255,0.12)',
            boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
          }}
        >
          <div className="p-4 border-b border-border/50">
            <h2 className="text-sm text-gray-200 font-semibold">
              Quick Hub Navigation
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Press <code className="bg-black/20 px-1.5 py-0.5 rounded text-xs">Esc</code> to close, <code className="bg-black/20 px-1.5 py-0.5 rounded text-xs">Ctrl+K</code> to open
            </p>
          </div>

          <div className="p-4 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {HUB_ITEMS.map((it) => {
                const active = pathname === it.href || (pathname?.startsWith(it.href + '/') ?? false);
                const fit = it.imageFit ?? 'contain';
                return (
                  <button
                    key={it.key}
                    onClick={() => go(it.href)}
                    className={`group relative border overflow-hidden rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-ring transition-all duration-200 ${
                      active
                        ? 'border-primary/40 bg-primary/10'
                        : 'border-border/40 hover:border-border/60'
                    }`}
                  >
                    {/* hover shine */}
                    <div
                      className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                      style={{
                        background:
                          'radial-gradient(600px 200px at 50% 0%, rgba(255,255,255,0.16), transparent 55%)',
                      }}
                    />

                    {/* content */}
                    <div className="relative p-4">
                      {/* Image area */}
                      <div className="relative w-full h-[86px] mb-3">
                        <Image
                          src={it.imageSrc!}
                          alt={it.title}
                          fill
                          sizes="(min-width: 1024px) 180px, 50vw"
                          className={fit === 'cover' ? 'object-cover' : 'object-contain'}
                          priority={false}
                        />
                      </div>

                      {/* Text area */}
                      <div className="leading-tight">
                        <div className="text-[13px] font-semibold tracking-wide opacity-90">
                          {it.title}
                        </div>
                        {it.subtitle && (
                          <div className="text-[11px] opacity-55 mt-1">
                            {it.subtitle}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Close button */}
          <div className="p-2 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs text-foreground/40">Click item to navigate</span>
            <button
              onClick={closeHub}
              className="rounded-xl p-2 border border-border/60 bg-(--card)/40 hover:bg-(--card)/55 transition-all duration-200"
              aria-label="Close Hub"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
