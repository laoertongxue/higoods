// @page-pattern: list
import { escapeHtml as e } from '../../utils'
import { renderStandardListPage, renderStandardListStats } from '../../components/ui/list-page'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table'
import { renderTablePagination } from '../../components/ui/pagination'

export interface DailyPoint { date:string; purchase:number|null; bom:number; unbom:number; complete:boolean }
export interface DailyMaterial { spu:string; name:string; central:number; dye:number; print:number; transit:number; focused:boolean; days:DailyPoint[] }
export interface DailyGood { spu:string; name:string; brand:string; style:string; channel:string; sales:number[]; links:{material:string; kind:'BOM'|'预选'; usage:number|null}[] }
const dates=Array.from({length:14},(_,i)=>`2026-09-${String(i+1).padStart(2,'0')}`)
/** Isolated demonstration dataset. IDs reference the audited cases; quantities do not represent live records. */
export const dailyDemo = {
 snapshot:'2026-09-14 09:00（演示时区 Asia/Jakarta）',
 materials:Array.from({length:14},(_,i):DailyMaterial=>({spu:['CNIDML129','CNIDML002','CNIDML074'][i]??`DEMO-FABRIC-${i+1}`,name:['弹力平纹','轻薄梭织','针织面料'][i%3],central:3000+i*500,dye:500+i*30,print:300+i*20,transit:i%3===0?0:900+i*40,focused:i<3,
 days:dates.map((date,j)=>({date,purchase:i===4?null:120+i*10+j*3,bom:i===0&&j===12?2600:600+i*70+j*5,unbom:i%3===0?20+j:0,complete:j!==13}))})),
 goods:Array.from({length:16},(_,i):DailyGood=>({spu:`DEMO-GARMENT-${String(i+1).padStart(3,'0')}`,name:['女装连衣裙','短袖上衣','休闲长裤','针织套装'][i%4],brand:['FADFAD','CHICMORE','MODISH','ASAYA'][i%4],style:['通勤','休闲','基础'][i%3],channel:['TikTok','Shopee','独立站'][i%3],sales:dates.map((_,j)=>10+i*2+(j%4)*3),links:[{material:['CNIDML129','CNIDML002','CNIDML074'][i%3],kind:i%5===0?'预选':'BOM',usage:i%5===0?null:1.2+(i%3)*.3},...(i%4===0?[{material:'CNIDML074',kind:'预选' as const,usage:null}]:[])]})),
}
export function sumKnown(values:(number|null)[]):number|null { return values.some(x=>x===null)?null:values.reduce<number>((a,b)=>a+(b??0),0) }
export function dailyWindow(m:DailyMaterial,cutoff:string) { return m.days.filter(d=>d.date<=cutoff).slice(-7) }
export function detectDailyChange(current:number,previous:number,complete=true) {
 const delta=current-previous,rate=previous===0?null:delta/previous
 return {delta,rate,spike:complete&&rate!==null&&Math.abs(delta)>=1000&&Math.abs(rate)>=.3}
}
export function materialDailySummary(m:DailyMaterial,cutoff:string) {
 const days=dailyWindow(m,cutoff),today=days.at(-1),previous=days.at(-2), prior=days.slice(0,-1)
 const partial=days.some(d=>d.unbom>0)
 return {days,today,purchase:sumKnown(days.map(d=>d.purchase)),knownBom:days.reduce((a,d)=>a+d.bom,0),unknownUnits:days.reduce((a,d)=>a+d.unbom,0),order:partial?null:days.reduce((a,d)=>a+d.bom,0),priorMean:prior.length===6?prior.reduce((a,d)=>a+d.bom,0)/6:null,
 change:today&&previous?detectDailyChange(today.bom,previous.bom,today.complete&&previous.complete):null}
}
export function dedupeGoods(goods:DailyGood[]):DailyGood[] {return [...new Map(goods.map(g=>[g.spu,g])).values()]}
export function linkedGoods(material:string,goods:DailyGood[]=dailyDemo.goods) {return dedupeGoods(goods.filter(g=>g.links.some(l=>l.material===material)))}
export function goodSummary(g:DailyGood,cutoff:string,material='') {
 const end=dates.indexOf(cutoff),sales=end<0?[]:g.sales.slice(Math.max(0,end-6),end+1),total=sales.reduce((a,b)=>a+b,0),links=g.links.filter(l=>!material||l.material===material)
 const confirmed=[...new Map(links.filter(l=>l.kind==='BOM').map(l=>[l.material,l])).values()]
 return {sales,total,mean:sales.length?total/sales.length:null,today:sales.at(-1)??null,confirmed,preselected:[...new Set(links.filter(l=>l.kind==='预选'&&!confirmed.some(c=>c.material===l.material)).map(l=>l.material))],estimated:confirmed.length&&confirmed.every(l=>l.usage!==null)?confirmed.map(l=>({material:l.material,quantity:total*l.usage!})):[]}
}
let mode:'daily'|'goods'='daily'
let state={query:'',cutoff:'2026-09-14',brand:'全部品牌',channel:'全部渠道',material:'全部物料',focused:false,spike:false,page:1,size:10,expanded:'',notice:''}
const n=(v:number|null|undefined)=>v==null?'未知':v.toLocaleString('zh-CN',{maximumFractionDigits:2})
const btn=(label:string,action:string,extra='')=>`<button type="button" class="rounded border px-3 py-2 text-sm hover:bg-muted" data-md-daily-action="${action}" data-skip-page-rerender="true" ${extra}>${e(label)}</button>`
const select=(label:string,key:string,options:string[],value:string)=>`<label class="text-xs">${label}<select class="mt-1 block rounded border p-2 bg-background" data-md-daily-field="${key}" data-skip-page-rerender="true">${options.map(o=>`<option ${o===value?'selected':''}>${e(o)}</option>`).join('')}</select></label>`
const cols=<T>(items:[string,string,number,(r:T)=>string][]):StandardListColumn<T>[]=>items.map(([key,title,width,render])=>({key,title,width,render}))
function table<T>(columns:StandardListColumn<T>[],rows:T[]):string {return renderStandardListTable({columns,rows,preferences:{order:columns.map(c=>c.key),visibleKeys:columns.map(c=>c.key),frozenKeys:[],pageSize:state.size},sort:null,eventPrefix:'md-daily',skipPageRerender:true,emptyText:'当前筛选没有匹配记录'})}
function trend(values:number[]):string {const max=Math.max(1,...values);return `<div class="flex items-end gap-1 h-10" aria-label="近7日销量趋势 ${values.join('、')}件">${values.map((v,i)=>`<span class="flex-1 bg-teal-500 rounded-t" style="height:${Math.max(2,Math.round(v/max*36))}px" title="第${i+1}天 ${v}件"></span>`).join('')}</div><p class="text-xs mt-1">${values.join(' / ')} 件</p>`}
function object(name:string,id:string):string {return `<strong>${e(name)}</strong><p class="text-xs">${e(id)}</p><p class="text-xs text-amber-700">真实图片待提供</p>`}
function detail():string {
 if(!state.expanded)return ''
 if(mode==='daily'&&!state.expanded.startsWith('DEMO-GARMENT')) {
 const m=dailyDemo.materials.find(m=>m.spu===state.expanded);if(!m)return ''
 const s=materialDailySummary(m,state.cutoff),gs=linkedGoods(m.spu)
 return `<section class="rounded border p-4 space-y-3"><div class="flex justify-between"><h3>${e(m.spu)} · 逐日需求与商品关联</h3>${btn('收起明细','close')}</div><p class="text-xs">每日已 BOM 为已知推算部分；未 BOM 列为待映射商品件数，不能与 Yard 相加。今日未完结，不判定日突变。</p>${table(cols<DailyPoint>([['date','日期',130,d=>`${d.date}${d.complete?'':' · 未完结'}`],['purchase','采购单需求 Yard',140,d=>n(d.purchase)],['bom','已 BOM 推算 Yard',150,d=>n(d.bom)],['unbom','未 BOM 待映射 件',150,d=>n(d.unbom)],['total','完整订单预测 Yard',160,d=>d.unbom?'未知（有未 BOM）':n(d.bom)],['change','环比 / 突变',170,(d)=>{const ix=m.days.indexOf(d),p=m.days[ix-1];if(!p)return '无前日';const c=detectDailyChange(d.bom,p.bom,d.complete&&p.complete);return d.complete?`${n(c.delta)} / ${c.rate===null?'无基数':n(c.rate*100)+'%'}${c.spike?' · 突变':''}`:'未完结，不判定'}]]),s.days)}<h4 class="font-medium">全部关联商品（${gs.length}，无库存门槛）</h4>${goodsTable(gs,m.spu)}</section>`
 }
 const g=dailyDemo.goods.find(g=>g.spu===state.expanded);if(!g)return ''
 return `<section class="rounded border p-4 space-y-3"><div class="flex justify-between"><h3>${e(g.spu)} · 用料关联</h3>${btn('收起明细','close')}</div><p>同一商品可关联多个面料；销量按商品去重，不按关联行累加。预选关系不产生确定需求。</p>${table(cols<DailyGood['links'][number]>([['material','面料 SPU',200,l=>e(l.material)],['kind','关联依据',110,l=>l.kind],['usage','单耗 Yard/件',150,l=>n(l.usage)],['need','7日推算 Yard',170,l=>l.kind==='BOM'&&l.usage!==null?n(goodSummary(g,state.cutoff).total*l.usage):'未知（预选待 BOM）']]),g.links)}</section>`
}
function goodsTable(goods:DailyGood[],material=''):string {return table(cols<DailyGood>([
 ['spu','商品 / SPU',220,g=>object(g.name,g.spu)],['brand','品牌 / 风格 / 渠道',180,g=>`${g.brand}<br>${g.style} / ${g.channel}`],['stock','关联物料库存 / 在途 Yard',240,g=>[...new Set(g.links.filter(l=>!material||l.material===material).map(l=>l.material))].map(id=>{const m=dailyDemo.materials.find(m=>m.spu===id);return m?`${e(id)}：${n(m.central+m.dye+m.print)} / ${n(m.transit)}`:`${e(id)}：未知`}).join('<br>')],['trend','近7日销量趋势（件）',220,g=>trend(goodSummary(g,state.cutoff).sales)],['today','当日销量 / 环比（件）',180,g=>{const s=goodSummary(g,state.cutoff),prev=s.sales.at(-2);return `${n(s.today)} / ${state.cutoff==='2026-09-14'?'未完结':prev===undefined?'无前日':n((s.today??0)-prev)}`}],['sales','7日销量 / 日均（件）',160,g=>{const s=goodSummary(g,state.cutoff);return `${n(s.total)} / ${n(s.mean)}`}],['bom','已 BOM / 单耗 Yard/件',240,g=>goodSummary(g,state.cutoff,material).confirmed.map(l=>`${e(l.material)}：${n(l.usage)}`).join('<br>')||'无已确认 BOM'],['pre','预选关联（不计确定用量）',240,g=>goodSummary(g,state.cutoff,material).preselected.map(e).join('<br>')||'无'],['need','BOM 推算7日用料 Yard',240,g=>goodSummary(g,state.cutoff,material).estimated.map(l=>`${e(l.material)}：${n(l.quantity)}`).join('<br>')||'未知'],['action','操作',140,g=>btn('展开用料关联','expand',`data-id="${e(g.spu)}"`)]
 ]),goods)}
export function renderDailyView(next:'daily'|'goods'):string {if(mode!==next){state.page=1;state.query='';state.expanded='';state.notice=''}mode=next;return `<div id="md-daily">${body()}</div>`}
function body():string {
 const title=mode==='daily'?'物料全景日报':'关联商品与销量归因'
 const materials=dailyDemo.materials.filter(m=>(!state.query||`${m.spu} ${m.name}`.toLowerCase().includes(state.query.toLowerCase()))&&(!state.focused||m.focused)&&(!state.spike||materialDailySummary(m,state.cutoff).change?.spike))
 const goods=dedupeGoods(dailyDemo.goods).filter(g=>(!state.query||`${g.spu} ${g.name}`.toLowerCase().includes(state.query.toLowerCase()))&&(state.brand==='全部品牌'||g.brand===state.brand)&&(state.channel==='全部渠道'||g.channel===state.channel)&&(state.material==='全部物料'||g.links.some(l=>l.material===state.material)))
 const total=mode==='daily'?materials.length:goods.length,pages=Math.max(1,Math.ceil(total/state.size));state.page=Math.min(state.page,pages)
 const start=(state.page-1)*state.size
 const filters=`<div class="rounded border p-3 space-y-3"><div class="flex flex-wrap gap-3"><label class="text-xs">编码 / 名称<input class="mt-1 block rounded border p-2 bg-background" data-md-daily-field="query" value="${e(state.query)}" data-skip-page-rerender="true"></label>${select('截止日','cutoff',dates.slice(6),state.cutoff)}${mode==='goods'?select('品牌','brand',['全部品牌','FADFAD','CHICMORE','MODISH','ASAYA'],state.brand)+select('渠道','channel',['全部渠道','TikTok','Shopee','独立站'],state.channel)+select('物料','material',['全部物料',...dailyDemo.materials.map(m=>m.spu)],state.material):`<label class="text-sm self-end p-2"><input type="checkbox" data-md-daily-field="focused" ${state.focused?'checked':''}> 只看重点 SPU</label><label class="text-sm self-end p-2"><input type="checkbox" data-md-daily-field="spike" ${state.spike?'checked':''}> 只看截止日突变 SPU</label>`}</div><div class="flex gap-2">${btn('查询','query')}${btn('重置','reset')}</div></div>`
 const dailyColumns=cols<DailyMaterial>([
 ['spu','物料 / SPU',220,m=>object(m.name,m.spu)+(m.focused?'<span class="text-xs text-blue-600">重点 SPU</span>':'')],['warehouse','分仓库存 Yard',180,m=>`中央 ${n(m.central)}<br>染色 ${n(m.dye)} / 印花 ${n(m.print)}`],['stock','库存 / 在途 / 总数 Yard',190,m=>`${n(m.central+m.dye+m.print)} / ${n(m.transit)} / ${n(m.central+m.dye+m.print+m.transit)}`],['goods','关联商品 SPU',130,m=>n(linkedGoods(m.spu).length)],['purchase','采购单需求 今日 / 7日 Yard',200,m=>{const s=materialDailySummary(m,state.cutoff);return `${n(s.today?.purchase)} / ${n(s.purchase)}`}],['order','完整订单预测 今日 / 7日 Yard',210,m=>{const s=materialDailySummary(m,state.cutoff);return `${s.today?.unbom?'未知':n(s.today?.bom)} / ${n(s.order)}`}],['known','已 BOM 7日 / 未 BOM 件',190,m=>{const s=materialDailySummary(m,state.cutoff);return `${n(s.knownBom)} Yard / ${n(s.unknownUnits)} 件`}],['average','排截止日6日已 BOM 日均',190,m=>n(materialDailySummary(m,state.cutoff).priorMean)],['coverage','库存+在途预计覆盖：采购 / 订单',230,m=>{const s=materialDailySummary(m,state.cutoff),q=m.central+m.dye+m.print+m.transit;return `${s.purchase===null?'未知':s.purchase===0?'无需求':n(q/(s.purchase/7))+'天'} / ${s.order===null?'未知':s.order===0?'无需求':n(q/(s.order/7))+'天'}`}],['change','截止日日环比',175,m=>{const s=materialDailySummary(m,state.cutoff);return !s.today?.complete?'未完结，不判定':s.change?`${n(s.change.delta)} Yard / ${s.change.rate===null?'无基数':n(s.change.rate*100)+'%'}${s.change.spike?' · 突变':''}`:'无前日'}],['action','操作',150,m=>btn('逐日与关联明细','expand',`data-id="${e(m.spu)}"`)]])
 const totalSales=goods.reduce((a,g)=>a+goodSummary(g,state.cutoff).total,0)
 const todaySales=goods.reduce((a,g)=>a+(goodSummary(g,state.cutoff).today??0),0),previousSales=goods.reduce((a,g)=>a+(goodSummary(g,state.cutoff).sales.at(-2)??0),0)
 const active=goods.filter(g=>(goodSummary(g,state.cutoff).today??0)>0).length,previousActive=goods.filter(g=>(goodSummary(g,state.cutoff).sales.at(-2)??0)>0).length
 return renderStandardListPage({title,feedbackHtml:`<div class="rounded border border-amber-200 bg-amber-50 p-3 text-xs space-y-1"><p>独立业务演示数据集 · ${dailyDemo.snapshot} · 数量全部为 Mock，不与物料全景主库存混加。全部对象真实图片待提供。</p><p>需求/销量按截止日含当日7天；重点日均排截止日6天÷6。库存、在途固定为快照当前值，切换历史日期不表示历史库存。2026-09-14为未完结当日。</p><p>已 BOM 订单推算与采购单需求分别展示；未 BOM 不填0。突变同时满足日差≥1000 Yard及变化率≥30%，零基数或未完结日不判定。当前仅演示规则，非生产口径发布。</p></div><p class="text-sm text-blue-700" role="status">${e(state.notice)}</p>`,filtersHtml:filters,statsHtml:renderStandardListStats(mode==='daily'?[{label:'符合筛选物料',value:total},{label:'重点 SPU',value:materials.filter(m=>m.focused).length},{label:'需求不完整物料',value:materials.filter(m=>materialDailySummary(m,state.cutoff).order===null).length}]:[{label:'去重商品 SPU',value:total},{label:'7日销量（按商品去重）',value:totalSales},{label:'当日销量 / 较前日',value:`${todaySales} / ${state.cutoff==='2026-09-14'?'未完结':n(todaySales-previousSales)}`},{label:'当日活跃 / 较前日',value:`${active} / ${state.cutoff==='2026-09-14'?'未完结':n(active-previousActive)}`},{label:'爆款商品',value:'判定规则待确认'}]),tableHtml:mode==='daily'?table(dailyColumns,materials.slice(start,start+state.size)):goodsTable(goods.slice(start,start+state.size),state.material==='全部物料'?'':state.material),paginationHtml:renderTablePagination({total,from:total?start+1:0,to:Math.min(start+state.size,total),currentPage:state.page,totalPages:pages,pageSize:state.size,actionPrefix:'md-daily',pageSizeOptions:[10,20,50],skipPageRerender:true}).replace('</footer>',`${btn('应用每页条数','size')}</footer>`),overlaysHtml:detail()})
}
export function handleDailyClick(target:HTMLElement):boolean {
 const node=target.closest<HTMLElement>('[data-md-daily-action]');if(!node)return false
 const root=document.getElementById('md-daily');if(!root)return false
 const read=(k:string)=>root.querySelector<HTMLInputElement|HTMLSelectElement>(`[data-md-daily-field="${k}"]`)
 switch(node.dataset.mdDailyAction){
 case 'query':state.query=read('query')?.value.trim()??'';state.cutoff=read('cutoff')?.value??state.cutoff;state.brand=read('brand')?.value??state.brand;state.channel=read('channel')?.value??state.channel;state.material=read('material')?.value??state.material;state.focused=(read('focused') as HTMLInputElement)?.checked??false;state.spike=(read('spike') as HTMLInputElement)?.checked??false;state.page=1;state.expanded='';state.notice='已按当前条件查询';break
 case 'reset':state={query:'',cutoff:'2026-09-14',brand:'全部品牌',channel:'全部渠道',material:'全部物料',focused:false,spike:false,page:1,size:10,expanded:'',notice:''};break
 case 'expand':state.expanded=node.dataset.id??'';break
 case 'close':state.expanded='';break
 case 'prev-page':state.page=Math.max(1,state.page-1);state.expanded='';break
 case 'next-page':state.page++;state.expanded='';break
 case 'size':state.size=Number(read('pageSize')?.value??10);state.page=1;break
 default:return false
 }
 root.innerHTML=body();return true
}
