import assert from 'node:assert/strict'
import test from 'node:test'
import {mkdir,writeFile} from 'node:fs/promises'
import {readFileSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {chromium,type Page} from '@playwright/test'

const base=process.env.SIMPLE_CONFIG_URL||'http://127.0.0.1:43220'
const rounds=Number(process.env.SIMPLE_CONFIG_ROUNDS||5),gate=process.env.SIMPLE_CONFIG_FUNCTION_ONLY!=='true'
const out='output/playwright/pcs-simple-materials/config'
const action=(name:string)=>`[data-pcs-config-workspace-action="${name}"]`
const field=(name:string)=>`[data-pcs-config-workspace-field="${name}"]`
test('SIMPLE-021/022/023/024/059/060: simple category controls, persistence and five complete browser samples',{timeout:360000},async()=>{
 await mkdir(out,{recursive:true})
 const browser=await chromium.launch(),samples:Array<{name:string;ms:number;round:number}>=[],errors:string[]=[]
 let round=0
 const ready=async(p:Page)=>{await p.waitForSelector('#pcs-config-workspace-root');await p.waitForFunction(()=>!document.querySelector('#pcs-config-workspace-root [data-pcs-config-workspace-field][disabled]'));await p.evaluate(async()=>{await document.fonts.ready;const frames=()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));await frames();await Promise.all(document.getAnimations().filter(animation=>animation.playState!=='finished'&&Number.isFinite(animation.effect?.getComputedTiming().endTime)).map(animation=>animation.finished.catch(()=>undefined)));await frames()})}
 const measure=async(p:Page,name:string,cold=false)=>{await ready(p);const ms=await p.evaluate(cold=>cold?performance.now():performance.now()-(window as any).__configStart,cold);samples.push({name,ms,round});if(gate)assert.ok(ms<=1000,`${name}: ${ms.toFixed(1)}ms > 1000ms`)}
 const act=async(p:Page,name:string,fn:()=>Promise<unknown>,done?:()=>Promise<unknown>)=>{await fn();if(done)await done();await measure(p,name)}
 const root=(p:Page)=>p.locator('#pcs-config-workspace-root')
 try{
  for(round=0;round<rounds;round++){
   const context=await browser.newContext({viewport:round===4?{width:1280,height:720}:{width:1366,height:768}})
   await context.addInitScript(()=>{(globalThis as any).__name=(x:any)=>x;for(const event of ['pointerdown','input','change','dragstart'])document.addEventListener(event,()=>{(window as any).__configStart=performance.now()},true)})
   const p=await context.newPage();p.on('pageerror',error=>errors.push(error.message));p.on('dialog',dialog=>dialog.accept())
   const cdp=await context.newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true})
   await p.goto(base+'/pcs/settings/config-workspace');await measure(p,'config:cold',true)
   await p.reload();await measure(p,'config:reload',true)
   await act(p,'config:classification-section',()=>root(p).locator(action('switch-dimension')+'[data-dimension-id="templates"]').click())
   for(const kind of ['consumable','parts']){
    await act(p,kind+':kind',()=>root(p).locator(action('kind')+`[data-kind="${kind}"]`).click())
    await act(p,kind+':kind-reset-query',()=>root(p).locator(action('reset-query')).click())
    assert.equal(await root(p).locator(action('tab')).count(),0)
    assert.doesNotMatch(await root(p).innerText(),/当前版本|根属性 \/ SKU 属性|版本状态/)
    if(round===0||round===4)await p.screenshot({path:out+`/${kind}-${round===0?'1366':'1280'}-list.png`})
    await act(p,kind+':search-input',()=>root(p).locator(field('search')).fill(kind==='parts'?'裁床':'包装'))
    await act(p,kind+':query',()=>root(p).locator(action('query')).click())
    await act(p,kind+':status-filter',()=>root(p).locator(field('filter-status')).selectOption('enabled'))
    await act(p,kind+':reset-query',()=>root(p).locator(action('reset-query')).click())
    await act(p,kind+':columns-open',()=>root(p).locator(action('open-column-settings')).click())
    await act(p,kind+':column-hide',()=>root(p).locator(action('toggle-column-visibility')+':not([disabled])').first().uncheck())
    await act(p,kind+':column-show',()=>root(p).locator(action('toggle-column-visibility')+':not([disabled])').first().check())
    await act(p,kind+':column-freeze',()=>root(p).locator(action('toggle-column-freeze')+':not([disabled])').first().check())
    await act(p,kind+':column-unfreeze',()=>root(p).locator(action('toggle-column-freeze')+':not([disabled])').first().uncheck())
    await act(p,kind+':column-reorder',()=>root(p).locator('[data-standard-list-column-key="column-1"]').dragTo(root(p).locator('[data-standard-list-column-key="column-0"]')))
    assert.equal(await root(p).locator('[data-standard-list-column-drag]').first().getAttribute('data-standard-list-column-key'),'column-1')
    await act(p,kind+':restore-columns',()=>root(p).locator(action('restore-column-settings')).click())
    await act(p,kind+':columns-close',()=>root(p).locator(action('close-column-settings')).last().click())
    await act(p,kind+':page-size',()=>root(p).locator(field('pageSize')).selectOption('50'))
    assert.ok(await root(p).locator(action('prev-page')).isDisabled());assert.ok(await root(p).locator(action('next-page')).isDisabled())
    await act(p,kind+':sort',()=>root(p).locator(action('sort-column')).first().click())
    const download=p.waitForEvent('download')
    await act(p,kind+':export',()=>root(p).locator(action('export-list')).click(),async()=>{const file=await download;assert.ok(file.suggestedFilename().endsWith('.csv'));assert.ok(await file.path())})
    await act(p,kind+':existing-detail',()=>root(p).locator(action('detail')).first().click())
    assert.equal(await root(p).locator(action('tab')).count(),0)
    assert.doesNotMatch(await root(p).innerText(),/主档与 SKU 属性|包装属性|工艺属性|版本换算依据|新建版本/)
    await act(p,kind+':usage-open',()=>root(p).locator(action('simple-usage')).click(),()=>p.getByRole('dialog',{name:'分类使用情况'}).waitFor())
    await act(p,kind+':usage-close',()=>root(p).locator(action('close-simple-overlay')).click())
    await act(p,kind+':logs-open',()=>root(p).locator(action('simple-logs')).click(),()=>p.getByRole('dialog',{name:'分类操作日志'}).waitFor())
    await act(p,kind+':logs-close',()=>root(p).locator(action('close-simple-overlay')).click())
    await act(p,kind+':existing-edit',()=>root(p).locator(action('edit')).click())
    assert.equal(await root(p).locator(field('code')).getAttribute('readonly'),'')
    await act(p,kind+':cancel',()=>root(p).locator(action('back')).click())
    await act(p,kind+':new',()=>root(p).locator(action('create')).click())
    assert.equal(await root(p).locator(field('code')).inputValue(),'保存时自动生成')
    assert.equal(await root(p).locator(field('code')).getAttribute('readonly'),'')
    await act(p,kind+':empty-name-block',()=>root(p).locator(action('save')).click(),()=>root(p).getByText('分类名称必填，最多 80 个字符。',{exact:true}).waitFor())
    const name=`浏览器分类${kind}-${round}`
    await act(p,kind+':name-input',()=>root(p).locator(field('nameZh')).fill(name))
    await act(p,kind+':order-input',()=>root(p).locator(field('sortOrder')).fill('81'))
    await act(p,kind+':remark-input',()=>root(p).locator(field('remark')).fill('普通分类说明；无需属性模板'))
    await act(p,kind+':new-state-input',()=>root(p).locator(field('enabled')).selectOption('true'))
    await act(p,kind+':save-new',()=>root(p).locator(action('save')).click(),()=>root(p).locator(action('edit')).waitFor())
    const text=await root(p).innerText();assert.ok(text.includes(name));assert.ok(text.includes('MC-'+kind.toUpperCase()+'-'))
    if(round===0)await p.screenshot({path:out+`/${kind}-detail.png`})
    await act(p,kind+':edit-saved',()=>root(p).locator(action('edit')).click())
    const code=await root(p).locator(field('code')).inputValue()
    await act(p,kind+':rename-input',()=>root(p).locator(field('nameZh')).fill(name+'更正'))
    await act(p,kind+':stop-input',()=>root(p).locator(field('enabled')).selectOption('false'))
    await act(p,kind+':save-stop',()=>root(p).locator(action('save')).click(),()=>root(p).locator(action('edit')).waitFor())
    await act(p,kind+':log-after-save',()=>root(p).locator(action('simple-logs')).click(),()=>p.getByRole('dialog',{name:'分类操作日志'}).waitFor())
    const log=await p.getByRole('dialog',{name:'分类操作日志'}).innerText();assert.ok(log.includes('停用分类'));assert.ok(log.includes('当前用户'))
    await act(p,kind+':log-changes-open',()=>p.getByRole('dialog',{name:'分类操作日志'}).locator('summary').first().click())
    assert.ok((await p.getByRole('dialog',{name:'分类操作日志'}).innerText()).includes('更正'))
    await act(p,kind+':log-changes-close',()=>p.getByRole('dialog',{name:'分类操作日志'}).locator('summary').first().click())
    await act(p,kind+':log-after-close',()=>root(p).locator(action('close-simple-overlay')).click())
    await p.reload();await measure(p,kind+':persisted-reload',true)
    await root(p).locator(action('switch-dimension')+'[data-dimension-id="templates"]').click()
    await root(p).locator(action('kind')+`[data-kind="${kind}"]`).click()
    await root(p).locator(field('search')).fill(name+'更正');await root(p).locator(action('query')).click()
    await act(p,kind+':persisted-detail',()=>root(p).locator(action('detail')).first().click())
    assert.ok((await root(p).innerText()).includes(code));assert.ok((await root(p).innerText()).includes('停用'))
    await act(p,kind+':back',()=>root(p).locator(action('back')).click())
   }
   await act(p,'professional:fabric-kind',()=>root(p).locator(action('kind')+'[data-kind="fabric"]').click())
   await act(p,'professional:reset-query',()=>root(p).locator(action('reset-query')).click())
   await act(p,'professional:fabric-detail',()=>root(p).locator(action('detail')).first().click())
   assert.ok((await root(p).innerText()).includes('主档与 SKU 属性'))
   await context.close()
  }
 }finally{await writeFile(out+'/performance.json',JSON.stringify({base,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceDiffSha256:createHash('sha256').update(execFileSync('git',['diff','--binary','--','src'],{maxBuffer:20*1024*1024})).digest('hex'),productionBundle:existsSync('dist/index.html')?readFileSync('dist/index.html','utf8').match(/src="([^" ]*\/assets\/[^" ]+\.js)"/)?.[1]:null,completedAt:new Date().toISOString(),browser:browser.version(),cache:'disabled',rounds,samples,errors,gate},null,2));await browser.close()}
 assert.deepEqual(errors,[]);if(gate){const groups=new Map<string,Set<number>>();for(const sample of samples){const seen=groups.get(sample.name)||new Set<number>();seen.add(sample.round);groups.set(sample.name,seen)}assert.ok(groups.size>0,'must measure semantic action groups');for(const [name,seen] of groups)assert.ok(seen.size>=5,`${name}: requires five independent round samples`)};console.log('config samples',samples.length,'max',Math.max(...samples.map(s=>s.ms)))
})

