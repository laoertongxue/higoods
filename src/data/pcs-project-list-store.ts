import { getProjectStoreSnapshot } from './pcs-project-repository.ts'

export type ProjectListStyleType = '基础款' | '快时尚款' | '改版款' | '设计款'
export type ProjectListStatus = '已立项' | '进行中' | '已终止' | '已归档'
export type ProjectListRiskStatus = '正常' | '延期'
export type ProjectListNodeStatus = '未开始' | '进行中' | '待确认' | '已完成' | '已取消' | '-'

export interface PcsProjectListRecord {
  projectId: string
  projectCode: string
  projectName: string
  styleType: ProjectListStyleType
  categoryName: string
  subCategoryName: string
  styleTagNames: string[]
  targetChannelCodes: string[]
  projectStatus: ProjectListStatus
  currentPhaseName: string
  ownerName: string
  updatedAt: string
  progressDone: number
  progressTotal: number
  nextWorkItemName: string
  nextWorkItemStatus: ProjectListNodeStatus
  pendingDecisionFlag: boolean
  riskStatus: ProjectListRiskStatus
  riskReason: string
}

interface ProjectSnapshotRecord extends Omit<PcsProjectListRecord, 'progressDone' | 'progressTotal' | 'nextWorkItemName' | 'nextWorkItemStatus' | 'pendingDecisionFlag' | 'riskStatus' | 'riskReason'> {
  currentPhaseCode?: string
}

interface ProjectSnapshotNodeRecord {
  projectId: string
  projectNodeId: string
  phaseCode: string
  workItemTypeName: string
  currentStatus: Exclude<ProjectListNodeStatus, '-'>
  sequenceNo: number
  currentIssueType?: string
  currentIssueText?: string
  latestResultType?: string
  latestResultText?: string
  updatedAt?: string
  lastEventType?: string
  lastEventTime?: string
}

interface ProjectStoreSnapshot {
  version?: number
  projects?: ProjectSnapshotRecord[]
  nodes?: ProjectSnapshotNodeRecord[]
}

const CHANNEL_NAME_MAP: Record<string, string> = {
  'tiktok-shop': '抖音商城',
  shopee: '虾皮',
  lazada: '来赞达',
  'wechat-mini-program': '微信小程序',
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function parseDateValue(dateText: string | null | undefined): number | null {
  if (!dateText) return null
  const normalized = dateText.includes('T') ? dateText : dateText.replace(' ', 'T')
  const timestamp = Date.parse(normalized)
  return Number.isNaN(timestamp) ? null : timestamp
}

function getDurationDaysSince(dateText: string | null | undefined, endDateText = nowText()): number {
  const startTimestamp = parseDateValue(dateText)
  const endTimestamp = parseDateValue(endDateText)
  if (startTimestamp === null || endTimestamp === null || endTimestamp < startTimestamp) return 0
  return Math.ceil((endTimestamp - startTimestamp) / (24 * 60 * 60 * 1000))
}

function isClosedNodeStatus(status: ProjectListNodeStatus): boolean {
  return status === '已完成' || status === '已取消'
}

function getNodeActivityTime(node: ProjectSnapshotNodeRecord | null): string {
  if (!node) return ''
  return node.lastEventTime || node.updatedAt || ''
}

function isBlockingIssue(node: ProjectSnapshotNodeRecord | null): boolean {
  if (!node) return false
  return /阻塞|冻结|暂停/.test(`${node.currentIssueType || ''} ${node.currentIssueText || ''}`)
}

function getOrderedProjectNodes(snapshot: ProjectStoreSnapshot, projectId: string): ProjectSnapshotNodeRecord[] {
  return (snapshot.nodes || [])
    .filter((item) => item.projectId === projectId)
    .sort((a, b) => {
      if (a.phaseCode === b.phaseCode) return a.sequenceNo - b.sequenceNo
      return a.projectNodeId.localeCompare(b.projectNodeId)
    })
}

function getTerminationReason(nodes: ProjectSnapshotNodeRecord[]): string {
  const terminationNode = [...nodes]
    .sort((a, b) => getNodeActivityTime(b).localeCompare(getNodeActivityTime(a)))
    .find(
      (node) =>
        node.lastEventType === '项目终止' ||
        node.latestResultType === '项目终止' ||
        node.currentIssueType === '项目终止',
    )
  return terminationNode?.latestResultText || terminationNode?.currentIssueText || ''
}

function buildRuntimeRecord(project: ProjectSnapshotRecord, snapshot: ProjectStoreSnapshot): PcsProjectListRecord {
  const nodes = getOrderedProjectNodes(snapshot, project.projectId)
  const progressDone = nodes.filter((node) => node.currentStatus === '已完成').length
  const progressTotal = nodes.length
  const nextNode = nodes.find((node) => !isClosedNodeStatus(node.currentStatus)) ?? null
  const pendingDecisionNode = nodes.find((node) => node.currentStatus === '待确认') ?? null
  const blockingNode =
    nodes.find((node) => !isClosedNodeStatus(node.currentStatus) && isBlockingIssue(node)) ??
    nodes.find((node) => isBlockingIssue(node)) ??
    null
  const delayedPendingDecisionDays = pendingDecisionNode ? getDurationDaysSince(getNodeActivityTime(pendingDecisionNode)) : 0
  const blockingDurationDays = blockingNode ? getDurationDaysSince(getNodeActivityTime(blockingNode)) : 0
  const blockedFlag = project.projectStatus === '进行中' ? Boolean(blockingNode) : false
  const blockedReason =
    blockedFlag
      ? blockingNode?.currentIssueText || blockingNode?.latestResultText || ''
      : project.projectStatus === '已终止'
        ? getTerminationReason(nodes)
        : ''
  const delayedPendingDecision =
    Boolean(pendingDecisionNode) && !blockedFlag && delayedPendingDecisionDays >= 2 && project.projectStatus === '进行中'
  const riskStatus: ProjectListRiskStatus = blockingDurationDays >= 2 || delayedPendingDecision ? '延期' : '正常'
  const riskReason = blockedFlag
    ? blockedReason
    : delayedPendingDecision && pendingDecisionNode
      ? `${pendingDecisionNode.workItemTypeName}已停留 ${delayedPendingDecisionDays} 天未判定，当前节点仍待确认。`
      : ''

  return {
    projectId: project.projectId,
    projectCode: project.projectCode,
    projectName: project.projectName,
    styleType: project.styleType,
    categoryName: project.categoryName,
    subCategoryName: project.subCategoryName,
    styleTagNames: [...(project.styleTagNames || [])],
    targetChannelCodes: [...(project.targetChannelCodes || [])],
    projectStatus: project.projectStatus,
    currentPhaseName: project.currentPhaseName || '-',
    ownerName: project.ownerName || '-',
    updatedAt: project.updatedAt || '',
    progressDone,
    progressTotal,
    nextWorkItemName: nextNode?.workItemTypeName ?? '-',
    nextWorkItemStatus: nextNode?.currentStatus ?? '-',
    pendingDecisionFlag: Boolean(pendingDecisionNode),
    riskStatus,
    riskReason,
  }
}

function readMergedSnapshot(): ProjectStoreSnapshot | null {
  try {
    const snapshot = getProjectStoreSnapshot()
    if (Array.isArray(snapshot.projects) && Array.isArray(snapshot.nodes)) {
      return snapshot as unknown as ProjectStoreSnapshot
    }
  } catch {
    return null
  }
  return null
}

export function getChannelNamesByCodes(channelCodes: string[]): string[] {
  return channelCodes.map((code) => CHANNEL_NAME_MAP[code] || code)
}

export function listProjectListRecords(): PcsProjectListRecord[] {
  const snapshot = readMergedSnapshot()
  if (snapshot?.projects && snapshot.projects.length > 0) {
    return snapshot.projects.map((project) => buildRuntimeRecord(project, snapshot))
  }
  return []
}
