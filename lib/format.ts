/**
 * Pure i18n-aware format helpers.
 * No next-intl dependency -- locale is always passed explicitly.
 *
 * Usage:
 *   Server component  → const locale = await getLocale(); formatCurrency(amount, locale)
 *   Client component  → const locale = useLocale(); formatCurrency(amount, locale)
 */

export function formatCurrency(amount: number, locale: string = 'tr'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date, locale: string = 'tr'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, { dateStyle: 'medium' });
}

export function formatDateTime(date: string | Date, locale: string = 'tr'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}
