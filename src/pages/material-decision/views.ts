import { renderHealthView } from './health'
import { renderWarningsView } from './warnings'
import { renderDailyView } from './daily'
import { renderPreparationView } from './preparation'
import { renderPackagingPanel } from './packaging'
import { renderProcessingPanel } from './processing'
// @page-pattern: list
import { escapeHtml as e } from '../../utils'
import { renderStandardListPage, renderStandardListStats } from '../../components/ui/list-page'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table'
import { renderTablePagination } from '../../components/ui/pagination'
import type { StandardListColumnPreferences, StandardListSortState } from '../../components/ui/list-table-model'
import { materials, stock, demands, supplies, warehouses, processingTypes, snapshot } from '../../data/material-decision/fixtures'
import { assess, addDays, startDate, compareCandidate } from '../../data/material-decision/calculations'
import type { Assessment, Runtime } from '../../data/material-decision/model'
export const base = '/dds/supply-chain/materials'
export const sections: Record<string,string> = { overview:'决策总览', panorama:'物料全景', planning:'供需计划', consumption:'消耗与经营分析', risks:'风险与决策', quality:'数据质量', configuration:'规则与配置' }
export const businessSections: Record<string,string> = {health:'库存健康', warnings:'库存预警', daily:'物料日报', goods:'关联商品分析', preparation:'生产备料'}
export const parentSection:Record<string,string>={health:'panorama',warnings:'risks',daily:'consumption',goods:'consumption',preparation:'planning'}
export const childSections:Record<string,Record<string,string>>={
 panorama:{panorama:'库存明细与分布',health:'库存健康'},
 planning:{planning:'供需平衡与方案',preparation:'生产备料'},
 consumption:{consumption:'包材消耗分析',daily:'物料日报',goods:'关联商品分析'},
 risks:{risks:'异常处理与跟踪',warnings:'库存预警'},
}
export interface UI { section: string; query: string; category: string; scope: string; riskOnly: boolean; more: boolean; page: number; sort: StandardListSortState | null; prefs: StandardListColumnPreferences; role: string; notice: string; stale: boolean }
export const button = (label: string, action: string, attrs = '') => `<button type="button" class="rounded border px-3 py-2 text-sm hover:bg-muted" data-md-action="${action}" data-skip-page-rerender="true" ${attrs}>${e(label)}</button>`
export const field = (label: string, key: string, value: string|number, type = 'text') => `<label class="block text-xs text-muted-foreground">${e(label)}<input class="mt-1 block w-full rounded border bg-background px-3 py-2 text-sm text-foreground" data-md-field="${key}" data-skip-page-rerender="true" type="${type}" value="${e(value)}"></label>`
const select = (label:string,key:string,value:string,options:string[]) => `<label class="block text-xs text-muted-foreground">${e(label)}<select class="mt-1 w-full rounded border bg-background p-2 text-sm" data-md-field="${key}" data-skip-page-rerender="true">${options.map(o=>`<option ${o===value?'selected':''}>${e(o)}</option>`).join('')}</select></label>`
const n = (v:number|null) => v === null ? '不可计算' : v.toLocaleString('zh-CN',{ maximumFractionDigits:2 })
const box = (title:string,content:string) => `<section class="rounded-lg border bg-card p-4 space-y-3"><h2 class="font-semibold">${e(title)}</h2>${content}</section>`
const list = (lines:string[]) => `<ul class="space-y-2 text-sm">${lines.map(l=>`<li>${e(l)}</li>`).join('')}</ul>`
export function allAssessments(r:Runtime) { return materials.map(m=>assess(m,stock,demands,supplies,r.active)) }
export function selectedRows(r:Runtime,ui:UI):Assessment[] {
 let rows=allAssessments(r).filter(a=>(!ui.query || `${a.material.sku} ${a.material.name} ${a.material.brands.join(' ')}`.toLowerCase().includes(ui.query.toLowerCase())) && (ui.category==='全部类别'||a.material.category===ui.category) && (ui.scope==='全部供给池'||a.material.scope===ui.scope) && (!ui.riskOnly||a.shortage>0||a.issues.length))
 if(ui.sort) { const key=ui.sort.key; rows.sort((a,b)=>{ const av=key==='sku'?a.material.sku:(a as unknown as Record<string,number>)[key]??0; const bv=key==='sku'?b.material.sku:(b as unknown as Record<string,number>)[key]??0; return (typeof av==='string'?av.localeCompare(String(bv)):Number(av)-Number(bv))*(ui.sort!.direction==='asc'?1:-1) }) }
 if(!ui.sort)rows.sort((a,b)=>Number(b.shortage>0)-Number(a.shortage>0)||(a.firstGap??'9999').localeCompare(b.firstGap??'9999')||b.issues.length-a.issues.length||a.material.sku.localeCompare(b.material.sku))
 return rows
}
export function columns(section:string): StandardListColumn<Assessment>[] {
 const text=(key:string,title:string,width:number,render:(a:Assessment)=>string):StandardListColumn<Assessment>=>({key,title,width,freezeable:true,sortable:['physical','free','future','coverage','shortage','firstGap','recommended','daily'].includes(key),render})
 const common:StandardListColumn<Assessment>[] = [
 {key:'sku',title:'物料 / SKU',width:300,required:true,freezeable:true,sortable:true,render:a=>`<div class="space-y-1"><button class="text-blue-600 text-left" data-md-action="detail" data-sku="${e(a.material.sku)}" data-skip-page-rerender="true">${e(a.material.name)}</button><p class="text-xs break-all">${e(a.material.sku)}</p><p class="text-xs text-amber-700">实物图待提供</p></div>`},
 text('scope','供给范围 / 品牌',180,a=>`${e(a.material.scope)}<br><span class="text-xs text-muted-foreground">${e(a.material.brands.join('、')||'通用 / 待确认')}</span>`),
 text('physical','账面实物',110,a=>`${n(a.physical)} ${e(a.material.unit)}`),text('free','自由可用',110,a=>`${n(a.free)} ${e(a.material.unit)}`),
 text('future','未来供给',110,a=>n(a.future)),text('coverage','覆盖天数',115,a=>n(a.coverage)),text('shortage','最大缺口',110,a=>`<span class="${a.shortage?'text-red-600':'text-emerald-700'}">${n(a.shortage)}</span>`),
 text('firstGap','首次缺口',125,a=>e(a.firstGap??'窗口内无缺口')),text('recommended','建议补充',120,a=>n(a.recommended)),
 text('issues','可信度 / 处理',180,a=>`${e(a.issues.length?'数据待核实':'计算数据完整')}<br><span class="text-xs">${e(a.material.owner)}</span>`),
 ]
 if(section==='consumption') common.splice(2,0,text('daily','计划日均需求',140,a=>n(a.daily)))
 common.push({key:'actions',title:'操作',width:140,required:true,actionColumn:true,render:a=>button(section==='risks'?'处理风险':'查看详情',section==='risks'?'risk':'detail',`data-sku="${e(a.material.sku)}"`)})
 return common
}
export function renderBody(r:Runtime,ui:UI):string {
 const rows=selectedRows(r,ui), risks=rows.filter(a=>a.shortage>0), incomplete=rows.filter(a=>a.issues.length)
 const parent=parentSection[ui.section]??ui.section
 const children=childSections[parent]
 const nav=Object.entries(sections).map(([k,v])=>`<a href="${base}/${k}" ${parent===k?'aria-current="page"':''} class="whitespace-nowrap rounded px-3 py-2 text-sm ${parent===k?'bg-teal-600 text-white':'hover:bg-muted'}">${v}</a>`).join('')
 const subnav=children?`<nav aria-label="${e(sections[parent])}子页面" class="flex flex-wrap gap-2 border-b pb-3">${Object.entries(children).map(([k,v])=>`<a href="${base}/${k}" ${ui.section===k?'aria-current="page"':''} class="rounded px-3 py-2 text-sm ${ui.section===k?'border-b-2 border-teal-600 text-teal-800 font-semibold':'text-muted-foreground hover:bg-muted'}">${v}</a>`).join('')}</nav>`:''
 const rulesLink=ui.section==='configuration'?'':`<a class="text-sm text-teal-700 underline" href="${base}/configuration#rule-${businessSections[ui.section]?ui.section:'decision'}">查看本页规则</a>`
 const head=`<div class="p-4 pb-0 space-y-3"><div class="flex flex-wrap justify-between gap-3"><div><p class="text-xs text-muted-foreground">数据决策系统 / 供应链域 / 物料监控与决策</p><h1 class="text-xl font-semibold">${e(sections[parent])}</h1></div>${select('演示角色','role',ui.role,['物料计划员','规则批准人','只读查看者'])}</div><p class="rounded border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">本地演示快照 ${snapshot} · 数量为Mock · 尚未接入线上账务 · 物料实物图待提供</p><nav aria-label="物料监控一级功能" class="flex flex-wrap gap-1 border-b pb-3">${nav}</nav>${subnav}<div class="flex flex-wrap justify-between gap-2"><p class="text-xs text-muted-foreground">${businessSections[ui.section]?'本页使用独立演示口径，详见页面说明；不受供需决策规则自动覆盖。':e(r.active.name)+' · V'+r.active.version+' · 截点 '+startDate+' 09:00 · '+e(r.active.timezone)} · ${ui.stale?'数据已过期，禁止执行建议':'固定演示快照'}</p>${rulesLink}</div><div id="md-notice" role="status" class="text-sm text-blue-700">${e(ui.notice)}</div></div>`
 if(ui.section==='health')return head+renderHealthView()
 if(ui.section==='warnings')return head+renderWarningsView()
 if(ui.section==='daily'||ui.section==='goods')return head+renderDailyView(ui.section)
 if(ui.section==='preparation')return head+renderPreparationView()
 if(ui.section==='configuration')return head+renderConfiguration(r)
 if(ui.section==='quality')return head+`<div class="p-4 space-y-4">${box('数据覆盖与阻塞',list([`可计算对象 ${rows.length-incomplete.length}/${rows.length}；当前目录为用户清单＋2条面料示例，不代表全公司覆盖。`,`全部${materials.length}个对象缺少已核实的实物图，不能完成图片验收。`,'生产连接器、服务端权限与实物对账未接入；本地角色仅演示。']))}${button(ui.stale?'恢复演示水位':'模拟数据中断','stale')}${box('待核实明细',rows.filter(a=>a.issues.length).map(a=>`<div class="border-b py-2 text-sm"><button class="text-blue-600" data-md-action="detail" data-sku="${e(a.material.sku)}" data-skip-page-rerender="true">${e(a.material.sku)}</button> · ${e(a.issues.join('；'))}</div>`).join(''))}${box('仓库目录：17条',list(warehouses.map(w=>`${w[1]}（${w[0]}） · ${w[2]}`)))}${box('加工地点待映射',list(processingTypes.map(t=>`${t}待加工场景：实际地点、物权和工序映射待核实`)))}</div>`
 const filters=`<div class="space-y-3 rounded border p-3"><div class="grid grid-cols-1 gap-3 md:grid-cols-3">${field('物料编码 / 名称 / 品牌','query',ui.query)}${select('物料类别','category',ui.category,['全部类别','面料','辅料','包材','耗材','纱线'])}${select('供给池','scope',ui.scope,['全部供给池','面料供给池','包装供给池'])}</div>${ui.more?`<div class="flex gap-3 text-sm"><label><input type="checkbox" data-md-field="riskOnly" data-skip-page-rerender="true" ${ui.riskOnly?'checked':''}> 只看风险或数据异常</label><p>品牌支持在上方查询框搜索；共享库存不可按品牌累加。</p></div>`:''}<div class="flex flex-wrap gap-2">${button('查询','query')}${button('重置','reset')}${button('导出当前筛选','export')}${button(ui.more?'收起筛选':'更多筛选','more')}${button('列设置','columns')}</div></div>`
 const pageSize=ui.prefs.pageSize,totalPages=Math.max(1,Math.ceil(rows.length/pageSize)),page=Math.min(ui.page,totalPages),pageRows=rows.slice((page-1)*pageSize,page*pageSize)
 const stats=renderStandardListStats([{label:'监控对象',value:rows.length},{label:'缺口对象',value:risks.length},{label:'数据待核实',value:incomplete.length},{label:'库存金额',value:'成本未知'}])
 const overview=ui.section==='overview'?box('未来缺口分布',`<div class="space-y-3">${[7,14,30].map(days=>{const count=risks.filter(a=>a.firstGap!<addDays(startDate,days)).length;return `<div class="flex items-center gap-3 text-sm"><span class="w-24">${days}日内</span><div class="h-3 flex-1 rounded bg-muted"><div class="h-3 rounded bg-rose-400" style="width:${rows.length?100*count/rows.length:0}%"></div></div><span>${count}个对象</span></div>`}).join('')}</div><p class="mt-3 text-xs text-muted-foreground">按SKU×供给池去重，订单影响与对象数量不同；共用白吊粒库存只记录一次。</p>`):''
 const consumption=ui.section==='consumption'?renderPackagingPanel()+box('分析口径',list(['下表日均为窗口内计划需求÷窗口天数，不能冒充实际历史消耗。','销量、BOM推算、实际领用与退料当前未接入：显示未知，不按0统计。','成本与汇率缺失，周转天数、超储金额和节约金额不可计算。','低库存及无历史消耗对象仍参与未来确定需求判断。'])):''
 return head+overview+consumption+(ui.section==='planning'?renderPlanningMatrix(rows,r)+`<div class="p-4"><details><summary class="cursor-pointer font-semibold py-3">加工供给与候选方案演算</summary>${renderProcessingPanel()}</details></div>`:'')+renderStandardListPage({title:sections[ui.section]||'物料全景',filtersHtml:filters,statsHtml:stats,tableHtml:renderStandardListTable({columns:columns(ui.section),rows:pageRows,preferences:ui.prefs,sort:ui.sort,eventPrefix:'md',skipPageRerender:true,emptyText:'当前筛选没有匹配物料'}),paginationHtml:renderTablePagination({total:rows.length,from:rows.length?(page-1)*pageSize+1:0,to:Math.min(page*pageSize,rows.length),currentPage:page,totalPages,pageSize,actionPrefix:'md',skipPageRerender:true})})
}
export function renderConfiguration(r:Runtime):string {
 const p=r.draft
 const explained=(label:string,key:string,value:string|number,help:string,type='number')=>`<div>${field(label,key,value,type)}<p class="mt-1 text-xs text-muted-foreground">${e(help)}</p></div>`
 const ruleRow=(id:string,title:string,scope:string,status:string,href:string)=>`<article id="rule-${id}" class="scroll-mt-4 rounded border p-3 space-y-2"><h3 class="font-medium">${title}</h3><p class="text-sm">${scope}</p><p class="text-xs text-muted-foreground">${status}</p><a class="text-sm text-teal-700 underline" href="${href}">${id==='decision'?'编辑下方供需规则':'查看对应业务页与规则'}</a></article>`
 return `<div class="p-4 space-y-4">${box('规则决定什么？',`<p class="text-sm">统计口径决定“哪些数据参与、怎样计算”；决策策略决定“何时提醒、补多少、怎样补”。修改规则不会修改库存或源单据。</p><div class="grid md:grid-cols-3 gap-3 text-sm"><p class="rounded bg-muted p-3">① 确认适用对象与影响页面</p><p class="rounded bg-muted p-3">② 修改草稿，比较同一快照的结果</p><p class="rounded bg-muted p-3">③ 批准发布，保留版本与历史</p></div>`)}
 ${box('规则目录与适用范围',`<p class="text-sm">当前各业务规则尚未统一发布。下面明确列出管理位置；供需规则发布只影响已接入的决策页面。</p><div class="grid md:grid-cols-2 gap-3">
 ${ruleRow('decision','供需决策规则',`适用：主目录 ${materials.length} 个SKU，面料/包装供给池。影响：决策总览、库存明细、供需平衡、异常处理中的缺口与补充建议。`,'已接入本机版本试算与发布；库存质量、预留和需求去重逻辑固定，不在这里任意改写。','#decision-editor')}
 ${ruleRow('health','库存健康分类规则','大中小仓、覆盖分类、消耗分类和六类动作建议。','管理位置：库存健康页的阈值试算；仅临时演示，未接入这里的版本发布。',base+'/health')}
 ${ruleRow('warnings','库存预警统计与阈值','7日订单折算、库存范围、覆盖区间、采购ETA估算。','管理位置：预警页的完整口径说明；历史参考规则，只读查看并支持库存对照。',base+'/warnings')}
 ${ruleRow('daily','物料日报统计口径','截止日、采购与BOM需求、未映射、重点物料及突变。','管理位置：日报页；截止日可切换，统计公式固定，未接入统一发布。',base+'/daily')}
 ${ruleRow('goods','商品与用料归因','品牌渠道销量、BOM关联与预选关系。','管理位置：商品分析页；关联与去重口径固定。',base+'/goods')}
 ${ruleRow('preparation','生产备料补充规则','按目标SKU设置不足条件、补充目标、原料与顺序工序。','管理位置：生产备料→编辑；本机保存并重算，独立于供需规则版本。',base+'/preparation')}
 </div>`)}
 <section id="decision-editor" class="scroll-mt-4 space-y-4">${box('供需决策规则 · 编辑草稿',`<p class="text-sm">正式V${r.active.version}，草稿V${p.version}。修改后先试算，再由规则批准人模拟发布。</p><div class="grid md:grid-cols-2 gap-4">${explained('规则名称','policy-name',p.name,'用于辨认版本，不改变计算。','text')}${explained('业务时区','policy-timezone',p.timezone,'说明业务日期归属；当前演示快照不会因修改时区重新抽取。','text')}</div>
 <fieldset class="rounded border p-4 space-y-3"><legend class="px-2 font-medium">统计口径：需求与供给怎样参与</legend><p class="text-sm">合格库存扣除范围外占用；确定需求与预测去重。待检和冻结库存不作为自由可用量。</p><div class="grid md:grid-cols-2 gap-4">${explained('从快照起计算未来多少天','policy-horizon',p.horizon,'例如30天：计算这30天内每日供需与最大缺口。')}${explained('未被确定需求覆盖的预测系数','policy-coefficient',p.coefficient,'1表示全部纳入；0.65表示纳入65%。已转确定需求的预测不会再次计入。')}</div><label class="text-sm block"><input data-md-field="policy-includeConditional" data-skip-page-rerender="true" type="checkbox" ${p.includeConditional?'checked':''}> 在情景试算中纳入条件供给</label><p class="text-xs text-muted-foreground">例如尚未确定的未来供给；勾选只改变试算情景，不将它当作已承诺到货。</p></fieldset>
 <fieldset class="rounded border p-4 space-y-3"><legend class="px-2 font-medium">补充策略：缺料时建议补多少</legend><p class="text-sm">以下是未配置SKU专用规则时的演示默认值。数量分别按每个SKU基本单位解释，不能把50 Yard和50个视为同一业务标准；生产使用前应逐SKU确认。</p><div class="grid md:grid-cols-2 gap-4">${explained('预计补充到货需要几天','policy-lead',p.lead,'用于估算建议到货日；到货前缺口仍单独提示。')}${explained('希望额外保留的安全量','policy-safety',p.safety,'加在净补充需求上，单位取该SKU基本单位。')}${explained('最小补充数量（MOQ）','policy-moq',p.moq,'有补充需求时至少补多少；无需补充时不会强行下单。')}${explained('每包/每批数量倍数','policy-pack',p.pack,'建议向上取整。例如需121、最小量100、倍数50，建议150。')}</div></fieldset>
 <div class="flex flex-wrap gap-2">${button('保存草稿','save-draft')}${button('同快照试算','trial')}${button('模拟批准并发布','publish')}${button('恢复上一版本为草稿','rollback')}</div>`)}
 ${box('SKU专用补充策略 · 覆盖默认值',`<p class="text-sm">为选中的SKU单独设置到货周期、安全量、最小补充量及整包倍数。精确SKU规则优先于上方默认值；同一SKU不能重复添加。需求窗口和预测系数仍继承共同口径。</p><p id="md-override-unit" class="text-sm text-teal-800">当前SKU基本单位：${e(materials[0].unit)}；下方三个数量字段均使用此单位。</p><div class="grid grid-cols-2 md:grid-cols-5 gap-3">${select('物料SKU','override-sku',materials[0].sku,materials.map(m=>m.sku))}${field('到货需要几天','override-lead',p.lead,'number')}${field('安全量','override-safety',p.safety,'number')}${field('最小补充量','override-moq',p.moq,'number')}${field('整包倍数','override-pack',p.pack,'number')}</div>${button('加入SKU策略草稿','override-add')}${(p.overrides??[]).map(o=>`<div class="text-sm border-t py-2">${e(o.sku)} · ${e(materials.find(m=>m.sku===o.sku)?.unit??'单位待核实')}：到货${o.lead}天 / 安全量${o.safety} / 最小补充${o.moq} / 倍数${o.pack} ${button('移除','override-remove',`data-sku="${e(o.sku)}"`)}</div>`).join('')}`)}
 <div id="md-trial">${renderTrial(r)}</div>${box('版本与生效记录',list(r.versions.map(v=>`V${v.policy.version} · ${v.policy.name} · ${v.action} · ${v.at}`)))}${box('发布影响与边界',list(['本机模拟发布后，已接入的决策页面使用新版本；健康、预警、日报、商品和备料独立规则不会被覆盖。','每次修改草稿都会使试算失效，需要重新试算。恢复旧参数也通过新版本发布。','监控范围编辑、统一预警规则发布、正式审批排期及服务端权限尚未接入；当前不修改线上数据。']))}</section></div>`
}
export function renderTrial(r:Runtime):string { return box('试算影响报告',r.trial?`<p class="text-sm">同一快照 ${snapshot}，${r.trial.rows.length}个对象；金额未知。未映射对象不输出确定建议。</p><div class="max-h-80 overflow-auto text-sm">${r.trial.rows.map(x=>`<p class="border-b py-2">${e(x.sku)}：补充 ${n(x.before)} → ${n(x.after)}；缺口 ${n(x.gapBefore)} → ${n(x.gapAfter)}</p>`).join('')}</div>`:'<p class="text-sm text-muted-foreground">尚无有效试算，或草稿已改变。请先保存并试算。</p>') }
export function renderDetail(a:Assessment,r:Runtime,mode:string):string {
 const m=a.material
 const days=`<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr>${['日期','需求','供给','日内最低','期末余额','缺口'].map(t=>`<th class="p-2 text-left">${t}</th>`).join('')}</tr></thead><tbody>${a.days.map(d=>`<tr class="border-t ${d.shortage?'text-red-700':''}"><td class="p-2">${d.date}</td><td>${n(d.demand)}</td><td>${n(d.supply)}</td><td>${n(d.minimum)}</td><td>${n(d.balance)}</td><td>${n(d.shortage)}</td></tr>`).join('')}</tbody></table></div>`
 const risk=r.risks[m.sku]; const state=risk?.status??'待确认'
 const decisions=r.decisions.filter(d=>d.sku===m.sku)
 return `<div class="space-y-4">${box(`${m.name} · ${m.sku}`,list([m.notes,`单位：${m.unit}；供给池：${m.scope}；适用品牌：${m.brands.join('、')||'待确认/通用'}`,'真实对应图片尚未提供，图片验收受阻。',`补充策略命中：${r.active.overrides?.some(o=>o.sku===m.sku)?'SKU专用规则':'全局默认'} · 版本V${r.active.version}`,`B0 = 合格库存 ${n(a.qualified)} − 范围外预留 ${n(a.external)} = ${n(a.qualified-a.external)}；内部预留${n(a.internal)}包含于需求，不重复扣减。`,`期初自由可用${n(a.free)}；预测覆盖天数${n(a.coverage)}；到建议到货前缺口${n(a.beforeArrival)}`,`风险：${a.shortage?'存在缺口':'无数量缺口'}；处理状态：${state}；${a.issues.join('；')||'演示计算数据完整'}`]))}
 ${mode==='risk'?box('风险处理',`${field('处理依据','risk-reason',risk?.reason??'')}${field('复查日期','risk-date',risk?.reviewDate??'','date')}<div class="flex flex-wrap gap-2">${['处理中','等待执行结果','待复核','已解决','暂缓处理','待确认'].map(s=>button(s,'risk-state',`data-next="${s}" data-sku="${e(m.sku)}"`)).join('')}</div>${list(risk?.log??[])}`):''}
 ${box('候选方案与执行跟踪',`<p class="text-sm">净缺口按到货日起至窗口末的最低余额评估，再按MOQ/倍数取整。普通采购无法解决到货前缺口。调拨、加工及替代需源系统确认资源和授权。</p><div class="grid grid-cols-2 gap-3">${field('候选数量（基本单位）','decision-qty',a.recommended??0,'number')}${select('候选方式','decision-type','采购',['采购','调拨','加工','获准替代'])}</div><div id="md-comparison"></div>${button('比较候选效果','compare',`data-sku="${e(m.sku)}"`)}${button('保存模拟方案','decision',`data-sku="${e(m.sku)}"`)}${decisions.map(d=>`<div class="border-t py-3 text-sm">${e(d.id)} · ${e(d.type)} ${n(d.qty)} ${e(m.unit)} · ${e(d.arrival)}可用 · ${e(d.status)}<p>方案重算：最大残余缺口 ${n(compareCandidate(a,d.qty,d.arrival).residualGap)}；到货前缺口 ${n(compareCandidate(a,d.qty,d.arrival).beforeArrival)}。模拟方案之间互斥比较，不叠加承诺。</p>${field('关联已有源单号（演示）',`source-${d.id}`,d.sourceNo)}${button('关联并跟踪','link',`data-id="${e(d.id)}" data-sku="${e(m.sku)}"`)}</div>`).join('')}`)}
 ${box('供需日历',days)}${box('库存分布',list(stock.filter(s=>s.sku===m.sku).map(s=>`${s.warehouse} · ${s.quality} · ${n(s.qty)} ${m.unit} · 内部预留${s.internalReserved} / 外部预留${s.externalReserved}`)))}${box('供给链',list(supplies.filter(s=>s.sku===m.sku).map(s=>`${s.source} · ${s.kind} · 剩余${s.qty-s.received} · ${s.date??'日期未知'} · ${s.certain?'确定':'条件供给'} · 链${s.chain}`)))}${box('需求来源（前十条）',list(demands.filter(d=>d.sku===m.sku).slice(0,10).map(d=>`${d.source} · ${d.date} · ${d.kind}需求${d.qty} · 已履行${d.fulfilled} · 已覆盖预测${d.covered}`)))}</div>`
}

function renderPlanningMatrix(rows:Assessment[],r:Runtime):string {
 const dates=Array.from({length:Math.min(14,r.active.horizon)},(_,i)=>addDays(startDate,i))
 return `<div class="p-4">${box('供需日历 · 未来14日',`<p class="text-xs text-muted-foreground">每格为期末余额 / 日内最低余额；红色表示日内曾缺料。全部${r.active.horizon}日及供需单据在物料详情查看。</p><div class="max-w-full overflow-x-auto"><table class="text-xs w-full"><thead><tr><th class="min-w-64 p-2 text-left">物料 / 基本单位</th>${dates.map(d=>`<th class="min-w-24 p-2">${d.slice(5)}</th>`).join('')}</tr></thead><tbody>${rows.slice(0,10).map(a=>`<tr class="border-t"><td class="p-2"><button class="text-blue-600 text-left" data-md-action="detail" data-sku="${e(a.material.sku)}" data-skip-page-rerender="true">${e(a.material.sku)}</button><p>${e(a.material.unit)} · 实物图待提供</p></td>${a.days.slice(0,dates.length).map(d=>`<td class="p-2 text-center ${d.shortage?'bg-red-50 text-red-700':'text-emerald-700'}">${n(d.balance)} / ${n(d.minimum)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>` )}</div>`
}
