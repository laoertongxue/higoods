import { readRuntimeTasks } from '../runtime-task-read-bridge.ts'
import { DEDICATED_CUTTING_FACTORY_ID, TEST_FACTORY_ID, TEST_FACTORY_NAME } from '../factory-mock-data.ts'
import { processTasks, type ProcessTask, type TaskAssignmentStatus } from '../process-tasks.ts'

export type CuttingTaskAssigneeType = 'UNASSIGNED' | 'OWN_CUTTING_FACTORY' | 'THIRD_PARTY_FACTORY' | 'CONFLICT'
export type CuttingTaskExecutionRoute = 'UNASSIGNED' | 'OWN_CUTTING' | 'FACTORY_PDA' | 'CONFLICT'

export interface CuttingTaskLink {
  cuttingTaskId: string
  cuttingTaskNo: string
  cuttingTaskAssignmentStatus: TaskAssignmentStatus | 'UNASSIGNED'
  cuttingTaskAssigneeFactoryId: string
  cuttingTaskAssigneeFactoryName: string
  cuttingTaskAssigneeType: CuttingTaskAssigneeType
  executionRoute: CuttingTaskExecutionRoute
  executionRouteLabel: string
}

export const OWN_CUTTING_FACTORY_ID = TEST_FACTORY_ID
export const OWN_CUTTING_FACTORY_NAME = `我方裁床厂（${TEST_FACTORY_NAME}）`

const THIRD_PARTY_CUTTING_FACTORY_ID = 'FACTORY-ONBOARD-0034'
const THIRD_PARTY_CUTTING_FACTORY_NAME = '定向裁演示工厂34'

type DemoCuttingAssignmentOverride = Pick<
  CuttingTaskLink,
  'cuttingTaskAssignmentStatus' | 'cuttingTaskAssigneeFactoryId' | 'cuttingTaskAssigneeFactoryName'
>

const DEMO_ASSIGNMENT_OVERRIDES: Record<string, DemoCuttingAssignmentOverride> = {
  'PO-202603-0001': {
    cuttingTaskAssignmentStatus: 'ASSIGNED',
    cuttingTaskAssigneeFactoryId: OWN_CUTTING_FACTORY_ID,
    cuttingTaskAssigneeFactoryName: OWN_CUTTING_FACTORY_NAME,
  },
  'PO-202603-0002': {
    cuttingTaskAssignmentStatus: 'AWARDED',
    cuttingTaskAssigneeFactoryId: THIRD_PARTY_CUTTING_FACTORY_ID,
    cuttingTaskAssigneeFactoryName: THIRD_PARTY_CUTTING_FACTORY_NAME,
  },
  'PO-202603-0003': {
    cuttingTaskAssignmentStatus: 'UNASSIGNED',
    cuttingTaskAssigneeFactoryId: '',
    cuttingTaskAssigneeFactoryName: '',
  },
  'PO-202603-0004': {
    cuttingTaskAssignmentStatus: 'ASSIGNED',
    cuttingTaskAssigneeFactoryId: OWN_CUTTING_FACTORY_ID,
    cuttingTaskAssigneeFactoryName: OWN_CUTTING_FACTORY_NAME,
  },
  'PO-202603-0005': {
    cuttingTaskAssignmentStatus: 'ASSIGNED',
    cuttingTaskAssigneeFactoryId: OWN_CUTTING_FACTORY_ID,
    cuttingTaskAssigneeFactoryName: OWN_CUTTING_FACTORY_NAME,
  },
  'PO-202603-0006': {
    cuttingTaskAssignmentStatus: 'ASSIGNED',
    cuttingTaskAssigneeFactoryId: OWN_CUTTING_FACTORY_ID,
    cuttingTaskAssigneeFactoryName: OWN_CUTTING_FACTORY_NAME,
  },
  'PO-202603-0007': {
    cuttingTaskAssignmentStatus: 'ASSIGNED',
    cuttingTaskAssigneeFactoryId: OWN_CUTTING_FACTORY_ID,
    cuttingTaskAssigneeFactoryName: OWN_CUTTING_FACTORY_NAME,
  },
  'PO-202603-0101': {
    cuttingTaskAssignmentStatus: 'AWARDED',
    cuttingTaskAssigneeFactoryId: THIRD_PARTY_CUTTING_FACTORY_ID,
    cuttingTaskAssigneeFactoryName: THIRD_PARTY_CUTTING_FACTORY_NAME,
  },
  'PO-202603-0102': {
    cuttingTaskAssignmentStatus: 'UNASSIGNED',
    cuttingTaskAssigneeFactoryId: '',
    cuttingTaskAssigneeFactoryName: '',
  },
}

function normalizeText(value: string | null | undefined): string {
  return String(value || '').trim()
}

function slugToken(value: string | null | undefined): string {
  return normalizeText(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function isCuttingProcessTask(task: ProcessTask | null | undefined): boolean {
  if (!task) return false
  return (
    task.processBusinessCode === 'CUT_PANEL'
    || task.processCode === 'PROC_CUT'
    || task.processNameZh === '裁片'
    || task.processBusinessName === '裁片'
  )
}

function findCuttingTask(productionOrderId: string, productionOrderNo: string, sourceEntryIds: string[] = [], sourceBomItemIds: string[] = []): ProcessTask | null {
  const candidates = processTasks.filter(task => isCuttingProcessTask(task)
    && (task.productionOrderId === productionOrderId || task.productionOrderId === productionOrderNo))
  const matches = candidates.filter(task => sourceEntryIds.length
    ? [task.sourceEntryId, ...(task.sourceEntryIds || [])].some(id => id && sourceEntryIds.includes(id))
    : sourceBomItemIds.some(id => task.consumedBomItemIds?.includes(id)
      || task.routeObjectKey === `BOM:${id}` || task.routeObjectKeys?.includes(`BOM:${id}`)))
  if (matches.length === 1) return matches[0]
  // Legacy orders without occurrence/BOM references may use their sole CUT task only.
  if (!sourceEntryIds.length && candidates.length === 1
    && !candidates[0].consumedBomItemIds?.length
    && !candidates[0].routeObjectKey?.startsWith('BOM:')
    && !candidates[0].routeObjectKeys?.some(key => key.startsWith('BOM:'))) return candidates[0]
  return null
}

/** Same installed execution-task reader used by the PDA; no runtime-domain import cycle. */
export function listCuttingRuntimeAssignmentFacts(): ProcessTask[] {
  return readRuntimeTasks<ProcessTask>().filter(task => isCuttingProcessTask(task)
    && task.executionEnabled !== false && task.isSplitSource !== true)
}

function resolveDemoOverride(productionOrderId: string, productionOrderNo: string): DemoCuttingAssignmentOverride | null {
  return DEMO_ASSIGNMENT_OVERRIDES[productionOrderNo] || DEMO_ASSIGNMENT_OVERRIDES[productionOrderId] || null
}

export function resolveCuttingTaskAssigneeType(factoryId: string): CuttingTaskAssigneeType {
  const normalizedFactoryId = normalizeText(factoryId)
  if (!normalizedFactoryId) return 'UNASSIGNED'
  if (normalizedFactoryId === DEDICATED_CUTTING_FACTORY_ID || normalizedFactoryId === OWN_CUTTING_FACTORY_ID || normalizedFactoryId === `ID-${OWN_CUTTING_FACTORY_ID}`) {
    return 'OWN_CUTTING_FACTORY'
  }
  return 'THIRD_PARTY_FACTORY'
}

export function resolveCuttingTaskExecutionRoute(factoryId: string): CuttingTaskExecutionRoute {
  const type = resolveCuttingTaskAssigneeType(factoryId)
  if (type === 'OWN_CUTTING_FACTORY') return 'OWN_CUTTING'
  if (type === 'THIRD_PARTY_FACTORY') return 'FACTORY_PDA'
  if (type === 'CONFLICT') return 'CONFLICT'
  return 'UNASSIGNED'
}

export function getCuttingTaskExecutionRouteLabel(route: CuttingTaskExecutionRoute): string {
  if (route === 'OWN_CUTTING') return '我方裁床厂执行'
  if (route === 'FACTORY_PDA') return '三方工厂 PDA 执行'
  if (route === 'CONFLICT') return '承接方冲突'
  return '待分配承接方'
}

export function resolveCuttingTaskLink(input: {
  productionOrderId: string
  productionOrderNo: string
  sourceEntryIds?: string[]
  sourceBomItemIds?: string[]
}): CuttingTaskLink {
  const productionOrderId = normalizeText(input.productionOrderId)
  const productionOrderNo = normalizeText(input.productionOrderNo) || productionOrderId
  const task = findCuttingTask(productionOrderId, productionOrderNo, input.sourceEntryIds, input.sourceBomItemIds)
  const fallbackTaskId = `CUTTASK-${slugToken(productionOrderNo || productionOrderId)}`
  const rootEntries = task ? [task.sourceEntryId, ...(task.sourceEntryIds || [])].filter(Boolean) : []
  const runtimeChildren = task ? listCuttingRuntimeAssignmentFacts().filter(child =>
    child.productionOrderId === task.productionOrderId
    && (child.taskId === task.taskId || child.rootTaskNo === (task.taskNo || task.taskId))
    && (!rootEntries.length || [child.sourceEntryId, ...(child.sourceEntryIds || [])].some(id => rootEntries.includes(id))),
  ) : []
  const assignments = new Map(runtimeChildren.map(child => [
    JSON.stringify([child.assignedFactoryId || '', child.assignmentStatus]), child,
  ]))
  const conflict = assignments.size > 1
  const runtime = assignments.size === 1 ? [...assignments.values()][0] : null
  // A current execution assignment, including UNASSIGNED, takes precedence over historical demo values.
  const override = runtimeChildren.length || (!task && (input.sourceEntryIds?.length || input.sourceBomItemIds?.length))
    ? null : resolveDemoOverride(productionOrderId, productionOrderNo)
  const factoryId = conflict ? '' : normalizeText(runtime ? runtime.assignedFactoryId : override?.cuttingTaskAssigneeFactoryId || task?.assignedFactoryId)
  const factoryName = conflict ? '' : normalizeText(runtime ? runtime.assignedFactoryName : override?.cuttingTaskAssigneeFactoryName || task?.assignedFactoryName)
  const assignmentStatus = conflict ? 'UNASSIGNED' : runtime?.assignmentStatus || override?.cuttingTaskAssignmentStatus || task?.assignmentStatus || 'UNASSIGNED'
  const executionRoute = conflict ? 'CONFLICT' : resolveCuttingTaskExecutionRoute(factoryId)

  return {
    cuttingTaskId: normalizeText(task?.taskId) || fallbackTaskId,
    cuttingTaskNo: normalizeText(task?.taskNo) || fallbackTaskId,
    cuttingTaskAssignmentStatus: assignmentStatus,
    cuttingTaskAssigneeFactoryId: factoryId,
    cuttingTaskAssigneeFactoryName: factoryName,
    cuttingTaskAssigneeType: conflict ? 'CONFLICT' : resolveCuttingTaskAssigneeType(factoryId),
    executionRoute,
    executionRouteLabel: getCuttingTaskExecutionRouteLabel(executionRoute),
  }
}

export function resolveCombinedCuttingTaskRoute(links: CuttingTaskLink[]): {
  executionRoute: CuttingTaskExecutionRoute
  executionRouteLabel: string
  assigneeFactoryIds: string[]
  assigneeFactoryNames: string[]
  assignmentStatusLabels: string[]
} {
  const assigneeFactoryIds = Array.from(new Set(links.map((item) => normalizeText(item.cuttingTaskAssigneeFactoryId)).filter(Boolean)))
  const assigneeFactoryNames = Array.from(new Set(links.map((item) => normalizeText(item.cuttingTaskAssigneeFactoryName)).filter(Boolean)))
  const assignmentStatusLabels = Array.from(new Set(links.map((item) => getCuttingTaskAssignmentStatusLabel(item.cuttingTaskAssignmentStatus))))
  const hasUnassignedTask = links.some((item) => !normalizeText(item.cuttingTaskAssigneeFactoryId))
  const executionRoute =
    assigneeFactoryIds.length > 1
      ? 'CONFLICT'
      : assigneeFactoryIds.length === 1 && !hasUnassignedTask
        ? resolveCuttingTaskExecutionRoute(assigneeFactoryIds[0])
        : 'UNASSIGNED'
  return {
    executionRoute,
    executionRouteLabel: getCuttingTaskExecutionRouteLabel(executionRoute),
    assigneeFactoryIds,
    assigneeFactoryNames,
    assignmentStatusLabels,
  }
}

export function getCuttingTaskAssignmentStatusLabel(status: TaskAssignmentStatus | 'UNASSIGNED' | undefined): string {
  if (status === 'ASSIGNED') return '已派单'
  if (status === 'ASSIGNING') return '派单中'
  if (status === 'BIDDING') return '竞价中'
  if (status === 'AWARDED') return '已定标'
  return '未分配'
}

export function isOwnCuttingExecutionRoute(route: CuttingTaskExecutionRoute | undefined): boolean {
  return route === 'OWN_CUTTING'
}
