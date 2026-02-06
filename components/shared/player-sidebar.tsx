// creamoda/components/shared/player-sidebar.tsx
'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { useInboxUnread } from '@/stores/useInboxUnread';

export type SidebarItem = {
  key: string;
  title: string;
  subtitle?: string;
  href: string;
  imageSrc: string;
  imageFit?: 'contain' | 'cover';
};

/** Maps sidebar item key to nav translation key */
const SIDEBAR_KEY_TO_NAV: Record<string, string> = {
  messages: 'inbox',
  player: 'dashboard',
  designoffices: 'designOffices',
  procurement: 'procurement',
  marketing: 'marketing',
  warehouse: 'warehouse',
  sales: 'sales',
  performance: 'performance',
  finance: 'finance',
  events: 'events',
};

const DEFAULT_ITEMS: SidebarItem[] = [
  { key: 'messages', title: 'Inbox', href: '/player/messages', imageSrc: '/menu_ico/messages.webp', imageFit: 'contain' },
  { key: 'player', title: 'HeadQuarters', href: '/player', imageSrc: '/menu_ico/management.webp', imageFit: 'contain' },
  { key: 'designoffices', title: 'Product Pool', href: '/player/designoffices', imageSrc: '/menu_ico/design.webp', imageFit: 'contain' },
  { key: 'procurement', title: 'Merchandising', href: '/player/procurement', imageSrc: '/menu_ico/procurement.webp', imageFit: 'contain' },
  { key: 'marketing', title: 'Marketing Campaigns', href: '/player/marketing', imageSrc: '/menu_ico/marketing.webp', imageFit: 'contain' },
  { key: 'warehouse', title: 'Warehouse & Logistics', href: '/player/warehouse', imageSrc: '/menu_ico/warehouse.webp', imageFit: 'contain' },
  { key: 'sales', title: 'MODAVERSE Platform', href: '/player/sales', imageSrc: '/menu_ico/Sales.webp', imageFit: 'contain' },
  { key: 'performance', title: 'Product Performance', href: '/player/performance', imageSrc: '/menu_ico/performance.webp', imageFit: 'contain' },
  { key: 'finance', title: 'Finance Reports', href: '/player/finance', imageSrc: '/menu_ico/finance.webp', imageFit: 'contain' },
  { key: 'events', title: 'Events Calendar', href: '/player/events', imageSrc: '/menu_ico/events.webp', imageFit: 'contain' },
];

type PlayerSidebarProps = {
  items?: SidebarItem[];
  isOpen?: boolean;
  onClose?: () => void;
  className?: string;
  /** Initial unread count from server; seeds store on mount. Badge reads from store. */
  initialUnreadCount?: number;
  /** @deprecated Use initialUnreadCount */
  unreadCount?: number;
};

function badgeLabel(count: number): string {
  if (count >= 100) return '99+';
  return String(count);
}

export default function PlayerSidebar({
  items = DEFAULT_ITEMS,
  isOpen = false,
  onClose,
  className = '',
  initialUnreadCount,
  unreadCount = 0,
}: PlayerSidebarProps) {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const { unread, setUnread } = useInboxUnread();
  const initial = initialUnreadCount ?? unreadCount;

  useEffect(() => {
    if (typeof initial === 'number') setUnread(initial);
  }, [initial, setUnread]);

  const navKey = (key: string) => SIDEBAR_KEY_TO_NAV[key] ?? key;
  const itemsWithTitle = items.map((item) => ({
    ...item,
    title: t(navKey(item.key)),
  }));

  return (
    <>
      {/* Desktop/Tablet Sidebar - Navbar altında, ekranın altına kadar */}
      <aside
        aria-label={t('menuLabel')}
        className={[
          'hidden md:flex flex-col',
          'fixed left-0 top-16 bottom-0 z-40',
          'w-20 lg:w-64',
          'bg-transparent',
          'overflow-hidden',
          className,
        ].join(' ')}
      >
        <div className="flex-1 py-4 px-2 flex flex-col">
          {/* Başlık - Sadece lg+ görünür */}
          <div className="mb-4 px-2 hidden lg:block">
            <div className="text-xs font-semibold tracking-wide opacity-80">{t('menuLabel')}</div>
            <div className="text-[10px] opacity-55">{t('menuSubtitle')}</div>
          </div>

          {/* Menü öğeleri */}
          <div className="flex flex-col gap-1.5">
            {itemsWithTitle.map((item) => {
              // /player için sadece tam eşleşme, diğerleri için alt sayfalar da aktif
              const active =
                item.href === '/player'
                  ? pathname === item.href
                  : pathname === item.href ||
                    (pathname?.startsWith(item.href + '/') ?? false);
              const badgeCount = item.key === 'messages' ? unread : 0;

              return (
                <SidebarMenuCard
                  key={item.key}
                  item={item}
                  active={active}
                  badgeCount={badgeCount}
                />
              );
            })}
          </div>
        </div>
      </aside>

      {/* Mobile Overlay - Sadece mobilde (<768px) */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Mobile Sidebar - Sadece mobilde (<768px) */}
      <aside
        aria-label="Mobil Menü Paneli"
        className={[
          'md:hidden fixed left-0 top-0 h-screen z-50',
          'w-72 bg-background border-r border-border',
          'transform transition-transform duration-300 ease-in-out',
          isOpen ? 'translate-x-0' : '-translate-x-full',
        ].join(' ')}
      >
        {/* Kapat butonu */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="text-xs font-semibold tracking-wide opacity-80">{t('menuLabel')}</div>
            <div className="text-[10px] opacity-55">{t('menuSubtitle')}</div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            aria-label={t('closeMenu')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menü öğeleri */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex flex-col gap-1.5">
            {itemsWithTitle.map((item) => {
              // /player için sadece tam eşleşme, diğerleri için alt sayfalar da aktif
              const active =
                item.href === '/player'
                  ? pathname === item.href
                  : pathname === item.href ||
                    (pathname?.startsWith(item.href + '/') ?? false);
              const badgeCount = item.key === 'messages' ? unread : 0;

              return (
                <SidebarMenuCard
                  key={item.key}
                  item={item}
                  active={active}
                  isMobile={true}
                  onClick={onClose}
                  badgeCount={badgeCount}
                />
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}

function SidebarMenuCard({
  item,
  active,
  isMobile = false,
  onClick,
  badgeCount = 0,
}: {
  item: SidebarItem;
  active: boolean;
  isMobile?: boolean;
  onClick?: () => void;
  badgeCount?: number;
}) {
  const fit = item.imageFit ?? 'contain';
  const [hovered, setHovered] = React.useState(false);
  const [pos, setPos] = React.useState({ mx: '50%', my: '50%' });

  const showEffects = hovered || active;

  const onMove: React.MouseEventHandler<HTMLAnchorElement> = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;
    setPos({ mx: `${x}px`, my: `${y}px` });
  };

  return (
    <Link
      href={item.href}
      aria-label={item.title}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={onMove}
      className={[
        'group relative rounded-xl overflow-hidden',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
      ].join(' ')}
      style={{
        isolation: 'isolate',
        background: active
          ? 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))'
          : 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: showEffects
          ? '0 18px 46px rgba(0,0,0,0.18)'
          : '0 8px 18px rgba(0,0,0,0.10)',
        transition: 'transform 180ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease',
      }}
    >
      {/* 1) Neon gradient rim */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: showEffects ? 1 : 0,
          transition: 'opacity 200ms ease',
          background:
            'conic-gradient(from 180deg at 50% 50%, rgba(0,255,240,0.35), rgba(120,90,255,0.35), rgba(255,70,170,0.35), rgba(0,255,240,0.35))',
          padding: 1,
          WebkitMask:
            'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          borderRadius: 12,
        }}
      />

      {/* 2) Dış bloom */}
      <span
        className="pointer-events-none absolute -inset-8 blur-3xl"
        style={{
          opacity: showEffects ? 1 : 0,
          transition: 'opacity 220ms ease',
          background:
            'radial-gradient(260px 140px at 30% 20%, rgba(0,255,240,0.14), transparent 60%),' +
            'radial-gradient(260px 160px at 80% 30%, rgba(120,90,255,0.12), transparent 62%),' +
            'radial-gradient(280px 180px at 60% 110%, rgba(255,70,170,0.10), transparent 70%)',
        }}
      />

      {/* 3) İç glow */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: showEffects ? 1 : 0,
          transition: 'opacity 180ms ease',
          background:
            'linear-gradient(135deg, rgba(0,255,240,0.10), rgba(120,90,255,0.08) 45%, rgba(255,70,170,0.08))',
          mixBlendMode: 'screen',
        }}
      />

      {/* 4) Specular highlight */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: showEffects ? 1 : 0,
          transition: 'opacity 180ms ease',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.06) 35%, transparent 60%)',
          mixBlendMode: 'soft-light',
        }}
      />

      {/* 5) Mouse spotlight */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: hovered ? 1 : 0,
          transition: 'opacity 180ms ease',
          background: `radial-gradient(220px 160px at ${pos.mx} ${pos.my}, rgba(255,255,255,0.22), transparent 60%)`,
          mixBlendMode: 'overlay',
        }}
      />

      {/* İçerik */}
      <div className="relative p-2 flex items-center gap-3">
        {/* Icon area: on md collapsed, badge dot goes top-right here */}
        <div className="relative w-12 h-10 shrink-0">
          <Image
            src={item.imageSrc}
            alt={item.title}
            fill
            sizes="48px"
            className={fit === 'cover' ? 'object-cover' : 'object-contain'}
            priority={false}
          />
          {/* Collapsed (md): dot in top-right of icon */}
          {!isMobile && badgeCount > 0 && (
            <span
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-destructive border-2 border-background hidden lg:hidden md:block"
              aria-hidden
            />
          )}
        </div>

        {isMobile ? (
          <div className="flex-1 leading-tight flex items-center justify-between gap-2 min-w-0">
            <div>
              <div className="text-[12px] font-semibold tracking-wide opacity-90">
                {item.title}
              </div>
              {item.subtitle && (
                <div className="text-[10px] opacity-55 mt-0.5">
                  {item.subtitle}
                </div>
              )}
            </div>
            {/* Mobile: count badge aligned right */}
            {badgeCount > 0 && (
              <span className="shrink-0 min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-medium flex items-center justify-center">
                {badgeCount >= 100 ? '99+' : badgeCount}
              </span>
            )}
          </div>
        ) : (
          <div className="flex-1 leading-tight hidden lg:flex items-center justify-between gap-2 min-w-0">
            <div className="whitespace-nowrap">
              <div className="text-[12px] font-semibold tracking-wide opacity-90">
                {item.title}
              </div>
              {item.subtitle && (
                <div className="text-[10px] opacity-55 mt-0.5">
                  {item.subtitle}
                </div>
              )}
            </div>
            {/* lg expanded: badge near title (dot if >= 100, else number) */}
            {badgeCount > 0 && (
              <span
                className="shrink-0 flex items-center justify-center"
                aria-hidden
              >
                {badgeCount >= 100 ? (
                  <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
                ) : (
                  <span className="min-w-5 h-5 px-1.5 rounded-full bg-destructive text-destructive-foreground text-[11px] font-medium flex items-center justify-center">
                    {badgeLabel(badgeCount)}
                  </span>
                )}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}
