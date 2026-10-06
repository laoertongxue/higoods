import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import { getStyleArchiveStoreSnapshot, getStyleArchiveById, listStyleArchives, resetStyleArchiveRepository, updateStyleArchive } from '../src/data/pcs-style-archive-repository.ts'
import { listSkuArchives, listSkuArchivesByStyleId, resetSkuArchiveRepository, createSkuArchiveBatch } from '../src/data/pcs-sku-archive-repository.ts'
import { listConfigDimensionOptions, listProductCategoryNodes } from '../src/data/pcs-config-workspace-repository.ts'
import { saveProductStyleDraft, previewProductSkus, saveProductSkuDraft, submitProductForApproval, reviewProductArchive, setProductLifecycle, productDraftCopy } from '../src/data/pcs-product-archive-commands.ts'
import { assertProductSkuIdentity, assertProductStyleIdentity } from '../src/data/pcs-product-archive-rules.ts'
import { resolveStyleArchiveBusinessStatus } from '../src/data/pcs-product-lifecycle-governance.ts'
import { renderPcsStyleArchiveListPage, renderPcsStyleArchiveDetailPage, renderPcsSpecificationDetailPage, resetPcsProductArchiveState } from '../src/pages/pcs-product-archives.ts'
const styles = getStyleArchiveStoreSnapshot(), skus = { version: 1, records: listSkuArchives() }
beforeEach(() => { pcsRecordStore.setItem('higood-pcs-style-archive-store-v3', JSON.stringify(styles)); pcsRecordStore.setItem('higood-pcs-sku-archive-store-v1', JSON.stringify(skus)); resetStyleArchiveRepository(); resetSkuArchiveRepository(); resetPcsProductArchiveState() })
const colors = listConfigDimensionOptions('colors'), sizes = listConfigDimensionOptions('sizes')
function draft() { return saveProductStyleDraft({ styleName: 'R1 单件验收', materialType: '非毛织', mainImageUrl: '/materials/pcs-reviewed/tee-black.jpg', productCategoryId: listProductCategoryNodes().find(n => !listProductCategoryNodes().some(c => c.parentId === n.id))!.id, productConfigRefs: { brands: [listConfigDimensionOptions('brands')[0].id] } }) }
function firstSku(style = draft()) { return createSkuArchiveBatch(previewProductSkus(style, [{ colorId: colors[0].id, sizeId: sizes[0].id }]))[0] }

test('PROD-001 direct archive is a clean draft with no generated images or development gate', () => {
 const style = saveProductStyleDraft({ styleName: '自建空白款式' })
 assert.match(style.styleCode, /^SPU-\d{4}-\d{6}$/); assert.equal(style.mainImageUrl, ''); assert.equal(style.styleNameEn, ''); assert.equal(style.detailDescription, '')
 assert.equal(style.sourceProjectId, ''); assert.equal(style.currentTechPackVersionId, ''); assert.equal(style.approvalStatus, 'DRAFT'); assert.equal(style.lifecycleStatus, 'NOT_ENABLED')
 assert.equal(style.specificationCount, 0); assert.throws(() => submitProductForApproval('style', style.styleId), /补齐/)
})
test('PROD-002/003 first SKU reviews with style and enablement is independent of technical package', () => {
 const style = draft(), sku = firstSku(style)
 submitProductForApproval('style', style.styleId); assert.equal(listSkuArchivesByStyleId(style.styleId)[0].approvalStatus, 'PENDING')
 reviewProductArchive('style', style.styleId, true); setProductLifecycle('style', style.styleId, 'ACTIVE'); setProductLifecycle('sku', sku.skuId, 'ACTIVE')
 const approved = getStyleArchiveById(style.styleId)!; assert.equal(approved.currentTechPackVersionId, ''); assert.equal(resolveStyleArchiveBusinessStatus(approved), 'ACTIVE')
 assert.throws(() => updateStyleArchive(style.styleId, { styleCode: 'RENUMBER' }), /编码/)
})
test('PROD-003 later SKU has independent review and no publishing side effect', () => {
 const style = draft(); firstSku(style); submitProductForApproval('style', style.styleId); reviewProductArchive('style', style.styleId, true)
 const later = createSkuArchiveBatch(previewProductSkus(getStyleArchiveById(style.styleId)!, [{ colorId: colors[1].id, sizeId: sizes[0].id }]))[0]
 assert.equal(later.approvalStatus, 'DRAFT'); submitProductForApproval('sku', later.skuId); reviewProductArchive('sku', later.skuId, true)
 assert.equal(getStyleArchiveById(style.styleId)!.approvalStatus, 'APPROVED'); assert.equal(later.channelMappingCount, 0)
})
test('PROD-004 same delivery identity is unique; different physical artwork creates distinct code', () => {
 const style = draft(); firstSku(style)
 assert.throws(() => previewProductSkus(style, [{ colorId: colors[0].id, sizeId: sizes[0].id }]), /已存在/)
 const [a, b] = previewProductSkus(style, ['pl001', 'pl002'].map(patternId => ({ colorId: colors[0].id, sizeId: sizes[0].id, patternId })))
 assert.notEqual(a.skuCode, b.skuCode); createSkuArchiveBatch([a, b])
 assert.throws(() => saveProductSkuDraft(b.skuId, { patternId: 'pl001' }), /已存在/)
})
test('PROD-005 SKU barcode and approved identity are immutable/unique', () => {
 const style = draft(), sku = firstSku(style); saveProductSkuDraft(sku.skuId, { barcode: 'R1-BARCODE' })
 const [next] = previewProductSkus(style, [{ colorId: colors[1].id, sizeId: sizes[0].id }]); next.barcode = 'R1-BARCODE'
 assert.throws(() => createSkuArchiveBatch([next]), /条码/)
 submitProductForApproval('sku', sku.skuId); reviewProductArchive('sku', sku.skuId, true)
 assert.throws(() => saveProductSkuDraft(sku.skuId, { patternId: 'plNEW' }), /身份/)
})
test('PROD-006 physical set and bundle preserve units and fixed composition', () => {
 const all = listSkuArchives(), set = all.find(s => s.skuId === 'sku_r1_physical_set_m')!, bundle = all.find(s => s.skuId === 'sku_r1_virtual_bundle_m')!
 assert.equal(set.pricingUnit, '套'); assert.equal(bundle.bundleComponents?.length, 2)
 assertProductSkuIdentity(bundle, all)
 assert.throws(() => assertProductSkuIdentity({ ...bundle, bundleComponents: [{ skuId: bundle.skuId, quantity: 1 }, { skuId: set.skuId, quantity: 1 }] }, all), /自引用/)
 assert.throws(() => assertProductSkuIdentity({ ...bundle, bundleComponents: bundle.bundleComponents!.slice(0, 1) }, all), /至少/)
 assert.throws(() => saveProductSkuDraft(bundle.skuId, { bundleComponents: [{ skuId: set.skuId, quantity: 2 }] }), /历史组成/)
})
test('PROD-007 same-style does not imply substitution; explicit conditions required', () => {
 const style = draft(); assertProductStyleIdentity({ ...style, sameStyleIds: [styles.records[0].styleId] }, listStyleArchives())
 assert.throws(() => assertProductStyleIdentity({ ...style, sameStyleIds: [style.styleId] }, listStyleArchives()), /自身/)
 assert.throws(() => assertProductStyleIdentity({ ...style, substitutionRelations: [{ id: 'r', targetKind: 'PRODUCT_SKU', targetId: skus.records[0].skuId, conditions: '', version: 1 }] }, listStyleArchives()), /适用条件/)
})
test('PROD-008 copy clears technical/channel identity while retaining reusable content', () => {
 const source = styles.records.find(s => s.currentTechPackVersionId)!, copy = productDraftCopy(source.styleId)
 assert.equal(copy.currentTechPackVersionId, ''); assert.equal(copy.techPackVersionCount, 0); assert.equal(copy.currentTechPackVersionCode, ''); assert.equal(copy.channelProductCount, 0)
 assert.equal(copy.sourceProjectId, ''); assert.equal(copy.mainImageUrl, source.mainImageUrl); assert.equal(copy.styleCode, '')
})
test('PROD-009 package dimensions calculate m3 and reject negative or empty containment', () => {
 const sku = firstSku(); assert.throws(() => saveProductSkuDraft(sku.skuId, { weightKg: -1 }), /非负/); assert.throws(() => saveProductSkuDraft(sku.skuId, { packageQuantity: 0 }), /大于 0/)
 saveProductSkuDraft(sku.skuId, { weightKg: 0, lengthCm: 30, widthCm: 20, heightCm: 10, packageQuantity: 1 })
 assert.ok(renderPcsSpecificationDetailPage(sku.skuId).includes('规格资料'))
})
test('PROD-010 details and lists are independent; archive has no procurement or inventory controls', () => {
 const html = renderPcsStyleArchiveListPage(); assert.match(html, /新增款式/); assert.match(html, /列设置/); assert.doesNotMatch(html, /维护供应商|库存数量|开发项目|本机数据/)
 const detail = renderPcsStyleArchiveDetailPage(styles.records[0].styleId)
 for (const tab of ['基本资料', '销售基础内容', '规格', '技术引用', '同款与组合', '记录']) assert.ok(detail.includes(tab))
 assert.doesNotMatch(detail, /data-pcs-product-archive-field=/)
})
test('PROD-011 counts and WMS demo identity refer to actual SKU records, without copying stock', () => {
 const sku = listSkuArchives().find(s => s.skuId === 'sku_r1_wms_tee_black_s')!
 assert.equal(sku.skuCode, 'SKU-GC-20001'); assert.equal(sku.styleCode, 'SPU-GC-1001'); assert.equal(sku.colorName, '黑色'); assert.equal(sku.sizeName, 'S'); assert.equal(sku.pricingUnit, '件')
 assert.ok(!('inventory' in sku)); assert.ok(!('stock' in sku))
})
test('PROD-012 lifecycle status never derives activation from current tech version', () => {
 const style = { ...styles.records[0], archiveStatus: 'DRAFT' as const, approvalStatus: 'APPROVED' as const, lifecycleStatus: 'NOT_ENABLED' as const, currentTechPackVersionId: 'exists' }
 assert.equal(resolveStyleArchiveBusinessStatus(style), 'NOT_ENABLED'); assert.equal(resolveStyleArchiveBusinessStatus({ ...style, lifecycleStatus: 'INACTIVE' }), 'INACTIVE')
})

test('GOV-024 review revalidates the current pending style and changes no approval on failure', () => {
 const style = draft(); const sku = firstSku(style)
 submitProductForApproval('style', style.styleId)
 saveProductStyleDraft({ ...getStyleArchiveById(style.styleId)!, productConfigRefs: { brands: [] }, brandName: '', productCategoryId: '', categoryName: '', subCategoryName: '', thirdCategoryName: '' }, style.styleId)
 assert.throws(() => reviewProductArchive('style', style.styleId, true), /补齐/)
 assert.equal(getStyleArchiveById(style.styleId)!.approvalStatus, 'PENDING')
 assert.equal(listSkuArchivesByStyleId(style.styleId).find(s => s.skuId === sku.skuId)!.approvalStatus, 'PENDING')
})
test('GOV-020 archive rejects an active bundle component without a page-supplied count', () => {
 assert.throws(() => setProductLifecycle('sku', 'sku_r1_tee_white_m', 'ARCHIVED'), /启用组合/)
 assert.equal(listSkuArchives().find(s => s.skuId === 'sku_r1_tee_white_m')!.lifecycleStatus, 'ACTIVE')
})

test('STYLE-004/021 and SKU-005 preserve multilingual names and verified responsible person without channel writes', async () => {
 const { getProjectCreateCatalog } = await import('../src/data/pcs-project-repository.ts')
 const owner = getProjectCreateCatalog().owners[0]
 const style = saveProductStyleDraft({ styleName: '多语款式', buyerId: owner.id, styleNameTranslations: { en: 'Style', id: 'Gaya', ms: 'Rekaan' } })
 assert.equal(style.buyerName, owner.name); assert.equal(style.buyerId, owner.id); assert.equal(style.styleNameEn, 'Style')
 assert.equal(style.styleNameTranslations?.id, 'Gaya')
 const changed = getStyleArchiveById(style.styleId)!; changed.styleNameTranslations!.id = 'not saved'
 assert.equal(getStyleArchiveById(style.styleId)!.styleNameTranslations?.id, 'Gaya')
 const sku = firstSku(style), saved = saveProductSkuDraft(sku.skuId, { skuNameTranslations: { en: 'Black S', id: 'Hitam S', ms: 'Hitam S' } })
 assert.equal(saved.skuNameEn, 'Black S'); assert.equal(saved.skuNameTranslations?.id, 'Hitam S')
 assert.equal(saved.channelMappingCount, 0)
 assert.throws(() => saveProductStyleDraft({ ...style, buyerId: 'supplier-id' }, style.styleId), /人员目录/)
 assert.throws(() => saveProductStyleDraft({ ...style, yearTag: '2026.5' }, style.styleId), /四位整数/)
})
test('SKU-010 aliases identify one SKU and cannot collide with another barcode or code', () => {
 const style = draft(), sku = firstSku(style)
 const saved = saveProductSkuDraft(sku.skuId, { barcodeAliases: [' OLD-1 ', 'OLD-1', 'LEGACY-2'] })
 assert.deepEqual(saved.barcodeAliases, ['OLD-1', 'LEGACY-2'])
 const second = createSkuArchiveBatch(previewProductSkus(style, [{ colorId: colors[1].id, sizeId: sizes[0].id }]))[0]
 assert.throws(() => saveProductSkuDraft(second.skuId, { barcode: 'old-1' }), /其他 SKU/)
 assert.throws(() => saveProductSkuDraft(second.skuId, { barcodeAliases: [sku.skuCode] }), /其他 SKU/)
 assert.equal(listSkuArchives().find(s => s.skuId === second.skuId)!.barcode, '')
})
test('SKU-011 approved main unit cannot be changed via repository command', () => {
 const style = draft(), sku = firstSku(style)
 submitProductForApproval('sku', sku.skuId); reviewProductArchive('sku', sku.skuId, true)
 assert.throws(() => saveProductSkuDraft(sku.skuId, { pricingUnit: '套' }), /主计量单位不能修改/)
 assert.equal(listSkuArchives().find(s => s.skuId === sku.skuId)!.pricingUnit, '件')
})

test('PACK-001..013 multiple product packaging preserves old containment versions and derives volume', () => {
 const sku = firstSku()
 const packageSpecs = [
  { packageSpecId: 'bag', ownerSkuId: sku.skuId, packageTypeId: '包', contentQty: 1, contentUnitId: sku.pricingUnit, grossWeightKg: 0.4, lengthCm: 30, widthCm: 20, heightCm: 2, volumeM3: null, measurementBasis: '每袋', version: 1, status: 'ACTIVE' as const },
  { packageSpecId: 'box', ownerSkuId: sku.skuId, packageTypeId: '箱', contentQty: 20, contentUnitId: sku.pricingUnit, grossWeightKg: 9, lengthCm: 60, widthCm: 40, heightCm: 50, volumeM3: null, measurementBasis: '每箱', version: 1, status: 'ACTIVE' as const },
 ]
 const saved = saveProductSkuDraft(sku.skuId, { packageSpecs })
 assert.equal(saved.packageSpecs?.length, 2); assert.equal(saved.packageSpecs?.[1].volumeM3, 0.12)
 const edited = saveProductSkuDraft(sku.skuId, { packageSpecs: saved.packageSpecs!.map(p => ({ ...p, contentQty: p.packageSpecId === 'box' ? 24 : p.contentQty })) })
 assert.equal(edited.packageSpecs?.[1].version, 2); assert.equal(edited.packageSpecHistory?.find(p => p.packageSpecId === 'box')?.contentQty, 20)
 assert.throws(() => saveProductSkuDraft(sku.skuId, { packageSpecs: [{ ...packageSpecs[0], lengthCm: 0 }] }), /未知请留空/)
 assert.throws(() => saveProductSkuDraft(sku.skuId, { packageSpecs: [{ ...packageSpecs[0], contentUnitId: 'KG' }] }), /主计量单位/)
 assert.throws(() => saveProductSkuDraft(sku.skuId, { packageSpecs: [{ ...packageSpecs[0], measurementBasis: '' }] }), /测量基准/)
})
test('SKU-008 flower identity references the existing pattern library instead of inventing an ID', async () => {
 const { listMaterialPatternChoices } = await import('../src/data/pcs-material-pattern.ts')
 const pattern = listMaterialPatternChoices()[0], style = draft()
 const [sku] = previewProductSkus(style, [{ colorId: colors[0].id, sizeId: sizes[0].id, patternIdentityId: pattern.id }])
 assert.equal(sku.patternIdentityId, pattern.id); assert.equal(sku.printName, pattern.pattern_code); assert.ok(sku.skuCode.endsWith(pattern.pattern_code))
 assert.throws(() => previewProductSkus(style, [{ colorId: colors[0].id, sizeId: sizes[0].id, patternIdentityId: 'missing' }]), /可引用/)
})
test('STYLE-024 image purposes preserve gallery ordering when the archive is copied', () => {
 const style = draft()
 saveProductStyleDraft({ ...style, galleryImageUrls: ['/front.jpg', '/back.jpg'], galleryImageIds: ['front', 'back'], galleryImagePurposes: ['正面', '背面'] }, style.styleId)
 const copied = productDraftCopy(style.styleId)
 assert.deepEqual(copied.galleryImagePurposes, ['正面', '背面']); assert.deepEqual(copied.galleryImageIds, ['front', 'back'])
})

test('SKU stable identity survives dictionary label changes and still matches legacy records', () => {
 const original = firstSku()
 const renamed = { ...original, skuId: 'duplicate-identity', skuCode: 'NEW-DUPLICATE-CODE', colorName: '重新命名的颜色', sizeName: '重新命名的尺码' }
 assert.throws(() => assertProductSkuIdentity(renamed, [original]), /已存在/)
 const legacy = { ...original, colorId: undefined, sizeId: undefined }
 assert.throws(() => assertProductSkuIdentity({ ...renamed, colorName: original.colorName, sizeName: original.sizeName }, [legacy]), /已存在/)
 assert.doesNotThrow(() => assertProductSkuIdentity({ ...original, colorName: renamed.colorName, approvalStatus: 'APPROVED' }, [original], { ...original, approvalStatus: 'APPROVED' }))
})

test('Draft main unit and package content unit change together; approved unit remains locked', () => {
 const sku = firstSku()
 const initial = { packageSpecId: 'unit-bag', ownerSkuId: sku.skuId, packageTypeId: '箱', contentQty: 20, contentUnitId: sku.pricingUnit, grossWeightKg: null, lengthCm: null, widthCm: null, heightCm: null, volumeM3: null, measurementBasis: '每箱', version: 1, status: 'ACTIVE' as const }
 saveProductSkuDraft(sku.skuId, { packageSpecs: [initial] })
 const changed = saveProductSkuDraft(sku.skuId, { pricingUnit: '套', packageSpecs: [{ ...initial, contentUnitId: '套' }] })
 assert.equal(changed.packageSpecs?.[0].contentUnitId, '套'); assert.equal(changed.packageSpecs?.[0].version, 2)
 assert.equal(changed.packageSpecHistory?.[0].contentUnitId, sku.pricingUnit)
 submitProductForApproval('sku', sku.skuId); reviewProductArchive('sku', sku.skuId, true)
 assert.throws(() => saveProductSkuDraft(sku.skuId, { pricingUnit: '件', packageSpecs: [{ ...initial, contentUnitId: '件' }] }), /主计量单位不能修改/)
})

test('Bundle components measured in pieces cannot contain half a piece', () => {
 const records = listSkuArchives(), bundle = records.find(item => item.skuId === 'sku_r1_virtual_bundle_m')!
 const first = bundle.bundleComponents![0]
 assert.throws(() => assertProductSkuIdentity({ ...bundle, bundleComponents: [{ ...first, quantity: 0.5 }, bundle.bundleComponents![1]] }, records), /整数/)
})

test('GOV-005/006/007/009/014 persist one operator identity and before/after audit through approval', () => {
 const style = draft(), sku = firstSku(style)
 const saved = saveProductStyleDraft({ ...style, styleName: '修改后的款式', changeReason: '修正资料' }, style.styleId)
 const log = saved.archiveLogs!.at(-1)!
 assert.equal(log.reason, '修正资料'); assert.equal(log.operatorId, saved.createdById)
 assert.equal(log.changes!.find(c => c.field === 'styleName')!.before, style.styleName)
 assert.equal(log.changes!.find(c => c.field === 'styleName')!.after, '修改后的款式')
 submitProductForApproval('style', style.styleId); reviewProductArchive('style', style.styleId, true)
 const approved = getStyleArchiveById(style.styleId)!, action = approved.archiveLogs!.at(-1)!
 assert.equal(approved.updatedAt, action.time); assert.equal(approved.updatedById, action.operatorId)
 assert.equal(action.changes!.find(c => c.field === 'approvalStatus')!.after, 'APPROVED')
 assert.equal(listSkuArchivesByStyleId(style.styleId)[0].createdById, log.operatorId)
})
test('STYLE-018/027 cannot approve a style missing material type or save a nonexistent substitution', () => {
 const style = draft(); firstSku(style)
 saveProductStyleDraft({ ...style, materialType: '' }, style.styleId)
 assert.throws(() => submitProductForApproval('style', style.styleId), /补齐/)
 assert.throws(() => saveProductStyleDraft({ ...style, substitutionRelations: [{ id: 'r', targetKind: 'PRODUCT_SKU', targetId: 'missing-target', conditions: '同色同尺', version: 1 }] }, style.styleId), /目标不存在/)
 assert.equal(getStyleArchiveById(style.styleId)!.substitutionRelations?.length || 0, 0)
})
test('SKU-011/COMP-001 main unit uses stable dictionary identity and composition owns stable identity', () => {
 const sku = firstSku(); assert.ok(sku.mainUnitId)
 assert.throws(() => saveProductSkuDraft(sku.skuId, { pricingUnit: '任意单位' }), /单位字典/)
 const bundle = listSkuArchives().find(s => s.skuId === 'sku_r1_virtual_bundle_m')!
 assert.equal(bundle.compositionId, `composition:${bundle.skuId}`)
 assert.equal(bundle.pricingUnit, '套'); assert.notEqual(bundle.mainUnitId, sku.mainUnitId)
})
test('GOV-010/011/013 historical provenance is preserved as read-only data', () => {
 const style = draft()
 const saved = saveProductStyleDraft({ ...style, sourceSystem: '历史ERP', sourceId: 'source-100', legacyValues: [{ field: '原采购成本', value: 12, unit: '件', currency: 'CNY' }] }, style.styleId)
 assert.equal(saved.sourceSystem, '历史ERP'); assert.equal(saved.sourceId, 'source-100'); assert.equal(saved.legacyValues![0].currency, 'CNY')
})
