#!/usr/bin/env tsx

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

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

function markedSectionHtml(html: string, marker: string): string {
  const start = html.indexOf(marker)
  assert.ok(start >= 0, `HTML 缺少 ${marker}`)
  const end = html.indexOf('</section>', start)
  assert.ok(end > start, `${marker} section 未闭合`)
  return html.slice(start, end)
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

const {
  buildMonthlyPreparationCompletionDetails,
  buildMonthlyPreparationStats,
  filterProductionPreparationRecords,
  flattenProductionPreparationItems,
  productionPreparationRecords,
} = await import('../src/data/fcs/production-preparation-timing.ts')

assert.ok(Array.isArray(productionPreparationRecords), 'productionPreparationRecords 必须是数组')
assert.ok(productionPreparationRecords.length >= 12, 'productionPreparationRecords 不少于 12 条')

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

const readyOutputHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-003')
assertHtmlIncludes(readyOutputHtml, '正式产出', '全部完成记录必须展示正式产出')
assertHtmlIncludes(readyOutputHtml, '已生成', '全部完成记录的产出状态必须为已生成')

const pendingOutputHtml = await renderAt('/fcs/production/preparation-timing?tab=ledger&month=2026-03&recordId=prep-202603-001')
const pendingOutputDrawerHtml = detailDrawerHtml(pendingOutputHtml, 'PREP-202603-001')
assertHtmlIncludes(pendingOutputDrawerHtml, '预计产出', '未全部完成记录必须只展示预计产出')
assert.ok(!pendingOutputDrawerHtml.includes('正式产出'), '未全部完成记录不应展示正式产出')
const dynamicReadyOutputHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordId=prep-202604-003&itemId=prep-202604-003-item-01&action=upload&mockCompletionUploaded=1&buyerReviewStatus=已通过',
)
const dynamicReadyOutputDrawerHtml = detailDrawerHtml(dynamicReadyOutputHtml, 'PREP-202604-003')
assertHtmlIncludes(dynamicReadyOutputDrawerHtml, '正式产出', '动态完成最后一项后必须展示正式产出')
assertHtmlIncludes(dynamicReadyOutputDrawerHtml, '已生成', '动态完成最后一项后产出状态必须为已生成')
assert.ok(!dynamicReadyOutputDrawerHtml.includes('预计产出'), '动态完成最后一项后不应继续显示预计产出')
assert.ok(!dynamicReadyOutputDrawerHtml.includes('预计TP-PO-202604-003'), '动态完成最后一项后不应保留预计技术包编号')
assert.ok(!dynamicReadyOutputDrawerHtml.includes('预计PR-003'), '动态完成最后一项后不应保留预计印花单编号')

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

const assignedLedgerHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordId=prep-202604-003&itemId=prep-202604-003-item-01&action=assign&mockAssignedDesigner=林小美',
)
assertHtmlIncludes(assignedLedgerHtml, '花型师：</span>林小美', '花型师模拟分配后，准备项卡片必须显示新花型师')
const assignedDesignerHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&patternDesigner=林小美&recordId=prep-202604-003&itemId=prep-202604-003-item-01&mockAssignedDesigner=林小美',
)
assertHtmlIncludes(
  assignedDesignerHtml,
  'PREP-202604-003',
  '花型师模拟分配后，按该花型师筛选必须能命中对应任务',
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
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD&amp;patternDesigner=Diah&amp;recordId=prep-202604-003&amp;itemId=prep-202604-003-item-01#prep-items"',
  '筛选列表行的更新准备项入口必须继承当前筛选条件',
)
assertHtmlIncludes(
  filteredRowActionHtml,
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD&amp;patternDesigner=Diah&amp;recordId=prep-202604-003&amp;itemId=prep-202604-003-item-01&amp;action=assign"',
  '筛选列表行的分配花型师入口必须继承当前筛选条件',
)
assertHtmlIncludes(
  filteredRowActionHtml,
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD&amp;patternDesigner=Diah&amp;recordId=prep-202604-003&amp;itemId=prep-202604-003-item-01&amp;action=upload"',
  '筛选列表行的上传完成图片入口必须继承当前筛选条件',
)
const filteredDetailActionHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordStatus=进行中&patternDesigner=Diah&recordId=prep-202604-003',
)
assertHtmlIncludes(
  filteredDetailActionHtml,
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD&amp;patternDesigner=Diah&amp;recordId=prep-202604-003&amp;itemId=prep-202604-003-item-01&amp;action=assign"',
  '详情抽屉内花型卡片的分配花型师入口必须继承当前筛选条件',
)
assertHtmlIncludes(
  filteredDetailActionHtml,
  'data-nav="/fcs/production/preparation-timing?tab=ledger&amp;month=2026-04&amp;recordStatus=%E8%BF%9B%E8%A1%8C%E4%B8%AD&amp;patternDesigner=Diah&amp;recordId=prep-202604-003&amp;itemId=prep-202604-003-item-01&amp;action=upload"',
  '详情抽屉内花型卡片的上传完成图片入口必须继承当前筛选条件',
)
const filteredAssignScope = markedSectionHtml(
  await renderAt(
    '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordStatus=进行中&patternDesigner=Diah&recordId=prep-202604-003&itemId=prep-202604-003-item-01&action=assign',
  ),
  'data-pattern-assign-scope',
)
assertHtmlIncludes(
  filteredAssignScope,
  '<input type="hidden" name="recordStatus" value="进行中" />',
  '确认分配提交 scope 必须保留记录状态筛选',
)
assertHtmlIncludes(
  filteredAssignScope,
  '<input type="hidden" name="patternDesigner" value="Diah" />',
  '确认分配提交 scope 必须保留花型师筛选',
)
const filteredUploadScope = markedSectionHtml(
  await renderAt(
    '/fcs/production/preparation-timing?tab=ledger&month=2026-04&recordStatus=进行中&patternDesigner=Diah&recordId=prep-202604-003&itemId=prep-202604-003-item-01&action=upload',
  ),
  'data-pattern-upload-scope',
)
assertHtmlIncludes(
  filteredUploadScope,
  '<input type="hidden" name="recordStatus" value="进行中" />',
  '提交完成资料 scope 必须保留记录状态筛选',
)
assertHtmlIncludes(
  filteredUploadScope,
  '<input type="hidden" name="patternDesigner" value="Diah" />',
  '提交完成资料 scope 必须保留花型师筛选',
)
const uploadLedgerHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&recordId=prep-202603-001&itemId=prep-202603-001-item-05&action=upload&mockCompletionUploaded=1&buyerReviewStatus=待确认',
)
assertHtmlIncludes(uploadLedgerHtml, '已模拟提交完成资料', '上传完成图片提交后必须有页面反馈')
assertHtmlIncludes(uploadLedgerHtml, '完成图：</span>2 张', '上传完成图片提交后必须更新完成图数量展示')
assertHtmlIncludes(uploadLedgerHtml, '买手确认：</span>待确认', '上传完成图片提交后必须更新买手确认状态展示')
const uploadPanelHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&recordId=prep-202604-003&itemId=prep-202604-003-item-01&action=upload',
)
const uploadPanelScope = markedSectionHtml(uploadPanelHtml, 'data-pattern-upload-scope')
assertHtmlIncludes(
  uploadPanelScope,
  '<option value="待确认" selected>待确认</option>',
  '上传完成图片面板默认提交状态必须是待确认',
)
assertHtmlIncludes(uploadPanelScope, '>待确认</span>', '上传完成图片面板状态标识默认必须是待确认')
assert.ok(!uploadPanelScope.includes('<option value="未提交"'), '上传完成图片提交选择框不应允许未提交')
assert.ok(!uploadPanelScope.includes('>未提交</span>'), '上传完成图片面板状态标识不应显示未提交')
assert.ok(
  !uploadPanelHtml.includes('买手确认：</span>未提交'),
  '打开上传完成图片流程时，同一抽屉内花型卡片不应继续显示买手确认未提交',
)
const staleUploadStatusHtml = await renderAt(
  '/fcs/production/preparation-timing?tab=ledger&recordId=prep-202604-003&itemId=prep-202604-003-item-01&action=upload&mockCompletionUploaded=1&buyerReviewStatus=未提交',
)
assertHtmlIncludes(
  staleUploadStatusHtml,
  '买手确认：</span>待确认',
  '上传完成图片提交后即使旧参数传入未提交，也必须归一为待确认',
)
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
assertIncludes(
  'src/pages/production/preparation-timing.ts',
  "selectedByMerchandiser: true",
  '上传完成图片 mock 必须保留已选择状态',
)

for (const statusCode of ['PENDING', 'DONE', 'IN_PROGRESS', 'CANCELLED', 'ON_HOLD'] as const) {
  assert.ok(!ledgerHtml.includes(statusCode), `准备台账 HTML 不得包含英文状态码 ${statusCode}`)
  assert.ok(!statsHtml.includes(statusCode), `月度统计 HTML 不得包含英文状态码 ${statusCode}`)
}

console.log('production preparation timing checks passed')
