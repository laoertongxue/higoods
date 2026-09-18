import { getPmsMaterial } from './materials.ts'
import { getPmsSupplier } from './suppliers.ts'
import { appendPmsLog, PmsDomainError, roundPmsQty, type PmsActorRole } from './runtime.ts'

export type PmsSupplyArchiveUnit = 'base' | 'package' | 'box'

export interface PmsSupplyArchiveSnapshot {
  version: number
  packageUnit: string
  packageQty: number
  boxQty: number
  price: number
  currency: 'RMB' | 'USD'
  effectiveFrom: string
  changedBy: string
}

export interface PmsSupplyArchive {
  archiveId: string
  supplierCode: string
  supplierName: string
  materialCode: string
  materialName: string
  materialImageUrl: string
  materialCategory: string
  baseUnit: string
  purchaseUnit: string
  packageUnit: string
  packageQty: number
  boxQty: number
  price: number
  currency: 'RMB' | 'USD'
  minOrderQty: number
  leadTimeDays: number
  isGarment: boolean
  latestQuoteAt: string
  version: number
  status: '有效' | '停用'
  snapshots: PmsSupplyArchiveSnapshot[]
}

const seeds: Array<Omit<PmsSupplyArchive, 'materialImageUrl' | 'materialCategory' | 'isGarment' | 'purchaseUnit' | 'status'>> = [
  { archiveId: 'SA-2026-0001', supplierCode: 'SUP-2026-0001', supplierName: '广州华盛面料有限公司', materialCode: 'FAB-2026-0001', materialName: '180g 纯棉针织布', baseUnit: '米', packageUnit: '卷', packageQty: 100, boxQty: 4, price: 26.5, currency: 'RMB', minOrderQty: 500, leadTimeDays: 12, latestQuoteAt: '2026-05-18', version: 3, snapshots: [] },
  { archiveId: 'SA-2026-0002', supplierCode: 'SUP-2026-0001', supplierName: '广州华盛面料有限公司', materialCode: 'FAB-2026-0003', materialName: '白色府绸', baseUnit: '米', packageUnit: '卷', packageQty: 120, boxQty: 4, price: 18.5, currency: 'RMB', minOrderQty: 300, leadTimeDays: 11, latestQuoteAt: '2026-05-26', version: 1, snapshots: [] },
  { archiveId: 'SA-2026-0003', supplierCode: 'SUP-2026-0002', supplierName: '绍兴锦达纺织有限公司', materialCode: 'FAB-2026-0002', materialName: '220g 涤棉卫衣布', baseUnit: '米', packageUnit: '卷', packageQty: 80, boxQty: 5, price: 29.8, currency: 'RMB', minOrderQty: 400, leadTimeDays: 15, latestQuoteAt: '2026-05-21', version: 2, snapshots: [] },
  { archiveId: 'SA-2026-0004', supplierCode: 'SUP-2026-0002', supplierName: '绍兴锦达纺织有限公司', materialCode: 'FAB-2026-0004', materialName: '涤棉里布', baseUnit: '米', packageUnit: '卷', packageQty: 100, boxQty: 6, price: 12.8, currency: 'RMB', minOrderQty: 300, leadTimeDays: 10, latestQuoteAt: '2026-05-25', version: 1, snapshots: [] },
  { archiveId: 'SA-2026-0005', supplierCode: 'SUP-2026-0003', supplierName: '东莞宏远辅料有限公司', materialCode: 'ACC-2026-0001', materialName: 'YKK 5号尼龙拉链', baseUnit: '个', packageUnit: '箱', packageQty: 500, boxQty: 1, price: 1.2, currency: 'RMB', minOrderQty: 10000, leadTimeDays: 10, latestQuoteAt: '2026-05-23', version: 2, snapshots: [] },
  { archiveId: 'SA-2026-0006', supplierCode: 'SUP-2026-0003', supplierName: '东莞宏远辅料有限公司', materialCode: 'ACC-2026-0002', materialName: '黑色四眼纽扣', baseUnit: '个', packageUnit: '盒', packageQty: 1000, boxQty: 20, price: 0.18, currency: 'RMB', minOrderQty: 50000, leadTimeDays: 8, latestQuoteAt: '2026-05-24', version: 1, snapshots: [] },
  { archiveId: 'SA-2026-0007', supplierCode: 'SUP-2026-0003', supplierName: '东莞宏远辅料有限公司', materialCode: 'ACC-2026-0003', materialName: '白色织唛', baseUnit: '个', packageUnit: '包', packageQty: 200, boxQty: 50, price: 0.23, currency: 'RMB', minOrderQty: 10000, leadTimeDays: 9, latestQuoteAt: '2026-05-26', version: 2, snapshots: [] },
  { archiveId: 'SA-2026-0008', supplierCode: 'SUP-2026-0003', supplierName: '东莞宏远辅料有限公司', materialCode: 'ACC-2026-0005', materialName: '2.5cm 弹力松紧带', baseUnit: '米', packageUnit: '卷', packageQty: 50, boxQty: 10, price: 0.85, currency: 'RMB', minOrderQty: 500, leadTimeDays: 9, latestQuoteAt: '2026-05-27', version: 1, snapshots: [] },
  { archiveId: 'SA-2026-0009', supplierCode: 'SUP-2026-0009', supplierName: '泉州瑞达服装辅料有限公司', materialCode: 'ACC-2026-0004', materialName: '涤纶缝纫线', baseUnit: '卷', packageUnit: '箱', packageQty: 120, boxQty: 1, price: 13, currency: 'RMB', minOrderQty: 60, leadTimeDays: 9, latestQuoteAt: '2026-05-17', version: 1, snapshots: [] },
  { archiveId: 'SA-2026-0010', supplierCode: 'SUP-2026-0010', supplierName: '宁波恒源纱线有限公司', materialCode: 'YAR-2026-0001', materialName: '32S 棉纱', baseUnit: '公斤', packageUnit: '包', packageQty: 25, boxQty: 20, price: 21.2, currency: 'USD', minOrderQty: 200, leadTimeDays: 18, latestQuoteAt: '2026-05-22', version: 1, snapshots: [] },
  { archiveId: 'SA-2026-0011', supplierCode: 'SUP-2026-0004', supplierName: '佛山成衣加工厂', materialCode: 'GAR-2026-0001', materialName: '女款休闲裤成衣', baseUnit: '件', packageUnit: '箱', packageQty: 50, boxQty: 10, price: 118, currency: 'RMB', minOrderQty: 300, leadTimeDays: 25, latestQuoteAt: '2026-05-25', version: 2, snapshots: [] },
  { archiveId: 'SA-2026-0012', supplierCode: 'SUP-2026-0007', supplierName: '杭州女装制衣有限公司', materialCode: 'SAM-2026-0001', materialName: '男款圆领T恤样衣', baseUnit: '件', packageUnit: '件', packageQty: 1, boxQty: 20, price: 260, currency: 'RMB', minOrderQty: 1, leadTimeDays: 20, latestQuoteAt: '2026-05-26', version: 1, snapshots: [] },
]

const archives: PmsSupplyArchive[] = seeds.map((seed) => {
  const material = getPmsMaterial(seed.materialCode)
  const supplier = getPmsSupplier(seed.supplierCode)
  const snapshot: PmsSupplyArchiveSnapshot = {
    version: seed.version,
    packageUnit: seed.packageUnit,
    packageQty: seed.packageQty,
    boxQty: seed.boxQty,
    price: seed.price,
    currency: seed.currency,
    effectiveFrom: seed.latestQuoteAt,
    changedBy: '王采购',
  }
  return {
    ...seed,
    supplierName: supplier?.supplierName ?? seed.supplierName,
    materialImageUrl: material?.imageUrl ?? '',
    materialCategory: material?.materialCategory ?? '物料',
    purchaseUnit: material?.purchaseUnit ?? seed.baseUnit,
    isGarment: material?.materialCategory === '成衣' || material?.materialCategory === '样衣',
    status: '有效',
    snapshots: [snapshot],
  }
})

export function listPmsSupplyArchives(): PmsSupplyArchive[] {
  return archives
}

export function getPmsSupplyArchive(archiveId: string): PmsSupplyArchive | undefined {
  return archives.find((archive) => archive.archiveId === archiveId)
}

export interface PmsSupplyConversion {
  baseQty: number
  packageCount: number
  boxCount: number
  packageQty: number
}

export function computePmsSupplyConversion(archive: PmsSupplyArchive, baseQty: number): PmsSupplyConversion {
  if (!Number.isFinite(baseQty) || baseQty < 0) throw new PmsDomainError('SUPPLY_QTY_INVALID', '换算数量不能为负数')
  const packageQty = archive.packageQty * archive.boxQty
  return {
    baseQty: roundPmsQty(baseQty, 2),
    packageCount: Math.ceil(baseQty / archive.packageQty),
    boxCount: Math.ceil(baseQty / packageQty),
    packageQty: archive.packageQty,
  }
}

export function convertPmsSupplyQty(archive: PmsSupplyArchive, qty: number, from: PmsSupplyArchiveUnit, to: PmsSupplyArchiveUnit): number {
  if (!Number.isFinite(qty) || qty < 0) throw new PmsDomainError('SUPPLY_QTY_INVALID', '换算数量不能为负数')
  const toBase = from === 'base' ? qty : from === 'package' ? qty * archive.packageQty : qty * archive.packageQty * archive.boxQty
  if (to === 'base') return roundPmsQty(toBase, 2)
  if (to === 'package') return roundPmsQty(toBase / archive.packageQty, 2)
  return roundPmsQty(toBase / (archive.packageQty * archive.boxQty), 2)
}

export function updatePmsSupplyArchive(
  archiveId: string,
  patch: { packageUnit?: string; packageQty?: number; boxQty?: number; price?: number; currency?: 'RMB' | 'USD'; minOrderQty?: number; leadTimeDays?: number; status?: '有效' | '停用' },
  actor: { id: string; name: string; role: PmsActorRole },
): PmsSupplyArchive {
  const archive = getPmsSupplyArchive(archiveId)
  if (!archive) throw new PmsDomainError('SUPPLY_ARCHIVE_NOT_FOUND', `供货档案 ${archiveId} 不存在`)
  if (patch.packageUnit !== undefined) {
    if (!patch.packageUnit.trim()) throw new PmsDomainError('SUPPLY_UNIT_REQUIRED', '包装单位不能为空')
    archive.packageUnit = patch.packageUnit.trim()
  }
  if (patch.packageQty !== undefined) {
    if (!Number.isFinite(patch.packageQty) || patch.packageQty <= 0) throw new PmsDomainError('SUPPLY_PACKAGE_QTY_INVALID', '每包装数量必须大于 0')
    archive.packageQty = patch.packageQty
  }
  if (patch.boxQty !== undefined) {
    if (!Number.isInteger(patch.boxQty) || patch.boxQty <= 0) throw new PmsDomainError('SUPPLY_BOX_QTY_INVALID', '每箱包装数必须是大于 0 的整数')
    archive.boxQty = patch.boxQty
  }
  if (patch.price !== undefined) {
    if (!Number.isFinite(patch.price) || patch.price < 0) throw new PmsDomainError('SUPPLY_PRICE_INVALID', '报价不能为负数')
    archive.price = patch.price
  }
  if (patch.currency !== undefined) archive.currency = patch.currency
  if (patch.minOrderQty !== undefined) {
    if (!Number.isFinite(patch.minOrderQty) || patch.minOrderQty < 0) throw new PmsDomainError('SUPPLY_MIN_QTY_INVALID', '最小起订量不能为负数')
    archive.minOrderQty = patch.minOrderQty
  }
  if (patch.leadTimeDays !== undefined) {
    if (!Number.isInteger(patch.leadTimeDays) || patch.leadTimeDays <= 0) throw new PmsDomainError('SUPPLY_LEAD_TIME_INVALID', '供货周期必须是大于 0 的天数')
    archive.leadTimeDays = patch.leadTimeDays
  }
  if (patch.status !== undefined) archive.status = patch.status
  archive.version += 1
  archive.latestQuoteAt = new Date().toISOString().slice(0, 10)
  archive.snapshots.push({
    version: archive.version,
    packageUnit: archive.packageUnit,
    packageQty: archive.packageQty,
    boxQty: archive.boxQty,
    price: archive.price,
    currency: archive.currency,
    effectiveFrom: archive.latestQuoteAt,
    changedBy: actor.name,
  })
  appendPmsLog({
    objectType: 'supply-archive',
    objectId: archiveId,
    action: '更新供货档案',
    beforeValue: `V${archive.version - 1}`,
    afterValue: `V${archive.version}`,
    reason: '采购单保存包装快照，档案变化不影响历史采购单',
    actorId: actor.id,
    actorName: actor.name,
    actorRole: actor.role,
  })
  return archive
}
