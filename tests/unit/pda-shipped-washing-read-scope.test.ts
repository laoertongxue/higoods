import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync}from'node:fs'
import ts from'typescript'
function methods(deps:any){
 const text=readFileSync(new URL('../../src/data/fcs/fabric-washing-repository.ts',import.meta.url),'utf8'),file=ts.createSourceFile('washing.ts',text,ts.ScriptTarget.Latest,true)
 const names=['ensureWashingRecords','ensureWashingViewRecords'],parts=file.statements.filter(n=>ts.isFunctionDeclaration(n)&&names.includes(n.name?.text||'')||ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(file)==='bridgeVersions'))
 const js=ts.transpileModule(parts.map(n=>n.getText(file)).join('\n').replaceAll('export ','').replaceAll('import(','loadModule('),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText
 return new Function('deps',`with(deps){${js};return{view:ensureWashingViewRecords,full:ensureWashingRecords}}`)(deps)
}
function setup(){const calls:string[]=[],washing='washing',bridge='process',old={id:bridge+'/B',collection:bridge,version:1,value:{quantity:4}},fresh={...old,version:2,value:{quantity:7}}
 const deps:any={loaded:false,saving:false,records:new Map([[old.id,old]]),blobs:new Map(),migrationReceipts:[],overlayEpoch:0,readFailure:'',WASHING_COLLECTION:washing,WASHING_BRIDGE_COLLECTION:bridge,PCS_FCS_COLLECTIONS:['original-fcs'],hydrateDesignRevisionFcsCaches:()=>calls.push('refresh-process-cache'),readPcsRecords:async keys=>{calls.push('read:'+keys.join(','));return{records:keys.includes(bridge)?[fresh]:[],files:[],migrations:[{id:'original-receipt'}]}},loadModule:async path=>path.includes('pcs-record-runtime')?{ensurePcsRecordState:async()=>calls.push('pcs')}:{hydratePostFinishingProductionContextRecords:async()=>calls.push('seven-sources'),hydrateProductionContextRecords:async()=>calls.push('complete-writer-source')}}
 return{deps,calls,api:methods(deps)}
}
test('共享已交出只读同时恢复洗水实交桥和实际版本；不把七类来源当完整写入准备',async()=>{const f=setup();await f.api.view(true);assert.deepEqual(f.calls,['pcs','seven-sources','read:washing,process','refresh-process-cache']);assert.equal(f.deps.records.get('process/B').value.quantity,7);assert.equal(f.deps.loaded,false);assert.deepEqual(f.deps.migrationReceipts,[{id:'original-receipt'}]);await f.api.full();assert.ok(f.calls.includes('complete-writer-source'));assert.equal(f.deps.loaded,true);assert.equal(f.deps.records.get('process/B').value.quantity,7)})
test('已有普通历史只读入口保留原范围；实际完整准备及错误阻断保持',async()=>{const f=setup();await f.api.view();assert.deepEqual(f.calls,['read:washing']);assert.equal(f.deps.records.get('process/B').value.quantity,4);f.deps.readPcsRecords=async()=>{throw Error('original read failure')};const before=f.deps.records;await assert.rejects(f.api.view(true),/original read failure/);assert.equal(f.deps.records,before);assert.equal(f.deps.loaded,false);assert.match(f.deps.readFailure,/original read failure/);f.deps.saving=true;await assert.rejects(f.api.view(true),/上一笔洗水动作尚未保存/)})
