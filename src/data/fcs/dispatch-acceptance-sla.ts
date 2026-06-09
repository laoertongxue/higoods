import { listBusinessFactoryMasterRecords } from './factory-master-store.ts'
import {
  factoryTierConfig,
  factoryTypeConfig,
  type FactoryTier,
  type FactoryType,
} from './factory-types.ts'
import { listProcessCraftDictRows } from './process-craft-dict.ts'

export type DispatchAcceptanceSlaRuleSource =
  | 'FACTORY_OVERRIDE'
  | 'PROCESS_CRAFT_DEFAULT'
  | 'GLOBAL_DEFAULT'
  | 'UNCONFIGURED'

export type DispatchAcceptanceSlaFactoryOverrideScopeType =
  | 'ALL_FACTORIES'
  | 'FACTORY_TIER'
  | 'FACTORY_TYPE'
  | 'FACTORY'

export interface DispatchAcceptanceSlaTaskInput {
  processCode: string
  processNameZh?: string
  processBusinessCode?: string
  processBusinessName?: string
  craftCode?: string
  craftName?: string
}

export interface DispatchAcceptanceSlaFactoryOverride {
  overrideId: string
  scopeType?: DispatchAcceptanceSlaFactoryOverrideScopeType
  factoryTier?: FactoryTier
  factoryTierName?: string
  factoryType?: FactoryType
  factoryTypeName?: string
  factoryId: string
  factoryName: string
  protectFromBroadOverrides?: boolean
  acceptTimeoutHours: number
  enabled: boolean
  updatedBy: string
  updatedAt: string
  remark?: string
}

export interface DispatchAcceptanceSlaFactoryOverrideLog {
  logId: string
  configId: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  factoryId: string
  factoryName: string
  scopeLabel: string
  previousAcceptTimeoutHours: number | null
  nextAcceptTimeoutHours: number
  previousEnabled: boolean | null
  nextEnabled: boolean
  action: string
  updatedBy: string
  updatedAt: string
  remark?: string
}

export interface DispatchAcceptanceSlaConfig {
  configId: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  enabled: boolean
  defaultAcceptTimeoutHours: number
  updatedBy: string
  updatedAt: string
  remark?: string
  factoryOverrides: DispatchAcceptanceSlaFactoryOverride[]
}

export interface DispatchAcceptanceSlaGlobalDefaultConfig {
  configId: 'DAS-GLOBAL-DEFAULT'
  enabled: boolean
  defaultAcceptTimeoutHours: number
  updatedBy: string
  updatedAt: string
  remark?: string
}

export interface DispatchAcceptanceSlaGlobalDefaultSaveInput {
  enabled: boolean
  defaultAcceptTimeoutHours: number
  updatedBy?: string
  updatedAt?: string
  remark?: string
}

export interface DispatchAcceptanceSlaConfigSaveInput {
  processCode: string
  processName: string
  craftCode?: string
  craftName?: string
  enabled: boolean
  defaultAcceptTimeoutHours: number
  updatedBy?: string
  updatedAt?: string
  remark?: string
}

export interface DispatchAcceptanceSlaFactoryOverrideSaveInput {
  scopeType?: DispatchAcceptanceSlaFactoryOverrideScopeType
  factoryTier?: FactoryTier
  factoryTierName?: string
  factoryType?: FactoryType
  factoryTypeName?: string
  factoryId: string
  factoryName: string
  protectFromBroadOverrides?: boolean
  acceptTimeoutHours: number
  enabled: boolean
  updatedBy?: string
  updatedAt?: string
  remark?: string
}

export interface DispatchAcceptanceSlaCreateOption {
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  processCraftKey: string
  processCraftLabel: string
  coversAllCrafts: boolean
}

export interface DispatchAcceptanceSlaResolution {
  ruleSource: DispatchAcceptanceSlaRuleSource
  configId?: string
  overrideId?: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  factoryId?: string
  factoryName?: string
  acceptTimeoutHours: number | null
  enabled: boolean
  acceptDeadline?: string
  autoAccept: boolean
  missingReason?: string
}

export const DISPATCH_ACCEPTANCE_SLA_AUTO_ACCEPT_BY = '系统自动接单'
export const DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID = '__ALL_FACTORIES__'
export const DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_NAME = '全部工厂'
export const DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE = '__ALL_CRAFTS__'
export const DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME = '全部工艺'
export const DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_ID = '__ALL_FACTORY_TIERS__'
export const DISPATCH_ACCEPTANCE_SLA_ALL_TIERS_NAME = '全部层级'
export const DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_ID = '__ALL_FACTORY_TYPES__'
export const DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_NAME = '全部工厂类型'

function getProcessCraftKey(processCode: string, craftCode?: string): string {
  return `${processCode}::${craftCode || '默认工艺'}`
}

export function getDispatchAcceptanceSlaKey(processCode: string, craftCode?: string): string {
  return getProcessCraftKey(processCode, craftCode)
}

function normalizeCraftCode(craftCode?: string): string {
  return craftCode || '默认工艺'
}

function normalizeCraftName(craftName?: string): string {
  return craftName || '默认工艺'
}

function isAllCraftsConfig(craftCode?: string): boolean {
  return craftCode === DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE
}

function nowTimestamp(): string {
  const date = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-')
    + ' '
    + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join(':')
}

function slugifyCode(value: string): string {
  return value.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toUpperCase() || 'RULE'
}

function cloneDispatchAcceptanceSlaConfig(config: DispatchAcceptanceSlaConfig): DispatchAcceptanceSlaConfig {
  return {
    ...config,
    factoryOverrides: config.factoryOverrides.map((override) => ({ ...override })),
  }
}

function cloneDispatchAcceptanceSlaFactoryOverrideLog(
  log: DispatchAcceptanceSlaFactoryOverrideLog,
): DispatchAcceptanceSlaFactoryOverrideLog {
  return { ...log }
}

function isAllFactoriesOverride(factoryId: string): boolean {
  return factoryId === DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_ID
}

function formatFactoryTierName(factoryTier?: FactoryTier): string {
  return factoryTier ? factoryTierConfig[factoryTier]?.label || factoryTier : ''
}

function formatFactoryTypeName(factoryType?: FactoryType): string {
  return factoryType ? factoryTypeConfig[factoryType]?.label || factoryType : ''
}

function resolveOverrideScopeType(
  override: Pick<DispatchAcceptanceSlaFactoryOverride, 'scopeType' | 'factoryId' | 'factoryType' | 'factoryTier'>,
): DispatchAcceptanceSlaFactoryOverrideScopeType {
  if (override.scopeType) return override.scopeType
  if (isAllFactoriesOverride(override.factoryId)) return 'ALL_FACTORIES'
  if (override.factoryType) return 'FACTORY_TYPE'
  if (override.factoryTier) return 'FACTORY_TIER'
  return 'FACTORY'
}

function getOverrideScopeKey(
  override: Pick<DispatchAcceptanceSlaFactoryOverride, 'scopeType' | 'factoryId' | 'factoryType' | 'factoryTier'>,
): string {
  const scopeType = resolveOverrideScopeType(override)
  if (scopeType === 'ALL_FACTORIES') return 'ALL_FACTORIES'
  if (scopeType === 'FACTORY_TIER') return `FACTORY_TIER::${override.factoryTier || 'UNKNOWN'}`
  if (scopeType === 'FACTORY_TYPE') return `FACTORY_TYPE::${override.factoryTier || 'ALL'}::${override.factoryType || 'UNKNOWN'}`
  return `FACTORY::${override.factoryId}`
}

function getOverrideScopeLabel(
  override: Pick<
    DispatchAcceptanceSlaFactoryOverride,
    'scopeType' | 'factoryId' | 'factoryName' | 'factoryTier' | 'factoryTierName' | 'factoryType' | 'factoryTypeName'
  >,
): string {
  const scopeType = resolveOverrideScopeType(override)
  if (scopeType === 'ALL_FACTORIES') return '全部工厂'
  const tierName = override.factoryTierName || formatFactoryTierName(override.factoryTier)
  const typeName = override.factoryTypeName || formatFactoryTypeName(override.factoryType)
  if (scopeType === 'FACTORY_TIER') return [tierName, DISPATCH_ACCEPTANCE_SLA_ALL_TYPES_NAME, '全部工厂'].filter(Boolean).join(' / ')
  if (scopeType === 'FACTORY_TYPE') return [tierName, typeName, '全部工厂'].filter(Boolean).join(' / ')
  return [tierName, typeName, override.factoryName].filter(Boolean).join(' / ') || override.factoryName
}

function isBroadOverride(override: DispatchAcceptanceSlaFactoryOverride): boolean {
  return resolveOverrideScopeType(override) !== 'FACTORY'
}

function findLatestOverrideByScope(
  overrides: DispatchAcceptanceSlaFactoryOverride[],
  target: Pick<DispatchAcceptanceSlaFactoryOverride, 'scopeType' | 'factoryId' | 'factoryType' | 'factoryTier'>,
): DispatchAcceptanceSlaFactoryOverride | undefined {
  const targetKey = getOverrideScopeKey(target)
  for (let index = overrides.length - 1; index >= 0; index -= 1) {
    if (getOverrideScopeKey(overrides[index]) === targetKey) return overrides[index]
  }
  return undefined
}

function findEffectiveOverrideForFactory(
  overrides: DispatchAcceptanceSlaFactoryOverride[],
  factoryId?: string,
): DispatchAcceptanceSlaFactoryOverride | undefined {
  if (!factoryId) return undefined
  const factory = listBusinessFactoryMasterRecords({ includeTestFactories: true })
    .find((item) => item.id === factoryId || item.code === factoryId)
  const latestSpecific = findLatestOverrideByScope(overrides, { scopeType: 'FACTORY', factoryId })
  const protectSpecific = latestSpecific?.enabled && latestSpecific.protectFromBroadOverrides
  for (let index = overrides.length - 1; index >= 0; index -= 1) {
    const override = overrides[index]
    const scopeType = resolveOverrideScopeType(override)
    const matchesFactory =
      (scopeType === 'FACTORY' && override.factoryId === factoryId)
      || (scopeType === 'ALL_FACTORIES')
      || (scopeType === 'FACTORY_TIER' && factory?.factoryTier === override.factoryTier)
      || (scopeType === 'FACTORY_TYPE' && factory?.factoryType === override.factoryType)
    if (matchesFactory && protectSpecific && isBroadOverride(override)) continue
    if (matchesFactory) return override.enabled ? override : undefined
  }
  return undefined
}

function addHours(base: string, hours: number): string {
  const normalized = base.includes('T') ? base : base.replace(' ', 'T')
  const date = new Date(normalized)
  if (Number.isNaN(date.getTime())) return base
  date.setMinutes(date.getMinutes() + hours * 60)
  const pad = (value: number) => String(value).padStart(2, '0')
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-')
    + ' '
    + [
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds()),
    ].join(':')
}

const presetConfigs: DispatchAcceptanceSlaConfig[] = [
  {
    configId: 'DAS-PRINT-SCREEN',
    processCode: 'PRINT',
    processName: '印花',
    craftCode: 'CRAFT_2000001',
    craftName: '丝网印',
    enabled: true,
    defaultAcceptTimeoutHours: 4,
    updatedBy: '生产计划主管',
    updatedAt: '2026-06-09 09:20:00',
    remark: '印花需求单派出后，常规工厂需在半天内确认接单。',
    factoryOverrides: [
      {
        overrideId: 'DAS-PRINT-SCREEN-FULL',
        factoryId: 'F090',
        factoryName: '全能力测试工厂',
        acceptTimeoutHours: 0,
        enabled: true,
        updatedBy: '生产计划主管',
        updatedAt: '2026-06-09 09:30:00',
        remark: '联调工厂默认派单即接单。',
      },
    ],
  },
  {
    configId: 'DAS-SEW-BASIC',
    processCode: 'SEW',
    processName: '车缝',
    craftCode: 'CRAFT_262145',
    craftName: '基础连接',
    enabled: true,
    defaultAcceptTimeoutHours: 6,
    updatedBy: '车缝计划员',
    updatedAt: '2026-06-09 10:10:00',
    remark: '车缝主线任务要求当天确认接单。',
    factoryOverrides: [
      {
        overrideId: 'DAS-SEW-BASIC-F001',
        factoryId: 'ID-F001',
        factoryName: '雅加达中央工厂',
        acceptTimeoutHours: 2,
        enabled: true,
        updatedBy: '车缝计划员',
        updatedAt: '2026-06-09 10:12:00',
        remark: '中央工厂已接入固定排产值班，要求 2 小时内确认。',
      },
    ],
  },
  {
    configId: 'DAS-CUT-POSITION',
    processCode: 'CUT_PANEL',
    processName: '裁片',
    craftCode: 'CRAFT_000001',
    craftName: '定位裁',
    enabled: true,
    defaultAcceptTimeoutHours: 3,
    updatedBy: '裁床计划员',
    updatedAt: '2026-06-09 11:00:00',
    remark: '定位裁需尽快确认，避免影响唛架和铺布计划。',
    factoryOverrides: [],
  },
  {
    configId: 'DAS-EMBROIDERY',
    processCode: 'EMBROIDERY',
    processName: '绣花',
    craftCode: 'CRAFT_000002',
    craftName: '绣花',
    enabled: true,
    defaultAcceptTimeoutHours: 8,
    updatedBy: '工艺计划员',
    updatedAt: '2026-06-09 11:30:00',
    remark: '绣花外协需要确认机台排期，允许一个工作日内确认。',
    factoryOverrides: [
      {
        overrideId: 'DAS-EMBROIDERY-PAUSED',
        factoryId: 'ID-F018',
        factoryName: '泗水绣花厂',
        acceptTimeoutHours: 1,
        enabled: false,
        updatedBy: '工艺计划员',
        updatedAt: '2026-06-09 11:40:00',
        remark: '停用示例：停用后应回退工序工艺默认 8 小时。',
      },
    ],
  },
]

const globalDefaultConfig: DispatchAcceptanceSlaGlobalDefaultConfig = {
  configId: 'DAS-GLOBAL-DEFAULT',
  enabled: true,
  defaultAcceptTimeoutHours: 12,
  updatedBy: '生产计划主管',
  updatedAt: '2026-06-09 09:00:00',
  remark: '未命中工厂覆盖和工序工艺自定义规则时，统一按全局默认接单时效执行。',
}

const factoryOverrideLogs: DispatchAcceptanceSlaFactoryOverrideLog[] = presetConfigs.flatMap((config) =>
  config.factoryOverrides.map((override, index) => ({
    logId: `LOG-${override.overrideId}-${index + 1}`,
    configId: config.configId,
    processCode: config.processCode,
    processName: config.processName,
    craftCode: config.craftCode,
    craftName: config.craftName,
    factoryId: override.factoryId,
    factoryName: override.factoryName,
    scopeLabel: getOverrideScopeLabel(override),
    previousAcceptTimeoutHours: null,
    nextAcceptTimeoutHours: override.acceptTimeoutHours,
    previousEnabled: null,
    nextEnabled: override.enabled,
    action: '预置覆盖',
    updatedBy: override.updatedBy,
    updatedAt: override.updatedAt,
    remark: override.remark,
  })),
)

export function listDispatchAcceptanceSlaConfigs(): DispatchAcceptanceSlaConfig[] {
  return presetConfigs.map(cloneDispatchAcceptanceSlaConfig)
}

export function getDispatchAcceptanceSlaGlobalDefaultConfig(): DispatchAcceptanceSlaGlobalDefaultConfig {
  return { ...globalDefaultConfig }
}

export function saveDispatchAcceptanceSlaGlobalDefaultConfig(
  input: DispatchAcceptanceSlaGlobalDefaultSaveInput,
): DispatchAcceptanceSlaGlobalDefaultConfig {
  globalDefaultConfig.enabled = input.enabled
  globalDefaultConfig.defaultAcceptTimeoutHours = input.defaultAcceptTimeoutHours
  globalDefaultConfig.updatedBy = input.updatedBy || '当前用户'
  globalDefaultConfig.updatedAt = input.updatedAt || nowTimestamp()
  globalDefaultConfig.remark = input.remark?.trim() || undefined
  return getDispatchAcceptanceSlaGlobalDefaultConfig()
}

export function getDispatchAcceptanceSlaConfigById(configId: string): DispatchAcceptanceSlaConfig | undefined {
  const config = presetConfigs.find((item) => item.configId === configId)
  return config ? cloneDispatchAcceptanceSlaConfig(config) : undefined
}

export function listDispatchAcceptanceSlaEffectiveFactoryOverrides(
  config: DispatchAcceptanceSlaConfig,
): DispatchAcceptanceSlaFactoryOverride[] {
  const latestByScope = new Map<string, DispatchAcceptanceSlaFactoryOverride>()
  config.factoryOverrides.forEach((override) => {
    latestByScope.set(getOverrideScopeKey(override), { ...override })
  })
  return Array.from(latestByScope.values())
}

export function listDispatchAcceptanceSlaFactoryOverrideLogs(
  configId?: string,
): DispatchAcceptanceSlaFactoryOverrideLog[] {
  return factoryOverrideLogs
    .filter((log) => !configId || log.configId === configId)
    .map(cloneDispatchAcceptanceSlaFactoryOverrideLog)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function listDispatchAcceptanceSlaCreateOptions(): DispatchAcceptanceSlaCreateOption[] {
  const configuredKeys = new Set(
    presetConfigs
      .filter((item) => item.enabled)
      .map((item) => getProcessCraftKey(item.processCode, item.craftCode)),
  )
  const externalRows = listProcessCraftDictRows()
    .filter((row) => row.generatesExternalTask)
  const processOptions = Array.from(
    new Map(externalRows.map((row) => [row.processCode, row.processName])).entries(),
  )
    .filter(([processCode]) => !configuredKeys.has(getProcessCraftKey(processCode, DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE)))
    .map(([processCode, processName]) => ({
      processCode,
      processName,
      craftCode: DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE,
      craftName: DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME,
      processCraftKey: getProcessCraftKey(processCode, DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE),
      processCraftLabel: `${processName} / ${DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME}`,
      coversAllCrafts: true,
    }))
  const craftOptions = externalRows
    .filter((row) => !configuredKeys.has(getProcessCraftKey(row.processCode, row.craftCode)))
    .map((row) => ({
      processCode: row.processCode,
      processName: row.processName,
      craftCode: row.craftCode,
      craftName: row.craftName,
      processCraftKey: getProcessCraftKey(row.processCode, row.craftCode),
      processCraftLabel: `${row.processName} / ${row.craftName}`,
      coversAllCrafts: false,
    }))
  return [...processOptions, ...craftOptions]
}

export function saveDispatchAcceptanceSlaConfig(
  input: DispatchAcceptanceSlaConfigSaveInput,
): DispatchAcceptanceSlaConfig {
  const processCode = input.processCode
  const craftCode = normalizeCraftCode(input.craftCode)
  const existingIndex = presetConfigs.findIndex(
    (item) => item.processCode === processCode && item.craftCode === craftCode,
  )
  const existing = existingIndex >= 0 ? presetConfigs[existingIndex] : null
  const nextConfig: DispatchAcceptanceSlaConfig = {
    configId: existing?.configId ?? `DAS-${slugifyCode(processCode)}-${slugifyCode(craftCode)}-${presetConfigs.length + 1}`,
    processCode,
    processName: input.processName,
    craftCode,
    craftName: normalizeCraftName(input.craftName),
    enabled: input.enabled,
    defaultAcceptTimeoutHours: input.defaultAcceptTimeoutHours,
    updatedBy: input.updatedBy || '当前用户',
    updatedAt: input.updatedAt || nowTimestamp(),
    remark: input.remark?.trim() || undefined,
    factoryOverrides: existing?.factoryOverrides.map((override) => ({ ...override })) ?? [],
  }

  if (existingIndex >= 0) {
    presetConfigs.splice(existingIndex, 1, nextConfig)
  } else {
    presetConfigs.push(nextConfig)
  }

  return cloneDispatchAcceptanceSlaConfig(nextConfig)
}

export function saveDispatchAcceptanceSlaFactoryOverride(
  configId: string,
  input: DispatchAcceptanceSlaFactoryOverrideSaveInput,
): DispatchAcceptanceSlaConfig | null {
  const config = presetConfigs.find((item) => item.configId === configId)
  if (!config) return null
  const scopeType = input.scopeType ?? (isAllFactoriesOverride(input.factoryId) ? 'ALL_FACTORIES' : 'FACTORY')
  const previous = findLatestOverrideByScope(config.factoryOverrides, {
    scopeType,
    factoryId: input.factoryId,
    factoryTier: input.factoryTier,
    factoryType: input.factoryType,
  })
  const nextOverride: DispatchAcceptanceSlaFactoryOverride = {
    overrideId: `${config.configId}-${slugifyCode(input.factoryId)}-${config.factoryOverrides.length + 1}`,
    scopeType,
    factoryTier: input.factoryTier,
    factoryTierName: input.factoryTierName || formatFactoryTierName(input.factoryTier),
    factoryType: input.factoryType,
    factoryTypeName: input.factoryTypeName || formatFactoryTypeName(input.factoryType),
    factoryId: input.factoryId,
    factoryName: input.factoryName,
    protectFromBroadOverrides: scopeType === 'FACTORY' ? input.protectFromBroadOverrides === true : false,
    acceptTimeoutHours: input.acceptTimeoutHours,
    enabled: input.enabled,
    updatedBy: input.updatedBy || '当前用户',
    updatedAt: input.updatedAt || nowTimestamp(),
    remark: input.remark?.trim() || undefined,
  }

  config.factoryOverrides.push(nextOverride)
  config.updatedBy = nextOverride.updatedBy
  config.updatedAt = nextOverride.updatedAt
  factoryOverrideLogs.push({
    logId: `LOG-${nextOverride.overrideId}`,
    configId: config.configId,
    processCode: config.processCode,
    processName: config.processName,
    craftCode: config.craftCode,
    craftName: config.craftName,
    factoryId: nextOverride.factoryId,
    factoryName: nextOverride.factoryName,
    scopeLabel: getOverrideScopeLabel(nextOverride),
    previousAcceptTimeoutHours: previous?.acceptTimeoutHours ?? null,
    nextAcceptTimeoutHours: nextOverride.acceptTimeoutHours,
    previousEnabled: previous?.enabled ?? null,
    nextEnabled: nextOverride.enabled,
    action: previous ? '覆盖更新' : '新增覆盖',
    updatedBy: nextOverride.updatedBy,
    updatedAt: nextOverride.updatedAt,
    remark: nextOverride.remark,
  })

  return cloneDispatchAcceptanceSlaConfig(config)
}

export function getFactoryAbilityForDispatchAcceptance(
  processCode: string,
  craftCode?: string,
): Array<{
  id: string
  name: string
  factoryTier: FactoryTier
  factoryTierName: string
  factoryType: FactoryType
  factoryTypeName: string
}> {
  const factories = listBusinessFactoryMasterRecords({ includeTestFactories: true })
  return factories
    .filter((factory) =>
      factory.status === 'active'
      && factory.eligibility.allowDispatch
      && factory.processAbilities.some((ability) => {
        if (ability.processCode !== processCode) return false
        if (ability.canReceiveTask === false || ability.status === 'DISABLED' || ability.status === 'PAUSED') return false
        if (!craftCode || craftCode === '默认工艺' || isAllCraftsConfig(craftCode)) return true
        return ability.craftCodes.length === 0 || ability.craftCodes.includes(craftCode)
      }),
    )
    .map((factory) => ({
      id: factory.id,
      name: factory.name,
      factoryTier: factory.factoryTier,
      factoryTierName: formatFactoryTierName(factory.factoryTier),
      factoryType: factory.factoryType,
      factoryTypeName: formatFactoryTypeName(factory.factoryType),
    }))
}

export function resolveDispatchAcceptanceSlaForTask(
  task: DispatchAcceptanceSlaTaskInput,
  factoryId?: string,
  factoryName?: string,
  dispatchedAt?: string,
): DispatchAcceptanceSlaResolution {
  const processCode = task.processBusinessCode || task.processCode
  const processName = task.processBusinessName || task.processNameZh || processCode
  const craftCode = normalizeCraftCode(task.craftCode)
  const craftName = normalizeCraftName(task.craftName)
  const exactConfig = presetConfigs.find(
    (item) => item.enabled && item.processCode === processCode && item.craftCode === craftCode,
  )
  const config = exactConfig ?? presetConfigs.find(
    (item) => item.enabled && item.processCode === processCode && isAllCraftsConfig(item.craftCode),
  )

  if (!config && !globalDefaultConfig.enabled) {
    return {
      ruleSource: 'UNCONFIGURED',
      processCode,
      processName,
      craftCode,
      craftName,
      factoryId,
      factoryName,
      acceptTimeoutHours: null,
      enabled: false,
      autoAccept: false,
      missingReason: `${processName} / ${craftName} 未配置接单时效`,
    }
  }

  if (!config) {
    const resolution: DispatchAcceptanceSlaResolution = {
      ruleSource: 'GLOBAL_DEFAULT',
      configId: globalDefaultConfig.configId,
      processCode,
      processName,
      craftCode,
      craftName,
      factoryId,
      factoryName,
      acceptTimeoutHours: globalDefaultConfig.defaultAcceptTimeoutHours,
      enabled: true,
      autoAccept: globalDefaultConfig.defaultAcceptTimeoutHours === 0,
    }
    return dispatchedAt ? { ...resolution, acceptDeadline: buildDispatchAcceptanceDeadline(dispatchedAt, resolution) } : resolution
  }

  const override = findEffectiveOverrideForFactory(config.factoryOverrides, factoryId)
  const acceptTimeoutHours = override?.acceptTimeoutHours ?? config.defaultAcceptTimeoutHours
  const resolution: DispatchAcceptanceSlaResolution = {
    ruleSource: override ? 'FACTORY_OVERRIDE' : 'PROCESS_CRAFT_DEFAULT',
    configId: config.configId,
    overrideId: override?.overrideId,
    processCode: config.processCode,
    processName: config.processName,
    craftCode: config.craftCode,
    craftName: config.craftName,
    factoryId,
    factoryName,
    acceptTimeoutHours,
    enabled: true,
    autoAccept: acceptTimeoutHours === 0,
  }
  return dispatchedAt ? { ...resolution, acceptDeadline: buildDispatchAcceptanceDeadline(dispatchedAt, resolution) } : resolution
}

export function buildDispatchAcceptanceDeadline(
  dispatchedAt: string,
  resolution: Pick<DispatchAcceptanceSlaResolution, 'acceptTimeoutHours'>,
): string {
  if (resolution.acceptTimeoutHours == null) return ''
  if (resolution.acceptTimeoutHours <= 0) return dispatchedAt
  return addHours(dispatchedAt, resolution.acceptTimeoutHours)
}

export function getDispatchAcceptanceSlaRuleSourceLabel(source: DispatchAcceptanceSlaRuleSource): string {
  if (source === 'FACTORY_OVERRIDE') return '工厂覆盖'
  if (source === 'PROCESS_CRAFT_DEFAULT') return '工序工艺默认'
  if (source === 'GLOBAL_DEFAULT') return '全局默认'
  return '未配置'
}

export function formatDispatchAcceptanceTimeout(hours: number | null): string {
  if (hours == null) return '未配置'
  if (hours === 0) return '派单后自动接单'
  return `${hours} 小时`
}

export function describeDispatchAcceptanceSlaResolution(resolution: DispatchAcceptanceSlaResolution): string {
  if (resolution.ruleSource === 'UNCONFIGURED') return resolution.missingReason || '未配置接单时效'
  const sourceLabel = getDispatchAcceptanceSlaRuleSourceLabel(resolution.ruleSource)
  const timeoutText = formatDispatchAcceptanceTimeout(resolution.acceptTimeoutHours)
  const factoryText = resolution.factoryName ? `，工厂：${resolution.factoryName}` : ''
  return `${sourceLabel}：${resolution.processName} / ${resolution.craftName}${factoryText}，接单时效 ${timeoutText}`
}

export function listDispatchAcceptanceSlaPageRows(): Array<DispatchAcceptanceSlaConfig & {
  abilityFactoryCount: number
  activeOverrideCount: number
  autoAcceptOverrideCount: number
}> {
  return listDispatchAcceptanceSlaConfigs().map((config) => {
    const effectiveOverrides = listDispatchAcceptanceSlaEffectiveFactoryOverrides(config)
    return {
      ...config,
      abilityFactoryCount: getFactoryAbilityForDispatchAcceptance(config.processCode, config.craftCode).length,
      activeOverrideCount: effectiveOverrides.filter((item) => item.enabled).length,
      autoAcceptOverrideCount: effectiveOverrides.filter((item) => item.enabled && item.acceptTimeoutHours === 0).length,
    }
  })
}

export function listDispatchAcceptanceSlaMissingProcessCraftRows(): Array<{
  processCode: string
  processName: string
  craftCode: string
  craftName: string
}> {
  const configuredKeys = new Set(presetConfigs.filter((item) => item.enabled).map((item) => getProcessCraftKey(item.processCode, item.craftCode)))
  const configuredAllCraftProcesses = new Set(
    presetConfigs
      .filter((item) => item.enabled && isAllCraftsConfig(item.craftCode))
      .map((item) => item.processCode),
  )
  return listProcessCraftDictRows()
    .filter((row) => row.generatesExternalTask)
    .filter((row) => !configuredAllCraftProcesses.has(row.processCode))
    .filter((row) => !configuredKeys.has(getProcessCraftKey(row.processCode, row.craftCode)))
    .slice(0, 8)
    .map((row) => ({
      processCode: row.processCode,
      processName: row.processName,
      craftCode: row.craftCode,
      craftName: row.craftName,
    }))
}
