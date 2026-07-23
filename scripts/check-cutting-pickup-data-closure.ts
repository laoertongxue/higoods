#!/usr/bin/env node

import {
  appendManualPrepRecord,
  appendPickupSessionFromNode,
  confirmMaterialPrepRecord,
  createProductionMaterialPrepSeedStore,
  getMaterialPrepOrderProjection,
  getMaterialPrepRecordContext,
  hydrateProductionMaterialPrepStore,
  listActivePickupNodes,
  pickMaterialPrepRecord,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  recordPickupSessionWarehouseSyncResult,
  serializeProductionMaterialPrepStore,
  stageMaterialPrepRecord,
} from '../src/data/fcs/cutting/production-material-prep.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

class MemoryStorage {
  private readonly values = new Map<string, string>()

  getItem(key: string): string | null {
    return this.values.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value)
  }
}

const storage = new MemoryStorage()
storage.setItem(
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()),
)

function addConfirmedMaterial(input: {
  prepOrderId: string
  prepLineId: string
  preparedQty: number
  rollCount: number
  locationCode: string
}) {
  const draft = appendManualPrepRecord({
    ...input,
    warehouseArea: '中转仓测试区',
    operatorName: '中转仓 测试员',
  }, storage)
  assert(draft.recordStatus === 'DRAFT', '新增物料必须先生成 DRAFT 配料记录')
  assert(pickMaterialPrepRecord(draft.prepRecordId, '仓库 拣货员', storage)?.recordStatus === 'PICKED', '配料记录必须先完成拣货')
  assert(stageMaterialPrepRecord(draft.prepRecordId, '中转仓测试区', '跟单 暂存员', storage)?.recordStatus === 'STAGED', '配料记录必须先进入暂存区')
  const confirmed = confirmMaterialPrepRecord(draft.prepRecordId, '中转仓 确认员', storage)
  assert(confirmed?.recordStatus === 'CONFIRMED', '只有 STAGED 配料记录才能确认')
  return confirmed
}

const initialNodes = listActivePickupNodes(storage)
assert(initialNodes.length > 0, '种子数据必须存在活动待领节点')
assert(new Set(initialNodes.map((node) => node.prepOrderId)).size === initialNodes.length, '同一配料单最多只能有一个活动节点')
const initialNode = initialNodes.find((node) => node.nodeType === 'INCOMPLETE_PICKABLE') || initialNodes[0]
const initialItem = initialNode.items[0]
assert(initialItem, '活动节点必须有物料明细')

const stableRead = listActivePickupNodes(storage).find((node) => node.nodeId === initialNode.nodeId)
assert(stableRead?.version === initialNode.version, '物料事实不变时节点版本必须稳定')
assert(stableRead?.updatedAt === initialNode.updatedAt, '物料事实不变时节点更新时间必须稳定')

const added = addConfirmedMaterial({
  prepOrderId: initialNode.prepOrderId,
  prepLineId: initialItem.prepLineId,
  preparedQty: 1,
  rollCount: 1,
  locationCode: 'TR-TEST-NEW-01',
})
const mergedNode = listActivePickupNodes(storage).find((node) => node.prepOrderId === initialNode.prepOrderId)
assert(mergedNode, '新增确认物料后必须仍有活动节点')
assert(mergedNode.nodeId === initialNode.nodeId, '未领取前后续物料必须并入同一节点')
assert(mergedNode.sequence === initialNode.sequence, '未领取前节点序号不得变化')
assert(mergedNode.version === initialNode.version + 1, '节点物料事实变化后版本必须严格递增')
assert(mergedNode.locationPolicy === 'KEEP_CURRENT_LOCATION', '未领取前归并物料必须保留当前承载位置')
const mergedItem = mergedNode.items.find((item) => item.prepLineId === initialItem.prepLineId)
assert(
  mergedNode.updatedAt === added.confirmedAt,
  `节点更新时间必须来自最新确认业务记录：节点 ${mergedNode.updatedAt} / 配料确认 ${added.confirmedAt}`,
)
assert(mergedItem?.sourcePrepRecordIds.includes(added.prepRecordId), '节点必须保留当前可领物料的来源配料记录')
const sourceLocations = (mergedItem as typeof mergedItem & {
  sourceLocations?: Array<{ sourceLocationCode: string; currentAvailableQty: number; rollCount: number }>
})?.sourceLocations
assert(
  sourceLocations?.some((location) => location.sourceLocationCode === 'TR-TEST-NEW-01'),
  `节点必须保留全部当前来源货位：${JSON.stringify(sourceLocations)}`,
)

let staleSnapshotRejected = false
try {
  appendPickupSessionFromNode({
    pickupNodeId: initialNode.nodeId,
    pickupNodeVersion: initialNode.version,
    receiverName: '裁床 领料员',
    warehouseArea: '待加工仓 A 区',
    locationCode: 'FAB-A-09',
    waitProcessLedgerEventId: 'check-stale-node',
    idempotencyKey: 'check-stale-node',
  }, storage)
} catch (error) {
  staleSnapshotRejected = (error as Error).message.includes('当前待领物料已更新')
}
assert(staleSnapshotRejected, '新增物料后必须拒绝旧版本节点确认')

const beforePickupStore = hydrateProductionMaterialPrepStore(storage)
const session = appendPickupSessionFromNode({
  pickupNodeId: mergedNode.nodeId,
  pickupNodeVersion: mergedNode.version,
  receiverName: '裁床 领料员',
  warehouseArea: '待加工仓 A 区',
  locationCode: 'FAB-A-09',
  waitProcessLedgerEventId: 'check-current-node',
  idempotencyKey: 'check-current-node',
}, storage)
const afterPickupStore = hydrateProductionMaterialPrepStore(storage)
assert(afterPickupStore.pickupSessions.length === beforePickupStore.pickupSessions.length + 1, '一次确认必须原子新增一条领料主记录')
assert(afterPickupStore.pickupRecords.length === beforePickupStore.pickupRecords.length + mergedNode.items.length, '一次确认必须为节点全部物料生成 N 条领料明细')
assert(session.pickupRecordIds.length === mergedNode.items.length, '领料主记录必须关联节点全部明细')
for (const item of mergedNode.items) {
  const detail = afterPickupStore.pickupRecords.find((record) =>
    record.pickupSessionId === session.pickupSessionId && record.prepLineId === item.prepLineId
  )
  assert(detail?.pickedQty === item.currentAvailableQty, `${item.materialSku} 必须领取当前节点全部数量`)
  assert(detail?.rollCount === item.rollCount, `${item.materialSku} 必须领取当前节点全部卷件数`)
}
const mergedDetail = afterPickupStore.pickupRecords.find((record) =>
  record.pickupSessionId === session.pickupSessionId &&
  record.prepLineId === mergedItem!.prepLineId
)
assert(mergedDetail?.sourceAllocations?.length === mergedItem!.sourceAllocations.length, '领料明细必须保留全部来源配料记录分摊')
assert(
  mergedDetail.sourceAllocations.reduce((sum, allocation) => sum + allocation.pickedQty, 0) === mergedDetail.pickedQty,
  '来源配料记录分摊数量之和必须等于领料明细数量',
)
assert(
  mergedDetail.sourceAllocations.reduce((sum, allocation) => sum + allocation.rollCount, 0) === mergedDetail.rollCount,
  '来源配料记录分摊卷数之和必须等于领料明细卷数',
)
assert(
  mergedDetail.sourceAllocations.every((allocation) =>
    allocation.sourceLocationCode &&
    allocation.unit === mergedItem!.unit
  ),
  '每条来源分摊必须保留自己的货位和单位',
)
for (const sourcePrepRecordId of mergedItem!.sourcePrepRecordIds) {
  const sourceContext = getMaterialPrepRecordContext(
    sourcePrepRecordId,
    mergedItem!.prepLineId,
    storage,
  )
  assert(sourceContext, `来源配料记录必须可追溯：${sourcePrepRecordId}`)
  assert(
    sourceContext.pickedQty === sourceContext.item.preparedQty,
    `合并领料后必须准确扣减来源配料记录：${sourcePrepRecordId}，已领 ${sourceContext.pickedQty} / 配料 ${sourceContext.item.preparedQty}`,
  )
  assert(
    sourceContext.availableToPickupQty === 0,
    `合并领料后来源配料记录不得继续显示可领：${sourcePrepRecordId}`,
  )
}

const duplicate = appendPickupSessionFromNode({
  pickupNodeId: mergedNode.nodeId,
  pickupNodeVersion: mergedNode.version,
  receiverName: '裁床 领料员',
  warehouseArea: '待加工仓 A 区',
  locationCode: 'FAB-A-09',
  waitProcessLedgerEventId: 'check-current-node-retry',
  idempotencyKey: 'check-current-node',
}, storage)
assert(duplicate.pickupSessionId === session.pickupSessionId, '重复幂等键必须返回原领料主记录')
const afterDuplicateStore = hydrateProductionMaterialPrepStore(storage)
assert(afterDuplicateStore.pickupSessions.length === afterPickupStore.pickupSessions.length, '重复确认不得新增领料主记录')
assert(afterDuplicateStore.pickupRecords.length === afterPickupStore.pickupRecords.length, '重复确认不得新增领料明细')

recordPickupSessionWarehouseSyncResult(session.pickupSessionId, {
  status: '回写异常待重试',
  message: '模拟网络异常',
}, storage)
recordPickupSessionWarehouseSyncResult(session.pickupSessionId, { status: '已回写' }, storage)
const afterSyncRetryStore = hydrateProductionMaterialPrepStore(storage)
assert(afterSyncRetryStore.pickupSessions.length === afterPickupStore.pickupSessions.length, '仓储同步重试不得新增领料主记录')
assert(afterSyncRetryStore.pickupRecords.length === afterPickupStore.pickupRecords.length, '仓储同步重试不得新增领料明细')
assert(afterSyncRetryStore.pickupSessions.find((item) => item.pickupSessionId === session.pickupSessionId)?.warehouseSyncStatus === '已回写', '仓储同步重试只应更新同步结果')

const afterFirstPickup = getMaterialPrepOrderProjection(initialNode.prepOrderId, storage)
assert(afterFirstPickup, '领料后配料单必须持续有效')
const stillMissingLine = afterFirstPickup.lines.find((line) =>
  line.returnedQty === 0 &&
  Math.max(line.requiredQty - Math.max(line.pickedQty - line.returnedQty, 0), 0) > 1
)
assert(stillMissingLine, '测试配料单必须保留未配齐物料行')
addConfirmedMaterial({
  prepOrderId: initialNode.prepOrderId,
  prepLineId: stillMissingLine.prepLineId,
  preparedQty: 1,
  rollCount: 1,
  locationCode: 'TR-TEST-NEXT-01',
})
const nextIncompleteNode = listActivePickupNodes(storage).find((node) => node.prepOrderId === initialNode.prepOrderId)
assert(nextIncompleteNode?.sequence === initialNode.sequence + 1, '上一节点领取后，新到物料必须创建下一序号节点')
assert(nextIncompleteNode.nodeType === 'INCOMPLETE_PICKABLE', '累计仍不齐时必须创建未配齐可领节点')
assert(
  nextIncompleteNode.items.every((item) =>
    item.sourceLocations.every((location) => location.sourceLocationCode === 'TR-TEST-NEXT-01')
  ),
  '新节点来源货位不得混入上一轮已经领走的历史货位',
)
assert(
  nextIncompleteNode.items.reduce((sum, item) => sum + item.rollCount, 0) === 1,
  '新节点卷件数不得混入上一轮已经领走的历史卷件数',
)
let crossNodeIdempotencyConflict = false
try {
  appendPickupSessionFromNode({
    pickupNodeId: nextIncompleteNode.nodeId,
    pickupNodeVersion: nextIncompleteNode.version,
    receiverName: '裁床 领料员',
    warehouseArea: '待加工仓 A 区',
    locationCode: 'FAB-A-09',
    waitProcessLedgerEventId: 'check-cross-node-idempotency',
    idempotencyKey: 'check-current-node',
  }, storage)
} catch (error) {
  crossNodeIdempotencyConflict = (error as Error).message.includes('幂等键')
}
assert(crossNodeIdempotencyConflict, '同一幂等键不得跨待领节点返回旧领料主记录')
appendPickupSessionFromNode({
  pickupNodeId: nextIncompleteNode.nodeId,
  pickupNodeVersion: nextIncompleteNode.version,
  receiverName: '裁床 领料员',
  warehouseArea: '待加工仓 A 区',
  locationCode: 'FAB-A-09',
  waitProcessLedgerEventId: 'check-next-incomplete',
  idempotencyKey: 'check-next-incomplete',
}, storage)

const beforeClosingNode = getMaterialPrepOrderProjection(initialNode.prepOrderId, storage)
assert(beforeClosingNode, '第二轮领料后配料单必须持续有效')
for (const line of beforeClosingNode.lines) {
  const effectivePickedQty = Math.max(line.pickedQty - line.returnedQty, 0)
  const shortageQty = Math.max(line.requiredQty - effectivePickedQty, 0)
  if (shortageQty <= 0) continue
  addConfirmedMaterial({
    prepOrderId: initialNode.prepOrderId,
    prepLineId: line.prepLineId,
    preparedQty: shortageQty,
    rollCount: 1,
    locationCode: `TR-READY-${line.prepLineId.slice(-6)}`,
  })
}
const closingNode = listActivePickupNodes(storage).find((node) => node.prepOrderId === initialNode.prepOrderId)
assert(closingNode?.sequence === initialNode.sequence + 2, '收尾到货必须创建下一序号节点')
assert(closingNode.nodeType === 'READY_TO_PICKUP', '历史有效已领加当前可领逐行齐套时必须直接生成已配齐待领节点')
assert(closingNode.locationPolicy === 'DIRECT_READY_AREA', '收尾齐套节点不得进入未配齐货架')

const prepOrderIds = new Set(
  listActivePickupNodes(storage).map((node) => node.prepOrderId),
)
assert(prepOrderIds.size === listActivePickupNodes(storage).length, '任何时刻每张配料单最多一个活动节点')

console.log('裁床待领节点数据闭环检查通过')
