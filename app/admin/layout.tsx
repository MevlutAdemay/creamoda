// app/admin/layout.tsx
/**
 * Admin Layout
 * Server component with auth guard.
 * Redirects to /admin/login if not authenticated or not admin.
 */

import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import AdminNavbar from '@/components/shared/admin-navbar';
import AdminSidebar from '@/components/shared/admin-sidebar';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side guard: check session
  const session = await getServerSession();
  if (!session) {
    redirect('/admin/login');
  }

  const { user } = session;

  // Sadece admin'ler erişebilir
  if (user.role === 'PLAYER') {
    redirect('/player');
  }

  // Type assertion: bu noktada user kesinlikle bir admin
  const adminUser = {
    name: user.name ?? undefined,
    email: user.email,
    role: user.role as 'SUPER_ADMIN' | 'CONTENT_MANAGER',
    displayName: user.displayName ?? undefined,
  };

  return (
    <>
      <AdminNavbar user={adminUser} />
      <div className="flex h-screen overflow-hidden bg-transparent pt-16 mt-0">
        {/* Sidebar */}
        <AdminSidebar />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-transparent relative isolate md:pl-20 lg:pl-64">
          {children}
        </main>
      </div>
    </>
  );
}
