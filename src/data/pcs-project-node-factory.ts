import {
  getProjectWorkItemContract,
  listProjectStepContracts,
} from './pcs-project-domain-contract.ts'
import type { ProjectTemplate } from './pcs-templates.ts'
import type { PcsProjectNodeRecord, PcsProjectPhaseRecord, ProjectNodeStatus } from './pcs-project-types.ts'

const FIXED_STEP_FLOW_VERSION = 'fixed-step-v1'

function buildPendingActionText(status: ProjectNodeStatus, workItemName: string): string {
  if (status === '已完成') return '节点已完成'
  if (status === '进行中') return `当前请处理：${workItemName}`
  if (status === '待确认') return `当前待确认：${workItemName}`
  if (status === '已取消') return '节点已取消'
  return '待开始执行'
}

function buildInitialNodeStatus(sequenceIndex: number, workItemTypeCode: string): ProjectNodeStatus {
  if (sequenceIndex === 0 && workItemTypeCode === 'PROJECT_INIT') return '进行中'
  return '未开始'
}

export function buildProjectPhases(input: {
  projectId: string
  ownerId: string
  ownerName: string
  createdAt: string
}): PcsProjectPhaseRecord[] {
  return listProjectStepContracts().map((step, index) => ({
    projectPhaseId: `${input.projectId}-phase-${String(step.sequence).padStart(2, '0')}`,
    projectId: input.projectId,
    phaseCode: step.phaseCode,
    phaseName: step.stepName,
    phaseOrder: step.sequence,
    phaseStatus: index === 0 ? '进行中' : '未开始',
    startedAt: index === 0 ? input.createdAt : '',
    finishedAt: '',
    ownerId: input.ownerId,
    ownerName: input.ownerName,
  }))
}

export function buildProjectNodes(input: {
  projectId: string
  ownerId: string
  ownerName: string
  createdAt: string
}): PcsProjectNodeRecord[] {
  let globalSequenceIndex = 0

  return listProjectStepContracts().flatMap((step) =>
    step.workItemCodes.map((workItemTypeCode, stepIndex) => {
      const workItem = getProjectWorkItemContract(workItemTypeCode)
      const currentStatus = buildInitialNodeStatus(globalSequenceIndex, workItemTypeCode)
      const isProjectInit = workItemTypeCode === 'PROJECT_INIT'
      globalSequenceIndex += 1

      return {
        projectNodeId: `${input.projectId}-node-${step.stepCode}-${String(stepIndex + 1).padStart(2, '0')}`,
        projectId: input.projectId,
        phaseCode: step.phaseCode,
        phaseName: step.stepName,
        workItemId: workItem.workItemId,
        workItemTypeCode: workItem.workItemTypeCode,
        workItemTypeName: workItem.workItemTypeName,
        sequenceNo: stepIndex + 1,
        requiredFlag: workItemTypeCode !== 'VIDEO_TEST',
        multiInstanceFlag: workItem.capabilities.canMultiInstance,
        currentStatus,
        currentOwnerId: input.ownerId,
        currentOwnerName: input.ownerName,
        validInstanceCount: 0,
        latestInstanceId: '',
        latestInstanceCode: '',
        latestResultType: isProjectInit ? '已创建项目' : '',
        latestResultText: isProjectInit ? '商品项目与商品／款式档案已建立，请补全立项信息。' : '',
        currentIssueType: '',
        currentIssueText: '',
        pendingActionType: '待执行',
        pendingActionText: buildPendingActionText(currentStatus, workItem.workItemTypeName),
        sourceTemplateNodeId: `${step.stepCode}-${String(stepIndex + 1).padStart(2, '0')}`,
        sourceTemplateVersion: FIXED_STEP_FLOW_VERSION,
      }
    }),
  )
}

// 兼容旧模块调用入口；模板参数不再参与项目运行时节点生成。
export function buildProjectPhaseRecordsFromTemplate(input: {
  projectId: string
  ownerId: string
  ownerName: string
  createdAt: string
  template: ProjectTemplate
}): PcsProjectPhaseRecord[] {
  return buildProjectPhases(input)
}

// 兼容旧模块调用入口；模板参数不再参与项目运行时节点生成。
export function buildProjectNodeRecordsFromTemplate(input: {
  projectId: string
  ownerId: string
  ownerName: string
  createdAt: string
  template: ProjectTemplate
}): PcsProjectNodeRecord[] {
  return buildProjectNodes(input)
}
