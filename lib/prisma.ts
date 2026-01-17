/**
 * Prisma Client Singleton
 * 
 * Next.js hot-reload sırasında çoklu Prisma Client oluşmasını engeller.
 * Production'da her seferinde yeni instance oluşturur (önerilen davranış).
 */

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
