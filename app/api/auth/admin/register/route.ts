import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { createSession } from '@/lib/auth/session';

export async function POST(request: Request) {
  try {
    const { name, email, password, role } = await request.json();

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

    // Role kontrolü - sadece admin rolleri
    if (role !== 'SUPER_ADMIN' && role !== 'CONTENT_MANAGER') {
      return NextResponse.json(
        { error: 'Geçersiz rol' },
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

    // Admin kullanıcıyı oluştur
    const user = await prisma.user.create({
      data: {
        email,
        name: name || email.split('@')[0],
        displayName: name || email.split('@')[0],
        passwordHash,
        role: role as 'SUPER_ADMIN' | 'CONTENT_MANAGER',
        emailVerified: false,
        isOAuthUser: false,
      },
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
        action: 'ADMIN_REGISTER',
        entityType: 'USER',
        entityId: user.id,
        ipAddress: ipAddress?.substring(0, 64),
        userAgent: userAgent?.substring(0, 255),
        metadata: {
          role: user.role,
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
      message: 'Admin kaydı başarılı!',
    });
  } catch (error) {
    console.error('Admin register error:', error);
    return NextResponse.json(
      { error: 'Kayıt sırasında bir hata oluştu' },
      { status: 500 }
    );
  }
}
