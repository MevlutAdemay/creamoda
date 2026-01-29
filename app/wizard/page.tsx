// app/wizard/page.tsx
/**
 * Wizard Page (Server Component)
 * 
 * Determines the initial step based on user's onboarding status and passes
 * the data to the client component for rendering the wizard UI.
 */

import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import WizardClient from './_components/WizardClient';

// Types for user data passed to client
export type WizardUserData = {
  id: string;
  onboardingStatus: string;
  onboardingStep: string | null;
  company: {
    id: string;
    name: string;
    countryId: string;
    cityId: string;
    country: {
      id: string;
      name: string;
      iso2: string;
    };
    city: {
      id: string;
      name: string;
    };
  } | null;
};

export type WizardStep = 'company' | 'review' | 'process' | 'done';

/**
 * Determine the current step based on user's onboarding state
 */
function determineStep(user: WizardUserData): WizardStep {
  // If done, should redirect (handled by layout), but return done just in case
  if (user.onboardingStatus === 'DONE') {
    return 'done';
  }

  // If no step set or step is COMPANY
  if (!user.onboardingStep || user.onboardingStep === 'COMPANY') {
    // If company exists, move to review
    return user.company ? 'review' : 'company';
  }

  // Map onboardingStep to wizard step
  if (user.onboardingStep === 'REVIEW') {
    return 'review';
  }
  if (user.onboardingStep === 'PROCESSING') {
    return 'process';
  }

  // Default to company step
  return 'company';
}

export default async function WizardPage() {
  // Get session (layout already validated, but double-check)
  const session = await getServerSession();
  if (!session) {
    redirect('/login');
  }

  // Check if admin (admins shouldn't be on wizard)
  if (session.user.role === 'SUPER_ADMIN' || session.user.role === 'CONTENT_MANAGER') {
    redirect('/admin/dashboard');
  }

  // Fetch user data with company info
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      onboardingStatus: true,
      onboardingStep: true,
      companies: {
        take: 1,
        select: {
          id: true,
          name: true,
          countryId: true,
          cityId: true,
          country: {
            select: {
              id: true,
              name: true,
              iso2: true,
            },
          },
          city: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    redirect('/login');
  }

  // Transform to WizardUserData
  const userData: WizardUserData = {
    id: user.id,
    onboardingStatus: user.onboardingStatus,
    onboardingStep: user.onboardingStep,
    company: user.companies[0] || null,
  };

  // Determine initial step
  const initialStep = determineStep(userData);

  // If done, redirect to player (shouldn't happen due to layout guard)
  if (initialStep === 'done') {
    redirect('/player');
  }

  return <WizardClient user={userData} initialStep={initialStep} />;
}
