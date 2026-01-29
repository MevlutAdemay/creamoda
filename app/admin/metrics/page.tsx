/**
 * Admin Metrics Page
 * Manages MetricLevelConfig, EconomyConfig, StaffingRule, RequirementRule, and EquipmentCatalog
 */

'use client';

import { redirect } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';
import MetricLevelConfigTab from './MetricLevelConfigTab';
import EconomyConfigTab from './EconomyConfigTab';
import StaffingRuleTab from './StaffingRuleTab';
import EquipmentCatalogTab from './EquipmentCatalogTab';
import RequirementRuleTab from './RequirementRuleTab';

export default function AdminMetricsPage() {
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
            <BarChart3 className="w-10 h-10 text-primary" />
            Metrics Configuration
          </h1>
          <p className="text-muted-foreground mt-2">
            Manage metric level configs, economy configs, staffing rules, requirement rules, and equipment catalog
          </p>
        </div>

        <Tabs defaultValue="metric-level-config" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="metric-level-config">Level Configs</TabsTrigger>
            <TabsTrigger value="economy-config">Economy Configs</TabsTrigger>
            <TabsTrigger value="staffing-rules">Staffing Rules</TabsTrigger>
            <TabsTrigger value="equipment-catalog">Equipment Catalog</TabsTrigger>
            <TabsTrigger value="requirement-rules">Requirement Rules</TabsTrigger>
          </TabsList>

          <TabsContent value="metric-level-config" className="mt-6">
            <MetricLevelConfigTab />
          </TabsContent>

          <TabsContent value="economy-config" className="mt-6">
            <EconomyConfigTab />
          </TabsContent>

          <TabsContent value="staffing-rules" className="mt-6">
            <StaffingRuleTab />
          </TabsContent>

          <TabsContent value="equipment-catalog" className="mt-6">
            <EquipmentCatalogTab />
          </TabsContent>

          <TabsContent value="requirement-rules" className="mt-6">
            <RequirementRuleTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
