import * as core from './process-order-task-link-core.ts'
import { listProcessWorkOrderRelationSources } from './process-work-order-domain.ts'
import type { TechnicalProcessEntry } from '../pcs-technical-data-version-types.ts'
import type { ProcessOrderTaskDocumentRef } from './process-order-task-link-core.ts'

// Existing synchronous consumers continue using the original complete source reader.
export * from './process-order-task-link-core.ts'

export function buildProcessOrderTaskLinks(
  documents: ProcessOrderTaskDocumentRef[] = core.listProcessOrderTaskDocuments(listProcessWorkOrderRelationSources),
  entriesByOrder?: Map<string, TechnicalProcessEntry[]>,
) { return core.buildProcessOrderTaskLinks(documents, entriesByOrder) }

export function listProcessOrderTaskDocuments() {
  return core.listProcessOrderTaskDocuments(listProcessWorkOrderRelationSources)
}
export function listProcessOrderTaskLinksByProductionOrder(productionOrderId: string) {
  return core.listProcessOrderTaskLinksByProductionOrder(listProcessWorkOrderRelationSources, productionOrderId)
}
export function getProcessOrderTaskRelationView(documentId: string, productionOrderIdHint?: string) {
  return core.getProcessOrderTaskRelationView(listProcessWorkOrderRelationSources, documentId, productionOrderIdHint)
}
export function getProcessOrderTaskRelationViewByDetail(documentId: string, detailId: string) {
  return core.getProcessOrderTaskRelationViewByDetail(listProcessWorkOrderRelationSources, documentId, detailId)
}
export function listProcessOrderTaskRelationViewsByProductionOrder(productionOrderId: string) {
  return core.listProcessOrderTaskRelationViewsByProductionOrder(listProcessWorkOrderRelationSources, productionOrderId)
}
export function listProcessOrderTaskRelationViewsByOccurrence(occurrenceEntryId: string, productionOrderId?: string) {
  return core.listProcessOrderTaskRelationViewsByOccurrence(listProcessWorkOrderRelationSources, occurrenceEntryId, productionOrderId)
}
