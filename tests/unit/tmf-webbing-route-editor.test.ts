import assert from 'node:assert/strict'
import test from 'node:test'
import { applyWebbingRouteSpecifications } from '../../src/pages/tech-pack/webbing-route-editor.ts'
import type { TechniqueItem } from '../../src/pages/tech-pack/context.ts'
import { validateProcessRouteGraph } from '../../src/data/tech-pack-process-route.ts'
import type { WebbingSpecification } from '../../src/data/fcs/webbing-specifications.ts'

const bom = { id: 'WB-BOM', type: '辅料' as const, materialSkuId: 'WB-WHT', materialCode: 'WB-WHT', materialName: '白织带' }
const specification: WebbingSpecification = { id: 'S-50', bomItemId: bom.id, usage: '腰带', garmentSize: 'S', piecesPerGarment: 1,
  cutLengthMm: 500, finishedLengthMm: 500, lengthBasis: 'EXCLUDING_ENDS', toleranceMm: 2, measurementCondition: '自然平放',
  cuttingMethod: '冷切', acceptanceRequirement: '按确认样', tippingRequired: false,
  endA: { method: 'NONE', specification: '' }, endB: { method: 'NONE', specification: '' } }

test('编辑器按尺码保留规格，截断打头不新建SKU，重复保存沿用节点身份', () => {
  const second = { ...structuredClone(specification), id: 'M-70', garmentSize: 'M', cutLengthMm: 700, finishedLengthMm: 700, tippingRequired: true,
    endA: { method: 'METAL' as const, specification: 'M4银色金属头', materialBomItemId: 'HEAD-BOM', materialUnit: '个' as const } }
  const result = applyWebbingRouteSpecifications([], bom, [specification, second], '')
  assert.equal(result.length, 2)
  assert.equal(result[0].webbingSpecifications!.length, 2)
  assert.equal(result[1].webbingSpecifications!.length, 1)
  assert.equal(result[1].webbingSpecifications![0].garmentSize, 'M')
  assert.deepEqual(result[1].predecessorEntryIds, [result[0].id])
  assert.deepEqual(result[1].consumedBomItemIds, ['HEAD-BOM'])
  for (const item of result) {
    assert.equal(item.inputMaterialSkuId, 'WB-WHT')
    assert.equal(item.outputMaterialSkuId, 'WB-WHT')
    assert.equal(item.isSpecialCraft, false)
  }
  assert.deepEqual(validateProcessRouteGraph(result, { requireComplete: true }), [])
  assert.deepEqual(applyWebbingRouteSpecifications(result, bom, [specification, second], ''), result)
  second.endA.specification = '修改原始对象'
  assert.equal(result[1].webbingSpecifications![0].endA.specification, 'M4银色金属头')
})

test('无印染要求时 TMF 路线只生成截断节点，不凭空生成染色或印花节点', () => {
  const result = applyWebbingRouteSpecifications([], bom, [specification], '')
  assert.deepEqual(result.map((item) => item.processCode), ['WEBBING_CUT'])
  assert.equal(result.some((item) => item.processCode === 'DYE' || item.processCode === 'PRINT'), false)
  assert.equal(result[0].inputMaterialSkuId, bom.materialSkuId)
  assert.equal(result[0].outputMaterialSkuId, bom.materialSkuId)
  assert.deepEqual(validateProcessRouteGraph(result, { requireComplete: true }), [])
})

test('前序印染产出SKU作为截断投入；保留独立橡筋工艺，移除打头后下游连接截断', () => {
  const base = applyWebbingRouteSpecifications([], bom, [specification], '')[0]
  const dye: TechniqueItem = { ...base, id: 'DYE-1', processCode: 'DYE', process: '染色', inputMaterialSkuId: 'WB-WHT', outputMaterialSkuId: 'WB-BLUE', outputMaterialSkuCode: 'WB-BLUE', predecessorEntryIds: [], webbingSpecifications: undefined, inputInventoryForm: 'CONTINUOUS', outputInventoryForm: 'CONTINUOUS' }
  const elastic: TechniqueItem = { ...base, id: 'ELASTIC-SPF', stageCode: 'PROD', processCode: 'SPECIAL', craftCode: 'CRAFT_3000009', linkedBomItemIds: ['ELASTIC-BOM'], routeObjectKey: 'BOM:ELASTIC-BOM', webbingSpecifications: undefined }
  const tipped = { ...structuredClone(specification), tippingRequired: true, endA: { method: 'PLASTIC_WRAP' as const, specification: '透明包头20mm', materialBomItemId: 'PLASTIC', materialUnit: '个' as const } }
  assert.throws(() => applyWebbingRouteSpecifications([dye, elastic], bom, [tipped], ''), /不能跳过印染/)
  let result = applyWebbingRouteSpecifications([dye, elastic], bom, [tipped], dye.id)
  const cut = result.find((item) => item.processCode === 'WEBBING_CUT')!
  const tip = result.find((item) => item.processCode === 'WEBBING_TIP')!
  assert.equal(cut.inputMaterialSkuId, 'WB-BLUE')
  assert.equal(cut.outputMaterialSkuId, 'WB-BLUE')
  assert.deepEqual(cut.predecessorEntryIds, [dye.id])
  assert.deepEqual(result.find((item) => item.id === elastic.id), elastic)
  const downstream: TechniqueItem = { ...base, id: 'SEW', stageCode: 'PROD', processCode: 'SEW', predecessorEntryIds: [tip.id] }
  result = applyWebbingRouteSpecifications([...result, downstream], bom, [specification], dye.id)
  assert.equal(result.some((item) => item.id === tip.id), false)
  assert.deepEqual(result.find((item) => item.id === downstream.id)!.predecessorEntryIds, [cut.id])
})

test('未明确打头、错误辅料BOM、无半成品和不合法前序不能生成可执行路线', () => {
  assert.throws(() => applyWebbingRouteSpecifications([], bom, [{ ...specification, tippingRequired: null }], ''), /明确选择/)
  assert.throws(() => applyWebbingRouteSpecifications([], bom, [{ ...specification, bomItemId: 'OTHER' }], ''), /属于当前工艺/)
  assert.throws(() => applyWebbingRouteSpecifications([], { ...bom, materialSkuId: '' }, [specification], ''), /半成品 SKU/)
  assert.throws(() => applyWebbingRouteSpecifications([], bom, [specification], 'MISSING'), /前序必须/)
  assert.throws(() => applyWebbingRouteSpecifications([], bom, [specification, { ...specification, id: 'DUPLICATE' }], ''), /重复定义/)
})
