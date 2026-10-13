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

const ROWS: PmsKolLockLogRow[] = [
  // 跨日归零 + 手动锁定
  { id: makeId(1), operatedAt: '2026-08-21 16:55:17', lockDate: '2026-08-21', opType: '手动锁定', sku: 'MODSP26012701-blue-xl', spu: 'MODSP26012701', deltaQty: 2, manualPoolBefore: 0, manualPoolAfter: 2, occupiedBefore: 0, occupiedAfter: 0, freeBefore: 0, freeAfter: 2, relatedApplyId: '-', relatedApplyCode: '-', operator: '六六', remark: 'KOL 库存 12' },
  { id: makeId(2), operatedAt: '2026-08-21 16:55:17', lockDate: '2026-08-21', opType: '手动锁定', sku: 'MODSP26012701-blue-m', spu: 'MODSP26012701', deltaQty: 0, manualPoolBefore: 0, manualPoolAfter: 0, occupiedBefore: 0, occupiedAfter: 0, freeBefore: 0, freeAfter: 0, relatedApplyId: '-', relatedApplyCode: '-', operator: '六六', remark: 'KOL 库存 3' },
  { id: makeId(3), operatedAt: '2026-08-21 16:55:17', lockDate: '2026-08-21', opType: '手动锁定', sku: 'MODSP26012701-blue-l', spu: 'MODSP26012701', deltaQty: 2, manualPoolBefore: 0, manualPoolAfter: 2, occupiedBefore: 0, occupiedAfter: 0, freeBefore: 0, freeAfter: 2, relatedApplyId: '-', relatedApplyCode: '-', operator: '六六', remark: 'KOL 库存 13' },
  { id: makeId(4), operatedAt: '2026-08-21 16:55:17', lockDate: '2026-08-21', opType: '手动锁定', sku: 'MODSP26012701-black-xl', spu: 'MODSP26012701', deltaQty: 2, manualPoolBefore: 0, manualPoolAfter: 2, occupiedBefore: 0, occupiedAfter: 0, freeBefore: 0, freeAfter: 2, relatedApplyId: '-', relatedApplyCode: '-', operator: '六六', remark: 'KOL 库存 10' },
  { id: makeId(5), operatedAt: '2026-08-21 16:55:17', lockDate: '2026-08-21', opType: '手动锁定', sku: 'MODHS25110717-khaki-xl', spu: 'MODHS25110717', deltaQty: 2, manualPoolBefore: 0, manualPoolAfter: 2, occupiedBefore: 0, occupiedAfter: 0, freeBefore: 0, freeAfter: 2, relatedApplyId: '-', relatedApplyCode: '-', operator: '六六', remark: 'KOL 库存 12' },
  { id: makeId(6), operatedAt: '2026-08-21 16:55:17', lockDate: '2026-08-21', opType: '手动锁定', sku: 'MODHS25110717-khaki-l', spu: 'MODHS25110717', deltaQty: 2, manualPoolBefore: 0, manualPoolAfter: 2, occupiedBefore: 0, occupiedAfter: 0, freeBefore: 0, freeAfter: 2, relatedApplyId: '-', relatedApplyCode: '-', operator: '六六', remark: 'KOL 库存 10' },
  // 申请单自动占用
  { id: makeId(7), operatedAt: '2026-08-21 17:11:56', lockDate: '2026-08-21', opType: '申请单自动占用', sku: 'ASYZZ26052224-red-l', spu: 'ASYZZ26052224', deltaQty: 1, manualPoolBefore: 6, manualPoolAfter: 6, occupiedBefore: 0, occupiedAfter: 1, freeBefore: 6, freeAfter: 5, relatedApplyId: 'KS2NHPI1Z5QF40116248', relatedApplyCode: '31102fefd2b7981657988f44', operator: '系统', remark: '手动寄样申请提交占用' },
  { id: makeId(8), operatedAt: '2026-08-21 17:11:56', lockDate: '2026-08-21', opType: '申请单自动占用', sku: 'ASYYC7226-coffee-l', spu: 'ASYYC7226', deltaQty: 1, manualPoolBefore: 6, manualPoolAfter: 6, occupiedBefore: 0, occupiedAfter: 1, freeBefore: 6, freeAfter: 5, relatedApplyId: 'KS2NHPI1Z5QF40116248', relatedApplyCode: '31102fefd2b7981657988f44', operator: '系统', remark: '手动寄样申请提交占用' },
  { id: makeId(9), operatedAt: '2026-08-21 17:11:56', lockDate: '2026-08-21', opType: '申请单自动占用', sku: 'ASYXL110799-sameasphoto-onesize', spu: 'ASYXL110799', deltaQty: 1, manualPoolBefore: 5, manualPoolAfter: 5, occupiedBefore: 0, occupiedAfter: 1, freeBefore: 5, freeAfter: 4, relatedApplyId: 'KS2NHPI1Z5QF40116248', relatedApplyCode: '31102fefd2b7981657988f44', operator: '系统', remark: '手动寄样申请提交占用' },
  // 驳回释放占用
  { id: makeId(10), operatedAt: '2026-08-21 17:13:41', lockDate: '2026-08-21', opType: '驳回释放占用', sku: 'ASYZZ26052224-red-l', spu: 'ASYZZ26052224', deltaQty: -1, manualPoolBefore: 6, manualPoolAfter: 6, occupiedBefore: 1, occupiedAfter: 0, freeBefore: 5, freeAfter: 6, relatedApplyId: 'KS2NHPI1Z5QF40116248', relatedApplyCode: '31102fefd2b7981657988f44', operator: '六六', remark: '审核驳回释放占用' },
  { id: makeId(11), operatedAt: '2026-08-21 17:13:41', lockDate: '2026-08-21', opType: '驳回释放占用', sku: 'ASYYC7226-coffee-l', spu: 'ASYYC7226', deltaQty: -1, manualPoolBefore: 6, manualPoolAfter: 6, occupiedBefore: 1, occupiedAfter: 0, freeBefore: 5, freeAfter: 6, relatedApplyId: 'KS2NHPI1Z5QF40116248', relatedApplyCode: '31102fefd2b7981657988f44', operator: '六六', remark: '审核驳回释放占用' },
  { id: makeId(12), operatedAt: '2026-08-21 17:13:41', lockDate: '2026-08-21', opType: '驳回释放占用', sku: 'ASYXL110799-sameasphoto-onesize', spu: 'ASYXL110799', deltaQty: -1, manualPoolBefore: 5, manualPoolAfter: 5, occupiedBefore: 1, occupiedAfter: 0, freeBefore: 4, freeAfter: 5, relatedApplyId: 'KS2NHPI1Z5QF40116248', relatedApplyCode: '31102fefd2b7981657988f44', operator: '六六', remark: '审核驳回释放占用' },
  // 手动释放
  { id: makeId(13), operatedAt: '2026-08-22 09:20:15', lockDate: '2026-08-22', opType: '手动释放', sku: 'MODSP26012701-blue-xl', spu: 'MODSP26012701', deltaQty: -2, manualPoolBefore: 2, manualPoolAfter: 0, occupiedBefore: 0, occupiedAfter: 0, freeBefore: 2, freeAfter: 0, relatedApplyId: '-', relatedApplyCode: '-', operator: '六六', remark: '手动释放全部锁定' },
  // 跨日归零
  { id: makeId(14), operatedAt: '2026-08-23 00:05:01', lockDate: '2026-08-23', opType: '跨日占用归零', sku: 'ASYXL110799-sameasphoto-onesize', spu: 'ASYXL110799', deltaQty: 0, manualPoolBefore: 5, manualPoolAfter: 5, occupiedBefore: 0, occupiedAfter: 0, freeBefore: 5, freeAfter: 5, relatedApplyId: '-', relatedApplyCode: '-', operator: '系统', remark: '跨日占用已自动归零' },
]

interface LockLogRuntime {
  rows: PmsKolLockLogRow[]
}

function getRuntime(): LockLogRuntime {
  return lockLogRuntime
}

const lockLogRuntime: LockLogRuntime = { rows: ROWS }

export function listPmsKolLockLog(): PmsKolLockLogRow[] {
  return getRuntime().rows.slice()
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
