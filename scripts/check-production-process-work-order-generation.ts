import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { getDyeWorkOrderById, getDyeWorkOrderByTaskId } from '../src/data/fcs/dyeing-task-domain.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import {
  getProcessWorkOrderById,
  listProcessWorkOrders,
  type ProcessWorkOrder,
} from '../src/data/fcs/process-work-order-domain.ts'
import { getPrintWorkOrderById, getPrintWorkOrderByTaskId } from '../src/data/fcs/printing-task-domain.ts'

const serviceModule = await import('../src/data/fcs/production-process-work-order-service.ts').catch(() => null)
assert(serviceModule, '缺少正式生产单自动生成加工单服务')

const {
  ensureProcessWorkOrdersForFormalProductionOrder,
} = serviceModule

const baseSnapshot = {
  orderedAt: '2026-07-15 18:30:00',
  techPackVersionId: 'TPV-FORMAL-001',
  techPackVersionLabel: '正式版 V3',
  materialId: 'MAT-FABRIC-001',
  materialName: '40S 精梳棉针织布',
  targetColor: '雾霾蓝',
  plannedQty: 1280,
  qtyUnit: '米',
}

const dyeOnly = {
  ...baseSnapshot,
  productionOrderId: 'PO-AUTO-DYE-001',
  productionOrderNo: 'PO-AUTO-DYE-001',
  processCodes: ['DYE'],
  dyeProcessName: '成衣染色',
  factoryId: 'FACTORY-DYE-001',
  factoryName: '雅加达染色一厂',
}
const printOnly = {
  ...baseSnapshot,
  productionOrderId: 'PO-AUTO-PRINT-001',
  productionOrderNo: 'PO-AUTO-PRINT-001',
  targetColor: '米白底蓝花',
  processCodes: ['PRINT'],
  printProcessName: '数码印花',
  factoryId: 'FACTORY-PRINT-001',
  factoryName: '万隆印花一厂',
}
const dyeAndPrint = {
  ...baseSnapshot,
  productionOrderId: 'PO-AUTO-COMBINED-001',
  productionOrderNo: 'PO-AUTO-COMBINED-001',
  processCodes: ['DYE', 'PRINT'],
  dyeProcessName: '匹染',
  printProcessName: '数码印花',
}

const beforeDyeCount = listProcessWorkOrders('DYE').length
const beforePrintCount = listProcessWorkOrders('PRINT').length

const dyeOnlyFirst = ensureProcessWorkOrdersForFormalProductionOrder(dyeOnly)
const printOnlyFirst = ensureProcessWorkOrdersForFormalProductionOrder(printOnly)
const combinedFirst = ensureProcessWorkOrdersForFormalProductionOrder(dyeAndPrint)

assert(dyeOnlyFirst.dyeWorkOrderId, '仅染色生产单应生成一张染色加工单')
assert(!dyeOnlyFirst.printWorkOrderId, '仅染色生产单不应生成印花加工单')
assert(printOnlyFirst.printWorkOrderId, '仅印花生产单应生成一张印花加工单')
assert(!printOnlyFirst.dyeWorkOrderId, '仅印花生产单不应生成染色加工单')
assert(combinedFirst.dyeWorkOrderId, '染色+印花生产单应生成染色加工单')
assert(combinedFirst.printWorkOrderId, '染色+印花生产单应生成印花加工单')
assert.equal(listProcessWorkOrders('DYE').length, beforeDyeCount + 2, '三种快照首次触发后应新增两张染色加工单')
assert.equal(listProcessWorkOrders('PRINT').length, beforePrintCount + 2, '三种快照首次触发后应新增两张印花加工单')

const firstIdentities = [dyeOnlyFirst, printOnlyFirst, combinedFirst]
  .flatMap((result) => [result.dyeWorkOrderId, result.printWorkOrderId])
  .filter((id): id is string => Boolean(id))
  .map((id) => {
    const order = getProcessWorkOrderById(id)
    assert(order, `${id} 必须能从平台统一领域读取`)
    return [order.workOrderId, order.workOrderNo]
  })

const dyeOnlySecond = ensureProcessWorkOrdersForFormalProductionOrder(dyeOnly)
const printOnlySecond = ensureProcessWorkOrdersForFormalProductionOrder(printOnly)
const combinedSecond = ensureProcessWorkOrdersForFormalProductionOrder(dyeAndPrint)
assert.deepEqual(dyeOnlySecond, dyeOnlyFirst, '同一生产单再次触发必须返回原染色加工单身份')
assert.deepEqual(printOnlySecond, printOnlyFirst, '同一生产单再次触发必须返回原印花加工单身份')
assert.deepEqual(combinedSecond, combinedFirst, '同一生产单再次触发必须返回原染色/印花加工单身份')
assert.equal(listProcessWorkOrders('DYE').length, beforeDyeCount + 2, '幂等触发不得新增染色加工单')
assert.equal(listProcessWorkOrders('PRINT').length, beforePrintCount + 2, '幂等触发不得新增印花加工单')
assert.deepEqual(
  firstIdentities,
  [dyeOnlySecond, printOnlySecond, combinedSecond]
    .flatMap((result) => [result.dyeWorkOrderId, result.printWorkOrderId])
    .filter((id): id is string => Boolean(id))
    .map((id) => {
      const order = getProcessWorkOrderById(id)
      assert(order)
      return [order.workOrderId, order.workOrderNo]
    }),
  '幂等触发不得重新编号',
)

function assertGeneratedOrder(orderId: string, source: typeof dyeAndPrint, processType: 'DYE' | 'PRINT'): void {
  const order = getProcessWorkOrderById(orderId)
  assert(order, `${orderId} 缺少统一加工单`)
  assert.equal(order.processType, processType)
  assert.equal(order.sourceProductionOrderId, source.productionOrderId, '加工单必须保存唯一来源生产单')
  assert.deepEqual(order.productionOrderIds, [source.productionOrderId], '加工单来源生产单集合只能有一项')
  assert.deepEqual(order.sourceDemandIds, [], '正式生产单直生加工单不得生成染色/印花需求单号')
  assert.deepEqual(order.formalProductionOrderSnapshot, {
    productionOrderId: source.productionOrderId,
    productionOrderNo: source.productionOrderNo,
    orderedAt: source.orderedAt,
    techPackVersionId: source.techPackVersionId,
    techPackVersionLabel: source.techPackVersionLabel,
    materialId: source.materialId,
    materialName: source.materialName,
    targetColor: source.targetColor,
    plannedQty: source.plannedQty,
    qtyUnit: source.qtyUnit,
    processCodes: source.processCodes,
    processName: processType === 'DYE' ? source.dyeProcessName : source.printProcessName,
  }, '加工单必须保存正式技术包、BOM 面料、颜色、工艺、数量、单位与下单时间快照')
}

assertGeneratedOrder(dyeOnlyFirst.dyeWorkOrderId!, dyeOnly, 'DYE')
assertGeneratedOrder(printOnlyFirst.printWorkOrderId!, printOnly, 'PRINT')
assertGeneratedOrder(combinedFirst.dyeWorkOrderId!, dyeAndPrint, 'DYE')
assertGeneratedOrder(combinedFirst.printWorkOrderId!, dyeAndPrint, 'PRINT')

for (const orderId of [combinedFirst.dyeWorkOrderId!, combinedFirst.printWorkOrderId!]) {
  const order = getProcessWorkOrderById(orderId) as ProcessWorkOrder
  assert.equal(order.factoryId, '', '未传工厂不得伪造测试工厂')
  assert.equal(order.factoryName, '待分配工厂', '未传工厂应明确待分配')
  assert.equal(order.statusLabel, '待分配工厂', '未传工厂状态标签应明确待分配')
}

const pdaTasks = listPdaGenericProcessTasks()
for (const orderId of [dyeOnlyFirst.dyeWorkOrderId!, combinedFirst.dyeWorkOrderId!]) {
  const factoryOrder = getDyeWorkOrderById(orderId)
  assert(factoryOrder, `${orderId} 未原样注册给染色领域`)
  assert.deepEqual(
    getDyeWorkOrderByTaskId(factoryOrder.taskId) && [factoryOrder.dyeOrderId, factoryOrder.dyeOrderNo],
    [factoryOrder.dyeOrderId, factoryOrder.dyeOrderNo],
  )
  const pdaTask = pdaTasks.find((task) => task.taskId === factoryOrder.taskId)
  assert(pdaTask, `${orderId} 未注册 PDA 任务`)
  assert.deepEqual(
    [pdaTask.taskId, pdaTask.taskNo],
    [factoryOrder.dyeOrderId, factoryOrder.dyeOrderNo],
    '染色加工单 ID/单号必须原样注册给 PDA',
  )
}
for (const orderId of [printOnlyFirst.printWorkOrderId!, combinedFirst.printWorkOrderId!]) {
  const factoryOrder = getPrintWorkOrderById(orderId)
  assert(factoryOrder, `${orderId} 未原样注册给印花领域`)
  assert.deepEqual(
    getPrintWorkOrderByTaskId(factoryOrder.taskId) && [factoryOrder.printOrderId, factoryOrder.printOrderNo],
    [factoryOrder.printOrderId, factoryOrder.printOrderNo],
  )
  const pdaTask = pdaTasks.find((task) => task.taskId === factoryOrder.taskId)
  assert(pdaTask, `${orderId} 未注册 PDA 任务`)
  assert.deepEqual(
    [pdaTask.taskId, pdaTask.taskNo],
    [factoryOrder.printOrderId, factoryOrder.printOrderNo],
    '印花加工单 ID/单号必须原样注册给 PDA',
  )
}

const demandDomainSource = readFileSync(new URL('../src/pages/production/demand-domain.ts', import.meta.url), 'utf8')
assert(
  demandDomainSource.includes("from '../../data/fcs/production-process-work-order-service.ts'"),
  '生产需求领域必须接入正式生产单自动生成加工单服务',
)
const applyCreatedStart = demandDomainSource.indexOf('function applyCreatedProductionOrderGroups')
const openCreatedStart = demandDomainSource.indexOf('function openCreatedProductionOrders', applyCreatedStart)
const applyCreatedSource = demandDomainSource.slice(applyCreatedStart, openCreatedStart)
const writeOrdersAt = applyCreatedSource.indexOf('state.orders =')
const ensureOrdersAt = applyCreatedSource.indexOf('ensureProcessWorkOrdersForFormalProductionOrder')
assert(writeOrdersAt >= 0 && ensureOrdersAt > writeOrdersAt, '必须先写入生产单，再自动生成加工单')
assert(applyCreatedSource.includes('techPackSnapshot.processEntries'), '正式快照必须读取生产单技术包工艺')
assert(applyCreatedSource.includes('techPackSnapshot.bomItems'), '正式快照必须读取生产单 BOM 面料')

console.log('生产单自动生成加工单检查通过')
