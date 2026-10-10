"""独立 Playwright CLI profile：模拟裁床 DB 打开失败，实际按钮恢复；不清理任何库。"""
import json,re,subprocess,pathlib
CLI='/Users/laoer/.npm/_npx/31e32ef8478fbf80/node_modules/@playwright/cli/playwright-cli.js'
SESSION='release-open-failure'
CODE=r'''async page => {
await page.addInitScript(()=>{const open=IDBFactory.prototype.open;IDBFactory.prototype.open=function(name,...rest){if(name==='higood-cutting-records-v1' && localStorage.getItem('RELEASE-VERIFY-IDB-ALLOW')!=='yes')throw new DOMException('独立验收：本地资料暂时不可读','SecurityError');return open.call(this,name,...rest)} });
const samples=[],failures=[];
for(let i=0;i<5;i++){
await page.goto('http://127.0.0.1:4190/fcs/craft/cutting/cut-piece-release');
await page.locator('[data-cutting-record-retry]').waitFor({state:'visible'});
const failureText=await page.locator('[data-cutting-record-retry]').evaluate(el=>el.parentElement.textContent);
if(!failureText.includes('原记录没有被覆盖'))throw new Error('读取失败缺少明确旧资料保留提示');
failures.push(await page.evaluate(async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.now()}));
if(i===0)await page.screenshot({path:'output/playwright/cut-release-storage/idb-open-failure.png'});
await page.evaluate(()=>localStorage.setItem('RELEASE-VERIFY-IDB-ALLOW','yes'));
const start=await page.evaluate(()=>{const button=document.querySelector('[data-cutting-record-retry]');const start=performance.timeOrigin+performance.now();button.click();return start});
await page.locator('[data-cut-piece-release-page]').waitFor({state:'visible'});
await page.waitForFunction(()=>!document.querySelector('[data-cutting-record-retry]'));
const elapsed=await page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(im=>im.getBoundingClientRect().width>0).map(im=>im.decode().catch(()=>undefined)));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.timeOrigin+performance.now()})-start;
samples.push(elapsed);
if(i===0)await page.screenshot({path:'output/playwright/cut-release-storage/idb-open-recovered.png'});
await page.evaluate(()=>localStorage.removeItem('RELEASE-VERIFY-IDB-ALLOW'));
}
return {passed:[...samples,...failures].every(t=>t<=1000),samples,failures,max:Math.max(...samples,...failures),runtime:'http://127.0.0.1:4190',isolatedProfile:true};
}'''
r=subprocess.run([CLI,'-s='+SESSION,'run-code',CODE],capture_output=True,text=True)
log=r.stdout+r.stderr
pathlib.Path('output/playwright/cut-release-storage/idb-open-run.log').write_text(log)
found=re.search(r'### Result\n([^\n]+)',log)
if not found:raise RuntimeError(log)
result=json.loads(found.group(1));result['script']=__file__;result['log']='output/playwright/cut-release-storage/idb-open-run.log'
pathlib.Path('docs/product-design/evidence/2026-10-09-cut-piece-release/idb-open-browser.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False));assert result['passed']
