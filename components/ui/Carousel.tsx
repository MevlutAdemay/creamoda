'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export interface CarouselItem {
  title: string;
  description: string;
  id: number;
  icon: React.ReactNode;
}

export interface CarouselProps<T = CarouselItem> {
  items?: T[];
  /** When provided, each slide renders this instead of the default card. */
  renderItem?: (item: T, index: number) => React.ReactNode;
  baseWidth?: number;
  /** Controlled selected slide index. */
  selectedIndex?: number;
  /** Called when user changes slide (prev/next/dot). */
  onSlideChange?: (index: number) => void;
  className?: string;
}

export default function Carousel<T = CarouselItem>({
  items = [] as T[],
  renderItem,
  baseWidth = 320,
  selectedIndex = 0,
  onSlideChange,
  className = '',
}: CarouselProps<T>): React.ReactElement {
  const count = items.length;
  const [index, setIndex] = useState(selectedIndex);

  const current = Math.max(0, Math.min(index, count - 1));
  const goPrev = useCallback(() => {
    const next = count <= 1 ? 0 : (current - 1 + count) % count;
    setIndex(next);
    onSlideChange?.(next);
  }, [count, current, onSlideChange]);

  const goNext = useCallback(() => {
    const next = count <= 1 ? 0 : (current + 1) % count;
    setIndex(next);
    onSlideChange?.(next);
  }, [count, current, onSlideChange]);

  useEffect(() => {
    setIndex(Math.max(0, Math.min(selectedIndex, count - 1)));
  }, [selectedIndex, count]);

  if (count === 0) {
    return (
      <div className={`flex items-center justify-center rounded-xl border border-border p-8 ${className}`}>
        <p className="text-sm text-muted-foreground">No items</p>
      </div>
    );
  }

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-xl border border-border bg-card select-none ${className}`}
      style={{ width: baseWidth, maxWidth: '100%' }}
    >
      {/* Slide area */}
      <div className="relative w-full overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{
            width: `${count * 100}%`,
            transform: `translateX(-${current * (100 / count)}%)`,
          }}
        >
          {items.map((item, i) => (
            <div
              key={i}
              className="flex shrink-0 items-stretch justify-center p-3"
              style={{ width: `${100 / count}%` }}
            >
              {renderItem ? (
                renderItem(item, i)
              ) : (
                <div className="flex w-full items-center justify-center rounded-lg bg-muted p-6 text-muted-foreground">
                  Slide {i + 1}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Prev / Next */}
      <div className="absolute inset-y-0 left-0 flex items-center pl-1">
        <button
          type="button"
          onClick={goPrev}
          disabled={count <= 1}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          aria-label="Previous slide"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
      </div>
      <div className="absolute inset-y-0 right-0 flex items-center pr-1">
        <button
          type="button"
          onClick={goNext}
          disabled={count <= 1}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-background shadow-sm transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
          aria-label="Next slide"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Dots */}
      <div className="flex w-full justify-center gap-1.5 pb-3 pt-1">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => {
              setIndex(i);
              onSlideChange?.(i);
            }}
            className={`h-2 rounded-full transition-all duration-200 ${
              i === current
                ? 'w-5 bg-primary'
                : 'w-2 bg-muted-foreground/40 hover:bg-muted-foreground/60'
            }`}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={i === current ? 'true' : undefined}
          />
        ))}
      </div>
    </div>
  );
}
