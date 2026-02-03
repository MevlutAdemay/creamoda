import { create } from 'zustand';

type InboxUnreadState = {
  unread: number;
  setUnread: (n: number) => void;
  increment: (n?: number) => void;
  decrement: (n?: number) => void;
};

export const useInboxUnread = create<InboxUnreadState>((set) => ({
  unread: 0,
  setUnread: (n) => set({ unread: Math.max(0, n) }),
  increment: (n = 1) => set((s) => ({ unread: s.unread + n })),
  decrement: (n = 1) => set((s) => ({ unread: Math.max(0, s.unread - n) })),
}));
