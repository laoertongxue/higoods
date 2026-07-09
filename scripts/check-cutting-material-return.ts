#!/usr/bin/env node

import {
  appendPickupRecordFromPrepRecord,
  appendPickupReturnRecord,
  createProductionMaterialPrepSeedStore,
  getMaterialPrepRecordContext,
  listPickupCandidates,
  listPickupReturnRecords,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
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
assert(listPickupReturnRecords(legacyStorage).length === 0, '旧 localStorage 缺少退回记录字段时必须返回空数组')

const storage = new MemoryStorage()
storage.setItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, JSON.stringify(createProductionMaterialPrepSeedStore()))

const candidate = listPickupCandidates(storage).find((item) => item.prepRecordId === 'prep-rec-po-0007-main-001')
assert(candidate, '必须存在可领料配料记录')
const line = candidate.items[0]
assert(line, '必须存在可退回物料行')

appendPickupRecordFromPrepRecord({
  prepRecordId: candidate.prepRecordId,
  prepLineId: line.prepLineId,
  pickedQty: line.availableToPickupQty,
  rollCount: line.rollCount,
  receiverName: '裁床 李明',
  warehouseArea: '裁床待加工仓 A 区',
  locationCode: 'CUT-A-001',
  waitProcessLedgerEventId: 'wait-process:test:return',
}, storage)

const pickedContext = getMaterialPrepRecordContext(candidate.prepRecordId, line.prepLineId, storage)
assert(pickedContext?.record.recordStatus === 'CONFIRMED', '领料后配料记录仍必须保持已确认')
assert(pickedContext.availableToPickupQty === 0, '已全部领料后不可重复领')

const pickupRecord = pickedContext.projection.pickupRecords.find((record) => record.prepLineId === line.prepLineId)
assert(pickupRecord, '必须生成领料记录')

assertThrows(() => appendPickupReturnRecord({
  pickupRecordId: pickupRecord.pickupRecordId,
  prepRecordId: candidate.prepRecordId,
  prepLineId: `${line.prepLineId}:wrong`,
  returnQty: 1,
  rollCount: 1,
  reason: '布面瑕疵',
  remark: '错误行归属',
  imageNames: [],
  returnedBy: '裁床 李明',
}, storage), '传错 prepLineId 时必须拒绝退回')

const returnRecord = appendPickupReturnRecord({
  pickupRecordId: pickupRecord.pickupRecordId,
  prepRecordId: candidate.prepRecordId,
  prepLineId: line.prepLineId,
  returnQty: 10,
  rollCount: 1,
  reason: '布面瑕疵',
  remark: '开工前验布发现破洞',
  imageNames: [],
  returnedBy: '裁床 李明',
}, storage)

assert(returnRecord.returnStatus === '已退回待中转仓处理', '退回后只进入待中转仓处理状态')
assert(listPickupReturnRecords(storage).length === 1, '必须保存退回记录')

const returnedContext = getMaterialPrepRecordContext(candidate.prepRecordId, line.prepLineId, storage)
assert(returnedContext?.record.recordStatus === 'CONFIRMED', '退回不能改写配料记录状态')
const returnedPickup = returnedContext.projection.pickupRecords.find((record) => record.pickupRecordId === pickupRecord.pickupRecordId)
assert(returnedPickup?.returnStatus === '部分退回', '部分退回后领料记录必须派生为部分退回')
assert(returnedPickup.returnQty === 10, '已退数量必须等于退回数量')
assert(returnedPickup.waitProcessAvailableQty === Number(returnedPickup.pickedQty || 0) - 10, '待加工仓剩余数量必须扣减退回数量')
assert(!listPickupCandidates(storage).some((item) => item.prepRecordId === candidate.prepRecordId), '配料/领料模块内不自动生成仓储处理后的补领候选')

assertThrows(() => appendPickupReturnRecord({
  pickupRecordId: pickupRecord.pickupRecordId,
  prepRecordId: candidate.prepRecordId,
  prepLineId: line.prepLineId,
  returnQty: returnedPickup.waitProcessAvailableQty + 1,
  rollCount: 1,
  reason: '数量不符',
  remark: '超额退回',
  imageNames: [],
  returnedBy: '裁床 李明',
}, storage), '超额退回应抛错')

appendPickupReturnRecord({
  pickupRecordId: pickupRecord.pickupRecordId,
  prepRecordId: candidate.prepRecordId,
  prepLineId: line.prepLineId,
  returnQty: returnedPickup.waitProcessAvailableQty,
  rollCount: 1,
  reason: '数量不符',
  remark: '',
  imageNames: [],
  returnedBy: '裁床 李明',
}, storage)

const fullyReturnedContext = getMaterialPrepRecordContext(candidate.prepRecordId, line.prepLineId, storage)
const fullyReturnedPickup = fullyReturnedContext?.projection.pickupRecords.find((record) => record.pickupRecordId === pickupRecord.pickupRecordId)
assert(fullyReturnedPickup?.returnStatus === '全部退回', '全部退完后领料记录必须派生为全部退回')
assert(fullyReturnedPickup.waitProcessAvailableQty === 0, '全部退回后待加工仓剩余数量必须为 0')

console.log('裁床物料退回中转仓检查通过')
