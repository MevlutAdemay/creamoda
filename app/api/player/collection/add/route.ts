// app/api/player/collection/add/route.ts

/**
 * Add product to collection (unlock and add to PlayerProduct).
 * POST body: { companyId, productTemplateId, idempotencyKey }
 * Idempotent: same key returns success without double-deducting wallet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import {
  UnlockMethod,
  WalletCurrency,
  WalletDirection,
  WalletTxnCategory,
  ProductImageUnlockType,
} from '@prisma/client';
import { getCompanyGameDayKey } from '@/lib/game/game-clock';
import { postWalletTransactionAndUpdateBalance } from '@/lib/finance/helpers';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { companyId, productTemplateId, idempotencyKey } = body as {
      companyId?: string;
      productTemplateId?: string;
      idempotencyKey?: string;
    };

    if (!companyId || !productTemplateId) {
      return NextResponse.json(
        { error: 'companyId and productTemplateId are required' },
        { status: 400 }
      );
    }

    // Verify user owns the company
    const company = await prisma.company.findFirst({
      where: { id: companyId, playerId: session.user.id },
      select: { id: true },
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const userId = session.user.id;
    // Company game clock dayKey: used for launchedAtDayKey so lifecycle/economy are consistent.
    const dayKey = await getCompanyGameDayKey(companyId);

    const result = await prisma.$transaction(
      async (tx) => {
        // Already in collection? Idempotent return without deducting again (unique [companyId, productTemplateId]).
        const existing = await tx.playerProduct.findUnique({
          where: {
            companyId_productTemplateId: { companyId, productTemplateId },
          },
          select: { id: true },
        });

        if (existing) {
          const wallet = await tx.playerWallet.findUnique({
            where: { userId },
            select: { balanceXp: true, balanceDiamond: true },
          });
          return {
            isNew: false,
            balanceXp: wallet?.balanceXp ?? 0,
            balanceDiamond: wallet?.balanceDiamond ?? 0,
          };
        }

        // Load template: economy fields (for overrides at creation time), unlock costs, and image templates with unlockType.
        const template = await tx.productTemplate.findUnique({
          where: { id: productTemplateId },
          select: {
            id: true,
            name: true,
            baseCost: true,
            suggestedSalePrice: true,
            unlockCostXp: true,
            unlockCostDiamond: true,
            productImageTemplates: {
              orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
              select: { id: true, unlockType: true },
            },
          },
        });

        if (!template) {
          throw new Error('ProductTemplate not found');
        }

        const unlockCostXp = template.unlockCostXp ?? 0;
        const unlockCostDiamond = template.unlockCostDiamond ?? 0;

        // Validate wallet before creating product
        if (unlockCostXp > 0 || unlockCostDiamond > 0) {
          const wallet = await tx.playerWallet.findUnique({
            where: { userId },
            select: { balanceXp: true, balanceDiamond: true },
          });
          if (!wallet) {
            throw new Error('Wallet not found');
          }
          if (wallet.balanceXp < unlockCostXp || wallet.balanceDiamond < unlockCostDiamond) {
            throw new Error('Insufficient balance');
          }
        }

        const now = new Date();
        const unlockMethod: UnlockMethod =
          unlockCostXp > 0 ? UnlockMethod.XP : unlockCostDiamond > 0 ? UnlockMethod.DIAMOND : UnlockMethod.FREE;

        // Upsert PlayerProduct (idempotent on unique [companyId, productTemplateId]).
        // Copy economy and lifecycle from template/clock so critical fields are never null for new rows.
        const playerProduct = await tx.playerProduct.upsert({
          where: {
            companyId_productTemplateId: { companyId, productTemplateId },
          },
          create: {
            companyId,
            productTemplateId,
            displayName: template.name,
            baseCostOverride: template.baseCost,
            suggestedPriceOverride: template.suggestedSalePrice,
            launchedAtDayKey: dayKey,
            isUnlocked: true,
            unlockedAt: now,
            unlockMethod,
            unlockCostXp: unlockCostXp || null,
            unlockCostDiamond: unlockCostDiamond || null,
          },
          update: {
            isUnlocked: true,
            unlockedAt: now,
            unlockMethod,
            unlockCostXp: unlockCostXp || null,
            unlockCostDiamond: unlockCostDiamond || null,
          },
          select: { id: true },
        });

        // Create PlayerProductImage for each ProductImageTemplate (idempotent via unique [playerProductId, productImageTemplateId]).
        // Images are NOT all unlocked by default: only unlockType === ALWAYS is unlocked; PURCHASE_* require separate unlock flow (showcase/marketing/premium).
        for (const img of template.productImageTemplates) {
          const isAlwaysUnlock = img.unlockType === ProductImageUnlockType.ALWAYS;
          await tx.playerProductImage.upsert({
            where: {
              playerProductId_productImageTemplateId: {
                playerProductId: playerProduct.id,
                productImageTemplateId: img.id,
              },
            },
            create: {
              playerProductId: playerProduct.id,
              productImageTemplateId: img.id,
              isUnlocked: isAlwaysUnlock,
              unlockedAt: isAlwaysUnlock ? now : null,
              unlockMethod: isAlwaysUnlock ? UnlockMethod.FREE : null,
              paidXp: null,
              paidDiamond: null,
            },
            update: {
              isUnlocked: isAlwaysUnlock,
              unlockedAt: isAlwaysUnlock ? now : null,
              unlockMethod: isAlwaysUnlock ? UnlockMethod.FREE : null,
              paidXp: null,
              paidDiamond: null,
            },
          });
        }

        // Deduct wallet (idempotent via idempotencyKey)
        const baseKey = idempotencyKey && idempotencyKey.trim() !== '' ? idempotencyKey : `collection:${companyId}:${productTemplateId}`;

        if (unlockCostXp > 0) {
          await postWalletTransactionAndUpdateBalance(tx, {
            userId,
            companyId,
            dayKey,
            currency: WalletCurrency.XP,
            direction: WalletDirection.OUT,
            amount: unlockCostXp,
            category: WalletTxnCategory.OTHER,
            refType: 'PlayerProduct',
            refId: playerProduct.id,
            idempotencyKey: `${baseKey}:XP`,
            note: 'Product unlock',
          });
        }
        if (unlockCostDiamond > 0) {
          await postWalletTransactionAndUpdateBalance(tx, {
            userId,
            companyId,
            dayKey,
            currency: WalletCurrency.DIAMOND,
            direction: WalletDirection.OUT,
            amount: unlockCostDiamond,
            category: WalletTxnCategory.OTHER,
            refType: 'PlayerProduct',
            refId: playerProduct.id,
            idempotencyKey: `${baseKey}:DIAMOND`,
            note: 'Product unlock',
          });
        }

        const wallet = await tx.playerWallet.findUnique({
          where: { userId },
          select: { balanceXp: true, balanceDiamond: true },
        });

        return {
          isNew: true,
          balanceXp: wallet?.balanceXp ?? 0,
          balanceDiamond: wallet?.balanceDiamond ?? 0,
        };
      },
      { timeout: 15000 }
    );

    return NextResponse.json({
      success: true,
      isInCollection: true,
      balanceXp: result.balanceXp,
      balanceDiamond: result.balanceDiamond,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Add to collection failed';
    if (message === 'ProductTemplate not found') {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    if (message === 'Insufficient balance' || message === 'Wallet not found') {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    console.error('Collection add error:', err);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
