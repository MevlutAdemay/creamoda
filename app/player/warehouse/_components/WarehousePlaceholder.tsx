'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

type WarehousePlaceholderProps = {
  title: string;
  bullets: string[];
  backHref: string;
  noWarehouse?: boolean;
};

export function WarehousePlaceholder({
  title,
  bullets,
  backHref,
  noWarehouse = false,
}: WarehousePlaceholderProps) {
  const t = useTranslations('warehouse');

  if (noWarehouse) {
    return (
      <Card className="border bg-card shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t('noWarehouseSelected')}</CardTitle>
          <CardDescription>
            {t('selectWarehouseFromOverview')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm" asChild>
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {t('backToOverview')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-muted bg-muted/20 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{t('sectionComingSoon')}</CardTitle>
        <CardDescription>
          {t('sectionComingSoonDesc')}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
        <Button asChild>
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('backToOverview')}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
