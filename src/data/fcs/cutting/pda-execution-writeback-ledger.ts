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
  legacyCutPieceOrderNo: string
  cutPieceOrderNo: string
  productionOrderId: string
  productionOrderNo: string
  originalCutOrderId: string
  originalCutOrderNo: string
  mergeBatchId: string
  mergeBatchNo: string
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
  const legacyCutPieceOrderNo = toString(raw.legacyCutPieceOrderNo) || toString(raw.cutPieceOrderNo)
  const executionOrderNo = toString(raw.executionOrderNo) || legacyCutPieceOrderNo
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
    legacyCutPieceOrderNo,
    cutPieceOrderNo: legacyCutPieceOrderNo,
    productionOrderId: toString(raw.productionOrderId),
    productionOrderNo: toString(raw.productionOrderNo),
    originalCutOrderId: toString(raw.originalCutOrderId),
    originalCutOrderNo: toString(raw.originalCutOrderNo),
    mergeBatchId: toString(raw.mergeBatchId),
    mergeBatchNo: toString(raw.mergeBatchNo),
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
    legacyCutPieceOrderNo: execution.legacyCutPieceOrderNo,
    cutPieceOrderNo: execution.legacyCutPieceOrderNo,
    productionOrderId: execution.productionOrderId,
    productionOrderNo: execution.productionOrderNo,
    originalCutOrderId: execution.originalCutOrderId,
    originalCutOrderNo: execution.originalCutOrderNo,
    mergeBatchId: execution.mergeBatchId,
    mergeBatchNo: execution.mergeBatchNo,
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
    {
      ...createSeedBase({
        writebackId: 'PDA-PICKUP-SEED-000088',
        actionType: 'PDA_PICKUP_CONFIRM',
        submittedAt: '2026-03-28 10:12:00',
        taskId: 'TASK-CUT-000088',
        executionOrderNo: 'CPO-20260319-B',
        operatorName: 'Rina Putri',
        sourceRecordId: 'pickup-seed-000088',
      }),
      resultLabel: '领取成功',
      actualReceivedQtyText: '卷数 3 卷 / 长度 92 米',
      discrepancyNote: '',
      photoProofCount: 0,
      claimDisputeId: '',
      claimDisputeNo: '',
    },
    {
      ...createSeedBase({
        writebackId: 'PDA-PICKUP-SEED-000090',
        actionType: 'PDA_PICKUP_CONFIRM',
        submittedAt: '2026-03-28 11:18:00',
        taskId: 'TASK-CUT-000090',
        executionOrderNo: 'CPO-20260319-D',
        operatorName: 'Putra Aji',
        sourceRecordId: 'pickup-seed-000090',
      }),
      resultLabel: '部分领取',
      actualReceivedQtyText: '卷数 2 卷 / 长度 61 米',
      discrepancyNote: '主布少 1 卷，已先行铺布确认。',
      photoProofCount: 1,
      claimDisputeId: '',
      claimDisputeNo: '',
    },
    {
      ...createSeedBase({
        writebackId: 'PDA-PICKUP-SEED-000095',
        actionType: 'PDA_PICKUP_CONFIRM',
        submittedAt: '2026-03-28 12:06:00',
        taskId: 'TASK-CUT-000095',
        executionOrderNo: 'CPO-20260319-I',
        operatorName: '现场领料员',
        sourceRecordId: 'pickup-seed-000095',
      }),
      resultLabel: '差异举证已提交',
      actualReceivedQtyText: '卷数 4 卷 / 长度 589 米',
      discrepancyNote: '少 1 卷主布面料，已提交差异举证。',
      photoProofCount: 3,
      claimDisputeId: 'CD-202603-0001',
      claimDisputeNo: 'LYY-202603-0001',
    },
    {
      ...createSeedBase({
        writebackId: 'PDA-PICKUP-SEED-000100',
        actionType: 'PDA_PICKUP_CONFIRM',
        submittedAt: '2026-03-28 09:42:00',
        taskId: 'TASK-CUT-000100',
        executionOrderNo: 'CPO-20260324-B1',
        operatorName: 'Rina Putri',
        sourceRecordId: 'pickup-seed-000100',
      }),
      resultLabel: '领取成功',
      actualReceivedQtyText: '卷数 2 卷 / 长度 75 米',
      discrepancyNote: '',
      photoProofCount: 0,
      claimDisputeId: '',
      claimDisputeNo: '',
    },
  ]

  const inboundWritebacks: PdaCutPieceInboundWritebackRecord[] = [
    {
      ...createSeedBase({
        writebackId: 'PDA-INBOUND-SEED-000089',
        actionType: 'PDA_CUT_PIECE_INBOUND_CONFIRM',
        submittedAt: '2026-03-28 17:20:00',
        taskId: 'TASK-CUT-000089',
        executionOrderNo: 'CPO-20260319-C',
        operatorName: 'Dewi Kartika',
        sourceRecordId: 'inbound-seed-000089',
      }),
      zoneCode: 'A',
      locationLabel: 'A-01-03',
      note: '合并裁剪批次裁片已入裁片仓',
    },
    {
      ...createSeedBase({
        writebackId: 'PDA-INBOUND-SEED-000093',
        actionType: 'PDA_CUT_PIECE_INBOUND_CONFIRM',
        submittedAt: '2026-03-28 16:45:00',
        taskId: 'TASK-CUT-000093',
        executionOrderNo: 'CPO-20260319-G',
        operatorName: 'Nia Prasetyo',
        sourceRecordId: 'inbound-seed-000093',
      }),
      zoneCode: 'B',
      locationLabel: 'B-02-01',
      note: '该面料裁片已归位',
    },
    {
      ...createSeedBase({
        writebackId: 'PDA-INBOUND-SEED-000103',
        actionType: 'PDA_CUT_PIECE_INBOUND_CONFIRM',
        submittedAt: '2026-03-28 19:20:00',
        taskId: 'TASK-CUT-000103',
        executionOrderNo: 'CPO-20260324-E1',
        operatorName: 'Factory F004',
        sourceRecordId: 'inbound-seed-000103',
      }),
      zoneCode: 'C',
      locationLabel: 'C-03-02',
      note: '异地裁床厂完工后已入仓',
    },
  ]

  const handoverWritebacks: PdaCutPieceHandoverWritebackRecord[] = [
    {
      ...createSeedBase({
        writebackId: 'PDA-HANDOVER-SEED-000089',
        actionType: 'PDA_CUT_PIECE_HANDOVER_CONFIRM',
        submittedAt: '2026-03-28 18:40:00',
        taskId: 'TASK-CUT-000089',
        executionOrderNo: 'CPO-20260319-C',
        operatorName: 'Dewi Kartika',
        sourceRecordId: 'handover-seed-000089',
      }),
      targetLabel: '车缝前置收料位',
      note: '合并裁剪批次裁片已交接到车缝前置工位',
    },
    {
      ...createSeedBase({
        writebackId: 'PDA-HANDOVER-SEED-000094',
        actionType: 'PDA_CUT_PIECE_HANDOVER_CONFIRM',
        submittedAt: '2026-03-28 15:10:00',
        taskId: 'TASK-CUT-000094',
        executionOrderNo: 'CPO-20260319-H',
        operatorName: 'Adi Saputra',
        sourceRecordId: 'handover-seed-000094',
      }),
      targetLabel: '缝制首工序待接驳位',
      note: '已完成待交接样例',
    },
    {
      ...createSeedBase({
        writebackId: 'PDA-HANDOVER-SEED-000103',
        actionType: 'PDA_CUT_PIECE_HANDOVER_CONFIRM',
        submittedAt: '2026-03-28 20:32:00',
        taskId: 'TASK-CUT-000103',
        executionOrderNo: 'CPO-20260324-E1',
        operatorName: 'Factory F004',
        sourceRecordId: 'handover-seed-000103',
      }),
      targetLabel: '异地车缝承接位',
      note: '已完工并已交接',
    },
  ]

  const replenishmentFeedbackWritebacks: PdaReplenishmentFeedbackWritebackRecord[] = [
    {
      ...createSeedBase({
        writebackId: 'PDA-REPLENISH-SEED-000092',
        actionType: 'PDA_REPLENISHMENT_FEEDBACK_SUBMIT',
        submittedAt: '2026-03-28 14:18:00',
        taskId: 'TASK-CUT-000092',
        executionOrderNo: 'CPO-20260319-F',
        operatorName: 'Putra Aji',
        sourceRecordId: 'replenishment-seed-000092',
      }),
      reasonLabel: '门幅不足需补主布',
      note: '已反馈补料诉求，待工艺工厂确认。',
      photoProofCount: 2,
      lifecycleStatus: 'PENDING',
      lifecycleStatusLabel: '待处理',
    },
    {
      ...createSeedBase({
        writebackId: 'PDA-REPLENISH-SEED-000095',
        actionType: 'PDA_REPLENISHMENT_FEEDBACK_SUBMIT',
        submittedAt: '2026-03-28 12:20:00',
        taskId: 'TASK-CUT-000095',
        executionOrderNo: 'CPO-20260319-I',
        operatorName: '现场领料员',
        sourceRecordId: 'replenishment-seed-000095',
      }),
      reasonLabel: '主布面料短缺待补',
      note: '已提交补料反馈并附差异举证。',
      photoProofCount: 3,
      lifecycleStatus: 'SUBMITTED',
      lifecycleStatusLabel: '已反馈',
    },
    {
      ...createSeedBase({
        writebackId: 'PDA-REPLENISH-SEED-000093',
        actionType: 'PDA_REPLENISHMENT_FEEDBACK_SUBMIT',
        submittedAt: '2026-03-28 16:00:00',
        taskId: 'TASK-CUT-000093',
        executionOrderNo: 'CPO-20260319-G',
        operatorName: 'Nia Prasetyo',
        sourceRecordId: 'replenishment-seed-000093',
      }),
      reasonLabel: '辅料补齐已关闭',
      note: '补料闭环完成，仅保留历史记录。',
      photoProofCount: 1,
      lifecycleStatus: 'CLOSED',
      lifecycleStatusLabel: '已关闭',
    },
    {
      ...createSeedBase({
        writebackId: 'PDA-REPLENISH-SEED-000100',
        actionType: 'PDA_REPLENISHMENT_FEEDBACK_SUBMIT',
        submittedAt: '2026-03-28 13:05:00',
        taskId: 'TASK-CUT-000100',
        executionOrderNo: 'CPO-20260324-B1',
        operatorName: 'Rina Putri',
        sourceRecordId: 'replenishment-seed-000100',
      }),
      reasonLabel: '辅布补齐待仓确认',
      note: '已反馈辅布补料，等待仓库处理。',
      photoProofCount: 1,
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

export function listPdaPickupWritebacksByOriginalCutOrderNo(
  originalCutOrderNo: string,
  storage?: Pick<Storage, 'getItem'>,
): PdaPickupWritebackRecord[] {
  return listPdaPickupWritebacks(storage).filter((item) => item.originalCutOrderNo === originalCutOrderNo)
}

export function getLatestPdaPickupWritebackByOriginalCutOrderNo(
  originalCutOrderNo: string,
  storage?: Pick<Storage, 'getItem'>,
): PdaPickupWritebackRecord | null {
  return listPdaPickupWritebacksByOriginalCutOrderNo(originalCutOrderNo, storage)[0] ?? null
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
