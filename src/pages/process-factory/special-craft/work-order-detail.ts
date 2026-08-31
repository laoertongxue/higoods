import { renderSpecialCraftTaskDetailPage } from './task-detail.ts'

export function renderSpecialCraftWorkOrderDetailPage(operationSlug: string, workOrderId: string): string {
  return renderSpecialCraftTaskDetailPage(operationSlug, workOrderId)
}
