import assert from 'node:assert/strict'

import {
  createMaterialArchive,
  createMaterialSkuRecord,
  getMaterialArchiveById,
  getMaterialSkuRecordById,
  listMaterialLogRecordsByMaterialId,
  updateMaterialUnitConversions,
} from '../src/data/pcs-material-archive-repository.ts'
import { currentUser } from '../src/pages/tech-pack/context.ts'
import {
  handlePcsMaterialArchiveDetailEvent,
  handlePcsMaterialArchiveDetailInput,
  renderPcsMaterialArchiveDetailPage,
  resetPcsMaterialArchiveDetailState,
} from '../src/pages/pcs-material-archive-detail.ts'

const material = createMaterialArchive({
  kind: 'fabric',
  materialName: `单位换算测试面料 ${Date.now()}`,
  materialNameEn: 'Unit conversion test fabric',
  categoryName: '测试面料',
  specSummary: '150cm',
  composition: '棉',
  processTags: [],
  widthText: '150cm',
  gramWeightText: '180g',
  pricingUnit: '码',
  mainUnit: '米',
  auxiliaryUnits: ['码', '卷'],
  unitConversions: [],
  mainImageUrl: '',
  barcodeTemplateCode: '',
  remark: '',
})
const sku = createMaterialSkuRecord(material.materialId, {
  colorName: '黑色',
  specName: '标准',
  sizeName: '标准',
  skuImageUrl: '',
  costPrice: 12.3456,
  freightCost: 0,
  weightKg: 0,
  lengthCm: 0,
  widthCm: 0,
  heightCm: 0,
  barcode: '',
})
assert.ok(sku)

const added = updateMaterialUnitConversions(
  material.materialId,
  [{ fromUnit: '米', toUnit: '码', factor: 1.0936 }],
  { id: 'U001', name: 'Budi Santoso' },
)
assert.deepEqual(added.unitConversions, [{ fromUnit: '米', toUnit: '码', factor: 1.0936 }], '应能新增米到码换算')
assert.deepEqual(
  getMaterialSkuRecordById(sku.materialSkuId)?.unitConversions,
  added.unitConversions,
  'SKU 应读取物料档案同一份换算事实',
)

const edited = updateMaterialUnitConversions(
  material.materialId,
  [{ fromUnit: '米', toUnit: '码', factor: 1.1 }],
  { id: 'U001', name: 'Budi Santoso' },
)
assert.equal(edited.unitConversions?.[0]?.factor, 1.1, '应能编辑换算系数')
assert.equal(getMaterialArchiveById(material.materialId)?.unitConversions?.[0]?.factor, 1.1, '刷新读取后应保留编辑结果')
assert.equal(
  listMaterialLogRecordsByMaterialId(material.materialId)[0]?.operatorName,
  'Budi Santoso',
  '单位换算日志必须记录真实当前买手姓名',
)

assert.throws(
  () => updateMaterialUnitConversions(
    material.materialId,
    [{ fromUnit: '米', toUnit: '码', factor: 1.2 }],
    { id: 'PATTERN-001', name: '版师B' },
  ),
  /只有买手可以维护单位换算/,
  '非买手直接调用仓储写入口也必须被拒绝',
)
assert.equal(getMaterialArchiveById(material.materialId)?.unitConversions?.[0]?.factor, 1.1, '越权写入不得污染原数据')

for (const [name, conversions, message] of [
  ['非正数系数', [{ fromUnit: '米', toUnit: '码', factor: 0 }], /换算系数必须大于 0/],
  ['相同单位', [{ fromUnit: '米', toUnit: '米', factor: 1 }], /来源单位和目标单位不能相同/],
  ['未维护单位', [{ fromUnit: '米', toUnit: '公斤', factor: 1 }], /只能选择该物料已维护的单位/],
  [
    '重复单位对',
    [
      { fromUnit: '米', toUnit: '码', factor: 1.1 },
      { fromUnit: '米', toUnit: '码', factor: 1.2 },
    ],
    /单位换算关系不能重复/,
  ],
] as const) {
  assert.throws(
    () => updateMaterialUnitConversions(material.materialId, conversions, { id: 'U001', name: 'Budi Santoso' }),
    message,
    `${name}必须阻断`,
  )
  assert.equal(getMaterialArchiveById(material.materialId)?.unitConversions?.[0]?.factor, 1.1, '非法保存不得污染原数据')
}

function actionTarget(action: string, dataset: Record<string, string> = {}): HTMLElement {
  const actionNode = { dataset: { pcsMaterialArchiveAction: action, ...dataset } }
  return {
    closest: (selector: string) => selector === '[data-pcs-material-archive-action]' ? actionNode : null,
  } as unknown as HTMLElement
}

function fieldTarget(field: string, value: string, conversionIndex: string): Element {
  const fieldNode = { dataset: { pcsMaterialUnitField: field, conversionIndex } }
  return {
    value,
    checked: false,
    closest: (selector: string) => selector === '[data-pcs-material-unit-field]' ? fieldNode : null,
  } as unknown as Element
}

resetPcsMaterialArchiveDetailState()
updateMaterialUnitConversions(material.materialId, [], { id: 'U001', name: 'Budi Santoso' })
let html = renderPcsMaterialArchiveDetailPage('fabric', material.materialId)
assert.match(html, /维护单位换算/, '物料详情必须提供可达的单位换算维护入口')
assert.match(html, /¥12\.3456/, '标准单价必须按人民币 4 位小数展示')

const originalCurrentUser = { ...currentUser }
currentUser.id = 'PATTERN-001'
currentUser.name = '版师B'
html = renderPcsMaterialArchiveDetailPage('fabric', material.materialId)
assert.doesNotMatch(html, /维护单位换算/, '非买手详情页不得展示单位换算维护入口')
assert.equal(
  handlePcsMaterialArchiveDetailEvent(actionTarget('open-unit-conversions', { materialId: material.materialId })),
  false,
  '非买手即使伪造页面动作也不能打开维护抽屉',
)
Object.assign(currentUser, originalCurrentUser)

assert.equal(handlePcsMaterialArchiveDetailEvent(actionTarget('open-unit-conversions', { materialId: material.materialId })), true)
html = renderPcsMaterialArchiveDetailPage('fabric', material.materialId)
assert.match(html, /单位换算/, '应打开单位换算维护抽屉')
assert.match(html, /米/, '抽屉应展示来源单位')
assert.match(html, /码/, '抽屉应展示目标单位')

assert.equal(handlePcsMaterialArchiveDetailInput(fieldTarget('fromUnit', '米', '0')), true)
assert.equal(handlePcsMaterialArchiveDetailInput(fieldTarget('toUnit', '码', '0')), true)
assert.equal(handlePcsMaterialArchiveDetailInput(fieldTarget('factor', '1.0936', '0')), true)
assert.equal(handlePcsMaterialArchiveDetailEvent(actionTarget('submit-unit-conversions')), true)
assert.deepEqual(
  getMaterialArchiveById(material.materialId)?.unitConversions,
  [{ fromUnit: '米', toUnit: '码', factor: 1.0936 }],
  '页面应新增米到码换算',
)

assert.equal(handlePcsMaterialArchiveDetailEvent(actionTarget('open-unit-conversions', { materialId: material.materialId })), true)
assert.equal(handlePcsMaterialArchiveDetailInput(fieldTarget('factor', '1.2', '0')), true)
assert.equal(handlePcsMaterialArchiveDetailEvent(actionTarget('submit-unit-conversions')), true)
assert.equal(getMaterialArchiveById(material.materialId)?.unitConversions?.[0]?.factor, 1.2, '页面保存应编辑换算系数')

assert.equal(handlePcsMaterialArchiveDetailEvent(actionTarget('open-unit-conversions', { materialId: material.materialId })), true)
assert.equal(handlePcsMaterialArchiveDetailEvent(actionTarget('delete-unit-conversion', { conversionIndex: '0' })), true)
assert.equal(handlePcsMaterialArchiveDetailEvent(actionTarget('submit-unit-conversions')), true)
assert.deepEqual(getMaterialArchiveById(material.materialId)?.unitConversions, [], '页面应支持删除换算关系')

const deleted = updateMaterialUnitConversions(material.materialId, [], { id: 'U001', name: 'Budi Santoso' })
assert.deepEqual(deleted.unitConversions, [], '仓储应支持删除全部换算关系')
assert.deepEqual(getMaterialSkuRecordById(sku.materialSkuId)?.unitConversions, [], '删除后 SKU 换算事实也应同步')

console.log('pcs-material-unit-conversions.spec.ts PASS')
