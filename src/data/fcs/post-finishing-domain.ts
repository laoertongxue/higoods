import { productionOrders, type ProductionOrder } from './production-orders.ts'
import {
  DEDICATED_POST_FACTORY_ID,
  DEDICATED_POST_FACTORY_NAME,
} from './factory-mock-data.ts'

export type PostFinishingRouteMode = '需要后道加工' | '无需后道加工'
export type PostFinishingActionType = '扫码收货' | '质检' | '后道' | '复检'
export type PostFinishingSourceFactoryType = '车缝厂' | '毛织厂' | '未关联任务'
export type PostFinishingQcResult = '全数合规' | '部分不合格' | '全数不合格'
export type PostFinishingNeedFlag = '开扣眼' | '装扣子' | '熨烫' | '包装'
export type PostFinishingButtonAttachMode = '人工装扣' | '机器装扣'
export type PostFinishingTaskStatus = '待上游交出' | '待收货' | '待质检' | '质检中' | '待后道' | '后道中' | '待复检' | '待交出' | '已完成'
export type PostFinishingTaskAcceptanceStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'
export type PostFinishingLiabilityType = '平台' | '工厂'
export type PostFinishingPostProjectStatus = '待开始' | '进行中' | '已完成'
export type PostFinishingSewingSelfReturnStatus = '待后道确认' | '已确认入库' | '数量差异待处理' | '已驳回'

export const POST_FINISHING_QC_DEFECT_REASONS = [
  '做工原因',
  '布料原因',
  '色差',
  '脏污',
  '缺辅料',
  '半套',
  '抽纱',
  '做毁',
  '破洞',
  '做错',
  '印花',
  '缺辅料不补',
] as const

export const FULL_CAPABILITY_FACTORY_ID = DEDICATED_POST_FACTORY_ID
export const FULL_CAPABILITY_FACTORY_NAME = DEDICATED_POST_FACTORY_NAME
export const FULL_CAPABILITY_FACTORY_LABEL = `${FULL_CAPABILITY_FACTORY_NAME}（${FULL_CAPABILITY_FACTORY_ID}）`
export const SEWING_SELF_RETURN_DEFAULT_AREA_ID = 'PFP-SELF-RETURN-TEMP'
export const SEWING_SELF_RETURN_DEFAULT_AREA_NAME = '车缝自助交货暂存区'
export const SEWING_SELF_RETURN_DEFAULT_LOCATION_ID = 'PFP-SELF-RETURN-TEMP-LOC-DEFAULT'
export const SEWING_SELF_RETURN_DEFAULT_LOCATION_CODE = '默认库位'

export interface PostFinishingSkuLine {
  skuLineId: string
  spuId: string
  spuCode: string
  spuName: string
  skuId: string
  skuCode: string
  colorName: string
  sizeName: string
  imageUrl?: string
  plannedQty: number
  receivedQty: number
  availableQty: number
  handedOverQty: number
  qtyUnit: string
}

export interface PostFinishingQcDefectReasonItem {
  reasonItemId: string
  reasonName: string
  qty: number
  liabilityType: PostFinishingLiabilityType
  responsibleFactoryId?: string
  responsibleFactoryName?: string
}

export interface PostFinishingQcPostProjectJudgement {
  projectName: PostFinishingNeedFlag
  needed: boolean
  qty: number
  buttonAttachMode?: PostFinishingButtonAttachMode
}

export interface PostFinishingQcSourceChargeback {
  currency: 'IDR'
  unitAmount: number
  amount: number
  reason: '后道工厂接收返工'
}

export interface PostFinishingQcSkuResult {
  qcSkuResultId: string
  skuLineId: string
  skuId: string
  skuCode: string
  skuImageUrl?: string
  colorName: string
  sizeName: string
  inspectedQty: number
  qualifiedQty: number
  unqualifiedQty: number
  reworkQty: number
  defectAcceptedQty: number
  platformReasonQty: number
  factoryReasonQty: number
  reworkReceiveFactoryId?: string
  reworkReceiveFactoryName?: string
  reworkDeductionUnitAmountIdr?: number
  reworkDeductionAmountIdr?: number
  sourceChargeback?: PostFinishingQcSourceChargeback
  responsibleFactoryId?: string
  responsibleFactoryName?: string
  defectReasonItems: PostFinishingQcDefectReasonItem[]
  postProjectJudgements: PostFinishingQcPostProjectJudgement[]
  qtyUnit: string
  remark?: string
}

export interface PostFinishingPostProjectLine {
  projectLineId: string
  postOrderId: string
  postOrderNo: string
  qcOrderId: string
  qcOrderNo: string
  skuLineId: string
  skuId: string
  skuCode: string
  skuImageUrl?: string
  colorName: string
  sizeName: string
  projectName: PostFinishingNeedFlag
  buttonAttachMode?: PostFinishingButtonAttachMode
  plannedQty: number
  status: PostFinishingPostProjectStatus
  startedAt?: string
  startedBy?: string
  finishedAt?: string
  finishedBy?: string
  completedQty: number
  qtyUnit: string
}

export interface PostFinishingRecheckSkuResult {
  recheckSkuResultId: string
  skuLineId: string
  skuId: string
  skuCode: string
  skuImageUrl?: string
  colorName: string
  sizeName: string
  waitRecheckQty: number
  recheckQty: number
  qualifiedQty: number
  unqualifiedQty: number
  qtyUnit: string
  remark?: string
}

export interface PostFinishingSourceContext {
  contextId: string
  styleId: string
  styleNo: string
  styleName: string
  spuId: string
  spuCode: string
  spuName: string
  productionOrderId: string
  productionOrderNo: string
  sourceTaskId?: string
  sourceTaskNo?: string
  sourceFactoryId?: string
  sourceFactoryName?: string
  sourceFactoryType?: PostFinishingSourceFactoryType
  canCreateWithoutTask: boolean
  skuLines: PostFinishingSkuLine[]
}

export interface PostFinishingTaskView {
  postTaskId: string
  postTaskNo: string
  productionOrderId: string
  productionOrderNo: string
  styleId: string
  styleNo: string
  styleName: string
  spuId: string
  spuCode: string
  spuName: string
  techPackVersionId: string
  techPackVersionLabel: string
  managedPostFactoryId: string
  managedPostFactoryName: string
  plannedGarmentQty: number
  qtyUnit: string
  sourceFactoryNames: string[]
  sourceTaskNos: string[]
  currentStatus: PostFinishingTaskStatus
  currentNode: string
  receivedQty: number
  waitQcQty: number
  qcInProgressQty: number
  qcDoneQty: number
  waitPostQty: number
  postDoingQty: number
  postDoneQty: number
  waitRecheckQty: number
  recheckDoneQty: number
  waitHandoverQty: number
  qcOrderCount: number
  postOrderCount: number
  recheckOrderCount: number
  acceptanceStatus: PostFinishingTaskAcceptanceStatus
  acceptedAt?: string
  acceptedBy?: string
  rejectedAt?: string
  rejectedBy?: string
  rejectReason?: string
  createdAt: string
  updatedAt: string
}

export interface PostFinishingTaskAcceptanceRecord {
  postTaskId: string
  postTaskNo: string
  productionOrderNo: string
  status: PostFinishingTaskAcceptanceStatus
  acceptedAt?: string
  acceptedBy?: string
  rejectedAt?: string
  rejectedBy?: string
  rejectReason?: string
  updatedAt: string
}

export interface PostFinishingDefectItem {
  defectItemId: string
  defectCode: string
  defectName: string
  defectLevel: '轻微' | '一般' | '严重'
  defectQty: number
  defectRateText: string
  deductionBasis: string
}

export interface PostFinishingEvidenceAsset {
  assetId: string
  assetName: string
  assetType: '图片' | '视频' | '文件'
  url: string
}

export interface PostFinishingQualityDeductionSnapshot {
  qcId: string
  qcNo: string
  refType: '后道质检单'
  refId: string
  refTaskId?: string
  sourceTypeLabel: string
  productionOrderNo: string
  taskId?: string
  processType: '后道'
  processLabel: '后道'
  qcPolicy: string
  qcStatus: string
  inspectorUserName: string
  inspectedAt: string
  defectItems: PostFinishingDefectItem[]
  inspectedQty: number
  qualifiedQty: number
  unqualifiedQty: number
  reworkQty: number
  defectAcceptedQty: number
  processingFeeDeductionQty: number
  qcResult: '全数合格' | '部分不合格' | '全数不合格'
  unqualifiedDisposition: '' | '返修' | '让步接收' | '报废' | '退回上游'
  unqualifiedReasonSummary: string
  rootCauseType: '' | '工厂加工问题' | '来料问题' | '技术资料问题' | '平台判定'
  liabilityStatus: '待判定' | '已判定'
  factoryLiabilityQty: number
  nonFactoryLiabilityQty: number
  responsiblePartyType: '' | '工厂' | '平台' | '供应商' | '无责任'
  responsiblePartyId: string
  responsiblePartyName: string
  reworkReceiveFactoryId?: string
  reworkReceiveFactoryName?: string
  deductionDecision: '' | '暂不扣款' | '建议扣款' | '确认扣款'
  deductionDecisionRemark: string
  dispositionRemark: string
  evidenceAssets: PostFinishingEvidenceAsset[]
}

export interface PostFinishingActionRecord {
  actionId: string
  actionRecordId: string
  actionRecordNo: string
  postOrderId: string
  postOrderNo: string
  linkedQcOrderId?: string
  linkedRecheckOrderId?: string
  actionType: PostFinishingActionType
  status: string
  sourceFactoryName: string
  targetFactoryName: string
  operatorName: string
  startedAt?: string
  finishedAt?: string
  submittedGarmentQty: number
  acceptedGarmentQty: number
  rejectedGarmentQty: number
  diffGarmentQty: number
  qtyUnit: string
  receivedGarmentQty?: number
  inspectedGarmentQty?: number
  passedGarmentQty?: number
  defectiveGarmentQty?: number
  reworkGarmentQty?: number
  defectAcceptedGarmentQty?: number
  processingFeeDeductionQty?: number
  completedPostGarmentQty?: number
  recheckedGarmentQty?: number
  confirmedGarmentQty?: number
  qcSkuResults?: PostFinishingQcSkuResult[]
  postProjectLines?: PostFinishingPostProjectLine[]
  recheckSkuResults?: PostFinishingRecheckSkuResult[]
  qcStationId?: string
  qcStationName?: string
  qcResult?: PostFinishingQcResult | '全数合格'
  defectItems?: PostFinishingDefectItem[]
  unqualifiedDisposition?: string
  unqualifiedReasonSummary?: string
  rootCauseType?: string
  liabilityStatus?: string
  factoryLiabilityQty?: number
  nonFactoryLiabilityQty?: number
  responsiblePartyType?: string
  responsiblePartyId?: string
  responsiblePartyName?: string
  reworkReceiveFactoryId?: string
  reworkReceiveFactoryName?: string
  deductionDecision?: string
  deductionDecisionRemark?: string
  dispositionRemark?: string
  needButtonhole?: boolean
  needButton?: boolean
  needIroning?: boolean
  needPackaging?: boolean
  evidenceAssets?: PostFinishingEvidenceAsset[]
  evidenceUrls?: string[]
  qualityDeductionSnapshot?: PostFinishingQualityDeductionSnapshot
  skuLines: PostFinishingSkuLine[]
  warehouseAllocations?: PostFinishingQcWarehouseAllocation[]
  remark?: string
  skipReason?: string
}

export interface PostFinishingReceiptRecord {
  receiptId: string
  receiptNo: string
  sourceContextId: string
  productionOrderNo: string
  sourceTaskNo: string
  sourceFactoryName: string
  receivedAt: string
  receiverName: string
  receiptStatus: '待扫码收货' | '已入库'
  skuLines: PostFinishingSkuLine[]
}

export interface PostFinishingWaitQcSkuItem {
  waitQcSkuKey: string
  postTaskId: string
  postTaskNo: string
  warehouseRecordId: string
  warehouseRecordNo: string
  productionOrderNo: string
  sourceTaskNo: string
  sourceFactoryName: string
  sourceFactoryType: PostFinishingSourceFactoryType
  spuId: string
  spuCode: string
  spuName: string
  skuId: string
  skuCode: string
  skuImageUrl?: string
  colorName: string
  sizeName: string
  areaId?: string
  areaName?: string
  locationId?: string
  locationCode?: string
  currentStockQty: number
  waitQcQty: number
  qcInProgressQty: number
  qtyUnit: string
}

export interface PostFinishingQcWarehouseAllocation {
  allocationId: string
  postTaskId?: string
  postTaskNo?: string
  warehouseRecordId: string
  warehouseRecordNo: string
  productionOrderNo: string
  sourceTaskNo: string
  sourceFactoryName: string
  sourceFactoryType: PostFinishingSourceFactoryType
  skuId: string
  skuCode: string
  colorName: string
  sizeName: string
  areaId?: string
  areaName?: string
  locationId?: string
  locationCode?: string
  qcQty: number
  qtyUnit: string
}

export interface PostFinishingQcOrder {
  qcOrderId: string
  qcOrderNo: string
  postTaskId?: string
  postTaskNo?: string
  sourceContextId: string
  receiptId: string
  productionOrderId: string
  productionOrderNo: string
  sourceTaskId: string
  sourceTaskNo: string
  sourceFactoryId: string
  sourceFactoryName: string
  sourceFactoryType: PostFinishingSourceFactoryType
  managedPostFactoryId: string
  managedPostFactoryName: string
  spuId: string
  spuCode: string
  spuName: string
  skuSummary: string
  skuLines: PostFinishingSkuLine[]
  warehouseAllocations: PostFinishingQcWarehouseAllocation[]
  qcStationId: string
  qcStationName: string
  qcStatus: '待质检' | '质检中' | '质检完成'
  inspectedGarmentQty: number
  passedGarmentQty: number
  defectiveGarmentQty: number
  reworkGarmentQty: number
  defectAcceptedGarmentQty: number
  processingFeeDeductionQty: number
  qcSkuResults: PostFinishingQcSkuResult[]
  qcResult: PostFinishingQcResult
  unqualifiedDisposition: '' | '返修' | '让步接收' | '报废' | '退回上游'
  unqualifiedReasonSummary: string
  rootCauseType: '' | '工厂加工问题' | '来料问题' | '技术资料问题' | '平台判定'
  responsiblePartyType: '' | '工厂' | '平台' | '供应商' | '无责任'
  responsiblePartyId: string
  responsiblePartyName: string
  reworkReceiveFactoryId?: string
  reworkReceiveFactoryName?: string
  deductionDecision: '' | '暂不扣款' | '建议扣款' | '确认扣款'
  deductionDecisionRemark: string
  needButtonhole: boolean
  needButton: boolean
  needIroning: boolean
  needPackaging: boolean
  generatedPostOrderId?: string
  generatedRecheckOrderId?: string
  inspectorName: string
  inspectedAt?: string
  createdAt: string
  updatedAt: string
  defectItems: PostFinishingDefectItem[]
  evidenceAssets: PostFinishingEvidenceAsset[]
}

export interface PostFinishingWarehouseFlowRecord {
  flowRecordId: string
  flowRecordNo: string
  flowType: '扫码收货' | '车缝自助回货提交' | '后道确认入库' | '后道驳回入库' | '质检占用' | '质检入仓' | '后道入仓' | '复检入仓' | '交出出仓' | '接收回写'
  operatedAt: string
  operatorName: string
  qty: number
  qtyUnit: string
  beforeQty: number
  afterQty: number
  sourceActionRecordNo: string
  remark: string
}

export interface PostFinishingWaitProcessWarehouseRecord {
  warehouseRecordId: string
  warehouseRecordNo: string
  upstreamHandoverRecordNo?: string
  postOrderId: string
  postOrderNo: string
  sourceProductionOrderNo: string
  sourceTaskNo: string
  postSourceLabel: string
  managedPostFactoryName: string
  styleNo: string
  spuId: string
  spuCode: string
  spuName: string
  skuId: string
  skuCode: string
  colorName: string
  sizeName: string
  skuSummary: string
  inboundGarmentQty: number
  availableGarmentQty: number
  plannedGarmentQty: number
  qtyUnit: string
  inboundAt: string
  updatedAt: string
  areaId?: string
  areaName?: string
  locationId?: string
  locationCode?: string
  receiptConfirmStatus?: PostFinishingSewingSelfReturnStatus
  selfReturnRecordId?: string
  selfReturnRecordNo?: string
  submittedGarmentQty?: number
  confirmedGarmentQty?: number
  confirmationAt?: string
  confirmationBy?: string
  confirmationRemark?: string
  rejectedAt?: string
  rejectedBy?: string
  rejectedReason?: string
  flowRecords: PostFinishingWarehouseFlowRecord[]
}

export interface PostFinishingSewingSelfReturnItem {
  itemId: string
  skuLineId: string
  skuId: string
  skuCode: string
  colorName: string
  sizeName: string
  submittedQty: number
  confirmedQty?: number
  qtyUnit: string
  plannedQty: number
  handoverRecordId: string
  handoverRecordNo: string
  warehouseRecordId: string
  warehouseRecordNo: string
}

export interface PostFinishingSewingSelfReturnRecord {
  recordId: string
  recordNo: string
  status: PostFinishingSewingSelfReturnStatus
  productionConfirmationNo: string
  productionOrderId: string
  productionOrderNo: string
  sourceTaskId?: string
  sourceTaskNo: string
  sourceFactoryId?: string
  sourceFactoryName: string
  sourceFactoryType: '车缝厂'
  styleNo: string
  spuId: string
  spuCode: string
  spuName: string
  managedPostFactoryId: string
  managedPostFactoryName: string
  deviceFactoryId: string
  deviceFactoryName: string
  publicPdaMode: '车缝现场交货登记'
  submittedByName: string
  submittedByPhone?: string
  submittedAt: string
  submittedByDeviceUserName: string
  evidenceText?: string
  defaultWarehouseName: '后道待加工仓'
  defaultAreaId: string
  defaultAreaName: string
  defaultLocationId: string
  defaultLocationCode: string
  items: PostFinishingSewingSelfReturnItem[]
  handoverOrderId: string
  handoverOrderNo: string
  handoverRecordNos: string[]
  warehouseRecordNos: string[]
  confirmedAt?: string
  confirmedBy?: string
  confirmationRemark?: string
  rejectedAt?: string
  rejectedBy?: string
  rejectedReason?: string
}

export interface PostFinishingWaitHandoverWarehouseRecord {
  warehouseRecordId: string
  warehouseRecordNo: string
  handoverRecordId?: string
  handoverRecordNo?: string
  recheckOrderId: string
  recheckOrderNo: string
  skuLineId: string
  postOrderId: string
  postOrderNo: string
  sourceProductionOrderNo: string
  sourceTaskNo: string
  postSourceLabel: string
  managedPostFactoryName: string
  styleNo: string
  spuId: string
  spuCode: string
  spuName: string
  skuId: string
  skuCode: string
  colorName: string
  sizeName: string
  skuSummary: string
  waitHandoverGarmentQty: number
  submittedHandoverGarmentQty: number
  receivedHandoverGarmentQty: number
  diffGarmentQty: number
  qtyUnit: string
  inboundAt: string
  updatedAt: string
  flowRecords: PostFinishingWarehouseFlowRecord[]
}

export interface PostFinishingHandoverSubmissionInput {
  handoverId: string
  handoverOrderNo: string
  handoverRecordId: string
  handoverRecordNo: string
  recheckOrderId: string
  recheckOrderNo: string
  skuLineId: string
  submittedQty: number
  qtyUnit: string
  submittedAt: string
  submittedBy: string
  receiverWrittenQty?: number
  receiverWrittenAt?: string
  receiverWrittenBy?: string
}

interface PostFinishingHandoverSubmission extends PostFinishingHandoverSubmissionInput {}

export type PostFinishingWarehouseMode = 'wait-process' | 'wait-handover'

export interface PostFinishingWarehouseArea {
  areaId: string
  warehouseMode: PostFinishingWarehouseMode
  areaCode: string
  areaName: string
  managerName: string
  remark: string
  updatedAt: string
}

export interface PostFinishingWarehouseLocation {
  locationId: string
  warehouseMode: PostFinishingWarehouseMode
  areaId: string
  areaName: string
  locationCode: string
  managerName: string
  remark: string
  updatedAt: string
}

export interface PostFinishingUpstreamHandoverLine {
  handoverLineId: string
  skuId: string
  skuCode: string
  colorName: string
  sizeName: string
  plannedQty: number
  qtyUnit: string
}

export interface PostFinishingUpstreamHandover {
  handoverRecordId: string
  handoverRecordNo: string
  qrCode: string
  sourceFactoryType: '车缝任务' | '毛织任务'
  sourceFactoryName: string
  sourceTaskNo: string
  productionOrderNo: string
  styleNo: string
  spuId: string
  spuCode: string
  spuName: string
  handedOverAt: string
  skuLines: PostFinishingUpstreamHandoverLine[]
}

export interface PostFinishingWarehouseReceiptLineInput {
  handoverLineId: string
  actualQty: number
  areaId: string
  locationId?: string
}

export interface PostFinishingWorkOrder {
  postOrderId: string
  postOrderNo: string
  postTaskId?: string
  postTaskNo?: string
  routeMode: PostFinishingRouteMode
  linkedQcOrderId: string
  linkedRecheckOrderId: string
  sourceContextId: string
  styleId: string
  styleNo: string
  styleName: string
  spuId: string
  spuCode: string
  spuName: string
  skuSummary: string
  skuLines: PostFinishingSkuLine[]
  sourceProductionOrderId: string
  sourceProductionOrderNo: string
  sourceTaskId: string
  sourceTaskNo: string
  sourceSewingTaskNo: string
  sourceSewingFactoryId: string
  sourceSewingFactoryName: string
  sourceFactoryType: PostFinishingSourceFactoryType
  managedPostFactoryId: string
  managedPostFactoryName: string
  currentFactoryId: string
  currentFactoryName: string
  currentStatus: string
  receiveMaterialStatus: string
  qcStatus: string
  postStatus: string
  recheckStatus: string
  handoverStatus: string
  plannedGarmentQty: number
  plannedGarmentQtyUnit: string
  isDedicatedPostFactory: boolean
  isPostDoneBySewingFactory: boolean
  requiresPostFinishing: boolean
  needButtonhole: boolean
  needButton: boolean
  needIroning: boolean
  needPackaging: boolean
  postProcessItems: PostFinishingNeedFlag[]
  postProjectLines: PostFinishingPostProjectLine[]
  qcOrderId: string
  qcOrderNo: string
  recheckOrderId?: string
  recheckOrderNo?: string
  createdAt: string
  updatedAt: string
  receiveAction: PostFinishingActionRecord
  postAction: PostFinishingActionRecord
  qcAction: PostFinishingActionRecord
  recheckAction: PostFinishingActionRecord
  waitProcessWarehouseRecordId: string
  waitHandoverWarehouseRecordId?: string
}

export interface PostFinishingRecheckOrder {
  recheckOrderId: string
  recheckOrderNo: string
  postTaskId?: string
  postTaskNo?: string
  sourceType: '质检单' | '后道单'
  qcOrderId: string
  qcOrderNo: string
  postOrderId?: string
  postOrderNo?: string
  productionOrderNo: string
  sourceTaskNo: string
  managedPostFactoryName: string
  spuId: string
  spuCode: string
  spuName: string
  skuSummary: string
  skuLines: PostFinishingSkuLine[]
  recheckStatus: '待复检' | '复检中' | '复检完成'
  recheckedGarmentQty: number
  passedGarmentQty: number
  defectiveGarmentQty: number
  recheckSkuResults: PostFinishingRecheckSkuResult[]
  recheckerName: string
  recheckedAt?: string
  createdAt: string
  updatedAt: string
}

export interface SewingFactoryPostTask {
  taskId: string
  taskNo: string
  postTaskId: string
  postTaskNo: string
  relatedPostOrderId?: string
  relatedPostOrderNo?: string
  productionOrderNo: string
  styleNo: string
  spuId: string
  spuCode: string
  spuName: string
  skuLines: PostFinishingSkuLine[]
  sourceFactoryId: string
  sourceFactoryName: string
  status: '待车缝' | '车缝中' | '车缝完成' | '待后道' | '后道中' | '后道完成' | '待交后道工厂' | '已交后道工厂'
  needFactoryPostFinishing: boolean
  managedPostFactoryId: string
  managedPostFactoryName: string
}

function pad(value: number): string {
  return String(value).padStart(3, '0')
}

function sku(skuId: string, spuId: string, spuCode: string, spuName: string, colorName: string, sizeName: string, qty: number): PostFinishingSkuLine {
  return {
    skuLineId: `${skuId}-LINE`,
    spuId,
    spuCode,
    spuName,
    skuId,
    skuCode: skuId,
    colorName,
    sizeName,
    imageUrl: `https://placehold.co/96x96?text=${encodeURIComponent(sizeName)}`,
    plannedQty: qty,
    receivedQty: qty,
    availableQty: qty,
    handedOverQty: 0,
    qtyUnit: '件',
  }
}

function cloneSkuLine(line: PostFinishingSkuLine): PostFinishingSkuLine {
  return { ...line }
}

function cloneQcDefectReasonItem(item: PostFinishingQcDefectReasonItem): PostFinishingQcDefectReasonItem {
  return { ...item }
}

function cloneQcSkuResult(result: PostFinishingQcSkuResult): PostFinishingQcSkuResult {
  return {
    ...result,
    sourceChargeback: result.sourceChargeback ? { ...result.sourceChargeback } : undefined,
    defectReasonItems: result.defectReasonItems.map(cloneQcDefectReasonItem),
    postProjectJudgements: result.postProjectJudgements.map((item) => ({ ...item })),
  }
}

function clonePostProjectLine(line: PostFinishingPostProjectLine): PostFinishingPostProjectLine {
  return { ...line }
}

function cloneRecheckSkuResult(result: PostFinishingRecheckSkuResult): PostFinishingRecheckSkuResult {
  return { ...result }
}

function cloneFlowRecord(record: PostFinishingWarehouseFlowRecord): PostFinishingWarehouseFlowRecord {
  return { ...record }
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function cloneSewingSelfReturnRecord(record: PostFinishingSewingSelfReturnRecord): PostFinishingSewingSelfReturnRecord {
  return {
    ...record,
    items: record.items.map((item) => ({ ...item })),
    handoverRecordNos: [...record.handoverRecordNos],
    warehouseRecordNos: [...record.warehouseRecordNos],
  }
}

const POST_FINISHING_TASK_ACCEPTANCE_STORE_KEY = 'higoods-post-finishing-task-acceptance'
let postFinishingTaskAcceptanceRecords: PostFinishingTaskAcceptanceRecord[] = []

function readPostFinishingTaskAcceptanceRecords(): PostFinishingTaskAcceptanceRecord[] {
  if (typeof window === 'undefined') return postFinishingTaskAcceptanceRecords
  try {
    const raw = window.localStorage.getItem(POST_FINISHING_TASK_ACCEPTANCE_STORE_KEY)
    if (!raw) return postFinishingTaskAcceptanceRecords
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return postFinishingTaskAcceptanceRecords
    postFinishingTaskAcceptanceRecords = parsed
      .map((item) => ({
        postTaskId: String(item.postTaskId || ''),
        postTaskNo: String(item.postTaskNo || ''),
        productionOrderNo: String(item.productionOrderNo || ''),
        status: item.status === 'ACCEPTED' || item.status === 'REJECTED' ? item.status : 'PENDING',
        acceptedAt: item.acceptedAt ? String(item.acceptedAt) : undefined,
        acceptedBy: item.acceptedBy ? String(item.acceptedBy) : undefined,
        rejectedAt: item.rejectedAt ? String(item.rejectedAt) : undefined,
        rejectedBy: item.rejectedBy ? String(item.rejectedBy) : undefined,
        rejectReason: item.rejectReason ? String(item.rejectReason) : undefined,
        updatedAt: String(item.updatedAt || ''),
      }))
      .filter((item) => item.postTaskId && item.postTaskNo && item.productionOrderNo)
  } catch {
    postFinishingTaskAcceptanceRecords = []
  }
  return postFinishingTaskAcceptanceRecords
}

function persistPostFinishingTaskAcceptanceRecords(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(POST_FINISHING_TASK_ACCEPTANCE_STORE_KEY, JSON.stringify(postFinishingTaskAcceptanceRecords))
  }
}

function hasPostFinishingTaskProgress(task: Pick<PostFinishingTaskView, 'currentStatus' | 'receivedQty' | 'qcOrderCount' | 'postOrderCount' | 'recheckOrderCount' | 'waitHandoverQty'>): boolean {
  return (
    task.currentStatus !== '待上游交出'
    && task.currentStatus !== '待收货'
  ) || task.receivedQty > 0 || task.qcOrderCount > 0 || task.postOrderCount > 0 || task.recheckOrderCount > 0 || task.waitHandoverQty > 0
}

function getDefaultPostFinishingTaskAcceptance(task: Pick<PostFinishingTaskView, 'postTaskId' | 'postTaskNo' | 'productionOrderNo' | 'currentStatus' | 'receivedQty' | 'qcOrderCount' | 'postOrderCount' | 'recheckOrderCount' | 'waitHandoverQty' | 'createdAt'>): PostFinishingTaskAcceptanceRecord {
  const progressed = hasPostFinishingTaskProgress(task)
  return {
    postTaskId: task.postTaskId,
    postTaskNo: task.postTaskNo,
    productionOrderNo: task.productionOrderNo,
    status: progressed ? 'ACCEPTED' : 'PENDING',
    acceptedAt: progressed ? task.createdAt : undefined,
    acceptedBy: progressed ? FULL_CAPABILITY_FACTORY_NAME : undefined,
    updatedAt: task.createdAt,
  }
}

export function getPostFinishingTaskAcceptance(task: Pick<PostFinishingTaskView, 'postTaskId' | 'postTaskNo' | 'productionOrderNo' | 'currentStatus' | 'receivedQty' | 'qcOrderCount' | 'postOrderCount' | 'recheckOrderCount' | 'waitHandoverQty' | 'createdAt'>): PostFinishingTaskAcceptanceRecord {
  const stored = readPostFinishingTaskAcceptanceRecords().find((item) => item.postTaskId === task.postTaskId)
  return cloneValue(stored || getDefaultPostFinishingTaskAcceptance(task))
}

export function acceptPostFinishingTask(postTaskId: string, operatorName = FULL_CAPABILITY_FACTORY_NAME, acceptedAt = nowText()): PostFinishingTaskAcceptanceRecord | null {
  const task = getPostFinishingTaskById(postTaskId)
  if (!task) return null
  const next: PostFinishingTaskAcceptanceRecord = {
    postTaskId: task.postTaskId,
    postTaskNo: task.postTaskNo,
    productionOrderNo: task.productionOrderNo,
    status: 'ACCEPTED',
    acceptedAt,
    acceptedBy: operatorName,
    updatedAt: acceptedAt,
  }
  const records = readPostFinishingTaskAcceptanceRecords()
  const index = records.findIndex((item) => item.postTaskId === task.postTaskId)
  if (index >= 0) postFinishingTaskAcceptanceRecords[index] = next
  else postFinishingTaskAcceptanceRecords.unshift(next)
  persistPostFinishingTaskAcceptanceRecords()
  return cloneValue(next)
}

export function rejectPostFinishingTask(postTaskId: string, rejectReason: string, operatorName = FULL_CAPABILITY_FACTORY_NAME, rejectedAt = nowText()): PostFinishingTaskAcceptanceRecord | null {
  const task = getPostFinishingTaskById(postTaskId)
  if (!task) return null
  const next: PostFinishingTaskAcceptanceRecord = {
    postTaskId: task.postTaskId,
    postTaskNo: task.postTaskNo,
    productionOrderNo: task.productionOrderNo,
    status: 'REJECTED',
    rejectedAt,
    rejectedBy: operatorName,
    rejectReason: rejectReason.trim() || '工厂拒绝接单',
    updatedAt: rejectedAt,
  }
  const records = readPostFinishingTaskAcceptanceRecords()
  const index = records.findIndex((item) => item.postTaskId === task.postTaskId)
  if (index >= 0) postFinishingTaskAcceptanceRecords[index] = next
  else postFinishingTaskAcceptanceRecords.unshift(next)
  persistPostFinishingTaskAcceptanceRecords()
  return cloneValue(next)
}

function totalQty(lines: PostFinishingSkuLine[]): number {
  return lines.reduce((sum, line) => sum + line.plannedQty, 0)
}

function roundQty(value: number): number {
  return Math.round(value * 100) / 100
}

function summarizeSku(lines: PostFinishingSkuLine[]): string {
  return lines.map((line) => `${line.skuCode}/${line.colorName}/${line.sizeName} ${line.plannedQty}${line.qtyUnit}`).join('、')
}

function postFlags(qc: Pick<PostFinishingQcOrder, 'needButtonhole' | 'needButton' | 'needIroning' | 'needPackaging'> & { qcSkuResults?: PostFinishingQcSkuResult[] }): PostFinishingNeedFlag[] {
  const fromSku = (qc.qcSkuResults || [])
    .flatMap((result) => result.postProjectJudgements)
    .filter((judgement) => judgement.needed && judgement.qty > 0)
    .map((judgement) => judgement.projectName)
  if (fromSku.length) {
    const next = new Set(fromSku)
    if (next.has('开扣眼') || next.has('装扣子')) {
      next.add('熨烫')
      next.add('包装')
    }
    return Array.from(next)
  }
  const next = new Set([
    qc.needButtonhole ? '开扣眼' : '',
    qc.needButton ? '装扣子' : '',
    qc.needIroning ? '熨烫' : '',
    qc.needPackaging ? '包装' : '',
  ].filter(Boolean) as PostFinishingNeedFlag[])
  if (next.has('开扣眼') || next.has('装扣子')) {
    next.add('熨烫')
    next.add('包装')
  }
  return Array.from(next)
}

function normalizeButtonAttachMode(value: string | undefined): PostFinishingButtonAttachMode | undefined {
  return value === '人工装扣' || value === '机器装扣' ? value : undefined
}

function normalizePostProjectJudgements(items: PostFinishingQcPostProjectJudgement[]): PostFinishingQcPostProjectJudgement[] {
  const next = items.map((item) => ({
    ...item,
    qty: Math.max(Number(item.qty) || 0, 0),
    buttonAttachMode: item.projectName === '装扣子' ? normalizeButtonAttachMode(item.buttonAttachMode) : undefined,
  }))
  const triggerQty = next
    .filter((item) => item.needed && (item.projectName === '开扣眼' || item.projectName === '装扣子'))
    .reduce((max, item) => Math.max(max, item.qty), 0)
  if (triggerQty <= 0) return next
  ;(['熨烫', '包装'] as const).forEach((projectName) => {
    const existing = next.find((item) => item.projectName === projectName)
    if (existing) {
      existing.needed = true
      existing.qty = Math.max(existing.qty, triggerQty)
    } else {
      next.push({ projectName, needed: true, qty: triggerQty })
    }
  })
  return next
}

function postProjectJudgementsFromFlags(input: {
  needButtonhole?: boolean
  needButton?: boolean
  needIroning?: boolean
  needPackaging?: boolean
  buttonAttachMode?: PostFinishingButtonAttachMode
  qty: number
}): PostFinishingQcPostProjectJudgement[] {
  const needButtonhole = Boolean(input.needButtonhole)
  const needButton = Boolean(input.needButton)
  const pairs: Array<[PostFinishingNeedFlag, boolean | undefined]> = [
    ['开扣眼', needButtonhole],
    ['装扣子', needButton],
    ['熨烫', input.needIroning || needButtonhole || needButton],
    ['包装', input.needPackaging || needButtonhole || needButton],
  ]
  return normalizePostProjectJudgements(pairs
    .filter(([, needed]) => Boolean(needed))
    .map(([projectName]) => ({
      projectName,
      needed: true,
      qty: input.qty,
      buttonAttachMode: projectName === '装扣子' ? input.buttonAttachMode : undefined,
    })))
}

function buildQcSkuResultsFromLines(input: {
  qcOrderId: string
  lines: PostFinishingSkuLine[]
  completed: boolean
  passedQty?: number
  defectiveQty?: number
  sourceFactoryId?: string
  sourceFactoryName?: string
  needButtonhole?: boolean
  needButton?: boolean
  needIroning?: boolean
  needPackaging?: boolean
  buttonAttachMode?: PostFinishingButtonAttachMode
}): PostFinishingQcSkuResult[] {
  let remainingPassed = Math.max(input.passedQty ?? 0, 0)
  let remainingDefective = Math.max(input.defectiveQty ?? 0, 0)
  return input.lines.map((line, index) => {
    const inspectedQty = input.completed ? line.plannedQty : 0
    const unqualifiedQty = input.completed ? Math.min(remainingDefective, inspectedQty) : 0
    remainingDefective = Math.max(remainingDefective - unqualifiedQty, 0)
    const autoQualified = Math.max(inspectedQty - unqualifiedQty, 0)
    const qualifiedQty = input.completed ? Math.min(remainingPassed || autoQualified, autoQualified) : 0
    remainingPassed = Math.max(remainingPassed - qualifiedQty, 0)
    const platformReasonQty = unqualifiedQty > 0 ? Math.floor(unqualifiedQty / 2) : 0
    const factoryReasonQty = unqualifiedQty - platformReasonQty
    const defectReasonItems: PostFinishingQcDefectReasonItem[] = []
    if (factoryReasonQty > 0) {
      defectReasonItems.push({
        reasonItemId: `${input.qcOrderId}-${line.skuId}-REASON-F`,
        reasonName: '做工原因',
        qty: factoryReasonQty,
        liabilityType: '工厂',
        responsibleFactoryId: input.sourceFactoryId,
        responsibleFactoryName: input.sourceFactoryName,
      })
    }
    if (platformReasonQty > 0) {
      defectReasonItems.push({
        reasonItemId: `${input.qcOrderId}-${line.skuId}-REASON-P`,
        reasonName: '色差',
        qty: platformReasonQty,
        liabilityType: '平台',
      })
    }
    return {
      qcSkuResultId: `${input.qcOrderId}-SKU-${index + 1}`,
      skuLineId: line.skuLineId,
      skuId: line.skuId,
      skuCode: line.skuCode,
      skuImageUrl: line.imageUrl,
      colorName: line.colorName,
      sizeName: line.sizeName,
      inspectedQty,
      qualifiedQty,
      unqualifiedQty,
      reworkQty: unqualifiedQty,
      defectAcceptedQty: 0,
      platformReasonQty,
      factoryReasonQty,
      reworkReceiveFactoryId: factoryReasonQty > 0 ? input.sourceFactoryId : undefined,
      reworkReceiveFactoryName: factoryReasonQty > 0 ? input.sourceFactoryName : undefined,
      reworkDeductionUnitAmountIdr: 0,
      reworkDeductionAmountIdr: 0,
      responsibleFactoryId: factoryReasonQty > 0 ? input.sourceFactoryId : undefined,
      responsibleFactoryName: factoryReasonQty > 0 ? input.sourceFactoryName : undefined,
      defectReasonItems,
      postProjectJudgements: postProjectJudgementsFromFlags({
        needButtonhole: input.needButtonhole,
        needButton: input.needButton,
        needIroning: input.needIroning,
        needPackaging: input.needPackaging,
        buttonAttachMode: input.buttonAttachMode,
        qty: qualifiedQty,
      }),
      qtyUnit: line.qtyUnit,
    }
  })
}

function normalizeQcSkuResults(input: {
  qcOrderId: string
  lines: PostFinishingSkuLine[]
  results?: PostFinishingQcSkuResult[]
  sourceFactoryId?: string
  sourceFactoryName?: string
  needButtonhole?: boolean
  needButton?: boolean
  needIroning?: boolean
  needPackaging?: boolean
  buttonAttachMode?: PostFinishingButtonAttachMode
}): PostFinishingQcSkuResult[] {
  const provided = input.results || []
  if (!provided.length) {
    return buildQcSkuResultsFromLines({
      qcOrderId: input.qcOrderId,
      lines: input.lines,
      completed: false,
      sourceFactoryId: input.sourceFactoryId,
      sourceFactoryName: input.sourceFactoryName,
      needButtonhole: input.needButtonhole,
      needButton: input.needButton,
      needIroning: input.needIroning,
      needPackaging: input.needPackaging,
      buttonAttachMode: input.buttonAttachMode,
    })
  }
  return input.lines.map((line, index) => {
    const result = provided.find((item) => item.skuLineId === line.skuLineId || item.skuId === line.skuId)
    const inspectedQty = Math.max(Number(result?.inspectedQty ?? line.plannedQty) || 0, 0)
    const explicitReworkQty = Math.max(Number(result?.reworkQty ?? 0) || 0, 0)
    const explicitDefectAcceptedQty = Math.max(Number(result?.defectAcceptedQty ?? 0) || 0, 0)
    const bucketQty = explicitReworkQty + explicitDefectAcceptedQty
    const unqualifiedQty = bucketQty > 0
      ? bucketQty
      : Math.max(Number(result?.unqualifiedQty ?? 0) || 0, 0)
    const reworkQty = bucketQty > 0 ? explicitReworkQty : unqualifiedQty
    const defectAcceptedQty = bucketQty > 0 ? explicitDefectAcceptedQty : 0
    const qualifiedQty = Math.max(Number(result?.qualifiedQty ?? inspectedQty - unqualifiedQty) || 0, 0)
    const platformReasonQty = Math.max(Number(result?.platformReasonQty ?? 0) || 0, 0)
    const factoryReasonQty = Math.max(Number(result?.factoryReasonQty ?? Math.max(unqualifiedQty - platformReasonQty, 0)) || 0, 0)
    const reworkReceiveFactoryId = result?.reworkReceiveFactoryId || (reworkQty > 0 ? input.sourceFactoryId : undefined)
    const reworkReceiveFactoryName = result?.reworkReceiveFactoryName || (reworkQty > 0 ? input.sourceFactoryName : undefined)
    const reworkDeductionUnitAmountIdr = Math.max(Number(result?.reworkDeductionUnitAmountIdr ?? 0) || 0, 0)
    const reworkDeductionAmountIdr = reworkQty > 0
      && reworkDeductionUnitAmountIdr > 0
      && (reworkReceiveFactoryId !== input.sourceFactoryId || reworkReceiveFactoryName !== input.sourceFactoryName)
      ? Math.round(reworkQty * reworkDeductionUnitAmountIdr)
      : 0
    const sourceChargeback = reworkDeductionAmountIdr > 0
      ? {
          currency: 'IDR' as const,
          unitAmount: reworkDeductionUnitAmountIdr,
          amount: reworkDeductionAmountIdr,
          reason: '后道工厂接收返工' as const,
        }
      : undefined
    const postProjectJudgements = normalizePostProjectJudgements(result?.postProjectJudgements?.length
      ? result.postProjectJudgements
      : postProjectJudgementsFromFlags({
          needButtonhole: input.needButtonhole,
          needButton: input.needButton,
          needIroning: input.needIroning,
          needPackaging: input.needPackaging,
          buttonAttachMode: input.buttonAttachMode,
          qty: qualifiedQty,
        }))
    return {
      qcSkuResultId: result?.qcSkuResultId || `${input.qcOrderId}-SKU-${index + 1}`,
      skuLineId: line.skuLineId,
      skuId: line.skuId,
      skuCode: line.skuCode,
      skuImageUrl: result?.skuImageUrl || line.imageUrl,
      colorName: line.colorName,
      sizeName: line.sizeName,
      inspectedQty,
      qualifiedQty,
      unqualifiedQty,
      reworkQty,
      defectAcceptedQty,
      platformReasonQty,
      factoryReasonQty,
      reworkReceiveFactoryId,
      reworkReceiveFactoryName,
      reworkDeductionUnitAmountIdr,
      reworkDeductionAmountIdr,
      sourceChargeback,
      responsibleFactoryId: result?.responsibleFactoryId || (factoryReasonQty > 0 ? input.sourceFactoryId : undefined),
      responsibleFactoryName: result?.responsibleFactoryName || (factoryReasonQty > 0 ? input.sourceFactoryName : undefined),
      defectReasonItems: result?.defectReasonItems?.map(cloneQcDefectReasonItem) || [],
      postProjectJudgements,
      qtyUnit: line.qtyUnit,
      remark: result?.remark,
    }
  })
}

function sumQcSkuResults(results: PostFinishingQcSkuResult[], key: 'inspectedQty' | 'qualifiedQty' | 'unqualifiedQty' | 'reworkQty' | 'defectAcceptedQty'): number {
  return roundQty(results.reduce((sum, item) => sum + (Number(item[key]) || 0), 0))
}

function sumDefectReasonQty(result: PostFinishingQcSkuResult): number {
  return roundQty(result.defectReasonItems.reduce((sum, item) => sum + (Number(item.qty) || 0), 0))
}

function assertQcSkuResultsReadyToComplete(results: PostFinishingQcSkuResult[], requireDefectReasons: boolean): void {
  results.forEach((result) => {
    const inspectedQty = roundQty(result.inspectedQty)
    const bucketQty = roundQty(result.qualifiedQty + result.reworkQty + result.defectAcceptedQty)
    if (inspectedQty !== bucketQty) {
      throw new Error(`${result.skuCode || 'SKU'} 的质检数量必须等于合格数量、返工数量、瑕疵数量之和`)
    }
    const buttonMissing = result.postProjectJudgements.some((item) => item.projectName === '装扣子' && item.needed && !item.buttonAttachMode)
    if (buttonMissing) throw new Error(`${result.skuCode || 'SKU'} 选择装扣子时必须选择人工装扣或机器装扣`)
    if (requireDefectReasons && result.defectAcceptedQty > 0 && sumDefectReasonQty(result) !== roundQty(result.defectAcceptedQty)) {
      throw new Error(`${result.skuCode || 'SKU'} 的瑕疵原因合计必须等于瑕疵数量`)
    }
  })
}

function buildPostProjectLinesFromQc(qc: PostFinishingQcOrder, postOrderId: string, postOrderNo: string, seedStatus: PostFinishingPostProjectStatus = '待开始'): PostFinishingPostProjectLine[] {
  const lines: PostFinishingPostProjectLine[] = []
  qc.qcSkuResults.forEach((result) => {
    result.postProjectJudgements
      .filter((judgement) => judgement.needed && judgement.qty > 0)
      .forEach((judgement) => {
        lines.push({
          projectLineId: `${postOrderId}-${result.skuId}-${judgement.projectName}`,
          postOrderId,
          postOrderNo,
          qcOrderId: qc.qcOrderId,
          qcOrderNo: qc.qcOrderNo,
          skuLineId: result.skuLineId,
          skuId: result.skuId,
          skuCode: result.skuCode,
          skuImageUrl: result.skuImageUrl,
          colorName: result.colorName,
          sizeName: result.sizeName,
          projectName: judgement.projectName,
          buttonAttachMode: judgement.buttonAttachMode,
          plannedQty: judgement.qty,
          status: seedStatus,
          completedQty: seedStatus === '已完成' ? judgement.qty : 0,
          qtyUnit: result.qtyUnit,
        })
      })
  })
  return lines
}

function summarizePostProjectStatus(lines: PostFinishingPostProjectLine[]): string {
  if (!lines.length) return '无需后道'
  if (lines.every((line) => line.status === '已完成')) return '后道完成'
  if (lines.some((line) => line.status === '进行中' || line.status === '已完成')) return '后道中'
  return '待后道'
}

function buildRecheckSkuResultsFromLines(input: {
  recheckOrderId: string
  lines: PostFinishingSkuLine[]
  completed: boolean
  passedQty?: number
  defectiveQty?: number
}): PostFinishingRecheckSkuResult[] {
  let remainingPassed = Math.max(input.passedQty ?? 0, 0)
  let remainingDefective = Math.max(input.defectiveQty ?? 0, 0)
  return input.lines.map((line, index) => {
    const waitRecheckQty = line.plannedQty
    const recheckQty = input.completed ? waitRecheckQty : 0
    const unqualifiedQty = input.completed ? Math.min(remainingDefective, recheckQty) : 0
    remainingDefective = Math.max(remainingDefective - unqualifiedQty, 0)
    const autoQualified = Math.max(recheckQty - unqualifiedQty, 0)
    const qualifiedQty = input.completed ? Math.min(remainingPassed || autoQualified, autoQualified) : 0
    remainingPassed = Math.max(remainingPassed - qualifiedQty, 0)
    return {
      recheckSkuResultId: `${input.recheckOrderId}-SKU-${index + 1}`,
      skuLineId: line.skuLineId,
      skuId: line.skuId,
      skuCode: line.skuCode,
      skuImageUrl: line.imageUrl,
      colorName: line.colorName,
      sizeName: line.sizeName,
      waitRecheckQty,
      recheckQty,
      qualifiedQty,
      unqualifiedQty,
      qtyUnit: line.qtyUnit,
    }
  })
}

function normalizeRecheckSkuResults(input: {
  recheckOrderId: string
  lines: PostFinishingSkuLine[]
  results?: PostFinishingRecheckSkuResult[]
  completed: boolean
  passedQty?: number
  defectiveQty?: number
}): PostFinishingRecheckSkuResult[] {
  const provided = input.results || []
  if (!provided.length) {
    return buildRecheckSkuResultsFromLines({
      recheckOrderId: input.recheckOrderId,
      lines: input.lines,
      completed: input.completed,
      passedQty: input.passedQty,
      defectiveQty: input.defectiveQty,
    })
  }
  return input.lines.map((line, index) => {
    const result = provided.find((item) => item.skuLineId === line.skuLineId || item.skuId === line.skuId)
    const recheckQty = Math.max(Number(result?.recheckQty ?? line.plannedQty) || 0, 0)
    const unqualifiedQty = Math.max(Number(result?.unqualifiedQty ?? 0) || 0, 0)
    return {
      recheckSkuResultId: result?.recheckSkuResultId || `${input.recheckOrderId}-SKU-${index + 1}`,
      skuLineId: line.skuLineId,
      skuId: line.skuId,
      skuCode: line.skuCode,
      skuImageUrl: result?.skuImageUrl || line.imageUrl,
      colorName: line.colorName,
      sizeName: line.sizeName,
      waitRecheckQty: Math.max(Number(result?.waitRecheckQty ?? line.plannedQty) || 0, 0),
      recheckQty,
      qualifiedQty: Math.max(Number(result?.qualifiedQty ?? recheckQty - unqualifiedQty) || 0, 0),
      unqualifiedQty,
      qtyUnit: line.qtyUnit,
      remark: result?.remark,
    }
  })
}

function nowText(): string {
  return new Date().toISOString().slice(0, 16).replace('T', ' ')
}

export function buildPostFinishingTaskId(productionOrderId: string): string {
  return `POST-TASK-${productionOrderId.replace(/^PO-/, '')}`
}

export function buildPostFinishingTaskNo(productionOrderNo: string): string {
  return `后道任务-${productionOrderNo.replace(/^PO-/, '')}`
}

function sumProductionOrderQty(order: Pick<ProductionOrder, 'planQty' | 'demandSnapshot'>): number {
  const demandQty = order.demandSnapshot.skuLines.reduce((sum, line) => sum + line.qty, 0)
  return order.planQty || demandQty
}

function buildFallbackSkuLinesFromProductionOrder(order: ProductionOrder): PostFinishingSkuLine[] {
  return order.demandSnapshot.skuLines.map((line, index) => ({
    skuLineId: `${order.productionOrderId}-POST-SKU-${index + 1}`,
    spuId: order.techPackSnapshot?.styleId || order.demandSnapshot.spuCode,
    spuCode: order.demandSnapshot.spuCode,
    spuName: order.demandSnapshot.spuName,
    skuId: line.skuCode,
    skuCode: line.skuCode,
    colorName: line.color,
    sizeName: line.size,
    imageUrl: `https://placehold.co/96x96?text=${encodeURIComponent(line.size)}`,
    plannedQty: line.qty,
    receivedQty: 0,
    availableQty: 0,
    handedOverQty: 0,
    qtyUnit: '件',
  }))
}

function getSourceContextsForProductionOrder(productionOrderNo: string): PostFinishingSourceContext[] {
  return SOURCE_CONTEXTS.filter((context) => context.productionOrderNo === productionOrderNo)
}

function uniqueText(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value))))
}

function sumWaitProcessAvailableQty(records: PostFinishingWaitProcessWarehouseRecord[]): number {
  return roundQty(records.reduce((sum, record) => sum + Math.max(record.availableGarmentQty, 0), 0))
}

function sumQcOrderQty(records: PostFinishingQcOrder[], status?: PostFinishingQcOrder['qcStatus']): number {
  return roundQty(
    records
      .filter((record) => !status || record.qcStatus === status)
      .reduce((sum, record) => sum + totalQty(record.skuLines), 0),
  )
}

function resolvePostTaskStatus(input: {
  hasSourceContext: boolean
  receivedQty: number
  waitQcQty: number
  waitQcOrderQty: number
  qcInProgressQty: number
  qcDoneQty: number
  waitPostQty: number
  postDoingQty: number
  waitRecheckQty: number
  recheckDoneQty: number
  waitHandoverQty: number
  plannedQty: number
}): PostFinishingTaskStatus {
  if (input.waitQcQty > 0 || input.waitQcOrderQty > 0) return '待质检'
  if (input.qcInProgressQty > 0) return '质检中'
  if (input.waitPostQty > 0) return '待后道'
  if (input.postDoingQty > 0) return '后道中'
  if (input.waitRecheckQty > 0) return '待复检'
  if (input.waitHandoverQty > 0) return '待交出'
  if (input.recheckDoneQty >= input.plannedQty && input.plannedQty > 0) return '已完成'
  if (input.waitQcQty > 0 || input.qcDoneQty > 0 || input.receivedQty > 0) return '待质检'
  return input.hasSourceContext ? '待收货' : '待上游交出'
}

function postTaskCurrentNode(status: PostFinishingTaskStatus): string {
  const nodeMap: Record<PostFinishingTaskStatus, string> = {
    待上游交出: '等待车缝/毛织交出',
    待收货: '扫码收货',
    待质检: '质检',
    质检中: '质检',
    待后道: '后道',
    后道中: '后道',
    待复检: '复检',
    待交出: '交出',
    已完成: '已完成',
  }
  return nodeMap[status]
}

function buildPostFinishingTaskView(order: ProductionOrder): PostFinishingTaskView {
  const postTaskId = buildPostFinishingTaskId(order.productionOrderId)
  const postTaskNo = buildPostFinishingTaskNo(order.productionOrderNo)
  const contexts = getSourceContextsForProductionOrder(order.productionOrderNo)
  const waitProcessRecords = listPostFinishingWaitProcessWarehouseRecords().filter((record) => record.sourceProductionOrderNo === order.productionOrderNo)
  const qcRecords = qcOrders.filter((record) => record.productionOrderNo === order.productionOrderNo)
  const postRecords = postFinishingWorkOrders.filter((record) => record.sourceProductionOrderNo === order.productionOrderNo)
  const recheckRecords = recheckOrders.filter((record) => record.productionOrderNo === order.productionOrderNo)
  const waitHandoverRecords = listPostFinishingWaitHandoverWarehouseRecords().filter((record) => record.sourceProductionOrderNo === order.productionOrderNo)
  const plannedQty = sumProductionOrderQty(order)
  const receivedQty = receiptRecords
    .filter((record) => record.productionOrderNo === order.productionOrderNo)
    .reduce((sum, record) => sum + totalQty(record.skuLines), 0)
  const waitQcQty = sumWaitProcessAvailableQty(waitProcessRecords)
  const waitQcOrderQty = sumQcOrderQty(qcRecords, '待质检')
  const qcInProgressQty = sumQcOrderQty(qcRecords, '质检中')
  const qcDoneQty = sumQcOrderQty(qcRecords, '质检完成')
  const waitPostQty = roundQty(postRecords.filter((record) => record.postStatus === '待后道').reduce((sum, record) => sum + record.plannedGarmentQty, 0))
  const postDoingQty = roundQty(postRecords.filter((record) => record.postStatus === '后道中').reduce((sum, record) => sum + record.plannedGarmentQty, 0))
  const postDoneQty = roundQty(postRecords.filter((record) => record.postStatus === '后道完成' || record.recheckStatus === '复检完成').reduce((sum, record) => sum + record.plannedGarmentQty, 0))
  const waitRecheckQty = roundQty(recheckRecords.filter((record) => record.recheckStatus !== '复检完成').reduce((sum, record) => sum + record.recheckedGarmentQty, 0))
  const recheckDoneQty = roundQty(recheckRecords.filter((record) => record.recheckStatus === '复检完成').reduce((sum, record) => sum + record.passedGarmentQty, 0))
  const waitHandoverQty = roundQty(waitHandoverRecords.reduce((sum, record) => sum + Math.max(record.waitHandoverGarmentQty - record.submittedHandoverGarmentQty, 0), 0))
  const currentStatus = resolvePostTaskStatus({
    hasSourceContext: contexts.length > 0,
    receivedQty,
    waitQcQty,
    waitQcOrderQty,
    qcInProgressQty,
    qcDoneQty,
    waitPostQty,
    postDoingQty,
    waitRecheckQty,
    recheckDoneQty,
    waitHandoverQty,
    plannedQty,
  })
  const taskCore = {
    postTaskId,
    postTaskNo,
    productionOrderId: order.productionOrderId,
    productionOrderNo: order.productionOrderNo,
    styleId: order.techPackSnapshot?.styleId || order.demandSnapshot.spuCode,
    styleNo: order.techPackSnapshot?.styleCode || order.demandSnapshot.spuCode,
    styleName: order.techPackSnapshot?.styleName || order.demandSnapshot.spuName,
    spuId: order.techPackSnapshot?.styleId || order.demandSnapshot.spuCode,
    spuCode: order.demandSnapshot.spuCode,
    spuName: order.demandSnapshot.spuName,
    techPackVersionId: order.techPackSnapshot?.sourceTechPackVersionId || order.techPackSnapshot?.snapshotId || '未关联',
    techPackVersionLabel: order.techPackSnapshot?.sourceTechPackVersionLabel || order.techPackSnapshot?.versionLabel || '未关联正式版本',
    managedPostFactoryId: FULL_CAPABILITY_FACTORY_ID,
    managedPostFactoryName: FULL_CAPABILITY_FACTORY_NAME,
    plannedGarmentQty: plannedQty,
    qtyUnit: '件',
    sourceFactoryNames: uniqueText(contexts.map((context) => context.sourceFactoryName)),
    sourceTaskNos: uniqueText(contexts.map((context) => context.sourceTaskNo)),
    currentStatus,
    currentNode: postTaskCurrentNode(currentStatus),
    receivedQty,
    waitQcQty,
    qcInProgressQty,
    qcDoneQty,
    waitPostQty,
    postDoingQty,
    postDoneQty,
    waitRecheckQty,
    recheckDoneQty,
    waitHandoverQty,
    qcOrderCount: qcRecords.length,
    postOrderCount: postRecords.length,
    recheckOrderCount: recheckRecords.length,
    createdAt: order.createdAt,
    updatedAt: [order.updatedAt, ...qcRecords.map((record) => record.updatedAt), ...postRecords.map((record) => record.updatedAt), ...recheckRecords.map((record) => record.updatedAt)].sort().slice(-1)[0] || order.updatedAt,
  }
  const acceptance = getPostFinishingTaskAcceptance(taskCore)
  return {
    ...taskCore,
    acceptanceStatus: acceptance.status,
    acceptedAt: acceptance.acceptedAt,
    acceptedBy: acceptance.acceptedBy,
    rejectedAt: acceptance.rejectedAt,
    rejectedBy: acceptance.rejectedBy,
    rejectReason: acceptance.rejectReason,
  }
}

const SOURCE_CONTEXTS: PostFinishingSourceContext[] = [
  {
    contextId: 'POST-SRC-001',
    styleId: 'STYLE-202603-010',
    styleNo: 'SPU-2024-010',
    styleName: 'Celana Jogger Pria',
    spuId: 'SPU-2024-010',
    spuCode: 'SPU-2024-010',
    spuName: 'Celana Jogger Pria',
    productionOrderId: 'PO-202603-0004',
    productionOrderNo: 'PO-202603-0004',
    sourceTaskId: 'TASK-SEW-202603-010-A',
    sourceTaskNo: '车缝任务-202603-010-A',
    sourceFactoryId: 'F-SEW-010',
    sourceFactoryName: 'PT Indo Sewing Center',
    sourceFactoryType: '车缝厂',
    canCreateWithoutTask: false,
    skuLines: [
      sku('SKU-2024-010-BLK-S', 'SPU-2024-010', 'SPU-2024-010', 'Celana Jogger Pria', 'Black', 'S', 180),
      sku('SKU-2024-010-BLK-M', 'SPU-2024-010', 'SPU-2024-010', 'Celana Jogger Pria', 'Black', 'M', 220),
    ],
  },
  {
    contextId: 'POST-SRC-002',
    styleId: 'STYLE-202603-011',
    styleNo: 'SPU-2024-011',
    styleName: 'Sweater Rajut Wanita',
    spuId: 'SPU-2024-011',
    spuCode: 'SPU-2024-011',
    spuName: 'Sweater Rajut Wanita',
    productionOrderId: 'PO-202603-0005',
    productionOrderNo: 'PO-202603-0005',
    sourceTaskId: 'TASK-WOOL-202603-011-A',
    sourceTaskNo: '毛织任务-202603-011-A',
    sourceFactoryId: 'F-WOOL-011',
    sourceFactoryName: 'PT Wool Central Bogor',
    sourceFactoryType: '毛织厂',
    canCreateWithoutTask: false,
    skuLines: [
      sku('SKU-2024-011-CRM-M', 'SPU-2024-011', 'SPU-2024-011', 'Sweater Rajut Wanita', 'Cream', 'M', 160),
      sku('SKU-2024-011-CRM-L', 'SPU-2024-011', 'SPU-2024-011', 'Sweater Rajut Wanita', 'Cream', 'L', 180),
    ],
  },
  {
    contextId: 'POST-SRC-003',
    styleId: 'STYLE-202603-012',
    styleNo: 'SPU-2024-012',
    styleName: 'Cardigan Wanita',
    spuId: 'SPU-2024-012',
    spuCode: 'SPU-2024-012',
    spuName: 'Cardigan Wanita',
    productionOrderId: 'PO-202603-0006',
    productionOrderNo: 'PO-202603-0006',
    sourceTaskId: 'TASK-WOOL-202603-012-A',
    sourceTaskNo: '毛织任务-202603-012-A',
    sourceFactoryId: 'F-WOOL-012',
    sourceFactoryName: 'PT Nusa Wool Factory',
    sourceFactoryType: '毛织厂',
    canCreateWithoutTask: false,
    skuLines: [sku('SKU-2024-012-BGE-M', 'SPU-2024-012', 'SPU-2024-012', 'Cardigan Wanita', 'Beige', 'M', 260)],
  },
  {
    contextId: 'POST-SRC-004',
    styleId: 'STYLE-202603-013',
    styleNo: 'SPU-2024-013',
    styleName: 'Jas Pria Formal',
    spuId: 'SPU-2024-013',
    spuCode: 'SPU-2024-013',
    spuName: 'Jas Pria Formal',
    productionOrderId: 'PO-202603-0007',
    productionOrderNo: 'PO-202603-0007',
    sourceTaskId: 'TASK-SEW-202603-013-A',
    sourceTaskNo: '车缝任务-202603-013-A',
    sourceFactoryId: 'F-SEW-013',
    sourceFactoryName: 'PT Prima Tailor Jakarta',
    sourceFactoryType: '车缝厂',
    canCreateWithoutTask: false,
    skuLines: [
      sku('SKU-2024-013-NVY-L', 'SPU-2024-013', 'SPU-2024-013', 'Jas Pria Formal', 'Navy', 'L', 120),
      sku('SKU-2024-013-NVY-XL', 'SPU-2024-013', 'SPU-2024-013', 'Jas Pria Formal', 'Navy', 'XL', 80),
    ],
  },
  {
    contextId: 'POST-SRC-005',
    styleId: 'STYLE-202603-014',
    styleNo: 'SPU-2024-014',
    styleName: 'Rompi Pria Casual',
    spuId: 'SPU-2024-014',
    spuCode: 'SPU-2024-014',
    spuName: 'Rompi Pria Casual',
    productionOrderId: 'PO-202603-0008',
    productionOrderNo: 'PO-202603-0008',
    sourceTaskId: 'TASK-SEW-202603-014-A',
    sourceTaskNo: '车缝任务-202603-014-A',
    sourceFactoryId: 'F-SEW-014',
    sourceFactoryName: 'PT Mulia Garment',
    sourceFactoryType: '车缝厂',
    canCreateWithoutTask: false,
    skuLines: [sku('SKU-2024-014-GRN-M', 'SPU-2024-014', 'SPU-2024-014', 'Rompi Pria Casual', 'Green', 'M', 210)],
  },
]

const UPSTREAM_HANDOVER_RECORDS: PostFinishingUpstreamHandover[] = SOURCE_CONTEXTS.slice(0, 4).map((context, index) => {
  const sourceFactoryType: PostFinishingUpstreamHandover['sourceFactoryType'] = context.sourceFactoryType === '毛织厂' ? '毛织任务' : '车缝任务'
  const recordNo = `${sourceFactoryType === '毛织任务' ? 'WOOL' : 'SEW'}-HO-202605-${pad(index + 1)}`
  return {
    handoverRecordId: `PF-UP-HO-${pad(index + 1)}`,
    handoverRecordNo: recordNo,
    qrCode: `QR-${recordNo}`,
    sourceFactoryType,
    sourceFactoryName: context.sourceFactoryName || '上游工厂',
    sourceTaskNo: context.sourceTaskNo || '未关联来源任务',
    productionOrderNo: context.productionOrderNo,
    styleNo: context.styleNo,
    spuId: context.spuId,
    spuCode: context.spuCode,
    spuName: context.spuName,
    handedOverAt: `2026-05-${String(index + 10).padStart(2, '0')} 16:30`,
    skuLines: context.skuLines.map((line, lineIndex) => ({
      handoverLineId: `${recordNo}-LINE-${lineIndex + 1}`,
      skuId: line.skuId,
      skuCode: line.skuCode,
      colorName: line.colorName,
      sizeName: line.sizeName,
      plannedQty: line.plannedQty,
      qtyUnit: line.qtyUnit,
    })),
  }
})

let receiptRecords: PostFinishingReceiptRecord[] = SOURCE_CONTEXTS.map((context, index) => ({
  receiptId: `PF-RV-${pad(index + 1)}`,
  receiptNo: `RV-POST-2026-${pad(index + 1)}`,
  sourceContextId: context.contextId,
  productionOrderNo: context.productionOrderNo,
  sourceTaskNo: context.sourceTaskNo || '未关联来源任务',
  sourceFactoryName: context.sourceFactoryName || '未关联来源工厂',
  receivedAt: `2026-05-${String(index + 2).padStart(2, '0')} 09:20`,
  receiverName: '后道收货员',
  receiptStatus: '已入库',
  skuLines: context.skuLines.map((line) => ({ ...line, receivedQty: line.plannedQty, availableQty: line.plannedQty })),
}))

function defect(defectItemId: string, qty: number): PostFinishingDefectItem {
  return {
    defectItemId,
    defectCode: 'POST-STAIN',
    defectName: '后道污渍',
    defectLevel: qty > 20 ? '严重' : '一般',
    defectQty: qty,
    defectRateText: `${qty} 件`,
    deductionBasis: '质量扣款-质检记录：按不合格成衣数量判责',
  }
}

function receiptWarehouseRecordId(receipt: Pick<PostFinishingReceiptRecord, 'receiptId'>, lineIndex: number): string {
  return `PF-WP-${receipt.receiptId.replace('PF-RV-', 'RV-')}-${lineIndex + 1}`
}

function defaultWarehouseAreaAndLocation(lineIndex: number): {
  areaId?: string
  areaName?: string
  locationId?: string
  locationCode?: string
} {
  const areas = getDefaultPostFinishingWarehouseAreas('wait-process')
  const locations = getDefaultPostFinishingWarehouseLocations('wait-process')
  const location = locations[lineIndex % Math.max(locations.length, 1)]
  const area = areas.find((item) => item.areaId === location?.areaId) || areas[lineIndex % Math.max(areas.length, 1)]
  return {
    areaId: area?.areaId,
    areaName: area?.areaName,
    locationId: location?.locationId,
    locationCode: location?.locationCode,
  }
}

function buildAllocatedSkuLines(lines: PostFinishingSkuLine[], allocationQty?: number): PostFinishingSkuLine[] {
  if (allocationQty === undefined) return lines.map(cloneSkuLine)
  let remainingQty = Math.max(Number(allocationQty) || 0, 0)
  return lines
    .map((line) => {
      const lineQty = Math.min(line.plannedQty, remainingQty)
      remainingQty = Math.max(remainingQty - lineQty, 0)
      return {
        ...line,
        plannedQty: lineQty,
        receivedQty: lineQty,
        availableQty: lineQty,
      }
    })
    .filter((line) => line.plannedQty > 0)
}

function buildQcWarehouseAllocations(receipt: PostFinishingReceiptRecord, qcOrderId: string, skuLines = receipt.skuLines): PostFinishingQcWarehouseAllocation[] {
  const context = getSourceContextsForProductionOrder(receipt.productionOrderNo)[0]
  return skuLines.map((line, lineIndex) => {
    const receiptLineIndex = receipt.skuLines.findIndex((item) => item.skuId === line.skuId)
    const recordId = receiptWarehouseRecordId(receipt, receiptLineIndex >= 0 ? receiptLineIndex : lineIndex)
    const location = defaultWarehouseAreaAndLocation(lineIndex)
    return {
      allocationId: `${qcOrderId}-ALLOC-${lineIndex + 1}`,
      postTaskId: context ? buildPostFinishingTaskId(context.productionOrderId) : undefined,
      postTaskNo: context ? buildPostFinishingTaskNo(context.productionOrderNo) : undefined,
      warehouseRecordId: recordId,
      warehouseRecordNo: recordId,
      productionOrderNo: receipt.productionOrderNo,
      sourceTaskNo: receipt.sourceTaskNo,
      sourceFactoryName: receipt.sourceFactoryName,
      sourceFactoryType: SOURCE_CONTEXTS.find((item) => item.contextId === receipt.sourceContextId)?.sourceFactoryType || '未关联任务',
      skuId: line.skuId,
      skuCode: line.skuCode,
      colorName: line.colorName,
      sizeName: line.sizeName,
      qcQty: line.plannedQty,
      qtyUnit: line.qtyUnit,
      ...location,
    }
  })
}

function buildQcOrder(index: number, context: PostFinishingSourceContext, receipt: PostFinishingReceiptRecord, options: {
  status: PostFinishingQcOrder['qcStatus']
  passedQty: number
  defectiveQty: number
  needButtonhole?: boolean
  needButton?: boolean
  needIroning?: boolean
  needPackaging?: boolean
  buttonAttachMode?: PostFinishingButtonAttachMode
  allocationQty?: number
  station: string
}): PostFinishingQcOrder {
  const qcOrderId = `PF-QC-${pad(index)}`
  const skuLines = buildAllocatedSkuLines(receipt.skuLines, options.allocationQty)
  const inspectedQty = totalQty(skuLines)
  const defectiveQty = options.status === '质检完成' ? options.defectiveQty : 0
  const passedQty = options.status === '质检完成' ? options.passedQty : 0
  const qcSkuResults = buildQcSkuResultsFromLines({
    qcOrderId,
    lines: skuLines,
    completed: options.status === '质检完成',
    passedQty,
    defectiveQty,
    sourceFactoryId: context.sourceFactoryId,
    sourceFactoryName: context.sourceFactoryName,
    needButtonhole: options.needButtonhole,
    needButton: options.needButton,
    needIroning: options.needIroning,
    needPackaging: options.needPackaging,
    buttonAttachMode: options.buttonAttachMode,
  })
  const qcResult: PostFinishingQcResult = options.status !== '质检完成'
    ? '部分不合格'
    : defectiveQty <= 0
      ? '全数合规'
      : passedQty <= 0
        ? '全数不合格'
        : '部分不合格'
  const hasDefect = qcResult !== '全数合规'
  return {
    qcOrderId,
    qcOrderNo: `QC-POST-2026-${pad(index)}`,
    postTaskId: buildPostFinishingTaskId(context.productionOrderId),
    postTaskNo: buildPostFinishingTaskNo(context.productionOrderNo),
    sourceContextId: context.contextId,
    receiptId: receipt.receiptId,
    productionOrderId: context.productionOrderId,
    productionOrderNo: context.productionOrderNo,
    sourceTaskId: context.sourceTaskId || `${context.contextId}-MANUAL`,
    sourceTaskNo: context.sourceTaskNo || '未关联来源任务',
    sourceFactoryId: context.sourceFactoryId || 'UNLINKED',
    sourceFactoryName: context.sourceFactoryName || '未关联来源工厂',
    sourceFactoryType: context.sourceFactoryType || '未关联任务',
    managedPostFactoryId: FULL_CAPABILITY_FACTORY_ID,
    managedPostFactoryName: FULL_CAPABILITY_FACTORY_NAME,
    spuId: context.spuId,
    spuCode: context.spuCode,
    spuName: context.spuName,
    skuSummary: summarizeSku(skuLines),
    skuLines: skuLines.map(cloneSkuLine),
    warehouseAllocations: buildQcWarehouseAllocations(receipt, qcOrderId, skuLines),
    qcStationId: `QC-STATION-${options.station}`,
    qcStationName: `后道质检台 ${options.station}`,
    qcStatus: options.status,
    inspectedGarmentQty: inspectedQty,
    passedGarmentQty: passedQty,
    defectiveGarmentQty: defectiveQty,
    reworkGarmentQty: sumQcSkuResults(qcSkuResults, 'reworkQty'),
    defectAcceptedGarmentQty: sumQcSkuResults(qcSkuResults, 'defectAcceptedQty'),
    processingFeeDeductionQty: sumQcSkuResults(qcSkuResults, 'reworkQty'),
    qcSkuResults,
    qcResult,
    unqualifiedDisposition: hasDefect ? '返修' : '',
    unqualifiedReasonSummary: hasDefect ? '成衣存在后道处理瑕疵，需记录责任并进入后续处理。' : '',
    rootCauseType: hasDefect ? '工厂加工问题' : '',
    responsiblePartyType: hasDefect ? '工厂' : '',
    responsiblePartyId: hasDefect ? context.sourceFactoryId || '' : '',
    responsiblePartyName: hasDefect ? context.sourceFactoryName || '' : '',
    reworkReceiveFactoryId: hasDefect ? context.sourceFactoryId || '' : undefined,
    reworkReceiveFactoryName: hasDefect ? context.sourceFactoryName || '' : undefined,
    deductionDecision: '',
    deductionDecisionRemark: hasDefect ? '质检记录只展示事实；扣款由对账单确认。' : '',
    needButtonhole: Boolean(options.needButtonhole),
    needButton: Boolean(options.needButton),
    needIroning: Boolean(options.needIroning),
    needPackaging: Boolean(options.needPackaging),
    generatedPostOrderId: undefined,
    generatedRecheckOrderId: undefined,
    inspectorName: options.status === '待质检' ? '—' : '后道质检员',
    inspectedAt: options.status === '质检完成' ? `2026-05-${String(index + 3).padStart(2, '0')} 14:30` : undefined,
    createdAt: `2026-05-${String(index + 2).padStart(2, '0')} 10:00`,
    updatedAt: `2026-05-${String(index + 3).padStart(2, '0')} 15:00`,
    defectItems: hasDefect ? [defect(`PF-DEF-${pad(index)}`, defectiveQty)] : [],
    evidenceAssets: hasDefect ? [{ assetId: `PF-EV-${pad(index)}`, assetName: '质检照片', assetType: '图片', url: 'mock://post-finishing/qc.jpg' }] : [],
  }
}

function withPendingDefectReasonMock(qc: PostFinishingQcOrder): PostFinishingQcOrder {
  const result = qc.qcSkuResults[0]
  if (!result) return qc
  const inspectedQty = Math.min(result.inspectedQty || qc.skuLines[0]?.plannedQty || qc.inspectedGarmentQty, 100)
  const reworkQty = 10
  const defectAcceptedQty = 20
  const defectiveQty = reworkQty + defectAcceptedQty
  const qualifiedQty = Math.max(inspectedQty - defectiveQty, 0)
  const qcSkuResults = qc.qcSkuResults.map((item, index) => index === 0
    ? {
        ...item,
        inspectedQty,
        qualifiedQty,
        unqualifiedQty: defectiveQty,
        reworkQty,
        defectAcceptedQty,
        platformReasonQty: 0,
        factoryReasonQty: defectiveQty,
        reworkReceiveFactoryId: qc.sourceFactoryId,
        reworkReceiveFactoryName: qc.sourceFactoryName,
        responsibleFactoryId: qc.sourceFactoryId,
        responsibleFactoryName: qc.sourceFactoryName,
        defectReasonItems: [],
      }
    : item)
  return {
    ...qc,
    qcStatus: '质检中',
    inspectedGarmentQty: inspectedQty,
    passedGarmentQty: qualifiedQty,
    defectiveGarmentQty: defectiveQty,
    reworkGarmentQty: reworkQty,
    defectAcceptedGarmentQty: defectAcceptedQty,
    processingFeeDeductionQty: reworkQty,
    qcSkuResults,
    qcResult: '部分不合格',
    unqualifiedDisposition: '返修',
    unqualifiedReasonSummary: `PDA 已提交瑕疵数量 ${defectAcceptedQty}，待 Web 补齐瑕疵原因。`,
    rootCauseType: '工厂加工问题',
    responsiblePartyType: '工厂',
    responsiblePartyId: qc.sourceFactoryId,
    responsiblePartyName: qc.sourceFactoryName,
    reworkReceiveFactoryId: qc.sourceFactoryId,
    reworkReceiveFactoryName: qc.sourceFactoryName,
    deductionDecision: '',
    deductionDecisionRemark: `质检记录只展示事实；扣款由对账单确认。PDA 已提交返工数量 ${reworkQty}，瑕疵数量 ${defectAcceptedQty}，待 Web 补齐瑕疵原因后完成质检。`,
    inspectorName: 'PDA 后道质检员',
    inspectedAt: '2026-05-08 14:20',
    updatedAt: '2026-05-08 14:20',
    defectItems: [defect(`${qc.qcOrderId}-PENDING-REASON`, defectiveQty)],
  }
}

let qcOrders: PostFinishingQcOrder[] = [
  buildQcOrder(1, SOURCE_CONTEXTS[0], receiptRecords[0], { status: '质检完成', passedQty: 388, defectiveQty: 12, needIroning: true, needPackaging: true, station: 'A' }),
  buildQcOrder(2, SOURCE_CONTEXTS[1], receiptRecords[1], { status: '质检完成', passedQty: 340, defectiveQty: 0, station: 'B' }),
  buildQcOrder(3, SOURCE_CONTEXTS[2], receiptRecords[2], { status: '待质检', passedQty: 0, defectiveQty: 0, allocationQty: 120, station: 'C' }),
  buildQcOrder(4, SOURCE_CONTEXTS[3], receiptRecords[3], { status: '质检完成', passedQty: 188, defectiveQty: 12, needButtonhole: true, needButton: true, needIroning: true, buttonAttachMode: '机器装扣', station: 'A' }),
  withPendingDefectReasonMock(buildQcOrder(5, SOURCE_CONTEXTS[4], receiptRecords[4], { status: '质检中', passedQty: 0, defectiveQty: 0, station: 'B' })),
  buildQcOrder(6, SOURCE_CONTEXTS[4], receiptRecords[4], { status: '质检完成', passedQty: 206, defectiveQty: 4, needPackaging: true, station: 'C' }),
  buildQcOrder(7, SOURCE_CONTEXTS[1], receiptRecords[1], { status: '质检完成', passedQty: 334, defectiveQty: 6, station: 'A' }),
  buildQcOrder(8, SOURCE_CONTEXTS[2], receiptRecords[2], { status: '质检完成', passedQty: 96, defectiveQty: 4, needButton: true, buttonAttachMode: '人工装扣', allocationQty: 100, station: 'B' }),
]

function getContext(contextId: string): PostFinishingSourceContext {
  const context = SOURCE_CONTEXTS.find((item) => item.contextId === contextId)
  if (!context) throw new Error(`未找到后道来源：${contextId}`)
  return context
}

function nextIndexFrom(values: string[], pattern: RegExp): number {
  const max = values.reduce((currentMax, value) => {
    const matched = value.match(pattern)
    const numeric = matched ? Number(matched[1]) : 0
    return Number.isFinite(numeric) ? Math.max(currentMax, numeric) : currentMax
  }, 0)
  return max + 1
}

function nextReceiptIndex(): number {
  return nextIndexFrom(receiptRecords.map((item) => item.receiptId), /^PF-RV-(\d+)$/)
}

function nextQcIndex(): number {
  return nextIndexFrom(qcOrders.map((item) => item.qcOrderId), /^PF-QC-(\d+)$/)
}

function nextPostOrderIndex(): number {
  return nextIndexFrom(postFinishingWorkOrders.map((item) => item.postOrderId), /^POST-WO-(\d+)$/)
}

function nextRecheckIndex(): number {
  return nextIndexFrom(recheckOrders.map((item) => item.recheckOrderId), /^PF-RC-(\d+)$/)
}

function refreshPostFinishingDerivedRecords(): void {
  waitProcessWarehouseRecords = buildWaitProcessRecords()
  waitHandoverWarehouseRecords = buildWaitHandoverRecords()
}

function syncSewingTaskPostLink(order: PostFinishingWorkOrder): void {
  const task = sewingFactoryPostTasks.find((item) => item.taskId === order.sourceTaskId || item.postTaskId === order.sourceTaskId)
  if (!task) return
  task.relatedPostOrderId = order.postOrderId
  task.relatedPostOrderNo = order.postOrderNo
  task.needFactoryPostFinishing = true
}

function cloneSourceContext(context: PostFinishingSourceContext): PostFinishingSourceContext {
  return { ...context, skuLines: context.skuLines.map(cloneSkuLine) }
}

function cloneReceipt(record: PostFinishingReceiptRecord): PostFinishingReceiptRecord {
  return { ...record, skuLines: record.skuLines.map(cloneSkuLine) }
}

function cloneQcOrder(order: PostFinishingQcOrder): PostFinishingQcOrder {
  return {
    ...order,
    skuLines: order.skuLines.map(cloneSkuLine),
    warehouseAllocations: order.warehouseAllocations.map((allocation) => ({ ...allocation })),
    qcSkuResults: order.qcSkuResults.map(cloneQcSkuResult),
    defectItems: order.defectItems.map((item) => ({ ...item })),
    evidenceAssets: order.evidenceAssets.map((item) => ({ ...item })),
  }
}

function makeQualitySnapshot(qc: PostFinishingQcOrder): PostFinishingQualityDeductionSnapshot {
  const hasDefect = qc.qcResult !== '全数合规'
  return {
    qcId: qc.qcOrderId,
    qcNo: qc.qcOrderNo,
    refType: '后道质检单',
    refId: qc.qcOrderId,
    refTaskId: qc.sourceTaskId,
    sourceTypeLabel: '后道质检',
    productionOrderNo: qc.productionOrderNo,
    taskId: qc.sourceTaskNo,
    processType: '后道',
    processLabel: '后道',
    qcPolicy: '后道成衣质检',
    qcStatus: qc.qcStatus,
    inspectorUserName: qc.inspectorName,
    inspectedAt: qc.inspectedAt || '',
    defectItems: qc.defectItems.map((item) => ({ ...item })),
    inspectedQty: qc.inspectedGarmentQty,
    qualifiedQty: qc.passedGarmentQty,
    unqualifiedQty: qc.defectiveGarmentQty,
    reworkQty: qc.reworkGarmentQty,
    defectAcceptedQty: qc.defectAcceptedGarmentQty,
    processingFeeDeductionQty: qc.processingFeeDeductionQty,
    qcResult: qc.qcResult === '全数合规' ? '全数合格' : qc.qcResult,
    unqualifiedDisposition: hasDefect ? qc.unqualifiedDisposition : '',
    unqualifiedReasonSummary: hasDefect ? qc.unqualifiedReasonSummary : '',
    rootCauseType: hasDefect ? qc.rootCauseType : '',
    liabilityStatus: hasDefect ? '待判定' : '已判定',
    factoryLiabilityQty: hasDefect ? qc.processingFeeDeductionQty : 0,
    nonFactoryLiabilityQty: hasDefect ? qc.defectAcceptedGarmentQty : 0,
    responsiblePartyType: hasDefect ? qc.responsiblePartyType : '无责任',
    responsiblePartyId: hasDefect ? qc.responsiblePartyId : '',
    responsiblePartyName: hasDefect ? qc.responsiblePartyName : '无责任方',
    reworkReceiveFactoryId: hasDefect ? qc.reworkReceiveFactoryId : undefined,
    reworkReceiveFactoryName: hasDefect ? qc.reworkReceiveFactoryName : undefined,
    deductionDecision: hasDefect ? qc.deductionDecision : '',
    deductionDecisionRemark: hasDefect ? qc.deductionDecisionRemark : '',
    dispositionRemark: hasDefect ? '按质检结论处理。' : '',
    evidenceAssets: qc.evidenceAssets.map((item) => ({ ...item })),
  }
}

function makeActionRecord(input: {
  id: string
  no: string
  postOrderId: string
  postOrderNo: string
  actionType: PostFinishingActionType
  status: string
  sourceFactoryName: string
  targetFactoryName: string
  operatorName: string
  submittedQty: number
  acceptedQty: number
  rejectedQty?: number
  startedAt?: string
  finishedAt?: string
  skuLines: PostFinishingSkuLine[]
  qc?: PostFinishingQcOrder
  post?: PostFinishingWorkOrder
  recheck?: PostFinishingRecheckOrder
  remark?: string
}): PostFinishingActionRecord {
  const rejectedQty = input.rejectedQty ?? 0
  const action: PostFinishingActionRecord = {
    actionId: input.id,
    actionRecordId: input.id,
    actionRecordNo: input.no,
    postOrderId: input.postOrderId,
    postOrderNo: input.postOrderNo,
    linkedQcOrderId: input.qc?.qcOrderId,
    linkedRecheckOrderId: input.recheck?.recheckOrderId,
    actionType: input.actionType,
    status: input.status,
    sourceFactoryName: input.sourceFactoryName,
    targetFactoryName: input.targetFactoryName,
    operatorName: input.operatorName,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt,
    submittedGarmentQty: input.submittedQty,
    acceptedGarmentQty: input.acceptedQty,
    rejectedGarmentQty: rejectedQty,
    diffGarmentQty: rejectedQty,
    qtyUnit: '件',
    skuLines: input.skuLines.map(cloneSkuLine),
    remark: input.remark,
  }
  if (input.actionType === '扫码收货') action.receivedGarmentQty = input.acceptedQty
  if (input.qc) {
    const snapshot = makeQualitySnapshot(input.qc)
    action.qcStationId = input.qc.qcStationId
    action.qcStationName = input.qc.qcStationName
    action.inspectedGarmentQty = input.qc.inspectedGarmentQty
    action.passedGarmentQty = input.qc.passedGarmentQty
    action.defectiveGarmentQty = input.qc.defectiveGarmentQty
    action.reworkGarmentQty = input.qc.reworkGarmentQty
    action.defectAcceptedGarmentQty = input.qc.defectAcceptedGarmentQty
    action.processingFeeDeductionQty = input.qc.processingFeeDeductionQty
    action.qcResult = input.qc.qcResult
    action.defectItems = input.qc.defectItems.map((item) => ({ ...item }))
    action.unqualifiedDisposition = input.qc.unqualifiedDisposition
    action.unqualifiedReasonSummary = input.qc.unqualifiedReasonSummary
    action.rootCauseType = input.qc.rootCauseType
    action.liabilityStatus = snapshot.liabilityStatus
    action.factoryLiabilityQty = snapshot.factoryLiabilityQty
    action.nonFactoryLiabilityQty = snapshot.nonFactoryLiabilityQty
    action.responsiblePartyType = input.qc.responsiblePartyType
    action.responsiblePartyId = input.qc.responsiblePartyId
    action.responsiblePartyName = input.qc.responsiblePartyName
    action.reworkReceiveFactoryId = input.qc.reworkReceiveFactoryId
    action.reworkReceiveFactoryName = input.qc.reworkReceiveFactoryName
    action.deductionDecision = input.qc.deductionDecision
    action.deductionDecisionRemark = input.qc.deductionDecisionRemark
    action.dispositionRemark = snapshot.dispositionRemark
    action.needButtonhole = input.qc.needButtonhole
    action.needButton = input.qc.needButton
    action.needIroning = input.qc.needIroning
    action.needPackaging = input.qc.needPackaging
    action.qcSkuResults = input.qc.qcSkuResults.map(cloneQcSkuResult)
    action.evidenceAssets = input.qc.evidenceAssets.map((item) => ({ ...item }))
    action.evidenceUrls = input.qc.evidenceAssets.map((item) => item.url)
    action.qualityDeductionSnapshot = snapshot
    action.warehouseAllocations = input.qc.warehouseAllocations.map((allocation) => ({ ...allocation }))
  }
  if (input.actionType === '后道') {
    action.completedPostGarmentQty = input.acceptedQty
    action.postProjectLines = input.post?.postProjectLines.map(clonePostProjectLine)
  }
  if (input.actionType === '复检') {
    action.recheckedGarmentQty = input.recheck?.recheckedGarmentQty || input.acceptedQty
    action.confirmedGarmentQty = input.acceptedQty
    action.recheckSkuResults = input.recheck?.recheckSkuResults.map(cloneRecheckSkuResult)
  }
  return action
}

function buildPostOrderFromQc(qc: PostFinishingQcOrder, index: number): PostFinishingWorkOrder {
  const context = getContext(qc.sourceContextId)
  const needs = postFlags(qc)
  const postOrderId = `POST-WO-${pad(index)}`
  const postOrderNo = `HD-2026-${pad(index)}`
  const recheck = recheckOrders.find((item) => item.postOrderId === postOrderId || item.qcOrderId === qc.qcOrderId)
  const projectSeedStatus: PostFinishingPostProjectStatus = recheck ? '已完成' : index === 1 ? '进行中' : '待开始'
  const postProjectLines = buildPostProjectLinesFromQc(qc, postOrderId, postOrderNo, projectSeedStatus)
  const postStatus = summarizePostProjectStatus(postProjectLines)
  const currentStatus = recheck?.recheckStatus === '复检完成' ? '复检完成' : postStatus
  const completedPostQty = roundQty(postProjectLines.reduce((sum, line) => sum + line.completedQty, 0))
  const receiveAction = makeActionRecord({
    id: `PF-RV-ACT-${pad(index)}`,
    no: qc.receiptId.replace('PF-RV', 'RV-ACT'),
    postOrderId,
    postOrderNo,
    actionType: '扫码收货',
    status: '已入库',
    sourceFactoryName: qc.sourceFactoryName,
    targetFactoryName: qc.managedPostFactoryName,
    operatorName: '后道收货员',
    submittedQty: totalQty(qc.skuLines),
    acceptedQty: totalQty(qc.skuLines),
    startedAt: qc.createdAt,
    finishedAt: qc.createdAt,
    skuLines: qc.skuLines,
  })
  const qcAction = makeActionRecord({
    id: qc.qcOrderId,
    no: qc.qcOrderNo,
    postOrderId,
    postOrderNo,
    actionType: '质检',
    status: qc.qcStatus,
    sourceFactoryName: qc.sourceFactoryName,
    targetFactoryName: qc.managedPostFactoryName,
    operatorName: qc.inspectorName,
    submittedQty: qc.inspectedGarmentQty,
    acceptedQty: qc.passedGarmentQty,
    rejectedQty: qc.defectiveGarmentQty,
    startedAt: qc.createdAt,
    finishedAt: qc.inspectedAt,
    skuLines: qc.skuLines,
    qc,
  })
  const postAction = makeActionRecord({
    id: postOrderId,
    no: postOrderNo,
    postOrderId,
    postOrderNo,
    actionType: '后道',
    status: postStatus,
    sourceFactoryName: qc.sourceFactoryName,
    targetFactoryName: qc.managedPostFactoryName,
    operatorName: postStatus === '待后道' ? '—' : '后道操作员',
    submittedQty: qc.passedGarmentQty,
    acceptedQty: completedPostQty,
    startedAt: postStatus === '待后道' ? undefined : `2026-05-${String(index + 5).padStart(2, '0')} 09:00`,
    finishedAt: postStatus === '后道完成' ? `2026-05-${String(index + 5).padStart(2, '0')} 16:00` : undefined,
    skuLines: qc.skuLines,
    remark: needs.join('、'),
  })
  postAction.postProjectLines = postProjectLines.map(clonePostProjectLine)
  const recheckAction = recheck
    ? makeActionRecord({
        id: recheck.recheckOrderId,
        no: recheck.recheckOrderNo,
        postOrderId,
        postOrderNo,
        actionType: '复检',
        status: recheck.recheckStatus,
        sourceFactoryName: qc.managedPostFactoryName,
        targetFactoryName: qc.managedPostFactoryName,
        operatorName: recheck.recheckerName,
        submittedQty: recheck.recheckedGarmentQty,
        acceptedQty: recheck.passedGarmentQty,
        rejectedQty: recheck.defectiveGarmentQty,
        startedAt: recheck.createdAt,
        finishedAt: recheck.recheckedAt,
        skuLines: recheck.skuLines,
        qc,
        recheck,
      })
    : makeActionRecord({
        id: `PF-RC-PENDING-${pad(index)}`,
        no: `RC-POST-待生成-${pad(index)}`,
        postOrderId,
        postOrderNo,
        actionType: '复检',
        status: '待复检',
        sourceFactoryName: qc.managedPostFactoryName,
        targetFactoryName: qc.managedPostFactoryName,
        operatorName: '—',
        submittedQty: qc.passedGarmentQty,
        acceptedQty: 0,
        skuLines: qc.skuLines,
      })
  return {
    postOrderId,
    postOrderNo,
    postTaskId: qc.postTaskId || buildPostFinishingTaskId(qc.productionOrderId),
    postTaskNo: qc.postTaskNo || buildPostFinishingTaskNo(qc.productionOrderNo),
    routeMode: '需要后道加工',
    linkedQcOrderId: qc.qcOrderId,
    linkedRecheckOrderId: recheck?.recheckOrderId || recheckAction.actionRecordId,
    sourceContextId: qc.sourceContextId,
    styleId: context.styleId,
    styleNo: context.styleNo,
    styleName: context.styleName,
    spuId: qc.spuId,
    spuCode: qc.spuCode,
    spuName: qc.spuName,
    skuSummary: qc.skuSummary,
    skuLines: qc.skuLines.map(cloneSkuLine),
    sourceProductionOrderId: qc.productionOrderId,
    sourceProductionOrderNo: qc.productionOrderNo,
    sourceTaskId: qc.sourceTaskId,
    sourceTaskNo: qc.sourceTaskNo,
    sourceSewingTaskNo: qc.sourceTaskNo,
    sourceSewingFactoryId: qc.sourceFactoryId,
    sourceSewingFactoryName: qc.sourceFactoryName,
    sourceFactoryType: qc.sourceFactoryType,
    managedPostFactoryId: qc.managedPostFactoryId,
    managedPostFactoryName: qc.managedPostFactoryName,
    currentFactoryId: qc.managedPostFactoryId,
    currentFactoryName: qc.managedPostFactoryName,
    currentStatus,
    receiveMaterialStatus: receiveAction.status,
    qcStatus: qcAction.status,
    postStatus: postAction.status,
    recheckStatus: recheckAction.status,
    handoverStatus: recheck?.recheckStatus === '复检完成' ? '待交出' : recheck ? '待复检' : '未生成',
    plannedGarmentQty: qc.passedGarmentQty,
    plannedGarmentQtyUnit: '件',
    isDedicatedPostFactory: true,
    isPostDoneBySewingFactory: false,
    requiresPostFinishing: true,
    needButtonhole: qc.needButtonhole,
    needButton: qc.needButton,
    needIroning: qc.needIroning,
    needPackaging: qc.needPackaging,
    postProcessItems: needs,
    postProjectLines,
    qcOrderId: qc.qcOrderId,
    qcOrderNo: qc.qcOrderNo,
    recheckOrderId: recheck?.recheckOrderId,
    recheckOrderNo: recheck?.recheckOrderNo,
    createdAt: qc.updatedAt,
    updatedAt: recheck?.updatedAt || qc.updatedAt,
    receiveAction,
    qcAction,
    postAction,
    recheckAction,
    waitProcessWarehouseRecordId: `PF-WP-${pad(index)}`,
    waitHandoverWarehouseRecordId: recheck?.recheckStatus === '复检完成' ? `PF-WH-${pad(index)}` : undefined,
  }
}

function buildDirectRecheckFromQc(qc: PostFinishingQcOrder, index: number): PostFinishingRecheckOrder {
  const recheckOrderId = `PF-RC-${pad(index)}`
  const inProgress = index % 3 === 0
  const completed = !inProgress && index % 2 === 0
  const recheckSkuResults = buildRecheckSkuResultsFromLines({
    recheckOrderId,
    lines: qc.skuLines,
    completed,
    passedQty: qc.passedGarmentQty,
    defectiveQty: 0,
  })
  return {
    recheckOrderId,
    recheckOrderNo: `RC-POST-2026-${pad(index)}`,
    postTaskId: qc.postTaskId || buildPostFinishingTaskId(qc.productionOrderId),
    postTaskNo: qc.postTaskNo || buildPostFinishingTaskNo(qc.productionOrderNo),
    sourceType: '质检单',
    qcOrderId: qc.qcOrderId,
    qcOrderNo: qc.qcOrderNo,
    productionOrderNo: qc.productionOrderNo,
    sourceTaskNo: qc.sourceTaskNo,
    managedPostFactoryName: qc.managedPostFactoryName,
    spuId: qc.spuId,
    spuCode: qc.spuCode,
    spuName: qc.spuName,
    skuSummary: qc.skuSummary,
    skuLines: qc.skuLines.map(cloneSkuLine),
    recheckStatus: inProgress ? '复检中' : completed ? '复检完成' : '待复检',
    recheckedGarmentQty: qc.passedGarmentQty,
    passedGarmentQty: completed ? qc.passedGarmentQty : 0,
    defectiveGarmentQty: 0,
    recheckSkuResults,
    recheckerName: completed || inProgress ? '复检员' : '—',
    recheckedAt: completed ? `2026-05-${String(index + 5).padStart(2, '0')} 16:40` : undefined,
    createdAt: qc.updatedAt,
    updatedAt: `2026-05-${String(index + 5).padStart(2, '0')} 17:00`,
  }
}

function buildPostRecheck(qc: PostFinishingQcOrder, postOrderId: string, postOrderNo: string, index: number): PostFinishingRecheckOrder {
  const recheckOrderId = `PF-RC-${pad(index)}`
  const recheckSkuResults = buildRecheckSkuResultsFromLines({
    recheckOrderId,
    lines: qc.skuLines,
    completed: true,
    passedQty: qc.passedGarmentQty,
    defectiveQty: 0,
  })
  return {
    recheckOrderId,
    recheckOrderNo: `RC-POST-2026-${pad(index)}`,
    postTaskId: qc.postTaskId || buildPostFinishingTaskId(qc.productionOrderId),
    postTaskNo: qc.postTaskNo || buildPostFinishingTaskNo(qc.productionOrderNo),
    sourceType: '后道单',
    qcOrderId: qc.qcOrderId,
    qcOrderNo: qc.qcOrderNo,
    postOrderId,
    postOrderNo,
    productionOrderNo: qc.productionOrderNo,
    sourceTaskNo: qc.sourceTaskNo,
    managedPostFactoryName: qc.managedPostFactoryName,
    spuId: qc.spuId,
    spuCode: qc.spuCode,
    spuName: qc.spuName,
    skuSummary: qc.skuSummary,
    skuLines: qc.skuLines.map(cloneSkuLine),
    recheckStatus: '复检完成',
    recheckedGarmentQty: qc.passedGarmentQty,
    passedGarmentQty: qc.passedGarmentQty,
    defectiveGarmentQty: 0,
    recheckSkuResults,
    recheckerName: '复检员',
    recheckedAt: `2026-05-${String(index + 6).padStart(2, '0')} 16:30`,
    createdAt: `2026-05-${String(index + 6).padStart(2, '0')} 09:00`,
    updatedAt: `2026-05-${String(index + 6).padStart(2, '0')} 17:00`,
  }
}

function buildPendingRecheckFromQc(qc: PostFinishingQcOrder, index: number, postOrder?: Pick<PostFinishingWorkOrder, 'postOrderId' | 'postOrderNo'>): PostFinishingRecheckOrder {
  const recheckOrderId = `PF-RC-${pad(index)}`
  const recheckSkuResults = buildRecheckSkuResultsFromLines({
    recheckOrderId,
    lines: qc.skuLines,
    completed: false,
  })
  return {
    recheckOrderId,
    recheckOrderNo: `RC-POST-2026-${pad(index)}`,
    postTaskId: qc.postTaskId || buildPostFinishingTaskId(qc.productionOrderId),
    postTaskNo: qc.postTaskNo || buildPostFinishingTaskNo(qc.productionOrderNo),
    sourceType: postOrder ? '后道单' : '质检单',
    qcOrderId: qc.qcOrderId,
    qcOrderNo: qc.qcOrderNo,
    postOrderId: postOrder?.postOrderId,
    postOrderNo: postOrder?.postOrderNo,
    productionOrderNo: qc.productionOrderNo,
    sourceTaskNo: qc.sourceTaskNo,
    managedPostFactoryName: qc.managedPostFactoryName,
    spuId: qc.spuId,
    spuCode: qc.spuCode,
    spuName: qc.spuName,
    skuSummary: qc.skuSummary,
    skuLines: qc.skuLines.map(cloneSkuLine),
    recheckStatus: '待复检',
    recheckedGarmentQty: qc.passedGarmentQty,
    passedGarmentQty: 0,
    defectiveGarmentQty: 0,
    recheckSkuResults,
    recheckerName: '—',
    createdAt: nowText(),
    updatedAt: nowText(),
  }
}

let recheckOrders: PostFinishingRecheckOrder[] = [
  buildDirectRecheckFromQc(qcOrders[1], 2),
  buildDirectRecheckFromQc(qcOrders[6], 7),
  buildDirectRecheckFromQc(qcOrders[7], 6),
  buildPostRecheck(qcOrders[3], 'POST-WO-004', 'HD-2026-004', 4),
]

qcOrders = qcOrders.map((qc, index) => {
  const needsPost = postFlags(qc).length > 0
  const directRecheck = recheckOrders.find((item) => item.qcOrderId === qc.qcOrderId && item.sourceType === '质检单')
  return {
    ...qc,
    generatedPostOrderId: needsPost ? `POST-WO-${pad(index + 1)}` : undefined,
    generatedRecheckOrderId: directRecheck?.recheckOrderId,
  }
})

let postFinishingWorkOrders: PostFinishingWorkOrder[] = qcOrders
  .filter((qc) => qc.qcStatus === '质检完成' && postFlags(qc).length > 0)
  .map((qc, index) => buildPostOrderFromQc(qc, qc.qcOrderId.endsWith('004') ? 4 : index + 1))

let sewingFactoryPostTasks: SewingFactoryPostTask[] = SOURCE_CONTEXTS.filter((context) => context.sourceTaskId).map((context, index) => {
  const postOrder = postFinishingWorkOrders.find((order) => order.sourceTaskId === context.sourceTaskId)
  return {
    taskId: context.sourceTaskId || '',
    taskNo: context.sourceTaskNo || '',
    postTaskId: context.sourceTaskId || '',
    postTaskNo: context.sourceTaskNo || '',
    relatedPostOrderId: postOrder?.postOrderId,
    relatedPostOrderNo: postOrder?.postOrderNo,
    productionOrderNo: context.productionOrderNo,
    styleNo: context.styleNo,
    spuId: context.spuId,
    spuCode: context.spuCode,
    spuName: context.spuName,
    skuLines: context.skuLines.map(cloneSkuLine),
    sourceFactoryId: context.sourceFactoryId || '',
    sourceFactoryName: context.sourceFactoryName || '',
    status: ['车缝完成', '后道完成', '已交后道工厂'][index % 3] as SewingFactoryPostTask['status'],
    needFactoryPostFinishing: Boolean(postOrder),
    managedPostFactoryId: FULL_CAPABILITY_FACTORY_ID,
    managedPostFactoryName: FULL_CAPABILITY_FACTORY_NAME,
  }
})

function ensurePostOrderFromQc(qc: PostFinishingQcOrder): PostFinishingWorkOrder {
  const existing = postFinishingWorkOrders.find((order) => order.qcOrderId === qc.qcOrderId)
  if (existing) return existing
  const order = buildPostOrderFromQc(qc, nextPostOrderIndex())
  order.currentStatus = '待后道'
  order.postProjectLines = order.postProjectLines.map((line) => ({
    ...line,
    status: '待开始',
    startedAt: undefined,
    startedBy: undefined,
    finishedAt: undefined,
    finishedBy: undefined,
    completedQty: 0,
  }))
  order.postAction.status = '待后道'
  order.postAction.postProjectLines = order.postProjectLines.map(clonePostProjectLine)
  order.postAction.operatorName = '—'
  order.postAction.acceptedGarmentQty = 0
  order.postAction.completedPostGarmentQty = 0
  order.postAction.startedAt = undefined
  order.postAction.finishedAt = undefined
  order.postStatus = '待后道'
  order.updatedAt = nowText()
  qc.generatedPostOrderId = order.postOrderId
  qc.generatedRecheckOrderId = undefined
  postFinishingWorkOrders.push(order)
  syncSewingTaskPostLink(order)
  refreshPostFinishingDerivedRecords()
  return order
}

function ensureDirectRecheckFromQc(qc: PostFinishingQcOrder): PostFinishingRecheckOrder {
  const existing = recheckOrders.find((item) => item.qcOrderId === qc.qcOrderId && item.sourceType === '质检单')
  if (existing) return existing
  const recheck = buildPendingRecheckFromQc(qc, nextRecheckIndex())
  qc.generatedRecheckOrderId = recheck.recheckOrderId
  qc.generatedPostOrderId = undefined
  recheckOrders.push(recheck)
  refreshPostFinishingDerivedRecords()
  return recheck
}

function ensurePostRecheckFromOrder(order: PostFinishingWorkOrder): PostFinishingRecheckOrder {
  const existing = recheckOrders.find((item) => item.postOrderId === order.postOrderId)
  if (existing) return existing
  const qc = qcOrders.find((item) => item.qcOrderId === order.qcOrderId)
  if (!qc) throw new Error(`未找到后道单关联质检单：${order.qcOrderId}`)
  const recheck = buildPendingRecheckFromQc(qc, nextRecheckIndex(), order)
  recheckOrders.push(recheck)
  order.linkedRecheckOrderId = recheck.recheckOrderId
  order.recheckOrderId = recheck.recheckOrderId
  order.recheckOrderNo = recheck.recheckOrderNo
  order.recheckAction = makeActionRecord({
    id: recheck.recheckOrderId,
    no: recheck.recheckOrderNo,
    postOrderId: order.postOrderId,
    postOrderNo: order.postOrderNo,
    actionType: '复检',
    status: recheck.recheckStatus,
    sourceFactoryName: order.managedPostFactoryName,
    targetFactoryName: order.managedPostFactoryName,
    operatorName: '—',
    submittedQty: recheck.recheckedGarmentQty,
    acceptedQty: 0,
    skuLines: recheck.skuLines,
    qc,
    recheck,
  })
  order.recheckStatus = recheck.recheckStatus
  order.handoverStatus = '待复检'
  order.updatedAt = nowText()
  refreshPostFinishingDerivedRecords()
  return recheck
}

function cloneActionRecord(record: PostFinishingActionRecord): PostFinishingActionRecord {
  return {
    ...record,
    skuLines: record.skuLines.map(cloneSkuLine),
    qcSkuResults: record.qcSkuResults?.map(cloneQcSkuResult),
    postProjectLines: record.postProjectLines?.map(clonePostProjectLine),
    recheckSkuResults: record.recheckSkuResults?.map(cloneRecheckSkuResult),
    defectItems: record.defectItems?.map((item) => ({ ...item })),
    evidenceAssets: record.evidenceAssets?.map((item) => ({ ...item })),
    evidenceUrls: record.evidenceUrls ? [...record.evidenceUrls] : undefined,
    warehouseAllocations: record.warehouseAllocations?.map((allocation) => ({ ...allocation })),
    qualityDeductionSnapshot: record.qualityDeductionSnapshot
      ? {
          ...record.qualityDeductionSnapshot,
          defectItems: record.qualityDeductionSnapshot.defectItems.map((item) => ({ ...item })),
          evidenceAssets: record.qualityDeductionSnapshot.evidenceAssets.map((item) => ({ ...item })),
        }
      : undefined,
  }
}

function cloneWorkOrder(order: PostFinishingWorkOrder): PostFinishingWorkOrder {
  return {
    ...order,
    skuLines: order.skuLines.map(cloneSkuLine),
    postProcessItems: [...order.postProcessItems],
    postProjectLines: order.postProjectLines.map(clonePostProjectLine),
    receiveAction: cloneActionRecord(order.receiveAction),
    qcAction: cloneActionRecord(order.qcAction),
    postAction: cloneActionRecord(order.postAction),
    recheckAction: cloneActionRecord(order.recheckAction),
  }
}

function cloneRecheck(order: PostFinishingRecheckOrder): PostFinishingRecheckOrder {
  return {
    ...order,
    skuLines: order.skuLines.map(cloneSkuLine),
    recheckSkuResults: order.recheckSkuResults.map(cloneRecheckSkuResult),
  }
}

export function getPostFinishingSourceLabel(order: Pick<PostFinishingWorkOrder, 'sourceFactoryType' | 'requiresPostFinishing'>): string {
  if (order.sourceFactoryType === '未关联任务') return '手动质检'
  return order.requiresPostFinishing ? '质检后生成后道' : '质检后直接复检'
}

export function getPostFinishingFlowText(order: Pick<PostFinishingWorkOrder, 'requiresPostFinishing'>): string {
  return order.requiresPostFinishing ? '扫码收货 -> 质检 -> 后道 -> 复检' : '扫码收货 -> 质检 -> 复检'
}

export function listPostFinishingSourceStyleOptions(): PostFinishingSourceContext[] {
  return SOURCE_CONTEXTS.map(cloneSourceContext)
}

export function listPostFinishingSourceTaskOptions(styleId?: string): PostFinishingSourceContext[] {
  return SOURCE_CONTEXTS.filter((context) => !styleId || context.styleId === styleId || context.spuId === styleId).map(cloneSourceContext)
}

export function listPostFinishingSkuOptions(styleId: string): PostFinishingSkuLine[] {
  const context = SOURCE_CONTEXTS.find((item) => item.styleId === styleId || item.spuId === styleId || item.spuCode === styleId)
  return context ? context.skuLines.map(cloneSkuLine) : []
}

export function listPostFinishingReceiptRecords(): PostFinishingReceiptRecord[] {
  return receiptRecords.map(cloneReceipt)
}

export function listPostFinishingTasks(): PostFinishingTaskView[] {
  return productionOrders.map(buildPostFinishingTaskView)
}

export function getPostFinishingTaskById(postTaskId: string): PostFinishingTaskView | undefined {
  const normalized = postTaskId.trim()
  return listPostFinishingTasks().find((task) => task.postTaskId === normalized || task.postTaskNo === normalized)
}

export function getPostFinishingTaskByProductionOrder(productionOrderNoOrId: string): PostFinishingTaskView | undefined {
  const normalized = productionOrderNoOrId.trim()
  return listPostFinishingTasks().find((task) => task.productionOrderId === normalized || task.productionOrderNo === normalized)
}

export function getPostFinishingTaskSkuLines(postTaskId: string): PostFinishingSkuLine[] {
  const task = getPostFinishingTaskById(postTaskId)
  if (!task) return []
  const contexts = getSourceContextsForProductionOrder(task.productionOrderNo)
  if (contexts.length) return contexts.flatMap((context) => context.skuLines.map(cloneSkuLine))
  const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)
  return order ? buildFallbackSkuLinesFromProductionOrder(order) : []
}

function findSourceContextForWarehouseRecord(record: Pick<PostFinishingWaitProcessWarehouseRecord, 'sourceProductionOrderNo' | 'sourceTaskNo' | 'spuId'>): PostFinishingSourceContext | undefined {
  return SOURCE_CONTEXTS.find((context) => (
    context.productionOrderNo === record.sourceProductionOrderNo
    && context.spuId === record.spuId
    && (!context.sourceTaskNo || context.sourceTaskNo === record.sourceTaskNo)
  ))
}

function sumQcInProgressQty(warehouseRecordId: string): number {
  return qcOrders
    .filter((qc) => qc.qcStatus !== '质检完成')
    .flatMap((qc) => qc.warehouseAllocations)
    .filter((allocation) => allocation.warehouseRecordId === warehouseRecordId)
    .reduce((sum, allocation) => sum + allocation.qcQty, 0)
}

export function listPostFinishingWaitQcSkuItems(input: { postTaskId?: string; productionOrderNo?: string } = {}): PostFinishingWaitQcSkuItem[] {
  const targetTask = input.postTaskId ? getPostFinishingTaskById(input.postTaskId) : undefined
  const targetProductionOrderNo = input.productionOrderNo || targetTask?.productionOrderNo
  return listPostFinishingWaitProcessWarehouseRecords()
    .filter((record) => !targetProductionOrderNo || record.sourceProductionOrderNo === targetProductionOrderNo)
    .map((record) => {
      const context = findSourceContextForWarehouseRecord(record)
      const sourceLine = context?.skuLines.find((line) => line.skuId === record.skuId || line.skuCode === record.skuCode)
      const postTaskId = context
        ? buildPostFinishingTaskId(context.productionOrderId)
        : buildPostFinishingTaskId(record.sourceProductionOrderNo)
      const postTaskNo = context
        ? buildPostFinishingTaskNo(context.productionOrderNo)
        : buildPostFinishingTaskNo(record.sourceProductionOrderNo)
      const qcInProgressQty = sumQcInProgressQty(record.warehouseRecordId)
      const waitQcQty = Math.max(record.availableGarmentQty, 0)
      const currentStockQty = waitQcQty + qcInProgressQty
      return {
        waitQcSkuKey: `${record.warehouseRecordId}__${record.skuId}`,
        postTaskId,
        postTaskNo,
        warehouseRecordId: record.warehouseRecordId,
        warehouseRecordNo: record.warehouseRecordNo,
        productionOrderNo: record.sourceProductionOrderNo,
        sourceTaskNo: record.sourceTaskNo,
        sourceFactoryName: context?.sourceFactoryName || record.postSourceLabel.replace('交出', '') || '上游工厂',
        sourceFactoryType: context?.sourceFactoryType || '未关联任务',
        spuId: record.spuId,
        spuCode: record.spuCode,
        spuName: record.spuName,
        skuId: record.skuId,
        skuCode: record.skuCode,
        skuImageUrl: sourceLine?.imageUrl,
        colorName: record.colorName,
        sizeName: record.sizeName,
        areaId: record.areaId,
        areaName: record.areaName,
        locationId: record.locationId,
        locationCode: record.locationCode,
        currentStockQty,
        waitQcQty,
        qcInProgressQty,
        qtyUnit: record.qtyUnit,
      }
    })
    .filter((item) => item.currentStockQty > 0)
}

export function confirmPostFinishingReceipt(input: {
  sourceContextId?: string
  receiverName?: string
  receivedAt?: string
  receivedQtyBySkuId?: Record<string, number>
} = {}): PostFinishingReceiptRecord {
  const context = input.sourceContextId
    ? getContext(input.sourceContextId)
    : SOURCE_CONTEXTS.find((item) => !receiptRecords.some((receipt) => receipt.sourceContextId === item.contextId)) || SOURCE_CONTEXTS[0]
  const receiptIndex = nextReceiptIndex()
  const receipt: PostFinishingReceiptRecord = {
    receiptId: `PF-RV-${pad(receiptIndex)}`,
    receiptNo: `RV-POST-2026-${pad(receiptIndex)}`,
    sourceContextId: context.contextId,
    productionOrderNo: context.productionOrderNo,
    sourceTaskNo: context.sourceTaskNo || '未关联来源任务',
    sourceFactoryName: context.sourceFactoryName || '未关联来源工厂',
    receivedAt: input.receivedAt || nowText(),
    receiverName: input.receiverName || '后道收货员',
    receiptStatus: '已入库',
    skuLines: context.skuLines.map((line) => {
      const receivedQty = input.receivedQtyBySkuId?.[line.skuId] ?? line.plannedQty
      return { ...line, receivedQty, availableQty: receivedQty }
    }),
  }
  receiptRecords.push(receipt)
  refreshPostFinishingDerivedRecords()
  return cloneReceipt(receipt)
}

export function createPostFinishingQcOrder(input: {
  postTaskId?: string
  allocations: Array<{ warehouseRecordId: string; qcQty: number }>
  qcStationName?: string
  inspectorName?: string
}): PostFinishingQcOrder {
  const targetTask = input.postTaskId ? getPostFinishingTaskById(input.postTaskId) : undefined
  if (input.postTaskId && !targetTask) throw new Error('未找到后道任务，不能创建质检单。')
  const waitItems = listPostFinishingWaitQcSkuItems({ postTaskId: input.postTaskId })
  const selected = input.allocations
    .map((allocationInput) => {
      const item = waitItems.find((waitItem) => waitItem.warehouseRecordId === allocationInput.warehouseRecordId)
      const qcQty = Number(allocationInput.qcQty) || 0
      return item && qcQty > 0 ? { item, qcQty } : undefined
    })
    .filter((item): item is { item: PostFinishingWaitQcSkuItem; qcQty: number } => Boolean(item))
  if (!selected.length) throw new Error('请至少选择一个待质检 SKU。')
  const first = selected[0].item
  if (targetTask && first.productionOrderNo !== targetTask.productionOrderNo) throw new Error('只能在当前后道任务下创建质检单。')
  const notSameOrder = selected.find(({ item }) => item.productionOrderNo !== first.productionOrderNo || item.spuId !== first.spuId)
  if (notSameOrder) throw new Error('一次质检单只能选择同一生产单下的同一款式 SKU。')
  const invalidQty = selected.find(({ item, qcQty }) => qcQty > item.waitQcQty)
  if (invalidQty) throw new Error(`SKU ${invalidQty.item.skuCode} 本次质检数量不能超过待质检数量。`)
  const context = SOURCE_CONTEXTS.find((item) => (
    item.productionOrderNo === first.productionOrderNo
    && item.spuId === first.spuId
    && (!item.sourceTaskNo || item.sourceTaskNo === first.sourceTaskNo)
  ))
  if (!context) throw new Error('未找到该 SKU 对应的生产单和上游任务。')
  const qcIndex = nextQcIndex()
  const qcOrderId = `PF-QC-${pad(qcIndex)}`
  const stationLetter = (input.qcStationName || '后道质检台 A').replace('后道质检台', '').trim() || 'A'
  const skuLines = selected.map(({ item, qcQty }) => ({
    skuLineId: `${qcOrderId}-${item.skuId}`,
    spuId: item.spuId,
    spuCode: item.spuCode,
    spuName: item.spuName,
    skuId: item.skuId,
    skuCode: item.skuCode,
    colorName: item.colorName,
    sizeName: item.sizeName,
    imageUrl: item.skuImageUrl,
    plannedQty: qcQty,
    receivedQty: qcQty,
    availableQty: qcQty,
    handedOverQty: 0,
    qtyUnit: item.qtyUnit,
  }))
  const warehouseAllocations = selected.map(({ item, qcQty }, index) => ({
    allocationId: `${qcOrderId}-ALLOC-${index + 1}`,
    postTaskId: item.postTaskId,
    postTaskNo: item.postTaskNo,
    warehouseRecordId: item.warehouseRecordId,
    warehouseRecordNo: item.warehouseRecordNo,
    productionOrderNo: item.productionOrderNo,
    sourceTaskNo: item.sourceTaskNo,
    sourceFactoryName: item.sourceFactoryName,
    sourceFactoryType: item.sourceFactoryType,
    skuId: item.skuId,
    skuCode: item.skuCode,
    colorName: item.colorName,
    sizeName: item.sizeName,
    areaId: item.areaId,
    areaName: item.areaName,
    locationId: item.locationId,
    locationCode: item.locationCode,
    qcQty,
    qtyUnit: item.qtyUnit,
  }))
  const inspectedQty = selected.reduce((sum, item) => sum + item.qcQty, 0)
  const qcSkuResults = buildQcSkuResultsFromLines({
    qcOrderId,
    lines: skuLines,
    completed: false,
    sourceFactoryId: context.sourceFactoryId,
    sourceFactoryName: context.sourceFactoryName,
  })
  const qc: PostFinishingQcOrder = {
    qcOrderId,
    qcOrderNo: `QC-POST-2026-${pad(qcIndex)}`,
    postTaskId: buildPostFinishingTaskId(context.productionOrderId),
    postTaskNo: buildPostFinishingTaskNo(context.productionOrderNo),
    sourceContextId: context.contextId,
    receiptId: first.warehouseRecordId,
    productionOrderId: context.productionOrderId,
    productionOrderNo: context.productionOrderNo,
    sourceTaskId: context.sourceTaskId || `${context.contextId}-MANUAL`,
    sourceTaskNo: context.sourceTaskNo || first.sourceTaskNo,
    sourceFactoryId: context.sourceFactoryId || 'UNLINKED',
    sourceFactoryName: context.sourceFactoryName || first.sourceFactoryName,
    sourceFactoryType: context.sourceFactoryType || first.sourceFactoryType,
    managedPostFactoryId: FULL_CAPABILITY_FACTORY_ID,
    managedPostFactoryName: FULL_CAPABILITY_FACTORY_NAME,
    spuId: context.spuId,
    spuCode: context.spuCode,
    spuName: context.spuName,
    skuSummary: summarizeSku(skuLines),
    skuLines,
    warehouseAllocations,
    qcStationId: `QC-STATION-${stationLetter}`,
    qcStationName: input.qcStationName || `后道质检台 ${stationLetter}`,
    qcStatus: '待质检',
    inspectedGarmentQty: inspectedQty,
    passedGarmentQty: 0,
    defectiveGarmentQty: 0,
    reworkGarmentQty: 0,
    defectAcceptedGarmentQty: 0,
    processingFeeDeductionQty: 0,
    qcSkuResults,
    qcResult: '部分不合格',
    unqualifiedDisposition: '',
    unqualifiedReasonSummary: '',
    rootCauseType: '',
    responsiblePartyType: '',
    responsiblePartyId: '',
    responsiblePartyName: '',
    deductionDecision: '',
    deductionDecisionRemark: '',
    needButtonhole: false,
    needButton: false,
    needIroning: false,
    needPackaging: false,
    generatedPostOrderId: undefined,
    generatedRecheckOrderId: undefined,
    inspectorName: input.inspectorName || '—',
    createdAt: nowText(),
    updatedAt: nowText(),
    defectItems: [],
    evidenceAssets: [],
  }
  qc.qcStationName = input.qcStationName || `后道质检台 ${stationLetter}`
  qc.qcStationId = `QC-STATION-${stationLetter}`
  qcOrders.push(qc)
  refreshPostFinishingDerivedRecords()
  return cloneQcOrder(qc)
}

export function completePostFinishingQcOrder(input: {
  qcOrderId: string
  qcStationName?: string
  inspectorName?: string
  inspectedGarmentQty?: number
  passedGarmentQty?: number
  defectiveGarmentQty?: number
  qcResult?: PostFinishingQcResult
  unqualifiedDisposition?: PostFinishingQcOrder['unqualifiedDisposition']
  unqualifiedReasonSummary?: string
  rootCauseType?: PostFinishingQcOrder['rootCauseType']
  responsiblePartyType?: PostFinishingQcOrder['responsiblePartyType']
  responsiblePartyName?: string
  deductionDecision?: PostFinishingQcOrder['deductionDecision']
  deductionDecisionRemark?: string
  needButtonhole?: boolean
  needButton?: boolean
  needIroning?: boolean
  needPackaging?: boolean
  qcSkuResults?: PostFinishingQcSkuResult[]
}): PostFinishingQcOrder {
  const qc = qcOrders.find((item) => item.qcOrderId === input.qcOrderId)
  if (!qc) throw new Error(`未找到质检单：${input.qcOrderId}`)
  const fallbackInspectedQty = input.inspectedGarmentQty ?? totalQty(qc.skuLines)
  const fallbackDefectiveQty = input.defectiveGarmentQty ?? qc.defectiveGarmentQty
  const fallbackPassedQty = input.passedGarmentQty ?? Math.max(fallbackInspectedQty - fallbackDefectiveQty, 0)
  const nextQcSkuResults = input.qcSkuResults?.length
    ? normalizeQcSkuResults({
        qcOrderId: qc.qcOrderId,
        lines: qc.skuLines,
        results: input.qcSkuResults,
        sourceFactoryId: qc.sourceFactoryId,
        sourceFactoryName: qc.sourceFactoryName,
      })
    : buildQcSkuResultsFromLines({
        qcOrderId: qc.qcOrderId,
        lines: qc.skuLines,
        completed: true,
        passedQty: fallbackPassedQty,
        defectiveQty: fallbackDefectiveQty,
        sourceFactoryId: qc.sourceFactoryId,
        sourceFactoryName: qc.sourceFactoryName,
        needButtonhole: input.needButtonhole,
        needButton: input.needButton,
        needIroning: input.needIroning,
        needPackaging: input.needPackaging,
      })
  assertQcSkuResultsReadyToComplete(nextQcSkuResults, true)
  const inspectedQty = sumQcSkuResults(nextQcSkuResults, 'inspectedQty') || fallbackInspectedQty
  const defectiveQty = sumQcSkuResults(nextQcSkuResults, 'unqualifiedQty')
  const passedQty = sumQcSkuResults(nextQcSkuResults, 'qualifiedQty')
  const reworkQty = sumQcSkuResults(nextQcSkuResults, 'reworkQty')
  const defectAcceptedQty = sumQcSkuResults(nextQcSkuResults, 'defectAcceptedQty')
  const reworkReceiveFactory = nextQcSkuResults.find((item) => item.reworkQty > 0 && item.reworkReceiveFactoryName)
  const result = input.qcResult || (defectiveQty <= 0 ? '全数合规' : passedQty <= 0 ? '全数不合格' : '部分不合格')
  const hasDefect = result !== '全数合规'
  qc.qcStatus = '质检完成'
  qc.qcStationName = input.qcStationName || qc.qcStationName
  qc.qcStationId = qc.qcStationName.replace('后道质检台 ', 'QC-STATION-')
  qc.inspectorName = input.inspectorName || qc.inspectorName || '后道质检员'
  qc.inspectedGarmentQty = inspectedQty
  qc.passedGarmentQty = passedQty
  qc.defectiveGarmentQty = hasDefect ? defectiveQty : 0
  qc.reworkGarmentQty = hasDefect ? reworkQty : 0
  qc.defectAcceptedGarmentQty = hasDefect ? defectAcceptedQty : 0
  qc.processingFeeDeductionQty = hasDefect ? reworkQty : 0
  qc.qcSkuResults = nextQcSkuResults.map(cloneQcSkuResult)
  qc.qcResult = result
  qc.unqualifiedDisposition = hasDefect ? input.unqualifiedDisposition || qc.unqualifiedDisposition || '返修' : ''
  qc.unqualifiedReasonSummary = hasDefect ? input.unqualifiedReasonSummary || qc.unqualifiedReasonSummary || '质检发现不合格成衣，需记录责任。' : ''
  qc.rootCauseType = hasDefect ? input.rootCauseType || qc.rootCauseType || '工厂加工问题' : ''
  qc.responsiblePartyType = hasDefect ? input.responsiblePartyType || qc.responsiblePartyType || '工厂' : ''
  qc.responsiblePartyName = hasDefect ? input.responsiblePartyName || qc.responsiblePartyName || qc.sourceFactoryName : ''
  qc.responsiblePartyId = hasDefect ? qc.responsiblePartyId || qc.sourceFactoryId : ''
  qc.reworkReceiveFactoryId = hasDefect ? reworkReceiveFactory?.reworkReceiveFactoryId || qc.reworkReceiveFactoryId || qc.sourceFactoryId : undefined
  qc.reworkReceiveFactoryName = hasDefect ? reworkReceiveFactory?.reworkReceiveFactoryName || qc.reworkReceiveFactoryName || qc.sourceFactoryName : undefined
  qc.deductionDecision = ''
  qc.deductionDecisionRemark = hasDefect ? '质检记录只展示事实；扣款由对账单确认。' : ''
  const nextNeeds = postFlags({ ...qc, qcSkuResults: nextQcSkuResults })
  qc.needButtonhole = nextNeeds.includes('开扣眼')
  qc.needButton = nextNeeds.includes('装扣子')
  qc.needIroning = nextNeeds.includes('熨烫')
  qc.needPackaging = nextNeeds.includes('包装')
  qc.defectItems = hasDefect ? [defect(`PF-DEF-${pad(nextQcIndex())}`, qc.defectiveGarmentQty)] : []
  qc.evidenceAssets = hasDefect ? qc.evidenceAssets : []
  qc.inspectedAt = nowText()
  qc.updatedAt = nowText()
  if (postFlags(qc).length > 0) ensurePostOrderFromQc(qc)
  else ensureDirectRecheckFromQc(qc)
  refreshPostFinishingDerivedRecords()
  return cloneQcOrder(qc)
}

export function submitPostFinishingPdaQcResult(input: {
  qcOrderId: string
  qcStationName?: string
  inspectorName?: string
  qcSkuResults: PostFinishingQcSkuResult[]
}): PostFinishingQcOrder {
  const qc = qcOrders.find((item) => item.qcOrderId === input.qcOrderId)
  if (!qc) throw new Error(`未找到质检单：${input.qcOrderId}`)
  const nextQcSkuResults = normalizeQcSkuResults({
    qcOrderId: qc.qcOrderId,
    lines: qc.skuLines,
    results: input.qcSkuResults,
    sourceFactoryId: qc.sourceFactoryId,
    sourceFactoryName: qc.sourceFactoryName,
  })
  assertQcSkuResultsReadyToComplete(nextQcSkuResults, false)
  const needsWebReasons = nextQcSkuResults.some((result) => result.defectAcceptedQty > 0 && sumDefectReasonQty(result) !== roundQty(result.defectAcceptedQty))
  if (!needsWebReasons) {
    return completePostFinishingQcOrder({
      qcOrderId: input.qcOrderId,
      qcStationName: input.qcStationName,
      inspectorName: input.inspectorName,
      qcSkuResults: nextQcSkuResults,
      unqualifiedReasonSummary: 'PDA 已提交 SKU 级质检结果',
    })
  }

  const inspectedQty = sumQcSkuResults(nextQcSkuResults, 'inspectedQty')
  const passedQty = sumQcSkuResults(nextQcSkuResults, 'qualifiedQty')
  const reworkQty = sumQcSkuResults(nextQcSkuResults, 'reworkQty')
  const defectAcceptedQty = sumQcSkuResults(nextQcSkuResults, 'defectAcceptedQty')
  const defectiveQty = sumQcSkuResults(nextQcSkuResults, 'unqualifiedQty')
  const reworkReceiveFactory = nextQcSkuResults.find((item) => item.reworkQty > 0 && item.reworkReceiveFactoryName)
  qc.qcStatus = '质检中'
  qc.qcStationName = input.qcStationName || qc.qcStationName
  qc.qcStationId = qc.qcStationName.replace('后道质检台 ', 'QC-STATION-')
  qc.inspectorName = input.inspectorName || qc.inspectorName || 'PDA 后道质检员'
  qc.inspectedGarmentQty = inspectedQty
  qc.passedGarmentQty = passedQty
  qc.defectiveGarmentQty = defectiveQty
  qc.reworkGarmentQty = reworkQty
  qc.defectAcceptedGarmentQty = defectAcceptedQty
  qc.processingFeeDeductionQty = reworkQty
  qc.qcSkuResults = nextQcSkuResults.map(cloneQcSkuResult)
  qc.qcResult = defectiveQty <= 0 ? '全数合规' : passedQty <= 0 ? '全数不合格' : '部分不合格'
  qc.unqualifiedDisposition = reworkQty > 0 ? '返修' : '让步接收'
  qc.unqualifiedReasonSummary = `PDA 已提交瑕疵数量 ${defectAcceptedQty}，待 Web 补齐瑕疵原因。`
  qc.rootCauseType = '工厂加工问题'
  qc.responsiblePartyType = '工厂'
  qc.responsiblePartyId = qc.sourceFactoryId
  qc.responsiblePartyName = qc.sourceFactoryName
  qc.reworkReceiveFactoryId = reworkReceiveFactory?.reworkReceiveFactoryId || qc.sourceFactoryId
  qc.reworkReceiveFactoryName = reworkReceiveFactory?.reworkReceiveFactoryName || qc.sourceFactoryName
  qc.deductionDecision = ''
  qc.deductionDecisionRemark = `质检记录只展示事实；扣款由对账单确认。PDA 已提交返工数量 ${reworkQty}，瑕疵数量 ${defectAcceptedQty}，待 Web 补齐瑕疵原因后完成质检。`
  const nextNeeds = postFlags({ ...qc, qcSkuResults: nextQcSkuResults })
  qc.needButtonhole = nextNeeds.includes('开扣眼')
  qc.needButton = nextNeeds.includes('装扣子')
  qc.needIroning = nextNeeds.includes('熨烫')
  qc.needPackaging = nextNeeds.includes('包装')
  qc.defectItems = [defect(`PF-DEF-${pad(nextQcIndex())}`, defectiveQty)]
  qc.inspectedAt = nowText()
  qc.updatedAt = nowText()
  refreshPostFinishingDerivedRecords()
  return cloneQcOrder(qc)
}

export function listPostFinishingQcOrderEntities(): PostFinishingQcOrder[] {
  return qcOrders.map(cloneQcOrder)
}

export function listPostFinishingRecheckOrderEntities(): PostFinishingRecheckOrder[] {
  return recheckOrders.map(cloneRecheck)
}

export function getPostFinishingRecheckOrderById(recheckOrderId: string): PostFinishingRecheckOrder | undefined {
  const normalized = recheckOrderId.trim()
  const record = recheckOrders.find((item) => item.recheckOrderId === normalized || item.recheckOrderNo === normalized)
  return record ? cloneRecheck(record) : undefined
}

export function buildPostFinishingQcDeductionRecord(record: PostFinishingActionRecord): PostFinishingQualityDeductionSnapshot | undefined {
  return record.qualityDeductionSnapshot
    ? {
        ...record.qualityDeductionSnapshot,
        defectItems: record.qualityDeductionSnapshot.defectItems.map((item) => ({ ...item })),
        evidenceAssets: record.qualityDeductionSnapshot.evidenceAssets.map((item) => ({ ...item })),
      }
    : undefined
}

export function getPostFinishingWorkOrderById(postOrderId: string): PostFinishingWorkOrder | undefined {
  const order = postFinishingWorkOrders.find((item) => item.postOrderId === postOrderId)
  return order ? cloneWorkOrder(order) : undefined
}

export function getPostFinishingWorkOrderBySourceTaskId(sourceTaskId: string): PostFinishingWorkOrder | undefined {
  const order = postFinishingWorkOrders.find((item) => item.sourceTaskId === sourceTaskId)
  return order ? cloneWorkOrder(order) : undefined
}

export function getSewingFactoryPostTaskById(taskId: string): SewingFactoryPostTask | undefined {
  const task = sewingFactoryPostTasks.find((item) => item.taskId === taskId || item.postTaskId === taskId)
  return task ? { ...task, skuLines: task.skuLines.map(cloneSkuLine) } : undefined
}

export function startSewingFactoryPostTask(taskId: string): SewingFactoryPostTask {
  const task = sewingFactoryPostTasks.find((item) => item.taskId === taskId || item.postTaskId === taskId)
  if (!task) throw new Error(`未找到上游后道任务：${taskId}`)
  task.status = '后道中'
  return { ...task, skuLines: task.skuLines.map(cloneSkuLine) }
}

export function finishSewingFactoryPostTask(taskId: string): SewingFactoryPostTask {
  const task = sewingFactoryPostTasks.find((item) => item.taskId === taskId || item.postTaskId === taskId)
  if (!task) throw new Error(`未找到上游后道任务：${taskId}`)
  task.status = '后道完成'
  return { ...task, skuLines: task.skuLines.map(cloneSkuLine) }
}

export function transferSewingFactoryPostTaskToManagedFactory(taskId: string): SewingFactoryPostTask {
  const task = sewingFactoryPostTasks.find((item) => item.taskId === taskId || item.postTaskId === taskId)
  if (!task) throw new Error(`未找到上游后道任务：${taskId}`)
  task.status = '已交后道工厂'
  return { ...task, skuLines: task.skuLines.map(cloneSkuLine) }
}

function getMutablePostFinishingWorkOrder(postOrderId: string): PostFinishingWorkOrder {
  const order = postFinishingWorkOrders.find((item) => item.postOrderId === postOrderId)
  if (!order) throw new Error(`未找到后道单：${postOrderId}`)
  return order
}

function normalizeActionType(actionType: PostFinishingActionType): PostFinishingActionType {
  return actionType
}

function getAction(order: PostFinishingWorkOrder, actionType: PostFinishingActionType): PostFinishingActionRecord {
  const normalized = normalizeActionType(actionType)
  if (normalized === '扫码收货') return order.receiveAction
  if (normalized === '质检') return order.qcAction
  if (normalized === '后道') return order.postAction
  return order.recheckAction
}

function startedStatus(actionType: PostFinishingActionType): string {
  const normalized = normalizeActionType(actionType)
  if (normalized === '扫码收货') return '扫码收货中'
  if (normalized === '质检') return '质检中'
  if (normalized === '后道') return '后道中'
  return '复检中'
}

function doneStatus(actionType: PostFinishingActionType): string {
  const normalized = normalizeActionType(actionType)
  if (normalized === '扫码收货') return '已入库'
  if (normalized === '质检') return '质检完成'
  if (normalized === '后道') return '后道完成'
  return '复检完成'
}

function refreshPostOrderProjectStatus(order: PostFinishingWorkOrder): void {
  const postStatus = summarizePostProjectStatus(order.postProjectLines)
  const completedQty = roundQty(order.postProjectLines.reduce((sum, line) => sum + line.completedQty, 0))
  order.postStatus = postStatus
  order.postAction.status = postStatus
  order.postAction.acceptedGarmentQty = completedQty
  order.postAction.completedPostGarmentQty = completedQty
  order.postAction.postProjectLines = order.postProjectLines.map(clonePostProjectLine)
  order.postAction.startedAt = order.postProjectLines.find((line) => line.startedAt)?.startedAt
  order.postAction.finishedAt = postStatus === '后道完成'
    ? order.postProjectLines.map((line) => line.finishedAt).filter(Boolean).sort().at(-1)
    : undefined
  if (postStatus === '后道完成') {
    const recheck = ensurePostRecheckFromOrder(order)
    order.currentStatus = '待复检'
    order.recheckStatus = recheck.recheckStatus
    order.handoverStatus = '待复检'
  } else {
    order.currentStatus = postStatus
  }
  order.updatedAt = nowText()
}

function syncOrderStatusFields(order: PostFinishingWorkOrder): void {
  order.receiveMaterialStatus = order.receiveAction.status
  order.qcStatus = order.qcAction.status
  order.postStatus = order.postAction.status
  order.recheckStatus = order.recheckAction.status
  order.updatedAt = nowText()
  waitProcessWarehouseRecords = buildWaitProcessRecords()
  waitHandoverWarehouseRecords = buildWaitHandoverRecords()
}

function applyNextStatusAfterFinish(order: PostFinishingWorkOrder, actionType: PostFinishingActionType): void {
  const normalized = normalizeActionType(actionType)
  if (normalized === '扫码收货') order.currentStatus = '待质检'
  else if (normalized === '质检') order.currentStatus = order.requiresPostFinishing ? '待后道' : '待复检'
  else if (normalized === '后道') order.currentStatus = '待复检'
  else {
    order.currentStatus = '复检完成'
    order.waitHandoverWarehouseRecordId = order.waitHandoverWarehouseRecordId || `PF-WH-${order.postOrderNo.replace(/\D/g, '').slice(-3)}`
  }
}

export function applyPostFinishingActionStart(input: {
  postOrderId: string
  actionType: PostFinishingActionType
  operatorName?: string
  startedAt?: string
}): PostFinishingWorkOrder {
  const order = getMutablePostFinishingWorkOrder(input.postOrderId)
  const action = getAction(order, input.actionType)
  action.status = startedStatus(input.actionType)
  action.operatorName = input.operatorName || action.operatorName || '后道操作员'
  action.startedAt = input.startedAt || nowText()
  order.currentStatus = action.status
  syncOrderStatusFields(order)
  return cloneWorkOrder(order)
}

export function startPostFinishingProjectLine(input: {
  postOrderId: string
  projectLineId: string
  operatorName?: string
  startedAt?: string
}): PostFinishingWorkOrder {
  const order = getMutablePostFinishingWorkOrder(input.postOrderId)
  const line = order.postProjectLines.find((item) => item.projectLineId === input.projectLineId)
  if (!line) throw new Error(`未找到后道项目行：${input.projectLineId}`)
  if (line.status === '已完成') throw new Error('该后道项目已完成，不能再次开始。')
  line.status = '进行中'
  line.startedAt = input.startedAt || nowText()
  line.startedBy = input.operatorName || '后道操作员'
  refreshPostOrderProjectStatus(order)
  syncOrderStatusFields(order)
  return cloneWorkOrder(order)
}

export function completePostFinishingProjectLine(input: {
  postOrderId: string
  projectLineId: string
  operatorName?: string
  completedQty?: number
  finishedAt?: string
}): PostFinishingWorkOrder {
  const order = getMutablePostFinishingWorkOrder(input.postOrderId)
  const line = order.postProjectLines.find((item) => item.projectLineId === input.projectLineId)
  if (!line) throw new Error(`未找到后道项目行：${input.projectLineId}`)
  const completedQty = Math.max(Number(input.completedQty ?? line.plannedQty) || 0, 0)
  line.status = '已完成'
  line.startedAt = line.startedAt || input.finishedAt || nowText()
  line.startedBy = line.startedBy || input.operatorName || '后道操作员'
  line.finishedAt = input.finishedAt || nowText()
  line.finishedBy = input.operatorName || '后道操作员'
  line.completedQty = Math.min(completedQty, line.plannedQty)
  refreshPostOrderProjectStatus(order)
  syncOrderStatusFields(order)
  return cloneWorkOrder(order)
}

export function applyPostFinishingActionFinish(input: {
  postOrderId: string
  actionType: PostFinishingActionType
  operatorName?: string
  finishedAt?: string
  submittedGarmentQty?: number
  acceptedGarmentQty?: number
  rejectedGarmentQty?: number
  diffGarmentQty?: number
  remark?: string
  qualityFields?: Partial<PostFinishingQualityDeductionSnapshot>
}): PostFinishingWorkOrder {
  const order = getMutablePostFinishingWorkOrder(input.postOrderId)
  const action = getAction(order, input.actionType)
  const submittedQty = input.submittedGarmentQty ?? action.submittedGarmentQty
  const rejectedQty = input.rejectedGarmentQty ?? action.rejectedGarmentQty
  const acceptedQty = input.acceptedGarmentQty ?? Math.max(submittedQty - rejectedQty, 0)
  action.status = doneStatus(input.actionType)
  action.operatorName = input.operatorName || action.operatorName || '后道操作员'
  action.finishedAt = input.finishedAt || nowText()
  action.submittedGarmentQty = submittedQty
  action.acceptedGarmentQty = acceptedQty
  action.rejectedGarmentQty = rejectedQty
  action.diffGarmentQty = input.diffGarmentQty ?? rejectedQty
  action.remark = input.remark || action.remark
  if (normalizeActionType(input.actionType) === '扫码收货') action.receivedGarmentQty = acceptedQty
  if (normalizeActionType(input.actionType) === '质检') {
    action.inspectedGarmentQty = submittedQty
    action.passedGarmentQty = acceptedQty
    action.defectiveGarmentQty = rejectedQty
    action.reworkGarmentQty = input.qualityFields?.reworkQty ?? rejectedQty
    action.defectAcceptedGarmentQty = input.qualityFields?.defectAcceptedQty ?? 0
    action.processingFeeDeductionQty = input.qualityFields?.processingFeeDeductionQty ?? action.reworkGarmentQty
    action.reworkReceiveFactoryId = input.qualityFields?.reworkReceiveFactoryId
    action.reworkReceiveFactoryName = input.qualityFields?.reworkReceiveFactoryName
    action.qcResult = rejectedQty > 0 ? '部分不合格' : '全数合规'
    const qc = qcOrders.find((item) => item.qcOrderId === order.qcOrderId)
    if (qc) {
      qc.qcStatus = '质检完成'
      qc.inspectedGarmentQty = submittedQty
      qc.passedGarmentQty = acceptedQty
      qc.defectiveGarmentQty = rejectedQty
      qc.reworkGarmentQty = action.reworkGarmentQty ?? 0
      qc.defectAcceptedGarmentQty = action.defectAcceptedGarmentQty ?? 0
      qc.processingFeeDeductionQty = action.processingFeeDeductionQty ?? qc.reworkGarmentQty
      qc.reworkReceiveFactoryId = action.reworkReceiveFactoryId
      qc.reworkReceiveFactoryName = action.reworkReceiveFactoryName
      qc.qcResult = rejectedQty > 0 ? '部分不合格' : '全数合规'
      qc.inspectedAt = action.finishedAt
      action.qualityDeductionSnapshot = { ...makeQualitySnapshot(qc), ...input.qualityFields }
    }
  }
  if (normalizeActionType(input.actionType) === '后道') {
    order.postProjectLines = order.postProjectLines.map((line) => ({
      ...line,
      status: '已完成',
      startedAt: line.startedAt || action.startedAt || action.finishedAt,
      startedBy: line.startedBy || action.operatorName,
      finishedAt: action.finishedAt,
      finishedBy: action.operatorName,
      completedQty: line.plannedQty,
    }))
    action.completedPostGarmentQty = acceptedQty
    action.postProjectLines = order.postProjectLines.map(clonePostProjectLine)
    const recheck = ensurePostRecheckFromOrder(order)
    order.linkedRecheckOrderId = recheck.recheckOrderId
    order.recheckOrderId = recheck.recheckOrderId
    order.recheckOrderNo = recheck.recheckOrderNo
  }
  if (normalizeActionType(input.actionType) === '复检') {
    action.recheckedGarmentQty = acceptedQty
    action.confirmedGarmentQty = acceptedQty
    const recheck = recheckOrders.find((item) => item.postOrderId === order.postOrderId || item.recheckOrderId === order.recheckOrderId)
    if (recheck) {
      const recheckSkuResults = buildRecheckSkuResultsFromLines({
        recheckOrderId: recheck.recheckOrderId,
        lines: recheck.skuLines,
        completed: true,
        passedQty: acceptedQty,
        defectiveQty: rejectedQty,
      })
      recheck.recheckStatus = '复检完成'
      recheck.recheckedGarmentQty = submittedQty
      recheck.passedGarmentQty = roundQty(recheckSkuResults.reduce((sum, item) => sum + item.qualifiedQty, 0))
      recheck.defectiveGarmentQty = roundQty(recheckSkuResults.reduce((sum, item) => sum + item.unqualifiedQty, 0))
      recheck.recheckSkuResults = recheckSkuResults
      recheck.recheckerName = action.operatorName
      recheck.recheckedAt = action.finishedAt
      recheck.updatedAt = action.finishedAt || nowText()
      order.handoverStatus = '待交出'
    }
  }
  applyNextStatusAfterFinish(order, input.actionType)
  syncOrderStatusFields(order)
  return cloneWorkOrder(order)
}

export function completePostFinishingWorkOrder(input: { postOrderId: string; operatorName?: string; completedGarmentQty?: number }): PostFinishingWorkOrder {
  const order = getMutablePostFinishingWorkOrder(input.postOrderId)
  const now = nowText()
  order.postProjectLines = order.postProjectLines.map((line) => ({
    ...line,
    status: '已完成',
    startedAt: line.startedAt || now,
    startedBy: line.startedBy || input.operatorName || '后道操作员',
    finishedAt: now,
    finishedBy: input.operatorName || '后道操作员',
    completedQty: Math.min(input.completedGarmentQty ?? line.plannedQty, line.plannedQty),
  }))
  refreshPostOrderProjectStatus(order)
  syncOrderStatusFields(order)
  return cloneWorkOrder(order)
}

export function completePostFinishingRecheckOrder(input: {
  recheckOrderId: string
  operatorName?: string
  passedGarmentQty?: number
  defectiveGarmentQty?: number
  recheckSkuResults?: PostFinishingRecheckSkuResult[]
}): PostFinishingRecheckOrder {
  const recheck = recheckOrders.find((item) => item.recheckOrderId === input.recheckOrderId)
  if (!recheck) throw new Error(`未找到复检单：${input.recheckOrderId}`)
  const submittedQty = recheck.recheckedGarmentQty
  const defectiveQty = input.defectiveGarmentQty ?? 0
  const passedQty = input.passedGarmentQty ?? Math.max(submittedQty - defectiveQty, 0)
  const recheckSkuResults = normalizeRecheckSkuResults({
    recheckOrderId: recheck.recheckOrderId,
    lines: recheck.skuLines,
    results: input.recheckSkuResults,
    completed: true,
    passedQty,
    defectiveQty,
  })
  recheck.recheckStatus = '复检完成'
  recheck.recheckSkuResults = recheckSkuResults
  recheck.recheckedGarmentQty = roundQty(recheckSkuResults.reduce((sum, item) => sum + item.recheckQty, 0))
  recheck.passedGarmentQty = roundQty(recheckSkuResults.reduce((sum, item) => sum + item.qualifiedQty, 0))
  recheck.defectiveGarmentQty = roundQty(recheckSkuResults.reduce((sum, item) => sum + item.unqualifiedQty, 0))
  recheck.recheckerName = input.operatorName || '复检员'
  recheck.recheckedAt = nowText()
  recheck.updatedAt = recheck.recheckedAt
  const order = recheck.postOrderId ? postFinishingWorkOrders.find((item) => item.postOrderId === recheck.postOrderId) : undefined
  if (order) {
    order.recheckStatus = '复检完成'
    order.currentStatus = '复检完成'
    order.handoverStatus = '待交出'
    order.recheckAction = makeActionRecord({
      id: recheck.recheckOrderId,
      no: recheck.recheckOrderNo,
      postOrderId: order.postOrderId,
      postOrderNo: order.postOrderNo,
      actionType: '复检',
      status: '复检完成',
      sourceFactoryName: order.managedPostFactoryName,
      targetFactoryName: order.managedPostFactoryName,
      operatorName: recheck.recheckerName,
      submittedQty: recheck.recheckedGarmentQty,
      acceptedQty: recheck.passedGarmentQty,
      rejectedQty: recheck.defectiveGarmentQty,
      startedAt: recheck.createdAt,
      finishedAt: recheck.recheckedAt,
      skuLines: recheck.skuLines,
      recheck,
    })
  }
  refreshPostFinishingDerivedRecords()
  return cloneRecheck(recheck)
}

export function transferPostFinishingToManagedFactory(input: { postOrderId: string; operatorName?: string; operatedAt?: string; remark?: string }): PostFinishingWorkOrder {
  const order = getMutablePostFinishingWorkOrder(input.postOrderId)
  order.currentStatus = '待扫码收货'
  order.receiveAction.status = '待扫码收货'
  order.receiveAction.operatorName = input.operatorName || order.receiveAction.operatorName
  order.receiveAction.remark = input.remark || order.receiveAction.remark
  syncOrderStatusFields(order)
  return cloneWorkOrder(order)
}

export function receivePostFinishingAtManagedFactory(input: { postOrderId: string; operatorName?: string; operatedAt?: string; receivedGarmentQty?: number; remark?: string }): PostFinishingWorkOrder {
  return applyPostFinishingActionFinish({
    postOrderId: input.postOrderId,
    actionType: '扫码收货',
    operatorName: input.operatorName,
    finishedAt: input.operatedAt,
    submittedGarmentQty: input.receivedGarmentQty,
    acceptedGarmentQty: input.receivedGarmentQty,
    remark: input.remark,
  })
}

function buildFlowRecord(input: {
  recordNo: string
  index: number
  flowType: PostFinishingWarehouseFlowRecord['flowType']
  qty: number
  qtyUnit?: string
  beforeQty: number
  afterQty: number
  sourceActionRecordNo: string
  operatorName?: string
  operatedAt?: string
  remark?: string
}): PostFinishingWarehouseFlowRecord {
  return {
    flowRecordId: `${input.recordNo}-FLOW-${input.index}`,
    flowRecordNo: `${input.recordNo}-流水-${input.index}`,
    flowType: input.flowType,
    operatedAt: input.operatedAt || `2026-05-${String(input.index + 5).padStart(2, '0')} 10:00`,
    operatorName: input.operatorName || '后道仓管员',
    qty: input.qty,
    qtyUnit: input.qtyUnit || '件',
    beforeQty: input.beforeQty,
    afterQty: input.afterQty,
    sourceActionRecordNo: input.sourceActionRecordNo,
    remark: input.remark || `${input.flowType} ${input.qty} ${input.qtyUnit || '件'}`,
  }
}

function buildWaitProcessRecords(): PostFinishingWaitProcessWarehouseRecord[] {
  return receiptRecords.flatMap((receipt, receiptIndex) => {
    const context = getContext(receipt.sourceContextId)
    return receipt.skuLines.map((line, lineIndex) => {
      const recordNo = receiptWarehouseRecordId(receipt, lineIndex)
      const location = defaultWarehouseAreaAndLocation(lineIndex)
      return {
        warehouseRecordId: recordNo,
        warehouseRecordNo: recordNo,
        upstreamHandoverRecordNo: receipt.receiptNo,
        postOrderId: `PF-RECEIPT-${receipt.receiptId}`,
        postOrderNo: receipt.receiptNo,
        sourceProductionOrderNo: receipt.productionOrderNo,
        sourceTaskNo: receipt.sourceTaskNo,
        postSourceLabel: `${context.sourceFactoryType || '上游工厂'}交出`,
        managedPostFactoryName: FULL_CAPABILITY_FACTORY_NAME,
        styleNo: context.styleNo,
        spuId: context.spuId,
        spuCode: context.spuCode,
        spuName: context.spuName,
        skuId: line.skuId,
        skuCode: line.skuCode,
        colorName: line.colorName,
        sizeName: line.sizeName,
        skuSummary: `${line.skuCode} / ${line.colorName} / ${line.sizeName}`,
        inboundGarmentQty: line.receivedQty,
        availableGarmentQty: line.availableQty,
        plannedGarmentQty: line.plannedQty,
        qtyUnit: line.qtyUnit,
        inboundAt: receipt.receivedAt,
        updatedAt: receipt.receivedAt,
        ...location,
        flowRecords: [
          buildFlowRecord({
            recordNo,
            index: receiptIndex + lineIndex + 1,
            flowType: '扫码收货',
            qty: line.receivedQty,
            beforeQty: 0,
            afterQty: line.receivedQty,
            sourceActionRecordNo: receipt.receiptNo,
            operatorName: receipt.receiverName,
          }),
        ],
      }
    })
  })
}

function applyQcAllocationsToWaitProcessRecords(records: PostFinishingWaitProcessWarehouseRecord[]): PostFinishingWaitProcessWarehouseRecord[] {
  return records.map((record) => {
    const relatedAllocations = qcOrders
      .flatMap((qc) => qc.warehouseAllocations.map((allocation) => ({ qc, allocation })))
      .filter(({ allocation }) => allocation.warehouseRecordId === record.warehouseRecordId)
    if (!relatedAllocations.length) return record
    let runningQty = record.inboundGarmentQty
    const flowRecords = relatedAllocations.map(({ qc, allocation }, index) => {
      const beforeQty = runningQty
      runningQty = Math.max(runningQty - allocation.qcQty, 0)
      return buildFlowRecord({
        recordNo: record.warehouseRecordNo,
        index: record.flowRecords.length + index + 1,
        flowType: '质检占用',
        qty: allocation.qcQty,
        beforeQty,
        afterQty: runningQty,
        sourceActionRecordNo: qc.qcOrderNo,
        operatorName: qc.inspectorName || '后道质检员',
      })
    })
    return {
      ...record,
      availableGarmentQty: Math.max(record.inboundGarmentQty - relatedAllocations.reduce((sum, item) => sum + item.allocation.qcQty, 0), 0),
      updatedAt: relatedAllocations.at(-1)?.qc.updatedAt || record.updatedAt,
      flowRecords: [...record.flowRecords, ...flowRecords],
    }
  })
}

interface PostFinishingWarehouseStore {
  areas: PostFinishingWarehouseArea[]
  locations: PostFinishingWarehouseLocation[]
  waitProcessReceiptRecords: PostFinishingWaitProcessWarehouseRecord[]
  handoverSubmissions: PostFinishingHandoverSubmission[]
  sewingSelfReturnRecords: PostFinishingSewingSelfReturnRecord[]
}

const POST_FINISHING_WAREHOUSE_STORE_KEY = 'higoods-post-finishing-warehouse-config'
let fallbackPostFinishingWarehouseStore: PostFinishingWarehouseStore = {
  areas: [],
  locations: [],
  waitProcessReceiptRecords: [],
  handoverSubmissions: [],
  sewingSelfReturnRecords: [],
}

function createEmptyPostFinishingWarehouseStore(): PostFinishingWarehouseStore {
  return {
    areas: [],
    locations: [],
    waitProcessReceiptRecords: [],
    handoverSubmissions: [],
    sewingSelfReturnRecords: [],
  }
}

let postFinishingHandoverSubmissions: PostFinishingHandoverSubmission[] = []

function getPostFinishingHandoverSubmissions(): PostFinishingHandoverSubmission[] {
  const stored = readPostFinishingWarehouseStore().handoverSubmissions
  if (stored.length) {
    const existingIds = new Set(postFinishingHandoverSubmissions.map((item) => item.handoverRecordId))
    postFinishingHandoverSubmissions = [
      ...postFinishingHandoverSubmissions,
      ...stored.filter((item) => !existingIds.has(item.handoverRecordId)),
    ]
  }
  return postFinishingHandoverSubmissions
}

function persistPostFinishingHandoverSubmissions(): void {
  const store = readPostFinishingWarehouseStore()
  store.handoverSubmissions = postFinishingHandoverSubmissions.map((item) => ({ ...item }))
  writePostFinishingWarehouseStore(store)
}

function getRecheckLinePassedQty(recheck: PostFinishingRecheckOrder, line: PostFinishingSkuLine): number {
  const skuResult = recheck.recheckSkuResults.find((item) => item.skuLineId === line.skuLineId || item.skuId === line.skuId)
  if (skuResult) return Math.min(line.plannedQty, skuResult.qualifiedQty)
  const recheckedTotal = recheck.recheckedGarmentQty || totalQty(recheck.skuLines)
  if (recheckedTotal <= 0) return 0
  return Math.min(line.plannedQty, roundQty(line.plannedQty * (recheck.passedGarmentQty / recheckedTotal)))
}

function getHandoverSubmissionsForLine(recheck: PostFinishingRecheckOrder, line: PostFinishingSkuLine): PostFinishingHandoverSubmission[] {
  return getPostFinishingHandoverSubmissions().filter((item) => (
    (item.recheckOrderId === recheck.recheckOrderId || item.recheckOrderNo === recheck.recheckOrderNo)
    && item.skuLineId === line.skuLineId
  ))
}

function buildWaitHandoverRecords(): PostFinishingWaitHandoverWarehouseRecord[] {
  return recheckOrders
    .filter((recheck) => recheck.recheckStatus === '复检完成')
    .flatMap((recheck, orderIndex) => recheck.skuLines.map((line, lineIndex) => {
      const recordNo = `PF-WH-${pad(orderIndex + 1)}-${lineIndex + 1}`
      const passedQty = getRecheckLinePassedQty(recheck, line)
      if (passedQty <= 0) return undefined
      const lineSubmissions = getHandoverSubmissionsForLine(recheck, line)
      const submittedQty = roundQty(lineSubmissions.reduce((sum, item) => sum + item.submittedQty, 0))
      const receivedQty = roundQty(lineSubmissions.reduce((sum, item) => sum + (item.receiverWrittenQty || 0), 0))
      const latestSubmission = lineSubmissions.at(-1)
      let runningQty = passedQty
      const handoverFlows = lineSubmissions.flatMap((submission, submissionIndex) => {
        const beforeQty = runningQty
        runningQty = Math.max(roundQty(runningQty - submission.submittedQty), 0)
        const outFlow = buildFlowRecord({
          recordNo,
          index: submissionIndex * 2 + 2,
          flowType: '交出出仓',
          qty: submission.submittedQty,
          qtyUnit: submission.qtyUnit,
          beforeQty,
          afterQty: runningQty,
          sourceActionRecordNo: submission.handoverRecordNo,
          operatorName: submission.submittedBy,
          operatedAt: submission.submittedAt,
          remark: `工厂发起交出：${submission.handoverOrderNo} / ${submission.handoverRecordNo}`,
        })
        if (typeof submission.receiverWrittenQty !== 'number') return [outFlow]
        return [
          outFlow,
          buildFlowRecord({
            recordNo,
            index: submissionIndex * 2 + 3,
            flowType: '接收回写',
            qty: submission.receiverWrittenQty,
            qtyUnit: submission.qtyUnit,
            beforeQty: runningQty,
            afterQty: runningQty,
            sourceActionRecordNo: submission.handoverRecordNo,
            operatorName: submission.receiverWrittenBy || '接收方',
            operatedAt: submission.receiverWrittenAt,
            remark: `接收方回写：实收 ${submission.receiverWrittenQty} ${submission.qtyUnit}`,
          }),
        ]
      })
      return {
        warehouseRecordId: recordNo,
        warehouseRecordNo: recordNo,
        handoverRecordId: latestSubmission?.handoverRecordId,
        handoverRecordNo: latestSubmission?.handoverRecordNo,
        recheckOrderId: recheck.recheckOrderId,
        recheckOrderNo: recheck.recheckOrderNo,
        skuLineId: line.skuLineId,
        postOrderId: recheck.postOrderId || recheck.qcOrderId,
        postOrderNo: recheck.postOrderNo || recheck.qcOrderNo,
        sourceProductionOrderNo: recheck.productionOrderNo,
        sourceTaskNo: recheck.sourceTaskNo,
        postSourceLabel: recheck.sourceType === '后道单' ? '后道完成后复检' : '质检完成后复检',
        managedPostFactoryName: recheck.managedPostFactoryName,
        styleNo: recheck.spuCode,
        spuId: recheck.spuId,
        spuCode: recheck.spuCode,
        spuName: recheck.spuName,
        skuId: line.skuId,
        skuCode: line.skuCode,
        colorName: line.colorName,
        sizeName: line.sizeName,
        skuSummary: `${line.skuCode} / ${line.colorName} / ${line.sizeName}`,
        waitHandoverGarmentQty: passedQty,
        submittedHandoverGarmentQty: submittedQty,
        receivedHandoverGarmentQty: receivedQty,
        diffGarmentQty: roundQty(receivedQty - submittedQty),
        qtyUnit: line.qtyUnit,
        inboundAt: recheck.recheckedAt || recheck.updatedAt,
        updatedAt: recheck.updatedAt,
        flowRecords: [
          buildFlowRecord({
            recordNo,
            index: 1,
            flowType: '复检入仓',
            qty: passedQty,
            qtyUnit: line.qtyUnit,
            beforeQty: 0,
            afterQty: passedQty,
            sourceActionRecordNo: recheck.recheckOrderNo,
            operatorName: recheck.recheckerName,
            operatedAt: recheck.recheckedAt || recheck.updatedAt,
            remark: `复检合格入待交出仓：${recheck.recheckOrderNo}`,
          }),
          ...handoverFlows,
        ],
      }
    }).filter((record): record is PostFinishingWaitHandoverWarehouseRecord => Boolean(record)))
}

let waitProcessWarehouseRecords = buildWaitProcessRecords()
let waitHandoverWarehouseRecords = buildWaitHandoverRecords()

function readPostFinishingWarehouseStore(): PostFinishingWarehouseStore {
  if (typeof window === 'undefined') return cloneValue(fallbackPostFinishingWarehouseStore)
  try {
    const raw = window.localStorage.getItem(POST_FINISHING_WAREHOUSE_STORE_KEY)
    if (!raw) return createEmptyPostFinishingWarehouseStore()
    const parsed = JSON.parse(raw) as Partial<PostFinishingWarehouseStore>
    return {
      areas: Array.isArray(parsed.areas) ? parsed.areas : [],
      locations: Array.isArray(parsed.locations) ? parsed.locations : [],
      waitProcessReceiptRecords: Array.isArray(parsed.waitProcessReceiptRecords) ? parsed.waitProcessReceiptRecords : [],
      handoverSubmissions: Array.isArray(parsed.handoverSubmissions) ? parsed.handoverSubmissions : [],
      sewingSelfReturnRecords: Array.isArray(parsed.sewingSelfReturnRecords) ? parsed.sewingSelfReturnRecords : [],
    }
  } catch {
    return createEmptyPostFinishingWarehouseStore()
  }
}

function writePostFinishingWarehouseStore(store: PostFinishingWarehouseStore): void {
  if (typeof window === 'undefined') {
    fallbackPostFinishingWarehouseStore = cloneValue(store)
    return
  }
  window.localStorage.setItem(POST_FINISHING_WAREHOUSE_STORE_KEY, JSON.stringify(store))
}

function postFinishingWarehousePrefix(mode: PostFinishingWarehouseMode): string {
  return mode === 'wait-process' ? 'PFP' : 'PFH'
}

function postFinishingWarehouseName(mode: PostFinishingWarehouseMode): string {
  return mode === 'wait-process' ? '后道待加工仓' : '后道待交出仓'
}

function getDefaultPostFinishingWarehouseAreas(mode: PostFinishingWarehouseMode): PostFinishingWarehouseArea[] {
  const prefix = postFinishingWarehousePrefix(mode)
  const warehouseName = postFinishingWarehouseName(mode)
  const areas: PostFinishingWarehouseArea[] = [
    {
      areaId: `${prefix}-AREA-A`,
      warehouseMode: mode,
      areaCode: `${prefix}-A`,
      areaName: `${warehouseName} A 区`,
      managerName: '后道仓管员',
      remark: '默认库区',
      updatedAt: '2026-05-09 09:00',
    },
    {
      areaId: `${prefix}-AREA-B`,
      warehouseMode: mode,
      areaCode: `${prefix}-B`,
      areaName: `${warehouseName} B 区`,
      managerName: '后道仓管员',
      remark: '周转库区',
      updatedAt: '2026-05-09 09:00',
    },
  ]
  if (mode === 'wait-process') {
    areas.push({
      areaId: SEWING_SELF_RETURN_DEFAULT_AREA_ID,
      warehouseMode: mode,
      areaCode: 'PFP-SELF',
      areaName: SEWING_SELF_RETURN_DEFAULT_AREA_NAME,
      managerName: '后道仓管员',
      remark: '车缝厂自助回货固定暂存库区',
      updatedAt: '2026-06-11 09:00',
    })
  }
  return areas
}

export function listPostFinishingWarehouseAreas(mode: PostFinishingWarehouseMode): PostFinishingWarehouseArea[] {
  const storedAreas = readPostFinishingWarehouseStore().areas.filter((area) => area.warehouseMode === mode)
  const storedIds = new Set(storedAreas.map((area) => area.areaId))
  return cloneValue([
    ...storedAreas,
    ...getDefaultPostFinishingWarehouseAreas(mode).filter((area) => !storedIds.has(area.areaId)),
  ])
}

function findPostFinishingWarehouseArea(mode: PostFinishingWarehouseMode, areaIdOrName: string | undefined): PostFinishingWarehouseArea | undefined {
  if (!areaIdOrName) return undefined
  return listPostFinishingWarehouseAreas(mode).find((area) => area.areaId === areaIdOrName || area.areaName === areaIdOrName)
}

export function upsertPostFinishingWarehouseArea(input: Partial<PostFinishingWarehouseArea> & { warehouseMode: PostFinishingWarehouseMode }): PostFinishingWarehouseArea {
  const store = readPostFinishingWarehouseStore()
  const areaId = input.areaId || `PFAREA-${input.warehouseMode}-${Date.now()}`
  const existing =
    store.areas.find((area) => area.areaId === areaId)
    || getDefaultPostFinishingWarehouseAreas(input.warehouseMode).find((area) => area.areaId === areaId)
  const next: PostFinishingWarehouseArea = {
    areaId,
    warehouseMode: input.warehouseMode,
    areaCode: input.areaCode?.trim() || existing?.areaCode || `PFAREA-${String(store.areas.length + 1).padStart(2, '0')}`,
    areaName: input.areaName?.trim() || existing?.areaName || `${postFinishingWarehouseName(input.warehouseMode)}新区`,
    managerName: input.managerName?.trim() || existing?.managerName || '后道仓管员',
    remark: input.remark?.trim() || existing?.remark || '',
    updatedAt: nowText(),
  }
  const index = store.areas.findIndex((area) => area.areaId === areaId)
  if (index >= 0) store.areas[index] = next
  else store.areas.unshift(next)
  store.locations = store.locations.map((location) => (
    location.warehouseMode === next.warehouseMode && location.areaId === next.areaId
      ? { ...location, areaName: next.areaName, updatedAt: next.updatedAt }
      : location
  ))
  writePostFinishingWarehouseStore(store)
  return cloneValue(next)
}

function getDefaultPostFinishingWarehouseLocations(mode: PostFinishingWarehouseMode): PostFinishingWarehouseLocation[] {
  const prefix = postFinishingWarehousePrefix(mode)
  const areas = getDefaultPostFinishingWarehouseAreas(mode)
  const locations: PostFinishingWarehouseLocation[] = [
    {
      locationId: `${prefix}-LOC-A01`,
      warehouseMode: mode,
      areaId: areas[0].areaId,
      areaName: areas[0].areaName,
      locationCode: `${prefix}-A-01`,
      managerName: '后道仓管员',
      remark: '默认库位',
      updatedAt: '2026-05-09 09:00',
    },
    {
      locationId: `${prefix}-LOC-B01`,
      warehouseMode: mode,
      areaId: areas[1].areaId,
      areaName: areas[1].areaName,
      locationCode: `${prefix}-B-01`,
      managerName: '后道仓管员',
      remark: '周转库位',
      updatedAt: '2026-05-09 09:00',
    },
  ]
  if (mode === 'wait-process') {
    locations.push({
      locationId: SEWING_SELF_RETURN_DEFAULT_LOCATION_ID,
      warehouseMode: mode,
      areaId: SEWING_SELF_RETURN_DEFAULT_AREA_ID,
      areaName: SEWING_SELF_RETURN_DEFAULT_AREA_NAME,
      locationCode: SEWING_SELF_RETURN_DEFAULT_LOCATION_CODE,
      managerName: '后道仓管员',
      remark: '车缝自助交货默认库位',
      updatedAt: '2026-06-11 09:00',
    })
  }
  return locations
}

export function listPostFinishingWarehouseLocations(mode: PostFinishingWarehouseMode): PostFinishingWarehouseLocation[] {
  const areas = listPostFinishingWarehouseAreas(mode)
  const storedLocations = readPostFinishingWarehouseStore().locations.filter((location) => location.warehouseMode === mode)
  const storedIds = new Set(storedLocations.map((location) => location.locationId))
  return cloneValue([
    ...storedLocations,
    ...getDefaultPostFinishingWarehouseLocations(mode).filter((location) => !storedIds.has(location.locationId)),
  ].map((location) => {
    const area = areas.find((item) => item.areaId === location.areaId || item.areaName === location.areaName)
    return area ? { ...location, areaId: area.areaId, areaName: area.areaName } : location
  }))
}

export function upsertPostFinishingWarehouseLocation(input: Partial<PostFinishingWarehouseLocation> & { warehouseMode: PostFinishingWarehouseMode }): PostFinishingWarehouseLocation {
  const store = readPostFinishingWarehouseStore()
  const locationId = input.locationId || `PFLOC-${input.warehouseMode}-${Date.now()}`
  const existing =
    store.locations.find((location) => location.locationId === locationId)
    || getDefaultPostFinishingWarehouseLocations(input.warehouseMode).find((location) => location.locationId === locationId)
  const area = findPostFinishingWarehouseArea(input.warehouseMode, input.areaId || input.areaName)
  const next: PostFinishingWarehouseLocation = {
    locationId,
    warehouseMode: input.warehouseMode,
    areaId: area?.areaId || existing?.areaId || '',
    areaName: area?.areaName || input.areaName?.trim() || existing?.areaName || `${postFinishingWarehouseName(input.warehouseMode)} A 区`,
    locationCode: input.locationCode?.trim() || existing?.locationCode || `PFLOC-${String(store.locations.length + 1).padStart(2, '0')}`,
    managerName: input.managerName?.trim() || existing?.managerName || '后道仓管员',
    remark: input.remark?.trim() || existing?.remark || '',
    updatedAt: nowText(),
  }
  const index = store.locations.findIndex((location) => location.locationId === locationId)
  if (index >= 0) store.locations[index] = next
  else store.locations.unshift(next)
  writePostFinishingWarehouseStore(store)
  return cloneValue(next)
}

export function deletePostFinishingWarehouseLocation(locationId: string): void {
  const store = readPostFinishingWarehouseStore()
  store.locations = store.locations.filter((location) => location.locationId !== locationId)
  writePostFinishingWarehouseStore(store)
}

interface SewingSelfReturnScanPayload {
  documentType?: string
  sourceType?: string
  sourceId?: string
  businessNo?: string
  targetRoute?: string
  printVersionNo?: string
  isVoid?: boolean
  productionOrderNo?: string
}

export interface PostFinishingSewingSelfReturnScanResult {
  productionConfirmationNo: string
  productionOrderId: string
  productionOrderNo: string
  sourceTaskNo: string
  sourceFactoryName: string
  sourceFactoryType: '车缝厂'
  styleNo: string
  spuId: string
  spuCode: string
  spuName: string
  defaultWarehouseName: '后道待加工仓'
  defaultAreaName: string
  defaultLocationCode: string
  items: Array<{
    skuLineId: string
    skuId: string
    skuCode: string
    colorName: string
    sizeName: string
    plannedQty: number
    qtyUnit: string
  }>
}

export interface PostFinishingSewingSelfReturnCreateInput {
  scanValue: string
  deliveryPersonName: string
  deliveryPersonPhone?: string
  deviceFactoryId: string
  deviceFactoryName: string
  deviceUserName: string
  evidenceText?: string
  items: Array<{
    skuLineId?: string
    skuId?: string
    submittedQty: number
  }>
}

export interface PostFinishingSewingSelfReturnConfirmInput {
  recordId: string
  confirmerName: string
  remark?: string
  lines: Array<{
    itemId?: string
    warehouseRecordId?: string
    skuLineId?: string
    skuId?: string
    confirmedQty: number
  }>
}

export function getPostFinishingWaitProcessReceiptConfirmStatus(record: PostFinishingWaitProcessWarehouseRecord): PostFinishingSewingSelfReturnStatus {
  if (record.receiptConfirmStatus) return record.receiptConfirmStatus
  return '已确认入库'
}

export function getPostFinishingSewingSelfReturnDefaultLocation(): {
  warehouseName: '后道待加工仓'
  areaId: string
  areaName: string
  locationId: string
  locationCode: string
} {
  const area = listPostFinishingWarehouseAreas('wait-process').find((item) => item.areaId === SEWING_SELF_RETURN_DEFAULT_AREA_ID)
  const location = listPostFinishingWarehouseLocations('wait-process').find((item) => item.locationId === SEWING_SELF_RETURN_DEFAULT_LOCATION_ID)
  return {
    warehouseName: '后道待加工仓',
    areaId: area?.areaId || SEWING_SELF_RETURN_DEFAULT_AREA_ID,
    areaName: area?.areaName || SEWING_SELF_RETURN_DEFAULT_AREA_NAME,
    locationId: location?.locationId || SEWING_SELF_RETURN_DEFAULT_LOCATION_ID,
    locationCode: location?.locationCode || SEWING_SELF_RETURN_DEFAULT_LOCATION_CODE,
  }
}

function parseSewingSelfReturnScanPayload(scanValue: string): SewingSelfReturnScanPayload {
  const raw = scanValue.trim()
  if (!raw) throw new Error('请先扫描生产确认单。')
  try {
    const parsed = JSON.parse(raw) as SewingSelfReturnScanPayload
    return parsed && typeof parsed === 'object' ? parsed : { sourceId: raw }
  } catch {
    return { sourceId: raw, businessNo: raw, productionOrderNo: raw }
  }
}

function findSewingSelfReturnSourceContext(payload: SewingSelfReturnScanPayload): PostFinishingSourceContext | undefined {
  const candidates = [
    payload.sourceId,
    payload.productionOrderNo,
    payload.businessNo,
  ]
    .map((item) => String(item || '').trim())
    .filter(Boolean)

  return SOURCE_CONTEXTS.find((context) => (
    context.sourceFactoryType === '车缝厂'
    && candidates.some((value) => (
      value === context.productionOrderId
      || value === context.productionOrderNo
      || value === context.sourceTaskId
      || value === context.sourceTaskNo
    ))
  ))
}

function buildSewingSelfReturnScanValue(context: PostFinishingSourceContext, printVersionNo: string): string {
  return JSON.stringify({
    documentType: 'PRODUCTION_CONFIRMATION',
    sourceType: 'PRODUCTION_ORDER',
    sourceId: context.productionOrderId,
    businessNo: `PC-${context.productionOrderNo}`,
    targetRoute: `/fcs/production/orders/${context.productionOrderId}/confirmation-print`,
    printVersionNo,
    isVoid: false,
    productionOrderNo: context.productionOrderNo,
  })
}

export function getPostFinishingSewingSelfReturnDemoScanValue(): string {
  const context = SOURCE_CONTEXTS.find((item) => item.sourceFactoryType === '车缝厂')
  if (!context) return ''
  return buildSewingSelfReturnScanValue(context, 'PRINT-V1')
}

export function resolvePostFinishingSewingSelfReturnScan(scanValue: string): PostFinishingSewingSelfReturnScanResult {
  const payload = parseSewingSelfReturnScanPayload(scanValue)
  if (payload.documentType && payload.documentType !== 'PRODUCTION_CONFIRMATION') {
    throw new Error('当前二维码不是生产确认单，请扫描纸质生产确认单。')
  }
  if (payload.sourceType && payload.sourceType !== 'PRODUCTION_ORDER') {
    throw new Error('生产确认单来源类型不正确。')
  }
  if (payload.isVoid) {
    throw new Error('该生产确认单已作废，不能用于车缝自助回货。')
  }
  const context = findSewingSelfReturnSourceContext(payload)
  if (!context) {
    throw new Error('未找到该生产确认单对应的车缝任务或后道工厂。')
  }
  const defaultLocation = getPostFinishingSewingSelfReturnDefaultLocation()
  return {
    productionConfirmationNo: String(payload.businessNo || `PC-${context.productionOrderNo}`),
    productionOrderId: context.productionOrderId,
    productionOrderNo: context.productionOrderNo,
    sourceTaskNo: context.sourceTaskNo || '未关联车缝任务',
    sourceFactoryName: context.sourceFactoryName || '车缝工厂',
    sourceFactoryType: '车缝厂',
    styleNo: context.styleNo,
    spuId: context.spuId,
    spuCode: context.spuCode,
    spuName: context.spuName,
    defaultWarehouseName: defaultLocation.warehouseName,
    defaultAreaName: defaultLocation.areaName,
    defaultLocationCode: defaultLocation.locationCode,
    items: context.skuLines.map((line) => ({
      skuLineId: line.skuLineId,
      skuId: line.skuId,
      skuCode: line.skuCode,
      colorName: line.colorName,
      sizeName: line.sizeName,
      plannedQty: line.plannedQty,
      qtyUnit: line.qtyUnit,
    })),
  }
}

export function listPostFinishingSewingSelfReturnRecords(): PostFinishingSewingSelfReturnRecord[] {
  return readPostFinishingWarehouseStore().sewingSelfReturnRecords.map(cloneSewingSelfReturnRecord)
}

export function ensurePostFinishingSewingSelfReturnMockRecords(): PostFinishingSewingSelfReturnRecord[] {
  const existingRecords = listPostFinishingSewingSelfReturnRecords()
  if (existingRecords.length > 0) return existingRecords

  SOURCE_CONTEXTS
    .filter((context) => context.sourceFactoryType === '车缝厂')
    .slice(0, 2)
    .forEach((context, contextIndex) => {
      createPostFinishingSewingSelfReturn({
        scanValue: buildSewingSelfReturnScanValue(context, `PRINT-MOCK-${contextIndex + 1}`),
        deliveryPersonName: contextIndex === 0 ? 'Andi / PT Indo Sewing Center' : 'Budi / PT Prima Tailor Jakarta',
        deliveryPersonPhone: contextIndex === 0 ? '0812-3300-1001' : '0812-3300-2007',
        evidenceText: contextIndex === 0 ? '现场已上传纸质确认单照片、外箱照片。' : '现场已上传签收照片。',
        deviceFactoryId: FULL_CAPABILITY_FACTORY_ID,
        deviceFactoryName: FULL_CAPABILITY_FACTORY_NAME,
        deviceUserName: '后道管理员',
        items: context.skuLines.map((line) => ({
          skuLineId: line.skuLineId,
          submittedQty: contextIndex === 0 ? line.plannedQty : Math.max(1, Math.round(line.plannedQty * 0.75)),
        })),
      })
    })

  return listPostFinishingSewingSelfReturnRecords()
}

export function getPostFinishingSewingSelfReturnRecord(recordIdOrNo: string): PostFinishingSewingSelfReturnRecord | undefined {
  const record = listPostFinishingSewingSelfReturnRecords().find((item) => item.recordId === recordIdOrNo || item.recordNo === recordIdOrNo)
  return record ? cloneSewingSelfReturnRecord(record) : undefined
}

export function resetPostFinishingSewingSelfReturnDemoRecords(): void {
  const store = readPostFinishingWarehouseStore()
  store.sewingSelfReturnRecords = []
  store.waitProcessReceiptRecords = store.waitProcessReceiptRecords.filter((record) => !record.selfReturnRecordId)
  writePostFinishingWarehouseStore(store)
}

function resolveSewingSelfReturnItemLines(
  context: PostFinishingSourceContext,
  inputItems: PostFinishingSewingSelfReturnCreateInput['items'],
): Array<{ line: PostFinishingSkuLine; submittedQty: number }> {
  return inputItems
    .map((item) => {
      const line = context.skuLines.find((candidate) => (
        candidate.skuLineId === item.skuLineId
        || candidate.skuId === item.skuId
        || candidate.skuCode === item.skuId
      ))
      const submittedQty = roundQty(Number(item.submittedQty) || 0)
      if (!line || submittedQty <= 0) return null
      return { line, submittedQty }
    })
    .filter((item): item is { line: PostFinishingSkuLine; submittedQty: number } => Boolean(item))
}

export function createPostFinishingSewingSelfReturn(input: PostFinishingSewingSelfReturnCreateInput): PostFinishingSewingSelfReturnRecord {
  const payload = parseSewingSelfReturnScanPayload(input.scanValue)
  const scanResult = resolvePostFinishingSewingSelfReturnScan(input.scanValue)
  const context = findSewingSelfReturnSourceContext(payload)
  if (!context) throw new Error('未找到该生产确认单对应的车缝任务或后道工厂。')
  if (input.deviceFactoryId !== FULL_CAPABILITY_FACTORY_ID) {
    throw new Error('车缝自助回货只能在后道工厂公共 PDA 上提交。')
  }
  const deliveryPersonName = input.deliveryPersonName.trim()
  if (!deliveryPersonName) throw new Error('请填写车缝厂送货人。')
  const lines = resolveSewingSelfReturnItemLines(context, input.items)
  if (!lines.length) throw new Error('请至少提交一条大于 0 的颜色尺码数量。')

  const now = nowText()
  const store = readPostFinishingWarehouseStore()
  const sequence = store.sewingSelfReturnRecords.length + 1
  const recordId = `PF-SELF-RET-${pad(sequence)}`
  const recordNo = `车缝自助回货-${pad(sequence)}`
  const handoverOrderId = `HOH-SEW-SELF-${pad(sequence)}`
  const handoverOrderNo = `车缝现场交出单-${pad(sequence)}`
  const defaultLocation = getPostFinishingSewingSelfReturnDefaultLocation()
  const warehouseRecords: PostFinishingWaitProcessWarehouseRecord[] = []

  const items: PostFinishingSewingSelfReturnItem[] = lines.map(({ line, submittedQty }, index) => {
    const itemSeq = index + 1
    const itemId = `${recordId}-ITEM-${itemSeq}`
    const handoverRecordId = `HDR-SEW-SELF-${pad(sequence)}-${itemSeq}`
    const handoverRecordNo = `车缝现场交出记录-${pad(sequence)}-${itemSeq}`
    const warehouseRecordId = `PF-WP-SELF-${pad(sequence)}-${itemSeq}`
    const warehouseRecordNo = `后道待加工入库-${pad(sequence)}-${itemSeq}`
    const skuSummary = `${line.skuCode} / ${line.colorName} / ${line.sizeName}`

    warehouseRecords.push({
      warehouseRecordId,
      warehouseRecordNo,
      upstreamHandoverRecordNo: handoverRecordNo,
      postOrderId: `PF-SELF-${recordId}`,
      postOrderNo: recordNo,
      sourceProductionOrderNo: context.productionOrderNo,
      sourceTaskNo: context.sourceTaskNo || '未关联车缝任务',
      postSourceLabel: '车缝自助回货',
      managedPostFactoryName: FULL_CAPABILITY_FACTORY_NAME,
      styleNo: context.styleNo,
      spuId: context.spuId,
      spuCode: context.spuCode,
      spuName: context.spuName,
      skuId: line.skuId,
      skuCode: line.skuCode,
      colorName: line.colorName,
      sizeName: line.sizeName,
      skuSummary,
      inboundGarmentQty: submittedQty,
      availableGarmentQty: 0,
      plannedGarmentQty: line.plannedQty,
      qtyUnit: line.qtyUnit,
      inboundAt: now,
      updatedAt: now,
      areaId: defaultLocation.areaId,
      areaName: defaultLocation.areaName,
      locationId: defaultLocation.locationId,
      locationCode: defaultLocation.locationCode,
      receiptConfirmStatus: '待后道确认',
      selfReturnRecordId: recordId,
      selfReturnRecordNo: recordNo,
      submittedGarmentQty: submittedQty,
      flowRecords: [{
        flowRecordId: `${warehouseRecordId}-FLOW-1`,
        flowRecordNo: `${warehouseRecordNo}-流水-1`,
        flowType: '车缝自助回货提交',
        operatedAt: now,
        operatorName: deliveryPersonName,
        qty: submittedQty,
        qtyUnit: line.qtyUnit,
        beforeQty: 0,
        afterQty: 0,
        sourceActionRecordNo: recordNo,
        remark: `车缝厂使用后道公共 PDA 自助回货，暂存至后道待加工仓 / ${defaultLocation.areaName} / ${defaultLocation.locationCode}，待后道确认。`,
      }],
    })

    return {
      itemId,
      skuLineId: line.skuLineId,
      skuId: line.skuId,
      skuCode: line.skuCode,
      colorName: line.colorName,
      sizeName: line.sizeName,
      submittedQty,
      qtyUnit: line.qtyUnit,
      plannedQty: line.plannedQty,
      handoverRecordId,
      handoverRecordNo,
      warehouseRecordId,
      warehouseRecordNo,
    }
  })

  const record: PostFinishingSewingSelfReturnRecord = {
    recordId,
    recordNo,
    status: '待后道确认',
    productionConfirmationNo: scanResult.productionConfirmationNo,
    productionOrderId: context.productionOrderId,
    productionOrderNo: context.productionOrderNo,
    sourceTaskId: context.sourceTaskId,
    sourceTaskNo: context.sourceTaskNo || '未关联车缝任务',
    sourceFactoryId: context.sourceFactoryId,
    sourceFactoryName: context.sourceFactoryName || '车缝工厂',
    sourceFactoryType: '车缝厂',
    styleNo: context.styleNo,
    spuId: context.spuId,
    spuCode: context.spuCode,
    spuName: context.spuName,
    managedPostFactoryId: FULL_CAPABILITY_FACTORY_ID,
    managedPostFactoryName: FULL_CAPABILITY_FACTORY_NAME,
    deviceFactoryId: input.deviceFactoryId,
    deviceFactoryName: input.deviceFactoryName,
    publicPdaMode: '车缝现场交货登记',
    submittedByName: deliveryPersonName,
    submittedByPhone: input.deliveryPersonPhone?.trim() || undefined,
    submittedAt: now,
    submittedByDeviceUserName: input.deviceUserName,
    evidenceText: input.evidenceText?.trim() || undefined,
    defaultWarehouseName: defaultLocation.warehouseName,
    defaultAreaId: defaultLocation.areaId,
    defaultAreaName: defaultLocation.areaName,
    defaultLocationId: defaultLocation.locationId,
    defaultLocationCode: defaultLocation.locationCode,
    items,
    handoverOrderId,
    handoverOrderNo,
    handoverRecordNos: items.map((item) => item.handoverRecordNo),
    warehouseRecordNos: items.map((item) => item.warehouseRecordNo),
  }

  store.sewingSelfReturnRecords = [record, ...store.sewingSelfReturnRecords.filter((item) => item.recordId !== record.recordId)]
  store.waitProcessReceiptRecords = [
    ...warehouseRecords,
    ...store.waitProcessReceiptRecords.filter((item) => !warehouseRecords.some((recordItem) => recordItem.warehouseRecordId === item.warehouseRecordId)),
  ]
  writePostFinishingWarehouseStore(store)
  return cloneSewingSelfReturnRecord(record)
}

function updateSewingSelfReturnWarehouseRecordForConfirm(
  record: PostFinishingWaitProcessWarehouseRecord,
  confirmedQty: number,
  operatorName: string,
  operatedAt: string,
  remark?: string,
): PostFinishingWaitProcessWarehouseRecord {
  const submittedQty = record.submittedGarmentQty ?? record.inboundGarmentQty
  const nextStatus: PostFinishingSewingSelfReturnStatus = confirmedQty === submittedQty ? '已确认入库' : '数量差异待处理'
  const flowIndex = record.flowRecords.length + 1
  return {
    ...record,
    inboundGarmentQty: confirmedQty,
    availableGarmentQty: confirmedQty,
    confirmedGarmentQty: confirmedQty,
    receiptConfirmStatus: nextStatus,
    confirmationAt: operatedAt,
    confirmationBy: operatorName,
    confirmationRemark: remark,
    updatedAt: operatedAt,
    flowRecords: [
      ...record.flowRecords,
      {
        flowRecordId: `${record.warehouseRecordId}-FLOW-${flowIndex}`,
        flowRecordNo: `${record.warehouseRecordNo}-流水-${flowIndex}`,
        flowType: '后道确认入库',
        operatedAt,
        operatorName,
        qty: confirmedQty,
        qtyUnit: record.qtyUnit,
        beforeQty: 0,
        afterQty: confirmedQty,
        sourceActionRecordNo: record.selfReturnRecordNo || record.warehouseRecordNo,
        remark: remark || `后道确认车缝自助回货：登记 ${submittedQty}${record.qtyUnit}，确认 ${confirmedQty}${record.qtyUnit}`,
      },
    ],
  }
}

export function confirmPostFinishingSewingSelfReturnReceipt(input: PostFinishingSewingSelfReturnConfirmInput): PostFinishingSewingSelfReturnRecord {
  const store = readPostFinishingWarehouseStore()
  const recordIndex = store.sewingSelfReturnRecords.findIndex((item) => item.recordId === input.recordId || item.recordNo === input.recordId)
  if (recordIndex < 0) throw new Error('未找到车缝自助回货记录。')
  const current = store.sewingSelfReturnRecords[recordIndex]
  if (current.status === '已驳回') throw new Error('该自助回货记录已驳回，不能确认入库。')
  const now = nowText()
  const confirmedItems = current.items.map((item) => {
    const lineInput = input.lines.find((line) => (
      line.itemId === item.itemId
      || line.warehouseRecordId === item.warehouseRecordId
      || line.skuLineId === item.skuLineId
      || line.skuId === item.skuId
    ))
    const confirmedQty = roundQty(Number(lineInput?.confirmedQty ?? item.submittedQty) || 0)
    if (confirmedQty < 0) throw new Error('确认数量不能小于 0。')
    return { ...item, confirmedQty }
  })

  const confirmedByWarehouseId = new Map(confirmedItems.map((item) => [item.warehouseRecordId, item.confirmedQty ?? item.submittedQty]))
  store.waitProcessReceiptRecords = store.waitProcessReceiptRecords.map((record) => {
    if (!record.selfReturnRecordId || record.selfReturnRecordId !== current.recordId) return record
    const confirmedQty = confirmedByWarehouseId.get(record.warehouseRecordId)
    if (typeof confirmedQty !== 'number') return record
    return updateSewingSelfReturnWarehouseRecordForConfirm(record, confirmedQty, input.confirmerName || '后道确认人', now, input.remark?.trim())
  })

  const hasDiff = confirmedItems.some((item) => item.confirmedQty !== item.submittedQty)
  const nextRecord: PostFinishingSewingSelfReturnRecord = {
    ...current,
    status: hasDiff ? '数量差异待处理' : '已确认入库',
    items: confirmedItems,
    confirmedAt: now,
    confirmedBy: input.confirmerName || '后道确认人',
    confirmationRemark: input.remark?.trim() || undefined,
  }
  store.sewingSelfReturnRecords[recordIndex] = nextRecord
  writePostFinishingWarehouseStore(store)
  return cloneSewingSelfReturnRecord(nextRecord)
}

export function confirmPostFinishingSewingSelfReturnWarehouseRecord(input: {
  warehouseRecordId: string
  confirmedQty: number
  confirmerName: string
  remark?: string
}): PostFinishingSewingSelfReturnRecord {
  const warehouseRecord = readPostFinishingWarehouseStore().waitProcessReceiptRecords.find((record) => record.warehouseRecordId === input.warehouseRecordId)
  if (!warehouseRecord?.selfReturnRecordId) throw new Error('该待加工仓记录不是车缝自助回货记录。')
  const selfReturn = getPostFinishingSewingSelfReturnRecord(warehouseRecord.selfReturnRecordId)
  if (!selfReturn) throw new Error('未找到对应的车缝自助回货记录。')
  const lines = selfReturn.items.map((item) => ({
    itemId: item.itemId,
    confirmedQty: item.warehouseRecordId === input.warehouseRecordId ? input.confirmedQty : item.confirmedQty ?? item.submittedQty,
  }))
  return confirmPostFinishingSewingSelfReturnReceipt({
    recordId: selfReturn.recordId,
    confirmerName: input.confirmerName,
    remark: input.remark,
    lines,
  })
}

export function rejectPostFinishingSewingSelfReturnReceipt(input: {
  recordId: string
  rejectReason: string
  rejectedBy: string
}): PostFinishingSewingSelfReturnRecord {
  const store = readPostFinishingWarehouseStore()
  const recordIndex = store.sewingSelfReturnRecords.findIndex((item) => item.recordId === input.recordId || item.recordNo === input.recordId)
  if (recordIndex < 0) throw new Error('未找到车缝自助回货记录。')
  const current = store.sewingSelfReturnRecords[recordIndex]
  const now = nowText()
  const reason = input.rejectReason.trim() || '后道拒收'
  store.waitProcessReceiptRecords = store.waitProcessReceiptRecords.map((record) => {
    if (record.selfReturnRecordId !== current.recordId) return record
    const flowIndex = record.flowRecords.length + 1
    return {
      ...record,
      inboundGarmentQty: 0,
      availableGarmentQty: 0,
      confirmedGarmentQty: 0,
      receiptConfirmStatus: '已驳回',
      rejectedAt: now,
      rejectedBy: input.rejectedBy,
      rejectedReason: reason,
      updatedAt: now,
      flowRecords: [
        ...record.flowRecords,
        {
          flowRecordId: `${record.warehouseRecordId}-FLOW-${flowIndex}`,
          flowRecordNo: `${record.warehouseRecordNo}-流水-${flowIndex}`,
          flowType: '后道驳回入库',
          operatedAt: now,
          operatorName: input.rejectedBy,
          qty: 0,
          qtyUnit: record.qtyUnit,
          beforeQty: 0,
          afterQty: 0,
          sourceActionRecordNo: record.selfReturnRecordNo || record.warehouseRecordNo,
          remark: reason,
        },
      ],
    }
  })
  const nextRecord: PostFinishingSewingSelfReturnRecord = {
    ...current,
    status: '已驳回',
    items: current.items.map((item) => ({ ...item, confirmedQty: 0 })),
    rejectedAt: now,
    rejectedBy: input.rejectedBy,
    rejectedReason: reason,
  }
  store.sewingSelfReturnRecords[recordIndex] = nextRecord
  writePostFinishingWarehouseStore(store)
  return cloneSewingSelfReturnRecord(nextRecord)
}

export function listPostFinishingUpstreamHandovers(): PostFinishingUpstreamHandover[] {
  return cloneValue(UPSTREAM_HANDOVER_RECORDS)
}

export function lookupPostFinishingUpstreamHandover(input: string): PostFinishingUpstreamHandover | undefined {
  const keyword = input.trim()
  if (!keyword) return undefined
  const normalized = keyword.toLowerCase()
  const matched = UPSTREAM_HANDOVER_RECORDS.find((record) => (
    record.handoverRecordNo.toLowerCase() === normalized
    || record.qrCode.toLowerCase() === normalized
    || record.sourceTaskNo.toLowerCase() === normalized
  ))
  return matched ? cloneValue(matched) : undefined
}

export function confirmPostFinishingWarehouseReceipt(input: {
  handoverRecordNo: string
  receiverName?: string
  lines: PostFinishingWarehouseReceiptLineInput[]
}): PostFinishingWaitProcessWarehouseRecord[] {
  const handover = lookupPostFinishingUpstreamHandover(input.handoverRecordNo)
  if (!handover) throw new Error('未找到上游交出记录。')

  const now = nowText()
  const areas = listPostFinishingWarehouseAreas('wait-process')
  const locations = listPostFinishingWarehouseLocations('wait-process')
  const store = readPostFinishingWarehouseStore()
  const existingCount = store.waitProcessReceiptRecords.length
  const currentInventory = listPostFinishingWaitProcessWarehouseRecords().filter((record) => record.availableGarmentQty > 0)
  const createdRecords: PostFinishingWaitProcessWarehouseRecord[] = input.lines
    .map((lineInput, index) => {
      const line = handover.skuLines.find((item) => item.handoverLineId === lineInput.handoverLineId)
      const actualQty = Number(lineInput.actualQty) || 0
      const area = areas.find((item) => item.areaId === lineInput.areaId)
      const location = locations.find((item) => item.locationId === lineInput.locationId && item.areaId === lineInput.areaId)
      if (!line || actualQty <= 0 || !area) return null
      const conflict = currentInventory.find((record) => (
        record.skuId === line.skuId
        && record.sourceProductionOrderNo !== handover.productionOrderNo
        && record.areaId === area.areaId
        && (location ? record.locationId === location.locationId : !record.locationId)
      ))
      if (conflict) {
        const place = location ? `${area.areaName} / ${location.locationCode}` : area.areaName
        throw new Error(`SKU ${line.skuCode} 在${place}已有生产单 ${conflict.sourceProductionOrderNo} 的库存，请选择其他库区或库位。`)
      }
      const sequence = existingCount + index + 1
      const recordNo = `PF-WP-SCAN-${pad(sequence)}`
      const locationLabel = location ? `${area.areaName} / ${location.locationCode}` : area.areaName
      return {
        warehouseRecordId: recordNo,
        warehouseRecordNo: recordNo,
        upstreamHandoverRecordNo: handover.handoverRecordNo,
        postOrderId: `PF-SCAN-${handover.handoverRecordNo}`,
        postOrderNo: `扫码收货-${handover.handoverRecordNo}`,
        sourceProductionOrderNo: handover.productionOrderNo,
        sourceTaskNo: handover.sourceTaskNo,
        postSourceLabel: `${handover.sourceFactoryType}交出`,
        managedPostFactoryName: FULL_CAPABILITY_FACTORY_NAME,
        styleNo: handover.styleNo,
        spuId: handover.spuId,
        spuCode: handover.spuCode,
        spuName: handover.spuName,
        skuId: line.skuId,
        skuCode: line.skuCode,
        colorName: line.colorName,
        sizeName: line.sizeName,
        skuSummary: `${line.skuCode} / ${line.colorName} / ${line.sizeName}`,
        inboundGarmentQty: actualQty,
        availableGarmentQty: actualQty,
        plannedGarmentQty: line.plannedQty,
        qtyUnit: line.qtyUnit,
        inboundAt: now,
        updatedAt: now,
        areaId: area.areaId,
        areaName: area.areaName,
        locationId: location?.locationId,
        locationCode: location?.locationCode,
        flowRecords: [{
          flowRecordId: `${recordNo}-FLOW-1`,
          flowRecordNo: `${recordNo}-流水-1`,
          flowType: '扫码收货',
          operatedAt: now,
          operatorName: input.receiverName || '后道收货员',
          qty: actualQty,
          qtyUnit: line.qtyUnit,
          beforeQty: 0,
          afterQty: actualQty,
          sourceActionRecordNo: handover.handoverRecordNo,
          remark: `扫码收货：${handover.sourceFactoryName}交出，入库至${locationLabel}`,
        }],
      } satisfies PostFinishingWaitProcessWarehouseRecord
    })
    .filter((record): record is PostFinishingWaitProcessWarehouseRecord => Boolean(record))

  if (!createdRecords.length) throw new Error('请至少填写一条有效的实收明细和库区。')
  const createdIds = new Set(createdRecords.map((record) => record.warehouseRecordId))
  store.waitProcessReceiptRecords = [
    ...createdRecords,
    ...store.waitProcessReceiptRecords.filter((record) => !createdIds.has(record.warehouseRecordId)),
  ]
  writePostFinishingWarehouseStore(store)
  return cloneValue(createdRecords)
}

export function ensurePostFinishingHandoverWarehouseRecord(input: { postOrderId: string; createdAt?: string }): PostFinishingWaitHandoverWarehouseRecord {
  const order = getMutablePostFinishingWorkOrder(input.postOrderId)
  order.waitHandoverWarehouseRecordId = order.waitHandoverWarehouseRecordId || `PF-WH-${order.postOrderNo.replace(/\D/g, '').slice(-3)}`
  waitHandoverWarehouseRecords = buildWaitHandoverRecords()
  const record = waitHandoverWarehouseRecords.find((item) => item.postOrderId === input.postOrderId)
  if (!record) throw new Error('复检完成后才会进入后道待交出仓')
  return { ...record, flowRecords: record.flowRecords.map(cloneFlowRecord) }
}

export function listPostFinishingAvailableHandoverLines(): Array<PostFinishingWaitHandoverWarehouseRecord & { availableHandoverGarmentQty: number }> {
  waitHandoverWarehouseRecords = buildWaitHandoverRecords()
  return waitHandoverWarehouseRecords
    .map((record) => ({
      ...record,
      availableHandoverGarmentQty: Math.max(roundQty(record.waitHandoverGarmentQty - record.submittedHandoverGarmentQty), 0),
      flowRecords: record.flowRecords.map(cloneFlowRecord),
    }))
    .filter((record) => record.availableHandoverGarmentQty > 0)
}

export function recordPostFinishingHandoverSubmission(input: PostFinishingHandoverSubmissionInput): PostFinishingWaitHandoverWarehouseRecord | undefined {
  const submittedQty = roundQty(input.submittedQty)
  if (!Number.isFinite(submittedQty) || submittedQty <= 0) throw new Error('交出数量必须大于 0')
  const line = listPostFinishingAvailableHandoverLines().find((record) => (
    (record.recheckOrderId === input.recheckOrderId || record.recheckOrderNo === input.recheckOrderNo)
    && record.skuLineId === input.skuLineId
  ))
  if (!line) throw new Error('未找到可交出的后道复检库存明细')
  if (submittedQty > line.availableHandoverGarmentQty) {
    throw new Error(`本次交出数量不能超过可交出库存 ${line.availableHandoverGarmentQty}${line.qtyUnit}`)
  }
  const next: PostFinishingHandoverSubmission = {
    ...input,
    submittedQty,
    receiverWrittenQty: typeof input.receiverWrittenQty === 'number' ? roundQty(input.receiverWrittenQty) : undefined,
  }
  const submissions = getPostFinishingHandoverSubmissions()
  const index = submissions.findIndex((item) => item.handoverRecordId === input.handoverRecordId)
  if (index >= 0) postFinishingHandoverSubmissions[index] = { ...postFinishingHandoverSubmissions[index], ...next }
  else postFinishingHandoverSubmissions.push(next)
  persistPostFinishingHandoverSubmissions()
  waitHandoverWarehouseRecords = buildWaitHandoverRecords()
  return waitHandoverWarehouseRecords.find((record) => (
    (record.recheckOrderId === input.recheckOrderId || record.recheckOrderNo === input.recheckOrderNo)
    && record.skuLineId === input.skuLineId
  ))
}

export function writeBackPostFinishingHandoverSubmission(input: {
  handoverRecordId: string
  receiverWrittenQty: number
  receiverWrittenAt: string
  receiverWrittenBy: string
}): PostFinishingWaitHandoverWarehouseRecord | undefined {
  const submissions = getPostFinishingHandoverSubmissions()
  const index = submissions.findIndex((item) => item.handoverRecordId === input.handoverRecordId)
  if (index < 0) return undefined
  postFinishingHandoverSubmissions[index] = {
    ...postFinishingHandoverSubmissions[index],
    receiverWrittenQty: roundQty(input.receiverWrittenQty),
    receiverWrittenAt: input.receiverWrittenAt,
    receiverWrittenBy: input.receiverWrittenBy,
  }
  persistPostFinishingHandoverSubmissions()
  waitHandoverWarehouseRecords = buildWaitHandoverRecords()
  const updated = postFinishingHandoverSubmissions[index]
  return waitHandoverWarehouseRecords.find((record) => (
    (record.recheckOrderId === updated.recheckOrderId || record.recheckOrderNo === updated.recheckOrderNo)
    && record.skuLineId === updated.skuLineId
  ))
}

export function listPostFinishingWorkOrders(): PostFinishingWorkOrder[] {
  return postFinishingWorkOrders.map(cloneWorkOrder)
}

export function listPostFinishingActionRecords(actionType?: PostFinishingActionType): PostFinishingActionRecord[] {
  const receiveActions = receiptRecords.map((receipt, index) => {
    const context = getContext(receipt.sourceContextId)
    return makeActionRecord({
      id: `PF-RV-ACT-${pad(index + 1)}`,
      no: receipt.receiptNo,
      postOrderId: receipt.receiptId,
      postOrderNo: receipt.receiptNo,
      actionType: '扫码收货',
      status: receipt.receiptStatus,
      sourceFactoryName: receipt.sourceFactoryName,
      targetFactoryName: FULL_CAPABILITY_FACTORY_NAME,
      operatorName: receipt.receiverName,
      submittedQty: totalQty(receipt.skuLines),
      acceptedQty: totalQty(receipt.skuLines),
      startedAt: receipt.receivedAt,
      finishedAt: receipt.receivedAt,
      skuLines: context.skuLines,
    })
  })
  const qcActions = qcOrders.map((qc) => {
    const linkedPostOrder = postFinishingWorkOrders.find((order) => order.qcOrderId === qc.qcOrderId)
    const linkedRecheck = recheckOrders.find((order) => order.qcOrderId === qc.qcOrderId)
    return makeActionRecord({
      id: qc.qcOrderId,
      no: qc.qcOrderNo,
      postOrderId: linkedPostOrder?.postOrderId || qc.qcOrderId,
      postOrderNo: linkedPostOrder?.postOrderNo || qc.qcOrderNo,
      actionType: '质检',
      status: qc.qcStatus,
      sourceFactoryName: qc.sourceFactoryName,
      targetFactoryName: qc.managedPostFactoryName,
      operatorName: qc.inspectorName,
      submittedQty: qc.inspectedGarmentQty,
      acceptedQty: qc.passedGarmentQty,
      rejectedQty: qc.defectiveGarmentQty,
      startedAt: qc.createdAt,
      finishedAt: qc.inspectedAt,
      skuLines: qc.skuLines,
      qc,
      recheck: linkedRecheck,
    })
  })
  const postActions = postFinishingWorkOrders.map((order) => order.postAction)
  const recheckActions = recheckOrders.map((recheck) => {
    const qc = qcOrders.find((item) => item.qcOrderId === recheck.qcOrderId)
    return makeActionRecord({
      id: recheck.recheckOrderId,
      no: recheck.recheckOrderNo,
      postOrderId: recheck.postOrderId || recheck.qcOrderId,
      postOrderNo: recheck.postOrderNo || recheck.qcOrderNo,
      actionType: '复检',
      status: recheck.recheckStatus,
      sourceFactoryName: recheck.managedPostFactoryName,
      targetFactoryName: recheck.managedPostFactoryName,
      operatorName: recheck.recheckerName,
      submittedQty: recheck.recheckedGarmentQty,
      acceptedQty: recheck.passedGarmentQty,
      rejectedQty: recheck.defectiveGarmentQty,
      startedAt: recheck.createdAt,
      finishedAt: recheck.recheckedAt,
      skuLines: recheck.skuLines,
      qc,
      recheck,
    })
  })
  return [...receiveActions, ...qcActions, ...postActions, ...recheckActions]
    .filter((record) => !actionType || record.actionType === actionType)
    .map(cloneActionRecord)
}

export function listPostFinishingQcOrders(): PostFinishingActionRecord[] {
  return listPostFinishingActionRecords('质检')
}

export function listPostFinishingRecheckOrders(): PostFinishingActionRecord[] {
  return listPostFinishingActionRecords('复检')
}

export function listPostFinishingReceiveOrders(): PostFinishingActionRecord[] {
  return listPostFinishingActionRecords('扫码收货')
}

export function listSewingFactoryPostTasks(): SewingFactoryPostTask[] {
  return sewingFactoryPostTasks.map((task) => ({ ...task, skuLines: task.skuLines.map(cloneSkuLine) }))
}

export function listPostFinishingWaitProcessWarehouseRecords(): PostFinishingWaitProcessWarehouseRecord[] {
  const storedRecords = readPostFinishingWarehouseStore().waitProcessReceiptRecords
  const storedIds = new Set(storedRecords.map((record) => record.warehouseRecordId))
  return applyQcAllocationsToWaitProcessRecords([...storedRecords, ...waitProcessWarehouseRecords.filter((record) => !storedIds.has(record.warehouseRecordId))])
    .map((record) => ({ ...record, flowRecords: record.flowRecords.map(cloneFlowRecord) }))
}

export function listPostFinishingWaitHandoverWarehouseRecords(): PostFinishingWaitHandoverWarehouseRecord[] {
  waitHandoverWarehouseRecords = buildWaitHandoverRecords()
  return waitHandoverWarehouseRecords.map((record) => ({ ...record, flowRecords: record.flowRecords.map(cloneFlowRecord) }))
}

export function getPostFinishingSummary() {
  const orders = listPostFinishingWorkOrders()
  const waitProcess = listPostFinishingWaitProcessWarehouseRecords()
  const waitHandover = listPostFinishingWaitHandoverWarehouseRecords()
  return {
    orderCount: orders.length,
    waitProcessCount: waitProcess.length,
    waitHandoverCount: waitHandover.length,
    waitPostQty: 0,
    waitQcQty: waitProcess.reduce((sum, record) => sum + record.availableGarmentQty, 0),
    waitRecheckQty: 0,
    waitHandoverQty: waitHandover.reduce((sum, record) => sum + Math.max(record.waitHandoverGarmentQty - record.submittedHandoverGarmentQty, 0), 0),
    dedicatedCount: orders.length,
    sewingDoneCount: 0,
  }
}
