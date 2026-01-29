/**
 * Admin route protection helper
 * Ensures user has SUPER_ADMIN or CONTENT_MANAGER role
 */

import { getServerSession } from './get-session';
import { NextResponse } from 'next/server';

export async function requireAdmin() {
  const session = await getServerSession();

  if (!session) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      user: null,
    };
  }

  const { user } = session;

  if (user.role !== 'SUPER_ADMIN' && user.role !== 'CONTENT_MANAGER') {
    return {
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
      user: null,
    };
  }

  return {
    error: null,
    user,
  };
}
