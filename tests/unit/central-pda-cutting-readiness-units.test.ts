import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveSpreadingMaterialReadiness } from '../../src/data/fcs/cutting/spreading-material-readiness.ts'
import type { MaterialLedgerProjection } from '../../src/data/fcs/cutting/material-ledger.ts'
const row=(id:string,unit:string,qty:number):MaterialLedgerProjection=>({cutOrderId:id,cutOrderNo:id,productionOrderNo:'PO-actual',unit,cuttingClaimedQty:qty,spreadingConsumedQty:0,returnedQty:0,availableQty:qty,materialIdentity:{materialSku:id,materialName:'Actual cloth',materialColor:'Black'}} as MaterialLedgerProjection)
const ready=(rows:MaterialLedgerProjection[],quantity:number,unit:string)=>resolveSpreadingMaterialReadiness({sourceCutOrderIds:rows.map(r=>r.cutOrderId),plannedMaterialUsage:quantity,plannedMaterialUsageUnit:unit},Object.fromEntries(rows.map(r=>[r.cutOrderId,r])))

test('C01.08: 1 yard cannot satisfy 1 metre; original source unit and amount remain visible',()=>{
 const source=row('CUT-actual','yard',1),result=ready([source],1,'米')
 assert.equal(result.canStartSpreading,false);assert.equal(result.availableQty,0.91);assert.equal(result.shortageQty,0.09)
 assert.equal(source.availableQty,1);assert.equal(result.sourceRows[0].availableQty,1);assert.equal(result.sourceRows[0].unit,'yard')
})
test('C01.08: a metre source is explicitly compared with a yard plan without relabeling raw quantities',()=>{
 const result=ready([row('CUT-actual','米',0.95)],1,'Yard')
 assert.equal(result.canStartSpreading,true);assert.equal(result.availableQty,1.04);assert.equal(result.unit,'Yard')
 assert.equal(result.sourceRows[0].availableQty,0.95);assert.equal(result.sourceRows[0].unit,'米')
})
test('C01.08: mixed known lengths aggregate in the plan unit, same-unit counts retain their actual unit',()=>{
 assert.equal(ready([row('CUT-a','yard',5),row('CUT-b','米',2)],6.58,'米').canStartSpreading,false)
 assert.equal(ready([row('CUT-a','yard',5),row('CUT-b','米',2)],6.57,'米').availableQty,6.57)
 assert.equal(ready([row('CUT-count','片',12)],12,'片').canStartSpreading,true)
})
test('C01.08: incompatible or missing source units never become available metres',()=>{
 for(const unit of ['片','公斤','']){const result=ready([row('CUT-actual',unit,180)],1,'米');assert.equal(result.canStartSpreading,false);assert.equal(result.statusKey,'UNIT_MISMATCH');assert.match(result.reasonText,/单位/)}
})
