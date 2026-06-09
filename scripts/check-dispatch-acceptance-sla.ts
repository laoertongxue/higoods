import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE,
  DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME,
  DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID,
  DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_NAME,
  DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_NAME,
  DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_NAME,
  DISPATCH_ACCEPTANCE_SLA_AUTO_ACCEPT_BY,
  buildDispatchAcceptanceDeadline,
  formatDispatchAcceptanceTimeout,
  getDispatchAcceptanceSlaGlobalDefaultConfig,
  getFactoryAbilityForDispatchAcceptance,
  listDispatchAcceptanceSlaCreateOptions,
  listDispatchAcceptanceSlaEffectiveFactoryOverrides,
  listDispatchAcceptanceSlaFactoryOverrideLogs,
  listDispatchAcceptanceSlaMissingProcessCraftRows,
  listDispatchAcceptanceSlaPageRows,
  resolveDispatchAcceptanceSlaForTask,
  saveDispatchAcceptanceSlaGlobalDefaultConfig,
  saveDispatchAcceptanceSlaConfig,
  saveDispatchAcceptanceSlaFactoryOverride,
} from '../src/data/fcs/dispatch-acceptance-sla.ts'
import {
  applyPendingDispatchAutoAcceptance,
  applyRuntimeDirectDispatchMeta,
  listRuntimeProcessTasks,
} from '../src/data/fcs/runtime-process-tasks.ts'
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

function triggerAcceptanceSlaAction(action: string, extraDataset: Record<string, string> = {}): void {
  const ElementStub = class {}
  ;(globalThis as unknown as { HTMLInputElement?: unknown }).HTMLInputElement ??= ElementStub
  ;(globalThis as unknown as { HTMLSelectElement?: unknown }).HTMLSelectElement ??= ElementStub
  ;(globalThis as unknown as { HTMLTextAreaElement?: unknown }).HTMLTextAreaElement ??= ElementStub
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

function assertMenuAndRoute(): void {
  const menu = readProjectFile('src/data/app-shell-config.ts')
  const routes = readProjectFile('src/router/routes-fcs.ts')
  const renderers = readProjectFile('src/router/route-renderers-fcs.ts')
  assert(menu.includes("title: '接单时效配置'"), '任务分配菜单下缺少接单时效配置')
  assert(menu.includes("href: '/fcs/dispatch/acceptance-sla'"), '接单时效配置菜单 href 不正确')
  assert(routes.includes("'/fcs/dispatch/acceptance-sla'"), '接单时效配置路由未注册')
  assert(renderers.includes('renderDispatchAcceptanceSlaPage'), '接单时效配置 renderer 未注册')
}

function assertConfigResolution(): void {
  const rows = listDispatchAcceptanceSlaPageRows()
  assert(rows.length >= 4, '接单时效配置样本不足，无法覆盖默认、覆盖、自动接单和兜底场景')
  assert(rows.some((row) => row.autoAcceptOverrideCount > 0), '缺少 0 小时自动接单覆盖规则')
  assert(listDispatchAcceptanceSlaMissingProcessCraftRows().length > 0, '缺少走全局默认的未自定义项样本')
  assert(getDispatchAcceptanceSlaGlobalDefaultConfig().defaultAcceptTimeoutHours === 12, '全局默认接单时效样本应为 12 小时')

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
  assert(printAuto.ruleSource === 'FACTORY_OVERRIDE', '工厂覆盖规则未优先命中')
  assert(printAuto.autoAccept, '0 小时规则未识别为自动接单')
  assert(printAuto.acceptDeadline === '2026-06-09 09:00:00', '0 小时规则接单截止应等于派单时间')

  const sewingOverride = resolveDispatchAcceptanceSlaForTask(
    {
      processCode: 'PROC_BASE_CONNECT',
      processBusinessCode: 'SEW',
      processNameZh: '车缝',
      processBusinessName: '车缝',
      craftCode: 'CRAFT_262145',
      craftName: '基础连接',
    },
    'ID-F001',
    'PT Sinar Garment Indonesia',
  )
  assert(sewingOverride.ruleSource === 'FACTORY_OVERRIDE', '运行时任务未按 processBusinessCode 命中工厂覆盖')
  assert(sewingOverride.acceptTimeoutHours === 2, '车缝工厂覆盖时效应为 2 小时')

  const embroideryFallback = resolveDispatchAcceptanceSlaForTask(
    {
      processCode: 'PROC_EMBROIDER',
      processBusinessCode: 'EMBROIDERY',
      processNameZh: '绣花',
      processBusinessName: '绣花',
      craftCode: 'CRAFT_000002',
      craftName: '绣花',
    },
    'ID-F018',
    'CV Satellite Bekasi Timur',
  )
  assert(embroideryFallback.ruleSource === 'PROCESS_CRAFT_DEFAULT', '停用工厂覆盖后应回退工序工艺默认')
  assert(embroideryFallback.acceptTimeoutHours === 8, '绣花默认接单时效应为 8 小时')

  const globalFallback = resolveDispatchAcceptanceSlaForTask({
    processCode: 'PROC_DIRECT_PRINT',
    processBusinessCode: 'SPECIAL_CRAFT',
    processNameZh: '特殊工艺',
    processBusinessName: '特殊工艺',
    craftCode: 'CRAFT_016384',
    craftName: '直喷',
  }, 'ID-F024', 'CV Satellite Yogyakarta Selatan', '2026-06-09 09:00:00')
  assert(globalFallback.ruleSource === 'GLOBAL_DEFAULT', '未命中自定义规则时应返回全局默认')
  assert(globalFallback.acceptTimeoutHours === 12, '全局默认时效应为 12 小时')
  assert(globalFallback.acceptDeadline === '2026-06-09 21:00:00', '全局默认接单截止计算错误')
  assert(formatDispatchAcceptanceTimeout(0) === '派单后自动接单', '0 小时展示文案不正确')
}

function assertGlobalDefaultRuleFlow(): void {
  const saved = saveDispatchAcceptanceSlaGlobalDefaultConfig({
    enabled: true,
    defaultAcceptTimeoutHours: 0,
    updatedBy: '接单时效验收',
    updatedAt: '2026-06-09 12:20:00',
    remark: '全局默认规则验收样本',
  })
  assert(saved.defaultAcceptTimeoutHours === 0, '全局默认规则保存失败')
  const resolution = resolveDispatchAcceptanceSlaForTask(
    {
      processCode: 'PROC_GLOBAL_FALLBACK',
      processNameZh: '未知工序',
      craftCode: 'CRAFT_GLOBAL_FALLBACK',
      craftName: '未知工艺',
    },
    'ID-F024',
    'CV Satellite Yogyakarta Selatan',
    '2026-06-09 13:00:00',
  )
  assert(resolution.ruleSource === 'GLOBAL_DEFAULT', '保存后的全局默认规则未被命中')
  assert(resolution.autoAccept, '0 小时全局默认未识别为自动接单')
  assert(resolution.acceptDeadline === '2026-06-09 13:00:00', '0 小时全局默认截止时间应等于派单时间')

  saveDispatchAcceptanceSlaGlobalDefaultConfig({
    enabled: true,
    defaultAcceptTimeoutHours: 12,
    updatedBy: '生产计划主管',
    updatedAt: '2026-06-09 09:00:00',
    remark: '未命中工厂覆盖和工序工艺自定义规则时，统一按全局默认接单时效执行。',
  })
}

function assertRuntimeWriteback(): void {
  const tasks = listRuntimeProcessTasks().filter((task) => task.craftCode === 'CRAFT_262145')
  assert(tasks.length >= 2, '缺少车缝基础连接运行时任务，无法校验写入和扫描')

  const dispatchedAt = '2026-06-09 09:00:00'
  const immediate = applyRuntimeDirectDispatchMeta({
    taskId: tasks[0].taskId,
    factoryId: 'F090',
    factoryName: '全能力测试工厂',
    acceptDeadline: dispatchedAt,
    taskDeadline: '2026-06-16 18:00:00',
    remark: '接单时效专项验收：0 小时自动接单',
    by: '专项验收',
    dispatchedAt,
    autoAccept: true,
    acceptanceSla: {
      ruleSource: 'FACTORY_OVERRIDE',
      processCode: 'SEW',
      processName: '车缝',
      craftCode: 'CRAFT_262145',
      craftName: '基础连接',
      factoryId: 'F090',
      factoryName: '全能力测试工厂',
      acceptTimeoutHours: 0,
      enabled: true,
      acceptDeadline: dispatchedAt,
      autoAccept: true,
    },
    dispatchPrice: 1000,
    dispatchPriceCurrency: 'IDR',
    dispatchPriceUnit: '件',
    priceDiffReason: '',
  })
  assert(immediate?.acceptanceStatus === 'ACCEPTED', '0 小时派单后应直接写入已接单')
  assert(immediate?.acceptedBy === DISPATCH_ACCEPTANCE_SLA_AUTO_ACCEPT_BY, '自动接单 acceptedBy 应为系统自动接单')
  assert(immediate?.dispatchAcceptanceTimeoutHours === 0, '自动接单任务未写入时效小时数')

  const pendingTask = tasks[1]
  const pastDeadline = '2026-06-09 08:00:00'
  const pending = applyRuntimeDirectDispatchMeta({
    taskId: pendingTask.taskId,
    factoryId: 'ID-F001',
    factoryName: 'PT Sinar Garment Indonesia',
    acceptDeadline: pastDeadline,
    taskDeadline: '2026-06-16 18:00:00',
    remark: '接单时效专项验收：到期扫描',
    by: '专项验收',
    dispatchedAt: '2026-06-09 06:00:00',
    autoAccept: false,
    acceptanceSla: {
      ruleSource: 'FACTORY_OVERRIDE',
      processCode: 'SEW',
      processName: '车缝',
      craftCode: 'CRAFT_262145',
      craftName: '基础连接',
      factoryId: 'ID-F001',
      factoryName: 'PT Sinar Garment Indonesia',
      acceptTimeoutHours: 2,
      enabled: true,
      acceptDeadline: pastDeadline,
      autoAccept: false,
    },
    dispatchPrice: 1000,
    dispatchPriceCurrency: 'IDR',
    dispatchPriceUnit: '件',
    priceDiffReason: '',
  })
  assert(pending?.acceptanceStatus === 'PENDING', '非 0 小时派单应先进入待接单')
  const scan = applyPendingDispatchAutoAcceptance('2026-06-09 09:01:00')
  assert(scan.taskIds.includes(pendingTask.taskId), '到期待接单任务未被自动接单扫描处理')
  const accepted = listRuntimeProcessTasks().find((task) => task.taskId === pendingTask.taskId)
  assert(accepted?.acceptanceStatus === 'ACCEPTED', '到期扫描后任务应为已接单')
  assert(accepted?.auditLogs.some((log) => log.action === 'AUTO_ACCEPT_BY_SLA'), '自动接单缺少审计日志')

  const repeat = applyPendingDispatchAutoAcceptance('2026-06-09 09:02:00')
  assert(!repeat.taskIds.includes(pendingTask.taskId), '已自动接单任务不应被重复处理')
  assert(buildDispatchAcceptanceDeadline('2026-06-09 09:00:00', { acceptTimeoutHours: 2 }) === '2026-06-09 11:00:00', '接单截止时间计算错误')
}

function assertCreateAndOverrideRuleFlow(): void {
  const options = listDispatchAcceptanceSlaCreateOptions()
  assert(options.length > 0, '缺少可新增规则的未配置工序工艺样本')
  const target = options.find((item) => item.processCode !== 'SPECIAL_CRAFT') ?? options[0]
  const saved = saveDispatchAcceptanceSlaConfig({
    processCode: target.processCode,
    processName: target.processName,
    craftCode: target.craftCode,
    craftName: target.craftName,
    enabled: true,
    defaultAcceptTimeoutHours: 5,
    updatedBy: '接单时效验收',
    updatedAt: '2026-06-09 12:00:00',
    remark: '新增规则验收样本',
  })
  assert(saved.configId, '新增规则未生成配置 ID')

  const resolved = resolveDispatchAcceptanceSlaForTask({
    processCode: saved.processCode,
    processNameZh: saved.processName,
    craftCode: saved.craftCode,
    craftName: saved.craftName,
  })
  assert(resolved.ruleSource === 'PROCESS_CRAFT_DEFAULT', '新增规则未参与派单时效解析')
  assert(resolved.acceptTimeoutHours === 5, '新增规则默认接单时效未生效')

  const abilityFactory = getFactoryAbilityForDispatchAcceptance(saved.processCode, saved.craftCode)[0]
  if (abilityFactory) {
    const overrideSaved = saveDispatchAcceptanceSlaFactoryOverride(saved.configId, {
      factoryId: abilityFactory.id,
      factoryName: abilityFactory.name,
      acceptTimeoutHours: 0,
      enabled: true,
      updatedBy: '接单时效验收',
      updatedAt: '2026-06-09 12:05:00',
      remark: '工厂覆盖验收样本',
    })
    assert(overrideSaved, '新增工厂覆盖保存失败')
    const overrideResolved = resolveDispatchAcceptanceSlaForTask(
      {
        processCode: saved.processCode,
        processNameZh: saved.processName,
        craftCode: saved.craftCode,
        craftName: saved.craftName,
      },
      abilityFactory.id,
      abilityFactory.name,
    )
    assert(overrideResolved.ruleSource === 'FACTORY_OVERRIDE', '新增工厂覆盖未优先命中')
    assert(overrideResolved.autoAccept, '新增 0 小时工厂覆盖未识别为自动接单')
  }
}

function assertCreateRuleProcessCraftSelectorsAndAllCrafts(): void {
  const options = listDispatchAcceptanceSlaCreateOptions()
  const specialAllCrafts = options.find(
    (item) => item.processCode === 'SPECIAL_CRAFT' && item.craftCode === DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE,
  )
  const specialCrafts = options.filter(
    (item) => item.processCode === 'SPECIAL_CRAFT' && item.craftCode !== DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE,
  )
  assert(specialAllCrafts, '新增规则缺少特殊工艺 / 全部工艺选项')
  assert(specialAllCrafts.craftName === DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME, '全部工艺选项文案不正确')
  assert(specialAllCrafts.coversAllCrafts, '全部工艺选项缺少覆盖全工艺标识')
  assert(specialCrafts.length > 0, '新增规则缺少特殊工艺下的具体工艺选项')

  const savedAllCrafts = saveDispatchAcceptanceSlaConfig({
    processCode: specialAllCrafts.processCode,
    processName: specialAllCrafts.processName,
    craftCode: specialAllCrafts.craftCode,
    craftName: specialAllCrafts.craftName,
    enabled: true,
    defaultAcceptTimeoutHours: 9,
    updatedBy: '接单时效验收',
    updatedAt: '2026-06-09 12:25:00',
    remark: '全部工艺规则验收样本',
  })
  assert(savedAllCrafts.craftCode === DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE, '全部工艺规则保存编码错误')

  const fallbackResolved = resolveDispatchAcceptanceSlaForTask({
    processCode: specialCrafts[0].processCode,
    processNameZh: specialCrafts[0].processName,
    craftCode: specialCrafts[0].craftCode,
    craftName: specialCrafts[0].craftName,
  })
  assert(fallbackResolved.ruleSource === 'PROCESS_CRAFT_DEFAULT', '全部工艺规则未作为工序默认规则命中')
  assert(fallbackResolved.configId === savedAllCrafts.configId, '未命中具体工艺时没有回退到全部工艺规则')
  assert(fallbackResolved.acceptTimeoutHours === 9, '全部工艺规则时效未生效')
  assert(
    listDispatchAcceptanceSlaMissingProcessCraftRows().every((row) => row.processCode !== specialAllCrafts.processCode),
    '已配置全部工艺后，该工序仍出现在未自定义项中',
  )

  const savedSpecificCraft = saveDispatchAcceptanceSlaConfig({
    processCode: specialCrafts[0].processCode,
    processName: specialCrafts[0].processName,
    craftCode: specialCrafts[0].craftCode,
    craftName: specialCrafts[0].craftName,
    enabled: true,
    defaultAcceptTimeoutHours: 4,
    updatedBy: '接单时效验收',
    updatedAt: '2026-06-09 12:26:00',
    remark: '具体工艺优先验收样本',
  })

  const exactResolved = resolveDispatchAcceptanceSlaForTask({
    processCode: specialCrafts[0].processCode,
    processNameZh: specialCrafts[0].processName,
    craftCode: specialCrafts[0].craftCode,
    craftName: specialCrafts[0].craftName,
  })
  assert(exactResolved.configId === savedSpecificCraft.configId, '具体工艺规则未优先于全部工艺规则')
  assert(exactResolved.acceptTimeoutHours === 4, '具体工艺规则时效未优先生效')
}

function assertFactoryOverrideScopeAndLogs(): void {
  const cutConfig = listDispatchAcceptanceSlaPageRows().find((row) => row.configId === 'DAS-CUT-POSITION')
  assert(cutConfig, '缺少裁片定位裁接单时效规则，无法校验全部工厂覆盖')

  const abilityFactory = getFactoryAbilityForDispatchAcceptance(cutConfig.processCode, cutConfig.craftCode)
    .find((factory) => factory.id === 'F090')
    ?? getFactoryAbilityForDispatchAcceptance(cutConfig.processCode, cutConfig.craftCode)[0]
  assert(abilityFactory, '裁片定位裁缺少可派单工厂，无法校验覆盖规则')

  const allFactoriesSaved = saveDispatchAcceptanceSlaFactoryOverride(cutConfig.configId, {
    factoryId: DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID,
    factoryName: DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_NAME,
    acceptTimeoutHours: 7,
    enabled: true,
    updatedBy: '接单时效验收',
    updatedAt: '2026-06-09 12:30:00',
    remark: '全部工厂覆盖验收样本',
  })
  assert(allFactoriesSaved, '全部工厂覆盖保存失败')

  const allFactoriesResolved = resolveDispatchAcceptanceSlaForTask(
    {
      processCode: cutConfig.processCode,
      processNameZh: cutConfig.processName,
      craftCode: cutConfig.craftCode,
      craftName: cutConfig.craftName,
    },
    abilityFactory.id,
    abilityFactory.name,
  )
  assert(allFactoriesResolved.ruleSource === 'FACTORY_OVERRIDE', '全部工厂覆盖未参与派单命中')
  assert(allFactoriesResolved.acceptTimeoutHours === 7, '全部工厂覆盖时效未生效')

  const specificFactorySaved = saveDispatchAcceptanceSlaFactoryOverride(cutConfig.configId, {
    factoryId: abilityFactory.id,
    factoryName: abilityFactory.name,
    acceptTimeoutHours: 3,
    enabled: true,
    updatedBy: '接单时效验收',
    updatedAt: '2026-06-09 12:35:00',
    remark: '指定工厂覆盖全部工厂验收样本',
  })
  assert(specificFactorySaved, '指定工厂覆盖保存失败')

  const specificResolved = resolveDispatchAcceptanceSlaForTask(
    {
      processCode: cutConfig.processCode,
      processNameZh: cutConfig.processName,
      craftCode: cutConfig.craftCode,
      craftName: cutConfig.craftName,
    },
    abilityFactory.id,
    abilityFactory.name,
  )
  assert(specificResolved.acceptTimeoutHours === 3, '后添加的指定工厂覆盖未覆盖全部工厂规则')

  const specificFactoryUpdated = saveDispatchAcceptanceSlaFactoryOverride(cutConfig.configId, {
    factoryId: abilityFactory.id,
    factoryName: abilityFactory.name,
    acceptTimeoutHours: 1,
    enabled: true,
    updatedBy: '接单时效验收',
    updatedAt: '2026-06-09 12:40:00',
    remark: '同一工厂重复维护验收样本',
  })
  assert(specificFactoryUpdated, '同一工厂重复覆盖保存失败')

  const updatedSpecificResolved = resolveDispatchAcceptanceSlaForTask(
    {
      processCode: cutConfig.processCode,
      processNameZh: cutConfig.processName,
      craftCode: cutConfig.craftCode,
      craftName: cutConfig.craftName,
    },
    abilityFactory.id,
    abilityFactory.name,
  )
  assert(updatedSpecificResolved.acceptTimeoutHours === 1, '同一工厂后添加规则未覆盖之前规则')

  const allFactoriesUpdated = saveDispatchAcceptanceSlaFactoryOverride(cutConfig.configId, {
    factoryId: DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID,
    factoryName: DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_NAME,
    acceptTimeoutHours: 6,
    enabled: true,
    updatedBy: '接单时效验收',
    updatedAt: '2026-06-09 12:45:00',
    remark: '全部工厂后添加覆盖指定工厂验收样本',
  })
  assert(allFactoriesUpdated, '全部工厂重复覆盖保存失败')

  const latestApplicableResolved = resolveDispatchAcceptanceSlaForTask(
    {
      processCode: cutConfig.processCode,
      processNameZh: cutConfig.processName,
      craftCode: cutConfig.craftCode,
      craftName: cutConfig.craftName,
    },
    abilityFactory.id,
    abilityFactory.name,
  )
  assert(latestApplicableResolved.acceptTimeoutHours === 6, '后添加的全部工厂规则未覆盖同一工厂较早规则')

  const effectiveOverrides = listDispatchAcceptanceSlaEffectiveFactoryOverrides(allFactoriesUpdated)
  assert(
    effectiveOverrides.some((item) => item.factoryId === DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID && item.acceptTimeoutHours === 6),
    '当前最新覆盖记录缺少全部工厂最新值',
  )
  assert(
    effectiveOverrides.some((item) => item.factoryId === abilityFactory.id && item.acceptTimeoutHours === 1),
    '当前最新覆盖记录缺少指定工厂最新值',
  )

  const logs = listDispatchAcceptanceSlaFactoryOverrideLogs(cutConfig.configId)
  assert(logs.some((log) => log.factoryId === DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID), '工厂维度日志缺少全部工厂记录')
  assert(logs.some((log) => log.factoryId === abilityFactory.id && log.action === '覆盖更新'), '工厂维度日志缺少指定工厂覆盖更新记录')
  assert(logs[0]?.updatedAt === '2026-06-09 12:45:00', '工厂维度日志未按最新变更倒序展示')
}

function assertFactoryHierarchyScopeAndIndependentRule(): void {
  const sewingConfig = listDispatchAcceptanceSlaPageRows().find((row) => row.configId === 'DAS-SEW-BASIC')
  assert(sewingConfig, '缺少车缝基础连接规则，无法校验工厂层级/类型覆盖')
  const abilityFactory = getFactoryAbilityForDispatchAcceptance(sewingConfig.processCode, sewingConfig.craftCode)
    .find((factory) => factory.id === 'F090')
  assert(abilityFactory, '缺少全能力测试工厂，无法校验单厂独立规则')

  const protectedSpecific = saveDispatchAcceptanceSlaFactoryOverride(sewingConfig.configId, {
    scopeType: 'FACTORY',
    factoryTier: abilityFactory.factoryTier,
    factoryTierName: abilityFactory.factoryTierName,
    factoryType: abilityFactory.factoryType,
    factoryTypeName: abilityFactory.factoryTypeName,
    factoryId: abilityFactory.id,
    factoryName: abilityFactory.name,
    protectFromBroadOverrides: true,
    acceptTimeoutHours: 1,
    enabled: true,
    updatedBy: '接单时效验收',
    updatedAt: '2026-06-09 12:50:00',
    remark: '单厂独立规则验收样本',
  })
  assert(protectedSpecific, '单厂独立规则保存失败')

  const tierOverride = saveDispatchAcceptanceSlaFactoryOverride(sewingConfig.configId, {
    scopeType: 'FACTORY_TIER',
    factoryTier: abilityFactory.factoryTier,
    factoryTierName: abilityFactory.factoryTierName,
    factoryId: abilityFactory.factoryTier,
    factoryName: `${abilityFactory.factoryTierName} / ${DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_NAME} / ${DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_NAME}`,
    acceptTimeoutHours: 5,
    enabled: true,
    updatedBy: '接单时效验收',
    updatedAt: '2026-06-09 12:51:00',
    remark: '工厂层级广域规则验收样本',
  })
  assert(tierOverride, '工厂层级广域规则保存失败')

  const afterTierBroad = resolveDispatchAcceptanceSlaForTask(
    {
      processCode: sewingConfig.processCode,
      processNameZh: sewingConfig.processName,
      craftCode: sewingConfig.craftCode,
      craftName: sewingConfig.craftName,
    },
    abilityFactory.id,
    abilityFactory.name,
  )
  assert(afterTierBroad.acceptTimeoutHours === 1, '单厂独立规则被工厂层级广域规则覆盖')

  const typeOverride = saveDispatchAcceptanceSlaFactoryOverride(sewingConfig.configId, {
    scopeType: 'FACTORY_TYPE',
    factoryTier: abilityFactory.factoryTier,
    factoryTierName: abilityFactory.factoryTierName,
    factoryType: abilityFactory.factoryType,
    factoryTypeName: abilityFactory.factoryTypeName,
    factoryId: `${abilityFactory.factoryTier}::${abilityFactory.factoryType}`,
    factoryName: `${abilityFactory.factoryTierName} / ${abilityFactory.factoryTypeName} / ${DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_NAME}`,
    acceptTimeoutHours: 6,
    enabled: true,
    updatedBy: '接单时效验收',
    updatedAt: '2026-06-09 12:52:00',
    remark: '工厂类型广域规则验收样本',
  })
  assert(typeOverride, '工厂类型广域规则保存失败')

  const afterTypeBroad = resolveDispatchAcceptanceSlaForTask(
    {
      processCode: sewingConfig.processCode,
      processNameZh: sewingConfig.processName,
      craftCode: sewingConfig.craftCode,
      craftName: sewingConfig.craftName,
    },
    abilityFactory.id,
    abilityFactory.name,
  )
  assert(afterTypeBroad.acceptTimeoutHours === 1, '单厂独立规则被工厂类型广域规则覆盖')

  saveDispatchAcceptanceSlaFactoryOverride(sewingConfig.configId, {
    scopeType: 'FACTORY',
    factoryTier: abilityFactory.factoryTier,
    factoryTierName: abilityFactory.factoryTierName,
    factoryType: abilityFactory.factoryType,
    factoryTypeName: abilityFactory.factoryTypeName,
    factoryId: abilityFactory.id,
    factoryName: abilityFactory.name,
    protectFromBroadOverrides: false,
    acceptTimeoutHours: 3,
    enabled: true,
    updatedBy: '接单时效验收',
    updatedAt: '2026-06-09 12:53:00',
    remark: '取消单厂独立后验收样本',
  })
  const allFactoryOverride = saveDispatchAcceptanceSlaFactoryOverride(sewingConfig.configId, {
    scopeType: 'ALL_FACTORIES',
    factoryId: DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID,
    factoryName: DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_NAME,
    acceptTimeoutHours: 4,
    enabled: true,
    updatedBy: '接单时效验收',
    updatedAt: '2026-06-09 12:54:00',
    remark: '全部工厂广域规则验收样本',
  })
  assert(allFactoryOverride, '全部工厂广域规则保存失败')

  const afterUnprotectedBroad = resolveDispatchAcceptanceSlaForTask(
    {
      processCode: sewingConfig.processCode,
      processNameZh: sewingConfig.processName,
      craftCode: sewingConfig.craftCode,
      craftName: sewingConfig.craftName,
    },
    abilityFactory.id,
    abilityFactory.name,
  )
  assert(afterUnprotectedBroad.acceptTimeoutHours === 4, '取消单厂独立后，全部工厂广域规则未覆盖该工厂')

  const effectiveOverrides = listDispatchAcceptanceSlaEffectiveFactoryOverrides(allFactoryOverride)
  assert(effectiveOverrides.some((item) => item.scopeType === 'FACTORY_TIER'), '当前最新覆盖记录缺少工厂层级规则')
  assert(effectiveOverrides.some((item) => item.scopeType === 'FACTORY_TYPE'), '当前最新覆盖记录缺少工厂类型规则')
  assert(effectiveOverrides.some((item) => item.scopeType === 'FACTORY' && item.protectFromBroadOverrides === false), '当前最新覆盖记录未记录单厂独立取消状态')

  const logs = listDispatchAcceptanceSlaFactoryOverrideLogs(sewingConfig.configId)
  assert(logs.some((log) => log.scopeLabel.includes(DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_NAME)), '工厂维度日志缺少层级广域范围')
  assert(logs.some((log) => log.scopeLabel.includes(abilityFactory.factoryTypeName)), '工厂维度日志缺少类型广域范围')
}

function assertMultiAbilityFactoryResolution(): void {
  const printFactory = getFactoryAbilityForDispatchAcceptance('PRINT', 'CRAFT_2000001').find((factory) => factory.id === 'F090')
  const cutFactory = getFactoryAbilityForDispatchAcceptance('CUT_PANEL', 'CRAFT_000001').find((factory) => factory.id === 'F090')
  assert(printFactory && cutFactory && printFactory.id === cutFactory.id, '缺少同一工厂多工序工艺能力样本')

  const printResolution = resolveDispatchAcceptanceSlaForTask(
    {
      processCode: 'PRINT',
      processNameZh: '印花',
      craftCode: 'CRAFT_2000001',
      craftName: '丝网印',
    },
    printFactory.id,
    printFactory.name,
  )
  const cutResolution = resolveDispatchAcceptanceSlaForTask(
    {
      processCode: 'CUT_PANEL',
      processNameZh: '裁片',
      craftCode: 'CRAFT_000001',
      craftName: '定位裁',
    },
    cutFactory.id,
    cutFactory.name,
  )

  assert(printResolution.configId === 'DAS-PRINT-SCREEN', '多能力工厂印花任务未先按印花工序工艺定位规则')
  assert(cutResolution.configId === 'DAS-CUT-POSITION', '多能力工厂裁片任务未先按裁片工序工艺定位规则')
  assert(printResolution.acceptTimeoutHours === 0, '多能力工厂印花任务不应串用裁片接单时效')
  assert(cutResolution.acceptTimeoutHours === 6, '多能力工厂裁片任务不应串用印花接单时效')
}

function assertPageAndUpstreamDownstreamWiring(): void {
  const page = renderDispatchAcceptanceSlaPage()
  assert(page.includes('接单时效配置'), '配置页标题缺失')
  assert(page.includes('规则列表'), '配置页缺少规则列表主体')
  assert(page.includes('全局兜底规则'), '配置页缺少全局兜底规则')
  assert(page.includes('调整全局规则'), '配置页缺少全局规则维护入口')
  assert(page.includes('新增规则'), '配置页缺少新增规则入口')
  assert(page.includes('维护覆盖'), '配置页缺少工厂覆盖维护入口')
  assert(page.includes('未自定义项'), '配置页缺少未自定义项区')
  assert(!page.includes('未配置风险'), '配置页仍把未自定义项展示为未配置风险')
  assert(page.includes('派单后自动接单'), '配置页缺少 0 小时自动接单文案')
  assert(page.includes('全部工厂'), '配置页缺少全部工厂覆盖选项或展示')
  assert(page.includes('多能力工厂'), '配置页缺少同一工厂多工序工艺能力说明')
  assert(!page.includes('工厂覆盖示例'), '配置页仍保留平铺式工厂覆盖示例')

  triggerAcceptanceSlaAction('open-create')
  const createDialogPage = renderDispatchAcceptanceSlaPage()
  assert(createDialogPage.includes('新增接单时效规则'), '新增规则弹窗未渲染')
  assert(createDialogPage.includes('data-acceptance-sla-field="create.processCode"'), '新增规则弹窗未拆出工序选择')
  assert(createDialogPage.includes('data-acceptance-sla-field="create.craftCode"'), '新增规则弹窗未拆出工艺选择')
  assert(createDialogPage.includes(DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME), '新增规则弹窗缺少全部工艺选项')
  assert(!createDialogPage.includes('data-acceptance-sla-field="create.processCraftKey"'), '新增规则弹窗仍保留旧的工序工艺组合下拉')
  triggerAcceptanceSlaAction('close-dialog')

  triggerAcceptanceSlaAction('open-overrides', { configId: 'DAS-CUT-POSITION' })
  const overrideDrawerPage = renderDispatchAcceptanceSlaPage()
  assert(overrideDrawerPage.includes('data-acceptance-sla-field="override.factoryTier"'), '维护覆盖缺少工厂层级选择')
  assert(overrideDrawerPage.includes('data-acceptance-sla-field="override.factoryType"'), '维护覆盖缺少工厂类型选择')
  assert(overrideDrawerPage.includes('data-acceptance-sla-field="override.factoryId"'), '维护覆盖缺少工厂选择')
  assert(overrideDrawerPage.includes(DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_NAME), '维护覆盖缺少全部层级选项')
  assert(overrideDrawerPage.includes(DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_NAME), '维护覆盖缺少全部工厂类型选项')
  assert(overrideDrawerPage.includes('单厂独立规则'), '维护覆盖缺少单厂独立规则文案')
  triggerAcceptanceSlaAction('close-dialog')

  const pageSource = readProjectFile('src/pages/dispatch-acceptance-sla.ts')
  assert(pageSource.includes('data-acceptance-sla-field="create.processCode"'), '新增规则未拆出工序选择')
  assert(pageSource.includes('data-acceptance-sla-field="create.craftCode"'), '新增规则未拆出工艺选择')
  assert(pageSource.includes('DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME'), '新增规则缺少全部工艺入口说明')
  assert(pageSource.includes('DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID'), '配置页未接入全部工厂覆盖常量')
  assert(pageSource.includes('listDispatchAcceptanceSlaFactoryOverrideLogs'), '配置页未接入工厂维度日志')
  assert(pageSource.includes('工厂维度变更日志'), '配置页缺少工厂维度变更日志')
  assert(pageSource.includes('handleDispatchAcceptanceSlaEvent'), '配置页缺少事件处理函数')
  assert(pageSource.includes('save-create'), '配置页缺少保存新增规则动作')
  assert(pageSource.includes('save-override'), '配置页缺少保存工厂覆盖动作')
  assert(pageSource.includes('save-global'), '配置页缺少保存全局默认规则动作')

  const fcsHandlers = readProjectFile('src/main-handlers/fcs-handlers.ts')
  assert(fcsHandlers.includes('handleDispatchAcceptanceSlaEvent'), 'FCS 事件分发未接入接单时效配置页')
  assert(fcsHandlers.includes('isDispatchAcceptanceSlaDialogOpen'), 'ESC 关闭逻辑未接入接单时效配置页')

  const dispatchDomain = readProjectFile('src/pages/dispatch-board/dispatch-domain.ts')
  assert(dispatchDomain.includes('renderAcceptanceSlaPreview'), '非车缝派单弹窗未接入接单时效预览')
  assert(!dispatchDomain.includes('data-dispatch-field="dispatch.acceptDeadline"'), '非车缝派单仍保留手填接单截止时间')
  assert(dispatchDomain.includes('acceptanceSla'), '非车缝派单确认未写入接单时效命中结果')
  assert(dispatchDomain.includes('GLOBAL_DEFAULT') || readProjectFile('src/data/fcs/dispatch-acceptance-sla.ts').includes('GLOBAL_DEFAULT'), '派单接单时效缺少全局默认来源')

  const sewingDomain = readProjectFile('src/data/fcs/sewing-dispatch-workbench.ts')
  assert(sewingDomain.includes('applyRuntimeDirectDispatchMeta'), '车缝直接派单未补运行时接单 meta')
  assert(sewingDomain.includes('resolveDispatchAcceptanceSlaForTask'), '车缝直接派单未接入接单时效规则')

  const pdaDetail = readProjectFile('src/pages/pda-task-receive-detail.ts')
  assert(pdaDetail.includes('系统自动接单'), 'PDA 接单详情缺少系统自动接单文案')

  const productionDetail = readProjectFile('src/pages/production/detail-domain.ts')
  assert(productionDetail.includes('自动接单：'), '生产详情缺少自动接单展示')
  assert(productionDetail.includes('接单时效'), '生产详情缺少接单时效展示')

  const capacity = readProjectFile('src/data/fcs/capacity-usage-ledger.ts')
  assert(capacity.includes('syncDetailDirectTaskCapacityUsage'), '产能未补明细直接派单冻结转换')
}

function main(): void {
  assertMenuAndRoute()
  assertConfigResolution()
  assertGlobalDefaultRuleFlow()
  assertRuntimeWriteback()
  assertCreateRuleProcessCraftSelectorsAndAllCrafts()
  assertCreateAndOverrideRuleFlow()
  assertFactoryOverrideScopeAndLogs()
  assertFactoryHierarchyScopeAndIndependentRule()
  assertMultiAbilityFactoryResolution()
  assertPageAndUpstreamDownstreamWiring()
  console.log('[check-dispatch-acceptance-sla] PASS')
}

main()
