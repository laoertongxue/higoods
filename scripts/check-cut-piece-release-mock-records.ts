import assert from 'node:assert/strict'

import { listCutPieceReleaseRecords } from '../src/data/fcs/cut-piece-release.ts'

const records = listCutPieceReleaseRecords()

assert.equal(records.length, 5, '裁片放行管理列表必须最终展示 5 条 mock 数据')

const productionOrderNos = new Set(records.map((record) => record.productionOrderNo))
assert.equal(productionOrderNos.size, 5, '裁片放行 mock 生产单号不能重复')
assert.ok(productionOrderNos.has('PO14671'), '裁片放行 mock 必须保留原有 PO14671 样例')

assert.ok(
  records.some((record) => record.matrixStatus === '可计算' && record.targetStatus === '已确认' && record.releaseQty > 0),
  '裁片放行 mock 必须覆盖可计算且已确认的稳定放行场景',
)
assert.ok(
  records.some((record) => record.matrixStatus === '可计算' && record.targetStatus === '待确认'),
  '裁片放行 mock 必须覆盖可计算但待主管确认的场景',
)
assert.ok(
  records.some((record) => record.matrixStatus === '可计算' && record.targetStatus === '目标后数据已变化'),
  '裁片放行 mock 必须覆盖目标确认后又有新裁片事实的复核场景',
)
assert.ok(
  records.some((record) => record.matrixStatus === '数据不完整'),
  '裁片放行 mock 必须覆盖 BOM 或用量配置不完整导致无法直接计算的场景',
)
assert.ok(
  records.some((record) => record.matrixStatus === '暂无有效裁片'),
  '裁片放行 mock 必须覆盖铺布裁片事实暂未回传的边界场景',
)

// 放行确认版本领域新增字段
assert.ok(
  records.some((record) => record.releaseConfirmQty > 0),
  '裁片放行 mock 必须覆盖 releaseConfirmQty > 0 的可做放行场景',
)
assert.ok(
  records.some((record) => record.releaseConfirmQty === 0),
  '裁片放行 mock 必须覆盖 releaseConfirmQty === 0 的未确认场景',
)
assert.ok(
  records.some((record) => record.releaseAvailableStatus === '按齐套放行'),
  '裁片放行 mock 必须覆盖按齐套放行状态',
)
assert.ok(
  records.some((record) => record.releaseAvailableStatus === '待维护目标'),
  '裁片放行 mock 必须覆盖待维护目标状态',
)
assert.ok(
  records.some((record) => record.releaseAvailableStatus === '待裁床确认'),
  '裁片放行 mock 必须覆盖待裁床确认状态',
)

records.forEach((record) => {
  assert.ok(record.recordId && record.recordNo, `${record.productionOrderNo} 必须有稳定放行记录标识`)
  assert.ok(record.productionOrderId && record.productionOrderNo, `${record.recordNo} 必须关联生产单`)
  assert.ok(record.spuCode && record.spuName, `${record.productionOrderNo} 必须展示款式信息`)
  assert.ok(record.sourceCutOrderNos.length > 0, `${record.productionOrderNo} 必须关联至少一个裁片单号`)
  assert.ok(record.matrix.colorGroups.length > 0, `${record.productionOrderNo} 必须形成颜色尺码矩阵`)
  assert.ok(record.skuLines.length > 0, `${record.productionOrderNo} 必须形成 SKU 行`)
  assert.ok(typeof record.releaseConfirmQty === 'number' && record.releaseConfirmQty >= 0, `${record.productionOrderNo} 必须有合法 releaseConfirmQty`)
  assert.ok(typeof record.releaseAvailableStatus === 'string' && record.releaseAvailableStatus.length > 0, `${record.productionOrderNo} 必须有合法 releaseAvailableStatus`)
  assert.ok(typeof record.latestReleaseVersion === 'number', `${record.productionOrderNo} 必须有 latestReleaseVersion`)
  assert.ok(typeof record.riskReleaseQty === 'number' && record.riskReleaseQty >= 0, `${record.productionOrderNo} 必须有合法 riskReleaseQty`)
  assert.ok(typeof record.totalTargetQty === 'number' && record.totalTargetQty >= 0, `${record.productionOrderNo} 必须有合法 totalTargetQty`)
  record.skuLines.forEach((line) => {
    assert.ok(line.colorName && line.sizeCode, `${record.productionOrderNo} 的 SKU 行必须有颜色和尺码`)
    assert.ok(line.demandQty >= 0, `${record.productionOrderNo} 的 SKU 需求数不能为负数`)
    assert.ok(line.completeKitQty >= 0, `${record.productionOrderNo} 的齐套数不能为负数`)
    assert.ok(line.releaseQty >= 0, `${record.productionOrderNo} 的放行数不能为负数`)
    assert.ok(typeof line.releaseConfirmQty === 'number' && line.releaseConfirmQty >= 0, `${record.productionOrderNo} 的 SKU 行必须有合法 releaseConfirmQty`)
    assert.ok(typeof line.riskReleaseQty === 'number' && line.riskReleaseQty >= 0, `${record.productionOrderNo} 的 SKU 行必须有合法 riskReleaseQty`)
  })
})

console.log('[check-cut-piece-release-mock-records] 裁片放行管理 mock 数据检查通过')
