import type { StyleArchiveShellRecord } from './pcs-style-archive-types.ts'
import type { SkuArchiveRecord } from './pcs-sku-archive-types.ts'
import { prepareProductPackages } from './pcs-product-packaging.ts'
import { listMaterialUnitDefinitions, PCS_MATERIAL_CONFIG_KEY, type MaterialUnitDefinition } from './pcs-material-config.ts'
import { pcsRecordStore } from './pcs-record-runtime.ts'
export type ArchiveApprovalStatus = 'DRAFT' | 'PENDING' | 'APPROVED'
export type ArchiveLifecycleStatus = 'NOT_ENABLED' | 'ACTIVE' | 'INACTIVE' | 'ARCHIVED'
export type ProductDeliveryMode = 'SINGLE' | 'PHYSICAL_SET' | 'VIRTUAL_BUNDLE'
export interface ProductArchiveLog { id: string; action: string; detail: string; operator: string; operatorId?: string; time: string; reason?: string; changes?: Array<{ field: string; before: unknown; after: unknown }> }
export interface SalesBaseContent { language: 'zh' | 'en' | 'id' | 'ms'; title: string; description: string; sellingPoints: string; imageUrls: string[]; videoUrls: string[]; sizeChartUrl: string; version: number }
export interface ProductBundleComponent { skuId: string; quantity: number }
export const APPROVAL_LABELS = { DRAFT: '草稿', PENDING: '待审核', APPROVED: '审核通过' }
export const LIFECYCLE_LABELS = { NOT_ENABLED: '未启用', ACTIVE: '启用', INACTIVE: '停用', ARCHIVED: '归档' }
export const DELIVERY_LABELS = { SINGLE: '单件', PHYSICAL_SET: '固定实物套装', VIRTUAL_BUNDLE: '虚拟组合' }
export const PCS_DEMO_OPERATOR_ID = 'pcs-prototype-user'
export interface ProductArchiveOrigin { sourceSystem?: string; sourceId?: string; legacyValues?: Array<{ field: string; value: unknown; unit?: string; currency?: string }>; createdById?: string; updatedById?: string }
export function archiveLog(action: string, detail: string, operator = '当前用户'): ProductArchiveLog { return { id: crypto.randomUUID(), action, detail, operator, operatorId: operator === '当前用户' ? PCS_DEMO_OPERATOR_ID : undefined, time: new Date().toLocaleString('sv-SE') } }
let unitSource: string | null | undefined
let unitChoices: MaterialUnitDefinition[] = []
export function resolveProductMainUnit(idOrCode: string | undefined): MaterialUnitDefinition | undefined {
  const raw = pcsRecordStore.getItem(PCS_MATERIAL_CONFIG_KEY)
  if (raw !== unitSource) { unitSource = raw; unitChoices = listMaterialUnitDefinitions() }
  const key = (idOrCode || '').trim().toLowerCase()
  return unitChoices.find(unit => [unit.id, unit.code, unit.label, ...(unit.aliases || [])].some(value => value.toLowerCase() === key))
}
export function completeProductArchiveAudit<T extends { archiveLogs?: ProductArchiveLog[]; updatedAt: string; updatedBy: string; updatedById?: string }>(current: T, next: T): void {
  const last = next.archiveLogs?.at(-1)
  if (!last || current.archiveLogs?.some(log => log.id === last.id)) return
  const ignored = new Set(['archiveLogs', 'updatedAt', 'updatedBy', 'updatedById', 'recordVersion', 'specificationCount', 'channelProductCount', 'techPackVersionCount', 'costVersionCount'])
  const before = current as Record<string, unknown>, after = next as Record<string, unknown>
  last.changes = Object.keys(after).filter(key => !ignored.has(key) && JSON.stringify(before[key]) !== JSON.stringify(after[key])).map(field => ({ field, before: structuredClone(before[field] ?? null), after: structuredClone(after[field] ?? null) }))
  last.reason ||= last.detail || '资料维护'
  next.updatedAt = last.time
  next.updatedBy = last.operator
  next.updatedById = last.operatorId
}
type DeliveryIdentity = Pick<SkuArchiveRecord, 'styleId' | 'colorName' | 'sizeName' | 'printName' | 'deliveryDifference'> & Partial<Pick<SkuArchiveRecord, 'colorId' | 'sizeId' | 'patternIdentityId'>>
const identityText = (value: string | undefined) => (value || '').trim().toLowerCase()
export function skuDeliveryIdentity(sku: DeliveryIdentity): string {
  return [sku.styleId, sku.colorId || sku.colorName, sku.sizeId || sku.sizeName, sku.patternIdentityId || (sku.printName === '基础款' ? '' : sku.printName), sku.deliveryDifference || ''].map(identityText).join('|')
}
function sameDeliveryIdentity(a: DeliveryIdentity, b: DeliveryIdentity): boolean {
  const same = (aId: string | undefined, bId: string | undefined, aName: string, bName: string) => aId && bId ? aId === bId : identityText(aName) === identityText(bName)
  return a.styleId === b.styleId && same(a.colorId, b.colorId, a.colorName, b.colorName) && same(a.sizeId, b.sizeId, a.sizeName, b.sizeName)
    && same(a.patternIdentityId, b.patternIdentityId, a.printName === '基础款' ? '' : a.printName, b.printName === '基础款' ? '' : b.printName)
    && identityText(a.deliveryDifference) === identityText(b.deliveryDifference)
}
export function assertProductSkuIdentity(record: SkuArchiveRecord, records: SkuArchiveRecord[], current?: SkuArchiveRecord): void {
  if (record.packageSpecs) prepareProductPackages(record, record.packageSpecs)
  if (!record.skuId || !record.styleId || !record.skuCode.trim()) throw new Error('请填写 SKU 编码并选择所属款式。')
  if (record.skuCode.length > 256) throw new Error('SKU 编码不能超过 256 个字符。')
  if (records.some(item => item.skuId !== record.skuId && item.skuCode.toLowerCase() === record.skuCode.toLowerCase())) throw new Error('SKU 编码已存在。')
  if (record.colorName && record.sizeName && records.some(item => item.skuId !== record.skuId && sameDeliveryIdentity(item, record))) throw new Error('同款同色同尺及交付差异的规格已存在，请使用已有 SKU。')
  const aliases = (sku: SkuArchiveRecord) => new Set([sku.skuCode, sku.barcode, sku.legacyCode, ...(sku.barcodeAliases || [])].map(value => value?.trim().toLowerCase()).filter(Boolean))
  const identityAliases = aliases(record)
  if (records.some(item => item.skuId !== record.skuId && [...aliases(item)].some(value => identityAliases.has(value)))) throw new Error('条码或旧码别名已关联其他 SKU。')
  if (!record.pricingUnit?.trim()) throw new Error('请明确规格主计量单位。')
  const unit = resolveProductMainUnit(record.mainUnitId || record.pricingUnit)
  const oldUnit = current && resolveProductMainUnit(current.mainUnitId || current.pricingUnit)
  if (!unit || (!unit.enabled && unit.id !== oldUnit?.id)) throw new Error('请选择单位字典中启用的主计量单位。')
  if (record.mainUnitId && unit.code !== record.pricingUnit) throw new Error('主计量单位与单位编码不一致，请重新选择。')
  if (current?.approvalStatus === 'APPROVED') {
    if (unit.id !== oldUnit?.id) throw new Error('已审核或使用的规格主计量单位不能修改。')
    if (record.skuId !== current.skuId || record.styleId !== current.styleId || record.skuCode !== current.skuCode || !sameDeliveryIdentity(record, current) || record.deliveryMode !== current.deliveryMode) throw new Error('已审核规格的编码、归属及交付身份不能修改，请新建规格。')
    if (JSON.stringify(record.bundleComponents || []) !== JSON.stringify(current.bundleComponents || [])) throw new Error('组合组成变化请创建新的交付规格，历史组成保持不变。')
  }
  if ([record.weightKg, record.lengthCm, record.widthCm, record.heightCm, record.packageGrossWeightKg ?? 0].some(value => value !== undefined && (!Number.isFinite(value) || value < 0))) throw new Error('包装物流数值须为非负数。')
  if (record.packageQuantity !== undefined && (!Number.isFinite(record.packageQuantity) || record.packageQuantity <= 0)) throw new Error('每包装含量必须大于 0。')
  if (record.approvalStatus === 'PENDING' || record.approvalStatus === 'APPROVED') {
    if (!record.colorName.trim() || !record.sizeName.trim() || !record.skuImageUrl) throw new Error('提交审核前请补齐颜色、尺码及识别图片。')
  }
  if (record.lifecycleStatus === 'ACTIVE' && record.approvalStatus !== 'APPROVED') throw new Error('审核通过后才能启用。')
  if (record.deliveryMode === 'VIRTUAL_BUNDLE') {
    const components = record.bundleComponents || []
    if (components.length < 2) throw new Error('虚拟组合至少需要两条组件。')
    if (new Set(components.map(item => item.skuId)).size !== components.length) throw new Error('同一组件请合并数量。')
    for (const component of components) {
      const item = records.find(item => item.skuId === component.skuId)
      if (component.skuId === record.skuId || !item || item.deliveryMode === 'VIRTUAL_BUNDLE') throw new Error('组件仅可选普通或固定实物 SKU，不能自引用或引用组合 SKU。')
      if (!(Number.isFinite(component.quantity) && component.quantity > 0)) throw new Error('组件数量必须大于 0。')
      if (['件', '套', 'pcs', 'pc', 'piece', 'set', 'unit-pcs'].includes(item.pricingUnit.trim().toLowerCase()) && !Number.isInteger(component.quantity)) throw new Error('按件或套计量的组件数量必须是整数。')
    }
  }
}
export function assertProductStyleIdentity(record: StyleArchiveShellRecord, records: StyleArchiveShellRecord[], current?: StyleArchiveShellRecord): void {
  if (record.yearTag && !/^\d{4}$/.test(record.yearTag)) throw new Error('年份须为四位整数。')
  if (!record.styleCode.trim() || record.styleCode.length > 256) throw new Error('请填写 256 字符以内的款式编码。')
  if (records.some(item => item.styleId !== record.styleId && item.styleCode.toLowerCase() === record.styleCode.toLowerCase())) throw new Error('款式编码已存在。')
  if (current && (record.styleId !== current.styleId || (current.approvalStatus === 'APPROVED' && (record.styleCode !== current.styleCode || record.deliveryMode !== current.deliveryMode)))) throw new Error('已审核款式的编码和交付方式不能修改。')
  if (record.lifecycleStatus === 'ACTIVE' && record.approvalStatus !== 'APPROVED') throw new Error('审核通过后才能启用。')
  if (record.sameStyleIds?.includes(record.styleId)) throw new Error('同款关系不能关联自身。')
  if (record.sameStyleIds?.some(id => !records.some(item => item.styleId === id))) throw new Error('同款关联对象不存在。')
  if (record.substitutionRelations?.some(item => !item.targetId || !item.conditions.trim() || !Number.isInteger(item.version) || item.version < 1)) throw new Error('替代关系须明确目标、适用条件和版本。')
}
