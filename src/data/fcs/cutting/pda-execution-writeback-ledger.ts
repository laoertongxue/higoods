import { getPdaCuttingExecutionSourceRecord } from './pda-cutting-task-source.ts'
import { getPdaCuttingTaskScenarioByTaskId } from './pda-cutting-task-scenarios.ts'

export const CUTTING_PDA_EXECUTION_WRITEBACK_STORAGE_KEY = 'cuttingPdaExecutionWritebackLedger'

export type PdaExecutionWritebackSourceChannel = 'PDA'

interface PdaExecutionWritebackBase {
  writebackId: string
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
  sourceChannel: PdaExecutionWritebackSourceChannel
  sourceWritebackId: string
  sourceRecordId: string
}

export interface PdaPickupWritebackRecord extends PdaExecutionWritebackBase {
  resultLabel: string
  actualReceivedQtyText: string
  discrepancyNote: string
  photoProofCount: number
  claimDisputeId: string
  claimDisputeNo: string
}

export interface PdaCutPieceInboundWritebackRecord extends PdaExecutionWritebackBase {
  zoneCode: 'A' | 'B' | 'C'
  locationLabel: string
  note: string
}

export interface PdaCutPieceHandoverWritebackRecord extends PdaExecutionWritebackBase {
  targetLabel: string
  note: string
}

export interface PdaReplenishmentFeedbackWritebackRecord extends PdaExecutionWritebackBase {
  reasonLabel: string
  note: string
  photoProofCount: number
  lifecycleStatus?: 'SUBMITTED' | 'PENDING' | 'CLOSED'
  lifecycleStatusLabel?: string
}

export interface PdaExecutionWritebackStore {
  pickupWritebacks: PdaPickupWritebackRecord[]
  inboundWritebacks: PdaCutPieceInboundWritebackRecord[]
  handoverWritebacks: PdaCutPieceHandoverWritebackRecord[]
  replenishmentFeedbackWritebacks: PdaReplenishmentFeedbackWritebackRecord[]
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

function uniqueById<T extends { writebackId: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    if (!item.writebackId || seen.has(item.writebackId)) return false
    seen.add(item.writebackId)
    return true
  })
}

function sortBySubmittedAtDesc<T extends { submittedAt: string }>(items: T[]): T[] {
  return items.slice().sort((left, right) => right.submittedAt.localeCompare(left.submittedAt, 'zh-CN'))
}

function normalizeBaseRecord(raw: Record<string, unknown>) {
  const executionOrderNo = toString(raw.executionOrderNo) || toString(raw.cutPieceOrderNo)
  const submittedAt = toString(raw.submittedAt)
  const actionAt = toString(raw.actionAt) || submittedAt
  return {
    writebackId: toString(raw.writebackId),
    actionType: toString(raw.actionType),
    actionAt,
    taskId: toString(raw.taskId),
    taskNo: toString(raw.taskNo),
    executionOrderId: toString(raw.executionOrderId) || executionOrderNo,
    executionOrderNo,
    cutPieceOrderNo: toString(raw.cutPieceOrderNo) || executionOrderNo,
    productionOrderId: toString(raw.productionOrderId),
    productionOrderNo: toString(raw.productionOrderNo),
    cutOrderId: toString(raw.cutOrderId),
    cutOrderNo: toString(raw.cutOrderNo),
    markerPlanId: toString(raw.markerPlanId),
    markerPlanNo: toString(raw.markerPlanNo),
    materialSku: toString(raw.materialSku),
    operatorAccountId: toString(raw.operatorAccountId),
    operatorName: toString(raw.operatorName),
    operatorRole: toString(raw.operatorRole),
    operatorFactoryId: toString(raw.operatorFactoryId),
    operatorFactoryName: toString(raw.operatorFactoryName),
    submittedAt: submittedAt || actionAt,
    sourceDeviceId: toString(raw.sourceDeviceId) || 'PDA-CUTTING',
    sourceChannel: 'PDA' as const,
    sourceWritebackId: toString(raw.sourceWritebackId),
    sourceRecordId: toString(raw.sourceRecordId),
  }
}

function normalizePickupRecord(raw: unknown): PdaPickupWritebackRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const base = normalizeBaseRecord(record)
  if (!base.writebackId) return null
  return {
    ...base,
    resultLabel: toString(record.resultLabel),
    actualReceivedQtyText: toString(record.actualReceivedQtyText),
    discrepancyNote: toString(record.discrepancyNote),
    photoProofCount: toNumber(record.photoProofCount),
    claimDisputeId: toString(record.claimDisputeId),
    claimDisputeNo: toString(record.claimDisputeNo),
  }
}

function normalizeInboundRecord(raw: unknown): PdaCutPieceInboundWritebackRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const base = normalizeBaseRecord(record)
  if (!base.writebackId) return null
  return {
    ...base,
    zoneCode: (['A', 'B', 'C'].includes(toString(record.zoneCode)) ? toString(record.zoneCode) : 'A') as 'A' | 'B' | 'C',
    locationLabel: toString(record.locationLabel),
    note: toString(record.note),
  }
}

function normalizeHandoverRecord(raw: unknown): PdaCutPieceHandoverWritebackRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const base = normalizeBaseRecord(record)
  if (!base.writebackId) return null
  return {
    ...base,
    targetLabel: toString(record.targetLabel),
    note: toString(record.note),
  }
}

function normalizeReplenishmentFeedbackRecord(raw: unknown): PdaReplenishmentFeedbackWritebackRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const record = raw as Record<string, unknown>
  const base = normalizeBaseRecord(record)
  if (!base.writebackId) return null
  return {
    ...base,
    reasonLabel: toString(record.reasonLabel),
    note: toString(record.note),
    photoProofCount: toNumber(record.photoProofCount),
    lifecycleStatus: (() => {
      const value = toString(record.lifecycleStatus)
      return value === 'PENDING' || value === 'CLOSED' || value === 'SUBMITTED' ? value : undefined
    })(),
    lifecycleStatusLabel: toString(record.lifecycleStatusLabel),
  }
}

function createSeedBase(input: {
  writebackId: string
  actionType: string
  submittedAt: string
  taskId: string
  executionOrderNo: string
  operatorName: string
  sourceRecordId: string
}): PdaExecutionWritebackBase {
  const execution = getPdaCuttingExecutionSourceRecord(input.taskId, input.executionOrderNo)
  const scenario = getPdaCuttingTaskScenarioByTaskId(input.taskId)
  if (!execution || !scenario) {
    throw new Error(`裁片 PDA 写回种子缺少任务执行对象：${input.taskId} / ${input.executionOrderNo}`)
  }

  return {
    writebackId: input.writebackId,
    actionType: input.actionType,
    actionAt: input.submittedAt,
    taskId: scenario.taskId,
    taskNo: scenario.taskNo,
    executionOrderId: execution.executionOrderId,
    executionOrderNo: execution.executionOrderNo,
    cutPieceOrderNo: execution.executionOrderNo,
    productionOrderId: execution.productionOrderId,
    productionOrderNo: execution.productionOrderNo,
    cutOrderId: execution.cutOrderId,
    cutOrderNo: execution.cutOrderNo,
    markerPlanId: execution.markerPlanId,
    markerPlanNo: execution.markerPlanNo,
    materialSku: execution.materialSku,
    operatorAccountId: `seed-${input.operatorName.toLowerCase().replace(/\s+/g, '-')}`,
    operatorName: input.operatorName,
    operatorRole: '裁片移动端操作员',
    operatorFactoryId: scenario.assignedFactoryId,
    operatorFactoryName: scenario.assignedFactoryName,
    submittedAt: input.submittedAt,
    sourceDeviceId: 'PDA-CUTTING-SEED',
    sourceChannel: 'PDA',
    sourceWritebackId: input.writebackId,
    sourceRecordId: input.sourceRecordId,
  }
}

function createSeededPdaExecutionWritebackStore(): PdaExecutionWritebackStore {
  const pickupWritebacks: PdaPickupWritebackRecord[] = [
    '0302',
    '0303',
    '0304',
    '0305',
    '0306',
    '0307',
    '0310',
  ].map((suffix, index) => ({
    ...createSeedBase({
      writebackId: `PDA-PICKUP-SEED-${suffix}`,
      actionType: 'PICKUP_CONFIRM',
      submittedAt: `2026-03-18 08:${String(30 + index).padStart(2, '0')}:00`,
      taskId: `TASK-CUT-PDA-${suffix === '0302' ? 'PICKED-NOT-STARTED' : suffix === '0303' ? 'WAIT-SPREAD' : suffix === '0304' ? 'SPREADING' : suffix === '0305' ? 'WAIT-CUT' : suffix === '0306' ? 'CUTTING' : suffix === '0307' ? 'CUT-DONE' : 'SYNC-FAIL'}-${suffix}`,
      executionOrderNo: `CPO-PDA-${suffix}`,
      operatorName: '裁床领料员',
      sourceRecordId: `pickup-seed-${suffix}`,
    }),
    resultLabel: '领料成功',
    actualReceivedQtyText: '卷数 2 卷 / 长度 300 米',
    discrepancyNote: '当前无差异',
    photoProofCount: 1,
    claimDisputeId: '',
    claimDisputeNo: '',
  }))

  const inboundWritebacks: PdaCutPieceInboundWritebackRecord[] = [
    {
      ...createSeedBase({
        writebackId: 'PDA-INBOUND-SEED-000203',
        actionType: 'PDA_CUT_PIECE_INBOUND_CONFIRM',
        submittedAt: '2026-03-18 16:20:00',
        taskId: 'TASK-CUT-000203',
        executionOrderNo: 'CPO-20260318-C1',
        operatorName: 'Dewi Lestari',
        sourceRecordId: 'inbound-seed-000203',
      }),
      zoneCode: 'A',
      locationLabel: '待交出仓 A-01',
      note: '铺布裁剪完成后进入待交出仓。',
    },
  ]

  const handoverWritebacks: PdaCutPieceHandoverWritebackRecord[] = [
    {
      ...createSeedBase({
        writebackId: 'PDA-HANDOVER-SEED-000203',
        actionType: 'PDA_CUT_PIECE_HANDOVER_CONFIRM',
        submittedAt: '2026-03-18 17:10:00',
        taskId: 'TASK-CUT-000203',
        executionOrderNo: 'CPO-20260318-C1',
        operatorName: 'Dewi Lestari',
        sourceRecordId: 'handover-seed-000203',
      }),
      targetLabel: '车缝待接收位',
      note: '裁片按菲票完成交出。',
    },
  ]

  const replenishmentFeedbackWritebacks: PdaReplenishmentFeedbackWritebackRecord[] = [
    {
      ...createSeedBase({
        writebackId: 'PDA-REPLENISH-SEED-000204',
        actionType: 'PDA_REPLENISHMENT_FEEDBACK_SUBMIT',
        submittedAt: '2026-03-18 14:20:00',
        taskId: 'TASK-CUT-000204',
        executionOrderNo: 'CPO-20260318-D1',
        operatorName: '裁床组长',
        sourceRecordId: 'replenishment-seed-000204',
      }),
      reasonLabel: '布卷长度差异',
    note: '铺布前发现裁床领料长度与布卷标签不一致。',
      photoProofCount: 2,
      lifecycleStatus: 'PENDING',
      lifecycleStatusLabel: '待处理',
    },
  ]

  return {
    pickupWritebacks: sortBySubmittedAtDesc(uniqueById(pickupWritebacks)),
    inboundWritebacks: sortBySubmittedAtDesc(uniqueById(inboundWritebacks)),
    handoverWritebacks: sortBySubmittedAtDesc(uniqueById(handoverWritebacks)),
    replenishmentFeedbackWritebacks: sortBySubmittedAtDesc(uniqueById(replenishmentFeedbackWritebacks)),
  }
}

function mergeStores(primary: PdaExecutionWritebackStore, secondary: PdaExecutionWritebackStore): PdaExecutionWritebackStore {
  return {
    pickupWritebacks: sortBySubmittedAtDesc(uniqueById([...primary.pickupWritebacks, ...secondary.pickupWritebacks])),
    inboundWritebacks: sortBySubmittedAtDesc(uniqueById([...primary.inboundWritebacks, ...secondary.inboundWritebacks])),
    handoverWritebacks: sortBySubmittedAtDesc(uniqueById([...primary.handoverWritebacks, ...secondary.handoverWritebacks])),
    replenishmentFeedbackWritebacks: sortBySubmittedAtDesc(
      uniqueById([...primary.replenishmentFeedbackWritebacks, ...secondary.replenishmentFeedbackWritebacks]),
    ),
  }
}

export function createEmptyPdaExecutionWritebackStore(): PdaExecutionWritebackStore {
  return {
    pickupWritebacks: [],
    inboundWritebacks: [],
    handoverWritebacks: [],
    replenishmentFeedbackWritebacks: [],
  }
}

export function serializePdaExecutionWritebackStorage(store: PdaExecutionWritebackStore): string {
  return JSON.stringify(store)
}

export function deserializePdaExecutionWritebackStorage(raw: string | null): PdaExecutionWritebackStore {
  const seeded = createSeededPdaExecutionWritebackStore()
  if (!raw) return seeded
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return mergeStores(
      {
      pickupWritebacks: sortBySubmittedAtDesc(
        uniqueById(toArray(parsed.pickupWritebacks).map((item) => normalizePickupRecord(item)).filter((item): item is PdaPickupWritebackRecord => Boolean(item))),
      ),
      inboundWritebacks: sortBySubmittedAtDesc(
        uniqueById(toArray(parsed.inboundWritebacks).map((item) => normalizeInboundRecord(item)).filter((item): item is PdaCutPieceInboundWritebackRecord => Boolean(item))),
      ),
      handoverWritebacks: sortBySubmittedAtDesc(
        uniqueById(toArray(parsed.handoverWritebacks).map((item) => normalizeHandoverRecord(item)).filter((item): item is PdaCutPieceHandoverWritebackRecord => Boolean(item))),
      ),
      replenishmentFeedbackWritebacks: sortBySubmittedAtDesc(
        uniqueById(
          toArray(parsed.replenishmentFeedbackWritebacks)
            .map((item) => normalizeReplenishmentFeedbackRecord(item))
            .filter((item): item is PdaReplenishmentFeedbackWritebackRecord => Boolean(item)),
        ),
      ),
      },
      seeded,
    )
  } catch {
    return seeded
  }
}

export function hydratePdaExecutionWritebackStore(storage?: Pick<Storage, 'getItem'>): PdaExecutionWritebackStore {
  if (!storage) return createSeededPdaExecutionWritebackStore()
  return deserializePdaExecutionWritebackStorage(storage.getItem(CUTTING_PDA_EXECUTION_WRITEBACK_STORAGE_KEY))
}

export function persistPdaExecutionWritebackStore(
  store: PdaExecutionWritebackStore,
  storage?: Pick<Storage, 'setItem'>,
): void {
  if (!storage) return
  storage.setItem(CUTTING_PDA_EXECUTION_WRITEBACK_STORAGE_KEY, serializePdaExecutionWritebackStorage(store))
}

function appendUniqueRecord<T extends { writebackId: string; submittedAt: string }>(records: T[], record: T): T[] {
  return sortBySubmittedAtDesc(uniqueById([record, ...records.filter((item) => item.writebackId !== record.writebackId)]))
}

export function appendPickupWritebackRecord(
  record: PdaPickupWritebackRecord,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): PdaExecutionWritebackStore {
  const store = hydratePdaExecutionWritebackStore(storage)
  const nextStore = {
    ...store,
    pickupWritebacks: appendUniqueRecord(store.pickupWritebacks, record),
  }
  persistPdaExecutionWritebackStore(nextStore, storage)
  return nextStore
}

export function appendInboundWritebackRecord(
  record: PdaCutPieceInboundWritebackRecord,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): PdaExecutionWritebackStore {
  const store = hydratePdaExecutionWritebackStore(storage)
  const nextStore = {
    ...store,
    inboundWritebacks: appendUniqueRecord(store.inboundWritebacks, record),
  }
  persistPdaExecutionWritebackStore(nextStore, storage)
  return nextStore
}

export function appendHandoverWritebackRecord(
  record: PdaCutPieceHandoverWritebackRecord,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): PdaExecutionWritebackStore {
  const store = hydratePdaExecutionWritebackStore(storage)
  const nextStore = {
    ...store,
    handoverWritebacks: appendUniqueRecord(store.handoverWritebacks, record),
  }
  persistPdaExecutionWritebackStore(nextStore, storage)
  return nextStore
}

export function appendReplenishmentFeedbackWritebackRecord(
  record: PdaReplenishmentFeedbackWritebackRecord,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): PdaExecutionWritebackStore {
  const store = hydratePdaExecutionWritebackStore(storage)
  const nextStore = {
    ...store,
    replenishmentFeedbackWritebacks: appendUniqueRecord(store.replenishmentFeedbackWritebacks, record),
  }
  persistPdaExecutionWritebackStore(nextStore, storage)
  return nextStore
}

export function listPdaPickupWritebacks(storage?: Pick<Storage, 'getItem'>): PdaPickupWritebackRecord[] {
  return hydratePdaExecutionWritebackStore(storage).pickupWritebacks
}

export function listPdaPickupWritebacksByCutOrderNo(
  cutOrderNo: string,
  storage?: Pick<Storage, 'getItem'>,
): PdaPickupWritebackRecord[] {
  return listPdaPickupWritebacks(storage).filter((item) => item.cutOrderNo === cutOrderNo)
}

export function getLatestPdaPickupWritebackByCutOrderNo(
  cutOrderNo: string,
  storage?: Pick<Storage, 'getItem'>,
): PdaPickupWritebackRecord | null {
  return listPdaPickupWritebacksByCutOrderNo(cutOrderNo, storage)[0] ?? null
}

export function listPdaInboundWritebacks(storage?: Pick<Storage, 'getItem'>): PdaCutPieceInboundWritebackRecord[] {
  return hydratePdaExecutionWritebackStore(storage).inboundWritebacks
}

export function listPdaHandoverWritebacks(storage?: Pick<Storage, 'getItem'>): PdaCutPieceHandoverWritebackRecord[] {
  return hydratePdaExecutionWritebackStore(storage).handoverWritebacks
}

export function listPdaReplenishmentFeedbackWritebacks(
  storage?: Pick<Storage, 'getItem'>,
): PdaReplenishmentFeedbackWritebackRecord[] {
  return hydratePdaExecutionWritebackStore(storage).replenishmentFeedbackWritebacks
}
