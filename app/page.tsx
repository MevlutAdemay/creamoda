// app/page.tsx

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import Link from "next/link";
import { Shield, User } from "lucide-react";

export default function Home() {
  return (
    <main className="max-h-screen bg-linear-to-br from-background via-background to-muted">
      <div className="container mx-auto p-8">
        <div className="flex justify-between items-center mb-12">
          <div>
            <h1 className="text-5xl font-bold bg-linear-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Creamoda
            </h1>
            <p className="text-muted-foreground mt-2">Moda Endüstrisi Simülasyon Oyunu</p>
          </div>
          <ThemeToggle />
        </div>
        
        <div className="max-w-4xl mx-auto">
          {/* Admin Bölümü */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-6 h-6 text-red-500" />
              Yönetici Girişi
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="border-red-200 dark:border-red-900">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Admin Girişi
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-muted-foreground">
                    Mevcut admin hesabınızla giriş yapın
                  </p>
                  <Link href="/admin/login">
                    <Button className="w-full sm:w-auto" variant="destructive">
                      <Shield className="w-4 h-4 mr-2" />
                      Admin Girişi
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="border-red-200 dark:border-red-900">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    Admin Oluştur
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="mb-4 text-muted-foreground">
                    Yeni admin hesabı oluşturun
                  </p>
                  <Link href="/admin/register">
                    <Button className="w-full sm:w-auto" variant="outline">
                      <Shield className="w-4 h-4 mr-2" />
                      Admin Oluştur
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Oyuncu Bölümü */}
          <div>
            <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
              <User className="w-6 h-6 text-primary" />
              Oyuncu Girişi
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Player Oluştur</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-muted-foreground">
                    Yeni oyuncu hesabı oluşturun
                  </p>
                  <Link href="/register" className="block">
                    <Button className="w-full" variant="default">
                      Player Oluştur
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Giriş Yap</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-muted-foreground">
                    Mevcut hesabınızla giriş yapın
                  </p>
                  <Link href="/login" className="block">
                    <Button className="w-full" variant="outline">
                      Oyuncu Girişi
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Info */}
          <div className="mt-12 text-center text-sm text-muted-foreground">
            <p>
              Creamoda ile moda endüstrisinin dinamiklerini deneyimleyin
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
