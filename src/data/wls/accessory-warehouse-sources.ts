import {
  listMaterialPrepOrderProjections,
  listMaterialPrepProductionIdsForIdentities,
  PRODUCTION_MATERIAL_PREP_STORAGE_KEY,
  isAccessoryWarehouseScopeLine,
  type MaterialPrepLine,
  type MaterialPrepOrderProjection,
} from '../fcs/cutting/production-material-prep.ts'
import { getBrowserLocalStorage, type BrowserStorageLike } from '../browser-storage.ts'
import { hydrateProductionContextRecords } from '../fcs/production-context-records.ts'
import { productionOrders, type ProductionOrder } from '../fcs/production-orders.ts'
import { listRuntimeProcessTasks, type RuntimeProcessTask } from '../fcs/runtime-process-tasks.ts'
import { listEffectiveTaskAssignments, type EffectiveTaskAssignment } from '../fcs/effective-task-assignments.ts'
import { listFactoryMasterRecords } from '../fcs/factory-master-store.ts'
import type { Factory } from '../fcs/factory-types.ts'
import type { ProductionOrderTechPackSnapshot, TechPackBomItemSnapshot } from '../fcs/production-tech-pack-snapshot-types.ts'
import { ensureAccessoryWarehouseRecords, listAccessoryRecords } from './accessory-warehouse-records.ts'
import type { AccessoryLine, AccessoryPreparation, AccessoryPurpose } from './accessory-warehouse-flow.ts'
import { listAccessoryStockSources, projectAccessoryPreparationAvailability } from './accessory-warehouse-stock-sources.ts'
import type { AccessoryStock } from './accessory-warehouse-stock.ts'

export interface AccessoryWarehouseSourceIssue {
  code: 'UNKNOWN_PURPOSE' | 'SOURCE_DATA' | 'SOURCE_CLOSED' | 'SOURCE_CHANGED' | 'SOURCE_MISSING' | 'FACTORY_MISSING' | 'FACTORY_CONFLICT' | 'SAVED_DATA' | 'LEGACY_CONFLICT'
  preparationId: string
  lineId?: string
  message: string
  blocking: boolean
}
export interface AccessoryPreparationSourceInput {
  projections: MaterialPrepOrderProjection[]
  orders: Array<Pick<ProductionOrder, 'productionOrderId' | 'techPackSnapshot'>>
  tasks: RuntimeProcessTask[]
  factories: Array<Pick<Factory, 'id' | 'name'>>
  assignments: EffectiveTaskAssignment[]
  savedPreparations?: AccessoryPreparation[]
}
export interface AccessoryLegacyConflictFragment { preparationId: string; field: string; sourceId: string; entry: Record<string, unknown> }
/** 完成迁移后，仅核对重新出现的本范围事实；保留不变的共用头不是新冲突。 */
export function findPostMigrationAccessoryConflicts(raw: string | null, preparations: AccessoryPreparation[], archives: Array<{ field?: string; sourceId?: string; retainedShared?: boolean; entry?: unknown }>): AccessoryLegacyConflictFragment[] {
  if (!raw) return []
  const legacy = JSON.parse(raw) as Record<string, unknown>
  const scope = new Set(preparations.flatMap(preparation => preparation.lines.map(line => line.id)))
  const orders = new Set(preparations.map(preparation => preparation.id))
  const lineIds = (value: unknown): string[] => {
    if (Array.isArray(value)) return value.flatMap(lineIds)
    if (!value || typeof value !== 'object') return []
    const row = value as Record<string, unknown>
    return [...(typeof row.prepLineId === 'string' ? [row.prepLineId] : []), ...Object.values(row).flatMap(lineIds)]
  }
  const result: AccessoryLegacyConflictFragment[] = []
  const fields = { prepRecords: 'prepRecordId', pickupRecords: 'pickupRecordId', pickupReturnRecords: 'returnRecordId', rejectRecords: 'rejectId', closedOrders: 'prepOrderId' }
  for (const [field, identity] of Object.entries(fields)) {
    const rows = legacy[field]
    if (rows !== undefined && !Array.isArray(rows)) throw new Error('原配料资料结构不完整，不能判断迁移后的旧写冲突。')
    for (const value of (rows || []) as unknown[]) {
      if (!value || typeof value !== 'object') continue
      const entry = value as Record<string, unknown>, preparationId = String(entry.prepOrderId || ''), sourceId = String(entry[identity] || '')
      if (!orders.has(preparationId) || !(field === 'closedOrders' || lineIds(entry).some(id => scope.has(id)))) continue
      const previous = archives.find(archive => archive.field === field && archive.sourceId === sourceId)
      if (previous?.retainedShared && JSON.stringify(previous.entry) === JSON.stringify(entry)) continue
      result.push({ preparationId, field, sourceId, entry: structuredClone(entry) })
    }
  }
  return result
}
let sourceIssues: AccessoryWarehouseSourceIssue[] = []
let preparationReadFailure = ''

const CUTTING_CODES = new Set(['CUT', 'CUT_PANEL', 'CUTTING'])
const exactPurposeNames: Record<string, AccessoryPurpose> = {
  价格吊牌: '价格吊牌', 品牌吊牌: '品牌吊牌', 吊粒: '吊粒', 车缝线: '车缝线', 缝纫线: '车缝线',
}
const exactMaterialPurposes: Record<string, AccessoryPurpose> = {
  'AW-DEMO-ZIPPER': '其他',
  'AW-DEMO-BUTTON': '其他',
  'HG-DEMO-ZIPPER-GRY-60': '其他',
  'HG-DEMO-RIB-GRY': '其他',
  'ACC-ELASTIC-42CM': '其他',
  'LABEL-SPU-2024-011-CARE': '其他',
}
const templatePurposes: Record<string, AccessoryPurpose> = {
  'accessory-zipper': '其他', 'accessory-button': '其他', 'accessory-label': '其他',
  'accessory-main-label': '其他', 'accessory-care-label': '其他', 'yarn-stitching': '车缝线',
}
function purposeOf(line: MaterialPrepLine, projection: MaterialPrepOrderProjection, bom?: TechPackBomItemSnapshot): AccessoryPurpose {
  // 已核对的样例 BOM 精确编码；不能用包含“吊牌/线”等词的模糊命名判断用途。
  const known = exactMaterialPurposes[bom?.materialCode || line.materialSku]
  if (known) return known
  const template = Object.entries(templatePurposes).find(([code]) => line.materialSku === `${projection.order.spu}-bom-${code}`)
  if (template) return template[1]
  return exactPurposeNames[bom?.name || line.materialName] || '待核对'
}
function findBom(snapshot: ProductionOrderTechPackSnapshot | null | undefined, line: MaterialPrepLine): TechPackBomItemSnapshot | undefined {
  return snapshot?.bomItems.find(bom => line.prepLineId === `${line.prepOrderId}:${snapshot.sourceTechPackVersionId}:${bom.id}`)
}
function cuttingIdentity(input: AccessoryPreparationSourceInput, productionOrderId: string, preparationId: string, issues: AccessoryWarehouseSourceIssue[]) {
  const candidates = input.tasks.filter(task => task.productionOrderId === productionOrderId
    && task.executionEnabled !== false && !task.mergedIntoTaskId && !task.isSplitSource
    && (CUTTING_CODES.has(task.processBusinessCode || task.processCode) || task.mergedTaskType === 'CUTTING_SEWING_IRON_PACK'))
  const ids = new Set<string>()
  let pending = false
  for (const task of candidates) {
    const history = input.assignments.filter(assignment => assignment.runtimeTaskId === task.taskId)
    if (history.length) {
      const current = history.filter(assignment => assignment.status === 'EFFECTIVE')
      if (!current.length) pending = true
      current.forEach(assignment => ids.add(assignment.factoryId))
    } else if ((task.assignmentStatus === 'ASSIGNED' || task.assignmentStatus === 'AWARDED') && task.assignedFactoryId) {
      ids.add(task.assignedFactoryId)
    } else pending = true
  }
  ids.delete('')
  if (ids.size > 1) {
    issues.push({ code: 'FACTORY_CONFLICT', preparationId, message: '有效裁剪任务存在不同承接工厂，请先核对裁剪任务。', blocking: true })
    return { cuttingFactoryId: null, cuttingFactoryName: null }
  }
  // 同单部分裁剪任务未分配时，不能按已分配部分发出整单辅料。
  if (pending) return { cuttingFactoryId: null, cuttingFactoryName: null }
  const [id] = ids
  if (!id) return { cuttingFactoryId: null, cuttingFactoryName: null }
  const matches = input.factories.filter(factory => factory.id === id)
  if (matches.length !== 1 || !matches[0].name.trim()) {
    issues.push({ code: 'FACTORY_MISSING', preparationId, message: '裁剪任务已分配，但对应工厂档案缺失或身份重复，请核对档案。', blocking: true })
    return { cuttingFactoryId: id, cuttingFactoryName: null }
  }
  return { cuttingFactoryId: id, cuttingFactoryName: matches[0].name }
}
function sourceSignature(preparation: AccessoryPreparation): string {
  return JSON.stringify([preparation.productionOrderId, preparation.techPackVersion, [...preparation.lines].sort((a, b) => a.id.localeCompare(b.id)).map(line =>
    [line.id, line.materialSku, line.unit, line.requiredQty, line.color, line.spec, line.purpose, line.requiresCutting])])
}
function savedPreparationIssue(preparation: AccessoryPreparation): string {
  if (!Number.isInteger(preparation.version) || preparation.version < 0 || !Array.isArray(preparation.history)) return '保存的配料版本或记录不完整。'
  if (!['待配料', '配料中', '已配齐'].includes(preparation.status)) return '保存的配料状态无法识别。'
  if (preparation.lines.some(line => !Number.isFinite(line.preparedQty) || line.preparedQty < 0 || !Number.isFinite(line.availableQty) || line.availableQty < 0)) return '保存的实配或可用数量无效。'
  return ''
}
/** 只读转换，可独立验源；本函数不生成任务、不保存种子、不推进任何业务状态。 */
export function buildAccessoryPreparationSources(input: AccessoryPreparationSourceInput): { preparations: AccessoryPreparation[]; issues: AccessoryWarehouseSourceIssue[] } {
  const issues: AccessoryWarehouseSourceIssue[] = []
  const preparations: AccessoryPreparation[] = []
  const saved = new Map((input.savedPreparations || []).map(preparation => [preparation.id, preparation]))
  for (const projection of input.projections) {
    const { order } = projection
    const snapshot = input.orders.find(candidate => candidate.productionOrderId === order.productionOrderId)?.techPackSnapshot
    const lines: AccessoryLine[] = []
    for (const line of projection.lines) {
      const bom = findBom(snapshot, line)
      const purpose = purposeOf(line, projection, bom)
      if (!isAccessoryWarehouseScopeLine(line, order, snapshot || null)) continue
      if (line.runtimeBomLine && !bom) issues.push({ code: 'SOURCE_DATA', preparationId: order.prepOrderId, lineId: line.prepLineId, message: `${line.materialName}无法匹配当前冻结 BOM。`, blocking: true })
      if (line.sourceDataIssue) issues.push({ code: 'SOURCE_DATA', preparationId: order.prepOrderId, lineId: line.prepLineId, message: line.sourceDataIssue, blocking: true })
      if (purpose === '待核对') issues.push({ code: 'UNKNOWN_PURPOSE', preparationId: order.prepOrderId, lineId: line.prepLineId, message: `${line.materialName}的用途尚未核对，不能完成配齐或后道分流。`, blocking: true })
      if (!line.materialSku.trim() || !line.unit.trim() || line.unit === '待确认'
        || !Number.isFinite(line.requiredQty) || line.requiredQty <= 0
        || !Number.isFinite(line.confirmedPrepQty) || line.confirmedPrepQty < 0
        || !Number.isFinite(line.availableStockQty) || line.availableStockQty < 0) {
        issues.push({ code: 'SOURCE_DATA', preparationId: order.prepOrderId, lineId: line.prepLineId, message: `${line.materialName}的编码、单位或数量无效，请核对来源。`, blocking: true })
      }
      lines.push({
        id: line.prepLineId, materialSku: line.materialSku, materialName: line.materialName,
        imageUrl: line.materialImageUrl, color: line.color, spec: line.spec, unit: line.unit,
        requiredQty: line.requiredQty, preparedQty: line.confirmedPrepQty,
        availableQty: line.availableStockQty, locationId: line.stockLocationCode,
        purpose, requiresCutting: false,
      })
    }
    if (!lines.length) continue
    if (order.isClosed) issues.push({ code: 'SOURCE_CLOSED', preparationId: order.prepOrderId,
      message: `原配料单已按实关闭${order.closeReason ? `：${order.closeReason}` : ''}，不能重新配料或创建新调拨。`, blocking: true })
    const allPrepared = lines.every(line => line.preparedQty >= line.requiredQty && line.requiredQty > 0)
    const base: AccessoryPreparation = {
      id: order.prepOrderId, productionOrderId: order.productionOrderId, productionOrderNo: order.productionOrderNo,
      styleName: order.styleName, styleImageUrl: order.spuImageUrl,
      techPackVersion: snapshot?.sourceTechPackVersionId || `legacy:${order.bomSourceLabel || order.prepOrderId}`,
      ...cuttingIdentity(input, order.productionOrderId, order.prepOrderId, issues),
      version: 0, status: allPrepared ? '已配齐' : lines.some(line => line.preparedQty > 0) ? '配料中' : '待配料',
      remark: '', lines,
      history: projection.prepRecords.filter(record => record.recordStatus === 'CONFIRMED'
        && (lines.some(line => line.id === record.prepLineId) || record.items?.some(item => lines.some(line => line.id === item.prepLineId))))
        .map(record => ({ at: record.confirmedAt || record.preparedAt, by: record.confirmedBy || record.operatorName,
          action: '原配料记录', detail: `${record.batchNo || '配料记录'}；${record.remark || '已确认配料'}` })),
    }
    const existing = saved.get(base.id)
    saved.delete(base.id)
    if (!existing) { preparations.push(base); continue }
    if (!Array.isArray(existing.lines) || sourceSignature(existing) !== sourceSignature(base)) {
      issues.push({ code: 'SOURCE_CHANGED', preparationId: base.id, message: '技术包、物料或需求范围已变化，原配料记录已保留；重新核对前不能套用旧清单。', blocking: true })
      preparations.push(base)
      continue
    }
    const savedIssue = savedPreparationIssue(existing)
    if (savedIssue) {
      issues.push({ code: 'SAVED_DATA', preparationId: base.id, message: savedIssue, blocking: true })
      preparations.push(base)
      continue
    }
    preparations.push({ ...structuredClone(existing), cuttingFactoryId: base.cuttingFactoryId, cuttingFactoryName: base.cuttingFactoryName })
  }
  for (const preparation of saved.values()) issues.push({ code: 'SOURCE_MISSING', preparationId: preparation.id,
    message: '保存的配料记录已找不到对应当前生产单物料范围，原记录保留，需核对来源。', blocking: true })
  return { preparations, issues }
}

function checkedLegacyStorage(): BrowserStorageLike | null {
  const storage = getBrowserLocalStorage()
  let migrated = false
  try { migrated = listAccessoryRecords<{ id: string; phase?: string }>('migration').some(row => row.id === 'legacy-preparation-v1' && ['VERIFIED', 'COMPLETE', 'RESTORED'].includes(row.phase || '')) } catch { /* 未准备记录时仍须正常报告原读取错误。 */ }
  if (typeof window !== 'undefined' && !storage) {
    if (migrated) return null
    throw new Error('原配料资料存储不可读取，未使用空资料替代。请恢复访问后重新读取。')
  }
  let raw: string | null | undefined
  try { raw = storage?.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY) }
  catch (error) {
    if (migrated) return null
    throw error
  }
  if (raw) {
    let parsed: unknown
    try { parsed = JSON.parse(raw) } catch {
      if (migrated) return null
      throw new Error('原配料资料格式损坏，已保留原资料，请先完成迁移核对。')
    }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray((parsed as { prepRecords?: unknown }).prepRecords)) {
      throw new Error('原配料资料缺少配料记录，已保留原资料，请先完成迁移核对。')
    }
  }
  return storage
}
export async function prepareAccessoryWarehouseSources(): Promise<void> {
  preparationReadFailure = ''
  try {
    await hydrateProductionContextRecords()
    await ensureAccessoryWarehouseRecords()
    checkedLegacyStorage()
  } catch (error) {
    preparationReadFailure = error instanceof Error ? error.message : String(error)
    throw error
  }
}
/** Current ownership only; ordinary preparation pages still use the full projection below. */
export function listAccessoryPreparationProductionIdentities(candidates: ReadonlySet<string>): ReadonlySet<string> {
  if (preparationReadFailure) throw new Error(preparationReadFailure)
  try {
    const legacyStorage = checkedLegacyStorage()
    const saved = listAccessoryRecords<AccessoryPreparation>('preparation')
    const productionOrderIds = listMaterialPrepProductionIdsForIdentities(candidates)
    for (const row of saved) if (candidates.has(row.productionOrderId) || candidates.has(row.productionOrderNo)) productionOrderIds.add(row.productionOrderId)
    // Keep the existing stock integrity gate even when the source scope is empty.
    listAccessoryStockSources(listAccessoryRecords<AccessoryStock>('stock'))
    if (!productionOrderIds.size) return new Set<string>()
    const result = buildAccessoryPreparationSources({
      projections: listMaterialPrepOrderProjections(legacyStorage, { productionOrderIds }), orders: productionOrders,
      tasks: listRuntimeProcessTasks(), factories: listFactoryMasterRecords(), assignments: listEffectiveTaskAssignments(),
      savedPreparations: saved.filter(row => productionOrderIds.has(row.productionOrderId)),
    })
    // Ownership needs neither copied availability rows nor changes to the
    // business-page issue catalogue.
    return new Set(result.preparations.flatMap(row => [row.productionOrderId, row.productionOrderNo]))
  } catch (error) {
    preparationReadFailure = error instanceof Error ? error.message : String(error)
    throw error
  }
}
export function listAccessoryPreparations(): AccessoryPreparation[] {
  if (preparationReadFailure) throw new Error(preparationReadFailure)
  try {
    const legacyStorage = checkedLegacyStorage()
    const result = buildAccessoryPreparationSources({
      projections: listMaterialPrepOrderProjections(legacyStorage), orders: productionOrders,
      tasks: listRuntimeProcessTasks(), factories: listFactoryMasterRecords(), assignments: listEffectiveTaskAssignments(),
      savedPreparations: listAccessoryRecords<AccessoryPreparation>('preparation'),
    })
    sourceIssues = result.issues
    const archives = listAccessoryRecords<{ kind?: string; field?: string; entry?: { prepOrderId?: string; pickedQty?: number; closeReason?: string } }>('migration')
    const migrated = listAccessoryRecords<{ id?: string; phase?: string }>('migration').some(row => row.id === 'legacy-preparation-v1' && ['COMPLETE', 'RESTORED'].includes(row.phase || ''))
    if (migrated) for (const conflict of findPostMigrationAccessoryConflicts(legacyStorage?.getItem(PRODUCTION_MATERIAL_PREP_STORAGE_KEY) || null, result.preparations, archives)) {
      sourceIssues.push({ code: 'LEGACY_CONFLICT', preparationId: conflict.preparationId,
        message: '迁移后原配料资料又出现本范围记录，可能仍有旧页面写入。新旧资料均已保留；停止旧页面操作并核对冲突前，不能继续办理。', blocking: true })
    }
    for (const row of archives.filter(row => row.kind === 'LEGACY_ENTRY' && row.entry?.prepOrderId)) {
      if (row.field === 'closedOrders') sourceIssues.push({ code: 'SOURCE_CLOSED', preparationId: row.entry!.prepOrderId!,
        message: `原配料单已按实关闭${row.entry?.closeReason ? `：${row.entry.closeReason}` : ''}，原记录保留，不能重新配料或创建调拨。`, blocking: true })
      if (row.field === 'pickupRecords' && Number(row.entry?.pickedQty) > 0) sourceIssues.push({ code: 'SOURCE_DATA', preparationId: row.entry!.prepOrderId!,
        message: '旧资料已有实际领料，原数量和交接历史已保留。需核对实物去向后再办理新调拨，不能重复发出。', blocking: true })
    }
    const stocks = listAccessoryStockSources(listAccessoryRecords<AccessoryStock>('stock'))
    return result.preparations.map(preparation => projectAccessoryPreparationAvailability(preparation, stocks))
  } catch (error) {
    preparationReadFailure = error instanceof Error ? error.message : String(error)
    throw error
  }
}
export function getAccessoryPreparation(id: string): AccessoryPreparation | undefined {
  return listAccessoryPreparations().find(preparation => preparation.id === id)
}
export function listAccessoryWarehouseSourceIssues(preparationId?: string): AccessoryWarehouseSourceIssue[] {
  return structuredClone(sourceIssues.filter(issue => !preparationId || issue.preparationId === preparationId))
}
