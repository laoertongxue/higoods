import { chromium } from '@playwright/test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { writeFileSync, mkdirSync } from 'node:fs'

const base=process.env.WASH_BASE_URL||'http://127.0.0.1:43158',out='docs/verification-evidence/2026-10-15-washing-entry-v1.2',key='higood-pcs-technical-data-version-store-v5'
mkdirSync(out,{recursive:true})
const snapshot=JSON.parse(execFileSync('node',['--import','tsx','--input-type=module','-e',"import {createTechnicalDataVersionBootstrapSnapshot as create} from './src/data/pcs-technical-data-version-bootstrap.ts'; process.stdout.write(JSON.stringify(create()));"],{encoding:'utf8',maxBuffer:16*1024*1024}))
const draft=snapshot.records.find(r=>r.versionStatus==='DRAFT'&&r.reviewStage==='未提交审核'),published=snapshot.records.find(r=>r.versionStatus==='PUBLISHED'),locked=snapshot.records.find(r=>r.versionStatus==='DRAFT'&&r.reviewStage==='第一阶段并行审核')
// Only BOM is unlocked: PROCESS must remain read-only, irrespective of review owner.
locked.reviewUnlockedModuleKeys=['BOM']
for(const record of [draft,published,locked]){
 record.note+=' V1.2 isolated legacy route fixture'
 const content=snapshot.contents.find(c=>c.technicalVersionId===record.technicalVersionId),print=content.processEntries.find(e=>e.processCode==='PRINT')
 const wash={...structuredClone(print),id:print.id+'-LEGACY-WASH',processCode:'WASH',processName:'水洗',craftName:'水洗',predecessorEntryIds:[print.id],routeStepNo:(print.routeStepNo||0)+1,inputMaterialSkuId:print.outputMaterialSkuId}
 content.processEntries.push(wash)
 const downstream=content.processEntries.find(e=>e.stageCode==='PROD'&&e.processCode==='CUT_PANEL')
 if(downstream)downstream.predecessorEntryIds=[...new Set([...(downstream.predecessorEntryIds||[]),wash.id])]
}
const report={at:new Date().toISOString(),base,environment:{browser:'Chromium',timezone:'Asia/Shanghai',viewport:'1366×768',scale:'26 native technical versions; one injected legacy node per named draft and published version; isolated context per sample'},checks:[],samples:[]},browser=await chromium.launch()
async function ready(p){await p.locator('[data-testid="tech-pack-three-stage-route"]').waitFor();await p.evaluate(async()=>{const root=document.querySelector('[data-testid="tech-pack-three-stage-route"]');for(const img of root.querySelectorAll('img')){if(img.getBoundingClientRect().top<innerHeight&&img.getBoundingClientRect().bottom>0){if(!img.complete)await img.decode();if(!img.naturalWidth)throw new Error('image unavailable')}}await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))})}
for(let run=1;run<=5;run++){
 const c=await browser.newContext({viewport:{width:1366,height:768},timezoneId:'Asia/Shanghai'}),p=await c.newPage();p.setDefaultTimeout(5000)
 try{
  await c.addInitScript(({key,snapshot})=>{localStorage.setItem(key,JSON.stringify(snapshot));document.addEventListener('pointerdown',()=>window.draftRouteStart=performance.now(),true)},{key,snapshot})
  await p.goto(base+'/pcs/products/styles/'+draft.styleId+'/technical-data/'+draft.technicalVersionId)
  await p.getByRole('button',{name:'工艺路线',exact:true}).click();await ready(p)
  const ms=await p.evaluate(()=>performance.now()-window.draftRouteStart),text=await p.locator('[data-testid="tech-pack-three-stage-route"]').innerText()
  assert.doesNotMatch(text,/水洗|洗水/)
  assert.equal(await p.evaluate(({key,snapshot})=>localStorage.getItem(key)===JSON.stringify(snapshot),{key,snapshot}),true)
  report.samples.push({family:'legacy-draft-route-tab',run,ms,status:ms<=1000?'PASS':'FAIL',start:'captured real pointerdown',complete:'correct route, visible real images and two animation frames'})
  if(run===1)await p.screenshot({path:out+'/draft-route-without-wash.png'})
  await p.reload();await p.getByRole('button',{name:'工艺路线',exact:true}).click();await ready(p);assert.doesNotMatch(await p.locator('[data-testid="tech-pack-three-stage-route"]').innerText(),/水洗|洗水/)
  await p.goto(base+'/pcs/products/styles/'+published.styleId+'/technical-data/'+published.technicalVersionId);await p.getByRole('button',{name:'工艺路线',exact:true}).click();await ready(p)
  assert.match(await p.locator('[data-testid="tech-pack-three-stage-route"]').innerText(),/洗水/)
  await p.goto(base+'/pcs/products/styles/'+locked.styleId+'/technical-data/'+locked.technicalVersionId);await p.getByRole('button',{name:'工艺路线',exact:true}).click();await ready(p)
  assert.match(await p.locator('[data-testid="tech-pack-three-stage-route"]').innerText(),/洗水/)
  report.checks.push({run,status:'PASS',draft:draft.technicalVersionId,published:published.technicalVersionId,locked:locked.technicalVersionId,originalLegacySourceKept:true})
 }catch(error){report.checks.push({run,status:'FAIL',error:error.stack});console.log('FAIL',run,error.message);break}
 finally{await c.close()}
}
report.summary={pass:report.checks.filter(r=>r.status==='PASS').length,fail:report.checks.filter(r=>r.status==='FAIL').length,maxMs:Math.max(...report.samples.map(r=>r.ms))}
writeFileSync(out+'/draft-route-'+new Date().toISOString().replaceAll(':','-')+'.json',JSON.stringify(report,null,2));await browser.close();console.log(report.summary)
if(report.summary.fail||report.summary.pass!==5||report.summary.maxMs>1000)process.exitCode=1
