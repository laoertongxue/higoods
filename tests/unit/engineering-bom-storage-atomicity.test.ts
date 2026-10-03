import { pcsRecordStore } from '../../src/data/pcs-record-runtime.ts'
import assert from 'node:assert/strict'
import test from 'node:test'

test('BOM working-copy write failure preserves prior state; retry succeeds', async () => {
  const values = new Map<string,string>()
  let blocked = false
  Object.assign(pcsRecordStore, {
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>{if(blocked)throw new DOMException('quota','QuotaExceededError');values.set(key,value)},
    removeItem:(key:string)=>values.delete(key),
  })
  const bom = await import('../../src/data/pcs-engineering-bom-repository.ts')
  const before = bom.captureEngineeringBomRepositoryState()
  const next = {...before, plans: [{ownerId:'test',customCosts:[]} as any]}
  blocked=true
  assert.throws(()=>bom.restoreEngineeringBomRepositoryState(next),/quota/)
  assert.deepEqual(bom.captureEngineeringBomRepositoryState(),before)
  assert.equal(values.has('higood-pcs-engineering-bom-pricing-plan-store-v2'),false)
  blocked=false
  bom.restoreEngineeringBomRepositoryState(before)
  assert.deepEqual(JSON.parse(values.get('higood-pcs-engineering-bom-pricing-plan-store-v2')!),before)
})

test('existing production preparation data does not trigger demo writes on entry', async () => {
  const vm = await import('../../src/data/pcs-engineering-master-view-model.ts')
  const repo = await import('../../src/data/pcs-engineering-master-repository.ts')
  vm.ensureEngineeringMasterDemoData(1)
  const before=repo.listEngineeringMasterOrders()
  assert.ok(before.length)
  const storage=pcsRecordStore
  const previous=storage.setItem
  let writes=0
  storage.setItem=()=>{writes++;throw new DOMException('quota','QuotaExceededError')}
  try {
    vm.ensureEngineeringMasterDemoData()
    assert.deepEqual(repo.listEngineeringMasterOrders(),before)
    assert.equal(writes,0)
  } finally {storage.setItem=previous}
})

test('rollback of an unchanged saved BOM does not perform another failing write',async()=>{
 const bom=await import('../../src/data/pcs-engineering-bom-repository.ts')
 const before=bom.captureEngineeringBomRepositoryState()
 const previous=pcsRecordStore.setItem
 pcsRecordStore.setItem=()=>{throw new DOMException('quota','QuotaExceededError')}
 try {
  assert.throws(()=>bom.restoreEngineeringBomRepositoryState({...before,plans:[...before.plans,{ownerId:'blocked',customCosts:[]} as any]}),/quota/)
  assert.doesNotThrow(()=>bom.restoreEngineeringBomRepositoryState(before))
  assert.deepEqual(bom.captureEngineeringBomRepositoryState(),before)
 }finally{pcsRecordStore.setItem=previous}
})
