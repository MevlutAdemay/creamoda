// creamoda/app/player/finance/settlements/_components/settlements-filters.tsx

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronDown, X } from 'lucide-react';

type WarehouseOption = { value: string; label: string; buildingId: string };

type Props = {
  group: string;
  warehouseBuildingId: string | null;
  warehouseOptions: WarehouseOption[];
};

export function SettlementsFilters({ group, warehouseBuildingId, warehouseOptions }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [groupOpen, setGroupOpen] = useState(false);
  const [warehouseOpen, setWarehouseOpen] = useState(false);
  const groupRef = useRef<HTMLDivElement>(null);
  const warehouseRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (groupRef.current && !groupRef.current.contains(event.target as Node)) setGroupOpen(false);
      if (warehouseRef.current && !warehouseRef.current.contains(event.target as Node)) setWarehouseOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const next = { group, warehouseBuildingId: warehouseBuildingId ?? null };
    Object.assign(next, updates);
    if (next.group) params.set('group', next.group);
    if (next.warehouseBuildingId) params.set('warehouseBuildingId', next.warehouseBuildingId);
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
    setGroupOpen(false);
    setWarehouseOpen(false);
  };

  const groupLabel = group === 'warehouse' ? 'Warehouse' : 'Company';
  const warehouseLabel = warehouseBuildingId
    ? warehouseOptions.find((o) => o.buildingId === warehouseBuildingId)?.label ?? warehouseBuildingId
    : 'All warehouses';

  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative" ref={groupRef}>
        <Button
          variant="outline"
          onClick={() => { setGroupOpen(!groupOpen); setWarehouseOpen(false); }}
          className="gap-2 min-w-[140px] justify-between"
        >
          <span className="truncate">{groupLabel}</span>
          <ChevronDown className={`h-4 w-4 transition-transform ${groupOpen ? 'rotate-180' : ''}`} />
        </Button>
        {groupOpen && (
          <div className="absolute top-full left-0 mt-2 w-[200px] bg-popover border border-border rounded-md shadow-lg z-20 py-1">
            <button
              type="button"
              onClick={() => updateParams({ group: 'company', warehouseBuildingId: null })}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${group === 'company' ? 'bg-accent font-medium' : ''}`}
            >
              Company
            </button>
            <button
              type="button"
              onClick={() => updateParams({ group: 'warehouse' })}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${group === 'warehouse' ? 'bg-accent font-medium' : ''}`}
            >
              Warehouse
            </button>
          </div>
        )}
      </div>

      {group === 'warehouse' && (
        <div className="relative" ref={warehouseRef}>
          <Button
            variant="outline"
            onClick={() => setWarehouseOpen(!warehouseOpen)}
            className="gap-2 min-w-[140px] justify-between"
          >
            <span className="truncate">{warehouseLabel}</span>
            <div className="flex items-center gap-1 shrink-0">
              {warehouseBuildingId && (
                <button type="button" onClick={(e) => { e.stopPropagation(); updateParams({ warehouseBuildingId: null }); }} className="rounded-full p-0.5 hover:bg-muted" aria-label="Clear warehouse">
                  <X className="h-3 w-3" />
                </button>
              )}
              <ChevronDown className={`h-4 w-4 transition-transform ${warehouseOpen ? 'rotate-180' : ''}`} />
            </div>
          </Button>
          {warehouseOpen && (
            <div className="absolute top-full left-0 mt-2 w-[200px] max-h-[280px] overflow-y-auto bg-popover border border-border rounded-md shadow-lg z-20 py-1">
              <button
                type="button"
                onClick={() => updateParams({ warehouseBuildingId: null })}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${!warehouseBuildingId ? 'bg-accent font-medium' : ''}`}
              >
                All warehouses
              </button>
              {warehouseOptions.map((o) => (
                <button
                  key={o.buildingId}
                  type="button"
                  onClick={() => updateParams({ warehouseBuildingId: o.buildingId })}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${warehouseBuildingId === o.buildingId ? 'bg-accent font-medium' : ''}`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
