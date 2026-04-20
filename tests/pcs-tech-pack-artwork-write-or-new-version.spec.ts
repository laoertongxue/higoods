import assert from 'node:assert/strict'

import {
  clearProjectRelationStore,
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
  generateTechPackVersionFromPatternTask,
  generateTechPackVersionFromPlateTask,
} from '../src/data/pcs-tech-pack-task-generation.ts'
import {
  listTechPackVersionLogsByVersionId,
  resetTechPackVersionLogRepository,
} from '../src/data/pcs-tech-pack-version-log-repository.ts'
import {
  getTechnicalDataVersionContent,
  listTechnicalDataVersionsByStyleId,
  replaceTechnicalDataVersionStore,
} from '../src/data/pcs-technical-data-version-repository.ts'
import {
  resetPlateMakingTaskRepository,
  upsertPlateMakingTask,
} from '../src/data/pcs-plate-making-repository.ts'
import {
  getPatternTaskById,
  resetPatternTaskRepository,
  upsertPatternTask,
} from '../src/data/pcs-pattern-task-repository.ts'
import type { PlateMakingTaskRecord } from '../src/data/pcs-plate-making-types.ts'
import type { PatternTaskRecord } from '../src/data/pcs-pattern-task-types.ts'

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
  resetPatternTaskRepository()
}

function prepareProjectAndStyle() {
  const style = listStyleArchives().find((item) => item.sourceProjectId) || findStyleArchiveByProjectId('PRJ-20251216-004')
  assert.ok(style, '应存在可用于花型技术包测试的款式档案')
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
    updatedAt: '2026-04-20 10:00',
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
      updatedAt: '2026-04-20 10:00',
    },
    '测试用户',
  )

  return {
    style: getStyleArchiveById(style!.styleId)!,
    project: getProjectById(project!.projectId)!,
  }
}

function createPlateTask(projectId: string, styleCode: string): PlateMakingTaskRecord {
  const project = getProjectById(projectId)!
  const plateNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'PATTERN_TASK')!
  return upsertPlateMakingTask({
    plateTaskId: 'plate_task_artwork_test',
    plateTaskCode: 'PT-TEST-ART-001',
    title: '制版任务 - 花型底板',
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
    patternVersion: 'P1',
    linkedTechPackVersionId: '',
    linkedTechPackVersionCode: '',
    linkedTechPackVersionLabel: '',
    linkedTechPackVersionStatus: '',
    linkedTechPackUpdatedAt: '',
    acceptedAt: '2026-04-20 10:10',
    confirmedAt: '2026-04-20 10:20',
    status: '已完成',
    ownerId: project.ownerId,
    ownerName: project.ownerName,
    participantNames: ['制版师'],
    priorityLevel: '中',
    dueAt: '2026-04-22 18:00',
    createdAt: '2026-04-20 10:00',
    createdBy: '测试用户',
    updatedAt: '2026-04-20 10:20',
    updatedBy: '测试用户',
    note: '建立花型可写入的底板技术包。',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })
}

function createPatternTask(id: string, code: string, projectId: string, styleCode: string, artworkVersion: string): PatternTaskRecord {
  const project = getProjectById(projectId)!
  const patternNode = getProjectNodeRecordByWorkItemTypeCode(projectId, 'PATTERN_ARTWORK_TASK')!
  return upsertPatternTask({
    patternTaskId: id,
    patternTaskCode: code,
    title: `花型任务 ${code}`,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: patternNode.projectNodeId,
    workItemTypeCode: 'PATTERN_ARTWORK_TASK',
    workItemTypeName: '花型任务',
    sourceType: '项目模板阶段',
    upstreamModule: '商品项目',
    upstreamObjectType: '商品项目节点',
    upstreamObjectId: patternNode.projectNodeId,
    upstreamObjectCode: patternNode.workItemTypeCode,
    productStyleCode: styleCode,
    spuCode: styleCode,
    artworkType: '印花',
    patternMode: '定位印',
    artworkName: `${code}-花型方案`,
    artworkVersion,
    linkedTechPackVersionId: '',
    linkedTechPackVersionCode: '',
    linkedTechPackVersionLabel: '',
    linkedTechPackVersionStatus: '',
    linkedTechPackUpdatedAt: '',
    acceptedAt: '2026-04-20 11:00',
    confirmedAt: '2026-04-20 11:10',
    status: '已完成',
    ownerId: project.ownerId,
    ownerName: project.ownerName,
    priorityLevel: '中',
    dueAt: '2026-04-23 18:00',
    createdAt: '2026-04-20 11:00',
    createdBy: '测试用户',
    updatedAt: '2026-04-20 11:10',
    updatedBy: '测试用户',
    note: '输出花型文件。',
    legacyProjectRef: '',
    legacyUpstreamRef: '',
  })
}

resetScenario()
const { style, project } = prepareProjectAndStyle()
const plateTask = createPlateTask(project.projectId, style.styleCode)
const plateVersion = generateTechPackVersionFromPlateTask(plateTask.plateTaskId, '测试用户').record

const patternTaskOne = createPatternTask('pattern_task_write_test', 'AT-TEST-WRITE-001', project.projectId, style.styleCode, 'ART-V1')
const firstResult = generateTechPackVersionFromPatternTask(patternTaskOne.patternTaskId, '测试用户')
assert.equal(firstResult.action, 'WRITTEN', '当前技术包没有花型时，应直接写入当前版本')
assert.equal(firstResult.record.technicalVersionId, plateVersion.technicalVersionId, '没有花型时不得生成新版本')

const firstContent = getTechnicalDataVersionContent(plateVersion.technicalVersionId)
assert.ok(firstContent && firstContent.patternDesigns.length > 0, '第一次花型写入后，当前版本必须已有花型内容')
assert.equal(listTechnicalDataVersionsByStyleId(style.styleId).length, 1, '第一次花型写入不应新增技术包版本')
assert.equal(listTechPackVersionLogsByVersionId(plateVersion.technicalVersionId)[0]?.logType, '花型写入技术包', '首次花型写入必须写日志')

const patternTaskTwo = createPatternTask('pattern_task_new_version_test', 'AT-TEST-NEW-002', project.projectId, style.styleCode, 'ART-V2')
const secondResult = generateTechPackVersionFromPatternTask(patternTaskTwo.patternTaskId, '测试用户')
assert.equal(secondResult.action, 'CREATED', '当前技术包已有花型时，必须生成新版本')
assert.notEqual(secondResult.record.technicalVersionId, plateVersion.technicalVersionId, '已有花型时不得覆盖原版本')
assert.equal(secondResult.record.baseTechnicalVersionId, plateVersion.technicalVersionId, '花型新版本必须记录基础版本')
assert.equal(secondResult.record.changeScope, '花型替换', '花型新版本必须标记为花型替换')

const secondContent = getTechnicalDataVersionContent(secondResult.record.technicalVersionId)
assert.ok(secondContent, '花型新版本必须有正式内容')
assert.notDeepEqual(secondContent!.patternDesigns, firstContent!.patternDesigns, '新版本必须替换花型内容')
assert.deepEqual(secondContent!.patternFiles, firstContent!.patternFiles, '花型新版本不得改动纸样文件')
assert.deepEqual(secondContent!.bomItems, firstContent!.bomItems, '花型新版本不得改动物料清单')
assert.deepEqual(secondContent!.processEntries, firstContent!.processEntries, '花型新版本不得改动工序工艺')
assert.deepEqual(secondContent!.sizeTable, firstContent!.sizeTable, '花型新版本不得改动放码信息')
assert.deepEqual(secondContent!.qualityRules, firstContent!.qualityRules, '花型新版本不得改动质检标准')
assert.deepEqual(secondContent!.colorMaterialMappings, firstContent!.colorMaterialMappings, '花型新版本不得改动款色用料对应')

const versions = listTechnicalDataVersionsByStyleId(style.styleId)
assert.equal(versions.length, 2, '已有花型后再次处理必须新增一个技术包版本')
assert.equal(getStyleArchiveById(style.styleId)?.currentTechPackVersionId, '', '花型生成新版本后不得自动启用')

const patternTaskAfter = getPatternTaskById(patternTaskTwo.patternTaskId)
assert.equal(patternTaskAfter?.linkedTechPackVersionId, secondResult.record.technicalVersionId, '花型任务必须回写新技术包版本')
assert.equal(listTechPackVersionLogsByVersionId(secondResult.record.technicalVersionId)[0]?.logType, '花型生成新版本', '花型新版本必须写日志')

console.log('pcs-tech-pack-artwork-write-or-new-version.spec.ts PASS')
