// components/player/designoffices/VerifiedBadge.tsx

'use client';

import { BadgeCheck } from 'lucide-react';

export function VerifiedBadge() {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-white/10 dark:border-foreground/10 bg-white/10 dark:bg-black/20 backdrop-blur-[2px] text-xs text-muted-foreground transition-all duration-200 hover:bg-white/15 hover:border-white/15 dark:hover:bg-black/30 dark:hover:border-foreground/20 hover:text-foreground"
      title="Real-world brand / official studio"
    >
      <BadgeCheck className="w-3.5 h-3.5" />
      <span>Verified</span>
    </div>
  );
}
