import {
  getProjectById,
  getProjectNodeRecordById,
  getProjectNodeSequenceBlocker,
  getProjectNodeRecordByWorkItemTypeCode,
  listProjectNodes,
  listProjectPhases,
  updateProjectNodeRecord,
  updateProjectPhaseRecord,
  updateProjectRecord,
  approveProjectInit,
} from './pcs-project-repository.ts'
import type {
  PcsProjectNodeRecord,
  PcsProjectPhaseRecord,
  PcsProjectViewRecord,
  ProjectNodeStatus,
} from './pcs-project-types.ts'
import {
  PCS_PROJECT_INLINE_NODE_RECORD_WORK_ITEM_TYPES,
  type PcsProjectInlineNodeRecordWorkItemTypeCode,
} from './pcs-project-inline-node-record-types.ts'
import {
  saveProjectInlineNodeFieldEntry,
  type SaveProjectInlineNodeFieldEntryInput,
} from './pcs-project-inline-node-record-repository.ts'
import {
  submitProjectTestingSummary,
} from './pcs-channel-product-project-repository.ts'
import { syncProjectNodeInstanceRuntime } from './pcs-project-node-instance-registry.ts'
import { validateProjectNodeCompletion } from './pcs-project-data-consistency.ts'
import {
  completeDecisionNodeWithResult,
  isProjectDecisionWorkItemCode,
} from './pcs-project-decision-flow-service.ts'

export interface ProjectFlowActionResult {
  ok: boolean
  message: string
  project: PcsProjectViewRecord | null
  node: PcsProjectNodeRecord | null
  nextNode: PcsProjectNodeRecord | null
}

export interface ProjectFormalRecordFlowInput {
  projectId: string
  projectNodeId: string
  payload: SaveProjectInlineNodeFieldEntryInput
  completeAfterSave?: boolean
  operatorName?: string
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function canUseInlineRecords(workItemTypeCode: string): workItemTypeCode is PcsProjectInlineNodeRecordWorkItemTypeCode {
  return (PCS_PROJECT_INLINE_NODE_RECORD_WORK_ITEM_TYPES as readonly string[]).includes(workItemTypeCode)
}

export function isClosedProjectNodeStatus(status: ProjectNodeStatus): boolean {
  return status === '已完成' || status === '已取消'
}

function getSequenceBlockedResult(
  projectId: string,
  projectNodeId: string,
  messagePrefix = '请先完成前序工作项',
): ProjectFlowActionResult | null {
  const blocker = getProjectNodeSequenceBlocker(projectId, projectNodeId)
  if (!blocker) return null
  return {
    ok: false,
    message: `${messagePrefix}：${blocker.workItemTypeName}。`,
    project: getProjectById(projectId),
    node: getProjectNodeRecordById(projectId, projectNodeId),
    nextNode: blocker,
  }
}

export function syncProjectLifecycle(
  projectId: string,
  operatorName = '当前用户',
  timestamp = nowText(),
): ProjectFlowActionResult {
  const project = getProjectById(projectId)
  const phases = listProjectPhases(projectId)
  const nodes = listProjectNodes(projectId)
  if (!project || phases.length === 0 || nodes.length === 0) {
    return {
      ok: false,
      message: '未找到完整的项目阶段或节点数据，不能同步项目生命周期。',
      project,
      node: null,
      nextNode: null,
    }
  }

  const nextNode = nodes.find((node) => !isClosedProjectNodeStatus(node.currentStatus)) ?? null
  const currentPhaseCode = nextNode?.phaseCode ?? phases[phases.length - 1]?.phaseCode ?? project.currentPhaseCode
  const currentPhase = phases.find((item) => item.phaseCode === currentPhaseCode) ?? phases[0]
  const completedNonInitCount = nodes.filter(
    (node) => node.workItemTypeCode !== 'PROJECT_INIT' && node.currentStatus === '已完成',
  ).length
  const allClosed = nodes.every((node) => isClosedProjectNodeStatus(node.currentStatus))

  let projectStatus = project.projectStatus
  if (project.projectStatus === '已终止') {
    projectStatus = '已终止'
  } else if (allClosed) {
    projectStatus = '已归档'
  } else if (completedNonInitCount === 0) {
    projectStatus = '已立项'
  } else {
    projectStatus = '进行中'
  }

  phases.forEach((phase) => {
    const phaseNodes = nodes.filter((node) => node.phaseCode === phase.phaseCode)
    let phaseStatus: PcsProjectPhaseRecord['phaseStatus'] = '未开始'
    if (projectStatus === '已终止' && phaseNodes.some((node) => !isClosedProjectNodeStatus(node.currentStatus))) {
      phaseStatus = '已终止'
    } else if (phaseNodes.length > 0 && phaseNodes.every((node) => isClosedProjectNodeStatus(node.currentStatus))) {
      phaseStatus = '已完成'
    } else if (
      phase.phaseCode === currentPhaseCode ||
      phaseNodes.some((node) => node.currentStatus === '进行中' || node.currentStatus === '待确认')
    ) {
      phaseStatus = '进行中'
    } else if (phase.phaseOrder < currentPhase.phaseOrder) {
      phaseStatus = '已完成'
    }

    updateProjectPhaseRecord(projectId, phase.projectPhaseId, {
      phaseStatus,
      startedAt: phaseStatus === '未开始' ? '' : phase.startedAt || timestamp,
      finishedAt: phaseStatus === '已完成' || phaseStatus === '已终止' ? phase.finishedAt || timestamp : '',
    })
  })

  updateProjectRecord(
    projectId,
    {
      currentPhaseCode: currentPhase.phaseCode,
      currentPhaseName: currentPhase.phaseName,
      projectStatus,
      updatedAt: timestamp,
    },
    operatorName,
  )

  return {
    ok: true,
    message: '项目生命周期已同步。',
    project: getProjectById(projectId),
    node: nodes.find((node) => node.currentStatus === '待确认') ?? null,
    nextNode,
  }
}

export function completeProjectNode(
  projectId: string,
  projectNodeId: string,
  input: {
    operatorName?: string
    timestamp?: string
    resultType?: string
    resultText?: string
  } = {},
): PcsProjectNodeRecord | null {
  const blocker = getProjectNodeSequenceBlocker(projectId, projectNodeId)
  if (blocker) return null
  const node = getProjectNodeRecordById(projectId, projectNodeId)
  if (!node) return null

  const operatorName = input.operatorName ?? '当前用户'
  const timestamp = input.timestamp ?? nowText()
  const defaultResultType = node.workItemTypeCode === 'FIRST_SAMPLE' ? '首版样衣打样已完成' : '节点完成'
  const defaultResultText =
    node.workItemTypeCode === 'FIRST_SAMPLE'
      ? '首版样衣打样已完成，商品项目节点同步完成。'
      : `${node.workItemTypeName}已完成。`

  updateProjectNodeRecord(
    projectId,
    projectNodeId,
    {
      currentStatus: '已完成',
      latestResultType: input.resultType ?? defaultResultType,
      latestResultText: input.resultText ?? defaultResultText,
      pendingActionType: '已完成',
      pendingActionText: '节点已完成',
      updatedAt: timestamp,
      lastEventType: input.resultType ?? defaultResultType,
      lastEventTime: timestamp,
    },
    operatorName,
  )

  return syncProjectNodeInstanceRuntime(projectId, projectNodeId, operatorName, timestamp)
}

export function activateProjectNode(
  projectId: string,
  projectNodeId: string,
  input: {
    operatorName?: string
    timestamp?: string
    pendingActionType?: string
    pendingActionText?: string
    latestResultType?: string
    latestResultText?: string
    currentStatus?: Extract<ProjectNodeStatus, '进行中' | '待确认'>
  } = {},
): PcsProjectNodeRecord | null {
  const blocker = getProjectNodeSequenceBlocker(projectId, projectNodeId)
  if (blocker) return getProjectNodeRecordById(projectId, projectNodeId)
  const node = getProjectNodeRecordById(projectId, projectNodeId)
  if (!node || isClosedProjectNodeStatus(node.currentStatus)) return node

  const operatorName = input.operatorName ?? '当前用户'
  const timestamp = input.timestamp ?? nowText()

  updateProjectNodeRecord(
    projectId,
    projectNodeId,
    {
      currentStatus: input.currentStatus ?? '进行中',
      pendingActionType: input.pendingActionType ?? '待执行',
      pendingActionText: input.pendingActionText ?? `当前请处理：${node.workItemTypeName}`,
      latestResultType: input.latestResultType ?? node.latestResultType,
      latestResultText: input.latestResultText ?? node.latestResultText,
      updatedAt: timestamp,
    },
    operatorName,
  )

  return getProjectNodeRecordById(projectId, projectNodeId)
}

export function cancelProjectNode(
  projectId: string,
  projectNodeId: string,
  reason: string,
  operatorName = '当前用户',
  timestamp = nowText(),
): PcsProjectNodeRecord | null {
  const node = getProjectNodeRecordById(projectId, projectNodeId)
  if (!node || isClosedProjectNodeStatus(node.currentStatus)) return node

  updateProjectNodeRecord(
    projectId,
    projectNodeId,
    {
      currentStatus: '已取消',
      latestResultType: '分支跳过',
      latestResultText: reason,
      pendingActionType: '已取消',
      pendingActionText: '当前分支无需继续处理',
      updatedAt: timestamp,
      lastEventType: '分支跳过',
      lastEventTime: timestamp,
    },
    operatorName,
  )

  return getProjectNodeRecordById(projectId, projectNodeId)
}

export function markProjectNodeCompletedAndUnlockNext(
  projectId: string,
  projectNodeId: string,
  input: {
    operatorName?: string
    timestamp?: string
    resultType?: string
    resultText?: string
  } = {},
): ProjectFlowActionResult {
  const blockedResult = getSequenceBlockedResult(projectId, projectNodeId)
  if (blockedResult) return blockedResult
  const completionValidation = validateProjectNodeCompletion(projectId, projectNodeId)
  if (!completionValidation.ok) {
    return {
      ok: false,
      message: completionValidation.message,
      project: completionValidation.project,
      node: completionValidation.node,
      nextNode: null,
    }
  }
  const node = completeProjectNode(projectId, projectNodeId, input)
  if (!node) {
    return {
      ok: false,
      message: '未找到对应项目节点，不能完成流转。',
      project: getProjectById(projectId),
      node: null,
      nextNode: null,
    }
  }

  const orderedNodes = listProjectNodes(projectId)
  const currentIndex = orderedNodes.findIndex((item) => item.projectNodeId === projectNodeId)
  const nextNode = orderedNodes.slice(currentIndex + 1).find((item) => item.currentStatus === '未开始') ?? null
  const operatorName = input.operatorName ?? '当前用户'
  const timestamp = input.timestamp ?? nowText()

  if (nextNode) {
    activateProjectNode(projectId, nextNode.projectNodeId, {
      operatorName,
      timestamp,
      pendingActionType: '待执行',
      pendingActionText: `当前请处理：${nextNode.workItemTypeName}`,
    })
  }

  syncProjectLifecycle(projectId, operatorName, timestamp)

  return {
    ok: true,
    message: `${node.workItemTypeName}已完成。`,
    project: getProjectById(projectId),
    node: getProjectNodeRecordById(projectId, projectNodeId),
    nextNode: nextNode ? getProjectNodeRecordById(projectId, nextNode.projectNodeId) : null,
  }
}

export function approveProjectInitAndSync(
  projectId: string,
  operatorName = '当前用户',
): ProjectFlowActionResult {
  const result = approveProjectInit(projectId, operatorName)
  if (!result.ok) {
    return {
      ok: false,
      message: result.message,
      project: result.project,
      node: result.projectInitNode,
      nextNode: result.nextNode,
    }
  }

  if (result.projectInitNode) {
    syncProjectNodeInstanceRuntime(projectId, result.projectInitNode.projectNodeId, operatorName)
  }
  syncProjectLifecycle(projectId, operatorName)

  return {
    ok: true,
    message: result.message,
    project: getProjectById(projectId),
    node: result.projectInitNode
      ? getProjectNodeRecordById(projectId, result.projectInitNode.projectNodeId)
      : null,
    nextNode: result.nextNode,
  }
}

export function terminateProject(
  projectId: string,
  reason: string,
  operatorName = '当前用户',
  timestamp = nowText(),
): ProjectFlowActionResult {
  const project = getProjectById(projectId)
  if (!project) {
    return {
      ok: false,
      message: '未找到对应商品项目，不能终止。',
      project: null,
      node: null,
      nextNode: null,
    }
  }

  listProjectNodes(projectId).forEach((node) => {
    if (isClosedProjectNodeStatus(node.currentStatus)) return
    updateProjectNodeRecord(
      projectId,
      node.projectNodeId,
      {
        currentStatus: '已取消',
        latestResultType: '项目终止',
        latestResultText: reason,
        pendingActionType: '已取消',
        pendingActionText: '项目已终止',
        updatedAt: timestamp,
        lastEventType: '项目终止',
        lastEventTime: timestamp,
      },
      operatorName,
    )
  })

  updateProjectRecord(
    projectId,
    {
      projectStatus: '已终止',
      updatedAt: timestamp,
      remark: project.remark ? `${project.remark}\n终止原因：${reason}` : `终止原因：${reason}`,
    },
    operatorName,
  )
  syncProjectLifecycle(projectId, operatorName, timestamp)

  return {
    ok: true,
    message: '项目已终止。',
    project: getProjectById(projectId),
    node: null,
    nextNode: null,
  }
}

export function archiveProject(
  projectId: string,
  operatorName = '当前用户',
  timestamp = nowText(),
): ProjectFlowActionResult {
  const nodes = listProjectNodes(projectId)
  if (nodes.some((node) => !isClosedProjectNodeStatus(node.currentStatus))) {
    return {
      ok: false,
      message: '仍有未完成节点，当前不能归档。',
      project: getProjectById(projectId),
      node: null,
      nextNode: null,
    }
  }

  updateProjectRecord(projectId, { projectStatus: '已归档', updatedAt: timestamp }, operatorName)
  syncProjectLifecycle(projectId, operatorName, timestamp)

  return {
    ok: true,
    message: '项目已归档。',
    project: getProjectById(projectId),
    node: null,
    nextNode: null,
  }
}

export function saveProjectNodeFormalRecord(input: ProjectFormalRecordFlowInput): ProjectFlowActionResult {
  const operatorName = input.operatorName ?? '当前用户'
  const project = getProjectById(input.projectId)
  const node = getProjectNodeRecordById(input.projectId, input.projectNodeId)
  if (!project || !node) {
    return {
      ok: false,
      message: '未找到对应商品项目或项目节点，不能保存正式记录。',
      project,
      node,
      nextNode: null,
    }
  }

  if (!canUseInlineRecords(node.workItemTypeCode)) {
    return {
      ok: false,
      message: '当前节点不通过项目内正式记录承载字段，不能直接保存。',
      project,
      node,
      nextNode: null,
    }
  }

  const blockedResult = getSequenceBlockedResult(input.projectId, input.projectNodeId, '请填写并完成前序工作项')
  if (blockedResult) return blockedResult

  const values = input.payload.values || {}
  const detailSnapshot = input.payload.detailSnapshot
  const businessDate = input.payload.businessDate || nowText()

  if (input.completeAfterSave && node.workItemTypeCode === 'TEST_DATA_SUMMARY') {
    const summaryResult = submitProjectTestingSummary(
      input.projectId,
      {
        summaryText: String(values.summaryText || '').trim(),
      },
      operatorName,
    )
    if (!summaryResult.ok) {
      return {
        ok: false,
        message: summaryResult.message,
        project: getProjectById(input.projectId),
        node: getProjectNodeRecordById(input.projectId, input.projectNodeId),
        nextNode: null,
      }
    }

    syncProjectLifecycle(input.projectId, operatorName, businessDate)
    const decisionNode = getProjectNodeRecordByWorkItemTypeCode(input.projectId, 'TEST_CONCLUSION')
    return {
      ok: true,
      message: summaryResult.message,
      project: getProjectById(input.projectId),
      node: getProjectNodeRecordById(input.projectId, input.projectNodeId),
      nextNode: decisionNode ? getProjectNodeRecordById(input.projectId, decisionNode.projectNodeId) : null,
    }
  }

  const saveResult = saveProjectInlineNodeFieldEntry(
    input.projectId,
    input.projectNodeId,
    {
      ...input.payload,
      businessDate,
      values,
      detailSnapshot,
    },
    operatorName,
  )

  if (!saveResult.ok) {
    return {
      ok: false,
      message: saveResult.message,
      project: getProjectById(input.projectId),
      node: getProjectNodeRecordById(input.projectId, input.projectNodeId),
      nextNode: null,
    }
  }

  syncProjectNodeInstanceRuntime(input.projectId, input.projectNodeId, operatorName, businessDate)

  if (!input.completeAfterSave) {
    return {
      ok: true,
      message: saveResult.message,
      project: getProjectById(input.projectId),
      node: getProjectNodeRecordById(input.projectId, input.projectNodeId),
      nextNode: null,
    }
  }

  if (isProjectDecisionWorkItemCode(node.workItemTypeCode)) {
    const decisionValue =
      node.workItemTypeCode === 'FEASIBILITY_REVIEW'
        ? String(values.reviewConclusion || '').trim()
        : node.workItemTypeCode === 'SAMPLE_CONFIRM'
          ? String(values.confirmResult || '').trim()
          : String(values.conclusion || '').trim()
    const decisionNote =
      node.workItemTypeCode === 'FEASIBILITY_REVIEW'
        ? String(values.reviewRisk || '').trim()
        : node.workItemTypeCode === 'SAMPLE_CONFIRM'
          ? String(values.confirmNote || '').trim()
          : String(values.conclusionNote || '').trim()
    try {
      return completeDecisionNodeWithResult(
        input.projectId,
        input.projectNodeId,
        decisionValue as '通过' | '淘汰',
        operatorName,
        decisionNote,
        businessDate,
      )
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : '当前决策节点流转失败。',
        project: getProjectById(input.projectId),
        node: getProjectNodeRecordById(input.projectId, input.projectNodeId),
        nextNode: null,
      }
    }
  }

  const summaryNote = String(
    values.summaryText ||
      values.pricingNote ||
      values.costNote ||
      values.fitFeedback ||
      values.reviewRisk ||
      values.confirmNote ||
      values.returnResult ||
      values.retainNote ||
      `${node.workItemTypeName}已完成。`,
  ).trim()

  return markProjectNodeCompletedAndUnlockNext(input.projectId, input.projectNodeId, {
    operatorName,
    timestamp: businessDate,
    resultType: '节点完成',
    resultText: summaryNote || `${node.workItemTypeName}已完成。`,
  })
}
