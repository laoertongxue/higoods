import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { splitFactoryProcessLedger, rebuildFactoryProcessLedger } from '../../src/data/fcs/factory-process-storage.ts'

const specs = [
  ['dyeing-task-domain.ts','DYE_EXECUTION_STORAGE_KEY','dyeExecutionSnapshot','saveFormalDyeExecution'],
  ['printing-task-domain.ts','PRINT_EXECUTION_STORAGE_KEY','printExecutionSnapshot','saveFormalPrintExecution'],
  ['pda-handover-events.ts','FORMAL_HANDOUT_STORAGE_KEY','formalHandoutSnapshot','persistPdaHandoverState'],
]
for (const [file, key, builder, save] of specs) test(`${file}: read baseline and save share the exact serializer without writing during capture`, () => {
  const ast=ts.createSourceFile(file,readFileSync(new URL('../../src/data/fcs/'+file,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true)
  const fn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===builder)
  assert.ok(fn, 'read-only exact serializer is required')
  assert.doesNotMatch(fn.getText(ast), /setItem\(|removeItem\(/)
  const registration=ast.statements.find(n=>ts.isExpressionStatement(n)&&ts.isCallExpression(n.expression)&&n.expression.expression.getText(ast)==='registerFactoryProcessSnapshot'&&n.expression.arguments[0]?.getText(ast)===key)
  assert.ok(registration)
  const calls:string[]=[], registerCode=ts.transpileModule(registration.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  let read!:()=>string
  new Function(key,builder,'registerFactoryProcessSnapshot',registerCode)('KEY',()=>{calls.push('snapshot');return 'current-unchanged-and-changed'},(_key:string,callback:()=>string)=>{read=callback})
  assert.equal(read(),'current-unchanged-and-changed');assert.deepEqual(calls,['snapshot'])
  const saveFn=ast.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===save)!
  assert.match(saveFn.getText(ast),new RegExp(builder+'\\('),'save uses the same format instead of a broader/different view')
})

test('the actual command write hook stages only changed rows, preserving unchanged defaults and necessary source adoption', () => {
  const file='factory-qc-records.ts', ast=ts.createSourceFile(file,readFileSync(new URL('../../src/data/fcs/'+file,import.meta.url),'utf8'),ts.ScriptTarget.Latest,true)
  const registration=ast.statements.find(n=>ts.isExpressionStatement(n)&&ts.isCallExpression(n.expression)&&n.expression.expression.getText(ast)==='registerFactoryProcessStorage')!
  const compiled=ts.transpileModule(registration.getText(ast),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
  const key='dye', unchanged={dyeOrderId:'DWO-AUTO-1',sourceSnapshot:{professionalResultAttachments:[{dataUrl:'pcs-file:missing-unrelated'}]}}, order={dyeOrderId:'DWO-13',outputRolls:[{id:'R1',qty:0}]}
  const raw=JSON.stringify({version:1,state:{workOrders:[['DWO-AUTO-1',unchanged],['DWO-13',order]],nodeRecords:[]},tasks:[]})
  const baseline=new Map([[key,raw]]), staged=new Map(), records=new Map(), rawStage=new Map();let bridge:any
  const deps={PROCESS_COLLECTION:'process',FACTORY_PROCESS_KEYS:[key],baseline,staged,records,rawStage,recipeActive:true,processRows:()=>[],processId:(_key:string,row:any)=>row.path+'/'+row.key,splitFactoryProcessLedger,rebuildFactoryProcessLedger,registerFactoryProcessStorage:(value:any)=>{bridge=value}}
  new Function('deps',`with(deps){${compiled}}`)(deps)
  bridge.write(key,JSON.stringify({version:1,state:{workOrders:[['DWO-AUTO-1',unchanged],['DWO-13',{...order,outputRolls:[{id:'R1',qty:58.75}]}]],nodeRecords:[]},tasks:[]}),null)
  assert.deepEqual([...staged.keys()],['state.workOrders/DWO-13'])
  assert.equal(staged.get('state.workOrders/DWO-13').value.value.outputRolls[0].qty,58.75)
  assert.equal(rawStage.size,1)
})

test('a first bounded dye save reconstructs every required empty state section, without adopting unrelated vat or formula records', () => {
  const source = JSON.stringify({ version:1, state:{ workOrders:[['DWO-13',{dyeOrderId:'DWO-13',status:'WAIT_HANDOVER'}]],nodeRecords:[['DWO-13',[{nodeCode:'PACK',finishedAt:'2026-10-22'}]]],reviewRecords:[],vatSchedules:[],formulas:[] },tasks:[{taskId:'TASK-13'}] })
  const read = JSON.parse(rebuildFactoryProcessLedger(null, splitFactoryProcessLedger(source))!)
  assert.deepEqual(Object.keys(read.state).sort(), ['workOrders','nodeRecords','reviewRecords','vatSchedules','formulas'].sort())
  assert.deepEqual(read.state.vatSchedules,[]);assert.deepEqual(read.state.formulas,[])
  assert.equal(read.state.workOrders[0][1].status,'WAIT_HANDOVER')
})
