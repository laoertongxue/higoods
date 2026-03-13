'use client'

import { Suspense } from 'react'
import { ExceptionsPage } from '@/components/fcs/progress/exceptions-page'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4">加载中...</div>}>
      <ExceptionsPage />
    </Suspense>
  )
}
