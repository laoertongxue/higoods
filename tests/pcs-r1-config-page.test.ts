import assert from 'node:assert/strict'
import { test, mock } from 'node:test'
import { decodePcsRecordSnapshot } from '../src/data/pcs-record-codec.ts'

test('configuration page lists, version metadata and equipment-model command boundaries', async t => {
  const runtime = await import('../src/data/pcs-record-runtime.ts')
  let failCommand = false, gate: Promise<void> | undefined, complete: (() => void) | undefined
  // Page contract only. Record atomicity/failure is separately covered by pcs-r1-storage tests.
  mock.module(new URL('../src/data/pcs-record-runtime.ts', import.meta.url).href, { namedExports: {
    ...runtime,
    runPcsRecordCommand: async (recipe: () => unknown) => { if (failCommand) throw new Error('保存失败，请重试。'); if (gate) await gate; return recipe() },
  } })
  const page = await import('../src/pages/pcs-config-workspace.ts')
  const config = await import('../src/data/pcs-material-config.ts')
  const options = await import('../src/data/pcs-config-workspace-repository.ts')
  const act = async (action: string, data: Record<string, string> = {}, checked?: boolean) => {
    const node = { dataset: { pcsConfigWorkspaceAction: action, ...data }, checked, closest() { return this } }
    assert.equal(await page.handlePcsConfigWorkspaceEvent(node as unknown as HTMLElement), true)
  }
  const input = (key: string, value: string, checked = false) => {
    const node = { dataset: { pcsConfigWorkspaceField: key }, value, checked, type: checked ? 'checkbox' : 'text', closest() { return this } }
    assert.equal(page.handlePcsConfigWorkspaceInput(node as unknown as Element), true)
  }
  const render = () => page.renderPcsConfigWorkspacePage()
  const section = async (dimensionId: string) => { page.resetPcsConfigWorkspaceState(); await act('switch-dimension', { dimensionId }); return render() }

  await t.test('standard list applies pagination, sorting, visibility, freezing, reset and whole-result CSV export', async () => {
    let html = await section('categoryNumbers')
    assert.match(html, /data-standard-list-page/); assert.match(html, /data-standard-list-stats/)
    assert.match(html, /data-pcs-config-workspace-field="pageSize"/)
    const count = options.listConfigDimensionOptions('categoryNumbers').length
    assert.ok(count > 20)
    assert.match(html, new RegExp(`共 ${count} 条，当前 1-20`))
    await act('next-page'); html = render(); assert.match(html, /当前 21-40/)
    input('pageSize', '50'); html = render(); assert.match(html, /当前 1-50/)
    await act('sort-column', { columnKey: 'column-2' }); assert.match(render(), /data-standard-list-sort-icon="asc"/)
    await act('open-column-settings'); assert.match(render(), /data-standard-list-column-drag/)
    await act('toggle-column-visibility', { pcsConfigWorkspaceColumnKey: 'column-2' }, false)
    await act('toggle-column-freeze', { pcsConfigWorkspaceColumnKey: 'column-0' }, true)
    await act('close-column-settings'); html = render()
    assert.doesNotMatch(html, /data-column-key="column-2"/)
    assert.match(html, /sticky left-0/)
    input('search', '没有此配置'); await act('query'); assert.match(render(), /共 0 条/)
    await act('export-list'); assert.match(render(), /当前查询没有可导出/)
    await act('reset-query'); assert.match(render(), new RegExp(`共 ${count} 条`))
    let exported: Blob | undefined, clicked = false
    const urlMock = mock.method(URL, 'createObjectURL', (blob: Blob) => { exported = blob; return 'blob:config-csv-test' })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { getElementById: () => null, createElement: () => ({ click: () => { clicked = true } }) } })
    try { await act('export-list'); assert.equal(clicked, true); const csv = await exported!.text(); assert.equal(csv.split('\r\n').length, count + 1); assert.doesNotMatch(csv.split('\r\n')[0], /操作/); assert.match(csv, /"89"/) }
    finally { delete (globalThis as any).document; urlMock.mock.restore() }
  })

  await t.test('template detail and draft save preserve button conditions, zero minimum, shape and version conversions', async () => {
    await section('templates')
    const button = config.getMaterialTemplate('accessory', '纽扣')
    await act('detail', { id: button.templateId, version: String(button.version) })
    assert.match(render(), /分类业务编码/); assert.match(render(), /分类稳定标识/)
    assert.ok(button.categoryId); assert.ok(button.categoryCode)
    await act('tab', { tab: 'fields' })
    assert.match(render(), /孔式纽扣必填/); assert.match(render(), /最小值 0/); assert.match(render(), /整数/)
    await act('edit'); input('template-changeNote', '保留条件与零值约束'); await act('tab', { tab: 'fields' })
    await act('edit-field', { index: String(button.fields.findIndex(f => f.key === 'holeCount')) })
    assert.match(render(), /value="button-hole" selected/); assert.match(render(), /data-pcs-config-workspace-field="field-integer" checked/)
    input('field-minimum', '0'); input('field-integer', '', true); await act('close-field'); await act('save')
    const savedButton = config.listMaterialTemplates().find(row => row.templateId === button.templateId && row.version === button.version + 1)!
    assert.equal(savedButton.categoryId, button.categoryId); assert.equal(savedButton.categoryCode, button.categoryCode)
    assert.equal(savedButton.fields.find(f => f.key === 'holeCount')!.minimum, 0)
    assert.equal(savedButton.fields.find(f => f.key === 'holeCount')!.requiredWhen, 'button-hole')
    assert.equal(savedButton.fields.find(f => f.key === 'holeCount')!.integer, true)
    const part = config.getMaterialTemplate('parts', '裁床配件')
    await act('detail', { id: part.templateId, version: String(part.version) }); await act('tab', { tab: 'fields' })
    assert.match(render(), /适配设备（类型、型号）/); assert.match(render(), /多项尺寸（名称、数值、单位）/)
    await act('edit'); input('template-changeNote', '保留结构化字段'); await act('tab', { tab: 'fields' })
    await act('edit-field', { index: String(part.fields.findIndex(f => f.key === 'equipment')) })
    assert.match(render(), /value="equipmentCompatibility" selected/)
    input('field-valueShape', 'equipmentCompatibility'); await act('close-field'); await act('save')
    assert.equal(config.listMaterialTemplates().find(row => row.templateId === part.templateId && row.version === part.version + 1)!.fields.find(f => f.key === 'equipment')!.valueShape, 'equipmentCompatibility')
    const bag = config.getMaterialTemplateByVersion(config.getMaterialTemplate('consumable', '包装袋').templateId,2)
    await act('detail', { id: bag.templateId, version: String(bag.version) }); await act('tab', { tab: 'conversions' })
    assert.match(render(), /读取和普通保存不会执行换算/); assert.match(render(), /1000/); assert.match(render(), /μm/)
    await act('edit'); input('template-changeNote', '保留包装单位升级依据'); await act('tab', { tab: 'conversions' })
    input('conversion-0-factor', '0'); await act('save'); assert.match(render(), /大于 0 的系数/)
    assert.equal(config.listMaterialTemplates().filter(row => row.templateId === bag.templateId).length, 3)
    input('conversion-0-factor', '10'); await act('save')
    assert.deepEqual(config.listMaterialTemplates().find(row => row.templateId === bag.templateId && row.version === 4)!.previousVersionConversions, [])
    assert.deepEqual(config.getMaterialTemplateByVersion(bag.templateId, 2).previousVersionConversions, bag.previousVersionConversions)
    assert.equal(config.getMaterialTemplateByVersion(bag.templateId, 1).fields.find(f => f.key === 'length')!.unit, 'cm')
  })

  await t.test('controlled material attribute dictionaries have distinct navigable maintenance lists', async () => {
    for (const [id, label] of [['materialConstructions', '结构材质'], ['materialStructures', '结构款式'], ['zipperTeeth', '拉链齿型'], ['zipperOpenings', '拉链开合'], ['zipperGauges', '拉链规格号'], ['yarnUses', '纱线用途']] as const) {
      const html = await section(id)
      assert.match(html, new RegExp(`data-dimension-id="${id}"`)); assert.match(html, new RegExp(label)); assert.match(html, /data-standard-list-page/)
      assert.ok(options.listConfigDimensionOptions(id).length > 0)
      assert.match(html, /data-pcs-config-workspace-action="create"/)
    }
  })

  await t.test('template tabs maintain package and process bindings, stable unit references and category languages', async () => {
    await section('templates')
    const template = config.getMaterialTemplate('accessory', '拉链')
    await act('detail', { id: template.templateId, version: String(template.version) })
    for (const label of ['主档与 SKU 属性', '包装属性', '工艺属性', '分类多语名称']) assert.match(render(), new RegExp(label))
    await act('tab', { tab: 'fields' }); assert.match(render(), /zipperGauges/); assert.doesNotMatch(render(), /package\.grossWeightKg/)
    await act('tab', { tab: 'package-fields' }); assert.match(render(), /package\.grossWeightKg/); assert.doesNotMatch(render(), /process\.inputSkuId/)
    await act('edit'); await act('tab', { tab: 'package-fields' })
    await act('edit-field', { index: String(template.fields.findIndex(f => f.modelBinding === 'package.grossWeightKg')) })
    assert.match(render(), /字段绑定/); assert.match(render(), /单位稳定引用/)
    input('field-label', '已核定包装毛重'); input('field-help', '按本模板包装要求确认'); await act('close-field')
    await act('tab', { tab: 'process-fields' }); assert.match(render(), /process\.inputSkuId/)
    await act('edit-field', { index: String(template.fields.findIndex(f => f.modelBinding === 'process.deliveryRevisionSegment')) })
    input('field-help', '采用确认的交付版本'); await act('close-field')
    await act('tab', { tab: 'fields' }); await act('edit-field', { index: String(template.fields.findIndex(f => f.key === 'length')) })
    assert.match(render(), /data-pcs-config-workspace-field="field-unitId"/); assert.match(render(), /unit-cm/)
    input('field-unitId', 'unit-cm'); await act('close-field')
    await act('tab', { tab: 'languages' }); await act('add-category-language')
    input('language-1-language', 'en'); input('language-1-name', 'Zipper'); input('language-1-aliases', 'Zip fastener，Zip')
    input('template-changeNote', '完善包装说明与多语名称'); await act('save')
    const saved = config.getMaterialTemplateByVersion(template.templateId, template.version + 1)
    assert.equal(saved.fields.find(f => f.modelBinding === 'package.grossWeightKg')!.label, '已核定包装毛重')
    assert.equal(saved.fields.find(f => f.modelBinding === 'process.deliveryRevisionSegment')!.help, '采用确认的交付版本')
    assert.equal(saved.fields.find(f => f.key === 'length')!.unitId, 'unit-cm')
    assert.equal(saved.categoryNames!.en, 'Zipper'); assert.deepEqual(saved.categoryAliases!.en, ['Zip fastener', 'Zip'])
    await act('tab', { tab: 'languages' }); assert.match(render(), /Zip fastener/)
    assert.equal(config.getMaterialTemplateByVersion(template.templateId, template.version).categoryNames!.en, undefined)
  })

  await t.test('equipment type opens model list, failed save retains input, awaited save creates own ID and edit toggles same model', async () => {
    await section('equipmentTypes')
    const type = options.listConfigDimensionOptions('equipmentTypes').find(row => row.status === 'ENABLED')!
    await act('detail', { id: type.id }); await act('tab', { tab: 'models' }); assert.match(render(), /设备型号/)
    const before = config.listMaterialEquipmentModels(type.id).length
    await act('model-create'); input('model-code', 'MODEL-PAGE-R1'); input('model-name', '配置页测试型号')
    failCommand = true; await act('model-save'); failCommand = false
    assert.match(render(), /保存失败/); assert.match(render(), /value="MODEL-PAGE-R1"/); assert.equal(config.listMaterialEquipmentModels(type.id).length, before)
    gate = new Promise(resolve => { complete = resolve }); const saving = act('model-save'); await new Promise(resolve => setImmediate(resolve))
    assert.match(render(), /正在保存/); assert.equal(config.listMaterialEquipmentModels(type.id).length, before)
    complete!(); await saving; gate = undefined
    const saved = config.listMaterialEquipmentModels(type.id).find(row => row.code === 'MODEL-PAGE-R1')!
    assert.match(saved.id, /^equipment-model-/); assert.equal(saved.equipmentTypeId, type.id); assert.equal(saved.enabled, true)
    assert.match(render(), /data-equipment-model-view="detail"/)
    await act('model-edit'); input('model-code', 'CHANGED-IDENTITY'); input('model-name', '配置页型号修订'); input('model-enabled', 'false'); await act('model-save')
    const disabled = config.listMaterialEquipmentModels(type.id).find(row => row.id === saved.id)!
    assert.equal(disabled.code, 'MODEL-PAGE-R1'); assert.equal(disabled.name, '配置页型号修订'); assert.equal(disabled.enabled, false)
    assert.equal(config.listMaterialEquipmentModels(type.id).length, before + 1)
    await act('model-back'); assert.match(render(), /配置页型号修订/)
    config.resetMaterialConfigCache(); assert.equal(config.listMaterialEquipmentModels(type.id).find(row => row.id === saved.id)!.enabled, false)
    const other = options.listConfigDimensionOptions('equipmentTypes').find(row => row.status === 'ENABLED' && row.id !== type.id)!
    assert.throws(() => config.saveMaterialEquipmentModel({ ...saved, equipmentTypeId: other.id }, '测试'), /不能更改/)
    assert.throws(() => config.saveMaterialEquipmentModel({ ...saved, id: '' }, '测试'), /不能重复/)
    const another = config.saveMaterialEquipmentModel({ ...saved, id: '', equipmentTypeId: other.id }, '测试')
    const records = decodePcsRecordSnapshot(config.PCS_MATERIAL_CONFIG_KEY, JSON.stringify(config.getMaterialConfigSnapshot()))
    assert.ok(records.some(row => row.id === `${config.PCS_MATERIAL_CONFIG_KEY}/equipmentModels/${saved.id}`))
    assert.ok(records.some(row => row.id === `${config.PCS_MATERIAL_CONFIG_KEY}/equipmentModels/${another.id}`))
    assert.ok(!JSON.stringify(records.find(row => row.id.endsWith('/meta'))!.value).includes('MODEL-PAGE-R1'), 'model bodies are individual records, never embedded in collection metadata')
  })

  await t.test('unavailable preference storage does not block configuration lists', async () => {
    const unavailable = Object.assign(new EventTarget(), { confirm: () => true })
    Object.defineProperty(unavailable, 'localStorage', { get: () => { throw new Error('preference access denied') } })
    Object.defineProperty(globalThis, 'window', { configurable: true, value: unavailable })
    try {
      let html = await section('equipmentTypes'); assert.match(html, /data-standard-list-page/); assert.doesNotMatch(html, /基础配置暂时无法读取/)
      input('pageSize', '50'); html = render(); assert.match(html, /value="50" selected/)
    } finally { delete (globalThis as any).window }
  })

  await t.test('column drag order and page size persist as bounded preferences without business writes', async () => {
    const preferences = new Map<string, string>(), handlers = new Map<string, (event: any) => void>()
    class NodeDouble { constructor(public dataset: Record<string, string>) {} closest() { return this } }
    const originalElement = (globalThis as any).Element
    Object.defineProperty(globalThis, 'Element', { configurable: true, value: NodeDouble })
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { getElementById: () => null, addEventListener: (name: string, fn: (event: any) => void) => handlers.set(name, fn) } })
    Object.defineProperty(globalThis, 'window', { configurable: true, value: Object.assign(new EventTarget(), { localStorage: { getItem: (key: string) => preferences.get(key) ?? null, setItem: (key: string, value: string) => preferences.set(key, value) } }) })
    const originalSet = runtime.pcsRecordStore.setItem, businessWrites: string[] = []
    runtime.pcsRecordStore.setItem = key => { businessWrites.push(key); throw new Error('read-only list must not write business data') }
    try {
      await section('categoryNumbers'); await act('open-column-settings')
      handlers.get('dragstart')!({ target: new NodeDouble({ dragSource: 'column-2' }), stopPropagation() {}, dataTransfer: { setData() {} } })
      handlers.get('drop')!({ target: new NodeDouble({ dropTarget: 'column-1' }), preventDefault() {}, stopPropagation() {} })
      input('pageSize', '50'); await act('close-column-settings'); page.resetPcsConfigWorkspaceState()
      await act('switch-dimension', { dimensionId: 'categoryNumbers' }); const html = render()
      assert.ok(html.indexOf('data-column-key="column-2"') < html.indexOf('data-column-key="column-1"'))
      assert.match(html, /value="50" selected/)
      assert.equal(businessWrites.length, 0)
      assert.equal(preferences.size, 1)
      assert.ok([...preferences.values()].every(raw => raw.length <= 4096))
    } finally {
      runtime.pcsRecordStore.setItem = originalSet
      delete (globalThis as any).window; delete (globalThis as any).document
      if (originalElement) Object.defineProperty(globalThis, 'Element', { configurable: true, value: originalElement }); else delete (globalThis as any).Element
    }
  })
  mock.restoreAll()
})
