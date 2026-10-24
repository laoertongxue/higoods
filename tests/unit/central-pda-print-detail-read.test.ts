import assert from 'node:assert/strict'
import test from 'node:test'
import { listCentralPrintFacts, centralPrintFact, centralPrintIncoming } from '../../src/pages/central-pda/print-model.ts'
test('current-order read preserves every actual Web fact, native unit and central factory boundary',()=>{
 const all=listCentralPrintFacts()
 assert.equal(all.length,17)
 for(const fact of all){assert.deepEqual(centralPrintFact(fact.order.workOrderId,fact.order.printFactoryId),fact);assert.equal(centralPrintFact(fact.order.workOrderId,'FACTORY-FOREIGN'),undefined)}
 assert.equal(centralPrintFact('','F090'),undefined)
 assert.equal(centralPrintFact('PRINT-FOREIGN','F090'),undefined)
})
test('scoped incoming retains the exact physical source rows and rejects another factory',()=>{
 const all=centralPrintIncoming('F090'),ids=[...new Set(all.map(row=>row.orderId))]
 for(const id of ids)assert.deepEqual(centralPrintIncoming('F090',id),all.filter(row=>row.orderId===id))
 assert.deepEqual(centralPrintIncoming('FACTORY-FOREIGN','PWO-PRINT-001'),[])
})
