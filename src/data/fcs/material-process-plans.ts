import { getMaterialArchiveById, getMaterialProcessDefinition, getMaterialSkuRecordById, listAllMaterialSkuRecords, listMaterialAssets, markMaterialSkuMainUnitUsed, isMaterialSkuAvailableForNewUse } from '../pcs-material-archive-repository.ts'
import type { MaterialProcessDefinition, MaterialProcessType, MaterialSkuRecord } from '../pcs-material-archive-types.ts'
import { getPcsDurableFileReference, pcsRecordStore, registerPcsRepositoryReset } from '../pcs-record-runtime.ts'
import { MATERIAL_PROCESS_NAMES } from '../pcs-material-rules.ts'
import { listMaterialUnitDefinitions } from '../pcs-material-config.ts'
import { listFactoryMasterRecords } from './factory-master-store.ts'
import { buildSpecialCraftTaskOrdersPath, canFactorySeeSpecialCraftOperation, getSpecialCraftOperationById } from './special-craft-operations.ts'

export const FCS_MATERIAL_PROCESS_PLAN_KEY = 'higood-fcs-material-process-plans-v1'
export const FCS_MATERIAL_PROCESS_PLAN_PATH = '/fcs/process/material-plans'
export type FcsMaterialProcessPlanStatus = 'DRAFT' | 'PLANNED'
export interface FcsMaterialPlanSkuSnapshot {
  materialSkuId: string; materialId: string; materialSkuCode: string; materialName: string
  mainUnit: string; mainUnitVersion: number; colorName: string; imageReference: string; archivePath: string
}
export interface FcsMaterialProcessPlanSource {
  sourceType: 'MATERIAL_SKU'; input: FcsMaterialPlanSkuSnapshot; output: FcsMaterialPlanSkuSnapshot
  process: MaterialProcessDefinition
  executionAssets: Array<{ assetId: string; name: string; role: string; version: number; fileReference: string }>
}
export interface FcsMaterialProcessPlan {
  planId: string; planNo: string; operationId: string; processType: MaterialProcessType
  status: FcsMaterialProcessPlanStatus; source: FcsMaterialProcessPlanSource
  plannedOutputQty: number | null; plannedInputQty: number | null
  factoryId: string; factoryName: string; plannedStartDate: string; plannedFinishDate: string
  responsibleName: string; remark: string; version: number; createdAt: string; updatedAt: string
  creationOperationId: string
  records: Array<{ action: string; operator: string; at: string }>
}
export interface FcsMaterialProcessPlanDraft {
  inputSkuId: string; outputSkuId: string; processDefinitionId: string; processVersionId: string
  plannedOutputQty: number | null; plannedInputQty: number | null
  factoryId: string; plannedStartDate: string; plannedFinishDate: string
  responsibleName: string; remark: string
}
export interface FcsMaterialProcessPlanStoreSnapshot { version: 1; plans: FcsMaterialProcessPlan[] }
let cachedRaw: string | null = null
let cache: FcsMaterialProcessPlanStoreSnapshot | null = null
const clone = <T>(value: T): T => structuredClone(value)
export function getFcsMaterialProcessPlanBaseline(): FcsMaterialProcessPlanStoreSnapshot { return { version: 1, plans: [] } }
export function resetFcsMaterialProcessPlanCache(): void { cache = null; cachedRaw = null }
registerPcsRepositoryReset(resetFcsMaterialProcessPlanCache)
function current(): FcsMaterialProcessPlanStoreSnapshot {
  const raw = pcsRecordStore.getItem(FCS_MATERIAL_PROCESS_PLAN_KEY)
  if (!cache || cachedRaw !== raw) {
    const value = raw ? JSON.parse(raw) as FcsMaterialProcessPlanStoreSnapshot : getFcsMaterialProcessPlanBaseline()
    if (value.version !== 1 || !Array.isArray(value.plans)) throw new Error('物料加工计划无法读取，请重新读取。')
    // Runtime hydration supplies reusable object URLs. Domain snapshots retain durable identities.
    for (const plan of value.plans) {
      plan.source.input.imageReference = getPcsDurableFileReference(plan.source.input.imageReference)
      plan.source.output.imageReference = getPcsDurableFileReference(plan.source.output.imageReference)
      if (plan.source.process.patternImageUrl) plan.source.process.patternImageUrl = getPcsDurableFileReference(plan.source.process.patternImageUrl)
      for (const asset of plan.source.executionAssets) asset.fileReference = getPcsDurableFileReference(asset.fileReference)
    }
    cache = value; cachedRaw = raw
  }
  return cache
}
function persist(next: FcsMaterialProcessPlanStoreSnapshot): void {
  const raw = JSON.stringify(next)
  pcsRecordStore.setItem(FCS_MATERIAL_PROCESS_PLAN_KEY, raw)
  cache = next; cachedRaw = raw
}
export function getFcsMaterialProcessPlanStoreSnapshot(): FcsMaterialProcessPlanStoreSnapshot { return clone(current()) }
export function listFcsMaterialProcessPlans(filter: { processType?: MaterialProcessType; skuId?: string; status?: FcsMaterialProcessPlanStatus; keyword?: string } = {}): FcsMaterialProcessPlan[] {
  const keyword = filter.keyword?.trim().toLowerCase()
  return current().plans.filter(plan => (!filter.processType || plan.processType === filter.processType)
    && (!filter.skuId || [plan.source.input.materialSkuId, plan.source.output.materialSkuId].includes(filter.skuId))
    && (!filter.status || plan.status === filter.status)
    && (!keyword || [plan.planNo, plan.source.input.materialSkuCode, plan.source.output.materialSkuCode, plan.source.output.materialName, plan.factoryName].join(' ').toLowerCase().includes(keyword)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(clone)
}
export function getFcsMaterialProcessPlanById(id: string): FcsMaterialProcessPlan | null { const plan = current().plans.find(item => item.planId === id); return plan ? clone(plan) : null }
export function fcsMaterialProcessPlanDetailPath(id: string): string { return `${FCS_MATERIAL_PROCESS_PLAN_PATH}/${encodeURIComponent(id)}` }
export function fcsMaterialProcessOperationId(type: MaterialProcessType): string {
  return ({ DYEING: 'DYE', PRINTING: 'PRINT', EMBROIDERY: 'AUX-OP-EMBROIDERY', HEAT_TRANSFER: 'AUX-OP-HEAT-TRANSFER' })[type]
}
export function fcsMaterialProfessionalOrdersPath(type: MaterialProcessType): string {
  return type === 'DYEING' ? '/fcs/process/dye-orders' : type === 'PRINTING' ? '/fcs/process/print-orders' : buildSpecialCraftTaskOrdersPath(fcsMaterialProcessOperationId(type))
}
export function listFcsMaterialPlanFactoryOptions(type: MaterialProcessType): Array<{ id: string; name: string; code: string }> {
  const operationId = fcsMaterialProcessOperationId(type)
  return listFactoryMasterRecords().filter(factory => factory.status === 'active' && factory.eligibility.allowDispatch && !factory.isTestFactory)
    .filter(factory => type === 'DYEING' || type === 'PRINTING'
      ? factory.processAbilities.some(ability => ability.processCode === operationId && (ability.status ?? 'ACTIVE') === 'ACTIVE' && ability.canReceiveTask !== false)
      : canFactorySeeSpecialCraftOperation(factory.id, operationId))
    .map(factory => ({ id: factory.id, name: factory.name, code: factory.code }))
}
function snapshotSku(sku: MaterialSkuRecord): FcsMaterialPlanSkuSnapshot {
  const root = getMaterialArchiveById(sku.materialId)
  if (!root) throw new Error('物料主档不存在，请重新选择目标料。')
  if (!isMaterialSkuAvailableForNewUse(sku)) throw new Error('直接投入、目标物料及其主档须已审核并启用，才能新建加工计划。')
  return { materialSkuId: sku.materialSkuId, materialId: sku.materialId, materialSkuCode: sku.materialSkuCode,
    materialName: sku.materialName, colorName: sku.colorName, mainUnit: sku.mainUnit || sku.pricingUnit,
    mainUnitVersion: sku.mainUnitVersion || 1, imageReference: getPcsDurableFileReference(sku.skuImageUrl),
    archivePath: `/pcs/materials/${root.kind}/${root.materialId}/skus/${sku.materialSkuId}` }
}
/** Planning accepts a canonical input/target definition. No production-demand, stock or ticket lookup occurs. */
export function readFcsMaterialProcessPlanSource(input: Pick<FcsMaterialProcessPlanDraft, 'inputSkuId' | 'outputSkuId' | 'processDefinitionId' | 'processVersionId'>): FcsMaterialProcessPlanSource {
  const output = getMaterialSkuRecordById(input.outputSkuId), source = getMaterialSkuRecordById(input.inputSkuId)
  const process = getMaterialProcessDefinition(input.outputSkuId)
  if (!output || !source || !process || process.inputSkuId !== input.inputSkuId || process.outputSkuId !== input.outputSkuId || process.processDefinitionId !== input.processDefinitionId) throw new Error('直接投入、目标物料和加工定义不一致，请重新从物料档案发起。')
  if (!input.processVersionId || process.processVersionId !== input.processVersionId) throw new Error('加工资料版本已变化，请重新选择目标料并核对资料。')
  if (process.objectType !== 'MATERIAL') throw new Error('此入口只为物料加工建计划；裁片与毛织成片请使用对应专业任务。')
  if (process.processType === 'DYEING' && (!process.pantoneCode || !process.pantoneSystem)) throw new Error('染色加工定义缺少 Pantone 体系或色号。')
  if (process.processType === 'EMBROIDERY' || process.processType === 'HEAT_TRANSFER') {
    const operation = getSpecialCraftOperationById(fcsMaterialProcessOperationId(process.processType))
    if (!operation?.isEnabled) throw new Error('对应专业工艺已停用，不能新建计划。')
  }
  const assets = listMaterialAssets(output.materialId, output.materialSkuId)
  const executionAssets = process.executionAssetIds.map(id => {
    const asset = assets.find(item => item.assetId === id)
    if (!asset) throw new Error('加工执行资料引用不完整，请先回物料档案补齐。')
    return { assetId: id, name: asset.name, role: asset.role, version: asset.version, fileReference: getPcsDurableFileReference(asset.url) }
  })
  const definition = clone(process)
  if (definition.patternImageUrl) definition.patternImageUrl = getPcsDurableFileReference(definition.patternImageUrl)
  return { sourceType: 'MATERIAL_SKU', input: snapshotSku(source), output: snapshotSku(output), process: definition, executionAssets }
}
export function listFcsMaterialPlanTargets(type?: MaterialProcessType): MaterialSkuRecord[] {
  return listAllMaterialSkuRecords().filter(sku => sku.processDefinitionId && isMaterialSkuAvailableForNewUse(sku))
    .filter(sku => !type || getMaterialProcessDefinition(sku.materialSkuId)?.processType === type)
    .filter(sku => isMaterialSkuAvailableForNewUse(getMaterialSkuRecordById(getMaterialProcessDefinition(sku.materialSkuId)?.inputSkuId || '')))
}
function validateDraft(input: FcsMaterialProcessPlanDraft, source: FcsMaterialProcessPlanSource, status: FcsMaterialProcessPlanStatus): { factoryName: string } {
  for (const [label, value, unit] of [['计划产出数量', input.plannedOutputQty, source.output.mainUnit], ['计划投入数量', input.plannedInputQty, source.input.mainUnit]] as const) {
    if (value !== null && (!Number.isFinite(value) || value <= 0)) throw new Error(`${label}须为正数，未确定时可保存草稿。`)
    const precision = listMaterialUnitDefinitions().find(item => item.code === unit)?.precision
    if (value !== null && precision !== undefined && Math.abs(value * 10 ** precision - Math.round(value * 10 ** precision)) > 1e-7) throw new Error(`${label}使用 ${unit}，最多保留 ${precision} 位小数。`)
  }
  const factory = input.factoryId ? listFcsMaterialPlanFactoryOptions(source.process.processType).find(item => item.id === input.factoryId) : undefined
  if (input.factoryId && !factory) throw new Error('所选工厂未启用或未开通此工艺，请重新选择。')
  for (const date of [input.plannedStartDate, input.plannedFinishDate]) {
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date)) throw new Error('请填写有效计划日期。')
  }
  if (input.plannedStartDate && input.plannedFinishDate && input.plannedFinishDate < input.plannedStartDate) throw new Error('计划完成日期不能早于计划开始日期。')
  if (status === 'PLANNED' && (input.plannedOutputQty === null || input.plannedInputQty === null || !factory || !input.plannedStartDate || !input.plannedFinishDate || !input.responsibleName.trim())) throw new Error('确认计划前，请补齐投入数量、产出数量、加工工厂、计划日期和负责人。')
  return { factoryName: factory?.name || '' }
}
function newPlanNumber(plans: FcsMaterialProcessPlan[], now: string): string {
  const prefix = `MP-${now.slice(0, 10).replaceAll('-', '')}-`
  const maximum = Math.max(0, ...plans.filter(plan => plan.planNo.startsWith(prefix)).map(plan => Number(plan.planNo.slice(prefix.length)) || 0))
  return `${prefix}${String(maximum + 1).padStart(4, '0')}`
}
/** Caller must use runPcsRecordCommand so plan, unit locks, and reference files commit together. */
export function createFcsMaterialProcessPlan(input: FcsMaterialProcessPlanDraft, status: FcsMaterialProcessPlanStatus, operationId: string): FcsMaterialProcessPlan {
  if (!operationId.trim()) throw new Error('缺少本次保存标识，请重新打开新建页。')
  const state = clone(current()), existing = state.plans.find(plan => plan.creationOperationId === operationId)
  if (existing) {
    const same = existing.status === status && existing.source.input.materialSkuId === input.inputSkuId && existing.source.output.materialSkuId === input.outputSkuId
      && existing.source.process.processDefinitionId === input.processDefinitionId && existing.source.process.processVersionId === input.processVersionId
      && existing.plannedInputQty === input.plannedInputQty && existing.plannedOutputQty === input.plannedOutputQty && existing.factoryId === input.factoryId
      && existing.plannedStartDate === input.plannedStartDate && existing.plannedFinishDate === input.plannedFinishDate && existing.responsibleName === input.responsibleName.trim() && existing.remark === input.remark.trim()
    if (!same) throw new Error('本次保存标识已用于另一份计划内容，请重新打开新建页。')
    return clone(existing)
  }
  const source = readFcsMaterialProcessPlanSource(input), { factoryName } = validateDraft(input, source, status)
  const now = new Date().toISOString(), operator = input.responsibleName.trim() || '管理员'
  const plan: FcsMaterialProcessPlan = { planId: `fmp-${operationId}`, planNo: newPlanNumber(state.plans, now), operationId: fcsMaterialProcessOperationId(source.process.processType), processType: source.process.processType, status,
    source, plannedOutputQty: input.plannedOutputQty, plannedInputQty: input.plannedInputQty, factoryId: input.factoryId, factoryName,
    plannedStartDate: input.plannedStartDate, plannedFinishDate: input.plannedFinishDate, responsibleName: input.responsibleName.trim(), remark: input.remark.trim(),
    version: 1, createdAt: now, updatedAt: now, creationOperationId: operationId,
    records: [{ action: status === 'DRAFT' ? '保存计划草稿' : '建立物料加工计划', operator, at: now }] }
  markMaterialSkuMainUnitUsed([source.input.materialSkuId, source.output.materialSkuId])
  state.plans.push(plan); persist(state); return clone(plan)
}
export function updateFcsMaterialProcessPlan(id: string, input: FcsMaterialProcessPlanDraft, status: FcsMaterialProcessPlanStatus, expectedVersion: number): FcsMaterialProcessPlan {
  const state = clone(current()), plan = state.plans.find(item => item.planId === id)
  if (!plan) throw new Error('加工计划不存在，请重新读取。')
  if (plan.version !== expectedVersion) throw new Error('加工计划已被其他页面修改，请重新读取后再保存。')
  if (plan.status !== 'DRAFT') throw new Error('已确认的加工计划保留原资料与数量，请查看计划详情。')
  if (input.inputSkuId !== plan.source.input.materialSkuId || input.outputSkuId !== plan.source.output.materialSkuId || input.processDefinitionId !== plan.source.process.processDefinitionId || input.processVersionId !== plan.source.process.processVersionId) throw new Error('编辑计划不能替换物料身份或加工资料版本，请另建计划。')
  const { factoryName } = validateDraft(input, plan.source, status), now = new Date().toISOString()
  Object.assign(plan, { status, plannedOutputQty: input.plannedOutputQty, plannedInputQty: input.plannedInputQty, factoryId: input.factoryId, factoryName,
    plannedStartDate: input.plannedStartDate, plannedFinishDate: input.plannedFinishDate, responsibleName: input.responsibleName.trim(), remark: input.remark.trim(), version: plan.version + 1, updatedAt: now })
  plan.records.push({ action: status === 'PLANNED' ? '确认物料加工计划' : '修改计划草稿', operator: input.responsibleName.trim() || '管理员', at: now })
  persist(state); return clone(plan)
}
export function getFcsMaterialProcessPlanReceipt(plan: FcsMaterialProcessPlan) {
  return { planId: plan.planId, planNo: plan.planNo, label: `${MATERIAL_PROCESS_NAMES[plan.processType]}加工计划`, status: plan.status,
    detailPath: fcsMaterialProcessPlanDetailPath(plan.planId), inputSkuId: plan.source.input.materialSkuId, outputSkuId: plan.source.output.materialSkuId }
}
