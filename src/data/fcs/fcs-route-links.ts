import type { TaskRouteCardSourceType } from './task-print-cards.ts'
import {
  buildLegacyTaskRouteCardPrintLink,
  buildUnifiedPrintPreviewLink,
  type PrintDocumentType,
  type PrintSourceType,
} from './print-service.ts'

function encodeSegment(value: string): string {
  return encodeURIComponent(value)
}

export function buildProductionOrderLink(productionOrderId: string): string {
  return `/fcs/production/orders/${encodeSegment(productionOrderId)}`
}

export function buildTaskDetailLink(
  taskId: string,
  options?: {
    returnTo?: string
    sourceType?: string
    sourceId?: string
    currentFactoryId?: string
    keyword?: string
    tab?: string
  },
): string {
  const params = new URLSearchParams()
  if (options?.returnTo?.trim()) params.set('returnTo', options.returnTo.trim())
  if (options?.sourceType?.trim()) params.set('sourceType', options.sourceType.trim())
  if (options?.sourceId?.trim()) params.set('sourceId', options.sourceId.trim())
  if (options?.currentFactoryId?.trim()) params.set('currentFactoryId', options.currentFactoryId.trim())
  if (options?.keyword?.trim()) params.set('keyword', options.keyword.trim())
  if (options?.tab?.trim()) params.set('tab', options.tab.trim())
  const query = params.toString()
  return query ? `/fcs/pda/exec/${encodeSegment(taskId)}?${query}` : `/fcs/pda/exec/${encodeSegment(taskId)}`
}

export function buildHandoverOrderLink(handoverOrderId: string): string {
  return `/fcs/pda/handover/${encodeSegment(handoverOrderId)}`
}

export function buildHandoverRecordLink(handoverOrderId: string, handoverRecordId: string): string {
  return `${buildHandoverOrderLink(handoverOrderId)}?recordId=${encodeSegment(handoverRecordId)}`
}

export function buildQualityRecordLink(inspectionId: string): string {
  return `/fcs/quality/qc-records/${encodeSegment(inspectionId)}`
}

export function buildProductionConfirmationLink(productionOrderId: string): string {
  return `${buildProductionOrderLink(productionOrderId)}/confirmation-print`
}

export function buildProductionConfirmationPrintLink(productionOrderId: string): string {
  return buildUnifiedPrintPreviewLink({
    documentType: 'PRODUCTION_CONFIRMATION',
    sourceType: 'PRODUCTION_ORDER',
    sourceId: productionOrderId,
  })
}

export function buildMakeGoodsConfirmationPrintLink(productionOrderId: string): string {
  return buildUnifiedPrintPreviewLink({
    documentType: 'MAKE_GOODS_CONFIRMATION',
    sourceType: 'PRODUCTION_ORDER',
    sourceId: productionOrderId,
  })
}

export function buildTaskRouteCardPrintLink(sourceType: TaskRouteCardSourceType, sourceId: string): string {
  return buildUnifiedPrintPreviewLink({
    documentType: 'TASK_ROUTE_CARD',
    sourceType,
    sourceId,
  })
}

export { buildLegacyTaskRouteCardPrintLink }

export function buildUnifiedPrintPreviewRouteLink(input: {
  documentType: PrintDocumentType
  sourceType: PrintSourceType
  sourceId: string
  handoverRecordId?: string
}): string {
  return buildUnifiedPrintPreviewLink(input)
}

export function buildTaskDeliveryCardPrintLink(handoverRecordId: string): string {
  return buildUnifiedPrintPreviewLink({
    documentType: 'TASK_DELIVERY_CARD',
    sourceType: 'HANDOVER_RECORD',
    sourceId: handoverRecordId,
    handoverRecordId,
  })
}

export function buildMaterialPrepSlipPrintLink(sourceId: string): string {
  return buildUnifiedPrintPreviewLink({
    documentType: 'MATERIAL_PREP_SLIP',
    sourceType: 'MATERIAL_PREP_RECORD',
    sourceId,
  })
}

export function buildPickupSlipPrintLink(sourceId: string): string {
  return buildUnifiedPrintPreviewLink({
    documentType: 'PICKUP_SLIP',
    sourceType: 'PICKUP_SLIP_RECORD',
    sourceId,
  })
}

export function buildIssueSlipPrintLink(sourceId: string): string {
  return buildUnifiedPrintPreviewLink({
    documentType: 'ISSUE_SLIP',
    sourceType: 'ISSUE_SLIP_RECORD',
    sourceId,
  })
}

export function buildSupplementMaterialSlipPrintLink(sourceId: string): string {
  return buildUnifiedPrintPreviewLink({
    documentType: 'SUPPLEMENT_MATERIAL_SLIP',
    sourceType: 'SUPPLEMENT_MATERIAL_RECORD',
    sourceId,
  })
}

export function buildFeiTicketLabelPrintLink(sourceId: string, mode: 'first' | 'continue' | 'reprint' | 'void' = 'first'): string {
  const documentType: PrintDocumentType =
    mode === 'reprint' ? 'FEI_TICKET_REPRINT_LABEL' : mode === 'void' ? 'FEI_TICKET_VOID_LABEL' : 'FEI_TICKET_LABEL'
  return buildUnifiedPrintPreviewLink({
    documentType,
    sourceType: 'FEI_TICKET_RECORD',
    sourceId,
  })
}

export function buildTransferBagLabelPrintLink(sourceId: string): string {
  return buildUnifiedPrintPreviewLink({
    documentType: 'TRANSFER_BAG_LABEL',
    sourceType: 'TRANSFER_BAG_RECORD',
    sourceId,
  })
}

export function buildCuttingOrderQrLabelPrintLink(sourceId: string): string {
  return buildUnifiedPrintPreviewLink({
    documentType: 'CUTTING_ORDER_QR_LABEL',
    sourceType: 'CUTTING_ORDER_RECORD',
    sourceId,
  })
}

export function buildHandoverQrLabelPrintLink(handoverRecordId: string): string {
  return buildUnifiedPrintPreviewLink({
    documentType: 'HANDOVER_QR_LABEL',
    sourceType: 'HANDOVER_RECORD',
    sourceId: handoverRecordId,
  })
}

export function buildSettlementChangeRequestPrintLink(sourceId: string): string {
  return buildUnifiedPrintPreviewLink({
    documentType: 'SETTLEMENT_CHANGE_REQUEST',
    sourceType: 'SETTLEMENT_CHANGE_REQUEST_RECORD',
    sourceId,
  })
}

export function buildHandoverDifferenceRequestPrintLink(sourceId: string): string {
  return buildUnifiedPrintPreviewLink({
    documentType: 'HANDOVER_DIFFERENCE_REQUEST',
    sourceType: 'HANDOVER_DIFFERENCE_RECORD',
    sourceId,
  })
}

export function buildQualityDeductionConfirmationPrintLink(sourceId: string): string {
  return buildUnifiedPrintPreviewLink({
    documentType: 'QUALITY_DEDUCTION_CONFIRMATION',
    sourceType: 'QUALITY_DEDUCTION_PENDING_RECORD',
    sourceId,
  })
}

export function buildQualityDisputeProcessingPrintLink(sourceId: string): string {
  return buildUnifiedPrintPreviewLink({
    documentType: 'QUALITY_DISPUTE_PROCESSING',
    sourceType: 'QUALITY_DISPUTE_RECORD',
    sourceId,
  })
}

export function buildMasterDataChangeRequestPrintLink(sourceId: string): string {
  return buildUnifiedPrintPreviewLink({
    documentType: 'MASTER_DATA_CHANGE_REQUEST',
    sourceType: 'MASTER_DATA_CHANGE_REQUEST_RECORD',
    sourceId,
  })
}

export function buildPrintingOrderLink(printOrderId: string): string {
  return `/fcs/craft/printing/work-orders?printOrderId=${encodeSegment(printOrderId)}`
}

export function buildPrintingWorkOrderDetailLink(printOrderId: string): string {
  return `/fcs/craft/printing/work-orders/${encodeSegment(printOrderId)}`
}

export function buildDyeingOrderLink(dyeOrderId: string): string {
  return `/fcs/craft/dyeing/work-orders?dyeOrderId=${encodeSegment(dyeOrderId)}`
}

export function buildDyeingWorkOrderDetailLink(dyeOrderId: string): string {
  return `/fcs/craft/dyeing/work-orders/${encodeSegment(dyeOrderId)}`
}

export function buildPostFinishingWorkOrderDetailLink(postOrderId: string, tab?: string): string {
  const base = `/fcs/craft/post-finishing/work-orders/${encodeSegment(postOrderId)}`
  return tab ? `${base}?tab=${encodeSegment(tab)}` : base
}

export function buildPostFinishingWaitProcessWarehouseLink(postOrderId?: string): string {
  const base = '/fcs/craft/post-finishing/wait-process-warehouse'
  return postOrderId ? `${base}?postOrderId=${encodeSegment(postOrderId)}` : base
}

export function buildPostFinishingWaitHandoverWarehouseLink(postOrderId?: string): string {
  const base = '/fcs/craft/post-finishing/wait-handover-warehouse'
  return postOrderId ? `${base}?postOrderId=${encodeSegment(postOrderId)}` : base
}

export function buildCutOrderLink(originalCutOrderId: string): string {
  return `/fcs/craft/cutting/original-orders?originalCutOrderId=${encodeSegment(originalCutOrderId)}`
}

export function buildMaterialPrepLink(originalCutOrderId: string): string {
  return `/fcs/craft/cutting/material-prep?originalCutOrderId=${encodeSegment(originalCutOrderId)}`
}

export function buildFeiTicketLink(feiTicketId: string): string {
  return `/fcs/craft/cutting/fei-tickets?feiTicketId=${encodeSegment(feiTicketId)}`
}

export function buildTransferBagLink(transferBagId: string): string {
  return `/fcs/craft/cutting/transfer-bags?transferBagId=${encodeSegment(transferBagId)}`
}

export function buildReplenishmentLink(replenishmentId: string): string {
  return `/fcs/craft/cutting/replenishment?replenishmentId=${encodeSegment(replenishmentId)}`
}

export function buildCapacityProfileLink(factoryId: string): string {
  return `/fcs/factories/capacity-profile?factoryId=${encodeSegment(factoryId)}`
}
