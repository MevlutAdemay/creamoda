import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    // Kullanıcıyı veritabanından bul
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        wallet: true,
      },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: 'Email veya şifre hatalı' },
        { status: 401 }
      );
    }

    // Hesap kilidi kontrolü
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 60000
      );
      return NextResponse.json(
        { 
          error: `Hesabınız kilitlendi. ${remainingMinutes} dakika sonra tekrar deneyin.` 
        },
        { status: 403 }
      );
    }

    // Şifre kontrolü
    const isPasswordValid = await verifyPassword(password, user.passwordHash);

    if (!isPasswordValid) {
      // Başarısız giriş sayacını artır
      const failedAttempts = user.failedLoginAttempts + 1;
      const maxAttempts = parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || '5', 10);

      if (failedAttempts >= maxAttempts) {
        // Hesabı kilitle (30 dakika)
        const lockDuration = parseInt(process.env.ACCOUNT_LOCK_DURATION_MINUTES || '30', 10);
        await prisma.user.update({
          where: { id: user.id },
          data: {
            failedLoginAttempts: failedAttempts,
            lockedUntil: new Date(Date.now() + lockDuration * 60 * 1000),
          },
        });
        return NextResponse.json(
          { error: 'Çok fazla başarısız deneme. Hesabınız 30 dakika kilitlendi.' },
          { status: 403 }
        );
      }

      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts: failedAttempts },
      });

      return NextResponse.json(
        { error: 'Email veya şifre hatalı' },
        { status: 401 }
      );
    }

    // Başarılı giriş - session oluştur
    const deviceId = request.headers.get('x-device-id') || crypto.randomUUID();
    const userAgent = request.headers.get('user-agent') || undefined;
    const ipAddress = request.headers.get('x-forwarded-for') || 
                      request.headers.get('x-real-ip') || 
                      undefined;

    const session = await createSession({
      userId: user.id,
      deviceId,
      deviceName: userAgent?.substring(0, 100),
      userAgent: userAgent?.substring(0, 255),
      ipAddress: ipAddress?.substring(0, 64),
    });

    // Cookie'ye session token kaydet
    const cookieStore = await cookies();
    cookieStore.set('session_token', session.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 gün
      path: '/',
    });

    // Player ise ve cüzdanı yoksa başlangıç bakiyesi ile oluştur
    let ensuredWallet = user.wallet;
    if (user.role === 'PLAYER' && !user.wallet) {
      ensuredWallet = await prisma.playerWallet.create({
        data: {
          userId: user.id,
          balanceUsd: 2168367,
          balanceXp: 15000,
          balanceDiamond: 7500,
        },
      });
    }

    // Kullanıcı bilgilerini güncelle
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress?.substring(0, 64),
      },
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
      },
    });

    // Response
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        displayName: user.displayName,
        role: user.role,
        emailVerified: user.emailVerified,
        wallet: ensuredWallet ? {
          balanceUsd: Number(ensuredWallet.balanceUsd),
          balanceXp: ensuredWallet.balanceXp,
          balanceDiamond: ensuredWallet.balanceDiamond,
        } : null,
      },
      message: 'Giriş başarılı',
    });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Bir hata oluştu' },
      { status: 500 }
    );
  }
}
