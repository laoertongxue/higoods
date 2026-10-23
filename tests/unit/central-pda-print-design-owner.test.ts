import assert from 'node:assert/strict'
import test from 'node:test'
import { centralPrintInputReady } from '../../src/pages/central-pda/print-model.ts'
import type { CentralPrintFact } from '../../src/pages/central-pda/print-model.ts'
import { configureDesignRevisionPcsStorage, getDesignRevisionLedgerGuard, PCS_FCS_COLLECTIONS } from '../../src/data/fcs/design-revision-pcs-storage.ts'

test('washing judgment guards the exact existing PCS row and its current version without adopting or writing a copy',()=>{
 const identity='PWO/DR/%01',id=PCS_FCS_COLLECTIONS[1]+'/items/'+encodeURIComponent('state.workOrders/'+encodeURIComponent(identity))
 let version:number|undefined=7,writes=0
 configureDesignRevisionPcsStorage({getItem:()=>null,setItem:()=>{writes++},isStaging:()=>false,getRecordVersion:recordId=>recordId===id?version:undefined})
 assert.deepEqual(getDesignRevisionLedgerGuard('higoods.formal-print-execution.v1','state.workOrders',identity),{id,expectedVersion:7})
 assert.equal(getDesignRevisionLedgerGuard('higoods.formal-print-execution.v1','state.workOrders','OTHER'),undefined)
 assert.equal(getDesignRevisionLedgerGuard('UNKNOWN','state.workOrders',identity),undefined)
 version=8
 assert.deepEqual(getDesignRevisionLedgerGuard('higoods.formal-print-execution.v1','state.workOrders',identity),{id,expectedVersion:8})
 version=undefined
 assert.equal(getDesignRevisionLedgerGuard('higoods.formal-print-execution.v1','state.workOrders',identity),undefined)
 assert.equal(writes,0)
})


test('Central input follows the current design-revision acceptance prerequisite without adding a commercial acceptance action',()=>{
 const fact=(sourceType:string,acceptanceStatus:string)=>({raw:{sourceType,acceptanceStatus}} as Pick<CentralPrintFact,'raw'>)
 assert.equal(centralPrintInputReady(fact('DESIGN_REVISION','PENDING')),false)
 assert.equal(centralPrintInputReady(fact('DESIGN_REVISION','REJECTED')),false)
 assert.equal(centralPrintInputReady(fact('DESIGN_REVISION','ACCEPTED')),true)
 for(const sourceType of ['PRODUCTION_ORDER','STOCK','PRODUCTION_DEMAND','CUT_PIECE_SUPPLEMENT'])assert.equal(centralPrintInputReady(fact(sourceType,'PENDING')),true)
})
