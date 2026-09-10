import type { TechnicalPatternPieceSpecialCraft } from '../../../data/pcs-technical-data-version-types.ts'

export type BindingProcessMode = '裁床内部加工' | '外部承接工厂加工'
export type BindingProcessStatus = '待加工' | '加工中' | '已完成' | '已取消'
export type BindingProcessPrintStatus = '未生成' | '待打印' | '已打印'
export type BindingProcessInboundStatus = '未入仓' | '部分入仓' | '已入仓'
export type BindingProcessHandoverStatus = '未装袋' | '已装袋待交出' | '已交出'
export type BindingProcessDifferenceStatus = '无差异' | '有差异'
export type BindingStripCuttingMethod = '斜切' | '直切' | '横切'
export type BindingStripSufficiencyStatus = '待记录' | '充足' | '捆条不足' | '有差异'
export type BindingStripMaterialReceiveStatus = '未接收' | '已接收'

export interface BindingProcessMaterialIdentity {
  materialSku: string
  materialName: string
  materialColor: string
  materialAlias: string
  materialImageUrl: string
  materialUnit: string
}

export interface BindingProcessPatternIdentity {
  patternFileId: string
  patternFileName: string
  patternVersion: string
  patternKind: string
  effectiveWidthText: string
  piecePartNames: string[]
}

export interface BindingProcessCostItem {
  costItemId: string
  costType: string
  amount: number
  unit: string
  remark: string
}

export interface BindingProcessAbnormalItem {
  abnormalId: string
  abnormalType: string
  abnormalLevel: '提示' | '需处理' | '紧急'
  description: string
  targetModule: '裁剪结果核查'
  handlingStatus: '待处理' | '处理中' | '已处理'
  reportedAt: string
  reportedBy: string
}

export interface BindingStripCuttingRecord {
  recordId: string
  detailId: string
  bindingStripId: string
  bindingWidth: number
  cuttingMethod: BindingStripCuttingMethod
  receivedMaterialLength: number
  actualLength: number
  straightCutLength: number
  crossCutLength: number
  biasCutLength: number
  rollLength: number
  actualRollCount: number
  operatorName: string
  operatedAt: string
  remark: string
}

export interface BindingStripDifferenceRecord {
  differenceId: string
  detailId: string
  bindingStripId: string
  differenceType: '短裁差异' | '超裁差异' | '手动结束差异'
  plannedLength: number
  actualLength: number
  differenceLength: number
  reason: string
  recordedBy: string
  recordedAt: string
}

export interface BindingProcessActionRecord {
  actionRecordId: string
  bindingOrderId: string
  actionCode: 'BINDING_CONFIRM_RECEIVE' | 'BINDING_PROCESS_REPORT' | 'BINDING_SUBMIT_HANDOVER' | 'BINDING_COMPLETE_ORDER'
  detailId?: string
  qty: number
  unit: string
  confirmationKey: string
  operatorName: string
  operatedAt: string
  remark: string
}

export interface BindingStripWorkOrderDetail {
  detailId: string
  bindingStripId: string
  bindingStripNo: string
  bindingStripName: string
  cuttingMethod: BindingStripCuttingMethod
  cuttingMethodIndonesian: string
  plannedGarmentQty: number
  unitBindingLength: number
  plannedBindingLength: number
  bindingWidth: number
  sourceLengthCm: number
  doorWidthCm: number
  rawRequiredLength: number
  requiredLength: number
  minRequiredLength: number
  minRequiredLengthApplied: boolean
  receivedMaterialLength: number
  actualLength: number
  straightCutLength: number
  crossCutLength: number
  biasCutLength: number
  rollLength: number
  actualRollCount: number
  latestRecordedAt: string
  sufficiencyStatus: BindingStripSufficiencyStatus
  shortageLength: number
  differenceLength: number
  printStatus: BindingProcessPrintStatus
  inboundStatus: BindingProcessInboundStatus
  handoverStatus: BindingProcessHandoverStatus
  differenceStatus: BindingProcessDifferenceStatus
  feiTicketId: string
  feiTicketNo: string
  inventoryRecordIds: string[]
  cuttingRecords: BindingStripCuttingRecord[]
  differenceRecords: BindingStripDifferenceRecord[]
  formulaText: string
  specialCrafts: TechnicalPatternPieceSpecialCraft[]
  requiresButtonLoop: boolean
}

export interface BindingProcessOrder {
  bindingOrderId: string
  bindingOrderNo: string
  processType: '捆条'
  processMode: BindingProcessMode
  factoryId: string
  factoryName: string
  sourceCutOrderId: string
  sourceCutOrderNo: string
  sourceTaskId: string
  sourceTaskNo: string
  sourceParentTaskId: string
  sourceParentTaskNo: string
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  sourceBomItemId?: string
  spuCode?: string
  styleName?: string
  sourceMarkerPlanId: string
  sourceMarkerPlanNo: string
  sourceSpreadingOrderId: string
  sourceSpreadingOrderNo: string
  sourceFeiTicketIds: string[]
  sourceFeiTicketNos: string[]
  materialIdentity: BindingProcessMaterialIdentity
  patternIdentity: BindingProcessPatternIdentity
  sourcePatternPackageId: string
  sourcePatternPackageName: string
  doorWidthCm: number
  bindingSpecificationCount: number
  bindingWidth: number
  materialReceiveStatus: BindingStripMaterialReceiveStatus
  materialShelfLocation: string
  requiredMaterialLength: number
  receivedMaterialLength: number
  straightCutLength: number
  crossCutLength: number
  biasCutLength: number
  actualRollCount: number
  latestRecordedAt: string
  sufficiencyStatus: BindingStripSufficiencyStatus
  shortageLength: number
  plannedLength: number
  actualLength: number
  lossLength: number
  lossRate: number
  plannedTotalLength: number
  actualTotalLength: number
  plannedOutputQty: number
  actualOutputQty: number
  handedOverQty?: number
  unit: string
  operatorName: string
  receivedAt: string
  startedAt?: string
  completedAt: string
  status: BindingProcessStatus
  printStatus: BindingProcessPrintStatus
  inboundStatus: BindingProcessInboundStatus
  handoverStatus: BindingProcessHandoverStatus
  differenceStatus: BindingProcessDifferenceStatus
  bindingDetails: BindingStripWorkOrderDetail[]
  cuttingRecords: BindingStripCuttingRecord[]
  differenceRecords: BindingStripDifferenceRecord[]
  actionRecords?: BindingProcessActionRecord[]
  costItems: BindingProcessCostItem[]
  abnormalItems: BindingProcessAbnormalItem[]
  inboundInventoryRecordIds: string[]
  linkedLedgerEventIds: string[]
  linkedCheckItemIds: string[]
  externalReceiverFactoryName: string
  externalHandoverOrderNo: string
  externalHandoverRecordNo: string
  externalReturnStatus: string
  remark: string
}
