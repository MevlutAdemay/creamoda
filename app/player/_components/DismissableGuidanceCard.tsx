'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb } from 'lucide-react';
import type { GuidanceCard } from '@/lib/game/guidance-rules';

const EN_FALLBACK: Record<string, string> = {
  'guidance.collection.startToday.title': 'Collection Opens Today',
  'guidance.collection.startToday':
    'The {label} collection window is now open. Start adding products to build your collection.',
  'guidance.collection.startToday.cta': 'Add Products',

  'guidance.collection.startIn5d.title': 'Collection Starting Soon',
  'guidance.collection.startIn5d':
    "The {label} collection preparations begin in 5 days. I've already started the early groundwork with the design studios. When you're ready, let's start selecting products.",
  'guidance.collection.startIn5d.cta': 'Add Products',

  'guidance.collection.reminder7d.title': 'Collection Reminder',
  'guidance.collection.reminder7d':
    "It's been a week since {label} opened and you still have 0 products in the collection. If we fall behind, sourcing new-season products can become significantly more expensive.",
  'guidance.collection.reminder7d.cta': 'Go to Collection',
};

function resolveText(key: string, params?: Record<string, unknown>): string {
  let text = EN_FALLBACK[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replaceAll(`{${k}}`, String(v ?? ''));
    }
  }
  return text;
}

interface DismissableGuidanceCardProps {
  card: GuidanceCard;
  onDismiss?: () => void;
}

export function DismissableGuidanceCard({ card, onDismiss }: DismissableGuidanceCardProps) {
  const title = resolveText(`${card.messageKey}.title`, card.params);
  const body = resolveText(card.messageKey, card.params);
  const ctaLabel = resolveText(card.ctaLabelKey ?? `${card.messageKey}.cta`, card.params);

  return (
    <Card className="flex flex-col border-primary/20 min-w-[98%] lg:min-w-[50%] max-w-3xl mx-auto">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-muted-foreground" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col space-y-6">
        <p className="text-md text-muted-foreground leading-relaxed">{body}</p>
        <div className="flex flex-wrap gap-2 items-center justify-end">
          <Button asChild variant="default">
            <Link href={card.ctaHref}>{ctaLabel}</Link>
          </Button>
          {onDismiss && (
            <Button type="button" variant="outline" onClick={onDismiss}>
              Got it
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
