// app/player/page.tsx – Home: Design Offices CTA + Season Status

import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { BuildingRole } from '@prisma/client';
import { getCompanyGameDayKey, parseDayKeyString, formatDayKeyString } from '@/lib/game/game-clock';
import {
  getSalesSeasonWindow,
  getCollectionWindow,
  getCurrentSalesWindow,
  getCurrentCollectionWindow,
  getOpenCollectionWindows,
  type Hemisphere as CalendarHemisphere,
} from '@/lib/game/season-calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PenLine, Calendar, Lightbulb } from 'lucide-react';
import { buildHomeGuidanceCards } from './_lib/home-guidance';

const MS_PER_DAY = 86400000;

export default async function PlayerPage() {
  const session = await getServerSession();
  if (!session?.user?.id) redirect('/login');

  if (session.user.role === 'SUPER_ADMIN' || session.user.role === 'CONTENT_MANAGER') {
    redirect('/admin/dashboard');
  }

  const company = await prisma.company.findFirst({
    where: { playerId: session.user.id },
    select: { id: true },
  });
  if (!company) redirect('/wizard');

  const dayKey = await getCompanyGameDayKey(company.id);
  const dayKeyStr = formatDayKeyString(dayKey);

  // Resolve hemisphere from first warehouse's country
  const firstWarehouse = await prisma.companyBuilding.findFirst({
    where: { companyId: company.id, role: BuildingRole.WAREHOUSE },
    select: { country: { select: { hemisphere: true } } },
    orderBy: { createdAt: 'asc' },
  });
  // TODO: if no warehouse or country.hemisphere null, consider marketZone-based fallback
  const hemisphere: CalendarHemisphere =
    firstWarehouse?.country?.hemisphere === 'SOUTH' ? 'SOUTH' : 'NORTH';

  const salesResult = getSalesSeasonWindow(dayKeyStr, hemisphere, { strict: false });
  const collectionResult = getCollectionWindow(dayKeyStr, hemisphere, { strict: false });
  const currentSales = salesResult?.current ?? getCurrentSalesWindow(dayKeyStr, hemisphere);
  const currentCollection =
    collectionResult?.current ?? getCurrentCollectionWindow(dayKeyStr, hemisphere);
  const openCollections = getOpenCollectionWindows(dayKeyStr, hemisphere);

  type OpenCollectionStat = { label: string; startDayKey: string; endDayKey: string; productCount: number };
  const openCollectionStats: OpenCollectionStat[] = [];
  for (const w of openCollections) {
    const startDate = parseDayKeyString(w.startDayKey);
    const endPlus1 = new Date(parseDayKeyString(w.endDayKey).getTime() + MS_PER_DAY);
    const productCount = await prisma.playerProduct.count({
      where: {
        companyId: company.id,
        isActive: true,
        isUnlocked: true,
        OR: [
          { launchedAtDayKey: { gte: startDate, lt: endPlus1 } },
          {
            launchedAtDayKey: null,
            createdAt: { gte: startDate, lt: endPlus1 },
          },
        ],
      },
    });
    openCollectionStats.push({
      label: w.label,
      startDayKey: w.startDayKey,
      endDayKey: w.endDayKey,
      productCount,
    });
  }

  const calendarUnavailable = !currentSales || (openCollections.length === 0);
  const nextSeasonLabel = salesResult?.next?.label ?? null;

  // Guidance: use first open window (calendar order) and its product count
  const primaryCollection = openCollections[0] ?? currentCollection;
  const primaryProductCount = openCollectionStats[0]?.productCount ?? 0;
  const guidanceCards = buildHomeGuidanceCards({
    dayKeyStr,
    currentCollection: primaryCollection,
    productCountCurrent: primaryProductCount,
  });

  return (
    <div className="min-h-full">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <p className="text-muted-foreground font-mono text-sm mb-6">{dayKeyStr}</p>

        {guidanceCards.length > 0 && (
          <section className="mb-6 space-y-3">
            <h2 className="text-sm font-medium text-muted-foreground">Guidance</h2>
            <div className="grid grid-cols-1 gap-3">
              {guidanceCards.map((card) => (
                <Card key={card.id} className="border-primary/20">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Lightbulb className="h-5 w-5 text-muted-foreground" />
                        {card.title}
                      </CardTitle>
                      <Badge variant="secondary" className="font-normal shrink-0">
                        Recommended
                      </Badge>
                    </div>
                    <CardDescription>{card.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button asChild variant="default" className="w-full sm:w-auto">
                      <Link href={card.ctaHref}>{card.ctaLabel}</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
          {/* Season Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                Season Status
              </CardTitle>
              <CardDescription>
                Active sales season and current collection window.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-normal">
                  {hemisphere === 'NORTH' ? 'North' : 'South'} hemisphere
                </Badge>
              </div>

              {calendarUnavailable ? (
                <p className="text-sm text-muted-foreground">
                  Calendar not available for this date.
                </p>
              ) : (
                <>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Active Season</span>
                    <span className="font-medium">
                      {currentSales.season} · {currentSales.label}
                    </span>
                  </div>
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">Open Collections</p>
                    <ul className="space-y-1.5">
                      {openCollectionStats.map((stat) => (
                        <li key={stat.label} className="flex justify-between text-sm">
                          <span className="font-medium">{stat.label}</span>
                          <span className="tabular-nums text-muted-foreground">
                            {stat.productCount} product{stat.productCount !== 1 ? 's' : ''}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  {nextSeasonLabel && (
                    <p className="text-xs text-muted-foreground pt-1">
                      Next season: {nextSeasonLabel}
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
