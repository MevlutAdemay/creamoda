/**
 * Session Management Utilities
 * 
 * JWT-free session yönetimi (Prisma ile)
 */

import { randomBytes } from 'crypto';
import prisma from '@/lib/prisma';

/**
 * Güvenli session token üretir
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Session süresi (30 gün)
 */
export function getSessionExpiry(): Date {
  const expiryDays = parseInt(process.env.SESSION_MAX_AGE || '2592000', 10) / 86400;
  return new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);
}

/**
 * Session oluşturur
 */
export async function createSession(data: {
  userId: string;
  deviceId: string;
  deviceName?: string;
  userAgent?: string;
  ipAddress?: string;
}) {
  const token = generateSessionToken();
  const expiresAt = getSessionExpiry();

  // Kullanıcının mevcut aktif session'larını iptal et (tek session politikası)
  await prisma.session.updateMany({
    where: {
      userId: data.userId,
      status: 'ACTIVE',
      revokedAt: null,
    },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
    },
  });

  // Yeni session oluştur
  const session = await prisma.session.create({
    data: {
      ...data,
      token,
      expiresAt,
      status: 'ACTIVE',
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          displayName: true,
          role: true,
          emailVerified: true,
        },
      },
    },
  });

  return session;
}

/**
 * Session'ı doğrular ve kullanıcıyı döndürür
 */
export async function validateSession(token: string) {
  const session = await prisma.session.findUnique({
    where: { token },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          displayName: true,
          role: true,
          emailVerified: true,
          isOAuthUser: true,
        },
      },
    },
  });

  if (!session) {
    return null;
  }

  // Session kontrolü
  if (
    session.status !== 'ACTIVE' ||
    session.revokedAt !== null ||
    session.expiresAt < new Date()
  ) {
    return null;
  }

  // Last activity güncelle
  await prisma.session.update({
    where: { id: session.id },
    data: { lastActivityAt: new Date() },
  });

  return session;
}

/**
 * Session'ı iptal eder
 */
export async function revokeSession(token: string) {
  await prisma.session.update({
    where: { token },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
    },
  });
}

/**
 * Kullanıcının tüm session'larını iptal eder
 */
export async function revokeAllUserSessions(userId: string) {
  await prisma.session.updateMany({
    where: {
      userId,
      status: 'ACTIVE',
    },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
    },
  });
}
