import assert from 'node:assert/strict'
import test from 'node:test'
import {getDefaultSewingSampleApprovalRecords} from '../../src/data/fcs/sewing-outsourcing-demo.ts'
import {createSewingSampleActionScope,captureSewingSampleState,restoreSewingSampleState,resetSewingSampleApprovalSuggestionsForTests,
  receivePreProductionSampleByPpic,getSewingSampleApprovalRecord} from '../../src/data/fcs/sewing-sample-approval-suggestion.ts'

function history() {
  const template=getDefaultSewingSampleApprovalRecords()[0]
  return Array.from({length:2000},(_,index)=>{
    const record=structuredClone(template),id=`SAVE-SCOPE-${index}`
    record.assignmentId=id;record.sample.assignmentId=id;record.sample.sampleId=`SAMPLE-${index}`;record.sample.productionOrderId=`ORDER-${index}`
    record.sample.runtimeTaskId=`TASK-${index}`;record.sample.status='WAITING_PPIC_RECEIVE';record.sample.ppicReceivedSamplePhotoUrls=[]
    record.assignmentAliases=[{assignmentId:id,runtimeTaskId:record.sample.runtimeTaskId}]
    return [id,record] as [string,typeof record]
  })
}

test('2000件单件动作只capture当前件/本命令/序次，失败恢复及发布不碰其余1999件',()=>{
  resetSewingSampleApprovalSuggestionsForTests()
  const records=history(),commands=records.map(([id])=>[`OLD-${id}`,{assignmentId:id,action:'OLD_HISTORY'}] as [string,{assignmentId:string;action:string}])
  restoreSewingSampleState({records,commands,sequence:6000})
  const fullBefore=captureSewingSampleState(),scope=createSewingSampleActionScope('SAVE-SCOPE-0','RECEIVE-ONE')
  const clone=globalThis.structuredClone,stringify=JSON.stringify
  let wholeStateCopies=0,otherCopies=0,otherSerializations=0
  globalThis.structuredClone=((value:any,options?:StructuredSerializeOptions)=>{
    if(Array.isArray(value?.records)&&value.records.length>1)wholeStateCopies++
    if(value?.assignmentId?.startsWith('SAVE-SCOPE-')&&value.assignmentId!=='SAVE-SCOPE-0')otherCopies++
    return clone(value,options)
  }) as typeof structuredClone
  JSON.stringify=((value:any,...args:any[])=>{if(value?.assignmentId?.startsWith('SAVE-SCOPE-')&&value.assignmentId!=='SAVE-SCOPE-0')otherSerializations++;return (stringify as any)(value,...args)}) as typeof JSON.stringify
  let before:ReturnType<typeof scope.capture>,after:ReturnType<typeof scope.capture>
  try{
    before=scope.capture()
    const target=records[0][1]
    scope.run(()=>receivePreProductionSampleByPpic({commandId:'RECEIVE-ONE',assignmentId:target.assignmentId,
      actor:{actorId:target.sample.currentPpicId,actorName:target.sample.currentPpicName,role:'PPIC'},receivedAt:'2026-10-22T02:00:00Z',receivedSamplePhotoUrls:['data:image/jpeg;base64,dGVzdA==']}))
    after=scope.capture();scope.restore(before)
    assert.deepEqual({wholeStateCopies,otherCopies,otherSerializations},{wholeStateCopies:0,otherCopies:0,otherSerializations:0})
  }finally{globalThis.structuredClone=clone;JSON.stringify=stringify}
  assert.deepEqual(captureSewingSampleState(),fullBefore)
  scope.restore(after!)
  const published=captureSewingSampleState()
  assert.equal(published.records[0][1].sample.status,'PPIC_RECEIVED')
  assert.deepEqual(published.records.slice(1),fullBefore.records.slice(1));assert.deepEqual(published.commands.slice(0,-1),fullBefore.commands)
  assert.equal(published.commands.at(-1)![0],'RECEIVE-ONE');assert.equal(published.sequence,6000)
  const unrelated=records[1999][1]
  assert.throws(()=>scope.run(()=>receivePreProductionSampleByPpic({commandId:'RECEIVE-ONE',assignmentId:unrelated.assignmentId,
    actor:{actorId:unrelated.sample.currentPpicId,actorName:unrelated.sample.currentPpicName,role:'PPIC'},receivedAt:'2026-10-22T02:00:00Z',receivedSamplePhotoUrls:['/tshirt-sample.jpg']})),/其他任务/)
  assert.deepEqual(getSewingSampleApprovalRecord(unrelated.assignmentId),unrelated)
})
