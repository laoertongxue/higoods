// 工程变更工作区：以当前正式技术包为基线，具体修改内容要么进入真实专业任务，
// 要么直接在下一版技术包草稿中维护；禁止把资料栏目伪装成一句话即可完成的临时任务。
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
  runTechnicalDataVersionRepositoryTransaction,
  updateTechnicalDataVersionContent,
} from './pcs-technical-data-version-repository'
import {
  captureEngineeringBomRepositoryState,
  createEngineeringBomVersionsForOwner,
  getEngineeringBomPricingPlan,
  listEngineeringBomVersionsByOwner,
  replaceEngineeringBomPricingPlanDraft,
  resolveEngineeringBomPricingPlan,
  restoreEngineeringBomRepositoryState,
} from './pcs-engineering-bom-repository'
import {
  technicalBomItemToEngineeringLine,
} from './pcs-engineering-bom-pricing'
import { resolveEngineeringBomMaterialLine } from './pcs-engineering-bom-material-resolver'
import { submitTechPackFirstStageReview } from './pcs-tech-pack-review'
import {
  assertEngineeringUploadedFilesReady,
  type EngineeringUploadPurpose,
} from './pcs-engineering-file-upload'
import { listEngineeringTaskUploadedFiles } from './pcs-engineering-task-upload-repository'
import type {
  EngineeringChangeTaskRecord,
  EngineeringTaskRecord,
  EngineeringTaskStatus,
  EngineeringTaskType,
} from './pcs-engineering-master-types'
import type { PcsEngineeringCurrentUser } from './pcs-engineering-current-user'
import type { EngineeringTeamOperator } from './pcs-engineering-team-directory'
import type {
  TechnicalDataVersionContent,
  TechnicalDataVersionRecord,
  TechnicalModuleKey,
} from './pcs-technical-data-version-types'

const STORAGE_KEY = 'higood:pcs:engineering-change-workspace:v2'
let memoryWorkspaces: EngineeringChangeWorkspaceRecord[] = []

export type EngineeringChangeWorkspaceStatus =
  | '待确认修改内容'
  | '修改中'
  | '待汇总技术包'
  | '技术包审核中'
  | '已生效'
  | '已完成'

export type EngineeringChangeItemKind =
  | 'BOM_ITEM'
  | 'BASE_PATTERN'
  | 'SIZE_PATTERN'
  | 'PRE_PRODUCTION_SAMPLE'
  | 'PATTERN_ARTWORK'
  | 'COLOR_YARN'
  | 'COLOR_FABRIC'
  | 'PROCESS'
  | 'SIZE_DATA'
  | 'DESIGN'
  | 'ATTACHMENT'
  | 'QUALITY'

export type EngineeringChangeItemTreatment = 'BOM_EDIT' | 'PROFESSIONAL_TASK' | 'TECHNICAL_DATA_EDIT'
export type EngineeringChangeItemStatus = '待处理' | '处理中' | '待审核' | '返工中' | '已完成'

export interface EngineeringChangeModificationOption {
  optionId: string
  itemKind: EngineeringChangeItemKind
  treatment: EngineeringChangeItemTreatment
  label: string
  sourceObjectId: string
  sourceObjectLabel: string
  sourceObjectSnapshot: string
  moduleKey: TechnicalModuleKey
  taskType?: EngineeringTaskType
  taskName?: string
  executionTeamName?: string
}

export interface EngineeringChangeItem extends EngineeringChangeModificationOption {
  itemId: string
  status: EngineeringChangeItemStatus
  currentTeamName: string
  completedBy: string
  completedAt: string
  taskLineId: string
}

export interface EngineeringChangeTaskLine {
  lineId: string
  changeItemId: string
  taskType: EngineeringTaskType
  taskName: string
  executionTeamName: string
  currentTeamName: string
  status: Extract<EngineeringTaskStatus, '待开始' | '进行中' | '待审核' | '返工中' | '已完成'>
  currentRoundNo: number
  startedAt: string
  submittedAt: string
  reviewedAt: string
  completedAt: string
  actualOperatorId: string
  actualOperatorName: string
  reviewOpinion: string
  pantoneColorCode: string
  colorName: string
  dyeColorCode: string
}

export interface EngineeringChangeOperationLog {
  logId: string
  action: string
  teamName: string
  operatorId: string
  operatorName: string
  occurredAt: string
  detail: string
}

export interface EngineeringChangeWorkspaceRecord {
  engineeringChangeTaskId: string
  currentTechnicalVersionId: string
  currentTechnicalVersionCode: string
  changeReason: string
  selectedItems: EngineeringChangeItem[]
  // 兼容列表与技术包审核范围；始终由 selectedItems 推导，不作为创建入口。
  affectedModules: TechnicalModuleKey[]
  coordinatorTeamName: '跟单'
  createdBy: string
  taskLines: EngineeringChangeTaskLine[]
  status: EngineeringChangeWorkspaceStatus
  newTechnicalVersionId: string
  newTechnicalVersionCode: string
  operationLogs: EngineeringChangeOperationLog[]
  createdAt: string
  updatedAt: string
}

export interface EngineeringChangeWorkspaceView {
  change: EngineeringChangeTaskRecord
  workspace: EngineeringChangeWorkspaceRecord
  sourceMasterStatus: string
  allTasksCompleted: boolean
  allItemsCompleted: boolean
  effectiveStatus: EngineeringChangeWorkspaceStatus
}

function nowText(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
}

function cloneWorkspace(item: EngineeringChangeWorkspaceRecord): EngineeringChangeWorkspaceRecord {
  return {
    ...item,
    selectedItems: item.selectedItems.map((line) => ({ ...line })),
    affectedModules: [...item.affectedModules],
    taskLines: item.taskLines.map((line) => ({ ...line })),
    operationLogs: item.operationLogs.map((line) => ({ ...line })),
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

function appendLog(
  workspace: EngineeringChangeWorkspaceRecord,
  action: string,
  actor: { operatorId: string; operatorName: string; teamName: string },
  detail: string,
): void {
  const occurredAt = nowText()
  workspace.operationLogs.unshift({
    logId: `${workspace.engineeringChangeTaskId}-LOG-${Date.now().toString(36)}`,
    action,
    teamName: actor.teamName,
    operatorId: actor.operatorId,
    operatorName: actor.operatorName,
    occurredAt,
    detail,
  })
  workspace.updatedAt = occurredAt
}

function currentUserActor(user: PcsEngineeringCurrentUser): EngineeringTeamOperator {
  return { operatorId: user.userId, operatorName: user.userName, teamName: '跟单' }
}

function copyTechnicalContent(base: TechnicalDataVersionContent, technicalVersionId: string): TechnicalDataVersionContent {
  const content = JSON.parse(JSON.stringify(base)) as TechnicalDataVersionContent
  content.technicalVersionId = technicalVersionId
  delete content.bomPricingSnapshot
  return content
}

function option(input: Omit<EngineeringChangeModificationOption, 'optionId'>): EngineeringChangeModificationOption {
  return { ...input, optionId: `${input.itemKind}:${input.sourceObjectId}` }
}

function classifyPatternTask(patternName: string): { kind: 'BASE_PATTERN' | 'SIZE_PATTERN'; type: EngineeringTaskType; name: string } {
  const isSize = /齐码|放码|全码|SIZE/i.test(patternName)
  const isKnit = /毛织|针织|KNIT/i.test(patternName)
  if (isSize) return {
    kind: 'SIZE_PATTERN',
    type: isKnit ? 'SIZE_PATTERN_KNIT' : 'SIZE_PATTERN_WOVEN',
    name: isKnit ? '毛织齐码纸样' : '梭织齐码纸样',
  }
  return {
    kind: 'BASE_PATTERN',
    type: isKnit ? 'BASE_PATTERN_KNIT' : 'BASE_PATTERN_WOVEN',
    name: isKnit ? '毛织基码纸样' : '梭织基码纸样',
  }
}

export function listEngineeringChangeModificationOptions(sourceMasterOrderId: string): EngineeringChangeModificationOption[] {
  const master = getEngineeringMasterOrderById(sourceMasterOrderId)
  if (!master || master.status !== '已关闭') return []
  const current = getCurrentTechPackVersionByStyleId(master.styleId)
  const content = current ? getTechnicalDataVersionContent(current.technicalVersionId) : null
  if (!current || current.versionStatus !== 'PUBLISHED' || !content) return []

  const options: EngineeringChangeModificationOption[] = []
  if (content.bomItems.length > 0 || (content.bomCustomCosts?.length ?? 0) > 0 || content.bomCustomCostDecision) {
    const costDecision = content.bomCustomCostDecision
      ?? ((content.bomCustomCosts?.length ?? 0) > 0 ? 'HAS_CUSTOM_COST' : 'UNDECIDED')
    options.push(option({
      itemKind: 'BOM_ITEM', treatment: 'BOM_EDIT', moduleKey: 'BOM',
      label: '用料与成本',
      sourceObjectId: 'BOM_AND_PRICING', sourceObjectLabel: '整款用料与成本',
      sourceObjectSnapshot: JSON.stringify({
        bomItems: content.bomItems,
        bomCustomCosts: content.bomCustomCosts ?? [],
        bomCustomCostDecision: costDecision,
      }),
      executionTeamName: '买手',
    }))
  }
  content.patternFiles.forEach((item) => {
    const classified = classifyPatternTask(`${item.patternName || ''} ${item.patternCategory || ''} ${item.fileName || ''}`)
    options.push(option({
      itemKind: classified.kind, treatment: 'PROFESSIONAL_TASK', moduleKey: 'PATTERN',
      label: `${classified.name}：${item.patternName || item.fileName}`,
      sourceObjectId: item.id, sourceObjectLabel: item.patternName || item.fileName,
      sourceObjectSnapshot: JSON.stringify(item), taskType: classified.type,
      taskName: classified.name, executionTeamName: classified.type.includes('KNIT') ? '毛织团队' : '版师',
    }))
  })
  options.push(option({
    itemKind: 'PRE_PRODUCTION_SAMPLE', treatment: 'PROFESSIONAL_TASK', moduleKey: 'DESIGN',
    label: '产前版样衣成果', sourceObjectId: 'PRE_PRODUCTION_SAMPLE', sourceObjectLabel: '当前产前版样衣',
    sourceObjectSnapshot: '', taskType: 'PRE_PRODUCTION_SAMPLE', taskName: '产前版样衣任务', executionTeamName: '制作团队',
  }))
  content.patternDesigns.forEach((item) => options.push(option({
    itemKind: 'PATTERN_ARTWORK', treatment: 'PROFESSIONAL_TASK', moduleKey: 'MATERIAL_PATTERN_LINK',
    label: `花型成果：${item.name}`, sourceObjectId: item.id, sourceObjectLabel: item.name,
    sourceObjectSnapshot: JSON.stringify(item), taskType: 'PATTERN_ARTWORK', taskName: '花型任务', executionTeamName: '花型团队',
  })))
  content.colorMaterialMappings.forEach((item) => {
    const yarn = item.lines.some((line) => /纱|线/.test(`${line.materialName}${line.materialType}`))
    options.push(option({
      itemKind: yarn ? 'COLOR_YARN' : 'COLOR_FABRIC', treatment: 'PROFESSIONAL_TASK', moduleKey: 'COLOR_MATERIAL_MAPPING',
      label: `调色成果：${item.colorName}（${item.colorCode}）`, sourceObjectId: item.id,
      sourceObjectLabel: `${item.colorName}（${item.colorCode}）`, sourceObjectSnapshot: JSON.stringify(item),
      taskType: yarn ? 'COLOR_YARN' : 'COLOR_FABRIC', taskName: yarn ? '调色任务（纱线）' : '调色任务（面料）', executionTeamName: '染厂',
    }))
  })
  content.processEntries.forEach((item) => options.push(option({
    itemKind: 'PROCESS', treatment: 'TECHNICAL_DATA_EDIT', moduleKey: 'PROCESS',
    label: `工艺：${item.processName}${item.craftName ? `／${item.craftName}` : ''}`,
    sourceObjectId: item.id, sourceObjectLabel: item.processName, sourceObjectSnapshot: JSON.stringify(item), executionTeamName: '跟单',
  })))
  content.sizeTable.forEach((item) => options.push(option({
    itemKind: 'SIZE_DATA', treatment: 'TECHNICAL_DATA_EDIT', moduleKey: 'SIZE',
    label: `尺码数据：${item.part}`, sourceObjectId: item.id, sourceObjectLabel: item.part,
    sourceObjectSnapshot: JSON.stringify(item), executionTeamName: '版师',
  })))
  options.push(option({
    itemKind: 'DESIGN', treatment: 'TECHNICAL_DATA_EDIT', moduleKey: 'DESIGN',
    label: '设计与做货说明', sourceObjectId: 'PATTERN_DESC', sourceObjectLabel: '设计与做货说明',
    sourceObjectSnapshot: JSON.stringify(content.patternDesc || ''), executionTeamName: '跟单',
  }))
  content.attachments.forEach((item) => options.push(option({
    itemKind: 'ATTACHMENT', treatment: 'TECHNICAL_DATA_EDIT', moduleKey: 'ATTACHMENT',
    label: `技术附件：${item.fileName}`, sourceObjectId: item.id, sourceObjectLabel: item.fileName,
    sourceObjectSnapshot: JSON.stringify(item), executionTeamName: '跟单',
  })))
  content.qualityRules.forEach((item) => options.push(option({
    itemKind: 'QUALITY', treatment: 'TECHNICAL_DATA_EDIT', moduleKey: 'QUALITY',
    label: `质量要求：${item.checkItem}`, sourceObjectId: item.id, sourceObjectLabel: item.checkItem,
    sourceObjectSnapshot: JSON.stringify(item), executionTeamName: '跟单',
  })))
  return options
}

function buildTaskLines(changeId: string, items: EngineeringChangeItem[]): EngineeringChangeTaskLine[] {
  return items.filter((item) => item.treatment === 'PROFESSIONAL_TASK' && item.taskType && item.taskName).map((item, index) => ({
    lineId: `${changeId}-TASK-${String(index + 1).padStart(2, '0')}`,
    changeItemId: item.itemId,
    taskType: item.taskType!,
    taskName: item.taskName!,
    executionTeamName: item.executionTeamName || '跟单',
    currentTeamName: item.itemKind === 'COLOR_YARN' || item.itemKind === 'COLOR_FABRIC' ? '跟单' : item.executionTeamName || '跟单',
    status: '待开始', currentRoundNo: 1,
    startedAt: '', submittedAt: '', reviewedAt: '', completedAt: '',
    actualOperatorId: '', actualOperatorName: '', reviewOpinion: '',
    pantoneColorCode: '', colorName: '', dyeColorCode: '',
  }))
}

function createWorkingTechnicalDraft(
  change: EngineeringChangeTaskRecord,
  workspace: EngineeringChangeWorkspaceRecord,
  operatorName: string,
): TechnicalDataVersionRecord {
  const base = getTechnicalDataVersionById(workspace.currentTechnicalVersionId)
  const baseContent = base ? getTechnicalDataVersionContent(base.technicalVersionId) : null
  if (!base || base.versionStatus !== 'PUBLISHED' || !baseContent) throw new Error('当前使用的技术包已失效，不能建立下一版。')
  const identity = getNextTechnicalVersionIdentity()
  const version = getNextStyleVersionMeta(base.styleId)
  const timestamp = nowText()
  const record: TechnicalDataVersionRecord = {
    ...base,
    technicalVersionId: identity.technicalVersionId,
    technicalVersionCode: identity.technicalVersionCode,
    versionLabel: version.versionLabel,
    versionNo: version.versionNo,
    sourceProjectId: change.engineeringChangeTaskId,
    sourceProjectCode: change.engineeringChangeTaskCode,
    sourceProjectName: change.title,
    sourceProjectNodeId: '',
    createdFromTaskType: 'ENGINEERING_CHANGE',
    createdFromTaskId: change.engineeringChangeTaskId,
    createdFromTaskCode: change.engineeringChangeTaskCode,
    baseTechnicalVersionId: base.technicalVersionId,
    baseTechnicalVersionCode: base.technicalVersionCode,
    changeScope: '改版生成',
    changeSummary: workspace.changeReason,
    versionStatus: 'DRAFT', reviewStage: '未提交审核',
    buyerReview: undefined, patternMakerReview: undefined, merchandiserReview: undefined,
    reviewSubmittedAt: '', reviewSubmittedBy: '', returnedFromMerchandiserFlag: false,
    reviewUnlockedModuleKeys: [], reviewReturnTargets: [], publishedAt: '', publishedBy: '',
    createdAt: timestamp, createdBy: operatorName, updatedAt: timestamp, updatedBy: operatorName,
    note: `工程变更 ${change.engineeringChangeTaskCode} 的下一版资料`,
  }
  const bomSnapshot = captureEngineeringBomRepositoryState()
  try {
    return runTechnicalDataVersionRepositoryTransaction(() => {
      const created = createTechnicalDataVersionDraft(record, copyTechnicalContent(baseContent, record.technicalVersionId))
      createEngineeringBomVersionsForOwner({
        ownerStage: 'TECH_PACK_DRAFT',
        ownerId: record.technicalVersionId,
        ownerCode: record.technicalVersionCode,
        styleId: record.styleId,
        buyerName: record.buyerName,
        createdBy: operatorName,
        createdAt: timestamp,
      })
      if (baseContent.bomItems.length > 0) {
        const groups = new Map<string, TechnicalDataVersionContent['bomItems']>()
        baseContent.bomItems.forEach((item) => {
          const color = item.colorLabel?.trim() || '默认颜色'
          groups.set(color, [...(groups.get(color) || []), item])
        })
        replaceEngineeringBomPricingPlanDraft({
          ownerStage: 'TECH_PACK_DRAFT',
          ownerId: record.technicalVersionId,
          role: '买手',
          userId: `BUYER-${record.technicalVersionId}`,
          userName: record.buyerName || '待分配买手',
          colors: [...groups.entries()].map(([productColor, items]) => ({
            productColor,
            applicableSkuIds: [...new Set(items.flatMap((item) => item.applicableSkuCodes || []))],
            materialLines: items.map((item) => technicalBomItemToEngineeringLine(item, record.styleCode)),
          })),
          customCostDecision: baseContent.bomCustomCostDecision
            ?? ((baseContent.bomCustomCosts?.length ?? 0) > 0 ? 'HAS_CUSTOM_COST' : 'UNDECIDED'),
          customCosts: baseContent.bomCustomCosts ?? [],
          updatedAt: timestamp,
        })
      }
      return created
    })
  } catch (error) {
    restoreEngineeringBomRepositoryState(bomSnapshot)
    throw error
  }
}

function deriveStatus(workspace: EngineeringChangeWorkspaceRecord): EngineeringChangeWorkspaceStatus {
  if (workspace.status === '已完成') return '已完成'
  const nextVersion = workspace.newTechnicalVersionId ? getTechnicalDataVersionById(workspace.newTechnicalVersionId) : null
  if (nextVersion?.versionStatus === 'PUBLISHED') return '已生效'
  if (nextVersion && nextVersion.reviewStage && nextVersion.reviewStage !== '未提交审核') return '技术包审核中'
  if (workspace.selectedItems.length > 0 && workspace.selectedItems.every((item) => item.status === '已完成')) return '待汇总技术包'
  return workspace.status === '待确认修改内容' ? '待确认修改内容' : '修改中'
}

function syncWorkspaceStatus(workspace: EngineeringChangeWorkspaceRecord): EngineeringChangeWorkspaceRecord {
  const next = deriveStatus(workspace)
  if (next !== workspace.status) {
    workspace.status = next
    workspace.updatedAt = nowText()
    upsertWorkspace(workspace)
  }
  return workspace
}

export function listEngineeringChangeWorkspaceViews(): EngineeringChangeWorkspaceView[] {
  const workspaces = new Map(readAll().map((item) => [item.engineeringChangeTaskId, item]))
  return (getEngineeringMasterOrderStoreSnapshot().changeTasks || [])
    .map((change) => {
      const workspace = workspaces.get(change.engineeringChangeTaskId)
      if (!workspace) return null
      syncWorkspaceStatus(workspace)
      return {
        change,
        workspace: cloneWorkspace(workspace),
        sourceMasterStatus: getEngineeringMasterOrderById(change.sourceMasterOrderId)?.status || '-',
        allTasksCompleted: workspace.taskLines.every((line) => line.status === '已完成'),
        allItemsCompleted: workspace.selectedItems.every((item) => item.status === '已完成'),
        effectiveStatus: workspace.status,
      }
    })
    .filter((item): item is EngineeringChangeWorkspaceView => Boolean(item))
    .sort((left, right) => right.change.createdAt.localeCompare(left.change.createdAt))
}

export function getEngineeringChangeWorkspaceView(changeId: string): EngineeringChangeWorkspaceView | null {
  const change = getEngineeringChangeTaskById(changeId)
  const workspace = getWorkspace(changeId)
  if (!change || !workspace) return null
  syncWorkspaceStatus(workspace)
  return {
    change, workspace: cloneWorkspace(workspace),
    sourceMasterStatus: getEngineeringMasterOrderById(change.sourceMasterOrderId)?.status || '-',
    allTasksCompleted: workspace.taskLines.every((line) => line.status === '已完成'),
    allItemsCompleted: workspace.selectedItems.every((item) => item.status === '已完成'),
    effectiveStatus: workspace.status,
  }
}

export function createEngineeringChangeWorkspace(input: {
  sourceMasterOrderId: string
  changeReason: string
  modificationOptionIds: string[]
  actor: PcsEngineeringCurrentUser
}): EngineeringChangeWorkspaceView {
  const master = getEngineeringMasterOrderById(input.sourceMasterOrderId)
  if (!master) throw new Error('未找到来源工程主单。')
  if (master.status !== '已关闭') throw new Error('只有已关闭工程主单对应的款式才能发起工程变更。')
  const currentVersion = getCurrentTechPackVersionByStyleId(master.styleId)
  if (!currentVersion || currentVersion.versionStatus !== 'PUBLISHED') throw new Error('当前款式没有正在使用的技术包，不能发起工程变更。')
  const changeReason = input.changeReason.trim()
  if (!changeReason) throw new Error('请填写本次为什么要修改。')
  if (input.actor.role !== '跟单' || !input.actor.userId.trim() || !input.actor.userName.trim()) throw new Error('只有跟单团队可以发起工程变更。')
  if (master.merchandiserName !== input.actor.userName.trim()) throw new Error('请由来源工程主单的跟单核实后发起。')
  const allOptions = listEngineeringChangeModificationOptions(master.masterOrderId)
  const selectedOptionIds = [...new Set(input.modificationOptionIds)]
  const selectedOptions = selectedOptionIds.map((optionId) => allOptions.find((item) => item.optionId === optionId)).filter((item): item is EngineeringChangeModificationOption => Boolean(item))
  if (selectedOptions.length !== selectedOptionIds.length || selectedOptions.length === 0) throw new Error('请从当前使用的技术包中选择至少一项具体修改内容。')
  const change = createEngineeringChangeTask({ sourceMasterOrderId: master.masterOrderId, createdBy: input.actor.userName })
  const createdAt = nowText()
  const selectedItems: EngineeringChangeItem[] = selectedOptions.map((item, index) => ({
    ...item, itemId: `${change.engineeringChangeTaskId}-ITEM-${String(index + 1).padStart(2, '0')}`,
    status: '待处理', currentTeamName: '跟单', completedBy: '', completedAt: '', taskLineId: '',
  }))
  const workspace: EngineeringChangeWorkspaceRecord = {
    engineeringChangeTaskId: change.engineeringChangeTaskId,
    currentTechnicalVersionId: currentVersion.technicalVersionId,
    currentTechnicalVersionCode: currentVersion.technicalVersionCode,
    changeReason, selectedItems,
    affectedModules: [...new Set(selectedItems.map((item) => item.moduleKey))],
    coordinatorTeamName: '跟单', createdBy: input.actor.userName,
    taskLines: [], status: '待确认修改内容', newTechnicalVersionId: '', newTechnicalVersionCode: '',
    operationLogs: [], createdAt, updatedAt: createdAt,
  }
  appendLog(workspace, '发起工程变更', currentUserActor(input.actor), `基于 ${currentVersion.technicalVersionCode} 选择 ${selectedItems.length} 项具体修改内容。`)
  upsertWorkspace(workspace)
  return getEngineeringChangeWorkspaceView(change.engineeringChangeTaskId)!
}

export function confirmEngineeringChangeWork(changeId: string, actor: PcsEngineeringCurrentUser): EngineeringChangeWorkspaceRecord {
  const workspace = getWorkspace(changeId)
  const change = getEngineeringChangeTaskById(changeId)
  if (!workspace || !change) throw new Error('未找到工程变更。')
  if (workspace.status !== '待确认修改内容') throw new Error('本次修改内容已经确认，不能重复建立工作。')
  if (actor.role !== '跟单' || !actor.userId.trim()) throw new Error('只有跟单团队可以确认本次修改内容。')
  const version = createWorkingTechnicalDraft(change, workspace, actor.userName)
  workspace.newTechnicalVersionId = version.technicalVersionId
  workspace.newTechnicalVersionCode = version.technicalVersionCode
  workspace.taskLines = buildTaskLines(changeId, workspace.selectedItems)
  workspace.taskLines.forEach((line) => {
    const item = workspace.selectedItems.find((candidate) => candidate.itemId === line.changeItemId)
    if (item) {
      item.taskLineId = line.lineId
      item.currentTeamName = line.currentTeamName
    }
  })
  workspace.selectedItems.filter((item) => item.treatment !== 'PROFESSIONAL_TASK').forEach((item) => {
    item.currentTeamName = item.executionTeamName || (item.treatment === 'BOM_EDIT' ? '买手' : '跟单')
  })
  workspace.status = '修改中'
  appendLog(workspace, '确认本次修改内容', currentUserActor(actor), `已建立 ${workspace.taskLines.length} 张真实专业任务；BOM 和普通技术资料进入 ${version.technicalVersionCode} 维护。`)
  upsertWorkspace(workspace)
  return cloneWorkspace(workspace)
}

function requireTask(workspace: EngineeringChangeWorkspaceRecord, lineId: string): EngineeringChangeTaskLine {
  const line = workspace.taskLines.find((item) => item.lineId === lineId)
  if (!line) throw new Error('未找到本次专业任务。')
  return line
}

function assertTeam(actor: EngineeringTeamOperator, teamName: string, action: string): void {
  if (!actor.operatorId.trim() || !actor.operatorName.trim() || actor.teamName !== teamName) throw new Error(`当前应由${teamName}完成${action}。`)
}

function syncItemFromTask(workspace: EngineeringChangeWorkspaceRecord, line: EngineeringChangeTaskLine): void {
  const item = workspace.selectedItems.find((candidate) => candidate.itemId === line.changeItemId)
  if (!item) return
  item.currentTeamName = line.currentTeamName
  item.status = line.status === '待审核' ? '待审核' : line.status === '返工中' ? '返工中' : line.status === '已完成' ? '已完成' : line.status === '进行中' ? '处理中' : '待处理'
  if (line.status === '已完成') {
    item.completedBy = line.actualOperatorName
    item.completedAt = line.completedAt
  }
}

export function confirmEngineeringChangeColorRequirement(input: {
  changeId: string
  lineId: string
  pantoneColorCode: string
  colorName: string
  dyeColorCode: string
  actor: EngineeringTeamOperator
}): EngineeringChangeWorkspaceRecord {
  const workspace = getWorkspace(input.changeId)
  if (!workspace) throw new Error('未找到工程变更。')
  const line = requireTask(workspace, input.lineId)
  if (!['COLOR_YARN', 'COLOR_FABRIC'].includes(line.taskType)) throw new Error('当前任务不需要确认颜色要求。')
  assertTeam(input.actor, '跟单', '颜色要求确认')
  if (line.status !== '待开始' || line.currentTeamName !== '跟单') throw new Error('颜色要求已经确认或当前不能修改。')
  if (!input.pantoneColorCode.trim() || !input.colorName.trim()) throw new Error('请填写潘通色号和颜色名称。')
  line.pantoneColorCode = input.pantoneColorCode.trim()
  line.colorName = input.colorName.trim()
  line.dyeColorCode = input.dyeColorCode.trim()
  line.currentTeamName = line.executionTeamName
  line.status = '待开始'
  line.actualOperatorId = input.actor.operatorId
  line.actualOperatorName = input.actor.operatorName
  syncItemFromTask(workspace, line)
  appendLog(workspace, '确认颜色要求', input.actor, `${line.taskName} 已确认潘通色号 ${line.pantoneColorCode}、颜色 ${line.colorName}，交给${line.executionTeamName}。`)
  upsertWorkspace(workspace)
  return cloneWorkspace(workspace)
}

export function startEngineeringChangeTaskLine(changeId: string, lineId: string, actor: EngineeringTeamOperator): EngineeringChangeWorkspaceRecord {
  const workspace = getWorkspace(changeId)
  if (!workspace) throw new Error('未找到工程变更。')
  const line = requireTask(workspace, lineId)
  assertTeam(actor, line.currentTeamName, '当前工作')
  if (line.status !== '待开始' && line.status !== '返工中') throw new Error('当前任务不能开始。')
  if (['COLOR_YARN', 'COLOR_FABRIC'].includes(line.taskType) && !line.pantoneColorCode) throw new Error('请先由跟单确认潘通色号和颜色名称。')
  line.status = line.status === '返工中' ? '返工中' : '进行中'
  line.startedAt ||= nowText()
  line.actualOperatorId = actor.operatorId
  line.actualOperatorName = actor.operatorName
  syncItemFromTask(workspace, line)
  appendLog(workspace, line.currentRoundNo > 1 ? '开始返工' : '开始专业任务', actor, `${line.taskName}第 ${line.currentRoundNo} 轮开始处理。`)
  upsertWorkspace(workspace)
  return cloneWorkspace(workspace)
}

function requiredUploadPurposes(line: EngineeringChangeTaskLine): EngineeringUploadPurpose[] {
  if (['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT', 'SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT'].includes(line.taskType)) return ['PATTERN_SOURCE', 'PATTERN_PREVIEW']
  if (line.taskType === 'PRE_PRODUCTION_SAMPLE') return ['SAMPLE_RESULT']
  if (line.taskType === 'PATTERN_ARTWORK') return ['PATTERN_ARTWORK']
  return ['COLOR_RESULT']
}

function applyProfessionalResultToDraft(workspace: EngineeringChangeWorkspaceRecord, line: EngineeringChangeTaskLine): void {
  const versionId = workspace.newTechnicalVersionId
  const content = getTechnicalDataVersionContent(versionId)
  if (!content) throw new Error('未找到下一版技术包，无法汇总成果。')
  const files = requiredUploadPurposes(line).flatMap((purpose) => listEngineeringTaskUploadedFiles(line.lineId, `ROUND-${line.currentRoundNo}`, purpose))
  const timestamp = nowText()
  if (line.taskType === 'PATTERN_ARTWORK') {
    const primary = files[0]
    updateTechnicalDataVersionContent(versionId, { patternDesigns: [
      ...content.patternDesigns.filter((item) => item.id !== line.lineId),
      { id: line.lineId, name: line.taskName, designSideType: 'FRONT', fileName: primary.fileName, originalFileName: primary.fileName, originalFileMimeType: primary.mimeType, originalFileDataUrl: primary.dataUrl, previewThumbnailDataUrl: primary.dataUrl, uploadedAt: timestamp },
    ] })
    return
  }
  if (['BASE_PATTERN_WOVEN', 'BASE_PATTERN_KNIT', 'SIZE_PATTERN_WOVEN', 'SIZE_PATTERN_KNIT'].includes(line.taskType)) {
    const source = files.find((file) => file.purpose === 'PATTERN_SOURCE' && file.extension === 'prj')!
    const preview = files.find((file) => file.purpose === 'PATTERN_PREVIEW')!
    updateTechnicalDataVersionContent(versionId, { patternFiles: [
      ...content.patternFiles.filter((item) => item.id !== line.lineId),
      { id: line.lineId, patternName: line.taskName, patternCategory: line.taskName, fileName: source.fileName, fileUrl: source.dataUrl, uploadedAt: source.uploadedAt, uploadedBy: source.uploadedByName, imageUrl: preview.dataUrl, prjFile: { fileName: source.fileName, fileType: source.mimeType, fileSize: source.sizeBytes, uploadedAt: source.uploadedAt, uploadedBy: source.uploadedByName, previewUrl: preview.dataUrl } },
    ] })
    return
  }
  updateTechnicalDataVersionContent(versionId, { attachments: [
    ...content.attachments.filter((item) => item.id !== line.lineId),
    ...files.map((file) => ({ id: `${line.lineId}-${file.fileId}`, fileName: file.fileName, fileType: file.mimeType, fileSize: `${file.sizeBytes}`, uploadedAt: file.uploadedAt, uploadedBy: file.uploadedByName, downloadUrl: file.dataUrl })),
  ] })
}

export function submitEngineeringChangeTaskLine(changeId: string, lineId: string, actor: EngineeringTeamOperator): EngineeringChangeWorkspaceRecord {
  const workspace = getWorkspace(changeId)
  if (!workspace) throw new Error('未找到工程变更。')
  const line = requireTask(workspace, lineId)
  assertTeam(actor, line.executionTeamName, '成果提交')
  if (!['进行中', '返工中'].includes(line.status)) throw new Error('请先开始任务，再提交本次工作。')
  requiredUploadPurposes(line).forEach((purpose) => {
    const files = listEngineeringTaskUploadedFiles(line.lineId, `ROUND-${line.currentRoundNo}`, purpose)
    assertEngineeringUploadedFilesReady(files, purpose === 'PATTERN_SOURCE' ? '纸样源文件' : purpose === 'PATTERN_PREVIEW' ? '纸样预览图' : '成果文件')
    if (purpose === 'PATTERN_SOURCE' && !files.some((file) => file.extension === 'prj')) throw new Error('纸样源文件必须包含真实 .prj 文件。')
  })
  line.submittedAt = nowText()
  line.actualOperatorId = actor.operatorId
  line.actualOperatorName = actor.operatorName
  const needsBuyerReview = ['PATTERN_ARTWORK', 'COLOR_YARN', 'COLOR_FABRIC'].includes(line.taskType)
  if (needsBuyerReview) {
    line.status = '待审核'
    line.currentTeamName = '买手'
    appendLog(workspace, '提交专业成果', actor, `${line.taskName}第 ${line.currentRoundNo} 轮已提交，交给买手审核。`)
  } else {
    applyProfessionalResultToDraft(workspace, line)
    line.status = '已完成'
    line.currentTeamName = ''
    line.completedAt = line.submittedAt
    appendLog(workspace, '完成专业任务', actor, `${line.taskName}第 ${line.currentRoundNo} 轮成果已进入下一版技术包。`)
  }
  syncItemFromTask(workspace, line)
  syncWorkspaceStatus(workspace)
  upsertWorkspace(workspace)
  return cloneWorkspace(workspace)
}

export function reviewEngineeringChangeTaskLine(input: {
  changeId: string
  lineId: string
  decision: '通过' | '未通过'
  reason: string
  actor: EngineeringTeamOperator
}): EngineeringChangeWorkspaceRecord {
  const workspace = getWorkspace(input.changeId)
  if (!workspace) throw new Error('未找到工程变更。')
  const line = requireTask(workspace, input.lineId)
  assertTeam(input.actor, '买手', '成果审核')
  if (line.status !== '待审核') throw new Error('当前没有待审核成果。')
  if (!input.reason.trim()) throw new Error('请填写审核意见。')
  line.reviewedAt = nowText()
  line.reviewOpinion = input.reason.trim()
  if (input.decision === '通过') {
    applyProfessionalResultToDraft(workspace, line)
    line.status = '已完成'
    line.currentTeamName = ''
    line.completedAt = line.reviewedAt
    line.actualOperatorId = input.actor.operatorId
    line.actualOperatorName = input.actor.operatorName
    appendLog(workspace, '专业成果审核通过', input.actor, `${line.taskName}第 ${line.currentRoundNo} 轮通过，成果已进入下一版技术包。`)
  } else {
    line.status = '返工中'
    line.currentRoundNo += 1
    line.currentTeamName = line.executionTeamName
    appendLog(workspace, '专业成果退回', input.actor, `${line.taskName}未通过：${line.reviewOpinion}。只返工本项成果。`)
  }
  syncItemFromTask(workspace, line)
  syncWorkspaceStatus(workspace)
  upsertWorkspace(workspace)
  return cloneWorkspace(workspace)
}

function currentDirectObject(content: TechnicalDataVersionContent, item: EngineeringChangeItem): unknown {
  if (item.itemKind === 'BOM_ITEM') return {
    bomItems: content.bomItems,
    bomCustomCosts: content.bomCustomCosts ?? [],
    bomCustomCostDecision: content.bomCustomCostDecision
      ?? ((content.bomCustomCosts?.length ?? 0) > 0 ? 'HAS_CUSTOM_COST' : 'UNDECIDED'),
  }
  if (item.itemKind === 'PROCESS') return content.processEntries.find((entry) => entry.id === item.sourceObjectId)
  if (item.itemKind === 'SIZE_DATA') return content.sizeTable.find((entry) => entry.id === item.sourceObjectId)
  if (item.itemKind === 'DESIGN') return content.patternDesc || ''
  if (item.itemKind === 'ATTACHMENT') return content.attachments.find((entry) => entry.id === item.sourceObjectId)
  if (item.itemKind === 'QUALITY') return content.qualityRules.find((entry) => entry.id === item.sourceObjectId)
  return undefined
}

function syncEngineeringChangeBomPricingToTechnicalContent(technicalVersionId: string): TechnicalDataVersionContent {
  const plan = getEngineeringBomPricingPlan('TECH_PACK_DRAFT', technicalVersionId)
  if (!plan) throw new Error('下一版技术包尚未建立用料与成本。')
  if (plan.customCostDecision === 'UNDECIDED') {
    throw new Error('请先由买手确认本次是否有自定义费用。没有费用时请选择“本次无自定义费用”。')
  }
  if (plan.customCostDecision === 'HAS_CUSTOM_COST' && plan.customCosts.length === 0) {
    throw new Error('已选择“本次有自定义费用”，请至少填写一项费用。')
  }
  const versions = listEngineeringBomVersionsByOwner('TECH_PACK_DRAFT', technicalVersionId)
  if (!versions.length) throw new Error('请先维护至少一个颜色的物料。')
  const missingColors = versions.filter((version) => version.materialLines.length === 0).map((version) => version.productColor)
  if (missingColors.length) throw new Error(`以下颜色尚未维护物料：${missingColors.join('、')}。`)
  const resolved = resolveEngineeringBomPricingPlan('TECH_PACK_DRAFT', technicalVersionId)
  const invalidMaterials = resolved.resolved.materialLines
    .filter((line) => line.priceStatus === '标准单价失效')
    .map((line) => line.materialSkuCode)
  if (invalidMaterials.length) throw new Error(`以下物料标准单价失效：${[...new Set(invalidMaterials)].join('、')}。`)
  const bomItems: TechnicalDataVersionContent['bomItems'] = versions.flatMap((version) => version.materialLines.map((line) => {
    const material = resolveEngineeringBomMaterialLine(line)
    const type = ['面料', '辅料', '包装材料', '成衣'].includes(material.materialType || '')
      ? material.materialType as TechnicalDataVersionContent['bomItems'][number]['type']
      : '其他'
    return {
      id: material.bomItemId || `${version.bomDraftVersionId}-${material.materialSkuId}`,
      type,
      name: material.materialName,
      spec: material.specification || '',
      materialCode: material.materialCode,
      materialSkuId: material.materialSkuId,
      unit: material.usageUnit,
      colorLabel: version.productColor,
      unitConsumption: material.usage,
      sampleQuantity: material.sampleQuantity,
      lossRate: material.lossRate,
      supplier: '',
      printRequirement: material.printRequirementText || material.printRequirement || '否',
      dyeRequirement: material.dyeRequirementText || material.dyeRequirement || '否',
      shrinkRequirement: material.shrinkRequirementText && material.shrinkRequirementText !== '无' ? '是' : '否',
      washRequirement: material.washRequirementText && material.washRequirementText !== '无' ? '是' : '否',
      waterSolubleRequirement: material.waterSolubleRequirementText && material.waterSolubleRequirementText !== '无' ? '是' : '否',
      printSideMode: material.printSide === '双面' ? 'DOUBLE' : material.printSide === '反面' ? 'REVERSE' : material.printSide === '正面' ? 'SINGLE' : '',
      applicableSkuCodes: [...version.applicableSkuIds],
      linkedPatternIds: [...(material.linkedPatternResultIds || [])],
      usageProcessCodes: material.processCode ? [material.processCode] : [],
      remark: material.remark || '',
    }
  }))
  updateTechnicalDataVersionContent(technicalVersionId, {
    bomItems,
    bomCustomCosts: plan.customCosts.map((item) => ({ ...item })),
    bomCustomCostDecision: plan.customCostDecision,
  })
  const next = getTechnicalDataVersionContent(technicalVersionId)
  if (!next) throw new Error('用料与成本已保存，但未能刷新下一版技术包。')
  return next
}

export function completeEngineeringChangeDirectItem(changeId: string, itemId: string, actor: EngineeringTeamOperator): EngineeringChangeWorkspaceRecord {
  const workspace = getWorkspace(changeId)
  if (!workspace) throw new Error('未找到工程变更。')
  const item = workspace.selectedItems.find((candidate) => candidate.itemId === itemId)
  if (!item || item.treatment === 'PROFESSIONAL_TASK') throw new Error('未找到需要直接修改的内容。')
  assertTeam(actor, item.currentTeamName || item.executionTeamName || '跟单', '本项修改')
  if (item.status === '已完成') throw new Error('本项修改已经完成。')
  let content = getTechnicalDataVersionContent(workspace.newTechnicalVersionId)
  if (!content) throw new Error('未找到下一版技术包。')
  if (item.itemKind === 'BOM_ITEM') {
    content = syncEngineeringChangeBomPricingToTechnicalContent(workspace.newTechnicalVersionId)
  }
  if (JSON.stringify(currentDirectObject(content, item)) === item.sourceObjectSnapshot) throw new Error('本项内容尚未发生修改，请先进入下一版技术包完成修改。')
  item.status = '已完成'
  item.currentTeamName = ''
  item.completedBy = actor.operatorName
  item.completedAt = nowText()
  appendLog(workspace, '完成资料修改', actor, `${item.label}已在 ${workspace.newTechnicalVersionCode} 中完成。`)
  syncWorkspaceStatus(workspace)
  upsertWorkspace(workspace)
  return cloneWorkspace(workspace)
}

export function submitEngineeringChangeTechPackReview(changeId: string, actor: PcsEngineeringCurrentUser): TechnicalDataVersionRecord {
  const view = getEngineeringChangeWorkspaceView(changeId)
  if (!view) throw new Error('未找到工程变更。')
  if (!view.allItemsCompleted) throw new Error('请先完成本次全部修改内容。')
  if (view.workspace.status !== '待汇总技术包') throw new Error('当前还不能提交技术包审核。')
  if (actor.role !== '跟单' || !actor.userId.trim()) throw new Error('只有跟单团队可以汇总并提交技术包审核。')
  const submitted = submitTechPackFirstStageReview(view.workspace.newTechnicalVersionId, actor.userName)
  view.workspace.status = '技术包审核中'
  appendLog(view.workspace, '提交技术包审核', currentUserActor(actor), `${submitted.technicalVersionCode} 已进入现行技术包审核流程。`)
  upsertWorkspace(view.workspace)
  return submitted
}

// 兼容旧入口：工作安排确认时已经建立下一版草稿，因此这里只返回同一草稿，不再重复生成。
export function createEngineeringChangeTechPackDraft(changeId: string, actor: PcsEngineeringCurrentUser): TechnicalDataVersionRecord {
  const view = getEngineeringChangeWorkspaceView(changeId)
  if (!view) throw new Error('未找到工程变更。')
  if (!view.workspace.newTechnicalVersionId) {
    confirmEngineeringChangeWork(changeId, actor)
    return getTechnicalDataVersionById(getEngineeringChangeWorkspaceView(changeId)!.workspace.newTechnicalVersionId)!
  }
  const record = getTechnicalDataVersionById(view.workspace.newTechnicalVersionId)
  if (!record) throw new Error('未找到下一版技术包。')
  return record
}

export function completeEngineeringChangeWorkspace(changeId: string, actor: PcsEngineeringCurrentUser): EngineeringChangeWorkspaceRecord {
  const workspace = getWorkspace(changeId)
  if (!workspace) throw new Error('未找到工程变更。')
  const version = getTechnicalDataVersionById(workspace.newTechnicalVersionId)
  if (!version || version.versionStatus !== 'PUBLISHED') throw new Error('下一版技术包尚未审核发布，不能完成工程变更。')
  if (actor.role !== '跟单' || !actor.userId.trim()) throw new Error('只有跟单团队可以确认工程变更完成。')
  workspace.status = '已完成'
  appendLog(workspace, '完成工程变更', currentUserActor(actor), `${version.technicalVersionCode} 已生效，本次工程变更完成。`)
  upsertWorkspace(workspace)
  return cloneWorkspace(workspace)
}

function taskProjectionStatus(line: EngineeringChangeTaskLine): EngineeringTaskStatus {
  return line.status
}

export function listEngineeringChangeProfessionalTaskProjections(): EngineeringTaskRecord[] {
  return listEngineeringChangeWorkspaceViews().flatMap(({ change, workspace }) => workspace.taskLines.map((line) => ({
    taskId: line.lineId,
    masterOrderId: change.sourceMasterOrderId,
    taskType: line.taskType,
    taskName: line.taskName,
    sourceType: 'ENGINEERING_CHANGE' as const,
    sourceId: change.engineeringChangeTaskId,
    targetStyleId: change.styleId,
    targetStyleCode: change.styleCode,
    targetStyleName: change.styleName,
    status: taskProjectionStatus(line),
    dependsOnTaskIds: [], dependencySatisfaction: [],
    ownerTeamName: line.status === '已完成' ? '' : line.currentTeamName,
    assigneeId: line.actualOperatorId, assigneeName: line.actualOperatorName,
    assignedById: '', assignedByName: '', assignedAt: '', currentRoundNo: line.currentRoundNo,
    plannedStartAt: '', plannedCompleteAt: '', resultSummary: line.reviewOpinion,
    submittedById: line.actualOperatorId, submittedByName: line.actualOperatorName,
    reviewedById: '', reviewedByName: '',
    events: { generatedAt: workspace.createdAt, unlockedAt: workspace.createdAt, startedAt: line.startedAt, submittedAt: line.submittedAt, reviewedAt: line.reviewedAt, firstCompletedAt: line.completedAt, effectiveCompletedAt: line.completedAt },
    operationLogs: workspace.operationLogs.filter((log) => log.detail.includes(line.taskName)).map((log) => ({ operationType: log.action, operatorId: log.operatorId, operatorName: log.operatorName, operatedAt: log.occurredAt, note: log.detail, roundNo: line.currentRoundNo })),
    materialLines: [], reworkRounds: [], startedAt: line.startedAt, submittedAt: line.submittedAt,
    firstCompletedAt: line.completedAt, effectiveCompletedAt: line.completedAt,
    resultImageIds: [], resultQuantity: 0, resultSubmittedBy: line.actualOperatorName,
    materialReviewRounds: [], colorRequirementConfirmedBy: '', colorRequirementConfirmedAt: '', colorResultCompletedAt: line.completedAt,
    detailPath: `/pcs/engineering/changes/${change.engineeringChangeTaskId}#task-${line.lineId}`,
    sourceBusinessCode: change.engineeringChangeTaskCode,
    sourceBusinessName: '工程变更',
  })))
}

export function resetEngineeringChangeWorkspace(): void {
  memoryWorkspaces = []
  if (canUseStorage()) localStorage.removeItem(STORAGE_KEY)
}
