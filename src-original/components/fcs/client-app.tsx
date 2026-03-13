'use client'

import { AppShell } from '@/components/app-shell'
import { FcsProvider } from '@/lib/fcs/fcs-store'
import { SpaPageRouter } from '@/components/fcs/spa-page-router'

export default function ClientApp() {
  return (
    <AppShell systemId="fcs">
      <FcsProvider>
        <SpaPageRouter />
      </FcsProvider>
    </AppShell>
  )
}
