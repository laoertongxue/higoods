import assert from 'node:assert/strict'
import {
  confirmCutPieceReleaseAvailableQty,
  getCutPieceReleaseSummaryForProductionOrder,
  listCutPieceReleaseAvailableQtyVersions,
  calculateMissingPieceQty,
  resetCutPieceReleasePrototypeStoreForTesting,
} from '../src/data/fcs/cut-piece-release.ts'

resetCutPieceReleasePrototypeStoreForTesting()
const productionOrderId = 'po-14671'

// 1. 正常确认
const first = confirmCutPieceReleaseAvailableQty({
  productionOrderId,
  basisMatrixVersion: 9,
  basisTargetVersion: 9,
  releaseQtyByColorSize: {
    'Black::M': 200, 'Black::L': 350, 'Black::XL': 500,
    'White::M': 180, 'White::L': 270, 'White::XL': 330,
    'Navy::M': 170, 'Navy::L': 260, 'Navy::XL': 340,
    'Red::M': 150, 'Red::L': 235, 'Red::XL': 300,
  },
  riskReason: '',
  confirmedBy: '裁床主管 王敏',
  confirmedAt: '2026-07-25 10:20:00',
})
assert.equal(first.ok, true, '确认放行必须成功')
assert.ok(first.version, '必须返回版本对象')
assert.equal(first.version.totalReleaseConfirmQty, 3285, '汇总可做数量')
assert.equal(first.version.isLatestEffective, true, '标记为最新有效')

// 2. 版本日志
const versions = listCutPieceReleaseAvailableQtyVersions(productionOrderId)
assert.equal(versions.length, 2, '必须记录版本（bootstrap V1 + 本次确认）')

// 3. PPIC 摘要
const summary = getCutPieceReleaseSummaryForProductionOrder(productionOrderId)
assert.ok(summary, 'PPIC必须能读摘要')
assert.equal(summary.ppicAvailableDispatchQty, 3285, 'PPIC可派总量')

// 4. 版本日志差异（超齐套但未超目标，触发风险放行）
const riskyValues = {
  'Black::M': 205, 'Black::L': 350, 'Black::XL': 510,
  'White::M': 183, 'White::L': 275, 'White::XL': 335,
  'Navy::M': 170, 'Navy::L': 260, 'Navy::XL': 340,
  'Red::M': 160, 'Red::L': 245, 'Red::XL': 315,
}
const second = confirmCutPieceReleaseAvailableQty({
  productionOrderId,
  basisMatrixVersion: 9,
  basisTargetVersion: 9,
  releaseQtyByColorSize: riskyValues,
  riskReason: '袖口裁片现场已裁未点收，裁床主管确认可先发车缝。',
  confirmedBy: '裁床主管 王敏',
  confirmedAt: '2026-07-25 11:00:00',
})
assert.equal(second.ok, true)
assert.ok(second.version.totalRiskReleaseQty > 0, '必须计算风险放行')
assert.equal(second.version.riskReason, '袖口裁片现场已裁未点收，裁床主管确认可先发车缝。')
assert.ok(second.version.beforeTotalReleaseConfirmQty === 3285, '记录上版本差异')
const versionsAfterSecond = listCutPieceReleaseAvailableQtyVersions(productionOrderId)
assert.equal(versionsAfterSecond.length, 3, '版本日志递增')

// 5. 不可超目标
const over = confirmCutPieceReleaseAvailableQty({
  productionOrderId, basisMatrixVersion: 9, basisTargetVersion: 9,
  releaseQtyByColorSize: {
    'Black::M': 300, 'Black::L': 350, 'Black::XL': 500,
    'White::M': 180, 'White::L': 270, 'White::XL': 330,
    'Navy::M': 170, 'Navy::L': 260, 'Navy::XL': 340,
    'Red::M': 150, 'Red::L': 235, 'Red::XL': 300,
  },
  riskReason: '', confirmedBy: '裁床主管', confirmedAt: '2026-07-25',
})
assert.equal(over.ok, false)
assert.match(over.message || '', /不能超过目标数量/)

// 6. 风险原因必填
const noReason = confirmCutPieceReleaseAvailableQty({
  productionOrderId, basisMatrixVersion: 9, basisTargetVersion: 9,
  releaseQtyByColorSize: riskyValues,
  riskReason: '', confirmedBy: '裁床主管', confirmedAt: '2026-07-25',
})
assert.equal(noReason.ok, false)
assert.match(noReason.message || '', /风险原因/)

// 7. missingPieceQty
const shortages = calculateMissingPieceQty(productionOrderId)
assert.ok(shortages.length >= 0, '必须返回补料数据')

// 8. reset 必须清空
resetCutPieceReleasePrototypeStoreForTesting()
const afterReset = listCutPieceReleaseAvailableQtyVersions(productionOrderId)
assert.equal(afterReset.length, 1, 'reset 后 bootstrap 恢复 1 条版本')

console.log('[check-cut-piece-release-available-qty] 裁床放行确认版本检查通过')
