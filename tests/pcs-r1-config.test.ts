import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createInitialConfigData } from '../src/data/pcs-config-dimensions.ts'
import { pcsRecordStore } from '../src/data/pcs-record-runtime.ts'
import { getConfigWorkspaceSnapshot, getConfigOptionUsage, listConfigDimensionOptions, listProductCategoryNodes, saveConfigDimensionOption, resetConfigWorkspaceCache } from '../src/data/pcs-config-workspace-repository.ts'
import { listMaterialTemplates, getMaterialTemplate, getMaterialTemplateByVersion, getMaterialTemplateUsage, getMaterialConfigSnapshot, resetMaterialConfigCache, saveMaterialTemplateVersion, approveMaterialTemplate, saveMaterialUnit, listMaterialUnitDefinitions, listMaterialProcessConfigurations, saveMaterialProcessConfiguration } from '../src/data/pcs-material-config.ts'
import { getLatestPcsExchangeRate, updateLatestPcsExchangeRate, displayStandardCost, resetPcsExchangeRateCache } from '../src/data/pcs-exchange-rate-config.ts'
import { resolveStyleProductInformation } from '../src/data/pcs-style-product-information.ts'

test('CFG-014 mixed old category-number IDs and new demo references resolve without rewriting saved configuration', () => {
  const current = getConfigWorkspaceSnapshot()
  const number = createInitialConfigData().categoryNumbers.find(row => row.code === '89')!
  const legacyId = number.id.replace('categoryNumbers-', 'styleCodes-')
  const option = { ...number, id: legacyId, name_zh: '用户维护的印花套装' }
  const context = { options: { categoryNumbers: [option] }, categories: [] }
  const source = { styleId: 'mixed-refs', styleCode: 'R1-MIXED', styleName: '引用核对', productConfigRefs: { categoryNumbers: [number.id] }, categoryCode: '89', categoryCodeName: '印花套装' } as any
  const resolved = resolveStyleProductInformation(source, context)
  assert.equal(resolved.categoryCode, '89')
  assert.equal(resolved.categoryCodeName, '用户维护的印花套装')
  assert.deepEqual(resolved.productConfigRefs!.categoryNumbers, [legacyId])
  assert.deepEqual(source.productConfigRefs.categoryNumbers, [number.id])
  pcsRecordStore.setItem('higood-pcs-config-workspace-store-v1', JSON.stringify({ ...current, options: [...current.options.filter(row => row.dimensionId !== 'categoryNumbers'), { ...option, dimensionId: 'categoryNumbers' }] }))
  pcsRecordStore.setItem('higood-pcs-style-archive-store-v3', JSON.stringify({ records: [source] }))
  resetConfigWorkspaceCache()
  assert.equal(getConfigOptionUsage('categoryNumbers', legacyId).length, 1)
  assert.equal(listConfigDimensionOptions('categoryNumbers')[0].id, legacyId)
  const removed = resolveStyleProductInformation(source, { ...context, options: { categoryNumbers: [] } })
  assert.equal(removed.categoryCodeName, '配置项已删除')
  const mismatched = resolveStyleProductInformation(source, { ...context, options: { categoryNumbers: [{ ...option, code: 'OTHER' }] } })
  assert.equal(mismatched.categoryCodeName, '配置项已删除')
  pcsRecordStore.setItem('higood-pcs-config-workspace-store-v1', JSON.stringify(current)); resetConfigWorkspaceCache()
})

test('original size identities remain stable and category numbers keep formal codes and legacy labels', () => {
  const data = createInitialConfigData()
  assert.equal(data.sizes.find(row => row.id === 'sizes-1')!.name_zh, 'S')
  assert.equal(data.sizes.find(row => row.id === 'sizes-9')!.name_zh, 'One Size')
  assert.equal(data.sizes.find(row => row.name_zh === 'XS')!.id, 'sizes-10')
  const category = data.categoryNumbers.find(row => row.code === '89')!
  assert.equal(category.name_zh, '印花套装'); assert.equal(category.name_en, 'Printed Set-35-55')
  assert.deepEqual(category.aliases, ['89-Printed Set-35-55印花套装'])
  assert.equal(data.productPositioning.length, 8)
  assert.notEqual(data.categories[0].id, data.styles[0].id)
})

test('legacy custom configuration and stable IDs survive category-number field rename', () => {
  const initial = getConfigWorkspaceSnapshot()
  pcsRecordStore.setItem('higood-pcs-config-workspace-store-v1', JSON.stringify({ flatOptions: { styleCodes: [{ id: 'styleCodes-history-89', code: '86', name_zh: '89-Printed Set-35-55印花套装', status: 'ENABLED', sortOrder: 1, updatedAt: '2026-01-01', updatedBy: '原维护人', logs: [] }], specialCrafts: [...createInitialConfigData().specialCrafts, { id: 'specialCrafts-custom', code: '9', name_zh: '用户新增工艺', status: 'ENABLED', sortOrder: 9, updatedAt: '2026-10-04', updatedBy: '用户', logs: [] }] }, categoryNodes: initial.categoryNodes }))
  resetConfigWorkspaceCache()
  const number = listConfigDimensionOptions('categoryNumbers')[0]
  assert.equal(number.id, 'styleCodes-history-89'); assert.equal(number.code, '89'); assert.equal(number.name_zh, '印花套装')
  assert.ok(listConfigDimensionOptions('specialCrafts').some(row => row.id === 'specialCrafts-custom'))
  pcsRecordStore.setItem('higood-pcs-config-workspace-store-v1', JSON.stringify(initial)); resetConfigWorkspaceCache()
})

test('configuration references are counted from current records and disabling retains history', () => {
  const option = listConfigDimensionOptions('styles')[0]
  pcsRecordStore.setItem('higood-pcs-style-archive-store-v3', JSON.stringify({ records: [{ styleId: 'spu', styleCode: 'SPU-1', styleName: '样衣', productCategoryId: 'product-category-3', productConfigRefs: { styles: [option.id] } }] }))
  assert.equal(getConfigOptionUsage('styles', option.id).length, 1)
  assert.equal(listProductCategoryNodes().find(row => row.id === 'product-category-1')!.productCount, 1)
  const disabled = saveConfigDimensionOption('styles', option.id, { ...option, code: option.code, nameZh: option.name_zh, status: 'DISABLED', sortOrder: 10 })
  assert.equal(disabled.id, option.id)
  assert.equal(getConfigOptionUsage('styles', option.id).length, 1)
  assert.equal(listConfigDimensionOptions('styles').find(row => row.id === option.id)!.status, 'DISABLED')
  assert.throws(() => saveConfigDimensionOption('styles', option.id, { code: 'changed', nameZh: '变更', sortOrder: 1, status: 'ENABLED' }), /业务编码不能修改/)
})

test('five material families have explicit field templates and unknown categories never use another template', () => {
  assert.equal(new Set(listMaterialTemplates().map(row => row.kind)).size, 5)
  const button = getMaterialTemplate('accessory', '纽扣'), zip = getMaterialTemplate('accessory', '拉链')
  assert.ok(button.fields.some(row => row.key === 'diameter' && row.unit === 'mm'))
  assert.ok(!zip.fields.some(row => row.key === 'diameter'))
  assert.ok(zip.fields.some(row => row.key === 'length' && row.unit === 'cm'))
  assert.ok(!getMaterialTemplate('consumable', '包装袋').fields.some(row => row.key === 'color'))
  assert.equal(getMaterialTemplate('parts', '裁床配件').fields.find(row => row.key === 'equipment')!.type, 'reference')
  assert.equal(getMaterialTemplate('parts', '裁床配件').fields.find(row => row.key === 'equipment')!.valueShape, 'equipmentCompatibility')
  const fabric = getMaterialTemplate('fabric', '梭织布')
  assert.equal(fabric.fields.filter(row => row.level === 'root' && /width/i.test(row.key)).length, 1)
  assert.ok(getMaterialTemplate('yarn', '针织用纱').fields.some(row => row.key === 'countSystem'))
  assert.ok(getMaterialTemplate('accessory', '流苏辅料'))
  assert.ok(getMaterialTemplate('accessory', '刺绣花边'))
  assert.throws(() => getMaterialTemplate('accessory', '未知辅料'), /已审核模板/)
})

test('material configuration usage follows locked template fields and actual SKU attributes', () => {
  const original = getMaterialTemplate('fabric', '梭织布')
  const construction = listConfigDimensionOptions('constructions')[0]
  const color = listConfigDimensionOptions('colors')[0]
  const pantone = listConfigDimensionOptions('pantone')[0]
  pcsRecordStore.setItem('higood-pcs-material-config-v1', JSON.stringify(getMaterialConfigSnapshot()))
  pcsRecordStore.setItem('higood-pcs-material-archive-store-v2', JSON.stringify({ records: [{ materialId: 'usage-root', materialCode: 'ML-REF', materialName: '配置引用测试', templateId: original.templateId, templateVersion: original.version, categoryAttributes: { construction: construction.name_zh } }], skuRecords: [{ materialId: 'usage-root', materialSkuId: 'usage-sku', materialSkuCode: 'ML-REF-1', colorName: color.name_zh, pantoneSystem: pantone.code.split(' ')[0], pantoneCode: pantone.code.split(' ')[1] }] }))
  assert.equal(original.fields.find(row => row.key === 'construction')!.dictionaryId, 'constructions')
  assert.equal(getConfigOptionUsage('constructions', construction.id).length, 1)
  assert.equal(getConfigOptionUsage('colors', color.id).filter(row => row.kind === '物料 SKU').length, 1)
  assert.equal(getConfigOptionUsage('pantone', pantone.id).length, 1)
  assert.equal(getMaterialTemplate('parts', '裁床配件').fields.find(row => row.key === 'equipment')!.valueShape, 'equipmentCompatibility')
})

test('template editing and approval preserve versions already referenced by material roots', () => {
  const original = getMaterialTemplate('fabric', '梭织布')
  pcsRecordStore.setItem('higood-pcs-material-archive-store-v2', JSON.stringify({ records: [{ materialId: 'root', materialCode: 'ML-1', materialName: '面料', templateId: original.templateId, templateVersion: original.version }], skuRecords: [], unitRelations: [] }))
  const draft = saveMaterialTemplateVersion({ ...original, changeNote: '新增检验说明', fields: [...original.fields, { key: 'inspection', label: '检验说明', level: 'root', type: 'text', required: false, identity: false }] }, '测试维护人')
  assert.equal(draft.version, original.version + 1); assert.equal(draft.status, 'DRAFT')
  assert.equal(getMaterialTemplate('fabric', '梭织布').version, original.version)
  const edited = saveMaterialTemplateVersion({ ...draft, changeNote: '完善帮助' }, '测试维护人')
  assert.equal(edited.version, original.version + 1)
  approveMaterialTemplate(draft.templateId, draft.version, '同一维护人')
  assert.equal(getMaterialTemplate('fabric', '梭织布').version, original.version + 1)
  assert.deepEqual(getMaterialTemplateByVersion(original.templateId, original.version).fields, original.fields)
  assert.equal(getMaterialTemplateUsage(original.templateId, original.version).length, 1)
  assert.equal(getMaterialTemplateUsage(original.templateId, original.version + 1).length, 0)
  const disabled = saveMaterialTemplateVersion({ ...getMaterialTemplate('fabric', '梭织布'), enabled: false }, '维护人')
  approveMaterialTemplate(disabled.templateId, disabled.version, '维护人')
  assert.throws(() => getMaterialTemplate('fabric', '梭织布'), /没有启用/)
  assert.ok(getMaterialTemplateByVersion(original.templateId, original.version))
})

test('controlled fields and unit identities reject invalid configuration', () => {
  const template = getMaterialTemplate('accessory', '纽扣')
  assert.throws(() => saveMaterialTemplateVersion({ ...template, fields: [{ key: 'script', label: '脚本', level: 'root', type: 'script' as any, required: false, identity: false }] }, '维护人'), /支持的属性类型/)
  assert.throws(() => saveMaterialTemplateVersion({ ...template, fields: [template.fields[0], template.fields[0]] }, '维护人'), /不得重复/)
  const unit = listMaterialUnitDefinitions().find(row => row.code === 'M')!
  assert.throws(() => saveMaterialUnit({ ...unit, dimension: 'mass' }), /量纲不可改变/)
  saveMaterialUnit({ ...unit, enabled: false }, '维护人')
  assert.equal(listMaterialUnitDefinitions().find(row => row.id === unit.id)!.enabled, false)
  assert.throws(() => saveMaterialUnit({ id: 'new-count', code: '粒', label: '粒', dimension: 'count', precision: 2, enabled: true }), /不支持小数/)
  const process = listMaterialProcessConfigurations().find(row => row.id === 'PLEATING')!
  assert.equal(process.material, false)
  assert.throws(() => saveMaterialProcessConfiguration({ ...process, material: true }), /业务规则约束/)
  saveMaterialProcessConfiguration({ ...process, enabled: false })
  assert.equal(listMaterialProcessConfigurations().find(row => row.id === process.id)!.enabled, false)
})

test('display exchange rates preserve base costs and accept only positive rates', () => {
  assert.throws(() => updateLatestPcsExchangeRate({ idrPerCny: 0, usdPerCny: .14, updatedBy: '维护人' }), /大于 0/)
  assert.throws(() => updateLatestPcsExchangeRate({ idrPerCny: 2200, usdPerCny: -1, updatedBy: '维护人' }), /大于 0/)
  updateLatestPcsExchangeRate({ idrPerCny: 2300, usdPerCny: .15, source: '维护展示汇率', updatedBy: '维护人' })
  assert.equal(displayStandardCost(10, 'CNY'), 10); assert.equal(displayStandardCost(10, 'IDR'), 23000); assert.equal(displayStandardCost(10, 'USD'), 1.5)
  assert.equal(getLatestPcsExchangeRate().logs!.length, 1)
  const snapshot = getMaterialConfigSnapshot(); resetMaterialConfigCache(); assert.deepEqual(getMaterialConfigSnapshot(), JSON.parse(JSON.stringify(snapshot)))
})


test('COST-004 missing or invalid persisted display rates stay unavailable instead of taking seed values', () => {
  const original = getLatestPcsExchangeRate()
  for (const invalid of [undefined, null, 0, -2, '2200']) {
    pcsRecordStore.setItem('higood-pcs-exchange-rate-config-v1', JSON.stringify({ ...original, idrPerCny: invalid, usdPerCny: undefined }))
    resetPcsExchangeRateCache()
    assert.ok(Number.isNaN(getLatestPcsExchangeRate().idrPerCny))
    assert.equal(displayStandardCost(10, 'IDR'), null)
    assert.equal(displayStandardCost(10, 'USD'), null)
    assert.equal(displayStandardCost(10, 'CNY'), 10)
  }
  pcsRecordStore.setItem('higood-pcs-exchange-rate-config-v1', JSON.stringify(original))
  resetPcsExchangeRateCache()
})

test('CFG-005/010 languages are separate and edits preserve exact old/new values and reason', () => {
 const saved = saveConfigDimensionOption('styles', null, { code: 'R1-LANG', nameZh: '轻盈', nameEn: 'Airy', nameId: 'Ringan', nameMs: 'Ringan MS', sortOrder: 77, status: 'ENABLED' })
 const changed = saveConfigDimensionOption('styles', saved.id, { code: saved.code, nameZh: saved.name_zh, nameEn: saved.name_en, nameId: 'Ringan baru', nameMs: saved.name_ms, sortOrder: 78, status: 'ENABLED', changeReason: '修正印尼语' })
 assert.equal(changed.name_ms, 'Ringan MS'); assert.equal(changed.name_en, 'Airy')
 assert.deepEqual(changed.logs.at(-1)!.changes!.find(v => v.field === '印尼语名称'), { field: '印尼语名称', before: 'Ringan', after: 'Ringan baru' })
 assert.equal(changed.logs.at(-1)!.reason, '修正印尼语')
 const keep = listConfigDimensionOptions('styles').find(v => v.id === saved.id)!
 changed.logs.at(-1)!.changes![0].after = 'not saved'
 assert.equal(listConfigDimensionOptions('styles').find(v => v.id === saved.id)!.logs.at(-1)!.changes![0].after, keep.logs.at(-1)!.changes![0].after)
})
test('CFG-009 usage carries the actual archive detail destination', () => {
 const option = listConfigDimensionOptions('styles')[0]
 pcsRecordStore.setItem('higood-pcs-style-archive-store-v3', JSON.stringify({ records: [{ styleId: 'usage-id', styleCode: 'SPU-LINK', styleName: '跳转款式', productConfigRefs: { styles: [option.id] } }] }))
 assert.equal(getConfigOptionUsage('styles', option.id)[0].href, '/pcs/products/styles/usage-id')
})

test('CFG-015 unit reads isolate aliases and nested audit values, and observe later saves', () => {
 const unit = listMaterialUnitDefinitions().find(row => row.code === 'M')!
 const config = getMaterialConfigSnapshot()
 config.units = config.units.map(row => row.id === unit.id ? { ...row, aliases: ['米长'], logs: [{ id: 'unit-audit', action: '核对', detail: '单位', operator: '验收', time: '2026-10-06', changes: [{ field: '名称', before: '米', after: '米长' }, { field: '别名', before: [], after: ['米长'] }] }] } : row)
 pcsRecordStore.setItem('higood-pcs-material-config-v1', JSON.stringify(config)); resetMaterialConfigCache()
 const read = listMaterialUnitDefinitions().find(row => row.id === unit.id)!
 read.aliases![0] = '不得污染'; read.logs![0].changes![0].after = '不得污染'
 ;(read.logs![0].changes![1].after as string[])[0] = '不得污染'
 const next = listMaterialUnitDefinitions().find(row => row.id === unit.id)!
 assert.equal(next.aliases![0], '米长'); assert.equal(next.logs![0].changes![0].after, '米长')
 assert.deepEqual(next.logs![0].changes![1].after, ['米长'])
 saveMaterialUnit({ ...next, enabled: false })
 assert.equal(listMaterialUnitDefinitions().find(row => row.id === unit.id)!.enabled, false)
})
