import assert from 'node:assert/strict'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
class FixtureStorage {
  private rows = new Map<string, string>()
  getItem(key: string) { return this.rows.get(key) ?? null }
  setItem(key: string, value: string) { this.rows.set(key, value) }
  removeItem(key: string) { this.rows.delete(key) }
  clear() { this.rows.clear() }
}
const storage = new FixtureStorage()
Object.defineProperty(globalThis, 'localStorage', {value:storage,configurable:true})
// 该专项执行 Node 演示 fixture，不伪造未 hydrate 的浏览器；浏览器持久化另走真实 IndexedDB 验收。
Object.defineProperty(globalThis, 'window', {value:{localStorage:storage,addEventListener(){},dispatchEvent(){},location:{pathname:'/'}},configurable:true})
// Node 的原生 BroadcastChannel 会保留进程；此 fixture 不验证跨页通知。
Object.defineProperty(globalThis, 'BroadcastChannel', {value:undefined,configurable:true})
const { ensureSimpleCutPieceHandoverFixtures, appendSimpleCutPieceDemoCuttingBatch, SIMPLE_CUT_PIECE_DEMO_ORDER_ID } = await import('../src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts')
const { productionOrders } = await import('../src/data/fcs/production-orders.ts')
const { listSpreadingResultGeneratedFeiTickets } = await import('../src/data/fcs/cutting/generated-fei-tickets.ts')
const { listDispatchTaskSheetAssignments, buildDispatchTaskSheetData, resolveDispatchTaskSheet } = await import('../src/data/fcs/dispatch-task-sheet.ts')
ensureSimpleCutPieceHandoverFixtures()
const order = productionOrders.find(row => row.productionOrderId === SIMPLE_CUT_PIECE_DEMO_ORDER_ID)!
assert.equal(order.demandSnapshot.spuName, '连帽拉链卫衣')
assert.equal(order.techPackSnapshot!.cutPieceParts.reduce((sum,part)=>sum+part.pieceCountPerGarment,0),9)
for (const url of [...order.techPackSnapshot!.imageSnapshot.productImages,...order.techPackSnapshot!.imageSnapshot.materialImages,...order.techPackSnapshot!.imageSnapshot.patternImages]) assert.ok(existsSync(`public${url}`), url)
const sheets = listDispatchTaskSheetAssignments().filter(row=>row.productionOrderId===SIMPLE_CUT_PIECE_DEMO_ORDER_ID).map(row=>buildDispatchTaskSheetData(row.assignmentId)).filter(row=>row.supportsCutPieceHandover)
assert.equal(sheets.length,2)
// DOWNSTREAM-004: 同一打印来源的条码/二维码，在分配重读后仍解析到同一个完整 SKU 任务。
const { refreshEffectiveTaskAssignments } = await import('../src/data/fcs/effective-task-assignments.ts')
for (const sheet of sheets) {
  refreshEffectiveTaskAssignments()
  assert.equal(resolveDispatchTaskSheet(sheet.taskSheetNo).assignment.assignmentId, sheet.assignment.assignmentId, '打印纸号与扫码来源必须一致')
  assert.equal(resolveDispatchTaskSheet(sheet.qrValue).assignment.assignmentId, sheet.assignment.assignmentId, '任务二维码必须读取同一分配')
}

const allSheets = listDispatchTaskSheetAssignments().filter(row=>row.productionOrderId.startsWith('PO-DEMO-')).map(row=>buildDispatchTaskSheetData(row.assignmentId))
assert.ok(allSheets.some(row=>row.taskTypeLabel==='车缝+烫包' && row.supportsCutPieceHandover))
assert.ok(allSheets.some(row=>row.taskTypeLabel==='裁剪+车缝+烫包' && !row.supportsCutPieceHandover))
assert.equal(new Set(sheets.map(row=>row.assignment.factoryId)).size,2)
assert.equal(new Set(sheets.map(row=>row.ppicId)).size,2)
assert.deepEqual(sheets.map(row=>row.assignment.skuLines[0].qty).sort((a,b)=>a-b),[80,100])
const tickets = () => listSpreadingResultGeneratedFeiTickets().filter(row=>row.productionOrderId===SIMPLE_CUT_PIECE_DEMO_ORDER_ID)
assert.equal(tickets().length,10)
assert.equal(tickets().reduce((sum,row)=>sum+row.actualCutPieceQty,0),1260)
assert.ok(tickets().every(row=>row.partCode!=='HOOD' && row.sourceBasisType==='ACTUAL_CUTTING_OUTPUT'))
const { resolveSimpleCutPieceHandover } = await import('../src/data/fcs/cutting/simple-cut-piece-handover.ts')
for (const sheet of sheets) {
  const preview = resolveSimpleCutPieceHandover(sheet.taskSheetNo)
  assert.equal(preview.tickets.length, 5, '当前普通完裁票必须有明确无特殊工艺依据，不能被错误拒绝')
  assert.equal(preview.totalAvailablePieceQty, sheet.assignment.skuLines[0].qty * 7)
}
assert.equal(appendSimpleCutPieceDemoCuttingBatch(2).appended,true)
assert.equal(appendSimpleCutPieceDemoCuttingBatch(2).appended,false)
assert.equal(tickets().length,12)
assert.equal(tickets().reduce((sum,row)=>sum+row.actualCutPieceQty,0),1620)
const after = storage.getItem('cuttingRuntimeEventLedger')
ensureSimpleCutPieceHandoverFixtures()
assert.equal(storage.getItem('cuttingRuntimeEventLedger'),after)
console.log('关联演示通过：两工厂不同 PPIC/SKU，首批1260片，第二批360片，不重复生成。')

const demos = await import('../src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts')
const bagDemo = demos.initializeSimpleCutPieceBagDemo()
const bagPreview = resolveSimpleCutPieceHandover(bagDemo.taskSheetNo)
assert.ok(bagPreview.excluded.some(row => row.feiTicketNo === bagDemo.feiTicketNo && /中转袋/.test(row.reason)))
assert.ok(!bagPreview.tickets.some(row => row.feiTicketNo === bagDemo.feiTicketNo))
assert.equal(demos.initializeSimpleCutPieceBagDemo().eventId, bagDemo.eventId)
const outside = demos.advanceSimpleCutPieceSpecialCraftDemo('OUTSIDE')
assert.equal(outside.specialCraftFlowStatus, '已发料')
const returned = demos.moveSimpleCutPieceSpecialCraftDemo(outside.bindingId, 'RETURNED')
assert.equal(returned.specialCraftFlowStatus, '已回仓')
const linkedEvidence = {bagDemo, craft:{bindingId:outside.bindingId, productionOrderId:outside.productionOrderId, feiTicketNo:outside.feiTicketNo, outside:outside.specialCraftFlowStatus, returned:returned.specialCraftFlowStatus, limitation:'既有测试裁床特殊工艺场景，仅验证真实在外/回仓命令；不代表专用裁床简易交出可用'}}
mkdirSync('output/verification/task-sheet-simple-cut-piece-handover',{recursive:true})
writeFileSync('output/verification/task-sheet-simple-cut-piece-handover/linked-fixture-verification.json',JSON.stringify(linkedEvidence,null,2))
console.log(JSON.stringify(linkedEvidence,null,2))
const flow = await import('../src/data/fcs/cutting/special-craft-fei-ticket-flow.ts')
const dedicated = demos.initializeSimpleCutPieceSpecialCraftDemo()
const original = JSON.stringify(flow.listCuttingSpecialCraftFeiTicketBindings().find(row=>row.bindingId===outside.bindingId))
assert.equal(flow.refreshGeneratedSpecialCraftFeiTicketBindings(),0)
assert.equal(JSON.stringify(flow.listCuttingSpecialCraftFeiTicketBindings().find(row=>row.bindingId===outside.bindingId)),original)
const target = dedicated.bindings.find(row=>row.sizeCode==='M')!
assert.equal(target.cuttingFactoryId, (await import('../src/data/fcs/factory-mock-data.ts')).DEDICATED_CUTTING_FACTORY_ID)
const handovers = await import('../src/data/fcs/pda-handover-events.ts')
const headId = `SC-DISPATCH-${target.operationId.replace(/[^A-Za-z0-9]/g,'')}-${target.targetFactoryId.replace(/[^A-Za-z0-9]/g,'')}-${target.cuttingFactoryId}`
assert.equal(handovers.findPdaHandoverHead(headId),undefined)
const beforeWrongSource=JSON.stringify(flow.listCuttingSpecialCraftFeiTicketBindings())
assert.throws(()=>flow.createSpecialCraftDispatchHandoverFromFeiTickets({cuttingFactoryId:'WRONG-CUTTING',cuttingFactoryName:'错误裁床',targetFactoryId:target.targetFactoryId,targetFactoryName:target.targetFactoryName,operationId:target.operationId,operationName:target.operationName,selectedFeiTicketNos:[target.feiTicketNo],operatorName:'仓管',submittedAt:'2026-09-16 09:00:00'}),/来源裁床/)
assert.equal(handovers.findPdaHandoverHead(headId),undefined)
assert.equal(JSON.stringify(flow.listCuttingSpecialCraftFeiTicketBindings()),beforeWrongSource)
const craftOutside=demos.moveSimpleCutPieceSpecialCraftDemo(target.bindingId,'OUTSIDE')
assert.equal(craftOutside.specialCraftFlowStatus,'已发料')
const outsidePreview = resolveSimpleCutPieceHandover(dedicated.taskSheetNo)
assert.ok(outsidePreview.excluded.some(row=>row.feiTicketNo===target.feiTicketNo && /工艺/.test(row.reason)))
assert.ok(!outsidePreview.tickets.some(row=>row.feiTicketNo===target.feiTicketNo))
const preserved=JSON.stringify(flow.listCuttingSpecialCraftFeiTicketBindings().find(row=>row.bindingId===target.bindingId))
assert.equal(flow.refreshGeneratedSpecialCraftFeiTicketBindings(),0)
assert.equal(JSON.stringify(flow.listCuttingSpecialCraftFeiTicketBindings().find(row=>row.bindingId===target.bindingId)),preserved)
const craftReturned=demos.moveSimpleCutPieceSpecialCraftDemo(target.bindingId,'RETURNED')
assert.equal(craftReturned.specialCraftFlowStatus,'已回仓')
const afterReturn=JSON.stringify(flow.listCuttingSpecialCraftFeiTicketBindings().find(row=>row.bindingId===target.bindingId))
assert.equal(flow.refreshGeneratedSpecialCraftFeiTicketBindings(),0)
assert.equal(JSON.stringify(flow.listCuttingSpecialCraftFeiTicketBindings().find(row=>row.bindingId===target.bindingId)),afterReturn)
const returnedPreview = resolveSimpleCutPieceHandover(dedicated.taskSheetNo)
assert.ok(!returnedPreview.tickets.some(row=>row.feiTicketNo===target.feiTicketNo), '旧flow回仓状态不能冒充完整逐票最终实收依据')
assert.ok(returnedPreview.excluded.some(row=>row.feiTicketNo===target.feiTicketNo && /工艺/.test(row.reason)))
writeFileSync('output/verification/task-sheet-simple-cut-piece-handover/dynamic-special-craft-verification.json',JSON.stringify({orderId:dedicated.orderId,taskSheetNo:dedicated.taskSheetNo,feiTicketNo:target.feiTicketNo,cuttingFactoryId:target.cuttingFactoryId,dispatchRecord:craftOutside.dispatchHandoverRecordId,returnRecord:craftReturned.returnHandoverRecordId,outsideExcluded:true,legacyStatusReturned:true,returnedEligible:false,strictReceiptMissing:true,refreshIdempotent:true,legacyPreserved:true},null,2))
console.log('专用裁床动态工艺菲票：在外阻断；旧flow已回仓仍缺逐票最终实收依据，不冒充可交；重复刷新不覆写旧状态。')
