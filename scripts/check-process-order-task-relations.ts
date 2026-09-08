import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import {
  buildProcessOrderTaskRelationViewFromDocuments,
  buildProcessOrderTaskLinks,
  getProcessOrderTaskRelationView,
  getProcessOrderTaskRelationViewByDetail,
  listProcessOrderTaskDocuments,
  listProcessOrderTaskLinksByProductionOrder,
  listProcessOrderTaskRelationViewsByOccurrence,
  listProcessOrderTaskRelationViewsByProductionOrder,
  type ProcessOrderTaskDocumentRef,
} from '../src/data/fcs/process-order-task-links.ts'
import type { TechnicalProcessEntry } from '../src/data/pcs-technical-data-version-types.ts'
import { generateTaskArtifactsForAllOrders } from '../src/data/fcs/production-artifact-generation.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import { processTasks } from '../src/data/fcs/process-tasks.ts'
import { listLaceProductionOrders, PLATFORM_ADMIN } from '../src/data/fcs/lace-factory-domain.ts'
import { renderProcessOrderTaskRelations } from '../src/pages/process-order-task-relations.ts'
import { buildBindingProcessOrders } from '../src/pages/process-factory/cutting/binding-strip-orders.ts'
import { listGeneratedCutOrderSourceRecords } from '../src/data/fcs/cutting/generated-cut-orders.ts'
import { listSpecialCraftTaskOrders } from '../src/data/fcs/special-craft-task-orders.ts'
import { listProcessWorkOrders } from '../src/data/fcs/process-work-order-domain.ts'
import { listWoolWorkOrders } from '../src/data/fcs/wool-task-domain.ts'

const root = process.cwd()

function fixtureEntry(input: {
  id: string
  predecessorEntryIds?: string[]
}): TechnicalProcessEntry {
  return {
    id: input.id,
    entryType: 'PROCESS_BASELINE',
    stageCode: 'PROD',
    stageName: '生产阶段',
    processCode: input.id,
    processName: `工序 ${input.id}`,
    assignmentGranularity: 'DETAIL',
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    routeObjectKey: 'FIXTURE:CUT_PIECE',
    inputObjectType: 'CUT_PIECE',
    outputObjectType: 'CUT_PIECE',
    predecessorEntryIds: input.predecessorEntryIds ?? [],
  }
}

function fixtureDocument(entryId: string): ProcessOrderTaskDocumentRef {
  return {
    documentId: `DOC-${entryId}`,
    documentNo: `DOC-${entryId}`,
    documentKind: 'PRODUCTION_TASK',
    documentTypeLabel: '测试加工单',
    productionOrderId: 'PO-RELATION-FIXTURE',
    productionOrderNo: 'PO-RELATION-FIXTURE',
    processCode: entryId,
    processName: `工序 ${entryId}`,
    sourceEntryIds: [entryId],
    processEntryIds: [entryId],
    routeObjectKeys: ['FIXTURE:CUT_PIECE'],
    bomItemIds: ['BOM-FIXTURE'],
    sourceLabel: '关系专项夹具',
    objectLabel: '裁片',
    quantityLabel: '10 片',
    detailRefs: [{
      detailId: `DETAIL-${entryId}`,
      label: `明细 ${entryId}`,
      sourceEntryIds: [entryId],
      routeObjectKeys: ['FIXTURE:CUT_PIECE'],
      bomItemIds: ['BOM-FIXTURE'],
    }],
  }
}

const fixtureEntries = [
  fixtureEntry({ id: 'A' }),
  fixtureEntry({ id: 'B', predecessorEntryIds: ['A'] }),
  fixtureEntry({ id: 'C', predecessorEntryIds: ['A'] }),
  fixtureEntry({ id: 'D', predecessorEntryIds: ['B', 'C'] }),
]
const fixtureDocuments = fixtureEntries.map((entry) => fixtureDocument(entry.id))
const fixtureEntriesByOrder = new Map([['PO-RELATION-FIXTURE', fixtureEntries]])
const fixtureLinks = buildProcessOrderTaskLinks(fixtureDocuments, fixtureEntriesByOrder)
assert.equal(fixtureLinks.filter((link) => link.predecessorDocumentId === 'DOC-A').length, 2, '一对多路线必须生成两条直接关系')
assert.equal(fixtureLinks.filter((link) => link.successorDocumentId === 'DOC-D').length, 2, '多对一汇合必须保留两条直接关系')
assert.equal(fixtureLinks.filter((link) => link.predecessorDocumentId === 'DOC-A' && link.successorDocumentId === 'DOC-B').length, 1, '一对一直接边不得重复')
assert(fixtureLinks.every((link) => link.predecessorDetailIds.length === 1 && link.successorDetailIds.length === 1), '关系边必须保留上下游任务明细身份')
assert(fixtureLinks.every((link) => link.routeObjectKey === 'FIXTURE:CUT_PIECE'), '关系边必须保留逻辑对象分支')

const fixturePendingView = buildProcessOrderTaskRelationViewFromDocuments(
  'DOC-A',
  [fixtureDocument('A'), fixtureDocument('B')],
  fixtureEntriesByOrder,
)
assert(fixturePendingView, '关系夹具必须能构造只读视图')
assert.deepEqual(fixturePendingView.successors.map((item) => item.documentId), ['DOC-B'])
assert.deepEqual(fixturePendingView.pendingSuccessors.map((item) => item.occurrenceEntryId), ['C'])
const fixtureAfterVoidView = buildProcessOrderTaskRelationViewFromDocuments(
  'DOC-A',
  [fixtureDocument('A')],
  fixtureEntriesByOrder,
)
assert(fixtureAfterVoidView, '从索引移除已作废下游单据后，上游关系仍必须可读')
assert.equal(fixtureAfterVoidView.successors.length, 0, '已移除/作废单据不得残留为可点击后置单据')
assert.deepEqual(
  fixtureAfterVoidView.pendingSuccessors.map((item) => item.occurrenceEntryId).sort(),
  ['B', 'C'],
  '已移除/作废单据对应的路线节点必须回到待生成，不得丢失路线关系',
)

const links = buildProcessOrderTaskLinks()
assert(links.length > 0, '当前正式演示数据必须能从路线 occurrence 生成前后置任务项')
assert.equal(new Set(links.map((link) => link.linkId)).size, links.length, '任务项关联不得重复写同一条边')
const forbiddenLedgerFields = new Set(['qty', 'quantity', 'status', 'receivedQty', 'handedOverQty', 'availableQty', 'inventoryQty'])
assert(
  links.every((link) => Object.keys(link).every((key) => !forbiddenLedgerFields.has(key))),
  '关系索引只能保存引用，不得复制数量、库存或单据状态账',
)
const firstDocumentSnapshot = listProcessOrderTaskDocuments()[0]
assert(firstDocumentSnapshot, '关系索引必须至少包含一张加工单')
const firstDocumentOriginalEntryCount = firstDocumentSnapshot.sourceEntryIds.length
firstDocumentSnapshot.sourceEntryIds.push('MUTATION-MUST-NOT-LEAK')
assert.equal(
  listProcessOrderTaskDocuments().find((item) => item.documentId === firstDocumentSnapshot.documentId)?.sourceEntryIds.length,
  firstDocumentOriginalEntryCount,
  '只读查询必须返回克隆，调用方修改不得污染关系事实',
)

const sewingTask = processTasks.find((task) => (
  task.processBusinessCode === 'SEW'
  && (task.dependsOnTaskIds ?? []).length > 0
))
assert(sewingTask, '必须存在带显式上游依赖的车缝任务样例')
const sewingView = getProcessOrderTaskRelationView(sewingTask.taskId)
assert(sewingView, '车缝任务必须可读取统一任务项关系')
assert(
  sewingView.predecessors.some((document) => (
    sewingTask.dependsOnTaskIds.includes(document.documentId)
    || listGeneratedCutOrderSourceRecords().some((cutOrder) => (
      cutOrder.cutOrderId === document.documentId
      && sewingTask.dependsOnTaskIds.includes(cutOrder.cuttingTaskId)
    ))
  )),
  '车缝前置任务项必须与显式路线依赖一致',
)
assert(
  listProcessOrderTaskRelationViewsByProductionOrder(sewingTask.productionOrderId)
    .some((view) => view.current.documentId === sewingTask.taskId),
  '必须支持按生产单查询全部加工单关系',
)
assert(
  listProcessOrderTaskLinksByProductionOrder(sewingTask.productionOrderId)
    .some((link) => link.successorDocumentId === sewingTask.taskId),
  '必须支持按生产单查询直接关系边',
)

const relationHtml = renderProcessOrderTaskRelations(sewingTask.taskId)
for (const heading of ['需求来源', '任务明细', '前置任务项', '后置任务项']) {
  assert(relationHtml.includes(heading), `管理端关系区缺少“${heading}”`)
}

for (const preparationOrder of listProcessWorkOrders()) {
  const preparationView = getProcessOrderTaskRelationView(preparationOrder.workOrderId)
  assert(preparationView, `${preparationOrder.workOrderNo} 必须进入准备阶段加工单关系索引`)
  assert.equal(preparationView.current.documentId, preparationOrder.workOrderId)
  assert(preparationView.demandSource, `${preparationOrder.workOrderNo} 缺少需求来源`)
  assert(preparationView.taskDetails.length > 0, `${preparationOrder.workOrderNo} 缺少任务明细`)
}

const embeddedDyeView = getProcessOrderTaskRelationView('DYE-WATER-PO-202603-081')
const independentWaterId = 'WATER-PO-202603-081__tdv_demand_SPU_TSHIRT_081-bom-water-soluble-only'
assert(embeddedDyeView, '含内嵌水溶的正式染色加工单必须进入关系索引')
assert(
  !embeddedDyeView.predecessors.some((document) => document.documentId === independentWaterId),
  '不同 BOM 分支的独立水溶单不得误接到内嵌水溶染色单',
)
assert(
  embeddedDyeView.successors.some((document) => document.documentId === 'TASK-KOL-202603-081'),
  'KOL 整单任务仍须承接本款真实准备加工结果',
)
const pendingWaterView = getProcessOrderTaskRelationView(independentWaterId)
assert(pendingWaterView?.pendingPredecessors.length, '已存在路线但前置单据尚未生成时，必须保留待生成前置任务项')
assert(renderProcessOrderTaskRelations(independentWaterId).includes('待生成'), '管理端必须把未生成的路线任务项明确显示为“待生成”')

const legacyDyeView = getProcessOrderTaskRelationView('DWO-002')
assert(legacyDyeView, '旧染色样例仍须可读')
assert.equal(legacyDyeView.predecessors.length + legacyDyeView.successors.length, 0, '缺少 BOM/occurrence 身份的旧 Mock 不得猜测任务关系')

const bindingOrder = buildBindingProcessOrders().find((order) => Boolean(order.sourceParentTaskId))
assert(bindingOrder, '必须存在可追溯到裁片任务的捆条加工单')
const bindingView = getProcessOrderTaskRelationView(bindingOrder.bindingOrderId)
assert(bindingView, '捆条加工单必须进入统一任务项关系索引')
assert(
  bindingView.predecessors.some((document) => (
    document.documentId === bindingOrder.sourceParentTaskId
    || document.documentNo === bindingOrder.sourceCutOrderNo
  )),
  '捆条加工单前置任务项必须指向其真实正式裁片单',
)
assert(bindingView.taskDetails.length === bindingOrder.bindingDetails.length, '捆条任务明细必须保留每个规格')

const laceOrder = listLaceProductionOrders(PLATFORM_ADMIN)[0]
assert(laceOrder, '必须存在花边加工单演示事实')
const laceView = getProcessOrderTaskRelationView(laceOrder.workOrderId)
assert(laceView, '花边加工单必须进入统一任务项关系索引')
assert(
  laceView.predecessors.some((document) => document.documentId === `LACE-PURCHASE:${laceOrder.purchaseOrderId}`),
  '花边加工单前置任务项必须保留采购需求来源',
)
assert(laceView.taskDetails.some((detail) => detail.includes('交出后去向')), '花边任务明细必须标明交出后的中央辅料仓去向')

const generatedTaskArtifacts = generateTaskArtifactsForAllOrders()
// PROD-004：三方合并任务的烫包责任仍须保留；我方 QC 项目不能反向生成派单任务。
assert(generatedTaskArtifacts.every((artifact) => artifact.stageCode === 'PROD'
  || (artifact.stageCode === 'POST' && artifact.processCode === 'IRON_PACK')), '仅允许明确来源的三方烫包责任跨入 POST 阶段')
assert(
  generatedTaskArtifacts.every((artifact) => !['BUTTONHOLE', 'BUTTON_ATTACH'].includes(artifact.processCode)),
  '开扣眼、装扣子只能由后道到货 QC 动态决定',
)
const ironPackArtifacts = generatedTaskArtifacts.filter((artifact) => artifact.processCode === 'IRON_PACK')
assert(ironPackArtifacts.length > 0, '必须保留已明确的三方烫包责任，不能为通过门禁全部删除')
for (const artifact of ironPackArtifacts) {
  const order = productionOrders.find((item) => item.productionOrderId === artifact.orderId)
  assert(order, '烫包责任必须引用原生产单，不能来自字典覆盖演示')
  const snapshot = getProductionOrderTechPackSnapshot(order.productionOrderId)
  assert.equal(artifact.techPackId, snapshot?.sourceTechPackVersionId, '烫包责任必须绑定本单冻结版本')
  const explicitEntry = snapshot?.processEntries?.find((entry) => entry.id === artifact.sourceEntryId && entry.processCode === 'IRON_PACK')
  if (!explicitEntry) {
    const summary = order.taskBreakdownSummary
    assert(summary.isBrokenDown && !(summary.wholeOrderTaskCount ?? 0), '整单或未拆任务不能补造烫包责任')
    assert(['SEWING_IRON_PACK', 'CUTTING_SEWING_IRON_PACK'].includes(summary.mergedTaskType || '')
      || summary.taskTypesTop3.some((name) => name === '烫包' || name.includes('+烫包')), '烫包必须由明确任务范围决定')
    assert.equal(artifact.sourceEntryId, `TASK-BOUNDARY-${order.productionOrderId}-IRON_PACK`)
  }
  assert.equal(artifact.taskScope, 'EXTERNAL_TASK', '三方烫包不能冒充我方动态后道项目')
}

const postPageDir = join(root, 'src/pages/process-factory/post-finishing')
for (const name of readdirSync(postPageDir).filter((file) => file.endsWith('.ts'))) {
  const source = readFileSync(join(postPageDir, name), 'utf8')
  assert(!source.includes('renderProcessOrderTaskRelations'), `后道页面 ${name} 不应套用准备/生产通用关系卡`)
}

const cuttingDetailSource = readFileSync(join(root, 'src/pages/process-factory/cutting/cut-orders.ts'), 'utf8')
assert(cuttingDetailSource.includes('renderProcessOrderTaskRelations(row.cutOrderId)'), '正式裁片单详情必须以正式裁片单身份展示统一任务项关系')
const generatedCutOrder = listGeneratedCutOrderSourceRecords().find((order) => Boolean(order.cuttingTaskId))
assert(generatedCutOrder, '必须存在正式生成裁片单')
const generatedCutOrderView = getProcessOrderTaskRelationView(generatedCutOrder.cutOrderId)
assert(generatedCutOrderView, '正式裁片单必须直接进入关系索引，不得借旧裁片任务身份展示')
assert.equal(generatedCutOrderView.current.documentNo, generatedCutOrder.cutOrderNo)
assert.equal(generatedCutOrderView.current.documentTypeLabel, '裁片单')
assert(generatedCutOrderView.taskDetails.some((detail) => detail.startsWith('投入：')), '正式裁片单任务明细必须展示实际布料投入')
assert(generatedCutOrderView.taskDetails.some((detail) => detail.startsWith('产出裁片：')), '正式裁片单任务明细必须展示裁片部位产出')
const bindingDetailSource = readFileSync(join(root, 'src/pages/process-factory/cutting/special-processes.ts'), 'utf8')
assert(bindingDetailSource.includes('renderProcessOrderTaskRelations(row.bindingOrderId)'), '捆条加工单详情必须展示统一任务项关系')
const laceDetailSource = readFileSync(join(root, 'src/pages/process-factory/accessory/lace/work-order-detail.ts'), 'utf8')
assert(laceDetailSource.includes('renderProcessOrderTaskRelations(order.workOrderId)'), '花边加工单详情必须展示统一任务项关系')

const woolOrders = listWoolWorkOrders()
assert(woolOrders.some((order) => order.kind === 'WHOLE_GARMENT'), '必须存在整件毛织加工单样例')
assert(woolOrders.some((order) => order.kind === 'PART_PANEL'), '必须存在部位毛织加工单样例')
for (const woolOrder of woolOrders) {
  const woolView = getProcessOrderTaskRelationView(woolOrder.taskId)
  assert(woolView, `${woolOrder.woolOrderNo} 必须进入统一任务项关系索引`)
  assert.equal(woolView.current.documentNo, woolOrder.woolOrderNo)
  assert.equal(woolView.current.href, `/fcs/craft/wool/work-orders/${encodeURIComponent(woolOrder.woolOrderId)}`)
  assert(woolView.demandSource.includes(woolOrder.productionOrderNo), `${woolOrder.woolOrderNo} 缺少生产单需求来源`)
  assert.equal(woolView.taskDetails.length, woolOrder.outputPlanLines.length, `${woolOrder.woolOrderNo} 任务明细必须逐产出 SKU 展开`)
  assert(
    woolView.current.objectLabel === (woolOrder.kind === 'PART_PANEL' ? '纱线 → 毛织横机片' : '纱线 → 成衣'),
    `${woolOrder.woolOrderNo} 的投入产出对象类型错误`,
  )
}
const woolDetailSource = readFileSync(join(root, 'src/pages/process-factory/wool/work-order-detail.ts'), 'utf8')
assert(woolDetailSource.includes('renderProcessOrderTaskRelations(order.taskId)'), '毛织加工单详情必须以生产任务身份展示统一任务项关系')

const specialCraftOrders = listSpecialCraftTaskOrders().filter((order) => Boolean(order.sourceEntryId))
assert(specialCraftOrders.length > 0, '辅助/特种工艺必须存在带路线 occurrence 的正式加工单')
const specialCraftOrder = specialCraftOrders.find((order) => order.predecessorEntryIds.length > 0) || specialCraftOrders[0]
const specialCraftView = getProcessOrderTaskRelationView(specialCraftOrder.taskOrderId)
assert(specialCraftView, '辅助/特种工艺关系必须按具体加工单身份读取')
assert.equal(specialCraftView.current.documentId, specialCraftOrder.taskOrderId)
assert.equal(specialCraftView.current.documentNo, specialCraftOrder.taskOrderNo)
assert(!specialCraftView.current.documentNo.startsWith('TASK-SC-'), '关系卡不得用来源任务号冒充加工单号')
assert.deepEqual(specialCraftView.current.sourceEntryIds, [specialCraftOrder.sourceEntryId])
assert.equal(specialCraftView.taskDetails.length, specialCraftOrder.demandLines?.length || 0, '任务明细必须来自当前加工单的真实明细')
assert(
  listProcessOrderTaskRelationViewsByOccurrence(specialCraftOrder.sourceEntryId, specialCraftOrder.productionOrderId)
    .some((view) => view.current.documentId === specialCraftOrder.taskOrderId),
  '必须支持按路线 occurrence 查询加工单关系',
)
const selectedDemandLine = specialCraftOrder.demandLines?.[0]
assert(selectedDemandLine, '辅助/特种工艺专项样例必须包含任务明细')
const selectedDetailView = getProcessOrderTaskRelationViewByDetail(specialCraftOrder.taskOrderId, selectedDemandLine.demandLineId)
assert(selectedDetailView, '必须支持按加工单明细查询关系')
assert.equal(selectedDetailView.selectedDetailId, selectedDemandLine.demandLineId)
assert.equal(selectedDetailView.taskDetails.length, 1, '按明细查询时只能返回所选明细摘要')
assert.equal(
  getProcessOrderTaskRelationViewByDetail(specialCraftOrder.taskOrderId, 'NOT-EXIST'),
  undefined,
  '不存在的明细不得回退成整单关系',
)
const sameCraftDifferentOccurrences = specialCraftOrders.filter((order) => (
  order.operationId === specialCraftOrder.operationId
  && order.sourceEntryId !== specialCraftOrder.sourceEntryId
))
if (sameCraftDifferentOccurrences.length > 0) {
  const anotherView = getProcessOrderTaskRelationView(sameCraftDifferentOccurrences[0].taskOrderId)
  assert(anotherView && anotherView.current.documentId !== specialCraftView.current.documentId, '同名不同 occurrence 不得共用一张关系卡')
}
const specialCraftDetailSource = readFileSync(join(root, 'src/pages/process-factory/special-craft/task-detail.ts'), 'utf8')
assert(specialCraftDetailSource.includes('renderProcessOrderTaskRelations(taskOrder.taskOrderId)'), '辅助/特种工艺详情必须按加工单 ID 展示关系，不得借来源任务 ID')

console.log(`加工单任务项关系专项检查通过：${links.length} 条显式关系，准备/生产可追溯，后道保持专用模型。`)
