'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { User, Wallet } from 'lucide-react';

export default function PlayerPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Session kontrolü için API'ye istek at
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
          // Eğer admin ise dashboard'a yönlendir
          if (data.user.role === 'SUPER_ADMIN' || data.user.role === 'CONTENT_MANAGER') {
            router.push('/admin/dashboard');
          }
        } else {
          router.push('/login');
        }
      })
      .catch(() => {
        router.push('/login');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      <div className="container mx-auto p-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold flex items-center gap-3">
              <User className="w-10 h-10 text-primary" />
              Player Dashboard
            </h1>
            <p className="text-muted-foreground mt-2">
              Hoş geldiniz, {user.name || user.email}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Kullanıcı Bilgileri
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="text-sm">
                    <strong>Email:</strong> {user.email}
                  </p>
                  <p className="text-sm">
                    <strong>Rol:</strong> {user.role}
                  </p>
                </div>
              </CardContent>
            </Card>

            {user.wallet && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    Cüzdan
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm">
                      <strong>USD:</strong> ${Number(user.wallet.balanceUsd).toLocaleString()}
                    </p>
                    <p className="text-sm">
                      <strong>XP:</strong> {user.wallet.balanceXp.toLocaleString()}
                    </p>
                    <p className="text-sm">
                      <strong>Diamond:</strong> {user.wallet.balanceDiamond.toLocaleString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Oyuna Başla</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Player dashboard içeriği buraya eklenecek.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
