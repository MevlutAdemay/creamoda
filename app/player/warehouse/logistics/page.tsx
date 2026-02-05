import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole, MetricType, InventoryMovementType, InventorySourceType } from '@prisma/client';
import { WarehouseHeader } from '../_components/WarehouseHeader';
import { WarehousePlaceholder } from '../_components/WarehousePlaceholder';
import { getCompanyGameDayKey, formatDayKeyString } from '@/lib/game/game-clock';
import { Truck, Calendar } from 'lucide-react';
import { LogisticsSummaryCards } from './_components/LogisticsSummaryCards';
import { LogisticsProductLists } from './_components/LogisticsProductLists';
import type { LogisticsProductListRow } from './_components/LogisticsProductLists';
import { BacklogProductList } from './_components/BacklogProductList';
import { PartTimePreviewCard } from './_components/PartTimePreviewCard';
import type { BacklogProductItem } from './_components/types';

type PageProps = {
  searchParams: Promise<{ buildingId?: string }> | { buildingId?: string };
};

export type { BacklogProductItem } from './_components/types';

function pickProductImageUrl(
  images: Array<{ url: string; slot: string; sortOrder: number }>
): string | null {
  if (!images.length) return null;
  const main = images.find((i) => i.slot === 'MAIN');
  if (main) return main.url;
  return images[0]!.url;
}

export default async function WarehouseLogisticsPage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.user?.id) redirect('/login');

  const company = await prisma.company.findFirst({
    where: { playerId: session.user.id },
    select: { id: true },
  });
  if (!company) redirect('/wizard');

  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  const queryBuildingId = params.buildingId?.trim() || null;

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
              activeTab="logistics"
              title={
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  <Truck className="h-7 w-7 text-muted-foreground" />
                  Logistics
                </h1>
              }
              description={warehouseLabel ? `Selected: ${warehouseLabel}` : undefined}
            />
            <WarehousePlaceholder
              title="Logistics"
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
  const normalizedToday = currentDayKey;

  const [
    building,
    dailyLogsToday,
    salesCountState,
    backlogItems,
    dailyLogsLast7,
    todayOrderItems,
    todayShippedMovements,
  ] = await Promise.all([
    prisma.companyBuilding.findUnique({
      where: { id: validBuildingId },
      select: { id: true, name: true, marketZone: true, countryId: true, createdAt: true },
    }),
    prisma.dailyProductSalesLog.findMany({
      where: {
        warehouseBuildingId: validBuildingId,
        dayKey: normalizedToday,
      },
      select: { qtyOrdered: true, qtyShipped: true },
    }),
    prisma.buildingMetricState.findUnique({
      where: {
        buildingId_metricType: {
          buildingId: validBuildingId,
          metricType: MetricType.SALES_COUNT,
        },
      },
      select: { currentLevel: true, currentCount: true },
    }),
    prisma.modaverseOrderItem.findMany({
      where: {
        order: { warehouseBuildingId: validBuildingId, companyId: company.id },
      },
      select: {
        id: true,
        orderId: true,
        productTemplateId: true,
        qtyOrdered: true,
        qtyFulfilled: true,
        qtyShipped: true,
        sortIndex: true,
        order: { select: { id: true, dayKey: true } },
      },
      orderBy: [{ order: { dayKey: 'asc' } }, { sortIndex: 'asc' }],
    }),
    prisma.dailyProductSalesLog.findMany({
      where: {
        warehouseBuildingId: validBuildingId,
        dayKey: {
          gte: new Date(normalizedToday.getTime() - 6 * 24 * 60 * 60 * 1000),
          lte: normalizedToday,
        },
      },
      select: { dayKey: true, qtyOrdered: true, qtyShipped: true },
    }),
    prisma.modaverseOrderItem.findMany({
      where: {
        order: {
          warehouseBuildingId: validBuildingId,
          companyId: company.id,
          dayKey: normalizedToday,
        },
      },
      select: {
        qtyOrdered: true,
        productTemplateId: true,
        productTemplate: {
          select: {
            code: true,
            name: true,
            productImageTemplates: {
              select: { url: true, slot: true, sortOrder: true },
              orderBy: [{ slot: 'asc' }, { sortOrder: 'asc' }],
            },
          },
        },
      },
    }),
    prisma.inventoryMovement.findMany({
      where: {
        companyBuildingId: validBuildingId,
        dayKey: normalizedToday,
        movementType: InventoryMovementType.OUT,
        sourceType: InventorySourceType.SALES_FULFILLMENT,
      },
      select: {
        productTemplateId: true,
        qtyChange: true,
        productTemplate: {
          select: {
            code: true,
            name: true,
            productImageTemplates: {
              select: { url: true, slot: true, sortOrder: true },
              orderBy: [{ slot: 'asc' }, { sortOrder: 'asc' }],
            },
          },
        },
      },
    }),
  ]);

  const todayOrdersRows: LogisticsProductListRow[] = (() => {
    const byProduct = new Map<
      string,
      { code: string; name: string; imageUrl: string | null; qty: number }
    >();
    for (const item of todayOrderItems) {
      const cur = byProduct.get(item.productTemplateId);
      const qty = (cur?.qty ?? 0) + item.qtyOrdered;
      const pt = item.productTemplate;
      const imageUrl = pickProductImageUrl(
        pt.productImageTemplates.map((t) => ({
          url: t.url,
          slot: t.slot,
          sortOrder: t.sortOrder,
        }))
      );
      if (!cur) {
        byProduct.set(item.productTemplateId, {
          code: pt.code,
          name: pt.name,
          imageUrl,
          qty,
        });
      } else {
        cur.qty = qty;
      }
    }
    return Array.from(byProduct.entries())
      .map(([productTemplateId, v]) => ({
        productTemplateId,
        code: v.code,
        name: v.name,
        imageUrl: v.imageUrl,
        qty: v.qty,
      }))
      .sort((a, b) => b.qty - a.qty);
  })();

  const todayShippedRows: LogisticsProductListRow[] = (() => {
    const byProduct = new Map<
      string,
      { code: string; name: string; imageUrl: string | null; qty: number }
    >();
    for (const m of todayShippedMovements) {
      const cur = byProduct.get(m.productTemplateId);
      const add = Math.abs(m.qtyChange);
      const qty = (cur?.qty ?? 0) + add;
      const pt = m.productTemplate;
      const imageUrl = pickProductImageUrl(
        pt.productImageTemplates.map((t) => ({
          url: t.url,
          slot: t.slot,
          sortOrder: t.sortOrder,
        }))
      );
      if (!cur) {
        byProduct.set(m.productTemplateId, {
          code: pt.code,
          name: pt.name,
          imageUrl,
          qty,
        });
      } else {
        cur.qty = qty;
      }
    }
    return Array.from(byProduct.entries())
      .map(([productTemplateId, v]) => ({
        productTemplateId,
        code: v.code,
        name: v.name,
        imageUrl: v.imageUrl,
        qty: v.qty,
      }))
      .sort((a, b) => b.qty - a.qty);
  })();

  let orderedUnitsToday = dailyLogsToday.reduce((s, r) => s + (r.qtyOrdered ?? 0), 0);
  if (dailyLogsToday.length === 0) {
    const ordersToday = await prisma.modaverseOrder.findMany({
      where: {
        warehouseBuildingId: validBuildingId,
        companyId: company.id,
        dayKey: normalizedToday,
      },
      select: { id: true },
    });
    const orderIds = ordersToday.map((o) => o.id);
    if (orderIds.length > 0) {
      const itemsToday = await prisma.modaverseOrderItem.findMany({
        where: { orderId: { in: orderIds } },
        select: { qtyOrdered: true },
      });
      orderedUnitsToday = itemsToday.reduce((s, i) => s + i.qtyOrdered, 0);
    }
  }

  const totalShippedToday = salesCountState?.currentCount ?? 0;
  const todayTime = normalizedToday.getTime();
  const shippedFromTodayOrders = backlogItems
    .filter((i) => i.order.dayKey.getTime() === todayTime)
    .reduce((s, i) => s + i.qtyShipped, 0);
  const shippedFromBacklogToday = Math.max(0, totalShippedToday - shippedFromTodayOrders);

  const salesCountLevel = salesCountState?.currentLevel ?? 1;
  const levelConfig = await prisma.metricLevelConfig.findFirst({
    where: {
      buildingRole: BuildingRole.WAREHOUSE,
      metricType: MetricType.SALES_COUNT,
      level: salesCountLevel,
    },
    select: { maxAllowed: true },
  });
  const capacityPerDay = levelConfig?.maxAllowed ?? 0;

  const openBacklogItems = backlogItems.filter((i) => i.qtyFulfilled < i.qtyOrdered);
  const backlogUnitsTotal = openBacklogItems.reduce((s, i) => s + (i.qtyOrdered - i.qtyFulfilled), 0);

  const productMap = new Map<
    string,
    {
      productTemplateId: string;
      backlogUnits: number;
      oldestDayKey: Date;
      breakdown: Array<{ dayKey: string; ordered: number; fulfilled: number; remaining: number }>;
    }
  >();
  for (const item of openBacklogItems) {
    const remaining = item.qtyOrdered - item.qtyFulfilled;
    if (remaining <= 0) continue;
    const dayKey = item.order.dayKey;
    const dayKeyStr = dayKey.toISOString();
    const row = {
      dayKey: dayKeyStr,
      ordered: item.qtyOrdered,
      fulfilled: item.qtyFulfilled,
      remaining,
    };
    const existing = productMap.get(item.productTemplateId);
    if (existing) {
      existing.backlogUnits += remaining;
      if (dayKey < existing.oldestDayKey) existing.oldestDayKey = dayKey;
      existing.breakdown.push(row);
    } else {
      productMap.set(item.productTemplateId, {
        productTemplateId: item.productTemplateId,
        backlogUnits: remaining,
        oldestDayKey: dayKey,
        breakdown: [row],
      });
    }
  }

  const productTemplateIds = [...productMap.keys()];
  const [products, images] =
    productTemplateIds.length > 0
      ? await Promise.all([
          prisma.productTemplate.findMany({
            where: { id: { in: productTemplateIds } },
            select: { id: true, code: true, name: true },
          }),
          prisma.productImageTemplate.findMany({
            where: { productTemplateId: { in: productTemplateIds } },
            select: { productTemplateId: true, url: true, slot: true, sortOrder: true },
            orderBy: [{ slot: 'asc' }, { sortOrder: 'asc' }],
          }),
        ])
      : [[], []] as const;

  const productById = new Map(products.map((p) => [p.id, p]));
  const thumbnailByProductId = new Map<string, string>();
  for (const img of images) {
    if (!thumbnailByProductId.has(img.productTemplateId)) {
      thumbnailByProductId.set(img.productTemplateId, img.url);
    }
  }

  const backlogByProduct: BacklogProductItem[] = Array.from(productMap.entries())
    .map(([productTemplateId, p]) => {
      const meta = productById.get(productTemplateId);
      const breakdown = [...p.breakdown].sort(
        (a, b) => new Date(a.dayKey).getTime() - new Date(b.dayKey).getTime()
      );
      return {
        productTemplateId,
        productCode: meta?.code ?? '',
        productName: meta?.name ?? '',
        thumbnailUrl: thumbnailByProductId.get(productTemplateId) ?? null,
        backlogUnits: p.backlogUnits,
        oldestDayKey: p.oldestDayKey.toISOString(),
        breakdown,
      };
    })
    .sort((a, b) => b.backlogUnits - a.backlogUnits);

  const backlogRows: LogisticsProductListRow[] = backlogByProduct.map((p) => ({
    productTemplateId: p.productTemplateId,
    code: p.productCode,
    name: p.productName,
    imageUrl: p.thumbnailUrl,
    qty: p.backlogUnits,
  }));

  const country = building?.countryId
    ? await prisma.country.findUnique({
        where: { id: building.countryId },
        select: { salaryMultiplier: true },
      })
    : null;
  const salaryMultiplier = country?.salaryMultiplier ? Number(country.salaryMultiplier) : 1;

  const last7ByDay = new Map<string, { ordered: number; shipped: number }>();
  for (const r of dailyLogsLast7) {
    const key = formatDayKeyString(r.dayKey);
    const cur = last7ByDay.get(key) ?? { ordered: 0, shipped: 0 };
    cur.ordered += r.qtyOrdered ?? 0;
    cur.shipped += r.qtyShipped ?? 0;
    last7ByDay.set(key, cur);
  }
  const recentDaysTrend = Array.from(last7ByDay.entries())
    .map(([dayKey, v]) => ({ dayKey, ...v }))
    .sort((a, b) => a.dayKey.localeCompare(b.dayKey));

  return (
    <div className="relative min-h-screen bg-transparent">
      <div className="container mx-auto p-4 md:p-8">
        <div className="mx-auto max-w-5xl space-y-6   min-w-full">
          <WarehouseHeader
            warehouses={warehouses.map((w) => ({ id: w.id, role: w.role, marketZone: w.marketZone }))}
            currentBuildingId={validBuildingId}
            activeTab="logistics"
            title={
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  <Truck className="h-7 w-7 text-muted-foreground" />
                  Logistics
                </h1>
                <span className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {formatDayKeyString(currentDayKey)}
                </span>
              </div>
            }
            description={warehouseLabel ? `Selected: ${warehouseLabel}` : undefined}
          />

          <LogisticsSummaryCards
            orderedUnitsToday={orderedUnitsToday}
            totalShippedToday={totalShippedToday}
            shippedFromBacklogToday={shippedFromBacklogToday}
            shippedFromTodayOrders={shippedFromTodayOrders}
            backlogUnitsTotal={backlogUnitsTotal}
            capacityPerDay={capacityPerDay}
          />

          <LogisticsProductLists
            todayOrders={todayOrdersRows}
            todayShipped={todayShippedRows}
            backlog={backlogRows}
          />

          <div className="rounded-lg border bg-card/50 p-4 shadow-sm">
            <p className="mb-2 text-xs font-medium  tracking-wide text-muted-foreground">
              Capacity & backlog
            </p>
            <p className="text-sm">
              Available capacity today: <span className="font-medium tabular-nums">{capacityPerDay}</span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Remaining backlog after shipments: <span className="font-medium tabular-nums">{backlogUnitsTotal}</span>
            </p>
          </div>

          <BacklogProductList items={backlogByProduct} />

          {recentDaysTrend.length > 0 && (
            <div className="rounded-lg border bg-card/50 p-4 shadow-sm">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Last 7 days
              </p>
              <ul className="space-y-1 text-sm">
                {recentDaysTrend.map((d) => (
                  <li key={d.dayKey} className="flex justify-between tabular-nums">
                    <span className="text-muted-foreground">{d.dayKey}</span>
                    <span>Ord {d.ordered} · Ship {d.shipped}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <PartTimePreviewCard
            buildingId={validBuildingId}
            backlogUnitsTotal={backlogUnitsTotal}
            salaryMultiplier={salaryMultiplier}
          />
        </div>
      </div>
    </div>
  );
}
