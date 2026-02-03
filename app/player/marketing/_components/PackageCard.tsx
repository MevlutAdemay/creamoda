
'use client';

import { cn } from '@/lib/utils';

export type PackageItem = {
  id: string;
  key: string;
  title: string;
  durationDays: number;
  positiveBoostPct: number;
  priceUsd: string;
  awarenessGainDec: string;
  sortIndex: number;
};

const PACKAGE_MEANING: Record<string, string> = {
  STARTER: 'Low risk test',
  BASIC: 'Steady visibility',
  STANDARD: 'Best ROI',
  PRO: 'Aggressive push',
  ELITE: 'Maximum exposure',
};

function getMeaning(key: string): string {
  const k = (key ?? '').toUpperCase();
  return PACKAGE_MEANING[k] ?? '';
}

function isPopular(key: string): boolean {
  return (key ?? '').toUpperCase() === 'STANDARD';
}

type Props = {
  pkg: PackageItem;
  selected: boolean;
  formatUsd: (v: string) => string;
  onSelect: () => void;
  /** When false (e.g. carousel inactive slide), card is slightly faded/smaller. Omit or true for grid. */
  isActive?: boolean;
};

export function PackageCard({ pkg, selected, formatUsd, onSelect, isActive = true }: Props) {
  const meaning = getMeaning(pkg.key);
  const popular = isPopular(pkg.key);

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'relative flex flex-col h-full min-h-[230px] sm:min-h-[210px] w-full min-w-0 rounded-lg border p-4 text-left transition-all select-none cursor-pointer',
        'hover:border-primary/50 hover:bg-muted/20',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        selected && 'border-primary bg-primary/5 ring-2 ring-primary/30',
        !isActive && 'opacity-70 scale-[0.98]'
      )}
    >
      {popular && (
        <span className="absolute top-2 right-2 rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary select-none cursor-default whitespace-nowrap">
          Popular
        </span>
      )}
      <span className="font-medium text-sm leading-snug select-none cursor-default truncate pr-12">
        {pkg.title}
      </span>
      <div className="mt-2 text-lg font-semibold tabular-nums leading-snug select-none cursor-default">
        +{pkg.positiveBoostPct}%
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground leading-snug select-none cursor-default truncate">
        {pkg.durationDays} days
      </div>
      <div className="mt-3 text-sm font-semibold leading-snug select-none cursor-default truncate">
        Price: {formatUsd(pkg.priceUsd)} base
      </div>
      <div className="mt-2 text-xs text-muted-foreground leading-snug select-none cursor-default line-clamp-1">
        Permanent: +{pkg.awarenessGainDec} Awareness
      </div>
      {meaning && (
        <div className="mt-2 text-xs text-muted-foreground leading-snug select-none cursor-default line-clamp-2">
          {meaning}
        </div>
      )}
      <div className="mt-auto pt-4 shrink-0">
        <span
          className={cn(
            'inline-block rounded border px-2 py-1 text-xs font-medium select-none cursor-default',
            selected
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-muted-foreground/30 text-muted-foreground'
          )}
        >
          {selected ? 'Selected' : 'Select'}
        </span>
      </div>
    </button>
  );
}
