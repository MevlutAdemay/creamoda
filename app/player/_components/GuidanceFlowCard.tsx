'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TextType } from '@/components/ui/text-type';
import { Lightbulb } from 'lucide-react';
import type { GuidanceCard } from '@/lib/game/guidance-rules';

function toTValues(params?: Record<string, unknown>): Record<string, string | number> | undefined {
  if (!params) return undefined;
  return Object.fromEntries(
    Object.entries(params)
      .filter(
        (entry): entry is [string, string | number] =>
          entry[1] !== undefined && entry[1] !== null && typeof entry[1] !== 'object'
      )
      .map(([k, v]) => [k, String(v)])
  ) as Record<string, string | number>;
}

interface GuidanceFlowCardProps {
  card: GuidanceCard;
  onDismiss?: () => void;
}

export function GuidanceFlowCard({ card, onDismiss }: GuidanceFlowCardProps) {
  const t = useTranslations();
  const steps = card.steps ?? [];
  const [stepIndex, setStepIndex] = useState(0);
  const isLastStep = stepIndex >= steps.length - 1;
  const currentStep = steps[stepIndex];

  const resolveText = (key: string, params?: Record<string, unknown>) => {
    try {
      const values = toTValues(params);
      return values ? t(key, values) : t(key);
    } catch {
      return key;
    }
  };

  return (
    <Card className="flex flex-col border-primary/20 min-w-[98%] lg:min-w-[50%] max-w-3xl h-100 justify-between mx-auto">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Lightbulb className="h-5 w-5 text-muted-foreground" />
          {resolveText(card.messageKey, card.params)}
        </CardTitle>
        <CardDescription>

        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col space-y-6 justify-around h-full">
        <div className="flex flex-row gap-2">
          {currentStep && (
            <>
              {currentStep.staffName != null && (
                <span className="font-medium text-foreground">{currentStep.staffName}</span>
              )}
              {currentStep.staffName != null && ' · '}
              <span>
                {currentStep.department === 'DESIGN'
                  ? t('guidance.flow.departmentDesign')
                  : t('guidance.flow.departmentBuying')}
              </span>
            </>
          )}
        </div>
        <div className="flex flex-col gap-2">
          {currentStep && (
            <TextType
              key={stepIndex}
              as="p"
              text={resolveText(currentStep.messageKey, currentStep.params)}
              className="text-md text-muted-foreground leading-relaxed lg:text-xl"
              typingSpeed={45}
              loop={false}
              showCursor={true}
              cursorCharacter="|"
              cursorClassName="text-muted-foreground"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2 items-right justify-end">
          {!isLastStep ? (
            <Button
              type="button"
              variant="default"
              onClick={() => setStepIndex((i) => i + 1)}
            >
              {t('guidance.flow.next')}
            </Button>
          ) : (
            <>
              <Button asChild variant="default">
                <Link href={card.ctaHref}>
                  {resolveText(card.ctaLabelKey ?? 'guidance.flow.seasonKickoff.cta', card.params)}
                </Link>
              </Button>
              {onDismiss && (
                <Button type="button" variant="outline" onClick={onDismiss}>
                  Got it
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
