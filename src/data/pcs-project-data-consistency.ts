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
  getProjectWorkItemContract,
  type PcsProjectWorkItemCode,
} from './pcs-project-domain-contract.ts'
import {
  getLatestProjectInlineNodeRecord,
} from './pcs-project-inline-node-record-repository.ts'
import {
  PCS_PROJECT_INLINE_NODE_RECORD_WORK_ITEM_TYPES,
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
import {
  getPatternTaskCompletionMissingFields,
  getPlateTaskCompletionMissingFields,
  getRevisionTaskCompletionMissingFields,
} from './pcs-engineering-task-field-policy.ts'
import { getProjectTemplateById } from './pcs-templates.ts'
import {
  listRevisionTasksByProject,
  listRevisionTasksByProjectNode,
} from './pcs-revision-task-repository.ts'
import type { RevisionTaskRecord } from './pcs-revision-task-types.ts'
import {
  listPlateMakingTasksByProject,
  listPlateMakingTasksByProjectNode,
} from './pcs-plate-making-repository.ts'
import type { PlateMakingTaskRecord } from './pcs-plate-making-types.ts'
import {
  listPatternTasksByProject,
  listPatternTasksByProjectNode,
} from './pcs-pattern-task-repository.ts'
import type { PatternTaskRecord } from './pcs-pattern-task-types.ts'
import {
  listFirstSampleTasksByProject,
  listFirstSampleTasksByProjectNode,
} from './pcs-first-sample-repository.ts'
import type { FirstSampleTaskRecord } from './pcs-first-sample-types.ts'
import {
  listPreProductionSampleTasksByProject,
  listPreProductionSampleTasksByProjectNode,
} from './pcs-pre-production-sample-repository.ts'
import type { PreProductionSampleTaskRecord } from './pcs-pre-production-sample-types.ts'
import { listProjectChannelProductsByProjectId } from './pcs-channel-product-project-repository.ts'
import { findStyleArchiveByProjectId, getStyleArchiveById } from './pcs-style-archive-repository.ts'
import {
  getTechnicalDataVersionById,
  listTechnicalDataVersionsByProjectId,
} from './pcs-technical-data-version-repository.ts'
import { getProjectArchiveById, getProjectArchiveByProjectId } from './pcs-project-archive-repository.ts'
import { listSampleAssets } from './pcs-sample-asset-repository.ts'
import { listSampleLedgerEvents } from './pcs-sample-ledger-repository.ts'
import { syncExistingProjectEngineeringTaskNodes } from './pcs-task-project-relation-writeback.ts'

const INLINE_NODE_CODE_SET = new Set<string>(PCS_PROJECT_INLINE_NODE_RECORD_WORK_ITEM_TYPES as readonly string[])

type CompletedEngineeringTask =
  | RevisionTaskRecord
  | PlateMakingTaskRecord
  | PatternTaskRecord
  | FirstSampleTaskRecord
  | PreProductionSampleTaskRecord

export type PcsProjectDataConsistencyIssueType =
  | '项目节点与模板定义不一致'
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
  workItemTypeCode: string
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
    workItemTypeCode: node?.workItemTypeCode || '',
    moduleName,
    sourceObjectId,
    sourceObjectCode,
    message,
    missingFieldLabels,
  }
}

function getRequiredEditableFields(workItemTypeCode: string) {
  return getProjectWorkItemContract(workItemTypeCode as PcsProjectWorkItemCode).fieldDefinitions.filter(
    (field) => field.required && !field.readonly,
  )
}

function getMissingLabelsFromMap(workItemTypeCode: string, values: Record<string, unknown>): string[] {
  return getRequiredEditableFields(workItemTypeCode)
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

function pickLatestTask<T extends { updatedAt: string }>(tasks: T[]): T | null {
  return [...tasks].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0] || null
}

function pickPrimaryNodeInstance(projectId: string, projectNodeId: string, workItemTypeCode: string): PcsProjectInstanceItem | null {
  const nodeModel = getProjectNodeInstanceModel(projectId, projectNodeId)
  if (!nodeModel) return null

  const contract = getProjectWorkItemContract(workItemTypeCode as PcsProjectWorkItemCode)
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

function buildMissingTaskLabels(task: CompletedEngineeringTask, workItemTypeCode: string): string[] {
  if (workItemTypeCode === 'REVISION_TASK') {
    return getRevisionTaskCompletionMissingFields(task as RevisionTaskRecord)
  }
  if (workItemTypeCode === 'PATTERN_TASK') {
    return getPlateTaskCompletionMissingFields(task as PlateMakingTaskRecord)
  }
  if (workItemTypeCode === 'PATTERN_ARTWORK_TASK') {
    return getPatternTaskCompletionMissingFields(task as PatternTaskRecord)
  }
  return []
}

function getLatestTaskForNode(projectId: string, projectNodeId: string, workItemTypeCode: string): CompletedEngineeringTask | null {
  if (workItemTypeCode === 'REVISION_TASK') {
    return pickLatestTask(listRevisionTasksByProjectNode(projectId, projectNodeId))
  }
  if (workItemTypeCode === 'PATTERN_TASK') {
    return pickLatestTask(listPlateMakingTasksByProjectNode(projectId, projectNodeId))
  }
  if (workItemTypeCode === 'PATTERN_ARTWORK_TASK') {
    return pickLatestTask(listPatternTasksByProjectNode(projectId, projectNodeId))
  }
  if (workItemTypeCode === 'FIRST_SAMPLE') {
    return pickLatestTask(listFirstSampleTasksByProjectNode(projectId, projectNodeId))
  }
  if (workItemTypeCode === 'PRE_PRODUCTION_SAMPLE') {
    return pickLatestTask(listPreProductionSampleTasksByProjectNode(projectId, projectNodeId))
  }
  return null
}

function validateNodeByTask(project: PcsProjectViewRecord, node: PcsProjectNodeRecord): ProjectNodeCompletionValidationResult {
  const task = getLatestTaskForNode(project.projectId, node.projectNodeId, node.workItemTypeCode)
  if (!task) {
    return {
      ok: false,
      project,
      node,
      message: `当前节点缺少正式${node.workItemTypeName}实例。`,
      missingFieldLabels: ['正式实例'],
    }
  }

  if (task.status !== '已完成') {
    return {
      ok: false,
      project,
      node,
      message: `当前节点对应的${node.workItemTypeName}实例尚未完成。`,
      missingFieldLabels: ['实例完成'],
    }
  }

  const missingFieldLabels = buildMissingTaskLabels(task, node.workItemTypeCode)
  if (missingFieldLabels.length > 0) {
    return {
      ok: false,
      project,
      node,
      message: `当前节点对应的${node.workItemTypeName}实例仍缺少字段：${missingFieldLabels.join('、')}。`,
      missingFieldLabels,
    }
  }

  return {
    ok: true,
    project,
    node,
    message: '当前节点已完成且实例字段完整。',
    missingFieldLabels: [],
  }
}

function validateStyleArchiveNode(project: PcsProjectViewRecord, node: PcsProjectNodeRecord): ProjectNodeCompletionValidationResult {
  const style = project.linkedStyleId ? getStyleArchiveById(project.linkedStyleId) : null
  if (!style) {
    return {
      ok: false,
      project,
      node,
      message: '当前节点缺少正式款式档案主关联。',
      missingFieldLabels: ['款式档案'],
    }
  }

  return {
    ok: true,
    project,
    node,
    message: '款式档案生成节点数据完整。',
    missingFieldLabels: [],
  }
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

  if (node.workItemTypeCode === 'PROJECT_INIT') {
    const missingFieldLabels = getMissingLabelsFromMap(node.workItemTypeCode, project as unknown as Record<string, unknown>)
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

  if (INLINE_NODE_CODE_SET.has(node.workItemTypeCode)) {
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
    const missingFieldLabels = getMissingLabelsFromMap(node.workItemTypeCode, buildInlineRecordValueMap(latestRecord))
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

  if (
    node.workItemTypeCode === 'REVISION_TASK' ||
    node.workItemTypeCode === 'PATTERN_TASK' ||
    node.workItemTypeCode === 'PATTERN_ARTWORK_TASK' ||
    node.workItemTypeCode === 'FIRST_SAMPLE' ||
    node.workItemTypeCode === 'PRE_PRODUCTION_SAMPLE'
  ) {
    return validateNodeByTask(project, node)
  }

  if (node.workItemTypeCode === 'STYLE_ARCHIVE_CREATE') {
    return validateStyleArchiveNode(project, node)
  }

  if (node.workItemTypeCode === 'CHANNEL_PRODUCT_LISTING') {
    return validateChannelListingNode(project, node)
  }

  const instance = pickPrimaryNodeInstance(projectId, projectNodeId, node.workItemTypeCode)
  if (!instance) {
    return {
      ok: false,
      project,
      node,
      message: '当前节点缺少正式业务对象。',
      missingFieldLabels: ['正式业务对象'],
    }
  }

  const missingFieldLabels = getMissingLabelsFromMap(node.workItemTypeCode, buildInstanceFieldMap(instance))
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
    expectedWorkItemTypeCode: string
  },
): void {
  if (!input.projectNodeId || !input.expectedWorkItemTypeCode) return
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

  if (node.workItemTypeCode !== input.expectedWorkItemTypeCode) {
    issues.push(
      buildIssue(
        '模块记录节点类型不一致',
        input.project,
        node,
        input.moduleName,
        input.sourceObjectId,
        input.sourceObjectCode,
        `${input.moduleName}记录绑定的节点类型为 ${node.workItemTypeCode}，应为 ${input.expectedWorkItemTypeCode}。`,
      ),
    )
  }
}

function pushRelationIssues(project: PcsProjectViewRecord, issues: PcsProjectDataConsistencyIssue[]): void {
  listProjectRelationsByProject(project.projectId).forEach((relation: ProjectRelationRecord) => {
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

    if (node.workItemTypeCode !== relation.workItemTypeCode) {
      issues.push(
        buildIssue(
          '项目关系节点类型不一致',
          project,
          node,
          relation.sourceModule,
          relation.sourceObjectId,
          relation.sourceObjectCode,
          `${relation.sourceModule}关系记录的 workItemTypeCode 为 ${relation.workItemTypeCode}，但节点实际类型为 ${node.workItemTypeCode}。`,
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
      expectedWorkItemTypeCode: 'CHANNEL_PRODUCT_LISTING',
    })
  })

  listRevisionTasksByProject(project.projectId).forEach((task) => {
    pushRecordBindingIssue(issues, {
      project,
      moduleName: '改版任务',
      sourceObjectId: task.revisionTaskId,
      sourceObjectCode: task.revisionTaskCode,
      projectNodeId: task.projectNodeId,
      expectedWorkItemTypeCode: 'REVISION_TASK',
    })
    if (task.status === '已完成') {
      const node = getProjectNodeRecordById(project.projectId, task.projectNodeId)
      if (node && node.currentStatus !== '已完成') {
        issues.push(
          buildIssue(
            '已完成实例未回写项目节点',
            project,
            node,
            '改版任务',
            task.revisionTaskId,
            task.revisionTaskCode,
            '改版任务已完成，但项目节点未同步为已完成。',
          ),
        )
      }
    }
  })

  listPlateMakingTasksByProject(project.projectId).forEach((task) => {
    pushRecordBindingIssue(issues, {
      project,
      moduleName: '制版任务',
      sourceObjectId: task.plateTaskId,
      sourceObjectCode: task.plateTaskCode,
      projectNodeId: task.projectNodeId,
      expectedWorkItemTypeCode: 'PATTERN_TASK',
    })
    if (task.status === '已完成') {
      const node = getProjectNodeRecordById(project.projectId, task.projectNodeId)
      if (node && node.currentStatus !== '已完成') {
        issues.push(
          buildIssue(
            '已完成实例未回写项目节点',
            project,
            node,
            '制版任务',
            task.plateTaskId,
            task.plateTaskCode,
            '制版任务已完成，但项目节点未同步为已完成。',
          ),
        )
      }
    }
  })

  listPatternTasksByProject(project.projectId).forEach((task) => {
    pushRecordBindingIssue(issues, {
      project,
      moduleName: '花型任务',
      sourceObjectId: task.patternTaskId,
      sourceObjectCode: task.patternTaskCode,
      projectNodeId: task.projectNodeId,
      expectedWorkItemTypeCode: 'PATTERN_ARTWORK_TASK',
    })
    if (task.status === '已完成') {
      const node = getProjectNodeRecordById(project.projectId, task.projectNodeId)
      if (node && node.currentStatus !== '已完成') {
        issues.push(
          buildIssue(
            '已完成实例未回写项目节点',
            project,
            node,
            '花型任务',
            task.patternTaskId,
            task.patternTaskCode,
            '花型任务已完成，但项目节点未同步为已完成。',
          ),
        )
      }
    }
  })

  listFirstSampleTasksByProject(project.projectId).forEach((task) => {
    pushRecordBindingIssue(issues, {
      project,
      moduleName: '首版样衣打样',
      sourceObjectId: task.firstSampleTaskId,
      sourceObjectCode: task.firstSampleTaskCode,
      projectNodeId: task.projectNodeId,
      expectedWorkItemTypeCode: 'FIRST_SAMPLE',
    })
    if (task.status === '已完成') {
      const node = getProjectNodeRecordById(project.projectId, task.projectNodeId)
      if (node && node.currentStatus !== '已完成') {
        issues.push(
          buildIssue(
            '已完成实例未回写项目节点',
            project,
            node,
            '首版样衣打样',
            task.firstSampleTaskId,
            task.firstSampleTaskCode,
            '首版样衣打样任务已完成，但项目节点未同步为已完成。',
          ),
        )
      }
    }
  })

  listPreProductionSampleTasksByProject(project.projectId).forEach((task) => {
    pushRecordBindingIssue(issues, {
      project,
      moduleName: '产前版样衣',
      sourceObjectId: task.preProductionSampleTaskId,
      sourceObjectCode: task.preProductionSampleTaskCode,
      projectNodeId: task.projectNodeId,
      expectedWorkItemTypeCode: 'PRE_PRODUCTION_SAMPLE',
    })
    if (task.status === '已完成') {
      const node = getProjectNodeRecordById(project.projectId, task.projectNodeId)
      if (node && node.currentStatus !== '已完成') {
        issues.push(
          buildIssue(
            '已完成实例未回写项目节点',
            project,
            node,
            '产前版样衣',
            task.preProductionSampleTaskId,
            task.preProductionSampleTaskCode,
            '产前版样衣任务已完成，但项目节点未同步为已完成。',
          ),
        )
      }
    }
  })

  const style = findStyleArchiveByProjectId(project.projectId)
  if (style) {
    pushRecordBindingIssue(issues, {
      project,
      moduleName: '款式档案',
      sourceObjectId: style.styleId,
      sourceObjectCode: style.styleCode,
      projectNodeId: style.sourceProjectNodeId,
      expectedWorkItemTypeCode: 'STYLE_ARCHIVE_CREATE',
    })
  }

  listTechnicalDataVersionsByProjectId(project.projectId).forEach((record) => {
    const expectedWorkItemTypeCode =
      record.createdFromTaskType === 'PLATE'
        ? 'PATTERN_TASK'
        : record.createdFromTaskType === 'ARTWORK'
          ? 'PATTERN_ARTWORK_TASK'
          : 'REVISION_TASK'
    pushRecordBindingIssue(issues, {
      project,
      moduleName: '技术包',
      sourceObjectId: record.technicalVersionId,
      sourceObjectCode: record.technicalVersionCode,
      projectNodeId: record.sourceProjectNodeId,
      expectedWorkItemTypeCode,
    })
  })

  const archive = getProjectArchiveByProjectId(project.projectId)
  if (archive) {
    const node = listProjectNodes(project.projectId).find((item) => item.workItemTypeCode === 'STYLE_ARCHIVE_CREATE') || null
    if (!node) {
      issues.push(
        buildIssue(
          '模块记录缺少对应节点',
          project,
          null,
          '项目资料归档',
          archive.projectArchiveId,
          archive.archiveNo,
          '项目资料归档对象未找到对应的款式档案生成节点。',
        ),
      )
    }
  }

  listSampleAssets()
    .filter((asset) => asset.projectId === project.projectId)
    .forEach((asset) => {
      pushRecordBindingIssue(issues, {
        project,
        moduleName: '样衣资产',
        sourceObjectId: asset.sampleAssetId,
        sourceObjectCode: asset.sampleCode,
        projectNodeId: asset.projectNodeId,
        expectedWorkItemTypeCode: asset.workItemTypeCode,
      })
    })

  listSampleLedgerEvents()
    .filter((event) => event.projectId === project.projectId)
    .forEach((event) => {
      pushRecordBindingIssue(issues, {
        project,
        moduleName: '样衣台账',
        sourceObjectId: event.ledgerEventId,
        sourceObjectCode: event.ledgerEventCode,
        projectNodeId: event.projectNodeId,
        expectedWorkItemTypeCode: event.workItemTypeCode,
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
          node.workItemTypeName,
          node.latestInstanceId,
          node.latestInstanceCode,
          validation.message,
          validation.missingFieldLabels,
        ),
      )
    })
}

function pushTemplateAlignmentIssues(project: PcsProjectViewRecord, issues: PcsProjectDataConsistencyIssue[]): void {
  const template = getProjectTemplateById(project.templateId)
  if (!template) return

  const templateCodes = template.nodes
    .filter((node) => node.enabledFlag !== false)
    .slice()
    .sort((left, right) => {
      if (left.phaseCode === right.phaseCode) return left.sequenceNo - right.sequenceNo
      return left.phaseCode.localeCompare(right.phaseCode)
    })
    .map((node) => node.workItemTypeCode)
  const projectNodes = listProjectNodes(project.projectId)
  const projectCodes = projectNodes.map((node) => node.workItemTypeCode)

  if (templateCodes.join('|') === projectCodes.join('|')) return

  issues.push(
    buildIssue(
      '项目节点与模板定义不一致',
      project,
      projectNodes[0] || null,
      '项目节点',
      project.projectId,
      project.projectCode,
      `当前项目节点与模板定义不一致。模板节点：${templateCodes.join('、')}；项目节点：${projectCodes.join('、')}。`,
    ),
  )
}

export function auditPcsProjectDataConsistency(): PcsProjectDataConsistencyReport {
  const issues: PcsProjectDataConsistencyIssue[] = []
  const projects = listProjects()

  projects.forEach((project) => {
    pushTemplateAlignmentIssues(project, issues)
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

function buildConsistencyPendingReason(relation: ProjectRelationRecord): string {
  return relation.projectNodeId
    ? '历史测款关系绑定的项目节点已失效，当前未继续保留为正式关系。'
    : '历史测款关系未绑定正式项目节点，当前未继续保留为正式关系。'
}

export function repairPcsProjectDataConsistency(
  operatorName = '系统修复',
): PcsProjectDataConsistencyRepairResult {
  syncExistingProjectEngineeringTaskNodes(operatorName)

  const relationSnapshot = getProjectRelationStoreSnapshot()
  const migratedPendingItems = relationSnapshot.relations
    .filter(
      (relation) =>
        (relation.sourceModule === '直播' || relation.sourceModule === '短视频') &&
        (!relation.projectNodeId || !getProjectNodeRecordById(relation.projectId, relation.projectNodeId)),
    )
    .map((relation) => ({
      pendingRelationId: `pending_repair_${relation.projectRelationId}`,
      sourceModule: relation.sourceModule,
      sourceObjectCode: relation.sourceLineCode || relation.sourceObjectCode,
      rawProjectCode: relation.projectCode,
      reason: buildConsistencyPendingReason(relation),
      discoveredAt: relation.updatedAt || relation.businessDate,
      sourceTitle: relation.sourceTitle,
      legacyRefType: relation.legacyRefType || `${relation.sourceModule}.relation`,
      legacyRefValue: relation.legacyRefValue || relation.sourceLineId || relation.sourceObjectId,
    }))

  const nextRelations = relationSnapshot.relations.filter(
    (relation) =>
      !(
        (relation.sourceModule === '直播' || relation.sourceModule === '短视频') &&
        (!relation.projectNodeId || !getProjectNodeRecordById(relation.projectId, relation.projectNodeId))
      ),
  )

  replaceProjectRelationStore({
    ...relationSnapshot,
    relations: nextRelations,
    pendingItems: [...relationSnapshot.pendingItems, ...migratedPendingItems],
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
      latestResultText: `${node.workItemTypeName}当前仍缺少正式数据，已回退为进行中。`,
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
    relationRepairCount: migratedPendingItems.length,
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
      const nodeLabel = issue.workItemTypeCode ? ` / 节点 ${issue.workItemTypeCode}` : ''
      const objectLabel = issue.sourceObjectCode ? ` / 对象 ${issue.sourceObjectCode}` : ''
      const missingLabel =
        issue.missingFieldLabels.length > 0 ? ` / 缺失：${issue.missingFieldLabels.join('、')}` : ''
      return `${index + 1}. ${issue.issueType} / ${issue.projectCode}${nodeLabel}${objectLabel} / ${issue.message}${missingLabel}`
    }),
  ]

  return lines.join('\n')
}
