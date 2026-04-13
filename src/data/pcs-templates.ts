import { getProjectPhaseDefinitionByCode, listProjectPhaseDefinitions } from './pcs-project-phase-definitions.ts'
import type {
  ProjectTemplateNodeDefinition,
  ProjectTemplatePendingNode,
  ProjectTemplateStageDefinition,
} from './pcs-project-definition-normalizer.ts'
import { getPcsWorkItemDefinition } from './pcs-work-items.ts'
import {
  buildBuiltinProjectTemplateMatrix,
  getProjectTemplateSchema,
  listProjectTemplateSchemas,
  type PcsProjectTemplateStyleType,
} from './pcs-project-domain-contract.ts'
import { validateTemplateBusinessIntegrity } from './pcs-template-domain-view-model.ts'

export type TemplateStatusCode = 'active' | 'inactive'
export type TemplateStyleType = PcsProjectTemplateStyleType

export interface ProjectTemplate {
  id: string
  name: string
  styleType: TemplateStyleType[]
  creator: string
  createdAt: string
  updatedAt: string
  status: TemplateStatusCode
  description: string
  scenario: string
  stages: ProjectTemplateStageDefinition[]
  nodes: ProjectTemplateNodeDefinition[]
  pendingNodes: ProjectTemplatePendingNode[]
}

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

function buildContractTemplateStore(): ProjectTemplate[] {
  return buildBuiltinProjectTemplateMatrix().map((item) => ({
    id: item.templateId,
    name: item.templateName,
    styleType: [...item.styleTypes],
    creator: item.creator,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    status: item.status,
    description: item.description,
    scenario: item.scenario,
    stages: item.stages.map((stage) => ({
      templateStageId: stage.templateStageId,
      templateId: item.templateId,
      phaseCode: stage.phaseCode,
      phaseName: stage.phaseName,
      phaseOrder: stage.phaseOrder,
      requiredFlag: stage.requiredFlag,
      description: stage.description,
    })),
    nodes: item.nodes.map((node) => ({
      templateNodeId: node.templateNodeId,
      templateId: item.templateId,
      templateStageId: node.templateStageId,
      phaseCode: node.phaseCode,
      phaseName: node.phaseName,
      workItemId: node.workItemId,
      workItemTypeCode: node.workItemTypeCode,
      workItemTypeName: node.workItemTypeName,
      sequenceNo: node.sequenceNo,
      enabledFlag: true,
      requiredFlag: node.requiredFlag,
      multiInstanceFlag: node.multiInstanceFlag,
      roleOverrideCodes: [],
      roleOverrideNames: [],
      note: node.note,
      sourceWorkItemUpdatedAt: node.sourceWorkItemUpdatedAt,
      templateVersion: item.updatedAt,
    })),
    pendingNodes: [],
  }))
}

let templateStore: ProjectTemplate[] = buildContractTemplateStore()

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
        enabledFlag: node.enabledFlag !== false,
        multiInstanceFlag: workItem?.capabilities.canMultiInstance === false ? false : node.multiInstanceFlag,
      }
    })

  return {
    ...template,
    stages: orderedStages,
    nodes: orderedNodes,
    pendingNodes: template.pendingNodes.map(clonePendingNode),
  }
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
      const stage = stageIds.get(node.templateStageId) ?? stages.find((item) => item.phaseCode === node.phaseCode)
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
        enabledFlag: node.enabledFlag !== false,
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

function getSchemaByStyleType(styleType: TemplateStyleType): ReturnType<typeof getProjectTemplateSchema> {
  const schema = listProjectTemplateSchemas().find((item) => item.styleTypes.includes(styleType))
  if (!schema) {
    throw new Error(`未找到适用款式类型的正式模板矩阵：${styleType}`)
  }
  return getProjectTemplateSchema(schema.templateId)
}

function assertTemplateMatchesSchema(
  styleType: TemplateStyleType,
  stages: ProjectTemplateStageDefinition[],
  nodes: ProjectTemplateNodeDefinition[],
): void {
  const issues = validateTemplateBusinessIntegrity({ styleType, stages, nodes })
  if (issues.length > 0) {
    throw new Error(issues[0].message)
  }
}

function listActiveNodes(template: ProjectTemplate): ProjectTemplateNodeDefinition[] {
  return template.nodes.filter((node) => node.enabledFlag !== false)
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
  return listActiveNodes(template).length
}

export function countTemplateReferencedWorkItems(template: ProjectTemplate): number {
  return new Set(listActiveNodes(template).map((item) => item.workItemId)).size
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
  const styleType = input.styleType[0]
  if (!styleType) {
    throw new Error('请选择适用款式类型。')
  }

  const id = nextTemplateId()
  const now = nowText()
  const templateVersion = buildTemplateVersion(now)
  const stages = normalizeTemplateStagesForSave(id, input.stages)
  const nodes = normalizeTemplateNodesForSave(id, templateVersion, stages, input.nodes)
  assertTemplateMatchesSchema(styleType, stages, nodes)

  const created: ProjectTemplate = {
    id,
    name: input.name.trim(),
    styleType: [styleType],
    creator: input.creator?.trim() || '当前用户',
    createdAt: now,
    updatedAt: now,
    status: input.status ?? 'active',
    description: input.description.trim() || '商品项目模板说明待补充。',
    scenario: getSchemaByStyleType(styleType).scenario,
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

  const styleType = input.styleType[0]
  if (!styleType) {
    throw new Error('请选择适用款式类型。')
  }

  const updatedAt = nowText()
  const templateVersion = buildTemplateVersion(updatedAt)
  const stages = normalizeTemplateStagesForSave(templateId, input.stages)
  const nodes = normalizeTemplateNodesForSave(templateId, templateVersion, stages, input.nodes)
  assertTemplateMatchesSchema(styleType, stages, nodes)

  const updated: ProjectTemplate = normalizeStructuredTemplate({
    ...existing,
    name: input.name.trim(),
    styleType: [styleType],
    description: input.description.trim(),
    scenario: getSchemaByStyleType(styleType).scenario,
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

  return createProjectTemplate({
    name: `${source.name}-副本`,
    styleType: [...source.styleType],
    description: source.description,
    status: 'inactive',
    stages: duplicatedStages,
    nodes: duplicatedNodes,
    pendingNodes: source.pendingNodes.map((item) => ({ ...item })),
    creator: '当前用户',
  })
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
