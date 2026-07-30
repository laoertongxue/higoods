export type WoolProcessingStatus = 'UNPROCESSED' | 'PROCESSING' | 'COMPLETED'
export type WoolOutputObjectType = 'GARMENT' | 'WOOL_PANEL'
export type WoolQtyUnit = '件' | '片' | 'kg'
export type WoolWorkOrderKind = 'WHOLE_GARMENT' | 'PART_PANEL'

export interface WoolOutputPlanLine {
  outputSkuCode: string
  outputObjectType: WoolOutputObjectType
  garmentSkuCode: string
  woolPartCode?: string
  woolPartName?: string
  colorCode: string
  colorName: string
  sizeCode: string
  plannedQty: number
  qtyUnit: '件' | '片'
  requiredYarnSkus: string[]
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  sourceColorMappingIds: string[]
  sourceBomItemIds: string[]
}

export interface WoolDownstreamTarget {
  receiverType: 'CUTTING_WAIT_HANDOVER_WAREHOUSE' | 'DOWNSTREAM_FACTORY'
  receiverId: string
  receiverName: string
}

export interface WoolWorkOrder {
  woolOrderId: string
  woolOrderNo: string
  taskId: string
  taskNo: string
  productionOrderId: string
  productionOrderNo: string
  kind: WoolWorkOrderKind
  outputPlanLines: WoolOutputPlanLine[]
  downstreamTarget: WoolDownstreamTarget
  sourceTechPackVersionId: string
  sourceTechPackVersionCode: string
  mockScenarioCode?: string
  createdAt: string
  createdBy: string
  updatedAt: string
  updatedBy: string
}

export interface WoolYarnReceiptRecord {
  receiptId: string
  receiptNo: string
  woolOrderId: string
  objectSku: string
  receivedQty: number
  qtyUnit: 'kg'
  batchNo: string
  deliveryNo?: string
  receivedAt: string
  receivedBy: string
  warehouseFlowId: string
  lines: WoolYarnReceiptLine[]
  remark?: string
}

export interface WoolYarnReceiptLine {
  lineId: string
  receiptId: string
  woolOrderId: string
  objectSku: string
  receivedQty: number
  qtyUnit: 'kg'
  batchNo: string
  receivedAt: string
  receivedBy: string
  warehouseFlowId: string
}

export interface WoolYarnIssueRecord {
  issueId: string
  issueNo: string
  woolOrderId: string
  objectSku: string
  issuedQty: number
  qtyUnit: 'kg'
  batchNo: string
  issuedAt: string
  issuedBy: string
  warehouseFlowId: string
  remark?: string
}

export interface WoolYarnReturnRecord {
  returnId: string
  returnNo: string
  woolOrderId: string
  objectSku: string
  returnedQty: number
  qtyUnit: 'kg'
  batchNo: string
  returnedAt: string
  returnedBy: string
  warehouseFlowId: string
  reason: string
}

export interface WoolProcessReportRecord {
  reportId: string
  reportNo: string
  woolOrderId: string
  objectSku: string
  reportedQty: number
  qtyUnit: '件' | '片'
  reportedAt: string
  reportedBy: string
  warehouseFlowId: string
  remark?: string
}

export interface WoolDownstreamReceipt {
  receiptConfirmationId: string
  status: 'PENDING' | 'CONFIRMED'
  actualReceivedQty?: number
  differenceQty?: number
  receivedAt?: string
  receivedBy?: string
}

export interface WoolHandoverRecord {
  handoverId: string
  woolOrderId: string
  outputSkuCode: string
  handoverQty: number
  qtyUnit: '件' | '片'
  receiverType: 'CUTTING_WAIT_HANDOVER_WAREHOUSE' | 'DOWNSTREAM_FACTORY'
  receiverId: string
  receiverName: string
  handedOverAt: string
  handedOverBy: string
  warehouseOutboundFlowId: string
  downstreamReceipt?: WoolDownstreamReceipt
  createdAt: string
  updatedAt: string
}

export type WoolQtyChangeRecordType =
  | 'YARN_RECEIPT'
  | 'YARN_ISSUE'
  | 'YARN_RETURN'
  | 'PROCESS_REPORT'
  | 'HANDOVER'
  | 'DOWNSTREAM_RECEIPT'

export interface WoolQtyChangeLog {
  changeLogId: string
  woolOrderId: string
  recordType: WoolQtyChangeRecordType
  recordId: string
  lineId?: string
  objectSku: string
  before: number
  after: number
  unit: WoolQtyUnit
  reason: string
  changedAt: string
  by: string
}

export type WoolWarehouseFlowDirection = 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT' | 'TRANSFER'
export type WoolWarehouseBusinessType =
  | 'YARN_RECEIPT'
  | 'YARN_ISSUE'
  | 'YARN_RETURN'
  | 'PROCESS_REPORT'
  | 'HANDOVER'
  | 'DOWNSTREAM_RECEIPT'
  | 'QTY_ADJUSTMENT'
export type WoolWarehouseStockArea = 'WAIT_PROCESS' | 'WAIT_HANDOVER'
export type WoolDefaultLocationId =
  | 'WOOL-YARN-DEFAULT'
  | 'WOOL-WAIT-PROCESS-DEFAULT'
  | 'WOOL-WAIT-HANDOVER-DEFAULT'

export interface WoolWarehouseFlow {
  warehouseFlowId: string
  woolOrderId: string
  direction: WoolWarehouseFlowDirection
  businessType: WoolWarehouseBusinessType
  stockArea: WoolWarehouseStockArea
  defaultLocationId: WoolDefaultLocationId
  objectSku: string
  batchNo?: string
  qty: number
  unit: WoolQtyUnit
  sourceRecordType: WoolQtyChangeRecordType | 'QTY_ADJUSTMENT'
  sourceRecordId: string
  sourceLineId?: string
  fromLocationId?: string
  toLocationId?: string
  reason: string
  operatedAt: string
  operatedBy: string
}

export interface WoolCompletionSnapshot {
  yarnReceiptSummary: Array<{
    yarnSku: string
    receivedQty: number
    unit: 'kg'
  }>
  outputReadinessSummary: Array<{
    outputSku: string
    requiredYarnSkus: string[]
    confirmedYarnSkus: string[]
    missingYarnSkus: string[]
  }>
  processReportSummary: Array<{
    outputSku: string
    reportedQty: number
    unit: '件' | '片'
  }>
  handoverSummary: Array<{
    handoverId: string
    outputSku: string
    qty: number
    unit: '件' | '片'
    downstreamActualReceivedQty?: number
    difference?: number
    receivedAt?: string
  }>
  waitProcessStockSummary: Array<{
    objectSku: string
    batchNo?: string
    qty: number
    unit: WoolQtyUnit
  }>
  waitHandoverStockSummary: Array<{
    objectSku: string
    batchNo?: string
    qty: number
    unit: '件' | '片'
  }>
  releasedMachineIds: string[]
}

export interface WoolCompletionRecord {
  completionId: string
  woolOrderId: string
  completedAt: string
  completedBy: string
  confirmationSnapshot: WoolCompletionSnapshot
  remark?: string
}

export type WoolMachineStatus = 'FREE' | 'IN_PRODUCTION' | 'REPAIR' | 'DISABLED'

export interface WoolMachine {
  machineId: string
  machineNo: string
  machineName: string
  status: WoolMachineStatus
  createdAt: string
  updatedAt: string
}

export type WoolMachineAssociationAction = 'ASSOCIATE' | 'TRANSFER' | 'UNASSOCIATE'
export type WoolMachineAssociationReason =
  | 'MANUAL_SAVE'
  | 'ORDER_COMPLETED'
  | 'MACHINE_REPAIR'
  | 'MACHINE_DISABLED'

export interface WoolMachineAssociation {
  associationId: string
  woolOrderId: string
  machineId: string
  associatedAt: string
  associatedBy: string
}

export interface WoolMachineAssociationLog {
  logId: string
  woolOrderId: string
  machineId: string
  action: WoolMachineAssociationAction
  reason: WoolMachineAssociationReason
  fromWoolOrderId?: string
  toWoolOrderId?: string
  operatedAt: string
  operatedBy: string
}

export interface WoolOperationLog {
  operationLogId: string
  woolOrderId: string
  action: string
  objectType: string
  objectId: string
  beforeValue?: unknown
  afterValue?: unknown
  operatedBy: string
  operatedAt: string
  remark?: string
}
