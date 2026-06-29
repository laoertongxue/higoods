import {
  findProjectByCode,
  findProjectNodeByWorkItemTypeCode,
} from './pcs-project-repository.ts'
import { findStyleArchiveByProjectId, findStyleArchiveByCode, listStyleArchives } from './pcs-style-archive-repository.ts'
import type {
  ProjectRelationPendingItem,
  ProjectRelationRecord,
  ProjectRelationSourceModule,
  ProjectRelationSourceObjectType,
} from './pcs-project-relation-types.ts'
import type { PcsTaskPendingItem } from './pcs-project-types.ts'
import type { FirstSampleTaskRecord } from './pcs-first-sample-types.ts'
import type { PatternTaskRecord } from './pcs-pattern-task-types.ts'
import type { PlateMakingTaskRecord } from './pcs-plate-making-types.ts'
import type { FirstOrderSampleTaskRecord } from './pcs-first-order-sample-types.ts'
import type { RevisionTaskRecord } from './pcs-revision-task-types.ts'

export interface TaskBootstrapSnapshot {
  revisionTasks: RevisionTaskRecord[]
  revisionPendingItems: PcsTaskPendingItem[]
  plateTasks: PlateMakingTaskRecord[]
  platePendingItems: PcsTaskPendingItem[]
  patternTasks: PatternTaskRecord[]
  patternPendingItems: PcsTaskPendingItem[]
  firstSampleTasks: FirstSampleTaskRecord[]
  firstSamplePendingItems: PcsTaskPendingItem[]
  firstOrderSampleTasks: FirstOrderSampleTaskRecord[]
  firstOrderSamplePendingItems: PcsTaskPendingItem[]
}

export interface TaskRelationBootstrapSnapshot {
  relations: ProjectRelationRecord[]
  pendingItems: ProjectRelationPendingItem[]
}

function pendingItem(
  taskType: string,
  rawTaskCode: string,
  rawProjectField: string,
  rawSourceField: string,
  reason: string,
  discoveredAt: string,
): PcsTaskPendingItem {
  return {
    pendingId: `${taskType}_${rawTaskCode}`.replace(/[^a-zA-Z0-9]/g, '_'),
    taskType,
    rawTaskCode,
    rawProjectField,
    rawSourceField,
    reason,
    discoveredAt,
  }
}

function pickProjectByCode(projectCode: string) {
  return findProjectByCode(projectCode) ?? null
}

function pickStyleByProjectCode(projectCode: string) {
  const project = pickProjectByCode(projectCode)
  if (!project) return null
  return findStyleArchiveByProjectId(project.projectId) ?? null
}

function pickStyleByCode(styleCode: string) {
  return findStyleArchiveByCode(styleCode) ?? listStyleArchives().find((item) => item.styleCode === styleCode) ?? null
}

function relationPendingItem(
  sourceModule: string,
  sourceObjectCode: string,
  rawProjectCode: string,
  reason: string,
  discoveredAt: string,
  legacyRefValue: string,
): ProjectRelationPendingItem {
  return {
    pendingRelationId: `${sourceModule}_${sourceObjectCode}`.replace(/[^a-zA-Z0-9]/g, '_'),
    sourceModule,
    sourceObjectCode,
    rawProjectCode,
    reason,
    discoveredAt,
    sourceTitle: '',
    legacyRefType: '任务迁移',
    legacyRefValue,
  }
}

function taskRelationRecord(input: {
  projectId: string
  projectCode: string
  projectNodeId: string
  workItemTypeCode: string
  workItemTypeName: string
  sourceModule: ProjectRelationSourceModule
  sourceObjectType: ProjectRelationSourceObjectType
  sourceObjectId: string
  sourceObjectCode: string
  sourceTitle: string
  sourceStatus: string
  businessDate: string
  ownerName: string
  relationRole?: ProjectRelationRecord['relationRole']
  note?: string
}): ProjectRelationRecord {
  return {
    projectRelationId: `rel_bootstrap_${input.projectId}_${input.projectNodeId}_${input.sourceObjectId}`.replace(/[^a-zA-Z0-9]/g, '_'),
    projectId: input.projectId,
    projectCode: input.projectCode,
    projectNodeId: input.projectNodeId,
    workItemTypeCode: input.workItemTypeCode,
    workItemTypeName: input.workItemTypeName,
    relationRole: input.relationRole || '产出对象',
    sourceModule: input.sourceModule,
    sourceObjectType: input.sourceObjectType,
    sourceObjectId: input.sourceObjectId,
    sourceObjectCode: input.sourceObjectCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: input.sourceTitle,
    sourceStatus: input.sourceStatus,
    businessDate: input.businessDate,
    ownerName: input.ownerName,
    createdAt: input.businessDate,
    createdBy: '系统初始化',
    updatedAt: input.businessDate,
    updatedBy: '系统初始化',
    note: input.note || '历史任务已迁移为正式项目关系。',
    legacyRefType: '任务迁移',
    legacyRefValue: input.sourceObjectCode,
  }
}

function firstSampleRelationMeta(task: FirstSampleTaskRecord): string {
  return JSON.stringify({
    sourceTaskType: task.sourceTaskType,
    sourceTaskId: task.sourceTaskId,
    sourceTaskCode: task.sourceTaskCode,
    sourceTechPackVersionId: task.sourceTechPackVersionId,
    sourceTechPackVersionCode: task.sourceTechPackVersionCode,
    sourceTechPackVersionLabel: task.sourceTechPackVersionLabel,
    factoryId: task.factoryId,
    factoryName: task.factoryName,
    targetSite: task.targetSite,
    sampleMaterialMode: task.sampleMaterialMode,
    samplePurpose: task.samplePurpose,
    sampleCode: task.sampleCode,
    sampleImageIds: Array.isArray(task.sampleImageIds) ? [...task.sampleImageIds] : [],
    fitConfirmationSummary: task.fitConfirmationSummary,
    artworkConfirmationSummary: task.artworkConfirmationSummary,
    productionReadinessNote: task.productionReadinessNote,
    reuseAsFirstOrderBasisFlag: task.reuseAsFirstOrderBasisFlag,
    reuseAsFirstOrderBasisConfirmedAt: task.reuseAsFirstOrderBasisConfirmedAt,
    reuseAsFirstOrderBasisConfirmedBy: task.reuseAsFirstOrderBasisConfirmedBy,
    reuseAsFirstOrderBasisNote: task.reuseAsFirstOrderBasisNote,
    confirmedAt: task.confirmedAt,
    sourceType: task.sourceType,
    upstreamModule: task.upstreamModule,
    upstreamObjectType: task.upstreamObjectType,
    upstreamObjectId: task.upstreamObjectId,
    upstreamObjectCode: task.upstreamObjectCode,
    status: task.status,
  })
}

function firstOrderRelationMeta(task: FirstOrderSampleTaskRecord): string {
  return JSON.stringify({
    sourceFirstSampleTaskId: task.sourceFirstSampleTaskId,
    sourceFirstSampleTaskCode: task.sourceFirstSampleTaskCode,
    sourceFirstSampleCode: task.sourceFirstSampleCode,
    sourceTechPackVersionId: task.sourceTechPackVersionId,
    sourceTechPackVersionCode: task.sourceTechPackVersionCode,
    sourceTechPackVersionLabel: task.sourceTechPackVersionLabel,
    factoryId: task.factoryId,
    factoryName: task.factoryName,
    targetSite: task.targetSite,
    sampleChainMode: task.sampleChainMode,
    specialSceneReasonCodes: [...task.specialSceneReasonCodes],
    specialSceneReasonText: task.specialSceneReasonText,
    productionReferenceRequiredFlag: task.productionReferenceRequiredFlag,
    chinaReviewRequiredFlag: task.chinaReviewRequiredFlag,
    correctFabricRequiredFlag: task.correctFabricRequiredFlag,
    samplePlanLines: task.samplePlanLines.map((line) => ({ ...line })),
    finalReferenceNote: task.finalReferenceNote,
    patternVersion: task.patternVersion,
    artworkVersion: task.artworkVersion,
    sampleCode: task.sampleCode,
    conclusionResult: task.conclusionResult,
    conclusionNote: task.conclusionNote,
    confirmedAt: task.confirmedAt,
    confirmedBy: task.confirmedBy,
    sourceType: task.sourceType,
    upstreamModule: task.upstreamModule,
    upstreamObjectType: task.upstreamObjectType,
    upstreamObjectId: task.upstreamObjectId,
    upstreamObjectCode: task.upstreamObjectCode,
    status: task.status,
  })
}

function revisionExecutionSeed(input: {
  styleId?: string
  styleCode?: string
  styleName?: string
  ownerName?: string
  imageId?: string
  sampleQty?: number
  liveRetestRequired?: boolean
}): Pick<
  RevisionTaskRecord,
  | 'baseStyleId'
  | 'baseStyleCode'
  | 'baseStyleName'
  | 'baseStyleImageIds'
  | 'targetStyleCodeCandidate'
  | 'targetStyleNameCandidate'
  | 'targetStyleImageIds'
  | 'sampleQty'
  | 'stylePreference'
  | 'patternMakerId'
  | 'patternMakerName'
  | 'revisionSuggestionRichText'
  | 'paperPrintAt'
  | 'deliveryAddress'
  | 'patternArea'
  | 'materialAdjustmentLines'
  | 'newPatternImageIds'
  | 'newPatternSpuCode'
  | 'patternChangeNote'
  | 'patternPieceImageIds'
  | 'patternFileIds'
  | 'mainImageIds'
  | 'designDraftImageIds'
  | 'liveRetestRequired'
  | 'liveRetestStatus'
  | 'liveRetestRelationIds'
  | 'liveRetestSummary'
  | 'generatedNewTechPackVersionFlag'
  | 'generatedNewTechPackVersionAt'
> {
  const imageId = input.imageId || ''
  return {
    baseStyleId: input.styleId || '',
    baseStyleCode: input.styleCode || '',
    baseStyleName: input.styleName || '',
    baseStyleImageIds: imageId ? [imageId] : [],
    targetStyleCodeCandidate: input.styleCode ? `${input.styleCode}-R` : '',
    targetStyleNameCandidate: input.styleName ? `${input.styleName}改版款` : '',
    targetStyleImageIds: imageId ? [imageId] : [],
    sampleQty: input.sampleQty || 2,
    stylePreference: '保留旧款卖点，优化直播呈现。',
    patternMakerId: '',
    patternMakerName: input.ownerName || '',
    revisionSuggestionRichText: '按测款反馈调整版型、面辅料或花型细节。',
    paperPrintAt: '',
    deliveryAddress: '深圳样衣室',
    patternArea: '深圳',
    materialAdjustmentLines: [],
    newPatternImageIds: [],
    newPatternSpuCode: '',
    patternChangeNote: '',
    patternPieceImageIds: [],
    patternFileIds: [],
    mainImageIds: imageId ? [imageId] : [],
    designDraftImageIds: [],
    liveRetestRequired: Boolean(input.liveRetestRequired),
    liveRetestStatus: input.liveRetestRequired ? '待回直播验证' : '不需要',
    liveRetestRelationIds: [],
    liveRetestSummary: '',
    generatedNewTechPackVersionFlag: false,
    generatedNewTechPackVersionAt: '',
  }
}

function createRevisionSeeds(): { tasks: RevisionTaskRecord[]; pendingItems: PcsTaskPendingItem[] } {
  const tasks: RevisionTaskRecord[] = []
  const projectA = pickProjectByCode('PRJ-20251216-001')
  const projectB = pickProjectByCode('PRJ-20251216-010')
  const nodeA = projectA
    ? findProjectNodeByWorkItemTypeCode(projectA.projectId, 'REVISION_TASK') ?? findProjectNodeByWorkItemTypeCode(projectA.projectId, 'TEST_CONCLUSION')
    : null
  const nodeB = projectB
    ? findProjectNodeByWorkItemTypeCode(projectB.projectId, 'REVISION_TASK') ?? findProjectNodeByWorkItemTypeCode(projectB.projectId, 'TEST_CONCLUSION')
    : null

  if (projectA && nodeA) {
    const styleA = findStyleArchiveByProjectId(projectA.projectId)
    tasks.push({
      revisionTaskId: 'RT-20260109-003',
      revisionTaskCode: 'RT-20260109-003',
      title: '印尼风格碎花连衣裙改版（领口、腰节、面料克重）',
      projectId: projectA.projectId,
      projectCode: projectA.projectCode,
      projectName: projectA.projectName,
      projectNodeId: nodeA.projectNodeId,
      workItemTypeCode: 'REVISION_TASK',
      workItemTypeName: '改版任务',
      sourceType: '测款结论返改',
      upstreamModule: '测款结论',
      upstreamObjectType: '项目工作项',
      upstreamObjectId: nodeA.projectNodeId,
      upstreamObjectCode: 'WI-20260108-011',
      styleId: styleA?.styleId || '',
      styleCode: styleA?.styleCode || 'SPU-LY-2401',
      styleName: styleA?.styleName || projectA.projectName,
      referenceObjectType: '',
      referenceObjectId: '',
      referenceObjectCode: '',
      referenceObjectName: '',
      productStyleCode: styleA?.styleCode || 'SPU-LY-2401',
      spuCode: styleA?.styleCode || 'SPU-LY-2401',
      status: '进行中',
      ownerId: projectA.ownerId,
      ownerName: '李版师',
      participantNames: ['王测款', '张仓管'],
      priorityLevel: '高',
      dueAt: '2026-01-15 18:00:00',
      revisionScopeCodes: ['PATTERN', 'SIZE', 'FABRIC'],
      revisionScopeNames: ['版型结构', '尺码规格', '面料'],
      revisionVersion: '',
      issueSummary: '领口开口偏大，腰节位置偏低，面料克重不利于直播镜头呈现。',
      evidenceSummary: '直播测款评论、试穿反馈和面料手感评审记录已确认上述问题。',
      evidenceImageUrls: [],
      ...revisionExecutionSeed({
        styleId: styleA?.styleId || '',
        styleCode: styleA?.styleCode || 'SPU-LY-2401',
        styleName: styleA?.styleName || projectA.projectName,
        ownerName: '李版师',
        liveRetestRequired: true,
      }),
      createdAt: '2026-01-09 09:30:00',
      createdBy: '系统初始化',
      updatedAt: '2026-01-09 14:30:00',
      updatedBy: '系统初始化',
      note: '历史改版任务已迁移到正式仓储。',
      legacyProjectRef: projectA.projectCode,
      legacyUpstreamRef: 'WI-20260108-011',
    })
  }

  const styleB = pickStyleByProjectCode('PRJ-20251216-010') || listStyleArchives()[0] || null
  if (styleB) {
    tasks.push({
      revisionTaskId: 'RT-20260108-002',
      revisionTaskCode: 'RT-20260108-002',
      title: '波西米亚印花长裙花型与颜色改版',
      projectId: '',
      projectCode: '',
      projectName: '',
      projectNodeId: '',
      workItemTypeCode: 'REVISION_TASK',
      workItemTypeName: '改版任务',
      sourceType: '既有商品改款',
      upstreamModule: '款式档案',
      upstreamObjectType: '款式档案',
      upstreamObjectId: styleB.styleId,
      upstreamObjectCode: styleB.styleCode,
      styleId: styleB.styleId,
      styleCode: styleB.styleCode,
      styleName: styleB.styleName,
      referenceObjectType: '',
      referenceObjectId: '',
      referenceObjectCode: '',
      referenceObjectName: '',
      productStyleCode: styleB.styleCode,
      spuCode: styleB.styleCode,
      status: '待确认',
      ownerId: '',
      ownerName: '王版师',
      participantNames: ['李设计'],
      priorityLevel: '中',
      dueAt: '2026-01-18 18:00:00',
      revisionScopeCodes: ['PRINT', 'COLOR'],
      revisionScopeNames: ['花型', '颜色'],
      revisionVersion: 'R1',
      issueSummary: '原款花型节奏偏密、主色偏暗，既有商品复刻后缺少夏季轻快感。',
      evidenceSummary: '对比门店反馈、竞品陈列照片和既有款销售评论后确认需要调整。',
      evidenceImageUrls: [],
      ...revisionExecutionSeed({
        styleId: styleB.styleId,
        styleCode: styleB.styleCode,
        styleName: styleB.styleName,
        ownerName: '王版师',
        liveRetestRequired: true,
      }),
      linkedTechPackVersionId: '',
      linkedTechPackVersionCode: '',
      linkedTechPackVersionLabel: '',
      linkedTechPackVersionStatus: '',
      linkedTechPackUpdatedAt: '',
      createdAt: '2026-01-08 10:00:00',
      createdBy: '系统初始化',
      updatedAt: '2026-01-09 11:00:00',
      updatedBy: '系统初始化',
      note: '历史既有商品改款任务已迁移。',
      legacyProjectRef: '',
      legacyUpstreamRef: styleB.styleCode,
    })
  }

  ;[
    {
      projectCode: 'PRJ-20251216-016',
      revisionTaskId: 'RT-20260401-016',
      revisionTaskCode: 'RT-20260401-016',
      title: '基础款波点雪纺连衣裙改版（腰节、版长、花型密度）',
      productStyleCode: 'SPU-2026-016',
      spuCode: 'SPU-2026-016',
      status: '进行中' as const,
      ownerName: '李版师',
      participantNames: ['张工', '王测款'],
      priorityLevel: '高' as const,
      dueAt: '2026-04-08 18:00:00',
      revisionScopeCodes: ['PATTERN', 'PRINT'],
      revisionScopeNames: ['版型结构', '花型密度'],
      createdAt: '2026-04-01 09:30:00',
      updatedAt: '2026-04-02 15:00:00',
    },
    {
      projectCode: 'PRJ-202604-013',
      revisionTaskId: 'RT-20260401-017',
      revisionTaskCode: 'RT-20260401-017',
      title: '镂空蕾丝拼接上衣改版（袖长、拼接比例、花型位置）',
      productStyleCode: 'SPU-2026-017',
      spuCode: 'SPU-2026-017',
      status: '待确认' as const,
      ownerName: '王版师',
      participantNames: ['李工', '陈设计'],
      priorityLevel: '中' as const,
      dueAt: '2026-04-09 18:00:00',
      revisionScopeCodes: ['PATTERN', 'FABRIC'],
      revisionScopeNames: ['版型结构', '面料效果'],
      createdAt: '2026-04-01 10:20:00',
      updatedAt: '2026-04-03 11:40:00',
    },
    {
      projectCode: 'PRJ-202604-014',
      revisionTaskId: 'RT-20260402-018',
      revisionTaskCode: 'RT-20260402-018',
      title: '修身弹力牛仔裤改版（版型结构、贴章花型、腰部工艺）',
      productStyleCode: 'SPU-2026-018',
      spuCode: 'SPU-2026-018',
      status: '已确认' as const,
      ownerName: '林版师',
      participantNames: ['李娜', '张工'],
      priorityLevel: '高' as const,
      dueAt: '2026-04-10 18:00:00',
      revisionScopeCodes: ['PRINT', 'PATTERN'],
      revisionScopeNames: ['花型', '版型结构'],
      createdAt: '2026-04-02 09:00:00',
      updatedAt: '2026-04-03 16:20:00',
    },
  ].forEach((item) => {
    const project = pickProjectByCode(item.projectCode)
    const node = project
      ? findProjectNodeByWorkItemTypeCode(project.projectId, 'REVISION_TASK') ?? findProjectNodeByWorkItemTypeCode(project.projectId, 'TEST_CONCLUSION')
      : null
    const style = project ? findStyleArchiveByProjectId(project.projectId) : null
    if (!project || !node) return
    tasks.push({
      revisionTaskId: item.revisionTaskId,
      revisionTaskCode: item.revisionTaskCode,
      title: item.title,
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectNodeId: node.projectNodeId,
      workItemTypeCode: 'REVISION_TASK',
      workItemTypeName: '改版任务',
      sourceType: '测款结论返改',
      upstreamModule: '测款结论',
      upstreamObjectType: '项目工作项',
      upstreamObjectId: node.projectNodeId,
      upstreamObjectCode: node.projectNodeId,
      styleId: style?.styleId || '',
      styleCode: style?.styleCode || item.productStyleCode,
      styleName: style?.styleName || project.projectName,
      referenceObjectType: '',
      referenceObjectId: '',
      referenceObjectCode: '',
      referenceObjectName: '',
      productStyleCode: style?.styleCode || item.productStyleCode,
      spuCode: style?.styleCode || item.spuCode,
      status: item.status,
      ownerId: project.ownerId,
      ownerName: item.ownerName,
      participantNames: item.participantNames,
      priorityLevel: item.priorityLevel,
      dueAt: item.dueAt,
      revisionScopeCodes: item.revisionScopeCodes,
      revisionScopeNames: item.revisionScopeNames,
      revisionVersion: '',
      issueSummary: '测款与评审结论已汇总，需要据此调整当前款式的重点问题。',
      evidenceSummary: '来源于测款结论、样衣评审和复盘记录的正式结论摘要。',
      evidenceImageUrls: [],
      ...revisionExecutionSeed({
        styleId: style?.styleId || '',
        styleCode: style?.styleCode || item.productStyleCode,
        styleName: style?.styleName || project.projectName,
        ownerName: item.ownerName,
        liveRetestRequired: true,
      }),
      linkedTechPackVersionId: '',
      linkedTechPackVersionCode: '',
      linkedTechPackVersionLabel: '',
      linkedTechPackVersionStatus: '',
      linkedTechPackUpdatedAt: '',
      createdAt: item.createdAt,
      createdBy: '系统初始化',
      updatedAt: item.updatedAt,
      updatedBy: '系统初始化',
      note: '补充的演示改版任务。',
      legacyProjectRef: project.projectCode,
      legacyUpstreamRef: node.projectNodeId,
    })
  })

  const manualStyle = pickStyleByCode('SPU-2026-018') || listStyleArchives()[1] || listStyleArchives()[0] || null
  if (manualStyle) {
    tasks.push({
      revisionTaskId: 'RT-20260406-901',
      revisionTaskCode: 'RT-20260406-901',
      title: '设计师补充意见改版（阔腿连体裤花型留白与裤脚结构）',
      projectId: '',
      projectCode: '',
      projectName: '',
      projectNodeId: '',
      workItemTypeCode: 'REVISION_TASK',
      workItemTypeName: '改版任务',
      sourceType: '人工改版需求',
      upstreamModule: '人工参考',
      upstreamObjectType: '设计评审纪要',
      upstreamObjectId: 'REF-20260406-001',
      upstreamObjectCode: 'REF-20260406-001',
      styleId: manualStyle.styleId,
      styleCode: manualStyle.styleCode,
      styleName: manualStyle.styleName,
      referenceObjectType: '设计评审纪要',
      referenceObjectId: 'REF-20260406-001',
      referenceObjectCode: 'REF-20260406-001',
      referenceObjectName: '设计评审纪要 · 阔腿连体裤二次确认',
      productStyleCode: manualStyle.styleCode,
      spuCode: manualStyle.styleCode,
      status: '已确认',
      ownerId: '',
      ownerName: '陈版师',
      participantNames: ['李设计', '张工艺'],
      priorityLevel: '中',
      dueAt: '2026-04-11 18:00:00',
      revisionScopeCodes: ['PRINT', 'PATTERN'],
      revisionScopeNames: ['花型', '版型结构'],
      revisionVersion: 'R1',
      issueSummary: '设计评审认为花型留白不足、裤脚展开角度偏保守，影响设计识别度。',
      evidenceSummary: '来源于设计评审纪要和试穿对照图，不依赖上游自动汇集。',
      evidenceImageUrls: [],
      ...revisionExecutionSeed({
        styleId: manualStyle.styleId,
        styleCode: manualStyle.styleCode,
        styleName: manualStyle.styleName,
        ownerName: '陈版师',
        liveRetestRequired: false,
      }),
      linkedTechPackVersionId: '',
      linkedTechPackVersionCode: '',
      linkedTechPackVersionLabel: '',
      linkedTechPackVersionStatus: '',
      linkedTechPackUpdatedAt: '',
      createdAt: '2026-04-06 15:10:00',
      createdBy: '系统初始化',
      updatedAt: '2026-04-06 16:00:00',
      updatedBy: '系统初始化',
      note: '人工创建的改版任务样例。',
      legacyProjectRef: '',
      legacyUpstreamRef: 'REF-20260406-001',
    })
  }

  return {
    tasks,
    pendingItems: [
      pendingItem('改版任务', 'RT-LEGACY-404', 'PRJ-404-NOT-FOUND', 'WI-LEGACY-001', '历史改版任务引用的商品项目不存在。', '2026-01-09 14:30:00'),
    ],
  }
}

function plateExecutionSeed(taskId: string, input: {
  makerName: string
  area: '印尼' | '深圳'
  urgent?: boolean
  sampleConfirmedAt?: string
  sampleReviewStatus?: PlateMakingTaskRecord['sampleReviewStatus']
  sampleReviewSubmittedAt?: string
  sampleReviewSubmittedBy?: string
  sampleReviewerName?: string
  sampleReviewAt?: string
  sampleReviewNote?: string
  reworkReason?: string
  outputReady?: boolean
  colorRequirementText?: string
  newPatternSpuCode?: string
  materialName?: string
  materialSku?: string
  templateCode?: string
  templateName?: string
}): Partial<PlateMakingTaskRecord> {
  const outputReady = input.outputReady !== false
  const reviewStatus = input.sampleReviewStatus || (input.sampleConfirmedAt || input.sampleReviewAt ? '样板已通过' : '未提交')
  return {
    productHistoryType: '未卖过',
    patternMakerId: `maker_${input.makerName}`,
    patternMakerName: input.makerName,
    sampleConfirmedAt: input.sampleConfirmedAt || '',
    urgentFlag: Boolean(input.urgent),
    patternArea: input.area,
    colorRequirementText: input.colorRequirementText || '按测款反馈保留肩宽和腰节，花色以轻量碎花方向为准。',
    newPatternSpuCode: input.newPatternSpuCode || '',
    flowerImageIds: outputReady ? [`mock://plate-flower/${taskId}/1`] : [],
    materialRequirementLines: [
      {
        lineId: `${taskId}_material_1`,
        materialImageId: `mock://plate-material/${taskId}/1`,
        materialName: input.materialName || '雪纺印花面料',
        materialSku: input.materialSku || 'FAB-PRINT-001',
        printRequirement: '按主花色对位，色差控制在样衣确认范围内',
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        note: '制版阶段输入，后续技术包 BOM 可参考。',
      },
    ],
    patternImageLineItems: outputReady ? [
      {
        lineId: `${taskId}_pattern_image_1`,
        imageId: `mock://plate-pattern-image/${taskId}/front`,
        materialPartName: '前片',
        materialDescription: '前片唛架图片，含领口和腰节线',
        pieceCount: 2,
      },
    ] : [],
    patternPdfFileIds: outputReady ? [`mock://plate-file/${taskId}/pattern.pdf`] : [],
    patternDxfFileIds: outputReady ? [`mock://plate-file/${taskId}/pattern.dxf`] : [],
    patternRulFileIds: outputReady ? [`mock://plate-file/${taskId}/pattern.rul`] : [],
    supportImageIds: outputReady ? [`mock://plate-support/${taskId}/1`] : [],
    supportVideoIds: [],
    partTemplateLinks: [
      {
        templateId: `${taskId}_template_1`,
        templateCode: input.templateCode || 'PART-TPL-DRESS-001',
        templateName: input.templateName || '连衣裙基础前后片模板',
        matchedPartNames: ['前片', '后片'],
      },
    ],
    primaryTechPackGeneratedFlag: false,
    primaryTechPackGeneratedAt: '',
    sampleReviewStatus: reviewStatus,
    sampleReviewSubmittedAt: input.sampleReviewSubmittedAt || (reviewStatus === '待样板确认' ? '2026-04-03 16:00:00' : ''),
    sampleReviewSubmittedBy: input.sampleReviewSubmittedBy || (reviewStatus === '待样板确认' ? input.makerName : ''),
    sampleReviewerName: input.sampleReviewerName || (reviewStatus === '样板已通过' || reviewStatus === '样板已驳回' ? '当前用户' : ''),
    sampleReviewAt: input.sampleReviewAt || input.sampleConfirmedAt || '',
    sampleReviewNote: input.sampleReviewNote || '',
    reworkReason: input.reworkReason || '',
    patternOutputSubmittedAt: input.sampleReviewSubmittedAt || '',
    patternOutputSubmittedBy: input.sampleReviewSubmittedBy || '',
  }
}

function createPlateSeeds(): { tasks: PlateMakingTaskRecord[]; pendingItems: PcsTaskPendingItem[] } {
  const tasks: PlateMakingTaskRecord[] = []
  const seedItems: Array<{
    projectCode: string
    plateTaskId: string
    title: string
    sourceType: PlateMakingTaskRecord['sourceType']
    upstreamModule: string
    upstreamObjectType: string
    upstreamObjectId: string
    upstreamObjectCode: string
    productStyleCode: string
    spuCode?: string
    patternType: string
    sizeRange: string
    patternVersion: string
    status: PlateMakingTaskRecord['status']
    area: '印尼' | '深圳'
    makerName: string
    participantNames: string[]
    priorityLevel: PlateMakingTaskRecord['priorityLevel']
    dueAt: string
    createdAt: string
    updatedAt: string
    sampleReviewStatus: PlateMakingTaskRecord['sampleReviewStatus']
    sampleReviewSubmittedAt?: string
    sampleReviewSubmittedBy?: string
    sampleReviewerName?: string
    sampleReviewAt?: string
    sampleReviewNote?: string
    reworkReason?: string
    outputReady?: boolean
    materialName?: string
    materialSku?: string
    colorRequirementText?: string
    newPatternSpuCode?: string
    linkedTechPackVersionId?: string
    linkedTechPackVersionCode?: string
    linkedTechPackVersionLabel?: string
    linkedTechPackVersionStatus?: string
    note: string
  }> = [
    {
      projectCode: 'PRJ-202604-011',
      plateTaskId: 'PT-20260425-001',
      title: '制版-通勤薄款针织开衫(P1)',
      sourceType: '项目模板阶段',
      upstreamModule: '商品项目',
      upstreamObjectType: '项目模板节点',
      upstreamObjectId: 'PATTERN_TASK',
      upstreamObjectCode: 'PATTERN_TASK',
      productStyleCode: 'SPU-2026-011',
      patternType: '针织开衫',
      sizeRange: 'S-XL',
      patternVersion: 'P1',
      status: '已完成',
      area: '深圳',
      makerName: '王版师',
      participantNames: ['张工', '李工艺'],
      priorityLevel: '高',
      dueAt: '2026-04-25 18:00:00',
      createdAt: '2026-04-25 08:30:00',
      updatedAt: '2026-04-25 09:20:00',
      sampleReviewStatus: '样板已通过',
      sampleReviewSubmittedAt: '2026-04-25 08:50:00',
      sampleReviewSubmittedBy: '王版师',
      sampleReviewerName: '当前用户',
      sampleReviewAt: '2026-04-25 09:00:00',
      sampleReviewNote: '版型、尺寸和门襟结构确认通过，可作为首版样衣输入。',
      materialName: '薄款针织罗纹面料',
      materialSku: 'FAB-KNIT-011',
      linkedTechPackVersionId: 'tdv_first_sample_entry_001',
      linkedTechPackVersionCode: 'TDV-20260425-001',
      linkedTechPackVersionLabel: '首版样衣输入版',
      linkedTechPackVersionStatus: '已发布',
      note: '制版完成，技术包已发布，首版样衣入口可开放。',
    },
    {
      projectCode: 'PRJ-202604-013',
      plateTaskId: 'PT-20260425-002',
      title: '制版-镂空蕾丝拼接上衣(P1)',
      sourceType: '改版任务',
      upstreamModule: '改版任务',
      upstreamObjectType: '改版任务',
      upstreamObjectId: 'RT-20260401-017',
      upstreamObjectCode: 'RT-20260401-017',
      productStyleCode: 'SPU-2026-017',
      patternType: '蕾丝上衣',
      sizeRange: 'S-L',
      patternVersion: 'P1',
      status: '已完成',
      area: '深圳',
      makerName: '李版师',
      participantNames: ['陈设计'],
      priorityLevel: '中',
      dueAt: '2026-04-25 18:00:00',
      createdAt: '2026-04-25 08:40:00',
      updatedAt: '2026-04-25 09:20:00',
      sampleReviewStatus: '样板已通过',
      sampleReviewSubmittedAt: '2026-04-25 09:00:00',
      sampleReviewSubmittedBy: '李版师',
      sampleReviewerName: '当前用户',
      sampleReviewAt: '2026-04-25 09:20:00',
      sampleReviewNote: '样板结构确认通过，但关联花型任务仍需买手确认后才能开放样衣。',
      materialName: '镂空蕾丝拼接面料',
      materialSku: 'FAB-LACE-013',
      linkedTechPackVersionId: 'tdv_first_sample_entry_002',
      linkedTechPackVersionCode: 'TDV-20260425-002',
      linkedTechPackVersionLabel: '首版样衣执行版',
      linkedTechPackVersionStatus: '已发布',
      note: '制版完成，等待关联花型任务完成后开放首版样衣。',
    },
    {
      projectCode: 'PRJ-202604-012',
      plateTaskId: 'PT-20260425-008',
      title: '制版-秋冬加绒卫裤(P1)',
      sourceType: '项目模板阶段',
      upstreamModule: '商品项目',
      upstreamObjectType: '项目模板节点',
      upstreamObjectId: 'PATTERN_TASK',
      upstreamObjectCode: 'PATTERN_TASK',
      productStyleCode: 'SPU-2026-012',
      patternType: '卫裤',
      sizeRange: 'S-2XL',
      patternVersion: 'P1',
      status: '已完成',
      area: '深圳',
      makerName: '林版师',
      participantNames: ['周工'],
      priorityLevel: '高',
      dueAt: '2026-04-25 18:00:00',
      createdAt: '2026-04-25 08:50:00',
      updatedAt: '2026-04-25 09:30:00',
      sampleReviewStatus: '样板已通过',
      sampleReviewSubmittedAt: '2026-04-25 09:10:00',
      sampleReviewSubmittedBy: '林版师',
      sampleReviewerName: '当前用户',
      sampleReviewAt: '2026-04-25 09:30:00',
      sampleReviewNote: '加绒厚度和裤脚收口结构确认通过。',
      materialName: '加绒卫裤主面料',
      materialSku: 'FAB-FLEECE-012',
      linkedTechPackVersionId: 'tdv_first_sample_entry_008',
      linkedTechPackVersionCode: 'TDV-20260425-008',
      linkedTechPackVersionLabel: '首版样衣确认版',
      linkedTechPackVersionStatus: '已发布',
      note: '制版完成，首版样衣已有完成态展示数据可关联。',
    },
    {
      projectCode: 'PRJ-202604-014',
      plateTaskId: 'PT-20260407-018',
      title: '制版-设计款印花阔腿连体裤(P1)',
      sourceType: '改版任务',
      upstreamModule: '改版任务',
      upstreamObjectType: '改版任务',
      upstreamObjectId: 'RT-20260402-018',
      upstreamObjectCode: 'RT-20260402-018',
      productStyleCode: 'SPU-2026-018',
      patternType: '连体裤',
      sizeRange: 'S-L',
      patternVersion: 'P1',
      status: '已完成',
      area: '深圳',
      makerName: '林版师',
      participantNames: ['李娜', '张工'],
      priorityLevel: '高',
      dueAt: '2026-04-07 18:00:00',
      createdAt: '2026-04-06 09:30:00',
      updatedAt: '2026-04-07 17:20:00',
      sampleReviewStatus: '样板已通过',
      sampleReviewSubmittedAt: '2026-04-07 15:40:00',
      sampleReviewSubmittedBy: '林版师',
      sampleReviewerName: '当前用户',
      sampleReviewAt: '2026-04-07 16:20:00',
      sampleReviewNote: '样板通过，已生成正式技术包版本。',
      materialName: '印花阔腿连体裤主面料',
      materialSku: 'FAB-JUMPSUIT-018',
      linkedTechPackVersionId: 'tdv_seed_project_018_base',
      linkedTechPackVersionCode: 'TDV-20260407-018',
      linkedTechPackVersionLabel: 'V1.0',
      linkedTechPackVersionStatus: '已发布',
      note: '制版完成并已同步到商品项目，可校验首版样衣入口。',
    },
    {
      projectCode: 'PRJ-202604-014',
      plateTaskId: 'PT-20260414-GENERATED',
      title: '制版-弹力牛仔裤已写包待收口(P1)',
      sourceType: '项目模板阶段',
      upstreamModule: '商品项目',
      upstreamObjectType: '项目模板节点',
      upstreamObjectId: 'PATTERN_TASK',
      upstreamObjectCode: 'PATTERN_TASK',
      productStyleCode: 'SPU-2026-018',
      patternType: '牛仔裤',
      sizeRange: 'S-XL',
      patternVersion: 'P1',
      status: '已生成技术包',
      area: '深圳',
      makerName: '林版师',
      participantNames: ['李娜'],
      priorityLevel: '中',
      dueAt: '2026-04-15 18:00:00',
      createdAt: '2026-04-14 09:30:00',
      updatedAt: '2026-04-14 11:45:00',
      sampleReviewStatus: '样板已通过',
      sampleReviewSubmittedAt: '2026-04-14 10:30:00',
      sampleReviewSubmittedBy: '林版师',
      sampleReviewerName: '当前用户',
      sampleReviewAt: '2026-04-14 11:20:00',
      sampleReviewNote: '样板已通过，技术包已生成，等待任务收口。',
      materialName: '弹力牛仔主面料',
      materialSku: 'FAB-DENIM-014',
      linkedTechPackVersionId: 'tdv_plate_generated_mock_014',
      linkedTechPackVersionCode: 'TDV-PLATE-20260414',
      linkedTechPackVersionLabel: 'V1.0 已发布',
      linkedTechPackVersionStatus: '已发布',
      note: '技术包已生成，制版任务尚未点完成。',
    },
    {
      projectCode: 'PRJ-202604-014',
      plateTaskId: 'PT-20260426-003',
      title: '制版-修身弹力牛仔裤待写技术包(P2)',
      sourceType: '改版任务',
      upstreamModule: '改版任务',
      upstreamObjectType: '改版任务',
      upstreamObjectId: 'RT-20260402-018',
      upstreamObjectCode: 'RT-20260402-018',
      productStyleCode: 'SPU-2026-018',
      patternType: '牛仔裤',
      sizeRange: 'S-XL',
      patternVersion: 'P2',
      status: '已确认',
      area: '深圳',
      makerName: '王版师',
      participantNames: ['张工'],
      priorityLevel: '高',
      dueAt: '2026-04-27 18:00:00',
      createdAt: '2026-04-26 09:00:00',
      updatedAt: '2026-04-26 14:20:00',
      sampleReviewStatus: '样板已通过',
      sampleReviewSubmittedAt: '2026-04-26 13:40:00',
      sampleReviewSubmittedBy: '王版师',
      sampleReviewerName: '当前用户',
      sampleReviewAt: '2026-04-26 14:20:00',
      sampleReviewNote: '二版腰围和裤长确认通过，下一步生成技术包。',
      materialName: 'Black 弹力斜纹主面料',
      materialSku: 'FAB-TWILL-BLK',
      note: '样板已通过，等待写入技术包。',
    },
    {
      projectCode: 'PRJ-202604-013',
      plateTaskId: 'PT-20260426-004',
      title: '制版-蕾丝拼接上衣待样板确认(P2)',
      sourceType: '改版任务',
      upstreamModule: '改版任务',
      upstreamObjectType: '改版任务',
      upstreamObjectId: 'RT-20260401-017',
      upstreamObjectCode: 'RT-20260401-017',
      productStyleCode: 'SPU-2026-017',
      patternType: '蕾丝上衣',
      sizeRange: 'S-L',
      patternVersion: 'P2',
      status: '待确认',
      area: '深圳',
      makerName: '李版师',
      participantNames: ['王工'],
      priorityLevel: '中',
      dueAt: '2026-04-27 18:00:00',
      createdAt: '2026-04-26 10:00:00',
      updatedAt: '2026-04-26 16:10:00',
      sampleReviewStatus: '待样板确认',
      sampleReviewSubmittedAt: '2026-04-26 16:10:00',
      sampleReviewSubmittedBy: '李版师',
      materialName: '蕾丝拼接里布',
      materialSku: 'FAB-LACE-LINING',
      note: '制版产出已提交，等待业务确认样板。',
    },
    {
      projectCode: 'PRJ-202604-013',
      plateTaskId: 'PT-20260426-005',
      title: '制版-蕾丝拼接上衣样板驳回(P1)',
      sourceType: '改版任务',
      upstreamModule: '改版任务',
      upstreamObjectType: '改版任务',
      upstreamObjectId: 'RT-20260401-017',
      upstreamObjectCode: 'RT-20260401-017',
      productStyleCode: 'SPU-2026-017',
      patternType: '蕾丝上衣',
      sizeRange: 'S-L',
      patternVersion: 'P1',
      status: '进行中',
      area: '深圳',
      makerName: '李版师',
      participantNames: ['陈设计'],
      priorityLevel: '高',
      dueAt: '2026-04-27 18:00:00',
      createdAt: '2026-04-26 09:10:00',
      updatedAt: '2026-04-26 15:40:00',
      sampleReviewStatus: '样板已驳回',
      sampleReviewSubmittedAt: '2026-04-26 13:20:00',
      sampleReviewSubmittedBy: '李版师',
      sampleReviewerName: '当前用户',
      sampleReviewAt: '2026-04-26 15:40:00',
      sampleReviewNote: '袖窿活动量不足，前胸省位需要下移 1.5cm。',
      reworkReason: '袖窿活动量不足，前胸省位需要下移 1.5cm。',
      materialName: '蕾丝主面料',
      materialSku: 'FAB-LACE-MAIN',
      note: '样板驳回后回到制版执行调整。',
    },
    {
      projectCode: 'PRJ-202604-011',
      plateTaskId: 'PT-20260426-006',
      title: '制版-针织开衫待提交样板确认(P2)',
      sourceType: '项目模板阶段',
      upstreamModule: '商品项目',
      upstreamObjectType: '项目模板节点',
      upstreamObjectId: 'PATTERN_TASK',
      upstreamObjectCode: 'PATTERN_TASK',
      productStyleCode: 'SPU-2026-011',
      patternType: '针织开衫',
      sizeRange: 'S-XL',
      patternVersion: 'P2',
      status: '进行中',
      area: '深圳',
      makerName: '王版师',
      participantNames: ['李工艺'],
      priorityLevel: '中',
      dueAt: '2026-04-28 18:00:00',
      createdAt: '2026-04-26 11:00:00',
      updatedAt: '2026-04-26 14:00:00',
      sampleReviewStatus: '未提交',
      materialName: '薄款针织罗纹面料',
      materialSku: 'FAB-KNIT-011',
      note: '纸样文件已齐，待版师提交样板确认。',
    },
    {
      projectCode: 'PRJ-202604-007',
      plateTaskId: 'PT-20260426-007',
      title: '制版-民族风刺绣连衣裙执行中(P1)',
      sourceType: '项目模板阶段',
      upstreamModule: '商品项目',
      upstreamObjectType: '项目模板节点',
      upstreamObjectId: 'PATTERN_TASK',
      upstreamObjectCode: 'PATTERN_TASK',
      productStyleCode: 'SPU-2026-007',
      patternType: '刺绣连衣裙',
      sizeRange: 'S-L',
      patternVersion: '',
      status: '进行中',
      area: '印尼',
      makerName: '陈版师',
      participantNames: ['雅加达样衣间'],
      priorityLevel: '高',
      dueAt: '2026-04-28 18:00:00',
      createdAt: '2026-04-26 09:30:00',
      updatedAt: '2026-04-26 11:20:00',
      sampleReviewStatus: '未提交',
      outputReady: false,
      materialName: '民族风刺绣主面料',
      materialSku: 'FAB-EMB-007',
      note: '版师执行中，尚未上传纸样文件和唛架图。',
    },
    {
      projectCode: 'PRJ-202604-012',
      plateTaskId: 'PT-20260426-008',
      title: '制版-秋冬加绒卫裤资料阻塞(P2)',
      sourceType: '项目模板阶段',
      upstreamModule: '商品项目',
      upstreamObjectType: '项目模板节点',
      upstreamObjectId: 'PATTERN_TASK',
      upstreamObjectCode: 'PATTERN_TASK',
      productStyleCode: 'SPU-2026-012',
      patternType: '卫裤',
      sizeRange: 'S-2XL',
      patternVersion: '',
      status: '异常待处理',
      area: '深圳',
      makerName: '林版师',
      participantNames: ['周工', '采购跟单'],
      priorityLevel: '高',
      dueAt: '2026-04-24 18:00:00',
      createdAt: '2026-04-23 09:00:00',
      updatedAt: '2026-04-24 18:30:00',
      sampleReviewStatus: '未提交',
      outputReady: false,
      materialName: '加绒卫裤主面料',
      materialSku: 'FAB-FLEECE-012',
      note: '缺少确认面料克重和缩水率，纸样暂不能提交样板确认。',
    },
    {
      projectCode: 'PRJ-202604-011',
      plateTaskId: 'PT-20260426-009',
      title: '制版-针织开衫取消任务(P0)',
      sourceType: '项目模板阶段',
      upstreamModule: '商品项目',
      upstreamObjectType: '项目模板节点',
      upstreamObjectId: 'PATTERN_TASK',
      upstreamObjectCode: 'PATTERN_TASK',
      productStyleCode: 'SPU-2026-011',
      patternType: '针织开衫',
      sizeRange: 'S-XL',
      patternVersion: '',
      status: '已取消',
      area: '深圳',
      makerName: '王版师',
      participantNames: ['商品企划'],
      priorityLevel: '低',
      dueAt: '2026-04-22 18:00:00',
      createdAt: '2026-04-21 09:00:00',
      updatedAt: '2026-04-22 10:00:00',
      sampleReviewStatus: '未提交',
      outputReady: false,
      materialName: '薄款针织罗纹面料',
      materialSku: 'FAB-KNIT-011',
      note: '商品项目方向调整，制版任务取消，不应进入后续样板或技术包动作。',
    },
  ]

  seedItems.forEach((item) => {
    const project = pickProjectByCode(item.projectCode)
    const node = project ? findProjectNodeByWorkItemTypeCode(project.projectId, 'PATTERN_TASK') : null
    if (!project || !node) return
    const style = findStyleArchiveByProjectId(project.projectId) ?? pickStyleByCode(item.productStyleCode)
    const styleCode = style?.styleCode || item.productStyleCode
    const linkedTechPackVersionId = item.linkedTechPackVersionId || ''
    const updatedAt = item.updatedAt
    const upstreamObjectId = item.upstreamObjectId === 'PATTERN_TASK' ? node.projectNodeId : item.upstreamObjectId
    const upstreamObjectCode = item.upstreamObjectCode === 'PATTERN_TASK' ? node.projectNodeId : item.upstreamObjectCode
    const sampleConfirmedAt = item.sampleReviewStatus === '样板已通过' ? (item.sampleReviewAt || updatedAt) : ''
    const linkedTechPackUpdatedAt = linkedTechPackVersionId ? updatedAt : ''

    tasks.push({
      plateTaskId: item.plateTaskId,
      plateTaskCode: item.plateTaskId,
      title: item.title,
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectNodeId: node.projectNodeId,
      workItemTypeCode: 'PATTERN_TASK',
      workItemTypeName: '制版任务',
      sourceType: item.sourceType,
      upstreamModule: item.upstreamModule,
      upstreamObjectType: item.upstreamObjectType,
      upstreamObjectId,
      upstreamObjectCode,
      styleId: style?.styleId || '',
      styleCode,
      styleName: style?.styleName || project.projectName,
      productStyleCode: styleCode,
      spuCode: item.spuCode || styleCode,
      ...plateExecutionSeed(item.plateTaskId, {
        makerName: item.makerName,
        area: item.area,
        urgent: item.priorityLevel === '高',
        sampleConfirmedAt,
        sampleReviewStatus: item.sampleReviewStatus,
        sampleReviewSubmittedAt: item.sampleReviewSubmittedAt,
        sampleReviewSubmittedBy: item.sampleReviewSubmittedBy,
        sampleReviewerName: item.sampleReviewerName,
        sampleReviewAt: item.sampleReviewAt,
        sampleReviewNote: item.sampleReviewNote,
        reworkReason: item.reworkReason,
        outputReady: item.outputReady,
        materialName: item.materialName,
        materialSku: item.materialSku,
        colorRequirementText: item.colorRequirementText,
        newPatternSpuCode: item.newPatternSpuCode,
      }),
      patternType: item.patternType,
      sizeRange: item.sizeRange,
      patternVersion: item.patternVersion,
      linkedTechPackVersionId,
      linkedTechPackVersionCode: item.linkedTechPackVersionCode || '',
      linkedTechPackVersionLabel: item.linkedTechPackVersionLabel || '',
      linkedTechPackVersionStatus: item.linkedTechPackVersionStatus || '',
      linkedTechPackUpdatedAt,
      primaryTechPackGeneratedFlag: Boolean(linkedTechPackVersionId),
      primaryTechPackGeneratedAt: linkedTechPackUpdatedAt,
      status: item.status,
      ownerId: project.ownerId,
      ownerName: item.makerName,
      participantNames: item.participantNames,
      priorityLevel: item.priorityLevel,
      dueAt: item.dueAt,
      createdAt: item.createdAt,
      createdBy: '系统初始化',
      updatedAt,
      updatedBy: '系统初始化',
      note: item.note,
      legacyProjectRef: project.projectCode,
      legacyUpstreamRef: upstreamObjectCode,
    })
  })

  return {
    tasks,
    pendingItems: [],
  }
}

function createPatternSeeds(): { tasks: PatternTaskRecord[]; pendingItems: PcsTaskPendingItem[] } {
  const tasks: PatternTaskRecord[] = []
  const projectA = pickProjectByCode('PRJ-202604-014')
  const projectB = pickProjectByCode('PRJ-202604-013')
  const nodeA = projectA ? findProjectNodeByWorkItemTypeCode(projectA.projectId, 'PATTERN_ARTWORK_TASK') : null
  const nodeB = projectB ? findProjectNodeByWorkItemTypeCode(projectB.projectId, 'PATTERN_ARTWORK_TASK') : null
  const executionFields = (input: {
    sourceType: PatternTaskRecord['demandSourceType']
    sourceCode: string
    processType?: PatternTaskRecord['processType']
    fabricName?: string
    teamCode?: PatternTaskRecord['assignedTeamCode']
    teamName?: string
    memberId?: string
    memberName?: string
    completed?: boolean
  }): Pick<PatternTaskRecord,
    'demandSourceType' | 'demandSourceRefId' | 'demandSourceRefCode' | 'demandSourceRefName' | 'processType' | 'requestQty' | 'fabricSku' | 'fabricName' | 'demandImageIds' | 'patternSpuCode' | 'colorDepthOption' | 'difficultyGrade' | 'assignedTeamCode' | 'assignedTeamName' | 'assignedMemberId' | 'assignedMemberName' | 'assignedAt' | 'liveReferenceImageIds' | 'imageReferenceIds' | 'physicalReferenceNote' | 'completionImageIds' | 'patternFileIds' | 'buyerReviewStatus' | 'buyerReviewAt' | 'buyerReviewerName' | 'buyerReviewNote' | 'transferFromTeamCode' | 'transferFromTeamName' | 'transferToTeamCode' | 'transferToTeamName' | 'transferReason' | 'transferredAt' | 'transferOperatorName' | 'patternAssetId' | 'patternAssetCode' | 'patternCategoryCode' | 'patternStyleTags' | 'hotSellerFlag' | 'colorConfirmNote'
  > => ({
    demandSourceType: input.sourceType,
    demandSourceRefId: input.sourceCode,
    demandSourceRefCode: input.sourceCode,
    demandSourceRefName: input.sourceType,
    processType: input.processType || '数码印',
    requestQty: 1,
    fabricSku: '',
    fabricName: input.fabricName || '雪纺印花布',
    demandImageIds: [`mock://pattern-demand/${input.sourceCode}`],
    patternSpuCode: '',
    colorDepthOption: '中间值',
    difficultyGrade: 'A',
    assignedTeamCode: input.teamCode || 'CN_TEAM',
    assignedTeamName: input.teamName || '中国团队',
    assignedMemberId: input.memberId || 'cn_bing_bing',
    assignedMemberName: input.memberName || 'bing bing',
    assignedAt: '2026-01-09 09:00:00',
    liveReferenceImageIds: [],
    imageReferenceIds: [],
    physicalReferenceNote: '以实物图和直播图取中间值。',
    completionImageIds: input.completed ? [`mock://pattern-completion/${input.sourceCode}`] : [],
    patternFileIds: input.completed ? [`mock-file://${input.sourceCode}-artwork.ai`] : [],
    buyerReviewStatus: input.completed ? '买手已通过' : '待买手确认',
    buyerReviewAt: input.completed ? '2026-01-09 14:00:00' : '',
    buyerReviewerName: input.completed ? '文锋' : '',
    buyerReviewNote: '',
    transferFromTeamCode: '',
    transferFromTeamName: '',
    transferToTeamCode: '',
    transferToTeamName: '',
    transferReason: '',
    transferredAt: '',
    transferOperatorName: '',
    patternAssetId: '',
    patternAssetCode: '',
    patternCategoryCode: '植物与花卉',
    patternStyleTags: ['休闲', '印花'],
    hotSellerFlag: false,
    colorConfirmNote: '直播图、图片图、实物图取中间值。',
  })

  if (projectA && nodeA) {
    tasks.push({
      patternTaskId: 'AT-20260109-001',
      patternTaskCode: 'AT-20260109-001',
      title: '花型-波西米亚印花长裙（定位印 A1）',
      projectId: projectA.projectId,
      projectCode: projectA.projectCode,
      projectName: projectA.projectName,
      projectNodeId: nodeA.projectNodeId,
      workItemTypeCode: 'PATTERN_ARTWORK_TASK',
      workItemTypeName: '花型任务',
      sourceType: '改版任务',
      upstreamModule: '改版任务',
      upstreamObjectType: '改版任务',
      upstreamObjectId: 'RT-20260402-018',
      upstreamObjectCode: 'RT-20260402-018',
      productStyleCode: 'SPU-010',
      spuCode: 'SPU-010',
      ...executionFields({ sourceType: '改版任务', sourceCode: 'RT-20260402-018', completed: true }),
      artworkType: '印花',
      patternMode: '定位印',
      artworkName: 'Bunga Tropis A1',
      artworkVersion: 'A1',
      linkedTechPackVersionId: '',
      linkedTechPackVersionCode: '',
      linkedTechPackVersionLabel: '',
      linkedTechPackVersionStatus: '',
      linkedTechPackUpdatedAt: '',
      status: '已确认',
      ownerId: projectA.ownerId,
      ownerName: '林小美',
      priorityLevel: '高',
      dueAt: '2026-01-15 18:00:00',
      createdAt: '2026-01-09 13:00:00',
      createdBy: '系统初始化',
      updatedAt: '2026-01-09 14:30:00',
      updatedBy: '系统初始化',
      note: '历史花型任务已迁移到正式仓储。',
      legacyProjectRef: projectA.projectCode,
      legacyUpstreamRef: 'RT-20260402-018',
    })
  }

  if (projectB && nodeB) {
    tasks.push({
      patternTaskId: 'AT-20260108-003',
      patternTaskCode: 'AT-20260108-003',
      title: '花型-夏日休闲牛仔短裤（满印）',
      projectId: projectB.projectId,
      projectCode: projectB.projectCode,
      projectName: projectB.projectName,
      projectNodeId: nodeB.projectNodeId,
      workItemTypeCode: 'PATTERN_ARTWORK_TASK',
      workItemTypeName: '花型任务',
      sourceType: '改版任务',
      upstreamModule: '改版任务',
      upstreamObjectType: '改版任务',
      upstreamObjectId: 'RT-20260401-017',
      upstreamObjectCode: 'RT-20260401-017',
      productStyleCode: 'SPU-003',
      spuCode: 'SPU-003',
      ...executionFields({ sourceType: '改版任务', sourceCode: 'RT-20260401-017', teamCode: 'BDG_TEAM', teamName: '万隆团队', memberId: 'bdg_ramzi_adli', memberName: 'ramzi adli' }),
      artworkType: '印花',
      patternMode: '满印',
      artworkName: 'Summer Denim',
      artworkVersion: '',
      linkedTechPackVersionId: '',
      linkedTechPackVersionCode: '',
      linkedTechPackVersionLabel: '',
      linkedTechPackVersionStatus: '',
      linkedTechPackUpdatedAt: '',
      status: '进行中',
      ownerId: projectB.ownerId,
      ownerName: '张设计',
      priorityLevel: '中',
      dueAt: '2026-01-18 18:00:00',
      createdAt: '2026-01-08 09:30:00',
      createdBy: '系统初始化',
      updatedAt: '2026-01-08 16:45:00',
      updatedBy: '系统初始化',
      note: '',
      legacyProjectRef: projectB.projectCode,
      legacyUpstreamRef: '',
    })
  }

  ;[
    {
      projectCode: 'PRJ-202604-013',
      patternTaskId: 'AT-20260404-013',
      patternTaskCode: 'AT-20260404-013',
      title: '花型-户外轻量夹克（机能贴章 A1）',
      productStyleCode: 'SPU-JACKET-085',
      spuCode: 'SPU-JACKET-085',
      artworkType: '贴章',
      patternMode: '定位印',
      artworkName: 'Outdoor Patch A1',
      artworkVersion: 'A1',
      status: '已确认' as const,
      ownerName: '林小美',
      priorityLevel: '高' as const,
      dueAt: '2026-04-08 18:00:00',
      createdAt: '2026-04-04 09:20:00',
      updatedAt: '2026-04-04 15:40:00',
    },
    {
      projectCode: 'PRJ-202604-014',
      patternTaskId: 'AT-20260405-015',
      patternTaskCode: 'AT-20260405-015',
      title: '花型-中式结饰上衣（纹样 A2）',
      productStyleCode: 'SPU-2024-005',
      spuCode: 'SPU-2024-005',
      artworkType: '印花',
      patternMode: '定位印',
      artworkName: 'Oriental Knot A2',
      artworkVersion: 'A2',
      status: '已完成' as const,
      ownerName: '张设计',
      priorityLevel: '中' as const,
      dueAt: '2026-04-09 18:00:00',
      createdAt: '2026-04-05 10:10:00',
      updatedAt: '2026-04-05 17:20:00',
    },
  ].forEach((item) => {
    const project = pickProjectByCode(item.projectCode)
    const node = project ? findProjectNodeByWorkItemTypeCode(project.projectId, 'PATTERN_ARTWORK_TASK') : null
    if (!project || !node) return
    const upstreamRevisionCode = item.projectCode === 'PRJ-202604-014'
      ? 'RT-20260402-018'
      : item.projectCode === 'PRJ-202604-013'
        ? 'RT-20260401-017'
        : ''
    tasks.push({
      patternTaskId: item.patternTaskId,
      patternTaskCode: item.patternTaskCode,
      title: item.title,
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectNodeId: node.projectNodeId,
      workItemTypeCode: 'PATTERN_ARTWORK_TASK',
      workItemTypeName: '花型任务',
      sourceType: upstreamRevisionCode ? '改版任务' : '项目模板阶段',
      upstreamModule: upstreamRevisionCode ? '改版任务' : '项目模板',
      upstreamObjectType: upstreamRevisionCode ? '改版任务' : '模板阶段',
      upstreamObjectId: upstreamRevisionCode || project.templateId,
      upstreamObjectCode: upstreamRevisionCode || project.templateVersion,
      productStyleCode: item.productStyleCode,
      spuCode: item.spuCode,
      ...executionFields({ sourceType: upstreamRevisionCode ? '改版任务' : '设计师款', sourceCode: upstreamRevisionCode || project.projectCode, processType: item.artworkType === '贴章' ? '烫画' : '数码印', completed: item.status === '已完成' || item.status === '已确认' }),
      artworkType: item.artworkType,
      patternMode: item.patternMode,
      artworkName: item.artworkName,
      artworkVersion: item.artworkVersion,
      linkedTechPackVersionId: '',
      linkedTechPackVersionCode: '',
      linkedTechPackVersionLabel: '',
      linkedTechPackVersionStatus: '',
      linkedTechPackUpdatedAt: '',
      status: item.status,
      ownerId: project.ownerId,
      ownerName: item.ownerName,
      priorityLevel: item.priorityLevel,
      dueAt: item.dueAt,
      createdAt: item.createdAt,
      createdBy: '系统初始化',
      updatedAt: item.updatedAt,
      updatedBy: '系统初始化',
      note: '补充的演示花型任务。',
      legacyProjectRef: project.projectCode,
      legacyUpstreamRef: upstreamRevisionCode || project.templateVersion,
    })
  })

  return {
    tasks,
    pendingItems: [
      pendingItem('花型任务', 'AT-LEGACY-404', 'PRJ-LOST-001', 'RT-LOST-001', '历史花型任务引用的项目不存在，当前未迁移。', '2026-01-08 16:45:00'),
    ],
  }
}

function firstSampleChainSeed(input: {
  upstreamObjectType: string
  upstreamObjectId: string
  upstreamObjectCode: string
  sourceTechPackVersionId?: string
  sourceTechPackVersionCode?: string
  sourceTechPackVersionLabel?: string
  sampleMaterialMode?: FirstSampleTaskRecord['sampleMaterialMode']
  samplePurpose?: FirstSampleTaskRecord['samplePurpose']
  sampleImageIds?: string[]
  sampleCode?: string
  reusable?: boolean
  confirmedAt?: string
  fitConfirmationSummary?: string
  artworkConfirmationSummary?: string
  productionReadinessNote?: string
  reuseAsFirstOrderBasisConfirmedBy?: string
  reuseAsFirstOrderBasisNote?: string
}): Pick<FirstSampleTaskRecord,
  'sourceTechPackVersionId' | 'sourceTechPackVersionCode' | 'sourceTechPackVersionLabel' | 'sourceTaskType' | 'sourceTaskId' | 'sourceTaskCode' | 'sampleMaterialMode' | 'samplePurpose' | 'sampleImageIds' | 'reuseAsFirstOrderBasisFlag' | 'reuseAsFirstOrderBasisConfirmedAt' | 'reuseAsFirstOrderBasisConfirmedBy' | 'reuseAsFirstOrderBasisNote' | 'fitConfirmationSummary' | 'artworkConfirmationSummary' | 'productionReadinessNote' | 'confirmedAt'
> {
  const reusable = Boolean(input.reusable)
  return {
    sourceTechPackVersionId: input.sourceTechPackVersionId || '',
    sourceTechPackVersionCode: input.sourceTechPackVersionCode || '',
    sourceTechPackVersionLabel: input.sourceTechPackVersionLabel || '',
    sourceTaskType: input.upstreamObjectType,
    sourceTaskId: input.upstreamObjectId,
    sourceTaskCode: input.upstreamObjectCode,
    sampleMaterialMode: input.sampleMaterialMode || '正确布',
    samplePurpose: input.samplePurpose || (reusable ? '首单复用候选' : '首版确认'),
    sampleImageIds: [...(input.sampleImageIds || (input.sampleCode ? [`mock://sample-result/${input.sampleCode}`] : []))],
    reuseAsFirstOrderBasisFlag: reusable,
    reuseAsFirstOrderBasisConfirmedAt: reusable ? input.confirmedAt || '' : '',
    reuseAsFirstOrderBasisConfirmedBy: reusable ? input.reuseAsFirstOrderBasisConfirmedBy || '系统初始化' : '',
    reuseAsFirstOrderBasisNote: reusable ? input.reuseAsFirstOrderBasisNote || '首版样衣可作为首单参照。' : '',
    fitConfirmationSummary: reusable ? input.fitConfirmationSummary || '版型可作为生产参照。' : input.fitConfirmationSummary || '',
    artworkConfirmationSummary: reusable ? input.artworkConfirmationSummary || '外观和花型效果可接受。' : input.artworkConfirmationSummary || '',
    productionReadinessNote: reusable ? input.productionReadinessNote || '可进入首单打样准备。' : input.productionReadinessNote || '',
    confirmedAt: input.confirmedAt || '',
  }
}

function firstOrderChainSeed(input: {
  upstreamObjectId: string
  upstreamObjectCode: string
  sampleCode?: string
  mode?: FirstOrderSampleTaskRecord['sampleChainMode']
  factoryReference?: boolean
  dualSample?: boolean
  sourceTechPackVersionId?: string
  sourceTechPackVersionCode?: string
  sourceTechPackVersionLabel?: string
  finalReferenceNote?: string
  conclusionResult?: FirstOrderSampleTaskRecord['conclusionResult']
  conclusionNote?: string
  confirmedAt?: string
  confirmedBy?: string
}): Pick<FirstOrderSampleTaskRecord,
  'sourceTechPackVersionId' | 'sourceTechPackVersionCode' | 'sourceTechPackVersionLabel' | 'sourceFirstSampleTaskId' | 'sourceFirstSampleTaskCode' | 'sourceFirstSampleCode' | 'sampleChainMode' | 'specialSceneReasonCodes' | 'specialSceneReasonText' | 'productionReferenceRequiredFlag' | 'chinaReviewRequiredFlag' | 'correctFabricRequiredFlag' | 'samplePlanLines' | 'finalReferenceNote' | 'conclusionResult' | 'conclusionNote' | 'confirmedAt' | 'confirmedBy'
> {
  const mode = input.dualSample ? '替代布与正确布双确认' : input.mode || '复用首版结论'
  const reuseCode = mode === '复用首版结论' ? input.sampleCode || '' : ''
  const samplePlanLines = mode === '替代布与正确布双确认'
    ? [
        {
          lineId: 'dual-substitute-01',
          sampleRole: '替代布确认样' as const,
          materialMode: '替代布' as const,
          quantity: 1,
          targetFactoryId: '',
          targetFactoryName: '',
          linkedSampleCode: '',
          status: '待确认' as const,
          note: '先用替代布确认版型和工艺。',
        },
        {
          lineId: 'dual-correct-01',
          sampleRole: '正确布确认样' as const,
          materialMode: '正确布' as const,
          quantity: 1,
          targetFactoryId: '',
          targetFactoryName: '',
          linkedSampleCode: '',
          status: '待确认' as const,
          note: '再用正确布确认生产参照。',
        },
      ]
    : [
        {
          lineId: mode === '复用首版结论' ? 'reuse-first-sample-01' : 'new-correct-sample-01',
          sampleRole: mode === '复用首版结论' ? '复用首版结论' as const : '正确布确认样' as const,
          materialMode: mode === '复用首版结论' ? '沿用首版' as const : '正确布' as const,
          quantity: 1,
          targetFactoryId: '',
          targetFactoryName: '',
          linkedSampleCode: reuseCode,
          status: reuseCode ? '已确认' as const : '待确认' as const,
          note: mode === '复用首版结论' ? '复用首版样衣打样结论作为首单依据。' : '',
        },
      ]
  if (input.factoryReference) {
    samplePlanLines.push({
      lineId: 'factory-reference-01',
      sampleRole: '工厂参照确认',
      materialMode: '正确布',
      quantity: 3,
      targetFactoryId: 'factory-reference',
      targetFactoryName: '参与生产工厂',
      linkedSampleCode: '',
      status: '待确认',
      note: '大货前分发给生产工厂参照。',
    })
  }
  return {
    sourceTechPackVersionId: input.sourceTechPackVersionId || '',
    sourceTechPackVersionCode: input.sourceTechPackVersionCode || '',
    sourceTechPackVersionLabel: input.sourceTechPackVersionLabel || '',
    sourceFirstSampleTaskId: input.upstreamObjectId,
    sourceFirstSampleTaskCode: input.upstreamObjectCode,
    sourceFirstSampleCode: reuseCode,
    sampleChainMode: mode,
    specialSceneReasonCodes: input.dualSample ? ['定位印', '正确布确认'] : input.factoryReference ? ['大货量大', '工厂参照样'] : [],
    specialSceneReasonText: input.dualSample ? '定位印需要替代布和正确布分别确认。' : '',
    productionReferenceRequiredFlag: Boolean(input.factoryReference),
    chinaReviewRequiredFlag: Boolean(input.dualSample),
    correctFabricRequiredFlag: Boolean(input.dualSample),
    samplePlanLines,
    finalReferenceNote: Object.prototype.hasOwnProperty.call(input, 'finalReferenceNote')
      ? input.finalReferenceNote || ''
      : (reuseCode ? '最终参照首版打样结果。' : ''),
    conclusionResult: input.conclusionResult || '',
    conclusionNote: input.conclusionNote || '',
    confirmedAt: input.confirmedAt || '',
    confirmedBy: input.confirmedBy || '',
  }
}

function createFirstSampleSeeds(): { tasks: FirstSampleTaskRecord[]; pendingItems: PcsTaskPendingItem[] } {
  const tasks: FirstSampleTaskRecord[] = []
  const projectA = pickProjectByCode('PRJ-20251216-010')
  const projectB = pickProjectByCode('PRJ-20251216-003')
  const nodeA = projectA ? findProjectNodeByWorkItemTypeCode(projectA.projectId, 'FIRST_SAMPLE') : null
  const nodeB = projectB ? findProjectNodeByWorkItemTypeCode(projectB.projectId, 'FIRST_SAMPLE') : null

  if (projectA && nodeA) {
    tasks.push({
      firstSampleTaskId: 'FS-20260119-003',
      firstSampleTaskCode: 'FS-20260119-003',
      title: `首版样衣打样-${projectA.projectName}`,
      projectId: projectA.projectId,
      projectCode: projectA.projectCode,
      projectName: projectA.projectName,
      projectNodeId: nodeA.projectNodeId,
      workItemTypeCode: 'FIRST_SAMPLE',
      workItemTypeName: '首版样衣打样',
      sourceType: '改版任务',
      upstreamModule: '改版任务',
      upstreamObjectType: '改版任务',
      upstreamObjectId: 'RT-20260108-002',
      upstreamObjectCode: 'RT-20260108-002',
      factoryId: 'factory-shenzhen-01',
      factoryName: '深圳工厂01',
      targetSite: '深圳',
      sampleCode: 'SY-SZ-00088',
      ...firstSampleChainSeed({
        upstreamObjectType: '改版任务',
        upstreamObjectId: 'RT-20260108-002',
        upstreamObjectCode: 'RT-20260108-002',
      }),
      status: '待处理',
      ownerId: projectA.ownerId,
      ownerName: projectA.ownerName,
      priorityLevel: '中',
      createdAt: '2026-01-19 10:00:00',
      createdBy: '系统初始化',
      updatedAt: '2026-01-19 10:00:00',
      updatedBy: '系统初始化',
      note: '',
      legacyProjectRef: projectA.projectCode,
      legacyUpstreamRef: 'RT-20260108-002',
    })
  }

  if (projectB && nodeB) {
    tasks.push({
      firstSampleTaskId: 'FS-20260111-001',
      firstSampleTaskCode: 'FS-20260111-001',
      title: `首版样衣打样-${projectB.projectName}`,
      projectId: projectB.projectId,
      projectCode: projectB.projectCode,
      projectName: projectB.projectName,
      projectNodeId: nodeB.projectNodeId,
      workItemTypeCode: 'FIRST_SAMPLE',
      workItemTypeName: '首版样衣打样',
      sourceType: '制版任务',
      upstreamModule: '制版任务',
      upstreamObjectType: '制版任务',
      upstreamObjectId: 'PT-20260109-002',
      upstreamObjectCode: 'PT-20260109-002',
      factoryId: 'factory-jakarta-02',
      factoryName: '雅加达工厂02',
      targetSite: '雅加达',
      sampleCode: 'SY-JKT-00031',
      ...firstSampleChainSeed({
        upstreamObjectType: '制版任务',
        upstreamObjectId: 'PT-20260109-002',
        upstreamObjectCode: 'PT-20260109-002',
      }),
      status: '打样中',
      ownerId: projectB.ownerId,
      ownerName: projectB.ownerName,
      priorityLevel: '高',
      createdAt: '2026-01-11 09:00:00',
      createdBy: '系统初始化',
      updatedAt: '2026-01-11 11:00:00',
      updatedBy: '系统初始化',
      note: '',
      legacyProjectRef: projectB.projectCode,
      legacyUpstreamRef: 'PT-20260109-002',
    })
  }

  ;[
    {
      projectCode: 'PRJ-20251216-005',
      firstSampleTaskId: 'FS-20260403-005',
      firstSampleTaskCode: 'FS-20260403-005',
      title: '首版样衣打样-法式优雅衬衫连衣裙',
      upstreamModule: '制版任务',
      upstreamObjectType: '制版任务',
      upstreamObjectId: 'PT-20260403-011',
      upstreamObjectCode: 'PT-20260403-011',
      factoryId: 'factory-jakarta-02',
      factoryName: '雅加达工厂02',
      targetSite: '雅加达',
      sampleCode: 'SY-JKT-00105',
      status: '打样中' as const,
      priorityLevel: '中' as const,
      createdAt: '2026-04-03 11:00:00',
      updatedAt: '2026-04-03 16:00:00',
      sourceTechPackVersionId: '',
      sourceTechPackVersionCode: '',
      sourceTechPackVersionLabel: '',
      sampleMaterialMode: '正确布' as const,
      samplePurpose: '首版确认' as const,
      sampleImageIds: undefined as string[] | undefined,
      fitConfirmationSummary: '',
      artworkConfirmationSummary: '',
      productionReadinessNote: '',
      reuseAsFirstOrderBasisConfirmedBy: '',
      reuseAsFirstOrderBasisNote: '',
      confirmedAt: '',
    },
    {
      projectCode: 'PRJ-20251216-013',
      firstSampleTaskId: 'FS-20260404-013',
      firstSampleTaskCode: 'FS-20260404-013',
      title: '首版样衣打样-设计款户外轻量夹克',
      upstreamModule: '花型任务',
      upstreamObjectType: '花型任务',
      upstreamObjectId: 'AT-20260404-013',
      upstreamObjectCode: 'AT-20260404-013',
      factoryId: 'factory-shenzhen-02',
      factoryName: '深圳工厂02',
      targetSite: '深圳',
      sampleCode: 'SY-SZ-00113',
      status: '待处理' as const,
      priorityLevel: '高' as const,
      createdAt: '2026-04-04 10:40:00',
      updatedAt: '2026-04-04 12:10:00',
      sourceTechPackVersionId: '',
      sourceTechPackVersionCode: '',
      sourceTechPackVersionLabel: '',
      sampleMaterialMode: '正确布' as const,
      samplePurpose: '首版确认' as const,
      sampleImageIds: undefined as string[] | undefined,
      fitConfirmationSummary: '',
      artworkConfirmationSummary: '',
      productionReadinessNote: '',
      reuseAsFirstOrderBasisConfirmedBy: '',
      reuseAsFirstOrderBasisNote: '',
      confirmedAt: '',
    },
    {
      projectCode: 'PRJ-20251216-026',
      firstSampleTaskId: 'FS-20260425-002',
      firstSampleTaskCode: 'FS-20260425-002',
      title: '首版样衣打样-已建任务未补齐',
      upstreamModule: '制版任务',
      upstreamObjectType: '制版任务',
      upstreamObjectId: 'PT-20260425-002',
      upstreamObjectCode: 'PT-20260425-002',
      factoryId: 'factory-shenzhen-01',
      factoryName: '深圳工厂01',
      targetSite: '深圳',
      sampleCode: '',
      status: '打样中' as const,
      priorityLevel: '中' as const,
      createdAt: '2026-04-25 09:35:00',
      updatedAt: '2026-04-25 09:40:00',
      sourceTechPackVersionId: 'tdv_first_sample_entry_002',
      sourceTechPackVersionCode: 'TDV-20260425-002',
      sourceTechPackVersionLabel: '首版样衣执行版',
      sampleMaterialMode: '替代布' as const,
      samplePurpose: '首版确认' as const,
      sampleImageIds: [] as string[],
      fitConfirmationSummary: '',
      artworkConfirmationSummary: '',
      productionReadinessNote: '',
      reuseAsFirstOrderBasisConfirmedBy: '',
      reuseAsFirstOrderBasisNote: '',
      confirmedAt: '',
    },
    {
      projectCode: 'PRJ-20251216-027',
      firstSampleTaskId: 'FS-20260425-008',
      firstSampleTaskCode: 'FS-20260425-008',
      title: '首版样衣打样-完成展示',
      upstreamModule: '制版任务',
      upstreamObjectType: '制版任务',
      upstreamObjectId: 'PT-20260425-008',
      upstreamObjectCode: 'PT-20260425-008',
      factoryId: 'factory-shenzhen-02',
      factoryName: '深圳工厂02',
      targetSite: '深圳',
      sampleCode: 'FS-RESULT-25001',
      status: '已通过' as const,
      priorityLevel: '高' as const,
      createdAt: '2026-04-25 09:50:00',
      updatedAt: '2026-04-25 10:30:00',
      sourceTechPackVersionId: 'tdv_first_sample_entry_008',
      sourceTechPackVersionCode: 'TDV-20260425-008',
      sourceTechPackVersionLabel: '首版样衣确认版',
      sampleMaterialMode: '正确布' as const,
      samplePurpose: '首单复用候选' as const,
      sampleImageIds: ['mock://sample-result/fs-25001-1', 'mock://sample-result/fs-25001-2'],
      fitConfirmationSummary: '版型确认通过，肩线与胸围合适。',
      artworkConfirmationSummary: '花型位置与颜色确认通过。',
      productionReadinessNote: '可作为首单复用候选。',
      reuseAsFirstOrderBasisConfirmedBy: '张娜',
      reuseAsFirstOrderBasisNote: '首版样衣确认通过，可直接复用。',
      confirmedAt: '2026-04-25 10:30',
    },
    {
      projectCode: 'PRJ-20251216-028',
      firstSampleTaskId: 'FSD-20260425-001',
      firstSampleTaskCode: 'FSD-20260425-001',
      title: '首版样衣打样-首单未建任务来源',
      upstreamModule: '制版任务',
      upstreamObjectType: '制版任务',
      upstreamObjectId: 'PT-20260425-011',
      upstreamObjectCode: 'PT-20260425-011',
      factoryId: 'factory-shenzhen-01',
      factoryName: '深圳工厂01',
      targetSite: '深圳',
      sampleCode: 'FS-RESULT-25002',
      status: '已通过' as const,
      priorityLevel: '中' as const,
      createdAt: '2026-04-25 10:00:00',
      updatedAt: '2026-04-25 10:40:00',
      sourceTechPackVersionId: 'TDV-ID-0006',
      sourceTechPackVersionCode: 'TDV-20260425-006',
      sourceTechPackVersionLabel: 'V1',
      sampleMaterialMode: '正确布' as const,
      samplePurpose: '首单复用候选' as const,
      sampleImageIds: ['mock://sample-result/fs-25002-1'],
      fitConfirmationSummary: '首版样衣已确认，可作为首单来源。',
      artworkConfirmationSummary: '花型位置确认通过。',
      productionReadinessNote: '可进入首单样衣判断。',
      reuseAsFirstOrderBasisConfirmedBy: '张娜',
      reuseAsFirstOrderBasisNote: '首版样衣确认通过，可作为首单输入。',
      confirmedAt: '2026-04-25 10:40',
    },
    {
      projectCode: 'PRJ-20251216-029',
      firstSampleTaskId: 'FSD-20260425-002',
      firstSampleTaskCode: 'FSD-20260425-002',
      title: '首版样衣打样-首单已建未补齐来源',
      upstreamModule: '制版任务',
      upstreamObjectType: '制版任务',
      upstreamObjectId: 'PT-20260425-012',
      upstreamObjectCode: 'PT-20260425-012',
      factoryId: 'factory-shenzhen-01',
      factoryName: '深圳工厂01',
      targetSite: '深圳',
      sampleCode: 'FS-RESULT-25003-PRE',
      status: '已通过' as const,
      priorityLevel: '中' as const,
      createdAt: '2026-04-25 10:10:00',
      updatedAt: '2026-04-25 10:45:00',
      sourceTechPackVersionId: 'TDV-ID-0007',
      sourceTechPackVersionCode: 'TDV-20260425-007',
      sourceTechPackVersionLabel: 'V1',
      sampleMaterialMode: '正确布' as const,
      samplePurpose: '首单复用候选' as const,
      sampleImageIds: ['mock://sample-result/fs-25003-pre-1'],
      fitConfirmationSummary: '版型已确认，等待首单补齐计划。',
      artworkConfirmationSummary: '花型确认通过。',
      productionReadinessNote: '可进入首单样衣打样。',
      reuseAsFirstOrderBasisConfirmedBy: '张娜',
      reuseAsFirstOrderBasisNote: '可作为首单来源。',
      confirmedAt: '2026-04-25 10:45',
    },
    {
      projectCode: 'PRJ-20251216-030',
      firstSampleTaskId: 'FSD-20260425-003',
      firstSampleTaskCode: 'FSD-20260425-003',
      title: '首版样衣打样-首单完成展示来源',
      upstreamModule: '制版任务',
      upstreamObjectType: '制版任务',
      upstreamObjectId: 'PT-20260425-013',
      upstreamObjectCode: 'PT-20260425-013',
      factoryId: 'factory-shenzhen-01',
      factoryName: '深圳工厂01',
      targetSite: '深圳',
      sampleCode: 'FS-RESULT-25003',
      status: '已通过' as const,
      priorityLevel: '高' as const,
      createdAt: '2026-04-25 10:20:00',
      updatedAt: '2026-04-25 11:00:00',
      sourceTechPackVersionId: 'TDV-ID-0008',
      sourceTechPackVersionCode: 'TDV-20260425-008',
      sourceTechPackVersionLabel: 'V2',
      sampleMaterialMode: '正确布' as const,
      samplePurpose: '首单复用候选' as const,
      sampleImageIds: ['mock://sample-result/fs-25003-1'],
      fitConfirmationSummary: '首版样衣确认通过。',
      artworkConfirmationSummary: '花型位置与颜色确认通过。',
      productionReadinessNote: '可作为首单复用候选。',
      reuseAsFirstOrderBasisConfirmedBy: '张娜',
      reuseAsFirstOrderBasisNote: '首版样衣确认通过，可直接复用。',
      confirmedAt: '2026-04-25 11:00',
    },
  ].forEach((item) => {
    const project = pickProjectByCode(item.projectCode)
    const node = project ? findProjectNodeByWorkItemTypeCode(project.projectId, 'FIRST_SAMPLE') : null
    if (!project || !node) return
    tasks.push({
      firstSampleTaskId: item.firstSampleTaskId,
      firstSampleTaskCode: item.firstSampleTaskCode,
      title: item.title,
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectNodeId: node.projectNodeId,
      workItemTypeCode: 'FIRST_SAMPLE',
      workItemTypeName: '首版样衣打样',
      sourceType: '项目模板阶段',
      upstreamModule: item.upstreamModule,
      upstreamObjectType: item.upstreamObjectType,
      upstreamObjectId: item.upstreamObjectId,
      upstreamObjectCode: item.upstreamObjectCode,
      factoryId: item.factoryId,
      factoryName: item.factoryName,
      targetSite: item.targetSite,
      sampleCode: item.sampleCode,
      ...firstSampleChainSeed({
        upstreamObjectType: item.upstreamObjectType,
        upstreamObjectId: item.upstreamObjectId,
        upstreamObjectCode: item.upstreamObjectCode,
        sourceTechPackVersionId: item.sourceTechPackVersionId,
        sourceTechPackVersionCode: item.sourceTechPackVersionCode,
        sourceTechPackVersionLabel: item.sourceTechPackVersionLabel,
        sampleMaterialMode: item.sampleMaterialMode,
        samplePurpose: item.samplePurpose,
        sampleImageIds: item.sampleImageIds,
        reusable: item.status === '已通过',
        confirmedAt: item.confirmedAt,
        fitConfirmationSummary: item.fitConfirmationSummary,
        artworkConfirmationSummary: item.artworkConfirmationSummary,
        productionReadinessNote: item.productionReadinessNote,
        reuseAsFirstOrderBasisConfirmedBy: item.reuseAsFirstOrderBasisConfirmedBy,
        reuseAsFirstOrderBasisNote: item.reuseAsFirstOrderBasisNote,
      }),
      status: item.status,
      ownerId: project.ownerId,
      ownerName: project.ownerName,
      priorityLevel: item.priorityLevel,
      createdAt: item.createdAt,
      createdBy: '系统初始化',
      updatedAt: item.updatedAt,
      updatedBy: '系统初始化',
      note: '补充的演示首版样衣打样任务。',
      legacyProjectRef: project.projectCode,
      legacyUpstreamRef: item.upstreamObjectCode,
    })
  })

  return {
    tasks,
    pendingItems: [
      pendingItem('首版样衣打样', 'FS-LEGACY-404', 'PRJ-NOT-EXISTS', 'pattern', '历史首版样衣打样记录未找到正式项目。', '2026-01-12 17:05:00'),
    ],
  }
}

function createFirstOrderSeeds(): { tasks: FirstOrderSampleTaskRecord[]; pendingItems: PcsTaskPendingItem[] } {
  const tasks: FirstOrderSampleTaskRecord[] = []
  const projectA = pickProjectByCode('PRJ-20251216-010')
  const projectB = pickProjectByCode('PRJ-20251216-003')
  const nodeA = projectA ? findProjectNodeByWorkItemTypeCode(projectA.projectId, 'FIRST_ORDER_SAMPLE') : null
  const nodeB = projectB ? findProjectNodeByWorkItemTypeCode(projectB.projectId, 'FIRST_ORDER_SAMPLE') : null

  if (projectA && nodeA) {
    tasks.push({
      firstOrderSampleTaskId: 'PP-20260124-003',
      firstOrderSampleTaskCode: 'PP-20260124-003',
      title: `首单样衣打样-${projectA.projectName}`,
      projectId: projectA.projectId,
      projectCode: projectA.projectCode,
      projectName: projectA.projectName,
      projectNodeId: nodeA.projectNodeId,
      workItemTypeCode: 'FIRST_ORDER_SAMPLE',
      workItemTypeName: '首单样衣打样',
      sourceType: '首版样衣打样',
      upstreamModule: '首版样衣打样',
      upstreamObjectType: '首版样衣打样任务',
      upstreamObjectId: 'FS-20260119-003',
      upstreamObjectCode: 'FS-20260119-003',
      factoryId: 'factory-jakarta-03',
      factoryName: '雅加达工厂03',
      targetSite: '雅加达',
      patternVersion: 'P2',
      artworkVersion: 'A1',
      sampleCode: 'SY-JKT-00068',
      ...firstOrderChainSeed({
        upstreamObjectId: 'FS-20260119-003',
        upstreamObjectCode: 'FS-20260119-003',
        factoryReference: true,
      }),
      status: '待处理',
      ownerId: projectA.ownerId,
      ownerName: projectA.ownerName,
      priorityLevel: '中',
      createdAt: '2026-01-24 10:00:00',
      createdBy: '系统初始化',
      updatedAt: '2026-01-24 10:00:00',
      updatedBy: '系统初始化',
      note: '',
      legacyProjectRef: projectA.projectCode,
      legacyUpstreamRef: 'FS-20260119-003',
    })
  }

  if (projectB && nodeB) {
    tasks.push({
      firstOrderSampleTaskId: 'PP-20260121-001',
      firstOrderSampleTaskCode: 'PP-20260121-001',
      title: `首单样衣打样-${projectB.projectName}`,
      projectId: projectB.projectId,
      projectCode: projectB.projectCode,
      projectName: projectB.projectName,
      projectNodeId: nodeB.projectNodeId,
      workItemTypeCode: 'FIRST_ORDER_SAMPLE',
      workItemTypeName: '首单样衣打样',
      sourceType: '制版任务',
      upstreamModule: '制版任务',
      upstreamObjectType: '制版任务',
      upstreamObjectId: 'PT-20260109-002',
      upstreamObjectCode: 'PT-20260109-002',
      factoryId: 'factory-shenzhen-02',
      factoryName: '深圳工厂02',
      targetSite: '深圳',
      patternVersion: 'P1',
      artworkVersion: '',
      sampleCode: 'SY-SZ-00052',
      ...firstOrderChainSeed({
        upstreamObjectId: 'PT-20260109-002',
        upstreamObjectCode: 'PT-20260109-002',
      }),
      status: '打样中',
      ownerId: projectB.ownerId,
      ownerName: projectB.ownerName,
      priorityLevel: '高',
      createdAt: '2026-01-21 09:00:00',
      createdBy: '系统初始化',
      updatedAt: '2026-01-21 11:00:00',
      updatedBy: '系统初始化',
      note: '',
      legacyProjectRef: projectB.projectCode,
      legacyUpstreamRef: 'PT-20260109-002',
    })
  }

  ;[
    {
      projectCode: 'PRJ-20251216-005',
      firstOrderSampleTaskId: 'PP-20260405-005',
      firstOrderSampleTaskCode: 'PP-20260405-005',
      title: '首单样衣打样-法式优雅衬衫连衣裙',
      upstreamModule: '首版样衣打样',
      upstreamObjectType: '首版样衣打样任务',
      upstreamObjectId: 'FS-20260403-005',
      upstreamObjectCode: 'FS-20260403-005',
      factoryId: 'factory-jakarta-03',
      factoryName: '雅加达工厂03',
      targetSite: '雅加达',
      patternVersion: 'P2',
      artworkVersion: 'A1',
      sampleCode: 'SY-JKT-00125',
      status: '打样中' as const,
      priorityLevel: '中' as const,
      createdAt: '2026-04-05 09:20:00',
      updatedAt: '2026-04-05 14:30:00',
    },
    {
      projectCode: 'PRJ-20251216-013',
      firstOrderSampleTaskId: 'PP-20260406-013',
      firstOrderSampleTaskCode: 'PP-20260406-013',
      title: '首单样衣打样-设计款户外轻量夹克',
      upstreamModule: '首版样衣打样',
      upstreamObjectType: '首版样衣打样任务',
      upstreamObjectId: 'FS-20260404-013',
      upstreamObjectCode: 'FS-20260404-013',
      factoryId: 'factory-shenzhen-02',
      factoryName: '深圳工厂02',
      targetSite: '深圳',
      patternVersion: 'P2',
      artworkVersion: 'A1',
      sampleCode: 'SY-SZ-00133',
      status: '待处理' as const,
      priorityLevel: '高' as const,
      createdAt: '2026-04-06 10:10:00',
      updatedAt: '2026-04-06 12:40:00',
    },
    {
      projectCode: 'PRJ-20251216-029',
      firstOrderSampleTaskId: 'FOS-20260425-002',
      firstOrderSampleTaskCode: 'FOS-20260425-002',
      title: '首单样衣打样-已建任务未补齐',
      upstreamModule: '首版样衣打样',
      upstreamObjectType: '首版样衣打样任务',
      upstreamObjectId: 'FSD-20260425-002',
      upstreamObjectCode: 'FSD-20260425-002',
      factoryId: 'factory-shenzhen-01',
      factoryName: '深圳工厂01',
      targetSite: '深圳',
      patternVersion: '',
      artworkVersion: '',
      sampleCode: '',
      sourceTechPackVersionId: 'TDV-ID-0007',
      sourceTechPackVersionCode: 'TDV-20260425-007',
      sourceTechPackVersionLabel: 'V1',
      sourceFirstSampleCode: 'FS-RESULT-25003-PRE',
      finalReferenceNote: '',
      conclusionResult: '' as const,
      conclusionNote: '',
      confirmedAt: '',
      confirmedBy: '',
      emptyPlan: true,
      status: '打样中' as const,
      priorityLevel: '中' as const,
      createdAt: '2026-04-25 10:50:00',
      updatedAt: '2026-04-25 11:00:00',
    },
    {
      projectCode: 'PRJ-20251216-030',
      firstOrderSampleTaskId: 'FOS-20260425-003',
      firstOrderSampleTaskCode: 'FOS-20260425-003',
      title: '首单样衣打样-完成展示',
      upstreamModule: '首版样衣打样',
      upstreamObjectType: '首版样衣打样任务',
      upstreamObjectId: 'FSD-20260425-003',
      upstreamObjectCode: 'FSD-20260425-003',
      factoryId: 'factory-shenzhen-01',
      factoryName: '深圳工厂01',
      targetSite: '深圳',
      patternVersion: 'P2',
      artworkVersion: 'A1',
      sampleCode: 'FOS-RESULT-25001',
      sourceTechPackVersionId: 'TDV-ID-0008',
      sourceTechPackVersionCode: 'TDV-20260425-008',
      sourceTechPackVersionLabel: 'V2',
      sourceFirstSampleCode: 'FS-RESULT-25003',
      finalReferenceNote: '首版样衣确认通过，首单阶段直接沿用。',
      conclusionResult: '通过' as const,
      conclusionNote: '首单样衣确认通过，可进入后续。',
      confirmedAt: '2026-04-25 11:20',
      confirmedBy: '张娜',
      emptyPlan: false,
      status: '已通过' as const,
      priorityLevel: '高' as const,
      createdAt: '2026-04-25 11:00:00',
      updatedAt: '2026-04-25 11:20:00',
    },
  ].forEach((item) => {
    const project = pickProjectByCode(item.projectCode)
    const node = project ? findProjectNodeByWorkItemTypeCode(project.projectId, 'FIRST_ORDER_SAMPLE') : null
    if (!project || !node) return
    tasks.push({
      firstOrderSampleTaskId: item.firstOrderSampleTaskId,
      firstOrderSampleTaskCode: item.firstOrderSampleTaskCode,
      title: item.title,
      projectId: project.projectId,
      projectCode: project.projectCode,
      projectName: project.projectName,
      projectNodeId: node.projectNodeId,
      workItemTypeCode: 'FIRST_ORDER_SAMPLE',
      workItemTypeName: '首单样衣打样',
      sourceType: '项目模板阶段',
      upstreamModule: item.upstreamModule,
      upstreamObjectType: item.upstreamObjectType,
      upstreamObjectId: item.upstreamObjectId,
      upstreamObjectCode: item.upstreamObjectCode,
      factoryId: item.factoryId,
      factoryName: item.factoryName,
      targetSite: item.targetSite,
      patternVersion: item.patternVersion,
      artworkVersion: item.artworkVersion,
      sampleCode: item.sampleCode,
      ...firstOrderChainSeed({
        upstreamObjectId: item.upstreamObjectId,
        upstreamObjectCode: item.upstreamObjectCode,
        sampleCode: 'sourceFirstSampleCode' in item ? item.sourceFirstSampleCode : '',
        dualSample: item.projectCode === 'PRJ-20251216-013',
        sourceTechPackVersionId: 'sourceTechPackVersionId' in item ? item.sourceTechPackVersionId : '',
        sourceTechPackVersionCode: 'sourceTechPackVersionCode' in item ? item.sourceTechPackVersionCode : '',
        sourceTechPackVersionLabel: 'sourceTechPackVersionLabel' in item ? item.sourceTechPackVersionLabel : '',
        finalReferenceNote: 'finalReferenceNote' in item ? item.finalReferenceNote : '',
        conclusionResult: 'conclusionResult' in item ? item.conclusionResult : '',
        conclusionNote: 'conclusionNote' in item ? item.conclusionNote : '',
        confirmedAt: 'confirmedAt' in item ? item.confirmedAt : '',
        confirmedBy: 'confirmedBy' in item ? item.confirmedBy : '',
      }),
      samplePlanLines: 'emptyPlan' in item && item.emptyPlan
        ? []
        : firstOrderChainSeed({
            upstreamObjectId: item.upstreamObjectId,
            upstreamObjectCode: item.upstreamObjectCode,
            sampleCode: 'sourceFirstSampleCode' in item ? item.sourceFirstSampleCode : '',
            dualSample: item.projectCode === 'PRJ-20251216-013',
          }).samplePlanLines,
      status: item.status,
      ownerId: project.ownerId,
      ownerName: project.ownerName,
      priorityLevel: item.priorityLevel,
      createdAt: item.createdAt,
      createdBy: '系统初始化',
      updatedAt: item.updatedAt,
      updatedBy: '系统初始化',
      note: '补充的演示首单样衣打样任务。',
      legacyProjectRef: project.projectCode,
      legacyUpstreamRef: item.upstreamObjectCode,
    })
  })

  return {
    tasks,
    pendingItems: [
      pendingItem('首单样衣打样', 'PP-LEGACY-404', 'PRJ-UNKNOWN-PP', '首单', '历史首单样衣打样记录未找到正式项目或节点。', '2026-01-18 16:30:00'),
    ],
  }
}

export function createTaskBootstrapSnapshot(): TaskBootstrapSnapshot {
  const revision = createRevisionSeeds()
  const plate = createPlateSeeds()
  const pattern = createPatternSeeds()
  const firstSample = createFirstSampleSeeds()
  const firstOrder = createFirstOrderSeeds()
  return {
    revisionTasks: revision.tasks,
    revisionPendingItems: revision.pendingItems,
    plateTasks: plate.tasks,
    platePendingItems: plate.pendingItems,
    patternTasks: pattern.tasks,
    patternPendingItems: pattern.pendingItems,
    firstSampleTasks: firstSample.tasks,
    firstSamplePendingItems: firstSample.pendingItems,
    firstOrderSampleTasks: firstOrder.tasks,
    firstOrderSamplePendingItems: firstOrder.pendingItems,
  }
}

export function createTaskRelationBootstrapSnapshot(): TaskRelationBootstrapSnapshot {
  const snapshot = createTaskBootstrapSnapshot()
  return {
    relations: [
      ...snapshot.revisionTasks
        .filter((task) => task.projectId && task.projectNodeId)
        .map((task) =>
          taskRelationRecord({
            projectId: task.projectId,
            projectCode: task.projectCode,
            projectNodeId: task.projectNodeId,
            workItemTypeCode: task.workItemTypeCode,
            workItemTypeName: task.workItemTypeName,
            sourceModule: '改版任务',
            sourceObjectType: '改版任务',
            sourceObjectId: task.revisionTaskId,
            sourceObjectCode: task.revisionTaskCode,
            sourceTitle: task.title,
            sourceStatus: task.status,
            businessDate: task.createdAt,
            ownerName: task.ownerName,
          }),
        ),
      ...snapshot.plateTasks.map((task) =>
        taskRelationRecord({
          projectId: task.projectId,
          projectCode: task.projectCode,
          projectNodeId: task.projectNodeId,
          workItemTypeCode: task.workItemTypeCode,
          workItemTypeName: task.workItemTypeName,
          sourceModule: '制版任务',
          sourceObjectType: '制版任务',
          sourceObjectId: task.plateTaskId,
          sourceObjectCode: task.plateTaskCode,
          sourceTitle: task.title,
          sourceStatus: task.status,
          businessDate: task.createdAt,
          ownerName: task.ownerName,
          relationRole: '执行记录',
          note: firstSampleRelationMeta(task),
        }),
      ),
      ...snapshot.patternTasks.map((task) =>
        taskRelationRecord({
          projectId: task.projectId,
          projectCode: task.projectCode,
          projectNodeId: task.projectNodeId,
          workItemTypeCode: task.workItemTypeCode,
          workItemTypeName: task.workItemTypeName,
          sourceModule: '花型任务',
          sourceObjectType: '花型任务',
          sourceObjectId: task.patternTaskId,
          sourceObjectCode: task.patternTaskCode,
          sourceTitle: task.title,
          sourceStatus: task.status,
          businessDate: task.createdAt,
          ownerName: task.ownerName,
        }),
      ),
      ...snapshot.firstSampleTasks.map((task) =>
        taskRelationRecord({
          projectId: task.projectId,
          projectCode: task.projectCode,
          projectNodeId: task.projectNodeId,
          workItemTypeCode: task.workItemTypeCode,
          workItemTypeName: task.workItemTypeName,
          sourceModule: '首版样衣打样',
          sourceObjectType: '首版样衣打样任务',
          sourceObjectId: task.firstSampleTaskId,
          sourceObjectCode: task.firstSampleTaskCode,
          sourceTitle: task.title,
          sourceStatus: task.status,
          businessDate: task.createdAt,
          ownerName: task.ownerName,
          relationRole: '执行记录',
          note: firstSampleRelationMeta(task),
        }),
      ),
      ...snapshot.firstOrderSampleTasks.map((task) =>
        taskRelationRecord({
          projectId: task.projectId,
          projectCode: task.projectCode,
          projectNodeId: task.projectNodeId,
          workItemTypeCode: task.workItemTypeCode,
          workItemTypeName: task.workItemTypeName,
          sourceModule: '首单样衣打样',
          sourceObjectType: '首单样衣打样任务',
          sourceObjectId: task.firstOrderSampleTaskId,
          sourceObjectCode: task.firstOrderSampleTaskCode,
          sourceTitle: task.title,
          sourceStatus: task.status,
          businessDate: task.createdAt,
          ownerName: task.ownerName,
          relationRole: '执行记录',
          note: firstOrderRelationMeta(task),
        }),
      ),
    ],
    pendingItems: [
      ...snapshot.revisionPendingItems.map((item) =>
        relationPendingItem('改版任务', item.rawTaskCode, item.rawProjectField, item.reason, item.discoveredAt, item.rawSourceField),
      ),
      ...snapshot.platePendingItems.map((item) =>
        relationPendingItem('制版任务', item.rawTaskCode, item.rawProjectField, item.reason, item.discoveredAt, item.rawSourceField),
      ),
      ...snapshot.patternPendingItems.map((item) =>
        relationPendingItem('花型任务', item.rawTaskCode, item.rawProjectField, item.reason, item.discoveredAt, item.rawSourceField),
      ),
      ...snapshot.firstSamplePendingItems.map((item) =>
        relationPendingItem('首版样衣打样', item.rawTaskCode, item.rawProjectField, item.reason, item.discoveredAt, item.rawSourceField),
      ),
      ...snapshot.firstOrderSamplePendingItems.map((item) =>
        relationPendingItem('首单样衣打样', item.rawTaskCode, item.rawProjectField, item.reason, item.discoveredAt, item.rawSourceField),
      ),
    ],
  }
}
