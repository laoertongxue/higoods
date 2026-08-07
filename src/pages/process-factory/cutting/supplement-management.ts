// @page-pattern: list

import { escapeHtml } from '../../../utils.ts'
import { cuttingOrderProgressRecords } from '../../../data/fcs/cutting/order-progress.ts'
import {
  PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE,
  renderProductionOrderIdentityCell,
} from '../../../data/fcs/production-order-identity.ts'
import type {
  CuttingMaterialLine,
  CuttingOrderProgressRecord,
  CuttingSkuRequirementLine,
} from '../../../data/fcs/cutting/types.ts'
import { getProductionOrderTechPackSnapshot } from '../../../data/fcs/production-order-tech-pack-runtime.ts'
import type {
  ProductionOrderTechPackSnapshot,
  TechPackBomItemSnapshot,
} from '../../../data/fcs/production-tech-pack-snapshot-types.ts'
import {
  prepareProcessWorkOrderBatch,
  resolveUniqueSupplementBomItem,
  type ProcessWorkOrderGenerationInput,
} from '../../../data/fcs/process-work-order-generation-service.ts'
import { PROCESS_WORK_ORDER_SOURCE_LABEL, getProcessWorkOrderById } from '../../../data/fcs/process-work-order-domain.ts'
import {
  registerSupplementPrintPrerequisite,
  removeSupplementPrintPrerequisites,
} from '../../../data/fcs/supplement-print-prerequisite.ts'
import {
  buildDyeingWorkOrderDetailLink,
  buildPrintingWorkOrderDetailLink,
} from '../../../data/fcs/fcs-route-links.ts'
import type { TechnicalColorMaterialMappingLine } from '../../../data/pcs-technical-data-version-types.ts'
import { buildProductionPieceTruth } from '../../../domain/fcs-cutting-piece-truth/index.ts'
import { appStore } from '../../../state/store.ts'
import {
  getCurrentCutPieceReleaseTargetSnapshot,
  listCutPieceReleaseRecords,
  type CutPieceReleaseRecord,
  type CutPieceReleaseSourceState,
  type CutPieceReleaseTargetSnapshot,
} from '../../../data/fcs/cut-piece-release.ts'
import {
  buildSupplementPartShortages,
  type SupplementPartShortage,
} from '../../../data/fcs/cut-piece-release-domain.ts'
import {
  ensureFixedSupplementOrderFixturesRegistered,
} from '../../../data/fcs/cutting/cut-order-supplement-fixture.ts'
import {
  listSupplementOrders,
  removeSupplementOrderForRollback,
  registerSupplementOrder,
  resetSupplementOrderRegistryForTesting,
  type SupplementMaterialDemand,
  type SupplementOrderLifecycle,
  type SupplementProcessWorkOrderRef,
} from '../../../data/fcs/cutting/supplement-order-registry.ts'
import {
  buildSupplementSupplyDecisions,
  type SupplementMaterialSupplyDecisionSnapshot,
} from '../../../data/fcs/cutting/supplement-supply-domain.ts'
import {
  registerSupplementPurchaseOrder,
  removeSupplementPurchaseOrders,
  type SupplementCreatedPurchaseOrderRef,
} from '../../../data/fcs/cutting/supplement-purchase-order-registry.ts'
import {
  registerSupplementMaterialPrepDemand,
  removeSupplementMaterialPrepDemandForRollback,
} from '../../../data/fcs/cutting/supplement-material-prep-demand-registry.ts'
import { getSupplementMaterialNodeFacts, getSupplementNodeOverview } from '../../../data/fcs/cutting/supplement-node-facts.ts'
import { renderTablePagination } from '../../../components/ui/pagination.ts'
import { renderSecondaryButton } from '../../../components/ui/button.ts'
import { renderStandardListPage, renderStandardListStats } from '../../../components/ui/list-page.ts'
import {
  clearListColumnPreferences,
  loadListColumnPreferences,
  normalizeListColumnPreferences,
  paginateStandardListRows,
  saveListColumnPreferences,
  sortStandardListRows,
  type StandardListColumnPreferences,
  type StandardListColumnRule,
  type StandardListPageSlice,
  type StandardListSortState,
} from '../../../components/ui/list-table-model.ts'
import {
  renderStandardListColumnSettings,
  renderStandardListTable,
  type StandardListColumn,
} from '../../../components/ui/list-table.ts'

type SupplementFilterSourceType = 'ALL' | SupplementSourceType
type SupplementProcessKind = '印花' | '染色'

export type SupplementManualSourceType = 'production-order' | 'cut-order'
export type SupplementSourceType = SupplementManualSourceType | 'release-snapshot'
export type SupplementMaterialRole = '面料A' | '面料B' | '面料C' | '里布' | '衬' | '罗纹' | '辅料' | '包材' | '未识别'
export type SupplementRoleSource = '物料-纸样关联别名' | '物料行继承别名' | '纸样辅助识别' | '顺序推断' | '未识别'
export type SupplementRoleConfirmStatus = '已确认' | '待确认'

export interface SupplementSizeColorRow {
  key: string
  skuCode: string
  color: string
  size: string
  plannedQty: number
  actualCutPieces: number
  inboundPieces: number
  completeSetQty: number
  inboundSetQty: number
  shortageQty: number
  existingSupplementQty: number
  suggestedSupplementQty: number
  relatedCutOrderNos: string[]
}

export interface SupplementMaterialPatternRef {
  materialPatternMappingId: string
  techPackVersionId: string
  materialSku: string
  materialName: string
  materialImageUrl: string
  materialTypeLabel: string
  materialAlias: string
  materialRole: SupplementMaterialRole
  roleSource: SupplementRoleSource
  roleConfirmStatus: SupplementRoleConfirmStatus
  patternId: string
  patternName: string
  cutOrderNo: string
  line: CuttingMaterialLine
  mappingLine?: TechnicalColorMaterialMappingLine
  bomItem?: TechPackBomItemSnapshot
}

export interface SupplementAbAnalysisRow {
  key: string
  skuCode: string
  color: string
  size: string
  plannedQty: number
  benchmarkMaterial: SupplementMaterialPatternRef
  shortageMaterial: SupplementMaterialPatternRef
  benchmarkCutQty: number
  currentRoleCutQty: number
  differenceQty: number
  shortageQty: number
  existingSupplementQty: number
  suggestedSupplementQty: number
  relatedCutOrderNos: string[]
  roleConfirmStatus: SupplementRoleConfirmStatus
}

export interface SupplementLine extends SupplementSizeColorRow {
  supplementQty: number
  basis: SupplementAbAnalysisRow
  isManualAdjusted: boolean
  adjustReason: string
  actualMissingPieceQty?: number
  piecesPerGarment?: number
}

export interface SupplementDraft {
  candidateId: string
  sourceType: SupplementSourceType
  sourceNo: string
  productionOrderId: string
  productionOrderNo: string
  styleName: string
  spuCode: string
  styleImageUrl?: string
  styleImageAlt?: string
  reason: string
  reasonDetail: string
  lines: SupplementLine[]
  materialDemands: SupplementMaterialDemand[]
  supplyRiskConfirmed?: boolean
  confirmationIdentity?: string
  releaseSnapshotId?: string
  releaseMatrixVersion?: number
  releaseTargetConfirmedAt?: string
}

interface SupplementFilters {
  sourceType: SupplementFilterSourceType
  keyword: string
  recordNo: string
  productionOrderNo: string
  cutOrderNo: string
  styleKeyword: string
  status: 'ALL' | '未完成' | '已完成'
  purchase: 'ALL' | '需要' | '不需要'
  dye: 'ALL' | '需要' | '不需要'
  print: 'ALL' | '需要' | '不需要'
  currentNode: string
  createdDate: string
}

interface SupplementSourcePickerState {
  sourceType: SupplementManualSourceType
  keyword: string
  selectedCandidateId: string
}

interface SupplementFeedback {
  tone: 'success' | 'warning'
  message: string
}

interface SupplementCandidate {
  id: string
  sourceType: SupplementManualSourceType
  record: CuttingOrderProgressRecord
  sourceNo: string
  sourceTitle: string
  sourceSubtitle: string
  materialLines: CuttingMaterialLine[]
  materialPatternRefs: SupplementMaterialPatternRef[]
  sizeColorRows: SupplementSizeColorRow[]
  abAnalysisRows: SupplementAbAnalysisRow[]
  canInitiate: boolean
  blockedReason: string
}

export type {
  SupplementMaterialDemand,
  SupplementProcessWorkOrderRef,
  SupplementOrderLifecycle,
} from '../../../data/fcs/cutting/supplement-order-registry.ts'

interface SupplementProcessLink {
  kind: SupplementProcessKind
  workOrderId: string
  workOrderNo: string
  materialSku: string
  materialName: string
  materialImageUrl: string
  requiredQty: number
  unit: string
  workOrderStatus: string
  factoryName: string
  createdAt: string
  linkedProductionOrderNo: string
  processNote: string
  sourceLabel: (typeof PROCESS_WORK_ORDER_SOURCE_LABEL)['CUT_PIECE_SUPPLEMENT']
  supplementRecordNo: string
  originalCutOrderNo: string
  techPackVersionLabel: string
}

interface SupplementManagementState {
  filters: SupplementFilters
  sourcePicker: SupplementSourcePickerState
  activeCandidateId: string
  activeRecordId: string
  pendingConfirmDraft: SupplementDraft | null
  confirmStepActive: boolean
  releaseSnapshotDraft: SupplementDraft | null
  releaseSnapshotError: string
  creationSourceKey: string
  records: SupplementOrderLifecycle[]
  feedback: SupplementFeedback | null
  page: number
  sort: StandardListSortState | null
  columnPreferences: StandardListColumnPreferences
  columnSettingsOpen: boolean
  draggedColumnKey: string
  imagePreview: { src: string; alt: string } | null
}

const supplementListPageSizes = [10, 20, 50]
const supplementListStorageKey = 'higood:list-page:/fcs/craft/cutting/supplement-management'
const supplementListMaxFrozenWidth = 520
const supplementListColumnRules: StandardListColumnRule[] = [
  { key: 'recordNo', required: true, freezeable: true },
  { key: 'target', required: true, freezeable: true },
  { key: 'supplementQty', freezeable: true },
  { key: 'materialDemand' },
  { key: 'inventory' },
  { key: 'purchase' },
  { key: 'dye' },
  { key: 'print' },
  { key: 'materialPrep', required: true, freezeable: true },
  { key: 'status', freezeable: true },
  { key: 'created', freezeable: true },
  { key: 'actions', required: true, actionColumn: true },
]
const defaultSupplementListColumnPreferences: StandardListColumnPreferences = {
  order: supplementListColumnRules.map((column) => column.key),
  visibleKeys: supplementListColumnRules.map((column) => column.key),
  frozenKeys: [],
  pageSize: 10,
}

const state: SupplementManagementState = {
  filters: {
    sourceType: 'ALL',
    keyword: '',
    recordNo: '', productionOrderNo: '', cutOrderNo: '', styleKeyword: '',
    status: 'ALL', purchase: 'ALL', dye: 'ALL', print: 'ALL', currentNode: '', createdDate: '',
  },
  sourcePicker: {
    sourceType: 'production-order',
    keyword: '',
    selectedCandidateId: '',
  },
  activeCandidateId: '',
  activeRecordId: '',
  pendingConfirmDraft: null,
  confirmStepActive: false,
  releaseSnapshotDraft: null,
  releaseSnapshotError: '',
  creationSourceKey: '',
  records: [],
  feedback: null,
  page: 1,
  sort: null,
  columnPreferences: normalizeListColumnPreferences(
    supplementListColumnRules,
    defaultSupplementListColumnPreferences,
    supplementListPageSizes,
  ),
  columnSettingsOpen: false,
  draggedColumnKey: '',
  imagePreview: null,
}

let mockSupplementOrdersSeeded = false
let supplementListPreferencesLoaded = false

interface ReleaseSnapshotDraftFixture {
  releaseRecords: CutPieceReleaseRecord[]
  frozenTechPack: ProductionOrderTechPackSnapshot
}

let releaseSnapshotDraftFixtureForTest: ReleaseSnapshotDraftFixture | null = null

export function setReleaseSnapshotDraftFixtureForTest(fixture: ReleaseSnapshotDraftFixture | null): void {
  releaseSnapshotDraftFixtureForTest = fixture ? structuredClone(fixture) : null
  state.releaseSnapshotDraft = null
  state.releaseSnapshotError = ''
}

const sourceTypeLabels: Record<SupplementSourceType, string> = {
  'production-order': '生产单',
  'cut-order': '裁片单',
  'release-snapshot': '裁片放行目标快照',
}

const supplementManagementPath = '/fcs/craft/cutting/supplement-management'
const supplementCreatePath = `${supplementManagementPath}?mode=create`

const numberFormatter = new Intl.NumberFormat('zh-CN')

function formatInteger(value: number): string {
  return numberFormatter.format(Math.max(Math.round(Number(value || 0)), 0))
}

function formatDecimal(value: number, digits = 1): string {
  const rounded = Number(Number(value || 0).toFixed(digits))
  return numberFormatter.format(rounded)
}

function normalizeText(value: unknown): string {
  return String(value ?? '').trim()
}

function isSupplementCreateMode(): boolean {
  const currentPath = getSupplementLocationPath()
  const query = currentPath.split('?')[1] ?? ''
  return new URLSearchParams(query).get('mode') === 'create'
}

function getSupplementLocationPath(): string {
  const browserPath = typeof window !== 'undefined'
    ? `${window.location.pathname}${window.location.search}`
    : ''
  if (browserPath.startsWith(supplementManagementPath)) return browserPath
  return appStore.getState().pathname || ''
}

function getReleaseSnapshotIdFromLocation(): string {
  const query = getSupplementLocationPath().split('?')[1] ?? ''
  return parseReleaseSnapshotIdFromSearch(query)
}

export function parseReleaseSnapshotIdFromSearch(search: string): string {
  return new URLSearchParams(search).getAll('releaseSnapshotId')
    .map((value) => value.trim())
    .find(Boolean) || ''
}

function isClosedRecord(record: CuttingOrderProgressRecord): boolean {
  return record.cuttingStage === '已关闭' || Boolean(record.closedAt || record.closeReason)
}

function getCutOrderNo(line: CuttingMaterialLine): string {
  return line.cutOrderNo || line.cutPieceOrderNo || line.cutOrderId || ''
}

function getCutOrderId(line: CuttingMaterialLine): string {
  return line.cutOrderId || line.cutOrderNo || line.cutPieceOrderNo || ''
}

function makeSizeColorKey(row: Pick<CuttingSkuRequirementLine, 'skuCode' | 'color' | 'size'>): string {
  return [row.skuCode, row.color, row.size].map((item) => normalizeText(item)).join('::')
}

function makeCandidateId(sourceType: SupplementManualSourceType, record: CuttingOrderProgressRecord, cutOrderNo = ''): string {
  return `${sourceType}:${record.id}:${cutOrderNo}`
}

function formatMaterialType(line: CuttingMaterialLine): string {
  if (line.materialType === 'PRINT') return '印花面料'
  if (line.materialType === 'DYE') return '染色面料'
  if (line.materialType === 'LINING') return '里布'
  return line.materialCategory || '面料'
}

function hasProcessRequirement(value: unknown): boolean {
  const text = normalizeText(value)
  if (!text) return false
  return !['无', '否', '不需要', 'NONE', 'N/A', '-'].includes(text.toUpperCase())
}

function normalizeLossRate(value: number | undefined): number {
  const raw = Number(value || 0)
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return raw > 1 ? raw / 100 : raw
}

function getMaterialName(line: CuttingMaterialLine): string {
  return (
    normalizeText(line.materialIdentity?.materialName) ||
    normalizeText(line.materialLabel) ||
    normalizeText(line.materialAlias) ||
    line.materialSku
  )
}

function getSpuImageUrl(record: Pick<CuttingOrderProgressRecord, 'spuImageUrl' | 'styleName' | 'spuCode'>): string {
  const existing = normalizeText(record.spuImageUrl)
  if (existing && !existing.includes('placeholder') && !existing.startsWith('data:image/svg')) return existing
  const imageBySpu: Record<string, string> = {
    ASYSA26060310: '/tshirt-sample.jpg',
    'SPU-2024-010': '/pants-sample.jpg',
    'SPU-2024-005': '/jacket-sample.jpg',
    'SPU-2024-009': '/shirt-sample.jpg',
    'SPU-2024-017': '/denim-shorts-sample.jpg',
    'SPU-SHIRT-086': '/shirt-sample.jpg',
    'SPU-DRESS-083': '/dress-sample-1.jpg',
    'SPU-TEE-084': '/tshirt-sample.jpg',
  }
  return imageBySpu[normalizeText(record.spuCode)] || ''
}

function getMaterialImageUrl(line: CuttingMaterialLine): string {
  const existing = normalizeText(line.materialImageUrl || line.materialIdentity?.materialImageUrl)
  if (existing && !existing.includes('placeholder') && !existing.startsWith('data:image/svg')) return existing
  const explicitImageByIdentity: Record<string, string> = {
    'RELEASE-A': '/materials/fabric-main.jpg',
    'RELEASE-B': '/materials/fabric-contrast.jpg',
    'RELEASE-C': '/materials/fabric-lining.jpg',
    'RELEASE-D': '/materials/accessory-label.jpg',
  }
  if (explicitImageByIdentity[line.materialSku]) return explicitImageByIdentity[line.materialSku]
  const explicitImageByMaterialType: Partial<Record<CuttingMaterialLine['materialType'], string>> = {
    SOLID: '/materials/fabric-main.jpg',
    DYE: '/materials/fabric-main.jpg',
    PRINT: '/materials/fabric-contrast.jpg',
    LINING: '/materials/fabric-lining.jpg',
  }
  return explicitImageByMaterialType[line.materialType] || ''
}

function renderSupplementBusinessImage(src: string, alt: string, className: string, preview = true): string {
  if (!src) return `<span class="${className} flex items-center justify-center rounded border bg-muted px-1 text-center text-[9px] text-muted-foreground">图片未提供</span>`
  const content = `<img class="h-full w-full object-cover" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" data-business-image onload="this.nextElementSibling.classList.add('hidden')" onerror="this.classList.add('hidden');this.nextElementSibling.textContent='图片加载失败'"><span class="absolute inset-0 flex items-center justify-center bg-muted px-1 text-center text-[9px] text-muted-foreground">图片加载中</span>`
  return preview
    ? `<button type="button" class="relative ${className} overflow-hidden rounded border bg-muted" data-cutting-supplement-action="open-image-preview" data-image-preview-src="${escapeHtml(src)}" data-image-preview-alt="${escapeHtml(alt)}">${content}</button>`
    : `<span class="relative ${className} block overflow-hidden rounded border bg-muted">${content}</span>`
}

type MappingLineWithSupplementRole = TechnicalColorMaterialMappingLine & {
  materialAlias?: string
  materialRole?: SupplementMaterialRole
}

const aliasRoleRules: Array<{ role: SupplementMaterialRole; keywords: string[] }> = [
  { role: '面料A', keywords: ['面料A', '物料A', '主面料', '主身面料', '大身面料', 'main fabric', '选择 A', '组合组 A'] },
  { role: '面料B', keywords: ['面料B', '物料B', '拼接面料', '配色面料', '撞色面料', '口袋布', 'contrast fabric', '选择 B', '组合组 B'] },
  { role: '面料C', keywords: ['面料C', '物料C', '第三面料', '选择 C', '组合组 C'] },
  { role: '里布', keywords: ['里布', 'lining'] },
  { role: '衬', keywords: ['衬布', '衬', 'interlining'] },
  { role: '罗纹', keywords: ['罗纹', '螺纹', 'rib'] },
  { role: '辅料', keywords: ['纽扣', '拉链', '辅料', 'button', 'zipper'] },
  { role: '包材', keywords: ['包装', '包材', 'packing'] },
]

const inferredFabricRoles: SupplementMaterialRole[] = ['面料A', '面料B', '面料C']

function textIncludes(text: string, keyword: string): boolean {
  return text.toLowerCase().includes(keyword.toLowerCase())
}

function matchAliasRole(text: string): SupplementMaterialRole | null {
  const normalized = normalizeText(text)
  if (!normalized) return null
  if (/(^|[^a-z0-9])a([^a-z0-9]|$)/i.test(normalized)) return '面料A'
  if (/(^|[^a-z0-9])b([^a-z0-9]|$)/i.test(normalized)) return '面料B'
  if (/(^|[^a-z0-9])c([^a-z0-9]|$)/i.test(normalized)) return '面料C'
  return aliasRoleRules.find((rule) => rule.keywords.some((keyword) => textIncludes(normalized, keyword)))?.role || null
}

function resolveSupplementMaterialRole(options: {
  mappingLine?: TechnicalColorMaterialMappingLine
  materialLine: CuttingMaterialLine
  bomItem?: TechPackBomItemSnapshot
  sequence: number
}): { role: SupplementMaterialRole; source: SupplementRoleSource; confirmStatus: SupplementRoleConfirmStatus; alias: string } {
  const mappingLine = options.mappingLine as MappingLineWithSupplementRole | undefined
  const mappingAlias = normalizeText(mappingLine?.materialAlias || mappingLine?.note)
  const inheritedAlias = normalizeText(options.materialLine.materialAlias || options.materialLine.materialIdentity?.materialAlias || options.bomItem?.materialAlias)
  const explicitMappingRole = mappingLine?.materialRole

  if (explicitMappingRole && explicitMappingRole !== '未识别') {
    return { role: explicitMappingRole, source: '物料-纸样关联别名', confirmStatus: '已确认', alias: mappingAlias || explicitMappingRole }
  }

  const mappingAliasRole = matchAliasRole(mappingAlias)
  if (mappingAliasRole) {
    return { role: mappingAliasRole, source: '物料-纸样关联别名', confirmStatus: '已确认', alias: mappingAlias }
  }

  const patternText = [
    options.materialLine.patternIdentity?.patternFileName,
    mappingLine?.patternName,
    mappingLine?.pieceName,
  ].filter(Boolean).join(' / ')
  const patternRole = matchAliasRole(patternText)
  if (patternRole) {
    return { role: patternRole, source: '纸样辅助识别', confirmStatus: '待确认', alias: inheritedAlias || patternText }
  }

  const inheritedAliasRole = matchAliasRole(inheritedAlias)
  if (inheritedAliasRole) {
    return { role: inheritedAliasRole, source: '物料行继承别名', confirmStatus: '已确认', alias: inheritedAlias }
  }

  const materialTypeText = `${options.materialLine.materialType} ${options.materialLine.materialCategory || ''} ${mappingLine?.materialType || ''}`
  if (textIncludes(materialTypeText, '面料') || options.materialLine.materialType === 'SOLID' || options.materialLine.materialType === 'PRINT' || options.materialLine.materialType === 'DYE') {
    return {
      role: inferredFabricRoles[options.sequence] || '未识别',
      source: inferredFabricRoles[options.sequence] ? '顺序推断' : '未识别',
      confirmStatus: '待确认',
      alias: inheritedAlias || `顺序推断 ${options.sequence + 1}`,
    }
  }

  return { role: '未识别', source: '未识别', confirmStatus: '待确认', alias: inheritedAlias || '未维护别名' }
}

function findMappingLine(
  mappings: TechnicalColorMaterialMappingLine[],
  materialLine: CuttingMaterialLine,
): TechnicalColorMaterialMappingLine | undefined {
  return findMappingLines(mappings, materialLine)[0]
}

function findMappingLines(
  mappings: TechnicalColorMaterialMappingLine[],
  materialLine: CuttingMaterialLine,
): TechnicalColorMaterialMappingLine[] {
  const materialSku = materialLine.materialSku.toLowerCase()
  const materialName = getMaterialName(materialLine).toLowerCase()
  const patternId = normalizeText(materialLine.patternIdentity?.patternFileId).toLowerCase()
  const patternName = normalizeText(materialLine.patternIdentity?.patternFileName).toLowerCase()
  const matched = mappings.filter((line) => {
    const code = normalizeText(line.materialCode).toLowerCase()
    const name = normalizeText(line.materialName).toLowerCase()
    return Boolean(code && code === materialSku) || Boolean(name && (name === materialName || materialName.includes(name)))
  })
  const patternMatched = matched.filter((line) => {
    const linePatternId = normalizeText(line.patternId).toLowerCase()
    const linePatternName = normalizeText(line.patternName).toLowerCase()
    return Boolean(patternId && linePatternId && patternId === linePatternId) || Boolean(patternName && linePatternName && (linePatternName === patternName || patternName.includes(linePatternName)))
  })
  return patternMatched.length ? patternMatched : matched
}

function enrichMappingLineWithSupplementAlias(
  mappingLine: TechnicalColorMaterialMappingLine,
  sequence: number,
): MappingLineWithSupplementRole {
  const enriched = mappingLine as MappingLineWithSupplementRole
  if (normalizeText(enriched.materialAlias || enriched.note) || enriched.materialRole) return enriched
  if (mappingLine.materialType !== '面料') return enriched
  const role = inferredFabricRoles[sequence % inferredFabricRoles.length]
  return {
    ...mappingLine,
    materialAlias: role.replace('面料', ''),
    materialRole: role,
  }
}

function findBomItem(
  bomItems: TechPackBomItemSnapshot[],
  mappings: TechnicalColorMaterialMappingLine[],
  materialLine: CuttingMaterialLine,
): TechPackBomItemSnapshot | undefined {
  const mapping = findMappingLine(mappings, materialLine)
  if (mapping?.bomItemId) {
    const byMapping = bomItems.find((item) => item.id === mapping.bomItemId)
    if (byMapping) return byMapping
  }
  const materialName = getMaterialName(materialLine).toLowerCase()
  return bomItems.find((item) => {
    const itemName = normalizeText(item.name).toLowerCase()
    return Boolean(itemName && (itemName === materialName || materialName.includes(itemName) || itemName.includes(materialName)))
  })
}

function shouldUseYard(line: CuttingMaterialLine, bomItem?: TechPackBomItemSnapshot): boolean {
  const text = `${line.materialType} ${line.materialCategory || ''} ${bomItem?.type || ''} ${bomItem?.spec || ''}`.toLowerCase()
  return line.materialType === 'PRINT' || line.materialType === 'DYE' || line.materialType === 'SOLID' || line.materialType === 'LINING' || text.includes('fabric') || text.includes('面料') || text.includes('里布')
}

function makeMaterialPatternMappingId(
  snapshotVersionId: string,
  materialLine: CuttingMaterialLine,
  mappingLine?: TechnicalColorMaterialMappingLine,
): string {
  return mappingLine?.id || [
    snapshotVersionId,
    materialLine.materialSku,
    materialLine.patternIdentity?.patternFileId || materialLine.patternIdentity?.patternFileName || 'pattern-pending',
    getCutOrderNo(materialLine),
  ].map((item) => normalizeText(item).replace(/\s+/g, '-')).join('::')
}

function buildMaterialPatternRefs(record: CuttingOrderProgressRecord, materialLines: CuttingMaterialLine[]): SupplementMaterialPatternRef[] {
  const snapshot = getProductionOrderTechPackSnapshot(record.productionOrderId)
  const snapshotVersionId = snapshot?.sourceTechPackVersionId || snapshot?.sourceTechPackVersionCode || snapshot?.versionLabel || record.productionOrderId
  const mappingLines = snapshot?.colorMaterialMappings.flatMap((mapping) => mapping.lines) || []
  const bomItems = snapshot?.bomItems || []

  return materialLines.flatMap((materialLine, materialIndex) => {
    const matchedMappings = findMappingLines(mappingLines, materialLine)
    const sourceMappings = matchedMappings.length ? matchedMappings : [undefined]
    const bomItem = findBomItem(bomItems, mappingLines, materialLine)

    return sourceMappings.map((rawMappingLine, mappingIndex) => {
      const mappingLine = rawMappingLine ? enrichMappingLineWithSupplementAlias(rawMappingLine, mappingIndex) : undefined
      const role = resolveSupplementMaterialRole({ mappingLine, materialLine, bomItem, sequence: materialIndex + mappingIndex })
      return {
        materialPatternMappingId: makeMaterialPatternMappingId(snapshotVersionId, materialLine, mappingLine),
        techPackVersionId: snapshotVersionId,
        materialSku: materialLine.materialSku,
        materialName: getMaterialName(materialLine),
        materialImageUrl: getMaterialImageUrl(materialLine),
        materialTypeLabel: mappingLine?.materialType || formatMaterialType(materialLine),
        materialAlias: role.alias,
        materialRole: role.role,
        roleSource: role.source,
        roleConfirmStatus: role.confirmStatus,
        patternId: mappingLine?.pieceId || mappingLine?.patternId || materialLine.patternIdentity?.patternFileId || '',
        patternName: mappingLine?.pieceName || mappingLine?.patternName || materialLine.patternIdentity?.patternFileName || '未关联纸样',
        cutOrderNo: getCutOrderNo(materialLine),
        line: materialLine,
        mappingLine,
        bomItem,
      }
    })
  })
}

function materialRefAppliesToSizeColor(ref: SupplementMaterialPatternRef, row: Pick<SupplementSizeColorRow, 'key'>): boolean {
  const scopedKeys = new Set((ref.line.skuScopeLines || []).map(makeSizeColorKey))
  return scopedKeys.size === 0 || scopedKeys.has(row.key)
}

function getMaterialRefActualGarmentQty(ref: SupplementMaterialPatternRef, row: Pick<SupplementSizeColorRow, 'skuCode' | 'color' | 'size' | 'plannedQty' | 'completeSetQty'>): number {
  const mappingPieceId = normalizeText(ref.mappingLine?.pieceId).toLowerCase()
  const mappingPieceName = normalizeText(ref.mappingLine?.pieceName).toLowerCase()
  const progressRows = (ref.line.pieceProgressLines || []).filter((piece) => {
    if (piece.skuCode !== row.skuCode || piece.color !== row.color || piece.size !== row.size) return false
    const partCode = normalizeText(piece.partCode).toLowerCase()
    const partName = normalizeText(piece.partName).toLowerCase()
    if (!mappingPieceId && !mappingPieceName) return true
    return Boolean(mappingPieceId && partCode === mappingPieceId) || Boolean(mappingPieceName && (partName === mappingPieceName || partName.includes(mappingPieceName)))
  })
  if (progressRows.length) {
    const pieceCount = Math.max(Number(ref.mappingLine?.pieceCountPerUnit || progressRows.length || 1), 1)
    const actualPieces = progressRows.reduce((sum, piece) => sum + Number(piece.actualCutQty || 0), 0)
    const actualGarments = Math.floor(actualPieces / pieceCount)
    if (ref.materialRole === '面料B') {
      const sizeGapMap: Record<string, number> = { S: 45, M: 30, L: -20, XL: -20 }
      const gap = sizeGapMap[row.size] ?? Math.max(Math.round(actualGarments * 0.08), 12)
      return Math.max(actualGarments - gap, 0)
    }
    if (ref.materialRole === '面料C') return Math.max(actualGarments - Math.max(Math.round(actualGarments * 0.05), 8), 0)
    return actualGarments
  }

  const benchmark = Math.max(Number(row.completeSetQty || 0), Math.round(Number(row.plannedQty || 0) * 0.92))
  if (ref.materialRole === '面料A') return benchmark
  if (ref.materialRole === '面料B') {
    const sizeGapMap: Record<string, number> = { S: 45, M: 30, L: -20, XL: -20 }
    const gap = sizeGapMap[row.size] ?? Math.max(Math.round(benchmark * 0.08), 12)
    return Math.max(benchmark - gap, 0)
  }
  if (ref.materialRole === '面料C') return Math.max(benchmark - Math.max(Math.round(benchmark * 0.05), 8), 0)
  return benchmark
}

function asDraftLine(line: SupplementOrderLifecycle['lines'][number]): SupplementLine {
  return line as SupplementLine
}

function getExistingSupplementQtyForBasis(record: CuttingOrderProgressRecord, row: Pick<SupplementAbAnalysisRow, 'skuCode' | 'color' | 'size' | 'shortageMaterial'>): number {
  return state.records
    .filter((item) => item.productionOrderId === record.productionOrderId)
    .flatMap((item) => item.lines)
    .filter((line): line is SupplementLine => Boolean(asDraftLine(line).basis?.shortageMaterial))
    .filter((line) =>
      line.skuCode === row.skuCode &&
      line.color === row.color &&
      line.size === row.size &&
      line.basis.shortageMaterial.materialPatternMappingId === row.shortageMaterial.materialPatternMappingId,
    )
    .reduce((sum, line) => sum + Number(line.supplementQty || 0), 0)
}

function getExistingSupplementQty(record: CuttingOrderProgressRecord, row: Pick<SupplementSizeColorRow, 'skuCode' | 'color' | 'size'>): number {
  return state.records
    .filter((item) => item.productionOrderId === record.productionOrderId)
    .flatMap((item) => item.lines)
    .filter((line) =>
      asDraftLine(line).skuCode === row.skuCode && line.color === row.color && line.size === row.size
    )
    .reduce((sum, line) => sum + Number(line.supplementQty || 0), 0)
}

function buildAbAnalysisRows(
  record: CuttingOrderProgressRecord,
  materialRefs: SupplementMaterialPatternRef[],
  sizeColorRows: SupplementSizeColorRow[],
): SupplementAbAnalysisRow[] {
  const rows: SupplementAbAnalysisRow[] = []
  sizeColorRows.forEach((sizeRow) => {
    const refs = materialRefs.filter((ref) =>
      ref.materialRole !== '未识别' &&
      ['面料A', '面料B', '面料C', '里布'].includes(ref.materialRole) &&
      materialRefAppliesToSizeColor(ref, sizeRow),
    )
    if (refs.length < 2) return
    const benchmark = refs.find((ref) => ref.materialRole === '面料A') || refs[0]
    const benchmarkCutQty = getMaterialRefActualGarmentQty(benchmark, sizeRow)
    refs
      .filter((ref) => ref.materialPatternMappingId !== benchmark.materialPatternMappingId)
      .forEach((ref) => {
        const currentRoleCutQty = getMaterialRefActualGarmentQty(ref, sizeRow)
        const differenceQty = currentRoleCutQty - benchmarkCutQty
        const shortageQty = Math.max(benchmarkCutQty - currentRoleCutQty, 0)
        const analysisRowSeed = {
          skuCode: sizeRow.skuCode,
          color: sizeRow.color,
          size: sizeRow.size,
          shortageMaterial: ref,
        }
        const existingSupplementQty = getExistingSupplementQtyForBasis(record, analysisRowSeed)
        const suggestedSupplementQty = Math.max(shortageQty - existingSupplementQty, 0)
        if (shortageQty <= 0 && ref.roleConfirmStatus === '已确认') return
        rows.push({
          key: [
            sizeRow.key,
            benchmark.materialPatternMappingId,
            ref.materialPatternMappingId,
          ].join('::'),
          skuCode: sizeRow.skuCode,
          color: sizeRow.color,
          size: sizeRow.size,
          plannedQty: sizeRow.plannedQty,
          benchmarkMaterial: benchmark,
          shortageMaterial: ref,
          benchmarkCutQty,
          currentRoleCutQty,
          differenceQty,
          shortageQty,
          existingSupplementQty,
          suggestedSupplementQty,
          relatedCutOrderNos: Array.from(new Set([benchmark.cutOrderNo, ref.cutOrderNo, ...sizeRow.relatedCutOrderNos].filter(Boolean))),
          roleConfirmStatus: benchmark.roleConfirmStatus === '待确认' || ref.roleConfirmStatus === '待确认' ? '待确认' : '已确认',
        })
      })
  })

  return rows.sort((left, right) => right.shortageQty - left.shortageQty || left.color.localeCompare(right.color, 'zh-CN') || left.size.localeCompare(right.size, 'zh-CN'))
}

function buildBaseSkuRows(
  record: CuttingOrderProgressRecord,
  sourceType: SupplementManualSourceType,
  materialLines: CuttingMaterialLine[],
): CuttingSkuRequirementLine[] {
  if (sourceType === 'production-order') {
    return (record.skuRequirementLines || []).map((line) => ({ ...line }))
  }

  const grouped = new Map<string, CuttingSkuRequirementLine>()
  materialLines.flatMap((line) => line.skuScopeLines || []).forEach((line) => {
    const key = makeSizeColorKey(line)
    const current = grouped.get(key)
    grouped.set(key, {
      skuCode: line.skuCode,
      color: line.color,
      size: line.size,
      plannedQty: Math.max(Number(current?.plannedQty || 0), Number(line.plannedQty || 0)),
    })
  })
  return Array.from(grouped.values())
}

function buildSizeColorRows(
  record: CuttingOrderProgressRecord,
  sourceType: SupplementManualSourceType,
  materialLines: CuttingMaterialLine[],
): SupplementSizeColorRow[] {
  const cutOrderNos = new Set(materialLines.map(getCutOrderNo).filter(Boolean))
  const truth = buildProductionPieceTruth(record)
  const truthRows = truth.gapRows.filter((row) => sourceType === 'production-order' || cutOrderNos.has(row.cutOrderNo))
  return buildBaseSkuRows(record, sourceType, materialLines).map((line) => {
    const relatedTruthRows = truthRows.filter(
      (row) => row.skuCode === line.skuCode && row.color === line.color && row.size === line.size,
    )
    const actualCutPieces = relatedTruthRows.reduce((sum, row) => sum + Number(row.actualCutQty || 0), 0)
    const inboundPieces = relatedTruthRows.reduce((sum, row) => sum + Number(row.inboundQty || 0), 0)
    const pieceRowsWithUnit = relatedTruthRows.filter((row) => Number(row.pieceCountPerUnit || 0) > 0)
    const completeSetQty = pieceRowsWithUnit.length
      ? Math.min(...pieceRowsWithUnit.map((row) => Math.floor(Number(row.actualCutQty || 0) / Math.max(Number(row.pieceCountPerUnit || 1), 1))))
      : 0
    const inboundSetQty = pieceRowsWithUnit.length
      ? Math.min(...pieceRowsWithUnit.map((row) => Math.floor(Number(row.inboundQty || 0) / Math.max(Number(row.pieceCountPerUnit || 1), 1))))
      : 0
    const shortageQty = Math.max(Number(line.plannedQty || 0) - completeSetQty, 0)
    const existingSupplementQty = getExistingSupplementQty(record, line)

    return {
      key: makeSizeColorKey(line),
      skuCode: line.skuCode,
      color: line.color,
      size: line.size,
      plannedQty: Number(line.plannedQty || 0),
      actualCutPieces,
      inboundPieces,
      completeSetQty,
      inboundSetQty,
      shortageQty,
      existingSupplementQty,
      suggestedSupplementQty: Math.max(shortageQty - existingSupplementQty, 0),
      relatedCutOrderNos: Array.from(new Set(relatedTruthRows.map((row) => row.cutOrderNo).filter(Boolean))),
    }
  })
}

function buildProductionCandidate(record: CuttingOrderProgressRecord): SupplementCandidate {
  const materialLines = record.materialLines
  const sizeColorRows = buildSizeColorRows(record, 'production-order', materialLines)
  const materialPatternRefs = buildMaterialPatternRefs(record, materialLines)
  const canInitiate = !isClosedRecord(record)
  return {
    id: makeCandidateId('production-order', record),
    sourceType: 'production-order',
    record,
    sourceNo: record.productionOrderNo,
    sourceTitle: `生产单 ${record.productionOrderNo}`,
    sourceSubtitle: `关联裁片单 ${new Set(record.materialLines.map(getCutOrderNo).filter(Boolean)).size} 张`,
    materialLines,
    materialPatternRefs,
    sizeColorRows,
    abAnalysisRows: buildAbAnalysisRows(record, materialPatternRefs, sizeColorRows),
    canInitiate,
    blockedReason: canInitiate ? '' : '生产单下裁片链路已关闭，不能新增补料。',
  }
}

function buildCutOrderCandidates(record: CuttingOrderProgressRecord): SupplementCandidate[] {
  const grouped = new Map<string, CuttingMaterialLine[]>()
  record.materialLines.forEach((line) => {
    const cutOrderNo = getCutOrderNo(line)
    if (!cutOrderNo) return
    const current = grouped.get(cutOrderNo) || []
    current.push(line)
    grouped.set(cutOrderNo, current)
  })

  return Array.from(grouped.entries()).map(([cutOrderNo, materialLines]) => {
    const canInitiate = !isClosedRecord(record)
    const sizeColorRows = buildSizeColorRows(record, 'cut-order', materialLines)
    const materialPatternRefs = buildMaterialPatternRefs(record, materialLines)
    return {
      id: makeCandidateId('cut-order', record, cutOrderNo),
      sourceType: 'cut-order',
      record,
      sourceNo: cutOrderNo,
      sourceTitle: `裁片单 ${cutOrderNo}`,
      sourceSubtitle: `生产单 ${record.productionOrderNo}`,
      materialLines,
      materialPatternRefs,
      sizeColorRows,
      abAnalysisRows: buildAbAnalysisRows(record, materialPatternRefs, sizeColorRows),
      canInitiate,
      blockedReason: canInitiate ? '' : '裁片单已关闭，不能新增补料。',
    }
  })
}

function buildCandidates(): SupplementCandidate[] {
  return cuttingOrderProgressRecords.flatMap((record) => [
    buildProductionCandidate(record),
    ...buildCutOrderCandidates(record),
  ])
}

interface ReleaseSnapshotPointIdentity {
  garmentColor: string
  size: string
  materialId: string
  partId: string
}

export function buildReleaseSnapshotPointKeys(points: ReleaseSnapshotPointIdentity[]): string[] {
  return points.map((point) => JSON.stringify([
    point.garmentColor,
    point.size,
    point.materialId,
    point.partId,
  ]))
}

function makeReleaseSnapshotPointKey(point: ReleaseSnapshotPointIdentity): string {
  return buildReleaseSnapshotPointKeys([point])[0]
}

function displayReleaseMaterialName(materialId: string, materialName: string): string {
  const seededNames: Record<string, string> = {
    A: '面料 A · 净色',
    B: '面料 B · 白色条',
    C: '面料 C · 兰色条',
    D: '面料 D · 灰色条',
  }
  return seededNames[materialId] || materialName
}

function buildReleaseSnapshotMaterialRef(
  shortage: SupplementPartShortage,
  input: {
    techPackVersionId: string
    bomItem?: TechPackBomItemSnapshot
    originalCutOrderId: string
    originalCutOrderNo: string
  },
): SupplementMaterialPatternRef {
  const materialName = displayReleaseMaterialName(shortage.materialId, shortage.materialName)
  const materialRole: SupplementMaterialRole = ['A', 'B', 'C'].includes(shortage.materialId)
    ? (`面料${shortage.materialId}` as SupplementMaterialRole)
    : shortage.materialId === 'D' ? '辅料' : '未识别'
  const materialLine: CuttingMaterialLine = {
    cutOrderId: input.originalCutOrderId,
    cutPieceOrderNo: input.originalCutOrderNo,
    materialSku: `RELEASE-${shortage.materialId}`,
    materialType: 'SOLID',
    materialLabel: materialName,
    materialAlias: shortage.materialId,
    materialCategory: materialRole === '辅料' ? '辅料' : '面料',
    reviewStatus: 'APPROVED',
    configStatus: 'CONFIGURED',
    receiveStatus: 'RECEIVED',
    configuredRollCount: 0,
    configuredLength: 0,
    receivedRollCount: 0,
    receivedLength: 0,
    printSlipStatus: 'PRINTED',
    qrStatus: 'GENERATED',
    issueFlags: [],
    latestActionText: '来自裁片放行目标快照',
  }
  return {
    materialPatternMappingId: `release:${makeReleaseSnapshotPointKey(shortage)}`,
    techPackVersionId: input.techPackVersionId,
    materialSku: materialLine.materialSku,
    materialName,
    materialImageUrl: getMaterialImageUrl(materialLine),
    materialTypeLabel: materialRole === '辅料' ? '辅料裁片' : '面料裁片',
    materialAlias: shortage.materialId,
    materialRole,
    roleSource: '物料行继承别名',
    roleConfirmStatus: '已确认',
    patternId: shortage.partId,
    patternName: shortage.partName,
    cutOrderNo: input.originalCutOrderNo,
    line: materialLine,
    bomItem: input.bomItem,
  }
}

function resolveReleaseSnapshotSourceState(
  materialId: string,
  materialSourceStates: CutPieceReleaseSourceState[],
): CutPieceReleaseSourceState {
  const sources = materialSourceStates.map((source) => ({
    ...source,
    cutOrderId: source.cutOrderId.trim(),
    cutOrderNo: source.cutOrderNo.trim(),
  }))
  if (sources.some((source) => !source.cutOrderId && !source.cutOrderNo)) {
    throw new Error(`放行快照物料 ${materialId} 存在无法识别的原裁片单来源，裁片单 ID 和编号均为空，不能确认补料。`)
  }

  const parents = sources.map((_, index) => index)
  const findRoot = (index: number): number => {
    let root = index
    while (parents[root] !== root) root = parents[root]
    while (parents[index] !== index) {
      const next = parents[index]
      parents[index] = root
      index = next
    }
    return root
  }
  const union = (left: number, right: number): void => {
    const leftRoot = findRoot(left)
    const rightRoot = findRoot(right)
    if (leftRoot !== rightRoot) parents[rightRoot] = leftRoot
  }
  for (let left = 0; left < sources.length; left += 1) {
    for (let right = left + 1; right < sources.length; right += 1) {
      const sameId = Boolean(sources[left].cutOrderId && sources[left].cutOrderId === sources[right].cutOrderId)
      const sameNo = Boolean(sources[left].cutOrderNo && sources[left].cutOrderNo === sources[right].cutOrderNo)
      if (sameId || sameNo) union(left, right)
    }
  }

  const sourceGroups = new Map<number, CutPieceReleaseSourceState[]>()
  sources.forEach((source, index) => {
    const root = findRoot(index)
    sourceGroups.set(root, [...(sourceGroups.get(root) || []), source])
  })
  for (const group of sourceGroups.values()) {
    const nosById = new Map<string, Set<string>>()
    const idsByNo = new Map<string, Set<string>>()
    for (const source of group) {
      if (source.cutOrderId && source.cutOrderNo) {
        nosById.set(source.cutOrderId, new Set([...(nosById.get(source.cutOrderId) || []), source.cutOrderNo]))
        idsByNo.set(source.cutOrderNo, new Set([...(idsByNo.get(source.cutOrderNo) || []), source.cutOrderId]))
      }
    }
    if ([...nosById.values()].some((values) => values.size > 1)) {
      throw new Error(`放行快照物料 ${materialId} 的原裁片单来源身份冲突：同一裁片单 ID 对应多个编号，不能确认补料。`)
    }
    if ([...idsByNo.values()].some((values) => values.size > 1)) {
      throw new Error(`放行快照物料 ${materialId} 的原裁片单来源身份冲突：同一裁片单编号对应多个 ID，不能确认补料。`)
    }
  }
  if (sourceGroups.size !== 1) {
    throw new Error(`放行快照物料 ${materialId} 必须唯一对应一条原裁片单来源，当前匹配 ${sourceGroups.size} 条，不能确认补料。`)
  }
  const group = [...sourceGroups.values()][0]
  const resolvedCutOrderId = group.find((source) => source.cutOrderId)?.cutOrderId || ''
  const resolvedCutOrderNo = group.find((source) => source.cutOrderNo)?.cutOrderNo || ''
  const earliest = group
    .slice()
    .sort((left, right) => (
      left.changedAt.localeCompare(right.changedAt)
      || left.cutOrderId.localeCompare(right.cutOrderId)
      || left.cutOrderNo.localeCompare(right.cutOrderNo)
      || left.status.localeCompare(right.status)
      || left.operator.localeCompare(right.operator)
      || left.reason.localeCompare(right.reason)
    ))[0]
  return { ...earliest, cutOrderId: resolvedCutOrderId, cutOrderNo: resolvedCutOrderNo }
}

export function resolveReleaseSnapshotSourceStateForTest(
  materialId: string,
  materialSourceStates: CutPieceReleaseSourceState[],
): CutPieceReleaseSourceState {
  return structuredClone(resolveReleaseSnapshotSourceState(materialId, materialSourceStates))
}

function buildReleaseSnapshotDraft(snapshot: CutPieceReleaseTargetSnapshot): SupplementDraft {
  const fixture = releaseSnapshotDraftFixtureForTest
  const releaseRecords = (fixture?.releaseRecords || listCutPieceReleaseRecords())
    .filter((record) => record.productionOrderId === snapshot.productionOrderId)
  const styleRecord = cuttingOrderProgressRecords.find((record) => (
    record.productionOrderId === snapshot.productionOrderId && Boolean(getSpuImageUrl(record))
  ))
  const styleImageUrl = normalizeText(releaseRecords[0]?.styleImageUrl)
    || (styleRecord ? getSpuImageUrl(styleRecord) : '')
  const frozenTechPack = fixture?.frozenTechPack || getProductionOrderTechPackSnapshot(snapshot.productionOrderId)
  const techPackVersionId = frozenTechPack?.sourceTechPackVersionId || ''
  const shortages = buildSupplementPartShortages(snapshot.matrixSnapshot, snapshot.targetPreview)
  const lines: SupplementLine[] = shortages.map((shortage) => {
    const materialSourceStates = releaseRecords
      .flatMap((record) => record.sourceStates)
      .filter((source) => source.materialIds.includes(shortage.materialId))
    const originalCutOrder = resolveReleaseSnapshotSourceState(shortage.materialId, materialSourceStates)
    const bomCandidates = frozenTechPack?.bomItems.filter((item) => item.materialCode === `RELEASE-${shortage.materialId}`) || []
    if (bomCandidates.length !== 1) {
      throw new Error(`放行快照物料 ${shortage.materialId} 必须唯一对应一条冻结 BOM，当前匹配 ${bomCandidates.length} 条，不能确认补料。`)
    }
    const bomItem = bomCandidates[0]
    const materialRef = buildReleaseSnapshotMaterialRef(shortage, {
      techPackVersionId,
      bomItem,
      originalCutOrderId: originalCutOrder?.cutOrderId || '',
      originalCutOrderNo: originalCutOrder?.cutOrderNo || '',
    })
    const key = makeReleaseSnapshotPointKey(shortage)
    const availableGarmentQty = Math.max(shortage.targetQty - shortage.supplementGarmentQty, 0)
    const basis: SupplementAbAnalysisRow = {
      key,
      skuCode: `${snapshot.matrixSnapshot.spuCode}-${shortage.garmentColor}-${shortage.size}`,
      color: shortage.garmentColor,
      size: shortage.size,
      plannedQty: shortage.targetQty,
      benchmarkMaterial: materialRef,
      shortageMaterial: materialRef,
      benchmarkCutQty: shortage.targetQty,
      currentRoleCutQty: availableGarmentQty,
      differenceQty: -shortage.supplementGarmentQty,
      shortageQty: shortage.supplementGarmentQty,
      existingSupplementQty: 0,
      suggestedSupplementQty: shortage.supplementGarmentQty,
      relatedCutOrderNos: [],
      roleConfirmStatus: '已确认',
    }
    return {
      key,
      skuCode: basis.skuCode,
      color: shortage.garmentColor,
      size: shortage.size,
      plannedQty: basis.plannedQty,
      actualCutPieces: shortage.actualPieceQty,
      inboundPieces: 0,
      completeSetQty: availableGarmentQty,
      inboundSetQty: 0,
      shortageQty: shortage.supplementGarmentQty,
      existingSupplementQty: 0,
      suggestedSupplementQty: shortage.supplementGarmentQty,
      relatedCutOrderNos: [],
      supplementQty: shortage.supplementGarmentQty,
      basis,
      isManualAdjusted: false,
      adjustReason: '',
      actualMissingPieceQty: shortage.actualMissingPieceQty,
      piecesPerGarment: shortage.piecesPerGarment,
    }
  })
  const materialDemandMap = new Map<string, SupplementMaterialDemand>()
  lines.forEach((line) => {
    const shortage = line.basis.shortageMaterial
    const originalCutOrderId = shortage.line.cutOrderId || ''
    const originalCutOrderNo = shortage.cutOrderNo
    const aggregateKey = [shortage.materialPatternMappingId, originalCutOrderId, originalCutOrderNo].join('\u0000')
    const existing = materialDemandMap.get(aggregateKey)
    if (existing) {
      existing.requiredQty += line.actualMissingPieceQty || 0
      return
    }
    materialDemandMap.set(aggregateKey, {
      key: `${shortage.materialPatternMappingId}:${originalCutOrderId || originalCutOrderNo}`,
      materialPatternMappingId: shortage.materialPatternMappingId,
      sourceBomItemId: shortage.bomItem?.id || '',
      techPackVersionId,
      materialSku: shortage.materialSku,
      materialName: shortage.materialName,
      materialTypeLabel: shortage.materialTypeLabel,
      materialImageUrl: shortage.materialImageUrl,
      materialAlias: shortage.materialAlias,
      materialRole: shortage.materialRole,
      roleSource: shortage.roleSource,
      roleConfirmStatus: shortage.roleConfirmStatus,
      patternId: shortage.patternId,
      patternName: shortage.patternName,
      requiredQty: line.actualMissingPieceQty || 0,
      unit: '片',
      printRequired: false,
      dyeRequired: false,
      processNote: '按裁片放行目标快照中的实际缺片数量预填',
      originalCutOrderId,
      originalCutOrderNo,
    })
  })
  const materialDemands = [...materialDemandMap.values()]
  return structuredClone({
    candidateId: `release-snapshot:${snapshot.snapshotId}`,
    sourceType: 'release-snapshot',
    sourceNo: snapshot.matrixSnapshot.productionOrderNo,
    productionOrderId: snapshot.productionOrderId,
    productionOrderNo: snapshot.matrixSnapshot.productionOrderNo,
    styleName: releaseRecords[0]?.spuName || snapshot.matrixSnapshot.spuCode,
    spuCode: snapshot.matrixSnapshot.spuCode,
    styleImageUrl,
    styleImageAlt: `${releaseRecords[0]?.spuName || snapshot.matrixSnapshot.spuCode}（${snapshot.matrixSnapshot.spuCode}）款式图`,
    reason: '',
    reasonDetail: '',
    lines,
    materialDemands,
    releaseSnapshotId: snapshot.snapshotId,
    releaseMatrixVersion: snapshot.matrixVersion,
    releaseTargetConfirmedAt: snapshot.confirmedAt,
  })
}

export function buildReleaseSnapshotDraftForTest(snapshot: CutPieceReleaseTargetSnapshot): SupplementDraft {
  return buildReleaseSnapshotDraft(snapshot)
}

interface ReleaseDraftOriginalCutOrder {
  cutOrderId: string
  cutOrderNo: string
}

function listReleaseDraftOriginalCutOrders(draft: SupplementDraft): ReleaseDraftOriginalCutOrder[] {
  return [...new Map(draft.materialDemands.map((demand) => [
    `${demand.originalCutOrderId.trim()}\u0000${demand.originalCutOrderNo.trim()}`,
    { cutOrderId: demand.originalCutOrderId.trim(), cutOrderNo: demand.originalCutOrderNo.trim() },
  ])).values()].sort((left, right) => left.cutOrderNo.localeCompare(right.cutOrderNo) || left.cutOrderId.localeCompare(right.cutOrderId))
}

function scopeReleaseSnapshotDraftToCutOrder(
  draft: SupplementDraft,
  cutOrderIdentity: string,
): SupplementDraft | null {
  const source = listReleaseDraftOriginalCutOrders(draft)
    .find((item) => `${item.cutOrderId}::${item.cutOrderNo}` === cutOrderIdentity)
  if (!source) return null
  const materialDemands = draft.materialDemands.filter((demand) => (
    demand.originalCutOrderId.trim() === source.cutOrderId
    && demand.originalCutOrderNo.trim() === source.cutOrderNo
  ))
  const mappingIds = new Set(materialDemands.map((demand) => demand.materialPatternMappingId.trim()))
  const lines = draft.lines.filter((line) => {
    const shortage = line.basis.shortageMaterial
    return mappingIds.has(shortage.materialPatternMappingId.trim())
      && getCutOrderId(shortage.line) === source.cutOrderId
      && getCutOrderNo(shortage.line) === source.cutOrderNo
  })
  if (!materialDemands.length || !lines.length) return null
  return structuredClone({
    ...draft,
    candidateId: `${draft.candidateId}:cut-order:${source.cutOrderId || source.cutOrderNo}`,
    confirmationIdentity: JSON.stringify({
      releaseSnapshotId: draft.releaseSnapshotId || '',
      originalCutOrderId: source.cutOrderId,
      originalCutOrderNo: source.cutOrderNo,
    }),
    lines,
    materialDemands,
  })
}

function getCurrentReleaseSnapshotOrInvalidate(snapshotId: string): CutPieceReleaseTargetSnapshot | null {
  const snapshot = getCurrentCutPieceReleaseTargetSnapshot(snapshotId)
  if (snapshot) return snapshot
  if (state.releaseSnapshotDraft?.releaseSnapshotId === snapshotId) state.releaseSnapshotDraft = null
  if (state.pendingConfirmDraft?.releaseSnapshotId === snapshotId) {
    state.pendingConfirmDraft = null
    state.confirmStepActive = false
  }
  state.releaseSnapshotError = '目标依据已过期，请回裁片放行重新确认。'
  return null
}

function prepareReleaseSnapshotCreateState(): void {
  const snapshotId = getReleaseSnapshotIdFromLocation()
  const nextCreationSourceKey = snapshotId ? `release:${JSON.stringify(snapshotId)}` : 'manual'
  if (state.creationSourceKey !== nextCreationSourceKey) {
    clearSupplementCreateState()
    state.activeRecordId = ''
    state.columnSettingsOpen = false
    state.creationSourceKey = nextCreationSourceKey
  }
  if (!snapshotId) {
    state.releaseSnapshotDraft = null
    state.releaseSnapshotError = ''
    return
  }
  const snapshot = getCurrentReleaseSnapshotOrInvalidate(snapshotId)
  if (!snapshot) return
  if (state.releaseSnapshotDraft?.releaseSnapshotId === snapshotId) {
    state.releaseSnapshotError = ''
    return
  }
  try {
    state.releaseSnapshotDraft = buildReleaseSnapshotDraft(snapshot)
    state.releaseSnapshotError = ''
  } catch (error) {
    state.releaseSnapshotDraft = null
    state.releaseSnapshotError = error instanceof Error ? error.message : '放行快照物料关系无法唯一解析，不能确认补料。'
  }
}

function getFilteredRecords(): SupplementOrderLifecycle[] {
  const keyword = state.filters.keyword.trim().toLowerCase()
  return state.records
    .filter((record) => state.filters.sourceType === 'ALL' || record.draftMeta.sourceType === state.filters.sourceType)
    .filter((record) => state.filters.status === 'ALL' || record.status === state.filters.status)
    .filter((record) => state.filters.purchase === 'ALL' || (getSupplementNodeOverview(record).purchase === '不需要') !== (state.filters.purchase === '需要'))
    .filter((record) => state.filters.dye === 'ALL' || record.materialDemands.some((item) => item.dyeRequired) === (state.filters.dye === '需要'))
    .filter((record) => state.filters.print === 'ALL' || record.materialDemands.some((item) => item.printRequired) === (state.filters.print === '需要'))
    .filter((record) => !state.filters.currentNode || getSupplementNodeOverview(record).currentNode.includes(state.filters.currentNode))
    .filter((record) => !state.filters.createdDate || record.createdAt.startsWith(state.filters.createdDate))
    .filter((record) => !state.filters.recordNo || record.recordNo.toLowerCase().includes(state.filters.recordNo.toLowerCase()))
    .filter((record) => !state.filters.productionOrderNo || record.productionOrderNo.toLowerCase().includes(state.filters.productionOrderNo.toLowerCase()))
    .filter((record) => !state.filters.cutOrderNo || record.cutOrderNo.toLowerCase().includes(state.filters.cutOrderNo.toLowerCase()))
    .filter((record) => !state.filters.styleKeyword || `${record.draftMeta.styleName} ${record.draftMeta.spuCode}`.toLowerCase().includes(state.filters.styleKeyword.toLowerCase()))
    .filter((record) => {
      if (!keyword) return true
      return [
        record.recordNo,
        record.draftMeta.sourceNo,
        record.productionOrderNo,
        record.draftMeta.styleName,
        record.draftMeta.spuCode,
        record.reason,
        record.reasonDetail,
        record.materialDemands.map((item) => item.materialSku).join(' '),
      ].join(' ').toLowerCase().includes(keyword)
    })
}

function getSourcePickerCandidates(): SupplementCandidate[] {
  const keyword = state.sourcePicker.keyword.trim().toLowerCase()
  return buildCandidates()
    .filter((item) => item.canInitiate)
    .filter((item) => item.sourceType === state.sourcePicker.sourceType)
    .filter((item) => {
      if (!keyword) return true
      return [
        item.sourceNo,
        item.sourceTitle,
        item.sourceSubtitle,
        item.record.productionOrderNo,
        item.record.spuCode,
        item.record.styleName,
        item.materialLines.map((line) => [getCutOrderNo(line), line.materialSku, getMaterialName(line)].join(' ')).join(' '),
      ].join(' ').toLowerCase().includes(keyword)
    })
    .sort((left, right) => right.abAnalysisRows.length - left.abAnalysisRows.length)
    .slice(0, 12)
}

function summarizeCandidate(candidate: SupplementCandidate): {
  plannedQty: number
  completeSetQty: number
  shortageQty: number
  supplementingQty: number
} {
  return candidate.sizeColorRows.reduce(
    (sum, row) => ({
      plannedQty: sum.plannedQty + row.plannedQty,
      completeSetQty: sum.completeSetQty + row.completeSetQty,
      shortageQty: sum.shortageQty + row.shortageQty,
      supplementingQty: sum.supplementingQty + row.existingSupplementQty,
    }),
    { plannedQty: 0, completeSetQty: 0, shortageQty: 0, supplementingQty: 0 },
  )
}

function buildMaterialDemands(_candidate: SupplementCandidate, selectedLines: SupplementLine[]): SupplementMaterialDemand[] {
  const grouped = new Map<string, SupplementMaterialDemand>()

  selectedLines.forEach((line) => {
    const ref = line.basis.shortageMaterial
    const materialLine = ref.line
    const supplementQty = Number(line.supplementQty || 0)
    if (supplementQty <= 0) return

    const bomItem = ref.bomItem
    const unitConsumption = Number(bomItem?.unitConsumption)
    const requiredQty = supplementQty * unitConsumption * (1 + normalizeLossRate(bomItem?.lossRate))
    const unit = normalizeText(bomItem?.unit) || normalizeText(materialLine.materialIdentity?.materialUnit) || normalizeText(materialLine.unit)
    const printRequired = materialLine.materialType === 'PRINT' || hasProcessRequirement(bomItem?.printRequirement)
    const dyeRequired = materialLine.materialType === 'DYE' || hasProcessRequirement(bomItem?.dyeRequirement)
    const key = `${ref.materialPatternMappingId}::${unit}`
    const current = grouped.get(key)

    grouped.set(key, {
      key,
      materialPatternMappingId: ref.materialPatternMappingId,
      sourceBomItemId: bomItem?.id || ref.mappingLine?.bomItemId || '',
      techPackVersionId: ref.techPackVersionId,
      materialSku: ref.materialSku,
      materialName: ref.materialName,
      materialTypeLabel: ref.materialTypeLabel,
      materialImageUrl: ref.materialImageUrl,
      materialImageAlt: `${ref.materialName}（${ref.materialSku}）实物图`,
      materialAlias: ref.materialAlias,
      materialRole: ref.materialRole,
      roleSource: ref.roleSource,
      roleConfirmStatus: ref.roleConfirmStatus,
      patternId: ref.patternId,
      patternName: ref.patternName,
      requiredQty: Number(((current?.requiredQty || 0) + requiredQty).toFixed(2)),
      unit,
      printRequired: Boolean(current?.printRequired || printRequired),
      dyeRequired: Boolean(current?.dyeRequired || dyeRequired),
      processNote: [
        printRequired ? `印花：${normalizeText(bomItem?.printRequirement) || '按技术资料生成印花加工单'}` : '',
        dyeRequired ? `染色：${normalizeText(bomItem?.dyeRequirement) || '按技术资料生成染色加工单'}` : '',
      ].filter(Boolean).join('；') || '无需印花染色',
      originalCutOrderId: current?.originalCutOrderId || getCutOrderId(materialLine),
      originalCutOrderNo: current?.originalCutOrderNo || getCutOrderNo(materialLine),
      color: normalizeText(bomItem?.colorLabel) || normalizeText(materialLine.color),
      spec: normalizeText(bomItem?.spec) || normalizeText(materialLine.spec),
      patternPart: ref.patternName,
    })
  })

  return Array.from(grouped.values())
}

function renderFeedback(): string {
  if (!state.feedback) return ''
  const className = state.feedback.tone === 'success'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
    : 'border-amber-200 bg-amber-50 text-amber-800'
  return `
    <div class="flex items-center justify-between rounded-lg border px-4 py-3 text-sm ${className}">
      <span>${escapeHtml(state.feedback.message)}</span>
      <button type="button" class="rounded px-2 py-1 text-xs hover:bg-black/5" data-skip-page-rerender="true" data-cutting-supplement-action="clear-feedback">关闭</button>
    </div>
  `
}

function renderStatChip(label: string, value: number): string {
  return `
    <span class="inline-flex min-h-10 items-center gap-2 rounded-md border bg-white px-3 py-2 text-sm shadow-sm">
      <span class="text-muted-foreground">${escapeHtml(label)}：</span>
      <span class="font-semibold tabular-nums">${formatInteger(value)}</span>
    </span>
  `
}

function renderFilterControls(): string {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7 lg:items-end" data-supplement-filter-row="primary">
        <label class="space-y-1 text-sm">
          <span class="text-muted-foreground">补料对象</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-cutting-supplement-field="sourceType">
            <option value="ALL"${state.filters.sourceType === 'ALL' ? ' selected' : ''}>全部</option>
            <option value="production-order"${state.filters.sourceType === 'production-order' ? ' selected' : ''}>生产单</option>
            <option value="cut-order"${state.filters.sourceType === 'cut-order' ? ' selected' : ''}>裁片单</option>
            <option value="release-snapshot"${state.filters.sourceType === 'release-snapshot' ? ' selected' : ''}>裁片放行目标快照</option>
          </select>
        </label>
        <label class="space-y-1 text-sm"><span class="text-muted-foreground">主状态</span><select class="h-10 w-full rounded-md border bg-background px-3" data-cutting-supplement-field="status"><option value="ALL">全部</option><option value="未完成"${state.filters.status === '未完成' ? ' selected' : ''}>未完成</option><option value="已完成"${state.filters.status === '已完成' ? ' selected' : ''}>已完成</option></select></label>
        <label class="space-y-1 text-sm"><span class="text-muted-foreground">采购</span><select class="h-10 w-full rounded-md border bg-background px-3" data-cutting-supplement-field="purchase"><option value="ALL">全部</option><option value="需要"${state.filters.purchase === '需要' ? ' selected' : ''}>需要采购</option><option value="不需要"${state.filters.purchase === '不需要' ? ' selected' : ''}>不需要采购</option></select></label>
        <label class="space-y-1 text-sm"><span class="text-muted-foreground">染色</span><select class="h-10 w-full rounded-md border bg-background px-3" data-cutting-supplement-field="dye"><option value="ALL">全部</option><option value="需要"${state.filters.dye === '需要' ? ' selected' : ''}>需要染色</option><option value="不需要"${state.filters.dye === '不需要' ? ' selected' : ''}>不需要染色</option></select></label>
        <label class="space-y-1 text-sm"><span class="text-muted-foreground">印花</span><select class="h-10 w-full rounded-md border bg-background px-3" data-cutting-supplement-field="print"><option value="ALL">全部</option><option value="需要"${state.filters.print === '需要' ? ' selected' : ''}>需要印花</option><option value="不需要"${state.filters.print === '不需要' ? ' selected' : ''}>不需要印花</option></select></label>
        <label class="space-y-1 text-sm"><span class="text-muted-foreground">当前主要节点</span><input class="h-10 w-full rounded-md border bg-background px-3" data-cutting-supplement-field="currentNode" value="${escapeHtml(state.filters.currentNode)}" placeholder="采购、染色、印花、配料" /></label>
        <label class="space-y-1 text-sm"><span class="text-muted-foreground">创建日期</span><input type="date" class="h-10 w-full rounded-md border bg-background px-3" data-cutting-supplement-field="createdDate" value="${escapeHtml(state.filters.createdDate)}" /></label>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7 lg:items-end" data-supplement-filter-row="secondary">
        <label class="space-y-1 text-sm"><span class="text-muted-foreground">补料单号</span><input class="h-10 w-full rounded-md border bg-background px-3" data-cutting-supplement-field="recordNo" value="${escapeHtml(state.filters.recordNo)}" /></label>
        <label class="space-y-1 text-sm"><span class="text-muted-foreground">生产单</span><input class="h-10 w-full rounded-md border bg-background px-3" data-cutting-supplement-field="productionOrderNo" value="${escapeHtml(state.filters.productionOrderNo)}" /></label>
        <label class="space-y-1 text-sm"><span class="text-muted-foreground">原裁片单</span><input class="h-10 w-full rounded-md border bg-background px-3" data-cutting-supplement-field="cutOrderNo" value="${escapeHtml(state.filters.cutOrderNo)}" /></label>
        <label class="space-y-1 text-sm"><span class="text-muted-foreground">款式</span><input class="h-10 w-full rounded-md border bg-background px-3" data-cutting-supplement-field="styleKeyword" value="${escapeHtml(state.filters.styleKeyword)}" placeholder="款名或款号" /></label>
        <label class="space-y-1 text-sm">
          <span class="text-muted-foreground">关键词</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-cutting-supplement-field="keyword" value="${escapeHtml(state.filters.keyword)}" placeholder="补料单、生产单、裁片单、SPU、物料SKU" />
        </label>
        <button type="button" class="h-10 min-w-[72px] rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-skip-page-rerender="true" data-cutting-supplement-action="apply-filters">筛选</button>
        <button type="button" class="h-10 min-w-[72px] rounded-md border px-4 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cutting-supplement-action="reset-filters">重置</button>
      </div>
    </section>
  `
}

function renderFilters(): string {
  return `<div data-cutting-supplement-region="filters">${renderFilterControls()}</div>`
}

function renderSourcePickerPage(): string {
  const allCandidates = buildCandidates().filter((item) => item.canInitiate)
  const productionOrderCount = allCandidates.filter((item) => item.sourceType === 'production-order').length
  const cutOrderCount = allCandidates.filter((item) => item.sourceType === 'cut-order').length
  const candidates = getSourcePickerCandidates()
  const selectedCandidate = candidates.find((candidate) => candidate.id === state.sourcePicker.selectedCandidateId)
  const selectedSourceType = state.sourcePicker.sourceType
  const sourceLabel = sourceTypeLabels[selectedSourceType]
  const sourceColumnLabel = selectedSourceType === 'production-order' ? '生产单' : '裁片单'
  const relatedColumnLabel = selectedSourceType === 'production-order' ? '关联裁片单' : '所属生产单'
  const keywordPlaceholder = selectedSourceType === 'production-order'
    ? '搜索生产单号、款式、SPU、关联裁片单'
    : '搜索裁片单号、生产单号、款式、SPU'
  const rows = candidates.map((candidate) => {
    const summary = summarizeCandidate(candidate)
    const spuImageUrl = getSpuImageUrl(candidate.record)
    const actualCutQty = candidate.abAnalysisRows.reduce((sum, row) => sum + Number(row.currentRoleCutQty || 0), 0)
    const suggestedSupplementQty = candidate.abAnalysisRows.reduce((sum, row) => sum + Number(row.suggestedSupplementQty || 0), 0)
    const isSelected = state.sourcePicker.selectedCandidateId === candidate.id
    const materialImages = candidate.materialLines.slice(0, 4).map((line) =>
      renderSupplementBusinessImage(getMaterialImageUrl(line), `${getMaterialName(line)}（${line.materialSku}）实物图`, 'h-8 w-8', false)
    ).join('')
    const relatedText = selectedSourceType === 'production-order'
      ? Array.from(new Set(candidate.materialLines.map(getCutOrderNo).filter(Boolean))).slice(0, 4).join('、') || '未关联'
      : candidate.record.productionOrderNo
    return `
      <tr class="border-t align-top ${isSelected ? 'bg-blue-50/40' : ''}">
        <td class="w-12 px-4 py-4">
          <input
            class="h-4 w-4 rounded border"
            type="checkbox"
            aria-label="选择${escapeHtml(candidate.sourceTitle)}"
            ${isSelected ? 'checked' : ''}
            data-cutting-supplement-action="toggle-source-candidate"
            data-candidate-id="${escapeHtml(candidate.id)}"
          />
        </td>
        <td class="px-4 py-4">
          <div class="font-semibold">${escapeHtml(candidate.sourceTitle)}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(candidate.sourceSubtitle)}</div>
        </td>
        <td class="px-4 py-4">
          <div class="flex items-start gap-3">
            ${renderSupplementBusinessImage(spuImageUrl, `${candidate.record.styleName}（${candidate.record.spuCode}）款式图`, 'h-14 w-14', false)}
            <div>
              <div class="font-semibold">${escapeHtml(candidate.record.styleName)}</div>
              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(candidate.record.spuCode)} / ${escapeHtml(candidate.record.productionOrderNo)}</div>
              <div class="mt-2 flex flex-wrap gap-1">${materialImages}</div>
            </div>
          </div>
        </td>
        <td class="px-4 py-4 text-sm">
          <div>计划数量：<span class="font-medium tabular-nums">${formatInteger(summary.plannedQty)}</span> 件</div>
          <div>实裁数据：<span class="font-medium tabular-nums">${formatInteger(actualCutQty)}</span> 件</div>
          <div>已发起：<span class="font-medium tabular-nums">${formatInteger(summary.supplementingQty)}</span> 件</div>
          <div>建议补料：<span class="font-medium tabular-nums">${formatInteger(suggestedSupplementQty)}</span> 件</div>
        </td>
        <td class="px-4 py-4 text-sm">
          <div>${escapeHtml(relatedText)}</div>
          <div class="mt-1 text-xs text-muted-foreground">物料 ${formatInteger(candidate.materialLines.length)} 行</div>
        </td>
      </tr>
    `
  }).join('')

  return `
    <section class="space-y-4" data-supplement-source-picker>
      <div class="space-y-4">
        <div class="inline-flex rounded-lg border bg-muted/30 p-1 text-sm">
          <button
            type="button"
            class="rounded-md px-4 py-2 font-medium ${selectedSourceType === 'production-order' ? 'bg-background text-blue-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
            data-cutting-supplement-action="set-source-picker-type"
            data-source-type="production-order"
          >按生产单选择 ${formatInteger(productionOrderCount)}</button>
          <button
            type="button"
            class="rounded-md px-4 py-2 font-medium ${selectedSourceType === 'cut-order' ? 'bg-background text-blue-700 shadow-sm' : 'text-muted-foreground hover:text-foreground'}"
            data-cutting-supplement-action="set-source-picker-type"
            data-source-type="cut-order"
          >按裁片单选择 ${formatInteger(cutOrderCount)}</button>
        </div>
        <div class="grid gap-3 md:grid-cols-[minmax(260px,1fr)_auto_auto] md:items-end">
          <label class="space-y-1 text-sm">
            <span class="text-muted-foreground">${sourceLabel}搜索</span>
            <input class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-cutting-supplement-field="sourcePickerKeyword" value="${escapeHtml(state.sourcePicker.keyword)}" placeholder="${escapeHtml(keywordPlaceholder)}" />
          </label>
          <button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-cutting-supplement-action="apply-source-picker-search">搜索</button>
          <button type="button" class="h-10 rounded-md border px-4 text-sm hover:bg-muted" data-cutting-supplement-action="reset-source-picker-search">重置</button>
        </div>
      </div>
      <div class="overflow-x-auto rounded-lg border bg-card">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-muted/50 text-xs text-muted-foreground">
            <tr>
              <th class="w-12 px-4 py-3 font-medium">选择</th>
              <th class="px-4 py-3 font-medium">${sourceColumnLabel}</th>
              <th class="px-4 py-3 font-medium">款式/SPU</th>
              <th class="px-4 py-3 font-medium">补料参考数据</th>
              <th class="px-4 py-3 font-medium">${relatedColumnLabel}</th>
            </tr>
          </thead>
          <tbody>${rows || `<tr><td class="px-4 py-8 text-center text-muted-foreground" colspan="5">暂无可新增补料的${sourceLabel}。</td></tr>`}</tbody>
        </table>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 px-5 py-4">
        <div class="text-sm text-muted-foreground">
          ${selectedCandidate ? `已选择：${escapeHtml(selectedCandidate.sourceTitle)} / ${escapeHtml(selectedCandidate.record.styleName)}` : `请选择一条${sourceLabel}后进入下一步。`}
        </div>
        <button
          type="button"
          class="rounded-md px-4 py-2 text-sm font-medium ${selectedCandidate ? 'bg-blue-600 text-white hover:bg-blue-700' : 'cursor-not-allowed bg-muted text-muted-foreground'}"
          ${selectedCandidate ? '' : 'disabled'}
          data-cutting-supplement-action="source-picker-next"
        >下一步</button>
      </div>
    </section>
  `
}

function renderReleaseSnapshotTrace(draft: SupplementDraft): string {
  if (!draft.releaseSnapshotId) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-4" data-release-snapshot-trace>
      <div class="font-semibold text-blue-900">来源：裁片放行目标快照</div>
      <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-blue-900">
        <span>快照编号 ${escapeHtml(draft.releaseSnapshotId)}</span>
        <span>目标依据矩阵版本 V${formatInteger(draft.releaseMatrixVersion || 0)}</span>
        <span>目标确认时间 ${escapeHtml(draft.releaseTargetConfirmedAt || '未记录')}</span>
      </div>
    </section>
  `
}

function renderReleaseSnapshotCreatePage(draft: SupplementDraft, editingDraft: SupplementDraft | null = null): string {
  const originalCutOrders = listReleaseDraftOriginalCutOrders(draft)
  const editingOriginalCutOrderIdentity = editingDraft?.materialDemands[0]
    ? `${editingDraft.materialDemands[0].originalCutOrderId}::${editingDraft.materialDemands[0].originalCutOrderNo}`
    : ''
  const rows = draft.lines.map((line) => `
    <tr class="border-t align-top" data-release-snapshot-shortage-row data-release-snapshot-point-key="${escapeHtml(line.key)}">
      <td class="px-3 py-3 font-medium">${escapeHtml(line.color)}</td>
      <td class="px-3 py-3 font-medium">${escapeHtml(line.size)}</td>
      <td class="px-3 py-3 font-medium">${escapeHtml(getCutOrderNo(line.basis.shortageMaterial.line) || '未识别')}</td>
      <td class="px-3 py-3">${escapeHtml(line.basis.shortageMaterial.materialName)}</td>
      <td class="px-3 py-3">${escapeHtml(line.basis.shortageMaterial.patternName)}</td>
      <td class="px-3 py-3 tabular-nums">目标 ${formatInteger(line.basis.benchmarkCutQty)} 件</td>
      <td class="px-3 py-3 font-semibold text-rose-600 tabular-nums">实际缺片 ${formatInteger(line.actualMissingPieceQty || 0)} 片</td>
      <td class="px-3 py-3 font-semibold tabular-nums">建议补料 ${formatInteger(line.supplementQty)} 件</td>
    </tr>
  `).join('')
  return `
    <div class="space-y-4" data-supplement-draft-dialog data-release-snapshot-create>
      ${renderReleaseSnapshotTrace(draft)}
      <section class="rounded-lg border bg-card">
        <div class="border-b px-5 py-4">
          <h2 class="text-lg font-semibold">按放行目标快照新增补料</h2>
          <p class="mt-1 text-sm text-muted-foreground">生产单 ${escapeHtml(draft.productionOrderNo)} · ${escapeHtml(draft.spuCode)} · ${escapeHtml(draft.styleName)}</p>
        </div>
        <div class="space-y-4 p-5">
          ${draft.lines.length ? `
            <label class="block max-w-xl space-y-1 text-sm">
              <span class="font-medium">本次补料对应的原裁片单</span>
              <select class="h-10 w-full rounded-md border bg-background px-3" data-release-original-cut-order>
                ${originalCutOrders.map((item) => {
                  const identity = `${item.cutOrderId}::${item.cutOrderNo}`
                  return `<option value="${escapeHtml(identity)}"${identity === editingOriginalCutOrderIdentity ? ' selected' : ''}>${escapeHtml(item.cutOrderNo)}</option>`
                }).join('')}
              </select>
              <span class="block text-xs text-muted-foreground">一张补料单只对应一张原裁片单；快照涉及多张裁片单时，请分别提交。</span>
            </label>
            <div class="overflow-auto rounded-lg border">
              <table class="min-w-[1080px] text-left text-sm">
                <thead class="bg-muted/50 text-xs text-muted-foreground"><tr>
                  <th class="px-3 py-2 font-medium">颜色</th><th class="px-3 py-2 font-medium">尺码</th>
                  <th class="px-3 py-2 font-medium">原裁片单</th>
                  <th class="px-3 py-2 font-medium">物料</th><th class="px-3 py-2 font-medium">纸样/部位</th>
                  <th class="px-3 py-2 font-medium">目标数量</th><th class="px-3 py-2 font-medium">实际缺片</th>
                  <th class="px-3 py-2 font-medium">建议补料</th>
                </tr></thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            <section class="grid gap-3 md:grid-cols-2">
              <label class="space-y-1 text-sm"><span class="text-muted-foreground">补料原因</span>
                <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-supplement-reason>
                  <option value="">请选择</option><option value="尺码齐套不足"${editingDraft?.reason === '尺码齐套不足' ? ' selected' : ''}>尺码齐套不足</option>
                  <option value="裁片损耗"${editingDraft?.reason === '裁片损耗' ? ' selected' : ''}>裁片损耗</option><option value="验片不良"${editingDraft?.reason === '验片不良' ? ' selected' : ''}>验片不良</option>
                </select>
              </label>
              <label class="space-y-1 text-sm"><span class="text-muted-foreground">补料说明</span>
                <input class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-supplement-reason-detail placeholder="说明本次补料原因" value="${escapeHtml(editingDraft?.reasonDetail || '')}" />
              </label>
            </section>
            <div class="hidden rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" data-supplement-draft-error></div>
          ` : '<div class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-5 text-sm text-emerald-800">该目标快照没有裁片缺口，无需补料。</div>'}
        </div>
        <div class="flex justify-end gap-2 border-t px-5 py-4">
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-cutting-supplement-action="return-independent-create">返回独立创建</button>
          ${draft.lines.length ? '<button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-cutting-supplement-action="submit-release-snapshot-draft">提交补料</button>' : ''}
        </div>
      </section>
    </div>
  `
}

function renderReleaseSnapshotError(): string {
  return `
    <section class="rounded-lg border border-amber-200 bg-amber-50 p-5" data-release-snapshot-error>
      <h2 class="font-semibold text-amber-900">无法读取放行目标快照</h2>
      <p class="mt-2 text-sm text-amber-800">${escapeHtml(state.releaseSnapshotError)}</p>
      <button type="button" class="mt-4 rounded-md border border-amber-300 bg-white px-4 py-2 text-sm" data-cutting-supplement-action="return-independent-create">返回独立创建</button>
    </section>
  `
}

function renderMaterialAliasInfo(item: Pick<SupplementMaterialPatternRef | SupplementMaterialDemand, 'materialRole' | 'materialAlias'>): string {
  const className = item.materialRole === '面料A'
    ? 'bg-blue-50 text-blue-700'
    : item.materialRole === '面料B'
      ? 'bg-amber-50 text-amber-700'
      : item.materialRole === '未识别'
        ? 'bg-zinc-100 text-zinc-600'
        : 'bg-emerald-50 text-emerald-700'
  return `
    <div class="space-y-1">
      <span class="inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}">${escapeHtml(item.materialRole)}</span>
      <div class="text-xs text-muted-foreground">技术包别名：${escapeHtml(item.materialAlias || item.materialRole)}</div>
    </div>
  `
}

function renderSupplementMaterialInfo(ref: Pick<SupplementMaterialPatternRef | SupplementMaterialDemand, 'materialImageUrl' | 'materialName' | 'materialSku'>): string {
  return `
    <div class="min-w-[230px]">
      <div class="flex items-start gap-2">
        ${renderSupplementBusinessImage(ref.materialImageUrl, `${ref.materialName}（${ref.materialSku}）实物图`, 'h-10 w-10')}
        <div class="min-w-0">
          <div class="truncate font-medium">${escapeHtml(ref.materialName || '未命名物料')}</div>
          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(ref.materialSku || '未维护编码')}</div>
        </div>
      </div>
    </div>
  `
}

function renderSupplementPatternInfo(ref: Pick<SupplementMaterialPatternRef | SupplementMaterialDemand, 'techPackVersionId' | 'patternName'>): string {
  return `
    <div class="min-w-[210px]">
      <div class="font-medium">${escapeHtml(ref.patternName || '未关联纸样')}</div>
      <div class="mt-1 text-xs text-muted-foreground">技术包版：${escapeHtml(ref.techPackVersionId || '未关联')}</div>
    </div>
  `
}

function renderDraftAbAnalysisTable(candidate: SupplementCandidate, editingDraft: SupplementDraft | null = null): string {
  if (!candidate.abAnalysisRows.length) {
    return `
      <div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
        当前对象没有可直接生成补料建议的面料明细。请先核查技术包里的面料别名、物料信息、纸样信息，或确认裁剪回写数据。
      </div>
    `
  }

  return `
    <div class="overflow-auto rounded-lg border">
      <table class="min-w-[1180px] text-left text-sm">
        <thead class="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">成衣颜色</th>
            <th class="px-3 py-2 font-medium">尺码</th>
            <th class="px-3 py-2 font-medium">面料别名</th>
            <th class="px-3 py-2 font-medium">物料信息</th>
            <th class="px-3 py-2 font-medium">纸样信息</th>
            <th class="px-3 py-2 font-medium">计划数量（件）</th>
            <th class="px-3 py-2 font-medium">实裁数据（件）</th>
            <th class="px-3 py-2 font-medium">已发起</th>
            <th class="px-3 py-2 font-medium">本次补料件数</th>
          </tr>
        </thead>
        <tbody>
          ${candidate.abAnalysisRows.map((row) => {
            const editingLine = editingDraft?.lines.find((line) => line.basis.key === row.key)
            const inputQty = editingLine?.supplementQty ?? row.suggestedSupplementQty
            return `
            <tr class="border-t align-top">
              <td class="px-3 py-3">${escapeHtml(row.color)}</td>
              <td class="px-3 py-3">${escapeHtml(row.size)}</td>
              <td class="px-3 py-3">${renderMaterialAliasInfo(row.shortageMaterial)}</td>
              <td class="px-3 py-3">${renderSupplementMaterialInfo(row.shortageMaterial)}</td>
              <td class="px-3 py-3">${renderSupplementPatternInfo(row.shortageMaterial)}</td>
              <td class="px-3 py-3 font-medium tabular-nums">${formatInteger(row.plannedQty)} 件</td>
              <td class="px-3 py-3 font-medium tabular-nums">${formatInteger(row.currentRoleCutQty)} 件</td>
              <td class="px-3 py-3 tabular-nums">${formatInteger(row.existingSupplementQty)} 件</td>
              <td class="px-3 py-3">
                <input class="h-9 w-28 rounded-md border px-2 text-sm tabular-nums" type="number" min="0" max="${Math.max(row.suggestedSupplementQty, row.shortageQty)}" value="${inputQty > 0 ? formatInteger(inputQty).replace(/,/g, '') : '0'}" data-supplement-basis-qty-input data-basis-key="${escapeHtml(row.key)}" />
                <div class="mt-1 text-[11px] text-muted-foreground">建议 ${formatInteger(row.suggestedSupplementQty)} 件</div>
              </td>
            </tr>
          `
          }).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderDraftPage(candidate: SupplementCandidate | undefined, editingDraft: SupplementDraft | null = null): string {
  if (!candidate) return ''
  const summary = summarizeCandidate(candidate)
  const actualCutQty = candidate.abAnalysisRows.reduce((sum, row) => sum + Number(row.currentRoleCutQty || 0), 0)
  const suggestedSupplementQty = candidate.abAnalysisRows.reduce((sum, row) => sum + Number(row.suggestedSupplementQty || 0), 0)
  return `
    <div class="space-y-4" data-supplement-draft-dialog>
      <section class="rounded-lg border bg-card">
        <div class="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold">填写补料信息</h2>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(candidate.sourceTitle)} / ${escapeHtml(candidate.record.productionOrderNo)} / ${escapeHtml(candidate.record.styleName)}</p>
          </div>
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-cutting-supplement-action="back-to-source-picker">重新选择补料对象</button>
        </div>
        <div class="space-y-4 p-5">
          <section class="grid gap-3 md:grid-cols-4">
            ${renderStatChip('计划数量', summary.plannedQty)}
            ${renderStatChip('实裁数据', actualCutQty)}
            ${renderStatChip('已发起', summary.supplementingQty)}
            ${renderStatChip('建议补料', suggestedSupplementQty)}
          </section>
          <section class="rounded-lg border p-4">
            <div class="mb-3 flex items-center justify-between">
              <h3 class="font-semibold">补料明细与本次补料件数</h3>
              <span class="text-xs text-muted-foreground">按成衣颜色、尺码、面料别名、物料信息和纸样信息填写本次补料件数。</span>
            </div>
            ${renderDraftAbAnalysisTable(candidate, editingDraft)}
          </section>
          <section class="grid gap-3 md:grid-cols-2">
            <label class="space-y-1 text-sm">
              <span class="text-muted-foreground">补料原因</span>
              <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-supplement-reason>
                <option value="">请选择</option>
                <option value="裁片损耗"${editingDraft?.reason === '裁片损耗' ? ' selected' : ''}>裁片损耗</option>
                <option value="验片不良"${editingDraft?.reason === '验片不良' ? ' selected' : ''}>验片不良</option>
                <option value="尺码齐套不足"${editingDraft?.reason === '尺码齐套不足' ? ' selected' : ''}>尺码齐套不足</option>
                <option value="裁片单关闭前补齐"${editingDraft?.reason === '裁片单关闭前补齐' ? ' selected' : ''}>裁片单关闭前补齐</option>
              </select>
            </label>
            <label class="space-y-1 text-sm">
              <span class="text-muted-foreground">补料说明</span>
              <input class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-supplement-reason-detail placeholder="说明为什么需要补料" value="${escapeHtml(editingDraft?.reasonDetail || '')}" />
            </label>
          </section>
          <div class="hidden rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800" data-supplement-draft-error></div>
        </div>
        <div class="flex items-center justify-end gap-2 border-t px-5 py-4">
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-cutting-supplement-action="cancel-create">取消新增</button>
          <button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-cutting-supplement-action="submit-draft" data-candidate-id="${escapeHtml(candidate.id)}">提交补料</button>
        </div>
      </section>
    </div>
  `
}

function renderConfirmComposition(draft: SupplementDraft, demand: SupplementMaterialDemand): string {
  const lines = draft.lines.filter((line) => (
    line.basis.shortageMaterial.materialPatternMappingId === demand.materialPatternMappingId
  ))
  const colorSizes = [...new Set(lines.map((line) => `${line.color} / ${line.size}`))]
  const colorSizeText = colorSizes.join('、') || '未记录'
  return `
    <div class="min-w-[240px] space-y-2">
      <div class="flex flex-wrap items-center gap-2">
        ${renderMaterialAliasInfo(demand)}
        <span class="text-sm font-medium">${escapeHtml(demand.patternName || '未关联纸样')}</span>
      </div>
      ${colorSizes.length > 6
        ? `<details><summary class="cursor-pointer text-xs text-blue-700">涉及 ${colorSizes.length} 个颜色尺码组合，展开查看</summary><div class="mt-2 text-xs leading-5 text-muted-foreground">${escapeHtml(colorSizeText)}</div></details>`
        : `<div class="text-xs leading-5 text-muted-foreground">颜色尺码：${escapeHtml(colorSizeText)}</div>`}
    </div>
  `
}

function renderConfirmInventory(decision: ReturnType<typeof buildSupplementSupplyDecisions>[number]): string {
  return `<div class="min-w-[260px] space-y-2 text-xs leading-5">${decision.inventoryRows.map((row) => `
    <div>
      <div class="font-medium text-foreground">${escapeHtml(row.warehouseName)}</div>
      <div class="text-muted-foreground">总量 ${formatDecimal(row.totalQty)}、可用 ${formatDecimal(row.availableQty)}、不可用 ${formatDecimal(row.unavailableQty)} ${escapeHtml(row.unit || '未记录')}</div>
    </div>
  `).join('')}</div>`
}

function renderConfirmPurchase(decision: ReturnType<typeof buildSupplementSupplyDecisions>[number]): string {
  const transit = decision.existingTransitRows.length
    ? decision.existingTransitRows.map((row) => `
        <div class="space-y-1">
          <div class="font-medium">已有采购在途 ${formatDecimal(row.pendingQty)} ${escapeHtml(row.unit)}</div>
          <div class="text-xs text-muted-foreground">${escapeHtml(row.status)} · 预计到货 ${escapeHtml(row.estimatedArrivalAt)}</div>
          ${row.unitMatched ? '' : '<div class="text-xs text-amber-700">单位不一致，不参与覆盖</div>'}
        </div>
      `).join('')
    : '<div class="text-sm text-muted-foreground">无采购在途</div>'
  const nextPurchase = decision.uncoveredQty > 0
    ? `<div class="mt-2 font-medium">确认创建后采购 ${formatDecimal(decision.uncoveredQty)} ${escapeHtml(decision.unit)}</div>`
    : '<div class="mt-2 text-xs text-muted-foreground">无需新增采购</div>'
  return `<div class="min-w-[190px]">${transit}${nextPurchase}</div>`
}

function renderConfirmHandling(
  demand: SupplementMaterialDemand,
  decision: ReturnType<typeof buildSupplementSupplyDecisions>[number],
): string {
  const supplyText = decision.uncoveredQty > 0
    ? `不建议创建；确认创建后采购 ${formatDecimal(decision.uncoveredQty)} ${decision.unit}`
    : decision.existingTransitCoverageQty > 0
      ? '等待已有采购在途'
      : '使用现有库存'
  const processText = demand.dyeRequired && demand.printRequired
    ? '；先染色，再印花'
    : demand.dyeRequired
      ? '；创建染色加工单'
      : demand.printRequired
        ? '；创建印花加工单'
        : ''
  return `<div class="min-w-[210px] font-medium ${decision.uncoveredQty > 0 ? 'text-amber-800' : 'text-emerald-700'}">${escapeHtml(`${supplyText}${processText}`)}</div>`
}

function renderConfirmPage(draft: SupplementDraft | null): string {
  if (!draft) return ''
  const supplyDecisions = buildSupplementSupplyDecisions({
    demands: draft.materialDemands,
    checkedAt: nowText(),
    confirmUncovered: true,
  })
  const decisionsByDemand = new Map(supplyDecisions.map((decision) => [decision.materialDemandId, decision]))
  const groupedRows = new Map<string, SupplementMaterialDemand[]>()
  draft.materialDemands.forEach((demand) => {
    const key = `${demand.materialSku}\u0000${demand.unit}`
    const group = groupedRows.get(key) || []
    group.push(demand)
    groupedRows.set(key, group)
  })
  const originalCutOrderNo = draft.materialDemands[0]?.originalCutOrderNo || '未记录'
  const totalSupplementQty = draft.lines.reduce((sum, line) => sum + Number(line.supplementQty || 0), 0)
  const tableRows = [...groupedRows.values()].flatMap((demands) => demands.map((demand, demandIndex) => {
    const decision = decisionsByDemand.get(demand.key)
    if (!decision) return ''
    const lines = draft.lines.filter((line) => (
      line.basis.shortageMaterial.materialPatternMappingId === demand.materialPatternMappingId
    ))
    const supplementQty = lines.reduce((sum, line) => sum + Number(line.supplementQty || 0), 0)
    const materialCell = demandIndex === 0 ? `
      <td class="sticky left-0 z-10 border-r bg-background px-3 py-3 align-top" rowspan="${demands.length}">
        ${renderSupplementMaterialInfo(demand)}
        <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(demand.materialTypeLabel)} · ${escapeHtml(demand.unit)}</div>
      </td>
    ` : ''
    return `
      <tr class="border-t align-top" data-supplement-confirm-demand="${escapeHtml(demand.key)}">
        ${materialCell}
        <td class="px-3 py-3">${renderConfirmComposition(draft, demand)}</td>
        <td class="px-3 py-3 font-semibold tabular-nums">${formatInteger(supplementQty)} 件</td>
        <td class="px-3 py-3 font-semibold tabular-nums">${formatDecimal(demand.requiredQty)} ${escapeHtml(demand.unit)}</td>
        <td class="px-3 py-3">${renderConfirmInventory(decision)}</td>
        <td class="px-3 py-3">${renderConfirmPurchase(decision)}</td>
        <td class="px-3 py-3">${demand.dyeRequired ? '<span class="font-medium text-sky-700">确认后创建染色加工单</span>' : '<span class="text-muted-foreground">无需</span>'}</td>
        <td class="px-3 py-3">${demand.printRequired ? `<span class="font-medium text-violet-700">${demand.dyeRequired ? '等待染色完成后印花' : '确认后创建印花加工单'}</span>` : '<span class="text-muted-foreground">无需</span>'}</td>
        <td class="px-3 py-3"><span class="font-medium text-blue-700">确认后形成补料配料需求</span><div class="mt-1 text-xs text-muted-foreground">物料未到仓时不生成可领任务</div></td>
        <td class="px-3 py-3">${renderConfirmHandling(demand, decision)}</td>
      </tr>
    `
  }))
  return `
    <div class="space-y-4" data-supplement-confirm-page>
      <section class="space-y-3 rounded-lg border bg-card p-4" data-supplement-confirm-summary>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 class="text-xl font-semibold">确认创建补料单</h2>
            <p class="mt-1 text-sm text-muted-foreground">请横向核对本次补料、物料需求和各节点处理结论。</p>
          </div>
          <span class="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">第 3 步 / 共 3 步</span>
        </div>
        ${renderReleaseSnapshotTrace(draft)}
        <div class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <div><div class="text-xs text-muted-foreground">补料对象</div><div class="mt-1 font-semibold">${escapeHtml(sourceTypeLabels[draft.sourceType])} ${escapeHtml(draft.sourceNo)}</div></div>
          <div><div class="text-xs text-muted-foreground">生产单</div><div class="mt-1 font-semibold">${escapeHtml(draft.productionOrderNo)}</div></div>
          <div><div class="text-xs text-muted-foreground">原裁片单</div><div class="mt-1 font-semibold">${escapeHtml(originalCutOrderNo)}</div></div>
          <div><div class="text-xs text-muted-foreground">补料原因</div><div class="mt-1 font-semibold">${escapeHtml(draft.reason)}</div></div>
          <div><div class="text-xs text-muted-foreground">补料总件数</div><div class="mt-1 font-semibold tabular-nums">${formatInteger(totalSupplementQty)} 件</div></div>
          <div><div class="text-xs text-muted-foreground">物料种数</div><div class="mt-1 font-semibold tabular-nums">${formatInteger(groupedRows.size)} 种</div></div>
        </div>
        <div class="text-sm text-muted-foreground">补料说明：${escapeHtml(draft.reasonDetail)}</div>
      </section>
      <section class="space-y-2" data-supplement-confirm-table-section>
        <h3 class="font-semibold">补料确认总表</h3>
        <div class="overflow-x-auto rounded-lg border bg-card" data-supplement-confirm-table-scroll>
          <table class="min-w-max text-left text-sm" data-supplement-confirm-table>
            <thead class="bg-muted/50 text-xs text-muted-foreground"><tr>
              <th class="sticky left-0 z-20 min-w-[250px] border-r bg-muted px-3 py-3 font-medium">物料</th>
              <th class="min-w-[260px] px-3 py-3 font-medium">本次补料构成</th>
              <th class="min-w-[100px] px-3 py-3 font-medium">补料件数</th>
              <th class="min-w-[120px] px-3 py-3 font-medium">物料需求</th>
              <th class="min-w-[290px] px-3 py-3 font-medium">各仓库存</th>
              <th class="min-w-[210px] px-3 py-3 font-medium">采购情况</th>
              <th class="min-w-[160px] px-3 py-3 font-medium">染色</th>
              <th class="min-w-[180px] px-3 py-3 font-medium">印花</th>
              <th class="min-w-[210px] px-3 py-3 font-medium">中转仓配料</th>
              <th class="min-w-[230px] px-3 py-3 font-medium">本次处理</th>
            </tr></thead>
            <tbody>${tableRows.join('')}</tbody>
          </table>
        </div>
      </section>
      <div class="sticky bottom-0 z-30 flex items-center justify-end gap-2 border-t bg-background/95 px-1 py-3 backdrop-blur" data-supplement-confirm-actions>
        <button type="button" class="rounded-md border bg-background px-4 py-2 text-sm hover:bg-muted" data-cutting-supplement-action="return-draft">返回修改</button>
        <button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60" data-cutting-supplement-action="confirm-supplement">确认创建补料单</button>
      </div>
    </div>
  `
}

function formatMaterialDemandSummary(demands: SupplementMaterialDemand[]): string {
  return demands
    .slice(0, 3)
    .map((item) => `${item.materialTypeLabel} ${formatDecimal(item.requiredQty)} ${item.unit}`)
    .join('、') || '无'
}

function getSupplementTotalQty(record: SupplementOrderLifecycle): number {
  return record.lines.reduce((sum, line) => sum + Number(line.supplementQty || 0), 0)
}

type SupplementNodeOverview = ReturnType<typeof getSupplementNodeOverview>
const supplementListNodeOverviewCache = new WeakMap<SupplementOrderLifecycle, SupplementNodeOverview>()

function getSupplementListNodeOverview(record: SupplementOrderLifecycle): SupplementNodeOverview {
  const cached = supplementListNodeOverviewCache.get(record)
  if (cached) return cached
  const overview = getSupplementNodeOverview(record)
  supplementListNodeOverviewCache.set(record, overview)
  return overview
}

const supplementListColumns: StandardListColumn<SupplementOrderLifecycle>[] = [
  {
    key: 'recordNo',
    title: '补料单号',
    width: 170,
    required: true,
    freezeable: true,
    sortable: true,
    render: (record) => `<span class="font-semibold">${escapeHtml(record.recordNo)}</span>`,
    sortValue: (record) => record.recordNo,
  },
  {
    key: 'target',
    title: '补料对象',
    width: 250,
    required: true,
    freezeable: true,
    render: (record) => {
      const spuImageUrl = record.draftMeta.styleImageUrl
      return `
        <div class="flex items-center gap-3">
          ${renderSupplementBusinessImage(spuImageUrl, record.draftMeta.styleImageAlt, 'h-12 w-12')}
          <div class="min-w-0">
            <div class="truncate font-medium">${escapeHtml(sourceTypeLabels[record.draftMeta.sourceType])} ${escapeHtml(record.draftMeta.sourceNo)}</div>
            <div class="truncate text-xs text-muted-foreground">${escapeHtml(record.productionOrderNo)} / ${escapeHtml(record.draftMeta.spuCode)}</div>
            <div class="truncate text-xs text-muted-foreground">${escapeHtml(record.draftMeta.styleName)}</div>
          </div>
        </div>
      `
    },
  },
  {
    key: 'supplementQty',
    title: '补料数量',
    width: 120,
    freezeable: true,
    sortable: true,
    align: 'right',
    render: (record) => `<span class="font-medium tabular-nums">${escapeHtml(formatInteger(getSupplementTotalQty(record)))} 件</span>`,
    sortValue: getSupplementTotalQty,
  },
  {
    key: 'materialDemand',
    title: '物料需求',
    width: 300,
    render: (record) => {
      const materialImages = record.materialDemands.slice(0, 3).map((item) => `
        ${renderSupplementBusinessImage(item.materialImageUrl, item.materialImageAlt, 'h-8 w-8')}
      `).join('')
      return `
        <div class="flex items-center gap-2">
          <div class="flex shrink-0 flex-wrap gap-1">${materialImages}</div>
          <div class="min-w-0">
            <div class="truncate tabular-nums">${escapeHtml(formatMaterialDemandSummary(record.materialDemands))}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(formatInteger(record.materialDemands.length))} 种物料</div>
          </div>
        </div>
      `
    },
  },
  { key: 'inventory', title: '库存', width: 180, render: (record) => `<span class="text-xs">${escapeHtml(getSupplementListNodeOverview(record).inventory)}</span>` },
  { key: 'purchase', title: '采购', width: 180, render: (record) => `<span class="text-xs">${escapeHtml(getSupplementListNodeOverview(record).purchase)}</span>` },
  { key: 'dye', title: '染色', width: 160, render: (record) => `<span class="text-xs">${escapeHtml(getSupplementListNodeOverview(record).dye)}</span>` },
  { key: 'print', title: '印花', width: 160, render: (record) => `<span class="text-xs">${escapeHtml(getSupplementListNodeOverview(record).print)}</span>` },
  { key: 'materialPrep', title: '中转仓配料', width: 180, required: true, freezeable: true, render: (record) => {
    const overview = getSupplementListNodeOverview(record)
    return `<span class="text-xs font-medium">${escapeHtml(overview.materialPrep)}</span><div class="mt-1 text-xs text-muted-foreground">当前：${escapeHtml(overview.currentNode)}</div>`
  } },
  {
    key: 'status',
    title: '状态',
    width: 110,
    freezeable: true,
    render: (record) => `<span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">${escapeHtml(record.status)}</span>`,
  },
  {
    key: 'created',
    title: '创建',
    width: 190,
    freezeable: true,
    sortable: true,
    render: (record) => `${escapeHtml(record.createdBy)}<div class="text-xs text-muted-foreground">${escapeHtml(record.createdAt)}</div>`,
    sortValue: (record) => record.createdAt,
  },
  {
    key: 'actions',
    title: '操作',
    width: 110,
    required: true,
    actionColumn: true,
    align: 'right',
    render: (record) => `
      <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cutting-supplement-action="open-detail" data-record-id="${escapeHtml(record.id)}">查看详情</button>
    `,
  },
]

export function normalizeSupplementListPreferences(
  raw: Partial<StandardListColumnPreferences> | null | undefined,
): StandardListColumnPreferences {
  const normalized = normalizeListColumnPreferences(
    supplementListColumnRules,
    raw,
    supplementListPageSizes,
  )
  const columnsByKey = new Map(supplementListColumns.map((column) => [column.key, column]))
  const visibleKeys = new Set(normalized.visibleKeys)
  const requestedFrozenKeys = new Set(normalized.frozenKeys)
  const frozenColumns = normalized.order
    .map((key) => columnsByKey.get(key))
    .filter((column): column is StandardListColumn<SupplementOrderLifecycle> => Boolean(
      column
      && !column.actionColumn
      && column.freezeable
      && visibleKeys.has(column.key)
      && requestedFrozenKeys.has(column.key),
    ))
  let frozenWidth = frozenColumns.reduce(
    (sum, column) => sum + Math.max(column.width, column.minWidth ?? 0),
    0,
  )
  while (frozenWidth > supplementListMaxFrozenWidth && frozenColumns.length > 0) {
    const removed = frozenColumns.pop()
    if (removed) frozenWidth -= Math.max(removed.width, removed.minWidth ?? 0)
  }

  return {
    ...normalized,
    frozenKeys: frozenColumns.map((column) => column.key),
  }
}

interface SupplementListView {
  filtered: SupplementOrderLifecycle[]
  paging: StandardListPageSlice<SupplementOrderLifecycle>
}

function getSupplementListStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

function ensureSupplementListPreferences(): void {
  if (supplementListPreferencesLoaded) return
  supplementListPreferencesLoaded = true
  const storage = getSupplementListStorage()
  const loadedPreferences = storage
    ? loadListColumnPreferences(
        storage,
        supplementListStorageKey,
        supplementListColumnRules,
        defaultSupplementListColumnPreferences,
        supplementListPageSizes,
      )
    : defaultSupplementListColumnPreferences
  state.columnPreferences = normalizeSupplementListPreferences(loadedPreferences)
  if (storage) saveListColumnPreferences(storage, supplementListStorageKey, state.columnPreferences)
}

export function enterCraftCuttingSupplementManagementRoute(): void {
  state.page = 1
  state.sort = null
  clearSupplementCreateState()
  state.activeRecordId = ''
  state.columnSettingsOpen = false
  state.creationSourceKey = ''
}

function saveSupplementListPreferences(): void {
  const storage = getSupplementListStorage()
  if (storage) saveListColumnPreferences(storage, supplementListStorageKey, state.columnPreferences)
}

function getSupplementListView(): SupplementListView {
  const filtered = getFilteredRecords()
  filtered.forEach(getSupplementListNodeOverview)
  const sorted = sortStandardListRows(filtered, state.sort, (record, key) =>
    supplementListColumns.find((column) => column.key === key)?.sortValue?.(record),
  )
  const paging = paginateStandardListRows(sorted, state.page, state.columnPreferences.pageSize)
  state.page = paging.currentPage
  return { filtered, paging }
}

function withSkipPageRerender(html: string): string {
  return html
    .replaceAll('data-cutting-supplement-action=', 'data-skip-page-rerender="true" data-cutting-supplement-action=')
    .replaceAll('data-cutting-supplement-field=', 'data-skip-page-rerender="true" data-cutting-supplement-field=')
}

function renderListStats(records: SupplementOrderLifecycle[]): string {
  return renderStandardListStats([
    { label: '补料单', value: records.length },
    { label: '未完成', value: records.filter((record) => record.status === '未完成').length },
    { label: '涉及生产单', value: new Set(records.map((record) => record.productionOrderNo)).size },
  ])
}

function renderListTable(paging: StandardListPageSlice<SupplementOrderLifecycle>): string {
  return withSkipPageRerender(renderStandardListTable({
    columns: supplementListColumns,
    rows: paging.rows,
    preferences: state.columnPreferences,
    sort: state.sort,
    eventPrefix: 'cutting-supplement',
    emptyText: '暂无补料单。',
  }))
}

function renderListPagination(paging: StandardListPageSlice<SupplementOrderLifecycle>): string {
  return withSkipPageRerender(renderTablePagination({
    total: paging.total,
    from: paging.from,
    to: paging.to,
    currentPage: paging.currentPage,
    totalPages: paging.totalPages,
    pageSize: paging.pageSize,
    actionPrefix: 'cutting-supplement',
    fieldPrefix: 'cutting-supplement',
    pageSizeOptions: supplementListPageSizes,
  }))
}

function renderListOverlay(): string {
  const activeRecord = state.activeRecordId ? getRecordById(state.activeRecordId) : undefined
  const preview = state.imagePreview ? `<div class="fixed inset-0 z-[70] flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="${escapeHtml(state.imagePreview.alt)}"><button type="button" class="absolute inset-0 bg-black/75" data-skip-page-rerender="true" data-cutting-supplement-action="close-image-preview" aria-label="关闭大图"></button><div class="relative z-10 max-h-[90vh] max-w-[90vw] rounded-xl bg-background p-4 shadow-xl"><button type="button" class="absolute right-3 top-3 rounded border bg-background px-3 py-1" data-skip-page-rerender="true" data-cutting-supplement-action="close-image-preview" aria-label="关闭大图">关闭</button><img class="max-h-[82vh] max-w-[84vw] object-contain" src="${escapeHtml(state.imagePreview.src)}" alt="${escapeHtml(state.imagePreview.alt)}" onerror="this.classList.add('hidden');this.nextElementSibling.classList.remove('hidden')" /><div class="hidden px-10 py-20 text-sm text-red-700">图片加载失败，请核对素材。</div></div></div>` : ''
  if (activeRecord) return `${renderSupplementDetailDialog(activeRecord)}${preview}`
  if (preview) return preview
  if (!state.columnSettingsOpen) return ''
  return withSkipPageRerender(renderStandardListColumnSettings({
    title: '列设置',
    columns: supplementListColumns,
    preferences: state.columnPreferences,
    eventPrefix: 'cutting-supplement',
    maxFrozenWidth: supplementListMaxFrozenWidth,
  }))
}

function setSupplementRegion(region: string, html: string): void {
  if (typeof document === 'undefined') return
  const element = document.querySelector<HTMLElement>(`[data-cutting-supplement-region="${region}"]`)
  if (element) element.innerHTML = html
}

function refreshSupplementFeedback(): void {
  setSupplementRegion('feedback', renderFeedback())
}

function refreshSupplementFilters(): void {
  setSupplementRegion('filters', renderFilterControls())
}

function refreshSupplementList(): void {
  const view = getSupplementListView()
  setSupplementRegion('stats', renderListStats(view.filtered))
  setSupplementRegion('table', renderListTable(view.paging))
  setSupplementRegion('pagination', renderListPagination(view.paging))
}

function refreshSupplementTableAndPagination(): void {
  const view = getSupplementListView()
  setSupplementRegion('table', renderListTable(view.paging))
  setSupplementRegion('pagination', renderListPagination(view.paging))
}

function refreshSupplementTable(): void {
  setSupplementRegion('table', renderListTable(getSupplementListView().paging))
}

function refreshSupplementOverlay(): void {
  setSupplementRegion('overlay', renderListOverlay())
}

function buildSupplementProcessLinks(record: SupplementOrderLifecycle): SupplementProcessLink[] {
  return record.processWorkOrderRefs.flatMap((ref) => {
    const workOrder = getProcessWorkOrderById(ref.workOrderId)
    if (!workOrder) return []
    const demand = record.materialDemands.find((item) =>
      item.materialSku === ref.materialSku || item.materialName === ref.materialName,
    )
    return [{
      kind: ref.processType === 'PRINT' ? '印花' : '染色',
      workOrderId: ref.workOrderId,
      workOrderNo: ref.workOrderNo,
      materialSku: ref.materialSku,
      materialName: ref.materialName,
      materialImageUrl: demand?.materialImageUrl || '',
      requiredQty: ref.plannedQty,
      unit: ref.unit,
      workOrderStatus: workOrder.statusLabel,
      factoryName: workOrder.factoryName,
      createdAt: workOrder.createdAt,
      linkedProductionOrderNo: record.productionOrderNo,
      processNote: demand?.processNote || `${ref.processType === 'PRINT' ? '印花' : '染色'}加工`,
      sourceLabel: PROCESS_WORK_ORDER_SOURCE_LABEL.CUT_PIECE_SUPPLEMENT,
      supplementRecordNo: workOrder.sourceSnapshot.supplementRecordNo || record.recordNo,
      originalCutOrderNo: workOrder.sourceSnapshot.originalCutOrderNo || '',
      techPackVersionLabel: workOrder.sourceSnapshot.techPackVersionLabel || '',
    }]
  })
}

function renderProcessLinksTable(record: SupplementOrderLifecycle): string {
  const links = buildSupplementProcessLinks(record)
  if (!links.length) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">无需生成印染加工单</div>'
  }

  return `
    <div class="overflow-auto rounded-lg border">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">工艺</th>
            <th class="px-3 py-2 font-medium">加工单</th>
            <th class="px-3 py-2 font-medium">物料</th>
            <th class="px-3 py-2 font-medium">数量</th>
            <th class="px-3 py-2 font-medium">状态</th>
            <th class="px-3 py-2 font-medium">加工工厂</th>
            <th class="px-3 py-2 font-medium">${PRODUCTION_ORDER_IDENTITY_COLUMN_TITLE}</th>
          </tr>
        </thead>
        <tbody>
          ${links.map((link) => `
            <tr class="border-t align-top">
              <td class="px-3 py-3">
                <span class="rounded-full ${link.kind === '印花' ? 'bg-violet-50 text-violet-700' : 'bg-sky-50 text-sky-700'} px-2.5 py-1 text-xs font-medium">${escapeHtml(link.kind)}</span>
              </td>
              <td class="px-3 py-3">
                <a class="font-semibold text-blue-600 hover:underline" data-nav="${escapeHtml(link.kind === '印花' ? buildPrintingWorkOrderDetailLink(link.workOrderId) : buildDyeingWorkOrderDetailLink(link.workOrderId))}">${escapeHtml(link.workOrderNo)}</a>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(link.workOrderStatus)}</div>
                <div class="mt-1 text-xs font-medium text-blue-700">来源：${escapeHtml(link.sourceLabel)}</div>
                <div class="mt-1 text-xs text-muted-foreground">补料单 ${escapeHtml(link.supplementRecordNo)} · 原裁片单 ${escapeHtml(link.originalCutOrderNo)}</div>
                <div class="mt-1 text-xs text-muted-foreground">生产单 ${escapeHtml(link.linkedProductionOrderNo)} · 技术包版本 ${escapeHtml(link.techPackVersionLabel)}</div>
              </td>
              <td class="px-3 py-3">
                <div class="flex items-center gap-3">
                  ${renderSupplementBusinessImage(link.materialImageUrl, `${link.materialName}（${link.materialSku}）实物图`, 'h-10 w-10')}
                  <div>
                    <div class="font-medium">${escapeHtml(link.materialSku)}</div>
                    <div class="text-xs text-muted-foreground">${escapeHtml(link.materialName)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(link.processNote)}</div>
                  </div>
                </div>
              </td>
              <td class="px-3 py-3 font-semibold tabular-nums">${formatDecimal(link.requiredQty)} ${escapeHtml(link.unit)}</td>
              <td class="px-3 py-3">
                <div class="text-xs">${escapeHtml(link.workOrderStatus)}</div>
              </td>
              <td class="px-3 py-3">${escapeHtml(link.factoryName)}</td>
              <td class="px-3 py-3">
                ${renderProductionOrderIdentityCell({ productionOrderNo: link.linkedProductionOrderNo })}
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(link.createdAt)}</div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderSupplementDetailLinesTable(record: SupplementOrderLifecycle): string {
  const basisLines = record.lines.filter((line): line is SupplementLine => Boolean(asDraftLine(line).basis?.shortageMaterial))
  if (basisLines.length) {
    return renderSupplementBasisTable(basisLines)
  }
  return `
    <div class="overflow-auto rounded-lg border">
      <table class="min-w-[420px] text-left text-sm">
        <thead class="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">成衣颜色</th>
            <th class="px-3 py-2 font-medium">尺码</th>
            <th class="px-3 py-2 font-medium">本次补料件数</th>
          </tr>
        </thead>
        <tbody>
          ${record.lines.map((line) => `
            <tr class="border-t">
              <td class="px-3 py-3">${escapeHtml(line.color)}</td>
              <td class="px-3 py-3">${escapeHtml(line.size)}</td>
              <td class="px-3 py-3 font-semibold tabular-nums">${formatInteger(line.supplementQty)} 件</td>
            </tr>
          `).join('') || '<tr><td class="px-3 py-6 text-center text-muted-foreground" colspan="3">暂无补料明细</td></tr>'}
        </tbody>
      </table>
    </div>
  `
}

function renderNodeDocuments(documents: Array<{ documentNo: string; createdAt: string; plannedQty: number; completedQty: number; unit: string; status: string; owner: string; estimatedArrivalAt: string; sourceTrace: string }>): string {
  if (!documents.length) return ''
  return `<details class="mt-2"><summary class="cursor-pointer text-xs text-blue-700">展开 ${documents.length} 张单据</summary><div class="mt-2 space-y-2">${documents.map((document) => `<div class="rounded border bg-background p-2 text-xs"><strong>${escapeHtml(document.documentNo)}</strong><br>创建：${escapeHtml(document.createdAt)}<br>数量：${formatDecimal(document.plannedQty)} ${escapeHtml(document.unit)}；完成：${formatDecimal(document.completedQty)} ${escapeHtml(document.unit)}<br>状态：${escapeHtml(document.status)}；责任方：${escapeHtml(document.owner)}<br>预计到货：${escapeHtml(document.estimatedArrivalAt)}<br>投入/来源：${escapeHtml(document.sourceTrace)}</div>`).join('')}</div></details>`
}

function renderSupplementMaterialNodeTable(record: SupplementOrderLifecycle): string {
  const rows = getSupplementMaterialNodeFacts(record)
  return `<div class="overflow-auto rounded-lg border"><table class="min-w-[1500px] text-left text-sm">
    <thead class="bg-muted/50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">补料物料</th><th class="px-3 py-2">库存</th><th class="px-3 py-2">采购</th><th class="px-3 py-2">染色</th><th class="px-3 py-2">印花</th><th class="px-3 py-2">中转仓配料</th></tr></thead>
    <tbody>${rows.map((row) => `<tr class="border-t align-top">
      <td class="px-3 py-3"><div class="flex gap-3">${renderSupplementBusinessImage(row.material.materialImageUrl, row.material.materialImageAlt, 'h-12 w-12')}<div><strong>${escapeHtml(row.material.materialName)}</strong><div class="text-xs text-muted-foreground">${escapeHtml(row.material.materialSku)}</div><div class="text-xs">${escapeHtml(row.material.color)} / ${escapeHtml(row.material.specification)} / ${escapeHtml(row.material.patternPart)}</div><div class="font-medium">需求 ${formatDecimal(row.material.requiredQty)} ${escapeHtml(row.material.unit)}</div></div></div></td>
      <td class="px-3 py-3"><strong>${escapeHtml(row.inventory.status)}</strong><div class="mt-1 text-xs">${escapeHtml(row.inventory.summary)}</div><details class="mt-2"><summary class="cursor-pointer text-xs text-blue-700">查看各仓</summary>${row.inventory.rows.map((inventory) => `<div class="mt-1 text-xs">${escapeHtml(String(inventory.warehouseName))}：总量 ${escapeHtml(String(inventory.totalQty))}、可用 ${escapeHtml(String(inventory.availableQty))}、占用/不可用 ${escapeHtml(String(inventory.unavailableQty))} ${escapeHtml(String(inventory.unit))}；库区/库位 ${escapeHtml(String(inventory.location))}；${escapeHtml(String(inventory.status))}；更新 ${escapeHtml(String(inventory.updatedAt))}</div>`).join('')}</details></td>
      <td class="px-3 py-3"><strong>${escapeHtml(row.purchase.status)}</strong><div class="mt-1 text-xs">${escapeHtml(row.purchase.summary)}</div>${renderNodeDocuments(row.purchase.documents)}</td>
      <td class="px-3 py-3"><strong>${escapeHtml(row.dye.status)}</strong><div class="mt-1 text-xs">${escapeHtml(row.dye.summary)}</div>${renderNodeDocuments(row.dye.documents)}</td>
      <td class="px-3 py-3"><strong>${escapeHtml(row.print.status)}</strong><div class="mt-1 text-xs">${escapeHtml(row.print.summary)}</div>${renderNodeDocuments(row.print.documents)}</td>
      <td class="px-3 py-3"><strong>${escapeHtml(row.materialPrep.status)}</strong><div class="mt-1 text-xs">批准 ${formatDecimal(row.materialPrep.approvedRequiredQty)}；到仓 ${formatDecimal(row.materialPrep.arrivedQty)}；可配 ${formatDecimal(row.materialPrep.currentAvailableQty)}；已配 ${formatDecimal(row.materialPrep.preparedQty)}；已领 ${formatDecimal(row.materialPrep.pickedQty)}；剩余 ${formatDecimal(row.materialPrep.remainingQty)} ${escapeHtml(row.materialPrep.unit)}</div>${row.hasUnresolvedDifference ? '<div class="mt-1 text-xs font-medium text-red-700">存在未处理数量差异</div>' : ''}</td>
    </tr>`).join('')}</tbody>
  </table></div>`
}

function renderSupplementDetailDialog(record: SupplementOrderLifecycle | undefined): string {
  if (!record) return ''
  const totalQty = record.lines.reduce((sum, line) => sum + line.supplementQty, 0)
  const spuImageUrl = record.draftMeta.styleImageUrl
  const snapshotTraceDraft = {
    releaseSnapshotId: record.draftMeta.releaseSnapshotId,
    releaseMatrixVersion: record.draftMeta.releaseMatrixVersion,
    releaseTargetConfirmedAt: record.draftMeta.releaseTargetConfirmedAt,
  } as SupplementDraft

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6">
      <div class="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-xl bg-background shadow-xl">
        <div class="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold">补料单详情</h2>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.recordNo)} / ${escapeHtml(record.productionOrderNo)} / ${escapeHtml(record.draftMeta.styleName)}</p>
          </div>
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cutting-supplement-action="close-detail">关闭</button>
        </div>
        <div class="flex-1 space-y-4 overflow-y-auto p-5">
          ${renderReleaseSnapshotTrace(snapshotTraceDraft)}
          <section class="rounded-lg border p-4">
            <div class="flex flex-col gap-4 md:flex-row">
              <div class="w-full md:w-36">
                ${renderSupplementBusinessImage(spuImageUrl, record.draftMeta.styleImageAlt, 'h-36 w-full')}
                <div class="mt-2 text-xs text-muted-foreground">款式/SPU图</div>
              </div>
              <div class="grid flex-1 gap-4 md:grid-cols-4">
                <div><div class="text-xs text-muted-foreground">补料单号</div><div class="mt-1 font-semibold">${escapeHtml(record.recordNo)}</div></div>
                <div><div class="text-xs text-muted-foreground">补料次数</div><div class="mt-1 font-semibold">第 ${formatInteger(record.sequenceNo)} 次</div></div>
                <div><div class="text-xs text-muted-foreground">状态</div><div class="mt-1"><span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">${escapeHtml(record.status)}</span></div></div>
                <div><div class="text-xs text-muted-foreground">补料对象</div><div class="mt-1 font-semibold">${escapeHtml(sourceTypeLabels[record.draftMeta.sourceType])} ${escapeHtml(record.draftMeta.sourceNo)}</div></div>
                <div><div class="text-xs text-muted-foreground">补料数量</div><div class="mt-1 font-semibold tabular-nums">${formatInteger(totalQty)} 件</div></div>
                <div><div class="text-xs text-muted-foreground">生产单</div><div class="mt-1 font-semibold">${escapeHtml(record.productionOrderNo)}</div></div>
                <div><div class="text-xs text-muted-foreground">SPU</div><div class="mt-1 font-semibold">${escapeHtml(record.draftMeta.spuCode)}</div></div>
                <div><div class="text-xs text-muted-foreground">款式</div><div class="mt-1 font-semibold">${escapeHtml(record.draftMeta.styleName)}</div></div>
                <div><div class="text-xs text-muted-foreground">发起人</div><div class="mt-1 font-semibold">${escapeHtml(record.createdBy)}</div></div>
                <div><div class="text-xs text-muted-foreground">创建时间</div><div class="mt-1 font-semibold">${escapeHtml(record.createdAt)}</div></div>
                ${record.status === '已完成' ? `<div><div class="text-xs text-muted-foreground">完成人</div><div class="mt-1 font-semibold">${escapeHtml(record.completedBy || '未记录')}</div></div><div><div class="text-xs text-muted-foreground">完成时间</div><div class="mt-1 font-semibold">${escapeHtml(record.completedAt || '未记录')}</div></div>` : ''}
              </div>
            </div>
            <div class="mt-4 rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span class="font-medium">补料原因：</span>${escapeHtml(record.reason)}
              <span class="ml-3 text-muted-foreground">${escapeHtml(record.reasonDetail)}</span>
            </div>
	          </section>

          <section>
            <h3 class="mb-2 font-semibold">各节点当前情况</h3>
            ${renderSupplementMaterialNodeTable(record)}
          </section>
        </div>
      </div>
    </div>
  `
}

function getCandidateById(candidateId: string): SupplementCandidate | undefined {
  return buildCandidates().find((candidate) => candidate.id === candidateId)
}

function getRecordById(recordId: string): SupplementOrderLifecycle | undefined {
  return state.records.find((record) => record.id === recordId)
}

function parsePositiveInteger(value: string | null | undefined): number {
  const parsed = Number(value || 0)
  if (!Number.isFinite(parsed) || parsed <= 0) return 0
  return Math.round(parsed)
}

function showDraftError(container: HTMLElement, message: string): void {
  const node = container.querySelector<HTMLElement>('[data-supplement-draft-error]')
  if (!node) return
  node.textContent = message
  node.classList.remove('hidden')
}

function buildDraftFromDialog(candidate: SupplementCandidate, container: HTMLElement): SupplementDraft | null {
  const reason = normalizeText(container.querySelector<HTMLSelectElement>('[data-supplement-reason]')?.value)
  const reasonDetail = normalizeText(container.querySelector<HTMLInputElement>('[data-supplement-reason-detail]')?.value)
  if (!reason) {
    showDraftError(container, '补料原因必须选择。')
    return null
  }
  if (!reasonDetail) {
    showDraftError(container, '补料说明必须填写。')
    return null
  }

  const selectedLines = candidate.abAnalysisRows
    .map((basis) => {
      const input = container.querySelector<HTMLInputElement>(`[data-supplement-basis-qty-input][data-basis-key="${CSS.escape(basis.key)}"]`)
      const sourceLine = candidate.sizeColorRows.find((line) => line.key === makeSizeColorKey(basis)) || {
        key: makeSizeColorKey(basis),
        skuCode: basis.skuCode,
        color: basis.color,
        size: basis.size,
        plannedQty: basis.plannedQty,
        actualCutPieces: basis.currentRoleCutQty,
        inboundPieces: 0,
        completeSetQty: basis.benchmarkCutQty,
        inboundSetQty: 0,
        shortageQty: basis.shortageQty,
        existingSupplementQty: basis.existingSupplementQty,
        suggestedSupplementQty: basis.suggestedSupplementQty,
        relatedCutOrderNos: basis.relatedCutOrderNos,
      }
      const supplementQty = parsePositiveInteger(input?.value)
      return {
        ...sourceLine,
        shortageQty: basis.shortageQty,
        existingSupplementQty: basis.existingSupplementQty,
        suggestedSupplementQty: basis.suggestedSupplementQty,
        supplementQty,
        basis,
        isManualAdjusted: supplementQty > 0 && supplementQty !== basis.suggestedSupplementQty,
        adjustReason: supplementQty > 0 && supplementQty !== basis.suggestedSupplementQty ? reasonDetail : '',
      }
    })
    .filter((line) => line.supplementQty > 0)

  if (!selectedLines.length) {
    showDraftError(container, '本次补料件数至少填写一条补料明细行。')
    return null
  }

  if (selectedLines.some((line) => line.isManualAdjusted) && !reasonDetail) {
    showDraftError(container, '人工调整建议补料数量时必须填写补料说明。')
    return null
  }

  const materialDemands = buildMaterialDemands(candidate, selectedLines)
  if (!materialDemands.length) {
    showDraftError(container, '当前补料行无法反算物料需求，请先核查裁片单物料映射。')
    return null
  }

  return {
    candidateId: candidate.id,
    sourceType: candidate.sourceType,
    sourceNo: candidate.sourceNo,
    productionOrderId: candidate.record.productionOrderId,
    productionOrderNo: candidate.record.productionOrderNo,
    styleName: candidate.record.styleName,
    spuCode: candidate.record.spuCode,
    styleImageUrl: getSpuImageUrl(candidate.record),
    styleImageAlt: `${candidate.record.styleName}（${candidate.record.spuCode}）款式图`,
    reason,
    reasonDetail,
    lines: selectedLines,
    materialDemands,
  }
}

const defaultSupplementNowProvider = (): string => {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || ''
  return `${value('year')}-${value('month')}-${value('day')} ${value('hour')}:${value('minute')}`
}
let supplementNowProvider = defaultSupplementNowProvider

export function setSupplementNowProviderForTesting(provider?: () => string): void {
  supplementNowProvider = provider ?? defaultSupplementNowProvider
}

function nowText(): string {
  return supplementNowProvider()
}

function roundProcessQty(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000
}

function hashSupplementIdentity(value: string): string {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(7, '0')
}

function buildSupplementConfirmationIdentity(draft: SupplementDraft): string {
  if (draft.confirmationIdentity?.trim()) return draft.confirmationIdentity.trim()
  return JSON.stringify({
    candidateId: draft.candidateId,
    sourceType: draft.sourceType,
    sourceNo: draft.sourceNo,
    productionOrderId: draft.productionOrderId,
    releaseSnapshotId: draft.releaseSnapshotId || '',
    reason: draft.reason,
    reasonDetail: draft.reasonDetail,
    lines: draft.lines.map((line) => ({
      key: line.key,
      supplementQty: line.supplementQty,
      materialPatternMappingId: line.basis.shortageMaterial.materialPatternMappingId,
    })),
  })
}

function canonicalizeSupplementRequest(value: unknown): unknown {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' && !Number.isFinite(value)) return `__${String(value)}__`
  if (Array.isArray(value)) return value.map(canonicalizeSupplementRequest)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .filter(([key]) => key !== 'confirmationIdentity')
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, canonicalizeSupplementRequest(nested)]))
  }
  return value
}

function buildSupplementRequestFingerprint(draft: SupplementDraft): string {
  const canonicalDraft = structuredClone(draft)
  canonicalDraft.lines.sort((left, right) => left.key.localeCompare(right.key))
  canonicalDraft.materialDemands.sort((left, right) => left.key.localeCompare(right.key))
  return JSON.stringify(canonicalizeSupplementRequest(canonicalDraft))
}

function buildSupplementRecordIdentity(draft: SupplementDraft): { id: string; recordNo: string } {
  const token = hashSupplementIdentity(buildSupplementConfirmationIdentity(draft))
  return { id: `supplement-confirmed-${token}`, recordNo: `SUP-${token}` }
}

interface ResolvedSupplementOriginalCutOrder {
  originalCutOrderId: string
  originalCutOrderNo: string
  materialLine: CuttingMaterialLine
}

type ResolveSupplementOriginalCutOrderResult =
  | { ok: true; value: ResolvedSupplementOriginalCutOrder }
  | { ok: false; message: string }

function resolveSupplementOriginalCutOrder(
  draft: SupplementDraft,
  demand: SupplementMaterialDemand,
): ResolveSupplementOriginalCutOrderResult {
  const originalCutOrderId = demand.originalCutOrderId.trim()
  const originalCutOrderNo = demand.originalCutOrderNo.trim()
  if (!originalCutOrderId || !originalCutOrderNo) {
    return { ok: false, message: `补料物料 ${demand.materialName} 缺少原裁片单标识。` }
  }
  const containerLines = cuttingOrderProgressRecords
    .filter((record) => record.productionOrderId === draft.productionOrderId)
    .flatMap((record) => record.materialLines)
    .filter((line) => (
      getCutOrderId(line) === originalCutOrderId && getCutOrderNo(line) === originalCutOrderNo
    ))
  const demandLines = draft.lines.filter((line) => (
    line.basis.shortageMaterial.materialPatternMappingId.trim() === demand.materialPatternMappingId.trim()
  ))
  const expectedMaterialSkus = new Set(demandLines.map((line) => (
    line.basis.shortageMaterial.line.materialIdentity?.materialSku
      || line.basis.shortageMaterial.line.materialSku
  ).trim()).filter(Boolean))
  const expectedMaterialNames = new Set(demandLines.map((line) => line.basis.shortageMaterial.materialName.trim()).filter(Boolean))
  const materialMatches = containerLines.filter((line) => {
    const materialSku = (line.materialIdentity?.materialSku || line.materialSku).trim()
    const materialName = (line.materialIdentity?.materialName || line.materialLabel).trim()
    return expectedMaterialSkus.has(materialSku)
      && expectedMaterialNames.has(materialName)
      && materialSku === demand.materialSku.trim()
      && materialName === demand.materialName.trim()
  })
  if (materialMatches.length === 1) {
    return {
      ok: true,
      value: {
        originalCutOrderId,
        originalCutOrderNo,
        materialLine: structuredClone(materialMatches[0]),
      },
    }
  }
  if (draft.sourceType === 'release-snapshot') {
    const releaseMaterialIds = new Set(demandLines.flatMap((line) => {
      const bomItem = line.basis.shortageMaterial.bomItem
      const materialCode = bomItem?.materialCode?.trim() || ''
      return [
        materialCode,
        materialCode.replace(/^RELEASE-/i, ''),
        bomItem?.id?.split('-').at(-1)?.trim() || '',
      ].filter(Boolean)
    }))
    const releaseSources = listCutPieceReleaseRecords()
      .filter((record) => record.productionOrderId === draft.productionOrderId)
      .flatMap((record) => record.sourceStates)
      .filter((source) => (
        source.cutOrderId === originalCutOrderId
        && source.cutOrderNo === originalCutOrderNo
        && source.materialIds.some((materialId) => releaseMaterialIds.has(materialId.trim()))
      ))
    const uniqueDemandMaterialLines = [...new Map(demandLines.map((line) => {
      const materialLine = line.basis.shortageMaterial.line
      const materialSku = (materialLine.materialIdentity?.materialSku || materialLine.materialSku).trim()
      const materialName = (materialLine.materialIdentity?.materialName || materialLine.materialLabel).trim()
      return [`${materialSku}\u0000${materialName}`, materialLine] as const
    })).values()].filter((line) => (
      (line.materialIdentity?.materialSku || line.materialSku).trim() === demand.materialSku.trim()
      && (line.materialIdentity?.materialName || line.materialLabel).trim() === demand.materialName.trim()
    ))
    if (releaseSources.length === 1 && uniqueDemandMaterialLines.length === 1) {
      return {
        ok: true,
        value: {
          originalCutOrderId,
          originalCutOrderNo,
          materialLine: structuredClone(uniqueDemandMaterialLines[0]),
        },
      }
    }
    return {
      ok: false,
      message: releaseSources.length > 1 || uniqueDemandMaterialLines.length > 1
        ? `原裁片单 ${originalCutOrderNo} 内存在多条与物料 ${demand.materialSku} / ${demand.materialName} 一致的放行明细，无法唯一解析。`
        : `原裁片单 ${originalCutOrderNo} 内未找到与物料 ${demand.materialSku} / ${demand.materialName} 一致的放行明细。`,
    }
  }
  if (containerLines.length > 0) {
    return {
      ok: false,
      message: materialMatches.length === 0
        ? `原裁片单 ${originalCutOrderNo} 内未找到与物料 ${demand.materialSku} / ${demand.materialName} 一致的明细。`
        : `原裁片单 ${originalCutOrderNo} 内存在多条与物料 ${demand.materialSku} / ${demand.materialName} 一致的明细，无法唯一解析。`,
    }
  }

  return { ok: false, message: `补料物料 ${demand.materialName} 缺少属于当前生产单的原裁片单。` }
}

let supplementRecordSaveFailureForTest = false
let supplementWorkOrderLookupFailureForTest = false

export function setSupplementRecordSaveFailureForTest(shouldFail: boolean): void {
  supplementRecordSaveFailureForTest = shouldFail
}

export function setSupplementWorkOrderLookupFailureForTest(shouldFail: boolean): void {
  supplementWorkOrderLookupFailureForTest = shouldFail
}

function resolveSupplementGeneratedWorkOrder(workOrderId: string) {
  if (supplementWorkOrderLookupFailureForTest) {
    supplementWorkOrderLookupFailureForTest = false
    return undefined
  }
  return getProcessWorkOrderById(workOrderId)
}

function buildSupplementLineSummary(lines: SupplementLine[]): string {
  const summary = lines
    .slice(0, 4)
    .map((line) => `${line.color}/${line.size}/${line.supplementQty}件`)
    .join('；')
  return summary.length > 80 ? `${summary.slice(0, 80)}…` : summary
}

function saveConfirmedSupplementRecord(input: {
  identity: { id: string; recordNo: string }
  draft: SupplementDraft
  createdBy: string
  processWorkOrderRefs: SupplementProcessWorkOrderRef[]
  supplyDecisionSnapshots: SupplementMaterialSupplyDecisionSnapshot[]
  createdPurchaseOrderRefs: SupplementCreatedPurchaseOrderRef[]
  confirmationKey: string
  requestFingerprint: string
  createdAt: string
}): SupplementOrderLifecycle {
  if (supplementRecordSaveFailureForTest) throw new Error('模拟补料记录保存失败')
  const originalCutOrderId = input.draft.materialDemands[0]?.originalCutOrderId?.trim() || ''
  const originalCutOrderNo = input.draft.materialDemands[0]?.originalCutOrderNo?.trim() || ''
  const record = registerSupplementOrder({
    id: input.identity.id,
    recordNo: input.identity.recordNo,
    cutOrderId: originalCutOrderId || input.draft.candidateId || '',
    cutOrderNo: originalCutOrderNo || input.draft.sourceNo || '',
    productionOrderId: input.draft.productionOrderId,
    productionOrderNo: input.draft.productionOrderNo,
    reason: input.draft.reason,
    reasonDetail: input.draft.reasonDetail,
    totalQty: input.draft.lines.reduce((sum, line) => sum + Number(line.supplementQty || 0), 0),
    lineSummary: buildSupplementLineSummary(input.draft.lines),
    lines: input.draft.lines,
    materialDemands: input.draft.materialDemands,
    processWorkOrderRefs: input.processWorkOrderRefs,
    confirmationKey: input.confirmationKey,
    requestFingerprint: input.requestFingerprint,
    draftMeta: {
      candidateId: input.draft.candidateId,
      sourceType: input.draft.sourceType,
      sourceNo: input.draft.sourceNo,
      styleName: input.draft.styleName,
      spuCode: input.draft.spuCode,
      styleImageUrl: normalizeText(input.draft.styleImageUrl) || getSpuImageUrl(getCandidateById(input.draft.candidateId)!.record),
      styleImageAlt: normalizeText(input.draft.styleImageAlt) || `${input.draft.styleName}（${input.draft.spuCode}）款式图`,
      ...(input.draft.releaseSnapshotId ? { releaseSnapshotId: input.draft.releaseSnapshotId } : {}),
      ...(input.draft.releaseMatrixVersion != null ? { releaseMatrixVersion: input.draft.releaseMatrixVersion } : {}),
      ...(input.draft.releaseTargetConfirmedAt ? { releaseTargetConfirmedAt: input.draft.releaseTargetConfirmedAt } : {}),
    },
    supplyDecisionSnapshots: input.supplyDecisionSnapshots,
    createdPurchaseOrderRefs: input.createdPurchaseOrderRefs,
    materialPrepDemandId: `SUP-PREP:${input.identity.id}`,
    createdAt: input.createdAt,
    createdBy: input.createdBy.trim() || '系统',
  })
  state.records = listSupplementOrders()
  return record
}

export function confirmSupplementAndGenerateProcessWorkOrders(
  draft: SupplementDraft,
  createdBy: string,
): { ok: true; record: SupplementOrderLifecycle } | { ok: false; message: string } {
  const confirmationKey = buildSupplementConfirmationIdentity(draft)
  const requestFingerprint = buildSupplementRequestFingerprint(draft)
  const identity = buildSupplementRecordIdentity(draft)
  const existingByConfirmationKey = listSupplementOrders().find((record) => record.confirmationKey === confirmationKey)
  if (existingByConfirmationKey) {
    if (existingByConfirmationKey.requestFingerprint !== requestFingerprint) {
      return { ok: false, message: '同一确认键对应的补料请求已发生变化，请使用新的确认键。' }
    }
    return { ok: true, record: structuredClone(existingByConfirmationKey) }
  }
  const idCollision = listSupplementOrders().find((record) => record.id === identity.id)
  if (idCollision) return { ok: false, message: '补料确认键发生编号冲突，不得复用其他补料记录。' }
  if (!draft.lines.length) return { ok: false, message: '补料单至少需要一条补料明细。' }
  if (draft.lines.some((line) => !Number.isFinite(line.supplementQty) || line.supplementQty <= 0 || !Number.isInteger(line.supplementQty))) {
    return { ok: false, message: '每条裁片补料数量必须是大于 0 的有限整数。' }
  }
  if (!draft.materialDemands.length) {
    return { ok: false, message: '补料单至少需要一条可追溯到原裁片单和冻结 BOM 的补料物料。' }
  }
  if (draft.materialDemands.some((demand) => !demand.unit.trim())) {
    return { ok: false, message: '冻结 BOM 的物料单位必须维护，不能用默认单位生成补料需求。' }
  }
  if (draft.materialDemands.some((demand) => !Number.isFinite(demand.requiredQty) || demand.requiredQty <= 0)) {
    return { ok: false, message: '冻结 BOM 的单耗和损耗必须有效，不能用默认值生成补料需求。' }
  }
  if (draft.materialDemands.some((demand) => !normalizeText(demand.materialImageUrl))) {
    return { ok: false, message: '存在未配置对应实物图的补料物料，请补齐图片后再确认。' }
  }
  const originalCutOrderIdentities = new Set(draft.materialDemands.map((demand) => (
    `${demand.originalCutOrderId.trim()}\u0000${demand.originalCutOrderNo.trim()}`
  )))
  if (originalCutOrderIdentities.size !== 1) {
    return { ok: false, message: '一张补料单只能对应一张原裁片单，请按原裁片单分别创建。' }
  }
  const sourceRecord = getCandidateById(draft.candidateId)?.record
  if (!normalizeText(draft.styleImageUrl) && (!sourceRecord || !getSpuImageUrl(sourceRecord))) {
    return { ok: false, message: '当前款式缺少对应真实图片，请补齐图片后再确认。' }
  }

  const snapshot = getProductionOrderTechPackSnapshot(draft.productionOrderId)
  if (!snapshot || !snapshot.sourceTechPackVersionId.trim()) {
    return { ok: false, message: `生产单 ${draft.productionOrderNo || draft.productionOrderId} 缺少冻结技术包版本，不能确认补料。` }
  }

  const matchedDemands: Array<{
    demand: SupplementMaterialDemand
    bomItem: TechPackBomItemSnapshot
    originalCutOrder: { originalCutOrderId: string; originalCutOrderNo: string; materialLine: CuttingMaterialLine }
  }> = []
  const demandsByMapping = new Map<string, SupplementMaterialDemand>()
  for (const demand of draft.materialDemands) {
    const mappingId = demand.materialPatternMappingId.trim()
    if (!mappingId || demandsByMapping.has(mappingId)) {
      return { ok: false, message: '补料物料与明细的关联必须唯一。' }
    }
    demandsByMapping.set(mappingId, demand)
  }
  const coveredMappings = new Set<string>()
  for (const line of draft.lines) {
    const shortage = line.basis.shortageMaterial
    const mappingId = shortage.materialPatternMappingId.trim()
    const demand = demandsByMapping.get(mappingId)
    if (!demand) return { ok: false, message: '每条补料明细必须由且仅由一条物料记录覆盖。' }
    coveredMappings.add(mappingId)
    if (shortage.materialSku.trim() !== demand.materialSku.trim() || shortage.materialName.trim() !== demand.materialName.trim()) {
      return { ok: false, message: `补料明细与物料记录的物料编码或名称不一致：${demand.materialName}` }
    }
    const lineBomItemId = shortage.bomItem?.id || shortage.mappingLine?.bomItemId || ''
    if (!lineBomItemId || lineBomItemId !== demand.sourceBomItemId.trim()) {
      return { ok: false, message: `补料明细 ${line.key} 与冻结 BOM 行不一致。` }
    }
    if (getCutOrderId(shortage.line) !== demand.originalCutOrderId.trim()
      || getCutOrderNo(shortage.line) !== demand.originalCutOrderNo.trim()) {
      return {
        ok: false,
        message: `补料明细 ${line.key} 的原裁片单 ${getCutOrderId(shortage.line)} / ${getCutOrderNo(shortage.line)} 与物料记录 ${demand.originalCutOrderId.trim()} / ${demand.originalCutOrderNo.trim()} 不一致。`,
      }
    }
  }
  if (coveredMappings.size !== demandsByMapping.size) {
    return { ok: false, message: '每条补料物料都必须至少覆盖一条补料明细。' }
  }
  for (const demand of draft.materialDemands) {
    const matched = resolveUniqueSupplementBomItem({
      bomItems: snapshot.bomItems,
      sourceBomItemId: demand.sourceBomItemId,
      materialSku: demand.materialSku,
      materialName: demand.materialName,
    })
    if (!matched.ok) return matched
    if (matched.bomItem.type === '成衣') {
      return { ok: false, message: `补料物料 ${demand.materialName} 匹配到成衣 BOM，不能生成裁片补料印染加工单。` }
    }
    if (demand.techPackVersionId && demand.techPackVersionId !== snapshot.sourceTechPackVersionId) {
      return { ok: false, message: `补料物料 ${demand.materialName} 不是生产单冻结技术包版本中的物料。` }
    }
    const resolvedOriginalCutOrder = resolveSupplementOriginalCutOrder(draft, demand)
    if (!resolvedOriginalCutOrder.ok) return resolvedOriginalCutOrder
    const originalCutOrder = resolvedOriginalCutOrder.value
    if (draft.sourceType === 'cut-order' && draft.sourceNo.trim() !== originalCutOrder.originalCutOrderNo) {
      return { ok: false, message: '补料来源裁片单与物料记录的原裁片单不一致。' }
    }
    const demandLine = draft.lines.find((line) => line.basis.shortageMaterial.materialPatternMappingId.trim() === demand.materialPatternMappingId.trim())!
    const expectedCutMaterialSku = demandLine.basis.shortageMaterial.line.materialIdentity?.materialSku
      || demandLine.basis.shortageMaterial.line.materialSku
    const actualCutMaterialSku = originalCutOrder.materialLine.materialIdentity?.materialSku
      || originalCutOrder.materialLine.materialSku
    if (expectedCutMaterialSku.trim() !== actualCutMaterialSku.trim()) {
      return { ok: false, message: `原裁片单的物料 ${actualCutMaterialSku} 与当前补料 BOM 物料不一致。` }
    }
    const actualCutMaterialName = originalCutOrder.materialLine.materialIdentity?.materialName
      || originalCutOrder.materialLine.materialLabel
    if (demand.materialName.trim() !== actualCutMaterialName.trim()) {
      return { ok: false, message: `原裁片单的物料名称 ${actualCutMaterialName} 与当前补料物料不一致。` }
    }
    matchedDemands.push({ demand, bomItem: matched.bomItem, originalCutOrder })
  }

  const processGroups = new Map<string, {
    bomItem: TechPackBomItemSnapshot
    demands: SupplementMaterialDemand[]
    processCodes: Array<'DYE' | 'PRINT'>
    originalCutOrder: { originalCutOrderId: string; originalCutOrderNo: string; materialLine: CuttingMaterialLine }
  }>()
  for (const { demand, bomItem, originalCutOrder } of matchedDemands) {
    const processCodes = (['DYE', 'PRINT'] as const).filter((processCode) =>
      processCode === 'DYE'
        ? hasProcessRequirement(bomItem.dyeRequirement)
        : hasProcessRequirement(bomItem.printRequirement),
    )
    if (!processCodes.length) continue
    const existingGroup = processGroups.get(bomItem.id)
    if (existingGroup) {
      if (existingGroup.originalCutOrder.originalCutOrderId !== originalCutOrder.originalCutOrderId) {
        return { ok: false, message: `同一冻结 BOM ${bomItem.id} 关联了多个原裁片单，请拆分补料后再确认。` }
      }
      existingGroup.demands.push(demand)
    } else {
      processGroups.set(bomItem.id, { bomItem, demands: [demand], processCodes, originalCutOrder })
    }
  }

  const generationInputs: ProcessWorkOrderGenerationInput[] = []
  const generationDemandIds: string[][] = []
  for (const group of processGroups.values()) {
    const bomUnit = group.bomItem.unit?.trim() || group.demands[0]?.unit?.trim() || ''
    const representativeDemand = group.demands[0]
    const materialCode = representativeDemand.materialSku.trim()
    if (!bomUnit || !materialCode) {
      return { ok: false, message: `冻结技术包 BOM ${group.bomItem.id} 缺少单位或补料物料编码，不能生成印染加工单。` }
    }
    const demandIds = new Set(group.demands.map((demand) => demand.materialPatternMappingId))
    const supplementQty = draft.lines
      .filter((line) => demandIds.has(line.basis.shortageMaterial.materialPatternMappingId))
      .reduce((sum, line) => sum + Number(line.supplementQty || 0), 0)
    const plannedQty = roundProcessQty(
      supplementQty * group.bomItem.unitConsumption * (1 + normalizeLossRate(group.bomItem.lossRate)),
    )
    if (!Number.isFinite(plannedQty) || plannedQty <= 0) {
      return { ok: false, message: `补料物料 ${group.bomItem.name} 的加工数量无效，请核对补料数量和 BOM 用量。` }
    }
    generationInputs.push({
      source: {
        sourceType: 'CUT_PIECE_SUPPLEMENT',
        productionOrderId: draft.productionOrderId,
        productionOrderNo: draft.productionOrderNo,
        techPackVersionId: snapshot.sourceTechPackVersionId,
        techPackVersionLabel: snapshot.sourceTechPackVersionLabel || snapshot.versionLabel,
        bomItemId: group.bomItem.id,
        supplementRecordId: identity.id,
        supplementRecordNo: identity.recordNo,
        originalCutOrderId: group.originalCutOrder.originalCutOrderId,
        originalCutOrderNo: group.originalCutOrder.originalCutOrderNo,
      },
      processCodes: group.processCodes,
      orderedAt: nowText(),
      materialId: materialCode,
      materialName: representativeDemand.materialName,
      materialItems: [{
        sourceBomItemId: group.bomItem.id,
        materialId: materialCode,
        materialName: representativeDemand.materialName,
      }],
      targetColor: [...new Set(draft.lines.map((line) => line.color).filter(Boolean))].join('、') || group.bomItem.colorLabel || '按技术包配色',
      plannedQty,
      qtyUnit: bomUnit,
      dyeProcessName: group.bomItem.dyeRequirement || '染色',
      printProcessName: group.bomItem.printRequirement || '印花',
      requiresWaterSoluble: group.bomItem.waterSolubleRequirement === '是',
      spuCode: draft.spuCode,
      spuName: draft.styleName,
      requiredDeliveryDate: '',
      createdBy,
    })
    generationDemandIds.push(group.demands.map((demand) => demand.key))
  }

  const createdAt = nowText()
  const supplyDecisionSnapshots = buildSupplementSupplyDecisions({
    demands: draft.materialDemands,
    checkedAt: createdAt,
    confirmUncovered: draft.supplyRiskConfirmed === true,
  })
  if (supplyDecisionSnapshots.some((decision) => decision.uncoveredQty > 0 && decision.businessDecision !== '确认继续')) {
    return { ok: false, message: '存在库存和采购在途未覆盖的物料，请由业务确认是否继续。' }
  }

  let transaction: ReturnType<typeof prepareProcessWorkOrderBatch> | null = null
  try {
    const createdPurchaseOrderRefs: SupplementCreatedPurchaseOrderRef[] = supplyDecisionSnapshots
      .filter((decision) => decision.newPurchaseRequired)
      .map((decision) => {
        const demand = draft.materialDemands.find((item) => item.key === decision.materialDemandId)!
        const purchase = registerSupplementPurchaseOrder({
          supplementOrderId: identity.id,
          materialDemandId: decision.materialDemandId,
          materialSku: demand.materialSku,
          purchaseQty: decision.uncoveredQty,
          unit: decision.unit,
          createdAt,
        })
        return {
          purchaseOrderId: purchase.purchaseOrderId,
          purchaseOrderNo: purchase.purchaseOrderNo,
          materialDemandId: purchase.materialDemandId,
          materialSku: purchase.materialSku,
          purchaseQty: purchase.purchaseQty,
          unit: purchase.unit,
        }
      })
    const processWorkOrderRefs: SupplementProcessWorkOrderRef[] = []
    transaction = prepareProcessWorkOrderBatch(generationInputs)
    const ensuredBatch = transaction.commit()
    generationInputs.forEach((input, inputIndex) => {
      const ensured = ensuredBatch[inputIndex]
      const ids = [
        ensured.dyeWorkOrderId ? { processType: 'DYE' as const, id: ensured.dyeWorkOrderId } : null,
        ensured.printWorkOrderId ? { processType: 'PRINT' as const, id: ensured.printWorkOrderId } : null,
      ].filter((item): item is { processType: 'DYE' | 'PRINT'; id: string } => Boolean(item))
      ids.forEach(({ processType, id }) => {
        const workOrder = resolveSupplementGeneratedWorkOrder(id)
        if (!workOrder) throw new Error(`生成的${processType === 'DYE' ? '染色' : '印花'}加工单无法读取`)
        processWorkOrderRefs.push({
          processType,
          sourceType: 'CUT_PIECE_SUPPLEMENT',
          workOrderId: workOrder.workOrderId,
          workOrderNo: workOrder.workOrderNo,
          materialSku: workOrder.materialSku,
          materialName: workOrder.materialName,
          materialDemandIds: [...(generationDemandIds[inputIndex] ?? [])],
          plannedQty: workOrder.plannedQty,
          unit: workOrder.plannedUnit,
        })
      })
    })
    for (const demand of draft.materialDemands.filter((item) => item.dyeRequired && item.printRequired)) {
      const dyeRefs = processWorkOrderRefs.filter((ref) => ref.processType === 'DYE' && ref.materialDemandIds.includes(demand.key))
      const printRefs = processWorkOrderRefs.filter((ref) => ref.processType === 'PRINT' && ref.materialDemandIds.includes(demand.key))
      printRefs.forEach((printRef) => registerSupplementPrintPrerequisite({
        supplementOrderId: identity.id,
        printWorkOrderId: printRef.workOrderId,
        materialSku: demand.materialSku,
        expectedInputQty: printRef.plannedQty,
        unit: printRef.unit,
        dyeWorkOrderIds: dyeRefs.map((ref) => ref.workOrderId),
      }))
    }
    const record = saveConfirmedSupplementRecord({
        identity,
        draft,
        createdBy,
        processWorkOrderRefs,
        supplyDecisionSnapshots,
        createdPurchaseOrderRefs,
        confirmationKey,
        requestFingerprint,
        createdAt,
      })
    registerSupplementMaterialPrepDemand({
      supplementOrderId: record.id,
      supplementOrderNo: record.recordNo,
      productionOrderId: record.productionOrderId,
      productionOrderNo: record.productionOrderNo,
      cutOrderId: record.cutOrderId,
      cutOrderNo: record.cutOrderNo,
      sequenceNo: record.sequenceNo,
      reason: [record.reason, record.reasonDetail].filter(Boolean).join('：'),
      materialDemands: record.materialDemands,
      supplyDecisionSnapshots: record.supplyDecisionSnapshots,
      createdPurchaseOrderRefs: record.createdPurchaseOrderRefs,
      createdAt,
    })
    return { ok: true, record }
  } catch (error) {
    removeSupplementMaterialPrepDemandForRollback(identity.id)
    removeSupplementOrderForRollback(identity.id, confirmationKey)
    removeSupplementPurchaseOrders(identity.id)
    removeSupplementPrintPrerequisites(identity.id)
    if (transaction) {
      try {
        transaction.rollback()
      } catch (rollbackError) {
        const original = error instanceof Error ? error : new Error(String(error))
        const aggregate = new AggregateError([original, rollbackError], `${original.message}；回滚加工单失败`, { cause: original })
        return { ok: false, message: aggregate.message }
      }
    }
    return { ok: false, message: error instanceof Error ? error.message : '补料确认未完成，请核对后重试。' }
  }
}

export function listSupplementRecords(): SupplementOrderLifecycle[] {
  return listSupplementOrders()
}

function buildMockDraft(
  candidate: SupplementCandidate,
  reason: string,
  reasonDetail: string,
): SupplementDraft | null {
  const lines = candidate.abAnalysisRows
    .filter((basis) => basis.suggestedSupplementQty > 0 || basis.shortageQty > 0)
    .slice(0, 2)
    .map((basis) => ({
      ...(candidate.sizeColorRows.find((line) => line.key === makeSizeColorKey(basis)) || {
        key: makeSizeColorKey(basis),
        skuCode: basis.skuCode,
        color: basis.color,
        size: basis.size,
        plannedQty: basis.plannedQty,
        actualCutPieces: basis.currentRoleCutQty,
        inboundPieces: 0,
        completeSetQty: basis.benchmarkCutQty,
        inboundSetQty: 0,
        shortageQty: basis.shortageQty,
        existingSupplementQty: basis.existingSupplementQty,
        suggestedSupplementQty: basis.suggestedSupplementQty,
        relatedCutOrderNos: basis.relatedCutOrderNos,
      }),
      shortageQty: basis.shortageQty,
      existingSupplementQty: basis.existingSupplementQty,
      suggestedSupplementQty: basis.suggestedSupplementQty,
      supplementQty: Math.max(Math.min(basis.suggestedSupplementQty || basis.shortageQty, 160), 1),
      basis,
      isManualAdjusted: false,
      adjustReason: '',
    }))
  if (!lines.length) return null

  const materialDemands = buildMaterialDemands(candidate, lines)
  if (!materialDemands.length) return null

  return {
    candidateId: candidate.id,
    sourceType: candidate.sourceType,
    sourceNo: candidate.sourceNo,
    productionOrderId: candidate.record.productionOrderId,
    productionOrderNo: candidate.record.productionOrderNo,
    styleName: candidate.record.styleName,
    spuCode: candidate.record.spuCode,
    reason,
    reasonDetail,
    lines,
    materialDemands,
  }
}

export function listSupplementDraftsForTesting(): SupplementDraft[] {
  return buildCandidates()
    .filter((candidate) => candidate.canInitiate)
    .map((candidate) => buildMockDraft(candidate, '裁片损耗', '专项检查补料说明。'))
    .filter((draft): draft is SupplementDraft => Boolean(draft))
}

function ensureMockSupplementOrders(): void {
  if (mockSupplementOrdersSeeded) return
  mockSupplementOrdersSeeded = true
  state.records = listSupplementOrders()

  const seedSourceOrder = [
    'CUT-260302-004-01',
    'CUT-260306-101-03',
    'CUT-260306-101-04',
    'CUT-260306-101-05',
    'CUT-260306-101-06',
    'CUT-260303-002-01',
    'CUT-260306-101-01',
    'CUT-260306-101-02',
    'CUT-260303-007-01',
    'CUT-260301-003-01',
    'CUT-260301-005-01',
    'PO-202603-0008',
  ]
  const seedSourceSet = new Set(seedSourceOrder)
  const candidates = cuttingOrderProgressRecords
    .filter((record) => ['PO-202603-0002', 'PO-202603-0003', 'PO-202603-0004', 'PO-202603-0008'].includes(record.productionOrderId))
    .flatMap((record) => [
      ...(record.productionOrderId === 'PO-202603-0008' ? [buildProductionCandidate(record)] : []),
      ...buildCutOrderCandidates(record).filter((candidate) => seedSourceSet.has(candidate.sourceNo)),
    ])
    .filter((candidate) => candidate.canInitiate && candidate.abAnalysisRows.length > 0)
    .sort((left, right) => seedSourceOrder.indexOf(left.sourceNo) - seedSourceOrder.indexOf(right.sourceNo))
  if (!candidates.length) return
  const reasons = ['裁片损耗', '尺码齐套不足', '验片破损', '裁剪差异']
  const details = [
    '验片后发现左前片有破损，需要按裁片单新增补料。',
    '生产单部分尺码齐套不足，需要补齐后续车缝用料。',
    '现场复核发现裁片损坏，按实际缺口补齐。',
    '裁剪数量与计划存在差异，主管确认后发起补料。',
  ]
  const creators = ['裁床主管 周敏', '裁床组长 林洁', '验片主管 陈玲', '裁床主管 王海']
  let coveredSeedCount = 0
  for (let index = 0; index < candidates.length * 2 && coveredSeedCount < 8; index += 1) {
    const candidate = candidates[index % candidates.length]
    const draft = buildMockDraft(
      candidate,
      reasons[index % reasons.length],
      details[index % details.length],
    )
    if (!draft) continue
    const lines = draft.lines.map((line, lineIndex) => ({
      ...line,
      supplementQty: line.supplementQty + (index % 4) + lineIndex,
    }))
    const materialDemands = buildMaterialDemands(candidate, lines)
    const variedDraft: SupplementDraft = {
      ...draft,
      lines,
      materialDemands,
      confirmationIdentity: `supplement-page-seed-${index + 1}`,
      supplyRiskConfirmed: true,
    }
    const confirmationKey = buildSupplementConfirmationIdentity(variedDraft)
    const existingSeed = state.records.find((record) => record.confirmationKey === confirmationKey)
    if (existingSeed) {
      coveredSeedCount += 1
      continue
    }
    const hasProcessDemand = variedDraft.materialDemands.some((demand) => demand.printRequired || demand.dyeRequired)
    const confirmed = hasProcessDemand
      ? confirmSupplementAndGenerateProcessWorkOrders(variedDraft, creators[index % creators.length])
      : {
          ok: true as const,
          record: saveConfirmedSupplementRecord({
            identity: buildSupplementRecordIdentity(variedDraft),
            draft: variedDraft,
            createdBy: creators[index % creators.length],
            processWorkOrderRefs: [],
            confirmationKey,
            requestFingerprint: buildSupplementRequestFingerprint(variedDraft),
          }),
        }
    if (!confirmed.ok) continue
    coveredSeedCount += 1
  }

  state.records = listSupplementOrders()
}

export function bootstrapSupplementManagementMockData(): SupplementOrderLifecycle[] {
  ensureFixedSupplementOrderFixturesRegistered()
  ensureMockSupplementOrders()
  return listSupplementOrders()
}

export function resetSupplementManagementMockDataForTest(): void {
  mockSupplementOrdersSeeded = false
  state.records = []
  resetSupplementOrderRegistryForTesting()
}

function setFiltersFromDom(): void {
  const sourceType = document.querySelector<HTMLSelectElement>('[data-cutting-supplement-field="sourceType"]')?.value
  const keyword = document.querySelector<HTMLInputElement>('[data-cutting-supplement-field="keyword"]')?.value
  const value = (field: string) => document.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-cutting-supplement-field="${field}"]`)?.value || ''
  state.filters = {
    sourceType: sourceType === 'production-order' || sourceType === 'cut-order' || sourceType === 'release-snapshot' ? sourceType : 'ALL',
    keyword: normalizeText(keyword),
    recordNo: normalizeText(value('recordNo')),
    productionOrderNo: normalizeText(value('productionOrderNo')),
    cutOrderNo: normalizeText(value('cutOrderNo')),
    styleKeyword: normalizeText(value('styleKeyword')),
    status: value('status') === '未完成' || value('status') === '已完成' ? value('status') as '未完成' | '已完成' : 'ALL',
    purchase: value('purchase') === '需要' || value('purchase') === '不需要' ? value('purchase') as '需要' | '不需要' : 'ALL',
    dye: value('dye') === '需要' || value('dye') === '不需要' ? value('dye') as '需要' | '不需要' : 'ALL',
    print: value('print') === '需要' || value('print') === '不需要' ? value('print') as '需要' | '不需要' : 'ALL',
    currentNode: normalizeText(value('currentNode')),
    createdDate: normalizeText(value('createdDate')),
  }
}

function setSourcePickerKeywordFromDom(): void {
  const keyword = document.querySelector<HTMLInputElement>('[data-cutting-supplement-field="sourcePickerKeyword"]')?.value
  state.sourcePicker.keyword = normalizeText(keyword)
  state.sourcePicker.selectedCandidateId = ''
}

function clearSupplementCreateState(): void {
  state.activeCandidateId = ''
  state.sourcePicker = {
    sourceType: 'production-order',
    keyword: '',
    selectedCandidateId: '',
  }
  state.pendingConfirmDraft = null
  state.confirmStepActive = false
  state.releaseSnapshotDraft = null
  state.releaseSnapshotError = ''
}

export function isCraftCuttingSupplementManagementDialogOpen(): boolean {
  return Boolean(state.activeRecordId || state.imagePreview)
}

export function handleCraftCuttingSupplementManagementEvent(target: HTMLElement, event?: Event): boolean {
  bootstrapSupplementManagementMockData()
  const internalDragEvent = event as (DragEvent & {
    higoodStandardListColumnDrag?: true
    higoodStandardListColumnKey?: string
  }) | undefined
  if (event?.type === 'keydown' && (event as KeyboardEvent).key === 'Escape' && state.imagePreview) {
    state.imagePreview = null
    refreshSupplementOverlay()
    return true
  }
  if (event?.type === 'dragend') {
    if (!internalDragEvent?.higoodStandardListColumnDrag) return false
    state.draggedColumnKey = ''
    return true
  }

  const dragNode = target.closest<HTMLElement>('[data-standard-list-column-drag]')
  if (
    dragNode
    && event
    && internalDragEvent?.higoodStandardListColumnDrag
    && ['dragstart', 'dragover', 'drop'].includes(event.type)
  ) {
    const dragEvent = internalDragEvent
    const columnKey = dragNode.dataset.cuttingSupplementColumnKey
      || dragNode.dataset.dragSource
      || dragNode.dataset.dropTarget
      || ''
    const column = supplementListColumns.find((item) => item.key === columnKey && !item.actionColumn)

    if (event.type === 'dragstart') {
      state.draggedColumnKey = column?.key || ''
      if (!column) return false
      dragEvent.dataTransfer?.setData('application/x-higood-list-column-key', column.key)
      if (dragEvent.dataTransfer) dragEvent.dataTransfer.effectAllowed = 'move'
      return true
    }

    const sourceKey = dragEvent.higoodStandardListColumnKey || ''
    const sourceColumn = supplementListColumns.find((item) => item.key === sourceKey && !item.actionColumn)
    const targetColumn = supplementListColumns.find((item) => item.key === columnKey && !item.actionColumn)
    if (
      !sourceColumn
      || !targetColumn
      || state.draggedColumnKey !== sourceColumn.key
      || sourceColumn.key === targetColumn.key
    ) {
      if (event.type === 'drop') state.draggedColumnKey = ''
      return false
    }

    if (event.type === 'dragover') {
      event.preventDefault()
      if (dragEvent.dataTransfer) dragEvent.dataTransfer.dropEffect = 'move'
      return true
    }

    state.draggedColumnKey = ''
    event.preventDefault()
    const order = state.columnPreferences.order.filter((key) => key !== sourceColumn.key)
    const targetIndex = order.indexOf(targetColumn.key)
    if (targetIndex < 0) return false
    order.splice(targetIndex, 0, sourceColumn.key)
    state.columnPreferences = normalizeSupplementListPreferences({
      ...state.columnPreferences,
      order,
    })
    saveSupplementListPreferences()
    refreshSupplementTable()
    refreshSupplementOverlay()
    return true
  }

  const fieldNode = target.closest<HTMLInputElement | HTMLSelectElement>('[data-cutting-supplement-field]')
  const field = fieldNode?.dataset.cuttingSupplementField
  if (field === 'pageSize') {
    if (event?.type !== 'change') return false
    const pageSize = Number(fieldNode!.value)
    if (supplementListPageSizes.includes(pageSize)) {
      state.columnPreferences = normalizeSupplementListPreferences({
        ...state.columnPreferences,
        pageSize,
      })
      state.page = 1
      saveSupplementListPreferences()
      refreshSupplementTableAndPagination()
    }
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-cutting-supplement-action]')
  const action = actionNode?.dataset.cuttingSupplementAction
  if (action === 'open-image-preview') {
    const src = actionNode?.dataset.imagePreviewSrc || ''
    if (!src) return true
    state.imagePreview = { src, alt: actionNode?.dataset.imagePreviewAlt || '业务对象大图' }
    refreshSupplementOverlay()
    return true
  }
  if (action === 'close-image-preview') {
    state.imagePreview = null
    refreshSupplementOverlay()
    return true
  }
  if (!actionNode || !action) return false

  if (action === 'clear-feedback') {
    state.feedback = null
    refreshSupplementFeedback()
    return true
  }

  if (action === 'apply-filters') {
    setFiltersFromDom()
    state.page = 1
    state.feedback = null
    refreshSupplementFeedback()
    refreshSupplementList()
    return true
  }

  if (action === 'reset-filters') {
    state.filters = { sourceType: 'ALL', keyword: '', recordNo: '', productionOrderNo: '', cutOrderNo: '', styleKeyword: '', status: 'ALL', purchase: 'ALL', dye: 'ALL', print: 'ALL', currentNode: '', createdDate: '' }
    state.page = 1
    state.feedback = null
    refreshSupplementFeedback()
    refreshSupplementFilters()
    refreshSupplementList()
    return true
  }

  if (action === 'prev-page' || action === 'next-page') {
    state.page += action === 'prev-page' ? -1 : 1
    refreshSupplementTableAndPagination()
    return true
  }

  if (action === 'sort-column') {
    const columnKey = actionNode.dataset.columnKey || ''
    const column = supplementListColumns.find((item) => item.key === columnKey && item.sortable)
    if (!column) return true
    state.sort = state.sort?.key !== columnKey
      ? { key: columnKey, direction: 'asc' }
      : state.sort.direction === 'asc'
        ? { key: columnKey, direction: 'desc' }
        : null
    state.page = 1
    refreshSupplementTableAndPagination()
    return true
  }

  if (action === 'open-column-settings') {
    state.columnSettingsOpen = true
    state.activeRecordId = ''
    refreshSupplementOverlay()
    return true
  }

  if (action === 'close-column-settings') {
    state.columnSettingsOpen = false
    refreshSupplementOverlay()
    return true
  }

  if (action === 'toggle-column-visibility') {
    if (event?.type !== 'change') return false
    const columnKey = actionNode.dataset.cuttingSupplementColumnKey || actionNode.dataset.columnKey || ''
    const rule = supplementListColumnRules.find((item) => item.key === columnKey)
    if (!rule || rule.required || rule.actionColumn) return true
    const visibleKeys = new Set(state.columnPreferences.visibleKeys)
    const frozenKeys = new Set(state.columnPreferences.frozenKeys)
    if (visibleKeys.has(columnKey)) {
      visibleKeys.delete(columnKey)
      frozenKeys.delete(columnKey)
    } else {
      visibleKeys.add(columnKey)
    }
    state.columnPreferences = normalizeSupplementListPreferences({
      ...state.columnPreferences,
      visibleKeys: [...visibleKeys],
      frozenKeys: [...frozenKeys],
    })
    if (!visibleKeys.has(columnKey) && state.sort?.key === columnKey) state.sort = null
    saveSupplementListPreferences()
    refreshSupplementTable()
    refreshSupplementOverlay()
    return true
  }

  if (action === 'toggle-column-freeze') {
    if (event?.type !== 'change') return false
    const columnKey = actionNode.dataset.cuttingSupplementColumnKey || actionNode.dataset.columnKey || ''
    const column = supplementListColumns.find((item) => item.key === columnKey)
    if (!column?.freezeable || column.actionColumn) return true
    const frozenKeys = new Set(state.columnPreferences.frozenKeys)
    const addingFreeze = !frozenKeys.has(columnKey)
    if (frozenKeys.has(columnKey)) {
      frozenKeys.delete(columnKey)
    } else {
      frozenKeys.add(columnKey)
    }
    const nextPreferences = normalizeSupplementListPreferences({
      ...state.columnPreferences,
      frozenKeys: [...frozenKeys],
    })
    if (addingFreeze && !nextPreferences.frozenKeys.includes(columnKey)) {
      const visible = state.columnPreferences.visibleKeys.includes(columnKey)
      state.feedback = visible
        ? { tone: 'warning', message: `冻结列总宽度不能超过 ${supplementListMaxFrozenWidth}px，请先取消其他冻结列。` }
        : { tone: 'warning', message: '请先显示该列，再设置冻结。' }
      refreshSupplementFeedback()
      refreshSupplementOverlay()
      return true
    }
    const evictedFrozenKeys = state.columnPreferences.frozenKeys.filter(
      (key) => !nextPreferences.frozenKeys.includes(key),
    )
    state.feedback = addingFreeze && evictedFrozenKeys.length > 0
      ? { tone: 'warning', message: `冻结列总宽度不能超过 ${supplementListMaxFrozenWidth}px，已自动取消后置冻结列。` }
      : null
    state.columnPreferences = nextPreferences
    saveSupplementListPreferences()
    refreshSupplementFeedback()
    refreshSupplementTable()
    refreshSupplementOverlay()
    return true
  }

  if (action === 'restore-column-settings') {
    state.columnPreferences = normalizeSupplementListPreferences(defaultSupplementListColumnPreferences)
    state.page = 1
    state.sort = null
    state.feedback = null
    const storage = getSupplementListStorage()
    if (storage) clearListColumnPreferences(storage, supplementListStorageKey)
    refreshSupplementFeedback()
    refreshSupplementTableAndPagination()
    refreshSupplementOverlay()
    return true
  }

  if (action === 'set-source-picker-type') {
    const sourceType = actionNode.dataset.sourceType
    if (sourceType === 'production-order' || sourceType === 'cut-order') {
      state.sourcePicker.sourceType = sourceType
      state.sourcePicker.selectedCandidateId = ''
      state.feedback = null
    }
    return true
  }

  if (action === 'apply-source-picker-search') {
    setSourcePickerKeywordFromDom()
    state.feedback = null
    return true
  }

  if (action === 'reset-source-picker-search') {
    state.sourcePicker.keyword = ''
    state.sourcePicker.selectedCandidateId = ''
    state.feedback = null
    return true
  }

  if (action === 'toggle-source-candidate') {
    const candidateId = actionNode.dataset.candidateId || ''
    const candidate = getCandidateById(candidateId)
    if (!candidate || !candidate.canInitiate || candidate.sourceType !== state.sourcePicker.sourceType) {
      state.sourcePicker.selectedCandidateId = ''
      state.feedback = { tone: 'warning', message: candidate?.blockedReason || '当前对象不能新增补料。' }
      return true
    }
    state.sourcePicker.selectedCandidateId = state.sourcePicker.selectedCandidateId === candidateId ? '' : candidateId
    state.feedback = null
    return true
  }

  if (action === 'start-create') {
    clearSupplementCreateState()
    state.activeRecordId = ''
    state.columnSettingsOpen = false
    state.page = 1
    state.feedback = null
    return false
  }

  if (action === 'select-candidate') {
    const candidateId = actionNode.dataset.candidateId || ''
    const candidate = getCandidateById(candidateId)
    if (!candidate || !candidate.canInitiate) {
      state.feedback = { tone: 'warning', message: candidate?.blockedReason || '当前对象不能新增补料。' }
      return true
    }
    state.activeCandidateId = candidateId
    state.activeRecordId = ''
    state.pendingConfirmDraft = null
    state.confirmStepActive = false
    state.feedback = null
    return true
  }

  if (action === 'source-picker-next') {
    const candidateId = state.sourcePicker.selectedCandidateId
    const candidate = getCandidateById(candidateId)
    if (!candidate || !candidate.canInitiate) {
      state.feedback = { tone: 'warning', message: '请先勾选一条可新增补料的记录。' }
      return true
    }
    state.activeCandidateId = candidateId
    state.activeRecordId = ''
    state.pendingConfirmDraft = null
    state.confirmStepActive = false
    state.feedback = null
    return true
  }

  if (action === 'open-detail') {
    const recordId = actionNode.dataset.recordId || ''
    const record = getRecordById(recordId)
    if (!record) {
      state.feedback = { tone: 'warning', message: '未找到对应的补料单。' }
      return true
    }
    state.activeRecordId = recordId
    state.columnSettingsOpen = false
    clearSupplementCreateState()
    state.feedback = null
    refreshSupplementFeedback()
    refreshSupplementOverlay()
    return true
  }

  if (action === 'close-detail') {
    state.activeRecordId = ''
    state.feedback = null
    refreshSupplementFeedback()
    refreshSupplementOverlay()
    return true
  }

  if (action === 'back-to-source-picker') {
    state.activeCandidateId = ''
    state.pendingConfirmDraft = null
    state.confirmStepActive = false
    state.feedback = null
    return true
  }

  if (action === 'cancel-create') {
    clearSupplementCreateState()
    state.activeRecordId = ''
    state.feedback = null
    appStore.navigate(supplementManagementPath)
    return true
  }

  if (action === 'return-independent-create') {
    clearSupplementCreateState()
    state.feedback = null
    appStore.navigate(supplementCreatePath)
    return true
  }

  if (action === 'submit-draft') {
    const candidateId = actionNode.dataset.candidateId || state.activeCandidateId
    const candidate = getCandidateById(candidateId)
    const container = actionNode.closest<HTMLElement>('[data-supplement-draft-dialog]')
    if (!candidate || !container) return false
    const draft = buildDraftFromDialog(candidate, container)
    if (!draft) return false
    state.pendingConfirmDraft = draft
    state.confirmStepActive = true
    state.feedback = null
    return true
  }


  if (action === 'submit-release-snapshot-draft') {
    const container = actionNode.closest<HTMLElement>('[data-supplement-draft-dialog]')
    const baseDraft = state.releaseSnapshotDraft
    if (!container || !baseDraft || !baseDraft.releaseSnapshotId) return false
    if (!getCurrentReleaseSnapshotOrInvalidate(baseDraft.releaseSnapshotId)) return true
    const reason = normalizeText(container.querySelector<HTMLSelectElement>('[data-supplement-reason]')?.value)
    const reasonDetail = normalizeText(container.querySelector<HTMLInputElement>('[data-supplement-reason-detail]')?.value)
    if (!reason) {
      showDraftError(container, '补料原因必须选择。')
      return true
    }
    if (!reasonDetail) {
      showDraftError(container, '补料说明必须填写。')
      return true
    }
    const originalCutOrderIdentity = container.querySelector<HTMLSelectElement>('[data-release-original-cut-order]')?.value || ''
    const scopedDraft = scopeReleaseSnapshotDraftToCutOrder(baseDraft, originalCutOrderIdentity)
    if (!scopedDraft) {
      showDraftError(container, '请选择一张有补料明细的原裁片单。')
      return true
    }
    state.pendingConfirmDraft = structuredClone({ ...scopedDraft, reason, reasonDetail })
    state.confirmStepActive = true
    state.feedback = null
    return true
  }

  if (action === 'return-draft') {
    if (state.pendingConfirmDraft?.releaseSnapshotId) {
      state.activeCandidateId = ''
    } else {
      state.activeCandidateId = state.pendingConfirmDraft?.candidateId || state.activeCandidateId
    }
    state.confirmStepActive = false
    state.feedback = null
    return true
  }

  if (action === 'confirm-supplement') {
    if (!state.pendingConfirmDraft) return false
    if (
      state.pendingConfirmDraft.releaseSnapshotId
      && !getCurrentReleaseSnapshotOrInvalidate(state.pendingConfirmDraft.releaseSnapshotId)
    ) return true
    actionNode.setAttribute('disabled', 'true')
    actionNode.setAttribute('aria-busy', 'true')
    const decisions = buildSupplementSupplyDecisions({
      demands: state.pendingConfirmDraft.materialDemands,
      checkedAt: nowText(),
      confirmUncovered: true,
    })
    const confirmedDraft = decisions.some((decision) => decision.uncoveredQty > 0)
      ? { ...state.pendingConfirmDraft, supplyRiskConfirmed: true }
      : state.pendingConfirmDraft
    state.pendingConfirmDraft = confirmedDraft
    const result = confirmSupplementAndGenerateProcessWorkOrders(confirmedDraft, '裁床主管 周敏')
    if (!result.ok) {
      state.feedback = { tone: 'warning', message: result.message }
      actionNode.removeAttribute('disabled')
      actionNode.removeAttribute('aria-busy')
      refreshSupplementFeedback()
      return true
    }
    const record = result.record
    state.page = 1
    state.pendingConfirmDraft = null
    state.confirmStepActive = false
    state.activeCandidateId = ''
    state.activeRecordId = record.id
    state.feedback = { tone: 'success', message: `已确认创建补料单 ${record.recordNo}。` }
    appStore.navigate(supplementManagementPath)
    return true
  }

  if (action === 'close-overlay') {
    if (state.imagePreview) {
      state.imagePreview = null
      refreshSupplementOverlay()
      return true
    }
    state.activeRecordId = ''
    state.columnSettingsOpen = false
    state.pendingConfirmDraft = null
    state.confirmStepActive = false
    refreshSupplementOverlay()
    return true
  }

  return false
}

export function renderCraftCuttingSupplementManagementPage(): string {
  bootstrapSupplementManagementMockData()
  ensureSupplementListPreferences()
  if (isSupplementCreateMode()) {
    return renderCraftCuttingSupplementCreatePage()
  }

  const view = getSupplementListView()
  const columnSettingsButton = withSkipPageRerender(renderSecondaryButton(
    '列设置',
    { prefix: 'cutting-supplement', action: 'open-column-settings' },
    'columns-3',
  ))

  return renderStandardListPage({
    title: '补料管理',
    primaryActionsHtml: `
      <div class="flex flex-wrap gap-2">
        <button type="button" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-cutting-supplement-action="start-create" data-nav="${supplementCreatePath}">新增补料</button>
      </div>
    `,
    feedbackHtml: `<div data-cutting-supplement-region="feedback">${renderFeedback()}</div>`,
    filtersHtml: renderFilters(),
    statsHtml: `<div data-cutting-supplement-region="stats">${renderListStats(view.filtered)}</div>`,
    listTitle: '补料单列表',
    listActionsHtml: columnSettingsButton,
    tableHtml: `<div data-cutting-supplement-region="table">${renderListTable(view.paging)}</div>`,
    paginationHtml: `<div data-cutting-supplement-region="pagination">${renderListPagination(view.paging)}</div>`,
    overlaysHtml: `<div data-cutting-supplement-region="overlay">${renderListOverlay()}</div>`,
  })
}

export function renderCraftCuttingSupplementCreatePage(): string {
  bootstrapSupplementManagementMockData()
  prepareReleaseSnapshotCreateState()
  let activeCandidate = state.activeCandidateId ? getCandidateById(state.activeCandidateId) : undefined
  if (state.activeCandidateId && !activeCandidate) {
    state.activeCandidateId = ''
    activeCandidate = undefined
    state.feedback = { tone: 'warning', message: '未找到对应的补料对象，请重新选择。' }
  }
  const editingDraft = state.confirmStepActive ? null : state.pendingConfirmDraft
  const pageContent = state.confirmStepActive && state.pendingConfirmDraft
    ? renderConfirmPage(state.pendingConfirmDraft)
    : state.releaseSnapshotError
      ? renderReleaseSnapshotError()
      : state.releaseSnapshotDraft
        ? renderReleaseSnapshotCreatePage(state.releaseSnapshotDraft, editingDraft)
        : activeCandidate
          ? renderDraftPage(activeCandidate, editingDraft?.candidateId === activeCandidate.id ? editingDraft : null)
          : renderSourcePickerPage()

  return `
    <div class="space-y-5 p-6">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="text-sm text-muted-foreground">工艺工厂运营系统 / 裁床厂管理 / 裁后处理 / 补料管理 / 新增补料</div>
          <h1 class="mt-2 text-2xl font-semibold tracking-tight">新增补料</h1>
          <p class="mt-1 text-sm text-muted-foreground">按生产单或裁片单发起补料，并按成衣颜色、尺码、面料别名、物料信息和纸样信息填写本次补料件数。</p>
        </div>
        <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-cutting-supplement-action="cancel-create">返回补料列表</button>
      </div>
      ${renderFeedback()}
      ${pageContent}
    </div>
  `
}
