import assert from 'node:assert/strict'
import {chromium} from 'playwright'
import {writeFileSync} from 'node:fs'
const browser=await chromium.launch({headless:true}),evidence={route:'/fcs/craft/accessory/webbing/base-orders',checks:[],errors:[]}
try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});page.on('pageerror',e=>evidence.errors.push(e.message))
 await page.goto('http://127.0.0.1:43188'+evidence.route);await page.locator('[data-tmf-base-page="base-orders"]').waitFor()
 await page.evaluate(async()=>{
  const load=path=>import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path)
  const m=await load('/src/data/pms/tmf-material-purchases.ts'),demo=await load('/src/data/fcs/tmf-base-demo.ts');demo.loadTmfBaseDemoPurchases()
  const factory={id:'RAW-TEST-SUP',name:'测试主管',role:'织带厂主管'},warehouse={id:'RAW-TEST-WH',name:'测试仓管',role:'仓管'},no='TMF-DEMO-PO-001'
  m.generateTmfBaseOrder(no,factory,'raw-generate');const base=m.getTmfPurchaseState().baseOrders.find(b=>b.purchaseOrderNo===no)
  m.acceptTmfBaseOrder(base.id,factory,'raw-accept');m.startTmfBaseOrder(base.id,factory,'raw-start')
  m.receiveTmfBaseMaterialStock({id:'RAW-LOT',materialSkuId:'YARN-DEMO-01',warehouseId:'YARN-WH',location:'Y-01',sourceReceiptNo:'RAW-SOURCE-RECEIPT',sourceReceiptLineId:'L1',unit:'kg',receivedQty:12},warehouse,'raw-stock')
  m.dispatchTmfBaseMaterial({id:'RAW-ISS',baseOrderId:base.id,lotId:'RAW-LOT',quantity:12},warehouse,'raw-dispatch')
 })
 await page.reload();const root=page.locator('[data-tmf-base-page="base-orders"]');await root.waitFor()
 const act=name=>root.locator(`[data-tmf-base-orders-action="${name}"]`),dialog=root.locator('[data-tmf-dialog]'),read=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('higood-tmf-material-purchases-v1')))
 await root.locator('[name="keyword"]').fill('TMF-DEMO-PO-001');await act('query').click();await act('raw').click()
 assert.match(await dialog.innerText(),/厂内剩余 0 kg/);assert.match(await dialog.innerText(),/原料实物图待补/)
 await act('raw-receive').click();await dialog.locator('[name="rawSku"]').fill('YARN-DEMO-01');await dialog.locator('[name="rawScan"]').fill('WRONG');await dialog.locator('[name="quantity"]').fill('12');await dialog.locator('[name="rawConfirmed"]').check()
 let before=await read();await act('confirm').click();assert.match(await dialog.locator('[data-tmf-dialog-error]').innerText(),/发料单不符/);assert.deepEqual(await read(),before)
 await dialog.locator('[name="rawScan"]').fill('RAW-ISS');await dialog.locator('[name="quantity"]').fill('13');await act('confirm').click();assert.match(await dialog.locator('[data-tmf-dialog-error]').innerText(),/超过/);assert.deepEqual(await read(),before)
 await dialog.locator('[name="quantity"]').fill('12');await act('confirm').click();assert.match(await dialog.innerText(),/厂内剩余 12 kg/)
 await act('raw-consume').click();await dialog.locator('[name="rawSku"]').fill('YARN-DEMO-01');await dialog.locator('[name="quantity"]').fill('11');await dialog.locator('[name="rawScrap"]').fill('2');await dialog.locator('[name="rawReason"]').fill('实际称量记录');await dialog.locator('[name="rawConfirmed"]').check()
 before=await read();await act('confirm').click();assert.match(await dialog.locator('[data-tmf-dialog-error]').innerText(),/不能超过/);assert.deepEqual(await read(),before)
 await dialog.locator('[name="quantity"]').fill('10');await dialog.locator('[name="rawScrap"]').fill('0');await act('confirm').click();assert.match(await dialog.innerText(),/厂内剩余 2 kg/)
 await act('raw-return').click();await dialog.locator('[name="rawSku"]').fill('YARN-DEMO-01');await dialog.locator('[name="rawReturn"]').fill('RAW-RETURN');await dialog.locator('[name="quantity"]').fill('3');await dialog.locator('[name="rawReason"]').fill('未用原料交回原仓');await dialog.locator('[name="rawConfirmed"]').check()
 before=await read();await act('confirm').click();assert.match(await dialog.locator('[data-tmf-dialog-error]').innerText(),/超过/);assert.deepEqual(await read(),before)
 await dialog.locator('[name="quantity"]').fill('1');await act('confirm').click();assert.match(await dialog.innerText(),/厂内剩余 1 kg/);assert.match(await dialog.innerText(),/原仓已收退料 0 kg/)
 assert.equal((await read()).baseMaterialLots.find(l=>l.id==='RAW-LOT').onHandQty,0)
 await act('close-dialog').last().click();await act('report').click();await dialog.locator('[name="quantity"]').fill('100');await act('confirm').click()
 const end=await page.evaluate(async()=>{
  const path='/src/data/pms/tmf-material-purchases.ts',m=await import(performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path),warehouse={id:'RAW-TEST-WH',name:'测试仓管',role:'仓管'}
  m.receiveTmfBaseMaterialReturn({returnId:'RAW-RETURN',warehouseId:'YARN-WH',materialSkuId:'YARN-DEMO-01',unit:'kg',quantity:1},warehouse,'raw-return-receive')
  return m.getTmfPurchaseState()
 })
 assert.equal(end.baseMaterialLots.find(l=>l.id==='RAW-LOT').receivedQty,12);assert.equal(end.baseMaterialLots.find(l=>l.id==='RAW-LOT').onHandQty,1)
 assert.equal(end.baseOrders.find(b=>b.purchaseOrderNo==='TMF-DEMO-PO-001').producedMeters,100)
 await page.reload();await root.waitFor();await root.locator('[name="keyword"]').fill('TMF-DEMO-PO-001');await act('query').click();await act('raw').click();assert.match(await dialog.innerText(),/原仓已收退料 1 kg/);assert.match(await dialog.innerText(),/厂内剩余 1 kg/)
 for(const viewport of [{width:1280,height:720},{width:1024,height:768}]){await page.setViewportSize(viewport);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true)}
 evidence.checks.push('错发料号/超收/超耗用/超退回均不改账，修正后12kg=耗10+交回1+厂内1；原仓实际收回前不增加库存','基础页面实际填报100米不改重量账，仓库动作确认退料后刷新同事实；两低分辨率主体无溢出')
 assert.deepEqual(evidence.errors,[]);evidence.result='PASS'
}finally{await browser.close();writeFileSync('output/playwright/tmf-webbing/base-raw-ui-browser.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2))}
