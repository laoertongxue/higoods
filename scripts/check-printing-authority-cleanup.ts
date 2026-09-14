import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  completePrintWorkOrderDocument,
  completePrintingWorkOrder,
  formatPrintingSummaryMetric,
  getPrintingWorkOrderById,
  getPrintingWorkOrderSummary,
  handoverPrintingOutput,
  isPrintingWorkOrderBusinessCompleted,
  listPrintingWorkOrders,
  receivePrintingHandover,
  receivePrintingInput,
  resetPrintingWorkOrderBusinessStore,
} from '../src/data/fcs/printing-work-order-business.ts'
import {
  getPrintReviewRecordByOrderId,
  getPrintWorkOrderById as getCanonicalPrintWorkOrderById,
  listPrintMobileExecutionTasks,
  listPrintWorkOrders,
  prepareFormalProductionOrderPrintWorkOrderSync,
  registerFormalProductionOrderPrintWorkOrder,
} from '../src/data/fcs/printing-task-domain.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import { renderCraftPrintingDashboardsPage } from '../src/pages/process-factory/printing/dashboards.ts'
import { renderCraftPrintingWorkOrderDetailPage } from '../src/pages/process-factory/printing/work-order-detail.ts'
import { renderCraftPrintingWorkOrdersPage } from '../src/pages/process-factory/printing/work-orders.ts'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const adapterSource = read('src/data/fcs/printing-work-order-business.ts')

for (const forbidden of [
  'buildSeedRecords',
  'let printingWorkOrders',
  'new Map(',
  'localStorage.',
  'sessionStorage.',
  'indexedDB.',
  'function mutableRecord',
  'function createRecord',
]) {
  assert.ok(!adapterSource.includes(forbidden), `印花页面适配器仍保留独立事实源：${forbidden}`)
}
assert.ok(adapterSource.includes("from './printing-task-domain.ts'"), '印花页面适配器必须只把正式域投影和命令暴露给旧页面')

const currentPageConsumers = [
  'src/pages/process-factory/printing/work-orders.ts',
  'src/pages/process-factory/printing/work-order-detail.ts',
  'src/pages/process-factory/printing/dialogs.ts',
  'src/pages/process-factory/printing/events.ts',
  'src/pages/process-factory/printing/dashboards.ts',
  'src/pages/process-factory/printing/statistics.ts',
  'src/pages/process-factory/printing/pending-review.ts',
  'src/pages/print/templates/printing-work-order-template.ts',
]
for (const path of currentPageConsumers) {
  const source = read(path)
  assert.ok(source.includes('printing-work-order-business.ts')||source.includes('printing-statistics.ts'), `${path} 必须读取唯一印花事实或其统计投影`)
  assert.ok(!/new Map.*[Oo]rderStore|localStorage.*workOrders/.test(source), `${path} 不得新增页面事实存储`)
}

resetPrintingWorkOrderBusinessStore()
const pageOrders = listPrintingWorkOrders()
const canonicalOrders = listPrintWorkOrders()
assert.deepEqual(pageOrders.map((order) => order.workOrderId).sort(), canonicalOrders.map((order) => order.printOrderId).sort(), '当前页面必须覆盖全部12旧域单，不能只保留6个精选演示场景')
assert.equal(new Set(pageOrders.map((order) => order.workOrderId)).size, pageOrders.length, '页面演示单不得复用加工单身份')
const demandOccurrenceKey = (order: typeof pageOrders[number]) => [
  order.demandSource.type,
  order.demandSource.sourceNo,
  order.plannedInput.sku,
  order.requirement.frontPattern.patternNo,
  order.requirement.frontPattern.patternVersion,
].join('::')
// Factory test scenarios deliberately reuse the two reference styles/demands;
// their separate task/source identities are checked by check-printing-factory-demos.
const businessOrders = pageOrders.filter(order => !order.workOrderId.startsWith('PWO-PRINT-DEMO-'))
assert.equal(new Set(businessOrders.map(demandOccurrenceKey)).size, businessOrders.length, '相同需求 × 物料 × 花型 occurrence 不得生成两张页面可操作单')
for (const pageOrder of pageOrders) {
  const canonical = getCanonicalPrintWorkOrderById(pageOrder.workOrderId)
  assert.ok(canonical, `${pageOrder.workOrderId} 必须对应正式 PrintWorkOrder`)
  assert.equal(canonical.printOrderNo, pageOrder.printOrderNo, `${pageOrder.workOrderId} 页面和正式域单号必须一致`)
  assert.equal(pageOrder.plannedInput.objectType, canonical.objectType, `${pageOrder.workOrderId} 页面必须沿用正式单的 BOM 对象类别`)
  assert.equal(pageOrder.output.objectType, canonical.objectType, `${pageOrder.workOrderId} 加工产出不得把 BOM 对象类别改写为面料`)
  assert.equal(pageOrder.plannedInput.qtyUnit, canonical.qtyUnit, `${pageOrder.workOrderId} 计划投入必须沿用正式单的 BOM 数量单位`)
  assert.equal(pageOrder.output.qtyUnit, canonical.qtyUnit, `${pageOrder.workOrderId} 完成与交接必须沿用正式单的 BOM 数量单位`)
  assert.equal(canonicalOrders.filter((order) => order.printOrderId === pageOrder.workOrderId).length, 1, `${pageOrder.workOrderId} 在正式域只能有一张可操作单`)
  if (!pageOrder.workOrderId.startsWith('PWO-PRINT-DEMO-')) assert.equal(
    canonicalOrders.filter((order) => !order.printOrderId.startsWith('PWO-PRINT-DEMO-') && order.businessView && demandOccurrenceKey({
      ...pageOrder,
      ...order.businessView,
    }) === demandOccurrenceKey(pageOrder)).length,
    1,
    `${pageOrder.demandSource.sourceNo} 的相同需求 occurrence 在正式域只能出现一次`,
  )
}
assert.ok(pageOrders.every((order) => !/^PWO-\d+$/.test(order.workOrderId)), '旧 PWO-253xx 页面 seed 身份不得继续作为第二套可操作单')
assert.ok(pageOrders.some((order) => order.plannedInput.objectType === '纱线'), '当前页面必须能展示 BOM 纱线印花，不能把对象类型写死为面料')

const occurrenceBase = {
  productionOrderId: 'PO-PRINT-CLEAN-OCCURRENCE',
  productionOrderNo: 'PO-PRINT-CLEAN-OCCURRENCE',
  orderedAt: '2026-09-07 10:00:00',
  techPackVersionId: 'TPV-PRINT-CLEAN',
  techPackVersionLabel: 'V1',
  materialId: 'MAT-PRINT-CLEAN',
  materialName: '专项印花面料',
  materialItems: [{ sourceBomItemId: 'BOM-PRINT-CLEAN', materialId: 'MAT-PRINT-CLEAN', materialName: '专项印花面料', materialType: '面料' }],
  targetColor: '专项色',
  plannedQty: 100,
  qtyUnit: '米',
  processCodes: ['PRINT'] as const,
  printProcessName: '印花',
  spuCode: 'SPU-PRINT-CLEAN',
  spuName: '专项款',
  requiredDeliveryDate: '2026-09-10',
}
registerFormalProductionOrderPrintWorkOrder({
  ...occurrenceBase,
  workOrderId: 'PWO-PRINT-CLEAN-OCC-A', workOrderNo: 'PH-CLEAN-OCC-A', processName: '印花', sourceKey: 'PRINT-CLEAN-OCC-A',
  processEntryId: 'PROCESS-ENTRY-A', routeObjectKey: 'BOM-PRINT-CLEAN-A',
})
registerFormalProductionOrderPrintWorkOrder({
  ...occurrenceBase,
  workOrderId: 'PWO-PRINT-CLEAN-OCC-B', workOrderNo: 'PH-CLEAN-OCC-B', processName: '印花', sourceKey: 'PRINT-CLEAN-OCC-B',
  processEntryId: 'PROCESS-ENTRY-B', routeObjectKey: 'BOM-PRINT-CLEAN-B',
})
const targetedSync = prepareFormalProductionOrderPrintWorkOrderSync({
  ...occurrenceBase,
  plannedQty: 120,
  processEntryId: 'PROCESS-ENTRY-B',
  routeObjectKey: 'BOM-PRINT-CLEAN-B',
  syncTargetWorkOrderId: 'PWO-PRINT-CLEAN-OCC-B',
}, { changeRecordId: 'CHANGE-PRINT-CLEAN-OCC-B', recordedAt: '2026-09-07 11:00:00' })
assert.equal(targetedSync.workOrderId, 'PWO-PRINT-CLEAN-OCC-B', '同生产单多 occurrence 变更必须按目标加工单精确命中')
assert.equal(targetedSync.outcome, 'AUTO_SYNCED')
targetedSync.commit()
assert.equal(getCanonicalPrintWorkOrderById('PWO-PRINT-CLEAN-OCC-A')?.plannedQty, 100, '目标 B 的变更不得串改同生产单 occurrence A')
assert.equal(getCanonicalPrintWorkOrderById('PWO-PRINT-CLEAN-OCC-B')?.plannedQty, 120, '目标 occurrence B 必须更新')
assert.equal(getCanonicalPrintWorkOrderById('PWO-PRINT-CLEAN-OCC-B')?.formalProductionOrderSnapshot?.processEntryId, 'PROCESS-ENTRY-B', '正式快照必须保留工艺节点身份')
assert.equal(getCanonicalPrintWorkOrderById('PWO-PRINT-CLEAN-OCC-B')?.formalProductionOrderSnapshot?.routeObjectKey, 'BOM-PRINT-CLEAN-B', '正式快照必须保留物料路线身份')

const metreOrder = structuredClone(pageOrders[0])
metreOrder.plannedInput.qtyUnit = '米'
metreOrder.output.qtyUnit = '米'
metreOrder.plannedInput.plannedQty = 100
metreOrder.actualInput.usedQty = 80
metreOrder.output.completedQty = 75
metreOrder.handover.handedOverQty = 70
metreOrder.handover.receivedQty = 60
const kilogramOrder = structuredClone(pageOrders[1])
kilogramOrder.plannedInput.qtyUnit = '公斤'
kilogramOrder.output.qtyUnit = '公斤'
kilogramOrder.plannedInput.plannedQty = 20
kilogramOrder.actualInput.usedQty = 18
kilogramOrder.output.completedQty = 16
kilogramOrder.handover.handedOverQty = 14
kilogramOrder.handover.receivedQty = 12
const mixedUnitSummary = getPrintingWorkOrderSummary([metreOrder, kilogramOrder])
assert.equal(mixedUnitSummary.byUnit.length, 2, '不同 BOM 数量单位必须分组统计，不能直接相加')
assert.equal(formatPrintingSummaryMetric(mixedUnitSummary, 'plannedInputQty'), '20.00 公斤 / 100.00 米', '混合单位汇总必须逐单位展示')
assert.ok(!formatPrintingSummaryMetric(mixedUnitSummary, 'plannedInputQty').includes('120'), '公斤与米不得错误汇总成一个数量')

const listHtml = renderCraftPrintingWorkOrdersPage()
for (const required of [
  '综合查询', '加工状态', '交出状态', '需求来源', '售卖类型', '加工厂', '物料类型', '创建方式',
  '需求来源', '加工投入', '加工产出', '印花信息单', '印花确认单', '产出卷条码',
]) {
  assert.ok(listHtml.includes(required), `印花列表收口后遗漏页面契约：${required}`)
}
for (const action of ['change-input', 'open-barcodes']) {
  assert.ok(listHtml.includes(`data-printing-action="${action}"`), `印花列表收口后遗漏动作入口：${action}`)
}

// The canonical command-to-inventory and PDA persistence contract is exercised by the shared full-flow scenario.
await import('./check-printing-factory-alignment.ts')
const projected=getPrintingWorkOrderById('PWO-PRINT-001')!
assert.equal(getCanonicalPrintWorkOrderById(projected.workOrderId)?.businessView?.output.completedQty,projected.output.completedQty)
assert.equal(getPrintReviewRecordByOrderId(projected.workOrderId)?.receivedQty,64)
assert.equal(isPrintingWorkOrderBusinessCompleted(projected),false)
console.log('[check-printing-authority-cleanup] 通过：全部 12 个原域场景均投影自唯一正式 PrintWorkOrder；独立 seed/store 已移除；收齐与人工完单已分离。')
