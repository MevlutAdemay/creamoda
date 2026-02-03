import { NextResponse } from 'next/server';

function getOrigin(request: Request): string {
  // Google Console'da tek redirect URI kullanmak için: Production URL sabit olmalı.
  // Preview (PR) deployment'lar da aynı redirect_uri'yi kullanır; giriş sonrası production'a yönlenir.
  if (process.env.AUTH_ORIGIN) {
    return process.env.AUTH_ORIGIN.replace(/\/$/, '');
  }
  const url = new URL(request.url);
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `${url.protocol}//${url.host}`;
}

export async function GET(request: Request) {
  const origin = getOrigin(request);

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${origin}/api/auth/google/callback`;

  if (!clientId) {
    return NextResponse.json({ error: 'GOOGLE_CLIENT_ID is not set' }, { status: 500 });
  }

  // CSRF koruması için state üret
  const state = crypto.randomUUID();

  const authorizeUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorizeUrl.searchParams.set('client_id', clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', 'openid email profile');
  authorizeUrl.searchParams.set('access_type', 'offline');
  authorizeUrl.searchParams.set('prompt', 'consent');
  authorizeUrl.searchParams.set('state', state);

  const response = NextResponse.redirect(authorizeUrl.toString());

  // 10 dk geçerli state cookie
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });

  return response;
}
