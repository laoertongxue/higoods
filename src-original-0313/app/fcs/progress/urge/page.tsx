'use client'

import { Suspense } from 'react'
import { UrgePage } from '@/components/fcs/progress/urge-page'

export default function UrgePageRoute() {
  return (
    <Suspense fallback={<div className="p-4">加载中...</div>}>
      <UrgePage />
    </Suspense>
  )
}
