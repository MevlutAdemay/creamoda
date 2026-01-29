// app/api/wizard/company/route.ts
/**
 * Wizard Step 1: Create Company
 * 
 * Creates:
 * - Company record
 * - PlayerWallet (if not exists)
 * - Company buildings (HQ + WAREHOUSE) - idempotent
 * 
 * Sets:
 * - onboardingStatus = WIZARD
 * - onboardingStep = REVIEW
 * 
 * Does NOT create:
 * - Staff
 * - Equipment
 * - Ledger entries
 * - Game clock
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { OnboardingStatus } from '@prisma/client';
import { ensureCompanyBuildings } from '@/lib/company/ensure-company-buildings';

interface CreateCompanyBody {
  companyName: string;
  countryId: string;
  cityId: string;
}

export async function POST(request: NextRequest) {
  try {
    // 1. Auth check
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized - Please login first' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 2. Parse and validate body
    const body = (await request.json()) as CreateCompanyBody;
    
    if (!body.companyName?.trim()) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      );
    }

    if (!body.countryId) {
      return NextResponse.json(
        { error: 'Country is required' },
        { status: 400 }
      );
    }

    if (!body.cityId) {
      return NextResponse.json(
        { error: 'City is required' },
        { status: 400 }
      );
    }

    // 3. Validate country and city
    const country = await prisma.country.findUnique({
      where: { id: body.countryId },
      select: { id: true, name: true, iso2: true },
    });

    if (!country) {
      return NextResponse.json(
        { error: 'Country not found' },
        { status: 400 }
      );
    }

    const city = await prisma.city.findUnique({
      where: { id: body.cityId },
      select: { id: true, name: true, countryId: true },
    });

    if (!city) {
      return NextResponse.json(
        { error: 'City not found' },
        { status: 400 }
      );
    }

    if (city.countryId !== body.countryId) {
      return NextResponse.json(
        { error: 'City does not belong to selected country' },
        { status: 400 }
      );
    }

    // 4. Transaction: Create or update company
    const result = await prisma.$transaction(async (tx) => {
      // Check if company already exists
      const existingCompany = await tx.company.findFirst({
        where: { playerId: userId },
        include: {
          country: { select: { id: true, name: true, iso2: true } },
          city: { select: { id: true, name: true } },
        },
      });

      if (existingCompany) {
        // Update existing company if details changed
        const updated = await tx.company.update({
          where: { id: existingCompany.id },
          data: {
            name: body.companyName.trim(),
            countryId: body.countryId,
            cityId: body.cityId,
          },
          include: {
            country: { select: { id: true, name: true, iso2: true } },
            city: { select: { id: true, name: true } },
          },
        });

        // Ensure buildings exist (HQ + WAREHOUSE) - idempotent
        const buildings = await ensureCompanyBuildings(tx, {
          companyId: updated.id,
          countryId: body.countryId,
        });

        // Update user status
        await tx.user.update({
          where: { id: userId },
          data: {
            onboardingStatus: OnboardingStatus.WIZARD,
            onboardingStep: 'REVIEW',
          },
        });

        return { company: updated, buildings, isNew: false };
      }

      // Create new company
      const company = await tx.company.create({
        data: {
          playerId: userId,
          name: body.companyName.trim(),
          countryId: body.countryId,
          cityId: body.cityId,
          currencyCode: 'USD', // Default currency
        },
        include: {
          country: { select: { id: true, name: true, iso2: true } },
          city: { select: { id: true, name: true } },
        },
      });

      // Create wallet if not exists
      await tx.playerWallet.upsert({
        where: { userId },
        create: {
          userId,
          balanceUsd: 100000, // Starting balance: $100,000
          balanceXp: 0,
          balanceDiamond: 0,
        },
        update: {}, // No-op if exists
      });

      // Ensure buildings exist (HQ + WAREHOUSE) - idempotent
      const buildings = await ensureCompanyBuildings(tx, {
        companyId: company.id,
        countryId: body.countryId,
      });

      // Update user status
      await tx.user.update({
        where: { id: userId },
        data: {
          onboardingStatus: OnboardingStatus.WIZARD,
          onboardingStep: 'REVIEW',
        },
      });

      return { company, buildings, isNew: true };
    });

    return NextResponse.json({
      success: true,
      company: result.company,
      buildings: {
        hq: result.buildings.hqBuilding,
        warehouse: result.buildings.warehouseBuilding,
      },
      isNew: result.isNew,
    });
  } catch (error) {
    console.error('Error creating company:', error);
    return NextResponse.json(
      {
        error: 'Failed to create company',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
