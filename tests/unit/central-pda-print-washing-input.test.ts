import assert from 'node:assert/strict'
import test from 'node:test'
import { printWashingCommand, printWashingScan, type PrintWashingDraft, type centralPrintWashing } from '../../src/pages/central-pda/print-washing-model.ts'
import { printWashingError } from '../../src/pages/central-pda/print-washing-view.ts'
type State=NonNullable<ReturnType<typeof centralPrintWashing>>
const state={fact:{closed:false,order:{workOrderId:'PRINT-1',output:{sku:'SKU'},barcodes:[{id:'R1',barcode:'BC1'},{id:'R2',barcode:'BC2'}]}},
 sources:[{id:'S1',printOrderId:'PRINT-1',actualCompleted:true,rolls:[{id:'R1',confirmed:true,qty:6.25,unit:'米',handedOut:false},{id:'R2',confirmed:true,qty:1.75,unit:'米',handedOut:false,blockedReason:'draft'}]}],
 judgments:[],orders:[{id:'W1',source:{printOrderId:'PRINT-1'},rolls:[{id:'R1',barcode:'BC1',inputQty:6.25,unit:'米'},{id:'R2',barcode:'BC2',inputQty:1.75,unit:'米'}]}]} as unknown as State
const draft=():PrintWashingDraft=>({sourceId:'S1',selected:['R1'],decision:'WASH',handFeel:'柔软手感',correct:false,sendOrderId:'W1',scan:'',scans:[],revision:'r',operationId:'op'})
test('washing sends only the actual scanned rolls; wrong QR identity and duplicate scans preserve existing selection',()=>{
 const d=draft();printWashingScan(d,state,'BC1\n');assert.deepEqual(d.scans,['BC1'])
 for(const qr of [{type:'PRINTING_OUTPUT_ROLL',workOrderId:'OTHER',barcodeId:'R2',outputSku:'SKU'},{type:'PRINTING_OUTPUT_ROLL',workOrderId:'PRINT-1',barcodeId:'R2',outputSku:'OTHER'}])assert.throws(()=>printWashingScan(d,state,JSON.stringify(qr)),/PW_wrongScan/)
 assert.throws(()=>printWashingScan(d,state,'BC1'),/PW_duplicate/);assert.deepEqual(d.scans,['BC1'])
 printWashingScan(d,state,JSON.stringify({type:'PRINTING_OUTPUT_ROLL',workOrderId:'PRINT-1',barcodeId:'R2',outputSku:'SKU'}))
 assert.deepEqual(printWashingCommand(d,state),{type:'SEND',orderId:'W1',rollIds:['R1','R2'],scannedCodes:['BC1','BC2']})
 assert.equal(state.orders[0].rolls[0].unit,'米');assert.equal(state.orders[0].rolls[0].inputQty,6.25)
 const sent=structuredClone(state);sent.orders[0].rolls[0].sentAt='2026-10-21T00:00:00Z';assert.throws(()=>printWashingScan(draft(),sent,'BC1'),/PW_alreadySent/)
 assert.throws(()=>printWashingCommand(draft(),state),/PW_scanFirst/)
})
test('judgment keeps the original hand-feel enum and batch identity, with distinct NO_WASH and WASH reservation rules',()=>{
 const d=draft();d.sendOrderId='';const command=printWashingCommand(d,state);assert.equal(command.type,'JUDGE');assert.equal(command.source,state.sources[0]);assert.equal(command.handFeel,'柔软手感')
 d.selected=['R2'];assert.throws(()=>printWashingCommand(d,state),/PW_reserved/)
 d.decision='NO_WASH';assert.equal(printWashingCommand(d,state).handFeel,undefined)
 d.selected=['OTHER'];assert.throws(()=>printWashingCommand(d,state),/PW_changed/)
 assert.doesNotMatch(printWashingError(new Error('来源面料要求或卷版本已变化，请登记异常并由负责人重新核对后恢复。'),'id'),/[\u3400-\u9fff]/)
 assert.match(printWashingError(new Error('PCS 记录已被其他页面修改，请重新读取后再保存。'),'id'),/Muat ulang/)
})
