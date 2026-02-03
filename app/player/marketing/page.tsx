import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { CategoryLevel, BuildingRole } from '@prisma/client';
import { getCompanyGameDayKey } from '@/lib/game/game-clock';
import MarketingPageClient from './MarketingPageClient';

export default async function MarketingPage() {
  const session = await getServerSession();
  if (!session?.user?.id) redirect('/login');

  const company = await prisma.company.findFirst({
    where: { playerId: session.user.id },
    select: { id: true },
  });
  if (!company) redirect('/wizard');

  const [warehouses, l2Categories, currentDayKey] = await Promise.all([
    prisma.companyBuilding.findMany({
      where: {
        companyId: company.id,
        role: BuildingRole.WAREHOUSE,
      },
      select: {
        id: true,
        name: true,
        marketZone: true,
        country: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.productCategoryNode.findMany({
      where: { level: CategoryLevel.L2, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        parent: { select: { name: true } },
      },
    }),
    getCompanyGameDayKey(company.id),
  ]);

  const warehouseOptions = warehouses.map((w) => ({
    id: w.id,
    name: w.name ?? null,
    marketZone: w.marketZone ?? null,
    countryName: w.country?.name ?? null,
  }));

  const l2Options = l2Categories.map((c) => ({
    id: c.id,
    name: c.name,
    parentName: c.parent?.name ?? null,
  }));

  const currentDayKeyStr = currentDayKey.toISOString().slice(0, 10);

  return (
    <MarketingPageClient
      warehouses={warehouseOptions}
      l2Categories={l2Options}
      currentDayKey={currentDayKeyStr}
    />
  );
}
