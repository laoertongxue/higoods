'use client'

import { Suspense } from 'react'
import { DispatchBoardPage } from '@/components/fcs/dispatch/dispatch-board-page'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4">加载中...</div>}>
      <DispatchBoardPage />
    </Suspense>
  )
}
