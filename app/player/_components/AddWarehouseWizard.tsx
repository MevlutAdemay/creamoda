'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ModaVerseLogoLoader } from '@/components/ui/ModaVerseLogoLoader';
import { MapPin, Warehouse, Users, Package, DollarSign, ArrowLeft, ArrowRight, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/ToastCenter';
import { MarketZone } from '@prisma/client';

type Country = { id: string; name: string; iso2: string };
type City = { id: string; name: string };
type StaffPosition = {
  departmentCode: string;
  roleCode: string;
  roleName: string;
  roleStyle: string;
  headcount: number;
  monthlySalary: number;
};
type Equipment = {
  code: string;
  name: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
};
type SetupCost = { metricType: string; cost: number; description: string };
type PreviewData = {
  countryId: string;
  countryName: string;
  marketZone: MarketZone;
  staff: StaffPosition[];
  equipment: Equipment[];
  setupCosts: SetupCost[];
  costs: {
    equipmentTotal: number;
    setupTotal: number;
    totalSetupCost: number;
    monthlyPayroll: number;
  };
  wallet: { currentBalance: number; afterSetup: number };
};

const MARKET_ZONES: MarketZone[] = [
  'AFRICA_SOUTH',
  'APAC_EAST',
  'APAC_SOUTH',
  'CANADA',
  'EU_NORTH',
  'EU_SOUTH',
  'EU_CENTRAL',
  'BALKANS',
  'LATAM_NORTH',
  'LATAM_SOUTH',
  'MENA',
  'OCEANIA',
  'TURKIYE',
  'USA',
];

type AddWarehouseWizardProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

export function AddWarehouseWizard({ open, onOpenChange, onSuccess }: AddWarehouseWizardProps) {
  const toast = useToast();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [countryId, setCountryId] = useState('');
  const [cityId, setCityId] = useState('');
  const [marketZone, setMarketZone] = useState<MarketZone | ''>('');
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [loadingCountries, setLoadingCountries] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setCountryId('');
    setCityId('');
    setMarketZone('');
    setPreview(null);
    setPreviewError(null);
    setDone(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoadingCountries(true);
    fetch('/api/admin/locations/countries')
      .then((res) => res.json())
      .then((data) => setCountries(data.countries || []))
      .catch(() => toast({ kind: 'error', message: 'Ülkeler yüklenemedi' }))
      .finally(() => setLoadingCountries(false));
  }, [open, toast]);

  useEffect(() => {
    if (!countryId) {
      setCities([]);
      setCityId('');
      return;
    }
    setLoadingCities(true);
    setCityId('');
    fetch(`/api/admin/locations/cities?countryId=${countryId}`)
      .then((res) => res.json())
      .then((data) => setCities(data.cities || []))
      .catch(() => toast({ kind: 'error', message: 'Şehirler yüklenemedi' }))
      .finally(() => setLoadingCities(false));
  }, [countryId, toast]);

  useEffect(() => {
    if (step !== 3 || !countryId || !marketZone) return;
    setLoadingPreview(true);
    setPreviewError(null);
    fetch(
      `/api/player/warehouse/new/preview?countryId=${encodeURIComponent(countryId)}&marketZone=${encodeURIComponent(marketZone)}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.error) {
          setPreviewError(data.error);
          setPreview(null);
        } else {
          setPreview(data);
        }
      })
      .catch(() => {
        setPreviewError('Önizleme yüklenemedi');
        setPreview(null);
      })
      .finally(() => setLoadingPreview(false));
  }, [step, countryId, marketZone]);

  const handleNext = () => {
    if (step === 1) {
      if (!countryId || !cityId) {
        toast({ kind: 'error', message: 'Lütfen ülke ve şehir seçin' });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (!marketZone) {
        toast({ kind: 'error', message: 'Lütfen pazar bölgesi seçin' });
        return;
      }
      setStep(3);
    }
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 3) setStep(2);
  };

  const handleConfirm = async () => {
    if (!countryId || !cityId || !marketZone) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/player/warehouse/new/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countryId, cityId, marketZone }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kurulum başarısız');
      }
      toast({ kind: 'success', message: 'Depo başarıyla oluşturuldu' });
      setDone(true);
      onSuccess?.();
      setTimeout(() => {
        onOpenChange(false);
      }, 1500);
    } catch (e) {
      toast({ kind: 'error', message: e instanceof Error ? e.message : 'Bir hata oluştu' });
    } finally {
      setSubmitting(false);
    }
  };

  const insufficientFunds = preview ? preview.wallet.afterSetup < 0 : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Warehouse className="h-5 w-5" />
            Yeni Depo Kur
          </DialogTitle>
        </DialogHeader>

        {done ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <CheckCircle className="h-12 w-12 text-green-600" />
            <p className="text-sm font-medium">Depo başarıyla oluşturuldu.</p>
          </div>
        ) : (
          <>
            {step === 1 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    Ülke
                  </Label>
                  <Select
                    value={countryId}
                    onValueChange={setCountryId}
                    disabled={loadingCountries}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loadingCountries ? 'Yükleniyor...' : 'Ülke seçin'} />
                    </SelectTrigger>
                    <SelectContent>
                      {countries.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name} ({c.iso2})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    Şehir
                  </Label>
                  <Select
                    value={cityId}
                    onValueChange={setCityId}
                    disabled={!countryId || loadingCities}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          !countryId ? 'Önce ülke seçin' : loadingCities ? 'Yükleniyor...' : 'Şehir seçin'
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end pt-2">
                  <Button onClick={handleNext} disabled={!countryId || !cityId}>
                    İleri
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Warehouse className="h-4 w-4" />
                    Pazar Bölgesi (Market Zone)
                  </Label>
                  <Select
                    value={marketZone}
                    onValueChange={(v) => setMarketZone(v as MarketZone)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Pazar bölgesi seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKET_ZONES.map((mz) => (
                        <SelectItem key={mz} value={mz}>
                          {mz.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="outline" onClick={handleBack}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Geri
                  </Button>
                  <Button onClick={handleNext} disabled={!marketZone}>
                    İleri
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                {loadingPreview ? (
                  <div className="flex flex-col items-center justify-center gap-2 py-8">
                    <ModaVerseLogoLoader size={40} className="text-primary" />
                    <span className="text-sm text-muted-foreground">Önizleme yükleniyor...</span>
                  </div>
                ) : previewError ? (
                  <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                    {previewError}
                  </div>
                ) : preview ? (
                  <>
                    <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                      <div className="font-medium">{preview.countryName}</div>
                      <div className="text-muted-foreground">Pazar: {preview.marketZone.replace(/_/g, ' ')}</div>
                    </div>

                    {preview.staff.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium mb-2">
                          <Users className="h-4 w-4" />
                          Personel
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Departman</TableHead>
                                <TableHead>Pozisyon</TableHead>
                                <TableHead className="text-center">Adet</TableHead>
                                <TableHead className="text-right">Aylık Maaş</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {preview.staff.map((pos, i) => (
                                <TableRow key={i}>
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
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    {preview.equipment.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 text-sm font-medium mb-2">
                          <Package className="h-4 w-4" />
                          Ekipman
                        </div>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Ekipman</TableHead>
                                <TableHead className="text-center">Adet</TableHead>
                                <TableHead className="text-right">Birim</TableHead>
                                <TableHead className="text-right">Toplam</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {preview.equipment.map((eq, i) => (
                                <TableRow key={i}>
                                  <TableCell>{eq.name}</TableCell>
                                  <TableCell className="text-center">{eq.quantity}</TableCell>
                                  <TableCell className="text-right">${eq.unitCost.toLocaleString()}</TableCell>
                                  <TableCell className="text-right font-medium">${eq.totalCost.toLocaleString()}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm font-medium">
                      <DollarSign className="h-4 w-4" />
                      Maliyet Özeti
                    </div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Ekipman</span>
                        <span>${preview.costs.equipmentTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Kurulum</span>
                        <span>${preview.costs.setupTotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between font-medium border-t pt-2">
                        <span>Toplam Kurulum Maliyeti</span>
                        <span>${preview.costs.totalSetupCost.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Mevcut Bakiye</span>
                        <span>${preview.wallet.currentBalance.toLocaleString()}</span>
                      </div>
                      <div
                        className={`flex justify-between font-medium ${
                          insufficientFunds ? 'text-destructive' : 'text-green-600'
                        }`}
                      >
                        <span>Kurulum Sonrası Bakiye</span>
                        <span>${preview.wallet.afterSetup.toLocaleString()}</span>
                      </div>
                    </div>

                    {insufficientFunds && (
                      <p className="text-sm text-destructive">
                        Yetersiz bakiye. Kurulum için ${preview.costs.totalSetupCost.toLocaleString()} gerekiyor.
                      </p>
                    )}

                    <div className="flex justify-between pt-2">
                      <Button variant="outline" onClick={handleBack} disabled={submitting}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        Geri
                      </Button>
                      <Button
                        onClick={handleConfirm}
                        disabled={submitting || insufficientFunds}
                      >
                        {submitting ? (
                          <span className="inline-flex items-center gap-2">
                            <ModaVerseLogoLoader size={18} className="text-primary-foreground" />
                            İşleniyor...
                          </span>
                        ) : (
                          'Kurulumu Onayla'
                        )}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </>
                ) : null}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
