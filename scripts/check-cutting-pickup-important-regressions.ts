#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import {
  appendManualPrepRecord,
  appendPickupReturnRecord,
  confirmMaterialPrepRecord,
  createProductionMaterialPrepSeedStore,
  deserializeProductionMaterialPrepStore,
  getMaterialPrepOrderProjection,
  hydrateProductionMaterialPrepStore,
  listMaterialPrepOrderProjections,
  migrateProductionMaterialPrepStoreToPickupThreeListScenes,
  pickMaterialPrepRecord,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore,
  stageMaterialPrepRecord,
  type MaterialPrepRecord,
  type PickupRecord,
  type ProductionMaterialPrepWorkflowStore,
} from '../src/data/fcs/cutting/production-material-prep.ts'
import {
  appendPickupSessionFromNodeRuntime as appendPickupSessionFromNode,
  bootstrapPickupManagementRuntimeMockData,
  listActivePickupNodesRuntime as listActivePickupNodes,
} from '../src/runtime/fcs/cutting/pickup-management-runtime.ts'
import { renderFcsCuttingPrepPage } from '../src/pages/fcs/material-prep/cutting.ts'
import { listPickupOrderGroups } from '../src/pages/process-factory/cutting/pickup-management-projection.ts'

bootstrapPickupManagementRuntimeMockData()

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

function createStorage(store: ProductionMaterialPrepWorkflowStore): MemoryStorage {
  const storage = new MemoryStorage()
  storage.setItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, serializeProductionMaterialPrepStore(store))
  return storage
}

function verifyPickupThreeListSceneStoreMigration(): void {
  const legacyStore = createProductionMaterialPrepSeedStore()
  const removedPrepRecordIds = new Set([
    'prep-rec-po-0002-original-complete-001',
    'prep-rec-po-0002-new-supplement-001',
    'prep-rec-po-0004-supplement-demo-current-001',
    'prep-rec-po-202603-1103-auto-complete-001',
  ])
  legacyStore.prepRecords = legacyStore.prepRecords.filter((record) =>
    !removedPrepRecordIds.has(record.prepRecordId)
  )
  legacyStore.pickupRecords = legacyStore.pickupRecords.filter((record) =>
    record.prepOrderId !== 'prep-order-po-202603-0002'
      && record.prepOrderId !== 'prep-order-po-202603-1103'
  )
  legacyStore.pickupSessions = legacyStore.pickupSessions.filter((session) =>
    session.prepOrderId !== 'prep-order-po-202603-0002'
      && session.prepOrderId !== 'prep-order-po-202603-1103'
  )
  legacyStore.pickupNodeSnapshots = []
  legacyStore.pickupReturnRecords = []
  const customPrepRecord = {
    ...legacyStore.prepRecords[0],
    prepRecordId: 'custom-prep-record-must-survive-three-list-migration',
    remark: '用户自行维护的非 seed 配料事实',
  }
  legacyStore.prepRecords.push(customPrepRecord)

  const migrated = deserializeProductionMaterialPrepStore(serializeProductionMaterialPrepStore(legacyStore))
  assert(
    migrated.prepRecords.some((record) => record.prepRecordId === customPrepRecord.prepRecordId && record.remark === customPrepRecord.remark),
    '三列表场景迁移不得覆盖或丢失用户自行维护的非 seed 配料事实',
  )
  for (const prepRecordId of removedPrepRecordIds) {
    assert(migrated.prepRecords.some((record) => record.prepRecordId === prepRecordId), `旧 Store 必须补齐配料场景：${prepRecordId}`)
  }
  assert(
    migrated.pickupRecords.some((record) => record.prepOrderId === 'prep-order-po-202603-0002')
      && migrated.pickupRecords.some((record) => record.prepOrderId === 'prep-order-po-202603-1103'),
    '旧 Store 必须补齐 PO0002 与 PO1103 的 seed 领料事实',
  )
  assert(
    migrated.pickupSessions.some((session) =>
      session.prepOrderId === 'prep-order-po-202603-0002'
        && session.nodeType === 'READY_TO_PICKUP'
        && session.pickupNodeSnapshot?.nodeType === 'READY_TO_PICKUP'
    ),
    '旧 Store 必须补齐 PO0002 原需求已领完的 READY 会话与节点快照',
  )
  assert(
    migrated.pickupNodeSnapshots.some((snapshot) =>
      snapshot.nodeId === 'pickup-node:prep-order-po-202603-1103:2'
        && snapshot.nodeType === 'INCOMPLETE_PICKABLE'
        && snapshot.version === 1
    ),
    '旧 Store 必须补齐 PO1103 升级前 INCOMPLETE 快照',
  )
  assert(
    new Set(migrated.prepRecords.map((record) => record.prepRecordId)).size === migrated.prepRecords.length
      && new Set(migrated.pickupRecords.map((record) => record.pickupRecordId)).size === migrated.pickupRecords.length
      && new Set(migrated.pickupSessions.map((session) => session.pickupSessionId)).size === migrated.pickupSessions.length
      && new Set(migrated.pickupReturnRecords.map((record) => record.returnRecordId)).size === migrated.pickupReturnRecords.length
      && new Set(migrated.pickupNodeSnapshots.map((snapshot) => snapshot.nodeId)).size === migrated.pickupNodeSnapshots.length,
    '三列表场景迁移按稳定 ID 幂等合并，不得重复记录',
  )

  const storage = createStorage(migrated)
  const upgradedNode = listActivePickupNodes(storage).find((node) =>
    node.prepOrderId === 'prep-order-po-202603-1103'
  )
  assert(
    upgradedNode?.nodeType === 'INCOMPLETE_PICKABLE'
      && upgradedNode.version === 2
      && upgradedNode.readySource === null,
    '旧 Store 迁移后 PO1103 必须形成 V2 节点，并由未完成染色继续阻断配齐',
  )
  const po0002History = listPickupOrderGroups('HISTORY', storage as Storage).find((group) =>
    group.productionOrderNo === 'PO-202603-0002'
  )
  const po0002Current = listPickupOrderGroups('READY', storage as Storage).find((group) =>
    group.productionOrderNo === 'PO-202603-0002'
  )
  assert(po0002History?.finalResult === 'NEW_SUPPLEMENT_WAIT_PICKUP', '旧 Store 迁移后 PO0002 历史必须标记新增补料待领')
  assert(po0002Current?.pickupNodeId === 'pickup-node:prep-order-po-202603-0002:9', '旧 Store 迁移后 PO0002 当前待领节点必须正确')

  const migratedOnce = hydrateProductionMaterialPrepStore(storage)
  const migratedTwice = deserializeProductionMaterialPrepStore(serializeProductionMaterialPrepStore(migratedOnce))
  const migratedThrice = deserializeProductionMaterialPrepStore(serializeProductionMaterialPrepStore(migratedTwice))
  assert(
    serializeProductionMaterialPrepStore(migratedTwice) === serializeProductionMaterialPrepStore(migratedThrice),
    '三列表场景迁移二次执行结果必须完全不变',
  )
  const directlyMigratedOnce = migrateProductionMaterialPrepStoreToPickupThreeListScenes(migratedTwice)
  const directlyMigratedTwice = migrateProductionMaterialPrepStoreToPickupThreeListScenes(directlyMigratedOnce)
  assert(
    serializeProductionMaterialPrepStore(directlyMigratedOnce) === serializeProductionMaterialPrepStore(directlyMigratedTwice),
    '三列表场景迁移函数直接二次执行结果必须完全不变',
  )
}

function verifyLegacyPickupSessionMigration(): void {
  const legacyStore = createProductionMaterialPrepSeedStore()
  const groupedRecords = legacyStore.pickupRecords
    .filter((record) => record.prepOrderId === 'prep-order-po-202603-0101')
    .slice(0, 2)
  assert(groupedRecords.length === 2, '旧存储测试必须存在两条同单领料明细')
  groupedRecords.forEach((record) => {
    record.pickupSessionId = 'pickup-session:legacy-grouped'
    record.pickupNodeId = 'pickup-node:prep-order-po-202603-0101:1'
  })
  legacyStore.pickupRecords
    .filter((record) => !groupedRecords.includes(record))
    .forEach((record) => {
      delete record.pickupSessionId
      delete record.pickupNodeId
    })
  legacyStore.pickupSessions = []
  legacyStore.pickupNodeSnapshots = []

  const storage = createStorage(legacyStore)
  const migrated = hydrateProductionMaterialPrepStore(storage)
  const groupedSession = migrated.pickupSessions.find((session) =>
    session.pickupSessionId === 'pickup-session:legacy-grouped'
  )
  assert(groupedSession, '旧领料明细已有 pickupSessionId 时必须补建历史领料主记录')
  assert(
    groupedRecords.every((record) => groupedSession.pickupRecordIds.includes(record.pickupRecordId)),
    '同一旧 pickupSessionId 的明细必须归入同一历史领料主记录',
  )

  const noSessionRecord = migrated.pickupRecords.find((record) =>
    record.pickedQty > 0 && !record.pickupSessionId
  )
  assert(!noSessionRecord, '旧明细没有 pickupSessionId 时必须按稳定业务组合归入迁移主记录')
  const migratedAgain = hydrateProductionMaterialPrepStore(
    createStorage(migrated),
  )
  assert(
    JSON.stringify(migratedAgain.pickupSessions) === JSON.stringify(migrated.pickupSessions),
    '历史领料主记录迁移必须幂等且 ID 稳定',
  )

  const projection = getMaterialPrepOrderProjection('prep-order-po-202603-0101', storage)
  assert(projection?.pickupSessions.some((session) => session.pickupSessionId === groupedSession.pickupSessionId), '迁移后的历史领料主记录必须在配料单投影可见')
  const activeNode = listActivePickupNodes(storage).find((node) =>
    node.prepOrderId === 'prep-order-po-202603-0101'
  )
  assert(activeNode, '有退回或后续可领物料时必须恢复活动节点')
  assert(
    activeNode.sequence === (projection?.pickupSessions.length || 0) + 1,
    '新活动节点序号必须接续迁移后的历史领料主记录',
  )

  const closingStore = createProductionMaterialPrepSeedStore()
  const closingOrderId = 'prep-order-po-202603-0004'
  const closingProjection = getMaterialPrepOrderProjection(closingOrderId, createStorage(closingStore))
  assert(closingProjection, '历史收尾轮测试必须存在配料单投影')
  const firstRoundRecords: PickupRecord[] = []
  const closingRoundRecords: PickupRecord[] = []
  closingProjection.lines.forEach((line, index) => {
    const firstRoundQty = Math.floor(line.requiredQty / 2)
    const closingRoundQty = line.requiredQty - firstRoundQty
    firstRoundRecords.push({
      pickupRecordId: `check-legacy-closing-01-${index + 1}`,
      prepRecordId: `legacy-closing-source-01-${index + 1}`,
      prepOrderId: closingOrderId,
      prepLineId: line.prepLineId,
      productionOrderId: closingProjection.productionOrderId,
      pickedQty: firstRoundQty,
      rollCount: 1,
      receiverName: '裁床 历史领料员',
      pickedAt: '2026-03-16 08:00',
      warehouseArea: '待加工仓历史区',
      locationCode: 'LEGACY-CUT-01',
      waitProcessLedgerEventId: `legacy-closing-event-01:${line.prepLineId}`,
      differenceQty: 0,
      differenceReason: '',
      pickupStatus: '已入待加工仓',
      remark: '',
    })
    closingRoundRecords.push({
      pickupRecordId: `check-legacy-closing-02-${index + 1}`,
      prepRecordId: `legacy-closing-source-02-${index + 1}`,
      prepOrderId: closingOrderId,
      prepLineId: line.prepLineId,
      productionOrderId: closingProjection.productionOrderId,
      pickedQty: closingRoundQty,
      rollCount: 1,
      receiverName: '裁床 历史领料员',
      pickedAt: '2026-03-17 08:00',
      warehouseArea: '待加工仓历史区',
      locationCode: 'LEGACY-CUT-01',
      waitProcessLedgerEventId: `legacy-closing-event-02:${line.prepLineId}`,
      differenceQty: 0,
      differenceReason: '',
      pickupStatus: '已入待加工仓',
      remark: '',
    })
  })
  closingStore.pickupRecords = [
    ...firstRoundRecords,
    ...closingRoundRecords,
    ...closingStore.pickupRecords.filter((record) => record.prepOrderId !== closingOrderId),
  ]
  closingStore.pickupSessions = closingStore.pickupSessions.filter((session) =>
    session.prepOrderId !== closingOrderId
  )
  const closingMigration = hydrateProductionMaterialPrepStore(createStorage(closingStore))
  const closingSessions = closingMigration.pickupSessions
    .filter((session) => session.prepOrderId === closingOrderId)
    .sort((left, right) => left.pickedAt.localeCompare(right.pickedAt))
  assert(closingSessions.length === 2, '历史两轮领料必须迁移为两条主记录')
  assert(closingSessions[0].nodeType === 'INCOMPLETE_PICKABLE', '历史首轮累计未齐必须标记未配齐可领')
  assert(closingSessions[1].nodeType === 'READY_TO_PICKUP', '历史收尾轮累计逐行齐套必须标记已配齐待领')

  const uncertainStore = createProductionMaterialPrepSeedStore()
  uncertainStore.pickupRecords.unshift({
    pickupRecordId: 'check-legacy-uncertain-01',
    prepRecordId: 'legacy-uncertain-source-01',
    prepOrderId: 'legacy-unknown-prep-order',
    prepLineId: 'legacy-unknown-prep-line',
    productionOrderId: 'legacy-unknown-production-order',
    pickedQty: 10,
    rollCount: 1,
    receiverName: '裁床 历史领料员',
    pickedAt: '2026-03-18 08:00',
    warehouseArea: '待加工仓历史区',
    locationCode: 'LEGACY-CUT-02',
    waitProcessLedgerEventId: 'legacy-uncertain-event-01',
    differenceQty: 0,
    differenceReason: '',
    pickupStatus: '已入待加工仓',
    remark: '',
  })
  const uncertainMigration = hydrateProductionMaterialPrepStore(createStorage(uncertainStore))
  const uncertainSession = uncertainMigration.pickupSessions.find((session) =>
    session.prepOrderId === 'legacy-unknown-prep-order'
  )
  assert(uncertainSession?.nodeType === 'INCOMPLETE_PICKABLE', '历史事实不足时必须保守标记未配齐可领')
  assert(uncertainSession.migrationEvidence === '旧事实不足，保守按未配齐', '历史事实不足时必须保留迁移判定依据')
}

function verifySourceAccurateReturnRecovery(): void {
  const store = createProductionMaterialPrepSeedStore()
  const prepOrderId = 'prep-order-po-202603-0004'
  const prepLineId = 'prep-line-po-0004-main'
  // This regression owns a synthetic PO0004 source set. Neutralize evolving
  // demo seed facts first so hydration cannot merge them back into this fixture.
  store.prepRecords = store.prepRecords.map((record) => record.prepOrderId === prepOrderId
    ? {
        ...record,
        preparedQty: 0,
        rollCount: 0,
        recordStatus: 'REJECTED',
        items: record.items?.map((item) => ({ ...item, preparedQty: 0, rollCount: 0 })),
      }
    : record)
  store.pickupRecords = store.pickupRecords.map((record) => record.prepOrderId === prepOrderId
    ? { ...record, pickedQty: 0, rollCount: 0, sourceAllocations: [] }
    : record)
  store.pickupReturnRecords = store.pickupReturnRecords.map((record) => record.prepOrderId === prepOrderId
    ? { ...record, returnQty: 0, rollCount: 0 }
    : record)
  const recordA: MaterialPrepRecord = {
    prepRecordId: 'check-source-record-a',
    prepOrderId,
    prepLineId,
    batchNo: 'CHECK-SOURCE-A',
    preparedQty: 100,
    rollCount: 2,
    warehouseArea: '中转仓测试区',
    locationCode: 'SRC-A',
    operatorName: '中转仓 测试员',
    preparedAt: '2026-07-23 09:00',
    recordStatus: 'CONFIRMED',
    confirmedAt: '2026-07-23 09:05',
    confirmedBy: '中转仓 测试员',
    rejectedAt: '',
    rejectedBy: '',
    rejectReason: '',
    sourceStockEventId: 'check-source-a',
    remark: '',
  }
  const recordB: MaterialPrepRecord = {
    ...recordA,
    prepRecordId: 'check-source-record-b',
    batchNo: 'CHECK-SOURCE-B',
    rollCount: 3,
    locationCode: 'SRC-B',
    preparedAt: '2026-07-23 10:00',
    confirmedAt: '2026-07-23 10:05',
    sourceStockEventId: 'check-source-b',
  }
  const pickupA: PickupRecord = {
    pickupRecordId: 'check-pickup-source-a',
    prepRecordId: recordA.prepRecordId,
    prepOrderId,
    prepLineId,
    productionOrderId: 'PO-202603-0004',
    pickedQty: 100,
    rollCount: 2,
    receiverName: '裁床 测试员',
    pickedAt: '2026-07-23 09:30',
    warehouseArea: '待加工仓测试区',
    locationCode: 'CUT-A',
    waitProcessLedgerEventId: 'check-event-a',
    differenceQty: 0,
    differenceReason: '',
    pickupStatus: '已入待加工仓',
    remark: '',
    sourceAllocations: [{
      prepRecordId: recordA.prepRecordId,
      prepLineId,
      pickedQty: 100,
      rollCount: 2,
      unit: 'yard',
      sourceWarehouseName: '中转仓',
      sourceWarehouseArea: '中转仓测试区',
      sourceLocationCode: 'SRC-A',
    }],
  }
  const pickupB: PickupRecord = {
    ...pickupA,
    pickupRecordId: 'check-pickup-source-b',
    prepRecordId: recordA.prepRecordId,
    pickedAt: '2026-07-23 10:30',
    waitProcessLedgerEventId: 'check-event-b',
    sourceAllocations: [{
      ...pickupA.sourceAllocations![0],
      prepRecordId: recordB.prepRecordId,
      rollCount: 3,
      sourceLocationCode: 'SRC-B',
    }],
  }
  store.prepRecords = [recordA, recordB, ...store.prepRecords]
  store.pickupRecords = [pickupA, pickupB, ...store.pickupRecords]
  store.pickupSessions = []
  store.pickupNodeSnapshots = []
  const storage = createStorage(store)

  const returned = appendPickupReturnRecord({
    pickupRecordId: pickupB.pickupRecordId,
    prepRecordId: recordB.prepRecordId,
    prepLineId,
    returnQty: 40,
    rollCount: 1,
    reason: '数量不符',
    remark: '第二来源合法退回',
    imageNames: [],
    returnedBy: '裁床 测试员',
  }, storage)
  assert(returned.prepRecordId === recordB.prepRecordId, '公开退回 API 必须允许退回 sourceAllocations 中的第二来源')

  let sourceQtyExceeded = false
  try {
    appendPickupReturnRecord({
      pickupRecordId: pickupB.pickupRecordId,
      prepRecordId: recordB.prepRecordId,
      prepLineId,
      returnQty: 61,
      rollCount: 1,
      reason: '数量不符',
      remark: '',
      imageNames: [],
      returnedBy: '裁床 测试员',
    }, storage)
  } catch (error) {
    sourceQtyExceeded = (error as Error).message.includes('来源可退数量')
  }
  assert(sourceQtyExceeded, '第二来源累计退回数量超过该来源 allocation 时必须阻断')

  let sourceRollExceeded = false
  try {
    appendPickupReturnRecord({
      pickupRecordId: pickupB.pickupRecordId,
      prepRecordId: recordB.prepRecordId,
      prepLineId,
      returnQty: 10,
      rollCount: 3,
      reason: '数量不符',
      remark: '',
      imageNames: [],
      returnedBy: '裁床 测试员',
    }, storage)
  } catch (error) {
    sourceRollExceeded = (error as Error).message.includes('来源可退卷件数')
  }
  assert(sourceRollExceeded, '第二来源累计退回卷件数超过该来源 allocation 时必须阻断')

  const node = listActivePickupNodes(storage).find((item) => item.prepOrderId === prepOrderId)
  const item = node?.items.find((candidate) => candidate.prepLineId === prepLineId)
  assert(item, '退回后必须恢复对应物料的活动节点')
  assert(item.currentAvailableQty === 40, `退回后应恢复 40 yard，实际 ${item.currentAvailableQty}`)
  assert(item.rollCount === 1, `退回后应恢复原事实中的 1 卷，实际 ${item.rollCount}`)
  assert(item.sourceLocations.length === 1, '退回第二来源后不得错误恢复第一来源货位')
  assert(item.sourceLocations[0].sourceLocationCode === 'SRC-B', `应恢复第二来源 SRC-B，实际 ${item.sourceLocations[0].sourceLocationCode}`)

  const legacyStore = createProductionMaterialPrepSeedStore()
  const legacyPickup = { ...pickupA }
  delete legacyPickup.sourceAllocations
  legacyStore.prepRecords = [recordA, ...legacyStore.prepRecords]
  legacyStore.pickupRecords = [{
    ...legacyPickup,
    pickupRecordId: 'check-pickup-legacy-without-allocation',
    waitProcessLedgerEventId: 'check-event-legacy-without-allocation',
  }, ...legacyStore.pickupRecords]
  const legacyStorage = createStorage(legacyStore)
  const legacyReturn = appendPickupReturnRecord({
    pickupRecordId: 'check-pickup-legacy-without-allocation',
    prepRecordId: recordA.prepRecordId,
    prepLineId,
    returnQty: 10,
    rollCount: 1,
    reason: '数量不符',
    remark: '验证无来源分摊旧记录兼容',
    imageNames: [],
    returnedBy: '裁床 测试员',
  }, legacyStorage)
  assert(legacyReturn.returnQty === 10, '没有 sourceAllocations 的旧领料记录必须继续兼容原退回口径')
}

function verifyHistoryUsesCurrentActiveCarrier(): void {
  const storage = createStorage(createProductionMaterialPrepSeedStore())
  const incompleteNode = listActivePickupNodes(storage)
    .find((node) => node.nodeType === 'INCOMPLETE_PICKABLE')
  assert(incompleteNode, '混合历史测试必须存在未配齐活动节点')
  const existingSessionCount = getMaterialPrepOrderProjection(incompleteNode.prepOrderId, storage)
    ?.pickupSessions.length ?? 0

  appendPickupSessionFromNode({
    pickupNodeId: incompleteNode.nodeId,
    pickupNodeVersion: incompleteNode.version,
    receiverName: '裁床 历史混合测试员',
    warehouseArea: '待加工仓测试区',
    locationCode: 'CUT-HISTORY-MIXED-01',
    waitProcessLedgerEventId: 'check-history-mixed-incomplete-pickup',
    idempotencyKey: 'check-history-mixed-incomplete-pickup',
  }, storage)

  const projectionAfterFirstPickup = listMaterialPrepOrderProjections(storage)
    .find((projection) => projection.order.prepOrderId === incompleteNode.prepOrderId)
  assert(projectionAfterFirstPickup, '未配齐领取后必须保留配料单投影')
  for (const [index, line] of projectionAfterFirstPickup.lines.entries()) {
    if (line.remainingNeedQty <= 0) continue
    const record = appendManualPrepRecord({
      prepOrderId: projectionAfterFirstPickup.order.prepOrderId,
      prepLineId: line.prepLineId,
      preparedQty: line.remainingNeedQty,
      rollCount: 1,
      warehouseArea: '中转仓历史混合测试区',
      locationCode: `TR-HISTORY-MIXED-${String(index + 1).padStart(3, '0')}`,
      operatorName: '中转仓 历史混合测试员',
    }, storage)
    assert(pickMaterialPrepRecord(record.prepRecordId, '仓库 历史混合测试员', storage), '历史混合测试配料记录必须完成拣货')
    assert(stageMaterialPrepRecord(record.prepRecordId, '中转仓历史混合测试区', '跟单 历史混合测试员', storage), '历史混合测试配料记录必须完成暂存')
    assert(confirmMaterialPrepRecord(record.prepRecordId, '中转仓 历史混合测试员', storage), '历史混合测试配料记录必须完成确认')
  }

  const activeCurrentNode = listActivePickupNodes(storage)
    .find((node) => node.prepOrderId === incompleteNode.prepOrderId)
  assert(activeCurrentNode?.nodeType === 'INCOMPLETE_PICKABLE', '必需加工未完成时，补齐正常配料后仍必须形成当前未配齐节点')
  const historyGroup = listPickupOrderGroups('HISTORY', storage as Storage)
    .find((group) => group.prepOrderId === incompleteNode.prepOrderId)
  assert(historyGroup, '未配齐领取一轮后必须保留历史分组')
  assert(historyGroup.historyPath === 'INCOMPLETE_PICKUP', '历史路径必须继续保留首轮未配齐领取事实')
  assert(
    historyGroup.pickupSessionCount === existingSessionCount + 1,
    '历史分组必须保留新增的未配齐领料会话',
  )
  assert(historyGroup.carrierType === activeCurrentNode.carrierType, '历史分组当前承载必须与当前活动节点一致')
  assert(historyGroup.carrierType === 'WAREHOUSE_LOCATIONS', '加工阻断的当前节点必须继续显示生产单专属库位')
  assert(historyGroup.palletId === '', '未配齐节点不得虚构托盘编号')
  assert(historyGroup.palletDisplayLabel === '', '未配齐节点不得显示待领托盘')
  assert(historyGroup.readySource === activeCurrentNode.readySource, '历史分组当前配齐来源必须与当前活动节点一致')
  assert(
    historyGroup.materialRows.some((row) => row.currentLocations.length > 0),
    '历史分组存在当前未配齐节点时必须显示当前专属库位',
  )
}

function verifyMixedUnitPrepRecords(): void {
  const store = createProductionMaterialPrepSeedStore()
  const mixedRecord = store.prepRecords.find((record) => record.prepRecordId === 'prep-rec-po-0101-mixed-002')
  assert(mixedRecord, '必须存在 yard + 粒真实混合配料记录')
  const stagedRecord: MaterialPrepRecord = {
    ...mixedRecord,
    prepRecordId: 'check-mixed-unit-staging',
    batchNo: 'CHECK-MIXED-STAGING',
    recordStatus: 'PICKED',
    confirmedAt: '',
    confirmedBy: '',
    items: mixedRecord.items?.map((item, index) => ({
      ...item,
      prepRecordItemId: `check-mixed-unit-staging:${index + 1}`,
    })),
  }
  store.prepRecords = [stagedRecord, ...store.prepRecords]
  const storage = createStorage(store)

  const hydrated = hydrateProductionMaterialPrepStore(storage)
  const hydratedMixed = hydrated.prepRecords.find((record) => record.prepRecordId === mixedRecord.prepRecordId) as MaterialPrepRecord & {
    unitSummaries?: Array<{ unit: string; preparedQty: number; rollCount: number }>
  }
  assert(hydratedMixed.unitSummaries?.length === 2, '混合配料记录必须生成按单位汇总')
  assert(hydratedMixed.preparedQty === null, '混合配料记录旧无量纲总量必须置空')
  assert(
    hydratedMixed.unitSummaries.some((summary) => summary.unit === 'yard' && summary.preparedQty === 100)
      && hydratedMixed.unitSummaries.some((summary) => summary.unit === '粒' && summary.preparedQty === 60),
    `混合配料记录单位汇总错误：${JSON.stringify(hydratedMixed.unitSummaries)}`,
  )

  assert(stageMaterialPrepRecord(stagedRecord.prepRecordId, '混合单位暂存区', '跟单 测试员', storage), '混合单位配料记录必须可进入暂存')
  const staged = hydrateProductionMaterialPrepStore(storage).stagingRecords.find((record) =>
    record.prepRecordId === stagedRecord.prepRecordId
  ) as ProductionMaterialPrepWorkflowStore['stagingRecords'][number] & {
    unitSummaries?: Array<{ unit: string; preparedQty: number; rollCount: number }>
  }
  assert(staged?.unitSummaries?.length === 2, '暂存记录必须保留按单位汇总')
  assert(staged.totalPreparedQty === null, '多单位暂存记录旧无量纲总量必须置空')

  const originalWindow = (globalThis as typeof globalThis & { window?: unknown }).window
  const originalStorage = (globalThis as typeof globalThis & { localStorage?: unknown }).localStorage
  ;(globalThis as typeof globalThis & { localStorage: unknown }).localStorage = storage
  ;(globalThis as typeof globalThis & { window: unknown }).window = {
    location: {
      pathname: '/fcs/material-prep/cutting',
      search: '?prepOrderId=prep-order-po-202603-0101&detailTab=records',
    },
    localStorage: storage,
    history: { pushState() {}, replaceState() {} },
    addEventListener() {},
    removeEventListener() {},
  }
  try {
    const html = renderFcsCuttingPrepPage()
    const card = html.match(/<article[^>]*>[\s\S]*?BATCH-MIX-260316-02[\s\S]*?<\/article>/)?.[0] || ''
    assert(card, '混合配料记录卡片必须可见')
    assert(card.includes('100 yard') && card.includes('60 粒'), '混合配料记录卡片必须按 yard / 粒分组展示')
    assert(!card.includes('160 yard'), '混合配料记录不得把 100 yard + 60 粒显示为 160 yard')
  } finally {
    if (originalWindow === undefined) delete (globalThis as typeof globalThis & { window?: unknown }).window
    else (globalThis as typeof globalThis & { window: unknown }).window = originalWindow
    if (originalStorage === undefined) delete (globalThis as typeof globalThis & { localStorage?: unknown }).localStorage
    else (globalThis as typeof globalThis & { localStorage: unknown }).localStorage = originalStorage
  }

  const cuttingSource = fs.readFileSync(
    path.join(process.cwd(), 'src/pages/fcs/material-prep/cutting.ts'),
    'utf8',
  )
  assert(!cuttingSource.includes('formatRollQty(record.preparedQty, record.rollCount)'), '裁片配料记录卡片不得继续格式化旧无量纲总量')
  const domainSource = fs.readFileSync(
    path.join(process.cwd(), 'src/data/fcs/cutting/production-material-prep.ts'),
    'utf8',
  )
  assert(
    !domainSource.includes('Math.ceil(batch.rollCount * currentAvailableQty'),
    '节点卷数不得按数量比例向上取整伪造实物卷数',
  )
  const overviewSource = fs.readFileSync(
    path.join(process.cwd(), 'src/data/fcs/production-object-overview.ts'),
    'utf8',
  )
  assert(!overviewSource.includes('formatQty(record.preparedQty, line?.unit'), '生产对象相关配料记录不得继续格式化旧无量纲总量')
}

const failures: string[] = []
for (const [name, verify] of [
  ['三列表旧 Store 场景迁移', verifyPickupThreeListSceneStoreMigration],
  ['旧存储领料主记录迁移', verifyLegacyPickupSessionMigration],
  ['来源级退回恢复', verifySourceAccurateReturnRecovery],
  ['历史分组当前承载事实', verifyHistoryUsesCurrentActiveCarrier],
  ['配料记录多单位汇总', verifyMixedUnitPrepRecords],
] as const) {
  try {
    verify()
  } catch (error) {
    failures.push(`${name}：${(error as Error).message}`)
  }
}
assert(!failures.length, failures.join('\n'))

console.log('裁床领料 Important 回归检查通过')
