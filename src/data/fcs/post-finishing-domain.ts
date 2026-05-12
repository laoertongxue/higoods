export type PostFinishingRouteMode = '需要后道加工' | '无需后道加工'
export type PostFinishingActionType = '扫码收货' | '质检' | '后道' | '复检'
export type PostFinishingSourceFactoryType = '车缝厂' | '针织厂' | '未关联任务'
export type PostFinishingQcResult = '全数合规' | '部分不合格' | '全数不合格'
export type PostFinishingNeedFlag = '开扣眼' | '装扣子' | '熨烫' | '包装'

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
  inspectionScene?: string
  inspectionMethod?: string
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

export interface PostFinishingWaitQcItem {
  waitQcId: string
  receiptId: string
  productionOrderNo: string
  sourceTaskNo: string
  sourceFactoryName: string
  spuId: string
  spuCode: string
  spuName: string
  skuSummary: string
  waitQcQty: number
  qtyUnit: string
  status: '待创建质检单' | '已创建质检单' | '质检完成'
  createdQcOrderId?: string
}

export interface PostFinishingQcOrder {
  qcOrderId: string
  qcOrderNo: string
  sourceContextId: string
  receiptId: string
  waitQcId: string
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
  flowType: '扫码收货' | '质检占用' | '后道完成' | '复检入仓' | '同步WMS'
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
  waitAction: '待质检' | '待后道' | '待复检'
  status: string
  inboundAt: string
  updatedAt: string
  flowRecords: PostFinishingWarehouseFlowRecord[]
}

export interface PostFinishingWaitHandoverWarehouseRecord {
  warehouseRecordId: string
  warehouseRecordNo: string
  handoverRecordId?: string
  handoverRecordNo?: string
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
  status: string
  inboundAt: string
  updatedAt: string
  flowRecords: PostFinishingWarehouseFlowRecord[]
}

export interface PostFinishingHandoverActionSnapshot {
  handoverRecordId: string
  handoverRecordNo: string
  postOrderId: string
  submittedGarmentQty: number
  receivedGarmentQty: number
  diffGarmentQty: number
  qtyUnit: string
  handoverAt: string
  status: '待回写' | '已回写' | '有差异'
}

export interface PostFinishingWorkOrder {
  postOrderId: string
  postOrderNo: string
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
  handoverAction?: PostFinishingHandoverActionSnapshot
  waitProcessWarehouseRecordId: string
  waitHandoverWarehouseRecordId?: string
  handoverRecordId?: string
  wmsSyncStatus?: string
}

export interface PostFinishingRecheckOrder {
  recheckOrderId: string
  recheckOrderNo: string
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
  wmsSyncStatus: '待同步WMS' | '已同步WMS'
  recheckerName: string
  recheckedAt?: string
  createdAt: string
  updatedAt: string
}

export interface PostFinishingWmsSyncRecord {
  syncRecordId: string
  syncRecordNo: string
  recheckOrderId: string
  productionOrderNo: string
  spuCode: string
  skuSummary: string
  syncQty: number
  qtyUnit: string
  syncStatus: '待同步WMS' | '已同步WMS'
  syncedAt?: string
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

function totalQty(lines: PostFinishingSkuLine[]): number {
  return lines.reduce((sum, line) => sum + line.plannedQty, 0)
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

let waitQcItems: PostFinishingWaitQcItem[] = receiptRecords.map((receipt, index) => {
  const context = SOURCE_CONTEXTS.find((item) => item.contextId === receipt.sourceContextId)!
  return {
    waitQcId: `PF-WQ-${pad(index + 1)}`,
    receiptId: receipt.receiptId,
    productionOrderNo: receipt.productionOrderNo,
    sourceTaskNo: receipt.sourceTaskNo,
    sourceFactoryName: receipt.sourceFactoryName,
    spuId: context.spuId,
    spuCode: context.spuCode,
    spuName: context.spuName,
    skuSummary: summarizeSku(receipt.skuLines),
    waitQcQty: totalQty(receipt.skuLines),
    qtyUnit: '件',
    status: index < 4 ? '已创建质检单' : '待创建质检单',
    createdQcOrderId: index < 4 ? `PF-QC-${pad(index + 1)}` : undefined,
  }
})

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
    qcOrderId: `PF-QC-${pad(index)}`,
    qcOrderNo: `QC-POST-2026-${pad(index)}`,
    sourceContextId: context.contextId,
    receiptId: receipt.receiptId,
    waitQcId: `PF-WQ-${pad(index)}`,
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

function cloneSourceContext(context: PostFinishingSourceContext): PostFinishingSourceContext {
  return { ...context, skuLines: context.skuLines.map(cloneSkuLine) }
}

function cloneReceipt(record: PostFinishingReceiptRecord): PostFinishingReceiptRecord {
  return { ...record, skuLines: record.skuLines.map(cloneSkuLine) }
}

function cloneWaitQc(record: PostFinishingWaitQcItem): PostFinishingWaitQcItem {
  return { ...record }
}

function cloneQcOrder(order: PostFinishingQcOrder): PostFinishingQcOrder {
  return {
    ...order,
    skuLines: order.skuLines.map(cloneSkuLine),
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
    handoverStatus: recheck?.wmsSyncStatus === '已同步WMS' ? '已同步WMS' : recheck ? '待同步WMS' : '未生成',
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
    handoverRecordId: recheck?.wmsSyncStatus === '已同步WMS' ? `PF-WMS-${pad(index)}` : undefined,
    handoverAction: recheck?.wmsSyncStatus === '已同步WMS'
      ? {
          handoverRecordId: `PF-WMS-${pad(index)}`,
          handoverRecordNo: `WMS-SYNC-${pad(index)}`,
          postOrderId,
          submittedGarmentQty: recheck.passedGarmentQty,
          receivedGarmentQty: recheck.passedGarmentQty,
          diffGarmentQty: 0,
          qtyUnit: '件',
          handoverAt: recheck.updatedAt,
          status: '已回写',
        }
      : undefined,
    wmsSyncStatus: recheck?.wmsSyncStatus,
  }
}

function buildDirectRecheckFromQc(qc: PostFinishingQcOrder, index: number): PostFinishingRecheckOrder {
  return {
    recheckOrderId: `PF-RC-${pad(index)}`,
    recheckOrderNo: `RC-POST-2026-${pad(index)}`,
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
    wmsSyncStatus: index % 2 === 0 ? '已同步WMS' : '待同步WMS',
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
    wmsSyncStatus: '已同步WMS',
    recheckerName: '复检员',
    recheckedAt: `2026-05-${String(index + 6).padStart(2, '0')} 16:30`,
    createdAt: `2026-05-${String(index + 6).padStart(2, '0')} 09:00`,
    updatedAt: `2026-05-${String(index + 6).padStart(2, '0')} 17:00`,
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

function cloneActionRecord(record: PostFinishingActionRecord): PostFinishingActionRecord {
  return {
    ...record,
    skuLines: record.skuLines.map(cloneSkuLine),
    defectItems: record.defectItems?.map((item) => ({ ...item })),
    evidenceAssets: record.evidenceAssets?.map((item) => ({ ...item })),
    evidenceUrls: record.evidenceUrls ? [...record.evidenceUrls] : undefined,
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
    handoverAction: order.handoverAction ? { ...order.handoverAction } : undefined,
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
  return order.requiresPostFinishing ? '扫码收货 -> 质检 -> 后道 -> 复检 -> 同步WMS' : '扫码收货 -> 质检 -> 复检 -> 同步WMS'
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

export function listPostFinishingWaitQcItems(): PostFinishingWaitQcItem[] {
  return waitQcItems.map(cloneWaitQc)
}

export function listPostFinishingQcOrderEntities(): PostFinishingQcOrder[] {
  return qcOrders.map(cloneQcOrder)
}

export function listPostFinishingRecheckOrderEntities(): PostFinishingRecheckOrder[] {
  return recheckOrders.map(cloneRecheck)
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
  if (normalizeActionType(input.actionType) === '后道') action.completedPostGarmentQty = acceptedQty
  if (normalizeActionType(input.actionType) === '复检') action.recheckedGarmentQty = acceptedQty
  applyNextStatusAfterFinish(order, input.actionType)
  syncOrderStatusFields(order)
  return cloneWorkOrder(order)
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
  beforeQty: number
  afterQty: number
  sourceActionRecordNo: string
  operatorName?: string
}): PostFinishingWarehouseFlowRecord {
  return {
    flowRecordId: `${input.recordNo}-FLOW-${input.index}`,
    flowRecordNo: `${input.recordNo}-流水-${input.index}`,
    flowType: input.flowType,
    operatedAt: `2026-05-${String(input.index + 5).padStart(2, '0')} 10:00`,
    operatorName: input.operatorName || '后道仓管员',
    qty: input.qty,
    qtyUnit: '件',
    beforeQty: input.beforeQty,
    afterQty: input.afterQty,
    sourceActionRecordNo: input.sourceActionRecordNo,
    remark: `${input.flowType} ${input.qty} 件`,
  }
}

function buildWaitProcessRecords(): PostFinishingWaitProcessWarehouseRecord[] {
  const qcRecords = qcOrders.flatMap((qc, qcIndex) => {
    const waitAction: PostFinishingWaitProcessWarehouseRecord['waitAction'] = qc.qcStatus !== '质检完成'
      ? '待质检'
      : postFlags(qc).length > 0
        ? '待后道'
        : '待复检'
    return qc.skuLines.map((line, lineIndex) => {
      const recordNo = `PF-WP-QC-${pad(qcIndex + 1)}-${lineIndex + 1}`
      return {
        warehouseRecordId: recordNo,
        warehouseRecordNo: recordNo,
        postOrderId: qc.generatedPostOrderId || qc.qcOrderId,
        postOrderNo: qc.generatedPostOrderId ? `HD-2026-${qc.generatedPostOrderId.replace(/\D/g, '').slice(-3)}` : qc.qcOrderNo,
        sourceProductionOrderNo: qc.productionOrderNo,
        sourceTaskNo: qc.sourceTaskNo,
        postSourceLabel: postFlags(qc).length > 0 ? '质检后生成后道' : '质检后直接复检',
        managedPostFactoryName: qc.managedPostFactoryName,
        styleNo: qc.spuCode,
        spuId: qc.spuId,
        spuCode: qc.spuCode,
        spuName: qc.spuName,
        skuId: line.skuId,
        skuCode: line.skuCode,
        colorName: line.colorName,
        sizeName: line.sizeName,
        skuSummary: `${line.skuCode} / ${line.colorName} / ${line.sizeName}`,
        inboundGarmentQty: line.receivedQty,
        availableGarmentQty: waitAction === '待后道' ? qc.passedGarmentQty : line.availableQty,
        plannedGarmentQty: line.plannedQty,
        qtyUnit: line.qtyUnit,
        waitAction,
        status: waitAction,
        inboundAt: qc.createdAt,
        updatedAt: qc.updatedAt,
        flowRecords: [
          buildFlowRecord({ recordNo, index: qcIndex + lineIndex + 1, flowType: '扫码收货', qty: line.receivedQty, beforeQty: 0, afterQty: line.receivedQty, sourceActionRecordNo: qc.receiptId }),
          ...(qc.qcStatus === '质检完成' ? [buildFlowRecord({ recordNo, index: qcIndex + lineIndex + 2, flowType: '质检占用', qty: line.plannedQty, beforeQty: line.receivedQty, afterQty: Math.max(line.receivedQty - line.plannedQty, 0), sourceActionRecordNo: qc.qcOrderNo, operatorName: qc.inspectorName })] : []),
        ],
      }
    })
  })
  return qcRecords
}

function buildWaitHandoverRecords(): PostFinishingWaitHandoverWarehouseRecord[] {
  return recheckOrders
    .filter((recheck) => recheck.recheckStatus === '复检完成')
    .flatMap((recheck, orderIndex) => recheck.skuLines.map((line, lineIndex) => {
      const recordNo = `PF-WH-${pad(orderIndex + 1)}-${lineIndex + 1}`
      return {
        warehouseRecordId: recordNo,
        warehouseRecordNo: recordNo,
        handoverRecordId: recheck.wmsSyncStatus === '已同步WMS' ? `PF-WMS-${pad(orderIndex + 1)}` : undefined,
        handoverRecordNo: recheck.wmsSyncStatus === '已同步WMS' ? `WMS-SYNC-${pad(orderIndex + 1)}` : undefined,
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
        waitHandoverGarmentQty: line.plannedQty,
        submittedHandoverGarmentQty: recheck.wmsSyncStatus === '已同步WMS' ? line.plannedQty : 0,
        receivedHandoverGarmentQty: recheck.wmsSyncStatus === '已同步WMS' ? line.plannedQty : 0,
        diffGarmentQty: 0,
        qtyUnit: line.qtyUnit,
        status: recheck.wmsSyncStatus,
        inboundAt: recheck.updatedAt,
        updatedAt: recheck.updatedAt,
        flowRecords: [
          buildFlowRecord({ recordNo, index: orderIndex + lineIndex + 1, flowType: '复检入仓', qty: line.plannedQty, beforeQty: 0, afterQty: line.plannedQty, sourceActionRecordNo: recheck.recheckOrderNo, operatorName: recheck.recheckerName }),
          ...(recheck.wmsSyncStatus === '已同步WMS' ? [buildFlowRecord({ recordNo, index: orderIndex + lineIndex + 2, flowType: '同步WMS', qty: line.plannedQty, beforeQty: line.plannedQty, afterQty: 0, sourceActionRecordNo: `WMS-SYNC-${pad(orderIndex + 1)}` })] : []),
        ],
      }
    }))
}

let waitProcessWarehouseRecords = buildWaitProcessRecords()
let waitHandoverWarehouseRecords = buildWaitHandoverRecords()

export function ensurePostFinishingHandoverWarehouseRecord(input: { postOrderId: string; createdAt?: string }): PostFinishingWaitHandoverWarehouseRecord {
  const order = getMutablePostFinishingWorkOrder(input.postOrderId)
  order.waitHandoverWarehouseRecordId = order.waitHandoverWarehouseRecordId || `PF-WH-${order.postOrderNo.replace(/\D/g, '').slice(-3)}`
  waitHandoverWarehouseRecords = buildWaitHandoverRecords()
  const record = waitHandoverWarehouseRecords.find((item) => item.postOrderId === input.postOrderId)
  if (!record) throw new Error('复检完成后才会进入后道待交出仓')
  return { ...record, flowRecords: record.flowRecords.map(cloneFlowRecord) }
}

export function submitPostFinishingHandoverRecord(input: { postOrderId: string; operatorName?: string; operatedAt?: string; submittedGarmentQty?: number; receivedGarmentQty?: number; diffGarmentQty?: number }): PostFinishingWorkOrder {
  const order = getMutablePostFinishingWorkOrder(input.postOrderId)
  const submittedQty = input.submittedGarmentQty ?? order.plannedGarmentQty
  const receivedQty = input.receivedGarmentQty ?? submittedQty
  const diffQty = input.diffGarmentQty ?? Math.max(submittedQty - receivedQty, 0)
  order.handoverRecordId = `PF-WMS-${order.postOrderNo.replace(/\D/g, '').slice(-3)}`
  order.handoverStatus = diffQty > 0 ? '有差异' : '已同步WMS'
  order.currentStatus = order.handoverStatus
  order.handoverAction = {
    handoverRecordId: order.handoverRecordId,
    handoverRecordNo: order.handoverRecordId,
    postOrderId: order.postOrderId,
    submittedGarmentQty: submittedQty,
    receivedGarmentQty: receivedQty,
    diffGarmentQty: diffQty,
    qtyUnit: '件',
    handoverAt: input.operatedAt || nowText(),
    status: diffQty > 0 ? '有差异' : '已回写',
  }
  syncOrderStatusFields(order)
  return cloneWorkOrder(order)
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
      postOrderId: waitQcItems[index]?.createdQcOrderId || receipt.receiptId,
      postOrderNo: waitQcItems[index]?.createdQcOrderId || receipt.receiptNo,
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
  return waitProcessWarehouseRecords.map((record) => ({ ...record, flowRecords: record.flowRecords.map(cloneFlowRecord) }))
}

export function listPostFinishingWaitHandoverWarehouseRecords(): PostFinishingWaitHandoverWarehouseRecord[] {
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
    waitPostQty: waitProcess.filter((record) => record.waitAction === '待后道').reduce((sum, record) => sum + record.availableGarmentQty, 0),
    waitQcQty: waitProcess.filter((record) => record.waitAction === '待质检').reduce((sum, record) => sum + record.availableGarmentQty, 0),
    waitRecheckQty: waitProcess.filter((record) => record.waitAction === '待复检').reduce((sum, record) => sum + record.availableGarmentQty, 0),
    waitHandoverQty: waitHandover.reduce((sum, record) => sum + record.waitHandoverGarmentQty, 0),
    dedicatedCount: orders.length,
    sewingDoneCount: 0,
  }
}
