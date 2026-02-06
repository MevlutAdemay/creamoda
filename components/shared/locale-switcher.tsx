'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { locales, type Locale } from '@/i18n/config';
import { cn } from '@/lib/utils';

const LABELS: Record<Locale, string> = { tr: 'TR', en: 'EN' };

export function LocaleSwitcher() {
  const current = useLocale() as Locale;
  const router = useRouter();

  const switchTo = (next: Locale) => {
    if (next === current) return;
    document.cookie = `NEXT_LOCALE=${next};path=/;max-age=31536000`;
    router.refresh();
  };

  return (
    <div className="inline-flex items-center rounded-md border border-border/60 bg-muted/40 p-0.5">
      {locales.map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => switchTo(l)}
          className={cn(
            'px-2 py-1 text-xs font-medium rounded-sm transition-colors',
            l === current
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {LABELS[l]}
        </button>
      ))}
    </div>
  );
}
