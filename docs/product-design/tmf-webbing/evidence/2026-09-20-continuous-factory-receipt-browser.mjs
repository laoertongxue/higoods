import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {writeFileSync} from 'node:fs'
const browser=await chromium.launch({headless:true}),evidence={checks:[],errors:[]}
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});page.setDefaultTimeout(10000)
 page.on('pageerror',e=>evidence.errors.push(e.message))
 await page.goto('http://127.0.0.1:43188/fcs/craft/dyeing/pending-receipts')
 const source={id:'TMF-LENGTH-SOURCE',documentNo:'TMF-LENGTH-ISSUE',type:'ISSUE',origin:{kind:'WAREHOUSE',id:'TMF-ACC',name:'辅料仓',warehouseAttribute:'辅料中央仓'},targetFactoryId:'ID-F003',targetFactoryName:'GTG',createdAt:'2026-09-20 08:00',createdBy:'仓管',approvedAt:'2026-09-20 08:01',approvedBy:'主管',lines:[{id:'TMF-LENGTH-LINE',measurementBasis:'CONTINUOUS_LENGTH',material:{sku:'TMF-WHITE',name:'白色织带',kind:'ACCESSORY',imageUrl:'/materials/tmf/webbing-reference-white.jpg',color:'白',composition:'测试材质',specification:'30mm测试规格',batchNo:'TMF-BATCH'},plannedQty:650,sentQty:650,unit:'米',rolls:[],label:'TMF-BATCH',dyeOrderId:'TMF-LENGTH-DYE'}]}
 await page.evaluate(async source=>{
 const url=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/data/fcs/factory-receiving.ts')?.name??'/src/data/fcs/factory-receiving.ts'
 const m=await import(url);m.registerFactoryReceivingSource(source)
 },source)
 const url='http://127.0.0.1:43188/fcs/craft/dyeing/pending-receipts?factory=ID-F003&code=TMF-LENGTH-SOURCE'
 const act=name=>page.locator(`[data-factory-receiving-action="${name}"]`)
 for(const [qty,bad] of [[648,651],[2,3]]){
  await page.goto(url)
  await page.locator('[data-rinclude]').check()
  assert.equal(await page.locator('[data-rfield="weightKg"]').count(),0)
  await page.locator('[data-rfield="businessQty"]').fill(String(bad))
  await act('review').click()
  await page.waitForFunction(()=>document.querySelector('[data-receiving-feedback]')?.textContent?.includes('超过'))
  await page.locator('[data-rfield="businessQty"]').fill(String(qty))
  await act('review').click()
  await act('save').waitFor({state:'visible'})
  assert.match(await page.locator('[data-factory-receiving-content]').innerText(),new RegExp(`${qty}.000 米`))
  await act('save').click()
  await page.getByText('接收已保存。正数明细已入本厂待加工仓，零接收已记录。',{exact:true}).waitFor()
  assert.match(await page.locator('[data-factory-receiving-content]').innerText(),new RegExp(`${qty}.000 米`))
 }
 await page.goto('http://127.0.0.1:43188/fcs/craft/dyeing/pending-receipts?sourceId=TMF-LENGTH-SOURCE')
 assert.match(await page.locator('[data-factory-receiving-content]').innerText(),/650.000 米/)
 assert.match(await page.locator('[data-factory-receiving-content]').innerText(),/相符/)
 const facts=await page.evaluate(async()=>{
 const m=await import('/src/data/fcs/factory-receiving-warehouse.ts')
 return {projection:m.getDyeFactoryReceiptProjection('TMF-LENGTH-DYE','米'),inbound:m.buildFactoryReceiptInboundRecords().filter(r=>r.sourceRecordNo==='TMF-LENGTH-ISSUE')}
 })
 assert.equal(facts.projection.reduce((n,r)=>n+r.qty,0),650)
 assert.equal(facts.inbound.reduce((n,r)=>n+r.receivedQty,0),650)
 assert.ok(facts.inbound.every(r=>r.unit==='米'))
 await page.setViewportSize({width:1024,height:768})
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.screenshot({path:'output/playwright/tmf-webbing/continuous-factory-receipt.png'})
 evidence.checks.push('已交出650米来源→实际页面648+2分批实收，651及余量3米阻断；表单无需虚构重量，复核/保存/刷新按米显示；染色投入投影和待加工仓入库均650米')
 evidence.facts=facts;assert.deepEqual(evidence.errors,[])
}catch(e){evidence.failure=String(e);throw e}finally{writeFileSync('output/playwright/tmf-webbing/continuous-factory-receipt-evidence.json',JSON.stringify(evidence,null,2));await browser.close()}
