import { commitPcsNewRecordGroups, commitPcsRecords, readPcsRecords, readPcsRecordProjection, pcsFileReferences, type PcsStoredRecord, type PcsRecordReadSelection } from '../pcs-record-db.ts'

// Reuse the existing record/Blob transaction engine. Only this namespace is read
// or changed; PCS records and files are never reset by this module.
const namespace = 'higood-fcs-post-finishing-records'
const revisionId = `${namespace}/revision`
interface Repository { read: () => unknown; replace: (value: any) => void }
const repositories = new Map<string, Repository>()
const seeds = new Map<string, unknown>()
let stored = new Map<string, PcsStoredRecord>()
let saving = false
let ready = false
let cachedReadAvailable = false
let cachedReferenceFreeValues: WeakSet<object> | undefined
const pendingRepositoryScopes = new Set<string>()
let failure = ''
let preparing: Promise<void> | undefined
let demoDepth = 0
interface ExecutionReadScope { key:string; tokens:string[] }
let requestedReadScope:ExecutionReadScope|null=null
let cachedReadScopeKey='FULL'
let preparingScopeKey='FULL'
const recordValidators: Array<() => void> = []
type MaterialRecord = Pick<PcsStoredRecord, 'id' | 'collection' | 'value' | 'deleted'>
const readOnlyMaterialChecks: Array<(row: MaterialRecord) => boolean> = []
const commitProjections: Array<() => void> = []
const uploads = new Map<string, Blob>()
const fileUrls = new Map<string, string>()
const urlIds = new Map<string, string>()
const persistedFiles = new Set<string>()
const copy = <T>(value: T): T => structuredClone(value)
const fixedSnapshotRoots = new WeakSet<object>()
function isInspectionSnapshot(value: any): value is Record<string, any> {
  return !!value && typeof value.id === 'string' && typeof value.selectedAt === 'string' && Number.isInteger(value.configRevision)
    && !!value.context?.sourceKind && typeof value.basicStandard?.id === 'string' && Array.isArray(value.additionalStandards)
    && Array.isArray(value.items) && Array.isArray(value.references) && ('ruleSnapshot' in value)
}
function freezeSnapshotTree(value:object,states=new Map<object,'visiting'|'fixed'>()):void {
 const array=Array.isArray(value)
 if(!array){const prototype=Object.getPrototypeOf(value);if(prototype!==Object.prototype&&prototype!==null)throw new Error('固定质检标准含无法保护的资料类型，原记录保留，请核对。')}
 const children:object[]=[]
 for(const key of Object.keys(value)){
  const child=(value as Record<string,unknown>)[key]
  if(!child||typeof child!=='object')continue
  if(Array.isArray(child)&&child.length===0){let empty=true;for(const own in child)if(Object.hasOwn(child,own)){empty=false;break}if(empty){Object.freeze(child);continue}}
  children.push(child)
 }
 if(!children.length){Object.freeze(value);return}
 const state=states.get(value);if(state==='fixed')return;if(state==='visiting')throw new Error('固定质检标准含循环资料，原记录保留，请核对。')
 states.set(value,'visiting');for(const child of children)freezeSnapshotTree(child,states);Object.freeze(value);states.set(value,'fixed')
}
function protectInspectionSnapshots(values = snapshots(false)): void {
  const flow=values.get('flow') as {qcTasks?:Array<{inspection?:{snapshot?:unknown};independentChecks?:Array<{snapshot?:unknown}>}>}|undefined
  for (const task of flow?.qcTasks || []) for (const snapshot of [task.inspection?.snapshot,...(task.independentChecks || []).map(check=>check.snapshot)]) if (isInspectionSnapshot(snapshot)) {
    if (fixedSnapshotRoots.has(snapshot)) continue
    freezeSnapshotTree(snapshot);fixedSnapshotRoots.add(snapshot)
  }
}
/** Rollback copies mutable facts; genuinely frozen inspection trees are safe
 * shared references. Unknown/non-JSON values retain structuredClone behavior. */
function copyMutable<T>(value:T, seen=new WeakMap<object,unknown>()):T {
  if (!value || typeof value!=='object') return value
  if (fixedSnapshotRoots.has(value)) return value
  if (seen.has(value)) return seen.get(value) as T
  const prototype=Object.getPrototypeOf(value)
  if (!Array.isArray(value) && prototype!==Object.prototype && prototype!==null) return copy(value)
  const result:any=Array.isArray(value)?[]:Object.create(prototype)
  seen.set(value,result)
  for (const [key,item] of Object.entries(value)) {
    const cloned=copyMutable(item,seen)
    if(key==='__proto__')Object.defineProperty(result,key,{value:cloned,writable:true,enumerable:true,configurable:true})
    else result[key]=cloned
  }
  return result
}
function sameRecordValue(left:any,right:any,seen=new WeakMap<object,object>()):boolean {
  if (left===right) return true
  if (!left || !right || typeof left!=='object' || typeof right!=='object') return false
  if (Array.isArray(left)!==Array.isArray(right) || Object.getPrototypeOf(left)!==Object.getPrototypeOf(right)) return false
  const prototype=Object.getPrototypeOf(left)
  if (!Array.isArray(left) && prototype!==Object.prototype && prototype!==null) return JSON.stringify(left)===JSON.stringify(right)
  if (seen.get(left)===right) return true
  seen.set(left,right)
  const keys=Object.keys(left),other=Object.keys(right)
  return keys.length===other.length && keys.every(key=>Object.hasOwn(right,key) && sameRecordValue(left[key],right[key],seen))
}
const primaryIds: Record<string, string> = {
  logs: 'logId', references: 'referenceId', authorizations: 'authorizationId',
  deliveries: 'deliveryId', waitProcessWarehouseRecords: 'warehouseRecordId', waitProcessWarehouseMovements: 'movementId',
  waitHandoverWarehouseRecords: 'warehouseRecordId', waitHandoverWarehouseMovements: 'movementId',
  processCompletions: 'recordId', returnConfirmationVersions: 'confirmationVersionId', qcTasks: 'qcTaskId', postTasks: 'postTaskId',
  fullCoverages: 'coverageId', recheckOrders: 'recheckOrderId', outboundOrders: 'outboundOrderId', warehouseReceipts: 'receiptId',
  defects: 'defectId', materialTransferOrders: 'transferOrderId', materialStocks: 'stockId', warehouseLocationMoves: 'moveId',
  ppicPromises: 'promiseId', ppicMakeups: 'makeupId', ppicAllocations: 'allocationId',
  ppicConfirmations: 'confirmationId', ppicConfigs: 'configId', ppicBases: 'basisId',
  ppicActions: 'actionId', ppicEvaluations: 'evaluationId',
  destinations: 'sourceId', changes: 'id',
}
const recordKey = (scope: string, collection: string, row: any): string => {
  if (row.kind && row.idempotencyKey) return `${row.kind}:${row.idempotencyKey}`
  const first = primaryIds[scope] || primaryIds[collection]
  if (!first || !row[first]) throw new Error('后道记录缺少稳定编号，未保存。')
  return String(row[first])
}
function flatten(scope: string, value: any): Map<string, { collection: string; value: unknown }> {
  const rows = new Map<string, { collection: string; value: unknown }>()
  const add = (collection: string, row: unknown, id: string) => {
    const key = `${namespace}/${scope}/${collection}/${encodeURIComponent(id)}`
    if (rows.has(key)) throw new Error('后道记录编号重复，未保存。')
    rows.set(key, { collection: `${scope}/${collection}`, value: row })
  }
  if (Array.isArray(value)) value.forEach(row => add('records', row, recordKey(scope, 'records', row)))
  else for (const [collection, items] of Object.entries(value)) {
    if (Array.isArray(items)) items.forEach(row => add(collection, row, recordKey(scope, collection, row)))
    else if (items !== undefined) add(collection, items, 'value')
  }
  return rows
}
function allRows(snapshots: Map<string, unknown>) {
  return new Map([...snapshots].flatMap(([scope, value]) => [...flatten(scope, value)]))
}
function snapshots(cloneValues = true, shareFixed = true): Map<string, unknown> { return new Map([...repositories].map(([scope, repo]) => [scope, cloneValues ? shareFixed ? copyMutable(repo.read()) : copy(repo.read()) : repo.read()])) }
// Every registered replace callback assigns its repository value. Transfer the
// detached snapshot instead of cloning the whole factory history again. A
// command still clones its rollback basis once before any domain mutation.
function restore(values: Map<string, unknown>): void { for (const [scope, value] of values) repositories.get(scope)?.replace(value) }

export function registerPostFinishingRepository(scope: string, read: () => unknown, replace: (value: any) => void): void {
  const previous=repositories.get(scope)
  // Replacing an existing consumer must read native truth again: its previous
  // mutable value can share a version-cache alias with a failed candidate.
  if (previous && (previous.read!==read || previous.replace!==replace)) { ready=false; cachedReadAvailable=false }
  repositories.set(scope, { read, replace })
  if (!seeds.has(scope) && (seeds.size || ready)) { seeds.set(scope, copy(read())); ready = false; pendingRepositoryScopes.add(scope) }
}
/** Read the original static baseline without hydrating or cloning saved execution history.
 * The projection must be pure; returned rows are immediately reduced by the caller. */
export function projectPostFinishingStaticRecords<T>(scope:string, project:(row:PcsStoredRecord)=>T):T[] {
  const original=seeds.get(scope) ?? repositories.get(scope)?.read()
  if(!original)return []
  return [...flatten(scope,original)].map(([id,row])=>project({id,...row,version:0}))
}
/** 业务动作的必要关联结果在同一个PCS事务中提交，不在读取时写回。 */
export function registerPostFinishingCommitProjection(recipe: () => void): void { commitProjections.push(recipe) }
export function registerPostFinishingRecordValidator(recipe: () => void): void { recordValidators.push(recipe) }
export function registerPostFinishingReadOnlyMaterialCheck(check: (row: MaterialRecord) => boolean): void { readOnlyMaterialChecks.push(check) }
const isReadOnlyMaterial = (row: MaterialRecord) => readOnlyMaterialChecks.some(check => check(row))
const isMaterialRecord = (row: MaterialRecord) => /\/flow\/(materialTransferOrders|materialStocks)\//.test(row.id)
async function prepareMaterialReadBoundary(needed: boolean): Promise<void> {
  if (needed) await (await import('../wls/accessory-warehouse-post-finishing.ts')).prepareAccessoryPostFinishing()
}
async function sourceFingerprint(value: unknown): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)))
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

function applyCandidateRecords(rows: Array<Pick<PcsStoredRecord, 'id' | 'collection' | 'value' | 'deleted'>>): void {
  for (const [scope, repo] of repositories) {
    const value: any = copy(seeds.get(scope) ?? repo.read())
    const merged = new Map(flatten(scope, value))
    for (const row of rows.filter(row => row.id.startsWith(`${namespace}/${scope}/`))) {
      // Deletion markers use the shared engine's `deleted` collection and
      // retain the original record identity in id. They must remain deletions.
      if (!row.deleted && !Array.isArray(value) && !Object.keys(value).some(collection => row.collection === `${scope}/${collection}`)) throw new Error('备份含未知事实集合，未导入。')
      if (row.deleted) merged.delete(row.id)
      else merged.set(row.id, { collection: row.collection, value: row.value })
    }
    if (Array.isArray(value)) repo.replace([...merged.values()].map(row => row.value))
    else {
      for (const collection of Object.keys(value)) {
        const items = [...merged.values()].filter(row => row.collection === `${scope}/${collection}`).map(row => row.value)
        value[collection] = Array.isArray(value[collection]) ? items : items[0]
      }
      repo.replace(value)
    }
  }
}
export function mapPostFinishingRepositoryValues(map: (value: unknown) => unknown): void {
  function walk(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(walk)
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, walk(item)]))
    return map(value)
  }
  for (const repo of repositories.values()) repo.replace(walk(repo.read()))
}
export function withPostFinishingDemo<T>(recipe: () => T): T {
  demoDepth++
  try { return recipe() } finally { demoDepth-- }
}
export function assertPostFinishingWrite(): void {
  if (typeof window !== 'undefined' && !demoDepth && !saving) throw new Error('本次修改尚未保存，请通过页面业务动作重试。')
}
export function registerPostFinishingFile(file: Blob, options: { allowPdf?: boolean } = {}): string {
  if (!(file instanceof Blob) || !file.size || file.size > 20 * 1024 * 1024 || (!file.type.startsWith('image/') && !(options.allowPdf && file.type === 'application/pdf'))) throw new Error(options.allowPdf ? '请选择不超过20 MB的纸单图片或PDF。' : '请选择不超过 20 MB 的图片。')
  const id = `pf-${crypto.randomUUID()}`
  uploads.set(id, file)
  const url = URL.createObjectURL(file)
  fileUrls.set(id, url); urlIds.set(url, id)
  return url
}
export function releasePostFinishingPendingFile(url: string): void {
  const id = urlIds.get(url)
  if (!id || persistedFiles.has(id)) return
  URL.revokeObjectURL(url); uploads.delete(id); fileUrls.delete(id); urlIds.delete(url)
}
function durable(value: unknown): unknown {
  if (typeof value === 'string') {
    const id = urlIds.get(value)
    if (id) return `pcs-file:${id}`
    if (value.startsWith('blob:') || value.startsWith('data:')) throw new Error('图片尚未保存，请重新选择图片后重试。')
    return value
  }
  if (Array.isArray(value)) return value.map(durable)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, durable(item)]))
  return value
}
function visible(value: unknown): any {
  if (typeof value === 'string' && value.startsWith('pcs-file:')) {
    const url = fileUrls.get(value.slice(9))
    if (!url) throw new Error('后道附件缺失，用户资料尚未读取，请重新读取。')
    return url
  }
  if (Array.isArray(value)) return value.map(visible)
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visible(item)]))
  return value
}
export function getPostFinishingStorageFailure(): string { return failure }
export async function assertPostFinishingReadVersion(): Promise<void> {
  if (typeof window === 'undefined') return
  if (!ready || failure) throw new Error(failure || '后道资料尚未读取完成。')
  const [freshVersion] = await readPcsRecordProjection([{id:revisionId}],row=>row.version)
  if ((freshVersion || 0) !== (stored.get(revisionId)?.version || 0)) throw new Error('读取期间后道资料已变化，请重新查看。')
}
function validateFlowRecords(records: PcsStoredRecord[], validateRestoredActors = false): void {
  const schema = records.find(row => row.id === `${namespace}/flow/schemaVersion/value` && !row.deleted)
  if (schema && Number(schema.value) !== 5) throw new Error('后道资料版本暂不支持，原资料保留。')
  for (const row of records) {
    if (row.deleted || row.collection !== 'flow/processCompletions') continue
    const record = row.value as any
    if (!record?.recordId || !record.operationId || !record.postTaskId || !['开扣眼', '装扣子', '熨烫', '包装'].includes(record.processItem)
      || !Array.isArray(record.quantities) || record.quantities.some((line: any) => !line.skuId || !Number.isSafeInteger(line.quantity) || (!record.correctionOf && line.quantity < 0))
      || !record.responsible?.actorId || !record.recordedBy?.actorId || !record.recordedAt) throw new Error('加工完成记录格式不完整，原资料保留。')
    // External backups must meet the same actor contract as live registration.
    // This applies only to new item records, never to unknown historical H.
    if (validateRestoredActors && [record.responsible, record.recordedBy].some(actor =>
      typeof actor?.actorId !== 'string' || !actor.actorId.trim() || typeof actor.actorName !== 'string' || !actor.actorName.trim()
      || !['后道操作员', '后道主管'].includes(actor.roleName))) throw new Error('加工责任人或录入人身份不完整，资料未导入。')
  }
}
function restoreReadRepositories(records: PcsStoredRecord[], scopes: Iterable<string>, referenceFreeValues?: WeakSet<object>): void {
  for (const scope of scopes) {
    const repo = repositories.get(scope)!
    const value: any = copy(seeds.get(scope))
    const merged = new Map(flatten(scope, value))
    for (const row of records) if (row.id.startsWith(`${namespace}/${scope}/`)) {
      if (row.deleted) merged.delete(row.id)
      else merged.set(row.id, { collection: row.collection, value: row.value && typeof row.value === 'object' && referenceFreeValues?.has(row.value) ? row.value : visible(row.value) })
    }
    if (Array.isArray(value)) repo.replace([...merged.values()].map(row => row.value))
    else {
      const collections = new Map<string, unknown[]>()
      for (const row of merged.values()) {
        const items = collections.get(row.collection)
        if (items) items.push(row.value)
        else collections.set(row.collection, [row.value])
      }
      for (const collection of Object.keys(value)) {
        const items = collections.get(`${scope}/${collection}`) || []
        value[collection] = Array.isArray(value[collection]) ? items : items[0]
      }
      repo.replace(value)
    }
  }
}
function executionReadScope(href:string):ExecutionReadScope|null {
  const [path,search='']=href.split('?'),params=new URLSearchParams(search)
  const known=path==='/wls/finished/stock/realtime' || path==='/fcs/craft/post-finishing/qc-workbench' || path==='/fcs/craft/post-finishing/print'
    || /^\/fcs\/craft\/post-finishing\/(?:work-orders|outbound-orders)\/[^/]+$/.test(path)
    || path==='/fcs/pda/post-finishing/execute' || path.startsWith('/fcs/pda/exec/PF-POST-')
    || path.startsWith('/fcs/pda/handover/HOH-POST-') || (path==='/fcs/pda/handover' && params.get('tab')==='shipped')
    || (path==='/fcs/print/preview' && ['PRODUCTION_QC_MASTER','POST_FINISHING_QC_ORDER','POST_FINISHING_OUTBOUND_ORDER','POST_FINISHING_OUTBOUND_BARCODE'].includes(params.get('documentType') || ''))
  if(!known)return null
  const values=['taskNo','sourceId','id','postTaskId'].flatMap(key=>(params.get(key)||'').split(',')).filter(Boolean)
  const last=path.split('/').at(-1) || ''
  try{values.push(decodeURIComponent(last))}catch{values.push(last)}
  const tokens=[...new Set(values)].sort()
  return {key:JSON.stringify([path,params.get('type'),params.get('documentType'),params.get('tab'),tokens]),tokens}
}
/** Native history contributes only the identities needed to choose the exact
 * complete QC records. Unselected standard trees never enter a writable view. */
function executionRecordSelection(scope:ExecutionReadScope):PcsRecordReadSelection {
  const qcPrefix=`${namespace}/flow/qcTasks/`,collection='flow/qcTasks'
  const baseline=seeds.get('flow') as {qcTasks?:any[]}|undefined
  const qcConsumers=new Set(['flow/postTasks','flow/outboundOrders','flow/recheckOrders','flow/warehouseReceipts','flow/waitHandoverWarehouseRecords'])
  return {
    excludedPrefix:qcPrefix,
    retain:()=>true,
    async additionalIds(rows,lookup){
      // Native indexes return identities, never copies of unrelated frozen
      // standard trees. Missing-status rows remain in the non-complete set.
      const [all,completed,...byNumber]=await Promise.all([
        lookup.ids(qcPrefix),lookup.idsByField('status',collection,'质检完成'),
        ...scope.tokens.map(token=>lookup.idsByField('qcTaskNo',collection,token)),
      ])
      const available=new Set(all),done=new Set(completed),selected=new Set<string>()
      const addId=(id:string)=>selected.add(qcPrefix+encodeURIComponent(id))
      for(const row of baseline?.qcTasks || [])addId(row.qcTaskId)
      for(const id of all)if(!done.has(id))selected.add(id)
      for(const ids of byNumber)for(const id of ids)if(id.startsWith(qcPrefix))selected.add(id)
      for(const token of scope.tokens){const id=qcPrefix+encodeURIComponent(token);if(available.has(id))selected.add(id)}
      const productions=new Set<string>(),tokens=new Set(scope.tokens)
      const addProduction=(row:any)=>{for(const value of [row.productionOrderId,row.productionOrderNo])if(typeof value==='string' && value)productions.add(value)}
      for(const row of rows)if(!row.deleted && row.value && typeof row.value==='object'){
        const value=row.value as any
        if(qcConsumers.has(row.collection) && typeof value.qcTaskId==='string' && value.qcTaskId)addId(value.qcTaskId)
        if(['productionOrderId','productionOrderNo','deliveryId','deliveryOrderNo','qcTaskId','qcTaskNo','postTaskId','postTaskNo','outboundOrderId','outboundOrderNo'].some(key=>typeof value[key]==='string' && tokens.has(value[key])))addProduction(value)
      }
      const headers=new Map<string,any>((baseline?.qcTasks || []).map(row=>[row.qcTaskId,row]))
      for(const row of await lookup.records([...selected])){
        if(row.deleted){headers.delete(decodeURIComponent(row.id.slice(qcPrefix.length)));continue}
        const value=row.value as any
        // Older retained QC facts can lack a display number. The stable ID
        // still identifies their native record; do not require new fields
        // merely to prepare a read-only execution view.
        if(row.collection!==collection || !value?.qcTaskId || row.id!==qcPrefix+encodeURIComponent(value.qcTaskId))throw new Error('质检记录身份与保存位置不一致，原资料保留，请重新读取。')
        headers.set(value.qcTaskId,value)
      }
      for(const row of headers.values())if([row.qcTaskId,row.qcTaskNo,row.productionOrderId,row.productionOrderNo,row.deliveryId,row.deliveryOrderNo].some(value=>!!value && tokens.has(value)) || row.claimedBy?.actorId && row.status!=='质检完成')addProduction(row)
      for(const ids of await Promise.all([...productions].flatMap(value=>[
        lookup.idsByField('productionOrderId',collection,value),lookup.idsByField('productionOrderNo',collection,value),
      ])))for(const id of ids)if(id.startsWith(qcPrefix))selected.add(id)
      return [...selected]
    },
  }
}
async function readPostFinishingRecordState(scope:ExecutionReadScope|null=null):Promise<void> {
  const scopeKey=scope?.key || 'FULL'
  const before = snapshots(false)
  try {
    if (cachedReadAvailable && !failure && (cachedReadScopeKey==='FULL' || cachedReadScopeKey===scopeKey)) {
      const [revision]=await readPcsRecordProjection([{id:revisionId}],row=>row.version)
      if ((revision || 0)===(stored.get(revisionId)?.version || 0)) {
        if (ready) {return}
        // A later-imported PPIC collection belongs to the same namespace that
        // was already read and file-validated. Restore only those newly
        // registered consumers after checking the native revision again.
        if (pendingRepositoryScopes.size) {
          restoreReadRepositories([...stored.values()], pendingRepositoryScopes, cachedReferenceFreeValues)
          recordValidators.forEach(validate => validate())
          protectInspectionSnapshots()
          pendingRepositoryScopes.clear(); ready = true
          return
        }
      }
    }
    if (!seeds.size) for (const [scope, repo] of repositories) seeds.set(scope, copy(repo.read()))
    const read = await readPcsRecords([namespace],scope ? executionRecordSelection(scope) : undefined)
    validateFlowRecords(read.records)
    stored = new Map(read.records.map(row => [row.id, row]))
    for (const file of read.files) {
      if (!fileUrls.has(file.id)) {
        const url = URL.createObjectURL(file.blob); fileUrls.set(file.id, url); urlIds.set(url, file.id)
      }
      persistedFiles.add(file.id)
    }
    restoreReadRepositories(read.records, repositories.keys(), read.referenceFreeValues)
    recordValidators.forEach(validate => validate())
    protectInspectionSnapshots()
    // Disabled/full localStorage cannot prevent new IndexedDB operations.
    cachedReferenceFreeValues = read.referenceFreeValues
    cachedReadScopeKey=scopeKey
    cachedReadAvailable = true; pendingRepositoryScopes.clear(); ready = true; failure = ''
  } catch (error) {
    cachedReadAvailable = false
    cachedReferenceFreeValues = undefined
    restore(before)
    ready = false; failure = `后道用户资料无法读取或保存。${error instanceof Error ? error.message : String(error)}`
  }
}
export async function ensurePostFinishingRecordState(): Promise<void> {
  return ensurePostFinishingReadScope(null)
}
async function ensurePostFinishingReadScope(scope:ExecutionReadScope|null):Promise<void> {
  if (typeof window==='undefined' || saving) return
  const key=scope?.key || 'FULL'
  while(preparing){const same=preparingScopeKey===key;await preparing;if(same)return}
  requestedReadScope=scope;preparingScopeKey=key
  preparing ||=readPostFinishingRecordState(scope).finally(()=>{preparing=undefined})
  await preparing
}
/** Read-only preparation reuses its original bounded facts; full lists and all
 * maintenance keep the explicit complete entry above. */
export async function ensurePreparedPostFinishingRecordState():Promise<void>{return ensurePostFinishingReadScope(requestedReadScope)}
export async function ensurePostFinishingExecutionRecordState(href:string):Promise<void>{
  const scope=executionReadScope(href)
  await import('./post-finishing-full-flow.ts')
  return ensurePostFinishingReadScope(scope)
}
function translate(error: unknown): Error {
  if (error instanceof Error && 'code' in error) return error
  const message = error instanceof Error ? error.message : String(error)
  if (error instanceof TypeError && /read only|readonly|not extensible|Cannot delete property/i.test(message)) return new Error('本次固定质检标准已经冻结，不能修改；原记录已保留。')
  return new Error(message.replaceAll('PCS', '后道').replace('关联房间或地点', '后道资料'))
}
export type PostFinishingCommitDelta = Pick<Parameters<typeof commitPcsRecords>[0], 'puts' | 'deletes' | 'guards' | 'files'>
/** A directly related business domain contributes records to the SAME PCS transaction. */
export interface PostFinishingCommitParticipant {
  key: string
  prepare(): Promise<void>
  capture(): unknown
  restore(snapshot: any): void
  changes(before: any): PostFinishingCommitDelta
  committed(delta: PostFinishingCommitDelta): void
}
export interface PostFinishingCommandOptions {
  participants?: PostFinishingCommitParticipant[]
  guards?: NonNullable<PostFinishingCommitDelta['guards']>
  operationId?: string
  intent?: string
}
function assertFixedSnapshotIdentities(before:ReturnType<typeof allRows>,after:ReturnType<typeof allRows>):void {
  for (const [id,row] of before) if (row.collection==='flow/qcTasks') {
    const original=row.value as any,next=after.get(id)?.value as any,snapshot=original.inspection?.snapshot
    if (snapshot && fixedSnapshotRoots.has(snapshot) && next?.inspection?.snapshot!==snapshot) throw new Error('已开检的固定质检标准不能替换或删除；原记录已保留。')
    if (original.independentChecks?.length) {
      const checks=new Map((next?.independentChecks || []).map((check:any)=>[check.id,check]))
      for (const check of original.independentChecks) if (check.snapshot && fixedSnapshotRoots.has(check.snapshot) && (checks.get(check.id) as any)?.snapshot!==check.snapshot) throw new Error('既有追检的固定质检标准不能替换或删除；原记录已保留。')
    }
  }
}
export async function runPostFinishingCommand<T>(recipe: () => T, options: PostFinishingCommandOptions = {}): Promise<T> {
  return runPostFinishingRecordCommand(recipe,options)
}
async function runPostFinishingRecordCommand<T>(recipe:()=>T,options:PostFinishingCommandOptions):Promise<T> {
  if (typeof window === 'undefined') return recipe()
  const participants = options.participants || []
  if (new Set(participants.map(row => row.key)).size !== participants.length) throw new Error('关联业务重复提交，本次未保存。')
  for (const participant of participants) await participant.prepare()
  if (!ready) await ensurePreparedPostFinishingRecordState()
  if (!ready || failure) throw new Error(failure || '请重新读取后道资料后重试。')
  if (saving) throw new Error('上一笔操作尚未保存，请等待完成。')
  const before = snapshots()
  const relatedBefore = participants.map(row => row.capture())
  saving = true
  let businessError: unknown
  let committed = false
  try {
    let result: T | undefined
    try { result = recipe() } catch (error) {
      // A blocked domain action may deliberately record counts or an audit
      // event. Save those facts atomically, then report the business gate.
      if (!(error instanceof Error) || !('code' in error)) throw error
      businessError = error
    }
    if (result && typeof (result as any).then === 'function') throw new Error('请先读取文件，再执行后道保存。')
    commitProjections.forEach(recipe => recipe())
    // A recipe may return a repository object. Keep its caller-facing result
    // detached too; copying this small result must happen before any commit.
    const detachedResult = copy(result)
    const after = snapshots(false)
    const relatedAfter = participants.map(row => row.capture())
    const relatedChanges = participants.map((row, index) => row.changes(relatedBefore[index]))
    restore(before)
    participants.forEach((row, index) => row.restore(relatedBefore[index]))
    const oldRows = allRows(before), nextRows = allRows(after)
    assertFixedSnapshotIdentities(oldRows,nextRows)
    protectInspectionSnapshots(after)
    const puts: Parameters<typeof commitPcsRecords>[0]['puts'] = []
    const deletes: Parameters<typeof commitPcsRecords>[0]['deletes'] = []
    for (const [id, row] of nextRows) if (!sameRecordValue(row.value,oldRows.get(id)?.value)) puts.push({ id, collection: row.collection, value: durable(row.value), expectedVersion: stored.get(id)?.version || 0 })
    for (const id of oldRows.keys()) if (!nextRows.has(id)) deletes.push({ id, expectedVersion: stored.get(id)?.version || 0 })
    const relatedPuts = relatedChanges.flatMap(row => row.puts)
    const relatedDeletes = relatedChanges.flatMap(row => row.deletes)
    const guards = [...(options.guards || []), ...relatedChanges.flatMap(row => row.guards || [])]
    if (puts.length || deletes.length || relatedPuts.length || relatedDeletes.length) {
      const refs = new Set(puts.flatMap(row => [...pcsFileReferences(row.value)]))
      const files = [...uploads].filter(([id]) => refs.has(id) && !persistedFiles.has(id)).map(([id, blob]) => ({ id, blob }))
      const expectedVersion = stored.get(revisionId)?.version || 0
      puts.push({ id: revisionId, collection: 'revision', value: { format: 1 }, expectedVersion })
      await commitPcsRecords({ puts: [...puts, ...relatedPuts], deletes: [...deletes, ...relatedDeletes], guards,
        files: [...files, ...relatedChanges.flatMap(row => row.files || [])],
        operationId: options.operationId || `pf-${crypto.randomUUID()}`, intent: options.intent || JSON.stringify({ puts, deletes, relatedPuts, relatedDeletes }) })
      for (const row of puts) { const { expectedVersion: version, ...rest } = row; stored.set(row.id, { ...rest, version: version + 1 }) }
      for (const row of deletes) stored.set(row.id, { id: row.id, collection: 'deleted', value: null, deleted: true, version: row.expectedVersion + 1 })
      files.forEach(file => { persistedFiles.add(file.id); uploads.delete(file.id) })
    } else if (!businessError) {
      await commitPcsRecords({ guards: [{ id: revisionId, expectedVersion: stored.get(revisionId)?.version || 0 }, ...guards], puts: [], deletes: [], operationId: options.operationId || `pf-repeat-${crypto.randomUUID()}`, intent: options.intent || '核对重复后道操作的当前版本' })
    }
    restore(after)
    participants.forEach((row, index) => { row.restore(relatedAfter[index]); row.committed(relatedChanges[index]) })
    committed = true
    if (businessError) throw businessError
    return detachedResult as T
  } catch (error) {
    if (!committed) { restore(before); participants.forEach((row, index) => row.restore(relatedBefore[index])) }
    throw translate(error)
  }
  finally { saving = false }
}

export async function exportPostFinishingBackup(): Promise<Blob> {
  const read = await readPcsRecords([namespace])
  const files = await Promise.all(read.files.map(async file => ({ id: file.id, type: file.blob.type, bytes: Array.from(new Uint8Array(await file.blob.arrayBuffer())) })))
  return new Blob([JSON.stringify({ format: namespace, version: 2, records: read.records, files })], { type: 'application/json' })
}
export async function importPostFinishingBackup(file: File): Promise<void> {
  const backup = JSON.parse(await file.text())
  if (backup.format !== namespace || backup.version !== 2 || !Array.isArray(backup.records) || !Array.isArray(backup.files)) throw new Error('后道备份格式或版本无效。')
  const rows: PcsStoredRecord[] = backup.records
  if (rows.some(row => !row.id?.startsWith(`${namespace}/`)) || new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('备份记录范围错误或编号重复。')
  validateFlowRecords(rows, true)
  const files = backup.files.map((item: any) => {
    if (!item.id || !Array.isArray(item.bytes) || item.bytes.some((byte: number) => !Number.isInteger(byte) || byte < 0 || byte > 255)) throw new Error('备份附件格式无效。')
    return { id: item.id, blob: new Blob([new Uint8Array(item.bytes)], { type: item.type }) }
  })
  const refs = new Set(files.map((item: any) => item.id))
  for (const row of rows) for (const id of pcsFileReferences(row.value)) if (!refs.has(id)) throw new Error('备份附件引用不完整。')
  await prepareMaterialReadBoundary(rows.some(isMaterialRecord))
  const current = await readPcsRecords([namespace]), known = new Map(current.records.map(row => [row.id, row]))
  const candidates: PcsStoredRecord[] = []
  for (const row of rows.filter(row => row.id !== revisionId)) {
    if (!isReadOnlyMaterial(row)) { candidates.push(row); continue }
    const previous = known.get(row.id)
    if (previous) {
      if (JSON.stringify(previous.value) !== JSON.stringify(row.value) || Boolean(previous.deleted) !== Boolean(row.deleted)) throw new Error('备份与原只读辅料资料冲突，未导入，请核对。')
      continue
    }
    // Retain an original in this same atomic backup transaction, without
    // recreating a second active auxiliary-material source or moving stock.
    candidates.push({ ...row, id: `${namespace}/archive/material-original/${encodeURIComponent(row.id)}`, collection: 'archive', deleted: false,
      value: { format: 'post-finishing-readonly-material-original', originalRecordId: row.id, originalCollection: row.collection, originalDeleted: Boolean(row.deleted), original: row.value, sourceFingerprint: await sourceFingerprint(row.value), retainedOriginal: true } })
  }
  const puts = candidates.filter(row => {
    const previous = known.get(row.id)
    if (!previous) return true
    if (JSON.stringify(previous.value) !== JSON.stringify(row.value) || Boolean(previous.deleted) !== Boolean(row.deleted)) throw new Error('备份与现有后道资料冲突，未导入，请核对。')
    return false
  }).map(({ version, ...row }) => ({ ...row, expectedVersion: 0 }))
  const existingFiles = new Set(current.files.map(file => file.id))
  for (const file of files) {
    const previous = current.files.find(item => item.id === file.id)
    if (previous && (previous.blob.type !== file.blob.type || JSON.stringify(Array.from(new Uint8Array(await previous.blob.arrayBuffer()))) !== JSON.stringify(Array.from(new Uint8Array(await file.blob.arrayBuffer()))))) throw new Error('备份附件与现有图片内容冲突，未导入。')
  }
  const used = new Set(puts.flatMap(row => [...pcsFileReferences(row.value)]))
  const before = snapshots(false)
  try {
    applyCandidateRecords([...current.records, ...puts])
    recordValidators.forEach(validate => validate())
  } finally { restore(before) }
  if (puts.length) puts.push({ id: revisionId, collection: 'revision', value: { format: 1 }, expectedVersion: known.get(revisionId)?.version || 0 })
  const newFiles = files.filter((file: any) => used.has(file.id) && !existingFiles.has(file.id))
  const command = { puts, deletes: [], files: newFiles, operationId: `pf-restore-${crypto.randomUUID()}`, intent: JSON.stringify(puts) }
  // An empty namespace with no new Blob bytes can use the existing atomic
  // insert path. All records, the revision and operation receipt share one
  // transaction; add constraints also reject a concurrent first import.
  if (puts.length && !known.size && !newFiles.length) {
    const [outcome] = await commitPcsNewRecordGroups([command])
    if (!outcome.ok) throw translate(new Error(outcome.message))
  } else await commitPcsRecords(command)
  await ensurePostFinishingRecordState()
}
