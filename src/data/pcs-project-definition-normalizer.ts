import { getProjectPhaseDefinitionByCode, resolveProjectPhaseCodeFromLegacyName } from './pcs-project-phase-definitions.ts'
import { getWorkItemTemplateConfig } from './pcs-work-item-configs.ts'
import { resolveLegacyProjectWorkItemIdentity } from './pcs-work-item-configs/mappings.ts'

export interface LegacyTemplateWorkItemSeed {
  id?: string
  name: string
  required?: boolean | '必做' | '可选'
  multiInstanceFlag?: boolean
  roles?: string[]
  note?: string
}

export interface LegacyTemplateStageSeed {
  id?: string
  name: string
  description?: string
  required?: boolean
  workItems: LegacyTemplateWorkItemSeed[]
}

export interface ProjectTemplateStageDefinition {
  templateStageId: string
  templateId: string
  phaseCode: string
  phaseName: string
  phaseOrder: number
  requiredFlag: boolean
  description: string
}

export interface ProjectTemplateNodeDefinition {
  templateNodeId: string
  templateId: string
  templateStageId: string
  phaseCode: string
  phaseName: string
  workItemId: string
  workItemTypeCode: string
  workItemTypeName: string
  sequenceNo: number
  requiredFlag: boolean
  multiInstanceFlag: boolean
  roleOverrideCodes: string[]
  roleOverrideNames: string[]
  note: string
  sourceWorkItemUpdatedAt: string
  templateVersion: string
  legacyStageName?: string
  legacyWorkItemName?: string
}

export interface ProjectTemplatePendingNode {
  pendingNodeId: string
  templateId: string
  templateStageId: string
  phaseCode: string | null
  phaseName: string
  legacyStageName: string
  legacyWorkItemName: string
  unresolvedReason: string
  templateVersion: string
}

export interface NormalizeLegacyTemplateResult {
  stages: ProjectTemplateStageDefinition[]
  nodes: ProjectTemplateNodeDefinition[]
  pendingNodes: ProjectTemplatePendingNode[]
}

function buildStageId(templateId: string, phaseCode: string): string {
  return `${templateId}-${phaseCode}`
}

function buildNodeId(templateId: string, phaseCode: string, sequenceNo: number): string {
  return `${templateId}-${phaseCode}-NODE-${String(sequenceNo).padStart(2, '0')}`
}

function normalizeRequiredFlag(value: boolean | '必做' | '可选' | undefined): boolean {
  if (value === '可选') return false
  if (value === '必做') return true
  return value !== false
}

function sanitizeRoleCodes(roleNames: string[]): string[] {
  return roleNames.map((item) => item.trim()).filter(Boolean)
}

export function normalizeLegacyProjectTemplateSeed(input: {
  templateId: string
  templateVersion: string
  stages: LegacyTemplateStageSeed[]
}): NormalizeLegacyTemplateResult {
  const stages: ProjectTemplateStageDefinition[] = []
  const nodes: ProjectTemplateNodeDefinition[] = []
  const pendingNodes: ProjectTemplatePendingNode[] = []

  input.stages.forEach((legacyStage) => {
    const phaseCode = resolveProjectPhaseCodeFromLegacyName(legacyStage.name)
    const phase = phaseCode ? getProjectPhaseDefinitionByCode(phaseCode) : null
    const templateStageId = buildStageId(input.templateId, phase?.phaseCode ?? `UNMAPPED-${legacyStage.name}`)

    if (!phase) {
      legacyStage.workItems.forEach((legacyWorkItem, index) => {
        pendingNodes.push({
          pendingNodeId: `${templateStageId}-PENDING-${String(index + 1).padStart(2, '0')}`,
          templateId: input.templateId,
          templateStageId,
          phaseCode: null,
          phaseName: '待补充阶段',
          legacyStageName: legacyStage.name,
          legacyWorkItemName: legacyWorkItem.name,
          unresolvedReason: '旧阶段名称未收录到正式阶段目录。',
          templateVersion: input.templateVersion,
        })
      })
      return
    }

    stages.push({
      templateStageId,
      templateId: input.templateId,
      phaseCode: phase.phaseCode,
      phaseName: phase.phaseName,
      phaseOrder: phase.phaseOrder,
      requiredFlag: legacyStage.required !== false,
      description: legacyStage.description?.trim() || phase.description,
    })

    legacyStage.workItems.forEach((legacyWorkItem, index) => {
      const identity = resolveLegacyProjectWorkItemIdentity(legacyWorkItem.name)
      if (!identity) {
        pendingNodes.push({
          pendingNodeId: `${templateStageId}-PENDING-${String(index + 1).padStart(2, '0')}`,
          templateId: input.templateId,
          templateStageId,
          phaseCode: phase.phaseCode,
          phaseName: phase.phaseName,
          legacyStageName: legacyStage.name,
          legacyWorkItemName: legacyWorkItem.name,
          unresolvedReason: '旧工作项名称未收录到正式映射表。',
          templateVersion: input.templateVersion,
        })
        return
      }

      const workItemDefinition = getWorkItemTemplateConfig(identity.workItemId)
      if (!workItemDefinition) {
        pendingNodes.push({
          pendingNodeId: `${templateStageId}-PENDING-${String(index + 1).padStart(2, '0')}`,
          templateId: input.templateId,
          templateStageId,
          phaseCode: phase.phaseCode,
          phaseName: phase.phaseName,
          legacyStageName: legacyStage.name,
          legacyWorkItemName: legacyWorkItem.name,
          unresolvedReason: '标准工作项定义不存在，无法生成模板节点。',
          templateVersion: input.templateVersion,
        })
        return
      }

      const multiInstanceFlag = workItemDefinition.capabilities.canMultiInstance
        ? legacyWorkItem.multiInstanceFlag !== false
        : false

      nodes.push({
        templateNodeId: buildNodeId(input.templateId, phase.phaseCode, index + 1),
        templateId: input.templateId,
        templateStageId,
        phaseCode: phase.phaseCode,
        phaseName: phase.phaseName,
        workItemId: workItemDefinition.workItemId,
        workItemTypeCode: workItemDefinition.workItemTypeCode,
        workItemTypeName: workItemDefinition.workItemTypeName,
        sequenceNo: index + 1,
        requiredFlag: normalizeRequiredFlag(legacyWorkItem.required),
        multiInstanceFlag,
        roleOverrideCodes: sanitizeRoleCodes(legacyWorkItem.roles ?? []),
        roleOverrideNames: sanitizeRoleCodes(legacyWorkItem.roles ?? []),
        note: legacyWorkItem.note?.trim() || '',
        sourceWorkItemUpdatedAt: workItemDefinition.updatedAt,
        templateVersion: input.templateVersion,
        legacyStageName: legacyStage.name,
        legacyWorkItemName: legacyWorkItem.name,
      })
    })
  })

  return {
    stages: stages.sort((a, b) => a.phaseOrder - b.phaseOrder),
    nodes: nodes.sort((a, b) => {
      if (a.phaseCode === b.phaseCode) return a.sequenceNo - b.sequenceNo
      return a.phaseCode.localeCompare(b.phaseCode)
    }),
    pendingNodes,
  }
}
