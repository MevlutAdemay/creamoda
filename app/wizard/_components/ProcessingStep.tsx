// app/wizard/_components/ProcessingStep.tsx
/**
 * Processing Step Component
 * Step 3: Execute setup in transaction, show progress
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ModaVerseLogoLoader } from '@/components/ui/ModaVerseLogoLoader';
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  Building2,
  Users,
  Package,
  DollarSign,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastCenter';
import type { WizardUserData } from '../page';

interface ProcessingStepProps {
  user: WizardUserData;
  onComplete: () => void;
}

type ProcessingStatus = 'idle' | 'processing' | 'success' | 'error';

type ProcessingStep = {
  key: string;
  label: string;
  icon: React.ReactNode;
  status: 'pending' | 'processing' | 'completed' | 'error';
};

const INITIAL_STEPS: ProcessingStep[] = [
  { key: 'gameClock', label: 'Oyun saati oluşturuluyor', icon: <Clock className="w-4 h-4" />, status: 'pending' },
  { key: 'hq', label: 'Merkez ofis kuruluyor', icon: <Building2 className="w-4 h-4" />, status: 'pending' },
  { key: 'staff', label: 'Personel atanıyor', icon: <Users className="w-4 h-4" />, status: 'pending' },
  { key: 'equipment', label: 'Ekipmanlar kuruluyor', icon: <Package className="w-4 h-4" />, status: 'pending' },
  { key: 'finance', label: 'Mali kayıtlar oluşturuluyor', icon: <DollarSign className="w-4 h-4" />, status: 'pending' },
  { key: 'xp', label: 'XP ödülü veriliyor', icon: <Sparkles className="w-4 h-4" />, status: 'pending' },
];

export default function ProcessingStep({ user, onComplete }: ProcessingStepProps) {
  const toast = useToast();
  const [status, setStatus] = useState<ProcessingStatus>('idle');
  const [steps, setSteps] = useState<ProcessingStep[]>(INITIAL_STEPS);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const hasStarted = useRef(false);

  // Start processing automatically on mount
  useEffect(() => {
    if (!hasStarted.current) {
      hasStarted.current = true;
      startProcessing();
    }
  }, []);

  const updateStep = (key: string, stepStatus: ProcessingStep['status']) => {
    setSteps((prev) =>
      prev.map((s) => (s.key === key ? { ...s, status: stepStatus } : s))
    );
  };

  const simulateProgress = async () => {
    // Simulate step-by-step progress for visual feedback
    const stepKeys = INITIAL_STEPS.map((s) => s.key);
    const stepDuration = 300; // ms per step animation

    for (let i = 0; i < stepKeys.length; i++) {
      updateStep(stepKeys[i], 'processing');
      await new Promise((r) => setTimeout(r, stepDuration));
      setProgress(((i + 1) / stepKeys.length) * 90); // Cap at 90% until API returns
    }
  };

  const startProcessing = async () => {
    setStatus('processing');
    setErrorMessage(null);
    setSteps(INITIAL_STEPS);
    setProgress(0);

    // Start visual progress simulation
    const progressPromise = simulateProgress();

    try {
      const res = await fetch('/api/wizard/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();

      // Wait for progress animation to finish
      await progressPromise;

      if (!res.ok) {
        throw new Error(data.error || 'Kurulum başarısız oldu');
      }

      // Mark all steps as completed
      setSteps((prev) => prev.map((s) => ({ ...s, status: 'completed' })));
      setProgress(100);
      setStatus('success');

      toast({ kind: 'success', message: 'Şirket kurulumu tamamlandı!' });

      // Auto-redirect after a short delay
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      // Wait for progress animation
      await progressPromise;

      const message = error instanceof Error ? error.message : 'Bir hata oluştu';
      setErrorMessage(message);
      setStatus('error');
      
      // Mark current step as error
      setSteps((prev) => {
        const lastProcessing = prev.findIndex((s) => s.status === 'processing');
        return prev.map((s, i) => ({
          ...s,
          status: i === lastProcessing ? 'error' : s.status,
        }));
      });

      toast({ kind: 'error', message });
    }
  };

  const handleRetry = () => {
    hasStarted.current = false;
    startProcessing();
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="text-center">
        <CardTitle className="flex items-center justify-center gap-2">
          {status === 'processing' && (
            <ModaVerseLogoLoader size={28} className="text-primary" />
          )}
          {status === 'success' && (
            <CheckCircle2 className="w-6 h-6 text-green-500" />
          )}
          {status === 'error' && (
            <XCircle className="w-6 h-6 text-destructive" />
          )}
          {status === 'idle' && (
            <Clock className="w-6 h-6 text-muted-foreground" />
          )}
          {status === 'processing'
            ? 'Kurulum Yapılıyor...'
            : status === 'success'
            ? 'Kurulum Tamamlandı!'
            : status === 'error'
            ? 'Kurulum Başarısız'
            : 'Kurulum Bekliyor'}
        </CardTitle>
        <CardDescription>
          {status === 'processing'
            ? 'Lütfen bekleyin, şirketiniz kuruluyor...'
            : status === 'success'
            ? 'Player paneline yönlendiriliyorsunuz...'
            : status === 'error'
            ? 'Bir sorun oluştu. Tekrar deneyebilirsiniz.'
            : 'Kurulum başlatılıyor...'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Progress Bar */}
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-sm text-muted-foreground text-center">
            {Math.round(progress)}% tamamlandı
          </p>
        </div>

        {/* Steps List */}
        <div className="space-y-3">
          {steps.map((step) => (
            <div
              key={step.key}
              className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                step.status === 'completed'
                  ? 'bg-green-50 dark:bg-green-950/20'
                  : step.status === 'processing'
                  ? 'bg-primary/10'
                  : step.status === 'error'
                  ? 'bg-destructive/10'
                  : 'bg-muted/50'
              }`}
            >
              {/* Status Icon */}
              <div className="shrink-0">
                {step.status === 'completed' ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : step.status === 'processing' ? (
                  <ModaVerseLogoLoader size={22} className="text-primary" />
                ) : step.status === 'error' ? (
                  <XCircle className="w-5 h-5 text-destructive" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                )}
              </div>

              {/* Step Icon & Label */}
              <div className="flex items-center gap-2 flex-1">
                <span
                  className={
                    step.status === 'completed'
                      ? 'text-green-600 dark:text-green-400'
                      : step.status === 'processing'
                      ? 'text-primary'
                      : step.status === 'error'
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                  }
                >
                  {step.icon}
                </span>
                <span
                  className={`text-sm ${
                    step.status === 'pending' ? 'text-muted-foreground' : ''
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Error Message */}
        {status === 'error' && errorMessage && (
          <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <p className="text-sm text-destructive">{errorMessage}</p>
          </div>
        )}

        {/* Retry Button */}
        {status === 'error' && (
          <Button onClick={handleRetry} className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Tekrar Dene
          </Button>
        )}

        {/* Success Message */}
        {status === 'success' && (
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Birkaç saniye içinde yönlendirileceksiniz...
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
