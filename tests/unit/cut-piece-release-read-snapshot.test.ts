import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getCutPieceReleaseMatrix, setGeneratedCutReleaseReader, withCutPieceReleaseReadSnapshot } from '../../src/data/fcs/cut-piece-release.ts'

const productionOrderId = 'PO-READ-SNAPSHOT-H12'
let quantity = 12
function source() {
  return [{
    input: { productionOrderId, productionOrderNo: productionOrderId, spuCode: 'SPU-H12', planQtyByColorSize: { 黑: { M: 100 } },
      requirements: [{ materialId: 'MAT-H12', materialName: '主料', partId: 'FRONT', partName: '前片', piecesPerGarment: 1, garmentColor: '黑', size: 'M' }],
      facts: [{ factId: 'FACT-H12', sourceEventId: 'EVENT-H12', productionOrderId, cutOrderId: 'CUT-H12', cutOrderNo: 'CUT-H12', garmentColor: '黑', size: 'M', materialId: 'MAT-H12', partId: 'FRONT', actualPieceQty: quantity, physicalPieceQty: quantity, direction: '正向', sourceStatus: '持续更新', occurredAt: '2026-10-15T01:00:00Z' }], factsComplete: true },
    sources: [{ productionOrderId, productionOrderNo: productionOrderId, cutOrderId: 'CUT-H12', cutOrderNo: 'CUT-H12', styleName: '读取测试款', materialSku: 'MAT-H12', skuScopeLines: [{ color: '黑', size: 'M', skuCode: 'SKU-H12' }] }],
    latestAt: '2026-10-15T01:00:00Z', operator: '仓管',
  }] as ReturnType<Parameters<typeof setGeneratedCutReleaseReader>[0]>
}
const readQuantity = () => getCutPieceReleaseMatrix(productionOrderId)!.colorGroups[0].completeKitBySize.M

test('H12 同次读取的实际裁片数量一致，退出后下一动作读取新产出', () => {
  setGeneratedCutReleaseReader(source)
  try {
    withCutPieceReleaseReadSnapshot(() => {
      assert.equal(readQuantity(), 12)
      quantity = 23
      assert.equal(withCutPieceReleaseReadSnapshot(readQuantity), 12)
    }, false)
    assert.equal(withCutPieceReleaseReadSnapshot(readQuantity, false), 23)
  } finally { setGeneratedCutReleaseReader(() => []) }
})

test('H12 延迟读取不提前抛错；来源失败后同作用域重试仍阻断，恢复后可重新读取', () => {
  let failures = 0
  setGeneratedCutReleaseReader(() => { failures++; throw new Error('裁片来源不可读') })
  try {
    withCutPieceReleaseReadSnapshot(() => {
      assert.equal(failures, 0)
      assert.throws(() => withCutPieceReleaseReadSnapshot(readQuantity), /裁片来源不可读/)
      assert.throws(() => withCutPieceReleaseReadSnapshot(readQuantity), /裁片来源不可读/)
      assert.equal(failures, 2)
      quantity = 34
      setGeneratedCutReleaseReader(source)
      assert.equal(withCutPieceReleaseReadSnapshot(readQuantity), 34)
    }, false)
    quantity = 45
    assert.equal(readQuantity(), 45)
  } finally { setGeneratedCutReleaseReader(() => []) }
})
