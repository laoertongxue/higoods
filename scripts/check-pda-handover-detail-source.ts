import assert from 'node:assert/strict'

import { createDyeWorkOrderFromStock, listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import { createPrintWorkOrderFromStock, listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { listPdaGenericProcessTasks, registerPdaGenericProcessTask } from '../src/data/fcs/pda-task-mock-factory.ts'
import { listHandoverOrdersByTaskId } from '../src/data/fcs/pda-handover-events.ts'
import { submitDyeHandover, submitPrintHandover } from '../src/data/fcs/process-execution-writeback.ts'
import { renderPdaHandoverDetailPage } from '../src/pages/pda-handover-detail.ts'

function markTaskStarted(taskId: string): void {
  const task = listPdaGenericProcessTasks().find((item) => item.taskId === taskId)
  assert(task, `未找到 PDA 任务：${taskId}`)
  registerPdaGenericProcessTask({ ...task, startedAt: task.startedAt || '2026-07-15 10:00:00' })
}

function renderTaskHandoverDetail(taskId: string): string {
  const head = listHandoverOrdersByTaskId(taskId)[0]
  assert(head, `任务未生成交出单：${taskId}`)
  return renderPdaHandoverDetailPage(head.handoverId)
}

function assertStockDetail(html: string, materialId: string, materialName: string, label: string): void {
  assert.match(html, /备货物料/, `${label}详情必须显示备货物料标签`)
  assert.match(html, new RegExp(materialId), `${label}详情必须显示备货物料 ID`)
  assert.match(html, new RegExp(materialName), `${label}详情必须显示备货物料名称`)
  assert.doesNotMatch(html, /生产单号/, `${label}详情不得显示空生产单号标签`)
  assert.doesNotMatch(html, /undefined/, `${label}详情不得渲染 undefined`)
}

function assertProductionDetail(html: string, productionOrderNo: string, label: string): void {
  assert.match(html, /生产单号/, `${label}详情必须显示生产单号标签`)
  assert.match(html, new RegExp(productionOrderNo), `${label}详情必须显示生产单号`)
  assert.doesNotMatch(html, /备货物料/, `${label}详情不得回退成备货来源`)
  assert.doesNotMatch(html, /undefined/, `${label}详情不得渲染 undefined`)
}

const printOrders = listPrintWorkOrders()
const stockPrint = createPrintWorkOrderFromStock({
  stockMaterialId: 'STOCK-PRINT-DETAIL-001',
  stockMaterialName: '详情检查印花基布',
  materialSku: 'MAT-PRINT-DETAIL-001',
  factoryId: printOrders[0]!.printFactoryId,
  plannedQty: 48,
  qtyUnit: '米',
  plannedFinishAt: '2026-07-31 18:00',
  processName: '数码印花',
})
assert(stockPrint.ok && stockPrint.order, '备货印花加工单创建失败')
markTaskStarted(stockPrint.order.taskId)
submitPrintHandover(stockPrint.order.taskId, { submittedQty: stockPrint.order.plannedQty })
assertStockDetail(renderTaskHandoverDetail(stockPrint.order.taskId), 'STOCK-PRINT-DETAIL-001', '详情检查印花基布', '备货印花')

const dyeOrders = listDyeWorkOrders()
const stockDye = createDyeWorkOrderFromStock({
  stockMaterialId: 'STOCK-DYE-DETAIL-001',
  stockMaterialName: '详情检查染色坯布',
  materialSku: 'MAT-DYE-DETAIL-001',
  factoryId: dyeOrders[0]!.dyeFactoryId,
  plannedQty: 52,
  qtyUnit: '米',
  plannedFinishAt: '2026-07-31 18:00',
  processName: '常规染色',
  targetColor: '深海蓝',
})
assert(stockDye.ok && stockDye.order, '备货染色加工单创建失败')
markTaskStarted(stockDye.order.taskId)
submitDyeHandover(stockDye.order.taskId, { submittedQty: stockDye.order.plannedQty })
assertStockDetail(renderTaskHandoverDetail(stockDye.order.taskId), 'STOCK-DYE-DETAIL-001', '详情检查染色坯布', '备货染色')

const productionPrint = printOrders.find((order) => order.sourceType === 'PRODUCTION_ORDER')!
markTaskStarted(productionPrint.taskId)
submitPrintHandover(productionPrint.taskId, { submittedQty: productionPrint.plannedQty })
assertProductionDetail(renderTaskHandoverDetail(productionPrint.taskId), productionPrint.sourceProductionOrderNo!, '生产单印花')

const productionDye = dyeOrders.find((order) => order.sourceType === 'PRODUCTION_ORDER')!
markTaskStarted(productionDye.taskId)
submitDyeHandover(productionDye.taskId, { submittedQty: productionDye.plannedQty })
assertProductionDetail(renderTaskHandoverDetail(productionDye.taskId), productionDye.sourceProductionOrderNo!, '生产单染色')

console.log('check:pda-handover-detail-source passed')
