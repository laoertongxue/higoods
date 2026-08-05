import assert from 'node:assert/strict'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  applyBomRequirementsToEngineeringTasks,
  getEngineeringMasterOrderById,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  submitEngineeringTaskResult,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  bindAccessoryPurchaseOrder,
  computeAccessoryPurchaseTaskLinkage,
  evaluateAccessoryPurchaseCompletion,
  reconcileAccessoryPurchaseTaskLinkage,
  removeEngineeringPurchaseOrderFact,
  resetEngineeringPurchaseOrderFacts,
  setEngineeringPurchaseOrderFacts,
  unbindAccessoryPurchaseOrder,
  updateEngineeringPurchaseOrderFact,
} from '../src/data/pcs-engineering-purchase-linkage.ts'
import {
  handlePurchaseTaskEvent,
  reconcileAndRefreshPurchaseTaskRegions,
  renderPcsPurchaseTaskDetailPage,
} from '../src/pages/pcs-engineering-tasks/purchase-task.ts'

const facts = [
  {
    purchaseOrderNo: 'PO-A',
    styleCode: 'STYLE-A',
    supplierName: '辅料供应商甲',
    status: '已下单' as const,
    orderedAt: '2026-08-01 09:00:00',
    materialLines: [{ materialSkuId: 'ACC-A', materialName: '拉链', quantity: 100, unit: '条' }],
  },
  {
    purchaseOrderNo: 'PO-B',
    styleCode: 'STYLE-A',
    supplierName: '辅料供应商乙',
    status: '已下单' as const,
    orderedAt: '2026-08-02 16:30:00',
    materialLines: [{ materialSkuId: 'ACC-B', materialName: '纽扣', quantity: 200, unit: '颗' }],
  },
]

const completeGate = evaluateAccessoryPurchaseCompletion({
  requiredMaterialSkuIds: ['ACC-A', 'ACC-B'],
  purchaseOrders: facts,
})
assert.equal(completeGate.completed, true)
assert.deepEqual(completeGate.coveredMaterialSkuIds, ['ACC-A', 'ACC-B'])
assert.deepEqual(completeGate.uncoveredMaterialSkuIds, [])
assert.equal(completeGate.completedAt, '2026-08-02 16:30:00')
assert.equal(completeGate.blockReason, '')

const planShape = evaluateAccessoryPurchaseCompletion({
  requiredMaterialSkuIds: ['ACC-A', 'ACC-B'],
  purchaseOrders: [
    { orderNo: 'PO-A', materialSkuIds: ['ACC-A'], orderedAt: '2026-08-01 09:00:00' },
    { orderNo: 'PO-B', materialSkuIds: ['ACC-B'], orderedAt: '2026-08-02 16:30:00' },
  ],
})
assert.equal(planShape.completed, true)
assert.equal(planShape.completedAt, '2026-08-02 16:30:00')

const missing = evaluateAccessoryPurchaseCompletion({
  requiredMaterialSkuIds: ['ACC-A', 'ACC-B'],
  purchaseOrders: [facts[0]!],
})
assert.equal(missing.complete, false)
assert.match(missing.blockReason, /ACC-B/)

for (const [order, expected] of [
  [{ ...facts[0]!, orderedAt: '' }, /实际下单时间/],
  [{ ...facts[0]!, status: '已作废' as const }, /无效|作废/],
] as const) {
  const result = evaluateAccessoryPurchaseCompletion({ requiredMaterialSkuIds: ['ACC-A'], purchaseOrders: [order] })
  assert.equal(result.complete, false)
  assert.match(result.blockReason, expected)
}

resetStyleArchiveRepository()
resetEngineeringMasterRepository()
resetEngineeringPurchaseOrderFacts()
const style = listStyleArchives()[0]
assert.ok(style)
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserId: 'USER-M-A',
  merchandiserName: '跟单A',
  createdById: 'USER-M-A', createdBy: '跟单A', createdByRole: '跟单', preparationType: 'PURE_WOVEN',
  qualificationFact: { styleCode: style.styleCode, formalSaleStatus: 'NO_FORMAL_SALE', formalProductionStatus: 'NO_FORMAL_PRODUCTION', formalSaleSource: '正式销售订单', formalProductionSource: '正式生产单', checkedAt: '2026-08-04 09:00:00' },
  bulkProductionQualification: { basisType: 'TEST_APPROVED', triggerBusinessObjectType: '测款结果', triggerBusinessObjectId: 'TEST-PURCHASE', thresholdQuantity: 300, reachedQuantity: 320, reachedAt: '2026-08-04 09:00:00', reason: '已满足做大货要求', uniqueTriggerKey: 'TEST-PURCHASE' }, creationReason: '跟单核实创建',
}).masterOrderId)
const taskId = `${master.masterOrderId}-ACCESSORY_PURCHASE`
const bomLinked = applyBomRequirementsToEngineeringTasks(master.masterOrderId, [
  { bomItemId: 'BOM-ACC-A', materialSkuId: 'ACC-A', materialName: '拉链', materialType: '辅料', purchaseRequirement: '是' },
  { bomItemId: 'BOM-ACC-B', materialSkuId: 'ACC-B', materialName: '纽扣', materialType: '辅料', purchaseRequirement: '是' },
])
assert.deepEqual(
  bomLinked.masterOrder.tasks.find((task) => task.taskId === taskId)?.materialLines.map((line) => line.materialSkuId),
  ['ACC-A', 'ACC-B'],
  '采购覆盖门禁的 requiredMaterialSkuIds 必须来自 BOM 同步到工程采购任务的有效辅料行',
)
assert.throws(
  () => submitEngineeringTaskResult(master.masterOrderId, taskId),
  /只能通过绑定采购单自动完成/,
  '辅料下单任务不得沿用通用提交成果入口',
)
setEngineeringPurchaseOrderFacts(facts.map((fact) => ({ ...fact, styleCode: style.styleCode })))

const first = bindAccessoryPurchaseOrder(master.masterOrderId, taskId, 'PO-A')
assert.equal(first.gate.complete, false)
assert.match(first.gate.blockReason, /ACC-B/)
assert.throws(() => bindAccessoryPurchaseOrder(master.masterOrderId, taskId, 'PO-A'), /重复|已绑定/)
assert.throws(() => bindAccessoryPurchaseOrder(master.masterOrderId, taskId, 'PO-NOT-FOUND'), /不存在/)

setEngineeringPurchaseOrderFacts([
  ...facts.map((fact) => ({ ...fact, styleCode: style.styleCode })),
  { ...facts[0]!, purchaseOrderNo: 'PO-OTHER', styleCode: 'OTHER-SPU' },
  { ...facts[0]!, purchaseOrderNo: 'PO-UNRELATED', styleCode: style.styleCode, materialLines: [{ materialSkuId: 'ACC-X', materialName: '无关物料', quantity: 1, unit: '个' }] },
  { ...facts[0]!, purchaseOrderNo: 'PO-LOCKED', styleCode: style.styleCode, accessible: false },
])
assert.throws(() => bindAccessoryPurchaseOrder(master.masterOrderId, taskId, 'PO-OTHER'), /当前款式/)
assert.throws(() => bindAccessoryPurchaseOrder(master.masterOrderId, taskId, 'PO-UNRELATED'), /任务所需物料/)
const beforeDeniedBind = getEngineeringMasterOrderById(master.masterOrderId)
assert.throws(() => bindAccessoryPurchaseOrder(master.masterOrderId, taskId, 'PO-LOCKED'), /无权读取/)
assert.deepEqual(getEngineeringMasterOrderById(master.masterOrderId), beforeDeniedBind, '无权采购单绑定失败不得改写任务或绑定快照')

const second = bindAccessoryPurchaseOrder(master.masterOrderId, taskId, 'PO-B')
assert.equal(second.gate.complete, true)
assert.equal(second.task.status, '已完成')
assert.equal(second.task.effectiveCompletedAt, '2026-08-02 16:30:00')
assert.equal(getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find((task) => task.taskId === taskId)?.effectiveCompletedAt, '2026-08-02 16:30:00')

// 普通读取只计算，不应暗中写回；显式 reconcile 才根据最新采购事实回退或恢复任务。
updateEngineeringPurchaseOrderFact('PO-B', { orderedAt: '' })
assert.equal(computeAccessoryPurchaseTaskLinkage(master.masterOrderId, taskId).gate.complete, false)
assert.equal(getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find((task) => task.taskId === taskId)?.status, '已完成')
let reconciled = reconcileAccessoryPurchaseTaskLinkage(master.masterOrderId, taskId)
assert.equal(reconciled.task.status, '进行中')
assert.equal(reconciled.task.completedAt, '')
assert.equal(reconciled.task.effectiveCompletedAt, '')
assert.ok(reconciled.task.startedAt, '仍有绑定单时必须保留真实开始时间')

updateEngineeringPurchaseOrderFact('PO-B', { orderedAt: '2026-08-02 16:30:00' })
reconciled = reconcileAccessoryPurchaseTaskLinkage(master.masterOrderId, taskId)
assert.equal(reconciled.task.status, '已完成')
assert.equal(reconciled.task.completedAt, '2026-08-02 16:30:00')

updateEngineeringPurchaseOrderFact('PO-B', { status: '已作废' })
reconciled = reconcileAccessoryPurchaseTaskLinkage(master.masterOrderId, taskId)
assert.equal(reconciled.task.status, '进行中')
assert.equal(reconciled.task.completedAt, '')
updateEngineeringPurchaseOrderFact('PO-B', { status: '已下单' })
assert.equal(reconcileAccessoryPurchaseTaskLinkage(master.masterOrderId, taskId).task.status, '已完成')

removeEngineeringPurchaseOrderFact('PO-B')
reconciled = reconcileAccessoryPurchaseTaskLinkage(master.masterOrderId, taskId)
assert.equal(reconciled.task.status, '进行中')
assert.equal(reconciled.task.effectiveCompletedAt, '')
assert.match(reconciled.gate.blockReason, /PO-B|采购事实/)
setEngineeringPurchaseOrderFacts([
  ...facts.map((fact) => ({ ...fact, styleCode: style.styleCode })),
  { ...facts[0]!, purchaseOrderNo: 'PO-OTHER', styleCode: 'OTHER-SPU' },
  { ...facts[0]!, purchaseOrderNo: 'PO-UNRELATED', styleCode: style.styleCode, materialLines: [{ materialSkuId: 'ACC-X', materialName: '无关物料', quantity: 1, unit: '个' }] },
  { ...facts[0]!, purchaseOrderNo: 'PO-LOCKED', styleCode: style.styleCode, accessible: false },
])
assert.equal(reconcileAccessoryPurchaseTaskLinkage(master.masterOrderId, taskId).task.status, '已完成')

// 已绑定采购单后来失去读取权限时，门禁必须回退，且领域返回和页面均不得泄露采购事实详情。
updateEngineeringPurchaseOrderFact('PO-B', {
  accessible: false,
  supplierName: '权限撤销后的秘密供应商',
  orderedAt: '2099-12-31 23:59:59',
  materialLines: [{ materialSkuId: 'ACC-B', materialName: '权限撤销后的秘密物料', quantity: 987654321, unit: '秘密单位' }],
})
const deniedAfterBinding = reconcileAccessoryPurchaseTaskLinkage(master.masterOrderId, taskId)
assert.equal(deniedAfterBinding.task.status, '进行中')
assert.equal(deniedAfterBinding.task.completedAt, '')
assert.equal(deniedAfterBinding.task.effectiveCompletedAt, '')
assert.match(deniedAfterBinding.gate.blockReason, /无权读取.*PO-B/)
assert.deepEqual(
  deniedAfterBinding.purchaseOrders.find((order) => order.purchaseOrderNo === 'PO-B'),
  { purchaseOrderNo: 'PO-B', accessStatus: '无权读取' },
  '无权采购单的只读领域视图只能保留单号和访问状态',
)
const deniedHtml = renderPcsPurchaseTaskDetailPage(taskId)
assert.match(deniedHtml, /PO-B/)
assert.match(deniedHtml, /无权读取/)
assert.doesNotMatch(deniedHtml, /权限撤销后的秘密供应商/)
assert.doesNotMatch(deniedHtml, /权限撤销后的秘密物料/)
assert.doesNotMatch(deniedHtml, /987654321/)
assert.doesNotMatch(deniedHtml, /秘密单位/)
assert.doesNotMatch(deniedHtml, /2099-12-31 23:59:59/)

updateEngineeringPurchaseOrderFact('PO-B', { accessible: true, orderedAt: '2026-08-02 16:30:00' })
const restoredAfterBinding = reconcileAccessoryPurchaseTaskLinkage(master.masterOrderId, taskId)
assert.equal(restoredAfterBinding.task.status, '已完成')
assert.equal(restoredAfterBinding.task.completedAt, '2026-08-02 16:30:00')
const restoredOrder = restoredAfterBinding.purchaseOrders.find((order) => order.purchaseOrderNo === 'PO-B')
assert.equal(restoredOrder?.accessStatus, '可读取')
assert.match(restoredOrder?.accessStatus === '可读取' ? restoredOrder.supplierName : '', /秘密供应商/)
const restoredHtml = renderPcsPurchaseTaskDetailPage(taskId)
assert.match(restoredHtml, /权限撤销后的秘密供应商/)
assert.match(restoredHtml, /权限撤销后的秘密物料/)
assert.match(restoredHtml, /987654321/)
assert.match(restoredHtml, /2026-08-02 16:30:00/)

const afterUnbind = unbindAccessoryPurchaseOrder({ masterOrderId: master.masterOrderId, taskId, purchaseOrderNo: 'PO-B', operatorId: 'BUYER-1', operatorName: '采购员A', operatorRole: '采购人员', reason: '采购单绑定错误' })
assert.equal(afterUnbind.gate.complete, false)
assert.equal(afterUnbind.task.status, '进行中')
assert.equal(afterUnbind.task.effectiveCompletedAt, '')

const html = renderPcsPurchaseTaskDetailPage(taskId)
assert.match(html, /name="purchaseOrderNo"/)
assert.match(html, /绑定采购单/)
assert.match(html, /供应商/)
assert.match(html, /实际下单时间/)
assert.match(html, /每页条数|第 1 页/)
assert.doesNotMatch(html, /新增采购单|编辑采购单|审核采购单|取消采购单/)

let preventDefaultCalled = false
const input = { value: 'PO-B' }
const host = { innerHTML: '' }
const summaryHost = { innerHTML: '' }
const feedback = { textContent: '' }
const originalDocument = globalThis.document
const originalWindow = globalThis.window
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    querySelector(selector: string) {
      if (selector === '[data-purchase-order-input]') return input
      if (selector === '[data-purchase-linkage-region]') return host
      if (selector === '[data-purchase-summary-region]') return summaryHost
      if (selector === '[data-purchase-feedback]') return feedback
      return null
    },
  },
})
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { confirm: () => true, prompt: () => '重新选择采购单' },
})
const handled = handlePurchaseTaskEvent({
  closest(selector: string) {
    if (selector !== '[data-purchase-action]') return null
    return { dataset: { purchaseAction: 'bind-order', masterOrderId: master.masterOrderId, taskId } }
  },
} as unknown as HTMLElement, { preventDefault() { preventDefaultCalled = true } } as unknown as Event)
assert.equal(handled, true)
assert.equal(preventDefaultCalled, true)
assert.match(host.innerHTML, /PO-B/)
assert.match(feedback.textContent, /已绑定/)
assert.match(summaryHost.innerHTML, /已完成/)
assert.match(summaryHost.innerHTML, /2026-08-02 16:30:00/)

updateEngineeringPurchaseOrderFact('PO-B', { status: '已作废' })
reconcileAndRefreshPurchaseTaskRegions(master.masterOrderId, taskId)
assert.match(summaryHost.innerHTML, /进行中/)
assert.doesNotMatch(summaryHost.innerHTML, /2026-08-02 16:30:00/)
assert.match(host.innerHTML, /已作废/)

updateEngineeringPurchaseOrderFact('PO-B', { status: '已下单' })
reconcileAndRefreshPurchaseTaskRegions(master.masterOrderId, taskId)
assert.match(summaryHost.innerHTML, /已完成/)
handlePurchaseTaskEvent({
  closest(selector: string) {
    if (selector !== '[data-purchase-action]') return null
    return { dataset: { purchaseAction: 'unbind-order', masterOrderId: master.masterOrderId, taskId, purchaseOrderNo: 'PO-B' } }
  },
} as unknown as HTMLElement, { preventDefault() {} } as unknown as Event)
assert.match(summaryHost.innerHTML, /进行中/)
assert.doesNotMatch(summaryHost.innerHTML, /2026-08-02 16:30:00/)

const unboundAll = unbindAccessoryPurchaseOrder({ masterOrderId: master.masterOrderId, taskId, purchaseOrderNo: 'PO-A', operatorId: 'BUYER-1', operatorName: '采购员A', operatorRole: '采购人员', reason: '重新选择采购单' })
assert.equal(unboundAll.task.status, '待开始')
assert.equal(unboundAll.task.startedAt, '')
Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })
Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })

console.log('pcs-engineering-purchase-linkage.spec.ts PASS')
