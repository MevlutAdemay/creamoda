'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { StyleTag, ProductQuality } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { ChevronDown, X } from 'lucide-react';

// Helper to humanize enum labels
function humanizeLabel(value: string): string {
  return value
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

// Get all enum values as arrays
const STYLE_TAG_OPTIONS = Object.values(StyleTag);
const QUALITY_OPTIONS = Object.values(ProductQuality);

type DesignOfficesFiltersProps = {
  selectedStyleTag: string;
  selectedQuality: string;
};

export function DesignOfficesFilters({
  selectedStyleTag,
  selectedQuality,
}: DesignOfficesFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [styleTagOpen, setStyleTagOpen] = useState(false);
  const [qualityOpen, setQualityOpen] = useState(false);
  const styleTagRef = useRef<HTMLDivElement>(null);
  const qualityRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        styleTagRef.current &&
        !styleTagRef.current.contains(event.target as Node)
      ) {
        setStyleTagOpen(false);
      }
      if (
        qualityRef.current &&
        !qualityRef.current.contains(event.target as Node)
      ) {
        setQualityOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (value === 'ALL') {
      params.delete(key);
    } else {
      params.set(key, value);
    }

    const newUrl = params.toString()
      ? `/player/designoffices?${params.toString()}`
      : '/player/designoffices';
    
    router.replace(newUrl);
    setStyleTagOpen(false);
    setQualityOpen(false);
  };

  const getStyleTagLabel = () => {
    if (selectedStyleTag === 'ALL') return 'All Styles';
    return humanizeLabel(selectedStyleTag);
  };

  const getQualityLabel = () => {
    if (selectedQuality === 'ALL') return 'All Qualities';
    return humanizeLabel(selectedQuality);
  };

  const clearStyleTag = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateFilter('styleTag', 'ALL');
  };

  const clearQuality = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateFilter('quality', 'ALL');
  };

  return (
    <div className="sticky top-0 z-10 bg-transparent px-6 py-2 mb-2">
      <div className="flex flex-wrap gap-3 items-center">
        {/* Style Tag Filter */}
        <div className="relative" ref={styleTagRef}>
          <Button
            variant="outline"
            onClick={() => {
              setStyleTagOpen(!styleTagOpen);
              setQualityOpen(false);
            }}
            className="gap-2 min-w-[140px] justify-between"
          >
            <span className="truncate">{getStyleTagLabel()}</span>
            <div className="flex items-center gap-1 shrink-0">
              {selectedStyleTag !== 'ALL' && (
                <button
                  onClick={clearStyleTag}
                  className="rounded-full p-0.5 hover:bg-muted"
                  aria-label="Clear style tag filter"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  styleTagOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
          </Button>
          {styleTagOpen && (
            <div className="absolute top-full left-0 mt-2 w-[200px] bg-popover border border-border rounded-md shadow-lg z-20 py-1">
              <button
                onClick={() => updateFilter('styleTag', 'ALL')}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${
                  selectedStyleTag === 'ALL'
                    ? 'bg-accent font-medium'
                    : ''
                }`}
              >
                All Styles
              </button>
              {STYLE_TAG_OPTIONS.map((tag) => (
                <button
                  key={tag}
                  onClick={() => updateFilter('styleTag', tag)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${
                    selectedStyleTag === tag ? 'bg-accent font-medium' : ''
                  }`}
                >
                  {humanizeLabel(tag)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quality Filter */}
        <div className="relative" ref={qualityRef}>
          <Button
            variant="outline"
            onClick={() => {
              setQualityOpen(!qualityOpen);
              setStyleTagOpen(false);
            }}
            className="gap-2 min-w-[140px] justify-between"
          >
            <span className="truncate">{getQualityLabel()}</span>
            <div className="flex items-center gap-1 shrink-0">
              {selectedQuality !== 'ALL' && (
                <button
                  onClick={clearQuality}
                  className="rounded-full p-0.5 hover:bg-muted"
                  aria-label="Clear quality filter"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  qualityOpen ? 'rotate-180' : ''
                }`}
              />
            </div>
          </Button>
          {qualityOpen && (
            <div className="absolute top-full left-0 mt-2 w-[200px] bg-popover border border-border rounded-md shadow-lg z-20 py-1">
              <button
                onClick={() => updateFilter('quality', 'ALL')}
                className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${
                  selectedQuality === 'ALL'
                    ? 'bg-accent font-medium'
                    : ''
                }`}
              >
                All Qualities
              </button>
              {QUALITY_OPTIONS.map((quality) => (
                <button
                  key={quality}
                  onClick={() => updateFilter('quality', quality)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-accent transition-colors ${
                    selectedQuality === quality ? 'bg-accent font-medium' : ''
                  }`}
                >
                  {humanizeLabel(quality)}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
