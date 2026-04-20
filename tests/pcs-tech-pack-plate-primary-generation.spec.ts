import assert from 'node:assert/strict'

import {
  clearProjectRelationStore,
  listProjectRelationsByTechnicalVersion,
} from '../src/data/pcs-project-relation-repository.ts'
import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  resetProjectRepository,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import {
  findStyleArchiveByProjectId,
  getStyleArchiveById,
  listStyleArchives,
  resetStyleArchiveRepository,
  updateStyleArchive,
} from '../src/data/pcs-style-archive-repository.ts'
import {
  generateTechPackVersionFromPlateTask,
} from '../src/data/pcs-tech-pack-task-generation.ts'
import {
  listTechPackVersionLogsByVersionId,
  resetTechPackVersionLogRepository,
} from '../src/data/pcs-tech-pack-version-log-repository.ts'
import {
  getTechnicalDataVersionContent,
  replaceTechnicalDataVersionStore,
} from '../src/data/pcs-technical-data-version-repository.ts'
import {
  resetPlateMakingTaskRepository,
  getPlateMakingTaskById,
  upsertPlateMakingTask,
} from '../src/data/pcs-plate-making-repository.ts'
import type { PlateMakingTaskRecord } from '../src/data/pcs-plate-making-types.ts'

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
}

function prepareProjectAndStyle() {
  const style = listStyleArchives().find((item) => item.sourceProjectId) || findStyleArchiveByProjectId('PRJ-20251216-004')
  assert.ok(style, '应存在可用于技术包测试的款式档案')
  const sourceProject = getProjectById(style!.sourceProjectId)
  assert.ok(sourceProject, '款式档案必须能找到来源商品项目')

  updateStyleArchive(style!.styleId, {
    techPackStatus: '未建立',
    techPackVersionCount: 0,
    currentTechPackVersionId: '',
    currentTechPackVersionCode: '',
    currentTechPackVersionLabel: '',
    currentTechPackVersionStatus: '',
    currentTechPackVersionActivatedAt: '',
    currentTechPackVersionActivatedBy: '',
    updatedAt: '2026-04-20 09:00',
    updatedBy: '测试用户',
  })
  updateProjectRecord(
    sourceProject!.projectId,
    {
      linkedStyleId: style!.styleId,
      linkedStyleCode: style!.styleCode,
      linkedStyleName: style!.styleName,
      linkedTechPackVersionId: '',
      linkedTechPackVersionCode: '',
      linkedTechPackVersionLabel: '',
      linkedTechPackVersionStatus: '',
      linkedTechPackVersionPublishedAt: '',
      updatedAt: '2026-04-20 09:00',
    },
    '测试用户',
  )

  return {
    style: getStyleArchiveById(style!.styleId)!,
    project: getProjectById(sourceProject!.projectId)!,
  }
}

function createPlateTask(projectId: string, styleCode: string): PlateMakingTaskRecord {
  const project = getProjectById(projectId)!
  const plateNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'PATTERN_TASK')
  assert.ok(plateNode, '项目中必须存在制版任务节点')

  return upsertPlateMakingTask({
    plateTaskId: 'plate_task_primary_test',
    plateTaskCode: 'PT-TEST-PRIMARY-001',
    title: '主制版任务 - 连衣裙结构版',
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: plateNode!.projectNodeId,
    workItemTypeCode: 'PATTERN_TASK',
    workItemTypeName: '制版任务',
    sourceType: '项目模板阶段',
    upstreamModule: '商品项目',
    upstreamObjectType: '商品项目节点',
    upstreamObjectId: plateNode!.projectNodeId,
    upstreamObjectCode: plateNode!.workItemTypeCode,
    productStyleCode: styleCode,
    spuCode: styleCode,
    patternType: '常规制版',
    sizeRange: 'S-XL',
    patternVersion: 'P1',
    linkedTechPackVersionId: '',
    linkedTechPackVersionCode: '',
    linkedTechPackVersionLabel: '',
    linkedTechPackVersionStatus: '',
    linkedTechPackUpdatedAt: '',
    acceptedAt: '2026-04-20 09:20',
    confirmedAt: '2026-04-20 09:30',
    status: '已确认',
    ownerId: project.ownerId,
    ownerName: project.ownerName,
    participantNames: ['制版师', '工艺师'],
    priorityLevel: '中',
    dueAt: '2026-04-22 18:00',
    createdAt: '2026-04-20 09:00',
    createdBy: '测试用户',
    updatedAt: '2026-04-20 09:30',
    updatedBy: '测试用户',
    note: '主版输出完成，准备建立技术包。',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })
}

resetScenario()
const { style, project } = prepareProjectAndStyle()
const plateTask = createPlateTask(project.projectId, style.styleCode)
const result = generateTechPackVersionFromPlateTask(plateTask.plateTaskId, '测试用户')

assert.equal(result.record.primaryPlateTaskId, plateTask.plateTaskId, '制版任务必须成为技术包主挂载入口')
assert.equal(result.record.primaryPlateTaskCode, plateTask.plateTaskCode, '技术包版本必须记录主制版任务编号')
assert.equal(result.record.primaryPlateTaskVersion, plateTask.patternVersion, '技术包版本必须记录主制版版本')
assert.ok(result.record.linkedPatternTaskIds.includes(plateTask.plateTaskId), '技术包版本必须记录关联制版任务')
assert.equal(result.record.createdFromTaskType, 'PLATE', '首个技术包版本应记录来源为制版任务')
assert.equal(result.logType, '制版生成技术包', '制版生成必须写对应日志类型')

const content = getTechnicalDataVersionContent(result.record.technicalVersionId)
assert.ok(content, '制版生成后必须存在正式技术包内容')
assert.ok(content!.patternFiles.length > 0, '制版生成的技术包必须带入纸样文件')
assert.ok(content!.processEntries.length > 0, '制版生成的技术包必须带入工序工艺')
assert.ok(content!.sizeTable.length > 0, '制版生成的技术包必须带入放码或尺码信息')

const relationList = listProjectRelationsByTechnicalVersion(result.record.technicalVersionId)
assert.ok(relationList.length > 0, '制版生成技术包后必须写入项目关系')

const transferNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'PROJECT_TRANSFER_PREP')
assert.equal(transferNode?.latestInstanceId, result.record.technicalVersionId, '项目转档准备节点必须回写最近技术包版本')

const plateTaskAfter = getPlateMakingTaskById(plateTask.plateTaskId)
assert.equal(plateTaskAfter?.linkedTechPackVersionId, result.record.technicalVersionId, '制版任务必须回写关联技术包版本')

const logs = listTechPackVersionLogsByVersionId(result.record.technicalVersionId)
assert.equal(logs[0]?.logType, '制版生成技术包', '制版生成后必须落正式版本日志')

console.log('pcs-tech-pack-plate-primary-generation.spec.ts PASS')
