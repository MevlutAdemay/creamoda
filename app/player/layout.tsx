// app/player/layout.tsx
/**
 * Player Layout
 * Server component with onboarding guard.
 * Redirects to /wizard if onboardingStatus != DONE.
 */

import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import PlayerNavbar from '@/components/shared/player-navbar';
import PlayerSidebar from '@/components/shared/player-sidebar';
import { PlayerTransitionProviders } from './providers';

export default async function PlayerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Server-side guard: check session
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  // Server-side guard: check onboarding status; fetch user with wallet for navbar store seed
  const [user, unreadCount] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        onboardingStatus: true,
        name: true,
        email: true,
        displayName: true,
        wallet: {
          select: { balanceUsd: true, balanceXp: true, balanceDiamond: true },
        },
      },
    }),
    prisma.playerMessage.count({
      where: { playerId: session.user.id, isRead: false },
    }),
  ]);

  if (user?.onboardingStatus !== 'DONE') {
    redirect('/wizard');
  }

  const propUser = user
    ? {
        name: user.name ?? undefined,
        email: user.email,
        displayName: user.displayName ?? undefined,
        balanceUSD: user.wallet ? Number(user.wallet.balanceUsd) : 0,
        balanceXP: user.wallet?.balanceXp ?? 0,
        balanceDiamond: user.wallet?.balanceDiamond ?? 0,
      }
    : undefined;

  return (
    <>
      <PlayerNavbar user={propUser} initialUnreadCount={unreadCount} />
      <div className="flex h-screen overflow-hidden bg-transparent pt-16 mt-0">
        {/* Sidebar - fixed, so main needs left margin to avoid going under it */}
        <PlayerSidebar initialUnreadCount={unreadCount} />

        {/* Main Content Area - ml matches sidebar width when visible (w-20 lg:w-64) */}
        <main className="flex-1 overflow-y-auto bg-transparent relative isolate md:ml-20 lg:ml-60 min-w-0">
          <PlayerTransitionProviders>{children}</PlayerTransitionProviders>
        </main>
      </div>
    </>
  );
}
