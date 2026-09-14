import { escapeHtml as e } from '../../utils'
import { getBrowserLocalStorage, readBrowserStorageItem, writeBrowserStorageItem } from '../../data/browser-storage'
import { materials, stock, demands, supplies, snapshot } from '../../data/material-decision/fixtures'
import { assess, addDays, startDate, validatePolicy, compareCandidate } from '../../data/material-decision/calculations'
import { initialRuntime, editDraft, publishTrial, compareTrial, moveRisk } from '../../data/material-decision/workflow'
import type { Runtime, RiskState } from '../../data/material-decision/model'
import { normalizeListColumnPreferences } from '../../components/ui/list-table-model'
import { renderBody, renderDetail, renderTrial, allAssessments, selectedRows, columns, button, type UI } from './views'
const storageKey='higood.material-decision.demo.v1'
function restore():Runtime { try { const x=JSON.parse(readBrowserStorageItem(getBrowserLocalStorage(),storageKey)??'null'); if(x?.schema===1&&x.active&&x.draft&&Array.isArray(x.versions)&&Array.isArray(x.decisions)&&x.risks&&!validatePolicy(x.active).length)return x }catch{} return initialRuntime() }
export let runtime=restore()
export const ui:UI={section:'overview',query:'',category:'全部类别',scope:'全部供给池',riskOnly:false,more:false,page:1,sort:null,prefs:{order:[],visibleKeys:[],frozenKeys:['sku'],pageSize:10},role:'物料计划员',notice:'',stale:false}
let modalSku='',modalMode='detail'
function save(){ if(!writeBrowserStorageItem(getBrowserLocalStorage(),storageKey,JSON.stringify(runtime)))ui.notice='浏览器存储不可用，本次更改仅保留在当前页面会话' }
function prefKey(){return `higood.material-decision.columns.${ui.section}`}
function savePrefs(){writeBrowserStorageItem(getBrowserLocalStorage(),prefKey(),JSON.stringify(ui.prefs))}
export function enter(section:string){ui.section=section;ui.page=1;ui.sort=null; const c=columns(section);let raw=null;try{raw=JSON.parse(readBrowserStorageItem(getBrowserLocalStorage(),prefKey())??'null')}catch{} ui.prefs=normalizeListColumnPreferences(c,raw??{order:c.map(c=>c.key),visibleKeys:c.map(c=>c.key),frozenKeys:['sku'],pageSize:10},[10,20,50]);return renderBody(runtime,ui)}
function notice(message:string){ui.notice=message;document.querySelector('#md-notice')?.replaceChildren(document.createTextNode(message)); const target=document.querySelector('#md-modal-notice');if(target)target.textContent=message}
function refresh(){const root=document.querySelector('#md-page');if(root)root.innerHTML=renderBody(runtime,ui)}
function close(){document.querySelector('#md-overlay')?.remove()}
function overlay(content:string){close();const host=document.querySelector('#md-page');host?.insertAdjacentHTML('beforeend',`<div id="md-overlay" class="fixed inset-0 z-[100] flex justify-end bg-black/40" data-md-action="backdrop" data-skip-page-rerender="true"><section role="dialog" aria-modal="true" aria-label="物料决策详情" class="h-full w-full max-w-4xl overflow-auto bg-background p-5 shadow-xl"><div class="sticky top-0 z-10 flex justify-between bg-background py-2"><h2 class="font-semibold">物料监控与决策</h2>${button('关闭','close')}</div><p id="md-modal-notice" role="status" class="mb-3 text-sm text-red-600"></p>${content}</section></div>`);document.querySelector<HTMLButtonElement>('#md-overlay button')?.focus()}
function current(sku:string){const m=materials.find(m=>m.sku===sku);if(!m)throw new Error('物料不存在');return assess(m,stock,demands,supplies,runtime.active)}
function openDetail(sku:string,mode='detail'){modalSku=sku;modalMode=mode;overlay(renderDetail(current(sku),runtime,mode))}
function input(key:string):string{return document.querySelector<HTMLInputElement>(`[data-md-field="${CSS.escape(key)}"]`)?.value??''}
function requireWrite(){if(ui.role==='只读查看者')throw new Error('只读查看者不能修改演示记录')}
function readDraft(){const draft={...runtime.draft};for(const key of ['name','timezone','horizon','lead','safety','moq','pack','coefficient'] as const){const value=input(`policy-${key}`);if(key==='name'||key==='timezone')draft[key]=value;else draft[key]=Number(value)}draft.includeConditional=!!document.querySelector<HTMLInputElement>('[data-md-field="policy-includeConditional"]')?.checked;return draft}
export function handleMaterialDecisionInput(target:HTMLElement):boolean {
 const el=target.closest<HTMLInputElement>('[data-md-field]');if(!el)return false
 if(el.dataset.mdField?.startsWith('policy-')){runtime.trial=null;document.querySelector('#md-trial')?.replaceChildren();document.querySelector('#md-trial')?.insertAdjacentHTML('beforeend',renderTrial(runtime))}
 return true
}
export function handleMaterialDecisionChange(target:HTMLElement):boolean {
 const el=target.closest<HTMLInputElement>('[data-md-field]');if(!el)return false
 if(el.dataset.mdField==='override-sku'){const unit=materials.find(m=>m.sku===el.value)?.unit??'未知';const hint=document.querySelector('#md-override-unit');if(hint)hint.textContent=`当前SKU基本单位：${unit}；下方三个数量字段均使用此单位。`}
 if(el.dataset.mdField==='role'){ui.role=el.value;notice(`演示角色已切换：${ui.role}`)}
 if(el.dataset.mdField==='pageSize'){ui.prefs.pageSize=Number(el.value);ui.page=1;savePrefs();refresh()}
 return true
}
export function handleMaterialDecisionClick(target:HTMLElement):boolean {
 const el=target.closest<HTMLElement>('[data-md-action]');if(!el)return false
 const action=el.dataset.mdAction!,sku=el.dataset.sku??modalSku
 if(action==='backdrop' && target!==el)return false
 try{
 switch(action){
 case 'backdrop':if(target===el)close();break
 case 'close':close();break
 case 'query':ui.query=input('query');ui.category=input('category');ui.scope=input('scope');ui.riskOnly=!!document.querySelector<HTMLInputElement>('[data-md-field="riskOnly"]')?.checked;ui.page=1;refresh();break
 case 'reset':ui.query='';ui.category='全部类别';ui.scope='全部供给池';ui.riskOnly=false;ui.page=1;refresh();break
 case 'more':ui.query=input('query');ui.category=input('category');ui.scope=input('scope');ui.more=!ui.more;refresh();break
 case 'prev-page':ui.page=Math.max(1,ui.page-1);refresh();break
 case 'next-page':ui.page++;refresh();break
 case 'sort-column':{const key=el.dataset.columnKey!;ui.sort=ui.sort?.key===key?(ui.sort.direction==='asc'?{key,direction:'desc'}:null):{key,direction:'asc'};refresh();break}
 case 'columns':overlay(`<h3 class="font-semibold mb-3">列显示 / 顺序 / 冻结</h3>${ui.prefs.order.map(key=>{const c=columns(ui.section).find(c=>c.key===key)!;return `<div class="flex flex-wrap items-center justify-between gap-2 border-b py-2"><span>${e(c.title)}${c.required?'（必需）':''}</span><div>${!c.required?button(ui.prefs.visibleKeys.includes(key)?'隐藏':'显示','column-visible',`data-key="${key}"`):''}${c.freezeable?button(ui.prefs.frozenKeys.includes(key)?'取消冻结':'冻结','column-freeze',`data-key="${key}"`):''}${!c.actionColumn?button('上移','column-up',`data-key="${key}"`):''}</div></div>`}).join('')}`);break
 case 'column-visible':{const key=el.dataset.key!;ui.prefs.visibleKeys=ui.prefs.visibleKeys.includes(key)?ui.prefs.visibleKeys.filter(x=>x!==key):[...ui.prefs.visibleKeys,key];savePrefs();refresh();break}
 case 'column-freeze':{const key=el.dataset.key!;const set=ui.prefs.frozenKeys.includes(key)?ui.prefs.frozenKeys.filter(x=>x!==key):[...ui.prefs.frozenKeys,key];const width=columns(ui.section).filter(c=>set.includes(c.key)).reduce((n,c)=>n+c.width,0);if(width>520)throw new Error('冻结列总宽不能超过520像素');ui.prefs.frozenKeys=set;savePrefs();refresh();break}
 case 'column-up':{const idx=ui.prefs.order.indexOf(el.dataset.key!);if(idx>0)[ui.prefs.order[idx-1],ui.prefs.order[idx]]=[ui.prefs.order[idx],ui.prefs.order[idx-1]];savePrefs();refresh();break}
 case 'export':{const rows=selectedRows(runtime,ui);const data={snapshot,version:runtime.active.version,policy:runtime.active,filters:{query:ui.query,category:ui.category,scope:ui.scope},note:'本地演示数据，非线上库存',rows:rows.map(a=>({sku:a.material.sku,scope:a.material.scope,unit:a.material.unit,physical:a.physical,free:a.free,gap:a.shortage,recommended:a.recommended,issues:a.issues}))};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`物料决策-${snapshot}-V${runtime.active.version}.json`;a.click();URL.revokeObjectURL(url);notice('已导出当前筛选、快照和口径版本');break}
 case 'detail':openDetail(sku);break
 case 'risk':openDetail(sku,'risk');break
 case 'stale':ui.stale=!ui.stale;refresh();break
 case 'save-draft':requireWrite();editDraft(runtime,readDraft());save();notice('草稿已保存，正式结果未改变');break
 case 'override-add':{requireWrite();const draft=readDraft();const sku=input('override-sku');if(draft.overrides?.some(o=>o.sku===sku))throw new Error('同一SKU已有策略，请先移除旧策略，避免同优先级冲突');draft.overrides=[...(draft.overrides??[]),{sku,lead:Number(input('override-lead')),safety:Number(input('override-safety')),moq:Number(input('override-moq')),pack:Number(input('override-pack'))}];const errors=validatePolicy(draft);if(errors.length)throw new Error(errors.join('；'));editDraft(runtime,draft);save();refresh();notice('SKU策略已加入草稿，需重新试算');break}
 case 'override-remove':requireWrite();editDraft(runtime,{...readDraft(),overrides:(runtime.draft.overrides??[]).filter(o=>o.sku!==sku)});save();refresh();break
 case 'trial':{requireWrite();const draft=readDraft();const errors=validatePolicy(draft);if(errors.length)throw new Error(errors.join('；'));editDraft(runtime,draft);runtime.trial=compareTrial(allAssessments(runtime),materials.map(m=>assess(m,stock,demands,supplies,draft)),draft);save();refresh();notice('同一快照试算完成；未产生真实占用或业务单据');break}
 case 'publish':requireWrite();publishTrial(runtime,ui.role);save();refresh();notice('本地模拟发布成功；未发布线上规则');break
 case 'rollback':{requireWrite();if(runtime.versions.length<2)throw new Error('尚无上一版本');editDraft(runtime,{...runtime.versions.at(-2)!.policy,version:runtime.active.version+1});save();refresh();notice('旧参数已恢复为新草稿，请重新试算');break}
 case 'compare':{const a=current(sku);if(a.recommended===null)throw new Error('数据未核实，无法作确定方案比较');const result=compareCandidate(a,Number(input('decision-qty')),addDays(startDate,runtime.active.overrides?.find(o=>o.sku===sku)?.lead??runtime.active.lead));const node=document.querySelector('#md-comparison');if(node)node.textContent=`原最大缺口 ${result.originalGap} → 残余 ${result.residualGap}；到货前缺口 ${result.beforeArrival}；首次残余 ${result.firstResidual??'无'}。成本未知。`;break}
 case 'decision':{requireWrite();if(ui.stale)throw new Error('数据已过期，请先恢复或核实水位');const a=current(sku);if(a.recommended===null)throw new Error('关键数据不完整，不能保存确定补充建议');const qty=Number(input('decision-qty'));if(!Number.isFinite(qty)||qty<=0)throw new Error('方案数量必须大于0');const type=input('decision-type');if(type!=='采购')throw new Error(`${type}的资源或授权尚未核实，不能生成可执行建议`);if(runtime.decisions.some(d=>d.sku===sku&&d.type===type&&d.qty===qty&&d.version===runtime.active.version))throw new Error('相同候选方案已存在，请跟踪已有方案，避免重复下发');runtime.decisions.push({id:`SIM-${runtime.decisions.length+1}`,sku,type,qty,arrival:addDays(startDate,runtime.active.overrides?.find(o=>o.sku===sku)?.lead??runtime.active.lead),snapshot,version:runtime.active.version,sourceNo:'',status:'模拟方案',log:['保存本地模拟，不占用源库存']});save();openDetail(sku,modalMode);notice('模拟方案已保存；到货前缺口仍需处理');break}
 case 'link':{requireWrite();if(ui.stale)throw new Error('数据过期，先核实水位');const d=runtime.decisions.find(d=>d.id===el.dataset.id)!;if(d.version!==runtime.active.version)throw new Error('口径版本已变化，请重算并创建新方案');const source=input(`source-${d.id}`).trim();if(!source)throw new Error('请输入已有源单号');d.sourceNo=source;d.status='等待执行结果';d.log.push(`本地关联${source}，尚未向源系统验证`);save();openDetail(sku,modalMode);notice('仅保存单号关联，未创建或验证线上单据');break}
 case 'risk-state':requireWrite();if(ui.stale)throw new Error('数据过期，不能据此更新风险状态');moveRisk(runtime,sku,el.dataset.next as RiskState,input('risk-reason'),input('risk-date'),current(sku));save();openDetail(sku,'risk');break
 }
 }catch(error){notice(error instanceof Error?error.message:String(error))}
 return true
}
export function handleMaterialDecisionKey(event:KeyboardEvent):boolean{if(event.key==='Escape'&&document.querySelector('#md-overlay')){close();return true}return false}
