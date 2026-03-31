import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import { listRuntimeProcessTasks, isRuntimeTaskExecutionTask } from '../src/data/fcs/runtime-process-tasks.ts'
import { listProgressExceptions } from '../src/data/fcs/store-domain-progress.ts'

type AssignResult =
  | 'UNASSIGNED'
  | 'DIRECT_ASSIGNED'
  | 'BIDDING'
  | 'AWAIT_AWARD'
  | 'AWARDED'
  | 'HOLD'
  | 'EXCEPTION'

interface ParsedMockTender {
  tenderId: string
  taskId: string
  status: 'BIDDING' | 'AWAIT_AWARD' | 'AWARDED'
  biddingDeadline: string
}

const ROOT = '/Users/laoer/Documents/higoods'
const CONTEXT_PATH = path.join(ROOT, 'src/pages/dispatch-board/context.ts')
const BOARD_DOMAIN_PATH = path.join(ROOT, 'src/pages/dispatch-board/board-domain.ts')
const DISPATCH_DOMAIN_PATH = path.join(ROOT, 'src/pages/dispatch-board/dispatch-domain.ts')
const TENDER_DOMAIN_PATH = path.join(ROOT, 'src/pages/dispatch-board/tender-domain.ts')
const EVENTS_PATH = path.join(ROOT, 'src/pages/dispatch-board/events.ts')
const CORE_PATH = path.join(ROOT, 'src/pages/dispatch-board/core.ts')
const DIALOGS_PATH = path.join(ROOT, 'src/pages/dispatch-board/dialogs.ts')

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function parseMockTenders(source: string): ParsedMockTender[] {
  const pattern = /\{\s*tenderId:\s*'([^']+)',\s*taskId:\s*'([^']+)',\s*status:\s*'(BIDDING|AWAIT_AWARD|AWARDED)'[\s\S]*?biddingDeadline:\s*'([^']+)'/g
  return Array.from(source.matchAll(pattern)).map((match) => ({
    tenderId: match[1],
    taskId: match[2],
    status: match[3] as ParsedMockTender['status'],
    biddingDeadline: match[4],
  }))
}

function parseDateLike(value: string | undefined): number {
  if (!value) return Number.NaN
  return new Date(value.replace(' ', 'T')).getTime()
}

function getExceptionTaskIds(mockTenders: ParsedMockTender[]): Set<string> {
  const active = new Set(['OPEN', 'IN_PROGRESS'])
  const blockingReasons = new Set(['DISPATCH_REJECTED', 'ACK_TIMEOUT', 'NO_BID', 'FACTORY_BLACKLISTED'])
  const set = new Set<string>()
  const mockByTaskId = new Map(mockTenders.map((item) => [item.taskId, item]))

  for (const item of listProgressExceptions()) {
    if (!active.has(item.caseStatus)) continue
    if (item.category !== 'ASSIGNMENT') continue
    if (!blockingReasons.has(item.reasonCode)) continue

    const relatedIds = item.relatedTaskIds ?? []
    if (relatedIds.length > 0) {
      relatedIds.forEach((taskId) => set.add(taskId))
      continue
    }

    if (item.sourceType === 'TASK' && item.sourceId) {
      set.add(item.sourceId)
    }
  }

  for (const task of listRuntimeProcessTasks()) {
    if (!isRuntimeTaskExecutionTask(task)) continue

    if (task.assignmentMode === 'DIRECT' && task.assignmentStatus === 'ASSIGNED') {
      if (task.acceptanceStatus !== 'ACCEPTED') {
        const acceptDeadlineMs = parseDateLike(task.acceptDeadline)
        if (Number.isFinite(acceptDeadlineMs) && Date.now() > acceptDeadlineMs) {
          set.add(task.taskId)
          continue
        }
      }

      if (task.acceptanceStatus === 'ACCEPTED' || task.status === 'IN_PROGRESS') {
        const taskDeadlineMs = parseDateLike(task.taskDeadline)
        if (Number.isFinite(taskDeadlineMs) && Date.now() > taskDeadlineMs) {
          set.add(task.taskId)
          continue
        }
      }
    }

    if (task.assignmentMode === 'BIDDING') {
      const tender = mockByTaskId.get(task.taskId)
      const deadlineMs = parseDateLike(tender?.biddingDeadline)
      if (tender?.status === 'BIDDING' && Number.isFinite(deadlineMs) && Date.now() > deadlineMs) {
        set.add(task.taskId)
      }
    }
  }

  return set
}

function deriveAssignResult(
  task: ReturnType<typeof listRuntimeProcessTasks>[number],
  hasException: boolean,
  mockByTaskId: Map<string, ParsedMockTender>,
): AssignResult {
  if (hasException) return 'EXCEPTION'

  const lastLog = task.auditLogs[task.auditLogs.length - 1]
  if (lastLog?.action === 'SET_ASSIGN_MODE' && lastLog.detail === '设为暂不分配') {
    return 'HOLD'
  }

  if (task.assignmentMode === 'BIDDING') {
    return mockByTaskId.get(task.taskId)?.status ?? 'BIDDING'
  }

  if (task.assignmentStatus === 'AWARDED') return 'AWARDED'
  if (task.assignmentStatus === 'ASSIGNING') return 'AWAIT_AWARD'
  if (task.assignmentStatus === 'BIDDING') return 'BIDDING'
  if (task.assignmentStatus === 'ASSIGNED') return 'DIRECT_ASSIGNED'
  return 'UNASSIGNED'
}

function countStatuses(mockTenders: ParsedMockTender[]): Record<AssignResult, number> {
  const tasks = listRuntimeProcessTasks().filter((task) => isRuntimeTaskExecutionTask(task))
  const mockByTaskId = new Map(mockTenders.map((item) => [item.taskId, item]))
  const exceptionTaskIds = getExceptionTaskIds(mockTenders)
  const counts: Record<AssignResult, number> = {
    UNASSIGNED: 0,
    DIRECT_ASSIGNED: 0,
    BIDDING: 0,
    AWAIT_AWARD: 0,
    AWARDED: 0,
    HOLD: 0,
    EXCEPTION: 0,
  }

  for (const task of tasks) {
    const hasException = exceptionTaskIds.has(task.taskId) || exceptionTaskIds.has(task.baseTaskId)
    counts[deriveAssignResult(task, hasException, mockByTaskId)] += 1
  }

  assert(exceptionTaskIds.size > 0, '异常任务集合不能为空')
  assert(exceptionTaskIds.size < tasks.length, '异常任务不应覆盖全部可见任务')
  return counts
}

function assertNoStandaloneDetailEntry(source: string, fileLabel: string): void {
  assert(!source.includes('open-detail-dispatch'), `${fileLabel} 仍残留 open-detail-dispatch 入口`)
  assert(!source.includes('confirm-detail-dispatch'), `${fileLabel} 仍残留 confirm-detail-dispatch 入口`)
  assert(!source.includes('detail.factoryId'), `${fileLabel} 仍残留独立 detail.factoryId 字段`)
  assert(!source.includes('detailDispatchTaskId'), `${fileLabel} 仍残留独立 detailDispatchTaskId 状态`)
  assert(!source.includes('renderDetailDispatchDialog'), `${fileLabel} 仍残留独立明细分配弹层渲染`)
}

function main(): void {
  const contextSource = read(CONTEXT_PATH)
  const boardSource = read(BOARD_DOMAIN_PATH)
  const dispatchSource = read(DISPATCH_DOMAIN_PATH)
  const tenderSource = read(TENDER_DOMAIN_PATH)
  const eventsSource = read(EVENTS_PATH)
  const coreSource = read(CORE_PATH)
  const dialogsSource = read(DIALOGS_PATH)

  const mockTenders = parseMockTenders(contextSource)
  const executionTaskIds = new Set(
    listRuntimeProcessTasks()
      .filter((task) => isRuntimeTaskExecutionTask(task))
      .map((task) => task.taskId),
  )

  assert(mockTenders.length >= 9, 'mockTenders 数量不足，无法支撑招标中/待定标/已定标分布')
  for (const tender of mockTenders) {
    assert(executionTaskIds.has(tender.taskId), `mockTender 关联的任务不存在：${tender.taskId}`)
    assert(!tender.taskId.startsWith('TASK-'), `mockTender 仍在引用旧任务 ID：${tender.taskId}`)
  }

  const counts = countStatuses(mockTenders)
  for (const [status, count] of Object.entries(counts)) {
    assert(count > 0, `${status} 当前仍为 0，状态种子分布不完整`)
  }

  for (const status of ['DIRECT_ASSIGNED', 'BIDDING', 'AWAIT_AWARD', 'AWARDED', 'HOLD', 'EXCEPTION'] as const) {
    assert(counts[status] >= 2, `${status} 当前少于 2 条，状态分布仍然过薄`)
  }

  assertNoStandaloneDetailEntry(boardSource, 'board-domain.ts')
  assertNoStandaloneDetailEntry(dispatchSource, 'dispatch-domain.ts')
  assertNoStandaloneDetailEntry(eventsSource, 'events.ts')
  assertNoStandaloneDetailEntry(coreSource, 'core.ts')
  assertNoStandaloneDetailEntry(dialogsSource, 'dialogs.ts')

  assert(dispatchSource.includes('switch-dispatch-mode'), '直接派单弹层未接入整任务/按明细模式切换')
  assert(dispatchSource.includes('dispatch.groupFactoryId'), '直接派单弹层未复用明细 group 选厂字段')
  assert(dispatchSource.includes('dispatchRuntimeTaskByDetailGroups'), '直接派单未复用既有按明细分配能力')
  assert(dispatchSource.includes('applyRuntimeDirectDispatchMeta'), '按明细直接派单后未复用统一直接派单写回逻辑')
  assert(tenderSource.includes('switch-tender-mode'), '创建招标单侧边栏未接入整任务/按明细模式切换')
  assert(tenderSource.includes('createRuntimeTaskTenderByDetailGroups'), '按明细创建招标单未复用既有明细拆分能力')

  console.log(
    [
      `任务分配状态检查通过：visibleTaskCount=${executionTaskIds.size}`,
      `UNASSIGNED=${counts.UNASSIGNED}`,
      `DIRECT_ASSIGNED=${counts.DIRECT_ASSIGNED}`,
      `BIDDING=${counts.BIDDING}`,
      `AWAIT_AWARD=${counts.AWAIT_AWARD}`,
      `AWARDED=${counts.AWARDED}`,
      `HOLD=${counts.HOLD}`,
      `EXCEPTION=${counts.EXCEPTION}`,
      `mockTenderCount=${mockTenders.length}`,
    ].join(' | '),
  )
}

main()
