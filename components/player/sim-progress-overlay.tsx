// components/player/sim-progress-overlay.tsx

'use client';

import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ModaVerseLogoLoader } from '@/components/ui/ModaVerseLogoLoader';

interface SimProgressOverlayProps {
  title: string;
  steps: string[];
}

export function SimProgressOverlay({ title, steps }: SimProgressOverlayProps) {
  const textRef = useRef<HTMLParagraphElement>(null);
  const indexRef = useRef<HTMLSpanElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);

  useEffect(() => {
    const el = textRef.current;
    const idxEl = indexRef.current;
    if (!el || steps.length === 0) return;

    // Build a looping GSAP timeline cycling through all steps
    const tl = gsap.timeline({ repeat: -1 });
    tlRef.current = tl;

    for (let i = 0; i < steps.length; i++) {
      const stepText = steps[i]!;
      const stepNum = `${i + 1}/${steps.length}`;

      // Set text + slide in
      tl.call(() => {
        el.textContent = stepText;
        if (idxEl) idxEl.textContent = stepNum;
      });
      tl.fromTo(el, { x: 24, opacity: 0 }, { x: 0, opacity: 1, duration: 0.25, ease: 'power2.out' });
      // Hold
      tl.to(el, { duration: 0.15 });
      // Slide out
      tl.to(el, { x: -12, opacity: 0, duration: 0.2, ease: 'power2.in' });
    }

    return () => {
      tl.kill();
      tlRef.current = null;
    };
  }, [steps]);

  return (
    <div className="fixed inset-0 z-80 flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <div className="w-[min(520px,92vw)] rounded-2xl border bg-background p-6 shadow-xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <ModaVerseLogoLoader size={28} />
          <h2 className="text-base font-semibold">{title}</h2>
        </div>

        {/* Animated step area */}
        <div className="relative h-10 overflow-hidden flex items-center">
          <p
            ref={textRef}
            className="text-sm text-muted-foreground whitespace-nowrap"
            style={{ opacity: 0 }}
          />
        </div>

        {/* Step counter */}
        <div className="mt-3 flex justify-end">
          <span
            ref={indexRef}
            className="text-xs font-mono text-muted-foreground/60 tabular-nums"
          />
        </div>
      </div>
    </div>
  );
}
