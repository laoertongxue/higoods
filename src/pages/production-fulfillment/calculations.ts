import { snapshot } from './fixtures'
import type { PFFilters, PFNode, PFTask, ShipmentOrderFact, TaskAssessment } from './model'

const DAY = 86_400_000
const timestamp = (value: string): number => {
  const result = Date.parse(value)
  if (!Number.isFinite(result)) throw new Error(`无效时间：${value}`)
  return result
}
export const dayDiff = (end: string, start: string): number => (timestamp(end) - timestamp(start)) / DAY
export const addDays = (start: string, days: number): string => {
  if (!Number.isFinite(days)) throw new Error('自然日必须为有限数值')
  return new Date(timestamp(start) + days * DAY).toISOString()
}
const later = (dates: string[]): string => new Date(Math.max(...dates.map(timestamp))).toISOString()
const positive = (value: number) => Math.max(0, value)
const round = (value: number) => Math.round(value * 100) / 100
/** Ending a document does not release failed QC, disputed receipts or cancelled supply. */
export const isWorkReleased = (node: PFNode) => !/取消|终止|作废|不合格|阻塞|阻断|受阻|暂停|异议/.test(node.businessState)
  && (node.businessState === '已完成' || Boolean(node.actualEndAt) || node.timeState === '复用成果')
const done = isWorkReleased

export const isWorkTerminal = (node:PFNode) => isWorkReleased(node)||/已取消|已终止|已作废/.test(node.businessState)
export interface WorkBlocker { node:PFNode; kind:'逾期'|'阻塞'|'风险'; reason:string; downstream:string[] }
export function dependencyAnalysis(task:PFTask) {
  const byId=new Map(task.nodes.map(n=>[n.id,n]))
  const children=new Map(task.nodes.map(n=>[n.id,task.nodes.filter(x=>x.predecessors.includes(n.id)).map(x=>x.id)]))
  const descendants=(id:string):string[]=>{const found=new Set<string>();const visit=(key:string)=>{for(const child of children.get(key)||[]){if(child===id||found.has(child))continue;found.add(child);visit(child)}};visit(id);return [...found]}
  const pendingParents=(n:PFNode)=>n.predecessors.map(id=>byId.get(id)).filter((p):p is PFNode=>!!p&&!isWorkReleased(p))
  const blockers:WorkBlocker[]=task.nodes.filter(n=>!isWorkTerminal(n)&&n.sourceDocumentId).flatMap(n=>{
    // Missing a start timestamp is not proof that work never happened: an
    // inspection result can already exist and still block downstream release.
    const waiting=!n.actualStartAt&&!n.actualEndAt&&pendingParents(n).length>0
    const overdue=n.actualOverdueDays>0
    const blocked=/阻塞|阻断|受阻|暂停|不合格|异议/.test(n.businessState)
    const risk=(n.predictedDelayDays??0)>0||/预计逾期|风险/.test(n.timeState)
    if(waiting||!overdue&&!blocked&&!risk)return []
    const kind=overdue?'逾期':blocked?'阻塞':'风险'
    const reason=overdue?`超过本项责任截止 ${n.actualOverdueDays.toLocaleString('zh-CN',{maximumFractionDigits:2})} 自然日`:blocked?n.blocker||n.dependencyNote||'来源工作处于阻塞状态':`预计超过本项截止 ${(n.predictedDelayDays??0).toLocaleString('zh-CN',{maximumFractionDigits:2})} 自然日`
    return [{node:n,kind,reason,downstream:descendants(n.id).filter(id=>!isWorkTerminal(byId.get(id)!))} as WorkBlocker]
  }).sort((a,b)=>Number(b.kind==='逾期')-Number(a.kind==='逾期')||b.downstream.length-a.downstream.length||b.node.actualOverdueDays-a.node.actualOverdueDays)
  const dataGaps=task.nodes.filter(n=>!isWorkTerminal(n)&&(!n.sourceDocumentId||n.origin==='decision'&&Boolean(n.blocker)))
  return {byId,children,descendants,pendingParents,blockers,dataGaps}
}
export interface NetworkNode {
  id: string; predecessors: string[]; durationDays: number | null
  releaseDay?: number; lags?: Record<string, number>
}
export interface NetworkResult {
  nodes: Record<string, { start: number | null; finish: number | null; formula: string }>
  order: string[]; durationDays: number | null; criticalPath: string[]; terminalIds: string[]
}
/** Longest path over only the selected timing layer: a proxy and its children are never added twice. */
export function calculateNetwork(nodes: NetworkNode[], terminalIds?: string[]): NetworkResult {
  const lookup = new Map(nodes.map(n => [n.id, n]))
  if (lookup.size !== nodes.length) throw new Error('同一任务中工作实例ID重复')
  const result: NetworkResult = { nodes: {}, order: [], durationDays: null, criticalPath: [], terminalIds: [] }
  const visiting = new Set<string>()
  const criticalPredecessor = new Map<string, string>()
  const visit = (id: string): void => {
    if (result.nodes[id]) return
    const n = lookup.get(id)
    if (!n) throw new Error(`缺少前置工作：${id}`)
    if (visiting.has(id)) throw new Error(`循环依赖：${id}`)
    if (n.durationDays !== null && (!Number.isFinite(n.durationDays) || n.durationDays < 0)) throw new Error(`无效预算：${id}`)
    visiting.add(id)
    n.predecessors.forEach(visit)
    const parents = n.predecessors.map(p => ({ id: p, finish: result.nodes[p].finish, lag: n.lags?.[p] ?? 0 }))
    const missing = parents.some(p => p.finish === null)
    const start = missing ? null : Math.max(n.releaseDay ?? 0, 0, ...parents.map(p => p.finish! + p.lag))
    const finish = start === null || n.durationDays === null ? null : start + n.durationDays
    const maxParent = parents.filter(p => p.finish !== null).sort((a, b) => (b.finish! + b.lag) - (a.finish! + a.lag))[0]
    if (maxParent && maxParent.finish! + maxParent.lag >= (n.releaseDay ?? 0)) criticalPredecessor.set(id, maxParent.id)
    result.nodes[id] = { start, finish, formula: `max(${n.releaseDay ?? 0}${parents.map(p => `, ${p.id}=${p.finish === null ? '未知' : p.finish}${p.lag ? `+${p.lag}` : ''}`).join('')}) + ${n.durationDays ?? '待配置'} = ${finish ?? '待判定'}` }
    result.order.push(id); visiting.delete(id)
  }
  nodes.forEach(n => visit(n.id))
  const used = new Set(nodes.flatMap(n => n.predecessors))
  result.terminalIds = terminalIds ?? nodes.filter(n => !used.has(n.id)).map(n => n.id)
  result.terminalIds.forEach(id => { if (!lookup.has(id)) throw new Error(`缺少终点：${id}`) })
  const ends = result.terminalIds.map(id => result.nodes[id].finish)
  result.durationDays = ends.length && ends.every(v => v !== null) ? Math.max(...ends as number[]) : null
  if (result.durationDays !== null) {
    let id: string | undefined = result.terminalIds.find(id => result.nodes[id].finish === result.durationDays)
    while (id) { result.criticalPath.unshift(id); id = criticalPredecessor.get(id) }
  }
  return result
}
export function backwardSchedule(nodes: NetworkNode[], deadlineDay: number): Record<string, { latestStart: number | null; latestFinish: number | null; floatDays: number | null }> {
  const network = calculateNetwork(nodes)
  const lookup = new Map(nodes.map(n => [n.id, n]))
  const results: ReturnType<typeof backwardSchedule> = {}
  for (const id of [...network.order].reverse()) {
    const n = lookup.get(id)!
    const children = nodes.filter(child => child.predecessors.includes(id))
    const finishes = children.map(child => results[child.id].latestStart === null ? null : results[child.id].latestStart! - (child.lags?.[id] ?? 0))
    const latestFinish = finishes.some(f => f === null) ? null : children.length ? Math.min(...finishes as number[]) : deadlineDay
    const latestStart = latestFinish === null || n.durationDays === null ? null : latestFinish - n.durationDays
    results[id] = { latestStart, latestFinish, floatDays: latestStart === null || network.nodes[id].start === null ? null : latestStart - network.nodes[id].start! }
  }
  return results
}
export interface ForecastResult { finishAt: string | null; nodes: Record<string, { startAt: string | null; endAt: string | null; method: string }>; missing: string[] }
export function predictNetwork(task: PFTask, now = task.asOf ?? snapshot): ForecastResult {
  const graph = calculateNetwork(task.nodes)
  const byId = new Map(task.nodes.map(n => [n.id, n]))
  const result: ForecastResult = { finishAt: null, nodes: {}, missing: [] }
  for (const id of graph.order) {
    const n = byId.get(id)!
    if (n.actualEndAt && done(n)) { result.nodes[id] = { startAt: n.actualStartAt, endAt: n.actualEndAt, method: '有效完成事实' }; continue }
    if (n.businessState === '已取消') { result.nodes[id] = { startAt: null, endAt: null, method: '正式取消' }; continue }
    const parents = n.predecessors.map(id => result.nodes[id])
    const partialRelease = n.releaseMode === '分批' && n.actualStartAt
    const stale = dayDiff(now, n.sourceUpdatedAt) >= 5
    const manual = n.forecastSource === 'manual'
    if (manual && n.predictedEndAt) {
      result.nodes[id] = {startAt:n.actualStartAt??n.predictedStartAt??now,endAt:n.predictedEndAt,method:'负责人手工预计；未改变正式时效、实际完成或产能事实'}
      continue
    }
    if ((!manual && stale) || n.durationDays === null || !n.predictedEndAt || (!partialRelease && parents.some(p => !p.endAt))) {
      result.nodes[id] = { startAt: null, endAt: null, method: stale ? '进度数据过期' : '规则或前置预测不足' }; result.missing.push(id); continue
    }
    const readyAt = partialRelease ? n.actualStartAt! : later([task.startedAt, ...parents.flatMap(p => p.endAt ? [p.endAt] : [])])
    const currentlyWorking = Boolean(n.actualStartAt)
    const startAt = currentlyWorking ? n.actualStartAt! : later([now, readyAt])
    let endAt: string, method: string
    if (!manual && n.allocatedCapacityPerDay !== undefined) {
      if (!(n.allocatedCapacityPerDay > 0)) { result.nodes[id] = { startAt, endAt: null, method: '无可靠分配能力' }; result.missing.push(id); continue }
      endAt = addDays(later([now, readyAt]), positive(n.requiredQty - n.qualifiedQty) / n.allocatedCapacityPerDay)
      method = `${positive(n.requiredQty - n.qualifiedQty)}${n.unit} ÷ ${n.allocatedCapacityPerDay}${n.unit}/自然日`
    } else {
      const referenceStart = n.predictedStartAt ?? n.standardStartAt ?? readyAt
      const delay = currentlyWorking ? positive(dayDiff(readyAt, referenceStart)) : dayDiff(startAt, referenceStart)
      endAt = addDays(n.predictedEndAt, delay)
      method = manual ? '负责人手工预计；尚未落实产能承诺，当前产能事实未改变' : n.forecastNote ?? '责任方排程预计；依赖变化逐项传播'
    }
    result.nodes[id] = { startAt, endAt, method }
  }
  const terminals = graph.terminalIds.map(id => result.nodes[id].endAt)
  result.finishAt = terminals.length && terminals.every(Boolean) ? later(terminals as string[]) : null
  return result
}
/** Responsibility lateness and whole-task protection are separate; do not leave stale labels after a scenario change. */
export function assessNodeTiming(node: PFNode, now = snapshot): Pick<PFNode, 'actualOverdueDays' | 'predictedDelayDays' | 'timeState'> {
  if (node.businessState === '已取消') return { actualOverdueDays: 0, predictedDelayDays: null, timeState: '已取消' }
  const actualOverdueDays = node.localDueAt ? positive(dayDiff(node.actualEndAt ?? now, node.localDueAt)) : 0
  const deadlines = [node.localDueAt, node.neededFinishAt].filter(Boolean) as string[]
  const requiredAt = deadlines.length ? new Date(Math.min(...deadlines.map(timestamp))).toISOString() : node.baselineDueAt
  const predictedDelayDays = node.predictedEndAt && requiredAt ? positive(dayDiff(node.predictedEndAt, requiredAt)) : null
  const remainingDays = requiredAt ? dayDiff(requiredAt, now) : null
  const timeState = node.actualEndAt ? (!node.localDueAt ? '已完成·时效待判' : actualOverdueDays > 0 ? '完成但曾逾期' : '按期完成')
    : actualOverdueDays > 0 ? '已逾期'
    : !node.predictedEndAt || !requiredAt ? '待判定'
    : (predictedDelayDays ?? 0) > 0 ? '预计逾期'
    : (node.recoverDays ?? 0) > 0 ? '需追回'
    : remainingDays !== null && remainingDays <= 2 ? '临期' : '正常'
  return { actualOverdueDays, predictedDelayDays, timeState }
}
/** A local scenario only: original facts, standard network and effective deadlines remain untouched. */
export function projectManualForecast(task: PFTask, nodeId: string, endAt: string): PFTask {
  timestamp(endAt)
  const now=task.asOf??snapshot
  const changed = task.nodes.find(n => n.id === nodeId)
  if (!changed || changed.actualEndAt || changed.businessState === '已取消') throw new Error('仅可登记未完成工作的预计时间')
  if (timestamp(endAt) < timestamp(now)) throw new Error('预计时间不能早于当前数据时点')
  const result: PFTask = { ...task, nodes: task.nodes.map(n => ({ ...n, predecessors: [...n.predecessors] })) }
  const target = result.nodes.find(n => n.id === nodeId)!
  target.predictedEndAt = endAt
  target.forecastSource = 'manual'
  target.forecastUpdatedAt = now
  target.forecastNote = '负责人手工预计；尚未落实产能承诺，当前产能事实与正式时效标准均未改变。'
  // The manually supplied finish already includes current queue and readiness; retain actual start separately.
  target.predictedStartAt = target.actualStartAt ?? now
  const forecast = predictNetwork(result)
  result.predictedFinishAt = forecast.finishAt
  const affected = new Set([nodeId])
  for (const id of calculateNetwork(result.nodes).order) {
    const n = result.nodes.find(item => item.id === id)!
    if (n.predecessors.some(predecessor => affected.has(predecessor))) affected.add(id)
  }
  for (const n of result.nodes) {
    if (n.actualEndAt || n.businessState === '已取消') continue
    const p = forecast.nodes[n.id]
    n.predictedStartAt = p.startAt; n.predictedEndAt = p.endAt
    if (n.id !== nodeId && affected.has(n.id)) {
      n.forecastSource = 'schedule'
      n.forecastUpdatedAt = now
      n.forecastNote = `根据 ${nodeId} 的负责人手工预计传播；上游预计尚未落实，不代表实际完成或产能承诺。`
    }
    Object.assign(n, assessNodeTiming(n,now))
  }
  result.health = assessTask(result).health
  return result
}
/** Replay in order; identical adjacent entries have the same effect. Keep the stored history intact. */
export function restoreManualForecasts(tasks:PFTask[],records:unknown):PFTask[] {
  if(!Array.isArray(records))return tasks
  const restored=[...tasks]
  let previous:{taskId:string;nodeId:string;endAt:string}|undefined
  for(const record of records){
    if(!record||typeof record.taskId!=='string'||typeof record.nodeId!=='string'||typeof record.endAt!=='string'){previous=undefined;continue}
    if(previous&&previous.taskId===record.taskId&&previous.nodeId===record.nodeId&&previous.endAt===record.endAt)continue
    previous=record
    const index=restored.findIndex(task=>task.id===record.taskId)
    if(index<0)continue
    try{restored[index]=projectManualForecast(restored[index],record.nodeId,record.endAt)}catch{/* An obsolete record must not block later valid forecasts. */}
  }
  return restored
}
export function assessTask(task: PFTask, now = task.asOf ?? snapshot): TaskAssessment {
  const terminated = task.businessState === '已终止'
  const completed = Boolean(task.completedAt)
  const active = !terminated && !completed
  const end = task.terminatedAt ?? task.completedAt ?? now
  const actualOverdueDays = task.effectiveDueAt && !terminated ? positive(dayDiff(end, task.effectiveDueAt)) : 0
  const predictedDelayDays = task.predictedFinishAt && task.effectiveDueAt ? positive(dayDiff(task.predictedFinishAt, task.effectiveDueAt)) : null
  const remainingDays = task.effectiveDueAt ? dayDiff(task.effectiveDueAt, end) : null
  const current = task.nodes.filter(n => !done(n) && n.businessState !== '已取消' && n.actualStartAt)
  const health = terminated ? '不参与当前达成统计' : completed ? (actualOverdueDays > 0 ? '完成但曾逾期' : '按期完成') : actualOverdueDays > 0 ? '已逾期' : (predictedDelayDays ?? 0) > 0 ? '预计逾期' : predictedDelayDays === null ? '待判定' : remainingDays !== null && remainingDays <= 2 ? '临期' : '正常'
  return { health, elapsedDays: positive(dayDiff(end, task.startedAt)), actualOverdueDays, predictedDelayDays, remainingDays, progressPct: task.quantityKnown !== false && task.effectiveQty > 0 ? round(Math.min(task.effectiveQty, task.shippedQty) / task.effectiveQty * 100) : null, active, blocker: task.blocker ?? task.uncertainty ?? current.find(n => n.blocker)?.blocker ?? current[0]?.name ?? (active ? '等待后续工作' : '无进行中卡点'), responsibleTeam: task.responsibleTeam ?? current.find(n => n.blocker)?.team ?? current[0]?.team ?? task.accountableTeam, activeStages: [...new Set(current.map(n => n.stage))] }
}
export function filterTasks(list: PFTask[], filters: PFFilters): PFTask[] {
  const q = filters.query.trim().toLocaleLowerCase()
  const match = (filter: string, value: string) => !filter || filter === '全部' || value === filter
  // UI labels are the public filter contract; keep exact risk scope aligned with the risk KPI.
  const health = filters.health === '有风险' ? '预计逾期' : filters.health
  const dateFields: Record<string, 'startedAt' | 'effectiveDueAt' | 'predictedFinishAt' | 'completedAt'> = {
    '生效到期': 'effectiveDueAt', '起点': 'startedAt', '预计完成': 'predictedFinishAt',
    effectiveDueAt: 'effectiveDueAt', startedAt: 'startedAt', predictedFinishAt: 'predictedFinishAt', completedAt: 'completedAt',
  }
  return list.filter(t => {
    const a = assessTask(t)
    if (q && ![t.id,t.purchaseNo,t.demandNo,t.styleRef,t.styleName,t.preparationNo,...t.productionOrderNos].join(' ').toLocaleLowerCase().includes(q)) return false
    if (!match(health,a.health) || !match(filters.follower,t.follower) || !match(filters.region,t.region) || !match(filters.supplyMode,t.supplyMode)) return false
    if ((filters.team && filters.team!=='全部' || filters.factory && filters.factory!=='全部') && !t.nodes.some(n => match(filters.team,n.team) && match(filters.factory||'全部',n.factory||'未指定'))) return false
    if (filters.stage && filters.stage !== '全部' && !t.nodes.some(n => n.stage === filters.stage)) return false
    if (['active','在途任务','在途'].includes(filters.scope) && !a.active) return false
    if (['completed','已完成'].includes(filters.scope) && !t.completedAt) return false
    if (['terminated','已终止'].includes(filters.scope) && t.businessState !== '已终止') return false
    if (filters.issuesOnly && !['已逾期','预计逾期','待判定','临期'].includes(a.health)) return false
    const field = dateFields[filters.dateField] ?? 'startedAt'
    const date = t[field]
    const offset='+08:00'
    if ((filters.dateFrom || filters.dateTo) && !date) return false
    const ts = date ? timestamp(date) : 0
    if (filters.dateFrom && ts < timestamp(`${filters.dateFrom}T00:00:00${offset}`)) return false
    if (filters.dateTo && ts >= timestamp(addDays(`${filters.dateTo}T00:00:00${offset}`,1))) return false
    return true
  })
}
/** Global shared work uses one instance and its strictest applicable deadline. */
export function getNodes(list: PFTask[]): PFNode[] {
  const result = new Map<string,PFNode>()
  for (const t of list) for (const n of t.nodes) {
    const old = result.get(n.id)
    if (!old || (n.baselineDueAt && (!old.baselineDueAt || timestamp(n.baselineDueAt) < timestamp(old.baselineDueAt)))) result.set(n.id,n)
  }
  return [...result.values()]
}
export function taskStats(list: PFTask[]) {
  const active = list.filter(t => assessTask(t).active)
  const activeHealth: Record<string,number> = {}
  active.forEach(t => { const h=assessTask(t).health; activeHealth[h]=(activeHealth[h]??0)+1 })
  const sum=(field:'effectiveQty'|'shippedQty'|'remainingQty')=>active.reduce((v,t)=>v+t[field],0)
  return { totalTasks:list.length,activeTasks:active.length,activeHealth,completedTasks:list.filter(t=>Boolean(t.completedAt)).length,terminatedTasks:list.filter(t=>t.businessState==='已终止').length,activeEffectiveQty:sum('effectiveQty'),activeShippedQty:sum('shippedQty'),activeRemainingQty:sum('remainingQty'),overdueTasks:activeHealth['已逾期']??0,riskTasks:activeHealth['预计逾期']??0,unknownTasks:activeHealth['待判定']??0,normalTasks:activeHealth['正常']??0,remainingQty:sum('remainingQty'),shippedQty:sum('shippedQty'),effectiveQty:sum('effectiveQty') }
}
export function orderStats(facts: ShipmentOrderFact[]) {
  const unique = [...new Map(facts.map(o=>[`${o.shipmentId}|${o.orderLineId}|${o.taskId}`,o])).values()]
  const orderGroups = new Map<string,ShipmentOrderFact[]>()
  unique.forEach(o=>orderGroups.set(o.orderNo,[...(orderGroups.get(o.orderNo)??[]),o]))
  const complete = [...orderGroups.values()].filter(group=>group.every(o=>o.orderScopeConfirmed&&o.orderCompletionType==='全部实发') && group[0].allOrderLineIds.every(id=>group.some(o=>o.orderLineId===id)) && group.reduce((v,o)=>v+o.shippedQty,0)>=group[0].orderEffectiveQty)
  const overdue = complete.filter(group=>dayDiff(group[0].orderCompletedAt,group[0].placedAt)>group[0].requiredDays)
  const qty=unique.reduce((v,o)=>v+o.shippedQty,0),lateQty=unique.reduce((v,o)=>v+(dayDiff(o.shippedAt,o.placedAt)>o.requiredDays?o.shippedQty:0),0)
  return { knownShippedOrders:orderGroups.size,comparableCompletedOrders:complete.length,overdueShippedOrders:overdue.length,knownShippedQty:qty,overdueShippedQty:lateQty,onTimeRate:complete.length?round((complete.length-overdue.length)/complete.length*100):null,overdueQuantityRate:qty?round(lateQty/qty*100):null }
}
export interface SupplyAllocation { id:string; qty:number; unit:string; targetSku:string; qualified:boolean; factoryReceivedQty:number }
export function supplyPosition(required:number,unit:string,targetSku:string,stock:SupplyAllocation[],other:SupplyAllocation[]) {
  const allocations=[...new Map([...stock,...other].map(x=>[x.id,x])).values()]
  if (allocations.some(x=>x.unit!==unit)) throw new Error('单位不同，必须先完成已批准的换算')
  const usable=allocations.filter(x=>x.qualified&&x.targetSku===targetSku)
  const secured=usable.reduce((s,x)=>s+x.qty,0),atFactory=usable.reduce((s,x)=>s+x.factoryReceivedQty,0)
  return { securedQty:secured,factoryAvailableQty:atFactory,newPurchaseGap:positive(required-secured),factoryShortage:positive(required-atFactory) }
}
export function scheduleBatches(batches:{id:string;qty:number;readyDay:number}[],sewingCapacity:number,postCapacity:number,transportDays=.25,shippingDays=.25) {
  if (!(sewingCapacity>0&&postCapacity>0)) throw new Error('预测需要可靠的已分配能力')
  let sewingFree=0,postFree=0
  return batches.map(b=>{ const start=Math.max(b.readyDay,sewingFree),sewingEnd=start+b.qty/sewingCapacity;sewingFree=sewingEnd;const postStart=Math.max(sewingEnd+transportDays,postFree),postEnd=postStart+b.qty/postCapacity;postFree=postEnd;return {...b,sewingStart:start,sewingEnd,postStart,postEnd,shippedDay:postEnd+shippingDays} })
}
export function quantityMilestone(events:{at:string;qty:number}[],required:number,ratio:number):string|null {
  let qty=0
  for(const e of [...events].sort((a,b)=>timestamp(a.at)-timestamp(b.at))) {qty+=e.qty;if(qty>=required*ratio)return e.at}
  return null
}
export interface QuantityEvent { id:string; occurredAt:string; recordedAt:string; qty:number; correctsId?:string; voided?:boolean }
export function dedupeEvents(events:QuantityEvent[]):QuantityEvent[] {
  const latest=new Map<string,QuantityEvent>()
  events.forEach(e=>{const prior=latest.get(e.id);if(!prior||timestamp(e.recordedAt)>timestamp(prior.recordedAt))latest.set(e.id,e)})
  const replaced=new Set([...latest.values()].flatMap(e=>e.correctsId?[e.correctsId]:[]))
  return [...latest.values()].filter(e=>!e.voided&&!replaced.has(e.id)).sort((a,b)=>timestamp(a.occurredAt)-timestamp(b.occurredAt))
}
export function evaluateDemandClosure(input:{originalQty:number;shippedQty:number;lastShipmentAt:string|null;reductionQty:number;reductionAt:string|null;reductionAppliesToTask:boolean}) {
  if ([input.originalQty,input.shippedQty,input.reductionQty].some(q=>!Number.isFinite(q)||q<0)) throw new Error('数量必须为非负有限值')
  if(input.reductionAppliesToTask&&input.reductionQty>input.originalQty)throw new Error('正式减量不能超过原需求')
  const reduction=input.reductionAppliesToTask?input.reductionQty:0,effectiveQty=positive(input.originalQty-reduction),remainingQty=positive(effectiveQty-input.shippedQty)
  const terminated=effectiveQty===0&&input.shippedQty===0
  const closed=remainingQty===0
  const dates=[input.lastShipmentAt,input.reductionAppliesToTask?input.reductionAt:null].filter(Boolean) as string[]
  const at=closed&&dates.length?later(dates):null
  return {effectiveQty,remainingQty,progressPct:effectiveQty?round(Math.min(input.shippedQty,effectiveQty)/effectiveQty*100):null,closedAt:at,type:terminated?'已终止':closed&&reduction>0?'范围减少后关闭':closed?'全部实发':'未完成'}
}
export function shipmentProgress(lines:{sku:string;effectiveQty:number;shippedQty:number}[]) {
  const effectiveQty=lines.reduce((s,l)=>s+l.effectiveQty,0)
  const creditedQty=lines.reduce((s,l)=>s+Math.min(l.effectiveQty,l.shippedQty),0)
  return {effectiveQty,creditedQty,remainingQty:lines.reduce((s,l)=>s+positive(l.effectiveQty-l.shippedQty),0),progressPct:effectiveQty?round(creditedQty/effectiveQty*100):null}
}
export interface TimingRule { id:string;version:string;published:boolean;validFrom:string;validTo?:string;conditions:Record<string,string>;durationDays:number }
export function resolveRule(rules:TimingRule[],facts:Record<string,string|undefined>,at:string) {
  const candidates=rules.filter(r=>r.published&&timestamp(at)>=timestamp(r.validFrom)&&(!r.validTo||timestamp(at)<timestamp(r.validTo))&&Object.entries(r.conditions).every(([k,v])=>facts[k]===undefined||facts[k]===v))
  if(candidates.some(r=>Object.keys(r.conditions).some(k=>facts[k]===undefined)))return {state:'待判断',rule:null,candidates}
  const matches=candidates.filter(r=>Object.entries(r.conditions).every(([k,v])=>facts[k]===v))
  return {state:matches.length===1?'已匹配':matches.length>1?'规则冲突':'缺规则',rule:matches.length===1?matches[0]:null,candidates:matches}
}
export function groupSpanCheck(children:NetworkNode[],limitDays:number) { const span=calculateNetwork(children).durationDays;return {spanDays:span,limitDays,state:span===null?'无法判定':span>limitDays?'规则冲突':'满足上限'} }
