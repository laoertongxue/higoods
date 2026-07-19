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

console.log('cut piece release matrix check passed')
