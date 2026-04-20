import assert from 'node:assert/strict'

import { clearProjectRelationStore } from '../src/data/pcs-project-relation-repository.ts'
import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
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
  listTechPackVersionLogsByVersionId,
  resetTechPackVersionLogRepository,
} from '../src/data/pcs-tech-pack-version-log-repository.ts'
import {
  getCurrentTechPackVersionByStyleId,
  listTechnicalDataVersionsByStyleId,
  replaceTechnicalDataVersionStore,
} from '../src/data/pcs-technical-data-version-repository.ts'
import { resetPlateMakingTaskRepository, upsertPlateMakingTask } from '../src/data/pcs-plate-making-repository.ts'
import { getRevisionTaskById, resetRevisionTaskRepository, upsertRevisionTask } from '../src/data/pcs-revision-task-repository.ts'
import type { PlateMakingTaskRecord } from '../src/data/pcs-plate-making-types.ts'
import type { RevisionTaskRecord } from '../src/data/pcs-revision-task-types.ts'

function resetScenario(): void {
  resetProjectRepository()
  resetStyleArchiveRepository()
  replaceTechnicalDataVersionStore({
    version: 2,
    records: [],
    contents: [],
    pendingItems: [],
  })
  clearProjectRelationStore()
  resetTechPackVersionLogRepository()
  resetPlateMakingTaskRepository()
  resetRevisionTaskRepository()
}

function prepareProjectAndStyle() {
  const style = listStyleArchives().find((item) => item.sourceProjectId) || findStyleArchiveByProjectId('PRJ-20251216-004')
  assert.ok(style, '应存在可用于改版技术包测试的款式档案')
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
    updatedAt: '2026-04-20 12:00',
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
      updatedAt: '2026-04-20 12:00',
    },
    '测试用户',
  )

  return {
    style: getStyleArchiveById(style!.styleId)!,
    project: getProjectById(project!.projectId)!,
  }
}

function createPlateTask(id: string, code: string, projectId: string, styleCode: string, patternVersion: string): PlateMakingTaskRecord {
  const project = getProjectById(projectId)!
  const plateNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'PATTERN_TASK')!
  return upsertPlateMakingTask({
    plateTaskId: id,
    plateTaskCode: code,
    title: `制版任务 ${code}`,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: plateNode.projectNodeId,
    workItemTypeCode: 'PATTERN_TASK',
    workItemTypeName: '制版任务',
    sourceType: '项目模板阶段',
    upstreamModule: '商品项目',
    upstreamObjectType: '商品项目节点',
    upstreamObjectId: plateNode.projectNodeId,
    upstreamObjectCode: plateNode.workItemTypeCode,
    productStyleCode: styleCode,
    spuCode: styleCode,
    patternType: '常规制版',
    sizeRange: 'S-XL',
    patternVersion,
    linkedTechPackVersionId: '',
    linkedTechPackVersionCode: '',
    linkedTechPackVersionLabel: '',
    linkedTechPackVersionStatus: '',
    linkedTechPackUpdatedAt: '',
    acceptedAt: '2026-04-20 12:10',
    confirmedAt: '2026-04-20 12:20',
    status: '已完成',
    ownerId: project.ownerId,
    ownerName: project.ownerName,
    participantNames: ['制版师'],
    priorityLevel: '中',
    dueAt: '2026-04-25 18:00',
    createdAt: '2026-04-20 12:00',
    createdBy: '测试用户',
    updatedAt: '2026-04-20 12:20',
    updatedBy: '测试用户',
    note: '为改版准备当前主技术包。',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })
}

function createRevisionTask(projectId: string, styleId: string, styleCode: string, styleName: string): RevisionTaskRecord {
  const project = getProjectById(projectId)!
  const upstreamNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'TEST_CONCLUSION')
    || getProjectNodeRecordByWorkItemTypeCode(projectId, 'PROJECT_TRANSFER_PREP')
  assert.ok(upstreamNode, '项目中必须存在可挂接改版任务的节点')

  return upsertRevisionTask({
    revisionTaskId: 'revision_task_new_version_test',
    revisionTaskCode: 'RT-TEST-NEW-001',
    title: '改版任务 - 腰节与版型微调',
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: upstreamNode!.projectNodeId,
    workItemTypeCode: 'REVISION_TASK',
    workItemTypeName: '改版任务',
    sourceType: '人工创建',
    upstreamModule: '商品项目',
    upstreamObjectType: '商品项目节点',
    upstreamObjectId: upstreamNode!.projectNodeId,
    upstreamObjectCode: upstreamNode!.workItemTypeCode,
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
    participantNames: ['版师', '商品运营'],
    priorityLevel: '中',
    dueAt: '2026-04-27 18:00',
    revisionScopeCodes: ['PATTERN', 'CRAFT'],
    revisionScopeNames: ['版型结构', '工艺'],
    revisionVersion: 'R1',
    issueSummary: '腰节位置偏高，需要重新调整版型结构。',
    evidenceSummary: '试穿反馈腰节上移，影响整体比例。',
    evidenceImageUrls: [],
    linkedTechPackVersionId: '',
    linkedTechPackVersionCode: '',
    linkedTechPackVersionLabel: '',
    linkedTechPackVersionStatus: '',
    linkedTechPackUpdatedAt: '',
    createdAt: '2026-04-20 13:00',
    createdBy: '测试用户',
    updatedAt: '2026-04-20 13:30',
    updatedBy: '测试用户',
    note: '仅基于当前生效技术包生成新版本。',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })
}

resetScenario()
const { style, project } = prepareProjectAndStyle()

const plateTaskOne = createPlateTask('plate_task_revision_base', 'PT-TEST-REV-BASE', project.projectId, style.styleCode, 'P1')
const baseVersion = generateTechPackVersionFromPlateTask(plateTaskOne.plateTaskId, '测试用户').record
publishTechnicalDataVersion(baseVersion.technicalVersionId, '测试用户')
activateTechPackVersionForStyle(style.styleId, baseVersion.technicalVersionId, '测试用户')

const plateTaskTwo = createPlateTask('plate_task_revision_draft', 'PT-TEST-REV-DRAFT', project.projectId, style.styleCode, 'P2')
const draftVersion = generateTechPackVersionFromPlateTask(plateTaskTwo.plateTaskId, '测试用户').record
assert.equal(draftVersion.versionStatus, 'DRAFT', '用于干扰校验的制版技术包应保持草稿状态')

const revisionTask = createRevisionTask(project.projectId, style.styleId, style.styleCode, style.styleName)
const revisionResult = generateTechPackVersionFromRevisionTask(revisionTask.revisionTaskId, '测试用户')

assert.equal(revisionResult.record.createdFromTaskType, 'REVISION', '改版生成的新版本必须记录来源任务类型')
assert.equal(revisionResult.record.baseTechnicalVersionId, baseVersion.technicalVersionId, '改版新版本必须基于当前生效技术包版本')
assert.ok(revisionResult.record.linkedRevisionTaskIds.includes(revisionTask.revisionTaskId), '改版新版本必须记录改版任务链')
assert.notEqual(revisionResult.record.technicalVersionId, draftVersion.technicalVersionId, '改版任务不得写入已有草稿版本')
assert.equal(revisionResult.record.versionStatus, 'DRAFT', '改版生成的新版本必须保持草稿状态')

const currentEffective = getCurrentTechPackVersionByStyleId(style.styleId)
assert.equal(currentEffective?.technicalVersionId, baseVersion.technicalVersionId, '改版生成新版本后不得自动替换当前生效版本')

const versions = listTechnicalDataVersionsByStyleId(style.styleId)
assert.equal(versions.length, 3, '改版生成后必须新增一个技术包版本')

const revisionTaskAfter = getRevisionTaskById(revisionTask.revisionTaskId)
assert.equal(revisionTaskAfter?.linkedTechPackVersionId, revisionResult.record.technicalVersionId, '改版任务必须回写新技术包版本')
assert.equal(listTechPackVersionLogsByVersionId(revisionResult.record.technicalVersionId)[0]?.logType, '改版生成新版本', '改版生成必须写正式版本日志')

console.log('pcs-tech-pack-revision-new-version.spec.ts PASS')
