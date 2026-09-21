import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateWebbingRequirements, cloneWebbingSpecifications, collectWebbingPublishIssues, getWebbingPhysicalSpecificationKey,
  validateWebbingSpecifications, WEBBING_CUT_PROCESS, WEBBING_TIP_PROCESS,
  type WebbingSpecification,
} from '../../src/data/fcs/webbing-specifications.ts'
import { validateProcessRouteGraph, type ProcessRouteGraphEntry } from '../../src/data/tech-pack-process-route.ts'
import { cloneProductionOrderTechPackSnapshot } from '../../src/data/fcs/production-tech-pack-snapshot-builder.ts'
import { productionOrders, getProductionOrderTechPackSnapshot } from '../../src/data/fcs/production-orders.ts'

function specification(overrides: Partial<WebbingSpecification> = {}): WebbingSpecification {
  return {
    id: 'WB-50', bomItemId: 'BOM-WB', usage: '腰带', garmentSize: 'S', piecesPerGarment: 1,
    cutLengthMm: 500, finishedLengthMm: 500, lengthBasis: 'INCLUDING_ENDS', toleranceMm: 2,
    measurementCondition: '自然平放无拉伸', cuttingMethod: '冷切，切口整齐', acceptanceRequirement: '长度及外观符合确认样',
    tippingRequired: false, endA: { method: 'NONE', specification: '' }, endB: { method: 'NONE', specification: '' },
    ...overrides,
  }
}

function cut(specs: WebbingSpecification[]): ProcessRouteGraphEntry {
  return {
    id: 'CUT', stageCode: 'PREP', processCode: WEBBING_CUT_PROCESS, routeObjectKey: 'BOM:BOM-WB',
    linkedBomItemIds: ['BOM-WB'], inputObjectType: 'ACCESSORY', outputObjectType: 'ACCESSORY',
    inputMaterialSkuId: 'WB-BLUE-P01', outputMaterialSkuId: 'WB-BLUE-P01',
    inputInventoryForm: 'CONTINUOUS', outputInventoryForm: specs.some((spec) => spec.tippingRequired) ? 'CUT_PIECES' : 'FINISHED_PIECES',
    webbingSpecifications: specs, predecessorEntryIds: [],
  }
}

function tipped(): WebbingSpecification {
  return specification({
    id: 'ROPE-120', cutLengthMm: 1200, finishedLengthMm: 1210, tippingRequired: true,
    endA: { method: 'METAL', specification: '银色 M4，长20mm，拉脱力按确认样', materialBomItemId: 'BOM-M4', materialUnit: '个' },
    endB: { method: 'PLASTIC_WRAP', specification: '透明 P4，长20mm', materialBomItemId: 'BOM-P4', materialUnit: '个' },
  })
}

function tip(spec: WebbingSpecification): ProcessRouteGraphEntry {
  return { ...cut([spec]), id: 'TIP', processCode: WEBBING_TIP_PROCESS, inputInventoryForm: 'CUT_PIECES', outputInventoryForm: 'FINISHED_PIECES', predecessorEntryIds: ['CUT'] }
}

test('N01：400 条 50CM 和 600 条 70CM 分行计算，共 620 米；未增加 SKU', () => {
  const specs = [specification(), specification({ id: 'WB-70', garmentSize: 'M', cutLengthMm: 700, finishedLengthMm: 700 })]
  assert.deepEqual(calculateWebbingRequirements(specs, { S: 400, M: 600 }), [
    { specificationId: 'WB-50', requiredPieces: 400, requiredLengthMm: 200000, requiredMeters: 200 },
    { specificationId: 'WB-70', requiredPieces: 600, requiredLengthMm: 420000, requiredMeters: 420 },
  ])
  assert.deepEqual(validateProcessRouteGraph([cut(specs)], { requireComplete: true }), [])
  assert.notEqual(getWebbingPhysicalSpecificationKey(specs[0]), getWebbingPhysicalSpecificationKey(specs[1]))
})

test('缺少尺码数量、非整数条数、公差或测量条件时不猜测需求', () => {
  assert.throws(() => calculateWebbingRequirements([specification()], {}), /生产件数/)
  for (const invalid of [specification({ piecesPerGarment: 1.5 }), specification({ cutLengthMm: NaN }), specification({ toleranceMm: -1 }), specification({ measurementCondition: '' })]) {
    assert.ok(validateWebbingSpecifications([invalid]).length)
  }
  assert.ok(validateWebbingSpecifications([specification(), specification({ id: 'another' })]).some((issue) => issue.field === 'usage'))
  assert.ok(validateWebbingSpecifications([specification()], ['BOM-OTHER']).length)
})

test('B07：未选择打头、缺少端头方式或辅材不能确认；支持两端不同端头', () => {
  for (const invalid of [specification({ tippingRequired: null }), specification({ tippingRequired: true }), { ...tipped(), endA: { method: 'METAL' as const, specification: '' } }]) {
    assert.ok(validateWebbingSpecifications([invalid]).length)
  }
  const spec = tipped()
  assert.deepEqual(validateWebbingSpecifications([spec]), [])
  assert.deepEqual(validateProcessRouteGraph([cut([spec]), tip(spec)], { requireComplete: true }), [])
})

test('N04/B08：硅胶按重量且必须有覆盖长度，不作为独立金属头计数', () => {
  const spec = specification({ tippingRequired: true, endA: { method: 'SILICONE_DIP', specification: '黑色，均匀覆盖', coverageMm: 20, materialBomItemId: 'BOM-SIL', materialUnit: 'kg' } })
  assert.deepEqual(validateWebbingSpecifications([spec]), [])
  spec.endA.materialUnit = '个'
  assert.ok(validateWebbingSpecifications([spec]).some((issue) => issue.message.includes('重量')))
  spec.endA.materialUnit = 'kg'
  delete spec.endA.coverageMm
  assert.ok(validateWebbingSpecifications([spec]).some((issue) => issue.message.includes('覆盖长度')))
})

test('B18：打头只能承接对应截断条料，不能换 SKU、换长度或重新领连续料', () => {
  const spec = tipped()
  const cutting = cut([spec])
  for (const wrong of [
    { ...tip(spec), outputMaterialSkuId: 'NEW-TIPPED-SKU' },
    { ...tip(spec), inputInventoryForm: 'CONTINUOUS' as const },
    { ...tip(spec), predecessorEntryIds: [] },
    tip({ ...spec, cutLengthMm: 1300 }),
  ]) assert.ok(validateProcessRouteGraph([cutting, wrong], { requireComplete: true }).length)
  assert.ok(validateProcessRouteGraph([cutting], { requireComplete: true }).some((issue) => issue.code === 'WEBBING_PREDECESSOR_INVALID'))
  assert.ok(validateProcessRouteGraph([cutting, tip(spec), { ...tip(spec), id: 'TIP-DUP' }], { requireComplete: true }).length)
})

test('N05：规格相同可以合并，但尺码、用途和需求身份不靠物理规格键代替', () => {
  const first = specification()
  const second = specification({ id: 'OTHER-PO', usage: '装饰带', garmentSize: 'L' })
  assert.equal(getWebbingPhysicalSpecificationKey(first), getWebbingPhysicalSpecificationKey(second))
  assert.equal(calculateWebbingRequirements([first, second], { S: 100, L: 100 }).length, 2)
  assert.notEqual(getWebbingPhysicalSpecificationKey(tipped()), getWebbingPhysicalSpecificationKey(first))
})

test('B14：修改后续版本端头要求不能污染生产单历史快照', () => {
  const specs = [tipped()]
  const clone = cloneWebbingSpecifications(specs)!
  clone[0].endA.specification = '新端头'
  assert.notEqual(clone[0].endA.specification, specs[0].endA.specification)
  const snapshot = productionOrders.map((order) => getProductionOrderTechPackSnapshot(order.productionOrderId)).find(Boolean)!
  assert.ok(snapshot)
  snapshot.processEntries[0].webbingSpecifications = specs
  const frozen = cloneProductionOrderTechPackSnapshot(snapshot)
  specs[0].cutLengthMm = 999
  specs[0].endA.specification = '已改'
  assert.equal(frozen.processEntries[0].webbingSpecifications![0].cutLengthMm, 1200)
  assert.notEqual(frozen.processEntries[0].webbingSpecifications![0].endA.specification, '已改')
})

test('发布门禁：含织带截断工序的技术包必须规格完整且规格仍关联当前 BOM', () => {
  const spec = specification()
  assert.deepEqual(collectWebbingPublishIssues([cut([spec])], ['BOM-WB']), [])
  assert.ok(collectWebbingPublishIssues([{ processCode: WEBBING_CUT_PROCESS, linkedBomItemIds: ['BOM-WB'], webbingSpecifications: [] }], ['BOM-WB']).some((issue) => issue.includes('加工规格')))
  assert.ok(collectWebbingPublishIssues([cut([spec])], ['BOM-OTHER']).some((issue) => issue.includes('BOM 已不存在')))
  const missingMethod = { ...spec, tippingRequired: true, endA: { method: 'NONE' as const, specification: '' }, endB: { method: 'NONE' as const, specification: '' } }
  assert.ok(collectWebbingPublishIssues([cut([missingMethod])], ['BOM-WB']).some((issue) => issue.includes('打头方式')))
  assert.deepEqual(collectWebbingPublishIssues([{ processCode: 'DYE' }], []), [])
})
