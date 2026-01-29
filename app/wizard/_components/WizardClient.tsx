// app/wizard/_components/WizardClient.tsx
/**
 * Wizard Client Component
 * Main client component that manages wizard state and renders steps
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import WizardProgress from './WizardProgress';
import CompanyStep from './CompanyStep';
import ReviewStep from './ReviewStep';
import ProcessingStep from './ProcessingStep';
import DoneStep from './DoneStep';
import type { WizardUserData, WizardStep } from '../page';

interface WizardClientProps {
  user: WizardUserData;
  initialStep: WizardStep;
}

export default function WizardClient({ user, initialStep }: WizardClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<WizardStep>(initialStep);
  const [userData, setUserData] = useState<WizardUserData>(user);

  // Handle step completion and navigation
  const handleCompanyComplete = () => {
    // Refresh page to get updated user data
    router.refresh();
    setCurrentStep('review');
  };

  const handleReviewBack = () => {
    setCurrentStep('company');
  };

  const handleReviewConfirm = () => {
    setCurrentStep('process');
  };

  const handleProcessingComplete = () => {
    setCurrentStep('done');
  };

  const handleDoneComplete = () => {
    router.push('/player');
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Şirket Kurulum Sihirbazı</h1>
        <p className="text-muted-foreground">
          Aşağıdaki adımları takip ederek şirketinizi kurun ve oyuna başlayın.
        </p>
      </div>

      {/* Progress Indicator */}
      <WizardProgress currentStep={currentStep} />

      {/* Step Content */}
      <div className="mt-8">
        {currentStep === 'company' && (
          <CompanyStep user={userData} onComplete={handleCompanyComplete} />
        )}

        {currentStep === 'review' && (
          <ReviewStep
            user={userData}
            onBack={handleReviewBack}
            onConfirm={handleReviewConfirm}
          />
        )}

        {currentStep === 'process' && (
          <ProcessingStep user={userData} onComplete={handleProcessingComplete} />
        )}

        {currentStep === 'done' && <DoneStep autoRedirect />}
      </div>
    </div>
  );
}
