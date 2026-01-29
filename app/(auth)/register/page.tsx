'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ThemeToggle } from '@/components/shared/theme-toggle';
import Link from 'next/link';
import { ArrowLeft, User as UserIcon } from 'lucide-react';

// Bonus miktarları (gösterim için)
const INITIAL_BALANCE_USD = 2168367;
const INITIAL_BALANCE_XP = 15000;
const INITIAL_BALANCE_DIAMOND = 7500;

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Kayıt başarısız');
      }

      // Başarılı kayıt - onboardingStatus'a göre yönlendir
      if (data.user?.onboardingStatus === 'DONE') {
        router.push('/player');
      } else {
        // NEW veya WIZARD durumunda wizard'a yönlendir
        router.push('/wizard');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-muted p-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="absolute top-4 left-4">
        <Link href="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Ana Sayfa
          </Button>
        </Link>
      </div>

      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="p-3 bg-primary/10 rounded-full">
              <UserIcon className="w-8 h-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center">Yeni Hesap Oluştur</CardTitle>
          <CardDescription className="text-center">
            Creamoda&apos;ya katılın ve oyuna başlayın!
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Ad Soyad
              </label>
              <Input
                id="name"
                type="text"
                placeholder="Adınız Soyadınız"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium">
                E-posta
              </label>
              <Input
                id="email"
                type="email"
                placeholder="ornek@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium">
                Şifre (min. 8 karakter)
              </label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                disabled={loading}
              />
            </div>

            {error && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-4 py-3 rounded-lg text-sm">
              <p className="font-semibold text-blue-900 dark:text-blue-100 mb-1">
                🎁 Başlangıç Bonusu
              </p>
              <ul className="text-blue-700 dark:text-blue-300 space-y-1 text-xs">
                <li>💵 ${INITIAL_BALANCE_USD.toLocaleString()} USD</li>
                <li>⭐ {INITIAL_BALANCE_XP.toLocaleString()} XP</li>
                <li>💎 {INITIAL_BALANCE_DIAMOND.toLocaleString()} Diamond</li>
              </ul>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                  Kayıt yapılıyor...
                </>
              ) : (
                <>
                  <UserIcon className="w-4 h-4 mr-2" />
                  Kayıt Ol
                </>
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>Zaten hesabınız var mı?</p>
            <Link href="/login" className="text-primary hover:underline">
              Giriş yapın
            </Link>
          </div>

          <div className="mt-4">
            <a 
              href="/api/auth/google/start"
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            >
              Google ile devam et
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
