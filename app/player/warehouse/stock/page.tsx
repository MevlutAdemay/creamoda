import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole } from '@prisma/client';
import { WarehouseHeader } from '../_components/WarehouseHeader';
import { WarehousePlaceholder } from '../_components/WarehousePlaceholder';
import { StockPageClient } from './StockPageClient';
import { getCompanyGameDayKey } from '@/lib/game/game-clock';
import { Package } from 'lucide-react';

type PageProps = {
  searchParams: Promise<{ buildingId?: string; tab?: string }> | { buildingId?: string; tab?: string };
};

const TAB_VALUES = ['inventory', 'movements', 'incoming'] as const;
type TabValue = (typeof TAB_VALUES)[number];

function normalizeTab(tab: string | undefined): TabValue {
  if (tab === 'incoming' || tab === 'movements' || tab === 'inventory') return tab;
  return 'inventory';
}

export default async function WarehouseStockPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect('/login');

  const company = await prisma.company.findFirst({
    where: { playerId: session.user.id },
    select: { id: true },
  });
  if (!company) redirect('/wizard');

  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  const queryBuildingId = params.buildingId?.trim() || null;
  const tabParam = normalizeTab(params.tab?.trim());

  const warehouses = await prisma.companyBuilding.findMany({
    where: { companyId: company.id, role: BuildingRole.WAREHOUSE },
    select: { id: true, role: true, marketZone: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const warehouseIds = warehouses.map((w) => w.id);
  const validBuildingId =
    queryBuildingId && warehouseIds.includes(queryBuildingId)
      ? queryBuildingId
      : warehouses[0]?.id ?? null;

  const selectedWarehouse = validBuildingId
    ? warehouses.find((w) => w.id === validBuildingId)
    : null;
  const roleToLabel = (r: string) => (r === 'HQ' ? 'HQ' : r === 'WAREHOUSE' ? 'Warehouse' : r.replace(/_/g, ' '));
  const warehouseLabel = selectedWarehouse
    ? roleToLabel(selectedWarehouse.role) +
      (selectedWarehouse.marketZone?.trim()
        ? ` – ${selectedWarehouse.marketZone.replace(/_/g, ' ')}`
        : '')
    : null;

  const basePath = '/player/warehouse';
  const backHref = validBuildingId ? `${basePath}?buildingId=${encodeURIComponent(validBuildingId)}` : basePath;

  if (!validBuildingId) {
    return (
      <div className="relative min-h-screen bg-transparent">
        <div className="container mx-auto p-4 md:p-8">
          <div className="mx-auto max-w-5xl space-y-6">
            <WarehouseHeader
              warehouses={warehouses.map((w) => ({ id: w.id, role: w.role, marketZone: w.marketZone }))}
              currentBuildingId={validBuildingId}
              activeTab="stock"
              title={
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  <Package className="h-7 w-7 text-muted-foreground" />
                  Warehouse Stock
                </h1>
              }
              description={warehouseLabel ? `Selected: ${warehouseLabel}` : undefined}
            />
            <WarehousePlaceholder
              title="Warehouse Stock"
              bullets={[]}
              backHref={backHref}
              noWarehouse
            />
          </div>
        </div>
      </div>
    );
  }

  const currentDayKey = await getCompanyGameDayKey(company.id);
  const isInventory = tabParam === 'inventory';
  const isMovements = tabParam === 'movements' || tabParam === 'incoming';

  const [inventoryRows, movementRows, movementAggregates] = await Promise.all([
    isInventory
      ? prisma.buildingInventoryItem.findMany({
          where: {
            companyBuildingId: validBuildingId,
            isArchived: false,
          },
          select: {
            id: true,
            companyBuildingId: true,
            productTemplateId: true,
            qtyOnHand: true,
            qtyReserved: true,
            avgUnitCost: true,
            lastUnitCost: true,
            productTemplate: {
              select: {
                code: true,
                name: true,
                productImageTemplates: {
                  where: { slot: 'MAIN' },
                  orderBy: { sortOrder: 'asc' },
                  take: 1,
                  select: { url: true },
                },
              },
            },
          },
        })
      : null,
    validBuildingId
      ? prisma.inventoryMovement.findMany({
          where: { companyBuildingId: validBuildingId },
          select: {
            id: true,
            movementType: true,
            sourceType: true,
            qtyChange: true,
            unitCost: true,
            dayKey: true,
            createdAt: true,
            productTemplate: {
              select: { code: true, name: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
      : null,
    validBuildingId
      ? prisma.inventoryMovement.groupBy({
          by: ['productTemplateId', 'movementType'],
          where: { companyBuildingId: validBuildingId },
          _sum: { qtyChange: true },
        })
      : [],
  ]);

  const stockTotalsByProductTemplateId = (() => {
    const map = new Map<
      string,
      { totalStock: number; sold: number; available: number }
    >();
    if (!movementAggregates || movementAggregates.length === 0) return map;
    for (const row of movementAggregates) {
      const cur = map.get(row.productTemplateId) ?? {
        totalStock: 0,
        sold: 0,
        available: 0,
      };
      const sum = row._sum.qtyChange ?? 0;
      if (row.movementType === 'IN') {
        cur.totalStock += sum;
      } else {
        cur.sold += Math.abs(sum);
      }
      map.set(row.productTemplateId, cur);
    }
    for (const [, v] of map) {
      v.available = v.totalStock - v.sold;
    }
    return map;
  })();

  const inventoryData =
    inventoryRows?.map((row) => {
      const totals = stockTotalsByProductTemplateId.get(row.productTemplateId);
      const totalStock = totals?.totalStock ?? row.qtyOnHand;
      const sold = totals?.sold ?? 0;
      const available = totals?.available ?? row.qtyOnHand;
      return {
        id: row.id,
        companyBuildingId: row.companyBuildingId,
        productTemplateId: row.productTemplateId,
        qtyOnHand: row.qtyOnHand,
        qtyReserved: row.qtyReserved,
        avgUnitCost: Number(row.avgUnitCost),
        lastUnitCost: Number(row.lastUnitCost),
        productCode: row.productTemplate.code,
        productName: row.productTemplate.name,
        thumbnailUrl: row.productTemplate.productImageTemplates[0]?.url ?? null,
        totalStock,
        sold,
        available,
      };
    }) ?? null;

  const movementsData =
    movementRows?.map((m) => ({
      id: m.id,
      movementType: m.movementType,
      sourceType: m.sourceType,
      qtyChange: m.qtyChange,
      unitCost: m.unitCost != null ? Number(m.unitCost) : null,
      dayKey: m.dayKey.toISOString(),
      createdAt: m.createdAt.toISOString(),
      productCode: m.productTemplate.code,
      productName: m.productTemplate.name,
    })) ?? null;

  const preserveParams = { tab: tabParam };

  return (
    <div className="relative min-h-screen bg-transparent">
      <div className="container mx-auto p-4 md:p-8">
        <div className="mx-auto max-w-5xl space-y-6 min-w-full">
          <WarehouseHeader
            warehouses={warehouses.map((w) => ({ id: w.id, role: w.role, marketZone: w.marketZone }))}
            currentBuildingId={validBuildingId}
            activeTab="stock"
            title={
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                <Package className="h-7 w-7 text-muted-foreground" />
                Warehouse Stock
              </h1>
            }
            description={warehouseLabel ? `Selected: ${warehouseLabel}` : undefined}
            preserveParams={preserveParams}
          />

          <StockPageClient
            buildingId={validBuildingId}
            tab={tabParam}
            inventory={inventoryData}
            movements={movementsData}
            currentDayKey={currentDayKey.toISOString()}
            basePath={`${basePath}/stock`}
          />
        </div>
      </div>
    </div>
  );
}
