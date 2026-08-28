import { listSkuArchivesByStyleId } from './pcs-sku-archive-repository.ts'
import { getStyleArchiveById } from './pcs-style-archive-repository.ts'
import {
  compareEngineeringBomDraftLines,
  copyEngineeringBomDraftVersion,
} from './pcs-engineering-bom-version.ts'
import type {
  EngineeringBomCustomCostDraft,
  EngineeringBomMaterialLineDraft,
  EngineeringBomOperatorRole,
  EngineeringBomPricingPlanRecord,
  EngineeringBomCustomCostDecision,
  EngineeringBomResolvedPricingPlan,
  EngineeringBomTaskLinkageRow,
  EngineeringBomVersionRecord,
  EngineeringBomVersionStoreSnapshot,
  EngineeringBomOwnerStage,
} from './pcs-engineering-bom-types.ts'
import { resolveEngineeringBomMaterialLine } from './pcs-engineering-bom-material-resolver.ts'
import { resolveEngineeringBomDraft } from './pcs-engineering-bom-pricing.ts'

const STORAGE_KEY = 'higood-pcs-engineering-bom-pricing-plan-store-v2'
const STORE_VERSION = 2
let memorySnapshot: EngineeringBomVersionStoreSnapshot | null = null

function canUseStorage(): boolean {
  return typeof localStorage !== 'undefined'
    && typeof localStorage.getItem === 'function'
    && typeof localStorage.setItem === 'function'
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
}

function cloneRecord(record: EngineeringBomVersionRecord): EngineeringBomVersionRecord {
  return {
    ...record,
    applicableSkuIds: [...record.applicableSkuIds],
    materialLines: record.materialLines.map((line) => ({
      ...line,
      applicableSkuIds: [...(line.applicableSkuIds || [])],
      linkedPatternResultIds: [...(line.linkedPatternResultIds || [])],
    })),
    customCosts: record.customCosts.map((item) => ({ ...item })),
    lineDiffs: (record.lineDiffs || []).map((item) => ({ ...item, changedFields: [...item.changedFields] })),
    customCostDiffs: (record.customCostDiffs || []).map((item) => ({ ...item, changedFields: [...item.changedFields] })),
  }
}

function clonePlan(plan: EngineeringBomPricingPlanRecord): EngineeringBomPricingPlanRecord {
  return {
    ...plan,
    customCosts: plan.customCosts.map((item) => ({ ...item })),
  }
}

function cloneSnapshot(snapshot: EngineeringBomVersionStoreSnapshot): EngineeringBomVersionStoreSnapshot {
  return {
    version: STORE_VERSION,
    records: snapshot.records.map(cloneRecord),
    plans: snapshot.plans.map(clonePlan),
  }
}

function readSnapshot(): EngineeringBomVersionStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)
  if (canUseStorage()) {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '') as EngineeringBomVersionStoreSnapshot
      if (parsed?.version === STORE_VERSION && Array.isArray(parsed.records) && Array.isArray(parsed.plans)) {
        memorySnapshot = {
          version: STORE_VERSION,
          records: parsed.records.map(cloneRecord),
          plans: parsed.plans.map(clonePlan),
        }
        return cloneSnapshot(memorySnapshot)
      }
    } catch {
      // 原型数据损坏时使用空仓储，不生成历史兼容分支。
    }
  }
  memorySnapshot = { version: STORE_VERSION, records: [], plans: [] }
  return cloneSnapshot(memorySnapshot)
}

function writeSnapshot(snapshot: EngineeringBomVersionStoreSnapshot): void {
  memorySnapshot = cloneSnapshot(snapshot)
  if (canUseStorage()) localStorage.setItem(STORAGE_KEY, JSON.stringify(memorySnapshot))
}

function nextIdentity(records: EngineeringBomVersionRecord[]): { id: string; code: string } {
  const sequence = records.length + 1
  return {
    id: `BOM-${Date.now().toString(36)}-${String(sequence).padStart(3, '0')}`,
    code: `BOM-V${String(sequence).padStart(3, '0')}`,
  }
}

function assertBuyer(role: EngineeringBomOperatorRole, userId: string, userName: string): void {
  if (role !== '买手' || !userId.trim() || !userName.trim()) throw new Error('只有买手可以维护 BOM 与价格。')
}

function assertBomEditable(record: EngineeringBomVersionRecord): void {
  if (record.versionStatus !== 'DRAFT') throw new Error('只有资料准备中的颜色物料方案可以修改。')
  if (record.editingLockedAt) throw new Error(`新款资料准备已完成，BOM 与价格已锁定。请先由跟单退回买手修改。`)
}

function assertPlanEditable(plan: EngineeringBomPricingPlanRecord): void {
  if (plan.status !== 'DRAFT') throw new Error('当前整款 BOM 与价格方案已交接或确认，不能修改。')
  if (plan.editingLockedAt) throw new Error('新款资料准备已完成，整款 BOM 与价格已锁定。请先由跟单退回买手修改。')
}

function assertPricingPlanCustomCostsComplete(plan: EngineeringBomPricingPlanRecord): void {
  if (plan.customCostDecision === 'UNDECIDED') {
    throw new Error('请先确认本次是否有自定义费用。没有费用时请选择“本次无自定义费用”。')
  }
  if (plan.customCostDecision === 'HAS_CUSTOM_COST' && plan.customCosts.length === 0) {
    throw new Error('已选择“本次有自定义费用”，请至少填写一项费用。')
  }
  if (plan.customCostDecision === 'NO_CUSTOM_COST' && plan.customCosts.length > 0) {
    throw new Error('已选择“本次无自定义费用”，不能保留费用明细。')
  }
  plan.customCosts.forEach((item, index) => {
    if (!item.title.trim()) throw new Error(`第 ${index + 1} 项自定义费用尚未填写费用名称。`)
    if (!Number.isFinite(item.amountIdr) || item.amountIdr <= 0) {
      throw new Error(`自定义费用“${item.title || `第 ${index + 1} 项`}”的金额必须大于 0 IDR。`)
    }
  })
}

function buildPricingPlan(
  input: CreateEngineeringBomVersionsForOwnerInput,
  style: NonNullable<ReturnType<typeof getStyleArchiveById>>,
  createdAt: string,
): EngineeringBomPricingPlanRecord {
  return {
    pricingPlanId: `BOM-PLAN-${input.ownerStage}-${input.ownerId}`,
    ownerStage: input.ownerStage,
    ownerId: input.ownerId,
    ownerCode: input.ownerCode,
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    styleImageUrl: style.mainImageUrl || style.galleryImageUrls[0] || '',
    status: 'DRAFT',
    customCostDecision: 'UNDECIDED',
    customCosts: [],
    buyerId: input.buyerId || '',
    buyerName: input.buyerName || '待分配买手',
    createdAt,
    createdBy: input.createdBy,
    updatedAt: createdAt,
    updatedBy: input.createdBy,
  }
}

function ensurePricingPlan(
  snapshot: EngineeringBomVersionStoreSnapshot,
  input: CreateEngineeringBomVersionsForOwnerInput,
  style: NonNullable<ReturnType<typeof getStyleArchiveById>>,
  createdAt: string,
): EngineeringBomPricingPlanRecord {
  const existing = snapshot.plans.find((item) => item.ownerStage === input.ownerStage && item.ownerId === input.ownerId)
  if (existing) return existing
  const plan = buildPricingPlan(input, style, createdAt)
  snapshot.plans.push(plan)
  return plan
}

function remapCopiedMaterialLines(
  lines: EngineeringBomMaterialLineDraft[],
  styleCode: string,
  productColor: string,
  applicableSkuIds: string[],
): EngineeringBomMaterialLineDraft[] {
  return lines.map((line) => ({
    ...line,
    styleCode,
    productColor,
    applicableSkuIds: [...applicableSkuIds],
    linkedPatternResultIds: [...(line.linkedPatternResultIds || [])],
  }))
}

export function captureEngineeringBomRepositoryState(): EngineeringBomVersionStoreSnapshot {
  return readSnapshot()
}

export function restoreEngineeringBomRepositoryState(snapshot: EngineeringBomVersionStoreSnapshot): void {
  writeSnapshot(snapshot)
}

export function listEngineeringBomVersions(): EngineeringBomVersionRecord[] {
  return readSnapshot().records.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)).map(cloneRecord)
}

export function getEngineeringBomVersionById(versionId: string): EngineeringBomVersionRecord | null {
  const record = readSnapshot().records.find((item) => item.bomDraftVersionId === versionId)
  return record ? cloneRecord(record) : null
}

export function listEngineeringBomVersionsByOwner(
  ownerStage: EngineeringBomOwnerStage,
  ownerId: string,
): EngineeringBomVersionRecord[] {
  return listEngineeringBomVersions().filter((item) => item.ownerStage === ownerStage && item.ownerId === ownerId)
}

export function listEngineeringBomPricingPlans(): EngineeringBomPricingPlanRecord[] {
  return readSnapshot().plans
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .map(clonePlan)
}

export function getEngineeringBomPricingPlan(
  ownerStage: EngineeringBomOwnerStage,
  ownerId: string,
): EngineeringBomPricingPlanRecord | null {
  const plan = readSnapshot().plans.find((item) => item.ownerStage === ownerStage && item.ownerId === ownerId)
  return plan ? clonePlan(plan) : null
}

export function listEngineeringBomHistory(styleCode: string, productColor?: string): EngineeringBomVersionRecord[] {
  return listEngineeringBomVersions()
    .filter((item) => item.styleCode === styleCode)
    .filter((item) => !productColor || item.productColor === productColor)
    .filter((item) => item.versionStatus === 'COMPLETED_CONFIRMED' || item.versionStatus === 'PUBLISHED_SNAPSHOT')
    .sort((left, right) => (
      right.completedConfirmedAt || right.updatedAt
    ).localeCompare(left.completedConfirmedAt || left.updatedAt))
}

export interface CreateEngineeringBomVersionsForOwnerInput {
  ownerStage: EngineeringBomOwnerStage
  ownerId: string
  ownerCode: string
  styleId: string
  buyerId?: string
  buyerName?: string
  createdBy: string
  createdAt?: string
}

export function createEngineeringBomVersionsForOwner(
  input: CreateEngineeringBomVersionsForOwnerInput,
): EngineeringBomVersionRecord[] {
  const style = getStyleArchiveById(input.styleId)
  if (!style) throw new Error('未找到 BOM 所属商品／款式档案。')
  if (!input.ownerId.trim() || !input.ownerCode.trim()) throw new Error('BOM 与价格缺少所属业务对象。')
  const snapshot = readSnapshot()
  const createdAt = input.createdAt || nowText()
  ensurePricingPlan(snapshot, input, style, createdAt)
  const existing = snapshot.records.filter((item) => item.ownerStage === input.ownerStage && item.ownerId === input.ownerId)
  if (existing.length > 0) {
    writeSnapshot(snapshot)
    return existing.map(cloneRecord)
  }

  const skuGroups = new Map<string, string[]>()
  listSkuArchivesByStyleId(style.styleId)
    .filter((sku) => sku.archiveStatus === 'ACTIVE')
    .forEach((sku) => {
      const color = sku.colorName.trim() || '待确认颜色'
      skuGroups.set(color, [...(skuGroups.get(color) || []), sku.skuId])
    })
  if (skuGroups.size === 0) skuGroups.set('待确认颜色', [])

  const createdRecords: EngineeringBomVersionRecord[] = []
  skuGroups.forEach((skuIds, productColor) => {
    const identity = nextIdentity([...snapshot.records, ...createdRecords])
    const recommended = snapshot.records
      .filter((item) => item.styleCode === style.styleCode && item.productColor === productColor)
      .filter((item) => item.versionStatus === 'COMPLETED_CONFIRMED' || item.versionStatus === 'PUBLISHED_SNAPSHOT')
      .sort((left, right) => (right.completedConfirmedAt || right.updatedAt).localeCompare(left.completedConfirmedAt || left.updatedAt))[0]
    const copied = recommended
      ? copyEngineeringBomDraftVersion({ source: recommended, targetVersionId: identity.id, copiedAt: createdAt, copiedBy: input.createdBy })
      : null
    createdRecords.push({
      ...(copied || { materialLines: [], customCosts: [] }),
      bomDraftVersionId: identity.id,
      versionCode: identity.code,
      versionStatus: 'DRAFT',
      ownerStage: input.ownerStage,
      ownerId: input.ownerId,
      ownerCode: input.ownerCode,
      styleId: style.styleId,
      styleCode: style.styleCode,
      styleName: style.styleName,
      styleImageUrl: style.mainImageUrl || style.galleryImageUrls[0] || '',
      productColor,
      applicableSkuIds: [...skuIds],
      customCosts: [],
      sourceVersionId: recommended?.bomDraftVersionId || '',
      buyerId: input.buyerId || '',
      buyerName: input.buyerName || '待分配买手',
      createdAt,
      createdBy: input.createdBy,
      updatedAt: createdAt,
      updatedBy: input.createdBy,
    })
  })
  writeSnapshot({ ...snapshot, records: [...snapshot.records, ...createdRecords] })
  return createdRecords.map(cloneRecord)
}

export interface ReconcileEngineeringBomTargetColorInput {
  productColor: string
  applicableSkuIds: string[]
  sourceVersionId?: string
}

export interface ReconcileEngineeringBomVersionsForTargetColorsInput {
  ownerStage: EngineeringBomOwnerStage
  ownerId: string
  ownerCode: string
  styleId: string
  colors: ReconcileEngineeringBomTargetColorInput[]
  buyerId?: string
  buyerName?: string
  createdBy: string
  createdAt?: string
}

// 设计改款任务的 BOM 颜色只能来自买手已经确认的“目标颜色”。
// 这里不读取目标款历史 BOM，也不按目标款档案中的原有颜色提前建 BOM。
export function reconcileEngineeringBomVersionsForTargetColors(
  input: ReconcileEngineeringBomVersionsForTargetColorsInput,
): EngineeringBomVersionRecord[] {
  const style = getStyleArchiveById(input.styleId)
  if (!style) throw new Error('未找到 BOM 所属商品／款式档案。')
  if (!input.ownerId.trim() || !input.ownerCode.trim()) throw new Error('BOM 与价格缺少所属业务对象。')
  if (!input.colors.length) throw new Error('请至少确认一个目标颜色。')

  const normalizedColors = input.colors.map((item) => ({
    productColor: item.productColor.trim(),
    applicableSkuIds: item.applicableSkuIds.map((skuId) => skuId.trim()).filter(Boolean),
    sourceVersionId: item.sourceVersionId?.trim() || '',
  }))
  if (normalizedColors.some((item) => !item.productColor)) throw new Error('目标颜色名称不能为空。')
  if (normalizedColors.some((item) => item.applicableSkuIds.length === 0)) throw new Error('每个目标颜色必须至少包含一个目标 SKU。')
  const colorKeys = normalizedColors.map((item) => item.productColor.toLocaleLowerCase())
  if (new Set(colorKeys).size !== colorKeys.length) throw new Error('目标颜色不能重复。')

  const snapshot = readSnapshot()
  const createdAt = input.createdAt || nowText()
  ensurePricingPlan(snapshot, input, style, createdAt)
  const existing = snapshot.records.filter((item) => item.ownerStage === input.ownerStage && item.ownerId === input.ownerId)
  const requestedKeys = new Set(colorKeys)
  const obsolete = existing.filter((item) => !requestedKeys.has(item.productColor.trim().toLocaleLowerCase()))
  if (obsolete.some((item) => item.versionStatus !== 'DRAFT')) {
    throw new Error('已经生效的 BOM 颜色不能从当前打样任务中移除。')
  }

  const nextOwnerRecords: EngineeringBomVersionRecord[] = []
  normalizedColors.forEach((color) => {
    const current = existing.find((item) => item.productColor.trim().toLocaleLowerCase() === color.productColor.toLocaleLowerCase())
    if (current) {
      if (current.versionStatus !== 'DRAFT') throw new Error(`目标颜色“${color.productColor}”的 BOM 已生效，不能再修改颜色方案。`)
      if (current.editingLockedAt) throw new Error('新款资料准备已完成，目标颜色与 BOM 已锁定。请先由跟单退回买手修改。')
      nextOwnerRecords.push({
        ...current,
        productColor: color.productColor,
        applicableSkuIds: [...color.applicableSkuIds],
        customCosts: [],
        updatedAt: createdAt,
        updatedBy: input.createdBy,
      })
      return
    }

    const identity = nextIdentity([...snapshot.records, ...nextOwnerRecords])
    const source = color.sourceVersionId
      ? snapshot.records.find((item) => item.bomDraftVersionId === color.sourceVersionId)
      : undefined
    if (color.sourceVersionId && !source) throw new Error(`参考 BOM ${color.sourceVersionId} 不存在。`)
    if (source && !['COMPLETED_CONFIRMED', 'PUBLISHED_SNAPSHOT'].includes(source.versionStatus)) {
      throw new Error(`参考 BOM ${source.versionCode} 尚未完成确认。`)
    }
    const copied = source
      ? copyEngineeringBomDraftVersion({ source, targetVersionId: identity.id, copiedAt: createdAt, copiedBy: input.createdBy })
      : null
    nextOwnerRecords.push({
      ...(copied || { materialLines: [], customCosts: [] }),
      bomDraftVersionId: identity.id,
      versionCode: identity.code,
      versionStatus: 'DRAFT',
      ownerStage: input.ownerStage,
      ownerId: input.ownerId,
      ownerCode: input.ownerCode,
      styleId: style.styleId,
      styleCode: style.styleCode,
      styleName: style.styleName,
      styleImageUrl: style.mainImageUrl || style.galleryImageUrls[0] || '',
      productColor: color.productColor,
      applicableSkuIds: [...color.applicableSkuIds],
      materialLines: remapCopiedMaterialLines(
        copied?.materialLines || [],
        style.styleCode,
        color.productColor,
        color.applicableSkuIds,
      ),
      customCosts: [],
      sourceVersionId: source?.bomDraftVersionId || '',
      buyerId: input.buyerId || '',
      buyerName: input.buyerName || '待分配买手',
      createdAt,
      createdBy: input.createdBy,
      updatedAt: createdAt,
      updatedBy: input.createdBy,
    })
  })

  const ownerRecordIds = new Set(existing.map((item) => item.bomDraftVersionId))
  writeSnapshot({
    ...snapshot,
    records: [
      ...snapshot.records.filter((item) => !ownerRecordIds.has(item.bomDraftVersionId)),
      ...nextOwnerRecords,
    ],
  })
  return nextOwnerRecords.map(cloneRecord)
}

export function saveEngineeringBomVersion(input: {
  versionId: string
  role: EngineeringBomOperatorRole
  userId: string
  userName: string
  materialLines: EngineeringBomMaterialLineDraft[]
  /** @deprecated 自定义费用由整款 BOM 与价格方案统一维护。 */
  customCosts?: EngineeringBomCustomCostDraft[]
  updatedAt?: string
}): EngineeringBomVersionRecord {
  assertBuyer(input.role, input.userId, input.userName)
  const snapshot = readSnapshot()
  const index = snapshot.records.findIndex((item) => item.bomDraftVersionId === input.versionId)
  if (index < 0) throw new Error('BOM 与价格版本不存在。')
  const current = snapshot.records[index]
  assertBomEditable(current)
  input.materialLines.forEach((line) => resolveEngineeringBomMaterialLine(line))
  const legacyCustomCosts = input.customCosts || []
  const next: EngineeringBomVersionRecord = {
    ...current,
    buyerId: input.userId,
    buyerName: input.userName,
    materialLines: input.materialLines.map((line, index) => ({
      ...line,
      bomItemId: line.bomItemId || `${current.bomDraftVersionId}-LINE-${index + 1}`,
      styleCode: current.styleCode,
      productColor: current.productColor,
      applicableSkuIds: [...(line.applicableSkuIds?.length ? line.applicableSkuIds : current.applicableSkuIds)],
    })),
    customCosts: [],
    updatedAt: input.updatedAt || nowText(),
    updatedBy: input.userName,
  }
  const source = current.sourceVersionId
    ? snapshot.records.find((item) => item.bomDraftVersionId === current.sourceVersionId)
    : undefined
  next.lineDiffs = source ? compareEngineeringBomDraftLines(source, next) : compareEngineeringBomDraftLines({ materialLines: [], customCosts: [] }, next)
  next.customCostDiffs = []
  snapshot.records[index] = next
  // 兼容仍传入非空费用的内部 Mock／旧测试调用；费用只写入整款方案，绝不复制回颜色版本。
  if (legacyCustomCosts.length > 0) {
    const plan = snapshot.plans.find((item) => item.ownerStage === current.ownerStage && item.ownerId === current.ownerId)
    if (!plan) throw new Error('整款 BOM 与价格方案不存在。')
    assertPlanEditable(plan)
    legacyCustomCosts.forEach((item) => {
      if (!item.title.trim()) throw new Error('自定义费用名称不能为空。')
      if (!Number.isFinite(item.amountIdr) || item.amountIdr <= 0) throw new Error('自定义费用金额必须大于 0 IDR。')
    })
    const updatedAt = input.updatedAt || nowText()
    plan.customCostDecision = 'HAS_CUSTOM_COST'
    plan.customCosts = legacyCustomCosts.map((item, costIndex) => ({
      ...item,
      customCostId: item.customCostId || `${plan.pricingPlanId}-COST-${costIndex + 1}`,
      displayOrder: item.displayOrder || costIndex + 1,
      maintainedBy: input.userName,
      maintainedAt: updatedAt,
    }))
    plan.buyerId = input.userId
    plan.buyerName = input.userName
    plan.updatedAt = updatedAt
    plan.updatedBy = input.userName
  }
  writeSnapshot(snapshot)
  return cloneRecord(next)
}

export function saveEngineeringBomPricingPlan(input: {
  ownerStage: EngineeringBomOwnerStage
  ownerId: string
  role: EngineeringBomOperatorRole
  userId: string
  userName: string
  customCostDecision: EngineeringBomCustomCostDecision
  customCosts: EngineeringBomCustomCostDraft[]
  updatedAt?: string
}): EngineeringBomPricingPlanRecord {
  assertBuyer(input.role, input.userId, input.userName)
  const snapshot = readSnapshot()
  const plan = snapshot.plans.find((item) => item.ownerStage === input.ownerStage && item.ownerId === input.ownerId)
  if (!plan) throw new Error('整款 BOM 与价格方案不存在。')
  assertPlanEditable(plan)
  const updatedAt = input.updatedAt || nowText()
  plan.customCostDecision = input.customCostDecision
  plan.customCosts = input.customCostDecision === 'NO_CUSTOM_COST' || input.customCostDecision === 'UNDECIDED'
    ? []
    : input.customCosts.map((item, index) => ({
      ...item,
      title: item.title.trim(),
      customCostId: item.customCostId || `${plan.pricingPlanId}-COST-${index + 1}`,
      displayOrder: index + 1,
      maintainedBy: input.userName,
      maintainedAt: updatedAt,
    }))
  plan.buyerId = input.userId
  plan.buyerName = input.userName
  plan.updatedAt = updatedAt
  plan.updatedBy = input.userName
  writeSnapshot(snapshot)
  return clonePlan(plan)
}

/**
 * 把尚未发布的整款方案重新交回买手编辑。
 * 用于技术包审核退回后的再次修改；正式版本快照不可重新打开。
 */
export function reopenEngineeringBomPricingPlanForEditing(input: {
  ownerStage: EngineeringBomOwnerStage
  ownerId: string
  actorName: string
  reopenedAt?: string
}): EngineeringBomPricingPlanRecord {
  const snapshot = readSnapshot()
  const plan = snapshot.plans.find((item) => item.ownerStage === input.ownerStage && item.ownerId === input.ownerId)
  if (!plan) throw new Error('整款 BOM 与价格方案不存在。')
  if (plan.status === 'PUBLISHED_SNAPSHOT') throw new Error('正式版本 BOM 与价格快照不能重新编辑。')
  const reopenedAt = input.reopenedAt || nowText()
  plan.status = 'DRAFT'
  plan.editingLockedAt = ''
  plan.editingLockedBy = ''
  plan.editingLockedReason = ''
  plan.completedConfirmedAt = ''
  plan.completedConfirmedBy = ''
  plan.updatedAt = reopenedAt
  plan.updatedBy = input.actorName
  snapshot.records
    .filter((item) => item.ownerStage === input.ownerStage && item.ownerId === input.ownerId)
    .forEach((record) => {
      if (record.versionStatus === 'PUBLISHED_SNAPSHOT') throw new Error('正式版本颜色物料快照不能重新编辑。')
      record.versionStatus = 'DRAFT'
      record.editingLockedAt = ''
      record.editingLockedBy = ''
      record.editingLockedReason = ''
      record.completedConfirmedAt = ''
      record.completedConfirmedBy = ''
      record.updatedAt = reopenedAt
      record.updatedBy = input.actorName
    })
  writeSnapshot(snapshot)
  return clonePlan(plan)
}

/**
 * 以一个事务性写入替换整款方案的全部颜色物料和共享费用。
 * 技术包审核通过这里把页面事实同步回同一份整款方案。
 */
export function replaceEngineeringBomPricingPlanDraft(input: {
  ownerStage: EngineeringBomOwnerStage
  ownerId: string
  role: EngineeringBomOperatorRole
  userId: string
  userName: string
  colors: Array<{
    productColor: string
    applicableSkuIds?: string[]
    materialLines: EngineeringBomMaterialLineDraft[]
  }>
  customCostDecision: EngineeringBomCustomCostDecision
  customCosts: EngineeringBomCustomCostDraft[]
  updatedAt?: string
}): EngineeringBomResolvedPricingPlan {
  assertBuyer(input.role, input.userId, input.userName)
  const snapshot = readSnapshot()
  const plan = snapshot.plans.find((item) => item.ownerStage === input.ownerStage && item.ownerId === input.ownerId)
  if (!plan) throw new Error('整款 BOM 与价格方案不存在。')
  assertPlanEditable(plan)
  const colors = input.colors.map((item) => ({
    ...item,
    productColor: item.productColor.trim(),
    applicableSkuIds: [...new Set(item.applicableSkuIds || [])],
  }))
  if (!colors.length || colors.some((item) => !item.productColor)) throw new Error('请至少维护一个有效的目标颜色。')
  if (new Set(colors.map((item) => item.productColor)).size !== colors.length) throw new Error('目标颜色不能重复。')
  colors.forEach((color) => color.materialLines.forEach((line) => resolveEngineeringBomMaterialLine(line)))
  if (input.customCostDecision === 'UNDECIDED') {
    // 允许保存未决定的编辑中状态，但后续统一确认会阻断。
  } else if (input.customCostDecision === 'HAS_CUSTOM_COST' && input.customCosts.length === 0) {
    throw new Error('已选择“本次有自定义费用”，请至少填写一项费用。')
  } else if (input.customCostDecision !== 'HAS_CUSTOM_COST' && input.customCosts.length > 0) {
    throw new Error('已有自定义费用明细，请选择“本次有自定义费用”。')
  }
  input.customCosts.forEach((item) => {
    if (!item.title.trim()) throw new Error('自定义费用名称不能为空。')
    if (!Number.isFinite(item.amountIdr) || item.amountIdr <= 0) throw new Error('自定义费用金额必须大于 0 IDR。')
  })
  const updatedAt = input.updatedAt || nowText()
  const existing = snapshot.records.filter((item) => item.ownerStage === input.ownerStage && item.ownerId === input.ownerId)
  existing.forEach(assertBomEditable)
  const nextRecords: EngineeringBomVersionRecord[] = []
  colors.forEach((color, colorIndex) => {
    const current = existing.find((item) => item.productColor === color.productColor)
    const identity = current ? { id: current.bomDraftVersionId, code: current.versionCode } : nextIdentity([
      ...snapshot.records,
      ...nextRecords,
    ])
    nextRecords.push({
      ...(current || {
        bomDraftVersionId: identity.id,
        versionCode: identity.code,
        versionStatus: 'DRAFT' as const,
        ownerStage: plan.ownerStage,
        ownerId: plan.ownerId,
        ownerCode: plan.ownerCode,
        styleId: plan.styleId,
        styleCode: plan.styleCode,
        styleName: plan.styleName,
        styleImageUrl: plan.styleImageUrl,
        sourceVersionId: '',
        buyerId: input.userId,
        buyerName: input.userName,
        createdAt: updatedAt,
        createdBy: input.userName,
        updatedAt,
        updatedBy: input.userName,
        lineDiffs: [],
        customCostDiffs: [],
        customCosts: [],
      }),
      bomDraftVersionId: identity.id,
      versionCode: identity.code,
      versionStatus: 'DRAFT',
      productColor: color.productColor,
      applicableSkuIds: [...(color.applicableSkuIds || [])],
      materialLines: color.materialLines.map((line, lineIndex) => ({
        ...line,
        bomItemId: line.bomItemId || `${identity.id}-LINE-${lineIndex + 1}`,
        styleCode: plan.styleCode,
        productColor: color.productColor,
        applicableSkuIds: [...(line.applicableSkuIds?.length ? line.applicableSkuIds : color.applicableSkuIds || [])],
        linkedPatternResultIds: [...(line.linkedPatternResultIds || [])],
      })),
      customCosts: [],
      buyerId: input.userId,
      buyerName: input.userName,
      editingLockedAt: '',
      editingLockedBy: '',
      editingLockedReason: '',
      completedConfirmedAt: '',
      completedConfirmedBy: '',
      updatedAt,
      updatedBy: input.userName,
      lineDiffs: current?.lineDiffs || [],
      customCostDiffs: [],
    })
  })
  plan.customCostDecision = input.customCostDecision
  plan.customCosts = input.customCostDecision === 'HAS_CUSTOM_COST'
    ? input.customCosts.map((item, index) => ({
        ...item,
        title: item.title.trim(),
        customCostId: item.customCostId || `${plan.pricingPlanId}-COST-${index + 1}`,
        displayOrder: index + 1,
        maintainedBy: input.userName,
        maintainedAt: updatedAt,
      }))
    : []
  plan.buyerId = input.userId
  plan.buyerName = input.userName
  plan.updatedAt = updatedAt
  plan.updatedBy = input.userName
  const existingIds = new Set(existing.map((item) => item.bomDraftVersionId))
  snapshot.records = [...snapshot.records.filter((item) => !existingIds.has(item.bomDraftVersionId)), ...nextRecords]
  writeSnapshot(snapshot)
  return resolveEngineeringBomPricingPlan(input.ownerStage, input.ownerId)
}

export function setEngineeringBomVersionsEditingLock(input: {
  versionIds: string[]
  locked: boolean
  actorName: string
  changedAt?: string
  reason?: string
}): EngineeringBomVersionRecord[] {
  if (!input.versionIds.length) throw new Error('没有可交接的颜色物料方案。')
  if (!input.actorName.trim()) throw new Error('BOM 锁定操作缺少操作人。')
  const snapshot = readSnapshot()
  const versionIds = new Set(input.versionIds)
  const records = snapshot.records.filter((record) => versionIds.has(record.bomDraftVersionId))
  if (records.length !== versionIds.size) throw new Error('部分颜色物料方案不存在，不能完成资料交接。')
  if (records.some((record) => record.versionStatus !== 'DRAFT')) throw new Error('只有尚未交接的颜色物料方案可以锁定。')
  const ownerKeys = new Set(records.map((record) => `${record.ownerStage}\u0000${record.ownerId}`))
  if (ownerKeys.size !== 1) throw new Error('一次只能交接同一张业务单据的 BOM 与价格方案。')
  const owner = records[0]
  const plan = snapshot.plans.find((item) => item.ownerStage === owner.ownerStage && item.ownerId === owner.ownerId)
  if (!plan) throw new Error('整款 BOM 与价格方案不存在。')
  if (input.locked && plan.status !== 'DRAFT') throw new Error('当前整款 BOM 与价格方案已经交接。')
  if (!input.locked && plan.status !== 'HANDED_OFF') throw new Error('只有已交给跟单、尚未确认工作的方案可以退回买手。')
  const changedAt = input.changedAt || nowText()
  records.forEach((record) => {
    record.editingLockedAt = input.locked ? changedAt : ''
    record.editingLockedBy = input.locked ? input.actorName : ''
    record.editingLockedReason = input.locked ? input.reason?.trim() || '买手已完成新款资料准备' : ''
    record.updatedAt = changedAt
    record.updatedBy = input.actorName
  })
  plan.status = input.locked ? 'HANDED_OFF' : 'DRAFT'
  plan.editingLockedAt = input.locked ? changedAt : ''
  plan.editingLockedBy = input.locked ? input.actorName : ''
  plan.editingLockedReason = input.locked ? input.reason?.trim() || '买手已完成新款资料准备' : ''
  plan.updatedAt = changedAt
  plan.updatedBy = input.actorName
  writeSnapshot(snapshot)
  return records.map(cloneRecord)
}

export function regenerateEngineeringBomVersionFromSource(input: {
  targetVersionId: string
  sourceVersionId: string
  role: EngineeringBomOperatorRole
  userId: string
  userName: string
  regeneratedAt?: string
}): EngineeringBomVersionRecord {
  assertBuyer(input.role, input.userId, input.userName)
  const snapshot = readSnapshot()
  const targetIndex = snapshot.records.findIndex((record) => record.bomDraftVersionId === input.targetVersionId)
  if (targetIndex < 0) throw new Error('目标颜色物料方案不存在。')
  const target = snapshot.records[targetIndex]
  assertBomEditable(target)
  const source = snapshot.records.find((record) => record.bomDraftVersionId === input.sourceVersionId)
  if (!source) throw new Error('参考 BOM 与价格版本不存在。')
  const regeneratedAt = input.regeneratedAt || nowText()
  const copied = copyEngineeringBomDraftVersion({
    source,
    targetVersionId: target.bomDraftVersionId,
    copiedAt: regeneratedAt,
    copiedBy: input.userName,
  })
  const next: EngineeringBomVersionRecord = {
    ...target,
    sourceVersionId: source.bomDraftVersionId,
    copiedAt: regeneratedAt,
    copiedBy: input.userName,
    materialLines: remapCopiedMaterialLines(
      copied.materialLines,
      target.styleCode,
      target.productColor,
      target.applicableSkuIds,
    ),
    customCosts: [],
    updatedAt: regeneratedAt,
    updatedBy: input.userName,
    buyerId: input.userId,
    buyerName: input.userName,
  }
  next.lineDiffs = compareEngineeringBomDraftLines(source, next)
  next.customCostDiffs = []
  snapshot.records[targetIndex] = next
  writeSnapshot(snapshot)
  return cloneRecord(next)
}

function resolvePricingPlanFromSnapshot(
  snapshot: EngineeringBomVersionStoreSnapshot,
  ownerStage: EngineeringBomOwnerStage,
  ownerId: string,
): EngineeringBomResolvedPricingPlan {
  const plan = snapshot.plans.find((item) => item.ownerStage === ownerStage && item.ownerId === ownerId)
  if (!plan) throw new Error('整款 BOM 与价格方案不存在。')
  const versions = snapshot.records
    .filter((item) => item.ownerStage === ownerStage && item.ownerId === ownerId)
    .sort((left, right) => left.productColor.localeCompare(right.productColor, 'zh-CN'))
  if (!versions.length) throw new Error('整款 BOM 与价格方案尚未建立颜色物料方案。')
  const resolved = resolveEngineeringBomDraft({
    materialLines: versions.flatMap((version) => version.materialLines),
    customCosts: plan.customCosts,
  })
  return {
    plan: clonePlan(plan),
    versions: versions.map(cloneRecord),
    resolved,
  }
}

export function resolveEngineeringBomPricingPlan(
  ownerStage: EngineeringBomOwnerStage,
  ownerId: string,
): EngineeringBomResolvedPricingPlan {
  return resolvePricingPlanFromSnapshot(readSnapshot(), ownerStage, ownerId)
}

export function confirmEngineeringBomPricingPlan(input: {
  ownerStage: EngineeringBomOwnerStage
  ownerId: string
  role: EngineeringBomOperatorRole
  userId: string
  userName: string
  confirmedAt?: string
}): EngineeringBomPricingPlanRecord {
  assertBuyer(input.role, input.userId, input.userName)
  const snapshot = readSnapshot()
  const plan = snapshot.plans.find((item) => item.ownerStage === input.ownerStage && item.ownerId === input.ownerId)
  if (!plan) throw new Error('整款 BOM 与价格方案不存在。')
  if (plan.status !== 'DRAFT') throw new Error('当前整款 BOM 与价格方案已经交接或确认。')
  assertPricingPlanCustomCostsComplete(plan)
  const versions = snapshot.records.filter((item) => item.ownerStage === input.ownerStage && item.ownerId === input.ownerId)
  if (!versions.length) throw new Error('请先建立至少一个颜色物料方案。')
  const emptyVersion = versions.find((item) => item.materialLines.length === 0)
  if (emptyVersion) throw new Error(`颜色“${emptyVersion.productColor}”尚未维护物料。`)
  const resolved = resolvePricingPlanFromSnapshot(snapshot, input.ownerStage, input.ownerId)
  const invalid = resolved.resolved.materialLines.find((item) => item.priceStatus === '标准单价失效')
  if (invalid) throw new Error(`物料 ${invalid.materialSkuCode} 标准单价失效，不能确认整款 BOM 与价格。`)
  const confirmedAt = input.confirmedAt || nowText()
  plan.status = 'COMPLETED_CONFIRMED'
  plan.completedConfirmedAt = confirmedAt
  plan.completedConfirmedBy = input.userName
  plan.updatedAt = confirmedAt
  plan.updatedBy = input.userName
  plan.buyerId = input.userId
  plan.buyerName = input.userName
  versions.forEach((record) => {
    record.versionStatus = 'COMPLETED_CONFIRMED'
    record.completedConfirmedAt = confirmedAt
    record.completedConfirmedBy = input.userName
    record.updatedAt = confirmedAt
    record.updatedBy = input.userName
    record.buyerId = input.userId
    record.buyerName = input.userName
  })
  writeSnapshot(snapshot)
  return clonePlan(plan)
}

export function copyEngineeringBomPricingPlan(input: {
  sourceOwnerStage: EngineeringBomOwnerStage
  sourceOwnerId: string
  targetOwnerStage: EngineeringBomOwnerStage
  targetOwnerId: string
  copiedBy: string
  copiedAt?: string
  allowHandedOffSource?: boolean
}): EngineeringBomPricingPlanRecord {
  const snapshot = readSnapshot()
  const source = snapshot.plans.find((item) => item.ownerStage === input.sourceOwnerStage && item.ownerId === input.sourceOwnerId)
  const target = snapshot.plans.find((item) => item.ownerStage === input.targetOwnerStage && item.ownerId === input.targetOwnerId)
  if (!source || !target) throw new Error('复制 BOM 与价格时未找到来源或目标整款方案。')
  const reusableStatuses = input.allowHandedOffSource
    ? ['HANDED_OFF', 'COMPLETED_CONFIRMED', 'PUBLISHED_SNAPSHOT']
    : ['COMPLETED_CONFIRMED', 'PUBLISHED_SNAPSHOT']
  if (!reusableStatuses.includes(source.status)) {
    throw new Error('只有已完成确认或正式版本的整款 BOM 与价格才能作为来源。')
  }
  assertPlanEditable(target)
  const sourceVersions = snapshot.records
    .filter((item) => item.ownerStage === input.sourceOwnerStage && item.ownerId === input.sourceOwnerId)
    .sort((left, right) => left.productColor.localeCompare(right.productColor, 'zh-CN'))
  const targetVersions = snapshot.records
    .filter((item) => item.ownerStage === input.targetOwnerStage && item.ownerId === input.targetOwnerId)
  if (!sourceVersions.length) throw new Error('来源整款方案没有颜色物料方案，不能复制。')
  targetVersions.forEach(assertBomEditable)
  const copiedAt = input.copiedAt || nowText()
  target.customCostDecision = source.customCostDecision
  target.customCosts = source.customCosts.map((item, index) => ({
    ...item,
    customCostId: `${target.pricingPlanId}-COST-${index + 1}`,
    maintainedBy: input.copiedBy,
    maintainedAt: copiedAt,
  }))
  target.buyerId = source.buyerId
  target.buyerName = source.buyerName
  target.updatedAt = copiedAt
  target.updatedBy = input.copiedBy
  const copiedVersions = sourceVersions.map((sourceVersion, index) => {
    const matchedTarget = targetVersions.find((item) => item.productColor === sourceVersion.productColor)
    const identity = matchedTarget
      ? { id: matchedTarget.bomDraftVersionId, code: matchedTarget.versionCode }
      : nextIdentity([...snapshot.records, ...sourceVersions.slice(0, index)])
    const copied = copyEngineeringBomDraftVersion({
      source: sourceVersion,
      targetVersionId: identity.id,
      copiedAt,
      copiedBy: input.copiedBy,
      allowHandedOffSource: input.allowHandedOffSource,
    })
    return {
      ...copied,
      bomDraftVersionId: identity.id,
      versionCode: identity.code,
      versionStatus: 'DRAFT' as const,
      ownerStage: target.ownerStage,
      ownerId: target.ownerId,
      ownerCode: target.ownerCode,
      styleId: target.styleId,
      styleCode: target.styleCode,
      styleName: target.styleName,
      styleImageUrl: target.styleImageUrl,
      productColor: sourceVersion.productColor,
      applicableSkuIds: [...sourceVersion.applicableSkuIds],
      materialLines: remapCopiedMaterialLines(
        copied.materialLines,
        target.styleCode,
        sourceVersion.productColor,
        sourceVersion.applicableSkuIds,
      ),
      customCosts: [],
      sourceVersionId: sourceVersion.bomDraftVersionId,
      buyerId: source.buyerId,
      buyerName: source.buyerName,
      editingLockedAt: '',
      editingLockedBy: '',
      editingLockedReason: '',
      completedConfirmedAt: '',
      completedConfirmedBy: '',
      publishedAt: '',
      createdAt: matchedTarget?.createdAt || copiedAt,
      createdBy: matchedTarget?.createdBy || input.copiedBy,
      updatedAt: copiedAt,
      updatedBy: input.copiedBy,
    }
  })
  const targetIds = new Set(targetVersions.map((item) => item.bomDraftVersionId))
  snapshot.records = [
    ...snapshot.records.filter((item) => !targetIds.has(item.bomDraftVersionId)),
    ...copiedVersions,
  ]
  writeSnapshot(snapshot)
  return clonePlan(target)
}

/**
 * 兼容既有内部调用：传入任意颜色版本，实际一次确认其所属整款方案。
 * 页面不再提供单颜色确认入口。
 */
export function confirmEngineeringBomVersion(input: {
  versionId: string
  role: EngineeringBomOperatorRole
  userId: string
  userName: string
  confirmedAt?: string
}): EngineeringBomVersionRecord {
  const snapshot = readSnapshot()
  const record = snapshot.records.find((item) => item.bomDraftVersionId === input.versionId)
  if (!record) throw new Error('BOM 与价格版本不存在。')
  confirmEngineeringBomPricingPlan({
    ownerStage: record.ownerStage,
    ownerId: record.ownerId,
    role: input.role,
    userId: input.userId,
    userName: input.userName,
    confirmedAt: input.confirmedAt,
  })
  return getEngineeringBomVersionById(input.versionId)!
}

export function buildEngineeringBomTaskRows(
  versions: EngineeringBomVersionRecord[],
): EngineeringBomTaskLinkageRow[] {
  return versions.flatMap((version) => version.materialLines.map((line) => ({
    bomItemId: line.bomItemId || `${version.bomDraftVersionId}-${line.materialSkuId}`,
    materialSkuId: line.materialSkuId,
    materialName: line.materialSkuId,
    materialType: line.materialType,
    productColor: version.productColor,
    printRequirement: line.printRequirement,
    printProcess: line.printRequirementText,
    dyeRequirement: line.dyeRequirement,
    purchaseRequirement: line.purchaseRequirement,
    waterSolubleRequirement: line.waterSolubleRequirementText && line.waterSolubleRequirementText !== '无' ? '是' : '否',
  })))
}

export function markEngineeringBomVersionsPublished(input: {
  ownerStage: EngineeringBomOwnerStage
  ownerId: string
  publishedSnapshotId: string
  publishedBy: string
  publishedAt?: string
}): EngineeringBomVersionRecord[] {
  const snapshot = readSnapshot()
  const records = snapshot.records.filter((item) => item.ownerStage === input.ownerStage && item.ownerId === input.ownerId)
  if (!records.length) throw new Error('技术包未关联 BOM 与价格版本，不能形成正式快照。')
  if (records.some((item) => item.versionStatus !== 'COMPLETED_CONFIRMED')) {
    throw new Error('只有已完成且已确认的 BOM 与价格版本才能形成正式快照。')
  }
  const plan = snapshot.plans.find((item) => item.ownerStage === input.ownerStage && item.ownerId === input.ownerId)
  if (!plan || plan.status !== 'COMPLETED_CONFIRMED') {
    throw new Error('整款 BOM 与价格尚未完成确认，不能形成正式快照。')
  }
  const publishedAt = input.publishedAt || nowText()
  records.forEach((record) => {
    record.versionStatus = 'PUBLISHED_SNAPSHOT'
    record.publishedSnapshotId = input.publishedSnapshotId
    record.updatedAt = publishedAt
    record.updatedBy = input.publishedBy
  })
  plan.status = 'PUBLISHED_SNAPSHOT'
  plan.publishedSnapshotId = input.publishedSnapshotId
  plan.updatedAt = publishedAt
  plan.updatedBy = input.publishedBy
  writeSnapshot(snapshot)
  return records.map(cloneRecord)
}

export function resetEngineeringBomRepository(): void {
  writeSnapshot({ version: STORE_VERSION, records: [], plans: [] })
}
