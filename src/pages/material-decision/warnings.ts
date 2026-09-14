// @page-pattern: list
import { renderTablePagination } from '../../components/ui/pagination'
import { escapeHtml as e } from '../../utils'
import { renderStandardListPage, renderStandardListStats } from '../../components/ui/list-page'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table'

export interface WarningBatch { id:string; ordered:number; received:number; status:'待审核'|'采购中'|'部分入库'|'全部入库'|'驳回'; purchase:string; shipped?:string }
export interface WarningMaterial { sku:string; name:string; basic:boolean; stock:number; qualified:number; orderUse7:number|null; future:number; batches:WarningBatch[]; detailSku?:string }
export type WarningLens = 'legacy'|'qualified'
export interface WarningFilter { query:string; coverage:string; transit:string; from:string; to:string; mode:WarningLens; page:number; size:number }
export const warningDate='2026-09-14'
const plus=(date:string,days:number)=>{const d=new Date(`${date}T00:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10)}
export const warningMaterials:WarningMaterial[]=Array.from({length:14},(_,i)=>({
 sku:i<2?`CNIDML074-${i?'white':'black'}`:`DEMO-FAB-${String(i+1).padStart(3,'0')}`,
 name:i===10?'新品面料':i===11?'BOM缺失面料':i===12?'微量需求面料':`面料预警场景 ${i+1}`,
 basic:i%2===0,stock:[20,30,31,70,71,100,101,0,15,0,25,90,1,45][i],qualified:[10,25,20,60,55,80,90,0,10,0,25,70,1,35][i],
 orderUse7:i===9||i===10?0:i===11?null:i===12?.07:i%2===0?70:70/.65,
 future:i===10?80:30,
 detailSku:i<2?`CNIDML074-${i?'white':'black'}`:undefined,
 batches:i%3===0?[]:[{id:`DEMO-PO-${i}-A`,ordered:100,received:i%2?40:0,status:i%2?'部分入库':'采购中',purchase:'2026-06-20',shipped:'2026-07-20'},
 {id:`DEMO-PO-${i}-B`,ordered:150,received:0,status:'待审核',purchase:i===2?'2026-07-01':'2026-07-20'},
 {id:`DEMO-PO-${i}-C`,ordered:50,received:50,status:'全部入库',purchase:'2026-07-01'}],
}))
export function warningBatches(m:WarningMaterial) {return m.batches.map(b=>({...b,remaining:Math.max(0,b.ordered-b.received),eta:plus(b.shipped??b.purchase,b.shipped?45:60),basis:b.shipped?`最晚装船 ${b.shipped} +45天`:`采购 ${b.purchase} +60天`})).filter(b=>['待审核','采购中','部分入库'].includes(b.status)&&b.remaining>0).sort((a,b)=>a.eta.localeCompare(b.eta)||a.id.localeCompare(b.id))}
export function nearestWarningBatch(m:WarningMaterial,date=warningDate) {const bs=warningBatches(m);return bs.find(b=>b.eta>=date)??bs.at(-1)}
export function calculateWarning(m:WarningMaterial,mode:WarningLens='legacy') {const daily=m.orderUse7===null?null:m.orderUse7*(m.basic?1:.65)/7;const inventory=mode==='legacy'?m.stock:m.qualified;const coverage=daily===null||daily===0?null:inventory/daily;return {daily,inventory,coverage,warning:coverage!==null&&coverage<=10&&daily!>=.05,urgent:coverage!==null&&coverage<=3&&daily!>=.05,transit:warningBatches(m).reduce((s,b)=>s+b.remaining,0),nearest:nearestWarningBatch(m)}}
export function filterWarnings(rows:WarningMaterial[],f:WarningFilter) {return rows.filter(m=>{const a=calculateWarning(m,f.mode);const c=a.coverage;return (!f.query||`${m.sku} ${m.name}`.toLowerCase().includes(f.query.toLowerCase()))&&(!f.coverage||(c!==null&&a.daily!>=.05&&(f.coverage==='0-3'?c<=3:f.coverage==='3-7'?c>3&&c<=7:c>7&&c<=10)))&&(!f.transit||(f.transit==='yes'?a.transit>0:a.transit===0))&&(!f.from||!!a.nearest&&a.nearest.eta>=f.from)&&(!f.to||!!a.nearest&&a.nearest.eta<=f.to)})}
const initial=():WarningFilter=>({query:'',coverage:'',transit:'',from:'',to:'',mode:'legacy',page:1,size:5})
let state=initial()
let expanded=new Set<string>()
let error=''
const n=(x:number)=>x.toLocaleString('zh-CN',{maximumFractionDigits:2})
const btn=(label:string,action:string,extra='')=>`<button type="button" class="rounded border px-3 py-2 text-sm hover:bg-muted" data-md-warning-action="${action}" data-skip-page-rerender="true" ${extra}>${e(label)}</button>`
const select=(label:string,key:string,options:[string,string][])=>`<label class="text-xs">${label}<select data-warning-filter="${key}" class="mt-1 block rounded border p-2" data-skip-page-rerender="true">${options.map(([v,l])=>`<option value="${v}" ${String(state[key as keyof WarningFilter])===v?'selected':''}>${l}</option>`).join('')}</select></label>`
function renderContent():string {
 const rows=filterWarnings(warningMaterials,state),totalPages=Math.max(1,Math.ceil(rows.length/state.size));state.page=Math.min(state.page,totalPages)
 const shown=rows.slice((state.page-1)*state.size,state.page*state.size), as=rows.map(m=>calculateWarning(m,state.mode))
 const input=(label:string,key:'query'|'from'|'to',type='text')=>`<label class="text-xs">${label}<input type="${type}" data-warning-filter="${key}" value="${e(state[key])}" data-skip-page-rerender="true" class="mt-1 block rounded border p-2"></label>`
 const filters=`<div class="space-y-3"><div class="flex flex-wrap gap-3">${input('面料SKU / 名称','query')}${select('覆盖天数','coverage',[['','全部（含例外）'],['0-3','0–3天'],['3-7','>3–7天'],['7-10','>7–10天']])}${select('剩余在途','transit',[['','全部'],['yes','有在途'],['no','无在途']])}${input('最近批次ETA起','from','date')}${input('最近批次ETA止','to','date')}${select('每页条数','size',[['5','5条'],['10','10条'],['20','20条']])}</div><div class="flex gap-2">${btn('查询','query')}${btn('重置','reset')}${btn(state.mode==='legacy'?'切换合格库存对照':'切换历史参考口径','lens')}</div><p role="status" class="text-red-600">${e(error)}</p></div>`
 const columns:StandardListColumn<WarningMaterial>[]=[
 {key:'sku',title:'物料 / 场景',width:235,render:m=>`<b>${e(m.name)}</b><p>${e(m.sku)}</p><span class="text-xs text-amber-700">演示数据 · 实物图待提供</span>`},
 {key:'stock',title:'统计库存（Yard）',width:130,render:m=>n(calculateWarning(m,state.mode).inventory)},
 {key:'daily',title:'订单折算日均（Yard）',width:145,render:m=>{const a=calculateWarning(m,state.mode);return a.daily===null?'未知：BOM缺失':n(a.daily)}},
 {key:'coverage',title:'覆盖天数 / 判定',width:180,render:m=>{const a=calculateWarning(m,state.mode);return a.coverage===null?m.orderUse7===null?'未知：不可计算':`无历史需求${m.future>0?'；有未来需求，转供需计划':''}`:`${n(a.coverage)}天<br>${a.urgent?'紧急预警':a.warning?'预警':a.daily!<.05?'日均不足0.05，不入选':'超过10天，不入选'}`}},
 {key:'transit',title:'剩余在途（Yard）',width:125,render:m=>n(calculateWarning(m).transit)},
 {key:'eta',title:'最近批次ETA / 未收量',width:190,render:m=>{const b=nearestWarningBatch(m);return b?`${b.eta} · ${n(b.remaining)} Yard<br>${b.eta<warningDate?'<span class="text-red-600">逾期</span>':'未逾期'}<br><span class="text-xs">${e(b.basis)}</span>`:'无剩余在途'}},
 {key:'actions',title:'操作 / 批次追溯',width:310,render:m=>`${btn(expanded.has(m.sku)?'收起批次':'全部批次','expand',`data-sku="${e(m.sku)}"`)} ${m.detailSku?`<button class="text-blue-600" data-md-action="detail" data-sku="${e(m.detailSku)}" data-skip-page-rerender="true">目标物料详情</button>`:''}${expanded.has(m.sku)?`<div class="mt-2 space-y-2 text-xs">${m.batches.length?m.batches.map(b=>{const eta=plus(b.shipped??b.purchase,b.shipped?45:60);return `<p class="border-t pt-2">${e(b.id)} · ${b.status}<br>订购 ${n(b.ordered)} / 已收 ${n(b.received)} / 未收 ${n(Math.max(0,b.ordered-b.received))} Yard<br>ETA ${eta}（${b.shipped?`最晚装船 ${b.shipped} +45天`:`采购 ${b.purchase} +60天`}）<br>${['全部入库','驳回'].includes(b.status)?'不计入在途':eta<warningDate?'逾期，不能视为已到账':'估算供给，尚未实收'}</p>`}).join(''):'没有采购批次'}</div>`:''}`},
 ]
 return `<div class="rounded border bg-amber-50 p-3 text-sm">P2 库存预警业务视图 · 固定演示截点 ${warningDate}。当前：${state.mode==='legacy'?'历史口径参考（非当前正式规则）':'合格库存对照（仅替换分子，非完整新供需算法）'}。全部14个场景包含预警与不入选例外，汇总仅按当前筛选计算。</div><details class="m-4 rounded border p-3"><summary class="cursor-pointer font-semibold">完整口径说明及差异</summary><div class="space-y-2 pt-3 text-sm"><p>历史参考：过去7个完整自然日（2026-09-07至09-13），COD及已支付非COD，包含取消订单。订单面料用量×基础款1 / 非基础款0.65，再÷7；这是订单折算需求，不是实物消耗。</p><p>历史库存范围：中央仓＋印染待加工仓，排除裁片仓、中转仓。覆盖＝统计库存÷订单折算日均，不含在途。日均≥0.05 Yard且覆盖≤10天入选；覆盖≤3天为紧急。边界区间为[0,3]、(3,7]、(7,10]。</p><p>在途：待审核、采购中、部分入库采购单未收量；排除全部入库、驳回、删除及结算单。已装船取最晚装船+45天，未装船取采购+60天。优先当天及未来最早批次，全逾期取逾期日期最晚批次；逾期量仍列示但不是可用现货。</p><p>合格库存对照仅将统计库存替换成同SKU合格量，保持分母以隔离库存范围差异；不会修改其他页面正式策略。新供需计划另按质量、占用、时间及未履约需求计算，不能与本表静默混算。新品、无需求、缺BOM均保留例外展示，不显示∞或伪造0天。</p><p>列表库存和在途全部以Yard统计；14条为补充业务演示场景，只有CNIDML074两条关联现有主物料目录，其余DEMO编码不是线上物料。</p></div></details>`+renderStandardListPage({title:'库存预警与采购到货',filtersHtml:filters,statsHtml:renderStandardListStats([{label:'预警SKU',value:as.filter(a=>a.warning).length},{label:'≤3天紧急',value:as.filter(a=>a.urgent).length},{label:'无在途预警SKU',value:as.filter(a=>a.warning&&a.transit===0).length},{label:'筛选库存 Yard',value:n(as.reduce((s,a)=>s+a.inventory,0))},{label:'筛选在途 Yard',value:n(as.reduce((s,a)=>s+a.transit,0))}]),tableHtml:renderStandardListTable({columns,rows:shown,preferences:{order:columns.map(c=>c.key),visibleKeys:columns.map(c=>c.key),frozenKeys:[],pageSize:state.size},sort:null,eventPrefix:'md-warning',skipPageRerender:true,emptyText:'没有匹配的面料场景'}),paginationHtml:renderTablePagination({total:rows.length,from:rows.length?(state.page-1)*state.size+1:0,to:Math.min(state.page*state.size,rows.length),currentPage:state.page,totalPages,pageSize:state.size,pageSizeOptions:[5,10,20],actionPrefix:'md-warning',skipPageRerender:true})})
}
export function renderWarningsView():string {return `<section id="md-warnings">${renderContent()}</section>`}
export function handleWarningsClick(target:HTMLElement):boolean {const el=target.closest<HTMLElement>('[data-md-warning-action]');if(!el)return false;const action=el.dataset.mdWarningAction;error='';if(action==='reset'){state=initial();expanded.clear()}else if(action==='query'){const next={...state,page:1};document.querySelectorAll<HTMLInputElement|HTMLSelectElement>('#md-warnings [data-warning-filter]').forEach(input=>{const k=input.dataset.warningFilter!;if(k==='size')next.size=Number(input.value);else (next as unknown as Record<string,unknown>)[k]=input.value.trim()});if(next.from&&next.to&&next.from>next.to)error='ETA开始日期不能晚于结束日期';else state=next}else if(action==='lens'){state.mode=state.mode==='legacy'?'qualified':'legacy';state.page=1}else if(action==='prev-page')state.page=Math.max(1,state.page-1);else if(action==='next-page')state.page++;else if(action==='expand'){const sku=el.dataset.sku!;expanded.has(sku)?expanded.delete(sku):expanded.add(sku)}const host=document.getElementById('md-warnings');if(host)host.innerHTML=renderContent();return true}

export function handleWarningsChange(target:HTMLElement):boolean {const select=target.closest<HTMLSelectElement>('[data-md-warning-field="pageSize"]');if(!select)return false;state.size=Number(select.value);state.page=1;const host=document.getElementById("md-warnings");if(host)host.innerHTML=renderContent();return true}
