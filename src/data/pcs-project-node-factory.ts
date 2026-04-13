import { getProjectTemplateVersion, type ProjectTemplate } from './pcs-templates.ts'
import { getPcsWorkItemDefinition } from './pcs-work-items.ts'
import type { PcsProjectNodeRecord, PcsProjectPhaseRecord, ProjectNodeStatus } from './pcs-project-types.ts'

function buildPendingActionText(status: ProjectNodeStatus, workItemName: string): string {
  if (status === '已完成') return '节点已完成'
  if (status === '进行中') return `当前请处理：${workItemName}`
  if (status === '待确认') return `当前待确认：${workItemName}`
  if (status === '已取消') return '节点已取消'
  return '待开始执行'
}

function buildInitialNodeStatus(sequenceIndex: number): ProjectNodeStatus {
  if (sequenceIndex === 0) return '进行中'
  return '未开始'
}

export function buildProjectPhaseRecordsFromTemplate(input: {
  projectId: string
  ownerId: string
  ownerName: string
  createdAt: string
  template: ProjectTemplate
}): PcsProjectPhaseRecord[] {
  return input.template.stages
    .slice()
    .sort((a, b) => a.phaseOrder - b.phaseOrder)
    .map((stage, index) => ({
      projectPhaseId: `${input.projectId}-phase-${String(stage.phaseOrder).padStart(2, '0')}`,
      projectId: input.projectId,
      phaseCode: stage.phaseCode,
      phaseName: stage.phaseName,
      phaseOrder: stage.phaseOrder,
      phaseStatus: index === 0 ? '进行中' : '未开始',
      startedAt: index === 0 ? input.createdAt : '',
      finishedAt: '',
      ownerId: input.ownerId,
      ownerName: input.ownerName,
    }))
}

export function buildProjectNodeRecordsFromTemplate(input: {
  projectId: string
  ownerId: string
  ownerName: string
  createdAt: string
  template: ProjectTemplate
}): PcsProjectNodeRecord[] {
  const templateVersion = getProjectTemplateVersion(input.template)
  const orderedNodes = input.template.nodes
    .filter((node) => node.enabledFlag !== false)
    .slice()
    .sort((a, b) => {
      if (a.phaseCode === b.phaseCode) return a.sequenceNo - b.sequenceNo
      return a.phaseCode.localeCompare(b.phaseCode)
    })

  return orderedNodes.map((node, index) => {
    const workItem = getPcsWorkItemDefinition(node.workItemId)
    const currentStatus = buildInitialNodeStatus(index)
    const latestCompleted = currentStatus === '已完成'

    return {
      projectNodeId: `${input.projectId}-node-${node.phaseCode}-${String(node.sequenceNo).padStart(2, '0')}`,
      projectId: input.projectId,
      phaseCode: node.phaseCode,
      phaseName: node.phaseName,
      workItemId: node.workItemId,
      workItemTypeCode: node.workItemTypeCode,
      workItemTypeName: node.workItemTypeName,
      sequenceNo: node.sequenceNo,
      requiredFlag: node.requiredFlag,
      multiInstanceFlag:
        workItem?.capabilities.canMultiInstance === false ? false : node.multiInstanceFlag,
      currentStatus,
      currentOwnerId: input.ownerId,
      currentOwnerName: input.ownerName,
      validInstanceCount: latestCompleted ? 1 : 0,
      latestInstanceId: latestCompleted ? `${input.projectId}-instance-001` : '',
      latestInstanceCode: latestCompleted ? `${input.projectId}-实例-001` : '',
      latestResultType: latestCompleted ? '节点完成' : '',
      latestResultText: latestCompleted ? `${node.workItemTypeName}已完成。` : '',
      currentIssueType: '',
      currentIssueText: '',
      pendingActionType: currentStatus === '待确认' ? '待确认' : currentStatus === '已取消' ? '已取消' : '待执行',
      pendingActionText: buildPendingActionText(currentStatus, node.workItemTypeName),
      sourceTemplateNodeId: node.templateNodeId,
      sourceTemplateVersion: node.templateVersion || templateVersion,
    }
  })
}
