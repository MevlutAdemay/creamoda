import { PrismaClient } from "@prisma/client";

type SizeProfileSeed = {
  code: string;
  name: string;
  description?: string;
  sizes: { label: string; code?: string }[];
};

function numRange(from: number, to: number): number[] {
  const out: number[] = [];
  for (let i = from; i <= to; i++) out.push(i);
  return out;
}

function numRangeStep(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to; v += step) out.push(v);
  return out;
}

function asNumeric(labels: number[], codePrefix: string) {
  return labels.map((n) => ({ label: String(n), code: `${codePrefix}${n}` }));
}

function asAlpha(labels: string[], codePrefix: string) {
  return labels.map((s) => ({ label: s, code: `${codePrefix}${s}` }));
}

const SEEDS: SizeProfileSeed[] = [
  // =========================
  // ÜST GİYİM (ALPHA)
  // =========================
  {
    code: "TOP_WOMEN_ALPHA_EU",
    name: "Üst Giyim - Kadın (EU)",
    description: "Kadın üst giyim alpha beden seti (XXS–XL)",
    sizes: asAlpha(["XXS", "XS", "S", "M", "L", "XL"], "EU_"),
  },
  {
    code: "TOP_WOMEN_ALPHA_US",
    name: "Üst Giyim - Kadın (US)",
    description: "Kadın üst giyim alpha beden seti (XXS–XL)",
    sizes: asAlpha(["XXS", "XS", "S", "M", "L", "XL"], "US_"),
  },
  {
    code: "TOP_MEN_ALPHA_EU",
    name: "Üst Giyim - Erkek (EU)",
    description: "Erkek üst giyim alpha beden seti (S–XXL)",
    sizes: asAlpha(["S", "M", "L", "XL", "XXL"], "EU_"),
  },
  {
    code: "TOP_MEN_ALPHA_US",
    name: "Üst Giyim - Erkek (US)",
    description: "Erkek üst giyim alpha beden seti (S–XXL)",
    sizes: asAlpha(["S", "M", "L", "XL", "XXL"], "US_"),
  },

  // =========================
  // ALT GİYİM (PANTS)
  // =========================
  {
    code: "BOTTOM_WOMEN_PANTS_EU",
    name: "Alt Giyim - Kadın Pantolon (EU)",
    description: "Kadın pantolon EU numeric (34–46)",
    sizes: asNumeric(numRange(34, 46), "EU_"),
  },
  {
    code: "BOTTOM_WOMEN_PANTS_US",
    name: "Alt Giyim - Kadın Pantolon (US)",
    description: "Kadın pantolon US numeric (0–14)",
    sizes: asNumeric(numRange(0, 14), "US_"),
  },
  {
    code: "BOTTOM_MEN_PANTS_EU",
    name: "Alt Giyim - Erkek Pantolon (EU)",
    description: "Erkek pantolon EU numeric (44–58)",
    sizes: asNumeric(numRange(44, 58), "EU_"),
  },
  {
    code: "BOTTOM_MEN_PANTS_US_WAIST",
    name: "Alt Giyim - Erkek Pantolon (US Bel - inch)",
    description: "Erkek pantolon bel ölçüsü (28–40)",
    sizes: asNumeric(numRange(28, 40), "W"),
  },

  // =========================
  // AYAKKABI
  // =========================
  {
    code: "SHOES_WOMEN_EU",
    name: "Ayakkabı - Kadın (EU)",
    description: "Kadın ayakkabı EU (35–42)",
    sizes: asNumeric(numRange(35, 42), "EU_"),
  },
  {
    code: "SHOES_WOMEN_US",
    name: "Ayakkabı - Kadın (US)",
    description: "Kadın ayakkabı US (5–11)",
    sizes: asNumeric(numRange(5, 11), "US_"),
  },
  {
    code: "SHOES_MEN_EU",
    name: "Ayakkabı - Erkek (EU)",
    description: "Erkek ayakkabı EU (39–46)",
    sizes: asNumeric(numRange(39, 46), "EU_"),
  },
  {
    code: "SHOES_MEN_US",
    name: "Ayakkabı - Erkek (US)",
    description: "Erkek ayakkabı US (7–13)",
    sizes: asNumeric(numRange(7, 13), "US_"),
  },
];

export async function seedSizeProfiles(prisma: PrismaClient) {
  console.log('📦 Seeding Size Profiles...');
  let profileCount = 0;
  let sizeCount = 0;

  for (const profile of SEEDS) {
    const sp = await prisma.sizeProfile.upsert({
      where: { code: profile.code },
      create: {
        code: profile.code,
        name: profile.name,
        description: profile.description ?? null,
        isActive: true,
      },
      update: {
        name: profile.name,
        description: profile.description ?? null,
        isActive: true,
      },
    });

    profileCount++;

    for (let i = 0; i < profile.sizes.length; i++) {
      const s = profile.sizes[i];
      await prisma.sizeProfileSize.upsert({
        where: {
          sizeProfileId_label: {
            sizeProfileId: sp.id,
            label: s.label,
          },
        },
        create: {
          sizeProfileId: sp.id,
          label: s.label,
          code: s.code ?? null,
          sortOrder: i + 1,
        },
        update: {
          code: s.code ?? null,
          sortOrder: i + 1,
        },
      });
      sizeCount++;
    }
  }

  console.log(`   ✓ Inserted/Updated ${profileCount} size profiles with ${sizeCount} sizes\n`);
  return { profileCount, sizeCount };
}
