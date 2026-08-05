import {
  createEngineeringChangeTask,
  getEngineeringChangeTaskById,
  getEngineeringMasterOrderById,
  getEngineeringMasterOrderStoreSnapshot,
} from './pcs-engineering-master-repository'
import {
  createTechnicalDataVersionDraft,
  getCurrentTechPackVersionByStyleId,
  getNextStyleVersionMeta,
  getNextTechnicalVersionIdentity,
  getTechnicalDataVersionById,
  getTechnicalDataVersionContent,
} from './pcs-technical-data-version-repository'
import type { EngineeringChangeTaskRecord } from './pcs-engineering-master-types'
import type { PcsEngineeringCurrentUser } from './pcs-engineering-current-user'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
  TechnicalModuleKey,
} from './pcs-technical-data-version-types'

const STORAGE_KEY = 'higood:pcs:engineering-change-workspace:v1'
let memoryWorkspaces: EngineeringChangeWorkspaceRecord[] = []

export interface EngineeringChangeTaskLine {
  lineId: string
  taskType: string
  taskName: string
  ownerName: string
  status: '待开始' | '进行中' | '已完成'
  startedAt: string
  resultSummary: string
  submittedAt: string
  completedAt: string
}

export interface EngineeringChangeWorkspaceRecord {
  engineeringChangeTaskId: string
  currentTechnicalVersionId: string
  currentTechnicalVersionCode: string
  changeReason: string
  affectedModules: TechnicalModuleKey[]
  ownerName: string
  taskLines: EngineeringChangeTaskLine[]
  newTechnicalVersionId: string
  newTechnicalVersionCode: string
  updatedAt: string
}

export interface EngineeringChangeWorkspaceView {
  change: EngineeringChangeTaskRecord
  workspace: EngineeringChangeWorkspaceRecord
  sourceMasterStatus: string
  allTasksCompleted: boolean
  effectiveStatus: '进行中' | '待发布' | '已完成'
}

const MODULE_TASK_NAME: Record<TechnicalModuleKey, string> = {
  BOM: 'BOM 与价格修订',
  COST: 'BOM 与价格修订',
  PATTERN: '制版任务',
  MATERIAL_PATTERN_LINK: '花型任务',
  COLOR_MATERIAL_MAPPING: '调色任务',
  PROCESS: '工艺资料修订',
  SIZE: '尺码资料修订',
  DESIGN: '设计资料修订',
  ATTACHMENT: '附件资料修订',
  QUALITY: '质量要求修订',
}

function nowText(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneWorkspace(item: EngineeringChangeWorkspaceRecord): EngineeringChangeWorkspaceRecord {
  return {
    ...item,
    affectedModules: [...item.affectedModules],
    taskLines: item.taskLines.map((line) => ({
      ...line,
      taskType: line.taskType || line.taskName,
      startedAt: line.startedAt || '',
      resultSummary: line.resultSummary || '',
      submittedAt: line.submittedAt || line.completedAt || '',
    })),
  }
}

function readAll(): EngineeringChangeWorkspaceRecord[] {
  if (!canUseStorage()) return memoryWorkspaces.map(cloneWorkspace)
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as EngineeringChangeWorkspaceRecord[]
    return Array.isArray(parsed) ? parsed.map(cloneWorkspace) : []
  } catch {
    return []
  }
}

function writeAll(items: EngineeringChangeWorkspaceRecord[]): void {
  memoryWorkspaces = items.map(cloneWorkspace)
  if (canUseStorage()) localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
}

function upsertWorkspace(record: EngineeringChangeWorkspaceRecord): void {
  writeAll([record, ...readAll().filter((item) => item.engineeringChangeTaskId !== record.engineeringChangeTaskId)])
}

function getWorkspace(changeId: string): EngineeringChangeWorkspaceRecord | null {
  return readAll().find((item) => item.engineeringChangeTaskId === changeId) || null
}

function buildTaskLines(changeId: string, modules: TechnicalModuleKey[], ownerName: string): EngineeringChangeTaskLine[] {
  const names = [...new Set(modules.map((module) => MODULE_TASK_NAME[module]))]
  return names.map((taskName, index) => ({
    lineId: `${changeId}-TASK-${String(index + 1).padStart(2, '0')}`,
    taskType: taskName,
    taskName,
    ownerName,
    status: '待开始',
    startedAt: '',
    resultSummary: '',
    submittedAt: '',
    completedAt: '',
  }))
}

export function listEngineeringChangeWorkspaceViews(): EngineeringChangeWorkspaceView[] {
  const workspaces = new Map(readAll().map((item) => [item.engineeringChangeTaskId, item]))
  return (getEngineeringMasterOrderStoreSnapshot().changeTasks || [])
    .map((change) => {
      const workspace = workspaces.get(change.engineeringChangeTaskId)
      if (!workspace) return null
      const newVersion = workspace.newTechnicalVersionId ? getTechnicalDataVersionById(workspace.newTechnicalVersionId) : null
      return {
        change,
        workspace: cloneWorkspace(workspace),
        sourceMasterStatus: getEngineeringMasterOrderById(change.sourceMasterOrderId)?.status || '-',
        allTasksCompleted: workspace.taskLines.every((line) => line.status === '已完成'),
        effectiveStatus: newVersion?.versionStatus === 'PUBLISHED' ? '已完成' : workspace.newTechnicalVersionId ? '待发布' : '进行中',
      }
    })
    .filter((item): item is EngineeringChangeWorkspaceView => Boolean(item))
    .sort((left, right) => right.change.createdAt.localeCompare(left.change.createdAt))
}

export function getEngineeringChangeWorkspaceView(changeId: string): EngineeringChangeWorkspaceView | null {
  const change = getEngineeringChangeTaskById(changeId)
  const workspace = getWorkspace(changeId)
  if (!change || !workspace) return null
  return {
    change,
    workspace,
    sourceMasterStatus: getEngineeringMasterOrderById(change.sourceMasterOrderId)?.status || '-',
    allTasksCompleted: workspace.taskLines.every((line) => line.status === '已完成'),
    effectiveStatus: workspace.newTechnicalVersionId && getTechnicalDataVersionById(workspace.newTechnicalVersionId)?.versionStatus === 'PUBLISHED'
      ? '已完成'
      : workspace.newTechnicalVersionId ? '待发布' : '进行中',
  }
}

export function createEngineeringChangeWorkspace(input: {
  sourceMasterOrderId: string
  changeReason: string
  affectedModules: TechnicalModuleKey[]
  actor: PcsEngineeringCurrentUser
}): EngineeringChangeWorkspaceView {
  const master = getEngineeringMasterOrderById(input.sourceMasterOrderId)
  if (!master) throw new Error('未找到来源工程主单。')
  if (master.status !== '已关闭') throw new Error('仅已关闭工程主单可以创建工程变更。')
  const currentVersion = getCurrentTechPackVersionByStyleId(master.styleId)
  if (!currentVersion || currentVersion.versionStatus !== 'PUBLISHED') {
    throw new Error('当前款式没有已生效技术包，不能创建工程变更。')
  }
  const changeReason = input.changeReason.trim()
  const ownerName = input.actor.userName.trim()
  const createdBy = input.actor.userName.trim()
  const affectedModules = [...new Set(input.affectedModules)]
  if (!changeReason) throw new Error('请填写变更原因。')
  if (affectedModules.length === 0) throw new Error('请至少选择一个受影响资料模块。')
  if (input.actor.role !== '跟单' || !input.actor.userId.trim() || !ownerName) throw new Error('只有当前登录的跟单可以创建工程变更。')
  if (master.merchandiserName !== ownerName) throw new Error('只有来源工程主单的跟单负责人可以创建工程变更。')
  const change = createEngineeringChangeTask({ sourceMasterOrderId: master.masterOrderId, createdBy })
  const workspace: EngineeringChangeWorkspaceRecord = {
    engineeringChangeTaskId: change.engineeringChangeTaskId,
    currentTechnicalVersionId: currentVersion.technicalVersionId,
    currentTechnicalVersionCode: currentVersion.technicalVersionCode,
    changeReason,
    affectedModules,
    ownerName,
    taskLines: buildTaskLines(change.engineeringChangeTaskId, affectedModules, ownerName),
    newTechnicalVersionId: '',
    newTechnicalVersionCode: '',
    updatedAt: nowText(),
  }
  upsertWorkspace(workspace)
  return { change, workspace: cloneWorkspace(workspace), sourceMasterStatus: master.status, allTasksCompleted: false, effectiveStatus: '进行中' }
}

export function startEngineeringChangeTaskLine(changeId: string, lineId: string, actor: PcsEngineeringCurrentUser): EngineeringChangeWorkspaceRecord {
  const workspace = getWorkspace(changeId)
  if (!workspace) throw new Error('未找到工程变更。')
  if (actor.role !== '跟单' || actor.userName !== workspace.ownerName) throw new Error('只有当前工程变更的跟单负责人可以开始任务。')
  if (workspace.newTechnicalVersionId) throw new Error('已生成新技术包版本，不能再修改任务。')
  const line = workspace.taskLines.find((item) => item.lineId === lineId)
  if (!line) throw new Error('未找到专业任务。')
  if (line.status !== '待开始') throw new Error('当前任务不能重复开始。')
  line.status = '进行中'
  line.startedAt = nowText()
  workspace.updatedAt = line.startedAt
  upsertWorkspace(workspace)
  return cloneWorkspace(workspace)
}

export function completeEngineeringChangeTaskLine(changeId: string, lineId: string, resultSummary: string, actor: PcsEngineeringCurrentUser): EngineeringChangeWorkspaceRecord {
  const workspace = getWorkspace(changeId)
  if (!workspace) throw new Error('未找到工程变更。')
  if (actor.role !== '跟单' || actor.userName !== workspace.ownerName) throw new Error('只有当前工程变更的跟单负责人可以提交成果。')
  if (workspace.newTechnicalVersionId) throw new Error('已生成新技术包版本，不能再修改任务。')
  const line = workspace.taskLines.find((item) => item.lineId === lineId)
  if (!line) throw new Error('未找到专业任务。')
  if (line.status !== '进行中') throw new Error('请先开始任务，再提交成果。')
  if (!resultSummary.trim()) throw new Error('请填写本次成果说明。')
  line.status = '已完成'
  line.resultSummary = resultSummary.trim()
  line.submittedAt = nowText()
  line.completedAt = line.submittedAt
  workspace.updatedAt = line.completedAt
  upsertWorkspace(workspace)
  return cloneWorkspace(workspace)
}

function copyTechnicalContent(base: TechnicalDataVersionContent, technicalVersionId: string): TechnicalDataVersionContent {
  const content = JSON.parse(JSON.stringify(base)) as TechnicalDataVersionContent
  content.technicalVersionId = technicalVersionId
  delete content.bomPricingSnapshot
  return content
}

export function createEngineeringChangeTechPackDraft(changeId: string, actor: PcsEngineeringCurrentUser): TechnicalDataVersionRecord {
  const view = getEngineeringChangeWorkspaceView(changeId)
  if (!view) throw new Error('未找到工程变更。')
  if (!view.allTasksCompleted) throw new Error('请先完成全部已启用专业任务。')
  if (view.workspace.newTechnicalVersionId) {
    const existing = getTechnicalDataVersionById(view.workspace.newTechnicalVersionId)
    if (existing) return existing
  }
  const operator = actor.userName.trim()
  if (actor.role !== '跟单' || !actor.userId.trim() || operator !== view.workspace.ownerName) {
    throw new Error('只有当前工程变更的跟单负责人可以生成技术包草稿。')
  }
  const base = getTechnicalDataVersionById(view.workspace.currentTechnicalVersionId)
  const baseContent = base ? getTechnicalDataVersionContent(base.technicalVersionId) : null
  if (!base || base.versionStatus !== 'PUBLISHED' || !baseContent) throw new Error('来源正式技术包已失效，不能生成新版本。')
  const identity = getNextTechnicalVersionIdentity()
  const version = getNextStyleVersionMeta(base.styleId)
  const timestamp = identity.timestamp
  const record: TechnicalDataVersionRecord = {
    ...base,
    technicalVersionId: identity.technicalVersionId,
    technicalVersionCode: identity.technicalVersionCode,
    versionLabel: version.versionLabel,
    versionNo: version.versionNo,
    sourceProjectId: view.change.engineeringChangeTaskId,
    sourceProjectCode: view.change.engineeringChangeTaskCode,
    sourceProjectName: view.change.title,
    sourceProjectNodeId: '',
    createdFromTaskType: 'ENGINEERING_CHANGE',
    createdFromTaskId: view.change.engineeringChangeTaskId,
    createdFromTaskCode: view.change.engineeringChangeTaskCode,
    baseTechnicalVersionId: base.technicalVersionId,
    baseTechnicalVersionCode: base.technicalVersionCode,
    changeScope: '改版生成',
    changeSummary: view.workspace.changeReason,
    versionStatus: 'DRAFT',
    reviewStage: '未提交审核',
    buyerReview: undefined,
    patternMakerReview: undefined,
    merchandiserReview: undefined,
    reviewSubmittedAt: '',
    reviewSubmittedBy: '',
    returnedFromMerchandiserFlag: false,
    reviewUnlockedModuleKeys: [],
    publishedAt: '',
    publishedBy: '',
    createdAt: timestamp,
    createdBy: operator,
    updatedAt: timestamp,
    updatedBy: operator,
    note: `工程变更 ${view.change.engineeringChangeTaskCode} 生成`,
  }
  const created = createTechnicalDataVersionDraft(record, copyTechnicalContent(baseContent, record.technicalVersionId))
  view.workspace.newTechnicalVersionId = created.technicalVersionId
  view.workspace.newTechnicalVersionCode = created.technicalVersionCode
  view.workspace.updatedAt = timestamp
  upsertWorkspace(view.workspace)
  return created
}

export function resetEngineeringChangeWorkspace(): void {
  if (canUseStorage()) localStorage.removeItem(STORAGE_KEY)
}
