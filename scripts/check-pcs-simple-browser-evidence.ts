import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {existsSync,readFileSync,readdirSync} from 'node:fs'
import {resolve} from 'node:path'
import {pathToFileURL} from 'node:url'

export const PCS_SIMPLE_CONTRACTS=['tests/browser-contracts/pcs-simple-materials.test.ts','tests/browser-contracts/pcs-material-process-acceptance.test.ts','tests/browser-contracts/pcs-material-layout-downstream.test.ts']
export const PCS_SIMPLE_REPORTS=['pages','process','layout']
const directory='docs/verification-evidence/2026-10-12-material-classification'
const hash=(file:string)=>createHash('sha256').update(readFileSync(file)).digest('hex')
const json=(file:string)=>JSON.parse(readFileSync(file,'utf8'))
function inventory(root:string,path:string):string[]{return readdirSync(resolve(root,path),{withFileTypes:true}).flatMap(e=>e.isDirectory()?inventory(root,`${path}/${e.name}`):[`${path}/${e.name}`])}
/** Check actual current-scope reports; historical retired-copy evidence is not a current acceptance gate. */
export function checkPcsSimpleBrowserEvidence(root=process.cwd()):{samples:number;maximumMs:number;reports:number}{
 const absolute=(path:string)=>{assert(path&&!path.startsWith('/')&&!path.split('/').includes('..'),`Unsafe evidence path: ${path}`);return resolve(root,path)}
 const acceptance=json(absolute(`${directory}/acceptance.json`));assert.equal(acceptance.passed,true,'Acceptance must report success');assert.deepEqual([...acceptance.viewports].sort(),['1280x720','1366x768'],'Both management viewports required')
 const sources=inventory(root,'src').filter(p=>/\.(?:ts|tsx|css|json)$/.test(p)).sort();assert.deepEqual(Object.keys(acceptance.sourceHashes||{}).sort(),sources,'Source hash manifest must cover current runtime sources')
 for(const [path,sha]of Object.entries(acceptance.sourceHashes))assert.equal(hash(absolute(path)),sha,`Runtime source changed: ${path}`)
 assert.deepEqual(Object.keys(acceptance.browserContractHashes||{}).sort(),[...PCS_SIMPLE_CONTRACTS].sort(),'Browser contract hashes are required');for(const path of PCS_SIMPLE_CONTRACTS)assert.equal(hash(absolute(path)),acceptance.browserContractHashes[path],`Browser contract changed: ${path}`)
 const html=readFileSync(absolute('dist/index.html'),'utf8'),entry=html.match(/<script[^>]+src="([^"]+\.js)"/)?.[1];assert(entry,'Built entry script is missing');const bundle=hash(absolute('dist/'+entry.replace(/^\//,'')));assert.equal(bundle,acceptance.bundleSHA256,'Current dist does not match accepted build');assert.equal(hash(absolute('dist/index.html')),acceptance.indexSHA256,'Current HTML does not match measured assets')
 for(const key of ['reports','reportHashes','reportBundleHashes'])assert.deepEqual(Object.keys(acceptance[key]||{}).sort(),[...PCS_SIMPLE_REPORTS].sort(),'All final reports required')
 let count=0,maximum=0
 for(const name of PCS_SIMPLE_REPORTS){const meta=acceptance.reports[name];assert.equal(meta.evidence,`${directory}/${name}.json`,'Report path must identify its final archive');const path=absolute(meta.evidence);assert.equal(hash(path),acceptance.reportHashes[name],`Report bytes changed: ${name}`);const report=json(path);assert.notEqual(report.passed,false,`Failed report: ${name}`);assert.equal(report.formal,true,'Calibration cannot be accepted');assert(!report.functionalFailure,`Functional failure: ${name}`);assert(Array.isArray(report.errors)&&report.errors.length===0,`Browser errors: ${name}`);assert.equal(acceptance.reportBundleHashes[name],bundle,'Both current reports must use final build');assert.equal(report.assetsSha,acceptance.indexSHA256,'Measured HTML hash differs');assert(Array.isArray(report.samples)&&report.samples.length>0,`Empty samples: ${name}`)
  const groups=new Map<string,number[]>(),rounds=new Map<string,Set<number>>();let reportMax=0
  for(const sample of report.samples){assert(typeof sample.name==='string'&&sample.name,`Unnamed sample: ${name}`);assert(typeof sample.ms==='number'&&Number.isFinite(sample.ms)&&sample.ms>=0&&sample.ms<=1000,`Invalid/over-1s measurement: ${name}/${sample.name}`);const key=JSON.stringify([sample.name,sample.n??null]),round=sample.round??sample.repeat;groups.set(key,[...(groups.get(key)||[]),sample.ms]);assert(Number.isInteger(round)&&round>=0,`Missing round identity: ${name}`);const identities=rounds.get(key)||new Set<number>();assert(!identities.has(round),`Duplicate measured round: ${name}/${sample.name}`);identities.add(round);rounds.set(key,identities);reportMax=Math.max(reportMax,sample.ms)}
  assert([...groups.values()].every(v=>v.length>=5),`Fewer than five measured rounds: ${name}`);if(report.groups)assert(report.groups.every((g:any)=>g.passed===true),`Reported group failed: ${name}`);assert.equal(meta.samples,report.samples.length,`Sample count differs: ${name}`);assert(Math.abs(meta.maximumMs-reportMax)<.001,`Maximum differs: ${name}`);assert.equal(meta.minimumSamplesPerGroup,Math.min(...[...groups.values()].map(v=>v.length)),`Group count summary differs: ${name}`);count+=report.samples.length;maximum=Math.max(maximum,reportMax)
 }
 assert.equal(count,acceptance.totalSamples,'Total count differs');assert(Math.abs(maximum-acceptance.maximumMs)<.001,'Total maximum differs')
 for(const path of ['src/data/pcs-simple-material-categories.ts','src/data/pcs-material-technical-usage.ts','tests/browser-contracts/pcs-simple-copy-identity.test.ts','tests/browser-contracts/pcs-simple-category-usage.test.ts'])assert(!existsSync(absolute(path)),`Retired category/copy/usage entrance exists: ${path}`)
 for(const path of ['src/data/pcs-record-runtime.ts','src/router/route-renderers.ts','src/data/generated/pcs-record-baseline.json'])assert(!readFileSync(absolute(path),'utf8').includes('higood-pcs-simple-material-categories-v1'),`Retired collection still active: ${path}`)
 return{samples:count,maximumMs:maximum,reports:PCS_SIMPLE_REPORTS.length}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){try{console.log('PCS current material browser evidence verified',checkPcsSimpleBrowserEvidence())}catch(error){console.error(error instanceof Error?error.message:error);process.exitCode=1}}
