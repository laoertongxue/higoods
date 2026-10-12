import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createHash } from 'node:crypto'
import { checkPcsSimpleBrowserEvidence, PCS_SIMPLE_CONTRACTS, PCS_SIMPLE_REPORTS } from '../../scripts/check-pcs-simple-browser-evidence.ts'
const directory='docs/verification-evidence/2026-10-12-material-classification'
const sha=(value:string)=>createHash('sha256').update(value).digest('hex')
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'pcs-evidence-'))
 const write=(path:string,value:string)=>{mkdirSync(dirname(join(root,path)),{recursive:true});writeFileSync(join(root,path),value)}
 const sources=['src/data/pcs-record-runtime.ts','src/router/route-renderers.ts','src/data/generated/pcs-record-baseline.json','src/pages/pcs-technical-data.ts','src/pages/pcs-materials.ts']
 sources.forEach(path=>write(path,'{}'))
 PCS_SIMPLE_CONTRACTS.forEach(path=>write(path,'// frozen contract'))
 write('dist/index.html','<script src="/assets/main.js"></script>');write('dist/assets/main.js','accepted bundle')
 const acceptance:any={passed:true,viewports:['1366x768','1280x720'],sourceHashes:Object.fromEntries(sources.map(path=>[path,sha('{}')])),browserContractHashes:Object.fromEntries(PCS_SIMPLE_CONTRACTS.map(path=>[path,sha('// frozen contract')])),bundleSHA256:sha('accepted bundle'),indexSHA256:sha('<script src="/assets/main.js"></script>'),reports:{},reportHashes:{},reportBundleHashes:{},totalSamples:PCS_SIMPLE_REPORTS.length*5,maximumMs:100}
 const report=(name:string,change:(report:any)=>void=()=>{})=>{const value:any={formal:true,assetsSha:acceptance.indexSHA256,samples:Array.from({length:5},(_,round)=>({name:'save',round,ms:100})),errors:[]};change(value);const raw=JSON.stringify(value);write(`${directory}/${name}.json`,raw);acceptance.reportHashes[name]=sha(raw)}
 PCS_SIMPLE_REPORTS.forEach(name=>{report(name);acceptance.reports[name]={evidence:`${directory}/${name}.json`,samples:5,maximumMs:100,minimumSamplesPerGroup:5};acceptance.reportBundleHashes[name]=acceptance.bundleSHA256})
 const save=()=>write(`${directory}/acceptance.json`,JSON.stringify(acceptance))
 const reuse=(name:string)=>{acceptance.reportBundleHashes[name]='a'.repeat(64);acceptance.reportReuse??={};acceptance.reportReuse[name]={reason:'Only BOM list implementation changed; this contract does not use it.',unchangedSourcePaths:Object.fromEntries(sources.filter(path=>!['src/pages/pcs-technical-data.ts','src/router/route-renderers.ts'].includes(path)).map(path=>[path,sha('{}')]))}}
 save();return {root,write,acceptance,report,save,reuse,clean:()=>rmSync(root,{recursive:true,force:true})}
}
function verify(run:(f:ReturnType<typeof fixture>)=>void){const f=fixture();try{run(f)}finally{f.clean()}}
test('complete current scope measurements pass',()=>verify(f=>{assert.equal(checkPcsSimpleBrowserEvidence(f.root).samples,15);assert.equal(checkPcsSimpleBrowserEvidence(f.root).reports,3)}))
for(const [name,change,pattern]of [
 ['failed',(r:any)=>{r.passed=false},/Failed report/],
 ['browser-error',(r:any)=>{r.errors=['uncaught']},/Browser errors/],
 ['timeout',(r:any)=>{r.samples[0].ms=1001},/over-1s/],
 ['duplicate-round',(r:any)=>{r.samples[1].round=0},/Duplicate measured round/],
 ['missing-round',(r:any)=>{r.samples.pop()},/Fewer than five/],
 ['failed-group',(r:any)=>{r.groups=[{passed:false}]},/group failed/],
]as const)test(`reject rehashed ${name} evidence`,()=>verify(f=>{f.report('pages',change);f.save();assert.throws(()=>checkPcsSimpleBrowserEvidence(f.root),pattern)}))
test('reject changed report bytes and altered runtime, browser contract, and dist',()=>verify(f=>{
 const targets=[`${directory}/pages.json`,'src/pages/pcs-materials.ts',PCS_SIMPLE_CONTRACTS[0],'dist/assets/main.js']
 for(const path of targets){const before=readFileSync(join(f.root,path),'utf8');f.write(path,before+' ');assert.throws(()=>checkPcsSimpleBrowserEvidence(f.root));f.write(path,before)}
}))
test('reject stale builds and calibration',()=>verify(f=>{f.reuse('process');f.save();assert.throws(()=>checkPcsSimpleBrowserEvidence(f.root),/final build/);f.acceptance.reportBundleHashes.process=f.acceptance.bundleSHA256;f.report('pages',r=>{r.formal=false});f.save();assert.throws(()=>checkPcsSimpleBrowserEvidence(f.root),/Calibration/)}))
test('retired test or runtime collection cannot be silently skipped',()=>verify(f=>{
 f.write('tests/browser-contracts/pcs-simple-category-usage.test.ts','// retired');assert.throws(()=>checkPcsSimpleBrowserEvidence(f.root),/Retired category\/copy\/usage entrance/)
 rmSync(join(f.root,'tests/browser-contracts/pcs-simple-category-usage.test.ts'))
 const path='src/data/pcs-record-runtime.ts';f.write(path,'higood-pcs-simple-material-categories-v1');f.acceptance.sourceHashes[path]=sha('higood-pcs-simple-material-categories-v1');f.save();assert.throws(()=>checkPcsSimpleBrowserEvidence(f.root),/Retired collection/)
}))
