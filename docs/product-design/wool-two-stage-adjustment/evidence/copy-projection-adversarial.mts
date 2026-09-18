import assert from 'node:assert/strict'
const root = '/Users/laoer/Documents/higoods/.worktrees/work-20260918'
await import(root + '/scripts/check-wool-craft-warehouse.ts')
const { buildWoolCraftWarehouseProjection } = await import(root + '/src/data/fcs/wool-domain/craft-warehouse.ts')
const warehouse = await import(root + '/src/data/fcs/factory-internal-warehouse.ts')
const wool = await import(root + '/src/data/fcs/wool-domain/store.ts')
const first = buildWoolCraftWarehouseProjection()
const second = buildWoolCraftWarehouseProjection()
const seen = new Map<object, string>()
let count = 0
function inspect(value: unknown, path: string): void {
  if (!value || typeof value !== 'object') return
  assert(!seen.has(value), `shared mutable reference ${path} with ${seen.get(value)}`)
  assert(!Object.isFrozen(value), `returned object frozen: ${path}`)
  seen.set(value, path); count++
  if (value instanceof Set) { for (const item of value) assert.equal(typeof item, 'string'); return }
  if (Array.isArray(value)) value.forEach((item, index) => inspect(item, `${path}[${index}]`))
  else for (const [key, item] of Object.entries(value)) inspect(item, `${path}.${key}`)
}
inspect(first, 'first'); inspect(second, 'second')
assert.deepEqual(first, second)
const references = Object.fromEntries(Object.entries(first).map(([key, value]) => [key, Array.isArray(value) ? value.length : value.size]))
assert(Object.values(references).every(count => count > 0))
const scalarAndArrays = (rows: any[], names: string[]) => rows.forEach(row => Object.entries(row).forEach(([key, value]) => { if (value && typeof value === 'object') { assert(names.includes(key), `unhandled nested field ${key}`); assert(Array.isArray(value)); assert(value.every(item => typeof item === 'string')) } }))
for (const key of ['waitProcessStockItems','waitHandoverStockItems','inboundRecords','outboundRecords'] as const) scalarAndArrays(first[key], ['photoList'])
scalarAndArrays(first.warehouseRecords, ['relatedFeiTicketIds','relatedHandoverRecordIds','relatedReviewRecordIds'])
scalarAndArrays(first.handoverRecords, ['evidenceUrls','relatedFeiTicketIds'])
const original = wool.readWoolStore()
const saved = warehouse.createFactoryInternalWarehouseMutationSnapshot()
for (const row of first.inboundRecords) { delete (row as any).factoryId; (row as any).extra = {mutated:true}; row.photoList.length=0 }
first.warehouseRecords[0].relatedHandoverRecordIds.push('independent-mutation')
first.genericPieceInboundIds.clear()
assert.deepEqual(buildWoolCraftWarehouseProjection(), second)
assert.deepEqual(wool.readWoolStore(), original)
assert.deepEqual(warehouse.createFactoryInternalWarehouseMutationSnapshot(), saved)
console.log('INDEPENDENT PASS: all 8 collections populated; '+count+' recursively inspected objects/arrays/sets independent and mutable across both returns; exact nested-field whitelist matches every generated row; caller delete/add/array/set mutation cannot change facts or warehouse snapshot.')
console.log(JSON.stringify(references))
