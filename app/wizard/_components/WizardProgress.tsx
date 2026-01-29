// app/wizard/_components/WizardProgress.tsx
/**
 * Wizard Progress Indicator
 * Shows the current step and overall progress
 */

'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export type WizardStep = 'company' | 'review' | 'process' | 'done';

interface WizardProgressProps {
  currentStep: WizardStep;
}

const STEPS: { key: WizardStep; label: string; description: string }[] = [
  { key: 'company', label: 'Şirket', description: 'Şirket bilgileri' },
  { key: 'review', label: 'İnceleme', description: 'Kurulum özeti' },
  { key: 'process', label: 'İşlem', description: 'Kurulum işleniyor' },
  { key: 'done', label: 'Tamamlandı', description: 'Hazırsınız!' },
];

function getStepIndex(step: WizardStep): number {
  return STEPS.findIndex((s) => s.key === step);
}

export default function WizardProgress({ currentStep }: WizardProgressProps) {
  const currentIndex = getStepIndex(currentStep);

  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <div key={step.key} className="flex items-center flex-1">
              {/* Step indicator */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                    {
                      'bg-primary text-primary-foreground': isCompleted || isCurrent,
                      'bg-muted text-muted-foreground': isPending,
                    }
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={cn('text-sm font-medium', {
                      'text-primary': isCurrent,
                      'text-muted-foreground': !isCurrent,
                    })}
                  >
                    {step.label}
                  </p>
                  <p className="text-xs text-muted-foreground hidden sm:block">
                    {step.description}
                  </p>
                </div>
              </div>

              {/* Connector line */}
              {index < STEPS.length - 1 && (
                <div
                  className={cn('flex-1 h-0.5 mx-2', {
                    'bg-primary': index < currentIndex,
                    'bg-muted': index >= currentIndex,
                  })}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
