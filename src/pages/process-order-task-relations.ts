import { getProcessOrderTaskRelationView } from '../data/fcs/process-order-task-links.ts'
import { renderProcessOrderTaskRelationView } from './process-order-task-relations-view.ts'

export function renderProcessOrderTaskRelations(documentId: string, productionOrderId?: string): string {
  return renderProcessOrderTaskRelationView(getProcessOrderTaskRelationView(documentId, productionOrderId))
}
