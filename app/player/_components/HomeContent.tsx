'use client';

import { useState, useEffect, useCallback, type ReactNode } from 'react';
import type { GuidanceCard } from '@/lib/game/guidance-rules';
import { GuidanceFlowCard } from './GuidanceFlowCard';
import { DismissableGuidanceCard } from './DismissableGuidanceCard';

function getDismissKey(card: GuidanceCard): string {
  return `GUIDE_UI_DISMISS:${card.id}`;
}

interface HomeContentProps {
  guidanceCards: GuidanceCard[];
  children: ReactNode;
}

export function HomeContent({ guidanceCards, children }: HomeContentProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = new Set<string>();
    for (const card of guidanceCards) {
      if (localStorage.getItem(getDismissKey(card)) === '1') {
        ids.add(card.id);
      }
    }
    if (ids.size > 0) setDismissedIds(ids);
  }, [guidanceCards]);

  const handleDismiss = useCallback(
    (card: GuidanceCard) => {
      localStorage.setItem(getDismissKey(card), '1');
      setDismissedIds((prev) => new Set([...prev, card.id]));
    },
    []
  );

  const activeCards = guidanceCards.filter((c) => !dismissedIds.has(c.id));

  if (activeCards.length > 0) {
    return (
      <section className="mb-6 space-y-3">
        <h2 className="text-sm font-medium text-muted-foreground">Guidance</h2>
        <div className="grid grid-cols-1 gap-3">
          {activeCards.map((card) =>
            card.uiVariant === 'FLOW' ? (
              <GuidanceFlowCard
                key={card.id}
                card={card}
                onDismiss={() => handleDismiss(card)}
              />
            ) : (
              <DismissableGuidanceCard
                key={card.id}
                card={card}
                onDismiss={() => handleDismiss(card)}
              />
            )
          )}
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
