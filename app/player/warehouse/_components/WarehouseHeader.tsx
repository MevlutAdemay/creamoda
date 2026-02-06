// creamoda/app/player/warehouse/_components/WarehouseHeader.tsx
'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WarehouseSelect } from './WarehouseSelect';

export type WarehouseHeaderTab =
  | 'overview'
  | 'stock'
  | 'logistics'
  | 'returns'
  | 'reports';

type WarehouseOption = {
  id: string;
  role: string;
  marketZone: string | null;
};

type WarehouseHeaderProps = {
  warehouses: WarehouseOption[];
  currentBuildingId: string | null;
  activeTab: WarehouseHeaderTab;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Params to preserve when changing warehouse (e.g. { tab: 'inventory' }) */
  preserveParams?: Record<string, string>;
};

const BASE_PATH = '/player/warehouse';

export function WarehouseHeader({
  warehouses,
  currentBuildingId,
  activeTab,
  title,
  description,
  preserveParams,
}: WarehouseHeaderProps) {
  const t = useTranslations('warehouse.tabs');
  const tabQuery = currentBuildingId
    ? `?buildingId=${encodeURIComponent(currentBuildingId)}`
    : '';

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {(title ?? description) && (
          <div>
            {title}
            {description && <div className="mt-1 text-muted-foreground">{description}</div>}
          </div>
        )}
        <div className="flex justify-end">
          <WarehouseSelect
            warehouses={warehouses}
            currentBuildingId={currentBuildingId}
            preserveParams={preserveParams}
          />
        </div>
      </div>

      <Tabs value={activeTab} className="w-full">
        <TabsList className="flex w-full flex-wrap gap-1 bg-muted/50">
          <TabsTrigger value="overview" asChild>
            <Link href={`${BASE_PATH}${tabQuery}`}>{t('overview')}</Link>
          </TabsTrigger>
          <TabsTrigger value="stock" asChild>
            <Link href={`${BASE_PATH}/stock${tabQuery}`}>{t('stock')}</Link>
          </TabsTrigger>
          <TabsTrigger value="logistics" asChild>
            <Link href={`${BASE_PATH}/logistics${tabQuery}`}>{t('logistics')}</Link>
          </TabsTrigger>
          <TabsTrigger value="returns" asChild>
            <Link href={`${BASE_PATH}/returns${tabQuery}`}>{t('returns')}</Link>
          </TabsTrigger>
          <TabsTrigger value="reports" asChild>
            <Link href={`${BASE_PATH}/reports${tabQuery}`}>{t('reports')}</Link>
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  );
}
