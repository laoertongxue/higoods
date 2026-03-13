'use client'

import { Suspense } from 'react'
import { TaskBreakdownPage } from '@/components/fcs/process/task-breakdown-page'

export default function TaskBreakdownRoute() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">加载中...</div>}>
      <TaskBreakdownPage />
    </Suspense>
  )
}
