// app/player/providers.tsx
'use client';

import { useRef, useEffect } from 'react';
import { gsap } from 'gsap';
import { TransitionRouter } from 'next-transition-router';

const PANEL_COUNT = 10;
const STAGGER_DELAY = 0.03;
const DURATION = 0.5;
const EASE = 'power2.inOut';
const SKEW_AMOUNT = 3; // Subtle skew in degrees for shutter effect

export function PlayerTransitionProviders({ children }: { children: React.ReactNode }) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelsRef = useRef<HTMLDivElement[]>([]);

  // Initialize panels refs and set initial state
  useEffect(() => {
    if (overlayRef.current) {
      const panelElements = overlayRef.current.querySelectorAll<HTMLDivElement>('[data-panel]');
      panelsRef.current = Array.from(panelElements);
      
      // Set initial state: panels are open/invisible (scaleX: 0), overlay is hidden
      gsap.set(panelsRef.current, { 
        scaleX: 0,
        skewX: 0,
        transformOrigin: 'left center',
        force3D: true 
      });
      gsap.set(overlayRef.current, { opacity: 0, pointerEvents: 'none' });
    }
  }, []);

  const handleLeave = (next: () => void) => {
    if (!overlayRef.current || panelsRef.current.length === 0) {
      next();
      return;
    }

    // Show overlay
    gsap.set(overlayRef.current, { opacity: 1, pointerEvents: 'auto' });

    // Create timeline for closing panels (scaleX: 0 → 1) - shutter closing left→right
    const tl = gsap.timeline({
      defaults: { ease: EASE },
      onComplete: next,
    });

    // Animate panels closing left→right with subtle skew for shutter effect
    // Skew peaks mid-animation, then returns to 0 for clean closed state
    tl.to(
      panelsRef.current,
      {
        scaleX: 1,
        skewX: SKEW_AMOUNT,
        duration: DURATION * 0.6,
        stagger: STAGGER_DELAY,
        transformOrigin: 'left center',
        force3D: true,
      },
      0
    );
    
    // Remove skew smoothly as panels finish closing
    tl.to(
      panelsRef.current,
      {
        skewX: 0,
        duration: DURATION * 0.4,
        stagger: STAGGER_DELAY,
      },
      DURATION * 0.6
    );

    return () => {
      tl.kill();
    };
  };

  const handleEnter = (next: () => void) => {
    if (!overlayRef.current || panelsRef.current.length === 0) {
      next();
      return;
    }

    // Ensure overlay is visible and panels are closed (scaleX: 1) before opening
    gsap.set(overlayRef.current, { opacity: 1, pointerEvents: 'auto' });
    gsap.set(panelsRef.current, { 
      scaleX: 1,
      skewX: 0,
      transformOrigin: 'left center',
      force3D: true 
    });

    // Create timeline for opening panels (scaleX: 1 → 0) - shutter opening left→right
    const tl = gsap.timeline({
      defaults: { ease: EASE },
      onComplete: () => {
        // Hide overlay after animation completes
        gsap.set(overlayRef.current, { opacity: 0, pointerEvents: 'none' });
        // Reset panels to open state for next transition
        gsap.set(panelsRef.current, { 
          scaleX: 0,
          skewX: 0,
          transformOrigin: 'left center',
          force3D: true 
        });
        next();
      },
    });

    // Animate panels opening left→right with subtle skew for shutter effect
    // Skew peaks at the start, then returns to 0 as panels open
    tl.to(
      panelsRef.current,
      {
        skewX: SKEW_AMOUNT,
        duration: DURATION * 0.3,
        stagger: STAGGER_DELAY,
      },
      0
    );
    
    // Animate panels opening (scaleX: 1 → 0) while removing skew
    tl.to(
      panelsRef.current,
      {
        scaleX: 0,
        skewX: 0,
        duration: DURATION,
        stagger: STAGGER_DELAY,
        transformOrigin: 'left center',
        force3D: true,
      },
      DURATION * 0.2
    );

    return () => {
      tl.kill();
    };
  };

  return (
    <>
      {/* Transition Overlay - Only covers main content area, positioned relative to main */}
      <div
        ref={overlayRef}
        className="absolute inset-0 z-50 pointer-events-none opacity-0"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${PANEL_COUNT}, 1fr)`,
          gap: 0,
        }}
        aria-hidden="true"
      >
        {Array.from({ length: PANEL_COUNT }).map((_, i) => (
          <div
            key={i}
            data-panel
            className="h-full w-full bg-background"
            style={{
              transform: 'scaleX(0)',
              transformOrigin: 'left center',
            }}
          />
        ))}
      </div>

      {/* Transition Router Provider */}
      <TransitionRouter leave={handleLeave} enter={handleEnter} auto={true}>
        {children}
      </TransitionRouter>
    </>
  );
}
