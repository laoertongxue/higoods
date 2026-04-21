function encodeSegment(value: string): string {
  return encodeURIComponent(value)
}

export function buildProductionOrderLink(productionOrderId: string): string {
  return `/fcs/production/orders/${encodeSegment(productionOrderId)}`
}

export function buildTaskDetailLink(taskId: string): string {
  return `/fcs/pda/exec/${encodeSegment(taskId)}`
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

export function buildPrintingOrderLink(printOrderId: string): string {
  return `/fcs/craft/printing/work-orders?printOrderId=${encodeSegment(printOrderId)}`
}

export function buildDyeingOrderLink(dyeOrderId: string): string {
  return `/fcs/craft/dyeing/work-orders?dyeOrderId=${encodeSegment(dyeOrderId)}`
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
