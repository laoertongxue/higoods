import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

import {
  getDyeExecutionRoute,
  getDyeWorkOrderById,
  getDyeWorkOrderByTaskId,
  startDyeSampleTest,
  createDyeWorkOrderFromStock,
} from '../src/data/fcs/dyeing-task-domain.ts'
import {
  createCombinedDyeingTask,
  completeCombinedDyeingTask,
  deleteCombinedDyeingTask,
  getCombinedDyeingTaskById,
} from '../src/data/fcs/combined-dyeing-domain.ts'
import { listPdaGenericProcessTasks } from '../src/data/fcs/pda-task-mock-factory.ts'
import {
  getProcessWorkOrderById,
  listProcessWorkOrders,
  type ProcessWorkOrder,
} from '../src/data/fcs/process-work-order-domain.ts'
import { getPrintWorkOrderById, getPrintWorkOrderByTaskId, startColorTest } from '../src/data/fcs/printing-task-domain.ts'
import { productionOrders, type ProductionOrder } from '../src/data/fcs/production-orders.ts'
import { listProcessWorkOrderStockMaterials } from '../src/data/fcs/process-work-order-stock.ts'
import { state } from '../src/pages/production/context.ts'
import {
  applyCreatedProductionOrderGroups,
  type CreatedProductionOrderGroup,
} from '../src/pages/production/demand-domain.ts'
import {
  buildFormalProductionOrderProcessSnapshots,
  ensureProcessWorkOrdersForFormalProductionOrder,
  prepareSyncProcessWorkOrdersAfterProductionOrderChanges,
  syncProcessWorkOrdersAfterProductionOrderChange,
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
    { materialId: dyeBom.materialCode, materialName: '染色针织布 / 180g', targetColor: '雾霾蓝', plannedQty: 55, qtyUnit: '米' },
    { materialId: printBom.materialCode, materialName: '印花裁片 / 前后幅', targetColor: '米白底蓝花', plannedQty: 210, qtyUnit: '片' },
  ],
  '染色和印花快照必须分别读取其工艺路线绑定的 BOM',
)
assert.deepEqual(
  routeSnapshots.map((snapshot) => snapshot.materialItems),
  [
    [{ sourceBomItemId: dyeBom.id, materialId: dyeBom.materialCode, materialName: '染色针织布 / 180g' }],
    [{ sourceBomItemId: printBom.id, materialId: printBom.materialCode, materialName: '印花裁片 / 前后幅' }],
  ],
  '正式工艺快照必须保留每条 BOM constituent 的位置身份与当前物料身份',
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
    materialId: 'MAT-DYE-001+MAT-DYE-002',
    materialName: '染色针织布 / 180g、染色罗纹布 / 2x2 罗纹',
    targetColor: '雾霾蓝、深海蓝',
    plannedQty: 80,
    qtyUnit: '米',
  }],
  '同一工艺绑定多个同单位 BOM 时必须按物料用量和损耗明确聚合',
)
assert.equal(aggregatedDyeSnapshots.length, 1, '一个生产单的同类染色工艺必须只生成一张快照')
assert.deepEqual(aggregatedDyeSnapshots[0]?.materialItems, [
  { sourceBomItemId: dyeBom.id, materialId: dyeBom.materialCode, materialName: '染色针织布 / 180g' },
  { sourceBomItemId: secondDyeBom.id, materialId: secondDyeBom.materialCode, materialName: '染色罗纹布 / 2x2 罗纹' },
], '同一 DYE 聚合多个 BOM 时必须保留 constituent，禁止只留下拼接字符串')
assert.equal(aggregatedDyeSnapshots[0]?.requiresWaterSoluble, false, '全部染色 BOM 均不需水溶时必须生成普通染色快照')

const sameActualMaterialOrders = ['A', 'B'].map((suffix) => ({
  ...routeOrder,
  productionOrderId: `PO-AUTO-SAME-MATERIAL-${suffix}`,
  productionOrderNo: `PO-AUTO-SAME-MATERIAL-${suffix}`,
  techPackSnapshot: {
    ...routeOrder.techPackSnapshot,
    bomItems: [{ ...dyeBom, id: `BOM-${suffix}`, materialCode: '  MAT-SAME-001  ' }],
    processEntries: [{
      ...processTemplate,
      id: `PROCESS-DYE-SAME-${suffix}`,
      processCode: 'DYE',
      processName: '匹染',
      linkedBomItemIds: [`BOM-${suffix}`],
    }],
  },
}))
const sameActualMaterialSnapshots = sameActualMaterialOrders.map((order) => ({
  ...buildFormalProductionOrderProcessSnapshots(order)[0]!,
  factoryId: 'FACTORY-DYE-SAME-001',
  factoryName: '同一染厂',
  targetColor: '同一蓝',
}))
assert.deepEqual(
  sameActualMaterialSnapshots.map((snapshot) => [snapshot.materialItems?.[0]?.sourceBomItemId, snapshot.materialId]),
  [['BOM-A', 'MAT-SAME-001'], ['BOM-B', 'MAT-SAME-001']],
  '不同正式生产单的 BOM 行只用于追溯，相同 materialCode 必须形成相同实际物料身份',
)
const sameActualMaterialWorkOrders = sameActualMaterialSnapshots.map((snapshot) => (
  ensureProcessWorkOrdersForFormalProductionOrder(snapshot).dyeWorkOrderId!
))
assert.doesNotThrow(() => createCombinedDyeingTask({
  dyeWorkOrderIds: sameActualMaterialWorkOrders,
  createdBy: '实际物料身份检查人',
  createdAt: '2026-07-16 11:00:00',
}), 'BOM 行不同但正式物料编码相同、同厂同色同工艺的染色加工单必须允许合并染色')

const differentActualMaterialSnapshot = {
  ...buildFormalProductionOrderProcessSnapshots({
    ...sameActualMaterialOrders[1]!,
    productionOrderId: 'PO-AUTO-DIFFERENT-MATERIAL-C',
    productionOrderNo: 'PO-AUTO-DIFFERENT-MATERIAL-C',
    techPackSnapshot: {
      ...sameActualMaterialOrders[1]!.techPackSnapshot,
      bomItems: [{ ...dyeBom, id: 'BOM-C', materialCode: 'MAT-DIFFERENT-001' }],
      processEntries: [{
        ...processTemplate,
        id: 'PROCESS-DYE-DIFFERENT-C',
        processCode: 'DYE',
        processName: '匹染',
        linkedBomItemIds: ['BOM-C'],
      }],
    },
  })[0]!,
  factoryId: 'FACTORY-DYE-SAME-001',
  factoryName: '同一染厂',
  targetColor: '同一蓝',
}
const differentActualMaterialWorkOrder = ensureProcessWorkOrdersForFormalProductionOrder(differentActualMaterialSnapshot).dyeWorkOrderId!
assert.throws(() => createCombinedDyeingTask({
  dyeWorkOrderIds: [sameActualMaterialWorkOrders[0]!, differentActualMaterialWorkOrder],
  createdBy: '实际物料身份检查人',
  createdAt: '2026-07-16 11:01:00',
}), /同一面料/, '正式物料编码不同的染色加工单必须拒绝合并')

assert.throws(() => buildFormalProductionOrderProcessSnapshots({
  ...routeOrder,
  productionOrderId: 'PO-AUTO-MISSING-MATERIAL-CODE',
  productionOrderNo: 'PO-AUTO-MISSING-MATERIAL-CODE',
  techPackSnapshot: {
    ...routeOrder.techPackSnapshot,
    bomItems: [{ ...dyeBom, id: 'BOM-MISSING-CODE', materialCode: '  ' }],
    processEntries: [{
      ...processTemplate,
      id: 'PROCESS-DYE-MISSING-CODE',
      processCode: 'DYE',
      processName: '匹染',
      linkedBomItemIds: ['BOM-MISSING-CODE'],
    }],
  },
}), /缺少稳定物料编码.*无法生成加工单/, '参与染色或印花的正式 BOM 缺少 materialCode 时必须中文失败关闭')

const aggregateIdentityOrder = (suffix: string, bomItems: typeof dyeBom[], linkedBomItemIds: string[]) => ({
  ...routeOrder,
  productionOrderId: `PO-AUTO-AGGREGATE-IDENTITY-${suffix}`,
  productionOrderNo: `PO-AUTO-AGGREGATE-IDENTITY-${suffix}`,
  techPackSnapshot: {
    ...routeOrder.techPackSnapshot,
    bomItems,
    processEntries: [{
      ...processTemplate,
      id: `PROCESS-DYE-AGGREGATE-${suffix}`,
      processCode: 'DYE',
      processName: '组合面料匹染',
      linkedBomItemIds,
    }],
  },
})
const aggregateBomA = { ...dyeBom, id: 'BOM-AGG-A', materialCode: 'MAT-AGG-A', name: '甲面料' }
const aggregateBomB = { ...dyeBom, id: 'BOM-AGG-B', materialCode: 'MAT-AGG-B', name: '乙面料' }
const aggregateIdentitySnapshots = [
  buildFormalProductionOrderProcessSnapshots(aggregateIdentityOrder('BA', [aggregateBomB, aggregateBomA], ['BOM-AGG-B', 'BOM-AGG-A']))[0]!,
  buildFormalProductionOrderProcessSnapshots(aggregateIdentityOrder('AB', [aggregateBomA, aggregateBomB], ['BOM-AGG-A', 'BOM-AGG-B']))[0]!,
]
assert.deepEqual(
  aggregateIdentitySnapshots.map((snapshot) => snapshot.materialId),
  ['MAT-AGG-A+MAT-AGG-B', 'MAT-AGG-A+MAT-AGG-B'],
  '同组实际物料即使 BOM 顺序不同也必须生成稳定的聚合 materialId',
)
assert.deepEqual(
  aggregateIdentitySnapshots.map((snapshot) => snapshot.materialName),
  ['乙面料 / 180g、甲面料 / 180g', '甲面料 / 180g、乙面料 / 180g'],
  'materialName 必须保留正式 BOM 原始顺序',
)
const duplicateActualIdentitySnapshot = buildFormalProductionOrderProcessSnapshots(aggregateIdentityOrder(
  'DUPLICATE',
  [{ ...aggregateBomA, id: 'BOM-AGG-A1' }, { ...aggregateBomA, id: 'BOM-AGG-A2', name: '甲面料第二行' }],
  ['BOM-AGG-A1', 'BOM-AGG-A2'],
))[0]!
assert.equal(duplicateActualIdentitySnapshot.materialId, 'MAT-AGG-A', '重复正式物料编码必须在聚合 materialId 中去重')

const allWaterDyeOrder: ProductionOrder = {
  ...routeOrder,
  productionOrderId: 'PO-AUTO-ALL-WATER-DYE-001',
  productionOrderNo: 'PO-AUTO-ALL-WATER-DYE-001',
  techPackSnapshot: {
    ...routeOrder.techPackSnapshot,
    bomItems: [dyeBom, secondDyeBom].map((item) => ({ ...item, waterSolubleRequirement: '是' as const })),
    processEntries: [{
      ...processTemplate,
      id: 'PROCESS-DYE-ALL-WATER-001',
      processCode: 'DYE',
      processName: '统一水溶后染色',
      linkedBomItemIds: [dyeBom.id, secondDyeBom.id],
    }],
  },
}
const allWaterDyeSnapshots = buildFormalProductionOrderProcessSnapshots(allWaterDyeOrder)
assert.equal(allWaterDyeSnapshots.length, 1, '全部需水溶的多个染色 BOM 仍必须合并成一张染色快照')
assert.equal(allWaterDyeSnapshots[0]?.requiresWaterSoluble, true, '全部染色 BOM 均需水溶时必须标记联合水溶')

const mixedWaterDyeOrder: ProductionOrder = {
  ...allWaterDyeOrder,
  productionOrderId: 'PO-AUTO-MIXED-WATER-DYE-001',
  productionOrderNo: 'PO-AUTO-MIXED-WATER-DYE-001',
  techPackSnapshot: {
    ...allWaterDyeOrder.techPackSnapshot!,
    bomItems: [
      { ...dyeBom, waterSolubleRequirement: '是' },
      { ...secondDyeBom, waterSolubleRequirement: '否' },
    ],
  },
}
assert.throws(
  () => buildFormalProductionOrderProcessSnapshots(mixedWaterDyeOrder),
  /染色工艺绑定的 BOM 水溶属性不一致.*统一.*正式 BOM 工艺属性/,
  '同一染色快照混合需水溶与不需水溶 BOM 时必须明确阻断，不能整单升级或拆单',
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
const transactionPdaCountBefore = listPdaGenericProcessTasks().length

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
  assert.equal(listPdaGenericProcessTasks().length, transactionPdaCountBefore, '批次预校验失败后 PDA 任务数量必须不变')
}

assertFailedBatchLeavesStateUnchanged(missingBomOrder, /绑定了不存在的 BOM：BOM-NOT-FOUND/)
assertFailedBatchLeavesStateUnchanged(mixedUnitOrder, /绑定多种或缺失数量单位，无法合并为一张加工单/)
assertFailedBatchLeavesStateUnchanged(zeroPlannedQtyOrder, /正式生产单加工数量和单位必须有效/)
assertFailedBatchLeavesStateUnchanged(emptyTechPackVersionOrder, /正式生产单必须携带已发布技术包版本快照/)
assertFailedBatchLeavesStateUnchanged(emptyMaterialNameOrder, /正式生产单必须携带 BOM 面料快照/)
assertFailedBatchLeavesStateUnchanged(missingBomOrder, /绑定了不存在的 BOM：BOM-NOT-FOUND/)
assertFailedBatchLeavesStateUnchanged(mixedWaterDyeOrder, /染色工艺绑定的 BOM 水溶属性不一致/)

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

const mixedRetryDemand = state.demands.find((demand) => !demand.hasProductionOrder)
assert(mixedRetryDemand, '缺少可用于混合水溶属性原子性重试的未转换需求')
const mixedRetryOrder: ProductionOrder = {
  ...mixedWaterDyeOrder,
  productionOrderId: 'PO-AUTO-MIXED-WATER-RETRY-001',
  productionOrderNo: 'PO-AUTO-MIXED-WATER-RETRY-001',
  demandId: mixedRetryDemand.demandId,
  sourceDemandIds: [mixedRetryDemand.demandId],
}
const mixedRetryGroup: CreatedProductionOrderGroup = { demands: [mixedRetryDemand], order: mixedRetryOrder }
const mixedRetryBefore = {
  orderCount: state.orders.length,
  dyeCount: listProcessWorkOrders('DYE').length,
  printCount: listProcessWorkOrders('PRINT').length,
  pdaCount: listPdaGenericProcessTasks().length,
  demand: {
    hasProductionOrder: mixedRetryDemand.hasProductionOrder,
    productionOrderId: mixedRetryDemand.productionOrderId,
    demandStatus: mixedRetryDemand.demandStatus,
    updatedAt: mixedRetryDemand.updatedAt,
  },
}
assert.throws(
  () => applyCreatedProductionOrderGroups([mixedRetryGroup], transactionNow),
  /染色工艺绑定的 BOM 水溶属性不一致.*统一.*正式 BOM 工艺属性/,
  '混合水溶属性必须在生产单和加工单写入前整批阻断',
)
assert.deepEqual({
  orderCount: state.orders.length,
  dyeCount: listProcessWorkOrders('DYE').length,
  printCount: listProcessWorkOrders('PRINT').length,
  pdaCount: listPdaGenericProcessTasks().length,
  demand: (() => {
    const demand = state.demands.find((item) => item.demandId === mixedRetryDemand.demandId)!
    return {
      hasProductionOrder: demand.hasProductionOrder,
      productionOrderId: demand.productionOrderId,
      demandStatus: demand.demandStatus,
      updatedAt: demand.updatedAt,
    }
  })(),
}, mixedRetryBefore, '混合水溶属性失败后生产单、需求、染色/印花加工单和 PDA 均不得变化')

const correctedMixedRetryOrder: ProductionOrder = {
  ...mixedRetryOrder,
  techPackSnapshot: allWaterDyeOrder.techPackSnapshot,
}
applyCreatedProductionOrderGroups([{ demands: [mixedRetryDemand], order: correctedMixedRetryOrder }], transactionNow)
const correctedMixedRetryDyeOrders = listProcessWorkOrders('DYE')
  .filter((order) => order.sourceProductionOrderId === correctedMixedRetryOrder.productionOrderId)
assert.equal(correctedMixedRetryDyeOrders.length, 1, '修正为全部需水溶后重试必须只生成一张染色加工单')
assert.equal(getDyeWorkOrderById(correctedMixedRetryDyeOrders[0]!.workOrderId)?.requiresWaterSoluble, true, '修正重试生成的唯一染色加工单必须包含联合水溶')
assert.equal(listProcessWorkOrders('PRINT').length, mixedRetryBefore.printCount, '纯染色重试不得生成印花加工单')
assert.equal(listPdaGenericProcessTasks().length, mixedRetryBefore.pdaCount + 1, '修正重试只允许新增一个染色 PDA 任务')

const ordinaryDyeBefore = listProcessWorkOrders('DYE').length
const ordinaryDyeResult = ensureProcessWorkOrdersForFormalProductionOrder(aggregatedDyeSnapshots[0]!)
assert(ordinaryDyeResult.dyeWorkOrderId, '全部不需水溶的染色 BOM 必须生成普通染色加工单')
assert.equal(listProcessWorkOrders('DYE').length, ordinaryDyeBefore + 1, '全部不需水溶时必须只新增一张普通染色加工单')
assert.equal(getDyeWorkOrderById(ordinaryDyeResult.dyeWorkOrderId)?.requiresWaterSoluble, false, '全部不需水溶时不得生成水溶执行节点')

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

const syncBase: FormalProductionOrderProcessSnapshot = {
  ...dyeAndPrint,
  productionOrderId: 'PO-AUTO-SYNC-001',
  productionOrderNo: 'PO-AUTO-SYNC-001',
  orderedAt: '2026-07-16 08:00:00',
  materialId: 'MAT-SYNC-OLD',
  materialName: '同步前面料',
  targetColor: '同步前蓝色',
  plannedQty: 100,
  qtyUnit: '米',
  techPackVersionId: 'TP-SYNC-V1',
  techPackVersionLabel: '技术包 V1',
  dyeProcessName: '同步前染色',
  printProcessName: '同步前印花',
  requiresWaterSoluble: false,
}
const syncCreated = ensureProcessWorkOrdersForFormalProductionOrder(syncBase)
const syncChanged: FormalProductionOrderProcessSnapshot = {
  ...syncBase,
  orderedAt: '2026-07-16 09:30:00',
  materialId: 'MAT-SYNC-NEW',
  materialName: '同步后面料',
  targetColor: '同步后绿色',
  plannedQty: 135,
  qtyUnit: '码',
  techPackVersionId: 'TP-SYNC-V2',
  techPackVersionLabel: '技术包 V2',
  dyeProcessName: '同步后活性染色',
  printProcessName: '同步后数码印花',
  requiresWaterSoluble: true,
}
const syncResult = syncProcessWorkOrdersAfterProductionOrderChange(syncChanged, {
  changeRecordId: 'BG-SYNC-001',
  recordedAt: '2026-07-16 10:00:00',
})
assert.deepEqual(syncResult.autoSynced.sort(), [syncCreated.dyeWorkOrderId, syncCreated.printWorkOrderId].sort(), '未执行染色/印花加工单必须一起自动同步')
const syncedDye = getDyeWorkOrderById(syncCreated.dyeWorkOrderId!)!
const syncedPrint = getPrintWorkOrderById(syncCreated.printWorkOrderId!)!
assert.equal(syncedDye.dyeOrderId, syncCreated.dyeWorkOrderId, '染色加工单 ID 不得改变')
assert.equal(syncedDye.taskId, syncCreated.dyeWorkOrderId, '染色 PDA canonical 任务 ID 不得改变')
assert.equal(syncedPrint.printOrderId, syncCreated.printWorkOrderId, '印花加工单 ID 不得改变')
assert.equal(syncedPrint.taskId, syncCreated.printWorkOrderId, '印花 PDA canonical 任务 ID 不得改变')
assert.deepEqual(
  [syncedDye.materialId, syncedDye.composition, syncedDye.targetColor, syncedDye.dyeProcessName, syncedDye.plannedQty, syncedDye.qtyUnit, syncedDye.requiresWaterSoluble],
  ['MAT-SYNC-NEW', '同步后面料', '同步后绿色', '同步后活性染色', 135, '码', true],
  '未执行染色加工单必须覆盖新生产快照和水溶计划事实',
)
assert.deepEqual(
  [syncedPrint.materialSku, syncedPrint.materialColor, syncedPrint.patternNo, syncedPrint.patternVersion, syncedPrint.plannedQty, syncedPrint.qtyUnit],
  ['MAT-SYNC-NEW', '同步后绿色', 'TP-SYNC-V2', '技术包 V2', 135, '码'],
  '未执行印花加工单必须覆盖新生产快照',
)
assert.equal(syncedDye.autoSyncHistory?.length, 1, '染色加工单自动同步必须留痕')
assert.equal(syncedPrint.autoSyncHistory?.length, 1, '印花加工单自动同步必须留痕')
syncProcessWorkOrdersAfterProductionOrderChange(syncChanged, { changeRecordId: 'BG-SYNC-001', recordedAt: '2026-07-16 10:00:01' })
assert.equal(getDyeWorkOrderById(syncCreated.dyeWorkOrderId!)?.autoSyncHistory?.length, 1, '同一变更事件重复回调不得重复写同步历史')

const executedSnapshot: FormalProductionOrderProcessSnapshot = {
  ...dyeOnly,
  productionOrderId: 'PO-AUTO-SYNC-EXECUTED',
  productionOrderNo: 'PO-AUTO-SYNC-EXECUTED',
}
const executedCreated = ensureProcessWorkOrdersForFormalProductionOrder(executedSnapshot)
startDyeSampleTest(executedCreated.dyeWorkOrderId!, '真实执行人')
const executedBefore = getDyeWorkOrderById(executedCreated.dyeWorkOrderId!)!
syncProcessWorkOrdersAfterProductionOrderChange({
  ...executedSnapshot,
  materialId: 'MAT-EXECUTED-NEW',
  materialName: '执行后变更面料',
  plannedQty: 999,
}, { changeRecordId: 'BG-SYNC-EXECUTED', recordedAt: '2026-07-16 10:10:00' })
const executedAfter = getDyeWorkOrderById(executedCreated.dyeWorkOrderId!)!
assert.equal(executedAfter.materialId, executedBefore.materialId, '已有真实执行节点时不得覆盖原加工事实')
assert.equal(executedAfter.plannedQty, executedBefore.plannedQty, '已有真实执行节点时不得覆盖原计划数量')
assert.equal(executedAfter.changeImpact?.at(-1)?.reason, '已执行', '已有真实执行节点必须记录已执行影响')
executedAfter.changeImpact![0]!.after.plannedQty = 1
assert.equal(getDyeWorkOrderById(executedCreated.dyeWorkOrderId!)?.changeImpact?.[0]?.after.plannedQty, 999, '加工单影响历史读取必须深克隆')
syncProcessWorkOrdersAfterProductionOrderChange({
  ...executedSnapshot,
  materialId: 'MAT-EXECUTED-NEWER',
  materialName: '第二次执行后变更面料',
  plannedQty: 888,
}, { changeRecordId: 'BG-SYNC-EXECUTED-002', recordedAt: '2026-07-16 10:11:00' })
assert.equal(getDyeWorkOrderById(executedCreated.dyeWorkOrderId!)?.changeImpact?.length, 2, '多次不同生产变更必须保留全部加工单影响历史')
assert.equal(getProcessWorkOrderById(executedCreated.dyeWorkOrderId!)?.changeImpact?.length, 2, '平台统一加工单读取必须透出全部生产变更影响历史')

const executedPrintSnapshot: FormalProductionOrderProcessSnapshot = {
  ...printOnly,
  productionOrderId: 'PO-AUTO-SYNC-PRINT-EXECUTED',
  productionOrderNo: 'PO-AUTO-SYNC-PRINT-EXECUTED',
}
const executedPrintCreated = ensureProcessWorkOrdersForFormalProductionOrder(executedPrintSnapshot)
startColorTest(executedPrintCreated.printWorkOrderId!, '真实印花执行人')
syncProcessWorkOrdersAfterProductionOrderChange({ ...executedPrintSnapshot, materialId: 'MAT-PRINT-EXECUTED-NEW', plannedQty: 777 }, {
  changeRecordId: 'BG-SYNC-PRINT-EXECUTED',
  recordedAt: '2026-07-16 10:12:00',
})
assert.equal(getPrintWorkOrderById(executedPrintCreated.printWorkOrderId!)?.materialSku, executedPrintSnapshot.materialId, '印花实际开始后不得覆盖原加工事实')
assert.equal(getPrintWorkOrderById(executedPrintCreated.printWorkOrderId!)?.changeImpact?.at(-1)?.reason, '已执行', '印花实际开始后必须记录已执行影响')

const combinedA: FormalProductionOrderProcessSnapshot = {
  ...dyeOnly,
  productionOrderId: 'PO-AUTO-SYNC-COMBINED-A',
  productionOrderNo: 'PO-AUTO-SYNC-COMBINED-A',
  materialId: 'MAT-SYNC-COMBINED',
  materialName: '合并同步面料',
  targetColor: '合并蓝',
  dyeProcessName: '合并活性染色',
  plannedQty: 60,
}
const combinedB: FormalProductionOrderProcessSnapshot = {
  ...combinedA,
  productionOrderId: 'PO-AUTO-SYNC-COMBINED-B',
  productionOrderNo: 'PO-AUTO-SYNC-COMBINED-B',
  plannedQty: 40,
}
const combinedAOrder = ensureProcessWorkOrdersForFormalProductionOrder(combinedA)
const combinedBOrder = ensureProcessWorkOrdersForFormalProductionOrder(combinedB)
const combinedTask = createCombinedDyeingTask({
  dyeWorkOrderIds: [combinedAOrder.dyeWorkOrderId!, combinedBOrder.dyeWorkOrderId!],
  createdBy: '同步检查计划员',
  createdAt: '2026-07-16 10:20:00',
})
syncProcessWorkOrdersAfterProductionOrderChange({ ...combinedA, plannedQty: 88, materialName: '合并后新名称' }, {
  changeRecordId: 'BG-SYNC-COMBINED',
  recordedAt: '2026-07-16 10:21:00',
})
assert.equal(getDyeWorkOrderById(combinedAOrder.dyeWorkOrderId!)?.plannedQty, 60, '活动合并任务成员不得改写加工单成员事实')
assert.equal(getDyeWorkOrderById(combinedAOrder.dyeWorkOrderId!)?.changeImpact?.at(-1)?.reason, '已加入合并染色')
assert.equal(getCombinedDyeingTaskById(combinedTask.taskId)?.changeImpact?.at(-1)?.reason, '已加入合并染色', '合并任务也必须记录生产变更影响')
deleteCombinedDyeingTask(combinedTask.taskId, { deletedBy: '同步检查计划员', deletedAt: '2026-07-16 10:22:00', reason: '未执行任务取消' })
syncProcessWorkOrdersAfterProductionOrderChange({ ...combinedA, plannedQty: 88, materialName: '合并后新名称' }, {
  changeRecordId: 'BG-SYNC-COMBINED-AFTER-DELETE',
  recordedAt: '2026-07-16 10:23:00',
})
assert.equal(getDyeWorkOrderById(combinedAOrder.dyeWorkOrderId!)?.plannedQty, 88, '未完成合并任务删除后必须释放占用并允许同步最新快照')

const completedCombinedA = { ...combinedA, productionOrderId: 'PO-AUTO-SYNC-COMPLETED-A', productionOrderNo: 'PO-AUTO-SYNC-COMPLETED-A' }
const completedCombinedB = { ...combinedB, productionOrderId: 'PO-AUTO-SYNC-COMPLETED-B', productionOrderNo: 'PO-AUTO-SYNC-COMPLETED-B' }
const completedCombinedAOrder = ensureProcessWorkOrdersForFormalProductionOrder(completedCombinedA)
const completedCombinedBOrder = ensureProcessWorkOrdersForFormalProductionOrder(completedCombinedB)
const completedCombinedTask = createCombinedDyeingTask({
  dyeWorkOrderIds: [completedCombinedAOrder.dyeWorkOrderId!, completedCombinedBOrder.dyeWorkOrderId!],
  createdBy: '同步检查计划员',
  createdAt: '2026-07-16 10:30:00',
})
completeCombinedDyeingTask(completedCombinedTask.taskId, {
  actualInputQty: 100,
  actualOutputQty: 100,
  completedBy: '染厂主管',
  completedAt: '2026-07-16 10:31:00',
})
deleteCombinedDyeingTask(completedCombinedTask.taskId, { deletedBy: '同步检查计划员', deletedAt: '2026-07-16 10:32:00', reason: '完成后归档' })
syncProcessWorkOrdersAfterProductionOrderChange({ ...completedCombinedA, plannedQty: 70 }, {
  changeRecordId: 'BG-SYNC-COMPLETED-AFTER-DELETE',
  recordedAt: '2026-07-16 10:33:00',
})
assert.equal(getDyeWorkOrderById(completedCombinedAOrder.dyeWorkOrderId!)?.plannedQty, 60, '已有完成分配的合并任务删除后仍不得覆盖成员执行快照')
assert.equal(getDyeWorkOrderById(completedCombinedAOrder.dyeWorkOrderId!)?.changeImpact?.at(-1)?.reason, '已加入合并染色')
assert.equal(getCombinedDyeingTaskById(completedCombinedTask.taskId)?.changeImpact?.at(-1)?.reason, '已加入合并染色', '已删除但有完成分配的合并任务仍须保留变更影响')

const stockDyeMaterial = listProcessWorkOrderStockMaterials({ processCode: 'DYE' })[0]!
const stockDyeCreated = createDyeWorkOrderFromStock({
  stockMaterialId: stockDyeMaterial.stockMaterialId,
  stockMaterialName: stockDyeMaterial.stockMaterialName,
  materialSku: stockDyeMaterial.materialSku,
  factoryId: stockDyeMaterial.factoryId,
  plannedQty: Math.min(10, stockDyeMaterial.availableQty),
  qtyUnit: stockDyeMaterial.qtyUnit,
  plannedFinishAt: '2026-07-30 18:00',
  processName: '备货染色',
  targetColor: '备货蓝',
})
assert(stockDyeCreated.ok && stockDyeCreated.order, '测试前置：必须通过真实备货入口创建 STOCK 染色加工单')
const stockDyeBeforeSync = getProcessWorkOrderById(stockDyeCreated.order.dyeOrderId)!
syncProcessWorkOrdersAfterProductionOrderChange({
  ...dyeOnly,
  productionOrderId: stockDyeBeforeSync.workOrderId,
  productionOrderNo: '伪生产单不得命中 STOCK',
  plannedQty: stockDyeBeforeSync.plannedQty + 100,
}, { changeRecordId: 'BG-STOCK-MUST-NOT-SYNC', recordedAt: '2026-07-16 10:40:00' })
assert.deepEqual(getProcessWorkOrderById(stockDyeBeforeSync.workOrderId), stockDyeBeforeSync, 'STOCK 加工单不得受生产单变更同步影响')

const atomicDyeBefore = getDyeWorkOrderById(syncCreated.dyeWorkOrderId!)!
const atomicPrintBefore = getPrintWorkOrderById(syncCreated.printWorkOrderId!)!
assert.throws(() => syncProcessWorkOrdersAfterProductionOrderChange({
  ...syncChanged,
  materialId: '',
  plannedQty: 160,
}, { changeRecordId: 'BG-SYNC-INVALID-ATOMIC' }), /BOM 面料快照/, '染色+印花同步必须在任一写入前完整校验快照')
assert.deepEqual(getDyeWorkOrderById(syncCreated.dyeWorkOrderId!), atomicDyeBefore, '无效快照不得留下染色半同步')
assert.deepEqual(getPrintWorkOrderById(syncCreated.printWorkOrderId!), atomicPrintBefore, '无效快照不得留下印花半同步')

const batchFirst: FormalProductionOrderProcessSnapshot = {
  ...dyeOnly,
  productionOrderId: 'PO-AUTO-SYNC-BATCH-FIRST',
  productionOrderNo: 'PO-AUTO-SYNC-BATCH-FIRST',
  plannedQty: 50,
}
const batchSecond: FormalProductionOrderProcessSnapshot = {
  ...dyeOnly,
  productionOrderId: 'PO-AUTO-SYNC-BATCH-SECOND',
  productionOrderNo: 'PO-AUTO-SYNC-BATCH-SECOND',
  plannedQty: 60,
}
const batchFirstOrder = ensureProcessWorkOrdersForFormalProductionOrder(batchFirst)
const batchSecondOrder = ensureProcessWorkOrdersForFormalProductionOrder(batchSecond)
const batchFirstBefore = getDyeWorkOrderById(batchFirstOrder.dyeWorkOrderId!)!
assert.throws(
  () => prepareSyncProcessWorkOrdersAfterProductionOrderChanges([
    { ...batchFirst, plannedQty: 75 },
    { ...batchSecond, materialId: '' },
  ], { changeRecordId: 'BG-SYNC-BATCH-INVALID' }),
  /BOM 面料快照/,
  '批量准备必须先校验全部快照，第二条失败时不得留下第一条候选写入',
)
assert.deepEqual(getDyeWorkOrderById(batchFirstOrder.dyeWorkOrderId!), batchFirstBefore, '批量准备失败不得改写第一张加工单')

const preparedBatch = prepareSyncProcessWorkOrdersAfterProductionOrderChanges([
  { ...batchFirst, plannedQty: 75 },
  { ...batchSecond, plannedQty: 85 },
], { changeRecordId: 'BG-SYNC-BATCH-SUCCESS', recordedAt: '2026-07-16 10:45:00' })
assert.equal(getDyeWorkOrderById(batchFirstOrder.dyeWorkOrderId!)?.plannedQty, 50, '批量 prepare 阶段不得提前写第一张加工单')
assert.equal(getDyeWorkOrderById(batchSecondOrder.dyeWorkOrderId!)?.plannedQty, 60, '批量 prepare 阶段不得提前写第二张加工单')
assert.doesNotThrow(() => preparedBatch.commit(), '已完成业务校验的批量 commit 必须是不可失败的纯内存提交')
assert.equal(getDyeWorkOrderById(batchFirstOrder.dyeWorkOrderId!)?.plannedQty, 75, '批量 commit 必须同步第一张加工单')
assert.equal(getDyeWorkOrderById(batchSecondOrder.dyeWorkOrderId!)?.plannedQty, 85, '批量 commit 必须同步第二张加工单')
assert.doesNotThrow(() => preparedBatch.commit(), '重复 commit 必须幂等且不可抛出')

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
    materialItems: source.materialItems ?? [{
      sourceBomItemId: source.materialId,
      materialId: source.materialId,
      materialName: source.materialName,
    }],
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

const clonedMaterialSnapshot = getProcessWorkOrderById(combinedFirst.dyeWorkOrderId!)!
clonedMaterialSnapshot.formalProductionOrderSnapshot!.materialItems![0]!.materialId = 'MUTATED-OUTSIDE-DOMAIN'
assert.notEqual(
  getProcessWorkOrderById(combinedFirst.dyeWorkOrderId!)?.formalProductionOrderSnapshot?.materialItems?.[0]?.materialId,
  'MUTATED-OUTSIDE-DOMAIN',
  '读取加工单返回的 materialItems 必须深拷贝，外部修改不得污染领域事实',
)

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
