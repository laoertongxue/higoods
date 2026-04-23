#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { mockFactories } from '../src/data/fcs/factory-mock-data.ts'
import {
  approveFactoryWarehouseStocktakeDifferenceReview,
  buildDefaultFactoryInternalWarehouses,
  executeFactoryWarehouseAdjustmentOrder,
  getFactoryWarehouseCurrentQtyByStockItemId,
  listFactoryInternalWarehouses,
  listFactoryWarehouseAdjustmentOrders,
  listFactoryWarehouseStocktakeDifferenceReviews,
  listFactoryWarehouseStocktakeOrders,
  rejectFactoryWarehouseStocktakeDifferenceReview,
} from '../src/data/fcs/factory-internal-warehouse.ts'
import { getFactoryMobileWarehouseCards } from '../src/data/fcs/factory-mobile-warehouse.ts'
import {
  canCompletePdaHandoutHead,
  canCompletePdaPickupHead,
  getPdaHandoverHeadBusinessLabel,
  getPdaHandoverRecordsByHead,
  getPdaPickupRecordsByHead,
  listPdaHandoverHeads,
} from '../src/data/fcs/pda-handover-events.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const SEWING_FACTORY_TYPES = new Set(['CENTRAL_GARMENT', 'SATELLITE_SEWING', 'THIRD_SEWING'])

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotIncludes(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function joinText(parts: string[]): string {
  return parts.join('')
}

const oldPickupHead = joinText(['领料', '头'])
const oldHandoutHead = joinText(['交出', '头'])
const oldPickupHeadPhrase = joinText(['领料信息（', '领料', '头）'])
const legacyWarehouseA = joinText(['来', '料仓'])
const legacyWarehouseB = joinText(['半成品', '仓'])
const forbiddenWmsTerms = [
  joinText(['库存', '三态']),
  joinText(['可用', '库存']),
  joinText(['占用', '库存']),
  joinText(['在途', '库存']),
  joinText(['上架', '任务']),
  joinText(['拣货', '波次']),
  joinText(['拣货', '路径']),
  joinText(['完整', '库存账']),
  joinText(['WMS', '入库']),
  joinText(['完整', '入库']),
]
const forbiddenCapabilityTerms = [
  joinText(['axi', 'os']),
  joinText(['fet', 'ch(']),
  joinText(['api', 'Client']),
  joinText(['/', 'api', '/']),
  joinText(['i1', '8n']),
  joinText(['use', 'Translation']),
  joinText(['loc', 'ales']),
  joinText(['trans', 'lations']),
  joinText(['e', 'charts']),
  joinText(['chart', '.', 'js']),
  joinText(['re', 'charts']),
]

const pageSources = [
  'src/pages/pda-handover.ts',
  'src/pages/pda-handover-detail.ts',
  'src/pages/pda-exec-detail.ts',
  'src/pages/factory-internal-warehouse.ts',
  'src/pages/pda-warehouse.ts',
  'src/pages/pda-warehouse-stocktake.ts',
  'src/pages/pda-warehouse-inbound-records.ts',
  'src/pages/pda-warehouse-outbound-records.ts',
  'src/pages/progress-board/task-domain.ts',
  'src/pages/progress-exceptions/detail-domain.ts',
].map((file) => ({ file, source: read(file) }))

const dataSource = read('src/data/fcs/pda-handover-events.ts')
const warehouseSource = read('src/data/fcs/factory-internal-warehouse.ts')
const mobileWarehouseSource = read('src/data/fcs/factory-mobile-warehouse.ts')
const stocktakePageSource = read('src/pages/pda-warehouse-stocktake.ts')
const packageSource = read('package.json')

for (const { file, source } of pageSources) {
  assertNotIncludes(source, oldPickupHead, `${file} 仍显示旧领料口径`)
  assertNotIncludes(source, oldHandoutHead, `${file} 仍显示旧交出口径`)
  assertNotIncludes(source, oldPickupHeadPhrase, `${file} 仍显示旧领料标题`)
  assertNotIncludes(source, legacyWarehouseA, `${file} 仍显示旧仓库文案`)
  assertNotIncludes(source, legacyWarehouseB, `${file} 仍显示旧仓库文案`)
}

assertIncludes(packageSource, 'check:pickup-handout-order-and-warehouse-foundation', 'package.json 缺少 Step 3 检查命令')
assert.equal(getPdaHandoverHeadBusinessLabel('PICKUP'), '领料单', 'PICKUP head 必须展示为领料单')
assert.equal(getPdaHandoverHeadBusinessLabel('HANDOUT'), '交出单', 'HANDOUT head 必须展示为交出单')

assertIncludes(read('src/pages/pda-handover-detail.ts'), '完成领料单', '详情页缺少完成领料单按钮')
assertIncludes(read('src/pages/pda-handover-detail.ts'), '完成交出单', '详情页缺少完成交出单按钮')
assertIncludes(dataSource, 'basisQty * 0.8', '领料单 / 交出单完成未使用 80% 下限')
assertIncludes(dataSource, 'basisQty * 1.2', '领料单 / 交出单完成未使用 120% 上限')
assertNotIncludes(dataSource, '仍有待接收方回写记录', '交出单完成不应依赖全部回写')
assertNotIncludes(dataSource, '仍有未处理完成的数量异议', '交出单完成不应依赖异议关闭')
assertIncludes(dataSource, '领料单已完成，不允许新增领料记录', '完成领料单后缺少新增领料记录拦截')
assertIncludes(dataSource, '交出单已完成，不允许新增交出记录', '完成交出单后缺少新增交出记录拦截')
assertIncludes(dataSource, 'receiverClosedAt: head.receiverClosedAt', '交出单完成语义不能直接覆盖接收方闭合时间')

const pickupHeads = listPdaHandoverHeads().filter((head) => head.headType === 'PICKUP')
const handoutHeads = listPdaHandoverHeads().filter((head) => head.headType === 'HANDOUT')
assert(pickupHeads.length > 0, '缺少领料单样例')
assert(handoutHeads.length > 0, '缺少交出单样例')
assert(pickupHeads.some((head) => getPdaPickupRecordsByHead(head.handoverId).length > 0), '领料单必须有领料记录')
assert(handoutHeads.some((head) => getPdaHandoverRecordsByHead(head.handoverId).length > 0), '交出单必须有交出记录')
assert(canCompletePdaPickupHead(pickupHeads[0].handoverId).message.includes('领料单'), '领料单完成校验必须返回业务文案')
assert(canCompletePdaHandoutHead(handoutHeads[0].handoverId).message.includes('交出单'), '交出单完成校验必须返回业务文案')

assertNotIncludes(read('src/pages/pda-handover-detail.ts'), '目标工厂', '领料记录详情不应展示目标工厂字段')
assertNotIncludes(read('src/pages/pda-handover.ts'), '目标工厂', '领料记录卡片不应展示目标工厂字段')

;['A区', 'B区', 'C区', 'D区', 'E区', 'F区', '异常区', '待确认区'].forEach((areaName) => {
  assertIncludes(warehouseSource, areaName, `默认库区缺少 ${areaName}`)
})
const defaultWarehouses = buildDefaultFactoryInternalWarehouses(mockFactories)
const nonSewingFactories = mockFactories.filter((factory) => !SEWING_FACTORY_TYPES.has(factory.factoryType))
const sewingFactories = mockFactories.filter((factory) => SEWING_FACTORY_TYPES.has(factory.factoryType))
nonSewingFactories.forEach((factory) => {
  const rows = defaultWarehouses.filter((warehouse) => warehouse.factoryId === factory.id)
  assert(rows.length >= 2, `${factory.name} 缺少默认待加工仓或待交出仓`)
  rows.forEach((warehouse) => assert(warehouse.areaList.length >= 8, `${warehouse.warehouseName} 默认库区不足 8 个`))
})
sewingFactories.forEach((factory) => {
  assert(!defaultWarehouses.some((warehouse) => warehouse.factoryId === factory.id), `${factory.name} 不应生成工厂内部仓`)
  assert(!listFactoryInternalWarehouses().some((warehouse) => warehouse.factoryId === factory.id), `${factory.name} 不应存在工厂内部仓种子数据`)
})

assertIncludes(warehouseSource, 'FactoryWarehouseStocktakeDifferenceReview', '缺少盘点差异审核模型')
assertIncludes(warehouseSource, 'FactoryWarehouseAdjustmentOrder', '缺少调整单模型')
assertIncludes(warehouseSource, 'approveFactoryWarehouseStocktakeDifferenceReview', '缺少审核通过 helper')
assertIncludes(warehouseSource, 'rejectFactoryWarehouseStocktakeDifferenceReview', '缺少审核驳回 helper')
assertIncludes(warehouseSource, 'executeFactoryWarehouseAdjustmentOrder', '缺少执行调整单 helper')
assertIncludes(stocktakePageSource, '盘点差异需提交审核', '移动端盘点页缺少新口径')
assertNotIncludes(stocktakePageSource, joinText(['只记录差异，', '不生成完整库存调整单']), '移动端盘点页仍保留旧口径')
assert(!stocktakePageSource.includes('approveFactoryWarehouseStocktakeDifferenceReview'), '移动端盘点页不应做审核')
assert(!stocktakePageSource.includes('executeFactoryWarehouseAdjustmentOrder'), '移动端盘点页不应做调整')

const review = listFactoryWarehouseStocktakeDifferenceReviews().find((item) => item.reviewStatus === '待审核')
assert(review, '缺少待审核盘点差异样例')
const adjustment = approveFactoryWarehouseStocktakeDifferenceReview({
  reviewId: review!.reviewId,
  reviewedBy: '检查脚本',
  reviewRemark: '检查审核闭环',
})
assert(adjustment, '审核通过后必须生成调整单')
assert(listFactoryWarehouseAdjustmentOrders().some((item) => item.adjustmentOrderId === adjustment!.adjustmentOrderId), '调整单未进入列表')
const executed = executeFactoryWarehouseAdjustmentOrder({
  adjustmentOrderId: adjustment!.adjustmentOrderId,
  executedBy: '检查脚本',
  remark: '检查执行闭环',
})
assert(executed?.status === '已完成', '执行调整单后状态必须为已完成')
assert.equal(getFactoryWarehouseCurrentQtyByStockItemId(review!.stockItemId), review!.countedQty, '执行调整单后应更新轻量库存数量')
const rejectedReview = listFactoryWarehouseStocktakeDifferenceReviews().find((item) => item.reviewStatus === '待审核')
if (rejectedReview) {
  const rejected = rejectFactoryWarehouseStocktakeDifferenceReview({
    reviewId: rejectedReview.reviewId,
    reviewedBy: '检查脚本',
    reviewRemark: '检查驳回闭环',
  })
  assert(rejected?.reviewStatus === '已驳回', '审核驳回后状态必须为已驳回')
}

const factoryForCards = nonSewingFactories[0]
assert(factoryForCards, '缺少非车缝工厂样例')
const cards = getFactoryMobileWarehouseCards(factoryForCards.id, factoryForCards.name)
assert.deepEqual(
  cards.map((card) => card.cardId),
  ['wait-process', 'wait-handover', 'inbound-records', 'outbound-records', 'stocktake', 'difference'],
  '仓管首页 6 张卡顺序必须保持不变',
)
assertIncludes(mobileWarehouseSource, 'stocktakeWaitReviewCount', '仓管轻量统计缺少待审核差异')
assertIncludes(mobileWarehouseSource, 'stocktakeAdjustedCount', '仓管轻量统计缺少已调整数量')

for (const source of [warehouseSource, dataSource, mobileWarehouseSource, ...pageSources.map((item) => item.source)]) {
  forbiddenWmsTerms.forEach((term) => assertNotIncludes(source, term, `不应出现 WMS 越界文案：${term}`))
  forbiddenCapabilityTerms.forEach((term) => assertNotIncludes(source, term, `不应新增越界能力：${term}`))
}

const stocktakeOrders = listFactoryWarehouseStocktakeOrders()
assert(stocktakeOrders.length > 0, '缺少盘点单样例')

console.log('check:pickup-handout-order-and-warehouse-foundation passed')
