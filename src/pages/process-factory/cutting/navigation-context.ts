import { getCanonicalCuttingPath } from './meta'

export type CuttingPageContextKey =
  | 'cutting-summary'
  | 'replenishment'
  | 'special-processes'
  | 'material-prep'
  | 'spreading-list'
  | 'marker-spreading'
  | 'fei-tickets'
  | 'original-orders'
  | 'production-progress'
  | 'transfer-bags'
  | 'cut-piece-warehouse'
  | 'fabric-warehouse'
  | 'merge-batches'
  | 'cuttable-pool'

export type CuttingNavigationTarget =
  | 'summary'
  | 'replenishment'
  | 'specialProcesses'
  | 'materialPrep'
  | 'markerPlan'
  | 'spreadingList'
  | 'markerSpreading'
  | 'feiTickets'
  | 'originalOrders'
  | 'productionProgress'
  | 'transferBags'
  | 'cutPieceWarehouse'
  | 'fabricWarehouse'
  | 'mergeBatches'
  | 'cuttablePool'
  | 'printing'
  | 'dyeing'

export interface CuttingDrillContext {
  sourcePageKey?: CuttingPageContextKey
  sourceSection?: string
  blockerSection?: string
  issueType?: string
  productionOrderId?: string
  productionOrderNo?: string
  originalCutOrderId?: string
  originalCutOrderNo?: string
  mergeBatchId?: string
  mergeBatchNo?: string
  materialSku?: string
  cuttingGroup?: string
  warehouseStatus?: string
  styleCode?: string
  spuCode?: string
  markerId?: string
  markerNo?: string
  spreadingSessionId?: string
  spreadingSessionNo?: string
  suggestionId?: string
  suggestionNo?: string
  processOrderId?: string
  processOrderNo?: string
  printableUnitId?: string
  printableUnitNo?: string
  ticketId?: string
  ticketNo?: string
  bagId?: string
  bagCode?: string
  usageId?: string
  usageNo?: string
  warehouseRecordId?: string
  autoOpenDetail?: boolean
  detailTab?: string
  focusTab?: string
  focusSection?: string
}

export type CuttingPrefilterPayload = Record<string, string | undefined>

const sourcePageLabelMap: Record<CuttingPageContextKey, string> = {
  'cutting-summary': '裁剪总表',
  replenishment: '补料管理',
  'special-processes': '特殊工艺',
  'material-prep': '仓库配料领料',
  'spreading-list': '铺布列表',
  'marker-spreading': '铺布列表',
  'fei-tickets': '打印菲票',
  'original-orders': '原始裁片单',
  'production-progress': '生产单进度',
  'transfer-bags': '周转口袋流转',
  'cut-piece-warehouse': '裁片仓',
  'fabric-warehouse': '裁床仓',
  'merge-batches': '合并裁剪批次',
  'cuttable-pool': '可裁排产',
}

const actionLabelMap: Record<CuttingNavigationTarget, string> = {
  summary: '去裁剪总表',
  replenishment: '去补料管理',
  specialProcesses: '去特殊工艺',
  materialPrep: '去仓库配料领料',
  markerPlan: '去唛架',
  spreadingList: '去铺布',
  markerSpreading: '去铺布',
  feiTickets: '去打印菲票',
  originalOrders: '去原始裁片单',
  productionProgress: '去生产单进度',
  transferBags: '去周转口袋流转',
  cutPieceWarehouse: '去裁片仓',
  fabricWarehouse: '去裁床仓',
  mergeBatches: '去合并裁剪批次',
  cuttablePool: '去可裁排产',
  printing: '去印花工单',
  dyeing: '去染色工单',
}

const blockerSectionLabelMap: Record<string, string> = {
  MATERIAL_PREP: '配料领料',
  SPREADING: '铺布',
  REPLENISHMENT: '补料',
  FEI_TICKETS: '打印菲票',
  WAREHOUSE_HANDOFF: '仓务交接',
  SPECIAL_PROCESS: '特殊工艺',
}

const issueTypeLabelMap: Record<string, string> = {
  MATERIAL_PREP: '配料领料',
  SPREADING_REPLENISH: '唛架补料',
  TICKET_QR: '打印菲票',
  WAREHOUSE_HANDOFF: '仓务交接',
  SPECIAL_PROCESS: '特殊工艺',
}

const warehouseStatusLabelMap: Record<string, string> = {
  PENDING_INBOUND: '待入仓',
  INBOUNDED: '已入仓',
  WAITING_HANDOVER: '待交接',
  HANDED_OVER: '已交接',
}

const focusTabLabelMap: Record<string, string> = {
  printed: '已打印菲票',
  records: '打印记录',
  split: '拆分明细',
  spreadings: '铺布记录',
}

function toBoolean(value: string | null): boolean {
  return value === '1' || value === 'true'
}

function pickString(params: URLSearchParams, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = params.get(key)
    if (value) return value
  }
  return undefined
}

export function serializeCuttingDrillContext(context: CuttingDrillContext | null | undefined): CuttingPrefilterPayload {
  if (!context) return {}
  return {
    sourcePageKey: context.sourcePageKey,
    sourceSection: context.sourceSection,
    blockerSection: context.blockerSection,
    issueType: context.issueType,
    productionOrderId: context.productionOrderId,
    productionOrderNo: context.productionOrderNo,
    originalCutOrderId: context.originalCutOrderId,
    originalCutOrderNo: context.originalCutOrderNo,
    mergeBatchId: context.mergeBatchId,
    mergeBatchNo: context.mergeBatchNo,
    materialSku: context.materialSku,
    cuttingGroup: context.cuttingGroup,
    warehouseStatus: context.warehouseStatus,
    styleCode: context.styleCode,
    spuCode: context.spuCode,
    markerId: context.markerId,
    markerNo: context.markerNo,
    spreadingSessionId: context.spreadingSessionId,
    spreadingSessionNo: context.spreadingSessionNo,
    suggestionId: context.suggestionId,
    suggestionNo: context.suggestionNo,
    processOrderId: context.processOrderId,
    processOrderNo: context.processOrderNo,
    printableUnitId: context.printableUnitId,
    printableUnitNo: context.printableUnitNo,
    ticketId: context.ticketId,
    ticketNo: context.ticketNo,
    bagId: context.bagId,
    bagCode: context.bagCode,
    usageId: context.usageId,
    usageNo: context.usageNo,
    warehouseRecordId: context.warehouseRecordId,
    autoOpenDetail: context.autoOpenDetail ? '1' : undefined,
    detailTab: context.detailTab,
    focusTab: context.focusTab,
    focusSection: context.focusSection,
  }
}

export function readCuttingDrillContextFromLocation(
  input: URLSearchParams | string | null | undefined,
): CuttingDrillContext | null {
  const params = typeof input === 'string' ? new URLSearchParams(input) : input
  if (!params) return null

  const context: CuttingDrillContext = {
    sourcePageKey: pickString(params, 'sourcePageKey') as CuttingPageContextKey | undefined,
    sourceSection: pickString(params, 'sourceSection'),
    blockerSection: pickString(params, 'blockerSection'),
    issueType: pickString(params, 'issueType'),
    productionOrderId: pickString(params, 'productionOrderId'),
    productionOrderNo: pickString(params, 'productionOrderNo'),
    originalCutOrderId: pickString(params, 'originalCutOrderId'),
    originalCutOrderNo: pickString(params, 'originalCutOrderNo'),
    mergeBatchId: pickString(params, 'mergeBatchId'),
    mergeBatchNo: pickString(params, 'mergeBatchNo', '裁剪批次No'),
    materialSku: pickString(params, 'materialSku', 'fabricSku'),
    cuttingGroup: pickString(params, 'cuttingGroup'),
    warehouseStatus: pickString(params, 'warehouseStatus'),
    styleCode: pickString(params, 'styleCode'),
    spuCode: pickString(params, 'spuCode'),
    markerId: pickString(params, 'markerId'),
    markerNo: pickString(params, 'markerNo'),
    spreadingSessionId: pickString(params, 'spreadingSessionId', 'sessionId'),
    spreadingSessionNo: pickString(params, 'spreadingSessionNo', 'sessionNo'),
    suggestionId: pickString(params, 'suggestionId'),
    suggestionNo: pickString(params, 'suggestionNo'),
    processOrderId: pickString(params, 'processOrderId'),
    processOrderNo: pickString(params, 'processOrderNo'),
    printableUnitId: pickString(params, 'printableUnitId'),
    printableUnitNo: pickString(params, 'printableUnitNo'),
    ticketId: pickString(params, 'ticketId', 'ticketRecordId'),
    ticketNo: pickString(params, 'ticketNo'),
    bagId: pickString(params, 'bagId'),
    bagCode: pickString(params, 'bagCode'),
    usageId: pickString(params, 'usageId'),
    usageNo: pickString(params, 'usageNo'),
    warehouseRecordId: pickString(params, 'warehouseRecordId'),
    autoOpenDetail: toBoolean(params.get('autoOpenDetail')),
    detailTab: pickString(params, 'detailTab'),
    focusTab: pickString(params, 'focusTab', 'tab', 'panel'),
    focusSection: pickString(params, 'focusSection'),
  }

  return Object.values(context).some((value) => value !== undefined && value !== false) ? context : null
}

export function normalizeLegacyCuttingPayload(
  payload: Record<string, string | undefined> | null | undefined,
  sourcePageKey?: CuttingPageContextKey,
  extra?: Partial<CuttingDrillContext>,
): CuttingDrillContext {
  const payloadAutoOpenDetail = payload?.autoOpenDetail === '1' || payload?.autoOpenDetail === 'true'
  return {
    sourcePageKey,
    productionOrderId: payload?.productionOrderId,
    productionOrderNo: payload?.productionOrderNo,
    originalCutOrderId: payload?.originalCutOrderId,
    originalCutOrderNo: payload?.originalCutOrderNo,
    mergeBatchId: payload?.mergeBatchId,
    mergeBatchNo: payload?.mergeBatchNo || payload?.['裁剪批次No'],
    materialSku: payload?.materialSku || payload?.fabricSku,
    cuttingGroup: payload?.cuttingGroup,
    warehouseStatus: payload?.warehouseStatus,
    styleCode: payload?.styleCode,
    spuCode: payload?.spuCode,
    markerId: payload?.markerId,
    markerNo: payload?.markerNo,
    spreadingSessionId: payload?.spreadingSessionId || payload?.sessionId,
    spreadingSessionNo: payload?.spreadingSessionNo || payload?.sessionNo,
    suggestionId: payload?.suggestionId,
    suggestionNo: payload?.suggestionNo,
    processOrderId: payload?.processOrderId,
    processOrderNo: payload?.processOrderNo,
    printableUnitId: payload?.printableUnitId,
    printableUnitNo: payload?.printableUnitNo,
    ticketId: payload?.ticketId || payload?.ticketRecordId,
    ticketNo: payload?.ticketNo,
    bagId: payload?.bagId,
    bagCode: payload?.bagCode,
    usageId: payload?.usageId,
    usageNo: payload?.usageNo,
    warehouseRecordId: payload?.warehouseRecordId,
    blockerSection: payload?.blockerSection,
    issueType: payload?.issueType,
    autoOpenDetail: extra?.autoOpenDetail ?? payloadAutoOpenDetail,
    detailTab: extra?.detailTab || payload?.detailTab,
    focusTab: extra?.focusTab || payload?.focusTab || payload?.tab || payload?.panel,
    focusSection: extra?.focusSection,
    sourceSection: extra?.sourceSection,
    ...extra,
  }
}

function buildRouteWithQuery(pathname: string, payload?: CuttingPrefilterPayload): string {
  if (!payload) return pathname
  const params = new URLSearchParams()
  Object.entries(payload).forEach(([key, value]) => {
    if (value) params.set(key, value)
  })
  const query = params.toString()
  return query ? `${pathname}?${query}` : pathname
}

function getTargetPath(target: CuttingNavigationTarget, context: CuttingDrillContext): string {
  if (target === 'summary') return getCanonicalCuttingPath('summary')
  if (target === 'replenishment') return getCanonicalCuttingPath('replenishment')
  if (target === 'specialProcesses') return getCanonicalCuttingPath('special-processes')
  if (target === 'materialPrep') return getCanonicalCuttingPath('material-prep')
  if (target === 'markerPlan') {
    if (context.autoOpenDetail && context.markerId) {
      return `${getCanonicalCuttingPath('marker-detail')}/${encodeURIComponent(context.markerId)}`
    }
    return getCanonicalCuttingPath('marker-list')
  }
  if (target === 'spreadingList') {
    return getCanonicalCuttingPath('spreading-list')
  }
  if (target === 'originalOrders') return getCanonicalCuttingPath('original-orders')
  if (target === 'productionProgress') return getCanonicalCuttingPath('production-progress')
  if (target === 'transferBags') {
    if (context.bagId || context.bagCode || context.usageId || context.usageNo) {
      return getCanonicalCuttingPath('transfer-bag-detail')
    }
    return getCanonicalCuttingPath('transfer-bags')
  }
  if (target === 'cutPieceWarehouse') return getCanonicalCuttingPath('cut-piece-warehouse')
  if (target === 'fabricWarehouse') return getCanonicalCuttingPath('fabric-warehouse')
  if (target === 'mergeBatches') return getCanonicalCuttingPath('merge-batches')
  if (target === 'cuttablePool') return getCanonicalCuttingPath('cuttable-pool')
  if (target === 'printing') return '/fcs/craft/printing/work-orders'
  if (target === 'dyeing') return '/fcs/craft/dyeing/work-orders'

  if (target === 'markerSpreading') {
    return getCanonicalCuttingPath('spreading-list')
  }

  if (target === 'feiTickets') {
    if (context.printableUnitId || context.printableUnitNo) {
      if (context.focusTab === 'records') return getCanonicalCuttingPath('fei-ticket-records')
      if (context.focusTab === 'printed' || context.ticketId || context.ticketNo) return getCanonicalCuttingPath('fei-ticket-printed')
      if (context.autoOpenDetail) return getCanonicalCuttingPath('fei-ticket-detail')
    }
    return getCanonicalCuttingPath('fei-tickets')
  }

  return getCanonicalCuttingPath('summary')
}

export function buildCuttingRouteWithContext(target: CuttingNavigationTarget, context: CuttingDrillContext): string {
  return buildRouteWithQuery(getTargetPath(target, context), serializeCuttingDrillContext(context))
}

export function getCuttingNavigationActionLabel(target: CuttingNavigationTarget): string {
  return actionLabelMap[target]
}

export function getCuttingSourcePageLabel(sourcePageKey: CuttingPageContextKey | undefined): string {
  if (!sourcePageKey) return '外部页面'
  return sourcePageLabelMap[sourcePageKey]
}

export function buildCuttingDrillChipLabels(context: CuttingDrillContext | null): string[] {
  if (!context) return []
  const labels = [
    context.productionOrderNo ? `生产单：${context.productionOrderNo}` : '',
    context.originalCutOrderNo ? `原始裁片单：${context.originalCutOrderNo}` : '',
    context.mergeBatchNo ? `合并批次：${context.mergeBatchNo}` : '',
    context.materialSku ? `面料 SKU：${context.materialSku}` : '',
    context.cuttingGroup ? `裁床组：${context.cuttingGroup}` : '',
    context.warehouseStatus ? `仓状态：${warehouseStatusLabelMap[context.warehouseStatus] || context.warehouseStatus}` : '',
    context.styleCode ? `款号：${context.styleCode}` : '',
    context.markerNo ? `唛架：${context.markerNo}` : '',
    context.spreadingSessionNo ? `铺布：${context.spreadingSessionNo}` : '',
    context.printableUnitNo ? `打印单元：${context.printableUnitNo}` : '',
    context.ticketNo ? `菲票码：${context.ticketNo}` : '',
    context.suggestionNo ? `补料建议：${context.suggestionNo}` : context.suggestionId ? `补料建议：${context.suggestionId}` : '',
    context.processOrderNo ? `工艺单：${context.processOrderNo}` : context.processOrderId ? `工艺单：${context.processOrderId}` : '',
    context.bagCode ? `周转口袋码：${context.bagCode}` : '',
    context.usageNo ? `使用周期：${context.usageNo}` : '',
    context.blockerSection ? `阻塞链路：${blockerSectionLabelMap[context.blockerSection] || context.blockerSection}` : '',
    context.issueType ? `问题分类：${issueTypeLabelMap[context.issueType] || context.issueType}` : '',
    context.focusTab ? `焦点页签：${focusTabLabelMap[context.focusTab] || context.focusTab}` : '',
  ]
  return labels.filter(Boolean)
}

export function buildCuttingDrillSummary(context: CuttingDrillContext | null): string {
  if (!context) return ''
  if (context.sourcePageKey === 'cutting-summary') return '当前已恢复裁剪总表定位'
  return `来源：${getCuttingSourcePageLabel(context.sourcePageKey)}`
}

export function hasSummaryReturnContext(context: CuttingDrillContext | null): boolean {
  return context?.sourcePageKey === 'cutting-summary'
}

export function buildReturnToSummaryContext(context: CuttingDrillContext | null): CuttingDrillContext | null {
  if (!hasSummaryReturnContext(context)) return null
  return {
    sourcePageKey: context?.sourcePageKey,
    sourceSection: context?.sourceSection,
    blockerSection: context?.blockerSection,
    issueType: context?.issueType,
    productionOrderId: context?.productionOrderId,
    productionOrderNo: context?.productionOrderNo,
    originalCutOrderId: context?.originalCutOrderId,
    originalCutOrderNo: context?.originalCutOrderNo,
    mergeBatchId: context?.mergeBatchId,
    mergeBatchNo: context?.mergeBatchNo,
    materialSku: context?.materialSku,
    cuttingGroup: context?.cuttingGroup,
    warehouseStatus: context?.warehouseStatus,
    styleCode: context?.styleCode,
    spreadingSessionId: context?.spreadingSessionId,
    spreadingSessionNo: context?.spreadingSessionNo,
    suggestionId: context?.suggestionId,
    processOrderId: context?.processOrderId,
    processOrderNo: context?.processOrderNo,
    printableUnitId: context?.printableUnitId,
    printableUnitNo: context?.printableUnitNo,
    ticketId: context?.ticketId,
    ticketNo: context?.ticketNo,
    bagId: context?.bagId,
    bagCode: context?.bagCode,
    usageId: context?.usageId,
    usageNo: context?.usageNo,
    autoOpenDetail: true,
  }
}
