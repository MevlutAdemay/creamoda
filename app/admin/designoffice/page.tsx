/**
 * Admin Design Office Page
 * Manages DesignStudio and DesignStudioItem
 */

'use client';

import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Palette } from 'lucide-react';
import StudiosTab from './StudiosTab';
import ItemsTab from './ItemsTab';

export default function AdminDesignOfficePage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    // Check auth
    fetch('/api/auth/me')
      .then((res) => res.json())
      .then((data) => {
        if (data.user && (data.user.role === 'SUPER_ADMIN' || data.user.role === 'CONTENT_MANAGER')) {
          setAuthorized(true);
        } else {
          setAuthorized(false);
        }
      })
      .catch(() => {
        setAuthorized(false);
      });
  }, []);

  if (authorized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (authorized === false) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              You do not have permission to access this page. Only SUPER_ADMIN and CONTENT_MANAGER roles are allowed.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="container mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-4xl font-bold flex items-center gap-3">
            <Palette className="w-10 h-10 text-primary" />
            Design Office
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage design studios and their product collections
          </p>
        </div>

        <Tabs defaultValue="studios" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="studios">Design Studios</TabsTrigger>
            <TabsTrigger value="items">Studio Items</TabsTrigger>
          </TabsList>

          <TabsContent value="studios" className="mt-6">
            <StudiosTab />
          </TabsContent>

          <TabsContent value="items" className="mt-6">
            <ItemsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
