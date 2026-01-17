import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield } from 'lucide-react';

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
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
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
