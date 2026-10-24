import assert from 'node:assert/strict'
import test from 'node:test'
import { centralLedgerRecordId, replaceCentralExecutionRecordSnapshot, SPECIAL_CRAFT_LEDGER_RECORDS } from '../../src/data/fcs/central-execution-record-bridge.ts'
import { writeFactoryProcessStorage } from '../../src/data/fcs/factory-process-storage.ts'

test('a PCS action may retain an unchanged Central row while adding its own order, but cannot change, remove or revive that row',()=>{
 const key='higoods.formal-print-execution.v1',row={path:'state.workOrders',key:'PWO-PRINT-001',tuple:true,value:{qty:8,unit:'Yard'}}
 const saved={id:centralLedgerRecordId(key,row),collection:SPECIAL_CRAFT_LEDGER_RECORDS,value:{...row,legacyKey:key},version:3}
 const raw=(quantity:number,include=true)=>JSON.stringify({version:1,state:{workOrders:[...(include?[[row.key,{unit:'Yard',qty:quantity}]]:[]),['PWO-DESIGN-NEW',{qty:20,unit:'Yard'}]]}})
 try{
  replaceCentralExecutionRecordSnapshot([saved])
  const previous=JSON.stringify({version:1,state:{workOrders:[]}})
  assert.equal(writeFactoryProcessStorage(key,raw(8),previous).handled,false)
  assert.throws(()=>writeFactoryProcessStorage(key,raw(9),previous),/未保存/)
  assert.throws(()=>writeFactoryProcessStorage(key,raw(8,false),previous),/未保存/)
  replaceCentralExecutionRecordSnapshot([{...saved,deleted:true}])
  assert.equal(writeFactoryProcessStorage(key,raw(8,false),previous).handled,false)
  assert.throws(()=>writeFactoryProcessStorage(key,raw(8),previous),/未保存/)
 }finally{replaceCentralExecutionRecordSnapshot([])}
})
