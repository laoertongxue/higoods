import { renderSpecialCraftTaskDetailPage } from './task-detail.ts'

export function renderSpecialCraftWorkOrderDetailPage(operationSlug: string, workOrderId: string): Promise<string> {
  return renderSpecialCraftTaskDetailPage(operationSlug, workOrderId)
}
