#!/usr/bin/env node

import {
  createProductionMaterialPrepSeedStore,
  listActivePickupNodes,
  listMaterialPrepOrderProjections,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore,
  type MaterialPrepOrderProjection,
  type PickupRecord,
} from '../src/data/fcs/cutting/production-material-prep.ts'
import type {
  PickupNodeProjection,
  PickupNodeSourceLocation,
  PickupSession,
} from '../src/data/fcs/cutting/pickup-node-domain.ts'
import {
  listPlatformDyeResultViews,
  listPlatformPrintResultViews,
} from '../src/data/fcs/platform-process-result-view.ts'
import {
  buildPickupOrderGroups,
  buildSupplementMaterialRows,
  derivePickupProcessRoute,
  derivePickupHistoryPath,
  listPickupOrderGroups,
  resolveNormalProcessResult,
  resolvePickupRequiredQty,
  type PickupListKind,
  type PickupMaterialDemandRow,
  type PickupOrderGroup,
} from '../src/pages/process-factory/cutting/pickup-management-projection.ts'
import { listSupplementRecords } from '../src/pages/process-factory/cutting/supplement-management.ts'

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
  assert(
    group.groupKey === `${listKind}:${group.productionOrderId}`,
    `${group.productionOrderNo} 分组主键必须带列表类型前缀`,
  )
  assert(group.materialRows.length > 0, `${group.productionOrderNo} 必须直接携带物料需求行`)
  assert(
    group.materialRows.every((row) =>
      row.rowKey === `${listKind}:${group.productionOrderId}:${row.demandLineId}`
    ),
    `${group.productionOrderNo} 物料行主键必须带列表类型和生产单前缀`,
  )
}

function roundQty(value: number): number {
  return Number(Number(value || 0).toFixed(2))
}

function assertRequiredQtyResolver(): void {
  assert(derivePickupProcessRoute({ upstreamSourceType: '无上游' }) === 'NONE', '无加工正常需求必须映射 NONE')
  assert(derivePickupProcessRoute({ upstreamSourceType: '染色' }) === 'DYE', '染色正常需求必须映射 DYE')
  assert(derivePickupProcessRoute({ upstreamSourceType: '印花' }) === 'DYE_PRINT', '印花正常需求必须映射 DYE_PRINT')
  assert(derivePickupProcessRoute({ dyeRequired: true }) === 'DYE', '补料染色需求必须映射 DYE')
  assert(derivePickupProcessRoute({ dyeRequired: true, printRequired: true }) === 'DYE_PRINT', '补料印花需求必须映射 DYE_PRINT')

  const none = resolvePickupRequiredQty({
    plannedQty: 18,
    unit: 'yard',
    processRoute: 'NONE',
  })
  assert(none.qty === 18 && none.basisLabel === '按计划数量', 'NONE 必须取计划量并标记按计划数量')

  const completedDye = resolvePickupRequiredQty({
    plannedQty: 18,
    unit: 'yard',
    processRoute: 'DYE',
    dyeResult: { completedObjectQty: 16.5, qtyUnit: 'yard', platformStatusCode: 'COMPLETED' },
  })
  assert(completedDye.qty === 16.5, 'DYE 必须取染色最终完成量')
  const processingDye = resolvePickupRequiredQty({
    plannedQty: 18,
    unit: 'yard',
    processRoute: 'DYE',
    dyeResult: { completedObjectQty: 8, qtyUnit: 'yard', platformStatusCode: 'PROCESSING' },
  })
  assert(
    processingDye.qty === 0 && processingDye.basisLabel.includes('等待染色一次性完成'),
    '加工中累计完成量不得作为应配量，必须等待平台最终完成',
  )
  const waitingDye = resolvePickupRequiredQty({
    plannedQty: 18,
    unit: 'yard',
    processRoute: 'DYE',
    dyeResult: { completedObjectQty: 0, qtyUnit: 'yard', platformStatusCode: 'PROCESSING' },
  })
  assert(waitingDye.qty === 0 && waitingDye.basisLabel.includes('等待染色一次性完成'), '染色完成量为 0 必须等待')
  const mismatchedDye = resolvePickupRequiredQty({
    plannedQty: 18,
    unit: 'yard',
    processRoute: 'DYE',
    dyeResult: { completedObjectQty: 16.5, qtyUnit: '米', platformStatusCode: 'COMPLETED' },
  })
  assert(mismatchedDye.qty === 0 && mismatchedDye.basisLabel.includes('加工完成单位不一致'), '染色完成单位不一致必须阻断')
  const mismatchedWaitingDye = resolvePickupRequiredQty({
    plannedQty: 18,
    unit: 'yard',
    processRoute: 'DYE',
    dyeResult: { completedObjectQty: 0, qtyUnit: '米', platformStatusCode: 'COMPLETED' },
  })
  assert(
    mismatchedWaitingDye.qty === 0 && mismatchedWaitingDye.basisLabel.includes('加工完成单位不一致'),
    '已有加工结果但单位不一致时必须优先提示单位不一致',
  )

  const completedPrint = resolvePickupRequiredQty({
    plannedQty: 18,
    unit: 'yard',
    processRoute: 'DYE_PRINT',
    dyeResult: { completedObjectQty: 17, qtyUnit: 'yard', platformStatusCode: 'COMPLETED' },
    printResult: { completedObjectQty: 15, qtyUnit: 'yard', platformStatusCode: 'COMPLETED' },
  })
  assert(completedPrint.qty === 15, 'DYE_PRINT 必须取印花最终完成量')
  const waitingPrint = resolvePickupRequiredQty({
    plannedQty: 18,
    unit: 'yard',
    processRoute: 'DYE_PRINT',
    dyeResult: { completedObjectQty: 17, qtyUnit: 'yard', platformStatusCode: 'COMPLETED' },
    printResult: { completedObjectQty: 0, qtyUnit: 'yard', platformStatusCode: 'PROCESSING' },
  })
  assert(
    waitingPrint.qty === 0 && waitingPrint.basisLabel.includes('等待印花一次性完成'),
    '印花未完成时不得回退染色完成量',
  )

  const invalidQty = resolvePickupRequiredQty({
    plannedQty: 18,
    unit: 'yard',
    processRoute: 'DYE',
    dyeResult: { completedObjectQty: Number.NaN, qtyUnit: 'yard', platformStatusCode: 'COMPLETED' },
  })
  assert(invalidQty.qty === 0 && invalidQty.basisLabel.includes('加工完成数量异常'), 'NaN 完成量必须阻断')
  const negativeQty = resolvePickupRequiredQty({
    plannedQty: 18,
    unit: 'yard',
    processRoute: 'DYE_PRINT',
    printResult: { completedObjectQty: -1, qtyUnit: 'yard', platformStatusCode: 'COMPLETED' },
  })
  assert(negativeQty.qty === 0 && negativeQty.basisLabel.includes('加工完成数量异常'), '负数完成量必须阻断')
}

assertRequiredQtyResolver()

function assertMaterialRowFacts(
  group: PickupOrderGroup,
  projection: MaterialPrepOrderProjection,
  materialRow: PickupMaterialDemandRow,
): void {
  const projectionLine = projection.lines.find((line) => line.prepLineId === materialRow.demandLineId)
  assert(projectionLine, `${group.productionOrderNo} 正常需求行必须以 prepLineId 作为 demandLineId`)
  assert(materialRow.demandSource === 'NORMAL', `${materialRow.demandLineId} 必须是正常需求`)
  assert(
    materialRow.demandCreatedAt === projection.order.createdAt,
    `${materialRow.demandLineId} 正常需求时间必须来自生产单需求创建时间`,
  )
  const expectedRoute = derivePickupProcessRoute({ upstreamSourceType: projectionLine.upstreamSourceType })
  assert(materialRow.processRoute === expectedRoute, `${materialRow.demandLineId} 必须按加工来源标记路线`)
  if (expectedRoute === 'NONE') {
    assert(materialRow.requiredQty === projectionLine.requiredQty, `${materialRow.demandLineId} 无加工时需求数量必须来自计划量`)
    assert(materialRow.processBasisLabel === '按计划数量', `${materialRow.demandLineId} 无加工时必须标记按计划数量`)
  } else {
    assert(materialRow.requiredQty === 0, `${materialRow.demandLineId} 加工未形成一次性完成结果时应配数量必须为 0`)
    assert(
      materialRow.processBasisLabel.includes('等待') || materialRow.processBasisLabel.includes('加工完成单位不一致'),
      `${materialRow.demandLineId} 加工未完成或单位不一致时必须说明阻断原因`,
    )
  }
  assert(
    materialRow.preparedQty === projectionLine.confirmedPrepQty,
    `${materialRow.demandLineId} 已配数量必须来自配料投影行确认数量`,
  )
  const effectivePickedQty = roundQty(Math.max(projectionLine.pickedQty - projectionLine.returnedQty, 0))
  assert(materialRow.pickedQty === effectivePickedQty, `${materialRow.demandLineId} 已领数量必须扣除退回数量`)
  assert(
    materialRow.remainingPickupQty === roundQty(Math.max(materialRow.requiredQty - materialRow.pickedQty, 0)),
    `${materialRow.demandLineId} 待领数量必须按逐需求行计算`,
  )
}

function stableLocationFacts(locations: PickupNodeSourceLocation[]): Array<{
  key: string
  unit: string
  currentAvailableQty: number
  rollCount: number
  sourcePrepRecordIds: string[]
}> {
  return locations
    .map((location) => ({
      key: [
        location.sourceWarehouseName,
        location.sourceWarehouseArea,
        location.sourceLocationCode,
      ].join('|'),
      unit: location.unit,
      currentAvailableQty: location.currentAvailableQty,
      rollCount: location.rollCount,
      sourcePrepRecordIds: [...location.sourcePrepRecordIds].sort((left, right) =>
        left.localeCompare(right, 'zh-CN')
      ),
    }))
    .sort((left, right) => left.key.localeCompare(right.key, 'zh-CN') || left.unit.localeCompare(right.unit, 'zh-CN'))
}

function assertCurrentAvailableFacts(group: PickupOrderGroup, node: PickupNodeProjection): void {
  for (const materialRow of group.materialRows) {
    const nodeItem = node.items.find((item) => item.prepLineId === materialRow.demandLineId)
    assert(
      materialRow.currentAvailableQty === (nodeItem?.currentAvailableQty ?? 0),
      `${group.productionOrderNo} ${materialRow.demandLineId} 当前可领数量必须来自活动节点同一物料行`,
    )
  }
}

const sourceLocationFact: PickupNodeSourceLocation = {
  sourceWarehouseName: '中转仓',
  sourceWarehouseArea: 'A 区',
  sourceLocationCode: 'A-01',
  currentAvailableQty: 120,
  rollCount: 2,
  unit: 'yard',
  sourcePrepRecordIds: ['prep-record-b', 'prep-record-a'],
}
const reorderedSourceLocationFact: PickupNodeSourceLocation = {
  ...sourceLocationFact,
  sourcePrepRecordIds: ['prep-record-a', 'prep-record-b'],
}
const clearedSourceLocationFact: PickupNodeSourceLocation = {
  ...sourceLocationFact,
  sourcePrepRecordIds: [],
}
const replacedSourceLocationFact: PickupNodeSourceLocation = {
  ...sourceLocationFact,
  sourcePrepRecordIds: ['prep-record-a', 'prep-record-c'],
}
assert(
  JSON.stringify(stableLocationFacts([sourceLocationFact]))
    === JSON.stringify(stableLocationFacts([reorderedSourceLocationFact])),
  '来源配料记录顺序变化不得改变稳定位置事实',
)
assert(
  JSON.stringify(stableLocationFacts([sourceLocationFact]))
    !== JSON.stringify(stableLocationFacts([clearedSourceLocationFact])),
  '清空来源配料记录必须被稳定位置事实比较捕获',
)
assert(
  JSON.stringify(stableLocationFacts([sourceLocationFact]))
    !== JSON.stringify(stableLocationFacts([replacedSourceLocationFact])),
  '串换来源配料记录必须被稳定位置事实比较捕获',
)

const supplementRecords = listSupplementRecords().filter((record) => record.status === '已确认')
const dyeResults = listPlatformDyeResultViews()
const printResults = listPlatformPrintResultViews()
const supplementRowsByProductionOrder = buildSupplementMaterialRows(supplementRecords, {
  dyeResults,
  printResults,
})
const supplementRows = Array.from(supplementRowsByProductionOrder.values()).flat()
const expectedSupplementCount = supplementRecords.reduce(
  (sum, record) => sum + record.draft.materialDemands.length,
  0,
)
assert(supplementRows.length === expectedSupplementCount, '每条已确认补料物料需求必须独立投影')
assert(
  new Set(supplementRows.map((row) => row.demandLineId)).size === supplementRows.length,
  '每条补料需求必须有稳定且唯一的 demandLineId',
)
for (const record of supplementRecords) {
  const expectedRows = [...record.draft.materialDemands]
    .sort((left, right) => left.materialPatternMappingId.localeCompare(right.materialPatternMappingId, 'zh-CN'))
  expectedRows.forEach((demand) => {
    const demandLineId = `SUPPLEMENT:${record.id}:${demand.materialPatternMappingId}`
    const row = supplementRows.find((candidate) => candidate.demandLineId === demandLineId)
    assert(row, `${record.recordNo} ${demand.materialSku} 必须生成独立补料需求行`)
    assert(row.demandSource === 'SUPPLEMENT', `${demandLineId} 必须标记为 SUPPLEMENT`)
    assert(row.demandSourceNo === record.recordNo, `${demandLineId} 必须保留补料单号`)
    assert(row.demandCreatedAt === record.createdAt, `${demandLineId} 需求时间必须来自补料记录创建时间`)
    assert(row.supplementReason.includes(record.draft.reason), `${demandLineId} 必须保留补料原因`)
    assert(row.unit === demand.unit && Boolean(row.unit), `${demandLineId} 必须保留需求单位`)
    assert(row.color === '' && row.spec === '', `${demandLineId} 不得虚构颜色或规格`)
    assert(
      [row.requiredQty, row.preparedQty, row.pickedQty, row.remainingPickupQty, row.currentAvailableQty]
        .every((qty) => Number.isFinite(qty) && qty >= 0),
      `${demandLineId} 所有数量必须为非负有限数`,
    )
    assert(
      row.preparedQty === 0
      && row.pickedQty === 0
      && row.currentAvailableQty === 0
      && row.currentLocations.length === 0,
      `${demandLineId} 不得借用相同 SKU 正常需求的配料、领料或库位事实`,
    )
  })
}
for (const [productionOrderId, rows] of supplementRowsByProductionOrder) {
  const expectedIds = supplementRecords
    .filter((record) => record.draft.productionOrderId === productionOrderId)
    .sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
      || left.recordNo.localeCompare(right.recordNo, 'zh-CN')
    )
    .flatMap((record) => [...record.draft.materialDemands]
      .sort((left, right) => left.materialPatternMappingId.localeCompare(right.materialPatternMappingId, 'zh-CN'))
      .map((demand) => `SUPPLEMENT:${record.id}:${demand.materialPatternMappingId}`))
  assert(
    JSON.stringify(rows.map((row) => row.demandLineId)) === JSON.stringify(expectedIds),
    `${productionOrderId} 补料需求必须按创建时间、补料单号和物料关联稳定排序`,
  )
  assert(
    rows.every((row, index) => row.demandSequence === index + 1),
    `${productionOrderId} 补料 demandSequence 必须连续`,
  )
}
const repeatedSkuRows = supplementRows.filter((row) =>
  supplementRows.filter((candidate) => candidate.materialSku === row.materialSku).length > 1
)
assert(repeatedSkuRows.length > 1, '实际补料记录必须保留相同 SKU 的多次补料需求')
assert(
  new Set(repeatedSkuRows.map((row) => row.demandLineId)).size === repeatedSkuRows.length,
  '相同 SKU 的多次补料 demandLineId 必须保持唯一',
)

const dyePrintRecord = supplementRecords.find((record) =>
  record.draft.materialDemands.some((demand) => demand.printRequired)
)
assert(dyePrintRecord, '实际补料记录必须有染色后印花需求')
const dyePrintDemand = dyePrintRecord.draft.materialDemands.find((demand) => demand.printRequired)
assert(dyePrintDemand, `${dyePrintRecord.recordNo} 必须有印花物料需求`)
const dyeRef = dyePrintRecord.processWorkOrderRefs.find((ref) =>
  ref.processType === 'DYE' && ref.materialSku === dyePrintDemand.materialSku
)
const printRef = dyePrintRecord.processWorkOrderRefs.find((ref) =>
  ref.processType === 'PRINT' && ref.materialSku === dyePrintDemand.materialSku
)
const dyeView = dyeResults.find((view) => view.sourceId === dyeRef?.workOrderId)
const printView = printResults.find((view) => view.sourceId === printRef?.workOrderId)
assert(dyeView && printView, `${dyePrintRecord.recordNo} 必须能按加工单引用找到染色与印花平台结果`)
const unrelatedPrintView = printResults.find((view) =>
  view.productionOrderNo === dyePrintRecord.draft.productionOrderNo
  && view.sourceId !== printRef.workOrderId
)
assert(unrelatedPrintView, `${dyePrintRecord.recordNo} 必须有同生产单的无关印花结果以验证精确匹配`)
const exactProcessRows = buildSupplementMaterialRows([dyePrintRecord], {
  dyeResults: [{
    ...dyeView,
    completedObjectQty: 11,
    qtyUnit: dyePrintDemand.unit as typeof dyeView.qtyUnit,
    platformStatusCode: 'COMPLETED',
  }],
  printResults: [
    {
      ...unrelatedPrintView,
      completedObjectQty: 99,
      qtyUnit: dyePrintDemand.unit as typeof unrelatedPrintView.qtyUnit,
      platformStatusCode: 'COMPLETED',
    },
    {
      ...printView,
      completedObjectQty: 9,
      qtyUnit: dyePrintDemand.unit as typeof printView.qtyUnit,
      platformStatusCode: 'COMPLETED',
    },
  ],
}).get(dyePrintRecord.draft.productionOrderId) ?? []
assert(
  exactProcessRows.find((row) =>
    row.demandLineId === `SUPPLEMENT:${dyePrintRecord.id}:${dyePrintDemand.materialPatternMappingId}`
  )?.requiredQty === 9,
  '同一补料的 DYE_PRINT 必须按 PRINT ref 精确取印花完成量，不得误用染色或同生产单其他结果',
)

const sharedMappingDemand = {
  ...dyePrintDemand,
  materialPatternMappingId: `${dyePrintDemand.materialPatternMappingId}-SHARED`,
}
const sharedMappingRecord = {
  ...dyePrintRecord,
  id: `${dyePrintRecord.id}-SHARED`,
  recordNo: `${dyePrintRecord.recordNo}-SHARED`,
  draft: {
    ...dyePrintRecord.draft,
    materialDemands: [dyePrintDemand, sharedMappingDemand],
  },
  processWorkOrderRefs: dyePrintRecord.processWorkOrderRefs
    .filter((ref) =>
      ref.materialSku === dyePrintDemand.materialSku
      && (ref.processType === 'DYE' || ref.processType === 'PRINT')
    ),
}
const sharedMappingRows = buildSupplementMaterialRows([sharedMappingRecord], {
  dyeResults: [{
    ...dyeView,
    completedObjectQty: 11,
    qtyUnit: dyePrintDemand.unit as typeof dyeView.qtyUnit,
    platformStatusCode: 'COMPLETED',
  }],
  printResults: [{
    ...printView,
    completedObjectQty: 9,
    qtyUnit: dyePrintDemand.unit as typeof printView.qtyUnit,
    platformStatusCode: 'COMPLETED',
  }],
}).get(dyePrintRecord.draft.productionOrderId) ?? []
assert(
  sharedMappingRows.length === 2
  && sharedMappingRows.every((row) =>
    row.requiredQty === 0
    && row.processBasisLabel.includes('加工结果归属不唯一')
  ),
  '同一补料加工单覆盖同 SKU 多个花型映射时，所有关联需求必须阻断，不得重复使用整单完成量',
)

const storage = new MemoryStorage()
storage.setItem(
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()),
)

const projections = listMaterialPrepOrderProjections(storage)
const activeNodes = listActivePickupNodes(storage)
const groupsByKind = new Map<PickupListKind, PickupOrderGroup[]>()

const ownershipLineSource = projections.flatMap((projection) => projection.lines)[0]
const ownershipResultSource = printResults[0]
assert(ownershipLineSource && ownershipResultSource, '归属匹配反例必须有物料行和平台加工结果基础数据')
const ownershipLine = {
  ...ownershipLineSource,
  upstreamDocumentNo: 'PH-CURRENT-LINE',
  taskLinks: [{
    taskId: 'TASK-CURRENT-LINE',
    taskNo: 'TASK-CURRENT-LINE',
    taskName: '当前物料印花任务',
    taskType: '印花任务' as const,
    factoryId: 'F-CURRENT',
    factoryCode: 'F-CURRENT',
    factoryName: '当前工厂',
    assignedAt: '2026-03-01 09:00',
    allocationStatus: '已分配' as const,
  }],
}
const otherLineResult = {
  ...ownershipResultSource,
  sourceId: 'PWO-OTHER-LINE',
  workOrderNo: 'PH-OTHER-LINE',
  productionOrderNo: 'PO-SAME-PROCESS-TWO-LINES',
  mobileTaskLink: '/fcs/pda/exec/TASK-OTHER-LINE',
  platformStatusCode: 'COMPLETED' as const,
  completedObjectQty: 12,
  qtyUnit: ownershipLine.unit as typeof ownershipResultSource.qtyUnit,
}
assert(
  resolveNormalProcessResult(
    ownershipLine,
    'PO-SAME-PROCESS-TWO-LINES',
    'PRINT',
    [otherLineResult],
  ) === undefined,
  '同生产单同工艺只有另一物料行有结果时，当前行不得因候选唯一而借用',
)
const prefixCollisionLine = {
  ...ownershipLine,
  upstreamDocumentNo: 'PH-CURRENT-PREFIX-LINE',
  taskLinks: [{
    ...ownershipLine.taskLinks[0],
    taskId: 'TASK-1',
    taskNo: 'TASK-NO-1',
  }],
}
const prefixCollisionResult = {
  ...otherLineResult,
  sourceId: 'PWO-PREFIX-OTHER',
  workOrderNo: 'PH-PREFIX-OTHER',
  mobileTaskLink: '/fcs/pda/exec/TASK-10?sourceType=PRINT&sourceId=PWO-PREFIX-OTHER&keyword=TASK-NO-10',
}
assert(
  resolveNormalProcessResult(
    prefixCollisionLine,
    'PO-SAME-PROCESS-TWO-LINES',
    'PRINT',
    [prefixCollisionResult],
  ) === undefined,
  'TASK-1 不得通过模糊包含错误命中 TASK-10',
)
const exactTaskResult = {
  ...prefixCollisionResult,
  mobileTaskLink: '/fcs/pda/exec/TASK-1?sourceType=PRINT&sourceId=PWO-PREFIX-OTHER&keyword=TASK-NO-1',
}
assert(
  resolveNormalProcessResult(
    prefixCollisionLine,
    'PO-SAME-PROCESS-TWO-LINES',
    'PRINT',
    [exactTaskResult],
  ) === exactTaskResult,
  '实际 PDA 任务链接的路径段或查询参数等值时必须精确归属',
)

const integrationNodeSource = activeNodes.find((node) => node.nodeType === 'INCOMPLETE_PICKABLE')
const integrationProjectionSource = projections.find((projection) =>
  projection.order.prepOrderId === integrationNodeSource?.prepOrderId
)
const integrationLineSource = integrationProjectionSource?.lines[0]
assert(
  integrationNodeSource && integrationProjectionSource && integrationLineSource,
  '最终分组注入验证必须有未配齐节点、配料投影和物料行基础数据',
)
const integrationProductionOrderId = 'PO-ID-INJECTED-PROCESS-RESULT'
const integrationProductionOrderNo = 'PO-INJECTED-PROCESS-RESULT'
const integrationPrepOrderId = 'PREP-ID-INJECTED-PROCESS-RESULT'
const integrationPrepOrderNo = 'PREP-INJECTED-PROCESS-RESULT'
const integrationLine = {
  ...integrationLineSource,
  prepLineId: 'PREP-LINE-INJECTED-PROCESS-RESULT',
  upstreamSourceType: '印花' as const,
  upstreamDocumentNo: 'PH-INJECTED-PROCESS-RESULT',
  taskLinks: [],
}
const integrationProjection = {
  ...integrationProjectionSource,
  order: {
    ...integrationProjectionSource.order,
    productionOrderId: integrationProductionOrderId,
    productionOrderNo: integrationProductionOrderNo,
    prepOrderId: integrationPrepOrderId,
    prepOrderNo: integrationPrepOrderNo,
  },
  lines: [integrationLine],
}
const integrationNode = {
  ...integrationNodeSource,
  nodeId: 'PICKUP-NODE-INJECTED-PROCESS-RESULT',
  productionOrderId: integrationProductionOrderId,
  productionOrderNo: integrationProductionOrderNo,
  prepOrderId: integrationPrepOrderId,
  prepOrderNo: integrationPrepOrderNo,
  items: [],
}
const integrationResult = {
  ...ownershipResultSource,
  sourceId: 'PWO-INJECTED-PROCESS-RESULT',
  workOrderNo: integrationLine.upstreamDocumentNo,
  productionOrderNo: integrationProductionOrderNo,
  mobileTaskLink: '/fcs/pda/exec/PWO-INJECTED-PROCESS-RESULT',
  platformStatusCode: 'COMPLETED' as const,
  completedObjectQty: 23,
  qtyUnit: integrationLine.unit as typeof ownershipResultSource.qtyUnit,
}
const integrationUnrelatedResult = {
  ...integrationResult,
  sourceId: 'PWO-INJECTED-UNRELATED-RESULT',
  workOrderNo: 'PH-INJECTED-UNRELATED-RESULT',
  mobileTaskLink: '/fcs/pda/exec/PWO-INJECTED-UNRELATED-RESULT',
  completedObjectQty: 99,
}
const integrationGroups = buildPickupOrderGroups({
  listKind: 'INCOMPLETE',
  projections: [integrationProjection],
  activeNodes: [integrationNode],
  supplementRecords: [],
  processResults: {
    dyeResults: [],
    printResults: [integrationUnrelatedResult, integrationResult],
  },
})
const integrationRow = integrationGroups[0]?.materialRows.find((row) =>
  row.demandLineId === integrationLine.prepLineId
)
assert(
  integrationRow?.requiredQty === 23
  && integrationRow.unit === integrationLine.unit
  && integrationRow.processBasisLabel === '按印花一次性完成数量',
  '最终分组入口必须把精确完成的正常印花结果投影为应配数量、原单位和明确依据',
)

const sharedResultProjection = {
  ...integrationProjection,
  lines: [
    {
      ...integrationLine,
      prepLineId: 'PREP-LINE-SHARED-PROCESS-RESULT-A',
    },
    {
      ...integrationLine,
      prepLineId: 'PREP-LINE-SHARED-PROCESS-RESULT-B',
    },
  ],
}
const sharedResultGroups = buildPickupOrderGroups({
  listKind: 'INCOMPLETE',
  projections: [sharedResultProjection],
  activeNodes: [integrationNode],
  supplementRecords: [],
  processResults: {
    dyeResults: [],
    printResults: [integrationUnrelatedResult, integrationResult],
  },
})
const sharedResultRows = sharedResultGroups[0]?.materialRows ?? []
assert(
  sharedResultRows.length === 2
  && sharedResultRows.every((row) =>
    row.requiredQty === 0
    && row.processBasisLabel === '印花加工结果归属不唯一'
  ),
  '同一正常加工结果命中两条需求时，所有关联需求必须阻断，不得重复使用整单完成量',
)

for (const listKind of ['READY', 'INCOMPLETE', 'HISTORY'] as const) {
  const groups = listPickupOrderGroups(listKind, storage)
  assert(groups.length > 0, `${listKind} 列表必须有基础投影数据`)
  assert(
    new Set(groups.map((group) => group.productionOrderId)).size === groups.length,
    `${listKind} 列表内 productionOrderId 必须唯一`,
  )
  groups.forEach((group) => assertGroupContract(group, listKind))
  assert(
    groups
      .filter((group) => group.carrierType === 'PALLET')
      .every((group) => group.materialRows.every((row) => row.currentLocations.length === 0)),
    `${listKind} 列表中只有库位承载分组可以输出当前位置`,
  )
  groupsByKind.set(listKind, groups)
}

const readyGroups = groupsByKind.get('READY') ?? []
for (const group of readyGroups) {
  const node = activeNodes.find((candidate) => candidate.nodeId === group.pickupNodeId)
  assert(node?.nodeType === 'READY_TO_PICKUP', `${group.productionOrderNo} READY 分组必须来自已配齐活动节点`)
  assertCurrentAvailableFacts(group, node)
  assert(group.carrierType === 'PALLET', `${group.productionOrderNo} READY 分组必须使用托盘载体`)
  assert(group.palletId === '', `${group.productionOrderNo} READY 分组不得虚构托盘编号`)
  assert(
    group.palletDisplayLabel === '待领托盘（暂未编号）',
    `${group.productionOrderNo} READY 分组必须明确展示未编号待领托盘`,
  )
  assert(
    group.readySource === 'DIRECT_READY' || group.readySource === 'UPGRADED_FROM_INCOMPLETE',
    `${group.productionOrderNo} READY 分组必须记录直接配齐或未配齐升级来源`,
  )
  assert(
    group.materialRows.every((materialRow) => materialRow.currentLocations.length === 0),
    `${group.productionOrderNo} READY 托盘分组不得同时输出当前库位`,
  )
}

const incompleteGroups = groupsByKind.get('INCOMPLETE') ?? []
for (const group of incompleteGroups) {
  const node = activeNodes.find((candidate) => candidate.nodeId === group.pickupNodeId)
  assert(node?.nodeType === 'INCOMPLETE_PICKABLE', `${group.productionOrderNo} INCOMPLETE 分组必须来自未配齐活动节点`)
  assertCurrentAvailableFacts(group, node)
  assert(group.carrierType === 'WAREHOUSE_LOCATIONS', `${group.productionOrderNo} INCOMPLETE 分组必须使用库位载体`)
  assert(
    group.materialRows.some((materialRow) => materialRow.currentLocations.length > 0),
    `${group.productionOrderNo} INCOMPLETE 分组必须保留当前来源库位`,
  )
  for (const materialRow of group.materialRows) {
    const nodeItem = node.items.find((item) => item.prepLineId === materialRow.demandLineId)
    assert(
      JSON.stringify(stableLocationFacts(materialRow.currentLocations))
        === JSON.stringify(stableLocationFacts(nodeItem?.sourceLocations ?? [])),
      `${group.productionOrderNo} ${materialRow.demandLineId} 必须完整保留活动节点来源库位事实`,
    )
  }
}

for (const groups of groupsByKind.values()) {
  for (const group of groups) {
    const projection = projections.find((candidate) => candidate.order.prepOrderId === group.prepOrderId)
    assert(projection, `${group.productionOrderNo} 必须能找到对应生产单配料投影`)
    const normalRows = group.materialRows.filter((materialRow) => materialRow.demandSource === 'NORMAL')
    const projectedSupplementRows = group.materialRows.filter((materialRow) => materialRow.demandSource === 'SUPPLEMENT')
    assert(
      normalRows.length === projection.lines.length,
      `${group.productionOrderNo} 正常需求行不得按 SKU 或单位合并`,
    )
    assert(
      new Set(normalRows.map((materialRow) => materialRow.demandLineId)).size === projection.lines.length,
      `${group.productionOrderNo} 每个 prepLineId 必须只输出一条需求行`,
    )
    assert(
      projectedSupplementRows.length === (supplementRowsByProductionOrder.get(group.productionOrderId)?.length ?? 0),
      `${group.productionOrderNo} 必须追加该生产单全部有效补料需求`,
    )
    assert(
      group.materialRows.every((row, index) => row.demandSequence === index + 1),
      `${group.productionOrderNo} NORMAL 在前且全部 demandSequence 必须连续`,
    )
    normalRows.forEach((materialRow) => assertMaterialRowFacts(group, projection, materialRow))
  }
}
const allProjectedRows = Array.from(groupsByKind.values()).flat().flatMap((group) => group.materialRows)
assert(
  allProjectedRows.some((row) => row.demandSource === 'NORMAL' && row.processRoute === 'NONE'),
  '实际三列表投影必须存在 NORMAL NONE',
)
assert(
  allProjectedRows.some((row) =>
    row.demandSource === 'NORMAL' && (row.processRoute === 'DYE' || row.processRoute === 'DYE_PRINT')
  ),
  '实际三列表投影必须存在 NORMAL DYE 或 DYE_PRINT',
)

const historyGroups = groupsByKind.get('HISTORY') ?? []
assert(derivePickupHistoryPath([]) === null, '没有领料会话时不得派生历史路径')
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
  const activeNode = activeNodes.find((node) => node.productionOrderId === group.productionOrderId)
  if (activeNode) {
    assertCurrentAvailableFacts(group, activeNode)
    assert(group.carrierType === activeNode.carrierType, `${group.productionOrderNo} 历史分组当前承载必须来自活动节点`)
    assert(group.readySource === activeNode.readySource, `${group.productionOrderNo} 历史分组当前配齐来源必须来自活动节点`)
  } else {
    assert(
      group.materialRows.every((materialRow) => materialRow.currentAvailableQty === 0),
      `${group.productionOrderNo} 没有活动节点时历史物料当前可领数量必须为 0`,
    )
    assert(
      group.materialRows.every((materialRow) => materialRow.currentLocations.length === 0),
      `${group.productionOrderNo} 没有活动节点时历史物料不得冒充当前库位`,
    )
  }
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

const historyScenarioItemSource = integrationNodeSource.items[0]
const supplementRecordSource = supplementRecords[0]
const supplementDemandSource = supplementRecordSource?.draft.materialDemands[0]
assert(
  historyScenarioItemSource && supplementRecordSource && supplementDemandSource,
  '历史结果注入验证必须有节点物料、补料记录和补料需求基础结构',
)
const historyScenarioProductionOrderId = 'PO-ID-HISTORY-FINAL-RESULT'
const historyScenarioProductionOrderNo = 'PO-HISTORY-FINAL-RESULT'
const historyScenarioPrepOrderId = 'PREP-ID-HISTORY-FINAL-RESULT'
const historyScenarioPrepOrderNo = 'PREP-HISTORY-FINAL-RESULT'
const historyScenarioLineA = {
  ...integrationLineSource,
  prepLineId: 'PREP-LINE-HISTORY-FINAL-RESULT-A',
  prepOrderId: historyScenarioPrepOrderId,
  requiredQty: 5,
  confirmedPrepQty: 5,
  pickedQty: 5,
  returnedQty: 0,
  upstreamSourceType: '无上游' as const,
  upstreamDocumentNo: '',
  taskLinks: [],
}
const historyScenarioLineB = {
  ...historyScenarioLineA,
  prepLineId: 'PREP-LINE-HISTORY-FINAL-RESULT-B',
  materialSku: `${historyScenarioLineA.materialSku}-B`,
  requiredQty: 7,
  confirmedPrepQty: 7,
  pickedQty: 7,
}
function buildHistoryScenarioSession(input: {
  sessionId: string
  nodeType: 'READY_TO_PICKUP' | 'INCOMPLETE_PICKABLE'
  pickedAt: string
  snapshotLine: typeof historyScenarioLineA
}): PickupSession {
  const nodeId = `PICKUP-NODE-${input.sessionId}`
  return {
    pickupSessionId: input.sessionId,
    pickupSessionNo: input.sessionId,
    pickupNodeId: nodeId,
    pickupNodeVersion: 1,
    prepOrderId: historyScenarioPrepOrderId,
    productionOrderId: historyScenarioProductionOrderId,
    nodeType: input.nodeType,
    pickupRecordIds: [`PICKUP-RECORD-${input.sessionId}`],
    receiverName: '裁床 测试员',
    pickedAt: input.pickedAt,
    toWarehouseArea: '待加工仓 A 区',
    toLocationCode: 'FAB-A-TEST',
    status: '本轮已领完',
    warehouseSyncStatus: '已回写',
    pickupNodeSnapshot: {
      ...integrationNodeSource,
      nodeId,
      version: 1,
      nodeType: input.nodeType,
      prepOrderId: historyScenarioPrepOrderId,
      prepOrderNo: historyScenarioPrepOrderNo,
      productionOrderId: historyScenarioProductionOrderId,
      productionOrderNo: historyScenarioProductionOrderNo,
      items: [{
        ...historyScenarioItemSource,
        nodeItemId: `NODE-ITEM-${input.sessionId}`,
        prepLineId: input.snapshotLine.prepLineId,
        unit: input.snapshotLine.unit,
        requiredQty: input.snapshotLine.requiredQty,
        effectivePickedQty: 0,
        currentAvailableQty: input.snapshotLine.requiredQty,
      }],
    },
  }
}
function buildHistoryScenarioRecord(
  session: PickupSession,
  line: typeof historyScenarioLineA,
): PickupRecord {
  const pickupRecordId = `PICKUP-RECORD-${session.pickupSessionId}`
  return {
    pickupRecordId,
    prepRecordId: `PREP-RECORD-${session.pickupSessionId}`,
    prepOrderId: session.prepOrderId,
    prepLineId: line.prepLineId,
    productionOrderId: session.productionOrderId,
    pickedQty: line.requiredQty,
    rollCount: 1,
    receiverName: session.receiverName,
    pickedAt: session.pickedAt,
    warehouseArea: session.toWarehouseArea,
    locationCode: session.toLocationCode,
    waitProcessLedgerEventId: `LEDGER-${session.pickupSessionId}`,
    differenceQty: 0,
    differenceReason: '',
    pickupStatus: '已领料',
    remark: '',
    pickupSessionId: session.pickupSessionId,
    pickupNodeId: session.pickupNodeId,
    sourcePrepRecordIds: [`PREP-RECORD-${session.pickupSessionId}`],
    sourceAllocations: [{
      prepRecordId: `PREP-RECORD-${session.pickupSessionId}`,
      prepLineId: line.prepLineId,
      pickedQty: line.requiredQty,
      rollCount: 1,
      unit: line.unit,
      sourceWarehouseName: '中转仓',
      sourceWarehouseArea: '中转仓测试区',
      sourceLocationCode: 'TR-TEST-01',
    }],
  }
}
const historyIncompleteSession = buildHistoryScenarioSession({
  sessionId: 'SESSION-HISTORY-INCOMPLETE',
  nodeType: 'INCOMPLETE_PICKABLE',
  pickedAt: '2026-03-18 09:00',
  snapshotLine: historyScenarioLineA,
})
const historyReadySession = buildHistoryScenarioSession({
  sessionId: 'SESSION-HISTORY-READY',
  nodeType: 'READY_TO_PICKUP',
  pickedAt: '2026-03-18 10:00',
  snapshotLine: historyScenarioLineB,
})
const historyIncompleteRecord = buildHistoryScenarioRecord(
  historyIncompleteSession,
  historyScenarioLineA,
)
const historyReadyRecord = buildHistoryScenarioRecord(
  historyReadySession,
  historyScenarioLineB,
)
function buildHistoryScenarioProjection(
  lines: MaterialPrepOrderProjection['lines'],
  pickupSessions: typeof integrationProjectionSource.pickupSessions,
  pickupRecords: PickupRecord[],
) {
  return {
    ...integrationProjectionSource,
    order: {
      ...integrationProjectionSource.order,
      productionOrderId: historyScenarioProductionOrderId,
      productionOrderNo: historyScenarioProductionOrderNo,
      prepOrderId: historyScenarioPrepOrderId,
      prepOrderNo: historyScenarioPrepOrderNo,
      createdAt: '2026-03-18 08:00',
    },
    lines,
    pickupSessions,
    pickupRecords,
  }
}
function buildHistoryScenarioGroups(input: {
  lines: MaterialPrepOrderProjection['lines']
  pickupSessions: typeof integrationProjectionSource.pickupSessions
  pickupRecords: PickupRecord[]
  activeNodes?: PickupNodeProjection[]
  supplementRecords?: typeof supplementRecords
}) {
  return buildPickupOrderGroups({
    listKind: 'HISTORY',
    projections: [buildHistoryScenarioProjection(
      input.lines,
      input.pickupSessions,
      input.pickupRecords,
    )],
    activeNodes: input.activeNodes ?? [],
    supplementRecords: input.supplementRecords ?? [],
    processResults: { dyeResults: [], printResults: [] },
  })
}

const readyAllPicked = buildHistoryScenarioGroups({
  lines: [{ ...historyScenarioLineB }],
  pickupSessions: [historyReadySession],
  pickupRecords: [historyReadyRecord],
})[0]
assert(
  readyAllPicked?.historyPath === 'READY_PICKUP'
  && readyAllPicked.finalResult === 'ALL_PICKED',
  'READY_PICKUP 历史必须能表达逐需求行 ALL_PICKED',
)
const incompleteAllPicked = buildHistoryScenarioGroups({
  lines: [{ ...historyScenarioLineA }, { ...historyScenarioLineB }],
  pickupSessions: [historyIncompleteSession, historyReadySession],
  pickupRecords: [historyIncompleteRecord, historyReadyRecord],
})[0]
assert(
  incompleteAllPicked?.historyPath === 'INCOMPLETE_PICKUP'
  && incompleteAllPicked.finalResult === 'ALL_PICKED',
  '任一历史会话来自未配齐领取时，最终全部领完仍必须表达 INCOMPLETE_PICKUP + ALL_PICKED',
)
const incompleteNotAllPicked = buildHistoryScenarioGroups({
  lines: [
    { ...historyScenarioLineA },
    { ...historyScenarioLineB, pickedQty: 0, confirmedPrepQty: 0 },
  ],
  pickupSessions: [historyIncompleteSession],
  pickupRecords: [historyIncompleteRecord],
})[0]
assert(
  incompleteNotAllPicked?.historyPath === 'INCOMPLETE_PICKUP'
  && incompleteNotAllPicked.finalResult === 'NOT_ALL_PICKED',
  '未配齐领取后仍有逐行缺口必须表达 INCOMPLETE_PICKUP + NOT_ALL_PICKED',
)

const offsetProjection = buildHistoryScenarioProjection(
  [
    { ...historyScenarioLineA, prepLineId: 'PREP-LINE-NO-OFFSET-YARD', unit: 'yard', requiredQty: 10, pickedQty: 9 },
    { ...historyScenarioLineB, prepLineId: 'PREP-LINE-NO-OFFSET-PIECE', unit: '件', requiredQty: 1, pickedQty: 2 },
  ],
  [historyReadySession],
  [historyReadyRecord],
)
const offsetHistory = buildPickupOrderGroups({
  listKind: 'HISTORY',
  projections: [offsetProjection],
  activeNodes: [],
  supplementRecords: [],
  processResults: { dyeResults: [], printResults: [] },
})[0]
assert(
  offsetHistory?.finalResult === 'NOT_ALL_PICKED',
  'ALL_PICKED 必须逐需求行、逐单位判断，超领数量不得抵消其他物料缺口',
)

const newSupplementRecord = {
  ...supplementRecordSource,
  id: 'SUPPLEMENT-HISTORY-REOPEN',
  recordNo: 'BL-HISTORY-REOPEN',
  createdAt: '2026-03-18 11:00',
  draft: {
    ...supplementRecordSource.draft,
    productionOrderId: historyScenarioProductionOrderId,
    productionOrderNo: historyScenarioProductionOrderNo,
    materialDemands: [{
      ...supplementDemandSource,
      materialPatternMappingId: 'MAPPING-HISTORY-REOPEN',
      materialSku: 'MAT-HISTORY-REOPEN',
      requiredQty: 2,
      unit: historyScenarioLineA.unit,
      printRequired: false,
      dyeRequired: false,
    }],
  },
  processWorkOrderRefs: [],
}
const reopenedNode = {
  ...integrationNodeSource,
  nodeId: 'PICKUP-NODE-HISTORY-REOPEN',
  prepOrderId: historyScenarioPrepOrderId,
  prepOrderNo: historyScenarioPrepOrderNo,
  productionOrderId: historyScenarioProductionOrderId,
  productionOrderNo: historyScenarioProductionOrderNo,
  nodeType: 'INCOMPLETE_PICKABLE' as const,
  carrierType: 'WAREHOUSE_LOCATIONS' as const,
  items: [{
    ...historyScenarioItemSource,
    nodeItemId: 'NODE-ITEM-HISTORY-REOPEN',
    prepLineId: `SUPPLEMENT:${newSupplementRecord.id}:MAPPING-HISTORY-REOPEN`,
    materialSku: 'MAT-HISTORY-REOPEN',
    unit: historyScenarioLineA.unit,
    requiredQty: 2,
    effectivePickedQty: 0,
    currentAvailableQty: 1,
  }],
}
const reopenedProjection = buildHistoryScenarioProjection(
  [{ ...historyScenarioLineA }, { ...historyScenarioLineB }],
  [historyIncompleteSession, historyReadySession],
  [historyIncompleteRecord, historyReadyRecord],
)
const reopenedHistory = buildPickupOrderGroups({
  listKind: 'HISTORY',
  projections: [reopenedProjection],
  activeNodes: [reopenedNode],
  supplementRecords: [newSupplementRecord],
  processResults: { dyeResults: [], printResults: [] },
})[0]
const reopenedCurrent = buildPickupOrderGroups({
  listKind: 'INCOMPLETE',
  projections: [reopenedProjection],
  activeNodes: [reopenedNode],
  supplementRecords: [newSupplementRecord],
  processResults: { dyeResults: [], printResults: [] },
})[0]
assert(
  reopenedHistory?.finalResult === 'NEW_SUPPLEMENT_WAIT_PICKUP',
  'A 前序记录领完、B 本轮记录领完且 READY 快照只含 B 时，后续补料必须重开为 NEW_SUPPLEMENT_WAIT_PICKUP',
)
assert(
  reopenedHistory.historyPath === 'INCOMPLETE_PICKUP',
  '累计真实记录证明全领完不应抹掉前序未配齐领取路径',
)
assert(
  reopenedHistory?.productionOrderId === reopenedCurrent?.productionOrderId,
  '新增补料重开后同一生产单必须同时保留历史分组和当前待领分组',
)
assert(
  reopenedHistory.groupKey !== reopenedCurrent.groupKey
  && reopenedHistory.materialRows.every((historyRow) =>
    reopenedCurrent.materialRows.every((currentRow) => historyRow.rowKey !== currentRow.rowKey)
  ),
  '同生产单跨列表同时存在时，分组和物料行主键不得发生 DOM 冲突',
)

const fakeIncompleteSession = buildHistoryScenarioSession({
  sessionId: 'SESSION-HISTORY-FAKE-INCOMPLETE',
  nodeType: 'INCOMPLETE_PICKABLE',
  pickedAt: '2026-03-18 11:30',
  snapshotLine: historyScenarioLineA,
})
const mixedWithFakeHistory = buildHistoryScenarioGroups({
  lines: [{ ...historyScenarioLineB }],
  pickupSessions: [historyReadySession, fakeIncompleteSession],
  pickupRecords: [historyReadyRecord],
})[0]
assert(
  mixedWithFakeHistory?.historyPath === 'READY_PICKUP'
  && mixedWithFakeHistory.pickupSessionCount === 1
  && mixedWithFakeHistory.latestPickedAt === historyReadySession.pickedAt,
  '真实 READY 会话不得被引用虚假记录的 INCOMPLETE 会话污染路径、数量或最新时间',
)
const onlyFakeHistory = buildHistoryScenarioGroups({
  lines: [{ ...historyScenarioLineA }],
  pickupSessions: [fakeIncompleteSession],
  pickupRecords: [],
})
assert(
  onlyFakeHistory.length === 0,
  '只有引用虚假 pickupRecordId 的会话时不得生成历史分组',
)
const wrongSessionRecord = {
  ...historyReadyRecord,
  pickupSessionId: 'SESSION-WRONG-OWNER',
}
const wrongOwnerHistory = buildHistoryScenarioGroups({
  lines: [{ ...historyScenarioLineB }],
  pickupSessions: [historyReadySession],
  pickupRecords: [wrongSessionRecord],
})
assert(
  wrongOwnerHistory.length === 0,
  'pickupRecordId 虽存在但 session 归属不一致时必须排除该会话且不得生成历史分组',
)

console.log(JSON.stringify({
  READY: '节点分类、未编号托盘、空库位与配齐来源已覆盖',
  INCOMPLETE: '节点分类、库位载体与完整来源位置事实已覆盖',
  MATERIAL_ROWS: 'prepLineId、需求/已配/有效已领/待领/当前可领数量已覆盖',
  HISTORY: '全会话路径、可靠全领完时间、逐行最终结果、补料重开与跨列表主键已覆盖',
}, null, 2))
