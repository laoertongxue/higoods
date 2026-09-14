// Embedded scenario panel, not a standalone management list.
import { escapeHtml as e } from '../../utils'
import { materials } from '../../data/material-decision/fixtures'
import { kitCapacity } from '../../data/material-decision/calculations'
export interface PackagingRule { id: string; brand: string; size: string; method: string; sku: string; priority: number; perUnit: number }
export interface PackagingEvent { id: string; revision: number; type: '领用'|'退料'|'重打'; qty: number }
export function resolvePackagingRule(rules: PackagingRule[], brand: string, size: string, method: string) {
 const matches=rules.filter(r=>r.brand===brand&&r.size===size&&r.method===method)
 const priority=Math.max(...matches.map(r=>r.priority))
 const winners=matches.filter(r=>r.priority===priority)
 return { rule:winners.length===1?winners[0]:null, conflict:winners.length>1, ids:winners.map(r=>r.id) }
}
export function packagingPlan(pieces:number,parcels:number,perUnit:number,loss:number) {
 if (![pieces,parcels,perUnit,loss].every(Number.isFinite)||pieces<0||parcels<0||perUnit<=0||loss<0||!Number.isInteger(pieces)||!Number.isInteger(parcels)) throw new Error('业务量须为非负整数，单耗须大于0，损耗率须非负')
 return { inner:Math.ceil(pieces*perUnit*(1+loss)),outer:Math.ceil(parcels*perUnit*(1+loss)) }
}
export function sharedPendantPlan(available:number,needs:number[]) {
 const demand=needs.reduce((a,b)=>a+b,0)
 let remaining=available
 const allocated=needs.map(n=>{const q=Math.min(n,remaining);remaining-=q;return q})
 return {demand,shortage:Math.max(0,demand-available),allocated}
}
export function summarizePackagingEvents(events:PackagingEvent[]) {
 const latest=new Map<string,PackagingEvent>()
 for(const event of events) {
  if(!Number.isInteger(event.revision)||event.revision<1||!Number.isFinite(event.qty)||event.qty<0) throw new Error('无效事件')
  const prior=latest.get(event.id)
  if(prior?.revision===event.revision&&(prior.qty!==event.qty||prior.type!==event.type)) throw new Error('同一事件修订内容冲突')
  if(!prior||event.revision>prior.revision)latest.set(event.id,event)
 }
 const unique=[...latest.values()]
 const issued=unique.filter(v=>v.type==='领用').reduce((n,v)=>n+v.qty,0)
 const returned=unique.filter(v=>v.type==='退料').reduce((n,v)=>n+v.qty,0)
 const reprints=unique.filter(v=>v.type==='重打').reduce((n,v)=>n+v.qty,0)
 return {count:unique.length,issued,returned,net:issued-returned,reprints}
}
const brands=['FADFAD','CHICMORE','MODISH','ASAYA']
const makeRules=():PackagingRule[]=>materials.filter(m=>m.sku.startsWith('WLID002-')&&/28x(30|37)$/.test(m.sku)).map((m,i)=>({id:`PK-${i+1}`,brand:m.brands[0],size:m.sku.endsWith('28x37')?'28x37':'28x30',method:'手工',sku:m.sku,priority:10,perUnit:1}))
let rules=makeRules()
let state={brand:'FADFAD',size:'28x30',method:'手工',pieces:100,parcels:60,perUnit:1,loss:0,unknown:false,notice:'所有数量、单耗及包装方式为固定 Mock 情景，未写入源系统。'}
let events:PackagingEvent[]=[]
const btn=(label:string,action:string)=>`<button type="button" class="rounded border px-3 py-2 text-sm hover:bg-muted" data-md-packaging-action="${action}" data-skip-page-rerender="true">${e(label)}</button>`
const select=(label:string,key:string,value:string,options:string[])=>`<label class="text-xs">${e(label)}<select data-pk-field="${key}" data-skip-page-rerender="true" class="mt-1 block w-full rounded border bg-background p-2">${options.map(o=>`<option ${o===value?'selected':''}>${e(o)}</option>`).join('')}</select></label>`
const field=(label:string,key:string,value:number)=>`<label class="text-xs">${e(label)}<input type="number" min="0" step="any" data-pk-field="${key}" data-skip-page-rerender="true" value="${value}" class="mt-1 block w-full rounded border bg-background p-2"></label>`
export function renderPackagingPanel():string {
 const match=resolvePackagingRule(rules,state.brand,state.size,state.method)
 const plan=packagingPlan(state.pieces,state.parcels,state.perUnit,state.loss)
 const shared=sharedPendantPlan(100,[60,60,60])
 const totals=summarizePackagingEvents(events)
 const kit=kitCapacity([{available:100,perUnit:1},{available:80,perUnit:state.unknown?null:1},{available:120,perUnit:1}])
 return `<section id="md-packaging" class="my-4 space-y-4 rounded-lg border bg-card p-4"><h2 class="font-semibold">包材适用与齐套试算</h2><p class="text-xs text-amber-700">Mock 演示 · 只保存当前页面内存；刷新恢复。真实物料图片尚缺，素材验收未完成。下列库存为独立验算样例，不与全景库存合并。</p><p role="status" class="text-sm">${e(state.notice)}</p>
 <div class="grid gap-3 md:grid-cols-3">${select('品牌','brand',state.brand,brands)}${select('内袋尺寸','size',state.size,['28x30','28x37'])}${select('包装方式（演示条件）','method',state.method,['手工','机器'])}${field('需包装件数','pieces',state.pieces)}${field('包裹数（非件数）','parcels',state.parcels)}${field('演示单耗','perUnit',state.perUnit)}${field('额外损耗率（0.05表示5%）','loss',state.loss)}</div>
 <div class="flex flex-wrap gap-2">${btn('应用场景并试算','calculate')}${btn('保存当前匹配规则单耗','save')}${btn('模拟同优先级冲突','conflict')}${btn('恢复演示规则','reset')}</div>
 <div class="rounded border p-3 text-sm space-y-2"><p>适用结果：${match.conflict?`<strong class="text-red-600">冲突阻断：${e(match.ids.join('、'))}，不可发布或计算适用需求</strong>`:match.rule?`${e(match.rule.id)} / ${e(match.rule.sku)} · 保存单耗 ${match.rule.perUnit} · 优先级 ${match.rule.priority} · 图片缺失`:'没有已确认的适用规则，不跨尺寸、跨品牌或包装方式自动替代'}</p><p>内袋计划需求：${match.rule?`${plan.inner} 个`:'不可计算'}；外袋基数试算：${plan.outer} 个（按 ${state.parcels} 包裹，外袋SKU适用待核实，不作为补货承诺）。</p><p>ASAYA快递袋：WLID001-asaya-dikemas-dengan-tangan-6c-32x42。图片两格同码，机器/手工待核实；不自动创建机器SKU。旧短码与详细规格不合并库存。</p></div>
 <div class="grid gap-4 md:grid-cols-2"><div class="rounded border p-3 space-y-2 text-sm"><h3 class="font-medium">FADFAD独立齐套样例</h3><p>FLSZ24116-black：100个；WLID009-fadfad：80张；WLID002-fadfad-6.5c-28x30：120个。图片均待补。</p><p>假设每件各1，齐套能力：<strong>${kit===null?'不可计算（吊牌单耗未知）':`${kit} 件`}</strong>。此样例不随上方品牌切换。</p>${btn(state.unknown?'恢复吊牌单耗1':'模拟吊牌单耗缺失','unknown')}<p>WLID008-sameasphoto 碳带：实物5卷；有效打印换算未知，覆盖及打印齐套不可计算，不能按每件1卷。</p></div><div class="rounded border p-3 space-y-2 text-sm"><h3 class="font-medium">共享白吊粒联合计划</h3><p>FLSZ24116-white：共享100个；CHICMORE、MODISH、ASAYA各需60，共${shared.demand}，缺${shared.shortage}。图片待补。</p><p>按显示顺序演示分配：${shared.allocated.join(' / ')}。顺序仅为演示，正式优先级待配置。</p><p>每品牌独立最大可能量100不可相加；三个品牌不能分别承诺100。</p></div></div>
 <div class="rounded border p-3 space-y-2 text-sm"><h3 class="font-medium">源事件回传模拟：空白吊牌 WLID007-sameasphoto</h3><p>领用/退料单位张；重打单位张，为打印活动，不再次扣源库存。图片待补。</p><div class="flex flex-wrap gap-2">${btn('回传领用100张（E1）','issue')}${btn('重复回传E1','duplicate')}${btn('修订E1为90张（v2）','revise')}${btn('回传退料10张（E2）','return')}${btn('回传重打5张（P1）','reprint')}</div><p>唯一事件 ${totals.count}；领用 ${totals.issued}；退料 ${totals.returned}；净领用 ${totals.net}；重打活动 ${totals.reprints}。重打未关联领用事实时保留待核对，不增加净领用。</p><p>接收回传 ${events.length} 次，按事件ID最高修订去重；订单取消不会自动回补实物。</p></div></section>`
}
export function handlePackagingClick(target:HTMLElement):boolean {
 const button=target.closest<HTMLElement>('[data-md-packaging-action]')
 if(!button)return false
 const panel=document.getElementById('md-packaging')
 if(!panel)return true
 const action=button.dataset.mdPackagingAction
 try {
  if(action==='calculate'||action==='save'||action==='conflict') {
   const value=(key:string)=>panel.querySelector<HTMLInputElement|HTMLSelectElement>(`[data-pk-field="${key}"]`)!.value
   const next={...state,brand:value('brand'),size:value('size'),method:value('method'),pieces:Number(value('pieces')),parcels:Number(value('parcels')),perUnit:Number(value('perUnit')),loss:Number(value('loss'))}
   packagingPlan(next.pieces,next.parcels,next.perUnit,next.loss)
   state=next
   const match=resolvePackagingRule(rules,state.brand,state.size,state.method)
   if(action==='save') {
    if(!match.rule)throw new Error('无唯一适用规则，保存被阻止；请先恢复冲突或选择有效场景')
    match.rule.perUnit=state.perUnit
    state.notice='演示规则单耗已保存于内存；未正式发布，也未改动源库存。'
   } else if(action==='conflict') {
    if(!match.rule)throw new Error('请选择一个唯一匹配的场景后模拟冲突')
    rules.push({...match.rule,id:`${match.rule.id}-CONFLICT`})
    state.notice='已模拟同优先级重叠，适用结果阻断；恢复规则后重试。'
   } else state.notice='按当前草稿参数试算；单耗只有点击保存才更新演示规则。'
  } else if(action==='reset') {rules=makeRules();events=[];state={brand:'FADFAD',size:'28x30',method:'手工',pieces:100,parcels:60,perUnit:1,loss:0,unknown:false,notice:'已恢复固定演示情景。'}}
  else if(action==='unknown')state.unknown=!state.unknown
  else {
   const event:Record<string,PackagingEvent>={issue:{id:'E1',revision:1,type:'领用',qty:100},duplicate:{id:'E1',revision:1,type:'领用',qty:100},revise:{id:'E1',revision:2,type:'领用',qty:90},return:{id:'E2',revision:1,type:'退料',qty:10},reprint:{id:'P1',revision:1,type:'重打',qty:5}}
   if(!event[action??''])return true
   const next=[...events,event[action!]]
   const result=summarizePackagingEvents(next)
   if(result.net<0)throw new Error('退料超出当前已知领用，先回传对应领用事实')
   events=next;state.notice='已处理模拟回传；不修改源系统库存。'
  }
 } catch(error) {state.notice=error instanceof Error?error.message:'演示处理失败'}
 panel.outerHTML=renderPackagingPanel()
 return true
}
