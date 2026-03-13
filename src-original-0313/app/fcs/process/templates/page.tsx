'use client'

// 任务编排模板已因业务边界冲突移除，旧入口统一收口到任务清单
export default function ProcessTemplatesPage() {
  if (typeof window !== 'undefined') {
    window.location.href = '/fcs/process/task-breakdown'
  }
  return null
}
