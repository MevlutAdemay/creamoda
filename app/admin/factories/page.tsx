import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from '@/lib/auth/get-session';
import { Button } from '@/components/ui/button';
import { FactoriesTable } from './_components/FactoriesTable';
import { Plus } from 'lucide-react';

export default async function AdminFactoriesPage() {
  const session = await getServerSession();
  if (!session) redirect('/admin/login');
  if (session.user.role === 'PLAYER') redirect('/player');

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold">Factories</h1>
          <Button asChild>
            <Link href="/admin/factories/new">
              <Plus className="h-4 w-4 mr-2" />
              New factory
            </Link>
          </Button>
        </div>
        <FactoriesTable />
      </div>
    </div>
  );
}
