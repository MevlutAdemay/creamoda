// app/wizard/_components/CompanyStep.tsx
/**
 * Company Step Component
 * Step 1: Create company with name and location
 */

'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Building2, MapPin, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/ToastCenter';
import type { WizardUserData } from '../page';

interface CompanyStepProps {
  user: WizardUserData;
  onComplete: () => void;
}

type Country = {
  id: string;
  name: string;
  iso2: string;
};

type City = {
  id: string;
  name: string;
};

export default function CompanyStep({ user, onComplete }: CompanyStepProps) {
  const toast = useToast();
  const [companyName, setCompanyName] = useState(user.company?.name || '');
  const [selectedCountryId, setSelectedCountryId] = useState(user.company?.countryId || '');
  const [selectedCityId, setSelectedCityId] = useState(user.company?.cityId || '');
  
  const [countries, setCountries] = useState<Country[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  
  const [loadingCountries, setLoadingCountries] = useState(true);
  const [loadingCities, setLoadingCities] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Fetch countries on mount
  useEffect(() => {
    fetchCountries();
  }, []);

  // Fetch cities when country changes
  useEffect(() => {
    if (selectedCountryId) {
      fetchCities(selectedCountryId);
    } else {
      setCities([]);
      setSelectedCityId('');
    }
  }, [selectedCountryId]);

  const fetchCountries = async () => {
    setLoadingCountries(true);
    try {
      const res = await fetch('/api/admin/locations/countries');
      if (res.ok) {
        const data = await res.json();
        setCountries(data.countries || []);
      }
    } catch (error) {
      toast({ kind: 'error', message: 'Ülkeler yüklenemedi' });
    } finally {
      setLoadingCountries(false);
    }
  };

  const fetchCities = async (countryId: string) => {
    setLoadingCities(true);
    try {
      const res = await fetch(`/api/admin/locations/cities?countryId=${countryId}`);
      if (res.ok) {
        const data = await res.json();
        setCities(data.cities || []);
      }
    } catch (error) {
      toast({ kind: 'error', message: 'Şehirler yüklenemedi' });
    } finally {
      setLoadingCities(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName.trim()) {
      toast({ kind: 'error', message: 'Lütfen şirket adı girin' });
      return;
    }

    if (!selectedCountryId) {
      toast({ kind: 'error', message: 'Lütfen ülke seçin' });
      return;
    }

    if (!selectedCityId) {
      toast({ kind: 'error', message: 'Lütfen şehir seçin' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/wizard/company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: companyName.trim(),
          countryId: selectedCountryId,
          cityId: selectedCityId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Şirket oluşturulamadı');
      }

      toast({ kind: 'success', message: 'Şirket başarıyla oluşturuldu' });
      onComplete();
    } catch (error) {
      toast({
        kind: 'error',
        message: error instanceof Error ? error.message : 'Bir hata oluştu',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const isEditMode = !!user.company;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="w-6 h-6" />
          {isEditMode ? 'Şirket Bilgilerini Güncelle' : 'Şirketinizi Oluşturun'}
        </CardTitle>
        <CardDescription>
          {isEditMode
            ? 'Şirket bilgilerinizi güncelleyebilirsiniz.'
            : 'Oyuna başlamak için şirketinizin temel bilgilerini girin.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Name */}
          <div className="space-y-2">
            <Label htmlFor="companyName">Şirket Adı</Label>
            <Input
              id="companyName"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Örn: ModaVerse Fashion"
              disabled={submitting}
            />
          </div>

          {/* Country Selection */}
          <div className="space-y-2">
            <Label htmlFor="country" className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Ülke
            </Label>
            <Select
              value={selectedCountryId}
              onValueChange={(value) => {
                setSelectedCountryId(value);
                setSelectedCityId(''); // Reset city when country changes
              }}
              disabled={submitting || loadingCountries}
            >
              <SelectTrigger>
                <SelectValue placeholder={loadingCountries ? 'Yükleniyor...' : 'Ülke seçin'} />
              </SelectTrigger>
              <SelectContent>
                {countries.map((country) => (
                  <SelectItem key={country.id} value={country.id}>
                    {country.name} ({country.iso2})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* City Selection */}
          <div className="space-y-2">
            <Label htmlFor="city" className="flex items-center gap-1">
              <MapPin className="w-4 h-4" />
              Şehir
            </Label>
            <Select
              value={selectedCityId}
              onValueChange={setSelectedCityId}
              disabled={submitting || !selectedCountryId || loadingCities}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !selectedCountryId
                      ? 'Önce ülke seçin'
                      : loadingCities
                      ? 'Yükleniyor...'
                      : 'Şehir seçin'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {cities.map((city) => (
                  <SelectItem key={city.id} value={city.id}>
                    {city.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Submit Button */}
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                İşleniyor...
              </>
            ) : isEditMode ? (
              'Güncelle ve Devam Et'
            ) : (
              'Şirketi Oluştur ve Devam Et'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
