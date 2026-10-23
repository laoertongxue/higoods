import assert from 'node:assert/strict'
import test from 'node:test'
import { getPrintingDocumentCompletion, completePrintWorkOrderDocument, resetPrintingWorkOrderBusinessStore } from '../../src/data/fcs/printing-task-domain.ts'
import { readFactoryPdaExecutionUsers } from '../../src/data/fcs/store-domain-pda.ts'

test('printing completion cannot be offered before real output, handout and downstream receipt',()=>{
 resetPrintingWorkOrderBusinessStore()
 const state=getPrintingDocumentCompletion('PWO-PRINT-001')
 assert.equal(state.ready,false)
 assert.equal(state.outputQty,0)
 assert.equal(state.handedQty,0)
 assert.equal(state.receivedQty,0)
 assert.throws(()=>completePrintWorkOrderDocument('PWO-PRINT-001',{operatorName:'QA actual finisher'}),/尚未全部接收/)
})

test('a Central completion requires its actual account and name, even before the quantity prerequisite',()=>{
 resetPrintingWorkOrderBusinessStore()
 const actor=readFactoryPdaExecutionUsers('F090').find(u=>u.roleId==='ROLE_OPERATOR')!
 for(const bad of [{...actor,name:'COPIED NAME'},{...actor,factoryId:'FOREIGN'},{...actor,userId:'NONEXISTENT'}])assert.throws(()=>completePrintWorkOrderDocument('PWO-PRINT-001',{operatorName:bad.name},bad),/PRINT_wrongActor/)
 assert.throws(()=>completePrintWorkOrderDocument('PWO-PRINT-001',{operatorName:'COPIED NAME'},actor),/PRINT_wrongActor/)
})
