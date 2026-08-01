import assert from 'node:assert/strict'

import { clearProjectRelationStore } from '../src/data/pcs-project-relation-repository.ts'
import {
  getProjectById,
  getProjectNodeRecordByStepCode,
  resetProjectRepository,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import {
  activateTechPackVersionForStyle,
  generateTechPackVersionFromPlateTask,
  generateTechPackVersionFromRevisionTask,
  publishTechnicalDataVersion,
} from '../src/data/pcs-project-technical-data-writeback.ts'
import {
  findStyleArchiveByProjectId,
  getStyleArchiveById,
  listStyleArchives,
  resetStyleArchiveRepository,
  updateStyleArchive,
} from '../src/data/pcs-style-archive-repository.ts'
import {
  listTechPackVersionLogsByStyleId,
  resetTechPackVersionLogRepository,
} from '../src/data/pcs-tech-pack-version-log-repository.ts'
import { generateTechPackVersionFromPatternTask } from '../src/data/pcs-tech-pack-task-generation.ts'
import { assertFirstFormalProduction } from '../src/data/pcs-engineering-first-production-policy.ts'
import {
  createEngineeringChangeTask,
  createEngineeringMasterOrder,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  setEngineeringMasterStatus,
} from '../src/data/pcs-engineering-master-repository.ts'
import type {
  EngineeringChangeTaskRecord,
  EngineeringMasterOrderRecord,
} from '../src/data/pcs-engineering-master-types.ts'
import {
  resetTechnicalDataVersionRepository,
  updateTechnicalDataVersionContent,
  updateTechnicalDataVersionRecord,
} from '../src/data/pcs-technical-data-version-repository.ts'
import { resetPlateMakingTaskRepository, upsertPlateMakingTask } from '../src/data/pcs-plate-making-repository.ts'
import { resetPatternTaskRepository, upsertPatternTask } from '../src/data/pcs-pattern-task-repository.ts'
import { resetRevisionTaskRepository, upsertRevisionTask } from '../src/data/pcs-revision-task-repository.ts'
import {
  handlePcsProductArchiveEvent,
  renderPcsStyleArchiveDetailPage,
  resetPcsProductArchiveState,
} from '../src/pages/pcs-product-archives.ts'
import { renderTechPackPage } from '../src/pages/tech-pack.ts'

function resetScenario(): void {
  resetProjectRepository()
  resetStyleArchiveRepository()
  resetTechnicalDataVersionRepository()
  clearProjectRelationStore()
  resetTechPackVersionLogRepository()
  resetPlateMakingTaskRepository()
  resetPatternTaskRepository()
  resetRevisionTaskRepository()
  resetEngineeringMasterRepository()
  resetPcsProductArchiveState()
}

function prepareProjectAndStyle() {
  const style = listStyleArchives().find((item) => {
    if (!item.sourceProjectId) return false
    try {
      assertFirstFormalProduction(item.styleCode)
      return true
    } catch {
      return false
    }
  }) || findStyleArchiveByProjectId('PRJ-20251216-004')
  assert.ok(style, '应存在可用于版本日志测试的款式档案')
  const project = getProjectById(style!.sourceProjectId)
  assert.ok(project, '款式档案必须能找到来源商品项目')

  updateStyleArchive(style!.styleId, {
    techPackStatus: '未建立',
    techPackVersionCount: 0,
    currentTechPackVersionId: '',
    currentTechPackVersionCode: '',
    currentTechPackVersionLabel: '',
    currentTechPackVersionStatus: '',
    currentTechPackVersionActivatedAt: '',
    currentTechPackVersionActivatedBy: '',
    updatedAt: '2026-04-20 14:00',
    updatedBy: '测试用户',
  })
  updateProjectRecord(
    project!.projectId,
    {
      linkedStyleId: style!.styleId,
      linkedStyleCode: style!.styleCode,
      linkedStyleName: style!.styleName,
      linkedTechPackVersionId: '',
      linkedTechPackVersionCode: '',
      linkedTechPackVersionLabel: '',
      linkedTechPackVersionStatus: '',
      linkedTechPackVersionPublishedAt: '',
      updatedAt: '2026-04-20 14:00',
    },
    '测试用户',
  )

  const freshStyle = getStyleArchiveById(style!.styleId)!
  const engineeringMaster = publishEngineeringMasterOrder(createEngineeringMasterOrder({
    styleId: freshStyle.styleId,
    styleCode: freshStyle.styleCode,
    merchandiserName: '测试跟单',
  }).masterOrderId)

  return {
    style: freshStyle,
    project: getProjectById(project!.projectId)!,
    engineeringMaster,
  }
}

function createPlateTask(projectId: string, styleCode: string, master: EngineeringMasterOrderRecord) {
  const project = getProjectById(projectId)!
  return upsertPlateMakingTask({
    plateTaskId: 'plate_task_log_test',
    plateTaskCode: 'PT-TEST-LOG-001',
    title: '制版任务 - 日志基础版',
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: '',
    stepCode: 'PATTERN_TASK',
    stepName: '制版任务',
    sourceType: '商品项目',
    upstreamModule: '生产工程管理',
    upstreamObjectType: '工程专业任务',
    upstreamObjectId: `${master.masterOrderId}-BASE_PATTERN_WOVEN`,
    upstreamObjectCode: `${master.masterOrderCode}-BASE_PATTERN_WOVEN`,
    productStyleCode: styleCode,
    spuCode: styleCode,
    productHistoryType: '未卖过',
    patternArea: '深圳',
    patternType: '常规制版',
    sizeRange: 'S-XL',
    patternVersion: 'P1',
    linkedTechPackVersionId: '',
    linkedTechPackVersionCode: '',
    linkedTechPackVersionLabel: '',
    linkedTechPackVersionStatus: '',
    linkedTechPackUpdatedAt: '',
    acceptedAt: '2026-04-20 14:10',
    confirmedAt: '2026-04-20 14:20',
    status: '已确认',
    ownerId: project.ownerId,
    ownerName: project.ownerName,
    participantNames: ['制版师'],
    priorityLevel: '中',
    dueAt: '2026-04-23 18:00',
    createdAt: '2026-04-20 14:00',
    createdBy: '测试用户',
    updatedAt: '2026-04-20 14:20',
    updatedBy: '测试用户',
    note: '用于验证技术包版本日志。',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })
}

function createPatternTask(
  id: string,
  code: string,
  projectId: string,
  styleCode: string,
  artworkVersion: string,
  master: EngineeringMasterOrderRecord,
) {
  const project = getProjectById(projectId)!
  return upsertPatternTask({
    patternTaskId: id,
    patternTaskCode: code,
    title: `花型任务 ${code}`,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: '',
    stepCode: 'PATTERN_ARTWORK_TASK',
    stepName: '花型任务',
    sourceType: '商品项目',
    upstreamModule: '生产工程管理',
    upstreamObjectType: '工程专业任务',
    upstreamObjectId: `${master.masterOrderId}-PATTERN_ARTWORK`,
    upstreamObjectCode: `${master.masterOrderCode}-PATTERN_ARTWORK`,
    productStyleCode: styleCode,
    spuCode: styleCode,
    artworkType: '印花',
    patternMode: '定位印',
    artworkName: `${code}-花型`,
    artworkVersion,
    completionImageIds: [`mock://pattern-complete/${code}.png`],
    patternFileIds: [`mock-file://pattern-artwork/${code}.ai`],
    buyerReviewStatus: '买手已通过',
    linkedTechPackVersionId: '',
    linkedTechPackVersionCode: '',
    linkedTechPackVersionLabel: '',
    linkedTechPackVersionStatus: '',
    linkedTechPackUpdatedAt: '',
    acceptedAt: '2026-04-20 14:30',
    confirmedAt: '2026-04-20 14:40',
    status: '已完成',
    ownerId: project.ownerId,
    ownerName: project.ownerName,
    priorityLevel: '中',
    dueAt: '2026-04-24 18:00',
    createdAt: '2026-04-20 14:30',
    createdBy: '测试用户',
    updatedAt: '2026-04-20 14:40',
    updatedBy: '测试用户',
    note: '',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })
}

function createRevisionTask(
  projectId: string,
  styleId: string,
  styleCode: string,
  styleName: string,
  change: EngineeringChangeTaskRecord,
) {
  const project = getProjectById(projectId)!
  const node = getProjectNodeRecordByStepCode(projectId, 'TEST_CONCLUSION')!
  return upsertRevisionTask({
    revisionTaskId: 'revision_task_log_test',
    revisionTaskCode: 'RT-TEST-LOG-001',
    title: '改版任务 - 日志版本',
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: node.projectNodeId,
    stepCode: 'REVISION_TASK',
    stepName: '改版任务',
    sourceType: '人工创建',
    upstreamModule: '生产工程管理',
    upstreamObjectType: '工程变更任务',
    upstreamObjectId: change.engineeringChangeTaskId,
    upstreamObjectCode: change.engineeringChangeTaskCode,
    styleId,
    styleCode,
    styleName,
    referenceObjectType: '',
    referenceObjectId: '',
    referenceObjectCode: '',
    referenceObjectName: '',
    productStyleCode: styleCode,
    spuCode: styleCode,
    status: '已完成',
    ownerId: project.ownerId,
    ownerName: project.ownerName,
    participantNames: ['商品运营'],
    priorityLevel: '中',
    dueAt: '2026-04-25 18:00',
    revisionScopeCodes: ['PATTERN'],
    revisionScopeNames: ['版型结构'],
    revisionVersion: 'R1',
    issueSummary: '腰节版型微调。',
    evidenceSummary: '试穿反馈需要调整版型。',
    evidenceImageUrls: [],
    linkedTechPackVersionId: '',
    linkedTechPackVersionCode: '',
    linkedTechPackVersionLabel: '',
    linkedTechPackVersionStatus: '',
    linkedTechPackUpdatedAt: '',
    createdAt: '2026-04-20 15:00',
    createdBy: '测试用户',
    updatedAt: '2026-04-20 15:10',
    updatedBy: '测试用户',
    note: '',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })
}

resetScenario()
const { style, project, engineeringMaster } = prepareProjectAndStyle()
const plateTask = createPlateTask(project.projectId, style.styleCode, engineeringMaster)
const baseVersion = generateTechPackVersionFromPlateTask(plateTask.plateTaskId, '测试用户').record
updateTechnicalDataVersionContent(baseVersion.technicalVersionId, {
  processEntries: [{
    id: 'process_log_base',
    entryType: 'PROCESS_BASELINE',
    stageCode: 'PROD',
    stageName: '生产',
    processCode: 'SEWING',
    processName: '车缝',
    assignmentGranularity: 'ORDER',
    defaultDocType: 'TASK',
    taskTypeMode: 'PROCESS',
    isSpecialCraft: false,
    routeStepNo: 1,
    routeLaneNo: 1,
  }],
  processRouteStatus: 'CONFIRMED',
  processRouteConfirmedBy: '测试用户',
  processRouteConfirmedAt: '2026-04-20 14:25',
})
const patternTaskOne = createPatternTask('pattern_task_log_write', 'AT-TEST-LOG-001', project.projectId, style.styleCode, 'ART-LOG-V1', engineeringMaster)
generateTechPackVersionFromPatternTask(patternTaskOne.patternTaskId, '测试用户')
updateTechnicalDataVersionRecord(baseVersion.technicalVersionId, {
  reviewStage: '待发布',
  reviewSubmittedAt: '2026-04-20 14:30',
  reviewSubmittedBy: '测试用户',
  merchandiserReview: {
    nodeKey: 'MERCHANDISER',
    nodeName: '跟单审核',
    status: '审核-已通过',
    reviewerRole: '跟单',
    assignedReviewerId: 'merchandiser-test',
    assignedReviewerName: '测试跟单',
    assignedReviewerRole: '跟单',
    assignedReviewerFeishuOpenId: '',
    assignedAt: '2026-04-20 14:30',
    assignedBy: '测试用户',
    reviewedBy: '测试跟单',
    reviewedAt: '2026-04-20 14:40',
    startedOpinion: '',
    opinion: '确认发布',
    diffSnapshotId: '',
    diffStatus: '无差异',
    diffSummaryText: '',
    lastFeishuNotifyAt: '',
    lastFeishuNotifyStatus: '未发送',
    lastFeishuNotifyRecordId: '',
    todayFeishuNotifiedFlag: false,
  },
})
publishTechnicalDataVersion(baseVersion.technicalVersionId, '测试用户')
activateTechPackVersionForStyle(style.styleId, baseVersion.technicalVersionId, '测试用户')

const patternTaskTwo = createPatternTask('pattern_task_log_new', 'AT-TEST-LOG-002', project.projectId, style.styleCode, 'ART-LOG-V2', engineeringMaster)
generateTechPackVersionFromPatternTask(patternTaskTwo.patternTaskId, '测试用户')

setEngineeringMasterStatus(engineeringMaster.masterOrderId, '已关闭')
const engineeringChange = createEngineeringChangeTask({
  sourceMasterOrderId: engineeringMaster.masterOrderId,
  createdBy: '测试用户',
})
const revisionTask = createRevisionTask(project.projectId, style.styleId, style.styleCode, style.styleName, engineeringChange)
generateTechPackVersionFromRevisionTask(revisionTask.revisionTaskId, '测试用户')

const logTypes = listTechPackVersionLogsByStyleId(style.styleId).map((item) => item.logType)
assert.ok(logTypes.includes('制版生成技术包'), '制版建立技术包后必须写版本日志')
assert.ok(logTypes.includes('发布技术包版本'), '发布动作必须写版本日志')
assert.ok(logTypes.includes('启用当前生效版本'), '启用动作必须写版本日志')
assert.ok(logTypes.includes('花型写入技术包'), '花型写入必须写版本日志')
assert.ok(logTypes.includes('花型生成新版本'), '花型生成新版本必须写版本日志')
assert.ok(logTypes.includes('改版生成新版本'), '改版生成新版本必须写版本日志')

renderPcsStyleArchiveDetailPage(style.styleId)

handlePcsProductArchiveEvent({
  dataset: {
    pcsProductArchiveAction: 'set-style-detail-tab',
    value: 'versions',
  },
  closest() {
    return this
  },
} as unknown as HTMLElement)

const styleDetailHtml = renderPcsStyleArchiveDetailPage(style.styleId)
assert.ok(styleDetailHtml.includes('查看版本日志'), '款式档案详情必须提供版本日志查看入口')

const techPackHtml = renderTechPackPage(style.styleCode, {
  styleId: style.styleId,
  technicalVersionId: baseVersion.technicalVersionId,
})
assert.ok(techPackHtml.includes('查看版本日志'), '技术包详情必须展示版本日志入口')
assert.ok(!techPackHtml.includes('未找到正式技术包版本'), '技术包详情必须能打开当前版本')

console.log('pcs-tech-pack-version-log.spec.ts PASS')
