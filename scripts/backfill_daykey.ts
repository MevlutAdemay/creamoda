import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function backfillDayKey() {
  console.log('Starting dayKey String → DateTime backfill...');

  // Parse DailyProductSalesLog.dayKey
  const salesLogs = await prisma.dailyProductSalesLog.findMany({
    where: { dayKeyDt: null },
    select: { id: true, dayKey: true },
  });

  for (const log of salesLogs) {
    // "YYYY-MM-DD" → UTC midnight
    const dt = new Date(log.dayKey + 'T00:00:00Z');
    await prisma.dailyProductSalesLog.update({
      where: { id: log.id },
      data: { dayKeyDt: dt },
    });
  }

  console.log(`Backfilled ${salesLogs.length} DailyProductSalesLog rows`);

  // Parse WarehouseTrafficTunerState.updatedDayKey
  const tunerStates = await prisma.warehouseTrafficTunerState.findMany({
    where: { updatedDayKeyDt: null },
    select: { id: true, updatedDayKey: true },
  });

  for (const state of tunerStates) {
    const dt = new Date(state.updatedDayKey + 'T00:00:00Z');
    await prisma.warehouseTrafficTunerState.update({
      where: { id: state.id },
      data: { updatedDayKeyDt: dt },
    });
  }

  console.log(`Backfilled ${tunerStates.length} WarehouseTrafficTunerState rows`);

  // Populate BuildingMetricState cache fields for WAREHOUSE buildings
  const warehouseMetrics = await prisma.buildingMetricState.findMany({
    where: {
      building: { role: 'WAREHOUSE' },
      trafficBaseCached: null,
    },
    include: {
      metricLevelConfig: true,
      building: true,
    },
  });

  for (const metric of warehouseMetrics) {
    const config = metric.metricLevelConfig;
    const trafficBase = config?.hubTrafficBase ? Math.ceil(config.hubTrafficBase) : undefined;

    await prisma.buildingMetricState.update({
      where: { id: metric.id },
      data: {
        trafficBaseCached: trafficBase,
        // dailyOrderCap can be derived later from config or effectsJson
      },
    });
  }

  console.log(`Populated cache fields for ${warehouseMetrics.length} warehouse metrics`);

  console.log('Backfill complete!');
  await prisma.$disconnect();
}

backfillDayKey().catch((e) => {
  console.error(e);
  process.exit(1);
});
