// creamoda/app/player/warehouse/page.tsx

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getTranslations, getLocale } from 'next-intl/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole, MetricType } from '@prisma/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BuildingDevelopmentStageCard } from '@/components/player/developmentstage/BuildingDevelopmentStageCard';
import { WarehouseHeader } from './_components/WarehouseHeader';
import type {
  WarehouseSummary,
  MetricStateRow,
  LevelConfigRow,
  MetricStageRow,
} from '@/components/player/developmentstage/types';
import {
  Warehouse,
  Package,
  Layers,
  DollarSign,
  Activity,
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { MessageLevel } from '@prisma/client';
import { formatCurrency, formatDateTime } from '@/lib/format';

const BUILDING_ROLE_WAREHOUSE = 'WAREHOUSE';

function getConfig(
  levelConfigs: LevelConfigRow[],
  metricType: 'STOCK_COUNT' | 'SALES_COUNT',
  level: number
): LevelConfigRow | undefined {
  return levelConfigs.find(
    (c) =>
      c.buildingRole === BUILDING_ROLE_WAREHOUSE &&
      c.metricType === metricType &&
      c.level === level
  );
}

function buildMetricRow(
  metricType: 'STOCK_COUNT' | 'SALES_COUNT',
  state: MetricStateRow | undefined,
  levelConfigs: LevelConfigRow[],
  label: string,
  nextHintFn: (min: number, max: number) => string
): MetricStageRow {
  const currentCount = state?.currentCount ?? 0;
  const currentLevel = state?.currentLevel ?? 1;
  const levelConfig = getConfig(levelConfigs, metricType, currentLevel);
  const maxAllowed = levelConfig?.maxAllowed ?? Math.max(currentCount, 1);
  const progress = Math.min(1, Math.max(0, currentCount / maxAllowed));
  const nextConfig = getConfig(levelConfigs, metricType, currentLevel + 1);
  const nextHint = nextConfig
    ? nextHintFn(nextConfig.minRequired, nextConfig.maxAllowed)
    : null;
  return {
    label,
    currentCount,
    currentLevel,
    maxAllowed,
    progress,
    nextHint,
  };
}

type PageProps = {
  searchParams: Promise<{ buildingId?: string }> | { buildingId?: string };
};

export default async function WarehousePage({ searchParams }: PageProps) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const t = await getTranslations('warehouse');
  const locale = await getLocale();

  const params = searchParams instanceof Promise ? await searchParams : searchParams;
  const queryBuildingId = params.buildingId?.trim() || null;

  const company = await prisma.company.findFirst({
    where: { playerId: session.user.id },
    select: { id: true },
  });
  if (!company) {
    redirect('/wizard');
  }

  const warehouses = await prisma.companyBuilding.findMany({
    where: {
      companyId: company.id,
      role: BuildingRole.WAREHOUSE,
    },
    select: {
      id: true,
      role: true,
      marketZone: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  const warehouseIds = warehouses.map((w) => w.id);
  const validBuildingId =
    queryBuildingId && warehouseIds.includes(queryBuildingId)
      ? queryBuildingId
      : warehouses[0]?.id ?? null;

  const [kpiAggregates, stockValueRows, metricStates, levelConfigs, recentMessages] =
    await Promise.all([
      validBuildingId
        ? prisma.buildingInventoryItem.aggregate({
            where: {
              companyBuildingId: validBuildingId,
              isArchived: false,
            },
            _sum: {
              qtyOnHand: true,
              qtyReserved: true,
            },
            _count: { id: true },
          })
        : null,
      validBuildingId
        ? prisma.buildingInventoryItem.findMany({
            where: {
              companyBuildingId: validBuildingId,
              isArchived: false,
            },
            select: { qtyOnHand: true, avgUnitCost: true },
          })
        : [],
      warehouseIds.length > 0 && validBuildingId
        ? prisma.buildingMetricState.findMany({
            where: {
              buildingId: validBuildingId,
              metricType: { in: [MetricType.STOCK_COUNT, MetricType.SALES_COUNT] },
            },
            select: {
              buildingId: true,
              metricType: true,
              currentCount: true,
              currentLevel: true,
            },
          })
        : [],
      prisma.metricLevelConfig.findMany({
        where: {
          buildingRole: BuildingRole.WAREHOUSE,
          metricType: { in: [MetricType.STOCK_COUNT, MetricType.SALES_COUNT] },
        },
        select: {
          buildingRole: true,
          metricType: true,
          level: true,
          minRequired: true,
          maxAllowed: true,
        },
      }),
      validBuildingId
        ? prisma.playerMessage.findMany({
            where: {
              playerId: session.user.id,
              context: { path: ['buildingId'], equals: validBuildingId },
            },
            select: {
              id: true,
              title: true,
              level: true,
              isRead: true,
              createdAt: true,
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          })
        : [],
    ]);

  const skuCount = validBuildingId
    ? (
        await prisma.buildingInventoryItem.groupBy({
          by: ['productTemplateId'],
          where: {
            companyBuildingId: validBuildingId,
            isArchived: false,
          },
        })
      ).length
    : 0;

  const totalUnits = kpiAggregates?._sum?.qtyOnHand ?? 0;
  const reservedUnits = kpiAggregates?._sum?.qtyReserved ?? 0;
  const stockValue =
    stockValueRows?.reduce(
      (sum, row) => sum + Number(row.qtyOnHand) * Number(row.avgUnitCost),
      0
    ) ?? 0;

  const warehouseSummaries: WarehouseSummary[] = warehouses.map((w) => ({
    id: w.id,
    role: w.role,
    marketZone: w.marketZone ?? null,
  }));

  const levelConfigRows: LevelConfigRow[] = levelConfigs.map((c) => ({
    buildingRole: c.buildingRole,
    metricType: c.metricType as 'STOCK_COUNT' | 'SALES_COUNT',
    level: c.level,
    minRequired: c.minRequired,
    maxAllowed: c.maxAllowed,
  }));

  const selectedWarehouse = validBuildingId
    ? warehouseSummaries.find((w) => w.id === validBuildingId)
    : null;
  const metricStateRows: MetricStateRow[] = metricStates.map((s) => ({
    buildingId: s.buildingId,
    metricType: s.metricType as 'STOCK_COUNT' | 'SALES_COUNT',
    currentCount: s.currentCount,
    currentLevel: s.currentLevel,
  }));
  const stockState = metricStateRows.find(
    (s) => s.buildingId === validBuildingId && s.metricType === 'STOCK_COUNT'
  );
  const salesState = metricStateRows.find(
    (s) => s.buildingId === validBuildingId && s.metricType === 'SALES_COUNT'
  );
  const nextHintFn = (min: number, max: number) => t('nextHint', { min, max });
  const stockRow = buildMetricRow('STOCK_COUNT', stockState, levelConfigRows, t('stockCapacity'), nextHintFn);
  const salesRow = buildMetricRow('SALES_COUNT', salesState, levelConfigRows, t('dailySalesCapacity'), nextHintFn);

  return (
    <div className="relative max-h-screen bg-transparent">
      <div className="container mx-auto p-4 md:p-8">
        <div className="mx-auto max-w-5xl space-y-6 min-w-full">
          <WarehouseHeader
            warehouses={warehouseSummaries}
            currentBuildingId={validBuildingId}
            activeTab="overview"
            title={
              <h6 className="flex items-center gap-2 text-xl font-bold tracking-tight text-foreground">
                <Warehouse className="h-7 w-7 text-muted-foreground" />
                {t('title')}
              </h6>
            }
            description={t('description')}
          />

          {warehouses.length === 0 ? (
            <Card className="border bg-card shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">{t('noWarehousesTitle')}</CardTitle>
                <CardDescription>
                  {t('noWarehousesDesc')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="outline" size="sm" disabled>
                  {t('addWarehouse')}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              {validBuildingId && (
                <>
                  {/* Sol %50: KPI + Development Stage | Sağ %50: Recent activity */}
                  <div className="grid gap-6 lg:grid-cols-2">
                    {/* Sol kolon: KPI kartları + Development Stage */}
                    <div className="min-w-0 space-y-6">
                      <div className="grid gap-4 grid-cols-3">
                        <Card className="border bg-card shadow-sm">
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                              <Package className="h-4 w-4" />
                              {t('totalUnitsOnHand')}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-lg font-semibold tabular-nums lg:text-2xl">
                              {totalUnits.toLocaleString(locale)}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border bg-card shadow-sm">
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                              <Layers className="h-4 w-4" />
                              {t('skuCount')}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-lg font-semibold tabular-nums lg:text-2xl">
                              {skuCount.toLocaleString(locale)}
                            </p>
                          </CardContent>
                        </Card>
                        <Card className="border bg-card shadow-sm col-span-1">
                          <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                              <DollarSign className="h-4 w-4" />
                              {t('stockValue')}
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-lg font-semibold tabular-nums lg:text-2xl">
                              {formatCurrency(stockValue, locale)}
                            </p>
                          </CardContent>
                        </Card>
                      </div>
                      {selectedWarehouse && (
                        <div className="min-w-0">
                          <h2 className="mb-3 text-sm font-medium text-foreground">
                            {t('developmentStage')}
                          </h2>
                          <BuildingDevelopmentStageCard
                            warehouse={selectedWarehouse}
                            stockRow={stockRow}
                            salesRow={salesRow}
                          />
                        </div>
                      )}
                    </div>

                    {/* Sağ kolon: Recent activity */}
                    <Card className="border bg-card shadow-sm h-fit">
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                          <Activity className="h-4 w-4" />
                          {t('recentActivity')}
                        </CardTitle>
                        <Button variant="outline" size="sm" asChild>
                          <Link href="/player/messages">
                            {t('viewAll')}
                            <ChevronRight className="ml-0.5 h-4 w-4" />
                          </Link>
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {recentMessages.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            {t('noRecentMessages')}
                          </p>
                        ) : (
                          <ul className="space-y-3">
                            {recentMessages.map((msg) => (
                              <li key={msg.id} className="flex items-start gap-2">
                                {!msg.isRead && (
                                  <span
                                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                                    aria-hidden
                                  />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-medium text-foreground">
                                    {msg.title}
                                  </p>
                                  <div className="mt-0.5 flex items-center gap-2">
                                    <Badge
                                      variant={
                                        msg.level === MessageLevel.CRITICAL
                                          ? 'destructive'
                                          : msg.level === MessageLevel.WARNING
                                            ? 'secondary'
                                            : 'outline'
                                      }
                                      className="text-[10px] font-normal"
                                    >
                                      {msg.level}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {formatDateTime(msg.createdAt, locale)}
                                    </span>
                                  </div>
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                        <Button
                          variant="link"
                          className="mt-2 h-auto p-0 text-xs"
                          asChild
                        >
                          <Link href="/player/messages" className="flex items-center gap-1">
                            <MessageSquare className="h-3.5 w-3.5" />
                            {t('allMessages')}
                          </Link>
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
