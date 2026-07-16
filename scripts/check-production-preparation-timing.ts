#!/usr/bin/env tsx

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
  EMPTY_PREPARATION_RUNTIME_STATE,
  PREPARATION_RUNTIME_STORAGE_KEY,
  appendDownloadRecord,
  isBasePatternItem,
  mergePreparationRuntimeRecords,
} from '../src/data/fcs/production-preparation-timing-runtime.ts'

function source(path: string): string {
  assert.ok(existsSync(path), `${path} 不存在`)
  return readFileSync(path, 'utf8')
}

function assertIncludes(path: string, text: string, message: string): void {
  assert.ok(source(path).includes(text), message)
}

function assertHtmlIncludes(html: string, text: string, message: string): void {
  assert.ok(html.includes(text), message)
}

function detailDrawerHtml(html: string, recordNo: string): string {
  const asideStart = html.indexOf('<aside')
  assert.ok(asideStart >= 0, '详情抽屉未找到起始标签')
  const asideEnd = html.indexOf('</aside>', asideStart)
  assert.ok(asideEnd > asideStart, '详情抽屉未找到结束标签')
  const drawer = html.slice(asideStart, asideEnd + '</aside>'.length)
  assert.ok(drawer.includes(recordNo), `详情抽屉不是 ${recordNo}`)
  return drawer
}

function getCompletedItemCount(items: Array<{ status: string }>): number {
  return items.filter((item) => item.status === '已完成').length
}

function getOverdueItemCount(items: Array<{ status: string; overdueHours: number }>): number {
  return items.filter((item) => item.status === '已超时' || item.overdueHours > 0).length
}

function getCompletedCount(stats: Array<{ itemType: string; completedCount: number }>, itemType: string): number {
  const row = stats.find((item) => item.itemType === itemType)
  assert.ok(row, `2026-03 统计缺少${itemType}`)
  return row.completedCount
}

for (const file of [
  'src/data/fcs/production-preparation-timing.ts',
  'src/pages/production/preparation-timing.ts',
  'src/data/app-shell-config.ts',
  'src/router/routes-fcs.ts',
  'src/router/route-renderers-fcs.ts',
  'src/router/route-renderers.ts',
] as const) {
  assert.ok(existsSync(file), `${file} 不存在`)
}

const productionPreparationDataModule = await import('../src/data/fcs/production-preparation-timing.ts') as {
  buildPreparationOutputs: typeof import('../src/data/fcs/production-preparation-timing.ts').buildPreparationOutputs
  buildMonthlyPreparationCompletionDetails: typeof import('../src/data/fcs/production-preparation-timing.ts').buildMonthlyPreparationCompletionDetails
  buildMonthlyPreparationStats: typeof import('../src/data/fcs/production-preparation-timing.ts').buildMonthlyPreparationStats
  filterProductionPreparationRecords: typeof import('../src/data/fcs/production-preparation-timing.ts').filterProductionPreparationRecords
  flattenProductionPreparationItems: typeof import('../src/data/fcs/production-preparation-timing.ts').flattenProductionPreparationItems
  derivePreparationItemProgress: typeof import('../src/data/fcs/production-preparation-timing.ts').derivePreparationItemProgress
  hasValidPreparationCompletionEvidence: typeof import('../src/data/fcs/production-preparation-timing.ts').hasValidPreparationCompletionEvidence
  externalPreparationMaterials: typeof import('../src/data/fcs/production-preparation-timing.ts').externalPreparationMaterials
  preparationItemOwnerTeamMap: typeof import('../src/data/fcs/production-preparation-timing.ts').preparationItemOwnerTeamMap
  preparationOwnerRoleRules: Array<{ ownerTeam: string; roleLabels: string[]; actionScope: string }>
  preparationOwnerTeams: string[]
  preparationTypeDefaultItems: typeof import('../src/data/fcs/production-preparation-timing.ts').preparationTypeDefaultItems
  productionPreparationRecords: typeof import('../src/data/fcs/production-preparation-timing.ts').productionPreparationRecords
}
const { externalPreparationMaterials, preparationOwnerRoleRules, preparationOwnerTeams } = productionPreparationDataModule
assert.ok(externalPreparationMaterials.length >= 100, '非系统内物料初始化数据必须完整覆盖业务清单')
assert.equal(externalPreparationMaterials[0]?.serialNo, 1, '非系统内物料序号必须从 1 开始')
assert.equal(
  externalPreparationMaterials[0]?.materialName,
  '印花雪纺Printing seruti S388-1',
  '非系统内物料必须保留原始名称，不拆分中英文和规格',
)
assert.ok(Array.isArray(preparationOwnerRoleRules), '生产准备数据必须导出 preparationOwnerRoleRules')
assert.ok(preparationOwnerRoleRules.length >= 6, '责任团队角色映射必须覆盖主要准备团队')
for (const team of preparationOwnerTeams) {
  assert.ok(preparationOwnerRoleRules.some((rule) => rule.ownerTeam === team), `责任团队 ${team} 缺少角色映射`)
}
assert.deepEqual(
  productionPreparationDataModule.preparationItemOwnerTeamMap,
  {
    梭织基码纸样: '版师团队',
    毛织基码纸样: '毛织团队',
    版衣制作: '车板团队',
    梭织齐码纸样: '版师团队',
    毛织齐码纸样: '毛织团队',
    '数码印/DTF/DTG花型': '花型团队',
    '确认染色要求（纱线）': '跟单角色',
    '染色调色（纱线）': '染色团队',
    '确认染色要求（面料）': '跟单角色',
    '染色调色（面料）': '染色团队',
    辅料下单: '采购团队',
  },
  '准备项责任团队固定映射必须完整且准确',
)

function materialLines(record: {
  materialRequirement?: {
    materialNo?: string
    materialName?: string
    materialType?: string
    imageUrl?: string
    requiredQty?: number
    preparedQty?: number
    issuedQty?: number
    unit?: string
    items?: Array<{
      materialSource?: string
      externalSerialNo?: number
      materialNo?: string
      materialName?: string
      materialType?: string
      imageUrl?: string
      requiredQty?: number
      preparedQty?: number
      issuedQty?: number
      unit?: string
    }>
  }
}) {
  const requirement = record.materialRequirement
  if (!requirement) return []
  return requirement.items?.length ? requirement.items : [requirement]
}

for (const record of productionPreparationDataModule.productionPreparationRecords) {
  const lines = materialLines(record)
  assert.ok(lines.length > 0, `${record.recordNo} 必须有本次用料明细`)
  for (const material of lines) {
    assert.ok(material.materialName, `${record.recordNo} 本次用料必须有物料名称`)
    if (material.materialSource === '非系统内物料') {
      assert.ok(material.externalSerialNo, `${record.recordNo} 非系统内物料必须有序号`)
      continue
    }
    assert.ok(material.materialNo, `${record.recordNo} 本次用料必须有物料编码`)
    assert.ok(material.materialType, `${record.recordNo} 本次用料必须有物料类型`)
    assert.ok(material.imageUrl?.startsWith('https://images.unsplash.com/'), `${record.recordNo} 本次用料必须有真实图片 URL`)
    assert.equal(typeof material.requiredQty, 'number', `${record.recordNo} 本次用料必须有应备数量`)
    assert.equal(typeof material.preparedQty, 'number', `${record.recordNo} 本次用料必须有已配数量`)
    assert.equal(typeof material.issuedQty, 'number', `${record.recordNo} 本次用料必须有已领数量`)
    assert.ok(material.unit, `${record.recordNo} 本次用料必须有单位`)
  }
}
const externalMaterialRecord = productionPreparationDataModule.productionPreparationRecords.find((record) =>
  record.materialRequirement.items?.some((material) => material.materialSource === '非系统内物料'),
)
assert.ok(externalMaterialRecord, 'mock 数据必须包含已选择非系统内物料的准备记录')
const accessoryItemWithOrders = productionPreparationDataModule.productionPreparationRecords
  .flatMap((record) => record.items)
  .find((item) => item.itemType === '辅料下单' && item.accessoryPurchaseOrderNos?.length)
assert.ok(accessoryItemWithOrders, '辅料下单 mock 必须包含面辅料采购单号')
assert.ok(!accessoryItemWithOrders?.uploads?.length, '辅料下单不应依赖上传凭证')
assert.ok(
  productionPreparationDataModule.productionPreparationRecords.filter((record) => !record.workItemsConfirmedAt).length >= 2,
  'Mock 数据必须至少覆盖 2 条跟单尚未确认类型的生产准备记录',
)

const menuSource = source('src/data/app-shell-config.ts')
const productionMenuStart = menuSource.indexOf("key: 'fcs-platform-production'")
assert.ok(productionMenuStart >= 0, '菜单缺少生产单管理分组')
const productionMenuEnd = menuSource.indexOf("key: 'fcs-platform-process'", productionMenuStart)
assert.ok(productionMenuEnd >= 0, '菜单缺少工艺平台分组')
const productionMenu = menuSource.slice(productionMenuStart, productionMenuEnd)
assert.ok(productionMenu.includes('production-preparation-timing'), '生产单管理菜单缺少生产准备时效')
assert.ok(productionMenu.includes('/fcs/production/preparation-timing'), '生产准备时效 href 不正确')
assert.ok(productionMenu.includes('production-preparation-timing-statistics'), '生产单管理菜单缺少生产准备时效统计')
assert.ok(productionMenu.includes('/fcs/production/preparation-timing-statistics'), '生产准备时效统计 href 不正确')
const ordersIndex = productionMenu.indexOf('production-orders')
const timingIndex = productionMenu.indexOf('production-preparation-timing')
const timingStatsIndex = productionMenu.indexOf('production-preparation-timing-statistics')
const changesIndex = productionMenu.indexOf('production-changes')
assert.ok(ordersIndex >= 0, '生产单管理菜单缺少生产单管理')
assert.ok(timingIndex >= 0, '生产单管理菜单缺少生产准备时效')
assert.ok(timingStatsIndex >= 0, '生产单管理菜单缺少生产准备时效统计')
assert.ok(changesIndex >= 0, '生产单管理菜单缺少生产单变更管理')
assert.ok(
  ordersIndex < timingIndex && timingIndex < timingStatsIndex && timingStatsIndex < changesIndex,
  '生产准备时效统计必须位于生产准备时效之后、生产单变更管理之前',
)

assertIncludes('src/router/routes-fcs.ts', '/fcs/production/preparation-timing', 'routes-fcs.ts 缺少生产准备时效路由')
assertIncludes('src/router/routes-fcs.ts', '/fcs/production/preparation-timing-statistics', 'routes-fcs.ts 缺少生产准备时效统计路由')
assertIncludes('src/router/routes-fcs.ts', 'renderProductionPreparationTimingPage', 'routes-fcs.ts 缺少生产准备时效 renderer')
assertIncludes('src/router/routes-fcs.ts', 'renderProductionPreparationTimingStatisticsPage', 'routes-fcs.ts 缺少生产准备时效统计 renderer')
assertIncludes(
  'src/router/route-renderers-fcs.ts',
  'renderProductionPreparationTimingPage',
  'route-renderers-fcs.ts 缺少生产准备时效 renderer',
)
assertIncludes(
  'src/router/route-renderers-fcs.ts',
  'renderProductionPreparationTimingStatisticsPage',
  'route-renderers-fcs.ts 缺少生产准备时效统计 renderer',
)
assertIncludes(
  'src/router/route-renderers.ts',
  'renderProductionPreparationTimingPage',
  'route-renderers.ts 缺少生产准备时效 renderer',
)
assertIncludes(
  'src/router/route-renderers.ts',
  'renderProductionPreparationTimingStatisticsPage',
  'route-renderers.ts 缺少生产准备时效统计 renderer',
)
assertIncludes(
  'src/pages/production/events.ts',
  'handleProductionPreparationTimingSubmit',
  '生产准备时效必须接入真实提交处理',
)
assertIncludes(
  'src/pages/production/events.ts',
  'handleProductionPreparationTimingEvent',
  '生产准备时效必须接入下载处理',
)
assert.ok(
  !source('src/pages/production/preparation-timing.ts').includes('void buildUploadRecordsFromFiles'),
  '生产准备上传必须等待文件读取完成后再保存 runtime',
)
assertIncludes(
  'src/pages/production/preparation-timing.ts',
  'const generatedAt = outputGeneratedAt(record)',
  '产出表格必须用记录当前完成状态推导产出时间，避免 runtime 上传完成后产出时间为空',
)
assertIncludes(
  'src/data/fcs/production-preparation-timing-runtime.ts',
  'FileReader',
  '生产准备时效上传必须读取真实文件',
)
assertIncludes(
  'src/pages/production/preparation-timing.ts',
  'data-prep-action="download-upload"',
  '上传文件必须有下载入口',
)

const {
  buildPreparationOutputs,
  buildMonthlyPreparationCompletionDetails,
  buildMonthlyPreparationStats,
  filterProductionPreparationRecords,
  flattenProductionPreparationItems,
  derivePreparationItemProgress,
  hasValidPreparationCompletionEvidence,
  preparationTypeDefaultItems,
  productionPreparationRecords,
} = productionPreparationDataModule

assert.deepEqual(
  buildPreparationOutputs({
    recordNo: 'PREP-反例-001',
    productionDemandNo: 'PD-反例-001',
    productionOrderNo: 'PO-反例-001',
    outputReady: true,
    outputPublishedAt: '2026-03-12T10:00:00',
    workItemsConfirmedBy: '测试跟单',
    workItemsConfirmedAt: '2026-03-10T10:00:00',
    items: [
      { itemType: '梭织基码纸样', selectedByMerchandiser: true, status: '已完成' },
      { itemType: '版衣制作', selectedByMerchandiser: true, status: '进行中' },
    ],
  }),
  [],
  '业务闭环反例：已选准备项未全部完成时不得生成正式产出',
)

type EvidenceItem = {
  itemId: string
  itemType: string
  status: string
  dependsOnItemIds: string[]
  selectedByMerchandiser?: boolean
  actualFinishAt?: string
  accessoryPurchaseOrderNos?: string[]
  accessoryPurchaseOrderedAts?: string[]
  accessoryPurchaseUpdatedAt?: string
  uploads?: Array<{ fileName?: string; uploadedAt?: string; uploadedBy?: string; fileDataUrl?: string }>
}

function selectedEvidenceItems(record: { items: EvidenceItem[] }): EvidenceItem[] {
  return record.items.filter((item) => item.selectedByMerchandiser !== false && item.status !== '无需')
}

function hasUploadEvidence(item?: EvidenceItem): boolean {
  return Boolean(
    item?.actualFinishAt &&
      item.uploads?.some((upload) => upload.fileName && upload.uploadedAt && upload.uploadedBy),
  )
}

function hasCompletionEvidence(item?: EvidenceItem): boolean {
  if (item?.itemType === '辅料下单') {
    return Boolean(item.actualFinishAt && item.accessoryPurchaseOrderNos?.some(Boolean))
  }
  return hasUploadEvidence(item)
}

function itemByType(record: { items: EvidenceItem[] }, itemType: string): EvidenceItem | undefined {
  return selectedEvidenceItems(record).find((item) => item.itemType === itemType)
}

function assertDependsOn(record: { recordNo: string; items: EvidenceItem[] }, itemType: string, dependencyType: string): void {
  const item = itemByType(record, itemType)
  if (!item) return
  const dependency = itemByType(record, dependencyType)
  assert.ok(dependency, `${record.recordNo} ${itemType} 必须存在前置项 ${dependencyType}`)
  assert.ok(
    item.dependsOnItemIds.includes(dependency.itemId),
    `${record.recordNo} ${itemType} 必须依赖 ${dependencyType}`,
  )
}

const derivedRows = productionPreparationRecords.flatMap((record) =>
  record.items
    .filter((item) => item.selectedByMerchandiser !== false && item.status !== '无需')
    .map((item) => ({
      record,
      item: item as EvidenceItem,
      progress: derivePreparationItemProgress(item, record),
    })),
)
const allMockItemRows = productionPreparationRecords.flatMap((record) =>
  record.items.map((item) => ({ record, item: item as EvidenceItem })),
)
const dependencyEvidenceIsValid = (
  record: (typeof productionPreparationRecords)[number],
  item: EvidenceItem,
): boolean => item.dependsOnItemIds.every((dependencyId) => {
  const dependency = record.items.find((candidate) => candidate.itemId === dependencyId)
  return Boolean(dependency && hasValidPreparationCompletionEvidence(dependency))
})
const unconfirmedDerivedRows = derivedRows.filter(
  ({ record }) => !(record.workItemsConfirmedBy && record.workItemsConfirmedAt),
)
const multiOrderAccessoryRow = derivedRows.find(({ item }) =>
  item.itemType === '辅料下单' &&
  (item.accessoryPurchaseOrderNos?.length ?? 0) >= 2,
)
assert.ok(multiOrderAccessoryRow, '辅料下单 Mock 必须至少包含一条多采购单记录')
const accessoryOrderNos = multiOrderAccessoryRow.item.accessoryPurchaseOrderNos ?? []
const accessoryOrderedAts = multiOrderAccessoryRow.item.accessoryPurchaseOrderedAts ?? []
assert.ok(accessoryOrderNos.length >= 2, '辅料下单 Mock 必须至少包含两个采购单号')
assert.equal(accessoryOrderedAts.length, accessoryOrderNos.length, '辅料下单每个采购单号必须有对应下单时间')
assert.ok(accessoryOrderNos.every((orderNo) => orderNo.trim()), '辅料下单采购单号不得为空')
assert.ok(accessoryOrderedAts.every((orderedAt) => orderedAt.trim()), '辅料下单采购单对应下单时间不得为空')
assert.equal(
  multiOrderAccessoryRow.item.actualFinishAt,
  [...accessoryOrderedAts].sort().at(-1),
  '辅料下单实际完成时间必须取最晚下单时间',
)
assert.equal(multiOrderAccessoryRow.item.uploads?.length ?? 0, 0, '辅料下单完成不应依赖上传凭证')
assert.equal(
  hasValidPreparationCompletionEvidence(multiOrderAccessoryRow.item),
  true,
  '辅料下单多采购单 Mock 必须具备有效完成凭证',
)
const monthlyCoverageRows = buildMonthlyPreparationCompletionDetails('2026-03')
const coverageMatrix = [
  {
    scenario: '跟单未确认工作项时，所有选中项派生为不满足开始条件且不能已完成',
    covered: unconfirmedDerivedRows.length > 0 && unconfirmedDerivedRows.every(
      ({ item, progress }) => progress === '不满足开始条件' && item.status !== '已完成',
    ),
  },
  {
    scenario: '前置准备项缺少有效完成凭证时，后续项不满足开始条件',
    covered: derivedRows.some(({ record, item, progress }) =>
      item.dependsOnItemIds.length > 0 &&
      !dependencyEvidenceIsValid(record, item) &&
      progress === '不满足开始条件'),
  },
  {
    scenario: '前置准备项已满足但当前项无有效凭证时派生为未开始',
    covered: derivedRows.some(({ record, item, progress }) =>
      item.dependsOnItemIds.length > 0 &&
      dependencyEvidenceIsValid(record, item) &&
      !hasValidPreparationCompletionEvidence(item) &&
      progress === '未开始'),
  },
  {
    scenario: '进行中、待确认、已超时之一的底层状态可派生为未开始',
    covered: derivedRows.some(({ item, progress }) =>
      ['进行中', '待确认', '已超时'].includes(item.status) && progress === '未开始'),
  },
  {
    scenario: '普通准备项具备已完成状态、实际完成时间和完整上传凭证时派生为已完成',
    covered: derivedRows.some(({ item, progress }) =>
      item.itemType !== '辅料下单' &&
      item.status === '已完成' &&
      Boolean(item.actualFinishAt) &&
      Boolean(item.uploads?.some((upload) => upload.fileName && upload.uploadedBy && upload.uploadedAt)) &&
      progress === '已完成'),
  },
  {
    scenario: '辅料下单含至少两个采购单号及对应时间，完成时间取最后下单时间且无需上传',
    covered: multiOrderAccessoryRow.progress === '已完成',
  },
  {
    scenario: '至少一条记录包含三个或以上责任团队',
    covered: productionPreparationRecords.some(
      (record) => new Set(record.items.map((item) => item.ownerTeam)).size >= 3,
    ),
  },
  {
    scenario: '月度明细包含多个跟单、准备项和责任团队的有效完成记录',
    covered:
      new Set(monthlyCoverageRows.map((row) => row.merchandiserName)).size >= 2 &&
      new Set(monthlyCoverageRows.map((row) => row.itemType)).size >= 2 &&
      new Set(monthlyCoverageRows.map((row) => row.ownerTeam)).size >= 2 &&
      monthlyCoverageRows.every((row) => hasValidPreparationCompletionEvidence(row)),
  },
] as const
assert.deepEqual(
  coverageMatrix.filter(({ covered }) => !covered).map(({ scenario }) => scenario),
  [],
  '生产准备 Mock 覆盖矩阵存在缺失场景',
)

for (const { record, item, progress } of derivedRows) {
  if (progress === '已完成') {
    assert.equal(
      hasValidPreparationCompletionEvidence(item),
      true,
      `${record.recordNo}/${item.itemType} 派生已完成但缺少有效完成凭证`,
    )
  }
  if (!(record.workItemsConfirmedBy && record.workItemsConfirmedAt)) {
    assert.notEqual(progress, '已完成', `${record.recordNo}/${item.itemType} 未确认工作项却派生为已完成`)
  }
}

for (const { record, item } of allMockItemRows) {
  if (item.itemType === '辅料下单' && item.status === '已完成') {
    assert.ok(
      item.accessoryPurchaseOrderNos?.some(Boolean) && item.actualFinishAt,
      `${record.recordNo}/${item.itemType} 已完成但缺少采购单号或完成时间`,
    )
  }
  if (item.itemType !== '辅料下单' && item.status === '已完成') {
    assert.ok(
      item.uploads?.some((upload) => upload.fileName && upload.uploadedBy && upload.uploadedAt),
      `${record.recordNo}/${item.itemType} 普通准备项已完成但缺少完整上传凭证`,
    )
  }
}

function runtimeUploadFor(
  record: { recordId: string },
  item: { itemId: string; itemType: string },
  index: number,
) {
  return {
    uploadId: `runtime-ready-upload-${index + 1}`,
    recordId: record.recordId,
    itemId: item.itemId,
    itemType: item.itemType,
    fileName: `runtime-ready-${index + 1}.pdf`,
    fileType: 'application/pdf',
    fileSize: 1024,
    fileDataUrl: 'data:application/pdf;base64,JVBERi0xLjQ=',
    uploadedBy: '测试用户',
    uploadedAt: `2026-07-02T10:${String(index + 10).padStart(2, '0')}`,
    note: 'runtime 完成证据',
  }
}

assert.equal(isBasePatternItem('梭织基码纸样'), true, '梭织基码纸样必须记录下载')
assert.equal(isBasePatternItem('毛织基码纸样'), true, '毛织基码纸样必须记录下载')
assert.equal(isBasePatternItem('梭织齐码纸样'), false, '齐码纸样不属于基码下载审计')

const runtimeWithDownload = appendDownloadRecord(EMPTY_PREPARATION_RUNTIME_STATE, {
  recordId: 'record-a',
  itemId: 'item-a',
  uploadId: 'upload-a',
  fileName: 'base.prj',
  downloadedBy: '测试用户',
})
assert.equal(runtimeWithDownload.downloads.length, 1, '下载必须生成一条记录')
assert.equal(runtimeWithDownload.downloads[0].fileName, 'base.prj', '下载记录必须保存文件名')

const mergedRecords = mergePreparationRuntimeRecords(productionPreparationRecords, {
  ...EMPTY_PREPARATION_RUNTIME_STATE,
  uploads: [
    {
      uploadId: 'upload-test',
      recordId: productionPreparationRecords[0].recordId,
      itemId: productionPreparationRecords[0].items[0].itemId,
      itemType: productionPreparationRecords[0].items[0].itemType,
      fileName: 'base.prj',
      fileType: 'application/octet-stream',
      fileSize: 12,
      fileDataUrl: 'data:application/octet-stream;base64,YQ==',
      uploadedBy: '测试用户',
      uploadedAt: '2026-07-02T10:30',
      note: '测试上传',
    },
  ],
  downloads: [],
})
assert.equal(mergedRecords[0].items[0].actualFinishAt, '2026-07-02T10:30', '上传后工作项完成时间必须取上传时间')

const runtimeOutputFixture = productionPreparationRecords.find(
  (record: { recordNo?: string }) => record.recordNo === 'PREP-202603-002',
) as
  | {
      recordId: string
      recordNo: string
      outputReady: boolean
      outputs: unknown[]
      items: Array<{ itemId: string; itemType: string; selectedByMerchandiser?: boolean; status: string }>
    }
  | undefined
assert.ok(runtimeOutputFixture, '缺少 PREP-202603-002 runtime 产出回归 fixture')
assert.equal(runtimeOutputFixture.outputReady, false, 'PREP-202603-002 静态必须保持未 ready')
assert.equal(runtimeOutputFixture.outputs.length, 0, 'PREP-202603-002 静态未 ready 不得生成产出')
const runtimeOutputItems = runtimeOutputFixture.items.filter(
  (item) => item.selectedByMerchandiser !== false && item.status !== '无需',
)
const runtimeReadyUploads = runtimeOutputItems.map((item, index) =>
  runtimeUploadFor(runtimeOutputFixture, item, index),
)
const runtimeReadyRecord = mergePreparationRuntimeRecords(productionPreparationRecords, {
  ...EMPTY_PREPARATION_RUNTIME_STATE,
  uploads: runtimeReadyUploads,
  downloads: [],
}).find((record: { recordNo?: string }) => record.recordNo === 'PREP-202603-002') as
  | {
      outputPublishedAt?: string
      outputs?: Array<{ outputType?: string; outputGeneratedAt?: string }>
    }
  | undefined
assert.ok(runtimeReadyRecord, 'runtime 合并后缺少 PREP-202603-002')
const runtimeLatestUploadAt = runtimeReadyUploads
  .map((upload) => upload.uploadedAt)
  .sort((left, right) => right.localeCompare(left))[0]
assert.equal(runtimeReadyRecord.outputPublishedAt, runtimeLatestUploadAt, 'runtime ready 产出时间必须取最晚完成证据')
assert.ok((runtimeReadyRecord.outputs?.length ?? 0) > 0, 'runtime 证据齐全后必须生成产出对象')
for (const outputType of ['正式版本技术包', '生产需求单', '生产单', '染色需求单', '染色加工单', '辅料采购单'] as const) {
  assert.ok(
    runtimeReadyRecord.outputs?.some((output) => output.outputType === outputType),
    `runtime 证据齐全后产出缺少「${outputType}」`,
  )
}
assert.ok(
  runtimeReadyRecord.outputs?.every((output) => output.outputGeneratedAt === runtimeLatestUploadAt),
  'runtime 证据齐全后每个产出对象必须使用最晚完成证据时间',
)
const runtimeMissingUploadRecord = mergePreparationRuntimeRecords(productionPreparationRecords, {
  ...EMPTY_PREPARATION_RUNTIME_STATE,
  uploads: runtimeReadyUploads.filter((upload) => {
    const item = runtimeOutputItems.find((current) => current.itemId === upload.itemId)
    return item?.status === '已完成'
  }),
  downloads: [],
}).find((record: { recordNo?: string }) => record.recordNo === 'PREP-202603-002') as
  | { outputs?: unknown[] }
  | undefined
assert.equal(runtimeMissingUploadRecord?.outputs?.length ?? 0, 0, '缺一个 runtime 上传时不得生成产出对象')

const unconfirmedOutputLoopFixture = productionPreparationRecords.find(
  (record: { recordNo?: string }) => record.recordNo === 'PREP-202603-001',
) as
  | {
      recordId: string
      recordNo: string
      productionDemandNo: string
      productionOrderNo: string
      outputReady: boolean
      items: Array<{ itemId: string; itemType: string; selectedByMerchandiser?: boolean; status: string }>
    }
  | undefined
assert.ok(unconfirmedOutputLoopFixture, '缺少 PREP-202603-001 未确认输出闭环 fixture')
assert.equal(unconfirmedOutputLoopFixture.productionDemandNo, '', 'PREP-202603-001 静态必须没有生产需求单号')
assert.equal(unconfirmedOutputLoopFixture.productionOrderNo, '', 'PREP-202603-001 静态必须没有生产单号')
const unconfirmedRuntimeSelectedItemTypes = ['梭织基码纸样', '版衣制作', '梭织齐码纸样', '辅料下单'] as const
const unconfirmedRuntimeSelectedItems = unconfirmedOutputLoopFixture.items.filter((item) =>
  unconfirmedRuntimeSelectedItemTypes.includes(item.itemType as typeof unconfirmedRuntimeSelectedItemTypes[number]),
)
assert.equal(unconfirmedRuntimeSelectedItems.length, unconfirmedRuntimeSelectedItemTypes.length, 'PREP-202603-001 缺少纯梭织确认准备项')
const unconfirmedRuntimeAccessoryItem = unconfirmedRuntimeSelectedItems.find((item) => item.itemType === '辅料下单')
assert.ok(unconfirmedRuntimeAccessoryItem, 'PREP-202603-001 runtime fixture 缺少辅料下单项')
const unconfirmedConfirmedState = {
  ...EMPTY_PREPARATION_RUNTIME_STATE,
  confirmedRecords: {
    [unconfirmedOutputLoopFixture.recordId]: {
      confirmedBy: '测试用户',
      confirmedAt: '2026-07-02T12:00',
      confirmedProductPrepType: '非烫画&非毛织（纯梭织）',
      selectedItemTypes: [...unconfirmedRuntimeSelectedItemTypes],
      overrideReason: '',
    },
  },
  downloads: [],
}
const unconfirmedMissingEvidenceRecord = mergePreparationRuntimeRecords(productionPreparationRecords, {
  ...unconfirmedConfirmedState,
  uploads: unconfirmedRuntimeSelectedItems.slice(0, -1).map((item, index) =>
    runtimeUploadFor(unconfirmedOutputLoopFixture, item, index + 40),
  ),
}).find((record: { recordNo?: string }) => record.recordNo === unconfirmedOutputLoopFixture.recordNo) as
  | { outputReady?: boolean; outputs?: unknown[] }
  | undefined
assert.equal(unconfirmedMissingEvidenceRecord?.outputReady, false, '未确认记录 runtime 缺上传证据时不得 ready')
assert.equal(unconfirmedMissingEvidenceRecord?.outputs?.length ?? 0, 0, '未确认记录 runtime 缺上传证据时不得生成产出')
const unconfirmedRuntimeReadyRecord = mergePreparationRuntimeRecords(productionPreparationRecords, {
  ...unconfirmedConfirmedState,
  uploads: unconfirmedRuntimeSelectedItems.map((item, index) =>
    runtimeUploadFor(unconfirmedOutputLoopFixture, item, index + 40),
  ),
  accessoryPurchaseOrders: {
    [unconfirmedRuntimeAccessoryItem.itemId]: {
      orderNos: ['FPO-RUNTIME-001', 'FPO-RUNTIME-002'],
      orderedAts: ['2026-07-02T12:40', '2026-07-03T09:20'],
      updatedAt: '2026-07-09T18:00',
      updatedBy: '测试用户',
    },
  },
}).find((record: { recordNo?: string }) => record.recordNo === unconfirmedOutputLoopFixture.recordNo) as
  | {
      outputReady?: boolean
      productionDemandNo?: string
      productionOrderNo?: string
      items?: Array<{ itemId?: string; actualFinishAt?: string }>
      outputs?: Array<{ outputType?: string; outputNo?: string }>
    }
  | undefined
assert.equal(unconfirmedRuntimeReadyRecord?.outputReady, true, '未确认记录 runtime 补齐上传证据后必须 ready')
assert.equal(
  unconfirmedRuntimeReadyRecord?.items?.find((item) => item.itemId === unconfirmedRuntimeAccessoryItem.itemId)?.actualFinishAt,
  '2026-07-03T09:20',
  '辅料下单完成时间必须取多个采购单号中的最晚下单时间，不得取保存更新时间',
)
assert.equal(unconfirmedRuntimeReadyRecord?.productionDemandNo, 'PD-202603-001', 'runtime ready 后必须生成稳定生产需求单号')
assert.equal(unconfirmedRuntimeReadyRecord?.productionOrderNo, 'PO-202603-001', 'runtime ready 后必须生成稳定生产单号')
for (const outputType of ['正式版本技术包', '生产需求单', '生产单', '辅料采购单'] as const) {
  assert.ok(
    unconfirmedRuntimeReadyRecord?.outputs?.some((output) => output.outputType === outputType),
    `未确认记录 runtime 补齐上传证据后产出缺少「${outputType}」`,
  )
}

const readyReconfirmationFixture = productionPreparationRecords.find(
  (record: { recordNo?: string }) => record.recordNo === 'PREP-202604-001',
) as
  | {
      recordId: string
      recordNo: string
      outputReady: boolean
      outputs: unknown[]
      items: Array<{ itemId: string; itemType: string; selectedByMerchandiser?: boolean; status: string }>
    }
  | undefined
assert.ok(readyReconfirmationFixture, '缺少 PREP-202604-001 runtime 重新确认回归 fixture')
assert.equal(readyReconfirmationFixture.outputReady, true, 'PREP-202604-001 静态必须保持 ready')
assert.ok(readyReconfirmationFixture.outputs.length > 0, 'PREP-202604-001 静态 ready 必须已有产出')
const existingSelectedItemIds = readyReconfirmationFixture.items
  .filter((item) => item.selectedByMerchandiser !== false && item.status !== '无需')
  .map((item) => item.itemId)
const newlySelectedPatternItem = readyReconfirmationFixture.items.find(
  (item) => item.itemType === '数码印/DTF/DTG花型' && item.selectedByMerchandiser === false,
)
assert.ok(newlySelectedPatternItem, 'PREP-202604-001 必须有原未选花型选填项')
const reconfirmedItemIds = [...existingSelectedItemIds, newlySelectedPatternItem.itemId]
const reconfirmedMissingEvidenceRecord = mergePreparationRuntimeRecords(productionPreparationRecords, {
  ...EMPTY_PREPARATION_RUNTIME_STATE,
  confirmedRecords: {
    [readyReconfirmationFixture.recordId]: {
      confirmedBy: '测试用户',
      confirmedAt: '2026-07-02T11:00',
      selectedItemIds: reconfirmedItemIds,
    },
  },
  uploads: [],
  downloads: [],
}).find((record: { recordNo?: string }) => record.recordNo === 'PREP-202604-001') as
  | { outputReady?: boolean; outputs?: unknown[] }
  | undefined
assert.equal(reconfirmedMissingEvidenceRecord?.outputReady, false, 'runtime 重新选择未完成选填项后不得继续沿用静态 ready')
assert.equal(reconfirmedMissingEvidenceRecord?.outputs?.length ?? 0, 0, 'runtime 重新选择选填项但缺上传证据时不得生成产出对象')
const reconfirmedReadyRecord = mergePreparationRuntimeRecords(productionPreparationRecords, {
  ...EMPTY_PREPARATION_RUNTIME_STATE,
  confirmedRecords: {
    [readyReconfirmationFixture.recordId]: {
      confirmedBy: '测试用户',
      confirmedAt: '2026-07-02T11:00',
      selectedItemIds: reconfirmedItemIds,
    },
  },
  uploads: [runtimeUploadFor(readyReconfirmationFixture, newlySelectedPatternItem, 20)],
  downloads: [],
}).find((record: { recordNo?: string }) => record.recordNo === 'PREP-202604-001') as
  | { outputReady?: boolean; outputs?: Array<{ outputType?: string }> }
  | undefined
assert.equal(reconfirmedReadyRecord?.outputReady, true, 'runtime 重新选择选填项且补齐上传证据后必须恢复 ready')
assert.ok((reconfirmedReadyRecord?.outputs?.length ?? 0) > 0, 'runtime 重新选择选填项且补齐上传证据后必须恢复产出对象')
for (const outputType of ['印花需求单', '印花加工单'] as const) {
  assert.ok(
    reconfirmedReadyRecord?.outputs?.some((output) => output.outputType === outputType),
    `runtime 重新选择花型且补齐上传证据后产出缺少「${outputType}」`,
  )
}
const typeSwitchedReadyRecord = mergePreparationRuntimeRecords(productionPreparationRecords, {
  ...EMPTY_PREPARATION_RUNTIME_STATE,
  confirmedRecords: {
    [readyReconfirmationFixture.recordId]: {
      confirmedBy: '测试用户',
      confirmedAt: '2026-07-02T11:10',
      confirmedProductPrepType: '烫画&直喷',
      selectedItemTypes: ['数码印/DTF/DTG花型'],
      overrideReason: '测试切换到烫画&直喷',
    },
  },
  uploads: [runtimeUploadFor(readyReconfirmationFixture, newlySelectedPatternItem, 21)],
  downloads: [],
}).find((record: { recordNo?: string }) => record.recordNo === 'PREP-202604-001') as
  | {
      confirmedProductPrepType?: string
      prepTypeSource?: string
      prepTypeOverrideReason?: string
      outputReady?: boolean
      outputs?: Array<{ outputType?: string }>
      items?: Array<{ itemType?: string; selectedByMerchandiser?: boolean; status?: string }>
    }
  | undefined
assert.equal(typeSwitchedReadyRecord?.confirmedProductPrepType, '烫画&直喷', 'runtime 必须保存确认后的商品准备类型')
assert.equal(typeSwitchedReadyRecord?.prepTypeSource, '人工修正', 'runtime 类型和原确认不一致时必须标记人工修正')
assert.equal(typeSwitchedReadyRecord?.prepTypeOverrideReason, '测试切换到烫画&直喷', 'runtime 必须保存类型修正原因')
assert.equal(typeSwitchedReadyRecord?.outputReady, true, 'runtime selectedItemTypes 补齐上传证据后必须 ready')
assert.deepEqual(
  typeSwitchedReadyRecord?.items
    ?.filter((item) => item.selectedByMerchandiser !== false && item.status !== '无需')
    .map((item) => item.itemType),
  ['数码印/DTF/DTG花型'],
  'runtime selectedItemTypes 必须按 itemType 选择准备项，不能继续强制保留旧必做项',
)
for (const outputType of ['印花需求单', '印花加工单'] as const) {
  assert.ok(
    typeSwitchedReadyRecord?.outputs?.some((output) => output.outputType === outputType),
    `runtime selectedItemTypes 选择花型后产出缺少「${outputType}」`,
  )
}

const dyeOnlySelectionRecord = mergePreparationRuntimeRecords(productionPreparationRecords, {
  ...EMPTY_PREPARATION_RUNTIME_STATE,
  confirmedRecords: {
    [readyReconfirmationFixture.recordId]: {
      confirmedBy: '测试用户',
      confirmedAt: '2026-07-02T11:15',
      confirmedProductPrepType: '非烫画&非毛织（纯梭织）',
      selectedItemTypes: ['染色调色（面料）'],
      overrideReason: '测试只勾选染色调色时系统补前置确认项',
    },
  },
  dyeRequirements: {
    [`${readyReconfirmationFixture.recordId}-runtime-确认染色要求（面料）`]: {
      materialNo: 'FAB-RUNTIME-DYE',
      materialName: 'runtime 面料染色底布',
      colorName: '深海蓝',
      pantoneCode: '19-4052 TCX',
      remark: 'runtime 测试染色要求',
      maintainedBy: '测试用户',
      maintainedAt: '2026-07-02T11:18',
    },
  },
  uploads: [],
  downloads: [],
}).find((record: { recordNo?: string }) => record.recordNo === readyReconfirmationFixture.recordNo) as
  | {
      items?: Array<{
        itemType?: string
        selectedByMerchandiser?: boolean
        dyeRequirement?: { pantoneCode?: string }
      }>
    }
  | undefined
const dyeOnlyItemsByType = new Map((dyeOnlySelectionRecord?.items ?? []).map((item) => [item.itemType, item]))
assert.equal(
  dyeOnlyItemsByType.get('确认染色要求（面料）')?.selectedByMerchandiser,
  true,
  'runtime 只选择染色调色时必须自动补选确认染色要求（面料），否则前置依赖会卡死',
)
assert.equal(
  dyeOnlyItemsByType.get('染色调色（面料）')?.selectedByMerchandiser,
  true,
  'runtime 只选择染色调色时必须保留染色调色（面料）本身',
)
assert.equal(
  dyeOnlyItemsByType.get('染色调色（面料）')?.dyeRequirement?.pantoneCode,
  '19-4052 TCX',
  '确认染色要求写入后，依赖它的染色调色项必须能读取同一份要求',
)
const heatOnlyFixture = productionPreparationRecords.find(
  (record: { recordNo?: string }) => record.recordNo === 'PREP-202604-003',
) as
  | {
      recordId: string
      recordNo: string
      items: Array<{ itemId: string; itemType: string; selectedByMerchandiser?: boolean; status: string }>
    }
  | undefined
assert.ok(heatOnlyFixture, '缺少 PREP-202604-003 烫画&直喷跨类型切换 fixture')
assert.deepEqual(
  heatOnlyFixture.items.map((item) => item.itemType),
  ['数码印/DTF/DTG花型'],
  'PREP-202604-003 必须保持只有花型项，才能覆盖 runtime 生成缺失准备项',
)
const wovenRuntimeSelectedItemTypes = ['梭织基码纸样', '版衣制作', '梭织齐码纸样', '辅料下单'] as const
const heatToWovenRecord = mergePreparationRuntimeRecords(productionPreparationRecords, {
  ...EMPTY_PREPARATION_RUNTIME_STATE,
  confirmedRecords: {
    [heatOnlyFixture.recordId]: {
      confirmedBy: '测试用户',
      confirmedAt: '2026-07-02T11:20',
      confirmedProductPrepType: '非烫画&非毛织（纯梭织）',
      selectedItemTypes: [...wovenRuntimeSelectedItemTypes],
      overrideReason: '测试烫画记录切换为纯梭织',
    },
  },
  uploads: [],
  downloads: [],
}).find((record: { recordNo?: string }) => record.recordNo === heatOnlyFixture.recordNo) as
  | {
      confirmedProductPrepType?: string
      outputReady?: boolean
      outputs?: unknown[]
      items?: Array<{
        itemId?: string
        recordId?: string
        itemType?: string
        required?: boolean
        requiredKind?: string
        selectedByMerchandiser?: boolean
        selectedAt?: string
        sequenceGroup?: string
        dependsOnItemIds?: string[]
        parallelGroup?: string
        status?: string
        ownerTeam?: string
        ownerName?: string
        sourceObjectType?: string
        sourceObjectNo?: string
        sourceHref?: string
        uploads?: unknown[]
        downloads?: unknown[]
      }>
    }
  | undefined
assert.equal(heatToWovenRecord?.confirmedProductPrepType, '非烫画&非毛织（纯梭织）', '跨类型切换后确认类型必须更新')
const heatToWovenItemsByType = new Map((heatToWovenRecord?.items ?? []).map((item) => [item.itemType, item]))
for (const itemType of wovenRuntimeSelectedItemTypes) {
  const item = heatToWovenItemsByType.get(itemType)
  assert.ok(item, `runtime 跨类型切换后必须生成「${itemType}」准备项`)
  assert.equal(item.recordId, heatOnlyFixture.recordId, `runtime 生成「${itemType}」必须保留 recordId`)
  assert.ok(item.itemId?.startsWith(`${heatOnlyFixture.recordId}-runtime-`), `runtime 生成「${itemType}」必须使用稳定 itemId`)
  assert.equal(item.selectedByMerchandiser, true, `runtime 生成「${itemType}」必须按 selectedItemTypes 选中`)
  assert.ok(item.selectedAt, `runtime 生成「${itemType}」必须有 selectedAt`)
  assert.ok(item.sequenceGroup, `runtime 生成「${itemType}」必须有 sequenceGroup`)
  assert.ok(Array.isArray(item.dependsOnItemIds), `runtime 生成「${itemType}」必须有 dependsOnItemIds`)
  assert.ok(item.parallelGroup, `runtime 生成「${itemType}」必须有 parallelGroup`)
  assert.ok(item.status === '待开始' || item.status === '待判断', `runtime 生成「${itemType}」状态必须是待开始或待判断`)
  assert.ok(item.ownerTeam, `runtime 生成「${itemType}」必须有 ownerTeam`)
  assert.ok(item.ownerName, `runtime 生成「${itemType}」必须有 ownerName`)
  assert.equal(item.sourceObjectType, '生产单', `runtime 生成「${itemType}」必须有来源类型`)
  assert.ok(item.sourceObjectNo, `runtime 生成「${itemType}」必须有来源编号`)
  assert.ok(item.sourceHref, `runtime 生成「${itemType}」必须有来源链接`)
  assert.ok(Array.isArray(item.uploads), `runtime 生成「${itemType}」必须有 uploads 空数组`)
  assert.ok(Array.isArray(item.downloads), `runtime 生成「${itemType}」必须有 downloads 空数组`)
}
assert.equal(heatToWovenItemsByType.get('梭织基码纸样')?.required, true, '梭织基码纸样是真正必选项')
assert.equal(heatToWovenItemsByType.get('梭织基码纸样')?.requiredKind, '必做', '梭织基码纸样必须标为必做')
assert.equal(heatToWovenItemsByType.get('辅料下单')?.required, false, '辅料下单默认选中但可取消，不是真正必选项')
assert.equal(heatToWovenItemsByType.get('辅料下单')?.requiredKind, '选填', '辅料下单必须标为选填')
const heatToWovenPatternItem = heatToWovenItemsByType.get('数码印/DTF/DTG花型')
assert.ok(
  heatToWovenPatternItem?.status === '无需' || heatToWovenPatternItem?.selectedByMerchandiser === false,
  '烫画记录切到纯梭织后原花型项必须无需或未选',
)
assert.equal(heatToWovenRecord?.outputReady, false, '跨类型生成梭织项但未上传证据时 outputReady 必须为 false')
assert.equal(heatToWovenRecord?.outputs?.length ?? 0, 0, '跨类型生成梭织项但未上传证据时 outputs 必须为空')

const outputRemovalFixture = productionPreparationRecords.find(
  (record: { recordNo?: string }) => record.recordNo === 'PREP-202604-006',
) as
  | {
      recordId: string
      recordNo: string
      outputReady: boolean
      items: Array<{ itemId: string; itemType: string; selectedByMerchandiser?: boolean; status: string }>
    }
  | undefined
assert.ok(outputRemovalFixture, '缺少 PREP-202604-006 runtime 取消选中产出回归 fixture')
assert.equal(outputRemovalFixture.outputReady, true, 'PREP-202604-006 静态必须保持 ready')
const outputRemovalSelectedItemIds = outputRemovalFixture.items
  .filter((item) => item.selectedByMerchandiser !== false && item.status !== '无需')
  .map((item) => item.itemId)
const outputRemovalPatternItem = outputRemovalFixture.items.find(
  (item) => item.itemType === '数码印/DTF/DTG花型' && item.selectedByMerchandiser === false,
)
assert.ok(outputRemovalPatternItem, 'PREP-202604-006 必须有原未选花型选填项')
const outputRemovalAllItemIds = [...outputRemovalSelectedItemIds, outputRemovalPatternItem.itemId]
const outputRemovalPatternUpload = runtimeUploadFor(outputRemovalFixture, outputRemovalPatternItem, 30)
function mergeOutputRemovalFixture(selectedItemIds: string[]): Set<string> {
  const record = mergePreparationRuntimeRecords(productionPreparationRecords, {
    ...EMPTY_PREPARATION_RUNTIME_STATE,
    confirmedRecords: {
      [outputRemovalFixture.recordId]: {
        confirmedBy: '测试用户',
        confirmedAt: '2026-07-02T11:30',
        selectedItemIds,
      },
    },
    uploads: [outputRemovalPatternUpload],
    downloads: [],
  }).find((current: { recordNo?: string }) => current.recordNo === outputRemovalFixture.recordNo) as
    | { outputs?: Array<{ outputType?: string }> }
    | undefined
  assert.ok(record, 'runtime 合并后缺少 PREP-202604-006')
  return new Set((record.outputs ?? []).map((output) => output.outputType).filter(Boolean))
}
const outputTypesWithAllItems = mergeOutputRemovalFixture(outputRemovalAllItemIds)
for (const outputType of ['印花需求单', '印花加工单', '染色需求单', '染色加工单', '辅料采购单'] as const) {
  assert.ok(outputTypesWithAllItems.has(outputType), `runtime 三类准备项产出 fixture 缺少「${outputType}」`)
}
const outputTypesWithoutPattern = mergeOutputRemovalFixture(
  outputRemovalAllItemIds.filter((itemId) => itemId !== outputRemovalPatternItem.itemId),
)
for (const outputType of ['印花需求单', '印花加工单'] as const) {
  assert.ok(!outputTypesWithoutPattern.has(outputType), `runtime 取消花型项后不得保留「${outputType}」`)
}
const outputTypesWithoutDye = mergeOutputRemovalFixture(
  outputRemovalAllItemIds.filter((itemId) => {
    const item = outputRemovalFixture.items.find((current) => current.itemId === itemId)
    return !(item?.itemType === '染色调色（纱线）' || item?.itemType === '染色调色（面料）')
  }),
)
for (const outputType of ['染色需求单', '染色加工单'] as const) {
  assert.ok(!outputTypesWithoutDye.has(outputType), `runtime 取消染色项后不得保留「${outputType}」`)
}
const outputTypesWithoutAccessory = mergeOutputRemovalFixture(
  outputRemovalAllItemIds.filter((itemId) => {
    const item = outputRemovalFixture.items.find((current) => current.itemId === itemId)
    return item?.itemType !== '辅料下单'
  }),
)
assert.ok(!outputTypesWithoutAccessory.has('辅料采购单'), 'runtime 取消辅料项后不得保留「辅料采购单」')

assert.ok(Array.isArray(productionPreparationRecords), 'productionPreparationRecords 必须是数组')
assert.ok(productionPreparationRecords.length >= 12, 'productionPreparationRecords 不少于 12 条')

for (const record of productionPreparationRecords as Array<{
  recordNo: string
  imageUrl?: string
  workItemsConfirmedBy?: string
  workItemsConfirmedAt?: string
  productionDemandNo?: string
  productionOrderNo?: string
  outputReady?: boolean
  outputs?: unknown[]
  items: Array<EvidenceItem & { dyeRequirement?: unknown }>
}>) {
  const selectedItems = selectedEvidenceItems(record)
  for (const item of selectedEvidenceItems(record).filter((current) => current.status === '已完成')) {
    assert.ok(
      hasCompletionEvidence(item),
      `${record.recordNo} ${item.itemType} 已完成时必须有上传记录或面辅料采购单号，并有实际完成时间`,
    )
  }
  for (const item of selectedItems.filter((current) => current.itemType.includes('染色调色'))) {
    assert.ok(item.dyeRequirement, `${record.recordNo} ${item.itemType} 已选择时必须确认染色要求`)
  }
  assertDependsOn(record, '染色调色（纱线）', '确认染色要求（纱线）')
  assertDependsOn(record, '染色调色（面料）', '确认染色要求（面料）')
  for (const item of selectedItems.filter((current) => current.itemType === '染色调色（纱线）' || current.itemType === '染色调色（面料）')) {
    if (item.status !== '已完成') continue
    const requirementType = item.itemType === '染色调色（纱线）' ? '确认染色要求（纱线）' : '确认染色要求（面料）'
    assert.ok(
      hasUploadEvidence(itemByType(record, requirementType)),
      `${record.recordNo} ${item.itemType} 已完成时，${requirementType} 必须已完成`,
    )
  }
  const sampleItem = itemByType(record, '版衣制作')
  if (sampleItem) {
    for (const baseItem of selectedItems.filter((item) => item.itemType === '梭织基码纸样' || item.itemType === '毛织基码纸样')) {
      assert.ok(
        sampleItem.dependsOnItemIds.includes(baseItem.itemId),
        `${record.recordNo} 版衣制作必须依赖 ${baseItem.itemType}`,
      )
    }
  }
  assertDependsOn(record, '梭织齐码纸样', '版衣制作')
  assertDependsOn(record, '毛织齐码纸样', '版衣制作')
  if (record.outputReady) {
    assert.ok(
      selectedItems.every((item) => item.status === '已完成'),
      `${record.recordNo} outputReady=true 时所有已选准备项必须已完成`,
    )
  }
  assert.ok(
    record.imageUrl && existsSync(`public${record.imageUrl}`),
    `${record.recordNo} 商品图片不存在或缺少 imageUrl：${record.imageUrl ?? ''}`,
  )
  if (!(record.workItemsConfirmedBy && record.workItemsConfirmedAt)) {
    assert.equal(
      selectedEvidenceItems(record).filter((item) => item.status === '已完成').length,
      0,
      `${record.recordNo} 未确认工作项前不得存在已完成准备项`,
    )
    assert.equal(record.productionDemandNo, '', `${record.recordNo} 未确认工作项前不得生成生产需求单`)
    assert.equal(record.productionOrderNo, '', `${record.recordNo} 未确认工作项前不得生成生产单`)
    assert.equal(record.outputReady, false, `${record.recordNo} 未确认工作项前 outputReady 必须为 false`)
    assert.equal(record.outputs?.length ?? 0, 0, `${record.recordNo} 未确认工作项前不得生成产出对象`)
  }
}

const preparationItems = flattenProductionPreparationItems(productionPreparationRecords)
assert.ok(Array.isArray(preparationItems), 'flattenProductionPreparationItems 必须返回数组')
assert.ok(preparationItems.length >= 60, '准备项不少于 60 条')
assert.ok(
  preparationItems.every((item: { confirmedProductPrepType?: string }) => Boolean(item.confirmedProductPrepType)),
  '扁平准备项必须带商品类型',
)
assert.ok(getCompletedItemCount(preparationItems) >= 24, '已完成准备项不少于 24 条')
assert.ok(getOverdueItemCount(preparationItems) >= 8, '超时准备项不少于 8 条')
assert.ok(
  preparationItems.filter((item: { itemType: string }) => item.itemType === '数码印/DTF/DTG花型').length >= 6,
  '数码印/DTF/DTG花型不少于 6 条',
)
assert.ok(
  preparationItems.filter(
    (item: { itemType: string }) =>
      item.itemType === '染色调色（纱线）' || item.itemType === '染色调色（面料）',
  ).length >= 5,
  '染色调色不少于 5 条',
)
assert.ok(
  preparationItems.filter(
    (item: { itemType: string }) => item.itemType === '毛织基码纸样' || item.itemType === '毛织齐码纸样',
  ).length >= 3,
  '毛织纸样（基码+齐码）不少于 3 条',
)

const expectedPrepTypes = [
  '非烫画&非毛织（纯梭织）',
  '烫画&直喷',
  '毛织',
  '毛织&梭织',
] as const

for (const type of expectedPrepTypes) {
  assert.ok(
    productionPreparationRecords.some(
      (record: { confirmedProductPrepType?: string }) => record.confirmedProductPrepType === type,
    ),
    `缺少商品准备类型：${type}`,
  )
}
assert.ok(preparationTypeDefaultItems, '必须导出 preparationTypeDefaultItems 商品类型准备项模板')
assert.deepEqual(
  Object.keys(preparationTypeDefaultItems),
  [...expectedPrepTypes],
  'preparationTypeDefaultItems 必须覆盖四类商品且保持弹窗展示顺序',
)
assert.deepEqual(
  preparationTypeDefaultItems['烫画&直喷'].map((item: { itemType: string }) => item.itemType),
  ['数码印/DTF/DTG花型'],
  '烫画&直喷模板只能包含数码印/DTF/DTG花型',
)
const accessoryTemplateItem = preparationTypeDefaultItems['非烫画&非毛织（纯梭织）'].find(
  (item: { itemType: string }) => item.itemType === '辅料下单',
)
assert.ok(accessoryTemplateItem, '纯梭织模板必须包含辅料下单')
assert.equal(accessoryTemplateItem.defaultSelected, true, '辅料下单必须默认勾选')
assert.equal(accessoryTemplateItem.canUnselect, true, '辅料下单必须可取消，不能锁死')

assert.ok(
  productionPreparationRecords.every(
    (record: {
      selectionName?: string
      largeGoodsThresholdQty?: number
      largeGoodsReachedQty?: number
      largeGoodsReachedAt?: string
      largeGoodsReachedDays?: number
      derivedProductPrepType?: string
      confirmedProductPrepType?: string
      prepTypeSource?: string
      prepTypeConfirmedBy?: string
      prepTypeConfirmedAt?: string
    }) =>
      record.selectionName &&
      record.largeGoodsThresholdQty === 300 &&
      typeof record.largeGoodsReachedQty === 'number' &&
      Boolean(record.largeGoodsReachedAt) &&
      typeof record.largeGoodsReachedDays === 'number' &&
      Boolean(record.derivedProductPrepType) &&
      Boolean(record.confirmedProductPrepType) &&
      Boolean(record.prepTypeSource) &&
      Boolean(record.prepTypeConfirmedBy) &&
      Boolean(record.prepTypeConfirmedAt),
  ),
  '每条记录必须包含选品、做大货入口字段和商品类型确认字段',
)
assert.ok(
  productionPreparationRecords.every(
    (record: {
      workItemsConfirmedBy?: string
      workItemsConfirmedAt?: string
      outputs?: Array<{ outputGeneratedAt?: string; outputStatus?: string }>
      items?: Array<{ uploads?: unknown[]; downloads?: unknown[] }>
    }) =>
      record.outputs?.every((output) =>
        output.outputStatus === '预计生成' ? output.outputGeneratedAt === '' : Boolean(output.outputGeneratedAt),
      ) &&
      record.items?.every((item) => Array.isArray(item.uploads) && Array.isArray(item.downloads)),
  ),
  '准备项必须有上传下载数组，已生成产出必须有产出时间',
)
assert.ok(
  productionPreparationRecords.some(
    (record: { workItemsConfirmedBy?: string; workItemsConfirmedAt?: string }) =>
      !(record.workItemsConfirmedBy && record.workItemsConfirmedAt),
  ),
  'mock 数据必须覆盖进入列表后尚未由跟单确认工作项的记录',
)

const overriddenRecord = productionPreparationRecords.find(
  (record: { prepTypeSource?: string }) => record.prepTypeSource === '人工修正',
) as { prepTypeOverrideReason?: string } | undefined
assert.ok(overriddenRecord, '必须有一条商品准备类型人工修正 mock')
assert.ok(
  overriddenRecord.prepTypeOverrideReason,
  '人工修正商品准备类型必须填写修正原因',
)

type CheckRecord = {
  recordNo: string
  items: Array<{
    itemType: string
    requiredKind?: string
    selectedByMerchandiser?: boolean
    status?: string
    patternDesignerName?: string
    buyerReviewStatus?: string
    completionImageIds?: string[]
    patternFileIds?: string[]
  }>
}

function itemNames(record: {
  items: Array<{ itemType: string; requiredKind?: string; selectedByMerchandiser?: boolean }>
}): string[] {
  return record.items
    .filter((item) => item.selectedByMerchandiser !== false)
    .map((item) => item.itemType)
}

function assertRecordHasItems(
  record: CheckRecord,
  expected: string[],
): void {
  const actual = itemNames(record)
  assert.deepEqual(actual, expected, `${record.recordNo} 已选择准备项模板必须精确匹配`)
  for (const itemType of new Set(actual)) {
    const count = actual.filter((name) => name === itemType).length
    assert.equal(count, 1, `${record.recordNo} 已选择准备项 ${itemType} 不得重复`)
  }
}

for (const record of productionPreparationRecords as CheckRecord[]) {
  const selectedAccessoryCount = record.items.filter(
    (item) => item.itemType === '辅料下单' && item.selectedByMerchandiser !== false,
  ).length
  assert.ok(selectedAccessoryCount <= 1, `${record.recordNo} 被选中的辅料下单不得超过 1 条`)
}

const wovenRecord = productionPreparationRecords.find(
  (record: { confirmedProductPrepType?: string }) => record.confirmedProductPrepType === '非烫画&非毛织（纯梭织）',
)
const printRecord = productionPreparationRecords.find(
  (record: { confirmedProductPrepType?: string }) => record.confirmedProductPrepType === '烫画&直喷',
)
const knitRecord = productionPreparationRecords.find(
  (record: { confirmedProductPrepType?: string }) => record.confirmedProductPrepType === '毛织',
)
const mixedRecord = productionPreparationRecords.find(
  (record: { confirmedProductPrepType?: string }) => record.confirmedProductPrepType === '毛织&梭织',
)

assert.ok(wovenRecord, '缺少纯梭织记录')
assert.ok(printRecord, '缺少烫画&直喷记录')
assert.ok(knitRecord, '缺少毛织记录')
assert.ok(mixedRecord, '缺少毛织&梭织记录')

assertRecordHasItems(wovenRecord, ['梭织基码纸样', '版衣制作', '梭织齐码纸样', '辅料下单', '数码印/DTF/DTG花型'])
assert.deepEqual(itemNames(printRecord), ['数码印/DTF/DTG花型'], '烫画&直喷应有且仅有花型必做项')
assertRecordHasItems(knitRecord, ['毛织基码纸样', '版衣制作', '毛织齐码纸样', '辅料下单', '染色调色（面料）', '确认染色要求（面料）'])
assertRecordHasItems(mixedRecord, [
  '毛织基码纸样',
  '梭织基码纸样',
  '版衣制作',
  '毛织齐码纸样',
  '梭织齐码纸样',
  '辅料下单',
  '染色调色（纱线）',
  '染色调色（面料）',
  '确认染色要求（纱线）',
  '确认染色要求（面料）',
])

assert.ok(
  preparationItems.some(
    (item: { requiredKind?: string; selectedByMerchandiser?: boolean }) =>
      item.requiredKind === '选填' && item.selectedByMerchandiser === false,
  ),
  '必须存在未选择的选填准备项',
)

const marchStats = buildMonthlyPreparationStats('2026-03')
assert.ok(Array.isArray(marchStats), 'buildMonthlyPreparationStats 必须返回数组')
const marchDetails = buildMonthlyPreparationCompletionDetails('2026-03')
assert.ok(Array.isArray(marchDetails), 'buildMonthlyPreparationCompletionDetails 必须返回数组')
const marchCompletedCount = marchStats.reduce(
  (sum: number, row: { completedCount: number }) => sum + row.completedCount,
  0,
)
assert.equal(
  marchCompletedCount,
  marchDetails.length,
  '2026-03 completedCount 总和必须等于完成明细行数',
)
const baseCodeCount =
  getCompletedCount(marchStats, '梭织基码纸样') + getCompletedCount(marchStats, '毛织基码纸样')
const fullSizeCount =
  getCompletedCount(marchStats, '梭织齐码纸样') + getCompletedCount(marchStats, '毛织齐码纸样')
const patternCount = getCompletedCount(marchStats, '数码印/DTF/DTG花型')
const dyeCount =
  getCompletedCount(marchStats, '染色调色（纱线）') + getCompletedCount(marchStats, '染色调色（面料）')
assert.ok(baseCodeCount > 0, '2026-03 基码完成数量必须大于 0')
assert.ok(fullSizeCount > 0, '2026-03 齐码完成数量必须大于 0')
assert.ok(patternCount > 0, '2026-03 花型完成数量必须大于 0')
assert.ok(dyeCount > 0, '2026-03 染色完成数量必须大于 0')
assert.ok(
  marchDetails.every((row: { recordStatus?: string }) => row.recordStatus !== '已关闭'),
  '完成明细不应包含已关闭记录',
)
assert.ok(
  marchDetails.every((row: { selectedByMerchandiser?: boolean }) => row.selectedByMerchandiser === true),
  '完成明细每行必须是已选择准备项',
)
assert.ok(
  marchDetails.every((row: { itemStatus?: string }) => row.itemStatus === '已完成'),
  '完成明细每行 itemStatus 必须为已完成',
)
const completedDetailFixtureSource = productionPreparationRecords.find(
  (record: { recordNo?: string }) => record.recordNo === 'PREP-202603-003',
) as
  | {
      recordId: string
      recordNo: string
      status: string
      items: Array<{
        itemId: string
        recordId: string
        status: string
        selectedByMerchandiser?: boolean
        actualFinishAt: string
      }>
    }
  | undefined
assert.ok(completedDetailFixtureSource, '缺少完成明细排除口径 fixture 源记录')
const completionExclusionFixtures = [
  {
    ...completedDetailFixtureSource,
    recordId: 'prep-check-closed',
    recordNo: 'PREP-CHECK-CLOSED',
    status: '已关闭',
    items: completedDetailFixtureSource.items.map((item, index: number) => ({
      ...item,
      itemId: `prep-check-closed-item-${index + 1}`,
      recordId: 'prep-check-closed',
      status: '已完成',
      selectedByMerchandiser: true,
      actualFinishAt: '2026-03-20T12:00:00',
    })),
  },
  {
    ...completedDetailFixtureSource,
    recordId: 'prep-check-noneed',
    recordNo: 'PREP-CHECK-NONEED',
    status: '进行中',
    items: completedDetailFixtureSource.items.map((item, index: number) => ({
      ...item,
      itemId: `prep-check-noneed-item-${index + 1}`,
      recordId: 'prep-check-noneed',
      status: '无需',
      selectedByMerchandiser: true,
      actualFinishAt: '2026-03-21T12:00:00',
    })),
  },
]
productionPreparationRecords.push(...completionExclusionFixtures)
try {
  const fixtureDetails = buildMonthlyPreparationCompletionDetails('2026-03')
  assert.ok(
    !fixtureDetails.some((row: { recordNo?: string }) => row.recordNo === 'PREP-CHECK-CLOSED'),
    '完成明细不应包含已关闭 fixture 记录',
  )
  assert.ok(
    !fixtureDetails.some((row: { recordNo?: string }) => row.recordNo === 'PREP-CHECK-NONEED'),
    '完成明细不应包含无需 fixture 准备项',
  )
} finally {
  productionPreparationRecords.splice(
    productionPreparationRecords.length - completionExclusionFixtures.length,
    completionExclusionFixtures.length,
  )
}
const patternDesignerRecords = filterProductionPreparationRecords({
  itemType: '数码印/DTF/DTG花型',
  patternDesigner: '林小美',
})
assert.ok(Array.isArray(patternDesignerRecords), 'filterProductionPreparationRecords 必须返回数组')
assert.ok(patternDesignerRecords.length > 0, '花型师林小美必须能命中花型数据')
const patternOnlyDetails = buildMonthlyPreparationCompletionDetails('2026-03', { itemType: '数码印/DTF/DTG花型' })
assert.ok(patternOnlyDetails.length > 0, '2026-03 花型完成明细必须有数据')
assert.ok(
  patternOnlyDetails.every((row: { itemType: string }) => row.itemType === '数码印/DTF/DTG花型'),
  '按准备项类型筛选月度统计时，完成明细只能包含该准备项',
)
const patternTeamOnlyDetails = buildMonthlyPreparationCompletionDetails('2026-03', { ownerTeam: '花型团队' })
assert.ok(patternTeamOnlyDetails.length > 0, '2026-03 花型团队完成明细必须有数据')
assert.ok(
  patternTeamOnlyDetails.every((row: { ownerTeam: string }) => row.ownerTeam === '花型团队'),
  '按责任团队筛选月度统计时，完成明细只能包含该责任团队',
)
const multiSelectPatternDetails = buildMonthlyPreparationCompletionDetails('2026-03', {
  itemTypes: ['数码印/DTF/DTG花型', '梭织基码纸样'],
  ownerTeams: ['花型团队'],
  itemProgresses: ['不满足开始条件'],
})
assert.ok(multiSelectPatternDetails.length > 0, '月度明细必须支持准备项类型和责任团队多选')
assert.ok(
  multiSelectPatternDetails.every(
    (row: { itemType: string; ownerTeam: string }) =>
      row.itemType === '数码印/DTF/DTG花型' && row.ownerTeam === '花型团队',
  ),
  '月度明细的类型和团队多选必须在同一完成项上匹配',
)
assert.equal(
  multiSelectPatternDetails.length,
  buildMonthlyPreparationCompletionDetails('2026-03', {
    itemTypes: ['数码印/DTF/DTG花型', '梭织基码纸样'],
    ownerTeams: ['花型团队'],
  }).length,
  '月度完成明细不得读取 itemProgresses，统计只依赖实际完成事实',
)
const designerOnlyDetails = buildMonthlyPreparationCompletionDetails('2026-03', { patternDesigner: '冰冰' })
assert.ok(designerOnlyDetails.length > 0, '2026-03 冰冰完成明细必须有数据')
assert.ok(
  designerOnlyDetails.every(
    (row: { itemType: string; patternDesignerName?: string }) =>
      row.itemType === '数码印/DTF/DTG花型' && row.patternDesignerName === '冰冰',
  ),
  '按花型师筛选月度统计时，完成明细只能包含该花型师的花型项',
)

const marchFabricDyeRecords = filterProductionPreparationRecords({
  month: '2026-03',
  itemType: '染色调色（面料）',
})
assert.ok(
  !marchFabricDyeRecords.some((record: { recordNo?: string }) => record.recordNo === 'PREP-202603-001'),
  '未选择的面料染色选填项不应命中记录级准备项筛选',
)
const marchPatternRecords = filterProductionPreparationRecords({
  month: '2026-03',
  itemType: '数码印/DTF/DTG花型',
})
assert.ok(
  !marchPatternRecords.some((record: { recordNo?: string }) => record.recordNo === 'PREP-202603-002'),
  '未选择花型的记录不应命中记录级花型筛选',
)
const marchDyeTeamRecords = filterProductionPreparationRecords({
  month: '2026-03',
  ownerTeam: '染色团队',
})
assert.ok(
  !marchDyeTeamRecords.some((record: { recordNo?: string }) => record.recordNo === 'PREP-202603-001'),
  '未选择的染色团队选填项不应命中记录级责任团队筛选',
)
assert.ok(
  marchDyeTeamRecords.some((record: { recordNo?: string }) =>
    record.recordNo === 'PREP-202603-002' || record.recordNo === 'PREP-202603-004',
  ),
  '记录级责任团队筛选必须保留已选择染色团队项的记录',
)
const unselectedPatternFilterFixture = (productionPreparationRecords as CheckRecord[])
  .filter((record) => record.recordNo === 'PREP-202603-005')
  .map((record) => ({
    ...record,
    items: record.items.map((item) =>
      item.itemType === '数码印/DTF/DTG花型'
        ? {
            ...item,
            selectedByMerchandiser: false,
            status: '待确认',
            patternDesignerName: '林小美',
            buyerReviewStatus: '待确认',
            completionImageIds: [],
            patternFileIds: [],
          }
        : item,
    ),
  }))
assert.equal(
  filterProductionPreparationRecords({ patternDesigner: '林小美' }, unselectedPatternFilterFixture).length,
  0,
  '记录级花型师筛选不应命中未选择花型选填项',
)
assert.equal(
  filterProductionPreparationRecords({ quickFilter: '我的花型任务' }, unselectedPatternFilterFixture).length,
  0,
  '我的花型任务不应命中未选择花型选填项',
)
assert.equal(
  filterProductionPreparationRecords({ quickFilter: '待上传完成图' }, unselectedPatternFilterFixture).length,
  0,
  '待上传完成图不应命中未选择花型选填项',
)
assert.equal(
  filterProductionPreparationRecords({ quickFilter: '待买手确认' }, unselectedPatternFilterFixture).length,
  0,
  '待买手确认不应命中未选择花型选填项',
)

const progressFixtureSource = productionPreparationRecords.find(
  (record: { recordNo?: string }) => record.recordNo === 'PREP-202603-002',
)
assert.ok(progressFixtureSource, '缺少准备项进度与多选筛选 fixture 源记录')
const progressFixtureItems = progressFixtureSource.items.slice(0, 2).map((item, index) => ({
  ...item,
  itemId: `prep-progress-item-${index + 1}`,
  recordId: 'prep-progress-record',
  selectedByMerchandiser: true,
  dependsOnItemIds: [],
  status: '待开始' as const,
  actualFinishAt: '',
  uploads: [],
  accessoryPurchaseOrderNos: undefined,
  accessoryPurchaseUpdatedAt: undefined,
}))
const progressFixtureRecord = {
  ...progressFixtureSource,
  recordId: 'prep-progress-record',
  recordNo: 'PREP-PROGRESS-RECORD',
  merchandiserName: '跟单甲',
  status: '进行中' as const,
  workItemsConfirmedBy: '确认人',
  workItemsConfirmedAt: '2026-03-01T09:00:00',
  items: progressFixtureItems,
}
const ordinaryCompletedItem = {
  ...progressFixtureItems[0],
  itemType: '梭织基码纸样' as const,
  ownerTeam: '版师团队',
  status: '已完成' as const,
  actualFinishAt: '2026-03-02T10:00:00',
  uploads: [],
}
assert.equal(
  hasValidPreparationCompletionEvidence(ordinaryCompletedItem),
  false,
  '普通准备项状态已完成但没有完整上传时不算有效完成',
)
const ordinaryValidItem = {
  ...ordinaryCompletedItem,
  uploads: [{
    uploadId: 'upload-progress-valid',
    recordId: progressFixtureRecord.recordId,
    itemId: ordinaryCompletedItem.itemId,
    itemType: ordinaryCompletedItem.itemType,
    fileName: '完成凭证.pdf',
    fileType: 'application/pdf',
    fileSize: 1,
    fileDataUrl: '',
    uploadedBy: '版师甲',
    uploadedAt: ordinaryCompletedItem.actualFinishAt,
    note: '',
  }],
}
assert.equal(hasValidPreparationCompletionEvidence(ordinaryValidItem), true, '普通准备项必须识别完整上传凭证')
const monthlyMissingUploadFixture = {
  ...progressFixtureRecord,
  recordId: 'prep-monthly-missing-upload',
  recordNo: 'PREP-MONTHLY-MISSING-UPLOAD',
  enteredAt: '2026-03-01T09:00:00',
  items: [{
    ...ordinaryCompletedItem,
    itemId: 'prep-monthly-missing-upload-item',
    recordId: 'prep-monthly-missing-upload',
    plannedStartAt: '2026-03-01T09:00:00',
    plannedFinishAt: '2026-03-02T18:00:00',
    actualFinishAt: '2026-03-02T10:00:00',
    uploads: [],
  }],
}
productionPreparationRecords.push(monthlyMissingUploadFixture)
try {
  assert.ok(
    !buildMonthlyPreparationCompletionDetails('2026-03').some(
      (detail: { recordNo?: string }) => detail.recordNo === monthlyMissingUploadFixture.recordNo,
    ),
    '普通准备项即使状态已完成且有实际完成时间，无完整上传凭证也不得进入月度完成明细',
  )
} finally {
  productionPreparationRecords.pop()
}
const accessoryWithoutOrderItem = {
  ...progressFixtureItems[0],
  itemType: '辅料下单' as const,
  ownerTeam: '采购团队',
  status: '已完成' as const,
  actualFinishAt: '2026-03-02T11:00:00',
  accessoryPurchaseOrderNos: [],
  accessoryPurchaseUpdatedAt: '',
}
assert.equal(
  hasValidPreparationCompletionEvidence(accessoryWithoutOrderItem),
  false,
  '辅料下单状态已完成但没有采购单号和下单时间时不算有效完成',
)
assert.equal(
  hasValidPreparationCompletionEvidence({
    ...accessoryWithoutOrderItem,
    accessoryPurchaseOrderNos: ['FPO-PROGRESS-001'],
    accessoryPurchaseUpdatedAt: accessoryWithoutOrderItem.actualFinishAt,
  }),
  true,
  '辅料下单的最后下单时间等于实际完成时间时必须算有效完成且不依赖上传',
)
assert.equal(
  derivePreparationItemProgress(progressFixtureItems[0], { ...progressFixtureRecord, workItemsConfirmedAt: '' }),
  '不满足开始条件',
  '未确认工作项时准备项进度必须是不满足开始条件',
)
const dependencyBlockedRecord = {
  ...progressFixtureRecord,
  items: [ordinaryCompletedItem, { ...progressFixtureItems[1], dependsOnItemIds: [ordinaryCompletedItem.itemId] }],
}
assert.equal(
  derivePreparationItemProgress(dependencyBlockedRecord.items[1], dependencyBlockedRecord),
  '不满足开始条件',
  '依赖项缺少有效完成凭证时准备项进度必须是不满足开始条件',
)
assert.equal(
  derivePreparationItemProgress(ordinaryValidItem, { ...progressFixtureRecord, items: [ordinaryValidItem] }),
  '已完成',
  '当前项具备有效完成凭证时准备项进度必须是已完成',
)
assert.equal(
  derivePreparationItemProgress(progressFixtureItems[0], progressFixtureRecord),
  '未开始',
  '满足开始条件但尚无有效完成凭证时所有过程状态统一派生为未开始',
)

const multiSelectFilterFixture = [
  {
    ...progressFixtureRecord,
    items: [
      { ...progressFixtureItems[0], itemType: '梭织基码纸样' as const, ownerTeam: '版师团队' },
      { ...progressFixtureItems[1], itemType: '版衣制作' as const, ownerTeam: '车板团队' },
    ],
  },
  {
    ...progressFixtureRecord,
    recordId: 'prep-progress-record-b',
    recordNo: 'PREP-PROGRESS-RECORD-B',
    merchandiserName: '跟单乙',
    status: '未开始' as const,
    items: [{ ...progressFixtureItems[0], itemId: 'prep-progress-b-1', recordId: 'prep-progress-record-b', itemType: '毛织基码纸样' as const, ownerTeam: '毛织团队' }],
  },
]
for (const [filter, label] of [
  [{ merchandiserNames: [], merchandiserName: '跟单甲' }, '跟单'],
  [{ recordStatuses: [], recordStatus: '进行中' }, '记录状态'],
  [{ itemTypes: [], itemType: '梭织基码纸样' }, '准备项类型'],
  [{ ownerTeams: [], ownerTeam: '版师团队' }, '责任团队'],
] as const) {
  assert.equal(
    filterProductionPreparationRecords(filter, multiSelectFilterFixture).length,
    multiSelectFilterFixture.length,
    `${label}新数组显式为空时必须表示不限制，不得回退旧单值字段`,
  )
}
assert.equal(
  filterProductionPreparationRecords(
    { itemTypes: ['梭织基码纸样'], ownerTeams: ['车板团队'] },
    multiSelectFilterFixture,
  ).length,
  0,
  '准备项筛选必须由同一准备项同时匹配，禁止 A 项匹配类型、B 项匹配团队',
)
assert.deepEqual(
  filterProductionPreparationRecords(
    { merchandiserNames: ['跟单甲', '跟单乙'], recordStatuses: ['进行中', '未开始'] },
    multiSelectFilterFixture,
  ).map((record) => record.recordNo),
  ['PREP-PROGRESS-RECORD', 'PREP-PROGRESS-RECORD-B'],
  '同一筛选组内多个值必须按 OR 匹配',
)
assert.deepEqual(
  filterProductionPreparationRecords(
    {
      merchandiserNames: ['跟单甲', '跟单乙'],
      recordStatuses: ['进行中'],
      itemTypes: ['梭织基码纸样', '毛织基码纸样'],
      ownerTeams: ['版师团队', '毛织团队'],
      itemProgresses: ['未开始'],
    },
    multiSelectFilterFixture,
  ).map((record) => record.recordNo),
  ['PREP-PROGRESS-RECORD'],
  '不同筛选组之间必须按 AND 匹配，准备项三个条件必须落在同一次 some 判断内',
)
const printOnlyRecord = productionPreparationRecords.find(
  (record: { recordId?: string }) => record.recordId === 'prep-202603-003',
) as { outputs?: Array<{ outputType: string }> } | undefined
assert.ok(printOnlyRecord, '缺少 prep-202603-003 烫画&直喷记录')
assert.ok(
  !printOnlyRecord.outputs?.some((output) =>
    output.outputType === '染色需求单' ||
    output.outputType === '染色加工单' ||
    output.outputType === '辅料采购单',
  ),
  '烫画&直喷单花型记录不应生成染色需求单、染色加工单或辅料采购单',
)

const pageModule = await import('../src/pages/production/preparation-timing.ts')
const renderProductionPreparationTimingPage = pageModule.renderProductionPreparationTimingPage as
  | ((path?: string) => string | Promise<string>)
  | undefined
const renderProductionPreparationTimingStatisticsPage = pageModule.renderProductionPreparationTimingStatisticsPage as
  | ((path?: string) => string | Promise<string>)
  | undefined
const handleProductionPreparationTimingEvent = pageModule.handleProductionPreparationTimingEvent as
  | ((target: HTMLElement) => boolean)
  | undefined
assert.equal(typeof renderProductionPreparationTimingPage, 'function', '页面必须导出 renderProductionPreparationTimingPage')
assert.equal(typeof renderProductionPreparationTimingStatisticsPage, 'function', '页面必须导出 renderProductionPreparationTimingStatisticsPage')
assert.equal(typeof handleProductionPreparationTimingEvent, 'function', '页面必须导出 handleProductionPreparationTimingEvent')

const { appStore } = await import('../src/state/store.ts')
async function renderAt(path: string): Promise<string> {
  appStore.navigate(path, { historyMode: 'replace' })
  const html = await renderProductionPreparationTimingPage(path)
  assert.equal(typeof html, 'string', 'renderProductionPreparationTimingPage 必须返回 HTML 字符串')
  return html
}
async function renderStatsAt(path: string): Promise<string> {
  appStore.navigate(path, { historyMode: 'replace' })
  const startedAt = performance.now()
  const html = await renderProductionPreparationTimingStatisticsPage(path)
  assert.equal(typeof html, 'string', 'renderProductionPreparationTimingStatisticsPage 必须返回 HTML 字符串')
  assert.ok(performance.now() - startedAt < 200, '生产准备时效统计页面渲染响应必须小于 200ms')
  return html
}

const staticDownloadFixture = productionPreparationRecords.find(
  (record: { recordNo?: string }) => record.recordNo === 'PREP-202603-003',
) as
  | {
      recordId: string
      items: Array<{
        itemId: string
        uploads?: Array<{ uploadId: string; fileName: string; fileDataUrl?: string }>
      }>
    }
  | undefined
const staticDownloadItem = staticDownloadFixture?.items.find((item) => item.uploads?.length)
const staticDownloadUpload = staticDownloadItem?.uploads?.[0]
assert.ok(staticDownloadFixture && staticDownloadItem && staticDownloadUpload, '缺少静态历史上传下载 fixture')
const originalWindow = (globalThis as { window?: unknown }).window
const originalDocument = (globalThis as { document?: unknown }).document
const storage = new Map<string, string>()
;(globalThis as { window?: unknown }).window = {
  location: { pathname: '/fcs/production/preparation-timing', search: '?tab=ledger&month=2026-03' },
  history: { replaceState: () => undefined, pushState: () => undefined },
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
  dispatchEvent: () => true,
}
;(globalThis as { document?: unknown }).document = {
  createElement: () => ({ href: '', download: '', click: () => undefined, remove: () => undefined }),
  body: { appendChild: () => undefined },
}
try {
  const handledStaticDownload = handleProductionPreparationTimingEvent({
    closest: (selector: string) =>
      selector === '[data-prep-action]'
        ? {
            dataset: {
              prepAction: 'download-upload',
              uploadId: staticDownloadUpload.uploadId,
            },
          }
        : null,
  } as unknown as HTMLElement)
  assert.equal(handledStaticDownload, true, '静态历史上传下载事件必须被处理')
  const storedRuntime = JSON.parse(storage.get(PREPARATION_RUNTIME_STORAGE_KEY) ?? '{}') as {
    downloads?: Array<{ uploadId?: string; itemId?: string; fileName?: string }>
  }
  assert.ok(
    storedRuntime.downloads?.some(
      (download) =>
        download.uploadId === staticDownloadUpload.uploadId &&
        download.itemId === staticDownloadItem.itemId &&
        download.fileName === staticDownloadUpload.fileName,
    ),
    '静态历史上传点击下载后必须写入下载记录',
  )
} finally {
  ;(globalThis as { window?: unknown }).window = originalWindow
  ;(globalThis as { document?: unknown }).document = originalDocument
}

const ledgerHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&patternDesigner=林小美')
for (const text of [
  '生产准备时效',
  '准备台账',
  '日期',
  '责任团队',
  '责任人',
] as const) {
  assertHtmlIncludes(ledgerHtml, text, `准备台账 HTML 缺少「${text}」`)
}
assert.ok(!ledgerHtml.includes('>月份<'), '准备台账筛选不应继续展示月份筛选')
assert.ok(!ledgerHtml.includes('>跟单<'), '准备台账筛选不应继续展示跟单筛选')
assert.ok(!ledgerHtml.includes('>花型师<'), '准备台账筛选不应继续展示花型师筛选')
assert.ok(!ledgerHtml.includes('>开始日期<'), '准备台账筛选不应继续单独展示开始日期')
assert.ok(!ledgerHtml.includes('>结束日期<'), '准备台账筛选不应继续单独展示结束日期')
for (const text of [
  '月度统计',
  '明细统计',
  '按生产准备记录跟进基码、版衣、齐码、花型、染色、辅料等准备项完成情况。',
  '统计口径：生产准备记录 + 准备项 = 1',
  '快捷筛选',
  '我的花型任务',
  '待上传完成图',
  '待买手确认',
] as const) {
  assert.ok(!ledgerHtml.includes(text), `准备台账 HTML 不应再显示「${text}」`)
}
const adjustedLedgerHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03')
for (const text of [
  '达到做大货要求',
  '阈值 300 件 / 达到 426 件 / 4 天',
  '准备时间',
  '完成情况',
  '进入：',
  '预计：',
  '实际：',
  '非烫画&amp;非毛织（纯梭织）',
  '确认工作项',
  '共 6 条，第 1/2 页',
  '上一页',
  '下一页',
] as const) {
  assertHtmlIncludes(adjustedLedgerHtml, text, `调整后准备台账 HTML 缺少「${text}」`)
}
assert.ok(!adjustedLedgerHtml.includes('PREP-202603-006'), '准备台账第一页 tbody 不应渲染第 6 条记录')
assert.ok(!adjustedLedgerHtml.includes('跟单确认：'), '商品类型列不应继续展示「跟单确认：」前缀')
assert.ok(!adjustedLedgerHtml.includes('商品\t商品类型\t'), '准备台账不应继续把商品类型作为独立列')
assert.ok(!adjustedLedgerHtml.includes('<th class="px-4 py-3 font-medium">当前卡点</th>'), '准备台账列表不应继续展示当前卡点列')
assert.ok(!adjustedLedgerHtml.includes('<th class="px-4 py-3 font-medium">达到做大货要求</th>'), '准备台账不应继续把达到做大货要求作为独立列')
assert.ok(!adjustedLedgerHtml.includes('<th class="px-4 py-3 font-medium">进入准备时间</th>'), '准备台账不应继续单独展示进入准备时间列')
assert.ok(!adjustedLedgerHtml.includes('<th class="px-4 py-3 font-medium">预计完成时间</th>'), '准备台账不应继续单独展示预计完成时间列')
assert.ok(!adjustedLedgerHtml.includes('<th class="px-4 py-3 font-medium">完成进度</th>'), '准备台账不应继续展示完成进度列')
assert.ok(!adjustedLedgerHtml.includes('待分配花型任务'), '统计卡不应继续展示待分配花型任务')
assertHtmlIncludes(adjustedLedgerHtml, '待跟单确认', '准备台账必须展示跟单尚未确认类型的 mock 数据')
assertHtmlIncludes(adjustedLedgerHtml, '确认面料染色要求', '已确认且选择染色项的记录必须展示确认染色要求入口')
const adjustedLedgerPage2Html = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&page=2')
assertHtmlIncludes(adjustedLedgerPage2Html, '共 6 条，第 2/2 页', '准备台账第二页必须显示分页状态')
assertHtmlIncludes(adjustedLedgerPage2Html, 'PREP-202603-006', '准备台账第二页必须渲染第 6 条记录')
assert.ok(!adjustedLedgerPage2Html.includes('PREP-202603-001'), '准备台账第二页 tbody 不应继续渲染第一页记录')
const aprilLedgerHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-04')
const aprilLedgerPage2Html = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-04&page=2')
const combinedLedgerPagesHtml = `${adjustedLedgerHtml}\n${adjustedLedgerPage2Html}\n${aprilLedgerHtml}\n${aprilLedgerPage2Html}`
assert.ok(
  (combinedLedgerPagesHtml.match(/待跟单确认/g) ?? []).length >= 2,
  '准备台账跨分页必须至少展示 2 条跟单尚未确认类型记录',
)
for (const text of ['产出', '正式版本技术包', '生产需求单', '印花需求单', '染色需求单', '辅料采购单'] as const) {
  assertHtmlIncludes(combinedLedgerPagesHtml, text, `调整后准备台账 HTML 缺少「${text}」`)
}
for (const text of ['产出状态', '操作当前卡点', '准备项确认：', '系统推导：', '人工修正原因：', '预计产出', '最早超时', '暂无超时'] as const) {
  assert.ok(!combinedLedgerPagesHtml.includes(text), `调整后准备台账 HTML 不应显示「${text}」`)
}

const readyOutputHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-003')
assertHtmlIncludes(readyOutputHtml, '产出', '全部完成记录必须展示产出')
assertHtmlIncludes(readyOutputHtml, '已生成', '全部完成记录的产出状态必须为已生成')
for (const text of ['产出对象名称', '产出对象编号', '产出时间'] as const) {
  assertHtmlIncludes(readyOutputHtml, text, `产出表格缺少「${text}」`)
}
assert.ok(!readyOutputHtml.includes('统一生成时间'), '产出状态不应继续只展示统一生成时间')
assert.ok(!/已完成[\s\S]{0,800}暂无上传记录/.test(readyOutputHtml), '已完成准备项详情不得显示暂无上传记录')

const expectedOutputTypes = [
  '正式版本技术包',
  '生产需求单',
  '生产单',
  '印花需求单',
  '印花加工单',
  '染色需求单',
  '染色加工单',
  '辅料采购单',
] as const
const generatedOutputTypes = new Set(
  (productionPreparationRecords as Array<{ outputs?: Array<{ outputType?: string; outputStatus?: string }> }>)
    .flatMap((record) => record.outputs ?? [])
    .filter((output) => output.outputStatus === '已生成')
    .map((output) => output.outputType)
    .filter(Boolean),
)
assert.ok(generatedOutputTypes.size > 0, '必须存在已生成产出对象')
for (const outputType of expectedOutputTypes) {
  assert.ok(generatedOutputTypes.has(outputType), `已生成产出对象缺少「${outputType}」`)
}

const pendingOutputHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-001')
const pendingOutputDrawerHtml = detailDrawerHtml(pendingOutputHtml, 'PREP-202603-001')
assertHtmlIncludes(pendingOutputDrawerHtml, '待跟单确认', '未确认工作项记录必须展示产出空态')
for (const text of ['本次用料', '物料名称', '物料编码', '物料类型', 'FAB-202603-001', '60S 棉府绸印花底布'] as const) {
  assertHtmlIncludes(pendingOutputDrawerHtml, text, `详情抽屉本次用料缺少「${text}」`)
}
for (const text of ['应备', '已配', '已领'] as const) {
  assert.ok(!pendingOutputDrawerHtml.includes(`<th class="px-3 py-2 text-left font-medium">${text}</th>`), `详情抽屉本次用料不应展示「${text}」列`)
}
assertHtmlIncludes(pendingOutputDrawerHtml, 'https://images.unsplash.com/', '详情抽屉本次用料必须展示真实图片')
for (const text of ['责任角色', '版师主管', '操作梭织基码纸样'] as const) {
  assertHtmlIncludes(pendingOutputDrawerHtml, text, `准备项卡片 HTML 缺少责任规则「${text}」`)
}
assert.ok(!pendingOutputDrawerHtml.includes('预计产出'), '未全部完成记录不应展示预计产出')
assert.ok(!pendingOutputDrawerHtml.includes('正式产出'), '未全部完成记录不应展示正式产出')
assert.ok(!pendingOutputHtml.includes('待跟单确认后开放操作'), '未确认工作项的操作列不得展示额外说明')
assert.ok(!pendingOutputHtml.includes('维护染色要求'), '未确认工作项前不得展示旧的维护染色要求入口')
const dependencyActionHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03')
assert.ok(!dependencyActionHtml.includes('maintain-dye-requirement'), '染色要求不应再作为 maintain-dye-requirement 附加动作出现')
assert.ok(!dependencyActionHtml.includes('维护染色要求'), '操作栏不应再显示旧的维护染色要求附加按钮')
assertHtmlIncludes(dependencyActionHtml, '维护非系统内物料', '生产准备时效页面右上角必须有维护非系统内物料入口')
assertHtmlIncludes(
  dependencyActionHtml,
  'action=external-materials',
  '维护非系统内物料按钮必须能打开维护弹窗',
)
assert.ok(
  dependencyActionHtml.includes('确认面料染色要求') || dependencyActionHtml.includes('确认纱线染色要求'),
  '操作栏必须展示确认染色要求准备项动作',
)
const externalMaterialHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&action=external-materials')
assertHtmlIncludes(externalMaterialHtml, '非系统内物料', '非系统内物料弹窗必须展示标题')
assertHtmlIncludes(externalMaterialHtml, 'data-prep-external-material-form', '非系统内物料弹窗必须支持新增')
assertHtmlIncludes(externalMaterialHtml, '印花雪纺Printing seruti S388-1', '非系统内物料弹窗必须展示初始化物料')
assertHtmlIncludes(externalMaterialHtml, '<th class="px-3 py-2 text-left font-medium">序号</th>', '非系统内物料列表必须展示序号列')
const unselectedDyeRequirementHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-005&itemId=prep-202603-005-item-06&action=operate-item',
)
assert.ok(
  !unselectedDyeRequirementHtml.includes('data-prep-dye-requirement-form'),
  '交互可达性反例：未选择染色要求项不得通过 URL 直达染色要求弹窗',
)
const unconfirmedOperateHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-001&itemId=prep-202603-001-item-03&action=operate-item',
)
assert.ok(!unconfirmedOperateHtml.includes('data-prep-operate-item-form'), '未确认工作项前不应允许 URL 直达工作项操作弹窗')
const blockedDependencyOperateHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordId=prep-202604-004&itemId=prep-202604-004-item-09&action=operate-item',
)
assert.ok(
  !blockedDependencyOperateHtml.includes('data-prep-operate-item-form'),
  '交互可达性反例：前置确认染色要求未完成时，不得通过 URL 直达染色调色操作弹窗',
)
const completedDyeRequirementOperateHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-004&itemId=prep-202603-004-item-06&action=operate-item',
)
assert.ok(
  !completedDyeRequirementOperateHtml.includes('data-prep-dye-requirement-form'),
  '交互可达性反例：已完成的确认染色要求不得通过 URL 直达重复确认弹窗',
)
const completedNormalItemOperateHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-003&itemId=prep-202603-003-item-01&action=operate-item',
)
assertHtmlIncludes(
  completedNormalItemOperateHtml,
  'data-prep-operate-item-form',
  '除确认染色要求外，已完成准备项仍必须支持再次打开上传弹窗补充文件',
)
const operateWithoutDrawerHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordStatus=进行中&patternDesigner=Diah&recordId=prep-202604-003&itemId=prep-202604-003-item-01&action=operate-item',
)
assertHtmlIncludes(operateWithoutDrawerHtml, 'data-prep-operate-item-form', '准备项操作入口必须打开操作弹窗')
assert.ok(!operateWithoutDrawerHtml.includes('<aside'), '点击准备项操作入口不应同时打开详情侧边栏')
const confirmWithoutDrawerHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordStatus=进行中&patternDesigner=Diah&recordId=prep-202604-003&action=confirm-items',
)
assertHtmlIncludes(confirmWithoutDrawerHtml, 'data-prep-confirm-items-form', '确认工作项入口必须打开确认弹窗')
assert.ok(!confirmWithoutDrawerHtml.includes('<aside'), '点击确认工作项入口不应同时打开详情侧边栏')

const originalWindowForSerialGate = (globalThis as { window?: unknown }).window
;(globalThis as { window?: unknown }).window = {
  location: { pathname: '/fcs/production/preparation-timing', search: '?tab=ledger&month=2026-03' },
  history: { replaceState: () => undefined, pushState: () => undefined },
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
}
try {
  storage.clear()
  storage.set(PREPARATION_RUNTIME_STORAGE_KEY, JSON.stringify({
    confirmedRecords: {
      'prep-202603-001': {
        confirmedBy: '当前跟单',
        confirmedAt: '2026-07-02T10:00:00',
        confirmedProductPrepType: '毛织',
        selectedItemTypes: ['毛织基码纸样', '版衣制作', '毛织齐码纸样', '辅料下单'],
        overrideReason: '',
      },
    },
    uploads: [{
      uploadId: 'serial-base-upload',
      recordId: 'prep-202603-001',
      itemId: 'prep-202603-001-runtime-毛织基码纸样',
      itemType: '毛织基码纸样',
      fileName: '毛织基码纸样.pdf',
      fileType: 'application/pdf',
      fileSize: 1024,
      fileDataUrl: 'data:application/pdf;base64,JVBERi0xLjQ=',
      uploadedBy: '当前用户',
      uploadedAt: '2026-07-02T10:05:00',
      note: '毛织基码纸样已上传',
    }],
    downloads: [],
  }))
  const serialGateHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03')
  const serialRowStart = serialGateHtml.indexOf('PREP-202603-001')
  const serialRowEnd = serialGateHtml.indexOf('</tr>', serialRowStart)
  const serialRowHtml = serialGateHtml.slice(serialRowStart, serialRowEnd)
  assertHtmlIncludes(
    serialRowHtml,
    'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-03&amp;recordId=prep-202603-001&amp;itemId=prep-202603-001-item-02&amp;action=operate-item"',
    '跟单切换为毛织且毛织基码纸样完成后，版衣制作入口必须可点击',
  )
  assert.ok(
    !serialRowHtml.includes('text-sm text-muted-foreground opacity-60">上传版衣结果'),
    '毛织基码纸样完成后，版衣制作入口不应继续置灰',
  )
  assert.ok(
    serialRowHtml.includes('text-sm text-muted-foreground opacity-60">上传毛织齐码纸样'),
    '版衣制作未完成前，齐码纸样入口仍应置灰',
  )
} finally {
  ;(globalThis as { window?: unknown }).window = originalWindowForSerialGate
  storage.clear()
}

const unselectedOptionalRecord = productionPreparationRecords.find(
  (record: { recordNo?: string }) => record.recordNo === 'PREP-202603-001',
) as
  | {
      items: Array<{
        itemType?: string
        requiredKind?: string
        selectedByMerchandiser?: boolean
      }>
    }
  | undefined
assert.ok(unselectedOptionalRecord, '缺少 PREP-202603-001 未选择选填项源记录')
const unselectedOptionalItem = unselectedOptionalRecord.items.find((item) => item.itemType === '染色调色（面料）')
assert.ok(unselectedOptionalItem, 'PREP-202603-001 缺少染色调色（面料）选填准备项')
assert.equal(unselectedOptionalItem.requiredKind, '选填', '染色调色（面料）必须是选填准备项')
assert.equal(unselectedOptionalItem.selectedByMerchandiser, false, '染色调色（面料）必须是未选择选填项')
assert.ok(
  !marchDetails.some(
    (row: { recordNo?: string; itemType?: string }) =>
      row.recordNo === 'PREP-202603-001' && row.itemType === '染色调色（面料）',
  ),
  '未选择的选填项不应进入月度完成明细',
)

const filteredRowActionHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordStatus=进行中&patternDesigner=Diah',
)
assertHtmlIncludes(
  filteredRowActionHtml,
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD&amp;patternDesigner=Diah&amp;recordId=prep-202604-003"',
  '筛选列表行的查看详情入口必须继承当前筛选条件',
)
assertHtmlIncludes(
  filteredRowActionHtml,
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD&amp;patternDesigner=Diah&amp;recordId=prep-202604-003&amp;itemId=prep-202604-003-item-01&amp;action=operate-item"',
  '筛选列表行的准备项操作入口必须继承当前筛选条件',
)
assert.ok(!filteredRowActionHtml.includes('确认工作项'), '已确认准备项记录不应继续展示确认工作项入口')
const filteredDetailActionHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordStatus=进行中&patternDesigner=Diah&recordId=prep-202604-003',
)
assertHtmlIncludes(filteredDetailActionHtml, '上传记录', '详情抽屉必须展示工作项上传历史')
assertHtmlIncludes(pendingOutputDrawerHtml, '下载记录', '基码纸样卡片必须展示下载记录')
assert.ok(!filteredDetailActionHtml.includes('花型师分配原型区域'), '详情抽屉不应再嵌入花型师分配原型区域')
assert.ok(!filteredDetailActionHtml.includes('上传完成图片原型区域'), '详情抽屉不应再嵌入上传完成图片原型区域')
assert.ok(!filteredDetailActionHtml.includes('分配花型师'), '详情抽屉不应再展示分配花型师入口')
assert.ok(!filteredDetailActionHtml.includes('上传完成图片'), '详情抽屉不应再展示上传完成图片入口')
const confirmItemsHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordStatus=进行中&patternDesigner=Diah&recordId=prep-202604-003&action=confirm-items',
)
assertHtmlIncludes(confirmItemsHtml, 'data-prep-confirm-items-form', '确认工作项弹窗必须输出表单标记')
assertHtmlIncludes(confirmItemsHtml, '确认生产准备工作项', '确认工作项弹窗必须显示标题')
assertHtmlIncludes(confirmItemsHtml, '<input type="hidden" name="recordId" value="prep-202604-003" />', '确认工作项表单必须带 recordId')
assertHtmlIncludes(confirmItemsHtml, '1. 确认商品类型', '确认工作项弹窗必须先确认商品类型')
assertHtmlIncludes(confirmItemsHtml, '2. 确认准备项', '确认工作项弹窗必须再确认准备项')
for (const type of expectedPrepTypes) {
  assertHtmlIncludes(
    confirmItemsHtml,
    `data-prep-type-radio value="${type.replaceAll('&', '&amp;')}"`,
    `确认工作项弹窗缺少 ${type} 类型 radio`,
  )
}
assertHtmlIncludes(confirmItemsHtml, 'data-prep-type-block="烫画&amp;直喷"', '确认工作项弹窗必须按商品类型输出准备项 block')
assertHtmlIncludes(confirmItemsHtml, 'name="confirmedProductPrepType"', '确认工作项表单必须提交确认商品类型')
assertHtmlIncludes(confirmItemsHtml, 'name="selectedItemType"', '确认工作项表单必须按准备项类型提交')
assertHtmlIncludes(confirmItemsHtml, 'name="overrideReason"', '确认工作项表单必须提交修正原因')
assertHtmlIncludes(confirmItemsHtml, 'name="materialNo"', '确认工作项弹窗必须提交本次用料编号')
assertHtmlIncludes(confirmItemsHtml, 'name="materialName"', '确认工作项弹窗必须提交本次用料名称')
assertHtmlIncludes(confirmItemsHtml, 'name="materialSource"', '确认工作项物料行必须支持物料来源')
assertHtmlIncludes(confirmItemsHtml, '系统内物料', '确认工作项必须支持系统内物料来源')
assertHtmlIncludes(confirmItemsHtml, '非系统内物料', '确认工作项必须支持非系统内物料来源')
assertHtmlIncludes(confirmItemsHtml, 'list="prep-material-options"', '确认工作项物料必须用支持搜索的下拉列表选择')
assertHtmlIncludes(confirmItemsHtml, 'list="prep-external-material-options"', '确认工作项必须能选择非系统内物料')
assertHtmlIncludes(confirmItemsHtml, 'name="externalMaterialName"', '确认工作项必须按非系统内物料名称选择')
assert.ok(!confirmItemsHtml.includes('非系统序号'), '确认工作项不得展示非系统序号选择框')
assertHtmlIncludes(confirmItemsHtml, 'data-prep-action="add-material-row"', '确认工作项必须支持新增多个物料行')
assertHtmlIncludes(confirmItemsHtml, '<table class="w-full min-w-[760px] text-sm">', '确认工作项物料行必须用表格展示')
assertHtmlIncludes(confirmItemsHtml, '<tbody data-prep-material-rows>', '确认工作项物料表格必须承载可新增行')
assertHtmlIncludes(confirmItemsHtml, 'flex min-h-0 flex-1 flex-col', '确认工作项弹窗表单必须限制高度，避免底部按钮被挤出视口')
assertHtmlIncludes(confirmItemsHtml, 'overflow-y-auto p-5', '确认工作项弹窗内容区必须可滚动')
assertHtmlIncludes(confirmItemsHtml, 'border-t bg-background p-4', '确认工作项弹窗底部按钮必须固定在内容区外')
assertHtmlIncludes(confirmItemsHtml, 'data-prep-material-preview-image', '已选物料必须展示真实图片')
assertHtmlIncludes(confirmItemsHtml, 'data-prep-material-preview-name', '已选物料必须展示物料名称')
assertHtmlIncludes(confirmItemsHtml, 'data-prep-material-preview-no', '已选物料必须展示物料编号')
assertHtmlIncludes(confirmItemsHtml, 'data-prep-material-preview-type', '已选物料必须展示物料类型')
assertHtmlIncludes(confirmItemsHtml, 'name="materialType"', '确认工作项弹窗必须提交物料类型')
assertHtmlIncludes(confirmItemsHtml, 'https://images.unsplash.com/', '确认工作项物料必须使用真实图片')
assertHtmlIncludes(confirmItemsHtml, 'name="sampleRequirementText"', '确认工作项弹窗必须提交做款/打板要求')
assertHtmlIncludes(confirmItemsHtml, 'name="confirmationRemark"', '确认工作项弹窗必须提交通用备注')
const detailWithExternalMaterialHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-002')
assertHtmlIncludes(detailWithExternalMaterialHtml, '非系统内物料', '详情必须展示非系统内物料来源')
assertHtmlIncludes(detailWithExternalMaterialHtml, '印花雪纺Printing seruti S388-1', '详情必须展示非系统内物料名称')
assert.ok(!confirmItemsHtml.includes('修正原因'), '确认工作项弹窗不应继续展示修正原因')
const wovenConfirmItemsHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-001&action=confirm-items',
)
assert.match(
  wovenConfirmItemsHtml,
  /<input type="checkbox" name="selectedItemType" value="辅料下单"[^>]*checked(?![^>]*disabled)/,
  '辅料下单必须默认勾选且不能 disabled 锁死',
)
const operateItemHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordStatus=进行中&patternDesigner=Diah&recordId=prep-202604-003&itemId=prep-202604-003-item-01&action=operate-item',
)
assertHtmlIncludes(operateItemHtml, 'data-prep-operate-item-form', '工作项操作弹窗必须输出表单标记')
assertHtmlIncludes(operateItemHtml, '<input type="hidden" name="itemId" value="prep-202604-003-item-01" />', '工作项操作表单必须带 itemId')
assertHtmlIncludes(operateItemHtml, '上传文件', '非辅料工作项操作弹窗必须要求上传文件')
assertHtmlIncludes(operateItemHtml, '样衣制作人', '非辅料工作项上传文件下方必须填写样衣制作人')
assertHtmlIncludes(operateItemHtml, 'name="sampleMaker"', '样衣制作人必须用文本输入框提交')
assert.match(
  operateItemHtml,
  /<input type="file" name="files"[^>]*required/,
  '非辅料工作项文件 input 必须 required',
)
assertHtmlIncludes(operateItemHtml, '上传记录', '工作项操作弹窗必须展示上传历史')
const originalWindowForAccessoryOperate = (globalThis as { window?: unknown }).window
;(globalThis as { window?: unknown }).window = {
  location: { pathname: '/fcs/production/preparation-timing', search: '?tab=ledger&month=2026-03' },
  history: { replaceState: () => undefined, pushState: () => undefined },
  localStorage: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
    clear: () => storage.clear(),
  },
}
let accessoryOperateHtml = ''
try {
  storage.clear()
  storage.set(PREPARATION_RUNTIME_STORAGE_KEY, JSON.stringify({
    confirmedRecords: {
      'prep-202603-001': {
        confirmedBy: '当前跟单',
        confirmedAt: '2026-07-02T10:00:00',
        confirmedProductPrepType: '非烫画&非毛织（纯梭织）',
        selectedItemTypes: ['辅料下单'],
        overrideReason: '',
      },
    },
    uploads: [],
    downloads: [],
    externalMaterials: [],
    accessoryPurchaseOrders: {},
  }))
  accessoryOperateHtml = await renderAt(
    '/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-001&itemId=prep-202603-001-item-04&action=operate-item',
  )
} finally {
  ;(globalThis as { window?: unknown }).window = originalWindowForAccessoryOperate
  storage.clear()
}
assertHtmlIncludes(accessoryOperateHtml, 'data-prep-accessory-order-form', '辅料下单必须打开面辅料采购单号登记弹窗')
assertHtmlIncludes(accessoryOperateHtml, 'name="accessoryPurchaseOrderNo"', '辅料下单必须支持填写面辅料采购单号')
assertHtmlIncludes(accessoryOperateHtml, 'name="accessoryPurchaseOrderedAt"', '辅料下单必须填写每个采购单号的下单时间')
assertHtmlIncludes(accessoryOperateHtml, '当前完成时间', '辅料下单弹窗必须展示完成时间')
assertHtmlIncludes(accessoryOperateHtml, 'data-prep-action="add-accessory-order-row"', '辅料下单必须支持新增多个采购单号输入行')
assert.ok(!accessoryOperateHtml.includes('input type="file" name="files"'), '辅料下单不应出现上传文件控件')
assert.ok(!accessoryOperateHtml.includes('下单凭证'), '辅料下单不应展示上传凭证文案')
const accessoryOrderDetailHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-002',
)
assertHtmlIncludes(accessoryOrderDetailHtml, 'FPO-202603-002-A', '辅料下单详情必须展示第一个面辅料采购单号')
assertHtmlIncludes(accessoryOrderDetailHtml, 'FPO-202603-002-B', '辅料下单详情必须展示多个面辅料采购单号')
assertHtmlIncludes(accessoryOrderDetailHtml, '完成时间', '辅料下单详情必须展示完成时间')
const detailWithFiltersHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordStatus=进行中&recordId=prep-202604-001',
)
assertHtmlIncludes(
  detailWithFiltersHtml,
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD"',
  '详情抽屉关闭必须保留当前月份和筛选条件',
)
assertHtmlIncludes(
  detailWithFiltersHtml,
  'data-nav="/fcs/production/orders/PO-202604-001/tech-pack"',
  '正式技术包关联对象必须跳转到真实生产单技术包路由',
)

const statsHtml = await renderStatsAt('/fcs/production/preparation-timing-statistics?tab=monthly&month=2026-03')
const detailStatsHtml = await renderStatsAt('/fcs/production/preparation-timing-statistics?tab=detail&month=2026-03')
appStore.navigate('/fcs/production/preparation-timing-statistics?tab=monthly&month=2026-03', { historyMode: 'replace' })
const routedStatsHtml = await renderProductionPreparationTimingStatisticsPage()
assert.equal(typeof routedStatsHtml, 'string', '无参数渲染必须返回 HTML 字符串')
assertHtmlIncludes(routedStatsHtml, '导出月度统计', '无参数渲染必须读取当前路由并显示月度统计')
assertHtmlIncludes(
  statsHtml,
  'data-nav="/fcs/production/preparation-timing-statistics?tab=detail&amp;month=2026-03"',
  '月度统计表的月份必须可点击进入同月明细统计',
)
assertHtmlIncludes(statsHtml, '共 11 条，第 1/3 页', '月度统计列表必须支持分页')
assertHtmlIncludes(
  statsHtml,
  'data-nav="/fcs/production/preparation-timing-statistics?tab=monthly&amp;month=2026-03&amp;monthlyPage=2"',
  '月度统计列表必须能进入第 2 页',
)
assert.ok(
  !statsHtml.includes('tab=detail&amp;month=2026-03&amp;itemType='),
  '点击月份进入明细时不得默认带准备项筛选，以免隐藏同月其他明细',
)
for (const text of [
  '生产准备时效统计',
  '月度统计',
  '明细统计',
  '导出月度统计',
  '完成基码',
  '完成齐码',
  '完成花型',
  '完成染色',
  '完成数量',
  '按时完成数量',
  '超时完成数量',
  '平均耗时小时',
  '生产准备时效月度统计-202603.csv',
  'data:text/csv;charset=utf-8',
] as const) {
  assertHtmlIncludes(statsHtml, text, `月度统计 HTML 缺少「${text}」`)
}
assert.ok(!statsHtml.includes('导出完成明细'), '月度统计 tab 不应展示完成明细导出')
assertHtmlIncludes(detailStatsHtml, '生产准备时效统计', '明细统计 HTML 缺少标题')
assertHtmlIncludes(detailStatsHtml, '明细统计', '明细统计 HTML 缺少 tab')
assertHtmlIncludes(detailStatsHtml, '导出完成明细', '明细统计 HTML 缺少完成明细导出')
assertHtmlIncludes(detailStatsHtml, '明细表', '明细统计 HTML 缺少明细表')
assertHtmlIncludes(detailStatsHtml, '生产准备时效完成明细-202603.csv', '明细统计 HTML 缺少完成明细文件名')
assertHtmlIncludes(detailStatsHtml, '商品类型', '明细统计 HTML 缺少商品类型')
assertHtmlIncludes(detailStatsHtml, '必做/选填', '明细统计 HTML 缺少必做/选填')
assertHtmlIncludes(detailStatsHtml, '烫画&amp;直喷', '明细统计 HTML 缺少商品类型数据')
assertHtmlIncludes(detailStatsHtml, '梭织齐码纸样', '明细统计必须有 3 月梭织齐码完成 mock 数据')
assertHtmlIncludes(detailStatsHtml, '染色调色（面料）', '明细统计必须有 3 月面料染色完成 mock 数据')
assertHtmlIncludes(detailStatsHtml, '确认染色要求（面料）', '明细统计必须计入确认染色要求准备项')
assertHtmlIncludes(detailStatsHtml, '共 19 条，第 1/3 页', '明细统计列表必须支持分页')
assertHtmlIncludes(
  detailStatsHtml,
  'data-nav="/fcs/production/preparation-timing-statistics?tab=detail&amp;month=2026-03&amp;detailPage=2"',
  '明细统计列表必须能进入第 2 页',
)
assert.ok(!detailStatsHtml.includes('导出月度统计'), '明细统计 tab 不应展示月度统计导出')
assert.ok(!detailStatsHtml.includes('统计表'), '明细统计 tab 不应展示月度统计表')
const monthlyPage2Html = await renderStatsAt('/fcs/production/preparation-timing-statistics?tab=monthly&month=2026-03&monthlyPage=2')
assertHtmlIncludes(monthlyPage2Html, '共 11 条，第 2/3 页', '月度统计第 2 页必须展示分页状态')
const detailPage2Html = await renderStatsAt('/fcs/production/preparation-timing-statistics?tab=detail&month=2026-03&detailPage=2')
assertHtmlIncludes(detailPage2Html, '共 19 条，第 2/3 页', '明细统计第 2 页必须展示分页状态')
const wovenFullSizeDetailHtml = await renderStatsAt(
  '/fcs/production/preparation-timing-statistics?tab=detail&month=2026-03&itemType=%E6%A2%AD%E7%BB%87%E9%BD%90%E7%A0%81%E7%BA%B8%E6%A0%B7',
)
assertHtmlIncludes(wovenFullSizeDetailHtml, '梭织齐码纸样', '按准备项进入明细后必须展示对应完成明细')
assert.ok(
  !wovenFullSizeDetailHtml.includes(encodeURIComponent('毛织齐码纸样')),
  '按梭织齐码进入明细后的导出数据不应混入毛织齐码明细',
)
const detailCsvHeader = [
  '统计月份',
  '准备记录编号',
  'SPU',
  '商品名',
  '生产单号',
  '商品类型',
  '买手',
  '跟单',
  '准备项',
  '必做/选填',
  '责任团队',
  '责任人',
  '计划完成时间',
  '实际完成时间',
  '是否超时',
  '证据摘要',
].join(',')
assertHtmlIncludes(detailStatsHtml, encodeURIComponent(detailCsvHeader), '完成明细 CSV 缺少商品类型和必做/选填字段')
const statsCsvHeader = [
  '统计月份',
  '准备项',
  '完成数量',
  '按时完成数量',
  '超时完成数量',
  '平均耗时小时',
  '责任团队',
  '最近完成时间',
  '口径说明',
  '完成基码',
  '完成齐码',
  '完成花型',
  '完成染色',
].join(',')
assertHtmlIncludes(statsHtml, encodeURIComponent(statsCsvHeader), '月度统计 CSV 缺少完成基码/齐码/花型/染色汇总字段')
assertHtmlIncludes(
  detailStatsHtml,
  encodeURIComponent('烫画&直喷'),
  '完成明细 CSV 缺少商品类型数据',
)

const pageSource = source('src/pages/production/preparation-timing.ts')
assert.ok(!pageSource.includes('染色买手审核'), '本次不应新增染色买手审核流程')
assert.ok(!pageSource.includes('印花买手审核'), '本次不应新增印花买手审核流程')
for (const oldCall of [
  "getCompletedByType('花型')",
  "getCompletedByType('基码纸样')",
  "getCompletedByType('齐码纸样')",
  "getCompletedByType('染色调色')",
] as const) {
  assert.ok(!pageSource.includes(oldCall), `统计卡片不得继续使用旧统计调用 ${oldCall}`)
}
assert.ok(!pageSource.includes('applyPreparationActionMocks'), '页面不得继续依赖 URL action mock')
assert.ok(!pageSource.includes('mockCompletionUploaded'), '页面不得继续使用 mockCompletionUploaded 模拟上传')
assert.ok(!pageSource.includes('已模拟提交完成资料'), '页面不得继续显示模拟上传文案')
assert.ok(pageSource.includes('loadPreparationRuntimeState'), '页面必须读取 production preparation runtime')
assert.ok(pageSource.includes('mergePreparationRuntimeRecords'), '页面必须合并 production preparation runtime')
assert.ok(pageSource.includes('data-prep-action="download-upload"'), '页面必须输出上传文件下载 data 属性')
assert.ok(pageSource.includes('data-prep-type-radio'), '页面必须用 data-prep-type-radio 处理类型切换')
assert.ok(pageSource.includes('data-prep-type-block'), '页面必须用 data-prep-type-block 控制准备项 block')
assert.ok(pageSource.includes('confirmedProductPrepType'), '提交确认工作项时必须保存 confirmedProductPrepType')
assert.ok(pageSource.includes('selectedItemTypes'), '提交确认工作项时必须保存 selectedItemTypes')
assert.ok(pageSource.includes('overrideReason'), '提交确认工作项时必须保存 overrideReason')
assert.ok(pageSource.includes('样衣制作人：'), '工作项上传时必须把样衣制作人写入上传说明')
assert.ok(pageSource.includes('.disabled = !active'), '类型切换时必须禁用非当前类型 block 的 checkbox，避免提交隐藏项')
assert.ok(!pageSource.includes("fileName: '辅料下单时间'"), '辅料下单时间不得伪造成可下载上传文件')
assert.ok(pageSource.includes('data-prep-accessory-order-form'), '辅料下单必须使用独立采购单号登记表单')
assert.ok(pageSource.includes('accessoryPurchaseOrders'), '辅料下单必须写入 runtime 的面辅料采购单号记录')

for (const statusCode of ['PENDING', 'DONE', 'IN_PROGRESS', 'CANCELLED', 'ON_HOLD'] as const) {
  assert.ok(!ledgerHtml.includes(statusCode), `准备台账 HTML 不得包含英文状态码 ${statusCode}`)
  assert.ok(!statsHtml.includes(statusCode), `月度统计 HTML 不得包含英文状态码 ${statusCode}`)
}

console.log('production preparation timing checks passed')
