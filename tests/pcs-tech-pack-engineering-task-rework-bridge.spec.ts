import assert from 'node:assert/strict'

import {
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  updateEngineeringTaskRecord,
} from '../src/data/pcs-engineering-master-repository.ts'
import { returnTechPackReviewByModules } from '../src/data/pcs-tech-pack-review.ts'
import {
  reviewEngineeringMaterialResults,
  submitEngineeringMaterialResults,
} from '../src/data/pcs-engineering-task-review.ts'
import {
  createTechnicalDataVersionDraft,
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
  listTechnicalDataVersions,
  resetTechnicalDataVersionRepository,
} from '../src/data/pcs-technical-data-version-repository.ts'
import type {
  TechnicalDataVersionRecord,
  TechnicalReviewNode,
  TechnicalReviewNodeKey,
} from '../src/data/pcs-technical-data-version-types.ts'
import { listStyleArchives } from '../src/data/pcs-style-archive-repository.ts'

function reviewNode(nodeKey: TechnicalReviewNodeKey): TechnicalReviewNode {
  const meta = nodeKey === 'BUYER'
    ? { nodeName: '买手审核' as const, role: '买手' as const, id: 'BUYER-001', name: '买手A' }
    : nodeKey === 'PATTERN_MAKER'
    ? { nodeName: '版师审核' as const, role: '版师' as const, id: 'PATTERN-001', name: '版师B' }
    : { nodeName: '跟单审核' as const, role: '跟单' as const, id: 'MERCH-001', name: '跟单C' }
  return {
    nodeKey,
    nodeName: meta.nodeName,
    status: nodeKey === 'MERCHANDISER' ? '审核中' : '审核-已通过',
    reviewerRole: meta.role,
    assignedReviewerId: meta.id,
    assignedReviewerName: meta.name,
    assignedReviewerRole: meta.role,
    assignedReviewerFeishuOpenId: `ou_${meta.id.toLowerCase()}`,
    assignedAt: '2026-08-02 09:00',
    assignedBy: '跟单C',
    reviewedBy: meta.name,
    reviewedAt: '2026-08-02 10:00',
    startedOpinion: '开始审核',
    opinion: '',
    diffSnapshotId: `DIFF-${nodeKey}`,
    diffStatus: '有差异',
    diffSummaryText: '存在变更',
    lastFeishuNotifyAt: '',
    lastFeishuNotifyStatus: '未发送',
    lastFeishuNotifyRecordId: '',
    todayFeishuNotifiedFlag: false,
    todayFeishuNotifyAt: '',
    feishuNotifyCount: 0,
  }
}

resetEngineeringMasterRepository()
const style = listStyleArchives()[0]
assert.ok(style)
const master = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style.styleId,
  styleCode: style.styleCode,
  merchandiserName: '跟单C',
}).masterOrderId)
const patternTaskId = `${master.masterOrderId}-PATTERN_ARTWORK`
updateEngineeringTaskRecord(master.masterOrderId, patternTaskId, (task) => {
  task.status = '已完成'
  task.startedAt = '2026-08-02 08:00'
  task.submittedAt = '2026-08-02 09:00'
  task.firstCompletedAt = '2026-08-02 10:00'
  task.effectiveCompletedAt = '2026-08-02 10:00'
  task.materialLines = [{
    materialLineId: 'PATTERN-LINE-1',
    materialSkuId: 'MAT-PATTERN-1',
    materialName: '印花面料',
    materialType: '面料',
    requirementType: '印花',
    status: '正常',
    resultFileIds: ['file://pattern-v1.ai'],
    effectImageIds: ['image://pattern-v1'],
    resultSubmittedBy: '花型团队',
    resultSubmittedAt: '2026-08-02 09:00',
    reviewStatus: '通过',
    reviewReason: '',
    reviewedBy: '买手A',
    reviewedAt: '2026-08-02 10:00',
  }]
})

const seedRecord = listTechnicalDataVersions()[0]
assert.ok(seedRecord)
const seedContent = getTechnicalDataVersionContent(seedRecord.technicalVersionId)
assert.ok(seedContent)
const technicalVersionId = 'TDV-PATTERN-REWORK-BRIDGE'
const version: TechnicalDataVersionRecord = {
  ...seedRecord,
  technicalVersionId,
  technicalVersionCode: 'TP-PATTERN-REWORK-BRIDGE',
  versionLabel: 'V1',
  versionNo: 1,
  styleId: master.styleId,
  styleCode: master.styleCode,
  styleName: master.styleName,
  sourceProjectId: master.masterOrderId,
  sourceProjectCode: master.masterOrderCode,
  sourceProjectName: master.styleName,
  createdFromTaskType: 'ENGINEERING_MASTER',
  createdFromTaskId: `${master.masterOrderId}-TECH_PACK_CONFIRMATION`,
  createdFromTaskCode: `${master.masterOrderId}-TECH_PACK_CONFIRMATION`,
  linkedArtworkTaskIds: [patternTaskId],
  versionStatus: 'DRAFT',
  reviewStage: '跟单复核',
  buyerReview: reviewNode('BUYER'),
  patternMakerReview: reviewNode('PATTERN_MAKER'),
  merchandiserReview: reviewNode('MERCHANDISER'),
  reviewUnlockedModuleKeys: [],
  returnedFromMerchandiserFlag: false,
  publishedAt: '',
  publishedBy: '',
}
resetTechnicalDataVersionRepository()
createTechnicalDataVersionDraft(version, { ...seedContent, technicalVersionId })

const versionCountBefore = listTechnicalDataVersions().length
const returned = returnTechPackReviewByModules(
  technicalVersionId,
  ['DESIGN'],
  '花型效果需要重新调整',
  '跟单C',
)
const reopenedTask = getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find(
  (task) => task.taskId === patternTaskId,
)

assert.equal(reopenedTask?.status, '返工中', '花型设计模块打回必须重开原花型任务')
assert.equal(reopenedTask?.reworkRounds.length, 1, '重开原花型任务必须新增一轮返工')
assert.equal(returned.technicalVersionId, technicalVersionId, '打回后必须继续审核同一技术包版本')
assert.equal(getTechnicalDataVersionById(technicalVersionId)?.technicalVersionId, technicalVersionId)
assert.equal(listTechnicalDataVersions().length, versionCountBefore, '打回不得生成新的技术包版本')

const colorTaskIds = [
  `${master.masterOrderId}-COLOR_YARN`,
  `${master.masterOrderId}-COLOR_FABRIC`,
]
for (const [index, taskId] of colorTaskIds.entries()) {
  updateEngineeringTaskRecord(master.masterOrderId, taskId, (task) => {
    task.status = '已完成'
    task.startedAt = '2026-08-02 08:00'
    task.submittedAt = '2026-08-02 09:00'
    task.firstCompletedAt = '2026-08-02 10:00'
    task.effectiveCompletedAt = '2026-08-02 10:00'
    task.materialLines = [{
      materialLineId: `COLOR-LINE-${index + 1}`,
      materialSkuId: `MAT-COLOR-${index + 1}`,
      materialName: index === 0 ? '染色纱线' : '染色面料',
      materialType: index === 0 ? '纱线' : '面料',
      requirementType: '染色',
      status: '正常',
      resultFileIds: [`file://color-${index + 1}.pdf`],
      effectImageIds: [`image://color-${index + 1}`],
      resultSubmittedBy: '染厂',
      resultSubmittedAt: '2026-08-02 09:00',
      reviewStatus: '通过',
      reviewReason: '',
      reviewedBy: '买手A',
      reviewedAt: '2026-08-02 10:00',
    }, ...(index === 1 ? [{
      materialLineId: 'COLOR-LINE-3',
      materialSkuId: 'MAT-COLOR-3',
      materialName: '染色里布',
      materialType: '面料',
      requirementType: '染色' as const,
      status: '正常' as const,
      resultFileIds: ['file://color-3.pdf'],
      effectImageIds: ['image://color-3'],
      resultSubmittedBy: '染厂',
      resultSubmittedAt: '2026-08-02 09:00',
      reviewStatus: '通过' as const,
      reviewReason: '',
      reviewedBy: '买手A',
      reviewedAt: '2026-08-02 10:00',
    }] : [])]
  })
}

const colorVersionId = 'TDV-COLOR-REWORK-BRIDGE'
resetTechnicalDataVersionRepository()
createTechnicalDataVersionDraft({
  ...version,
  technicalVersionId: colorVersionId,
  technicalVersionCode: 'TP-COLOR-REWORK-BRIDGE',
}, { ...seedContent, technicalVersionId: colorVersionId })
const colorVersionCountBefore = listTechnicalDataVersions().length
returnTechPackReviewByModules(
  colorVersionId,
  ['COLOR_MATERIAL_MAPPING'],
  '调色成果需要重新确认',
  '跟单C',
)
const colorMaster = getEngineeringMasterOrderById(master.masterOrderId)
for (const taskId of colorTaskIds) {
  const task = colorMaster?.tasks.find((item) => item.taskId === taskId)
  assert.equal(task?.status, '返工中', '款色用料模块打回必须重开原调色任务')
  assert.equal(task?.reworkRounds.length, 1, '每张原调色任务必须新增一轮返工')
  assert.ok(task?.materialLines.every((line) => line.reviewStatus === '未通过'), '整张任务打回后所有有效成果行进入逐行返工')
}

const fabricTaskId = colorTaskIds[1]
assert.throws(
  () => submitEngineeringMaterialResults({
    masterOrderId: master.masterOrderId,
    taskId: fabricTaskId,
    submittedBy: '染厂A',
    results: [{ materialLineId: 'COLOR-LINE-2', resultFileIds: ['file://color-2-v2.pdf'], effectImageIds: ['image://color-2-v2'] }],
  }),
  /不得遗漏.*COLOR-LINE-3/,
  '整张调色任务返工提交不得遗漏任何未通过行',
)
submitEngineeringMaterialResults({
  masterOrderId: master.masterOrderId,
  taskId: fabricTaskId,
  submittedBy: '染厂A',
  results: [
    { materialLineId: 'COLOR-LINE-2', resultFileIds: ['file://color-2-v2.pdf'], effectImageIds: ['image://color-2-v2'] },
    { materialLineId: 'COLOR-LINE-3', resultFileIds: ['file://color-3-v2.pdf'], effectImageIds: ['image://color-3-v2'] },
  ],
})
const mixedColorReview = reviewEngineeringMaterialResults({
  masterOrderId: master.masterOrderId,
  taskId: fabricTaskId,
  reviewerName: '买手A',
  reviewerRole: '买手',
  decisions: [
    { materialLineId: 'COLOR-LINE-2', decision: '通过', reason: '' },
    { materialLineId: 'COLOR-LINE-3', decision: '未通过', reason: '潘通色号偏差' },
  ],
})
assert.deepEqual(mixedColorReview.lockedPassedLineIds, ['COLOR-LINE-2'], '逐行审核通过的调色成果必须锁定')
assert.deepEqual(mixedColorReview.reworkLineIds, ['COLOR-LINE-3'], '逐行审核未通过的调色成果必须继续返工')
assert.equal(getTechnicalDataVersionById(colorVersionId)?.technicalVersionId, colorVersionId, '调色返工继续使用原技术包版本')
assert.equal(listTechnicalDataVersions().length, colorVersionCountBefore, '调色返工不得创建新技术包版本')

const missingBindingVersionId = 'TDV-MISSING-ARTWORK-BINDING'
resetTechnicalDataVersionRepository()
createTechnicalDataVersionDraft({
  ...version,
  technicalVersionId: missingBindingVersionId,
  technicalVersionCode: 'TP-MISSING-ARTWORK-BINDING',
  linkedArtworkTaskIds: [],
}, { ...seedContent, technicalVersionId: missingBindingVersionId })
assert.throws(
  () => returnTechPackReviewByModules(missingBindingVersionId, ['DESIGN'], '需要返工', '跟单C'),
  /未绑定原花型任务/,
  '缺少权威原任务绑定时必须中文报错，不能按款式猜测任务',
)
assert.equal(getTechnicalDataVersionById(missingBindingVersionId)?.reviewStage, '跟单复核', '绑定校验失败不得提前改写技术包审核状态')

const wrongSourceVersionId = 'TDV-WRONG-SOURCE'
resetTechnicalDataVersionRepository()
assert.throws(
  () => createTechnicalDataVersionDraft({
    ...version,
    technicalVersionId: wrongSourceVersionId,
    technicalVersionCode: 'TP-WRONG-SOURCE',
    sourceProjectId: 'EMO-NOT-EXISTS',
  }, { ...seedContent, technicalVersionId: wrongSourceVersionId }),
  /工程主单不存在/,
  '即使款式相同也不得绕过 sourceProjectId 猜测其他工程主单建立技术包',
)

console.log('pcs-tech-pack-engineering-task-rework-bridge.spec.ts PASS')
