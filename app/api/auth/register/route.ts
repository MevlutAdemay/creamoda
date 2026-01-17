import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';

// Başlangıç bakiyeleri
const INITIAL_BALANCE_USD = 2168367;
const INITIAL_BALANCE_XP = 15000;
const INITIAL_BALANCE_DIAMOND = 7500;

export async function POST(request: Request) {
  try {
    const { name, email, password } = await request.json();

    // Validasyon
    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email ve şifre gereklidir' },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Şifre en az 8 karakter olmalıdır' },
        { status: 400 }
      );
    }

    // Email zaten kayıtlı mı kontrol et
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Bu email adresi zaten kayıtlı' },
        { status: 400 }
      );
    }

    // Şifreyi hashle
    const passwordHash = await hashPassword(password);

    // Kullanıcıyı ve cüzdanı oluştur (transaction ile)
    const user = await prisma.$transaction(async (tx) => {
      // Kullanıcı oluştur
      const newUser = await tx.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          displayName: name || email.split('@')[0],
          passwordHash,
          role: 'PLAYER',
          emailVerified: false,
          isOAuthUser: false,
        },
      });

      // Başlangıç parası ile cüzdan oluştur
      await tx.playerWallet.create({
        data: {
          userId: newUser.id,
          balanceUsd: INITIAL_BALANCE_USD,
          balanceXp: INITIAL_BALANCE_XP,
          balanceDiamond: INITIAL_BALANCE_DIAMOND,
        },
      });

      return newUser;
    });

    // Session oluştur ve otomatik login
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

    // Activity log
    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'REGISTER',
        entityType: 'USER',
        entityId: user.id,
        ipAddress: ipAddress?.substring(0, 64),
        userAgent: userAgent?.substring(0, 255),
        metadata: {
          initial_balance_usd: INITIAL_BALANCE_USD,
          initial_balance_xp: INITIAL_BALANCE_XP,
          initial_balance_diamond: INITIAL_BALANCE_DIAMOND,
        },
      },
    });

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        displayName: user.displayName,
        role: user.role,
      },
      message: 'Kayıt başarılı! Hoş geldiniz!',
    });
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Kayıt sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
}
