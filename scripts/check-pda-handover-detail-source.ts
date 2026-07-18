import assert from 'node:assert/strict'

import { createDyeWorkOrderFromStock, listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import { createPrintWorkOrderFromStock, listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { listPdaGenericProcessTasks, registerPdaGenericProcessTask } from '../src/data/fcs/pda-task-mock-factory.ts'
import { listHandoverOrdersByTaskId } from '../src/data/fcs/pda-handover-events.ts'
import { submitDyeHandover, submitPrintHandover } from '../src/data/fcs/process-execution-writeback.ts'
import { renderPdaHandoverDetailPage } from '../src/pages/pda-handover-detail.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { listProcessWorkOrderStockMaterials } from '../src/data/fcs/process-work-order-stock.ts'

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
function getTargetFactoryId(processCode: 'DYE' | 'PRINT'): string {
  const factory = listFactoryMasterRecords()
    .filter((item) => item.status === 'active' && item.eligibility.allowDispatch)
    .find((item) => item.processAbilities.some((ability) => (
      ability.processCode === processCode
      && (ability.status ?? 'ACTIVE') === 'ACTIVE'
      && ability.canReceiveTask !== false
    )))
  assert(factory, `缺少可派单的${processCode === 'DYE' ? '染色' : '印花'}目标工厂`)
  return factory.id
}

const printFactoryId = getTargetFactoryId('PRINT')
const dyeFactoryId = getTargetFactoryId('DYE')
const printStock = listProcessWorkOrderStockMaterials({ factoryId: printFactoryId, processCode: 'PRINT' })[0]
const dyeStock = listProcessWorkOrderStockMaterials({ factoryId: dyeFactoryId, processCode: 'DYE' })[0]
assert(printStock, '缺少当前印花目标工厂的合格备货库存')
assert(dyeStock, '缺少当前染色目标工厂的合格备货库存')
assert.deepEqual(
  [printStock.factoryId, printStock.processCode, printStock.status, printStock.differenceQty],
  [printFactoryId, 'PRINT', '已入待加工仓', 0],
  '印花详情测试必须使用同工厂、同工序、正常入仓且无差异的库存',
)
assert.deepEqual(
  [dyeStock.factoryId, dyeStock.processCode, dyeStock.status, dyeStock.differenceQty],
  [dyeFactoryId, 'DYE', '已入待加工仓', 0],
  '染色详情测试必须使用同工厂、同工序、正常入仓且无差异的库存',
)
assert.notEqual(printStock.stockMaterialId, dyeStock.stockMaterialId, '染色与印花详情测试必须使用各自不同的真实库存来源')

const stockPrint = createPrintWorkOrderFromStock({
  stockMaterialId: printStock.stockMaterialId,
  stockMaterialName: printStock.stockMaterialName,
  materialSku: printStock.materialSku,
  factoryId: printFactoryId,
  plannedQty: 48,
  qtyUnit: printStock.qtyUnit,
  plannedFinishAt: '2026-07-31 18:00',
  processName: '数码印花',
})
assert(stockPrint.ok && stockPrint.order, '备货印花加工单创建失败')
markTaskStarted(stockPrint.order.taskId)
submitPrintHandover(stockPrint.order.taskId, { submittedQty: stockPrint.order.plannedQty })
assertStockDetail(renderTaskHandoverDetail(stockPrint.order.taskId), printStock.stockMaterialId, printStock.stockMaterialName, '备货印花')

const dyeOrders = listDyeWorkOrders()
const stockDye = createDyeWorkOrderFromStock({
  stockMaterialId: dyeStock.stockMaterialId,
  stockMaterialName: dyeStock.stockMaterialName,
  materialSku: dyeStock.materialSku,
  factoryId: dyeFactoryId,
  plannedQty: 52,
  qtyUnit: dyeStock.qtyUnit,
  plannedFinishAt: '2026-07-31 18:00',
  processName: '常规染色',
  targetColor: '深海蓝',
})
assert(stockDye.ok && stockDye.order, '备货染色加工单创建失败')
markTaskStarted(stockDye.order.taskId)
submitDyeHandover(stockDye.order.taskId, { submittedQty: stockDye.order.plannedQty })
assertStockDetail(renderTaskHandoverDetail(stockDye.order.taskId), dyeStock.stockMaterialId, dyeStock.stockMaterialName, '备货染色')

const productionPrint = printOrders.find((order) => order.sourceType === 'PRODUCTION_ORDER')!
markTaskStarted(productionPrint.taskId)
submitPrintHandover(productionPrint.taskId, { submittedQty: productionPrint.plannedQty })
assertProductionDetail(renderTaskHandoverDetail(productionPrint.taskId), productionPrint.sourceProductionOrderNo!, '生产单印花')

const productionDye = dyeOrders.find((order) => order.sourceType === 'PRODUCTION_ORDER')!
markTaskStarted(productionDye.taskId)
submitDyeHandover(productionDye.taskId, { submittedQty: productionDye.plannedQty })
assertProductionDetail(renderTaskHandoverDetail(productionDye.taskId), productionDye.sourceProductionOrderNo!, '生产单染色')

console.log('check:pda-handover-detail-source passed')
