/**
 * POST /api/player/player-product-images/:id/unlock
 * Unlock a product image with XP or DIAMOND. Single transaction:
 * - PlayerWalletTransaction OUT, PlayerWallet decrement
 * - PlayerProductImage: isUnlocked=true, unlockedAt=now (cost from paidXp/paidDiamond)
 * - ShowcaseListing: positiveBoostPct += 10, permanentPositiveBoostPct += 10 for all LISTED for this playerProductId
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/get-session';
import prisma from '@/lib/prisma';
import { WalletCurrency, WalletDirection, WalletTxnCategory } from '@prisma/client';
import { postWalletTransactionAndUpdateBalance } from '@/lib/finance/helpers';

type PayWith = 'XP' | 'DIAMOND';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await prisma.company.findFirst({
      where: { playerId: session.user.id },
      select: { id: true },
    });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { id: imageId } = await params;
    const body = await request.json().catch(() => ({}));
    const payWith = body?.payWith as PayWith | undefined;

    if (payWith !== 'XP' && payWith !== 'DIAMOND') {
      return NextResponse.json(
        { error: 'payWith must be "XP" or "DIAMOND"' },
        { status: 400 }
      );
    }

    const image = await prisma.playerProductImage.findUnique({
      where: { id: imageId },
      include: {
        playerProduct: { select: { id: true, companyId: true } },
        productImageTemplate: { select: { unlockCostXp: true, unlockCostDiamond: true } },
      },
    });

    if (!image || image.playerProduct.companyId !== company.id) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 });
    }

    if (image.isUnlocked) {
      return NextResponse.json({
        ok: true,
        alreadyUnlocked: true,
        image: {
          id: image.id,
          isUnlocked: true,
          unlockedAt: image.unlockedAt?.toISOString() ?? null,
        },
      });
    }

    // Cost from image (template copy) with fallback to template
    const template = image.productImageTemplate;
    const cost =
      payWith === 'XP'
        ? (image.paidXp ?? template?.unlockCostXp ?? null)
        : (image.paidDiamond ?? template?.unlockCostDiamond ?? null);
    if (cost == null || cost < 0) {
      return NextResponse.json(
        { error: 'Cost not configured' },
        { status: 400 }
      );
    }

    const currency: WalletCurrency = payWith === 'XP' ? 'XP' : 'DIAMOND';

    const wallet = await prisma.playerWallet.findUnique({
      where: { userId: session.user.id },
      select: { id: true, balanceXp: true, balanceDiamond: true },
    });

    if (!wallet) {
      return NextResponse.json(
        { error: 'Wallet not found' },
        { status: 404 }
      );
    }

    const balance = currency === 'XP' ? wallet.balanceXp : wallet.balanceDiamond;
    if (balance < cost) {
      return NextResponse.json(
        { error: 'Not enough XP/Diamond' },
        { status: 400 }
      );
    }

    const dayKey = new Date();
    dayKey.setUTCHours(0, 0, 0, 0);

    await prisma.$transaction(async (tx) => {
      await postWalletTransactionAndUpdateBalance(tx, {
        userId: session.user!.id,
        companyId: company.id,
        dayKey,
        currency,
        direction: WalletDirection.OUT,
        amount: cost,
        category: WalletTxnCategory.IMAGE_UNLOCK,
        refType: 'PlayerProductImage',
        refId: image.id,
        idempotencyKey: `image-unlock:${image.id}:${payWith}`,
        note: 'Unlocked product image',
      });

      await tx.playerProductImage.update({
        where: { id: image.id },
        data: {
          isUnlocked: true,
          unlockedAt: new Date(),
        },
      });

      await tx.showcaseListing.updateMany({
        where: {
          companyId: company.id,
          playerProductId: image.playerProductId,
          status: 'LISTED',
        },
        data: {
          positiveBoostPct: { increment: 10 },
          permanentPositiveBoostPct: { increment: 10 },
        },
      });
    });

    const updated = await prisma.playerProductImage.findUnique({
      where: { id: image.id },
      select: { isUnlocked: true, unlockedAt: true },
    });
    const newWallet = await prisma.playerWallet.findUnique({
      where: { userId: session.user.id },
      select: { balanceXp: true, balanceDiamond: true },
    });

    return NextResponse.json({
      ok: true,
      alreadyUnlocked: false,
      image: {
        id: image.id,
        isUnlocked: updated?.isUnlocked ?? true,
        unlockedAt: updated?.unlockedAt?.toISOString() ?? new Date().toISOString(),
      },
      wallet: newWallet
        ? { balanceXp: newWallet.balanceXp, balanceDiamond: newWallet.balanceDiamond }
        : null,
    });
  } catch (e) {
    console.error('[player-product-images unlock]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to unlock image' },
      { status: 500 }
    );
  }
}
