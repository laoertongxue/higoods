import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {writeFileSync} from 'node:fs'
const browser=await chromium.launch({headless:true}),evidence={checks:[],errors:[],records:[]}
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});page.setDefaultTimeout(15000);page.on('pageerror',e=>evidence.errors.push(e.message))
 const list='http://127.0.0.1:43188/pcs/materials/accessory'
 for(const [index,category,width] of [[0,'织带','20mm'],[1,'织带','3cm'],[2,'绳子','Φ5mm']]){
  await page.goto(list);await page.locator('[data-pcs-material-archive-action="open-create"][data-kind="accessory"]').click()
  const field=name=>page.locator(`[data-pcs-material-archive-field="${name}"]`)
  await field('create-material-name').fill('TMF同名规格验收')
  await field('create-category-name').selectOption(category)
  await field('create-main-unit').selectOption('米');await field('create-pricing-unit').selectOption('米')
  await field('create-width-text').fill(index===0?'待确认':width)
  await page.locator('[data-pcs-material-archive-action="submit-create"]').click()
  if(index===0){await page.getByRole('alert').filter({hasText:'织带幅宽'}).waitFor();await field('create-width-text').fill(width);await page.locator('[data-pcs-material-archive-action="submit-create"]').click();evidence.checks.push('新建页缺明确幅宽被阻断，错误在抽屉内可见，修正后创建')}
  await page.waitForURL(/\/pcs\/materials\/accessory\/material_accessory_tmf_/)
  const id=page.url().split('/').pop()
  await page.reload()
  const record=await page.evaluate(async(id)=>{const path='/src/data/pcs-material-archive-repository.ts',m=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path);return m.getMaterialArchiveById(id)},id)
  assert.ok(record);evidence.records.push({id:record.materialId,code:record.materialCode,width:record.widthText,category:record.categoryName})
 }
 assert.equal(new Set(evidence.records.map(r=>r.id)).size,3);assert.equal(new Set(evidence.records.map(r=>r.code)).size,3)
 assert.deepEqual(evidence.records.map(r=>r.width),['20mm','30mm','Φ5mm'])
 await page.screenshot({path:'output/playwright/tmf-webbing/material-spu.png',fullPage:true})
 evidence.checks.push('同名20mm、3cm织带和Φ5mm绳子分别新建并刷新，主档身份与编码不同，归属和尺寸保持')
 assert.deepEqual(evidence.errors,[])
}finally{writeFileSync('output/playwright/tmf-webbing/material-spu-browser.json',JSON.stringify(evidence,null,2));await browser.close()}
