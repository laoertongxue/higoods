import { getProjectPhaseDefinitionByCode } from './pcs-project-phase-definitions.ts'
import { getProjectWorkItemContract } from './pcs-project-domain-contract.ts'
import type {
  ProjectTemplateNodeDefinition,
  ProjectTemplatePendingNode,
  ProjectTemplateStageDefinition,
} from './pcs-project-definition-normalizer.ts'
import type { ProjectTemplate } from './pcs-templates.ts'
import type { PcsProjectInlineNodeRecord } from './pcs-project-inline-node-record-types.ts'
import type { PcsProjectNodeRecord, PcsProjectRecord, PcsProjectStoreSnapshot } from './pcs-project-types.ts'
import type {
  ProjectRelationPendingItem,
  ProjectRelationRecord,
  ProjectRelationStoreSnapshot,
} from './pcs-project-relation-types.ts'

const REMOVED_WORK_ITEM_CODE = 'SAMPLE_RETAIN_REVIEW'
const REMOVED_WORK_ITEM_NAME = '样衣留存评估'
const TARGET_WORK_ITEM_CODE = 'SAMPLE_RETURN_HANDLE'
const TARGET_WORK_ITEM_NAME = '样衣退回处理'
const TARGET_PHASE_CODE = 'PHASE_05'
const TARGET_PHASE_NAME = getProjectPhaseDefinitionByCode(TARGET_PHASE_CODE)?.phaseName || '项目收尾'
const TARGET_WORK_ITEM = getProjectWorkItemContract(TARGET_WORK_ITEM_CODE)

type MutableProjectRecord = PcsProjectRecord & Record<string, unknown>

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function isRemovedWorkItemCode(value: string | null | undefined): boolean {
  return value === REMOVED_WORK_ITEM_CODE
}

function isRemovedWorkItemName(value: string | null | undefined): boolean {
  return value === REMOVED_WORK_ITEM_NAME
}

function isTargetWorkItemCode(value: string | null | undefined): boolean {
  return value === TARGET_WORK_ITEM_CODE
}

function cloneTemplateNode(node: ProjectTemplateNodeDefinition): ProjectTemplateNodeDefinition {
  return {
    ...node,
    roleOverrideCodes: [...node.roleOverrideCodes],
    roleOverrideNames: [...node.roleOverrideNames],
  }
}

function cloneProjectNode(node: PcsProjectNodeRecord): PcsProjectNodeRecord {
  return { ...node }
}

function repairTemplateNodeSequence(nodes: ProjectTemplateNodeDefinition[]): ProjectTemplateNodeDefinition[] {
  const phaseOrderMap = new Map(
    Array.from(new Set(nodes.map((node) => node.phaseCode))).map((phaseCode) => [
      phaseCode,
      getProjectPhaseDefinitionByCode(phaseCode)?.phaseOrder || Number.MAX_SAFE_INTEGER,
    ]),
  )

  const grouped = new Map<string, ProjectTemplateNodeDefinition[]>()
  nodes.forEach((node) => {
    const list = grouped.get(node.phaseCode) || []
    list.push(cloneTemplateNode(node))
    grouped.set(node.phaseCode, list)
  })

  return Array.from(grouped.entries())
    .sort((left, right) => (phaseOrderMap.get(left[0]) || 0) - (phaseOrderMap.get(right[0]) || 0))
    .flatMap(([, phaseNodes]) =>
      phaseNodes
        .sort((left, right) => left.sequenceNo - right.sequenceNo)
        .map((node, index) => ({
          ...node,
          phaseName: getProjectPhaseDefinitionByCode(node.phaseCode)?.phaseName || node.phaseName,
          sequenceNo: index + 1,
        })),
    )
}

function buildTemplateReturnHandleNode(
  template: ProjectTemplate,
  stage: ProjectTemplateStageDefinition,
  sequenceNo: number,
): ProjectTemplateNodeDefinition {
  return {
    templateNodeId: `${template.id}-${TARGET_PHASE_CODE}-NODE-${String(sequenceNo).padStart(2, '0')}`,
    templateId: template.id,
    templateStageId: stage.templateStageId,
    phaseCode: TARGET_PHASE_CODE,
    phaseName: stage.phaseName,
    workItemId: TARGET_WORK_ITEM.workItemId,
    workItemTypeCode: TARGET_WORK_ITEM_CODE,
    workItemTypeName: TARGET_WORK_ITEM_NAME,
    sequenceNo,
    enabledFlag: true,
    requiredFlag: true,
    multiInstanceFlag: TARGET_WORK_ITEM.capabilities.canMultiInstance,
    roleOverrideCodes: [],
    roleOverrideNames: [],
    note: '',
    sourceWorkItemUpdatedAt: '',
    templateVersion: template.updatedAt,
  }
}

function removePendingNodesWithRetainReview(pendingNodes: ProjectTemplatePendingNode[]): ProjectTemplatePendingNode[] {
  return pendingNodes
    .filter(
      (node) =>
        !isRemovedWorkItemCode(node.resolvedWorkItemTypeCode || '') &&
        !isRemovedWorkItemName(node.legacyWorkItemName || ''),
    )
    .map((node) => ({ ...node }))
}

export function removeSampleRetainReviewFromTemplates(templates: ProjectTemplate[]): ProjectTemplate[] {
  return templates.map((template) => {
    const orderedStages = template.stages
      .slice()
      .sort((left, right) => left.phaseOrder - right.phaseOrder)
      .map((stage) => ({ ...stage }))
    const phase05Stage =
      orderedStages.find((stage) => stage.phaseCode === TARGET_PHASE_CODE) ||
      ({
        templateStageId: `${template.id}-${TARGET_PHASE_CODE}`,
        templateId: template.id,
        phaseCode: TARGET_PHASE_CODE,
        phaseName: TARGET_PHASE_NAME,
        phaseOrder: getProjectPhaseDefinitionByCode(TARGET_PHASE_CODE)?.phaseOrder || 5,
        requiredFlag: true,
        description: getProjectPhaseDefinitionByCode(TARGET_PHASE_CODE)?.description || '',
      } satisfies ProjectTemplateStageDefinition)

    const filteredNodes = template.nodes
      .filter(
        (node) =>
          !isRemovedWorkItemCode(node.workItemTypeCode) &&
          !isRemovedWorkItemName(node.workItemTypeName),
      )
      .map(cloneTemplateNode)

    const hasReturnHandle = filteredNodes.some((node) => isTargetWorkItemCode(node.workItemTypeCode))
    if (!hasReturnHandle) {
      const phaseNodes = filteredNodes.filter((node) => node.phaseCode === TARGET_PHASE_CODE)
      filteredNodes.push(buildTemplateReturnHandleNode(template, phase05Stage, phaseNodes.length + 1))
    }

    return {
      ...template,
      styleType: [...template.styleType],
      stages: orderedStages,
      nodes: repairTemplateNodeSequence(filteredNodes),
      pendingNodes: removePendingNodesWithRetainReview(template.pendingNodes),
    }
  })
}

function getNodeStatusScore(status: PcsProjectNodeRecord['currentStatus']): number {
  if (status === '已完成') return 4
  if (status === '待确认') return 3
  if (status === '进行中') return 2
  if (status === '未开始') return 1
  return 0
}

function pickPreferredNode(nodes: PcsProjectNodeRecord[]): PcsProjectNodeRecord {
  return nodes
    .slice()
    .sort((left, right) => {
      const statusDiff = getNodeStatusScore(right.currentStatus) - getNodeStatusScore(left.currentStatus)
      if (statusDiff !== 0) return statusDiff
      const updatedDiff = (right.updatedAt || right.lastEventTime || '').localeCompare(left.updatedAt || left.lastEventTime || '')
      if (updatedDiff !== 0) return updatedDiff
      return left.projectNodeId.localeCompare(right.projectNodeId)
    })[0]
}

export function repairProjectNodeSequenceAfterRemovingRetainReview(
  nodes: PcsProjectNodeRecord[],
): PcsProjectNodeRecord[] {
  const grouped = new Map<string, PcsProjectNodeRecord[]>()
  nodes.forEach((node) => {
    const list = grouped.get(node.phaseCode) || []
    list.push(cloneProjectNode(node))
    grouped.set(node.phaseCode, list)
  })

  return Array.from(grouped.entries())
    .sort(
      (left, right) =>
        (getProjectPhaseDefinitionByCode(left[0])?.phaseOrder || Number.MAX_SAFE_INTEGER) -
        (getProjectPhaseDefinitionByCode(right[0])?.phaseOrder || Number.MAX_SAFE_INTEGER),
    )
    .flatMap(([, phaseNodes]) =>
      phaseNodes
        .sort((left, right) => left.sequenceNo - right.sequenceNo)
        .map((node, index) => ({
          ...node,
          phaseName: getProjectPhaseDefinitionByCode(node.phaseCode)?.phaseName || node.phaseName,
          sequenceNo: index + 1,
        })),
    )
}

export function ensureSampleReturnHandleNode(
  project: PcsProjectRecord,
  nodes: PcsProjectNodeRecord[],
): {
  nodes: PcsProjectNodeRecord[]
  returnHandleNode: PcsProjectNodeRecord
  removedNodeIds: string[]
} {
  const returnNodes = nodes.filter((node) => isTargetWorkItemCode(node.workItemTypeCode))
  const retainNodes = nodes.filter((node) => isRemovedWorkItemCode(node.workItemTypeCode))
  const removedNodeIds: string[] = []

  if (returnNodes.length > 0) {
    const keepNode = {
      ...pickPreferredNode(returnNodes),
      phaseCode: TARGET_PHASE_CODE,
      phaseName: TARGET_PHASE_NAME,
      workItemId: TARGET_WORK_ITEM.workItemId,
      workItemTypeCode: TARGET_WORK_ITEM_CODE,
      workItemTypeName: TARGET_WORK_ITEM_NAME,
      requiredFlag: true,
      multiInstanceFlag: TARGET_WORK_ITEM.capabilities.canMultiInstance,
    }
    const nextNodes = nodes
      .filter((node) => {
        const shouldRemove =
          (isTargetWorkItemCode(node.workItemTypeCode) && node.projectNodeId !== keepNode.projectNodeId) ||
          isRemovedWorkItemCode(node.workItemTypeCode)
        if (shouldRemove) removedNodeIds.push(node.projectNodeId)
        return !shouldRemove
      })
      .map((node) => (node.projectNodeId === keepNode.projectNodeId ? keepNode : cloneProjectNode(node)))

    return {
      nodes: repairProjectNodeSequenceAfterRemovingRetainReview(nextNodes),
      returnHandleNode: keepNode,
      removedNodeIds,
    }
  }

  if (retainNodes.length > 0) {
    const keepRetainNode = pickPreferredNode(retainNodes)
    const convertedStatus = keepRetainNode.currentStatus === '进行中' || keepRetainNode.currentStatus === '待确认' ? '进行中' : '未开始'
    const convertedNode: PcsProjectNodeRecord = {
      ...keepRetainNode,
      phaseCode: TARGET_PHASE_CODE,
      phaseName: TARGET_PHASE_NAME,
      workItemId: TARGET_WORK_ITEM.workItemId,
      workItemTypeCode: TARGET_WORK_ITEM_CODE,
      workItemTypeName: TARGET_WORK_ITEM_NAME,
      requiredFlag: true,
      multiInstanceFlag: TARGET_WORK_ITEM.capabilities.canMultiInstance,
      currentStatus: convertedStatus,
      validInstanceCount: 0,
      latestInstanceId: '',
      latestInstanceCode: '',
      latestResultType: '',
      latestResultText: '',
      currentIssueType: '',
      currentIssueText: '',
      pendingActionType: convertedStatus === '进行中' ? '待执行' : '待执行',
      pendingActionText: convertedStatus === '进行中' ? `当前请处理：${TARGET_WORK_ITEM_NAME}` : '待开始执行',
      updatedAt: keepRetainNode.updatedAt || nowText(),
      lastEventId: '',
      lastEventType: '',
      lastEventTime: '',
    }

    const nextNodes = nodes
      .filter((node) => {
        const shouldRemove = isRemovedWorkItemCode(node.workItemTypeCode) && node.projectNodeId !== keepRetainNode.projectNodeId
        if (shouldRemove) removedNodeIds.push(node.projectNodeId)
        return !shouldRemove
      })
      .map((node) => (node.projectNodeId === keepRetainNode.projectNodeId ? convertedNode : cloneProjectNode(node)))

    return {
      nodes: repairProjectNodeSequenceAfterRemovingRetainReview(nextNodes),
      returnHandleNode: convertedNode,
      removedNodeIds,
    }
  }

  const phase05Nodes = nodes.filter((node) => node.phaseCode === TARGET_PHASE_CODE)
  const nextSequenceNo = phase05Nodes.length + 1
  const addedNode: PcsProjectNodeRecord = {
    projectNodeId: `${project.projectId}-node-${TARGET_PHASE_CODE}-${String(nextSequenceNo).padStart(2, '0')}`,
    projectId: project.projectId,
    phaseCode: TARGET_PHASE_CODE,
    phaseName: TARGET_PHASE_NAME,
    workItemId: TARGET_WORK_ITEM.workItemId,
    workItemTypeCode: TARGET_WORK_ITEM_CODE,
    workItemTypeName: TARGET_WORK_ITEM_NAME,
    sequenceNo: nextSequenceNo,
    requiredFlag: true,
    multiInstanceFlag: TARGET_WORK_ITEM.capabilities.canMultiInstance,
    currentStatus: '未开始',
    currentOwnerId: project.ownerId,
    currentOwnerName: project.ownerName,
    validInstanceCount: 0,
    latestInstanceId: '',
    latestInstanceCode: '',
    latestResultType: '',
    latestResultText: '',
    currentIssueType: '',
    currentIssueText: '',
    pendingActionType: '待执行',
    pendingActionText: '待开始执行',
    sourceTemplateNodeId: '',
    sourceTemplateVersion: project.templateVersion || '',
    updatedAt: project.updatedAt || project.createdAt || nowText(),
    lastEventId: '',
    lastEventType: '',
    lastEventTime: '',
  }

  return {
    nodes: repairProjectNodeSequenceAfterRemovingRetainReview([...nodes.map(cloneProjectNode), addedNode]),
    returnHandleNode: addedNode,
    removedNodeIds,
  }
}

export function removeSampleRetainReviewFromProjectNodes(
  project: PcsProjectRecord,
  nodes: PcsProjectNodeRecord[],
): {
  nodes: PcsProjectNodeRecord[]
  removedNodeIds: string[]
  returnHandleNode: PcsProjectNodeRecord
} {
  const targetNodes = nodes.filter((node) => node.projectId === project.projectId)
  const otherNodes = nodes.filter((node) => node.projectId !== project.projectId).map(cloneProjectNode)
  const ensured = ensureSampleReturnHandleNode(project, targetNodes)
  return {
    nodes: [...otherNodes, ...ensured.nodes],
    removedNodeIds: ensured.removedNodeIds,
    returnHandleNode: ensured.returnHandleNode,
  }
}

function replaceLegacyProjectNodeCodes(project: MutableProjectRecord): MutableProjectRecord {
  ;['currentNodeCode', 'issueNodeCode', 'latestNodeCode'].forEach((fieldKey) => {
    if (project[fieldKey] === REMOVED_WORK_ITEM_CODE) {
      project[fieldKey] = TARGET_WORK_ITEM_CODE
    }
  })
  return project
}

export function removeSampleRetainReviewFromProjectSnapshot(snapshot: PcsProjectStoreSnapshot): PcsProjectStoreSnapshot {
  const nextProjects = snapshot.projects.map((project) => replaceLegacyProjectNodeCodes({ ...project }))
  const nextPhases = snapshot.phases.map((phase) => ({ ...phase }))
  let nextNodes = snapshot.nodes.map(cloneProjectNode)

  nextProjects.forEach((project) => {
    const result = removeSampleRetainReviewFromProjectNodes(project, nextNodes)
    nextNodes = result.nodes
  })

  return {
    version: snapshot.version,
    projects: nextProjects,
    phases: nextPhases,
    nodes: nextNodes,
  }
}

export function removeSampleRetainReviewFromInlineRecords<T extends { workItemTypeCode?: string | null; projectNodeId?: string | null }>(
  records: T[],
  removedNodeIds: Set<string> = new Set(),
): T[] {
  return records.filter(
    (record) =>
      !isRemovedWorkItemCode(record.workItemTypeCode || '') &&
      !(record.projectNodeId && removedNodeIds.has(record.projectNodeId)),
  )
}

function isSampleRelationTransferable(record: ProjectRelationRecord): boolean {
  if (record.sourceModule === '样衣资产' || record.sourceModule === '样衣台账') return true
  if (record.sourceObjectType === '样衣资产' || record.sourceObjectType === '样衣台账事件') return true
  const joined = [
    record.sourceTitle,
    record.sourceStatus,
    record.note,
    record.legacyRefType,
    record.legacyRefValue,
  ]
    .filter(Boolean)
    .join(' ')
  return /样衣|退回|退货|处置/.test(joined)
}

function buildRemovedRelationPendingItem(
  relation: ProjectRelationRecord,
  reason: string,
): ProjectRelationPendingItem {
  return {
    pendingRelationId: `retain-review-cleanup-${relation.projectRelationId}`,
    sourceModule: relation.sourceModule,
    sourceObjectCode: relation.sourceObjectCode,
    rawProjectCode: relation.projectCode,
    reason,
    discoveredAt: relation.updatedAt || relation.businessDate || nowText(),
    sourceTitle: relation.sourceTitle,
    legacyRefType: relation.legacyRefType,
    legacyRefValue: relation.legacyRefValue,
  }
}

export function removeSampleRetainReviewFromRelations(
  snapshot: ProjectRelationStoreSnapshot,
  projectSnapshot: PcsProjectStoreSnapshot,
): ProjectRelationStoreSnapshot {
  const nodeById = new Map(projectSnapshot.nodes.map((node) => [node.projectNodeId, node]))
  const returnNodeByProjectId = new Map(
    projectSnapshot.projects.map((project) => {
      const returnNode =
        projectSnapshot.nodes.find(
          (node) => node.projectId === project.projectId && isTargetWorkItemCode(node.workItemTypeCode),
        ) || null
      return [project.projectId, returnNode]
    }),
  )

  const nextRelations: ProjectRelationRecord[] = []
  const nextPendingItems = snapshot.pendingItems.map((item) => ({ ...item }))

  snapshot.relations.forEach((relation) => {
    const currentNode = relation.projectNodeId ? nodeById.get(relation.projectNodeId) || null : null
    const pointsToRemovedNode =
      isRemovedWorkItemCode(relation.workItemTypeCode) ||
      isRemovedWorkItemName(relation.workItemTypeName) ||
      Boolean(relation.projectNodeId && !currentNode && isSampleRelationTransferable(relation))

    if (!pointsToRemovedNode) {
      const targetReturnNode = returnNodeByProjectId.get(relation.projectId) || null
      if (
        targetReturnNode &&
        isTargetWorkItemCode(relation.workItemTypeCode) &&
        relation.projectNodeId !== targetReturnNode.projectNodeId
      ) {
        nextRelations.push({
          ...relation,
          projectNodeId: targetReturnNode.projectNodeId,
          workItemTypeCode: TARGET_WORK_ITEM_CODE,
          workItemTypeName: TARGET_WORK_ITEM_NAME,
        })
      } else {
        nextRelations.push({ ...relation })
      }
      return
    }

    const targetReturnNode = returnNodeByProjectId.get(relation.projectId) || null
    if (targetReturnNode && isSampleRelationTransferable(relation)) {
      nextRelations.push({
        ...relation,
        projectNodeId: targetReturnNode.projectNodeId,
        workItemTypeCode: TARGET_WORK_ITEM_CODE,
        workItemTypeName: TARGET_WORK_ITEM_NAME,
      })
      return
    }

    nextPendingItems.push(
      buildRemovedRelationPendingItem(
        relation,
        targetReturnNode
          ? '旧样衣留存评估关系来源无法识别，已删除并待人工复核。'
          : '项目缺少样衣退回处理节点，旧样衣留存评估关系已删除并待人工复核。',
      ),
    )
  })

  return {
    version: snapshot.version,
    relations: nextRelations,
    pendingItems: nextPendingItems,
  }
}
