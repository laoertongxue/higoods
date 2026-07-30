#!/usr/bin/env node

import {
  createProductionMaterialPrepSeedStore,
  listActivePickupNodes,
  listMaterialPrepOrderProjections,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore,
  type MaterialPrepOrderProjection,
} from '../src/data/fcs/cutting/production-material-prep.ts'
import {
  derivePickupHistoryPath,
  listPickupOrderGroups,
  type PickupListKind,
  type PickupMaterialDemandRow,
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

function roundQty(value: number): number {
  return Number(Number(value || 0).toFixed(2))
}

function assertMaterialRowFacts(
  group: PickupOrderGroup,
  projection: MaterialPrepOrderProjection,
  materialRow: PickupMaterialDemandRow,
): void {
  const projectionLine = projection.lines.find((line) => line.prepLineId === materialRow.demandLineId)
  assert(projectionLine, `${group.productionOrderNo} 正常需求行必须以 prepLineId 作为 demandLineId`)
  assert(materialRow.demandSource === 'NORMAL', `${materialRow.demandLineId} 当前必须是正常需求`)
  assert(materialRow.requiredQty === projectionLine.requiredQty, `${materialRow.demandLineId} 需求数量必须来自配料投影行`)
  const effectivePickedQty = roundQty(Math.max(projectionLine.pickedQty - projectionLine.returnedQty, 0))
  assert(materialRow.pickedQty === effectivePickedQty, `${materialRow.demandLineId} 已领数量必须扣除退回数量`)
  assert(
    materialRow.remainingPickupQty === roundQty(Math.max(materialRow.requiredQty - materialRow.pickedQty, 0)),
    `${materialRow.demandLineId} 待领数量必须按逐需求行计算`,
  )
}

const storage = new MemoryStorage()
storage.setItem(
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()),
)

const projections = listMaterialPrepOrderProjections(storage)
const activeNodes = listActivePickupNodes(storage)
const groupsByKind = new Map<PickupListKind, PickupOrderGroup[]>()

for (const listKind of ['READY', 'INCOMPLETE', 'HISTORY'] as const) {
  const groups = listPickupOrderGroups(listKind, storage)
  assert(groups.length > 0, `${listKind} 列表必须有基础投影数据`)
  assert(
    new Set(groups.map((group) => group.productionOrderId)).size === groups.length,
    `${listKind} 列表内 productionOrderId 必须唯一`,
  )
  groups.forEach((group) => assertGroupContract(group, listKind))
  groupsByKind.set(listKind, groups)
}

const readyGroups = groupsByKind.get('READY') ?? []
for (const group of readyGroups) {
  const node = activeNodes.find((candidate) => candidate.nodeId === group.pickupNodeId)
  assert(node?.nodeType === 'READY_TO_PICKUP', `${group.productionOrderNo} READY 分组必须来自已配齐活动节点`)
  assert(group.carrierType === 'PALLET', `${group.productionOrderNo} READY 分组必须使用托盘载体`)
  assert(group.readySource === null, `${group.productionOrderNo} 没有明确前一节点类型时不得推测 READY 来源`)
  assert(
    group.materialRows.every((materialRow) => materialRow.currentLocations.length === 0),
    `${group.productionOrderNo} READY 托盘分组不得同时输出当前库位`,
  )
}

const incompleteGroups = groupsByKind.get('INCOMPLETE') ?? []
for (const group of incompleteGroups) {
  const node = activeNodes.find((candidate) => candidate.nodeId === group.pickupNodeId)
  assert(node?.nodeType === 'INCOMPLETE_PICKABLE', `${group.productionOrderNo} INCOMPLETE 分组必须来自未配齐活动节点`)
  assert(group.carrierType === 'WAREHOUSE_LOCATIONS', `${group.productionOrderNo} INCOMPLETE 分组必须使用库位载体`)
  assert(
    group.materialRows.some((materialRow) => materialRow.currentLocations.length > 0),
    `${group.productionOrderNo} INCOMPLETE 分组必须保留当前来源库位`,
  )
}

for (const groups of groupsByKind.values()) {
  for (const group of groups) {
    const projection = projections.find((candidate) => candidate.order.prepOrderId === group.prepOrderId)
    assert(projection, `${group.productionOrderNo} 必须能找到对应生产单配料投影`)
    assert(
      group.materialRows.length === projection.lines.length,
      `${group.productionOrderNo} 正常需求行不得按 SKU 或单位合并`,
    )
    assert(
      new Set(group.materialRows.map((materialRow) => materialRow.demandLineId)).size === projection.lines.length,
      `${group.productionOrderNo} 每个 prepLineId 必须只输出一条需求行`,
    )
    group.materialRows.forEach((materialRow) => assertMaterialRowFacts(group, projection, materialRow))
  }
}

const historyGroups = groupsByKind.get('HISTORY') ?? []
assert(
  derivePickupHistoryPath(['READY_TO_PICKUP', 'INCOMPLETE_PICKABLE']) === 'INCOMPLETE_PICKUP',
  '混合领料会话只要出现未配齐领取，历史路径必须是未配齐领取',
)
assert(
  derivePickupHistoryPath(['READY_TO_PICKUP', 'READY_TO_PICKUP']) === 'READY_PICKUP',
  '只有全部领料会话均来自已配齐节点，历史路径才是已配齐领取',
)
for (const group of historyGroups) {
  const sessions = projections
    .filter((projection) => projection.order.productionOrderId === group.productionOrderId)
    .flatMap((projection) => projection.pickupSessions)
  assert(sessions.length > 0, `${group.productionOrderNo} HISTORY 分组必须有领料会话`)
  const allPicked = group.materialRows.every((materialRow) => materialRow.pickedQty >= materialRow.requiredQty)
  assert(
    group.finalResult === (allPicked ? 'ALL_PICKED' : 'NOT_ALL_PICKED'),
    `${group.productionOrderNo} finalResult 必须按全部需求行基础判断`,
  )
}
const mixedSessionProjection = projections.find((projection) =>
  new Set(projection.pickupSessions.map((session) => session.nodeType)).size > 1
)
assert(mixedSessionProjection, '种子数据必须保留同一生产单混合节点类型的领料会话')
assert(
  historyGroups.find((group) => group.productionOrderId === mixedSessionProjection.order.productionOrderId)?.historyPath
    === 'INCOMPLETE_PICKUP',
  `${mixedSessionProjection.order.productionOrderNo} 混合会话历史路径必须是未配齐领取`,
)

console.log(JSON.stringify({
  READY: '节点分类、托盘载体、空库位与未知 readySource 已覆盖',
  INCOMPLETE: '节点分类、库位载体与来源位置已覆盖',
  MATERIAL_ROWS: 'prepLineId、需求数量、有效已领与待领数量已覆盖',
  HISTORY: '全会话路径规则与逐需求行最终结果已覆盖',
}, null, 2))
