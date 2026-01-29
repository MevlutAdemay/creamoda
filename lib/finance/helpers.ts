/**
 * Finance Helper Functions
 * 
 * Standardized helpers for:
 * - Idempotency key generation (hash-based)
 * - Ledger entry posting (upsert pattern)
 * - Wallet transaction posting with balance update (upsert pattern)
 * - Money balance updates from ledger entries
 */

import { createHash } from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import {
  FinanceDirection,
  FinanceCategory,
  FinanceScopeType,
  FinanceCounterpartyType,
  WalletCurrency,
  WalletDirection,
  WalletTxnCategory,
  CompanyLedgerEntry,
  PlayerWalletTransaction,
} from '@prisma/client';

// Type for Prisma transaction client
type PrismaTransactionClient = Omit<
  typeof import('@/lib/prisma').default,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

/**
 * Generate deterministic idempotency key with hash.
 * Format: ACTION:<hash24>
 * Hash prevents delimiter collision and keeps index size small.
 * 
 * @param action - Action prefix (e.g., 'WIZARD:CAPEX', 'WIZARD:XP')
 * @param parts - Parts to hash (e.g., companyId, equipmentCode)
 * @returns Idempotency key string
 */
export function generateIdempotencyKey(action: string, ...parts: string[]): string {
  const hash = createHash('sha256')
    .update(parts.join('|'))
    .digest('hex')
    .substring(0, 24);
  return `${action}:${hash}`;
}

/**
 * Payload for posting a ledger entry
 */
export interface PostLedgerEntryPayload {
  companyId: string;
  dayKey: Date;
  direction: FinanceDirection;
  amountUsd: number | Decimal;
  category: FinanceCategory;
  scopeType: FinanceScopeType;
  scopeId?: string | null;
  counterpartyType: FinanceCounterpartyType;
  counterpartyId?: string | null;
  refType?: string | null;
  refId?: string | null;
  idempotencyKey: string;
  note?: string | null;
}

/**
 * Result from posting a ledger entry
 */
export interface PostLedgerEntryResult {
  entry: CompanyLedgerEntry;
  isNew: boolean;
}

/**
 * Post ledger entry with upsert pattern (no-op on duplicate).
 * Uses idempotencyKey as unique constraint.
 * Returns whether the entry was newly created (for balance updates).
 * 
 * @param tx - Prisma transaction client
 * @param payload - Ledger entry data
 * @returns Created or existing ledger entry with isNew flag
 */
export async function postLedgerEntry(
  tx: PrismaTransactionClient,
  payload: PostLedgerEntryPayload
): Promise<PostLedgerEntryResult> {
  const amountDecimal = payload.amountUsd instanceof Decimal 
    ? payload.amountUsd 
    : new Decimal(payload.amountUsd.toString());

  // First, check if this idempotency key already exists
  const existing = await tx.companyLedgerEntry.findUnique({
    where: { idempotencyKey: payload.idempotencyKey },
  });

  if (existing) {
    return { entry: existing, isNew: false };
  }

  // Create new entry
  const entry = await tx.companyLedgerEntry.create({
    data: {
      companyId: payload.companyId,
      dayKey: payload.dayKey,
      direction: payload.direction,
      amountUsd: amountDecimal,
      category: payload.category,
      scopeType: payload.scopeType,
      scopeId: payload.scopeId ?? null,
      counterpartyType: payload.counterpartyType,
      counterpartyId: payload.counterpartyId ?? null,
      refType: payload.refType ?? null,
      refId: payload.refId ?? null,
      idempotencyKey: payload.idempotencyKey,
      note: payload.note ?? null,
    },
  });

  return { entry, isNew: true };
}

/**
 * Payload for posting a wallet transaction
 */
export interface PostWalletTransactionPayload {
  userId: string;
  companyId?: string | null;
  dayKey: Date;
  currency: WalletCurrency;
  direction: WalletDirection;
  amount: number; // Always positive
  category: WalletTxnCategory;
  refType?: string | null;
  refId?: string | null;
  idempotencyKey: string;
  note?: string | null;
}

/**
 * Result from posting a wallet transaction
 */
export interface PostWalletTransactionResult {
  transaction: PlayerWalletTransaction;
  isNew: boolean;
}

/**
 * Post wallet transaction AND update balance atomically.
 * Uses check-then-create pattern for reliable idempotency.
 * Only updates balance if the transaction is newly created.
 * 
 * @param tx - Prisma transaction client
 * @param payload - Wallet transaction data
 * @returns Created or existing wallet transaction with isNew flag
 */
export async function postWalletTransactionAndUpdateBalance(
  tx: PrismaTransactionClient,
  payload: PostWalletTransactionPayload
): Promise<PostWalletTransactionResult> {
  // 1. Check if this idempotency key already exists
  const existing = await tx.playerWalletTransaction.findUnique({
    where: { idempotencyKey: payload.idempotencyKey },
  });

  if (existing) {
    return { transaction: existing, isNew: false };
  }

  // 2. Create new transaction
  const transaction = await tx.playerWalletTransaction.create({
    data: {
      userId: payload.userId,
      companyId: payload.companyId ?? null,
      dayKey: payload.dayKey,
      currency: payload.currency,
      direction: payload.direction,
      amount: payload.amount,
      category: payload.category,
      refType: payload.refType ?? null,
      refId: payload.refId ?? null,
      idempotencyKey: payload.idempotencyKey,
      note: payload.note ?? null,
    },
  });

  // 3. Update balance based on currency
  const delta = payload.direction === WalletDirection.IN ? payload.amount : -payload.amount;

  if (payload.currency === WalletCurrency.XP) {
    await tx.playerWallet.update({
      where: { userId: payload.userId },
      data: { balanceXp: { increment: delta } },
    });
  } else if (payload.currency === WalletCurrency.DIAMOND) {
    await tx.playerWallet.update({
      where: { userId: payload.userId },
      data: { balanceDiamond: { increment: delta } },
    });
  }

  return { transaction, isNew: true };
}

/**
 * Update player wallet USD balance from a ledger entry.
 * Only call this for newly created ledger entries.
 * 
 * @param tx - Prisma transaction client
 * @param userId - User ID who owns the wallet
 * @param entry - The ledger entry to apply
 */
export async function updateWalletUsdFromLedger(
  tx: PrismaTransactionClient,
  userId: string,
  entry: PostLedgerEntryResult
): Promise<void> {
  // Only update if the entry was newly created
  if (!entry.isNew) {
    return;
  }

  const amountDecimal = entry.entry.amountUsd;
  // OUT = decrease, IN = increase
  const delta = entry.entry.direction === FinanceDirection.OUT
    ? amountDecimal.negated()
    : amountDecimal;

  await tx.playerWallet.update({
    where: { userId },
    data: { balanceUsd: { increment: delta } },
  });
}

/**
 * Batch update player wallet USD balance from multiple ledger entries.
 * Only applies delta for newly created entries.
 * 
 * @param tx - Prisma transaction client
 * @param userId - User ID who owns the wallet
 * @param entries - Array of ledger entry results
 */
export async function updateWalletUsdFromLedgerBatch(
  tx: PrismaTransactionClient,
  userId: string,
  entries: PostLedgerEntryResult[]
): Promise<void> {
  // Calculate total delta from new entries only
  let totalDelta = new Decimal(0);

  for (const entry of entries) {
    if (entry.isNew) {
      const amount = entry.entry.amountUsd;
      if (entry.entry.direction === FinanceDirection.OUT) {
        totalDelta = totalDelta.sub(amount);
      } else {
        totalDelta = totalDelta.add(amount);
      }
    }
  }

  // Only update if there's a non-zero delta
  if (!totalDelta.isZero()) {
    await tx.playerWallet.update({
      where: { userId },
      data: { balanceUsd: { increment: totalDelta } },
    });
  }
}

/**
 * Post ledger entry and update wallet USD balance in one call.
 * Combines postLedgerEntry and updateWalletUsdFromLedger for convenience.
 * 
 * @param tx - Prisma transaction client
 * @param userId - User ID who owns the wallet
 * @param payload - Ledger entry data
 * @returns The ledger entry result
 */
export async function postLedgerEntryAndUpdateWallet(
  tx: PrismaTransactionClient,
  userId: string,
  payload: PostLedgerEntryPayload
): Promise<PostLedgerEntryResult> {
  const result = await postLedgerEntry(tx, payload);
  await updateWalletUsdFromLedger(tx, userId, result);
  return result;
}
