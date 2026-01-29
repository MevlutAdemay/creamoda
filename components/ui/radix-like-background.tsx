// components/ui/radix-like-background.tsx

'use client';

import React from 'react';

type Props = {
  className?: string;
};

/**
 * Radix-like background with refined blob composition
 * - Left: subtle diagonal wedge (using --primary)
 * - Right bottom: large base blob (using --secondary) - improved shape
 * - Right top: small accent blob (using --accent)
 * 
 * Enhanced with:
 * - Subtle depth via SVG shadows
 * - Premium grain/noise texture overlay
 * - Gentle slow drift motion (respects prefers-reduced-motion)
 * 
 * Colors are driven by CSS variables from theme system
 */
export function RadixLikeBackground({ className = '' }: Props) {
  return (
    <div
      aria-hidden="true"
      className={[
        'pointer-events-none fixed inset-0 -z-10 overflow-hidden',
        'bg-background',
        className,
      ].join(' ')}
      style={{
        '--bg-light': '#fafbfc',
        '--bg-dark': '#0a0d0c',
      } as React.CSSProperties}
    >
      {/* LIGHT MODE */}
      <svg
        className="absolute inset-0 h-full w-full dark:hidden"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Shadow filters for depth */}
          <filter id="light-shadow-subtle" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="8" />
            <feOffset dx="2" dy="4" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.12" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="light-shadow-medium" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="12" />
            <feOffset dx="3" dy="6" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.15" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* LEFT blob - using PRIMARY with light tint */}
          <linearGradient id="light-left-blob" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.3" />
          </linearGradient>

          {/* RIGHT BOTTOM blob - using SECONDARY */}
          <linearGradient id="light-right-bottom-blob" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.5" />
          </linearGradient>

          {/* RIGHT TOP blob - using ACCENT */}
          <linearGradient id="light-right-top-blob" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.4" />
          </linearGradient>
        </defs>

        <g className="mv-drift-slow">
          {/* 1) LEFT TOP - Sol üstten ortaya kadar gelen Radix rectangle */}
          <g className="mv-drift-slow">
            <g transform="translate(-480, -100) scale(0.75) rotate(-25 500 500)">
              <rect
                x="349.356"
                y="-138"
                width="910.264"
                height="910.264"
                rx="224"
                transform="rotate(28.2673 349.356 -138)"
                fill="url(#light-left-blob)"
                opacity="0.38"
                filter="url(#light-shadow-subtle)"
              />
            </g>
          </g>

          {/* 2) RIGHT BOTTOM - Sağ alttan merkeze doğru gelen Radix rectangle */}
          <g className="mv-drift-bottom">
            <g transform="translate(680, 280) scale(0.85) rotate(35 500 500)">
              <rect
                x="349.356"
                y="-138"
                width="910.264"
                height="910.264"
                rx="224"
                transform="rotate(28.2673 349.356 -138)"
                fill="url(#light-right-bottom-blob)"
                opacity="0.65"
                filter="url(#light-shadow-medium)"
              />
            </g>
          </g>

          {/* 3) RIGHT TOP - Sağ üste dayalı Radix rectangle */}
          <g className="mv-drift-top">
            <g transform="translate(900, -200) scale(0.70) rotate(-15 500 500)">
              <rect
                x="349.356"
                y="-138"
                width="910.264"
                height="910.264"
                rx="224"
                transform="rotate(28.2673 349.356 -138)"
                fill="url(#light-right-top-blob)"
                opacity="0.60"
                filter="url(#light-shadow-subtle)"
              />
            </g>
          </g>
        </g>
      </svg>

      {/* DARK MODE */}
      <svg
        className="absolute inset-0 hidden h-full w-full dark:block"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Shadow filters for depth - darker, more subtle */}
          <filter id="dark-shadow-subtle" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="12" />
            <feOffset dx="2" dy="4" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.08" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="dark-shadow-medium" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceAlpha" stdDeviation="18" />
            <feOffset dx="3" dy="6" result="offsetblur" />
            <feComponentTransfer>
              <feFuncA type="linear" slope="0.10" />
            </feComponentTransfer>
            <feMerge>
              <feMergeNode />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* LEFT blob - using PRIMARY with dark tint */}
          <linearGradient id="dark-left-blob" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.2" />
          </linearGradient>

          {/* RIGHT BOTTOM blob - using SECONDARY */}
          <linearGradient id="dark-right-bottom-blob" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--secondary)" stopOpacity="0.7" />
            <stop offset="100%" stopColor="var(--secondary)" stopOpacity="0.4" />
          </linearGradient>

          {/* RIGHT TOP blob - using ACCENT */}
          <linearGradient id="dark-right-top-blob" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        <g className="mv-drift-slow">
          {/* 1) LEFT TOP - Sol üstten ortaya kadar gelen Radix rectangle */}
          <g className="mv-drift-slow">
            <g transform="translate(-480, -100) scale(0.75) rotate(-25 500 500)">
              <rect
                x="349.356"
                y="-138"
                width="910.264"
                height="910.264"
                rx="224"
                transform="rotate(28.2673 349.356 -138)"
                fill="url(#dark-left-blob)"
                opacity="0.30"
                filter="url(#dark-shadow-subtle)"
              />
            </g>
          </g>

          {/* 2) RIGHT BOTTOM - Sağ alttan merkeze doğru gelen Radix rectangle */}
          <g className="mv-drift-bottom">
            <g transform="translate(680, 280) scale(0.85) rotate(35 500 500)">
              <rect
                x="349.356"
                y="-138"
                width="910.264"
                height="910.264"
                rx="224"
                transform="rotate(28.2673 349.356 -138)"
                fill="url(#dark-right-bottom-blob)"
                opacity="0.50"
                filter="url(#dark-shadow-medium)"
              />
            </g>
          </g>

          {/* 3) RIGHT TOP - Sağ üste dayalı Radix rectangle */}
          <g className="mv-drift-top">
            <g transform="translate(900, -200) scale(0.70) rotate(-15 500 500)">
              <rect
                x="349.356"
                y="-138"
                width="910.264"
                height="910.264"
                rx="224"
                transform="rotate(28.2673 349.356 -138)"
                fill="url(#dark-right-top-blob)"
                opacity="0.45"
                filter="url(#dark-shadow-subtle)"
              />
            </g>
          </g>
        </g>
      </svg>

      {/* Grain/Noise Overlay - Premium texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.04] dark:opacity-[0.05] mix-blend-soft-light"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
        }}
        aria-hidden="true"
      />

      {/* CSS Animations */}
      <style jsx>{`
        /* Slow drift animation - very subtle */
        @keyframes mv-drift-slow {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          25% {
            transform: translate(12px, 8px) rotate(0.5deg);
          }
          50% {
            transform: translate(8px, 16px) rotate(1deg);
          }
          75% {
            transform: translate(16px, 10px) rotate(0.5deg);
          }
        }

        @keyframes mv-drift-top {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(-8px, 6px) rotate(-0.3deg);
          }
          66% {
            transform: translate(6px, 12px) rotate(0.3deg);
          }
        }

        @keyframes mv-drift-bottom {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          40% {
            transform: translate(10px, -6px) rotate(0.8deg);
          }
          80% {
            transform: translate(-4px, 14px) rotate(-0.4deg);
          }
        }

        .mv-drift-slow {
          animation: mv-drift-slow 32s ease-in-out infinite;
          transform-origin: center center;
        }

        .mv-drift-top {
          animation: mv-drift-top 28s ease-in-out infinite;
          transform-origin: center center;
        }

        .mv-drift-bottom {
          animation: mv-drift-bottom 36s ease-in-out infinite;
          transform-origin: center center;
        }

        /* Respect prefers-reduced-motion */
        @media (prefers-reduced-motion: reduce) {
          .mv-drift-slow,
          .mv-drift-top,
          .mv-drift-bottom {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}