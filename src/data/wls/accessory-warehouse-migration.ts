import {
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY, listMaterialPrepOrderProjections,
  type ProductionMaterialPrepWorkflowStore,
} from '../fcs/cutting/production-material-prep.ts'
import { buildAccessoryPreparationSources, findPostMigrationAccessoryConflicts, type AccessoryLegacyConflictFragment } from './accessory-warehouse-sources.ts'
import { productionOrders } from '../fcs/production-orders.ts'
import { listRuntimeProcessTasks } from '../fcs/runtime-process-tasks.ts'
import { listEffectiveTaskAssignments } from '../fcs/effective-task-assignments.ts'
import { listFactoryMasterRecords } from '../fcs/factory-master-store.ts'
import { hydrateProductionContextRecords } from '../fcs/production-context-records.ts'
import { cuttingRecordFingerprint, cuttingRecordBytesFingerprint } from '../fcs/cutting/cutting-record-identity.ts'
import {
  exportCuttingRecordBackup, openCuttingRecordDatabase,
  validateCuttingRecordBackup, readCuttingRecordFile,
  type CuttingStoredRecord, type CuttingStoredCommand,
} from '../fcs/cutting/cutting-record-repository.ts'
import {
  ACCESSORY_RECORD_PREFIX, accessoryRecord, ensureAccessoryWarehouseRecords, listAccessoryRecords,
  readAccessoryRecordSnapshot, saveAccessoryWarehouseAction,
} from './accessory-warehouse-records.ts'
import type { AccessoryPreparation } from './accessory-warehouse-flow.ts'
import { getAccessoryStockAvailable, type AccessoryStock } from './accessory-warehouse-stock.ts'
import type { SewingPickupSlipVersion, SewingPickupHandoverResult } from '../fcs/sewing-pickup-slips.ts'
import { listEnabledAccessoryWarehouseLocations, listAccessoryPostWarehouseLocations } from './accessory-warehouse-master.ts'

export const ACCESSORY_LEGACY_MIGRATION_ID = 'legacy-preparation-v1'
const fields = ['prepRecords', 'pickupRecords', 'pickupSessions', 'pickupNodeSnapshots', 'pickupReturnRecords', 'rejectRecords', 'stagingRecords', 'closedOrders'] as const
const identityFields = ['prepRecordId', 'pickupRecordId', 'pickupSessionId', 'nodeId', 'returnRecordId', 'rejectId', 'stagingRecordId', 'prepOrderId'] as const
type LegacyField = typeof fields[number]
type Json = Record<string, any>
export interface AccessoryLegacyEntry {
  id: string; kind: 'LEGACY_ENTRY'; sourceKey: string; field: LegacyField; sourceId: string
  scopeLineIds: string[]; retainedShared: boolean; entry: Json
}
export interface AccessoryLegacyManifest {
  id: typeof ACCESSORY_LEGACY_MIGRATION_ID; kind: 'LEGACY_SCOPE'; version: 1
  phase: 'COPIED' | 'VERIFIED' | 'COMPLETE' | 'RESTORED'
  sourceFingerprint: string; remainingFingerprint: string; entryIds: string[]; preparationIds: string[]
  scopeLineIds: string[]; copiedCount: number; at: string; operator: string
}
export interface AccessoryLegacyMigrationPlan {
  entries: AccessoryLegacyEntry[]; preparations: AccessoryPreparation[]; remainingRaw: string | null
  affectedLineIds: string[]; retainedSharedIds: string[]; issues: string[]
}
export interface AccessoryLegacyInspection {
  legacyKey: string; state: '无需迁移' | '待迁移' | '待清理' | '已完成' | '已阻塞'
  sourcePresent: boolean | null; affectedPreparationIds: string[]; affectedEntryCount: number
  retainedSharedIds: string[]; copiedCount: number; issues: string[]
  legacyReadable?: boolean
}
function object(value: unknown): value is Json { return Boolean(value) && typeof value === 'object' && !Array.isArray(value) }
function text(value: unknown): value is string { return typeof value === 'string' && Boolean(value.trim()) }
function legacyStorage(): Storage {
  try { if (typeof window !== 'undefined' && window.localStorage) return window.localStorage } catch { /* read failure is explicit below */ }
  throw new Error('原配料资料存储不可读取，原资料已保留。恢复访问后再重试迁移。')
}
function parseLegacy(raw: string | null): Json {
  if (!raw) return Object.fromEntries(fields.map(field => [field, []]))
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { throw new Error('原配料资料格式损坏，未进行迁移或清理。') }
  if (!object(parsed) || fields.some(field => parsed[field] !== undefined && !Array.isArray(parsed[field]))) throw new Error('原配料资料结构不完整，未进行迁移或清理。')
  for (const field of fields) if (parsed[field]?.some((row: unknown) => !object(row) || !text(row[identityFields[fields.indexOf(field)]]))) throw new Error(`原配料资料 ${field} 缺少稳定身份，未进行迁移。`)
  return { ...parsed, ...Object.fromEntries(fields.map(field => [field, parsed[field] || []])) }
}
function idsIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(idsIn)
  if (!object(value)) return []
  return [...(typeof value.prepLineId === 'string' ? [value.prepLineId] : []), ...Object.values(value).flatMap(idsIn)]
}
function filesIn(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(filesIn)
  if (!object(value)) return []
  const refs = ['$productionFile', 'fileId', 'imageFileId', 'attachmentFileId'].flatMap(key => text(value[key]) ? [value[key]] : [])
  return [...refs, ...Object.values(value).flatMap(filesIn)]
}
function hasUnrecoverableAttachment(value: unknown): boolean {
  if (value instanceof Blob) return true
  if (typeof value === 'string') return /^data:|^blob:/.test(value)
  if (Array.isArray(value)) return value.some(hasUnrecoverableAttachment)
  if (!object(value)) return false
  if (Array.isArray(value.imageNames) && value.imageNames.length && !filesIn(value).length) return true
  return Object.values(value).some(hasUnrecoverableAttachment)
}
function updateRemainingItems(entry: Json, items: Json[]): Json {
  const units = new Set(items.map(item => item.sourceUnit).filter(Boolean))
  return { ...entry, prepLineId: items[0].prepLineId, items,
    preparedQty: units.size === 1 ? items.reduce((sum, item) => sum + Number(item.preparedQty || 0), 0) : null,
    rollCount: items.reduce((sum, item) => sum + Number(item.rollCount || 0), 0),
    unitSummaries: undefined,
  }
}
/** 纯转换：仅处理明确落在本范围内的真实旧记录，保留所有其他字段和共用记录。 */
export function buildLegacyAccessoryMigrationPlan(raw: string | null, preparations: AccessoryPreparation[]): AccessoryLegacyMigrationPlan {
  const legacy = parseLegacy(raw), next = structuredClone(legacy)
  const scope = new Set(preparations.flatMap(preparation => preparation.lines.map(line => line.id)))
  const affectedOrders = new Set<string>(), scopePrepIds = new Set<string>(), scopePickupIds = new Set<string>()
  const entries: AccessoryLegacyEntry[] = [], retainedSharedIds: string[] = [], issues: string[] = []
  const add = (field: LegacyField, entry: Json, retain: boolean, lineIds: string[]) => {
    const sourceId = entry[identityFields[fields.indexOf(field)]]
    const id = `legacy-entry:${field}:${encodeURIComponent(sourceId)}`
    if (entries.some(row => row.id === id)) { issues.push(`${field} 存在重复记录 ${sourceId}。`); return }
    if (hasUnrecoverableAttachment(entry)) issues.push(`${sourceId} 的图片或附件缺少可恢复实体，原资料不能清理。`)
    entries.push({ id, kind: 'LEGACY_ENTRY', sourceKey: PRODUCTION_MATERIAL_PREP_STORAGE_KEY, field, sourceId, scopeLineIds: [...new Set(lineIds)], retainedShared: retain, entry: structuredClone(entry) })
    if (retain) retainedSharedIds.push(id)
    if (text(entry.prepOrderId)) affectedOrders.add(entry.prepOrderId)
  }
  next.prepRecords = legacy.prepRecords.flatMap((record: Json) => {
    const items: Json[] = Array.isArray(record.items) && record.items.length ? record.items : [{ prepLineId: record.prepLineId, preparedQty: record.preparedQty }]
    const affected = items.filter(item => scope.has(item.prepLineId))
    if (!affected.length) return [record]
    if (affected.some(item => !Number.isFinite(item.preparedQty) || item.preparedQty < 0)) issues.push(`${record.prepRecordId} 的辅料数量无效，原资料不能清理。`)
    scopePrepIds.add(record.prepRecordId)
    const rest = items.filter(item => !scope.has(item.prepLineId))
    add('prepRecords', record, rest.length > 0, affected.map(item => item.prepLineId))
    return rest.length ? [updateRemainingItems(record, rest)] : []
  })
  next.pickupRecords = legacy.pickupRecords.flatMap((record: Json) => {
    const affected = idsIn(record).filter(id => scope.has(id))
    if (!affected.length) return [record]
    scopePickupIds.add(record.pickupRecordId)
    const rest = record.sourceAllocations?.filter((item: Json) => !scope.has(item.prepLineId)) || []
    add('pickupRecords', record, rest.length > 0, affected)
    return rest.length ? [{ ...record, prepLineId: rest[0].prepLineId, sourceAllocations: rest,
      pickedQty: rest.reduce((sum: number, item: Json) => sum + Number(item.pickedQty || 0), 0),
      rollCount: rest.reduce((sum: number, item: Json) => sum + Number(item.rollCount || 0), 0) }] : []
  })
  for (const field of ['pickupReturnRecords', 'rejectRecords'] as const) {
    next[field] = legacy[field].filter((record: Json) => {
      const related = scope.has(record.prepLineId) || scopePrepIds.has(record.prepRecordId)
      if (!related) return true
      const mixed = field === 'rejectRecords' && next.prepRecords.some((row: Json) => row.prepRecordId === record.prepRecordId)
      add(field, record, mixed, idsIn(record).filter(id => scope.has(id)))
      return mixed
    })
  }
  // 下列头记录可能服务同一生产单的其他工艺。归档并保留原件，不按订单整包删除。
  for (const field of ['pickupSessions', 'pickupNodeSnapshots', 'stagingRecords', 'closedOrders'] as const) {
    for (const record of legacy[field] as Json[]) {
      const related = field === 'pickupSessions' ? record.pickupRecordIds?.some((id: string) => scopePickupIds.has(id))
        : field === 'stagingRecords' ? scopePrepIds.has(record.prepRecordId)
          : field === 'closedOrders' ? preparations.some(preparation => preparation.id === record.prepOrderId) : affectedOrders.has(record.prepOrderId)
      if (related) add(field, record, true, idsIn(record).filter(id => scope.has(id)))
    }
  }
  const migratedPreparations = preparations.filter(preparation => affectedOrders.has(preparation.id)).map(preparation => {
    const clone = structuredClone(preparation)
    const records = legacy.prepRecords.filter((record: Json) => record.prepOrderId === preparation.id && record.recordStatus === 'CONFIRMED'
      && idsIn(record).some(id => scope.has(id)))
    const latest = [...records].sort((a: Json, b: Json) => String(a.confirmedAt || a.preparedAt).localeCompare(String(b.confirmedAt || b.preparedAt))).at(-1)
    for (const record of legacy.prepRecords.filter((record: Json) => record.prepOrderId === preparation.id && record.recordStatus !== 'CONFIRMED'
      && idsIn(record).some(id => scope.has(id)))) {
      const details = (record.items?.length ? record.items : [{ prepLineId: record.prepLineId, preparedQty: record.preparedQty }])
        .filter((item: Json) => scope.has(item.prepLineId)).map((item: Json) => {
          const line = clone.lines.find(line => line.id === item.prepLineId)
          return `${line?.materialName || '辅料'} ${item.preparedQty} ${line?.unit || ''}`
        }).join('；')
      const status = ({ DRAFT: '待拣货', PICKED: '已拣货', STAGED: '已暂存', REJECTED: '已打回' } as Record<string, string>)[record.recordStatus] || '待核对'
      const history = { at: record.preparedAt || atFallback(record), by: record.operatorName || '原记录', action: '旧配料记录',
        detail: `${record.batchNo || record.prepRecordId}；${status}；${details}；${record.remark || ''}` }
      if (!clone.history.some(entry => JSON.stringify(entry) === JSON.stringify(history))) clone.history.push(history)
    }
    if (clone.status === '已配齐' && latest) {
      clone.completedAt ||= latest.confirmedAt || latest.preparedAt
      clone.completedBy ||= latest.confirmedBy || latest.operatorName
      clone.completionVersion ||= Math.max(1, clone.version)
    }
    return clone
  })
  return { entries, preparations: migratedPreparations, remainingRaw: raw === null ? null : JSON.stringify(next),
    affectedLineIds: [...new Set(entries.flatMap(entry => entry.scopeLineIds))], retainedSharedIds, issues }
}
function atFallback(record: Json): string { return record.confirmedAt || record.stagedAt || record.rejectedAt || '' }
async function currentPlan(): Promise<{ plan: AccessoryLegacyMigrationPlan; raw: string | null; manifest?: AccessoryLegacyManifest; conflicts: AccessoryLegacyConflictFragment[]; legacyReadable: boolean }> {
  await hydrateProductionContextRecords(); await ensureAccessoryWarehouseRecords()
  const manifest = listAccessoryRecords<AccessoryLegacyManifest>('migration').find(row => row.id === ACCESSORY_LEGACY_MIGRATION_ID)
  let raw: string | null
  try { raw = legacyStorage().getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY); parseLegacy(raw) }
  catch (error) {
    if (!manifest || !['COMPLETE', 'RESTORED'].includes(manifest.phase)) throw error
    return { plan: { entries: [], preparations: [], remainingRaw: null, affectedLineIds: [], retainedSharedIds: [], issues: [] }, raw: null, manifest,
      conflicts: [], legacyReadable: false }
  }
  const storage = { getItem: (key: string) => key === PRODUCTION_MATERIAL_PREP_STORAGE_KEY ? raw : null }
  const result = buildAccessoryPreparationSources({ projections: listMaterialPrepOrderProjections(storage), orders: productionOrders,
    tasks: listRuntimeProcessTasks(), factories: listFactoryMasterRecords(), assignments: listEffectiveTaskAssignments(),
    savedPreparations: listAccessoryRecords<AccessoryPreparation>('preparation') })
  const plan = buildLegacyAccessoryMigrationPlan(raw, result.preparations)
  const sourceIssues = result.issues.filter(issue => plan.preparations.some(preparation => preparation.id === issue.preparationId)
    && ['SOURCE_DATA', 'SOURCE_CHANGED', 'SOURCE_MISSING', 'SAVED_DATA'].includes(issue.code))
  plan.issues.push(...sourceIssues.map(issue => issue.message))
  for (const id of new Set(plan.entries.flatMap(entry => filesIn(entry.entry)))) if (!await readCuttingRecordFile(id)) plan.issues.push(`附件 ${id} 缺少原始实体，原资料不能清理。`)
  const conflicts = manifest && ['COMPLETE', 'RESTORED'].includes(manifest.phase)
    ? findPostMigrationAccessoryConflicts(raw, result.preparations, listAccessoryRecords<AccessoryLegacyEntry>('migration').filter(row => row.kind === 'LEGACY_ENTRY')) : []
  return { plan, raw, manifest, conflicts, legacyReadable: true }
}
function inspection(plan: AccessoryLegacyMigrationPlan, raw: string | null, manifest?: AccessoryLegacyManifest, conflicts: AccessoryLegacyConflictFragment[] = [], legacyReadable = true): AccessoryLegacyInspection {
  const issues = [...plan.issues, ...(conflicts.length ? ['迁移完成后原配料资料又出现本范围记录，可能有旧页面继续写入。新旧资料均保留，核对冲突前不能继续办理；可导出冲突备份供核对。'] : []),
    ...(!legacyReadable ? ['旧共享资料当前不可读取；已迁移记录仍可读取和备份，当前不能核对是否存在旧页面新写入。'] : [])]
  return { legacyKey: PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
    state: plan.issues.length || conflicts.length ? '已阻塞' : manifest?.phase === 'COMPLETE' || manifest?.phase === 'RESTORED' ? '已完成'
      : manifest?.phase === 'VERIFIED' ? '待清理' : plan.entries.length || manifest ? '待迁移' : '无需迁移',
    sourcePresent: legacyReadable ? raw !== null : null, affectedPreparationIds: [...new Set([...plan.preparations.map(preparation => preparation.id), ...conflicts.map(conflict => conflict.preparationId)])],
    affectedEntryCount: plan.entries.length, retainedSharedIds: plan.retainedSharedIds,
    copiedCount: manifest?.copiedCount || 0, issues, legacyReadable }
}
export async function inspectLegacyAccessoryMigration(): Promise<AccessoryLegacyInspection> {
  try { const { plan, raw, manifest, conflicts, legacyReadable } = await currentPlan(); return inspection(plan, raw, manifest, conflicts, legacyReadable) }
  catch (error) { return { legacyKey: PRODUCTION_MATERIAL_PREP_STORAGE_KEY, state: '已阻塞', sourcePresent: null,
    affectedPreparationIds: [], affectedEntryCount: 0, retainedSharedIds: [], copiedCount: 0, issues: [error instanceof Error ? error.message : String(error)] } }
}
/** 显式迁移。每批可重放，验证目标后才改旧键；共享键只移除已核对的明细。 */
export async function migrateLegacyAccessoryPreparation(input: { commandId: string; operator: string; at?: string; batchSize?: number; finalize?: boolean }): Promise<AccessoryLegacyInspection> {
  if (!text(input.commandId) || !text(input.operator)) throw new Error('迁移需要稳定操作编号和操作人。')
  const { plan, raw, manifest: previous, conflicts, legacyReadable } = await currentPlan()
  if (plan.issues.length) throw new Error(plan.issues.join('\n'))
  if (conflicts.length) throw new Error('原配料资料存在迁移后的旧页面写入冲突。新旧资料均已保留，未合并或清理；请先核对冲突备份。')
  if (previous?.phase === 'COMPLETE' || previous?.phase === 'RESTORED') return inspection(plan, raw, previous, [], legacyReadable)
  if (!plan.entries.length && !previous) return inspection(plan, raw)
  const sourceFingerprint = await cuttingRecordFingerprint(raw || 'null')
  if (previous && sourceFingerprint !== previous.sourceFingerprint && sourceFingerprint !== previous.remainingFingerprint) throw new Error('原配料资料已变化，未继续迁移或清理。请重新核对来源版本。')
  const archived = listAccessoryRecords<AccessoryLegacyEntry>('migration').filter(entry => entry.kind === 'LEGACY_ENTRY')
  const entries = previous ? previous.entryIds.map(id => archived.find(entry => entry.id === id)).filter((entry): entry is AccessoryLegacyEntry => Boolean(entry)) : plan.entries
  if (previous && entries.length !== previous.entryIds.length && previous.phase !== 'COPIED') throw new Error('迁移归档缺失，旧源保留，请核对备份。')
  const at = input.at || new Date().toISOString(), batchSize = Math.min(100, Math.max(1, Math.floor(input.batchSize || 25)))
  let progress: AccessoryLegacyManifest = previous || { id: ACCESSORY_LEGACY_MIGRATION_ID, kind: 'LEGACY_SCOPE', version: 1, phase: 'COPIED',
    sourceFingerprint, remainingFingerprint: await cuttingRecordFingerprint(plan.remainingRaw || 'null'), entryIds: plan.entries.map(entry => entry.id),
    preparationIds: plan.preparations.map(preparation => preparation.id), scopeLineIds: plan.affectedLineIds, copiedCount: 0, at, operator: input.operator }
  const targets = previous ? plan.entries.length ? plan.entries : entries : plan.entries
  // 同批保存明细归档和可回读配料，失败不发布成功状态。
  for (let offset = progress.copiedCount; offset < targets.length; offset += batchSize) {
    const batch = targets.slice(offset, offset + batchSize)
    progress = { ...progress, copiedCount: offset + batch.length }
    await saveAccessoryWarehouseAction({ commandId: `${input.commandId}:copy:${offset}`, intent: `legacy-copy:${progress.sourceFingerprint}:${offset}`,
      result: { copiedCount: progress.copiedCount }, change: { puts: [
        ...batch.map(entry => accessoryRecord('migration', entry.id, entry)),
        ...plan.preparations.filter(preparation => !listAccessoryRecords<AccessoryPreparation>('preparation').some(row => row.id === preparation.id)).map(preparation => accessoryRecord('preparation', preparation.id, preparation)),
        accessoryRecord('migration', progress.id, progress),
      ] }, assertSourcesCurrent: () => { if (legacyStorage().getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY) !== raw) throw new Error('原配料资料已变化，本批未保存。') } })
  }
  const stored = await readAccessoryRecordSnapshot()
  const expected = previous && previous.phase !== 'COPIED' ? entries : targets
  for (const entry of expected) if (!stored.records.some(row => row.id === accessoryRecord('migration', entry.id, entry).id && JSON.stringify(row.value) === JSON.stringify(entry))) throw new Error('迁移目标读回不一致，原配料资料未清理。')
  for (const id of progress.preparationIds) {
    const target = stored.records.find(row => row.id === accessoryRecord('preparation', id, {}).id)
    const projected = plan.preparations.find(preparation => preparation.id === id)
    if (!target || projected && JSON.stringify(target.value) !== JSON.stringify(projected)) throw new Error('迁移配料目标读回不一致，原资料未清理。')
  }
  progress = { ...progress, phase: 'VERIFIED' }
  await ensureAccessoryWarehouseRecords()
  await saveAccessoryWarehouseAction({ commandId: `${input.commandId}:verified`, intent: `legacy-verified:${progress.sourceFingerprint}`,
    result: { phase: 'VERIFIED' }, change: { puts: [accessoryRecord('migration', progress.id, progress)] } })
  if (input.finalize === false) return inspection(plan, raw, progress)
  const storage = legacyStorage(), actualRaw = storage.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY)
  const currentFingerprint = await cuttingRecordFingerprint(actualRaw || 'null')
  if (currentFingerprint !== progress.sourceFingerprint && currentFingerprint !== progress.remainingFingerprint) throw new Error('清理前旧资料已变化，旧资料已保留。')
  if (currentFingerprint === progress.sourceFingerprint && plan.remainingRaw !== actualRaw && plan.remainingRaw !== null) storage.setItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY, plan.remainingRaw)
  if (await cuttingRecordFingerprint(storage.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY) || 'null') !== progress.remainingFingerprint) throw new Error('旧配料范围清理未完成，目标记录已保留，可重试。')
  progress = { ...progress, phase: 'COMPLETE' }
  await saveAccessoryWarehouseAction({ commandId: `${input.commandId}:complete`, intent: `legacy-complete:${progress.sourceFingerprint}`,
    result: { phase: 'COMPLETE' }, change: { puts: [accessoryRecord('migration', progress.id, progress)] } })
  return inspection(plan, storage.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY), progress)
}

export interface AccessoryWarehouseBackup {
  format: 'higood-accessory-warehouse-backup'; version: 1; exportedAt: string
  records: CuttingStoredRecord[]; dependencies: CuttingStoredRecord[]; commands: CuttingStoredCommand[]
  files: Array<{ id: string; blob: Blob }>
  conflicts?: Array<{ id: string; state: 'UNRESOLVED'; sourceKey: typeof PRODUCTION_MATERIAL_PREP_STORAGE_KEY; sourceFingerprint: string; detectedAfterMigration: true; entries: AccessoryLegacyConflictFragment[] }>
  legacySource?: { status: 'READABLE' | 'UNREADABLE'; key: typeof PRODUCTION_MATERIAL_PREP_STORAGE_KEY }
  sewingConflicts?: Array<{ id: string; state: 'UNRESOLVED'; sourceKey: 'higood:ppic:sewing-pickup-slips:v1'; sourceFingerprint: string;
    versions: SewingPickupSlipVersion[]; handoverResults: SewingPickupHandoverResult[] }>
}
function assertUnique(entries: Array<{ id: string }>, label: string): void {
  if (entries.some(row => !row || !text(row.id)) || new Set(entries.map(row => row.id)).size !== entries.length) throw new Error(`备份${label}身份无效或重复，未恢复。`)
}
/** 验证业务范围、数量、引用及原始 Blob；不接受其他模块混入本范围恢复。 */
export function validateAccessoryWarehouseBackup(value: unknown): asserts value is AccessoryWarehouseBackup {
  const data = value as AccessoryWarehouseBackup
  if (!data || data.format !== 'higood-accessory-warehouse-backup' || data.version !== 1 || !text(data.exportedAt)
    || !Array.isArray(data.records) || !Array.isArray(data.dependencies) || !Array.isArray(data.commands) || !Array.isArray(data.files)) throw new Error('辅料备份格式或版本不正确，未恢复。')
  assertUnique([...data.records, ...data.dependencies], '记录'); assertUnique(data.commands, '命令'); assertUnique(data.files, '附件')
  if (data.conflicts !== undefined && !Array.isArray(data.conflicts)) throw new Error('冲突备份片段格式错误，未恢复。')
  if (data.sewingConflicts !== undefined && !Array.isArray(data.sewingConflicts)) throw new Error('车缝旧写冲突片段格式错误，未恢复。')
  if (data.sewingConflicts) {
    assertUnique(data.sewingConflicts, '车缝冲突')
    for (const conflict of data.sewingConflicts) {
      if (conflict.state !== 'UNRESOLVED' || conflict.sourceKey !== 'higood:ppic:sewing-pickup-slips:v1' || !/^[a-f0-9]{64}$/.test(conflict.sourceFingerprint)
        || !Array.isArray(conflict.versions) || !conflict.versions.length || !Array.isArray(conflict.handoverResults)
        || conflict.versions.some(version => !text(version.versionId) || !text(version.assignmentId) || version.objectKind === 'CUT_PIECE' || !Array.isArray(version.lines)
          || version.lines.some(line => !text(line.lineId) || !text(line.sourceLineId) || !text(line.unit) || !Number.isFinite(line.requiredQty) || line.requiredQty < 0))
        || conflict.handoverResults.some(result => !text(result.commandId) || !Array.isArray(result.quantities)
          || !conflict.versions.some(version => version.versionId === result.versionId && result.quantities.every(entry => Number.isFinite(entry.actualQty) && entry.actualQty > 0 && version.lines.some(line => line.lineId === entry.lineId))))
        || hasUnrecoverableAttachment(conflict)) throw new Error('车缝旧写冲突来源或明细不完整，未恢复。')
    }
  }
  if (data.legacySource !== undefined && (!object(data.legacySource) || data.legacySource.key !== PRODUCTION_MATERIAL_PREP_STORAGE_KEY || !['READABLE', 'UNREADABLE'].includes(data.legacySource.status))) throw new Error('备份旧源读取说明格式错误。')
  if (data.conflicts) {
    assertUnique(data.conflicts, '冲突')
    for (const conflict of data.conflicts) {
      if (!conflict || conflict.state !== 'UNRESOLVED' || conflict.sourceKey !== PRODUCTION_MATERIAL_PREP_STORAGE_KEY || conflict.detectedAfterMigration !== true
        || !/^[a-f0-9]{64}$/.test(conflict.sourceFingerprint) || !Array.isArray(conflict.entries) || !conflict.entries.length
        || conflict.entries.some(entry => !entry || !text(entry.preparationId) || !text(entry.sourceId)
          || !['prepRecords', 'pickupRecords', 'pickupReturnRecords', 'rejectRecords', 'closedOrders'].includes(entry.field)
          || !object(entry.entry) || hasUnrecoverableAttachment(entry.entry))) throw new Error('备份旧页面冲突片段不完整，未恢复。')
    }
  }
  if (data.records.some(row => !row.id.startsWith(ACCESSORY_RECORD_PREFIX) || !row.collection.startsWith(ACCESSORY_RECORD_PREFIX))
    || data.dependencies.some(row => !row.id.startsWith('production-context:') || !row.collection.startsWith('production-context:'))
    || data.files.some(file => !(file.blob instanceof Blob))
    || data.records.some(row => !object(row.value) || hasUnrecoverableAttachment(row.value))) throw new Error('辅料备份包含越界或无法恢复的记录/附件，未恢复。')
  const knownKinds = new Set(['preparation', 'transfer', 'receipt', 'stock', 'pickup', 'change', 'migration', 'audit', 'sewing-slip', 'sewing-context', 'sewing-handover', 'sewing-result'])
  for (const row of data.records) {
    const kind = row.collection.slice(ACCESSORY_RECORD_PREFIX.length), entry = row.value as Json
    if (!knownKinds.has(kind) || row.id !== `${row.collection}:${entry.id}`) throw new Error('辅料备份记录身份与类型不一致。')
    if (['preparation', 'transfer', 'pickup'].includes(kind)) {
      if (!text(entry.productionOrderId) || !Array.isArray(entry.lines) || !entry.lines.length
        || entry.lines.some((line: Json) => !object(line) || !text(line.id) || !text(line.materialSku) || !text(line.unit))
        || new Set(entry.lines.map((line: Json) => line.id)).size !== entry.lines.length) throw new Error('辅料备份缺少生产单或明细身份。')
      for (const line of entry.lines) for (const key of ['requiredQty', 'preparedQty', 'availableQty', 'qty', 'handedQty']) {
        if (key in line && (!Number.isFinite(line[key]) || line[key] < 0)) throw new Error('辅料备份数量无效。')
      }
      if (kind === 'transfer' && entry.lines.some((line: Json) => !Number.isFinite(line.qty) || line.qty <= 0)) throw new Error('辅料备份调拨明细缺少有效数量。')
    }
    if (kind === 'stock') getAccessoryStockAvailable(entry as AccessoryStock)
    if (kind === 'migration' && entry.kind === 'LEGACY_SCOPE') {
      if (entry.version !== 1 || !['COPIED', 'VERIFIED', 'COMPLETE', 'RESTORED'].includes(entry.phase)
        || !Array.isArray(entry.entryIds) || entry.entryIds.some((id: unknown) => !data.records.some(row => row.id === accessoryRecord('migration', String(id), {}).id))) throw new Error('辅料备份迁移进度或归档引用不完整。')
    }
  }
  const preparationIds = new Set(data.records.filter(row => row.collection === `${ACCESSORY_RECORD_PREFIX}preparation`).map(row => (row.value as Json).id))
  const transferIds = new Set(data.records.filter(row => row.collection === `${ACCESSORY_RECORD_PREFIX}transfer`).map(row => (row.value as Json).id))
  const sewingSlips = data.records.filter(row => row.collection === `${ACCESSORY_RECORD_PREFIX}sewing-slip`).map(row => row.value as Json)
  const sewingContexts = data.records.filter(row => row.collection === `${ACCESSORY_RECORD_PREFIX}sewing-context`).map(row => row.value as Json)
  const sewingEvents = data.records.filter(row => row.collection === `${ACCESSORY_RECORD_PREFIX}sewing-handover`).map(row => row.value as Json)
  for (const row of data.records) {
    const entry = row.value as Json
    if (row.collection === `${ACCESSORY_RECORD_PREFIX}transfer` && (!preparationIds.has(entry.preparationId) || entry.sourceTransferId && !transferIds.has(entry.sourceTransferId))) throw new Error('辅料备份调拨缺少原配料或来源调拨。')
    if (row.collection === `${ACCESSORY_RECORD_PREFIX}pickup` && (!preparationIds.has(entry.preparationId) || !transferIds.has(entry.sourceTransferId))) throw new Error('辅料备份领料缺少原配料或来源调拨。')
    if (row.collection === `${ACCESSORY_RECORD_PREFIX}receipt`) {
      const transfer = data.records.find(source => source.collection === `${ACCESSORY_RECORD_PREFIX}transfer` && (source.value as Json).id === entry.transferId)?.value as Json | undefined
      if (!transfer || !text(entry.warehouseCode) || !['待收货', '已收货', '已取消'].includes(entry.status) || !Array.isArray(entry.lines)) throw new Error('辅料备份接收事项缺少原调拨或状态无效。')
      if (entry.status === '已取消') {
        if (entry.lines.length || !text(entry.cancellationReason) || !text(entry.cancelledAt)) throw new Error('辅料备份取消接收事项缺少原因，或包含已收货明细。')
      } else if (transfer.toWarehouse !== entry.warehouseCode) throw new Error('辅料备份接收事项与当前目的仓不一致。')
      if (entry.status === '待收货' && (entry.lines.length || !['待出库', '已出库待收货'].includes(transfer.status))) throw new Error('辅料备份待收事项与当前调拨状态不一致。')
      if (entry.status === '已收货') {
        const locations = entry.warehouseCode === 'DLN' ? listAccessoryPostWarehouseLocations() : listEnabledAccessoryWarehouseLocations(entry.warehouseCode)
        if (transfer.status !== '已收货' || entry.lines.length !== transfer.lines.length || new Set(entry.lines.map((line: Json) => line.lineId)).size !== transfer.lines.length
          || entry.lines.some((line: Json) => {
            const source = transfer.lines.find((source: Json) => source.id === line.lineId)
            return !source || !Number.isFinite(source.qty) || source.qty <= 0 || !Number.isFinite(line.qty) || line.qty <= 0 || Math.abs(line.qty - source.qty) > 0.000001
              || !locations.some(location => location.enabled && location.id === line.locationId) || source.toLocationId !== line.locationId
          })) throw new Error('辅料备份实收明细的数量、来源或本仓库位不一致。')
      }
    }
    if (row.collection === `${ACCESSORY_RECORD_PREFIX}change` && !transferIds.has(entry.sourceTransferId)) throw new Error('辅料备份改厂安排缺少原调拨。')
    if (row.collection === `${ACCESSORY_RECORD_PREFIX}sewing-context` && (entry.id !== entry.assignmentId || !text(entry.runtimeTaskId)
      || !Array.isArray(entry.requirementLines) || entry.requirementLines.some((line: Json) => !text(line.requirementLineId) || !text(line.unit) || !Number.isFinite(line.requiredQty) || line.requiredQty < 0))) throw new Error('辅料备份车缝需求上下文不完整。')
    if (row.collection === `${ACCESSORY_RECORD_PREFIX}sewing-slip` && (entry.id !== entry.versionId || !text(entry.slipId) || !['CURRENT', 'VOIDED'].includes(entry.status)
      || !Array.isArray(entry.lines) || !sewingContexts.some(context => context.assignmentId === entry.assignmentId && context.runtimeTaskId === entry.runtimeTaskId)
      || entry.lines.some((line: Json) => !text(line.lineId) || !text(line.sourceLineId) || !text(line.unit) || !Number.isFinite(line.requiredQty) || line.requiredQty < 0))) throw new Error('辅料备份车缝凭证版本或来源引用不完整。')
    if (row.collection === `${ACCESSORY_RECORD_PREFIX}sewing-handover` && (entry.id !== entry.handoverEventId || !text(entry.commandId) || !Array.isArray(entry.lines)
      || !sewingContexts.some(context => context.assignmentId === entry.assignmentId)
      || entry.lines.some((line: Json) => !text(line.requirementLineId) || !Number.isFinite(line.actualQty) || line.actualQty <= 0
        || !sewingSlips.some(slip => slip.assignmentId === entry.assignmentId && slip.lines.some((source: Json) => source.sourceLineId === line.requirementLineId && source.unit === line.unit))))) throw new Error('辅料备份车缝实交引用或数量不完整。')
    if (row.collection === `${ACCESSORY_RECORD_PREFIX}sewing-result`) {
      const version = sewingSlips.find(slip => slip.versionId === entry.versionId)
      if (entry.id !== entry.commandId || !version || !Array.isArray(entry.quantities)
        || !sewingEvents.some(event => event.commandId === entry.commandId && event.assignmentId === version.assignmentId)
        || entry.quantities.some((line: Json) => !Number.isFinite(line.actualQty) || line.actualQty <= 0 || !version.lines.some((source: Json) => source.lineId === line.lineId))) throw new Error('辅料备份车缝实交结果缺少凭证或事件。')
    }
  }
  const available = new Set(data.files.map(file => file.id))
  const referenced = [...data.records, ...data.dependencies].flatMap(row => filesIn(row.value)).concat(data.commands.flatMap(command => filesIn(command.result)),
    (data.conflicts || []).flatMap(conflict => conflict.entries.flatMap(entry => filesIn(entry.entry))),
    (data.sewingConflicts || []).flatMap(conflict => filesIn(conflict)))
  if (referenced.some(id => !available.has(id))) throw new Error('辅料备份缺少引用的附件实体，未恢复。')
  validateCuttingRecordBackup({ format: 'higood-cutting-record-backup', version: 1, exportedAt: data.exportedAt,
    records: [...data.records, ...data.dependencies], commands: data.commands, files: data.files })
}
function referenceIdentities(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(referenceIdentities)
  if (!object(value)) return []
  return Object.entries(value).flatMap(([key, item]) => text(item) && (key.endsWith('Id') || key === 'key') ? [item] : referenceIdentities(item))
}
/** 显式备份读取才读取必要上游关联和附件；普通列表不扫描、复制或保存种子。 */
export async function exportAccessoryWarehouseBackup(): Promise<AccessoryWarehouseBackup> {
  await hydrateProductionContextRecords()
  await ensureAccessoryWarehouseRecords()
  const all = await exportCuttingRecordBackup()
  const records = new Map(all.records.filter(row => row.id.startsWith(ACCESSORY_RECORD_PREFIX)).map(row => [row.id, row]))
  const existingManifest = [...records.values()].map(row => row.value as Json).find(value => value.id === ACCESSORY_LEGACY_MIGRATION_ID)
  const source = await currentPlan()
  if (!existingManifest || !['COMPLETE', 'RESTORED'].includes(existingManifest.phase)) {
    const { plan, raw } = source
    if (plan.issues.length) throw new Error(plan.issues.join('\n'))
    for (const entry of plan.entries) records.set(accessoryRecord('migration', entry.id, entry).id, accessoryRecord('migration', entry.id, entry))
    for (const preparation of plan.preparations) if (!records.has(accessoryRecord('preparation', preparation.id, preparation).id)) records.set(accessoryRecord('preparation', preparation.id, preparation).id, accessoryRecord('preparation', preparation.id, preparation))
    if (plan.entries.length) {
      const manifest: AccessoryLegacyManifest = { id: ACCESSORY_LEGACY_MIGRATION_ID, kind: 'LEGACY_SCOPE', version: 1, phase: 'COPIED',
        sourceFingerprint: await cuttingRecordFingerprint(raw || 'null'), remainingFingerprint: await cuttingRecordFingerprint(plan.remainingRaw || 'null'),
        entryIds: plan.entries.map(entry => entry.id), preparationIds: plan.preparations.map(preparation => preparation.id), scopeLineIds: plan.affectedLineIds,
        copiedCount: plan.entries.length, at: new Date().toISOString(), operator: '备份读取' }
      records.set(accessoryRecord('migration', manifest.id, manifest).id, accessoryRecord('migration', manifest.id, manifest))
    }
  }
  // 已转换的后道历史单可能仅引用静态配料来源。只为实际记录的明确引用
  // 收录缺失快照；保留来源原状态和数量，不落库、不补配齐或生成 GTP 流转。
  const preparationReferences = [...records.values()].map(row => row.value as Json).filter(value => text(value.preparationId))
  const missingPreparationIds = new Set(preparationReferences.map(value => value.preparationId as string)
    .filter(id => !records.has(accessoryRecord('preparation', id, {}).id)))
  if (missingPreparationIds.size) {
    const available = buildAccessoryPreparationSources({
      projections: listMaterialPrepOrderProjections({ getItem: key => key === PRODUCTION_MATERIAL_PREP_STORAGE_KEY ? source.raw : null }),
      orders: productionOrders, tasks: listRuntimeProcessTasks(), factories: listFactoryMasterRecords(), assignments: listEffectiveTaskAssignments(),
      savedPreparations: listAccessoryRecords<AccessoryPreparation>('preparation'),
    })
    for (const id of missingPreparationIds) {
      const preparation = available.preparations.find(row => row.id === id)
      const issues = available.issues.filter(issue => issue.preparationId === id && ['SOURCE_DATA', 'SOURCE_CHANGED', 'SOURCE_MISSING', 'SAVED_DATA'].includes(issue.code))
      if (!preparation || issues.length || preparationReferences.some(value => value.preparationId === id
        && text(value.productionOrderId) && value.productionOrderId !== preparation.productionOrderId)) {
        throw new Error(`辅料备份引用的原配料来源无法核对，未补建来源或更改本机资料。${issues.map(issue => issue.message).join('\n')}`)
      }
      const snapshot = structuredClone(preparation)
      records.set(accessoryRecord('preparation', id, snapshot).id, accessoryRecord('preparation', id, snapshot))
    }
  }
  const values = [...records.values()]
  const known = new Set(values.flatMap(row => referenceIdentities(row.value))), dependencies = new Map<string, CuttingStoredRecord>()
  const productionOrderIds = new Set(values.map(row => (row.value as Json).productionOrderId).filter(text))
  for (const task of listRuntimeProcessTasks().filter(task => productionOrderIds.has(task.productionOrderId))) known.add(task.taskId)
  let changed = true
  while (changed) {
    changed = false
    for (const row of all.records.filter(row => row.id.startsWith('production-context:'))) {
      if (dependencies.has(row.id)) continue
      if (referenceIdentities(row.value).some(id => known.has(id))) {
        dependencies.set(row.id, row); referenceIdentities(row.value).forEach(id => known.add(id)); changed = true
      }
    }
  }
  // 计数元数据是上述逐记录来源的一部分，只在确有对应来源时包含。
  if (dependencies.size) for (const row of all.records.filter(row => row.id.startsWith('production-context:') && row.collection.endsWith('-meta'))) dependencies.set(row.id, row)
  const commands = all.commands.filter(command => command.intent.startsWith('accessory:') || known.has(command.id)
    || referenceIdentities(command.result).some(id => known.has(id)))
  const conflicts: AccessoryWarehouseBackup['conflicts'] = source.conflicts.length ? [{
    id: `legacy-conflict:${await cuttingRecordFingerprint(source.raw || 'null')}`, state: 'UNRESOLVED', sourceKey: PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
    sourceFingerprint: await cuttingRecordFingerprint(source.raw || 'null'), detectedAfterMigration: true, entries: source.conflicts,
  }] : []
  const sewing = await (await import('./accessory-warehouse-sewing.ts')).exportAccessorySewingLegacyConflict()
  const sewingConflicts: AccessoryWarehouseBackup['sewingConflicts'] = sewing ? [{ ...sewing, id: `sewing-conflict:${sewing.sourceFingerprint}`, state: 'UNRESOLVED' }] : []
  const referenced = new Set([...values, ...dependencies.values()].flatMap(row => filesIn(row.value)).concat(commands.flatMap(command => filesIn(command.result)),
    conflicts.flatMap(conflict => conflict.entries.flatMap(entry => filesIn(entry.entry))), sewingConflicts.flatMap(conflict => filesIn(conflict))))
  const files = all.files.filter(file => referenced.has(file.id))
  const result: AccessoryWarehouseBackup = { format: 'higood-accessory-warehouse-backup', version: 1,
    exportedAt: new Date().toISOString(), records: values, dependencies: [...dependencies.values()], commands, files,
    conflicts, sewingConflicts, legacySource: { status: source.legacyReadable ? 'READABLE' : 'UNREADABLE', key: PRODUCTION_MATERIAL_PREP_STORAGE_KEY } }
  validateAccessoryWarehouseBackup(result)
  return result
}
/** 仅用于隔离空库恢复。已有任何裁剪业务记录/命令/附件即拒绝，绝不覆盖用户数据。 */
export async function restoreAccessoryWarehouseBackup(value: unknown): Promise<void> {
  validateAccessoryWarehouseBackup(value)
  if (value.conflicts?.length || value.sewingConflicts?.length) throw new Error('备份包含未解决的旧页面写入冲突，仅供核对，不能恢复为有效业务记录。新旧资料未合并，当前本机资料未改动。')
  const existing = await exportCuttingRecordBackup()
  if (existing.records.length || existing.commands.length || existing.files.length) throw new Error('当前本地数据库非空，未恢复。请在隔离的空浏览器环境核验备份，原数据不会被覆盖。')
  const data = structuredClone(value)
  for (const row of data.records) {
    const entry = row.value as Json
    if (entry.id === ACCESSORY_LEGACY_MIGRATION_ID && entry.kind === 'LEGACY_SCOPE') entry.phase = 'RESTORED'
  }
  const { validateProductionContextRecords } = await import('../fcs/production-context-records.ts')
  validateProductionContextRecords(data.dependencies)
  for (const file of data.files.filter(file => file.id.startsWith('production-context-file:'))) {
    if (file.id !== `production-context-file:${await cuttingRecordBytesFingerprint(new Uint8Array(await file.blob.arrayBuffer()))}`) throw new Error('备份附件字节与原身份不一致，未恢复。')
  }
  const expectedRevision = (await readAccessoryRecordSnapshot()).revision
  const db = await openCuttingRecordDatabase()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['records', 'commands', 'files', 'meta'], 'readwrite')
    let failure: Error | null = null, ready = 0
    const counts: Record<string, number> = {}, revision = tx.objectStore('meta').get('revision')
    const abort = (error: unknown) => { failure = error instanceof Error ? error : new Error(String(error)); tx.abort() }
    tx.oncomplete = () => resolve(); tx.onabort = () => reject(failure || tx.error || new Error('恢复未保存，原数据保持不变。')); tx.onerror = () => {}
    const write = () => {
      if (++ready !== 4) return
      try {
        if (Object.values(counts).some(count => count > 0) || (revision.result?.value || 0) !== expectedRevision) throw new Error('恢复前本地资料已变化或目标非空，整批未恢复。')
        for (const row of [...data.records, ...data.dependencies]) tx.objectStore('records').add(row)
        for (const row of data.commands) tx.objectStore('commands').add(row)
        for (const row of data.files) tx.objectStore('files').add(row)
        tx.objectStore('meta').put({ id: 'revision', value: expectedRevision + 1 })
      } catch (error) { abort(error) }
    }
    revision.onsuccess = write
    for (const name of ['records', 'commands', 'files']) {
      const count = tx.objectStore(name).count()
      count.onsuccess = () => { counts[name] = count.result; write() }
    }
  })
  const stored = await readAccessoryRecordSnapshot()
  if (data.records.some(expected => !stored.records.some(actual => actual.id === expected.id && JSON.stringify(actual.value) === JSON.stringify(expected.value)))) throw new Error('恢复目标读回不一致，请保留备份并核对。')
  await ensureAccessoryWarehouseRecords()
}
/** 可下载的完整 JSON 文件：附件使用字节数组，不把 Base64 写进业务记录或浏览器存储。 */
export async function encodeAccessoryWarehouseBackup(backup: AccessoryWarehouseBackup): Promise<Blob> {
  validateAccessoryWarehouseBackup(backup)
  const files = await Promise.all(backup.files.map(async file => ({ id: file.id, type: file.blob.type,
    bytes: Array.from(new Uint8Array(await file.blob.arrayBuffer())) })))
  return new Blob([JSON.stringify({ ...backup, files })], { type: 'application/json' })
}
export async function parseAccessoryWarehouseBackup(file: Blob): Promise<AccessoryWarehouseBackup> {
  let value: any
  try { value = JSON.parse(await file.text()) } catch { throw new Error('备份文件无法解析，未恢复。') }
  if (!Array.isArray(value?.files) || value.files.some((entry: any) => !Array.isArray(entry.bytes) || entry.bytes.some((byte: unknown) => !Number.isInteger(byte) || Number(byte) < 0 || Number(byte) > 255))) throw new Error('备份附件字节格式错误，未恢复。')
  value.files = value.files.map((entry: any) => ({ id: entry.id, blob: new Blob([new Uint8Array(entry.bytes)], { type: entry.type || '' }) }))
  validateAccessoryWarehouseBackup(value)
  return value
}
