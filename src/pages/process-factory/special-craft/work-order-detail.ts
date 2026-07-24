export function renderSpecialCraftWorkOrderDetailPage(operationSlug: string, workOrderId: string): string {
  const taskOrderId = workOrderId.replace(/-WO-\d{3}-.*$/, '')
  const taskDetailPath = `/fcs/process-factory/special-craft/${encodeURIComponent(operationSlug)}/tasks/${encodeURIComponent(taskOrderId)}`
  return `<script>window.location.replace('${taskDetailPath}')</script><p>正在跳转到任务详情页...</p>`
}
