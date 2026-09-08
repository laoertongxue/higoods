/** Read-only workspace acceptance: all input mutations are confined to this Node process.
 * Covers new formal CUT cache invalidation, exact BOM/occurrence binding and pending-spreading gate.
 * No browser records, receipt events, marker plans or spreading orders are created.
 */
import assert from 'node:assert/strict'
import { buildFcsCuttingDomainSnapshot } from '../src/domain/fcs-cutting-runtime/domain-snapshot.ts'
import { buildMarkerPlanProjection } from '../src/pages/process-factory/cutting/marker-plan-projection.ts'
import fs from 'node:fs'
import { productionOrders } from '../src/data/fcs/production-orders.ts'
import { processTasks, upsertProcessTasksForProductionOrder } from '../src/data/fcs/process-tasks.ts'
import { listGeneratedCutOrderSourceRecords } from '../src/data/fcs/cutting/generated-cut-orders.ts'
import { listPdaCuttingTaskSourceRecords } from '../src/data/fcs/cutting/pda-cutting-task-source.ts'
import { resolveCuttingTaskLink } from '../src/data/fcs/cutting/cutting-task-routing.ts'
import { listPdaTaskFlowProjectedTasks, isCuttingSpecialTask, resolvePdaTaskDetailPath } from '../src/data/fcs/pda-cutting-execution-source.ts'
import { renderPdaCuttingTaskDetailPage } from '../src/pages/pda-cutting-task-detail.ts'

const archive=JSON.parse(fs.readFileSync('output/verification/seven-demand-acceptance/seven-live-43183/seven-live-facts-final.json','utf8'))
const order=structuredClone(archive.orders.find((item:any)=>item.productionOrderId==='PO-202603-0104'))
assert.ok(order)
assert.equal(productionOrders.some(item=>item.productionOrderId===order.productionOrderId),false,'isolated process must not already contain archived live order')
const old=listGeneratedCutOrderSourceRecords()
assert.equal(old.some(item=>item.productionOrderId===order.productionOrderId),false)
productionOrders.push(order)
const tasks=upsertProcessTasksForProductionOrder(order,'2026-09-07 07:43:44','隔离验收契约')
const cutTask=tasks.find(task=>task.processCode==='PROC_CUT' || task.processBusinessCode==='CUT_PANEL')!
assert.ok(cutTask,'formal generator must produce CUT from frozen entries')
const cuts=listGeneratedCutOrderSourceRecords().filter(item=>item.productionOrderId===order.productionOrderId)
assert.ok(cuts.length>0,'new order appears despite prior warmed cache; no explicit reset')
assert.ok(cuts.every(item=>item.cuttingTaskId===cutTask.taskId))
assert.ok(cuts.every(item=>item.sourceBomItemIds?.length))
assert.deepEqual(cuts[0].skuScopeLines.map(line=>[line.skuCode,line.plannedQty]),order.demandSnapshot.skuLines.map((line:any)=>[line.skuCode,line.qty]),'multiple piece mappings must not multiply garment demand')
assert.ok(cuts.every(item=>!item.markerPlanId&&!item.markerPlanNo),'derived cuts must not invent markers')
const source=listPdaCuttingTaskSourceRecords().find(item=>item.taskId===cutTask.taskId)!
assert.ok(source)
assert.deepEqual(source.executionOrderIds,[])
console.log('PASS warmed cache -> archived new frozen PO -> formal task generator -> exact CUT source',JSON.stringify({productionOrderId:order.productionOrderId,taskId:cutTask.taskId,cutOrderNos:cuts.map(item=>item.cutOrderNo)}))

const entryIds=[cutTask.sourceEntryId,...(cutTask.sourceEntryIds||[])].filter(Boolean) as string[]
const bomIds=cuts.flatMap(item=>item.sourceBomItemIds||[])
assert.ok(entryIds.length)
const other={...cutTask,taskId:'CONTRACT-CUT-OTHER',taskNo:'CONTRACT-CUT-OTHER',sourceEntryId:'CONTRACT-OTHER-ENTRY',sourceEntryIds:['CONTRACT-OTHER-ENTRY'],consumedBomItemIds:['CONTRACT-OTHER-BOM']}
processTasks.push(other)
assert.equal(resolveCuttingTaskLink({productionOrderId:order.productionOrderId,productionOrderNo:order.productionOrderNo,sourceEntryIds:entryIds,sourceBomItemIds:bomIds}).cuttingTaskId,cutTask.taskId)
assert.ok(resolveCuttingTaskLink({productionOrderId:order.productionOrderId,productionOrderNo:order.productionOrderNo,sourceEntryIds:['WRONG-ENTRY'],sourceBomItemIds:['WRONG-BOM']}).cuttingTaskId.startsWith('CUTTASK-'))
assert.ok(resolveCuttingTaskLink({productionOrderId:order.productionOrderId,productionOrderNo:order.productionOrderNo}).cuttingTaskId.startsWith('CUTTASK-'))
processTasks.splice(processTasks.indexOf(other),1)
console.log('PASS two CUT occurrences: exact source/BOM binds; wrong or ambiguous ownership never selects first CUT')

const projected=listPdaTaskFlowProjectedTasks().filter(task=>task.productionOrderId===order.productionOrderId)
const current=projected.find(task=>task.processCode==='PROC_CUT'||task.processBusinessCode==='CUT_PANEL')!
assert.ok(current && isCuttingSpecialTask(current))
assert.equal(current.rootTaskNo,cutTask.taskNo)
assert.equal(current.taskType,'CUTTING')
assert.deepEqual(current.executionOrderIds,[])
assert.equal(current.taskReadyForDirectExec,false)
assert.match(current.summary?.currentStage||'',/待生成唛架\/铺布单/)
assert.match(resolvePdaTaskDetailPath(current.taskId),/\/pda\/cutting\/task\//)
const html=renderPdaCuttingTaskDetailPage(current.taskId)
assert.match(html,/PO-202603-0104/)
assert.ok(cuts.every(item=>html.includes(item.cutOrderNo)))
assert.match(html,/待生成唛架\/铺布单/)
assert.match(html,/尚无铺布单，不能开工或放行/)
assert.equal(current.executionOrderIds?.length,0)
assert.doesNotMatch(html,/data-pda-cutting-task-action="start-work"|未找到裁片任务/)
fs.writeFileSync('/tmp/cutting-live-current-pending.html',html)
console.log('PASS runtime child and actual page renderer: source visible, no spreading facts, no start/release action',JSON.stringify({runtimeTaskId:current.taskId,rootTaskNo:current.rootTaskNo,executionCount:current.executionOrderIds?.length}))
console.log('PASS 3 required groups; current workspace modules; no workspace writes or physical completion claims')

const snapshot=buildFcsCuttingDomainSnapshot()
const progress=snapshot.progressRecords.find(item=>item.productionOrderId===order.productionOrderId)
assert.ok(progress,'new formal order must reach actual cutting progress/marker input')
assert.equal(progress.hasSpreadingRecord,false)
assert.equal(progress.hasInboundRecord,false)
assert.equal(progress.spreadingStartedAt,'')
assert.equal(progress.completedAt,'')
assert.ok(progress.materialLines.every(line=>line.configuredLength===0&&line.receivedLength===0&&!line.pieceProgressLines?.length),'new projection must not create preparation or execution facts')
assert.ok(buildMarkerPlanProjection(snapshot).sources.cutOrderRows.some(row=>row.cutOrderId===cuts[0].cutOrderId),'actual marker source includes new CUT; published-style context is verified in the browser')
console.log('PASS new CUT reaches marker sources without seeded preparation/spreading/completion')
