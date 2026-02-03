import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { createSession } from '@/lib/auth/session';

const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const USERINFO_ENDPOINT = 'https://www.googleapis.com/oauth2/v2/userinfo';

const INITIAL_BALANCE_USD = 2168367;
const INITIAL_BALANCE_XP = 15000;
const INITIAL_BALANCE_DIAMOND = 7500;

function getOrigin(request: Request): string {
  const url = new URL(request.url);
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return `${url.protocol}//${url.host}`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getOrigin(request);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  const cookieStore = await cookies();
  const stateCookie = cookieStore.get('oauth_state');

  if (!code || !state || !stateCookie || stateCookie.value !== state) {
    return NextResponse.redirect(`${origin}/login?error=oauth_state_invalid`);
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = `${origin}/api/auth/google/callback`;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${origin}/login?error=oauth_env_missing`);
  }

  try {
    // 1) Exchange code for tokens
    const tokenRes = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      return NextResponse.redirect(`${origin}/login?error=token_exchange_failed&detail=${encodeURIComponent(err)}`);
    }

    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson.access_token as string;

    // 2) Fetch profile
    const profileRes = await fetch(USERINFO_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!profileRes.ok) {
      const err = await profileRes.text();
      return NextResponse.redirect(`${origin}/login?error=profile_fetch_failed&detail=${encodeURIComponent(err)}`);
    }

    const profile = (await profileRes.json()) as {
      id: string;
      email: string;
      name?: string;
      given_name?: string;
      family_name?: string;
      picture?: string;
      verified_email?: boolean;
    };

    if (!profile.email) {
      return NextResponse.redirect(`${origin}/login?error=email_missing`);
    }

    // 3) Upsert user + account, ensure wallet
    const user = await prisma.$transaction(async (tx) => {
      // Kullanıcıyı bul/oluştur
      const existing = await tx.user.findUnique({ where: { email: profile.email } });

      let player;
      if (existing) {
        player = await tx.user.update({
          where: { id: existing.id },
          data: {
            name: existing.name ?? profile.name ?? profile.given_name ?? null,
            displayName: existing.displayName ?? profile.name ?? profile.given_name ?? null,
            isOAuthUser: true,
            role: 'PLAYER',
            emailVerified: existing.emailVerified || Boolean(profile.verified_email),
            lastLoginAt: new Date(),
          },
        });
      } else {
        player = await tx.user.create({
          data: {
            email: profile.email,
            name: profile.name ?? profile.given_name ?? null,
            displayName: profile.name ?? profile.given_name ?? null,
            isOAuthUser: true,
            role: 'PLAYER',
            emailVerified: Boolean(profile.verified_email),
          },
        });

        // Cüzdan oluştur (bonuslarla)
        await tx.playerWallet.create({
          data: {
            userId: player.id,
            balanceUsd: INITIAL_BALANCE_USD,
            balanceXp: INITIAL_BALANCE_XP,
            balanceDiamond: INITIAL_BALANCE_DIAMOND,
          },
        });
      }

      // Account tablosu
      await tx.account.upsert({
        where: {
          provider_providerAccountId: {
            provider: 'GOOGLE',
            providerAccountId: profile.id,
          },
        },
        update: {
          accessToken: tokenJson.access_token,
          refreshToken: tokenJson.refresh_token,
          scope: tokenJson.scope,
          tokenType: tokenJson.token_type,
          expiresAt: tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000) : null,
        },
        create: {
          userId: player.id,
          provider: 'GOOGLE',
          providerAccountId: profile.id,
          accessToken: tokenJson.access_token,
          refreshToken: tokenJson.refresh_token,
          scope: tokenJson.scope,
          tokenType: tokenJson.token_type,
          expiresAt: tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000) : null,
        },
      });

      return player;
    });

    // 4) Create our session
    const deviceId = crypto.randomUUID();
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined;

    const session = await createSession({
      userId: user.id,
      deviceId,
      deviceName: 'Google OAuth',
      userAgent,
      ipAddress,
    });

    // Set our cookie
    cookieStore.set('session_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    // Activity log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        entityType: 'USER',
        entityId: user.id,
        ipAddress: ipAddress?.substring(0, 64),
        userAgent: userAgent?.substring(0, 255),
        metadata: { provider: 'GOOGLE' },
      },
    });

    // Clear state cookie
    cookieStore.set('oauth_state', '', { path: '/', maxAge: 0 });

    // Redirect to player dashboard
    return NextResponse.redirect(`${origin}/player`);
  } catch (e) {
    console.error('Google OAuth callback error:', e);
    return NextResponse.redirect(`${origin}/login?error=oauth_unknown`);
  }
}
