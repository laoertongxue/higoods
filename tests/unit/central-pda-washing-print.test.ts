import assert from 'node:assert/strict'
import test from 'node:test'
import { renderWashingPrintDocument, renderWashingPrintPreview } from '../../src/pages/central-pda/washing-print.ts'
import type { WashingOrder } from '../../src/data/fcs/fabric-washing-model.ts'
const order:WashingOrder={id:'WASH-1',no:'WS-PRINT-1',createdAt:'2026-10-21T08:00:00+07:00',createdBy:'Actual creator',assignedFactoryId:'ID-F003',assignedFactoryName:'GTG',acceptance:'NOT_REQUIRED',revision:4,handFeel:'柔软手感',rollIds:['R1','R2'],source:{objectType:'FABRIC',id:'PRINT-1/BATCH-1',printOrderId:'PRINT-1',printOrderNo:'YH-1',batchId:'BATCH-1',sourceType:'PRODUCTION',sourceNo:'PO-1',factoryId:'F090',factoryName:'原印花厂',materialSku:'FAB-P200-BLUE-FLORAL',materialName:'蓝白碎花棉府绸',imageUrl:'/materials/fei-ticket/blue-white-print-cotton.png',revision:'V1',actualCompleted:true,target:{id:'F090',name:'原工厂',factoryId:'F090'},rolls:[]},rolls:[{id:'R1',sourceRollId:'R1',barcode:'ORIGINAL-1',inputQty:50,receivedQty:49.5,outputQty:49.75,outputBarcode:'REPACK-1',unit:'Yard',completedAt:'actual'},{id:'R2',sourceRollId:'R2',barcode:'ORIGINAL-2',inputQty:40,unit:'米'}]}

test('washing preview includes the whole native PRINT scope and real Code 128 identities without a desktop table',()=>{
 const before=structuredClone(order),html=renderWashingPrintPreview(order,'id')
 assert.ok(!html.includes('<table'))
 assert.ok(html.includes('data-barcode-value="REPACK-1"'));assert.ok(html.includes('data-barcode-value="ORIGINAL-2"'))
 assert.ok(html.includes('ORIGINAL-1'));assert.ok(html.includes('49,75 Yard'));assert.ok(html.includes('40 m'))
 assert.ok(html.includes('disabled'));assert.ok(html.includes('washing-print-browser'))
 assert.deepEqual(order,before)
})

test('A4 paper retains all rolls, original quantities, real material picture, target and no fabricated unreceived amounts',()=>{
 for(const language of ['zh','id']as const){const html=renderWashingPrintDocument(order,language)
  assert.ok(html.includes('@page{size:A4'))
  assert.equal((html.match(/data-central-washing-paper-roll=/g)||[]).length,2)
  assert.ok(html.includes(order.source.imageUrl));assert.ok(html.includes(order.source.materialSku));assert.ok(html.includes('PO-1'));assert.ok(html.includes('YH-1'))
  assert.ok(html.includes('REPACK-1'));assert.ok(html.includes('ORIGINAL-1'));assert.ok(html.includes('ORIGINAL-2'));assert.ok(html.includes('—'))
 }
 assert.ok(renderWashingPrintDocument(order,'id').includes('49,75 Yard'))
 assert.ok(renderWashingPrintDocument(order,'zh').includes('49.75 Yard'))
})

test('unsupported machine barcode cannot be represented by an invented barcode or silently shortened identity',()=>{
 const changed=structuredClone(order);changed.rolls[0].outputBarcode='不支持的卷码'
 assert.throws(()=>renderWashingPrintPreview(changed,'id'),/Code 128/)
 assert.throws(()=>renderWashingPrintDocument(changed,'id'),/Code 128/)
 assert.equal(changed.rolls[0].outputBarcode,'不支持的卷码')
})

// Original Web documents retain stopped/cancelled/completed order facts.
test('print preview and paper retain the current blocked, cancelled or completed state',()=>{
 for(const language of ['zh','id']as const){
  for(const [state,label]of [[{exception:'Actual source check'},language==='id'?'Belum dapat diproses':'当前不可操作'],[{cancelledAt:'actual'},language==='id'?'Dibatalkan':'已作废'],[{completedAt:'actual'},language==='id'?'Order selesai':'已完单']]as const){
   const changed={...order,...state};assert.ok(renderWashingPrintPreview(changed,language).includes(label));assert.ok(renderWashingPrintDocument(changed,language).includes(label))
  }
 }
 assert.ok(renderWashingPrintDocument({...order,exception:'Actual source check'},'id').includes('Actual source check'))
})
