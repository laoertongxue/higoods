import test from 'node:test'
import assert from 'node:assert/strict'
import {productionOrders,initialProductionOrderIds} from '../../src/data/fcs/production-orders.ts'
import {getProductionOrderTechPackSnapshot} from '../../src/data/fcs/production-order-tech-pack-runtime.ts'
import {listActiveProcessCraftDefinitions} from '../../src/data/fcs/process-craft-dict.ts'
import {getDictionaryCraftMockSource,DICTIONARY_CRAFT_MOCKS_PER_DEFINITION} from '../../src/data/fcs/production-artifact-generation.ts'
test('craft source selection preserves all previous source choices and isolated snapshots',()=>{
 // 后道专用生产来源保留完整技术包，但不得改变此前通用工艺样本的分配顺序。
 const dedicatedQcOrders=productionOrders.filter(order=>order.productionOrderNo.startsWith('PO-QC-'))
 assert.equal(dedicatedQcOrders.length,3)
 assert(dedicatedQcOrders.every(order=>order.techPackSnapshot))
 const eligible=productionOrders.filter(order=>!dedicatedQcOrders.includes(order)&&order.techPackSnapshot&&initialProductionOrderIds.has(order.productionOrderId)&&order.taskBreakdownSummary.isBrokenDown&&!['DRAFT','READY_FOR_BREAKDOWN'].includes(order.status))
 listActiveProcessCraftDefinitions().forEach((definition,index)=>{
   for(let sample=0;sample<DICTIONARY_CRAFT_MOCKS_PER_DEFINITION;sample++){
    const actual=getDictionaryCraftMockSource(definition.craftCode,sample),expected=eligible[(index*DICTIONARY_CRAFT_MOCKS_PER_DEFINITION+sample)%eligible.length]
    assert.equal(actual?.order.productionOrderId,expected.productionOrderId)
    assert(!dedicatedQcOrders.includes(actual!.order))
    assert.deepEqual(actual?.snapshot,getProductionOrderTechPackSnapshot(expected.productionOrderId))
    assert.notEqual(actual?.snapshot,expected.techPackSnapshot)
   }
 })
 assert.equal(getDictionaryCraftMockSource('NONEXISTENT',0),null)
})
test('source eligibility is re-evaluated after a source order changes',()=>{
 const def=listActiveProcessCraftDefinitions()[0],first=getDictionaryCraftMockSource(def.craftCode,0)!,original=first.order.status
 try{first.order.status='DRAFT';assert.notEqual(getDictionaryCraftMockSource(def.craftCode,0)?.order.productionOrderId,first.order.productionOrderId)}finally{first.order.status=original}
})
