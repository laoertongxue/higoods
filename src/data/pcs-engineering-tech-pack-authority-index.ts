// 工程技术包来源只读索引：由工程主单仓库同步，供技术包仓库校验来源身份。
// 该索引不创建或修改业务对象，工程主单仓库仍是工程主单与工程变更的唯一事实源。

import type {
  EngineeringChangeTaskRecord,
  EngineeringMasterOrderRecord,
} from './pcs-engineering-master-types.ts'

const masterOrders = new Map<string, EngineeringMasterOrderRecord>()
const changeTasks = new Map<string, EngineeringChangeTaskRecord>()

export function indexEngineeringMasterOrder(record: EngineeringMasterOrderRecord): void {
  masterOrders.set(record.masterOrderId, structuredClone(record))
}

export function indexEngineeringChangeTask(record: EngineeringChangeTaskRecord): void {
  changeTasks.set(record.engineeringChangeTaskId, { ...record })
}

export function getIndexedEngineeringMasterOrder(masterOrderId: string): EngineeringMasterOrderRecord | null {
  const record = masterOrders.get(masterOrderId)
  return record ? structuredClone(record) : null
}

export function getIndexedEngineeringChangeTask(changeTaskId: string): EngineeringChangeTaskRecord | null {
  const record = changeTasks.get(changeTaskId)
  return record ? { ...record } : null
}

export function replaceEngineeringTechPackAuthorityIndex(
  masters: EngineeringMasterOrderRecord[],
  changes: EngineeringChangeTaskRecord[],
): void {
  masterOrders.clear()
  changeTasks.clear()
  masters.forEach(indexEngineeringMasterOrder)
  changes.forEach(indexEngineeringChangeTask)
}
