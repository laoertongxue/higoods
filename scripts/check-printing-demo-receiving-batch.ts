import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
const source=readFileSync('src/data/fcs/printing-task-domain.ts','utf8')
const batched='initializeFactoryReceivingDemoBatch(() => initializePrintingFactoryDemoProgress(pendingDemos))'
async function compile(baseline:boolean){
 const result=await build({stdin:{contents:`import * as printing from './src/data/fcs/printing-task-domain.ts';import * as receiving from './src/data/fcs/factory-receiving.ts';export {printing,receiving}`,resolveDir:process.cwd(),loader:'ts'},define:{'import.meta.url':JSON.stringify('file:///wool-perf-isolated.ts'),'import.meta.hot':'undefined'},bundle:true,platform:'node',format:'iife',globalName:'api',write:false,logLevel:'silent',plugins:[{name:'baseline',setup(b){b.onLoad({filter:/\/printing-task-domain\.ts$/},()=>({contents:baseline?source.replace(batched,'initializePrintingFactoryDemoProgress(pendingDemos)'):source,loader:'ts'}))}}]})
 return result.outputFiles[0].text
}
const fixed=Date.parse('2026-09-18T12:00:00Z')
class FixedDate extends Date{constructor(...args:any[]){super(...(args.length?args:[fixed]) as [number])}static now(){return fixed}}
function runtime(code:string,initial:Record<string,string>={}){
 const values=new Map(Object.entries(initial)), writes:string[]=[];let fail=false
 const key='higood-factory-material-receiving-v1'
 const storage={getItem:(k:string)=>values.get(k)??null,setItem(k:string,v:string){if(fail&&k===key&&JSON.parse(v).sources.filter((s:any)=>s.id.startsWith('DEMO-PRINT-IN-')).length===50){fail=false;throw Error('injected demo commit failure')}values.set(k,v);writes.push(k)},removeItem:(k:string)=>values.delete(k)}
 const context:any={console,Date:FixedDate,structuredClone,localStorage:storage,window:{localStorage:storage,addEventListener(){},location:{pathname:'/fcs/pda/exec',search:''}},document:{addEventListener(){},visibilityState:'visible'}}
 runInNewContext(code,context)
 return {api:context.api,values,writes,fail(){fail=true},key}
}
const plain=(v:any)=>JSON.parse(JSON.stringify(v))
function facts(r:ReturnType<typeof runtime>){return plain({orders:r.api.printing.listPrintingWorkOrders(),dispatch:r.api.printing.listPrintingDispatchDocuments(),receiving:r.api.receiving.captureFactoryReceivingData()})}
const baseline=runtime(await compile(true)), code=await compile(false),current=runtime(code)
const expected=facts(baseline), actual=facts(current)
assert.deepEqual(actual,expected,'batch preserves every order, receipt, use, dispatch and quantity')
assert.equal(actual.orders.filter((o:any)=>o.workOrderId.startsWith('PWO-PRINT-DEMO-')).length,50)
assert(current.writes.filter(k=>k===current.key).length < baseline.writes.filter(k=>k===baseline.key).length,'demo batch must reduce receiving persistence operations')
const reads=current.writes.length
assert.deepEqual(facts(current),actual)
assert.equal(current.writes.length,reads,'repeated reads do not seed again')
const restored=runtime(code,Object.fromEntries(current.values))
assert.deepEqual(facts(restored),actual,'fresh module graph preserves saved facts')
const failed=runtime(code);failed.fail()
assert.throws(()=>facts(failed),/未保存|injected/)
const failedSaved=failed.values.get(failed.key)
assert(!failedSaved || !JSON.parse(failedSaved).sources.some((s:any)=>s.id.startsWith('DEMO-PRINT-IN-')),'failed initialization leaves no partial receipt batch')
assert(!failed.api.receiving.captureFactoryReceivingData().sources.some((s:any)=>s.id.startsWith('DEMO-PRINT-IN-')),'memory rolls back with storage')
console.log('PASS 50 demos equal old commands; fewer writes; repeat/fresh reload; failure restores storage and memory')
