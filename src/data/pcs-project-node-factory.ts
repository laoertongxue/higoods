import {
  getProjectStepDefinition,
  listProjectFlowStageContracts,
} from './pcs-project-domain-contract.ts'
import type { PcsProjectNodeRecord, PcsProjectPhaseRecord, ProjectNodeStatus } from './pcs-project-types.ts'


function buildPendingActionText(status: ProjectNodeStatus, stepDefinitionName: string): string {
  if (status === '已完成') return '节点已完成'
  if (status === '进行中') return `当前请处理：${stepDefinitionName}`
  if (status === '待确认') return `当前待确认：${stepDefinitionName}`
  if (status === '已取消') return '节点已取消'
  return '待开始执行'
}

function buildInitialNodeStatus(sequenceIndex: number, stepCode: string): ProjectNodeStatus {
  if (sequenceIndex === 0 && stepCode === 'PROJECT_INIT') return '进行中'
  return '未开始'
}

export function buildProjectPhases(input: {
  projectId: string
  ownerId: string
  ownerName: string
  createdAt: string
}): PcsProjectPhaseRecord[] {
  return listProjectFlowStageContracts().map((step, index) => ({
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

  return listProjectFlowStageContracts().flatMap((step) =>
    step.stepCodes.map((stepCode, stepIndex) => {
      const stepDefinition = getProjectStepDefinition(stepCode)
      const currentStatus = buildInitialNodeStatus(globalSequenceIndex, stepCode)
      const isProjectInit = stepCode === 'PROJECT_INIT'
      globalSequenceIndex += 1

      return {
        projectNodeId: `${input.projectId}-node-${step.stepCode}-${String(stepIndex + 1).padStart(2, '0')}`,
        projectId: input.projectId,
        phaseCode: step.phaseCode,
        phaseName: step.stepName,
        stepId: stepDefinition.stepId,
        stepCode: stepDefinition.stepCode,
        stepName: stepDefinition.stepName,
        sequenceNo: stepIndex + 1,
        requiredFlag: stepCode !== 'VIDEO_TEST',
        multiInstanceFlag: stepDefinition.capabilities.canMultiInstance,
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
        pendingActionText: buildPendingActionText(currentStatus, stepDefinition.stepName),
      }
    }),
  )
}
