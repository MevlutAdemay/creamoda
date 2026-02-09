// app/player/procurement/page.tsx

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';

export default function ProcurementPage() {
  const [content, setContent] = useState('');

  return (
    <div className="relative max-h-screen bg-transparent">
      <div className="container mx-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">Merchandising</h1>
            <p className="text-muted-foreground">
              Satın alma ve merchandising işlemlerinizi buradan yönetebilirsiniz.
            </p>
            <Link href="/player/procurement/catalog">
              <Button variant="default" className="mt-4">
                Procurement Catalog
              </Button>
            </Link>
          </div>

          {/* Content Editor */}
          <Card>
            <CardHeader>
              <CardTitle>İçerik Düzenleyici</CardTitle>
              <CardDescription>
                Bu sayfa için içerik düzenlemesi yapabilirsiniz. UI çalışmalarına başlamak için hazır.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="content">İçerik</Label>
                <Textarea
                  id="content"
                  placeholder="Buraya içerik yazabilirsiniz..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={12}
                  className="min-h-[300px]"
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
