import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {readFileSync,writeFileSync} from 'node:fs'
import {transformSync} from 'esbuild'
const text=readFileSync('tests/unit/tmf-continuous-factory-receipt.test.ts','utf8'),start=text.indexOf("test('原生连续辅料染色")
const source=text.slice(text.indexOf('const source:'),text.indexOf("test('连续织带"))
const fixture=text.slice(text.indexOf(" const id='TMF-NATIVE-DYE'",start),text.indexOf(' }finally',start)).replace(' try{','')
const imports=`const load=async(path)=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path);const dye=await load('/src/data/fcs/dyeing-task-domain.ts');const {registerFactoryReceivingSource,prepareFactoryReceipt,savePreparedFactoryReceipt,getDefaultFactoryReceiptPosition,listFactoryMaterialUses}=await load('/src/data/fcs/factory-receiving.ts');const {getDyeFactoryReceiptProjection}=await load('/src/data/fcs/factory-receiving-warehouse.ts');const assert={equal(a,b){if(a!==b)throw Error('fixture equality '+a+' != '+b)},deepEqual(a,b){if(JSON.stringify(a)!==JSON.stringify(b))throw Error('fixture changed')},throws(fn,re){try{fn()}catch(e){if(re.test(e.message))return;throw e}throw Error('expected rejection')}};`
const compile=code=>transformSync(`(async()=>{${imports}${code}})()`,{loader:'ts',target:'esnext'}).code
const evidence={checks:[],errors:[],scope:'原生染色650米实际收料至640米产出及交出缺图阻断；从仓库已交来源开始，非完整N01采购/技术包/印花链，无全入口性能证据；登记来源为独立单元夹具，未保存生产主单，刷新恢复不在本脚本通过范围'}
const browser=await chromium.launch({headless:true})
try{
 const context=await browser.newContext({viewport:{width:1366,height:768}}),page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>evidence.errors.push(e.message))
 const url='http://127.0.0.1:43188/fcs/craft/dyeing/pending-handover'
 await page.goto(url);await page.locator('[data-dye-output-page]').waitFor()
 const facts=await page.evaluate(compile(`${source}${fixture};return {used:listFactoryMaterialUses(id).flatMap(u=>u.lines).reduce((n,l)=>n+l.qty,0),output:dye.getDyeDispatchAvailableQty(id),image:dye.getDyeDispatchMaterial(id).imageUrl};`))
 assert.deepEqual(facts,{used:650,output:640,image:'/materials/tmf/webbing-real-box.jpg'});evidence.facts=facts
 await page.locator('[data-dye-output-field="keyword"]').fill('TMF-NATIVE-DYE');await page.locator('[data-dye-output-action="query"]').click()
 const row=page.locator('tbody tr').filter({has:page.locator('[data-dye-output-select-order="TMF-NATIVE-DYE"]')})
 await row.waitFor();assert.match(await row.innerText(),/640.00 米/);assert.match(await row.innerText(),/缺对应实物图/)
 const material=row.locator('td').filter({hasText:'TMF-BLUE'});assert.equal(await material.locator('img').count(),1)
 assert.equal(await page.locator('[data-dye-output-select-order="TMF-NATIVE-DYE"]').isDisabled(),true)
 evidence.checks.push('650米实际工厂实收、原生排缸/染色/脱水/烘干/定型/卷布/包装产出640米；白坯图未沿用至蓝色产出')
 evidence.checks.push('同页重新查询待交出列表640米，缺少蓝色产出专用图时选择和交出均被阻断；不使用白坯图冒充')
 await page.setViewportSize({width:1024,height:768});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)
 await page.screenshot({path:'output/playwright/tmf-webbing/native-dye.png',fullPage:true})
 const saved=await page.evaluate(compile(`return {docs:dye.listDyeDispatchDocuments().filter(d=>d.lines.some(l=>l.orderId==='TMF-NATIVE-DYE')).length,output:dye.getDyeDispatchAvailableQty('TMF-NATIVE-DYE')};`));assert.deepEqual(saved,{docs:1,output:640})
 evidence.saved=saved;assert.deepEqual(evidence.errors,[])
}catch(e){evidence.failure=String(e);throw e}finally{writeFileSync('output/playwright/tmf-webbing/native-dye-browser.json',JSON.stringify(evidence,null,2));await browser.close()}
