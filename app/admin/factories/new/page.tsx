import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from '@/lib/auth/get-session';
import { Button } from '@/components/ui/button';
import { FactoryForm } from '../_components/FactoryForm';
import { getCountries } from '../_actions';
import { ChevronLeft } from 'lucide-react';

export default async function NewFactoryPage() {
  const session = await getServerSession();
  if (!session) redirect('/admin/login');
  if (session.user.role === 'PLAYER') redirect('/player');

  const countries = await getCountries();

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-8">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/factories" className="flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" />
              Back to list
            </Link>
          </Button>
        </div>
        <h1 className="text-2xl font-semibold mb-6">New factory</h1>
        <FactoryForm countries={countries} />
      </div>
    </div>
  );
}
