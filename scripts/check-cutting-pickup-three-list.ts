#!/usr/bin/env node

import {
  createProductionMaterialPrepSeedStore,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore,
} from '../src/data/fcs/cutting/production-material-prep.ts'
import {
  listPickupOrderGroups,
  type PickupListKind,
  type PickupOrderGroup,
} from '../src/pages/process-factory/cutting/pickup-management-projection.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>()

  get length(): number {
    return this.values.size
  }

  clear(): void {
    this.values.clear()
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

function assertGroupContract(group: PickupOrderGroup, listKind: PickupListKind): void {
  assert(group.listKind === listKind, `${group.productionOrderNo} 列表类型必须与查询类型一致`)
  assert(group.materialRows.length > 0, `${group.productionOrderNo} 必须直接携带物料需求行`)
}

const storage = new MemoryStorage()
storage.setItem(
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()),
)

for (const listKind of ['READY', 'INCOMPLETE', 'HISTORY'] as const) {
  const groups = listPickupOrderGroups(listKind, storage)
  assert(groups.length > 0, `${listKind} 列表必须有基础投影数据`)
  assert(
    new Set(groups.map((group) => group.productionOrderId)).size === groups.length,
    `${listKind} 列表内 productionOrderId 必须唯一`,
  )
  groups.forEach((group) => assertGroupContract(group, listKind))
}

console.log('裁床领料三列表投影契约检查通过')
