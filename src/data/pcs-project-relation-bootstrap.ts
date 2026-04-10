import type { PcsProjectNodeRecord, PcsProjectRecord } from './pcs-project-types.ts'
import type {
  ProjectRelationPendingItem,
  ProjectRelationRecord,
  ProjectRelationRole,
  ProjectRelationSourceModule,
  ProjectRelationSourceObjectType,
  ProjectRelationStoreSnapshot,
} from './pcs-project-relation-types.ts'

interface BootstrapRelationSeed {
  sourceModule: ProjectRelationSourceModule
  sourceObjectType: ProjectRelationSourceObjectType
  relationRole: ProjectRelationRole
  sourceObjectId: string
  sourceObjectCode: string
  sourceTitle: string
  sourceStatus: string
  businessDate: string
  ownerName: string
  projectCode: string
  defaultWorkItemTypeCode: string
  legacyRefType: string
  legacyRefValue: string
}

const FORMAL_RELATION_SEEDS: BootstrapRelationSeed[] = [
  {
    sourceModule: '制版任务',
    sourceObjectType: '制版任务',
    relationRole: '产出对象',
    sourceObjectId: 'PT-20260109-002',
    sourceObjectCode: 'PT-20260109-002',
    sourceTitle: '制版-印尼碎花连衣裙(P1)',
    sourceStatus: '已确认',
    businessDate: '2026-01-09 14:30',
    ownerName: '王版师',
    projectCode: 'PRJ-20251216-001',
    defaultWorkItemTypeCode: 'PATTERN_TASK',
    legacyRefType: 'project_ref.id',
    legacyRefValue: 'PRJ-20251216-001',
  },
  {
    sourceModule: '制版任务',
    sourceObjectType: '制版任务',
    relationRole: '产出对象',
    sourceObjectId: 'PT-20260109-001',
    sourceObjectCode: 'PT-20260109-001',
    sourceTitle: '制版-基础款白T恤',
    sourceStatus: '进行中',
    businessDate: '2026-01-09 10:00',
    ownerName: '李版师',
    projectCode: 'PRJ-20251216-002',
    defaultWorkItemTypeCode: 'PATTERN_TASK',
    legacyRefType: 'project_ref.id',
    legacyRefValue: 'PRJ-20251216-002',
  },
  {
    sourceModule: '花型任务',
    sourceObjectType: '花型任务',
    relationRole: '产出对象',
    sourceObjectId: 'AT-20260109-001',
    sourceObjectCode: 'AT-20260109-001',
    sourceTitle: '花型-印尼碎花连衣裙（定位印 A1）',
    sourceStatus: '已确认',
    businessDate: '2025-12-20 14:30',
    ownerName: '林小美',
    projectCode: 'PRJ-20251216-001',
    defaultWorkItemTypeCode: 'PATTERN_ARTWORK_TASK',
    legacyRefType: 'project_ref.id',
    legacyRefValue: 'PRJ-20251216-001',
  },
  {
    sourceModule: '款式档案',
    sourceObjectType: '款式档案',
    relationRole: '产出对象',
    sourceObjectId: 'SPU-20260101-001',
    sourceObjectCode: 'SPU-20260101-001',
    sourceTitle: '印尼风格碎花连衣裙',
    sourceStatus: '启用',
    businessDate: '2026-01-14 10:30',
    ownerName: '',
    projectCode: 'PRJ-20251216-001',
    defaultWorkItemTypeCode: 'STYLE_ARCHIVE_CREATE',
    legacyRefType: 'originProject',
    legacyRefValue: 'PRJ-20251216-001',
  },
]

const PENDING_RELATION_SEEDS: BootstrapRelationSeed[] = [
  {
    sourceModule: '改版任务',
    sourceObjectType: '改版任务',
    relationRole: '产出对象',
    sourceObjectId: 'RT-20260109-003',
    sourceObjectCode: 'RT-20260109-003',
    sourceTitle: '印尼风格碎花连衣裙改版（领口+腰节+面料克重）',
    sourceStatus: '进行中',
    businessDate: '2026-01-09 14:30',
    ownerName: '李版师',
    projectCode: 'PRJ-20260105-001',
    defaultWorkItemTypeCode: 'TEST_CONCLUSION',
    legacyRefType: 'projectId',
    legacyRefValue: 'PRJ-20260105-001',
  },
  {
    sourceModule: '首版样衣打样',
    sourceObjectType: '首版样衣打样任务',
    relationRole: '产出对象',
    sourceObjectId: 'FS-20260109-005',
    sourceObjectCode: 'FS-20260109-005',
    sourceTitle: '首版样衣打样-碎花连衣裙',
    sourceStatus: '验收中',
    businessDate: '2026-01-12 17:05',
    ownerName: '王版师',
    projectCode: 'PRJ-20260105-001',
    defaultWorkItemTypeCode: 'FIRST_SAMPLE',
    legacyRefType: 'project.code',
    legacyRefValue: 'PRJ-20260105-001',
  },
  {
    sourceModule: '产前版样衣',
    sourceObjectType: '产前版样衣任务',
    relationRole: '产出对象',
    sourceObjectId: 'PP-20260115-001',
    sourceObjectCode: 'PP-20260115-001',
    sourceTitle: '产前版-碎花连衣裙',
    sourceStatus: '已完成',
    businessDate: '2026-01-18 16:30',
    ownerName: '王版师',
    projectCode: 'PRJ-20260105-001',
    defaultWorkItemTypeCode: 'PRE_PRODUCTION_SAMPLE',
    legacyRefType: 'projectRef',
    legacyRefValue: 'PRJ-20260105-001',
  },
]

function cloneRelation(relation: ProjectRelationRecord): ProjectRelationRecord {
  return { ...relation }
}

function clonePendingItem(item: ProjectRelationPendingItem): ProjectRelationPendingItem {
  return { ...item }
}

function buildRelationId(seed: BootstrapRelationSeed): string {
  return `rel_${seed.sourceObjectCode.replace(/[^a-zA-Z0-9]/g, '_')}_${seed.defaultWorkItemTypeCode.toLowerCase()}`
}

function buildPendingId(seed: BootstrapRelationSeed): string {
  return `pending_${seed.sourceObjectCode.replace(/[^a-zA-Z0-9]/g, '_')}`
}

function findProjectByCode(projects: PcsProjectRecord[], projectCode: string): PcsProjectRecord | null {
  return projects.find((project) => project.projectCode === projectCode) ?? null
}

function findNodeByWorkItemTypeCode(
  nodes: PcsProjectNodeRecord[],
  projectId: string,
  workItemTypeCode: string,
): PcsProjectNodeRecord | null {
  return (
    nodes
      .filter((node) => node.projectId === projectId && node.workItemTypeCode === workItemTypeCode)
      .sort((a, b) => a.sequenceNo - b.sequenceNo)[0] ?? null
  )
}

function buildRelationRecord(
  seed: BootstrapRelationSeed,
  project: PcsProjectRecord,
  node: PcsProjectNodeRecord | null,
): ProjectRelationRecord {
  return {
    projectRelationId: buildRelationId(seed),
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectNodeId: node?.projectNodeId ?? null,
    workItemTypeCode: seed.defaultWorkItemTypeCode,
    workItemTypeName: node?.workItemTypeName ?? '',
    relationRole: seed.relationRole,
    sourceModule: seed.sourceModule,
    sourceObjectType: seed.sourceObjectType,
    sourceObjectId: seed.sourceObjectId,
    sourceObjectCode: seed.sourceObjectCode,
    sourceLineId: null,
    sourceLineCode: null,
    sourceTitle: seed.sourceTitle,
    sourceStatus: seed.sourceStatus,
    businessDate: seed.businessDate,
    ownerName: seed.ownerName,
    createdAt: seed.businessDate,
    createdBy: '系统初始化',
    updatedAt: seed.businessDate,
    updatedBy: '系统初始化',
    note: node ? '' : '已识别项目，但当前未找到对应项目工作项节点，暂仅挂到项目。',
    legacyRefType: seed.legacyRefType,
    legacyRefValue: seed.legacyRefValue,
  }
}

function buildPendingItem(seed: BootstrapRelationSeed, reason: string): ProjectRelationPendingItem {
  return {
    pendingRelationId: buildPendingId(seed),
    sourceModule: seed.sourceModule,
    sourceObjectCode: seed.sourceObjectCode,
    rawProjectCode: seed.projectCode,
    reason,
    discoveredAt: seed.businessDate,
    sourceTitle: seed.sourceTitle,
    legacyRefType: seed.legacyRefType,
    legacyRefValue: seed.legacyRefValue,
  }
}

export function createBootstrapProjectRelationSnapshot(input: {
  version: number
  projects: PcsProjectRecord[]
  nodes: PcsProjectNodeRecord[]
}): ProjectRelationStoreSnapshot {
  const relations: ProjectRelationRecord[] = []
  const pendingItems: ProjectRelationPendingItem[] = []

  const writeSeed = (seed: BootstrapRelationSeed) => {
    const project = findProjectByCode(input.projects, seed.projectCode)
    if (!project) {
      pendingItems.push(buildPendingItem(seed, '旧关系引用的商品项目不存在，当前未写入正式关系记录。'))
      return
    }

    const node = findNodeByWorkItemTypeCode(input.nodes, project.projectId, seed.defaultWorkItemTypeCode)
    relations.push(buildRelationRecord(seed, project, node))
    if (!node) {
      pendingItems.push(buildPendingItem(seed, '已识别商品项目，但当前未能挂到明确的项目工作项节点。'))
    }
  }

  FORMAL_RELATION_SEEDS.forEach(writeSeed)
  PENDING_RELATION_SEEDS.forEach(writeSeed)

  return {
    version: input.version,
    relations: relations.map(cloneRelation),
    pendingItems: pendingItems.map(clonePendingItem),
  }
}
