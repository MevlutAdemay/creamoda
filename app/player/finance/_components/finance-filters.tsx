'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ChevronDown, X } from 'lucide-react';

const RANGE_OPTIONS = [
  { value: 'all', label: 'All time' },
  { value: '14d', label: 'Last 14 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'thisMonth', label: 'This month' },
  { value: 'prevMonth', label: 'Previous month' },
] as const;

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'All categories' },
  { value: 'PAYROLL', label: 'Payroll' },
  { value: 'RENT', label: 'Rent' },
  { value: 'OVERHEAD', label: 'Overhead' },
  { value: 'PROCUREMENT', label: 'Procurement' },
  { value: 'WHOLESALE', label: 'Wholesale' },
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'LOGISTICS', label: 'Logistics' },
  { value: 'PART_TIME', label: 'Part-time' },
  { value: 'CAPEX', label: 'Capex' },
  { value: 'OTHER', label: 'Other' },
];

type ScopeOption = { value: string; label: string; scopeId?: string };

type Props = {
  range: string;
  scope: string;
  scopeId: string | null;
  category: string | null;
  scopeOptions: ScopeOption[];
};

export function FinanceFilters({ range, scope, scopeId, category, scopeOptions }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [rangeOpen, setRangeOpen] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const rangeRef = useRef<HTMLDivElement>(null);
  const scopeRef = useRef<HTMLDivElement>(null);
  const categoryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (rangeRef.current && !rangeRef.current.contains(event.target as Node)) setRangeOpen(false);
      if (scopeRef.current && !scopeRef.current.contains(event.target as Node)) setScopeOpen(false);
      if (categoryRef.current && !categoryRef.current.contains(event.target as Node)) setCategoryOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const next = { range, scope, scopeId: scopeId ?? null, category: category ?? 'all' };
    Object.assign(next, updates);
    if (next.range) params.set('range', next.range);
    if (next.scope) params.set('scope', next.scope);
    if (next.scopeId) params.set('scopeId', next.scopeId);
    if (next.category && next.category !== 'all') params.set('category', next.category);
    const q = params.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
    setRangeOpen(false);
    setScopeOpen(false);
    setCategoryOpen(false);
  };

  const onScopeSelect = (val: string) => {
    if (val === 'company') {
      updateParams({ scope: 'company', scopeId: null });
      return;
    }
    const [s, id] = val.split(':');
    if (s === 'warehouse' && id) updateParams({ scope: 'warehouse', scopeId: id });
    else if (s === 'hq' && id) updateParams({ scope: 'hq', scopeId: id });
  };

  const scopeValue = scope === 'warehouse' && scopeId ? `warehouse:${scopeId}` : scope === 'hq' && scopeId ? `hq:${scopeId}` : 'company';
  const rangeLabel = RANGE_OPTIONS.find((o) => o.value === range)?.label ?? 'All time';
  const scopeLabel = scopeOptions.find((o) => (o.scopeId ? `${o.value}:${o.scopeId}` : o.value) === scopeValue)?.label ?? 'Company';
  const categoryLabel = category && category !== 'all' ? CATEGORY_OPTIONS.find((o) => o.value === category)?.label ?? category : 'All categories';

  const clearRange = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateParams({ range: 'all' });
  };
  const clearScope = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateParams({ scope: 'company', scopeId: null });
  };
  const clearCategory = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateParams({ category: null });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* Range */}
      <div className="relative" ref={rangeRef}>
        <Button
          variant="outline"
          onClick={() => { setRangeOpen(!rangeOpen); setScopeOpen(false); setCategoryOpen(false); }}
          className="gap-2 min-w-[140px] justify-between"
        >
          <span className="truncate">{rangeLabel}</span>
          <div className="flex items-center gap-1 shrink-0">
            {range !== 'all' && (
              <button type="button" onClick={clearRange} className="rounded-full p-0.5 hover:bg-muted" aria-label="Clear range">
                <X className="h-3 w-3" />
              </button>
            )}
            <ChevronDown className={`h-4 w-4 transition-transform ${rangeOpen ? 'rotate-180' : ''}`} />
          </div>
        </Button>
        {rangeOpen && (
          <div className="absolute top-full left-0 mt-2 w-[200px] bg-popover border border-border rounded-md shadow-lg z-20 py-1">
            {RANGE_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => updateParams({ range: o.value })}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${range === o.value ? 'bg-accent font-medium' : ''}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Scope */}
      <div className="relative" ref={scopeRef}>
        <Button
          variant="outline"
          onClick={() => { setScopeOpen(!scopeOpen); setRangeOpen(false); setCategoryOpen(false); }}
          className="gap-2 min-w-[140px] justify-between"
        >
          <span className="truncate">{scopeLabel}</span>
          <div className="flex items-center gap-1 shrink-0">
            {scopeValue !== 'company' && (
              <button type="button" onClick={clearScope} className="rounded-full p-0.5 hover:bg-muted" aria-label="Clear scope">
                <X className="h-3 w-3" />
              </button>
            )}
            <ChevronDown className={`h-4 w-4 transition-transform ${scopeOpen ? 'rotate-180' : ''}`} />
          </div>
        </Button>
        {scopeOpen && (
          <div className="absolute top-full left-0 mt-2 w-[200px] max-h-[280px] overflow-y-auto bg-popover border border-border rounded-md shadow-lg z-20 py-1">
            {scopeOptions.map((o) => {
              const v = o.scopeId ? `${o.value}:${o.scopeId}` : o.value;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => onScopeSelect(v)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${scopeValue === v ? 'bg-accent font-medium' : ''}`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Category */}
      <div className="relative" ref={categoryRef}>
        <Button
          variant="outline"
          onClick={() => { setCategoryOpen(!categoryOpen); setRangeOpen(false); setScopeOpen(false); }}
          className="gap-2 min-w-[140px] justify-between"
        >
          <span className="truncate">{categoryLabel}</span>
          <div className="flex items-center gap-1 shrink-0">
            {category && category !== 'all' && (
              <button type="button" onClick={clearCategory} className="rounded-full p-0.5 hover:bg-muted" aria-label="Clear category">
                <X className="h-3 w-3" />
              </button>
            )}
            <ChevronDown className={`h-4 w-4 transition-transform ${categoryOpen ? 'rotate-180' : ''}`} />
          </div>
        </Button>
        {categoryOpen && (
          <div className="absolute top-full left-0 mt-2 w-[200px] max-h-[280px] overflow-y-auto bg-popover border border-border rounded-md shadow-lg z-20 py-1">
            {CATEGORY_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => updateParams({ category: o.value === 'all' ? null : o.value })}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${(category ?? 'all') === o.value ? 'bg-accent font-medium' : ''}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
