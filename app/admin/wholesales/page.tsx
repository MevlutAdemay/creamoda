// app/admin/wholesales/page.tsx

import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import WholesalesClient from './wholesales-client';

export default async function WholesalesPage() {
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
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <WholesalesClient />
      </div>
    </div>
  );
}
