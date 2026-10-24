import test from 'node:test'
import assert from 'node:assert/strict'
import { hydrateProductionContextRecords, saveProductionContextAction, migrateProductionContextRecords } from '../../src/data/fcs/production-context-records.ts'

test('S12.04: overlapping route reads share the current read without opening a second database read',async()=>{
 const snapshot={revision:901,records:[]}
 const first=hydrateProductionContextRecords(snapshot),same=hydrateProductionContextRecords(snapshot),fresh=hydrateProductionContextRecords()
 const results=await Promise.allSettled([first,same,fresh])
 assert.equal(results[0].status,'fulfilled',JSON.stringify(results))
 assert.equal(results[1].status,'fulfilled',JSON.stringify(results))
 assert.equal(results[2].status,'rejected',JSON.stringify(results))
})
test('S12.04: coalesced reads do not weaken a different explicit snapshot or a write/migration lock',async()=>{
 let wrote=false
 const first=hydrateProductionContextRecords({revision:902,records:[]})
 await assert.rejects(hydrateProductionContextRecords({revision:903,records:[]}),/正在保存或迁移/)
 // Hold a new read because awaiting the refusal above may let the first finish.
 await first
 const reading=hydrateProductionContextRecords({revision:904,records:[]})
 const outcomes=await Promise.allSettled([saveProductionContextAction({intent:'S12-READ-MUST-NOT-WRITE',action:()=>{wrote=true},capture:()=>null,restore:()=>{}}),migrateProductionContextRecords({otherPagesClosed:true,progress:()=>{}})])
 assert.ok(outcomes.every(r=>r.status==='rejected'))
 assert.equal(wrote,false)
 await reading
})
test('S12.04: a failed shared read fails all readers and releases its read lock for an explicit recovery',async()=>{
 const bad={revision:905,records:null} as unknown as Parameters<typeof hydrateProductionContextRecords>[0]
 const first=hydrateProductionContextRecords(bad),second=hydrateProductionContextRecords(bad)
 const results=await Promise.allSettled([first,second])
 assert.ok(results.every(r=>r.status==='rejected'))
 if(results[0].status==='rejected'&&results[1].status==='rejected')assert.equal(results[0].reason,results[1].reason)
 await assert.doesNotReject(hydrateProductionContextRecords({revision:906,records:[]}))
})
