import { INSPECTION_STAGES, type AdditionalInspectionStandard, type InspectionApplicability, type InspectionConfiguration, type InspectionContext, type InspectionIssue, type InspectionRuleConfig, type InspectionSnapshot, type InspectionStandard, type InspectionStandardItem, type ResolvedInspectionItem, type ResolvedInspectionStandard } from './quality-management-types.ts'

export function normalizeInspectionContext(context: InspectionContext): InspectionContext {
  return { ...context, stage: context.stage || INSPECTION_STAGES[context.sourceKind], objectType: context.objectType || 'GARMENT' }
}
export function matchesInspectionApplicability(scope: InspectionApplicability | undefined, raw: InspectionContext): boolean {
  if (!scope) return true
  const context = normalizeInspectionContext(raw)
  const inScope = (!scope.sourceKinds?.length || scope.sourceKinds.includes(context.sourceKind))
    && (!scope.stages?.length || scope.stages.includes(context.stage!))
    && (!scope.styleCategories?.length || [context.styleCategory, ...(context.styleCategoryAliases || [])].some(value => !!value && scope.styleCategories!.includes(value)))
    && (!scope.styleIds?.length || [context.styleId, context.styleCode].some(id => !!id && scope.styleIds!.includes(id)))
  if (!inScope) return false
  validateSupportedInspectionAttributes(scope, [context.sourceKind], context.objectType!)
  return !scope.attributes?.length || scope.attributes.every(condition => context.attributes?.[condition.key] === condition.value)
}
/** Only attributes populated by the current garment execution pages can filter checks. */
function validateSupportedInspectionAttributes(scope: InspectionApplicability | undefined, sourceKinds: readonly string[], objectType: string): void {
  if (!scope?.attributes?.length) return
  const seen = new Set<string>()
  for (const condition of scope.attributes) {
    if (!['size', 'color'].includes(condition.key)) throw new Error(`本期不支持适用属性“${condition.key}”，仅支持有实际来源的尺码和颜色。`)
    if (typeof condition.value !== 'string' || !condition.value.trim()) throw new Error('尺码和颜色条件须填写实际文字值，不能使用数字或空值。')
    if (seen.has(condition.key)) throw new Error('同一适用范围的尺码或颜色条件不能重复。')
    seen.add(condition.key)
  }
  if (objectType !== 'GARMENT' || sourceKinds.some(kind => !['PRODUCTION_RETURN', 'WAREHOUSE_STOCK'].includes(kind))) throw new Error('尺码和颜色条件仅适用后道QC和成衣库存质检；产前版或其他对象没有本期可用的属性来源。')
}
function validateConfigurationAttributes(config: InspectionConfiguration): void {
  const sourceKinds = config.applicability.sourceKinds || []
  validateSupportedInspectionAttributes(config.applicability, sourceKinds, config.objectType)
  const child = (scope: InspectionApplicability | undefined) => validateSupportedInspectionAttributes(scope,
    scope?.sourceKinds?.length ? sourceKinds.filter(kind => scope.sourceKinds!.includes(kind)) : sourceKinds, config.objectType)
  if (config.kind !== 'RULE') config.items.forEach(item => child(item.applicability))
  if (config.kind === 'ADDITIONAL') config.overrides.forEach(override => {
    child(override.applicability)
    if (override.fields.includes('applicability')) child(override.values.applicability)
  })
}
/** Exact groups come from formal dictionary/style identities, never inferred prefixes. */
export interface InspectionScopeIdentityAliases {
  styleCategories?: ReadonlyArray<readonly string[]>
  styleIds?: ReadonlyArray<readonly string[]>
  styles?: ReadonlyArray<{ styleId: string; styleCode: string; styleCategories: readonly string[] }>
}
function identityNormalizer(groups: ReadonlyArray<readonly string[]> = []): (value: string) => string {
  const formalIds = new Set(groups.map(group => group[0]).filter(Boolean)), matches = new Map<string, Set<string>>()
  for (const group of groups) {
    const canonical = group[0]
    if (!canonical) continue
    for (const alias of group) if (alias) {
      const owners = matches.get(alias) || new Set<string>()
      owners.add(canonical); matches.set(alias, owners)
    }
  }
  return value => {
    if (formalIds.has(value)) return value
    const owners = matches.get(value)
    if (owners && owners.size > 1) throw new Error(`适用范围“${value}”存在同名歧义，请使用唯一的正式编号。`)
    return owners?.values().next().value || value
  }
}
function scopeIdentityNormalizer(aliases: InspectionScopeIdentityAliases): (scope: InspectionApplicability) => InspectionApplicability {
  const category = identityNormalizer(aliases.styleCategories), style = identityNormalizer(aliases.styleIds)
  return scope => ({ ...scope,
    ...(scope.styleCategories ? { styleCategories: [...new Set(scope.styleCategories.map(category))] } : {}),
    ...(scope.styleIds ? { styleIds: [...new Set(scope.styleIds.map(style))] } : {}),
  })
}
function normalizeConfigurationIdentities(config: InspectionConfiguration, normalize: (scope: InspectionApplicability) => InspectionApplicability): InspectionConfiguration {
  const shared = { ...config, applicability: normalize(config.applicability) }
  if (shared.kind === 'RULE') return shared
  const items = shared.items.map(item => ({ ...item, ...(item.applicability ? { applicability: normalize(item.applicability) } : {}) }))
  if (shared.kind === 'BASIC') return { ...shared, items }
  return { ...shared, items, overrides: shared.overrides.map(override => ({ ...override,
    ...(override.applicability ? { applicability: normalize(override.applicability) } : {}),
    values: { ...override.values, ...(override.values.applicability ? { applicability: normalize(override.values.applicability) } : {}) },
  })) }
}

/** Unknown intersection is treated as overlapping, never as safe to publish. */
export function inspectionScopesOverlap(a: InspectionApplicability, b: InspectionApplicability, identities?: InspectionScopeIdentityAliases): boolean {
  if (identities) { const normalize = scopeIdentityNormalizer(identities); return overlapWithKnownStyles(identities, normalize)(normalize(a), normalize(b)) }
  for (const key of ['sourceKinds', 'stages', 'styleCategories', 'styleIds'] as const) {
    const left: readonly string[] | undefined = a[key], right: readonly string[] | undefined = b[key]
    if (left?.length && right?.length && !left.some(value => right.includes(value))) return false
  }
  if (a.attributes?.some(left => b.attributes?.some(right => left.key === right.key && left.value !== right.value))) return false
  return true
}
function effective(config: InspectionConfiguration, context: InspectionContext): boolean {
  return config.status === 'EFFECTIVE' && config.objectType === context.objectType && matchesInspectionApplicability(config.applicability, context)
}
export function resolveInspectionStandard(input: { basicStandards: InspectionStandard[]; additionalStandards: AdditionalInspectionStandard[]; context: InspectionContext; at?: string }): ResolvedInspectionStandard {
  const context = normalizeInspectionContext(input.context)
  const basics = input.basicStandards.filter(standard => effective(standard, context))
  if (basics.length !== 1) throw new Error(basics.length ? '发现多份同时适用的基本标准，请先澄清配置冲突。' : '没有适用的有效基本标准，请先配置后再开检。')
  const basic = basics[0]
  const additional = input.additionalStandards.filter(standard => effective(standard, context))
  const selected: AdditionalInspectionStandard[] = []
  for (const level of ['STYLE_CATEGORY', 'STYLE'] as const) {
    const same = additional.filter(standard => standard.level === level)
    if (same.length > 1) throw new Error('同一层级存在同款适用的两份附加标准，请先处理冲突。')
    selected.push(...same)
  }
  const items = new Map<string, ResolvedInspectionItem>()
  for (const item of basic.items) {
    if (items.has(item.id)) throw new Error('基本标准检查项编号重复。')
    items.set(item.id, { ...structuredClone(item), basicItemId: item.id, sourceStandardId: basic.id, sourceStandardVersion: basic.version, overriddenBy: [] })
  }
  for (const standard of selected) {
    for (const override of standard.overrides) {
      if (!matchesInspectionApplicability(override.applicability, context)) continue
      const original = items.get(override.targetItemId)
      if (!original) throw new Error(`附加要求关联的原检查项不存在：${override.targetItemId}`)
      if (!override.fields.length) throw new Error('覆盖要求必须明确覆盖字段范围。')
      for (const field of override.fields) {
        if (!Object.hasOwn(override.values, field)) throw new Error('覆盖字段缺少明确的新要求。')
        ;(original as unknown as Record<string, unknown>)[field] = structuredClone(override.values[field])
      }
      original.overriddenBy.push({ standardId: standard.id, version: standard.version, fields: [...override.fields] })
    }
    for (const item of standard.items) {
      if (items.has(item.id)) throw new Error('新增检查项编号重复；调整原项请明确关联覆盖。')
      items.set(item.id, { ...structuredClone(item), sourceStandardId: standard.id, sourceStandardVersion: standard.version, overriddenBy: [] })
    }
  }
  return { basicStandard: { id: basic.id, version: basic.version, name: basic.name }, additionalStandards: selected.map(standard => ({ id: standard.id, version: standard.version, name: standard.name, level: standard.level })), items: [...items.values()].filter(item => matchesInspectionApplicability(item.applicability, context)) }
}
function integer(value: number, label: string): void { if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label}必须为非负整数。`) }
function percent(value: number): void { if (!Number.isFinite(value) || value <= 0 || value > 100) throw new Error('检查比例须大于0且不超过100（例如30表示30%）。') }
const ITEM_KINDS = ['TEXT','MEASUREMENT','VISUAL','FUNCTIONAL','ATTRIBUTE'] as const
const ITEM_METHODS = ['VISUAL','MEASURE','FUNCTIONAL','DOCUMENT'] as const
const SEVERITIES = ['CRITICAL','MAJOR','MINOR'] as const
const DISPOSITIONS = ['DEFECT','REWORK','BOTH'] as const
const EVIDENCE_REQUIREMENTS = ['NONE','PHOTO','MEASUREMENT','DOCUMENT'] as const
function assertEnum(value: unknown, allowed: readonly string[], label: string): void {
  if (value !== undefined && !allowed.includes(String(value))) throw new Error(`${label}不在支持范围。`)
}
function validateDefectCodes(value: unknown, label: string): void {
  if (value === undefined) return
  if (!Array.isArray(value) || value.some(row => !row || typeof row !== 'object')) throw new Error(`${label}缺陷代码格式不完整。`)
  const seen = new Set<string>()
  for (const row of value as Array<Record<string, unknown>>) {
    const code = String(row.code || '').trim()
    if (!code || !String(row.name || '').trim()) throw new Error(`${label}缺陷代码须包含代码和名称。`)
    if (seen.has(code)) throw new Error(`${label}缺陷代码不能重复。`)
    seen.add(code)
    assertEnum(row.severity, SEVERITIES, `${label}缺陷严重度`)
    assertEnum(row.disposition, DISPOSITIONS, `${label}缺陷处置`)
  }
}
function validateMeasurementSpec(value: unknown, label: string): void {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}测量定义格式不完整。`)
  const measurement = value as Record<string, unknown>
  if (!String(measurement.techPackPart || '').trim() && !Object.keys((measurement.nominalBySize as object) || {}).length) throw new Error(`${label}须绑定技术包部位或提供标准值。`)
  if (measurement.tolerance !== undefined && typeof measurement.tolerance !== 'number' && typeof measurement.tolerance !== 'string') throw new Error(`${label}公差格式无效。`)
  if (measurement.nominalBySize !== undefined && (typeof measurement.nominalBySize !== 'object' || Array.isArray(measurement.nominalBySize))) throw new Error(`${label}标准值格式无效。`)
}
function validateTypedItems(items: InspectionStandardItem[], label: string): void {
  items.forEach((item, index) => {
    const itemLabel = `${label}第${index + 1}项`
    assertEnum(item.kind, ITEM_KINDS, `${itemLabel}类型`)
    assertEnum(item.method, ITEM_METHODS, `${itemLabel}方法`)
    assertEnum(item.severity, SEVERITIES, `${itemLabel}严重度`)
    assertEnum(item.disposition, DISPOSITIONS, `${itemLabel}处置`)
    assertEnum(item.evidenceRequirement, EVIDENCE_REQUIREMENTS, `${itemLabel}证据要求`)
    if (item.kind === 'MEASUREMENT') validateMeasurementSpec(item.measurement, itemLabel)
    validateDefectCodes(item.defectCodes, itemLabel)
  })
}
function validateOverrideExecutionFields(override: AdditionalInspectionStandard['overrides'][number], label: string): void {
  const values = override.values as Record<string, unknown>
  for (const field of override.fields) {
    if (['kind','method','severity','disposition','evidenceRequirement'].includes(field)) {
      assertEnum(values[field], field === 'kind' ? ITEM_KINDS : field === 'method' ? ITEM_METHODS : field === 'severity' ? SEVERITIES : field === 'disposition' ? DISPOSITIONS : EVIDENCE_REQUIREMENTS, `${label}${field}`)
    }
    if (field === 'measurement') validateMeasurementSpec(values.measurement, `${label}测量定义`)
    if (field === 'defectCodes') validateDefectCodes(values.defectCodes, label)
  }
}
export function calculateInspectionTarget(input: { quantity: number; percent: number; minQuantity?: number }): number {
  integer(input.quantity, '本批数量'); integer(input.minQuantity ?? 0, '最低检查量'); percent(input.percent)
  return Math.min(input.quantity, Math.max(Math.ceil(input.quantity * input.percent / 100), input.minQuantity ?? 0))
}
export function evaluateRoundAudit(input: { roundNumber: number; roundDefectQty: number; roundReturnedQty: number; percent: number; quantity: number; target?: number; rule: Pick<InspectionRuleConfig, 'roundThresholds' | 'minQuantity'> }): { requiresAudit: boolean; unqualifiedQty: number; threshold?: number; fullInspection: boolean } {
  integer(input.roundNumber, '检查轮次'); if (!input.roundNumber) throw new Error('检查轮次从1开始。')
  integer(input.roundDefectQty, '本轮瑕疵件数'); integer(input.roundReturnedQty, '本轮返工件数')
  const target = input.target ?? calculateInspectionTarget({ quantity: input.quantity, percent: input.percent, minQuantity: input.rule.minQuantity })
  const fullInspection = target >= input.quantity && input.quantity > 0
  const threshold = input.rule.roundThresholds.find(row => row.roundNumber === input.roundNumber)?.unqualifiedQuantity
  const unqualifiedQty = input.roundDefectQty + input.roundReturnedQty
  return { requiresAudit: !fullInspection && input.quantity > 0 && threshold !== undefined && unqualifiedQty >= threshold, unqualifiedQty, threshold, fullInspection }
}
export function validateAuditUpgrade(input: { currentPercent: number; nextPercent: number; percentSteps?: number[] }): void {
  percent(input.currentPercent); percent(input.nextPercent)
  if (input.nextPercent <= input.currentPercent) throw new Error('稽查只能提高检查比例或改为全检，不能维持或降低。')
  if (input.percentSteps && input.nextPercent !== 100 && !input.percentSteps.includes(input.nextPercent)) throw new Error('请选择本次开检规则中的更高检查档位。')
}
export function validateInspectionIssues(snapshot: Pick<InspectionSnapshot, 'items'>, issues: InspectionIssue[]): void {
  // Most rounds mark zero or one issue. Keep the same item traversal (and
  // malformed-item rejection) without constructing a 40-item Set each time.
  const ids=snapshot.items.map(item=>item.id)
  const allowed=issues.length>2 ? new Set(ids) : undefined
  const seen=issues.length>1 ? new Set<string>() : undefined
  for (const issue of issues) {
    if (!(allowed ? allowed.has(issue.itemId) : ids.includes(issue.itemId))) throw new Error('问题项目不属于本次固定的应检标准。')
    if (seen?.has(issue.itemId)) throw new Error('同一检查项不应重复标记问题。')
    seen?.add(issue.itemId)
  }
}
type KnownInspectionStyleCategories = ReadonlyMap<string, readonly string[]>
const noKnownStyleCategories: KnownInspectionStyleCategories = new Map()
function validateConfiguration(config: InspectionConfiguration, all: InspectionConfiguration[], overlaps = inspectionScopesOverlap, knownStyles = noKnownStyleCategories): void {
  if (!config.name.trim() || !config.objectType.trim() || !config.id || !config.familyId) throw new Error('请填写标准名称、对象及稳定编号。')
  if (!config.applicability.sourceKinds?.length || !config.applicability.stages?.length) throw new Error('请明确适用业务和环节。')
  validateConfigurationAttributes(config)
  if (config.kind === 'RULE') {
    if (config.applicability.sourceKinds.includes('PRE_PRODUCTION_SAMPLE')) throw new Error('产前版逐件批版，不配置抽检比例。')
    if (config.quantityBasis !== 'BATCH') throw new Error('本期仅支持按整批数量计算。')
    percent(config.defaultPercent); integer(config.minQuantity, '最低检查量')
    if (!config.percentSteps.length || !config.percentSteps.includes(100) || !config.percentSteps.includes(config.defaultPercent)) throw new Error('检查档位须包含默认比例及100%。')
    config.percentSteps.forEach(percent)
    if (new Set(config.percentSteps).size !== config.percentSteps.length) throw new Error('检查档位不能重复。')
    const rounds = new Set<number>()
    config.roundThresholds.forEach(row => { integer(row.roundNumber, '轮次'); integer(row.unqualifiedQuantity, '稽查门槛'); if (!row.roundNumber || !row.unqualifiedQuantity || rounds.has(row.roundNumber)) throw new Error('稽查轮次和门槛须为正整数且轮次不重复。'); rounds.add(row.roundNumber) })
    if (config.initialFullInspection && (config.applicability.sourceKinds.length !== 1 || config.applicability.sourceKinds[0] !== 'PRODUCTION_RETURN')) throw new Error('四条初始全检条件仅适用生产回货后道QC。')
    if (config.initialFullInspection) { integer(config.initialFullInspection.firstTaskCount, '工厂首批任务数'); if (!config.initialFullInspection.firstTaskCount) throw new Error('工厂首批任务数须大于0。') }
  } else {
    const ids = new Set<string>()
    for (const item of config.items) { if (!item.id || !item.dimension.trim() || !item.name.trim() || !item.content.trim() || !item.criterion.trim()) throw new Error('检查项须有稳定编号、维度、名称、检查内容和判定要求。'); if (ids.has(item.id)) throw new Error('检查项编号不能重复。'); ids.add(item.id) }
    validateTypedItems(config.items, '检查项')
    if (config.kind === 'BASIC' && !config.items.length) throw new Error('基本标准至少包含一个检查项。')
    if (config.kind === 'ADDITIONAL') {
      if (config.level === 'STYLE' && !config.applicability.styleIds?.length) throw new Error('指定款附加标准须明确款式范围。')
      if (config.level === 'STYLE_CATEGORY' && !config.applicability.styleCategories?.length) throw new Error('类别附加标准须明确款式类别。')
      if (!config.items.length && !config.overrides.length) throw new Error('附加标准至少新增或覆盖一个检查项。')
      for (const override of config.overrides) {
        if (!override.targetItemId || !override.fields.length || override.fields.some(field => !Object.hasOwn(override.values, field))) throw new Error('覆盖须明确原检查项、覆盖字段及新要求。')
        validateOverrideExecutionFields(override, '覆盖要求')
        validateOverrideDependency(config, override.targetItemId, override.applicability, all, overlaps, knownStyles)
      }
    }
  }
  // Additional standards are unique per style at each level. SKU conditions
  // may narrow items/overrides, but cannot split that style across two standards.
  const conflictScope = (scope: InspectionApplicability): InspectionApplicability => config.kind === 'ADDITIONAL' ? { ...scope, attributes: undefined } : scope
  const conflict = all.find(other => other.status === 'EFFECTIVE' && other.id !== config.id && other.familyId !== config.familyId && other.kind === config.kind && other.objectType === config.objectType && (config.kind !== 'ADDITIONAL' || (other.kind === 'ADDITIONAL' && config.level === other.level)) && overlaps(conflictScope(other.applicability), conflictScope(config.applicability)))
  if (conflict) throw new Error(`适用范围与有效配置“${conflict.name}”重叠，请缩小范围。`)
}

const scopeDimensions = ['sourceKinds', 'stages', 'styleCategories', 'styleIds'] as const
function intersectInspectionScopes(left: InspectionApplicability, right: InspectionApplicability | undefined): InspectionApplicability | null {
  if (!right) return left
  const result: InspectionApplicability = { attributes: [...(left.attributes || [])] }
  for (const key of scopeDimensions) {
    const a = left[key], b = right[key], values = a?.length && b?.length ? a.filter(value => (b as readonly string[]).includes(value)) : a?.length ? a : b
    if (a?.length && b?.length && !values?.length) return null
    if (values?.length) (result as Record<string, unknown>)[key] = values
  }
  for (const condition of right.attributes || []) {
    const old = result.attributes!.find(item => item.key === condition.key)
    if (old && old.value !== condition.value) return null
    if (!old) result.attributes!.push(condition)
  }
  return result
}
function scopeContains(provider: InspectionApplicability, target: InspectionApplicability, knownStyles: KnownInspectionStyleCategories): boolean {
  const actualCategories = target.styleIds?.length === 1 ? knownStyles.get(target.styleIds[0]) : undefined
  const knownStyleMatchesTarget = actualCategories && (!target.styleCategories?.length || target.styleCategories.some(category => actualCategories.includes(category)))
  return scopeDimensions.every(key => !provider[key]?.length || (key === 'styleCategories' && knownStyleMatchesTarget
    ? provider.styleCategories!.some(category => actualCategories!.includes(category))
    : !!target[key]?.length && target[key]!.every(value => (provider[key] as readonly string[]).includes(value))))
    && (provider.attributes || []).every(condition => target.attributes?.some(other => other.key === condition.key && other.value === condition.value))
}
const knownInspectionStages = new Set<string>(Object.values(INSPECTION_STAGES))
function scopeCoveredByProviders(target: InspectionApplicability, providers: InspectionApplicability[], knownStyles: KnownInspectionStyleCategories): boolean {
  if (target.sourceKinds?.length && target.stages?.length) {
    // Current business entrances produce only their own known default stage.
    // Explicit custom stages remain valid for every source that selected them.
    const pairs = target.sourceKinds.flatMap(sourceKind => target.stages!.filter(stage => !knownInspectionStages.has(stage) || INSPECTION_STAGES[sourceKind] === stage).map(stage => ({ sourceKind, stage })))
    if (!pairs.length) return false
    if (target.sourceKinds.length > 1 || target.stages.length > 1) return pairs.every(({ sourceKind, stage }) => scopeCoveredByProviders({ ...target, sourceKinds:[sourceKind], stages:[stage] }, providers, knownStyles))
  }
  if (providers.some(provider => scopeContains(provider, target, knownStyles))) return true
  if ((target.styleIds?.length || 0) > 1) return target.styleIds!.every(styleId => scopeCoveredByProviders({ ...target, styleIds:[styleId] }, providers, knownStyles))
  // A finite configured scope can be covered by several basic standards (for
  // example production and inventory). A wildcard is never guessed to belong
  // to a narrower category/style scope without an explicit condition.
  const dimension = scopeDimensions.find(key => (target[key]?.length || 0) > 1)
  return !!dimension && target[dimension]!.every(value => scopeCoveredByProviders({ ...target, [dimension]: [value] }, providers, knownStyles))
}
function validateOverrideDependency(config: AdditionalInspectionStandard, targetItemId: string, overrideScope: InspectionApplicability | undefined, all: InspectionConfiguration[], overlaps = inspectionScopesOverlap, knownStyles = noKnownStyleCategories): void {
  const target = intersectInspectionScopes(config.applicability, overrideScope)
  if (!target) return
  const providers = all.filter((row): row is InspectionStandard | AdditionalInspectionStandard => row.status === 'EFFECTIVE' && row.objectType === config.objectType
    && (row.kind === 'BASIC' || (row.kind === 'ADDITIONAL' && config.level === 'STYLE' && row.level === 'STYLE_CATEGORY'))
    && row.id !== config.id && row.items.some(item => item.id === targetItemId)
    && overlaps(row.applicability, target))
  const itemScopes = providers.flatMap(row => row.items.filter(item => item.id === targetItemId).flatMap(item => {
    const scope = intersectInspectionScopes(row.applicability, item.applicability)
    return scope ? [scope] : []
  }))
  if (!scopeCoveredByProviders(target, itemScopes, knownStyles)) throw new Error(`附加标准“${config.name}”依赖的原检查项不存在或未覆盖全部适用范围：${targetItemId}。请先调整相关附加标准。`)
}
function formalStyleCategories(identities: InspectionScopeIdentityAliases, normalize: (scope: InspectionApplicability) => InspectionApplicability): KnownInspectionStyleCategories {
  return new Map((identities.styles || []).map(style => {
    const scope = normalize({ styleIds:[style.styleId], styleCategories:[...style.styleCategories] })
    return [scope.styleIds![0], scope.styleCategories || []]
  }))
}
/** Validate the final effective set before any publish/disable transaction. */
export function validateEffectiveInspectionConfigurationSet(all: InspectionConfiguration[], identities?: InspectionScopeIdentityAliases): void {
  const normalize = identities ? scopeIdentityNormalizer(identities) : undefined
  const active = all.filter(config => config.status === 'EFFECTIVE').map(config => normalize ? normalizeConfigurationIdentities(config, normalize) : config)
  const overlaps = identities && normalize ? overlapWithKnownStyles(identities, normalize) : inspectionScopesOverlap
  const knownStyles = identities && normalize ? formalStyleCategories(identities, normalize) : noKnownStyleCategories
  for (const config of active) validateConfiguration(config, active, overlaps, knownStyles)
}
export function validateInspectionConfiguration(config: InspectionConfiguration, all: InspectionConfiguration[], identities?: InspectionScopeIdentityAliases): void {
  if (!identities) return validateConfiguration(config, all)
  const normalize = scopeIdentityNormalizer(identities)
  validateConfiguration(normalizeConfigurationIdentities(config, normalize), all.filter(other => other.status === 'EFFECTIVE').map(other => normalizeConfigurationIdentities(other, normalize)), overlapWithKnownStyles(identities, normalize), formalStyleCategories(identities, normalize))
}
/** Distinct positioning identities stay distinct. Only a concrete formal style
 * carrying both categories proves an overlap; no transitive category merging. */
function overlapWithKnownStyles(identities: InspectionScopeIdentityAliases, normalize: (scope: InspectionApplicability) => InspectionApplicability): (a: InspectionApplicability, b: InspectionApplicability) => boolean {
  const styles = (identities.styles || []).map(style => ({
    ids: normalize({ styleIds: [style.styleId] }).styleIds!,
    categories: normalize({ styleCategories: [...style.styleCategories] }).styleCategories!,
  }))
  const cache = new WeakMap<InspectionApplicability, Set<number>>()
  const matching = (scope: InspectionApplicability) => {
    let matches = cache.get(scope)
    if (!matches) {
      matches = new Set<number>()
      styles.forEach((style, index) => {
        if ((!scope.styleIds?.length || scope.styleIds.some(id => style.ids.includes(id))) && (!scope.styleCategories?.length || scope.styleCategories.some(category => style.categories.includes(category)))) matches!.add(index)
      })
      cache.set(scope, matches)
    }
    return matches
  }
  return (a, b) => {
    if (inspectionScopesOverlap(a, b)) return true
    if (!styles.length || !inspectionScopesOverlap({ ...a, styleIds: undefined, styleCategories: undefined }, { ...b, styleIds: undefined, styleCategories: undefined })) return false
    const left = matching(a), right = matching(b), small = left.size < right.size ? left : right, other = small === left ? right : left
    return [...small].some(id => other.has(id))
  }
}
