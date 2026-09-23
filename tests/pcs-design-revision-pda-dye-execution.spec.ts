import {test,expect} from '@playwright/test'
import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'

test('设计改款 PDA 染色和全部后处理按实际数量推进，刷新保存',async({browser,baseURL},info)=>{
 const samples:Record<string,number[]>={}
 for(let n=0;n<5;n++){
 const values:Record<string,string>=JSON.parse(await readFile('output/playwright/design-revision-gap/fixtures/dye-received.json','utf8'))
 values.fcs_pda_session=JSON.stringify({userId:'F090_operator',loginId:'F090_operator',userName:'验收操作员',roleId:'ROLE_OPERATOR',factoryId:'F090',factoryName:'全能力测试工厂',loggedAt:'2026-09-24 09:00:00'})
 const c=await browser.newContext({viewport:{width:390,height:844},storageState:{cookies:[],origins:[{origin:new URL(baseURL!).origin,localStorage:Object.entries(values).map(([name,value])=>({name,value}))}]}})
 const p=await c.newPage(),errors:string[]=[];p.on('pageerror',e=>errors.push(e.message))
 p.on('dialog',d=>d.accept(d.message().includes('染缸')?d.defaultValue():d.message().includes('卷数')?'1':'20'))
 await p.goto(`${baseURL}/fcs/pda/exec/DWO-AUTO-000001`)
 const button=(action:string,node?:string)=>p.locator(`[data-pda-execd-action="${action}"]${node?`[data-node-code="${node}"]`:''}`)
 const measure=async(key:string,fn:()=>Promise<unknown>)=>{
 await p.evaluate(()=>document.addEventListener('click',e=>(window as any).__start=e.timeStamp,{capture:true,once:true}));await fn()
 const ms=await p.evaluate(async()=>{await Promise.all([...document.images].filter(i=>{const r=i.getBoundingClientRect();return r.width&&r.height&&r.top<innerHeight&&r.bottom>0}).map(i=>i.decode()));await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return performance.now()-(window as any).__start});(samples[key]??=[]).push(ms)
 await writeFile(info.outputPath('performance.json'),JSON.stringify({samples,distSha:createHash('sha256').update(await readFile('dist/index.html')).digest('hex')},null,2))
 }
 await measure('planVat',async()=>{await button('dye-plan-vat').click();await expect(p.getByText('已排染缸',{exact:true})).toBeVisible()})
 await measure('startDye',async()=>{await button('dye-start-dye').click();await expect(button('dye-complete-dye')).toBeEnabled()})
 await measure('completeDye',async()=>{await button('dye-complete-dye').click();await expect(button('dye-start-node','DEHYDRATE')).toBeEnabled()})
 for(const node of ['DEHYDRATE','DRY','SET','ROLL','PACK']){
 await measure('start:'+node,async()=>{await button('dye-start-node',node).click();await expect(button('dye-complete-node',node)).toBeEnabled()})
 await measure('complete:'+node,async()=>{await button('dye-complete-node',node).click();await expect(button('dye-complete-node',node)).toBeDisabled()})
 }
 await p.reload();await expect(button('dye-complete-node','PACK')).toBeDisabled()
 const nodes=await p.evaluate(()=>JSON.parse(localStorage.getItem('higoods.formal-dye-execution.v1')!).state.nodeRecords.find(([id]:[string])=>id==='DWO-AUTO-000001')[1])
 for(const code of ['DYE','DEHYDRATE','DRY','SET','ROLL','PACK']){const row=nodes.find((r:{nodeCode:string})=>r.nodeCode===code);expect(row.finishedAt).toBeTruthy();expect(row.outputQty).toBe(20);expect(row.qtyUnit).toBe('Yard')}
 expect(errors).toEqual([]);await c.close()
 }
 for(const [key,values]of Object.entries(samples))for(const ms of values)expect(ms,key).toBeLessThan(500)
})
