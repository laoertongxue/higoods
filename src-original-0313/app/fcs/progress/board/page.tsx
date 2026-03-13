'use client'

import { Suspense } from 'react'
import { ProgressBoardPage } from '@/components/fcs/progress/progress-board-page'

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4">加载中...</div>}>
      <ProgressBoardPage />
    </Suspense>
  )
}
