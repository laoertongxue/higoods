import {cuttingRecordFingerprint} from './cutting-record-identity.ts'
import {commitCuttingRecords,readCuttingRecords,readCuttingCommand,diffCuttingRecords,type CuttingRecordSnapshot} from './cutting-record-repository.ts'

export interface CutPieceTicketValidityRecord {id:string;ticketId:string;valid:boolean;reason:string;operator:string;at:string;version:number}
const records=new Map<string,CutPieceTicketValidityRecord>()
const collection='cut-piece-ticket-validity'
export function hydrateCutPieceTicketValidity(snapshot:CuttingRecordSnapshot):void {
  records.clear()
  for(const row of snapshot.records.filter(row=>row.collection===collection)) {
    const value=row.value as CutPieceTicketValidityRecord
    if(!value.ticketId || typeof value.valid!=='boolean' || !Number.isSafeInteger(value.version) || value.version<1) throw new Error('裁片整票有效性记录不完整，请重新读取。')
    const prior=records.get(value.ticketId)
    if(!prior || prior.version<value.version) records.set(value.ticketId,value)
  }
}
export function isCutPieceTicketUsable(ticketId:string):boolean {return records.get(ticketId)?.valid !== false}
export function getCutPieceTicketValidity(ticketId:string):CutPieceTicketValidityRecord|null {return records.get(ticketId) ? structuredClone(records.get(ticketId)!) : null}
export async function saveCutPieceReleaseTicketValidityAction(input:{ticketId:string;valid:boolean;reason:string;operator:string;operationId?:string;expectedVersion?:number}):Promise<{ok:boolean;message:string}> {
  let originalSnapshot:CuttingRecordSnapshot|undefined
  let originalRelease:ReturnType<typeof import('../cut-piece-release.ts').captureCutPieceReleaseState>|undefined
  let committed=false
  try {
    if(!input.ticketId.trim() || typeof input.valid!=='boolean' || !input.reason.trim() || !input.operator.trim()) return {ok:false,message:'请选择整票可用或不可用，并填写原因和操作人。'}
    const intent=JSON.stringify({...input,operationId:undefined})
    const snapshot=await readCuttingRecords();originalSnapshot=snapshot;hydrateCutPieceTicketValidity(snapshot)
    const prior=records.get(input.ticketId)
    if(!input.operationId && prior?.valid===input.valid && prior.reason===input.reason.trim() && prior.operator===input.operator.trim())return {ok:true,message:'这次整票登记已经保存，未重复新增记录。'}
    const id=input.operationId || `TICKET-VALIDITY:${await cuttingRecordFingerprint(`${intent}:${(prior?.version || 0)+1}`)}`
    const previous=await readCuttingCommand(id)
    if(previous) {if(previous.intent!==intent) throw new Error('该确认编号已用于其他内容。');return previous.result as {ok:boolean;message:string}}
    if(input.expectedVersion!==undefined && (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion!==(prior?.version || 0))) throw new Error('整票登记已在其他页面更新。')
    const [production,parts,events]=await Promise.all([import('../production-context-records.ts'),import('./part-ticket-records.ts'),import('./cutting-event-repository.ts')])
    await production.hydrateProductionContextRecords(snapshot);await parts.hydratePartTicketRecords(snapshot);events.prepareCommittedCuttingEventSnapshot(snapshot)
    const release=await import('../cut-piece-release.ts')
    if(release.getCutPieceReleaseMigrationStatus().required)throw new Error('原放行资料需要先完成转换和核验，不能覆盖保存。')
    await release.hydrateCutPieceReleaseRecords(snapshot)
    const facts=await import('./cut-piece-release-facts.ts')
    if(!facts.getCutPieceReleaseTicketEligibility(input.ticketId).found) return {ok:false,message:'没有找到该菲票的有效来源，不能更改其他票或未知票。'}
    const value:CutPieceTicketValidityRecord={id,ticketId:input.ticketId,valid:input.valid,reason:input.reason.trim(),operator:input.operator.trim(),at:new Date().toISOString(),version:(prior?.version || 0)+1}
    const result={ok:true,message:`已登记整票${input.valid?'可用':'不可用'}；原票和交接历史保留，请跟进当前数量差异。`}
    originalRelease=release.captureCutPieceReleaseState()
    const baseline=release.captureCutPieceReleaseRecords()
    records.set(value.ticketId,value)
    // 本次有效性及由它产生的数量事实、矩阵版本与事件必须同一事务落盘。
    release.listCutPieceReleaseRecords()
    const change=diffCuttingRecords(baseline,release.captureCutPieceReleaseRecords())
    change.puts=[...(change.puts || []),{id,collection,value},...production.productionContextInitializationRecords(),...parts.partTicketInitializationRecords(),...events.cuttingEventScopeInitializationRecords()]
    release.restoreCutPieceReleaseState(originalRelease);hydrateCutPieceTicketValidity(snapshot)
    await commitCuttingRecords({revision:snapshot.revision,change,assertSourcesCurrent:()=>{production.assertProductionContextLegacyUnchanged();parts.assertPartTicketLegacyUnchanged();events.assertManagedScopeCurrent()},command:{id,intent,result,at:value.at}})
    committed=true
    await release.hydrateCutPieceReleaseRecords(await readCuttingRecords())
    return result
  } catch(error) {
    const release=await import('../cut-piece-release.ts')
    if(!committed && originalRelease)release.restoreCutPieceReleaseState(originalRelease)
    if(!committed && originalSnapshot)hydrateCutPieceTicketValidity(originalSnapshot)
    try{await release.hydrateCutPieceReleaseRecords(await readCuttingRecords())}catch{/* 原资料和输入保持可恢复。 */}
    if(committed) return {ok:false,message:'登记已保存，页面未更新。请重新读取核对。'}
    const reason=(error instanceof Error?error.message:String(error)).replace(/[。；;\s]+$/,'')
    const recovery=reason.includes('请')?'输入已保留。':'输入已保留，请重新读取后核对。'
    return {ok:false,message:`${reason.includes('未保存')?'':'未保存：'}${reason}。${recovery}`}
  }
}
