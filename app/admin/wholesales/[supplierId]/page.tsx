// app/admin/wholesales/[supplierId]/page.tsx

import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import SupplierDetailClient from './supplier-detail-client';

type Params = { params: Promise<{ supplierId: string }> };

export default async function SupplierDetailPage({ params }: Params) {
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

  const { supplierId } = await params;

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <SupplierDetailClient supplierId={supplierId} />
      </div>
    </div>
  );
}
