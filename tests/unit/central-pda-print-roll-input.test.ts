import assert from 'node:assert/strict'
import test from 'node:test'
import { printRollInput, initialPrintRollFields } from '../../src/pages/central-pda/print-roll-ui.ts'
import type { CentralPrintRoll } from '../../src/pages/central-pda/print-output-model.ts'
import { renderPrintOutputPanel, type PrintOutputUi } from '../../src/pages/central-pda/print-output-view.ts'
import { printError } from '../../src/pages/central-pda/print-ui.ts'
const roll={id:'ROLL',barcode:'PH0001',lengthY:8,meters:7.32,weightKg:2.342,weightSource:'THEORETICAL',quantityConfirmed:true,gsm:200,widthCm:160,vatNo:'B01',warehouseName:'Original warehouse',remark:''} as CentralPrintRoll
const fabric={objectType:'面料',qtyUnit:'Yard'}
test('printed fabric keeps its original unit, original warehouse and theory/actual weight distinction',()=>{
 const fields=initialPrintRollFields(roll,'id');fields.quantity='6,5'
 const input=printRollInput(fabric,roll,fields,8,'id')
 assert.equal(input.lengthY,6.5);assert.equal(input.weightKg,undefined);assert.equal(input.weightMeasured,false);assert.equal(input.warehouseName,roll.warehouseName)
 fields.weightMode='ACTUAL';fields.weight='1,234';assert.equal(printRollInput(fabric,roll,fields,8,'id').weightKg,1.234)
})
test('meter measurements use the original Yard conversion; kg preserves three decimal places without becoming length',()=>{
 const fields=initialPrintRollFields(roll,'id');fields.measure='METERS';fields.quantity='7,32'
 const meters=printRollInput(fabric,roll,fields,8,'id');assert.equal(meters.lengthY,undefined);assert.equal(meters.meters,7.32)
 fields.measure='NATIVE';fields.quantity='1,234';const kg=printRollInput({objectType:'纱线',qtyUnit:'kg'},roll,fields,2,'id')
 assert.equal(kg.weightKg,1.234);assert.equal(kg.lengthY,undefined);assert.equal(kg.weightMeasured,true)
})
test('current roll quota includes other stored rolls, and invalid mixed units or separators are rejected',()=>{
 const fields=initialPrintRollFields(roll,'id');fields.quantity='8,02';assert.throws(()=>printRollInput(fabric,roll,fields,8,'id'),/QUANTITY_MAX/)
 fields.quantity='8,01';assert.equal(printRollInput(fabric,roll,fields,8,'id').lengthY,8.01)
 fields.quantity='1.234';assert.throws(()=>printRollInput(fabric,roll,fields,8,'id'))
 fields.quantity='1';fields.measure='METERS';assert.throws(()=>printRollInput({objectType:'成衣',qtyUnit:'件'},roll,fields,8,'id'),/PRINT_rollMeasure/)
})

test('assigning an unbound output roll carries its actual batch without converting its quantity or exposing wrapped technical errors',()=>{
 const fields=initialPrintRollFields(roll,'id');fields.batch='ACTUAL-BATCH-1';fields.quantity='6,25'
 const input=printRollInput(fabric,roll,fields,8,'id')
 assert.equal(input.batchId,'ACTUAL-BATCH-1');assert.equal(input.lengthY,6.25)
 const text=printError(new Error('印花操作未保存，原动作已撤回。PRINT_wrongBatch'),'id')
 assert.doesNotMatch(text,/[\u3400-\u9fff]|PRINT_/);assert.match(text,/lot/i)
})

test('native history with unknown roll quantities has no PDA add-code action',()=>{
 const ui:PrintOutputUi={panel:'list',labelIds:[],labelRevisions:{},printRequested:false,labelReady:false,operationId:'unit-read'}
 const html=renderPrintOutputPanel('PWO-PRINT-007','F090',ui,undefined,'id')
 assert.match(html,/Jumlah kemasan lama belum tercatat/)
 assert.doesNotMatch(html,/data-central-action="print-roll-add"/)
 assert.equal(printError(new Error('历史完成卷数未记录，请先补录历史累计数量，再补充产出卷条码'),'id'),'Jumlah rol lama belum tercatat')
})

test('a completed native order can preview labels but cannot print or change quantities',()=>{
 const ui:PrintOutputUi={panel:'label',labelIds:['ROLL-PH-20260329-008-0001'],labelRevisions:{},printRequested:false,labelReady:false,operationId:'unit-read'}
 const html=renderPrintOutputPanel('PWO-PRINT-008','F090',ui,undefined,'id')
 assert.match(html,/data-central-print-label/)
 assert.doesNotMatch(html,/data-central-action="print-label-print"/)
 assert.doesNotMatch(html,/data-central-print-roll-field=/)
})
