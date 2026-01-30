import { PrismaClient, Prisma } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';
import { seedSizeProfiles } from './seed/size-profiles.seed';
import { seedMarketZoneSeasonScenarios } from './seed/market-zone-season-scenarios.seed';

const prisma = new PrismaClient();

// Type definitions for JSON data
type CountryJson = {
  id: string;
  name: string;
  iso2: string;
  iso3?: string | null;
  slug: string;
  latitude?: number | null;
  longitude?: number | null;
  heatZone: string;
  marketZone?: string | null;
  hemisphere?: string | null;
  overheadMultiplier?: string | null;
  rentMultiplier?: string | null;
  salaryMultiplier?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type RegionJson = {
  id: string;
  countryId: string;
  name: string;
  slug: string;
  createdAt?: string;
  updatedAt?: string;
};

type CityJson = {
  id: string;
  countryId: string;
  regionId?: string | null;
  name: string;
  slug: string;
  latitude?: number | null;
  longitude?: number | null;
  createdAt?: string;
  updatedAt?: string;
};

type BuildingTemplateJson = {
  id: string;
  code: string;
  role: string;
  name: string;
  description?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type ProductCategoryNodeJson = {
  id: string;
  level: string;
  code: string;
  name: string;
  slug: string;
  parentId?: string | null;
  manufacturingGroup?: string | null;
  defaultShippingProfile?: string | null;
  defaultSizeProfileId?: string | null;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
};

type ProductTemplateJson = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  categoryL3Id: string;
  styleId?: string | null;
  productSeason: string;
  thermalClass: string;
  baseCost: string | number;
  suggestedSalePrice: string | number;
  productQuality: string;
  productRarity?: string;
  shippingProfile?: string;
  unlockCostXp?: number | null;
  unlockCostDiamond?: number | null;
  isActive?: boolean;
  sizeProfileId?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type ProductImageTemplateJson = {
  id: string;
  productTemplateId: string;
  slot: string;
  url: string;
  alt?: string | null;
  unlockType?: string;
  unlockCostXp?: number | null;
  unlockCostDiamond?: number | null;
  meta?: any;
  sortOrder?: number;
  createdAt?: string;
  updatedAt?: string;
};

type StaffNameTemplateJson = {
  id: string;
  firstName: string;
  lastName: string;
  gender: string;
  countryCode: string;
  departmentCode?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

// Helper to read JSON files
function readJsonFile<T>(filename: string): T[] {
  const filePath = join(process.cwd(), 'public', 'JsonFile', filename);
  const content = readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as T[];
}

// Helper to convert string decimals to Prisma Decimal
function toDecimal(value: string | number | null | undefined): Prisma.Decimal | null {
  if (value === null || value === undefined) return null;
  return new Prisma.Decimal(value);
}

async function main() {
  console.log('🌱 Starting seed process...\n');

  // ID mapping maps
  const countryIdMap = new Map<string, string>();
  const regionIdMap = new Map<string, string>();
  const cityIdMap = new Map<string, string>();
  const categoryNodeIdMap = new Map<string, string>();
  const productTemplateIdMap = new Map<string, string>();

  try {
    // ==================== 0) SIZE PROFILES (must be before categories/templates) ====================
    await seedSizeProfiles(prisma);

    // ==================== 1) MARKET ZONE SEASON SCENARIOS (Excel; before ProductTemplates) ====================
    console.log('📦 Seeding MarketZoneSeasonScenario from Excel...');
    await seedMarketZoneSeasonScenarios(prisma);

    // ==================== A) COUNTRIES ====================
    console.log('📦 Seeding Countries...');
    const countries = readJsonFile<CountryJson>('countries.json');
    let countryCount = 0;

    for (const oldCountry of countries) {
      const country = await prisma.country.upsert({
        where: { iso2: oldCountry.iso2 },
        update: {
          name: oldCountry.name,
          iso3: oldCountry.iso3 || null,
          slug: oldCountry.slug,
          latitude: oldCountry.latitude ?? null,
          longitude: oldCountry.longitude ?? null,
          heatZone: oldCountry.heatZone as any,
          marketZone: (oldCountry.marketZone as any) || null,
          hemisphere: (oldCountry.hemisphere as any) || null,
          overheadMultiplier: toDecimal(oldCountry.overheadMultiplier) || new Prisma.Decimal(1.0),
          rentMultiplier: toDecimal(oldCountry.rentMultiplier) || new Prisma.Decimal(1.0),
          salaryMultiplier: toDecimal(oldCountry.salaryMultiplier) || new Prisma.Decimal(1.0),
        },
        create: {
          name: oldCountry.name,
          iso2: oldCountry.iso2,
          iso3: oldCountry.iso3 || null,
          slug: oldCountry.slug,
          latitude: oldCountry.latitude ?? null,
          longitude: oldCountry.longitude ?? null,
          heatZone: oldCountry.heatZone as any,
          marketZone: (oldCountry.marketZone as any) || null,
          hemisphere: (oldCountry.hemisphere as any) || null,
          overheadMultiplier: toDecimal(oldCountry.overheadMultiplier) || new Prisma.Decimal(1.0),
          rentMultiplier: toDecimal(oldCountry.rentMultiplier) || new Prisma.Decimal(1.0),
          salaryMultiplier: toDecimal(oldCountry.salaryMultiplier) || new Prisma.Decimal(1.0),
        },
      });
      countryIdMap.set(oldCountry.id, country.id);
      countryCount++;
    }
    console.log(`   ✓ Inserted/Updated ${countryCount} countries\n`);

    // ==================== B) REGIONS ====================
    console.log('📦 Seeding Regions...');
    const regions = readJsonFile<RegionJson>('regions.json');
    let regionCount = 0;

    for (const oldRegion of regions) {
      const newCountryId = countryIdMap.get(oldRegion.countryId);
      if (!newCountryId) {
        throw new Error(
          `Region ${oldRegion.id} (${oldRegion.name}) references missing countryId: ${oldRegion.countryId}`
        );
      }

      const region = await prisma.region.upsert({
        where: {
          countryId_slug: {
            countryId: newCountryId,
            slug: oldRegion.slug,
          },
        },
        update: {
          name: oldRegion.name,
          slug: oldRegion.slug,
        },
        create: {
          countryId: newCountryId,
          name: oldRegion.name,
          slug: oldRegion.slug,
        },
      });
      regionIdMap.set(oldRegion.id, region.id);
      regionCount++;
    }
    console.log(`   ✓ Inserted/Updated ${regionCount} regions\n`);

    // ==================== C) CITIES ====================
    console.log('📦 Seeding Cities...');
    const cities = readJsonFile<CityJson>('cities.json');
    let cityCount = 0;

    for (const oldCity of cities) {
      const newCountryId = countryIdMap.get(oldCity.countryId);
      if (!newCountryId) {
        throw new Error(
          `City ${oldCity.id} (${oldCity.name}) references missing countryId: ${oldCity.countryId}`
        );
      }

      const newRegionId = oldCity.regionId ? regionIdMap.get(oldCity.regionId) : null;
      if (oldCity.regionId && !newRegionId) {
        throw new Error(
          `City ${oldCity.id} (${oldCity.name}) references missing regionId: ${oldCity.regionId}`
        );
      }

      const city = await prisma.city.upsert({
        where: {
          countryId_slug: {
            countryId: newCountryId,
            slug: oldCity.slug,
          },
        },
        update: {
          name: oldCity.name,
          slug: oldCity.slug,
          regionId: newRegionId || null,
          latitude: oldCity.latitude ?? null,
          longitude: oldCity.longitude ?? null,
        },
        create: {
          countryId: newCountryId,
          regionId: newRegionId || null,
          name: oldCity.name,
          slug: oldCity.slug,
          latitude: oldCity.latitude ?? null,
          longitude: oldCity.longitude ?? null,
        },
      });
      cityIdMap.set(oldCity.id, city.id);
      cityCount++;
    }
    console.log(`   ✓ Inserted/Updated ${cityCount} cities\n`);

    // ==================== D) BUILDING TEMPLATES ====================
    // Note: BuildingTemplate model doesn't exist in current schema
    // Skipping building_templates.json for now
    console.log('📦 Skipping Building Templates (model not in schema)\n');

    // ==================== E) PRODUCT CATEGORY NODES (TREE) ====================
    console.log('📦 Seeding Product Category Nodes (tree structure)...');
    const categoryNodes = readJsonFile<ProductCategoryNodeJson>('product_category_nodes.json');
    
    // Separate nodes by level and parent
    const nodesByParent = new Map<string | null, ProductCategoryNodeJson[]>();
    for (const node of categoryNodes) {
      const parentKey = node.parentId || null;
      if (!nodesByParent.has(parentKey)) {
        nodesByParent.set(parentKey, []);
      }
      nodesByParent.get(parentKey)!.push(node);
    }

    // Insert in passes: L0 first, then children
    let categoryNodeCount = 0;
    const remaining = new Set(categoryNodes.map(n => n.id));
    let pass = 0;
    const maxPasses = 10; // Safety limit

    while (remaining.size > 0 && pass < maxPasses) {
      pass++;
      let insertedThisPass = 0;

      for (const node of Array.from(remaining)) {
        const nodeData = categoryNodes.find(n => n.id === node);
        if (!nodeData) continue;

        const newParentId = nodeData.parentId ? categoryNodeIdMap.get(nodeData.parentId) : null;
        
        // If has parent, parent must be mapped
        if (nodeData.parentId && !newParentId) {
          continue; // Skip, parent not ready
        }

        // Check if already exists by unique constraint
        const existing = await prisma.productCategoryNode.findUnique({
          where: {
            level_slug: {
              level: nodeData.level as any,
              slug: nodeData.slug,
            },
          },
        });

        if (existing) {
          categoryNodeIdMap.set(nodeData.id, existing.id);
          remaining.delete(node);
          insertedThisPass++;
          continue;
        }

        const categoryNode = await prisma.productCategoryNode.create({
          data: {
            level: nodeData.level as any,
            code: nodeData.code,
            name: nodeData.name,
            slug: nodeData.slug,
            parentId: newParentId || null,
            manufacturingGroup: (nodeData.manufacturingGroup as any) || null,
            defaultShippingProfile: (nodeData.defaultShippingProfile as any) || null,
            defaultSizeProfileId: nodeData.defaultSizeProfileId || null,
            isActive: nodeData.isActive ?? true,
          },
        });
        categoryNodeIdMap.set(nodeData.id, categoryNode.id);
        remaining.delete(node);
        insertedThisPass++;
        categoryNodeCount++;
      }

      if (insertedThisPass === 0) {
        // No progress made
        const remainingIds = Array.from(remaining).slice(0, 5);
        throw new Error(
          `Cannot resolve all category nodes. Remaining (sample): ${remainingIds.join(', ')}. Check parentId references.`
        );
      }
    }

    if (remaining.size > 0) {
      const remainingIds = Array.from(remaining).slice(0, 10);
      throw new Error(
        `Failed to insert ${remaining.size} category nodes. Sample IDs: ${remainingIds.join(', ')}`
      );
    }

    console.log(`   ✓ Inserted/Updated ${categoryNodeCount} category nodes\n`);

    // ==================== F) PRODUCT TEMPLATES ====================
    console.log('📦 Seeding Product Templates...');
    const productTemplates = readJsonFile<ProductTemplateJson>('product_templates.json');
    let templateCount = 0;

    for (const oldTemplate of productTemplates) {
      const mappedCategoryId = categoryNodeIdMap.get(oldTemplate.categoryL3Id);
      if (!mappedCategoryId) {
        throw new Error(
          `ProductTemplate ${oldTemplate.id} (${oldTemplate.code}) references missing categoryL3Id: ${oldTemplate.categoryL3Id}`
        );
      }

      // Validate sizeProfileId if provided
      let validSizeProfileId: string | null = null;
      if (oldTemplate.sizeProfileId) {
        const sizeProfileExists = await prisma.sizeProfile.findUnique({
          where: { id: oldTemplate.sizeProfileId },
        });
        if (sizeProfileExists) {
          validSizeProfileId = oldTemplate.sizeProfileId;
        } else {
          console.warn(
            `   ⚠ ProductTemplate ${oldTemplate.code}: sizeProfileId ${oldTemplate.sizeProfileId} not found, setting to null`
          );
        }
      }

      const template = await prisma.productTemplate.upsert({
        where: { code: oldTemplate.code },
        update: {
          name: oldTemplate.name,
          description: oldTemplate.description || null,
          categoryL3Id: mappedCategoryId,
          productSeason: oldTemplate.productSeason as any,
          thermalClass: oldTemplate.thermalClass as any,
          baseCost: toDecimal(oldTemplate.baseCost)!,
          suggestedSalePrice: toDecimal(oldTemplate.suggestedSalePrice)!,
          productQuality: oldTemplate.productQuality as any,
          productRarity: (oldTemplate.productRarity as any) || 'STANDARD',
          shippingProfile: (oldTemplate.shippingProfile as any) || 'MEDIUM',
          unlockCostXp: oldTemplate.unlockCostXp ?? null,
          unlockCostDiamond: oldTemplate.unlockCostDiamond ?? null,
          isActive: oldTemplate.isActive ?? true,
          sizeProfileId: validSizeProfileId,
        },
        create: {
          code: oldTemplate.code,
          name: oldTemplate.name,
          description: oldTemplate.description || null,
          categoryL3Id: mappedCategoryId,
          productSeason: oldTemplate.productSeason as any,
          thermalClass: oldTemplate.thermalClass as any,
          baseCost: toDecimal(oldTemplate.baseCost)!,
          suggestedSalePrice: toDecimal(oldTemplate.suggestedSalePrice)!,
          productQuality: oldTemplate.productQuality as any,
          productRarity: (oldTemplate.productRarity as any) || 'STANDARD',
          shippingProfile: (oldTemplate.shippingProfile as any) || 'MEDIUM',
          unlockCostXp: oldTemplate.unlockCostXp ?? null,
          unlockCostDiamond: oldTemplate.unlockCostDiamond ?? null,
          isActive: oldTemplate.isActive ?? true,
          sizeProfileId: validSizeProfileId,
          styleTags: [], // Empty array - required field
        } as any,
      } as any);
      productTemplateIdMap.set(oldTemplate.id, template.id);
      templateCount++;
    }
    console.log(`   ✓ Inserted/Updated ${templateCount} product templates\n`);

    // ==================== G) PRODUCT IMAGE TEMPLATES ====================
    console.log('📦 Seeding Product Image Templates...');
    const imageTemplates = readJsonFile<ProductImageTemplateJson>('product_image_templates.json');
    let imageCount = 0;

    for (const oldImage of imageTemplates) {
      const mappedProductId = productTemplateIdMap.get(oldImage.productTemplateId);
      if (!mappedProductId) {
        throw new Error(
          `ProductImageTemplate ${oldImage.id} references missing productTemplateId: ${oldImage.productTemplateId}`
        );
      }

      // Check if exists by (productTemplateId, slot, url)
      const existing = await prisma.productImageTemplate.findFirst({
        where: {
          productTemplateId: mappedProductId,
          slot: (oldImage.slot as any) || 'MAIN',
          url: oldImage.url,
        },
      });

      if (!existing) {
        await prisma.productImageTemplate.create({
          data: {
            productTemplateId: mappedProductId,
            slot: (oldImage.slot as any) || 'MAIN',
            url: oldImage.url,
            alt: oldImage.alt || null,
            unlockType: (oldImage.unlockType as any) || 'ALWAYS',
            unlockCostXp: oldImage.unlockCostXp ?? null,
            unlockCostDiamond: oldImage.unlockCostDiamond ?? null,
            meta: oldImage.meta || null,
            sortOrder: oldImage.sortOrder ?? 0,
          },
        });
        imageCount++;
      }
    }
    console.log(`   ✓ Inserted/Updated ${imageCount} product image templates\n`);

    // ==================== H) STAFF NAME TEMPLATES (BATCH) ====================
    console.log('📦 Seeding Staff Name Templates (batch insert)...');
    const staffNames = readJsonFile<StaffNameTemplateJson>('staff_name_templates.json');
    
    // Normalize and batch
    const batchSize = 1000;
    let staffNameCount = 0;
    const batches: StaffNameTemplateJson[][] = [];
    
    for (let i = 0; i < staffNames.length; i += batchSize) {
      batches.push(staffNames.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const data = batch.map((old) => ({
        firstName: old.firstName,
        lastName: old.lastName,
        gender: old.gender as any,
        countryCode: old.countryCode,
      }));

      const result = await (prisma as any).staffNameTemplate.createMany({
        data,
        skipDuplicates: true,
      });
      staffNameCount += result.count;
    }

    console.log(`   ✓ Inserted ${staffNameCount} staff name templates (${staffNames.length} total, duplicates skipped)\n`);

    console.log('✅ Seed completed successfully!');
    console.log('\nSummary:');
    console.log(`  - Size Profiles: Seeded`);
    console.log(`  - Countries: ${countryCount}`);
    console.log(`  - Regions: ${regionCount}`);
    console.log(`  - Cities: ${cityCount}`);
    console.log(`  - Category Nodes: ${categoryNodeCount}`);
    console.log(`  - Product Templates: ${templateCount}`);
    console.log(`  - Product Image Templates: ${imageCount}`);
    console.log(`  - Staff Name Templates: ${staffNameCount} (from ${staffNames.length} records)`);

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
