// 工程主单 LocalStorage 仓库：主单及任务骨架的唯一事实源。
// 任务骨架在发布时一次性生成，依赖只从固定策略复制，不提供任何更新依赖的接口。

import { getEngineeringTaskDefinition, resolveInitialTaskStatus } from './pcs-engineering-dependency-policy.ts'
import { assertFirstFormalProduction } from './pcs-engineering-first-production-policy.ts'
import {
  getStyleArchiveById,
  findStyleArchiveByCode,
} from './pcs-style-archive-repository.ts'
import type {
  EngineeringMasterOrderRecord,
  EngineeringMasterOrderSnapshot,
  EngineeringTaskRecord,
} from './pcs-engineering-master-types.ts'

const ENGINEERING_MASTER_STORAGE_KEY = 'higood-pcs-engineering-master-store-v1'
const ENGINEERING_MASTER_STORE_VERSION = 1

let memorySnapshot: EngineeringMasterOrderSnapshot | null = null

function canUseStorage(): boolean {
  return (
    typeof localStorage !== 'undefined' &&
    typeof localStorage.getItem === 'function' &&
    typeof localStorage.setItem === 'function' &&
    typeof localStorage.removeItem === 'function'
  )
}

function nowText(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

function cloneTask(task: EngineeringTaskRecord): EngineeringTaskRecord {
  return {
    ...task,
    dependsOnTaskIds: [...task.dependsOnTaskIds],
    materialLines: task.materialLines.map((line) => ({ ...line })),
    reworkRounds: task.reworkRounds.map((round) => ({ ...round })),
  }
}

function cloneRecord(record: EngineeringMasterOrderRecord): EngineeringMasterOrderRecord {
  return {
    ...record,
    tasks: record.tasks.map(cloneTask),
    priorResultReuseLines: record.priorResultReuseLines.map((line) => ({ ...line })),
  }
}

function cloneSnapshot(snapshot: EngineeringMasterOrderSnapshot): EngineeringMasterOrderSnapshot {
  return {
    version: snapshot.version,
    records: snapshot.records.map(cloneRecord),
  }
}

function seedSnapshot(): EngineeringMasterOrderSnapshot {
  return { version: ENGINEERING_MASTER_STORE_VERSION, records: [] }
}

function readSnapshot(): EngineeringMasterOrderSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)
  if (!canUseStorage()) {
    memorySnapshot = seedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }
  try {
    const raw = localStorage.getItem(ENGINEERING_MASTER_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as EngineeringMasterOrderSnapshot
      if (parsed && Array.isArray(parsed.records)) {
        memorySnapshot = {
          version: ENGINEERING_MASTER_STORE_VERSION,
          records: parsed.records.map(normalizeRecord),
        }
        return cloneSnapshot(memorySnapshot)
      }
    }
  } catch {
    // 存储损坏时回退到空种子
  }
  memorySnapshot = seedSnapshot()
  return cloneSnapshot(memorySnapshot)
}

function normalizeRecord(record: EngineeringMasterOrderRecord): EngineeringMasterOrderRecord {
  return cloneRecord({
    ...record,
    tasks: Array.isArray(record.tasks) ? record.tasks : [],
    priorResultReuseLines: Array.isArray(record.priorResultReuseLines) ? record.priorResultReuseLines : [],
  })
}

function writeSnapshot(snapshot: EngineeringMasterOrderSnapshot): void {
  memorySnapshot = cloneSnapshot(snapshot)
  if (!canUseStorage()) return
  try {
    localStorage.setItem(ENGINEERING_MASTER_STORAGE_KEY, JSON.stringify(memorySnapshot))
  } catch {
    // 原型环境存储不可用时仅保留内存态
  }
}

function nextMasterOrderCode(records: EngineeringMasterOrderRecord[]): string {
  let maxSeq = 0
  for (const record of records) {
    const match = /^EM-(\d+)$/.exec(record.masterOrderCode)
    if (match) maxSeq = Math.max(maxSeq, Number(match[1]))
  }
  return `EM-${String(maxSeq + 1).padStart(3, '0')}`
}

function resolveStyleArchive(styleId: string, styleCode: string) {
  const byId = getStyleArchiveById(styleId)
  if (byId) return byId
  const byCode = findStyleArchiveByCode(styleCode)
  if (byCode) return byCode
  return null
}

export interface CreateEngineeringMasterOrderInput {
  styleId: string
  styleCode: string
  merchandiserName: string
  createdBy?: string
}

export function createEngineeringMasterOrder(input: CreateEngineeringMasterOrderInput): EngineeringMasterOrderRecord {
  const snapshot = readSnapshot()

  // 无商品／款式档案：禁止创建工程主单。
  const style = resolveStyleArchive(input.styleId, input.styleCode)
  if (!style) {
    throw new Error('无商品／款式档案，禁止创建工程主单。请先创建商品／款式档案。')
  }

  // 首次工程准备：已正式生产过的款式禁止创建工程主单。
  assertFirstFormalProduction(input.styleCode)

  // 同一款式只允许存在一张未关闭的工程主单。
  const hasOpenMaster = snapshot.records.some(
    (record) =>
      record.styleId === style.styleId && record.status !== '已关闭' && record.status !== '已终止',
  )
  if (hasOpenMaster) {
    throw new Error('该款式已存在未关闭的工程主单，禁止重复创建。')
  }

  const record: EngineeringMasterOrderRecord = {
    masterOrderId: `EM-${Date.now().toString(36)}-${String(snapshot.records.length + 1).padStart(3, '0')}`,
    masterOrderCode: nextMasterOrderCode(snapshot.records),
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    status: '草稿',
    merchandiserName: input.merchandiserName,
    tasks: [],
    priorResultReuseLines: [],
    createdAt: nowText(),
    createdBy: input.createdBy ?? '跟单',
    publishedAt: '',
    closedAt: '',
    terminatedAt: '',
    terminateReason: '',
  }

  snapshot.records.push(record)
  writeSnapshot(snapshot)
  return cloneRecord(record)
}

// 发布主单：一次性生成完整任务骨架，后续不得另起一套同类型任务结构。
export function publishEngineeringMasterOrder(masterOrderId: string): EngineeringMasterOrderRecord {
  const snapshot = readSnapshot()
  const record = snapshot.records.find((item) => item.masterOrderId === masterOrderId)
  if (!record) throw new Error(`工程主单不存在：${masterOrderId}`)
  if (record.status !== '草稿') throw new Error('仅草稿状态的工程主单可以发布。')

  const tasks: EngineeringTaskRecord[] = []
  for (const taskType of [
    'BASE_PATTERN_WOVEN',
    'BASE_PATTERN_KNIT',
    'PRE_PRODUCTION_SAMPLE',
    'SIZE_PATTERN_WOVEN',
    'SIZE_PATTERN_KNIT',
    'PATTERN_ARTWORK',
    'COLOR_YARN',
    'COLOR_FABRIC',
    'ACCESSORY_PURCHASE',
    'TECH_PACK_CONFIRMATION',
  ] as const) {
    const definition = getEngineeringTaskDefinition(taskType)
    tasks.push({
      taskId: `${masterOrderId}-${taskType}`,
      masterOrderId,
      taskType,
      taskName: definition.taskName,
      status: resolveInitialTaskStatus(taskType),
      dependsOnTaskIds: definition.dependsOn.map((dependency) => `${masterOrderId}-${dependency}`),
      ownerTeamName: definition.ownerTeamName,
      materialLines: [],
      reworkRounds: [],
      startedAt: '',
      submittedAt: '',
      firstCompletedAt: '',
      effectiveCompletedAt: '',
    })
  }

  record.tasks = tasks
  record.status = '已发布'
  record.publishedAt = nowText()
  writeSnapshot(snapshot)
  return cloneRecord(record)
}

export function listEngineeringMasterOrders(): EngineeringMasterOrderRecord[] {
  return readSnapshot().records.map(cloneRecord)
}

export function getEngineeringMasterOrderById(masterOrderId: string): EngineeringMasterOrderRecord | null {
  const record = readSnapshot().records.find((item) => item.masterOrderId === masterOrderId)
  return record ? cloneRecord(record) : null
}

export function resetEngineeringMasterRepository(): void {
  memorySnapshot = seedSnapshot()
  if (!canUseStorage()) return
  try {
    localStorage.removeItem(ENGINEERING_MASTER_STORAGE_KEY)
  } catch {
    // 忽略存储不可用
  }
}
