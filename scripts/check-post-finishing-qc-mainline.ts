#!/usr/bin/env tsx

import assert from 'node:assert/strict'
import { loadPostFinishingDemoData, listPostFinishingFullFlowQcTasks } from '../src/data/fcs/post-finishing-full-flow.ts'
import { listPostFinishingQcOrderEntities, listPostFinishingTasks } from '../src/data/fcs/post-finishing-current-read-model.ts'
import { getProductionObjectOverview, getProductionObjectSearchIndex, resolveProductionObjectRequest } from '../src/data/fcs/production-object-overview.ts'
import { renderOverviewHeader, renderOverviewSummaryTab } from '../src/components/production-object-overview.ts'
import { renderPostFinishingQcOrdersPage } from '../src/pages/process-factory/post-finishing/qc-orders.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { productionDemands } from '../src/data/fcs/production-demands.ts'
import { POST_FINISHING_PRODUCTION_SOURCE_FIXTURES } from '../src/data/fcs/post-finishing-production-source-fixtures.ts'
import { validateDemandTechPackOrderLink } from '../src/data/fcs/production-upstream-chain.ts'
import { findStyleArchiveByCode } from '../src/data/pcs-style-archive-repository.ts'
import { findSkuArchiveByCode } from '../src/data/pcs-sku-archive-repository.ts'
import { listProductionDemandTechPackSeeds } from '../src/data/pcs-production-demand-tech-pack-seeds.ts'
import { listRuntimeProcessTasks } from '../src/data/fcs/runtime-process-tasks.ts'

// 先建立空索引，覆盖后道 Mock 在用户进入页面后才加载的情况。
getProductionObjectSearchIndex()
loadPostFinishingDemoData()
const tasks = listPostFinishingFullFlowQcTasks()
const qcEntities = listPostFinishingQcOrderEntities()
const sources = listPostFinishingTasks()
assert(tasks.length > 0, '后道 QC Mock 必须有质检样本')
assert.equal(qcEntities.length, tasks.length)

for (const fixture of POST_FINISHING_PRODUCTION_SOURCE_FIXTURES) {
  assert.equal(resolveProductionObjectRequest({ objectType: 'PROCESS_DOC', objectId: fixture.sewingTaskNo }).status, 'READY', '来源任务编号点击必须能解析生产主线')
  assert.equal(getProductionObjectOverview('PROCESS_DOC', fixture.sewingTaskNo)?.summary.productionOrderNo, fixture.no)
  assert.equal(getProductionObjectOverview('PROCESS_DOC', `PROCESS_DOC-${fixture.sewingTaskNo}`)?.summary.demandNo, fixture.demandId)
  const order = productionOrders.find((item) => item.productionOrderId === fixture.productionOrderId)
  const demand = productionDemands.find((item) => item.demandId === fixture.demandId)
  assert(order && demand, `${fixture.no} 缺少生产单或生产需求`)
  assert.equal(order.productionOrderNo, fixture.no)
  assert.equal(order.demandId, demand.demandId)
  assert.equal(demand.productionOrderId, order.productionOrderId)
  assert.equal(order.mainFactoryId, fixture.factoryId)
  assert.equal(order.mainFactorySnapshot.name, fixture.factoryName)
  const expectedSkus = fixture.skus.map((sku) => ({ skuCode: sku.skuCode, size: sku.sizeName, color: sku.colorName, qty: sku.plannedQty }))
  assert.deepEqual(order.demandSnapshot.skuLines, expectedSkus)
  assert.deepEqual(demand.skuLines, expectedSkus)
  assert.equal(demand.requiredQtyTotal, 500)
  assert(validateDemandTechPackOrderLink({ productionOrderId: order.productionOrderId, demandId: demand.demandId }).ok, 'Mock 生产单也必须经过标准上游校验')
  assert.equal(order.techPackSnapshot?.versionLabel, 'Mock V1.0')
  assert.equal(order.techPackSnapshot?.productionOrderNo, fixture.no)
  assert.equal(findStyleArchiveByCode(fixture.spuCode)?.styleName, fixture.styleName)
  for (const sku of fixture.skus) {
    const archive = findSkuArchiveByCode(sku.skuCode)
    assert.equal(archive?.styleCode, fixture.spuCode)
    assert.equal(archive?.colorName, sku.colorName)
    assert.equal(archive?.sizeName, sku.sizeName)
  }
  const demandOverview = getProductionObjectOverview('DEMAND', demand.demandId)
  assert.equal(demandOverview?.summary.productionOrderNo, fixture.no)
}

const nonQcSeeds = listProductionDemandTechPackSeeds().filter((item) => !POST_FINISHING_PRODUCTION_SOURCE_FIXTURES.some((source) => source.spuCode === item.demand.spuCode))
nonQcSeeds.forEach((seed, index) => assert.equal(seed.seedIndex, index, `${seed.demand.spuCode} 的原有 Mock 工艺/物料分配序号不应改变`))
const mainlineTasks = listRuntimeProcessTasks().filter((task) => POST_FINISHING_PRODUCTION_SOURCE_FIXTURES.some((source) => source.productionOrderId === task.productionOrderId))
assert(mainlineTasks.length > 0)
assert(mainlineTasks.every((task) => !task.sourceEntryId?.startsWith('DICT-MOCK-')), '后道来源不得被通用字典样本轮换附加无关工艺')

for (const task of tasks) {
  const qc = qcEntities.find((item) => item.qcOrderNo === task.qcTaskNo)
  const source = sources.find((item) => item.productionOrderId === task.productionOrderId && item.productionOrderNo === task.productionOrderNo)
  assert(qc && source, `${task.qcTaskNo} 缺少同 ID 的生产来源及 QC 当前事实`)
  assert.equal(qc.sourceTaskNo, source.sourceTaskNos.find((no) => no === qc.sourceTaskNo), `${task.qcTaskNo} 来源任务不一致`)
  const overview = getProductionObjectOverview('QC_ORDER', task.qcTaskNo)
  assert(overview, `${task.qcTaskNo} 总览为空`)
  assert(getProductionObjectOverview('QC_ORDER', `QC_ORDER-${task.qcTaskNo}`), `${task.qcTaskNo} 索引 ID 不能打开总览`)
  assert.equal(overview.summary.productionOrderNo, source.productionOrderNo)
  const order = productionOrders.find((item) => item.productionOrderId === task.productionOrderId)!
  assert.equal(overview.summary.demandNo, order.demandId)
  assert(overview.sourceSnapshots.some((item) => item.sourceText.includes(qc.sourceTaskNo)), `${task.qcTaskNo} 缺少来源任务凭据`)
  assert.equal(resolveProductionObjectRequest({ objectType: 'QC_ORDER', objectId: task.qcTaskNo, relatedProductionOrderNo: source.productionOrderNo }).status, 'READY')
  assert(getProductionObjectOverview('PRODUCTION_ORDER', source.productionOrderNo), `${source.productionOrderNo} 不能打开来源总览`)
  const orderIndex = getProductionObjectSearchIndex().find((item) => item.objectType === 'PRODUCTION_ORDER' && item.primaryNo === source.productionOrderNo)!
  assert(getProductionObjectOverview('PRODUCTION_ORDER', orderIndex.id), `${source.productionOrderNo} 索引 ID 不能打开来源总览`)
}

const first = tasks.find((item) => item.claimedBy?.actorId === 'PF-USER-QC-A')!
const firstOverview = getProductionObjectOverview('PRODUCTION_ORDER', first.productionOrderNo)!
const summaryHtml = renderOverviewSummaryTab(firstOverview)
assert(summaryHtml.includes('后道 Mock 来源流程'))
assert(summaryHtml.includes('生产需求、生产单、后道来源任务与质检事实已按同一组 SKU 和数量关联'))
assert(summaryHtml.includes('DEM-QC-202608-001'))
assert(!summaryHtml.includes('需求接收</div>'), 'Mock 来源不能显示需求接收已完成')
assert(!summaryHtml.includes('生产单生成</div>'), 'Mock 来源不能显示正式生产单已生成')
assert(renderOverviewHeader(firstOverview).includes('后道验收 Mock 生产来源'))
assert(getProductionObjectSearchIndex().some((item) => item.objectType === 'PRODUCTION_ORDER' && item.primaryNo === first.productionOrderNo))
const html = renderPostFinishingQcOrdersPage()
assert(html.includes(`data-object-id="${first.qcTaskNo}"`), 'QC 列表应提供质检总览入口')
assert(html.includes(`data-object-id="${first.productionOrderNo}"`), 'QC 列表应提供生产来源入口')
assert(html.includes('后道验收 Mock 来源；生产主线已关联'), '验收来源应明确标记 Mock')
console.log(`PASS 后道 QC ${tasks.length} 条 Mock 质检单回溯 3 组生产单/需求/演示技术包、15 个 SKU、主工厂与来源任务；既有样本分配序号保持稳定`)
