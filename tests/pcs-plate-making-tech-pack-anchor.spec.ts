import assert from 'node:assert/strict'

import {
  clearProjectRelationStore,
} from '../src/data/pcs-project-relation-repository.ts'
import {
  getProjectById,
  resetProjectRepository,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import {
  findStyleArchiveByProjectId,
  listStyleArchives,
  resetStyleArchiveRepository,
  updateStyleArchive,
} from '../src/data/pcs-style-archive-repository.ts'
import { resetTechnicalDataVersionRepository } from '../src/data/pcs-technical-data-version-repository.ts'
import { resetTechPackVersionLogRepository } from '../src/data/pcs-tech-pack-version-log-repository.ts'
import { assertFirstFormalProduction } from '../src/data/pcs-engineering-first-production-policy.ts'
import {
  createEngineeringMasterOrder,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
} from '../src/data/pcs-engineering-master-repository.ts'
import {
  getPlateMakingTaskById,
  resetPlateMakingTaskRepository,
  upsertPlateMakingTask,
} from '../src/data/pcs-plate-making-repository.ts'
import type { PlateMakingTaskRecord } from '../src/data/pcs-plate-making-types.ts'
import { generateTechPackVersionFromPlateTask } from '../src/data/pcs-tech-pack-task-generation.ts'

resetProjectRepository()
resetStyleArchiveRepository()
resetTechnicalDataVersionRepository()
clearProjectRelationStore()
resetTechPackVersionLogRepository()
resetPlateMakingTaskRepository()
resetEngineeringMasterRepository()

const style = listStyleArchives().find((item) => {
  if (!item.sourceProjectId) return false
  try {
    assertFirstFormalProduction(item.styleCode)
    return true
  } catch {
    return false
  }
}) || findStyleArchiveByProjectId('PRJ-20251216-004')
assert.ok(style, '必须存在款式档案演示数据')
const project = getProjectById(style!.sourceProjectId)
assert.ok(project, '款式档案必须有来源项目')

updateStyleArchive(style!.styleId, {
  techPackStatus: '未建立',
  currentTechPackVersionId: '',
  currentTechPackVersionCode: '',
  currentTechPackVersionLabel: '',
  currentTechPackVersionStatus: '',
})
updateProjectRecord(project!.projectId, {
  linkedStyleId: style!.styleId,
  linkedStyleCode: style!.styleCode,
  linkedStyleName: style!.styleName,
  linkedTechPackVersionId: '',
  linkedTechPackVersionCode: '',
  linkedTechPackVersionLabel: '',
  linkedTechPackVersionStatus: '',
}, '测试用户')

const engineeringMaster = publishEngineeringMasterOrder(createEngineeringMasterOrder({
  styleId: style!.styleId,
  styleCode: style!.styleCode,
  merchandiserName: '测试跟单',
}).masterOrderId)

const task: PlateMakingTaskRecord = upsertPlateMakingTask({
  plateTaskId: 'plate_anchor_test',
  plateTaskCode: 'PT-ANCHOR-001',
  title: '制版主挂载测试',
  projectId: project!.projectId,
  projectCode: project!.projectCode,
  projectName: project!.projectName,
  projectNodeId: '',
  stepCode: 'PATTERN_TASK',
  stepName: '制版任务',
  sourceType: '人工创建',
  upstreamModule: '生产工程管理',
  upstreamObjectType: '工程专业任务',
  upstreamObjectId: `${engineeringMaster.masterOrderId}-BASE_PATTERN_WOVEN`,
  upstreamObjectCode: `${engineeringMaster.masterOrderCode}-BASE_PATTERN_WOVEN`,
  productStyleCode: style!.styleCode,
  spuCode: style!.styleCode,
  productHistoryType: '未卖过',
  patternMakerId: 'maker_anchor',
  patternMakerName: '主挂载版师',
  sampleConfirmedAt: '2026-04-23 11:00:00',
  urgentFlag: false,
  patternArea: '深圳',
  patternType: '连衣裙',
  sizeRange: 'S-L',
  patternVersion: 'P1',
  colorRequirementText: '用于主挂载测试',
  newPatternSpuCode: '',
  flowerImageIds: [],
  materialRequirementLines: [],
  patternImageLineItems: [
    { lineId: 'line_front', imageId: 'mock://plate/front', materialPartName: '前片', materialDescription: '前片', pieceCount: 2 },
  ],
  patternPdfFileIds: ['mock://plate/pattern.pdf'],
  patternDxfFileIds: ['mock://plate/pattern.dxf'],
  patternRulFileIds: ['mock://plate/pattern.rul'],
  supportImageIds: [],
  supportVideoIds: [],
  partTemplateLinks: [],
  linkedTechPackVersionId: '',
  linkedTechPackVersionCode: '',
  linkedTechPackVersionLabel: '',
  linkedTechPackVersionStatus: '',
  linkedTechPackUpdatedAt: '',
  primaryTechPackGeneratedFlag: false,
  primaryTechPackGeneratedAt: '',
  acceptedAt: '2026-04-23 10:00:00',
  confirmedAt: '2026-04-23 11:00:00',
  status: '已确认',
  ownerId: project!.ownerId,
  ownerName: project!.ownerName,
  participantNames: [],
  priorityLevel: '中',
  dueAt: '2026-04-24 18:00:00',
  createdAt: '2026-04-23 10:00:00',
  createdBy: '测试用户',
  updatedAt: '2026-04-23 11:00:00',
  updatedBy: '测试用户',
  note: '',
  legacyProjectRef: '',
  legacyUpstreamRef: '',
})

const result = generateTechPackVersionFromPlateTask(task.plateTaskId, '测试用户')
assert.equal(result.record.primaryPlateTaskId, task.plateTaskId)
assert.equal(result.record.primaryPlateTaskCode, task.plateTaskCode)
assert.equal(result.record.primaryPlateTaskVersion, task.patternVersion)

const taskAfter = getPlateMakingTaskById(task.plateTaskId)
assert.equal(taskAfter?.primaryTechPackGeneratedFlag, true, '制版任务应回写主技术包生成标记')
assert.ok(taskAfter?.primaryTechPackGeneratedAt, '制版任务应回写主技术包生成时间')

console.log('pcs-plate-making-tech-pack-anchor.spec.ts PASS')
