import type { PFNode, PFTask } from './model'
import { snapshot } from './fixtures'
import { shipmentProgress } from './calculations'
import { badge, card, dt, e, fmt } from './common'

type QuantitySeries = '计划实发' | '合格回货' | '质检可发' | '实际发货'
export interface QuantityEvidence {
  id:string; series:QuantitySeries; kind:'计划'|'实际事件'|'当前快照'; at:string;
  quantity:number; delta:number|null; source:string; note:string;
}

/** One explicit Mock evidence list supplies both the chart and the event detail table. */
export const mainEvidence:readonly QuantityEvidence[] = [
  {id:'MOCK-PLAN-001-START',series:'计划实发',kind:'计划',at:'2026-08-28T10:00:00+08:00',quantity:0,delta:null,source:'MOCK-DEM-001 / 原始计划',note:'整批发货计划起点，未拆每日发货配额'},
  {id:'MOCK-PLAN-001-FULL',series:'计划实发',kind:'计划',at:'2026-09-21T10:00:00+08:00',quantity:1000,delta:null,source:'W31 / 标准网络 D24',note:'未来计划：D24 完成1000件实发，尚未发生'},
  {id:'MOCK-RETURN-001-01',series:'合格回货',kind:'实际事件',at:'2026-09-16T10:00:00+08:00',quantity:200,delta:200,source:'W29 / 首批合格回货实收',note:'D19 首批实收200件'},
  {id:'MOCK-RETURN-001-02',series:'合格回货',kind:'实际事件',at:'2026-09-17T10:00:00+08:00',quantity:400,delta:200,source:'W29 / 第二批合格回货实收',note:'D20 再实收200件，累计400件'},
  {id:'MOCK-QC-001-SNAPSHOT',series:'质检可发',kind:'当前快照',at:snapshot,quantity:0,delta:null,source:'W30 / 当前合格可发数量',note:'当前0件；缺少更多历史事件，不倒造早期记录'},
  {id:'MOCK-SHIP-001-SNAPSHOT',series:'实际发货',kind:'当前快照',at:snapshot,quantity:0,delta:null,source:'W31 / 当前实发数量',note:'当前0件；计划不作为实际发货事实'},
]

const DAY = 86_400_000
const daysSince = (at:string,start:string):number => (Date.parse(at)-Date.parse(start))/DAY
const series:QuantitySeries[]=['计划实发','合格回货','质检可发','实际发货']
const seriesColor:Record<QuantitySeries,string>={'计划实发':'#64748b','合格回货':'#2563eb','质检可发':'#0f766e','实际发货':'#7c3aed'}

function taskQuantityEvidence(task:PFTask):QuantityEvidence[] {
  if(task.id==='MOCK-PT-001')return mainEvidence.map(point=>({...point}))
  const points:QuantityEvidence[]=[]
  if(task.baselineDueAt)points.push({id:`${task.id}-PLAN`,series:'计划实发',kind:'计划',at:task.baselineDueAt,quantity:task.effectiveQty,delta:null,source:`${task.ruleVersion} / 任务原始基线`,note:'仅有整批截止计划，未配置日配额或中间数量里程碑'})
  for(const [stage,name] of [['S07','合格回货'],['S08','质检可发'],['S09','实际发货']] as const){
    const nodes=task.nodes.filter(node=>node.stage===stage)
    const outputs=nodes.filter(node=>!nodes.some(other=>other.predecessors.includes(node.id)))
    // Several unrelated output streams cannot be summed without quantity allocation evidence.
    const node=outputs.length===1?outputs[0]:null
    if(!node)continue
    const quantity=name==='实际发货'?task.shippedQty:node.qualifiedQty
    const isFinalFact=Boolean(node.actualEndAt)&&node.qualifiedQty>=node.requiredQty
    const at=isFinalFact?node.actualEndAt!:node.sourceUpdatedAt
    if(!at||Date.parse(at)>Date.parse(snapshot))continue
    points.push({id:`${task.id}-${node.id}-KNOWN`,series:name,kind:isFinalFact?'实际事件':'当前快照',at,quantity,delta:null,source:`${node.id} / ${node.sourceDocumentId}`,note:isFinalFact?'已有最终完成时刻与数量；早期中间批次未知':'只有截至来源更新时的累计数量；不代表这一时刻一次完成全部数量'})
  }
  return points
}

function quantityChart(task:PFTask,points:QuantityEvidence[]):string {
  const width=1000,height=335,left=66,right=24,top=34,bottom=62,plotWidth=width-left-right,plotHeight=height-top-bottom
  const currentDay=Math.max(0,daysSince(snapshot,task.startedAt))
  const maxDay=Math.max(1,Math.ceil(currentDay),...points.map(point=>Math.ceil(daysSince(point.at,task.startedAt))))
  const maxQuantity=Math.max(1,task.effectiveQty,...points.map(point=>point.quantity))
  const x=(day:number)=>left+Math.max(0,Math.min(maxDay,day))/maxDay*plotWidth
  const y=(quantity:number)=>top+plotHeight-Math.max(0,quantity)/maxQuantity*plotHeight
  const titleId=`pf-evidence-title-${task.id}`,descId=`pf-evidence-desc-${task.id}`
  const grid=[0,.25,.5,.75,1].map(ratio=>`<line x1="${left}" y1="${y(maxQuantity*ratio)}" x2="${width-right}" y2="${y(maxQuantity*ratio)}" stroke="#e2e8f0"/><text x="${left-10}" y="${y(maxQuantity*ratio)+4}" text-anchor="end" fill="#64748b" font-size="11">${fmt(maxQuantity*ratio)}</text>`).join('')
  const interval=Math.max(1,Math.ceil(maxDay/8))
  const ticks=Array.from(new Set([0,...Array.from({length:Math.floor(maxDay/interval)},(_,index)=>(index+1)*interval),maxDay]))
  const axes=ticks.map(day=>`<text x="${x(day)}" y="${height-bottom+22}" fill="#64748b" text-anchor="middle" font-size="11">D${day}</text>`).join('')
  const paths=series.map(name=>{
    const records=points.filter(point=>point.series===name&&(point.kind==='计划'||Date.parse(point.at)<=Date.parse(snapshot))).sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))
    if(!records.length)return ''
    const actualEvents=records.filter(point=>point.kind==='实际事件'),planned=records.filter(point=>point.kind==='计划')
    // Only the main task has an explicit complete two-event sequence; other tasks show known points only.
    const connected=name==='计划实发'?planned:task.id==='MOCK-PT-001'?actualEvents:[]
    const path=connected.map((point,index)=>`${index?'H':'M'}${x(daysSince(point.at,task.startedAt)).toFixed(2)}${index?'V':','}${y(point.quantity).toFixed(2)}`).join(' ')
    const drawn=connected.length>1?`<path d="${path}" fill="none" stroke="${seriesColor[name]}" stroke-width="2.5" ${name==='计划实发'?'stroke-dasharray="7 5"':''}/>`:''
    return drawn+records.map(point=>`<circle cx="${x(daysSince(point.at,task.startedAt))}" cy="${y(point.quantity)}" r="${point.kind==='当前快照'?5:4}" stroke="${seriesColor[name]}" stroke-width="2" fill="${point.kind==='实际事件'?seriesColor[name]:'white'}"><title>${e(`${name} · ${point.kind} · ${dt(point.at)} · 累计${point.quantity}${task.unit} · ${point.note}`)}</title></circle>`).join('')
  }).join('')
  const todayX=x(currentDay)
  const future=currentDay<maxDay?`<rect x="${todayX}" y="${top}" width="${width-right-todayX}" height="${plotHeight}" fill="#f8fafc"/><text x="${Math.min(width-right-85,todayX+12)}" y="${top+18}" fill="#64748b" font-size="11">未来计划区</text>`:''
  const first=points.find(point=>point.series==='合格回货'&&point.kind==='实际事件'&&point.quantity>0)
  const firstLabel=first&&task.id==='MOCK-PT-001'?`<text x="${x(daysSince(first.at,task.startedAt))-8}" y="${y(first.quantity)-12}" text-anchor="end" font-size="11" fill="#1d4ed8">首批 D19 · 200件</text>`:''
  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="${titleId} ${descId}" style="display:block;width:100%;height:auto;min-width:600px"><title id="${titleId}">${e(task.id)} 计划与实际累计数量</title><desc id="${descId}">虚线是未来计划，实心点是已发生事件，空心点是当前快照。只有已知事件间展示累计阶梯，其他历史未补造。全部图形为 Mock。</desc>${future}${grid}<line x1="${left}" y1="${y(task.effectiveQty*.9)}" x2="${width-right}" y2="${y(task.effectiveQty*.9)}" stroke="#d97706" stroke-dasharray="3 4"/><text x="${left+5}" y="${y(task.effectiveQty*.9)-5}" fill="#b45309" font-size="11">90%门槛 ${fmt(task.effectiveQty*.9)}${e(task.unit)}</text><text x="${left+5}" y="${y(task.effectiveQty)-9}" fill="#475569" font-size="11">全部 ${fmt(task.effectiveQty)}${e(task.unit)}</text>${paths}${firstLabel}<line x1="${todayX}" y1="${top}" x2="${todayX}" y2="${height-bottom}" stroke="#0f172a" stroke-dasharray="4 4"/><text x="${Math.min(todayX,width-right-5)}" y="${top-12}" text-anchor="end" fill="#0f172a" font-size="11">当前 D${fmt(currentDay)}</text>${axes}<text x="${left}" y="${height-15}" fill="#64748b" font-size="11">T0 ${e(dt(task.startedAt))} · 自然日 · 单位：${e(task.unit)}</text></svg>`
}

export function skuBoundaryEvidence():string {
  const lines=[{sku:'演示SKU-A',effectiveQty:100,shippedQty:120},{sku:'演示SKU-B',effectiveQty:100,shippedQty:80}]
  const progress=shipmentProgress(lines)
  return `<div class="pf-evidence-sku"><h3 class="font-semibold">独立 SKU 边界算例（Mock，不计入当前任务统计）</h3><p class="mt-2 text-sm">A / B 各应发 100 件，实发分别为 120 / 80 件。A 超发 20 件不能抵 B 短发 20 件。</p><p class="mt-2 font-mono text-sm">有效归属 = min(120,100) + min(80,100) = ${fmt(progress.creditedQty)} / ${fmt(progress.effectiveQty)} = ${fmt(progress.progressPct)}%；剩余应发 ${fmt(progress.remainingQty)} 件。</p></div>`
}

export function renderQuantityEvidence(task:PFTask):string {
  const points=taskQuantityEvidence(task)
  const returns=points.filter(point=>point.series==='合格回货'&&point.kind!=='计划').sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))
  const knownFirst=task.nodes.find(node=>node.firstQualifiedReturnAt&&node.firstQualifiedReturnQty)
  const firstAt=knownFirst?.firstQualifiedReturnAt??null
  const ninety=returns.find(point=>point.quantity>=task.effectiveQty*.9),full=returns.find(point=>point.quantity>=task.effectiveQty)
  const actualLabel=(point:QuantityEvidence|undefined,threshold=false)=>point?((point.kind==='当前快照'||(threshold&&task.id!=='MOCK-PT-001'))?`截至 ${dt(point.at)} 已达到；首次跨越时刻未知`:dt(point.at)):'尚未达到 / 缺有效事件'
  return card('数量进度证据 · 计划与实际分开',`<style>.pf-evidence-legend{display:flex;flex-wrap:wrap;gap:16px;font-size:12px;margin-bottom:12px}.pf-evidence-table{width:100%;font-size:12px;text-align:left;border-collapse:collapse}.pf-evidence-table th,.pf-evidence-table td{padding:10px;border-bottom:1px solid #e2e8f0;vertical-align:top}.pf-evidence-milestones{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;padding:12px 0}.pf-evidence-milestones>div,.pf-evidence-sku{border:1px solid #e2e8f0;border-radius:8px;padding:12px}.pf-evidence-milestones strong{display:block;margin-bottom:4px}.pf-evidence-source{padding:12px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px}.pf-evidence-muted{color:#64748b;font-size:12px;line-height:1.6}</style>
    <div class="pf-evidence-legend">${series.map(name=>`<span><span style="color:${seriesColor[name]}">${name==='计划实发'?'┄┄':'●'}</span> ${e(name)}</span>`).join('')}<span>实心＝事件；空心＝快照；虚线＝计划</span></div>
    <div class="overflow-x-auto">${quantityChart(task,points)}</div>
    <div class="pf-evidence-milestones"><div><strong>合格回货首批</strong>${firstAt?`${dt(firstAt)} · ${fmt(knownFirst?.firstQualifiedReturnQty)} ${e(task.unit)}`:'首批有效事件未提供'}</div><div><strong>达到90%</strong>${actualLabel(ninety,true)}</div><div><strong>全部回货</strong>${actualLabel(full)}</div></div>
    <p class="pf-evidence-muted">${task.id==='MOCK-PT-001'?'主例只记录 D19 回货200件、D20再回货200件；当前累计400件。未达到900件或1000件，不按平均速度倒推里程碑已经发生。':'当前仅绘制已存在的完成时刻或来源更新快照；缺少中间批次历史，不连接成伪造的生产速度曲线。'} 计划取既有整批截止，未配置日配额。数据截至 ${dt(snapshot)}；全部为原型 Mock。</p>
    <div class="overflow-x-auto mt-3"><table class="pf-evidence-table"><thead><tr><th>事件 / 快照</th><th>类型</th><th>时间</th><th>本次 / 累计</th><th>来源与解释</th></tr></thead><tbody>${points.map(point=>`<tr><td>${e(point.id)}<br>${e(point.series)}</td><td>${badge(point.kind)}</td><td>${dt(point.at)}</td><td>${point.delta===null?'—':fmt(point.delta)} / ${fmt(point.quantity)} ${e(task.unit)}</td><td>${e(point.source)}<br><span class="pf-evidence-muted">${e(point.note)}</span></td></tr>`).join('')}</tbody></table></div>`)
}

interface SupplyEvidence {
  eventId:string; logicalEventId:string; kind:'库存到厂'|'采购下单'|'采购入库'|'采购调拨出库'|'采购到厂'|'采购在途';
  quantity:number; purchaseLine:string; logisticsBatch:string; receiptLine:string;
  occurredAt:string; recordedAt:string; correctedAt:string|null; supersedes:string|null; note:string;
}
/** These sample event versions reconcile to T6-03/04/05/06/07 in the shared task fixture. */
const supplyEvidence:readonly SupplyEvidence[]=[
  {eventId:'EVT-006-STOCK-RECEIVE',logicalEventId:'STOCK-RECEIVE',kind:'库存到厂',quantity:300,purchaseLine:'无需采购 / 库存分配 ALLOC-006-01',logisticsBatch:'MOCK-TR-STOCK-006',receiptLine:'MOCK-REC-STOCK-006-L01',occurredAt:'2026-09-13T10:00:00+08:00',recordedAt:'2026-09-13T10:02:00+08:00',correctedAt:null,supersedes:null,note:'原库存300PCS已完成调拨及目标工厂实收'},
  {eventId:'EVT-006-PURCHASE',logicalEventId:'PURCHASE',kind:'采购下单',quantity:700,purchaseLine:'MOCK-MAT-PUR-006 / L01',logisticsBatch:'分三批：B01 / B02 / B03',receiptLine:'尚不产生实收',occurredAt:'2026-09-12T10:00:00+08:00',recordedAt:'2026-09-12T10:01:00+08:00',correctedAt:null,supersedes:null,note:'目标需求1000，已分配库存300，差额采购700，不重复采购在途数量'},
  {eventId:'EVT-006-WH-B02',logicalEventId:'WH-B02',kind:'采购入库',quantity:200,purchaseLine:'MOCK-MAT-PUR-006 / L01',logisticsBatch:'MOCK-LOG-006-B02',receiptLine:'MOCK-WH-006-B02-L01',occurredAt:'2026-09-15T10:00:00+08:00',recordedAt:'2026-09-15T10:03:00+08:00',correctedAt:null,supersedes:null,note:'B02入库200PCS，随后调拨到厂'},
  {eventId:'EVT-006-WH-B01',logicalEventId:'WH-B01',kind:'采购入库',quantity:300,purchaseLine:'MOCK-MAT-PUR-006 / L01',logisticsBatch:'MOCK-LOG-006-B01',receiptLine:'MOCK-WH-006-B01-L01',occurredAt:'2026-09-16T08:00:00+08:00',recordedAt:'2026-09-16T08:05:00+08:00',correctedAt:null,supersedes:null,note:'B01入库300PCS，仍在仓内待调拨'},
  {eventId:'EVT-006-TRANSFER-B02',logicalEventId:'TRANSFER-B02',kind:'采购调拨出库',quantity:200,purchaseLine:'MOCK-MAT-PUR-006 / L01',logisticsBatch:'MOCK-LOG-006-B02 → MOCK-TR-006-B02',receiptLine:'MOCK-OUT-006-B02-L01',occurredAt:'2026-09-16T10:00:00+08:00',recordedAt:'2026-09-16T10:02:00+08:00',correctedAt:null,supersedes:null,note:'B02实际出库200PCS，不能把创建调拨单当作完成'},
  {eventId:'EVT-006-TRANSIT-B03',logicalEventId:'TRANSIT-B03',kind:'采购在途',quantity:200,purchaseLine:'MOCK-MAT-PUR-006 / L01',logisticsBatch:'MOCK-LOG-006-B03',receiptLine:'暂无入库 / 工厂实收',occurredAt:'2026-09-16T15:00:00+08:00',recordedAt:'2026-09-16T15:02:00+08:00',correctedAt:null,supersedes:null,note:'B03尾批200PCS仍在途，不当作仓内或厂内可用'},
  {eventId:'EVT-006-FACTORY-B02-R1',logicalEventId:'FACTORY-B02',kind:'采购到厂',quantity:220,purchaseLine:'MOCK-MAT-PUR-006 / L01',logisticsBatch:'MOCK-LOG-006-B02 → MOCK-TR-006-B02',receiptLine:'MOCK-REC-006-B02-L01',occurredAt:'2026-09-17T09:30:00+08:00',recordedAt:'2026-09-17T09:35:00+08:00',correctedAt:null,supersedes:null,note:'原录220PCS，经接收方核对更正；旧版保留但不累计'},
  {eventId:'EVT-006-FACTORY-B02-R2',logicalEventId:'FACTORY-B02',kind:'采购到厂',quantity:200,purchaseLine:'MOCK-MAT-PUR-006 / L01',logisticsBatch:'MOCK-LOG-006-B02 → MOCK-TR-006-B02',receiptLine:'MOCK-REC-006-B02-L01',occurredAt:'2026-09-17T09:30:00+08:00',recordedAt:'2026-09-17T09:50:00+08:00',correctedAt:'2026-09-17T09:50:00+08:00',supersedes:'EVT-006-FACTORY-B02-R1',note:'更正为200PCS；业务实收仍发生于09:30，不能把纠错时间作为实际完成时间'},
]

function effectiveSupplyEvents(events:readonly SupplyEvidence[]):SupplyEvidence[]{
  const unique=[...new Map(events.map(event=>[event.eventId,event])).values()]
  const superseded=new Set(unique.flatMap(event=>event.supersedes?[event.supersedes]:[]))
  return unique.filter(event=>!superseded.has(event.eventId))
}

function detailedSupplyEvidence():string {
  // Deliberately replay the same latest event once: event ID idempotence prevents 200 becoming 400.
  const effective=effectiveSupplyEvents([...supplyEvidence,supplyEvidence[supplyEvidence.length-1]])
  const sum=(kind:SupplyEvidence['kind'])=>effective.filter(event=>event.kind===kind).reduce((total,event)=>total+event.quantity,0)
  const stock=sum('库存到厂'),purchase=sum('采购下单'),warehouse=sum('采购入库'),factory=sum('采购到厂'),outbound=sum('采购调拨出库')
  const active=new Set(effective.map(event=>event.eventId))
  return `<div class="pf-evidence-source"><strong>MOCK-PT-006 · 分量和批次证据（独立演示明细）</strong><p class="mt-2">物料需求1,000PCS = 库存到厂 ${fmt(stock)} + 缺口采购 ${fmt(purchase)}。采购 ${fmt(purchase)} = B01 300 + B02 200 + B03 200。</p><p class="mt-2">采购累计入库 ${fmt(warehouse)} = 仓内待调拨 ${fmt(warehouse-outbound)} + 已调拨出库 ${fmt(outbound)}；采购到厂 ${fmt(factory)}。采购未入库 ${fmt(purchase-warehouse)}，厂内合格可用 = ${fmt(stock)} + ${fmt(factory)} = <strong>${fmt(stock+factory)}PCS</strong>，距齐料还差 ${fmt(1000-stock-factory)}PCS。</p><p class="mt-2 text-amber-700">B01在仓待调拨300；B02到厂200；B03在途200。入库500不能直接判定采购700已到厂或全任务已齐料。</p></div>
    <div class="overflow-x-auto mt-3"><table class="pf-evidence-table"><thead><tr><th>事件 / 当前有效性</th><th>采购明细 → 物流批次 → 实收明细</th><th>数量</th><th>业务发生 / 系统记录 / 纠错</th><th>解释</th></tr></thead><tbody>${supplyEvidence.map(event=>`<tr><td>${e(event.eventId)}<br>${badge(active.has(event.eventId)?'当前有效':'旧版已更正')}</td><td>${e(event.purchaseLine)}<br>→ ${e(event.logisticsBatch)}<br>→ ${e(event.receiptLine)}</td><td>${e(event.kind)}<br><strong>${fmt(event.quantity)} PCS</strong></td><td>发生 ${dt(event.occurredAt)}<br>记录 ${dt(event.recordedAt)}<br>纠错 ${event.correctedAt?dt(event.correctedAt):'—'}</td><td>${e(event.note)}${event.supersedes?`<br>更正关联：${e(event.supersedes)}`:''}</td></tr>`).join('')}</tbody></table></div>
    <p class="pf-evidence-muted mt-3">同一采购明细可以对应多条物流和实收记录。EVT-006-FACTORY-B02-R1 的220PCS已被R2的200PCS更正，不累计420PCS；重复读取R2仍只算一次200PCS。以上关系与事件均为补充Mock，匹配共享任务中的采购入库500PCS、采购到厂200PCS和库存到厂300PCS，不表示真实线上单据已接通。</p>`
}

export function renderSourceEvidence(task:PFTask,node:PFNode):string {
  const source=`<style>.pf-evidence-table{width:100%;font-size:12px;text-align:left;border-collapse:collapse}.pf-evidence-table th,.pf-evidence-table td{padding:10px;border-bottom:1px solid #e2e8f0;vertical-align:top}.pf-evidence-source{padding:12px;border:1px solid #e2e8f0;border-radius:8px;font-size:12px;line-height:1.8}.pf-evidence-muted{color:#64748b;font-size:12px;line-height:1.6}</style><div class="pf-evidence-source"><p><strong>${e(node.sourceDocumentType)} · ${e(node.sourceDocumentId)}</strong></p><p>来源任务 ${e(task.id)} / 需求 ${e(task.demandNo)} / 工作 ${e(node.id)}；匹配状态 ${e(node.mappingState)}</p><p>实际开始 ${dt(node.actualStartAt)}；实际完成 ${dt(node.actualEndAt)}；来源更新 ${dt(node.sourceUpdatedAt)}</p><p>有效要求 ${fmt(node.requiredQty)} ${e(node.unit)}；已确认合格 ${fmt(node.qualifiedQty)} ${e(node.unit)}</p></div>`
  if(task.id==='MOCK-PT-006')return card('来源、物流批次与实收证据',source+detailedSupplyEvidence())
  const main=node.id==='W29'&&task.id==='MOCK-PT-001'?`<div class="mt-3">${mainEvidence.filter(point=>point.series==='合格回货').map(point=>`<p class="text-sm">${e(point.id)} · 业务发生 ${dt(point.at)} · 本次 ${fmt(point.delta)} / 累计 ${fmt(point.quantity)} 件 · ${e(point.source)}</p>`).join('')}</div>`:''
  return card('来源与事件证据',source+main+`<p class="pf-evidence-muted mt-3">当前Mock只提供以上单据、开始/完成、数量及来源更新时间。采购明细、物流批次、实收事件ID、系统记录时间或纠错时间未提供时明确保留缺失，不把来源更新时间冒充业务发生时间，也不按SPU猜测关联。历史有更正时应保留旧事件与替代关系。</p>`)
}
