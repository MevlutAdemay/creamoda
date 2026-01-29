// app/wizard/_components/DoneStep.tsx
/**
 * Done Step Component
 * Step 4: Success message and redirect to player
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ArrowRight, Sparkles } from 'lucide-react';

interface DoneStepProps {
  autoRedirect?: boolean;
}

export default function DoneStep({ autoRedirect = true }: DoneStepProps) {
  const router = useRouter();

  useEffect(() => {
    if (autoRedirect) {
      const timer = setTimeout(() => {
        router.push('/player');
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [autoRedirect, router]);

  const handleContinue = () => {
    router.push('/player');
  };

  return (
    <Card className="w-full max-w-2xl mx-auto text-center">
      <CardHeader>
        <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <CardTitle className="text-2xl">Tebrikler!</CardTitle>
        <CardDescription className="text-base">
          Şirketiniz başarıyla kuruldu ve oyuna başlamaya hazırsınız.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Success Details */}
        <div className="bg-primary/5 rounded-lg p-6 space-y-4">
          <div className="flex items-center justify-center gap-2 text-primary">
            <Sparkles className="w-5 h-5" />
            <span className="font-medium">Kurulum Başarılı</span>
          </div>
          <ul className="text-sm text-muted-foreground space-y-2">
            <li>✓ Şirketiniz oluşturuldu</li>
            <li>✓ Merkez ofisiniz kuruldu</li>
            <li>✓ Başlangıç personeliniz atandı</li>
            <li>✓ Ekipmanlarınız hazır</li>
            <li>✓ XP ödülünüz hesabınıza eklendi</li>
          </ul>
        </div>

        {/* Auto-redirect notice */}
        {autoRedirect && (
          <p className="text-sm text-muted-foreground">
            Birkaç saniye içinde otomatik olarak yönlendirileceksiniz...
          </p>
        )}

        {/* Manual Continue Button */}
        <Button onClick={handleContinue} size="lg" className="w-full">
          Oyuna Başla
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </CardContent>
    </Card>
  );
}
