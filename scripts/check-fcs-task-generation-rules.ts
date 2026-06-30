#!/usr/bin/env node

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

function read(relativePath: string): string {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8')
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(ROOT, relativePath))
}

function assertIncludes(source: string, token: string, message: string): void {
  assert(source.includes(token), message)
}

function assertNotIncludes(source: string, token: string, message: string): void {
  assert(!source.includes(token), message)
}

function assertMatches(source: string, pattern: RegExp, message: string): void {
  assert(pattern.test(source), message)
}

function getMenuSection(source: string, sectionKey: string): string {
  const start = source.indexOf(`key: '${sectionKey}'`)
  assert(start >= 0, `菜单缺少 ${sectionKey}`)
  const nextSection = source.indexOf('\n        {\n          key:', start + 1)
  return source.slice(start, nextSection >= 0 ? nextSection : source.length)
}

async function main(): Promise<void> {
  const packageSource = read('package.json')
  const menuSource = read('src/data/app-shell-config.ts')
  const routesSource = read('src/router/routes-fcs.ts')
  const rendererFcsSource = read('src/router/route-renderers-fcs.ts')
  const rendererSource = read('src/router/route-renderers.ts')
  const eventsSource = read('src/pages/production/events.ts')
  const processTasksSource = read('src/data/fcs/process-tasks.ts')
  const runtimeTasksSource = read('src/data/fcs/runtime-process-tasks.ts')
  const taskBreakdownSource = read('src/pages/task-breakdown.ts')
  const ordersDomainSource = read('src/pages/production/orders-domain.ts')
  const rulesPageSource = read('src/pages/production/task-generation-rules.ts')
  const dispatchCoreSource = read('src/pages/dispatch-board/core.ts')
  const dispatchDomainSource = read('src/pages/dispatch-board/dispatch-domain.ts')
  const pdaTodoSource = read('src/data/fcs/factory-mobile-todos.ts')
  const pdaReceiveSource = read('src/pages/pda-task-receive.ts')
  const pdaExecSource = read('src/pages/pda-exec.ts')
  const pdaExecDetailSource = read('src/pages/pda-exec-detail.ts')

  assertIncludes(packageSource, 'check:fcs-task-generation-rules', 'package.json 缺少 check:fcs-task-generation-rules')

  const productionMenu = getMenuSection(menuSource, 'fcs-platform-production')
  const processMenu = getMenuSection(menuSource, 'fcs-platform-process')
  assertIncludes(productionMenu, 'production-task-generation-rules', '生产单管理菜单缺少生产单任务生成规则')
  assertIncludes(productionMenu, '/fcs/production/task-generation-rules', '生产单任务生成规则 href 不正确')
  assert(
    productionMenu.indexOf('production-task-generation-rules') < productionMenu.indexOf('production-demand-inbox'),
    '生产单任务生成规则必须位于生产需求单之前',
  )
  assertNotIncludes(processMenu, 'production-task-generation-rules', '任务编排与执行准备下不得出现生产单任务生成规则')

  assertIncludes(routesSource, '/fcs/production/task-generation-rules', 'routes-fcs.ts 缺少任务生成规则路由')
  assertIncludes(routesSource, '/fcs/production/task-generation-rules/new', 'routes-fcs.ts 缺少新增规则页面路由')
  assertIncludes(routesSource, 'renderProductionTaskGenerationRuleDetailPage', 'routes-fcs.ts 缺少规则详情页面路由')
  assertIncludes(routesSource, 'renderProductionTaskGenerationRuleEditPage', 'routes-fcs.ts 缺少编辑规则页面路由')
  assertIncludes(rendererFcsSource, 'renderProductionTaskGenerationRulesPage', 'route-renderers-fcs.ts 缺少任务生成规则 renderer')
  assertIncludes(rendererFcsSource, 'renderProductionTaskGenerationRuleCreatePage', 'route-renderers-fcs.ts 缺少新增规则 renderer')
  assertIncludes(rendererFcsSource, 'renderProductionTaskGenerationRuleDetailPage', 'route-renderers-fcs.ts 缺少规则详情 renderer')
  assertIncludes(rendererFcsSource, 'renderProductionTaskGenerationRuleEditPage', 'route-renderers-fcs.ts 缺少编辑规则 renderer')
  assertIncludes(rendererSource, 'renderProductionTaskGenerationRulesPage', 'route-renderers.ts 缺少任务生成规则 renderer')
  assertIncludes(rendererSource, 'renderProductionTaskGenerationRuleCreatePage', 'route-renderers.ts 缺少新增规则 renderer')
  assertIncludes(rendererSource, 'renderProductionTaskGenerationRuleDetailPage', 'route-renderers.ts 缺少规则详情 renderer')
  assertIncludes(rendererSource, 'renderProductionTaskGenerationRuleEditPage', 'route-renderers.ts 缺少编辑规则 renderer')
  assert(exists('src/pages/production/task-generation-rules.ts'), '缺少规则页面 src/pages/production/task-generation-rules.ts')
  assert(exists('src/data/fcs/production-task-generation-rules.ts'), '缺少规则域 src/data/fcs/production-task-generation-rules.ts')

  assertIncludes(eventsSource, 'confirm-task-generation-preview', '生产单事件缺少确认生成任务动作')
  assertNotIncludes(eventsSource, 'const changed = applyOrderTaskBreakdown([orderId])', '单个拆解不得直接 applyOrderTaskBreakdown')
  assertNotIncludes(eventsSource, 'const changed = applyOrderTaskBreakdown(selectedIds)', '批量拆解不得直接 applyOrderTaskBreakdown')

  ;['taskUnitType', 'coveredProcesses', 'generationRuleId', 'allowAutoDispatch'].forEach((token) => {
    assertIncludes(processTasksSource, token, `ProcessTask 缺少 ${token}`)
  })
  assertIncludes(runtimeTasksSource, 'coveredProcesses', 'RuntimeProcessTask 透传缺少 coveredProcesses')

  ;['任务单元清单', '任务类型', '覆盖工序', '规则来源'].forEach((token) => {
    assertIncludes(taskBreakdownSource, token, `任务清单缺少 ${token}`)
  })
  ;['承接方式', '交出对象'].forEach((token) => {
    assertIncludes(taskBreakdownSource, token, `任务清单缺少 ${token}`)
  })
  assertNotIncludes(taskBreakdownSource, '特殊工艺任务数', '任务单元清单统计不得继续叫特殊工艺任务数')
  assertNotIncludes(taskBreakdownSource, '暂无特殊工艺任务', '任务单元清单空态不得继续叫特殊工艺任务')

  ;['任务生成规则', '任务生成方式', '任务单元数', 'renderOrderTaskGenerationSummary'].forEach((token) => {
    assertIncludes(ordersDomainSource, token, `生产单列表缺少 ${token}`)
  })

  ;['renderProductionTaskGenerationRuleCreatePage', 'renderProductionTaskGenerationRuleEditPage', 'renderProductionTaskGenerationRuleDetailPage', 'renderRuleDetailPage', '新增规则', '编辑规则', '规则详情', '基础信息', '触发条件', '工序处理', '任务单元设置', 'PDA执行设置', '规则日志', '不可生成原因'].forEach((token) => {
    assertIncludes(rulesPageSource, token, `规则页面缺少 ${token}`)
  })
  ;['搜索结果', '进入自动分配'].forEach((token) => {
    assertIncludes(rulesPageSource, token, `规则页面列表统计缺少 ${token}`)
  })
  ;[
    ['适用售卖类型', /field: 'sale-types'/],
    ['指定工厂', /field: 'factory-ids'/],
    ['独立拆出工序', /field: 'independent-process-codes'/],
  ].forEach(([label, pattern]) => {
    assertMatches(rulesPageSource, pattern as RegExp, `规则配置 ${label} 必须使用下拉列表`)
  })
  assertIncludes(rulesPageSource, '<details class="relative', '多选字段必须使用下拉结构')
  assertIncludes(rulesPageSource, 'type="checkbox"', '多选字段必须支持多选')
  assertIncludes(rulesPageSource, 'productionDemands', '适用售卖类型必须来源于生产需求单')
  assertIncludes(rulesPageSource, 'demand.saleType', '适用售卖类型必须取生产需求单 saleType')
  assertIncludes(rulesPageSource, 'listFactoryMasterRecords', '指定工厂必须来源于工厂档案')
  assertIncludes(rulesPageSource, 'factory.id', '指定工厂选项必须展示工厂ID')
  assertIncludes(rulesPageSource, 'factory.name', '指定工厂选项必须展示工厂名称')
  assertIncludes(rulesPageSource, 'whitespace-normal break-words', '指定工厂完整名称必须可换行展示')
  assertIncludes(rulesPageSource, 'listProcessDefinitions', '独立拆出工序必须来源于工序工艺字典')
  assertIncludes(rulesPageSource, 'definition.processCode', '独立拆出工序必须使用工序编码')
  assertIncludes(rulesPageSource, 'label: definition.processName', '独立拆出工序必须展示工序中文名称')
  assertIncludes(rulesPageSource, 'formatProcessCodes(rule.independentProcessCodes)', '规则列表独立拆出工序必须展示中文名称')
  assertIncludes(rulesPageSource, '查看日志', '规则列表操作栏必须有查看日志')
  assertIncludes(rulesPageSource, 'renderRuleLogDialog(rule)', '规则日志必须由列表页弹窗承载')
  assertIncludes(rulesPageSource, 'listProductionTaskGenerationRuleLogs', '规则日志弹窗必须读取规则日志')
  assertNotIncludes(rulesPageSource, "renderRuleFormPage(rule, 'detail')", '详情页不得复用表单渲染')
  assertNotIncludes(rulesPageSource, 'task-generation-rule-editor', '新增/编辑/详情不得继续使用侧边栏弹窗')
  assertNotIncludes(rulesPageSource, '<aside class="rounded-lg border bg-card">', '规则编辑区不得继续平铺在页面正文')

  assertIncludes(dispatchCoreSource, '独立任务自动分配配置', '自动分配弹窗未收窄为独立任务')
  assertIncludes(dispatchDomainSource, 'COMBINED_PROCESS_TASK', '自动分配未跳过组合工序任务')
  assertIncludes(dispatchDomainSource, 'WHOLE_ORDER_TASK', '自动分配未跳过整单任务')
  assertIncludes(dispatchDomainSource, 'skippedMergedTaskCount', '自动分配反馈缺少组合/整单跳过数量')

  assertIncludes(pdaTodoSource, 'getMobileTaskDisplayTitle', 'PDA 待办未使用任务标题 helper')
  assertIncludes(pdaReceiveSource, 'renderCoveredProcessSummary', 'PDA 接单缺少覆盖工序摘要')
  assertIncludes(pdaExecSource, 'renderCoveredProcessSummary', 'PDA 执行列表缺少覆盖工序摘要')
  assertIncludes(pdaExecDetailSource, '覆盖工序', 'PDA 执行详情缺少覆盖工序')

  const ruleDomain = await import(pathToFileURL(path.join(ROOT, 'src/data/fcs/production-task-generation-rules.ts')).href)
  const runtimeDomain = await import(pathToFileURL(path.join(ROOT, 'src/data/fcs/runtime-process-tasks.ts')).href)
  const pdaTaskDomain = await import(pathToFileURL(path.join(ROOT, 'src/data/fcs/pda-task-mock-factory.ts')).href)
  const productionOrdersDomain = await import(pathToFileURL(path.join(ROOT, 'src/data/fcs/production-orders.ts')).href)
  assert.equal(typeof ruleDomain.buildTaskGenerationPreview, 'function', '缺少 buildTaskGenerationPreview')
  assert.equal(typeof ruleDomain.buildBatchTaskGenerationPreview, 'function', '缺少 buildBatchTaskGenerationPreview')
  assert.equal(typeof ruleDomain.listProductionTaskGenerationRules, 'function', '缺少 listProductionTaskGenerationRules')
  assert.equal(typeof ruleDomain.listProductionTaskGenerationRuleLogs, 'function', '缺少 listProductionTaskGenerationRuleLogs')

  const rules = ruleDomain.listProductionTaskGenerationRules()
  assert(rules.length >= 4, '至少需要 4 条任务生成规则')
  assert(rules.some((rule: { ruleName: string }) => rule.ruleName.includes('KOL样衣整单承接')), '缺少 KOL 样衣整单承接规则')
  for (const rule of rules) {
    const logs = ruleDomain.listProductionTaskGenerationRuleLogs(rule.ruleId)
    assert(Array.isArray(logs) && logs.length > 0, `规则 ${rule.ruleId} 必须有日志`)
  }

  const previews = ruleDomain.buildBatchTaskGenerationPreview([])
  assert(Array.isArray(previews), 'buildBatchTaskGenerationPreview 必须返回数组')

  const kolPreview = ruleDomain.findDemoWholeOrderTaskGenerationPreview?.() ?? null
  assert(kolPreview, '缺少可验收的 KOL 整单预览样例')
  assert(
    kolPreview.generatedUnits.some((unit: { taskUnitType: string; allowAutoDispatch: boolean }) =>
      unit.taskUnitType === 'WHOLE_ORDER_TASK' && unit.allowAutoDispatch === false,
    ),
    'KOL 预览必须生成不参与自动分配的整单任务',
  )
  const wholeOrderUnit = kolPreview.generatedUnits.find((unit: { taskUnitType: string }) => unit.taskUnitType === 'WHOLE_ORDER_TASK')
  assert(wholeOrderUnit.coveredProcesses.length > 1, '整单任务必须包含多个覆盖工序')
  assert.deepEqual(wholeOrderUnit.pdaSteps, ['领料', '开工', '关键节点上报', '交出', '完工'], '整单 PDA 步骤必须是简化 5 步')
  assert.equal(wholeOrderUnit.handoverReceiverName, '仓库', '整单任务交出对象必须是仓库')

  const allPreviews = ruleDomain.buildBatchTaskGenerationPreview(
    productionOrdersDomain.productionOrders.map((order: { productionOrderId: string }) => order.productionOrderId),
  )
  assert(
    allPreviews.some((preview: { generatedUnits: Array<{ taskUnitType: string }> }) =>
      preview.generatedUnits.some((unit) => unit.taskUnitType === 'COMBINED_PROCESS_TASK'),
    ),
    '缺少连续工序组合任务预览样例',
  )

  const runtimeTasks = runtimeDomain.listRuntimeProcessTasks()
  assert(runtimeTasks.some((task: { taskUnitType?: string }) => task.taskUnitType === 'WHOLE_ORDER_TASK'), 'runtime 缺少整单任务')
  assert(runtimeTasks.some((task: { taskUnitType?: string }) => task.taskUnitType === 'COMBINED_PROCESS_TASK'), 'runtime 缺少组合工序任务')
  const inactiveOrderIds = new Set(
    productionOrdersDomain.productionOrders
      .filter((order: { status: string; taskBreakdownSummary: { isBrokenDown: boolean } }) =>
        !order.taskBreakdownSummary.isBrokenDown || order.status === 'DRAFT' || order.status === 'READY_FOR_BREAKDOWN'
      )
      .map((order: { productionOrderId: string }) => order.productionOrderId),
  )
  assert(
    !runtimeTasks.some((task: { productionOrderId: string }) => inactiveOrderIds.has(task.productionOrderId)),
    '未确认拆解、草稿、待拆解生产单不得提前进入任务事实源',
  )
  const duplicateCoveredProcesses: string[] = []
  for (const mergedTask of runtimeTasks.filter((task: { taskUnitType?: string }) =>
    task.taskUnitType === 'WHOLE_ORDER_TASK' || task.taskUnitType === 'COMBINED_PROCESS_TASK'
  )) {
    const coveredProcessNames = new Set((mergedTask.coveredProcesses ?? []).map((item: { processName: string }) => item.processName))
    for (const sibling of runtimeTasks.filter((task: { productionOrderId: string; taskId: string }) =>
      task.productionOrderId === mergedTask.productionOrderId && task.taskId !== mergedTask.taskId
    )) {
      for (const covered of sibling.coveredProcesses ?? []) {
        if (coveredProcessNames.has(covered.processName)) {
          duplicateCoveredProcesses.push(`${mergedTask.productionOrderId}:${covered.processName}:${sibling.taskId}`)
        }
      }
    }
  }
  assert.equal(duplicateCoveredProcesses.length, 0, `被组合/整单覆盖的工序不得重复生成独立任务：${duplicateCoveredProcesses.join(', ')}`)

  const pdaTasks = pdaTaskDomain.listPdaGenericProcessTasks()
  const pdaMergedTask = pdaTasks.find((task: { taskUnitType?: string }) =>
    task.taskUnitType === 'WHOLE_ORDER_TASK' || task.taskUnitType === 'COMBINED_PROCESS_TASK'
  )
  assert(
    pdaMergedTask,
    'PDA 通用任务列表缺少组合/整单任务样例',
  )
  assert.equal(pdaMergedTask.pdaStepTemplateCode, 'SIMPLE_FIVE_STEP', 'PDA 合并任务必须使用简化 5 步模板')
  assert.equal(pdaMergedTask.handoverReceiverName, '仓库', 'PDA 合并任务交出对象必须是仓库')
  assert((pdaMergedTask.coveredProcesses ?? []).length > 1, 'PDA 合并任务必须展示多个覆盖工序')
}

main().then(
  () => console.log('check:fcs-task-generation-rules passed'),
  (error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  },
)
