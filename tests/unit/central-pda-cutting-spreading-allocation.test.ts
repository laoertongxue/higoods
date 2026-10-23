import test from 'node:test'
import assert from 'node:assert/strict'
import { spreadingAllocatedMaterial } from '../../src/data/fcs/cutting/spreading-material-allocation.ts'
import type { CuttingRuntimeEvent } from '../../src/data/fcs/cutting/cutting-runtime-event-ledger.ts'
const location={factoryId:'own',warehouseId:'wp',warehouseKind:'WAIT_PROCESS'}
const event=(id:string,type:string,qty:number,unit='yard',pb='PB-one')=>({eventId:id,eventType:type,eventStatus:'已记录',refs:{cutOrderId:'cut-one',productionOrderId:'production-one',spreadingOrderId:pb},material:{materialSku:'fabric-one'},inventoryEffect:{inventoryScope:'裁床待加工仓',direction:type==='待加工仓加工接收'?'OUT':'IN',qty,unit},payload:{warehouseLocations:[location],sourceInboundEventIds:['in']}} as CuttingRuntimeEvent)
const ready=(events:CuttingRuntimeEvent[],pb='PB-one')=>spreadingAllocatedMaterial({events,spreadingOrderId:pb,factoryId:'own',cutOrderIds:['cut-one'],unit:'米'})
test('C01.07: actual issue to this PB remains available in metres without changing its original 180-yard fact',()=>{
 const source=event('in','中转仓接收',180),issued=event('issue','待加工仓加工接收',180)
 assert.equal(ready([source,issued]).quantity,164.59);assert.equal(issued.inventoryEffect?.unit,'yard');assert.equal(issued.inventoryEffect?.qty,180)
 assert.equal(ready([source,issued],'another-PB').quantity,0)
})
test('C01.07: actual returns remove only the allocated quantity of their original issue',()=>{
 const rows=[event('in','中转仓接收',180),event('issue','待加工仓加工接收',50),event('return','待加工仓回收入仓',10)]
 rows[2].payload={...rows[2].payload,sourceIssueEventId:'issue'}
 assert.equal(ready(rows).quantity,36.58)
 rows[2].payload={...rows[2].payload,sourceIssueEventId:'another-issue'};assert.equal(ready(rows).quantity,45.72)
})
test('C01.07: another factory, material or missing inbound cannot lend quantity to a bed',()=>{
 const source=event('in','中转仓接收',180),issued=event('issue','待加工仓加工接收',50)
 for(const mutation of [()=>{issued.payload={...issued.payload,warehouseLocations:[{...location,factoryId:'foreign'}]}},()=>{source.material!.materialSku='other-fabric'},()=>{issued.payload={...issued.payload,sourceInboundEventIds:['missing']}}]){const input=structuredClone([source,issued]);mutation();assert.equal(ready([source,issued]).quantity,0);Object.assign(source,input[0]);Object.assign(issued,input[1])}
})

test('C01.07: ambiguous original units or missing return locations do not become usable allocation',()=>{
 const incoming=event('in','中转仓接收',180,'米'),issue=event('issue','待加工仓加工接收',180,'yard')
 assert.equal(ready([incoming,issue]).quantity,0)
 incoming.inventoryEffect!.unit='yard'
 const returned=event('returned','待加工仓回收入仓',10);returned.payload={sourceIssueEventId:'issue',warehouseLocations:[]}
 assert.equal(ready([incoming,issue,returned]).quantity,0)
})
