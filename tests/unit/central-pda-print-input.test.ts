import assert from 'node:assert/strict'
import test from 'node:test'
import { printProductionInput, printUnit, printUsesRolls, printError, type PrintWorkDraft } from '../../src/pages/central-pda/print-ui.ts'
type Fact=Parameters<typeof printProductionInput>[0]
const fact={stages:{print:9,transfer:8},order:{output:{completedQty:5,completedRollCount:2},actualInput:{usedRollCount:1}}} as Fact
const draft=(raw:string,more:Partial<PrintWorkDraft>={}):PrintWorkDraft=>({raw,count:'1',loss:'',printer:'',revision:'same',operationId:'once',...more})
test('printing deltas become native cumulative amounts without translating native units',()=>{
 assert.deepEqual(printProductionInput(fact,{key:'print-finish',kind:'STAGE',stage:'PRINT',action:'FINISH',max:3},draft('1,5'),'id'),{kind:'STAGE',stage:'PRINT',action:'FINISH',printerNo:undefined,qty:10.5})
 assert.deepEqual(printProductionInput(fact,{key:'transfer-finish',kind:'STAGE',stage:'TRANSFER',action:'FINISH',max:1},draft('1'),'zh'),{kind:'STAGE',stage:'TRANSFER',action:'FINISH',printerNo:undefined,qty:9})
 for(const unit of ['Yard','kg','m'])assert.equal(printUnit(unit,'id'),unit)
 assert.equal(printUnit('米','id'),'m');assert.equal(printUnit('件','id'),'pcs')
})
test('printing output adds actual delta and new rolls, while optional loss is this batch only',()=>{
 assert.deepEqual(printProductionInput(fact,{key:'output',kind:'OUTPUT',max:3},draft('2,5',{count:'2',loss:'0,5'}),'id'),{kind:'OUTPUT',completedQty:7.5,completedRollCount:4,usedRollCount:1,lossQty:0.5,printerNo:undefined})
 assert.equal((printProductionInput(fact,{key:'output',kind:'OUTPUT',max:3},draft('3'),'zh') as {completedQty:number}).completedQty,8)
})
test('printing rejects over-remaining, ambiguous separators and noninteger packages',()=>{
 const choice={key:'output',kind:'OUTPUT' as const,max:3}
 for(const raw of ['3,01','1.000,5','1.5','1e1'])assert.throws(()=>printProductionInput(fact,choice,draft(raw),'id'))
 for(const count of ['0','1,5','-1','9007199254740992'])assert.throws(()=>printProductionInput(fact,choice,draft('1',{count}),'id'))
})

test('native stage completion can explicitly record zero without creating final output',()=>{
 assert.equal((printProductionInput(fact,{key:'print-finish',kind:'STAGE',stage:'PRINT',action:'FINISH',max:3},draft('0'),'zh') as {qty:number}).qty,9)
 assert.throws(()=>printProductionInput(fact,{key:'output',kind:'OUTPUT',max:3},draft('0'),'zh'))
})

test('printing distinguishes actual roll packaging and localizes scan and decimal rejection',()=>{
 assert.equal(printUsesRolls('面料'),true);assert.equal(printUsesRolls('织带'),true);assert.equal(printUsesRolls('成衣'),false)
 assert.match(printError(new Error('PRINT_wrongScan'),'id'),/Pindai ulang/)
 assert.equal(printError(new Error('DYE_invalidQuantity'),'zh'),'核对数量和小数位数')
 assert.match(printError(new Error('QUANTITY_MAX'),'id'),/sisa tersedia/)
})
