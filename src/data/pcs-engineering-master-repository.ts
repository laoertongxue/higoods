// 工程主单 LocalStorage 仓库：主单及任务骨架的唯一事实源。
// 任务骨架在发布时一次性生成，依赖只从固定策略复制，不提供任何更新依赖的接口。

import {
  buildDependencyClosure,
  getEngineeringTaskDefinition,
  resolveEngineeringTaskSubmitStatus,
  resolveInitialTaskStatus,
} from './pcs-engineering-dependency-policy.ts'
import type { EngineeringBomTaskLinkageRow } from './pcs-engineering-bom-types.ts'
import { assertFirstFormalProduction } from './pcs-engineering-first-production-policy.ts'
import {
  getStyleArchiveById,
  findStyleArchiveByCode,
} from './pcs-style-archive-repository.ts'
import type {
  EngineeringChangeTaskRecord,
  EngineeringMasterOrderRecord,
  EngineeringMasterOrderSnapshot,
  EngineeringTaskRecord,
  EngineeringTaskType,
} from './pcs-engineering-master-types.ts'

const ENGINEERING_MASTER_STORAGE_KEY = 'higood-pcs-engineering-master-store-v1'
const ENGINEERING_MASTER_STORE_VERSION = 1

let memorySnapshot: EngineeringMasterOrderSnapshot | null = null

function canUseStorage(): boolean {
  return (
    typeof localStorage !== 'undefined' &&
    typeof localStorage.getItem === 'function' &&
    typeof localStorage.setItem === 'function' &&
    typeof localStorage.removeItem === 'function'
  )
}

function nowText(): string {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

function cloneTask(task: EngineeringTaskRecord): EngineeringTaskRecord {
  return {
    ...task,
    dependsOnTaskIds: [...task.dependsOnTaskIds],
    materialLines: task.materialLines.map((line) => ({
      ...line,
      resultFileIds: [...(line.resultFileIds || [])],
      effectImageIds: [...(line.effectImageIds || [])],
    })),
    reworkRounds: task.reworkRounds.map((round) => ({ ...round })),
    materialReviewRounds: (task.materialReviewRounds || []).map((round) => ({
      ...round,
      decisions: round.decisions.map((decision) => ({ ...decision })),
    })),
    resultImageIds: [...(task.resultImageIds || [])],
    boundPurchaseOrderNos: [...(task.boundPurchaseOrderNos || [])],
  }
}

function cloneRecord(record: EngineeringMasterOrderRecord): EngineeringMasterOrderRecord {
  return {
    ...record,
    tasks: record.tasks.map(cloneTask),
    priorResultReuseLines: record.priorResultReuseLines.map((line) => ({ ...line })),
  }
}

function cloneSnapshot(snapshot: EngineeringMasterOrderSnapshot): EngineeringMasterOrderSnapshot {
  return {
    version: snapshot.version,
    records: snapshot.records.map(cloneRecord),
    changeTasks: (snapshot.changeTasks || []).map((record) => ({ ...record })),
  }
}

function seedSnapshot(): EngineeringMasterOrderSnapshot {
  return { version: ENGINEERING_MASTER_STORE_VERSION, records: [], changeTasks: [] }
}

function readSnapshot(): EngineeringMasterOrderSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)
  if (!canUseStorage()) {
    memorySnapshot = seedSnapshot()
    return cloneSnapshot(memorySnapshot)
  }
  try {
    const raw = localStorage.getItem(ENGINEERING_MASTER_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as EngineeringMasterOrderSnapshot
      if (parsed && Array.isArray(parsed.records)) {
        memorySnapshot = {
          version: ENGINEERING_MASTER_STORE_VERSION,
          records: parsed.records.map(normalizeRecord),
          changeTasks: Array.isArray(parsed.changeTasks) ? parsed.changeTasks.map((record) => ({ ...record })) : [],
        }
        return cloneSnapshot(memorySnapshot)
      }
    }
  } catch {
    // 存储损坏时回退到空种子
  }
  memorySnapshot = seedSnapshot()
  return cloneSnapshot(memorySnapshot)
}

function normalizeRecord(record: EngineeringMasterOrderRecord): EngineeringMasterOrderRecord {
  return cloneRecord({
    ...record,
    tasks: Array.isArray(record.tasks)
      ? record.tasks.map((task) => ({
          ...task,
          resultImageIds: Array.isArray(task.resultImageIds) ? [...task.resultImageIds] : [],
          resultQuantity: Number(task.resultQuantity || 0),
          resultSubmittedBy: task.resultSubmittedBy || '',
          colorRequirementConfirmedBy: task.colorRequirementConfirmedBy || '',
          colorRequirementConfirmedAt: task.colorRequirementConfirmedAt || '',
          colorResultCompletedAt: task.colorResultCompletedAt || '',
          completedAt: task.completedAt || task.effectiveCompletedAt || '',
          boundPurchaseOrderNos: Array.isArray(task.boundPurchaseOrderNos) ? task.boundPurchaseOrderNos : [],
          materialReviewRounds: Array.isArray(task.materialReviewRounds) ? task.materialReviewRounds : [],
          materialLines: Array.isArray(task.materialLines)
            ? task.materialLines.map((line) => ({
                ...line,
                resultFileIds: Array.isArray(line.resultFileIds) ? line.resultFileIds : [],
                effectImageIds: Array.isArray(line.effectImageIds) ? line.effectImageIds : [],
                resultSubmittedBy: line.resultSubmittedBy || '',
                resultSubmittedAt: line.resultSubmittedAt || '',
                reviewStatus: line.reviewStatus || '待提交',
                reviewReason: line.reviewReason || '',
                reviewedBy: line.reviewedBy || '',
                reviewedAt: line.reviewedAt || '',
              }))
            : [],
        }))
      : [],
    priorResultReuseLines: Array.isArray(record.priorResultReuseLines) ? record.priorResultReuseLines : [],
  })
}

function writeSnapshot(snapshot: EngineeringMasterOrderSnapshot): void {
  memorySnapshot = cloneSnapshot(snapshot)
  if (!canUseStorage()) return
  try {
    localStorage.setItem(ENGINEERING_MASTER_STORAGE_KEY, JSON.stringify(memorySnapshot))
  } catch {
    // 原型环境存储不可用时仅保留内存态
  }
}

function nextMasterOrderCode(records: EngineeringMasterOrderRecord[]): string {
  let maxSeq = 0
  for (const record of records) {
    const match = /^EM-(\d+)$/.exec(record.masterOrderCode)
    if (match) maxSeq = Math.max(maxSeq, Number(match[1]))
  }
  return `EM-${String(maxSeq + 1).padStart(3, '0')}`
}

function resolveStyleArchive(styleId: string, styleCode: string) {
  const byId = getStyleArchiveById(styleId)
  if (byId) return byId
  const byCode = findStyleArchiveByCode(styleCode)
  if (byCode) return byCode
  return null
}

export interface CreateEngineeringMasterOrderInput {
  styleId: string
  styleCode: string
  merchandiserName: string
  createdBy?: string
}

export interface CreateEngineeringChangeTaskInput {
  sourceMasterOrderId: string
  createdBy: string
}

export function createEngineeringChangeTask(input: CreateEngineeringChangeTaskInput): EngineeringChangeTaskRecord {
  const snapshot = readSnapshot()
  const master = snapshot.records.find((record) => record.masterOrderId === input.sourceMasterOrderId)
  if (!master) throw new Error(`来源工程主单不存在：${input.sourceMasterOrderId}`)
  if (master.status !== '已关闭') throw new Error('仅已关闭工程主单可以创建工程变更任务。')
  const changeTasks = snapshot.changeTasks || []
  const sequence = changeTasks.length + 1
  const id = `EC-${Date.now().toString(36)}-${String(sequence).padStart(3, '0')}`
  const record: EngineeringChangeTaskRecord = {
    engineeringChangeTaskId: id,
    engineeringChangeTaskCode: `EC-${String(sequence).padStart(3, '0')}`,
    title: `${master.styleName}工程变更`,
    sourceMasterOrderId: master.masterOrderId,
    sourceMasterOrderCode: master.masterOrderCode,
    styleId: master.styleId,
    styleCode: master.styleCode,
    styleName: master.styleName,
    status: '进行中',
    createdAt: nowText(),
    createdBy: input.createdBy,
    completedAt: '',
  }
  snapshot.changeTasks = [...changeTasks, record]
  writeSnapshot(snapshot)
  return { ...record }
}

export function getEngineeringChangeTaskById(engineeringChangeTaskId: string): EngineeringChangeTaskRecord | null {
  const record = (readSnapshot().changeTasks || []).find(
    (item) => item.engineeringChangeTaskId === engineeringChangeTaskId,
  )
  return record ? { ...record } : null
}

export function resetEngineeringChangeRepository(): void {
  const snapshot = readSnapshot()
  snapshot.changeTasks = []
  writeSnapshot(snapshot)
}

export function createEngineeringMasterOrder(input: CreateEngineeringMasterOrderInput): EngineeringMasterOrderRecord {
  const snapshot = readSnapshot()

  // 无商品／款式档案：禁止创建工程主单。
  const style = resolveStyleArchive(input.styleId, input.styleCode)
  if (!style) {
    throw new Error('无商品／款式档案，禁止创建工程主单。请先创建商品／款式档案。')
  }

  // 首次工程准备：已正式生产过的款式禁止创建工程主单。
  assertFirstFormalProduction(input.styleCode)

  // 同一款式只允许存在一张未关闭的工程主单。
  const hasOpenMaster = snapshot.records.some(
    (record) =>
      record.styleId === style.styleId && record.status !== '已关闭' && record.status !== '已终止',
  )
  if (hasOpenMaster) {
    throw new Error('该款式已存在未关闭的工程主单，禁止重复创建。')
  }

  const record: EngineeringMasterOrderRecord = {
    masterOrderId: `EM-${Date.now().toString(36)}-${String(snapshot.records.length + 1).padStart(3, '0')}`,
    masterOrderCode: nextMasterOrderCode(snapshot.records),
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    status: '草稿',
    merchandiserName: input.merchandiserName,
    tasks: [],
    priorResultReuseLines: [],
    createdAt: nowText(),
    createdBy: input.createdBy ?? '跟单',
    publishedAt: '',
    closedAt: '',
    terminatedAt: '',
    terminateReason: '',
  }

  snapshot.records.push(record)
  writeSnapshot(snapshot)
  return cloneRecord(record)
}

// 发布主单：一次性生成完整任务骨架，后续不得另起一套同类型任务结构。
export function publishEngineeringMasterOrder(masterOrderId: string): EngineeringMasterOrderRecord {
  const snapshot = readSnapshot()
  const record = snapshot.records.find((item) => item.masterOrderId === masterOrderId)
  if (!record) throw new Error(`工程主单不存在：${masterOrderId}`)
  if (record.status !== '草稿') throw new Error('仅草稿状态的工程主单可以发布。')

  const tasks: EngineeringTaskRecord[] = []
  for (const taskType of [
    'BASE_PATTERN_WOVEN',
    'BASE_PATTERN_KNIT',
    'PRE_PRODUCTION_SAMPLE',
    'SIZE_PATTERN_WOVEN',
    'SIZE_PATTERN_KNIT',
    'PATTERN_ARTWORK',
    'COLOR_YARN',
    'COLOR_FABRIC',
    'ACCESSORY_PURCHASE',
    'TECH_PACK_CONFIRMATION',
  ] as const) {
    const definition = getEngineeringTaskDefinition(taskType)
    tasks.push({
      taskId: `${masterOrderId}-${taskType}`,
      masterOrderId,
      taskType,
      taskName: definition.taskName,
      status: resolveInitialTaskStatus(taskType),
      dependsOnTaskIds: definition.dependsOn.map((dependency) => `${masterOrderId}-${dependency}`),
      ownerTeamName: definition.ownerTeamName,
      materialLines: [],
      reworkRounds: [],
      startedAt: '',
      submittedAt: '',
      firstCompletedAt: '',
      effectiveCompletedAt: '',
      completedAt: '',
      boundPurchaseOrderNos: [],
      resultImageIds: [],
      resultQuantity: 0,
      resultSubmittedBy: '',
      materialReviewRounds: [],
      colorRequirementConfirmedBy: '',
      colorRequirementConfirmedAt: '',
      colorResultCompletedAt: '',
    })
  }

  record.tasks = tasks
  record.status = '已发布'
  record.publishedAt = nowText()
  writeSnapshot(snapshot)
  return cloneRecord(record)
}

export function listEngineeringMasterOrders(): EngineeringMasterOrderRecord[] {
  return readSnapshot().records.map(cloneRecord)
}

export function getEngineeringMasterOrderById(masterOrderId: string): EngineeringMasterOrderRecord | null {
  const record = readSnapshot().records.find((item) => item.masterOrderId === masterOrderId)
  return record ? cloneRecord(record) : null
}

export function getEngineeringMasterOrderStoreSnapshot(): EngineeringMasterOrderSnapshot {
  return readSnapshot()
}

function isThenable(value: unknown): value is PromiseLike<unknown> {
  if ((typeof value !== 'object' || value === null) && typeof value !== 'function') return false
  return typeof (value as { then?: unknown }).then === 'function'
}

const ASYNC_FUNCTION_PROTOTYPE = Object.getPrototypeOf(async function () {})

function isAsyncFunction(operation: () => unknown): boolean {
  return Object.getPrototypeOf(operation) === ASYNC_FUNCTION_PROTOTYPE
}

export function runEngineeringMasterRepositoryTransaction<Operation extends () => unknown>(
  operation: Operation & (ReturnType<Operation> extends PromiseLike<unknown> ? never : unknown),
): ReturnType<Operation> {
  if (isAsyncFunction(operation)) {
    throw new Error('工程主单仓储事务仅支持同步操作，禁止传入 AsyncFunction。')
  }
  const snapshotBeforeOperation = readSnapshot()
  try {
    const result = operation()
    if (isThenable(result)) {
      throw new Error('工程主单仓储事务仅支持同步操作，禁止返回 Promise 或 thenable。')
    }
    return result as ReturnType<Operation>
  } catch (error) {
    writeSnapshot(snapshotBeforeOperation)
    throw error
  }
}

export function resetEngineeringMasterRepository(): void {
  memorySnapshot = seedSnapshot()
  if (!canUseStorage()) return
  try {
    localStorage.removeItem(ENGINEERING_MASTER_STORAGE_KEY)
  } catch {
    // 忽略存储不可用
  }
}

// 主单状态变更的单一仓储入口。页面不可直接改写快照；后续关闭流程复用此入口。
export function setEngineeringMasterStatus(
  masterOrderId: string,
  status: EngineeringMasterOrderRecord['status'],
): EngineeringMasterOrderRecord {
  const snapshot = readSnapshot()
  const record = snapshot.records.find((item) => item.masterOrderId === masterOrderId)
  if (!record) throw new Error(`工程主单不存在：${masterOrderId}`)
  record.status = status
  writeSnapshot(snapshot)
  return cloneRecord(record)
}

// 工程任务事实只允许通过工程主单仓储改写；专业服务用此入口保持单一事实源。
export function updateEngineeringTaskRecord(
  masterOrderId: string,
  taskId: string,
  update: (task: EngineeringTaskRecord, master: EngineeringMasterOrderRecord) => void,
): { masterOrder: EngineeringMasterOrderRecord; task: EngineeringTaskRecord } {
  const snapshot = readSnapshot()
  const master = snapshot.records.find((item) => item.masterOrderId === masterOrderId)
  if (!master) throw new Error(`工程主单不存在：${masterOrderId}`)
  const task = master.tasks.find((item) => item.taskId === taskId)
  if (!task) throw new Error(`工程任务不存在：${taskId}`)
  update(task, master)
  writeSnapshot(snapshot)
  return { masterOrder: cloneRecord(master), task: cloneTask(task) }
}

export type EngineeringTechPackOnlyProcess = '缩水' | '洗水' | '水溶'

export interface ApplyBomRequirementsToEngineeringTasksResult {
  masterOrder: EngineeringMasterOrderRecord
  tasks: EngineeringTaskRecord[]
  createdTaskCount: 0
  techPackOnlyProcesses: EngineeringTechPackOnlyProcess[]
}

export function validateBomRequirementsForEngineeringTasks(
  masterOrderId: string,
  rows: EngineeringBomTaskLinkageRow[],
): void {
  const snapshot = readSnapshot()
  const master = snapshot.records.find((item) => item.masterOrderId === masterOrderId)
  if (!master) throw new Error(`工程主单不存在：${masterOrderId}`)
  if (master.status !== '已发布' && master.status !== '进行中') {
    throw new Error('仅已发布或进行中的工程主单可以同步 BOM 工艺要求。')
  }
  const requiredTaskTypes: EngineeringTaskType[] = []
  if (rows.some((row) => hasBomRequirement(row.printRequirement))) requiredTaskTypes.push('PATTERN_ARTWORK')
  if (rows.some((row) => hasBomRequirement(row.dyeRequirement))) requiredTaskTypes.push('COLOR_FABRIC')
  if (rows.some((row) => row.materialType === '辅料')) requiredTaskTypes.push('ACCESSORY_PURCHASE')
  assertTaskSkeletonsExist(master, requiredTaskTypes)
}

function hasBomRequirement(value: unknown): boolean {
  return value === '是' || value === true
}

function listTechPackOnlyProcesses(rows: EngineeringBomTaskLinkageRow[]): EngineeringTechPackOnlyProcess[] {
  const processes: EngineeringTechPackOnlyProcess[] = []
  if (rows.some((row) => hasBomRequirement(row.shrinkRequirement))) processes.push('缩水')
  if (rows.some((row) => hasBomRequirement(row.washRequirement))) processes.push('洗水')
  if (rows.some((row) => hasBomRequirement(row.waterSolubleRequirement))) processes.push('水溶')
  return processes
}

function canonicalDependencyIds(masterOrderId: string, taskType: EngineeringTaskType): string[] {
  return getEngineeringTaskDefinition(taskType).dependsOn.map((dependency) => `${masterOrderId}-${dependency}`)
}

function assertTaskSkeletonsExist(
  master: EngineeringMasterOrderRecord,
  taskTypes: EngineeringTaskType[],
): void {
  for (const taskType of buildDependencyClosure(taskTypes)) {
    if (master.tasks.some((task) => task.taskType === taskType)) continue
    const taskName = getEngineeringTaskDefinition(taskType).taskName
    throw new Error(`工程主单缺少${taskName}骨架，无法根据 BOM 启用。`)
  }
}

function enableTaskAndFixedPrerequisites(
  master: EngineeringMasterOrderRecord,
  taskType: EngineeringTaskType,
): EngineeringTaskRecord {
  const definition = getEngineeringTaskDefinition(taskType)
  for (const dependencyType of definition.dependsOn) {
    enableTaskAndFixedPrerequisites(master, dependencyType)
  }
  const task = master.tasks.find((item) => item.taskType === taskType)
  if (!task) {
    throw new Error(`工程主单缺少${definition.taskName}骨架，无法根据 BOM 启用。`)
  }
  task.dependsOnTaskIds = canonicalDependencyIds(master.masterOrderId, taskType)
  if (task.status !== '未启用' && task.status !== '因需求变更结束') return task
  const hasPendingDependency = task.dependsOnTaskIds.some((dependencyId) => {
    const dependency = master.tasks.find((item) => item.taskId === dependencyId)
    return dependency?.status !== '已完成' && dependency?.status !== '因需求变更结束'
  })
  task.status = hasPendingDependency ? '待前置' : '待开始'
  return task
}

function createBomMaterialLine(
  task: EngineeringTaskRecord,
  row: EngineeringBomTaskLinkageRow,
  requirementType: '印花' | '染色' | '辅料',
) {
  const materialSkuId = row.materialSkuId || row.bomItemId
  return {
    materialLineId: `${task.taskId}-${row.bomItemId}`,
    bomItemId: row.bomItemId,
    materialSkuId,
    materialName: row.materialName || materialSkuId,
    materialType: row.materialType || '面料',
    requirementType,
    productColor: row.productColor,
    printProcess: requirementType === '印花' ? row.printProcess : undefined,
    pantoneColorCode: requirementType === '染色' ? row.pantoneColorCode : undefined,
    colorName: requirementType === '染色' ? row.colorName : undefined,
    dyeColorCode: requirementType === '染色' ? row.dyeColorCode : undefined,
    dyeFactoryName: requirementType === '染色' ? row.dyeFactoryName : undefined,
    status: '正常' as const,
    resultFileIds: [],
    effectImageIds: [],
    resultSubmittedBy: '',
    resultSubmittedAt: '',
    reviewStatus: '待提交' as const,
    reviewReason: '',
    reviewedBy: '',
    reviewedAt: '',
  }
}

function syncTaskMaterialLines(
  master: EngineeringMasterOrderRecord,
  taskType: 'PATTERN_ARTWORK' | 'COLOR_FABRIC' | 'ACCESSORY_PURCHASE',
  rows: EngineeringBomTaskLinkageRow[],
  requirementType: '印花' | '染色' | '辅料',
): void {
  const taskBeforeSync = master.tasks.find((item) => item.taskType === taskType)
  if (!taskBeforeSync) {
    const taskName = getEngineeringTaskDefinition(taskType).taskName
    throw new Error(`工程主单缺少${taskName}骨架，无法根据 BOM 启用。`)
  }
  const statusBeforeSync = taskBeforeSync.status
  const task = enableTaskAndFixedPrerequisites(master, taskType)
  const activeBomItemIds = new Set(rows.map((row) => row.bomItemId))
  const hadSubmittedResult = task.status === '已完成'
    || task.status === '待审核'
    || Boolean(task.submittedAt)
    || task.materialLines.some((line) => Boolean(line.resultSubmittedAt) || line.resultFileIds.length > 0)
  let addedOrReactivated = false

  for (const line of task.materialLines) {
    if (line.requirementType !== requirementType || !line.bomItemId) continue
    if (!activeBomItemIds.has(line.bomItemId)) line.status = '因需求变更结束'
  }

  for (const row of rows) {
    const existing = task.materialLines.find(
      (line) => line.requirementType === requirementType && line.bomItemId === row.bomItemId,
    )
    if (!existing) {
      task.materialLines.push(createBomMaterialLine(task, row, requirementType))
      addedOrReactivated = true
      continue
    }
    if (existing.status === '因需求变更结束') addedOrReactivated = true
    existing.status = '正常'
    existing.materialSkuId = row.materialSkuId || row.bomItemId
    existing.materialName = row.materialName || existing.materialSkuId
    existing.materialType = row.materialType || '面料'
    existing.productColor = row.productColor
    if (requirementType === '印花') existing.printProcess = row.printProcess
    if (requirementType === '染色') {
      existing.pantoneColorCode = row.pantoneColorCode
      existing.colorName = row.colorName
      existing.dyeColorCode = row.dyeColorCode
      existing.dyeFactoryName = row.dyeFactoryName
    }
  }

  const activeLines = task.materialLines.filter(
    (line) => line.requirementType === requirementType && line.status === '正常',
  )
  if (activeLines.length === 0) {
    task.status = statusBeforeSync
    return
  }
  if (hadSubmittedResult && addedOrReactivated) {
    if (taskType === 'ACCESSORY_PURCHASE') {
      task.status = '进行中'
      task.submittedAt = ''
      task.completedAt = ''
      task.effectiveCompletedAt = ''
      return
    }
    const roundNo = Math.max(0, ...task.reworkRounds.map((round) => round.roundNo)) + 1
    task.reworkRounds.push({
      roundNo,
      reason: 'BOM 新增或恢复物料工艺要求',
      startedAt: nowText(),
      submittedAt: '',
      passedAt: '',
    })
    task.status = '返工中'
  }
}

// BOM 只启用工程主单发布时已有的条件任务骨架，并按 BOM 行维护任务物料事实。
// 缩水、洗水、水溶留在技术包工艺，不生成工程任务或生产准备时效项。
export function applyBomRequirementsToEngineeringTasks(
  masterOrderId: string,
  rows: EngineeringBomTaskLinkageRow[],
): ApplyBomRequirementsToEngineeringTasksResult {
  validateBomRequirementsForEngineeringTasks(masterOrderId, rows)
  const snapshot = readSnapshot()
  const master = snapshot.records.find((item) => item.masterOrderId === masterOrderId)
  if (!master) throw new Error(`工程主单不存在：${masterOrderId}`)

  const printRows = rows.filter((row) => hasBomRequirement(row.printRequirement))
  const dyeRows = rows.filter((row) => hasBomRequirement(row.dyeRequirement))
  const accessoryRows = rows.filter((row) => row.materialType === '辅料')
  const patternTask = master.tasks.find((task) => task.taskType === 'PATTERN_ARTWORK')
  if (patternTask && (printRows.length > 0 || patternTask.materialLines.some((line) => line.requirementType === '印花'))) {
    syncTaskMaterialLines(master, 'PATTERN_ARTWORK', printRows, '印花')
  }
  const colorTask = master.tasks.find((task) => task.taskType === 'COLOR_FABRIC')
  if (colorTask && (dyeRows.length > 0 || colorTask.materialLines.some((line) => line.requirementType === '染色'))) {
    syncTaskMaterialLines(master, 'COLOR_FABRIC', dyeRows, '染色')
  }
  const purchaseTask = master.tasks.find((task) => task.taskType === 'ACCESSORY_PURCHASE')
  if (purchaseTask && (accessoryRows.length > 0 || purchaseTask.materialLines.some((line) => line.requirementType === '辅料'))) {
    syncTaskMaterialLines(master, 'ACCESSORY_PURCHASE', accessoryRows, '辅料')
  }

  writeSnapshot(snapshot)
  return {
    masterOrder: cloneRecord(master),
    tasks: master.tasks.map(cloneTask),
    createdTaskCount: 0,
    techPackOnlyProcesses: listTechPackOnlyProcesses(rows),
  }
}

export interface SubmitEngineeringTaskResultInput {
  resultImageIds?: string[]
  resultQuantity?: number
  submittedBy?: string
}

// 提交任务成果：制版与产前版样衣提交即完成；花型和调色进入待审核。
// 待前置任务要求全部前置已完成；条件任务未启用时禁止提交。
export function submitEngineeringTaskResult(
  masterOrderId: string,
  taskId: string,
  input: SubmitEngineeringTaskResultInput = {},
): { masterOrder: EngineeringMasterOrderRecord; task: EngineeringTaskRecord } {
  const snapshot = readSnapshot()
  const record = snapshot.records.find((item) => item.masterOrderId === masterOrderId)
  if (!record) throw new Error(`工程主单不存在：${masterOrderId}`)
  if (record.status !== '已发布' && record.status !== '进行中') {
    throw new Error('仅进行中的工程主单可以提交任务成果。')
  }

  const task = record.tasks.find((item) => item.taskId === taskId)
  if (!task) throw new Error(`工程任务不存在：${taskId}`)
  if (task.taskType === 'ACCESSORY_PURCHASE') {
    throw new Error('辅料下单任务只能通过绑定采购单自动完成，不能手动提交成果。')
  }
  if (task.status === '未启用') throw new Error('任务未启用，不能提交成果。')
  if (task.status === '待审核') throw new Error('任务已提交成果，等待审核。')
  if (task.status === '返工中') throw new Error('任务处于返工中，不能提交成果。')
  if (task.status === '已完成') throw new Error('任务已完成，不能重复提交成果。')
  if (task.status === '因需求变更结束') throw new Error('任务已因需求变更结束，不能提交成果。')
  if (task.status === '待前置') {
    const pendingDependencies = task.dependsOnTaskIds.filter((dependencyId) => {
      const dependency = record.tasks.find((item) => item.taskId === dependencyId)
      return !dependency || (dependency.status !== '已完成' && dependency.status !== '因需求变更结束')
    })
    if (pendingDependencies.length > 0) {
      throw new Error('前置任务未完成，不能提交成果。')
    }
  }

  if (task.taskType === 'PRE_PRODUCTION_SAMPLE') {
    const resultImageIds = (input.resultImageIds ?? []).map((item) => item.trim()).filter(Boolean)
    if (resultImageIds.length === 0) {
      throw new Error('请至少上传 1 张产前版样衣成果图片。')
    }
    if (!Number.isFinite(input.resultQuantity) || Number(input.resultQuantity) <= 0) {
      throw new Error('产前版样衣制作数量必须大于 0。')
    }
    if (!input.submittedBy?.trim()) {
      throw new Error('请填写产前版样衣成果提交人。')
    }
    input = {
      ...input,
      resultImageIds,
      resultQuantity: Number(input.resultQuantity),
      submittedBy: input.submittedBy.trim(),
    }
  }

  const submittedAt = nowText()
  const targetStatus = resolveEngineeringTaskSubmitStatus(task.taskType)
  task.status = targetStatus
  if (!task.startedAt) task.startedAt = submittedAt
  task.submittedAt = submittedAt
  if (input.resultImageIds) task.resultImageIds = [...input.resultImageIds]
  if (input.resultQuantity !== undefined) task.resultQuantity = Math.max(0, Number(input.resultQuantity || 0))
  if (input.submittedBy !== undefined) task.resultSubmittedBy = input.submittedBy.trim()
  if (targetStatus === '已完成') {
    task.firstCompletedAt = submittedAt
    task.effectiveCompletedAt = submittedAt
  }
  writeSnapshot(snapshot)
  return { masterOrder: cloneRecord(record), task: cloneTask(task) }
}
