// @page-pattern: list
import { escapeHtml as e } from '../../utils'
import { renderStandardListPage, renderStandardListStats } from '../../components/ui/list-page'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table'
import { renderTablePagination } from '../../components/ui/pagination'
import { normalizeListColumnPreferences, paginateStandardListRows, type StandardListColumnPreferences, type StandardListSortState } from '../../components/ui/list-table-model'
import { getBrowserLocalStorage, readBrowserStorageItem, writeBrowserStorageItem } from '../../data/browser-storage'
import { roundReplenishment } from '../../data/material-decision/calculations'
export interface PrepLocation { warehouse: string; qty: number; rolls: number | null; usable: boolean; reason: string }
export interface PrepRule {
 id:string;sku:string;name:string;category:string;unit:string;active:boolean;mode:'固定数量'|'覆盖天数';trigger:number;target:number;days:number;usage7:number|null;incoming:number
 lots:PrepLocation[];processing:boolean;route:string[];rawSku:string;rawUnit:string;rawLots:PrepLocation[];yieldRate:number|null;moq:number;pack:number;note:string
}
export interface PrepRecord {id:string;ruleId:string;kind:'调拨加工'|'采购成品';qty:number;received:number;produced:number;actualSku:string;rawQty:number;rawSku:string;status:'待调拨'|'待采购'|'待加工'|'待交接'|'部分入库'|'已入库'|'已取消';at:string;log:string[]}
export function evaluatePrep(rule:PrepRule,records:PrepRecord[]=[]){
 const usable=rule.lots.filter(l=>l.usable).reduce((s,l)=>s+l.qty,0)
 const daily=rule.usage7===null?null:rule.usage7/7
 const threshold=rule.mode==='固定数量'?rule.trigger:daily===null?null:daily*rule.trigger
 const target=rule.mode==='固定数量'?rule.target:daily===null?null:daily*rule.days
 const completed=records.filter(r=>r.ruleId===rule.id&&r.status!=='已取消').reduce((s,r)=>s+r.received,0)
 const remaining=records.filter(r=>r.ruleId===rule.id&&!['已取消','已入库'].includes(r.status)).reduce((s,r)=>s+Math.max(0,r.qty-r.received),0)
 const available=usable+completed
 const shortage=threshold!==null&&available<threshold
 const net=target===null?null:Math.max(0,target-available-rule.incoming-remaining)
 const recommendation=rule.lots.some(l=>l.warehouse==='待映射仓库')?null:net===null?null:shortage&&rule.active?roundReplenishment(net,rule.moq,rule.pack):0
 const rawAvailable=rule.rawLots.filter(l=>l.usable).reduce((s,l)=>s+l.qty,0)-records.filter(r=>r.rawSku===rule.rawSku&&r.kind==='调拨加工'&&r.status!=='已取消').reduce((s,r)=>s+r.rawQty,0)
 const rawRequired=recommendation===null||rule.yieldRate===null||rule.yieldRate<=0?null:Math.ceil(recommendation/rule.yieldRate*100)/100
 const processingReady=rule.processing&&!!rule.rawSku&&rule.rawUnit===rule.unit&&rule.route.length>0&&rule.yieldRate!==null&&rule.yieldRate>0&&rule.yieldRate<=1
 const transferAllowed=!!(rule.active&&recommendation&&processingReady&&rawRequired!==null&&rawAvailable>=rawRequired)
 const reason=rule.lots.some(l=>l.warehouse==='待映射仓库')?'库存来源待映射，禁止生成建议':!rule.active?'监控已停用':target===null?'7日使用基数未知，无法计算':!shortage?'未达到触发条件':recommendation===0?'已有采购中或有效生成记录覆盖目标量':transferAllowed?'原料合格可用量足够，可调拨后加工':rule.processing?'原料或加工条件不足，可评估直接采购目标成品':'目标SKU需采购补充'
 return {available,daily,threshold,target,remaining,completed,recommendation,rawAvailable,rawRequired,transferAllowed,shortage,reason}
}
export function validatePrep(rule:PrepRule):string[]{
 const errors:string[]=[]
 if(!rule.sku.trim()||!rule.name.trim()||!rule.unit.trim())errors.push('目标SKU、名称和单位必填')
 if(![rule.trigger,rule.target,rule.days,rule.incoming,rule.moq,rule.pack].every(Number.isFinite)||rule.trigger<0||rule.target<0||rule.days<0||rule.incoming<0||rule.moq<0||rule.pack<=0)errors.push('数量必须为有效非负数，整包倍数必须大于0')
 if(rule.mode==='固定数量'&&rule.target<rule.trigger)errors.push('目标量不得低于触发线')
 if(rule.mode==='覆盖天数'&&(rule.days<rule.trigger||rule.days>180))errors.push('目标覆盖天数须不小于触发天数且不超过180')
 if(rule.usage7!==null&&(!Number.isFinite(rule.usage7)||rule.usage7<0))errors.push('7日使用量必须为非负数或未知')
 if(rule.processing&&(!rule.rawSku||!rule.rawUnit||!rule.route.length||rule.yieldRate===null||rule.yieldRate<=0||rule.yieldRate>1))errors.push('加工需配置原料SKU、单位、顺序工序和有效良率')
 return errors
}
export function createPrepRecord(rule:PrepRule,records:PrepRecord[],kind:PrepRecord['kind']):PrepRecord{
 const a=evaluatePrep(rule,records),errors=validatePrep(rule)
 if(errors.length)throw new Error(errors.join('；'))
 if(!a.recommendation)throw new Error(a.reason)
 if(kind==='调拨加工'&&!a.transferAllowed)throw new Error('原料可用量、单位或工序不满足，不能生成调拨加工')
 return {id:`SIM-PREP-${records.length+1}`,ruleId:rule.id,kind,qty:a.recommendation,received:0,produced:0,actualSku:'',rawSku:rule.rawSku,rawQty:kind==='调拨加工'?a.rawRequired!:0,status:kind==='调拨加工'?'待调拨':'待采购',at:new Date().toISOString(),log:[`生成本地${kind}建议；未创建源系统单据`]}
}
export function receivePrep(record:PrepRecord,rule:PrepRule,qty:number,actualSku:string){
 if(['已取消','已入库'].includes(record.status))throw new Error('记录已关闭')
 if(!actualSku.trim()||actualSku!==rule.sku)throw new Error('实际入库SKU必须与目标SKU一致，缺失SKU不能回写库存')
 if(!Number.isFinite(qty)||qty<=0||record.received+qty>record.qty)throw new Error('实收数量必须大于0且不能超出待收量')
 if(record.kind==='调拨加工'&&(!['待交接','部分入库'].includes(record.status)||record.received+qty>record.produced))throw new Error('先登记实际加工产出，实收不能超过已产出量')
 record.received+=qty;record.actualSku=actualSku;record.status=record.received===record.qty?'已入库':'部分入库';record.log.push(`本地模拟实收 ${qty} ${rule.unit}，SKU ${actualSku}`)
}
const location=(warehouse:string,qty:number,usable=true):PrepLocation=>({warehouse,qty,rolls:null,usable,reason:usable?'合格、用途获准（演示）':'待检或用途不允许'})
function initialRules():PrepRule[]{return Array.from({length:12},(_,i)=>({
 id:`PR-${i+1}`,sku:i===0?'CNIDML096-black-19-4003PT':i===1?'POLYMICRO-DEMO-BLACK':i===2?'POLYMICRO-DEMO-WHITE':`DEMO-PREP-${i+1}`,name:i===0?'黑色面料':i<3?'polymicro面料':`演示${i%2?'包材':'面料'} ${i+1}`,category:i<3?'面料':i%2?'包材':'面料',unit:i<3||i%2===0?'Yard':'个',active:true,mode:'固定数量',trigger:i<3?6000:300,target:i<3?8000:600,days:60,usage7:i===10?null:350+i*70,incoming:i===1?7000:i===2?7000:0,lots:[location('WH-FABRIC-001',i===0?0:i===1?1208.43:i===2?1197.49:50+i*30),location('HILON-1',i===0?0:20,false)],processing:i<3,route:i<3?['染色','印花']:[],rawSku:i===0?'CNIDML096-white':i<3?'DEMO-POLY-RAW':'',rawUnit:'Yard',rawLots:i<3?[location('WH-FABRIC-001',i===0?10000:300),location('HILON-1',1000,false)]:[],yieldRate:i<3?.95:1,moq:0,pack:i<3?10:1,note:'独立备料演示快照；不是历史页面实际库存。'
}))}
let rules=initialRules(),records:PrepRecord[]=[],query='',category='全部类型',process='全部',status='全部',notice='',page=1,sort:StandardListSortState|null=null,editing:string|null=null,showRecords:string|null=null
const key='higood.material-preparation.demo.v1'
try{const saved=JSON.parse(readBrowserStorageItem(getBrowserLocalStorage(),key)??'null');if(Array.isArray(saved?.rules)&&Array.isArray(saved?.records)&&saved.rules.every((r:PrepRule)=>Array.isArray(r.lots)&&Array.isArray(r.rawLots)&&!validatePrep(r).length)){rules=saved.rules;records=saved.records}}catch{}
const action=(text:string,value:string,attrs='')=>`<button type="button" class="rounded border px-3 py-2 text-sm hover:bg-muted" data-md-prep-action="${value}" data-skip-page-rerender="true" ${attrs}>${e(text)}</button>`
const field=(text:string,id:string,value:string|number,type='text')=>`<label class="text-xs">${e(text)}<input class="mt-1 block w-full rounded border bg-background p-2" data-prep-field="${id}" data-skip-page-rerender="true" value="${e(value)}" type="${type}"></label>`
const select=(text:string,id:string,value:string,options:string[])=>`<label class="text-xs">${e(text)}<select class="mt-1 block w-full rounded border bg-background p-2" data-prep-field="${id}" data-skip-page-rerender="true">${options.map(o=>`<option ${o===value?'selected':''}>${e(o)}</option>`).join('')}</select></label>`
const fmt=(n:number|null)=>n===null?'未知':n.toLocaleString('zh-CN',{maximumFractionDigits:2})
function save(){if(!writeBrowserStorageItem(getBrowserLocalStorage(),key,JSON.stringify({rules,records})))notice+='；本机存储不可用，请保留页面'}
const columns:StandardListColumn<PrepRule>[]=[
 {key:'sku',title:'目标物料 / SKU',width:260,required:true,freezeable:true,render:r=>`<strong>${e(r.name)}</strong><p class="text-xs break-all">${e(r.sku)}</p><p class="text-xs text-amber-700">实物图待提供 · ${e(r.category)}</p>`},
 {key:'stock',title:'目标库存（分仓）',width:210,render:r=>r.lots.map(l=>`<p>${e(l.warehouse)}：${fmt(l.qty)} ${e(r.unit)} / 卷数${l.rolls??'未知'}</p>`).join('')+`<p>模拟实收增加 ${fmt(evaluatePrep(r,records).completed)}</p>`},
 {key:'rule',title:'不足条件 / 目标',width:185,render:r=>`${r.mode==='固定数量'?'可用量低于':'覆盖低于'} ${r.trigger} ${r.mode==='固定数量'?e(r.unit):'天'}<p>补充目标 ${r.mode==='固定数量'?r.target:r.days} ${r.mode==='固定数量'?e(r.unit):'天'}</p>`},
 {key:'use',title:'7日使用 / 采购中',width:150,render:r=>`${fmt(r.usage7)} ${e(r.unit)}<p>采购中 ${fmt(r.incoming)}</p>`},
 {key:'suggest',title:'建议补充 / 原因',width:220,render:r=>{const a=evaluatePrep(r,records);return `<strong class="${a.shortage?'text-amber-700':'text-emerald-700'}">${a.shortage?'库存不足':'库存充足'} · ${fmt(a.recommendation)} ${e(r.unit)}</strong><p class="text-xs">${e(a.reason)}</p><p>生成记录待供 ${fmt(a.remaining)}</p>`}},
 {key:'raw',title:'加工原料 / 顺序工序',width:230,render:r=>r.processing?`<p>${e(r.rawSku)} · ${e(r.route.join(' → '))}</p>${r.rawLots.map(l=>`<p class="text-xs">${e(l.warehouse)} ${fmt(l.qty)} ${e(r.rawUnit)} · ${l.usable?'可用':'不纳入'}</p>`).join('')}<p>新增可用 ${fmt(evaluatePrep(r,records).rawAvailable)} ${e(r.rawUnit)}；良率 ${r.yieldRate}</p>`:'无需加工'},
 {key:'action',title:'操作',width:200,required:true,actionColumn:true,render:r=>`<div class="flex flex-wrap gap-1">${action('编辑','edit',`data-id="${r.id}"`)}${action('生成建议','generate',`data-id="${r.id}"`)}${action('记录','records',`data-id="${r.id}"`)}</div>`},
]
let prefs:StandardListColumnPreferences=normalizeListColumnPreferences(columns,{visibleKeys:columns.map(c=>c.key),order:columns.map(c=>c.key),frozenKeys:['sku'],pageSize:10},[10,20,50])
function editor(){const r=rules.find(r=>r.id===editing)??{...initialRules()[3],id:'new',sku:'',name:'',lots:[location('待映射仓库',0)],processing:false,route:[],rawSku:'',rawLots:[]};return `<section class="rounded border bg-card p-4 space-y-3" aria-label="备料规则编辑"><h2 class="font-semibold">${editing==='new'?'添加监控SKU':'编辑监控规则'}</h2><p class="text-xs text-muted-foreground">只编辑本地监控规则；库存与采购中来自演示事实，不能在此手工改账。新增对象为待接入演示数据。</p><div class="grid grid-cols-2 md:grid-cols-4 gap-3">${field('目标SKU','sku',r.sku)}${field('名称','name',r.name)}${select('类别','category',r.category,['面料','辅料','包材','耗材','纱线'])}${field('基本单位','unit',r.unit)}${select('不足判断','mode',r.mode,['固定数量','覆盖天数'])}${field('触发线（数量或天）','trigger',r.trigger,'number')}${field('补充目标量','target',r.target,'number')}${field('目标覆盖天数','days',r.days,'number')}${select('是否加工','processing',r.processing?'是':'否',['否','是'])}${field('原料SKU','rawSku',r.rawSku)}${field('原料单位','rawUnit',r.rawUnit)}${field('良率（0至1）','yieldRate',r.yieldRate??'','number')}${field('顺序工序（逗号分隔）','route',r.route.join(','))}${field('MOQ','moq',r.moq,'number')}${field('整包倍数','pack',r.pack,'number')}${select('监控状态','active',r.active?'启用':'停用',['启用','停用'])}</div>${field('说明','note',r.note)}<div class="flex gap-2">${action('保存并重算','save')}${action('取消编辑','cancel-edit')}</div></section>`}
function recordView(id:string){const rule=rules.find(r=>r.id===id)!;return `<section class="rounded border bg-card p-4 space-y-3"><h2 class="font-semibold">${e(rule.sku)} · 生成与执行记录</h2><p class="text-xs text-amber-700">下列回执为本地演示，未在源系统创建或接收任何单据。</p>${records.filter(r=>r.ruleId===id).map(r=>`<article class="border rounded p-3 space-y-2 text-sm"><strong>${r.id} · ${r.kind} · ${r.status}</strong><p>计划 ${r.qty} ${e(rule.unit)}；已产出 ${r.produced}；已实收 ${r.received}；实际SKU ${e(r.actualSku||'未登记')}</p><p>原料占用 ${r.rawQty} ${e(rule.rawUnit)}</p><div class="flex flex-wrap gap-2">${r.status==='待调拨'?action('模拟原料接收','raw-receive',`data-record="${r.id}"`):''}${r.kind==='调拨加工'&&['待加工','待交接','部分入库'].includes(r.status)&&r.produced<r.qty?action('登记模拟产出','produce',`data-record="${r.id}"`):''}${['待采购','待交接','部分入库'].includes(r.status)?action('登记模拟实收','receive',`data-record="${r.id}"`):''}${['待调拨','待采购'].includes(r.status)?action('取消未执行建议','cancel-record',`data-record="${r.id}"`):''}</div><div class="grid grid-cols-2 gap-3">${field('本次回执数量',`qty-${r.id}`,r.qty-r.received,'number')}${field('实际产出/收货SKU',`sku-${r.id}`,r.actualSku)}</div><ul class="text-xs text-muted-foreground">${r.log.map(l=>`<li>${e(l)}</li>`).join('')}</ul></article>`).join('')||'<p>暂无生成记录</p>'}${action('关闭记录','close-records')}</section>`}
export function renderPreparationView():string{
 let filtered=rules.filter(r=>(!query||`${r.sku} ${r.name}`.toLowerCase().includes(query.toLowerCase()))&&(category==='全部类型'||r.category===category)&&(process==='全部'||r.processing===(process==='需加工'))&&(status==='全部'||evaluatePrep(r,records).shortage===(status==='库存不足')))
 const slice=paginateStandardListRows(filtered,page,prefs.pageSize)
 const filters=`<div class="space-y-3 rounded border p-3"><div class="grid md:grid-cols-4 gap-3">${field('SPU / SKU / 名称','query',query)}${select('类型','filter-category',category,['全部类型','面料','辅料','包材','耗材'])}${select('加工','filter-process',process,['全部','需加工','无需加工'])}${select('库存状态','filter-status',status,['全部','库存不足','库存充足'])}</div><div class="flex gap-2">${action('查询','query')}${action('重置','reset')}${action('手动添加监控SKU','add')}</div></div>`
 return `<div id="md-preparation" class="space-y-3"><p class="mx-4 rounded border border-amber-200 bg-amber-50 p-3 text-xs">生产备料独立演示快照 · 固定量和覆盖天数两种策略 · 所有生成及回执只保存本机 · 数量不是历史页面实际值</p><p class="px-4 text-sm text-blue-700" role="status">${e(notice)}</p>${editing?`<div class="p-4">${editor()}</div>`:''}${showRecords?`<div class="p-4">${recordView(showRecords)}</div>`:''}${renderStandardListPage({title:'生产备料监控',filtersHtml:filters,statsHtml:renderStandardListStats([{label:'监控SKU',value:filtered.length},{label:'库存不足',value:filtered.filter(r=>evaluatePrep(r,records).shortage).length},{label:'生成记录',value:records.length},{label:'有待供给',value:filtered.filter(r=>evaluatePrep(r,records).remaining>0).length}]),tableHtml:renderStandardListTable({columns,rows:slice.rows,preferences:prefs,sort,eventPrefix:'md-prep',skipPageRerender:true}),paginationHtml:renderTablePagination({...slice,actionPrefix:'md-prep',skipPageRerender:true})})}</div>`
}
export function handlePreparationClick(target:HTMLElement):boolean{
 const b=target.closest<HTMLElement>('[data-md-prep-action]');if(!b)return false
 const value=(key:string)=>document.querySelector<HTMLInputElement>(`[data-prep-field="${CSS.escape(key)}"]`)?.value??''
 const id=b.dataset.id; const record=records.find(r=>r.id===b.dataset.record)
 try{
 switch(b.dataset.mdPrepAction){
 case'query':query=value('query');category=value('filter-category');process=value('filter-process');status=value('filter-status');page=1;break
 case'reset':query='';category='全部类型';process='全部';status='全部';page=1;break
 case'prev-page':page=Math.max(1,page-1);break
 case'next-page':page++;break
 case'add':editing='new';showRecords=null;break
 case'edit':editing=id!;showRecords=null;break
 case'cancel-edit':editing=null;break
 case'save':{const old=rules.find(r=>r.id===editing);const r:PrepRule={...(old??initialRules()[3]),id:old?.id??`PR-${Date.now()}`,sku:value('sku').trim(),name:value('name').trim(),category:value('category'),unit:value('unit'),mode:value('mode') as PrepRule['mode'],trigger:Number(value('trigger')),target:Number(value('target')),days:Number(value('days')),processing:value('processing')==='是',rawSku:value('rawSku'),rawUnit:value('rawUnit'),yieldRate:value('yieldRate')===''?null:Number(value('yieldRate')),route:value('route').split(/[,，]/).map(s=>s.trim()).filter(Boolean),moq:Number(value('moq')),pack:Number(value('pack')),active:value('active')==='启用',note:value('note')};if(!old){r.lots=[location('待映射仓库',0,false)];r.usage7=null;r.incoming=0;r.rawLots=[]}if(old&&(r.sku!==old.sku||r.unit!==old.unit))throw new Error('已有库存事实不能改绑目标SKU或单位，请新增规则');const errors=validatePrep(r);if(rules.some(x=>x.id!==r.id&&x.sku===r.sku))errors.push('目标SKU已在监控中');if(errors.length)throw new Error(errors.join('；'));if(old&&(r.rawSku!==old.rawSku||r.rawUnit!==old.rawUnit)){if(records.some(x=>x.ruleId===old.id&&x.status!=='已取消'))throw new Error('已有加工记录不能改绑原料，请新增规则');r.rawLots=[]}if(old)rules=rules.map(x=>x.id===r.id?r:x);else rules.push(r);editing=null;save();notice='规则已保存并重算；源库存未改动';break}
 case'generate':{const r=rules.find(r=>r.id===id)!;const a=evaluatePrep(r,records);const rec=createPrepRecord(r,records,a.transferAllowed?'调拨加工':'采购成品');records.push(rec);showRecords=id!;save();notice=`已生成 ${rec.id} 本地建议，已有待供给计入下一次计算，避免重复生成`;break}
 case'records':showRecords=id!;editing=null;break
 case'close-records':showRecords=null;break
 case'raw-receive':if(record?.status!=='待调拨')throw new Error('原料接收状态不允许');record.status='待加工';record.log.push('本地模拟接收原料，未增加目标库存');save();break
 case'produce':{if(!record||record.kind!=='调拨加工'||!['待加工','待交接','部分入库'].includes(record.status))throw new Error('当前记录不能产出');const r=rules.find(r=>r.id===record.ruleId)!;const sku=value(`sku-${record.id}`),qty=Number(value(`qty-${record.id}`));if(sku!==r.sku||!sku)throw new Error('实际产出SKU必须与目标一致');if(!Number.isFinite(qty)||qty<=0||record.produced+qty>record.qty)throw new Error('产出量不能超过计划量');record.actualSku=sku;record.produced+=qty;record.status='待交接';record.log.push(`模拟产出${qty}，尚未在目标仓实收`);save();break}
 case'receive':{if(!record)throw new Error('记录不存在');const r=rules.find(r=>r.id===record.ruleId)!;receivePrep(record,r,Number(value(`qty-${record.id}`)),value(`sku-${record.id}`));save();notice='模拟实收已回写本机快照，待供给同时冲减';break}
 case'cancel-record':if(!record||!['待采购','待调拨'].includes(record.status))throw new Error('已执行记录不能直接取消');record.status='已取消';record.log.push('取消未执行演示建议，解除本机原料占用');save();break
 }
 }catch(error){notice=error instanceof Error?error.message:String(error)}
 document.querySelector('#md-preparation')?.outerHTML&&(document.querySelector('#md-preparation')!.outerHTML=renderPreparationView());return true
}
export function handlePreparationChange(target:HTMLElement):boolean{const t=target.closest<HTMLSelectElement>('[data-md-prep-field="pageSize"]');if(!t)return false;prefs.pageSize=Number(t.value);page=1;document.querySelector('#md-preparation')!.outerHTML=renderPreparationView();return true}
