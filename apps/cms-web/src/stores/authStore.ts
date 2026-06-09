import { create } from 'zustand';

export type UserRole = 'PLATFORM_ADMIN' | 'ENTERPRISE_ADMIN' | 'REGIONAL_MANAGER' | 'VENUE_OPERATOR' | 'SPONSOR_STAKEHOLDER' | 'AUDITOR';

interface AuthStore {
  principalId: string | null;
  role: UserRole | null;
  enterpriseId: string | null;
  venueId: string | null; // for VENUE_OPERATOR scope
  isAuthenticated: boolean;
  setAuth: (auth: {
    principalId: string;
    role: UserRole;
    enterpriseId: string | null;
    venueId: string | null;
  }) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  principalId: null,
  role: null,
  enterpriseId: null,
  venueId: null,
  isAuthenticated: false,
  setAuth: (auth) => set({ ...auth, isAuthenticated: true }),
  clearAuth: () => set({ principalId: null, role: null, enterpriseId: null, venueId: null, isAuthenticated: false }),
}));
