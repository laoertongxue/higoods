import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'
import { pcsRecordStore } from '../../src/data/pcs-record-runtime.ts'
import { listMaterialTemplates, resetMaterialConfigCache } from '../../src/data/pcs-material-config.ts'
import { getConfigOptionUsage, listConfigDimensionOptions } from '../../src/data/pcs-config-workspace-repository.ts'
import { renderPcsConfigWorkspacePage, handlePcsConfigWorkspaceEvent, handlePcsConfigWorkspaceInput, resetPcsConfigWorkspaceState } from '../../src/pages/pcs-config-workspace.ts'

const data = new Map<string, string>()
let writes = 0
Object.assign(pcsRecordStore, {
  getItem: (key: string) => data.get(key) ?? null,
  setItem: (key: string, value: string) => { writes++; data.set(key, value) },
})
const node = (dataset: Record<string, string>, value = ''): HTMLElement => {
  const element = { dataset, value, closest: () => element }
  return element as unknown as HTMLElement
}
const action = (value: string, dataset: Record<string, string> = {}) => handlePcsConfigWorkspaceEvent(node({ pcsConfigWorkspaceAction: value, ...dataset }))
beforeEach(() => { data.clear(); writes = 0; resetMaterialConfigCache(); resetPcsConfigWorkspaceState() })

test('ONE-CONFIG-001: template candidates only expose fabric/accessory/yarn; retired category storage is not read or written', async () => {
  data.set('higood-pcs-simple-material-categories-v1', '{broken historical data retained}')
  const before = new Map(data)
  await action('switch-dimension', { dimensionId: 'templates' })
  const html = renderPcsConfigWorkspacePage()
  for (const kind of ['fabric', 'accessory', 'yarn']) assert.match(html, new RegExp(`data-kind="${kind}"`))
  assert.doesNotMatch(html, /data-kind="(?:consumable|parts)"|simple-category-|耗材分类|配件分类/)
  assert.equal(writes, 0)
  assert.deepEqual(data, before)
})

test('ONE-CONFIG-002: forged simple kind/detail/template-kind cannot reopen retired category/template workflows', async () => {
  await action('switch-dimension', { dimensionId: 'templates' })
  for (const kind of ['consumable', 'parts']) {
    await action('kind', { kind })
    assert.match(renderPcsConfigWorkspacePage(), /仅面料、辅料、纱线维护分类与属性模板/)
    await action('detail', { id: `material-template-${kind}-1`, version: '3' })
    assert.match(renderPcsConfigWorkspacePage(), /模板版本不存在/)
    assert.doesNotMatch(renderPcsConfigWorkspacePage(), /分类操作日志|simple-usage|simple-logs/)
  }
  await action('create')
  for (const kind of ['consumable', 'parts']) assert.equal(handlePcsConfigWorkspaceInput(node({ pcsConfigWorkspaceField: 'template-kind' }, kind)), false)
  const edit = renderPcsConfigWorkspacePage()
  assert.doesNotMatch(edit, /<option value="(?:consumable|parts)"/)
  await action('back')
  await action('approve-template')
  assert.match(renderPcsConfigWorkspacePage(), /模板版本不存在/)
  assert.equal(writes, 0)
})

test('ONE-CONFIG-003: professional template detail, unit, packaging and encoding configuration remain available', async () => {
  await action('switch-dimension', { dimensionId: 'templates' })
  for (const kind of ['fabric', 'accessory', 'yarn']) {
    await action('kind', { kind })
    const template = listMaterialTemplates().find(item => item.kind === kind)!
    await action('detail', { id: template.templateId, version: String(template.version) })
    assert.match(renderPcsConfigWorkspacePage(), /主档与 SKU 属性|工艺属性/)
    await action('back')
  }
  for (const [dimensionId, expected] of [['units', '量纲'], ['fixedConversions', '0.9144'], ['packageTypes', '包装类型'], ['encoding', '编码规则']] as const) {
    await action('switch-dimension', { dimensionId })
    assert.match(renderPcsConfigWorkspacePage(), new RegExp(expected))
  }
  assert.equal(writes, 0)
})

test('ONE-CONFIG-004: simple material historical technical dictionary references are retired; active packaging references survive', () => {
  const composition = listConfigDimensionOptions('compositions')[0]
  const box = listConfigDimensionOptions('packageTypes').find(item => item.name_zh === '箱')!
  data.set('higood-pcs-material-archive-store-v2', JSON.stringify({ records: [
    { materialId: 'simple-root', kind: 'parts', materialCode: 'PART-01', materialName: '刀片', compositionItems: [{ component: composition.name_zh }], templateId: 'retired', templateVersion: 1 },
    { materialId: 'fabric-root', kind: 'fabric', materialCode: 'FB-01', materialName: '面料', compositionItems: [{ component: composition.name_zh }] },
  ], skuRecords: [{ materialSkuId: 'simple-sku', materialId: 'simple-root', materialSkuCode: 'PART-01-B01' }], packages: [{ packageSpecId: 'simple-pack', ownerSkuId: 'simple-sku', packageTypeId: box.id, contentQty: 20, contentUnitId: 'PCS', status: 'ACTIVE' }] }))
  const before = new Map(data)
  assert.deepEqual(getConfigOptionUsage('compositions', composition.id).filter(item => item.kind === '物料根属性').map(item => item.id), ['fabric-root'])
  assert.deepEqual(getConfigOptionUsage('packageTypes', box.id).map(item => item.id), ['simple-pack'])
  assert.deepEqual(data, before)
  assert.equal(writes, 0)
})
