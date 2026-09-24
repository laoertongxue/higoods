import {expect,test} from '@playwright/test'
import {writeFile} from 'node:fs/promises'
const route='/pcs/production-preparation/design-revision'
const key='higood-pcs-engineering-bom-pricing-plan-store-v2'

test('旧格式与接近存储上限时复制草稿仍持久化，真正拒写时安全失败',async({browser,baseURL},info)=>{
 const evidence:object[]=[]
 for(let round=0;round<5;round++){
  const context=await browser.newContext({viewport:{width:1366,height:768}})
  const page=await context.newPage()
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.goto(baseURL+route)
  await expect(page.getByRole('checkbox',{name:'选择 ES-DR-001',exact:true})).toBeVisible()
  await page.getByRole('checkbox',{name:'选择 ES-DR-001',exact:true}).check()
  await page.getByRole('button',{name:'批量复制为草稿',exact:true}).click()
  await expect(page.getByText(/已批量生成独立的设计改款草稿/)).toBeVisible()
  const before=await page.evaluate(key=>{
   const value=JSON.parse(localStorage.getItem(key)!)
   const decode=(x:any):any=>!Array.isArray(x)?x:x[0]===2?value.strings[x[1]]:x[0]===1?x.slice(1).map(decode):Object.fromEntries(Array.from({length:(x.length-1)/2},(_,i)=>[value.strings[x[1+i*2]],decode(x[2+i*2])]))
   const plain=value.format?decode(value.data):value
   const raw=JSON.stringify(plain)
   localStorage.setItem(key,raw)
   const total=Object.keys(localStorage).reduce((n,k)=>n+k.length+localStorage.getItem(k)!.length,0)
   localStorage.setItem('quota-fixture','x'.repeat(Math.max(0,5242880-total-1200)))
   return {bomChars:raw.length,count:JSON.parse(localStorage.getItem('higood-pcs-design-revision-v1')!).length}
  },key)
  await page.reload()
  await page.getByRole('checkbox',{name:'选择 ES-DR-001',exact:true}).check()
  if(round===0){
   await page.evaluate(key=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key&&sessionStorage.getItem('block-bom')==='yes')throw new DOMException('quota','QuotaExceededError');return original.call(this,k,v)};sessionStorage.setItem('block-bom','yes')},key)
   await page.getByRole('button',{name:'批量复制为草稿',exact:true}).click()
   await expect(page.getByText(/浏览器存储空间不足，未生成新草稿/)).toBeVisible()
   expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('higood-pcs-design-revision-v1')!).length)).toBe(before.count)
   await page.evaluate(()=>sessionStorage.removeItem('block-bom'))
  }
  await page.evaluate(()=>document.addEventListener('click',e=>sessionStorage.setItem('copy-start',String(performance.timeOrigin+e.timeStamp)),{capture:true,once:true}))
  await page.getByRole('button',{name:'批量复制为草稿',exact:true}).click()
  await expect(page.getByText(/已批量生成独立的设计改款草稿/)).toBeVisible()
  const after=await page.evaluate(async key=>{await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return {elapsed:performance.timeOrigin+performance.now()-Number(sessionStorage.getItem('copy-start')),bomChars:localStorage.getItem(key)!.length,records:JSON.parse(localStorage.getItem('higood-pcs-design-revision-v1')!)}},key)
  expect(after.elapsed).toBeLessThan(500)
  expect(after.bomChars).toBeLessThan(before.bomChars)
  expect(after.records.length).toBe(before.count+1)
  const draft=after.records.at(-1)
  expect(draft.status).toBe('DRAFT')
  expect(draft.professionalTasks).toHaveLength(0)
  await page.reload()
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('higood-pcs-design-revision-v1')!).length)).toBe(before.count+1)
  await page.goto(baseURL+route+'/'+draft.samplingTaskId)
  await expect(page.getByRole('heading',{name:draft.samplingTaskCode,exact:true})).toBeVisible()
  expect(errors).toEqual([])
  evidence.push({before,after:{elapsed:after.elapsed,bomChars:after.bomChars,draftId:draft.samplingTaskId}})
  if(round===0)await page.screenshot({path:info.outputPath('copied-draft.png')})
  await context.close()
 }
 await writeFile(info.outputPath('copy-quota.json'),JSON.stringify(evidence,null,2))
})
