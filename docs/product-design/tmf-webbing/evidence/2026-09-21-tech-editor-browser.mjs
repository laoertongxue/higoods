import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import { chromium } from 'playwright'
const browser = await chromium.launch({headless:true})
const evidence={generatedAt:new Date().toISOString(),route:'/pcs/products/styles/style_seed_project_018/technical-data/tdv_seed_project_018_review_skip_demo',viewport:{width:1366,height:768},server:'http://127.0.0.1:43288',checks:[],errors:[]}
try {
 const page = await browser.newPage({viewport:evidence.viewport})
 page.on('pageerror', error=>evidence.errors.push(error.message))
 page.on('dialog', async dialog=>{evidence.errors.push(dialog.message());await dialog.dismiss()})
 await page.goto(`http://127.0.0.1:43288${evidence.route}`)
 await page.waitForSelector('[data-tech-action="switch-tab"][data-tab="bom"]')
 await page.locator('[data-tech-action="switch-tab"][data-tab="bom"]').click()
 await page.waitForSelector('[data-testid="tech-pack-regular-bom-table"]')
 await page.locator('[data-tech-action="open-add-bom"]').first().click()
 await page.waitForSelector('[data-testid="tech-pack-bom-form-dialog"]')
 await page.locator('[data-tech-field="new-bom-type"]').selectOption('辅料')
 await page.locator('[data-tech-field="new-bom-material-sku"]').selectOption('tmf-webbing-reference-white')
 await page.locator('[data-tech-field="new-bom-usage"]').fill('1')
 await page.locator('[data-tech-action="save-bom"]').click()
 await page.waitForSelector('[data-testid="tech-pack-bom-form-dialog"]',{state:'hidden'})
 evidence.checks.push('通过实际BOM表单选择白色织带参考SKU')
 await page.locator('[data-tech-action="switch-tab"][data-tab="process"]').click()
 await page.waitForSelector('[data-tech-action="open-webbing-specifications"]')
 evidence.editorOpenSamples=[]
 for(let i=0;i<5;i++){
  const elapsed=await page.evaluate(async()=>{
   const started=performance.now();document.querySelector('[data-tech-action="open-webbing-specifications"]').click();
   let modal;
   while(!(modal=document.querySelector('#tmf-webbing-specification-dialog'))?.querySelector('[name="usage"]')) {
    if(performance.now()-started>5000) throw new Error('编辑器未就绪');
    await new Promise(r=>requestAnimationFrame(r));
   }
   await Promise.all([...modal.querySelectorAll('img')].map(img=>img.complete?Promise.resolve():new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('物料图片失败'))})));
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   return performance.now()-started;
  });
  evidence.editorOpenSamples.push(elapsed);
  await page.locator('#tmf-webbing-specification-dialog [data-webbing-action="close"]').last().click();
 }
 await page.locator('[data-tech-action="open-webbing-specifications"]').first().click()
 const modal=page.locator('#tmf-webbing-specification-dialog')
 await modal.waitFor()
 await modal.locator('[data-webbing-action="save"]').click()
 assert.match(await modal.locator('[data-webbing-error]').innerText(),/请确认物料/)
 await modal.locator('[name="confirmedObject"]').check()
 for(const [name,value] of Object.entries({usage:'腰带',garmentSize:'S',piecesPerGarment:'1',cutLengthMm:'500',finishedLengthMm:'500',toleranceMm:'2',measurementCondition:'自然平放',cuttingMethod:'冷切',acceptanceRequirement:'按确认样'})) await modal.locator(`[name="${name}"]`).fill(value)
 await modal.locator('[data-webbing-action="save"]').click()
 assert.match(await modal.locator('[data-webbing-error]').innerText(),/明确选择/)
 await modal.locator('[name="tippingRequired"]').selectOption('false')
 await modal.locator('[data-webbing-action="add"]').click()
 for(const [name,value] of Object.entries({usage:'腰带',garmentSize:'M',piecesPerGarment:'1',cutLengthMm:'700',finishedLengthMm:'700',toleranceMm:'2',measurementCondition:'自然平放',cuttingMethod:'冷切',acceptanceRequirement:'按确认样'})) await modal.locator(`[name="${name}"]`).fill(value)
 await modal.locator('[name="tippingRequired"]').selectOption('false')
 await modal.locator('[data-webbing-action="save"]').click()
 await modal.waitFor({state:'hidden'})
 assert.match(await page.locator('[data-testid="tech-pack-process-tab"]').innerText(),/织带／绳子截断/)
 evidence.checks.push('未确认对象和未选择打头要求均阻断；保存S500/M700两规格并显示截断节点')
 await page.reload()
 await page.waitForSelector('[data-tech-action="switch-tab"][data-tab="process"]')
 await page.locator('[data-tech-action="switch-tab"][data-tab="process"]').click()
 await page.locator('[data-tech-action="open-webbing-specifications"]').first().click()
 await modal.waitFor()
 assert.equal(await modal.locator('[name="cutLengthMm"]').inputValue(),'500')
 await modal.locator('[name="selectedRow"]').selectOption('1')
 assert.equal(await modal.locator('[name="cutLengthMm"]').inputValue(),'700')
 assert.equal(await modal.locator('[name="garmentSize"]').inputValue(),'M')
 evidence.checks.push('刷新并重新打开后，两规格长度与尺码保留')
 await page.screenshot({path:'output/playwright/tmf-webbing/editor-first.png'})
 await page.keyboard.press('Escape')
 await modal.waitFor({state:'hidden'})
 evidence.checks.push('Esc关闭弹窗')
 console.log(JSON.stringify(evidence,null,2))
} catch(error){evidence.failure=String(error);console.log(JSON.stringify(evidence,null,2));throw error}
finally {writeFileSync('docs/product-design/tmf-webbing/evidence/2026-09-21-tech-editor-browser-current.json',JSON.stringify(evidence,null,2));await browser.close()}
