import {
  findProjectByCode,
  findProjectNodeByWorkItemTypeCode,
} from './pcs-project-repository.ts'
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
import type { PreProductionSampleTaskRecord } from './pcs-pre-production-sample-types.ts'
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
  preProductionSampleTasks: PreProductionSampleTaskRecord[]
  preProductionSamplePendingItems: PcsTaskPendingItem[]
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
}): ProjectRelationRecord {
  return {
    projectRelationId: `rel_bootstrap_${input.projectId}_${input.projectNodeId}_${input.sourceObjectId}`.replace(/[^a-zA-Z0-9]/g, '_'),
    projectId: input.projectId,
    projectCode: input.projectCode,
    projectNodeId: input.projectNodeId,
    workItemTypeCode: input.workItemTypeCode,
    workItemTypeName: input.workItemTypeName,
    relationRole: '产出对象',
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
    note: '历史任务已迁移为正式项目关系。',
    legacyRefType: '任务迁移',
    legacyRefValue: input.sourceObjectCode,
  }
}

function createRevisionSeeds(): { tasks: RevisionTaskRecord[]; pendingItems: PcsTaskPendingItem[] } {
  const tasks: RevisionTaskRecord[] = []
  const projectA = pickProjectByCode('PRJ-20251216-001')
  const projectB = pickProjectByCode('PRJ-20251216-010')
  const nodeA = projectA ? findProjectNodeByWorkItemTypeCode(projectA.projectId, 'TEST_CONCLUSION') : null
  const nodeB = projectB ? findProjectNodeByWorkItemTypeCode(projectB.projectId, 'TEST_CONCLUSION') : null

  if (projectA && nodeA) {
    tasks.push({
      revisionTaskId: 'RT-20260109-003',
      revisionTaskCode: 'RT-20260109-003',
      title: '印尼风格碎花连衣裙改版（领口、腰节、面料克重）',
      projectId: projectA.projectId,
      projectCode: projectA.projectCode,
      projectName: projectA.projectName,
      projectNodeId: nodeA.projectNodeId,
      workItemTypeCode: 'TEST_CONCLUSION',
      workItemTypeName: '测款结论判定',
      sourceType: '测款触发',
      upstreamModule: '测款结论',
      upstreamObjectType: '项目工作项',
      upstreamObjectId: nodeA.projectNodeId,
      upstreamObjectCode: 'WI-20260108-011',
      productStyleCode: 'SPU-LY-2401',
      spuCode: 'SPU-LY-2401',
      status: '进行中',
      ownerId: projectA.ownerId,
      ownerName: '李版师',
      participantNames: ['王测款', '张仓管'],
      priorityLevel: '高',
      dueAt: '2026-01-15 18:00:00',
      revisionScopeCodes: ['PATTERN', 'SIZE', 'FABRIC'],
      revisionScopeNames: ['版型结构', '尺码规格', '面料'],
      revisionVersion: '',
      createdAt: '2026-01-09 09:30:00',
      createdBy: '系统初始化',
      updatedAt: '2026-01-09 14:30:00',
      updatedBy: '系统初始化',
      note: '历史改版任务已迁移到正式仓储。',
      legacyProjectRef: projectA.projectCode,
      legacyUpstreamRef: 'WI-20260108-011',
    })
  }

  if (projectB && nodeB) {
    tasks.push({
      revisionTaskId: 'RT-20260108-002',
      revisionTaskCode: 'RT-20260108-002',
      title: '波西米亚印花长裙花型与颜色改版',
      projectId: projectB.projectId,
      projectCode: projectB.projectCode,
      projectName: projectB.projectName,
      projectNodeId: nodeB.projectNodeId,
      workItemTypeCode: 'TEST_CONCLUSION',
      workItemTypeName: '测款结论判定',
      sourceType: '既有商品改款',
      upstreamModule: '',
      upstreamObjectType: '',
      upstreamObjectId: '',
      upstreamObjectCode: '',
      productStyleCode: 'SPU-BX-2402',
      spuCode: 'SPU-BX-2402',
      status: '待评审',
      ownerId: projectB.ownerId,
      ownerName: '王版师',
      participantNames: ['李设计'],
      priorityLevel: '中',
      dueAt: '2026-01-18 18:00:00',
      revisionScopeCodes: ['PRINT', 'COLOR'],
      revisionScopeNames: ['花型', '颜色'],
      revisionVersion: 'R1',
      createdAt: '2026-01-08 10:00:00',
      createdBy: '系统初始化',
      updatedAt: '2026-01-09 11:00:00',
      updatedBy: '系统初始化',
      note: '历史既有商品改款任务已迁移。',
      legacyProjectRef: projectB.projectCode,
      legacyUpstreamRef: '',
    })
  }

  return {
    tasks,
    pendingItems: [
      pendingItem('改版任务', 'RT-LEGACY-404', 'PRJ-404-NOT-FOUND', 'WI-LEGACY-001', '历史改版任务引用的商品项目不存在。', '2026-01-09 14:30:00'),
    ],
  }
}

function createPlateSeeds(): { tasks: PlateMakingTaskRecord[]; pendingItems: PcsTaskPendingItem[] } {
  const tasks: PlateMakingTaskRecord[] = []
  const projectA = pickProjectByCode('PRJ-20251216-001')
  const projectB = pickProjectByCode('PRJ-20251216-002')
  const nodeA = projectA ? findProjectNodeByWorkItemTypeCode(projectA.projectId, 'PATTERN_TASK') : null
  const nodeB = projectB ? findProjectNodeByWorkItemTypeCode(projectB.projectId, 'PATTERN_TASK') : null

  if (projectA && nodeA) {
    tasks.push({
      plateTaskId: 'PT-20260109-002',
      plateTaskCode: 'PT-20260109-002',
      title: '制版-印尼碎花连衣裙(P1)',
      projectId: projectA.projectId,
      projectCode: projectA.projectCode,
      projectName: projectA.projectName,
      projectNodeId: nodeA.projectNodeId,
      workItemTypeCode: 'PATTERN_TASK',
      workItemTypeName: '制版任务',
      sourceType: '改版任务',
      upstreamModule: '改版任务',
      upstreamObjectType: '改版任务',
      upstreamObjectId: 'RT-20260109-003',
      upstreamObjectCode: 'RT-20260109-003',
      productStyleCode: 'SPU-001',
      spuCode: 'SPU-001',
      patternType: '连衣裙',
      sizeRange: 'S-XL',
      patternVersion: 'P1',
      status: '已确认',
      ownerId: projectA.ownerId,
      ownerName: '王版师',
      participantNames: ['张工', '李工'],
      priorityLevel: '高',
      dueAt: '2026-01-15 18:00:00',
      createdAt: '2026-01-09 14:30:00',
      createdBy: '系统初始化',
      updatedAt: '2026-01-09 14:30:00',
      updatedBy: '系统初始化',
      note: '历史制版任务已迁移到正式仓储。',
      legacyProjectRef: projectA.projectCode,
      legacyUpstreamRef: 'RT-20260109-003',
    })
  }

  if (projectB && nodeB) {
    tasks.push({
      plateTaskId: 'PT-20260109-001',
      plateTaskCode: 'PT-20260109-001',
      title: '制版-百搭纯色基础短袖',
      projectId: projectB.projectId,
      projectCode: projectB.projectCode,
      projectName: projectB.projectName,
      projectNodeId: nodeB.projectNodeId,
      workItemTypeCode: 'PATTERN_TASK',
      workItemTypeName: '制版任务',
      sourceType: '项目模板阶段',
      upstreamModule: '项目模板',
      upstreamObjectType: '模板阶段',
      upstreamObjectId: projectB.templateId,
      upstreamObjectCode: projectB.templateVersion,
      productStyleCode: 'SPU-002',
      spuCode: 'SPU-002',
      patternType: '上衣',
      sizeRange: 'XS-XXL',
      patternVersion: '',
      status: '进行中',
      ownerId: projectB.ownerId,
      ownerName: '李版师',
      participantNames: [],
      priorityLevel: '中',
      dueAt: '2026-01-12 18:00:00',
      createdAt: '2026-01-09 10:00:00',
      createdBy: '系统初始化',
      updatedAt: '2026-01-09 10:00:00',
      updatedBy: '系统初始化',
      note: '历史模板阶段制版任务已迁移。',
      legacyProjectRef: projectB.projectCode,
      legacyUpstreamRef: '',
    })
  }

  return {
    tasks,
    pendingItems: [
      pendingItem('制版任务', 'PT-LEGACY-404', 'PRJ-UNKNOWN', 'RT-UNKNOWN', '历史制版任务未能识别正式商品项目或项目节点。', '2026-01-09 10:00:00'),
    ],
  }
}

function createPatternSeeds(): { tasks: PatternTaskRecord[]; pendingItems: PcsTaskPendingItem[] } {
  const tasks: PatternTaskRecord[] = []
  const projectA = pickProjectByCode('PRJ-20251216-010')
  const projectB = pickProjectByCode('PRJ-20251216-003')
  const nodeA = projectA ? findProjectNodeByWorkItemTypeCode(projectA.projectId, 'PATTERN_ARTWORK_TASK') : null
  const nodeB = projectB ? findProjectNodeByWorkItemTypeCode(projectB.projectId, 'PATTERN_ARTWORK_TASK') : null

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
      upstreamObjectId: 'RT-20260108-002',
      upstreamObjectCode: 'RT-20260108-002',
      productStyleCode: 'SPU-010',
      spuCode: 'SPU-010',
      artworkType: '印花',
      patternMode: '定位印',
      artworkName: 'Bunga Tropis A1',
      artworkVersion: 'A1',
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
      legacyUpstreamRef: 'RT-20260108-002',
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
      sourceType: '项目模板阶段',
      upstreamModule: '项目模板',
      upstreamObjectType: '模板阶段',
      upstreamObjectId: projectB.templateId,
      upstreamObjectCode: projectB.templateVersion,
      productStyleCode: 'SPU-003',
      spuCode: 'SPU-003',
      artworkType: '印花',
      patternMode: '满印',
      artworkName: 'Summer Denim',
      artworkVersion: '',
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

  return {
    tasks,
    pendingItems: [
      pendingItem('花型任务', 'AT-LEGACY-404', 'PRJ-LOST-001', 'RT-LOST-001', '历史花型任务引用的项目不存在，当前未迁移。', '2026-01-08 16:45:00'),
    ],
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
      expectedArrival: '2026-01-20 18:00:00',
      trackingNo: 'FS-TRACK-3',
      sampleAssetId: '',
      sampleCode: 'SY-SZ-00088',
      status: '待发样',
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
      expectedArrival: '2026-01-13 18:00:00',
      trackingNo: 'FS-TRACK-1',
      sampleAssetId: '',
      sampleCode: 'SY-JKT-00031',
      status: '在途',
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

  return {
    tasks,
    pendingItems: [
      pendingItem('首版样衣打样', 'FS-LEGACY-404', 'PRJ-NOT-EXISTS', 'pattern', '历史首版样衣打样记录未找到正式项目。', '2026-01-12 17:05:00'),
    ],
  }
}

function createPreProductionSeeds(): { tasks: PreProductionSampleTaskRecord[]; pendingItems: PcsTaskPendingItem[] } {
  const tasks: PreProductionSampleTaskRecord[] = []
  const projectA = pickProjectByCode('PRJ-20251216-010')
  const projectB = pickProjectByCode('PRJ-20251216-003')
  const nodeA = projectA ? findProjectNodeByWorkItemTypeCode(projectA.projectId, 'PRE_PRODUCTION_SAMPLE') : null
  const nodeB = projectB ? findProjectNodeByWorkItemTypeCode(projectB.projectId, 'PRE_PRODUCTION_SAMPLE') : null

  if (projectA && nodeA) {
    tasks.push({
      preProductionSampleTaskId: 'PP-20260124-003',
      preProductionSampleTaskCode: 'PP-20260124-003',
      title: `产前版样衣-${projectA.projectName}`,
      projectId: projectA.projectId,
      projectCode: projectA.projectCode,
      projectName: projectA.projectName,
      projectNodeId: nodeA.projectNodeId,
      workItemTypeCode: 'PRE_PRODUCTION_SAMPLE',
      workItemTypeName: '产前版样衣',
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
      expectedArrival: '2026-01-24 18:00:00',
      trackingNo: 'PP-TRACK-3',
      sampleAssetId: '',
      sampleCode: 'SY-JKT-00068',
      status: '待发样',
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
      preProductionSampleTaskId: 'PP-20260121-001',
      preProductionSampleTaskCode: 'PP-20260121-001',
      title: `产前版样衣-${projectB.projectName}`,
      projectId: projectB.projectId,
      projectCode: projectB.projectCode,
      projectName: projectB.projectName,
      projectNodeId: nodeB.projectNodeId,
      workItemTypeCode: 'PRE_PRODUCTION_SAMPLE',
      workItemTypeName: '产前版样衣',
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
      expectedArrival: '2026-01-23 18:00:00',
      trackingNo: 'PP-TRACK-1',
      sampleAssetId: '',
      sampleCode: 'SY-SZ-00052',
      status: '在途',
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

  return {
    tasks,
    pendingItems: [
      pendingItem('产前版样衣', 'PP-LEGACY-404', 'PRJ-UNKNOWN-PP', '首单', '历史产前版样衣记录未找到正式项目或节点。', '2026-01-18 16:30:00'),
    ],
  }
}

export function createTaskBootstrapSnapshot(): TaskBootstrapSnapshot {
  const revision = createRevisionSeeds()
  const plate = createPlateSeeds()
  const pattern = createPatternSeeds()
  const firstSample = createFirstSampleSeeds()
  const preProduction = createPreProductionSeeds()
  return {
    revisionTasks: revision.tasks,
    revisionPendingItems: revision.pendingItems,
    plateTasks: plate.tasks,
    platePendingItems: plate.pendingItems,
    patternTasks: pattern.tasks,
    patternPendingItems: pattern.pendingItems,
    firstSampleTasks: firstSample.tasks,
    firstSamplePendingItems: firstSample.pendingItems,
    preProductionSampleTasks: preProduction.tasks,
    preProductionSamplePendingItems: preProduction.pendingItems,
  }
}

export function createTaskRelationBootstrapSnapshot(): TaskRelationBootstrapSnapshot {
  const snapshot = createTaskBootstrapSnapshot()
  return {
    relations: [
      ...snapshot.revisionTasks.map((task) =>
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
        }),
      ),
      ...snapshot.preProductionSampleTasks.map((task) =>
        taskRelationRecord({
          projectId: task.projectId,
          projectCode: task.projectCode,
          projectNodeId: task.projectNodeId,
          workItemTypeCode: task.workItemTypeCode,
          workItemTypeName: task.workItemTypeName,
          sourceModule: '产前版样衣',
          sourceObjectType: '产前版样衣任务',
          sourceObjectId: task.preProductionSampleTaskId,
          sourceObjectCode: task.preProductionSampleTaskCode,
          sourceTitle: task.title,
          sourceStatus: task.status,
          businessDate: task.createdAt,
          ownerName: task.ownerName,
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
      ...snapshot.preProductionSamplePendingItems.map((item) =>
        relationPendingItem('产前版样衣', item.rawTaskCode, item.rawProjectField, item.reason, item.discoveredAt, item.rawSourceField),
      ),
    ],
  }
}
