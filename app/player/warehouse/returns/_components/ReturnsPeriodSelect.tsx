'use client';

import { useRouter, usePathname } from 'next/navigation';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type SettlementOption = {
  id: string;
  payoutDayKey: string;
  periodStartDayKey: string;
  periodEndDayKey: string;
  label: string;
};

type ReturnsPeriodSelectProps = {
  settlements: SettlementOption[];
  currentSettlementId: string | null;
  buildingId: string | null;
};

export function ReturnsPeriodSelect({
  settlements,
  currentSettlementId,
  buildingId,
}: ReturnsPeriodSelectProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleChange = (value: string) => {
    const params = new URLSearchParams();
    if (buildingId) params.set('buildingId', buildingId);
    params.set('settlementId', value);
    router.push(`${pathname}?${params.toString()}`);
  };

  if (settlements.length === 0) return null;

  return (
    <Select
      value={currentSettlementId ?? settlements[0].id}
      onValueChange={handleChange}
    >
      <SelectTrigger className="w-full max-w-md">
        <SelectValue placeholder="Select period" />
      </SelectTrigger>
      <SelectContent>
        {settlements.map((s) => (
          <SelectItem key={s.id} value={s.id}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
