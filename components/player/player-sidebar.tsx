// components/player/player-sidebar.tsx
/**
 * Player Sidebar Navigation
 * Simple, persistent sidebar for player pages
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LayoutDashboard, Warehouse, ShoppingCart, Store } from 'lucide-react';
import { cn } from '@/lib/utils';

const navigationItems = [
  {
    label: 'Dashboard',
    href: '/player',
    icon: LayoutDashboard,
  },
  {
    label: 'Warehouse',
    href: '/player/warehouse',
    icon: Warehouse,
  },
  {
    label: 'Showcase',
    href: '/player/showcase',
    icon: Store,
  },
  {
    label: 'Supply Products',
    href: '/player/test/wholesale',
    icon: ShoppingCart,
  },
];

export function PlayerSidebar() {
  const pathname = usePathname();

  return (
    <div className="w-64 h-screen bg-transparent flex flex-col">
      {/* Header */}
      <div className="p-6">
        <h2 className="text-lg font-semibold">Player Panel</h2>
        <p className="text-sm text-muted-foreground">ModaVerse Operations</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/player' && pathname.startsWith(item.href));

          return (
            <Link key={item.href} href={item.href}>
              <Button
                variant="ghost"
                className={cn(
                  'w-full justify-start',
                  isActive && 'bg-accent'
                )}
              >
                <Icon className="w-4 h-4 mr-3" />
                {item.label}
              </Button>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4">
        <p className="text-xs text-muted-foreground text-center">
          ModaVerse V02
        </p>
      </div>
    </div>
  );
}
