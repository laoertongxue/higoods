import assert from 'node:assert/strict'

import {
  getProjectById,
  getProjectNodeRecordByWorkItemTypeCode,
  listProjects,
  resetProjectRepository,
  updateProjectNodeRecord,
  updateProjectRecord,
} from '../src/data/pcs-project-repository.ts'
import {
  replaceLiveProductLineProjectRelations,
  replaceVideoRecordProjectRelations,
  resetProjectRelationRepository,
} from '../src/data/pcs-project-relation-repository.ts'
import {
  buildProjectChannelProductChainSummary,
  createProjectChannelProductFromListingNode,
  launchProjectChannelProductListing,
  listProjectChannelProductsByProjectId,
  resetProjectChannelProductRepository,
  submitProjectTestingConclusion,
  submitProjectTestingSummary,
} from '../src/data/pcs-channel-product-project-repository.ts'
import { generateStyleArchiveShellFromProject } from '../src/data/pcs-project-style-archive-writeback.ts'
import { resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  generateTechPackVersionFromPlateTask,
  publishTechnicalDataVersion,
  saveTechnicalDataVersionContent,
} from '../src/data/pcs-project-technical-data-writeback.ts'
import { activateTechPackVersionForStyle } from '../src/data/pcs-tech-pack-version-activation.ts'
import {
  createPlateMakingTaskWithProjectRelation,
} from '../src/data/pcs-task-project-relation-writeback.ts'
import {
  resetPlateMakingTaskRepository,
  updatePlateMakingTask,
} from '../src/data/pcs-plate-making-repository.ts'
import { resetTechnicalDataVersionRepository } from '../src/data/pcs-technical-data-version-repository.ts'

function prepareEligibleProject() {
  resetProjectRepository()
  resetProjectRelationRepository()
  resetProjectChannelProductRepository()
  resetStyleArchiveRepository()
  resetTechnicalDataVersionRepository()
  resetPlateMakingTaskRepository()

  const project =
    listProjects().find(
      (item) =>
        !listProjectChannelProductsByProjectId(item.projectId).length &&
        Boolean(getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'CHANNEL_PRODUCT_LISTING')) &&
        Boolean(getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'TEST_DATA_SUMMARY')) &&
        Boolean(getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'TEST_CONCLUSION')) &&
        Boolean(getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'STYLE_ARCHIVE_CREATE')) &&
        Boolean(getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'PROJECT_TRANSFER_PREP')) &&
        Boolean(getProjectNodeRecordByWorkItemTypeCode(item.projectId, 'PATTERN_TASK')),
    ) || null
  assert.ok(project, '应存在可用于正式业务闭环校验的商品项目')

  updateProjectRecord(
    project!.projectId,
    {
      projectStatus: '进行中',
      currentPhaseCode: 'PHASE_03',
      currentPhaseName: '商品上架与市场测款',
      blockedFlag: false,
      blockedReason: '',
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

  ;['SAMPLE_CONFIRM', 'SAMPLE_COST_REVIEW', 'SAMPLE_PRICING'].forEach((code) => {
    const node = getProjectNodeRecordByWorkItemTypeCode(project!.projectId, code)
    if (!node) return
    updateProjectNodeRecord(
      project!.projectId,
      node.projectNodeId,
      {
        currentStatus: '已完成',
        latestResultType: '已完成',
        latestResultText: `${node.workItemTypeName}已完成。`,
        updatedAt: '2026-04-11 10:00',
      },
      '测试用户',
    )
  })

  return getProjectById(project!.projectId)!
}

const project = prepareEligibleProject()

const created = createProjectChannelProductFromListingNode(
  project.projectId,
  {
    targetChannelCode: project.targetChannelCodes[0] || 'tiktok-shop',
    listingTitle: `${project.projectName} 正式测款渠道商品`,
    listingPrice: 239,
    currency: 'CNY',
  },
  '测试用户',
)
assert.equal(created.ok, true, '应能从商品上架节点创建正式渠道商品')
assert.ok(created.record?.channelProductCode, '创建成功后应生成渠道商品编码')
assert.equal(created.record?.channelProductStatus, '待上架', '新建渠道商品后状态必须为待上架')

const launched = launchProjectChannelProductListing(created.record!.channelProductId, '测试用户')
assert.equal(launched.ok, true, '应能发起正式上架')
assert.ok(launched.record?.upstreamChannelProductCode, '发起上架后必须回填上游渠道商品编码')
assert.equal(launched.record?.channelProductStatus, '已上架待测款', '发起上架后状态必须为已上架待测款')

replaceLiveProductLineProjectRelations('LS-20260404-011__item-001', [project.projectId], '测试用户')
replaceVideoRecordProjectRelations('SV-PJT-012', [project.projectId], '测试用户')

const summary = submitProjectTestingSummary(project.projectId, {}, '测试用户')
assert.equal(summary.ok, true, '存在正式直播或短视频关系时应能提交测款汇总')
assert.ok(summary.summaryText?.includes('正式测款记录'), '测款汇总应写回正式汇总结果')

const conclusion = submitProjectTestingConclusion(
  project.projectId,
  {
    conclusion: '通过',
    note: '测款通过，进入款式档案生成。',
  },
  '测试用户',
)
assert.equal(conclusion.ok, true, '应能提交测款通过结论')

const passedProject = getProjectById(project.projectId)
assert.equal(passedProject?.currentPhaseCode, 'PHASE_04', '测款通过后应进入款式档案与开发推进阶段')

const styleReadyNode = getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'STYLE_ARCHIVE_CREATE')
assert.equal(styleReadyNode?.currentStatus, '进行中', '测款通过后应解锁生成款式档案节点')
assert.equal(styleReadyNode?.pendingActionType, '生成款式档案', '测款通过后待处理事项应指向生成款式档案')

const styleResult = generateStyleArchiveShellFromProject(project.projectId, '测试用户')
assert.equal(styleResult.ok, true, '测款通过后应能显式生成款式档案')
assert.equal(styleResult.style?.archiveStatus, 'DRAFT', '技术包启用前，款式档案必须保持技术包待完善')

const plateTaskResult = createPlateMakingTaskWithProjectRelation({
  projectId: project.projectId,
  title: `${project.projectName} 制版推进`,
  sourceType: '项目模板阶段',
  ownerName: project.ownerName,
  priorityLevel: project.priorityLevel,
  dueAt: '2026-04-20 18:00:00',
  productStyleCode: styleResult.style!.styleCode,
  spuCode: styleResult.style!.styleCode,
  patternType: project.categoryName,
  sizeRange: 'S-XL',
  patternVersion: 'P1',
  operatorName: '测试用户',
})
assert.equal(plateTaskResult.ok, true, '应能创建正式制版任务')
assert.ok(plateTaskResult.task, '创建制版任务后应返回正式任务记录')

updatePlateMakingTask(plateTaskResult.task!.plateTaskId, {
  status: '已确认',
  updatedAt: '2026-04-11 10:30',
  updatedBy: '测试用户',
})

const draftVersion = generateTechPackVersionFromPlateTask(plateTaskResult.task!.plateTaskId, '测试用户')
assert.ok(draftVersion.record, '制版任务应能正式生成技术包版本草稿')
assert.ok(draftVersion.record, '应回写正式技术包版本记录')

saveTechnicalDataVersionContent(
  draftVersion.record!.technicalVersionId,
  {
    patternFiles: [
      {
        id: 'pattern-closure-1',
        fileName: '主纸样.dxf',
        fileUrl: 'local://pattern-closure-1',
        uploadedAt: '2026-04-11 10:40',
        uploadedBy: '测试用户',
      },
    ],
    processEntries: [
      {
        id: 'process-closure-1',
        entryType: 'PROCESS_BASELINE',
        stageCode: 'PREP',
        stageName: '前准备',
        processCode: 'P001',
        processName: '车缝',
        assignmentGranularity: 'ORDER',
        defaultDocType: 'TASK',
        taskTypeMode: 'PROCESS',
        isSpecialCraft: false,
        standardTimeMinutes: 10,
        timeUnit: '分钟/件',
      },
    ],
    sizeTable: [
      { id: 'size-closure-1', part: '胸围', S: 48, M: 50, L: 52, XL: 54, tolerance: 1 },
    ],
    bomItems: [
      {
        id: 'bom-closure-1',
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
        id: 'quality-closure-1',
        checkItem: '领口平整度',
        standardText: '无明显起皱与变形',
        samplingRule: '全检',
        note: '',
      },
    ],
    colorMaterialMappings: [
      {
        id: 'mapping-closure-1',
        spuCode: styleResult.style!.styleCode,
        colorCode: 'BK',
        colorName: '黑色',
        status: 'CONFIRMED',
        generatedMode: 'MANUAL',
        lines: [
          {
            id: 'mapping-line-closure-1',
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

publishTechnicalDataVersion(draftVersion.record!.technicalVersionId, '测试用户')
activateTechPackVersionForStyle(styleResult.style!.styleId, draftVersion.record!.technicalVersionId, '测试用户')

const chain = buildProjectChannelProductChainSummary(project.projectId)
assert.ok(chain, '完整闭环后必须能读取正式链路摘要')
assert.equal(chain?.linkedStyleStatus, '可生产', '技术包启用后款式档案状态必须为可生产')
assert.equal(chain?.currentUpstreamSyncStatus, '已更新', '技术包启用后必须完成上游最终更新')
assert.ok(chain?.linkedTechPackVersionCode, '技术包启用后链路摘要必须带技术包版本编码')
assert.ok(chain?.currentChannelProductCode && chain?.currentUpstreamChannelProductCode && chain?.linkedStyleCode, '三码关联必须完整可见')

console.log('check-pcs-project-formal-closure.ts PASS')
