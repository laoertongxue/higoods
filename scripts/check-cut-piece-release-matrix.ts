import assert from 'node:assert/strict'

import {
  appendMatrixEvent,
  buildReleaseMatrix,
  buildSupplementPartShortages,
  buildTargetPreview,
  createMatrixEventState,
  type CutPieceFact,
  type CutPieceRequirement,
} from '../src/data/fcs/cut-piece-release-domain'
import {
  confirmCutPieceReleaseTarget,
  getCutPieceReleaseMatrix,
  getCutPieceReleaseRecord,
  getCutPieceReleaseTargetSnapshot,
  getCutPieceReleaseSummaryForProductionOrder,
  listCutPieceReleaseMatrixVersions,
  listCutPieceReleaseRecords,
  recordCutOrderReleaseStatusChange,
  recordSpreadingReleaseAdjustment,
  resetCutPieceReleasePrototypeStoreForTesting,
} from '../src/data/fcs/cut-piece-release'

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

const blackThreeSizeRequirements: CutPieceRequirement[] = [
  { materialId: 'A', materialName: '面料 A', partId: 'front', partName: '前片', piecesPerGarment: 1 },
  { materialId: 'B', materialName: '里料 B', partId: 'front', partName: '前片', piecesPerGarment: 2 },
  { materialId: 'C', materialName: '辅料 C', partId: 'collar', partName: '领片', piecesPerGarment: 1 },
  { materialId: 'D', materialName: '辅料 D', partId: 'cuff', partName: '袖口', piecesPerGarment: 1 },
]
const blackThreeSizeQty: Record<string, Record<string, number>> = {
  A: { M: 220, L: 358, XL: 532 },
  B: { M: 200, L: 350, XL: 500 },
  C: { M: 208, L: 364, XL: 520 },
  D: { M: 200, L: 350, XL: 500 },
}
const blackThreeSizeMatrix = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { M: 215, L: 344, XL: 482 } },
  requirements: blackThreeSizeRequirements,
  facts: Object.entries(blackThreeSizeQty).flatMap(([materialId, qtyBySize]) => Object.entries(qtyBySize).map(([size, actualGarmentQty]) => fact({
    factId: `black-${materialId}-${size}`,
    sourceEventId: `spread-${materialId}-${size}`,
    materialId,
    partId: materialId === 'B' ? 'front' : materialId === 'A' ? 'front' : materialId === 'C' ? 'collar' : 'cuff',
    size,
    actualPieceQty: materialId === 'B' ? actualGarmentQty * 2 : actualGarmentQty,
  }))),
})
const blackTargetPreview = buildTargetPreview(blackThreeSizeMatrix, {
  'Black::M': 208,
  'Black::L': 350,
  'Black::XL': 520,
})
assert.deepEqual(blackTargetPreview.colorSizeTargets, { 'Black::M': 208, 'Black::L': 350, 'Black::XL': 520 })
assert.deepEqual(
  blackTargetPreview.differences.map((item) => [item.size, item.materialId, item.differenceQty, item.status]),
  [
    ['M', 'A', 12, '多余'], ['M', 'B', -8, '需补'], ['M', 'C', 0, '刚好'], ['M', 'D', -8, '需补'],
    ['L', 'A', 8, '多余'], ['L', 'B', 0, '刚好'], ['L', 'C', 14, '多余'], ['L', 'D', 0, '刚好'],
    ['XL', 'A', 12, '多余'], ['XL', 'B', -20, '需补'], ['XL', 'C', 0, '刚好'], ['XL', 'D', -20, '需补'],
  ],
)
const blackPartShortages = buildSupplementPartShortages(blackThreeSizeMatrix, blackTargetPreview)
assert.deepEqual(
  blackPartShortages.filter((item) => item.materialId === 'B' && item.size === 'M').map((item) => [item.partId, item.actualMissingPieceQty, item.supplementGarmentQty]),
  [['front', 16, 8]],
)
assert.throws(() => buildTargetPreview(blackThreeSizeMatrix, { 'Black::M': 215 }), /候选/)
assert.throws(() => buildTargetPreview(blackThreeSizeMatrix, { 'Black::M': 350 }), /候选/, 'Black/M 不能选用 Black/L 的候选')
assert.throws(() => buildTargetPreview(blackThreeSizeMatrix, { 'Black::M': 520 }), /候选/, 'Black/M 不能选用 Black/XL 的候选')

const colorIsolatedMatrix = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { M: 20 }, Red: { M: 10 } },
  requirements: [{ materialId: 'A', materialName: '物料 A', partId: 'body', partName: '衣身', piecesPerGarment: 1 }],
  facts: [
    fact({ factId: 'isolated-black', sourceEventId: 'isolated-black', garmentColor: 'Black', materialId: 'A', partId: 'body', actualPieceQty: 20 }),
    fact({ factId: 'isolated-red', sourceEventId: 'isolated-red', garmentColor: 'Red', materialId: 'A', partId: 'body', actualPieceQty: 10 }),
  ],
})
assert.throws(() => buildTargetPreview(colorIsolatedMatrix, { 'Black::M': 10 }), /候选/, 'Red/M 候选不能作为 Black/M 目标')
assert.throws(() => buildTargetPreview(colorIsolatedMatrix, { 'Red::M': 20 }), /候选/, 'Black/M 候选不能作为 Red/M 目标')
assert.deepEqual(buildTargetPreview(colorIsolatedMatrix, { 'Black::M': 20, 'Red::M': 10 }).colorSizeTargets, { 'Black::M': 20, 'Red::M': 10 })

const multiPartShortageMatrix = buildReleaseMatrix({
  productionOrderId,
  productionOrderNo: 'PO14671',
  spuCode: 'ASYSA26060310',
  planQtyByColorSize: { Black: { M: 10 } },
  requirements: [
    { materialId: 'B', materialName: '里料 B', partId: 'front', partName: '前片', piecesPerGarment: 2 },
    { materialId: 'B', materialName: '里料 B', partId: 'back', partName: '后片', piecesPerGarment: 1 },
    { materialId: 'C', materialName: '辅料 C', partId: 'collar', partName: '领片', piecesPerGarment: 1 },
  ],
  facts: [
    fact({ factId: 'multi-front', sourceEventId: 'multi-front', materialId: 'B', partId: 'front', actualPieceQty: 16 }),
    fact({ factId: 'multi-back', sourceEventId: 'multi-back', materialId: 'B', partId: 'back', actualPieceQty: 10 }),
    fact({ factId: 'multi-collar', sourceEventId: 'multi-collar', materialId: 'C', partId: 'collar', actualPieceQty: 10 }),
  ],
})
const multiPartShortages = buildSupplementPartShortages(multiPartShortageMatrix, buildTargetPreview(multiPartShortageMatrix, { 'Black::M': 10 }))
assert.deepEqual(multiPartShortages.filter((item) => item.materialId === 'B').map((item) => [item.partId, item.actualMissingPieceQty, item.supplementGarmentQty]), [['front', 4, 2]], '同物料后片足量时不得生成后片补料缺口')

const matrixEvents = createMatrixEventState()
const mutableEvent = { eventId: 'spread-done-1', eventType: '铺布完成' as const, productionOrderId, occurredAt: '2026-06-03 10:00:00', operator: '阿迪' }
assert.equal(appendMatrixEvent(matrixEvents, mutableEvent), true)
mutableEvent.operator = '被修改'
assert.equal(matrixEvents.events[0].operator, '阿迪')
assert.equal(appendMatrixEvent(matrixEvents, { ...mutableEvent, operator: '阿迪' }), false)
assert.equal(matrixEvents.events.length, 1)
assertAllNumbersFinite(blackTargetPreview)
assertAllNumbersFinite(blackPartShortages)

resetCutPieceReleasePrototypeStoreForTesting()
const repositoryRecord = listCutPieceReleaseRecords().find((item) => item.productionOrderNo === 'PO14671')
assert.ok(repositoryRecord, 'PO14671 必须由矩阵仓储提供放行记录')
if (!repositoryRecord) throw new Error('PO14671 裁片放行记录缺失')
assert.equal(repositoryRecord.matrix.colorGroups[0].completeKitBySize.M, 200)
assert.equal(repositoryRecord.matrix.colorGroups[0].completeKitBySize.L, 350)
assert.equal(repositoryRecord.matrix.colorGroups[0].completeKitBySize.XL, 500)
assert.equal(repositoryRecord.frozenCutOrderCount, 1, 'B 的来源裁片单应为冻结来源')
assert.equal(getCutPieceReleaseRecord(repositoryRecord.recordId)?.productionOrderId, repositoryRecord.productionOrderId)
assert.equal(getCutPieceReleaseSummaryForProductionOrder(repositoryRecord.productionOrderId)?.recordId, repositoryRecord.recordId)
const mutableListedRecord = listCutPieceReleaseRecords()[0]
mutableListedRecord.matrix.colorGroups[0].materialRows[0].cells[0].partCalculations[0].actualPieceQty = 999
assert.equal(listCutPieceReleaseRecords()[0].matrix.colorGroups[0].materialRows[0].cells[0].partCalculations[0].actualPieceQty, 220, '列表 API 不得泄漏嵌套矩阵引用')
const mutableRecord = getCutPieceReleaseRecord(repositoryRecord.recordId)!
mutableRecord.matrix.colorGroups[0].materialRows[0].cells[0].partCalculations[0].piecesPerGarment = 999
assert.equal(getCutPieceReleaseRecord(repositoryRecord.recordId)!.matrix.colorGroups[0].materialRows[0].cells[0].partCalculations[0].piecesPerGarment, 1, '详情 API 不得泄漏嵌套矩阵引用')
const mutableMatrix = getCutPieceReleaseMatrix(productionOrderId)!
mutableMatrix.colorGroups[0].materialRows[0].cells[0].partCalculations[0].actualPieceQty = 999
assert.equal(getCutPieceReleaseMatrix(productionOrderId)!.colorGroups[0].materialRows[0].cells[0].partCalculations[0].actualPieceQty, 220, '矩阵 API 不得泄漏嵌套矩阵引用')

const initialVersion = listCutPieceReleaseMatrixVersions(productionOrderId).at(-1)!
const invalidTarget = confirmCutPieceReleaseTarget({
  productionOrderId,
  matrixVersion: initialVersion.version,
  colorSizeTargets: { 'Black::M': 215, 'Black::L': 350, 'Black::XL': 520 },
  confirmedBy: '裁床主管 王敏',
})
assert.equal(invalidTarget.ok, false, '计划数不是目标候选时必须拒绝')
const confirmedTarget = confirmCutPieceReleaseTarget({
  productionOrderId,
  matrixVersion: initialVersion.version,
  colorSizeTargets: { 'Black::M': 208, 'Black::L': 350, 'Black::XL': 520 },
  confirmedBy: '裁床主管 王敏',
})
assert.equal(confirmedTarget.ok, true)
assert.ok(confirmedTarget.snapshot)
assert.equal(confirmedTarget.snapshot?.targetPreview.colorSizeTargets['Black::L'], 350, '重复候选只保存一个 L 目标值')
assert.equal(confirmedTarget.snapshot?.targetPreview.differences.filter((item) => item.size === 'L' && item.status === '刚好').length, 2)
const snapshotId = confirmedTarget.snapshot!.snapshotId
confirmedTarget.snapshot!.matrixSnapshot.colorGroups[0].materialRows[0].cells[0].partCalculations[0].actualPieceQty = 999
assert.equal(getCutPieceReleaseTargetSnapshot(snapshotId)?.matrixSnapshot.colorGroups[0].materialRows[0].cells[0].partCalculations[0].actualPieceQty, 220, '确认结果返回的快照不得泄漏仓储引用')
const queriedSnapshot = getCutPieceReleaseTargetSnapshot(snapshotId)!
queriedSnapshot.matrixSnapshot.colorGroups[0].materialRows[0].cells[0].partCalculations[0].actualPieceQty = 999
assert.equal(getCutPieceReleaseTargetSnapshot(snapshotId)?.matrixSnapshot.colorGroups[0].materialRows[0].cells[0].partCalculations[0].actualPieceQty, 220, '查询结果不得泄漏嵌套仓储快照引用')
assert.equal(confirmCutPieceReleaseTarget({
  productionOrderId,
  matrixVersion: initialVersion.version,
  colorSizeTargets: { 'Black::M': 208, 'Black::L': 350, 'Black::XL': 520 },
  confirmedBy: '裁床主管 王敏',
}).ok, true, '已确认的相同目标应允许幂等重试')

const versionBeforeFrozenEvent = listCutPieceReleaseMatrixVersions(productionOrderId).length
recordCutOrderReleaseStatusChange({ eventId: 'legacy-freeze-noop', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '已冻结', occurredAt: '2026-06-04 08:00:00', operator: '裁床主管 王敏', reason: '冻结确认' })
const frozenMatrix = getCutPieceReleaseMatrix(productionOrderId)!
const frozenBCells = frozenMatrix.colorGroups[0].materialRows.find((row) => row.materialId === 'B')!.cells
assert.deepEqual(frozenBCells.map((cell) => [cell.size, cell.sourceStatus, cell.availableGarmentQty]), [['M', '已冻结', 200], ['L', '已冻结', 350], ['XL', '已冻结', 500]], '冻结只更新来源状态，不能改变 B 三尺码数量')
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, versionBeforeFrozenEvent, '初始已冻结时冻结事件必须 no-op')
recordCutOrderReleaseStatusChange({ eventId: 'legacy-freeze-noop', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '已冻结', occurredAt: '2026-06-04 08:00:00', operator: '裁床主管 王敏', reason: '冻结确认' })
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, versionBeforeFrozenEvent, '重复冻结事件不得新增版本')
recordCutOrderReleaseStatusChange({ eventId: 'legacy-restore', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '持续更新', occurredAt: '2026-06-04 09:00:00', operator: '裁床主管 王敏', reason: '复核恢复' })
const afterRestoreVersions = listCutPieceReleaseMatrixVersions(productionOrderId)
const restoredBCells = getCutPieceReleaseMatrix(productionOrderId)!.colorGroups[0].materialRows.find((row) => row.materialId === 'B')!.cells
assert.deepEqual(restoredBCells.map((cell) => [cell.size, cell.sourceStatus, cell.availableGarmentQty]), [['M', '持续更新', 200], ['L', '持续更新', 350], ['XL', '持续更新', 500]], '恢复只更新来源状态，不能改变 B 三尺码数量')
assert.equal(afterRestoreVersions.length, versionBeforeFrozenEvent + 1, '有效恢复形成一个版本')
assert.equal(getCutPieceReleaseRecord(repositoryRecord.recordId)?.targetStatus, '目标后数据已变化')
assert.equal(getCutPieceReleaseTargetSnapshot(snapshotId)?.matrixSnapshot.colorGroups[0].completeKitBySize.M, 200, '新版本不得改写旧快照')
recordCutOrderReleaseStatusChange({ eventId: 'legacy-restore', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '持续更新', occurredAt: '2026-06-04 09:00:00', operator: '裁床主管 王敏', reason: '复核恢复' })
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, afterRestoreVersions.length, '重复恢复事件不得新增版本')
recordCutOrderReleaseStatusChange({ eventId: 'legacy-freeze-effective', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '已冻结', occurredAt: '2026-06-04 10:00:00', operator: '裁床主管 王敏', reason: '再次冻结' })
const beforeAdjustmentVersions = listCutPieceReleaseMatrixVersions(productionOrderId)
const beforeAdjustmentBCells = getCutPieceReleaseMatrix(productionOrderId)!.colorGroups[0].materialRows.find((row) => row.materialId === 'B')!.cells
assert.deepEqual(beforeAdjustmentBCells.map((cell) => cell.availableGarmentQty), [200, 350, 500])
assert.deepEqual(beforeAdjustmentVersions.at(-1)!.matrixSnapshot.colorGroups[0].materialRows.find((row) => row.materialId === 'B')!.cells.map((cell) => cell.availableGarmentQty), [200, 350, 500], '冲销前版本必须保留 B 原正向数量')
const oldVersionNumber = beforeAdjustmentVersions.at(-1)!.version
const oldBPartSourceFactIds = beforeAdjustmentBCells.find((cell) => cell.size === 'M')!.partCalculations[0].sourceFactIds
assert.equal(oldBPartSourceFactIds.length, 1, '冲销前 B/M 应只有原正向来源事实')
recordSpreadingReleaseAdjustment({ adjustmentEventId: 'reverse-spread-14671', spreadingOrderNo: 'ASYSA26060310', productionOrderId, direction: -1, occurredAt: '2026-06-04 11:00:00', operator: '阿迪', reason: '铺布冲销' })
const afterAdjustmentVersions = listCutPieceReleaseMatrixVersions(productionOrderId)
assert.equal(afterAdjustmentVersions.length, afterRestoreVersions.length + 2, '关闭、恢复、冲销各只形成一次版本')
const adjustedMatrix = getCutPieceReleaseMatrix(productionOrderId)!
const adjustedBCells = adjustedMatrix.colorGroups[0].materialRows.find((row) => row.materialId === 'B')!.cells
assert.equal(adjustedMatrix.calculationStatus, '可计算', '净额归零仍是可计算矩阵')
assert.deepEqual(adjustedBCells.map((cell) => [cell.size, cell.calculationStatus, cell.availableGarmentQty]), [['M', '可计算', 0], ['L', '可计算', 0], ['XL', '可计算', 0]], '整单冲销必须将 B 三尺码按原事实反向冲减为可计算的零')
assert.deepEqual(adjustedBCells.find((cell) => cell.size === 'M')!.partCalculations.map((part) => [part.calculationStatus, part.availableGarmentQty]), [['可计算', 0]], 'B/M 部位冲销后也必须是可计算的零')
assert.deepEqual(adjustedMatrix.colorGroups[0].completeKitBySize, { M: 0, L: 0, XL: 0 }, '冲销后当前齐套必须重算')
const persistedOldVersion = listCutPieceReleaseMatrixVersions(productionOrderId).find((item) => item.version === oldVersionNumber)!
assert.deepEqual(persistedOldVersion.matrixSnapshot.colorGroups[0].materialRows.find((row) => row.materialId === 'B')!.cells.map((cell) => cell.availableGarmentQty), [200, 350, 500], '冲销后重新读取旧版本仍须保留 B 原数量')
assert.deepEqual(persistedOldVersion.matrixSnapshot.colorGroups[0].completeKitBySize, { M: 200, L: 350, XL: 500 }, '冲销后重新读取旧版本仍须保留原齐套数量')
const adjustedBPartSourceFactIds = adjustedBCells.find((cell) => cell.size === 'M')!.partCalculations[0].sourceFactIds
assert.ok(oldBPartSourceFactIds.every((factId) => adjustedBPartSourceFactIds.includes(factId)), '冲销不能删除原正向来源事实')
assert.equal(adjustedBPartSourceFactIds.length, oldBPartSourceFactIds.length + 1, '冲销应追加一条反向来源事实')
assert.ok(adjustedBPartSourceFactIds.some((factId) => factId.includes('adjust:reverse-spread-14671')), '冲销来源必须包含调整事实标识')
recordSpreadingReleaseAdjustment({ adjustmentEventId: 'reverse-spread-14671', spreadingOrderNo: 'ASYSA26060310', productionOrderId, direction: -1, occurredAt: '2026-06-04 11:00:00', operator: '阿迪', reason: '铺布冲销' })
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, afterAdjustmentVersions.length, '重复冲销事件不得新增版本')
assert.deepEqual(getCutPieceReleaseMatrix(productionOrderId)!.colorGroups[0].materialRows.find((row) => row.materialId === 'B')!.cells.find((cell) => cell.size === 'M')!.partCalculations[0].sourceFactIds, adjustedBPartSourceFactIds, '重复冲销不得重复追加来源事实')
assert.ok(getCutPieceReleaseMatrix(productionOrderId), '冲销不能删除原有生产单矩阵事实')
const mutableVersion = listCutPieceReleaseMatrixVersions(productionOrderId)[0]
mutableVersion.matrixSnapshot.colorGroups[0].materialRows[0].cells[0].partCalculations[0].actualPieceQty = 999
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId)[0].matrixSnapshot.colorGroups[0].materialRows[0].cells[0].partCalculations[0].actualPieceQty, 220, '版本查询不得泄漏嵌套仓储引用')
assertAllNumbersFinite(listCutPieceReleaseRecords())
assertAllNumbersFinite(listCutPieceReleaseMatrixVersions(productionOrderId))

resetCutPieceReleasePrototypeStoreForTesting()
const statusNoopInitialVersionCount = listCutPieceReleaseMatrixVersions(productionOrderId).length
recordCutOrderReleaseStatusChange({ eventId: 'freeze-noop-b', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '已冻结', occurredAt: '2026-06-05 08:00:00', operator: '裁床主管 王敏', reason: '初始已冻结无需重复冻结' })
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, statusNoopInitialVersionCount, '状态未变化即使事件 ID 新也必须严格 no-op')
assert.equal(getCutPieceReleaseRecord('cpr-po-14671')?.targetStatus, '待确认', '无效状态事件不能使目标失效')
recordCutOrderReleaseStatusChange({ eventId: 'restore-b', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '持续更新', occurredAt: '2026-06-05 09:00:00', operator: '裁床主管 王敏', reason: 'B 恢复持续更新' })
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, statusNoopInitialVersionCount + 1)
recordCutOrderReleaseStatusChange({ eventId: 'restore-b', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '持续更新', occurredAt: '2026-06-05 09:00:00', operator: '裁床主管 王敏', reason: 'B 恢复持续更新' })
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, statusNoopInitialVersionCount + 1, '重复 eventId 必须 no-op')
recordCutOrderReleaseStatusChange({ eventId: 'restore-b-noop', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '持续更新', occurredAt: '2026-06-05 09:00:00', operator: '裁床主管 王敏', reason: '状态未变化' })
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, statusNoopInitialVersionCount + 1, '不同事件 ID 但状态未变也必须 no-op')
recordCutOrderReleaseStatusChange({ eventId: 'freeze-b-effective', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '已冻结', occurredAt: '2026-06-05 10:00:00', operator: '裁床主管 王敏', reason: 'B 再次冻结' })
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, statusNoopInitialVersionCount + 2)
const frozenAuditVersion = listCutPieceReleaseMatrixVersions(productionOrderId).at(-1)!
assert.deepEqual([frozenAuditVersion.reason, frozenAuditVersion.cutOrderId, frozenAuditVersion.cutOrderNo], ['B 再次冻结', 'cut-14671-b', 'CUT14671-B'])

resetCutPieceReleasePrototypeStoreForTesting()
const noIdSourceVersionCount = listCutPieceReleaseMatrixVersions(productionOrderId).length
recordCutOrderReleaseStatusChange({ eventId: 'restore-b-by-no', cutOrderId: '', cutOrderNo: 'CUT14671-B', status: '持续更新', occurredAt: '2026-06-05 12:00:00', operator: '裁床主管 王敏', reason: '按单号恢复 B' })
recordCutOrderReleaseStatusChange({ eventId: 'freeze-main-by-no', cutOrderId: '', cutOrderNo: 'CUT14671-A', status: '已冻结', occurredAt: '2026-06-05 12:00:00', operator: '裁床主管 王敏', reason: '按单号冻结主裁片单' })
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, noIdSourceVersionCount + 2, '空裁片单 ID 时不同可靠单号和外部事件 ID 不得碰撞')

resetCutPieceReleasePrototypeStoreForTesting()
const confirmRetryVersion = listCutPieceReleaseMatrixVersions(productionOrderId).at(-1)!.version
const confirmRetryInput = { productionOrderId, matrixVersion: confirmRetryVersion, colorSizeTargets: { 'Black::M': 208, 'Black::L': 350, 'Black::XL': 520 }, confirmedBy: '裁床主管 王敏' }
const firstConfirmedTarget = confirmCutPieceReleaseTarget(confirmRetryInput)
assert.equal(firstConfirmedTarget.ok, true)
const confirmRetryVersionCount = listCutPieceReleaseMatrixVersions(productionOrderId).length
const retriedConfirmedTarget = confirmCutPieceReleaseTarget(confirmRetryInput)
assert.equal(retriedConfirmedTarget.ok, true, '相同目标确认请求必须可安全重试')
assert.equal(retriedConfirmedTarget.snapshot?.snapshotId, firstConfirmedTarget.snapshot?.snapshotId)
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, confirmRetryVersionCount, '目标确认重试不得新增版本')
const conflictingConfirmedTarget = confirmCutPieceReleaseTarget({ ...confirmRetryInput, confirmedBy: '裁床主管 林涛' })
assert.equal(conflictingConfirmedTarget.ok, false)
assert.match(conflictingConfirmedTarget.message, /冲突/)
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, confirmRetryVersionCount, '冲突重试不得新增版本')

resetCutPieceReleasePrototypeStoreForTesting()
recordSpreadingReleaseAdjustment({ adjustmentEventId: 'audit-reverse-spread', spreadingOrderNo: 'ASYSA26060310', productionOrderId, direction: -1, occurredAt: '2026-06-05 13:00:00', operator: '阿迪', reason: '审计冲销原因' })
const adjustmentAuditVersion = listCutPieceReleaseMatrixVersions(productionOrderId).at(-1)!
assert.deepEqual([adjustmentAuditVersion.reason, adjustmentAuditVersion.spreadingOrderNo], ['审计冲销原因', 'ASYSA26060310'])
adjustmentAuditVersion.matrixSnapshot.colorGroups[0].materialRows[0].cells[0].partCalculations[0].sourceFactIds.push('tamper')
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).at(-1)!.matrixSnapshot.colorGroups[0].materialRows[0].cells[0].partCalculations[0].sourceFactIds.includes('tamper'), false, '审计版本读取仍必须深拷贝')

console.log('cut piece release matrix check passed')
