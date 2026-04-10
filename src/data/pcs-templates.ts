import { getProjectPhaseDefinitionByCode, listProjectPhaseDefinitions } from './pcs-project-phase-definitions.ts'
import {
  normalizeLegacyProjectTemplateSeed,
  type LegacyTemplateStageSeed,
  type ProjectTemplateNodeDefinition,
  type ProjectTemplatePendingNode,
  type ProjectTemplateStageDefinition,
} from './pcs-project-definition-normalizer.ts'
import { getPcsWorkItemDefinition } from './pcs-work-items.ts'

export type TemplateStatusCode = 'active' | 'inactive'
export type TemplateStyleType = '基础款' | '快时尚款' | '改版款' | '设计款'

export interface ProjectTemplate {
  id: string
  name: string
  styleType: TemplateStyleType[]
  creator: string
  createdAt: string
  updatedAt: string
  status: TemplateStatusCode
  description: string
  stages: ProjectTemplateStageDefinition[]
  nodes: ProjectTemplateNodeDefinition[]
  pendingNodes: ProjectTemplatePendingNode[]
}

interface LegacyProjectTemplateSeed {
  id: string
  name: string
  styleType: TemplateStyleType[]
  creator: string
  createdAt: string
  updatedAt: string
  status: TemplateStatusCode
  description: string
  stages: LegacyTemplateStageSeed[]
}

const LEGACY_TEMPLATE_SEEDS: LegacyProjectTemplateSeed[] = [
  {
    id: 'TPL-001',
    name: '基础款 - 完整流程模板',
    styleType: ['基础款'],
    creator: '系统管理员',
    createdAt: '2025-01-01 09:00',
    updatedAt: '2026-04-10 09:00',
    status: 'active',
    description: '适用于基础款的完整商品项目流程模板。',
    stages: [
      {
        id: 'TPL-001-S1',
        name: '01 立项获取',
        description: '立项、样衣获取、到样核对。',
        required: true,
        workItems: [
          { id: 'TPL-001-S1-W1', name: '商品项目立项', required: '必做' },
          { id: 'TPL-001-S1-W2', name: '样衣获取（深圳前置打版）', required: '必做', multiInstanceFlag: true },
          { id: 'TPL-001-S1-W3', name: '到样入库与核对', required: '必做' },
        ],
      },
      {
        id: 'TPL-001-S2',
        name: '02 评估定价',
        description: '样衣评估、核价和定价。',
        required: true,
        workItems: [
          { id: 'TPL-001-S2-W1', name: '初步可行性判断', required: '必做' },
          { id: 'TPL-001-S2-W2', name: '样衣拍摄与试穿', required: '必做' },
          { id: 'TPL-001-S2-W3', name: '样衣确认', required: '必做' },
          { id: 'TPL-001-S2-W4', name: '样衣核价', required: '必做' },
          { id: 'TPL-001-S2-W5', name: '样衣定价', required: '必做' },
        ],
      },
      {
        id: 'TPL-001-S3',
        name: '03 市场测款',
        description: '短视频与直播双测款。',
        required: true,
        workItems: [
          { id: 'TPL-001-S3-W1', name: '短视频测款', required: '必做', multiInstanceFlag: true },
          { id: 'TPL-001-S3-W2', name: '直播测款', required: '必做', multiInstanceFlag: true },
          { id: 'TPL-001-S3-W3', name: '测款数据汇总', required: '必做' },
          { id: 'TPL-001-S3-W4', name: '测款结论判定', required: '必做' },
        ],
      },
      {
        id: 'TPL-001-S4',
        name: '04 开发推进',
        description: '转档与工程推进。',
        required: true,
        workItems: [
          { id: 'TPL-001-S4-W1', name: '生成商品档案', required: '必做' },
          { id: 'TPL-001-S4-W2', name: '商品项目转档', required: '必做' },
          { id: 'TPL-001-S4-W3', name: '制版准备·打版任务', required: '可选' },
          { id: 'TPL-001-S4-W4', name: '首版样衣打样', required: '可选' },
        ],
      },
      {
        id: 'TPL-001-S5',
        name: '05 项目收尾',
        description: '留存与退回处理。',
        required: true,
        workItems: [
          { id: 'TPL-001-S5-W1', name: '样衣留存评估', required: '可选' },
          { id: 'TPL-001-S5-W2', name: '样衣退货与处理', required: '可选' },
        ],
      },
    ],
  },
  {
    id: 'TPL-002',
    name: '快时尚款 - 快速上新模板',
    styleType: ['快时尚款'],
    creator: '系统管理员',
    createdAt: '2025-01-01 09:00',
    updatedAt: '2026-04-10 09:00',
    status: 'active',
    description: '适用于快反上新的高时效项目模板。',
    stages: [
      {
        id: 'TPL-002-S1',
        name: '01 立项获取',
        description: '快速立项与样衣获取。',
        required: true,
        workItems: [
          { id: 'TPL-002-S1-W1', name: '商品项目立项', required: '必做' },
          { id: 'TPL-002-S1-W2', name: '样衣获取', required: '必做' },
        ],
      },
      {
        id: 'TPL-002-S2',
        name: '02 样衣与评估',
        description: '快速完成样衣判断和定价。',
        required: true,
        workItems: [
          { id: 'TPL-002-S2-W1', name: '初步可行性判断', required: '必做' },
          { id: 'TPL-002-S2-W2', name: '样衣确认', required: '必做' },
          { id: 'TPL-002-S2-W3', name: '样衣核价', required: '必做' },
          { id: 'TPL-002-S2-W4', name: '样衣定价', required: '必做' },
        ],
      },
      {
        id: 'TPL-002-S3',
        name: '03 市场测款',
        description: '直播测款为主的验证路径。',
        required: true,
        workItems: [
          { id: 'TPL-002-S3-W1', name: '直播测款', required: '必做', multiInstanceFlag: true },
          { id: 'TPL-002-S3-W2', name: '测款数据汇总', required: '必做' },
          { id: 'TPL-002-S3-W3', name: '测款结论判定', required: '必做' },
        ],
      },
      {
        id: 'TPL-002-S4',
        name: '04 开发推进',
        description: '快速转档与渠道准备。',
        required: true,
        workItems: [
          { id: 'TPL-002-S4-W1', name: '项目转档准备', required: '必做' },
          { id: 'TPL-002-S4-W2', name: '制版任务', required: '可选' },
          { id: 'TPL-002-S4-W3', name: '商品上架', required: '可选' },
        ],
      },
      {
        id: 'TPL-002-S5',
        name: '05 项目收尾',
        description: '样衣留存评估。',
        required: true,
        workItems: [{ id: 'TPL-002-S5-W1', name: '样衣留存与库存', required: '可选' }],
      },
    ],
  },
  {
    id: 'TPL-003',
    name: '改版款 - 转档推进模板',
    styleType: ['改版款'],
    creator: '系统管理员',
    createdAt: '2025-01-01 09:00',
    updatedAt: '2026-04-10 09:00',
    status: 'active',
    description: '适用于改版开发的商品项目模板。',
    stages: [
      {
        id: 'TPL-003-S1',
        name: '01 立项阶段',
        description: '立项与样衣准备。',
        required: true,
        workItems: [
          { id: 'TPL-003-S1-W1', name: '商品项目立项', required: '必做' },
          { id: 'TPL-003-S1-W2', name: '样衣获取', required: '必做' },
          { id: 'TPL-003-S1-W3', name: '到样入库与核对', required: '必做' },
        ],
      },
      {
        id: 'TPL-003-S2',
        name: '02 评估定价',
        description: '评估、确认和定价。',
        required: true,
        workItems: [
          { id: 'TPL-003-S2-W1', name: '初步可行性判断', required: '必做' },
          { id: 'TPL-003-S2-W2', name: '样衣确认', required: '必做' },
          { id: 'TPL-003-S2-W3', name: '样衣核价', required: '必做' },
        ],
      },
      {
        id: 'TPL-003-S3',
        name: '03 测款阶段',
        description: '直播测款与判定。',
        required: true,
        workItems: [
          { id: 'TPL-003-S3-W1', name: '直播测款', required: '必做', multiInstanceFlag: true },
          { id: 'TPL-003-S3-W2', name: '测款数据汇总', required: '必做' },
          { id: 'TPL-003-S3-W3', name: '测款结论判定', required: '必做' },
        ],
      },
      {
        id: 'TPL-003-S4',
        name: '04 结论与推进',
        description: '转档与打样推进。',
        required: true,
        workItems: [
          { id: 'TPL-003-S4-W1', name: '生成商品档案', required: '必做' },
          { id: 'TPL-003-S4-W2', name: '转档准备', required: '必做' },
          { id: 'TPL-003-S4-W3', name: '首版样衣打样', required: '可选' },
        ],
      },
    ],
  },
  {
    id: 'TPL-004',
    name: '设计款 - 测款推进模板',
    styleType: ['设计款'],
    creator: '系统管理员',
    createdAt: '2025-01-01 09:00',
    updatedAt: '2026-04-10 09:00',
    status: 'active',
    description: '适用于设计研发款的测款推进模板。',
    stages: [
      {
        id: 'TPL-004-S1',
        name: '01 立项获取',
        description: '立项与样衣准备。',
        required: true,
        workItems: [
          { id: 'TPL-004-S1-W1', name: '商品项目立项', required: '必做' },
          { id: 'TPL-004-S1-W2', name: '样衣获取', required: '必做' },
          { id: 'TPL-004-S1-W3', name: '到样入库与核对', required: '必做' },
        ],
      },
      {
        id: 'TPL-004-S2',
        name: '02 样衣与评估',
        description: '样衣评估与定价。',
        required: true,
        workItems: [
          { id: 'TPL-004-S2-W1', name: '样衣拍摄与试穿', required: '必做' },
          { id: 'TPL-004-S2-W2', name: '样衣确认', required: '必做' },
          { id: 'TPL-004-S2-W3', name: '样衣核价', required: '必做' },
          { id: 'TPL-004-S2-W4', name: '样衣定价', required: '必做' },
        ],
      },
      {
        id: 'TPL-004-S3',
        name: '03 市场测款',
        description: '视频、直播双测款。',
        required: true,
        workItems: [
          { id: 'TPL-004-S3-W1', name: '短视频测款', required: '必做', multiInstanceFlag: true },
          { id: 'TPL-004-S3-W2', name: '直播测款', required: '必做', multiInstanceFlag: true },
          { id: 'TPL-004-S3-W3', name: '测款数据汇总', required: '必做' },
          { id: 'TPL-004-S3-W4', name: '测款结论判定', required: '必做' },
        ],
      },
      {
        id: 'TPL-004-S4',
        name: '04 开发推进',
        description: '档案、花型和样衣推进。',
        required: true,
        workItems: [
          { id: 'TPL-004-S4-W1', name: '生成商品档案', required: '必做' },
          { id: 'TPL-004-S4-W2', name: '花型任务', required: '可选' },
          { id: 'TPL-004-S4-W3', name: '首版样衣打样', required: '可选' },
          { id: 'TPL-004-S4-W4', name: '产前版样衣', required: '可选' },
        ],
      },
    ],
  },
]

let templateStore: ProjectTemplate[] = LEGACY_TEMPLATE_SEEDS.map((seed) => normalizeLegacyTemplate(seed))

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function nextTemplateId(): string {
  const max = templateStore.reduce((acc, item) => {
    const parsed = Number(item.id.replace('TPL-', ''))
    return Number.isNaN(parsed) ? acc : Math.max(acc, parsed)
  }, 0)
  return `TPL-${String(max + 1).padStart(3, '0')}`
}

function cloneStage(stage: ProjectTemplateStageDefinition): ProjectTemplateStageDefinition {
  return { ...stage }
}

function cloneNode(node: ProjectTemplateNodeDefinition): ProjectTemplateNodeDefinition {
  return {
    ...node,
    roleOverrideCodes: [...node.roleOverrideCodes],
    roleOverrideNames: [...node.roleOverrideNames],
  }
}

function clonePendingNode(node: ProjectTemplatePendingNode): ProjectTemplatePendingNode {
  return { ...node }
}

function cloneTemplate(template: ProjectTemplate): ProjectTemplate {
  return {
    ...template,
    styleType: [...template.styleType],
    stages: template.stages.map(cloneStage),
    nodes: template.nodes.map(cloneNode),
    pendingNodes: template.pendingNodes.map(clonePendingNode),
  }
}

function buildTemplateVersion(updatedAt: string): string {
  return updatedAt
}

function normalizeStructuredTemplate(template: ProjectTemplate): ProjectTemplate {
  const orderedStages = template.stages
    .slice()
    .sort((a, b) => a.phaseOrder - b.phaseOrder)
    .map((stage) => {
      const phase = getProjectPhaseDefinitionByCode(stage.phaseCode)
      return {
        ...stage,
        phaseName: phase?.phaseName ?? stage.phaseName,
        description: stage.description.trim(),
      }
    })

  const orderedNodes = template.nodes
    .slice()
    .sort((a, b) => {
      if (a.phaseCode === b.phaseCode) return a.sequenceNo - b.sequenceNo
      return a.phaseCode.localeCompare(b.phaseCode)
    })
    .map((node) => {
      const workItem = getPcsWorkItemDefinition(node.workItemId)
      return {
        ...node,
        phaseName: getProjectPhaseDefinitionByCode(node.phaseCode)?.phaseName ?? node.phaseName,
        workItemTypeCode: workItem?.workItemTypeCode ?? node.workItemTypeCode,
        workItemTypeName: workItem?.workItemTypeName ?? node.workItemTypeName,
        multiInstanceFlag: workItem?.capabilities.canMultiInstance === false ? false : node.multiInstanceFlag,
        roleOverrideCodes: [...node.roleOverrideCodes],
        roleOverrideNames: [...node.roleOverrideNames],
      }
    })

  return {
    ...template,
    stages: orderedStages,
    nodes: orderedNodes,
    pendingNodes: template.pendingNodes.map(clonePendingNode),
  }
}

function normalizeLegacyTemplate(seed: LegacyProjectTemplateSeed): ProjectTemplate {
  const result = normalizeLegacyProjectTemplateSeed({
    templateId: seed.id,
    templateVersion: buildTemplateVersion(seed.updatedAt),
    stages: seed.stages,
  })

  return normalizeStructuredTemplate({
    id: seed.id,
    name: seed.name,
    styleType: [...seed.styleType],
    creator: seed.creator,
    createdAt: seed.createdAt,
    updatedAt: seed.updatedAt,
    status: seed.status,
    description: seed.description,
    stages: result.stages,
    nodes: result.nodes,
    pendingNodes: result.pendingNodes,
  })
}

function buildTemplateStageId(templateId: string, phaseCode: string): string {
  return `${templateId}-${phaseCode}`
}

function buildTemplateNodeId(templateId: string, phaseCode: string, sequenceNo: number): string {
  return `${templateId}-${phaseCode}-NODE-${String(sequenceNo).padStart(2, '0')}`
}

function normalizeTemplateStagesForSave(
  templateId: string,
  stages: ProjectTemplateStageDefinition[],
): ProjectTemplateStageDefinition[] {
  return stages
    .map((stage) => {
      const phase = getProjectPhaseDefinitionByCode(stage.phaseCode)
      if (!phase) {
        throw new Error(`模板阶段缺少正式阶段定义：${stage.phaseCode}`)
      }
      return {
        templateStageId: stage.templateStageId || buildTemplateStageId(templateId, phase.phaseCode),
        templateId,
        phaseCode: phase.phaseCode,
        phaseName: phase.phaseName,
        phaseOrder: phase.phaseOrder,
        requiredFlag: stage.requiredFlag !== false,
        description: stage.description?.trim() || phase.description,
      }
    })
    .sort((a, b) => a.phaseOrder - b.phaseOrder)
}

function normalizeTemplateNodesForSave(
  templateId: string,
  templateVersion: string,
  stages: ProjectTemplateStageDefinition[],
  nodes: ProjectTemplateNodeDefinition[],
): ProjectTemplateNodeDefinition[] {
  const stageIds = new Map(stages.map((stage) => [stage.templateStageId, stage]))
  return nodes
    .map((node, index) => {
      const stage =
        stageIds.get(node.templateStageId) ??
        stages.find((item) => item.phaseCode === node.phaseCode)
      if (!stage) {
        throw new Error(`模板节点缺少所属阶段：${node.templateNodeId || index}`)
      }

      const workItem = getPcsWorkItemDefinition(node.workItemId)
      if (!workItem) {
        throw new Error(`模板节点引用了不存在的标准工作项：${node.workItemId}`)
      }

      return {
        templateNodeId: node.templateNodeId || buildTemplateNodeId(templateId, stage.phaseCode, node.sequenceNo),
        templateId,
        templateStageId: stage.templateStageId,
        phaseCode: stage.phaseCode,
        phaseName: stage.phaseName,
        workItemId: workItem.workItemId,
        workItemTypeCode: workItem.workItemTypeCode,
        workItemTypeName: workItem.workItemTypeName,
        sequenceNo: node.sequenceNo,
        requiredFlag: node.requiredFlag !== false,
        multiInstanceFlag: workItem.capabilities.canMultiInstance ? node.multiInstanceFlag : false,
        roleOverrideCodes: [...node.roleOverrideCodes],
        roleOverrideNames: [...node.roleOverrideNames],
        note: node.note.trim(),
        sourceWorkItemUpdatedAt: workItem.updatedAt,
        templateVersion,
        legacyStageName: node.legacyStageName,
        legacyWorkItemName: node.legacyWorkItemName,
      }
    })
    .sort((a, b) => {
      if (a.phaseCode === b.phaseCode) return a.sequenceNo - b.sequenceNo
      return a.phaseCode.localeCompare(b.phaseCode)
    })
}

export function listProjectTemplates(): ProjectTemplate[] {
  return templateStore.map(cloneTemplate)
}

export function getProjectTemplateById(templateId: string): ProjectTemplate | null {
  const found = templateStore.find((item) => item.id === templateId)
  return found ? cloneTemplate(found) : null
}

export function countTemplateStages(template: ProjectTemplate): number {
  return template.stages.length
}

export function countTemplateWorkItems(template: ProjectTemplate): number {
  return template.nodes.length
}

export function countTemplateReferencedWorkItems(template: ProjectTemplate): number {
  return new Set(template.nodes.map((item) => item.workItemId)).size
}

export function countTemplatePendingNodes(template: ProjectTemplate): number {
  return template.pendingNodes.length
}

export function hasTemplatePendingNodes(template: ProjectTemplate): boolean {
  return template.pendingNodes.length > 0
}

export function createProjectTemplate(input: {
  name: string
  styleType: TemplateStyleType[]
  description: string
  status?: TemplateStatusCode
  stages: ProjectTemplateStageDefinition[]
  nodes: ProjectTemplateNodeDefinition[]
  pendingNodes?: ProjectTemplatePendingNode[]
  creator?: string
}): ProjectTemplate {
  const id = nextTemplateId()
  const now = nowText()
  const templateVersion = buildTemplateVersion(now)
  const stages = normalizeTemplateStagesForSave(id, input.stages)
  const nodes = normalizeTemplateNodesForSave(id, templateVersion, stages, input.nodes)

  const created: ProjectTemplate = {
    id,
    name: input.name.trim(),
    styleType: [...input.styleType],
    creator: input.creator?.trim() || '当前用户',
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'active',
    description: input.description.trim() || '商品项目模板说明待补充。',
    stages,
    nodes,
    pendingNodes: (input.pendingNodes ?? []).map((item) => ({ ...item, templateId: id, templateVersion })),
  }

  const normalized = normalizeStructuredTemplate(created)
  templateStore = [normalized, ...templateStore]
  return cloneTemplate(normalized)
}

export function updateProjectTemplate(
  templateId: string,
  input: {
    name: string
    styleType: TemplateStyleType[]
    description: string
    status?: TemplateStatusCode
    stages: ProjectTemplateStageDefinition[]
    nodes: ProjectTemplateNodeDefinition[]
    pendingNodes?: ProjectTemplatePendingNode[]
  },
): ProjectTemplate | null {
  const existing = templateStore.find((item) => item.id === templateId)
  if (!existing) return null

  const updatedAt = nowText()
  const templateVersion = buildTemplateVersion(updatedAt)
  const stages = normalizeTemplateStagesForSave(templateId, input.stages)
  const nodes = normalizeTemplateNodesForSave(templateId, templateVersion, stages, input.nodes)

  const updated: ProjectTemplate = normalizeStructuredTemplate({
    ...existing,
    name: input.name.trim(),
    styleType: [...input.styleType],
    description: input.description.trim(),
    status: input.status ?? existing.status,
    updatedAt,
    stages,
    nodes,
    pendingNodes: (input.pendingNodes ?? []).map((item) => ({
      ...item,
      templateId,
      templateVersion,
    })),
  })

  templateStore = templateStore.map((item) => (item.id === templateId ? updated : item))
  return cloneTemplate(updated)
}

export function toggleProjectTemplateStatus(templateId: string): ProjectTemplate | null {
  const current = templateStore.find((item) => item.id === templateId)
  if (!current) return null
  const updated: ProjectTemplate = {
    ...current,
    status: current.status === 'active' ? 'inactive' : 'active',
    updatedAt: nowText(),
  }
  templateStore = templateStore.map((item) => (item.id === templateId ? updated : item))
  return cloneTemplate(updated)
}

export function copyProjectTemplate(templateId: string): ProjectTemplate | null {
  const source = getProjectTemplateById(templateId)
  if (!source) return null

  const duplicatedStages = source.stages.map((item) => ({ ...item, templateStageId: '' }))
  const duplicatedNodes = source.nodes.map((item) => ({
    ...item,
    templateNodeId: '',
    templateId: '',
    templateStageId: '',
  }))

  const copied = createProjectTemplate({
    name: `${source.name}-副本`,
    styleType: [...source.styleType],
    description: source.description,
    status: 'inactive',
    stages: duplicatedStages,
    nodes: duplicatedNodes,
    pendingNodes: source.pendingNodes.map((item) => ({ ...item })),
    creator: '当前用户',
  })

  return copied
}

export function getStatusLabel(status: TemplateStatusCode): string {
  return status === 'active' ? '启用' : '停用'
}

export function getProjectTemplateVersion(template: ProjectTemplate): string {
  return template.updatedAt
}

export function getTemplateStageDisplayName(name: string): string {
  return name.trim()
}

export function listTemplatePhaseOptions(): Array<{ value: string; label: string }> {
  return listProjectPhaseDefinitions().map((item) => ({
    value: item.phaseCode,
    label: `${item.phaseOrder}. ${item.phaseName}`,
  }))
}
