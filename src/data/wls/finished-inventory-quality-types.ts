/** 库存送检的唯一实物事实；不要求生产单、原车缝厂或回货身份。 */
export interface FinishedInventoryActor { actorId: string; actorName: string; roleName: string }
export interface FinishedInventorySku {
  skuId: string; skuCode: string; styleId: string; styleNo: string; styleName: string
  colorName: string; sizeName: string; imageUrl: string; barcode: string
}
export type FinishedInventoryQuality = '正常' | '瑕疵' | '破损'
export interface FinishedInventoryLot extends FinishedInventorySku {
  id: string; warehouseId: string; warehouseName: string; zoneName: string; locationCode: string
  quality: FinishedInventoryQuality; putaway: boolean; quantity: number; updatedAt: string
  sourceRef: string; identityVerified: boolean
}
export interface FinishedInventoryExclusion {
  id: string; orderLineId: string; warehouseId: string; skuId: string; lotId?: string
  quantity: number; stage: '订单占用' | '已拣货' | '待出库'; active: boolean; sourceRef: string
}
export interface FinishedInventoryApplicationLine extends FinishedInventorySku {
  outboundQty: number; receivedQty?: number
  allocations: Array<{ lotId: string; quantity: number; locationCode: string }>
}
export type FinishedInventoryTransferCategory = '送后道' | '正常返仓' | '瑕疵入仓' | '返工交接'
export interface FinishedInventoryTransferLine extends FinishedInventorySku {
  quantity: number; receivedQty?: number; locationCode?: string; putawayAt?: string
}
export interface FinishedInventoryTransfer {
  id: string; applicationId: string; applicationNo: string; category: FinishedInventoryTransferCategory
  sourceWarehouseId: string; sourceWarehouseName: string; targetId: string; targetName: string
  lines: FinishedInventoryTransferLine[]; createdAt: string; createdBy: string
  shippedAt?: string; shippedBy?: string; receivedAt?: string; receivedBy?: string; putawayAt?: string
}
export interface FinishedInventoryQcResult {
  skuId: string; inspectedQty: number; passedQty: number; defectQty: number; reworkQty: number
  uninspectedQty: number; releasedQty: number
}
export interface FinishedInventoryApplication {
  id: string; applicationNo: string; operationId: string; warehouseId: string; warehouseName: string
  styleId: string; styleNo: string; styleName: string; imageUrl: string; lines: FinishedInventoryApplicationLine[]
  createdAt: string; createdBy: string; outboundId: string; receivedAt?: string; receivedBy?: string
  qcTaskId?: string; qcTaskNo?: string; qcCompletedAt?: string; qcResults?: FinishedInventoryQcResult[]
  postTaskId?: string; postTaskNo?: string; processItems?: string[]; postCompletedAt?: string
  completedAt?: string
}
export interface FinishedInventoryDifference {
  id: string; applicationId: string; transferId: string; skuId: string; expectedQty: number; actualQty: number
  quantity: number; recordedAt: string; resolvedAt?: string; resolvedBy?: string; reason?: string; disposition?: string
}
export interface FinishedInventoryMovement {
  id: string; applicationId: string; transferId: string; warehouseId: string; warehouseName: string
  skuId: string; skuCode: string; styleId: string; styleNo: string; styleName: string; imageUrl: string
  locationCode: string; action: '送检出库' | '返仓实收' | '返仓上架' | '差异确认'
  quantity: number; beforeQty: number; afterQty: number; at: string; operator: string; remark: string
}
export interface FinishedInventoryScope { id: string; warehouseId: string; styleId: string; revision: number }
export interface FinishedInventoryState {
  lots: FinishedInventoryLot[]; exclusions: FinishedInventoryExclusion[]; applications: FinishedInventoryApplication[]
  transfers: FinishedInventoryTransfer[]; movements: FinishedInventoryMovement[]; differences: FinishedInventoryDifference[]
  scopes: FinishedInventoryScope[]
}
export interface FinishedInventoryEligibility {
  warehouseId: string; warehouseName: string; styleId: string; styleNo: string; styleName: string; imageUrl: string
  scopeRevision: number; totalNormal: number; excludedQty: number; eligibleQty: number
  sourceFingerprint: string; lines: FinishedInventoryApplicationLine[]
}
