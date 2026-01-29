import { PrismaClient, ProductSeason, Hemisphere } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

type SeasonWindowConfigSeed = {
  hemisphere: Hemisphere;
  season: ProductSeason;
  startDayOfYear: number;
  endDayOfYear: number;
  wrapsYear: boolean;
};

type SeasonalityProfileSeed = {
  code: string;
  name: string;
  season: ProductSeason;
  hardness: number; // 0..1
  keyframes: Array<{ dayOfYear: number; score: number }>;
};

const SEASON_WINDOW_CONFIGS: SeasonWindowConfigSeed[] = [
  // NORTH
  { hemisphere: Hemisphere.NORTH, season: ProductSeason.SUMMER, startDayOfYear: 152, endDayOfYear: 243, wrapsYear: false },
  { hemisphere: Hemisphere.NORTH, season: ProductSeason.WINTER, startDayOfYear: 335, endDayOfYear: 59, wrapsYear: true },
  
  // SOUTH
  { hemisphere: Hemisphere.SOUTH, season: ProductSeason.SUMMER, startDayOfYear: 335, endDayOfYear: 59, wrapsYear: true },
  { hemisphere: Hemisphere.SOUTH, season: ProductSeason.WINTER, startDayOfYear: 152, endDayOfYear: 243, wrapsYear: false },
];

const SEASONALITY_PROFILES: SeasonalityProfileSeed[] = [
  // WINTER profiles
  {
    code: "WINTER_CORE",
    name: "Winter Core",
    season: ProductSeason.WINTER,
    hardness: 0.85,
    keyframes: [
      { dayOfYear: 305, score: 10 },  // Nov1-ish
      { dayOfYear: 335, score: 40 },  // Dec1
      { dayOfYear: 350, score: 75 },  // Dec16
      { dayOfYear: 15, score: 100 },  // Jan15 peak
      { dayOfYear: 45, score: 75 },   // Feb14
      { dayOfYear: 59, score: 40 },   // Feb28 end
      { dayOfYear: 80, score: 0 },    // Mar21 off
    ],
  },
  {
    code: "WINTER_EARLY",
    name: "Winter Early",
    season: ProductSeason.WINTER,
    hardness: 0.90,
    keyframes: [
      { dayOfYear: 295, score: 20 },
      { dayOfYear: 325, score: 55 },
      { dayOfYear: 345, score: 90 },
      { dayOfYear: 10, score: 100 },
      { dayOfYear: 35, score: 70 },
      { dayOfYear: 59, score: 35 },
      { dayOfYear: 75, score: 0 },
    ],
  },
  {
    code: "WINTER_LATE",
    name: "Winter Late",
    season: ProductSeason.WINTER,
    hardness: 0.90,
    keyframes: [
      { dayOfYear: 315, score: 5 },
      { dayOfYear: 340, score: 45 },
      { dayOfYear: 360, score: 70 },
      { dayOfYear: 25, score: 100 },
      { dayOfYear: 55, score: 80 },
      { dayOfYear: 75, score: 40 },
      { dayOfYear: 95, score: 0 },
    ],
  },

  // SUMMER profiles
  {
    code: "SUMMER_CORE",
    name: "Summer Core",
    season: ProductSeason.SUMMER,
    hardness: 0.80,
    keyframes: [
      { dayOfYear: 120, score: 10 },  // Apr30-ish
      { dayOfYear: 152, score: 40 },  // Jun1
      { dayOfYear: 172, score: 75 },  // Jun21
      { dayOfYear: 196, score: 100 }, // Jul15 peak
      { dayOfYear: 220, score: 75 },  // Aug8
      { dayOfYear: 243, score: 40 },  // Aug31
      { dayOfYear: 270, score: 0 },   // Sep27
    ],
  },
  {
    code: "SUMMER_EARLY",
    name: "Summer Early",
    season: ProductSeason.SUMMER,
    hardness: 0.85,
    keyframes: [
      { dayOfYear: 110, score: 20 },
      { dayOfYear: 145, score: 60 },
      { dayOfYear: 175, score: 100 },
      { dayOfYear: 205, score: 80 },
      { dayOfYear: 235, score: 45 },
      { dayOfYear: 255, score: 10 },
      { dayOfYear: 270, score: 0 },
    ],
  },
  {
    code: "SUMMER_LATE",
    name: "Summer Late",
    season: ProductSeason.SUMMER,
    hardness: 0.85,
    keyframes: [
      { dayOfYear: 130, score: 5 },
      { dayOfYear: 160, score: 45 },
      { dayOfYear: 190, score: 80 },
      { dayOfYear: 215, score: 100 },
      { dayOfYear: 240, score: 75 },
      { dayOfYear: 260, score: 35 },
      { dayOfYear: 275, score: 0 },
    ],
  },

  // Non-seasonal profiles (ALL)
  {
    code: "ALL_SEASON",
    name: "All Season",
    season: ProductSeason.ALL,
    hardness: 0.30,
    keyframes: [
      { dayOfYear: 1, score: 60 },
      { dayOfYear: 90, score: 60 },
      { dayOfYear: 180, score: 60 },
      { dayOfYear: 270, score: 60 },
      { dayOfYear: 365, score: 60 },
    ],
  },
  {
    code: "BASIC_CORE",
    name: "Basic Core",
    season: ProductSeason.ALL,
    hardness: 0.40,
    keyframes: [
      { dayOfYear: 1, score: 45 },
      { dayOfYear: 90, score: 55 },
      { dayOfYear: 180, score: 65 },
      { dayOfYear: 270, score: 55 },
      { dayOfYear: 365, score: 45 },
    ],
  },
];

export async function seedSeasonality(prisma: PrismaClient) {
  console.log('📦 Seeding Seasonality (SeasonWindowConfig + SeasonalityProfile + SeasonalityKeyframe)...');
  
  let configCount = 0;
  let profileCount = 0;
  let keyframeCount = 0;

  // 1. Seed SeasonWindowConfig
  for (const config of SEASON_WINDOW_CONFIGS) {
    await prisma.seasonWindowConfig.upsert({
      where: {
        hemisphere_season: {
          hemisphere: config.hemisphere,
          season: config.season,
        },
      },
      create: {
        hemisphere: config.hemisphere,
        season: config.season,
        startDayOfYear: config.startDayOfYear,
        endDayOfYear: config.endDayOfYear,
        wrapsYear: config.wrapsYear,
        isActive: true,
      },
      update: {
        startDayOfYear: config.startDayOfYear,
        endDayOfYear: config.endDayOfYear,
        wrapsYear: config.wrapsYear,
        isActive: true,
      },
    });
    configCount++;
  }

  // 2. Seed SeasonalityProfile and SeasonalityKeyframe
  for (const profileSeed of SEASONALITY_PROFILES) {
    const profile = await prisma.seasonalityProfile.upsert({
      where: { code: profileSeed.code },
      create: {
        code: profileSeed.code,
        name: profileSeed.name,
        season: profileSeed.season,
        peakCeil: 100,
        inSeasonFloor: 0,
        offSeasonFloor: 0,
        hardness: new Decimal(profileSeed.hardness),
        isActive: true,
      },
      update: {
        name: profileSeed.name,
        season: profileSeed.season,
        peakCeil: 100,
        inSeasonFloor: 0,
        offSeasonFloor: 0,
        hardness: new Decimal(profileSeed.hardness),
        isActive: true,
      },
    });

    profileCount++;

    // 3. Seed SeasonalityKeyframe for this profile
    for (const keyframe of profileSeed.keyframes) {
      await prisma.seasonalityKeyframe.upsert({
        where: {
          profileId_dayOfYear: {
            profileId: profile.id,
            dayOfYear: keyframe.dayOfYear,
          },
        },
        create: {
          profileId: profile.id,
          dayOfYear: keyframe.dayOfYear,
          score: keyframe.score,
        },
        update: {
          score: keyframe.score,
        },
      });
      keyframeCount++;
    }
  }

  console.log(`   ✓ Inserted/Updated ${configCount} season window configs`);
  console.log(`   ✓ Inserted/Updated ${profileCount} seasonality profiles`);
  console.log(`   ✓ Inserted/Updated ${keyframeCount} seasonality keyframes\n`);

  return { configCount, profileCount, keyframeCount };
}
