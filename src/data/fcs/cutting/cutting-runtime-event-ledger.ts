import {
  getBrowserLocalStorage,
  type BrowserStorageLike,
} from '../../browser-storage.ts'

export const CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY = 'cuttingRuntimeEventLedger'

export type CuttingRuntimeEventSource = 'PDA' | 'WEB' | 'MOCK' | 'WMS'
export type CuttingRuntimeEventStatus = '已记录' | '已同步' | '同步失败' | '已取消'
export type CuttingRuntimeInventoryScope = '裁床待加工仓' | '裁床待交出仓'
export type CuttingRuntimeInventoryDirection = 'IN' | 'OUT' | 'ADJUST'
export type CuttingRuntimeQtyUnit = 'yard' | '片' | '件' | '条' | '粒' | '卷' | '公斤'

export type CuttingRuntimeEventType =
  | '中转仓配料完成通知'
  | '中转仓领料'
  | '待加工仓扫码入仓'
  | '待加工仓加工领料'
  | '待加工仓回收入仓'
  | '待加工仓位置调整'
  | '裁片单开工'
  | '开始铺布'
  | '完成铺布'
  | '开始裁剪'
  | '完成裁剪'
  | '菲票装袋'
  | '中转袋入仓'
  | '中转袋拆袋重装'
  | '交出装袋确认'
  | '新增交出记录'
  | '特殊工艺交出'
  | '特殊工艺回仓'
  | '中转袋回收'
  | '中转袋报废'

export interface CuttingRuntimeRefs {
  productionOrderId?: string
  productionOrderNo?: string
  cutOrderId?: string
  cutOrderNo?: string
  markerPlanId?: string
  markerPlanNo?: string
  spreadingOrderId?: string
  spreadingOrderNo?: string
  feiTicketIds?: string[]
  feiTicketNos?: string[]
  transferBagCode?: string
  handoverOrderId?: string
  handoverRecordId?: string
  specialCraftId?: string
  usageCycleId?: string
  handoverLegId?: string
  repackBatchId?: string
  transferBagCodes?: string[]
  sewingTaskIds?: string[]
  sewingTaskNos?: string[]
}

export interface RuntimeMaterialSnapshot {
  materialSku: string
  materialName: string
  materialColor: string
  materialSpec?: string
  materialAlias: string
  unit: CuttingRuntimeQtyUnit
}

export interface RuntimePatternSnapshot {
  patternFileId: string
  patternFileName: string
  patternVersion: string
  effectiveWidth: string
  partNames: string[]
}

export interface RuntimeInventoryEffect {
  inventoryScope: CuttingRuntimeInventoryScope
  direction: CuttingRuntimeInventoryDirection
  qty: number
  unit: CuttingRuntimeQtyUnit
  rollCount?: number
  fromWarehouseArea?: string
  fromLocationCode?: string
  toWarehouseArea?: string
  toLocationCode?: string
}

export interface TransferPrepReadyPayload {
  prepNoticeId: string
  prepNoticeNo: string
  prepOrderNo: string
  sourceWarehouseName: '中转仓'
  receiveStatus: '待领料' | '已领料待入仓' | '已入仓' | '已取消'
  materialLines: Array<{
    lineId: string
    materialSku: string
    materialName: string
    materialColor: string
    materialAlias: string
    preparedQty: number
    unit: 'yard'
    rollCount: number
    expectedPickupAt?: string
  }>
}

export interface TransferPickupPayload {
  pickupRecordId: string
  pickupRecordNo: string
  prepNoticeId: string
  prepOrderNo: string
  prepOrderId?: string
  prepLineId?: string
  prepRecordId?: string
  pickupQty: number
  unit: 'yard'
  rollCount: number
  rollNos: string[]
  warehouseArea?: string
  locationCode?: string
  pickupBy: string
  pickupAt: string
  hasDifference: boolean
  differenceReason?: string
  evidencePhotos?: string[]
  locationRefs?: RuntimeWarehouseLocationRef[]
  storageFootprint?: {
    footprintId: string
    sourceType: 'PICKUP_SESSION'
    sourceId: string
    locationIds: string[]
    totalQty: number
    remainingQty: number
    unit: string
    inboundAt: string
    inboundBy: string
  }
}

export interface WaitProcessInboundPayload {
  inboundRecordId: string
  inboundRecordNo: string
  pickupRecordId: string
  materialSku: string
  receivedQty: number
  unit: 'yard'
  rollCount: number
  rollNos: string[]
  warehouseArea: string
  locationCode: string
  receivedBy: string
  receivedAt: string
  checkResult: '正常' | '数量差异' | '卷号异常' | '其他异常'
  remark?: string
}

export interface WaitProcessIssuePayload {
  issueRecordId: string
  issueRecordNo: string
  spreadingOrderId: string
  spreadingOrderNo: string
  materialSku: string
  issuedQty: number
  unit: 'yard'
  rollCount: number
  rollNos: string[]
  fromWarehouseArea: string
  fromLocationCode: string
  issuedBy: string
  issuedAt: string
  purpose: '铺布用料'
  locationRef?: RuntimeWarehouseLocationRef
}

export interface WaitProcessReturnPayload {
  returnRecordId: string
  returnRecordNo: string
  spreadingOrderId: string
  spreadingOrderNo: string
  materialSku: string
  returnedQty: number
  unit: 'yard'
  rollCount: number
  rollNos: string[]
  warehouseArea: string
  locationCode: string
  returnedBy: string
  returnedAt: string
  reason: '铺布剩余' | '取消加工' | '其他'
  locationRefs?: RuntimeWarehouseLocationRef[]
  storageFootprint?: {
    footprintId: string
    sourceType: 'PICKUP_SESSION'
    sourceId: string
    locationIds: string[]
    totalQty: number
    remainingQty: number
    unit: string
    inboundAt: string
    inboundBy: string
  }
  locationRef?: RuntimeWarehouseLocationRef
}

export interface StartWorkPayload {
  cutOrderId: string
  cutOrderNo: string
  startedAt: string
  startedBy: string
  startSource: 'PDA'
}

export interface FinishSpreadingPayload {
  spreadingOrderId: string
  spreadingOrderNo: string
  planUnitId?: string
  sourceLineId?: string
  stepNo?: number
  stepLabel?: string
  materialSku?: string
  color?: string
  actualLayerCount: number
  actualSpreadLength: number
  actualMaterialUsage: number
  headLength: number
  tailLength: number
  unit: 'yard'
  rollNos: string[]
  operatorNames: string[]
  operatorLayerRows?: Array<{
    rowId: string
    startLayer?: number
    endLayer?: number
    operatorName: string
  }>
  operatorLayerText?: string
  finishedAt: string
}

export interface FinishCuttingPayload {
  spreadingOrderId: string
  spreadingOrderNo: string
  cuttingCompletedAt: string
  cuttingCompletedBy: string
  actualMaterialUsage: number
  actualMaterialUsageUnit: 'yard'
  outputLines: Array<{
    outputId: string
    color: string
    size: string
    partCode: string
    partName: string
    actualPieceQty: number
    actualGarmentQty: number
    unit: '片'
  }>
  hasDifference: boolean
  differenceTypes: Array<'实裁小于计划' | '实际用量异常' | '其他异常'>
}

export interface FeiTicketBagSnapshotItem {
  feiTicketId: string
  feiTicketNo: string
  productionOrderId: string
  productionOrderNo: string
  spreadingOrderId: string
  spreadingOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  spuCode: string
  color: string
  size: string
  partCode: string
  partName: string
  pieceQty: number
  unit: '片'
  pieceSequenceLabel: string
  hasSpecialCraft: boolean
  specialCraftCategory: string
  specialCraftDisplay: string
  receiverFactoryDisplay: string
  printStatus: string
  voidStatus: string
}

export interface FeiTicketBaggingPayload {
  baggingRecordId: string
  bagCode: string
  feiTicketItems: FeiTicketBagSnapshotItem[]
  totalPieceQty: number
  mixedFlag: boolean
  baggingBy: string
  baggingAt: string
}

export interface TransferBagInboundPayload {
  tempBagUseId: string
  bagCode: string
  warehouseArea: string
  locationCode: string
  inboundBy: string
  inboundAt: string
  totalPieceQty: number
}

export interface FeiTicketInboundPayload {
  tempBagUseId: string
  bagCode: string
  warehouseArea: string
  locationCode: string
  inboundBy: string
  inboundAt: string
  feiTicketItems: FeiTicketBagSnapshotItem[]
  totalPieceQty: number
  mixedFlag: boolean
  locationRef?: RuntimeWarehouseLocationRef
  idempotencyKey?: string
}

export interface RuntimeWarehouseLocationRef {
  factoryId: string
  warehouseId: string
  warehouseKind: 'WAIT_PROCESS' | 'WAIT_HANDOVER'
  areaId: string
  areaName: string
  shelfId: string
  shelfNo: string
  locationId: string
  locationNo: string
}

export interface HandoverBaggingConfirmPayload {
  baggingConfirmRecordId: string
  baggingConfirmRecordNo: string
  pickingTaskId: string
  pickingTaskNo: string
  sewingTaskId: string
  sewingTaskNo: string
  sourceTempBagCode: string
  targetTransferBagCode: string
  bagUseId: string
  scannedFeiTicketIds: string[]
  scannedFeiTicketNos: string[]
  containedFeiTicketIds: string[]
  containedFeiTicketNos: string[]
  totalPieceQty: number
  pickedQty: number
  unit: '片'
  scannedAt: string
  scannedBy: string
  packedAt: string
  packedBy: string
  checkResult: '正常' | '不属于当前任务' | '已作废' | '特殊工艺未回仓' | '已被其他任务分拣'
  bagBindingRule: '一个中转袋只能绑定一个车缝任务'
}

export interface TransferBagTicketFactSnapshot {
  feiTicketId: string
  feiTicketNo: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  color: string
  size: string
  partCode: string
  partName: string
  pieceQty: number
  sewingTaskId: string
  sewingTaskNo: string
  receiverFactoryId: string
  receiverFactoryName: string
}

export interface TransferBagRepackPayload {
  repackBatchId: string
  sourceBags: Array<{
    bagCode: string
    usageCycleId: string
    beforeTickets: TransferBagTicketFactSnapshot[]
  }>
  resultBags: Array<{
    bagCode: string
    usageCycleId: string
    reusedSourceBag: boolean
    tickets: TransferBagTicketFactSnapshot[]
  }>
  movedTickets: Array<{
    feiTicketId: string
    fromBagCode: string
    toBagCode: string
    pieceQty: number
  }>
  confirmedAt: string
  confirmedBy: string
}

export interface TransferBagRecoveryPayload {
  bagCode: string
  usageCycleId: string
  physicalBagReceived: true
  physicalBagEmpty: true
  recoveryMode: 'NORMAL' | 'FORCED'
  recoveryNode: string
  recoveryLocation: string
  reason: string
  recoveredAt: string
  recoveredBy: string
}

export interface TransferBagScrapPayload {
  bagCode: string
  idleConfirmed: true
  reason: string
  authorizedBy: string
  scrappedAt: string
  scrappedBy: string
}

interface LegacyTransferBagRecoveryPayload {
  bagCode: string
  usageCycleId: string
  returnWarehouseName: string
  returnedAt: string
  returnedBy: string
  note?: string
}

interface LegacyTransferBagScrapPayload {
  bagCode: string
  usageCycleId?: string
  reason: string
  scrappedAt: string
  scrappedBy: string
}

export interface HandoverRecordSubmitPayload {
  handoverOrderId: string
  handoverOrderNo: string
  handoverRecordId: string
  handoverRecordNo: string
  receiverType: '车缝厂' | '辅助工艺厂' | '特种工艺厂' | '仓库' | '其他对象'
  receiverId: string
  receiverName: string
  transferBagUses: Array<{
    bagUseId: string
    bagCode: string
    containedFeiTicketIds: string[]
    totalPieceQty: number
    // 兼容历史交出记录可缺省；新交出命令必须写入以下事实快照字段。
    sewingTaskIds?: string[]
    sewingTaskNos?: string[]
    ticketSnapshot?: TransferBagTicketFactSnapshot[]
  }>
  feiTicketItems: Array<{
    feiTicketId: string
    feiTicketNo: string
    pieceQty: number
    unit: '片'
  }>
  currentHandedOverQty: number
  submittedAt: string
  submittedBy: string
}

export interface SpecialCraftHandoverPayload {
  handoverOrderId: string
  handoverRecordId: string
  craftCategory: '辅助工艺' | '特种工艺'
  craftType: string
  receiverFactoryId: string
  receiverFactoryName: string
  feiTicketItems: Array<{
    feiTicketId: string
    feiTicketNo: string
    specialCraftId: string
    partName: string
    size: string
    pieceQty: number
  }>
  handedOverAt: string
  handedOverBy: string
  locationRef?: RuntimeWarehouseLocationRef
  idempotencyKey?: string
}

export interface SpecialCraftReturnPayload {
  returnRecordId: string
  returnRecordNo: string
  sourceHandoverOrderId: string
  sourceHandoverOrderNo?: string
  sourceHandoverRecordId: string
  sourceHandoverRecordNo?: string
  receiverFactoryId: string
  receiverFactoryName: string
  transferBagCode?: string
  warehouseName?: string
  craftType?: string
  returnedFeiTicketItems: Array<{
    feiTicketId: string
    feiTicketNo: string
    specialCraftId: string
    craftType?: string
    partName?: string
    size?: string
    expectedQty: number
    returnedQty: number
    unit: '片'
    returnStatus: '已回仓' | '部分回仓' | '回仓差异'
  }>
  warehouseArea: string
  locationCode: string
  locationRef?: RuntimeWarehouseLocationRef
  returnedAt: string
  returnedBy: string
  idempotencyKey?: string
}

export type CuttingRuntimeEventPayload =
  | TransferPrepReadyPayload
  | TransferPickupPayload
  | WaitProcessInboundPayload
  | WaitProcessIssuePayload
  | WaitProcessReturnPayload
  | StartWorkPayload
  | FinishSpreadingPayload
  | FinishCuttingPayload
  | FeiTicketBaggingPayload
  | TransferBagInboundPayload
  | FeiTicketInboundPayload
  | HandoverBaggingConfirmPayload
  | TransferBagRepackPayload
  | TransferBagRecoveryPayload
  | TransferBagScrapPayload
  | HandoverRecordSubmitPayload
  | SpecialCraftHandoverPayload
  | SpecialCraftReturnPayload
  | Record<string, unknown>

export type StrictTransferBagRuntimeEventType =
  | '中转袋拆袋重装'
  | '中转袋回收'
  | '中转袋报废'

type StrictTransferBagRuntimePayloadByType = {
  中转袋拆袋重装: TransferBagRepackPayload
  中转袋回收: TransferBagRecoveryPayload | LegacyTransferBagRecoveryPayload
  中转袋报废: TransferBagScrapPayload | LegacyTransferBagScrapPayload
}

export type CuttingRuntimeEventPayloadFor<
  T extends CuttingRuntimeEventType,
> = T extends StrictTransferBagRuntimeEventType
  ? StrictTransferBagRuntimePayloadByType[T]
  : CuttingRuntimeEventPayload

type NoInferRuntimeEventType<T> = [T][T extends unknown ? 0 : never]

export interface CuttingRuntimeEvent<
  T extends CuttingRuntimeEventType = CuttingRuntimeEventType,
> {
  eventId: string
  eventNo: string
  idempotencyKey?: string
  eventType: T
  eventSource: CuttingRuntimeEventSource
  eventStatus: CuttingRuntimeEventStatus
  occurredAt: string
  createdAt: string
  operatorId: string
  operatorName: string
  operatorRole: string
  refs: CuttingRuntimeRefs
  material?: RuntimeMaterialSnapshot
  pattern?: RuntimePatternSnapshot
  inventoryEffect?: RuntimeInventoryEffect
  payload: CuttingRuntimeEventPayloadFor<NoInferRuntimeEventType<T>>
}

export interface CuttingRuntimeEventLedgerStore {
  events: CuttingRuntimeEvent[]
}

interface AppendCuttingRuntimeEventInputBase {
  idempotencyKey?: string
  eventSource?: CuttingRuntimeEventSource
  eventStatus?: CuttingRuntimeEventStatus
  occurredAt?: string
  createdAt?: string
  operatorId?: string
  operatorName: string
  operatorRole?: string
  refs?: CuttingRuntimeRefs
  material?: RuntimeMaterialSnapshot
  pattern?: RuntimePatternSnapshot
  inventoryEffect?: RuntimeInventoryEffect
}

export type AppendCuttingRuntimeEventInput<
  T extends CuttingRuntimeEventType = CuttingRuntimeEventType,
> = T extends CuttingRuntimeEventType
  ? AppendCuttingRuntimeEventInputBase & {
    eventType: T
    payload: CuttingRuntimeEventPayloadFor<NoInferRuntimeEventType<T>>
  }
  : never

function toArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value : []
}

function toString(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toNumber(value: unknown): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : 0
}

function toStringArray(value: unknown): string[] {
  return toArray<unknown>(value).map((item) => toString(item)).filter(Boolean)
}

function toNormalizedStringArray(value: unknown): string[] {
  const seen = new Set<string>()
  return toArray<unknown>(value).reduce<string[]>((result, item) => {
    const text = toString(item).trim()
    if (!text || seen.has(text)) return result
    seen.add(text)
    result.push(text)
    return result
  }, [])
}

function normalizeOptionalRepackBatchId(value: unknown): string {
  return toString(value).trim()
}

function normalizeRefs(raw: unknown): CuttingRuntimeRefs {
  if (!raw || typeof raw !== 'object') return {}
  const value = raw as Record<string, unknown>
  return {
    productionOrderId: toString(value.productionOrderId),
    productionOrderNo: toString(value.productionOrderNo),
    cutOrderId: toString(value.cutOrderId),
    cutOrderNo: toString(value.cutOrderNo),
    markerPlanId: toString(value.markerPlanId),
    markerPlanNo: toString(value.markerPlanNo),
    spreadingOrderId: toString(value.spreadingOrderId),
    spreadingOrderNo: toString(value.spreadingOrderNo),
    feiTicketIds: toStringArray(value.feiTicketIds),
    feiTicketNos: toStringArray(value.feiTicketNos),
    transferBagCode: toString(value.transferBagCode),
    handoverOrderId: toString(value.handoverOrderId),
    handoverRecordId: toString(value.handoverRecordId),
    specialCraftId: toString(value.specialCraftId),
    usageCycleId: toString(value.usageCycleId),
    handoverLegId: toString(value.handoverLegId),
    repackBatchId: normalizeOptionalRepackBatchId(value.repackBatchId),
    transferBagCodes: toNormalizedStringArray(value.transferBagCodes),
    sewingTaskIds: toNormalizedStringArray(value.sewingTaskIds),
    sewingTaskNos: toNormalizedStringArray(value.sewingTaskNos),
  }
}

function normalizeAppendEventFacts(
  eventType: CuttingRuntimeEventType,
  rawRefs: CuttingRuntimeRefs | undefined,
  rawPayload: CuttingRuntimeEventPayloadFor<CuttingRuntimeEventType>,
): {
  refs: CuttingRuntimeRefs
  payload: CuttingRuntimeEventPayloadFor<CuttingRuntimeEventType>
} {
  const refs = normalizeRefs(rawRefs)
  if (eventType !== '中转袋拆袋重装') return { refs, payload: rawPayload }

  const payload = rawPayload as TransferBagRepackPayload
  const repackBatchId = normalizeOptionalRepackBatchId(payload.repackBatchId)
  if (!repackBatchId) {
    throw new Error('重装批次编号不能为空。')
  }
  if (refs.repackBatchId && refs.repackBatchId !== repackBatchId) {
    throw new Error(
      `重装批次编号不一致：refs 为 ${refs.repackBatchId}，载荷为 ${repackBatchId}。`,
    )
  }
  return {
    refs: { ...refs, repackBatchId },
    payload: { ...payload, repackBatchId },
  }
}

function normalizeMaterial(raw: unknown): RuntimeMaterialSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Record<string, unknown>
  const materialSku = toString(value.materialSku)
  if (!materialSku) return undefined
  return {
    materialSku,
    materialName: toString(value.materialName),
    materialColor: toString(value.materialColor),
    materialSpec: toString(value.materialSpec),
    materialAlias: toString(value.materialAlias),
    unit: normalizeUnit(value.unit, 'yard'),
  }
}

function normalizePattern(raw: unknown): RuntimePatternSnapshot | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Record<string, unknown>
  const patternFileId = toString(value.patternFileId)
  if (!patternFileId) return undefined
  return {
    patternFileId,
    patternFileName: toString(value.patternFileName),
    patternVersion: toString(value.patternVersion),
    effectiveWidth: toString(value.effectiveWidth),
    partNames: toStringArray(value.partNames),
  }
}

function normalizeUnit(value: unknown, fallback: CuttingRuntimeQtyUnit): CuttingRuntimeQtyUnit {
  const text = toString(value)
  if (text === '米') return 'yard'
  return text === 'yard' || text === '片' || text === '件' || text === '条' || text === '粒' || text === '卷' || text === '公斤'
    ? text
    : fallback
}

function normalizeInventoryEffect(raw: unknown): RuntimeInventoryEffect | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const value = raw as Record<string, unknown>
  const scope = toString(value.inventoryScope)
  const direction = toString(value.direction)
  if (scope !== '裁床待加工仓' && scope !== '裁床待交出仓') return undefined
  if (direction !== 'IN' && direction !== 'OUT' && direction !== 'ADJUST') return undefined
  return {
    inventoryScope: scope,
    direction,
    qty: toNumber(value.qty),
    unit: normalizeUnit(value.unit, 'yard'),
    rollCount: value.rollCount === undefined ? undefined : toNumber(value.rollCount),
    fromWarehouseArea: toString(value.fromWarehouseArea),
    fromLocationCode: toString(value.fromLocationCode),
    toWarehouseArea: toString(value.toWarehouseArea),
    toLocationCode: toString(value.toLocationCode),
  }
}

function isRuntimeEventType(value: string): value is CuttingRuntimeEventType {
  return [
    '中转仓配料完成通知',
    '中转仓领料',
    '待加工仓扫码入仓',
    '待加工仓加工领料',
    '待加工仓回收入仓',
    '待加工仓位置调整',
    '裁片单开工',
    '开始铺布',
    '完成铺布',
    '开始裁剪',
    '完成裁剪',
    '菲票装袋',
    '中转袋入仓',
    '中转袋拆袋重装',
    '交出装袋确认',
    '新增交出记录',
    '特殊工艺交出',
    '特殊工艺回仓',
    '中转袋回收',
    '中转袋报废',
  ].includes(value)
}

function normalizeEvent(raw: unknown): CuttingRuntimeEvent | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const eventId = toString(value.eventId)
  const eventTypeText = toString(value.eventType)
  if (!eventId || !isRuntimeEventType(eventTypeText)) return null
  const eventSourceText = toString(value.eventSource)
  const eventStatusText = toString(value.eventStatus)
  const occurredAt = toString(value.occurredAt) || toString(value.createdAt)
  return {
    eventId,
    eventNo: toString(value.eventNo) || eventId,
    idempotencyKey: toString(value.idempotencyKey) || undefined,
    eventType: eventTypeText,
    eventSource: eventSourceText === 'WEB' || eventSourceText === 'MOCK' || eventSourceText === 'WMS' ? eventSourceText : 'PDA',
    eventStatus:
      eventStatusText === '已记录' ||
      eventStatusText === '已同步' ||
      eventStatusText === '同步失败' ||
      eventStatusText === '已取消'
        ? eventStatusText
        : '已记录',
    occurredAt,
    createdAt: toString(value.createdAt) || occurredAt,
    operatorId: toString(value.operatorId),
    operatorName: toString(value.operatorName),
    operatorRole: toString(value.operatorRole),
    refs: normalizeRefs(value.refs),
    material: normalizeMaterial(value.material),
    pattern: normalizePattern(value.pattern),
    inventoryEffect: normalizeInventoryEffect(value.inventoryEffect),
    payload: value.payload && typeof value.payload === 'object'
      ? value.payload as CuttingRuntimeEventPayload
      : {},
  }
}

function uniqueByEventId(events: CuttingRuntimeEvent[]): CuttingRuntimeEvent[] {
  const seen = new Set<string>()
  return events.filter((event) => {
    if (!event.eventId || seen.has(event.eventId)) return false
    seen.add(event.eventId)
    return true
  })
}

function sortEvents(events: CuttingRuntimeEvent[]): CuttingRuntimeEvent[] {
  return events.slice().sort((left, right) => right.occurredAt.localeCompare(left.occurredAt, 'zh-CN'))
}

function compactDate(value: string): string {
  return value.replace(/[^0-9]/g, '').slice(0, 14) || `${Date.now()}`
}

function eventTypeCode(eventType: CuttingRuntimeEventType): string {
  const map: Record<CuttingRuntimeEventType, string> = {
    中转仓配料完成通知: 'PREP',
    中转仓领料: 'PICKUP',
    待加工仓扫码入仓: 'WP-IN',
    待加工仓加工领料: 'WP-OUT',
    待加工仓回收入仓: 'WP-RETURN',
    待加工仓位置调整: 'WP-ADJUST',
    裁片单开工: 'START',
    开始铺布: 'SPREAD-START',
    完成铺布: 'SPREAD-FINISH',
    开始裁剪: 'CUT-START',
    完成裁剪: 'CUT-FINISH',
    菲票装袋: 'BAGGING',
    中转袋入仓: 'TICKET-IN',
    中转袋拆袋重装: 'BAG-REPACK',
    交出装袋确认: 'BAG-CONFIRM',
    新增交出记录: 'HANDOVER',
    特殊工艺交出: 'CRAFT-OUT',
    特殊工艺回仓: 'CRAFT-IN',
    中转袋回收: 'BAG-RETURN',
    中转袋报废: 'BAG-SCRAP',
  }
  return map[eventType]
}

export function createEmptyCuttingRuntimeEventLedgerStore(): CuttingRuntimeEventLedgerStore {
  return { events: [] }
}

export function serializeCuttingRuntimeEventLedgerStorage(store: CuttingRuntimeEventLedgerStore): string {
  return JSON.stringify(store)
}

export function deserializeCuttingRuntimeEventLedgerStorage(raw: string | null): CuttingRuntimeEventLedgerStore {
  if (!raw) return createEmptyCuttingRuntimeEventLedgerStore()
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return {
      events: sortEvents(
        uniqueByEventId(
          toArray(parsed.events)
            .map((item) => normalizeEvent(item))
            .filter((item): item is CuttingRuntimeEvent => Boolean(item)),
        ),
      ),
    }
  } catch {
    return createEmptyCuttingRuntimeEventLedgerStore()
  }
}

export function hydrateCuttingRuntimeEventLedgerStore(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEventLedgerStore {
  return deserializeCuttingRuntimeEventLedgerStorage(storage?.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) ?? null)
}

export function persistCuttingRuntimeEventLedgerStore(
  store: CuttingRuntimeEventLedgerStore,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEventLedgerStore {
  storage?.setItem?.(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, serializeCuttingRuntimeEventLedgerStorage(store))
  return store
}

export function buildCuttingRuntimeEventId(eventType: CuttingRuntimeEventType, refs: CuttingRuntimeRefs, occurredAt: string): string {
  const normalizedRefs = normalizeRefs(refs)
  const businessKey = [
    normalizedRefs.spreadingOrderId,
    normalizedRefs.spreadingOrderNo,
    normalizedRefs.cutOrderId,
    normalizedRefs.cutOrderNo,
    normalizedRefs.handoverRecordId,
    normalizedRefs.transferBagCode,
    normalizedRefs.usageCycleId,
    normalizedRefs.handoverLegId,
    eventType === '中转袋拆袋重装' ? normalizedRefs.repackBatchId : undefined,
    normalizedRefs.feiTicketIds?.join('-'),
  ].filter(Boolean).join('-') || 'runtime'
  return `cutting-event:${eventTypeCode(eventType)}:${businessKey}:${compactDate(occurredAt)}`
}

export function appendCuttingRuntimeEvent<T extends CuttingRuntimeEventType>(
  input: AppendCuttingRuntimeEventInput<T>,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEvent<T> {
  const occurredAt = input.occurredAt || new Date().toISOString().slice(0, 16).replace('T', ' ')
  const { refs, payload } = normalizeAppendEventFacts(
    input.eventType,
    input.refs,
    input.payload,
  )
  const eventId = buildCuttingRuntimeEventId(input.eventType, refs, occurredAt)
  const event: CuttingRuntimeEvent = {
    eventId,
    eventNo: `${eventTypeCode(input.eventType)}-${compactDate(occurredAt)}`,
    idempotencyKey: input.idempotencyKey,
    eventType: input.eventType,
    eventSource: input.eventSource || 'PDA',
    eventStatus: input.eventStatus || '已同步',
    occurredAt,
    createdAt: input.createdAt || occurredAt,
    operatorId: input.operatorId || '',
    operatorName: input.operatorName,
    operatorRole: input.operatorRole || '',
    refs,
    material: input.material,
    pattern: input.pattern,
    inventoryEffect: input.inventoryEffect,
    payload,
  }
  const store = hydrateCuttingRuntimeEventLedgerStore(storage)
  persistCuttingRuntimeEventLedgerStore({
    events: sortEvents(uniqueByEventId([event, ...store.events.filter((item) => item.eventId !== event.eventId)])),
  }, storage)
  return event as CuttingRuntimeEvent<T>
}

export function appendCuttingRuntimeEventIdempotent<T extends CuttingRuntimeEventType>(
  input: AppendCuttingRuntimeEventInput<T> & { idempotencyKey: string },
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): {
  event: CuttingRuntimeEvent<T>
  appended: boolean
} {
  const store = hydrateCuttingRuntimeEventLedgerStore(storage)
  const existing = store.events.find(
    (event) => event.idempotencyKey === input.idempotencyKey,
  )
  if (existing) {
    if (existing.eventType !== input.eventType) {
      throw new Error(
        `幂等键 ${input.idempotencyKey} 已被其他事件类型占用：已有事件类型 ${existing.eventType}，本次事件类型 ${input.eventType}。`,
      )
    }
    return {
      event: existing as CuttingRuntimeEvent<T>,
      appended: false,
    }
  }
  return {
    event: appendCuttingRuntimeEvent<T>(input, storage),
    appended: true,
  }
}

export function listCuttingRuntimeEvents(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEvent[] {
  return hydrateCuttingRuntimeEventLedgerStore(storage).events
}

export function listCuttingRuntimeEventsByType(
  eventType: CuttingRuntimeEventType,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEvent[] {
  return listCuttingRuntimeEvents(storage).filter((event) => event.eventType === eventType)
}

export function listCuttingRuntimeEventsByInventoryScope(
  inventoryScope: CuttingRuntimeInventoryScope,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEvent[] {
  return listCuttingRuntimeEvents(storage).filter((event) => event.inventoryEffect?.inventoryScope === inventoryScope)
}

export type PdaRuntimeEventProjectionSourceChannel = 'PDA'

export interface PdaRuntimeEventProjectionBase {
  runtimeEventId: string
  actionType: string
  actionAt: string
  taskId: string
  taskNo: string
  executionOrderId: string
  executionOrderNo: string
  cutPieceOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  cutOrderId: string
  cutOrderNo: string
  markerPlanId: string
  markerPlanNo: string
  materialSku: string
  operatorAccountId: string
  operatorName: string
  operatorRole: string
  operatorFactoryId: string
  operatorFactoryName: string
  submittedAt: string
  sourceDeviceId: string
  sourceChannel: PdaRuntimeEventProjectionSourceChannel
  sourceEventId: string
  sourceRecordId: string
}

export interface PdaPickupEventRecord extends PdaRuntimeEventProjectionBase {
  resultLabel: string
  actualReceivedQtyText: string
  discrepancyNote: string
  photoProofCount: number
  claimDisputeId: string
  claimDisputeNo: string
}

export interface PdaCutPieceInboundEventRecord extends PdaRuntimeEventProjectionBase {
  zoneCode: 'A' | 'B' | 'C'
  locationLabel: string
  note: string
}

export interface PdaCutPieceHandoverEventRecord extends PdaRuntimeEventProjectionBase {
  targetLabel: string
  note: string
}

export interface PdaRuntimeEventProjectionStore {
  pickupEvents: PdaPickupEventRecord[]
  inboundEvents: PdaCutPieceInboundEventRecord[]
  handoverEvents: PdaCutPieceHandoverEventRecord[]
}

function sortRuntimeEventRecords<T extends { submittedAt: string }>(items: T[]): T[] {
  return items.slice().sort((left, right) => right.submittedAt.localeCompare(left.submittedAt, 'zh-CN'))
}

function uniqueRuntimeEventRecords<T extends { runtimeEventId: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (!item.runtimeEventId || seen.has(item.runtimeEventId)) return false
    seen.add(item.runtimeEventId)
    return true
  })
}

function payloadRecord(event: CuttingRuntimeEvent): Record<string, unknown> {
  return event.payload && typeof event.payload === 'object'
    ? event.payload as Record<string, unknown>
    : {}
}

function pdaProjectionBaseFromRuntimeEvent(
  event: CuttingRuntimeEvent,
  actionType: string,
  overrides: Partial<PdaRuntimeEventProjectionBase> = {},
): PdaRuntimeEventProjectionBase {
  const payload = payloadRecord(event)
  const executionOrderNo =
    overrides.executionOrderNo ||
    toString(payload.executionOrderNo) ||
    toString(payload.spreadingOrderNo) ||
    event.refs.spreadingOrderNo ||
    event.refs.cutOrderNo ||
    ''
  const executionOrderId =
    overrides.executionOrderId ||
    toString(payload.executionOrderId) ||
    toString(payload.spreadingOrderId) ||
    event.refs.spreadingOrderId ||
    event.refs.cutOrderId ||
    executionOrderNo
  const taskId = overrides.taskId || toString(payload.taskId) || executionOrderId || event.eventId
  const taskNo = overrides.taskNo || toString(payload.taskNo) || executionOrderNo || event.eventNo

  return {
    runtimeEventId: overrides.runtimeEventId || event.eventId,
    actionType: overrides.actionType || actionType,
    actionAt: overrides.actionAt || event.occurredAt || event.createdAt,
    taskId,
    taskNo,
    executionOrderId,
    executionOrderNo,
    cutPieceOrderNo: overrides.cutPieceOrderNo || executionOrderNo,
    productionOrderId: overrides.productionOrderId || event.refs.productionOrderId || '',
    productionOrderNo: overrides.productionOrderNo || event.refs.productionOrderNo || '',
    cutOrderId: overrides.cutOrderId || event.refs.cutOrderId || '',
    cutOrderNo: overrides.cutOrderNo || event.refs.cutOrderNo || '',
    markerPlanId: overrides.markerPlanId || event.refs.markerPlanId || '',
    markerPlanNo: overrides.markerPlanNo || event.refs.markerPlanNo || '',
    materialSku: overrides.materialSku || event.material?.materialSku || toString(payload.materialSku),
    operatorAccountId: overrides.operatorAccountId || event.operatorId || '',
    operatorName: overrides.operatorName || event.operatorName || 'PDA 操作员',
    operatorRole: overrides.operatorRole || event.operatorRole || 'PDA 操作员',
    operatorFactoryId: overrides.operatorFactoryId || '',
    operatorFactoryName: overrides.operatorFactoryName || '',
    submittedAt: overrides.submittedAt || event.occurredAt || event.createdAt,
    sourceDeviceId: overrides.sourceDeviceId || 'PDA-CUTTING',
    sourceChannel: 'PDA',
    sourceEventId: overrides.sourceEventId || event.eventId,
    sourceRecordId: overrides.sourceRecordId || event.eventNo,
  }
}

function formatRuntimeQtyText(qty: number, unit: string, rollCount?: number): string {
  const qtyText = `${qty.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit || 'yard'}`
  return rollCount && rollCount > 0 ? `卷数 ${rollCount} 卷 / 长度 ${qtyText}` : qtyText
}

function resolveRuntimeZoneCode(text: string): 'A' | 'B' | 'C' {
  if (/B|Ｂ|二区|二/.test(text)) return 'B'
  if (/C|Ｃ|三区|三/.test(text)) return 'C'
  return 'A'
}

function firstPayloadItem<T extends Record<string, unknown>>(items: unknown): T | null {
  const list = toArray<T>(items)
  return list[0] ?? null
}

function pickupEventRecordFromEvent(event: CuttingRuntimeEvent): PdaPickupEventRecord | null {
  const payload = event.payload as TransferPickupPayload
  if (!payload?.pickupRecordId) return null
  const pickupQty = toNumber(payload.pickupQty)
  const unit = payload.unit || 'yard'
  return {
    ...pdaProjectionBaseFromRuntimeEvent(event, 'CUTTING_TRANSFER_PICKUP', {
      runtimeEventId: event.eventId,
      executionOrderId: payload.pickupRecordId || event.refs.cutOrderId || '',
      executionOrderNo: payload.pickupRecordNo || payload.prepOrderNo || event.refs.cutOrderNo || '',
      taskId: payload.prepNoticeId || event.refs.cutOrderId || event.eventId,
      taskNo: payload.prepOrderNo || event.refs.cutOrderNo || event.eventNo,
    }),
    resultLabel: '已完成中转仓领料',
    actualReceivedQtyText: formatRuntimeQtyText(pickupQty, unit, toNumber(payload.rollCount)),
    discrepancyNote: payload.hasDifference ? payload.differenceReason || '存在领料差异' : '当前无差异',
    photoProofCount: toArray(payload.evidencePhotos).length,
    claimDisputeId: '',
    claimDisputeNo: '',
  }
}

function inboundEventRecordFromEvent(event: CuttingRuntimeEvent): PdaCutPieceInboundEventRecord | null {
  const payload = event.payload as FeiTicketInboundPayload
  if (!payload?.tempBagUseId) return null
  const firstTicket = firstPayloadItem<{
    spreadingOrderId?: string
    spreadingOrderNo?: string
    cutOrderId?: string
    cutOrderNo?: string
  }>(payload.feiTicketItems)
  const locationText = `${payload.warehouseArea || ''} ${payload.locationCode || ''}`.trim()
  return {
    ...pdaProjectionBaseFromRuntimeEvent(event, 'PDA_CUT_PIECE_INBOUND_CONFIRM', {
      runtimeEventId: event.eventId,
      executionOrderId: firstTicket?.spreadingOrderId || event.refs.spreadingOrderId || payload.tempBagUseId,
      executionOrderNo: firstTicket?.spreadingOrderNo || event.refs.spreadingOrderNo || payload.bagCode || '',
      taskId: payload.tempBagUseId,
      taskNo: payload.bagCode,
      cutOrderId: firstTicket?.cutOrderId || event.refs.cutOrderId || '',
      cutOrderNo: firstTicket?.cutOrderNo || event.refs.cutOrderNo || '',
      cutPieceOrderNo: firstTicket?.spreadingOrderNo || event.refs.spreadingOrderNo || payload.bagCode || '',
      operatorName: payload.inboundBy || event.operatorName,
    }),
    zoneCode: resolveRuntimeZoneCode(locationText),
    locationLabel: locationText || payload.bagCode || '裁床待交出仓',
    note: `扫码入仓 ${payload.feiTicketItems.length} 张菲票，合计 ${payload.totalPieceQty} 片`,
  }
}

function handoverEventRecordFromEvent(event: CuttingRuntimeEvent): PdaCutPieceHandoverEventRecord | null {
  const payload = event.payload as HandoverRecordSubmitPayload
  if (!payload?.handoverRecordId) return null
  return {
    ...pdaProjectionBaseFromRuntimeEvent(event, 'PDA_CUT_PIECE_HANDOVER_CONFIRM', {
      runtimeEventId: event.eventId,
      executionOrderId: payload.handoverOrderId,
      executionOrderNo: payload.handoverOrderNo,
      taskId: payload.handoverOrderId,
      taskNo: payload.handoverOrderNo,
      operatorName: payload.submittedBy || event.operatorName,
    }),
    targetLabel: payload.receiverName || '接收对象',
    note: `${payload.handoverRecordNo} / 本次交出 ${payload.currentHandedOverQty} 片`,
  }
}

export function listPdaPickupEvents(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaPickupEventRecord[] {
  return sortRuntimeEventRecords(
    uniqueRuntimeEventRecords(
      listCuttingRuntimeEventsByType('中转仓领料', storage)
        .map((event) => pickupEventRecordFromEvent(event))
        .filter((record): record is PdaPickupEventRecord => Boolean(record)),
    ),
  )
}

export function listPdaPickupEventsByCutOrderNo(
  cutOrderNo: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaPickupEventRecord[] {
  return listPdaPickupEvents(storage).filter((item) => item.cutOrderNo === cutOrderNo)
}

export function getLatestPdaPickupEventByCutOrderNo(
  cutOrderNo: string,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaPickupEventRecord | null {
  return listPdaPickupEventsByCutOrderNo(cutOrderNo, storage)[0] ?? null
}

export function listPdaInboundEvents(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaCutPieceInboundEventRecord[] {
  return sortRuntimeEventRecords(
    uniqueRuntimeEventRecords(
      listCuttingRuntimeEventsByType('中转袋入仓', storage)
        .map((event) => inboundEventRecordFromEvent(event))
        .filter((record): record is PdaCutPieceInboundEventRecord => Boolean(record)),
    ),
  )
}

export function listPdaHandoverEvents(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaCutPieceHandoverEventRecord[] {
  return sortRuntimeEventRecords(
    uniqueRuntimeEventRecords(
      listCuttingRuntimeEventsByType('新增交出记录', storage)
        .map((event) => handoverEventRecordFromEvent(event))
        .filter((record): record is PdaCutPieceHandoverEventRecord => Boolean(record)),
    ),
  )
}

export function listRuntimePdaExecutionEventProjections(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaRuntimeEventProjectionStore {
  return {
    pickupEvents: listPdaPickupEvents(storage),
    inboundEvents: listPdaInboundEvents(storage),
    handoverEvents: listPdaHandoverEvents(storage),
  }
}
