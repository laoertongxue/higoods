// E2E-013: closed preparation must not advance unfinished records.
import assert from 'node:assert/strict'
import * as prep from '../src/data/fcs/cutting/production-material-prep.ts'
for (const stage of ['DRAFT', 'PICKED', 'STAGED'] as const) {
  const memory = new Map<string, string>()
  const storage = { getItem: (k: string) => memory.get(k) ?? null, setItem: (k: string, v: string) => { memory.set(k, v) }, removeItem: (k: string) => { memory.delete(k) } }
  const projection = prep.listMaterialPrepOrderProjections(storage).find(p => !p.order.isClosed && p.lines.some(l => l.maxPrepQty > 2))!
  const line = projection.lines.find(l => l.maxPrepQty > 2)!
  const record = prep.appendManualPrepRecord({ prepOrderId: projection.order.prepOrderId, prepLineId: line.prepLineId, preparedQty: 1, rollCount: 0, operatorName: 'Budi', remark: '', warehouseArea: '', locationCode: '' }, storage)
  if (stage !== 'DRAFT') prep.pickMaterialPrepRecord(record.prepRecordId, 'Agus', storage)
  if (stage === 'STAGED') prep.stageMaterialPrepRecord(record.prepRecordId, '暂存区', 'Siti', storage)
  prep.closeMaterialPrepOrder(record.prepOrderId, '剩余不再配料', '主管 Budi', storage)
  const before = JSON.stringify([...memory])
  assert.equal(prep.pickMaterialPrepRecord(record.prepRecordId, 'Agus', storage), null)
  assert.equal(prep.stageMaterialPrepRecord(record.prepRecordId, '暂存区', 'Siti', storage), null)
  assert.equal(prep.confirmMaterialPrepRecord(record.prepRecordId, 'Dewi', storage), null)
  assert.equal(JSON.stringify([...memory]), before, `${stage} closed order must not write stock/status/events`)
}
console.log('PASS closed DRAFT/PICKED/STAGED cannot advance or write inventory/events')
