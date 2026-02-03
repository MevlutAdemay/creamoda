// app/player/page.tsx

'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Building2,
  Users,
  MapPin,
  DollarSign,
  Warehouse,
  Globe,
  Plus,
} from 'lucide-react';
import { ModaVerseLogoLoader } from '@/components/ui/ModaVerseLogoLoader';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { AddWarehouseWizard } from './_components/AddWarehouseWizard';
import { InboxWidget } from '@/components/player/messages/InboxWidget';

type Building = {
  id: string;
  name: string | null;
  role: string;
  marketZone: string | null;
  createdAt: string;
};

type StaffMember = {
  id: string;
  fullName: string;
  gender: string;
  departmentCode: string;
  roleCode: string;
  roleName: string;
  roleStyle: string;
  monthlySalary: number;
  hiredAt: string;
  building: {
    id: string;
    name: string | null;
    role: string;
    country: {
      id: string;
      iso2: string;
    } | null;
  };
};

type OverviewData = {
  company: {
    id: string;
    name: string;
    country: {
      id: string;
      name: string;
      iso2: string;
      marketZone: string | null;
    };
    city: {
      id: string;
      name: string;
    };
  };
  buildings: Building[];
  staff: StaffMember[];
  stats: {
    total: number;
    byBuilding: Array<{
      buildingId: string;
      buildingName: string | null;
      buildingRole: string;
      count: number;
    }>;
    totalMonthlySalary: number;
  };
};

export default function PlayerPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  
  // Carousel state for grid-a8
  const carouselItems = [
    { image: '/images/casualwear.webp', label: 'CASUALWEAR' , description: 'A curated selection of everyday essentials focused on comfort, versatility, and stable sales.' },
    { image: '/images/streetwear.webp', label: 'STREETWEAR' , description: 'A trend-driven collection of casual and urban styles focused on bold silhouettes, cultural relevance, and high engagement.' },
    { image: '/images/smart.webp', label: 'SMART, BUSINESS' , description: 'A refined collection of modern tailored pieces designed for professional settings, offering balanced style, structure, and reliable demand.' },
    { image: '/images/athleisure.webp', label: 'ATHLEISURE' , description: 'A modern active-inspired collection combining comfort, performance, and contemporary style, built for everyday movement and consistent appeal.' },
  ];
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
  const [addWarehouseOpen, setAddWarehouseOpen] = useState(false);

  // Hydration fix
  useEffect(() => {
    setMounted(true);
  }, []);

  // Carousel auto-rotate: change image every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentCarouselIndex((prev) => (prev + 1) % carouselItems.length);
    }, 10000); // 10 seconds

    return () => clearInterval(interval);
  }, [carouselItems.length]);

  useEffect(() => {
    // Session kontrolü
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
          
          // Eğer admin ise dashboard'a yönlendir
          if (data.user.role === 'SUPER_ADMIN' || data.user.role === 'CONTENT_MANAGER') {
            router.push('/admin/dashboard');
            return;
          }

          // Eğer wizard tamamlanmadıysa wizard'a yönlendir
          if (data.user.onboardingStatus !== 'DONE') {
            router.push('/wizard');
            return;
          }

          // Overview data'yı çek
          fetch('/api/player/overview')
            .then(res => res.json())
            .then(data => {
              if (data.error) {
                console.error('Error fetching overview:', data.error);
              } else {
                setOverview(data);
              }
            })
            .catch(err => {
              console.error('Error fetching overview:', err);
            })
            .finally(() => {
              setOverviewLoading(false);
            });
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    // Short date format (locale default, e.g. 28.01.2026)
    return new Date(dateString).toLocaleDateString('tr-TR');
  };

  const getBuildingRoleLabel = (role: string) => {
    switch (role) {
      case 'HQ':
        return 'HQ';
      case 'WAREHOUSE':
        return 'WH';
      default:
        return role;
    }
  };

  const getBuildingRoleIcon = (role: string) => {
    switch (role) {
      case 'HQ':
        return <Building2 className="w-4 h-4" />;
      case 'WAREHOUSE':
        return <Warehouse className="w-4 h-4" />;
      default:
        return <Building2 className="w-4 h-4" />;
    }
  };

  if (loading || !mounted) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <ModaVerseLogoLoader size={64} className="text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="relative min-h-screen bg-transparent">
      <div className="container ml-0 p-8">
        <div className="w-full  max-w-7xl mx-auto space-y-6">
          {/* ===================== 12-GRID DASHBOARD ===================== */}
          <style jsx global>{`
            .dashboard-grid {
              display: grid;
              gap: 8px;
            }
            @media (max-width: 767px) {
              .dashboard-grid {
                grid-template-columns: 1fr;
                grid-template-rows: repeat(3, 132px) repeat(6, 132px) repeat(3, 132px) repeat(4, 132px);
                grid-template-areas:
                  "a1"
                  "a1"
                  "a1"
                  "a2"
                  "a3"
                  "a4"
                  "a5"
                  "a6"
                  "a7"
                  "a8"
                  "a8"
                  "a8"
                  "a9"
                  "a10"
                  "a11"
                  "a12";
              }
            }
            @media (min-width: 768px) and (max-width: 1279px) {
              .dashboard-grid {
                grid-template-columns: repeat(2, 1fr);
                grid-template-rows: repeat(3, 132px) repeat(3, 132px) repeat(3, 132px) repeat(2, 132px);
                grid-template-areas:
                  "a1 a1"
                  "a1 a1"
                  "a1 a1"
                  "a2 a3"
                  "a4 a5"
                  "a6 a7"
                  "a8 a8"
                  "a8 a8"
                  "a8 a8"
                  "a9 a10"
                  "a11 a12";
              }
            }
            @media (min-width: 1280px) {
              .dashboard-grid {
                height: 700px;
                grid-template-columns: repeat(5, 1fr);
                grid-template-rows: repeat(5, calc((700px - 32px) / 5));
                grid-template-areas:
                  "a1 a1 a2 a3 a4"
                  "a1 a1 a5 a6 a7"
                  "a1 a1 a8 a8 a8"
                  "a9 a10 a8 a8 a8"
                  "a11 a12 a8 a8 a8";
              }
            }
            .grid-a1 { grid-area: a1; }
            .grid-a2 { grid-area: a2; }
            .grid-a3 { grid-area: a3; }
            .grid-a4 { grid-area: a4; }
            .grid-a5 { grid-area: a5; }
            .grid-a6 { grid-area: a6; }
            .grid-a7 { grid-area: a7; }
            .grid-a8 { grid-area: a8; }
            .grid-a9 { grid-area: a9; }
            .grid-a10 { grid-area: a10; }
            .grid-a11 { grid-area: a11; }
            .grid-a12 { grid-area: a12; }
          `}</style>

          <div className="dashboard-grid mb-8">
            {/* A1: Company + location + stats (overview data) */}
            <Card className="grid-a1 h-full overflow-hidden flex flex-col">
              <CardContent className="p-4 h-full flex flex-col">
                <div className="shrink-0">
                  <h2 className="text-lg font-bold leading-tight">
                    ModaVerse&apos;e Hoş Geldiniz, {user?.name || user?.email || 'Oyuncu'}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Şirketiniz ve bina bilgileriniz aşağıda.
                  </p>
                </div>
                <div className="flex-1 min-h-0 flex items-center">
                  <div className="w-full flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      {overview && (
                        <>
                          <div className="mb-3">
                            <h6 className="text-sm font-bold truncate">{overview.company.name}</h6>
                            <div className="flex flex-row mt-1 gap-2 text-xs text-muted-foreground flex-wrap">
                              <div className="flex items-center gap-2">
                                <Globe className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{overview.company.country.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">{overview.company.city.name}</span>
                              </div>
                            </div>
                            {overview.buildings.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {overview.buildings.map((b) => (
                                  <span
                                    key={b.id}
                                    className="text-xs bg-muted px-2 py-0.5 rounded"
                                  >
                                    {b.name || getBuildingRoleLabel(b.role)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-row gap-4 flex-wrap items-center">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="leading-tight">
                                <div className="text-sm text-muted-foreground">Toplam Personel</div>
                                <div className="text-lg font-bold tabular-nums">
                                  {(overview.stats?.total ?? 0).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <DollarSign className="h-4 w-4 text-muted-foreground shrink-0" />
                              <div className="leading-tight">
                                <div className="text-sm text-muted-foreground">Toplam Aylık Maaş</div>
                                <div className="text-lg font-bold tabular-nums">
                                  {formatCurrency(overview.stats?.totalMonthlySalary ?? 0)}
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                      {!overview && !overviewLoading && (
                        <p className="text-sm text-muted-foreground">Veri yükleniyor...</p>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end justify-center text-center">
                      <div className="text-[10px] font-semibold text-muted-foreground mb-1">
                        Sezon
                      </div>
                      <div className="text-xs text-muted-foreground w-[120px]">
                        Sezon bilgisi yakında
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* A2–A12: Placeholder cards */}
            <Card className="grid-a2 h-full overflow-hidden">
              <CardContent className="p-4 h-full flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">Yakında: Özet kartı</span>
              </CardContent>
            </Card>
            <Card className="grid-a3 h-full overflow-hidden">
              <CardContent className="p-4 h-full flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">Yakında</span>
              </CardContent>
            </Card>
            <Card className="grid-a4 h-full overflow-hidden">
              <CardContent className="p-4 h-full flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">Yakında</span>
              </CardContent>
            </Card>
            <Card className="grid-a5 h-full overflow-hidden">
              <CardContent className="p-4 h-full flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">Yakında</span>
              </CardContent>
            </Card>
            <Card className="grid-a6 h-full overflow-hidden">
              <CardContent className="p-4 h-full flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">Yakında</span>
              </CardContent>
            </Card>
            <Card className="grid-a7 h-full overflow-hidden">
              <CardContent className="p-4 h-full flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">Yakında</span>
              </CardContent>
            </Card>
            <div className="grid-a8 bg-card/40 rounded-lg border h-full flex items-center justify-center overflow-hidden relative">
            <div className="absolute top-4 left-4 text-muted-foreground px-3 py-1.5 rounded-md flex flex-col gap-1">
                  <span className="text-small font-semibold tracking-wider">
                    {carouselItems[currentCarouselIndex].label}
                  </span>
                  <span className="hidden md:block text-xs text-foreground font-semibold tracking-wider">
                    {carouselItems[currentCarouselIndex].description}
                  </span>
                </div>
              <div className="relative w-full md:w-[70%] h-[70%] mt-1">
                <Image
                  src={carouselItems[currentCarouselIndex].image}
                  alt={carouselItems[currentCarouselIndex].label}
                  fill
                  className="object-cover"
                  sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 40vw"
                  priority={currentCarouselIndex === 0}
                />
                {/* Label - top left */}
                
              </div>
            </div>
            <Card className="grid-a9 h-full overflow-hidden">
              <CardContent className="p-4 h-full flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">Yakında</span>
              </CardContent>
            </Card>
            <Card className="grid-a10 h-full overflow-hidden">
              <CardContent className="p-4 h-full flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">Yakında</span>
              </CardContent>
            </Card>
            <Card className="grid-a11 h-full overflow-hidden">
              <CardContent className="p-4 h-full flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">Yakında</span>
              </CardContent>
            </Card>
            <Card className="grid-a12 h-full overflow-hidden">
              <CardContent className="p-4 h-full flex flex-col items-center justify-center">
                <span className="text-xs text-muted-foreground">Yakında</span>
              </CardContent>
            </Card>
          </div>

          {/* ===================== SECTION 2: DEVELOPMENT STAGES + STAFF TABLE ===================== */}
          <section className="mt-2 grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Development Stages - left side (2/5 width) */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-semibold">
                    Development Stages
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Upgradeable buildings and staff level overview.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-xs text-muted-foreground">
                    Add a new warehouse in a different market zone to expand your operations.
                  </p>
                  <Button
                    variant="default"
                    size="sm"
                    className="w-full sm:w-auto"
                    onClick={() => setAddWarehouseOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Yeni Depo Kur
                  </Button>
                </CardContent>
              </Card>
              <AddWarehouseWizard
                open={addWarehouseOpen}
                onOpenChange={setAddWarehouseOpen}
                onSuccess={() => {
                  fetch('/api/player/overview')
                    .then((res) => res.json())
                    .then((data) => {
                      if (!data.error) setOverview(data);
                    })
                    .catch(() => {});
                }}
              />
            </div>

            {/* Company Staff Table - right side (3/5 width) */}
            <div className="lg:col-span-3 space-y-4">
              <InboxWidget />
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4" />
                    Staff List
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Active staff and salary information
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {overviewLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <ModaVerseLogoLoader size={32} className="text-primary" />
                    </div>
                  ) : !overview || overview.staff.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No staff found yet.
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {/* Summary Stats */}
                      <div className="flex items-center gap-6 p-4 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Total Staff:</span>
                          <span className="text-sm font-semibold">{overview.stats.total}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-4 h-4 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">Total Monthly Salary:</span>
                          <span className="text-sm font-semibold">
                            {formatCurrency(overview.stats.totalMonthlySalary)}
                          </span>
                        </div>
                      </div>

                      {/* Staff Table */}
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="text-xs">
                              <TableHead className="text-xs">Building</TableHead>
                              <TableHead className="text-xs">Name</TableHead>
                              <TableHead className="text-xs">Role</TableHead>
                              <TableHead className="text-xs text-right">Monthly Salary</TableHead>
                              <TableHead className="text-xs">Hired At</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {overview.staff.map((member) => (
                              <TableRow key={member.id} className="text-sm">
                                <TableCell className="text-sm">
                                  <div className="flex items-center gap-2">
                                    {member.building.country?.iso2 ? (
                                      <div className="relative w-4 h-4 shrink-0">
                                        <Image
                                          src={`/flags/${member.building.country.iso2.toUpperCase()}.svg`}
                                          alt={member.building.country.iso2}
                                          fill
                                          className="object-contain rounded-sm"
                                          sizes="16px"
                                        />
                                      </div>
                                    ) : (
                                      getBuildingRoleIcon(member.building.role)
                                    )}
                                    <span>
                                      {getBuildingRoleLabel(member.building.role)}
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm font-medium">
                                  {member.fullName}
                                </TableCell>
                                <TableCell className="text-sm">
                                  <div>
                                    <div className="font-medium text-sm">{member.roleName}</div>
                                    <div className="text-[10px] text-muted-foreground">
                                      {member.roleCode}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-sm text-right font-medium">
                                  {formatCurrency(member.monthlySalary)}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {formatDate(member.hiredAt)}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
