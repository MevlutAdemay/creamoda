'use client';

import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import type { CatalogProduct, CatalogGroup } from '../_lib/types';
import { GroupNavigator } from './GroupNavigator';
import { ProductGrid } from './ProductGrid';

type CatalogViewProps = {
  products: CatalogProduct[];
  groups: CatalogGroup[];
};

export function CatalogView({ products, groups }: CatalogViewProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>(groups[0]?.value ?? 'ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let list = products;
    if (selectedGroup !== 'ALL') {
      list = list.filter((p) => p.manufacturingGroup === selectedGroup);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.code.toLowerCase().includes(q) ||
          p.templateCode.toLowerCase().includes(q)
      );
    }
    return list;
  }, [products, selectedGroup, searchQuery]);

  return (
    <div className="space-y-4">
      <GroupNavigator
        groups={groups}
        value={selectedGroup}
        onValueChange={setSelectedGroup}
      />
      <div className="flex items-center gap-4">
        <Input
          type="search"
          placeholder="Search by name or code..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-sm"
        />
      </div>
      <div className="mt-4">
        <ProductGrid products={filtered} />
      </div>
    </div>
  );
}
