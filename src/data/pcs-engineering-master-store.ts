// 工程主单与工程变更的底层权威存储。
// 领域仓储负责业务校验；技术包仅通过只读查询读取同一份快照。

import type {
  EngineeringChangeTaskRecord,
  EngineeringMasterOrderRecord,
  EngineeringMasterOrderSnapshot,
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

function cloneSnapshot(snapshot: EngineeringMasterOrderSnapshot): EngineeringMasterOrderSnapshot {
  return structuredClone(snapshot)
}

function emptySnapshot(): EngineeringMasterOrderSnapshot {
  return { version: ENGINEERING_MASTER_STORE_VERSION, records: [], changeTasks: [] }
}

export function readEngineeringMasterStoreSnapshot(): EngineeringMasterOrderSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)
  if (!canUseStorage()) {
    memorySnapshot = emptySnapshot()
    return cloneSnapshot(memorySnapshot)
  }
  try {
    const raw = localStorage.getItem(ENGINEERING_MASTER_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as EngineeringMasterOrderSnapshot
      if (parsed && Array.isArray(parsed.records)) {
        memorySnapshot = {
          version: ENGINEERING_MASTER_STORE_VERSION,
          records: parsed.records,
          changeTasks: Array.isArray(parsed.changeTasks) ? parsed.changeTasks : [],
        }
        return cloneSnapshot(memorySnapshot)
      }
    }
  } catch {
    // 存储损坏时回退到空种子。
  }
  memorySnapshot = emptySnapshot()
  return cloneSnapshot(memorySnapshot)
}

export function writeEngineeringMasterStoreSnapshot(snapshot: EngineeringMasterOrderSnapshot): void {
  memorySnapshot = cloneSnapshot(snapshot)
  if (!canUseStorage()) return
  try {
    localStorage.setItem(ENGINEERING_MASTER_STORAGE_KEY, JSON.stringify(memorySnapshot))
  } catch {
    // 原型环境存储不可用时仅保留内存态。
  }
}

export function resetEngineeringMasterStoreSnapshot(): void {
  memorySnapshot = emptySnapshot()
  if (!canUseStorage()) return
  try {
    localStorage.removeItem(ENGINEERING_MASTER_STORAGE_KEY)
  } catch {
    // 忽略存储不可用。
  }
}

export function getAuthoritativeEngineeringMasterOrder(
  masterOrderId: string,
): EngineeringMasterOrderRecord | null {
  const record = readEngineeringMasterStoreSnapshot().records.find((item) => item.masterOrderId === masterOrderId)
  return record ? structuredClone(record) : null
}

export function getAuthoritativeEngineeringChangeTask(
  engineeringChangeTaskId: string,
): EngineeringChangeTaskRecord | null {
  const record = (readEngineeringMasterStoreSnapshot().changeTasks || []).find(
    (item) => item.engineeringChangeTaskId === engineeringChangeTaskId,
  )
  return record ? structuredClone(record) : null
}
