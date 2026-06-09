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
  ruleId?: string
  ruleName?: string
  ruleScopeLabel?: string
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

export interface DispatchAcceptanceSlaUnconfiguredFactoryRow {
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  factoryId: string
  factoryName: string
  factoryTier: FactoryTier
  factoryTierName: string
  factoryType: FactoryType
  factoryTypeName: string
  fallbackAcceptTimeoutHours: number
  fallbackAcceptTimeoutText: string
}

export type DispatchAcceptanceSlaProcessScopeType =
  | 'ALL_PROCESS_CRAFTS'
  | 'PROCESS_ALL_CRAFTS'
  | 'PROCESS_CRAFT'

export type DispatchAcceptanceSlaFactoryScopeRuleType =
  | 'ALL_FACTORIES'
  | 'FACTORY_TIER'
  | 'FACTORY_TYPE'
  | 'FACTORIES'

export interface DispatchAcceptanceSlaRule {
  ruleId: string
  ruleName: string
  processScopeType: DispatchAcceptanceSlaProcessScopeType
  processCode?: string
  processName?: string
  craftCode?: string
  craftName?: string
  factoryScopeType: DispatchAcceptanceSlaFactoryScopeRuleType
  factoryTier?: FactoryTier
  factoryTierName?: string
  factoryType?: FactoryType
  factoryTypeName?: string
  factoryIds?: string[]
  factoryNames?: string[]
  acceptTimeoutHours: number
  enabled: boolean
  updatedBy: string
  updatedAt: string
  remark?: string
  sourceConfigId?: string
  sourceOverrideId?: string
  sequence: number
}

export interface DispatchAcceptanceSlaRuleSaveInput {
  ruleName?: string
  processScopeType: DispatchAcceptanceSlaProcessScopeType
  processCode?: string
  processName?: string
  craftCode?: string
  craftName?: string
  factoryScopeType: DispatchAcceptanceSlaFactoryScopeRuleType
  factoryTier?: FactoryTier
  factoryTierName?: string
  factoryType?: FactoryType
  factoryTypeName?: string
  factoryIds?: string[]
  factoryNames?: string[]
  acceptTimeoutHours: number
  enabled: boolean
  updatedBy?: string
  updatedAt?: string
  remark?: string
}

export interface DispatchAcceptanceSlaRuleImpact {
  matchedFactoryCount: number
  matchedAbilityCount: number
  effectiveAbilityCount: number
  overriddenAbilityCount: number
  protectedAbilityCount: number
}

export interface DispatchAcceptanceSlaFactoryAbilityEffectiveRow {
  factoryId: string
  factoryName: string
  factoryTier: FactoryTier
  factoryTierName: string
  factoryType: FactoryType
  factoryTypeName: string
  processCode: string
  processName: string
  craftCode: string
  craftName: string
  acceptTimeoutHours: number | null
  acceptTimeoutText: string
  autoAccept: boolean
  ruleSource: DispatchAcceptanceSlaRuleSource
  ruleSourceLabel: string
  ruleId?: string
  ruleName?: string
  ruleScopeLabel?: string
  isUnconfigured: boolean
  isFactorySpecific: boolean
}

export interface DispatchAcceptanceSlaFactoryPageRow {
  factoryId: string
  factoryName: string
  factoryTier: FactoryTier
  factoryTierName: string
  factoryType: FactoryType
  factoryTypeName: string
  abilityRows: DispatchAcceptanceSlaFactoryAbilityEffectiveRow[]
  abilityCount: number
  autoAcceptCount: number
  unconfiguredCount: number
  factorySpecificRuleCount: number
  timeoutSummary: Array<{ label: string; count: number }>
  sourceSummary: Array<{ label: string; count: number }>
  lastChangedAt: string
  lastChangedBy: string
}

export interface DispatchAcceptanceSlaFactoryLog {
  logId: string
  factoryId: string
  factoryName: string
  updatedAt: string
  updatedBy: string
  action: string
  processCraftLabel: string
  beforeTimeoutText?: string
  afterTimeoutText: string
  ruleName: string
  ruleScopeLabel: string
  effective: boolean
  reason: string
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

let customRuleSequence = 1000
const customDispatchAcceptanceSlaRules: DispatchAcceptanceSlaRule[] = []
const ruleLogs: Array<{
  logId: string
  ruleId: string
  ruleName: string
  action: string
  updatedAt: string
  updatedBy: string
  scopeLabel: string
  impact: DispatchAcceptanceSlaRuleImpact
}> = []
const factoryEffectLogs: DispatchAcceptanceSlaFactoryLog[] = []

function getRuleProcessScopeLabel(rule: Pick<
  DispatchAcceptanceSlaRule,
  'processScopeType' | 'processName' | 'processCode' | 'craftName' | 'craftCode'
>): string {
  if (rule.processScopeType === 'ALL_PROCESS_CRAFTS') return '全部工序工艺'
  if (rule.processScopeType === 'PROCESS_ALL_CRAFTS') return `${rule.processName || rule.processCode || '未选择工序'} / ${DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME}`
  return `${rule.processName || rule.processCode || '未选择工序'} / ${rule.craftName || rule.craftCode || '未选择工艺'}`
}

function getRuleFactoryScopeLabel(rule: Pick<
  DispatchAcceptanceSlaRule,
  'factoryScopeType' | 'factoryTierName' | 'factoryTier' | 'factoryTypeName' | 'factoryType' | 'factoryNames' | 'factoryIds'
>): string {
  if (rule.factoryScopeType === 'ALL_FACTORIES') return DISPATCH_ACCEPTANCE_SLA_ALL_FACTORIES_NAME
  if (rule.factoryScopeType === 'FACTORY_TIER') return rule.factoryTierName || formatFactoryTierName(rule.factoryTier)
  if (rule.factoryScopeType === 'FACTORY_TYPE') return rule.factoryTypeName || formatFactoryTypeName(rule.factoryType)
  const names = rule.factoryNames?.length ? rule.factoryNames : rule.factoryIds
  return names?.length ? names.join('、') : '未选择工厂'
}

function getRuleScopeLabel(rule: DispatchAcceptanceSlaRule): string {
  return `${getRuleProcessScopeLabel(rule)} × ${getRuleFactoryScopeLabel(rule)}`
}

function buildRuleName(rule: Pick<
  DispatchAcceptanceSlaRuleSaveInput,
  'ruleName' | 'processScopeType' | 'processName' | 'processCode' | 'craftName' | 'craftCode' | 'factoryScopeType' | 'factoryTierName' | 'factoryTier' | 'factoryTypeName' | 'factoryType' | 'factoryNames' | 'factoryIds'
>): string {
  if (rule.ruleName?.trim()) return rule.ruleName.trim()
  return `${getRuleProcessScopeLabel(rule)} - ${getRuleFactoryScopeLabel(rule)}`
}

function mapOverrideScopeToRuleScope(override: DispatchAcceptanceSlaFactoryOverride): DispatchAcceptanceSlaFactoryScopeRuleType {
  const scopeType = resolveOverrideScopeType(override)
  if (scopeType === 'FACTORY') return 'FACTORIES'
  if (scopeType === 'FACTORY_TIER') return 'FACTORY_TIER'
  if (scopeType === 'FACTORY_TYPE') return 'FACTORY_TYPE'
  return 'ALL_FACTORIES'
}

function buildRulesFromPresetConfigs(): DispatchAcceptanceSlaRule[] {
  const rules: DispatchAcceptanceSlaRule[] = []
  presetConfigs.forEach((config, configIndex) => {
    rules.push({
      ruleId: config.configId,
      ruleName: `${config.processName} / ${config.craftName} 默认规则`,
      processScopeType: isAllCraftsConfig(config.craftCode) ? 'PROCESS_ALL_CRAFTS' : 'PROCESS_CRAFT',
      processCode: config.processCode,
      processName: config.processName,
      craftCode: isAllCraftsConfig(config.craftCode) ? undefined : config.craftCode,
      craftName: isAllCraftsConfig(config.craftCode) ? DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME : config.craftName,
      factoryScopeType: 'ALL_FACTORIES',
      acceptTimeoutHours: config.defaultAcceptTimeoutHours,
      enabled: config.enabled,
      updatedBy: config.updatedBy,
      updatedAt: config.updatedAt,
      remark: config.remark,
      sourceConfigId: config.configId,
      sequence: configIndex + 1,
    })
    config.factoryOverrides.forEach((override, overrideIndex) => {
      const factoryScopeType = mapOverrideScopeToRuleScope(override)
      rules.push({
        ruleId: override.overrideId,
        ruleName: `${config.processName} / ${config.craftName} - ${override.factoryName}`,
        processScopeType: isAllCraftsConfig(config.craftCode) ? 'PROCESS_ALL_CRAFTS' : 'PROCESS_CRAFT',
        processCode: config.processCode,
        processName: config.processName,
        craftCode: isAllCraftsConfig(config.craftCode) ? undefined : config.craftCode,
        craftName: isAllCraftsConfig(config.craftCode) ? DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME : config.craftName,
        factoryScopeType,
        factoryTier: override.factoryTier,
        factoryTierName: override.factoryTierName,
        factoryType: override.factoryType,
        factoryTypeName: override.factoryTypeName,
        factoryIds: factoryScopeType === 'FACTORIES' ? [override.factoryId] : undefined,
        factoryNames: factoryScopeType === 'FACTORIES' ? [override.factoryName] : undefined,
        acceptTimeoutHours: override.acceptTimeoutHours,
        enabled: override.enabled,
        updatedBy: override.updatedBy,
        updatedAt: override.updatedAt,
        remark: override.remark,
        sourceConfigId: config.configId,
        sourceOverrideId: override.overrideId,
        sequence: 100 + configIndex * 10 + overrideIndex,
      })
    })
  })
  return rules
}

export function listDispatchAcceptanceSlaRules(): DispatchAcceptanceSlaRule[] {
  return [...buildRulesFromPresetConfigs(), ...customDispatchAcceptanceSlaRules]
    .map((rule) => ({
      ...rule,
      factoryIds: rule.factoryIds ? [...rule.factoryIds] : undefined,
      factoryNames: rule.factoryNames ? [...rule.factoryNames] : undefined,
    }))
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || right.sequence - left.sequence)
}

function listExternalDispatchProcessCraftRows(): Array<{
  processCode: string
  processName: string
  craftCode: string
  craftName: string
}> {
  return listProcessCraftDictRows()
    .filter((row) => row.generatesExternalTask)
    .map((row) => ({
      processCode: row.processCode,
      processName: row.processName,
      craftCode: row.craftCode,
      craftName: row.craftName,
    }))
}

function ruleMatchesProcessCraft(
  rule: DispatchAcceptanceSlaRule,
  processCode: string,
  craftCode: string,
): boolean {
  if (rule.processScopeType === 'ALL_PROCESS_CRAFTS') return true
  if (rule.processCode !== processCode) return false
  if (rule.processScopeType === 'PROCESS_ALL_CRAFTS') return true
  return rule.craftCode === craftCode
}

function ruleMatchesFactory(
  rule: DispatchAcceptanceSlaRule,
  factory?: { id: string; code?: string; factoryTier: FactoryTier; factoryType: FactoryType },
  factoryId?: string,
): boolean {
  if (rule.factoryScopeType === 'ALL_FACTORIES') return true
  if (!factory && !factoryId) return false
  if (rule.factoryScopeType === 'FACTORY_TIER') return Boolean(factory && factory.factoryTier === rule.factoryTier)
  if (rule.factoryScopeType === 'FACTORY_TYPE') return Boolean(factory && factory.factoryType === rule.factoryType)
  return Boolean(rule.factoryIds?.some((id) => id === factoryId || id === factory?.id || id === factory?.code))
}

function getRulePriority(rule: DispatchAcceptanceSlaRule): number {
  const processWeight = rule.processScopeType === 'PROCESS_CRAFT'
    ? 30
    : rule.processScopeType === 'PROCESS_ALL_CRAFTS'
      ? 20
      : 10
  const factoryWeight = rule.factoryScopeType === 'FACTORIES'
    ? 300
    : rule.factoryScopeType === 'FACTORY_TIER' || rule.factoryScopeType === 'FACTORY_TYPE'
      ? 200
      : 100
  return factoryWeight + processWeight
}

function findFactoryById(factoryId?: string) {
  if (!factoryId) return undefined
  return listBusinessFactoryMasterRecords({ includeTestFactories: true })
    .find((factory) => factory.id === factoryId || factory.code === factoryId)
}

function findEffectiveRuleForContext(
  processCode: string,
  craftCode: string,
  factoryId?: string,
  rules = listDispatchAcceptanceSlaRules(),
): DispatchAcceptanceSlaRule | undefined {
  const factory = findFactoryById(factoryId)
  return rules
    .filter((rule) => rule.enabled)
    .filter((rule) => ruleMatchesProcessCraft(rule, processCode, craftCode))
    .filter((rule) => ruleMatchesFactory(rule, factory, factoryId))
    .sort((left, right) =>
      getRulePriority(right) - getRulePriority(left)
      || right.updatedAt.localeCompare(left.updatedAt)
      || right.sequence - left.sequence,
    )[0]
}

function getRuleSource(rule?: DispatchAcceptanceSlaRule): DispatchAcceptanceSlaRuleSource {
  if (!rule) return 'GLOBAL_DEFAULT'
  if (rule.factoryScopeType === 'FACTORIES') return 'FACTORY_OVERRIDE'
  if (rule.factoryScopeType === 'ALL_FACTORIES') return 'PROCESS_CRAFT_DEFAULT'
  return 'FACTORY_OVERRIDE'
}

function resolveFactoryAbilityRows(factoryId: string): DispatchAcceptanceSlaFactoryAbilityEffectiveRow[] {
  const factory = findFactoryById(factoryId)
  if (!factory) return []
  return listExternalDispatchProcessCraftRows()
    .filter((row) =>
      getFactoryAbilityForDispatchAcceptance(row.processCode, row.craftCode)
        .some((abilityFactory) => abilityFactory.id === factory.id || abilityFactory.id === factory.code),
    )
    .map((row) => {
      const rule = findEffectiveRuleForContext(row.processCode, row.craftCode, factory.id)
      const acceptTimeoutHours = rule?.acceptTimeoutHours ?? (globalDefaultConfig.enabled ? globalDefaultConfig.defaultAcceptTimeoutHours : null)
      const ruleSource = getRuleSource(rule)
      return {
        factoryId: factory.id,
        factoryName: factory.name,
        factoryTier: factory.factoryTier,
        factoryTierName: formatFactoryTierName(factory.factoryTier),
        factoryType: factory.factoryType,
        factoryTypeName: formatFactoryTypeName(factory.factoryType),
        processCode: row.processCode,
        processName: row.processName,
        craftCode: row.craftCode,
        craftName: row.craftName,
        acceptTimeoutHours,
        acceptTimeoutText: formatDispatchAcceptanceTimeout(acceptTimeoutHours),
        autoAccept: acceptTimeoutHours === 0,
        ruleSource,
        ruleSourceLabel: rule ? getDispatchAcceptanceSlaRuleSourceLabel(ruleSource) : '全局默认',
        ruleId: rule?.ruleId,
        ruleName: rule?.ruleName || (globalDefaultConfig.enabled ? '全局兜底规则' : undefined),
        ruleScopeLabel: rule ? getRuleScopeLabel(rule) : '全部工序工艺 × 全部工厂',
        isUnconfigured: !rule,
        isFactorySpecific: rule?.factoryScopeType === 'FACTORIES',
      }
    })
}

function summarizeBy<T>(rows: T[], getLabel: (row: T) => string): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>()
  rows.forEach((row) => {
    const label = getLabel(row)
    counts.set(label, (counts.get(label) || 0) + 1)
  })
  return Array.from(counts.entries()).map(([label, count]) => ({ label, count }))
}

export function listDispatchAcceptanceSlaFactoryRows(): DispatchAcceptanceSlaFactoryPageRow[] {
  return listBusinessFactoryMasterRecords({ includeTestFactories: true })
    .map((factory) => {
      const abilityRows = resolveFactoryAbilityRows(factory.id)
      const latestRule = abilityRows
        .map((row) => row.ruleId ? listDispatchAcceptanceSlaRules().find((rule) => rule.ruleId === row.ruleId) : undefined)
        .filter((rule): rule is DispatchAcceptanceSlaRule => Boolean(rule))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]
      return {
        factoryId: factory.id,
        factoryName: factory.name,
        factoryTier: factory.factoryTier,
        factoryTierName: formatFactoryTierName(factory.factoryTier),
        factoryType: factory.factoryType,
        factoryTypeName: formatFactoryTypeName(factory.factoryType),
        abilityRows,
        abilityCount: abilityRows.length,
        autoAcceptCount: abilityRows.filter((row) => row.autoAccept).length,
        unconfiguredCount: abilityRows.filter((row) => row.isUnconfigured).length,
        factorySpecificRuleCount: abilityRows.filter((row) => row.isFactorySpecific).length,
        timeoutSummary: summarizeBy(abilityRows, (row) => row.acceptTimeoutText),
        sourceSummary: summarizeBy(abilityRows, (row) => row.ruleSourceLabel),
        lastChangedAt: latestRule?.updatedAt || globalDefaultConfig.updatedAt,
        lastChangedBy: latestRule?.updatedBy || globalDefaultConfig.updatedBy,
      }
    })
    .filter((row) => row.abilityCount > 0)
    .sort((left, right) =>
      right.unconfiguredCount - left.unconfiguredCount
      || right.factorySpecificRuleCount - left.factorySpecificRuleCount
      || left.factoryName.localeCompare(right.factoryName),
    )
}

export function listDispatchAcceptanceSlaFactoryAbilityRows(factoryId: string): DispatchAcceptanceSlaFactoryAbilityEffectiveRow[] {
  return resolveFactoryAbilityRows(factoryId)
}

function buildRuleFromSaveInput(input: DispatchAcceptanceSlaRuleSaveInput, ruleId: string): DispatchAcceptanceSlaRule {
  const now = input.updatedAt || nowTimestamp()
  return {
    ruleId,
    ruleName: buildRuleName(input),
    processScopeType: input.processScopeType,
    processCode: input.processScopeType === 'ALL_PROCESS_CRAFTS' ? undefined : input.processCode,
    processName: input.processScopeType === 'ALL_PROCESS_CRAFTS' ? undefined : input.processName,
    craftCode: input.processScopeType === 'PROCESS_CRAFT' ? input.craftCode : undefined,
    craftName: input.processScopeType === 'PROCESS_CRAFT' ? input.craftName : input.processScopeType === 'PROCESS_ALL_CRAFTS' ? DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME : undefined,
    factoryScopeType: input.factoryScopeType,
    factoryTier: input.factoryScopeType === 'FACTORY_TIER' ? input.factoryTier : undefined,
    factoryTierName: input.factoryScopeType === 'FACTORY_TIER' ? input.factoryTierName || formatFactoryTierName(input.factoryTier) : undefined,
    factoryType: input.factoryScopeType === 'FACTORY_TYPE' ? input.factoryType : undefined,
    factoryTypeName: input.factoryScopeType === 'FACTORY_TYPE' ? input.factoryTypeName || formatFactoryTypeName(input.factoryType) : undefined,
    factoryIds: input.factoryScopeType === 'FACTORIES' ? [...(input.factoryIds || [])] : undefined,
    factoryNames: input.factoryScopeType === 'FACTORIES' ? [...(input.factoryNames || [])] : undefined,
    acceptTimeoutHours: input.acceptTimeoutHours,
    enabled: input.enabled,
    updatedBy: input.updatedBy || '当前用户',
    updatedAt: now,
    remark: input.remark?.trim() || undefined,
    sequence: ruleId === '__DRAFT_RULE__' ? Number.MAX_SAFE_INTEGER : customRuleSequence++,
  }
}

function buildAllAbilityRowsForImpact(rules = listDispatchAcceptanceSlaRules()): DispatchAcceptanceSlaFactoryAbilityEffectiveRow[] {
  return listBusinessFactoryMasterRecords({ includeTestFactories: true })
    .flatMap((factory) =>
      listExternalDispatchProcessCraftRows()
        .filter((row) =>
          getFactoryAbilityForDispatchAcceptance(row.processCode, row.craftCode)
            .some((abilityFactory) => abilityFactory.id === factory.id || abilityFactory.id === factory.code),
        )
        .map((row) => {
          const rule = findEffectiveRuleForContext(row.processCode, row.craftCode, factory.id, rules)
          const acceptTimeoutHours = rule?.acceptTimeoutHours ?? (globalDefaultConfig.enabled ? globalDefaultConfig.defaultAcceptTimeoutHours : null)
          const ruleSource = getRuleSource(rule)
          return {
            factoryId: factory.id,
            factoryName: factory.name,
            factoryTier: factory.factoryTier,
            factoryTierName: formatFactoryTierName(factory.factoryTier),
            factoryType: factory.factoryType,
            factoryTypeName: formatFactoryTypeName(factory.factoryType),
            processCode: row.processCode,
            processName: row.processName,
            craftCode: row.craftCode,
            craftName: row.craftName,
            acceptTimeoutHours,
            acceptTimeoutText: formatDispatchAcceptanceTimeout(acceptTimeoutHours),
            autoAccept: acceptTimeoutHours === 0,
            ruleSource,
            ruleSourceLabel: rule ? getDispatchAcceptanceSlaRuleSourceLabel(ruleSource) : '全局默认',
            ruleId: rule?.ruleId,
            ruleName: rule?.ruleName || (globalDefaultConfig.enabled ? '全局兜底规则' : undefined),
            ruleScopeLabel: rule ? getRuleScopeLabel(rule) : '全部工序工艺 × 全部工厂',
            isUnconfigured: !rule,
            isFactorySpecific: rule?.factoryScopeType === 'FACTORIES',
          }
        }),
    )
}

export function previewDispatchAcceptanceSlaRuleImpact(input: DispatchAcceptanceSlaRuleSaveInput): DispatchAcceptanceSlaRuleImpact {
  const draftRule = buildRuleFromSaveInput({ ...input, updatedAt: '9999-12-31 23:59:59' }, '__DRAFT_RULE__')
  const beforeRules = listDispatchAcceptanceSlaRules()
  const afterRules = [...beforeRules, draftRule]
  const matchedRows = buildAllAbilityRowsForImpact(beforeRules).filter((row) => {
    const factory = findFactoryById(row.factoryId)
    return ruleMatchesProcessCraft(draftRule, row.processCode, row.craftCode)
      && ruleMatchesFactory(draftRule, factory, row.factoryId)
  })
  const afterRows = buildAllAbilityRowsForImpact(afterRules)
  const byKey = new Map(afterRows.map((row) => [`${row.factoryId}::${row.processCode}::${row.craftCode}`, row]))
  const protectedAbilityCount = matchedRows.filter((row) => {
    const currentRule = row.ruleId ? beforeRules.find((rule) => rule.ruleId === row.ruleId) : undefined
    return Boolean(currentRule && currentRule.factoryScopeType === 'FACTORIES' && getRulePriority(currentRule) > getRulePriority(draftRule))
  }).length
  const effectiveAbilityCount = matchedRows.filter((row) =>
    byKey.get(`${row.factoryId}::${row.processCode}::${row.craftCode}`)?.ruleId === draftRule.ruleId,
  ).length
  const matchedFactoryCount = new Set(matchedRows.map((row) => row.factoryId)).size
  return {
    matchedFactoryCount,
    matchedAbilityCount: matchedRows.length,
    effectiveAbilityCount,
    overriddenAbilityCount: Math.max(0, matchedRows.length - effectiveAbilityCount),
    protectedAbilityCount,
  }
}

export function saveDispatchAcceptanceSlaRule(input: DispatchAcceptanceSlaRuleSaveInput): DispatchAcceptanceSlaRule {
  const impact = previewDispatchAcceptanceSlaRuleImpact(input)
  const beforeRows = buildAllAbilityRowsForImpact()
  const rule = buildRuleFromSaveInput(input, `DAS-RULE-${String(customRuleSequence).padStart(4, '0')}`)
  customDispatchAcceptanceSlaRules.push(rule)
  const afterRows = buildAllAbilityRowsForImpact()
  const beforeByKey = new Map(beforeRows.map((row) => [`${row.factoryId}::${row.processCode}::${row.craftCode}`, row]))
  const afterByKey = new Map(afterRows.map((row) => [`${row.factoryId}::${row.processCode}::${row.craftCode}`, row]))
  ruleLogs.push({
    logId: `RULE-LOG-${ruleLogs.length + 1}`,
    ruleId: rule.ruleId,
    ruleName: rule.ruleName,
    action: '新增规则',
    updatedAt: rule.updatedAt,
    updatedBy: rule.updatedBy,
    scopeLabel: getRuleScopeLabel(rule),
    impact,
  })
  beforeRows
    .filter((row) => {
      const factory = findFactoryById(row.factoryId)
      return ruleMatchesProcessCraft(rule, row.processCode, row.craftCode)
        && ruleMatchesFactory(rule, factory, row.factoryId)
    })
    .forEach((row) => {
      const key = `${row.factoryId}::${row.processCode}::${row.craftCode}`
      const before = beforeByKey.get(key)
      const after = afterByKey.get(key)
      if (!after) return
      const effective = after.ruleId === rule.ruleId
      const reason = effective
        ? '规则已成为该工厂该工序工艺的最终接单时效'
        : after.isFactorySpecific
          ? '未生效：该工厂已有更高优先级的指定工厂规则'
          : '未生效：被更高优先级规则覆盖'
      factoryEffectLogs.push({
        logId: `FACTORY-SLA-LOG-${factoryEffectLogs.length + 1}`,
        factoryId: row.factoryId,
        factoryName: row.factoryName,
        updatedAt: rule.updatedAt,
        updatedBy: rule.updatedBy,
        action: effective ? '规则生效' : '规则未生效',
        processCraftLabel: `${row.processName} / ${row.craftName}`,
        beforeTimeoutText: before?.acceptTimeoutText,
        afterTimeoutText: after.acceptTimeoutText,
        ruleName: rule.ruleName,
        ruleScopeLabel: getRuleScopeLabel(rule),
        effective,
        reason,
      })
    })
  return { ...rule, factoryIds: rule.factoryIds ? [...rule.factoryIds] : undefined, factoryNames: rule.factoryNames ? [...rule.factoryNames] : undefined }
}

export function listDispatchAcceptanceSlaRuleLogs() {
  return ruleLogs.map((log) => ({ ...log, impact: { ...log.impact } })).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

export function listDispatchAcceptanceSlaFactoryLogs(factoryId: string): DispatchAcceptanceSlaFactoryLog[] {
  const logs = factoryEffectLogs.filter((log) => log.factoryId === factoryId)
  if (logs.length) return logs.map((log) => ({ ...log })).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  return resolveFactoryAbilityRows(factoryId).slice(0, 8).map((row, index) => ({
    logId: `FACTORY-SLA-CURRENT-${factoryId}-${index + 1}`,
    factoryId: row.factoryId,
    factoryName: row.factoryName,
    updatedAt: row.ruleId
      ? listDispatchAcceptanceSlaRules().find((rule) => rule.ruleId === row.ruleId)?.updatedAt || globalDefaultConfig.updatedAt
      : globalDefaultConfig.updatedAt,
    updatedBy: row.ruleId
      ? listDispatchAcceptanceSlaRules().find((rule) => rule.ruleId === row.ruleId)?.updatedBy || globalDefaultConfig.updatedBy
      : globalDefaultConfig.updatedBy,
    action: '当前生效',
    processCraftLabel: `${row.processName} / ${row.craftName}`,
    afterTimeoutText: row.acceptTimeoutText,
    ruleName: row.ruleName || '全局兜底规则',
    ruleScopeLabel: row.ruleScopeLabel || '全部工序工艺 × 全部工厂',
    effective: true,
    reason: row.isUnconfigured ? '未命中自定义规则，当前按全局默认执行' : '当前最终生效规则',
  })).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
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
  const beforeRows = buildAllAbilityRowsForImpact()
  globalDefaultConfig.enabled = input.enabled
  globalDefaultConfig.defaultAcceptTimeoutHours = input.defaultAcceptTimeoutHours
  globalDefaultConfig.updatedBy = input.updatedBy || '当前用户'
  globalDefaultConfig.updatedAt = input.updatedAt || nowTimestamp()
  globalDefaultConfig.remark = input.remark?.trim() || undefined
  const afterRows = buildAllAbilityRowsForImpact()
  const afterByKey = new Map(afterRows.map((row) => [`${row.factoryId}::${row.processCode}::${row.craftCode}`, row]))
  beforeRows
    .filter((row) => row.isUnconfigured)
    .forEach((before) => {
      const after = afterByKey.get(`${before.factoryId}::${before.processCode}::${before.craftCode}`)
      if (!after || before.acceptTimeoutText === after.acceptTimeoutText) return
      factoryEffectLogs.push({
        logId: `FACTORY-SLA-LOG-${factoryEffectLogs.length + 1}`,
        factoryId: before.factoryId,
        factoryName: before.factoryName,
        updatedAt: globalDefaultConfig.updatedAt,
        updatedBy: globalDefaultConfig.updatedBy,
        action: '全局兜底变更',
        processCraftLabel: `${before.processName} / ${before.craftName}`,
        beforeTimeoutText: before.acceptTimeoutText,
        afterTimeoutText: after.acceptTimeoutText,
        ruleName: '全局兜底规则',
        ruleScopeLabel: '全部工序工艺 × 全部工厂',
        effective: true,
        reason: '该工厂该工序工艺未命中自定义规则，随全局默认变化',
      })
    })
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

export function listDispatchAcceptanceSlaRuleProcessCraftOptions(): DispatchAcceptanceSlaCreateOption[] {
  const externalRows = listExternalDispatchProcessCraftRows()
  const processOptions = Array.from(
    new Map(externalRows.map((row) => [row.processCode, row.processName])).entries(),
  )
    .map(([processCode, processName]) => ({
      processCode,
      processName,
      craftCode: DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE,
      craftName: DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME,
      processCraftKey: getProcessCraftKey(processCode, DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_CODE),
      processCraftLabel: `${processName} / ${DISPATCH_ACCEPTANCE_SLA_ALL_CRAFTS_NAME}`,
      coversAllCrafts: true,
    }))
  const craftOptions = externalRows.map((row) => ({
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
  const factory = findFactoryById(factoryId)
  const resolvedFactoryName = factoryName || factory?.name
  const rule = findEffectiveRuleForContext(processCode, craftCode, factory?.id || factoryId)

  if (!rule && !globalDefaultConfig.enabled) {
    return {
      ruleSource: 'UNCONFIGURED',
      processCode,
      processName,
      craftCode,
      craftName,
      factoryId,
      factoryName: resolvedFactoryName,
      acceptTimeoutHours: null,
      enabled: false,
      autoAccept: false,
      missingReason: `${processName} / ${craftName} 未配置接单时效`,
    }
  }

  const acceptTimeoutHours = rule?.acceptTimeoutHours ?? globalDefaultConfig.defaultAcceptTimeoutHours
  const ruleSource = getRuleSource(rule)
  const resolution: DispatchAcceptanceSlaResolution = {
    ruleSource,
    configId: rule?.sourceConfigId || (!rule ? globalDefaultConfig.configId : undefined),
    overrideId: rule?.sourceOverrideId,
    ruleId: rule?.ruleId || globalDefaultConfig.configId,
    ruleName: rule?.ruleName || '全局兜底规则',
    ruleScopeLabel: rule ? getRuleScopeLabel(rule) : '全部工序工艺 × 全部工厂',
    processCode,
    processName,
    craftCode,
    craftName,
    factoryId: factory?.id || factoryId,
    factoryName: resolvedFactoryName,
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
  if (source === 'FACTORY_OVERRIDE') return '工厂范围规则'
  if (source === 'PROCESS_CRAFT_DEFAULT') return '工序工艺规则'
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

export function listDispatchAcceptanceSlaMissingProcessCraftRows(input: { limit?: number } = {}): Array<{
  processCode: string
  processName: string
  craftCode: string
  craftName: string
}> {
  const limit = input.limit ?? 8
  const configuredKeys = new Set(presetConfigs.filter((item) => item.enabled).map((item) => getProcessCraftKey(item.processCode, item.craftCode)))
  const configuredAllCraftProcesses = new Set(
    presetConfigs
      .filter((item) => item.enabled && isAllCraftsConfig(item.craftCode))
      .map((item) => item.processCode),
  )
  const rows = listProcessCraftDictRows()
    .filter((row) => row.generatesExternalTask)
    .filter((row) => !configuredAllCraftProcesses.has(row.processCode))
    .filter((row) => !configuredKeys.has(getProcessCraftKey(row.processCode, row.craftCode)))
    .map((row) => ({
      processCode: row.processCode,
      processName: row.processName,
      craftCode: row.craftCode,
      craftName: row.craftName,
    }))
  return limit > 0 ? rows.slice(0, limit) : rows
}

export function listDispatchAcceptanceSlaUnconfiguredFactoryRows(): DispatchAcceptanceSlaUnconfiguredFactoryRow[] {
  return listDispatchAcceptanceSlaFactoryRows()
    .flatMap((factoryRow) => factoryRow.abilityRows.filter((row) => row.isUnconfigured))
    .map((row) => ({
      processCode: row.processCode,
      processName: row.processName,
      craftCode: row.craftCode,
      craftName: row.craftName,
      factoryId: row.factoryId,
      factoryName: row.factoryName,
      factoryTier: row.factoryTier,
      factoryTierName: row.factoryTierName,
      factoryType: row.factoryType,
      factoryTypeName: row.factoryTypeName,
      fallbackAcceptTimeoutHours: row.acceptTimeoutHours ?? globalDefaultConfig.defaultAcceptTimeoutHours,
      fallbackAcceptTimeoutText: row.acceptTimeoutText,
    }))
    .sort((left, right) =>
      left.processName.localeCompare(right.processName)
      || left.craftName.localeCompare(right.craftName)
      || left.factoryTierName.localeCompare(right.factoryTierName)
      || left.factoryTypeName.localeCompare(right.factoryTypeName)
      || left.factoryName.localeCompare(right.factoryName),
    )
}
