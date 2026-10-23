import assert from 'node:assert/strict'
import test from 'node:test'
import { centralLedgerRecordId, isCentralExecutionRecordTarget, replaceCentralExecutionRecordSnapshot, SPECIAL_CRAFT_LEDGER_RECORDS } from '../../src/data/fcs/central-execution-record-bridge.ts'

for (const [legacyKey, identity] of [
  ['higoods.formal-dye-execution.v1', { dyeOrderId: 'DYE-ADOPTED' }],
  ['higoods.formal-water-execution.v1', { waterOrderId: 'WATER-ADOPTED' }],
] as const) {
  test(`adopted ${legacyKey} keeps Web dispatch and recipient writes in its original common transaction`, () => {
    const row = { legacyKey, path: 'orders', key: Object.values(identity)[0], tuple: false, value: {
      ...identity, taskId: 'TASK-ADOPTED', factoryId: 'FACTORY-REFERENCE',
      dispatchDocuments: [{ id: 'DISPATCH-ADOPTED', operator: 'PERSON-REFERENCE', lines: [{ handoverRecordId: 'HDR-ADOPTED', orderId: 'ORDER-REFERENCE' }] }],
    } }
    replaceCentralExecutionRecordSnapshot([{ id: centralLedgerRecordId(legacyKey, row), collection: SPECIAL_CRAFT_LEDGER_RECORDS, version: 1, value: row }])
    try {
      for (const target of [Object.values(identity)[0], 'TASK-ADOPTED', 'DISPATCH-ADOPTED', 'HDR-ADOPTED']) assert.equal(isCentralExecutionRecordTarget({ target }), true, target)
      for (const target of ['FACTORY-REFERENCE', 'PERSON-REFERENCE', 'ORDER-REFERENCE', 'DISPATCH-FOREIGN']) assert.equal(isCentralExecutionRecordTarget({ target }), false, target)
    } finally { replaceCentralExecutionRecordSnapshot([]) }
  })
}

test('adopted printing owns its nested physical dispatch and actual handover, not reference fields',()=>{
 const legacyKey='higoods.formal-print-execution.v1',row={legacyKey,path:'state.workOrders',key:'PWO-ADOPTED',tuple:true,value:{printOrderId:'PWO-ADOPTED',taskId:'PRINT-TASK-ADOPTED',printFactoryId:'FACTORY-REFERENCE',businessView:{dispatchDocuments:[{id:'SJ-PRINT-ADOPTED',createdBy:'PERSON-REFERENCE',lines:[{workOrderId:'ORDER-REFERENCE'}]}],barcodes:[{id:'ROLL-REFERENCE',handoverRecordId:'HDR-PRINT-ADOPTED'}]}}}
 replaceCentralExecutionRecordSnapshot([{id:centralLedgerRecordId(legacyKey,row),collection:SPECIAL_CRAFT_LEDGER_RECORDS,version:1,value:row}])
 try{for(const target of ['PWO-ADOPTED','PRINT-TASK-ADOPTED','SJ-PRINT-ADOPTED','HDR-PRINT-ADOPTED'])assert.equal(isCentralExecutionRecordTarget(target),true,target)
 for(const target of ['FACTORY-REFERENCE','PERSON-REFERENCE','ORDER-REFERENCE','ROLL-REFERENCE','SJ-PRINT-FOREIGN'])assert.equal(isCentralExecutionRecordTarget(target),false,target)
 }finally{replaceCentralExecutionRecordSnapshot([])}
})
