#!/usr/bin/env tsx

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import {
  EMPTY_PREPARATION_RUNTIME_STATE,
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

const menuSource = source('src/data/app-shell-config.ts')
const productionMenuStart = menuSource.indexOf("key: 'fcs-platform-production'")
assert.ok(productionMenuStart >= 0, '菜单缺少生产单管理分组')
const productionMenuEnd = menuSource.indexOf("key: 'fcs-platform-process'", productionMenuStart)
assert.ok(productionMenuEnd >= 0, '菜单缺少工艺平台分组')
const productionMenu = menuSource.slice(productionMenuStart, productionMenuEnd)
assert.ok(productionMenu.includes('production-preparation-timing'), '生产单管理菜单缺少生产准备时效')
assert.ok(productionMenu.includes('/fcs/production/preparation-timing'), '生产准备时效 href 不正确')
const planIndex = productionMenu.indexOf('production-plan')
const timingIndex = productionMenu.indexOf('production-preparation-timing')
const warehouseIndex = productionMenu.indexOf('production-delivery-warehouse')
assert.ok(planIndex >= 0, '生产单管理菜单缺少生产单计划')
assert.ok(timingIndex >= 0, '生产单管理菜单缺少生产准备时效')
assert.ok(warehouseIndex >= 0, '生产单管理菜单缺少交付仓配置')
assert.ok(
  planIndex < timingIndex && timingIndex < warehouseIndex,
  '生产准备时效必须位于生产单计划之后、交付仓配置之前',
)

assertIncludes('src/router/routes-fcs.ts', '/fcs/production/preparation-timing', 'routes-fcs.ts 缺少生产准备时效路由')
assertIncludes('src/router/routes-fcs.ts', 'renderProductionPreparationTimingPage', 'routes-fcs.ts 缺少生产准备时效 renderer')
assertIncludes(
  'src/router/route-renderers-fcs.ts',
  'renderProductionPreparationTimingPage',
  'route-renderers-fcs.ts 缺少生产准备时效 renderer',
)
assertIncludes(
  'src/router/route-renderers.ts',
  'renderProductionPreparationTimingPage',
  'route-renderers.ts 缺少生产准备时效 renderer',
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
  buildMonthlyPreparationCompletionDetails,
  buildMonthlyPreparationStats,
  filterProductionPreparationRecords,
  flattenProductionPreparationItems,
  productionPreparationRecords,
} = await import('../src/data/fcs/production-preparation-timing.ts')

type EvidenceItem = {
  itemType: string
  status: string
  selectedByMerchandiser?: boolean
  actualFinishAt?: string
  uploads?: Array<{ fileName?: string; uploadedAt?: string; uploadedBy?: string; fileDataUrl?: string }>
}

function selectedEvidenceItems(record: { items: EvidenceItem[] }): EvidenceItem[] {
  return record.items.filter((item) => item.selectedByMerchandiser !== false && item.status !== '无需')
}

function hasUploadEvidence(item: EvidenceItem): boolean {
  return Boolean(
    item.actualFinishAt &&
      item.uploads?.some((upload) => upload.fileName && upload.uploadedAt && upload.uploadedBy),
  )
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
  items: EvidenceItem[]
}>) {
  for (const item of selectedEvidenceItems(record).filter((current) => current.status === '已完成')) {
    assert.ok(
      hasUploadEvidence(item),
      `${record.recordNo} ${item.itemType} 已完成时必须有上传记录、上传人、上传时间和实际完成时间`,
    )
  }
  assert.ok(
    record.imageUrl && existsSync(`public${record.imageUrl}`),
    `${record.recordNo} 商品图片不存在或缺少 imageUrl：${record.imageUrl ?? ''}`,
  )
  if (!record.workItemsConfirmedBy && !record.workItemsConfirmedAt) {
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
      !record.workItemsConfirmedBy && !record.workItemsConfirmedAt,
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
assertRecordHasItems(knitRecord, ['毛织基码纸样', '版衣制作', '毛织齐码纸样', '辅料下单', '染色调色（面料）'])
assertRecordHasItems(mixedRecord, [
  '毛织基码纸样',
  '梭织基码纸样',
  '版衣制作',
  '毛织齐码纸样',
  '梭织齐码纸样',
  '辅料下单',
  '染色调色（纱线）',
  '染色调色（面料）',
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
const printOnlyRecord = productionPreparationRecords.find(
  (record: { recordId?: string }) => record.recordId === 'prep-202603-003',
) as { outputs?: Array<{ outputType: string }> } | undefined
assert.ok(printOnlyRecord, '缺少 prep-202603-003 烫画&直喷记录')
assert.ok(
  !printOnlyRecord.outputs?.some((output) => output.outputType === '染色单' || output.outputType === '辅料采购单'),
  '烫画&直喷单花型记录不应生成染色单或辅料采购单',
)

const pageModule = await import('../src/pages/production/preparation-timing.ts')
const renderProductionPreparationTimingPage = pageModule.renderProductionPreparationTimingPage as
  | ((path?: string) => string | Promise<string>)
  | undefined
assert.equal(typeof renderProductionPreparationTimingPage, 'function', '页面必须导出 renderProductionPreparationTimingPage')

const { appStore } = await import('../src/state/store.ts')
async function renderAt(path: string): Promise<string> {
  appStore.navigate(path, { historyMode: 'replace' })
  const html = await renderProductionPreparationTimingPage(path)
  assert.equal(typeof html, 'string', 'renderProductionPreparationTimingPage 必须返回 HTML 字符串')
  return html
}

const ledgerHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&patternDesigner=林小美')
for (const text of [
  '生产准备时效',
  '准备台账',
  '月度统计',
  '花型师',
] as const) {
  assertHtmlIncludes(ledgerHtml, text, `准备台账 HTML 缺少「${text}」`)
}
for (const text of [
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
  '做大货阈值：300',
  '达到做大货要求',
  '商品类型',
  '系统推导',
  '跟单确认',
  '准备项确认',
  '预计产出',
] as const) {
  assertHtmlIncludes(adjustedLedgerHtml, text, `调整后准备台账 HTML 缺少「${text}」`)
}
for (const text of ['产出', '正式版本技术包', '生产需求单', '印花需求单', '染色需求单', '辅料采购单'] as const) {
  assertHtmlIncludes(adjustedLedgerHtml, text, `调整后准备台账 HTML 缺少「${text}」`)
}
for (const text of ['产出状态', '操作当前卡点', '准备项确认：'] as const) {
  assert.ok(!adjustedLedgerHtml.includes(text), `调整后准备台账 HTML 不应显示「${text}」`)
}

const readyOutputHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-003')
assertHtmlIncludes(readyOutputHtml, '正式产出', '全部完成记录必须展示正式产出')
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
if (generatedOutputTypes.size > 0) {
  for (const outputType of expectedOutputTypes) {
    assert.ok(generatedOutputTypes.has(outputType), `已生成产出对象缺少「${outputType}」`)
  }
}

const pendingOutputHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-001')
const pendingOutputDrawerHtml = detailDrawerHtml(pendingOutputHtml, 'PREP-202603-001')
assertHtmlIncludes(pendingOutputDrawerHtml, '预计产出', '未全部完成记录必须只展示预计产出')
assert.ok(!pendingOutputDrawerHtml.includes('正式产出'), '未全部完成记录不应展示正式产出')
assertHtmlIncludes(pendingOutputHtml, '待跟单确认后开放操作', '未确认工作项的记录必须提示先确认工作项')
const unconfirmedOperateHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-001&itemId=prep-202603-001-item-03&action=operate-item',
)
assert.ok(!unconfirmedOperateHtml.includes('data-prep-operate-item-form'), '未确认工作项前不应允许 URL 直达工作项操作弹窗')

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
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD&amp;patternDesigner=Diah&amp;recordId=prep-202604-003&amp;action=confirm-items"',
  '筛选列表行的确认工作项入口必须继承当前筛选条件',
)
assertHtmlIncludes(
  filteredRowActionHtml,
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD&amp;patternDesigner=Diah&amp;recordId=prep-202604-003&amp;itemId=prep-202604-003-item-01&amp;action=operate-item"',
  '筛选列表行的操作当前卡点入口必须继承当前筛选条件',
)
assertHtmlIncludes(
  filteredRowActionHtml,
  '确认工作项',
  '准备台账必须展示确认工作项入口',
)
assertHtmlIncludes(filteredRowActionHtml, '操作当前卡点', '准备台账必须展示操作当前卡点入口')
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
const operateItemHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordStatus=进行中&patternDesigner=Diah&recordId=prep-202604-003&itemId=prep-202604-003-item-01&action=operate-item',
)
assertHtmlIncludes(operateItemHtml, 'data-prep-operate-item-form', '工作项操作弹窗必须输出表单标记')
assertHtmlIncludes(operateItemHtml, '<input type="hidden" name="itemId" value="prep-202604-003-item-01" />', '工作项操作表单必须带 itemId')
assertHtmlIncludes(operateItemHtml, '上传文件', '非辅料工作项操作弹窗必须要求上传文件')
assertHtmlIncludes(operateItemHtml, '上传记录', '工作项操作弹窗必须展示上传历史')
const accessoryOperateHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-002&itemId=prep-202603-002-item-06&action=operate-item',
)
assertHtmlIncludes(accessoryOperateHtml, 'name="orderedAt"', '辅料下单操作弹窗必须填写下单时间')
assertHtmlIncludes(accessoryOperateHtml, '下单凭证', '辅料下单操作弹窗必须展示下单凭证文案')
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

const statsHtml = await renderAt('/fcs/production/preparation-timing?tab=stats&month=2026-03')
appStore.navigate('/fcs/production/preparation-timing?tab=stats&month=2026-03', { historyMode: 'replace' })
const routedStatsHtml = await renderProductionPreparationTimingPage()
assert.equal(typeof routedStatsHtml, 'string', '无参数渲染必须返回 HTML 字符串')
assertHtmlIncludes(routedStatsHtml, '导出月度统计', '无参数渲染必须读取当前路由并显示月度统计')
for (const text of [
  '导出月度统计',
  '导出完成明细',
  '完成基码',
  '完成齐码',
  '完成花型',
  '完成染色',
  '完成数量',
  '按时完成数量',
  '超时完成数量',
  '平均耗时小时',
  '生产准备时效月度统计-202603.csv',
  '生产准备时效完成明细-202603.csv',
  'data:text/csv;charset=utf-8',
  '商品类型',
  '必做/选填',
  '非烫画&amp;非毛织（纯梭织）',
] as const) {
  assertHtmlIncludes(statsHtml, text, `月度统计 HTML 缺少「${text}」`)
}
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
assertHtmlIncludes(statsHtml, encodeURIComponent(detailCsvHeader), '完成明细 CSV 缺少商品类型和必做/选填字段')
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
  statsHtml,
  encodeURIComponent('非烫画&非毛织（纯梭织）'),
  '完成明细 CSV 缺少商品类型数据',
)

const pageSource = source('src/pages/production/preparation-timing.ts')
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

for (const statusCode of ['PENDING', 'DONE', 'IN_PROGRESS', 'CANCELLED', 'ON_HOLD'] as const) {
  assert.ok(!ledgerHtml.includes(statusCode), `准备台账 HTML 不得包含英文状态码 ${statusCode}`)
  assert.ok(!statsHtml.includes(statusCode), `月度统计 HTML 不得包含英文状态码 ${statusCode}`)
}

console.log('production preparation timing checks passed')
