/**
 * Constitutional mutation guard hook.
 * Wraps TanStack Query useMutation to enforce constitutional state checks.
 *
 * Usage:
 *   const mutation = useMutationGuard(
 *     (data) => api.post('/campaigns', data),
 *     { onSuccess: () => refetch() }
 *   );
 *
 * The mutation will throw ConstitutionalMutationBlockedError if the system
 * is in READ_ONLY (for non-emergency routes) or EMERGENCY_FREEZE.
 */
import { useMutation, type UseMutationOptions, type UseMutationResult } from '@tanstack/react-query';
import { useConstitutionalState } from '../stores/constitutionalStore.js';

export function useMutationGuard<TData, TVariables, TError = Error>(
  mutationFn: (variables: TVariables) => Promise<TData>,
  options?: Omit<UseMutationOptions<TData, TError, TVariables>, 'mutationFn'>,
): UseMutationResult<TData, TError, TVariables> & {
  isBlocked: boolean;
  blockReason: string | null;
} {
  const { state } = useConstitutionalState();
  const isBlocked = state === 'EMERGENCY_FREEZE' || state === 'READ_ONLY';
  const blockReason = isBlocked ? state : null;

  const mutation = useMutation<TData, TError, TVariables>({
    mutationFn,
    retry: 0, // never retry — constitutional safety
    ...options,
  });

  return { ...mutation, isBlocked, blockReason };
}
