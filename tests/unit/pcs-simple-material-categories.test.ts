import assert from 'node:assert/strict'
import test from 'node:test'
import { pcsRecordStore } from '../../src/data/pcs-record-runtime.ts'
import { listMaterialTemplates, resetMaterialConfigCache, saveMaterialTemplateVersion, isPackagingConsumableCategory } from '../../src/data/pcs-material-config.ts'
import { getConfigOptionUsage, listConfigDimensionOptions, saveConfigDimensionOption } from '../../src/data/pcs-config-workspace-repository.ts'
import { listSimpleMaterialCategories, saveSimpleMaterialCategory, getSimpleMaterialCategoryUsage, PCS_SIMPLE_MATERIAL_CATEGORY_KEY } from '../../src/data/pcs-simple-material-categories.ts'
import { renderPcsConfigWorkspacePage, handlePcsConfigWorkspaceEvent, resetPcsConfigWorkspaceState } from '../../src/pages/pcs-config-workspace.ts'

const values = new Map<string, string>()
let writes = 0, failWrite = false
Object.assign(pcsRecordStore, {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => { if (failWrite) throw new DOMException('quota', 'QuotaExceededError'); writes++; values.set(key, value) },
})
function node(data: Record<string, string>): HTMLElement { const element = { dataset: data, closest: () => element }; return element as unknown as HTMLElement }

test('SIMPLE-021/022: legacy identities project into simple classifications with no seed writes; new records have no template requirement', () => {
  resetMaterialConfigCache()
  const baseline = listSimpleMaterialCategories()
  assert.equal(writes, 0)
  assert.equal(baseline.length, 12)
  for (const category of baseline) {
    const legacy = listMaterialTemplates().find(item => item.categoryId === category.id)
    assert.equal(category.code, legacy?.categoryCode)
    assert.equal(category.name, legacy?.category)
    assert.equal('fields' in category, false)
    assert.equal('version' in category, false)
  }
  const created = saveSimpleMaterialCategory({ kind: 'parts', name: '测试工具配件', sortOrder: 80, enabled: true })
  assert.equal(created.code, 'MC-PARTS-32')
  assert.equal(created.logs.length, 1)
  assert.equal(listSimpleMaterialCategories('parts').length, 6)
  assert.ok(values.has(PCS_SIMPLE_MATERIAL_CATEGORY_KEY))
  assert.throws(() => saveSimpleMaterialCategory({ ...created, name: '改名', code: 'CHANGED' }), /编码不能修改/)
  const second = saveSimpleMaterialCategory({ kind: 'parts', code: 'IGNORED', name: '其他名称', sortOrder: 2, enabled: true })
  assert.equal(second.code, 'MC-PARTS-33', 'new category code is generated in the command and cannot be supplied')
  assert.throws(() => saveSimpleMaterialCategory({ kind: 'parts', code: 'OTHER', name: '测试工具配件', sortOrder: 2, enabled: true }), /名称已存在/)
  assert.throws(() => saveMaterialTemplateVersion(listMaterialTemplates().find(item => item.kind === 'parts')!, '测试员'), /只维护分类/)
  assert.ok(isPackagingConsumableCategory('material-category-consumable-20'))
  assert.equal(isPackagingConsumableCategory('包装袋'), false)
})

test('SIMPLE-023/024: usage resolves actual subcategory identity, disabled category retains references and failure preserves source', () => {
  const category = listSimpleMaterialCategories('parts')[0]
  values.set('higood-pcs-material-archive-store-v2', JSON.stringify({ records: [
    { materialId: 'root-test', kind: 'parts', subcategoryId: category.id, categoryName: '旧分类名称', materialCode: 'EP-TEST', materialName: '刀片' },
    { materialId: 'root-legacy', kind: 'parts', categoryName: category.name, materialCode: 'EP-LEGACY', materialName: '老配件' },
    { materialId: 'root-wrong-id', kind: 'parts', subcategoryId: 'other-category', categoryName: category.name, materialCode: 'EP-OTHER', materialName: '其他分类' },
    { materialId: 'root-false-field', kind: 'parts', category: category.name, materialCode: 'EP-FALSE', materialName: '错误字段' },
  ], skuRecords: [], packages: [] }))
  assert.deepEqual(getSimpleMaterialCategoryUsage(category.id).map(item => item.id), ['root-test', 'root-legacy'])
  const updated = saveSimpleMaterialCategory({ ...category, enabled: false, name: `${category.name}更新`, remark: '说明' })
  assert.equal(updated.logs.at(-1)?.action, '停用分类')
  assert.deepEqual(getSimpleMaterialCategoryUsage(category.id).map(item => item.id), ['root-test', 'root-legacy'], 'legacy categoryName still resolves after category rename')
  const before = values.get(PCS_SIMPLE_MATERIAL_CATEGORY_KEY)
  failWrite = true
  assert.throws(() => saveSimpleMaterialCategory({ ...updated, name: '未保存名称' }), /quota/)
  failWrite = false
  assert.equal(values.get(PCS_SIMPLE_MATERIAL_CATEGORY_KEY), before)
})

test('SIMPLE-025: actual box label, stable ID and historical aliases resolve owner SKU without crossing package types', () => {
  const type = listConfigDimensionOptions('packageTypes').find(item=>item.name_zh==='箱')!
  values.set('higood-pcs-material-archive-store-v2', JSON.stringify({ records: [{ materialId: 'root-pack', kind: 'consumable' }], skuRecords: [{ materialSkuId: 'sku-pack', materialId: 'root-pack', materialSkuCode: 'CS-PACK' }], packages: [
    { packageSpecId: 'pack-label', packageTypeId: '箱', ownerSkuId: 'sku-pack', contentQty: 10, contentUnitId: 'unit-PCS', status: 'ACTIVE' },
    { packageSpecId: 'pack-stable', packageTypeId: type.id, ownerSkuId: 'sku-pack', contentQty: 20, contentUnitId: 'PCS', status: 'ACTIVE' },
    { packageSpecId: 'pack-code', packageTypeId: type.code, ownerSkuId: 'sku-pack', contentQty: 5, contentUnitId: 'PCS', status: 'ACTIVE' },
    { packageSpecId: 'pack-alias', packageTypeId: '旧箱名', ownerSkuId: 'sku-pack', contentQty: 6, contentUnitId: 'PCS', status: 'ACTIVE' },
    { packageSpecId: 'pack-other', packageTypeId: '包', ownerSkuId: 'sku-pack', contentQty: 10, contentUnitId: 'PCS', status: 'ACTIVE' },
    { packageSpecId: 'pack-old', packageTypeId: type.id, ownerSkuId: 'sku-pack', contentQty: 8, contentUnitId: 'unit-PCS', status: 'INACTIVE' },
  ] }))
  let references = getConfigOptionUsage('packageTypes', type.id)
  assert.deepEqual(references.map(x=>x.id), ['pack-label','pack-stable','pack-code'])
  references.forEach(reference=>assert.match(reference.href!, /root-pack\/skus\/sku-pack$/))
  assert.match(references[0].label, /10 PCS/)
  saveConfigDimensionOption('packageTypes',type.id,{code:type.code,nameZh:'纸箱',nameEn:type.name_en,aliases:['旧箱名'],sortOrder:type.sortOrder,status:'DISABLED'})
  references = getConfigOptionUsage('packageTypes', type.id)
  assert.deepEqual(references.map(x=>x.id), ['pack-label','pack-stable','pack-code','pack-alias'], 'disabled renamed dictionary preserves actual box history')
  const other = listConfigDimensionOptions('packageTypes').find(x=>x.name_zh==='包')!
  assert.equal(getConfigOptionUsage('packageTypes',other.id).some(x=>x.id==='pack-label'),false)
  saveConfigDimensionOption('packageTypes',other.id,{code:other.code,nameZh:other.name_zh,nameEn:other.name_en,aliases:['箱'],sortOrder:other.sortOrder,status:'ENABLED'})
  assert.equal(getConfigOptionUsage('packageTypes',type.id).some(x=>x.id==='pack-label'),false,'ambiguous legacy label is not silently attributed')
  assert.equal(getConfigOptionUsage('packageTypes',other.id).some(x=>x.id==='pack-label'),false)
  assert.ok(getConfigOptionUsage('packageTypes',type.id).some(x=>x.id==='pack-stable'),'stable identity remains unambiguous')
})

test('SIMPLE-021/022/023: simple category list/detail/edit render independently; professional template tabs remain', async () => {
  resetPcsConfigWorkspaceState()
  await handlePcsConfigWorkspaceEvent(node({ pcsConfigWorkspaceAction: 'switch-dimension', dimensionId: 'templates' }))
  await handlePcsConfigWorkspaceEvent(node({ pcsConfigWorkspaceAction: 'kind', kind: 'consumable' }))
  const list = renderPcsConfigWorkspacePage()
  assert.match(list, /耗材分类/)
  assert.doesNotMatch(list, /当前版本|版本状态|根属性 \/ SKU 属性/)
  await handlePcsConfigWorkspaceEvent(node({ pcsConfigWorkspaceAction: 'create' }))
  assert.match(renderPcsConfigWorkspacePage(), /保存时自动生成/)
  assert.match(renderPcsConfigWorkspacePage(), /data-pcs-config-workspace-field="code"[^>]*readonly/)
  await handlePcsConfigWorkspaceEvent(node({ pcsConfigWorkspaceAction: 'back' }))
  await handlePcsConfigWorkspaceEvent(node({ pcsConfigWorkspaceAction: 'detail', id: listSimpleMaterialCategories('consumable')[0].id }))
  const detail = renderPcsConfigWorkspacePage()
  assert.doesNotMatch(detail, /主档与 SKU 属性|包装属性|工艺属性|版本换算依据|新建版本/)
  assert.match(detail, /simple-usage/)
  await handlePcsConfigWorkspaceEvent(node({ pcsConfigWorkspaceAction: 'edit' }))
  const edit = renderPcsConfigWorkspacePage()
  assert.match(edit, /data-pcs-config-workspace-field="remark"/)
  assert.doesNotMatch(edit, /保存草稿|模板名称|技术属性/)
  await handlePcsConfigWorkspaceEvent(node({ pcsConfigWorkspaceAction: 'back' }))
  await handlePcsConfigWorkspaceEvent(node({ pcsConfigWorkspaceAction: 'kind', kind: 'fabric' }))
  await handlePcsConfigWorkspaceEvent(node({ pcsConfigWorkspaceAction: 'detail', id: 'material-template-fabric-1', version: 2 }))
  assert.match(renderPcsConfigWorkspacePage(), /主档与 SKU 属性/)
})
