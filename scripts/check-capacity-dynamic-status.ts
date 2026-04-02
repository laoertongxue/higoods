import fs from 'node:fs'
import path from 'node:path'

import {
  buildCapacityCalendarData,
  buildCapacityRiskData,
  buildCapacityBottleneckData,
  CAPACITY_CALENDAR_STATUS_LABEL,
} from '../src/data/fcs/capacity-calendar.ts'
import {
  candidateFactories,
  createDispatchCapacityEvaluationContext,
  resolveTaskFactoryCapacityConstraint,
  resolveAllocatableGroupFactoryCapacityConstraint,
  resolveTenderFactoryCapacityConstraint,
} from '../src/pages/dispatch-board/context.ts'
import {
  isRuntimeTaskExecutionTask,
  listRuntimeProcessTasks,
  listRuntimeTaskAllocatableGroups,
} from '../src/data/fcs/runtime-process-tasks.ts'

const ROOT = '/Users/laoer/Documents/higoods'
const CAPACITY_PAGE_PATH = path.join(ROOT, 'src/pages/capacity.ts')
const CAPACITY_DATA_PATH = path.join(ROOT, 'src/data/fcs/capacity-calendar.ts')
const CAPACITY_PROFILE_PAGE_PATH = path.join(ROOT, 'src/pages/factory-capacity-profile.ts')
const CAPACITY_PROFILE_DATA_PATH = path.join(ROOT, 'src/data/fcs/factory-capacity-profile-mock.ts')
const DISPATCH_CONTEXT_PATH = path.join(ROOT, 'src/pages/dispatch-board/context.ts')
const DISPATCH_DOMAIN_PATH = path.join(ROOT, 'src/pages/dispatch-board/dispatch-domain.ts')
const TENDER_DOMAIN_PATH = path.join(ROOT, 'src/pages/dispatch-board/tender-domain.ts')

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message)
  }
}

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8')
}

function hasStatusSet(statuses: Set<string>, required: string[]): boolean {
  return required.every((status) => statuses.has(status))
}

function main(): void {
  const pageSource = read(CAPACITY_PAGE_PATH)
  const dataSource = read(CAPACITY_DATA_PATH)
  const profilePageSource = read(CAPACITY_PROFILE_PAGE_PATH)
  const profileDataSource = read(CAPACITY_PROFILE_DATA_PATH)
  const dispatchContextSource = read(DISPATCH_CONTEXT_PATH)
  const dispatchDomainSource = read(DISPATCH_DOMAIN_PATH)
  const tenderDomainSource = read(TENDER_DOMAIN_PATH)

  for (const token of [
    'export function isCapacityPaused(',
    'export function computeCapacityStatus(',
    'export function buildCapacityStatusBadge(',
    'export function resolveFactoryWindowStatus(',
    'export function resolveFactoryTaskWindowJudgement(',
  ]) {
    assert(dataSource.includes(token), `缺少统一状态 helper：${token}`)
  }

  assert(pageSource.includes('当前状态'), '产能日历页面仍未接入“当前状态”展示')
  assert(pageSource.includes('暂停任务数'), '任务工时风险页未接入暂停动态状态')
  assert(pageSource.includes('紧张天数'), '工艺瓶颈页未接入紧张天数')
  assert(pageSource.includes('暂停天数'), '工艺瓶颈页未接入暂停天数')
  assert(pageSource.includes('当日暂停工厂数'), '日期瓶颈页未接入当日暂停工厂数')
  assert(pageSource.includes('当日紧张工艺数'), '日期瓶颈页未接入当日紧张工艺数')

  assert(dispatchContextSource.includes('describeDispatchCapacityConstraintDecision'), 'dispatch context 未统一输出动态状态说明')
  assert(dispatchContextSource.includes('当前窗口暂停，不可选'), 'dispatch context 未说明暂停硬拦截')
  assert(dispatchContextSource.includes('当前窗口超载，不可选'), 'dispatch context 未说明超载硬拦截')
  assert(dispatchContextSource.includes('当前窗口紧张，可选但需预警'), 'dispatch context 未说明紧张软预警')
  assert(dispatchContextSource.includes('日期不足，仅提示无法完全校验'), 'dispatch context 未说明日期不足仅提示')
  assert(!dispatchContextSource.includes('currentStatus:'), 'dispatch context 仍残留静态 currentStatus mock')

  assert(dispatchDomainSource.includes('data-dispatch-group-constraint'), '直接派单按明细模式缺少分组动态状态判断')
  assert(tenderDomainSource.includes('data-tender-factory-group-status'), '创建招标单按明细模式缺少分组动态状态判断')

  assert(!profilePageSource.includes('buildCapacityStatusBadge('), '动态状态不应放回产能档案页面')
  assert(!profileDataSource.includes('CapacityCalendarStatus'), '动态状态不应放回产能档案 mock')
  assert(!dataSource.includes('复盘工时'), '不应引入复盘工时字段或说明')
  assert(!dataSource.includes('replaySam'), '不应引入复盘工时 SAM 逻辑')

  const comparison = buildCapacityCalendarData().comparisonRows
  const comparisonCounts = comparison.reduce<Record<string, number>>((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1
    return acc
  }, {})
  for (const status of Object.keys(CAPACITY_CALENDAR_STATUS_LABEL)) {
    assert((comparisonCounts[status] ?? 0) > 0, `供需总览/工厂日历仍缺少动态状态样例：${status}`)
  }

  const riskRows = buildCapacityRiskData().taskRows
  const riskCounts = riskRows.reduce<Record<string, number>>((acc, row) => {
    acc[row.conclusion] = (acc[row.conclusion] ?? 0) + 1
    return acc
  }, {})
  for (const conclusion of ['CAPABLE', 'TIGHT', 'EXCEEDS_WINDOW', 'PAUSED', 'FROZEN_PENDING', 'UNALLOCATED', 'UNSCHEDULED']) {
    assert((riskCounts[conclusion] ?? 0) > 0, `任务风险仍缺少场景样例：${conclusion}`)
  }

  const bottleneck = buildCapacityBottleneckData()
  assert(bottleneck.craftRows.some((row) => row.overloadDayCount > 0), '工艺瓶颈榜缺少超载天数样例')
  assert(bottleneck.craftRows.some((row) => row.tightDayCount > 0), '工艺瓶颈榜缺少紧张天数样例')
  assert(bottleneck.craftRows.some((row) => row.pausedDayCount > 0), '工艺瓶颈榜缺少暂停天数样例')
  assert(bottleneck.craftRows.some((row) => row.unallocatedSam > 0), '工艺瓶颈榜缺少待分配标准工时样例')
  assert(bottleneck.craftRows.some((row) => row.unscheduledSam > 0), '工艺瓶颈榜缺少未排期标准工时样例')
  assert(bottleneck.dateRows.some((row) => row.pausedFactoryCount > 0), '日期瓶颈榜缺少暂停工厂样例')
  assert(bottleneck.dateRows.some((row) => row.tightCraftCount > 0), '日期瓶颈榜缺少紧张工艺样例')
  assert(bottleneck.dateRows.some((row) => row.overloadedFactoryCount > 0), '日期瓶颈榜缺少超载工厂样例')
  assert(bottleneck.dateRows.some((row) => row.unallocatedSam > 0), '日期瓶颈榜缺少待分配标准工时样例')

  const executionTasks = listRuntimeProcessTasks().filter((task) => isRuntimeTaskExecutionTask(task))
  const capacityContext = createDispatchCapacityEvaluationContext()

  const wholeTask = executionTasks.find((task) => {
    const statuses = new Set<string>()
    for (const factory of candidateFactories) {
      const snapshot = resolveTaskFactoryCapacityConstraint(task, factory.id, factory.name, capacityContext)
      if (snapshot) statuses.add(snapshot.status)
    }
    return hasStatusSet(statuses, ['NORMAL', 'TIGHT', 'OVERLOADED', 'PAUSED'])
  })
  assert(wholeTask, '整任务模式下仍找不到同时覆盖正常/紧张/超载/暂停的工厂候选场景')

  const detailCandidate = executionTasks.find((task) => {
    const groups = listRuntimeTaskAllocatableGroups(task.taskId)
    if (groups.length < 2) return false
    return groups.some((group) => {
      const statuses = new Set<string>()
      for (const factory of candidateFactories) {
        const snapshot = resolveAllocatableGroupFactoryCapacityConstraint(task, group, factory.id, factory.name, capacityContext)
        if (snapshot) statuses.add(snapshot.status)
      }
      return hasStatusSet(statuses, ['NORMAL', 'TIGHT', 'OVERLOADED', 'PAUSED'])
    })
  })
  assert(detailCandidate, '按明细模式下仍找不到逐组覆盖正常/紧张/超载/暂停的状态判断场景')

  const dateIncompleteTask = executionTasks.find((task) => {
    for (const factory of candidateFactories) {
      const snapshot = resolveTaskFactoryCapacityConstraint(task, factory.id, factory.name, capacityContext)
      if (snapshot?.status === 'DATE_INCOMPLETE') return true
    }
    return false
  })
  assert(dateIncompleteTask, '仍缺少日期不足的工厂约束校验场景')

  const wholeTenderTask = executionTasks.find((task) => {
    const statuses = new Set<string>()
    for (const factory of candidateFactories) {
      const snapshot = resolveTenderFactoryCapacityConstraint(task, factory.id, factory.name, [], capacityContext)
      if (snapshot) statuses.add(snapshot.status)
    }
    return hasStatusSet(statuses, ['NORMAL', 'TIGHT', 'OVERLOADED', 'PAUSED'])
  })
  assert(wholeTenderTask, '创建招标单整任务模式仍缺少动态状态覆盖场景')

  console.log(
    [
      '产能日历动态状态检查通过：',
      `calendar=${JSON.stringify(comparisonCounts)}`,
      `risk=${JSON.stringify(riskCounts)}`,
      `wholeTask=${wholeTask.taskId}`,
      `detailTask=${detailCandidate.taskId}`,
      `dateIncompleteTask=${dateIncompleteTask.taskId}`,
      `wholeTenderTask=${wholeTenderTask.taskId}`,
    ].join(' '),
  )
}

main()
