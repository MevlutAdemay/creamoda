'use client';

import Carousel from '@/components/ui/Carousel';
import { PackageCard, type PackageItem } from './PackageCard';

type Props = {
  packages: PackageItem[];
  value: string;
  onChange: (packageId: string) => void;
  formatUsd: (v: string) => string;
  loading?: boolean;
};

export function PackageCarousel({
  packages,
  value,
  onChange,
  formatUsd,
  loading,
}: Props) {
  const sortedPackages = [...packages].sort((a, b) => a.sortIndex - b.sortIndex);
  const selectedIndex = sortedPackages.findIndex((p) => p.id === value);
  const safeSelectedIndex = selectedIndex >= 0 ? selectedIndex : 0;

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground select-none cursor-default py-4">
        Loading packages…
      </p>
    );
  }
  if (sortedPackages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground select-none cursor-default py-4">
        No packages available.
      </p>
    );
  }

  return (
    <div className="w-full flex justify-center">
      <Carousel<PackageItem>
        items={sortedPackages}
        baseWidth={380}
        selectedIndex={safeSelectedIndex}
        onSlideChange={(index) => {
          const pkg = sortedPackages[index];
          if (pkg) onChange(pkg.id);
        }}
        renderItem={(pkg, index) => (
          <div className="w-full h-full flex items-stretch justify-center pl-6 pr-6">
            <PackageCard
              pkg={pkg}
              selected={value === pkg.id}
              isActive={index === safeSelectedIndex}
              formatUsd={formatUsd}
              onSelect={() => onChange(pkg.id)}
            />
          </div>
        )}
      />
    </div>
  );
}

type PackageGridProps = Props & {
  className?: string;
};

export function PackageGrid({
  packages,
  value,
  onChange,
  formatUsd,
  loading,
  className,
}: PackageGridProps) {
  const sortedPackages = [...packages].sort((a, b) => a.sortIndex - b.sortIndex);

  if (loading) {
    return (
      <p className="text-sm text-muted-foreground select-none cursor-default py-4">
        Loading packages…
      </p>
    );
  }
  if (sortedPackages.length === 0) {
    return (
      <p className="text-sm text-muted-foreground select-none cursor-default py-4">
        No packages available.
      </p>
    );
  }

  return (
    <div className={className}>
      {sortedPackages.map((pkg) => (
        <PackageCard
          key={pkg.id}
          pkg={pkg}
          selected={value === pkg.id}
          formatUsd={formatUsd}
          onSelect={() => onChange(pkg.id)}
        />
      ))}
    </div>
  );
}
