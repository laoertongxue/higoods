import test from 'node:test'
import assert from 'node:assert/strict'
import { readWoolStore, replaceWoolStore } from '../../src/data/fcs/wool-domain/store.ts'
import { captureFactoryReceivingData, restoreFactoryReceivingData } from '../../src/data/fcs/factory-receiving.ts'
import { readFactoryPdaExecutionUsers } from '../../src/data/fcs/store-domain-pda.ts'
import { captureWoolReplaceMachineAssociationSnapshot, replaceWoolMachineAssociations } from '../../src/data/fcs/wool-domain/machine-associations.ts'
import { renderWoolControlLinks } from '../../src/pages/central-pda/wool-control-view.ts'
import { completeWoolWorkOrder } from '../../src/data/fcs/wool-domain/commands.ts'

const factory='OWN_WOOL_FACTORY',at='2026-10-22T00:00:00Z',order='WOOL-STAGE-004:KNITTING'
const actor=()=>readFactoryPdaExecutionUsers(factory).find(u=>u.roleId==='ROLE_ADMIN')!
function isolated(run:()=>void){const s=readWoolStore(),r=captureFactoryReceivingData();try{run()}finally{restoreFactoryReceivingData(r);replaceWoolStore(s)}}
test('C02.05: a stable original machine save retries its committed result even after completion; changed payload never reclaims devices',()=>isolated(()=>{
 const machine=readWoolStore().machines.find(m=>m.status==='IDLE'&&!readWoolStore().machineAssociations.some(a=>a.machineId===m.machineId))!
 const input={commandId:'WCONTROL-STABLE',operatedAt:at,operatedBy:actor().name,expectedAssociationSnapshot:captureWoolReplaceMachineAssociationSnapshot(order,[machine.machineId])}
 const saved=replaceWoolMachineAssociations(order,[machine.machineId],input)
 assert.deepEqual(replaceWoolMachineAssociations(order,[machine.machineId],input),saved)
 assert.equal(readWoolStore().machineAssociationLogs.filter(r=>r.machineId===machine.machineId&&r.operatedAt===at).length,1)
 assert.throws(()=>replaceWoolMachineAssociations(order,[],input),/幂等|操作号/)
 completeWoolWorkOrder(order,{commandId:'WCONTROL-CLOSED',completedAt:at,completedBy:actor().name})
 assert.deepEqual(replaceWoolMachineAssociations(order,[machine.machineId],input),saved)
 assert.ok(!readWoolStore().machineAssociations.some(r=>r.machineId===machine.machineId),'committed retry never reacquires a released device')
}))

import { centralWoolControlFacts, centralWoolCompletionRequest, centralWoolCompletionSource,
  centralWoolMachineRequest, centralWoolMachineTransfers, centralWoolMachineSource } from '../../src/pages/central-pda/wool-control-model.ts'
import { addWoolHandover, confirmWoolDownstreamReceipt } from '../../src/data/fcs/wool-domain/commands.ts'
import { changeWoolMachineAvailability } from '../../src/data/fcs/wool-domain/machine-associations.ts'

test('C02.05: whole-stage completion keeps original per-SKU and direct-receiver guards, not the 150 percent reporting cap',()=>isolated(()=>{
 assert.throws(()=>centralWoolCompletionRequest(centralWoolControlFacts(factory,'WOOL-STAGE-001:KNITTING'),actor(),'CTRL-NOT-READY',at),/completeBlocked/)
 const id='WOOL-STAGE-004:LINKING',f=()=>centralWoolControlFacts(factory,id)
 assert.throws(()=>centralWoolCompletionRequest(f(),actor(),'CTRL-NO-OUT',at),/completeBlocked/)
 const h=addWoolHandover(id,{commandId:'CTRL-OUT',outputSkuCode:f().row.lines[0].line.outputSkuCode,handoverQty:100,handedOverAt:at,handedOverBy:actor().name})
 assert.throws(()=>centralWoolCompletionRequest(f(),actor(),'CTRL-UNKNOWN',at),/completeBlocked/)
 const beforePartial=structuredClone(readWoolStore())
 confirmWoolDownstreamReceipt(h.handoverId,{commandId:'CTRL-RECEIVED-99',actualReceivedQty:99,receivedAt:at,receivedBy:'Actual downstream'})
 assert.throws(()=>centralWoolCompletionRequest(f(),actor(),'CTRL-SHORT',at),/completeBlocked/)
 // The original one-time downstream confirmation cannot be reconfirmed.
 // Start the independent full-receipt branch from its pre-confirmation facts.
 replaceWoolStore(beforePartial)
 const before=centralWoolCompletionSource(f())
 confirmWoolDownstreamReceipt(h.handoverId,{commandId:'CTRL-RECEIVED-100',actualReceivedQty:100,receivedAt:at,receivedBy:'Actual downstream'})
 assert.notEqual(centralWoolCompletionSource(f()),before)
 const request=centralWoolCompletionRequest(f(),actor(),'CTRL-COMPLETE-LINK',at),machines=structuredClone(f().store.machineAssociations)
 assert.equal(request.input.completedBy,actor().name)
 completeWoolWorkOrder(id,request.input)
 assert.deepEqual(f().store.machineAssociations,machines)
 assert.ok(f().row.completed)
 assert.throws(()=>centralWoolCompletionRequest(f(),actor(),'CTRL-CLOSED',at),/completeBlocked/)
}))

test('C02.05: knitting completion releases the original machine group atomically in its original completion snapshot',()=>isolated(()=>{
 const machine=readWoolStore().machines.find(m=>m.status==='IDLE'&&!readWoolStore().machineAssociations.some(a=>a.machineId===m.machineId))!
 replaceWoolMachineAssociations(order,[machine.machineId],{operatedAt:at,operatedBy:actor().name})
 const f=centralWoolControlFacts(factory,order),request=centralWoolCompletionRequest(f,actor(),'CTRL-KNIT-FINISH',at)
 assert.ok(f.row.lines.every(l=>l.readiness.reportedQty>=l.line.plannedQty))
 const saved=completeWoolWorkOrder(order,request.input)
 assert.deepEqual(saved.confirmationSnapshot.releasedMachineIds,[machine.machineId])
 assert.deepEqual(completeWoolWorkOrder(order,request.input),saved)
 assert.ok(!readWoolStore().machineAssociations.some(a=>a.woolOrderId===order))
 assert.ok(readWoolStore().machines.some(m=>m.machineId===machine.machineId))
 assert.equal(readWoolStore().completions.filter(c=>c.woolOrderId===order).length,1)
 const current=centralWoolControlFacts(factory,order),html=renderWoolControlLinks(current.row,'id',current.completion)
 assert.ok(html.includes(actor().loginId)&&html.includes('data-wool-control-completion'))
 assert.ok(!html.includes('data-central-action'),'completed detail exposes actual responsible account/time without mutation controls')
}))

test('C02.05: machine request preserves whole-group selection, occupied-source confirmation and current availability/actor boundaries',()=>isolated(()=>{
 const machine=readWoolStore().machines.find(m=>m.status==='IDLE'&&!readWoolStore().machineAssociations.some(a=>a.machineId===m.machineId))!
 const a=actor(),other='WOOL-STAGE-002:KNITTING'
 replaceWoolMachineAssociations(other,[machine.machineId],{operatedAt:at,operatedBy:a.name})
 const f=centralWoolControlFacts(factory,order),transfers=centralWoolMachineTransfers(f,[machine.machineId])
 assert.equal(transfers.length,1);assert.equal(transfers[0].order.woolOrderId,other)
 assert.throws(()=>centralWoolMachineRequest(f,[machine.machineId],a,'CTRL-TRANSFER',at),/WCONTROL_transfer/)
 const request=centralWoolMachineRequest(f,[machine.machineId,machine.machineId],a,'CTRL-TRANSFER',at,true)
 assert.deepEqual(request.machineIds,[machine.machineId])
 assert.equal(request.input.operatedBy,a.name)
 assert.deepEqual(request.input.expectedAssociationSnapshot,captureWoolReplaceMachineAssociationSnapshot(order,[machine.machineId]))
 assert.throws(()=>centralWoolMachineRequest(f,[machine.machineId],{...a,name:'forged'},'CTRL-ACTOR',at,true),/WOOL_actor/)
 assert.throws(()=>centralWoolMachineRequest(centralWoolControlFacts(factory,'WOOL-STAGE-004:LINKING'),[],a,'CTRL-LINK',at),/machineBlocked/)
 assert.throws(()=>centralWoolMachineRequest(f,['missing'],a,'CTRL-MISSING',at),/machineUnavailable/)
 changeWoolMachineAvailability(machine.machineId,{nextStatus:'REPAIR',reason:'Original repair boundary',operatedAt:at,operatedBy:a.name,confirmedImpact:true})
 const current=centralWoolControlFacts(factory,order)
 assert.notEqual(centralWoolMachineSource(current,[machine.machineId]),request.expectedSource)
 assert.throws(()=>centralWoolMachineRequest(current,[machine.machineId],a,'CTRL-REPAIR',at,true),/machineUnavailable/)
}))
