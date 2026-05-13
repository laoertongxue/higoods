import { productionOrders, type ProductionOrder } from './production-orders.ts'

export type PostFinishingRouteMode = '需要后道加工' | '无需后道加工'
export type PostFinishingActionType = '扫码收货' | '质检' | '后道' | '复检'
export type PostFinishingSourceFactoryType = '车缝厂' | '针织厂' | '未关联任务'
export type PostFinishingQcResult = '全数合规' | '部分不合格' | '全数不合格'
export type PostFinishingNeedFlag = '开扣眼' | '装扣子' | '熨烫' | '包装'
export type PostFinishingTaskStatus = '待上游交出' | '待收货' | '待质检' | '质检中' | '待后道' | '后道中' | '待复检' | '待交出' | '已完成'

export const FULL_CAPABILITY_FACTORY_ID = 'F090'
export const FULL_CAPABILITY_FACTORY_NAME = '全能力测试工厂'
export const FULL_CAPABILITY_FACTORY_LABEL = `${FULL_CAPABILITY_FACTORY_NAME}（${FULL_CAPABILITY_FACTORY_ID}）`

export interface PostFinishingSkuLine {
  skuLineId: string
  spuId: string
  spuCode: string
  spuName: string
  skuId: string
  skuCode: string
  colorName: string
  sizeName: string
  plannedQty: number
  receivedQty: number
  availableQty: number
  handedOverQty: number
  qtyUnit: string
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
  createdAt: string
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
  completedPostGarmentQty?: number
  recheckedGarmentQty?: number
  confirmedGarmentQty?: number
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
  qcResult: PostFinishingQcResult
  unqualifiedDisposition: '' | '返修' | '让步接收' | '报废' | '退回上游'
  unqualifiedReasonSummary: string
  rootCauseType: '' | '工厂加工问题' | '来料问题' | '技术资料问题' | '平台判定'
  responsiblePartyType: '' | '工厂' | '平台' | '供应商' | '无责任'
  responsiblePartyId: string
  responsiblePartyName: string
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
  flowType: '扫码收货' | '质检占用' | '质检入仓' | '后道入仓' | '复检入仓' | '交出出仓' | '接收回写'
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
  flowRecords: PostFinishingWarehouseFlowRecord[]
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
  sourceFactoryType: '车缝任务' | '针织任务'
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

function cloneFlowRecord(record: PostFinishingWarehouseFlowRecord): PostFinishingWarehouseFlowRecord {
  return { ...record }
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
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

function postFlags(qc: Pick<PostFinishingQcOrder, 'needButtonhole' | 'needButton' | 'needIroning' | 'needPackaging'>): PostFinishingNeedFlag[] {
  return [
    qc.needButtonhole ? '开扣眼' : '',
    qc.needButton ? '装扣子' : '',
    qc.needIroning ? '熨烫' : '',
    qc.needPackaging ? '包装' : '',
  ].filter(Boolean) as PostFinishingNeedFlag[]
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
  qcInProgressQty: number
  qcDoneQty: number
  waitPostQty: number
  postDoingQty: number
  waitRecheckQty: number
  recheckDoneQty: number
  waitHandoverQty: number
  plannedQty: number
}): PostFinishingTaskStatus {
  if (input.waitHandoverQty > 0) return '待交出'
  if (input.waitRecheckQty > 0) return '待复检'
  if (input.postDoingQty > 0) return '后道中'
  if (input.waitPostQty > 0) return '待后道'
  if (input.qcInProgressQty > 0) return '质检中'
  if (input.recheckDoneQty >= input.plannedQty && input.plannedQty > 0) return '已完成'
  if (input.waitQcQty > 0 || input.qcDoneQty > 0 || input.receivedQty > 0) return '待质检'
  return input.hasSourceContext ? '待收货' : '待上游交出'
}

function postTaskCurrentNode(status: PostFinishingTaskStatus): string {
  const nodeMap: Record<PostFinishingTaskStatus, string> = {
    待上游交出: '等待车缝/针织交出',
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
  const qcInProgressQty = sumQcOrderQty(qcRecords, '待质检') + sumQcOrderQty(qcRecords, '质检中')
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
    qcInProgressQty,
    qcDoneQty,
    waitPostQty,
    postDoingQty,
    waitRecheckQty,
    recheckDoneQty,
    waitHandoverQty,
    plannedQty,
  })
  return {
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
    sourceTaskId: 'TASK-KNIT-202603-011-A',
    sourceTaskNo: '针织任务-202603-011-A',
    sourceFactoryId: 'F-KNIT-011',
    sourceFactoryName: 'PT Knit Central Bogor',
    sourceFactoryType: '针织厂',
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
    sourceTaskId: 'TASK-KNIT-202603-012-A',
    sourceTaskNo: '针织任务-202603-012-A',
    sourceFactoryId: 'F-KNIT-012',
    sourceFactoryName: 'PT Nusa Knit Factory',
    sourceFactoryType: '针织厂',
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
  const sourceFactoryType: PostFinishingUpstreamHandover['sourceFactoryType'] = context.sourceFactoryType === '针织厂' ? '针织任务' : '车缝任务'
  const recordNo = `${sourceFactoryType === '针织任务' ? 'KNIT' : 'SEW'}-HO-202605-${pad(index + 1)}`
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

function buildQcWarehouseAllocations(receipt: PostFinishingReceiptRecord, qcOrderId: string): PostFinishingQcWarehouseAllocation[] {
  const context = getSourceContextsForProductionOrder(receipt.productionOrderNo)[0]
  return receipt.skuLines.map((line, lineIndex) => {
    const recordId = receiptWarehouseRecordId(receipt, lineIndex)
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
  station: string
}): PostFinishingQcOrder {
  const qcOrderId = `PF-QC-${pad(index)}`
  const inspectedQty = totalQty(receipt.skuLines)
  const defectiveQty = options.status === '质检完成' ? options.defectiveQty : 0
  const passedQty = options.status === '质检完成' ? options.passedQty : 0
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
    skuSummary: summarizeSku(receipt.skuLines),
    skuLines: receipt.skuLines.map(cloneSkuLine),
    warehouseAllocations: buildQcWarehouseAllocations(receipt, qcOrderId),
    qcStationId: `QC-STATION-${options.station}`,
    qcStationName: `后道质检台 ${options.station}`,
    qcStatus: options.status,
    inspectedGarmentQty: inspectedQty,
    passedGarmentQty: passedQty,
    defectiveGarmentQty: defectiveQty,
    qcResult,
    unqualifiedDisposition: hasDefect ? '返修' : '',
    unqualifiedReasonSummary: hasDefect ? '成衣存在后道处理瑕疵，需记录责任并进入后续处理。' : '',
    rootCauseType: hasDefect ? '工厂加工问题' : '',
    responsiblePartyType: hasDefect ? '工厂' : '',
    responsiblePartyId: hasDefect ? context.sourceFactoryId || '' : '',
    responsiblePartyName: hasDefect ? context.sourceFactoryName || '' : '',
    deductionDecision: hasDefect ? '建议扣款' : '',
    deductionDecisionRemark: hasDefect ? '按质量扣款模块质检记录继续判定。' : '',
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

let qcOrders: PostFinishingQcOrder[] = [
  buildQcOrder(1, SOURCE_CONTEXTS[0], receiptRecords[0], { status: '质检完成', passedQty: 388, defectiveQty: 12, needIroning: true, needPackaging: true, station: 'A' }),
  buildQcOrder(2, SOURCE_CONTEXTS[1], receiptRecords[1], { status: '质检完成', passedQty: 340, defectiveQty: 0, station: 'B' }),
  buildQcOrder(3, SOURCE_CONTEXTS[2], receiptRecords[2], { status: '待质检', passedQty: 0, defectiveQty: 0, station: 'C' }),
  buildQcOrder(4, SOURCE_CONTEXTS[3], receiptRecords[3], { status: '质检完成', passedQty: 188, defectiveQty: 12, needButtonhole: true, needButton: true, needIroning: true, station: 'A' }),
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
    qcResult: qc.qcResult === '全数合规' ? '全数合格' : qc.qcResult,
    unqualifiedDisposition: hasDefect ? qc.unqualifiedDisposition : '',
    unqualifiedReasonSummary: hasDefect ? qc.unqualifiedReasonSummary : '',
    rootCauseType: hasDefect ? qc.rootCauseType : '',
    liabilityStatus: hasDefect ? '待判定' : '已判定',
    factoryLiabilityQty: hasDefect ? qc.defectiveGarmentQty : 0,
    nonFactoryLiabilityQty: 0,
    responsiblePartyType: hasDefect ? qc.responsiblePartyType : '无责任',
    responsiblePartyId: hasDefect ? qc.responsiblePartyId : '',
    responsiblePartyName: hasDefect ? qc.responsiblePartyName : '无责任方',
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
    action.deductionDecision = input.qc.deductionDecision
    action.deductionDecisionRemark = input.qc.deductionDecisionRemark
    action.dispositionRemark = snapshot.dispositionRemark
    action.needButtonhole = input.qc.needButtonhole
    action.needButton = input.qc.needButton
    action.needIroning = input.qc.needIroning
    action.needPackaging = input.qc.needPackaging
    action.evidenceAssets = input.qc.evidenceAssets.map((item) => ({ ...item }))
    action.evidenceUrls = input.qc.evidenceAssets.map((item) => item.url)
    action.qualityDeductionSnapshot = snapshot
    action.warehouseAllocations = input.qc.warehouseAllocations.map((allocation) => ({ ...allocation }))
  }
  if (input.actionType === '后道') action.completedPostGarmentQty = input.acceptedQty
  if (input.actionType === '复检') {
    action.recheckedGarmentQty = input.recheck?.recheckedGarmentQty || input.acceptedQty
    action.confirmedGarmentQty = input.acceptedQty
  }
  return action
}

function buildPostOrderFromQc(qc: PostFinishingQcOrder, index: number): PostFinishingWorkOrder {
  const context = getContext(qc.sourceContextId)
  const needs = postFlags(qc)
  const postOrderId = `POST-WO-${pad(index)}`
  const postOrderNo = `HD-2026-${pad(index)}`
  const recheck = recheckOrders.find((item) => item.postOrderId === postOrderId || item.qcOrderId === qc.qcOrderId)
  const postStatus = recheck ? '后道完成' : index === 1 ? '后道中' : '待后道'
  const currentStatus = recheck?.recheckStatus === '复检完成' ? '复检完成' : postStatus
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
    acceptedQty: postStatus === '待后道' ? 0 : qc.passedGarmentQty,
    startedAt: postStatus === '待后道' ? undefined : `2026-05-${String(index + 5).padStart(2, '0')} 09:00`,
    finishedAt: postStatus === '后道完成' ? `2026-05-${String(index + 5).padStart(2, '0')} 16:00` : undefined,
    skuLines: qc.skuLines,
    remark: needs.join('、'),
  })
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
  return {
    recheckOrderId: `PF-RC-${pad(index)}`,
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
    recheckStatus: index % 2 === 0 ? '复检完成' : '待复检',
    recheckedGarmentQty: qc.passedGarmentQty,
    passedGarmentQty: qc.passedGarmentQty,
    defectiveGarmentQty: 0,
    recheckerName: index % 2 === 0 ? '复检员' : '—',
    recheckedAt: index % 2 === 0 ? `2026-05-${String(index + 5).padStart(2, '0')} 16:40` : undefined,
    createdAt: qc.updatedAt,
    updatedAt: `2026-05-${String(index + 5).padStart(2, '0')} 17:00`,
  }
}

function buildPostRecheck(qc: PostFinishingQcOrder, postOrderId: string, postOrderNo: string, index: number): PostFinishingRecheckOrder {
  return {
    recheckOrderId: `PF-RC-${pad(index)}`,
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
    recheckerName: '复检员',
    recheckedAt: `2026-05-${String(index + 6).padStart(2, '0')} 16:30`,
    createdAt: `2026-05-${String(index + 6).padStart(2, '0')} 09:00`,
    updatedAt: `2026-05-${String(index + 6).padStart(2, '0')} 17:00`,
  }
}

function buildPendingRecheckFromQc(qc: PostFinishingQcOrder, index: number, postOrder?: Pick<PostFinishingWorkOrder, 'postOrderId' | 'postOrderNo'>): PostFinishingRecheckOrder {
  return {
    recheckOrderId: `PF-RC-${pad(index)}`,
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
    recheckerName: '—',
    createdAt: nowText(),
    updatedAt: nowText(),
  }
}

let recheckOrders: PostFinishingRecheckOrder[] = [
  buildDirectRecheckFromQc(qcOrders[1], 2),
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
  order.postAction.status = '待后道'
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
    receiveAction: cloneActionRecord(order.receiveAction),
    qcAction: cloneActionRecord(order.qcAction),
    postAction: cloneActionRecord(order.postAction),
    recheckAction: cloneActionRecord(order.recheckAction),
  }
}

function cloneRecheck(order: PostFinishingRecheckOrder): PostFinishingRecheckOrder {
  return { ...order, skuLines: order.skuLines.map(cloneSkuLine) }
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
}): PostFinishingQcOrder {
  const qc = qcOrders.find((item) => item.qcOrderId === input.qcOrderId)
  if (!qc) throw new Error(`未找到质检单：${input.qcOrderId}`)
  const inspectedQty = input.inspectedGarmentQty ?? totalQty(qc.skuLines)
  const defectiveQty = input.defectiveGarmentQty ?? qc.defectiveGarmentQty
  const passedQty = input.passedGarmentQty ?? Math.max(inspectedQty - defectiveQty, 0)
  const result = input.qcResult || (defectiveQty <= 0 ? '全数合规' : passedQty <= 0 ? '全数不合格' : '部分不合格')
  const hasDefect = result !== '全数合规'
  qc.qcStatus = '质检完成'
  qc.qcStationName = input.qcStationName || qc.qcStationName
  qc.qcStationId = qc.qcStationName.replace('后道质检台 ', 'QC-STATION-')
  qc.inspectorName = input.inspectorName || qc.inspectorName || '后道质检员'
  qc.inspectedGarmentQty = inspectedQty
  qc.passedGarmentQty = passedQty
  qc.defectiveGarmentQty = hasDefect ? defectiveQty : 0
  qc.qcResult = result
  qc.unqualifiedDisposition = hasDefect ? input.unqualifiedDisposition || qc.unqualifiedDisposition || '返修' : ''
  qc.unqualifiedReasonSummary = hasDefect ? input.unqualifiedReasonSummary || qc.unqualifiedReasonSummary || '质检发现不合格成衣，需记录责任。' : ''
  qc.rootCauseType = hasDefect ? input.rootCauseType || qc.rootCauseType || '工厂加工问题' : ''
  qc.responsiblePartyType = hasDefect ? input.responsiblePartyType || qc.responsiblePartyType || '工厂' : ''
  qc.responsiblePartyName = hasDefect ? input.responsiblePartyName || qc.responsiblePartyName || qc.sourceFactoryName : ''
  qc.responsiblePartyId = hasDefect ? qc.responsiblePartyId || qc.sourceFactoryId : ''
  qc.deductionDecision = hasDefect ? input.deductionDecision || qc.deductionDecision || '建议扣款' : ''
  qc.deductionDecisionRemark = hasDefect ? input.deductionDecisionRemark || qc.deductionDecisionRemark || '按质量扣款模块质检记录继续判定。' : ''
  qc.needButtonhole = Boolean(input.needButtonhole)
  qc.needButton = Boolean(input.needButton)
  qc.needIroning = Boolean(input.needIroning)
  qc.needPackaging = Boolean(input.needPackaging)
  qc.defectItems = hasDefect ? [defect(`PF-DEF-${pad(nextQcIndex())}`, qc.defectiveGarmentQty)] : []
  qc.evidenceAssets = hasDefect ? qc.evidenceAssets : []
  qc.inspectedAt = nowText()
  qc.updatedAt = nowText()
  if (postFlags(qc).length > 0) ensurePostOrderFromQc(qc)
  else ensureDirectRecheckFromQc(qc)
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
    action.qcResult = rejectedQty > 0 ? '部分不合格' : '全数合规'
    const qc = qcOrders.find((item) => item.qcOrderId === order.qcOrderId)
    if (qc) {
      qc.qcStatus = '质检完成'
      qc.inspectedGarmentQty = submittedQty
      qc.passedGarmentQty = acceptedQty
      qc.defectiveGarmentQty = rejectedQty
      qc.qcResult = rejectedQty > 0 ? '部分不合格' : '全数合规'
      qc.inspectedAt = action.finishedAt
      action.qualityDeductionSnapshot = { ...makeQualitySnapshot(qc), ...input.qualityFields }
    }
  }
  if (normalizeActionType(input.actionType) === '后道') {
    action.completedPostGarmentQty = acceptedQty
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
      recheck.recheckStatus = '复检完成'
      recheck.recheckedGarmentQty = submittedQty
      recheck.passedGarmentQty = acceptedQty
      recheck.defectiveGarmentQty = rejectedQty
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
  const qty = input.completedGarmentQty ?? order.plannedGarmentQty
  return applyPostFinishingActionFinish({
    postOrderId: input.postOrderId,
    actionType: '后道',
    operatorName: input.operatorName || '后道操作员',
    submittedGarmentQty: qty,
    acceptedGarmentQty: qty,
    rejectedGarmentQty: 0,
    diffGarmentQty: 0,
    remark: '后道完成后自动生成复检单',
  })
}

export function completePostFinishingRecheckOrder(input: { recheckOrderId: string; operatorName?: string; passedGarmentQty?: number; defectiveGarmentQty?: number }): PostFinishingRecheckOrder {
  const recheck = recheckOrders.find((item) => item.recheckOrderId === input.recheckOrderId)
  if (!recheck) throw new Error(`未找到复检单：${input.recheckOrderId}`)
  const submittedQty = recheck.recheckedGarmentQty
  const defectiveQty = input.defectiveGarmentQty ?? 0
  const passedQty = input.passedGarmentQty ?? Math.max(submittedQty - defectiveQty, 0)
  recheck.recheckStatus = '复检完成'
  recheck.passedGarmentQty = passedQty
  recheck.defectiveGarmentQty = defectiveQty
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
      submittedQty,
      acceptedQty: passedQty,
      rejectedQty: defectiveQty,
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

interface PostFinishingWarehouseStore {
  areas: PostFinishingWarehouseArea[]
  locations: PostFinishingWarehouseLocation[]
  waitProcessReceiptRecords: PostFinishingWaitProcessWarehouseRecord[]
  handoverSubmissions: PostFinishingHandoverSubmission[]
}

const POST_FINISHING_WAREHOUSE_STORE_KEY = 'higoods-post-finishing-warehouse-config'

function readPostFinishingWarehouseStore(): PostFinishingWarehouseStore {
  if (typeof window === 'undefined') return { areas: [], locations: [], waitProcessReceiptRecords: [], handoverSubmissions: [] }
  try {
    const raw = window.localStorage.getItem(POST_FINISHING_WAREHOUSE_STORE_KEY)
    if (!raw) return { areas: [], locations: [], waitProcessReceiptRecords: [], handoverSubmissions: [] }
    const parsed = JSON.parse(raw) as Partial<PostFinishingWarehouseStore>
    return {
      areas: Array.isArray(parsed.areas) ? parsed.areas : [],
      locations: Array.isArray(parsed.locations) ? parsed.locations : [],
      waitProcessReceiptRecords: Array.isArray(parsed.waitProcessReceiptRecords) ? parsed.waitProcessReceiptRecords : [],
      handoverSubmissions: Array.isArray(parsed.handoverSubmissions) ? parsed.handoverSubmissions : [],
    }
  } catch {
    return { areas: [], locations: [], waitProcessReceiptRecords: [], handoverSubmissions: [] }
  }
}

function writePostFinishingWarehouseStore(store: PostFinishingWarehouseStore): void {
  if (typeof window === 'undefined') return
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
  return [
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
  return [
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
