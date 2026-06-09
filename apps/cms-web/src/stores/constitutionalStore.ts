import { create } from 'zustand';
import type { ConstitutionalState } from '@clubhub/constitutional-types';

interface ConstitutionalStore {
  state: ConstitutionalState;
  reason: string | null;
  lastUpdated: number | null;
  setConstitutionalState: (state: ConstitutionalState, reason: string | null) => void;
}

export const useConstitutionalStore = create<ConstitutionalStore>((set) => ({
  state: 'HEALTHY',
  reason: null,
  lastUpdated: null,
  setConstitutionalState: (state, reason) =>
    set({ state, reason, lastUpdated: Date.now() }),
}));

export function useConstitutionalState(): Pick<ConstitutionalStore, 'state' | 'reason'> {
  return useConstitutionalStore((s) => ({ state: s.state, reason: s.reason }));
}
