import {expect,test} from '@playwright/test'
import {writeFile} from 'node:fs/promises'

test('原款与新款下拉支持粘贴、模糊搜索、清空、无结果、取消与明确选择',async({page},info)=>{
 await page.context().grantPermissions(['clipboard-read','clipboard-write'])
 await page.setViewportSize({width:1366,height:768})
 await page.goto('/pcs/production-preparation/design-revision/new')
 const samples:number[]=[]
 const interactions:Record<string,number[]>={}
 const measure=async(name:string,action:()=>Promise<void>)=>{
  const start=await page.evaluate(()=>performance.now())
  await action()
  const end=await page.evaluate(async()=>{await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return performance.now()})
  ;(interactions[name]||=[]).push(end-start)
 }
 for(let round=0;round<5;round++)for(const [field,code] of [['sourceStyleId','STYLE-PRJ-202603-010'],['targetStyleId','STYLE-PRJ-202603-012']]){
  const picker=page.locator(`[data-design-style-picker="${field}"]`)
  await measure('open',async()=>{await picker.locator('summary').click();await expect(picker.locator('input')).toBeFocused()})
  await page.evaluate(()=>document.addEventListener('input',e=>sessionStorage.setItem('spu-start',String(performance.timeOrigin+e.timeStamp)),{once:true,capture:true}))
  await page.evaluate(text=>navigator.clipboard.writeText(text),`  ${code.toLowerCase()}  `)
  await picker.locator('input').press('ControlOrMeta+V')
  await expect(picker.locator('option:not([hidden])')).toHaveCount(1)
  await expect(picker.locator('option:not([hidden])')).toContainText(code)
  samples.push(await page.evaluate(async()=>{await new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r())));return performance.timeOrigin+performance.now()-Number(sessionStorage.getItem('spu-start'))}))
  const id=await picker.locator('option:not([hidden])').getAttribute('value')
  await measure('select',async()=>{await picker.locator('select').selectOption(id!);await expect(picker.locator('summary')).toContainText(code);await expect(picker).not.toHaveAttribute('open','')})
  await picker.locator('summary').click()
  await measure('noMatch',async()=>{await picker.locator('input').fill('NO-SUCH-SPU');await expect(picker.locator('[data-design-style-empty]')).toBeVisible()})
  await expect(picker.locator('summary')).toContainText(code)
  await measure('clear',async()=>{await picker.locator('input').fill('');expect(await picker.locator('option:not([hidden])').count()).toBeGreaterThan(2)})
  await picker.locator('input').fill('STYLE-PRJ')
  expect(await picker.locator('option:not([hidden])').count()).toBeGreaterThan(1)
  if(round===0&&field==='targetStyleId')await page.screenshot({path:info.outputPath('spu-search.png')})
  await measure('escape',async()=>{await picker.locator('input').press('Escape');await expect(picker).not.toHaveAttribute('open','')})
  await picker.locator('summary').click()
  await picker.locator('input').fill('女装')
  expect(await picker.locator('option:not([hidden])').count()).toBeGreaterThan(0)
  await measure('outside',async()=>{await page.getByRole('heading',{name:'基本信息与设计稿'}).click();await expect(picker).not.toHaveAttribute('open','')})
 }
 await page.locator('[data-pcs-independent-sampling-field="creationReason"]').fill('搜索选择保存验证')
 await page.locator('[data-pcs-independent-sampling-create-design-upload]').setInputFiles('public/dress-sample-1.jpg')
 await expect(page.getByText('dress-sample-1.jpg',{exact:true})).toBeVisible()
 await page.locator('[data-pcs-independent-sampling-action="save-draft"]').click()
 await expect(page.getByText('设计改款草稿已保存。')).toBeVisible()
 await page.reload()
 await expect(page.getByText('STYLE-PRJ-202603-010',{exact:true})).toBeVisible()
 await expect(page.getByText('STYLE-PRJ-202603-012',{exact:true})).toBeVisible()
 await writeFile(info.outputPath('spu-search-performance.json'),JSON.stringify({samples,interactions},null,2))
 for(const value of [...samples,...Object.values(interactions).flat()])expect(value).toBeLessThan(500)
})
