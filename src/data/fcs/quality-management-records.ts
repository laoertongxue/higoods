import { commitPcsRecords, readPcsRecords, type PcsStoredRecord } from '../pcs-record-db.ts'
import { INSPECTION_STAGES, type AdditionalInspectionStandard, type InspectionConfiguration, type InspectionConfigurationKind, type InspectionContext, type InspectionRuleConfig, type InspectionSnapshot, type InspectionStandard } from './quality-management-types.ts'
import { matchesInspectionApplicability, normalizeInspectionContext, resolveInspectionStandard, validateInspectionConfiguration, validateEffectiveInspectionConfigurationSet } from './quality-management-rules.ts'

import { prepareQualityInspectionScopeIdentityAliases } from './quality-management-style-context.ts'

export const QUALITY_CONFIGURATION_NAMESPACE = 'higood-fcs-quality-management'
export const QUALITY_CONFIGURATION_REVISION_ID = `${QUALITY_CONFIGURATION_NAMESPACE}/scope/revision`
export const DEFAULT_FABRIC_SPU_WHITELIST = ['CNIDML002','CNIDML018','CNIDML021','CNIDML031','CNIDML043','CNIDML003','CNIDML132','CNIDML076','CNIDML160','CNIDML030','CNIDML046','CNIDML059','CNIDML022','CNIDML328','CNIDML006','CNIDML129','CNIDML074','CNIDML347','CNIDML095','CNIDML040']
const seedAt = '2026-10-22T00:00:00.000Z'
const stages = Object.values(INSPECTION_STAGES)
const base = { familyId: 'garment-basic', id: 'garment-basic-v1', version: 1, name: '成衣基本质检标准', status: 'EFFECTIVE' as const, objectType: 'GARMENT', applicability: { sourceKinds: ['PRODUCTION_RETURN','WAREHOUSE_STOCK','PRE_PRODUCTION_SAMPLE'] as InspectionContext['sourceKind'][], stages }, createdAt: seedAt, updatedAt: seedAt, effectiveAt: seedAt }
const dimensions = [
  ['size','尺寸规格','领围、肩宽、胸围、衣长、袖长、下摆等关键8–12个部位','封版样衣及尺寸公差表','封版样衣','尺寸公差表'],
  ['fabric','面料外观','色差（缸差、边差、件差）、破洞、瑕疵点、纬斜','色卡及标准光源箱','色卡','标准光源箱'],
  ['sewing','缝制工艺','跳线、浮线、断线、针距、缝份、线迹歪斜','工艺单及工艺标准','工艺单','工艺标准'],
  ['accessory','辅料配件','扣子牢固度、拉链顺滑、唛头、洗标及吊牌正确','BOM清单','BOM清单'],
  ['ironing','整烫外观','死褶、极光、烫黄、版型走样','封版样衣','封版样衣'],
  ['clean','清洁度','污渍、油渍、线头、毛屑','目视及手感','目视及手感'],
]
export const DEFAULT_GARMENT_INSPECTION_STANDARD: InspectionStandard = { ...base, kind: 'BASIC', items: [
  ...[['neck','领围'],['shoulder','肩宽'],['chest','胸围'],['length','衣长'],['sleeve','袖长'],['hem','下摆']].map(([key,name]) => ({ id: `garment-size-${key}`, dimension: '尺寸规格', name, content: `按正式尺寸资料检查${name}；其余关键部位依据资料另行增加`, criterion: '封版样衣及尺寸公差表，不另编公差', references: [{ id: 'size-sealed-sample', name: '封版样衣', kind: 'PHYSICAL_SAMPLE' as const }, { id: 'size-tolerance', name: '尺寸公差表', kind: 'DOCUMENT' as const }] })),
  ...dimensions.slice(1).map(([key, dimension, content, criterion, ...refs]) => ({ id: `garment-${key}`, dimension, name: dimension, content, criterion, references: refs.map((name,index) => ({ id: `${key}-ref-${index + 1}`, name, kind: name === '封版样衣' ? 'PHYSICAL_SAMPLE' as const : 'DOCUMENT' as const })) })),
] }
function defaultRule(sourceKind: 'PRODUCTION_RETURN' | 'WAREHOUSE_STOCK'): InspectionRuleConfig {
  const id = sourceKind === 'PRODUCTION_RETURN' ? 'production-return-rule' : 'warehouse-stock-rule'
  return { ...base, familyId: id, id: `${id}-v1`, name: sourceKind === 'PRODUCTION_RETURN' ? '后道生产回货检查规则' : '成衣库存检查规则', kind: 'RULE', applicability: { sourceKinds: [sourceKind], stages: [INSPECTION_STAGES[sourceKind]] }, quantityBasis: 'BATCH', defaultPercent: 30, minQuantity: 0, percentSteps: [30,50,100], roundThresholds: [{ roundNumber: 1, unqualifiedQuantity: 2 }, { roundNumber: 2, unqualifiedQuantity: 2 }], initialFullInspection: sourceKind === 'PRODUCTION_RETURN' ? { basicStyle: true, highDifficulty: true, outsideFabricWhitelist: true, firstFactoryTasks: true, firstTaskCount: 3, fabricSpuWhitelist: [...DEFAULT_FABRIC_SPU_WHITELIST] } : null }
}
const seeds: InspectionConfiguration[] = [DEFAULT_GARMENT_INSPECTION_STANDARD, defaultRule('PRODUCTION_RETURN'), defaultRule('WAREHOUSE_STOCK')]
export function getDefaultQualityConfigurations(): InspectionConfiguration[] { return structuredClone(seeds) }
let configurations = new Map<string, InspectionConfiguration>(seeds.map(row => [row.id, structuredClone(row)]))
let persisted = new Map<string, PcsStoredRecord>()
let revision = 0
let ready = false
let readError = ''
let saving = false
const rowId = (id: string) => `${QUALITY_CONFIGURATION_NAMESPACE}/config/${encodeURIComponent(id)}`
const newId = () => crypto.randomUUID()
export interface QualityConfigurationOperation { id: string; configurationId: string; action: 'SAVE_DRAFT' | 'PUBLISH' | 'DISABLE'; at: string; name: string; version: number }
let operations: QualityConfigurationOperation[] = []
export function listQualityConfigurations(kind?: InspectionConfigurationKind): InspectionConfiguration[] { if (readError) throw new Error(readError); return [...configurations.values()].filter(row => !kind || row.kind === kind).map(row => structuredClone(row)) }
export function getQualityConfiguration(id: string): InspectionConfiguration | undefined { if (readError) throw new Error(readError); const row = configurations.get(id); return row ? structuredClone(row) : undefined }
export function getQualityConfigurationRevision(): number { return revision }
export function listQualityConfigurationOperations(): QualityConfigurationOperation[] { return structuredClone(operations) }
export async function ensureQualityManagementConfiguration(): Promise<void> {
  if (saving) throw new Error('配置正在保存，请稍后再读取。')
  if (typeof window === 'undefined' && typeof indexedDB === 'undefined') { ready = true; return }
  try {
    const result = await readPcsRecords([QUALITY_CONFIGURATION_NAMESPACE])
    const next = new Map(seeds.map(row => [row.id, structuredClone(row)]))
    const nextOperations: QualityConfigurationOperation[] = []
    for (const row of result.records) {
      if (row.id.startsWith(`${QUALITY_CONFIGURATION_NAMESPACE}/config/`)) {
        const id = decodeURIComponent(row.id.slice(`${QUALITY_CONFIGURATION_NAMESPACE}/config/`.length))
        if (row.deleted) next.delete(id)
        else { const config = row.value as InspectionConfiguration; if (!config || config.id !== id || !['BASIC','ADDITIONAL','RULE'].includes(config.kind) || !['DRAFT','EFFECTIVE','DISABLED'].includes(config.status)) throw new Error('质检配置格式不完整，已保留原记录。'); next.set(id, structuredClone(config)) }
      }
      if (!row.deleted && row.id.startsWith(`${QUALITY_CONFIGURATION_NAMESPACE}/operation/`)) nextOperations.push(row.value as QualityConfigurationOperation)
    }
    configurations = next; persisted = new Map(result.records.map(row => [row.id,row])); revision = persisted.get(QUALITY_CONFIGURATION_REVISION_ID)?.version ?? 0
    operations = nextOperations; ready = true; readError = ''
  } catch (error) { readError = error instanceof Error ? error.message : '质检配置读取失败。'; throw error }
}
async function commitConfigurations(changed: InspectionConfiguration[], action: QualityConfigurationOperation['action'], primary: InspectionConfiguration): Promise<void> {
  if (!ready) await ensureQualityManagementConfiguration()
  if (readError) throw new Error(readError)
  if (saving) throw new Error('上一笔配置尚未保存，请等待完成。')
  const operation: QualityConfigurationOperation = { id: newId(), configurationId: primary.id, action, at: new Date().toISOString(), name: primary.name, version: primary.version }
  const puts = changed.map(config => ({ id: rowId(config.id), collection: 'quality/config', value: structuredClone(config), expectedVersion: persisted.get(rowId(config.id))?.version ?? 0 }))
  const operationId = `${QUALITY_CONFIGURATION_NAMESPACE}/operation/${operation.id}`
  puts.push({ id: QUALITY_CONFIGURATION_REVISION_ID, collection: 'quality/scope', value: { revision: revision + 1 } as any, expectedVersion: revision })
  puts.push({ id: operationId, collection: 'quality/operation', value: operation as any, expectedVersion: 0 })
  saving = true
  try {
    await commitPcsRecords({ puts, deletes: [], operationId: `quality-${operation.id}`, intent: JSON.stringify({ action, changed }) })
    for (const row of puts) { const { expectedVersion, ...rest } = row; persisted.set(row.id, { ...rest, version: expectedVersion + 1 }) }
    changed.forEach(config => configurations.set(config.id, structuredClone(config))); revision++; operations.push(operation)
  } catch (error) { throw new Error(`质检配置未保存，请保留输入并重新读取后重试。${error instanceof Error ? error.message : ''}`) }
  finally { saving = false }
}
export async function saveQualityConfigurationDraft(draft: InspectionConfiguration): Promise<InspectionConfiguration> {
  if (!ready) await ensureQualityManagementConfiguration()
  const current = configurations.get(draft.id)
  if (draft.status !== 'DRAFT' || (current && current.status !== 'DRAFT')) throw new Error('已生效版本不可原地修改，请派生新草稿。')
  if (current && current.updatedAt !== draft.updatedAt) throw new Error('此草稿已被其他页面更新，请先核对最新草稿，原输入仍保留。')
  if (!draft.name.trim() || !draft.id || !draft.familyId) throw new Error('草稿须填写名称及稳定编号。')
  const next = { ...structuredClone(draft), updatedAt: new Date().toISOString() }
  await commitConfigurations([next], 'SAVE_DRAFT', next); return next
}
export function buildQualityConfigurationDraft(kind: InspectionConfigurationKind, fromId?: string): InspectionConfiguration {
  const from = fromId ? configurations.get(fromId) : undefined
  if (fromId && !from) throw new Error('原配置不存在，请重新读取。')
  if (from && from.kind !== kind) throw new Error('配置类型与原版本不一致。')
  const at = new Date().toISOString(), id = `quality-${newId()}`
  if (from) { const next = { ...structuredClone(from), id, familyId: from.familyId, version: Math.max(...listQualityConfigurations().filter(row => row.familyId === from.familyId).map(row => row.version)) + 1, status: 'DRAFT' as const, createdAt: at, updatedAt: at }; delete next.effectiveAt; delete next.disabledAt; return next }
  const shared = { id, familyId: id, version: 1, name: '新质检标准', status: 'DRAFT' as const, objectType: 'GARMENT', applicability: { sourceKinds: ['PRODUCTION_RETURN'] as InspectionContext['sourceKind'][], stages: [INSPECTION_STAGES.PRODUCTION_RETURN] }, createdAt: at, updatedAt: at }
  if (kind === 'BASIC') return { ...shared, kind, items: structuredClone(DEFAULT_GARMENT_INSPECTION_STANDARD.items).map(item => ({ ...item, id: `item-${newId()}` })) }
  if (kind === 'ADDITIONAL') return { ...shared, kind, level: 'STYLE', items: [], overrides: [] }
  return { ...defaultRule('PRODUCTION_RETURN'), ...shared, kind, name: '新检查规则' }
}
export async function publishQualityConfiguration(id: string): Promise<InspectionConfiguration> {
  if (!ready) await ensureQualityManagementConfiguration()
  const current = configurations.get(id)
  if (!current || current.status !== 'DRAFT') throw new Error('仅草稿可以明确生效。')
  const identities = await prepareQualityInspectionScopeIdentityAliases()
  validateInspectionConfiguration(current, listQualityConfigurations(), identities)
  const at = new Date().toISOString(), next = { ...structuredClone(current), status: 'EFFECTIVE' as const, effectiveAt: at, updatedAt: at }
  const previous = listQualityConfigurations().filter(row => row.familyId === current.familyId && row.status === 'EFFECTIVE').map(row => ({ ...row, status: 'DISABLED' as const, disabledAt: at, updatedAt: at }))
  const changes = new Map([...previous, next].map(row => [row.id, row]))
  validateEffectiveInspectionConfigurationSet(listQualityConfigurations().map(row => changes.get(row.id) || row), identities)
  await commitConfigurations([...previous, next], 'PUBLISH', next); return next
}
export async function disableQualityConfiguration(id: string): Promise<void> {
  if (!ready) await ensureQualityManagementConfiguration()
  const current = configurations.get(id)
  if (!current || current.status !== 'EFFECTIVE') throw new Error('当前配置不是有效版本。')
  const at = new Date().toISOString(), next = { ...structuredClone(current), status: 'DISABLED' as const, disabledAt: at, updatedAt: at }
  const identities = await prepareQualityInspectionScopeIdentityAliases()
  validateEffectiveInspectionConfigurationSet(listQualityConfigurations().map(row => row.id === id ? next : row), identities)
  await commitConfigurations([next], 'DISABLE', next)
}
export async function readInspectionSnapshot(raw: InspectionContext): Promise<InspectionSnapshot> {
  await ensureQualityManagementConfiguration()
  return readPreparedInspectionSnapshot(raw)
}
export const ensureQualityManagementRecords = ensureQualityManagementConfiguration
export function readPreparedInspectionSnapshot(raw: InspectionContext): InspectionSnapshot {
  if (!ready || readError) throw new Error(readError || '质检配置尚未读取，请重新读取后开检。')
  return buildInspectionSnapshotFromConfigurations(raw, listQualityConfigurations(), revision)
}
/** Pure static construction for fixed demonstrations; never saves a seed. */
export function buildInspectionSnapshotFromConfigurations(raw: InspectionContext, all: InspectionConfiguration[] = getDefaultQualityConfigurations(), configRevision = 0): InspectionSnapshot {
  const context = normalizeInspectionContext(raw)
  const standard = resolveInspectionStandard({ basicStandards: all.filter((row): row is InspectionStandard => row.kind === 'BASIC'), additionalStandards: all.filter((row): row is AdditionalInspectionStandard => row.kind === 'ADDITIONAL'), context })
  const rules = all.filter((row): row is InspectionRuleConfig => row.kind === 'RULE' && row.status === 'EFFECTIVE' && row.objectType === context.objectType && matchesInspectionApplicability(row.applicability, context))
  if (context.sourceKind !== 'PRE_PRODUCTION_SAMPLE' && rules.length !== 1) throw new Error(rules.length ? '有多份同时适用的检查规则。' : '没有适用的有效检查规则。')
  const rule = context.sourceKind === 'PRE_PRODUCTION_SAMPLE' ? undefined : rules[0]
  return structuredClone({ ...standard, id: `inspection-${newId()}`, selectedAt: new Date().toISOString(), configRevision, context, references: context.references ?? [], ruleSnapshot: rule ? { id: rule.id, version: rule.version, quantityBasis: rule.quantityBasis, defaultPercent: rule.defaultPercent, minQuantity: rule.minQuantity, percentSteps: rule.percentSteps, roundThresholds: rule.roundThresholds, initialFullInspection: rule.initialFullInspection } : null })
}
export async function assertInspectionSnapshotCurrent(snapshot: InspectionSnapshot): Promise<void> {
  await ensureQualityManagementConfiguration()
  if (revision !== snapshot.configRevision) throw new Error('开检前质检配置已变化，请重新读取有效标准后再领取。')
}
/** For a same-PCS-db business commit; do not also put this revision record. */
export function qualityConfigurationGuard(snapshot: InspectionSnapshot): { id: string; expectedVersion: number } { return { id: QUALITY_CONFIGURATION_REVISION_ID, expectedVersion: snapshot.configRevision } }
