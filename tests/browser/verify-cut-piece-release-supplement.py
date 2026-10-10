"""Playwright CLI 独立资料：补料入口读取保存目标及最新实物；不创建补料单。"""
import json
import os
import pathlib
import re
import subprocess
import time

CLI = '/Users/laoer/.npm/_npx/31e32ef8478fbf80/node_modules/@playwright/cli/playwright-cli.js'
SESSION = os.environ.get('RELEASE_SUPPLEMENT_SESSION', 'release-supplement-'+str(int(time.time())))
CODE = r'''async page => {
const result={startedAt:new Date().toISOString(),scenarios:[],assertions:[],screenshots:[],scope:'放行目标/最新实物补料读取，保留既有人工创建规则'};
const base='http://127.0.0.1:4190';
const release='/fcs/craft/cutting/cut-piece-release?productionOrderId=po-14671';
const supplement='/fcs/craft/cutting/supplement-management?mode=create&releaseSnapshotId=cpr-target-po-14671-v9';
const action=n=>page.locator(`[data-cutting-supplement-action="${n}"]`).last();
const ready=()=>page.evaluate(async()=>{await document.fonts.ready;await Promise.all([...document.images].filter(im=>!im.classList.contains('hidden')).map(im=>im.decode()));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));return performance.timeOrigin+performance.now()});
const assert=(name,ok,detail)=>{result.assertions.push({name,passed:!!ok,detail});if(!ok)throw new Error(name+': '+JSON.stringify(detail))};
const sample=async(name,operation,settle,nav=false,prepare)=>{const scene={name,samples:[],passed:false};result.scenarios.push(scene);for(let i=0;i<5;i++){if(prepare)await prepare(i);const start=await page.evaluate(()=>performance.timeOrigin+performance.now());await operation(i);if(settle)await settle(i);const end=await ready();const elapsed=nav?await page.evaluate(()=>performance.now()):end-start;scene.samples.push({index:i+1,durationMs:elapsed,complete:true});}scene.passed=scene.samples.every(s=>s.durationMs>=0&&s.durationMs<=1000)};
try {
await page.setViewportSize({width:1366,height:768});
const cdp=await page.context().newCDPSession(page);await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
await sample('补料目标入口冷启动',()=>page.goto(base+supplement,{waitUntil:'domcontentloaded'}),()=>page.locator('[data-release-snapshot-create]').waitFor({state:'visible'}),true);
await cdp.send('Network.setCacheDisabled',{cacheDisabled:false});
await sample('补料目标入口整页刷新',()=>page.reload({waitUntil:'domcontentloaded'}),()=>page.locator('[data-release-snapshot-create]').waitFor({state:'visible'}),true);
// 前置导航仅准备；按钮事件到完整结果单独计时。
await sample('放行去补料按钮及完整结果',async()=>{await page.locator('[data-cut-piece-release-action="go-supplement"]').click()},async()=>{await page.locator('[data-release-snapshot-create]').waitFor();assert('原目标与当前实物版本分别标明',(await page.locator('[data-release-snapshot-trace]').innerText()).includes('目标数量 V9')&&(await page.locator('[data-release-snapshot-trace]').innerText()).includes('当前实物 V'))},false,async()=>{await page.goto(base+release);await page.locator('[data-cut-piece-release-action="go-supplement"]').waitFor();await ready()});
await sample('缺原因不提交且具体错误',()=>action('submit-release-snapshot-draft').click(),async()=>{await page.waitForFunction(()=>document.querySelector('[data-supplement-draft-error]')?.textContent==='补料原因必须选择。'&&!document.querySelector('[data-supplement-draft-error]')?.classList.contains('hidden'));assert('原因必填',await page.locator('[data-supplement-draft-error]').innerText()==='补料原因必须选择。')});
await sample('原裁片单选择',i=>page.locator('[data-release-original-cut-order]').selectOption({label:i%2?'CUT14671-B':'CUT14671-A'}),()=>{});
await sample('补料原因选择',()=>page.locator('[data-supplement-reason]').selectOption('裁片损耗'),()=>{});
await sample('补料原因填写',i=>page.locator('[data-supplement-reason-detail]').fill('独立原型验收：按最新有效实物核对 '+i),()=>{});
await sample('人工提交到确认页再返回保留来源',()=>action('submit-release-snapshot-draft').click(),async()=>{await page.locator('[data-supplement-confirm-page]').waitFor({state:'visible'});assert('单一原裁片单及最新数量来源保留',(await page.locator('[data-supplement-confirm-page]').innerText()).includes('CUT14671-A'));},false,async i=>{if(i){await action('return-draft').click();await page.locator('[data-release-snapshot-create]').waitFor();await ready()}});
await sample('从确认页返回草稿',()=>action('return-draft').click(),()=>page.locator('[data-release-snapshot-create]').waitFor(),false,async i=>{if(i){await action('submit-release-snapshot-draft').click();await page.locator('[data-supplement-confirm-page]').waitFor();await ready()}});
const beforeTrace=await page.locator('[data-release-snapshot-trace]').innerText();
const source=await page.context().newPage();
// 本示例同部位有120片与100片两张已装袋票。仅登记120片那张不可用，剩100片，208件目标缺108片。
const validityScene={name:'整票变化后补料用最新实物且目标保持208件',samples:[],passed:false};result.scenarios.push(validityScene);
for(let i=0;i<5;i++){
await source.goto(base+release);await source.locator('[data-testid="cell-Black-M-A"]').click();await source.locator('[data-testid="cut-piece-release-cell-drawer"]').waitFor();
const ticket=source.locator('[data-release-ticket-id]').first();const ticketId=await ticket.getAttribute('data-release-ticket-id');
await ticket.locator('[data-cut-piece-release-field="ticketValidityReason"]').fill('补料最新实物复演 '+i);
source.once('dialog',d=>d.accept());await ticket.locator('[data-cut-piece-release-action="set-ticket-validity"]').click();
await source.waitForFunction(({id,unusable})=>{const button=document.querySelector(`[data-release-ticket-id="${CSS.escape(id)}"] [data-cut-piece-release-action="set-ticket-validity"]`);return button?.dataset.ticketValid===String(unusable)&&!button.disabled},{id:ticketId,unusable:i%2===0});
const savedValidity=await source.evaluate(async id=>{const request=indexedDB.open('higood-cutting-records-v1');const db=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});try{const tx=db.transaction('records','readonly');const request=tx.objectStore('records').getAll();const values=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});await new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)});return values.filter(row=>row.collection==='cut-piece-ticket-validity'&&row.value.ticketId===id).map(row=>row.value).sort((a,b)=>b.version-a.version)[0]}finally{db.close()}},ticketId);
assert('整票登记已持久完成 '+i,savedValidity?.valid===(i%2!==0)&&savedValidity.reason==='补料最新实物复演 '+i,savedValidity);
assert('已确认目标不被整票变化改写 '+i,(await source.locator('[data-target-color="Black"][data-target-size="M"]').innerText()).includes('208 件'));
await page.reload({waitUntil:'domcontentloaded'});await page.locator('[data-release-snapshot-create]').waitFor();await ready();
const rows=await page.locator('[data-release-snapshot-shortage-row]').allTextContents();const part=rows.find(r=>r.includes('Black')&&r.includes('M')&&!r.includes('XL')&&r.includes('面料 A'));
assert('最新实物缺口而非旧快照 '+i,i%2===0?!!part&&part.includes('实际缺片 108 片'):!part,{ticketId,part,trace:await page.locator('[data-release-snapshot-trace]').innerText()});
validityScene.samples.push({index:i+1,durationMs:await page.evaluate(()=>performance.now()),complete:true});
}
validityScene.passed=validityScene.samples.every(s=>s.durationMs<=1000);await source.close();
for(const [width,height] of [[1366,768],[1280,720],[1024,768]]){await page.setViewportSize({width,height});await page.locator('[data-release-snapshot-create]').scrollIntoViewIfNeeded();const path=`output/playwright/cut-release-supplement/latest-physical-${width}x${height}.png`;await page.screenshot({path});result.screenshots.push(path);assert('可用目标入口尺寸 '+width,await page.locator('[data-release-original-cut-order]').isVisible())}
result.traceBefore=beforeTrace;result.traceAfter=await page.locator('[data-release-snapshot-trace]').innerText();
} catch(error){result.error=String(error)}
result.completedAt=new Date().toISOString();result.passed=!result.error&&result.scenarios.every(s=>s.passed)&&result.assertions.every(a=>a.passed);return result;
}'''

subprocess.run([CLI, '-s='+SESSION, 'open', 'about:blank'], capture_output=True, text=True, check=True)
run = subprocess.run([CLI, '-s='+SESSION, 'run-code', CODE], capture_output=True, text=True)
log = run.stdout + run.stderr
output = pathlib.Path('output/playwright/cut-release-supplement')
output.mkdir(parents=True, exist_ok=True)
(output/'supplement-browser.log').write_text(log)
match = re.search(r'### Result\n([^\n]+)', log)
if not match:
    raise RuntimeError(log)
data = json.loads(match.group(1))
data.update(script=__file__, log=str(output/'supplement-browser.log'), runtime='http://127.0.0.1:4190', browserSession=SESSION,
            priorFailure='output/playwright/cut-release-supplement/supplement-before-readonly-bootstrap.json')
pathlib.Path('docs/product-design/evidence/2026-10-09-cut-piece-release/supplement-browser.json').write_text(json.dumps(data, ensure_ascii=False, indent=2))
print(json.dumps(data, ensure_ascii=False))
assert data['passed']
