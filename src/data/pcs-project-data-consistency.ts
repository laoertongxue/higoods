import {
  getProjectStoreSnapshot,
  getProjectById,
  getProjectNodeRecordById,
  replaceProjectStore,
  listProjectNodes,
  listProjects,
  type PcsProjectNodeRecord,
  type PcsProjectViewRecord,
} from './pcs-project-repository.ts'
import {
  getProjectStepDefinition,
  listProjectFlowStageContracts,
  type ProjectStepCode,
} from './pcs-project-domain-contract.ts'
import {
  getLatestProjectInlineNodeRecord,
} from './pcs-project-inline-node-record-repository.ts'
import {
  PCS_PROJECT_INLINE_STEP_RECORD_CODES,
  type PcsProjectInlineNodeRecord,
} from './pcs-project-inline-node-record-types.ts'
import {
  getProjectNodeInstanceModel,
  type PcsProjectInstanceItem,
} from './pcs-project-instance-model.ts'
import {
  getProjectRelationStoreSnapshot,
  listProjectRelationsByProject,
  replaceProjectRelationStore,
} from './pcs-project-relation-repository.ts'
import type { ProjectRelationRecord } from './pcs-project-relation-types.ts'
import { listProjectChannelProductsByProjectId } from './pcs-channel-product-project-repository.ts'
import { getStyleArchiveById } from './pcs-style-archive-repository.ts'
import { getTechnicalDataVersionById } from './pcs-technical-data-version-repository.ts'
import { getProjectArchiveById } from './pcs-project-archive-repository.ts'

const INLINE_NODE_CODE_SET = new Set<string>(PCS_PROJECT_INLINE_STEP_RECORD_CODES as readonly string[])

export type PcsProjectDataConsistencyIssueType =
  | '项目节点与模板定义不一致'
  | '项目节点与固定五步定义不一致'
  | '项目关系缺少对应节点'
  | '项目关系节点类型不一致'
  | '模块记录缺少对应节点'
  | '模块记录节点类型不一致'
  | '项目主关联对象缺失'
  | '已完成节点缺少正式记录'
  | '已完成节点缺少字段'
  | '已完成节点对应实例未完成'
  | '已完成实例未回写项目节点'

export interface PcsProjectDataConsistencyIssue {
  issueType: PcsProjectDataConsistencyIssueType
  projectId: string
  projectCode: string
  projectName: string
  projectNodeId: string
  stepCode: string
  moduleName: string
  sourceObjectId: string
  sourceObjectCode: string
  message: string
  missingFieldLabels: string[]
}

export interface ProjectNodeCompletionValidationResult {
  ok: boolean
  project: PcsProjectViewRecord | null
  node: PcsProjectNodeRecord | null
  message: string
  missingFieldLabels: string[]
}

export interface PcsProjectDataConsistencyReport {
  projectCount: number
  nodeCount: number
  issueCount: number
  issues: PcsProjectDataConsistencyIssue[]
}

export interface PcsProjectDataConsistencyRepairResult {
  relationRepairCount: number
  nodeRepairCount: number
  report: PcsProjectDataConsistencyReport
}

function hasValue(value: unknown): boolean {
  if (value == null) return false
  if (Array.isArray(value)) return value.some((item) => hasValue(item))
  if (typeof value === 'number') return Number.isFinite(value)
  if (typeof value === 'boolean') return true
  return String(value).trim() !== ''
}

function buildIssue(
  issueType: PcsProjectDataConsistencyIssueType,
  project: PcsProjectViewRecord,
  node: PcsProjectNodeRecord | null,
  moduleName: string,
  sourceObjectId: string,
  sourceObjectCode: string,
  message: string,
  missingFieldLabels: string[] = [],
): PcsProjectDataConsistencyIssue {
  return {
    issueType,
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    projectNodeId: node?.projectNodeId || '',
    stepCode: node?.stepCode || '',
    moduleName,
    sourceObjectId,
    sourceObjectCode,
    message,
    missingFieldLabels,
  }
}

function getRequiredEditableFields(stepCode: string) {
  return getProjectStepDefinition(stepCode as ProjectStepCode).fieldDefinitions.filter(
    (field) => field.required && !field.readonly,
  )
}

function getMissingLabelsFromMap(stepCode: string, values: Record<string, unknown>): string[] {
  return getRequiredEditableFields(stepCode)
    .filter((field) => !hasValue(values[field.fieldKey]))
    .map((field) => field.label)
}

function buildInlineRecordValueMap(record: PcsProjectInlineNodeRecord | null): Record<string, unknown> {
  if (!record) return {}
  return {
    ...(record.payload || {}),
    ...(record.detailSnapshot || {}),
  }
}

function buildInstanceFieldMap(instance: PcsProjectInstanceItem | null): Record<string, unknown> {
  if (!instance) return {}
  return instance.fields.reduce<Record<string, unknown>>((result, field) => {
    if (field.fieldKey) result[field.fieldKey] = field.value
    return result
  }, {})
}

function pickPrimaryNodeInstance(projectId: string, projectNodeId: string, stepCode: string): PcsProjectInstanceItem | null {
  const nodeModel = getProjectNodeInstanceModel(projectId, projectNodeId)
  if (!nodeModel) return null

  const contract = getProjectStepDefinition(stepCode as ProjectStepCode)
  const definition = contract.multiInstanceDefinition
  let candidates = [...nodeModel.instances]

  if (definition?.primarySourceKinds?.length) {
    candidates = candidates.filter((item) => definition.primarySourceKinds.includes(item.sourceKind))
  }
  if (definition?.primaryRelationObjectTypes?.length) {
    candidates = candidates.filter(
      (item) =>
        item.sourceKind !== 'RELATION_OBJECT' || definition.primaryRelationObjectTypes.includes(item.objectType),
    )
  }

  return candidates[0] || nodeModel.latestInstance || null
}

function validateChannelListingNode(project: PcsProjectViewRecord, node: PcsProjectNodeRecord): ProjectNodeCompletionValidationResult {
  const activeRecords = listProjectChannelProductsByProjectId(project.projectId).filter(
    (item) => item.projectNodeId === node.projectNodeId && item.channelProductStatus !== '已作废',
  )
  if (activeRecords.length === 0) {
    return {
      ok: false,
      project,
      node,
      message: '当前节点缺少正式款式上架批次。',
      missingFieldLabels: ['款式上架批次'],
    }
  }

  const latestRecord = [...activeRecords].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
  const missingFieldLabels: string[] = []
  const effectiveRecords = activeRecords.filter(
    (item) =>
      item.listingBatchStatus === '已上传待确认' ||
      item.listingBatchStatus === '已完成' ||
      item.channelProductStatus === '已上架待测款' ||
      item.channelProductStatus === '已生效',
  )

  if (effectiveRecords.length === 0) missingFieldLabels.push('已上架商品')
  if (!latestRecord.upstreamProductId) missingFieldLabels.push('上游款式商品编号')
  if (!latestRecord.specLines.length) missingFieldLabels.push('规格明细')
  if (latestRecord.specLines.some((item) => !item.productImageId)) missingFieldLabels.push('商品图片')
  if (latestRecord.specLines.some((item) => !item.upstreamSkuId)) missingFieldLabels.push('上游规格编号')
  if (
    latestRecord.listingBatchStatus !== '已完成' &&
    latestRecord.channelProductStatus !== '已上架待测款' &&
    latestRecord.channelProductStatus !== '已生效'
  ) {
    missingFieldLabels.push('商品上架完成状态')
  }

  return {
    ok: missingFieldLabels.length === 0,
    project,
    node,
    message:
      missingFieldLabels.length === 0
        ? '商品上架节点已完成且规格上传完整。'
        : `当前节点仍缺少字段：${missingFieldLabels.join('、')}。`,
    missingFieldLabels,
  }
}

export function validateProjectNodeCompletion(
  projectId: string,
  projectNodeId: string,
): ProjectNodeCompletionValidationResult {
  const project = getProjectById(projectId)
  const node = getProjectNodeRecordById(projectId, projectNodeId)
  if (!project || !node) {
    return {
      ok: false,
      project,
      node,
      message: '未找到对应商品项目或项目节点。',
      missingFieldLabels: [],
    }
  }

  if (node.stepCode === 'PROJECT_INIT') {
    const missingFieldLabels = getMissingLabelsFromMap(node.stepCode, project as unknown as Record<string, unknown>)
    return {
      ok: missingFieldLabels.length === 0,
      project,
      node,
      message:
        missingFieldLabels.length === 0
          ? '商品项目立项数据完整。'
          : `当前节点仍缺少字段：${missingFieldLabels.join('、')}。`,
      missingFieldLabels,
    }
  }

  if (INLINE_NODE_CODE_SET.has(node.stepCode)) {
    const latestRecord = getLatestProjectInlineNodeRecord(projectNodeId)
    if (!latestRecord) {
      return {
        ok: false,
        project,
        node,
        message: '当前节点缺少项目内正式记录。',
        missingFieldLabels: ['正式记录'],
      }
    }
    const missingFieldLabels = getMissingLabelsFromMap(node.stepCode, buildInlineRecordValueMap(latestRecord))
    return {
      ok: missingFieldLabels.length === 0,
      project,
      node,
      message:
        missingFieldLabels.length === 0
          ? '当前节点项目内正式记录完整。'
          : `当前节点仍缺少字段：${missingFieldLabels.join('、')}。`,
      missingFieldLabels,
    }
  }

  if (node.stepCode === 'CHANNEL_PRODUCT_LISTING') {
    return validateChannelListingNode(project, node)
  }

  const instance = pickPrimaryNodeInstance(projectId, projectNodeId, node.stepCode)
  if (!instance) {
    return {
      ok: false,
      project,
      node,
      message: '当前节点缺少正式业务对象。',
      missingFieldLabels: ['正式业务对象'],
    }
  }

  const missingFieldLabels = getMissingLabelsFromMap(node.stepCode, buildInstanceFieldMap(instance))
  return {
    ok: missingFieldLabels.length === 0,
    project,
    node,
    message:
      missingFieldLabels.length === 0
        ? '当前节点正式业务对象字段完整。'
        : `当前节点仍缺少字段：${missingFieldLabels.join('、')}。`,
    missingFieldLabels,
  }
}

function pushRecordBindingIssue(
  issues: PcsProjectDataConsistencyIssue[],
  input: {
    project: PcsProjectViewRecord
    moduleName: string
    sourceObjectId: string
    sourceObjectCode: string
    projectNodeId: string
    expectedStepCode: string
  },
): void {
  if (!input.projectNodeId || !input.expectedStepCode) return
  const node = input.projectNodeId ? getProjectNodeRecordById(input.project.projectId, input.projectNodeId) : null
  if (!node) {
    issues.push(
      buildIssue(
        '模块记录缺少对应节点',
        input.project,
        null,
        input.moduleName,
        input.sourceObjectId,
        input.sourceObjectCode,
        `${input.moduleName}记录未找到对应商品项目节点。`,
      ),
    )
    return
  }

  if (node.stepCode !== input.expectedStepCode) {
    issues.push(
      buildIssue(
        '模块记录节点类型不一致',
        input.project,
        node,
        input.moduleName,
        input.sourceObjectId,
        input.sourceObjectCode,
        `${input.moduleName}记录绑定的节点类型为 ${node.stepCode}，应为 ${input.expectedStepCode}。`,
      ),
    )
  }
}

function pushRelationIssues(project: PcsProjectViewRecord, issues: PcsProjectDataConsistencyIssue[]): void {
  const fixedStepCodes = new Set(listProjectFlowStageContracts().flatMap((step) => step.stepCodes))
  listProjectRelationsByProject(project.projectId).forEach((relation: ProjectRelationRecord) => {
    if (!fixedStepCodes.has(relation.stepCode as ProjectStepCode)) return
    const node = relation.projectNodeId ? getProjectNodeRecordById(project.projectId, relation.projectNodeId) : null
    if (!node) {
      issues.push(
        buildIssue(
          '项目关系缺少对应节点',
          project,
          null,
          relation.sourceModule,
          relation.sourceObjectId,
          relation.sourceObjectCode,
          `${relation.sourceModule}关系记录未找到对应商品项目节点。`,
        ),
      )
      return
    }

    if (node.stepCode !== relation.stepCode) {
      issues.push(
        buildIssue(
          '项目关系节点类型不一致',
          project,
          node,
          relation.sourceModule,
          relation.sourceObjectId,
          relation.sourceObjectCode,
          `${relation.sourceModule}关系记录的 stepCode 为 ${relation.stepCode}，但节点实际类型为 ${node.stepCode}。`,
        ),
      )
    }
  })
}

function pushProjectLinkIssues(project: PcsProjectViewRecord, issues: PcsProjectDataConsistencyIssue[]): void {
  if (project.linkedStyleId && !getStyleArchiveById(project.linkedStyleId)) {
    issues.push(
      buildIssue(
        '项目主关联对象缺失',
        project,
        null,
        '款式档案',
        project.linkedStyleId,
        project.linkedStyleCode || '',
        '项目主记录已挂款式档案，但正式款式档案不存在。',
      ),
    )
  }

  if (project.linkedTechPackVersionId && !getTechnicalDataVersionById(project.linkedTechPackVersionId)) {
    issues.push(
      buildIssue(
        '项目主关联对象缺失',
        project,
        null,
        '技术包',
        project.linkedTechPackVersionId,
        project.linkedTechPackVersionCode || '',
        '项目主记录已挂技术包版本，但正式技术包版本不存在。',
      ),
    )
  }

  if (project.projectArchiveId && !getProjectArchiveById(project.projectArchiveId)) {
    issues.push(
      buildIssue(
        '项目主关联对象缺失',
        project,
        null,
        '项目资料归档',
        project.projectArchiveId,
        project.projectArchiveNo || '',
        '项目主记录已挂项目资料归档，但正式归档对象不存在。',
      ),
    )
  }
}

function pushModuleRecordIssues(project: PcsProjectViewRecord, issues: PcsProjectDataConsistencyIssue[]): void {
  listProjectChannelProductsByProjectId(project.projectId).forEach((record) => {
    pushRecordBindingIssue(issues, {
      project,
      moduleName: '渠道店铺商品',
      sourceObjectId: record.channelProductId,
      sourceObjectCode: record.channelProductCode,
      projectNodeId: record.projectNodeId,
      expectedStepCode: 'CHANNEL_PRODUCT_LISTING',
    })
  })

}

function pushCompletedNodeIssues(project: PcsProjectViewRecord, issues: PcsProjectDataConsistencyIssue[]): void {
  listProjectNodes(project.projectId)
    .filter((node) => node.currentStatus === '已完成')
    .forEach((node) => {
      const validation = validateProjectNodeCompletion(project.projectId, node.projectNodeId)
      if (validation.ok) return

      const issueType =
        validation.missingFieldLabels[0] === '正式记录' || validation.missingFieldLabels[0] === '正式业务对象'
          ? '已完成节点缺少正式记录'
          : validation.missingFieldLabels[0] === '实例完成'
            ? '已完成节点对应实例未完成'
            : '已完成节点缺少字段'

      issues.push(
        buildIssue(
          issueType,
          project,
          node,
          node.stepName,
          node.latestInstanceId,
          node.latestInstanceCode,
          validation.message,
          validation.missingFieldLabels,
        ),
      )
    })
}

function pushFixedStepAlignmentIssues(project: PcsProjectViewRecord, issues: PcsProjectDataConsistencyIssue[]): void {
  const templateCodes = listProjectFlowStageContracts().flatMap((step) => step.stepCodes)
  const projectNodes = listProjectNodes(project.projectId)
  const projectCodes = projectNodes.map((node) => node.stepCode)

  if (templateCodes.join('|') === projectCodes.join('|')) return

  issues.push(
    buildIssue(
      '项目节点与固定五步定义不一致',
      project,
      projectNodes[0] || null,
      '项目节点',
      project.projectId,
      project.projectCode,
      `当前项目节点与固定五步定义不一致。固定节点：${templateCodes.join('、')}；项目节点：${projectCodes.join('、')}。`,
    ),
  )
}

export function auditPcsProjectDataConsistency(): PcsProjectDataConsistencyReport {
  const issues: PcsProjectDataConsistencyIssue[] = []
  const projects = listProjects()

  projects.forEach((project) => {
    pushFixedStepAlignmentIssues(project, issues)
    pushProjectLinkIssues(project, issues)
    pushRelationIssues(project, issues)
    pushModuleRecordIssues(project, issues)
    pushCompletedNodeIssues(project, issues)
  })

  return {
    projectCount: projects.length,
    nodeCount: projects.reduce((total, project) => total + listProjectNodes(project.projectId).length, 0),
    issueCount: issues.length,
    issues,
  }
}

export function repairPcsProjectDataConsistency(
  operatorName = '系统修复',
): PcsProjectDataConsistencyRepairResult {
  const relationSnapshot = getProjectRelationStoreSnapshot()
  const projectLevelSourceModules = new Set([
    '款式档案',
    '技术包',
    '项目资料归档',
    '设计改款任务',
    '制版任务',
    '花型任务',
    '首版样衣打样',
    '首单样衣打样',
  ])
  let projectLevelRelationRepairCount = 0
  const fixedStepRelations = relationSnapshot.relations.map((relation) => {
    if (!projectLevelSourceModules.has(relation.sourceModule)) return relation
    if (!relation.projectNodeId && !relation.stepCode && !relation.stepName) return relation
    projectLevelRelationRepairCount += 1
    const {
      projectNodeId: _projectNodeId,
      stepCode: _stepCode,
      stepName: _stepName,
      ...projectLevelRelation
    } = relation
    return {
      ...projectLevelRelation,
      updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      updatedBy: operatorName,
    }
  })
  replaceProjectRelationStore({
    ...relationSnapshot,
    relations: fixedStepRelations,
  })

  const projectSnapshot = getProjectStoreSnapshot()
  let nodeRepairCount = 0

  const repairedNodes = projectSnapshot.nodes.map((node) => {
    if (node.currentStatus !== '已完成') return node
    const validation = validateProjectNodeCompletion(node.projectId, node.projectNodeId)
    if (validation.ok) return node

    nodeRepairCount += 1
    const missingText =
      validation.missingFieldLabels.length > 0 ? validation.missingFieldLabels.join('、') : '正式数据'

    return {
      ...node,
      currentStatus: '进行中',
      latestResultType: '待补齐正式数据',
      latestResultText: `${node.stepName}当前仍缺少正式数据，已回退为进行中。`,
      currentIssueType: '数据待补齐',
      currentIssueText: `缺少：${missingText}`,
      pendingActionType: '补齐正式数据',
      pendingActionText: `请补齐${missingText}后再完成当前节点。`,
      updatedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
      lastEventType: '一致性修复',
      lastEventTime: new Date().toISOString().slice(0, 16).replace('T', ' '),
    }
  })

  replaceProjectStore({
    ...projectSnapshot,
    nodes: repairedNodes,
  })

  return {
    relationRepairCount: projectLevelRelationRepairCount,
    nodeRepairCount,
    report: auditPcsProjectDataConsistency(),
  }
}

export function formatPcsProjectDataConsistencyReport(report: PcsProjectDataConsistencyReport): string {
  if (report.issueCount === 0) {
    return `商品项目一致性检查通过：共核对 ${report.projectCount} 个项目，${report.nodeCount} 个节点，未发现问题。`
  }

  const lines = [
    `商品项目一致性检查发现 ${report.issueCount} 条问题：`,
    ...report.issues.map((issue, index) => {
      const nodeLabel = issue.stepCode ? ` / 节点 ${issue.stepCode}` : ''
      const objectLabel = issue.sourceObjectCode ? ` / 对象 ${issue.sourceObjectCode}` : ''
      const missingLabel =
        issue.missingFieldLabels.length > 0 ? ` / 缺失：${issue.missingFieldLabels.join('、')}` : ''
      return `${index + 1}. ${issue.issueType} / ${issue.projectCode}${nodeLabel}${objectLabel} / ${issue.message}${missingLabel}`
    }),
  ]

  return lines.join('\n')
}
