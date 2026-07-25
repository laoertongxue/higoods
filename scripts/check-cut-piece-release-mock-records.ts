import assert from 'node:assert/strict'

import {
  getCutPieceReleaseSummaryForProductionOrder,
  listCutPieceReleaseAvailableQtyVersions,
  listCutPieceReleaseRecords,
} from '../src/data/fcs/cut-piece-release.ts'

const records = listCutPieceReleaseRecords()
const byStatus = (status: string) => records.filter((record) => record.releaseAvailableStatus === status)

assert.ok(records.length >= 7, '裁片放行管理列表必须至少展示 7 条 mock 数据，以覆盖完整放行状态与异常场景')

const productionOrderNos = new Set(records.map((record) => record.productionOrderNo))
assert.equal(productionOrderNos.size, records.length, '裁片放行 mock 生产单号不能重复')
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
assert.ok(
  records.some((record) => record.releaseAvailableStatus === '待裁床确认' && record.totalTargetQty > 0),
  '待裁床确认 mock 必须已维护目标数量，不能显示目标总数为 0',
)
assert.ok(
  records.some((record) => record.releaseAvailableStatus === '风险放行' && record.riskReleaseQty > 0),
  '裁片放行 mock 必须覆盖风险放行状态，并有风险放行数量',
)
assert.ok(
  records.some((record) => record.releaseAvailableStatus === '暂不放行' && record.latestReleaseVersion > 0 && record.releaseConfirmQty === 0),
  '裁片放行 mock 必须覆盖暂不放行状态，并来自真实放行确认版本',
)
assert.ok(
  records.some((record) => record.releaseAvailableStatus === '确认后需复核' && record.latestReleaseVersion > 0),
  '裁片放行 mock 必须覆盖已有放行版本后裁片事实变化的确认后需复核状态',
)
assert.ok(
  records.some((record) => record.latestReleaseVersion >= 2),
  '裁片放行 mock 必须覆盖至少 2 个放行确认版本的版本日志场景',
)

records.forEach((record) => {
  const versions = listCutPieceReleaseAvailableQtyVersions(record.productionOrderId)
  const latestVersion = versions.find((version) => version.isLatestEffective) ?? null
  const summary = getCutPieceReleaseSummaryForProductionOrder(record.productionOrderId)
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
  assert.equal(summary?.releaseAvailableStatus, record.releaseAvailableStatus, `${record.productionOrderNo} 列表与 PPIC 摘要放行状态必须一致`)
  assert.equal(summary?.ppicAvailableDispatchQty, record.releaseConfirmQty, `${record.productionOrderNo} PPIC 可派总量必须等于裁床确认可做放行数量`)
  assert.equal(summary?.totalTargetQty, record.totalTargetQty, `${record.productionOrderNo} 列表与 PPIC 摘要目标数量必须一致`)
  if (latestVersion) {
    assert.ok(latestVersion.totalReleaseConfirmQty <= latestVersion.totalTargetQty, `${record.productionOrderNo} 可做放行数量不能超过目标数量`)
    assert.equal(latestVersion.releaseStatus, record.releaseAvailableStatus, `${record.productionOrderNo} 最新版本状态必须同步到列表状态`)
  }
  if (record.releaseAvailableStatus === '风险放行') {
    assert.ok(latestVersion?.riskReason.trim(), `${record.productionOrderNo} 风险放行必须填写风险原因`)
    assert.ok(record.riskReleaseQty > 0, `${record.productionOrderNo} 风险放行必须有风险数量`)
    assert.ok(record.releaseConfirmQty <= record.totalTargetQty, `${record.productionOrderNo} 风险放行也不能超过目标数量`)
  }
  if (record.releaseAvailableStatus === '按齐套放行') {
    assert.ok(record.releaseConfirmQty > 0, `${record.productionOrderNo} 按齐套放行必须有可派数量`)
    assert.equal(record.riskReleaseQty, 0, `${record.productionOrderNo} 按齐套放行不能有风险数量`)
  }
  if (record.releaseAvailableStatus === '暂不放行') {
    assert.ok(record.totalTargetQty > 0, `${record.productionOrderNo} 暂不放行必须先维护目标`)
    assert.equal(record.releaseConfirmQty, 0, `${record.productionOrderNo} 暂不放行可做放行数量必须为 0`)
    assert.ok(record.latestReleaseVersion > 0, `${record.productionOrderNo} 暂不放行必须来自确认版本`)
  }
  if (record.releaseAvailableStatus === '确认后需复核') {
    assert.equal(record.targetStatus, '目标后数据已变化', `${record.productionOrderNo} 确认后需复核必须来自目标后数据变化`)
    assert.ok(record.latestReleaseVersion > 0, `${record.productionOrderNo} 确认后需复核必须已有放行版本`)
  }
  if (record.releaseAvailableStatus === '待裁床确认') {
    assert.ok(record.totalTargetQty > 0, `${record.productionOrderNo} 待裁床确认必须已维护目标`)
    assert.equal(record.latestReleaseVersion, 0, `${record.productionOrderNo} 待裁床确认不能已有放行版本`)
  }
  if (record.releaseAvailableStatus === '待维护目标') {
    assert.equal(record.latestReleaseVersion, 0, `${record.productionOrderNo} 待维护目标不能已有放行版本`)
  }
  record.skuLines.forEach((line) => {
    assert.ok(line.colorName && line.sizeCode, `${record.productionOrderNo} 的 SKU 行必须有颜色和尺码`)
    assert.ok(line.demandQty >= 0, `${record.productionOrderNo} 的 SKU 需求数不能为负数`)
    assert.ok(line.completeKitQty >= 0, `${record.productionOrderNo} 的齐套数不能为负数`)
    assert.ok(line.releaseQty >= 0, `${record.productionOrderNo} 的放行数不能为负数`)
    assert.ok(typeof line.releaseConfirmQty === 'number' && line.releaseConfirmQty >= 0, `${record.productionOrderNo} 的 SKU 行必须有合法 releaseConfirmQty`)
    assert.ok(typeof line.riskReleaseQty === 'number' && line.riskReleaseQty >= 0, `${record.productionOrderNo} 的 SKU 行必须有合法 riskReleaseQty`)
  })
})

assert.equal(byStatus('按齐套放行').length, 1, '按齐套放行场景应保持 1 条，便于演示稳定基准')
assert.equal(byStatus('风险放行').length, 1, '风险放行场景应保持 1 条，便于演示风险原因和版本变化')
assert.equal(byStatus('暂不放行').length, 1, '暂不放行场景应保持 1 条，便于演示 PPIC 阻断')
assert.equal(byStatus('确认后需复核').length, 1, '确认后需复核场景应保持 1 条，便于演示事实变化后复核')

console.log('[check-cut-piece-release-mock-records] 裁片放行管理 mock 数据检查通过')
