import assert from 'node:assert/strict'
import test from 'node:test'
import { centralWaterWarehouse } from '../../src/pages/central-pda/water-warehouse-model.ts'
import { renderCentralWaterWarehouse } from '../../src/pages/central-pda/water-warehouse-view.ts'

test('C06.16: empty receiving and handover histories each have one empty state without order-detail selectors',()=>{
  for(const view of ['receiveRecords','handoffRecords'] as const){
    const html=renderCentralWaterWarehouse('F090',{view,kind:'WAIT_PROCESS',location:'',limit:15},'id')
    assert.equal((html.match(/Belum ada catatan/g)||[]).length,1)
    assert.doesNotMatch(html,/<select|data-central-water-field="receiptScope"|water-work-save|water-save-receipt|water-send/)
    assert.doesNotMatch(html,/[\u3400-\u9fff]/)
  }
})

test('C06.16: missing or foreign factory cannot expose another factory locations or balances',()=>{
  for(const factory of ['', 'NOT-A-FACTORY']){
    const data=centralWaterWarehouse(factory)
    assert.deepEqual(data.incoming,[]);assert.deepEqual(data.outgoing,[]);assert.deepEqual(data.stock,[]);assert.deepEqual(data.outputs,[]);assert.deepEqual(data.warehouses,[])
  }
})

test('C06.16: recorded output rolls retain actual identity and do not acquire a fabricated location',()=>{
  const data=centralWaterWarehouse('F090'),output=data.outputs.find(row=>row.fact.order.waterOrderId==='WATER-OUTPUT-DEMO-4')!
  assert.deepEqual(output.rolls.map(roll=>[roll.id,roll.qty]),[['WATER-OUTPUT-DEMO-4-R1',80],['WATER-OUTPUT-DEMO-4-R2',80]])
  assert.equal(output.unregistered,0)
  const html=renderCentralWaterWarehouse('F090',{view:'locations',kind:'WAIT_HANDOVER',location:'',limit:15},'id')
  assert.match(html,/Lokasi belum tercatat/);assert.match(html,/SRJG-20260914-DEMO-004_0001/)
  assert.doesNotMatch(html,/data-central-action="(?:water-roll-send|water-save-roll|water-print)"/)
})
