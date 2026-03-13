'use client'

import { Suspense } from 'react'
import DyePrintOrdersPage from '@/components/fcs/process/dye-print-orders-page'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-muted-foreground">加载中…</div>}>
      <DyePrintOrdersPage />
    </Suspense>
  )
}
