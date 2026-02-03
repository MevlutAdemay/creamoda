'use client';

import { useEffect, useState } from 'react';

function getChartColors() {
  if (typeof document === 'undefined') {
    return {
      c1: 'oklch(0.7294 0.1687 34.0542)',
      c2: 'oklch(0.6640 0.1441 273.0110)',
      c3: 'oklch(0.8025 0.0489 253.2802)',
      c4: 'oklch(0.8964 0.0561 38.8451)',
      c5: 'oklch(0.9399 0.0214 245.8573)',
      muted: 'oklch(0.9630 0.0062 255.4751)',
      border: 'oklch(0.9204 0.0121 259.8230)',
      text: 'oklch(0.3351 0.0331 260.9120)',
    };
  }
  const styles = getComputedStyle(document.documentElement);
  const get = (name: string) => styles.getPropertyValue(name).trim() || undefined;
  return {
    c1: get('--chart-1') ?? 'oklch(0.7294 0.1687 34.0542)',
    c2: get('--chart-2') ?? 'oklch(0.6640 0.1441 273.0110)',
    c3: get('--chart-3') ?? 'oklch(0.8025 0.0489 253.2802)',
    c4: get('--chart-4') ?? 'oklch(0.8964 0.0561 38.8451)',
    c5: get('--chart-5') ?? 'oklch(0.9399 0.0214 245.8573)',
    muted: get('--muted') ?? 'oklch(0.9630 0.0062 255.4751)',
    border: get('--border') ?? 'oklch(0.9204 0.0121 259.8230)',
    text: get('--foreground') ?? 'oklch(0.3351 0.0331 260.9120)',
  };
}

export function useChartColors() {
  const [colors, setColors] = useState(getChartColors);

  useEffect(() => {
    setColors(getChartColors());
  }, []);

  return colors;
}
