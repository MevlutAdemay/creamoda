// components/ui/DockMenu.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export type DockItem = {
  key: string;
  title: string;
  subtitle?: string;
  href: string;

  /** /public/menu_ico altındaki görselin path’i. Örn: "/menu_ico/inbox.webp" */
  imageSrc: string;

  /** Kart içinde görselin kırpma davranışı */
  imageFit?: 'contain' | 'cover';
};

const DEFAULT_ITEMS: DockItem[] = [
  { key: 'messages', title: 'Mesajlar', href: '/player/messages', imageSrc: '/menu_ico/messages.webp', imageFit: 'contain' },
  { key: 'player', title: 'Merkez Ofis', href: '/player',  imageSrc: '/menu_ico/management.webp', imageFit: 'contain' },
  { key: 'wholesale', title: 'WholeSales', href: '/player/wholesale', imageSrc: '/menu_ico/wholesale.webp', imageFit: 'contain' },
  { key: 'designoffices', title: 'Tasarım Ofisleri', href: '/player/designoffices', imageSrc: '/menu_ico/design.webp', imageFit: 'contain' },
  { key: 'procurement', title: 'Satın Alma', href: '/player/procurement', imageSrc: '/menu_ico/procurement.webp', imageFit: 'contain' },
  { key: 'marketing', title: 'Reklam Kampanya', href: '/player/marketing',imageSrc: '/menu_ico/marketing.webp', imageFit: 'contain' },
  { key: 'warehouse', title: 'Depo - Lojistik', href: '/player/warehouse', imageSrc: '/menu_ico/warehouse.webp', imageFit: 'contain' },
  { key: 'sales', title: 'Satış MODAVERSE', href: '/player/sales', imageSrc: '/menu_ico/Sales.webp', imageFit: 'contain' },
  { key: 'finance', title: 'Finans Raporlar', href: '/player/finance', imageSrc: '/menu_ico/finance.webp', imageFit: 'contain' },
  { key: 'events', title: 'Etkinlik Takvimi', href: '/player/events', imageSrc: '/menu_ico/events.webp', imageFit: 'contain' },
];


type DockMenuProps = {
  items?: DockItem[];

  /** Panel solda ne kadar yer kaplasın */
  panelWidthPx?: number; // öneri: 360-460

  /** Grid kolon sayısı */
  columns?: 1 | 2;

  /** Mobilde gizle */
  hideOnMobile?: boolean;

  className?: string;
};

export default function DockMenu({
  items = DEFAULT_ITEMS,
  panelWidthPx = 342,
  columns = 1,
  hideOnMobile = true,
  className = '',
}: DockMenuProps) {
  const pathname = usePathname();
  const w = Math.max(288, panelWidthPx);

  return (
    <aside
      aria-label="Ana Menü Paneli"
      className={[
        hideOnMobile ? 'hidden lg:block' : '',
        'relative z-[30] flex-shrink-0',
        'px-1.5 py-1.5',
        className,
      ].join(' ')}
      style={{ width: w }}
    >
      {/* Panel içi: istersen burayı tamamen transparan da bırakabilirsin.
          Ben hafif bir glass panel verdim. */}
      <div
        className="sticky top-5"
        style={{
          background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)',
          borderColor: 'rgba(255,255,255,0.10)',
          boxShadow: '0 9px 27px rgba(0,0,0,0.08)',
        }}
      >
        <div className="p-4 rounded-xl border backdrop-blur-md">
          {/* Başlık alanı (istersen kaldır) */}
          <div className="mb-1.5">
            <div className="text-xs font-semibold tracking-wide opacity-80">MENU</div>
            <div className="text-[10px] opacity-55">ModaVerse Operations</div>
          </div>

          <div className={columns === 2 ? 'grid grid-cols-2 gap-1.5' : 'grid grid-cols-1 gap-1.5'}>
            {items.map((it) => {
              const active =
                pathname === it.href ||
                (pathname?.startsWith(it.href + '/') ?? false);

              return (
                <MenuCard
                  key={it.key}
                  item={it}
                  active={active}
                />
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
}

function MenuCard({ item, active }: { item: DockItem; active: boolean }) {
  const fit = item.imageFit ?? 'contain';
  const [hovered, setHovered] = React.useState(false);
  const [pos, setPos] = React.useState({ mx: '50%', my: '50%' });

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
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onMouseMove={onMove}
      className={[
        'group relative rounded-xl overflow-hidden',
        'outline-none focus-visible:ring-2 focus-visible:ring-ring',
      ].join(' ')}
      style={{
        isolation: 'isolate',
        // kart gövdesi
        background: active
          ? 'linear-gradient(180deg, rgba(255,255,255,0.10), rgba(255,255,255,0.05))'
          : 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))',
        border: '1px solid rgba(255,255,255,0.12)',
        boxShadow: hovered
          ? '0 18px 46px rgba(0,0,0,0.18)'
          : active
          ? '0 10px 26px rgba(0,0,0,0.14)'
          : '0 8px 18px rgba(0,0,0,0.10)',
        transform: hovered ? 'translateY(-2px) scale(1.01)' : 'translateY(0px) scale(1)',
        transition: 'transform 180ms ease, box-shadow 180ms ease, background 180ms ease, border-color 180ms ease',
      }}
    >
      {/* 1) Neon gradient rim (kenar ışığı) */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: hovered ? 1 : 0,
          transition: 'opacity 200ms ease',
          // conic gradient kenar ışığı
          background:
            'conic-gradient(from 180deg at 50% 50%, rgba(0,255,240,0.35), rgba(120,90,255,0.35), rgba(255,70,170,0.35), rgba(0,255,240,0.35))',
          // sadece kenarda kalsın diye maskeleme
          padding: 1,
          WebkitMask:
            'linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)',
          WebkitMaskComposite: 'xor',
          maskComposite: 'exclude',
          borderRadius: 12,
        }}
      />

      {/* 2) Dış bloom (camın altından taşan ışık) */}
      <span
        className="pointer-events-none absolute -inset-8 blur-3xl"
        style={{
          opacity: hovered ? 1 : 0,
          transition: 'opacity 220ms ease',
          background:
            'radial-gradient(260px 140px at 30% 20%, rgba(0,255,240,0.14), transparent 60%),' +
            'radial-gradient(260px 160px at 80% 30%, rgba(120,90,255,0.12), transparent 62%),' +
            'radial-gradient(280px 180px at 60% 110%, rgba(255,70,170,0.10), transparent 70%)',
        }}
      />

      {/* 3) İç glow (glass altından gradient) */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: hovered ? 1 : 0,
          transition: 'opacity 180ms ease',
          background:
            'linear-gradient(135deg, rgba(0,255,240,0.10), rgba(120,90,255,0.08) 45%, rgba(255,70,170,0.08))',
          mixBlendMode: 'screen',
        }}
      />

      {/* 4) Specular highlight (yansıma şeridi) */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: hovered ? 1 : 0,
          transition: 'opacity 180ms ease',
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.06) 35%, transparent 60%)',
          mixBlendMode: 'soft-light',
        }}
      />

      {/* 5) Mouse spotlight (ışık imleci takip etsin) */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          opacity: hovered ? 1 : 0,
          transition: 'opacity 180ms ease',
          background: `radial-gradient(220px 160px at ${pos.mx} ${pos.my}, rgba(255,255,255,0.22), transparent 60%)`,
          mixBlendMode: 'overlay',
        }}
      />

      {/* içerik */}
      <div className="relative p-2 flex items-center gap-3">
        <div className="relative w-16 h-10 flex-shrink-0">
          <Image
            src={item.imageSrc}
            alt={item.title}
            fill
            sizes="64px"
            className={fit === 'cover' ? 'object-cover' : 'object-contain'}
            priority={false}
          />
        </div>

        <div className="flex-1 leading-tight hidden md:block">
          <div className="text-[12px] font-semibold tracking-wide opacity-90">
            {item.title}
          </div>
          {item.subtitle && (
            <div className="text-[10px] opacity-55 mt-0.5">
              {item.subtitle}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
