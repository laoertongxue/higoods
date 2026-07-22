import assert from 'node:assert/strict'

import { createDyeWorkOrderFromStock, listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import { createPrintWorkOrderFromStock, listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { listPdaGenericProcessTasks, registerPdaGenericProcessTask } from '../src/data/fcs/pda-task-mock-factory.ts'
import { getPdaHandoverRecordsByHead, listHandoverOrdersByTaskId } from '../src/data/fcs/pda-handover-events.ts'
import { submitDyeHandover, submitPrintHandover } from '../src/data/fcs/process-execution-writeback.ts'
import { renderPdaHandoverDetailPage } from '../src/pages/pda-handover-detail.ts'
import { listFactoryMasterRecords } from '../src/data/fcs/factory-master-store.ts'
import { listProcessWorkOrderStockMaterials } from '../src/data/fcs/process-work-order-stock.ts'
import { ensureProcessWorkOrders } from '../src/data/fcs/process-work-order-generation-service.ts'
import {
  buildInboundRecordFromHandoverReceive,
  buildOutboundRecordFromHandoverRecord,
  buildFactoryWaitHandoverStockItemFromOutbound,
  buildFactoryWaitProcessStockItemFromInboundRecord,
  findFactoryInternalWarehouseByFactoryAndKind,
} from '../src/data/fcs/factory-internal-warehouse.ts'
import { mockFactories } from '../src/data/fcs/factory-mock-data.ts'

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

const supplementSource = {
  sourceType: 'CUT_PIECE_SUPPLEMENT' as const,
  productionOrderId: 'PO-PDA-SUP-001',
  productionOrderNo: 'PO-PDA-SUP-001',
  techPackVersionId: 'TPV-PDA-SUP-001',
  techPackVersionLabel: '正式版 V1',
  bomItemId: 'BOM-PDA-SUP-001',
  bomItemIds: ['BOM-PDA-SUP-001'],
  supplementRecordId: 'SUP-PDA-001',
  supplementRecordNo: 'BL-PDA-001',
  originalCutOrderId: 'CUT-PDA-001',
  originalCutOrderNo: 'CP-PDA-001',
}
const supplementDye = ensureProcessWorkOrders({
  source: supplementSource,
  processCodes: ['DYE'],
  orderedAt: '2026-07-23 10:00:00',
  materialId: 'MAT-PDA-SUP-001',
  materialName: '补料针织布',
  materialItems: [{ sourceBomItemId: 'BOM-PDA-SUP-001', materialId: 'MAT-PDA-SUP-001', materialName: '补料针织布' }],
  targetColor: '黑色',
  plannedQty: 12,
  qtyUnit: '米',
  dyeProcessName: '匹染',
  factoryId: dyeFactoryId,
  factoryName: '全能力测试工厂',
  spuCode: 'SPU-PDA-SUP-001',
  spuName: '补料追溯测试款',
  requiredDeliveryDate: '2026-07-31',
})
assert(supplementDye.dyeWorkOrderId, '补料染色加工单创建失败')
markTaskStarted(supplementDye.dyeWorkOrderId)
submitDyeHandover(supplementDye.dyeWorkOrderId, { submittedQty: 12 })
const supplementHead = listHandoverOrdersByTaskId(supplementDye.dyeWorkOrderId)[0]
assert.equal(supplementHead?.sourceType, 'CUT_PIECE_SUPPLEMENT')
assert.equal(supplementHead?.productionOrderNo, supplementSource.productionOrderNo)
assert.deepEqual(supplementHead?.sourceSnapshot, supplementSource, '补料交出单必须完整保留补料、原裁片单和生产单来源')
const supplementHtml = renderTaskHandoverDetail(supplementDye.dyeWorkOrderId)
assert.match(supplementHtml, /补料单/)
assert.match(supplementHtml, /BL-PDA-001/)
assert.match(supplementHtml, /CP-PDA-001/)
const supplementRecord = getPdaHandoverRecordsByHead(supplementHead!.handoverId)[0]!
const supplementFactory = mockFactories.find((factory) => factory.id === dyeFactoryId)!
const supplementWarehouse = findFactoryInternalWarehouseByFactoryAndKind(dyeFactoryId, 'WAIT_HANDOVER')!
const supplementOutbound = buildOutboundRecordFromHandoverRecord(supplementHead!, supplementRecord, supplementFactory, supplementWarehouse)
assert.equal(supplementOutbound?.sourceType, 'CUT_PIECE_SUPPLEMENT')
assert.equal(supplementOutbound?.productionOrderNo, supplementSource.productionOrderNo)
assert.deepEqual(supplementOutbound?.sourceSnapshot, supplementSource, '补料出库记录必须完整保留来源快照')
const supplementWaitHandover = buildFactoryWaitHandoverStockItemFromOutbound(supplementOutbound)
assert.equal(supplementWaitHandover?.sourceType, 'CUT_PIECE_SUPPLEMENT')
assert.deepEqual(supplementWaitHandover?.sourceSnapshot, supplementSource, '补料待交出库存必须完整保留来源快照')
const supplementWaitProcessWarehouse = findFactoryInternalWarehouseByFactoryAndKind(dyeFactoryId, 'WAIT_PROCESS')!
const supplementInbound = buildInboundRecordFromHandoverReceive(
  supplementHead!,
  supplementRecord,
  supplementFactory,
  supplementWaitProcessWarehouse,
)
assert.equal(supplementInbound.sourceType, 'CUT_PIECE_SUPPLEMENT')
assert.deepEqual(supplementInbound.sourceSnapshot, supplementSource, '补料入库记录必须完整保留来源快照')
const supplementWaitProcess = buildFactoryWaitProcessStockItemFromInboundRecord(supplementInbound)
assert.equal(supplementWaitProcess.sourceType, 'CUT_PIECE_SUPPLEMENT')
assert.deepEqual(supplementWaitProcess.sourceSnapshot, supplementSource, '补料待加工库存必须完整保留来源快照')

console.log('check:pda-handover-detail-source passed')
