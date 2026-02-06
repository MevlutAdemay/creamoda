'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronDown, X } from 'lucide-react';

type WarehouseOption = {
  id: string;
  role: string;
  marketZone: string | null;
};

type PerformanceWarehouseSelectProps = {
  warehouses: WarehouseOption[];
  currentBuildingId: string | null;
};

function roleLabel(role: string): string {
  return role === 'HQ' ? 'HQ' : role === 'WAREHOUSE' ? 'Warehouse' : role.replace(/_/g, ' ');
}

function warehouseLabel(w: WarehouseOption): string {
  const role = roleLabel(w.role);
  const zone = w.marketZone?.trim().replace(/_/g, ' ');
  return zone ? `${role} – ${zone}` : role;
}

export function PerformanceWarehouseSelect({
  warehouses,
  currentBuildingId,
}: PerformanceWarehouseSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const value = currentBuildingId ?? warehouses[0]?.id ?? '';
  const selectedWarehouse = warehouses.find((w) => w.id === value);
  const displayLabel = selectedWarehouse ? warehouseLabel(selectedWarehouse) : 'Select warehouse';
  const isFirstWarehouse = value === warehouses[0]?.id;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (buildingId: string) => {
    const params = new URLSearchParams();
    if (buildingId) params.set('warehouseId', buildingId);
    const url = params.toString() ? `${pathname}?${params}` : pathname;
    router.push(url);
    setOpen(false);
  };

  if (warehouses.length === 0) return null;

  return (
    <div className="relative flex items-center gap-2" ref={ref}>
      <span className="text-sm text-foreground whitespace-nowrap">Warehouse</span>
      <Button
        variant="outline"
        onClick={() => setOpen(!open)}
        className="gap-2 min-w-[180px] justify-between"
      >
        <span className="truncate">{displayLabel}</span>
        <div className="flex items-center gap-1 shrink-0">
          {!isFirstWarehouse && value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                warehouses[0] && handleSelect(warehouses[0].id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  warehouses[0] && handleSelect(warehouses[0].id);
                }
              }}
              className="rounded-full p-0.5 hover:bg-muted cursor-pointer inline-flex"
              aria-label="Reset to first warehouse"
            >
              <X className="h-3 w-3" />
            </span>
          )}
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </Button>
      {open && (
        <div className="absolute top-full right-0 mt-2 min-w-[200px] max-w-[260px] bg-popover border border-border rounded-md shadow-lg z-20 py-1 max-h-[280px] overflow-y-auto">
          {warehouses.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => handleSelect(w.id)}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${
                value === w.id ? 'bg-accent font-medium' : ''
              }`}
            >
              {warehouseLabel(w)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
