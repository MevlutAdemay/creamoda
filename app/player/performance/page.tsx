import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole } from '@prisma/client';
import { PerformanceWarehouseSelect } from './_components/PerformanceWarehouseSelect';
import { PerformanceList } from './_components/PerformanceList';
import { getPerformanceListData } from './_lib/performance-data';
import { BarChart3 } from 'lucide-react';

type PageProps = {
  searchParams: Promise<{ warehouseId?: string }> | { warehouseId?: string };
};

export default async function PerformancePage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect('/login');

  const company = await prisma.company.findFirst({
    where: { playerId: session.user.id },
    select: { id: true },
  });
  if (!company) redirect('/wizard');

  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  const queryWarehouseId = params.warehouseId?.trim() || null;

  const warehouses = await prisma.companyBuilding.findMany({
    where: { companyId: company.id, role: BuildingRole.WAREHOUSE },
    select: { id: true, role: true, marketZone: true },
    orderBy: { createdAt: 'asc' },
  });

  const warehouseIds = warehouses.map((w) => w.id);
  const validWarehouseId =
    queryWarehouseId && warehouseIds.includes(queryWarehouseId)
      ? queryWarehouseId
      : warehouses[0]?.id ?? null;

  const rows = validWarehouseId
    ? await getPerformanceListData(company.id, validWarehouseId)
    : [];

  return (
    <div className="relative bg-transparent ">
      <div className="container mx-auto p-4 md:p-8">
        <div className="mx-auto space-y-6 min-w-full">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground md:text-2xl">
                <BarChart3 className="h-7 w-7 text-muted-foreground" />
                Product Performance
              </h1>
              <p className="mt-1 text-muted-foreground">
                Decision support by warehouse. Scan performance at a glance.
              </p>
            </div>
            <PerformanceWarehouseSelect
              warehouses={warehouses}
              currentBuildingId={validWarehouseId}
            />
          </div>

          {!validWarehouseId ? (
            <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-foreground">
              <p>No warehouse available. Add a warehouse to see product performance.</p>
            </div>
          ) : (
            <PerformanceList rows={rows} warehouseId={validWarehouseId} />
          )}
        </div>
      </div>
    </div>
  );
}
