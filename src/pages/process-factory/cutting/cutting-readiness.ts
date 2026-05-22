import { listPdaCuttingTaskScenarios } from '../../../data/fcs/cutting/pda-cutting-task-scenarios.ts'

export interface CutOrderStartState {
  started: boolean
  taskId: string
  taskNo: string
  taskStatus: string
  startedAt: string
}

const STARTED_TASK_STATUSES = new Set(['IN_PROGRESS', 'DONE', 'COMPLETED'])

function isStartedTask(status: string, startedAt: string): boolean {
  return Boolean(startedAt) || STARTED_TASK_STATUSES.has(status)
}

function createWaitingStartState(): CutOrderStartState {
  return {
    started: false,
    taskId: '',
    taskNo: '',
    taskStatus: '',
    startedAt: '',
  }
}

function pickStartState(current: CutOrderStartState | undefined, next: CutOrderStartState): CutOrderStartState {
  if (!current) return next
  if (next.started && !current.started) return next
  if (next.startedAt && next.startedAt.localeCompare(current.startedAt, 'zh-CN') > 0) return next
  return current
}

export function buildCutOrderStartStateLookup(): Record<string, CutOrderStartState> {
  const lookup: Record<string, CutOrderStartState> = {}
  listPdaCuttingTaskScenarios().forEach((scenario) => {
    const taskStatus = String(scenario.taskStatus || '')
    const startedAt = scenario.startedAt || ''
    const startState: CutOrderStartState = {
      started: isStartedTask(taskStatus, startedAt),
      taskId: scenario.taskId,
      taskNo: scenario.taskNo,
      taskStatus,
      startedAt,
    }

    scenario.executions.forEach((execution) => {
      const keys = [execution.cutOrderId, execution.cutOrderNo].filter(Boolean)
      keys.forEach((key) => {
        lookup[key] = pickStartState(lookup[key], startState)
      })
    })
  })

  return lookup
}

export function resolveCutOrderStartState(
  lookup: Record<string, CutOrderStartState>,
  source: {
    cutOrderId?: string
    cutOrderNo?: string
    cutPieceOrderNo?: string
  },
): CutOrderStartState {
  return (
    lookup[source.cutOrderId || ''] ||
    lookup[source.cutOrderNo || ''] ||
    lookup[source.cutPieceOrderNo || ''] ||
    createWaitingStartState()
  )
}
