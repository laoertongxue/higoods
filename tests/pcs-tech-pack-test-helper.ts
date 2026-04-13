import assert from 'node:assert/strict'
import {
  getProjectStoreSnapshot,
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  replaceProjectStore,
  resetProjectRepository,
  updateProjectNodeRecord,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetProjectArchiveRepository } from '../src/data/pcs-project-archive-repository.ts'
import { generateStyleArchiveShellFromProject } from '../src/data/pcs-project-style-archive-writeback.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { resetTechnicalDataVersionRepository } from '../src/data/pcs-technical-data-version-repository.ts'
import { resetRevisionTaskRepository, updateRevisionTask } from '../src/data/pcs-revision-task-repository.ts'
import { resetPlateMakingTaskRepository, updatePlateMakingTask } from '../src/data/pcs-plate-making-repository.ts'
import { resetPatternTaskRepository, updatePatternTask } from '../src/data/pcs-pattern-task-repository.ts'
import {
  createPatternTaskWithProjectRelation,
  createPlateMakingTaskWithProjectRelation,
  createRevisionTaskWithProjectRelation,
} from '../src/data/pcs-task-project-relation-writeback.ts'
import {
  publishTechnicalDataVersion,
  saveTechnicalDataVersionContent,
} from '../src/data/pcs-project-technical-data-writeback.ts'
import { activateTechPackVersionForStyle } from '../src/data/pcs-tech-pack-version-activation.ts'
import { prepareProjectWithPassedTesting } from './pcs-project-formal-chain-helper.ts'

export interface TechPackTaskScenario {
  projectId: string
  styleId: string
  styleCode: string
  transferNodeId: string
  revisionTaskId: string
  plateTaskId: string
  patternTaskId: string
}

export function resetTechPackTaskScenarioRepositories(): void {
  resetProjectRepository()
  resetProjectRelationRepository()
  resetProjectArchiveRepository()
  resetStyleArchiveRepository()
  resetTechnicalDataVersionRepository()
  resetRevisionTaskRepository()
  resetPlateMakingTaskRepository()
  resetPatternTaskRepository()
}

export function prepareTechPackTaskScenario(): TechPackTaskScenario {
  resetTechPackTaskScenarioRepositories()

  const preparedProject = prepareProjectWithPassedTesting('技术包任务生成测试项目')
  const project = listProjects().find((item) => item.projectId === preparedProject.projectId)
  assert.ok(project, '应存在可用于技术包任务生成的基础项目')

  updateProjectRecord(
    project!.projectId,
    {
      projectStatus: '进行中',
      currentPhaseCode: 'PHASE_04',
      currentPhaseName: '开发推进',
      linkedStyleId: '',
      linkedStyleCode: '',
      linkedStyleName: '',
      linkedStyleGeneratedAt: '',
      linkedTechPackVersionId: '',
      linkedTechPackVersionCode: '',
      linkedTechPackVersionLabel: '',
      linkedTechPackVersionStatus: '',
      linkedTechPackVersionPublishedAt: '',
    },
    '测试用户',
  )

  ;[
    'PROJECT_TRANSFER_PREP',
    'PATTERN_TASK',
    'PATTERN_ARTWORK_TASK',
  ].forEach((code) => {
    const node = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, code)
    if (!node) return
    updateProjectNodeRecord(project!.projectId, node.projectNodeId, {
      currentStatus: '未开始',
      latestInstanceId: '',
      latestInstanceCode: '',
      latestResultType: '',
      latestResultText: '',
      currentIssueType: '',
      currentIssueText: '',
      pendingActionType: '',
      pendingActionText: '',
      updatedAt: '2026-04-10 10:00',
    }, '测试用户')
  })

  const styleResult = generateStyleArchiveShellFromProject(project!.projectId, '测试用户')
  assert.ok(styleResult.ok && styleResult.style, '应先生成正式款式档案壳')

  const revisionResult = createRevisionTaskWithProjectRelation({
    projectId: project!.projectId,
    title: '改版任务-技术包测试',
    sourceType: '人工创建',
    ownerName: '测试用户',
    priorityLevel: '中',
    dueAt: '2026-04-20 18:00:00',
    productStyleCode: styleResult.style!.styleCode,
    spuCode: styleResult.style!.styleCode,
    revisionScopeCodes: ['PATTERN'],
    revisionScopeNames: ['版型结构'],
    operatorName: '测试用户',
  })
  assert.ok(revisionResult.ok && revisionResult.task, '应能创建改版任务测试数据')
  updateRevisionTask(revisionResult.task.revisionTaskId, {
    status: '已确认',
    updatedAt: '2026-04-10 11:00',
    updatedBy: '测试用户',
  })

  const plateResult = createPlateMakingTaskWithProjectRelation({
    projectId: project!.projectId,
    title: '制版任务-技术包测试',
    sourceType: '项目模板阶段',
    ownerName: '测试用户',
    priorityLevel: '中',
    dueAt: '2026-04-20 18:00:00',
    productStyleCode: styleResult.style!.styleCode,
    spuCode: styleResult.style!.styleCode,
    patternType: '连衣裙',
    sizeRange: 'S-XL',
    patternVersion: 'P1',
    operatorName: '测试用户',
  })
  assert.ok(plateResult.ok && plateResult.task, '应能创建制版任务测试数据')
  updatePlateMakingTask(plateResult.task.plateTaskId, {
    status: '已确认',
    updatedAt: '2026-04-10 11:10',
    updatedBy: '测试用户',
  })

  const patternResult = createPatternTaskWithProjectRelation({
    projectId: project!.projectId,
    title: '花型任务-技术包测试',
    sourceType: '项目模板阶段',
    ownerName: '测试用户',
    priorityLevel: '中',
    dueAt: '2026-04-20 18:00:00',
    productStyleCode: styleResult.style!.styleCode,
    spuCode: styleResult.style!.styleCode,
    artworkType: '印花',
    patternMode: '定位印',
    artworkName: '测试花型',
    artworkVersion: 'A1',
    operatorName: '测试用户',
  })
  assert.ok(patternResult.ok && patternResult.task, '应能创建花型任务测试数据')
  updatePatternTask(patternResult.task.patternTaskId, {
    status: '已确认',
    updatedAt: '2026-04-10 11:20',
    updatedBy: '测试用户',
  })

  const transferNode = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, 'PROJECT_TRANSFER_PREP')
  assert.ok(transferNode, '项目必须具备项目转档准备节点')

  return {
    projectId: project!.projectId,
    styleId: styleResult.style!.styleId,
    styleCode: styleResult.style!.styleCode,
    transferNodeId: transferNode!.projectNodeId,
    revisionTaskId: revisionResult.task.revisionTaskId,
    plateTaskId: plateResult.task.plateTaskId,
    patternTaskId: patternResult.task.patternTaskId,
  }
}

export function fillCoreTechPackContent(technicalVersionId: string, styleCode = 'SPU-TEST'): void {
  saveTechnicalDataVersionContent(
    technicalVersionId,
    {
      patternFiles: [
        {
          id: 'pattern-1',
          fileName: '主纸样.dxf',
          fileUrl: 'local://pattern-1',
          uploadedAt: '2026-04-10 10:00',
          uploadedBy: '测试用户',
        },
      ],
      processEntries: [
        {
          id: 'process-1',
          entryType: 'PROCESS_BASELINE',
          stageCode: 'PREP',
          stageName: '前准备',
          processCode: 'P001',
          processName: '车缝',
          assignmentGranularity: 'ORDER',
          defaultDocType: 'TASK',
          taskTypeMode: 'PROCESS',
          isSpecialCraft: false,
          standardTimeMinutes: 12,
          timeUnit: '分钟/件',
        },
      ],
      sizeTable: [
        {
          id: 'grading-1',
          part: '胸围',
          S: 48,
          M: 50,
          L: 52,
          XL: 54,
          tolerance: 1,
        },
      ],
      bomItems: [
        {
          id: 'bom-1',
          type: '面料',
          name: '主面料',
          spec: '95% 棉',
          unitConsumption: 1.2,
          lossRate: 0.03,
          supplier: '供应商甲',
        },
      ],
      qualityRules: [
        {
          id: 'quality-1',
          checkItem: '领口平整度',
          standardText: '无明显起皱与变形',
          samplingRule: '全检',
          note: '',
        },
      ],
      colorMaterialMappings: [
        {
          id: 'mapping-1',
          spuCode: styleCode,
          colorCode: 'BK',
          colorName: '黑色',
          status: 'CONFIRMED',
          generatedMode: 'MANUAL',
          lines: [
            {
              id: 'mapping-line-1',
              materialName: '主面料',
              materialType: '面料',
              unit: '米',
              sourceMode: 'MANUAL',
            },
          ],
        },
      ],
    },
    '测试用户',
  )
}

export function publishAndActivateTechPackVersion(
  styleId: string,
  technicalVersionId: string,
  operatorName = '测试用户',
) {
  const published = publishTechnicalDataVersion(technicalVersionId, operatorName)
  const activated = activateTechPackVersionForStyle(styleId, technicalVersionId, operatorName)
  return {
    published,
    activated,
  }
}
