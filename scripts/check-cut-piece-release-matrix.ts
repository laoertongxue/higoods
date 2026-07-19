import assert from 'node:assert/strict'

import { buildReleaseMatrix, type CutPieceFact, type CutPieceRequirement } from '../src/data/fcs/cut-piece-release-domain'

const productionOrderId = 'po-14671'

const requirements: CutPieceRequirement[] = [
  { materialId: 'A', materialName: '面料 A', partId: 'front', partName: '前片', piecesPerGarment: 1 },
  { materialId: 'A', materialName: '面料 A', partId: 'back', partName: '后片', piecesPerGarment: 1 },
  { materialId: 'B', materialName: '里料 B', partId: 'body', partName: '衣身', piecesPerGarment: 1 },
  { materialId: 'C', materialName: '辅料 C', partId: 'collar', partName: '领片', piecesPerGarment: 1 },
  { materialId: 'D', materialName: '辅料 D', partId: 'cuff', partName: '袖口', piecesPerGarment: 1 },
]

function fact(overrides: Partial<CutPieceFact> & Pick<CutPieceFact, 'factId' | 'sourceEventId' | 'materialId' | 'partId' | 'actualPieceQty'>): CutPieceFact {
  return {
    productionOrderId,
    cutOrderId: 'cut-14671',
    cutOrderNo: 'CUT14671',
    spreadingOrderNo: 'ASYSA26060310',
    garmentColor: 'Black',
    size: 'M',
    direction: '正向',
    sourceStatus: '持续更新',
    occurredAt: '2026-06-03T10:00:00.000Z',
    ...overrides,
  }
}

const blackFacts: CutPieceFact[] = [
  fact({ factId: 'fact-a-front', sourceEventId: 'event-a-front', materialId: 'A', partId: 'front', actualPieceQty: 220 }),
  fact({ factId: 'fact-a-back', sourceEventId: 'event-a-back', materialId: 'A', partId: 'back', actualPieceQty: 220 }),
  fact({ factId: 'fact-b', sourceEventId: 'event-b', materialId: 'B', partId: 'body', actualPieceQty: 200 }),
  fact({ factId: 'fact-c', sourceEventId: 'event-c', materialId: 'C', partId: 'collar', actualPieceQty: 208 }),
  fact({ factId: 'fact-d', sourceEventId: 'event-d', materialId: 'D', partId: 'cuff', actualPieceQty: 200 }),
]

const matrix = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { M: 240 } },
  requirements,
  facts: [...blackFacts, { ...blackFacts[0], factId: 'fact-a-front-replayed' }],
})

const black = matrix.colorGroups[0]
assert.equal(black.garmentColor, 'Black')
assert.deepEqual(black.sizes, ['M'])
assert.equal(black.planQtyBySize.M, 240, '计划数量只用于投影展示')
assert.deepEqual(
  black.materialRows.map((row) => row.cells[0].availableGarmentQty),
  [220, 200, 208, 200],
  'Black/M 各物料可做数量必须稳定，且重复事件不能重复累计',
)
assert.equal(black.materialRows[0].cells[0].partCalculations[0].availableGarmentQty, 220)
assert.equal(black.materialRows[0].cells[0].partCalculations[1].availableGarmentQty, 220)
assert.equal(black.completeKitBySize.M, 200, '当前齐套必须取所有必需物料的最小值')

const reversed = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { M: 240 } },
  requirements,
  facts: [
    ...blackFacts,
    fact({ factId: 'reverse-a-back', sourceEventId: 'reverse-a-back', materialId: 'A', partId: 'back', actualPieceQty: 30, direction: '反向' }),
  ],
})
assert.equal(reversed.colorGroups[0].materialRows[0].cells[0].availableGarmentQty, 190, '同一物料可做数量必须取前片和后片瓶颈')
assert.equal(reversed.colorGroups[0].completeKitBySize.M, 190, '部位瓶颈必须传递到当前齐套')

const missingRequirement = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { M: 240 } },
  requirements: [...requirements, { materialId: 'E', materialName: '缺失配置', partId: 'zipper', partName: '拉链', piecesPerGarment: 0 }],
  facts: blackFacts,
})
assert.equal(missingRequirement.colorGroups[0].materialRows.at(-1)?.cells[0].calculationStatus, '数据不完整')

const noFacts = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { M: 240 } },
  requirements,
  facts: [],
})
assert.equal(noFacts.colorGroups[0].materialRows[0].cells[0].calculationStatus, '暂无有效裁片')
assert.equal(noFacts.calculationStatus, '暂无有效裁片')

const sourceEventCompositeKey = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { M: 240 } },
  requirements,
  facts: [
    fact({ factId: 'same-event-a', sourceEventId: 'same-event', materialId: 'A', partId: 'front', actualPieceQty: 220 }),
    fact({ factId: 'same-event-a-replay', sourceEventId: 'same-event', materialId: 'A', partId: 'front', actualPieceQty: 220 }),
    fact({ factId: 'same-event-b', sourceEventId: 'same-event', materialId: 'B', partId: 'body', actualPieceQty: 200 }),
    fact({ factId: 'same-event-c', sourceEventId: 'same-event', materialId: 'C', partId: 'collar', actualPieceQty: 208 }),
    fact({ factId: 'same-event-d', sourceEventId: 'same-event', materialId: 'D', partId: 'cuff', actualPieceQty: 200 }),
    fact({ factId: 'same-event-back', sourceEventId: 'same-event', materialId: 'A', partId: 'back', actualPieceQty: 220 }),
  ],
})
assert.deepEqual(sourceEventCompositeKey.colorGroups[0].materialRows.map((row) => row.cells[0].availableGarmentQty), [220, 200, 208, 200])

const requirementOrder = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Blue: { L: 10 } },
  requirements: [
    { materialId: 'R2', materialName: 'Red 第二物料', partId: 'red-2', partName: 'Red 第二部位', piecesPerGarment: 1, garmentColor: 'Red', size: 'S' },
    { materialId: 'R1', materialName: 'Red 第一物料', partId: 'red-1', partName: 'Red 第一部位', piecesPerGarment: 1, garmentColor: 'Red', size: 'M' },
    { materialId: 'B1', materialName: 'Black 物料', partId: 'black-1', partName: 'Black 部位', piecesPerGarment: 1, garmentColor: 'Black', size: 'M' },
  ],
  facts: [],
})
assert.deepEqual(requirementOrder.colorGroups.map((group) => group.garmentColor), ['Red', 'Black', 'Blue'])
assert.deepEqual(requirementOrder.colorGroups[0].sizes, ['S', 'M'])
assert.deepEqual(requirementOrder.colorGroups[0].materialRows.map((row) => row.materialId), ['R2', 'R1'])

const emptyRequiredMatrix = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { M: 240 } },
  requirements: [],
  facts: blackFacts,
})
assert.equal(emptyRequiredMatrix.colorGroups[0].completeKitBySize.M, null)
assert.equal(emptyRequiredMatrix.calculationStatus, '数据不完整')

const unmappedFact = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { M: 240 } },
  requirements,
  facts: [...blackFacts, fact({ factId: 'unmapped', sourceEventId: 'unmapped', materialId: 'X', partId: 'unknown', actualPieceQty: 10 })],
})
assert.equal(unmappedFact.colorGroups[0].materialRows[0].cells[0].calculationStatus, '数据不完整')
assert.equal(unmappedFact.calculationStatus, '数据不完整')

const netCannotBeNegative = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { M: 240 } },
  requirements,
  facts: [...blackFacts, fact({ factId: 'reverse-over', sourceEventId: 'reverse-over', materialId: 'A', partId: 'front', actualPieceQty: 300, direction: '反向' })],
})
assert.equal(netCannotBeNegative.colorGroups[0].materialRows[0].cells[0].partCalculations[0].actualPieceQty, 0)
assert.equal(netCannotBeNegative.colorGroups[0].materialRows[0].cells[0].availableGarmentQty, 0)

for (const piecesPerGarment of [undefined, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
  const invalidPieces = buildReleaseMatrix({
    productionOrderId,
    productionOrderNo: 'PO14671',
    spuCode: 'ASYSA26060310',
    planQtyByColorSize: { Black: { M: 240 } },
    requirements: [{ materialId: 'invalid', materialName: '无效用量', partId: 'invalid', partName: '无效部位', piecesPerGarment }],
    facts: [fact({ factId: `invalid-${piecesPerGarment}`, sourceEventId: `invalid-${piecesPerGarment}`, materialId: 'invalid', partId: 'invalid', actualPieceQty: 10 })],
  })
  assert.equal(invalidPieces.colorGroups[0].materialRows[0].cells[0].calculationStatus, '数据不完整')
  assertAllNumbersFinite(invalidPieces)
}

const missingPiecesWithoutFacts = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { M: 240 } },
  requirements: [{ materialId: 'missing', materialName: '缺失用量', partId: 'missing', partName: '缺失部位' }],
  facts: [],
})
assert.equal(missingPiecesWithoutFacts.colorGroups[0].materialRows[0].cells[0].calculationStatus, '数据不完整')
assert.equal(missingPiecesWithoutFacts.calculationStatus, '数据不完整')

const colorScopedRequirements: CutPieceRequirement[] = [
  { materialId: 'A', materialName: 'Red 专属物料', partId: 'red-part', partName: 'Red 部位', piecesPerGarment: 1, garmentColor: 'Red', size: 'M' },
  { materialId: 'B', materialName: 'Black 专属物料', partId: 'black-part', partName: 'Black 部位', piecesPerGarment: 1, garmentColor: 'Black', size: 'M' },
]
const colorScopedMatrix = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Red: { M: 10 }, Black: { M: 10 } },
  requirements: colorScopedRequirements,
  facts: [
    fact({ factId: 'red-a', sourceEventId: 'red-a', garmentColor: 'Red', materialId: 'A', partId: 'red-part', actualPieceQty: 10 }),
    fact({ factId: 'black-b', sourceEventId: 'black-b', garmentColor: 'Black', materialId: 'B', partId: 'black-part', actualPieceQty: 10 }),
  ],
})
assert.deepEqual(colorScopedMatrix.colorGroups.map((group) => group.garmentColor), ['Red', 'Black'])
assert.deepEqual(colorScopedMatrix.colorGroups[0].materialRows.map((row) => row.materialId), ['A'])
assert.deepEqual(colorScopedMatrix.colorGroups[1].materialRows.map((row) => row.materialId), ['B'])
assert.deepEqual(colorScopedMatrix.colorGroups.map((group) => group.completeKitBySize.M), [10, 10])
assert.equal(colorScopedMatrix.calculationStatus, '可计算')

const compositeDimensions = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { M: 30, L: 30 }, Red: { M: 30 } },
  requirements: [{ materialId: 'A', materialName: '物料 A', partId: 'part', partName: '部位', piecesPerGarment: 1 }],
  facts: [
    fact({ factId: 'same-black-m', sourceEventId: 'same', garmentColor: 'Black', size: 'M', materialId: 'A', partId: 'part', actualPieceQty: 10 }),
    fact({ factId: 'same-black-m-replay', sourceEventId: 'same', garmentColor: 'Black', size: 'M', materialId: 'A', partId: 'part', actualPieceQty: 10 }),
    fact({ factId: 'same-black-l', sourceEventId: 'same', garmentColor: 'Black', size: 'L', materialId: 'A', partId: 'part', actualPieceQty: 11 }),
    fact({ factId: 'same-red-m', sourceEventId: 'same', garmentColor: 'Red', size: 'M', materialId: 'A', partId: 'part', actualPieceQty: 12 }),
    fact({ factId: 'same-reverse', sourceEventId: 'same', garmentColor: 'Black', size: 'M', materialId: 'A', partId: 'part', actualPieceQty: 3, direction: '反向' }),
    fact({ factId: 'same-reverse-replay', sourceEventId: 'same', garmentColor: 'Black', size: 'M', materialId: 'A', partId: 'part', actualPieceQty: 3, direction: '反向' }),
  ],
})
assert.deepEqual(compositeDimensions.colorGroups[0].materialRows[0].cells.map((cell) => cell.availableGarmentQty), [7, 11])
assert.equal(compositeDimensions.colorGroups[1].materialRows[0].cells[0].availableGarmentQty, 12)

const emptyPartScope = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Red: { S: 10, M: 10 }, Black: { M: 10 } },
  requirements: [{ materialId: 'A', materialName: '只适用 S', partId: 'a', partName: 'A 部位', piecesPerGarment: 1, garmentColor: 'Red', size: 'S' }],
  facts: [fact({ factId: 'red-s', sourceEventId: 'red-s', garmentColor: 'Red', size: 'S', materialId: 'A', partId: 'a', actualPieceQty: 10 })],
})
const redMEmptyPart = emptyPartScope.colorGroups[0].materialRows[0].cells[1]
assert.equal(redMEmptyPart.calculationStatus, '数据不完整')
assert.equal(redMEmptyPart.availableGarmentQty, null)
assert.equal(emptyPartScope.colorGroups[0].completeKitBySize.M, null)
assert.equal(emptyPartScope.colorGroups[1].materialRows.length, 0)
assert.equal(emptyPartScope.colorGroups[1].completeKitBySize.M, null)
assert.equal(emptyPartScope.calculationStatus, '数据不完整')

const mixedIncompleteMaterial = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { M: 10 } },
  requirements: [
    { materialId: 'A', materialName: '部位无效的物料', partId: '', partName: '缺失部位', piecesPerGarment: 1 },
    { materialId: 'B', materialName: '完整物料', partId: 'body', partName: '衣身', piecesPerGarment: 1 },
  ],
  facts: [fact({ factId: 'mixed-b', sourceEventId: 'mixed-b', materialId: 'B', partId: 'body', actualPieceQty: 10 })],
})
const mixedCells = mixedIncompleteMaterial.colorGroups[0].materialRows.map((row) => row.cells[0])
assert.equal(mixedCells[0].calculationStatus, '数据不完整')
assert.equal(mixedCells[0].availableGarmentQty, null)
assert.equal(mixedCells[1].calculationStatus, '可计算')
assert.equal(mixedCells[1].availableGarmentQty, 10)
assert.equal(mixedIncompleteMaterial.colorGroups[0].completeKitBySize.M, null)
assert.equal(mixedIncompleteMaterial.calculationStatus, '数据不完整')

function assertAllNumbersFinite(value: unknown): void {
  if (typeof value === 'number') {
    assert.equal(Number.isFinite(value), true, `输出出现非有限数：${value}`)
  } else if (Array.isArray(value)) {
    value.forEach(assertAllNumbersFinite)
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach(assertAllNumbersFinite)
  }
}

const overflowFacts = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { M: 10 } },
  requirements: [{ materialId: 'A', materialName: '溢出物料', partId: 'part', partName: '部位', piecesPerGarment: 1 }],
  facts: [
    fact({ factId: 'max-1', sourceEventId: 'max-1', materialId: 'A', partId: 'part', actualPieceQty: Number.MAX_VALUE }),
    fact({ factId: 'max-2', sourceEventId: 'max-2', materialId: 'A', partId: 'part', actualPieceQty: Number.MAX_VALUE }),
  ],
})
assert.equal(overflowFacts.colorGroups[0].materialRows[0].cells[0].partCalculations[0].calculationStatus, '数据不完整')
assert.equal(overflowFacts.colorGroups[0].materialRows[0].cells[0].calculationStatus, '数据不完整')
assert.equal(overflowFacts.calculationStatus, '数据不完整')
assertAllNumbersFinite(overflowFacts)

const overflowDivision = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { M: 10 } },
  requirements: [{ materialId: 'A', materialName: '极小用量', partId: 'part', partName: '部位', piecesPerGarment: Number.MIN_VALUE }],
  facts: [fact({ factId: 'min-divisor', sourceEventId: 'min-divisor', materialId: 'A', partId: 'part', actualPieceQty: Number.MAX_VALUE })],
})
assert.equal(overflowDivision.colorGroups[0].materialRows[0].cells[0].calculationStatus, '数据不完整')
assertAllNumbersFinite(overflowDivision)

const unsafePlan = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { S: Number.NaN, M: Number.POSITIVE_INFINITY, L: -1 } },
  requirements: [{ materialId: 'A', materialName: '安全计划', partId: 'part', partName: '部位', piecesPerGarment: 1 }],
  facts: [],
})
assert.deepEqual(unsafePlan.colorGroups[0].planQtyBySize, { S: 0, M: 0, L: 0 })
assertAllNumbersFinite(unsafePlan)

const factOnlyOrderingInput: CutPieceFact[] = [
  fact({ factId: 'fact-only-red-s', sourceEventId: 'fact-only-red-s', garmentColor: '红', size: 'S', materialId: 'A', partId: 'part', actualPieceQty: 1 }),
  fact({ factId: 'fact-only-blue-m', sourceEventId: 'fact-only-blue-m', garmentColor: '蓝', size: 'M', materialId: 'A', partId: 'part', actualPieceQty: 1 }),
  fact({ factId: 'fact-only-red-l', sourceEventId: 'fact-only-red-l', garmentColor: '红', size: 'L', materialId: 'A', partId: 'part', actualPieceQty: 1 }),
]
const factOnlyMatrix = (facts: CutPieceFact[]) => buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: {},
  requirements: [{ materialId: 'A', materialName: '事实排序物料', partId: 'part', partName: '部位', piecesPerGarment: 1 }],
  facts,
})
const factOnlyForward = factOnlyMatrix(factOnlyOrderingInput)
const factOnlyReverse = factOnlyMatrix([...factOnlyOrderingInput].reverse())
assert.deepEqual(factOnlyForward.colorGroups.map((group) => [group.garmentColor, group.sizes]), factOnlyReverse.colorGroups.map((group) => [group.garmentColor, group.sizes]))
assert.deepEqual(factOnlyForward.colorGroups.map((group) => group.garmentColor), ['红', '蓝'].sort((left, right) => left.localeCompare(right, 'zh-CN')))
assert.deepEqual(factOnlyForward.colorGroups.find((group) => group.garmentColor === '红')?.sizes, ['S', 'L'].sort((left, right) => left.localeCompare(right, 'zh-CN')))

console.log('cut piece release matrix check passed')
