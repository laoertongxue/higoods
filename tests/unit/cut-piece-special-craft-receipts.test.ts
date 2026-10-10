import assert from 'node:assert/strict'
import test from 'node:test'
import { appendCuttingRuntimeEvent, listCuttingRuntimeEvents, type TransferBagTicketFactSnapshot } from '../../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
import type { BrowserStorageLike } from '../../src/data/browser-storage.ts'
import { submitSpecialCraftBagReturn, submitSpecialCraftTicketOnlyReturn, submitWholeBagHandover, correctSpecialCraftTicketReturn, listSpecialCraftTicketReturnFacts, listSpecialCraftProcessingCompletionFacts, resolveTransferBagCurrentUse, resolveTransferBagCurrentUsesFromEvents, resolveWholeBagHandoverEligibility, assertSpecialCraftBagCompatibility } from '../../src/data/fcs/cutting/transfer-bag-operations.ts'
import { appendWaitHandoverInboundEvent, appendWaitHandoverSpecialCraftHandoverEvent, appendWaitHandoverSpecialCraftReturnEvent, buildWaitHandoverLifecycleByBagCode, listWaitHandoverLifecycleFacts, buildWaitHandoverLocationOccupancyStates, buildWaitHandoverRuntimeTicketFromGeneratedTicket, buildCurrentWaitHandoverInventoryRecords } from '../../src/pages/process-factory/cutting/wait-handover-runtime.ts'
import { projectReleaseTicket, buildReleaseBagEvidence, buildCutPieceReleaseCurrentTicketLocations, setPublishedReleaseTicketDetails } from '../../src/data/fcs/cutting/cut-piece-release-facts.ts'
import { buildReleaseMatrix } from '../../src/data/fcs/cut-piece-release-domain.ts'
import type { GeneratedFeiTicketSourceRecord } from '../../src/data/fcs/cutting/generated-fei-tickets.ts'
import { applySpecialCraftReceiptToBinding, buildRuntimeSpecialCraftFeiTicketBindings, type CuttingSpecialCraftFeiTicketBinding } from '../../src/data/fcs/cutting/special-craft-fei-ticket-flow.ts'
import { resolveSpecialCraftBagHandoverCandidate } from '../../src/pages/process-factory/cutting/wait-handover-actions.ts'
import type { TransferBagCurrentUse } from '../../src/data/fcs/cutting/transfer-bag-operations.ts'
import type { SpecialCraftTicketReturnFact } from '../../src/data/fcs/cutting/transfer-bag-operations.ts'
import type { RuntimeProcessTask } from '../../src/data/fcs/runtime-process-tasks.ts'
import type { getProductionOrderCutPieceParts } from '../../src/data/fcs/production-order-tech-pack-runtime.ts'
import { getProductionOrderCutPieceParts as readCutPieceParts } from '../../src/data/fcs/production-order-tech-pack-runtime.ts'
import { productionOrders } from '../../src/data/fcs/production-orders.ts'
import { processTasks } from '../../src/data/fcs/process-tasks.ts'
import { buildSpecialCraftReleaseDemoTasks } from '../../src/data/fcs/cutting/special-craft-release-demo-tasks.ts'
import { renderPdaSpecialCraftReturnFlow } from '../../src/pages/pda-cutting-handover.ts'
import type { HandoverRecord, PdaHandoverRecordDraftProjection } from '../../src/data/fcs/cutting/handover-orders.ts'
import type { ReleaseTicketDetail } from '../../src/data/fcs/cut-piece-release-domain.ts'
import { hydrateCutPieceTicketValidity, isCutPieceTicketUsable } from '../../src/data/fcs/cutting/cut-piece-ticket-validity.ts'
import { appendPdaCuttingInboundRuntimeEvent, createPdaCuttingInboundFormState } from '../../src/pages/pda-cutting-inbound.ts'
import { validateReplacementFabricEventBatch } from '../../src/data/fcs/cutting/replacement-fabric-event-validation.ts'

// 固定业务场景使用明确时区，避免 CI 的 UTC 与开发机本地时区改变事件先后。
// 历史无时区文本的专项场景单独使用同一本地时刻构造 ISO 对照。
const receiptFixtureReaders = new Map<string, () => ReleaseTicketDetail>()

test('逐票实收投影只核对一次完整交出集合，更正保留原量历史且不重复累计', () => {
  const storage = createMemoryStorage()
  const groups = ['A', 'B', 'C'].map(code => seedSpecialCraftBagHandover({ storage, suffix: `RECEIPT-SNAPSHOT-${code}` }))
  const receipts = groups.map((group, index) => submitSpecialCraftBagReturn({ ...specialCraftBagReturnInput(group, `RECEIPT-SNAPSHOT-${index}`), ticketReceipts: group.tickets.map(item => ({ feiTicketId: item.feiTicketId, returnedQty: 3, differenceReason: '少2片', processingCompleted: true })) }, storage))
  for (const [index, quantity] of [[0, 2], [1, 0]] as const) correctSpecialCraftTicketReturn({ sourceReturnEventId: receipts[index].eventId, ticketReceipts: groups[index].tickets.map(item => ({ feiTicketId: item.feiTicketId, returnedQty: quantity, differenceReason: '逐票复核' })), operator: { operatorName: '复核员' }, source: 'WEB', reason: '逐票复核', occurredAt: '2026-08-01T03:00:00Z' }, storage)
  const events = listCuttingRuntimeEvents(storage), original = structuredClone(events)
  const stringify = JSON.stringify
  let strictHandoverChecks = 0
  JSON.stringify = ((value: unknown, ...args: unknown[]) => {
    const candidate = value as { specialCraftId?: string; handedOverAt?: string; ticketSnapshot?: unknown[]; feiTicketItems?: unknown[] }
    if (candidate?.specialCraftId?.includes('RECEIPT-SNAPSHOT') && candidate.handedOverAt && candidate.ticketSnapshot && candidate.feiTicketItems) strictHandoverChecks++
    return Reflect.apply(stringify, JSON, [value, ...args])
  }) as typeof JSON.stringify
  try {
    const result = listSpecialCraftTicketReturnFacts(events, storage)
    for (const [index, quantity] of [[0, 2], [1, 0], [2, 3]] as const) {
      for (const item of groups[index].tickets) {
        const fact = result.find(row => row.feiTicketId === item.feiTicketId)!
        assert.equal(fact.returnedQty, quantity)
        assert.equal(fact.receiptVersion, index === 2 ? 1 : 2)
        assert.equal(fact.originalReturnedAt, receipts[index].occurredAt)
      }
    }
    assert.equal(result.length, groups.flatMap(group => group.tickets).length)
    assert.equal(strictHandoverChecks, groups.length, '同一完整投影每条交出只严格核对一次，不能按回仓/更正条数重扫全账')
    assert.deepEqual(events, original)
  } finally { JSON.stringify = stringify }
})

test('同次完整袋验证复用已核对事件，保留严格当前袋结果且不逐袋重新解析全账', () => {
  const storage = createMemoryStorage()
  seedSpecialCraftBagHandover({ storage, suffix: 'BATCH-VALIDATION-READ-A' })
  seedSpecialCraftBagHandover({ storage, suffix: 'BATCH-VALIDATION-READ-B' })
  const events = listCuttingRuntimeEvents(storage)
  const original = structuredClone(events)
  const state = { tickets: [], prints: [], receipts: [] }
  const originalParse = JSON.parse
  let ledgerConversions = 0
  JSON.parse = ((value: string, ...args: unknown[]) => {
    if (value.includes('"events"') && value.includes('BATCH-VALIDATION-READ')) ledgerConversions++
    return Reflect.apply(originalParse, JSON, [value, ...args])
  }) as typeof JSON.parse
  try {
    validateReplacementFabricEventBatch({ state, before: events, after: events, storage })
    assert.ok(ledgerConversions <= 1, `完整验证不能按每只袋重复解析同一账本，实际 ${ledgerConversions} 次`)
    assert.deepEqual(events, original)
    assert.deepEqual(state, { tickets: [], prints: [], receipts: [] })
  } finally { JSON.parse = originalParse }
})

test('同次批量袋读取与逐袋严格结果一致，最新实收更正重新计算且不改原事实', () => {
  const storage = createMemoryStorage()
  const a = seedSpecialCraftBagHandover({storage, suffix: 'BATCH-READ-A'})
  const b = seedSpecialCraftBagHandover({storage, suffix: 'BATCH-READ-B'})
  const original = structuredClone(listCuttingRuntimeEvents(storage))
  let latest = submitSpecialCraftBagReturn({...specialCraftBagReturnInput(a, 'BATCH-READ-A'), ticketReceipts: a.tickets.map(item=>({feiTicketId:item.feiTicketId,returnedQty:3,differenceReason:'逐票实收3片',processingCompleted:true}))}, storage)
  for (const qty of [3, 2, 0]) {
    if (qty!==3) latest = correctSpecialCraftTicketReturn({sourceReturnEventId:latest.eventId,ticketReceipts:a.tickets.map(item=>({feiTicketId:item.feiTicketId,returnedQty:qty,differenceReason:`复核${qty}片`})),operator:{operatorName:'复核员'},source:'WEB',reason:'逐票复核',occurredAt:'2026-08-01T03:00:00Z'},storage)
    const events = listCuttingRuntimeEvents(storage), snapshot = structuredClone(events)
    const batch = resolveTransferBagCurrentUsesFromEvents([b.bagCode,a.bagCode,b.bagCode],events)
    assert.equal(batch.size,2)
    for (const bag of [a,b]) assert.deepEqual(batch.get(bag.bagCode),resolveTransferBagCurrentUse(bag.bagCode,storage))
    assert.equal(batch.get(a.bagCode)!.tickets.reduce((sum,item)=>sum+item.pieceQty,0),qty*a.tickets.length)
    assert.deepEqual(events,snapshot)
  }
  for (const event of original) assert.deepEqual(listCuttingRuntimeEvents(storage).find(row=>row.eventId===event.eventId),event)
})

for (const mode of ['带袋', '无袋'] as const) test(`${mode}同一秒连续逐票更正有独立事实，同一更正重试只保存一次`, () => {
  const storage = createMemoryStorage(), suffix = `SAME-SECOND-${mode}`
  const item = ticket(`${suffix}-01`, `PO-${suffix}`, 'CRAFT-FACTORY-RETURN', 5)
  const seeded = seedSpecialCraftBagHandover({ storage, suffix, tickets: [item] })
  const receipt = mode === '带袋' ? submitSpecialCraftBagReturn(specialCraftBagReturnInput(seeded, suffix), storage) : submitSpecialCraftTicketOnlyReturn(ticketOnlyReturnInput(seeded, suffix, 5), storage)
  const original = structuredClone(listCuttingRuntimeEvents(storage))
  let latest = receipt
  const seen = new Set([receipt.eventId])
  for (const qty of [4, 3, 2, 1, 0]) {
    const input = { sourceReturnEventId: latest.eventId, ticketReceipts: [{ feiTicketId: item.feiTicketId, returnedQty: qty, differenceReason: `逐票复核实收${qty}片` }], operator: { operatorName: '复核员' }, source: 'WEB' as const, reason: `复核至${qty}片`, occurredAt: '2026-08-01T01:21:30.000Z' }
    const corrected = correctSpecialCraftTicketReturn(input, storage)
    assert.equal(seen.has(corrected.eventId), false)
    seen.add(corrected.eventId)
    const count = listCuttingRuntimeEvents(storage).length
    assert.equal(correctSpecialCraftTicketReturn(input, storage).eventId, corrected.eventId)
    assert.equal(listCuttingRuntimeEvents(storage).length, count)
    assert.equal(listSpecialCraftTicketReturnFacts(undefined, storage)[0].returnedQty, qty)
    assert.equal(corrected.inventoryEffect?.qty, -1)
    assert.equal((corrected.payload as { receiptVersion: number }).receiptVersion, 6 - qty)
    latest = corrected
  }
  for (const event of original) assert.deepEqual(listCuttingRuntimeEvents(storage).find(row => row.eventId === event.eventId), event)
})

test('保留历史换袋确认按真实来源入仓先后匹配，ISO与本地文本不丢来源库位', () => {
  for (const [inboundAt, confirmAt] of [[new Date('2026-08-01T10:00:30').toISOString(), '2026-08-01 10:10'], [new Date('2026-08-01T10:00:30').toISOString(), '2026-08-01 10:00']]) {
    const storage = createMemoryStorage(), item = ticket('LEGACY-CHANGE-01', 'PO-LEGACY-CHANGE', 'SEW-LEGACY-CHANGE', 5)
    const bagCode = 'BAG-LEGACY-SOURCE', usageCycleId = 'cycle-legacy-source'
    appendInbound({ storage, bagCode, usageCycleId, tickets: [item], occurredAt: inboundAt })
    appendCuttingRuntimeEvent({ eventType: '交出装袋确认', eventSource: 'WEB', eventStatus: '已同步', occurredAt: confirmAt, operatorName: '历史换袋员', refs: { transferBagCode: 'BAG-LEGACY-TARGET', usageCycleId: 'cycle-legacy-target', feiTicketIds: [item.feiTicketId] }, payload: { sourceTempBagCode: bagCode, sourceUsageCycleId: usageCycleId, targetTransferBagCode: 'BAG-LEGACY-TARGET' } } as Parameters<typeof appendCuttingRuntimeEvent>[0], storage)
    const before = structuredClone(listCuttingRuntimeEvents(storage))
    const states = buildWaitHandoverLocationOccupancyStates(before)
    assert.equal(states.length, 1)
    assert.equal(states[0].bagCode, 'BAG-LEGACY-TARGET')
    assert.equal(states[0].productionOrderNo, item.productionOrderNo)
    assert.equal(states[0].locationRef.locationId, `LOCATION-${bagCode}`)
    assert.equal(states[0].totalPieceQty, 5)
    assert.deepEqual(listCuttingRuntimeEvents(storage), before)
  }
})

test('特殊工艺实回库位从原票快照读取生产单，零实收票不冒充当前库存关联', () => {
  const storage = createMemoryStorage()
  const seeded = seedSpecialCraftBagHandover({ storage, suffix: 'LOCATION-ORDER', tickets: [ticket('LOCATION-ORDER-01', 'PO-LOCATION-A', 'CRAFT-FACTORY-RETURN', 5), ticket('LOCATION-ORDER-02', 'PO-LOCATION-B', 'CRAFT-FACTORY-RETURN', 5)] })
  const receipt = submitSpecialCraftBagReturn({ ...specialCraftBagReturnInput(seeded, 'LOCATION-ORDER'), ticketReceipts: seeded.tickets.map((item, index) => ({ feiTicketId: item.feiTicketId, returnedQty: index ? 0 : 3, differenceReason: index ? '第二票全部损耗' : '第一票损耗2片', processingCompleted: true })) }, storage)
  const original = structuredClone(listCuttingRuntimeEvents(storage))
  assert.equal(receipt.refs.productionOrderNo || '', '', '真实严格回仓生产器的 refs 未冗余生产单')
  const current = buildWaitHandoverLocationOccupancyStates(original).find(state => state.bagCode === seeded.bagCode)!
  assert.equal(current.productionOrderNo, 'PO-LOCATION-A')
  assert.equal(current.totalPieceQty, 3)
  const corrected = correctSpecialCraftTicketReturn({ sourceReturnEventId: receipt.eventId, ticketReceipts: seeded.tickets.map(item => ({ feiTicketId: item.feiTicketId, returnedQty: 3, differenceReason: '逐票复核损耗2片' })), operator: { operatorName: '复核员' }, source: 'WEB', reason: '逐票复核', occurredAt: '2026-08-01T09:30:00+08:00' }, storage)
  const revised = buildWaitHandoverLocationOccupancyStates(listCuttingRuntimeEvents(storage)).find(state => state.bagCode === seeded.bagCode)!
  assert.equal(revised.productionOrderNo, 'PO-LOCATION-A / PO-LOCATION-B', '多生产单保留全部真实关联，不能借用第一票')
  assert.equal(revised.totalPieceQty, 6)
  assert.equal(corrected.inventoryEffect?.qty, 3)
  for (const event of original) assert.deepEqual(listCuttingRuntimeEvents(storage).find(row => row.eventId === event.eventId), event)
})

test('PDA实际入仓入口保留默认时间秒与时区，同一分钟交出后可逐票回仓', () => {
  const storage = createMemoryStorage()
  const seeded = seedSpecialCraftBagHandover({ storage, suffix: 'PDA-ISO-DEFAULT', occurredAt: '2026-08-01T02:00:20.000Z' })
  const state = { ...createPdaCuttingInboundFormState(), carrierCode: seeded.bagCode, specialCraftReceipts: Object.fromEntries(seeded.tickets.map(item => [item.feiTicketId, { returnedQty: item.pieceQty, differenceReason: '', confirmed: true, processingCompleted: true }])) }
  const NativeDate = Date
  class ReceiptDate extends NativeDate { constructor(...args: any[]) { super(...(args.length ? args : ['2026-08-01T02:00:30.000Z']) as [string]) } static now() { return new NativeDate('2026-08-01T02:00:30.000Z').getTime() } }
  globalThis.Date = ReceiptDate as DateConstructor
  try { appendPdaCuttingInboundRuntimeEvent(state, 'inbound-location', [], storage, [specialCraftReturnLocation('PDA-ISO-DEFAULT')]) } finally { globalThis.Date = NativeDate }
  const receipt = listCuttingRuntimeEvents(storage).find(event => event.eventType === '特殊工艺回仓')!
  assert.equal(receipt.occurredAt, '2026-08-01T02:00:30.000Z')
  assert.equal(listSpecialCraftTicketReturnFacts(undefined, storage).length, 2)
})

test('PDA实回页按第二张菲票自身当前阶段和实际交出数量显示应回数量', () => {
  const storage = createMemoryStorage()
  const a = ticket('PDA-STAGE-A', 'PO-PDA-STAGE', 'CRAFT-FACTORY-RETURN', 12)
  const b = ticket('PDA-STAGE-B', 'PO-PDA-STAGE', 'CRAFT-FACTORY-RETURN', 8)
  const stageIds = { [a.feiTicketId]: 'PDA-STAGE-A-OWN', [b.feiTicketId]: 'PDA-STAGE-B-OWN' }
  const seeded = seedSpecialCraftBagHandover({ storage, suffix: 'PDA-STAGE', tickets: [a, b], stageIds })
  const source = { handoverRecordId: seeded.sourceHandoverRecordId, receiverName: '特殊工艺回仓测试厂', feiTicketItems: [a, { ...b, pieceQty: 99 }], transferBagUses: [], specialCraftItems: [a, b].map(item => ({ feiTicketId: item.feiTicketId, specialCraftId: stageIds[item.feiTicketId], pieceQty: 99, receiverFactoryName: '特殊工艺回仓测试厂' })) } as unknown as HandoverRecord
  const form = { specialCraftReturnFeiTicketScan: b.feiTicketNo, specialCraftReturnLocationIds: [], feedbackMessage: '', specialCraftReturnQty: '', specialCraftReturnReason: '' } as Parameters<typeof renderPdaSpecialCraftReturnFlow>[3]
  const html = renderPdaSpecialCraftReturnFlow({ handoverOrderNo: seeded.sourceHandoverOrderId } as PdaHandoverRecordDraftProjection, source, 'PDA-TASK', form, listCuttingRuntimeEvents(storage))
  assert.match(html, /应回数量[\s\S]*?8 片/)
  assert.doesNotMatch(html, /99 片|placeholder="99"/)
  assert.match(html, /placeholder="8"/)
})

test('无袋实收10更正9扣库存差额，重新装袋或实际交出后不反冲其他库存', () => {
  const storage = createMemoryStorage(), item = ticket('TICKET-ONLY-CORRECT-01', 'PO-TICKET-ONLY-CORRECT', 'CRAFT-FACTORY-RETURN', 10)
  const seeded = seedSpecialCraftBagHandover({ storage, suffix: 'TICKET-ONLY-CORRECT', tickets: [item] }), locationRef = specialCraftReturnLocation('TICKET-ONLY-CORRECT')
  const receipt = submitSpecialCraftTicketOnlyReturn({ specialCraftId: seeded.specialCraftId, source: 'PDA', operator: { operatorName: '逐票回仓员' }, occurredAt: '2026-08-01T09:20:00+08:00', payload: {
    returnRecordId: 'ONLY-RETURN', returnRecordNo: '无袋实收单01', sourceHandoverOrderId: seeded.sourceHandoverOrderId, sourceHandoverOrderNo: '特殊工艺交出单01', sourceHandoverRecordId: seeded.sourceHandoverRecordId, sourceHandoverRecordNo: '特殊工艺交接记录01', receiverFactoryId: 'CRAFT-FACTORY-RETURN', receiverFactoryName: '特殊工艺回仓测试厂', warehouseName: '裁床待交出仓', craftType: '绣花', warehouseArea: locationRef.areaName, locationCode: locationRef.locationNo, locationRef, returnedAt: '2026-08-01T09:20:00+08:00', returnedBy: '逐票回仓员', returnedFeiTicketItems: [{ feiTicketId: item.feiTicketId, feiTicketNo: item.feiTicketNo, specialCraftId: seeded.specialCraftId, craftType: '绣花', partName: item.partName, size: item.size, expectedQty: 10, returnedQty: 10, processingCompleted: true, unit: '片', returnStatus: '已回仓' }],
  } }, storage)
  const original = structuredClone(listCuttingRuntimeEvents(storage).find(event => event.eventId === receipt.eventId))
  const correctionInput = { sourceReturnEventId: receipt.eventId, ticketReceipts: [{ feiTicketId: item.feiTicketId, returnedQty: 9, differenceReason: '复核少1片' }], operator: { operatorName: '复核员' }, source: 'WEB' as const, reason: '复核实收', occurredAt: '2026-08-01T10:00:00+08:00' }
  const corrected = correctSpecialCraftTicketReturn(correctionInput, storage)
  assert.equal(corrected.inventoryEffect?.qty, -1)
  assert.equal((corrected.payload as { inventoryAdjusted: boolean }).inventoryAdjusted, true)
  assert.equal(listSpecialCraftTicketReturnFacts(undefined, storage)[0].returnedQty, 9)
  assert.equal(listSpecialCraftTicketReturnFacts(undefined, storage)[0].processingCompleted, true)
  assert.equal(buildCutPieceReleaseCurrentTicketLocations(listCuttingRuntimeEvents(storage), listSpecialCraftTicketReturnFacts(undefined, storage), storage).get(item.feiTicketId), '裁床待交出仓 / 待交出回仓区 / R / R-TICKET-ONLY-CORRECT')
  assert.deepEqual({ returnRecordNo: listSpecialCraftTicketReturnFacts(undefined, storage)[0].returnRecordNo, orderNo: listSpecialCraftTicketReturnFacts(undefined, storage)[0].sourceHandoverOrderNo, recordNo: listSpecialCraftTicketReturnFacts(undefined, storage)[0].sourceHandoverRecordNo, location: listSpecialCraftTicketReturnFacts(undefined, storage)[0].locationRef }, { returnRecordNo: '无袋实收单01 · 更正 V2', orderNo: '特殊工艺交出单01', recordNo: '特殊工艺交接记录01', location: locationRef })
  assert.deepEqual(listCuttingRuntimeEvents(storage).find(event => event.eventId === receipt.eventId), original)
  const size = listCuttingRuntimeEvents(storage).length
  assert.equal(correctSpecialCraftTicketReturn(correctionInput, storage).eventId, corrected.eventId)
  assert.equal(listCuttingRuntimeEvents(storage).length, size)
  const newBag = 'BAG-AFTER-TICKET-ONLY', newCycle = 'BAG-AFTER-TICKET-ONLY:1', currentTicket = { ...item, pieceQty: 9 }
  appendBagging({ storage, bagCode: newBag, usageCycleId: newCycle, tickets: [currentTicket], occurredAt: '2026-08-01T11:00:00+08:00' })
  appendInbound({ storage, bagCode: newBag, usageCycleId: newCycle, tickets: [currentTicket], occurredAt: '2026-08-01T11:10:00+08:00' })
  const inBag = correctSpecialCraftTicketReturn({ ...correctionInput, sourceReturnEventId: corrected.eventId, ticketReceipts: [{ feiTicketId: item.feiTicketId, returnedQty: 8, differenceReason: '再次复核' }], occurredAt: '2026-08-01T11:20:00+08:00' }, storage)
  assert.equal(inBag.inventoryEffect?.qty, 0, '原无袋记录更正不能改当前新袋库存')
  assert.equal(resolveTransferBagCurrentUse(newBag, storage).tickets[0].pieceQty, 9)
  assert.match(buildCutPieceReleaseCurrentTicketLocations(listCuttingRuntimeEvents(storage), listSpecialCraftTicketReturnFacts(undefined, storage), storage).get(item.feiTicketId)!, /待交出 A 区.*A-BAG-AFTER-TICKET-ONLY/)
  const handoverInput = { bagCode: newBag, usageCycleId: newCycle, handoverOrderId: 'HO-ONLY-SEW', handoverOrderNo: '车缝交出单01', handoverRecordId: 'HR-ONLY-SEW', handoverRecordNo: '车缝交接记录01', assignments: [{ feiTicketId: item.feiTicketId, feiTicketNo: item.feiTicketNo, sewingTaskId: item.sewingTaskId, sewingTaskNo: item.sewingTaskNo, receiverFactoryId: item.receiverFactoryId, receiverFactoryName: item.receiverFactoryName }], submittedTicketSnapshot: [currentTicket], operator: { operatorName: '交出员' }, source: 'WEB' as const, occurredAt: '2026-08-01T12:00:00+08:00' }
  assert.equal(resolveWholeBagHandoverEligibility({ ...handoverInput, currentUse: resolveTransferBagCurrentUse(newBag, storage), storage } as Parameters<typeof resolveWholeBagHandoverEligibility>[0]).ok, false, '候选须阻断袋9与当前有效实收8的冲突')
  assert.throws(() => submitWholeBagHandover(handoverInput, storage), /数量|核对/, '共享submit不得绕过候选数量门禁')
  assert.equal(resolveTransferBagCurrentUse(newBag, storage).tickets[0].pieceQty, 9, '拒绝后原装袋事实仍9，必须现场核对')
  assert.deepEqual(listCuttingRuntimeEvents(storage).find(event => event.eventId === receipt.eventId), original)
})

test('明确单道无袋实收9合法实交后更正7保留旧9责任与真实接收厂', () => {
  const storage = createMemoryStorage(), originalTicket = ticket('NO-BAG-AFTER-OUT-01', 'PO-NO-BAG-AFTER-OUT', 'CRAFT-FACTORY-RETURN', 10)
  const seeded = seedSpecialCraftBagHandover({ storage, suffix: 'NO-BAG-AFTER-OUT', tickets: [originalTicket] })
  const receipt = submitSpecialCraftTicketOnlyReturn(ticketOnlyReturnInput(seeded, 'NO-BAG-AFTER-OUT', 9), storage)
  const currentTicket = { ...originalTicket, pieceQty: 9 }, bagCode = 'BAG-NO-BAG-AFTER-OUT', usageCycleId = 'BAG-NO-BAG-AFTER-OUT:1'
  appendBagging({ storage, bagCode, usageCycleId, tickets: [currentTicket], occurredAt: '2026-08-01T10:00:00+08:00' })
  appendInbound({ storage, bagCode, usageCycleId, tickets: [currentTicket], occurredAt: '2026-08-01T10:10:00+08:00' })
  const input = { bagCode, usageCycleId, handoverOrderId: 'NO-BAG-SEW-ORDER', handoverOrderNo: '无袋转袋车缝交出单', handoverRecordId: 'NO-BAG-SEW-RECORD', handoverRecordNo: '无袋转袋交接记录', assignments: [{ feiTicketId: currentTicket.feiTicketId, feiTicketNo: currentTicket.feiTicketNo, sewingTaskId: currentTicket.sewingTaskId, sewingTaskNo: currentTicket.sewingTaskNo, receiverFactoryId: currentTicket.receiverFactoryId, receiverFactoryName: currentTicket.receiverFactoryName }], submittedTicketSnapshot: [currentTicket], operator: { operatorName: '实际交出员' }, source: 'WEB' as const, occurredAt: '2026-08-01T11:00:00+08:00' }
  assert.equal(resolveWholeBagHandoverEligibility({ ...input, currentUse: resolveTransferBagCurrentUse(bagCode, storage), storage }).ok, true)
  const delivered = submitWholeBagHandover(input, storage), prior = structuredClone(listCuttingRuntimeEvents(storage).find(event => event.eventId === delivered.eventId))
  const corrected = correctSpecialCraftTicketReturn({ sourceReturnEventId: receipt.eventId, ticketReceipts: [{ feiTicketId: currentTicket.feiTicketId, returnedQty: 7, differenceReason: '复核少2片' }], operator: { operatorName: '复核员' }, source: 'WEB', reason: '复核原实收', occurredAt: '2026-08-01T12:00:00+08:00' }, storage)
  assert.equal(corrected.inventoryEffect?.qty, 0)
  assert.equal(listSpecialCraftTicketReturnFacts(undefined, storage)[0].returnedQty, 7)
  assert.equal(delivered.inventoryEffect?.qty, 9)
  assert.deepEqual(listCuttingRuntimeEvents(storage).find(event => event.eventId === delivered.eventId), prior)
  assert.equal(buildCutPieceReleaseCurrentTicketLocations(listCuttingRuntimeEvents(storage), listSpecialCraftTicketReturnFacts(undefined, storage), storage).get(currentTicket.feiTicketId), `已交出 · ${currentTicket.receiverFactoryName}`)
})

test('整袋候选与提交共享未知来源、未知必要工艺及整票不可用阻断，caller不能给空事件绕过', () => {
  for (const hasSpecialCraft of [false, true]) {
    const storage = createMemoryStorage(), item = { ...ticket(`UNKNOWN-BAG-${hasSpecialCraft}`, 'PO-UNKNOWN', 'SEW-UNKNOWN', 5), hasSpecialCraft }, bagCode = `BAG-UNKNOWN-${hasSpecialCraft}`, usageCycleId = `${bagCode}:1`
    appendBagging({ storage, bagCode, usageCycleId, tickets: [item] })
    appendInbound({ storage, bagCode, usageCycleId, tickets: [item] })
    const input = { bagCode, usageCycleId, handoverOrderId: 'UNKNOWN-HO', handoverOrderNo: '未知来源单', handoverRecordId: `UNKNOWN-HR-${hasSpecialCraft}`, handoverRecordNo: '未知交接记录', assignments: [{ feiTicketId: item.feiTicketId, feiTicketNo: item.feiTicketNo, sewingTaskId: item.sewingTaskId, sewingTaskNo: item.sewingTaskNo, receiverFactoryId: item.receiverFactoryId, receiverFactoryName: item.receiverFactoryName }], submittedTicketSnapshot: [item], operator: { operatorName: '仓管' }, source: 'WEB' as const, occurredAt: '2026-08-01T11:00:00+08:00' }
    const before = listCuttingRuntimeEvents(storage).length
    assert.equal(resolveWholeBagHandoverEligibility({ ...input, currentUse: resolveTransferBagCurrentUse(bagCode, storage), existingHandoverEvents: [], storage }).ok, false)
    assert.throws(() => submitWholeBagHandover(input, storage), /来源未找到|资料待核对/)
    assert.equal(listCuttingRuntimeEvents(storage).length, before)
  }
  const storage = createMemoryStorage(), seeded = seedSpecialCraftBagHandover({ storage, suffix: 'BAG-INVALID', tickets: [ticket('BAG-INVALID-01', 'PO-BAG-INVALID', 'CRAFT-FACTORY-RETURN', 5)] })
  submitSpecialCraftBagReturn(specialCraftBagReturnInput(seeded, 'BAG-INVALID'), storage)
  const item = seeded.tickets[0], input = { bagCode: seeded.bagCode, usageCycleId: seeded.usageCycleId, handoverOrderId: 'INVALID-HO', handoverOrderNo: '整票核对单', handoverRecordId: 'INVALID-HR', handoverRecordNo: '整票核对记录', assignments: [{ feiTicketId: item.feiTicketId, feiTicketNo: item.feiTicketNo, sewingTaskId: item.sewingTaskId, sewingTaskNo: item.sewingTaskNo, receiverFactoryId: item.receiverFactoryId, receiverFactoryName: item.receiverFactoryName }], submittedTicketSnapshot: [item], operator: { operatorName: '仓管' }, source: 'WEB' as const, occurredAt: '2026-08-01T11:00:00+08:00' }
  hydrateCutPieceTicketValidity({ revision: 0, records: [{ id: 'INVALID-TICKET-FACT', collection: 'cut-piece-ticket-validity', value: { id: 'INVALID-TICKET-FACT', ticketId: item.feiTicketId, valid: false, reason: '整票裁错', operator: '质检员', at: '2026-08-01T10:00:00+08:00', version: 1 } }] })
  try {
    assert.equal(resolveWholeBagHandoverEligibility({ ...input, currentUse: resolveTransferBagCurrentUse(seeded.bagCode, storage), storage }).ok, false)
    assert.throws(() => submitWholeBagHandover(input, storage), /整票不可用/)
  } finally { hydrateCutPieceTicketValidity({ revision: 0, records: [] }) }
})

test('连续工艺具名示例仅提供真实技术包两条未分配任务，不写事实或覆盖旧任务', () => {
  const order=productionOrders.find(item=>item.productionOrderId==='PO-202603-0002')!
  const parts=readCutPieceParts(order.productionOrderId),before=JSON.stringify({order,parts,tasks:processTasks})
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage')
  let writes=0
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>null,setItem:()=>{writes++},removeItem:()=>{writes++}}})
  try {
    const tasks=buildSpecialCraftReleaseDemoTasks(order,parts)
    assert.equal(tasks.length,2)
    assert.deepEqual(tasks.map(item=>item.craftCode),['CRAFT_000032','CRAFT_3000002'])
    assert.deepEqual(tasks.map(item=>item.craftName),['打条','压褶'])
    assert.deepEqual(tasks[1].dependsOnTaskIds,[tasks[0].taskId])
    tasks.forEach(item=>{
      assert.equal(item.productionOrderId,order.productionOrderId)
      assert.equal(item.selectedTargetObject,'已裁部位')
      assert.equal(item.assignmentStatus,'UNASSIGNED')
      assert.equal(item.status,'NOT_STARTED')
      assert.equal(item.assignedFactoryId,undefined)
      assert.equal(item.assignedFactoryName,undefined)
      assert.equal(item.finishedAt,undefined)
      assert.equal(item.qty,2500)
      assert.deepEqual(item.detailRows!.map(row=>row.sourceRefs.garmentSku),order.demandSnapshot.skuLines.map(line=>line.skuCode))
      assert.ok(item.detailRows!.every(row=>row.sourceRefs.pieceIds?.join()==='tdv_demand_SPU_2024_005-pattern-main-back'))
      assert.ok(item.taskTypeLabel?.includes('示例'))
    })
    assert.deepEqual(buildSpecialCraftReleaseDemoTasks(order,[]),[])
    assert.deepEqual(buildSpecialCraftReleaseDemoTasks({...order,productionOrderId:'OTHER-PO'},parts),[])
    assert.deepEqual(buildSpecialCraftReleaseDemoTasks(order,parts.map(part=>({...part,specialCrafts:part.specialCrafts?.slice().reverse()}))),[])
    assert.equal(JSON.stringify({order,parts,tasks:processTasks}),before,'旧拆解、分配和技术包完全不变')
    assert.equal(writes,0,'纯示例读取不保存派单/完成/回仓或种子')
  } finally { if(descriptor) Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage') }
})

test('不同菲票的同一实际有序工艺链可同袋，链身份不使用每票阶段ID', () => {
  const chain = [{ specialCraftId: 'PER-TICKET-1-STAGE-A', craftType: '绣花', craftName: '绣花', craftCategory: '辅助工艺', receiverFactoryId: 'FACTORY-A' }, { specialCraftId: 'PER-TICKET-1-STAGE-B', craftType: '模板工序', craftName: '模板工序', craftCategory: '特种工艺', receiverFactoryId: 'FACTORY-B' }]
  const first = { ...ticket('SAME-CHAIN-1', 'PO-SAME', 'FACTORY-A'), hasSpecialCraft: true, specialCrafts: chain, craftSequenceVersion: 'V9:2' } as unknown as GeneratedFeiTicketSourceRecord
  const second = { ...first, feiTicketId: 'SAME-CHAIN-2', feiTicketNo: 'FT-SAME-CHAIN-2', specialCrafts: chain.map((craft,index) => ({ ...craft, specialCraftId: `PER-TICKET-2-STAGE-${index}` })) }
  const a = buildWaitHandoverRuntimeTicketFromGeneratedTicket(first), b = buildWaitHandoverRuntimeTicketFromGeneratedTicket(second)
  assert.doesNotThrow(() => assertSpecialCraftBagCompatibility([a,b]))
  assert.equal(a.specialCraftChainKey,b.specialCraftChainKey)
  for (const crafts of [[...second.specialCrafts].reverse(), second.specialCrafts.map((craft,index) => index ? { ...craft, receiverFactoryId: 'OTHER' } : craft)]) {
    assert.throws(() => assertSpecialCraftBagCompatibility([a,buildWaitHandoverRuntimeTicketFromGeneratedTicket({ ...second, specialCrafts: crafts })]), /不同加工/)
  }
})

test('同链两张菲票保留各自阶段身份并分别实收，不把第二票当第一票工艺', () => {
  const storage = createMemoryStorage()
  const a = ticket('MULTI-ID-A', 'PO-MULTI-ID', 'CRAFT-FACTORY-RETURN', 12)
  const b = ticket('MULTI-ID-B', 'PO-MULTI-ID', 'CRAFT-FACTORY-RETURN', 8)
  const stageIds = { [a.feiTicketId]: 'STAGE-A-OWN', [b.feiTicketId]: 'STAGE-B-OWN' }
  const sources = [a,b].map(item => ({ ...item, actualCutPieceQty:item.pieceQty,qty:item.pieceQty,skuSize:item.size,garmentColor:item.color,printStatus:'PRINTED',sourceBasisType:'ACTUAL_CUTTING_OUTPUT',hasSpecialCraft: true, specialCrafts: [{ specialCraftId: stageIds[item.feiTicketId], craftName: '绣花', craftCategory: '特种工艺', receiverFactoryId: 'OLD-PRINTED-DEFAULT',receiverFactoryName:'原票默认厂' }] })) as unknown as GeneratedFeiTicketSourceRecord[]
  const bindings = [a,b].map(item => ({ feiTicketId: item.feiTicketId, specialCraftId: stageIds[item.feiTicketId], assignedFactoryConfirmed: true, taskOrderId: 'TASK-MULTI', taskOrderNo: '同链真实任务', targetFactoryId: 'CRAFT-FACTORY-RETURN', targetFactoryName: '特殊工艺回仓测试厂', specialCraftFlowStatus: '待发料', closingQty: 0 })) as CuttingSpecialCraftFeiTicketBinding[]
  const candidate = resolveSpecialCraftBagHandoverCandidate({ current: { bagCode:'MULTI', usageCycleId:'MULTI:1', tickets:[a,b], flowStage:'INBOUND_STORED' } as TransferBagCurrentUse, sources, bindings, receipts:[] })
  assert.deepEqual(candidate.ticketStageIds,stageIds)
  const seeded = seedSpecialCraftBagHandover({ storage, suffix:'MULTI-ID', tickets:[a,b], stageIds })
  const beforeReturnEvents=listCuttingRuntimeEvents(storage)
  const inProcess=projectReleaseTicket({ticket:sources[1],materialId:'MAT-MULTI',materialName:'主料',bag:buildReleaseBagEvidence(beforeReturnEvents).get(b.feiTicketId),receipts:[],bindings,events:beforeReturnEvents,craftRequirementKnown:true})
  assert.equal(inProcess.craftSteps[0].craftId,stageIds[b.feiTicketId],'第二票不能沿用袋头首票阶段ID')
  assert.equal(inProcess.craftSteps[0].factoryName,'特殊工艺回仓测试厂','实际交出厂优先于原票默认厂')
  assert.equal(inProcess.craftSteps[0].status,'加工中')
  assert.equal(inProcess.craftSteps[0].handedOverQty,8)
  assert.equal(inProcess.eligiblePieceQty,0,'交出不代表加工完成或最终实收')
  submitSpecialCraftBagReturn({ ...specialCraftBagReturnInput(seeded,'MULTI-ID'), ticketReceipts:[{ feiTicketId:a.feiTicketId, returnedQty:11, differenceReason:'损耗1片', processingCompleted:true },{ feiTicketId:b.feiTicketId, returnedQty:6, differenceReason:'损耗2片', processingCompleted:true }] },storage)
  const facts = listSpecialCraftTicketReturnFacts(undefined,storage)
  assert.deepEqual(facts.map(fact=>[fact.feiTicketId,fact.specialCraftId,fact.returnedQty]),[[a.feiTicketId,stageIds[a.feiTicketId],11],[b.feiTicketId,stageIds[b.feiTicketId],6]])
  const returnedEvents=listCuttingRuntimeEvents(storage)
  const returned=projectReleaseTicket({ticket:sources[1],materialId:'MAT-MULTI',materialName:'主料',bag:buildReleaseBagEvidence(returnedEvents).get(b.feiTicketId),receipts:facts,bindings,events:returnedEvents,craftRequirementKnown:true})
  assert.equal(returned.craftSteps[0].status,'已实际回仓')
  assert.equal(returned.craftSteps[0].factoryName,'特殊工艺回仓测试厂')
  assert.equal(returned.physicalPieceQty,6)
  assert.equal(returned.eligiblePieceQty,6,'第二票按自身最终有效实收计入齐套')
  assert.equal(sources[1].specialCrafts[0].receiverFactoryId,'OLD-PRINTED-DEFAULT','原打印票默认字段不改')
})

test('连续工艺直接由实际持有厂转交下道，前道完成与最后回仓分开记账', () => {
  const storage = createMemoryStorage()
  const seeded = seedSpecialCraftBagHandover({ storage, suffix: 'DIRECT-CHAIN', tickets: [ticket('DIRECT-CHAIN-01', 'PO-DIRECT-CHAIN', 'CRAFT-FACTORY-RETURN', 100)] })
  const directInput = { source: 'WEB' as const, operator: { operatorId: 'OP-A', operatorName: '前道工厂交出员' }, transferBagCode: seeded.bagCode, usageCycleId: seeded.usageCycleId, handoverOrderId: 'REAL-NEXT-TASK', handoverRecordId: 'REAL-DIRECT-RECORD', specialCraftId: 'REAL-NEXT-STAGE', fromWarehouseArea: '前道工厂', occurredAt: '2026-08-01T10:00:00+08:00',
    payload: { handoverOrderId: 'REAL-NEXT-TASK', handoverRecordId: 'REAL-DIRECT-RECORD', craftCategory: '特种工艺' as const, craftType: '烫画', receiverFactoryId: 'REAL-NEXT-FACTORY', receiverFactoryName: '下道烫画厂', handedOverAt: '2026-08-01T10:00:00+08:00', handedOverBy: '前道工厂交出员', feiTicketItems: [{ ...seeded.handover.payload.feiTicketItems[0], specialCraftId: 'REAL-NEXT-STAGE', pieceQty: 95 }],
      directTransfer: { sourceHandoverEventId: seeded.handover.eventId, sourceHandoverRecordId: seeded.sourceHandoverRecordId, sourceFactoryId: 'CRAFT-FACTORY-RETURN', sourceFactoryName: '特殊工艺回仓测试厂', completedTicketItems: [{ feiTicketId: 'DIRECT-CHAIN-01', specialCraftId: seeded.specialCraftId, completedQty: 95, differenceReason: '前道损耗5片', processingCompleted: true }] } }, storage }
  const projection = { sources: [{ ...seeded.tickets[0], hasSpecialCraft: true, specialCrafts: [{ specialCraftId: seeded.specialCraftId, receiverFactoryId: 'OLD-DEFAULT-A' }, { specialCraftId: 'REAL-NEXT-STAGE', receiverFactoryId: 'OLD-DEFAULT-B' }] } as unknown as GeneratedFeiTicketSourceRecord], bindings: [{ feiTicketId: 'DIRECT-CHAIN-01', specialCraftId: 'REAL-NEXT-STAGE', taskOrderId: 'REAL-NEXT-TASK', assignedFactoryConfirmed: true, targetFactoryId: 'REAL-NEXT-FACTORY' } as CuttingSpecialCraftFeiTicketBinding] }
  const before = listCuttingRuntimeEvents(storage).length
  assert.throws(() => appendWaitHandoverSpecialCraftHandoverEvent({ ...directInput, payload: { ...directInput.payload, directTransfer: { ...directInput.payload.directTransfer, completedTicketItems: [{ ...directInput.payload.directTransfer.completedTicketItems[0], processingCompleted: false }] } } } as never, projection), /加工完成/)
  assert.throws(() => appendWaitHandoverSpecialCraftHandoverEvent({ ...directInput, payload: { ...directInput.payload, directTransfer: { ...directInput.payload.directTransfer, sourceFactoryId: 'WRONG-HOLDER' } } } as never, projection), /持有工厂/)
  assert.throws(() => appendWaitHandoverSpecialCraftHandoverEvent({ ...directInput, payload: { ...directInput.payload, directTransfer: { ...directInput.payload.directTransfer, completedTicketItems: [{ ...directInput.payload.directTransfer.completedTicketItems[0], completedQty: 101 }] } } } as never, projection), /数量/)
  assert.throws(() => appendWaitHandoverSpecialCraftHandoverEvent(directInput as never, { ...projection, sources: [] }), /工艺要求待补齐/)
  assert.throws(() => appendWaitHandoverSpecialCraftHandoverEvent(directInput as never, { ...projection, bindings: [] }), /任务或承接厂待补齐/)
  assert.throws(() => appendWaitHandoverSpecialCraftHandoverEvent({ ...directInput, specialCraftId: 'SKIPPED-STAGE' } as never, projection), /下一道必要工艺/)
  assert.throws(() => appendWaitHandoverSpecialCraftHandoverEvent({ ...directInput, payload: { ...directInput.payload, directTransfer: { ...directInput.payload.directTransfer, completedTicketItems: [{ ...directInput.payload.directTransfer.completedTicketItems[0], differenceReason: '' }] } } } as never, projection), /差异/)
  assert.equal(listCuttingRuntimeEvents(storage).length, before)
  const direct = appendWaitHandoverSpecialCraftHandoverEvent(directInput as never, projection)
  assert.equal(direct.inventoryEffect?.direction, 'ADJUST')
  assert.equal(direct.inventoryEffect?.qty, 0)
  assert.equal(resolveTransferBagCurrentUse(seeded.bagCode, storage).latestHandoverEventId, direct.eventId)
  const completed = listSpecialCraftProcessingCompletionFacts(undefined, storage)
  assert.equal(completed.length, 1)
  assert.equal(completed[0].returnedQty, 95)
  assert.equal(completed[0].processingCompleted, true)
  assert.equal(completed[0].receiverFactoryId, 'CRAFT-FACTORY-RETURN')
  assert.equal(listSpecialCraftTicketReturnFacts(undefined, storage).length, 0, '厂间转交没有裁床实收')
  const finalReceipt = submitSpecialCraftBagReturn({ ...specialCraftBagReturnInput(seeded, 'DIRECT-CHAIN'), sourceHandoverRecordId: 'REAL-DIRECT-RECORD', returnedTicketIds: ['DIRECT-CHAIN-01'], ticketReceipts: [{ feiTicketId: 'DIRECT-CHAIN-01', returnedQty: 90, differenceReason: '下道损耗5片', processingCompleted: true }], occurredAt: '2026-08-01T11:00:00+08:00' }, storage)
  const facts = listSpecialCraftTicketReturnFacts(undefined, storage)
  assert.equal(facts.length, 1)
  assert.equal(facts[0].expectedQty, 95)
  assert.equal(facts[0].returnedQty, 90)
  assert.equal(facts[0].specialCraftId, 'REAL-NEXT-STAGE')
  assert.equal(finalReceipt.inventoryEffect?.qty, 90)
  assert.equal(appendWaitHandoverSpecialCraftHandoverEvent(directInput as never, projection).eventId, direct.eventId, '原转交重试不重复扣库存或造事实')
})

test('同袋两票连续转交按每票前道和下道身份核对，最后分别回仓', () => {
  const storage = createMemoryStorage()
  const tickets = [ticket('MULTI-DIRECT-A','PO-MD','CRAFT-FACTORY-RETURN',12),ticket('MULTI-DIRECT-B','PO-MD','CRAFT-FACTORY-RETURN',8)]
  const stageIds = Object.fromEntries(tickets.map(item=>[item.feiTicketId,`${item.feiTicketId}:STAGE1`]))
  const seeded = seedSpecialCraftBagHandover({ storage,suffix:'MULTI-DIRECT',tickets,stageIds })
  const projection = { sources:tickets.map(item=>({ ...item,hasSpecialCraft:true,specialCrafts:[{specialCraftId:stageIds[item.feiTicketId],receiverFactoryId:'CRAFT-FACTORY-RETURN'},{specialCraftId:`${item.feiTicketId}:STAGE2`,receiverFactoryId:'NEXT-FACTORY'}]})) as unknown as GeneratedFeiTicketSourceRecord[], bindings:tickets.map(item=>({feiTicketId:item.feiTicketId,specialCraftId:`${item.feiTicketId}:STAGE2`,taskOrderId:'MD-NEXT-TASK',targetFactoryId:'NEXT-FACTORY',assignedFactoryConfirmed:true})) as CuttingSpecialCraftFeiTicketBinding[] }
  const input = { source:'WEB',operator:{operatorName:'厂间交出员'},transferBagCode:seeded.bagCode,usageCycleId:seeded.usageCycleId,handoverOrderId:'MD-NEXT-TASK',handoverRecordId:'MD-NEXT-RECORD',specialCraftId:`${tickets[0].feiTicketId}:STAGE2`,occurredAt:'2026-08-01T10:00:00+08:00',fromWarehouseArea:'前道厂',storage,
    payload:{handoverOrderId:'MD-NEXT-TASK',handoverRecordId:'MD-NEXT-RECORD',craftCategory:'特种工艺',craftType:'烫画',receiverFactoryId:'NEXT-FACTORY',receiverFactoryName:'下一工艺厂',handedOverAt:'2026-08-01T10:00:00+08:00',handedOverBy:'厂间交出员',feiTicketItems:tickets.map((item,index)=>({feiTicketId:item.feiTicketId,feiTicketNo:item.feiTicketNo,specialCraftId:`${item.feiTicketId}:STAGE2`,partName:item.partName,size:item.size,pieceQty:index?7:11})),directTransfer:{sourceHandoverEventId:seeded.handover.eventId,sourceHandoverRecordId:seeded.sourceHandoverRecordId,sourceFactoryId:'CRAFT-FACTORY-RETURN',sourceFactoryName:'特殊工艺回仓测试厂',completedTicketItems:tickets.map((item,index)=>({feiTicketId:item.feiTicketId,specialCraftId:stageIds[item.feiTicketId],completedQty:index?7:11,differenceReason:'损耗1片',processingCompleted:true}))}} }
  assert.throws(()=>appendWaitHandoverSpecialCraftHandoverEvent({...input,payload:{...input.payload,directTransfer:{...input.payload.directTransfer,completedTicketItems:input.payload.directTransfer.completedTicketItems.map(item=>({...item,specialCraftId:stageIds[tickets[0].feiTicketId]}))}}} as never,projection),/加工完成/)
  appendWaitHandoverSpecialCraftHandoverEvent(input as never,projection)
  assert.deepEqual(listSpecialCraftProcessingCompletionFacts(undefined,storage).map(fact=>[fact.feiTicketId,fact.specialCraftId,fact.returnedQty]),tickets.map((item,index)=>[item.feiTicketId,stageIds[item.feiTicketId],index?7:11]))
  assert.equal(listSpecialCraftTicketReturnFacts(undefined,storage).length,0)
  submitSpecialCraftBagReturn({...specialCraftBagReturnInput(seeded,'MULTI-DIRECT'),sourceHandoverRecordId:'MD-NEXT-RECORD',occurredAt:'2026-08-01T11:00:00+08:00',ticketReceipts:tickets.map((item,index)=>({feiTicketId:item.feiTicketId,returnedQty:index?6:10,differenceReason:'损耗1片',processingCompleted:true}))},storage)
  assert.deepEqual(listSpecialCraftTicketReturnFacts(undefined,storage).map(fact=>[fact.feiTicketId,fact.specialCraftId,fact.returnedQty]),tickets.map((item,index)=>[item.feiTicketId,`${item.feiTicketId}:STAGE2`,index?6:10]))
})

test('实际任务绑定明确匹配技术包部位工艺、色码、目标对象和当前分配，不采用默认厂', () => {
  const source = { ...ticket('REAL-BOUND', 'PO-REAL-BOUND', 'REAL-CRAFT-FACTORY', 100), productionOrderId: 'PO-REAL-BOUND', partCode: 'PART-FRONT', garmentColor: 'Black', skuColor: 'Black', skuSize: 'M', hasSpecialCraft: true,
    specialCrafts: [{ specialCraftId: 'STAGE-FRONT-01', affectedPartCode: 'PART-FRONT', craftName: '模板工序', receiverFactoryId: 'REAL-CRAFT-FACTORY' }] } as unknown as GeneratedFeiTicketSourceRecord
  const parts = [{ partCode: 'PART-FRONT', specialCrafts: [{ craftCode: 'CRAFT_TEMPLATE', craftName: '模板工序', selectedTargetObject: '已裁部位' }] }] as ReturnType<typeof getProductionOrderCutPieceParts>
  const task = { taskId: 'TASK-ACTUAL-01', taskNo: '实际加工任务01', productionOrderId: source.productionOrderId, assignedFactoryId: 'REAL-CRAFT-FACTORY', assignedFactoryName: '真实承接厂', assignmentStatus: 'ASSIGNED', craftCode: 'CRAFT_TEMPLATE', craftName: '模板工序', selectedTargetObject: '已裁部位', status: 'NOT_STARTED', scopeDetailRows: [], scopeSkuLines: [{ color: 'Black', size: 'M', qty: 100 }] } as unknown as RuntimeProcessTask
  const input = { tickets: [source], tasks: [task], partsForOrder: () => parts }
  const result = buildRuntimeSpecialCraftFeiTicketBindings(input)
  assert.equal(result.length, 1)
  assert.equal(result[0].taskOrderId, task.taskId)
  assert.equal(result[0].taskOrderNo, task.taskNo)
  assert.equal(result[0].workOrderId, '', '不合成加工订单')
  assert.equal(result[0].specialCraftId, 'STAGE-FRONT-01')
  const alternate = buildRuntimeSpecialCraftFeiTicketBindings({ ...input, tasks:[{...task,assignedFactoryId:'OTHER-ACTUAL-FACTORY',assignedFactoryName:'另一个实际承接厂'} as RuntimeProcessTask] })
  assert.equal(alternate.length,1,'已派实际厂不被原票默认厂过滤')
  assert.equal(alternate[0].targetFactoryId,'OTHER-ACTUAL-FACTORY')
  for (const assignmentStatus of ['DIRECT_ASSIGNED', 'AWARDED']) {
    assert.equal(buildRuntimeSpecialCraftFeiTicketBindings({ ...input, tasks: [{ ...task, assignmentStatus } as RuntimeProcessTask] }).length, 1, '实际直接派单或定标后仍按原任务身份绑定')
  }
  for (const wrong of [{ assignedFactoryId: undefined }, { assignmentStatus: 'UNASSIGNED' }, { selectedTargetObject: '成衣' }, { craftCode: 'WRONG-CRAFT' }, { scopeSkuLines: [{ color: 'Black', size: 'L', qty: 100 }] }, { productionOrderId: 'OTHER-PO' }, { executionEnabled: false }]) {
    assert.equal(buildRuntimeSpecialCraftFeiTicketBindings({ ...input, tasks: [{ ...task, ...wrong } as RuntimeProcessTask] }).length, 0)
  }
  assert.equal(buildRuntimeSpecialCraftFeiTicketBindings({ ...input, partsForOrder: () => [] }).length, 0)
  assert.equal(buildRuntimeSpecialCraftFeiTicketBindings({ ...input, tasks: [{ ...task, scopeDetailRows: [{ rowKey: 'ROW-OTHER-PART', dimensions: {}, sourceRefs: { orderId: source.productionOrderId, garmentColor: 'Black', pieceIds: ['OTHER-PART'] } }] } as unknown as RuntimeProcessTask] }).length, 0, '已有范围明确排除该部位不能越过')
})

test('特殊工艺交出只能读取原票当前阶段与唯一实际承接任务', () => {
  const original = ticket('BOUND-01', 'PO-BOUND', 'CRAFT-FACTORY-RETURN', 100)
  const current = { bagCode: 'BAG-BOUND', usageCycleId: 'usage:BOUND:1', productionOrderNo: 'PO-BOUND', tickets: [original], mainStatus: 'IN_USE', flowStage: 'INBOUND_STORED', latestHandoverEventId: '' } as TransferBagCurrentUse
  const source = { ...original, hasSpecialCraft: true, specialCrafts: [{ specialCraftId: 'CRAFT-BOUND-01', craftName: '绣花', craftCategory: '特种工艺', receiverFactoryId: 'CRAFT-FACTORY-RETURN' }] } as unknown as GeneratedFeiTicketSourceRecord
  const binding = { feiTicketId: original.feiTicketId, specialCraftId: 'CRAFT-BOUND-01', assignedFactoryConfirmed: true, taskOrderId: 'TASK-REAL-01', taskOrderNo: '加工任务-01', targetFactoryId: 'CRAFT-FACTORY-RETURN', targetFactoryName: '实际绣花厂', specialCraftFlowStatus: '待发料', closingQty: 0 } as CuttingSpecialCraftFeiTicketBinding
  const input = { current, sources: [source], bindings: [binding], receipts: [] as SpecialCraftTicketReturnFact[] }
  const candidate = resolveSpecialCraftBagHandoverCandidate(input)
  assert.equal(candidate.taskOrderId, 'TASK-REAL-01')
  assert.equal(candidate.specialCraftId, 'CRAFT-BOUND-01')
  assert.throws(() => resolveSpecialCraftBagHandoverCandidate({ ...input, bindings: [] }), /缺少唯一已分配承接任务/)
  assert.throws(() => resolveSpecialCraftBagHandoverCandidate({ ...input, bindings: [binding, { ...binding, taskOrderId: 'TASK-OTHER' }] }), /缺少唯一已分配承接任务/)
  assert.throws(() => resolveSpecialCraftBagHandoverCandidate({ ...input, bindings: [{ ...binding, assignedFactoryConfirmed: false }] }), /缺少唯一已分配承接任务/)
  assert.equal(resolveSpecialCraftBagHandoverCandidate({ ...input, bindings: [{ ...binding, targetFactoryId: 'ACTUAL-ALTERNATE-FACTORY', targetFactoryName:'实际改派厂' }] }).factoryId,'ACTUAL-ALTERNATE-FACTORY','已明确选中任务使用实际派厂，原打印厂不被改写')
  assert.throws(() => resolveSpecialCraftBagHandoverCandidate({ ...input, receipts: [{ feiTicketId: original.feiTicketId, specialCraftId: binding.specialCraftId, returnedQty: 90, processingCompleted: null } as SpecialCraftTicketReturnFact] }), /加工完成事实待核对/)
})

function createMemoryStorage(): BrowserStorageLike { const values = new Map<string,string>(); return { getItem: key => values.get(key) ?? null, setItem: (key,value) => { values.set(key,value) }, removeItem: key => { values.delete(key) } } }
test('ISO来源交出后同一分钟实际回仓保留秒与时区，不被文本格式判为早于来源', () => {
  const storage=createMemoryStorage(),seeded=seedSpecialCraftBagHandover({storage,suffix:'ISO-TIME',occurredAt:'2026-08-01T02:00:20.000Z'})
  const input=specialCraftBagReturnInput(seeded,'ISO-TIME',{occurredAt:'2026-08-01T02:00:30.000Z'})
  const receipt=submitSpecialCraftBagReturn(input,storage)
  assert.equal(receipt.occurredAt,'2026-08-01T02:00:30.000Z')
  assert.equal(listSpecialCraftTicketReturnFacts(listCuttingRuntimeEvents(storage)).length,2)
  assert.equal(submitSpecialCraftBagReturn(input,storage).eventId,receipt.eventId)
  const defaults=createMemoryStorage(),prior=seedSpecialCraftBagHandover({storage:defaults,suffix:'ISO-DEFAULT',occurredAt:'2026-08-01T02:00:20.000Z'})
  const defaultInput=specialCraftBagReturnInput(prior,'ISO-DEFAULT');delete defaultInput.occurredAt
  const actual=submitSpecialCraftBagReturn(defaultInput,defaults)
  assert.match(actual.occurredAt,/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  assert.equal(listSpecialCraftTicketReturnFacts(listCuttingRuntimeEvents(defaults)).length,2)
})
function seedSpecialCraftBagHandover(input: {
  storage: BrowserStorageLike
  suffix: string
  tickets?: TransferBagTicketFactSnapshot[]
  occurredAt?: string
  stageIds?: Record<string, string>
}) {
  const bagCode = `BAG-SPECIAL-RETURN-${input.suffix}`
  const usageCycleId = `usage:${bagCode}:1`
  const sourceHandoverRecordId = `SPECIAL-HR-RETURN-${input.suffix}`
  const sourceHandoverOrderId = `SPECIAL-HO-RETURN-${input.suffix}`
  const specialCraftId = input.stageIds ? Object.values(input.stageIds)[0] : `SPECIAL-CRAFT-RETURN-${input.suffix}`
  const tickets = input.tickets || [
    ticket(`${input.suffix}-01`, `PO-${input.suffix}`, 'CRAFT-FACTORY-RETURN', 12),
    ticket(`${input.suffix}-02`, `PO-${input.suffix}`, 'CRAFT-FACTORY-RETURN', 8),
  ]
  appendBagging({
    storage: input.storage,
    bagCode,
    usageCycleId,
    tickets,
    occurredAt: '2026-08-01T08:00:00+08:00',
  })
  appendInbound({
    storage: input.storage,
    bagCode,
    usageCycleId,
    tickets,
    occurredAt: '2026-08-01T08:10:00+08:00',
  })
  const handover = appendWaitHandoverSpecialCraftHandoverEvent({
    source: 'WEB',
    operator: { operatorId: 'OP-SPECIAL-OUT', operatorName: '特殊工艺交出员' },
    payload: {
      handoverOrderId: sourceHandoverOrderId,
      handoverRecordId: sourceHandoverRecordId,
      craftCategory: '特种工艺',
      craftType: '绣花',
      receiverFactoryId: 'CRAFT-FACTORY-RETURN',
      receiverFactoryName: '特殊工艺回仓测试厂',
      feiTicketItems: tickets.map((item) => ({
        feiTicketId: item.feiTicketId,
        feiTicketNo: item.feiTicketNo,
        specialCraftId: input.stageIds?.[item.feiTicketId] || specialCraftId,
        partName: item.partName,
        size: item.size,
        pieceQty: item.pieceQty,
      })),
      handedOverAt: input.occurredAt || '2026-08-01T09:00:00+08:00',
      handedOverBy: '特殊工艺交出员',
    },
    handoverOrderId: sourceHandoverOrderId,
    handoverRecordId: sourceHandoverRecordId,
    specialCraftId,
    transferBagCode: bagCode,
    fromWarehouseArea: '待交出 A 区',
    occurredAt: input.occurredAt || '2026-08-01T09:00:00+08:00',
    usageCycleId,
    storage: input.storage,
  })
  // 只用于单元契约：明确本票的一道完整工艺来源，数量每次来自真实严格事件读取。
  for (const item of tickets) {
    const source = { ...item, actualCutPieceQty: item.pieceQty, qty: item.pieceQty, skuSize: item.size, garmentColor: item.color, fabricColor: '面料蓝', printStatus: 'PRINTED', sourceBasisType: 'ACTUAL_CUTTING_OUTPUT', hasSpecialCraft: true, specialCrafts: [{ specialCraftId: input.stageIds?.[item.feiTicketId] || specialCraftId, craftType: '绣花', craftName: '绣花', craftCategory: '特种工艺', receiverFactoryId: 'CRAFT-FACTORY-RETURN', receiverFactoryName: '特殊工艺回仓测试厂' }] } as unknown as GeneratedFeiTicketSourceRecord
    receiptFixtureReaders.set(item.feiTicketId, () => {
      const events = listCuttingRuntimeEvents(input.storage)
      return projectReleaseTicket({ ticket: source, materialId: 'MAT-RECEIPT-FIXTURE', materialName: '主料', bag: buildReleaseBagEvidence(events).get(item.feiTicketId), receipts: listSpecialCraftTicketReturnFacts(events, input.storage), events, craftRequirementKnown: true, valid: isCutPieceTicketUsable(item.feiTicketId) })
    })
  }
  setPublishedReleaseTicketDetails(() => [...receiptFixtureReaders.values()].map(read => read()))
  return {
    bagCode,
    usageCycleId,
    sourceHandoverRecordId,
    sourceHandoverOrderId,
    specialCraftId,
    tickets,
    handover,
  }
}

function specialCraftReturnLocation(suffix: string) {
  return {
    factoryId: 'FACTORY-CUTTING',
    warehouseId: 'WAREHOUSE-WAIT-HANDOVER',
    warehouseKind: 'WAIT_HANDOVER' as const,
    areaId: 'AREA-RETURN',
    areaName: '待交出回仓区',
    shelfId: 'SHELF-RETURN',
    shelfNo: 'R',
    locationId: `LOCATION-RETURN-${suffix}`,
    locationNo: `R-${suffix}`,
  }
}

function ticketOnlyReturnInput(seeded: ReturnType<typeof seedSpecialCraftBagHandover>, suffix: string, qty: number): Parameters<typeof submitSpecialCraftTicketOnlyReturn>[0] {
  const item = seeded.tickets[0], locationRef = specialCraftReturnLocation(suffix)
  return { specialCraftId: seeded.specialCraftId, source: 'PDA', operator: { operatorName: '逐票回仓员' }, occurredAt: '2026-08-01T09:20:00+08:00', payload: { returnRecordId: `NO-BAG-RECEIPT-${suffix}`, returnRecordNo: `无袋实收单-${suffix}`, sourceHandoverOrderId: seeded.sourceHandoverOrderId, sourceHandoverOrderNo: `特殊工艺交出单-${suffix}`, sourceHandoverRecordId: seeded.sourceHandoverRecordId, sourceHandoverRecordNo: `特殊工艺交接记录-${suffix}`, receiverFactoryId: 'CRAFT-FACTORY-RETURN', receiverFactoryName: '特殊工艺回仓测试厂', warehouseName: '裁床待交出仓', craftType: '绣花', warehouseArea: locationRef.areaName, locationCode: locationRef.locationNo, locationRef, returnedAt: '2026-08-01T09:20:00+08:00', returnedBy: '逐票回仓员', returnedFeiTicketItems: [{ feiTicketId: item.feiTicketId, feiTicketNo: item.feiTicketNo, specialCraftId: seeded.specialCraftId, craftType: '绣花', partName: item.partName, size: item.size, expectedQty: item.pieceQty, returnedQty: qty, differenceReason: qty === item.pieceQty ? '' : '加工实际少回', processingCompleted: true, unit: '片', returnStatus: qty === item.pieceQty ? '已回仓' : '回仓差异' }] } }
}

function specialCraftBagReturnInput(
  seeded: ReturnType<typeof seedSpecialCraftBagHandover>,
  suffix: string,
  overrides: Partial<Parameters<typeof submitSpecialCraftBagReturn>[0]> = {},
): Parameters<typeof submitSpecialCraftBagReturn>[0] {
  return {
    sourceHandoverRecordId: seeded.sourceHandoverRecordId,
    bagCode: seeded.bagCode,
    returnedTicketIds: seeded.tickets.map((item) => item.feiTicketId),
    ticketReceipts: seeded.tickets.map(item => ({ feiTicketId:item.feiTicketId, processingCompleted:true,returnedQty:item.pieceQty })),
    locationRef: specialCraftReturnLocation(suffix),
    operator: { operatorId: 'OP-SPECIAL-IN', operatorName: '特殊工艺回仓员' },
    source: 'WEB',
    occurredAt: '2026-08-01T09:20:00+08:00',
    ...overrides,
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
    occurredAt: input.occurredAt || '2026-08-01T08:00:00+08:00',
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
      baggingAt: input.occurredAt || '2026-08-01T08:00:00+08:00',
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
    occurredAt: input.occurredAt || '2026-08-01T08:10:00+08:00',
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
      inboundAt: input.occurredAt || '2026-08-01T08:10:00+08:00',
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


// WP02: 逐票实收、工艺身份、纠正替代及同链分袋。
test('逐票实收分别计数，更正库存仅按差额且保留原票', () => {
  const storage = createMemoryStorage()
  const seeded = seedSpecialCraftBagHandover({ storage, suffix:'EXPLICIT' })
  const request = { ...specialCraftBagReturnInput(seeded, 'EXPLICIT'), ticketReceipts: seeded.tickets.map((ticket,index) => ({ feiTicketId:ticket.feiTicketId, processingCompleted:true,returnedQty:index ? 6 : 11, differenceReason:'实际少回' })) }
  const receipt = submitSpecialCraftBagReturn(request, storage)
  assert.equal(receipt.inventoryEffect?.qty,17)
  assert.deepEqual(listSpecialCraftTicketReturnFacts(listCuttingRuntimeEvents(storage)).map(item=>item.returnedQty),[11,6])
  assert.deepEqual(resolveTransferBagCurrentUse(seeded.bagCode,storage).tickets.map(item=>item.pieceQty),[11,6])
  assert.deepEqual((receipt.payload as {ticketSnapshot:TransferBagTicketFactSnapshot[]}).ticketSnapshot.map(item=>item.pieceQty),[12,8])
  const after = listCuttingRuntimeEvents(storage).length
  assert.equal(submitSpecialCraftBagReturn(structuredClone(request),storage).eventId,receipt.eventId)
  assert.equal(listCuttingRuntimeEvents(storage).length,after)
  const correction = { sourceReturnEventId:receipt.eventId, ticketReceipts:seeded.tickets.map((ticket,index)=>({feiTicketId:ticket.feiTicketId,processingCompleted:true,returnedQty:index ? 5:10,differenceReason:'复点更正'})),operator:{operatorName:'复点员'},source:'WEB' as const,reason:'逐票复点',occurredAt:'2026-08-01T09:30:00+08:00' }
  const corrected = correctSpecialCraftTicketReturn(correction,storage)
  assert.equal(corrected.inventoryEffect?.direction,'ADJUST')
  assert.equal(corrected.inventoryEffect?.qty,-2)
  const facts=listSpecialCraftTicketReturnFacts(listCuttingRuntimeEvents(storage))
  assert.deepEqual(facts.map(item=>item.returnedQty),[10,5])
  assert.ok(facts.every(item=>item.processingCompleted===true),'更正保留原逐票加工完成核对事实')
  assert.ok(facts.every(item=>item.correctionOfEventId===receipt.eventId && item.receiptVersion===2))
  assert.deepEqual(resolveTransferBagCurrentUse(seeded.bagCode,storage).tickets.map(item=>item.pieceQty),[10,5])
  assert.equal(buildWaitHandoverLocationOccupancyStates(listCuttingRuntimeEvents(storage)).filter(item=>item.bagCode===seeded.bagCode).reduce((sum,item)=>sum+item.totalPieceQty,0),15)
  const correctionCount=listCuttingRuntimeEvents(storage).length
  assert.equal(correctSpecialCraftTicketReturn(structuredClone(correction),storage).eventId,corrected.eventId)
  assert.equal(listCuttingRuntimeEvents(storage).length,correctionCount)
  assert.throws(()=>correctSpecialCraftTicketReturn({...correction,reason:'换一个原因'},storage),/其他内容/)
})

test('未核对加工完成不得保存；历史完成未知保留实收P而不能冒充齐套',()=>{
  const storage=createMemoryStorage(),seeded=seedSpecialCraftBagHandover({storage,suffix:'COMPLETION'})
  const request=specialCraftBagReturnInput(seeded,'COMPLETION'),before=listCuttingRuntimeEvents(storage).length
  for(const processingCompleted of [undefined,false]) assert.throws(()=>submitSpecialCraftBagReturn({...request,ticketReceipts:request.ticketReceipts!.map(item=>({...item,processingCompleted}))},storage),/核对本阶段加工完成/)
  assert.equal(listCuttingRuntimeEvents(storage).length,before)
  const saved=submitSpecialCraftBagReturn(request,storage)
  assert.ok(listSpecialCraftTicketReturnFacts(listCuttingRuntimeEvents(storage)).every(fact=>fact.processingCompleted===true))
  const events=listCuttingRuntimeEvents(storage),legacy=events.find(event=>event.eventId===saved.eventId)!
  const payload=legacy.payload as typeof saved.payload & {canonicalIntent:string;returnedFeiTicketItems:Array<{processingCompleted?:boolean}>}
  payload.returnedFeiTicketItems.forEach(item=>{delete item.processingCompleted})
  const canonical=JSON.parse(payload.canonicalIntent)
  canonical.ticketReceipts.forEach((item:{processingCompleted?:boolean})=>{delete item.processingCompleted})
  payload.canonicalIntent=JSON.stringify(canonical)
  const historical=listSpecialCraftTicketReturnFacts(events),fact=historical[0]
  assert.equal(fact.processingCompleted,null)
  const binding=applySpecialCraftReceiptToBinding({feiTicketId:fact.feiTicketId,specialCraftId:fact.specialCraftId,targetFactoryId:fact.receiverFactoryId,
    specialCraftFlowStatus:'已回仓',closingQty:fact.expectedQty} as CuttingSpecialCraftFeiTicketBinding,fact)
  assert.equal(binding.specialCraftFlowStatus,'异常','旧实收数量不能补造工艺完成状态')
  const sourceTicket={...seeded.tickets[0],actualCutPieceQty:fact.expectedQty,qty:fact.expectedQty,skuSize:seeded.tickets[0].size,
    garmentColor:seeded.tickets[0].color,fabricColor:'面料蓝',printStatus:'PRINTED',hasSpecialCraft:true,sourceBasisType:'ACTUAL_CUTTING_OUTPUT',
    specialCrafts:[{specialCraftId:fact.specialCraftId,receiverFactoryId:fact.receiverFactoryId,receiverFactoryName:'承接厂',craftCategory:'特种工艺',craftType:'绣花',craftName:'绣花'}]} as unknown as GeneratedFeiTicketSourceRecord
  const detail=projectReleaseTicket({ticket:sourceTicket,materialId:'MAT-COMPLETION',materialName:'主料',receipts:historical,
    bag:buildReleaseBagEvidence(events).get(fact.feiTicketId),bindings:[binding],events,craftRequirementKnown:true})
  assert.equal(detail.physicalPieceQty,fact.returnedQty)
  assert.equal(detail.eligiblePieceQty,0)
  assert.equal(detail.completionEvidenceKnown,false)
})

test('缺逐票确认、空白、小数、超量与未说明差异都不写入', () => {
  const storage=createMemoryStorage(), seeded=seedSpecialCraftBagHandover({storage,suffix:'BAD'})
  const request=specialCraftBagReturnInput(seeded,'BAD')
  const initial=listCuttingRuntimeEvents(storage).length
  assert.throws(()=>submitSpecialCraftBagReturn({...request,ticketReceipts:undefined},storage),/逐张菲票/)
  for(const qty of ['', -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER+1,13,'1e1']) {
    const bad={...request,ticketReceipts:seeded.tickets.map((ticket,index)=>({feiTicketId:ticket.feiTicketId,processingCompleted:true,returnedQty:index?ticket.pieceQty:qty,differenceReason:'差异'}))}
    assert.throws(()=>submitSpecialCraftBagReturn(bad,storage))
    assert.equal(listCuttingRuntimeEvents(storage).length,initial)
  }
  assert.throws(()=>submitSpecialCraftBagReturn({...request,ticketReceipts:seeded.tickets.map(ticket=>({feiTicketId:ticket.feiTicketId,processingCompleted:true,returnedQty:0}))},storage),/差异原因/)
  assert.equal(listCuttingRuntimeEvents(storage).length,initial)
})

test('明确零量点收保留事实，但不生成库存或后道实物', () => {
  const storage=createMemoryStorage(),seeded=seedSpecialCraftBagHandover({storage,suffix:'ZERO'})
  const saved=submitSpecialCraftBagReturn({...specialCraftBagReturnInput(seeded,'ZERO'),ticketReceipts:seeded.tickets.map(ticket=>({feiTicketId:ticket.feiTicketId,processingCompleted:true,returnedQty:0,differenceReason:'实物未返回，按现有差异跟进'}))},storage)
  assert.equal(saved.inventoryEffect?.qty,0)
  assert.equal(listSpecialCraftTicketReturnFacts(listCuttingRuntimeEvents(storage)).reduce((sum,item)=>sum+item.returnedQty,0),0)
  assert.deepEqual(resolveTransferBagCurrentUse(seeded.bagCode,storage).tickets,[])
})

test('按身份与顺序分袋，普通和不同工艺链被阻断',()=>{
  assert.doesNotThrow(()=>assertSpecialCraftBagCompatibility([{feiTicketNo:'A',hasSpecialCraft:false},{feiTicketNo:'B',hasSpecialCraft:false}]))
  assert.doesNotThrow(()=>assertSpecialCraftBagCompatibility([{feiTicketNo:'A',hasSpecialCraft:true,specialCraftChainKey:'V1:PRINT>EMB'},{feiTicketNo:'B',hasSpecialCraft:true,specialCraftChainKey:'V1:PRINT>EMB'}]))
  assert.throws(()=>assertSpecialCraftBagCompatibility([{feiTicketNo:'A',hasSpecialCraft:false},{feiTicketNo:'B',hasSpecialCraft:true,specialCraftChainKey:'V1:PRINT'}]),/不同加工/)
  assert.throws(()=>assertSpecialCraftBagCompatibility([{feiTicketNo:'A',hasSpecialCraft:true,specialCraftChainKey:'V1:PRINT>EMB'},{feiTicketNo:'B',hasSpecialCraft:true,specialCraftChainKey:'V1:EMB>PRINT'}]),/不同加工/)
  assert.throws(()=>assertSpecialCraftBagCompatibility([{feiTicketNo:'A',hasSpecialCraft:true}]),/待补齐/)
})

test('无袋按票独立点收，不能重复新增或回到其他裁床工厂', () => {
  const storage=createMemoryStorage(), seeded=seedSpecialCraftBagHandover({storage,suffix:'SINGLE'})
  const inputFor=(index:number,qty:number) => {
    const ticket=seeded.tickets[index],locationRef=specialCraftReturnLocation('SINGLE')
    return { specialCraftId:seeded.specialCraftId,operator:{operatorName:'逐票回仓员'},source:'PDA' as const,occurredAt:'2026-08-01T09:20:00+08:00',payload:{
      returnRecordId:`SINGLE-${index}`,returnRecordNo:`回仓-${index}`,sourceHandoverOrderId:seeded.sourceHandoverOrderId,
      sourceHandoverOrderNo:seeded.sourceHandoverOrderId,sourceHandoverRecordId:seeded.sourceHandoverRecordId,
      sourceHandoverRecordNo:seeded.sourceHandoverRecordId,receiverFactoryId:'CRAFT-FACTORY-RETURN',receiverFactoryName:'特殊工艺回仓测试厂',
      warehouseName:'裁床待交出仓',craftType:'绣花',warehouseArea:locationRef.areaName,locationCode:locationRef.locationNo,locationRef,
      returnedAt:'2026-08-01T09:20:00+08:00',returnedBy:'逐票回仓员',returnedFeiTicketItems:[{feiTicketId:ticket.feiTicketId,
      feiTicketNo:ticket.feiTicketNo,specialCraftId:seeded.specialCraftId,craftType:'绣花',partName:ticket.partName,size:ticket.size,
      expectedQty:ticket.pieceQty,processingCompleted:true,returnedQty:qty,differenceReason:qty===ticket.pieceQty?'':'少回说明',unit:'片' as const,
      returnStatus:qty===ticket.pieceQty?'已回仓' as const:'回仓差异' as const}]} }
  }
  const wrong=inputFor(0,10)
  assert.throws(()=>submitSpecialCraftTicketOnlyReturn({...wrong,payload:{...wrong.payload,locationRef:{...wrong.payload.locationRef,factoryId:'OTHER-CUTTING'}}},storage),/来源裁床工厂/)
  const first=submitSpecialCraftTicketOnlyReturn(inputFor(0,10),storage),size=listCuttingRuntimeEvents(storage).length
  assert.equal(submitSpecialCraftTicketOnlyReturn(inputFor(0,10),storage).eventId,first.eventId)
  assert.equal(listCuttingRuntimeEvents(storage).length,size)
  assert.throws(()=>submitSpecialCraftTicketOnlyReturn(inputFor(0,9),storage),/不一致|冲突|其他内容/)
  submitSpecialCraftTicketOnlyReturn(inputFor(1,7),storage)
  assert.deepEqual(listSpecialCraftTicketReturnFacts(listCuttingRuntimeEvents(storage)).map(fact=>fact.returnedQty),[10,7])
})

test('多道工艺分别保留同票阶段实收，末道不会累加前道数量', () => {
  let tickets:TransferBagTicketFactSnapshot[]|undefined
  const events=[] as ReturnType<typeof listCuttingRuntimeEvents>
  for(let stage=0;stage<3;stage++) {
    const storage=createMemoryStorage(),seeded=seedSpecialCraftBagHandover({storage,suffix:`CHAIN-${stage}`,tickets})
    const receipt=submitSpecialCraftBagReturn({...specialCraftBagReturnInput(seeded,`CHAIN-${stage}`),ticketReceipts:seeded.tickets.map(ticket=>({feiTicketId:ticket.feiTicketId,processingCompleted:true,returnedQty:ticket.pieceQty-1,differenceReason:'该道加工实际少回一片'}))},storage)
    tickets=seeded.tickets.map(ticket=>({...ticket,pieceQty:ticket.pieceQty-1}))
    events.push(...listCuttingRuntimeEvents(storage))
    assert.equal(receipt.inventoryEffect?.qty,20-2*(stage+1))
  }
  const facts=listSpecialCraftTicketReturnFacts(events)
  assert.equal(facts.length,6)
  for(let stage=0;stage<3;stage++) assert.equal(facts.filter(fact=>fact.specialCraftId===`SPECIAL-CRAFT-RETURN-CHAIN-${stage}`).reduce((sum,fact)=>sum+fact.returnedQty,0),20-2*(stage+1))
  assert.equal(facts.filter(fact=>fact.specialCraftId==='SPECIAL-CRAFT-RETURN-CHAIN-2').reduce((sum,fact)=>sum+fact.returnedQty,0),14)
})

test('100片已经交出后更正为90片只改依据，保留原实交责任且不反冲库存',()=>{
  const storage=createMemoryStorage(),originalTickets=[ticket('AFTER-OUT-01','PO-AFTER-OUT','CRAFT-FACTORY-RETURN',100)]
  const seeded=seedSpecialCraftBagHandover({storage,suffix:'AFTER-OUT',tickets:originalTickets})
  const receipt=submitSpecialCraftBagReturn(specialCraftBagReturnInput(seeded,'AFTER-OUT'),storage)
  const handover=submitWholeBagHandover({bagCode:seeded.bagCode,usageCycleId:seeded.usageCycleId,
    handoverOrderId:'HO-AFTER-RETURN',handoverOrderNo:'HO-AFTER-RETURN',handoverRecordId:'HR-AFTER-RETURN',handoverRecordNo:'HR-AFTER-RETURN',
    assignments:originalTickets.map(ticket=>({feiTicketId:ticket.feiTicketId,feiTicketNo:ticket.feiTicketNo,sewingTaskId:ticket.sewingTaskId,sewingTaskNo:ticket.sewingTaskNo,receiverFactoryId:ticket.receiverFactoryId,receiverFactoryName:ticket.receiverFactoryName})),
    submittedTicketSnapshot:originalTickets,operator:{operatorName:'车缝交出员'},source:'WEB',occurredAt:'2026-08-01T10:00:00+08:00'},storage)
  const before=buildWaitHandoverLocationOccupancyStates(listCuttingRuntimeEvents(storage))
  const priorHandover=listCuttingRuntimeEvents(storage).find(event=>event.eventId===handover.eventId)
  const originalDecision=Object.freeze({confirmedQty:100,systemCompleteKitQty:100,riskQty:0})
  const sourceTicket={...originalTickets[0],actualCutPieceQty:100,qty:100,skuSize:originalTickets[0].size,
    garmentColor:originalTickets[0].color,fabricColor:'面料蓝',printStatus:'PRINTED',sourceBasisType:'ACTUAL_CUTTING_OUTPUT',
    sourceSpreadingSessionNo:'SPREAD-AFTER-OUT',hasSpecialCraft:true,specialCrafts:[{specialCraftId:seeded.specialCraftId,
      craftCategory:'特种工艺',craftType:'绣花',craftName:'绣花',receiverFactoryId:'CRAFT-FACTORY-RETURN',receiverFactoryName:'特殊工艺回仓测试厂'}]} as unknown as GeneratedFeiTicketSourceRecord
  const assertReleaseQuantities=(expectedQty:number,currentRisk:number)=>{
    const events=listCuttingRuntimeEvents(storage),receipts=listSpecialCraftTicketReturnFacts(events)
    const detail=projectReleaseTicket({ticket:sourceTicket,materialId:'MAT-AFTER-OUT',materialName:'主料',
      bag:buildReleaseBagEvidence(events).get(sourceTicket.feiTicketId),receipts,events,craftRequirementKnown:true})
    const matrix=buildReleaseMatrix({productionOrderId:sourceTicket.productionOrderId,productionOrderNo:sourceTicket.productionOrderNo,
      spuCode:'STYLE-AFTER-OUT',planQtyByColorSize:{[sourceTicket.garmentColor]:{[sourceTicket.skuSize]:100}},factsComplete:true,
      requirements:[{materialId:detail.materialId,materialName:detail.materialName,partId:detail.partId,partName:detail.partName,
        piecesPerGarment:1,garmentColor:sourceTicket.garmentColor,size:sourceTicket.skuSize}],
      facts:[{factId:'FACT-AFTER-OUT',sourceEventId:sourceTicket.feiTicketId,productionOrderId:sourceTicket.productionOrderId,
        garmentColor:sourceTicket.garmentColor,size:sourceTicket.skuSize,materialId:detail.materialId,partId:detail.partId,
        actualPieceQty:detail.eligiblePieceQty,physicalPieceQty:detail.physicalPieceQty,ticketDetail:detail,
        direction:'正向',sourceStatus:'持续更新',occurredAt:detail.returnedAt!}]})
    assert.equal(detail.eligiblePieceQty,expectedQty)
    assert.equal(matrix.colorGroups[0].completeKitBySize[sourceTicket.skuSize],expectedQty,'K须来自共享严格实收投影')
    assert.equal(matrix.colorGroups[0].materialRows[0].cells[0].physicalGarmentQty,expectedQty,'P须反映当前合法更正')
    assert.equal(Math.max(originalDecision.confirmedQty-(matrix.colorGroups[0].completeKitBySize[sourceTicket.skuSize] ?? 0),0),currentRisk)
    assert.deepEqual(originalDecision,{confirmedQty:100,systemCompleteKitQty:100,riskQty:0},'历史放行A与历史R不能被当前风险改写')
  }
  const corrected=correctSpecialCraftTicketReturn({sourceReturnEventId:receipt.eventId,ticketReceipts:[{feiTicketId:originalTickets[0].feiTicketId,processingCompleted:true,returnedQty:90,differenceReason:'复核发现十片误计'}],operator:{operatorName:'复核员'},source:'WEB',reason:'复核原点收记录',occurredAt:'2026-08-01T11:00:00+08:00'},storage)
  assert.equal(listSpecialCraftTicketReturnFacts(listCuttingRuntimeEvents(storage))[0].returnedQty,90)
  assertReleaseQuantities(90,10)
  assert.equal((corrected.payload as {inventoryAdjusted:boolean}).inventoryAdjusted,false)
  assert.equal(corrected.inventoryEffect?.qty,0)
  assert.equal(handover.inventoryEffect?.qty,100)
  assert.equal(buildCutPieceReleaseCurrentTicketLocations(listCuttingRuntimeEvents(storage), listSpecialCraftTicketReturnFacts(undefined, storage), storage).get(originalTickets[0].feiTicketId), `已交出 · ${originalTickets[0].receiverFactoryName}`)
  assert.deepEqual(listCuttingRuntimeEvents(storage).find(event=>event.eventId===handover.eventId),priorHandover)
  assert.deepEqual(buildWaitHandoverLocationOccupancyStates(listCuttingRuntimeEvents(storage)),before)
  assert.deepEqual(resolveTransferBagCurrentUse(seeded.bagCode,storage).tickets,[])
  const newTickets=[ticket('NEW-CYCLE-01','PO-NEW-CYCLE','CRAFT-FACTORY-RETURN',25)],newCycle=`usage:${seeded.bagCode}:2`
  appendBagging({storage,bagCode:seeded.bagCode,usageCycleId:newCycle,tickets:newTickets,occurredAt:'2026-08-01T12:00:00+08:00'})
  appendInbound({storage,bagCode:seeded.bagCode,usageCycleId:newCycle,tickets:newTickets,occurredAt:'2026-08-01T12:10:00+08:00'})
  const newBefore=buildWaitHandoverLocationOccupancyStates(listCuttingRuntimeEvents(storage))
  correctSpecialCraftTicketReturn({sourceReturnEventId:corrected.eventId,ticketReceipts:[{feiTicketId:originalTickets[0].feiTicketId,processingCompleted:true,returnedQty:89,differenceReason:'再次复核'}],operator:{operatorName:'复核员'},source:'WEB',reason:'再次复核原点收记录',occurredAt:'2026-08-01T13:00:00+08:00'},storage)
  assert.equal(listSpecialCraftTicketReturnFacts(listCuttingRuntimeEvents(storage))[0].returnedQty,89)
  assertReleaseQuantities(89,11)
  assert.deepEqual(listCuttingRuntimeEvents(storage).find(event=>event.eventId===handover.eventId),priorHandover)
  assert.equal(resolveTransferBagCurrentUse(seeded.bagCode,storage).tickets[0].pieceQty,25)
  assert.deepEqual(buildWaitHandoverLocationOccupancyStates(listCuttingRuntimeEvents(storage)),newBefore)
  const count=listCuttingRuntimeEvents(storage).length
  assert.equal(correctSpecialCraftTicketReturn({sourceReturnEventId:receipt.eventId,ticketReceipts:[{feiTicketId:originalTickets[0].feiTicketId,processingCompleted:true,returnedQty:90,differenceReason:'复核发现十片误计'}],operator:{operatorName:'复核员'},source:'WEB',reason:'复核原点收记录',occurredAt:'2026-08-01T11:00:00+08:00'},storage).eventId,corrected.eventId)
  assert.equal(listCuttingRuntimeEvents(storage).length,count)
  assert.equal(listSpecialCraftTicketReturnFacts(listCuttingRuntimeEvents(storage))[0].returnedQty,89)
})


test('同一分钟旧入仓分钟时间晚于精确装袋账本，不退回已装袋状态', () => {
  const storage = createMemoryStorage(), item = ticket('MINUTE-INBOUND-1', 'PO-MINUTE-INBOUND', 'CRAFT-FACTORY-RETURN', 5)
  const bagCode = 'BAG-MINUTE-INBOUND', usageCycleId = 'cycle:BAG-MINUTE-INBOUND:20261009233016'
  const baggingAt = new Date(2026, 9, 9, 23, 30, 16, 316).toISOString()
  const bagging = appendBagging({ storage, bagCode, usageCycleId, tickets: [item], occurredAt: baggingAt })
  const inbound = appendInbound({ storage, bagCode, usageCycleId, tickets: [item], occurredAt: '2026-10-09 23:30' })
  const original = structuredClone(listCuttingRuntimeEvents(storage))
  assert.ok(inbound.ledgerSequence! > bagging.ledgerSequence!)
  assert.equal(resolveTransferBagCurrentUse(bagCode, storage).flowStage, 'INBOUND_STORED')
  assert.equal(resolveTransferBagCurrentUse(bagCode, storage).usageCycleId, usageCycleId)
  assert.deepEqual(listWaitHandoverLifecycleFacts(bagCode, storage).map(fact => fact.factId), [bagging.eventId, inbound.eventId])
  assert.equal(buildWaitHandoverLifecycleByBagCode(bagCode, storage).flowStage, 'INBOUND_STORED', '提交校验须与候选读取同一事实顺序')
  assert.ok(buildWaitHandoverLifecycleByBagCode(bagCode, storage).allowedActions.includes('HANDOVER'))
  assert.deepEqual(listCuttingRuntimeEvents(storage), original, '只恢复投影顺序，不改写原时间、数量或事件')
  const at = new Date(2026, 9, 9, 23, 31, 30).toISOString()
  const input = {
    source: 'WEB' as const, operator: { operatorName: '特殊工艺交出员' }, storage, transferBagCode: bagCode, usageCycleId,
    handoverOrderId: 'MINUTE-FIRST-TASK', handoverRecordId: 'MINUTE-FIRST-RECORD', specialCraftId: 'MINUTE-FIRST-STAGE', fromWarehouseArea: '待交出 A 区', occurredAt: at,
    payload: { handoverOrderId: 'MINUTE-FIRST-TASK', handoverRecordId: 'MINUTE-FIRST-RECORD', craftCategory: '特种工艺' as const, craftType: '绣花', receiverFactoryId: 'CRAFT-FACTORY-RETURN', receiverFactoryName: '特殊工艺回仓测试厂', feiTicketItems: [{ feiTicketId: item.feiTicketId, feiTicketNo: item.feiTicketNo, specialCraftId: 'MINUTE-FIRST-STAGE', partName: item.partName, size: item.size, pieceQty: 5 }], handedOverAt: at, handedOverBy: '特殊工艺交出员' },
  }
  const projection = { sources: [{ ...item, hasSpecialCraft: true, specialCrafts: [{ specialCraftId: 'MINUTE-FIRST-STAGE' }] }] as unknown as GeneratedFeiTicketSourceRecord[], bindings: [{ feiTicketId: item.feiTicketId, specialCraftId: 'MINUTE-FIRST-STAGE', taskOrderId: 'MINUTE-FIRST-TASK', targetFactoryId: 'CRAFT-FACTORY-RETURN', assignedFactoryConfirmed: true }] as CuttingSpecialCraftFeiTicketBinding[] }
  const handedOver = appendWaitHandoverSpecialCraftHandoverEvent(input, projection)
  assert.equal(handedOver.inventoryEffect?.qty, 5)
  assert.equal(buildWaitHandoverLifecycleByBagCode(bagCode, storage).flowStage, 'HANDED_OVER_WAITING_RETURN')
  assert.equal(appendWaitHandoverSpecialCraftHandoverEvent(input, projection).eventId, handedOver.eventId, '真实提交重试仍不重复交出')
  for (const event of original) assert.deepEqual(listCuttingRuntimeEvents(storage).find(current => current.eventId === event.eventId), event)
})

test('正常入仓默认保留完整时刻，同分钟装袋后入仓可继续交出', t => {
  const now = new Date(2026, 9, 9, 23, 30, 30, 500)
  t.mock.timers.enable({ apis: ['Date'], now })
  try {
    const storage = createMemoryStorage(), item = ticket('EXACT-INBOUND-1', 'PO-EXACT-INBOUND', 'CRAFT-FACTORY-RETURN', 5)
    const bagCode = 'BAG-EXACT-INBOUND', usageCycleId = 'cycle:BAG-EXACT-INBOUND:20261009233016'
    appendBagging({ storage, bagCode, usageCycleId, tickets: [item], occurredAt: new Date(2026, 9, 9, 23, 30, 16, 316).toISOString() })
    const inbound = appendWaitHandoverInboundEvent({ storage, source: 'WEB', operator: { operatorName: '入仓员' }, bagCode, usageCycleId, warehouseArea: '待交出 A 区', locationCode: 'A-R01-L01-P03' })
    assert.equal(inbound.occurredAt, now.toISOString())
    assert.equal(inbound.createdAt, now.toISOString())
    assert.equal(resolveTransferBagCurrentUse(bagCode, storage).flowStage, 'INBOUND_STORED')
  } finally { t.mock.timers.reset() }
})

for (const mode of ['带袋', '无袋', '空袋'] as const) test(`实际${mode}回仓入口保留ISO秒和时区，不先截断成旧本地分钟`, () => {
  const storage = createMemoryStorage(), suffix = `WRAPPER-ISO-${mode}`
  const item = ticket(`${suffix}-01`, `PO-${suffix}`, 'CRAFT-FACTORY-RETURN', 5)
  const seeded = seedSpecialCraftBagHandover({ storage, suffix, tickets: [item], occurredAt: '2026-08-01T02:00:20.000Z' })
  const payload = { ...ticketOnlyReturnInput(seeded, suffix, 5).payload, returnedAt: '2026-08-01T02:00:30.500Z', returnedBy: '实际回仓员', ...(mode === '无袋' ? {} : { transferBagCode: seeded.bagCode }), ...(mode === '空袋' ? { returnedFeiTicketItems: [] } : {}) }
  const input = { source: 'WEB' as const, operator: { operatorName: '实际回仓员' }, payload, specialCraftId: seeded.specialCraftId, occurredAt: payload.returnedAt, storage }
  const original = structuredClone(listCuttingRuntimeEvents(storage).find(event => event.eventId === seeded.handover.eventId))!
  const receipt = appendWaitHandoverSpecialCraftReturnEvent(input)
  assert.equal(receipt.occurredAt, payload.returnedAt)
  assert.deepEqual(listCuttingRuntimeEvents(storage).find(event => event.eventId === original.eventId), original)
  if (mode === '空袋') {
    assert.equal(resolveTransferBagCurrentUse(seeded.bagCode, storage).mainStatus, 'IDLE')
    assert.equal(listSpecialCraftTicketReturnFacts(undefined, storage).length, 0)
  } else {
    assert.equal(listSpecialCraftTicketReturnFacts(undefined, storage)[0].returnedQty, 5)
    assert.equal(appendWaitHandoverSpecialCraftReturnEvent(input).eventId, receipt.eventId)
  }
})


test('当前仓库逐票库存：交到工艺厂为0，最终实收3/0只保留一行，更正不复活原5片', () => {
  const storage = createMemoryStorage(), seeded = seedSpecialCraftBagHandover({storage, suffix:'CURRENT-INVENTORY',tickets:[ticket('CURRENT-INVENTORY-01','PO-CURRENT-INVENTORY','CRAFT-FACTORY-RETURN',5),ticket('CURRENT-INVENTORY-02','PO-CURRENT-INVENTORY','CRAFT-FACTORY-RETURN',5)]})
  const sourceRows:any[] = seeded.tickets.map(t=>({inventoryRecordId:`INV-original-${t.feiTicketId}`,feiTicketId:t.feiTicketId,feiTicketNo:t.feiTicketNo,productionOrderId:t.productionOrderId,productionOrderNo:t.productionOrderNo,cutOrderId:t.cutOrderId,cutOrderNo:t.cutOrderNo,spuCode:t.spuCode,color:t.color,size:t.size,partName:t.partName,pieceQty:5,pieceSequenceLabel:'原票5片',hasSpecialCraft:true,specialCraftDisplay:'未做特殊工艺',receiverFactoryDisplay:'票面默认厂',printStatus:'已打印',voidStatus:'有效',tempBagCode:seeded.bagCode,warehouseArea:'原区',locationCode:'原位',inboundAt:'2026-08-01T00:00:00Z',inventoryStatus:'待分配'}))
  const original = structuredClone(sourceRows)
  const active = resolveTransferBagCurrentUse(seeded.bagCode,storage)
  const outside = buildCurrentWaitHandoverInventoryRecords(sourceRows,listCuttingRuntimeEvents(storage),[],new Map([[seeded.bagCode,active]]))
  assert.equal(outside.length,seeded.tickets.length);assert.ok(outside.every(row=>row.pieceQty===0&&row.inventoryStatus==='已交出'&&row.specialCraftDisplay.includes('加工中')&&row.receiverFactoryDisplay===seeded.handover.payload.receiverFactoryName&&row.locationCode==='—'))
  const inputs=seeded.tickets.map((t,index)=>({feiTicketId:t.feiTicketId,returnedQty:index===0?3:0,differenceReason:index===0?'少2片':'整票零量实收',processingCompleted:true}))
  const receipt=submitSpecialCraftBagReturn({...specialCraftBagReturnInput(seeded,'CURRENT-INVENTORY'),ticketReceipts:inputs},storage)
  const events=listCuttingRuntimeEvents(storage),returned=resolveTransferBagCurrentUse(seeded.bagCode,storage)
  const details:any[]=seeded.tickets.map((t,index)=>({ticketId:t.feiTicketId,validity:'可用',craftRequirementKnown:true,completionEvidenceKnown:true,physicalPieceQty:index===0?3:0,eligiblePieceQty:index===0?3:0,requiresSpecialCraft:true,craftSteps:[{status:'已实际回仓',returnedQty:index===0?3:0,processedQty:index===0?3:0}]}))
  const duplicated=[...sourceRows,...sourceRows.map(r=>({...r,inventoryRecordId:`INV-return-${r.feiTicketId}`,pieceQty:5}))]
  const actual=buildCurrentWaitHandoverInventoryRecords(duplicated,events,details,new Map([[seeded.bagCode,returned]]))
  assert.equal(actual.length,seeded.tickets.length);assert.deepEqual(actual.map(r=>r.pieceQty),inputs.map(i=>i.returnedQty));assert.ok(actual.every(r=>r.specialCraftDisplay==='已回仓'&&r.inventoryStatus==='待分配'));assert.equal(actual.reduce((n,r)=>n+r.pieceQty,0),3)
  const correction=correctSpecialCraftTicketReturn({sourceReturnEventId:receipt.eventId,ticketReceipts:inputs.map(i=>({...i,returnedQty:i.returnedQty===3?2:0})),operator:{operatorName:'复核员'},source:'WEB',reason:'逐票复核',occurredAt:'2026-08-01T03:00:00Z'},storage)
  const corrected=resolveTransferBagCurrentUse(seeded.bagCode,storage)
  const revisedDetails=details.map(d=>({...d,physicalPieceQty:d.physicalPieceQty===3?2:0,eligiblePieceQty:d.eligiblePieceQty===3?2:0}))
  assert.equal(buildCurrentWaitHandoverInventoryRecords(duplicated,listCuttingRuntimeEvents(storage),revisedDetails,new Map([[seeded.bagCode,corrected]])).reduce((n,r)=>n+r.pieceQty,0),2)
  assert.ok(correction.eventId!==receipt.eventId);assert.deepEqual(sourceRows,original)
  const packed={...returned,flowStage:'PACKED' as const};assert.equal(buildCurrentWaitHandoverInventoryRecords(sourceRows,events,details,new Map([[seeded.bagCode,packed]])).length,0)
})

function currentInventorySourceRows(seeded: ReturnType<typeof seedSpecialCraftBagHandover>): any[] {
  return seeded.tickets.map(t => ({inventoryRecordId:`INV-original-${t.feiTicketId}`,feiTicketId:t.feiTicketId,feiTicketNo:t.feiTicketNo,productionOrderId:t.productionOrderId,productionOrderNo:t.productionOrderNo,cutOrderId:t.cutOrderId,cutOrderNo:t.cutOrderNo,spuCode:t.spuCode,color:t.color,size:t.size,partName:t.partName,pieceQty:t.pieceQty,pieceSequenceLabel:'原票',hasSpecialCraft:true,specialCraftDisplay:'未做特殊工艺',receiverFactoryDisplay:'票面默认厂',printStatus:'已打印',voidStatus:'有效',tempBagCode:seeded.bagCode,warehouseArea:'原区',locationCode:'原位',inboundAt:'2026-08-01T00:00:00Z',inventoryStatus:'待分配'}))
}
function currentInventoryDetails(seeded: ReturnType<typeof seedSpecialCraftBagHandover>, quantities: number[]): ReleaseTicketDetail[] {
  return seeded.tickets.map((t,i) => ({ticketId:t.feiTicketId,ticketNo:t.feiTicketNo,validity:'可用',craftRequirementKnown:true,completionEvidenceKnown:true,physicalPieceQty:quantities[i],eligiblePieceQty:quantities[i],requiresSpecialCraft:true,craftSteps:[{status:'已实际回仓',returnedQty:quantities[i],processedQty:quantities[i]}]} as ReleaseTicketDetail))
}
test('仓库无袋逐票实收：先回一票3片，另票仍在厂；零量实收保留真实库位且只有一行', () => {
  const storage=createMemoryStorage(),seeded=seedSpecialCraftBagHandover({storage,suffix:'CURRENT-NO-BAG',tickets:[ticket('CURRENT-NO-BAG-M','PO-CURRENT-NO-BAG','CRAFT-FACTORY-RETURN',5),ticket('CURRENT-NO-BAG-XL','PO-CURRENT-NO-BAG','CRAFT-FACTORY-RETURN',5)]})
  const sources=currentInventorySourceRows(seeded),original=structuredClone(sources),input=ticketOnlyReturnInput(seeded,'CURRENT-NO-BAG-M',3)
  submitSpecialCraftTicketOnlyReturn(input,storage)
  const first=buildCurrentWaitHandoverInventoryRecords(sources,listCuttingRuntimeEvents(storage),currentInventoryDetails(seeded,[3,5]))
  assert.equal(first.length,2);assert.equal(first.find(r=>r.feiTicketId===seeded.tickets[0].feiTicketId)?.pieceQty,3)
  assert.equal(first.find(r=>r.feiTicketId===seeded.tickets[0].feiTicketId)?.locationCode,input.payload.locationCode)
  assert.equal(first.find(r=>r.feiTicketId===seeded.tickets[1].feiTicketId)?.inventoryStatus,'已交出')
  const zeroInput=ticketOnlyReturnInput({...seeded,tickets:[seeded.tickets[1]]},'CURRENT-NO-BAG-XL',0)
  submitSpecialCraftTicketOnlyReturn(zeroInput,storage)
  const both=buildCurrentWaitHandoverInventoryRecords(sources,listCuttingRuntimeEvents(storage),currentInventoryDetails(seeded,[3,0]))
  assert.equal(both.length,2);assert.deepEqual(both.map(r=>r.pieceQty).sort(),[0,3]);assert.ok(both.every(r=>r.tempBagCode==='—'&&r.specialCraftDisplay==='已回仓'))
  assert.equal(both.find(r=>r.feiTicketId===seeded.tickets[1].feiTicketId)?.locationCode,zeroInput.payload.locationCode);assert.deepEqual(sources,original)
})
test('无袋回仓先更正2片再重装，后续更正1片不改当前2片，数量冲突待核对', () => {
  const storage=createMemoryStorage(),seeded=seedSpecialCraftBagHandover({storage,suffix:'CURRENT-NO-BAG-REPACK',tickets:[ticket('CURRENT-NO-BAG-REPACK-M','PO-CURRENT-NO-BAG-REPACK','CRAFT-FACTORY-RETURN',5)]})
  const sources=currentInventorySourceRows(seeded),receipt=submitSpecialCraftTicketOnlyReturn(ticketOnlyReturnInput(seeded,'CURRENT-NO-BAG-REPACK',3),storage)
  const corrected=correctSpecialCraftTicketReturn({sourceReturnEventId:receipt.eventId,ticketReceipts:[{feiTicketId:seeded.tickets[0].feiTicketId,returnedQty:2,differenceReason:'复核少1片'}],operator:{operatorName:'复核员'},source:'WEB',reason:'逐票复核',occurredAt:'2026-08-01T10:00:00+08:00'},storage)
  assert.equal(buildCurrentWaitHandoverInventoryRecords(sources,listCuttingRuntimeEvents(storage),currentInventoryDetails(seeded,[2]))[0].pieceQty,2)
  const fresh={...seeded.tickets[0],pieceQty:2},bagCode='BAG-CURRENT-NO-BAG-NEW',usageCycleId=bagCode+':1'
  appendBagging({storage,bagCode,usageCycleId,tickets:[fresh],occurredAt:'2026-08-01T11:00:00+08:00'});appendInbound({storage,bagCode,usageCycleId,tickets:[fresh],occurredAt:'2026-08-01T11:10:00+08:00'})
  const historyOnly=correctSpecialCraftTicketReturn({sourceReturnEventId:corrected.eventId,ticketReceipts:[{feiTicketId:fresh.feiTicketId,returnedQty:1,differenceReason:'装袋后复核'}],operator:{operatorName:'复核员'},source:'WEB',reason:'保留当前装袋事实',occurredAt:'2026-08-01T11:20:00+08:00'},storage)
  assert.equal(historyOnly.inventoryEffect?.qty,0)
  const current=buildCurrentWaitHandoverInventoryRecords(sources,listCuttingRuntimeEvents(storage),currentInventoryDetails(seeded,[1]))
  assert.equal(current.length,1);assert.equal(current[0].tempBagCode,bagCode);assert.equal(current[0].pieceQty,2);assert.equal(current[0].inventoryStatus,'待核对')
})
test('仓库兼容来源冲突保留实际袋数量，状态待核对而不可分配', () => {
  const storage=createMemoryStorage(),seeded=seedSpecialCraftBagHandover({storage,suffix:'CURRENT-CONFLICT',tickets:[ticket('CURRENT-CONFLICT-M','PO-CURRENT-CONFLICT','CRAFT-FACTORY-RETURN',5)]})
  const legacy=createMemoryStorage()
  appendBagging({storage:legacy,bagCode:seeded.bagCode,usageCycleId:seeded.usageCycleId,tickets:seeded.tickets})
  appendInbound({storage:legacy,bagCode:seeded.bagCode,usageCycleId:seeded.usageCycleId,tickets:seeded.tickets.map(t=>({...t,pieceQty:6}))})
  const blocked=resolveTransferBagCurrentUse(seeded.bagCode,legacy)
  assert.equal(blocked.flowStage,'INBOUND_STORED');assert.ok(blocked.compatibilityBlockedReason)
  const rows=buildCurrentWaitHandoverInventoryRecords(currentInventorySourceRows(seeded),listCuttingRuntimeEvents(legacy),currentInventoryDetails(seeded,[5]),new Map([[seeded.bagCode,blocked]]))
  assert.equal(rows.length,1);assert.equal(rows[0].pieceQty,5);assert.equal(rows[0].inventoryStatus,'待核对')
})

test('末道无袋已实收3片后更正已被消费的前道，不遮蔽末道当前库存或库位', () => {
  const storage=createMemoryStorage(),seeded=seedSpecialCraftBagHandover({storage,suffix:'CURRENT-NO-BAG-STAGES',tickets:[ticket('CURRENT-NO-BAG-STAGES-M','PO-CURRENT-NO-BAG-STAGES','CRAFT-FACTORY-RETURN',5)]})
  const first=submitSpecialCraftTicketOnlyReturn(ticketOnlyReturnInput(seeded,'CURRENT-NO-BAG-STAGE1',5),storage)
  const bagCode='BAG-CURRENT-NO-BAG-STAGE2',usageCycleId=bagCode+':1',item=seeded.tickets[0],specialCraftId='CURRENT-NO-BAG-STAGE2',sourceHandoverOrderId='CURRENT-NO-BAG-STAGE2-ORDER',sourceHandoverRecordId='CURRENT-NO-BAG-STAGE2-RECORD'
  appendBagging({storage,bagCode,usageCycleId,tickets:[item],occurredAt:'2026-08-01T10:00:00+08:00'});appendInbound({storage,bagCode,usageCycleId,tickets:[item],occurredAt:'2026-08-01T10:10:00+08:00'})
  const source={...item,actualCutPieceQty:5,qty:5,skuSize:item.size,garmentColor:item.color,printStatus:'PRINTED',hasSpecialCraft:true,specialCrafts:[{specialCraftId:seeded.specialCraftId,craftType:'绣花',craftName:'绣花',receiverFactoryId:'CRAFT-FACTORY-RETURN',receiverFactoryName:'特殊工艺回仓测试厂'},{specialCraftId,craftType:'烫画',craftName:'烫画',receiverFactoryId:'CRAFT-FACTORY-RETURN',receiverFactoryName:'特殊工艺回仓测试厂'}]} as unknown as GeneratedFeiTicketSourceRecord
  const handover=appendWaitHandoverSpecialCraftHandoverEvent({storage,source:'WEB',operator:{operatorName:'下一工艺交出员'},transferBagCode:bagCode,usageCycleId,specialCraftId,handoverOrderId:sourceHandoverOrderId,handoverRecordId:sourceHandoverRecordId,fromWarehouseArea:'待交出 A 区',occurredAt:'2026-08-01T10:20:00+08:00',payload:{handoverOrderId:sourceHandoverOrderId,handoverRecordId:sourceHandoverRecordId,craftCategory:'特种工艺',craftType:'烫画',receiverFactoryId:'CRAFT-FACTORY-RETURN',receiverFactoryName:'特殊工艺回仓测试厂',feiTicketItems:[{feiTicketId:item.feiTicketId,feiTicketNo:item.feiTicketNo,specialCraftId,partName:item.partName,size:item.size,pieceQty:5}],handedOverAt:'2026-08-01T10:20:00+08:00',handedOverBy:'下一工艺交出员'}},{sources:[source],bindings:[{feiTicketId:item.feiTicketId,specialCraftId,taskOrderId:sourceHandoverOrderId,targetFactoryId:'CRAFT-FACTORY-RETURN',assignedFactoryConfirmed:true}] as CuttingSpecialCraftFeiTicketBinding[]})
  const next={...seeded,bagCode,usageCycleId,specialCraftId,sourceHandoverOrderId,sourceHandoverRecordId,handover},input=ticketOnlyReturnInput(next,'CURRENT-NO-BAG-STAGE2',3)
  input.occurredAt='2026-08-01T10:30:00+08:00';input.payload.returnedAt='2026-08-01T10:30:00+08:00';input.payload.craftType='烫画';input.payload.returnedFeiTicketItems.forEach(t=>t.craftType='烫画')
  const final=submitSpecialCraftTicketOnlyReturn(input,storage),prior=structuredClone(listCuttingRuntimeEvents(storage).find(e=>e.eventId===final.eventId))
  const oldCorrection=correctSpecialCraftTicketReturn({sourceReturnEventId:first.eventId,ticketReceipts:[{feiTicketId:item.feiTicketId,returnedQty:4,differenceReason:'前道记录复核'}],operator:{operatorName:'历史复核员'},source:'WEB',reason:'不得改末道实收',occurredAt:'2026-08-01T11:00:00+08:00'},storage)
  assert.equal((oldCorrection.payload as {inventoryAdjusted:boolean}).inventoryAdjusted,false)
  const events=listCuttingRuntimeEvents(storage),detail=projectReleaseTicket({ticket:source,materialId:'MAT-STAGES',materialName:'主料',bag:buildReleaseBagEvidence(events).get(item.feiTicketId),receipts:listSpecialCraftTicketReturnFacts(events),events,craftRequirementKnown:true})
  assert.equal(detail.physicalPieceQty,3);assert.equal(detail.eligiblePieceQty,3);assert.equal(listSpecialCraftTicketReturnFacts(events).find(r=>r.specialCraftId===seeded.specialCraftId)?.originalReturnedAt,first.occurredAt)
  const rows=buildCurrentWaitHandoverInventoryRecords(currentInventorySourceRows(seeded),events,[detail])
  assert.equal(rows.length,1);assert.equal(rows[0].pieceQty,3);assert.equal(rows[0].locationCode,input.payload.locationCode);assert.equal(rows[0].tempBagCode,'—');assert.equal(rows[0].inventoryStatus,'待分配')
  assert.deepEqual(listCuttingRuntimeEvents(storage).find(e=>e.eventId===final.eventId),prior)
})

test('最终回仓裁片尚未分配车缝任务，仍按当前实收展示可分配库存，不误判来源冲突', () => {
  const storage=createMemoryStorage(),item={...ticket('CURRENT-UNASSIGNED-M','PO-CURRENT-UNASSIGNED','CRAFT-FACTORY-RETURN',5),sewingTaskId:'',sewingTaskNo:'',receiverFactoryId:'',receiverFactoryName:''}
  const seeded=seedSpecialCraftBagHandover({storage,suffix:'CURRENT-UNASSIGNED',tickets:[item]})
  submitSpecialCraftBagReturn({...specialCraftBagReturnInput(seeded,'CURRENT-UNASSIGNED'),ticketReceipts:[{feiTicketId:item.feiTicketId,returnedQty:3,differenceReason:'少2片',processingCompleted:true}]},storage)
  const use=resolveTransferBagCurrentUse(seeded.bagCode,storage)
  assert.match(use.compatibilityBlockedReason||'',/缺少接收工厂事实|缺少车缝任务事实/)
  const rows=buildCurrentWaitHandoverInventoryRecords(currentInventorySourceRows(seeded),listCuttingRuntimeEvents(storage),currentInventoryDetails(seeded,[3]))
  assert.equal(rows.length,1);assert.equal(rows[0].pieceQty,3);assert.equal(rows[0].inventoryStatus,'待分配');assert.equal(rows[0].specialCraftDisplay,'已回仓')
})
