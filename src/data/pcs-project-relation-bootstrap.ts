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
  defaultStepCode: string
  legacyRefType: string
  legacyRefValue: string
}

const FORMAL_RELATION_SEEDS: BootstrapRelationSeed[] = [
  {
    sourceModule: '项目资料归档',
    sourceObjectType: '项目资料归档',
    relationRole: '产出对象',
    sourceObjectId: 'project_archive_bootstrap_006',
    sourceObjectCode: 'ARC-BOOT-006',
    sourceTitle: '通勤直筒西裤项目资料归档',
    sourceStatus: 'DRAFT',
    businessDate: '2026-04-05 09:20',
    ownerName: '系统初始化',
    projectCode: 'PRJ-202603-002',
    defaultStepCode: '',
    legacyRefType: 'bootstrap.projectArchive',
    legacyRefValue: 'PRJ-202603-002',
  },
  {
    sourceModule: '项目资料归档',
    sourceObjectType: '项目资料归档',
    relationRole: '产出对象',
    sourceObjectId: 'project_archive_bootstrap_007',
    sourceObjectCode: 'ARC-BOOT-007',
    sourceTitle: '春季休闲印花短袖T恤项目资料归档',
    sourceStatus: 'DRAFT',
    businessDate: '2026-04-01 10:40',
    ownerName: '系统初始化',
    projectCode: 'PRJ-202603-003',
    defaultStepCode: '',
    legacyRefType: 'bootstrap.projectArchive',
    legacyRefValue: 'PRJ-202603-003',
  },
  {
    sourceModule: '项目资料归档',
    sourceObjectType: '项目资料归档',
    relationRole: '产出对象',
    sourceObjectId: 'project_archive_bootstrap_008',
    sourceObjectCode: 'ARC-BOOT-008',
    sourceTitle: 'Polo Shirt Pique 男装项目资料归档',
    sourceStatus: 'FINALIZED',
    businessDate: '2026-04-06 16:30',
    ownerName: '系统初始化',
    projectCode: 'PRJ-202603-004',
    defaultStepCode: '',
    legacyRefType: 'bootstrap.projectArchive',
    legacyRefValue: 'PRJ-202603-004',
  },
  {
    sourceModule: '项目资料归档',
    sourceObjectType: '项目资料归档',
    relationRole: '产出对象',
    sourceObjectId: 'project_archive_bootstrap_004',
    sourceObjectCode: 'ARC-BOOT-004',
    sourceTitle: 'Celana Jogger Pria 运动裤项目资料归档',
    sourceStatus: 'DRAFT',
    businessDate: '2026-04-03 15:20',
    ownerName: '系统初始化',
    projectCode: 'PRJ-202603-005',
    defaultStepCode: '',
    legacyRefType: 'bootstrap.projectArchive',
    legacyRefValue: 'PRJ-202603-005',
  },
  {
    sourceModule: '项目资料归档',
    sourceObjectType: '项目资料归档',
    relationRole: '产出对象',
    sourceObjectId: 'project_archive_bootstrap_005',
    sourceObjectCode: 'ARC-BOOT-005',
    sourceTitle: '男士休闲长裤项目资料归档',
    sourceStatus: 'DRAFT',
    businessDate: '2026-04-02 11:00',
    ownerName: '系统初始化',
    projectCode: 'PRJ-202603-008',
    defaultStepCode: '',
    legacyRefType: 'bootstrap.projectArchive',
    legacyRefValue: 'PRJ-202603-008',
  },
  {
    sourceModule: '项目资料归档',
    sourceObjectType: '项目资料归档',
    relationRole: '产出对象',
    sourceObjectId: 'project_archive_bootstrap_003',
    sourceObjectCode: 'ARC-BOOT-003',
    sourceTitle: 'Blazer Wanita Formal 女装正装外套项目资料归档',
    sourceStatus: 'DRAFT',
    businessDate: '2026-04-04 16:10',
    ownerName: '系统初始化',
    projectCode: 'PRJ-202603-010',
    defaultStepCode: '',
    legacyRefType: 'bootstrap.projectArchive',
    legacyRefValue: 'PRJ-202603-010',
  },
  {
    sourceModule: '项目资料归档',
    sourceObjectType: '项目资料归档',
    relationRole: '产出对象',
    sourceObjectId: 'project_archive_bootstrap_002',
    sourceObjectCode: 'ARC-BOOT-002',
    sourceTitle: 'Jaket Hoodie Unisex 连帽夹克项目资料归档',
    sourceStatus: 'DRAFT',
    businessDate: '2026-04-05 10:50',
    ownerName: '系统初始化',
    projectCode: 'PRJ-202603-011',
    defaultStepCode: '',
    legacyRefType: 'bootstrap.projectArchive',
    legacyRefValue: 'PRJ-202603-011',
  },
  {
    sourceModule: '项目资料归档',
    sourceObjectType: '项目资料归档',
    relationRole: '产出对象',
    sourceObjectId: 'project_archive_bootstrap_001',
    sourceObjectCode: 'ARC-BOOT-001',
    sourceTitle: 'Kaos Polos Premium 高端纯色T恤项目资料归档',
    sourceStatus: 'DRAFT',
    businessDate: '2026-04-06 14:40',
    ownerName: '系统初始化',
    projectCode: 'PRJ-202603-012',
    defaultStepCode: '',
    legacyRefType: 'bootstrap.projectArchive',
    legacyRefValue: 'PRJ-202603-012',
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
    defaultStepCode: 'TEST_CONCLUSION',
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
    defaultStepCode: 'FIRST_SAMPLE',
    legacyRefType: 'project.code',
    legacyRefValue: 'PRJ-20260105-001',
  },
  {
    sourceModule: '首单样衣打样',
    sourceObjectType: '首单样衣打样任务',
    relationRole: '产出对象',
    sourceObjectId: 'PP-20260115-001',
    sourceObjectCode: 'PP-20260115-001',
    sourceTitle: '首单-碎花连衣裙',
    sourceStatus: '已通过',
    businessDate: '2026-01-18 16:30',
    ownerName: '王版师',
    projectCode: 'PRJ-20260105-001',
    defaultStepCode: 'FIRST_ORDER_SAMPLE',
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
  return `rel_${seed.sourceObjectCode.replace(/[^a-zA-Z0-9]/g, '_')}_${seed.defaultStepCode.toLowerCase()}`
}

function buildPendingId(seed: BootstrapRelationSeed): string {
  return `pending_${seed.sourceObjectCode.replace(/[^a-zA-Z0-9]/g, '_')}`
}

function findProjectByCode(projects: PcsProjectRecord[], projectCode: string): PcsProjectRecord | null {
  return projects.find((project) => project.projectCode === projectCode) ?? null
}

function findNodeByStepTypeCode(
  nodes: PcsProjectNodeRecord[],
  projectId: string,
  stepCode: string,
): PcsProjectNodeRecord | null {
  return (
    nodes
      .filter((node) => node.projectId === projectId && node.stepCode === stepCode)
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
    stepCode: seed.defaultStepCode,
    stepName: node?.stepName ?? '',
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
    note: '',
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

    const node = seed.defaultStepCode
      ? findNodeByStepTypeCode(input.nodes, project.projectId, seed.defaultStepCode)
      : null
    relations.push(buildRelationRecord(seed, project, node))
    if (seed.defaultStepCode && !node) {
      pendingItems.push(buildPendingItem(seed, '已识别商品项目，但当前未能挂到明确的项目步骤节点。'))
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
