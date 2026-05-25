import {
  getBrowserLocalStorage,
  type BrowserStorageLike,
} from '../../browser-storage.ts'

export const CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY = 'cuttingRuntimeEventLedger'

export type CuttingRuntimeEventSource = 'PDA' | 'WEB' | 'MOCK' | 'WMS'
export type CuttingRuntimeEventStatus = '已记录' | '已同步' | '同步失败' | '已取消'
export type CuttingRuntimeInventoryScope = '裁床待加工仓' | '裁床待交出仓'
export type CuttingRuntimeInventoryDirection = 'IN' | 'OUT' | 'ADJUST'
export type CuttingRuntimeQtyUnit = '米' | '片' | '件'

export type CuttingRuntimeEventType =
  | '中转仓配料完成通知'
  | '中转仓领料'
  | '待加工仓扫码入仓'
  | '待加工仓加工领料'
  | '待加工仓回收入仓'
  | '裁片单开工'
  | '开始铺布'
  | '完成铺布'
  | '开始裁剪'
  | '完成裁剪'
  | '菲票入仓暂存'
  | '待交出仓二次分拣'
  | '待交出仓重新装袋'
  | '新增交出记录'
  | '特殊工艺交出'
  | '特殊工艺回仓'
  | '补料反馈'

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
}

export interface RuntimeMaterialSnapshot {
  materialSku: string
  materialName: string
  materialColor: string
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
    unit: '米'
    rollCount: number
    expectedPickupAt?: string
  }>
}

export interface TransferPickupPayload {
  pickupRecordId: string
  pickupRecordNo: string
  prepNoticeId: string
  prepOrderNo: string
  pickupQty: number
  unit: '米'
  rollCount: number
  rollNos: string[]
  pickupBy: string
  pickupAt: string
  hasDifference: boolean
  differenceReason?: string
  evidencePhotos?: string[]
}

export interface WaitProcessInboundPayload {
  inboundRecordId: string
  inboundRecordNo: string
  pickupRecordId: string
  materialSku: string
  receivedQty: number
  unit: '米'
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
  unit: '米'
  rollCount: number
  rollNos: string[]
  fromWarehouseArea: string
  fromLocationCode: string
  issuedBy: string
  issuedAt: string
  purpose: '铺布用料'
}

export interface WaitProcessReturnPayload {
  returnRecordId: string
  returnRecordNo: string
  spreadingOrderId: string
  spreadingOrderNo: string
  materialSku: string
  returnedQty: number
  unit: '米'
  rollCount: number
  rollNos: string[]
  warehouseArea: string
  locationCode: string
  returnedBy: string
  returnedAt: string
  reason: '铺布剩余' | '取消加工' | '其他'
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
  actualLayerCount: number
  actualSpreadLength: number
  actualMaterialUsage: number
  headLength: number
  tailLength: number
  unit: '米'
  rollNos: string[]
  operatorNames: string[]
  finishedAt: string
}

export interface FinishCuttingPayload {
  spreadingOrderId: string
  spreadingOrderNo: string
  cuttingCompletedAt: string
  cuttingCompletedBy: string
  actualMaterialUsage: number
  actualMaterialUsageUnit: '米'
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

export interface FeiTicketInboundPayload {
  tempBagUseId: string
  bagCode: string
  warehouseArea: string
  locationCode: string
  inboundBy: string
  inboundAt: string
  feiTicketItems: Array<{
    feiTicketId: string
    feiTicketNo: string
    spreadingOrderId: string
    spreadingOrderNo: string
    cutOrderId: string
    cutOrderNo: string
    pieceQty: number
    unit: '片'
    pieceSequenceLabel: string
    hasSpecialCraft: boolean
  }>
  totalPieceQty: number
  mixedFlag: boolean
}

export interface HandoverSortingPayload {
  pickingTaskId: string
  pickingTaskNo: string
  sewingTaskId: string
  sewingTaskNo: string
  sourceTempBagCode: string
  scannedFeiTicketIds: string[]
  scannedFeiTicketNos: string[]
  pickedQty: number
  unit: '片'
  scannedBy: string
  scannedAt: string
  checkResult: '正常' | '不属于当前任务' | '已作废' | '特殊工艺未回仓' | '已被其他任务分拣'
}

export interface RebagPayload {
  bagUseId: string
  targetTransferBagCode: string
  sewingTaskId: string
  sewingTaskNo: string
  pickingTaskId: string
  pickingTaskNo: string
  containedFeiTicketIds: string[]
  containedFeiTicketNos: string[]
  totalPieceQty: number
  unit: '片'
  packedAt: string
  packedBy: string
  bagBindingRule: '一个中转袋只能绑定一个车缝任务'
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
}

export interface SpecialCraftReturnPayload {
  returnRecordId: string
  returnRecordNo: string
  sourceHandoverOrderId: string
  sourceHandoverRecordId: string
  receiverFactoryId: string
  receiverFactoryName: string
  returnedFeiTicketItems: Array<{
    feiTicketId: string
    feiTicketNo: string
    specialCraftId: string
    expectedQty: number
    returnedQty: number
    unit: '片'
    returnStatus: '已回仓' | '部分回仓' | '回仓差异'
  }>
  warehouseArea: string
  locationCode: string
  returnedAt: string
  returnedBy: string
}

export interface ReplenishmentFeedbackPayload {
  feedbackId: string
  taskId?: string
  taskNo?: string
  executionOrderId?: string
  executionOrderNo?: string
  reasonLabel: string
  differenceQty: number
  unit: CuttingRuntimeQtyUnit
  note: string
  photoProofCount: number
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
  | FeiTicketInboundPayload
  | HandoverSortingPayload
  | RebagPayload
  | HandoverRecordSubmitPayload
  | SpecialCraftHandoverPayload
  | SpecialCraftReturnPayload
  | ReplenishmentFeedbackPayload
  | Record<string, unknown>

export interface CuttingRuntimeEvent {
  eventId: string
  eventNo: string
  eventType: CuttingRuntimeEventType
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
  payload: CuttingRuntimeEventPayload
}

export interface CuttingRuntimeEventLedgerStore {
  events: CuttingRuntimeEvent[]
}

export interface AppendCuttingRuntimeEventInput {
  eventType: CuttingRuntimeEventType
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
  payload: CuttingRuntimeEventPayload
}

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
    materialAlias: toString(value.materialAlias),
    unit: normalizeUnit(value.unit, '米'),
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
  return text === '米' || text === '片' || text === '件' ? text : fallback
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
    unit: normalizeUnit(value.unit, '米'),
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
    '裁片单开工',
    '开始铺布',
    '完成铺布',
    '开始裁剪',
    '完成裁剪',
    '菲票入仓暂存',
    '待交出仓二次分拣',
    '待交出仓重新装袋',
    '新增交出记录',
    '特殊工艺交出',
    '特殊工艺回仓',
    '补料反馈',
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
    裁片单开工: 'START',
    开始铺布: 'SPREAD-START',
    完成铺布: 'SPREAD-FINISH',
    开始裁剪: 'CUT-START',
    完成裁剪: 'CUT-FINISH',
    菲票入仓暂存: 'TICKET-IN',
    待交出仓二次分拣: 'SORT',
    待交出仓重新装袋: 'REBAG',
    新增交出记录: 'HANDOVER',
    特殊工艺交出: 'CRAFT-OUT',
    特殊工艺回仓: 'CRAFT-IN',
    补料反馈: 'REPLENISH',
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
  const businessKey = [
    refs.spreadingOrderId,
    refs.spreadingOrderNo,
    refs.cutOrderId,
    refs.cutOrderNo,
    refs.handoverRecordId,
    refs.transferBagCode,
    refs.feiTicketIds?.join('-'),
  ].filter(Boolean).join('-') || 'runtime'
  return `cutting-event:${eventTypeCode(eventType)}:${businessKey}:${compactDate(occurredAt)}`
}

export function appendCuttingRuntimeEvent(
  input: AppendCuttingRuntimeEventInput,
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): CuttingRuntimeEvent {
  const occurredAt = input.occurredAt || new Date().toISOString().slice(0, 16).replace('T', ' ')
  const refs = input.refs || {}
  const eventId = buildCuttingRuntimeEventId(input.eventType, refs, occurredAt)
  const event: CuttingRuntimeEvent = {
    eventId,
    eventNo: `${eventTypeCode(input.eventType)}-${compactDate(occurredAt)}`,
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
    payload: input.payload,
  }
  const store = hydrateCuttingRuntimeEventLedgerStore(storage)
  persistCuttingRuntimeEventLedgerStore({
    events: sortEvents(uniqueByEventId([event, ...store.events.filter((item) => item.eventId !== event.eventId)])),
  }, storage)
  return event
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

export interface PdaReplenishmentFeedbackEventRecord extends PdaRuntimeEventProjectionBase {
  reasonLabel: string
  note: string
  photoProofCount: number
  lifecycleStatus?: 'SUBMITTED' | 'PENDING' | 'CLOSED'
  lifecycleStatusLabel?: string
}

export interface PdaRuntimeEventProjectionStore {
  pickupEvents: PdaPickupEventRecord[]
  inboundEvents: PdaCutPieceInboundEventRecord[]
  handoverEvents: PdaCutPieceHandoverEventRecord[]
  replenishmentFeedbackEvents: PdaReplenishmentFeedbackEventRecord[]
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
  const qtyText = `${qty.toLocaleString('zh-CN', { maximumFractionDigits: 2 })} ${unit || '米'}`
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
  const unit = payload.unit || '米'
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

function replenishmentFeedbackEventRecordFromEvent(event: CuttingRuntimeEvent): PdaReplenishmentFeedbackEventRecord | null {
  const payload = event.payload as ReplenishmentFeedbackPayload
  if (!payload?.feedbackId) return null
  return {
    ...pdaProjectionBaseFromRuntimeEvent(event, 'PDA_REPLENISHMENT_FEEDBACK_SUBMIT', {
      runtimeEventId: event.eventId,
      executionOrderId: payload.executionOrderId || event.refs.spreadingOrderId || '',
      executionOrderNo: payload.executionOrderNo || event.refs.spreadingOrderNo || '',
      taskId: payload.taskId || payload.executionOrderId || event.refs.cutOrderId || event.eventId,
      taskNo: payload.taskNo || payload.executionOrderNo || event.refs.cutOrderNo || event.eventNo,
    }),
    reasonLabel: payload.reasonLabel || '现场反馈',
    note: payload.note || '',
    photoProofCount: toNumber(payload.photoProofCount),
    lifecycleStatus: 'SUBMITTED',
    lifecycleStatusLabel: event.eventStatus || '已同步',
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
      listCuttingRuntimeEventsByType('菲票入仓暂存', storage)
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

export function listPdaReplenishmentFeedbackEvents(
  storage: BrowserStorageLike | null = getBrowserLocalStorage(),
): PdaReplenishmentFeedbackEventRecord[] {
  return sortRuntimeEventRecords(
    uniqueRuntimeEventRecords(
      listCuttingRuntimeEventsByType('补料反馈', storage)
        .map((event) => replenishmentFeedbackEventRecordFromEvent(event))
        .filter((record): record is PdaReplenishmentFeedbackEventRecord => Boolean(record)),
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
    replenishmentFeedbackEvents: listPdaReplenishmentFeedbackEvents(storage),
  }
}
