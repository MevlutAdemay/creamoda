//app/admin/products/page.tsx

/**
 * Admin Products Page
 * Manages ProductCategoryNode, ProductTemplate, and ProductImageTemplate
 */

'use client';

import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ModaVerseLogoLoader } from '@/components/ui/ModaVerseLogoLoader';
import { Package } from 'lucide-react';
import CategoriesTab from './CategoriesTab';
import TemplatesTab from './TemplatesTab';
import ImagesTab from './ImagesTab';

export default function AdminProductsPage() {
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
      <div className="min-h-screen flex flex-col items-center justify-center gap-2">
        <ModaVerseLogoLoader size={56} className="text-primary" />
        <span className="text-muted-foreground">Loading...</span>
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
            <Package className="w-10 h-10 text-primary" />
            Product Page
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage product categories, templates, and images
          </p>
        </div>

        <Tabs defaultValue="categories" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="categories">Categories</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="images">Images</TabsTrigger>
          </TabsList>

          <TabsContent value="categories" className="mt-6">
            <CategoriesTab />
          </TabsContent>

          <TabsContent value="templates" className="mt-6">
            <TemplatesTab />
          </TabsContent>

          <TabsContent value="images" className="mt-6">
            <ImagesTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
