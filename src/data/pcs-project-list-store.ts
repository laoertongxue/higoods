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

const PROJECT_STORAGE_KEY = 'higood-pcs-project-store-v2'

const CHANNEL_NAME_MAP: Record<string, string> = {
  'tiktok-shop': '抖音商城',
  shopee: '虾皮',
  lazada: '来赞达',
  'wechat-mini-program': '微信小程序',
}

const FALLBACK_PROJECTS: PcsProjectListRecord[] = [
  { projectId: 'prj_20251216_015', projectCode: 'PRJ-20251216-015', projectName: '设计款中式结饰上衣', styleType: '设计款', categoryName: '上衣', subCategoryName: '上衣', styleTagNames: ['中式', '优雅'], targetChannelCodes: ['tiktok-shop', 'shopee'], projectStatus: '进行中', currentPhaseName: '款式档案与开发推进', ownerName: '李娜', updatedAt: '2026-04-06 14:40', progressDone: 13, progressTotal: 21, nextWorkItemName: '改版任务', nextWorkItemStatus: '进行中', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_025', projectCode: 'PRJ-20251216-025', projectName: '改版针织背心样衣退回处理', styleType: '改版款', categoryName: '马甲', subCategoryName: '马甲', styleTagNames: ['通勤', '复古'], targetChannelCodes: ['tiktok-shop', 'shopee'], projectStatus: '进行中', currentPhaseName: '项目收尾', ownerName: '赵云', updatedAt: '2026-04-06 09:50', progressDone: 8, progressTotal: 14, nextWorkItemName: '样衣退回处理', nextWorkItemStatus: '进行中', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_024', projectCode: 'PRJ-20251216-024', projectName: '快反居家套装样衣退回处理', styleType: '快时尚款', categoryName: '套装', subCategoryName: '居家套装', styleTagNames: ['休闲', '甜美'], targetChannelCodes: ['wechat-mini-program', 'tiktok-shop'], projectStatus: '进行中', currentPhaseName: '项目收尾', ownerName: '王明', updatedAt: '2026-04-05 16:20', progressDone: 9, progressTotal: 15, nextWorkItemName: '样衣退回处理', nextWorkItemStatus: '进行中', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_023', projectCode: 'PRJ-20251216-023', projectName: '基础款男装休闲夹克样衣退回处理', styleType: '基础款', categoryName: '外套', subCategoryName: '夹克', styleTagNames: ['休闲', '街头'], targetChannelCodes: ['tiktok-shop', 'shopee'], projectStatus: '进行中', currentPhaseName: '项目收尾', ownerName: '张丽', updatedAt: '2026-04-05 11:10', progressDone: 12, progressTotal: 20, nextWorkItemName: '样衣退回处理', nextWorkItemStatus: '进行中', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_014', projectCode: 'PRJ-20251216-014', projectName: '快反商务修身长袖衬衫', styleType: '快时尚款', categoryName: '上衣', subCategoryName: '衬衫', styleTagNames: ['通勤', '优雅'], targetChannelCodes: ['tiktok-shop', 'wechat-mini-program'], projectStatus: '进行中', currentPhaseName: '款式档案与开发推进', ownerName: '王明', updatedAt: '2026-04-05 10:50', progressDone: 11, progressTotal: 15, nextWorkItemName: '改版任务', nextWorkItemStatus: '进行中', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_013', projectCode: 'PRJ-20251216-013', projectName: '设计款户外轻量夹克', styleType: '设计款', categoryName: '外套', subCategoryName: '夹克', styleTagNames: ['秀场', '优雅'], targetChannelCodes: ['tiktok-shop', 'shopee'], projectStatus: '进行中', currentPhaseName: '款式档案与开发推进', ownerName: '李娜', updatedAt: '2026-04-04 16:10', progressDone: 13, progressTotal: 21, nextWorkItemName: '改版任务', nextWorkItemStatus: '进行中', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_022', projectCode: 'PRJ-20251216-022', projectName: '设计款民族印花半裙待确认', styleType: '设计款', categoryName: '半裙', subCategoryName: '半裙', styleTagNames: ['碎花', '秀场'], targetChannelCodes: ['tiktok-shop', 'shopee'], projectStatus: '进行中', currentPhaseName: '商品上架与市场测款', ownerName: '李娜', updatedAt: '2026-04-04 15:30', progressDone: 11, progressTotal: 21, nextWorkItemName: '测款结论判定', nextWorkItemStatus: '待确认', pendingDecisionFlag: true, riskStatus: '正常', riskReason: '历史测款结论待重新确认，请重新选择通过或淘汰。' },
  { projectId: 'prj_20251216_021', projectCode: 'PRJ-20251216-021', projectName: '改版都市西装马甲待确认', styleType: '改版款', categoryName: '马甲', subCategoryName: '马甲', styleTagNames: ['通勤', '复古'], targetChannelCodes: ['tiktok-shop', 'shopee'], projectStatus: '进行中', currentPhaseName: '商品上架与市场测款', ownerName: '赵云', updatedAt: '2026-04-04 09:40', progressDone: 8, progressTotal: 14, nextWorkItemName: '测款结论判定', nextWorkItemStatus: '待确认', pendingDecisionFlag: true, riskStatus: '正常', riskReason: '历史测款结论待重新确认，请重新选择通过或淘汰。' },
  { projectId: 'prj_20251216_011', projectCode: 'PRJ-20251216-011', projectName: '基础轻甜印花连衣裙', styleType: '基础款', categoryName: '连衣裙', subCategoryName: '连衣裙', styleTagNames: ['休闲', '甜美'], targetChannelCodes: ['tiktok-shop', 'shopee'], projectStatus: '进行中', currentPhaseName: '款式档案与开发推进', ownerName: '张丽', updatedAt: '2026-04-03 15:20', progressDone: 14, progressTotal: 20, nextWorkItemName: '改版任务', nextWorkItemStatus: '进行中', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_020', projectCode: 'PRJ-20251216-020', projectName: '快反POLO衫待确认', styleType: '快时尚款', categoryName: '上衣', subCategoryName: 'POLO衫', styleTagNames: ['休闲', '通勤'], targetChannelCodes: ['tiktok-shop', 'wechat-mini-program'], projectStatus: '进行中', currentPhaseName: '商品上架与市场测款', ownerName: '王明', updatedAt: '2026-04-03 13:10', progressDone: 9, progressTotal: 15, nextWorkItemName: '测款结论判定', nextWorkItemStatus: '待确认', pendingDecisionFlag: true, riskStatus: '正常', riskReason: '历史测款结论待重新确认，请重新选择通过或淘汰。' },
  { projectId: 'prj_20251216_012', projectCode: 'PRJ-20251216-012', projectName: '快反撞色卫衣套装', styleType: '快时尚款', categoryName: '套装', subCategoryName: '卫衣套装', styleTagNames: ['休闲', '通勤'], targetChannelCodes: ['tiktok-shop', 'wechat-mini-program'], projectStatus: '进行中', currentPhaseName: '款式档案与开发推进', ownerName: '王明', updatedAt: '2026-04-02 11:00', progressDone: 11, progressTotal: 15, nextWorkItemName: '改版任务', nextWorkItemStatus: '进行中', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_019', projectCode: 'PRJ-20251216-019', projectName: '基础款针织开衫待确认', styleType: '基础款', categoryName: '开衫', subCategoryName: '开衫', styleTagNames: ['休闲', '通勤'], targetChannelCodes: ['wechat-mini-program', 'tiktok-shop'], projectStatus: '进行中', currentPhaseName: '商品上架与市场测款', ownerName: '张丽', updatedAt: '2026-04-02 10:30', progressDone: 12, progressTotal: 20, nextWorkItemName: '测款结论判定', nextWorkItemStatus: '待确认', pendingDecisionFlag: true, riskStatus: '正常', riskReason: '历史测款结论待重新确认，请重新选择通过或淘汰。' },
  { projectId: 'prj_20251216_018', projectCode: 'PRJ-20251216-018', projectName: '设计款印花阔腿连体裤改版', styleType: '设计款', categoryName: '连体裤', subCategoryName: '连体裤', styleTagNames: ['秀场', '碎花'], targetChannelCodes: ['tiktok-shop'], projectStatus: '进行中', currentPhaseName: '款式档案与开发推进', ownerName: '李娜', updatedAt: '2026-04-01 18:20', progressDone: 16, progressTotal: 21, nextWorkItemName: '花型任务', nextWorkItemStatus: '进行中', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_017', projectCode: 'PRJ-20251216-017', projectName: '改版牛仔机车短外套', styleType: '改版款', categoryName: '外套', subCategoryName: '夹克', styleTagNames: ['复古', '街头'], targetChannelCodes: ['tiktok-shop', 'shopee'], projectStatus: '进行中', currentPhaseName: '款式档案与开发推进', ownerName: '赵云', updatedAt: '2026-03-31 17:20', progressDone: 12, progressTotal: 14, nextWorkItemName: '首版样衣打样', nextWorkItemStatus: '进行中', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_016', projectCode: 'PRJ-20251216-016', projectName: '基础款波点雪纺连衣裙改版', styleType: '基础款', categoryName: '连衣裙', subCategoryName: '连衣裙', styleTagNames: ['甜美', '碎花'], targetChannelCodes: ['tiktok-shop', 'shopee'], projectStatus: '进行中', currentPhaseName: '款式档案与开发推进', ownerName: '张丽', updatedAt: '2026-03-29 18:10', progressDone: 16, progressTotal: 20, nextWorkItemName: '制版任务', nextWorkItemStatus: '进行中', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_001', projectCode: 'PRJ-20251216-001', projectName: '印尼风格碎花连衣裙', styleType: '基础款', categoryName: '连衣裙', subCategoryName: '连衣裙', styleTagNames: ['休闲', '甜美'], targetChannelCodes: ['tiktok-shop', 'shopee'], projectStatus: '进行中', currentPhaseName: '款式档案与开发推进', ownerName: '张丽', updatedAt: '2025-12-16 14:30', progressDone: 13, progressTotal: 20, nextWorkItemName: '生成款式档案', nextWorkItemStatus: '未开始', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_002', projectCode: 'PRJ-20251216-002', projectName: '百搭纯色基础短袖', styleType: '快时尚款', categoryName: '上衣', subCategoryName: 'T恤', styleTagNames: ['通勤'], targetChannelCodes: ['tiktok-shop', 'wechat-mini-program'], projectStatus: '进行中', currentPhaseName: '款式档案与开发推进', ownerName: '王明', updatedAt: '2025-12-16 12:00', progressDone: 13, progressTotal: 15, nextWorkItemName: '制版任务', nextWorkItemStatus: '进行中', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_010', projectCode: 'PRJ-20251216-010', projectName: '波西米亚印花长裙', styleType: '设计款', categoryName: '中长裙', subCategoryName: '长裙', styleTagNames: ['度假', '复古'], targetChannelCodes: ['lazada'], projectStatus: '已立项', currentPhaseName: '立项获取', ownerName: '周芳', updatedAt: '2025-12-16 09:00', progressDone: 0, progressTotal: 21, nextWorkItemName: '商品项目立项', nextWorkItemStatus: '进行中', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_003', projectCode: 'PRJ-20251216-003', projectName: '夏日休闲牛仔短裤', styleType: '设计款', categoryName: '裤子', subCategoryName: '短裤', styleTagNames: ['休闲'], targetChannelCodes: ['tiktok-shop'], projectStatus: '进行中', currentPhaseName: '样衣与评估', ownerName: '李娜', updatedAt: '2025-12-15 18:45', progressDone: 4, progressTotal: 21, nextWorkItemName: '样衣确认', nextWorkItemStatus: '待确认', pendingDecisionFlag: true, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_004', projectCode: 'PRJ-20251216-004', projectName: '复古皮质机车夹克', styleType: '改版款', categoryName: '外套', subCategoryName: '夹克', styleTagNames: ['复古', '街头'], targetChannelCodes: ['tiktok-shop', 'shopee'], projectStatus: '已立项', currentPhaseName: '样衣与评估', ownerName: '赵云', updatedAt: '2025-12-15 16:20', progressDone: 3, progressTotal: 14, nextWorkItemName: '样衣确认', nextWorkItemStatus: '待确认', pendingDecisionFlag: true, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_005', projectCode: 'PRJ-20251216-005', projectName: '法式优雅衬衫连衣裙', styleType: '设计款', categoryName: '连衣裙', subCategoryName: '连衣裙', styleTagNames: ['优雅', '通勤'], targetChannelCodes: ['tiktok-shop', 'lazada'], projectStatus: '进行中', currentPhaseName: '商品上架与市场测款', ownerName: '周芳', updatedAt: '2025-12-15 14:10', progressDone: 9, progressTotal: 21, nextWorkItemName: '直播测款', nextWorkItemStatus: '进行中', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_006', projectCode: 'PRJ-20251216-006', projectName: '运动休闲卫衣套装', styleType: '快时尚款', categoryName: '套装', subCategoryName: '运动套装', styleTagNames: ['休闲'], targetChannelCodes: ['tiktok-shop', 'shopee'], projectStatus: '进行中', currentPhaseName: '款式档案与开发推进', ownerName: '陈刚', updatedAt: '2025-12-14 20:30', progressDone: 13, progressTotal: 15, nextWorkItemName: '制版任务', nextWorkItemStatus: '进行中', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_009', projectCode: 'PRJ-20251216-009', projectName: '高腰阔腿牛仔裤', styleType: '基础款', categoryName: '裤子', subCategoryName: '长裤', styleTagNames: ['休闲'], targetChannelCodes: ['tiktok-shop'], projectStatus: '进行中', currentPhaseName: '样衣与评估', ownerName: '李娜', updatedAt: '2025-12-14 11:20', progressDone: 4, progressTotal: 20, nextWorkItemName: '样衣拍摄与试穿', nextWorkItemStatus: '进行中', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_007', projectCode: 'PRJ-20251216-007', projectName: '碎花雪纺半身裙', styleType: '基础款', categoryName: '连衣裙', subCategoryName: '半身裙', styleTagNames: ['甜美'], targetChannelCodes: ['shopee'], projectStatus: '已归档', currentPhaseName: '项目收尾', ownerName: '张丽', updatedAt: '2025-12-10 10:00', progressDone: 20, progressTotal: 20, nextWorkItemName: '-', nextWorkItemStatus: '-', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
  { projectId: 'prj_20251216_008', projectCode: 'PRJ-20251216-008', projectName: '商务休闲西装外套', styleType: '改版款', categoryName: '外套', subCategoryName: '西装', styleTagNames: ['通勤'], targetChannelCodes: ['wechat-mini-program'], projectStatus: '已终止', currentPhaseName: '样衣与评估', ownerName: '王明', updatedAt: '2025-12-08 15:00', progressDone: 4, progressTotal: 14, nextWorkItemName: '-', nextWorkItemStatus: '-', pendingDecisionFlag: false, riskStatus: '正常', riskReason: '' },
]

function cloneProjectListRecord(record: PcsProjectListRecord): PcsProjectListRecord {
  return {
    ...record,
    styleTagNames: [...record.styleTagNames],
    targetChannelCodes: [...record.targetChannelCodes],
  }
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

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function readSnapshot(): ProjectStoreSnapshot | null {
  if (!canUseStorage()) return null
  try {
    const raw = localStorage.getItem(PROJECT_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ProjectStoreSnapshot
    if (!Array.isArray(parsed.projects) || !Array.isArray(parsed.nodes)) return null
    return parsed
  } catch {
    return null
  }
}

function readMergedSnapshot(): ProjectStoreSnapshot | null {
  try {
    const snapshot = getProjectStoreSnapshot()
    if (Array.isArray(snapshot.projects) && Array.isArray(snapshot.nodes)) {
      return snapshot as unknown as ProjectStoreSnapshot
    }
  } catch {
    return readSnapshot()
  }
  return readSnapshot()
}

export function getChannelNamesByCodes(channelCodes: string[]): string[] {
  return channelCodes.map((code) => CHANNEL_NAME_MAP[code] || code)
}

export function listProjectListRecords(): PcsProjectListRecord[] {
  const snapshot = readMergedSnapshot()
  if (snapshot?.projects && snapshot.projects.length > 0) {
    return snapshot.projects.map((project) => buildRuntimeRecord(project, snapshot))
  }
  return FALLBACK_PROJECTS.map(cloneProjectListRecord)
}
