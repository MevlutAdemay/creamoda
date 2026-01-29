import { cn } from '@/lib/utils';

interface GlassCardProps {
  className?: string;
  children: React.ReactNode;
}

/**
 * Glass card wrapper with frosted glass effect
 * - Rounded corners (2xl)
 * - Subtle border with low opacity white
 * - Semi-transparent white background
 * - Backdrop blur for glassmorphism
 * - Responsive padding
 * - Support for light and dark modes
 */
export function GlassCard({ className, children }: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl',
        'border border-white/10',
        'bg-white/10 dark:bg-white/5',
        'backdrop-blur-2xl',
        'shadow-lg shadow-black/5 dark:shadow-black/20',
        'p-4 md:p-6',
        className
      )}
    >
      {children}
    </div>
  );
}
