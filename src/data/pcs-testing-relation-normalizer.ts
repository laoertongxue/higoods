import { findProjectByCode, findProjectNodeByWorkItemTypeCode, getProjectById } from './pcs-project-repository.ts'
import type { ProjectRelationPendingItem, ProjectRelationRecord } from './pcs-project-relation-types.ts'
import type { LiveProductLine, LiveSessionRecord } from './pcs-live-testing-types.ts'
import type { VideoTestRecord } from './pcs-video-testing-types.ts'

type TestingWorkItemTypeCode = 'LIVE_TEST' | 'VIDEO_TEST'

interface RelationBuildOptions {
  operatorName?: string
  note?: string
  legacyRefType?: string
  legacyRefValue?: string | null
}

export interface TestingRelationBuildResult {
  relation: ProjectRelationRecord | null
  pendingItem: ProjectRelationPendingItem | null
  errorMessage: string | null
}

export interface TestingRelationBatchResult {
  relations: ProjectRelationRecord[]
  pendingItems: ProjectRelationPendingItem[]
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
  legacyRefType: string
  legacyRefValue: string
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
    legacyRefType: input.legacyRefType,
    legacyRefValue: input.legacyRefValue,
  }
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
  workItemTypeCode: TestingWorkItemTypeCode
  workItemTypeNameHint: string
  operatorName: string
  note: string
  legacyRefType: string
  legacyRefValue: string
}): TestingRelationBuildResult {
  const project = resolveProject(input.projectIdOrCode)
  if (!project) {
    return {
      relation: null,
      pendingItem: buildPendingItem({
        sourceModule: input.sourceModule,
        sourceObjectCode: input.sourceLineCode || input.sourceObjectCode,
        rawProjectCode: input.projectIdOrCode,
        reason: '旧测款关系引用的商品项目不存在，当前未写入正式关系记录。',
        discoveredAt: input.businessDate || nowText(),
        sourceTitle: input.sourceTitle,
        legacyRefType: input.legacyRefType,
        legacyRefValue: input.legacyRefValue,
      }),
      errorMessage: '当前项目不存在，未写入正式项目关系记录。',
    }
  }

  const node = findProjectNodeByWorkItemTypeCode(project.projectId, input.workItemTypeCode)
  if (!node) {
    return {
      relation: null,
      pendingItem: buildPendingItem({
        sourceModule: input.sourceModule,
        sourceObjectCode: input.sourceLineCode || input.sourceObjectCode,
        rawProjectCode: project.projectCode,
        reason: '当前项目未配置对应测款工作项，请先检查项目模板与项目节点。',
        discoveredAt: input.businessDate || nowText(),
        sourceTitle: input.sourceTitle,
        legacyRefType: input.legacyRefType,
        legacyRefValue: input.legacyRefValue,
      }),
      errorMessage: '当前项目未配置对应测款工作项，请先检查项目模板与项目节点。',
    }
  }

  const timestamp = input.businessDate || nowText()
  return {
    relation: {
      projectRelationId: `rel_${project.projectId}_${node.projectNodeId}_${input.sourceLineCode || input.sourceObjectCode}`
        .replace(/[^a-zA-Z0-9]/g, '_'),
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectNodeId: node.projectNodeId,
      workItemTypeCode: input.workItemTypeCode,
      workItemTypeName: node.workItemTypeName || input.workItemTypeNameHint,
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
      legacyRefType: input.legacyRefType,
      legacyRefValue: input.legacyRefValue,
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
    workItemTypeCode: 'LIVE_TEST',
    workItemTypeNameHint: '直播测款',
    operatorName: options.operatorName || '系统初始化',
    note: options.note || '',
    legacyRefType: options.legacyRefType || '',
    legacyRefValue: options.legacyRefValue || '',
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
    workItemTypeCode: 'VIDEO_TEST',
    workItemTypeNameHint: '短视频测款',
    operatorName: options.operatorName || '系统初始化',
    note: options.note || '',
    legacyRefType: options.legacyRefType || '',
    legacyRefValue: options.legacyRefValue || '',
  })
}

export function normalizeLegacyLiveSessionHeaderRelation(input: {
  session: LiveSessionRecord
  productLines: LiveProductLine[]
  rawProjectCode: string
  rawProjectId?: string | null
  operatorName?: string
}): TestingRelationBatchResult {
  if (input.productLines.length !== 1) {
    return {
      relations: [],
      pendingItems: [
        buildPendingItem({
          sourceModule: '直播',
          sourceObjectCode: input.session.liveSessionCode,
          rawProjectCode: input.rawProjectCode,
          reason: '历史直播场次头项目字段对应多条直播商品明细，当前未自动猜测下移。',
          discoveredAt: input.session.businessDate || input.session.updatedAt || nowText(),
          sourceTitle: input.session.sessionTitle,
          legacyRefType: 'liveSession.projectRef',
          legacyRefValue: input.rawProjectId || input.rawProjectCode,
        }),
      ],
    }
  }

  const result = buildLiveProductLineProjectRelation(input.productLines[0], input.rawProjectId || input.rawProjectCode, {
    operatorName: input.operatorName || '系统初始化',
    note: '历史场次头项目字段已下移到唯一直播商品明细。',
    legacyRefType: 'liveSession.projectRef',
    legacyRefValue: input.rawProjectId || input.rawProjectCode || '',
  })

  return {
    relations: result.relation ? [result.relation] : [],
    pendingItems: result.pendingItem ? [result.pendingItem] : [],
  }
}
