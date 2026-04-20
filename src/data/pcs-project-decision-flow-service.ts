import {
  getProjectById,
  getProjectNodeRecordById,
  listProjectNodes,
  listProjectPhases,
  updateProjectNodeRecord,
  updateProjectPhaseRecord,
  updateProjectRecord,
} from './pcs-project-repository.ts'
import { syncProjectNodeInstanceRuntime } from './pcs-project-node-instance-registry.ts'
import { validateProjectNodeCompletion } from './pcs-project-data-consistency.ts'
import type { PcsProjectNodeRecord, PcsProjectViewRecord, ProjectNodeStatus } from './pcs-project-types.ts'

const DECISION_WORK_ITEM_CODES = ['FEASIBILITY_REVIEW', 'SAMPLE_CONFIRM', 'TEST_CONCLUSION'] as const
const DECISION_RESULT_OPTIONS = ['通过', '淘汰'] as const

export type ProjectDecisionWorkItemCode = (typeof DECISION_WORK_ITEM_CODES)[number]
export type ProjectDecisionResult = (typeof DECISION_RESULT_OPTIONS)[number]

export interface ProjectDecisionFlowResult {
  ok: boolean
  message: string
  project: PcsProjectViewRecord | null
  node: PcsProjectNodeRecord | null
  nextNode: PcsProjectNodeRecord | null
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function isClosedProjectNodeStatus(status: ProjectNodeStatus): boolean {
  return status === '已完成' || status === '已取消'
}

function buildResultText(nodeName: string, result: ProjectDecisionResult, note: string): string {
  return note.trim() || `${nodeName}已判定为${result}。`
}

function syncProjectLifecycleAfterDecision(
  projectId: string,
  operatorName: string,
  timestamp: string,
): ProjectDecisionFlowResult {
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
    let phaseStatus: (typeof phase.phaseStatus) = '未开始'
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

export function isProjectDecisionWorkItemCode(workItemTypeCode: string): workItemTypeCode is ProjectDecisionWorkItemCode {
  return (DECISION_WORK_ITEM_CODES as readonly string[]).includes(workItemTypeCode)
}

function assertDecisionResult(result: string): asserts result is ProjectDecisionResult {
  if (!(DECISION_RESULT_OPTIONS as readonly string[]).includes(result)) {
    throw new Error('决策结果只能是通过或淘汰')
  }
}

export function advanceDecisionNodePassed(
  projectId: string,
  projectNodeId: string,
  operatorName = '当前用户',
  note = '',
  timestamp = nowText(),
): ProjectDecisionFlowResult {
  const node = getProjectNodeRecordById(projectId, projectNodeId)
  if (!node) {
    throw new Error('未找到对应决策节点，不能执行通过流转。')
  }
  const validation = validateProjectNodeCompletion(projectId, projectNodeId)
  if (!validation.ok) {
    return {
      ok: false,
      message: validation.message,
      project: validation.project,
      node: validation.node,
      nextNode: null,
    }
  }

  const nodes = listProjectNodes(projectId)
  const currentIndex = nodes.findIndex((item) => item.projectNodeId === projectNodeId)
  const nextNode = nodes.slice(currentIndex + 1).find((item) => item.currentStatus === '未开始') ?? null
  const resultText = buildResultText(node.workItemTypeName, '通过', note)

  updateProjectNodeRecord(
    projectId,
    projectNodeId,
    {
      currentStatus: '已完成',
      latestResultType: '通过',
      latestResultText: resultText,
      pendingActionType: '已完成',
      pendingActionText: '当前决策已完成',
      updatedAt: timestamp,
      lastEventType: '通过',
      lastEventTime: timestamp,
    },
    operatorName,
  )
  syncProjectNodeInstanceRuntime(projectId, projectNodeId, operatorName, timestamp)

  if (nextNode) {
    updateProjectNodeRecord(
      projectId,
      nextNode.projectNodeId,
      {
        currentStatus: '进行中',
        pendingActionType: '待执行',
        pendingActionText: `当前请处理：${nextNode.workItemTypeName}`,
        updatedAt: timestamp,
      },
      operatorName,
    )
  }

  syncProjectLifecycleAfterDecision(projectId, operatorName, timestamp)

  return {
    ok: true,
    message: '当前工作项已完成，已进入下一工作项',
    project: getProjectById(projectId),
    node: getProjectNodeRecordById(projectId, projectNodeId),
    nextNode: nextNode ? getProjectNodeRecordById(projectId, nextNode.projectNodeId) : null,
  }
}

export function routeProjectToSampleReturnHandle(
  projectId: string,
  decisionNodeId: string,
  operatorName = '当前用户',
  note = '',
  timestamp = nowText(),
): ProjectDecisionFlowResult {
  const decisionNode = getProjectNodeRecordById(projectId, decisionNodeId)
  if (!decisionNode) {
    throw new Error('未找到对应决策节点，不能执行淘汰流转。')
  }
  const validation = validateProjectNodeCompletion(projectId, decisionNodeId)
  if (!validation.ok) {
    return {
      ok: false,
      message: validation.message,
      project: validation.project,
      node: validation.node,
      nextNode: null,
    }
  }

  const nodes = listProjectNodes(projectId)
  const sampleReturnNodes = nodes.filter((item) => item.workItemTypeCode === 'SAMPLE_RETURN_HANDLE')
  if (sampleReturnNodes.length !== 1) {
    throw new Error('当前项目缺少样衣退回处理工作项，请先修复项目模板或项目节点')
  }
  const sampleReturnNode = sampleReturnNodes[0]
  const resultText = buildResultText(decisionNode.workItemTypeName, '淘汰', note)

  updateProjectNodeRecord(
    projectId,
    decisionNodeId,
    {
      currentStatus: '已完成',
      latestResultType: '淘汰',
      latestResultText: resultText,
      pendingActionType: '已完成',
      pendingActionText: '当前决策已完成',
      updatedAt: timestamp,
      lastEventType: '淘汰',
      lastEventTime: timestamp,
    },
    operatorName,
  )
  syncProjectNodeInstanceRuntime(projectId, decisionNodeId, operatorName, timestamp)

  const decisionIndex = nodes.findIndex((item) => item.projectNodeId === decisionNodeId)
  const sampleReturnIndex = nodes.findIndex((item) => item.projectNodeId === sampleReturnNode.projectNodeId)
  nodes.forEach((node, index) => {
    if (node.projectNodeId === decisionNodeId || node.projectNodeId === sampleReturnNode.projectNodeId) return
    if (index <= decisionIndex) return
    if (sampleReturnIndex >= 0 && index >= sampleReturnIndex) return
    if (isClosedProjectNodeStatus(node.currentStatus)) return
    updateProjectNodeRecord(
      projectId,
      node.projectNodeId,
      {
        currentStatus: '已取消',
        latestResultType: '淘汰跳过',
        latestResultText: note.trim() || '前序决策结果为淘汰，当前节点不再执行。',
        pendingActionType: '已取消',
        pendingActionText: '已进入样衣退回处理',
        updatedAt: timestamp,
        lastEventType: '淘汰跳过',
        lastEventTime: timestamp,
      },
      operatorName,
    )
    syncProjectNodeInstanceRuntime(projectId, node.projectNodeId, operatorName, timestamp)
  })

  updateProjectNodeRecord(
    projectId,
    sampleReturnNode.projectNodeId,
    {
      currentStatus: '进行中',
      latestResultType: '待样衣退回处理',
      latestResultText: note.trim() || '决策结果为淘汰，已进入样衣退回处理。',
      pendingActionType: '样衣退回处理',
      pendingActionText: '请完成样衣退回处理',
      updatedAt: timestamp,
    },
    operatorName,
  )
  syncProjectNodeInstanceRuntime(projectId, sampleReturnNode.projectNodeId, operatorName, timestamp)

  syncProjectLifecycleAfterDecision(projectId, operatorName, timestamp)
  updateProjectRecord(projectId, { projectStatus: '进行中', updatedAt: timestamp }, operatorName)

  return {
    ok: true,
    message: '当前工作项已完成，已进入样衣退回处理',
    project: getProjectById(projectId),
    node: getProjectNodeRecordById(projectId, decisionNodeId),
    nextNode: getProjectNodeRecordById(projectId, sampleReturnNode.projectNodeId),
  }
}

export function advanceDecisionNodeEliminated(
  projectId: string,
  projectNodeId: string,
  operatorName = '当前用户',
  note = '',
  timestamp = nowText(),
): ProjectDecisionFlowResult {
  return routeProjectToSampleReturnHandle(projectId, projectNodeId, operatorName, note, timestamp)
}

export function completeDecisionNodeWithResult(
  projectId: string,
  projectNodeId: string,
  result: ProjectDecisionResult,
  operatorName = '当前用户',
  note = '',
  timestamp = nowText(),
): ProjectDecisionFlowResult {
  assertDecisionResult(result)
  const node = getProjectNodeRecordById(projectId, projectNodeId)
  if (!node) {
    throw new Error('未找到对应决策节点，不能完成当前决策。')
  }
  if (!isProjectDecisionWorkItemCode(node.workItemTypeCode)) {
    throw new Error('当前节点不是决策工作项，不能使用决策流转服务。')
  }
  if (result === '通过') {
    return advanceDecisionNodePassed(projectId, projectNodeId, operatorName, note, timestamp)
  }
  return advanceDecisionNodeEliminated(projectId, projectNodeId, operatorName, note, timestamp)
}
