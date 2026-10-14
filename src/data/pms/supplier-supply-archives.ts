import { listPurchaseMaterialReferences, getPurchaseGoodsReference } from './canonical-purchase-references.ts'
import { getPmsSupplier, hydratePmsSuppliersFromIdb } from './suppliers.ts'
import { PMS_STORES, pmsAll, pmsCommitRecords, pmsGetEntityVersion, pmsGet } from './idb-storage.ts'
import { PmsDomainError, roundPmsQty, type PmsActorRole } from './runtime.ts'

export type PmsSupplyArchiveUnit = 'base' | 'package' | 'box'
export interface PmsSupplyArchiveSnapshot {
  version: number; packageUnit: string; packageQty: number; boxQty: number; price: number
  currency: 'RMB' | 'USD' | 'IDR'; effectiveFrom: string; changedBy: string
}
export interface PmsSupplyArchive {
  archiveId: string; supplierCode: string; supplierName: string
  materialCode: string; materialName: string; materialImageUrl: string; materialCategory: string
  baseUnit: string; purchaseUnit: string; packageUnit: string; boxUnit: string
  packageQty: number; boxQty: number; price: number; currency: 'RMB' | 'USD' | 'IDR'
  minOrderQty: number; leadTimeDays: number; isGarment: boolean; latestQuoteAt: string; version: number
  status: '有效' | '停用'; snapshots: PmsSupplyArchiveSnapshot[]; _pmsBaseVersion?: number
  purchaseRegion: string; isDefaultSupplier: boolean; requiresQc: boolean; buyer: string; packagingMethod: string
  packageWeight: number; packageVolume: number; boxWeight: number; boxVolume: number; boxSpec: string
  allowIrregular: boolean; packagingRemark: string; domesticCarrier: string; deliveryMethod: string
  deliveryAddress: string; targetWarehouse: string; directOverseas: boolean; firstLegCarrierCode: string; firstLegChannelCode: string
}
export type PmsSupplyArchiveInput = Partial<Omit<PmsSupplyArchive, 'archiveId' | 'version' | 'snapshots' | '_pmsBaseVersion' | 'latestQuoteAt'>> & { supplierCode: string; materialCode: string }
type Actor = { id: string; name: string; role: PmsActorRole }

function emptyDetails() {
  return { boxUnit: '箱', purchaseRegion: '中国', isDefaultSupplier: false, requiresQc: false, buyer: '', packagingMethod: '', packageWeight: 0, packageVolume: 0, boxWeight: 0, boxVolume: 0, boxSpec: '', allowIrregular: false, packagingRemark: '', domesticCarrier: '', deliveryMethod: '', deliveryAddress: '', targetWarehouse: '', directOverseas: false, firstLegCarrierCode: '', firstLegChannelCode: '' }
}
// These are supplier quotations for existing PCS identities, not a separate catalog.
const archives: PmsSupplyArchive[] = listPurchaseMaterialReferences().filter(item => item.active && item.imageUrl).slice(0, 12).map((material, index) => ({
  ...emptyDetails(), archiveId: `SA-2026-${String(index + 1).padStart(4, '0')}`, supplierCode: 'SUP-2026-0001', supplierName: getPmsSupplier('SUP-2026-0001')?.supplierName || '广州华盛面料有限公司', materialCode: material.materialCode, materialName: material.materialName, materialImageUrl: material.imageUrl, materialCategory: material.category, baseUnit: material.unit, purchaseUnit: material.unit, packageUnit: '卷', packageQty: 100, boxQty: 4, price: material.referencePrice, currency: 'RMB', minOrderQty: 100, leadTimeDays: 12, isGarment: false, latestQuoteAt: '2026-10-13', version: 1, status: index === 11 ? '停用' : '有效', snapshots: []
}))
let hydration: Promise<void> | null = null
export function hydratePmsSupplyArchivesFromIdb(): Promise<void> {
  if (hydration) return hydration
  hydration = (async () => {
    const stored = await pmsAll<PmsSupplyArchive>(PMS_STORES.pmsSupplyArchives)
    for (const saved of stored) {
      const complete = { ...emptyDetails(), ...saved }
      const index = archives.findIndex(item => item.archiveId === saved.archiveId)
      if (index >= 0) archives[index] = complete
      else archives.unshift(complete)
    }
    for (const archive of archives) archive._pmsBaseVersion = await pmsGetEntityVersion(PMS_STORES.pmsSupplyArchives, archive.archiveId)
  })()
  return hydration
}
export function listPmsSupplyArchives(): PmsSupplyArchive[] { return archives }
export function getPmsSupplyArchive(archiveId: string): PmsSupplyArchive | undefined { return archives.find(item => item.archiveId === archiveId) }

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

function validateArchive(input: PmsSupplyArchiveInput, existing?: PmsSupplyArchive): PmsSupplyArchive {
  const supplier = getPmsSupplier(input.supplierCode)
  if (!supplier) throw new PmsDomainError('SUPPLY_SUPPLIER_REQUIRED', '选择已登记的供应商')
  const reference = getPurchaseGoodsReference(input.materialCode)
  if (!reference && (!existing || existing.materialCode !== input.materialCode)) throw new PmsDomainError('SUPPLY_MATERIAL_REQUIRED', '选择已登记的商品或物料身份')
  if (archives.some(item => item.archiveId !== existing?.archiveId && item.supplierCode === input.supplierCode && item.materialCode === input.materialCode)) throw new PmsDomainError('SUPPLY_ARCHIVE_DUPLICATE', '该供应商与物料的供货档案已存在')
  const value: PmsSupplyArchive = { ...emptyDetails(), archiveId: `SA-${crypto.randomUUID().slice(0, 8).toUpperCase()}`, materialName: reference?.materialName || '', materialImageUrl: reference?.imageUrl || '', materialCategory: reference?.category || '', baseUnit: reference?.unit || '', purchaseUnit: reference?.unit || '', packageUnit: '卷', packageQty: 1, boxQty: 1, price: reference?.referencePrice || 0, currency: 'RMB', minOrderQty: 0, leadTimeDays: 1, isGarment: false, latestQuoteAt: '', version: 0, status: '有效', snapshots: [], ...existing, ...input, supplierName: supplier.supplierName }
  if (reference && (!existing || existing.materialCode !== input.materialCode)) { value.materialName = reference.materialName; value.materialImageUrl = reference.imageUrl; value.materialCategory = reference.category; value.isGarment = reference.category === '成衣' || reference.category === '样衣' }
  for (const key of ['baseUnit', 'purchaseUnit', 'packageUnit', 'boxUnit'] as const) if (!value[key]?.trim()) throw new PmsDomainError('SUPPLY_UNIT_REQUIRED', '基础、采购、包装和箱单位不能为空')
  for (const key of ['packageQty', 'boxQty', 'leadTimeDays'] as const) if (!Number.isFinite(value[key]) || value[key] <= 0) throw new PmsDomainError('SUPPLY_QTY_INVALID', '每包装数量、每箱包装数和交期必须大于 0')
  if (!Number.isInteger(value.boxQty) || !Number.isInteger(value.leadTimeDays)) throw new PmsDomainError('SUPPLY_INTEGER_REQUIRED', '每箱包装数与交期天数必须为整数')
  for (const key of ['price', 'minOrderQty', 'packageWeight', 'packageVolume', 'boxWeight', 'boxVolume'] as const) if (!Number.isFinite(value[key]) || value[key] < 0) throw new PmsDomainError('SUPPLY_VALUE_INVALID', '价格、数量、重量和体积不能为负数')
  if (!['RMB', 'USD', 'IDR'].includes(value.currency)) throw new PmsDomainError('SUPPLY_CURRENCY_INVALID', '币种不在可选范围内')
  value.version += 1
  value.latestQuoteAt = new Date().toISOString().slice(0, 10)
  value.snapshots = [...value.snapshots, { version: value.version, packageUnit: value.packageUnit, packageQty: value.packageQty, boxQty: value.boxQty, price: value.price, currency: value.currency, effectiveFrom: value.latestQuoteAt, changedBy: '' }]
  return value
}
function archiveBusinessCode(operationId: string): string {
  const timestamp = operationId.match(/\d{13}/)?.[0]
  const date = (timestamp ? new Date(Number(timestamp)) : new Date()).toISOString().slice(0, 10).replaceAll('-', '')
  let hash = 2166136261
  for (const char of operationId) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return `SA-${date}-${(hash >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(-6)}`
}
async function saveArchive(input: PmsSupplyArchiveInput, actor: Actor, existing?: PmsSupplyArchive, operationId?: string, operationSignature = JSON.stringify(input)): Promise<PmsSupplyArchive> {
  await Promise.all([hydratePmsSupplyArchivesFromIdb(), hydratePmsSuppliersFromIdb()])
  const stableId = !existing && operationId ? archiveBusinessCode(operationId) : undefined
  const previous = stableId ? await pmsGet<PmsSupplyArchive>(PMS_STORES.pmsSupplyArchives, stableId) : undefined
  const value = validateArchive(input, existing || previous)
  if (stableId) value.archiveId = stableId
  value.snapshots.at(-1)!.changedBy = actor.name
  const result = await pmsCommitRecords([{ store: PMS_STORES.pmsSupplyArchives, value, expectedVersion: existing?._pmsBaseVersion ?? 0 }], { operationId, operationSignature, log: { objectType: 'supply-archive', objectId: value.archiveId, action: existing ? '编辑供货档案' : '新增供货档案', beforeValue: existing ? `V${existing.version}` : '', afterValue: `V${value.version}`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role } })
  const saved = result.values[0] as PmsSupplyArchive
  const prior = getPmsSupplyArchive(saved.archiveId)
  if (prior) Object.assign(prior, saved)
  else archives.unshift(saved)
  return prior || saved
}
export async function createPmsSupplyArchive(input: PmsSupplyArchiveInput, actor: Actor, operationId?: string): Promise<PmsSupplyArchive> { return saveArchive(input, actor, undefined, operationId) }
export async function updatePmsSupplyArchive(archiveId: string, patch: Partial<PmsSupplyArchiveInput>, actor: Actor, operationId?: string): Promise<PmsSupplyArchive> {
  await hydratePmsSupplyArchivesFromIdb()
  const archive = getPmsSupplyArchive(archiveId)
  if (!archive) throw new PmsDomainError('SUPPLY_ARCHIVE_NOT_FOUND', '供货档案不存在')
  return saveArchive({ ...archive, ...patch }, actor, archive, operationId, JSON.stringify({archiveId,patch}))
}
export async function copyPmsSupplyArchive(archiveId: string, supplierCode: string, actor: Actor, operationId?: string): Promise<PmsSupplyArchive> {
  await hydratePmsSupplyArchivesFromIdb()
  const source = getPmsSupplyArchive(archiveId)
  if (!source) throw new PmsDomainError('SUPPLY_ARCHIVE_NOT_FOUND', '供货档案不存在')
  const { archiveId: _id, version: _version, snapshots: _snapshots, _pmsBaseVersion: _base, ...values } = source
  return saveArchive({ ...values, supplierCode },actor,undefined,operationId,JSON.stringify({archiveId,supplierCode}))
}
export async function importPmsSupplyArchives(inputs: PmsSupplyArchiveInput[], actor: Actor, operationId?: string): Promise<PmsSupplyArchive[]> {
  await Promise.all([hydratePmsSupplyArchivesFromIdb(), hydratePmsSuppliersFromIdb()])
  if (!inputs.length) throw new PmsDomainError('SUPPLY_IMPORT_EMPTY', '没有可导入的档案')
  const identities = inputs.map(input => `${input.supplierCode}|${input.materialCode}`)
  if (new Set(identities).size !== identities.length) throw new PmsDomainError('SUPPLY_IMPORT_DUPLICATE', '导入文件包含重复的供应商与物料')
  const values = inputs.map((input, index) => { const stableId = operationId ? archiveBusinessCode(`${operationId}:${index + 1}`) : ''; const value = validateArchive(input, stableId ? getPmsSupplyArchive(stableId) : undefined); if (stableId) value.archiveId = stableId; value.snapshots.at(-1)!.changedBy = actor.name; return value })
  const result = await pmsCommitRecords(values.map(value => ({ store: PMS_STORES.pmsSupplyArchives, value, expectedVersion: 0 })), { operationId, operationSignature:JSON.stringify(inputs), log: { objectType: 'supply-archive', objectId: operationId || 'import', action: '导入供货档案', beforeValue: '', afterValue: `${values.length} 条`, reason: '', actorId: actor.id, actorName: actor.name, actorRole: actor.role } })
  for (const value of result.values as PmsSupplyArchive[]) if (!getPmsSupplyArchive(value.archiveId)) archives.unshift(value)
  return result.values as PmsSupplyArchive[]
}
