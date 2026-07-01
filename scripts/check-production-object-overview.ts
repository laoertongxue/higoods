#!/usr/bin/env tsx

import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'

const requiredFiles = [
  'src/data/fcs/production-object-overview.ts',
  'src/components/production-object-overview.ts',
  'src/components/shell.ts',
  'src/main.ts',
  'src/main-handlers/fcs-handlers.ts',
  'src/styles.css',
  'src/pages/production/orders-domain.ts',
  'src/pages/production/demand-domain.ts',
  'src/pages/production-order-progress-tracking.ts',
  'src/pages/progress-material.ts',
  'src/pages/fcs/material-prep/list.ts',
  'src/pages/fcs/material-prep/dyeing.ts',
  'src/pages/fcs/material-prep/printing.ts',
  'src/pages/fcs/material-prep/cutting.ts',
  'src/pages/fcs/material-prep/sewing.ts',
  'src/pages/fcs/material-prep/other.ts',
  'src/pages/process-factory/cutting/cut-orders.ts',
  'src/pages/process-factory/cutting/fei-tickets.ts',
  'src/pages/process-factory/printing/work-orders.ts',
  'src/pages/process-factory/dyeing/work-orders.ts',
]

function source(path: string): string {
  assert.ok(existsSync(path), `${path} 不存在`)
  return readFileSync(path, 'utf8')
}

function assertIncludes(path: string, text: string, message: string): void {
  assert.ok(source(path).includes(text), message)
}

for (const file of requiredFiles) {
  assert.ok(existsSync(file), `${file} 不存在`)
}

const dataModule = await import('../src/data/fcs/production-object-overview.ts')
const uiModule = await import('../src/components/production-object-overview.ts')
const identityModule = await import('../src/data/fcs/production-order-identity.ts')
const { productionOrders } = await import('../src/data/fcs/production-orders.ts')
const { productionDemands } = await import('../src/data/fcs/production-demands.ts')
const { listMaterialPrepOrderProjections } = await import('../src/data/fcs/cutting/production-material-prep.ts')
const { listPrintWorkOrders } = await import('../src/data/fcs/printing-task-domain.ts')
const { listDyeWorkOrders } = await import('../src/data/fcs/dyeing-task-domain.ts')

const {
  getMaterialResourceOverview,
  getProductionObjectOverview,
  queryProductionObjectIssues,
  searchMaterialResources,
  searchProductionObjects,
  productionObjectSearchIndex,
} = dataModule

function countMatches(sourceText: string, pattern: string): number {
  return sourceText.split(pattern).length - 1
}

function hasSearchGroup(panel: string, group: string): boolean {
  return panel.includes(`<h3 class="text-sm font-semibold">${group}</h3>`)
}

function getSearchGroupHtml(panel: string, group: string): string {
  const heading = `<h3 class="text-sm font-semibold">${group}</h3>`
  const headingIndex = panel.indexOf(heading)
  if (headingIndex === -1) return ''
  const start = panel.lastIndexOf('<section class="space-y-2">', headingIndex)
  const next = panel.indexOf('<section class="space-y-2">', headingIndex + heading.length)
  return panel.slice(start, next === -1 ? panel.length : next)
}

function getSearchGroupObjectKeys(panel: string, group: string): string[] {
  return Array.from(getSearchGroupHtml(panel, group).matchAll(/data-object-type="([^"]+)" data-object-id="([^"]+)"/g))
    .map((match) => `${match[1]}:${match[2]}`)
}

function countMaterialSearchCards(panel: string): number {
  return countMatches(getSearchGroupHtml(panel, '物料资源'), 'data-production-object-action="open-material-resource"')
}

function assertNoDuplicateSearchObjects(panel: string, groups: string[]): void {
  const used = new Set<string>()
  for (const group of groups) {
    for (const key of getSearchGroupObjectKeys(panel, group)) {
      assert.ok(!used.has(key), `搜索结果对象 ${key} 不应重复出现在多个物料搜索分组`)
      used.add(key)
    }
  }
}

assert.ok(Array.isArray(productionObjectSearchIndex), '生产对象搜索索引必须导出数组')
assert.ok(productionObjectSearchIndex.length >= productionOrders.length, '索引至少覆盖生产单')

const order = productionOrders[0]
const demand = productionDemands.find((item) => item.demandId === order.demandId)
const orderSearch = searchProductionObjects(order.productionOrderNo)
assert.ok(orderSearch.some((item) => item.objectType === 'PRODUCTION_ORDER'), '生产单号必须可搜索')
const orderSearchOverview = getProductionObjectOverview(orderSearch[0].objectType, orderSearch[0].id)
assert.ok(orderSearchOverview, '生产单搜索结果必须能用索引 ID 打开总览')

const demandSearch = searchProductionObjects(demand?.demandId ?? order.demandId)
assert.ok(demandSearch.some((item) => item.objectType === 'DEMAND'), '生产需求单号必须可搜索')

const ungeneratedDemand = productionDemands.find((item) => !item.productionOrderId)
assert.ok(ungeneratedDemand, '检查数据需要至少一条未生成生产单的需求')
const ungeneratedDemandSearch = searchProductionObjects(ungeneratedDemand.demandId)
assert.ok(ungeneratedDemandSearch.some((item) => item.objectType === 'DEMAND'), '未生成生产单的需求也必须可搜索')
const demandOnlyOverview = getProductionObjectOverview('DEMAND', ungeneratedDemand.demandId)
assert.ok(demandOnlyOverview, '未生成生产单的需求必须能打开总览')
assert.equal(demandOnlyOverview.summary.productionOrderNo, '尚未生成', '未生成生产单需求的总览状态错误')
assert.equal(demandOnlyOverview.continueDecision.displayText, '需要确认', '未生成生产单需求的首屏结论错误')

const spuSearch = searchProductionObjects(order.demandSnapshot.spuCode)
assert.ok(spuSearch.length > 0, 'SPU 必须可搜索')

const materialSearch = searchProductionObjects('FLSZ260617009')
assert.ok(materialSearch.some((item) => item.objectType === 'MATERIAL'), '面辅料 SKU 必须可搜索')
assert.equal(typeof getMaterialResourceOverview, 'function', '必须导出物料资源总览查询函数')
assert.equal(typeof searchMaterialResources, 'function', '必须导出物料资源搜索函数')

const materialResource = getMaterialResourceOverview('FLSZ260617009', {
  sourceObjectType: 'PRODUCTION_ORDER',
  sourceObjectId: order.productionOrderNo,
  sourceLabel: '生产对象总览 / 面辅料与仓储',
})
assert.ok(materialResource, '物料编码必须能打开物料资源总览')
assert.equal(materialResource.materialSku, 'FLSZ260617009', '物料资源总览物料编码错误')
assert.equal(materialResource.sourceContext?.sourceObjectId, order.productionOrderNo, '来源生产单必须保留')
assert.ok(materialResource.businessAllocations.length >= 1, '物料资源总览必须展示业务占用')
assert.ok(materialResource.businessAllocations.some((item) => item.isSourceContext), '来源生产单占用必须置顶高亮')
assert.ok(materialResource.supplyDemandSummary.totalRequiredQty > 0, '物料资源总览必须展示总需求')
assert.ok(materialResource.materialExecutionLines.length > 0, '物料资源总览必须展示配料/领料/发料履约')
assert.ok(materialResource.masterData.materialSku === 'FLSZ260617009', '物料档案区必须保留静态主数据')

const materialResources = searchMaterialResources('FLSZ260617009')
assert.ok(materialResources.some((item) => item.materialSku === 'FLSZ260617009'), '搜索物料编码必须命中物料资源')

for (const [keyword, message] of [
  ['未到仓', '异常线索：未到仓必须可搜索'],
  ['待领料', '异常线索：待领料必须可搜索'],
  ['缺料', '异常线索：缺料必须可搜索'],
  ['待确认', '异常线索：待确认必须可搜索'],
] as const) {
  assert.ok(searchProductionObjects(keyword).length > 0, message)
}
assert.ok(searchProductionObjects('待领料')[0].statusText?.includes('待领料'), '待领料搜索结果必须直接展示待领料状态')

const warehouseSearch = searchProductionObjects('ISS')
assert.ok(warehouseSearch.some((item) => item.objectType === 'WAREHOUSE_DOC'), '仓库执行单必须可搜索')

const p1SearchCases: Array<[string, string, string]> = [
  ['MPO-202603-0001', 'MATERIAL_PREP_ORDER', '配料单必须可搜索并定位生产单'],
  ['MPR-202603-0001', 'MATERIAL_PREP_RECORD', '配料记录必须可搜索并定位生产单'],
  ['PICK-202603-0001', 'MATERIAL_PICKUP_RECORD', '发料/领料记录必须可搜索并定位生产单'],
  ['CUT-260306-101-01', 'CUT_ORDER', '裁片单必须可搜索并定位生产单'],
  ['FEI-260306-101-01-S-BLK-001', 'FEI_TICKET', '菲票号必须可搜索并定位生产单'],
  ['SPR-260306-101-01', 'SPREADING_ORDER', '铺布单必须可搜索并定位生产单'],
  ['PRINT-WO-202603-0001', 'PRINT_WORK_ORDER', '印花工单必须可搜索并定位生产单'],
  ['DYE-WO-202603-0001', 'DYE_WORK_ORDER', '染色工单必须可搜索并定位生产单'],
  ['HAND-202603-0001', 'HANDOVER_ORDER', '交出单必须可搜索并定位生产单'],
]

for (const [keyword, objectType, message] of p1SearchCases) {
  const results = searchProductionObjects(keyword)
  assert.ok(results.some((item) => item.objectType === objectType), message)
  const hit = results.find((item) => item.objectType === objectType)
  assert.ok(hit?.relatedProductionOrderNo, `${keyword} 搜索结果必须带关联生产单`)
  assert.ok(getProductionObjectOverview(hit.objectType, hit.id), `${keyword} 搜索结果必须能打开总览`)
}

const realPrepProjection = listMaterialPrepOrderProjections()[0]
assert.ok(realPrepProjection, '必须存在真实配料单 Mock 数据')
const realPickupProjection = listMaterialPrepOrderProjections().find((item) => item.pickupRecords.length > 0)
assert.ok(realPickupProjection, '必须存在真实领料记录 Mock 数据')
const realPrintWorkOrder = listPrintWorkOrders()[0]
assert.ok(realPrintWorkOrder, '必须存在真实印花工单 Mock 数据')
const realDyeWorkOrder = listDyeWorkOrders()[0]
assert.ok(realDyeWorkOrder, '必须存在真实染色工单 Mock 数据')

const realP1SearchCases: Array<[string, string, string]> = [
  [realPrepProjection.order.prepOrderNo, 'MATERIAL_PREP_ORDER', '真实配料单号必须可搜索并打开总览'],
  [realPrepProjection.prepRecords[0]?.prepRecordId || '', 'MATERIAL_PREP_RECORD', '真实配料记录号必须可搜索并打开总览'],
  [realPickupProjection.pickupRecords[0]?.pickupRecordId || '', 'MATERIAL_PICKUP_RECORD', '真实领料记录号必须可搜索并打开总览'],
  [realPrintWorkOrder.printOrderNo, 'PRINT_WORK_ORDER', '真实印花工单号必须可搜索并打开总览'],
  [realDyeWorkOrder.dyeOrderNo, 'DYE_WORK_ORDER', '真实染色工单号必须可搜索并打开总览'],
]

for (const [keyword, objectType, message] of realP1SearchCases) {
  assert.ok(keyword, `${message}：缺少样本编号`)
  const results = searchProductionObjects(keyword)
  const hit = results.find((item) => item.objectType === objectType)
  assert.ok(hit, message)
  assert.ok(hit.relatedProductionOrderNo, `${keyword} 搜索结果必须带关联生产单`)
  const hitOverview = getProductionObjectOverview(hit.objectType, hit.id)
  assert.ok(hitOverview, `${keyword} 搜索结果必须能打开总览`)
  assert.ok(
    hitOverview.relatedDocuments.some((doc) => doc.docNo === keyword || doc.docNo === hit.primaryNo),
    `${keyword} 打开总览后必须能在关联单据中看到当前对象`,
  )
}

const printMultiResults = searchProductionObjects('PRINT-WO-GROUP-202603')
assert.ok(
  printMultiResults.filter((item) => item.objectType === 'PRINT_WORK_ORDER').length >= 2,
  '印花加工单关联多生产单时必须展示多条结果',
)
const dyeMultiResults = searchProductionObjects('DYE-WO-GROUP-202603')
assert.ok(
  dyeMultiResults.filter((item) => item.objectType === 'DYE_WORK_ORDER').length >= 2,
  '染色加工单关联多生产单时必须展示多条结果',
)

const overview = getProductionObjectOverview('PRODUCTION_ORDER', order.productionOrderNo)
assert.ok(overview, '生产单必须能打开总览')
assert.equal(overview.summary.productionOrderNo, order.productionOrderNo, '总览生产单号错误')
assert.ok(overview.continueDecision.displayText, '首屏必须展示是否可以继续')
assert.ok(overview.continueDecision.reasonText, '首屏必须展示原因')
assert.ok(overview.continueDecision.reasonText.includes('2026-07-02'), '多项缺料时首屏必须展示最晚预计到仓时间')
assert.ok(overview.continueDecision.nextActionText, '首屏必须展示下一步')
assert.ok(overview.continueDecision.ownerRole, '首屏必须展示责任方')
assert.ok(overview.materials.length > 0, '总览必须包含面辅料明细')
assert.ok(overview.executionOverview.taskFactories.length > 0, '总览必须包含加工厂任务信息')
assert.ok(overview.executionOverview.keyTimes.length > 0, '总览必须包含关键时间信息')
assert.ok(overview.executionOverview.quantityQuality.length > 0, '总览必须包含关键数量信息')
assert.ok(overview.materials.some((line) => dataModule.materialTypeLabel[line.materialType] === '纱线'), '总览物料必须能区分纱线类型')
assert.ok(overview.materials.some((line) => Number(line.preparedQty || 0) > 0), '总览物料必须包含配料数量')
assert.ok(overview.materials.some((line) => Number(line.issuedQty || 0) > 0 || Number(line.factoryReceivedQty || 0) > 0), '总览物料必须包含领料数据')
assert.ok(overview.progressNodes.length > 0, '总览必须包含生产进度节点')
assert.ok(overview.relatedDocuments.length > 0, '总览必须包含关联单据')
assert.ok(overview.sourceSnapshots.length > 0, '总览必须包含来源摘要')
assert.ok(overview.factSources.length >= 3, 'P2 必须拆分采购、WMS、PFOS 事实来源')
assert.ok(overview.factSources.some((item) => item.sourceDomain === 'PMS' && item.factType === '采购事实'), 'P2 必须展示采购事实')
assert.ok(overview.factSources.some((item) => item.sourceDomain === 'WMS' && item.factType === '入库事实'), 'P2 必须展示 WMS 入库事实')
assert.ok(overview.factSources.some((item) => item.sourceDomain === 'WMS' && item.factType === '配料/发料事实'), 'P2 必须展示配料/发料事实')
assert.ok(overview.factSources.some((item) => item.sourceDomain === 'PFOS' && item.factType === '工艺事实'), 'P2 必须展示 PFOS 工艺事实')
assert.ok(overview.decisionFacts.length > 0, 'P2 结论必须有可解释依据')
assert.ok(overview.decisionFacts.every((fact) => fact.sourceObjectNo && fact.quantityText && fact.ownerRole && fact.nextActionText), 'P2 每条继续判断依据都必须包含来源对象、数量、责任方、下一步')
assert.ok(overview.dataConflicts.some((conflict) => conflict.displayText.includes('需确认')), 'P2 数据冲突必须展示需确认')
assert.ok(overview.relationshipGroups.length >= 6, 'P3 关系图必须覆盖生产、物料、采购、仓库、PFOS、异常')
for (const group of ['生产', '物料', '采购', '仓库', 'PFOS', '异常']) {
  assert.ok(overview.relationshipGroups.some((item) => item.groupName === group && item.nodes.length > 0), `P3 关系图缺少 ${group} 节点`)
}
assert.ok(overview.relationshipGroups.some((item) => item.nodes.some((node) => node.nodeType === '商品')), 'P3 关系图必须包含商品节点')
assert.ok(overview.relationshipEdges.length > 0, 'P3 关系图必须展示关系链')
for (const relationText of ['需求生成生产执行对象', 'BOM 需求', '物料采购来源', '仓库配料来源', '工艺执行']) {
  assert.ok(overview.relationshipEdges.some((edge) => edge.relationText.includes(relationText)), `P3 关系链缺少 ${relationText}`)
}
assert.ok(overview.productionTimeline.length >= 6, 'P3 必须提供生产时间线')
assert.ok(overview.productionTimeline.some((node) => node.isCurrent || node.isIssue), 'P3 生产时间线必须突出当前节点或异常节点')
assert.ok(overview.materialFlowTimeline.length >= 5, 'P3 必须提供面辅料流转时间线')
assert.ok(overview.responsibilityAnalysis.length > 0, 'P3 必须提供责任分析')
assert.ok(overview.responsibilityAnalysis.every((item) => item.evidenceObjectNo && item.evidenceText && item.nextActionText), 'P3 每个责任分析都必须有事实依据')

const arrivalLines = overview.materials.filter((line) => Boolean(line.estimatedWarehouseArrivalAt))
assert.ok(arrivalLines.length > 0, '至少要有预计到仓 Mock 数据')
for (const line of arrivalLines) {
  assert.ok(
    ['PURCHASED_NOT_ARRIVED', 'PARTIAL_ARRIVED'].includes(line.purchaseArrivalStatus),
    '预计到仓时间只能展示在已采购未到仓或部分到仓物料上',
  )
}

for (const line of overview.materials) {
  if (!['PURCHASED_NOT_ARRIVED', 'PARTIAL_ARRIVED'].includes(line.purchaseArrivalStatus)) {
    assert.ok(!line.estimatedWarehouseArrivalAt, '非未到仓/部分到仓物料不得展示预计到仓日期')
  }
  assert.ok(!('plannedFinishAt' in line), 'P2 预计到仓不得使用生产完成时间字段')
  assert.ok(!('productionFinishAt' in line), 'P2 预计到仓不得使用生产完成时间字段')
}

const shellSource = source('src/components/shell.ts')
assert.ok(shellSource.includes('renderProductionObjectFloatingEntry'), 'Shell 必须挂载查生产入口')
assert.ok(shellSource.includes("state.pathname.startsWith('/fcs/pda')"), 'PDA 页面必须排除入口')
assert.ok(shellSource.includes("state.pathname.startsWith('/fcs/print/')"), '打印页面必须排除入口')

const mainSource = source('src/main.ts')
assert.ok(mainSource.includes('handleProductionObjectOverviewEvent'), 'main.ts 必须接入生产对象事件处理')
assert.ok(mainSource.includes('data-production-object-action'), 'main.ts 必须优先拦截生产对象事件')

assertIncludes('src/main-handlers/fcs-handlers.ts', 'closeProductionObjectOverlays', 'FCS handler 必须支持 ESC 关闭生产对象浮层')

const identityCell = identityModule.renderProductionOrderIdentityCell({
  productionOrderNo: order.productionOrderNo,
  demandNo: order.demandId,
  saleType: order.demandSnapshot.saleType,
})
assert.ok(identityCell.includes('data-production-object-action="open"'), '生产单身份单元格必须让编号本身可点击打开总览')
assert.ok(identityCell.includes('data-object-type="PRODUCTION_ORDER"'), '生产单号本身必须打开生产单总览')
assert.ok(identityCell.includes('data-object-type="DEMAND"'), '需求单号本身必须打开生产需求总览')
assert.equal(typeof identityModule.renderProductionObjectCodeButton, 'function', '必须提供通用对象编号点击入口')
const spuCodeEntry = identityModule.renderProductionObjectCodeButton({
  objectType: 'PRODUCTION_ORDER',
  objectId: order.productionOrderNo,
  label: order.demandSnapshot.spuCode,
})
assert.ok(spuCodeEntry.includes('data-production-object-action="open"'), 'SPU 编码必须能作为对象入口打开总览')
assert.ok(spuCodeEntry.includes(order.demandSnapshot.spuCode), 'SPU 编码入口必须展示原编码')
const materialCodeEntry = identityModule.renderProductionObjectCodeButton({
  objectType: 'MATERIAL',
  objectId: 'FLSZ260617009',
  label: 'FLSZ260617009',
})
assert.ok(materialCodeEntry.includes('data-production-object-action="open-material-resource"'), '物料编码必须打开物料资源总览')
assert.ok(materialCodeEntry.includes('data-material-sku="FLSZ260617009"'), '物料编码按钮必须带物料 SKU')

const pageEntryExpectations: Array<[string, string, string]> = [
  ['src/pages/production/orders-domain.ts', 'renderProductionOrderIdentityCell', '生产单列表必须通过生产单号 / 需求单号打开总览'],
  ['src/pages/production/demand-domain.ts', 'data-object-type="DEMAND"', '生产需求列表的需求单号本身必须打开需求总览'],
  ['src/pages/production-order-progress-tracking.ts', 'renderProductionOrderIdentityCell', '生产单进度列表必须通过生产单号 / 需求单号打开总览'],
  ['src/pages/progress-material.ts', 'renderProductionOrderIdentityCell', '领料进度必须通过生产单号 / 需求单号打开总览'],
]
for (const [page, text, message] of pageEntryExpectations) {
  assertIncludes(page, text, message)
  assert.ok(!source(page).includes('>总览</button>'), `${page} 不得把总览入口放在操作栏`)
  assert.ok(!source(page).includes('>生产总览</button>'), `${page} 不得把生产总览入口放在操作栏`)
}

const p1PageEntryExpectations: Array<[string, string, string]> = [
  ['src/pages/fcs/material-prep/list.ts', 'MATERIAL_PREP_ORDER', '配料列表每条配料单必须能打开生产对象总览'],
  ['src/pages/process-factory/cutting/cut-orders.ts', 'CUT_ORDER', '裁片单页面必须让裁片单号打开生产对象总览'],
  ['src/pages/process-factory/cutting/fei-tickets.ts', 'FEI_TICKET', '菲票页面必须让菲票号打开生产对象总览'],
  ['src/pages/process-factory/printing/work-orders.ts', 'PRINT_WORK_ORDER', '印花工单页面必须让工单号打开生产对象总览'],
  ['src/pages/process-factory/dyeing/work-orders.ts', 'DYE_WORK_ORDER', '染色工单页面必须让工单号打开生产对象总览'],
]
for (const [page, text, message] of p1PageEntryExpectations) {
  assertIncludes(page, text, message)
}
for (const page of [
  'src/pages/fcs/material-prep/dyeing.ts',
  'src/pages/fcs/material-prep/printing.ts',
  'src/pages/fcs/material-prep/cutting.ts',
  'src/pages/fcs/material-prep/sewing.ts',
  'src/pages/fcs/material-prep/other.ts',
]) {
  assertIncludes(page, '生产总览', `${page} 标题区必须有生产总览入口`)
  assertIncludes(page, 'MATERIAL_PREP_ORDER', `${page} 配料单号必须能打开生产对象总览`)
  assertIncludes(page, 'MATERIAL_PREP_RECORD', `${page} 配料记录必须能打开关联生产`)
  assertIncludes(page, 'MATERIAL_PICKUP_RECORD', `${page} 领料记录必须能打开关联生产`)
}

for (const group of ['生产', '面辅料', '裁片', '印花', '染色', '仓库']) {
  assert.ok(overview.relatedDocuments.some((doc) => doc.docGroup === group), `P1 关联单据必须包含 ${group} 分组`)
}
for (const docType of ['技术包版本', '中转袋', '印花需求单', '印花工单', '印花回货批次', '染色需求单', '染色工单', '染色回货批次']) {
  assert.ok(overview.relatedDocuments.some((doc) => doc.docType === docType), `P1 关联单据缺少 ${docType}`)
}
for (const page of [
  'src/pages/production/orders-domain.ts',
  'src/pages/production/demand-domain.ts',
  'src/pages/production-order-progress-tracking.ts',
  'src/pages/progress-material.ts',
]) {
  assertIncludes(page, 'renderProductionObjectCodeButton', `${page} 必须让 SPU/SKU/物料或单据编号本身打开生产对象总览`)
}

const materialSearchPanel = uiModule.renderProductionObjectSearchPanel('FLSZ260617009')
const orderSearchPanel = uiModule.renderProductionObjectSearchPanel(order.productionOrderNo)
assert.ok(materialSearchPanel.includes('生产全局搜索'), '搜索面板标题错误')
assert.ok(materialSearchPanel.includes('面料 / 辅料 / 纱线'), '搜索提示必须包含物料类型')
assert.ok(materialSearchPanel.includes('配料单 / 领料单 / 发料单'), '搜索提示必须包含配领仓储对象')
assert.ok(materialSearchPanel.includes('裁片单'), '搜索提示必须包含裁片单')
assert.ok(materialSearchPanel.includes('菲票'), '搜索提示必须包含菲票')
assert.ok(materialSearchPanel.includes('印花工单'), '搜索提示必须包含印花工单')
assert.ok(materialSearchPanel.includes('染色工单'), '搜索提示必须包含染色工单')
assert.ok(materialSearchPanel.includes('production-object-search-panel__content'), '搜索抽屉内容区必须独立滚动')
for (const group of ['物料资源', '相关生产对象', '相关采购与仓储', '异常线索']) {
  assert.ok(hasSearchGroup(materialSearchPanel, group), `搜索物料编码时必须展示 ${group} 分组`)
}
for (const group of ['最佳匹配', '当前卡点', '生产主线', '关联执行']) {
  assert.ok(!hasSearchGroup(materialSearchPanel, group), `搜索物料编码时不应追加 ${group} 分组`)
  assert.ok(hasSearchGroup(orderSearchPanel, group), `搜索业务单据号必须按 ${group} 分组`)
}
assert.ok(!orderSearchPanel.includes('物料资源'), '搜索业务单据号不应进入物料资源分组')
assertNoDuplicateSearchObjects(materialSearchPanel, ['相关生产对象', '相关采购与仓储', '异常线索'])
assert.ok(countMaterialSearchCards(materialSearchPanel) <= 6, '搜索物料编码时物料资源卡片不得超过 6 张')
for (const keyword of ['缺料', '待领料'] as const) {
  assert.ok(countMaterialSearchCards(uiModule.renderProductionObjectSearchPanel(keyword)) <= 6, `${keyword} 搜索物料资源卡片不得超过 6 张`)
}
for (const text of ['关联生产对象', '当前卡点', '责任方', '最近更新', '查看来源']) {
  assert.ok(materialSearchPanel.includes(text), `搜索结果卡片缺少 ${text}`)
}
assert.ok(materialSearchPanel.includes('查看总览'), '搜索结果必须能打开总览')
assert.ok(materialSearchPanel.includes('查看物料资源'), '物料搜索结果必须能打开物料资源总览')
assert.ok(uiModule.renderProductionObjectSearchPanel('缺料').includes('当前卡点：</span>缺料'), '缺料搜索结果必须把缺料展示为当前卡点')
assert.ok(uiModule.renderProductionObjectSearchPanel('缺料').includes('物料资源'), '缺料搜索必须命中物料资源')
assert.equal(typeof uiModule.renderOverviewHeader, 'function', '必须导出总览头部渲染函数')
assert.equal(typeof uiModule.renderOverviewSummaryTab, 'function', '必须导出总览 Tab 渲染函数')
assert.equal(typeof uiModule.renderOverviewMaterialsTab, 'function', '必须导出面辅料 Tab 渲染函数')
assert.equal(typeof uiModule.renderOverviewProgressTab, 'function', '必须导出生产进度 Tab 渲染函数')
assert.equal(typeof uiModule.renderOverviewDocumentsTab, 'function', '必须导出关联单据 Tab 渲染函数')
assert.equal(typeof uiModule.renderOverviewIssuesTab, 'function', '必须导出异常与下一步 Tab 渲染函数')
assert.equal(typeof uiModule.renderOverviewRelationshipTab, 'function', '必须导出关系图 Tab 渲染函数')
assert.equal(typeof uiModule.renderOverviewTimelineTab, 'function', '必须导出生产时间线 Tab 渲染函数')
assert.equal(typeof uiModule.renderOverviewMaterialFlowTab, 'function', '必须导出面辅料流转 Tab 渲染函数')
assert.equal(typeof uiModule.renderOverviewResponsibilityTab, 'function', '必须导出责任分析 Tab 渲染函数')
assert.equal(typeof uiModule.renderOverviewCrossQueryTab, 'function', '必须导出跨单查询 Tab 渲染函数')
assert.ok(!source('src/components/production-object-overview.ts').includes('top-[132px]'), '总览 Tab 不得使用固定 top 偏移，避免被动态高度头部遮挡')
assert.ok(source('src/components/production-object-overview.ts').includes('flex shrink-0 gap-1 overflow-x-auto border-b bg-card px-4'), '总览 Tab 不得被弹层 flex 布局压缩')

const surface = uiModule.renderProductionObjectOverviewSurface(overview.objectType, overview.objectKey)
const indexKeySurface = uiModule.renderProductionObjectOverviewSurface('PRODUCTION_ORDER', `PRODUCTION_ORDER-${order.productionOrderNo}`)
assert.ok(indexKeySurface.includes(`data-primary-object-id="${order.productionOrderNo}"`), '总览从搜索索引打开时，物料资源上下文必须保留真实生产单号')
assert.equal(typeof uiModule.renderMaterialResourceOverviewSurface, 'function', '必须导出物料资源总览渲染函数')
const materialSurface = uiModule.renderMaterialResourceOverviewSurface('FLSZ260617009', {
  sourceObjectType: 'PRODUCTION_ORDER',
  sourceObjectId: order.productionOrderNo,
  sourceLabel: '生产对象总览 / 面辅料与仓储',
})
for (const text of [
  '物料资源总览',
  '供需总览',
  '业务占用',
  '库存与在途',
  '配料 / 领料 / 发料',
  '异常与档案',
  '当前判断',
  '来源',
  '总需求',
  '可用库存',
  '缺口',
  '影响范围',
  '当前来源',
]) {
  assert.ok(materialSurface.includes(text), `物料资源总览缺少 ${text}`)
}
assert.equal(countMatches(materialSurface, 'data-production-object-action="switch-material-tab"'), 5, '物料资源总览必须有 5 个一级 Tab')
assert.ok(materialSurface.includes('data-source-object-id'), '物料资源总览必须保留来源对象')
for (const text of [
  '生产对象总览',
  '总览',
  '面辅料与仓储',
  '工艺与任务',
  '异常与责任',
  '关系与历史',
  '预计到仓时间',
  '来自采购/物流预计到仓',
  '执行概览',
  '加工厂',
  '物料配领',
  '时间',
  '数量',
  '对象身份',
  '当前判断',
  '关键证据',
  '需求',
  '已配料',
  '已领料',
  '缺口',
  '计划',
  '裁片完成',
  '事实口径',
  '数据冲突',
]) {
  assert.ok(surface.includes(text), `总览界面缺少 ${text}`)
}
assert.equal(countMatches(surface, 'data-production-object-action="switch-tab"'), 5, '生产对象总览只能保留 5 个一级 Tab')
for (const removedTab of ['>面辅料</button>', '>生产进度</button>', '>关联单据</button>', '>异常与下一步</button>', '>关系图</button>', '>生产时间线</button>', '>面辅料流转</button>', '>责任分析</button>', '>跨单查询</button>']) {
  assert.ok(!surface.includes(removedTab), `总览不得保留旧 Tab：${removedTab}`)
}
assert.ok(!surface.includes('生产台账摘要'), '生产对象总览不得直接搬入台账摘要标题')
assert.ok(!surface.includes('执行状态摘要'), '生产对象总览不得继续展示四块摘要卡')
assert.ok(!surface.includes('>去处理</button>'), '生产对象总览底部不得保留去处理按钮')

const relationSurface = uiModule.renderProductionObjectOverviewSurface(overview.objectType, overview.objectKey, 'relationship-history')
assert.ok(relationSurface.includes('生产'), '关系图必须展示生产节点')
assert.ok(relationSurface.includes('物料'), '关系图必须展示物料节点')
assert.ok(relationSurface.includes('采购'), '关系图必须展示采购节点')
assert.ok(relationSurface.includes('仓库'), '关系图必须展示仓库节点')
assert.ok(relationSurface.includes('PFOS'), '关系图必须展示 PFOS 节点')
assert.ok(relationSurface.includes('异常'), '关系图必须展示异常节点')
assert.ok(relationSurface.includes('商品'), '关系图必须展示商品节点')
assert.ok(relationSurface.includes('关系链'), '关系图必须展示关系链')
assert.ok(relationSurface.includes('计划时间'), '关系与历史必须展示生产时间线计划时间')
assert.ok(relationSurface.includes('实际时间'), '关系与历史必须展示生产时间线实际时间')
assert.ok(relationSurface.includes('采购'), '关系与历史必须展示采购阶段')
assert.ok(relationSurface.includes('到仓'), '关系与历史必须展示到仓阶段')
assert.ok(relationSurface.includes('配料'), '关系与历史必须展示配料阶段')
assert.ok(relationSurface.includes('发料'), '关系与历史必须展示发料阶段')
assert.ok(relationSurface.includes('签收'), '关系与历史必须展示签收阶段')

const responsibilitySurface = uiModule.renderProductionObjectOverviewSurface(overview.objectType, overview.objectKey, 'issues')
assert.ok(responsibilitySurface.includes('判断依据'), '责任分析必须展示判断依据')
assert.ok(relationSurface.includes('生产问题聚合查询'), '关系与历史必须展示跨单影响')

assert.equal(typeof queryProductionObjectIssues, 'function', 'P3 必须导出跨单查询函数')
assert.ok(queryProductionObjectIssues({ materialSku: 'FLSZ260617009' }).length > 0, 'P3 必须支持按物料 SKU 查询生产单集合')
assert.ok(queryProductionObjectIssues({ factoryName: '印花' }).length > 0, 'P3 必须支持按工厂查询生产单集合')
assert.ok(queryProductionObjectIssues({ issueType: '已采购未到仓' }).length > 0, 'P3 必须支持按异常类型查询生产单集合')
assert.ok(queryProductionObjectIssues({ etaDate: '2026-07-02' }).length > 0, 'P3 必须支持按预计到仓日期查询生产单集合')

const entry = uiModule.renderProductionObjectFloatingEntry('/fcs/production/orders')
assert.ok(entry.includes('查生产'), 'FCS 普通页面必须展示查生产入口')
assert.equal(uiModule.renderProductionObjectFloatingEntry('/fcs/pda/exec'), '', 'PDA 页面不得展示查生产入口')
assert.equal(uiModule.renderProductionObjectFloatingEntry('/fcs/print/foo'), '', '打印页面不得展示查生产入口')

const styles = source('src/styles.css')
assert.ok(styles.includes('.production-object-floating-entry'), '缺少浮动入口样式')
assert.ok(styles.includes('@media (min-width: 1600px)'), '缺少大屏右侧抽屉样式')
assert.ok(styles.includes('@media (max-width: 1599px)'), '缺少中低分辨率全屏弹层样式')
assert.ok(styles.includes('clamp(55rem, 52vw, 60rem)'), '大屏总览抽屉宽度必须符合 880 到 960px 区间')
assert.ok(!styles.includes('hsl(var(--background))'), '生产对象浮层不得用无效的 hsl(var(--background)) 写法')
assert.ok(!styles.includes('hsl(var(--border))'), '生产对象浮层不得用无效的 hsl(var(--border)) 写法')
assert.ok(styles.includes('background: rgb(15 23 42 / 0.34);'), '生产对象浮层外层必须有明确遮罩背景')
assert.ok(styles.includes('background: var(--background);'), '生产对象浮层必须有实底背景')
assert.ok(styles.includes('.production-object-search-panel__content'), '搜索抽屉缺少内容滚动区样式')
assert.ok(styles.includes('overflow-y: auto;'), '生产对象抽屉必须支持上下滚动')
assert.ok(source('src/data/fcs/production-object-overview.ts').includes('shortageReasonCode'), '采购 Mock 必须包含缺口原因字段')
assert.ok(source('src/data/fcs/production-object-overview.ts').includes('manualEtaAt'), 'P2 采购 Mock 必须包含人工 ETA 字段')
assert.ok(source('src/data/fcs/production-object-overview.ts').includes('logisticsEtaAt'), 'P2 采购 Mock 必须包含物流 ETA 字段')
assert.ok(source('src/data/fcs/production-object-overview.ts').includes('supplierEtaAt'), 'P2 采购 Mock 必须包含供应商 ETA 字段')

const forbiddenWords = ['阻塞', '门禁', '放行', '回写', '上下游', '闭环']
const newSources = [
  source('src/data/fcs/production-object-overview.ts'),
  source('src/components/production-object-overview.ts'),
  source('src/pages/production/orders-domain.ts'),
  source('src/pages/production/demand-domain.ts'),
  source('src/pages/production-order-progress-tracking.ts'),
  source('src/pages/progress-material.ts'),
].join('\n')
for (const word of forbiddenWords) {
  assert.ok(!newSources.includes(word), `新增生产对象文案不得使用“${word}”`)
}

console.log('[check-production-object-overview] PASS')
