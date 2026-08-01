#!/usr/bin/env node

import fs from 'node:fs'
import {
  appendPickupReturnRecord,
  appendPickupSessionFromNode as appendPickupSessionFromNodeWithFacts,
  buildPickupDemandFactsFromProjections,
  createProductionMaterialPrepSeedStore,
  listActivePickupNodes as listActivePickupNodesWithFacts,
  listMaterialPrepOrderProjections,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore,
  type MaterialPrepOrderProjection,
  type PickupRecord,
} from '../src/data/fcs/cutting/production-material-prep.ts'
import {
  appendPickupSessionFromNodeRuntime as appendPickupSessionFromNode,
  appendPickupSessionWithWarehouseFactsRuntime,
  bootstrapPickupManagementRuntimeMockData,
  listActivePickupNodesRuntime as listActivePickupNodes,
} from '../src/runtime/fcs/cutting/pickup-management-runtime.ts'
import { CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY } from '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
import type {
  PickupNodeProjection,
  PickupNodeSourceLocation,
  PickupSession,
} from '../src/data/fcs/cutting/pickup-node-domain.ts'
import {
  listPlatformDyeResultViews,
  listPlatformPrintResultViews,
} from '../src/data/fcs/platform-process-result-view.ts'
import { getProcessWorkOrderById } from '../src/data/fcs/process-work-order-domain.ts'
import {
  buildPickupOrderGroups,
  buildSupplementMaterialRows,
  comparePickupDemandEventTime,
  derivePickupProcessRoute,
  derivePickupHistoryPath,
  listPickupOrderGroups,
  resolveNormalProcessResult,
  resolvePickupRequiredQty,
  type PickupListKind,
  type PickupMaterialDemandRow,
  type PickupOrderGroup,
} from '../src/pages/process-factory/cutting/pickup-management-projection.ts'
import {
  bootstrapSupplementManagementMockData,
  listSupplementRecords,
  resetSupplementManagementMockDataForTest,
} from '../src/pages/process-factory/cutting/supplement-management.ts'
import {
  getCanonicalCuttingMeta,
  isCuttingAliasPath,
} from '../src/pages/process-factory/cutting/meta.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function readSource(path: string): string {
  return fs.existsSync(path) ? fs.readFileSync(path, 'utf8') : ''
}

function assertThreeListRouteAndMenuContract(): void {
  const listSource = readSource('src/pages/process-factory/cutting/pickup-management-list.ts')
  const metaSource = readSource('src/pages/process-factory/cutting/meta.ts')
  const menuSource = readSource('src/data/app-shell-config.ts')
  const rendererSource = readSource('src/router/route-renderers-fcs.ts')
  const routeSource = readSource('src/router/routes-fcs.ts')

  assert(listSource.startsWith('// @page-pattern: list'), '三列表页面必须声明标准列表页模式')
  assert(
    listSource.includes('export const PICKUP_LIST_FILTER_DEBOUNCE_MS = 120')
      && listSource.includes('}, PICKUP_LIST_FILTER_DEBOUNCE_MS))'),
    '筛选 debounce 必须固定为 120ms，给输入到 DOM 的 200ms 总门槛保留余量',
  )
  const fullRenderSource = listSource.match(/function renderPickupList[\s\S]*?\n}\n/)?.[0] || ''
  assert(
    fullRenderSource.includes('cancelPickupListDebouncesBeforeRender()')
      && fullRenderSource.indexOf('cancelPickupListDebouncesBeforeRender()') < fullRenderSource.indexOf('groupSnapshots.set('),
    '完整 render 必须先取消全部 pending debounce，再刷新当前 kind 快照与状态',
  )
  for (const helper of [
    'renderStandardListPage',
    'renderStandardListStats',
    'renderStandardListTable',
    'renderTablePagination',
    'renderStandardListColumnSettings',
  ]) {
    assert(listSource.includes(helper), `三列表页面必须复用 ${helper}`)
  }
  for (const renderer of [
    'renderCraftCuttingPickupReadyPage',
    'renderCraftCuttingPickupIncompletePage',
    'renderCraftCuttingPickupHistoryPage',
  ]) {
    assert(listSource.includes(`export function ${renderer}`), `缺少薄页面渲染函数 ${renderer}`)
    assert(rendererSource.includes(`'${renderer}'`), `路由渲染器必须导出 ${renderer}`)
  }
  for (const path of [
    '/fcs/craft/cutting/pickup-management/ready',
    '/fcs/craft/cutting/pickup-management/incomplete',
    '/fcs/craft/cutting/pickup-management/history',
  ]) {
    assert(routeSource.includes(`'${path}'`), `缺少独立领料列表路由 ${path}`)
    assert(menuSource.includes(`href: '${path}'`), `缺少独立领料子菜单 ${path}`)
  }
  assert(
    routeSource.includes("'/fcs/craft/cutting/pickup-management': () =>")
      && routeSource.includes("renderRouteRedirect('/fcs/craft/cutting/pickup-management/ready'"),
    '旧领料管理路由必须重定向到规范的已配齐待领料路由',
  )
  const legacyPath = '/fcs/craft/cutting/pickup-management'
  const legacyMeta = getCanonicalCuttingMeta(legacyPath)
  assert(legacyMeta.key === 'pickup-management', '旧领料路径必须唯一归属兼容入口元数据')
  assert(legacyMeta.canonicalPath === legacyPath, '旧领料路径必须保留唯一 canonical 语义')
  assert(!isCuttingAliasPath(legacyPath), '旧领料路径不得同时被识别为新列表 alias')
  assert(
    (metaSource.match(/canonicalPath: '\/fcs\/craft\/cutting\/pickup-management'/g) ?? []).length === 1
      && !metaSource.includes("aliases: ['/fcs/craft/cutting/pickup-management']"),
    '旧领料路径不得存在重复 path ownership',
  )
  for (const deprecatedPath of [
    '/fcs/craft/cutting/pickup-ready',
    '/fcs/craft/cutting/pickup-incomplete',
    '/fcs/craft/cutting/pickup-history',
  ]) {
    assert(!routeSource.includes(`'${deprecatedPath}'`), `不得保留未发布的缩写路由 ${deprecatedPath}`)
    assert(!menuSource.includes(`'${deprecatedPath}'`), `菜单不得使用缩写路由 ${deprecatedPath}`)
    assert(!listSource.includes(deprecatedPath), `列表源码不得使用缩写路由 ${deprecatedPath}`)
  }
  assert(menuSource.includes("title: '领料管理'"), '领料管理必须作为独立一级菜单')
  for (const title of ['已配齐待领料', '未配齐配料', '已领料']) {
    assert(menuSource.includes(`title: '${title}'`), `菜单必须使用完整文案：${title}`)
    assert(metaSource.includes(`pageTitle: '${title}'`), `页面元数据必须使用完整文案：${title}`)
    assert(listSource.includes(`return '${title}'`), `页面标题必须使用完整文案：${title}`)
  }
  assert(
    !/title: '裁前准备'[\s\S]*?href: '\/fcs\/craft\/cutting\/pickup-management'/.test(menuSource),
    '裁前准备不得保留旧领料管理菜单',
  )
  for (const key of ['pickup-ready', 'pickup-incomplete', 'pickup-history']) {
    assert(metaSource.includes(`'${key}'`), `页面元数据缺少 ${key}`)
  }
  assert(
    (metaSource.match(/menuGroupTitle: '领料管理'/g) ?? []).length >= 3,
    '三个新页面元数据必须归属领料管理',
  )
}

assertThreeListRouteAndMenuContract()

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
  const effectivePickedQty = roundQty(Math.max(projectionLine.pickedQty - projectionLine.returnedQty, 0))
  assert(materialRow.pickedQty === effectivePickedQty, `${materialRow.demandLineId} 已领数量必须扣除退回数量`)
  assert(
    materialRow.preparedQty === roundQty(materialRow.pickedQty + materialRow.currentAvailableQty),
    `${materialRow.demandLineId} 累计有效配料必须等于历史有效领料加当前节点可领量`,
  )
  assert(
    materialRow.overageQty === roundQty(Math.max(
      materialRow.pickedQty + materialRow.currentAvailableQty - materialRow.requiredQty,
      0,
    )),
    `${materialRow.demandLineId} 超配必须保留结构化异常数量，不能被零缺口吞掉`,
  )
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

const authoritativePickupSupplementIds = [
  'supplement-confirmed-000TDWG',
  'supplement-confirmed-00ASZLF',
  'supplement-confirmed-0JPEXI9',
  'supplement-confirmed-0JFFBTA',
].sort()
const listPo0002SupplementIds = () => listSupplementRecords()
  .filter((record) => record.draft.productionOrderId === 'PO-202603-0002')
  .map((record) => record.id)
  .sort()

resetSupplementManagementMockDataForTest()
const supplementCountBeforeRuntimeList = listSupplementRecords().length
listActivePickupNodes(null)
assert(
  listSupplementRecords().length === supplementCountBeforeRuntimeList,
  'runtime list* 必须保持纯读，不得隐式写入补料 Mock Store',
)
bootstrapSupplementManagementMockData()
assert(
  JSON.stringify(listPo0002SupplementIds()) === JSON.stringify(authoritativePickupSupplementIds),
  '页面先 bootstrap 时必须先建立并保留 4 条权威 pickup supplement identity',
)

resetSupplementManagementMockDataForTest()
bootstrapPickupManagementRuntimeMockData()
assert(
  JSON.stringify(listPo0002SupplementIds()) === JSON.stringify(authoritativePickupSupplementIds),
  'runtime 先初始化时必须建立同一组 4 条权威 pickup supplement identity',
)
bootstrapSupplementManagementMockData()
assert(
  JSON.stringify(listPo0002SupplementIds()) === JSON.stringify(authoritativePickupSupplementIds),
  'runtime 先初始化后页面 bootstrap 不得覆盖 4 条权威 pickup supplement identity',
)
const supplementRecords = listSupplementRecords().filter((record) => record.status === '已确认')
const dyeResults = listPlatformDyeResultViews()
const printResults = listPlatformPrintResultViews()
assert(supplementRecords.length === 12, '补料页面与领料 runtime 必须共享单一的 12 条权威 Mock 初始化')
assert(
  new Set(supplementRecords.map((record) => record.id)).size === supplementRecords.length,
  '全部补料记录 id 必须唯一，不得跨生产单复用身份',
)
assert(
  new Set(supplementRecords.map((record) => record.recordNo)).size === supplementRecords.length,
  '全部补料单号必须唯一，不得跨生产单复用单号',
)
assert(
  new Set(supplementRecords.map((record) => record.confirmationKey)).size === supplementRecords.length,
  '全部补料确认键必须唯一，不得跨生产单复用确认身份',
)
supplementRecords.flatMap((record) => record.processWorkOrderRefs).forEach((ref) => {
  assert(getProcessWorkOrderById(ref.workOrderId), `补料加工单引用必须可解析：${ref.workOrderId}`)
  const processResults = ref.processType === 'DYE' ? dyeResults : printResults
  assert(
    processResults.some((result) =>
      result.sourceId === ref.workOrderId && result.workOrderNo === ref.workOrderNo
    ),
    `补料加工单必须有可解析的平台结果引用：${ref.workOrderNo}`,
  )
})
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

const atomicRollbackStorage = new MemoryStorage()
atomicRollbackStorage.setItem(
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()),
)
atomicRollbackStorage.setItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, '{"events":[]}')
const atomicRollbackNode = listActivePickupNodes(atomicRollbackStorage)[0]
assert(atomicRollbackNode, '原子领料回滚测试必须存在活动节点')
const prepBeforeAtomicFailure = atomicRollbackStorage.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY)
const ledgerBeforeAtomicFailure = atomicRollbackStorage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
let atomicFailureBlocked = false
try {
  appendPickupSessionWithWarehouseFactsRuntime({
    pickupNodeId: atomicRollbackNode.nodeId,
    pickupNodeVersion: atomicRollbackNode.version,
    receiverName: '原子回滚校验员',
    warehouseArea: '待加工仓原子区',
    locationCode: 'ATOMIC-01',
    waitProcessLedgerEventId: 'atomic:rollback',
    idempotencyKey: `atomic:${atomicRollbackNode.nodeId}:v${atomicRollbackNode.version}`,
  }, (_session, transactionStorage) => {
    transactionStorage?.setItem?.(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, '{"events":[{"partial":true}]}')
    throw new Error('模拟待加工仓流水写入失败')
  }, atomicRollbackStorage)
} catch (error) {
  atomicFailureBlocked = error instanceof Error && error.message.includes('模拟待加工仓流水写入失败')
}
assert(atomicFailureBlocked, '待加工仓流水写入失败必须将整次领料确认为失败')
assert(
  atomicRollbackStorage.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY) === prepBeforeAtomicFailure
  && atomicRollbackStorage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY) === ledgerBeforeAtomicFailure,
  '领料会话、领料明细和待加工仓流水必须一起回滚，不得留下中间状态',
)

const atomicSuccessStorage = new MemoryStorage()
atomicSuccessStorage.setItem(
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()),
)
atomicSuccessStorage.setItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, '{"events":[]}')
const atomicSuccessNode = listActivePickupNodes(atomicSuccessStorage)[0]
assert(atomicSuccessNode, '原子领料成功测试必须存在活动节点')
const atomicSession = appendPickupSessionWithWarehouseFactsRuntime({
  pickupNodeId: atomicSuccessNode.nodeId,
  pickupNodeVersion: atomicSuccessNode.version,
  receiverName: '原子成功校验员',
  warehouseArea: '待加工仓原子区',
  locationCode: 'ATOMIC-02',
  waitProcessLedgerEventId: 'atomic:success',
  idempotencyKey: `atomic:${atomicSuccessNode.nodeId}:v${atomicSuccessNode.version}`,
}, (session, transactionStorage) => {
  transactionStorage?.setItem?.(
    CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY,
    JSON.stringify({ events: [{ pickupSessionId: session.pickupSessionId }] }),
  )
}, atomicSuccessStorage)
assert(
  atomicSuccessStorage.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY)?.includes(atomicSession.pickupSessionId)
  && atomicSuccessStorage.getItem(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)?.includes(atomicSession.pickupSessionId),
  '领料会话、领料明细和待加工仓流水必须在同一次确认中共同形成',
)

const projections = listMaterialPrepOrderProjections(storage)
const activeNodes = listActivePickupNodes(storage)
const groupsByKind = new Map<PickupListKind, PickupOrderGroup[]>()

const unifiedFactStorage = new MemoryStorage()
unifiedFactStorage.setItem(
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()),
)
const po0002Node = listActivePickupNodes(unifiedFactStorage)
  .find((node) => node.productionOrderId === 'PO-202603-0002')
assert(po0002Node, 'PO-202603-0002 必须存在真实当前待领节点')
const po0002SupplementItems = po0002Node.items.filter((item) =>
  item.prepLineId.startsWith('SUPPLEMENT:')
)
assert(
  po0002SupplementItems.length === 4,
  'PO-202603-0002 当前真实节点必须包含 4 条独立 SUPPLEMENT 需求，不能继续挂在正常物料行',
)
const po0002CurrentGroup = listPickupOrderGroups(
  po0002Node.nodeType === 'READY_TO_PICKUP' ? 'READY' : 'INCOMPLETE',
  unifiedFactStorage,
).find((group) => group.productionOrderId === po0002Node.productionOrderId)
assert(po0002CurrentGroup, 'PO-202603-0002 当前节点必须进入对应 Web 列表')
const po0002HistoryBeforePickup = listPickupOrderGroups('HISTORY', unifiedFactStorage)
  .find((group) => group.productionOrderId === po0002Node.productionOrderId)
assert(
  po0002HistoryBeforePickup?.finalResult === 'NEW_SUPPLEMENT_WAIT_PICKUP',
  'PO-202603-0002 原需求领完后四条真实补料必须重新打开历史最终结果',
)
assert(
  po0002HistoryBeforePickup.groupKey !== po0002CurrentGroup.groupKey
  && po0002HistoryBeforePickup.materialRows.every((historyRow) =>
    po0002CurrentGroup.materialRows.every((currentRow) => historyRow.rowKey !== currentRow.rowKey)
  ),
  '真实补料重开后同一生产单跨列表的分组和物料行主键不得冲突',
)
for (const item of po0002Node.items) {
  const row = po0002CurrentGroup.materialRows.find((candidate) =>
    candidate.demandLineId === item.prepLineId && candidate.unit === item.unit
  )
  assert(row, `${item.prepLineId} ${item.unit} 必须由同一需求事实生成 Web 行`)
  assert(
    row.currentAvailableQty === item.currentAvailableQty,
    `${item.prepLineId} ${item.unit} Web 当前可领必须与节点一致`,
  )
  assert(
    item.sourceLocations.reduce((sum, location) => sum + location.currentAvailableQty, 0)
      === item.currentAvailableQty,
    `${item.prepLineId} ${item.unit} 节点来源库位合计必须等于当前可领`,
  )
  if (po0002Node.carrierType === 'WAREHOUSE_LOCATIONS') {
    assert(
      row.currentLocations.reduce((sum, location) => sum + location.currentAvailableQty, 0)
        === row.currentAvailableQty,
      `${item.prepLineId} ${item.unit} Web 库位合计必须等于当前可领`,
    )
  } else {
    assert(row.currentLocations.length === 0, 'READY 托盘节点不得继续显示已释放库位')
  }
}
const po0002Session = appendPickupSessionFromNode({
  pickupNodeId: po0002Node.nodeId,
  pickupNodeVersion: po0002Node.version,
  receiverName: '统一需求事实校验员',
  warehouseArea: '待加工仓统一事实区',
  locationCode: 'FAB-UNIFIED-01',
  waitProcessLedgerEventId: `unified-demand:${po0002Node.nodeId}`,
  idempotencyKey: `unified-demand:${po0002Node.nodeId}:v${po0002Node.version}`,
}, unifiedFactStorage)
const po0002AfterProjection = listMaterialPrepOrderProjections(unifiedFactStorage)
  .find((projection) => projection.order.productionOrderId === po0002Node.productionOrderId)
assert(po0002AfterProjection, 'PO-202603-0002 领料后必须保留配料投影')
const po0002SessionRecords = po0002AfterProjection.pickupRecords.filter((record) =>
  record.pickupSessionId === po0002Session.pickupSessionId
)
assert(
  po0002SupplementItems.every((item) =>
    po0002SessionRecords.some((record) =>
      record.prepLineId === item.prepLineId && record.pickedQty === item.currentAvailableQty
    )
  ),
  'PDA 真实确认必须为节点内每条补料需求生成同 lineId 数量的 PickupRecord',
)
const po0002History = listPickupOrderGroups('HISTORY', unifiedFactStorage)
  .find((group) => group.productionOrderId === po0002Node.productionOrderId)
assert(
  po0002History?.finalResult === 'ALL_PICKED',
  'PO-202603-0002 四条补料整节点领取后历史必须由统一事实回到全部领完',
)
const [partialSupplementPickup, fullSupplementPickup] = po0002SessionRecords
  .filter((record) => record.prepLineId.startsWith('SUPPLEMENT:'))
assert(partialSupplementPickup && fullSupplementPickup, '补料退回回归必须有至少两条真实补料领料明细')
const partialAllocation = partialSupplementPickup.sourceAllocations?.[0]
const fullAllocation = fullSupplementPickup.sourceAllocations?.[0]
assert(partialAllocation && fullAllocation, '补料领料明细必须保留精确来源分摊')
const partialReturnQty = Number((partialAllocation.pickedQty / 2).toFixed(2))
const partialReturn = appendPickupReturnRecord({
  pickupRecordId: partialSupplementPickup.pickupRecordId,
  prepRecordId: partialAllocation.prepRecordId,
  prepLineId: partialAllocation.prepLineId,
  returnQty: partialReturnQty,
  rollCount: partialAllocation.rollCount,
  reason: '数量不符',
  remark: '补料部分退回真实链回归',
  imageNames: [],
  returnedBy: '统一需求事实校验员',
}, unifiedFactStorage)
const fullReturn = appendPickupReturnRecord({
  pickupRecordId: fullSupplementPickup.pickupRecordId,
  prepRecordId: fullAllocation.prepRecordId,
  prepLineId: fullAllocation.prepLineId,
  returnQty: fullAllocation.pickedQty,
  rollCount: fullAllocation.rollCount,
  reason: '数量不符',
  remark: '补料全部退回真实链回归',
  imageNames: [],
  returnedBy: '统一需求事实校验员',
}, unifiedFactStorage)
assert(
  partialReturn.unit === partialAllocation.unit
  && fullReturn.unit === fullAllocation.unit
  && partialReturn.prepRecordId === partialAllocation.prepRecordId
  && fullReturn.prepRecordId === fullAllocation.prepRecordId,
  '补料退回必须按来源分摊解析单位和配料来源，不得按 SKU 猜测',
)
assert(
  partialReturn.sourceWarehouseName === partialAllocation.sourceWarehouseName
  && partialReturn.sourceWarehouseArea === partialAllocation.sourceWarehouseArea
  && partialReturn.sourceLocationCode === partialAllocation.sourceLocationCode
  && fullReturn.sourceWarehouseName === fullAllocation.sourceWarehouseName
  && fullReturn.sourceWarehouseArea === fullAllocation.sourceWarehouseArea
  && fullReturn.sourceLocationCode === fullAllocation.sourceLocationCode,
  '补料退回必须保留精确来源仓、库区和库位',
)
const po0002ReturnedNode = listActivePickupNodes(unifiedFactStorage)
  .find((node) => node.productionOrderId === po0002Node.productionOrderId)
assert(po0002ReturnedNode, '补料部分/全部退回后当前待领节点必须重新出现')
const partialReturnedItem = po0002ReturnedNode.items.find((item) =>
  item.prepLineId === partialAllocation.prepLineId
)
const fullReturnedItem = po0002ReturnedNode.items.find((item) =>
  item.prepLineId === fullAllocation.prepLineId
)
assert(
  partialReturnedItem?.currentAvailableQty === partialReturnQty
  && fullReturnedItem?.currentAvailableQty === fullAllocation.pickedQty,
  '补料退回数量必须精确回到对应来源的当前可领数量',
)
const po0002ReturnedProjection = listMaterialPrepOrderProjections(unifiedFactStorage)
  .find((projection) => projection.order.productionOrderId === po0002Node.productionOrderId)
assert(po0002ReturnedProjection, '补料退回后必须保留生产单投影')
const partialEffectiveRecord = po0002ReturnedProjection.pickupRecords.find((record) =>
  record.pickupRecordId === partialSupplementPickup.pickupRecordId
)
const fullEffectiveRecord = po0002ReturnedProjection.pickupRecords.find((record) =>
  record.pickupRecordId === fullSupplementPickup.pickupRecordId
)
assert(
  partialEffectiveRecord?.returnQty === partialReturnQty
  && fullEffectiveRecord?.returnQty === fullAllocation.pickedQty,
  '补料退回后 PickupRecord 有效已领必须分别反映部分退回与全部退回',
)
const po0002ReturnedHistory = listPickupOrderGroups('HISTORY', unifiedFactStorage)
  .find((group) => group.productionOrderId === po0002Node.productionOrderId)
assert(
  po0002ReturnedHistory?.finalResult === 'NOT_ALL_PICKED'
  || po0002ReturnedHistory?.finalResult === 'NEW_SUPPLEMENT_WAIT_PICKUP',
  '补料领取后发生退回，历史最终结果必须回到未领完或新增补料待领，不能仍是全部领完',
)

const versionStorage = new MemoryStorage()
versionStorage.setItem(
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  serializeProductionMaterialPrepStore(createProductionMaterialPrepSeedStore()),
)
const versionProjections = listMaterialPrepOrderProjections(versionStorage)
const versionFacts = buildPickupDemandFactsFromProjections({
  projections: versionProjections,
  supplementRecords,
  dyeResults,
  printResults,
})
const initialVersionNode = listActivePickupNodesWithFacts(versionStorage, versionFacts)
  .find((node) => node.productionOrderId === 'PO-202603-0004')
assert(initialVersionNode, '完整 coverage 指纹回归必须有未配齐活动节点')
const addedUnpreparedDemand = {
  ...versionFacts.find((fact) => fact.prepOrderId === initialVersionNode.prepOrderId)!,
  demandLineId: 'SUPPLEMENT:VERSION-COVERAGE:UNPREPARED',
  demandSource: 'SUPPLEMENT' as const,
  demandSourceNo: 'SUP-VERSION-COVERAGE',
  demandSequence: 999,
  demandCreatedAt: '2026-03-30 09:00',
  supplementReason: '版本指纹回归',
  materialSku: 'version-coverage-material',
  materialName: '尚未配料的新增补料',
  processRoute: 'NONE' as const,
  processBasisLabel: '按补料批准数量',
  processComplete: true,
  requiredQty: 12,
  pickedQty: 0,
}
const versionFactsAfter = [...versionFacts, addedUnpreparedDemand]
const changedCoverageNode = listActivePickupNodesWithFacts(versionStorage, versionFactsAfter)
  .find((node) => node.nodeId === initialVersionNode.nodeId)
assert(
  changedCoverageNode?.version === initialVersionNode.version + 1,
  '新增未配料补料即使节点类型和可领 items 暂未变化，也必须因完整 coverage 指纹递增版本',
)
let staleVersionBlocked = false
try {
  appendPickupSessionFromNodeWithFacts({
    pickupNodeId: initialVersionNode.nodeId,
    pickupNodeVersion: initialVersionNode.version,
    receiverName: '旧版本校验员',
    warehouseArea: '待加工仓版本校验区',
    locationCode: 'FAB-VERSION-01',
    waitProcessLedgerEventId: 'version-coverage:stale',
  }, versionStorage, versionFactsAfter)
} catch (error) {
  staleVersionBlocked = error instanceof Error && error.message.includes('当前待领物料已更新')
}
assert(staleVersionBlocked, '完整 coverage 变化后旧版本确认必须被阻断')

const processingNode = activeNodes.find((node) => node.productionOrderId === 'PO-202603-1103')
assert(processingNode, 'PO-202603-1103 必须存在用于加工未完成反例的真实节点')
assert(
  !processingNode.items.some((item) => item.prepLineId === 'prep-line-po-1103-dye-main'),
  '染色仍 PROCESSING 时即使存在正数配料，也不得进入真实待领节点或 READY 覆盖判断',
)
assert(
  processingNode.nodeType === 'INCOMPLETE_PICKABLE',
  '染色仍 PROCESSING 的必需需求必须阻断 READY，不能因 requiredQty=0 被视为已满足',
)

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
function hasReliableNewSupplementEvidence(
  group: PickupOrderGroup,
  matchingProjections: MaterialPrepOrderProjection[],
): boolean {
  const pickupRecords = matchingProjections.flatMap((projection) => projection.pickupRecords)
  const sessions = matchingProjections.flatMap((projection) => projection.pickupSessions)
  return sessions.some((session) => {
    const snapshot = session.pickupNodeSnapshot
    if (
      session.nodeType !== 'READY_TO_PICKUP'
      || !snapshot
      || snapshot.nodeId !== session.pickupNodeId
      || snapshot.version !== session.pickupNodeVersion
      || snapshot.nodeType !== session.nodeType
      || snapshot.productionOrderId !== session.productionOrderId
      || snapshot.prepOrderId !== session.prepOrderId
    ) return false
    const cumulativeByLineAndUnit = new Map<string, number>()
    pickupRecords
      .filter((record) => record.pickedAt <= session.pickedAt)
      .forEach((record) => {
        const units = new Set((record.sourceAllocations || []).map((allocation) => allocation.unit).filter(Boolean))
        if (units.size !== 1) return
        const unit = Array.from(units)[0]
        const key = `${record.prepLineId}\u0000${unit}`
        const effectiveQty = Number.isFinite(record.waitProcessAvailableQty)
          ? Math.max(record.waitProcessAvailableQty || 0, 0)
          : Math.max(record.pickedQty - (record.returnQty || 0), 0)
        cumulativeByLineAndUnit.set(key, (cumulativeByLineAndUnit.get(key) || 0) + effectiveQty)
      })
    const existingDemandsAllPicked = group.materialRows
      .filter((row) =>
        row.demandCreatedAt
          && comparePickupDemandEventTime(row.demandCreatedAt, session.pickedAt) !== 'AFTER'
      )
      .every((row) =>
        row.requiredQty <= 0
          || (cumulativeByLineAndUnit.get(`${row.demandLineId}\u0000${row.unit}`) || 0) >= row.requiredQty
      )
    const hasNewUnpickedSupplement = group.materialRows.some((row) =>
      row.demandSource === 'SUPPLEMENT'
        && comparePickupDemandEventTime(row.demandCreatedAt, session.pickedAt) === 'AFTER'
        && row.pickedQty < row.requiredQty
    )
    return existingDemandsAllPicked && hasNewUnpickedSupplement
  })
}
for (const group of historyGroups) {
  const matchingProjections = projections
    .filter((projection) => projection.order.productionOrderId === group.productionOrderId)
  const sessions = matchingProjections.flatMap((projection) => projection.pickupSessions)
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
  const hasNewSupplement = hasReliableNewSupplementEvidence(group, matchingProjections)
  assert(
    group.finalResult === (
      hasNewSupplement
        ? 'NEW_SUPPLEMENT_WAIT_PICKUP'
        : allPicked
          ? 'ALL_PICKED'
          : 'NOT_ALL_PICKED'
    ),
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
  pickedQty = line.requiredQty,
): PickupRecord {
  const pickupRecordId = `PICKUP-RECORD-${session.pickupSessionId}`
  return {
    pickupRecordId,
    prepRecordId: `PREP-RECORD-${session.pickupSessionId}`,
    prepOrderId: session.prepOrderId,
    prepLineId: line.prepLineId,
    productionOrderId: session.productionOrderId,
    pickedQty,
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
      pickedQty,
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
const activeNodeAfterAllPicked = {
  ...historyReadySession.pickupNodeSnapshot!,
  nodeId: `${historyReadySession.pickupNodeId}:active`,
  version: historyReadySession.pickupNodeVersion + 1,
  status: 'OPEN' as const,
}
const activeAfterAllPickedHistory = buildHistoryScenarioGroups({
  lines: [{ ...historyScenarioLineB }],
  pickupSessions: [historyReadySession],
  pickupRecords: [historyReadyRecord],
  activeNodes: [activeNodeAfterAllPicked],
})[0]
assert(
  activeAfterAllPickedHistory?.finalResult === 'NOT_ALL_PICKED',
  '存在当前有效待领节点时，即使历史累计数量已覆盖应配，也不得判为 ALL_PICKED',
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
const reopenedProjection = buildHistoryScenarioProjection(
  [{ ...historyScenarioLineA }, { ...historyScenarioLineB }],
  [historyIncompleteSession, historyReadySession],
  [historyIncompleteRecord, historyReadyRecord],
)
const reopenedHistory = buildPickupOrderGroups({
  listKind: 'HISTORY',
  projections: [reopenedProjection],
  activeNodes: [],
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
const supplementDemandLineId = `SUPPLEMENT:${newSupplementRecord.id}:MAPPING-HISTORY-REOPEN`
const supplementScenarioLine = {
  ...historyScenarioLineA,
  prepLineId: supplementDemandLineId,
  materialSku: 'MAT-HISTORY-REOPEN',
  requiredQty: 2,
  confirmedPrepQty: 0,
  pickedQty: 0,
}
const supplementPartialSession = buildHistoryScenarioSession({
  sessionId: 'SESSION-SUPPLEMENT-PARTIAL',
  nodeType: 'INCOMPLETE_PICKABLE',
  pickedAt: '2026-03-18 12:00',
  snapshotLine: supplementScenarioLine,
})
const supplementCompleteSession = buildHistoryScenarioSession({
  sessionId: 'SESSION-SUPPLEMENT-COMPLETE',
  nodeType: 'READY_TO_PICKUP',
  pickedAt: '2026-03-18 13:00',
  snapshotLine: supplementScenarioLine,
})
const supplementPartialRecord = buildHistoryScenarioRecord(
  supplementPartialSession,
  supplementScenarioLine,
  1,
)
const supplementCompleteRecord = buildHistoryScenarioRecord(
  supplementCompleteSession,
  supplementScenarioLine,
  1,
)
const completedSupplementProjection = buildHistoryScenarioProjection(
  [{ ...historyScenarioLineA }, { ...historyScenarioLineB }],
  [
    historyIncompleteSession,
    historyReadySession,
    supplementPartialSession,
    supplementCompleteSession,
  ],
  [
    historyIncompleteRecord,
    historyReadyRecord,
    supplementPartialRecord,
    supplementCompleteRecord,
  ],
)
const completedSupplementHistory = buildPickupOrderGroups({
  listKind: 'HISTORY',
  projections: [completedSupplementProjection],
  activeNodes: [],
  supplementRecords: [newSupplementRecord],
  processResults: { dyeResults: [], printResults: [] },
})[0]
const completedSupplementRow = completedSupplementHistory?.materialRows.find((row) =>
  row.demandLineId === supplementDemandLineId
)
assert(
  completedSupplementRow?.pickedQty === 2
  && completedSupplementRow.remainingPickupQty === 0
  && completedSupplementHistory.finalResult === 'ALL_PICKED',
  '同一补料需求必须累计多条真实记录，完整领完后由 NEW 转为 ALL_PICKED',
)

const duplicateSupplementProjection = buildHistoryScenarioProjection(
  [{ ...historyScenarioLineA }, { ...historyScenarioLineB }],
  [historyIncompleteSession, historyReadySession, supplementPartialSession],
  [historyIncompleteRecord, historyReadyRecord, supplementPartialRecord, supplementPartialRecord],
)
const duplicateSupplementHistory = buildPickupOrderGroups({
  listKind: 'HISTORY',
  projections: [duplicateSupplementProjection],
  activeNodes: [],
  supplementRecords: [newSupplementRecord],
  processResults: { dyeResults: [], printResults: [] },
})[0]
assert(
  duplicateSupplementHistory?.materialRows.find((row) => row.demandLineId === supplementDemandLineId)
    ?.pickedQty === 0
  && duplicateSupplementHistory.finalResult === 'NEW_SUPPLEMENT_WAIT_PICKUP',
  '重复 pickupRecordId 必须使该会话失效，不得把同一记录重复累计为补料已领',
)

const returnedSupplementRecord = {
  ...supplementPartialRecord,
  returnQty: 1,
  waitProcessAvailableQty: 0,
  returnStatus: '全部退回' as const,
}
const returnedSupplementProjection = buildHistoryScenarioProjection(
  [{ ...historyScenarioLineA }, { ...historyScenarioLineB }],
  [
    historyIncompleteSession,
    historyReadySession,
    supplementPartialSession,
    supplementCompleteSession,
  ],
  [
    historyIncompleteRecord,
    historyReadyRecord,
    returnedSupplementRecord,
    supplementCompleteRecord,
  ],
)
const returnedSupplementHistory = buildPickupOrderGroups({
  listKind: 'HISTORY',
  projections: [returnedSupplementProjection],
  activeNodes: [],
  supplementRecords: [newSupplementRecord],
  processResults: { dyeResults: [], printResults: [] },
})[0]
assert(
  returnedSupplementHistory?.materialRows.find((row) => row.demandLineId === supplementDemandLineId)
    ?.pickedQty === 1
  && returnedSupplementHistory.materialRows.find((row) => row.demandLineId === supplementDemandLineId)
    ?.remainingPickupQty === 1,
  '补料真实领料发生全部退回后必须按 waitProcessAvailableQty 重新形成缺口',
)

const sameTimeSupplementRecord = {
  ...newSupplementRecord,
  id: 'SUPPLEMENT-SAME-TIME',
  recordNo: 'BL-SAME-TIME',
  createdAt: historyReadySession.pickedAt,
  draft: {
    ...newSupplementRecord.draft,
    materialDemands: [{
      ...newSupplementRecord.draft.materialDemands[0],
      materialPatternMappingId: 'MAPPING-SAME-TIME',
      requiredQty: 1,
    }],
  },
}
assert(
  comparePickupDemandEventTime('2026-03-18 10:00', '2026-03-18 10:00:30') === 'UNKNOWN'
  && comparePickupDemandEventTime('2026-03-18 10:01', '2026-03-18 10:00:59') === 'AFTER'
  && comparePickupDemandEventTime('2026-03-18 09:59:59', '2026-03-18 10:00') === 'BEFORE',
  '补料与领料跨域时间必须按 BEFORE / AFTER / UNKNOWN 三态比较，精度重叠不得猜先后',
)
const sameTimeUnpickedHistory = buildPickupOrderGroups({
  listKind: 'HISTORY',
  projections: [buildHistoryScenarioProjection(
    [{ ...historyScenarioLineB }],
    [historyReadySession],
    [historyReadyRecord],
  )],
  activeNodes: [],
  supplementRecords: [sameTimeSupplementRecord],
  processResults: { dyeResults: [], printResults: [] },
})[0]
assert(
  sameTimeUnpickedHistory?.finalResult === 'NOT_ALL_PICKED',
  '补料与领料时间区间重叠且补料未领时顺序证据不足，必须保守 NOT_ALL_PICKED',
)
const sameTimeDemandLineId = `SUPPLEMENT:${sameTimeSupplementRecord.id}:MAPPING-SAME-TIME`
const sameTimeSupplementLine = {
  ...supplementScenarioLine,
  prepLineId: sameTimeDemandLineId,
  requiredQty: 1,
}
const sameTimePickupSession = buildHistoryScenarioSession({
  sessionId: 'SESSION-SUPPLEMENT-SAME-TIME',
  nodeType: 'READY_TO_PICKUP',
  pickedAt: sameTimeSupplementRecord.createdAt,
  snapshotLine: sameTimeSupplementLine,
})
const sameTimePickedHistory = buildPickupOrderGroups({
  listKind: 'HISTORY',
  projections: [buildHistoryScenarioProjection(
    [{ ...historyScenarioLineB }],
    [historyReadySession, sameTimePickupSession],
    [historyReadyRecord, buildHistoryScenarioRecord(
      sameTimePickupSession,
      sameTimeSupplementLine,
      1,
    )],
  )],
  activeNodes: [],
  supplementRecords: [sameTimeSupplementRecord],
  processResults: { dyeResults: [], printResults: [] },
})[0]
assert(
  sameTimePickedHistory?.materialRows.find((row) => row.demandLineId === sameTimeDemandLineId)
    ?.pickedQty === 1
  && sameTimePickedHistory.finalResult === 'ALL_PICKED',
  '补料与领料等时但真实逐行记录已覆盖需求时，应按领取事实判为 ALL_PICKED',
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
const fakeLegacySession = buildHistoryScenarioSession({
  sessionId: 'SESSION-HISTORY-FAKE-LEGACY',
  nodeType: 'INCOMPLETE_PICKABLE',
  pickedAt: '2026-03-18 11:45',
  snapshotLine: historyScenarioLineA,
})
fakeLegacySession.pickupNodeSnapshot = undefined
const fakeLegacyRecord = {
  ...buildHistoryScenarioRecord(fakeLegacySession, historyScenarioLineA),
  sourceAllocations: undefined,
}
const mixedWithFakeLegacyHistory = buildHistoryScenarioGroups({
  lines: [{ ...historyScenarioLineB }],
  pickupSessions: [historyReadySession, fakeLegacySession],
  pickupRecords: [historyReadyRecord, fakeLegacyRecord],
})[0]
assert(
  mixedWithFakeLegacyHistory?.historyPath === 'READY_PICKUP'
  && mixedWithFakeLegacyHistory.pickupSessionCount === 1
  && mixedWithFakeLegacyHistory.latestPickedAt === historyReadySession.pickedAt,
  '没有 migrationEvidence 的无 sourceAllocations 伪 legacy 会话不得污染真实 READY 历史',
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
