import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const PCS_SIMPLE_CONTRACTS = ['adversarial','config','copy-identity','dossier','downstream','import','long-label','materials','list-entry'].map(name=>`tests/browser-contracts/pcs-simple-${name}.test.ts`)
export const PCS_SIMPLE_REPORTS = ['dossier','limits','config','lifecycle','downstream','copy','adversarial','import','import-boundaries','downloads','list-entry']
const evidenceDirectory='docs/verification-evidence/2026-10-10-simple-materials-single-editor'
const allowedReuseExclusions=new Set(['src/pages/pcs-technical-data.ts','src/router/route-renderers.ts'])
function hash(file:string):string{return createHash('sha256').update(readFileSync(file)).digest('hex')}
function json(file:string):any{return JSON.parse(readFileSync(file,'utf8'))}
function inventory(root:string,path:string):string[]{return readdirSync(resolve(root,path),{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?inventory(root,`${path}/${entry.name}`):[`${path}/${entry.name}`])}
/** Reuse measured final browser results only when their inputs and artifact bytes remain verifiable. Never writes evidence. */
export function checkPcsSimpleBrowserEvidence(root=process.cwd()):{samples:number;maximumMs:number;reports:number}{
 const absolute=(path:string)=>{assert(path&&!path.startsWith('/')&&!path.split('/').includes('..'),`Unsafe evidence path: ${path}`);return resolve(root,path)}
 const acceptance=json(absolute(`${evidenceDirectory}/acceptance.json`))
 assert.equal(acceptance.passed,true,'Acceptance must report success')
 assert.deepEqual([...acceptance.viewports].sort(),['1280x720','1366x768'],'Both management viewports required')
 const sourcePaths=inventory(root,'src').filter(path=>/\.(?:ts|tsx|css|json)$/.test(path)).sort()
 assert.deepEqual(Object.keys(acceptance.sourceHashes||{}).sort(),sourcePaths,'Source hash manifest must cover current runtime sources')
 for(const [path,expected]of Object.entries(acceptance.sourceHashes))assert.equal(hash(absolute(path)),expected,`Runtime source changed: ${path}`)
 assert.deepEqual(Object.keys(acceptance.browserContractHashes||{}).sort(),[...PCS_SIMPLE_CONTRACTS].sort(),'Browser contract hashes are required')
 for(const path of PCS_SIMPLE_CONTRACTS)assert.equal(hash(absolute(path)),acceptance.browserContractHashes[path],`Browser contract changed: ${path}`)
 const html=readFileSync(absolute('dist/index.html'),'utf8'),entry=html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1]
 assert(entry,'Built entry script is missing');const bundle=hash(absolute('dist/'+entry.replace(/^\//,'')))
 assert.equal(bundle,acceptance.bundleSHA256,'Current dist does not match accepted build')
 assert.deepEqual(Object.keys(acceptance.reports||{}).sort(),[...PCS_SIMPLE_REPORTS].sort(),'All final reports required')
 assert.deepEqual(Object.keys(acceptance.reportHashes||{}).sort(),[...PCS_SIMPLE_REPORTS].sort(),'Frozen report hashes required')
 assert.deepEqual(Object.keys(acceptance.reportBundleHashes||{}).sort(),[...PCS_SIMPLE_REPORTS].sort(),'Per-report build hashes required')
 let count=0,maximum=0
 for(const name of PCS_SIMPLE_REPORTS){
  const meta=acceptance.reports[name];assert.equal(meta.evidence,`${evidenceDirectory}/${name}.json`,'Report path must identify its final archive')
  const path=absolute(meta.evidence);assert.equal(hash(path),acceptance.reportHashes[name],`Report bytes changed: ${name}`)
  const report=json(path);assert.notEqual(report.passed,false,`Failed report: ${name}`);assert(!report.functionalFailure,`Functional failure: ${name}`);assert(!report.errors||Array.isArray(report.errors)&&report.errors.length===0,`Browser errors: ${name}`)
  const reportBundle=acceptance.reportBundleHashes[name];assert.match(reportBundle,/^[a-f0-9]{64}$/,'Invalid report bundle hash')
  if(report.servedBundle){assert.equal(report.servedBundle.sha256,reportBundle,`Report build metadata differs: ${name}`);assert.equal(report.servedBundle.matchesLocalDist,true,`Original measured build mismatched: ${name}`)}
  if(reportBundle!==bundle){
   assert(!['downstream','list-entry'].includes(name),'Downstream and list-entry must be remeasured on the final build')
   const reuse=acceptance.reportReuse?.[name];assert(reuse?.reason?.trim(),`Missing explicit build reuse reason: ${name}`)
   assert.deepEqual(Object.keys(reuse.unchangedSourcePaths||{}).sort(),sourcePaths.filter(path=>!allowedReuseExclusions.has(path)),`Reuse must account for every unchanged runtime source: ${name}`)
   for(const [path,expected]of Object.entries(reuse.unchangedSourcePaths))assert.equal(hash(absolute(path)),expected,`Reused report source changed: ${name}/${path}`)
  }
  assert(Array.isArray(report.samples)&&report.samples.length>0,`Empty samples: ${name}`)
  const groups=new Map<string,number[]>();const rounds=new Map<string,Set<number>>();let reportMax=0
  for(const sample of report.samples){assert(typeof sample.name==='string'&&sample.name,`Unnamed sample: ${name}`);assert(typeof sample.ms==='number'&&Number.isFinite(sample.ms)&&sample.ms>=0&&sample.ms<=1000,`Invalid/over-1s measurement: ${name}/${sample.name}`);const key=JSON.stringify([sample.name,sample.n??null]);groups.set(key,[...(groups.get(key)||[]),sample.ms]);const round=sample.round??sample.repeat;assert(Number.isInteger(round)&&round>=0,`Missing round identity: ${name}`);const identities=rounds.get(key)||new Set<number>();assert(!identities.has(round),`Duplicate measured round: ${name}/${sample.name}`);identities.add(round);rounds.set(key,identities);reportMax=Math.max(reportMax,sample.ms)}
  assert([...groups.values()].every(values=>values.length>=5),`Fewer than five measured rounds: ${name}`)
  if(report.groups)assert(report.groups.every((group:any)=>group.passed===true),`Reported group failed: ${name}`)
  assert.equal(meta.samples,report.samples.length,`Sample count differs: ${name}`);assert(Math.abs(meta.maximumMs-reportMax)<.001,`Maximum differs: ${name}`);assert.equal(meta.minimumSamplesPerGroup,Math.min(...[...groups.values()].map(values=>values.length)),`Group count summary differs: ${name}`)
  count+=report.samples.length;maximum=Math.max(maximum,reportMax)
 }
 assert.equal(count,acceptance.totalSamples,'Total count differs');assert(Math.abs(maximum-acceptance.maximumMs)<.001,'Total maximum differs')
 for(const path of ['src/data/pcs-simple-material-categories.ts','tests/browser-contracts/pcs-simple-category-usage.test.ts'])assert(!existsSync(absolute(path)),`Retired category entrance exists: ${path}`)
 for(const path of ['src/data/pcs-record-runtime.ts','src/router/route-renderers.ts','src/data/generated/pcs-record-baseline.json'])assert(!readFileSync(absolute(path),'utf8').includes('higood-pcs-simple-material-categories-v1'),`Retired collection still active: ${path}`)
 return{samples:count,maximumMs:maximum,reports:PCS_SIMPLE_REPORTS.length}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log('PCS simple browser evidence verified',checkPcsSimpleBrowserEvidence())}catch(error){console.error(error instanceof Error?error.message:error);process.exitCode=1}}
