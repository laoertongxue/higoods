import { listSkuArchivesByStyleId } from './pcs-sku-archive-repository.ts'
import { getStyleArchiveById } from './pcs-style-archive-repository.ts'
import {
  compareEngineeringBomDraftCustomCosts,
  compareEngineeringBomDraftLines,
  copyEngineeringBomDraftVersion,
} from './pcs-engineering-bom-version.ts'
import type {
  EngineeringBomCustomCostDraft,
  EngineeringBomMaterialLineDraft,
  EngineeringBomOperatorRole,
  EngineeringBomTaskLinkageRow,
  EngineeringBomVersionRecord,
  EngineeringBomVersionStoreSnapshot,
  EngineeringBomOwnerStage,
} from './pcs-engineering-bom-types.ts'
import { resolveEngineeringBomMaterialLine } from './pcs-engineering-bom-material-resolver.ts'
import { resolveEngineeringBomDraft } from './pcs-engineering-bom-pricing.ts'

const STORAGE_KEY = 'higood-pcs-engineering-bom-version-store-v1'
const STORE_VERSION = 1
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

function cloneSnapshot(snapshot: EngineeringBomVersionStoreSnapshot): EngineeringBomVersionStoreSnapshot {
  return { version: STORE_VERSION, records: snapshot.records.map(cloneRecord) }
}

function readSnapshot(): EngineeringBomVersionStoreSnapshot {
  if (memorySnapshot) return cloneSnapshot(memorySnapshot)
  if (canUseStorage()) {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '') as EngineeringBomVersionStoreSnapshot
      if (parsed && Array.isArray(parsed.records)) {
        memorySnapshot = { version: STORE_VERSION, records: parsed.records.map(cloneRecord) }
        return cloneSnapshot(memorySnapshot)
      }
    } catch {
      // 原型数据损坏时使用空仓储，不生成历史兼容分支。
    }
  }
  memorySnapshot = { version: STORE_VERSION, records: [] }
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
  if (record.versionStatus !== 'DRAFT') throw new Error('只有草稿 BOM 与价格可以修改。')
  if (record.editingLockedAt) throw new Error(`新款资料准备已完成，BOM 与价格已锁定。请先由跟单退回买手修改。`)
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
  const existing = snapshot.records.filter((item) => item.ownerStage === input.ownerStage && item.ownerId === input.ownerId)
  if (existing.length > 0) return existing.map(cloneRecord)

  const skuGroups = new Map<string, string[]>()
  listSkuArchivesByStyleId(style.styleId)
    .filter((sku) => sku.archiveStatus === 'ACTIVE')
    .forEach((sku) => {
      const color = sku.colorName.trim() || '待确认颜色'
      skuGroups.set(color, [...(skuGroups.get(color) || []), sku.skuId])
    })
  if (skuGroups.size === 0) skuGroups.set('待确认颜色', [])

  const createdAt = input.createdAt || nowText()
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

// 独立打样的 BOM 颜色只能来自买手已经确认的“目标颜色”。
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
  const existing = snapshot.records.filter((item) => item.ownerStage === input.ownerStage && item.ownerId === input.ownerId)
  const requestedKeys = new Set(colorKeys)
  const obsolete = existing.filter((item) => !requestedKeys.has(item.productColor.trim().toLocaleLowerCase()))
  if (obsolete.some((item) => item.versionStatus !== 'DRAFT')) {
    throw new Error('已经生效的 BOM 颜色不能从当前打样任务中移除。')
  }

  const createdAt = input.createdAt || nowText()
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
  customCosts: EngineeringBomCustomCostDraft[]
  updatedAt?: string
}): EngineeringBomVersionRecord {
  assertBuyer(input.role, input.userId, input.userName)
  const snapshot = readSnapshot()
  const index = snapshot.records.findIndex((item) => item.bomDraftVersionId === input.versionId)
  if (index < 0) throw new Error('BOM 与价格版本不存在。')
  const current = snapshot.records[index]
  assertBomEditable(current)
  input.materialLines.forEach((line) => resolveEngineeringBomMaterialLine(line))
  input.customCosts.forEach((item) => {
    if (!item.title.trim()) throw new Error('自定义费用名称不能为空。')
    if (!Number.isFinite(item.amountIdr) || item.amountIdr <= 0) throw new Error('自定义费用金额必须大于 0 IDR。')
  })
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
    customCosts: input.customCosts.map((item, index) => ({
      ...item,
      customCostId: item.customCostId || `${current.bomDraftVersionId}-COST-${index + 1}`,
      maintainedBy: input.userName,
      maintainedAt: input.updatedAt || nowText(),
    })),
    updatedAt: input.updatedAt || nowText(),
    updatedBy: input.userName,
  }
  const source = current.sourceVersionId
    ? snapshot.records.find((item) => item.bomDraftVersionId === current.sourceVersionId)
    : undefined
  next.lineDiffs = source ? compareEngineeringBomDraftLines(source, next) : compareEngineeringBomDraftLines({ materialLines: [], customCosts: [] }, next)
  next.customCostDiffs = source ? compareEngineeringBomDraftCustomCosts(source, next) : compareEngineeringBomDraftCustomCosts({ materialLines: [], customCosts: [] }, next)
  snapshot.records[index] = next
  writeSnapshot(snapshot)
  return cloneRecord(next)
}

export function setEngineeringBomVersionsEditingLock(input: {
  versionIds: string[]
  locked: boolean
  actorName: string
  changedAt?: string
  reason?: string
}): EngineeringBomVersionRecord[] {
  if (!input.versionIds.length) throw new Error('没有可锁定的 BOM 与价格草稿。')
  if (!input.actorName.trim()) throw new Error('BOM 锁定操作缺少操作人。')
  const snapshot = readSnapshot()
  const versionIds = new Set(input.versionIds)
  const records = snapshot.records.filter((record) => versionIds.has(record.bomDraftVersionId))
  if (records.length !== versionIds.size) throw new Error('部分 BOM 与价格草稿不存在，不能完成资料交接。')
  if (records.some((record) => record.versionStatus !== 'DRAFT')) throw new Error('只有草稿 BOM 与价格可以交接锁定。')
  const changedAt = input.changedAt || nowText()
  records.forEach((record) => {
    record.editingLockedAt = input.locked ? changedAt : ''
    record.editingLockedBy = input.locked ? input.actorName : ''
    record.editingLockedReason = input.locked ? input.reason?.trim() || '买手已完成新款资料准备' : ''
    record.updatedAt = changedAt
    record.updatedBy = input.actorName
  })
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
  if (targetIndex < 0) throw new Error('目标 BOM 与价格草稿不存在。')
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
    customCosts: copied.customCosts.map((item) => ({ ...item })),
    updatedAt: regeneratedAt,
    updatedBy: input.userName,
    buyerId: input.userId,
    buyerName: input.userName,
  }
  next.lineDiffs = compareEngineeringBomDraftLines(source, next)
  next.customCostDiffs = compareEngineeringBomDraftCustomCosts(source, next)
  snapshot.records[targetIndex] = next
  writeSnapshot(snapshot)
  return cloneRecord(next)
}

export function confirmEngineeringBomVersion(input: {
  versionId: string
  role: EngineeringBomOperatorRole
  userId: string
  userName: string
  confirmedAt?: string
}): EngineeringBomVersionRecord {
  assertBuyer(input.role, input.userId, input.userName)
  const snapshot = readSnapshot()
  const record = snapshot.records.find((item) => item.bomDraftVersionId === input.versionId)
  if (!record) throw new Error('BOM 与价格版本不存在。')
  if (record.versionStatus !== 'DRAFT') throw new Error('当前 BOM 与价格方案已经确认。')
  if (record.materialLines.length === 0) throw new Error('请至少维护一条 BOM 物料后再确认方案。')
  resolveEngineeringBomDraft(record)
  const confirmedAt = input.confirmedAt || nowText()
  record.versionStatus = 'COMPLETED_CONFIRMED'
  record.completedConfirmedAt = confirmedAt
  record.completedConfirmedBy = input.userName
  record.updatedAt = confirmedAt
  record.updatedBy = input.userName
  record.buyerId = input.userId
  record.buyerName = input.userName
  writeSnapshot(snapshot)
  return cloneRecord(record)
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
    shrinkRequirement: line.shrinkRequirementText && line.shrinkRequirementText !== '无' ? '是' : '否',
    washRequirement: line.washRequirementText && line.washRequirementText !== '无' ? '是' : '否',
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
  const publishedAt = input.publishedAt || nowText()
  records.forEach((record) => {
    record.versionStatus = 'PUBLISHED_SNAPSHOT'
    record.publishedSnapshotId = input.publishedSnapshotId
    record.updatedAt = publishedAt
    record.updatedBy = input.publishedBy
  })
  writeSnapshot(snapshot)
  return records.map(cloneRecord)
}

export function resetEngineeringBomRepository(): void {
  writeSnapshot({ version: STORE_VERSION, records: [] })
}
