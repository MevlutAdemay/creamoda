// app/wizard/_components/ReviewStep.tsx
/**
 * Review Step Component
 * Step 2: Preview setup costs, staff positions, and equipment
 * Shows HQ and WAREHOUSE data separately
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ModaVerseLogoLoader } from '@/components/ui/ModaVerseLogoLoader';
import {
  Building2,
  Users,
  Package,
  DollarSign,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Warehouse,
} from 'lucide-react';
import { useToast } from '@/components/ui/ToastCenter';
import type { WizardUserData } from '../page';

interface ReviewStepProps {
  user: WizardUserData;
  onBack: () => void;
  onConfirm: () => void;
}

type StaffPosition = {
  buildingRole: string;
  departmentCode: string;
  roleCode: string;
  roleName: string;
  roleStyle: string;
  headcount: number;
  monthlySalary: number;
};

type Equipment = {
  buildingRole: string;
  code: string;
  name: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
};

type SetupCost = {
  buildingRole: string;
  metricType: string;
  cost: number;
  description: string;
};

type BuildingInfo = {
  id: string;
  name: string | null;
  role: string;
  marketZone?: string | null;
};

type PreviewData = {
  company: {
    name: string;
    country: string;
    city: string;
    marketZone: string | null;
  };
  buildings: {
    hq: BuildingInfo;
    warehouse: BuildingInfo;
  };
  staff: {
    hq: StaffPosition[];
    warehouse: StaffPosition[];
    totalHeadcount: number;
  };
  equipment: {
    hq: Equipment[];
    warehouse: Equipment[];
  };
  setupCosts?: {
    hq: SetupCost[];
    warehouse: SetupCost[];
  };
  costs: {
    hqEquipmentTotal: number;
    warehouseEquipmentTotal: number;
    equipmentTotal: number;
    hqSetupTotal?: number;
    warehouseSetupTotal?: number;
    setupTotal?: number;
    hqMonthlyPayroll: number;
    warehouseMonthlyPayroll: number;
    monthlyPayroll: number;
    totalSetupCost: number;
  };
  rewards: {
    xpAward: number;
  };
  wallet: {
    currentBalance: number;
    afterSetup: number;
  };
};

export default function ReviewStep({ user, onBack, onConfirm }: ReviewStepProps) {
  const toast = useToast();
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPreview();
  }, []);

  const fetchPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/wizard/preview');
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Preview yüklenemedi');
      }

      setPreview(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Bir hata oluştu';
      setError(message);
      toast({ kind: 'error', message });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="flex flex-col items-center justify-center gap-2 py-16">
          <ModaVerseLogoLoader size={48} className="text-primary" />
          <span className="text-muted-foreground">Kurulum özeti yükleniyor...</span>
        </CardContent>
      </Card>
    );
  }

  if (error || !preview) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="w-12 h-12 text-destructive mb-4" />
          <p className="text-destructive mb-4">{error || 'Preview yüklenemedi'}</p>
          <Button onClick={fetchPreview} variant="outline">
            Tekrar Dene
          </Button>
        </CardContent>
      </Card>
    );
  }

  const insufficientFunds = preview.wallet.afterSetup < 0;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Company Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Şirket Bilgileri
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Şirket Adı</p>
              <p className="font-medium">{preview.company.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ülke</p>
              <p className="font-medium">{preview.company.country}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Şehir</p>
              <p className="font-medium">{preview.company.city}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Pazar Bölgesi</p>
              <p className="font-medium">{preview.company.marketZone || 'N/A'}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Buildings Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            Binalar
          </CardTitle>
          <CardDescription>
            Şirketiniz için oluşturulacak binalar
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="font-medium">Merkez Ofis (HQ)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Yönetim, finans ve tasarım ekiplerinin çalışacağı ana ofis
              </p>
            </div>
            <div className="p-4 border rounded-lg bg-muted/50">
              <div className="flex items-center gap-2 mb-2">
                <Warehouse className="w-4 h-4 text-primary" />
                <span className="font-medium">Depo (WAREHOUSE)</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Pazar: {preview.buildings.warehouse.marketZone || preview.company.marketZone}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* HQ Staff */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Merkez Ofis Personeli
          </CardTitle>
          <CardDescription>
            HQ için Level 1 personel pozisyonları
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preview.staff.hq.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Departman</TableHead>
                  <TableHead>Pozisyon</TableHead>
                  <TableHead className="text-center">Kişi Sayısı</TableHead>
                  <TableHead className="text-right">Aylık Maaş</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.staff.hq.map((pos, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant="outline">{pos.departmentCode}</Badge>
                    </TableCell>
                    <TableCell>{pos.roleName}</TableCell>
                    <TableCell className="text-center">{pos.headcount}</TableCell>
                    <TableCell className="text-right">
                      ${pos.monthlySalary.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={2}>HQ Toplam</TableCell>
                  <TableCell className="text-center">
                    {preview.staff.hq.reduce((sum, p) => sum + p.headcount, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    ${preview.costs.hqMonthlyPayroll.toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              HQ personeli tanımlı değil
            </p>
          )}
        </CardContent>
      </Card>

      {/* Warehouse Staff */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Depo Personeli
          </CardTitle>
          <CardDescription>
            WAREHOUSE için Level 1 personel pozisyonları
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preview.staff.warehouse.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Departman</TableHead>
                  <TableHead>Pozisyon</TableHead>
                  <TableHead className="text-center">Kişi Sayısı</TableHead>
                  <TableHead className="text-right">Aylık Maaş</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.staff.warehouse.map((pos, idx) => (
                  <TableRow key={idx}>
                    <TableCell>
                      <Badge variant="outline">{pos.departmentCode}</Badge>
                    </TableCell>
                    <TableCell>{pos.roleName}</TableCell>
                    <TableCell className="text-center">{pos.headcount}</TableCell>
                    <TableCell className="text-right">
                      ${pos.monthlySalary.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={2}>Depo Toplam</TableCell>
                  <TableCell className="text-center">
                    {preview.staff.warehouse.reduce((sum, p) => sum + p.headcount, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    ${preview.costs.warehouseMonthlyPayroll.toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              Depo personeli tanımlı değil
            </p>
          )}
        </CardContent>
      </Card>

      {/* HQ Equipment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Merkez Ofis Ekipmanları
          </CardTitle>
          <CardDescription>
            HQ için Level 1 gerekli ekipmanlar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preview.equipment.hq.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ekipman</TableHead>
                  <TableHead className="text-center">Adet</TableHead>
                  <TableHead className="text-right">Birim Fiyat</TableHead>
                  <TableHead className="text-right">Toplam</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.equipment.hq.map((eq, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{eq.name}</TableCell>
                    <TableCell className="text-center">{eq.quantity}</TableCell>
                    <TableCell className="text-right">
                      ${eq.unitCost.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${eq.totalCost.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={3}>HQ Ekipman Toplam</TableCell>
                  <TableCell className="text-right">
                    ${preview.costs.hqEquipmentTotal.toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              HQ ekipmanı gerekmiyor
            </p>
          )}
        </CardContent>
      </Card>

      {/* Warehouse Equipment */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="w-5 h-5" />
            Depo Ekipmanları
          </CardTitle>
          <CardDescription>
            WAREHOUSE için Level 1 gerekli ekipmanlar
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preview.equipment.warehouse.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ekipman</TableHead>
                  <TableHead className="text-center">Adet</TableHead>
                  <TableHead className="text-right">Birim Fiyat</TableHead>
                  <TableHead className="text-right">Toplam</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.equipment.warehouse.map((eq, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{eq.name}</TableCell>
                    <TableCell className="text-center">{eq.quantity}</TableCell>
                    <TableCell className="text-right">
                      ${eq.unitCost.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${eq.totalCost.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/50 font-medium">
                  <TableCell colSpan={3}>Depo Ekipman Toplam</TableCell>
                  <TableCell className="text-right">
                    ${preview.costs.warehouseEquipmentTotal.toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">
              Depo ekipmanı gerekmiyor
            </p>
          )}
        </CardContent>
      </Card>

      {/* Cost Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Maliyet Özeti
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Equipment Costs */}
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">HQ Ekipman Maliyeti</span>
              <span className="font-medium">${preview.costs.hqEquipmentTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Depo Ekipman Maliyeti</span>
              <span className="font-medium">${preview.costs.warehouseEquipmentTotal.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b bg-muted/30 px-2 rounded">
              <span className="font-medium">Toplam Ekipman Maliyeti</span>
              <span className="font-bold">${preview.costs.equipmentTotal.toLocaleString()}</span>
            </div>

            {/* Setup/Initialization Costs (from EconomyConfig) */}
            {(preview.costs.setupTotal ?? 0) > 0 && (
              <>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">HQ Kurulum Maliyeti</span>
                  <span className="font-medium">${(preview.costs.hqSetupTotal ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="text-muted-foreground">Depo Kurulum Maliyeti</span>
                  <span className="font-medium">${(preview.costs.warehouseSetupTotal ?? 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b bg-muted/30 px-2 rounded">
                  <span className="font-medium">Toplam Kurulum Maliyeti (Bina)</span>
                  <span className="font-bold">${(preview.costs.setupTotal ?? 0).toLocaleString()}</span>
                </div>
              </>
            )}

            {/* Monthly Payroll */}
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">HQ Aylık Personel Gideri</span>
              <span className="font-medium">${preview.costs.hqMonthlyPayroll.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Depo Aylık Personel Gideri</span>
              <span className="font-medium">${preview.costs.warehouseMonthlyPayroll.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b bg-muted/30 px-2 rounded">
              <span className="font-medium">Toplam Aylık Personel Gideri</span>
              <span className="font-bold">${preview.costs.monthlyPayroll.toLocaleString()}</span>
            </div>

            {/* Total Setup Cost */}
            <div className="flex justify-between items-center py-2 border-b text-lg">
              <span className="font-semibold">Toplam Başlangıç Maliyeti</span>
              <span className="font-bold text-primary">
                ${preview.costs.totalSetupCost.toLocaleString()}
              </span>
            </div>

            {/* Wallet Balance */}
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-muted-foreground">Mevcut Bakiye</span>
              <span className="font-medium">${preview.wallet.currentBalance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-muted-foreground">Kurulum Sonrası Bakiye</span>
              <span
                className={`font-bold ${
                  insufficientFunds ? 'text-destructive' : 'text-green-600'
                }`}
              >
                ${preview.wallet.afterSetup.toLocaleString()}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* XP Reward */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="font-medium">Kurulum Ödülü</span>
          </div>
          <Badge variant="default" className="text-lg px-3 py-1">
            +{preview.rewards.xpAward.toLocaleString()} XP
          </Badge>
        </CardContent>
      </Card>

      {/* Insufficient Funds Warning */}
      {insufficientFunds && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="w-5 h-5 text-destructive" />
            <span className="text-destructive">
              Yetersiz bakiye! Kurulum için ${preview.costs.totalSetupCost.toLocaleString()} gerekiyor.
            </span>
          </CardContent>
        </Card>
      )}

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Geri
        </Button>
        <Button onClick={onConfirm} disabled={insufficientFunds}>
          Kurulumu Onayla
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
