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
  const mainSource = read('src/main.ts')
  const menuSource = read('src/data/app-shell-config.ts')
  const routesSource = read('src/router/routes-fcs.ts')
  const rendererFcsSource = read('src/router/route-renderers-fcs.ts')
  const rendererSource = read('src/router/route-renderers.ts')
  const eventsSource = read('src/pages/production/events.ts')
  const processTasksSource = read('src/data/fcs/process-tasks.ts')
  const runtimeTasksSource = read('src/data/fcs/runtime-process-tasks.ts')
  const factoryMockSource = read('src/data/fcs/factory-mock-data.ts')
  const factoryMasterSource = read('src/data/fcs/factory-master-store.ts')
  const ruleDomainSource = read('src/data/fcs/production-task-generation-rules.ts')
  const taskBreakdownSource = read('src/pages/task-breakdown.ts')
  const ordersDomainSource = read('src/pages/production/orders-domain.ts')
  const productionContextSource = read('src/pages/production/context.ts')
  const rulesPageSource = read('src/pages/production/task-generation-rules.ts')
  const dispatchCoreSource = read('src/pages/dispatch-board/core.ts')
  const dispatchDomainSource = read('src/pages/dispatch-board/dispatch-domain.ts')
  const pdaTodoSource = read('src/data/fcs/factory-mobile-todos.ts')
  const pdaReceiveSource = read('src/pages/pda-task-receive.ts')
  const pdaExecSource = read('src/pages/pda-exec.ts')
  const pdaExecDetailSource = read('src/pages/pda-exec-detail.ts')
  const pdaShellSource = read('src/pages/pda-shell.ts')
  const pdaHandoverSource = read('src/pages/pda-handover.ts')
  const pdaStoreSource = read('src/data/fcs/store-domain-pda.ts')

  assertIncludes(packageSource, 'check:fcs-task-generation-rules', 'package.json 缺少 check:fcs-task-generation-rules')
  assertIncludes(mainSource, "pathname.startsWith('/fcs/process/task-breakdown')", '任务清单必须有专属事件入口，避免首次点击加载整条 FCS handler')
  assertIncludes(mainSource, 'getTaskBreakdownPageModule', '任务清单专属事件入口必须复用页面模块')

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

  ;['任务类型', '覆盖工序', '规则来源'].forEach((token) => {
    assertIncludes(taskBreakdownSource, token, `任务清单缺少 ${token}`)
  })
  ;['承接方式', '交出对象'].forEach((token) => {
    assertIncludes(taskBreakdownSource, token, `任务清单缺少 ${token}`)
  })
  ;[
    'renderTaskBreakdownResultSummary',
    '搜索结果统计',
    'TASK_BREAKDOWN_ORDER_PAGE_SIZE',
    'TASK_BREAKDOWN_ALL_TASK_PAGE_SIZE',
    'renderTaskBreakdownPagination',
    'data-breakdown-page-scope',
    'data-fast-page-render="true"',
  ].forEach((token) => {
    assertIncludes(taskBreakdownSource, token, `任务清单列表化/分页/性能保护缺少 ${token}`)
  })
  assertNotIncludes(taskBreakdownSource, 'grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6', '任务清单不得保留顶部大统计卡片区')
  assertNotIncludes(taskBreakdownSource, '任务单元清单', '任务清单页不得再出现独立的任务单元清单区块')
  assertNotIncludes(taskBreakdownSource, 'renderSpecialCraftTaskSection', '任务清单页不得再单独渲染特殊工艺任务区块')
  assertNotIncludes(taskBreakdownSource, 'listSpecialCraftTaskOrders', '任务清单页不得再并列读取特殊工艺任务单元数据源')
  assertNotIncludes(taskBreakdownSource, 'specialCraftOperation', '任务清单页不得再保留特殊工艺独立筛选')
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
  assertIncludes(factoryMockSource, 'KOL_GOTO_FACTORY_ID', '工厂 Mock 必须明确 kol goto 工厂 ID')
  assertIncludes(factoryMockSource, 'kol goto', '工厂 Mock 必须包含 kol goto 工厂')
  assertIncludes(pdaStoreSource, 'KOL_GOTO_FACTORY_ID', 'PDA 账号种子必须包含 kol goto 工厂 ID')
  assertIncludes(pdaStoreSource, 'kolGotoFactoryPdaUsers', 'PDA 账号种子必须为 kol goto 生成账号')
  assertIncludes(pdaStoreSource, 'generatePresetRolesForFactory(KOL_GOTO_FACTORY_ID', 'PDA 角色种子必须为 kol goto 生成角色')
  assertNotIncludes(factoryMasterSource, "continuousProcessEnabled: factory.id === 'ID-F011'", '不得沿用旧逻辑给 ID-F011 自动补连续/整单承接')
  assertNotIncludes(ruleDomainSource, "factoryIds: ['ID-F002', 'ID-F005', 'ID-F011']", 'KOL 整单规则不得继续绑定旧工厂 ID')
  assertIncludes(ruleDomainSource, 'DEFAULT_PROCESS_STEPS', '规则预览必须区分默认工序步骤与简化 5 步')
  assertIncludes(ruleDomainSource, 'resolveRuleFactoryIds', '规则必须从工厂档案承接配置解析候选工厂')
  assertIncludes(productionContextSource, 'recordTaskGenerationPreview', '确认拆解必须写入任务生成运行时事实')
  assertIncludes(productionContextSource, 'independentRequirementCount', '生产单摘要必须区分独立需求对象数量')
  assertIncludes(pdaTodoSource, 'pdaStepTemplateCode === \'SIMPLE_FIVE_STEP\'', 'PDA 待办必须识别简化 5 步任务')
  assertIncludes(pdaReceiveSource, 'pdaStepTemplateCode === \'SIMPLE_FIVE_STEP\'', 'PDA 接单必须识别简化 5 步任务')
  assertIncludes(pdaExecSource, 'pdaStepTemplateCode === \'SIMPLE_FIVE_STEP\'', 'PDA 执行列表必须识别简化 5 步任务')
  assertNotIncludes(pdaExecSource, '五步执行：', 'PDA 执行列表不得在任务卡片展开五步说明')
  assertNotIncludes(pdaExecSource, '平台允许继续前', 'PDA 生产暂停卡片不得保留说明性长文案')
  assertIncludes(pdaExecSource, '去交接交出', 'PDA 执行列表的整单/连续任务交出必须进入交接模块')
  assertIncludes(pdaExecDetailSource, 'pdaStepTemplateCode === \'SIMPLE_FIVE_STEP\'', 'PDA 详情必须识别简化 5 步任务')
  assertIncludes(pdaShellSource, 'getVisibleMobileAppTabs', 'PDA 底部导航必须按工厂类型过滤可见 Tab')
  assertIncludes(pdaShellSource, "factory.factoryType === 'THIRD_SEWING'", '三方小微缝纫工厂 PDA 必须隐藏仓管 Tab')
  assertNotIncludes(pdaHandoverSource, '交出记录由工厂发起', 'PDA 交接页不得保留说明性长文案')
  assertNotIncludes(pdaHandoverSource, '领料单已完成：', 'PDA 已完成交接列表不得保留额外统计说明卡片')
  ;['确认领料', '开始做', '上传进度', '去交接交出', '仓库待确认'].forEach((token) => {
    assertIncludes(`${pdaExecSource}\n${pdaExecDetailSource}\n${pdaTodoSource}`, token, `PDA 简化 5 步缺少文案：${token}`)
  })

  const ruleDomain = await import(pathToFileURL(path.join(ROOT, 'src/data/fcs/production-task-generation-rules.ts')).href)
  const factoryDomain = await import(pathToFileURL(path.join(ROOT, 'src/data/fcs/factory-master-store.ts')).href)
  const runtimeDomain = await import(pathToFileURL(path.join(ROOT, 'src/data/fcs/runtime-process-tasks.ts')).href)
  const mobileExecutionDomain = await import(pathToFileURL(path.join(ROOT, 'src/data/fcs/mobile-execution-task-index.ts')).href)
  const pdaTaskDomain = await import(pathToFileURL(path.join(ROOT, 'src/data/fcs/pda-task-mock-factory.ts')).href)
  const pdaHandoverDomain = await import(pathToFileURL(path.join(ROOT, 'src/data/fcs/pda-handover-events.ts')).href)
  const pdaStoreDomain = await import(pathToFileURL(path.join(ROOT, 'src/data/fcs/store-domain-pda.ts')).href)
  const productionOrdersDomain = await import(pathToFileURL(path.join(ROOT, 'src/data/fcs/production-orders.ts')).href)
  assert.equal(typeof ruleDomain.buildTaskGenerationPreview, 'function', '缺少 buildTaskGenerationPreview')
  assert.equal(typeof ruleDomain.buildBatchTaskGenerationPreview, 'function', '缺少 buildBatchTaskGenerationPreview')
  assert.equal(typeof ruleDomain.listProductionTaskGenerationRules, 'function', '缺少 listProductionTaskGenerationRules')
  assert.equal(typeof ruleDomain.listProductionTaskGenerationRuleLogs, 'function', '缺少 listProductionTaskGenerationRuleLogs')

  const rules = ruleDomain.listProductionTaskGenerationRules()
  assert(rules.length >= 4, '至少需要 4 条任务生成规则')
  assert(rules.some((rule: { ruleName: string }) => rule.ruleName.includes('KOL样衣整单承接')), '缺少 KOL 样衣整单承接规则')
  const kolFactories = factoryDomain.listFactoryMasterRecords().filter((factory: { name: string }) => factory.name === 'kol goto')
  assert.equal(kolFactories.length, 1, '必须且只能有一个 kol goto 工厂')
  const kolFactory = kolFactories[0]
  assert.equal(kolFactory.factoryTier, 'THIRD_PARTY', 'kol goto 必须属于三方工厂')
  assert.equal(kolFactory.factoryType, 'THIRD_SEWING', 'kol goto 必须属于小微缝纫工厂')
  assert(kolFactory.taskAcceptanceConfig?.wholeOrderEnabled, 'kol goto 必须启用整单承接')
  assert(kolFactory.taskAcceptanceConfig?.wholeOrderRule?.enabled, 'kol goto 必须配置整单承接规则')
  const kolAbilityText = kolFactory.processAbilities
    .flatMap((ability: { processName?: string; abilityName?: string; craftNames?: string[]; capacityNodeCodes?: string[] }) => [
      ability.processName,
      ability.abilityName,
      ...(ability.craftNames ?? []),
      ...(ability.capacityNodeCodes ?? []),
    ])
    .filter(Boolean)
    .join(' ')
  ;['裁片', '车缝', '辅助工艺', '特殊工艺', '后道', '质检', '复检', '包装', 'PACKAGING'].forEach((token) => {
    assert(kolAbilityText.includes(token), `kol goto 接单能力缺少 ${token}`)
  })
  assert.deepEqual(
    kolFactory.taskAcceptanceConfig.wholeOrderRule.applicableSaleTypes,
    ['KOL样衣', 'KOL样品小单'],
    'kol goto 整单规则适用售卖类型必须是 KOL样衣、KOL样品小单',
  )
  assert.deepEqual(
    kolFactory.taskAcceptanceConfig.wholeOrderRule.excludedProcessCodes,
    ['PRINT', 'DYE'],
    'kol goto 整单规则必须排除印花、染色',
  )
  const kolRule = rules.find((rule: { ruleId: string }) => rule.ruleId === 'TGR-KOL-001')
  assert(kolRule, '缺少 TGR-KOL-001')
  assert.deepEqual(kolRule.factoryIds, [kolFactory.id], 'KOL 整单规则只能绑定 kol goto 工厂')
  assert.equal(kolRule.requiredAcceptanceMode, 'WHOLE_ORDER', 'KOL 整单规则必须要求整单承接')
  assert(
    pdaStoreDomain.initialFactoryPdaUsers.some((user: { factoryId: string; loginId: string }) =>
      user.factoryId === kolFactory.id && user.loginId === `${kolFactory.id}_operator`
    ),
    'kol goto 必须有 PDA 操作工账号',
  )
  assert(
    pdaStoreDomain.initialFactoryPdaRoles.some((role: { factoryId: string; roleId: string }) =>
      role.factoryId === kolFactory.id && role.roleId === 'ROLE_ADMIN'
    ),
    'kol goto 必须有 PDA 管理员角色',
  )
  for (const legacyFactoryId of ['ID-F002', 'ID-F005', 'ID-F011']) {
    const legacyFactory = factoryDomain.getFactoryMasterRecordById(legacyFactoryId)
    if (!legacyFactory) continue
    assert(
      legacyFactory.taskAcceptanceConfig?.wholeOrderEnabled !== true,
      `${legacyFactoryId} 不得默认配置为整单承接工厂`,
    )
  }
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
  assert.equal(wholeOrderUnit.assignmentTargetFactoryId, kolFactory.id, 'KOL 整单预览必须分配给 kol goto')
  assert.equal(wholeOrderUnit.assignmentTargetFactoryName, 'kol goto', 'KOL 整单预览必须显示 kol goto')

  const allPreviews = ruleDomain.buildBatchTaskGenerationPreview(
    productionOrdersDomain.productionOrders.map((order: { productionOrderId: string }) => order.productionOrderId),
  )
  assert(
    allPreviews.some((preview: { generatedUnits: Array<{ taskUnitType: string }> }) =>
      preview.generatedUnits.some((unit) => unit.taskUnitType === 'COMBINED_PROCESS_TASK'),
    ),
    '缺少连续工序组合任务预览样例',
  )
  const combinedPreviewUnit = allPreviews
    .flatMap((preview: { generatedUnits: Array<{ taskUnitType: string; taskName: string; coveredProcesses: Array<unknown> }> }) =>
      preview.generatedUnits
    )
    .find((unit: { taskUnitType: string }) => unit.taskUnitType === 'COMBINED_PROCESS_TASK')
  assert(combinedPreviewUnit, '缺少连续工序组合任务预览样例')
  assert(combinedPreviewUnit.coveredProcesses.length >= 2, '连续工序组合预览必须覆盖至少 2 个工序')
  assert(combinedPreviewUnit.taskName.includes('+'), '连续工序组合任务名称必须体现工序组合')
  const kolSamplePreviews = allPreviews.filter((preview: {
    saleType?: string
    generatedUnits: Array<{ taskUnitType: string }>
  }) => preview.saleType === 'KOL样品小单')
  assert(kolSamplePreviews.length > 0, '缺少 KOL样品小单任务生成预览样例')
  assert(
    kolSamplePreviews.every((preview: {
      generatedUnits: Array<{ taskUnitType: string }>
    }) => preview.generatedUnits.every((unit) => unit.taskUnitType !== 'COMBINED_PROCESS_TASK')),
    'KOL样品小单不得生成连续工序组合任务',
  )
  const kolSampleWholePreview = kolSamplePreviews.find((preview: {
    matchedRuleId?: string
    generatedUnits: Array<{
      taskUnitType: string
      taskName: string
      assignmentTargetFactoryId?: string
      assignmentTargetFactoryName?: string
      allowAutoDispatch?: boolean
    }>
  }) => preview.matchedRuleId === 'TGR-KOL-001' && preview.generatedUnits.some((unit) => unit.taskUnitType === 'WHOLE_ORDER_TASK'))
  assert(kolSampleWholePreview, 'KOL样品小单必须命中 KOL 整单规则')
  const kolSampleWholeUnit = kolSampleWholePreview.generatedUnits.find((unit: { taskUnitType: string }) =>
    unit.taskUnitType === 'WHOLE_ORDER_TASK'
  )!
  assert(kolSampleWholeUnit.taskName.includes('KOL整单任务'), 'KOL样品小单整单任务名称必须体现 KOL整单任务')
  assert.equal(kolSampleWholeUnit.assignmentTargetFactoryId, kolFactory.id, 'KOL样品小单整单任务必须指向 kol goto')
  assert.equal(kolSampleWholeUnit.assignmentTargetFactoryName, 'kol goto', 'KOL样品小单整单任务必须显示 kol goto')
  assert.equal(kolSampleWholeUnit.allowAutoDispatch, false, 'KOL样品小单整单任务不得进入自动分配')
  const defaultPreview = allPreviews.find((preview: {
    matchedRuleId?: string
    generatedUnits: Array<{ pdaSteps: string[] }>
  }) => preview.matchedRuleId === 'TGR-DEFAULT-001' && preview.generatedUnits.length > 0)
  assert(defaultPreview, '缺少默认规则预览样例')
  assert.notDeepEqual(
    defaultPreview.generatedUnits[0].pdaSteps,
    ['领料', '开工', '关键节点上报', '交出', '完工'],
    '默认按工序任务不得返回简化 5 步',
  )

  const runtimeTasks = runtimeDomain.listRuntimeProcessTasks()
  assert(runtimeTasks.some((task: { taskUnitType?: string }) => task.taskUnitType === 'WHOLE_ORDER_TASK'), 'runtime 缺少整单任务')
  assert(runtimeTasks.some((task: { taskUnitType?: string }) => task.taskUnitType === 'COMBINED_PROCESS_TASK'), 'runtime 缺少组合工序任务')
  const mergedRuntimeTasks = runtimeTasks.filter((task: { taskUnitType?: string }) =>
    task.taskUnitType === 'WHOLE_ORDER_TASK' || task.taskUnitType === 'COMBINED_PROCESS_TASK'
  )
  const combinedRuntimeTasks = runtimeTasks.filter((task: { taskUnitType?: string }) =>
    task.taskUnitType === 'COMBINED_PROCESS_TASK'
  )
  const kolSampleRuntimeTasks = runtimeTasks.filter((task: {
    saleTypeSnapshot?: string
    taskUnitType?: string
    assignedFactoryId?: string
    assignedFactoryName?: string
  }) => task.saleTypeSnapshot === 'KOL样品小单')
  assert(kolSampleRuntimeTasks.length > 0, 'runtime 缺少 KOL样品小单任务样例')
  assert(
    kolSampleRuntimeTasks.every((task: { taskUnitType?: string }) => task.taskUnitType !== 'COMBINED_PROCESS_TASK'),
    'runtime 中 KOL样品小单不得出现组合工序任务',
  )
  const kolSampleRuntimeWholeTasks = kolSampleRuntimeTasks.filter((task: { taskUnitType?: string }) =>
    task.taskUnitType === 'WHOLE_ORDER_TASK'
  )
  assert(kolSampleRuntimeWholeTasks.length > 0, 'runtime 中 KOL样品小单必须有整单任务')
  assert(
    kolSampleRuntimeWholeTasks.every((task: { assignedFactoryId?: string; assignedFactoryName?: string }) =>
      task.assignedFactoryId === kolFactory.id && task.assignedFactoryName === 'kol goto',
    ),
    'runtime 中 KOL样品小单整单任务必须指向 kol goto',
  )
  assert(
    combinedRuntimeTasks.every((task: { coveredProcesses?: Array<unknown> }) => (task.coveredProcesses ?? []).length >= 2),
    '连续工序组合运行时任务必须覆盖至少 2 个工序',
  )
  assert(
    mergedRuntimeTasks.every((task: { qty?: number }) => Number(task.qty) > 0),
    '整单/组合任务必须有聚合后的计划数量',
  )
  assert(
    mergedRuntimeTasks.every((task: { outputValueUnit?: string }) => task.outputValueUnit === '按覆盖工序明细计算'),
    '整单/组合任务产值单位必须标记为按覆盖工序明细计算',
  )
  assert(
    mergedRuntimeTasks.every((task: { outputValuePerUnit?: number }) => !Number(task.outputValuePerUnit)),
    '整单/组合任务不得继续暴露首个工序单价',
  )
  assert(
    mergedRuntimeTasks.some((task: { outputValueTotal?: number }) => Number(task.outputValueTotal) > 0),
    '整单/组合任务至少需要有可演示的聚合总产值样例',
  )
  assert(
    mergedRuntimeTasks.every((task: { stageName?: string }) => task.stageName === '整单任务' || task.stageName === '组合工序任务'),
    '整单/组合任务必须有聚合阶段语义',
  )
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
  for (const mergedTask of mergedRuntimeTasks) {
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

  const taskSummaryCoverageIssues: string[] = []
  for (const order of productionOrdersDomain.productionOrders as Array<{
    productionOrderId: string
    status: string
    taskBreakdownSummary?: {
      isBrokenDown?: boolean
      independentRequirementCount?: number
      coveredProcessNames?: string[]
    }
  }>) {
    const orderTasks = runtimeTasks.filter((task: { productionOrderId: string }) =>
      task.productionOrderId === order.productionOrderId
    )
    if (!order.taskBreakdownSummary?.isBrokenDown) continue
    if (orderTasks.length === 0 && (order.taskBreakdownSummary.independentRequirementCount ?? 0) === 0) {
      taskSummaryCoverageIssues.push(`${order.productionOrderId}:已拆解但缺少任务事实`)
      continue
    }
    const summaryNames = new Set(order.taskBreakdownSummary.coveredProcessNames ?? [])
    if (summaryNames.size === 0 || orderTasks.length === 0) continue
    const missingNames = [
      ...new Set(
        orderTasks
          .flatMap((task: { coveredProcesses?: Array<{ processName: string }> }) =>
            (task.coveredProcesses ?? []).map((process) => process.processName)
          )
          .filter((processName: string) => !summaryNames.has(processName)),
      ),
    ]
    if (missingNames.length > 0) {
      taskSummaryCoverageIssues.push(`${order.productionOrderId}:摘要缺少 ${missingNames.join('、')}`)
    }
  }
  assert.equal(taskSummaryCoverageIssues.length, 0, `生产单任务生成摘要与任务事实不一致：${taskSummaryCoverageIssues.join('; ')}`)

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
  const pdaKolWholeTask = pdaTasks.find((task: { productionOrderNo?: string; assignedFactoryId?: string; taskUnitType?: string }) =>
    task.productionOrderNo === 'PO-202603-081' && task.taskUnitType === 'WHOLE_ORDER_TASK'
  )
  assert(pdaKolWholeTask, 'PDA 缺少 KOL 整单任务演示数据')
  assert.equal(pdaKolWholeTask.assignedFactoryId, kolFactory.id, 'PDA KOL 整单任务必须分配给 kol goto')
  const pdaKolWholeHandoutHead = pdaHandoverDomain
    .getPdaHandoutHeads(kolFactory.id)
    .find((head: { taskId?: string; productionOrderNo?: string; targetKind?: string; receiverName?: string }) =>
      head.taskId === pdaKolWholeTask.taskId && head.productionOrderNo === 'PO-202603-081'
    )
  assert(pdaKolWholeHandoutHead, 'PDA KOL 整单任务缺少交接交出 mock 数据')
  assert.equal(pdaKolWholeHandoutHead.targetKind, 'WAREHOUSE', 'PDA KOL 整单任务交出接收方必须是仓库')
  assert.equal(pdaKolWholeHandoutHead.receiverName, '仓库', 'PDA KOL 整单任务交出接收方名称必须是仓库')
  assert(pdaKolWholeHandoutHead.recordCount > 0, 'PDA KOL 整单任务交出 mock 必须包含交出记录')
  const pdaRuntimeKolHandoutHead = pdaHandoverDomain
    .getPdaHandoutHeads(kolFactory.id)
    .find((head: { taskId?: string; productionOrderNo?: string; targetKind?: string; receiverName?: string }) =>
      head.taskId === 'TASKGEN-202603-0001-001__ORDER' && head.productionOrderNo === 'PO-202603-0001'
    )
  assert(pdaRuntimeKolHandoutHead, 'PDA 当前整单执行任务缺少交接交出 mock 数据')
  assert.equal(pdaRuntimeKolHandoutHead.targetKind, 'WAREHOUSE', 'PDA 当前整单执行任务交出接收方必须是仓库')
  assert.equal(pdaRuntimeKolHandoutHead.receiverName, '仓库', 'PDA 当前整单执行任务交出接收方名称必须是仓库')
  assert(pdaRuntimeKolHandoutHead.recordCount > 0, 'PDA 当前整单执行任务交出 mock 必须包含交出记录')
  const pdaKolBlockedTasks = mobileExecutionDomain.listMobileExecutionTasks({
    currentFactoryId: kolFactory.id,
    statusTab: '生产暂停',
    includeCompleted: true,
  })
  const pdaKolDoneTasks = mobileExecutionDomain.listMobileExecutionTasks({
    currentFactoryId: kolFactory.id,
    statusTab: '已完工',
    includeCompleted: true,
  })
  assert.equal(pdaKolBlockedTasks.length, 2, 'kol goto PDA 生产暂停 mock 数据必须正好 2 条')
  assert.equal(pdaKolDoneTasks.length, 2, 'kol goto PDA 已完工 mock 数据必须正好 2 条')
  assert(
    pdaKolBlockedTasks.every((task: { assignedFactoryId?: string }) => task.assignedFactoryId === kolFactory.id),
    'kol goto PDA 生产暂停任务必须都属于 kol goto',
  )
  assert(
    pdaKolDoneTasks.every((task: { assignedFactoryId?: string }) => task.assignedFactoryId === kolFactory.id),
    'kol goto PDA 已完工任务必须都属于 kol goto',
  )
  assert.equal(pdaHandoverDomain.getPdaPickupHeads(kolFactory.id).length, 2, 'kol goto PDA 待领料交接 mock 数据必须正好 2 条')
  assert.equal(pdaHandoverDomain.getPdaCompletedHeads(kolFactory.id).length, 2, 'kol goto PDA 已完成交接 mock 数据必须正好 2 条')
}

main().then(
  () => console.log('check:fcs-task-generation-rules passed'),
  (error) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  },
)
