#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  assertSewingDispatchAllowed,
  buildHandoverPickingTaskProjectionFromAllocationProjection,
  buildRequiredCutPiecesForSewingDispatch,
  buildSewingTaskAllocationProjectionFromInventory,
  getCuttingSewingDispatchByHandoverRecordId,
  getCuttingSewingDispatchProgressByProductionOrder,
  getCuttingSewingDispatchSummary,
  getEligibleFeiTicketsForSewingDispatch,
  listCuttingSewingDispatchBatches,
  listCuttingSewingDispatchOrders,
  listCuttingSewingDispatchValidationResults,
  listCuttingSewingTransferBags,
  validateDispatchBatchCompleteness,
  validateTransferBagCompleteness,
  type FeiTicketSewingAssignment,
} from '../src/data/fcs/cutting/sewing-dispatch.ts'
import type {
  CuttingRuntimeEvent,
  TransferBagTicketFactSnapshot,
} from '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
import {
  resolveWholeBagHandoverEligibility,
  type TransferBagCurrentUse,
} from '../src/data/fcs/cutting/transfer-bag-operations.ts'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { getProductionOrderTechPackSnapshot } from '../src/data/fcs/production-order-tech-pack-runtime.ts'
import { listFactoryWarehouseInboundRecords } from '../src/data/fcs/factory-internal-warehouse.ts'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function resolveRepoPath(relativePath: string): string {
  return path.join(ROOT, relativePath)
}

function read(relativePath: string): string {
  return fs.readFileSync(resolveRepoPath(relativePath), 'utf8')
}

function readIfExists(relativePath: string): string {
  const absolutePath = resolveRepoPath(relativePath)
  return fs.existsSync(absolutePath) ? fs.readFileSync(absolutePath, 'utf8') : ''
}

function ensureExists(relativePath: string): void {
  assert(fs.existsSync(resolveRepoPath(relativePath)), `缺少文件：${relativePath}`)
}

function assertContains(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotContains(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function buildToken(...parts: string[]): string {
  return parts.join('')
}

const packageSource = read('package.json')
const dataSource = read('src/data/fcs/cutting/sewing-dispatch.ts')
const transferBagRuntimeSource = read('src/data/fcs/cutting/transfer-bag-runtime.ts')
const cuttingMetaSource = read('src/pages/process-factory/cutting/meta.ts')
const sewingDispatchPageSource = read('src/pages/process-factory/cutting/warehouse-hub.ts')
const transferBagsPageSource = read('src/pages/process-factory/cutting/transfer-bags.ts')
const feiTicketsPageSource = read('src/pages/process-factory/cutting/fei-tickets.ts')
const progressSource = read('src/pages/process-factory/cutting/production-progress.ts')
const summarySource = read('src/pages/process-factory/cutting/cutting-summary.ts')
const orderDetailSource = read('src/pages/production/detail-domain.ts')
const handoverSource = read('src/pages/pda-handover.ts') + read('src/pages/pda-handover-detail.ts')
const linkageSource = read('src/data/fcs/factory-warehouse-linkage.ts')
const progressStatisticsSource = read('src/data/fcs/progress-statistics-linkage.ts')
const finalAcceptanceSource = read('scripts/check-fcs-final-acceptance.ts')
const followupSource = readIfExists('scripts/check-followup-cleanup.ts')
const sewingDispatchPageAndMetaSource = sewingDispatchPageSource + cuttingMetaSource

function wholeBagTicket(index: number): TransferBagTicketFactSnapshot {
  const serial = String(index).padStart(2, '0')
  return {
    feiTicketId: `FEI-${serial}`,
    feiTicketNo: `FT-${serial}`,
    productionOrderId: 'PO-ID-001',
    productionOrderNo: 'PO-001',
    cutOrderId: `CUT-ID-${serial}`,
    cutOrderNo: `CUT-${serial}`,
    color: index % 2 ? '深蓝' : '炭灰',
    size: index % 2 ? 'M' : 'L',
    partCode: index % 2 ? 'FRONT' : 'BACK',
    partName: index % 2 ? '前片' : '后片',
    pieceQty: 10,
    sewingTaskId: '历史任务不得作为资格来源',
    sewingTaskNo: '历史任务不得作为资格来源',
    receiverFactoryId: '历史工厂不得作为资格来源',
    receiverFactoryName: '历史工厂不得作为资格来源',
  }
}

function assignmentFor(
  ticket: TransferBagTicketFactSnapshot,
  taskNo: 'SEW-01' | 'SEW-02',
  factoryId = 'FACTORY-A',
): FeiTicketSewingAssignment {
  return {
    feiTicketId: ticket.feiTicketId,
    feiTicketNo: ticket.feiTicketNo,
    sewingTaskId: `${taskNo}-ID`,
    sewingTaskNo: taskNo,
    receiverFactoryId: factoryId,
    receiverFactoryName: factoryId === 'FACTORY-A' ? '车缝一厂' : '车缝二厂',
  }
}

function submittedSnapshotFor(
  tickets: TransferBagTicketFactSnapshot[],
  assignments: FeiTicketSewingAssignment[],
): TransferBagTicketFactSnapshot[] {
  const assignmentByTicketId = new Map(assignments.map((item) => [item.feiTicketId, item]))
  return tickets.map((ticket) => {
    const assignment = assignmentByTicketId.get(ticket.feiTicketId)
    assert(assignment, `菲票 ${ticket.feiTicketId} 缺少提交分配`)
    return {
      ...ticket,
      sewingTaskId: assignment.sewingTaskId,
      sewingTaskNo: assignment.sewingTaskNo,
      receiverFactoryId: assignment.receiverFactoryId,
      receiverFactoryName: assignment.receiverFactoryName,
    }
  })
}

function assertEligibilityReason(
  input: Parameters<typeof resolveWholeBagHandoverEligibility>[0],
  expectedReason: string,
  message: string,
): void {
  assert.equal(resolveWholeBagHandoverEligibility(input).reason, expectedReason, message)
}

function currentCycleHandoverEvent(
  currentUse: TransferBagCurrentUse,
  assignments: FeiTicketSewingAssignment[],
  handoverRecordId = 'HR-CURRENT-CYCLE',
): CuttingRuntimeEvent {
  const ticketSnapshot = submittedSnapshotFor(currentUse.tickets, assignments)
  const handoverOrderId = `HO-${handoverRecordId}`
  const handoverOrderNo = handoverOrderId
  const handoverRecordNo = handoverRecordId
  const sewingTaskIds = [...new Set(assignments.map((item) => item.sewingTaskId))]
  const sewingTaskNos = [...new Set(assignments.map((item) => item.sewingTaskNo))]
  const totalPieceQty = ticketSnapshot.reduce((sum, item) => sum + item.pieceQty, 0)
  const handoverLegId = `${currentUse.usageCycleId}:handover:1`
  const canonicalIntent = JSON.stringify({
    bagCode: currentUse.bagCode,
    usageCycleId: currentUse.usageCycleId,
    handoverLegId,
    handoverOrderId,
    handoverOrderNo,
    handoverRecordId,
    handoverRecordNo,
    assignments: assignments.map((item) => ({
      feiTicketId: item.feiTicketId,
      feiTicketNo: item.feiTicketNo,
      sewingTaskId: item.sewingTaskId,
      sewingTaskNo: item.sewingTaskNo,
      receiverFactoryId: item.receiverFactoryId,
      receiverFactoryName: item.receiverFactoryName,
    })).sort((left, right) => left.feiTicketId.localeCompare(right.feiTicketId)),
    submittedTicketSnapshot: ticketSnapshot.map((item) => ({
      feiTicketId: item.feiTicketId,
      feiTicketNo: item.feiTicketNo,
      productionOrderId: item.productionOrderId,
      productionOrderNo: item.productionOrderNo,
      cutOrderId: item.cutOrderId,
      cutOrderNo: item.cutOrderNo,
      color: item.color,
      size: item.size,
      partCode: item.partCode,
      partName: item.partName,
      pieceQty: item.pieceQty,
      sewingTaskId: item.sewingTaskId,
      sewingTaskNo: item.sewingTaskNo,
      receiverFactoryId: item.receiverFactoryId,
      receiverFactoryName: item.receiverFactoryName,
    })).sort((left, right) => left.feiTicketId.localeCompare(right.feiTicketId)),
    source: 'WEB',
    operator: {
      operatorId: '',
      operatorName: '交出员',
      operatorRole: '裁片仓交出员',
    },
  })
  return {
    eventId: 'EVENT-HANDOVER-CURRENT-CYCLE',
    eventNo: 'EVENT-HANDOVER-CURRENT-CYCLE',
    idempotencyKey: `whole-bag-handover:${handoverRecordId}`,
    eventType: '新增交出记录',
    eventSource: 'WEB',
    eventStatus: '已记录',
    occurredAt: '2026-08-01 09:00',
    createdAt: '2026-08-01 09:00',
    operatorId: '',
    operatorName: '交出员',
    operatorRole: '裁片仓交出员',
    refs: {
      productionOrderId: ticketSnapshot[0].productionOrderId,
      productionOrderNo: ticketSnapshot[0].productionOrderNo,
      transferBagCode: currentUse.bagCode,
      usageCycleId: currentUse.usageCycleId || undefined,
      handoverOrderId,
      handoverRecordId,
      handoverLegId,
      feiTicketIds: ticketSnapshot.map((item) => item.feiTicketId),
      feiTicketNos: ticketSnapshot.map((item) => item.feiTicketNo),
      sewingTaskIds,
      sewingTaskNos,
    },
    inventoryEffect: {
      inventoryScope: '裁床待交出仓',
      direction: 'OUT',
      qty: totalPieceQty,
      unit: '片',
      fromWarehouseArea: '待交出 A 区',
      fromLocationCode: 'A-01',
    },
    payload: {
      canonicalIntent,
      handoverLegId,
      handoverOrderId,
      handoverOrderNo,
      handoverRecordId,
      handoverRecordNo,
      receiverType: '车缝厂',
      receiverId: assignments[0].receiverFactoryId,
      receiverName: assignments[0].receiverFactoryName,
      transferBagUses: [{
        bagUseId: currentUse.usageCycleId,
        bagCode: currentUse.bagCode,
        containedFeiTicketIds: ticketSnapshot.map((item) => item.feiTicketId),
        totalPieceQty,
        sewingTaskIds,
        sewingTaskNos,
        ticketSnapshot,
        sourceWarehouseArea: '待交出 A 区',
        sourceLocationCode: 'A-01',
      }],
      feiTicketItems: ticketSnapshot.map((item) => ({
        feiTicketId: item.feiTicketId,
        feiTicketNo: item.feiTicketNo,
        pieceQty: item.pieceQty,
        unit: '片',
      })),
      currentHandedOverQty: totalPieceQty,
      submittedAt: '2026-08-01 09:00',
      submittedBy: '交出员',
    },
  }
}

const wholeBagTickets = Array.from({ length: 12 }, (_, index) => wholeBagTicket(index + 1))
const wholeBagCurrentUse: TransferBagCurrentUse = {
  bagCode: 'BAG-MULTI-TASK',
  usageCycleId: 'usage:BAG-MULTI-TASK:1',
  productionOrderNo: 'PO-001',
  tickets: wholeBagTickets,
  mainStatus: 'IN_USE',
  flowStage: 'INBOUND_STORED',
  latestHandoverEventId: '',
}
const sameFactoryAssignments = wholeBagTickets.map((ticket, index) =>
  assignmentFor(ticket, index < 7 ? 'SEW-01' : 'SEW-02'))
const sameFactorySubmittedSnapshot = submittedSnapshotFor(wholeBagTickets, sameFactoryAssignments)

const sameFactoryEligibility = resolveWholeBagHandoverEligibility({
  currentUse: wholeBagCurrentUse,
  assignments: sameFactoryAssignments,
  submittedTicketSnapshot: sameFactorySubmittedSnapshot,
})
assert.equal(sameFactoryEligibility.ok, true, '同一工厂的两个车缝任务必须允许整袋交出')
assert.deepEqual(sameFactoryEligibility.sewingTaskIds, ['SEW-01-ID', 'SEW-02-ID'], '任务 ID 必须去重并保持菲票分配顺序')
assert.deepEqual(sameFactoryEligibility.sewingTaskNos, ['SEW-01', 'SEW-02'], '任务号必须去重并保持菲票分配顺序')
assert.equal(sameFactoryEligibility.receiverFactoryId, 'FACTORY-A', '整袋交出只能形成一个接收工厂')
assert.equal(sameFactoryEligibility.receiverFactoryName, '车缝一厂')
assert.equal(sameFactoryEligibility.ticketSnapshot.length, 12)
assert.equal(sameFactoryEligibility.ticketSnapshot[0].sewingTaskNo, 'SEW-01', '本次分配必须覆盖历史任务字段')
assert.equal(wholeBagCurrentUse.tickets[0].sewingTaskId, '历史任务不得作为资格来源', '资格计算不得修改当前袋票关系')
assert.notEqual(sameFactoryEligibility.ticketSnapshot[0], wholeBagCurrentUse.tickets[0], '交出快照必须是不可变深拷贝')

const crossFactoryAssignments = sameFactoryAssignments.map((assignment, index) =>
  index === 11
    ? { ...assignment, receiverFactoryId: 'FACTORY-B', receiverFactoryName: '车缝二厂' }
    : assignment)
const crossFactoryEligibility = resolveWholeBagHandoverEligibility({
  currentUse: wholeBagCurrentUse,
  assignments: crossFactoryAssignments,
  submittedTicketSnapshot: submittedSnapshotFor(wholeBagTickets, crossFactoryAssignments),
})
assert.equal(crossFactoryEligibility.ok, false)
assert.equal(crossFactoryEligibility.reason, '袋内菲票分配给多个车缝工厂，请先拆袋重装。')

const mixedProductionOrderCurrentUse: TransferBagCurrentUse = {
  ...wholeBagCurrentUse,
  tickets: wholeBagTickets.map((ticket, index) =>
    index === 11 ? { ...ticket, productionOrderNo: 'PO-002' } : ticket),
}
const currentHandoverEvent = currentCycleHandoverEvent(wholeBagCurrentUse, sameFactoryAssignments)
assertEligibilityReason({
  currentUse: { ...wholeBagCurrentUse, flowStage: 'PACKED' },
  assignments: sameFactoryAssignments,
  submittedTicketSnapshot: undefined as never,
}, '当前中转袋不是入仓暂存中或待交出，不能整袋交出。', 'PACKED 非空袋必须先返回阶段错误')
assertEligibilityReason({
  currentUse: { ...wholeBagCurrentUse, tickets: [] },
  assignments: [],
  submittedTicketSnapshot: undefined as never,
}, '当前中转袋没有菲票，不能整袋交出。', 'INBOUND 空袋必须先返回袋空错误')
assertEligibilityReason({
  currentUse: mixedProductionOrderCurrentUse,
  assignments: sameFactoryAssignments,
  submittedTicketSnapshot: undefined as never,
}, '一个中转袋当前只能包含同一生产单的菲票。', '混生产单必须先返回单生产单错误')
assertEligibilityReason({
  currentUse: { ...wholeBagCurrentUse, mainStatus: 'IDLE', flowStage: null, tickets: [] },
  assignments: [],
  submittedTicketSnapshot: [] as never,
}, '当前中转袋不是入仓暂存中或待交出，不能整袋交出。', 'IDLE 空袋必须先返回阶段错误')
assertEligibilityReason({
  currentUse: { ...mixedProductionOrderCurrentUse, compatibilityBlockedReason: '历史兼容阻断' },
  assignments: sameFactoryAssignments,
  submittedTicketSnapshot: undefined as never,
}, '一个中转袋当前只能包含同一生产单的菲票。', 'compatibility 阻断不得抢在单生产单错误之前')
assertEligibilityReason({
  currentUse: wholeBagCurrentUse,
  assignments: sameFactoryAssignments.slice(0, -1),
  submittedTicketSnapshot: undefined as never,
}, '袋内菲票未分配车缝任务：FEI-12。', '逐票分配错误必须先于快照错误')
assertEligibilityReason({
  currentUse: wholeBagCurrentUse,
  assignments: crossFactoryAssignments,
  existingHandoverEvents: [currentHandoverEvent],
  submittedTicketSnapshot: undefined as never,
}, '袋内菲票分配给多个车缝工厂，请先拆袋重装。', '唯一接收工厂错误必须先于周期重复和快照错误')
assertEligibilityReason({
  currentUse: wholeBagCurrentUse,
  assignments: sameFactoryAssignments,
  existingHandoverEvents: [currentHandoverEvent],
  submittedTicketSnapshot: undefined as never,
}, '当前中转袋使用周期已有未完成或重复交出事实，不能再次交出。', '当前周期重复错误必须先于快照错误')
assertEligibilityReason({
  currentUse: { ...wholeBagCurrentUse, compatibilityBlockedReason: '历史兼容阻断' },
  assignments: sameFactoryAssignments,
  submittedTicketSnapshot: undefined as never,
}, '整袋交出的完整提交快照必填。', 'compatibility 阻断必须位于完整快照校验之后')
assertEligibilityReason({
  currentUse: { ...wholeBagCurrentUse, compatibilityBlockedReason: '历史兼容阻断' },
  assignments: sameFactoryAssignments,
  submittedTicketSnapshot: sameFactorySubmittedSnapshot,
}, '历史兼容阻断', '核心有序校验通过后才允许返回 compatibility 阻断')

assert.equal(resolveWholeBagHandoverEligibility({
  currentUse: wholeBagCurrentUse,
  assignments: sameFactoryAssignments.slice(0, -1),
  submittedTicketSnapshot: sameFactorySubmittedSnapshot,
}).ok, false, '任一当前菲票未分配必须失败')
assert.match(resolveWholeBagHandoverEligibility({
  currentUse: wholeBagCurrentUse,
  assignments: [...sameFactoryAssignments, { ...sameFactoryAssignments[0] }],
  submittedTicketSnapshot: sameFactorySubmittedSnapshot,
}).reason, /重复分配/, '同一菲票即使同工厂同任务也不能静默去重')
assert.match(resolveWholeBagHandoverEligibility({
  currentUse: wholeBagCurrentUse,
  assignments: [...sameFactoryAssignments, assignmentFor(wholeBagTicket(99), 'SEW-01')],
  submittedTicketSnapshot: sameFactorySubmittedSnapshot,
}).reason, /额外菲票/, '分配中存在当前袋外菲票必须失败')

;(['PACKED', 'HANDED_OVER_WAITING_RETURN', null] as const).forEach((flowStage) => {
  assert.equal(resolveWholeBagHandoverEligibility({
    currentUse: { ...wholeBagCurrentUse, flowStage },
    assignments: sameFactoryAssignments,
    submittedTicketSnapshot: sameFactorySubmittedSnapshot,
  }).ok, false, `${flowStage || 'IDLE / DISABLED'} 阶段不得本次整袋交出`)
})
;(['IDLE', 'DISABLED'] as const).forEach((mainStatus) => {
  assert.equal(resolveWholeBagHandoverEligibility({
    currentUse: { ...wholeBagCurrentUse, mainStatus, flowStage: null },
    assignments: sameFactoryAssignments,
    submittedTicketSnapshot: sameFactorySubmittedSnapshot,
  }).ok, false, `${mainStatus} 主状态不得本次整袋交出`)
})
assert.equal(resolveWholeBagHandoverEligibility({
  currentUse: { ...wholeBagCurrentUse, tickets: [] },
  assignments: [],
  submittedTicketSnapshot: [],
}).ok, false, '当前袋为空必须失败')
assert.equal(resolveWholeBagHandoverEligibility({
  currentUse: {
    ...wholeBagCurrentUse,
    tickets: wholeBagTickets.map((ticket, index) =>
      index === 11 ? { ...ticket, productionOrderNo: 'PO-002' } : ticket),
  },
  assignments: sameFactoryAssignments,
  submittedTicketSnapshot: sameFactorySubmittedSnapshot,
}).ok, false, '混生产单必须失败')
assert.match(resolveWholeBagHandoverEligibility({
  currentUse: wholeBagCurrentUse,
  assignments: sameFactoryAssignments,
  submittedTicketSnapshot: sameFactorySubmittedSnapshot.map((ticket, index) =>
    index === 0 ? { ...ticket, pieceQty: ticket.pieceQty + 1 } : ticket),
}).reason, /快照/, '提交快照与当前关系不一致必须失败')
assert.match(resolveWholeBagHandoverEligibility({
  currentUse: wholeBagCurrentUse,
  assignments: sameFactoryAssignments,
  submittedTicketSnapshot: sameFactorySubmittedSnapshot,
  existingHandoverEvents: [currentCycleHandoverEvent(
    wholeBagCurrentUse,
    sameFactoryAssignments,
    'HR-EXISTING',
  )],
}).reason, /已有未完成或重复交出事实/, '已有未完成交出事实必须失败')
assert.equal(resolveWholeBagHandoverEligibility({
  currentUse: wholeBagCurrentUse,
  assignments: sameFactoryAssignments,
  submittedTicketSnapshot: sameFactorySubmittedSnapshot,
  existingHandoverEvents: [currentCycleHandoverEvent(
    { ...wholeBagCurrentUse, usageCycleId: 'usage:BAG-MULTI-TASK:OLD' },
    sameFactoryAssignments,
    'HR-OLD-CYCLE',
  )],
}).ok, true, '同一物理袋旧周期的历史交出不得阻断当前新周期')

const assignmentProjectionInput = [
  {
    inventoryRecordId: 'INV-ASSIGN-01',
    feiTicketId: 'FEI-ASSIGN-01',
    feiTicketNo: 'FT-ASSIGN-01',
    cutOrderId: 'CUT-ASSIGN-01',
    cutOrderNo: 'CUT-ASSIGN-01',
    productionOrderId: 'PO-ASSIGN-ID',
    productionOrderNo: 'PO-ASSIGN',
    spuCode: 'SPU-ASSIGN',
    color: '炭灰',
    size: 'M',
    partName: '前片',
    pieceQty: 7,
    pieceSequenceLabel: '1-7',
    tempBagCode: 'BAG-CURRENT-ASSIGN',
    warehouseArea: '待交出 A 区',
    locationCode: 'A-01',
    inboundAt: '2026-08-01 08:00',
    inventoryStatus: '待分配',
    printStatus: '已打印',
    voidStatus: '有效',
  },
  {
    inventoryRecordId: 'INV-ASSIGN-02',
    feiTicketId: 'FEI-ASSIGN-02',
    feiTicketNo: 'FT-ASSIGN-02',
    cutOrderId: 'CUT-ASSIGN-02',
    cutOrderNo: 'CUT-ASSIGN-02',
    productionOrderId: 'PO-ASSIGN-ID',
    productionOrderNo: 'PO-ASSIGN',
    spuCode: 'SPU-ASSIGN',
    color: '深蓝',
    size: 'L',
    partName: '后片',
    pieceQty: 5,
    pieceSequenceLabel: '1-5',
    tempBagCode: 'BAG-CURRENT-ASSIGN',
    warehouseArea: '待交出 A 区',
    locationCode: 'A-01',
    inboundAt: '2026-08-01 08:00',
    inventoryStatus: '待分配',
    printStatus: '已打印',
    voidStatus: '有效',
  },
]
const assignmentProjectionInputBefore = structuredClone(assignmentProjectionInput)
const assignmentProjection = buildSewingTaskAllocationProjectionFromInventory(assignmentProjectionInput)
assert.equal(assignmentProjection.assignments.length, 2, '车缝分配投影必须逐票输出任务和接收工厂归属')
assert(assignmentProjection.assignments.every((assignment) =>
  assignment.feiTicketId
  && assignment.feiTicketNo
  && assignment.sewingTaskId
  && assignment.sewingTaskNo
  && assignment.receiverFactoryId
  && assignment.receiverFactoryName), '逐票分配字段必须完整')
assert.deepEqual(assignmentProjectionInput, assignmentProjectionInputBefore, '车缝分配不得修改输入库存或当前袋票关系')
const pickingCompatibility = buildHandoverPickingTaskProjectionFromAllocationProjection(assignmentProjection)
assert.deepEqual(
  [...new Set(pickingCompatibility.targetTransferBags.map((bag) => bag.bagCode))],
  ['BAG-CURRENT-ASSIGN'],
  '旧视图兼容投影只能读取当前物理袋，不得生成结果袋',
)
assert.equal(pickingCompatibility.targetTransferBags.length, 1, '同一物理袋不得按车缝任务拆成多个兼容袋投影')
assert.deepEqual(
  pickingCompatibility.targetTransferBags[0].sewingTaskIds,
  assignmentProjection.allocations.map((allocation) => allocation.sewingTaskId),
  '7+5 同袋兼容投影必须保留两个车缝任务',
)
assert.deepEqual(
  pickingCompatibility.targetTransferBags[0].containedFeiTickets.map((ticket) => ticket.feiTicketId),
  ['FEI-ASSIGN-01', 'FEI-ASSIGN-02'],
  '7+5 同袋兼容投影必须保留两张当前菲票',
)
assert.equal(pickingCompatibility.targetTransferBags[0].totalPieceQty, 12, '7+5 同袋兼容投影总片数必须为 12')
assert(pickingCompatibility.tasks.every((task) =>
  task.targetTransferBags.every((bag) =>
    bag.containedFeiTickets.length === 2
    && bag.sewingTaskIds?.length === 2
    && bag.totalPieceQty === 12)), '任务下兼容袋视图也必须复用统一物理袋全量事实')

const duplicateTicketProjection = structuredClone(assignmentProjection)
duplicateTicketProjection.allocations[1].allocatedItems[0].feiTicketId =
  duplicateTicketProjection.allocations[0].allocatedItems[0].feiTicketId
assert.throws(
  () => buildHandoverPickingTaskProjectionFromAllocationProjection(duplicateTicketProjection),
  /菲票.*重复.*物理袋聚合/,
  '物理袋聚合前必须阻断全局重复菲票，不能静默合并或重复累加',
)

const crossProductionOrderProjection = structuredClone(assignmentProjection)
crossProductionOrderProjection.allocations[1].allocatedItems[0].productionOrderNo = 'PO-OTHER'
assert.throws(
  () => buildHandoverPickingTaskProjectionFromAllocationProjection(crossProductionOrderProjection),
  /同一物理袋.*同一生产单/,
  '同一物理袋出现跨生产单菲票时必须显式阻断',
)

const conflictingTaskMappingProjection = structuredClone(assignmentProjection)
conflictingTaskMappingProjection.allocations[1].sewingTaskId =
  conflictingTaskMappingProjection.allocations[0].sewingTaskId
assert.throws(
  () => buildHandoverPickingTaskProjectionFromAllocationProjection(conflictingTaskMappingProjection),
  /车缝任务 ID.*任务号.*一一对应/,
  '同一任务 ID 映射到不同任务号时必须显式阻断',
)

const conflictingTaskNoMappingProjection = structuredClone(assignmentProjection)
conflictingTaskNoMappingProjection.allocations[1].sewingTaskNo =
  conflictingTaskNoMappingProjection.allocations[0].sewingTaskNo
assert.throws(
  () => buildHandoverPickingTaskProjectionFromAllocationProjection(conflictingTaskNoMappingProjection),
  /车缝任务号.*任务 ID.*一一对应/,
  '同一任务号映射到不同任务 ID 时必须显式阻断',
)

assertNotContains(dataSource, buildToken('BAG', '-PICK-'), '车缝任务分配不得预造或模拟中转袋')

ensureExists('src/data/fcs/cutting/sewing-dispatch.ts')
ensureExists('src/pages/process-factory/cutting/warehouse-hub.ts')
ensureExists('scripts/check-cutting-sewing-dispatch.ts')
assertContains(packageSource, 'check:cutting-sewing-dispatch', 'package.json 缺少裁片交出检查命令')

;[
  'export interface CuttingSewingDispatchOrder',
  'export interface CuttingSewingDispatchBatch',
  'export interface CuttingSewingDispatchSkuQtyLine',
  'export interface CuttingSewingTransferBag',
  'export interface CuttingSewingTransferBagPieceLine',
  'export interface CuttingSewingDispatchValidationResult',
  'buildRequiredCutPiecesForSewingDispatch',
  'getEligibleFeiTicketsForSewingDispatch',
  'createCuttingSewingDispatchOrder',
  'createCuttingSewingDispatchBatch',
  'createCuttingSewingTransferBags',
  'scanFeiTicketIntoTransferBag',
  'scanFeiTicketIntoTransferBagOnMobile',
  'removeFeiTicketFromTransferBag',
  'removeTransferBagContentItemBeforeHandover',
  'validateTransferBagForMixedPacking',
  'validateTransferBagCompleteness',
  'validateDispatchBatchCompleteness',
  'submitCuttingSewingDispatchBatch',
  'syncSewingReceiveWritebackToDispatch',
  'writebackSewingReceiveByTransferBag',
  'writebackSewingReceiveByFeiTicket',
  'finalizeCombinedSewingWriteback',
  'syncSewingQuantityObjectionToDispatch',
  'getCuttingSewingDispatchProgressByProductionOrder',
  'assertSewingDispatchAllowed',
].forEach((token) => {
  assertContains(dataSource, token, `裁片交出数据层缺少：${token}`)
})

;[
  'transferOrderNo',
  'transferOrderQrValue',
  'transferBagNo',
  'transferBagQrValue',
  'bagMode',
  'contentItems',
  'packStatus',
  'currentLocation',
  'plannedSkuQtyLines',
  'requiredPieceQty',
  'scannedPieceQty',
  'missingPieceQty',
  'overPieceQty',
  'specialCraftReturnStatus',
].forEach((token) => {
  assertContains(dataSource, token, `裁片交出模型缺少字段：${token}`)
})

const dispatchOrders = listCuttingSewingDispatchOrders()
const dispatchBatches = listCuttingSewingDispatchBatches()
const transferBags = listCuttingSewingTransferBags()
const validationResults = listCuttingSewingDispatchValidationResults()

assert(dispatchOrders.length > 0, '必须存在裁床交出单数据')
assert(dispatchBatches.length > 0, '必须存在本次交出记录数据')
assert(transferBags.length > 0, '必须存在中转袋数据')
assert(validationResults.length > 0, '必须存在交出缺口核对结果')
assert(dispatchOrders.some((order) => order.dispatchBatchIds.length >= 2), '必须支持同一生产单多次交出')
assert(dispatchBatches.every((batch) => batch.plannedSkuQtyLines.length > 0), '每次交出必须包含颜色 / 尺码 / 件数')
assert(new Set(dispatchBatches.map((batch) => batch.transferOrderNo)).size === dispatchBatches.length, '中转单号必须唯一')
assert(new Set(transferBags.map((bag) => bag.transferBagNo)).size === transferBags.length, '中转袋号必须唯一')
assert(dispatchBatches.every((batch) => batch.transferOrderQrValue.length > 0), '中转单必须有二维码值')
assert(transferBags.every((bag) => bag.transferBagQrValue.length > 0), '中转袋必须有二维码值')

const sampleForRequiredPieces = dispatchBatches
  .map((batch) => {
    const order = productionOrders.find((item) => item.productionOrderId === batch.productionOrderId)
    const snapshot = order ? getProductionOrderTechPackSnapshot(order.productionOrderId) : undefined
    const requiredResult = order && snapshot
      ? buildRequiredCutPiecesForSewingDispatch(order, snapshot, batch.plannedSkuQtyLines)
      : undefined
    return {
      batch,
      order,
      snapshot,
      requiredResult,
    }
  })
  .find((item) => item.order && item.snapshot && item.requiredResult && item.requiredResult.requiredPieceLines.length > 0)
const sampleBatch = sampleForRequiredPieces?.batch || dispatchBatches[0]
const sampleOrder = sampleForRequiredPieces?.order || productionOrders.find((order) => order.productionOrderId === sampleBatch.productionOrderId)
assert(sampleOrder, '示例交出记录必须关联生产单')
const sampleSnapshot = sampleForRequiredPieces?.snapshot || getProductionOrderTechPackSnapshot(sampleOrder.productionOrderId)
assert(sampleSnapshot, '示例交出记录必须能读取技术包快照')
const requiredResult = sampleForRequiredPieces?.requiredResult || buildRequiredCutPiecesForSewingDispatch(sampleOrder, sampleSnapshot, sampleBatch.plannedSkuQtyLines)
assert(requiredResult.requiredPieceLines.length > 0, '必须能按技术包计算应配裁片')
assert(requiredResult.requiredPieceLines.every((line) => line.requiredPieceQty === line.garmentQty * line.pieceCountPerGarment), '应配数量必须等于本次交出件数乘每件片数')
assert(requiredResult.requiredPieceLines.every((line) => line.colorName && line.sizeCode && line.partName), '应配裁片必须按颜色、尺码、部位计算')

const eligibleTickets = getEligibleFeiTicketsForSewingDispatch({ productionOrderId: sampleBatch.productionOrderId })
assert(eligibleTickets.length > 0, '必须存在可交出的菲票筛选结果')
assert(eligibleTickets.every((ticket) => ticket.productionOrderId === sampleBatch.productionOrderId), '可交出菲票必须属于当前生产单')

const completeBag = transferBags.find((bag) => bag.completeStatus === '已核对')
if (completeBag) {
  const completeBagValidation = validateTransferBagCompleteness(completeBag.transferBagId)
  assert.equal(completeBagValidation.updatedTransferBag.completeStatus, '已核对', '已核对中转袋必须通过缺口核对')
  assert(completeBagValidation.validationResults.every((item) => !item.blocking), '已核对中转袋不能存在阻塞项')
}

const incompleteBag = transferBags.find((bag) => bag.completeStatus === '有缺口')
assert(incompleteBag, '必须存在有缺口中转袋示例')
const incompleteBagValidation = validateTransferBagCompleteness(incompleteBag.transferBagId)
assert(incompleteBagValidation.validationResults.every((item) => !item.blocking), '缺少裁片或特殊工艺未回仓只能形成交出后缺口')
assert(
  incompleteBagValidation.validationResults.some((item) => item.validationType === '缺少裁片' || item.validationType === '特殊工艺未回仓'),
  '有缺口中转袋必须体现缺少裁片或特殊工艺未回仓',
)

const completeBatch = dispatchBatches.find((batch) => batch.completeStatus === '已核对')
if (completeBatch) {
  const completeBatchValidation = validateDispatchBatchCompleteness(completeBatch.dispatchBatchId)
  assert.equal(completeBatchValidation.updatedDispatchBatch.completeStatus, '已核对', '已核对批次必须通过缺口核对')
  assert.doesNotThrow(() => assertSewingDispatchAllowed(completeBatch.dispatchBatchId), '已核对批次应允许提交交出')
}

const gapBatch = dispatchBatches.find((batch) => batch.completeStatus === '有缺口')
assert(gapBatch, '必须存在有缺口交出批次')
const gapBatchValidation = validateDispatchBatchCompleteness(gapBatch.dispatchBatchId)
assert.equal(gapBatchValidation.updatedDispatchBatch.completeStatus, '有缺口', '有缺口批次必须保留缺口结果')
assert.doesNotThrow(() => assertSewingDispatchAllowed(gapBatch.dispatchBatchId), '有缺口批次仍应允许提交交出')

assert(validationResults.some((item) => item.validationType === '缺少裁片' && !item.blocking), '缺少裁片必须作为交出后缺口展示')
assert(dataSource.includes('特殊工艺未回仓，交出后将形成缺口'), '特殊工艺未回仓必须作为交出后缺口展示')
assert(dataSource.includes('裁片超出') && dataSource.includes('overPieceQty'), '裁片超出必须按差异追踪')
assert(dataSource.includes('差异待处理不阻断裁片交出'), '特殊工艺差异待处理不应阻止已回仓裁片继续交出')
assert(dataSource.includes('currentQty > 0'), '特殊工艺已回仓裁片继续交出仍必须 currentQty 大于 0')
assert(dataSource.includes('菲票重复') && dataSource.includes('菲票已发出'), '必须阻断重复或已发出菲票')

const handedOverBatch = dispatchBatches.find((batch) => batch.handoverRecordId)
assert(handedOverBatch?.handoverRecordId, '提交交出必须创建现有交出记录')
const handoverProjection = getCuttingSewingDispatchByHandoverRecordId(handedOverBatch.handoverRecordId)
assert(handoverProjection.dispatchBatch?.transferOrderNo === handedOverBatch.transferOrderNo, '交出记录必须能反查中转单')
assert(handoverProjection.transferBags.length > 0, '交出记录必须能反查中转袋')
assert(dataSource.includes('createFactoryHandoverRecord'), '提交交出必须调用现有交出记录逻辑')
assert(dataSource.includes('linkHandoverRecordToOutboundRecord'), '提交交出必须触发出库联动')
assert(dataSource.includes("receiverKind: '后道工厂'") && dataSource.includes('车缝厂'), '交出接收方必须是车缝厂')
assert(dataSource.includes('sourceFactoryName: order.cuttingFactoryName') && dataSource.includes('sourceFactoryId: order.cuttingFactoryId'), '交出发出方必须是裁床厂')
assert(dataSource.includes('syncSewingReceiveWritebackToDispatch'), '车缝厂回写必须同步交出状态')
assert(dataSource.includes('syncSewingQuantityObjectionToDispatch'), '数量异议必须同步异议中状态')
assert(linkageSource.includes('buildOutboundRecordFromHandoverRecord'), '出库联动必须继续复用 Prompt 4')

const inboundRecords = listFactoryWarehouseInboundRecords()
assert(!inboundRecords.some((record) => record.factoryName.includes('车缝厂') || String(record.sourceFactoryName || '').includes('车缝厂')), `不应为${buildToken('车', '缝')}接收方生成内部仓记录`)
assert(!dataSource.includes(buildToken('车', '缝厂', ' · ', '待加工仓')), `不应为${buildToken('车', '缝')}接收方生成${buildToken('待加工', '仓')}`)
assert(!dataSource.includes(buildToken('车', '缝厂', ' · ', '待交出仓')), `不应为${buildToken('车', '缝')}接收方生成${buildToken('待交出', '仓')}`)
assert(!dataSource.includes('sewingFactoryWarehouse'), `不应为${buildToken('车', '缝')}接收方创建内部仓对象`)

const progress = getCuttingSewingDispatchProgressByProductionOrder(sampleBatch.productionOrderId)
assert(progress.totalProductionQty > 0, '交出进度必须包含生产总数')
assert(progress.dispatchBatchCount >= 1, '交出进度必须包含交出记录数')
assert(typeof progress.canCreateNextBatch === 'boolean', '交出进度必须输出是否可继续交出')
const summary = getCuttingSewingDispatchSummary()
assert(summary.remainingGarmentQty >= 0, '交出汇总必须包含剩余未交出件数')

;[
  buildToken('交出单'),
  buildToken('交出', '记录'),
  buildToken('车缝任务分配'),
  buildToken('分拣装袋'),
  buildToken('裁片库存'),
  buildToken('特殊工艺回仓'),
].forEach((token) => {
  assertContains(sewingDispatchPageAndMetaSource, token, `裁片交出页面缺少：${token}`)
})

;[
  buildToken('中转袋业务阶段'),
  buildToken('入仓暂存'),
  buildToken('交出装袋'),
  buildToken('袋内菲票明细'),
  buildToken('差异类型'),
].forEach((token) => {
  assertContains(transferBagsPageSource, token, `中转袋页面缺少裁片交出字段：${token}`)
})

;[
  buildToken('分拣装袋'),
].forEach((token) => {
  assertContains(sewingDispatchPageAndMetaSource, token, `待交出仓页面缺少分拣装袋入口：${token}`)
})

;[
  buildToken('中转单号'),
  buildToken('中转袋号'),
  buildToken('交出状态'),
  buildToken('是否已装袋'),
  buildToken('是否已交出'),
  buildToken('车缝回写状态'),
  buildToken('特殊工艺回仓状态'),
].forEach((token) => {
  assertContains(feiTicketsPageSource, token, `菲票页面缺少交出状态：${token}`)
})

;[
  buildToken('生产总数'),
  buildToken('累计已交出件数'),
  buildToken('剩余未交出件数'),
  buildToken('交出记录数'),
  buildToken('可继续新增交出记录'),
  buildToken('缺口结果'),
].forEach((token) => {
  assertContains(progressSource + summarySource, token, `裁床生产进度或裁剪总结缺少交出汇总：${token}`)
})

;[
  buildToken('待交出数量'),
].forEach((token) => {
  assertContains(orderDetailSource, token, `生产单详情缺少裁片交出汇总：${token}`)
})

;[
  buildToken('中转单'),
  buildToken('中转袋'),
  buildToken('菲票数'),
  buildToken('本次交出件数'),
  buildToken('裁片数量'),
].forEach((token) => {
  assertContains(handoverSource, token, `工厂端交接缺少裁片交出信息：${token}`)
})

assertContains(cuttingMetaSource, 'sewing-dispatch', '裁片交出页面缺少裁床菜单元信息')
assertContains(finalAcceptanceSource, 'check:cutting-sewing-dispatch', '最终验收检查缺少裁片交出命令')
assertContains(progressStatisticsSource, 'buildSewingDispatchProgressSnapshot', '统计与进度联动缺少裁片交出进度聚合')
assertContains(progressStatisticsSource, 'getCuttingSewingDispatchProgressByProductionOrder', '裁片交出进度必须被统计联动消费')
assertContains(dataSource, '交出后缺口', '裁片缺口必须在交出记录中保留为结果信息')
;[
  'mixedTransferBagCount',
  'packedTransferBagCount',
  'scannedReceivedTransferBagCount',
  'partialWritebackTransferBagCount',
  'bagDifferenceCount',
  'feiTicketDifferenceCount',
  'transferBagCombinedWritebackStatus',
  'receivedTransferBagCount',
  'receivedFeiTicketCount',
].forEach((token) => {
  assertContains(progressStatisticsSource, token, `裁片交出袋级/菲票级回写统计缺少：${token}`)
})
;[
  '允许混装',
  '交出装袋',
  '已回写',
  '待回写',
  '差异',
].forEach((token) => {
  assertContains(sewingDispatchPageSource + transferBagsPageSource + feiTicketsPageSource, token, `裁片交出页面缺少袋级 / 菲票级回写展示：${token}`)
})

;[
  buildToken('Warehouse', 'HandoverOrder'),
  buildToken('Factory', 'OutboundOrder'),
  buildToken('仓库', '交出单'),
  buildToken('新', '交出框架'),
  buildToken('Cutting', 'Sewing', 'HandoverOrder'),
].forEach((token) => {
  assertNotContains(dataSource + sewingDispatchPageSource + handoverSource, token, `不应新增第二套交出框架：${token}`)
})

;[
  buildToken('特殊工艺', '厂', '直接发', '车', '缝'),
  buildToken('直接发', '车', '缝'),
  buildToken('直接发', '成衣', '仓'),
  buildToken('手动', '出库'),
  buildToken('新增', '库存'),
  buildToken('车', '缝厂', '待加工仓'),
  buildToken('车', '缝厂', '待交出仓'),
  buildToken('来料', '仓'),
  buildToken('半成品', '仓'),
].forEach((token) => {
  assertNotContains(sewingDispatchPageSource + transferBagsPageSource + feiTicketsPageSource + orderDetailSource + handoverSource, token, `页面用户可见文案不应出现：${token}`)
})

;[
  buildToken('库存', '三态'),
  buildToken('上架', '任务'),
  buildToken('拣货', '波次'),
  buildToken('库位', '规则'),
  buildToken('完整', '库存账'),
  buildToken('axi', 'os'),
  buildToken('api', 'Client'),
  buildToken('use', 'Translation'),
  buildToken('loc', 'ales'),
  buildToken('trans', 'lations'),
].forEach((token) => {
  assertNotContains(dataSource + sewingDispatchPageSource + transferBagRuntimeSource, token, `本 prompt 不应新增越界能力：${token}`)
})

;[
  'transferOrderQrValue',
  'transferBagQrValue',
].forEach((token) => {
  assertContains(dataSource, token, `数据层必须保留二维码值字段：${token}`)
})
;[
  'FCS:',
  buildToken('QR ', 'payload'),
  'JSON.stringify',
].forEach((token) => {
  assertNotContains(sewingDispatchPageSource + transferBagsPageSource + feiTicketsPageSource + orderDetailSource + handoverSource, `>${token}<`, `页面不得直显二维码原始内容：${token}`)
})

console.log('check:cutting-sewing-dispatch passed')
