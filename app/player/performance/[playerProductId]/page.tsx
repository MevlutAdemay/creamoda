// app/player/performance/[playerProductId]/page.tsx

import { redirect, notFound } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { getPerformanceDetailData } from '../_lib/detail-data';
import { PerformanceDetailClient } from '../_components/PerformanceDetailClient';

type PageProps = {
  params: Promise<{ playerProductId: string }>;
  searchParams: Promise<{ warehouseId?: string }> | { warehouseId?: string };
};

export default async function PerformanceDetailPage({
  params,
  searchParams,
}: PageProps) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect('/login');

  const company = await prisma.company.findFirst({
    where: { playerId: session.user.id },
    select: { id: true },
  });
  if (!company) redirect('/wizard');

  const { playerProductId } = await params;
  const sp = searchParams instanceof Promise ? await searchParams : searchParams;
  const warehouseId = sp.warehouseId?.trim() || null;

  const data = await getPerformanceDetailData(
    company.id,
    playerProductId,
    warehouseId
  );
  if (!data) notFound();

  const backHref = `/player/performance${data.warehouseId ? `?warehouseId=${encodeURIComponent(data.warehouseId)}` : ''}`;

  return (
    <div className="relative min-h-screen bg-transparent">
      <div className="container mx-auto p-4 md:p-8">
        <div className="mx-auto max-w-4xl space-y-6 min-w-full">
          <PerformanceDetailClient data={data} backHref={backHref} />
        </div>
      </div>
    </div>
  );
}
