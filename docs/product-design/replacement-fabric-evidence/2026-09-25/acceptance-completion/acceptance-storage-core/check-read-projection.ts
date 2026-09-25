import assert from 'node:assert/strict'
import {listRuntimeProcessTasks,applyPendingDispatchAutoAcceptance,captureRuntimeDirectDispatchState,restoreRuntimeDirectDispatchState} from '../../../../src/data/fcs/runtime-process-tasks.ts'
const candidate=listRuntimeProcessTasks().find(task=>task.assignmentStatus==='UNASSIGNED')!
assert(candidate)
const state=captureRuntimeDirectDispatchState()
state.taskOverrides.push([candidate.taskId,{assignmentMode:'DIRECT',assignmentStatus:'ASSIGNED',acceptanceStatus:'PENDING',acceptDeadline:'2026-09-01 12:00:00'}])
restoreRuntimeDirectDispatchState(state,false)
const tasks=listRuntimeProcessTasks(),at='2099-01-01 00:00:00'
const expected=tasks.filter(task=>task.assignmentMode==='DIRECT'&&task.assignmentStatus==='ASSIGNED'&&task.acceptanceStatus==='PENDING'&&task.acceptDeadline&&Number.isFinite(Date.parse(task.acceptDeadline.replace(' ','T'))))
assert(expected.length>0,'需要至少一个到期派单')
const before=JSON.stringify(captureRuntimeDirectDispatchState())
Object.assign(globalThis,{window:{},document:{}})
const result=applyPendingDispatchAutoAcceptance(at),projected=listRuntimeProcessTasks()
for(const task of expected){const now=projected.find(item=>item.taskId===task.taskId)!;assert.equal(now.acceptanceStatus,'ACCEPTED');assert.equal(now.acceptedAt,task.acceptDeadline);assert.deepEqual(now.auditLogs,task.auditLogs)}
assert.deepEqual([...result.taskIds].sort(),expected.map(task=>task.taskId).sort())
assert.equal(JSON.stringify(captureRuntimeDirectDispatchState()),before,'只读投影不改底层任务、生产单或审计')
delete (globalThis as any).window;delete (globalThis as any).document
console.log(JSON.stringify({expected:expected.length,projected:result.acceptedCount,unchangedSource:true,acceptedAt:'由已存acceptDeadline推导；不声称发生持久审计'}))
