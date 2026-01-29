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

  // Server-side guard: check onboarding status
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingStatus: true },
  });

  if (user?.onboardingStatus !== 'DONE') {
    redirect('/wizard');
  }

  return (
    <>
      <PlayerNavbar />
      <div className="flex h-screen overflow-hidden bg-transparent pt-16 mt-0">
        {/* Sidebar - fixed, so main needs left margin to avoid going under it */}
        <PlayerSidebar />

        {/* Main Content Area - ml matches sidebar width when visible (w-20 lg:w-64) */}
        <main className="flex-1 overflow-y-auto bg-transparent relative isolate md:ml-20 lg:ml-60 min-w-0">
          <PlayerTransitionProviders>{children}</PlayerTransitionProviders>
        </main>
      </div>
    </>
  );
}
