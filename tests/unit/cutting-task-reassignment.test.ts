import test from 'node:test'
import { replacementFabricAssignmentKey } from '../../src/data/fcs/cutting/replacement-fabric-source.ts'
import assert from 'node:assert/strict'
import { applyRuntimeDirectDispatchMeta, reassignRuntimeCuttingTask, canReassignRuntimeCuttingTask, getRuntimeTaskById, captureRuntimeDirectDispatchState, restoreRuntimeDirectDispatchState } from '../../src/data/fcs/runtime-process-tasks.ts'
import { createEffectiveTaskAssignment, listCurrentEffectiveTaskAssignments, captureEffectiveTaskAssignmentState, restoreEffectiveTaskAssignmentState } from '../../src/data/fcs/effective-task-assignments.ts'

test('独立裁剪整任务改派保留数量和执行历史，旧有效分配失效，新范围唯一',()=>{
 const runtimeBefore=captureRuntimeDirectDispatchState(),assignmentBefore=captureEffectiveTaskAssignmentState()
 try {
 const taskId='TASKGEN-po-14671-001__ORDER',at='2026-09-25 11:00:00'
 const input={taskId,factoryId:'OWN-CUTTING-001',factoryName:'HiGood 裁床厂',acceptDeadline:'',taskDeadline:'',remark:'首次派单',by:'计划员',dispatchPrice:1000,dispatchPriceCurrency:'IDR',dispatchPriceUnit:'件',priceDiffReason:'',businessAssignedAt:at,operatedAt:at}
 const first=applyRuntimeDirectDispatchMeta(input)!
 const save=(task:typeof first)=>createEffectiveTaskAssignment({runtimeTaskId:task.taskId,productionOrderId:task.productionOrderId,productionOrderNo:task.productionOrderNo,taskNo:task.taskNo,factoryId:task.assignedFactoryId!,factoryName:task.assignedFactoryName!,source:'REASSIGNMENT',assignedQty:task.scopeQty,skuLines:task.scopeSkuLines.map(x=>({...x})),processCodes:['CUTTING'],frozenPrice:1000,priceCurrency:'IDR',priceUnit:'件',businessAssignedAt:at,operatedAt:at,operatedBy:'计划员',replaceReason:'测试整任务改派'})
 const old=save(first)
 const before=getRuntimeTaskById(taskId)!
 assert.equal(canReassignRuntimeCuttingTask(before),true)
 assert.throws(()=>reassignRuntimeCuttingTask({...input,remark:'同厂'}),/另一家/)
 assert.throws(()=>reassignRuntimeCuttingTask({...input,factoryId:'ID-F004',remark:''}),/原因/)
 const updated=reassignRuntimeCuttingTask({...input,factoryId:'ID-F004',factoryName:'PT Mulia Cutting Center',remark:'产能调整，保留已裁历史'})
 const next=save(updated)
 assert.equal(updated.taskId,before.taskId)
 assert.equal(updated.scopeQty,before.scopeQty)
 assert.deepEqual(updated.scopeSkuLines,before.scopeSkuLines)
 assert.equal(updated.status,before.status)
 assert.equal(updated.startedAt,before.startedAt)
 assert.equal(updated.finishedAt,before.finishedAt)
 assert.ok(updated.auditLogs.some(x=>x.action==='CUTTING_REASSIGN'))
 const current=listCurrentEffectiveTaskAssignments(taskId)
 assert.deepEqual(current.map(x=>x.assignmentId),[next.assignmentId])
 assert.notEqual(next.assignmentId,old.assignmentId)
 assert.equal(current[0].factoryId,'ID-F004')
 assert.equal(canReassignRuntimeCuttingTask({...updated,processCode:'SEW',processBusinessCode:'SEW',processNameZh:'车缝'}),false)
 } finally { restoreRuntimeDirectDispatchState(runtimeBefore,false);restoreEffectiveTaskAssignmentState(assignmentBefore) }
})


test('裁床改派回原工厂且回填同一业务日期，不复用旧票范围；普通审计不改身份', () => {
  const base = { taskId: 'CUT-1', assignedFactoryId: 'CUTTING', businessAssignedAt: '2026-09-25 08:00:00', createdAt: '2026-09-24', auditLogs: [] }
  const original = replacementFabricAssignmentKey(base)
  assert.equal(replacementFabricAssignmentKey({ ...base, auditLogs: [{ id: 'A', action: 'UPDATE', at: '2026-09-25', by: '计划员', detail: '修改显示信息' }] }), original)
  const first = replacementFabricAssignmentKey({ ...base, auditLogs: [{ id: 'R1', action: 'CUTTING_REASSIGN', at: '2026-09-25', by: '计划员', detail: '改派' }] })
  const second = replacementFabricAssignmentKey({ ...base, auditLogs: [{ id: 'R2', action: 'CUTTING_REASSIGN', at: '2026-09-25', by: '计划员', detail: '再次改派' }] })
  assert.notEqual(first, original)
  assert.notEqual(first, second)
})
