import assert from 'node:assert/strict'
import test from 'node:test'

test('BOM failed persistence preserves saved and in-memory state; retry persists', async () => {
  const values = new Map<string,string>()
  let blocked = false
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(key:string)=>values.get(key)??null,
    setItem:(key:string,value:string)=>{if(blocked)throw new DOMException('quota','QuotaExceededError');values.set(key,value)},
    removeItem:(key:string)=>values.delete(key),
  }})
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
  const storage=globalThis.localStorage
  const previous=storage.setItem
  let writes=0
  storage.setItem=()=>{writes++;throw new DOMException('quota','QuotaExceededError')}
  try {
    vm.ensureEngineeringMasterDemoData()
    assert.deepEqual(repo.listEngineeringMasterOrders(),before)
    assert.equal(writes,0)
  } finally {storage.setItem=previous}
})
