// app/player/sales/page.tsx

'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ShowcaseBuilder from './_components/ShowcaseBuilder';

export default function SalesPage() {
  return (
    <div className="relative max-h-screen bg-transparent">
      <div className="container mx-auto p-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">MODAVERSE Platform</h1>
            <p className="text-muted-foreground">
              List products from warehouse inventory to the showcase. After listing, advance the game day to generate sales.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Showcase Builder</CardTitle>
              <CardDescription>
                Select a warehouse and market zone, then list inventory items. Only items with qty on hand and a player product can be listed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ShowcaseBuilder />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
