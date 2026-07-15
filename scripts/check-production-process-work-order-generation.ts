import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import { getDyeExecutionRoute, getDyeWorkOrderById, getDyeWorkOrderByTaskId } from '../src/data/fcs/dyeing-task-domain.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import {
  getProcessWorkOrderById,
  listProcessWorkOrders,
  type ProcessWorkOrder,
} from '../src/data/fcs/process-work-order-domain.ts'
import { getPrintWorkOrderById, getPrintWorkOrderByTaskId } from '../src/data/fcs/printing-task-domain.ts'
import { productionOrders, type ProductionOrder } from '../src/data/fcs/production-orders.ts'
import { state } from '../src/pages/production/context.ts'
import {
  applyCreatedProductionOrderGroups,
  type CreatedProductionOrderGroup,
} from '../src/pages/production/demand-domain.ts'
import {
  buildFormalProductionOrderProcessSnapshots,
  ensureProcessWorkOrdersForFormalProductionOrder,
  type FormalProductionOrderProcessSnapshot,
} from '../src/data/fcs/production-process-work-order-service.ts'

const baseSnapshot = {
  orderedAt: '2026-07-15 18:30:00',
  techPackVersionId: 'TPV-FORMAL-001',
  techPackVersionLabel: '正式版 V3',
  materialId: 'MAT-FABRIC-001',
  materialName: '40S 精梳棉针织布',
  targetColor: '雾霾蓝',
  plannedQty: 1280,
  qtyUnit: '米',
  spuCode: 'SPU-FORMAL-001',
  spuName: '正式生产款',
  requiredDeliveryDate: '2026-08-31',
}

const dyeOnly: FormalProductionOrderProcessSnapshot = {
  ...baseSnapshot,
  productionOrderId: 'PO-AUTO-DYE-001',
  productionOrderNo: 'PO-AUTO-DYE-001',
  processCodes: ['DYE'],
  dyeProcessName: '成衣染色',
  factoryId: 'FACTORY-DYE-001',
  factoryName: '雅加达染色一厂',
}
const printOnly: FormalProductionOrderProcessSnapshot = {
  ...baseSnapshot,
  productionOrderId: 'PO-AUTO-PRINT-001',
  productionOrderNo: 'PO-AUTO-PRINT-001',
  targetColor: '米白底蓝花',
  processCodes: ['PRINT'],
  printProcessName: '数码印花',
  factoryId: 'FACTORY-PRINT-001',
  factoryName: '万隆印花一厂',
}
const dyeAndPrint: FormalProductionOrderProcessSnapshot = {
  ...baseSnapshot,
  productionOrderId: 'PO-AUTO-COMBINED-001',
  productionOrderNo: 'PO-AUTO-COMBINED-001',
  processCodes: ['DYE', 'PRINT'],
  dyeProcessName: '匹染',
  printProcessName: '数码印花',
}

const sourceOrder = productionOrders.find((order) => (
  order.techPackSnapshot
  && order.techPackSnapshot.bomItems.length > 0
  && order.techPackSnapshot.processEntries.length > 0
))
assert(sourceOrder?.techPackSnapshot, '缺少可用于真实技术包快照检查的生产单')
const bomTemplate = sourceOrder.techPackSnapshot.bomItems[0]
const processTemplate = sourceOrder.techPackSnapshot.processEntries[0]
const dyeBom = {
  ...bomTemplate,
  id: 'BOM-DYE-001',
  materialCode: 'MAT-DYE-001',
  name: '染色针织布',
  spec: '180g',
  colorLabel: '雾霾蓝',
  unit: '米',
  unitConsumption: 0.5,
  lossRate: 0.1,
}
const printBom = {
  ...bomTemplate,
  id: 'BOM-PRINT-001',
  materialCode: 'MAT-PRINT-001',
  name: '印花裁片',
  spec: '前后幅',
  colorLabel: '米白底蓝花',
  unit: '片',
  unitConsumption: 2,
  lossRate: 0.05,
}
const routeOrder = {
  ...sourceOrder,
  productionOrderId: 'PO-AUTO-ROUTE-001',
  productionOrderNo: 'PO-AUTO-ROUTE-001',
  createdAt: '2026-07-15 19:00:00',
  demandSnapshot: {
    ...sourceOrder.demandSnapshot,
    spuCode: 'SPU-ROUTE-001',
    spuName: '双色工艺连衣裙',
    requiredDeliveryDate: '2026-09-15',
    skuLines: [{ skuCode: 'SKU-ROUTE-001', size: 'M', color: '蓝色', qty: 100 }],
  },
  techPackSnapshot: {
    ...sourceOrder.techPackSnapshot,
    sourceTechPackVersionId: 'TPV-ROUTE-001',
    sourceTechPackVersionLabel: '正式版 V5',
    bomItems: [dyeBom, printBom],
    processEntries: [
      {
        ...processTemplate,
        id: 'PROCESS-DYE-001',
        processCode: 'DYE',
        processName: '匹染',
        linkedBomItemIds: [dyeBom.id],
      },
      {
        ...processTemplate,
        id: 'PROCESS-PRINT-001',
        processCode: 'PRINT',
        processName: '裁片印花',
        linkedBomItemIds: [printBom.id],
      },
    ],
  },
}
const routeSnapshots = buildFormalProductionOrderProcessSnapshots(routeOrder)
assert.deepEqual(
  routeSnapshots.map((snapshot: { processCodes: string[] }) => snapshot.processCodes),
  [['DYE'], ['PRINT']],
  '正式生产单必须按染色和印花分别生成工艺快照',
)
assert.deepEqual(
  routeSnapshots.map((snapshot: typeof baseSnapshot) => ({
    materialId: snapshot.materialId,
    materialName: snapshot.materialName,
    targetColor: snapshot.targetColor,
    plannedQty: snapshot.plannedQty,
    qtyUnit: snapshot.qtyUnit,
  })),
  [
    { materialId: dyeBom.id, materialName: '染色针织布 / 180g', targetColor: '雾霾蓝', plannedQty: 55, qtyUnit: '米' },
    { materialId: printBom.id, materialName: '印花裁片 / 前后幅', targetColor: '米白底蓝花', plannedQty: 210, qtyUnit: '片' },
  ],
  '染色和印花快照必须分别读取其工艺路线绑定的 BOM',
)

const waterSolubleDyeOrder: ProductionOrder = {
  ...routeOrder,
  productionOrderId: 'PO-AUTO-WATER-DYE-001',
  productionOrderNo: 'PO-AUTO-WATER-DYE-001',
  techPackSnapshot: {
    ...routeOrder.techPackSnapshot,
    bomItems: [{ ...dyeBom, waterSolubleRequirement: '是', usageProcessCodes: ['WATER_SOLUBLE', 'DYE'] }],
    processEntries: [{
      ...processTemplate,
      id: 'PROCESS-DYE-WATER-001',
      processCode: 'DYE',
      processName: '水溶后染色',
      linkedBomItemIds: [dyeBom.id],
    }],
  },
}
const waterSolubleDyeSnapshot = buildFormalProductionOrderProcessSnapshots(waterSolubleDyeOrder)[0]
assert.equal(waterSolubleDyeSnapshot?.requiresWaterSoluble, true, '正式生产单染色快照必须从工艺绑定 BOM 的水溶语义推导联合水溶')
const waterSolubleDyeResult = ensureProcessWorkOrdersForFormalProductionOrder(waterSolubleDyeSnapshot!)
const waterSolubleDyeWorkOrder = getDyeWorkOrderById(waterSolubleDyeResult.dyeWorkOrderId!)
assert.equal(waterSolubleDyeWorkOrder?.requiresWaterSoluble, true, '正式生产单统一确保入口必须把水溶语义传给染色加工单')
assert(getDyeExecutionRoute(waterSolubleDyeWorkOrder!.dyeOrderId).includes('WATER_SOLUBLE'), '正式生产单联合水溶染色必须进入单一水溶后染色执行路线')

const secondDyeBom = {
  ...dyeBom,
  id: 'BOM-DYE-002',
  materialCode: 'MAT-DYE-002',
  name: '染色罗纹布',
  spec: '2x2 罗纹',
  colorLabel: '深海蓝',
  unitConsumption: 0.25,
  lossRate: 0,
}
const aggregatedDyeSnapshots = buildFormalProductionOrderProcessSnapshots({
  ...routeOrder,
  productionOrderId: 'PO-AUTO-MULTI-DYE-001',
  productionOrderNo: 'PO-AUTO-MULTI-DYE-001',
  techPackSnapshot: {
    ...routeOrder.techPackSnapshot,
    bomItems: [dyeBom, secondDyeBom],
    processEntries: [{
      ...processTemplate,
      id: 'PROCESS-DYE-MULTI-001',
      processCode: 'DYE',
      processName: '组合面料匹染',
      linkedBomItemIds: [dyeBom.id, secondDyeBom.id],
    }],
  },
})
assert.deepEqual(
  aggregatedDyeSnapshots.map((snapshot) => ({
    materialId: snapshot.materialId,
    materialName: snapshot.materialName,
    targetColor: snapshot.targetColor,
    plannedQty: snapshot.plannedQty,
    qtyUnit: snapshot.qtyUnit,
  })),
  [{
    materialId: 'BOM-DYE-001+BOM-DYE-002',
    materialName: '染色针织布 / 180g、染色罗纹布 / 2x2 罗纹',
    targetColor: '雾霾蓝、深海蓝',
    plannedQty: 80,
    qtyUnit: '米',
  }],
  '同一工艺绑定多个同单位 BOM 时必须按物料用量和损耗明确聚合',
)
assert.throws(
  () => buildFormalProductionOrderProcessSnapshots({
    ...routeOrder,
    productionOrderId: 'PO-AUTO-MIXED-UNIT-001',
    productionOrderNo: 'PO-AUTO-MIXED-UNIT-001',
    techPackSnapshot: {
      ...routeOrder.techPackSnapshot,
      bomItems: [dyeBom, printBom],
      processEntries: [{
        ...processTemplate,
        id: 'PROCESS-DYE-MIXED-UNIT-001',
        processCode: 'DYE',
        processName: '混合单位染色',
        linkedBomItemIds: [dyeBom.id, printBom.id],
      }],
    },
  }),
  /绑定多种或缺失数量单位，无法合并为一张加工单/,
  '同一工艺绑定不同单位 BOM 时必须明确阻断',
)

for (const snapshot of routeSnapshots) ensureProcessWorkOrdersForFormalProductionOrder(snapshot)
const routeDyeOrder = listProcessWorkOrders('DYE').find((order) => order.sourceProductionOrderId === routeOrder.productionOrderId)
const routePrintOrder = listProcessWorkOrders('PRINT').find((order) => order.sourceProductionOrderId === routeOrder.productionOrderId)
assert(routeDyeOrder && routePrintOrder, '不同 BOM 的染色和印花快照必须分别生成加工单')
const routePdaTasks = listPdaGenericProcessTasks()
const routeDyeTask = routePdaTasks.find((task) => task.taskId === routeDyeOrder.taskId)
const routePrintTask = routePdaTasks.find((task) => task.taskId === routePrintOrder.taskId)
assert(routeDyeTask && routePrintTask, '不同 BOM 的加工单必须注册 PDA 任务')
for (const task of [routeDyeTask, routePrintTask]) {
  assert.deepEqual(
    [task.productionOrderId, task.productionOrderNo, task.spuCode, task.spuName, task.requiredDeliveryDate],
    ['PO-AUTO-ROUTE-001', 'PO-AUTO-ROUTE-001', 'SPU-ROUTE-001', '双色工艺连衣裙', '2026-09-15'],
    'PDA 任务必须使用正式生产单的商品与交期快照',
  )
}
assert.deepEqual(
  [routeDyeTask.qtyUnit, routeDyeTask.qtyDisplayUnit],
  ['METER', '米'],
  '染色 PDA 数量单位必须与米一致',
)
assert.deepEqual(
  [routePrintTask.qtyUnit, routePrintTask.qtyDisplayUnit],
  ['PIECE', '片'],
  '印花 PDA 数量单位必须与片一致',
)

assert.throws(
  () => ensureProcessWorkOrdersForFormalProductionOrder({
    ...dyeOnly,
    productionOrderId: 'PO-AUTO-UNKNOWN-001',
    productionOrderNo: 'PO-AUTO-UNKNOWN-001',
    processCodes: JSON.parse('["WASH"]'),
  }),
  /不支持的生产工艺：WASH/,
  '未知工艺不能静默忽略',
)
assert.throws(
  () => ensureProcessWorkOrdersForFormalProductionOrder({
    ...dyeOnly,
    productionOrderId: 'PO-AUTO-LOWERCASE-001',
    productionOrderNo: 'PO-AUTO-LOWERCASE-001',
    processCodes: JSON.parse('["dye"]'),
  }),
  /不支持的生产工艺：dye/,
  '小写工艺码必须明确拒绝，不能校验通过后静默忽略',
)

const transactionDemand = state.demands.find((demand) => !demand.hasProductionOrder)
assert(transactionDemand, '缺少可用于生产单批次事务检查的未转换需求')
const transactionNow = '2026-07-15 20:00:00'
const transactionOrder = {
  ...routeOrder,
  productionOrderId: 'PO-AUTO-TRANSACTION-001',
  productionOrderNo: 'PO-AUTO-TRANSACTION-001',
  demandId: transactionDemand.demandId,
  sourceDemandIds: [transactionDemand.demandId],
}
const missingBomOrder = {
  ...routeOrder,
  productionOrderId: 'PO-AUTO-MISSING-BOM-001',
  productionOrderNo: 'PO-AUTO-MISSING-BOM-001',
  techPackSnapshot: {
    ...routeOrder.techPackSnapshot,
    bomItems: [dyeBom],
    processEntries: [{
      ...processTemplate,
      id: 'PROCESS-DYE-MISSING-BOM-001',
      processCode: 'DYE',
      processName: '缺失物料染色',
      linkedBomItemIds: ['BOM-NOT-FOUND'],
    }],
  },
}
const mixedUnitOrder = {
  ...routeOrder,
  productionOrderId: 'PO-AUTO-TRANSACTION-MIXED-001',
  productionOrderNo: 'PO-AUTO-TRANSACTION-MIXED-001',
  techPackSnapshot: {
    ...routeOrder.techPackSnapshot,
    bomItems: [dyeBom, printBom],
    processEntries: [{
      ...processTemplate,
      id: 'PROCESS-DYE-TRANSACTION-MIXED-001',
      processCode: 'DYE',
      processName: '混合单位染色',
      linkedBomItemIds: [dyeBom.id, printBom.id],
    }],
  },
}
const zeroPlannedQtyOrder = {
  ...routeOrder,
  productionOrderId: 'PO-AUTO-TRANSACTION-ZERO-QTY-001',
  productionOrderNo: 'PO-AUTO-TRANSACTION-ZERO-QTY-001',
  demandSnapshot: {
    ...routeOrder.demandSnapshot,
    skuLines: routeOrder.demandSnapshot.skuLines.map((line) => ({ ...line, qty: 0 })),
  },
  techPackSnapshot: {
    ...routeOrder.techPackSnapshot,
    bomItems: [dyeBom],
    processEntries: [{
      ...processTemplate,
      id: 'PROCESS-DYE-ZERO-QTY-001',
      processCode: 'DYE',
      processName: '零数量染色',
      linkedBomItemIds: [dyeBom.id],
    }],
  },
}
const emptyTechPackVersionOrder = {
  ...routeOrder,
  productionOrderId: 'PO-AUTO-TRANSACTION-EMPTY-TP-001',
  productionOrderNo: 'PO-AUTO-TRANSACTION-EMPTY-TP-001',
  techPackSnapshot: {
    ...routeOrder.techPackSnapshot,
    sourceTechPackVersionId: '',
    sourceTechPackVersionLabel: '',
    versionLabel: '',
    bomItems: [dyeBom],
    processEntries: [{
      ...processTemplate,
      id: 'PROCESS-DYE-EMPTY-TP-001',
      processCode: 'DYE',
      processName: '空版本染色',
      linkedBomItemIds: [dyeBom.id],
    }],
  },
}
const emptyMaterialNameOrder = {
  ...routeOrder,
  productionOrderId: 'PO-AUTO-TRANSACTION-EMPTY-MATERIAL-001',
  productionOrderNo: 'PO-AUTO-TRANSACTION-EMPTY-MATERIAL-001',
  techPackSnapshot: {
    ...routeOrder.techPackSnapshot,
    bomItems: [{ ...dyeBom, name: '', spec: '' }],
    processEntries: [{
      ...processTemplate,
      id: 'PROCESS-DYE-EMPTY-MATERIAL-001',
      processCode: 'DYE',
      processName: '空物料名染色',
      linkedBomItemIds: [dyeBom.id],
    }],
  },
}
const transactionGroup: CreatedProductionOrderGroup = {
  demands: [transactionDemand],
  order: transactionOrder,
}
const transactionOrdersBefore = state.orders.length
const transactionDemandBefore = {
  hasProductionOrder: transactionDemand.hasProductionOrder,
  productionOrderId: transactionDemand.productionOrderId,
  demandStatus: transactionDemand.demandStatus,
  updatedAt: transactionDemand.updatedAt,
}
const transactionDyeCountBefore = listProcessWorkOrders('DYE').length
const transactionPrintCountBefore = listProcessWorkOrders('PRINT').length

function assertFailedBatchLeavesStateUnchanged(invalidOrder: ProductionOrder, errorPattern: RegExp): void {
  const invalidGroup: CreatedProductionOrderGroup = { demands: [], order: invalidOrder }
  assert.throws(
    () => applyCreatedProductionOrderGroups([transactionGroup, invalidGroup], transactionNow),
    errorPattern,
  )
  assert.equal(state.orders.length, transactionOrdersBefore, '批次预校验失败后生产单数量必须不变')
  assert.equal(
    state.orders.some((order) => order.productionOrderId === transactionOrder.productionOrderId),
    false,
    '批次预校验失败后有效生产单也不得部分落库',
  )
  const currentDemand = state.demands.find((demand) => demand.demandId === transactionDemand.demandId)
  assert(currentDemand, '失败后原需求必须仍存在')
  assert.deepEqual({
    hasProductionOrder: currentDemand.hasProductionOrder,
    productionOrderId: currentDemand.productionOrderId,
    demandStatus: currentDemand.demandStatus,
    updatedAt: currentDemand.updatedAt,
  }, transactionDemandBefore, '批次预校验失败后需求状态必须不变')
  assert.equal(listProcessWorkOrders('DYE').length, transactionDyeCountBefore, '失败后染色加工单数量必须不变')
  assert.equal(listProcessWorkOrders('PRINT').length, transactionPrintCountBefore, '失败后印花加工单数量必须不变')
}

assertFailedBatchLeavesStateUnchanged(missingBomOrder, /绑定了不存在的 BOM：BOM-NOT-FOUND/)
assertFailedBatchLeavesStateUnchanged(mixedUnitOrder, /绑定多种或缺失数量单位，无法合并为一张加工单/)
assertFailedBatchLeavesStateUnchanged(zeroPlannedQtyOrder, /正式生产单加工数量和单位必须有效/)
assertFailedBatchLeavesStateUnchanged(emptyTechPackVersionOrder, /正式生产单必须携带已发布技术包版本快照/)
assertFailedBatchLeavesStateUnchanged(emptyMaterialNameOrder, /正式生产单必须携带 BOM 面料快照/)
assertFailedBatchLeavesStateUnchanged(missingBomOrder, /绑定了不存在的 BOM：BOM-NOT-FOUND/)

applyCreatedProductionOrderGroups([transactionGroup], transactionNow)
assert.equal(
  state.orders.filter((order) => order.productionOrderId === transactionOrder.productionOrderId).length,
  1,
  '失败后修正并重试只能落库一张生产单',
)
const convertedTransactionDemand = state.demands.find((demand) => demand.demandId === transactionDemand.demandId)
assert.deepEqual(
  [convertedTransactionDemand?.hasProductionOrder, convertedTransactionDemand?.productionOrderId, convertedTransactionDemand?.demandStatus],
  [true, transactionOrder.productionOrderId, 'CONVERTED'],
  '修正并重试后需求必须一次性转换完成',
)
assert.equal(listProcessWorkOrders('DYE').length, transactionDyeCountBefore + 1, '修正重试后应新增一张染色加工单')
assert.equal(listProcessWorkOrders('PRINT').length, transactionPrintCountBefore + 1, '修正重试后应新增一张印花加工单')

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

function assertGeneratedOrder(
  orderId: string,
  source: FormalProductionOrderProcessSnapshot,
  processType: 'DYE' | 'PRINT',
): void {
  const order = getProcessWorkOrderById(orderId)
  assert(order, `${orderId} 缺少统一加工单`)
  assert.equal(order.processType, processType)
  assert.equal(order.sourceType, 'PRODUCTION_ORDER', '正式生产单直生加工单来源类型必须是生产单')
  assert.equal(order.sourceProductionOrderId, source.productionOrderId, '加工单必须保存唯一来源生产单')
  assert.equal(order.sourceProductionOrderNo, source.productionOrderNo, '加工单必须保存来源生产单号')
  assert.equal(order.productionOrderOrderedAt, source.orderedAt, '加工单必须保存来源生产单下单时间')
  assert.equal(order.stockMaterialId, undefined, '生产单来源不得携带备货物料')
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
    spuCode: source.spuCode,
    spuName: source.spuName,
    requiredDeliveryDate: source.requiredDeliveryDate,
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
assert(
  applyCreatedSource.includes('buildFormalProductionOrderProcessSnapshots(item.order)'),
  '生产单写入后必须通过已验证的纯转换函数生成各工艺快照',
)

console.log('生产单自动生成加工单检查通过')
