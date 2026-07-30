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
  deliveryNo?: string
  batchNo?: string
  receivedAt: string
  receivedBy: string
  lines: WoolYarnReceiptLine[]
  createdAt: string
  updatedAt: string
}

export interface WoolYarnReceiptLine {
  lineId: string
  yarnSkuCode: string
  yarnName: string
  receivedQty: number
  qtyUnit: 'kg'
  warehouseInboundFlowId: string
}

export interface WoolYarnIssueRecord {
  issueId: string
  issueNo: string
  woolOrderId: string
  yarnSkuCode: string
  batchNo?: string
  issuedQty: number
  qtyUnit: 'kg'
  warehouseOutboundFlowId: string
  issuedAt: string
  issuedBy: string
}

export interface WoolYarnReturnRecord {
  returnId: string
  returnNo: string
  woolOrderId: string
  yarnSkuCode: string
  batchNo?: string
  returnedQty: number
  qtyUnit: 'kg'
  warehouseInboundFlowId: string
  returnedAt: string
  returnedBy: string
}

export interface WoolProcessReportRecord {
  reportId: string
  woolOrderId: string
  outputSkuCode: string
  reportedQty: number
  reportedAt: string
  reportedBy: string
  warehouseInboundFlowId: string
  createdAt: string
  updatedAt: string
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
  | 'PROCESS_REPORT'
  | 'HANDOVER'

export interface WoolQtyChangeLog {
  changeId: string
  recordType: WoolQtyChangeRecordType
  recordId: string
  recordLineId?: string
  objectSkuCode: string
  beforeQty: number
  afterQty: number
  qtyUnit: WoolQtyUnit
  reason: string
  changedAt: string
  changedBy: string
}

export type WoolWarehouseFlowType = 'INBOUND' | 'OUTBOUND' | 'ADJUSTMENT' | 'TRANSFER'
export type WoolWarehouseBusinessType =
  | 'YARN_RECEIPT'
  | 'YARN_ISSUE'
  | 'YARN_RETURN'
  | 'PROCESS_REPORT'
  | 'HANDOVER'
  | 'STOCK_ADJUSTMENT'
  | 'STOCK_TRANSFER'
export type WoolWarehouseMode = 'WAIT_PROCESS' | 'WAIT_HANDOVER'
export type WoolDefaultLocationType = 'YARN' | 'CUT_PIECE' | 'GARMENT'
export type WoolDefaultLocationId =
  | 'WOOL-WP-YARN-DEFAULT'
  | 'WOOL-WH-CUT-DEFAULT'
  | 'WOOL-WH-GARMENT-DEFAULT'

export interface WoolWarehouseFlow {
  flowId: string
  woolOrderId: string
  flowType: WoolWarehouseFlowType
  businessType: WoolWarehouseBusinessType
  warehouseMode: WoolWarehouseMode
  defaultLocationType: WoolDefaultLocationType
  defaultLocationId: WoolDefaultLocationId
  objectSkuCode: string
  batchNo?: string
  qty: number
  unit: WoolQtyUnit
  sourceRecordType: string
  sourceRecordId: string
  fromLocationId?: string
  toWarehouseId?: string
  toLocationId?: string
  reason?: string
  operatedAt: string
  operatedBy: string
}

export interface WoolCompletionSnapshot {
  yarnReceiptSummary: Array<{
    yarnSkuCode: string
    receivedQty: number
    qtyUnit: 'kg'
  }>
  outputReadinessSummary: Array<{
    outputSkuCode: string
    requiredYarnSkus: string[]
    confirmedYarnSkus: string[]
    missingYarnSkus: string[]
  }>
  processReportSummary: Array<{
    outputSkuCode: string
    reportedQty: number
    qtyUnit: '件' | '片'
  }>
  handoverSummary: Array<{
    handoverId: string
    outputSkuCode: string
    handoverQty: number
    qtyUnit: '件' | '片'
    downstreamActualReceivedQty?: number
    downstreamDifferenceQty?: number
    downstreamReceivedAt?: string
  }>
  waitProcessStockSummary: Array<{
    yarnSkuCode: string
    stockQty: number
    qtyUnit: 'kg'
  }>
  waitHandoverStockSummary: Array<{
    outputSkuCode: string
    stockQty: number
    qtyUnit: '件' | '片'
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

export type WoolMachineAvailability = 'IDLE' | 'REPAIR' | 'DISABLED'
export type WoolMachineStatus = WoolMachineAvailability | 'PRODUCING'

export interface WoolMachine {
  machineId: string
  machineNo: string
  machineName: string
  status: WoolMachineAvailability
  createdAt: string
  updatedAt: string
}

export type WoolMachineView = Omit<WoolMachine, 'status'> & {
  status: WoolMachineStatus
}

export type WoolMachineAssociationAction = 'ASSOCIATE' | 'TRANSFER' | 'UNASSOCIATE'
export type WoolMachineAssociationReason =
  | 'MANUAL_SAVE'
  | 'ORDER_COMPLETED'
  | 'MACHINE_REPAIR'
  | 'MACHINE_DISABLED'

export interface WoolMachineAssociation {
  machineId: string
  woolOrderId: string
  associatedAt: string
  associatedBy: string
}

export interface WoolMachineAssociationLog {
  logId: string
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
  woolOrderId?: string
  action: string
  objectType: string
  objectId: string
  beforeValue?: unknown
  afterValue?: unknown
  operatedBy: string
  operatedAt: string
  remark?: string
}

export type WoolCommandType =
  | 'ADD_WOOL_YARN_RECEIPT'
  | 'ADD_WOOL_PROCESS_REPORT'
  | 'ADD_WOOL_HANDOVER'
  | 'CONFIRM_WOOL_DOWNSTREAM_RECEIPT'
  | 'ISSUE_WOOL_YARN'
  | 'RETURN_WOOL_YARN'
  | 'ADJUST_WOOL_WAREHOUSE_STOCK'
  | 'TRANSFER_WOOL_WAREHOUSE_STOCK'
  | 'CHANGE_WOOL_FACT_QTY'
  | 'COMPLETE_WOOL_WORK_ORDER'

export type WoolCommandResultType =
  | 'WOOL_YARN_RECEIPT'
  | 'WOOL_PROCESS_REPORT'
  | 'WOOL_HANDOVER'
  | 'WOOL_YARN_ISSUE'
  | 'WOOL_YARN_RETURN'
  | 'WOOL_WAREHOUSE_FLOW'
  | 'WOOL_QTY_CHANGE'
  | 'WOOL_COMPLETION'

export interface WoolCommandReceiptValue {
  version: 1
  commandId: string
  commandType: WoolCommandType
  targetId: string
  canonicalPayload: unknown
  resultType: WoolCommandResultType
  resultId: string
}
