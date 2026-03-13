'use client'

import { usePathname } from 'next/navigation'
import { AppShell } from '@/components/app-shell'
import { FcsProvider } from '@/lib/fcs/fcs-store'

/**
 * FCS Layout
 *
 * IMPORTANT: Always render the SAME React tree structure regardless of pathname.
 * Conditional early returns create different tree shapes between branches,
 * which causes hydration mismatches because React expects a stable component hierarchy.
 *
 * For PDA routes we skip the AppShell wrapper but still render a consistent tree.
 */
export default function FCSLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isPda = pathname.startsWith('/fcs/pda')

  // Always render FcsProvider as outermost wrapper.
  // PDA routes skip AppShell (they have their own shell).
  return (
    <FcsProvider>
      {isPda ? children : <AppShell systemId="fcs">{children}</AppShell>}
    </FcsProvider>
  )
}
