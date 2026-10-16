import test from 'node:test'
import assert from 'node:assert/strict'
import { validateWashingBackup } from '../../src/data/fcs/fabric-washing-maintenance.ts'
import { WASHING_COLLECTION } from '../../src/data/fcs/fabric-washing-repository.ts'
import { applyWashingCommand, emptyWashingState, type WashingSource } from '../../src/data/fcs/fabric-washing-model.ts'

function backup() {
  const source:WashingSource={objectType:'FABRIC',id:'PRINT/BATCH',printOrderId:'PRINT',printOrderNo:'PH-001',batchId:'BATCH',sourceType:'PRODUCTION',sourceNo:'PO-001',factoryId:'PRINT',factoryName:'印花厂',materialSku:'FAB-001',materialName:'面料',imageUrl:'/materials/fabric.jpg',revision:'1',actualCompleted:true,rolls:[{id:'ROLL',barcode:'ROLL-001',qty:50,unit:'Yard',confirmed:true,handedOut:false}]}
  const {state}=applyWashingCommand(emptyWashingState(),{type:'JUDGE',source,rollIds:['ROLL'],decision:'WASH',handFeel:'柔软手感'},{id:'site',name:'现场人员',role:'现场判断人员',factoryId:'PRINT'},'BACKUP-TEST','2026-10-16T10:00:00+08:00')
  const order=state.orders[0]
  return {format:'higood-fcs-fabric-washing' as const,version:1 as const,records:[{id:WASHING_COLLECTION+'/orders/'+encodeURIComponent(order.id),collection:WASHING_COLLECTION,version:1,value:{kind:'orders',data:order}}],files:[]}
}
test('WASH-289: a no-acceptance order is valid for existing full backup/restore format',()=>{
  const value=backup(),before=structuredClone(value)
  const validated=validateWashingBackup(value)
  assert.equal(validated.backup.records[0].value.data.acceptance,'NOT_REQUIRED')
  assert.equal(validated.backup.records[0].value.data.acceptedAt,undefined)
  assert.deepEqual(value,before)
})
test('WASH-286: legacy acceptance and blocked-state facts survive backup validation unchanged',()=>{
  for(const acceptance of ['UNASSIGNED','PENDING','ACCEPTED','REJECTED'] as const){
    const value=backup(),order=value.records[0].value.data
    order.acceptance=acceptance
    if(acceptance==='ACCEPTED')order.acceptedAt='2026-10-15T10:00:00+08:00'
    order.exception='历史实物差异';order.cancelledAt='2026-10-15T11:00:00+08:00'
    const before=structuredClone(value)
    assert.deepEqual(validateWashingBackup(value).backup,before)
  }
})
test('WASH-289: unknown washing status still fails backup validation',()=>{
  const value=backup();(value.records[0].value.data as unknown as {acceptance:string}).acceptance='INVALID'
  assert.throws(()=>validateWashingBackup(value),/状态无效/)
})
