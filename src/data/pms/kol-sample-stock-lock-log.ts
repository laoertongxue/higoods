import { listPmsKolStock, type PmsKolStockRow } from './kol-sample-stock.ts'
import { PMS_STORES, pmsAll } from './idb-storage.ts'
/**
 * 锁定操作记录(原型 mock,跟随 manage.higood.ai /pms/kol_sample_stock/lock_log)。
 *
 * 记录每一次手动锁定、手动释放、申请单占用、驳回释放占用、跨日占用归零,
 * 包含操作前/后的手动锁定池/锁定已占用/锁定未占用数量,
 * 关联申请单 + code(申请单占用 / 驳回释放占用才有)与备注。
 * 原型只读展示,过滤与导出由前端处理。
 */
export type PmsKolLockOpType =
  | '手动锁定'
  | '手动释放'
  | '申请单自动占用'
  | '驳回释放占用'
  | '跨日占用归零'

export const PmsKolLockOpTypeList: PmsKolLockOpType[] = [
  '手动锁定',
  '手动释放',
  '申请单自动占用',
  '驳回释放占用',
  '跨日占用归零',
]

export interface PmsKolLockLogRow {
  id: string
  _pmsBaseVersion?: number
  operatedAt: string
  lockDate: string
  opType: PmsKolLockOpType
  sku: string
  spu: string
  deltaQty: number
  manualPoolBefore: number
  manualPoolAfter: number
  occupiedBefore: number
  occupiedAfter: number
  freeBefore: number
  freeAfter: number
  relatedApplyId: string
  relatedApplyCode: string
  operator: string
  remark: string
}

function makeId(seq: number): string {
  return `LK-${seq.toString().padStart(6, '0')}`
}

function seedLockLogs(): PmsKolLockLogRow[] {
  const stocks=listPmsKolStock()
  const locks=stocks.slice(0,11).map((stock,index)=>({...makeKolLockRow({...stock,vkolManualLockedPool:0,lockedOccupied:0},{...stock,lockedOccupied:0},'手动锁定',`LOCK-DEMO-${index+1}`),operatedAt:'2026-10-12T08:00:00',lockDate:'2026-10-12'}))
  const occupies=stocks.slice(0,3).map((stock,index)=>({...makeKolLockRow({...stock,lockedOccupied:0},stock,'申请单自动占用',`OCCUPY-DEMO-${index+1}`,`APPLY-DEMO-${index+1}`),operatedAt:'2026-10-13T08:00:00',lockDate:'2026-10-13'}))
  return [...occupies,...locks]
}

interface LockLogRuntime {
  rows: PmsKolLockLogRow[]
}

function getRuntime(): LockLogRuntime {
  return lockLogRuntime ??= {rows:seedLockLogs()}
}

let lockLogRuntime: LockLogRuntime | null = null

export function listPmsKolLockLog(): PmsKolLockLogRow[] {
  return getRuntime().rows.slice().sort((a,b)=>b.operatedAt.localeCompare(a.operatedAt))
}

export interface PmsKolLockLogFilter {
  search?: string
  opType?: '' | '全部' | PmsKolLockOpType
  lockDate?: string
  applyId?: string
}

export function filterPmsKolLockLog(filter: PmsKolLockLogFilter): PmsKolLockLogRow[] {
  const search = filter.search?.trim().toLowerCase() ?? ''
  const applyId = filter.applyId?.trim().toLowerCase() ?? ''
  return getRuntime().rows.filter((row) => {
    if (search) {
      const candidates = [row.sku, row.spu, row.operator].join(' ').toLowerCase()
      if (!candidates.includes(search)) return false
    }
    if (filter.opType && filter.opType !== '全部') {
      if (row.opType !== filter.opType) return false
    }
    if (filter.lockDate) {
      const ts = Date.parse(row.lockDate.replace(/-/g, '/'))
      const target = Date.parse(filter.lockDate.replace(/-/g, '/'))
      if (ts !== target) return false
    }
    if (applyId) {
      if (!row.relatedApplyId.toLowerCase().includes(applyId) && !row.relatedApplyCode.toLowerCase().includes(applyId)) return false
    }
    return true
  })
}

export interface PmsKolLockLogStats {
  total: number
  manualLock: number
  manualRelease: number
  applyOccupy: number
  rejectRelease: number
  dailyReset: number
}

export function summarizePmsKolLockLog(filter: PmsKolLockLogFilter): PmsKolLockLogStats {
  const rows = filterPmsKolLockLog(filter)
  return rows.reduce<PmsKolLockLogStats>(
    (acc, row) => ({
      total: acc.total + 1,
      manualLock: acc.manualLock + (row.opType === '手动锁定' ? 1 : 0),
      manualRelease: acc.manualRelease + (row.opType === '手动释放' ? 1 : 0),
      applyOccupy: acc.applyOccupy + (row.opType === '申请单自动占用' ? 1 : 0),
      rejectRelease: acc.rejectRelease + (row.opType === '驳回释放占用' ? 1 : 0),
      dailyReset: acc.dailyReset + (row.opType === '跨日占用归零' ? 1 : 0),
    }),
    { total: 0, manualLock: 0, manualRelease: 0, applyOccupy: 0, rejectRelease: 0, dailyReset: 0 },
  )
}

let hydration: Promise<void> | null = null
export function hydratePmsKolLockLog(): Promise<void> {
  return hydration ??= pmsAll<PmsKolLockLogRow>(PMS_STORES.pmsKolLockLogs).then(appendKolLockRows).catch(error => { hydration = null; throw error })
}
export function appendKolLockRows(rows: PmsKolLockLogRow[]): void {
  for (const row of rows) { const index = getRuntime().rows.findIndex(old => old.id === row.id); if(index < 0) getRuntime().rows.unshift(row); else getRuntime().rows[index] = row }
}
export function makeKolLockRow(before: PmsKolStockRow, after: PmsKolStockRow, opType: PmsKolLockOpType, operationId: string, relatedApplyId = ''): PmsKolLockLogRow {
  const at = new Date().toISOString()
  return { id: `${operationId}:${before.sku}:${opType}`, operatedAt: at, lockDate: at.slice(0,10), opType, sku: before.sku, spu: before.spu,
    deltaQty: opType === '申请单自动占用' || opType === '驳回释放占用' ? after.lockedOccupied - before.lockedOccupied : after.vkolManualLockedPool - before.vkolManualLockedPool,
    manualPoolBefore: before.vkolManualLockedPool, manualPoolAfter: after.vkolManualLockedPool, occupiedBefore: before.lockedOccupied, occupiedAfter: after.lockedOccupied,
    freeBefore: before.vkolManualLockedPool - before.lockedOccupied, freeAfter: after.vkolManualLockedPool - after.lockedOccupied,
    relatedApplyId, relatedApplyCode: relatedApplyId, operator: '采购管理', remark: '' }
}
