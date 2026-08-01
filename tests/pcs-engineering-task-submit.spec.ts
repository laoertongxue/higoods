import assert from 'node:assert/strict'
import fs from 'node:fs'

import { listStyleArchives, resetStyleArchiveRepository } from '../src/data/pcs-style-archive-repository.ts'
import {
  createEngineeringMasterOrder,
  getEngineeringMasterOrderById,
  publishEngineeringMasterOrder,
  resetEngineeringMasterRepository,
  submitEngineeringTaskResult,
} from '../src/data/pcs-engineering-master-repository.ts'
import { resolveEngineeringTaskSubmitStatus } from '../src/data/pcs-engineering-dependency-policy.ts'
import { handlePcsEngineeringMasterDetailEvent } from '../src/pages/pcs-engineering-master-detail.ts'

resetStyleArchiveRepository()
resetEngineeringMasterRepository()

const freshStyle = listStyleArchives()[0]
assert.ok(freshStyle, '应存在正式款式档案演示数据')

const master = createEngineeringMasterOrder({
  styleId: freshStyle.styleId,
  styleCode: freshStyle.styleCode,
  merchandiserName: '跟单C',
})
const published = publishEngineeringMasterOrder(master.masterOrderId)

// 提交目标状态分派：制版与产前版样衣提交即完成；只有花型和调色进入待审核。
assert.equal(resolveEngineeringTaskSubmitStatus('BASE_PATTERN_WOVEN'), '已完成')
assert.equal(resolveEngineeringTaskSubmitStatus('BASE_PATTERN_KNIT'), '已完成')
assert.equal(resolveEngineeringTaskSubmitStatus('PRE_PRODUCTION_SAMPLE'), '已完成')
assert.equal(resolveEngineeringTaskSubmitStatus('SIZE_PATTERN_WOVEN'), '已完成')
assert.equal(resolveEngineeringTaskSubmitStatus('SIZE_PATTERN_KNIT'), '已完成')
assert.equal(resolveEngineeringTaskSubmitStatus('PATTERN_ARTWORK'), '待审核')
assert.equal(resolveEngineeringTaskSubmitStatus('COLOR_YARN'), '待审核')
assert.equal(resolveEngineeringTaskSubmitStatus('COLOR_FABRIC'), '待审核')
assert.equal(resolveEngineeringTaskSubmitStatus('ACCESSORY_PURCHASE'), '已完成')
assert.equal(resolveEngineeringTaskSubmitStatus('TECH_PACK_CONFIRMATION'), '已完成')

const taskId = (taskType: string) => `${master.masterOrderId}-${taskType}`

// 待开始任务提交成果：制版直接完成，写入提交与完成时间
const wovenResult = submitEngineeringTaskResult(
  master.masterOrderId,
  taskId('BASE_PATTERN_WOVEN'),
)
assert.equal(wovenResult.task.status, '已完成')
assert.ok(wovenResult.task.submittedAt, '提交后应记录提交时间')
assert.ok(wovenResult.task.firstCompletedAt, '提交即完成应记录首次完成时间')
assert.equal(wovenResult.task.effectiveCompletedAt, wovenResult.task.firstCompletedAt)

// 待前置且前置未完成：禁止提交
assert.throws(
  () => submitEngineeringTaskResult(master.masterOrderId, taskId('PRE_PRODUCTION_SAMPLE')),
  /前置/,
  '前置任务未完成时样衣任务不得提交',
)

// 前置完成后待前置任务可提交：产前版样衣提交即完成
submitEngineeringTaskResult(master.masterOrderId, taskId('BASE_PATTERN_KNIT'))
const sampleResult = submitEngineeringTaskResult(
  master.masterOrderId,
  taskId('PRE_PRODUCTION_SAMPLE'),
)
assert.equal(sampleResult.task.status, '已完成')
assert.ok(sampleResult.task.submittedAt, '样衣提交应记录提交时间')

// 条件任务未启用：禁止提交
assert.throws(
  () => submitEngineeringTaskResult(master.masterOrderId, taskId('PATTERN_ARTWORK')),
  /未启用/,
  '花型任务未启用时不得提交',
)

// 已完成任务重复提交：禁止
assert.throws(
  () => submitEngineeringTaskResult(master.masterOrderId, taskId('BASE_PATTERN_WOVEN')),
  /已完成/,
  '已完成任务不得重复提交',
)

// 删除任务级样衣验收：制作团队提交首版样衣结果后直接形成“已通过”业务状态，
// 不得再保留“待确认 -> 确认完成”的第二次任务动作。
const engineeringTaskPageSource = fs.readFileSync('src/pages/pcs-engineering-tasks.ts', 'utf8')
const submitFirstSampleResultSource = engineeringTaskPageSource.slice(
  engineeringTaskPageSource.indexOf('function submitFirstSampleResult()'),
  engineeringTaskPageSource.indexOf('function submitFirstOrderCreate()'),
)
const advanceFirstSampleTaskSource = engineeringTaskPageSource.slice(
  engineeringTaskPageSource.indexOf('function advanceFirstSampleTask('),
  engineeringTaskPageSource.indexOf('function advanceFirstOrderTask('),
)
assert.match(
  submitFirstSampleResultSource,
  /status:\s*'已通过'/,
  '首版样衣结果提交后应直接形成已通过状态',
)
assert.doesNotMatch(
  submitFirstSampleResultSource,
  /status:\s*'待确认'/,
  '首版样衣结果提交后不得再进入任务级待确认',
)
assert.doesNotMatch(
  advanceFirstSampleTaskSource,
  /task\.status\s*===\s*'待确认'|确认完成/,
  '首版样衣任务推进不得保留第二次确认动作',
)

// 工程主单详情提交后必须局部刷新泳道与反馈区域，不能依赖整页重绘。
const lanesHost = { innerHTML: '' }
const drawerHost = { innerHTML: '' }
const feedbackHost = { innerHTML: '' }
const originalWindow = globalThis.window
const originalDocument = globalThis.document
Object.defineProperty(globalThis, 'window', {
  configurable: true,
  value: { location: { pathname: `/pcs/engineering/masters/${master.masterOrderId}` } },
})
Object.defineProperty(globalThis, 'document', {
  configurable: true,
  value: {
    querySelector(selector: string) {
      if (selector === '[data-engineering-master-region="lanes"]') return lanesHost
      if (selector === '[data-engineering-master-region="drawer"]') return drawerHost
      if (selector === '[data-engineering-master-region="feedback"]') return feedbackHost
      return null
    },
    querySelectorAll() { return [] },
  },
})
const accessoryTaskId = taskId('ACCESSORY_PURCHASE')
const handled = handlePcsEngineeringMasterDetailEvent({
  closest(selector: string) {
    if (selector !== '[data-pcs-engineering-master-action]') return null
    return {
      dataset: {
        pcsEngineeringMasterAction: 'submit-task-result',
        taskId: accessoryTaskId,
      },
    }
  },
} as unknown as HTMLElement)
assert.equal(handled, true)
assert.equal(
  getEngineeringMasterOrderById(master.masterOrderId)?.tasks.find((task) => task.taskId === accessoryTaskId)?.status,
  '已完成',
  '详情提交成果应更新工程任务事实源',
)
assert.match(lanesHost.innerHTML, /已完成/, '提交后应局部刷新泳道区域')
assert.match(feedbackHost.innerHTML, /已提交成果.*已完成/s, '提交后应在局部反馈区域展示结果')
Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow })
Object.defineProperty(globalThis, 'document', { configurable: true, value: originalDocument })

console.log('pcs-engineering-task-submit.spec.ts PASS')
