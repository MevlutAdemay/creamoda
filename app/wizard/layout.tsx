// app/wizard/layout.tsx
/**
 * Wizard Layout
 * Server component with onboarding guard.
 * Redirects to /player if onboardingStatus == DONE.
 */

import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';

export default async function WizardLayout({
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

  // If already done, redirect to player
  if (user?.onboardingStatus === 'DONE') {
    redirect('/player');
  }

  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  );
}
