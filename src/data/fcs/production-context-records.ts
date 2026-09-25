import { validateProductionCreatedProcessSources } from './production-created-process-source-types.ts'
import { cuttingRecordUuid, cuttingRecordFingerprint, cuttingRecordBytesFingerprint } from './cutting/cutting-record-identity.ts'
import { readCuttingRecords, readCuttingCommand, commitCuttingRecords, diffCuttingRecords, type CuttingStoredRecord, type CuttingRecordSnapshot, type CuttingRecordChange, readCuttingRecordFile } from './cutting/cutting-record-repository.ts'

/** 换片布及裁片交出使用的上游事实，复用同一数据库和版本。 */
export const PRODUCTION_CONTEXT_KEYS = {
  orders: 'higood.formal-created-production-orders.v1',
  runtime: 'higood.runtime-process-task-actions.v1',
  assignments: 'higood.effective-task-assignments.v2',
  samples: 'higood:sewing-sample-approval:v3',
  contracts: 'higood:fcs:production-contracts:v2',
  effects: 'higood.production-assignment-effects.v1',
  responsibility:'higood.sewing-task-responsibility-transfers.v1',
} as const
const keys: string[] = Object.values(PRODUCTION_CONTEXT_KEYS)
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
  else if (key === PRODUCTION_CONTEXT_KEYS.samples) {
    if (data.version !== 3) fail('样衣来源版本不支持')
    sequence(data.sequence)
    result = list(data.records).map(value => {
      if (!object(value) || !text(value.assignmentId) || !object(value.sample) || value.sample.assignmentId !== value.assignmentId || !text(value.sample.sampleId) || !Array.isArray(value.suggestionVersions)) fail('样衣身份或版本记录错误')
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
  if (key === PRODUCTION_CONTEXT_KEYS.contracts) return ['contracts','contract-audit','contract-meta']
  if(key===PRODUCTION_CONTEXT_KEYS.responsibility) return ['responsibility-transfers','responsibility-meta']
  return ['assignment-effects']
}
export function encodeProductionContextRecords(key: string, records: CuttingStoredRecord[]): string | null {
  const names = collections(key).map(name => prefix + name)
  const selected = records.filter(item => names.includes(item.collection))
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
  async function visit(value:unknown):Promise<unknown> {
    if(typeof value === 'string') {
      const existing=urlFiles.get(value)
      if(existing) return {$productionFile:existing}
      if(value.startsWith('blob:')) throw new Error('附件预览已失效，请重新选择文件后保存。')
      if(value.startsWith('data:')) {
        const response=await fetch(value),blob=await response.blob()
        const bytes=await blob.arrayBuffer()
        const hash=await cuttingRecordBytesFingerprint(new Uint8Array(bytes))
        const id=`production-context-file:${hash}`
        const saved=await readCuttingRecordFile(id)
        if(!saved) files.set(id,blob)
        else if(saved.size!==blob.size) throw new Error('附件身份冲突，原文件未覆盖。')
        return {$productionFile:id}
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
  return {records:await Promise.all(records.map(async record=>({...record,value:await visit(record.value)}))),files:[...files].map(([id,blob])=>({id,blob}))}
}
async function materializeContextFiles(records:CuttingStoredRecord[],revokeUnused=true):Promise<CuttingStoredRecord[]> {
  async function visit(value:unknown):Promise<unknown> {
    if(fileReference(value)) {
      if(!fileUrls.has(value.$productionFile)) {
        const blob=await readCuttingRecordFile(value.$productionFile)
        if(!blob) throw new ProductionContextReadError('生产关联附件缺失，请保留现有数据并导入完整备份。')
        const url=URL.createObjectURL(blob);fileUrls.set(value.$productionFile,url);urlFiles.set(url,value.$productionFile)
      }
      return fileUrls.get(value.$productionFile)
    }
    if(Array.isArray(value)) return Promise.all(value.map(visit))
    if(object(value)) return Object.fromEntries(await Promise.all(Object.entries(value).map(async ([key,item])=>[key,await visit(item)])))
    return value
  }
  const result=await Promise.all(records.map(async record=>({...record,value:await visit(record.value)})))
  const referenced=new Set(records.flatMap(record=>productionContextFileIds(record.value)))
  for(const [id,url] of fileUrls) if(revokeUnused && !referenced.has(id)) { URL.revokeObjectURL(url);fileUrls.delete(id);urlFiles.delete(url) }
  return result
}

let current: CuttingRecordSnapshot | null = null
let stage: Map<string, string | null> | null = null
let locked = false
const listeners = new Map<string, Set<() => void>>()
const serialized = new Map<string, string | null>()
const inspectedEmptyKeys = new Set<string>()
let initializationRecords: CuttingStoredRecord[] = []
/** 只供已有裁床动作合并到同一事务；普通读取绝不写入初始化记录。 */
export function productionContextInitializationRecords(): CuttingStoredRecord[] {
  if (!current) throw new ProductionContextReadError('生产来源尚未读取，不能创建来源初始化记录。')
  return structuredClone(initializationRecords)
}
export function assertProductionContextLegacyUnchanged(): void {
  if (!current) throw new ProductionContextReadError('生产来源尚未读取，请重新进入页面。')
  if (isBrowserContext()) for (const item of initializationRecords) {
    if (legacyValue((item.value as MigrationMarker).key) !== null) throw new ProductionContextReadError('旧页面写入了生产来源，请先迁移，本次未保存。')
  }
}
export function onProductionContextChanged(key: string, callback: () => void): void {
  assertKey(key); const group = listeners.get(key) || new Set(); group.add(callback); listeners.set(key, group)
}
export function isProductionContextReady(): boolean { return current !== null }
export function isProductionContextStaged(): boolean { return stage !== null }
export function readProductionContextValue(key: string): string | null {
  assertKey(key)
  if (stage) return stage.get(key) ?? null
  if (current) return serialized.get(key) ?? null
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
  try { return localStorage.getItem(key) } catch { throw new ProductionContextReadError('旧生产来源无法检查，请允许读取本机旧数据后迁移；未将无法读取当作空数据。') }
}
export interface ProductionContextMigrationStatus { key: string; phase: 'PENDING' | 'COPYING' | 'VERIFIED' | 'COMPLETE' | 'EMPTY' | 'UNAVAILABLE'; count: number; copied: number; message: string }
export async function listProductionContextMigrationStatus(): Promise<ProductionContextMigrationStatus[]> {
  const snapshot = await readCuttingRecords()
  return keys.map(key => {
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
  for (const key of keys) {
    const saved = marker(snapshot, key)
    if (saved?.phase === 'COMPLETE') continue
    if (saved) throw new ProductionContextReadError('生产来源迁移尚未完成，请在数据管理中继续迁移；未使用部分记录。')
    if (inspectedEmptyKeys.has(key)) continue
    if (legacyValue(key) !== null) throw new ProductionContextReadError('发现旧生产来源，请先完成显式迁移；未使用空记录覆盖。')
    inspectedEmptyKeys.add(key)
  }
}
async function hydrate(snapshot?: CuttingRecordSnapshot, forceNotify = false): Promise<void> {
  const next = snapshot || await readCuttingRecords()
  assertLegacyReady(next)
  if (current?.revision === next.revision && !forceNotify) return
  const visibleRecords=await materializeContextFiles(next.records.filter(item=>item.collection.startsWith(prefix)))
  const values = new Map(keys.map(key => [key, encodeProductionContextRecords(key, visibleRecords)]))
  const unmarked = keys.filter(key => !marker(next, key))
  const fingerprint = unmarked.length ? await cuttingRecordFingerprint('null') : ''
  const targetFingerprint = unmarked.length ? await recordsFingerprint([]) : ''
  initializationRecords = unmarked.map(key => markerRow({ key, fingerprint, targetFingerprint, phase: 'COMPLETE', count: 0, copied: 0, ids: [] }))
  const changed = keys.filter(key => forceNotify || serialized.get(key) !== values.get(key))
  for (const [key, value] of values) serialized.set(key, value)
  current = next
  try { for (const key of changed) for (const callback of listeners.get(key) || []) callback() }
  catch (error) { current = null; serialized.clear(); initializationRecords = []; throw error }
}
export async function hydrateProductionContextRecords(snapshot?: CuttingRecordSnapshot): Promise<void> {
  if (locked) throw new Error('生产来源正在保存或迁移，请等待当前动作完成。')
  locked = true
  try { await hydrate(snapshot) } catch (error) { current = null; throw error } finally { locked = false }
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
    const unmarked = keys.filter(key => !marker(snapshot, key))
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
    for (const key of keys) {
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
