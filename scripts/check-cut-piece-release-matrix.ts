import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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
  getCutOrderReleaseImpactSummary,
  getCutPieceReleaseMatrix,
  getCutPieceReleaseRecord,
  getCutPieceReleaseTargetSnapshot,
  getCutPieceReleaseSummaryForProductionOrder,
  listCutPieceReleaseMatrixVersions,
  listCutPieceReleaseRecords,
  listLateCutPieceReleaseEvents,
  recordCutOrderReleaseStatusChange,
  recordLateCutPieceReleaseEvent,
  recordSpreadingReleaseAdjustment,
  resetCutPieceReleasePrototypeStoreForTesting,
} from '../src/data/fcs/cut-piece-release'
import {
  createNextCutOrderCloseRecordIdentity,
  createNextCutOrderReopenRecordIdentity,
  listStoredCutOrderCloseRecords,
  listStoredCutOrderReopenRecords,
  upsertStoredCutOrderCloseRecord,
  upsertStoredCutOrderReopenRecord,
  type CutOrderCloseRecord,
  type CutOrderReopenRecord,
} from '../src/data/fcs/cutting/cut-order-close-records'
import {
  cuttingOrderProgressRecords,
  updateCuttingOrderProgressWebStage,
} from '../src/data/fcs/cutting/order-progress'

const productionOrderId = 'po-14671'

const cutPieceReleasePageSource = readFileSync(
  resolve(process.cwd(), 'src/pages/process-factory/cutting/cut-piece-release.ts'),
  'utf8',
)
const cutOrdersPageSource = readFileSync(
  resolve(process.cwd(), 'src/pages/process-factory/cutting/cut-orders.ts'),
  'utf8',
)
const fcsHandlersSource = readFileSync(
  resolve(process.cwd(), 'src/main-handlers/fcs-handlers.ts'),
  'utf8',
)
assert.match(cutPieceReleasePageSource, /\/\/ @page-pattern: list/, '裁片放行管理必须声明标准列表页模式')
assert.match(cutPieceReleasePageSource, /renderStandardListPage/, '裁片放行管理必须使用标准列表页骨架')
assert.match(cutPieceReleasePageSource, /renderStandardListTable/, '裁片放行管理必须使用标准列表表格')
assert.match(cutPieceReleasePageSource, /renderTablePagination/, '裁片放行管理必须使用标准表格分页')
assert.match(
  cutPieceReleasePageSource,
  /higood:list-page:\/fcs\/craft\/cutting\/cut-piece-release/,
  '裁片放行管理必须使用路由级列表偏好存储键',
)
assert.match(cutOrdersPageSource, /getCutOrderReleaseImpactSummary\(row\.cutOrderNo\)/, '关闭页必须读取放行仓储影响摘要')
assert.match(cutOrdersPageSource, /activeSpreadingOrderNos\.length/, '关闭页必须按进行中铺布单阻断关闭')
assert.match(cutOrdersPageSource, /eventId: reopenRecord\.reopenRecordId[\s\S]*status: '持续更新'/, '重开成功后必须用现有重开记录稳定 ID 恢复放行来源')
assert.match(cutOrdersPageSource, /eventId: closeRecord\.closeRecordId[\s\S]*status: '已冻结'/, '关闭成功后必须用现有关闭记录稳定 ID 冻结放行来源')
assert.match(
  cutPieceReleasePageSource,
  /data-cut-piece-release-action="open-matrix"/,
  '裁片放行管理必须提供打开生产单矩阵的操作入口',
)
assert.match(cutPieceReleasePageSource, /data-testid="cut-piece-release-color-matrix"/, '必须展示颜色物料尺码矩阵')
assert.match(cutPieceReleasePageSource, /data-testid="cell-\$\{escapeHtml\(group\.garmentColor\)\}-\$\{escapeHtml\(size\)\}-\$\{escapeHtml\(materialId\)\}"/, '矩阵单元格必须提供稳定测试与交互标识')
assert.match(cutPieceReleasePageSource, /data-testid="candidate-\$\{escapeHtml\(group\.garmentColor\)\}-\$\{escapeHtml\(size\)\}-\$\{escapeHtml\(materialId\)\}"/, '目标候选必须提供稳定标识')
assert.match(cutPieceReleasePageSource, /confirmCutPieceReleaseTarget\(/, '保存目标必须调用公开仓储 API')
assert.match(cutPieceReleasePageSource, /currentMatrixVersion/, '页面必须单独维护公开仓储当前矩阵版本')
assert.match(cutPieceReleasePageSource, /targetBasisVersion/, '页面必须单独维护目标依据版本')
assert.match(cutPieceReleasePageSource, /目标依据版本 V/, '目标确认摘要必须明确展示目标依据版本')
assert.match(cutPieceReleasePageSource, /resetTransientPageState\(\)/, 'SPA 重新进入页面必须重置瞬态操作状态')
assert.match(cutPieceReleasePageSource, /data-testid="cut-piece-release-cell-drawer"/, '裁片部位计算必须在单元格抽屉展示')
assert.match(cutPieceReleasePageSource, /data-testid="cut-piece-release-history-drawer"/, '矩阵历史必须在分页抽屉展示')
assert.match(cutPieceReleasePageSource, /role="dialog" aria-modal="true" aria-labelledby="cut-piece-release-cell-drawer-title"/, '部位抽屉必须提供对话框语义')
assert.match(cutPieceReleasePageSource, /role="dialog" aria-modal="true" aria-labelledby="cut-piece-release-history-drawer-title"/, '历史抽屉必须提供对话框语义')
assert.doesNotMatch(cutPieceReleasePageSource, /input[^>]+type="number"/, '目标选择禁止任意数字输入')
assert.equal(
  fcsHandlersSource.match(/handleCraftCuttingCutPieceReleaseEvent\(target, event\)/g)?.length,
  1,
  '裁片放行处理器只能由专属路由分支显式消费事件，禁止在通用 FCS OR 链重复调用',
)
assert.match(
  fcsHandlersSource,
  /handleCraftCuttingCutPieceReleaseEvent\(fakeButton\)/,
  'Escape 关闭裁片放行浮层必须保留直接调用',
)

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
recordCutOrderReleaseStatusChange({ eventId: 'freeze-noop-b', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '已冻结', occurredAt: '2026-06-05 08:00:00', operator: '裁床主管 王敏', reason: '初始已冻结无需重复冻结' })
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, statusNoopInitialVersionCount + 1, '已接收的 no-op 事件重放不得新增版本')
assert.deepEqual(getCutPieceReleaseMatrix(productionOrderId)!.colorGroups[0].materialRows.find((row) => row.materialId === 'B')!.cells.map((cell) => cell.sourceStatus), ['持续更新', '持续更新', '持续更新'], '重放旧 no-op 冻结事件不得覆盖后续恢复状态')
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
recordCutOrderReleaseStatusChange({ eventId: 'restore-b-for-mismatch', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '持续更新', occurredAt: '2026-06-05 12:30:00', operator: '裁床主管 王敏', reason: '恢复 B 以校验冲突定位' })
const mismatchVersionCount = listCutPieceReleaseMatrixVersions(productionOrderId).length
recordCutOrderReleaseStatusChange({ eventId: 'id-no-mismatch', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-A', status: '已冻结', occurredAt: '2026-06-05 12:31:00', operator: '裁床主管 王敏', reason: 'ID 与单号不一致' })
const matrixAfterMismatch = getCutPieceReleaseMatrix(productionOrderId)!
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, mismatchVersionCount, 'ID 与单号不一致不得生成版本')
assert.deepEqual(matrixAfterMismatch.colorGroups[0].materialRows.find((row) => row.materialId === 'B')!.cells.map((cell) => cell.sourceStatus), ['持续更新', '持续更新', '持续更新'], 'ID 与单号不一致不得更新 B')
assert.deepEqual(matrixAfterMismatch.colorGroups[0].materialRows.find((row) => row.materialId === 'A')!.cells.map((cell) => cell.sourceStatus), ['持续更新', '持续更新', '持续更新'], 'ID 与单号不一致不得误更新 A')
recordCutOrderReleaseStatusChange({ eventId: '', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '已冻结', occurredAt: '2026-06-05 12:32:00', operator: '裁床主管 王敏', reason: '空事件 ID' })
recordCutOrderReleaseStatusChange({ eventId: '   ', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '已冻结', occurredAt: '2026-06-05 12:32:00', operator: '裁床主管 王敏', reason: '空白事件 ID' })
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, mismatchVersionCount, '空或纯空白 eventId 不得改变版本')
recordCutOrderReleaseStatusChange({ eventId: ' normalized-freeze-b ', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '已冻结', occurredAt: '2026-06-05 12:33:00', operator: '裁床主管 王敏', reason: '合法冻结' })
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, mismatchVersionCount + 1, '合法事件仍必须工作')
recordCutOrderReleaseStatusChange({ eventId: 'restore-b-after-normalized', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '持续更新', occurredAt: '2026-06-05 12:34:00', operator: '裁床主管 王敏', reason: '恢复 B' })
recordCutOrderReleaseStatusChange({ eventId: 'normalized-freeze-b', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '已冻结', occurredAt: '2026-06-05 12:33:00', operator: '裁床主管 王敏', reason: '合法冻结' })
assert.deepEqual(getCutPieceReleaseMatrix(productionOrderId)!.colorGroups[0].materialRows.find((row) => row.materialId === 'B')!.cells.map((cell) => cell.sourceStatus), ['持续更新', '持续更新', '持续更新'], 'trim 后相同 eventId 必须去重')

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

resetCutPieceReleasePrototypeStoreForTesting()
const releaseImpact = getCutOrderReleaseImpactSummary('cut-14671-b')
assert.equal(releaseImpact?.cutOrderNo, 'CUT14671-B')
assert.deepEqual(releaseImpact?.affectedCells.map((cell) => [cell.garmentColor, cell.size, cell.materialId, cell.availableGarmentQty]), [
  ['Black', 'L', 'B', 350],
  ['Black', 'M', 'B', 200],
  ['Black', 'XL', 'B', 500],
])
assert.deepEqual(releaseImpact?.activeSpreadingOrderNos, [], '冻结前影响摘要须明确返回进行中铺布单')

recordCutOrderReleaseStatusChange({ eventId: 'complete-b-release', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '持续更新', occurredAt: '2026-06-06 08:00:00', operator: '裁床主管 王敏', reason: '完成前恢复' })
const versionBeforeComplete = listCutPieceReleaseMatrixVersions(productionOrderId).length
recordCutOrderReleaseStatusChange({ eventId: 'complete-b-release-freeze', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '已冻结', occurredAt: '2026-06-06 09:00:00', operator: '裁床主管 王敏', reason: '已完成，数据已冻结' })
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, versionBeforeComplete + 1)
assert.equal(getCutPieceReleaseRecord('cpr-po-14671')?.sourceStates.find((state) => state.cutOrderId === 'cut-14671-b')?.reason, '已完成，数据已冻结')

const versionBeforeLate = listCutPieceReleaseMatrixVersions(productionOrderId).length
const matrixBeforeLate = getCutPieceReleaseMatrix(productionOrderId)
recordLateCutPieceReleaseEvent({
  eventId: 'late-spread-b-1',
  productionOrderId,
  cutOrderId: 'cut-14671-b',
  cutOrderNo: 'CUT14671-B',
  spreadingOrderNo: 'PB-LATE-14671-01',
  arrivedAt: '2026-06-06 10:00:00',
  reason: '裁片单已关闭，铺布完成数据未计入当前矩阵',
  facts: [{ garmentColor: 'Black', size: 'M', materialId: 'B', actualPieceQty: 20 }],
})
recordLateCutPieceReleaseEvent({
  eventId: ' late-spread-b-1 ',
  productionOrderId,
  cutOrderId: 'cut-14671-b',
  cutOrderNo: 'CUT14671-B',
  spreadingOrderNo: 'PB-LATE-14671-01',
  arrivedAt: '2026-06-06 10:00:00',
  reason: '重复送达',
  facts: [{ garmentColor: 'Black', size: 'M', materialId: 'B', actualPieceQty: 20 }],
})
assert.equal(listLateCutPieceReleaseEvents(productionOrderId).length, 1, '迟到铺布事件必须按稳定 eventId 幂等')
assert.equal(listCutPieceReleaseMatrixVersions(productionOrderId).length, versionBeforeLate, '迟到铺布不能生成有效矩阵版本')
assert.deepEqual(getCutPieceReleaseMatrix(productionOrderId), matrixBeforeLate, '迟到铺布不能改变当前数量')
assert.equal(getCutPieceReleaseRecord('cpr-po-14671')?.lateEventCount, 1)
recordCutOrderReleaseStatusChange({ eventId: 'reopen-after-late', cutOrderId: 'cut-14671-b', cutOrderNo: 'CUT14671-B', status: '持续更新', occurredAt: '2026-06-06 11:00:00', operator: '裁床主管 王敏', reason: '重新打开，恢复持续更新' })
assert.equal(listLateCutPieceReleaseEvents(productionOrderId)[0].status, '待处理', '重新打开不能自动吸收既有迟到事实')
assert.deepEqual(getCutPieceReleaseMatrix(productionOrderId)?.colorGroups[0].completeKitBySize, matrixBeforeLate?.colorGroups[0].completeKitBySize, '重新打开只恢复更新资格，不自动吸收迟到事实')
assert.deepEqual(getCutPieceReleaseMatrix(productionOrderId)?.colorGroups[0].materialRows.map((row) => row.cells.map((cell) => cell.availableGarmentQty)), matrixBeforeLate?.colorGroups[0].materialRows.map((row) => row.cells.map((cell) => cell.availableGarmentQty)), '重新打开不能把既有迟到事实加入物料可做数')

class MemoryStorage {
  private values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
}
const lifecycleStorage = new MemoryStorage()
const closeIdentity1 = createNextCutOrderCloseRecordIdentity('cut-cycle', 'CUT-CYCLE', lifecycleStorage)
const closeBase = {
  cutOrderId: 'cut-cycle', cutOrderNo: 'CUT-CYCLE', productionOrderId, productionOrderNo: 'PO14671', closeReasonCode: 'OTHER' as const,
  closeReasonText: '其他原因', closeDescription: '第一轮关闭', closedAt: '2026-06-07 08:00:00', closedBy: '主管', closeSourceType: '人工关闭' as const,
  linkedLedgerEventIds: [], ledgerSnapshotBeforeClose: { requiredMaterialQty: 0, transferWarehouseAllocatedQty: 0, cuttingClaimedQty: 0, spreadingConsumedQty: 0, availableQty: 0, unit: '米' },
  openImpactItems: [], remainingInventorySummary: '0 片', pendingSpecialCraftSummary: '0 片', pendingHandoverSummary: '0 条', createdAt: '2026-06-07 08:00:00', createdBy: '主管',
}
upsertStoredCutOrderCloseRecord({ ...closeBase, ...closeIdentity1 } as CutOrderCloseRecord, lifecycleStorage)
upsertStoredCutOrderCloseRecord({ ...closeBase, ...closeIdentity1 } as CutOrderCloseRecord, lifecycleStorage)
assert.equal(listStoredCutOrderCloseRecords(lifecycleStorage).length, 1, '同一关闭业务记录重放必须幂等')
const reopenIdentity1 = createNextCutOrderReopenRecordIdentity('cut-cycle', 'CUT-CYCLE', lifecycleStorage)
const reopenBase = { cutOrderId: 'cut-cycle', cutOrderNo: 'CUT-CYCLE', productionOrderId, productionOrderNo: 'PO14671', reopenedAt: '2026-06-07 09:00:00', reopenedBy: '主管', reopenReason: '第一轮重开', previousCloseRecordNo: closeIdentity1.closeRecordNo, createdAt: '2026-06-07 09:00:00', createdBy: '主管' }
upsertStoredCutOrderReopenRecord({ ...reopenBase, ...reopenIdentity1 } as CutOrderReopenRecord, lifecycleStorage)
const closeIdentity2 = createNextCutOrderCloseRecordIdentity('cut-cycle', 'CUT-CYCLE', lifecycleStorage)
assert.notEqual(closeIdentity2.closeRecordId, closeIdentity1.closeRecordId, '第二轮关闭必须生成新的业务记录 ID')
upsertStoredCutOrderCloseRecord({ ...closeBase, ...closeIdentity2, closeDescription: '第二轮关闭', closedAt: '2026-06-07 10:00:00', createdAt: '2026-06-07 10:00:00' } as CutOrderCloseRecord, lifecycleStorage)
const reopenIdentity2 = createNextCutOrderReopenRecordIdentity('cut-cycle', 'CUT-CYCLE', lifecycleStorage)
assert.notEqual(reopenIdentity2.reopenRecordId, reopenIdentity1.reopenRecordId, '第二轮重开必须生成新的业务记录 ID')
upsertStoredCutOrderReopenRecord({ ...reopenBase, ...reopenIdentity2, reopenedAt: '2026-06-07 11:00:00', createdAt: '2026-06-07 11:00:00', previousCloseRecordNo: closeIdentity2.closeRecordNo } as CutOrderReopenRecord, lifecycleStorage)
assert.equal(listStoredCutOrderCloseRecords(lifecycleStorage).length, 2, '关闭历史必须保留两轮记录')
assert.equal(listStoredCutOrderReopenRecords(lifecycleStorage).length, 2, '重开历史必须保留两轮记录')

const releaseDemoProgress = cuttingOrderProgressRecords.find((record) =>
  record.materialLines.some((line) => line.cutOrderId === 'cut-14671-b' && line.cutOrderNo === 'CUT14671-B'),
)
assert.ok(releaseDemoProgress, 'PO14671 的裁片单 B 必须存在同 ID 阶段投影')
assert.equal(releaseDemoProgress.productionOrderId, 'po-14671', '阶段投影必须归属同一生产单 ID')
assert.equal(releaseDemoProgress.productionOrderNo, 'PO14671', '阶段投影必须归属同一生产单号')
assert.equal(releaseDemoProgress.spuCode, 'ASYSA26060310', '阶段投影必须归属同一款式')
const releaseDemoProgressA = cuttingOrderProgressRecords.find((record) =>
  record.materialLines.some((line) => line.cutOrderId === 'cut-14671-a' && line.cutOrderNo === 'CUT14671-A'),
)
assert.ok(releaseDemoProgressA, '存在进行中铺布的裁片单 A 也必须使用同一真实 ID 阶段投影')
assert.ok(getCutPieceReleaseRecord('cpr-po-14671')?.sourceStates.some((state) => state.cutOrderId === 'cut-14671-a' && state.cutOrderNo === 'CUT14671-A'), '裁片单 A 的放行来源与阶段投影必须使用同一 ID')
assert.ok(updateCuttingOrderProgressWebStage('cut-14671-b', { cuttingStage: '已关闭', operatedAt: '2026-06-07 12:00:00' }), '存在同 ID 投影时关闭必须返回成功记录')
assert.equal(releaseDemoProgress.cuttingStage, '已关闭', '关闭必须实际更新阶段投影')
assert.ok(updateCuttingOrderProgressWebStage('cut-14671-b', { cuttingStage: '已开工', operatedAt: '2026-06-07 13:00:00' }), '存在同 ID 投影时重开必须返回成功记录')
assert.equal(releaseDemoProgress.cuttingStage, '已开工', '重开必须实际恢复阶段投影')
assert.equal(releaseDemoProgress.closedAt, '', '重开后阶段投影不得保留关闭时间')
assert.equal(releaseDemoProgress.closeReason, '', '重开后阶段投影不得继续表现为已关闭')
assert.equal(updateCuttingOrderProgressWebStage('cut-not-found', { cuttingStage: '已关闭' }), undefined, '不存在的裁片单 ID 必须明确返回空值')

console.log('cut piece release matrix check passed')
