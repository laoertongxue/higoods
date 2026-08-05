import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const page = readFileSync('src/pages/unified-dispatch-workbench.ts', 'utf8')
const taskFacts = readFileSync('src/data/fcs/process-tasks.ts', 'utf8')

const requiredVisibleFacts = [
  '自动分配配置',
  '执行自动分配',
  '默认承接工厂',
  '任务截止天数',
  '任务/技术包标准价',
  '本次可自动派单',
  '谨慎确认价格，一经提交确认不得修改。',
  '确认执行并冻结价格',
]

requiredVisibleFacts.forEach((fact) => assert.ok(page.includes(fact), `缺少自动分配页面事实：${fact}`))

const scopeGates = [
  'policy.isIndependentTask',
  '!policy.startsWithSewing',
  "task.taskUnitType === 'SINGLE_PROCESS_TASK'",
  'task.allowAutoDispatch !== false',
  "task.assignmentStatus === 'UNASSIGNED'",
]

scopeGates.forEach((gate) => assert.ok(page.includes(gate), `缺少自动分配范围门禁：${gate}`))

assert.ok(page.includes('createEffectiveTaskAssignment({'), '自动分配必须形成有效派单记录')
assert.ok(page.includes('applyRuntimeDirectDispatchMeta({'), '自动分配必须写入运行时派单事实')
assert.ok(page.includes('addNaturalDays(operatedAt, config.deadlineDays)'), '任务截止日期必须按自然日配置计算')
assert.ok(page.includes('autoAccept: false'), '自动分配不得绕过接单时效规则')
assert.ok(page.includes('invalidFactory') && page.includes('invalidPrice'), '预览必须显式统计工厂和价格异常')
assert.ok(page.includes('failed.push'), '批量执行必须保留逐任务失败结果')
assert.ok(page.includes("task.craftCode || 'NO_CRAFT'"), '自动分配配置必须按工序和工艺共同区分')

const executeBody = page.slice(page.indexOf('function executeAutomaticDispatch'), page.indexOf('function renderImagePreview'))
assert.ok(!executeBody.includes('contract'), '自动分配执行不得生成合同')
assert.ok(!executeBody.includes('PDA'), '自动分配执行不得扩大 PDA 行为')
assert.ok(!executeBody.includes('bagging'), '自动分配执行不得修改菲票装袋事实')
assert.ok(taskFacts.includes('resolveGeneratedTaskStandardPrice(processCode)'), '演示任务必须带有可追溯的工序标准价快照')
assert.ok(taskFacts.includes("standardPriceCurrency: 'IDR'") && taskFacts.includes("standardPriceUnit: '件'"), '演示标准价必须包含币种和计价单位')

console.log('FCS 自动分配检查通过：配置、范围门禁、预览、自然日、价格二次确认、有效派单与非范围契约全部通过。')
