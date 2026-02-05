/**
 * OAuth URL helpers used by client pages.
 *
 * Keep these as relative URLs so they work in:
 * - localhost
 * - Vercel preview deployments
 * - production
 *
 * The server route (`/api/auth/google/start`) is responsible for choosing the
 * correct origin/redirect_uri based on env (AUTH_ORIGIN / VERCEL_URL).
 */

export const GOOGLE_AUTH_START_URL = '/api/auth/google/start';

