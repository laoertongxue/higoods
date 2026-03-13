'use client'

import { type ReactNode } from 'react'
import dynamic from 'next/dynamic'

// Import the entire PDA wrapper as client-only (ssr: false).
// This means Next.js renders NOTHING for this layout during SSR —
// the server emits an empty placeholder, eliminating any possible
// hydration mismatch. The PDA is an internal mobile tool, so SSR
// adds no value; client-only rendering is the correct tradeoff.
const PdaWrapper = dynamic(() => import('./pda-wrapper'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  ),
})

export default function PdaLayout({ children }: { children: ReactNode }) {
  return <PdaWrapper>{children}</PdaWrapper>
}
