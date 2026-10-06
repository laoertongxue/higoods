import test, { beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import * as repo from '../src/data/pcs-material-archive-repository.ts'
import * as config from '../src/data/pcs-material-config.ts'
import { getConfigWorkspaceSnapshot, listConfigDimensionOptions, resetConfigWorkspaceCache, saveConfigDimensionOption } from '../src/data/pcs-config-workspace-repository.ts'
import { validateMaterialBoundFields } from '../src/data/pcs-material-attributes.ts'
import type { MaterialSkuDraftInput } from '../src/data/pcs-material-archive-types.ts'

const configBaseline = config.getMaterialConfigSnapshot()
const optionBaseline = getConfigWorkspaceSnapshot()
const archiveBaseline = repo.getMaterialArchiveBaseline()
beforeEach(() => {
  pcsRecordStore.setItem(config.PCS_MATERIAL_CONFIG_KEY, JSON.stringify(configBaseline)); config.resetMaterialConfigCache()
  pcsRecordStore.setItem('higood-pcs-config-workspace-store-v1', JSON.stringify(optionBaseline)); resetConfigWorkspaceCache()
  pcsRecordStore.setItem(repo.MATERIAL_ARCHIVE_STORAGE_KEY, JSON.stringify(archiveBaseline)); repo.resetMaterialArchiveCache()
})
function sku(extra: Partial<MaterialSkuDraftInput> = {}): MaterialSkuDraftInput {
  return { colorName: '白色', specName: '标准规格', sizeName: '', mainUnit: 'PCS', skuImageUrl: '/materials/tmf/rope-real-bundle.jpg', costPrice: 0, freightCost: 0, weightKg: 0, lengthCm: 0, widthCm: 0, heightCm: 0, barcode: '', ...extra }
}
function root(categoryName: string, extra: Partial<repo.MaterialArchiveDraft> = {}) {
  return repo.createMaterialArchive({ kind: 'accessory', categoryName, materialName: `${categoryName}模板测试`, materialNameEn: 'Template test', specSummary: '', composition: '', processTags: [], widthText: '', gramWeightText: '', pricingUnit: 'PCS', mainImageUrl: '/materials/tmf/rope-real-bundle.jpg', barcodeTemplateCode: 'material-label-r1', remark: '', ...extra })
}
function publish(template: config.MaterialTemplate): config.MaterialTemplate {
  const draft = config.saveMaterialTemplateVersion(template, '测试维护人')
  config.approveMaterialTemplate(draft.templateId, draft.version, '测试维护人')
  return config.getMaterialTemplateByVersion(draft.templateId, draft.version)
}

test('ATTR-012: zipper gauge uses a stable dictionary reference, rejects new unknown or disabled values, and preserves prior labels', () => {
  const template = config.getMaterialTemplate('accessory', '拉链')
  assert.equal(config.getMaterialTemplateByVersion(template.templateId, 2).fields.find(f => f.key === 'gauge')!.type, 'text')
  assert.equal(template.fields.find(f => f.key === 'gauge')!.dictionaryId, 'zipperGauges')
  const gauge = listConfigDimensionOptions('zipperGauges').find(row => row.name_zh === '5#')!
  assert.ok(gauge)
  const material = root('拉链')
  const created = repo.createMaterialSkuRecord(material.materialId, sku({ identityValues: { length: 20, gauge: gauge.name_zh } }))!
  assert.deepEqual(created.identityReferences?.gauge, [{ id: gauge.id, code: gauge.code, name: gauge.name_zh, dictionaryId: 'zipperGauges' }])
  assert.throws(() => repo.createMaterialSkuRecord(material.materialId, sku({ identityValues: { length: 21, gauge: '未知规格' } })), /有效的规格号/)
  saveConfigDimensionOption('zipperGauges', gauge.id, { code: gauge.code, nameZh: '五号拉链', status: 'DISABLED', sortOrder: gauge.sortOrder })
  assert.throws(() => repo.createMaterialSkuRecord(material.materialId, sku({ identityValues: { length: 22, gauge: '五号拉链' } })), /停用/)
  const updated = repo.updateMaterialSkuRecord(created.materialSkuId, { ...created, specName: '只更新展示说明' })!
  assert.equal(updated.identityReferences!.gauge[0].id, gauge.id)
  assert.equal(updated.identityReferences!.gauge[0].name, gauge.name_zh)
  assert.equal(updated.identityValues!.gauge, gauge.name_zh)
})

test('TPL-012: known legacy unit text maps read-only to stable IDs and new attribute units cannot be ambiguous', () => {
  const bag = config.getMaterialTemplate('consumable', '包装袋')
  const before = pcsRecordStore.getItem(config.PCS_MATERIAL_CONFIG_KEY)
  const originalSet = pcsRecordStore.setItem
  pcsRecordStore.setItem = () => { throw new Error('ordinary template reads must not write') }
  try {
    const v1 = config.getMaterialTemplateByVersion(bag.templateId, 1), v2 = config.getMaterialTemplateByVersion(bag.templateId, 2)
    assert.equal(v1.fields.find(f => f.key === 'length')!.unitId, 'unit-cm')
    assert.equal(v2.fields.find(f => f.key === 'length')!.unitId, 'unit-mm')
    assert.equal(v2.fields.find(f => f.key === 'thickness')!.unitId, 'attribute-unit-micrometer')
    assert.equal(config.getMaterialTemplate('consumable', '胶带').fields.find(f => f.key === 'length')!.unitId, 'unit-M')
    assert.ok(config.listMaterialAttributeUnitDefinitions().some(unit => unit.code === 'g/m²' && unit.id === 'attribute-unit-gsm'))
  } finally { pcsRecordStore.setItem = originalSet }
  assert.equal(pcsRecordStore.getItem(config.PCS_MATERIAL_CONFIG_KEY), before)
  const added: config.MaterialTemplateField = { key: 'testDistance', label: '测试距离', level: 'root', type: 'number', unit: 'mm', required: false, identity: false }
  assert.throws(() => config.saveMaterialTemplateVersion({ ...bag, fields: [...bag.fields, added] }, '测试'), /稳定单位/)
  assert.throws(() => config.saveMaterialTemplateVersion({ ...bag, fields: [...bag.fields, { ...added, unitId: 'unit-cm' }] }, '测试'), /不一致/)
  const saved = config.saveMaterialTemplateVersion({ ...bag, fields: [...bag.fields, { ...added, unitId: 'unit-mm' }] }, '测试')
  assert.equal(saved.fields.find(f => f.key === 'testDistance')!.unitId, 'unit-mm')
})

test('TPL-013: new selection fields require a dictionary and legacy enum options retain versioned stable references', () => {
  const button = config.getMaterialTemplate('accessory', '纽扣')
  const oldField = config.getMaterialTemplateByVersion(button.templateId, 2).fields.find(f => f.key === 'fastening')!
  assert.ok(oldField.enumDefinition?.id); assert.equal(oldField.enumDefinition!.version, 2)
  const field = button.fields.find(f => f.key === 'fastening')!
  const record = root('纽扣', { categoryAttributes: { fastening: '脚式' } })
  const reference = record.categoryAttributeReferences!.fastening[0]
  assert.equal(reference.dictionaryId, field.enumDefinition!.id)
  assert.equal(reference.dictionaryVersion, field.enumDefinition!.version)
  assert.equal(reference.id, field.enumDefinition!.options.find(row => row.value === '脚式')!.id)
  const choice: config.MaterialTemplateField = { key: 'newChoice', label: '新选择', type: 'select', level: 'root', required: false, identity: false, options: ['自选项'] }
  assert.throws(() => config.saveMaterialTemplateVersion({ ...button, fields: [...button.fields, choice] }, '测试'), /独立取值字典/)
  const revised = publish({ ...button, fields: button.fields.map(f => f.key === 'fastening' ? { ...f, options: ['脚式', '孔式'] } : f) })
  const revisedField = revised.fields.find(f => f.key === 'fastening')!
  assert.equal(revisedField.enumDefinition!.version, revised.version)
  assert.equal(revisedField.enumDefinition!.options.find(row => row.value === '脚式')!.id, reference.id)
  assert.deepEqual(config.getMaterialTemplateByVersion(button.templateId, button.version).fields.find(f => f.key === 'fastening')!.enumDefinition, field.enumDefinition)
  repo.resetMaterialArchiveCache()
  assert.deepEqual(repo.getMaterialArchiveById(record.materialId)!.categoryAttributeReferences!.fastening[0], reference)
})

test('TPL-009: package template rules bind the existing package model while old template fields and units stay unchanged', () => {
  const template = config.getMaterialTemplate('consumable', '包装袋')
  const old = config.getMaterialTemplateByVersion(template.templateId, 1)
  assert.equal(old.fields.some(f => f.level === 'package' || f.level === 'process'), false)
  const revised = publish({ ...template, fields: template.fields.map(f => f.modelBinding === 'package.grossWeightKg' ? { ...f, label: '确认包装毛重', required: true, requiredWhen: 'always' as const } : f) })
  const record = root('包装袋', { kind: 'consumable', firstSku: sku({ identityValues: { length: 300, width: 200, thickness: 50 } }) })
  assert.equal(record.templateVersion, revised.version)
  const item = repo.listMaterialSkuRecordsByMaterialId(record.materialId)[0]
  const pack = { packageTypeId: '包', contentQty: 100, contentUnitId: 'PCS', grossWeightKg: null, lengthCm: null, widthCm: null, heightCm: null, volumeM3: null, volumeSource: 'UNKNOWN' as const, measurementBasis: '包装含量确认', status: 'ACTIVE' as const }
  assert.throws(() => repo.saveMaterialPackageSpec(item.materialSkuId, pack), /确认包装毛重/)
  assert.equal(repo.listMaterialPackageSpecs(item.materialSkuId).length, 0)
  const saved = repo.saveMaterialPackageSpec(item.materialSkuId, { ...pack, grossWeightKg: .5 })
  assert.equal(saved.grossWeightKg, .5); assert.equal(saved.ownerSkuId, item.materialSkuId)
  assert.deepEqual(config.getMaterialTemplateByVersion(template.templateId, 1), old)
  assert.throws(() => config.saveMaterialTemplateVersion({ ...revised, fields: revised.fields.map(f => f.modelBinding === 'package.contentQty' ? { ...f, required: false } : f) }, '测试'), /不能改变/)
  assert.throws(() => config.saveMaterialTemplateVersion({ ...revised, fields: revised.fields.filter(f => f.modelBinding !== 'process.inputSkuId') }, '测试'), /不能删除/)
})

test('TPL-009: process template conditions apply to the process object and preserve required identities', () => {
  const template = config.getMaterialTemplate('fabric', '梭织布')
  const revised = publish({ ...template, fields: template.fields.map(f => f.modelBinding === 'process.deliveryRevisionSegment' ? { ...f, label: '指定交付版本', required: true, requiredWhen: 'always' as const } : f) })
  const values = { inputSkuId: 'sku-input', processType: 'DYEING', processVersionId: '1', pantoneCode: '19-4003' }
  assert.doesNotThrow(() => validateMaterialBoundFields(revised, 'process', values, false, 'DYEING'))
  assert.throws(() => validateMaterialBoundFields(revised, 'process', values, true, 'DYEING'), /指定交付版本/)
  assert.doesNotThrow(() => validateMaterialBoundFields(revised, 'process', { ...values, deliveryRevisionSegment: 'R1' }, true, 'DYEING'))
  assert.throws(() => validateMaterialBoundFields(revised, 'process', { ...values, processType: 'PRINTING', deliveryRevisionSegment: 'R1' }, true, 'PRINTING'), /花型/)
  assert.throws(() => config.saveMaterialTemplateVersion({ ...revised, fields: revised.fields.map(f => f.modelBinding === 'process.inputSkuId' ? { ...f, identity: true } : f) }, '测试'), /固定业务字段/)
})

test('TPL-017: multilingual category names and aliases are versioned without replacing category identity', () => {
  const original = config.getMaterialTemplate('accessory', '拉链')
  const revised = publish({ ...original, categoryNames: { zh: '拉链', en: 'Zipper', id: 'Ritsleting' }, categoryAliases: { en: ['Zip fastener'], id: ['Resleting'] } })
  assert.equal(revised.categoryId, original.categoryId); assert.equal(revised.categoryCode, original.categoryCode)
  config.resetMaterialConfigCache()
  const read = config.getMaterialTemplateByVersion(revised.templateId, revised.version)
  assert.equal(read.categoryNames!.id, 'Ritsleting'); assert.deepEqual(read.categoryAliases!.en, ['Zip fastener'])
  assert.deepEqual(config.getMaterialTemplateByVersion(original.templateId, original.version).categoryNames, original.categoryNames)
  assert.throws(() => config.saveMaterialTemplateVersion({ ...revised, categoryNames: { zh: '拉链', bad_language: 'Bad' } }, '测试'), /语言代码/)
  assert.throws(() => config.saveMaterialTemplateVersion({ ...revised, categoryAliases: { en: ['Zip', 'Zip'] } }, '测试'), /重复/)
  assert.throws(() => config.saveMaterialTemplateVersion({ ...revised, categoryNames: { zh: '其他分类' } }, '测试'), /中文分类名称/)
})

test('TPL-009/012: copying an already converted template does not repeat its previous conversion factor', () => {
  const latest = config.getMaterialTemplate('consumable', '包装袋'), v2 = config.getMaterialTemplateByVersion(latest.templateId, 2)
  assert.deepEqual(v2.previousVersionConversions?.map(row => row.factor), [10, 10, 1000])
  assert.deepEqual(latest.previousVersionConversions, [])
  const copied = config.saveMaterialTemplateVersion({ ...v2, changeNote: '只修改模板说明' }, '测试')
  assert.deepEqual(copied.previousVersionConversions, [])
  assert.deepEqual(config.getMaterialTemplateByVersion(latest.templateId, 2).previousVersionConversions, v2.previousVersionConversions)
})
