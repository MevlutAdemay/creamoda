'use client';

import { useState, useMemo } from 'react';
import type { CollectionsGroup } from '../_lib/types';
import { CollectionsGroupNavigator } from './CollectionsGroupNavigator';
import { DesignStudioCard } from './DesignStudioCard';

export type StudioItem = {
  id: string;
  title: string;
  styleTag: string;
  coverImageUrl: string | null;
  quality: string;
  studioType: string;
};

type CollectionsViewProps = {
  studios: StudioItem[];
  groups: CollectionsGroup[];
  season: string;
};

export function CollectionsView({ studios, groups, season }: CollectionsViewProps) {
  const [selectedGroup, setSelectedGroup] = useState<string>(groups[0]?.value ?? 'ALL');

  const filtered = useMemo(() => {
    if (selectedGroup === 'ALL') return studios;
    return studios.filter((s) => s.styleTag === selectedGroup);
  }, [studios, selectedGroup]);

  return (
    <div className="space-y-2">
    <div className="flex flex-row flex-wrap items-baseline justify-between gap-1 mb-6">
        <CollectionsGroupNavigator
          groups={groups}
          value={selectedGroup}
          onValueChange={setSelectedGroup}
        />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 mx-auto gap-1">
        {filtered.map((studio) => (
          <div key={studio.id} className="w-[390px] max-w-full mx-auto md:mx-0">
            <DesignStudioCard
              id={studio.id}
              title={studio.title}
              styleTag={studio.styleTag}
              season={season}
              coverImageUrl={studio.coverImageUrl}
              quality={studio.quality}
              studioType={studio.studioType}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
