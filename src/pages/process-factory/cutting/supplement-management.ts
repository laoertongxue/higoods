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
import type { TechPackBomItemSnapshot } from '../../../data/fcs/production-tech-pack-snapshot-types.ts'
import type { TechnicalColorMaterialMappingLine } from '../../../data/pcs-technical-data-version-types.ts'
import { buildProductionPieceTruth } from '../../../domain/fcs-cutting-piece-truth/index.ts'
import { appStore } from '../../../state/store.ts'
import {
  getCutPieceReleaseTargetSnapshot,
  listCutPieceReleaseRecords,
  type CutPieceReleaseTargetSnapshot,
} from '../../../data/fcs/cut-piece-release.ts'
import {
  buildSupplementPartShortages,
  type SupplementPartShortage,
} from '../../../data/fcs/cut-piece-release-domain.ts'
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

type SupplementManualSourceType = 'production-order' | 'cut-order'
type SupplementSourceType = SupplementManualSourceType | 'release-snapshot'
type SupplementFilterSourceType = 'ALL' | SupplementSourceType
type SupplementRecordStatus = '已确认'
type SupplementProcessKind = '印花' | '染色'
type SupplementMaterialRole = '面料A' | '面料B' | '面料C' | '里布' | '衬' | '罗纹' | '辅料' | '包材' | '未识别'
type SupplementRoleSource = '物料-纸样关联别名' | '物料行继承别名' | '纸样辅助识别' | '顺序推断' | '未识别'
type SupplementRoleConfirmStatus = '已确认' | '待确认'

interface SupplementFilters {
  sourceType: SupplementFilterSourceType
  keyword: string
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

interface SupplementSizeColorRow {
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

interface SupplementMaterialDemand {
  key: string
  materialPatternMappingId: string
  techPackVersionId: string
  materialSku: string
  materialName: string
  materialTypeLabel: string
  materialImageUrl: string
  materialAlias: string
  materialRole: SupplementMaterialRole
  roleSource: SupplementRoleSource
  roleConfirmStatus: SupplementRoleConfirmStatus
  patternId: string
  patternName: string
  requiredQty: number
  unit: string
  printRequired: boolean
  dyeRequired: boolean
  processNote: string
}

interface SupplementMaterialPatternRef {
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

interface SupplementAbAnalysisRow {
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

interface SupplementLine extends SupplementSizeColorRow {
  supplementQty: number
  basis: SupplementAbAnalysisRow
  isManualAdjusted: boolean
  adjustReason: string
  actualMissingPieceQty?: number
  piecesPerGarment?: number
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

interface SupplementDraft {
  candidateId: string
  sourceType: SupplementSourceType
  sourceNo: string
  productionOrderId: string
  productionOrderNo: string
  styleName: string
  spuCode: string
  reason: string
  reasonDetail: string
  lines: SupplementLine[]
  materialDemands: SupplementMaterialDemand[]
  releaseSnapshotId?: string
  releaseMatrixVersion?: number
  releaseTargetConfirmedAt?: string
}

interface SupplementRecord {
  id: string
  recordNo: string
  status: SupplementRecordStatus
  createdAt: string
  createdBy: string
  draft: SupplementDraft
  printDemandNos: string[]
  dyeDemandNos: string[]
}

interface SupplementProcessLink {
  kind: SupplementProcessKind
  demandNo: string
  workOrderNo: string
  materialSku: string
  materialName: string
  materialImageUrl: string
  requiredQty: number
  unit: string
  demandStatus: string
  workOrderStatus: string
  factoryName: string
  createdAt: string
  linkedProductionOrderNo: string
  processNote: string
}

interface SupplementManagementState {
  filters: SupplementFilters
  sourcePicker: SupplementSourcePickerState
  activeCandidateId: string
  activeRecordId: string
  pendingConfirmDraft: SupplementDraft | null
  releaseSnapshotDraft: SupplementDraft | null
  releaseSnapshotError: string
  creationSourceKey: string
  records: SupplementRecord[]
  feedback: SupplementFeedback | null
  page: number
  sort: StandardListSortState | null
  columnPreferences: StandardListColumnPreferences
  columnSettingsOpen: boolean
  draggedColumnKey: string
}

const supplementListPageSizes = [10, 20, 50]
const supplementListStorageKey = 'higood:list-page:/fcs/craft/cutting/supplement-management'
const supplementListMaxFrozenWidth = 520
const supplementListColumnRules: StandardListColumnRule[] = [
  { key: 'recordNo', required: true, freezeable: true },
  { key: 'target', required: true, freezeable: true },
  { key: 'supplementQty', freezeable: true },
  { key: 'materialDemand' },
  { key: 'processDemand' },
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
  },
  sourcePicker: {
    sourceType: 'production-order',
    keyword: '',
    selectedCandidateId: '',
  },
  activeCandidateId: '',
  activeRecordId: '',
  pendingConfirmDraft: null,
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
}

let mockSupplementOrdersSeeded = false
let supplementListPreferencesLoaded = false

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
  const text = `${record.styleName} ${record.spuCode}`.toLowerCase()
  if (text.includes('jacket') || text.includes('夹克') || text.includes('外套')) return '/jacket-sample.jpg'
  if (text.includes('dress') || text.includes('连衣裙')) return '/dress-sample-1.jpg'
  if (text.includes('shirt') || text.includes('衬衫')) return '/shirt-sample.jpg'
  if (text.includes('short')) return '/denim-shorts-sample.jpg'
  if (text.includes('tshirt') || text.includes('t-shirt')) return '/tshirt-sample.jpg'
  if (text.includes('cardigan') || text.includes('开衫')) return '/cardigan-sample.jpg'
  return '/pants-sample.jpg'
}

function getMaterialImageUrl(line: CuttingMaterialLine): string {
  const existing = normalizeText(line.materialImageUrl || line.materialIdentity?.materialImageUrl)
  if (existing && !existing.includes('placeholder') && !existing.startsWith('data:image/svg')) return existing
  const text = `${line.materialSku} ${line.materialType} ${line.materialCategory || ''} ${getMaterialName(line)}`.toLowerCase()
  if (text.includes('lining') || text.includes('里布')) return '/materials/fabric-lining.jpg'
  if (text.includes('contrast') || text.includes('拼接') || text.includes('配色')) return '/materials/fabric-contrast.jpg'
  if (text.includes('button') || text.includes('纽扣')) return '/materials/accessory-button.jpg'
  if (text.includes('zipper') || text.includes('拉链')) return '/materials/accessory-zipper.jpg'
  if (text.includes('label') || text.includes('唛')) return '/materials/accessory-label.jpg'
  if (text.includes('packing') || text.includes('包装')) return '/materials/packing-bag.jpg'
  if (text.includes('yarn') || text.includes('纱线')) return '/materials/yarn-stitching.jpg'
  return '/materials/fabric-main.jpg'
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

function getExistingSupplementQtyForBasis(record: CuttingOrderProgressRecord, row: Pick<SupplementAbAnalysisRow, 'skuCode' | 'color' | 'size' | 'shortageMaterial'>): number {
  return state.records
    .filter((item) => item.status === '已确认')
    .filter((item) => item.draft.productionOrderId === record.productionOrderId)
    .flatMap((item) => item.draft.lines)
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
    .filter((item) => item.status === '已确认')
    .filter((item) => item.draft.productionOrderId === record.productionOrderId)
    .flatMap((item) => item.draft.lines)
    .filter((line) => line.skuCode === row.skuCode && line.color === row.color && line.size === row.size)
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

function buildReleaseSnapshotMaterialRef(shortage: SupplementPartShortage): SupplementMaterialPatternRef {
  const materialName = displayReleaseMaterialName(shortage.materialId, shortage.materialName)
  const materialRole: SupplementMaterialRole = ['A', 'B', 'C'].includes(shortage.materialId)
    ? (`面料${shortage.materialId}` as SupplementMaterialRole)
    : shortage.materialId === 'D' ? '辅料' : '未识别'
  const materialLine: CuttingMaterialLine = {
    cutPieceOrderNo: '',
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
    techPackVersionId: '放行目标快照',
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
    cutOrderNo: '',
    line: materialLine,
  }
}

function buildReleaseSnapshotDraft(snapshot: CutPieceReleaseTargetSnapshot): SupplementDraft {
  const releaseRecord = listCutPieceReleaseRecords().find((record) => record.productionOrderId === snapshot.productionOrderId)
  const shortages = buildSupplementPartShortages(snapshot.matrixSnapshot, snapshot.targetPreview)
  const lines: SupplementLine[] = shortages.map((shortage) => {
    const materialRef = buildReleaseSnapshotMaterialRef(shortage)
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
  const materialDemands = lines.map((line) => ({
    key: line.basis.shortageMaterial.materialPatternMappingId,
    materialPatternMappingId: line.basis.shortageMaterial.materialPatternMappingId,
    techPackVersionId: '放行目标快照',
    materialSku: line.basis.shortageMaterial.materialSku,
    materialName: line.basis.shortageMaterial.materialName,
    materialTypeLabel: line.basis.shortageMaterial.materialTypeLabel,
    materialImageUrl: line.basis.shortageMaterial.materialImageUrl,
    materialAlias: line.basis.shortageMaterial.materialAlias,
    materialRole: line.basis.shortageMaterial.materialRole,
    roleSource: line.basis.shortageMaterial.roleSource,
    roleConfirmStatus: line.basis.shortageMaterial.roleConfirmStatus,
    patternId: line.basis.shortageMaterial.patternId,
    patternName: line.basis.shortageMaterial.patternName,
    requiredQty: line.actualMissingPieceQty || 0,
    unit: '片',
    printRequired: false,
    dyeRequired: false,
    processNote: '按裁片放行目标快照中的实际缺片数量预填',
  }))
  return structuredClone({
    candidateId: `release-snapshot:${snapshot.snapshotId}`,
    sourceType: 'release-snapshot',
    sourceNo: snapshot.matrixSnapshot.productionOrderNo,
    productionOrderId: snapshot.productionOrderId,
    productionOrderNo: snapshot.matrixSnapshot.productionOrderNo,
    styleName: releaseRecord?.spuName || snapshot.matrixSnapshot.spuCode,
    spuCode: snapshot.matrixSnapshot.spuCode,
    reason: '',
    reasonDetail: '',
    lines,
    materialDemands,
    releaseSnapshotId: snapshot.snapshotId,
    releaseMatrixVersion: snapshot.matrixVersion,
    releaseTargetConfirmedAt: snapshot.confirmedAt,
  })
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
  if (state.releaseSnapshotDraft?.releaseSnapshotId === snapshotId) return
  const snapshot = getCutPieceReleaseTargetSnapshot(snapshotId)
  if (!snapshot) {
    state.releaseSnapshotDraft = null
    state.releaseSnapshotError = '未找到裁片放行目标快照，可能已失效。'
    return
  }
  state.releaseSnapshotDraft = buildReleaseSnapshotDraft(snapshot)
  state.releaseSnapshotError = ''
}

function getFilteredRecords(): SupplementRecord[] {
  const keyword = state.filters.keyword.trim().toLowerCase()
  return state.records
    .filter((record) => state.filters.sourceType === 'ALL' || record.draft.sourceType === state.filters.sourceType)
    .filter((record) => {
      if (!keyword) return true
      return [
        record.recordNo,
        record.draft.sourceNo,
        record.draft.productionOrderNo,
        record.draft.styleName,
        record.draft.spuCode,
        record.draft.reason,
        record.draft.reasonDetail,
        record.draft.materialDemands.map((item) => item.materialSku).join(' '),
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
    const unitConsumption = Math.max(Number(bomItem?.unitConsumption || 0), shouldUseYard(materialLine, bomItem) ? 0.42 : 1)
    const requiredQty = supplementQty * unitConsumption * (1 + normalizeLossRate(bomItem?.lossRate))
    const unit = shouldUseYard(materialLine, bomItem) ? 'yard' : '件'
    const printRequired = materialLine.materialType === 'PRINT' || hasProcessRequirement(bomItem?.printRequirement)
    const dyeRequired = materialLine.materialType === 'DYE' || hasProcessRequirement(bomItem?.dyeRequirement)
    const key = `${ref.materialPatternMappingId}::${unit}`
    const current = grouped.get(key)

    grouped.set(key, {
      key,
      materialPatternMappingId: ref.materialPatternMappingId,
      techPackVersionId: ref.techPackVersionId,
      materialSku: ref.materialSku,
      materialName: ref.materialName,
      materialTypeLabel: ref.materialTypeLabel,
      materialImageUrl: ref.materialImageUrl,
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
        printRequired ? `印花：${normalizeText(bomItem?.printRequirement) || '按技术资料生成印花需求'}` : '',
        dyeRequired ? `染色：${normalizeText(bomItem?.dyeRequirement) || '按技术资料生成染色需求'}` : '',
      ].filter(Boolean).join('；') || '无需印花染色',
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
      <div class="grid gap-3 md:grid-cols-[180px_minmax(240px,1fr)_auto_auto] md:items-end">
        <label class="space-y-1 text-sm">
          <span class="text-muted-foreground">补料对象</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-cutting-supplement-field="sourceType">
            <option value="ALL"${state.filters.sourceType === 'ALL' ? ' selected' : ''}>全部</option>
            <option value="production-order"${state.filters.sourceType === 'production-order' ? ' selected' : ''}>生产单</option>
            <option value="cut-order"${state.filters.sourceType === 'cut-order' ? ' selected' : ''}>裁片单</option>
            <option value="release-snapshot"${state.filters.sourceType === 'release-snapshot' ? ' selected' : ''}>裁片放行目标快照</option>
          </select>
        </label>
        <label class="space-y-1 text-sm">
          <span class="text-muted-foreground">关键词</span>
          <input class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-cutting-supplement-field="keyword" value="${escapeHtml(state.filters.keyword)}" placeholder="补料单、生产单、裁片单、SPU、物料SKU" />
        </label>
        <button type="button" class="h-10 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700" data-skip-page-rerender="true" data-cutting-supplement-action="apply-filters">筛选</button>
        <button type="button" class="h-10 rounded-md border px-4 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cutting-supplement-action="reset-filters">重置</button>
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
    const materialImages = candidate.materialLines.slice(0, 4).map((line) => `
      <img class="h-8 w-8 rounded border object-cover" src="${escapeHtml(getMaterialImageUrl(line))}" alt="${escapeHtml(line.materialSku)}" />
    `).join('')
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
            <img class="h-14 w-14 rounded-md border object-cover" src="${escapeHtml(spuImageUrl)}" alt="${escapeHtml(candidate.record.spuCode)}" />
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
    <section class="rounded-lg border bg-card">
      <div class="border-b px-5 py-4">
        <h2 class="text-lg font-semibold">选择补料对象</h2>
        <p class="mt-1 text-sm text-muted-foreground">先选择生产单或裁片单，搜索并勾选一条记录后进入下一步填写补料明细。</p>
      </div>
      <div class="space-y-4 border-b px-5 py-4">
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
      <div class="overflow-x-auto">
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
      <div class="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
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

function renderReleaseSnapshotCreatePage(draft: SupplementDraft): string {
  const rows = draft.lines.map((line) => `
    <tr class="border-t align-top" data-release-snapshot-shortage-row data-release-snapshot-point-key="${escapeHtml(line.key)}">
      <td class="px-3 py-3 font-medium">${escapeHtml(line.color)}</td>
      <td class="px-3 py-3 font-medium">${escapeHtml(line.size)}</td>
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
            <div class="overflow-auto rounded-lg border">
              <table class="min-w-[980px] text-left text-sm">
                <thead class="bg-muted/50 text-xs text-muted-foreground"><tr>
                  <th class="px-3 py-2 font-medium">颜色</th><th class="px-3 py-2 font-medium">尺码</th>
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
                  <option value="">请选择</option><option value="尺码齐套不足">尺码齐套不足</option>
                  <option value="裁片损耗">裁片损耗</option><option value="验片不良">验片不良</option>
                </select>
              </label>
              <label class="space-y-1 text-sm"><span class="text-muted-foreground">补料说明</span>
                <input class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-supplement-reason-detail placeholder="说明本次补料原因" />
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
        <img class="h-10 w-10 rounded border object-cover" src="${escapeHtml(ref.materialImageUrl)}" alt="${escapeHtml(ref.materialSku)}" />
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

function renderDraftAbAnalysisTable(candidate: SupplementCandidate): string {
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
          ${candidate.abAnalysisRows.map((row) => `
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
                <input class="h-9 w-28 rounded-md border px-2 text-sm tabular-nums" type="number" min="0" max="${Math.max(row.suggestedSupplementQty, row.shortageQty)}" value="${row.suggestedSupplementQty > 0 ? formatInteger(row.suggestedSupplementQty).replace(/,/g, '') : '0'}" data-supplement-basis-qty-input data-basis-key="${escapeHtml(row.key)}" />
                <div class="mt-1 text-[11px] text-muted-foreground">建议 ${formatInteger(row.suggestedSupplementQty)} 件</div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderDraftPage(candidate: SupplementCandidate | undefined): string {
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
            ${renderDraftAbAnalysisTable(candidate)}
          </section>
          <section class="grid gap-3 md:grid-cols-2">
            <label class="space-y-1 text-sm">
              <span class="text-muted-foreground">补料原因</span>
              <select class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-supplement-reason>
                <option value="">请选择</option>
                <option value="裁片损耗">裁片损耗</option>
                <option value="验片不良">验片不良</option>
                <option value="尺码齐套不足">尺码齐套不足</option>
                <option value="裁片单关闭前补齐">裁片单关闭前补齐</option>
              </select>
            </label>
            <label class="space-y-1 text-sm">
              <span class="text-muted-foreground">补料说明</span>
              <input class="h-10 w-full rounded-md border bg-background px-3 text-sm" data-supplement-reason-detail placeholder="说明为什么需要补料" />
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

function renderDemandTable(demands: SupplementMaterialDemand[]): string {
  return `
    <div class="overflow-auto rounded-lg border">
      <table class="min-w-[1120px] text-left text-sm">
        <thead class="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">物料</th>
            <th class="px-3 py-2 font-medium">类别</th>
            <th class="px-3 py-2 font-medium">面料别名</th>
            <th class="px-3 py-2 font-medium">纸样信息</th>
            <th class="px-3 py-2 font-medium">系统反算用量</th>
            <th class="px-3 py-2 font-medium">印花/染色</th>
          </tr>
        </thead>
        <tbody>
          ${demands.map((item) => `
            <tr class="border-t">
              <td class="px-3 py-2">
                <div class="flex items-center gap-3">
                  <img class="h-10 w-10 rounded border object-cover" src="${escapeHtml(item.materialImageUrl)}" alt="${escapeHtml(item.materialSku)}" />
                  <div>
                    <div class="font-medium">${escapeHtml(item.materialSku)}</div>
                    <div class="text-xs text-muted-foreground">${escapeHtml(item.materialName)}</div>
                  </div>
                </div>
              </td>
              <td class="px-3 py-2">${escapeHtml(item.materialTypeLabel)}</td>
              <td class="px-3 py-2">${renderMaterialAliasInfo(item)}</td>
              <td class="px-3 py-2">${renderSupplementPatternInfo(item)}</td>
              <td class="px-3 py-2 font-semibold tabular-nums">${formatDecimal(item.requiredQty)} ${escapeHtml(item.unit)}</td>
              <td class="px-3 py-2">
                <div class="flex flex-wrap gap-1">
                  ${item.printRequired ? '<span class="rounded-full bg-violet-50 px-2 py-1 text-xs text-violet-700">生成印花需求</span>' : ''}
                  ${item.dyeRequired ? '<span class="rounded-full bg-sky-50 px-2 py-1 text-xs text-sky-700">生成染色需求</span>' : ''}
                  ${!item.printRequired && !item.dyeRequired ? '<span class="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-600">无需印染</span>' : ''}
                </div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.processNote)}</div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderSupplementBasisTable(lines: SupplementLine[]): string {
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
            <th class="px-3 py-2 font-medium">实际缺片</th>
            <th class="px-3 py-2 font-medium">本次补料件数</th>
          </tr>
        </thead>
        <tbody>
          ${lines.map((line) => `
            <tr class="border-t align-top">
              <td class="px-3 py-3">${escapeHtml(line.color)}</td>
              <td class="px-3 py-3">${escapeHtml(line.size)}</td>
              <td class="px-3 py-3">${renderMaterialAliasInfo(line.basis.shortageMaterial)}</td>
              <td class="px-3 py-3">${renderSupplementMaterialInfo(line.basis.shortageMaterial)}</td>
              <td class="px-3 py-3">${renderSupplementPatternInfo(line.basis.shortageMaterial)}</td>
              <td class="px-3 py-3 font-medium tabular-nums">${formatInteger(line.plannedQty)} 件</td>
              <td class="px-3 py-3 font-medium tabular-nums">${formatInteger(line.basis.currentRoleCutQty)} 件</td>
              <td class="px-3 py-3 tabular-nums">${formatInteger(line.existingSupplementQty)} 件</td>
              <td class="px-3 py-3 font-medium tabular-nums">${line.actualMissingPieceQty === undefined ? '—' : `实际缺片 ${formatInteger(line.actualMissingPieceQty)} 片`}</td>
              <td class="px-3 py-3 font-semibold tabular-nums">${formatInteger(line.supplementQty)} 件</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderConfirmDialog(draft: SupplementDraft | null): string {
  if (!draft) return ''
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6">
      <div class="w-full max-w-5xl rounded-xl bg-background shadow-xl">
        <div class="border-b px-5 py-4">
          <h2 class="text-lg font-semibold">二次确认补料</h2>
          <p class="mt-1 text-sm text-muted-foreground">确认后才会生成补料单；需要印花或染色的物料会挂到生产单 ${escapeHtml(draft.productionOrderNo)} 下。</p>
        </div>
        <div class="max-h-[72vh] space-y-4 overflow-y-auto p-5">
          ${renderReleaseSnapshotTrace(draft)}
          <section class="rounded-lg border p-4">
            <div class="grid gap-3 md:grid-cols-4">
              <div><div class="text-xs text-muted-foreground">发起对象</div><div class="mt-1 font-semibold">${escapeHtml(sourceTypeLabels[draft.sourceType])} ${escapeHtml(draft.sourceNo)}</div></div>
              <div><div class="text-xs text-muted-foreground">生产单</div><div class="mt-1 font-semibold">${escapeHtml(draft.productionOrderNo)}</div></div>
              <div><div class="text-xs text-muted-foreground">SPU</div><div class="mt-1 font-semibold">${escapeHtml(draft.spuCode)}</div></div>
              <div><div class="text-xs text-muted-foreground">原因</div><div class="mt-1 font-semibold">${escapeHtml(draft.reason)}</div></div>
            </div>
            <p class="mt-3 text-sm text-muted-foreground">${escapeHtml(draft.reasonDetail)}</p>
          </section>
          <section>
            <h3 class="mb-2 font-semibold">补料明细与本次补料件数</h3>
            ${renderSupplementBasisTable(draft.lines)}
          </section>
          <section>
            <h3 class="mb-2 font-semibold">系统反算物料需求</h3>
            ${renderDemandTable(draft.materialDemands)}
          </section>
        </div>
        <div class="flex justify-end gap-2 border-t px-5 py-4">
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-cutting-supplement-action="return-draft">返回修改</button>
          <button type="button" class="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700" data-cutting-supplement-action="confirm-supplement">确认生成补料单</button>
        </div>
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

function getSupplementTotalQty(record: SupplementRecord): number {
  return record.draft.lines.reduce((sum, line) => sum + Number(line.supplementQty || 0), 0)
}

const supplementListColumns: StandardListColumn<SupplementRecord>[] = [
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
      const sourceRecord = getCandidateById(record.draft.candidateId)?.record
      const spuImageUrl = sourceRecord ? getSpuImageUrl(sourceRecord) : '/pants-sample.jpg'
      return `
        <div class="flex items-center gap-3">
          <img class="h-12 w-12 rounded-md border object-cover" src="${escapeHtml(spuImageUrl)}" alt="${escapeHtml(record.draft.spuCode)}" />
          <div class="min-w-0">
            <div class="truncate font-medium">${escapeHtml(sourceTypeLabels[record.draft.sourceType])} ${escapeHtml(record.draft.sourceNo)}</div>
            <div class="truncate text-xs text-muted-foreground">${escapeHtml(record.draft.productionOrderNo)} / ${escapeHtml(record.draft.spuCode)}</div>
            <div class="truncate text-xs text-muted-foreground">${escapeHtml(record.draft.styleName)}</div>
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
      const materialImages = record.draft.materialDemands.slice(0, 3).map((item) => `
        <img class="h-8 w-8 rounded border object-cover" src="${escapeHtml(item.materialImageUrl)}" alt="${escapeHtml(item.materialSku)}" />
      `).join('')
      return `
        <div class="flex items-center gap-2">
          <div class="flex shrink-0 flex-wrap gap-1">${materialImages}</div>
          <div class="min-w-0">
            <div class="truncate tabular-nums">${escapeHtml(formatMaterialDemandSummary(record.draft.materialDemands))}</div>
            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(formatInteger(record.draft.materialDemands.length))} 种物料</div>
          </div>
        </div>
      `
    },
  },
  {
    key: 'processDemand',
    title: '印染需求',
    width: 240,
    render: (record) => `<span class="text-xs">${escapeHtml([...record.printDemandNos, ...record.dyeDemandNos].join('、') || '无')}</span>`,
  },
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
    .filter((column): column is StandardListColumn<SupplementRecord> => Boolean(
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
  filtered: SupplementRecord[]
  paging: StandardListPageSlice<SupplementRecord>
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

function renderListStats(records: SupplementRecord[]): string {
  return renderStandardListStats([
    { label: '补料单', value: records.length },
    { label: '已确认', value: records.filter((record) => record.status === '已确认').length },
    { label: '涉及生产单', value: new Set(records.map((record) => record.draft.productionOrderNo)).size },
  ])
}

function renderListTable(paging: StandardListPageSlice<SupplementRecord>): string {
  return withSkipPageRerender(renderStandardListTable({
    columns: supplementListColumns,
    rows: paging.rows,
    preferences: state.columnPreferences,
    sort: state.sort,
    eventPrefix: 'cutting-supplement',
    emptyText: '暂无补料单。',
  }))
}

function renderListPagination(paging: StandardListPageSlice<SupplementRecord>): string {
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
  if (activeRecord) return renderSupplementDetailDialog(activeRecord)
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

function buildSupplementProcessLinks(record: SupplementRecord): SupplementProcessLink[] {
  let printIndex = 0
  let dyeIndex = 0

  return record.draft.materialDemands.flatMap((item) => {
    const links: SupplementProcessLink[] = []
    if (item.printRequired) {
      const demandNo = record.printDemandNos[printIndex] || `PR-${record.recordNo}-${String(printIndex + 1).padStart(2, '0')}`
      printIndex += 1
      links.push({
        kind: '印花',
        demandNo,
        workOrderNo: demandNo.replace(/^PR-/, 'PWO-'),
        materialSku: item.materialSku,
        materialName: item.materialName,
        materialImageUrl: item.materialImageUrl,
        requiredQty: item.requiredQty,
        unit: item.unit,
        demandStatus: '已生成',
        workOrderStatus: '待排产',
        factoryName: '绍兴云彩印花厂',
        createdAt: record.createdAt,
        linkedProductionOrderNo: record.draft.productionOrderNo,
        processNote: item.processNote,
      })
    }
    if (item.dyeRequired) {
      const demandNo = record.dyeDemandNos[dyeIndex] || `DY-${record.recordNo}-${String(dyeIndex + 1).padStart(2, '0')}`
      dyeIndex += 1
      links.push({
        kind: '染色',
        demandNo,
        workOrderNo: demandNo.replace(/^DY-/, 'DWO-'),
        materialSku: item.materialSku,
        materialName: item.materialName,
        materialImageUrl: item.materialImageUrl,
        requiredQty: item.requiredQty,
        unit: item.unit,
        demandStatus: '已生成',
        workOrderStatus: '加工中',
        factoryName: '杭州恒源染整厂',
        createdAt: record.createdAt,
        linkedProductionOrderNo: record.draft.productionOrderNo,
        processNote: item.processNote,
      })
    }
    return links
  })
}

function renderProcessLinksTable(record: SupplementRecord): string {
  const links = buildSupplementProcessLinks(record)
  if (!links.length) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">本补料单的物料无需印花、染色。</div>'
  }

  return `
    <div class="overflow-auto rounded-lg border">
      <table class="min-w-full text-left text-sm">
        <thead class="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 font-medium">工艺</th>
            <th class="px-3 py-2 font-medium">需求单</th>
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
                <div class="font-semibold">${escapeHtml(link.demandNo)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(link.demandStatus)}</div>
              </td>
              <td class="px-3 py-3">
                <div class="font-semibold">${escapeHtml(link.workOrderNo)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(link.workOrderStatus)}</div>
              </td>
              <td class="px-3 py-3">
                <div class="flex items-center gap-3">
                  <img class="h-10 w-10 rounded border object-cover" src="${escapeHtml(link.materialImageUrl)}" alt="${escapeHtml(link.materialSku)}" />
                  <div>
                    <div class="font-medium">${escapeHtml(link.materialSku)}</div>
                    <div class="text-xs text-muted-foreground">${escapeHtml(link.materialName)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(link.processNote)}</div>
                  </div>
                </div>
              </td>
              <td class="px-3 py-3 font-semibold tabular-nums">${formatDecimal(link.requiredQty)} ${escapeHtml(link.unit)}</td>
              <td class="px-3 py-3">
                <div class="text-xs">需求：${escapeHtml(link.demandStatus)}</div>
                <div class="mt-1 text-xs">加工：${escapeHtml(link.workOrderStatus)}</div>
              </td>
              <td class="px-3 py-3">${escapeHtml(link.factoryName)}</td>
              <td class="px-3 py-3">
                ${renderProductionOrderIdentityCell({ productionOrderNo: link.linkedProductionOrderNo, demandNo: link.demandNo })}
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(link.createdAt)}</div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `
}

function renderSupplementDetailDialog(record: SupplementRecord | undefined): string {
  if (!record) return ''
  const totalQty = record.draft.lines.reduce((sum, line) => sum + line.supplementQty, 0)
  const processLinks = buildSupplementProcessLinks(record)
  const sourceRecord = getCandidateById(record.draft.candidateId)?.record
  const spuImageUrl = sourceRecord ? getSpuImageUrl(sourceRecord) : '/pants-sample.jpg'

  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-6">
      <div class="flex max-h-[92vh] w-full max-w-6xl flex-col rounded-xl bg-background shadow-xl">
        <div class="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 class="text-lg font-semibold">补料单详情</h2>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.recordNo)} / ${escapeHtml(record.draft.productionOrderNo)} / ${escapeHtml(record.draft.styleName)}</p>
          </div>
          <button type="button" class="rounded-md border px-3 py-1.5 text-sm hover:bg-muted" data-skip-page-rerender="true" data-cutting-supplement-action="close-detail">关闭</button>
        </div>
        <div class="flex-1 space-y-4 overflow-y-auto p-5">
          ${renderReleaseSnapshotTrace(record.draft)}
          <section class="rounded-lg border p-4">
            <div class="flex flex-col gap-4 md:flex-row">
              <div class="w-full md:w-36">
                <img class="h-36 w-full rounded-lg border object-cover" src="${escapeHtml(spuImageUrl)}" alt="${escapeHtml(record.draft.spuCode)}" />
                <div class="mt-2 text-xs text-muted-foreground">款式/SPU图</div>
              </div>
              <div class="grid flex-1 gap-4 md:grid-cols-4">
                <div><div class="text-xs text-muted-foreground">补料单号</div><div class="mt-1 font-semibold">${escapeHtml(record.recordNo)}</div></div>
                <div><div class="text-xs text-muted-foreground">状态</div><div class="mt-1"><span class="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">${escapeHtml(record.status)}</span></div></div>
                <div><div class="text-xs text-muted-foreground">补料对象</div><div class="mt-1 font-semibold">${escapeHtml(sourceTypeLabels[record.draft.sourceType])} ${escapeHtml(record.draft.sourceNo)}</div></div>
                <div><div class="text-xs text-muted-foreground">补料数量</div><div class="mt-1 font-semibold tabular-nums">${formatInteger(totalQty)} 件</div></div>
                <div><div class="text-xs text-muted-foreground">生产单</div><div class="mt-1 font-semibold">${escapeHtml(record.draft.productionOrderNo)}</div></div>
                <div><div class="text-xs text-muted-foreground">SPU</div><div class="mt-1 font-semibold">${escapeHtml(record.draft.spuCode)}</div></div>
                <div><div class="text-xs text-muted-foreground">款式</div><div class="mt-1 font-semibold">${escapeHtml(record.draft.styleName)}</div></div>
                <div><div class="text-xs text-muted-foreground">发起人</div><div class="mt-1 font-semibold">${escapeHtml(record.createdBy)}</div></div>
                <div><div class="text-xs text-muted-foreground">创建时间</div><div class="mt-1 font-semibold">${escapeHtml(record.createdAt)}</div></div>
              </div>
            </div>
            <div class="mt-4 rounded-md bg-muted/40 px-3 py-2 text-sm">
              <span class="font-medium">补料原因：</span>${escapeHtml(record.draft.reason)}
              <span class="ml-3 text-muted-foreground">${escapeHtml(record.draft.reasonDetail)}</span>
            </div>
	          </section>

          <section>
            <h3 class="mb-2 font-semibold">补料明细与本次补料件数</h3>
            ${renderSupplementBasisTable(record.draft.lines)}
          </section>

          <section>
            <h3 class="mb-2 font-semibold">系统反算物料需求</h3>
            ${renderDemandTable(record.draft.materialDemands)}
          </section>

          <section>
            <div class="mb-2 flex items-center justify-between">
              <h3 class="font-semibold">印花 / 染色需求单与加工单</h3>
              <span class="text-xs text-muted-foreground">共 ${formatInteger(processLinks.length)} 条印染链路</span>
            </div>
            ${renderProcessLinksTable(record)}
          </section>
        </div>
      </div>
    </div>
  `
}

function getCandidateById(candidateId: string): SupplementCandidate | undefined {
  return buildCandidates().find((candidate) => candidate.id === candidateId)
}

function getRecordById(recordId: string): SupplementRecord | undefined {
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
    reason,
    reasonDetail,
    lines: selectedLines,
    materialDemands,
  }
}

function nowText(): string {
  return '2026-03-25 16:20'
}

function buildSupplementRecordFromDraft(
  draft: SupplementDraft,
  options: {
    sequence: number
    status: SupplementRecordStatus
    createdAt: string
    createdBy: string
  },
): SupplementRecord {
  const serial = String(options.sequence).padStart(3, '0')
  const processSeed = draft.productionOrderNo.replace(/\D/g, '').slice(-6) || '260325'
  const printDemandNos = draft.materialDemands
    .filter((item) => item.printRequired)
    .map((_, index) => `PR-SUP-${processSeed}-${String(index + 1).padStart(2, '0')}`)
  const dyeDemandNos = draft.materialDemands
    .filter((item) => item.dyeRequired)
    .map((_, index) => `DY-SUP-${processSeed}-${String(index + 1).padStart(2, '0')}`)

  return {
    id: `supplement-${processSeed}-${serial}`,
    recordNo: `SUP-${processSeed}-${serial}`,
    status: options.status,
    createdAt: options.createdAt,
    createdBy: options.createdBy,
    draft: structuredClone(draft),
    printDemandNos,
    dyeDemandNos,
  }
}

function buildSupplementRecord(draft: SupplementDraft): SupplementRecord {
  return buildSupplementRecordFromDraft(draft, {
    sequence: state.records.length + 1,
    status: '已确认',
    createdAt: nowText(),
    createdBy: '裁床主管 周敏',
  })
}

function buildMockDraft(
  candidate: SupplementCandidate,
  reason: string,
  reasonDetail: string,
  processProfile: 'none' | 'print-dye' = 'none',
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
  if (processProfile === 'print-dye') {
    materialDemands[0] = {
      ...materialDemands[0],
      printRequired: true,
      dyeRequired: true,
      processNote: '补料面料需先补印花，再按生产单颜色要求补染色。',
    }
  }

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

function ensureMockSupplementOrders(): void {
  if (mockSupplementOrdersSeeded) return
  mockSupplementOrdersSeeded = true
  if (state.records.length) return

  const candidates = buildCandidates().filter((candidate) => candidate.canInitiate && candidate.abAnalysisRows.length > 0)
  if (!candidates.length) return
  const reasons = ['裁片损耗', '尺码齐套不足', '验片破损', '裁剪差异']
  const details = [
    '验片后发现左前片有破损，需要按裁片单新增补料。',
    '生产单部分尺码齐套不足，需要补齐后续车缝用料。',
    '现场复核发现裁片损坏，按实际缺口补齐。',
    '裁剪数量与计划存在差异，主管确认后发起补料。',
  ]
  const creators = ['裁床主管 周敏', '裁床组长 林洁', '验片主管 陈玲', '裁床主管 王海']
  const records: SupplementRecord[] = []

  for (let index = 0; index < 12; index += 1) {
    const candidate = candidates[index % candidates.length]
    const draft = buildMockDraft(
      candidate,
      reasons[index % reasons.length],
      details[index % details.length],
      index % 3 === 1 ? 'print-dye' : 'none',
    )
    if (!draft) continue
    const lines = draft.lines.map((line, lineIndex) => ({
      ...line,
      supplementQty: line.supplementQty + (index % 4) + lineIndex,
    }))
    const materialDemands = buildMaterialDemands(candidate, lines)
    if (index % 3 === 1 && materialDemands[0]) {
      materialDemands[0] = {
        ...materialDemands[0],
        printRequired: true,
        dyeRequired: true,
        processNote: '补料面料需先补印花，再按生产单颜色要求补染色。',
      }
    }
    const variedDraft: SupplementDraft = {
      ...draft,
      lines,
      materialDemands,
    }
    records.push(buildSupplementRecordFromDraft(variedDraft, {
      sequence: index + 1,
      status: '已确认',
      createdAt: `2026-03-${String(25 - Math.floor(index / 4)).padStart(2, '0')} ${String(16 - (index % 4)).padStart(2, '0')}:${String((index * 7) % 60).padStart(2, '0')}`,
      createdBy: creators[index % creators.length],
    }))
  }

  state.records = records
}

function setFiltersFromDom(): void {
  const sourceType = document.querySelector<HTMLSelectElement>('[data-cutting-supplement-field="sourceType"]')?.value
  const keyword = document.querySelector<HTMLInputElement>('[data-cutting-supplement-field="keyword"]')?.value
  state.filters = {
    sourceType: sourceType === 'production-order' || sourceType === 'cut-order' || sourceType === 'release-snapshot' ? sourceType : 'ALL',
    keyword: normalizeText(keyword),
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
  state.releaseSnapshotDraft = null
  state.releaseSnapshotError = ''
}

export function isCraftCuttingSupplementManagementDialogOpen(): boolean {
  return Boolean(state.activeRecordId || state.pendingConfirmDraft)
}

export function handleCraftCuttingSupplementManagementEvent(target: HTMLElement, event?: Event): boolean {
  const internalDragEvent = event as (DragEvent & {
    higoodStandardListColumnDrag?: true
    higoodStandardListColumnKey?: string
  }) | undefined
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
    state.filters = { sourceType: 'ALL', keyword: '' }
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
    state.feedback = null
    return true
  }


  if (action === 'submit-release-snapshot-draft') {
    const container = actionNode.closest<HTMLElement>('[data-supplement-draft-dialog]')
    const baseDraft = state.releaseSnapshotDraft
    if (!container || !baseDraft || !baseDraft.releaseSnapshotId) return false
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
    state.pendingConfirmDraft = structuredClone({ ...baseDraft, reason, reasonDetail })
    state.feedback = null
    return true
  }

  if (action === 'return-draft') {
    state.activeCandidateId = state.pendingConfirmDraft?.candidateId || state.activeCandidateId
    state.pendingConfirmDraft = null
    return true
  }

  if (action === 'confirm-supplement') {
    if (!state.pendingConfirmDraft) return false
    const record = buildSupplementRecord(state.pendingConfirmDraft)
    state.records = [record, ...state.records]
    state.page = 1
    state.pendingConfirmDraft = null
    state.activeCandidateId = ''
    state.activeRecordId = record.id
    state.feedback = { tone: 'success', message: `已二次确认并生成补料单 ${record.recordNo}。` }
    appStore.navigate(supplementManagementPath)
    return true
  }

  if (action === 'close-overlay') {
    state.activeRecordId = ''
    state.columnSettingsOpen = false
    state.pendingConfirmDraft = null
    refreshSupplementOverlay()
    return true
  }

  return false
}

export function renderCraftCuttingSupplementManagementPage(): string {
  ensureMockSupplementOrders()
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
  ensureMockSupplementOrders()
  prepareReleaseSnapshotCreateState()
  let activeCandidate = state.activeCandidateId ? getCandidateById(state.activeCandidateId) : undefined
  if (state.activeCandidateId && !activeCandidate) {
    state.activeCandidateId = ''
    activeCandidate = undefined
    state.feedback = { tone: 'warning', message: '未找到对应的补料对象，请重新选择。' }
  }

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
      ${state.releaseSnapshotError
        ? renderReleaseSnapshotError()
        : state.releaseSnapshotDraft
          ? renderReleaseSnapshotCreatePage(state.releaseSnapshotDraft)
          : activeCandidate ? renderDraftPage(activeCandidate) : renderSourcePickerPage()}
      ${renderConfirmDialog(state.pendingConfirmDraft)}
    </div>
  `
}
