import { create } from 'zustand';

type Wallet = {
  balanceUsd: number;
  balanceXp: number;
  balanceDiamond: number;
};

type WalletState = Wallet & {
  setWallet: (w: Partial<Wallet>) => void;
  applyDelta: (d: Partial<Wallet>) => void;
};

export const usePlayerWallet = create<WalletState>((set) => ({
  balanceUsd: 0,
  balanceXp: 0,
  balanceDiamond: 0,

  setWallet: (w) =>
    set((s) => ({
      ...s,
      balanceUsd: w.balanceUsd ?? s.balanceUsd,
      balanceXp: w.balanceXp ?? s.balanceXp,
      balanceDiamond: w.balanceDiamond ?? s.balanceDiamond,
    })),

  applyDelta: (d) =>
    set((s) => ({
      balanceUsd: s.balanceUsd + (d.balanceUsd ?? 0),
      balanceXp: s.balanceXp + (d.balanceXp ?? 0),
      balanceDiamond: s.balanceDiamond + (d.balanceDiamond ?? 0),
    })),
}));
