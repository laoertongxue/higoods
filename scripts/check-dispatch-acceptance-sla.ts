import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE,
  DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME,
  getDispatchAcceptanceSlaGlobalDefaultConfig,
  listDispatchAcceptanceSlaFactoryAbilityRows,
  listDispatchAcceptanceSlaFactoryLogs,
  listDispatchAcceptanceSlaFactoryRows,
  listDispatchAcceptanceSlaRuleProcessCraftOptions,
  listDispatchAcceptanceSlaRules,
  previewDispatchAcceptanceSlaRuleImpact,
  resolveDispatchAcceptanceSlaForTask,
  saveDispatchAcceptanceSlaGlobalDefaultConfig,
  saveDispatchAcceptanceSlaRule,
} from '../src/data/fcs/dispatch-acceptance-sla.ts'
import {
  handleDispatchAcceptanceSlaEvent,
  renderDispatchAcceptanceSlaPage,
} from '../src/pages/dispatch-acceptance-sla.ts'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(`[check-dispatch-acceptance-sla] ${message}`)
  }
}

function readProjectFile(pathname: string): string {
  return readFileSync(resolve(process.cwd(), pathname), 'utf8')
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1
}

function triggerAcceptanceSlaAction(action: string, extraDataset: Record<string, string> = {}): void {
  handleDispatchAcceptanceSlaEvent({
    closest: (selector: string) => {
      if (selector.includes('data-acceptance-sla-field')) return null
      if (selector.includes('data-acceptance-sla-action')) {
        return { dataset: { acceptanceSlaAction: action, ...extraDataset } }
      }
      return null
    },
  } as unknown as HTMLElement)
}

function triggerAcceptanceSlaField(
  field: string,
  value: string,
  options: { checked?: boolean } = {},
): void {
  const FieldElementStub = class {
    value = ''
    checked = false
    dataset: Record<string, string> = {}
  }
  ;(globalThis as unknown as { HTMLInputElement?: unknown }).HTMLInputElement ??= FieldElementStub
  ;(globalThis as unknown as { HTMLSelectElement?: unknown }).HTMLSelectElement ??= FieldElementStub
  ;(globalThis as unknown as { HTMLTextAreaElement?: unknown }).HTMLTextAreaElement ??= FieldElementStub
  const FieldClass = (globalThis as unknown as { HTMLInputElement: new () => HTMLInputElement & { dataset: Record<string, string> } }).HTMLInputElement
  const fieldNode = new FieldClass()
  fieldNode.value = value
  fieldNode.checked = Boolean(options.checked)
  fieldNode.dataset = { acceptanceSlaField: field, skipPageRerender: 'true' }
  handleDispatchAcceptanceSlaEvent({
    closest: (selector: string) => {
      if (selector.includes('data-acceptance-sla-field')) return fieldNode
      return null
    },
  } as unknown as HTMLElement)
}

function triggerAcceptanceSlaPaginationAction(action: string, scope: 'factory-list' | 'factory-detail'): void {
  handleDispatchAcceptanceSlaEvent({
    closest: (selector: string) => {
      if (selector.includes('data-acceptance-sla-field')) return null
      if (selector.includes('data-acceptance-sla-pagination-scope')) {
        return { dataset: { acceptanceSlaPaginationScope: scope } }
      }
      if (selector.includes('data-acceptance-sla-action')) {
        return { dataset: { acceptanceSlaAction: action } }
      }
      return null
    },
  } as unknown as HTMLElement)
}

function assertMenuAndRoute(): void {
  const menu = readProjectFile('src/data/app-shell-config.ts')
  const routes = readProjectFile('src/router/routes-fcs.ts')
  const renderers = readProjectFile('src/router/route-renderers-fcs.ts')
  const main = readProjectFile('src/main.ts')
  assert(menu.includes("title: '接单时效配置'"), '任务分配菜单下缺少接单时效配置')
  assert(menu.includes("href: '/fcs/dispatch/acceptance-sla'"), '接单时效配置菜单 href 不正确')
  assert(routes.includes("'/fcs/dispatch/acceptance-sla'"), '接单时效配置路由未注册')
  assert(!routes.includes("'/fcs/dispatch/acceptance-sla/unconfigured'"), '仍保留未配置工厂独立列表路由')
  assert(renderers.includes('renderDispatchAcceptanceSlaPage'), '接单时效配置 renderer 未注册')
  assert(!renderers.includes('renderDispatchAcceptanceSlaUnconfiguredPage'), '仍保留未配置工厂独立 renderer')
  assert(main.includes("pathname.startsWith('/fcs/dispatch/acceptance-sla')"), '总事件分发缺少接单时效路由短路')
  assert(main.includes('getDispatchAcceptanceSlaPageModule'), '接单时效事件未独立懒加载页面模块')
}

function assertFactoryListModel(): void {
  const rows = listDispatchAcceptanceSlaFactoryRows()
  assert(rows.length > 0, '工厂列表为空')
  assert(new Set(rows.map((row) => row.factoryId)).size === rows.length, '同一工厂在主列表重复出现')
  assert(rows.some((row) => row.abilityCount > 1), '缺少多工序工艺能力工厂样本')
  assert(rows.some((row) => row.unconfiguredCount > 0), '缺少未配置工厂样本')

  const fullFactory = rows.find((row) => row.factoryId === 'F090')
  assert(fullFactory, '缺少全能力测试工厂')
  assert(fullFactory.abilityCount > 3, '全能力测试工厂没有展示多工序工艺能力')
  const fullFactoryAbilities = listDispatchAcceptanceSlaFactoryAbilityRows(fullFactory.factoryId)
  assert(fullFactoryAbilities.length === fullFactory.abilityCount, '工厂明细能力数与主列表不一致')
  assert(fullFactoryAbilities.some((row) => row.processName === '印花'), '工厂明细缺少印花能力')
  assert(fullFactoryAbilities.some((row) => row.processName === '裁片'), '工厂明细缺少裁片能力')
}

function assertRuleResolutionAndPriority(): void {
  const printAuto = resolveDispatchAcceptanceSlaForTask(
    {
      processCode: 'PRINT',
      processNameZh: '印花',
      craftCode: 'CRAFT_2000001',
      craftName: '丝网印',
    },
    'F090',
    '全能力测试工厂',
    '2026-06-09 09:00:00',
  )
  assert(printAuto.acceptTimeoutHours === 0, '指定工厂规则未保持最高优先级')
  assert(printAuto.autoAccept, '0 小时规则未识别为派单后自动接单')
  assert(printAuto.acceptDeadline === '2026-06-09 09:00:00', '0 小时规则接单截止应等于派单时间')

  const fullFactory = listDispatchAcceptanceSlaFactoryRows().find((row) => row.factoryId === 'F090')
  assert(fullFactory, '缺少全能力测试工厂，无法校验 0 小时新增规则')
  const zeroAbility = fullFactory.abilityRows.find((row) => row.processCode !== 'PRINT') || fullFactory.abilityRows[0]
  assert(zeroAbility, '全能力测试工厂缺少可用于 0 小时验收的工序工艺能力')
  saveDispatchAcceptanceSlaRule({
    ruleName: '验收：0 小时自动接单规则',
    processScopeType: 'PROCESS_CRAFT',
    processCode: zeroAbility.processCode,
    processName: zeroAbility.processName,
    craftCode: zeroAbility.craftCode,
    craftName: zeroAbility.craftName,
    factoryScopeType: 'FACTORIES',
    factoryIds: [fullFactory.factoryId],
    factoryNames: [fullFactory.factoryName],
    acceptTimeoutHours: 0,
    enabled: true,
    updatedBy: '验收脚本',
    updatedAt: '2026-06-09 16:05:00',
  })
  const savedZeroRule = resolveDispatchAcceptanceSlaForTask(
    {
      processCode: zeroAbility.processCode,
      processNameZh: zeroAbility.processName,
      craftCode: zeroAbility.craftCode,
      craftName: zeroAbility.craftName,
    },
    fullFactory.factoryId,
    fullFactory.factoryName,
    '2026-06-09 10:00:00',
  )
  assert(savedZeroRule.acceptTimeoutHours === 0, '新增 0 小时规则保存后未按 0 小时解析')
  assert(savedZeroRule.autoAccept, '新增 0 小时规则保存后未识别为派单后自动接单')
  assert(savedZeroRule.acceptDeadline === '2026-06-09 10:00:00', '新增 0 小时规则接单截止应等于派单时间')

  const ruleOptions = listDispatchAcceptanceSlaRuleProcessCraftOptions()
  assert(ruleOptions.some((option) => option.craftCode === DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE), '规则维护缺少全部工艺选项')
  const impact = previewDispatchAcceptanceSlaRuleImpact({
    processScopeType: 'PROCESS_ALL_CRAFTS',
    processCode: 'PRINT',
    processName: '印花',
    craftName: DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME,
    factoryScopeType: 'FACTORY_TIER',
    factoryTier: 'CENTRAL',
    factoryTierName: '中央工厂',
    acceptTimeoutHours: 5,
    enabled: true,
  })
  assert(impact.matchedFactoryCount > 0, '工厂层级规则影响预览未命中工厂')
  assert(impact.matchedAbilityCount >= impact.effectiveAbilityCount, '影响预览统计异常')

  saveDispatchAcceptanceSlaRule({
    ruleName: '验收：中央工厂印花全部工艺',
    processScopeType: 'PROCESS_ALL_CRAFTS',
    processCode: 'PRINT',
    processName: '印花',
    craftName: DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME,
    factoryScopeType: 'FACTORY_TIER',
    factoryTier: 'CENTRAL',
    factoryTierName: '中央工厂',
    acceptTimeoutHours: 5,
    enabled: true,
    updatedBy: '验收脚本',
    updatedAt: '2026-06-09 16:10:00',
  })
  const stillSpecific = resolveDispatchAcceptanceSlaForTask(
    {
      processCode: 'PRINT',
      processNameZh: '印花',
      craftCode: 'CRAFT_2000001',
      craftName: '丝网印',
    },
    'F090',
    '全能力测试工厂',
  )
  assert(stillSpecific.acceptTimeoutHours === 0, '广域层级规则覆盖了指定工厂规则')
}

function assertMultiFactoryRuleAndFactoryLogs(): void {
  const rows = listDispatchAcceptanceSlaFactoryRows()
  const targetFactories = rows.filter((row) => row.abilityRows.some((ability) => ability.processCode === 'CUT_PANEL')).slice(0, 2)
  assert(targetFactories.length === 2, '缺少两个可用于多工厂规则验收的裁片工厂')

  saveDispatchAcceptanceSlaRule({
    ruleName: '验收：多工厂裁片规则',
    processScopeType: 'PROCESS_ALL_CRAFTS',
    processCode: 'CUT_PANEL',
    processName: '裁片',
    craftName: DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME,
    factoryScopeType: 'FACTORIES',
    factoryIds: targetFactories.map((row) => row.factoryId),
    factoryNames: targetFactories.map((row) => row.factoryName),
    acceptTimeoutHours: 2,
    enabled: true,
    updatedBy: '验收脚本',
    updatedAt: '2026-06-09 16:20:00',
  })

  targetFactories.forEach((factory) => {
    const logs = listDispatchAcceptanceSlaFactoryLogs(factory.factoryId)
    assert(logs.some((log) => log.ruleName === '验收：多工厂裁片规则'), `${factory.factoryName} 缺少多工厂规则日志`)
    assert(logs.some((log) => log.effective), `${factory.factoryName} 缺少最终生效日志`)
  })

  const untouchedFactory = rows.find((row) => !targetFactories.some((target) => target.factoryId === row.factoryId) && row.abilityRows.some((ability) => ability.processCode === 'CUT_PANEL'))
  if (untouchedFactory) {
    const logs = listDispatchAcceptanceSlaFactoryLogs(untouchedFactory.factoryId)
    assert(!logs.some((log) => log.ruleName === '验收：多工厂裁片规则'), '多工厂规则错误写入未选择工厂日志')
  }
}

function assertGlobalDefaultLogs(): void {
  const factoryWithFallback = listDispatchAcceptanceSlaFactoryRows().find((row) => row.unconfiguredCount > 0)
  assert(factoryWithFallback, '缺少走全局默认的工厂样本')
  const beforeDefault = getDispatchAcceptanceSlaGlobalDefaultConfig()
  saveDispatchAcceptanceSlaGlobalDefaultConfig({
    defaultAcceptTimeoutHours: 10,
    enabled: beforeDefault.enabled,
    updatedBy: '验收脚本',
    updatedAt: '2026-06-09 16:30:00',
    remark: beforeDefault.remark,
  })
  const logs = listDispatchAcceptanceSlaFactoryLogs(factoryWithFallback.factoryId)
  assert(logs.some((log) => log.action === '全局兜底变更'), '全局默认变化未进入工厂日志')
  saveDispatchAcceptanceSlaGlobalDefaultConfig({
    defaultAcceptTimeoutHours: beforeDefault.defaultAcceptTimeoutHours,
    enabled: beforeDefault.enabled,
    updatedBy: beforeDefault.updatedBy,
    updatedAt: beforeDefault.updatedAt,
    remark: beforeDefault.remark,
  })
}

function assertPageStructure(): void {
  const page = renderDispatchAcceptanceSlaPage()
  assert(page.includes('接单时效配置'), '配置页标题缺失')
  assert(page.includes('工厂列表'), '主列表不是工厂列表')
  assert(page.includes('同一个工厂只展示一行'), '页面缺少工厂唯一行说明')
  assert(page.includes('查看明细'), '工厂列表缺少明细入口')
  assert(page.includes('查看日志'), '工厂列表缺少日志入口')
  assert(page.includes('新增规则'), '页面缺少新增规则入口')
  assert(!page.includes('返回任务分配'), '页面仍保留返回任务分配按钮')
  assert(page.includes('data-acceptance-sla-overlay'), '页面缺少局部覆盖层容器')
  assert(page.includes('data-acceptance-sla-pagination-scope="factory-list"'), '工厂列表缺少分页栏')
  assert(page.includes('data-acceptance-sla-field="pageSize"'), '工厂列表缺少每页条数选择')
  assert(countOccurrences(page, 'data-acceptance-sla-action="open-detail"') === 10, '工厂列表默认页没有限制为 10 家')
  triggerAcceptanceSlaPaginationAction('next-page', 'factory-list')
  const secondListPage = renderDispatchAcceptanceSlaPage()
  assert(secondListPage.includes('2 / '), '工厂列表下一页未生效')
  assert(countOccurrences(secondListPage, 'data-acceptance-sla-action="open-detail"') === 10, '工厂列表第二页没有继续按 10 家分页')
  triggerAcceptanceSlaAction('reset-filters')
  assert(page.includes('data-skip-page-rerender="true" data-acceptance-sla-action="open-create-rule"'), '新增规则仍会触发整页重渲染')
  assert(page.includes('data-skip-page-rerender="true" data-acceptance-sla-action="open-detail"'), '查看明细仍会触发整页重渲染')
  assert(page.includes('data-skip-page-rerender="true" data-acceptance-sla-action="open-logs"'), '查看日志仍会触发整页重渲染')
  assert(page.includes('有未配置'), '页面缺少未配置筛选')
  assert(!page.includes('<h2 class="text-base font-semibold text-slate-900">规则列表</h2>'), '主页面仍保留规则列表主表')
  assert(!page.includes('未自定义项'), '主页面仍展示未自定义项')
  assert(!page.includes('/fcs/dispatch/acceptance-sla/unconfigured'), '主页面仍指向独立未配置工厂列表')

  triggerAcceptanceSlaAction('open-create-rule')
  const ruleDialogPage = renderDispatchAcceptanceSlaPage()
  assert(ruleDialogPage.includes('新增接单时效规则'), '新增规则弹窗未渲染')
  assert(ruleDialogPage.includes('全部工序工艺'), '新增规则缺少全部工序工艺范围')
  assert(ruleDialogPage.includes('某工序 / 全部工艺'), '新增规则缺少工序全部工艺范围')
  assert(ruleDialogPage.includes('工厂层级'), '新增规则缺少工厂层级范围')
  assert(ruleDialogPage.includes('工厂类型'), '新增规则缺少工厂类型范围')
  assert(ruleDialogPage.includes('单个 / 多个工厂'), '新增规则缺少单个 / 多个工厂范围')
  assert(ruleDialogPage.includes('保存前影响预览'), '新增规则缺少影响范围预览')
  assert(ruleDialogPage.includes('填 0 表示派单后自动接单'), '新增规则接单时效字段缺少 0 小时自动接单提示')
  assert(ruleDialogPage.includes('data-skip-page-rerender="true" data-acceptance-sla-action="close-dialog"'), '弹窗关闭仍会触发整页重渲染')
  assert(ruleDialogPage.includes('data-skip-page-rerender="true" data-acceptance-sla-field="rule.processScopeType"'), '规则范围选择仍会触发整页重渲染')
  assert(ruleDialogPage.includes('data-skip-page-rerender="true" data-acceptance-sla-field="rule.factoryScopeType"'), '工厂范围选择仍会触发整页重渲染')
  triggerAcceptanceSlaField('rule.factoryId', 'F090', { checked: true })
  triggerAcceptanceSlaField('rule.acceptTimeoutHours', '0')
  const zeroTimeoutRuleDialogPage = renderDispatchAcceptanceSlaPage()
  assert(zeroTimeoutRuleDialogPage.includes('本次规则时效'), '新增规则影响预览缺少本次规则时效展示')
  assert(zeroTimeoutRuleDialogPage.includes('派单后自动接单'), '新增规则 0 小时预览未展示自动接单')
  triggerAcceptanceSlaAction('close-dialog')

  const factory = listDispatchAcceptanceSlaFactoryRows().find((row) => row.factoryId === 'F090') || listDispatchAcceptanceSlaFactoryRows()[0]
  triggerAcceptanceSlaAction('open-detail', { factoryId: factory.factoryId })
  const detailPage = renderDispatchAcceptanceSlaPage()
  assert(detailPage.includes('工厂接单时效明细'), '工厂明细抽屉未渲染')
  assert(detailPage.includes('当前接单时效'), '工厂明细缺少当前接单时效列')
  assert(detailPage.includes('规则来源'), '工厂明细缺少规则来源列')
  assert(detailPage.includes('data-acceptance-sla-pagination-scope="factory-detail"'), '工厂明细缺少分页栏')
  assert(detailPage.includes('data-skip-page-rerender="true" data-acceptance-sla-action="next-page"'), '工厂明细分页仍会触发整页重渲染')
  if (factory.abilityCount > 10) {
    assert(detailPage.includes(`共 ${factory.abilityCount} 条，当前 1-10`), '工厂明细第一页范围显示不正确')
    triggerAcceptanceSlaPaginationAction('next-page', 'factory-detail')
    const detailSecondPage = renderDispatchAcceptanceSlaPage()
    assert(detailSecondPage.includes(`共 ${factory.abilityCount} 条，当前 11-20`), '工厂明细下一页未生效')
  }
  triggerAcceptanceSlaAction('close-dialog')

  triggerAcceptanceSlaAction('open-logs', { factoryId: factory.factoryId })
  const logPage = renderDispatchAcceptanceSlaPage()
  assert(logPage.includes('工厂接单时效日志'), '工厂日志抽屉未渲染')
  assert(logPage.includes('未生效原因') || logPage.includes('当前最终生效规则') || logPage.includes('最终生效'), '工厂日志缺少生效说明')
  triggerAcceptanceSlaAction('close-dialog')
}

function assertUpstreamDownstreamWiring(): void {
  const dispatchDomain = readProjectFile('src/pages/dispatch-board/dispatch-domain.ts')
  const dispatchContext = readProjectFile('src/pages/dispatch-board/context.ts')
  const sewingDomain = readProjectFile('src/data/fcs/sewing-dispatch-workbench.ts')
  const runtimeTasks = readProjectFile('src/data/fcs/runtime-process-tasks.ts')
  const pdaDetail = readProjectFile('src/pages/pda-task-receive-detail.ts')
  assert(dispatchDomain.includes('resolveDispatchAcceptanceSlaForTask'), '非车缝派单未接入接单时效解析')
  assert(dispatchContext.includes('resolveDispatchAcceptanceSlaForTask'), '非车缝派单预览未接入接单时效解析')
  assert(sewingDomain.includes('resolveDispatchAcceptanceSlaForTask'), '车缝派单未接入接单时效解析')
  assert(runtimeTasks.includes('resolveDispatchAcceptanceSlaForTask'), '自动接单运行态未接入接单时效解析')
  assert(pdaDetail.includes('系统自动接单') || pdaDetail.includes('DISPATCH_ACCEPTANCE_SLA_AUTO_ACCEPT_BY'), 'PDA 接单详情缺少系统自动接单展示')
}

function main(): void {
  assertMenuAndRoute()
  assertFactoryListModel()
  assertRuleResolutionAndPriority()
  assertMultiFactoryRuleAndFactoryLogs()
  assertGlobalDefaultLogs()
  assertPageStructure()
  assertUpstreamDownstreamWiring()
  assert(listDispatchAcceptanceSlaRules().length >= 7, '规则模型样本不足')
  console.log('[check-dispatch-acceptance-sla] PASS')
}

main()
