import assert from 'node:assert/strict'
import { confirmSimpleCutPieceHandover } from '../src/data/fcs/cutting/simple-cut-piece-handover.ts'
import { DEDICATED_CUTTING_FACTORY_ID } from '../src/data/fcs/factory-mock-data.ts'
import { buildSimpleCutPieceHandoverProjection, getUniversalHandoverOrderById, getUniversalHandoverRecordById, calculateMinimumReturnQtyByBags, handoverOrders, listHandoverOrders } from '../src/data/fcs/cutting/handover-orders.ts'
import { buildSimpleCutPieceFactoryReceipts, findPdaPickupHead, findPdaPickupRecord, getPdaPickupRecordsByHead } from '../src/data/fcs/pda-handover-events.ts'
import type { SimpleCutPieceHandoverPayload } from '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
const memory = new Map<string, string>()
const storage = { getItem: (k: string) => memory.get(k) || null, setItem: (k: string, v: string) => memory.set(k, v), removeItem: (k: string) => memory.delete(k) }
;(globalThis as any).window = { localStorage: storage, sessionStorage: storage }
const base: SimpleCutPieceHandoverPayload = {schemaVersion:1, assignmentId:'ASG-TEST', runtimeTaskId:'TASK-TEST',taskNo:'TASK-TEST',taskSheetNo:'RW-TEST',taskSheetVersion:'1',taskTypeLabel:'车缝',productionOrderId:'PO-TEST',productionOrderNo:'PO-TEST',styleCode:'STYLE-TEST',styleName:'测试款',styleImageUrl:'/shirt-sample.jpg',factoryId:'FACTORY-TEST',factoryName:'测试车缝厂',ppicId:'PPIC-TEST',ppicName:'领取人',warehouseFactoryId:'CUTTING-TEST',handoverOrderId:'SIMPLE-HO-TEST',handoverOrderNo:'SIMPLE-HO-TEST',handoverRecordId:'SIMPLE-HR-1',handoverRecordNo:'SIMPLE-HR-1',requirementSnapshotId:'REQ-TEST',requirementSnapshotAt:'2026-09-16 08:00:00',skuLines:[{skuCode:'SKU-TEST',color:'白',size:'M',qty:10}],requirements:[{skuCode:'SKU-TEST',color:'白',size:'M',partCode:'FRONT',partName:'前片',piecesPerGarment:1,allocatedGarmentQty:10}],tickets:[],totalPieceQty:4,receiptStatus:'RECEIVED',confirmationBasis:'WAREHOUSE_CONFIRMATION'}
function event(id: number, qty: number) {return {eventId:`EVENT-${id}`,eventNo:`EVENT-${id}`,eventType:'简易裁片交出',eventSource:id === 1 ? 'WEB':'PDA',eventStatus:'已记录',ledgerSequence:id,occurredAt:`2026-09-16 0${id+8}:00:00`,createdAt:`2026-09-16 0${id+8}:00:00`,operatorId:'WAREHOUSE-USER',operatorName:'真实仓管',operatorRole:'WAREHOUSE',refs:{},payload:{...base,handoverRecordId:`SIMPLE-HR-${id}`,handoverRecordNo:`SIMPLE-HR-${id}`,totalPieceQty:qty,tickets:[{feiTicketId:`FEI-${id}`,feiTicketNo:`FEI-${id}`,sourceOutputLineId:`OUTPUT-${id}`,cutOrderNo:'CUT-TEST',skuCode:'SKU-TEST',color:'白',size:'M',partCode:'FRONT',partName:'前片',pieceRange:`${id}`,pieceQty:qty,unit:'片'}]}}}
storage.setItem('cuttingRuntimeEventLedger', JSON.stringify({events:[event(1,4)]}))
let projection=buildSimpleCutPieceHandoverProjection()
assert.equal(projection.orders[0].status,'部分接收')
assert.equal(projection.orders[0].totalReceivedPieceQty,4)
assert.equal(projection.records[0].recordStatus,'已接收')
assert.equal(projection.records[0].transferBagUses.length,0)
assert.equal(projection.records[0].feiTicketItems[0].inventoryRecordId,undefined)
assert.equal(getUniversalHandoverOrderById('SIMPLE-HO-TEST')?.totalRecordCount,1)
assert.equal(getUniversalHandoverRecordById('SIMPLE-HR-1')?.handedOverBy,'真实仓管')
let receipt=buildSimpleCutPieceFactoryReceipts()
assert.equal(receipt.heads[0].factoryId,'FACTORY-TEST')
assert.equal(receipt.heads[0].completionStatus,'COMPLETED')
assert.equal(receipt.heads[0].taskStatus,'IN_PROGRESS')
assert.equal(receipt.heads[0].factoryCompletionRequired,false)
assert.equal(findPdaPickupRecord('SIMPLE-HR-1')?.status,'RECEIVED')
assert.equal(findPdaPickupRecord('SIMPLE-HR-1')?.factoryConfirmedBy,undefined)
assert.equal(getPdaPickupRecordsByHead(receipt.heads[0].handoverId)[0].warehouseHandedBy,'真实仓管')
assert.ok(findPdaPickupHead(receipt.heads[0].handoverId))
const raw=storage.getItem('cuttingRuntimeEventLedger')
buildSimpleCutPieceFactoryReceipts(); buildSimpleCutPieceHandoverProjection()
assert.equal(storage.getItem('cuttingRuntimeEventLedger'),raw,'read projections do not write facts')
storage.setItem('cuttingRuntimeEventLedger', JSON.stringify({events:[event(1,4),event(2,6)]}))
projection=buildSimpleCutPieceHandoverProjection()
assert.equal(projection.orders.length,1)
assert.equal(projection.orders[0].totalRecordCount,2)
assert.equal(projection.orders[0].totalReceivedPieceQty,10)
assert.equal(projection.orders[0].status,'已接收')
assert.equal(projection.records[1].previousHandedOverSummary[0].pieceQty,4)
assert.equal(buildSimpleCutPieceFactoryReceipts().records.length,2)
assert.equal(calculateMinimumReturnQtyByBags('FACTORY-TEST',{FRONT:1})[0].totalHandedOverPieceQty,10)
assert.equal(calculateMinimumReturnQtyByBags('FACTORY-TEST',{FRONT:1})[0].transferBagCount,0)
const frozenEvents = [event(1,4),event(2,6)]
frozenEvents.forEach((e) => { e.payload.requirements = [{...base.requirements[0],piecesPerGarment:2}] })
storage.setItem('cuttingRuntimeEventLedger', JSON.stringify({events:frozenEvents}))
assert.equal(calculateMinimumReturnQtyByBags('FACTORY-TEST')[0].minimumReturnQty,5,'return quantities use frozen pieces per garment')
frozenEvents.forEach((e) => e.payload.requirements.push({...base.requirements[0],partCode:'BACK',partName:'后片'}))
storage.setItem('cuttingRuntimeEventLedger', JSON.stringify({events:frozenEvents}))
assert.equal(calculateMinimumReturnQtyByBags('FACTORY-TEST')[0].minimumReturnQty,0,'missing required part prevents false complete kits')
// Frozen prior quantities include historical handovers, while the factory batch remains actual-only.
const mixed = event(1,60)
mixed.payload.requirements = [{...base.requirements[0],allocatedGarmentQty:100}]
;(mixed.payload as SimpleCutPieceHandoverPayload).previousHandedOverLines = [{skuCode:'SKU-TEST',color:'白',size:'M',partCode:'FRONT',partName:'前片',pieceQty:40}]
storage.setItem('cuttingRuntimeEventLedger',JSON.stringify({events:[mixed]}))
projection=buildSimpleCutPieceHandoverProjection()
assert.equal(projection.orders[0].taskCumulativeHandedOverPieceQty,100,'historical 40 plus this batch 60 is task cumulative 100')
assert.equal(projection.orders[0].totalHandedOverPieceQty,60,'this order excludes historical quantities owned by another order')
const historicalOrder={...projection.orders[0],handoverOrderId:'OLD-40',handoverOrderNo:'OLD-40',totalHandedOverPieceQty:40,totalReceivedPieceQty:40,taskCumulativeHandedOverPieceQty:undefined}
handoverOrders.push(historicalOrder)
assert.equal(listHandoverOrders().filter(order=>order.handoverOrderId==='OLD-40'||order.handoverOrderId===base.handoverOrderId).reduce((sum,order)=>sum+order.totalHandedOverPieceQty,0),100,'ledger totals old40 plus new60 exactly once')
handoverOrders.pop()
assert.equal(projection.orders[0].status,'已接收')
assert.equal(projection.records[0].previousHandedOverSummary[0].pieceQty,40)
assert.equal(projection.records[0].currentHandedOverSummary[0].pieceQty,60)
assert.equal(buildSimpleCutPieceFactoryReceipts().records[0].qtyExpected,60,'batch receipt never re-counts old 40')
const earlier = event(1,20)
earlier.payload.requirements = [{...base.requirements[0],allocatedGarmentQty:100}]
;(earlier.payload as SimpleCutPieceHandoverPayload).previousHandedOverLines = [{skuCode:'SKU-TEST',color:'白',size:'M',partCode:'FRONT',partName:'前片',pieceQty:40}]
const later = event(2,40)
later.payload.requirements = [{...base.requirements[0],allocatedGarmentQty:100}]
;(later.payload as SimpleCutPieceHandoverPayload).previousHandedOverLines = [{skuCode:'SKU-TEST',color:'白',size:'M',partCode:'FRONT',partName:'前片',pieceQty:60}]
storage.setItem('cuttingRuntimeEventLedger',JSON.stringify({events:[earlier]}))
const frozenRecord=buildSimpleCutPieceHandoverProjection().records[0]
assert.equal(frozenRecord.shortageAfterRecord[0].shortageQty,40)
storage.setItem('cuttingRuntimeEventLedger',JSON.stringify({events:[earlier,later]}))
assert.deepEqual(buildSimpleCutPieceHandoverProjection().records[0],frozenRecord,'later receipt cannot rewrite earlier shortage snapshot')
assert.equal(buildSimpleCutPieceHandoverProjection().orders[0].taskCumulativeHandedOverPieceQty,100,'snapshot is not added twice to previous batches')
storage.setItem('cuttingRuntimeEventLedger', JSON.stringify({events:[]}))
assert.equal(buildSimpleCutPieceHandoverProjection().orders.length,0,'fresh reads reflect current persisted facts')
const savedFacts=JSON.stringify([...memory])
let attemptedWrites=0
;(globalThis as any).window.localStorage={getItem(){throw new Error('storage read denied')},setItem(){attemptedWrites++},removeItem(){attemptedWrites++}}
const unavailable=buildSimpleCutPieceFactoryReceipts()
assert.match(unavailable.readError || '',/无法读取/,'read failure is explicit, not a claim that no receipts exist')
assert.equal(unavailable.records.length,0)
await assert.rejects(confirmSimpleCutPieceHandover({taskSheetNo:'RW-TEST',commandId:'UNREADABLE-LEDGER',candidateFingerprint:'x',actor:{factoryId:DEDICATED_CUTTING_FACTORY_ID,operatorId:'W1',operatorName:'仓管',operatorRole:'WAREHOUSE',source:'WEB'}}),/storage read denied/,'confirmation retains the strict ledger guard')
assert.equal(attemptedWrites,0,'unreadable ledger cannot be overwritten or confirmed')
assert.equal(JSON.stringify([...memory]),savedFacts,'read failure never changes persisted facts')
;(globalThis as any).window.localStorage=storage
assert.equal(buildSimpleCutPieceFactoryReceipts().readError,undefined,'restored storage clears the read error')
console.log('simple cut-piece receipt projections: 43 assertions passed')
