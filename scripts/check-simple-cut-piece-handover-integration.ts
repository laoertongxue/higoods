import assert from 'node:assert/strict'
import { ensureSimpleCutPieceHandoverFixtures, appendSimpleCutPieceDemoCuttingBatch } from '../src/data/fcs/cutting/simple-cut-piece-handover-fixtures.ts'
import { resolveSimpleCutPieceHandover, confirmSimpleCutPieceHandover } from '../src/data/fcs/cutting/simple-cut-piece-handover.ts'
import { listSimpleCutPieceHandoverEvents, appendCuttingRuntimeEventIdempotent } from '../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
import { buildSimpleCutPieceHandoverProjection } from '../src/data/fcs/cutting/handover-orders.ts'
import { buildSimpleCutPieceFactoryReceipts } from '../src/data/fcs/pda-handover-events.ts'
import { getSewingCutPieceResponsibilityProjection, resetSewingCutPieceResponsibilityForTests } from '../src/data/fcs/sewing-cut-piece-responsibility.ts'
import { transferSewingTaskResponsibility } from '../src/data/fcs/sewing-outsourcing-responsibility.ts'
import { FACTORY_ONBOARDING_PPIC_OPTIONS, PPIC_TEAM_LEADER_LINGYUN } from '../src/data/fcs/factory-onboarding-ppic.ts'
import { buildDispatchTaskSheetData, resolveDispatchTaskSheet } from '../src/data/fcs/dispatch-task-sheet.ts'
import { DEDICATED_CUTTING_FACTORY_ID } from '../src/data/fcs/factory-mock-data.ts'

const rows = new Map<string,string>()
let failWrite = false
const storage = {getItem:(k:string)=>rows.get(k)||null,setItem:(k:string,v:string)=>{if(failWrite)throw new Error('模拟存储失败');rows.set(k,v)},removeItem:(k:string)=>rows.delete(k)}
Object.defineProperty(globalThis,'window',{value:{localStorage:storage,sessionStorage:storage,addEventListener(){},location:{pathname:'/'}},configurable:true})
Object.defineProperty(globalThis,'localStorage',{value:storage,configurable:true})
ensureSimpleCutPieceHandoverFixtures()
const sheetNo='RW-10CIVDB-0IZLA0Q'
const actor={factoryId:DEDICATED_CUTTING_FACTORY_ID,operatorId:'CHECK-WAREHOUSE',operatorName:'验收仓管',operatorRole:'WAREHOUSE',source:'WEB' as const}
const first=resolveSimpleCutPieceHandover(sheetNo)
assert.equal(first.totalAvailablePieceQty,700)
assert.equal(first.totalRequiredPieceQty,900)
assert.equal(first.tickets.length,5)
assert.equal(listSimpleCutPieceHandoverEvents().length,0,'识别不产生交出')
const command={taskSheetNo:sheetNo,candidateFingerprint:first.candidateFingerprint,commandId:'CHECK-SIMPLE-FIRST',actor}
failWrite=true
await assert.rejects(confirmSimpleCutPieceHandover(command),/模拟存储失败/)
failWrite=false
assert.equal(listSimpleCutPieceHandoverEvents().length,0,'保存失败不产生业务事实')
const results=await Promise.all([confirmSimpleCutPieceHandover(command),confirmSimpleCutPieceHandover(command)])
assert.equal(results.filter(result=>result.appended).length,1,'重复提交只保存一次')
assert.equal(listSimpleCutPieceHandoverEvents().length,1)
assert.deepEqual(listSimpleCutPieceHandoverEvents()[0].payload.previousHandedOverLines,[],'first confirmation freezes zero previous quantity')
assert.equal(buildSimpleCutPieceHandoverProjection().records[0].recordStatus,'已接收')
assert.equal(buildSimpleCutPieceFactoryReceipts().records[0].status,'RECEIVED')
const assignmentId=first.sheet.assignment.assignmentId
resetSewingCutPieceResponsibilityForTests()
let responsibility=getSewingCutPieceResponsibilityProjection(assignmentId)
assert.equal(responsibility.totalHandedOverPieceQty,700,'冷读从唯一交出事实恢复责任')
assert.equal(responsibility.totalDebtPieceQty,200)
assert.equal(responsibility.strictCompleteKitQty,0,'缺帽片不能声称齐套')
assert.equal(resolveSimpleCutPieceHandover(sheetNo).totalAvailablePieceQty,0)
assert.throws(()=>appendCuttingRuntimeEventIdempotent({eventType:'菲票装袋',idempotencyKey:'CHECK-BAG-SAME-TICKET',eventSource:'WEB',operatorName:'验收仓管',refs:{feiTicketIds:[first.tickets[0].feiTicketId]},payload:{}} as never),/简易裁片|已经|已通过/,'旧袋路径不能再消费已交票')
const stale=resolveSimpleCutPieceHandover(sheetNo)
appendSimpleCutPieceDemoCuttingBatch(2)
await assert.rejects(confirmSimpleCutPieceHandover({...command,commandId:'CHECK-STALE',candidateFingerprint:stale.candidateFingerprint}),/已变化/)
const second=resolveSimpleCutPieceHandover(sheetNo)
assert.equal(second.totalAvailablePieceQty,200)
assert.equal(second.tickets.length,1)
await confirmSimpleCutPieceHandover({...command,commandId:'CHECK-SIMPLE-SECOND',candidateFingerprint:second.candidateFingerprint,actor:{...actor,source:'PDA'}})
assert.equal(listSimpleCutPieceHandoverEvents().find(event=>event.idempotencyKey==='CHECK-SIMPLE-SECOND')!.payload.previousHandedOverLines!.reduce((sum,line)=>sum+line.pieceQty,0),700,'second confirmation freezes prior cumulative from shared responsibility')
assert.equal(buildSimpleCutPieceHandoverProjection().records[0].shortageAfterRecord.reduce((sum,line)=>sum+line.shortageQty,0),200,'second batch does not change first batch frozen shortage')
responsibility=getSewingCutPieceResponsibilityProjection(assignmentId)
assert.equal(responsibility.totalHandedOverPieceQty,900)
assert.equal(responsibility.totalDebtPieceQty,0)
assert.equal(responsibility.strictCompleteKitQty,100)
assert.equal(buildSimpleCutPieceHandoverProjection().orders[0].totalRecordCount,2)
assert.equal(buildSimpleCutPieceFactoryReceipts().records.length,2)
assert.equal(resolveSimpleCutPieceHandover('RW-0SARC2R-0FXVDJ7').totalAvailablePieceQty,720,'另一工厂的裁片未被消耗')
assert.throws(()=>resolveSimpleCutPieceHandover('RW-1H7957Z-1JEWD9O'),/车缝|裁片|三合一|面辅料/)
for(const code of ['PO-DEMO-SIMPLE-0916','FEI-001','BAG-001'])assert.throws(()=>resolveDispatchTaskSheet(code))
const target=FACTORY_ONBOARDING_PPIC_OPTIONS.find(row=>row.status==='启用'&&row.ppicId!==first.sheet.ppicId)!
transferSewingTaskResponsibility({commandId:'CHECK-TRANSFER',runtimeTaskId:first.sheet.assignment.runtimeTaskId,targetPpicId:target.ppicId,reason:'验收责任移交',remainingItems:['后续车缝跟进'],operatedAt:'2026-09-16 16:00:00',operatedByPpicId:PPIC_TEAM_LEADER_LINGYUN.ppicId})
assert.throws(()=>resolveDispatchTaskSheet(sheetNo),/失效|版本|变化/)
assert.notEqual(buildDispatchTaskSheetData(assignmentId).taskSheetNo,sheetNo)
assert.equal(listSimpleCutPieceHandoverEvents()[0].payload.ppicId,first.sheet.ppicId,'历史实交保留当时PPIC')
assert.ok(storage.getItem('higood.sewing-task-responsibility-transfers.v1'))
console.log('简易裁片完整事务通过：存储失败、重复确认、两批领取、即时接收、冷读责任、袋互斥、旧码失效和历史责任。')
