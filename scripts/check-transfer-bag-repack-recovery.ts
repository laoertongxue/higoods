#!/usr/bin/env node

// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import assert from 'node:assert/strict'
import {
  CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY,
  appendCuttingRuntimeEvent,
  listCuttingRuntimeEvents,
  type TransferBagRepackPayload,
  type TransferBagTicketFactSnapshot,
} from '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
import type { BrowserStorageLike } from '../src/data/browser-storage.ts'
import {
  eventTouchesTransferBag,
  isCompleteSuccessfulSpecialCraftHandoverEvent,
  isCompleteSuccessfulWholeBagHandoverEvent,
  resolveWholeBagHandoverEligibility,
  resolveTransferBagCurrentUse,
  submitWholeBagHandover,
  submitTransferBagRepack,
} from '../src/data/fcs/cutting/transfer-bag-operations.ts'
import type { FeiTicketSewingAssignment } from '../src/data/fcs/cutting/sewing-dispatch.ts'
import {
  createCarrierCycleRecord,
  deserializeTransferBagRuntimeStorage,
  type SewingTaskRefRecord,
  type TransferCarrierRecord,
} from '../src/data/fcs/cutting/transfer-bag-runtime.ts'
import {
  createTransferBagUsageDraft,
  deserializeTransferBagStorage,
  serializeTransferBagStorage,
  type TransferBagMaster,
  type TransferBagStore,
} from '../src/pages/process-factory/cutting/transfer-bags-model.ts'
import {
  appendWaitHandoverSpecialCraftHandoverEvent,
  appendWaitHandoverSpecialCraftReturnEvent,
  buildNextWaitHandoverHandoverLeg,
  buildWaitHandoverLocationOccupancyStates,
  buildWaitHandoverLifecycleByBagCode,
  buildWaitHandoverRuntimeProjection,
  listWaitHandoverLifecycleFacts,
} from '../src/pages/process-factory/cutting/wait-handover-runtime.ts'

function createMemoryStorage(): BrowserStorageLike {
  const records = new Map<string, string>()
  return {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
    removeItem: (key) => records.delete(key),
  }
}

function emptyPageTransferBagStore(): TransferBagStore {
  return {
    masters: [],
    usages: [],
    bindings: [],
    manifests: [],
    sewingTasks: [],
    auditTrail: [],
    returnReceipts: [],
    conditionRecords: [],
    reuseCycles: [],
    closureResults: [],
    returnAuditTrail: [],
    scrapRecords: [],
  }
}

function ticket(
  id: string,
  productionOrderNo: string,
  receiverFactoryId: string,
  pieceQty = 10,
): TransferBagTicketFactSnapshot {
  return {
    feiTicketId: id,
    feiTicketNo: `FT-${id}`,
    productionOrderId: `PO-ID-${productionOrderNo}`,
    productionOrderNo,
    cutOrderId: `CUT-ID-${id}`,
    cutOrderNo: `CUT-${id}`,
    color: id.endsWith('1') ? '深蓝' : '炭灰',
    size: id.endsWith('1') ? 'M' : 'L',
    partCode: id.endsWith('1') ? 'FRONT' : 'BACK',
    partName: id.endsWith('1') ? '前片' : '后片',
    pieceQty,
    sewingTaskId: `SEW-ID-${productionOrderNo}`,
    sewingTaskNo: `SEW-${productionOrderNo}`,
    receiverFactoryId,
    receiverFactoryName: `接收工厂-${receiverFactoryId}`,
  }
}

function assignment(
  value: TransferBagTicketFactSnapshot,
  taskNo: string,
  factoryId = 'FACTORY-HANDOVER',
): FeiTicketSewingAssignment {
  return {
    feiTicketId: value.feiTicketId,
    feiTicketNo: value.feiTicketNo,
    sewingTaskId: `${taskNo}-ID`,
    sewingTaskNo: taskNo,
    receiverFactoryId: factoryId,
    receiverFactoryName: factoryId === 'FACTORY-HANDOVER' ? '唯一接收车缝厂' : '其他车缝厂',
  }
}

function submittedSnapshotFor(
  tickets: TransferBagTicketFactSnapshot[],
  assignments: FeiTicketSewingAssignment[],
): TransferBagTicketFactSnapshot[] {
  const assignmentByTicketId = new Map(assignments.map((item) => [item.feiTicketId, item]))
  return tickets.map((item) => {
    const assigned = assignmentByTicketId.get(item.feiTicketId)
    assert(assigned, `菲票 ${item.feiTicketId} 缺少提交分配`)
    return {
      ...item,
      sewingTaskId: assigned.sewingTaskId,
      sewingTaskNo: assigned.sewingTaskNo,
      receiverFactoryId: assigned.receiverFactoryId,
      receiverFactoryName: assigned.receiverFactoryName,
    }
  })
}

function submittedSnapshotForRequest(
  tickets: TransferBagTicketFactSnapshot[],
  assignments: FeiTicketSewingAssignment[],
): TransferBagTicketFactSnapshot[] {
  const assignmentByTicketId = new Map(assignments.map((item) => [item.feiTicketId, item]))
  return tickets.map((item) => {
    const assigned = assignmentByTicketId.get(item.feiTicketId)
    return assigned
      ? {
          ...item,
          sewingTaskId: assigned.sewingTaskId,
          sewingTaskNo: assigned.sewingTaskNo,
          receiverFactoryId: assigned.receiverFactoryId,
          receiverFactoryName: assigned.receiverFactoryName,
        }
      : { ...item }
  })
}

function handoverInput(
  bagCode: string,
  usageCycleId: string,
  tickets: TransferBagTicketFactSnapshot[],
  assignments: FeiTicketSewingAssignment[],
  overrides: Partial<Parameters<typeof submitWholeBagHandover>[0]> = {},
): Parameters<typeof submitWholeBagHandover>[0] {
  return {
    bagCode,
    usageCycleId,
    handoverOrderId: `HO-${bagCode}`,
    handoverOrderNo: `HO-${bagCode}`,
    handoverRecordId: `HR-${bagCode}`,
    handoverRecordNo: `HR-${bagCode}`,
    assignments,
    submittedTicketSnapshot: submittedSnapshotForRequest(tickets, assignments),
    operator: {
      operatorId: 'OP-HANDOVER',
      operatorName: '整袋交出员',
      operatorRole: '裁片仓交出员',
    },
    source: 'WEB',
    occurredAt: '2026-08-01 10:00',
    ...overrides,
  }
}

function appendBagging(input: {
  storage: BrowserStorageLike
  bagCode: string
  usageCycleId: string
  tickets: TransferBagTicketFactSnapshot[]
  occurredAt?: string
}) {
  const first = input.tickets[0]
  return appendCuttingRuntimeEvent({
    eventType: '菲票装袋',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: input.occurredAt || '2026-08-01 08:00',
    operatorName: '装袋员',
    refs: {
      transferBagCode: input.bagCode,
      usageCycleId: input.usageCycleId,
      productionOrderId: first.productionOrderId,
      productionOrderNo: first.productionOrderNo,
      feiTicketIds: input.tickets.map((item) => item.feiTicketId),
      feiTicketNos: input.tickets.map((item) => item.feiTicketNo),
    },
    payload: {
      baggingRecordId: `bagging:${input.bagCode}`,
      bagCode: input.bagCode,
      feiTicketItems: input.tickets,
      totalPieceQty: input.tickets.reduce((sum, item) => sum + item.pieceQty, 0),
      mixedFlag: input.tickets.length > 1,
      baggingBy: '装袋员',
      baggingAt: input.occurredAt || '2026-08-01 08:00',
    },
  } as Parameters<typeof appendCuttingRuntimeEvent>[0], input.storage)
}

function appendInbound(input: {
  storage: BrowserStorageLike
  bagCode: string
  usageCycleId: string
  tickets: TransferBagTicketFactSnapshot[]
  occurredAt?: string
}) {
  const first = input.tickets[0]
  return appendCuttingRuntimeEvent({
    eventType: '中转袋入仓',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: input.occurredAt || '2026-08-01 08:10',
    operatorName: '入仓员',
    refs: {
      transferBagCode: input.bagCode,
      usageCycleId: input.usageCycleId,
      productionOrderNo: first.productionOrderNo,
      feiTicketIds: input.tickets.map((item) => item.feiTicketId),
    },
    inventoryEffect: {
      inventoryScope: '裁床待交出仓',
      direction: 'IN',
      qty: input.tickets.reduce((sum, item) => sum + item.pieceQty, 0),
      unit: '片',
      toWarehouseArea: '待交出 A 区',
      toLocationCode: `A-${input.bagCode}`,
    },
    payload: {
      tempBagUseId: `temp:${input.bagCode}`,
      bagCode: input.bagCode,
      warehouseArea: '待交出 A 区',
      locationCode: `A-${input.bagCode}`,
      inboundBy: '入仓员',
      inboundAt: input.occurredAt || '2026-08-01 08:10',
      feiTicketItems: input.tickets,
      totalPieceQty: input.tickets.reduce((sum, item) => sum + item.pieceQty, 0),
      mixedFlag: input.tickets.length > 1,
      locationRef: {
        factoryId: 'FACTORY-CUTTING',
        warehouseId: 'WAREHOUSE-WAIT-HANDOVER',
        warehouseKind: 'WAIT_HANDOVER',
        areaId: 'AREA-A',
        areaName: '待交出 A 区',
        shelfId: 'SHELF-A',
        shelfNo: 'A',
        locationId: `LOCATION-${input.bagCode}`,
        locationNo: `A-${input.bagCode}`,
      },
    },
  } as Parameters<typeof appendCuttingRuntimeEvent>[0], input.storage)
}

function appendReadyForHandover(input: {
  storage: BrowserStorageLike
  bagCode: string
  usageCycleId: string
  tickets: TransferBagTicketFactSnapshot[]
  occurredAt?: string
}) {
  return appendCuttingRuntimeEvent({
    eventType: '中转袋拆袋重装',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: input.occurredAt || '2026-08-01 09:30',
    operatorName: '重装员',
    refs: {
      repackBatchId: `REPACK-${input.bagCode}`,
      transferBagCodes: [input.bagCode],
      usageCycleId: input.usageCycleId,
      feiTicketIds: input.tickets.map((item) => item.feiTicketId),
    },
    payload: {
      repackBatchId: `REPACK-${input.bagCode}`,
      sourceBags: [],
      resultBags: [{
        bagCode: input.bagCode,
        usageCycleId: input.usageCycleId,
        reusedSourceBag: false,
        tickets: input.tickets,
      }],
      movedTickets: input.tickets.map((item) => ({
        feiTicketId: item.feiTicketId,
        fromBagCode: 'BAG-SOURCE',
        toBagCode: input.bagCode,
        pieceQty: item.pieceQty,
      })),
      confirmedAt: input.occurredAt || '2026-08-01 09:30',
      confirmedBy: '重装员',
    },
  }, input.storage)
}

function seedTwoSourceBags(storage: BrowserStorageLike) {
  const sourceA = [ticket('A1', 'PO-A', 'F-A', 12), ticket('A2', 'PO-A', 'F-A', 8)]
  const sourceB = [ticket('B1', 'PO-B', 'F-B', 9), ticket('B2', 'PO-B', 'F-B', 11)]
  appendBagging({ storage, bagCode: 'BAG-A', usageCycleId: 'usage:BAG-A:old', tickets: sourceA })
  appendInbound({ storage, bagCode: 'BAG-A', usageCycleId: 'usage:BAG-A:old', tickets: sourceA })
  appendBagging({ storage, bagCode: 'BAG-B', usageCycleId: 'usage:BAG-B:old', tickets: sourceB })
  appendInbound({ storage, bagCode: 'BAG-B', usageCycleId: 'usage:BAG-B:old', tickets: sourceB })
  return { sourceA, sourceB }
}

const operator = {
  operatorId: 'OP-REPACK',
  operatorName: '重装员',
  operatorRole: '裁片仓主管',
}

function repackInput(overrides: Partial<Parameters<typeof submitTransferBagRepack>[0]> = {}) {
  return {
    repackBatchId: 'REPACK-2-TO-2',
    sourceBagCodes: ['BAG-A', 'BAG-B'],
    results: [
      { bagCode: 'BAG-A', feiTicketIds: ['A1', 'A2'] },
      { bagCode: 'BAG-NEW', feiTicketIds: ['B1', 'B2'] },
    ],
    operator,
    source: 'WEB' as const,
    occurredAt: '2026-08-01 09:00',
    ...overrides,
  }
}

function assertRejectedWithoutWriting(
  storage: BrowserStorageLike,
  action: () => unknown,
  expected: RegExp,
  message: string,
): void {
  const before = listCuttingRuntimeEvents(storage).length
  assert.throws(action, expected, message)
  assert.equal(
    listCuttingRuntimeEvents(storage).length,
    before,
    `${message}，失败后不得新增事件`,
  )
}

function assertRejectedWithoutWritingExact(
  storage: BrowserStorageLike,
  action: () => unknown,
  expectedMessage: string,
  message: string,
): void {
  const before = listCuttingRuntimeEvents(storage).length
  assert.throws(
    action,
    (error: unknown) => error instanceof Error && error.message === expectedMessage,
    message,
  )
  assert.equal(
    listCuttingRuntimeEvents(storage).length,
    before,
    `${message}，失败后不得新增事件`,
  )
}

function appendLegacyBaggingConfirm(input: {
  storage: BrowserStorageLike
  sourceBagCode?: string
  targetBagCode?: string
  feiTicketIds: string[]
  occurredAt?: string
}) {
  return appendCuttingRuntimeEvent({
    eventType: '交出装袋确认',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: input.occurredAt || '2026-08-01 08:30',
    operatorName: '历史装袋确认员',
    refs: {
      transferBagCode: input.targetBagCode,
      usageCycleId: input.targetBagCode ? `usage:${input.targetBagCode}:legacy` : undefined,
      feiTicketIds: input.feiTicketIds,
    },
    payload: {
      sourceTempBagCode: input.sourceBagCode || '',
      targetTransferBagCode: input.targetBagCode || '',
      containedFeiTicketIds: input.feiTicketIds,
      scannedFeiTicketIds: input.feiTicketIds,
    },
  } as Parameters<typeof appendCuttingRuntimeEvent>[0], input.storage)
}

{
  const storage = createMemoryStorage()
  seedTwoSourceBags(storage)
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      results: [{ bagCode: 'BAG-RESULT', feiTicketIds: ['A1', 'B1', 'A2', 'B2'] }],
    }), storage),
    /同一生产单/,
    '结果袋混入两个生产单必须失败',
  )
}

{
  const storage = createMemoryStorage()
  const disabledTicket = ticket('DISABLED-1', 'PO-DISABLED', 'F-DISABLED')
  appendCuttingRuntimeEvent({
    eventType: '中转袋报废',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: '2026-08-01 08:00',
    operatorName: '资产管理员',
    refs: { transferBagCode: 'BAG-DISABLED-TERMINAL' },
    payload: { bagCode: 'BAG-DISABLED-TERMINAL' },
  }, storage)
  assert.equal(resolveTransferBagCurrentUse('BAG-DISABLED-TERMINAL', storage).mainStatus, 'DISABLED')

  appendBagging({
    storage,
    bagCode: 'BAG-DISABLED-TERMINAL',
    usageCycleId: 'usage:BAG-DISABLED-TERMINAL:invalid-bagging',
    tickets: [disabledTicket],
    occurredAt: '2026-08-01 09:00',
  })
  let disabled = resolveTransferBagCurrentUse('BAG-DISABLED-TERMINAL', storage)
  assert.deepEqual(
    [disabled.mainStatus, disabled.tickets, disabled.flowStage],
    ['DISABLED', [], null],
    '报废终态不得被后续装袋复活',
  )

  appendCuttingRuntimeEvent({
    eventType: '中转袋拆袋重装',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: '2026-08-01 10:00',
    operatorName: '异常重装员',
    refs: {
      repackBatchId: 'REPACK-DISABLED-INVALID',
      transferBagCodes: ['BAG-SOURCE-INVALID', 'BAG-DISABLED-TERMINAL'],
      feiTicketIds: ['DISABLED-1'],
    },
    payload: {
      repackBatchId: 'REPACK-DISABLED-INVALID',
      sourceBags: [],
      resultBags: [{
        bagCode: 'BAG-DISABLED-TERMINAL',
        usageCycleId: 'usage:BAG-DISABLED-TERMINAL:invalid-repack',
        reusedSourceBag: false,
        tickets: [disabledTicket],
      }],
      movedTickets: [],
      confirmedAt: '2026-08-01 10:00',
      confirmedBy: '异常重装员',
    },
  }, storage)
  disabled = resolveTransferBagCurrentUse('BAG-DISABLED-TERMINAL', storage)
  assert.deepEqual(
    [disabled.mainStatus, disabled.tickets, disabled.flowStage],
    ['DISABLED', [], null],
    '报废终态不得被后续重装复活',
  )

  appendCuttingRuntimeEvent({
    eventType: '中转袋回收',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: '2026-08-01 11:00',
    operatorName: '异常回收员',
    refs: { transferBagCode: 'BAG-DISABLED-TERMINAL' },
    payload: {
      bagCode: 'BAG-DISABLED-TERMINAL',
      physicalBagReceived: true,
      physicalBagEmpty: true,
    },
  }, storage)
  disabled = resolveTransferBagCurrentUse('BAG-DISABLED-TERMINAL', storage)
  assert.deepEqual(
    [disabled.mainStatus, disabled.tickets, disabled.flowStage],
    ['DISABLED', [], null],
    '报废终态不得被后续回收清回空闲',
  )
}

{
  const storage = createMemoryStorage()
  const occurredAt = '2026-08-01 08:00'
  const bagCode = 'BAG-SCRAP-SAME-MINUTE'
  const usageCycleId = `usage:${bagCode}:old`
  const currentTickets = [ticket('SCRAP-SAME-MINUTE-1', 'PO-SCRAP-SAME-MINUTE', 'F-SCRAP-SAME-MINUTE')]
  const bagging = appendBagging({ storage, bagCode, usageCycleId, tickets: currentTickets, occurredAt })
  const inbound = appendInbound({ storage, bagCode, usageCycleId, tickets: currentTickets, occurredAt })
  const invalidScrap = appendCuttingRuntimeEvent({
    eventType: '中转袋报废',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt,
    operatorName: '异常报废员',
    refs: { transferBagCode: bagCode, usageCycleId },
    payload: { bagCode, usageCycleId, reason: '使用中误报废' },
  }, storage)
  const repack = appendCuttingRuntimeEvent({
    eventType: '中转袋拆袋重装',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt,
    operatorName: '重装员',
    refs: {
      repackBatchId: 'REPACK-SCRAP-SAME-MINUTE',
      transferBagCodes: [bagCode],
      feiTicketIds: currentTickets.map((item) => item.feiTicketId),
    },
    payload: {
      repackBatchId: 'REPACK-SCRAP-SAME-MINUTE',
      sourceBags: [{ bagCode, usageCycleId, beforeTickets: currentTickets }],
      resultBags: [],
      movedTickets: [],
      confirmedAt: occurredAt,
      confirmedBy: '重装员',
    },
  }, storage)
  assert.deepEqual(
    [bagging, inbound, invalidScrap, repack].map((event) => event.ledgerSequence),
    [1, 2, 3, 4],
    '同分钟报废有效性测试必须使用真实账本因果序号',
  )
  assert.equal(resolveTransferBagCurrentUse(bagCode, storage).mainStatus, 'IDLE')
  const lifecycle = buildWaitHandoverLifecycleByBagCode(bagCode, storage)
  assert.deepEqual(
    [lifecycle.mainStatus, lifecycle.flowStage],
    ['IDLE', null],
    '使用中误报废发生后才关闭周期时，不得延迟生效为已报废',
  )
  assert.equal(
    lifecycle.sourceFactIds.includes(invalidScrap.eventId),
    false,
    '使用中无效报废不得进入生命周期来源事实',
  )
}

{
  const storage = createMemoryStorage()
  const occurredAt = '2026-08-01 08:00'
  const bagCode = 'BAG-SCRAP-TERMINAL-LIFECYCLE'
  const usageCycleId = `usage:${bagCode}:invalid-after-scrap`
  const currentTickets = [ticket('SCRAP-TERMINAL-1', 'PO-SCRAP-TERMINAL', 'F-SCRAP-TERMINAL')]
  const scrap = appendCuttingRuntimeEvent({
    eventType: '中转袋报废',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt,
    operatorName: '资产管理员',
    refs: { transferBagCode: bagCode, usageCycleId: `usage:${bagCode}:scrap` },
    payload: { bagCode, usageCycleId: `usage:${bagCode}:scrap`, reason: '空闲袋合法报废' },
  }, storage)
  const assertTerminalLifecycle = (message: string) => {
    const lifecycle = buildWaitHandoverLifecycleByBagCode(bagCode, storage)
    assert.deepEqual(
      [lifecycle.mainStatus, lifecycle.flowStage, lifecycle.allowedActions, lifecycle.sourceFactIds],
      ['DISABLED', null, [], [scrap.eventId]],
      message,
    )
  }
  assertTerminalLifecycle('空闲合法报废必须进入终态')

  appendBagging({ storage, bagCode, usageCycleId, tickets: currentTickets, occurredAt })
  assertTerminalLifecycle('合法报废后追加异常装袋事实也不得复活生命周期')

  appendCuttingRuntimeEvent({
    eventType: '中转袋拆袋重装',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt,
    operatorName: '异常重装员',
    refs: {
      repackBatchId: 'REPACK-SCRAP-TERMINAL-LIFECYCLE',
      transferBagCodes: ['BAG-SCRAP-TERMINAL-SOURCE', bagCode],
      feiTicketIds: currentTickets.map((item) => item.feiTicketId),
    },
    payload: {
      repackBatchId: 'REPACK-SCRAP-TERMINAL-LIFECYCLE',
      sourceBags: [{
        bagCode: 'BAG-SCRAP-TERMINAL-SOURCE',
        usageCycleId: 'usage:BAG-SCRAP-TERMINAL-SOURCE:old',
        beforeTickets: currentTickets,
      }],
      resultBags: [{
        bagCode,
        usageCycleId,
        reusedSourceBag: false,
        tickets: currentTickets,
      }],
      movedTickets: currentTickets.map((item) => ({
        feiTicketId: item.feiTicketId,
        fromBagCode: 'BAG-SCRAP-TERMINAL-SOURCE',
        toBagCode: bagCode,
        pieceQty: item.pieceQty,
      })),
      confirmedAt: occurredAt,
      confirmedBy: '异常重装员',
    },
  }, storage)
  assertTerminalLifecycle('合法报废后追加异常重装事实也不得复活生命周期')

  appendCuttingRuntimeEvent({
    eventType: '中转袋回收',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt,
    operatorName: '异常回收员',
    refs: { transferBagCode: bagCode, usageCycleId },
    payload: {
      bagCode,
      usageCycleId,
      physicalBagReceived: true,
      physicalBagEmpty: true,
      returnWarehouseName: '回收区',
    },
  }, storage)
  assertTerminalLifecycle('合法报废后追加异常回收事实也不得复活生命周期')
}

{
  const storage = createMemoryStorage()
  seedTwoSourceBags(storage)
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      results: [
        { bagCode: 'BAG-A', feiTicketIds: ['A1', 'A2'] },
        { bagCode: 'BAG-NEW', feiTicketIds: ['A1', 'B1', 'B2'] },
      ],
    }), storage),
    /恰好出现一次|重复/,
    '同一菲票出现在两个结果袋必须失败',
  )
}

{
  const storage = createMemoryStorage()
  seedTwoSourceBags(storage)
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      results: [
        { bagCode: 'BAG-A', feiTicketIds: ['A1', 'A2'] },
        { bagCode: 'BAG-NEW', feiTicketIds: ['B1'] },
      ],
    }), storage),
    /缺失|恰好出现一次/,
    '来源菲票在结果中丢失必须失败',
  )
}

{
  const storage = createMemoryStorage()
  seedTwoSourceBags(storage)
  appendBagging({
    storage,
    bagCode: 'BAG-UNRELATED-IN-USE',
    usageCycleId: 'usage:BAG-UNRELATED-IN-USE:old',
    tickets: [ticket('U1', 'PO-U', 'F-U')],
  })
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      results: [
        { bagCode: 'BAG-A', feiTicketIds: ['A1', 'A2'] },
        { bagCode: 'BAG-UNRELATED-IN-USE', feiTicketIds: ['B1', 'B2'] },
      ],
    }), storage),
    /无关.*使用中|结果袋.*不能使用/,
    '无关的使用中袋不得作为结果袋',
  )
}

{
  const storage = createMemoryStorage()
  seedTwoSourceBags(storage)
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      sourceBagCodes: ['BAG-A', 'BAG-A'],
    }), storage),
    /来源袋.*重复|唯一/,
    '重复来源袋必须失败',
  )
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      sourceBagCodes: ['BAG-A', 'BAG-EMPTY'],
    }), storage),
    /没有当前菲票|不能为空|当前阶段/,
    '无当前菲票的来源袋必须失败',
  )
}

{
  const storage = createMemoryStorage()
  seedTwoSourceBags(storage)
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      results: [
        { bagCode: 'BAG-A', feiTicketIds: ['A1', 'A2'] },
        { bagCode: 'BAG-NEW', feiTicketIds: ['B1', 'B2', 'NOT-A-SOURCE'] },
      ],
    }), storage),
    /非来源菲票/,
    '结果中出现额外菲票必须失败',
  )
}

{
  const storage = createMemoryStorage()
  seedTwoSourceBags(storage)
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      results: [
        { bagCode: 'BAG-A', feiTicketIds: ['A1', 'A2'] },
        { bagCode: 'BAG-NEW', feiTicketIds: [] },
      ],
    }), storage),
    /至少需要一张菲票/,
    '空结果袋必须失败',
  )
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      results: [
        { bagCode: 'BAG-A', feiTicketIds: ['A1', 'A2'] },
        { bagCode: 'BAG-NEW', feiTicketIds: ['   '] },
      ],
    }), storage),
    /菲票编号不能为空/,
    '空白菲票编号必须在归一化后失败',
  )
}

{
  const storage = createMemoryStorage()
  seedTwoSourceBags(storage)
  appendCuttingRuntimeEvent({
    eventType: '中转袋报废',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: '2026-08-01 08:40',
    operatorName: '资产管理员',
    refs: { transferBagCode: 'BAG-DISABLED' },
    payload: { bagCode: 'BAG-DISABLED' },
  }, storage)
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      results: [
        { bagCode: 'BAG-A', feiTicketIds: ['A1', 'A2'] },
        { bagCode: 'BAG-DISABLED', feiTicketIds: ['B1', 'B2'] },
      ],
    }), storage),
    /已报废/,
    '已报废袋不得作为结果袋',
  )
}

{
  const storage = createMemoryStorage()
  const { sourceA, sourceB } = seedTwoSourceBags(storage)
  const tamperedStorage = {
    ...storage,
    getItem(key: string) {
      const raw = storage.getItem(key)
      if (!raw) return raw
      const parsed = JSON.parse(raw)
      const source = parsed.events.find((event: { refs: { transferBagCode?: string } }) => event.refs.transferBagCode === 'BAG-B')
      if (source?.payload?.feiTicketItems?.[0]) source.payload.feiTicketItems[0].pieceQty = 999
      return JSON.stringify(parsed)
    },
  }
  assertRejectedWithoutWriting(tamperedStorage,
    () => submitTransferBagRepack(repackInput({
      results: [
        { bagCode: 'BAG-A', feiTicketIds: ['A1', 'A2'] },
        { bagCode: 'BAG-NEW', feiTicketIds: ['B1', 'B2'] },
      ],
    }), tamperedStorage),
    /数量|片数|pieceQty/,
    'pieceQty 被历史引用篡改时必须失败',
  )
  assert.equal(sourceA[0].pieceQty, 12)
  assert.equal(sourceB[0].pieceQty, 9)
}

{
  const storage = createMemoryStorage()
  seedTwoSourceBags(storage)
  const changedFactory = ticket('A2', 'PO-A', 'F-X', 8)
  const raw = JSON.parse(storage.getItem('cuttingRuntimeEventLedger') || '{}')
  const event = raw.events.find((item: { eventType: string; refs: { transferBagCode?: string } }) => item.refs.transferBagCode === 'BAG-A' && item.eventType === '菲票装袋')
  event.payload.feiTicketItems[1] = changedFactory
  storage.setItem?.('cuttingRuntimeEventLedger', JSON.stringify(raw))
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput(), storage),
    /接收工厂/,
    '同一结果袋跨接收工厂必须失败',
  )
}

{
  const storage = createMemoryStorage()
  const { sourceA, sourceB } = seedTwoSourceBags(storage)
  const unrelated = [ticket('UNRELATED-1', 'PO-UNRELATED', 'F-UNRELATED', 6)]
  appendBagging({ storage, bagCode: 'BAG-UNRELATED', usageCycleId: 'usage:BAG-UNRELATED:old', tickets: unrelated })
  appendInbound({ storage, bagCode: 'BAG-UNRELATED', usageCycleId: 'usage:BAG-UNRELATED:old', tickets: unrelated })
  const first = submitTransferBagRepack(repackInput(), storage)
  const retry = submitTransferBagRepack(repackInput({
    repackBatchId: ' REPACK-2-TO-2 ',
    sourceBagCodes: [' BAG-B ', ' BAG-A '],
    results: [
      { bagCode: ' BAG-NEW ', feiTicketIds: [' B2 ', ' B1 '] },
      { bagCode: ' BAG-A ', feiTicketIds: [' A2 ', ' A1 '] },
    ],
  }), storage)
  const repackEvents = listCuttingRuntimeEvents(storage).filter((event) => event.eventType === '中转袋拆袋重装')
  const repackPayload = repackEvents[0].payload as TransferBagRepackPayload
  assert.equal(first.eventId, retry.eventId)
  assert.equal(repackEvents.length, 1, '同一重装批次重试只能保留一条事件')
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      sourceBagCodes: ['BAG-A', 'BAG-A', 'BAG-B'],
    }), storage),
    /来源袋编号必须唯一/,
    '相同批次重复来源袋必须在幂等返回前失败',
  )
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      results: [
        { bagCode: 'BAG-A', feiTicketIds: ['A1', 'A2'] },
        { bagCode: 'BAG-A', feiTicketIds: ['B1', 'B2'] },
      ],
    }), storage),
    /结果袋编号必须唯一/,
    '相同批次重复结果袋必须在幂等返回前失败',
  )
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      results: [
        { bagCode: 'BAG-A', feiTicketIds: ['A1', 'A1', 'A2'] },
        { bagCode: 'BAG-NEW', feiTicketIds: ['B1', 'B2'] },
      ],
    }), storage),
    /菲票编号必须唯一|结果袋中重复/,
    '相同批次单一结果袋重复菲票必须在幂等返回前失败',
  )
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      results: [
        { bagCode: 'BAG-A', feiTicketIds: ['A1', 'A2'] },
        { bagCode: 'BAG-NEW', feiTicketIds: ['A1', 'B1', 'B2'] },
      ],
    }), storage),
    /跨结果袋重复|结果袋中重复/,
    '相同批次跨结果袋重复菲票必须在幂等返回前失败',
  )
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      sourceBagCodes: ['BAG-A'],
    }), storage),
    /重装批次已存在且请求内容不一致/,
    '相同批次改变来源袋集合必须失败',
  )
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      results: [
        { bagCode: 'BAG-A', feiTicketIds: ['A1', 'A2'] },
        { bagCode: 'BAG-OTHER', feiTicketIds: ['B1', 'B2'] },
      ],
    }), storage),
    /重装批次已存在且请求内容不一致/,
    '相同批次改变结果袋必须失败',
  )
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack(repackInput({
      results: [
        { bagCode: 'BAG-A', feiTicketIds: ['B1', 'B2'] },
        { bagCode: 'BAG-NEW', feiTicketIds: ['A1', 'A2'] },
      ],
    }), storage),
    /重装批次已存在且请求内容不一致/,
    '相同批次改变结果袋菲票映射必须失败',
  )
  assert.equal(repackPayload.sourceBags.length, 2)
  assert.equal(repackPayload.resultBags.length, 2)
  assert(repackPayload.resultBags.some((bag) => bag.bagCode === 'BAG-A' && bag.reusedSourceBag))
  for (const bagCode of ['BAG-A', 'BAG-B', 'BAG-NEW']) {
    assert.equal(eventTouchesTransferBag(repackEvents[0], bagCode), true, `重装事件必须触及 ${bagCode}`)
  }
  assert.equal(eventTouchesTransferBag(repackEvents[0], 'BAG-UNRELATED'), false, '重装事件不得误触无关袋')
  assert.equal(resolveTransferBagCurrentUse('BAG-A', storage).flowStage, 'READY_HANDOVER')
  assert.equal(resolveTransferBagCurrentUse('BAG-A', storage).usageCycleId, 'usage:BAG-A:old')
  assert.deepEqual(resolveTransferBagCurrentUse('BAG-A', storage).tickets, sourceA)
  assert.equal(resolveTransferBagCurrentUse('BAG-B', storage).mainStatus, 'IDLE')
  assert.equal(resolveTransferBagCurrentUse('BAG-B', storage).usageCycleId, null)
  assert.equal(resolveTransferBagCurrentUse('BAG-NEW', storage).flowStage, 'READY_HANDOVER')
  assert.equal(resolveTransferBagCurrentUse('BAG-NEW', storage).usageCycleId, 'usage:BAG-NEW:REPACK-2-TO-2')
  assert.deepEqual(resolveTransferBagCurrentUse('BAG-NEW', storage).tickets, sourceB)
  assert.deepEqual(
    listWaitHandoverLifecycleFacts('BAG-A', storage)
      .filter((fact) => fact.occurredAt === '2026-08-01 09:00')
      .map((fact) => fact.factType),
    ['REPACK_RESULT_CONFIRMED'],
    '同袋既是来源又是结果时只能产生结果事实',
  )
  assert.deepEqual(
    listWaitHandoverLifecycleFacts('BAG-B', storage)
      .filter((fact) => fact.occurredAt === '2026-08-01 09:00')
      .map((fact) => fact.factType),
    ['REPACK_SOURCE_EMPTIED'],
  )
  assert.equal(buildWaitHandoverLifecycleByBagCode('BAG-A', storage).flowStage, 'READY_HANDOVER')
  assert.equal(buildWaitHandoverLifecycleByBagCode('BAG-B', storage).mainStatus, 'IDLE')
  const occupancies = buildWaitHandoverLocationOccupancyStates(listCuttingRuntimeEvents(storage))
  assert.equal(occupancies.some((state) => ['BAG-A', 'BAG-B', 'BAG-NEW'].includes(state.bagCode)), false)
  assert.deepEqual(occupancies.map((state) => state.bagCode), ['BAG-UNRELATED'], '只保留无关袋库位，来源袋清空且结果袋不自动占位')
}

{
  const storage = createMemoryStorage()
  const source = [ticket('NORMAL-1', 'PO-NORMAL', 'F-NORMAL')]
  appendBagging({ storage, bagCode: 'BAG-A', usageCycleId: 'usage:BAG-A:old', tickets: source })
  const event = submitTransferBagRepack({
    repackBatchId: ' REPACK-NORMALIZED ',
    sourceBagCodes: [' BAG-A '],
    results: [{ bagCode: ' BAG-A ', feiTicketIds: [' NORMAL-1 '] }],
    operator: {
      operatorId: ' OP-NORMAL ',
      operatorName: ' 重装员甲 ',
      operatorRole: ' 裁片仓主管 ',
    },
    source: 'WEB',
    occurredAt: ' 2026-08-01 09:05 ',
  }, storage)
  const payload = event.payload as TransferBagRepackPayload
  assert.equal(payload.repackBatchId, 'REPACK-NORMALIZED')
  assert.equal(payload.resultBags[0].bagCode, 'BAG-A')
  assert.equal(payload.resultBags[0].reusedSourceBag, true)
  assert.equal(payload.resultBags[0].usageCycleId, 'usage:BAG-A:old')
  assert.deepEqual(event.refs.transferBagCodes, ['BAG-A'])
  assert.deepEqual(event.refs.feiTicketIds, ['NORMAL-1'])
  assert.equal(event.operatorId, 'OP-NORMAL')
  assert.equal(event.operatorName, '重装员甲')
  assert.equal(event.operatorRole, '裁片仓主管')
  assert.equal(event.occurredAt, '2026-08-01 09:05')
}

{
  const storage = createMemoryStorage()
  const source = [ticket('SAME-TIME-1', 'PO-SAME-TIME', 'F-SAME-TIME')]
  const occurredAt = '2026-08-01 08:00'
  const bagging = appendBagging({
    storage,
    bagCode: 'BAG-SAME-TIME',
    usageCycleId: 'usage:BAG-SAME-TIME:old',
    tickets: source,
    occurredAt,
  })
  const inbound = appendInbound({
    storage,
    bagCode: 'BAG-SAME-TIME',
    usageCycleId: 'usage:BAG-SAME-TIME:old',
    tickets: source,
    occurredAt,
  })
  const repack = submitTransferBagRepack({
    repackBatchId: 'REPACK-SAME-TIME',
    sourceBagCodes: ['BAG-SAME-TIME'],
    results: [{ bagCode: 'BAG-SAME-TIME', feiTicketIds: ['SAME-TIME-1'] }],
    operator,
    source: 'WEB',
    occurredAt,
  }, storage)
  assert.equal(repack.eventId.localeCompare(inbound.eventId) < 0, true, '真实重装 eventId 字典序早于入仓，不能充当因果序号')
  const actualEvents = listCuttingRuntimeEvents(storage)
  assert.deepEqual(
    [bagging, inbound, repack].map((event) => event.ledgerSequence),
    [1, 2, 3],
    '同步连续追加也必须取得单调账本序号',
  )
  assert.deepEqual(
    actualEvents.map((event) => event.ledgerSequence).sort((left, right) => Number(left) - Number(right)),
    [1, 2, 3],
    '账本序列化和反序列化必须保留因果序号',
  )
  const reverse = createMemoryStorage()
  reverse.setItem?.('cuttingRuntimeEventLedger', JSON.stringify({ events: [...actualEvents].reverse() }))
  const forwardUse = resolveTransferBagCurrentUse('BAG-SAME-TIME', storage)
  const reverseUse = resolveTransferBagCurrentUse('BAG-SAME-TIME', reverse)
  assert.deepEqual(reverseUse, forwardUse, '同时间当前关系投影不得依赖原始输入顺序')
  assert.equal(forwardUse.flowStage, 'READY_HANDOVER', '同时间真实追加顺序必须以重装结果为最后因果事实')
  assert.deepEqual(
    listWaitHandoverLifecycleFacts('BAG-SAME-TIME', storage).map((fact) => fact.factType),
    ['BAGGING_CONFIRMED', 'INBOUND_CONFIRMED', 'REPACK_RESULT_CONFIRMED'],
    '同时间生命周期事实也必须保留真实追加因果顺序',
  )
  assert.deepEqual(
    listWaitHandoverLifecycleFacts('BAG-SAME-TIME', reverse).map((fact) => fact.factType),
    ['BAGGING_CONFIRMED', 'INBOUND_CONFIRMED', 'REPACK_RESULT_CONFIRMED'],
    '同时间生命周期事实正逆输入必须一致',
  )
  assert.equal(buildWaitHandoverLifecycleByBagCode('BAG-SAME-TIME', storage).flowStage, 'READY_HANDOVER')
  assert.equal(buildWaitHandoverLifecycleByBagCode('BAG-SAME-TIME', reverse).flowStage, 'READY_HANDOVER')
  const occupancyForward = buildWaitHandoverLocationOccupancyStates([bagging, inbound, repack])
  const occupancyReverse = buildWaitHandoverLocationOccupancyStates([repack, inbound, bagging])
  assert.deepEqual(occupancyReverse, occupancyForward, '同时间库位投影不得依赖原始输入顺序')
  assert.deepEqual(occupancyForward, [], '同时间真实追加顺序必须由重装清除来源袋库位')

  const oldEvents = actualEvents.map(({ ledgerSequence: _ledgerSequence, ...event }) => event)
  const oldForward = createMemoryStorage()
  const oldReverse = createMemoryStorage()
  oldForward.setItem?.('cuttingRuntimeEventLedger', JSON.stringify({ events: oldEvents }))
  oldReverse.setItem?.('cuttingRuntimeEventLedger', JSON.stringify({ events: [...oldEvents].reverse() }))
  assert.deepEqual(
    resolveTransferBagCurrentUse('BAG-SAME-TIME', oldReverse),
    resolveTransferBagCurrentUse('BAG-SAME-TIME', oldForward),
    '旧事件缺少账本序号时仍须由 createdAt 和真实 eventId 确定性兜底',
  )
}

{
  const storage = createMemoryStorage()
  const relatedBagCode = 'BAG-CORRUPT-RELATED'
  const relatedUsageCycleId = `usage:${relatedBagCode}:old`
  const related = [ticket('CORRUPT-RELATED-1', 'PO-CORRUPT-RELATED', 'F-CORRUPT-RELATED')]
  const unrelated = [ticket('CORRUPT-UNRELATED-1', 'PO-CORRUPT-UNRELATED', 'F-CORRUPT-UNRELATED')]
  appendBagging({
    storage,
    bagCode: relatedBagCode,
    usageCycleId: relatedUsageCycleId,
    tickets: related,
    occurredAt: '2026-08-01 08:00',
  })
  appendInbound({
    storage,
    bagCode: relatedBagCode,
    usageCycleId: relatedUsageCycleId,
    tickets: related,
    occurredAt: '2026-08-01 08:10',
  })
  appendBagging({
    storage,
    bagCode: 'BAG-CORRUPT-UNRELATED',
    usageCycleId: 'usage:BAG-CORRUPT-UNRELATED:old',
    tickets: unrelated,
    occurredAt: '2026-08-01 08:00',
  })
  appendInbound({
    storage,
    bagCode: 'BAG-CORRUPT-UNRELATED',
    usageCycleId: 'usage:BAG-CORRUPT-UNRELATED:old',
    tickets: unrelated,
    occurredAt: '2026-08-01 08:10',
  })
  const currentBefore = resolveTransferBagCurrentUse(relatedBagCode, storage)
  const factsBefore = listWaitHandoverLifecycleFacts(relatedBagCode, storage)
  const lifecycleBefore = buildWaitHandoverLifecycleByBagCode(relatedBagCode, storage)
  const occupancyBefore = buildWaitHandoverLocationOccupancyStates(listCuttingRuntimeEvents(storage))
  const validSource = {
    bagCode: relatedBagCode,
    usageCycleId: relatedUsageCycleId,
    beforeTickets: related,
  }
  const damagedPayloads: Array<{ label: string; payload: Record<string, unknown> }> = [
    {
      label: '顶层数组缺失',
      payload: { repackBatchId: 'REPACK-CORRUPT-MISSING' },
    },
    {
      label: '来源袋缺少使用周期',
      payload: {
        repackBatchId: 'REPACK-CORRUPT-SOURCE-CYCLE',
        sourceBags: [{ bagCode: relatedBagCode, beforeTickets: related }],
        resultBags: [],
        movedTickets: [],
      },
    },
    {
      label: '来源袋票快照不是数组',
      payload: {
        repackBatchId: 'REPACK-CORRUPT-SOURCE-TICKETS',
        sourceBags: [{ ...validSource, beforeTickets: 'not-an-array' }],
        resultBags: [],
        movedTickets: [],
      },
    },
    {
      label: '结果袋缺少使用周期、票快照和复用标记',
      payload: {
        repackBatchId: 'REPACK-CORRUPT-RESULT',
        sourceBags: [validSource],
        resultBags: [{ bagCode: 'BAG-CORRUPT-RESULT' }],
        movedTickets: [],
      },
    },
    {
      label: '移动票不是数组',
      payload: {
        repackBatchId: 'REPACK-CORRUPT-MOVED-NON-ARRAY',
        sourceBags: [validSource],
        resultBags: [],
        movedTickets: 'not-an-array',
      },
    },
    {
      label: '移动票缺少必要字段',
      payload: {
        repackBatchId: 'REPACK-CORRUPT-MOVED-ITEM',
        sourceBags: [validSource],
        resultBags: [],
        movedTickets: [{ feiTicketId: related[0].feiTicketId, fromBagCode: relatedBagCode }],
      },
    },
  ]
  damagedPayloads.forEach(({ label, payload }, index) => {
    const repackBatchId = String(payload.repackBatchId)
    const damagedEvent = appendCuttingRuntimeEvent({
      eventType: '中转袋拆袋重装',
      eventSource: 'WEB',
      eventStatus: '已同步',
      occurredAt: `2026-08-01 09:${String(index).padStart(2, '0')}`,
      operatorName: '损坏数据导入',
      refs: {
        repackBatchId,
        transferBagCodes: [relatedBagCode, 'BAG-CORRUPT-RESULT'],
        feiTicketIds: related.map((item) => item.feiTicketId),
      },
      payload: {
        ...payload,
        confirmedAt: `2026-08-01 09:${String(index).padStart(2, '0')}`,
        confirmedBy: '损坏数据导入',
      },
    } as Parameters<typeof appendCuttingRuntimeEvent>[0], storage)
    assert.equal(
      eventTouchesTransferBag(damagedEvent, relatedBagCode),
      false,
      `${label}时即使 refs 提到相关袋，整条重装事件也不得触及袋`,
    )
    assert.deepEqual(resolveTransferBagCurrentUse(relatedBagCode, storage), currentBefore, `${label}不得改变当前袋票关系`)
    assert.deepEqual(listWaitHandoverLifecycleFacts(relatedBagCode, storage), factsBefore, `${label}不得生成生命周期事实`)
    assert.deepEqual(buildWaitHandoverLifecycleByBagCode(relatedBagCode, storage), lifecycleBefore, `${label}不得打开或关闭生命周期周期`)
    assert.deepEqual(
      buildWaitHandoverLocationOccupancyStates(listCuttingRuntimeEvents(storage)),
      occupancyBefore,
      `${label}不得清除相关或无关袋库位`,
    )
    assert.doesNotThrow(() => buildWaitHandoverRuntimeProjection([], storage), `${label}不得导致运行投影崩溃`)
  })
}

{
  const storage = createMemoryStorage()
  const source = ticket('FORCE-SOURCE', 'PO-FORCE', 'F-FORCE')
  const recovered = ticket('RECOVERED-OLD', 'PO-OLD', 'F-OLD')
  appendBagging({ storage, bagCode: 'BAG-FORCE-SOURCE', usageCycleId: 'usage:BAG-FORCE-SOURCE:old', tickets: [source] })
  appendBagging({ storage, bagCode: 'BAG-FORCE-RESULT', usageCycleId: 'usage:BAG-FORCE-RESULT:old', tickets: [recovered] })
  appendCuttingRuntimeEvent({
    eventType: '新增交出记录',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: '2026-08-01 08:20',
    operatorName: '交出员',
    refs: {
      transferBagCode: 'BAG-FORCE-RESULT',
      usageCycleId: 'usage:BAG-FORCE-RESULT:old',
      handoverRecordId: 'HANDOVER-FORCE-OLD',
      handoverLegId: 'usage:BAG-FORCE-RESULT:old:handover:1',
    },
    payload: { handoverRecordId: 'HANDOVER-FORCE-OLD' },
  }, storage)
  appendCuttingRuntimeEvent({
    eventType: '中转袋回收',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: '2026-08-01 08:25',
    operatorName: '仅作标记员',
    refs: {
      transferBagCode: 'BAG-FORCE-RESULT',
      usageCycleId: 'usage:BAG-FORCE-RESULT:old',
    },
    payload: {
      bagCode: 'BAG-FORCE-RESULT',
      physicalBagReceived: true,
      physicalBagEmpty: false,
      reason: '只有回收标记，没有空袋事实',
    },
  }, storage)
  assert.equal(resolveTransferBagCurrentUse('BAG-FORCE-RESULT', storage).mainStatus, 'IN_USE', '任意回收标记不得释放袋')
  appendCuttingRuntimeEvent({
    eventType: '中转袋回收',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: '2026-08-01 08:30',
    operatorName: '强制回收员',
    refs: {
      transferBagCode: 'BAG-FORCE-RESULT',
      usageCycleId: 'usage:BAG-FORCE-RESULT:old',
    },
    payload: {
      bagCode: 'BAG-FORCE-RESULT',
      usageCycleId: 'usage:BAG-FORCE-RESULT:old',
      physicalBagReceived: true,
      physicalBagEmpty: true,
      recoveryMode: 'FORCED',
      recoveryNode: '车缝厂收货区',
      recoveryLocation: '裁片仓回收位',
      reason: '下游未回写但现场已确认空袋回收',
      recoveredAt: '2026-08-01 08:30',
      recoveredBy: '强制回收员',
    },
  }, storage)
  assert.equal(resolveTransferBagCurrentUse('BAG-FORCE-RESULT', storage).mainStatus, 'IDLE', '有效强制回收后结果袋才可用')
  const event = submitTransferBagRepack({
    repackBatchId: 'REPACK-FORCED-RECOVERY-TARGET',
    sourceBagCodes: ['BAG-FORCE-SOURCE'],
    results: [{ bagCode: 'BAG-FORCE-RESULT', feiTicketIds: ['FORCE-SOURCE'] }],
    operator,
    source: 'WEB',
    occurredAt: '2026-08-01 09:00',
  }, storage)
  assert.equal(event.eventType, '中转袋拆袋重装')
  assert.equal(resolveTransferBagCurrentUse('BAG-FORCE-RESULT', storage).usageCycleId, 'usage:BAG-FORCE-RESULT:REPACK-FORCED-RECOVERY-TARGET')
}

{
  const storage = createMemoryStorage()
  const legacyTickets = [ticket('LEGACY-1', 'PO-LEGACY', 'F-LEGACY')]
  appendBagging({
    storage,
    bagCode: 'BAG-LEGACY-SOURCE',
    usageCycleId: 'usage:BAG-LEGACY-SOURCE:old',
    tickets: legacyTickets,
  })
  const confirm = appendLegacyBaggingConfirm({
    storage,
    sourceBagCode: 'BAG-LEGACY-SOURCE',
    targetBagCode: 'BAG-LEGACY-TARGET',
    feiTicketIds: ['LEGACY-1'],
  })
  const target = resolveTransferBagCurrentUse('BAG-LEGACY-TARGET', storage)
  assert.equal(target.flowStage, 'READY_HANDOVER')
  assert.deepEqual(target.tickets, legacyTickets, '旧确认仅在来源、结果和菲票集合唯一时恢复快照')
  assert.equal(resolveTransferBagCurrentUse('BAG-LEGACY-SOURCE', storage).mainStatus, 'IDLE')
  assert.equal(eventTouchesTransferBag(confirm, 'BAG-LEGACY-TARGET'), true)
  assert.equal(eventTouchesTransferBag(confirm, 'BAG-LEGACY-SOURCE'), true)
  assert.equal(eventTouchesTransferBag(confirm, 'BAG-OTHER'), false)
}

{
  const storage = createMemoryStorage()
  const legacyTickets = [ticket('LEGACY-AMBIGUOUS', 'PO-LEGACY', 'F-LEGACY')]
  appendBagging({
    storage,
    bagCode: 'BAG-LEGACY-AMBIGUOUS-SOURCE',
    usageCycleId: 'usage:BAG-LEGACY-AMBIGUOUS-SOURCE:old',
    tickets: legacyTickets,
  })
  appendLegacyBaggingConfirm({
    storage,
    targetBagCode: 'BAG-LEGACY-AMBIGUOUS-TARGET',
    feiTicketIds: ['LEGACY-AMBIGUOUS'],
  })
  const ambiguous = resolveTransferBagCurrentUse('BAG-LEGACY-AMBIGUOUS-TARGET', storage)
  assert.deepEqual(ambiguous.tickets, [])
  assert.match(ambiguous.compatibilityBlockedReason || '', /无法唯一恢复/)
}

{
  const storage = createMemoryStorage()
  const currentTickets = [ticket('T1', 'PO-T', 'F-T')]
  appendLegacyBaggingConfirm({
    storage,
    targetBagCode: 'BAG-T',
    feiTicketIds: ['T1'],
    occurredAt: '2026-08-01 07:00',
  })
  assert.match(
    resolveTransferBagCurrentUse('BAG-T', storage).compatibilityBlockedReason || '',
    /无法唯一恢复/,
    '新重装前的旧确认仍按历史兼容规则折叠',
  )
  appendCuttingRuntimeEvent({
    eventType: '中转袋拆袋重装',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: '2026-08-01 08:00',
    operatorName: '新重装员',
    refs: {
      repackBatchId: 'REPACK-ESTABLISH-T',
      transferBagCodes: ['BAG-S', 'BAG-T'],
      feiTicketIds: ['T1'],
    },
    payload: {
      repackBatchId: 'REPACK-ESTABLISH-T',
      sourceBags: [{
        bagCode: 'BAG-S',
        usageCycleId: 'usage:BAG-S:old',
        beforeTickets: currentTickets,
      }],
      resultBags: [{
        bagCode: 'BAG-T',
        usageCycleId: 'usage:BAG-T:REPACK-ESTABLISH-T',
        reusedSourceBag: false,
        tickets: currentTickets,
      }],
      movedTickets: [{
        feiTicketId: 'T1',
        fromBagCode: 'BAG-S',
        toBagCode: 'BAG-T',
        pieceQty: currentTickets[0].pieceQty,
      }],
      confirmedAt: '2026-08-01 08:00',
      confirmedBy: '新重装员',
    },
  }, storage)
  appendLegacyBaggingConfirm({
    storage,
    sourceBagCode: 'BAG-OLD-SOURCE',
    targetBagCode: 'BAG-T',
    feiTicketIds: ['T1'],
    occurredAt: '2026-08-01 09:00',
  })
  const current = resolveTransferBagCurrentUse('BAG-T', storage)
  assert.deepEqual(current.tickets, currentTickets, '新重装后的旧确认不得污染当前菲票关系')
  assert.equal(current.productionOrderNo, 'PO-T')
  assert.equal(current.usageCycleId, 'usage:BAG-T:REPACK-ESTABLISH-T')
  assert.equal(current.flowStage, 'READY_HANDOVER')
  assert.equal(current.compatibilityBlockedReason, undefined, '新重装后的旧确认必须完全退出当前关系折叠')
  const next = submitTransferBagRepack({
    repackBatchId: 'REPACK-T-NEXT',
    sourceBagCodes: ['BAG-T'],
    results: [{ bagCode: 'BAG-T-NEXT', feiTicketIds: ['T1'] }],
    operator,
    source: 'WEB',
    occurredAt: '2026-08-01 10:00',
  }, storage)
  assert.equal(next.eventType, '中转袋拆袋重装', '旧确认不得阻断当前袋继续合法重装')
}

{
  const storage = createMemoryStorage()
  appendCuttingRuntimeEvent({
    eventType: '菲票装袋',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: '2026-08-01 08:00',
    operatorName: '历史装袋员',
    refs: {
      transferBagCode: 'BAG-LEGACY-INCOMPLETE',
      usageCycleId: 'usage:BAG-LEGACY-INCOMPLETE:old',
      productionOrderNo: 'PO-LEGACY',
    },
    payload: {
      bagCode: 'BAG-LEGACY-INCOMPLETE',
      feiTicketItems: [{
        feiTicketId: 'LEGACY-INCOMPLETE',
        feiTicketNo: 'FT-LEGACY-INCOMPLETE',
        productionOrderNo: 'PO-LEGACY',
        pieceQty: 10,
      }],
    },
  }, storage)
  const legacy = resolveTransferBagCurrentUse('BAG-LEGACY-INCOMPLETE', storage)
  assert.match(legacy.compatibilityBlockedReason || '', /接收工厂/)
  assertRejectedWithoutWriting(storage,
    () => submitTransferBagRepack({
      repackBatchId: 'REPACK-LEGACY-INCOMPLETE',
      sourceBagCodes: ['BAG-LEGACY-INCOMPLETE'],
      results: [{ bagCode: 'BAG-LEGACY-INCOMPLETE', feiTicketIds: ['LEGACY-INCOMPLETE'] }],
      operator,
      source: 'WEB',
    }, storage),
    /接收工厂/,
    '历史快照缺接收工厂时只能读取，不能参与重装',
  )
}

{
  const storage = createMemoryStorage()
  appendBagging({
    storage,
    bagCode: 'BAG-X',
    usageCycleId: 'usage:BAG-X:old',
    tickets: [ticket('X1', 'PO-X', 'F-X')],
  })
  appendBagging({
    storage,
    bagCode: 'BAG-Y',
    usageCycleId: 'usage:BAG-Y:old',
    tickets: [ticket('Y1', 'PO-Y', 'F-Y')],
  })
  submitTransferBagRepack({
    ...repackInput(),
    repackBatchId: 'REPACK-CROSS-ORDER',
    sourceBagCodes: ['BAG-X', 'BAG-Y'],
    results: [
      { bagCode: 'BAG-X', feiTicketIds: ['Y1'] },
      { bagCode: 'BAG-Z', feiTicketIds: ['X1'] },
    ],
  }, storage)
  assert.equal(resolveTransferBagCurrentUse('BAG-X', storage).usageCycleId, 'usage:BAG-X:REPACK-CROSS-ORDER')
  assert.equal(resolveTransferBagCurrentUse('BAG-X', storage).productionOrderNo, 'PO-Y')
  assert.equal(resolveTransferBagCurrentUse('BAG-Y', storage).mainStatus, 'IDLE')
  assert.equal(resolveTransferBagCurrentUse('BAG-Z', storage).usageCycleId, 'usage:BAG-Z:REPACK-CROSS-ORDER')
  assert.deepEqual(
    listWaitHandoverLifecycleFacts('BAG-X', storage).map((fact) => [fact.factType, fact.usageCycleId]),
    [
      ['BAGGING_CONFIRMED', 'usage:BAG-X:old'],
      ['REPACK_RESULT_CONFIRMED', 'usage:BAG-X:REPACK-CROSS-ORDER'],
    ],
    '跨生产单复用必须关闭旧周期并以重装批次建立新周期',
  )
  const lifecycle = buildWaitHandoverLifecycleByBagCode('BAG-X', storage)
  assert.equal(lifecycle.usageCycleId, 'usage:BAG-X:REPACK-CROSS-ORDER')
  assert.equal(lifecycle.flowStage, 'READY_HANDOVER')
  assert.equal(lifecycle.sourceFactIds.length, 1, '旧周期必须关闭，当前生命周期只能取新重装周期事实')
  assert.match(lifecycle.sourceFactIds[0], /BAG-REPACK/)
}

{
  const storage = createMemoryStorage()
  const current = ticket('CURRENT', 'PO-CURRENT', 'F-CURRENT')
  const historical = ticket('HISTORY', 'PO-HISTORY', 'F-HISTORY')
  appendBagging({ storage, bagCode: 'BAG-CURRENT', usageCycleId: 'usage:BAG-CURRENT:old', tickets: [current] })
  appendBagging({ storage, bagCode: 'BAG-HISTORY', usageCycleId: 'usage:BAG-HISTORY:old', tickets: [historical] })
  appendInbound({ storage, bagCode: 'BAG-HISTORY', usageCycleId: 'usage:BAG-HISTORY:old', tickets: [historical] })
  const historicalAssignments = [assignment(historical, 'SEW-HISTORY', 'F-HISTORY')]
  submitWholeBagHandover(handoverInput(
    'BAG-HISTORY',
    'usage:BAG-HISTORY:old',
    [historical],
    historicalAssignments,
    {
      handoverOrderId: 'HO-HISTORY',
      handoverOrderNo: 'HO-HISTORY',
      handoverRecordId: 'HR-HISTORY',
      handoverRecordNo: 'HR-HISTORY',
      occurredAt: '2026-08-01 09:10',
    },
  ), storage)
  const candidates = buildWaitHandoverRuntimeProjection([
    { feiTicketId: 'CURRENT' },
    { feiTicketId: 'HISTORY' },
    { feiTicketId: 'NEVER-BOUND' },
  ] as never, storage).ticketCandidates.map((item) => item.feiTicketId)
  assert.deepEqual(candidates.sort(), ['HISTORY', 'NEVER-BOUND'])
  const handedOver = resolveTransferBagCurrentUse('BAG-HISTORY', storage)
  assert.deepEqual(handedOver.tickets, [])
  assert.equal(handedOver.latestHandoverEventId.startsWith('cutting-event:HANDOVER:'), true)
  assert.equal(handedOver.flowStage, 'HANDED_OVER_WAITING_RETURN')
}

{
  const storage = createMemoryStorage()
  const bagCode = 'BAG-HANDOVER-SNAPSHOT-REQUIRED'
  const usageCycleId = `usage:${bagCode}:1`
  const tickets = [
    ticket('SNAPSHOT-REQUIRED-01', 'PO-SNAPSHOT-REQUIRED', 'FACTORY-HANDOVER', 7),
    ticket('SNAPSHOT-REQUIRED-02', 'PO-SNAPSHOT-REQUIRED', 'FACTORY-HANDOVER', 5),
  ]
  const assignments = [assignment(tickets[0], 'SEW-01'), assignment(tickets[1], 'SEW-02')]
  appendBagging({ storage, bagCode, usageCycleId, tickets })
  appendInbound({ storage, bagCode, usageCycleId, tickets })
  assertRejectedWithoutWriting(
    storage,
    () => submitWholeBagHandover(handoverInput(
      bagCode,
      usageCycleId,
      tickets,
      assignments,
      { submittedTicketSnapshot: undefined },
    ), storage),
    /提交.*快照.*必填/,
    '整袋交出省略提交快照必须在运行时失败',
  )
}

{
  const storage = createMemoryStorage()
  const tickets = [
    ticket('HANDOVER-01', 'PO-HANDOVER', 'FACTORY-HANDOVER', 7),
    ticket('HANDOVER-02', 'PO-HANDOVER', 'FACTORY-HANDOVER', 5),
  ]
  appendBagging({
    storage,
    bagCode: 'BAG-HANDOVER-INBOUND',
    usageCycleId: 'usage:BAG-HANDOVER-INBOUND:1',
    tickets,
  })
  appendInbound({
    storage,
    bagCode: 'BAG-HANDOVER-INBOUND',
    usageCycleId: 'usage:BAG-HANDOVER-INBOUND:1',
    tickets,
  })
  const assignments = [
    assignment(tickets[0], 'SEW-01'),
    assignment(tickets[1], 'SEW-02'),
  ]
  const firstHandoverInput = handoverInput(
    'BAG-HANDOVER-INBOUND',
    'usage:BAG-HANDOVER-INBOUND:1',
    tickets,
    assignments,
  )
  const event = submitWholeBagHandover(firstHandoverInput, storage)
  assert.equal(event.eventType, '新增交出记录')
  const payload = event.payload as {
    receiverId: string
    transferBagUses: Array<{
      bagUseId: string
      bagCode: string
      containedFeiTicketIds: string[]
      totalPieceQty: number
      sewingTaskIds: string[]
      sewingTaskNos: string[]
      ticketSnapshot: TransferBagTicketFactSnapshot[]
      sourceWarehouseArea: string
      sourceLocationCode: string
    }>
  }
  assert.equal(payload.receiverId, 'FACTORY-HANDOVER')
  assert.equal(payload.transferBagUses.length, 1, '单次交出命令只能写一只物理袋')
  assert.deepEqual(payload.transferBagUses[0].sewingTaskIds, ['SEW-01-ID', 'SEW-02-ID'])
  assert.deepEqual(payload.transferBagUses[0].sewingTaskNos, ['SEW-01', 'SEW-02'])
  assert.deepEqual(payload.transferBagUses[0].containedFeiTicketIds, ['HANDOVER-01', 'HANDOVER-02'])
  assert.equal(payload.transferBagUses[0].totalPieceQty, 12)
  assert.equal(payload.transferBagUses[0].ticketSnapshot.length, 2)
  assert.notEqual(
    payload.transferBagUses[0].ticketSnapshot[0],
    firstHandoverInput.submittedTicketSnapshot[0],
    '交出事件快照不得复用调用方提交快照对象',
  )
  assert.equal(payload.transferBagUses[0].sourceWarehouseArea, '待交出 A 区', '入仓袋必须沿用真实待交出仓库区')
  assert.equal(payload.transferBagUses[0].sourceLocationCode, 'A-BAG-HANDOVER-INBOUND', '入仓袋必须沿用真实待交出仓库位')
  assert.equal(event.inventoryEffect?.fromWarehouseArea, '待交出 A 区')
  assert.equal(event.inventoryEffect?.fromLocationCode, 'A-BAG-HANDOVER-INBOUND')

  const countAfterFirstHandover = listCuttingRuntimeEvents(storage).length
  const equivalentRetry = structuredClone(firstHandoverInput)
  equivalentRetry.bagCode = ` ${equivalentRetry.bagCode} `
  equivalentRetry.usageCycleId = ` ${equivalentRetry.usageCycleId} `
  equivalentRetry.handoverOrderNo = ` ${equivalentRetry.handoverOrderNo} `
  equivalentRetry.assignments.reverse()
  equivalentRetry.assignments.forEach((item) => {
    item.feiTicketId = ` ${item.feiTicketId} `
    item.sewingTaskId = ` ${item.sewingTaskId} `
    item.receiverFactoryName = ` ${item.receiverFactoryName} `
  })
  equivalentRetry.submittedTicketSnapshot.reverse()
  equivalentRetry.submittedTicketSnapshot.forEach((item) => {
    item.feiTicketId = ` ${item.feiTicketId} `
    item.sewingTaskId = ` ${item.sewingTaskId} `
    item.receiverFactoryName = ` ${item.receiverFactoryName} `
  })
  equivalentRetry.occurredAt = '2026-08-01 10:30'
  const retriedEvent = submitWholeBagHandover(equivalentRetry, storage)
  assert.equal(retriedEvent.eventId, event.eventId, '同 ID 等价重试必须返回首次成功事件')
  assert.equal(listCuttingRuntimeEvents(storage).length, countAfterFirstHandover, '同 ID 等价重试不得追加事件')

  const reorderedRetry = structuredClone(firstHandoverInput)
  reorderedRetry.assignments = reorderedRetry.assignments.map((item) => ({
    receiverFactoryName: item.receiverFactoryName,
    receiverFactoryId: item.receiverFactoryId,
    sewingTaskNo: item.sewingTaskNo,
    sewingTaskId: item.sewingTaskId,
    feiTicketNo: item.feiTicketNo,
    feiTicketId: item.feiTicketId,
    diagnosticNote: '非业务调试字段不得进入幂等意图',
  }) as FeiTicketSewingAssignment)
  reorderedRetry.submittedTicketSnapshot = reorderedRetry.submittedTicketSnapshot.map((item) => ({
    receiverFactoryName: item.receiverFactoryName,
    receiverFactoryId: item.receiverFactoryId,
    sewingTaskNo: item.sewingTaskNo,
    sewingTaskId: item.sewingTaskId,
    pieceQty: item.pieceQty,
    partName: item.partName,
    partCode: item.partCode,
    size: item.size,
    color: item.color,
    cutOrderNo: item.cutOrderNo,
    cutOrderId: item.cutOrderId,
    productionOrderNo: item.productionOrderNo,
    productionOrderId: item.productionOrderId,
    feiTicketNo: item.feiTicketNo,
    feiTicketId: item.feiTicketId,
    diagnosticNote: '未知字段必须忽略',
  }) as TransferBagTicketFactSnapshot)
  const reorderedEvent = submitWholeBagHandover(reorderedRetry, storage)
  assert.equal(reorderedEvent.eventId, event.eventId, '快照键插入顺序和额外非业务字段不得改变等价重试')
  assert.equal(listCuttingRuntimeEvents(storage).length, countAfterFirstHandover, 'canonical 等价重试不得追加事件')

  const duplicateRetry = structuredClone(firstHandoverInput)
  duplicateRetry.assignments.push({ ...duplicateRetry.assignments[0] })
  assertRejectedWithoutWriting(
    storage,
    () => submitWholeBagHandover(duplicateRetry, storage),
    /意图冲突/,
    '同 ID 重试的重复分配必须先由运行时守卫拒绝，不能被 canonical 排序去重掩盖',
  )

  ;[
    {
      label: '中转袋',
      mutate: (value: typeof firstHandoverInput) => { value.bagCode = 'BAG-HANDOVER-CONFLICT' },
    },
    {
      label: '使用周期',
      mutate: (value: typeof firstHandoverInput) => { value.usageCycleId = 'usage:BAG-HANDOVER-INBOUND:2' },
    },
    {
      label: '提交快照片数',
      mutate: (value: typeof firstHandoverInput) => { value.submittedTicketSnapshot[0].pieceQty += 1 },
    },
    {
      label: '车缝任务',
      mutate: (value: typeof firstHandoverInput) => {
        value.assignments[0].sewingTaskId = 'SEW-CONFLICT-ID'
        value.assignments[0].sewingTaskNo = 'SEW-CONFLICT'
        value.submittedTicketSnapshot[0].sewingTaskId = 'SEW-CONFLICT-ID'
        value.submittedTicketSnapshot[0].sewingTaskNo = 'SEW-CONFLICT'
      },
    },
    {
      label: '接收工厂',
      mutate: (value: typeof firstHandoverInput) => {
        value.assignments.forEach((item) => {
          item.receiverFactoryId = 'FACTORY-CONFLICT'
          item.receiverFactoryName = '冲突车缝厂'
        })
        value.submittedTicketSnapshot.forEach((item) => {
          item.receiverFactoryId = 'FACTORY-CONFLICT'
          item.receiverFactoryName = '冲突车缝厂'
        })
      },
    },
    {
      label: '交出单',
      mutate: (value: typeof firstHandoverInput) => { value.handoverOrderId = 'HO-CONFLICT' },
    },
  ].forEach(({ label, mutate }) => {
    const conflictingRetry = structuredClone(firstHandoverInput)
    mutate(conflictingRetry)
    assertRejectedWithoutWriting(
      storage,
      () => submitWholeBagHandover(conflictingRetry, storage),
      /意图冲突/,
      `同一交出记录 ID 的${label}变化必须明确冲突`,
    )
  })

  const snapshotBeforeMutation = structuredClone(payload.transferBagUses[0].ticketSnapshot)
  assignments[0].sewingTaskNo = 'MUTATED-AFTER-HANDOVER'
  tickets[0].pieceQty = 999
  const persisted = listCuttingRuntimeEvents(storage).find((item) => item.eventId === event.eventId)
  const persistedPayload = persisted?.payload as typeof payload | undefined
  assert.deepEqual(
    persistedPayload?.transferBagUses[0].ticketSnapshot,
    snapshotBeforeMutation,
    '历史交出快照必须与后续输入对象修改隔离',
  )
  const returnedPayload = reorderedEvent.payload as typeof payload
  returnedPayload.transferBagUses[0].ticketSnapshot[0].pieceQty = 777
  reorderedEvent.refs.feiTicketIds?.push('MUTATED-RETURN')
  const persistedAfterReturnedMutation = listCuttingRuntimeEvents(storage)
    .find((item) => item.eventId === event.eventId)
  const persistedAfterReturnedMutationPayload = persistedAfterReturnedMutation?.payload as typeof payload | undefined
  assert.equal(
    persistedAfterReturnedMutationPayload?.transferBagUses[0].ticketSnapshot[0].pieceQty,
    snapshotBeforeMutation[0].pieceQty,
    '返回事件对象修改不得污染事件账中的深拷贝事实',
  )
  assert(!persistedAfterReturnedMutation?.refs.feiTicketIds?.includes('MUTATED-RETURN'), '返回 refs 也必须与账本深拷贝隔离')
  const current = resolveTransferBagCurrentUse('BAG-HANDOVER-INBOUND', storage)
  assert.deepEqual(current.tickets, [], '成功交出后必须清空当前袋票关系')
  assert.equal(current.mainStatus, 'IN_USE')
  assert.equal(current.flowStage, 'HANDED_OVER_WAITING_RETURN')

  assertRejectedWithoutWritingExact(
    storage,
    () => submitWholeBagHandover(handoverInput(
      'BAG-HANDOVER-INBOUND',
      'usage:BAG-HANDOVER-INBOUND:1',
      tickets,
      assignments,
      {
      handoverRecordId: 'HR-BAG-HANDOVER-INBOUND-REPEAT',
      handoverRecordNo: 'HR-BAG-HANDOVER-INBOUND-REPEAT',
      },
    ), storage),
    '当前中转袋不是入仓暂存中或待交出，不能整袋交出。',
    '已交出待回收的同一周期不得重复交出',
  )
}

{
  const storage = createMemoryStorage()
  const tickets = [
    ticket('READY-01', 'PO-READY', 'FACTORY-HANDOVER', 8),
    ticket('READY-02', 'PO-READY', 'FACTORY-HANDOVER', 4),
  ]
  appendReadyForHandover({
    storage,
    bagCode: 'BAG-HANDOVER-READY',
    usageCycleId: 'usage:BAG-HANDOVER-READY:1',
    tickets,
  })
  const readyAssignments = [
    assignment(tickets[0], 'SEW-01'),
    assignment(tickets[1], 'SEW-02'),
  ]
  const event = submitWholeBagHandover(handoverInput(
    'BAG-HANDOVER-READY',
    'usage:BAG-HANDOVER-READY:1',
    tickets,
    readyAssignments,
  ), storage)
  const payload = event.payload as {
    transferBagUses: Array<{ sourceWarehouseArea: string; sourceLocationCode: string }>
  }
  assert.equal(payload.transferBagUses[0].sourceWarehouseArea, '待交出操作区')
  assert.equal(payload.transferBagUses[0].sourceLocationCode, '待交出操作区')
  assert.equal(event.inventoryEffect?.fromWarehouseArea, '待交出操作区')
  assert.equal(event.inventoryEffect?.fromLocationCode, '待交出操作区')
}

;[
  {
    label: '跨工厂分配',
    assignments: (tickets: TransferBagTicketFactSnapshot[]) => [
      assignment(tickets[0], 'SEW-01'),
      assignment(tickets[1], 'SEW-02', 'FACTORY-OTHER'),
    ],
    overrides: {},
    expected: /多个车缝工厂/,
  },
  {
    label: '当前票未分配',
    assignments: (tickets: TransferBagTicketFactSnapshot[]) => [assignment(tickets[0], 'SEW-01')],
    overrides: {},
    expected: /未分配/,
  },
  {
    label: '同一票重复分配',
    assignments: (tickets: TransferBagTicketFactSnapshot[]) => [
      assignment(tickets[0], 'SEW-01'),
      assignment(tickets[0], 'SEW-01'),
      assignment(tickets[1], 'SEW-02'),
    ],
    overrides: {},
    expected: /重复分配/,
  },
  {
    label: '分配包含当前袋外额外菲票',
    assignments: (tickets: TransferBagTicketFactSnapshot[]) => [
      assignment(tickets[0], 'SEW-01'),
      assignment(tickets[1], 'SEW-02'),
      assignment(ticket('FAIL-EXTRA', 'PO-FAIL', 'FACTORY-HANDOVER', 1), 'SEW-01'),
    ],
    overrides: {},
    expected: /额外菲票/,
  },
  {
    label: '提交旧快照',
    assignments: (tickets: TransferBagTicketFactSnapshot[]) => [
      assignment(tickets[0], 'SEW-01'),
      assignment(tickets[1], 'SEW-02'),
    ],
    overrides: {
      submittedTicketSnapshot: [
        { ...ticket('FAIL-01', 'PO-FAIL', 'FACTORY-HANDOVER', 99), sewingTaskId: 'SEW-01-ID', sewingTaskNo: 'SEW-01' },
        { ...ticket('FAIL-02', 'PO-FAIL', 'FACTORY-HANDOVER', 5), sewingTaskId: 'SEW-02-ID', sewingTaskNo: 'SEW-02' },
      ],
    },
    expected: /快照/,
  },
  {
    label: '省略提交快照',
    assignments: (tickets: TransferBagTicketFactSnapshot[]) => [
      assignment(tickets[0], 'SEW-01'),
      assignment(tickets[1], 'SEW-02'),
    ],
    overrides: { submittedTicketSnapshot: undefined },
    expected: /提交.*快照.*必填/,
  },
  {
    label: '提交快照字段不完整',
    assignments: (tickets: TransferBagTicketFactSnapshot[]) => [
      assignment(tickets[0], 'SEW-01'),
      assignment(tickets[1], 'SEW-02'),
    ],
    overrides: {
      submittedTicketSnapshot: [
        {
          ...ticket('FAIL-01', 'PO-FAIL', 'FACTORY-HANDOVER', 7),
          sewingTaskId: 'SEW-01-ID',
          sewingTaskNo: 'SEW-01',
          receiverFactoryName: '',
        },
        {
          ...ticket('FAIL-02', 'PO-FAIL', 'FACTORY-HANDOVER', 5),
          sewingTaskId: 'SEW-02-ID',
          sewingTaskNo: 'SEW-02',
        },
      ],
    },
    expected: /提交.*快照.*不完整/,
  },
  {
    label: '提交快照重复菲票',
    assignments: (tickets: TransferBagTicketFactSnapshot[]) => [
      assignment(tickets[0], 'SEW-01'),
      assignment(tickets[1], 'SEW-02'),
    ],
    overrides: {
      submittedTicketSnapshot: [
        { ...ticket('FAIL-01', 'PO-FAIL', 'FACTORY-HANDOVER', 7), sewingTaskId: 'SEW-01-ID', sewingTaskNo: 'SEW-01' },
        { ...ticket('FAIL-01', 'PO-FAIL', 'FACTORY-HANDOVER', 7), sewingTaskId: 'SEW-01-ID', sewingTaskNo: 'SEW-01' },
      ],
    },
    expected: /提交.*快照.*重复菲票/,
  },
].forEach(({ label, assignments, overrides, expected }, index) => {
  const storage = createMemoryStorage()
  const tickets = [
    ticket('FAIL-01', 'PO-FAIL', 'FACTORY-HANDOVER', 7),
    ticket('FAIL-02', 'PO-FAIL', 'FACTORY-HANDOVER', 5),
  ]
  appendBagging({
    storage,
    bagCode: `BAG-HANDOVER-FAIL-${index}`,
    usageCycleId: `usage:BAG-HANDOVER-FAIL-${index}:1`,
    tickets,
  })
  appendInbound({
    storage,
    bagCode: `BAG-HANDOVER-FAIL-${index}`,
    usageCycleId: `usage:BAG-HANDOVER-FAIL-${index}:1`,
    tickets,
  })
  assertRejectedWithoutWriting(
    storage,
    () => submitWholeBagHandover(handoverInput(
      `BAG-HANDOVER-FAIL-${index}`,
      `usage:BAG-HANDOVER-FAIL-${index}:1`,
      tickets,
      assignments(tickets),
      overrides,
    ), storage),
    expected,
    `${label}必须失败`,
  )
})

{
  const storage = createMemoryStorage()
  const bagCode = 'BAG-HANDOVER-ASSIGNMENT-DRIFT'
  const usageCycleId = `usage:${bagCode}:1`
  const tickets = [
    ticket('ASSIGNMENT-DRIFT-01', 'PO-ASSIGNMENT-DRIFT', 'FACTORY-HANDOVER', 7),
    ticket('ASSIGNMENT-DRIFT-02', 'PO-ASSIGNMENT-DRIFT', 'FACTORY-HANDOVER', 5),
  ]
  appendBagging({ storage, bagCode, usageCycleId, tickets })
  appendInbound({ storage, bagCode, usageCycleId, tickets })
  const qualifiedAssignments = [assignment(tickets[0], 'SEW-01'), assignment(tickets[1], 'SEW-02')]
  const qualifiedSnapshot = submittedSnapshotFor(tickets, qualifiedAssignments)
  assert.equal(resolveWholeBagHandoverEligibility({
    currentUse: resolveTransferBagCurrentUse(bagCode, storage),
    assignments: qualifiedAssignments,
    submittedTicketSnapshot: qualifiedSnapshot,
  }).ok, true, '任务漂移反例必须先完成资格确认')
  const driftedAssignments = qualifiedAssignments.map((item, index) =>
    index === 0
      ? { ...item, sewingTaskId: 'SEW-02-ID', sewingTaskNo: 'SEW-02' }
      : item)
  assertRejectedWithoutWriting(
    storage,
    () => submitWholeBagHandover(handoverInput(
      bagCode,
      usageCycleId,
      tickets,
      driftedAssignments,
      { submittedTicketSnapshot: qualifiedSnapshot },
    ), storage),
    /快照/,
    '资格确认后车缝任务漂移必须阻断',
  )
}

;[
  {
    label: '袋内菲票集合',
    drift: (tickets: TransferBagTicketFactSnapshot[]) => [
      ...tickets,
      ticket('FACT-DRIFT-03', tickets[0].productionOrderNo, 'FACTORY-HANDOVER', 3),
    ],
    assertDrift: (tickets: TransferBagTicketFactSnapshot[]) => tickets.length === 3,
  },
  {
    label: '生产单',
    drift: (tickets: TransferBagTicketFactSnapshot[]) => tickets.map((item) => ({
      ...item,
      productionOrderId: 'PO-ID-FACT-DRIFT-NEW',
      productionOrderNo: 'PO-FACT-DRIFT-NEW',
    })),
    assertDrift: (tickets: TransferBagTicketFactSnapshot[]) =>
      tickets.every((item) => item.productionOrderNo === 'PO-FACT-DRIFT-NEW'),
  },
  {
    label: '片数',
    drift: (tickets: TransferBagTicketFactSnapshot[]) => tickets.map((item, index) =>
      index === 0 ? { ...item, pieceQty: item.pieceQty + 1 } : item),
    assertDrift: (tickets: TransferBagTicketFactSnapshot[]) => tickets[0]?.pieceQty === 8,
  },
].forEach(({ label, drift, assertDrift }, index) => {
  const storage = createMemoryStorage()
  const bagCode = `BAG-HANDOVER-FACT-DRIFT-${index}`
  const usageCycleId = `usage:${bagCode}:1`
  const originalTickets = [
    ticket('FACT-DRIFT-01', 'PO-FACT-DRIFT', 'FACTORY-HANDOVER', 7),
    ticket('FACT-DRIFT-02', 'PO-FACT-DRIFT', 'FACTORY-HANDOVER', 5),
  ]
  appendBagging({ storage, bagCode, usageCycleId, tickets: originalTickets })
  appendInbound({ storage, bagCode, usageCycleId, tickets: originalTickets })
  const qualifiedAssignments = [
    assignment(originalTickets[0], 'SEW-01'),
    assignment(originalTickets[1], 'SEW-02'),
  ]
  const qualifiedSnapshot = submittedSnapshotFor(originalTickets, qualifiedAssignments)
  assert.equal(resolveWholeBagHandoverEligibility({
    currentUse: resolveTransferBagCurrentUse(bagCode, storage),
    assignments: qualifiedAssignments,
    submittedTicketSnapshot: qualifiedSnapshot,
  }).ok, true, `${label}漂移反例必须先完成资格确认`)

  const driftedTickets = drift(originalTickets)
  appendBagging({
    storage,
    bagCode,
    usageCycleId,
    tickets: driftedTickets,
    occurredAt: '2026-08-01 09:00',
  })
  appendInbound({
    storage,
    bagCode,
    usageCycleId,
    tickets: driftedTickets,
    occurredAt: '2026-08-01 09:10',
  })
  const currentUseAfterDrift = resolveTransferBagCurrentUse(bagCode, storage)
  assert(assertDrift(currentUseAfterDrift.tickets), `${label}漂移事实必须真实进入当前袋票关系`)
  const driftedAssignments = driftedTickets.map((item, taskIndex) =>
    assignment(item, taskIndex === 1 ? 'SEW-02' : 'SEW-01'))
  assertRejectedWithoutWriting(
    storage,
    () => submitWholeBagHandover(handoverInput(
      bagCode,
      usageCycleId,
      driftedTickets,
      driftedAssignments,
      { submittedTicketSnapshot: qualifiedSnapshot },
    ), storage),
    /快照/,
    `资格确认后${label}漂移必须阻断`,
  )
})

;[
  {
    label: '菲票已装袋阶段',
    bagCode: 'BAG-HANDOVER-PACKED',
    tickets: [ticket('PACKED-01', 'PO-PACKED', 'FACTORY-HANDOVER', 7)],
    seed: (storage: BrowserStorageLike, bagCode: string, tickets: TransferBagTicketFactSnapshot[]) =>
      appendBagging({ storage, bagCode, usageCycleId: `usage:${bagCode}:1`, tickets }),
    expected: /不是入仓暂存中或待交出/,
  },
  {
    label: '混生产单',
    bagCode: 'BAG-HANDOVER-MIXED-ORDER',
    tickets: [
      ticket('MIXED-01', 'PO-MIXED-A', 'FACTORY-HANDOVER', 7),
      ticket('MIXED-02', 'PO-MIXED-B', 'FACTORY-HANDOVER', 5),
    ],
    seed: (storage: BrowserStorageLike, bagCode: string, tickets: TransferBagTicketFactSnapshot[]) => {
      appendBagging({ storage, bagCode, usageCycleId: `usage:${bagCode}:1`, tickets })
      appendInbound({ storage, bagCode, usageCycleId: `usage:${bagCode}:1`, tickets })
    },
    expected: /同一生产单/,
  },
].forEach(({ label, bagCode, tickets, seed, expected }) => {
  const storage = createMemoryStorage()
  seed(storage, bagCode, tickets)
  assertRejectedWithoutWriting(
    storage,
    () => submitWholeBagHandover(handoverInput(
      bagCode,
      `usage:${bagCode}:1`,
      tickets,
      tickets.map((item, index) => assignment(item, index ? 'SEW-02' : 'SEW-01')),
    ), storage),
    expected,
    `${label}必须失败`,
  )
})

{
  const storage = createMemoryStorage()
  assertRejectedWithoutWritingExact(
    storage,
    () => submitWholeBagHandover(handoverInput(
      'BAG-HANDOVER-EMPTY',
      'usage:BAG-HANDOVER-EMPTY:1',
      [],
      [],
    ), storage),
    '当前中转袋不是入仓暂存中或待交出，不能整袋交出。',
    '空闲空袋不得整袋交出',
  )
}

{
  const storage = createMemoryStorage()
  const bagCode = 'BAG-HANDOVER-SCRAP-ID-COLLISION'
  const usageCycleId = `usage:${bagCode}:1`
  const tickets = [ticket('SCRAP-ID-COLLISION-01', 'PO-SCRAP-ID-COLLISION', 'FACTORY-HANDOVER', 12)]
  const assignments = [assignment(tickets[0], 'SEW-01')]
  appendCuttingRuntimeEvent({
    eventType: '中转袋报废',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: '2026-08-01 07:00',
    operatorName: '资产管理员',
    refs: {
      transferBagCode: 'BAG-SCRAPPED-HISTORY',
      handoverRecordId: 'HR-SCRAP-ID-COLLISION',
    },
    payload: {
      bagCode: 'BAG-SCRAPPED-HISTORY',
      handoverRecordId: 'HR-SCRAP-ID-COLLISION',
      reason: '破损报废',
    },
  } as Parameters<typeof appendCuttingRuntimeEvent>[0], storage)
  appendBagging({ storage, bagCode, usageCycleId, tickets })
  appendInbound({ storage, bagCode, usageCycleId, tickets })
  const event = submitWholeBagHandover(handoverInput(
    bagCode,
    usageCycleId,
    tickets,
    assignments,
    {
      handoverRecordId: 'HR-SCRAP-ID-COLLISION',
      handoverRecordNo: 'HR-SCRAP-ID-COLLISION',
    },
  ), storage)
  assert.equal(event.eventType, '新增交出记录', '报废或破损历史事件不得误命中交出幂等记录')
}

{
  const backingStorage = createMemoryStorage()
  let rejectWrite = false
  const storage: BrowserStorageLike = {
    getItem: (key) => backingStorage.getItem(key),
    setItem: (key, value) => {
      if (rejectWrite) throw new Error('模拟事件追加失败')
      backingStorage.setItem(key, value)
    },
    removeItem: (key) => backingStorage.removeItem(key),
  }
  const bagCode = 'BAG-HANDOVER-APPEND-FAILURE'
  const usageCycleId = `usage:${bagCode}:1`
  const tickets = [
    ticket('APPEND-FAILURE-01', 'PO-APPEND-FAILURE', 'FACTORY-HANDOVER', 7),
    ticket('APPEND-FAILURE-02', 'PO-APPEND-FAILURE', 'FACTORY-HANDOVER', 5),
  ]
  const assignments = [assignment(tickets[0], 'SEW-01'), assignment(tickets[1], 'SEW-02')]
  appendBagging({ storage, bagCode, usageCycleId, tickets })
  appendInbound({ storage, bagCode, usageCycleId, tickets })
  const before = resolveTransferBagCurrentUse(bagCode, storage)
  rejectWrite = true
  assertRejectedWithoutWriting(
    storage,
    () => submitWholeBagHandover(handoverInput(
      bagCode,
      usageCycleId,
      tickets,
      assignments,
    ), storage),
    /模拟事件追加失败/,
    '事件追加异常必须向调用方抛出',
  )
  rejectWrite = false
  const after = resolveTransferBagCurrentUse(bagCode, storage)
  assert.deepEqual(
    [after.usageCycleId, after.flowStage, after.tickets],
    [before.usageCycleId, before.flowStage, before.tickets],
    '交出事件追加异常不得清空或改变当前袋票关系',
  )
}

{
  const storage = createMemoryStorage()
  const bagCode = 'BAG-HANDOVER-FAILED-ID-COLLISION'
  const usageCycleId = `usage:${bagCode}:1`
  const handoverRecordId = 'HR-FAILED-ID-COLLISION'
  const tickets = [ticket('FAILED-ID-COLLISION-01', 'PO-FAILED-ID-COLLISION', 'FACTORY-HANDOVER', 12)]
  const assignments = [assignment(tickets[0], 'SEW-01')]
  appendCuttingRuntimeEvent({
    idempotencyKey: `whole-bag-handover:${handoverRecordId}`,
    eventType: '新增交出记录',
    eventSource: 'WEB',
    eventStatus: '同步失败',
    occurredAt: '2026-08-01 07:00',
    operatorName: '失败事件导入员',
    refs: {
      transferBagCode: 'BAG-OTHER-FAILED',
      usageCycleId: 'usage:BAG-OTHER-FAILED:1',
      handoverRecordId,
    },
    payload: { handoverRecordId },
  } as Parameters<typeof appendCuttingRuntimeEvent>[0], storage)
  appendBagging({ storage, bagCode, usageCycleId, tickets })
  appendInbound({ storage, bagCode, usageCycleId, tickets })
  assertRejectedWithoutWriting(
    storage,
    () => submitWholeBagHandover(handoverInput(
      bagCode,
      usageCycleId,
      tickets,
      assignments,
      { handoverRecordId, handoverRecordNo: handoverRecordId },
    ), storage),
    /交出记录 ID .*意图冲突/,
    '另一袋同步失败事件占用同一交出幂等键时不得被当成本次成功事件返回',
  )
  const current = resolveTransferBagCurrentUse(bagCode, storage)
  assert.equal(current.flowStage, 'INBOUND_STORED', '失败 ID 碰撞不得清空当前袋票关系')
  assert.equal(current.tickets.length, 1)
}

{
  const storage = createMemoryStorage()
  const bagCode = 'BAG-HANDOVER-DAMAGED-SUCCESS'
  const usageCycleId = `usage:${bagCode}:1`
  const tickets = [ticket('DAMAGED-SUCCESS-01', 'PO-DAMAGED-SUCCESS', 'FACTORY-HANDOVER', 12)]
  const assignments = [assignment(tickets[0], 'SEW-01')]
  appendBagging({ storage, bagCode, usageCycleId, tickets })
  appendInbound({ storage, bagCode, usageCycleId, tickets })
  const request = handoverInput(bagCode, usageCycleId, tickets, assignments)
  const event = submitWholeBagHandover(request, storage)
  const rawLedger = storage.getItem?.(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY)
  assert(rawLedger, '测试必须取得事件账持久化内容')
  const damagedStore = JSON.parse(rawLedger) as { events: Array<Record<string, unknown>> }
  const damagedEvent = damagedStore.events.find((item) => item.eventId === event.eventId)
  assert(damagedEvent, '测试必须找到首次成功交出事件')
  const damagedPayload = damagedEvent.payload as Record<string, unknown>
  damagedPayload.transferBagUses = []
  damagedPayload.feiTicketItems = []
  storage.setItem?.(CUTTING_RUNTIME_EVENT_LEDGER_STORAGE_KEY, JSON.stringify(damagedStore))
  assertRejectedWithoutWriting(
    storage,
    () => submitWholeBagHandover(structuredClone(request), storage),
    /交出记录 ID .*意图冲突/,
    '损坏历史成功载荷即使保留伪造 canonicalIntent 也不得命中等价重试',
  )
}

;(['同步失败', '已取消', '已记录'] as const).forEach((eventStatus, index) => {
  const storage = createMemoryStorage()
  const bagCode = `BAG-HANDOVER-NON-SUCCESS-${index + 1}`
  const usageCycleId = `usage:${bagCode}:1`
  const tickets = [ticket(`NON-SUCCESS-${index + 1}`, 'PO-NON-SUCCESS', 'FACTORY-HANDOVER', 12)]
  appendBagging({ storage, bagCode, usageCycleId, tickets })
  appendInbound({ storage, bagCode, usageCycleId, tickets })
  const factsBefore = listWaitHandoverLifecycleFacts(bagCode, storage)
  appendCuttingRuntimeEvent({
    eventType: '新增交出记录',
    eventSource: 'WEB',
    eventStatus,
    occurredAt: `2026-08-01 09:0${index + 1}`,
    operatorName: '交出员',
    refs: { transferBagCode: bagCode, usageCycleId, handoverRecordId: `HR-NON-SUCCESS-${index + 1}` },
    payload: { handoverRecordId: `HR-NON-SUCCESS-${index + 1}` },
  } as Parameters<typeof appendCuttingRuntimeEvent>[0], storage)
  const current = resolveTransferBagCurrentUse(bagCode, storage)
  assert.equal(current.flowStage, 'INBOUND_STORED', `${eventStatus}交出事件不得推进袋生命周期`)
  assert.deepEqual(current.tickets, tickets, `${eventStatus}交出事件不得清空当前袋票关系`)
  assert.deepEqual(listWaitHandoverLifecycleFacts(bagCode, storage), factsBefore, `${eventStatus}交出事件不得生成交出生命周期事实`)
  assert.deepEqual(buildNextWaitHandoverHandoverLeg({
    bagCode,
    usageCycleId,
    events: listCuttingRuntimeEvents(storage),
  }), {
    handoverLegId: `${usageCycleId}:handover:1`,
    handoverSequence: 1,
  }, `${eventStatus}交出事件不得占用下一交出流转段`)
  const assignments = [assignment(tickets[0], 'SEW-01')]
  const successfulEvent = submitWholeBagHandover(handoverInput(
    bagCode,
    usageCycleId,
    tickets,
    assignments,
    {
      handoverRecordId: `HR-AFTER-NON-SUCCESS-${index + 1}`,
      handoverRecordNo: `HR-AFTER-NON-SUCCESS-${index + 1}`,
    },
  ), storage)
  assert.equal(successfulEvent.eventStatus, '已同步', `${eventStatus}不完整事件不得阻断后续完整整袋交出`)
})

{
  const storage = createMemoryStorage()
  const bagCode = 'BAG-HANDOVER-DAMAGED-FOLD'
  const usageCycleId = `usage:${bagCode}:1`
  const tickets = [ticket('DAMAGED-FOLD-01', 'PO-DAMAGED-FOLD', 'FACTORY-HANDOVER', 12)]
  appendBagging({ storage, bagCode, usageCycleId, tickets })
  appendInbound({ storage, bagCode, usageCycleId, tickets })
  appendCuttingRuntimeEvent({
    eventType: '新增交出记录',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: '2026-08-01 09:30',
    operatorName: '损坏事件导入员',
    refs: { transferBagCode: bagCode, usageCycleId, handoverRecordId: 'HR-DAMAGED-FOLD' },
    payload: { handoverRecordId: 'HR-DAMAGED-FOLD', canonicalIntent: '伪造意图' },
  } as Parameters<typeof appendCuttingRuntimeEvent>[0], storage)
  const current = resolveTransferBagCurrentUse(bagCode, storage)
  assert.equal(current.flowStage, 'INBOUND_STORED', '损坏成功载荷不得推进袋生命周期')
  assert.deepEqual(current.tickets, tickets, '损坏成功载荷不得清空当前袋票关系')
}

{
  const storage = createMemoryStorage()
  const bagCode = 'BAG-SPECIAL-STRICT-FACT'
  const usageCycleId = `usage:${bagCode}:1`
  const tickets = [ticket('SPECIAL-STRICT-01', 'PO-SPECIAL-STRICT', 'CRAFT-FACTORY-STRICT', 12)]
  appendBagging({ storage, bagCode, usageCycleId, tickets })
  appendInbound({ storage, bagCode, usageCycleId, tickets })
  const factsBefore = listWaitHandoverLifecycleFacts(bagCode, storage)
  const assertUnconsumed = (message: string) => {
    const current = resolveTransferBagCurrentUse(bagCode, storage)
    assert.equal(current.flowStage, 'INBOUND_STORED', `${message}，不得推进当前使用阶段`)
    assert.deepEqual(current.tickets, tickets, `${message}，不得清空当前袋票关系`)
    assert.deepEqual(listWaitHandoverLifecycleFacts(bagCode, storage), factsBefore, `${message}，不得生成生命周期交出事实`)
    assert.deepEqual(buildNextWaitHandoverHandoverLeg({
      bagCode,
      usageCycleId,
      events: listCuttingRuntimeEvents(storage),
    }), {
      handoverLegId: `${usageCycleId}:handover:1`,
      handoverSequence: 1,
    }, `${message}，不得占用交出流转段`)
    assert.equal(
      buildWaitHandoverLocationOccupancyStates(listCuttingRuntimeEvents(storage))
        .some((state) => state.bagCode === bagCode && state.usageCycleId === usageCycleId),
      true,
      `${message}，不得删除待交出仓库位占用`,
    )
  }
  appendCuttingRuntimeEvent({
    eventType: '特殊工艺交出',
    eventSource: 'WEB',
    eventStatus: '同步失败',
    occurredAt: '2026-08-01 08:30',
    operatorName: '失败事实导入员',
    refs: {
      handoverOrderId: 'SPECIAL-HO-FAILED',
      handoverRecordId: 'SPECIAL-HR-FAILED',
      specialCraftId: 'SPECIAL-CRAFT-STRICT',
      transferBagCode: bagCode,
      usageCycleId,
      handoverLegId: `${usageCycleId}:handover:1`,
      feiTicketIds: tickets.map((item) => item.feiTicketId),
      feiTicketNos: tickets.map((item) => item.feiTicketNo),
    },
    inventoryEffect: {
      inventoryScope: '裁床待交出仓',
      direction: 'OUT',
      qty: 12,
      unit: '片',
      fromWarehouseArea: '待交出 A 区',
      fromLocationCode: `A-${bagCode}`,
    },
    payload: { handoverRecordId: 'SPECIAL-HR-FAILED' },
  } as Parameters<typeof appendCuttingRuntimeEvent>[0], storage)
  assertUnconsumed('同步失败的特殊工艺 OUT')

  const damaged = appendCuttingRuntimeEvent({
    eventType: '特殊工艺交出',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: '2026-08-01 08:40',
    operatorName: '损坏事实导入员',
    refs: {
      handoverOrderId: 'SPECIAL-HO-DAMAGED',
      handoverRecordId: 'SPECIAL-HR-DAMAGED',
      specialCraftId: 'SPECIAL-CRAFT-STRICT',
      transferBagCode: bagCode,
      usageCycleId,
      handoverLegId: `${usageCycleId}:handover:7`,
      feiTicketIds: tickets.map((item) => item.feiTicketId),
      feiTicketNos: tickets.map((item) => item.feiTicketNo),
    },
    inventoryEffect: {
      inventoryScope: '裁床待交出仓',
      direction: 'OUT',
      qty: 12,
      unit: '片',
      fromWarehouseArea: '待交出 A 区',
      fromLocationCode: `A-${bagCode}`,
    },
    payload: {
      handoverRecordId: 'SPECIAL-HR-DAMAGED',
      canonicalIntent: '伪造完整事实',
    },
  } as Parameters<typeof appendCuttingRuntimeEvent>[0], storage)
  assert.equal(isCompleteSuccessfulSpecialCraftHandoverEvent(damaged), false, '损坏特殊工艺载荷不得通过严格守卫')
  assertUnconsumed('已同步但损坏且伪造 handover:7 的特殊工艺事实')

  const complete = appendWaitHandoverSpecialCraftHandoverEvent({
    source: 'WEB',
    operator: { operatorId: 'OP-SPECIAL-STRICT', operatorName: '特殊工艺交出员' },
    payload: {
      handoverOrderId: 'SPECIAL-HO-STRICT',
      handoverRecordId: 'SPECIAL-HR-STRICT',
      craftCategory: '特种工艺',
      craftType: '绣花',
      receiverFactoryId: 'CRAFT-FACTORY-STRICT',
      receiverFactoryName: '严格事实绣花厂',
      feiTicketItems: tickets.map((item) => ({
        feiTicketId: item.feiTicketId,
        feiTicketNo: item.feiTicketNo,
        specialCraftId: 'SPECIAL-CRAFT-STRICT',
        partName: item.partName,
        size: item.size,
        pieceQty: item.pieceQty,
      })),
      handedOverAt: '2026-08-01 09:00',
      handedOverBy: '特殊工艺交出员',
    },
    handoverOrderId: 'SPECIAL-HO-STRICT',
    handoverRecordId: 'SPECIAL-HR-STRICT',
    specialCraftId: 'SPECIAL-CRAFT-STRICT',
    transferBagCode: bagCode,
    fromWarehouseArea: '待交出 A 区',
    occurredAt: '2026-08-01 09:00',
    usageCycleId,
    storage,
  })
  assert.equal(isCompleteSuccessfulSpecialCraftHandoverEvent(complete), true, 'writer 必须产生可独立验证的完整特殊工艺整袋交出事实')
  assert.deepEqual(
    [resolveTransferBagCurrentUse(bagCode, storage).flowStage, resolveTransferBagCurrentUse(bagCode, storage).tickets.length],
    ['HANDED_OVER_WAITING_RETURN', 0],
    '完整成功特殊工艺交出必须推进当前使用投影',
  )
  assert.equal(
    listWaitHandoverLifecycleFacts(bagCode, storage).at(-1)?.factType,
    'HANDOVER_CONFIRMED',
    '完整成功特殊工艺交出必须进入生命周期事实',
  )
  assert.deepEqual(buildNextWaitHandoverHandoverLeg({
    bagCode,
    usageCycleId,
    events: listCuttingRuntimeEvents(storage),
  }), {
    handoverLegId: `${usageCycleId}:handover:2`,
    handoverSequence: 2,
  }, '完整成功特殊工艺交出必须只占用一个交出流转段')
  assert.equal(
    buildWaitHandoverLocationOccupancyStates(listCuttingRuntimeEvents(storage))
      .some((state) => state.bagCode === bagCode && state.usageCycleId === usageCycleId),
    false,
    '完整成功特殊工艺整袋交出必须删除待交出仓库位占用',
  )
}

{
  const storage = createMemoryStorage()
  const bagCode = 'BAG-DYNAMIC-HANDOVER-LEG'
  const usageCycleId = `usage:${bagCode}:1`
  const tickets = [ticket('DYNAMIC-LEG-01', 'PO-DYNAMIC-LEG', 'FACTORY-HANDOVER', 12)]
  const assignments = [assignment(tickets[0], 'SEW-DYNAMIC-LEG')]
  const submittedTickets = submittedSnapshotFor(tickets, assignments)
  appendBagging({ storage, bagCode, usageCycleId, tickets })
  appendInbound({ storage, bagCode, usageCycleId, tickets })
  const specialHandover = appendWaitHandoverSpecialCraftHandoverEvent({
    source: 'WEB',
    operator: { operatorName: '特殊工艺交出员' },
    payload: {
      handoverOrderId: 'SPECIAL-HO-DYNAMIC-001',
      handoverRecordId: 'SPECIAL-HR-DYNAMIC-001',
      craftCategory: '特种工艺',
      craftType: '绣花',
      receiverFactoryId: 'CRAFT-FACTORY-DYNAMIC',
      receiverFactoryName: '测试绣花厂',
      feiTicketItems: submittedTickets.map((item) => ({
        feiTicketId: item.feiTicketId,
        feiTicketNo: item.feiTicketNo,
        specialCraftId: 'CRAFT-DYNAMIC-001',
        partName: item.partName,
        size: item.size,
        pieceQty: item.pieceQty,
      })),
      handedOverAt: '2026-08-01 09:00',
      handedOverBy: '特殊工艺交出员',
    },
    handoverOrderId: 'SPECIAL-HO-DYNAMIC-001',
    handoverRecordId: 'SPECIAL-HR-DYNAMIC-001',
    specialCraftId: 'CRAFT-DYNAMIC-001',
    transferBagCode: bagCode,
    fromWarehouseArea: '待交出 A 区',
    occurredAt: '2026-08-01 09:00',
    usageCycleId,
    storage,
  })
  assert.equal(specialHandover.refs.handoverLegId, `${usageCycleId}:handover:1`)
  appendWaitHandoverSpecialCraftReturnEvent({
    source: 'WEB',
    operator: { operatorName: '特殊工艺回仓员' },
    payload: {
      returnRecordId: 'SPECIAL-RETURN-DYNAMIC-001',
      returnRecordNo: 'SPECIAL-RETURN-DYNAMIC-001',
      sourceHandoverOrderId: 'SPECIAL-HO-DYNAMIC-001',
      sourceHandoverOrderNo: 'SPECIAL-HO-DYNAMIC-001',
      sourceHandoverRecordId: 'SPECIAL-HR-DYNAMIC-001',
      sourceHandoverRecordNo: 'SPECIAL-HR-DYNAMIC-001',
      receiverFactoryId: 'CRAFT-FACTORY-DYNAMIC',
      receiverFactoryName: '测试绣花厂',
      transferBagCode: bagCode,
      warehouseName: '裁床待交出仓',
      craftType: '绣花',
      returnedFeiTicketItems: submittedTickets.map((item) => ({
        feiTicketId: item.feiTicketId,
        feiTicketNo: item.feiTicketNo,
        specialCraftId: 'CRAFT-DYNAMIC-001',
        craftType: '绣花',
        partName: item.partName,
        size: item.size,
        expectedQty: item.pieceQty,
        returnedQty: item.pieceQty,
        unit: '片' as const,
        returnStatus: '已回仓' as const,
      })),
      warehouseArea: '待交出 A 区',
      locationCode: `A-${bagCode}`,
      returnedAt: '2026-08-01 09:20',
      returnedBy: '特殊工艺回仓员',
    },
    specialCraftId: 'CRAFT-DYNAMIC-001',
    occurredAt: '2026-08-01 09:20',
    usageCycleId,
    storage,
  })
  assert.equal(
    buildWaitHandoverLifecycleByBagCode(bagCode, storage).flowStage,
    'INBOUND_STORED',
    '特殊工艺整袋回仓后必须恢复可再次交出的已入仓阶段',
  )
  const ordinaryHandover = submitWholeBagHandover(handoverInput(
    bagCode,
    usageCycleId,
    tickets,
    assignments,
    {
      handoverRecordId: 'HR-DYNAMIC-ORDINARY-002',
      handoverRecordNo: 'HR-DYNAMIC-ORDINARY-002',
      occurredAt: '2026-08-01 09:30',
    },
  ), storage)
  assert.equal(
    ordinaryHandover.refs.handoverLegId,
    `${usageCycleId}:handover:2`,
    '特殊工艺交出并回仓后，普通整袋交出必须使用第二交出段',
  )
  assert.equal(isCompleteSuccessfulWholeBagHandoverEvent(ordinaryHandover), true, '第二交出段必须仍通过严格守卫')
  const ordinaryPayload = ordinaryHandover.payload as Record<string, unknown>
  assert.equal(ordinaryPayload.handoverLegId, `${usageCycleId}:handover:2`, '交出段必须进入权威载荷')
  assert(
    String(ordinaryPayload.canonicalIntent).includes(`"handoverLegId":"${usageCycleId}:handover:2"`),
    'canonical 必须绑定动态交出段，避免回仓关联歧义',
  )
  const zeroLegEvent = structuredClone(ordinaryHandover)
  zeroLegEvent.refs.handoverLegId = `${usageCycleId}:handover:0`
  ;(zeroLegEvent.payload as Record<string, unknown>).handoverLegId = `${usageCycleId}:handover:0`
  ;(zeroLegEvent.payload as Record<string, unknown>).canonicalIntent = String(
    (zeroLegEvent.payload as Record<string, unknown>).canonicalIntent,
  ).replace(`${usageCycleId}:handover:2`, `${usageCycleId}:handover:0`)
  assert.equal(isCompleteSuccessfulWholeBagHandoverEvent(zeroLegEvent), false, 'handover:0 不得被严格守卫承认为成功交出段')
  const mismatchedLegEvent = structuredClone(ordinaryHandover)
  mismatchedLegEvent.refs.handoverLegId = `${usageCycleId}:handover:3`
  assert.equal(isCompleteSuccessfulWholeBagHandoverEvent(mismatchedLegEvent), false, 'refs 与载荷/canonical 的交出段不一致时必须拒绝')
  const retry = submitWholeBagHandover(handoverInput(
    bagCode,
    usageCycleId,
    tickets,
    assignments,
    {
      handoverRecordId: 'HR-DYNAMIC-ORDINARY-002',
      handoverRecordNo: 'HR-DYNAMIC-ORDINARY-002',
      occurredAt: '2026-08-01 09:30',
    },
  ), storage)
  assert.equal(retry.eventId, ordinaryHandover.eventId, '动态交出段等价重试必须返回原事实')
}

{
  const storage = createMemoryStorage()
  const bagCode = 'BAG-OCCUPANCY-STRICT-HANDOVER'
  const usageCycleId = `usage:${bagCode}:1`
  const tickets = [ticket('OCCUPANCY-STRICT-01', 'PO-OCCUPANCY', 'FACTORY-HANDOVER', 12)]
  const assignments = [assignment(tickets[0], 'SEW-OCCUPANCY')]
  appendBagging({ storage, bagCode, usageCycleId, tickets })
  appendInbound({ storage, bagCode, usageCycleId, tickets })
  const assertOccupied = (message: string) => assert.equal(
    buildWaitHandoverLocationOccupancyStates(listCuttingRuntimeEvents(storage))
      .filter((state) => state.bagCode === bagCode && state.usageCycleId === usageCycleId)
      .length,
    1,
    message,
  )
  assertOccupied('中转袋入仓后必须形成库位占用')
  ;(['同步失败', '已取消', '已记录', '已同步'] as const).forEach((eventStatus, index) => {
    appendCuttingRuntimeEvent({
      eventType: '新增交出记录',
      eventSource: 'WEB',
      eventStatus,
      occurredAt: `2026-08-01 09:4${index}`,
      operatorName: '异常交出导入员',
      refs: {
        transferBagCode: bagCode,
        usageCycleId,
        handoverRecordId: `HR-OCCUPANCY-INCOMPLETE-${index}`,
      },
      payload: {
        handoverRecordId: `HR-OCCUPANCY-INCOMPLETE-${index}`,
      },
    } as Parameters<typeof appendCuttingRuntimeEvent>[0], storage)
    assertOccupied(`${eventStatus}的残缺交出事实不得删除待交出仓占用`)
  })
  const complete = submitWholeBagHandover(handoverInput(
    bagCode,
    usageCycleId,
    tickets,
    assignments,
    {
      handoverRecordId: 'HR-OCCUPANCY-COMPLETE',
      handoverRecordNo: 'HR-OCCUPANCY-COMPLETE',
      occurredAt: '2026-08-01 10:00',
    },
  ), storage)
  assert.equal(isCompleteSuccessfulWholeBagHandoverEvent(complete), true)
  assert.equal(
    buildWaitHandoverLocationOccupancyStates(listCuttingRuntimeEvents(storage))
      .some((state) => state.bagCode === bagCode && state.usageCycleId === usageCycleId),
    false,
    '只有完整成功整袋交出事实才能删除待交出仓占用',
  )
}

{
  const legacy = deserializeTransferBagRuntimeStorage(JSON.stringify({
    usages: [{
      cycleId: 'CYCLE-LEGACY',
      cycleNo: 'TBU-LEGACY',
      carrierId: 'BAG-ID-LEGACY',
      carrierCode: 'BAG-LEGACY',
      carrierType: 'bag',
      sewingTaskId: 'SEW-LEGACY-ID',
      sewingTaskNo: 'SEW-LEGACY',
      sewingTaskIds: [],
      sewingTaskNos: [],
      cycleStatus: 'READY_TO_DISPATCH',
      status: 'loaded',
    }],
  })).usages[0]
  assert.deepEqual(legacy.sewingTaskIds, ['SEW-LEGACY-ID'], '旧周期缺少数组时必须由单值兼容回填')
  assert.deepEqual(legacy.sewingTaskNos, ['SEW-LEGACY'], '旧周期任务号必须由单值兼容回填')

  const arrayFirst = deserializeTransferBagRuntimeStorage(JSON.stringify({
    usages: [{
      cycleId: 'CYCLE-ARRAY-FIRST',
      cycleNo: 'TBU-ARRAY-FIRST',
      carrierId: 'BAG-ID-ARRAY-FIRST',
      carrierCode: 'BAG-ARRAY-FIRST',
      carrierType: 'bag',
      sewingTaskId: 'SEW-OLD-SINGLE-ID',
      sewingTaskNo: 'SEW-OLD-SINGLE',
      sewingTaskIds: [' SEW-02-ID ', 'SEW-01-ID', '', 'SEW-02-ID'],
      sewingTaskNos: [' SEW-02 ', 'SEW-01', '', 'SEW-02'],
      cycleStatus: 'READY_TO_DISPATCH',
      status: 'loaded',
    }],
  })).usages[0]
  assert.deepEqual(arrayFirst.sewingTaskIds, ['SEW-02-ID', 'SEW-01-ID'], '数组非空时必须优先、去空去重并保持顺序')
  assert.deepEqual(arrayFirst.sewingTaskNos, ['SEW-02', 'SEW-01'])

  const task: SewingTaskRefRecord = {
    sewingTaskId: 'SEW-NEW-ID',
    sewingTaskNo: 'SEW-NEW',
    sewingFactoryId: 'FACTORY-HANDOVER',
    sewingFactoryName: '唯一接收车缝厂',
    styleCode: 'STYLE-01',
    spuCode: 'SPU-01',
    skuSummary: 'SKU-01',
    colorSummary: '深蓝',
    sizeSummary: 'M',
    plannedQty: 12,
    status: '待接料',
    note: '测试新周期',
  }
  const carrier = {
    carrierId: 'BAG-ID-NEW',
    carrierCode: 'BAG-NEW-CYCLE',
    carrierType: 'bag',
  } as TransferCarrierRecord
  const cycle = createCarrierCycleRecord({
    carrier,
    sewingTask: task,
    existingUsages: [],
    nowText: '2026-08-01 11:00',
  })
  assert.deepEqual(cycle.sewingTaskIds, ['SEW-NEW-ID'], '新周期必须只以任务数组表达当前任务归属')
  assert.deepEqual(cycle.sewingTaskNos, ['SEW-NEW'])
  assert.equal(cycle.sewingTaskId, '', '新周期不得把第一个任务回写为唯一任务单值')
  assert.equal(cycle.sewingTaskNo, '')

  const pageBag: TransferBagMaster = {
    carrierId: 'BAG-ID-PAGE-ARRAY',
    carrierCode: 'BAG-PAGE-ARRAY',
    carrierType: 'bag',
    latestCycleId: '',
    latestCycleNo: '',
    bagId: 'BAG-ID-PAGE-ARRAY',
    bagCode: 'BAG-PAGE-ARRAY',
    bagName: '页面数组适配袋',
    bagSpec: '标准袋',
    bagMaterial: '尼龙',
    ownershipFactoryId: 'FACTORY-HANDOVER',
    ownershipFactoryName: '唯一接收车缝厂',
    bagType: '标准中转袋',
    capacity: 100,
    reusable: true,
    currentStatus: 'IDLE',
    currentLocation: '裁床待交出仓',
    latestUsageId: '',
    latestUsageNo: '',
    currentCycleId: '',
    currentOwnerTaskId: '',
    note: '页面模型数组测试',
  }
  const pageDraft = createTransferBagUsageDraft({
    bag: pageBag,
    sewingTask: task,
    existingUsages: [],
    nowText: '2026-08-01 11:10',
  })
  assert.deepEqual(pageDraft.sewingTaskIds, ['SEW-NEW-ID'], '页面适配必须优先保留新周期任务 ID 数组')
  assert.deepEqual(pageDraft.sewingTaskNos, ['SEW-NEW'], '页面适配必须优先保留新周期任务号数组')
  assert.equal(pageDraft.boundObjectId, 'SEW-NEW-ID', '单值 boundObject 只能明确兼容展示数组中的首个任务')
  assert.equal(pageDraft.boundObjectNo, 'SEW-NEW')

  const singleStore = emptyPageTransferBagStore()
  singleStore.masters = [pageBag]
  singleStore.usages = [pageDraft]
  singleStore.sewingTasks = [{ ...task }]
  const singleRoundTrip = deserializeTransferBagStorage(serializeTransferBagStorage(singleStore)).usages[0]
  assert.deepEqual(singleRoundTrip.sewingTaskIds, ['SEW-NEW-ID'], '页面模型单任务往返不得丢失数组')
  assert.deepEqual(singleRoundTrip.sewingTaskNos, ['SEW-NEW'])

  const multiStore = emptyPageTransferBagStore()
  multiStore.masters = [pageBag]
  multiStore.usages = [{
    ...pageDraft,
    sewingTaskId: 'SEW-LEGACY-SINGLE-ID',
    sewingTaskNo: 'SEW-LEGACY-SINGLE',
    sewingTaskIds: ['SEW-NEW-ID', 'SEW-SECOND-ID'],
    sewingTaskNos: ['SEW-NEW', 'SEW-SECOND'],
  }]
  multiStore.sewingTasks = [{ ...task }]
  const multiRoundTrip = deserializeTransferBagStorage(serializeTransferBagStorage(multiStore)).usages[0]
  assert.deepEqual(multiRoundTrip.sewingTaskIds, ['SEW-NEW-ID', 'SEW-SECOND-ID'], '页面模型多任务往返不得静默截断数组')
  assert.deepEqual(multiRoundTrip.sewingTaskNos, ['SEW-NEW', 'SEW-SECOND'])

  const legacyPageStore = emptyPageTransferBagStore()
  legacyPageStore.masters = [pageBag]
  legacyPageStore.usages = [{
    ...pageDraft,
    sewingTaskId: 'SEW-PAGE-LEGACY-ID',
    sewingTaskNo: 'SEW-PAGE-LEGACY',
    sewingTaskIds: [],
    sewingTaskNos: [],
  }]
  const legacyPageRoundTrip = deserializeTransferBagStorage(serializeTransferBagStorage(legacyPageStore)).usages[0]
  assert.deepEqual(legacyPageRoundTrip.sewingTaskIds, ['SEW-PAGE-LEGACY-ID'], '页面数组空值时必须回退旧任务单值')
  assert.deepEqual(legacyPageRoundTrip.sewingTaskNos, ['SEW-PAGE-LEGACY'])
}

console.log('PASS check-transfer-bag-repack-recovery')
