#!/usr/bin/env node

import {
  appendPickupReturnRecord,
  appendPickupSessionFromNode,
  createProductionMaterialPrepSeedStore,
  getMaterialPrepRecordContext,
  listActivePickupNodes,
  listPickupReturnRecords,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore,
} from '../src/data/fcs/cutting/production-material-prep.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function assertThrows(action: () => unknown, message: string): void {
  try {
    action()
  } catch {
    return
  }
  throw new Error(message)
}

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }

  removeItem(key: string): void {
    this.values.delete(key)
  }
}

const legacyStorage = new MemoryStorage()
const legacyStore = createProductionMaterialPrepSeedStore() as { pickupReturnRecords?: unknown }
delete legacyStore.pickupReturnRecords
legacyStorage.setItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, JSON.stringify(legacyStore))
assert(listPickupReturnRecords(legacyStorage).length > 0, '旧 localStorage 缺少退回记录字段时必须补齐 seed 退回记录')

const storage = new MemoryStorage()
storage.setItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()))
const initialReturnCount = listPickupReturnRecords(storage).length

const nodes = listActivePickupNodes(storage)
const node = nodes.find((n) => n.nodeType === 'READY_TO_PICKUP')
assert(node, '必须存在已配齐待领节点用于领料')
assert(node.items.length > 0, '节点必须包含可领物料明细')

const session = appendPickupSessionFromNode({
  pickupNodeId: node.nodeId,
  pickupNodeVersion: node.version,
  receiverName: '裁床 李明',
  warehouseArea: '裁床待加工仓 A 区',
  locationCode: 'CUT-A-001',
  waitProcessLedgerEventId: 'wait-process:test:return',
}, storage)
assert(session.pickupRecordIds.length === node.items.length, '领料主记录必须包含节点全部物料明细')

const firstItem = node.items[0]
const context = getMaterialPrepRecordContext(firstItem.sourcePrepRecordIds[0], firstItem.prepLineId, storage)
assert(context?.record.recordStatus === 'CONFIRMED', '领料后配料记录仍必须保持已确认')

const pickupRecord = context.projection.pickupRecords.find((record) =>
  record.prepLineId === firstItem.prepLineId && record.pickupSessionId === session.pickupSessionId,
)
assert(pickupRecord, '必须生成领料明细记录')

assertThrows(() => appendPickupReturnRecord({
  pickupRecordId: pickupRecord.pickupRecordId,
  prepRecordId: firstItem.sourcePrepRecordIds[0],
  prepLineId: `${firstItem.prepLineId}:wrong`,
  returnQty: 1,
  rollCount: 1,
  reason: '布面瑕疵',
  remark: '错误行归属',
  imageNames: [],
  returnedBy: '裁床 李明',
}, storage), '传错 prepLineId 时必须拒绝退回')

const returnRecord = appendPickupReturnRecord({
  pickupRecordId: pickupRecord.pickupRecordId,
  prepRecordId: firstItem.sourcePrepRecordIds[0],
  prepLineId: firstItem.prepLineId,
  returnQty: 10,
  rollCount: 1,
  reason: '布面瑕疵',
  remark: '开工前验布发现破洞',
  imageNames: [],
  returnedBy: '裁床 李明',
}, storage)

assert(returnRecord.returnStatus === '已退回待中转仓处理', '退回后只进入待中转仓处理状态')
assert(listPickupReturnRecords(storage).length === initialReturnCount + 1, '必须保存退回记录')

const returnedContext = getMaterialPrepRecordContext(firstItem.sourcePrepRecordIds[0], firstItem.prepLineId, storage)
assert(returnedContext?.record.recordStatus === 'CONFIRMED', '退回不能改写配料记录状态')
const returnedPickup = returnedContext.projection.pickupRecords.find((record) => record.pickupRecordId === pickupRecord.pickupRecordId)
assert(returnedPickup?.returnStatus === '部分退回', '部分退回后领料记录必须派生为部分退回')
assert(returnedPickup.returnQty === 10, '已退数量必须等于退回数量')
assert(returnedPickup.waitProcessAvailableQty === Number(returnedPickup.pickedQty || 0) - 10, '待加工仓剩余数量必须扣减退回数量')

assert(!listActivePickupNodes(storage).some((n) => n.nodeId === node.nodeId), '已确认节点不应再出现在活动节点中')

assertThrows(() => appendPickupReturnRecord({
  pickupRecordId: pickupRecord.pickupRecordId,
  prepRecordId: firstItem.sourcePrepRecordIds[0],
  prepLineId: firstItem.prepLineId,
  returnQty: Number(returnedPickup.waitProcessAvailableQty || 0) + 1,
  rollCount: 1,
  reason: '数量不符',
  remark: '超额退回',
  imageNames: [],
  returnedBy: '裁床 李明',
}, storage), '超额退回应抛错')

appendPickupReturnRecord({
  pickupRecordId: pickupRecord.pickupRecordId,
  prepRecordId: firstItem.sourcePrepRecordIds[0],
  prepLineId: firstItem.prepLineId,
  returnQty: Number(returnedPickup.waitProcessAvailableQty || 0),
  rollCount: 1,
  reason: '数量不符',
  remark: '',
  imageNames: [],
  returnedBy: '裁床 李明',
}, storage)

const fullyReturnedContext = getMaterialPrepRecordContext(firstItem.sourcePrepRecordIds[0], firstItem.prepLineId, storage)
const fullyReturnedPickup = fullyReturnedContext?.projection.pickupRecords.find((record) => record.pickupRecordId === pickupRecord.pickupRecordId)
assert(fullyReturnedPickup?.returnStatus === '全部退回', '全部退完后领料记录必须派生为全部退回')
assert(fullyReturnedPickup.waitProcessAvailableQty === 0, '全部退回后待加工仓剩余数量必须为 0')

console.log('裁床物料退回中转仓检查通过')
