import { expect, test } from '@playwright/test'
import { writeFile } from 'node:fs/promises'
const route='/pcs/production-preparation/orders'

test('existing orders stay readable with BOM storage writes rejected',async({page},testInfo)=>{
  await page.setViewportSize({width:1366,height:768})
  const errors:string[]=[]
  page.on('pageerror',error=>errors.push(error.message))
  await page.goto(route)
  await expect(page.locator('[data-pcs-engineering-master-list-page]')).toBeVisible()
  const before=await page.evaluate(()=>localStorage.getItem('higood-pcs-engineering-bom-pricing-plan-store-v2'))
  await page.addInitScript(()=>{
    const original=Storage.prototype.setItem
    Storage.prototype.setItem=function(key,value){
      if(key==='higood-pcs-engineering-bom-pricing-plan-store-v2')throw new DOMException('quota exceeded','QuotaExceededError')
      return original.call(this,key,value)
    }
  })
  const samples:number[]=[]
  const interactions:number[]=[]
  for(let i=0;i<5;i++){
    await page.reload()
    await expect(page.locator('[data-pcs-engineering-master-region="table"] tbody tr').first()).toBeVisible()
    samples.push(await page.evaluate(async()=>{await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return performance.now()}))
    await page.evaluate(()=>{document.addEventListener('input',e=>sessionStorage.setItem('orders-action-start',String(performance.timeOrigin+e.timeStamp)),{once:true,capture:true})})
    await page.getByPlaceholder('搜索主单号 / 款式 / 负责人').fill('EM-')
    await expect(page.locator('[data-pcs-engineering-master-region="table"] tbody tr').first()).toBeVisible()
    interactions.push(await page.evaluate(async()=>{await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return performance.timeOrigin+performance.now()-Number(sessionStorage.getItem('orders-action-start'))}))
    await page.evaluate(()=>{document.addEventListener('click',e=>sessionStorage.setItem('orders-action-start',String(performance.timeOrigin+e.timeStamp)),{once:true,capture:true})})
    await page.getByRole('button',{name:'重置',exact:true}).click()
    interactions.push(await page.evaluate(async()=>{await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return performance.timeOrigin+performance.now()-Number(sessionStorage.getItem('orders-action-start'))}))
  }
  expect(await page.evaluate(()=>localStorage.getItem('higood-pcs-engineering-bom-pricing-plan-store-v2'))).toBe(before)
  expect(errors).toEqual([])
  await page.screenshot({path:testInfo.outputPath('orders-quota.png')})
  await writeFile(testInfo.outputPath('orders-quota.json'),JSON.stringify({samples,interactions,errors},null,2))
  for(const value of [...samples,...interactions])expect(value).toBeLessThan(500)
})

test('first demo initialization quota failure shows recoverable feedback instead of blank page',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.addInitScript(()=>{
    const original=Storage.prototype.setItem
    Storage.prototype.setItem=function(key,value){
      if(key==='higood-pcs-engineering-bom-pricing-plan-store-v2')throw new DOMException('quota exceeded','QuotaExceededError')
      return original.call(this,key,value)
    }
  })
  await page.goto(route)
  await expect(page.locator('[data-pcs-engineering-master-list-page]')).toBeVisible()
  await expect(page.getByRole('alert')).toContainText('浏览器存储空间不足')
  expect(errors).toEqual([])
})
