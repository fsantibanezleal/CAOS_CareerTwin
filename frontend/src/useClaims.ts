import { useQuery } from '@tanstack/react-query'
import { api } from './api'
import type { Claim } from './types'

/**
 * The profile's claims, one cache for every page. A page that shows requirement details calls it
 * on mount, so a detail opens with its evidence already loaded instead of a placeholder.
 */
export function useClaims(enabled = true) {
  return useQuery({ queryKey: ['claims'], queryFn: () => api<Claim[]>('/api/profile/claims'), enabled })
}
