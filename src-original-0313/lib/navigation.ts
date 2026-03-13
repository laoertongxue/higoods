/**
 * Navigation shim — replaces next/navigation hooks with SPA equivalents.
 * Uses the same spaNavigate helper from app-shell-context so all navigation
 * goes through History API pushState — no full-page reloads, no RSC fetches.
 */

import { spaNavigate, useSpaPathname } from '@/components/app-shell/app-shell-context'

export function useRouter() {
  return {
    push: (href: string) => { spaNavigate(href) },
    replace: (href: string) => { spaNavigate(href) },
    back: () => { /* no-op in pure SPA mode */ },
    forward: () => { /* no-op in pure SPA mode */ },
    refresh: () => { /* no-op */ },
    prefetch: () => {},
  }
}

// Re-export the SPA-aware pathname hook
export const usePathname = useSpaPathname

export function useSearchParams() {
  if (typeof window === 'undefined') {
    return new URLSearchParams()
  }
  return new URLSearchParams(window.location.search)
}

export function useParams(): Record<string, string | string[]> {
  if (typeof window === 'undefined') return {}
  // Parse params from the URL using the segment pattern
  const pathname = window.location.pathname
  const segments = pathname.split('/').filter(Boolean)
  // Return last segment as a generic id — components that need specific param
  // names should destructure from this object
  const params: Record<string, string> = {}
  if (segments.length > 0) params['id'] = segments[segments.length - 1]
  if (segments.length > 1) params['taskId'] = segments[segments.length - 1]
  if (segments.length > 1) params['qcId'] = segments[segments.length - 1]
  if (segments.length > 1) params['eventId'] = segments[segments.length - 1]
  if (segments.length > 1) params['factoryId'] = segments[segments.length - 1]
  return params
}
