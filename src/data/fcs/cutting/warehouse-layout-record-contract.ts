import { isWarehouseLayoutSnapshot, warehouseLayoutSourceKeys, type FactoryWarehouseLayoutSnapshot, type WarehouseLayoutChangeRecord } from '../../../pages/process-factory/cutting/warehouse-location-layout-store.ts'
import type { CuttingStoredRecord } from './cutting-record-repository.ts'

type LayoutScope = Pick<FactoryWarehouseLayoutSnapshot, 'factoryId' | 'warehouseKind' | 'warehouseId'>
const sameScope = (left: LayoutScope, right: LayoutScope) => left.factoryId === right.factoryId
  && left.warehouseKind === right.warehouseKind && left.warehouseId === right.warehouseId
const text = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim())
const object = (value: unknown): value is Record<string, any> => Boolean(value) && typeof value === 'object' && !Array.isArray(value)
export const layoutRecordId = (s: LayoutScope) => `cutting-layout:${JSON.stringify([s.factoryId, s.warehouseKind, s.warehouseId])}`
export const layoutChangeRecordId = (s: WarehouseLayoutChangeRecord) => `cutting-layout-change:${JSON.stringify([s.factoryId, s.warehouseKind, s.warehouseId, s.changeRecordId])}`

export function isWarehouseLayoutChange(value: unknown): value is WarehouseLayoutChangeRecord {
  const s = value as WarehouseLayoutChangeRecord
  return Boolean(s) && text(s.changeRecordId) && isWarehouseLayoutSnapshot(s.beforeSnapshot) && isWarehouseLayoutSnapshot(s.afterSnapshot)
    && sameScope(s, s.beforeSnapshot) && sameScope(s, s.afterSnapshot)
    && s.beforeVersion === s.beforeSnapshot.layoutVersion && s.afterVersion === s.afterSnapshot.layoutVersion
    && s.afterVersion === s.beforeVersion + 1 && text(s.updatedBy) && text(s.updatedAt) && Number.isFinite(Date.parse(s.updatedAt))
    && s.updatedAt === s.afterSnapshot.updatedAt && s.updatedBy === s.afterSnapshot.updatedBy
}
export interface WarehouseLayoutMigration {
  id: string
  phase: 'VERIFIED' | 'COMPLETE'
  factoryId: string
  warehouseKind: 'WAIT_PROCESS' | 'WAIT_HANDOVER'
  warehouseId: string
  sources: Array<{ key: string; fingerprint: string }>
  recordIds: string[]
  contentFingerprint: string
}

/** Validate the configuration and its own history together, including interrupted migrations. */
export function validateWarehouseLayoutStoredRecords(records: CuttingStoredRecord[]): void {
  const layouts = new Map<string, FactoryWarehouseLayoutSnapshot>()
  const histories = new Map<string, WarehouseLayoutChangeRecord[]>()
  const migrations: WarehouseLayoutMigration[] = []
  for (const row of records) {
    if (!row || !text(row.id) || !text(row.collection)) throw new Error('库位记录格式不完整，原资料已保留。')
    if (row.collection === 'warehouse-layouts') {
      const s = row.value as FactoryWarehouseLayoutSnapshot
      if (!isWarehouseLayoutSnapshot(s) || row.id !== layoutRecordId(s) || !text(s.updatedAt)
        || !Number.isFinite(Date.parse(s.updatedAt)) || !text(s.updatedBy) || layouts.has(row.id)) throw new Error('库位配置记录不完整，原资料已保留。')
      layouts.set(row.id, s)
    } else if (row.collection === 'warehouse-layout-changes') {
      if (!isWarehouseLayoutChange(row.value) || row.id !== layoutChangeRecordId(row.value)) throw new Error('库位修改历史不完整，原资料已保留。')
      const id = layoutRecordId(row.value), history = histories.get(id) || []
      history.push(row.value)
      histories.set(id, history)
    } else if (row.collection === 'warehouse-layout-migrations') {
      const s = row.value as WarehouseLayoutMigration
      if (!object(s) || row.id !== s.id || !s.id.startsWith('warehouse-layout-migration:') || !text(s.factoryId) || !text(s.warehouseId)
        || !['WAIT_PROCESS', 'WAIT_HANDOVER'].includes(s.warehouseKind) || !['VERIFIED', 'COMPLETE'].includes(s.phase)
        || !Array.isArray(s.sources) || !s.sources.length || new Set(s.sources.map(item => item?.key)).size !== s.sources.length
        || s.sources.some(item => !object(item) || !warehouseLayoutSourceKeys(s.factoryId, s.warehouseKind, s.warehouseId).includes(item.key) || !text(item.fingerprint))
        || !Array.isArray(s.recordIds) || !s.recordIds.length || s.recordIds.some(id => !text(id))
        || new Set(s.recordIds).size !== s.recordIds.length || !s.recordIds.includes(layoutRecordId(s)) || !text(s.contentFingerprint)) throw new Error('库位迁移核对记录不完整，原资料已保留。')
      migrations.push(s)
    }
  }
  for (const [id, history] of histories) {
    const current = layouts.get(id)
    const ordered = [...history].sort((a, b) => b.afterVersion - a.afterVersion)
    if (!current || new Set(history.map(row => row.afterVersion)).size !== history.length
      || ordered[0].afterVersion !== current.layoutVersion || JSON.stringify(ordered[0].afterSnapshot) !== JSON.stringify(current)) throw new Error('当前库位配置与修改历史版本不一致，原资料已保留。')
  }
  const byId = new Map(records.map(row => [row.id, row]))
  for (const job of migrations) {
    if (!layouts.has(layoutRecordId(job))) throw new Error('库位迁移缺少当前配置，原资料已保留。')
    for (const id of job.recordIds) {
      const target = byId.get(id)
      // Completed migrations retain their audit identity after the existing 100-history retention policy.
      if (!target && job.phase === 'COMPLETE') continue
      if (!target || !['warehouse-layouts', 'warehouse-layout-changes'].includes(target.collection)
        || !sameScope(job, target.value as LayoutScope)) throw new Error('库位迁移目标缺失或不属于该仓库，原资料已保留。')
    }
  }
}
