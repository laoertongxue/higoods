import type { PFTask } from './model'

export type DataIssueKind = 'preparation-source' | 'technical-source' | 'timing-scope' | 'shipment-quantity' | 'work-sla' | 'required-quantity' | 'qualified-quantity' | 'style-image' | 'source-review'
export type DataIssueView = '待处理' | '已恢复' | '全部'
export interface DataIssueFilters { state:DataIssueView;owner:string;deadline:'全部'|'未登记'|'已逾期'|'2日内到期'|'2日后到期' }
export interface DataIssueEvent { at:string; action:'首次发现'|'登记责任与期限'|'来源确认恢复'|'缺口重现'|'来源变化'; by:string; detail:string }
export interface DataIssue {
  id:string; sourceKey:string; taskId:string; nodeId?:string; kind:DataIssueKind; title:string; detail:string;
  sourceIdentity:string; autoResolve:boolean; owner:string; team:string; dueAt:string|null;
  status:'待处理'|'已恢复'; firstDetectedAt:string; resolvedAt:string|null; reopenCount:number;
  history:DataIssueEvent[];
}
export interface DataIssueLedger { version:1; issues:DataIssue[]; writable:boolean; warning:string; checkedAt:string|null }
export const dataIssueStorageKey='dds-pf-data-issues-v1'
type StoragePort=Pick<Storage,'getItem'|'setItem'>
interface Observation { taskId:string;nodeId?:string;kind:DataIssueKind;title:string;detail:string;sourceIdentity:string;missing:boolean;autoResolve:boolean;owner:string;team:string }
const kinds:DataIssueKind[]=['preparation-source','technical-source','timing-scope','shipment-quantity','work-sla','required-quantity','qualified-quantity','style-image','source-review']
const validTime=(value:unknown):value is string=>typeof value==='string'&&Number.isFinite(Date.parse(value))
export function dataIssueKey(taskId:string,nodeId:string|undefined,kind:DataIssueKind):string {return [taskId,nodeId??'task',kind].map(encodeURIComponent).join('/')}
export function emptyDataIssueLedger():DataIssueLedger {return {version:1,issues:[],writable:true,warning:'',checkedAt:null}}
export function filterDataIssues(ledger:DataIssueLedger,taskIds:Set<string>,filters:DataIssueFilters):DataIssue[] {
  const now=Date.parse(ledger.checkedAt??'')
  return ledger.issues.filter(issue=>{
    if(!taskIds.has(issue.taskId)||filters.state!=='全部'&&issue.status!==filters.state||filters.owner!=='全部'&&issue.owner!==filters.owner)return false
    if(filters.deadline==='全部')return true
    if(filters.deadline==='未登记')return !issue.dueAt
    if(!issue.dueAt||!Number.isFinite(now))return false
    const remaining=Date.parse(issue.dueAt)-now
    return filters.deadline==='已逾期'?issue.status==='待处理'&&remaining<0:filters.deadline==='2日内到期'?remaining>=0&&remaining<=2*86400000:remaining>2*86400000
  })
}

function observations(task:PFTask):Observation[] {
  if(!task.sourceContext)return []
  const rows:Observation[]=[],ctx=task.sourceContext
  const add=(kind:DataIssueKind,title:string,missing:boolean,detail:string,nodeId?:string,sourceIdentity=task.id,owner=task.follower,team=task.accountableTeam,autoResolve=true)=>rows.push({taskId:task.id,nodeId,kind,title,detail,sourceIdentity,missing,owner,team,autoResolve})
  add('style-image','款式对应实图待补',!task.imageUrl,task.imageUrl?`来源已提供 ${task.styleRef} 的专属图片资料，请按款色核对`:`${task.styleRef} 尚无对应款式图片；通用品类示例图不能证明本款外观。`,undefined,task.styleRef,task.follower,task.accountableTeam,false)
  add('preparation-source','生产准备来源待关联',!ctx.preparationId,ctx.preparationId?`已读取准备来源 ${ctx.preparationId}`:'本需求未关联生产准备来源，须在任务详情关联已有同款单据。')
  add('technical-source','正式技术包来源待关联',!ctx.technicalVersionId,ctx.technicalVersionId?`已读取技术版本 ${ctx.technicalVersionId}`:'本需求未关联正式技术包来源。')
  add('timing-scope','完整工作范围待确认',ctx.timingScope?.state!=='confirmed'||Boolean(ctx.timingScope.blockingReasons.length),ctx.timingScope?.state==='confirmed'&&!ctx.timingScope.blockingReasons.length?'来源已确认完整工作范围':ctx.timingScope?.blockingReasons.join('；')||'尚无结构化范围确认记录。')
  add('shipment-quantity','任务归属实发数量待同步',task.shipmentQuantityKnown===false,task.shipmentQuantityKnown===false?'归属实发数量尚不可判定；没有实发记录不等于实发为零。':'来源已明确归属实发数量口径。',undefined,task.id,task.follower,task.accountableTeam,task.shipmentQuantityKnown!==undefined)
  add('source-review','其他来源缺口待审核',ctx.gaps.length>0,ctx.gaps.join('；')||'来源说明已变化，尚无结构化恢复证据；需补充来源校验，不能仅凭文字消失关闭。',undefined,task.id,task.follower,task.accountableTeam,false)
  for(const node of task.nodes){
    if(node.includedInProductionDuration===false||['已取消','已终止','已作废'].includes(node.businessState))continue
    const identity=[node.sourceDocumentType,node.sourceDocumentId,node.sourceEntryId??''].join('|')
    const push=(kind:DataIssueKind,title:string,missing:boolean,detail:string,autoResolve=true)=>add(kind,title,missing,detail,node.id,identity,node.owner,node.team,autoResolve)
    push('work-sla','工作项时效要求待配置',node.durationDays===null,`${node.name}：${node.durationDays===null?'自然日预算未配置':`已读取 ${node.durationDays} 自然日预算`}；${node.durationSource}`)
    push('required-quantity','工作项要求数量待同步',node.requiredQuantityKnown===false,`${node.name}：${node.requiredQuantityKnown===false?'要求数量未知':`来源要求数量 ${node.requiredQty} ${node.unit}`}。`,node.requiredQuantityKnown!==undefined)
    push('qualified-quantity','工作项合格数量待同步',node.quantityKnown===false,`${node.name}：${node.quantityKnown===false?'实收、生产总量不能替代已合格数量':`已读取合格数量 ${node.qualifiedQty} ${node.unit}`}。`,node.quantityKnown!==undefined)
  }
  return rows
}

/** Call only after a complete source read. Rendering and manual follow-up never resolve issues. */
export function reconcileDataIssues(ledger:DataIssueLedger,tasks:PFTask[],observedAt:string):DataIssueLedger {
  if(!validTime(observedAt))throw new Error('来源读取时间无效，未核对事项。')
  const current=new Map(tasks.flatMap(observations).map(row=>[dataIssueKey(row.taskId,row.nodeId,row.kind),row]))
  let changed=false
  const issues=ledger.issues.map(issue=>{
    const row=current.get(issue.sourceKey);current.delete(issue.sourceKey)
    if(!row)return issue // Missing task/node is not evidence of repair.
    const sourceChanged=row.sourceIdentity!==issue.sourceIdentity
    const eligibilityChanged=row.autoResolve!==issue.autoResolve
    const resolved=issue.status==='待处理'&&row.autoResolve&&!row.missing&&!sourceChanged
    const reopened=issue.status==='已恢复'&&(row.missing||sourceChanged||!row.autoResolve)
    const detail=row.autoResolve||row.missing?row.detail:issue.kind==='source-review'?'来源说明已变化，尚无结构化恢复证据；需补充来源校验，不能仅凭文字消失关闭。':issue.kind==='style-image'?`${row.detail}；款色对应关系仍待核对，不能仅有图片地址就关闭事项。`:'当前来源未明确提供数量已知性，尚无恢复依据；不能将字段缺失视为已补齐。'
    if(!resolved&&!reopened&&!sourceChanged&&!eligibilityChanged&&detail===issue.detail)return issue
    changed=true
    const history=[...issue.history]
    if(sourceChanged)history.push({at:observedAt,action:'来源变化',by:'来源刷新',detail:`工作来源从 ${issue.sourceIdentity} 变为 ${row.sourceIdentity}，本次不确认恢复。`})
    if(resolved)history.push({at:observedAt,action:'来源确认恢复',by:'来源刷新',detail:row.detail})
    if(reopened)history.push({at:observedAt,action:'缺口重现',by:'来源刷新',detail})
    return {...issue,sourceIdentity:row.sourceIdentity,autoResolve:row.autoResolve,detail,status:resolved?'已恢复' as const:reopened?'待处理' as const:issue.status,resolvedAt:resolved?observedAt:reopened?null:issue.resolvedAt,reopenCount:issue.reopenCount+(reopened?1:0),history}
  })
  for(const [sourceKey,row] of current){
    if(!row.missing)continue
    changed=true
    issues.push({id:`DI/${sourceKey}`,sourceKey,taskId:row.taskId,nodeId:row.nodeId,kind:row.kind,title:row.title,detail:row.detail,sourceIdentity:row.sourceIdentity,autoResolve:row.autoResolve,owner:row.owner,team:row.team,dueAt:null,status:'待处理',firstDetectedAt:observedAt,resolvedAt:null,reopenCount:0,history:[{at:observedAt,action:'首次发现',by:'来源刷新',detail:row.detail}]})
  }
  return {...ledger,issues:changed?issues:ledger.issues,checkedAt:observedAt}
}

export function registerDataIssue(ledger:DataIssueLedger,id:string,patch:{owner:string;team:string;dueAt:string;note:string},by:string,at:string):DataIssueLedger {
  if(!ledger.writable)throw new Error(ledger.warning||'本地事项存储不可写，未保存。')
  const issue=ledger.issues.find(row=>row.id===id)
  if(!issue)throw new Error('事项已不存在，请刷新来源后重试。')
  if(issue.status==='已恢复')throw new Error('来源已确认恢复，保留历史记录，无需改写修复安排。')
  const owner=patch.owner.trim(),team=patch.team.trim(),note=patch.note.trim()
  if(!owner||!team||/待指派|待明确|待确认/.test(owner+team))throw new Error('请填写明确的责任人和责任团队。')
  if(!validTime(patch.dueAt)||!validTime(at))throw new Error('请填写有效的修复期限。')
  if(!note)throw new Error('请填写修复安排或本次调整原因。')
  const updated={...issue,owner,team,dueAt:patch.dueAt,history:[...issue.history,{at,action:'登记责任与期限' as const,by,detail:`责任人 ${owner}；团队 ${team}；修复期限 ${patch.dueAt}；${note}。仅登记安排，尚未确认来源恢复。`}]}
  return {...ledger,issues:ledger.issues.map(row=>row.id===id?updated:row)}
}

function validIssue(value:unknown):value is DataIssue {
  if(!value||typeof value!=='object')return false
  const row=value as DataIssue
  return typeof row.taskId==='string'&&Boolean(row.taskId)&&(!row.nodeId||typeof row.nodeId==='string')&&kinds.includes(row.kind)&&row.sourceKey===dataIssueKey(row.taskId,row.nodeId,row.kind)&&row.id===`DI/${row.sourceKey}`
    &&[row.title,row.detail,row.sourceIdentity,row.owner,row.team].every(value=>typeof value==='string')&&typeof row.autoResolve==='boolean'&&['待处理','已恢复'].includes(row.status)
    &&validTime(row.firstDetectedAt)&&(row.dueAt===null||validTime(row.dueAt))&&(row.resolvedAt===null||validTime(row.resolvedAt))&&Number.isInteger(row.reopenCount)&&row.reopenCount>=0
    &&Array.isArray(row.history)&&row.history.length>0&&row.history.every(event=>validTime(event.at)&&['首次发现','登记责任与期限','来源确认恢复','缺口重现','来源变化'].includes(event.action)&&typeof event.by==='string'&&typeof event.detail==='string')
}
export function readDataIssueLedger(storage?:StoragePort):DataIssueLedger {
  try{
    const target=storage??globalThis.localStorage,raw=target?.getItem(dataIssueStorageKey)
    if(!raw)return emptyDataIssueLedger()
    const parsed=JSON.parse(raw) as {version?:number;issues?:unknown[]}
    if(parsed?.version!==1||!Array.isArray(parsed.issues)||!parsed.issues.every(validIssue)||new Set(parsed.issues.map(row=>row.id)).size!==parsed.issues.length)throw new Error('invalid')
    return {...emptyDataIssueLedger(),issues:parsed.issues}
  }catch{return {...emptyDataIssueLedger(),writable:false,warning:'本地事项记录无法读取；当前来源缺口仍可查看，旧内容未覆盖。责任与期限暂不能保存，请先恢复本地存储。'}}
}
export function persistDataIssueLedger(ledger:DataIssueLedger,storage?:StoragePort):string|null {
  if(!ledger.writable)return ledger.warning
  try{const target=storage??globalThis.localStorage;if(!target)throw new Error('unavailable');target.setItem(dataIssueStorageKey,JSON.stringify({version:1,issues:ledger.issues}));return null}
  catch{return '本地事项未能保存；请检查浏览器存储，当前结果没有写入来源单据。'}
}
