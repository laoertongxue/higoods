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
  evaluateAccessoryPurchaseCompletion,
  resetEngineeringPurchaseOrderFacts,
  setEngineeringPurchaseOrderFacts,
  unbindAccessoryPurchaseOrder,
} from '../src/data/pcs-engineering-purchase-linkage.ts'
import {
  handlePurchaseTaskEvent,
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
  merchandiserName: '跟单A',
}).masterOrderId)
const taskId = `${master.masterOrderId}-ACCESSORY_PURCHASE`
const bomLinked = applyBomRequirementsToEngineeringTasks(master.masterOrderId, [
  { bomItemId: 'BOM-ACC-A', materialSkuId: 'ACC-A', materialName: '拉链', materialType: '辅料' },
  { bomItemId: 'BOM-ACC-B', materialSkuId: 'ACC-B', materialName: '纽扣', materialType: '辅料' },
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
])
assert.throws(() => bindAccessoryPurchaseOrder(master.masterOrderId, taskId, 'PO-OTHER'), /当前款式/)
assert.throws(() => bindAccessoryPurchaseOrder(master.masterOrderId, taskId, 'PO-UNRELATED'), /任务所需物料/)

const second = bindAccessoryPurchaseOrder(master.masterOrderId, taskId, 'PO-B')
assert.equal(second.gate.complete, true)
assert.equal(second.task.status, '已完成')
assert.equal(second.task.effectiveCompletedAt, '2026-08-02 16:30:00')
assert.equal(getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find((task) => task.taskId === taskId)?.effectiveCompletedAt, '2026-08-02 16:30:00')

const afterUnbind = unbindAccessoryPurchaseOrder(master.masterOrderId, taskId, 'PO-B')
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
const feedback = { textContent: '' }
const originalDocument = globalThis.document
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    querySelector(selector: string) {
      if (selector === '[data-purchase-order-input]') return input
      if (selector === '[data-purchase-linkage-region]') return host
      if (selector === '[data-purchase-feedback]') return feedback
      return null
    },
  },
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
Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })

console.log('pcs-engineering-purchase-linkage.spec.ts PASS')
