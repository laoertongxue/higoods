import assert from 'node:assert/strict'
import {
  assertSingleReceivingTarget,
  calculateProcessOrderQuantities,
  deriveProcessOrderHandoverStatus,
  deriveProcessOrderProcessingStatus,
  deriveProcessOrderReceiptStatus,
  freezeProcessOrderReceivingTarget,
  type ProcessOrderReceivingTargetSnapshot,
} from '../src/data/fcs/process-order-flow-contract.ts'
import { normalizeCentralTransferReceiptSources } from '../src/data/fcs/preparation-material-receipt-sources.ts'
import type { WarehouseInternalTransferOrder, WarehouseIssueOrder } from '../src/data/fcs/warehouse-material-execution.ts'
import { resolveTerminalProcessOrderReceivingTarget } from '../src/data/fcs/process-order-receiving-target.ts'
import { listPrintWorkOrders } from '../src/data/fcs/printing-task-domain.ts'
import { listDyeWorkOrders } from '../src/data/fcs/dyeing-task-domain.ts'
import { listHandoverOrdersByTaskId } from '../src/data/fcs/pda-handover-events.ts'
import {
  processTasks,
  splitGeneratedProcessTasksByReceivingTarget,
} from '../src/data/fcs/process-tasks.ts'

assert.equal(deriveProcessOrderReceiptStatus({ sourceAvailableQty: 0, expectedQty: 100, receivedQty: 0 }), 'WAIT_SOURCE')
assert.equal(deriveProcessOrderReceiptStatus({ sourceAvailableQty: 100, expectedQty: 100, receivedQty: 0 }), 'WAIT_RECEIVE')
assert.equal(deriveProcessOrderReceiptStatus({ sourceAvailableQty: 60, expectedQty: 100, receivedQty: 40 }), 'PARTIAL_RECEIVED')
assert.equal(deriveProcessOrderReceiptStatus({ sourceAvailableQty: 0, expectedQty: 100, receivedQty: 100 }), 'RECEIVED')
assert.equal(deriveProcessOrderReceiptStatus({ sourceAvailableQty: 0, expectedQty: 100, receivedQty: 96, unresolvedDifferenceQty: 4 }), 'RECEIPT_DIFFERENCE')

assert.equal(deriveProcessOrderProcessingStatus({}), 'NOT_STARTED')
assert.equal(deriveProcessOrderProcessingStatus({ startedAt: '2026-09-09 08:00:00' }), 'PROCESSING')
assert.equal(deriveProcessOrderProcessingStatus({ startedAt: '2026-09-09 08:00:00', manuallyCompletedAt: '2026-09-09 12:00:00' }), 'COMPLETED')
assert.equal(deriveProcessOrderProcessingStatus({ startedAt: '2026-09-09 08:00:00', cancelledAt: '2026-09-09 09:00:00' }), 'CANCELLED')

assert.equal(deriveProcessOrderHandoverStatus({ completedQty: 0, handedOverQty: 0 }), 'NOT_READY')
assert.equal(deriveProcessOrderHandoverStatus({ completedQty: 100, handedOverQty: 0 }), 'WAIT_HANDOVER')
assert.equal(deriveProcessOrderHandoverStatus({ completedQty: 100, handedOverQty: 40 }), 'PARTIAL_HANDOVER')
assert.equal(deriveProcessOrderHandoverStatus({ completedQty: 100, handedOverQty: 100 }), 'FULL_HANDOVER')

assert.deepEqual(calculateProcessOrderQuantities({
  sourceTransferredOrHandedQty: 120,
  receivedQty: 80,
  completedQty: 70,
  handedOverQty: 50,
  downstreamReceivedQty: 30,
}), { receivableQty: 40, handoverableQty: 20, downstreamPendingReceiptQty: 20 })

const target: ProcessOrderReceivingTargetSnapshot = {
  targetType: 'DOWNSTREAM_PROCESS_ORDER',
  targetBusinessId: 'PWO-002',
  targetName: '印花二厂待加工仓',
  targetFactoryId: 'FAC-PRINT-02',
  targetFactoryName: '印花二厂',
  targetWarehouseId: 'WH-PRINT-02-WIP',
  targetWarehouseName: '印花二厂待加工仓',
  downstreamOrderId: 'PWO-002',
  downstreamOrderNo: 'PH-002',
  resolvedFrom: '直接下游 occurrence',
  resolvedAt: '2026-09-09 08:00:00',
}
assert.equal(assertSingleReceivingTarget([target, structuredClone(target)]).targetBusinessId, 'PWO-002')
assert.throws(() => assertSingleReceivingTarget([]), /尚未生成唯一接收方/)
assert.throws(() => assertSingleReceivingTarget([target, { ...target, targetBusinessId: 'PWO-003', downstreamOrderId: 'PWO-003' }]), /多个接收方/)

const frozen = freezeProcessOrderReceivingTarget({
  resolved: target,
  handoverEventId: 'HDO-001',
  handedOverAt: '2026-09-09 09:00:00',
})
assert.equal(frozen.firstHandoverEventId, 'HDO-001')
assert.throws(() => freezeProcessOrderReceivingTarget({
  current: frozen,
  resolved: { ...target, targetWarehouseId: 'WH-OTHER' },
  handoverEventId: 'HDO-002',
  handedOverAt: '2026-09-09 10:00:00',
}), /接收方已冻结/)

assert.throws(() => calculateProcessOrderQuantities({
  sourceTransferredOrHandedQty: 10,
  receivedQty: 11,
  completedQty: 0,
  handedOverQty: 0,
  downstreamReceivedQty: 0,
}), /累计实收不能超过/)
assert.throws(() => deriveProcessOrderHandoverStatus({ completedQty: 10, handedOverQty: 11 }), /累计交出数量不能超过/)

const centralBase = {
  status: 'ISSUED' as const,
  productionOrderId: 'PO-001',
  baseTaskId: 'BASE-DYE',
  runtimeTaskId: 'TASK-DYE-001',
  taskNo: 'TASK-DYE-001',
  processCode: 'PROC_DYE',
  processNameZh: '染色',
  scopeType: 'ORDER' as const,
  scopeKey: 'PO-001',
  scopeLabel: 'PO-001',
  targetFactoryId: 'FAC-DYE-01',
  targetFactoryName: '雅加达染厂',
  targetType: 'EXTERNAL_FACTORY' as const,
  executorKind: 'EXTERNAL_FACTORY' as const,
  warehouseId: 'WH-CENTRAL',
  warehouseName: '中央仓库',
  createdAt: '2026-09-09 08:00:00',
  updatedAt: '2026-09-09 09:00:00',
}
const issue: WarehouseIssueOrder = {
  ...centralBase,
  id: 'ISSUE-001',
  docNo: 'WL-001',
  docType: 'ISSUE',
  lines: [{
    lineId: 'ISSUE-001-L001', docId: 'ISSUE-001', materialCode: 'FAB-001', materialName: '本白坯布',
    unit: '米', plannedQty: 120, preparedQty: 120, issuedQty: 120, returnedQty: 0, transferredQty: 0, shortQty: 0,
  }],
}
const internalTransfer: WarehouseInternalTransferOrder = {
  ...centralBase,
  id: 'TRANSFER-001',
  docNo: 'NL-001',
  docType: 'INTERNAL_TRANSFER',
  targetType: 'WAREHOUSE_WORKSHOP',
  executorKind: 'WAREHOUSE_WORKSHOP',
  lines: [{
    lineId: 'TRANSFER-001-L001', docId: 'TRANSFER-001', materialCode: 'FAB-001', materialName: '本白坯布',
    unit: '米', plannedQty: 80, preparedQty: 80, issuedQty: 0, returnedQty: 0, transferredQty: 80, shortQty: 0,
  }],
}
const centralSources = normalizeCentralTransferReceiptSources({
  documents: [issue, internalTransfer],
  processCode: 'DYE',
  currentDocumentId: 'DWO-001',
  qtyUnit: '米',
  consumed: [{ sourceRecordId: 'ISSUE-001-L001', qty: 20 }],
  constraints: { targetFactoryId: 'FAC-DYE-01', materialCodes: ['FAB-001'] },
})
assert.deepEqual(centralSources.map(item => [item.documentNo, item.availableQty]), [['WL-001', 100], ['NL-001', 80]])
assert.equal(centralSources.every(item => item.sourceType === 'CENTRAL_TRANSFER'), true)
assert.equal(centralSources.every(item => item.targetWarehouseName === '雅加达染厂待加工仓'), true)

assert.deepEqual(resolveTerminalProcessOrderReceivingTarget({
  sourceType: 'STOCK',
}), {
  targetBusinessId: 'CENTRAL-WAREHOUSE',
  targetName: '中央仓库',
  targetWarehouseId: 'CENTRAL-WAREHOUSE',
  targetWarehouseName: '中央仓库',
  resolvedFrom: '采购备货末道规则',
})
assert.equal(resolveTerminalProcessOrderReceivingTarget({
  sourceType: 'PRODUCTION_ORDER',
  productionOrderNo: 'PO-202609-0001',
}).targetWarehouseName, 'PO-202609-0001 配套中转仓')
assert.equal(resolveTerminalProcessOrderReceivingTarget({
  sourceType: 'CUT_PIECE_SUPPLEMENT',
  supplementRecordNo: 'BL-202609-0001',
}).targetName, 'BL-202609-0001 补料需求方')
assert.throws(() => resolveTerminalProcessOrderReceivingTarget({
  sourceType: 'CUT_PIECE_SUPPLEMENT',
}), /缺少指定需求方或接收位置/)

const branchSeed = processTasks[0]
assert(branchSeed, '缺少路线分叉拆单测试种子')
const branchTasks = splitGeneratedProcessTasksByReceivingTarget([
  {
    ...structuredClone(branchSeed),
    taskId: 'TASK-BRANCH-SOURCE',
    taskNo: 'TASK-BRANCH-SOURCE',
    rootTaskNo: 'TASK-BRANCH-SOURCE',
    qty: 100,
    processNameZh: '分支上游加工',
    processBusinessCode: 'PRINT',
    dependsOnTaskIds: [],
  },
  {
    ...structuredClone(branchSeed),
    taskId: 'TASK-BRANCH-DOWNSTREAM-A',
    taskNo: 'TASK-BRANCH-DOWNSTREAM-A',
    rootTaskNo: 'TASK-BRANCH-DOWNSTREAM-A',
    qty: 60,
    processNameZh: '甲厂下游加工',
    processBusinessCode: 'DYE',
    assignedFactoryId: 'FAC-BRANCH-A',
    assignedFactoryName: '甲加工厂',
    dependsOnTaskIds: ['TASK-BRANCH-SOURCE'],
  },
  {
    ...structuredClone(branchSeed),
    taskId: 'TASK-BRANCH-DOWNSTREAM-B',
    taskNo: 'TASK-BRANCH-DOWNSTREAM-B',
    rootTaskNo: 'TASK-BRANCH-DOWNSTREAM-B',
    qty: 40,
    processNameZh: '乙厂下游加工',
    processBusinessCode: 'DYE',
    assignedFactoryId: 'FAC-BRANCH-B',
    assignedFactoryName: '乙加工厂',
    dependsOnTaskIds: ['TASK-BRANCH-SOURCE'],
  },
])
const branchSourceOrders = branchTasks.filter(task => task.splitFromTaskNo === 'TASK-BRANCH-SOURCE')
assert.equal(branchSourceOrders.length, 2, '同一 occurrence 面向两个接收方时必须生成两张加工单')
assert.equal(branchSourceOrders.reduce((sum, task) => sum + task.qty, 0), 100, '接收方拆单后数量总和必须守恒')
assert.equal(new Set(branchSourceOrders.map(task => task.receiverId)).size, 2, '接收方拆单结果必须各自绑定唯一接收方')
branchSourceOrders.forEach((task) => {
  assert.equal(task.isSplitResult, true)
  assert(task.receiverId && task.receiverName, `${task.taskNo} 缺少唯一接收方`)
})
const branchDownstreamOrders = branchTasks.filter(task => task.taskId.startsWith('TASK-BRANCH-DOWNSTREAM-'))
branchDownstreamOrders.forEach((task) => {
  assert.equal(task.dependsOnTaskIds?.length, 1, `${task.taskNo} 必须只引用指向自己的上游拆分单`)
  const predecessor = branchSourceOrders.find(candidate => candidate.taskId === task.dependsOnTaskIds?.[0])
  assert.equal(predecessor?.receiverId, task.taskId, `${task.taskNo} 的上游拆分单接收方引用错误`)
})

const stockPrintWithHandover = listPrintWorkOrders().find(order => order.sourceType === 'STOCK' && order.handoverOrderId)
assert(stockPrintWithHandover, '缺少采购备货末道交回中央仓的印花样例')
assert.equal(stockPrintWithHandover.receiverName, '中央仓库')
assert.equal(stockPrintWithHandover.targetTransferWarehouseName, '中央仓库')
assert.equal(listHandoverOrdersByTaskId(stockPrintWithHandover.taskId)[0]?.receiverName, '中央仓库')

const productionDyeWithHandover = listDyeWorkOrders().find(order => order.sourceType === 'PRODUCTION_ORDER' && order.handoverOrderId)
assert(productionDyeWithHandover?.sourceProductionOrderNo, '缺少生产末道交到裁床配套中转仓的染色样例')
assert.equal(productionDyeWithHandover.receiverName, `${productionDyeWithHandover.sourceProductionOrderNo} 裁床`)
assert.equal(productionDyeWithHandover.targetTransferWarehouseName, `${productionDyeWithHandover.sourceProductionOrderNo} 配套中转仓`)
assert.equal(listHandoverOrdersByTaskId(productionDyeWithHandover.taskId)[0]?.receiverName, `${productionDyeWithHandover.sourceProductionOrderNo} 裁床`)

console.log('全阶段加工单三维状态、数量和唯一接收方契约检查通过')
