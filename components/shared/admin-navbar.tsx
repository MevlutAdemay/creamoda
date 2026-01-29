'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Shield, Menu, LogOut } from 'lucide-react';
import AdminSidebar from './admin-sidebar';

interface AdminNavbarProps {
  user?: {
    name?: string;
    email: string;
    role?: string;
    displayName?: string;
  };
}

export default function AdminNavbar({ user: propUser }: AdminNavbarProps) {
  const router = useRouter();
  const [user, setUser] = useState<any>(propUser || { email: 'admin@modaverse.com' });
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fetch user data on mount
  useEffect(() => {
    setMounted(true);
    if (!propUser) {
      fetch('/api/auth/me')
        .then(res => res.json())
        .then(data => {
          if (data.user) {
            setUser(data.user);
          }
        })
        .catch(err => console.error('Failed to fetch user:', err));
    }
  }, [propUser]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/admin/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (!mounted) return null;

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 w-full h-16 bg-background/80 backdrop-blur-sm border-b border-border z-50">
        <div className="w-full h-full flex justify-between items-center px-3 sm:px-4 md:pl-24 lg:pl-72">
          {/* Left Section: Hamburger + Logo */}
          <div className="flex items-center gap-2 min-w-0 shrink">
            {/* Hamburger Menu - Sadece mobilde görünür (<768px) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              className="md:hidden h-9 w-9"
              aria-label="Menüyü aç"
            >
              <Menu className="h-5 w-5" />
            </Button>

            {/* Logo */}
            <div className="flex items-center gap-2">
              <Shield className="w-6 h-6 text-red-500" />
              <span className="text-lg font-semibold hidden sm:inline">Admin Panel</span>
            </div>
          </div>

          {/* Right Section: User Info + Logout */}
          <div className="flex items-center gap-3">
            <span className="text-sm hidden sm:inline">
              {user?.displayName || user?.name || user?.email}
              {user?.role && (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({user.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Content Manager'})
                </span>
              )}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-destructive hover:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Çıkış</span>
            </Button>
          </div>
        </div>
      </nav>

      {/* Mobile Sidebar */}
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
    </>
  );
}
