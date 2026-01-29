//app/admin/dashboard/page.tsx

import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Shield, Package, ShoppingCart, BarChart3 } from 'lucide-react';
import Link from 'next/link';

export default async function AdminDashboardPage() {
  // Session kontrolü
  const session = await getServerSession();
  
  if (!session) {
    redirect('/admin/login');
  }
  
  const { user } = session;
  
  // Sadece admin'ler erişebilir
  if (user.role === 'PLAYER') {
    redirect('/player');
  }

  return (
    <div className="min-h-screen flex items-center justify-center   dark:bg-background via-background  bg-background p-4">
      <div className="container mx-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <Shield className="w-10 h-10 text-red-500" />
              Admin Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Hoş geldiniz, {user.name || user.email}
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Dashboard</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Admin dashboard içeriği buraya eklenecek.
              </p>
              <div className="mt-4 space-y-2">
                <p className="text-sm">
                  <strong>Rol:</strong> {user.role}
                </p>
                <p className="text-sm">
                  <strong>Email:</strong> {user.email}
                </p>
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link href="/admin/products">
                  <Button variant="outline" className="w-full sm:w-auto">
                    <Package className="w-4 h-4 mr-2" />
                    Product Page
                  </Button>
                </Link>
                <Link href="/admin/wholesales">
                  <Button variant="outline" className="w-full sm:w-auto">
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Wholesale Suppliers
                  </Button>
                </Link>
                <Link href="/admin/metrics">
                  <Button variant="outline" className="w-full sm:w-auto">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Metrics
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
