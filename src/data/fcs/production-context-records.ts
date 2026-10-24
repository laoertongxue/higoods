import { validateProductionCreatedProcessSources } from './production-created-process-source-types.ts'
import { hydrateCuttingPickupRecords } from './cutting/cutting-pickup-records.ts'
import { needsSeamEmbroideryNormalization, normalizeSeamEmbroideryReferences } from './seam-embroidery-identity.ts'
import { cuttingRecordUuid, cuttingRecordFingerprint, cuttingRecordBytesFingerprint } from './cutting/cutting-record-identity.ts'
import { readCuttingRecords, readPostFinishingProductionRecords, readCuttingRecordRevision, readCuttingCommand, commitCuttingRecords, diffCuttingRecords, type CuttingStoredRecord, type CuttingRecordSnapshot, type CuttingRecordChange, readCuttingRecordFile } from './cutting/cutting-record-repository.ts'

/** 换片布及裁片交出使用的上游事实，复用同一数据库和版本。 */
export const PRODUCTION_CONTEXT_KEYS = {
  orders: 'higood.formal-created-production-orders.v1',
  runtime: 'higood.runtime-process-task-actions.v1',
  assignments: 'higood.effective-task-assignments.v2',
  samples: 'higood:sewing-sample-approval:v3',
  sewingExecutions: 'higood.sewing-execution-history.v1',
  contracts: 'higood:fcs:production-contracts:v2',
  effects: 'higood.production-assignment-effects.v1',
  responsibility:'higood.sewing-task-responsibility-transfers.v1',
} as const
const keys: string[] = Object.values(PRODUCTION_CONTEXT_KEYS)
const migratableKeys = keys.filter(key => key !== PRODUCTION_CONTEXT_KEYS.samples)
const prefix = 'production-context:'
const migrationCollection = 'production-context-migrations'
function isBrowserContext(): boolean { return typeof window !== 'undefined' && typeof document !== 'undefined' }
const nodeMemoryValues=new Map<string,string>()
function nodeContextStorage(): Storage | null {
  return typeof window !== 'undefined' && window.localStorage
    ? window.localStorage : typeof localStorage === 'undefined' ? null : localStorage
}
export class ProductionContextReadError extends Error { readonly code = 'PRODUCTION_CONTEXT_RECOVERY' }
export function isProductionContextRecoveryError(error: unknown): boolean {
  return error instanceof ProductionContextReadError || (object(error) && error.code === 'PRODUCTION_CONTEXT_RECOVERY')
}
type Json = Record<string, unknown>
function object(value: unknown): value is Json { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function text(value: unknown): value is string { return typeof value === 'string' && Boolean(value.trim()) }
function assertKey(key: string): void { if (!keys.includes(key)) throw new Error(`未登记的生产来源：${key}`) }
function fail(message = '上游记录格式不完整'): never { throw new Error(`${message}，未覆盖原数据。`) }
function row(collection: string, id: string, value: unknown): CuttingStoredRecord { return { id: `${prefix}${collection}:${id}`, collection: `${prefix}${collection}`, value } }
function list(value: unknown): unknown[] { if (!Array.isArray(value)) fail(); return value }
function sequence(value: unknown): void { if (!Number.isSafeInteger(value) || Number(value) < 0) fail('上游序号格式错误') }
function pairs(value: unknown, collection: string, validate: (id: string, value: unknown) => void): CuttingStoredRecord[] {
  return list(value).map(item => {
    if (!Array.isArray(item) || item.length !== 2 || !text(item[0])) fail()
    validate(item[0], item[1]); return row(collection, item[0], { key: item[0], value: item[1] })
  })
}
function validateRuntime(field: string, id: string, value: unknown): void {
  if (!object(value)) fail('任务记录格式错误')
  if ('__removedStaticRuntimeEntry' in value) {
    if (value.__removedStaticRuntimeEntry !== true || Object.keys(value).length !== 1) fail('静态任务删除标记格式错误')
    return
  }
  if (field === 'splitPlans' && (!text(value.sourceTaskId) || value.sourceTaskId !== id || !Array.isArray(value.results)
    || value.results.some(item => !object(item) || !text(item.taskId)))) fail('拆分任务身份或明细错误')
  if (field === 'mergedPlans' && (!text(value.mergedTaskId) || !Array.isArray(value.taskIds)
    || value.taskIds.some(item => !text(item)) || new Set(value.taskIds).size !== value.taskIds.length)) fail('合并任务身份或明细错误')
  if (field === 'reassignedTasks' && value.taskId !== id) fail('改派任务身份不一致')
  if (field === 'taskOverrides' && value.taskId !== undefined && value.taskId !== id) fail('任务覆盖身份不一致')
}
export function decodeProductionContextRecords(key: string, raw: string | null): CuttingStoredRecord[] {
  assertKey(key)
  if (raw === null) return []
  let data: unknown
  try { data = JSON.parse(raw) } catch { fail('上游记录格式错误') }
  if (needsSeamEmbroideryNormalization(raw)) normalizeSeamEmbroideryReferences(data)
  return decodeProductionContextData(key,data)
}
/** Parse and native-row readers share exactly the original schema checks. */
function decodeProductionContextData(key:string,data:unknown):CuttingStoredRecord[] {
  assertKey(key)
  if (!object(data)) fail('上游记录格式错误')
  let result: CuttingStoredRecord[]
  if (key === PRODUCTION_CONTEXT_KEYS.orders) {
    if (data.version !== 1) fail('生产单记录格式版本不支持')
    result = list(data.orders).map(value => {
      if (!object(value) || !text(value.productionOrderId)) fail('生产单记录格式缺少编号')
      for (const field of ['demandSnapshot', 'taskBreakdownSummary', 'techPackSnapshot']) {
        if (value[field] !== undefined && value[field] !== null && !object(value[field])) fail('生产单快照格式错误')
      }
      if (value.productionCreatedProcessSources !== undefined) validateProductionCreatedProcessSources(value.productionCreatedProcessSources, value.productionOrderId)
      return row('orders', value.productionOrderId, value)
    })
  } else if (key === PRODUCTION_CONTEXT_KEYS.runtime) {
    if (data.version !== 1) fail('运行任务记录格式版本错误')
    sequence(data.auditSeq)
    result = ['taskOverrides', 'splitPlans', 'mergedPlans', 'reassignedTasks'].flatMap(field => pairs(data[field], field, (id, value) => validateRuntime(field, id, value)))
    result.push(row('runtime-meta', 'sequence', { auditSeq: data.auditSeq }))
  } else if (key === PRODUCTION_CONTEXT_KEYS.assignments) {
    if (data.version !== 2) fail('有效分配记录格式版本错误')
    sequence(data.auditSeq); sequence(data.assignmentSeq)
    const assignments = pairs(data.assignments, 'assignments', (id, value) => {
      if (!object(value) || value.assignmentId !== id || !text(value.runtimeTaskId) || !text(value.factoryId)
        || !['EFFECTIVE', 'SUPERSEDED', 'CANCELLED'].includes(String(value.status))) fail('有效分配身份或状态错误')
    })
    const byId = new Map(assignments.map(item => { const pair = item.value as Json; return [pair.key, pair.value as Json] }))
    const current = pairs(data.current, 'assignment-current', (id, value) => {
      if (!Array.isArray(value) || value.some(item => !text(item)) || new Set(value).size !== value.length) fail('当前分配索引格式错误')
      for (const assignmentId of value) {
        const assignment = byId.get(assignmentId)
        if (!assignment || assignment.runtimeTaskId !== id || assignment.status !== 'EFFECTIVE') fail('当前分配索引缺少对应有效分配')
      }
    })
    const audit = list(data.auditLogs).map(value => {
      if (!object(value) || !text(value.auditId) || !text(value.assignmentId) || !text(value.runtimeTaskId)
        || !['CREATED', 'SUPERSEDED', 'CANCELLED'].includes(String(value.action))) fail('分配审计记录格式错误')
      if (!byId.has(value.assignmentId) || byId.get(value.assignmentId)?.runtimeTaskId !== value.runtimeTaskId) fail('分配审计记录关联错误')
      return row('assignment-audit', value.auditId, value)
    })
    result = [...assignments, ...current, ...audit, row('assignment-meta', 'sequence', { auditSeq: data.auditSeq, assignmentSeq: data.assignmentSeq })]
  }
  else if (key === PRODUCTION_CONTEXT_KEYS.sewingExecutions) {
    if (data.version !== 1) fail('真实车缝执行历史版本不支持')
    const ordinals = new Set<string>(), identities = new Set<string>()
    result = list(data.facts).map(value => {
      if (!object(value) || !text(value.id) || !text(value.factoryId) || !text(value.taskId) || !text(value.productionOrderId)
        || !text(value.styleCode) || !Array.isArray(value.taskAliases) || !value.taskAliases.includes(value.taskId) || value.taskAliases.some(alias=>!text(alias)) || new Set(value.taskAliases).size!==value.taskAliases.length
        || !text(value.firstExecutedAt) || !Number.isFinite(Date.parse(value.firstExecutedAt)) || !text(value.confirmedAt)
        || !text(value.sourceId) || !text(value.actorName) || !['MANUAL_START','CUT_PIECE_RECEIVE_START'].includes(String(value.source))
        || !Number.isSafeInteger(value.ordinal) || Number(value.ordinal) < 1) fail('真实车缝执行身份、时间或序次错误')
      const ordinal = `${value.factoryId}:${value.ordinal}`, identity = `${value.factoryId}:${value.productionOrderId}:${value.styleCode}`
      if (ordinals.has(ordinal) || identities.has(identity) || value.id !== `SEW-EXEC:${[value.factoryId,value.productionOrderId,value.styleCode].map(encodeURIComponent).join(':')}`) fail('真实车缝执行序次或任务重复')
      ordinals.add(ordinal); identities.add(identity)
      return row('sewing-executions', value.id, value)
    })
  }
  else if (key === PRODUCTION_CONTEXT_KEYS.samples) {
    if (data.version !== 3) fail('样衣来源版本不支持')
    sequence(data.sequence)
    result = list(data.records).map(value => {
      if (!object(value) || !text(value.assignmentId) || !object(value.sample) || value.sample.assignmentId !== value.assignmentId || !text(value.sample.sampleId) || !Array.isArray(value.suggestionVersions)) fail('样衣身份或版本记录错误')
      {
        if(value.qualitySchemaVersion !== 1 || !text(value.sample.factoryId) || !text(value.sample.runtimeTaskId) || !text(value.sample.productionOrderId)
          || !['WAITING_PPIC_RECEIVE','PPIC_RECEIVED','HANDED_TO_APPROVER','APPROVAL_IN_PROGRESS','SUGGESTION_UPLOADED','FEEDBACK_SENT'].includes(String(value.sample.status))) fail('样衣当前格式身份或状态不完整')
        const aliases=value.assignmentAliases
        if(aliases!==undefined && (!Array.isArray(aliases) || aliases.some(alias=>!object(alias)||!text(alias.assignmentId)||!text(alias.runtimeTaskId))
          || new Set(aliases.map(alias=>alias.assignmentId)).size!==aliases.length)) fail('样衣任务别名身份冲突')
        const snapshot=value.inspectionStandardSnapshot
        if(snapshot!==undefined) {
          if(!object(snapshot)||!text(snapshot.id)||!text(snapshot.selectedAt)||!object(snapshot.context)||snapshot.context.sourceKind!=='PRE_PRODUCTION_SAMPLE'
            ||snapshot.context.objectType!=='GARMENT'||snapshot.ruleSnapshot!==null||!Array.isArray(snapshot.items)||!snapshot.items.length
            ||snapshot.items.some(item=>!object(item)||!text(item.id)||!text(item.name)||!text(item.criterion))
            ||new Set(snapshot.items.map(item=>item.id)).size!==snapshot.items.length) fail('样衣固定标准不完整或混入抽检规则')
          const itemIds=new Set(snapshot.items.map(item=>item.id))
          for(const suggestion of value.suggestionVersions) {
            if(!object(suggestion)||!['NO_PROBLEM','HAS_PROBLEM'].includes(String(suggestion.conclusion))) fail('样衣结论不完整')
            const issues=suggestion.issues
            if(issues!==undefined && (!Array.isArray(issues)||issues.some(issue=>!object(issue)||!itemIds.has(issue.itemId)||!text(issue.note))
              ||new Set(issues.map(issue=>issue.itemId)).size!==issues.length)) fail('样衣问题未对应本次标准项目')
            if(suggestion.conclusion==='HAS_PROBLEM' && (!Array.isArray(issues)||!issues.length)) fail('样衣有问题结论缺少具体项目')
          }
        }
        if(value.sample.approverReceivedInstant!==undefined && (!text(value.sample.approverReceivedInstant)||!/(Z|[+-]\d{2}:?\d{2})$/.test(value.sample.approverReceivedInstant)||!Number.isFinite(Date.parse(value.sample.approverReceivedInstant)))) fail('样衣领取时间点无效')
      }
      return row('samples', value.assignmentId, value)
    })
    result.push(...pairs(data.commands, 'sample-commands', (_id, value) => { if (!object(value) || !text(value.assignmentId) || !text(value.action)) fail('样衣动作记录错误') }), row('sample-meta','sequence',{sequence:data.sequence}))
  } else if (key === PRODUCTION_CONTEXT_KEYS.contracts) {
    for (const field of ['contractSeq','scanSeq','auditSeq']) sequence(data[field])
    result = list(data.contracts).map(value => {
      if (!object(value) || !text(value.contractId) || !text(value.assignmentId) || !Array.isArray(value.scans) || !Array.isArray(value.skuLines) || !Array.isArray(value.processNames) || !object(value.returnRuleSnapshot) || !text(value.returnRuleSnapshot.fulfillmentRuleCode) || !['EFFECTIVE','INVALIDATED','GENERATION_FAILED'].includes(String(value.status))) fail('合同身份或扫描记录错误')
      if (value.scans.some(scan => !object(scan) || !text(scan.scanId) || !text(scan.fileName) || !Number.isFinite(scan.size) || Number(scan.size)<0 || !(text(scan.dataUrl) || (object(scan.dataUrl) && text(scan.dataUrl.$productionFile))))) fail('合同扫描文件格式错误')
      return row('contracts',value.contractId,value)
    })
    result.push(...list(data.auditLogs).map(value => { if (!object(value) || !text(value.auditId) || !text(value.contractId)) fail('合同操作记录错误'); return row('contract-audit',value.auditId,value) }), row('contract-meta','sequence',{contractSeq:data.contractSeq,scanSeq:data.scanSeq,auditSeq:data.auditSeq}))
  } else if(key===PRODUCTION_CONTEXT_KEYS.responsibility) {
    if(data.version!==1) fail('PPIC责任记录版本不支持')
    sequence(data.sequence)
    result=list(data.records).map(value=>{
      if(!object(value) || !text(value.responsibilityVersionId) || !text(value.runtimeTaskId) || !text(value.assignmentId) || !text(value.commandId) || !text(value.ppicId) || !text(value.effectiveAt) || !Array.isArray(value.remainingItems)) fail('PPIC责任记录身份或明细错误')
      return row('responsibility-transfers',value.responsibilityVersionId,value)
    })
    result.push(row('responsibility-meta','sequence',{sequence:data.sequence}))
  } else {
    if (data.version !== 1) fail('分配关联记录版本不支持')
    result = pairs(data.entries, 'assignment-effects', (id,value) => {
      const split=id.indexOf(':'),domain=id.slice(0,split),identity=id.slice(split+1)
      if(!identity) fail('分配关联编号缺失')
      const fields:Record<string,string>={'sla-snapshot':'snapshotId','sla-review':'reviewId','material-context':'assignmentId','material-event':'handoverEventId','return-snapshot':'snapshotId','return-reminder':'reminderId','return-receipt':'receiptId','tender':'tenderId','process-task':'taskId','factory-completion':'handoverId','started-handover-head':'handoverId','legacy-tender-award':'tenderId'}
      if(object(value) && value.__deletedAssignmentEffect===true && Object.keys(value).length===1) {if(!fields[domain] && !['sla-current','material-command','material-sequence','return-sequence','special-invalidation'].includes(domain)) fail();return}
      if(['material-sequence','return-sequence'].includes(domain)){if(identity!=='value') fail();sequence(value);return}
      if(['sla-current','material-command'].includes(domain)){if(!text(value)) fail('分配关联索引错误');return}
      if(domain==='special-invalidation'){if(!object(value)||!text(value.taskOrderId)||!text(value.mergedTaskId)||!text(value.invalidatedAt)) fail('合并失效记录不完整');return}
      if(domain==='legacy-tender-award' && (!object(value)||!text(value.taskId)||!text(value.productionOrderId)||!text(value.awardedFactoryId)||!text(value.awardedFactory)||!text(value.awardedBy)||!text(value.awardedAt)||!Number.isFinite(Date.parse(value.awardedAt))||!Number.isFinite(value.awardedPrice)||Number(value.awardedPrice)<=0||typeof value.awardReason!=='string')) fail('既有招标定标记录不完整')
      if(domain==='started-handover-head' && (!object(value)||value.headType!=='HANDOUT'||!text(value.taskId)||value.runtimeTaskId!==value.taskId||!text(value.factoryId)||value.handoverOrderId!==value.handoverId||!text(value.handoverOrderNo)||value.completionStatus!=='OPEN'||value.factoryMarkedComplete!==false||value.recordCount!==0||value.submittedQtyTotal!==0||value.writtenBackQtyTotal!==0||value.qtyActualTotal!==0||!Number.isFinite(value.plannedQty)||Number(value.plannedQty)<=0||value.qtyExpectedTotal!==value.plannedQty)) fail('开工交出单头不完整或包含交出数量')
      if(domain==='factory-completion' && (!object(value)||!text(value.taskId)||!text(value.completedBy)||!text(value.completedAt)||!Number.isFinite(Date.parse(value.completedAt))||Object.keys(value).some(key=>!['handoverId','taskId','completedAt','completedBy'].includes(key)))) fail('工厂结束记录不完整')
      if(!fields[domain] || !object(value) || value[fields[domain]]!==identity) fail('分配关联记录身份错误')
    })
  }
  if (new Set(result.map(item => item.id)).size !== result.length) fail('上游记录编号重复')
  return result
}
function collections(key: string): string[] {
  assertKey(key)
  if (key === PRODUCTION_CONTEXT_KEYS.orders) return ['orders']
  if (key === PRODUCTION_CONTEXT_KEYS.runtime) return ['taskOverrides', 'splitPlans', 'mergedPlans', 'reassignedTasks', 'runtime-meta']
  if (key === PRODUCTION_CONTEXT_KEYS.assignments) return ['assignments', 'assignment-current', 'assignment-audit', 'assignment-meta']
  if (key === PRODUCTION_CONTEXT_KEYS.samples) return ['samples','sample-commands','sample-meta']
  if (key === PRODUCTION_CONTEXT_KEYS.sewingExecutions) return ['sewing-executions']
  if (key === PRODUCTION_CONTEXT_KEYS.contracts) return ['contracts','contract-audit','contract-meta']
  if(key===PRODUCTION_CONTEXT_KEYS.responsibility) return ['responsibility-transfers','responsibility-meta']
  return ['assignment-effects']
}
/** Samples already arrive as detached native objects. Validate the same schema
 * once without parsing our freshly serialized 2,000 complete snapshots again.
 * Legacy seam references retain the original normalization/roundtrip path. */
function encodeCurrentSampleRows(selected:CuttingStoredRecord[]):string|undefined {
  if(selected.some(item=>!object(item.value)))fail('已保存来源实体格式错误')
  const values=(name:string)=>selected.filter(item=>item.collection===prefix+name).map(item=>item.value as Json)
  const data={version:3,records:values('samples'),commands:values('sample-commands').map(item=>[item.key,item.value]),sequence:values('sample-meta')[0]?.sequence}
  const raw=JSON.stringify(data)
  if(needsSeamEmbroideryNormalization(raw))return undefined
  const decoded=decodeProductionContextData(PRODUCTION_CONTEXT_KEYS.samples,data)
  const canonical=new Map(decoded.map(item=>[item.id,item]))
  const mismatch=()=>fail('已保存来源身份或元数据不一致')
  if(decoded.length!==selected.length || canonical.size!==selected.length)mismatch()
  for(const item of selected){
    const expected=canonical.get(item.id)
    if(!expected || item.collection!==expected.collection || Object.keys(item).some(field=>!['id','collection','value'].includes(field)))mismatch()
    const value=item.value as Json,expectedValue=expected!.value as Json
    if(item.collection===prefix+'samples'){
      if(value!==expectedValue)mismatch()
    }else if(item.collection===prefix+'sample-commands'){
      if(Object.keys(value).some(field=>!['key','value'].includes(field)) || value.key!==expectedValue.key || value.value!==expectedValue.value)mismatch()
    }else if(Object.keys(value).some(field=>field!=='sequence') || value.sequence!==expectedValue.sequence)mismatch()
  }
  return raw
}
export function encodeProductionContextRecords(key: string, records: CuttingStoredRecord[]): string | null {
  const names = collections(key).map(name => prefix + name)
  if(key===PRODUCTION_CONTEXT_KEYS.samples){
    const selected=records.filter(item=>names.includes(item.collection))
    if(!selected.length)return null
    const current=encodeCurrentSampleRows(selected)
    if(current!==undefined)return current
  }
  const selected = records.filter(item => names.includes(item.collection)).map(item => {
    const raw = JSON.stringify(item.value)
    return needsSeamEmbroideryNormalization(raw) ? { ...item, value: normalizeSeamEmbroideryReferences(JSON.parse(raw)) } : item
  })
  if (!selected.length) return null
  const values = (name: string) => selected.filter(item => item.collection === prefix + name).map(item => item.value as Json)
  if (selected.some(item => !object(item.value))) fail('已保存来源实体格式错误')
  const readPairs = (name: string) => values(name).map(item => [item.key, item.value])
  let data: Json
  if (key === PRODUCTION_CONTEXT_KEYS.orders) data = { version: 1, orders: values('orders') }
  else if (key === PRODUCTION_CONTEXT_KEYS.runtime) data = { version: 1,
    taskOverrides: readPairs('taskOverrides'), splitPlans: readPairs('splitPlans'), mergedPlans: readPairs('mergedPlans'),
    reassignedTasks: readPairs('reassignedTasks'), auditSeq: values('runtime-meta')[0]?.auditSeq }
  else if (key === PRODUCTION_CONTEXT_KEYS.assignments) data = { version: 2, assignments: readPairs('assignments'), current: readPairs('assignment-current'), auditLogs: values('assignment-audit'),
    assignmentSeq: values('assignment-meta')[0]?.assignmentSeq, auditSeq: values('assignment-meta')[0]?.auditSeq }
  else if (key === PRODUCTION_CONTEXT_KEYS.sewingExecutions) data = {version:1,facts:values('sewing-executions')}
  else if (key === PRODUCTION_CONTEXT_KEYS.samples) data = {version:3, records:values('samples'),commands:readPairs('sample-commands'),sequence:values('sample-meta')[0]?.sequence}
  else if (key === PRODUCTION_CONTEXT_KEYS.contracts) data = {contracts:values('contracts'),auditLogs:values('contract-audit'),...values('contract-meta')[0]}
  else if(key===PRODUCTION_CONTEXT_KEYS.responsibility) data={version:1,records:values('responsibility-transfers'),sequence:values('responsibility-meta')[0]?.sequence}
  else data = {version:1,entries:readPairs('assignment-effects')}
  const raw = JSON.stringify(data), expected = decodeProductionContextRecords(key, raw)
  const actual = new Map(selected.map(item => [item.id, item]))
  if (actual.size !== selected.length || expected.length !== selected.length || expected.some(item => JSON.stringify(actual.get(item.id)) !== JSON.stringify(item))) fail('已保存来源身份或元数据不一致')
  return raw
}

const fileUrls = new Map<string, string>()
const urlFiles = new Map<string, string>()
function fileReference(value: unknown): value is { $productionFile: string } {
  return object(value) && Object.keys(value).length === 1 && typeof value.$productionFile === 'string' && /^production-context-file:[a-f0-9]{64}$/.test(value.$productionFile)
}
/** 返回持久 JSON 中的文件引用，备份/清理可据此核对；页面 objectURL 不作为事实源。 */
export function productionContextFileIds(value: unknown): string[] {
  if(fileReference(value)) return [value.$productionFile]
  if(Array.isArray(value)) return value.flatMap(productionContextFileIds)
  if(object(value)) return Object.values(value).flatMap(productionContextFileIds)
  return []
}
async function prepareContextFiles(records: CuttingStoredRecord[]): Promise<{records:CuttingStoredRecord[];files:Array<{id:string;blob:Blob}>}> {
  const files=new Map<string,Blob>()
  const pendingSources=new Map<string,Promise<{$productionFile:string}>>()
  const preparationNeeded=(root:unknown):boolean=>{
    const pending=[root]
    while(pending.length){
      const value=pending.pop()
      if(typeof value==='string'){if(urlFiles.has(value)||value.startsWith('blob:')||value.startsWith('data:'))return true}
      else if(Array.isArray(value)){for(const item of value)pending.push(item)}
      else if(object(value)){
        if('$productionFile' in value){if(!fileReference(value))throw new Error('附件引用格式不正确。');continue}
        for(const item of Object.values(value))pending.push(item)
      }
    }
    return false
  }
  async function visit(value:unknown):Promise<unknown> {
    if(typeof value === 'string') {
      const existing=urlFiles.get(value)
      if(existing) return {$productionFile:existing}
      if(value.startsWith('blob:')) throw new Error('附件预览已失效，请重新选择文件后保存。')
      if(value.startsWith('data:')) {
        let pending=pendingSources.get(value)
        if(!pending){pending=(async()=>{
          const response=await fetch(value),blob=await response.blob()
          const bytes=await blob.arrayBuffer()
          const hash=await cuttingRecordBytesFingerprint(new Uint8Array(bytes))
          const id=`production-context-file:${hash}`
          const saved=await readCuttingRecordFile(id)
          if(!saved) files.set(id,blob)
          else if(saved.size!==blob.size) throw new Error('附件身份冲突，原文件未覆盖。')
          return {$productionFile:id}
        })();pendingSources.set(value,pending)}
        return pending
      }
      return value
    }
    if(Array.isArray(value)) return Promise.all(value.map(visit))
    if(object(value)) {
      if('$productionFile' in value && !fileReference(value)) throw new Error('附件引用格式不正确。')
      return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key,item])=>[key,await visit(item)])))
    }
    return value
  }
  const prepared=await Promise.all(records.map(async record=>preparationNeeded(record.value)
    ? {...record,value:await visit(record.value)}
    : record.id==='command-result'?{...record,value:structuredClone(record.value)}:record))
  return {records:prepared,files:[...files].map(([id,blob])=>({id,blob}))}
}
async function materializeContextFiles(records:CuttingStoredRecord[],revokeUnused=true):Promise<CuttingStoredRecord[]> {
  // Several fields/records can reference the same original file. Cache the
  // in-flight read as well as its completed URL; no duplicate native reads.
  const pendingUrls=new Map<string,Promise<string>>()
  const resolveFile=(id:string):Promise<string>=>{
    const existing=fileUrls.get(id)
    if(existing)return Promise.resolve(existing)
    let pending=pendingUrls.get(id)
    if(!pending){pending=(async()=>{const blob=await readCuttingRecordFile(id);if(!blob)throw new ProductionContextReadError('生产关联附件缺失，请保留现有数据并导入完整备份。');const url=URL.createObjectURL(blob);fileUrls.set(id,url);urlFiles.set(url,id);return url})();pendingUrls.set(id,pending)}
    return pending
  }
  async function visit(value:unknown):Promise<unknown> {
    if(fileReference(value))return resolveFile(value.$productionFile)
    if(Array.isArray(value)) return Promise.all(value.map(visit))
    if(object(value)) return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key,item])=>[key,await visit(item)])))
    return value
  }
  // Keep reference-free record trees from the detached native read. Rebuilding
  // every field with an async Promise adds no materialization and duplicates all
  // historical standards. Only trees that actually reference a Blob need it.
  const referenced=new Set<string>(),withFiles=new Set<CuttingStoredRecord>()
  for(const record of records){
    const pending:unknown[]=[record.value]
    while(pending.length){
      const value=pending.pop()
      if(fileReference(value)){referenced.add(value.$productionFile);withFiles.add(record)}
      else if(Array.isArray(value)){for(const item of value)if(item && typeof item==='object')pending.push(item)}
      else if(object(value)){for(const item of Object.values(value))if(item && typeof item==='object')pending.push(item)}
    }
  }
  const result=await Promise.all(records.map(async record=>withFiles.has(record)?({...record,value:await visit(record.value)}):record))
  for(const [id,url] of fileUrls) if(revokeUnused && !referenced.has(id)) { URL.revokeObjectURL(url);fileUrls.delete(id);urlFiles.delete(url) }
  return result
}

let current: CuttingRecordSnapshot | null = null
let preparedKeys = new Set<string>()
let stage: Map<string, string | null> | null = null
let locked = false
let pendingReadHydration: { snapshot?: CuttingRecordSnapshot; promise: Promise<void> } | undefined
const listeners = new Map<string, Set<() => void>>()
const serialized = new Map<string, string | null>()
// The original samples JSON is only a synchronous compatibility view of the
// same native rows. A single PP action updates these detached rows; rebuild the
// old view only when an original getItem/generic action actually asks for it.
let materializedSampleRows = new Map<string,CuttingStoredRecord>()
let sampleSerializationDirty = false
function flushSampleSerialization():void {
  if(!sampleSerializationDirty)return
  serialized.set(PRODUCTION_CONTEXT_KEYS.samples,encodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.samples,[...materializedSampleRows.values()]))
  sampleSerializationDirty=false
}
const inspectedEmptyKeys = new Set<string>()
let initializationRecords: CuttingStoredRecord[] = []
/** 只供已有裁床动作合并到同一事务；普通读取绝不写入初始化记录。 */
export function productionContextInitializationRecords(): CuttingStoredRecord[] {
  if (!isProductionContextReady()) throw new ProductionContextReadError('完整生产来源尚未读取，不能创建来源初始化记录。')
  return structuredClone(initializationRecords)
}
export function assertProductionContextLegacyUnchanged(): void {
  if (!isProductionContextReady()) throw new ProductionContextReadError('完整生产来源尚未读取，请重新进入页面。')
  if (isBrowserContext()) for (const item of initializationRecords) {
    if (legacyValue((item.value as MigrationMarker).key) !== null) throw new ProductionContextReadError('旧页面写入了生产来源，请先迁移，本次未保存。')
  }
}
export function onProductionContextChanged(key: string, callback: () => void): void {
  assertKey(key); const group = listeners.get(key) || new Set(); group.add(callback); listeners.set(key, group)
}
export function isProductionContextReady(key?:string): boolean { return current !== null && (key ? preparedKeys.has(key) : preparedKeys.size===keys.length) }
export function isProductionContextStaged(): boolean { return stage !== null }
export function readProductionContextValue(key: string): string | null {
  assertKey(key)
  if (stage) return stage.get(key) ?? null
  if (isProductionContextReady(key)) {if(key===PRODUCTION_CONTEXT_KEYS.samples)flushSampleSerialization();return serialized.get(key) ?? null}
  if (!isBrowserContext()) {const storage=nodeContextStorage();return storage ? storage.getItem(key) : nodeMemoryValues.get(key) ?? null}
  throw new ProductionContextReadError('生产来源尚未读取，请重新进入页面；未使用空记录代替已有数据。')
}
export function writeProductionContextValue(key: string, value: string | null): void {
  assertKey(key); decodeProductionContextRecords(key, value)
  if (stage) { stage.set(key, value); return }
  if (!isBrowserContext()) {
    const storage = nodeContextStorage()
    if (storage) { if (value === null) storage.removeItem(key); else storage.setItem(key, value) }
    else {if(value===null)nodeMemoryValues.delete(key);else nodeMemoryValues.set(key,value)}
    return
  }
  throw new Error('本次生产来源尚未保存，请从保存或确认按钮重试。')
}
export const productionContextStorage = {
  getItem: readProductionContextValue, setItem: writeProductionContextValue, removeItem: (key: string) => writeProductionContextValue(key, null),
}
interface MigrationMarker { key: string; fingerprint: string; phase: 'COPYING' | 'VERIFIED' | 'COMPLETE'; count: number; copied: number; ids: string[]; targetFingerprint: string }
function marker(snapshot: CuttingRecordSnapshot, key: string): MigrationMarker | undefined {
  const value = snapshot.records.find(item => item.id === `source-migration:${key}`)?.value
  if (value === undefined) return undefined
  if (!object(value) || value.key !== key || !['COPYING', 'VERIFIED', 'COMPLETE'].includes(String(value.phase))
    || !Array.isArray(value.ids) || typeof value.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.fingerprint)
    || typeof value.targetFingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(value.targetFingerprint)
    || !Number.isSafeInteger(value.count) || !Number.isSafeInteger(value.copied) || Number(value.count) < 0
    || Number(value.copied) < 0 || Number(value.copied) > Number(value.count)
    || value.ids.length !== value.count || value.ids.some(id => !text(id)) || new Set(value.ids).size !== value.ids.length
    || (value.phase !== 'COPYING' && value.copied !== value.count)) fail('生产来源迁移进度损坏')
  return value as unknown as MigrationMarker
}
/** 恢复入口先校验受管实体及索引；不接受未知来源集合冒充可恢复业务。 */
export function validateProductionContextRecords(records: CuttingStoredRecord[]): void {
  const allowed = new Set(keys.flatMap(key => collections(key).map(name => prefix + name)))
  const managed = records.filter(item => item.collection.startsWith(prefix) || item.collection === migrationCollection || item.id.startsWith('source-migration:'))
  if (new Set(managed.map(item => item.id)).size !== managed.length) fail('生产来源记录编号重复')
  if(managed.some(item=>/"(?:data:|blob:)/.test(JSON.stringify(item.value)))) fail('生产来源备份不能包含临时地址或内嵌文件，请导出包含原始文件的完整备份')
  if (managed.some(item => !allowed.has(item.collection) && item.collection !== migrationCollection)) fail('未登记的生产来源集合')
  for (const key of keys) encodeProductionContextRecords(key, records)
  for (const item of managed.filter(item => item.collection === migrationCollection)) {
    if (!object(item.value) || !keys.includes(String(item.value.key)) || item.id !== `source-migration:${item.value.key}`) fail('生产来源迁移身份不一致')
    const saved = marker({ revision: 0, records }, String(item.value.key))!
    const allowedForKey = new Set(collections(saved.key).map(name => prefix + name))
    const rows = new Map(records.map(record => [record.id, record]))
    const found = saved.ids.filter(id => rows.has(id))
    if (saved.ids.some(id => ![...allowedForKey].some(name => id.startsWith(name + ':')))
      || found.some(id => !allowedForKey.has(rows.get(id)!.collection))
      || (saved.phase !== 'COMPLETE' && (found.length < saved.copied || (saved.phase === 'VERIFIED' && found.length !== saved.count)))) fail('生产来源迁移检查点关联缺失')
  }
}
function legacyValue(key: string): string | null {
  if (key === PRODUCTION_CONTEXT_KEYS.samples) return null // Retired demo source; never migrate it into current sample records.
  try { return localStorage.getItem(key) } catch { throw new ProductionContextReadError('旧生产来源无法检查，请允许读取本机旧数据后迁移；未将无法读取当作空数据。') }
}
/** 单来源只读入口复用原迁移标记；普通读取不执行迁移，也不信任“旧键曾经为空”的缓存。 */
export function assertProductionContextSourceReadable(key: string, migrationRecord?: CuttingStoredRecord): void {
  assertKey(key)
  if (key === PRODUCTION_CONTEXT_KEYS.samples) return
  let saved: MigrationMarker | undefined
  try {
    if (migrationRecord && (migrationRecord.id !== `source-migration:${key}` || migrationRecord.collection !== migrationCollection)) throw new Error('生产来源迁移身份不一致')
    saved = marker({ revision: 0, records: migrationRecord ? [migrationRecord] : [] }, key)
    if (migrationRecord && !saved) throw new Error('生产来源迁移进度缺失')
  } catch {
    throw new ProductionContextReadError('该生产来源迁移进度无法核对，请保留旧资料并在数据管理中恢复；未使用部分记录。')
  }
  if (saved && saved.phase !== 'COMPLETE') throw new ProductionContextReadError('该生产来源迁移尚未完成，请在数据管理中继续迁移；未使用部分记录。')
  if (!isBrowserContext()) return
  let raw: string | null
  try { raw = legacyValue(key) } catch (error) {
    // 已完成标记由原迁移事务产生。偏好存储不可用不能否定已确认的本机库事实。
    if (saved?.phase === 'COMPLETE') return
    throw error
  }
  if (raw !== null) throw new ProductionContextReadError(saved?.phase === 'COMPLETE'
    ? '已完成迁移后又发现旧生产来源，请保留新旧资料并在数据管理中核对；未忽略重现的旧记录。'
    : '发现旧生产来源，请先完成显式迁移；未使用空记录或演示资料代替。')
}
export interface ProductionContextMigrationStatus { key: string; phase: 'PENDING' | 'COPYING' | 'VERIFIED' | 'COMPLETE' | 'EMPTY' | 'UNAVAILABLE'; count: number; copied: number; message: string }
export async function listProductionContextMigrationStatus(): Promise<ProductionContextMigrationStatus[]> {
  const snapshot = await readCuttingRecords()
  return migratableKeys.map(key => {
    const saved = marker(snapshot, key)
    if (saved?.phase === 'COMPLETE') return { key, phase: 'COMPLETE', count: saved.count, copied: saved.copied, message: '旧源已核对并清理，使用本机记录库。' }
    try {
      const raw = legacyValue(key)
      return { key, phase: saved?.phase || (raw === null ? 'EMPTY' : 'PENDING'), count: saved?.count ?? decodeProductionContextRecords(key, raw).length, copied: saved?.copied || 0, message: saved ? '迁移未完成，可继续；完成前不开放生产来源保存。' : raw === null ? '未发现旧源。' : '发现旧生产来源，请先迁移。' }
    } catch (error) { return { key, phase: 'UNAVAILABLE', count: saved?.count || 0, copied: saved?.copied || 0, message: String(error) } }
  })
}
function assertLegacyReady(snapshot: CuttingRecordSnapshot): void {
  if (!isBrowserContext()) return
  for (const key of migratableKeys) {
    const saved = marker(snapshot, key)
    if (saved?.phase === 'COMPLETE') continue
    if (saved) throw new ProductionContextReadError('生产来源迁移尚未完成，请在数据管理中继续迁移；未使用部分记录。')
    if (inspectedEmptyKeys.has(key)) continue
    if (legacyValue(key) !== null) throw new ProductionContextReadError('发现旧生产来源，请先完成显式迁移；未使用空记录覆盖。')
    inspectedEmptyKeys.add(key)
  }
}
async function hydrate(snapshot?: CuttingRecordSnapshot, forceNotify = false, requestedKeys=keys): Promise<void> {
  // The existing same-revision path already keeps the current read view. Check
  // that revision before copying every production/sample row again. A changed
  // revision still reads, validates and materializes the complete original set.
  if (!snapshot && current && requestedKeys.every(key=>preparedKeys.has(key)) && !forceNotify && await readCuttingRecordRevision() === current.revision) {
    assertLegacyReady(current)
    return
  }
  const next = snapshot || await readCuttingRecords()
  hydrateCuttingPickupRecords(next)
  assertLegacyReady(next)
  if (current?.revision === next.revision && requestedKeys.every(key=>preparedKeys.has(key)) && !forceNotify) return
  const visibleRecords=await materializeContextFiles(next.records.filter(item=>item.collection.startsWith(prefix)))
  const values = new Map(requestedKeys.map(key => [key, encodeProductionContextRecords(key, visibleRecords)]))
  const unmarked = requestedKeys.filter(key => key !== PRODUCTION_CONTEXT_KEYS.samples && !marker(next, key))
  const fingerprint = unmarked.length ? await cuttingRecordFingerprint('null') : ''
  const targetFingerprint = unmarked.length ? await recordsFingerprint([]) : ''
  initializationRecords = unmarked.map(key => markerRow({ key, fingerprint, targetFingerprint, phase: 'COMPLETE', count: 0, copied: 0, ids: [] }))
  const changed = requestedKeys.filter(key => forceNotify || !preparedKeys.has(key) || serialized.get(key) !== values.get(key))
  for(const key of keys)if(!values.has(key))serialized.delete(key)
  for (const [key, value] of values) serialized.set(key, value)
  materializedSampleRows=new Map(visibleRecords.filter(item=>['production-context:samples','production-context:sample-commands','production-context:sample-meta'].includes(item.collection)).map(item=>[item.id,item]))
  sampleSerializationDirty=false
  current = next
  preparedKeys=new Set(requestedKeys)
  try { for (const key of changed) for (const callback of listeners.get(key) || []) callback() }
  catch (error) { current = null; serialized.clear();materializedSampleRows.clear();sampleSerializationDirty=false; initializationRecords = []; throw error }
}
export function hydrateProductionContextRecords(snapshot?: CuttingRecordSnapshot): Promise<void> {
  // Repeated route preparation may share the exact same in-flight snapshot.
  // An ordinary read never joins an explicit snapshot, and writes/migrations
  // retain their original lock.
  if (pendingReadHydration && pendingReadHydration.snapshot === snapshot) return pendingReadHydration.promise
  if (locked) return Promise.reject(new Error('生产来源正在保存或迁移，请等待当前动作完成。'))
  locked = true
  let loading!: Promise<void>
  loading = (async () => {
    try { await hydrate(snapshot?.readScope ? undefined : snapshot) }
    catch (error) { current = null; throw error }
    finally {
      locked = false
      if (pendingReadHydration?.promise === loading) pendingReadHydration = undefined
    }
  })()
  pendingReadHydration = { snapshot, promise: loading }
  return loading
}
/** A bounded read view for original finishing pages. A sample consumer or any
 * production command upgrades to the complete original source before use. */
export async function hydratePostFinishingProductionContextRecords(snapshot?:CuttingRecordSnapshot):Promise<void> {
  if(locked)throw new Error('生产来源正在保存或迁移，请等待当前动作完成。')
  // Never downgrade a previously exposed sample source or leave its listeners stale.
  if(preparedKeys.has(PRODUCTION_CONTEXT_KEYS.samples)){
    await hydrateProductionContextRecords();return
  }
  locked=true
  try{
    const needed=keys.filter(key=>key!==PRODUCTION_CONTEXT_KEYS.samples)
    if(!snapshot && current && needed.every(key=>preparedKeys.has(key)) && await readCuttingRecordRevision()===current.revision){assertLegacyReady(current);return}
    await hydrate(snapshot || await readPostFinishingProductionRecords(),false,needed)
  }
  catch(error){current=null;throw error}
  finally{locked=false}
}
function restoreWithoutPersist<T>(restore: (value: unknown) => void, value: T, values: Map<string, string | null>): void {
  const prior = stage
  stage = new Map(values)
  try { restore(structuredClone(value)) } finally { stage = prior }
}
/** 锁覆盖准备、事务与发布；回滚写入隔离暂存，complete前业务内存保持原值。 */
export async function saveProductionContextAction<T>(input: {
  id?: string; intent: string; action: () => T; capture: () => unknown; restore: (value: unknown) => void
  prepareChange?: (result:T)=>CuttingRecordChange; assertAdditionalSourcesCurrent?:()=>void
  prepareSnapshot?: (snapshot:CuttingRecordSnapshot)=>Promise<void>
}): Promise<T> {
  if (locked) throw new Error('另一项生产确认尚未完成，请稍后重试。')
  locked = true
  let before: unknown; let captured = false; let committed = false
  const id = input.id || `PRODUCTION-CONTEXT:${cuttingRecordUuid()}`
  try {
    await hydrate()
    await input.prepareSnapshot?.(current!)
    if (!input.intent.trim()) throw new Error('生产确认内容标识缺失。')
    const intent=`production-source:${await cuttingRecordFingerprint(input.intent)}`
    const previous = await readCuttingCommand(id)
    if (previous) {
      if (previous.intent !== intent) throw new Error('本次确认编号已用于不同内容，请重新核对。')
      await hydrate(undefined, true); return (await materializeContextFiles([{id:'command-result',collection:'command-result',value:previous.result}],false))[0].value as T
    }
    flushSampleSerialization()
    const snapshot = current!, original = new Map(serialized)
    before = structuredClone(input.capture()); captured = true
    const working = new Map(original)
    stage = working
    let result: T; let after: unknown; let additional:CuttingRecordChange={puts:[]}
    try {
      result = input.action()
      if (result && typeof (result as { then?: unknown }).then === 'function') throw new Error('生产动作必须先完成同步计算再保存。')
      additional=input.prepareChange?.(result) || {puts:[]}
      after = structuredClone(input.capture())
    } finally { stage = null; restoreWithoutPersist(input.restore, before, original) }
    const prepared=await prepareContextFiles([...keys.flatMap(key=>decodeProductionContextRecords(key,working.get(key) ?? null)),{id:'command-result',collection:'command-result',value:result}])
    const persistedResult=prepared.records.pop()!.value as T
    const change = {...diffCuttingRecords(snapshot.records.filter(item => item.collection.startsWith(prefix)),prepared.records),files:prepared.files}
    change.puts.push(...additional.puts);change.deletes=[...(change.deletes || []),...(additional.deletes || [])];change.files.push(...(additional.files || []))
    const unmarked = migratableKeys.filter(key => !marker(snapshot, key))
    change.puts.push(...productionContextInitializationRecords())
    const saved = await commitCuttingRecords({ revision: snapshot.revision, change, command: { id, intent, result:persistedResult, at: new Date().toISOString() },
      assertSourcesCurrent: () => { input.assertAdditionalSourcesCurrent?.();if (isBrowserContext()) for (const key of unmarked) if (legacyValue(key) !== null) throw new ProductionContextReadError('旧页面写入了生产来源，请先迁移，本次未保存。') } })
    committed = true
    if (!saved.replayed) restoreWithoutPersist(input.restore, after, working)
    await hydrate(undefined, true)
    return (await materializeContextFiles([{id:'command-result',collection:'command-result',value:saved.result}],false))[0].value as T
  } catch (error) {
    if (captured && !committed) restoreWithoutPersist(input.restore, before, serialized)
    if (committed) throw new Error(`生产记录已保存，但页面同步失败，请重新进入页面核对，不要重复新建。${String(error)}`)
    throw error
  } finally { stage = null; locked = false }
}

export interface ProductionSampleActionState {
  records:Array<[string,unknown]>
  commands:Array<[string,{assignmentId:string;action:string}]>
  sequence:number
}
function sampleActionRecords(state:ProductionSampleActionState):CuttingStoredRecord[] {
  return decodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.samples,JSON.stringify({version:3,records:state.records.map(([,value])=>value),commands:state.commands,sequence:state.sequence}))
}
function sampleActionState(rows:CuttingStoredRecord[]):ProductionSampleActionState {
  const raw=encodeProductionContextRecords(PRODUCTION_CONTEXT_KEYS.samples,rows)
  if(!raw)throw new Error('本次样衣保存结果缺失，请重新进入页面核对。')
  const value=JSON.parse(raw)
  return {records:value.records.map((record:Json)=>[record.assignmentId,record]),commands:value.commands,sequence:value.sequence}
}
/** Only the original PP sample page uses this bounded action. Other production
 * actions keep their existing full-context contract and read the same rows. */
export async function saveProductionSampleContextAction<T>(input:{id:string;intent:string;commandId:string;
  capture:()=>ProductionSampleActionState;restore:(state:ProductionSampleActionState)=>void;action:()=>T}):Promise<T> {
  if(locked)throw new Error('另一项生产确认尚未完成，请稍后重试。')
  locked=true
  let before:ProductionSampleActionState|undefined,committed=false
  try{
    if(!isProductionContextReady())await hydrate()
    const snapshot=current!
    assertLegacyReady(snapshot)
    if(!input.id || !input.commandId || !input.intent.trim())throw new Error('本次样衣确认标识缺失。')
    const intent=`production-source:${await cuttingRecordFingerprint(input.intent)}`
    const [previous,revision]=await Promise.all([readCuttingCommand(input.id),readCuttingRecordRevision()])
    if(previous){
      if(previous.intent!==intent)throw new Error('本次确认编号已用于不同内容，请重新核对。')
      await hydrate(undefined,true)
      return (await materializeContextFiles([{id:'command-result',collection:'command-result',value:previous.result}],false))[0].value as T
    }
    if(revision!==snapshot.revision)throw new Error('其他页面已更新生产记录。本次未保存，请刷新并重新核对后确认。')
    before=input.capture()
    const recordIds=new Set(before.records.map(([id])=>id))
    if(!recordIds.size || recordIds.size!==before.records.length || before.commands.some(([id])=>id!==input.commandId))throw new Error('本次样衣保存范围不完整。')
    let result:T,after:ProductionSampleActionState
    try{
      result=input.action()
      if(result && typeof (result as {then?:unknown}).then==='function')throw new Error('样衣动作必须先完成同步计算再保存。')
      after=input.capture()
      if(after.records.some(([id])=>!recordIds.has(id)) || after.commands.some(([id])=>id!==input.commandId))throw new Error('本次样衣确认包含其他任务记录，尚未保存。')
    }finally{input.restore(before)}
    const prepared=await prepareContextFiles([...sampleActionRecords(after),{id:'command-result',collection:'command-result',value:result}])
    const persistedResult=prepared.records.pop()!.value as T
    const managedIds=new Set([...recordIds].map(id=>`production-context:samples:${id}`))
    managedIds.add(`production-context:sample-commands:${input.commandId}`);managedIds.add('production-context:sample-meta:sequence')
    const change=diffCuttingRecords(snapshot.records.filter(item=>managedIds.has(item.id)),prepared.records)
    change.files=prepared.files;change.puts.push(...productionContextInitializationRecords())
    const unmarked=migratableKeys.filter(key=>!marker(snapshot,key))
    const saved=await commitCuttingRecords({revision:snapshot.revision,change,command:{id:input.id,intent,result:persistedResult,at:new Date().toISOString()},assertSourcesCurrent:()=>{
      if(isBrowserContext())for(const key of unmarked)if(legacyValue(key)!==null)throw new ProductionContextReadError('旧页面写入了生产来源，请先迁移，本次未保存。')
    }})
    committed=true
    if(saved.replayed){await hydrate(undefined,true);return (await materializeContextFiles([{id:'command-result',collection:'command-result',value:saved.result}],false))[0].value as T}
    const visible=await materializeContextFiles([...prepared.records,{id:'command-result',collection:'command-result',value:saved.result}],false)
    const normalizedResult=visible.pop()!.value as T
    const normalizedState=sampleActionState(visible)
    input.restore(normalizedState)
    const rows=new Map(snapshot.records.map(item=>[item.id,item]))
    for(const id of change.deletes || []){rows.delete(id);materializedSampleRows.delete(id)}
    for(const item of change.puts)rows.set(item.id,item)
    for(const item of visible)materializedSampleRows.set(item.id,item)
    current={revision:saved.revision,records:[...rows.values()]}
    initializationRecords=[];sampleSerializationDirty=true
    return normalizedResult
  }catch(error){
    if(before&&!committed)input.restore(before)
    if(committed){current=null;throw new Error(`样衣记录已保存，但页面同步失败，请重新进入页面核对，不要重复新建。${String(error)}`)}
    throw error
  }finally{locked=false}
}
function markerRow(value: MigrationMarker): CuttingStoredRecord { return { id: `source-migration:${value.key}`, collection: migrationCollection, value } }
async function recordsFingerprint(records: CuttingStoredRecord[]): Promise<string> { return cuttingRecordFingerprint(JSON.stringify([...records].sort((a, b) => a.id.localeCompare(b.id)))) }
async function verifyMarker(snapshot: CuttingRecordSnapshot, saved: MigrationMarker): Promise<void> {
  const byId = new Map(snapshot.records.map(item => [item.id, item]))
  const rows = saved.ids.map(id => byId.get(id))
  for(const id of new Set(rows.filter(Boolean).flatMap(item=>productionContextFileIds(item!.value)))) {
    const blob=await readCuttingRecordFile(id)
    if(!blob || `production-context-file:${await cuttingRecordBytesFingerprint(new Uint8Array(await blob.arrayBuffer()))}`!==id) throw new Error('迁移附件读回缺失或字节不一致，旧源未清理。')
  }
  if (rows.some(item => !item) || await recordsFingerprint(rows as CuttingStoredRecord[]) !== saved.targetFingerprint) throw new Error('生产来源读回不一致，旧源未清理；请核对冲突后重试。')
}
/** 显式迁移：每批最多100个实体；断点与批次同事务，清理前读回完整校验。 */
export async function migrateProductionContextRecords(input: { otherPagesClosed: boolean; progress: (text: string) => void }): Promise<number> {
  if (!input.otherPagesClosed) throw new Error('请先关闭其他 HiGood 页面并勾选确认，旧来源未清理。')
  if (locked) throw new Error('生产来源正在保存或迁移，请等待当前动作完成。')
  locked = true
  current = null
  let count = 0
  try {
    for (const key of migratableKeys) {
      let snapshot = await readCuttingRecords()
      let saved = marker(snapshot, key)
      const raw = legacyValue(key)
      if (saved?.phase === 'COMPLETE') {
        if (raw !== null) throw new Error('已完成迁移的旧生产来源再次出现，请关闭旧页面并核对；未删除重新写入的数据。')
        continue
      }
      if (raw === null && saved?.phase === 'COPYING') throw new Error('迁移尚未核对完成但旧源已缺失，请从备份恢复旧源后继续。')
      const prepared=await prepareContextFiles(raw === null ? [] : decodeProductionContextRecords(key,raw))
      const records = prepared.records
      const fingerprint = raw === null && saved ? saved.fingerprint : await cuttingRecordFingerprint(raw ?? 'null')
      if (saved && saved.fingerprint !== fingerprint) throw new Error('旧页面改变了生产来源，迁移暂停，源记录保留。')
      saved ||= { key, fingerprint, phase: 'COPYING', count: records.length, copied: 0, ids: records.map(item => item.id), targetFingerprint: await recordsFingerprint(records) }
      const assertSource = () => { if (legacyValue(key) !== raw) throw new Error('旧页面改变了生产来源，迁移暂停，源记录保留。') }
      if (raw !== null) {
        for (let offset = 0; offset < records.length; offset += 100) {
          assertSource(); snapshot = await readCuttingRecords()
          const byId = new Map(snapshot.records.map(item => [item.id, item]))
          const batch = records.slice(offset, offset + 100)
          for (const item of batch) if (byId.has(item.id) && JSON.stringify(byId.get(item.id)) !== JSON.stringify(item)) throw new Error('生产来源与本机版本冲突，未覆盖或清理。')
          saved = { ...saved, phase: 'COPYING', copied: Math.max(saved.copied, offset + batch.length) }
          await commitCuttingRecords({ revision: snapshot.revision, change: { puts: [...batch.filter(item => !byId.has(item.id)), markerRow(saved)], files:prepared.files.filter(file=>batch.some(item=>productionContextFileIds(item.value).includes(file.id))) }, assertSourcesCurrent: assertSource,
            command: { id: `SOURCE-MIGRATION:${key}:${fingerprint}:${offset}`, intent: fingerprint, result: batch.length, at: new Date().toISOString() } })
          input.progress(`生产来源迁移：${saved.copied} / ${saved.count} 条，旧源仍保留。`)
        }
      }
      snapshot = await readCuttingRecords(); await verifyMarker(snapshot, saved); assertSource()
      if (raw !== null || saved.phase !== 'VERIFIED') {
        saved = { ...saved, phase: 'VERIFIED', copied: saved.count }
        await commitCuttingRecords({ revision: snapshot.revision, change: { puts: [markerRow(saved)] }, assertSourcesCurrent: assertSource,
          command: { id: `SOURCE-MIGRATION:${key}:${fingerprint}:verified`, intent: fingerprint, result: saved.count, at: new Date().toISOString() } })
      }
      assertSource()
      if (raw !== null) localStorage.removeItem(key)
      if (legacyValue(key) !== null) throw new Error('旧页面重新写回生产来源，迁移未完成。')
      snapshot = await readCuttingRecords(); await verifyMarker(snapshot, saved)
      const complete = { ...saved, phase: 'COMPLETE' as const, copied: saved.count }
      await commitCuttingRecords({ revision: snapshot.revision, change: { puts: [markerRow(complete)] },
        assertSourcesCurrent: () => { if (legacyValue(key) !== null) throw new Error('旧生产来源重新出现，迁移尚未完成。') },
        command: { id: `SOURCE-MIGRATION:${key}:${fingerprint}:complete`, intent: fingerprint, result: saved.count, at: new Date().toISOString() } })
      if (legacyValue(key) !== null) throw new Error('旧页面重新写回生产来源，请关闭旧页面并核对。')
      count += saved.count
    }
    inspectedEmptyKeys.clear()
    await hydrate(undefined, true)
    input.progress(`生产来源已读回核对并完成迁移，本次处理 ${count} 条，旧源已清理。`)
    return count
  } finally { locked = false }
}
