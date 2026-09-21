import {chromium} from 'playwright'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
const dir='docs/product-design/tmf-webbing/evidence'
const server='http://127.0.0.1:43288'
const routes=[
 ['purchase','/fcs/craft/accessory/webbing/purchase-demands','[data-tmf-base-page="purchase-demands"]','tmf-purchase-demands'],
 ['base','/fcs/craft/accessory/webbing/base-orders','[data-tmf-base-page="base-orders"]','tmf-base-orders'],
 ['work','/fcs/craft/accessory/webbing/work-orders','[data-tmf-work-orders]','tmf-work-orders'],
 ['prep','/wls/accessory-material-preparation','[data-tmf-preparation]','tmf-preparation'],
 ['stock','/wls/accessory-production-stock','[data-tmf-output-stock]','tmf-output-stock'],
 ['production','/wls/accessory-production-receipts','[data-tmf-production-receipts]',null],
 ['pda','/wls/raw/pda/tmf-output-receipts','[data-tmf-pda-receipt-root]',null],
 ['pms','/pms/material-purchase-orders','[data-pms-mpo-root]',null],
]
const out={startedAt:new Date().toISOString(),head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),worktree:process.cwd(),server,browser:'',samples:[],coverageGaps:['未纳入本脚本的详情、技术包发布、打印、全部写入/异常动作仍需测量；本脚本不能证明全量性能通过'],errors:[]}
const b=await chromium.launch();out.browser=b.version()
async function ready(p,r){await p.locator(r[2]).waitFor({state:'visible'});await p.locator(r[2]).evaluate(async el=>{if(!el.textContent.trim())throw Error('业务内容为空');const visible=[...el.querySelectorAll('img')].filter(i=>{const q=i.getBoundingClientRect();return q.width&&q.height&&q.top<innerHeight&&q.bottom>0});await Promise.all(visible.map(i=>i.decode()));await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});}
async function sample(p,r,kind,run,act){const t=performance.now();try{await act();await ready(p,r);const ms=performance.now()-t;out.samples.push({route:r[1],kind,run,ms,pass:ms<500});}catch(e){out.samples.push({route:r[1],kind,run,ms:performance.now()-t,pass:false,error:String(e)});}fs.writeFileSync(`${dir}/ready-performance-current.json`,JSON.stringify(out,null,2));}
try{for(const r of routes){console.log('route '+r[0]);for(let run=1;run<=5;run++){const c=await b.newContext({viewport:r[0]==='pda'?{width:390,height:844}:{width:1366,height:768}});const p=await c.newPage();p.setDefaultTimeout(6000);p.on('pageerror',e=>out.errors.push({route:r[1],message:e.message}));await sample(p,r,'cold-navigation',run,()=>p.goto(server+r[1],{waitUntil:'domcontentloaded'}));await sample(p,r,'refresh',run,()=>p.reload({waitUntil:'domcontentloaded'}));
 if(r[3]){for(const [action,label] of [['query','查询'],['reset','重置'],['open-column-settings','列设置']]){const button=p.locator(`${r[2]} [data-${r[3]}-action="${action}"]`).first();if(await button.count()){await sample(p,r,'interaction:'+label,run,async()=>{await button.click();if(action==='open-column-settings')await p.getByText('恢复默认').waitFor({state:'visible'});});if(label==='列设置')await p.keyboard.press('Escape');}else{out.coverageGaps.push(`${r[1]} 缺少可定位的${label}入口`)}}}
 // Only an actual rendered navigation control can establish a station-internal switch.
 await p.goto(server+'/fcs/craft/accessory/webbing/purchase-demands',{waitUntil:'domcontentloaded'});await ready(p,routes[0]);await sample(p,r,'route-switch-navigation',run,async()=>{await p.goto(server+r[1],{waitUntil:'domcontentloaded'});});await c.close();}}
}finally{await b.close();out.finishedAt=new Date().toISOString();out.summary={samples:out.samples.length,failed:out.samples.filter(s=>!s.pass).length,maxMs:Math.max(...out.samples.map(s=>s.ms)),fullAcceptance:false};fs.writeFileSync(`${dir}/ready-performance-current.json`,JSON.stringify(out,null,2));console.log(JSON.stringify(out.summary));}
