/**
 * Seeded Staff Name Selection
 * 
 * Deterministic staff name selection using shuffle + index approach.
 * Uses composite seed for stability across retries.
 */

import { createHash } from 'crypto';
import { StaffGender } from '@prisma/client';

// Type for Prisma transaction client
type PrismaTransactionClient = Omit<
  typeof import('@/lib/prisma').default,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Deterministic shuffle using seed.
 * Same seed + same list = same shuffle order.
 * Uses Fisher-Yates shuffle with seeded random.
 * 
 * @param array - Array to shuffle
 * @param seed - Seed string for deterministic shuffle
 * @returns Shuffled array (new array, original unchanged)
 */
function seededShuffle<T>(array: T[], seed: string): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const hash = createHash('sha256').update(`${seed}:${i}`).digest();
    const j = hash.readUInt32BE(0) % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Parameters for getting a seeded staff name
 */
export interface GetSeededStaffNameParams {
  countryCode: string;
  gender: StaffGender;
  userId: string;
  companyId: string;
  roleCode: string;
  index: number; // Position in role (0, 1, 2...)
}

/**
 * Get staff name deterministically with gender fallback logic.
 * Uses composite seed for stability across retries.
 * 
 * Algorithm:
 * 1. Try to fetch templates for country+requested gender
 * 2. If none, try other gender for same country
 * 3. If still none, try any gender for same country
 * 4. If still none, try any record (log warning)
 * 5. Create composite seed from userId:companyId:roleCode
 * 6. Shuffle templates deterministically
 * 7. Pick template by index (wraps around if index > length)
 * 
 * @param tx - Prisma transaction client
 * @param params - Parameters for name selection
 * @returns First name, last name, and actual gender used
 */
export async function getSeededStaffName(
  tx: PrismaTransactionClient,
  params: GetSeededStaffNameParams
): Promise<{ firstName: string; lastName: string; gender: StaffGender }> {
  const { countryCode, gender: requestedGender, userId, companyId, roleCode, index } = params;

  // Composite seed: stable across retries
  const seed = `${userId}:${companyId}:${roleCode}`;

  // Try to get templates with fallback logic
  let templates: Array<{ firstName: string; lastName: string; gender: StaffGender }> = [];
  let actualGender: StaffGender = requestedGender;

  // 1. Try requested gender for this country
  templates = await tx.staffNameTemplate.findMany({
    where: { countryCode, gender: requestedGender },
    select: { firstName: true, lastName: true, gender: true },
  });

  // 2. If none, try other gender for same country
  if (templates.length === 0) {
    const otherGender = requestedGender === StaffGender.MALE ? StaffGender.FEMALE : StaffGender.MALE;
    templates = await tx.staffNameTemplate.findMany({
      where: { countryCode, gender: otherGender },
      select: { firstName: true, lastName: true, gender: true },
    });
    if (templates.length > 0) {
      actualGender = otherGender;
    }
  }

  // 3. If still none, try any gender for same country
  if (templates.length === 0) {
    templates = await tx.staffNameTemplate.findMany({
      where: { countryCode },
      select: { firstName: true, lastName: true, gender: true },
    });
    if (templates.length > 0) {
      actualGender = templates[0].gender; // Use first template's gender
    }
  }

  // 4. If still none, try any record (last resort)
  if (templates.length === 0) {
    templates = await tx.staffNameTemplate.findMany({
      take: 100, // Limit to avoid huge queries
      select: { firstName: true, lastName: true, gender: true },
    });
    if (templates.length > 0) {
      actualGender = templates[0].gender;
      console.warn(
        `[getSeededStaffName] No templates found for country ${countryCode}, using fallback from any country.`
      );
    }
  }

  // Final check: if still no templates, throw error
  if (templates.length === 0) {
    throw new Error(
      `No staff name templates found in database. Please run seed for at least one country first.`
    );
  }

  // Shuffle deterministically and pick by index
  const shuffled = seededShuffle(templates, seed);
  const selected = shuffled[index % shuffled.length];

  return {
    firstName: selected.firstName,
    lastName: selected.lastName,
    gender: actualGender, // Return the actual gender used (may differ from requested)
  };
}

/**
 * Get multiple staff names deterministically.
 * Useful when assigning multiple staff members for a role.
 * 
 * @param tx - Prisma transaction client
 * @param params - Base parameters
 * @param count - Number of names to get
 * @returns Array of names
 */
export async function getSeededStaffNames(
  tx: PrismaTransactionClient,
  params: Omit<GetSeededStaffNameParams, 'index'>,
  count: number
): Promise<Array<{ firstName: string; lastName: string; gender: StaffGender }>> {
  const names: Array<{ firstName: string; lastName: string; gender: StaffGender }> = [];
  
  for (let i = 0; i < count; i++) {
    const name = await getSeededStaffName(tx, { ...params, index: i });
    names.push(name);
  }
  
  return names;
}

/**
 * Get a random staff name (non-seeded, legacy approach).
 * Use getSeededStaffName for wizard/idempotent operations.
 * 
 * @param tx - Prisma transaction client
 * @param countryCode - Country code (e.g., 'TR', 'DE')
 * @param gender - Gender filter (optional)
 * @returns First name and last name
 */
export async function getRandomStaffName(
  tx: PrismaTransactionClient,
  countryCode: string,
  gender?: StaffGender
): Promise<{ firstName: string; lastName: string; gender: StaffGender }> {
  const where: { countryCode: string; gender?: StaffGender } = { countryCode };
  if (gender) {
    where.gender = gender;
  }

  // Count total matching templates
  const totalCount = await tx.staffNameTemplate.count({ where });

  if (totalCount === 0) {
    throw new Error(
      `No staff name templates found for country ${countryCode}. Please run seed for this country first.`
    );
  }

  // Pick random offset
  const randomOffset = Math.floor(Math.random() * totalCount);
  
  const template = await tx.staffNameTemplate.findFirst({
    where,
    skip: randomOffset,
    take: 1,
  });

  if (!template) {
    throw new Error(
      `Failed to retrieve staff name template for country ${countryCode} at offset ${randomOffset}`
    );
  }

  return {
    firstName: template.firstName,
    lastName: template.lastName,
    gender: template.gender,
  };
}
