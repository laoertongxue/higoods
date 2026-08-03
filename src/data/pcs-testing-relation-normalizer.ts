import { findProjectByCode, findProjectNodeByStepCode, getProjectById } from './pcs-project-repository.ts'
import { buildProjectChannelProductChainSummary } from './pcs-channel-product-project-repository.ts'
import type { ProjectRelationPendingItem, ProjectRelationRecord } from './pcs-project-relation-types.ts'
import type { LiveProductLine } from './pcs-live-testing-types.ts'
import type { VideoTestRecord } from './pcs-video-testing-types.ts'

type TestingStepTypeCode = 'LIVE_TEST' | 'VIDEO_TEST'

interface RelationBuildOptions {
  operatorName?: string
  note?: string
}

export interface TestingRelationBuildResult {
  relation: ProjectRelationRecord | null
  pendingItem: ProjectRelationPendingItem | null
  errorMessage: string | null
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function resolveProject(projectIdOrCode: string | null | undefined) {
  if (!projectIdOrCode) return null
  return getProjectById(projectIdOrCode) ?? findProjectByCode(projectIdOrCode)
}

function buildPendingItem(input: {
  sourceModule: string
  sourceObjectCode: string
  rawProjectCode: string
  reason: string
  discoveredAt: string
  sourceTitle: string
}): ProjectRelationPendingItem {
  return {
    pendingRelationId: `pending_${input.sourceModule}_${input.sourceObjectCode}_${input.rawProjectCode || 'empty'}`
      .replace(/[^a-zA-Z0-9]/g, '_'),
    sourceModule: input.sourceModule,
    sourceObjectCode: input.sourceObjectCode,
    rawProjectCode: input.rawProjectCode,
    reason: input.reason,
    discoveredAt: input.discoveredAt,
    sourceTitle: input.sourceTitle,
  }
}

function hasEnteredTestingPhase(currentPhaseCode: string | null | undefined): boolean {
  return currentPhaseCode === 'PHASE_03' || currentPhaseCode === 'PHASE_04' || currentPhaseCode === 'PHASE_05'
}

function buildTestingGateFailure(input: {
  projectIdOrCode: string
  sourceModule: string
  sourceObjectCode: string
  sourceTitle: string
  businessDate: string
  reason: string
}): TestingRelationBuildResult {
  const project = resolveProject(input.projectIdOrCode)
  return {
    relation: null,
    pendingItem: buildPendingItem({
      sourceModule: input.sourceModule,
      sourceObjectCode: input.sourceObjectCode,
      rawProjectCode: project?.projectCode || input.projectIdOrCode,
      reason: input.reason,
      discoveredAt: input.businessDate || nowText(),
      sourceTitle: input.sourceTitle,
    }),
    errorMessage: input.reason,
  }
}

function validateTestingGate(input: {
  projectIdOrCode: string
  sourceModule: '直播' | '短视频'
  sourceObjectCode: string
  sourceTitle: string
  stepDefinitionLabel: string
  businessDate: string
}): TestingRelationBuildResult | null {
  const project = resolveProject(input.projectIdOrCode)
  if (!project) return null

  if (!hasEnteredTestingPhase(project.currentPhaseCode)) {
    return buildTestingGateFailure({
      ...input,
      reason: '当前项目尚未进入商品上架与市场测款阶段，不能建立正式测款关系。',
    })
  }

  const chain = buildProjectChannelProductChainSummary(project.projectId)
  if (!chain || !chain.currentChannelProductId) {
    return buildTestingGateFailure({
      ...input,
      reason: `当前项目未完成商品上架，不能建立正式${input.stepDefinitionLabel}关系。`,
    })
  }

  const channelProductStatus =
    chain.currentChannelProductStatus === '已完成'
      ? '已上架待测款'
      : chain.currentChannelProductStatus

  if (channelProductStatus !== '已上架待测款') {
    const reason =
      channelProductStatus === '待上传' || channelProductStatus === '已上传待确认'
        ? `当前项目未完成商品上架，不能建立正式${input.stepDefinitionLabel}关系。`
        : channelProductStatus === '已作废'
          ? `当前渠道店铺商品已作废，不能建立正式${input.stepDefinitionLabel}关系。`
          : channelProductStatus === '已生效'
            ? `当前渠道店铺商品已完成款式档案关联，不能再进入正式${input.stepDefinitionLabel}。`
            : `当前渠道店铺商品状态为${channelProductStatus || '未知状态'}，只有“已上架待测款”的项目才允许建立正式${input.stepDefinitionLabel}关系。`
    return buildTestingGateFailure({ ...input, reason })
  }

  if (!chain.currentUpstreamChannelProductCode) {
    return buildTestingGateFailure({
      ...input,
      reason: `当前渠道店铺商品尚未取得上游渠道商品编码，不能进入正式${input.stepDefinitionLabel}。`,
    })
  }
  return null
}

function buildTestingRelationRecord(input: {
  projectIdOrCode: string
  sourceModule: '直播' | '短视频'
  sourceObjectType: '直播商品明细' | '短视频记录'
  sourceObjectId: string
  sourceObjectCode: string
  sourceLineId: string | null
  sourceLineCode: string | null
  sourceTitle: string
  sourceStatus: string
  businessDate: string
  ownerName: string
  stepCode: TestingStepTypeCode
  stepNameHint: string
  operatorName: string
  note: string
}): TestingRelationBuildResult {
  const project = resolveProject(input.projectIdOrCode)
  if (!project) {
    return {
      relation: null,
      pendingItem: buildPendingItem({
        sourceModule: input.sourceModule,
        sourceObjectCode: input.sourceLineCode || input.sourceObjectCode,
        rawProjectCode: input.projectIdOrCode,
        reason: '当前商品项目不存在，未写入测款关系。',
        discoveredAt: input.businessDate || nowText(),
        sourceTitle: input.sourceTitle,
      }),
      errorMessage: '当前商品项目不存在，未写入测款关系。',
    }
  }

  const node = findProjectNodeByStepCode(project.projectId, input.stepCode)
  if (!node) {
    return {
      relation: null,
      pendingItem: buildPendingItem({
        sourceModule: input.sourceModule,
        sourceObjectCode: input.sourceLineCode || input.sourceObjectCode,
        rawProjectCode: project.projectCode,
        reason: '当前项目未配置对应测款步骤，请先检查商品项目。',
        discoveredAt: input.businessDate || nowText(),
        sourceTitle: input.sourceTitle,
      }),
      errorMessage: '当前项目未配置对应测款步骤，请先检查商品项目。',
    }
  }

  const gateFailure = validateTestingGate({
    projectIdOrCode: project.projectId,
    sourceModule: input.sourceModule,
    sourceObjectCode: input.sourceLineCode || input.sourceObjectCode,
    sourceTitle: input.sourceTitle,
    stepDefinitionLabel: input.stepNameHint,
    businessDate: input.businessDate,
  })
  if (gateFailure) return gateFailure

  const timestamp = input.businessDate || nowText()
  return {
    relation: {
      projectRelationId: `rel_${project.projectId}_${node.projectNodeId}_${input.sourceLineCode || input.sourceObjectCode}`
        .replace(/[^a-zA-Z0-9]/g, '_'),
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectNodeId: node.projectNodeId,
      stepCode: input.stepCode,
      stepName: node.stepName,
      relationRole: '执行记录',
      sourceModule: input.sourceModule,
      sourceObjectType: input.sourceObjectType,
      sourceObjectId: input.sourceObjectId,
      sourceObjectCode: input.sourceObjectCode,
      sourceLineId: input.sourceLineId,
      sourceLineCode: input.sourceLineCode,
      sourceTitle: input.sourceTitle,
      sourceStatus: input.sourceStatus,
      businessDate: timestamp,
      ownerName: input.ownerName,
      createdAt: timestamp,
      createdBy: input.operatorName,
      updatedAt: timestamp,
      updatedBy: input.operatorName,
      note: input.note,
    },
    pendingItem: null,
    errorMessage: null,
  }
}

export function buildLiveProductLineProjectRelation(
  line: LiveProductLine,
  projectIdOrCode: string,
  options: RelationBuildOptions = {},
): TestingRelationBuildResult {
  return buildTestingRelationRecord({
    projectIdOrCode,
    sourceModule: '直播',
    sourceObjectType: '直播商品明细',
    sourceObjectId: line.liveSessionId,
    sourceObjectCode: line.liveSessionCode,
    sourceLineId: line.liveLineId,
    sourceLineCode: line.liveLineCode,
    sourceTitle: line.productTitle,
    sourceStatus: line.sessionStatus,
    businessDate: line.businessDate,
    ownerName: line.ownerName,
    stepCode: 'LIVE_TEST',
    stepNameHint: '直播测款',
    operatorName: options.operatorName || '系统初始化',
    note: options.note || '',
  })
}

export function buildVideoRecordProjectRelation(
  record: VideoTestRecord,
  projectIdOrCode: string,
  options: RelationBuildOptions = {},
): TestingRelationBuildResult {
  return buildTestingRelationRecord({
    projectIdOrCode,
    sourceModule: '短视频',
    sourceObjectType: '短视频记录',
    sourceObjectId: record.videoRecordId,
    sourceObjectCode: record.videoRecordCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: record.videoTitle,
    sourceStatus: record.recordStatus,
    businessDate: record.businessDate,
    ownerName: record.ownerName,
    stepCode: 'VIDEO_TEST',
    stepNameHint: '短视频测款',
    operatorName: options.operatorName || '系统初始化',
    note: options.note || '',
  })
}
