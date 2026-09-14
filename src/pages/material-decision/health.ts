// @page-pattern: list
import { escapeHtml as e } from '../../utils'
import { renderStandardListPage } from '../../components/ui/list-page'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table'
import { renderTablePagination } from '../../components/ui/pagination'
export const healthGroups = ['立即补单','大仓定向消耗','中仓定向消耗','健康骨干','长尾沉默','待清理'] as const
export interface HealthThresholds { large:number; medium:number; shortage:number; excess:number; core:number; common:number }
export const healthDefaults:HealthThresholds={large:10000,medium:3000,shortage:15,excess:90,core:100,common:20}
const dates=['2026-09-11','2026-09-14']
const seeds=[
 ['CNIDML074','罗纹面料',900,300,140,110,80],['IDML24043','弹力平纹',500,0,100,80,10],
 ['IDSZML23004','涤纶面料',32000,6000,5,12,120],['CNIDML096','斜纹面料',18000,2000,120,150,30],
 ['CNIDML112','印花底布',6000,500,30,50,20],['CNIDML118','棉麻面料',4800,100,25,40,10],
 ['CNIDML125','府绸面料',4500,1000,180,160,40],['CNIDML138','针织面料',2400,600,100,90,30],
 ['CNIDML141','长尾提花',1000,0,5,7,0],['CNIDML156','长尾网纱',800,100,4,6,0],
 ['CNIDML163','停用旧色',2000,0,0,0,0],['CNIDML177','无耗用旧布',600,0,0,0,0],
] as const
export function healthRows(date=dates[1], thresholds:HealthThresholds=healthDefaults) {
 const shift=date===dates[0]?0:1
 return seeds.map(([spu,name,stock,transit,daily,baseline,purchase],i)=>{
 const inventory=stock+shift*(i%2===0?200:-100), onway=transit+shift*(i===0?200:0)
 const use7=daily*(shift?1.1:1), consumption90=baseline*90, coverage=use7>0?(inventory+onway)/use7:null
 const baselineCoverage=baseline>0?(inventory+onway)/baseline:null
 const warehouse=inventory>=thresholds.large?'大仓':inventory>=thresholds.medium?'中仓':'小仓'
 const consumption=baseline>=thresholds.core?'核心':baseline>=thresholds.common?'常用':'长尾'
 const ratio=coverage===null?'无消耗':coverage<thresholds.shortage?'缺货':coverage>thresholds.excess?'超量':'正常'
 const group=ratio==='无消耗'?'待清理':ratio==='缺货'?'立即补单':ratio==='超量'&&warehouse==='大仓'?'大仓定向消耗':ratio==='超量'&&warehouse==='中仓'?'中仓定向消耗':ratio==='超量'&&consumption==='长尾'?'长尾沉默':'健康骨干'
 return {spu,name,inventory,onway,total:inventory+onway,use7,baseline,purchase,consumption90,coverage,baselineCoverage,change:coverage!==null&&baselineCoverage!==null?coverage-baselineCoverage:null,warehouse,consumption,ratio,group}
 })
}
type Row=ReturnType<typeof healthRows>[number]
const state={date:dates[1],group:'全部',query:'',page:1,thresholds:{...healthDefaults},notice:''}
const n=(v:number|null)=>v===null?'无消耗，不可计算':v.toLocaleString('zh-CN',{maximumFractionDigits:2})
const btn=(label:string,action:string,extra='')=>`<button type="button" class="rounded border px-3 py-2 text-sm hover:bg-muted" data-md-health-action="${action}" data-skip-page-rerender="true" ${extra}>${e(label)}</button>`
const panel=(title:string,body:string)=>`<section class="rounded-lg border bg-card p-4 space-y-3"><h3 class="font-semibold">${title}</h3>${body}</section>`
function matrix(rows:Row[],a:'warehouse'|'consumption'|'ratio',b:'warehouse'|'consumption'|'ratio',title:string){
 const values={warehouse:['大仓','中仓','小仓'],consumption:['核心','常用','长尾'],ratio:['超量','正常','缺货','无消耗']}
 return panel(title,`<table class="w-full text-xs"><thead><tr><th></th>${values[b].map(x=>`<th class="p-2">${x}</th>`).join('')}</tr></thead><tbody>${values[a].map(x=>`<tr class="border-t"><th class="p-2">${x}</th>${values[b].map(y=>{const subset=rows.filter(r=>r[a]===x&&r[b]===y);return `<td class="p-2 text-center ${subset.length?'bg-teal-50 text-teal-800':''}">${subset.length} SPU<br>${n(subset.reduce((s,r)=>s+r.inventory,0))} yd</td>`}).join('')}</tr>`).join('')}</tbody></table>`)
}
export function renderHealthView():string {
 const rows=healthRows(state.date,state.thresholds), stock=rows.reduce((s,r)=>s+r.inventory,0), transit=rows.reduce((s,r)=>s+r.onway,0), use=rows.reduce((s,r)=>s+r.consumption90,0)
 const filtered=rows.filter(r=>(state.group==='全部'||r.group===state.group)&&`${r.spu} ${r.name}`.toLowerCase().includes(state.query.toLowerCase()))
 const pageSize=5,totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));state.page=Math.min(state.page,totalPages)
 const columns:StandardListColumn<Row>[]=[
 {key:'spu',title:'面料 SPU / 名称',width:180,required:true,render:r=>`${e(r.spu)}<p class="text-muted-foreground">${e(r.name)}</p>`},
 {key:'class',title:'仓量 / 库销 / 消耗',width:150,render:r=>`${r.warehouse} / ${r.ratio} / ${r.consumption}`},
 ...(['inventory','onway','total','consumption90','use7','baseline','purchase','coverage','baselineCoverage','change'] as const).map((key,i)=>({key,title:['库存 yd','在途 yd','库存+在途 yd','90日耗用 yd','7日订单日均 yd','90日订单日均 yd','7日采购日均 yd','覆盖天数','90日基线天数','覆盖变化 天'][i],width:140,render:(r:Row)=>n(r[key])})),
 {key:'group',title:'动作建议',width:150,render:r=>e(r.group)},
 ]
 const controls=`<div class="flex flex-wrap items-end gap-3"><label class="text-sm">演示快照截止日<select data-md-health-field="date" class="block border rounded p-2">${dates.map(d=>`<option ${state.date===d?'selected':''}>${d}</option>`).join('')}</select></label><label class="text-sm">面料 SPU / 名称<input data-md-health-field="query" value="${e(state.query)}" class="block border rounded p-2" placeholder="搜索面料"></label>${btn('查询','query')}${btn('重置','reset')}</div>`
 const cards=healthGroups.map(g=>{const groupRows=rows.filter(r=>r.group===g),qty=groupRows.reduce((s,r)=>s+r.inventory,0);return `<button class="rounded-lg border p-4 text-left ${state.group===g?'border-teal-600 bg-teal-50':'bg-card'}" data-md-health-action="group" data-group="${g}" data-skip-page-rerender="true"><h3 class="font-semibold">${g}</h3><p class="text-xl mt-2">${groupRows.length} SPU</p><p class="text-xs mt-2">库存 ${n(qty)} yd · 占演示库存 ${n(qty/stock*100)}%</p><p class="text-xs">库存+在途 ${n(groupRows.reduce((s,r)=>s+r.total,0))} yd</p></button>`}).join('')
 const distribution=['核心','常用','长尾'].map((kind,i)=>{const share=rows.filter(r=>r.consumption===kind).reduce((s,r)=>s+r.consumption90,0)/use*100;return `<div class="space-y-1"><div class="flex justify-between text-sm"><span>${kind}：实际 ${n(share)}% / 目标 ${[60,30,10][i]}%</span><span>偏离 ${n(share-[60,30,10][i])} 个百分点</span></div><div class="h-3 bg-muted rounded"><div class="h-3 bg-teal-500 rounded" style="width:${share}%"></div></div></div>`}).join('')
 const top=rows.filter(r=>r.group!=='健康骨干').sort((a,b)=>b.inventory-a.inventory).slice(0,10)
 const fields=([['large','大仓下限 yd'],['medium','中仓下限 yd'],['shortage','缺货覆盖上限 天'],['excess','超量覆盖下限 天'],['core','核心90日日均下限 yd'],['common','常用90日日均下限 yd']] as const).map(([key,label])=>`<label class="text-xs">${label}<input type="number" min="0" step="any" data-md-health-field="${key}" value="${state.thresholds[key]}" class="block border rounded p-2 w-full"></label>`).join('')
 return `<div id="md-health" class="space-y-4 p-4"><div class="rounded border bg-amber-50 p-3 text-sm">库存健康业务视图 · 本页为独立面料 SPU 演示快照，共 ${rows.length} SPU，全部数量为 Mock，不与其他演示面板混合汇总；不代表线上库存。截止日 ${state.date}，7/90日均为截至该日的完整天窗口。</div>${panel('快照与筛选',controls)}${state.notice?`<p role="status" class="text-sm text-red-700">${e(state.notice)}</p>`:''}<div class="grid grid-cols-3 gap-3">${panel('库存',`${n(stock)} yd`)}${panel('在途',`${n(transit)} yd`)}${panel('90日耗用',`${n(use)} yd`)}</div>${panel('6:3:1 消耗贡献结构',distribution+'<p class="text-xs text-muted-foreground">目标是核心、常用、长尾的90日消耗贡献占比，不是库存或采购配比。推动常用及长尾起量，不为达标直接改分类。</p>')}<div class="grid grid-cols-2 xl:grid-cols-3 gap-3">${cards}</div><div class="grid grid-cols-1 xl:grid-cols-3 gap-3">${matrix(rows,'warehouse','ratio','仓量 × 库销比')}${matrix(rows,'warehouse','consumption','仓量 × 消耗等级')}${matrix(rows,'ratio','consumption','库销比 × 消耗等级')}</div>${panel('不健康库存 TOP10（按库存降序）',`<ol class="space-y-2">${top.map((r,i)=>`<li class="flex justify-between border-b py-2 text-sm"><span>${i+1}. ${e(r.spu)} · ${r.group}</span><span>${n(r.inventory)} yd</span></li>`).join('')}</ol><p class="text-xs text-muted-foreground">本演示有 ${top.length} 个非健康对象；不为凑足10条重复物料。真实图片待提供。</p>`)}${renderStandardListPage({title:`动作组明细 · ${state.group}`,filtersHtml:btn('显示全部动作组','group','data-group="全部"'),tableHtml:renderStandardListTable({columns,rows:filtered.slice((state.page-1)*pageSize,state.page*pageSize),preferences:{order:columns.map(c=>c.key),visibleKeys:columns.map(c=>c.key),frozenKeys:[],pageSize},sort:null,eventPrefix:'md-health',skipPageRerender:true,emptyText:'此筛选没有物料'}),paginationHtml:renderTablePagination({total:filtered.length,from:filtered.length?(state.page-1)*pageSize+1:0,to:Math.min(state.page*pageSize,filtered.length),currentPage:state.page,totalPages,pageSize,pageSizeOptions:[5],actionPrefix:'md-health',skipPageRerender:true})})}${panel('演示分类口径',`<p class="text-sm">旧页面14个标签及阈值未核实；以下为可试调的演示规则，不声称复刻线上分类，也不修改正式口径。覆盖=(库存+在途)/7日订单日均；90日基线=(库存+在途)/90日订单日均；变化=覆盖−基线。无消耗显示不可计算，有限除法不显示∞。</p><p class="text-xs">分组优先级：无消耗→待清理；缺货→立即补单；超量大仓→大仓定向消耗；超量中仓→中仓定向消耗；超量长尾→长尾沉默；其余→健康骨干。仓量、核心/常用阈值含下限；缺货小于阈值，超量大于阈值。</p><div class="grid grid-cols-2 xl:grid-cols-3 gap-3">${fields}</div>${btn('应用演示阈值','thresholds')}`)}</div>`
}
export function handleHealthClick(target:HTMLElement):boolean {
 const control=target.closest<HTMLElement>('[data-md-health-action]');if(!control)return false
 const root=document.getElementById('md-health');if(!root)return false
 const value=(key:string)=>root.querySelector<HTMLInputElement>(`[data-md-health-field="${key}"]`)?.value??''
 const action=control.dataset.mdHealthAction;state.notice=''
 if(action==='query'){state.date=value('date');state.query=value('query').trim();state.page=1}
 else if(action==='reset'){Object.assign(state,{date:dates[1],query:'',group:'全部',page:1,thresholds:{...healthDefaults}})}
 else if(action==='group'){state.group=control.dataset.group??'全部';state.page=1}
 else if(action==='next-page')state.page++
 else if(action==='prev-page')state.page=Math.max(1,state.page-1)
 else if(action==='thresholds'){
 const next=Object.fromEntries(Object.keys(healthDefaults).map(k=>[k,Number(value(k))])) as unknown as HealthThresholds
 if(Object.values(next).some(v=>!Number.isFinite(v)||v<0)||next.large<=next.medium||next.core<=next.common||next.excess<=next.shortage)state.notice='阈值需为非负有限数，且大仓>中仓、核心>常用、超量>缺货。'
 else{state.thresholds=next;state.page=1;state.notice='已应用演示阈值，动作组、矩阵与明细同步重算；未发布正式规则。'}
 }else return false
 root.outerHTML=renderHealthView();return true
}
