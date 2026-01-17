/**
 * Password Hashing & Verification Utilities
 * 
 * bcryptjs kullanarak güvenli şifre hash'leme
 */

import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Şifreyi hash'ler
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Şifreyi doğrular
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}
