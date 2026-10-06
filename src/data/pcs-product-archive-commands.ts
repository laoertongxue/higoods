import { createStyleArchiveDirect, getStyleArchiveById, listStyleArchives, updateStyleArchive } from './pcs-style-archive-repository.ts'
import { createSkuArchiveBatch, getSkuArchiveById, listSkuArchives, listSkuArchivesByStyleId, updateSkuArchive } from './pcs-sku-archive-repository.ts'
import { listConfigDimensionOptions, listProductCategoryNodes } from './pcs-config-workspace-repository.ts'
import { resolveStyleProductInformation } from './pcs-style-product-information.ts'
import { archiveLog, PCS_DEMO_OPERATOR_ID, assertProductSkuIdentity, resolveProductMainUnit, type ArchiveLifecycleStatus, type ProductDeliveryMode, type SalesBaseContent } from './pcs-product-archive-rules.ts'
import type { StyleArchiveShellRecord } from './pcs-style-archive-types.ts'
import type { SkuArchiveRecord } from './pcs-sku-archive-types.ts'
import { getPcsChannelCatalogSnapshot } from './pcs-channel-catalog.ts'
import { listTechnicalDataVersionsByStyleId } from './pcs-technical-data-version-repository.ts'
import { getProjectCreateCatalog } from './pcs-project-repository.ts'
import { prepareProductPackages } from './pcs-product-packaging.ts'
import { listMaterialPatternChoices } from './pcs-material-pattern.ts'
import { getMaterialSkuRecordById } from './pcs-material-archive-repository.ts'
export interface ProductSkuDraft { skuCode?: string; colorId: string; sizeId: string; imageUrl?: string; patternId?: string; patternIdentityId?: string; deliveryDifference?: string; bundleComponents?: SkuArchiveRecord['bundleComponents'] }
export interface ProductStyleDraft extends Partial<StyleArchiveShellRecord> { styleName: string; initialSkus?: ProductSkuDraft[]; changeReason?: string }
function enabledOption(dimension: 'colors' | 'sizes', id: string) {
  const option = listConfigDimensionOptions(dimension).find(item => item.id === id && item.status === 'ENABLED')
  if (!option) throw new Error(`请选择有效的${dimension === 'colors' ? '颜色' : '尺码'}。`)
  return option
}
export function previewProductSkus(style: StyleArchiveShellRecord, drafts: ProductSkuDraft[]): SkuArchiveRecord[] {
  const stamp = new Date().toLocaleString('sv-SE'), existing = listSkuArchives()
  const result: SkuArchiveRecord[] = []
  for (const draft of drafts) {
    const pattern = draft.patternIdentityId ? listMaterialPatternChoices().find(item => item.id === draft.patternIdentityId) : null
    if (draft.patternIdentityId && !pattern) throw new Error('请选择可引用的花型。')
    const patternCode = pattern?.pattern_code || draft.patternId || ''
    const color = enabledOption('colors', draft.colorId), size = enabledOption('sizes', draft.sizeId)
    const colorSegment = (color.name_en || color.name_zh).trim().toLowerCase().replace(/\s+/g, '-')
    const sizeSegment = size.name_zh.trim().toLowerCase().replace(/\s+/g, '-')
    const row: SkuArchiveRecord = {
      skuId: `sku_${crypto.randomUUID()}`, skuCode: draft.skuCode?.trim() || `${style.styleCode}-${colorSegment}-${sizeSegment}${patternCode ? `-${patternCode.trim().replace(/\s+/g, '-')}` : ''}${draft.deliveryDifference ? `-${draft.deliveryDifference.trim().replace(/\s+/g, '-')}` : ''}`,
      styleId: style.styleId, styleCode: style.styleCode, styleName: style.styleName,
      skuName: `${style.styleName} ${color.name_zh}/${size.name_zh}`, skuNameEn: '', colorName: color.name_zh, sizeName: size.name_zh,
      colorId: color.id, sizeId: size.id, printName: patternCode, patternId: patternCode, patternIdentityId: pattern?.id, deliveryDifference: draft.deliveryDifference || '', extraIdentityValues: { deliveryDifference: draft.deliveryDifference || '' }, barcode: '', skuImageUrl: draft.imageUrl || style.mainImageUrl,
      approvalStatus: 'DRAFT', lifecycleStatus: 'NOT_ENABLED', archiveStatus: 'INACTIVE', deliveryMode: style.deliveryMode || 'SINGLE', identitySource: 'MANUAL', sourceSystem: 'PCS手工建档', recordVersion: 1, bundleComponents: draft.bundleComponents, compositionVersion: style.deliveryMode === 'VIRTUAL_BUNDLE' ? 1 : undefined,
      archiveLogs: [archiveLog('新增规格', `${color.name_zh}/${size.name_zh}`)], channelTitle: '', channelMappingCount: 0, listedChannelCount: 0, mappingHealth: 'OK', techPackVersionId: '', techPackVersionCode: '', techPackVersionLabel: '', legacySystem: '', legacyCode: '', costPrice: 0, freightCost: 0, suggestedRetailPrice: 0, currency: '', pricingUnit: style.deliveryMode && style.deliveryMode !== 'SINGLE' ? '套' : '件', weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0, packagingInfo: '', weightText: '', volumeText: '', lastListingAt: '', createdAt: stamp, createdBy: '当前用户', createdById: PCS_DEMO_OPERATOR_ID, updatedById: PCS_DEMO_OPERATOR_ID, updatedAt: stamp, updatedBy: '当前用户', remark: '', packageQuantity: 1,
    }
    // 预览时检查身份。虚拟组合将在组件填写完成后整体校验。
    assertProductSkuIdentity({ ...row, deliveryMode: row.deliveryMode === 'VIRTUAL_BUNDLE' ? 'SINGLE' : row.deliveryMode }, [...existing, ...result])
    result.push(row)
  }
  return result
}
export function saveProductStyleDraft(draft: ProductStyleDraft, styleId?: string): StyleArchiveShellRecord {
  if (!draft.styleName.trim()) throw new Error('请填写款式名称。')
  const current = styleId ? getStyleArchiveById(styleId) : null
  if (styleId && !current) throw new Error('款式不存在，请重新读取。')
  const base = current || createStyleArchiveDirect({ styleName: draft.styleName, styleCode: draft.styleCode, operator: '当前用户' })
  const { initialSkus, changeReason, ...fields } = draft
  if (fields.buyerId) {
    const owner = getProjectCreateCatalog().owners.find(item => item.id === fields.buyerId)
    if (!owner && fields.buyerId !== current?.buyerId) throw new Error('请选择人员目录中的买手 / 资料责任人。')
    fields.buyerName = owner?.name || current?.buyerName || ''
  } else if (fields.buyerId === '') fields.buyerName = ''
  if (fields.styleNameTranslations) fields.styleNameEn = fields.styleNameTranslations.en || ''
  const next = resolveStyleProductInformation({ ...base, ...fields, styleCode: fields.styleCode?.trim() || base.styleCode, styleId: base.styleId, updatedAt: new Date().toLocaleString('sv-SE'), updatedBy: '当前用户', archiveLogs: [...(base.archiveLogs || []), archiveLog(current ? '修改资料' : '保存草稿', '保存商品身份与独立属性')] })
  validateSelectedProductConfig(next, current)
  next.archiveLogs!.at(-1)!.reason = changeReason?.trim() || '资料维护'
  for (const relation of next.substitutionRelations || []) {
    const target = relation.targetKind === 'PRODUCT_SKU' ? getSkuArchiveById(relation.targetId) : relation.targetKind === 'MATERIAL_SKU' ? getMaterialSkuRecordById(relation.targetId) : null
    if (!target) throw new Error('替代关联目标不存在，请选择有效的商品或物料规格。')
  }
  updateStyleArchive(base.styleId, next)
  if (initialSkus?.length) createSkuArchiveBatch(previewProductSkus(next, initialSkus))
  return getStyleArchiveById(base.styleId)!
}
function validateSelectedProductConfig(style: StyleArchiveShellRecord, previous?: StyleArchiveShellRecord | null): void {
  for (const [dimension, ids] of Object.entries(style.productConfigRefs || {})) {
    const options = listConfigDimensionOptions(dimension as any)
    for (const id of ids || []) if (!options.some(item => item.id === id && (item.status === 'ENABLED' || previous?.productConfigRefs?.[dimension as keyof NonNullable<StyleArchiveShellRecord['productConfigRefs']>]?.includes(id)))) throw new Error('不能选用已停用或不存在的属性。')
    if (['brands', 'categoryNumbers', 'productPositioning'].includes(dimension) && (ids?.length || 0) > 1) throw new Error('品牌、品类编号和商品定位须单选。')
  }
  if (style.productCategoryId) {
    const nodes = listProductCategoryNodes(), node = nodes.find(item => item.id === style.productCategoryId)
    if (!node || nodes.some(item => item.parentId === node.id) || (node.status === 'DISABLED' && previous?.productCategoryId !== node.id)) throw new Error('请选择启用的商品叶类目。')
  }
}
export function saveProductSkuDraft(skuId: string, patch: Partial<SkuArchiveRecord> & { changeReason?: string }): SkuArchiveRecord {
  const current = getSkuArchiveById(skuId)
  if (!current) throw new Error('规格不存在，请重新读取。')
  const reason = patch.changeReason?.trim() || '资料维护'
  const { changeReason: _reason, ...values } = patch
  patch = values
  if (patch.mainUnitId !== undefined || patch.pricingUnit !== undefined) {
    const key = patch.mainUnitId !== undefined && patch.mainUnitId !== current.mainUnitId ? patch.mainUnitId : patch.pricingUnit || patch.mainUnitId
    const unit = resolveProductMainUnit(key)
    if (!unit || (!unit.enabled && unit.id !== current.mainUnitId)) throw new Error('请选择单位字典中启用的主计量单位。')
    patch.mainUnitId = unit.id; patch.pricingUnit = unit.code
  }
  if (patch.colorId && patch.colorId !== current.colorId) patch.colorName = enabledOption('colors', patch.colorId).name_zh
  if (patch.sizeId && patch.sizeId !== current.sizeId) patch.sizeName = enabledOption('sizes', patch.sizeId).name_zh
  const patternIdentityChanged = patch.patternIdentityId !== undefined && patch.patternIdentityId !== current.patternIdentityId
  if (patch.patternId !== undefined) { patch.printName = patch.patternId; if (patch.patternId !== current.patternId && patch.patternIdentityId === undefined) patch.patternIdentityId = '' }
  if (patternIdentityChanged) {
    const pattern = patch.patternIdentityId ? listMaterialPatternChoices().find(item => item.id === patch.patternIdentityId) : null
    if (patch.patternIdentityId && !pattern) throw new Error('请选择可引用的花型。')
    patch.patternId = patch.printName = pattern?.pattern_code || ''
  }
  if (patch.deliveryDifference !== undefined) patch.extraIdentityValues = { deliveryDifference: patch.deliveryDifference.trim() }
  if (patch.packageSpecs) Object.assign(patch, prepareProductPackages(current, patch.packageSpecs, patch.pricingUnit ?? current.pricingUnit))
  if (patch.skuNameTranslations) patch.skuNameEn = patch.skuNameTranslations.en || ''
  if (patch.barcodeAliases) patch.barcodeAliases = [...new Set(patch.barcodeAliases.map(value => value.trim()).filter(Boolean))]
  return updateSkuArchive(skuId, { ...patch, updatedAt: new Date().toLocaleString('sv-SE'), updatedBy: '当前用户', archiveLogs: [...(current.archiveLogs || []), { ...archiveLog('修改规格', '保存规格及包装物流资料'), reason }] })!
}
export function submitProductForApproval(kind: 'style' | 'sku', id: string): void {
  if (kind === 'style') {
    const style = getStyleArchiveById(id)
    if (!style) throw new Error('款式不存在。')
    if (style.approvalStatus !== 'DRAFT') throw new Error('仅草稿可以提交审核。')
    validateSelectedProductConfig(style)
    if (!style.styleName || !style.brandName || !style.productCategoryId || !style.mainImageUrl || !['毛织', '非毛织'].includes(style.materialType || '')) throw new Error('请先补齐名称、品牌、商品叶类目、材质类型和主图。')
    const skus = listSkuArchivesByStyleId(id)
    if (!skus.length) throw new Error('至少建立一条完整规格后再提交。')
    for (const sku of skus.filter(item => item.approvalStatus === 'DRAFT')) assertProductSkuIdentity({ ...sku, approvalStatus: 'PENDING' }, listSkuArchives())
    updateStyleArchive(id, { approvalStatus: 'PENDING', archiveLogs: [...(style.archiveLogs || []), archiveLog('提交审核', '款式与首批草稿规格一同提交')] })
    for (const sku of skus.filter(item => item.approvalStatus === 'DRAFT')) updateSkuArchive(sku.skuId, { approvalStatus: 'PENDING', archiveLogs: [...(sku.archiveLogs || []), archiveLog('提交审核', '随款式提交')] })
  } else {
    const sku = getSkuArchiveById(id)
    if (!sku || sku.approvalStatus !== 'DRAFT') throw new Error('仅草稿规格可以提交审核。')
    updateSkuArchive(id, { approvalStatus: 'PENDING', archiveLogs: [...(sku.archiveLogs || []), archiveLog('提交审核', '新增规格独立审核')] })
  }
}
function validateProductReview(kind: 'style' | 'sku', id: string): void {
  if (kind === 'sku') {
    const sku = getSkuArchiveById(id)
    if (!sku) throw new Error('规格不存在。')
    assertProductSkuIdentity({ ...sku, approvalStatus: 'APPROVED' }, listSkuArchives())
    return
  }
  const style = getStyleArchiveById(id)
  if (!style) throw new Error('款式不存在。')
  validateSelectedProductConfig(style)
  if (!style.styleName.trim() || !style.brandName.trim() || !style.productCategoryId || !style.mainImageUrl || !['毛织', '非毛织'].includes(style.materialType || '')) throw new Error('请先补齐名称、品牌、商品叶类目、材质类型和主图。')
  const skus = listSkuArchivesByStyleId(id)
  if (!skus.length) throw new Error('至少建立一条完整规格后再审核。')
  for (const sku of skus.filter(item => item.approvalStatus === 'PENDING')) validateProductReview('sku', sku.skuId)
}
export function reviewProductArchive(kind: 'style' | 'sku', id: string, approved: boolean, reason = ''): void {
  const current = kind === 'style' ? getStyleArchiveById(id) : getSkuArchiveById(id)
  if (!current || current.approvalStatus !== 'PENDING') throw new Error('仅待审核档案可以执行审核。')
  if (!approved && !reason.trim()) throw new Error('请填写驳回原因。')
  if (approved) validateProductReview(kind, id)
  const patch = { approvalStatus: approved ? 'APPROVED' as const : 'DRAFT' as const, archiveLogs: [...(current.archiveLogs || []), archiveLog(approved ? '审核通过' : '驳回', approved ? '资料核对通过' : reason)] }
  if (kind === 'sku') updateSkuArchive(id, patch)
  else {
    updateStyleArchive(id, { ...patch, baseInfoStatus: approved ? '已建档' : '待完善' })
    for (const sku of listSkuArchivesByStyleId(id).filter(item => item.approvalStatus === 'PENDING')) reviewProductArchive('sku', sku.skuId, approved, reason)
  }
}
/** Current PCS references are checked inside the same command as the archive change. */
export function getProductActiveReferences(kind: 'style' | 'sku', id: string): string[] {
  const skus = kind === 'style' ? listSkuArchivesByStyleId(id) : [getSkuArchiveById(id)].filter((s): s is SkuArchiveRecord => !!s)
  const ids = new Set(skus.map(s => s.skuId)), styleId = kind === 'style' ? id : skus[0]?.styleId
  const catalog = getPcsChannelCatalogSnapshot(), refs: string[] = []
  for (const sku of listSkuArchives()) if (sku.lifecycleStatus === 'ACTIVE' && sku.bundleComponents?.some(c => ids.has(c.skuId))) refs.push(`启用组合 ${sku.skuCode}`)
  const activeListingIds = new Set(catalog.listings.filter(l => l.platformStatus === '在售').map(l => l.id))
  for (const variant of catalog.variants) if (ids.has(variant.internalSkuId) && variant.active && activeListingIds.has(variant.listingId)) refs.push(`在售平台规格 ${variant.platformVariantId || variant.id}`)
  for (const order of catalog.orderReferences) if (ids.has(order.internalSkuId) && order.status === '履约中') refs.push(`履约订单 ${order.orderCode}`)
  if (styleId) for (const version of listTechnicalDataVersionsByStyleId(styleId)) if (version.versionStatus === 'PUBLISHED') refs.push(`已发布技术资料 ${version.technicalVersionCode}`)
  return [...new Set(refs)]
}
export function setProductLifecycle(kind: 'style' | 'sku', id: string, status: ArchiveLifecycleStatus, activeReferences = 0): void {
  const current = kind === 'style' ? getStyleArchiveById(id) : getSkuArchiveById(id)
  if (!current) throw new Error('档案不存在。')
  if (status === 'ACTIVE' && current.approvalStatus !== 'APPROVED') throw new Error('审核通过后才能启用。')
  if (status === 'ARCHIVED') {
    const refs = getProductActiveReferences(kind, id)
    if (activeReferences > 0 || refs.length) throw new Error(`仍有活动业务引用，请先在所属业务完成处理。${refs.slice(0, 3).join('；')}`)
  }
  const archiveStatus = status === 'ACTIVE' ? 'ACTIVE' : status === 'ARCHIVED' ? 'ARCHIVED' : kind === 'style' ? 'DRAFT' : 'INACTIVE'
  const patch = { lifecycleStatus: status, archiveStatus, archiveLogs: [...(current.archiveLogs || []), archiveLog('调整使用状态', status === 'ACTIVE' ? '启用' : status === 'INACTIVE' ? '停用；已有关联不自动下架' : '归档')] }
  if (kind === 'style') updateStyleArchive(id, patch as Partial<StyleArchiveShellRecord>)
  else updateSkuArchive(id, patch as Partial<SkuArchiveRecord>)
}
export function saveProductSalesContent(styleId: string, content: SalesBaseContent): void {
  const style = getStyleArchiveById(styleId)
  if (!style) throw new Error('款式不存在。')
  if (!content.title.trim()) throw new Error('请填写该语言的销售标题。')
  const previous = style.salesContents?.find(item => item.language === content.language)
  updateStyleArchive(styleId, { salesContents: [...(style.salesContents || []).filter(item => item.language !== content.language), { ...content, version: (previous?.version || 0) + 1 }], archiveLogs: [...(style.archiveLogs || []), archiveLog('修改销售基础内容', `${content.language} · 版本 ${(previous?.version || 0) + 1}`)] })
}
export function productDraftCopy(styleId: string): ProductStyleDraft {
  const style = getStyleArchiveById(styleId)
  if (!style) throw new Error('款式不存在。')
  const { styleId: _id, styleCode: _code, archiveLogs: _logs, ...fields } = style
  return { ...fields, styleName: `${style.styleName}（复制）`, styleCode: '', approvalStatus: 'DRAFT', lifecycleStatus: 'NOT_ENABLED', archiveStatus: 'DRAFT', currentTechPackVersionId: '', currentTechPackVersionCode: '', currentTechPackVersionLabel: '', currentTechPackVersionStatus: '', currentTechPackVersionActivatedAt: '', currentTechPackVersionActivatedBy: '', specificationCount: 0, techPackVersionCount: 0, costVersionCount: 0, channelProductCount: 0, baseInfoStatus: '待完善', specificationStatus: '未建立', techPackStatus: '未建立', costPricingStatus: '未建立', inheritedBomVersionIds: [], inheritedPatternFileIds: [], inheritedDesignFileIds: [], linkedDesignRevisionTaskIds: [], legacyCodes: [], legacyOriginProject: '', identitySource: 'MANUAL', sameStyleIds: [], substitutionRelations: [], sourceProjectId: '', sourceProjectCode: '', sourceProjectName: '', sourceProjectNodeId: '', initialSkus: [] }
}
