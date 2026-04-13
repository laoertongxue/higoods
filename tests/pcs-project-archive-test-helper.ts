import assert from 'node:assert/strict'
import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  getProjectStoreSnapshot,
  replaceProjectStore,
  resetProjectRepository,
  updateProjectNodeRecord,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import { resetProjectRelationRepository } from '../src/data/pcs-project-relation-repository.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import { resetTechnicalDataVersionRepository } from '../src/data/pcs-technical-data-version-repository.ts'
import {
  replaceProjectArchiveStore,
  resetProjectArchiveRepository,
} from '../src/data/pcs-project-archive-repository.ts'
import { generateStyleArchiveShellFromProject } from '../src/data/pcs-project-style-archive-writeback.ts'
import {
  generateTechPackVersionFromPlateTask,
  publishTechnicalDataVersion,
  saveTechnicalDataVersionContent,
} from '../src/data/pcs-project-technical-data-writeback.ts'
import { activateTechPackVersionForStyle } from '../src/data/pcs-tech-pack-version-activation.ts'
import { recordSampleLedgerEvent } from '../src/data/pcs-sample-project-writeback.ts'
import { resetSampleAssetRepository } from '../src/data/pcs-sample-asset-repository.ts'
import { resetSampleLedgerRepository } from '../src/data/pcs-sample-ledger-repository.ts'
import { resetRevisionTaskRepository } from '../src/data/pcs-revision-task-repository.ts'
import { createPlateMakingTaskWithProjectRelation, createRevisionTaskWithProjectRelation, createFirstSampleTaskWithProjectRelation } from '../src/data/pcs-task-project-relation-writeback.ts'
import { getPlateMakingTaskById, resetPlateMakingTaskRepository, updatePlateMakingTask } from '../src/data/pcs-plate-making-repository.ts'
import { resetPatternTaskRepository } from '../src/data/pcs-pattern-task-repository.ts'
import { resetFirstSampleTaskRepository } from '../src/data/pcs-first-sample-repository.ts'
import { resetPreProductionSampleTaskRepository } from '../src/data/pcs-pre-production-sample-repository.ts'
import {
  createProjectArchive,
  uploadProjectArchiveManualDocument,
} from '../src/data/pcs-project-archive-sync.ts'
import { resetProjectChannelProductRepository } from '../src/data/pcs-channel-product-project-repository.ts'
import { resetLiveTestingRepository } from '../src/data/pcs-live-testing-repository.ts'
import { resetVideoTestingRepository } from '../src/data/pcs-video-testing-repository.ts'
import { completeFormalTestingPassForProject } from './pcs-project-formal-chain-helper.ts'

export interface ArchiveTestContext {
  projectId: string
  projectCode: string
  projectName: string
}

function emptyArchiveStore() {
  return {
    version: 1,
    records: [],
    documents: [],
    files: [],
    missingItems: [],
    pendingItems: [],
  }
}

export function resetArchiveScenarioRepositories(): void {
  resetProjectRepository()
  resetProjectRelationRepository()
  resetStyleArchiveRepository()
  resetTechnicalDataVersionRepository()
  resetProjectArchiveRepository()
  replaceProjectArchiveStore(emptyArchiveStore())
  resetSampleAssetRepository()
  resetSampleLedgerRepository()
  resetRevisionTaskRepository()
  resetPlateMakingTaskRepository()
  resetPatternTaskRepository()
  resetFirstSampleTaskRepository()
  resetPreProductionSampleTaskRepository()
  resetProjectChannelProductRepository()
  resetLiveTestingRepository()
  resetVideoTestingRepository()
}

export function createArchiveTestProject(suffix: string): ArchiveTestContext {
  const snapshot = getProjectStoreSnapshot()
  const baseProject =
    snapshot.projects.find(
      (item) =>
        getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'STYLE_ARCHIVE_CREATE') &&
        getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'PROJECT_TRANSFER_PREP') &&
        getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'SAMPLE_INBOUND_CHECK') &&
        getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'TEST_CONCLUSION') &&
        getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'CHANNEL_PRODUCT_LISTING') &&
        getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'LIVE_TEST') &&
        getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'SAMPLE_CONFIRM') &&
        getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'SAMPLE_COST_REVIEW') &&
        getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'SAMPLE_PRICING') &&
        getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'FIRST_SAMPLE'),
    ) ?? null
  assert.ok(baseProject, '应存在可用于项目资料归档测试的基础项目')

  const basePhases = snapshot.phases.filter((item) => item.projectId === baseProject!.projectId)
  const baseNodes = snapshot.nodes.filter((item) => item.projectId === baseProject!.projectId)
  const projectId = `prj_archive_test_${suffix}`
  const projectCode = `PRJ-ARCHIVE-${suffix.toUpperCase()}`
  const projectName = `项目资料归档测试项目-${suffix}`

  replaceProjectStore({
    version: snapshot.version,
    projects: [
      ...snapshot.projects,
      {
        ...baseProject!,
        projectId,
        projectCode,
        projectName,
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
        projectArchiveId: '',
        projectArchiveNo: '',
        projectArchiveStatus: '',
        projectArchiveDocumentCount: 0,
        projectArchiveFileCount: 0,
        projectArchiveMissingItemCount: 0,
        projectArchiveUpdatedAt: '',
        projectArchiveFinalizedAt: '',
      },
    ],
    phases: [
      ...snapshot.phases,
      ...basePhases.map((item) => ({
        ...item,
        projectId,
        projectPhaseId: `${item.projectPhaseId}_${suffix}`,
      })),
    ],
    nodes: [
      ...snapshot.nodes,
      ...baseNodes.map((item) => ({
        ...item,
        projectId,
        projectNodeId: `${item.projectNodeId}_${suffix}`,
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
        lastEventId: '',
        lastEventType: '',
        lastEventTime: '',
      })),
    ],
  })

  updateProjectRecord(
    projectId,
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
      projectArchiveId: '',
      projectArchiveNo: '',
      projectArchiveStatus: '',
      projectArchiveDocumentCount: 0,
      projectArchiveFileCount: 0,
      projectArchiveMissingItemCount: 0,
      projectArchiveUpdatedAt: '',
      projectArchiveFinalizedAt: '',
    },
    '测试用户',
  )

  ;[
    'STYLE_ARCHIVE_CREATE',
    'PROJECT_TRANSFER_PREP',
    'SAMPLE_INBOUND_CHECK',
    'TEST_CONCLUSION',
    'FIRST_SAMPLE',
  ].forEach((code) => {
    const node = getProjectNodeRecordByWorkItemTypeCode(projectId, code)
    if (!node) return
    updateProjectNodeRecord(
      projectId,
      node.projectNodeId,
      {
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
      },
      '测试用户',
    )
  })

  return { projectId, projectCode, projectName }
}

export function generateStyleShellForArchiveProject(projectId: string) {
  completeFormalTestingPassForProject(projectId)
  const result = generateStyleArchiveShellFromProject(projectId, '测试用户')
  assert.ok(result.ok && result.style, '测试项目应先生成正式款式档案壳')
  return result.style!
}

export function createDraftTechnicalVersionForArchiveProject(projectId: string) {
  const project = getProjectById(projectId)
  const plateTaskResult = createPlateMakingTaskWithProjectRelation({
    projectId,
    title: `制版任务-${projectId}`,
    sourceType: '项目模板阶段',
    ownerName: '测试用户',
    priorityLevel: '中',
    dueAt: '2026-04-20 18:00:00',
    productStyleCode: project?.linkedStyleCode || '',
    spuCode: project?.linkedStyleCode || '',
    patternType: '连衣裙',
    sizeRange: 'S-XL',
    patternVersion: 'P1',
    operatorName: '测试用户',
  })
  assert.ok(plateTaskResult.ok && plateTaskResult.task, '测试项目应能创建正式制版任务')
  updatePlateMakingTask(plateTaskResult.task.plateTaskId, {
    status: '已确认',
    updatedAt: '2026-04-10 10:10',
    updatedBy: '测试用户',
  })
  return generateTechPackVersionFromPlateTask(plateTaskResult.task.plateTaskId, '测试用户').record
}

export function createPublishedTechnicalVersionForArchiveProject(projectId: string) {
  const created = createDraftTechnicalVersionForArchiveProject(projectId)
  saveTechnicalDataVersionContent(
    created.technicalVersionId,
    {
      patternFiles: [
        {
          id: `pattern_${projectId}`,
          fileName: '主纸样.dxf',
          fileUrl: 'local://pattern',
          uploadedAt: '2026-04-10 10:00',
          uploadedBy: '测试用户',
        },
      ],
      processEntries: [
        {
          id: `process_${projectId}`,
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
          id: `size_${projectId}`,
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
          id: `bom_${projectId}`,
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
          id: `quality_${projectId}`,
          checkItem: '领口平整度',
          standardText: '无明显起皱与变形',
          samplingRule: '全检',
          note: '',
        },
      ],
      colorMaterialMappings: [
        {
          id: `mapping_${projectId}`,
          spuCode: created.styleCode,
          colorCode: 'BK',
          colorName: '黑色',
          status: 'CONFIRMED',
          generatedMode: 'MANUAL',
          lines: [
            {
              id: `mapping_line_${projectId}`,
              materialName: '主面料',
              materialType: '面料',
              unit: '米',
              sourceMode: 'MANUAL',
            },
          ],
        },
      ],
      patternDesigns: [
        {
          id: `design_${projectId}`,
          name: '基础花型',
          imageUrl: 'local://pattern-design',
        },
      ],
      attachments: [
        {
          id: `attachment_${projectId}`,
          fileName: '说明附件.pdf',
          fileType: 'PDF',
          fileSize: '128 KB',
          uploadedAt: '2026-04-10 10:00',
          uploadedBy: '测试用户',
          downloadUrl: 'local://attachment',
        },
      ],
    },
    '测试用户',
  )
  const published = publishTechnicalDataVersion(created.technicalVersionId, '测试用户')
  activateTechPackVersionForStyle(created.styleId, created.technicalVersionId, '测试用户')
  return published
}

export function recordInboundSampleForArchiveProject(projectId: string) {
  return recordSampleLedgerEvent({
    eventType: 'CHECKIN_VERIFY',
    sampleCode: `SAMPLE-${projectId}`,
    sampleName: '测试样衣',
    sampleType: '样衣',
    responsibleSite: '广州样衣仓',
    sourcePage: '样衣台账',
    sourceModule: '样衣台账',
    sourceDocType: '样衣获取单',
    sourceDocId: `doc_${projectId}`,
    sourceDocCode: `GET-${projectId}`,
    projectId,
    businessDate: '2026-04-10 11:00',
    operatorName: '测试用户',
    locationType: '仓库',
    locationCode: 'GZ',
    locationDisplay: '广州样衣仓',
    custodianType: '仓管',
    custodianName: '测试仓管',
  })
}

export function createRevisionRecordForArchiveProject(projectId: string) {
  return createRevisionTaskWithProjectRelation({
    projectId,
    title: '归档测试改版任务',
    sourceType: '人工创建',
    operatorName: '测试用户',
  })
}

export function createFirstSampleRecordForArchiveProject(projectId: string) {
  return createFirstSampleTaskWithProjectRelation({
    projectId,
    title: '归档测试首版样衣打样任务',
    sourceType: '人工创建',
    operatorName: '测试用户',
  })
}

export function createProjectArchiveForTest(projectId: string) {
  const result = createProjectArchive(projectId, '测试用户')
  assert.equal(result.ok, true, '测试项目应能创建正式项目资料归档对象')
  assert.ok(result.archive, '创建成功后应返回正式归档对象')
  return result.archive!
}

export function uploadRequiredManualDocuments(projectArchiveId: string) {
  uploadProjectArchiveManualDocument(
    projectArchiveId,
    {
      documentGroup: 'INSPECTION_FILE',
      title: '检测报告',
      note: '测试检测资料',
      files: [{ fileName: '检测报告.pdf', fileType: 'PDF', previewUrl: 'memory://inspection' }],
    },
    '测试用户',
  )
  return uploadProjectArchiveManualDocument(
    projectArchiveId,
    {
      documentGroup: 'QUOTATION_FILE',
      title: '报价单',
      note: '测试报价资料',
      files: [{ fileName: '报价单.xlsx', fileType: 'XLSX', previewUrl: 'memory://quotation' }],
    },
    '测试用户',
  )
}
