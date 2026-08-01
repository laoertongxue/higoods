import assert from 'node:assert/strict'

import {
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  updateEngineeringTaskRecord,
} from '../src/data/pcs-engineering-master-repository.ts'
import type { EngineeringTaskMaterialLine } from '../src/data/pcs-engineering-master-types.ts'
import {
  ensurePatternAssetForEngineeringMaterialLine,
} from '../src/data/pcs-pattern-library-archive-linkage.ts'
import { listPatternAssets, resetPatternLibraryStore } from '../src/data/pcs-pattern-library.ts'
import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  reviewEngineeringMaterialResults,
  submitEngineeringMaterialResults,
} from '../src/data/pcs-engineering-task-review.ts'

type PatternMaterialLine = EngineeringTaskMaterialLine & {
  productColor: string
  printProcess: string
}

function patternLine(materialLineId: string, materialSkuId: string, productColor: string): PatternMaterialLine {
  return {
    materialLineId,
    materialSkuId,
    materialName: `${productColor}印花面料`,
    materialType: '面料',
    requirementType: '印花',
    productColor,
    printProcess: '数码印花',
    status: '正常',
    resultFileIds: [`file://${materialLineId}.ai`],
    effectImageIds: [`img://${materialLineId}.png`],
    resultSubmittedBy: '花型团队A',
    resultSubmittedAt: '2026-08-01 09:00:00',
    reviewStatus: '待审核',
    reviewReason: '',
    reviewedBy: '',
    reviewedAt: '',
  }
}

resetStyleArchiveRepository()
resetEngineeringMasterRepository()
resetPatternLibraryStore()

const style = listStyleArchives()[0]
assert.ok(style, '应存在款式档案演示数据')
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserName: '跟单A',
}).masterOrderId)
const taskId = `${master.masterOrderId}-PATTERN_ARTWORK`

updateEngineeringTaskRecord(master.masterOrderId, taskId, (task) => {
  task.status = '待审核'
  task.startedAt = '2026-08-01 08:00:00'
  task.submittedAt = '2026-08-01 09:00:00'
  task.materialLines = [
    patternLine('PAT-ASSET-1', 'MAT-RED-001', '红色'),
    patternLine('PAT-ASSET-2', 'MAT-BLUE-002', '蓝色'),
  ]
})

reviewEngineeringMaterialResults({
  masterOrderId: master.masterOrderId,
  taskId,
  reviewerName: '买手A',
  reviewerRole: '买手',
  decisions: [
    { materialLineId: 'PAT-ASSET-1', decision: '通过', reason: '' },
    { materialLineId: 'PAT-ASSET-2', decision: '未通过', reason: '颜色偏暗' },
  ],
})

const assetsAfterFirstReview = listPatternAssets().filter((asset) =>
  asset.source_pattern_task_snapshot?.source_master_order_id === master.masterOrderId,
)
assert.equal(assetsAfterFirstReview.length, 1, '第一轮只为审核通过的物料行生成资产')
const redAsset = assetsAfterFirstReview[0]
assert.equal(redAsset.source_task_id, taskId)
assert.equal(redAsset.source_pattern_task_snapshot?.source_task_id, taskId)
assert.equal(redAsset.source_pattern_task_snapshot?.source_material_line_id, 'PAT-ASSET-1')
assert.equal(redAsset.source_pattern_task_snapshot?.material_sku, 'MAT-RED-001')
assert.equal(redAsset.source_pattern_task_snapshot?.product_color, '红色')
assert.equal(redAsset.source_pattern_task_snapshot?.process_type, '数码印花')
assert.deepEqual(redAsset.source_pattern_task_snapshot?.result_file_ids, ['file://PAT-ASSET-1.ai'])
assert.deepEqual(redAsset.source_pattern_task_snapshot?.effect_image_ids, ['img://PAT-ASSET-1.png'])
assert.equal(redAsset.source_pattern_task_snapshot?.buyer_review_status, '通过')
assert.equal(redAsset.source_pattern_task_snapshot?.buyer_reviewed_by, '买手A')
assert.ok(redAsset.source_pattern_task_snapshot?.buyer_reviewed_at, '花型资产必须保留买手审核时间')
assert.equal(redAsset.created_by, '买手A')
assert.equal(
  assetsAfterFirstReview.some((asset) => asset.source_pattern_task_snapshot?.source_material_line_id === 'PAT-ASSET-2'),
  false,
  '未通过物料行不得生成花型资产',
)

const storedAfterFirstReview = getEngineeringMasterOrderById(master.masterOrderId)
const storedTaskAfterFirstReview = storedAfterFirstReview?.tasks.find((task) => task.taskId === taskId)
const passedLine = storedTaskAfterFirstReview?.materialLines.find((line) => line.materialLineId === 'PAT-ASSET-1')
assert.ok(storedTaskAfterFirstReview && passedLine)
const retriedAsset = ensurePatternAssetForEngineeringMaterialLine({
  masterOrder: storedAfterFirstReview!,
  task: storedTaskAfterFirstReview!,
  line: passedLine!,
  reviewerName: '买手A',
  reviewedAt: passedLine!.reviewedAt,
  decision: '通过',
})
assert.equal(retriedAsset.id, redAsset.id, '重复写入必须返回同一条花型资产')
assert.equal(
  listPatternAssets().filter((asset) =>
    asset.source_pattern_task_snapshot?.source_master_order_id === master.masterOrderId,
  ).length,
  1,
  '重复审核或重试不得重复创建花型资产',
)

submitEngineeringMaterialResults({
  masterOrderId: master.masterOrderId,
  taskId,
  submittedBy: '花型团队A',
  results: [{
    materialLineId: 'PAT-ASSET-2',
    resultFileIds: ['file://PAT-ASSET-2-v2.ai'],
    effectImageIds: ['img://PAT-ASSET-2-v2.png'],
  }],
})
reviewEngineeringMaterialResults({
  masterOrderId: master.masterOrderId,
  taskId,
  reviewerName: '买手B',
  reviewerRole: '买手',
  decisions: [{ materialLineId: 'PAT-ASSET-2', decision: '通过', reason: '' }],
})

const completedAssets = listPatternAssets().filter((asset) =>
  asset.source_pattern_task_snapshot?.source_master_order_id === master.masterOrderId,
)
assert.equal(completedAssets.length, 2, '第二轮通过原失败行后应只新增该行资产')
assert.equal(new Set(completedAssets.map((asset) => asset.id)).size, 2, '两个通过物料行必须生成两条独立资产')
assert.equal(
  completedAssets.filter((asset) => asset.source_pattern_task_snapshot?.source_material_line_id === 'PAT-ASSET-1').length,
  1,
  '已锁定通过行进入返工轮次后不得重建资产',
)
const blueAsset = completedAssets.find((asset) => asset.source_pattern_task_snapshot?.source_material_line_id === 'PAT-ASSET-2')
assert.ok(blueAsset)
assert.equal(blueAsset.source_pattern_task_snapshot?.material_sku, 'MAT-BLUE-002')
assert.deepEqual(blueAsset.source_pattern_task_snapshot?.result_file_ids, ['file://PAT-ASSET-2-v2.ai'])
assert.deepEqual(blueAsset.source_pattern_task_snapshot?.effect_image_ids, ['img://PAT-ASSET-2-v2.png'])
assert.equal(blueAsset.created_by, '买手B')

console.log('pcs-engineering-pattern-assets.spec.ts PASS')
