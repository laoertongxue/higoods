#!/usr/bin/env node

// @ts-expect-error 本脚本由 Node + tsx 运行，仓库未安装 @types/node。
import assert from 'node:assert/strict'
import {
  appendCuttingRuntimeEvent,
  listCuttingRuntimeEvents,
  type TransferBagRepackPayload,
  type TransferBagTicketFactSnapshot,
} from '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
import type { BrowserStorageLike } from '../src/data/browser-storage.ts'
import {
  eventTouchesTransferBag,
  resolveTransferBagCurrentUse,
  submitTransferBagRepack,
} from '../src/data/fcs/cutting/transfer-bag-operations.ts'
import {
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
  const retry = submitTransferBagRepack(repackInput({ repackBatchId: ' REPACK-2-TO-2 ' }), storage)
  const repackEvents = listCuttingRuntimeEvents(storage).filter((event) => event.eventType === '中转袋拆袋重装')
  const repackPayload = repackEvents[0].payload as TransferBagRepackPayload
  assert.equal(first.eventId, retry.eventId)
  assert.equal(repackEvents.length, 1, '同一重装批次重试只能保留一条事件')
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
  const source = [ticket('ORDER-1', 'PO-ORDER', 'F-ORDER')]
  const bagging = appendBagging({
    storage,
    bagCode: 'BAG-ORDER',
    usageCycleId: 'usage:BAG-ORDER:old',
    tickets: source,
  })
  const repack = submitTransferBagRepack({
    repackBatchId: 'REPACK-SAME-TIME',
    sourceBagCodes: ['BAG-ORDER'],
    results: [{ bagCode: 'BAG-ORDER', feiTicketIds: ['ORDER-1'] }],
    operator,
    source: 'WEB',
    occurredAt: '2026-08-01 08:00',
  }, storage)
  const normalizedBagging = { ...bagging, eventId: 'event-a-bagging', occurredAt: '2026-08-01 08:00' }
  const normalizedRepack = { ...repack, eventId: 'event-z-repack', occurredAt: '2026-08-01 08:00' }
  const forward = createMemoryStorage()
  const reverse = createMemoryStorage()
  forward.setItem?.('cuttingRuntimeEventLedger', JSON.stringify({ events: [normalizedBagging, normalizedRepack] }))
  reverse.setItem?.('cuttingRuntimeEventLedger', JSON.stringify({ events: [normalizedRepack, normalizedBagging] }))
  const forwardUse = resolveTransferBagCurrentUse('BAG-ORDER', forward)
  const reverseUse = resolveTransferBagCurrentUse('BAG-ORDER', reverse)
  assert.deepEqual(reverseUse, forwardUse, '同时间当前关系投影不得依赖原始输入顺序')
  assert.equal(forwardUse.flowStage, 'READY_HANDOVER')
}

{
  const storage = createMemoryStorage()
  const source = [ticket('LOCATION-1', 'PO-LOCATION', 'F-LOCATION')]
  appendBagging({ storage, bagCode: 'BAG-LOCATION', usageCycleId: 'usage:BAG-LOCATION:old', tickets: source })
  const inbound = appendInbound({
    storage,
    bagCode: 'BAG-LOCATION',
    usageCycleId: 'usage:BAG-LOCATION:old',
    tickets: source,
    occurredAt: '2026-08-01 08:10',
  })
  const repack = submitTransferBagRepack({
    repackBatchId: 'REPACK-LOCATION-SAME-TIME',
    sourceBagCodes: ['BAG-LOCATION'],
    results: [{ bagCode: 'BAG-LOCATION-NEW', feiTicketIds: ['LOCATION-1'] }],
    operator,
    source: 'WEB',
    occurredAt: '2026-08-01 08:10',
  }, storage)
  const normalizedInbound = { ...inbound, eventId: 'event-a-inbound', occurredAt: '2026-08-01 08:10' }
  const normalizedRepack = { ...repack, eventId: 'event-z-repack', occurredAt: '2026-08-01 08:10' }
  const forward = buildWaitHandoverLocationOccupancyStates([normalizedInbound, normalizedRepack])
  const reverse = buildWaitHandoverLocationOccupancyStates([normalizedRepack, normalizedInbound])
  assert.deepEqual(reverse, forward, '同时间库位投影不得依赖原始输入顺序')
  assert.deepEqual(forward, [], '同时间事件按 eventId 折叠后来源袋库位应清空')
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
  appendCuttingRuntimeEvent({
    eventType: '新增交出记录',
    eventSource: 'WEB',
    eventStatus: '已同步',
    occurredAt: '2026-08-01 09:10',
    operatorName: '交出员',
    refs: {
      transferBagCode: 'BAG-HISTORY',
      usageCycleId: 'usage:BAG-HISTORY:old',
      handoverLegId: 'leg:history:1',
      feiTicketIds: ['HISTORY'],
    },
    payload: {
      handoverOrderId: 'HO-HISTORY',
      handoverOrderNo: 'HO-HISTORY',
      handoverRecordId: 'HR-HISTORY',
      handoverRecordNo: 'HR-HISTORY',
      receiverType: '车缝厂',
      receiverId: 'F-HISTORY',
      receiverName: '历史接收厂',
      transferBagUses: [{
        bagUseId: 'usage:BAG-HISTORY:old',
        bagCode: 'BAG-HISTORY',
        containedFeiTicketIds: ['HISTORY'],
        totalPieceQty: historical.pieceQty,
        ticketSnapshot: [historical],
      }],
      feiTicketItems: [{ feiTicketId: 'HISTORY', feiTicketNo: historical.feiTicketNo, pieceQty: historical.pieceQty, unit: '片' }],
      currentHandedOverQty: historical.pieceQty,
      submittedAt: '2026-08-01 09:10',
      submittedBy: '交出员',
    },
  }, storage)
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

console.log('PASS check-transfer-bag-repack-recovery')
