import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { defaultLocale, locales, type Locale } from '@/i18n/config';

export function middleware(request: NextRequest) {
  const raw = request.cookies.get('NEXT_LOCALE')?.value;
  const valid = locales.includes(raw as Locale);
  const locale: Locale = valid ? (raw as Locale) : defaultLocale;

  const response = NextResponse.next();

  // Set cookie if missing or invalid
  if (!raw || !valid) {
    response.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next|favicon.ico).*)'],
};
