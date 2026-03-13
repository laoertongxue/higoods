'use client'

import { Suspense } from 'react'
import { HandoverPage } from '@/components/fcs/progress/handover-page'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4">加载中...</div>}>
      <HandoverPage />
    </Suspense>
  )
}
