'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { GOOGLE_AUTH_START_URL } from '@/lib/auth/oauth-urls';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/shared/theme-toggle';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error);
        return;
      }

      // Role göre yönlendir
      if (data.user.role === 'SUPER_ADMIN' || data.user.role === 'CONTENT_MANAGER') {
        // Admin'ler dashboard'a
        router.push('/admin/dashboard');
      } else if (data.user.role === 'PLAYER') {
        // Player'lar player sayfasına
        router.push('/player');
      } else {
        // Bilinmeyen rol
        router.push('/');
      }
    } catch {
      setError('Bir hata oluştu');
    }
  };

  return (
    <div className="container mx-auto p-8 flex justify-center items-center min-h-screen">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Giriş Yap</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <Input
                type="password"
                placeholder="Şifre"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-red-500 text-sm">{error}</p>}
            <Button type="submit" className="w-full">
              Giriş Yap
            </Button>
          </form>

          <div className="mt-4">
            <a 
              href={GOOGLE_AUTH_START_URL}
              className="inline-flex h-10 w-full items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
            >
              Google ile devam et
            </a>
          </div>
          
          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>Hesabınız yok mu?</p>
            <a href="/register" className="text-primary hover:underline">
              Yeni hesap oluştur
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
