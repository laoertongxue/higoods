import test from 'node:test'
import assert from 'node:assert/strict'
import { validateCentralSpreadingMaterialRecords } from '../../src/data/fcs/cutting/spreading-material-records.ts'
import { spreadingIssueConsumedQuantity } from '../../src/data/fcs/cutting/spreading-material-consumption.ts'
import { prepareCuttingProcessReturn, cuttingReturnSourceSnapshot } from '../../src/data/fcs/cutting/cutting-process-material.ts'
import type { CuttingStoredRecord } from '../../src/data/fcs/cutting/cutting-record-repository.ts'
import type { SpreadingSession } from '../../src/pages/process-factory/cutting/marker-spreading-model.ts'
import type { CuttingRuntimeEvent } from '../../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'

const location={factoryId:'own',warehouseId:'wp',warehouseKind:'WAIT_PROCESS',locationId:'real-cell',locationNo:'A01',areaName:'Actual area'} as const
function records():CuttingStoredRecord[]{return[
 {id:'event:issue',collection:'cutting-events',value:{eventId:'issue',eventType:'待加工仓加工接收',eventStatus:'已记录',refs:{spreadingOrderId:'PB',cutOrderId:'CUT'},material:{materialSku:'fabric'},inventoryEffect:{direction:'OUT',qty:180,unit:'yard'},payload:{warehouseLocations:[location]}}},
 {id:'session:PB',collection:'part-ticket:spreading-sessions',value:{spreadingSessionId:'PB',executionFactoryId:'own',planUnits:[{planUnitId:'bed-1',materialSku:'fabric'}],operationLogs:[{logId:'central-spreading:op',operatorId:'actual-editor'}],rolls:[{rollRecordId:'roll',rollNo:'ACTUAL-ROLL',sourceIssueEventId:'issue',planUnitId:'bed-1',materialSku:'fabric',sourceWritebackId:'central-spreading-roll:op',lastUpdatedById:'actual-editor',occurredAt:'2026-10-21 10:00:00',labeledLength:100,actualLength:4.5,headLength:.3,tailLength:.3,layerCount:10,actualCutGarmentQty:20}]}},
]}
test('C01.07: metre consumption converts only the return limit and never rewrites original issue units',()=>{
 const rows=records(),session=rows[1].value as SpreadingSession,issue=rows[0].value as CuttingRuntimeEvent
 assert.equal(spreadingIssueConsumedQuantity([session],'issue','yard'),49.87)
 assert.equal(spreadingIssueConsumedQuantity([session],'issue','米'),45.6)
 assert.equal(issue.inventoryEffect!.unit,'yard');assert.equal(issue.inventoryEffect!.qty,180)
 const source={issue,returnedQty:100,consumedQty:49.87},input={operationId:'return',expectedSource:cuttingReturnSourceSnapshot(source),factoryId:'own',operatorId:'return-worker',operatorName:'Return worker',quantity:30.13,rollCount:1}
 assert.equal(prepareCuttingProcessReturn(source,[location],input,'2026-10-21 10:05:00').inventoryEffect?.qty,30.13)
 assert.throws(()=>prepareCuttingProcessReturn(source,[location],{...input,quantity:30.14},''),/CUT_returnLimit/)
})
test('C01.07: restored roll requires its actual PB, issue, physical warehouse and editing account log',()=>{
 validateCentralSpreadingMaterialRecords(records())
 for(const mutate of [
  (rows:CuttingStoredRecord[])=>{(rows[0].value as CuttingRuntimeEvent).payload={warehouseLocations:[]}},
  (rows:CuttingStoredRecord[])=>{(rows[0].value as CuttingRuntimeEvent).refs.spreadingOrderId='foreign-PB'},
  (rows:CuttingStoredRecord[])=>{(rows[1].value as SpreadingSession).rolls[0].lastUpdatedById='foreign-editor'},
  (rows:CuttingStoredRecord[])=>{(rows[0].value as CuttingRuntimeEvent).inventoryEffect!.unit='片'},
 ]){const rows=records();mutate(rows);assert.throws(()=>validateCentralSpreadingMaterialRecords(rows))}
})
test('C01.07: restored consumption plus actual returns cannot exceed the original issue',()=>{
 const rows=records();rows.push({id:'event:return',collection:'cutting-events',value:{eventId:'return',eventType:'待加工仓回收入仓',eventStatus:'已记录',payload:{sourceIssueEventId:'issue'},inventoryEffect:{direction:'IN',qty:130.13,unit:'yard'}}})
 validateCentralSpreadingMaterialRecords(rows)
 ;(rows[2].value as CuttingRuntimeEvent).inventoryEffect!.qty=130.14
 assert.throws(()=>validateCentralSpreadingMaterialRecords(rows))
})
