/**
 * Server-side session helper
 * Cookie'den session token'ı alıp validate eder
 */

import { cookies } from 'next/headers';
import { validateSession } from './session';

export async function getServerSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session_token');

  if (!sessionToken) {
    return null;
  }

  const session = await validateSession(sessionToken.value);
  
  if (!session) {
    return null;
  }

  return {
    user: session.user,
    session: {
      id: session.id,
      expiresAt: session.expiresAt,
    },
  };
}
