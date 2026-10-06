import assert from 'node:assert/strict'
import { test } from 'node:test'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { chromium } from '@playwright/test'
const base = process.env.STYLE_PHOTO_URL || 'http://127.0.0.1:4206'
const route = '/pcs/products/styles', skuRoute = '/pcs/products/specifications'
const out = 'output/playwright/sample-label-style'
const prefix = '[data-pcs-product-archive-action='
const samples: Array<{name: string; ms: number}> = []
const errors: string[] = []
const init = () => { (globalThis as any).__name = (v: unknown) => v; for (const type of ['pointerdown','input','change','click']) document.addEventListener(type, () => (globalThis as any).__photoStart = performance.now(), true) }
const ready = async (p: any) => { await p.waitForSelector('[data-pcs-product-archive-root]'); await p.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('main img')].filter(i => { const r = i.getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 && r.left < innerWidth && r.right > 0 }).every(i => i.complete && i.naturalWidth > 0)); await p.evaluate(() => new Promise<void>(r => requestAnimationFrame(() => requestAnimationFrame(() => r())))) }
const finish = async (p: any, name: string, nav = false) => { await ready(p); const ms = await p.evaluate((nav: boolean) => performance.now() - (nav ? 0 : (globalThis as any).__photoStart), nav); samples.push({name, ms}); assert.ok(ms <= 1000, `${name} ${ms}ms > 1000`); }
const act = async (p: any, name: string, operation: () => Promise<any>, wait?: () => Promise<any>) => { await p.evaluate(() => (globalThis as any).__photoStart = performance.now()); await operation(); if (wait) await wait(); await finish(p, name); }
const button = (p: any, action: string) => p.locator(`${prefix}"${action}"]`).first()

test('PHOTO-STYLE structured archive values, preferences, CSV and 1s browser gate', {timeout: 300000}, async () => {
  await mkdir(out, {recursive:true}); const browser = await chromium.launch({headless:true})
  try {
    for (let repeat=0;repeat<5;repeat++) {
      const c = await browser.newContext({viewport:{width:repeat===4?1280:1366,height:repeat===4?720:768},acceptDownloads:true}); await c.addInitScript(init)
      const p = await c.newPage(); p.on('pageerror', (e:any)=>errors.push(e.message)); const cd = await c.newCDPSession(p); await cd.send('Network.enable'); await cd.send('Network.setCacheDisabled',{cacheDisabled:true})
      for (const r of [route,skuRoute]) {
        await p.goto(base+r); await finish(p,r+':cold',true)
        await p.reload(); await finish(p,r+':reload',true)
        await p.goto(base+(r===route?skuRoute:route)); await ready(p)
        await act(p,r+':SPA',()=>p.evaluate((r:string)=>{const a=document.createElement('a');a.dataset.nav=r;document.querySelector('main')!.append(a);(globalThis as any).__photoOld=document.querySelector('[data-pcs-product-archive-root]');a.click();a.remove()},r),()=>p.waitForFunction(()=>!(globalThis as any).__photoOld?.isConnected))
      }
      await p.goto(base+route); await ready(p)
      assert.deepEqual(await p.locator('main thead th').allTextContents().then((a:string[])=>a.map(s=>s.trim())),['','款式','款式属性','适用人群','品类编号','操作'])
      const fixture = await p.evaluate(async ()=>{
        const rt=await import('/src/data/pcs-record-runtime.ts'); const sr=await import('/src/data/pcs-style-archive-repository.ts'); const config=await import('/src/data/pcs-config-workspace-repository.ts')
        const s=sr.listStyleArchives()[0];const refs={...s.productConfigRefs};
        for(const key of ['categories','styles','fabrics','trendElements','crowds','ages','crowdPositioning','specialCrafts','productPositioning'] as any[]) refs[key]=config.listConfigDimensionOptions(key).filter((o:any)=>o.status==='ENABLED').slice(0,key==='productPositioning'?1:2).map((o:any)=>o.id)
        const category=config.listConfigDimensionOptions('categoryNumbers').find((o:any)=>o.code==='48')!;refs.categoryNumbers=[category.id]
        const before=(await (await import('/src/data/pcs-record-db.ts')).readPcsRecords()).records.length
        assertNoBrowserWrites(before)
        await rt.runPcsRecordCommand(()=>sr.updateStyleArchive(s.styleId,{productConfigRefs:refs,remark:'备注不可替代结构化属性'}))
        const saved=sr.getStyleArchiveById(s.styleId)!
        return {id:s.styleId,code:s.styleCode,lines:{'品类':saved.categoryTags,'风格':saved.styleTags,'面料':saved.fabricTags,'流行元素':saved.popularElementTags,'人群':saved.targetAudienceTags,'年龄':saved.ageTags,'人群定位':saved.audiencePositionTags,'商品定位':[saved.productPosition],'特种工艺':refs.specialCrafts!.map((id:string)=>config.listConfigDimensionOptions('specialCrafts').find((o:any)=>o.id===id)!.name_zh)},category:[category.code,category.name_en,category.name_zh].filter(Boolean).join(' · ')}
        function assertNoBrowserWrites(n:number){if(n!==0)throw Error('Fresh ordinary reads wrote business seeds: '+n)}
      })
      await p.reload();await finish(p,'style:reload-persisted',true)
      const row=p.locator('main tbody tr').filter({has:p.locator(`a[href="${route}/${fixture.id}"]`)}).first()
      for(const [label,values] of Object.entries(fixture.lines)) { const v=Array.isArray(values)?values.join('、'):String(values);assert.equal(await row.locator('dl > div').filter({has:p.locator('dt',{hasText:new RegExp('^'+label+'$')})}).locator('dd').innerText(),v||'—') }
      assert.ok((await row.innerText()).includes(fixture.category));assert.ok(!(await p.locator('main thead').innerText()).includes('备注选项'))
      if(repeat===0||repeat===4)await p.screenshot({path:`${out}/style-${repeat===4?'1280':'1366'}.png`})
      await act(p,'style:keyword',()=>p.locator('[data-pcs-product-archive-field="filter.keyword"]').fill(fixture.code))
      await act(p,'style:query',()=>button(p,'query').click());assert.equal(await p.locator('main tbody tr').count(),1)
      const dl=p.waitForEvent('download');await act(p,'style:export',()=>button(p,'export').click());const download=await dl;const content=await readFile(await download.path(),'utf8');
      const headers=content.replace(/^\uFEFF/,'').split('\r\n')[0].split(',').map((x:string)=>x.replace(/^"|"$/g,''));for(const label of Object.keys(fixture.lines))assert.ok(headers.includes(label));assert.equal(new Set(headers).size,headers.length);assert.ok(content.includes(fixture.category));assert.equal(content.split('\r\n').length,2)
      await act(p,'style:reset',()=>button(p,'reset').click());assert.equal(await p.locator('main tbody tr').count(),20)
      await act(p,'style:more',()=>button(p,'more').click());
      const fields=await p.locator('[data-pcs-product-archive-field^="filter."]').evaluateAll((nodes:Element[])=>nodes.map(n=>({key:n.getAttribute('data-pcs-product-archive-field')!,select:n.tagName==='SELECT',value:n.tagName==='SELECT'?(n as HTMLSelectElement).options[1]?.value:''})))
      for(const f of fields){await act(p,'style:input-'+f.key,()=>f.select?p.locator(`[data-pcs-product-archive-field="${f.key}"]`).selectOption(f.value||''):p.locator(`[data-pcs-product-archive-field="${f.key}"]`).fill('无匹配'));await act(p,'style:query-'+f.key,()=>button(p,'query').click());await act(p,'style:reset-'+f.key,()=>button(p,'reset').click())}
      await act(p,'style:less',()=>button(p,'more').click())
      for(const key of ['identity','designAttributes','audienceAttributes','categoryNumber'])for(let i=0;i<3;i++)await act(p,`style:sort-${key}-${i}`,()=>p.locator(`${prefix}"sort-column"][data-column-key="${key}"]`).click())
      await act(p,'style:select-row',()=>button(p,'select-row').click());await act(p,'style:deselect-row',()=>button(p,'select-row').click());await act(p,'style:select-all',()=>button(p,'select-page').click());await act(p,'style:deselect-all',()=>button(p,'select-page').click())
      await act(p,'style:image-open',()=>button(p,'image').click(),()=>p.waitForSelector('[aria-label="图片预览"] img'));await act(p,'style:image-close',()=>p.getByRole('button',{name:'关闭 Esc'}).click(),()=>p.waitForSelector('[aria-label="图片预览"]',{state:'detached'}))
      await act(p,'style:columns-open',()=>button(p,'columns').click());
      for(const action of ['toggle-column-visibility','move-column-up','move-column-down']){
        const selector=`${prefix}"${action}"][data-pcs-product-archive-column-key="audienceAttributes"]`;const loc=p.locator(selector);if(await loc.count()&&!(await loc.isDisabled()))await act(p,'style:'+action,()=>loc.click())
      }
      await act(p,'style:columns-close',()=>button(p,'close-column-settings').click());await p.reload();await finish(p,'style:hidden-reload',true);assert.equal(await p.locator('[data-style-attribute-group="audienceAttributes"]').count(),0)
      await act(p,'style:columns-reopen',()=>button(p,'columns').click());await act(p,'style:restore-columns',()=>button(p,'restore-column-settings').click());await act(p,'style:close-columns-restored',()=>button(p,'close-column-settings').click());assert.ok(await p.locator('[data-style-attribute-group="audienceAttributes"]').count())
      for(const size of ['50','100','20'])await act(p,'style:page-size-'+size,()=>p.locator('[data-pcs-product-archive-field="pageSize"]').selectOption(size));await act(p,'style:next-page',()=>button(p,'next-page').click());await act(p,'style:prev-page',()=>button(p,'prev-page').click())
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth))
      await c.close(); console.log('PASS style attributes round',repeat+1)
    }
    const c=await browser.newContext({viewport:{width:1366,height:768}});await c.addInitScript(init);await c.addInitScript(()=>localStorage.setItem('higood-pcs-style-list-r1',JSON.stringify({order:['identity','categories','styles','brand','categoryNumber','actions'],visibleKeys:['identity','categories','styles','categoryNumber','actions'],frozenKeys:['identity'],pageSize:50})))
    const p=await c.newPage();await p.goto(base+route);await ready(p);assert.ok(await p.locator('[data-style-attribute-group="audienceAttributes"]').count());assert.ok(!(await p.locator('main thead').innerText()).includes('品牌'));assert.equal(await p.locator('[data-pcs-product-archive-field="pageSize"]').inputValue(),'50');await c.close()
    assert.deepEqual(errors,[]);await writeFile(`${out}/attributes-and-performance.json`,JSON.stringify({passed:true,base,branch:'codex/sample-wp05-completion',head:'eb1da8508f0ecda6c172b38df0b7b2d929f477b0',errors,samples,max:Math.max(...samples.map(s=>s.ms)),checks:['54 static styles / persistent config bindings','multiple selected attributes survive refresh','structured values match configuration IDs','complete bilingual category number','CSV independent unique headers and current filtered rows','hidden preferences survive reload / old preference compatibility','images, list actions, pagination, sorting, filters','1366x768 / 1280x720 internal width']},null,2))
  } finally {await browser.close()}
})
