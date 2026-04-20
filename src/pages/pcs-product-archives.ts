import { appStore } from '../state/store.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'
import { ensurePcsProjectDemoDataReady } from '../data/pcs-project-demo-seed-service.ts'
import {
  formalizeStyleArchive,
  getStyleArchiveFormalizationCheck,
} from '../data/pcs-project-style-archive-generation.ts'
import { activateTechPackVersionForStyle } from '../data/pcs-project-technical-data-writeback.ts'
import {
  listProjectChannelProducts,
} from '../data/pcs-channel-product-project-repository.ts'
import { buildSkuFixture } from '../data/pcs-product-archive-fixtures.ts'
import {
  STYLE_ARCHIVE_STATUS_RULES,
  isStyleArchiveFormalized,
  resolveStyleArchiveBusinessStatus,
  type StyleArchiveBusinessStatusKey,
} from '../data/pcs-product-lifecycle-governance.ts'
import { getStyleArchiveById, listStyleArchives, updateStyleArchive } from '../data/pcs-style-archive-repository.ts'
import type { StyleArchiveShellRecord } from '../data/pcs-style-archive-types.ts'
import {
  createSkuArchive,
  createSkuArchiveBatch,
  findSkuArchiveByCode,
  getSkuArchiveById,
  listSkuArchives,
  listSkuArchivesByStyleId,
  updateSkuArchive,
} from '../data/pcs-sku-archive-repository.ts'
import type { SkuArchiveMappingHealth, SkuArchiveRecord, SkuArchiveStatusCode } from '../data/pcs-sku-archive-types.ts'
import { buildTechnicalVersionListByStyle } from '../data/pcs-technical-data-version-view-model.ts'
import { listTechnicalDataVersionsByStyleId } from '../data/pcs-technical-data-version-repository.ts'
import {
  listProjectWorkspaceColors,
  listProjectWorkspaceSizes,
} from '../data/pcs-project-config-workspace-adapter.ts'

type StyleVersionFilter = 'all' | 'has' | 'none'
type StyleDetailTabKey = 'overview' | 'versions' | 'specifications' | 'mappings' | 'channels' | 'logs'
type SkuDetailTabKey = 'overview' | 'channelMappings' | 'channelVariants' | 'codeMappings' | 'logs'
type SkuCreateMode = 'single' | 'batch' | 'import'
type SkuCodeStrategy = 'auto' | 'manual'

interface ProductArchivePageState {
  notice: string | null
  styleList: {
    search: string
    status: 'all' | StyleArchiveBusinessStatusKey
    version: StyleVersionFilter
    mapping: 'all' | SkuArchiveMappingHealth
  }
  skuList: {
    search: string
    status: 'all' | SkuArchiveStatusCode
    mapping: 'all' | SkuArchiveMappingHealth
    styleId: string
  }
  styleDetail: {
    styleId: string | null
    activeTab: StyleDetailTabKey
  }
  skuDetail: {
    skuId: string | null
    activeTab: SkuDetailTabKey
  }
  skuCreate: {
    open: boolean
    mode: SkuCreateMode
    styleId: string
    color: string
    size: string
    print: string
    barcode: string
    codeStrategy: SkuCodeStrategy
    manualCode: string
    legacySystem: string
    legacyCode: string
    batchColors: string[]
    batchSizes: string[]
    batchPrint: string
  }
  styleCompletion: {
    open: boolean
    styleId: string
    styleName: string
    styleNumber: string
    styleType: string
    categoryName: string
    subCategoryName: string
    brandName: string
    yearTag: string
    seasonTags: string
    styleTags: string
    targetAudienceTags: string
    targetChannelCodes: string
    priceRangeLabel: string
    mainImageUrl: string
    galleryImageUrls: string[]
    sellingPointText: string
    detailDescription: string
    packagingInfo: string
    remark: string
  }
  imagePreview: {
    open: boolean
    url: string
    title: string
  }
}

interface StyleArchiveListItemViewModel {
  style: StyleArchiveShellRecord
  displayStatus: StyleArchiveBusinessStatusKey
  hasEffectiveTechPack: boolean
  skuCount: number
  mappingHealth: SkuArchiveMappingHealth
  currentVersionText: string
  currentVersionMetaText: string
  channelCount: number
  onSaleCount: number
  legacyMappingText: string
  originProjectText: string
}

const STYLE_DETAIL_TABS: Array<{ key: StyleDetailTabKey; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'versions', label: '技术包版本' },
  { key: 'specifications', label: '规格档案' },
  { key: 'mappings', label: '编码映射' },
  { key: 'channels', label: '渠道店铺商品' },
  { key: 'logs', label: '日志' },
]

const SKU_DETAIL_TABS: Array<{ key: SkuDetailTabKey; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'channelMappings', label: '渠道映射' },
  { key: 'channelVariants', label: '渠道变体' },
  { key: 'codeMappings', label: '外部编码' },
  { key: 'logs', label: '日志' },
]

const SKU_STATUS_META: Record<SkuArchiveStatusCode, { label: string; className: string }> = {
  ACTIVE: { label: '启用', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  INACTIVE: { label: '停用', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  ARCHIVED: { label: '已归档', className: 'border-slate-200 bg-slate-100 text-slate-600' },
}

const MAPPING_META: Record<SkuArchiveMappingHealth, { label: string; className: string }> = {
  OK: { label: '健康', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  MISSING: { label: '缺映射', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  CONFLICT: { label: '冲突', className: 'border-rose-200 bg-rose-50 text-rose-700' },
}

const LEGACY_SYSTEM_OPTIONS = ['ERP-A', 'ERP-B', 'OMS-旧档', '外部表格导入']
const FALLBACK_SKU_COLOR_OPTIONS = ['Black', 'White', 'Red', 'Blue', 'Green', 'Khaki']
const FALLBACK_SKU_SIZE_OPTIONS = ['S', 'M', 'L', 'XL', 'One Size']

function listConfiguredSkuColors(): string[] {
  const options = listProjectWorkspaceColors()
    .map((item) => item.name.trim())
    .filter(Boolean)
  return options.length > 0 ? options : FALLBACK_SKU_COLOR_OPTIONS
}

function listConfiguredSkuSizes(): string[] {
  const options = listProjectWorkspaceSizes()
    .map((item) => item.name.trim())
    .filter(Boolean)
  return options.length > 0 ? options : FALLBACK_SKU_SIZE_OPTIONS
}

function createDefaultSkuCreateState(): ProductArchivePageState['skuCreate'] {
  const colors = listConfiguredSkuColors()
  const sizes = listConfiguredSkuSizes()
  return {
    open: false,
    mode: 'single',
    styleId: '',
    color: colors[0] || FALLBACK_SKU_COLOR_OPTIONS[0],
    size: sizes[0] || FALLBACK_SKU_SIZE_OPTIONS[0],
    print: '',
    barcode: '',
    codeStrategy: 'auto',
    manualCode: '',
    legacySystem: 'ERP-A',
    legacyCode: '',
    batchColors: colors.slice(0, Math.min(2, colors.length)),
    batchSizes: sizes.slice(0, Math.min(2, sizes.length)),
    batchPrint: '',
  }
}

function createDefaultStyleCompletionState(): ProductArchivePageState['styleCompletion'] {
  return {
    open: false,
    styleId: '',
    styleName: '',
    styleNumber: '',
    styleType: '',
    categoryName: '',
    subCategoryName: '',
    brandName: '',
    yearTag: '',
    seasonTags: '',
    styleTags: '',
    targetAudienceTags: '',
    targetChannelCodes: '',
    priceRangeLabel: '',
    mainImageUrl: '',
    galleryImageUrls: [],
    sellingPointText: '',
    detailDescription: '',
    packagingInfo: '',
    remark: '',
  }
}

function createDefaultImagePreviewState(): ProductArchivePageState['imagePreview'] {
  return {
    open: false,
    url: '',
    title: '',
  }
}

const state: ProductArchivePageState = {
  notice: null,
  styleList: {
    search: '',
    status: 'all',
    version: 'all',
    mapping: 'all',
  },
  skuList: {
    search: '',
    status: 'all',
    mapping: 'all',
    styleId: '',
  },
  styleDetail: {
    styleId: null,
    activeTab: 'overview',
  },
  skuDetail: {
    skuId: null,
    activeTab: 'overview',
  },
  skuCreate: createDefaultSkuCreateState(),
  styleCompletion: createDefaultStyleCompletionState(),
  imagePreview: createDefaultImagePreviewState(),
}

function resetSkuCreateState(): void {
  state.skuCreate = createDefaultSkuCreateState()
}

function resetStyleCompletionState(): void {
  state.styleCompletion = createDefaultStyleCompletionState()
}

function resetImagePreviewState(): void {
  state.imagePreview = createDefaultImagePreviewState()
}

export function resetPcsProductArchiveState(): void {
  state.notice = null
  state.styleList = {
    search: '',
    status: 'all',
    version: 'all',
    mapping: 'all',
  }
  state.skuList = {
    search: '',
    status: 'all',
    mapping: 'all',
    styleId: '',
  }
  state.styleDetail = {
    styleId: null,
    activeTab: 'overview',
  }
  state.skuDetail = {
    skuId: null,
    activeTab: 'overview',
  }
  resetSkuCreateState()
  resetStyleCompletionState()
  resetImagePreviewState()
}

function ensurePageDataReady(): void {
  ensurePcsProjectDemoDataReady()
  listProjectChannelProducts()
}

function nowText(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function normalizeTextToken(value: string, fallback: string): string {
  const normalized = value.trim().toLowerCase()
  if (normalized.includes('黑')) return 'BLK'
  if (normalized.includes('白')) return 'WHT'
  if (normalized.includes('红')) return 'RED'
  if (normalized.includes('蓝')) return 'BLU'
  if (normalized.includes('绿')) return 'GRN'
  if (normalized.includes('卡其')) return 'KHA'
  const ascii = normalized.replace(/[^a-z0-9]/g, '').slice(0, 3).toUpperCase()
  return ascii || fallback
}

function buildSkuIdentity(): { skuId: string; timestamp: string } {
  const timestamp = nowText()
  const dateKey = timestamp.slice(0, 10).replace(/-/g, '')
  const sequence = listSkuArchives().filter((item) => item.createdAt.startsWith(timestamp.slice(0, 10))).length + 1
  return {
    skuId: `sku_${dateKey}_${String(sequence).padStart(3, '0')}`,
    timestamp,
  }
}

function buildAutoSkuCode(styleCode: string, color: string, size: string, print: string): string {
  const colorToken = normalizeTextToken(color, 'CLR')
  const sizeToken = size.trim().toUpperCase() || 'OS'
  const printToken = print.trim() ? `-${normalizeTextToken(print, 'PRT')}` : ''
  return `${styleCode}-${colorToken}-${sizeToken}${printToken}`
}

function resolveLatestVersionMeta(styleId: string): { versionId: string; versionCode: string; versionLabel: string } {
  const versions = listTechnicalDataVersionsByStyleId(styleId)
  return {
    versionId: versions[0]?.technicalVersionId || '',
    versionCode: versions[0]?.technicalVersionCode || '',
    versionLabel: versions[0]?.versionLabel || '',
  }
}

function resolveStyleMappingHealth(skus: SkuArchiveRecord[]): SkuArchiveMappingHealth {
  if (skus.some((item) => item.mappingHealth === 'CONFLICT')) return 'CONFLICT'
  if (skus.some((item) => item.mappingHealth === 'MISSING') || skus.length === 0) return 'MISSING'
  return 'OK'
}

function listStyleChannelProducts(style: StyleArchiveShellRecord) {
  const records = listProjectChannelProducts()
  const matchedRecords = records.filter(
    (item) => item.styleId === style.styleId || (!!style.sourceProjectId && item.projectId === style.sourceProjectId),
  )
  const uniqueRecords = new Map(matchedRecords.map((item) => [item.channelProductId, item]))
  return Array.from(uniqueRecords.values())
}

function countOnSaleChannelProducts(records: ReturnType<typeof listStyleChannelProducts>): number {
  return records.filter((item) => item.channelProductStatus === '已生效' && item.upstreamSyncStatus === '已更新').length
}

function buildStyleListItems(): StyleArchiveListItemViewModel[] {
  ensurePageDataReady()
  return listStyleArchives().map((style) => {
    const skus = listSkuArchivesByStyleId(style.styleId)
    const versions = buildTechnicalVersionListByStyle(style.styleId)
    const currentVersion = versions.find((item) => item.isCurrentTechPackVersion) || versions[0] || null
    const styleChannels = listStyleChannelProducts(style)
    return {
      style,
      displayStatus: resolveStyleArchiveBusinessStatus(style),
      hasEffectiveTechPack: Boolean(currentVersion),
      skuCount: skus.length,
      mappingHealth: resolveStyleMappingHealth(skus),
      currentVersionText: currentVersion ? `${currentVersion.versionLabel}` : '未建立当前生效技术包',
      currentVersionMetaText: currentVersion?.publishedAt ? `生效于 ${currentVersion.publishedAt.slice(0, 10)}` : '待建立技术包版本',
      channelCount: styleChannels.length || style.channelProductCount,
      onSaleCount: countOnSaleChannelProducts(styleChannels),
      legacyMappingText: style.legacyOriginProject ? `历史项目：${style.legacyOriginProject}` : `款号：${style.styleNumber || style.styleCode}`,
      originProjectText: style.sourceProjectCode ? `${style.sourceProjectCode} · ${style.sourceProjectName}` : '未绑定商品项目',
    }
  })
}

function getFilteredStyleItems(): StyleArchiveListItemViewModel[] {
  const search = state.styleList.search.trim().toLowerCase()
  return buildStyleListItems().filter((item) => {
    if (search) {
      const haystack = [
        item.style.styleCode,
        item.style.styleName,
        item.style.styleNumber,
        item.legacyMappingText,
        item.originProjectText,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }

    if (state.styleList.status !== 'all' && item.displayStatus !== state.styleList.status) return false
    if (state.styleList.version === 'has' && !item.hasEffectiveTechPack) return false
    if (state.styleList.version === 'none' && item.hasEffectiveTechPack) return false
    if (state.styleList.mapping !== 'all' && item.mappingHealth !== state.styleList.mapping) return false

    return true
  })
}

function getStyleStats() {
  const items = buildStyleListItems()
  return {
    total: items.length,
    waitingBaseInfo: items.filter((item) => item.displayStatus === 'WAITING_BASE_INFO').length,
    waitingTechPack: items.filter((item) => item.displayStatus === 'WAITING_TECH_PACK').length,
    active: items.filter((item) => item.displayStatus === 'ACTIVE').length,
    archived: items.filter((item) => item.displayStatus === 'ARCHIVED').length,
    hasVersion: items.filter((item) => item.hasEffectiveTechPack).length,
    noVersion: items.filter((item) => !item.hasEffectiveTechPack).length,
    mappingOK: items.filter((item) => item.mappingHealth === 'OK').length,
    mappingConflict: items.filter((item) => item.mappingHealth === 'CONFLICT').length,
  }
}

function getFilteredSkuItems(): SkuArchiveRecord[] {
  ensurePageDataReady()
  const search = state.skuList.search.trim().toLowerCase()
  return listSkuArchives().filter((item) => {
    if (search) {
      const haystack = [item.skuCode, item.barcode, item.styleCode, item.styleName, item.colorName, item.legacyCode]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(search)) return false
    }

    if (state.skuList.status !== 'all' && item.archiveStatus !== state.skuList.status) return false
    if (state.skuList.mapping !== 'all' && item.mappingHealth !== state.skuList.mapping) return false
    if (state.skuList.styleId && item.styleId !== state.skuList.styleId) return false
    return true
  })
}

function getSkuStats() {
  const items = listSkuArchives()
  return {
    total: items.length,
    active: items.filter((item) => item.archiveStatus === 'ACTIVE').length,
    inactive: items.filter((item) => item.archiveStatus === 'INACTIVE').length,
    mappingOK: items.filter((item) => item.mappingHealth === 'OK').length,
    mappingMissing: items.filter((item) => item.mappingHealth === 'MISSING').length,
    mappingConflict: items.filter((item) => item.mappingHealth === 'CONFLICT').length,
  }
}

function renderBadge(text: string, className: string): string {
  return `<span class="${escapeHtml(toClassName('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', className))}">${escapeHtml(text)}</span>`
}

function renderStatusBadge(status: StyleArchiveBusinessStatusKey | SkuArchiveStatusCode, type: 'style' | 'sku'): string {
  const meta = type === 'style' ? STYLE_ARCHIVE_STATUS_RULES[status as StyleArchiveBusinessStatusKey] : SKU_STATUS_META[status as SkuArchiveStatusCode]
  return renderBadge(meta.label, meta.className)
}

function renderStyleLifecycleBadge(style: StyleArchiveShellRecord): string {
  return renderStatusBadge(resolveStyleArchiveBusinessStatus(style), 'style')
}

function renderMappingBadge(health: SkuArchiveMappingHealth): string {
  const meta = MAPPING_META[health]
  return renderBadge(meta.label, meta.className)
}

function renderMetricButton(title: string, value: string | number, description: string, action: string, extraData = ''): string {
  const clickable = action !== 'noop'
  const className = toClassName(
    'rounded-lg border bg-white px-4 py-3 text-left shadow-sm',
    clickable && 'hover:border-slate-300 hover:bg-slate-50',
  )
  return `
    <button type="button" class="${escapeHtml(className)}" ${clickable ? `data-pcs-product-archive-action="${escapeHtml(action)}"` : ''} ${extraData}>
      <div class="text-xs text-slate-500">${escapeHtml(title)}</div>
      <div class="mt-2 text-2xl font-semibold text-slate-900">${escapeHtml(value)}</div>
      <div class="mt-1 text-xs text-slate-500">${escapeHtml(description)}</div>
    </button>
  `
}

function renderFormField(label: string, control: string, required = false, hint = ''): string {
  return `
    <label class="block space-y-2">
      <div class="text-sm font-medium text-slate-700">${escapeHtml(label)}${required ? '<span class="ml-1 text-rose-500">*</span>' : ''}</div>
      ${control}
      ${hint ? `<div class="text-xs text-slate-500">${escapeHtml(hint)}</div>` : ''}
    </label>
  `
}

function renderTextInput(field: string, value: string, placeholder: string, type = 'text'): string {
  return `<input type="${escapeHtml(type)}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" data-pcs-product-archive-field="${escapeHtml(field)}" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400" />`
}

function renderTextarea(field: string, value: string, placeholder: string, rows = 4): string {
  return `<textarea rows="${rows}" placeholder="${escapeHtml(placeholder)}" data-pcs-product-archive-field="${escapeHtml(field)}" class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-slate-700 outline-none transition focus:border-slate-400">${escapeHtml(value)}</textarea>`
}

function renderReadonlyValue(value: string, placeholder = '—'): string {
  return `<div class="min-h-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-700">${escapeHtml(value || placeholder)}</div>`
}

function renderSelect(
  field: string,
  value: string,
  options: Array<{ value: string; label: string }>,
  placeholder: string,
): string {
  const optionHtml = [`<option value="">${escapeHtml(placeholder)}</option>`, ...options.map((item) => `<option value="${escapeHtml(item.value)}" ${item.value === value ? 'selected' : ''}>${escapeHtml(item.label)}</option>`)].join('')
  return `<select data-pcs-product-archive-field="${escapeHtml(field)}" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-slate-400">${optionHtml}</select>`
}

function renderCheckbox(field: string, checked: boolean, label: string, extraData = ''): string {
  return `
    <label class="inline-flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" ${checked ? 'checked' : ''} data-pcs-product-archive-field="${escapeHtml(field)}" ${extraData} class="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-400" />
      <span>${escapeHtml(label)}</span>
    </label>
  `
}

function renderDrawerShell(title: string, description: string, body: string, footer: string): string {
  return `
    <div class="fixed inset-0 z-40 flex justify-end">
      <button type="button" class="absolute inset-0 bg-slate-900/30" data-pcs-product-archive-action="close-drawers"></button>
      <section class="relative z-10 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-xl">
        <div class="border-b border-slate-200 px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold text-slate-900">${escapeHtml(title)}</h2>
              <p class="mt-1 text-sm text-slate-500">${escapeHtml(description)}</p>
            </div>
            <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50" data-pcs-product-archive-action="close-drawers">×</button>
          </div>
        </div>
        <div class="flex-1 overflow-y-auto px-5 py-5">${body}</div>
        <div class="border-t border-slate-200 px-5 py-4">
          <div class="flex flex-wrap items-center justify-end gap-2">${footer}</div>
        </div>
      </section>
    </div>
  `
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div class="flex items-start justify-between gap-3">
        <p class="text-sm text-blue-800">${escapeHtml(state.notice)}</p>
        <button type="button" class="inline-flex h-7 items-center rounded-md px-2 text-xs text-blue-700 hover:bg-blue-100" data-pcs-product-archive-action="close-notice">关闭</button>
      </div>
    </section>
  `
}

function stringifyTagList(values: string[]): string {
  return values.filter((item) => item.trim()).join('，')
}

function parseTagList(value: string): string[] {
  return value
    .split(/[，,、/]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatCurrency(value: number, currency = '人民币'): string {
  if (!Number.isFinite(value)) return '-'
  if (currency === '美元') return `$${value.toFixed(2)}`
  if (currency === '印尼盾') return `Rp${Math.round(value).toLocaleString('zh-CN')}`
  return `¥${value.toFixed(2)}`
}

function uniqueImageUrls(urls: string[]): string[] {
  const unique = new Set<string>()
  urls.forEach((item) => {
    const normalized = item.trim()
    if (!normalized) return
    unique.add(normalized)
  })
  return Array.from(unique)
}

function getStyleImageUrls(style: StyleArchiveShellRecord): string[] {
  return uniqueImageUrls([style.mainImageUrl, ...(style.galleryImageUrls || [])])
}

function getStyleCompletionImageUrls(): string[] {
  return uniqueImageUrls([state.styleCompletion.mainImageUrl, ...state.styleCompletion.galleryImageUrls])
}

function renderArchiveImage(url: string, alt: string, size: 'sm' | 'md' = 'md'): string {
  const dimension = size === 'sm' ? 'h-12 w-12' : 'h-20 w-20'
  if (!url) {
    return `<div class="${escapeHtml(toClassName('flex shrink-0 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-slate-400', dimension))}"><i data-lucide="image" class="h-4 w-4"></i></div>`
  }
  return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" class="${escapeHtml(toClassName('shrink-0 rounded-md border border-slate-200 bg-slate-50 object-cover', dimension))}" />`
}

function renderStyleImagePreviewButton(
  url: string,
  title: string,
  size: 'sm' | 'md' = 'md',
  highlighted = false,
): string {
  if (!url) return renderArchiveImage(url, title, size)
  return `
    <button
      type="button"
      class="${escapeHtml(toClassName('overflow-hidden rounded-md', highlighted && 'ring-2 ring-slate-900 ring-offset-1'))}"
      data-pcs-product-archive-action="open-image-preview"
      data-url="${escapeHtml(url)}"
      data-title="${escapeHtml(title)}"
    >
      ${renderArchiveImage(url, title, size)}
    </button>
  `
}

function renderImagePreviewModal(): string {
  if (!state.imagePreview.open || !state.imagePreview.url) return ''
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button type="button" class="absolute inset-0 bg-slate-950/70" data-pcs-product-archive-action="close-image-preview"></button>
      <section class="relative z-10 flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div class="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 class="text-base font-semibold text-slate-900">${escapeHtml(state.imagePreview.title || '款式主图预览')}</h2>
            <p class="mt-1 text-sm text-slate-500">点击遮罩或右上角关闭预览。</p>
          </div>
          <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50" data-pcs-product-archive-action="close-image-preview">×</button>
        </div>
        <div class="overflow-auto bg-slate-100 p-5">
          <img src="${escapeHtml(state.imagePreview.url)}" alt="${escapeHtml(state.imagePreview.title || '款式主图')}" class="mx-auto max-h-[80vh] w-auto max-w-full rounded-lg border border-slate-200 bg-white object-contain shadow-sm" />
        </div>
      </section>
    </div>
  `
}

function renderStyleHeader(): string {
  return `
    <section class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs text-slate-500">商品中心 / 商品档案</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">款式档案</h1>
        <p class="mt-1 text-sm text-slate-500">款式档案只能从商品项目的“生成款式档案”节点发起，这里只负责查看、补齐资料和承接后续规格与技术包链路。</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/projects">
          <i data-lucide="folder-kanban" class="h-4 w-4"></i>前往商品项目
        </button>
      </div>
    </section>
  `
}

function renderStyleStats(): string {
  const stats = getStyleStats()
  return `
    <section class="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      ${renderMetricButton('全部款式', stats.total, '正式款式主档数', 'style-quick-filter', 'data-filter="reset"')}
      ${renderMetricButton('待完善', stats.waitingBaseInfo, '基础资料未补齐，尚未正式建档', 'style-quick-filter', 'data-filter="status" data-value="WAITING_BASE_INFO"')}
      ${renderMetricButton('待技术包', stats.waitingTechPack, '已建档但还没有当前生效技术包', 'style-quick-filter', 'data-filter="status" data-value="WAITING_TECH_PACK"')}
      ${renderMetricButton('已启用', stats.active, '已有当前生效技术包，可承接下游', 'style-quick-filter', 'data-filter="status" data-value="ACTIVE"')}
      ${renderMetricButton('已归档', stats.archived, '历史款式档案，仅保留追溯', 'style-quick-filter', 'data-filter="status" data-value="ARCHIVED"')}
      ${renderMetricButton('映射冲突', stats.mappingConflict, '存在规格映射冲突待处理', 'style-quick-filter', 'data-filter="mapping" data-value="CONFLICT"')}
    </section>
  `
}

function renderStyleFilters(total: number): string {
  return `
    <section class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="flex flex-wrap items-center gap-3">
        <div class="min-w-[240px] flex-1">${renderTextInput('style-list-search', state.styleList.search, '搜索款式编码/名称/款号/老系统编码...')}</div>
        <div class="w-full sm:w-48">${renderSelect('style-list-status', state.styleList.status === 'all' ? '' : state.styleList.status, [{ value: 'WAITING_BASE_INFO', label: '待完善' }, { value: 'WAITING_TECH_PACK', label: '已建档待技术包' }, { value: 'ACTIVE', label: '已启用' }, { value: 'ARCHIVED', label: '已归档' }], '全部状态')}</div>
        <div class="w-full sm:w-44">${renderSelect('style-list-version', state.styleList.version === 'all' ? '' : state.styleList.version, [{ value: 'has', label: '有当前生效技术包' }, { value: 'none', label: '无当前生效技术包' }], '技术包情况')}</div>
        <div class="w-full sm:w-40">${renderSelect('style-list-mapping', state.styleList.mapping === 'all' ? '' : state.styleList.mapping, [{ value: 'OK', label: '健康' }, { value: 'MISSING', label: '缺映射' }, { value: 'CONFLICT', label: '冲突' }], '映射健康')}</div>
      </div>
      <div class="mt-3 text-sm text-slate-500">共 ${escapeHtml(total)} 条款式档案记录。</div>
    </section>
  `
}

function renderStyleTable(items: StyleArchiveListItemViewModel[]): string {
  const rows = items
    .map(
      (item) => `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3">
            <div class="flex items-start gap-3">
              ${renderArchiveImage(item.style.mainImageUrl || '', item.style.styleName, 'sm')}
              <div class="min-w-0">
                <button type="button" class="text-left text-sm font-medium text-slate-900 hover:text-slate-700" data-nav="/pcs/products/styles/${escapeHtml(item.style.styleId)}">
                  ${escapeHtml(item.style.styleCode)}
                </button>
                <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.legacyMappingText)}</div>
              </div>
            </div>
          </td>
          <td class="px-4 py-3">
            <div class="text-sm font-medium text-slate-900">${escapeHtml(item.style.styleName)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.style.styleNameEn || '-')}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.originProjectText)}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">
            <div>${escapeHtml(item.style.categoryName || '-')}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.style.subCategoryName || '-')}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml([item.style.brandName, item.style.yearTag, item.style.seasonTags.join('/')].filter(Boolean).join(' / ') || '-')}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">
            <div>${escapeHtml(item.style.styleTags.join(' / ') || '-')}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.style.targetAudienceTags.join(' / ') || '-')}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.style.priceRangeLabel || '-')}</div>
          </td>
          <td class="px-4 py-3">
            <div class="text-sm font-medium text-slate-900">${escapeHtml(item.currentVersionText)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.style.currentTechPackVersionCode || item.currentVersionMetaText)}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.skuCount)}</td>
          <td class="px-4 py-3">${renderMappingBadge(item.mappingHealth)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">
            <div>${escapeHtml(item.channelCount)} 个渠道店铺商品</div>
            <div class="mt-1 text-xs text-slate-500">在售 ${escapeHtml(item.onSaleCount)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.style.targetChannelCodes.join(' / ') || '-')}</div>
          </td>
          <td class="px-4 py-3">${renderStyleLifecycleBadge(item.style)}</td>
          <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(formatDateTime(item.style.updatedAt))}</td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-end gap-2">
              <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 hover:bg-slate-50" data-nav="/pcs/products/styles/${escapeHtml(item.style.styleId)}">查看</button>
              <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 hover:bg-slate-50" data-pcs-product-archive-action="open-sku-create" data-mode="single" data-style-id="${escapeHtml(item.style.styleId)}">新增规格</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('')

  return `
    <section class="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">款式档案编码</th>
              <th class="px-4 py-3 font-medium">款式名称</th>
              <th class="px-4 py-3 font-medium">类目</th>
              <th class="px-4 py-3 font-medium">风格标签</th>
              <th class="px-4 py-3 font-medium">当前生效版本</th>
              <th class="px-4 py-3 font-medium">规格数</th>
              <th class="px-4 py-3 font-medium">映射状态</th>
              <th class="px-4 py-3 font-medium">渠道 / 在售</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 font-medium">更新时间</th>
              <th class="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="11" class="px-4 py-10 text-center text-sm text-slate-500">暂无款式档案数据。</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `
}

function openStyleCompletionDrawer(style: StyleArchiveShellRecord): void {
  state.styleCompletion = {
    open: true,
    styleId: style.styleId,
    styleName: style.styleName,
    styleNumber: style.styleNumber,
    styleType: style.styleType,
    categoryName: style.categoryName,
    subCategoryName: style.subCategoryName,
    brandName: style.brandName,
    yearTag: style.yearTag,
    seasonTags: stringifyTagList(style.seasonTags),
    styleTags: stringifyTagList(style.styleTags),
    targetAudienceTags: stringifyTagList(style.targetAudienceTags),
    targetChannelCodes: stringifyTagList(style.targetChannelCodes),
    priceRangeLabel: style.priceRangeLabel,
    mainImageUrl: style.mainImageUrl,
    galleryImageUrls: getStyleImageUrls(style),
    sellingPointText: style.sellingPointText,
    detailDescription: style.detailDescription,
    packagingInfo: style.packagingInfo,
    remark: style.remark,
  }
}

function renderStyleFormalizationPanel(style: StyleArchiveShellRecord): string {
  const check = getStyleArchiveFormalizationCheck(style.styleId)
  const missingCount = check.missingFields.length
  const ready = check.ready
  const alreadyFormalized = isStyleArchiveFormalized(style)

  return `
    <section class="rounded-lg border bg-white p-5 shadow-sm">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-base font-semibold text-slate-900">正式建档检查</h2>
            ${alreadyFormalized ? renderBadge('已完成正式建档', 'border-sky-200 bg-sky-50 text-sky-700') : ready ? renderBadge('可以正式建档', 'border-emerald-200 bg-emerald-50 text-emerald-700') : renderBadge(`缺 ${missingCount} 项`, 'border-amber-200 bg-amber-50 text-amber-700')}
          </div>
          <p class="mt-1 text-sm text-slate-500">款式档案从项目节点生成后先进入草稿，补齐基础资料后才能进入正式建档。</p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="open-style-completion" data-style-id="${escapeHtml(style.styleId)}">完善款式资料</button>
          ${
            alreadyFormalized
              ? `<span class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">已完成正式建档</span>`
              : ready
                ? `<button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-product-archive-action="formalize-style-archive" data-style-id="${escapeHtml(style.styleId)}">正式建档</button>`
                : ''
          }
        </div>
      </div>
      <div class="mt-4 grid gap-4 lg:grid-cols-[1fr,1fr]">
        <div class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <div class="text-xs text-slate-500">当前状态</div>
          <div class="mt-2 text-sm font-medium text-slate-900">${escapeHtml(alreadyFormalized ? '款式档案已补齐基础资料，当前可继续推进技术包与转档。' : check.message)}</div>
        </div>
        <div class="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
          <div class="text-xs text-slate-500">必填资料清单</div>
          <div class="mt-2 flex flex-wrap gap-2">
            ${(missingCount > 0 ? check.missingFields : [{ key: 'done', label: '已全部补齐' }])
              .map((item) =>
                renderBadge(
                  item.label,
                  missingCount > 0 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700',
                ),
              )
              .join('')}
          </div>
        </div>
      </div>
    </section>
  `
}

function renderStyleCompletionDrawer(): string {
  if (!state.styleCompletion.open) return ''
  const currentStyle = state.styleCompletion.styleId ? getStyleArchiveById(state.styleCompletion.styleId) : null
  const alreadyFormalized = currentStyle ? isStyleArchiveFormalized(currentStyle) : false
  const renderControlledTextField = (label: string, field: string, value: string, placeholder: string, required = false) =>
    renderFormField(
      label,
      alreadyFormalized ? renderReadonlyValue(value) : renderTextInput(field, value, placeholder),
      required,
      alreadyFormalized ? '正式建档后只读' : '',
    )
  const renderControlledTextareaField = (label: string, field: string, value: string, placeholder: string, rows: number, required = false) =>
    renderFormField(
      label,
      alreadyFormalized ? renderReadonlyValue(value) : renderTextarea(field, value, placeholder, rows),
      required,
      alreadyFormalized ? '正式建档后只读' : '',
    )
  const imageUrls = getStyleCompletionImageUrls()
  const imageGrid = imageUrls.length
    ? imageUrls
        .map(
          (item, index) => `
            <div class="space-y-2">
              ${renderStyleImagePreviewButton(item, `${state.styleCompletion.styleName || '款式主图'} ${index + 1}`, 'md', item === state.styleCompletion.mainImageUrl)}
              <div class="flex flex-wrap gap-2">
                ${
                  !alreadyFormalized && item !== state.styleCompletion.mainImageUrl
                    ? `<button type="button" class="inline-flex h-7 items-center rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-600 hover:bg-slate-50" data-pcs-product-archive-action="set-style-main-image" data-url="${escapeHtml(item)}">设为主图</button>`
                    : ''
                }
                ${
                  !alreadyFormalized
                    ? `<button type="button" class="inline-flex h-7 items-center rounded-md border border-rose-200 bg-white px-2 text-xs text-rose-600 hover:bg-rose-50" data-pcs-product-archive-action="remove-style-image" data-url="${escapeHtml(item)}">删除</button>`
                    : ''
                }
              </div>
            </div>
          `,
        )
        .join('')
    : '<div class="col-span-full rounded-md border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">当前还没有款式主图，请先上传图片。</div>'
  const body = `
    <div class="space-y-5">
      ${
        alreadyFormalized
          ? `
            <div class="rounded-md border border-sky-200 bg-sky-50 px-4 py-3 text-sm leading-6 text-sky-700">
              当前款式已完成正式建档。以下核心建档字段改为只读，当前仅允许补充包装信息与备注。
            </div>
          `
          : ''
      }
      <div class="grid gap-4 md:grid-cols-2">
        ${renderControlledTextField('款式名称', 'style-completion-style-name', state.styleCompletion.styleName, '填写款式名称', true)}
        ${renderControlledTextField('款号', 'style-completion-style-number', state.styleCompletion.styleNumber, '填写款号', true)}
        ${renderControlledTextField('款式类型', 'style-completion-style-type', state.styleCompletion.styleType, '例如：基础款 / 快时尚款', true)}
        ${renderControlledTextField('品牌', 'style-completion-brand-name', state.styleCompletion.brandName, '填写品牌', true)}
        ${renderControlledTextField('一级类目', 'style-completion-category-name', state.styleCompletion.categoryName, '填写一级类目', true)}
        ${renderControlledTextField('二级类目', 'style-completion-sub-category-name', state.styleCompletion.subCategoryName, '填写二级类目', true)}
        ${renderControlledTextField('年份', 'style-completion-year-tag', state.styleCompletion.yearTag, '填写年份', true)}
        ${renderControlledTextField('价格带', 'style-completion-price-range-label', state.styleCompletion.priceRangeLabel, '例如：¥199-399', true)}
      </div>
      <div class="grid gap-4 md:grid-cols-2">
        ${renderControlledTextField('季节标签', 'style-completion-season-tags', state.styleCompletion.seasonTags, '多个标签用中文逗号分隔', true)}
        ${renderControlledTextField('风格标签', 'style-completion-style-tags', state.styleCompletion.styleTags, '多个标签用中文逗号分隔', true)}
        ${renderControlledTextField('目标人群', 'style-completion-target-audience-tags', state.styleCompletion.targetAudienceTags, '多个标签用中文逗号分隔', true)}
        ${renderControlledTextField('目标渠道', 'style-completion-target-channel-codes', state.styleCompletion.targetChannelCodes, '多个渠道用中文逗号分隔', true)}
      </div>
      <section class="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="text-sm font-medium text-slate-900">款式主图</div>
            <p class="mt-1 text-xs text-slate-500">支持上传多张主图，第一张作为主展示图，点击缩略图可查看大图。</p>
          </div>
          ${
            alreadyFormalized
              ? `<div class="text-xs text-slate-500">正式建档后只读</div>`
              : `
                <label class="inline-flex h-9 cursor-pointer items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
                  上传主图
                  <input type="file" accept="image/*" multiple data-pcs-product-archive-field="style-completion-main-images" class="hidden" />
                </label>
              `
          }
        </div>
        <div class="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
          ${imageGrid}
        </div>
      </section>
      ${renderControlledTextareaField('卖点摘要', 'style-completion-selling-point-text', state.styleCompletion.sellingPointText, '填写款式卖点摘要', 3, true)}
      ${renderControlledTextareaField('详情描述', 'style-completion-detail-description', state.styleCompletion.detailDescription, '填写详情描述', 5, true)}
      ${renderFormField('包装信息', renderTextarea('style-completion-packaging-info', state.styleCompletion.packagingInfo, '可填写包装与发货说明', 3), false, alreadyFormalized ? '正式建档后仅允许补充包装信息与备注。' : '')}
      ${renderFormField('备注', renderTextarea('style-completion-remark', state.styleCompletion.remark, '可填写补充说明', 3))}
    </div>
  `

  const footer = `
    <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="close-drawers">取消</button>
    <button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-product-archive-action="submit-style-completion">保存资料</button>
  `

  return renderDrawerShell('完善款式资料', '补齐款式档案基础资料后，才可以从草稿进入正式建档。', body, footer)
}

function submitStyleCompletion(): void {
  if (!state.styleCompletion.styleId) {
    state.notice = '未找到待补齐的款式档案。'
    return
  }

  const currentStyle = getStyleArchiveById(state.styleCompletion.styleId)
  const alreadyFormalized = currentStyle ? isStyleArchiveFormalized(currentStyle) : false
  const imageUrls = getStyleCompletionImageUrls()
  const updated = updateStyleArchive(state.styleCompletion.styleId, {
    ...(alreadyFormalized
      ? {}
      : {
          styleName: state.styleCompletion.styleName.trim(),
          styleNumber: state.styleCompletion.styleNumber.trim(),
          styleType: state.styleCompletion.styleType.trim(),
          categoryName: state.styleCompletion.categoryName.trim(),
          subCategoryName: state.styleCompletion.subCategoryName.trim(),
          brandName: state.styleCompletion.brandName.trim(),
          yearTag: state.styleCompletion.yearTag.trim(),
          seasonTags: parseTagList(state.styleCompletion.seasonTags),
          styleTags: parseTagList(state.styleCompletion.styleTags),
          targetAudienceTags: parseTagList(state.styleCompletion.targetAudienceTags),
          targetChannelCodes: parseTagList(state.styleCompletion.targetChannelCodes),
          priceRangeLabel: state.styleCompletion.priceRangeLabel.trim(),
          mainImageUrl: imageUrls[0] || '',
          galleryImageUrls: imageUrls,
          sellingPointText: state.styleCompletion.sellingPointText.trim(),
          detailDescription: state.styleCompletion.detailDescription.trim(),
        }),
    packagingInfo: state.styleCompletion.packagingInfo.trim(),
    remark: state.styleCompletion.remark.trim(),
    updatedAt: nowText(),
    updatedBy: '当前用户',
  })

  resetStyleCompletionState()

  if (!updated) {
    state.notice = '保存款式资料失败。'
    return
  }

  const check = getStyleArchiveFormalizationCheck(updated.styleId)
  state.notice = alreadyFormalized
    ? `已保存 ${updated.styleCode} 的受控补充信息，核心建档字段保持只读。`
    : check.ready
      ? `已保存 ${updated.styleCode} 的款式资料，当前可以正式建档。`
      : `已保存 ${updated.styleCode} 的款式资料，仍需补齐：${check.missingFields.map((item) => item.label).join('、')}。`
}

function renderSkuHeader(): string {
  return `
    <section class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs text-slate-500">商品中心 / 商品档案</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">规格档案</h1>
        <p class="mt-1 text-sm text-slate-500">对应参照对象的商品档案 - SKU，管理规格主档、条码、渠道映射与上架关联。</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm text-white hover:bg-slate-800" data-pcs-product-archive-action="open-sku-create" data-mode="single">
          <i data-lucide="plus" class="h-4 w-4"></i>新建规格
        </button>
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="open-sku-create" data-mode="batch">
          <i data-lucide="table-properties" class="h-4 w-4"></i>批量生成
        </button>
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="open-sku-create" data-mode="import">
          <i data-lucide="link" class="h-4 w-4"></i>导入/绑定老系统 SKU
        </button>
      </div>
    </section>
  `
}

function renderSkuStats(): string {
  const stats = getSkuStats()
  return `
    <section class="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
      ${renderMetricButton('全部规格', stats.total, '正式 SKU 主档数', 'sku-quick-filter', 'data-filter="reset"')}
      ${renderMetricButton('启用中', stats.active, '当前允许上架与渠道映射', 'sku-quick-filter', 'data-filter="status" data-value="ACTIVE"')}
      ${renderMetricButton('停用中', stats.inactive, '保留历史数据，不参与当前流转', 'sku-quick-filter', 'data-filter="status" data-value="INACTIVE"')}
      ${renderMetricButton('映射正常', stats.mappingOK, '渠道映射关系完整', 'sku-quick-filter', 'data-filter="mapping" data-value="OK"')}
      ${renderMetricButton('缺渠道映射', stats.mappingMissing, '仍需补齐渠道 SKU 映射', 'sku-quick-filter', 'data-filter="mapping" data-value="MISSING"')}
      ${renderMetricButton('映射冲突', stats.mappingConflict, '存在同码冲突或多头映射', 'sku-quick-filter', 'data-filter="mapping" data-value="CONFLICT"')}
    </section>
  `
}

function renderSkuFilters(total: number): string {
  const styleOptions = listStyleArchives().map((item) => ({ value: item.styleId, label: `${item.styleCode} · ${item.styleName}` }))
  return `
    <section class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="flex flex-wrap items-center gap-3">
        <div class="min-w-[240px] flex-1">${renderTextInput('sku-list-search', state.skuList.search, '搜索规格编码/条码/款式名称...')}</div>
        <div class="w-full sm:w-40">${renderSelect('sku-list-status', state.skuList.status === 'all' ? '' : state.skuList.status, [{ value: 'ACTIVE', label: '启用' }, { value: 'INACTIVE', label: '停用' }, { value: 'ARCHIVED', label: '已归档' }], '全部状态')}</div>
        <div class="w-full sm:w-40">${renderSelect('sku-list-mapping', state.skuList.mapping === 'all' ? '' : state.skuList.mapping, [{ value: 'OK', label: '健康' }, { value: 'MISSING', label: '缺映射' }, { value: 'CONFLICT', label: '冲突' }], '映射健康')}</div>
        <div class="w-full sm:min-w-[260px] sm:flex-1">${renderSelect('sku-list-style-id', state.skuList.styleId, styleOptions, '全部款式')}</div>
      </div>
      <div class="mt-3 text-sm text-slate-500">共 ${escapeHtml(total)} 条规格档案记录。</div>
    </section>
  `
}

function renderSkuTable(items: SkuArchiveRecord[]): string {
  const rows = items
    .map(
      (item) => `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3">
            <div class="flex items-start gap-3">
              ${renderArchiveImage(item.skuImageUrl || '', item.skuCode, 'sm')}
              <div class="min-w-0">
                <button type="button" class="text-left text-sm font-medium text-slate-900 hover:text-slate-700" data-nav="/pcs/products/specifications/${escapeHtml(item.skuId)}">${escapeHtml(item.skuCode)}</button>
                <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.skuName || '-')}</div>
                <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.barcode || '-')}</div>
              </div>
            </div>
          </td>
          <td class="px-4 py-3">
            <button type="button" class="text-left text-sm font-medium text-slate-900 hover:text-slate-700" data-nav="/pcs/products/styles/${escapeHtml(item.styleId)}">${escapeHtml(item.styleCode)}</button>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.styleName)}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.colorName)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.sizeName)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.printName || '-')}</td>
          <td class="px-4 py-3 text-sm text-slate-700">
            ${
              item.techPackVersionId
                ? `<button type="button" class="text-left font-medium text-slate-900 hover:text-slate-700" data-nav="/pcs/products/styles/${escapeHtml(item.styleId)}/technical-data/${escapeHtml(item.techPackVersionId)}">${escapeHtml(item.techPackVersionLabel || item.techPackVersionCode || '未关联')}</button>`
                : escapeHtml(item.techPackVersionLabel || '未关联')
            }
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.techPackVersionCode || '-')}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">
            <div>${escapeHtml(formatCurrency(item.costPrice, item.currency))}</div>
            <div class="mt-1 text-xs text-slate-500">售价 ${escapeHtml(formatCurrency(item.suggestedRetailPrice, item.currency))}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.pricingUnit || '-')}</div>
          </td>
          <td class="px-4 py-3">${renderMappingBadge(item.mappingHealth)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">
            <div>${escapeHtml(item.channelMappingCount)} 个映射</div>
            <div class="mt-1 text-xs text-slate-500">已上架 ${escapeHtml(item.listedChannelCount)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.lastListingAt || '-')}</div>
          </td>
          <td class="px-4 py-3">${renderStatusBadge(item.archiveStatus, 'sku')}</td>
          <td class="px-4 py-3">
            <div class="flex items-center justify-end gap-2">
              <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 hover:bg-slate-50" data-nav="/pcs/products/specifications/${escapeHtml(item.skuId)}">查看</button>
              <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 hover:bg-slate-50" data-pcs-product-archive-action="toggle-sku-status" data-sku-id="${escapeHtml(item.skuId)}">${item.archiveStatus === 'ACTIVE' ? '停用' : '启用'}</button>
            </div>
          </td>
        </tr>
      `,
    )
    .join('')

  return `
    <section class="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">规格编码</th>
              <th class="px-4 py-3 font-medium">款式档案</th>
              <th class="px-4 py-3 font-medium">颜色</th>
              <th class="px-4 py-3 font-medium">尺码</th>
              <th class="px-4 py-3 font-medium">花型 / 印花</th>
              <th class="px-4 py-3 font-medium">资料版本</th>
              <th class="px-4 py-3 font-medium">成本价</th>
              <th class="px-4 py-3 font-medium">映射健康</th>
              <th class="px-4 py-3 font-medium">渠道映射数</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="11" class="px-4 py-10 text-center text-sm text-slate-500">暂无规格档案数据。</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `
}

function renderSkuCreateDrawer(): string {
  if (!state.skuCreate.open) return ''
  const mode = state.skuCreate.mode
  const styleOptions = listStyleArchives().map((item) => ({ value: item.styleId, label: `${item.styleCode} · ${item.styleName}` }))
  const colorOptions = listConfiguredSkuColors()
  const sizeOptions = listConfiguredSkuSizes()
  const title = mode === 'batch' ? '批量生成规格' : mode === 'import' ? '导入 / 绑定老系统 SKU' : '新建规格'
  const description =
    mode === 'batch'
      ? '按颜色与尺码矩阵一次性生成多条规格档案。'
      : mode === 'import'
        ? '绑定老系统 SKU 编码，建立正式规格档案主记录。'
        : '创建单个规格档案，并关联到正式款式主档。'

  const body =
    mode === 'batch'
      ? `
        <div class="space-y-5">
          ${renderFormField('所属款式档案', renderSelect('sku-create-style-id', state.skuCreate.styleId, styleOptions, '选择款式档案'), true)}
          <div class="space-y-2">
            <div class="text-sm font-medium text-slate-700">颜色矩阵</div>
            <div class="flex flex-wrap gap-3">
              ${colorOptions.map((item) => renderCheckbox('sku-create-batch-color', state.skuCreate.batchColors.includes(item), item, `data-value="${escapeHtml(item)}"`)).join('')}
            </div>
          </div>
          <div class="space-y-2">
            <div class="text-sm font-medium text-slate-700">尺码矩阵</div>
            <div class="flex flex-wrap gap-3">
              ${sizeOptions.map((item) => renderCheckbox('sku-create-batch-size', state.skuCreate.batchSizes.includes(item), item, `data-value="${escapeHtml(item)}"`)).join('')}
            </div>
          </div>
          ${renderFormField('统一花型 / 印花', renderTextInput('sku-create-batch-print', state.skuCreate.batchPrint, '可选，留空则按基础款生成'))}
        </div>
      `
      : `
        <div class="space-y-5">
          ${renderFormField('所属款式档案', renderSelect('sku-create-style-id', state.skuCreate.styleId, styleOptions, '选择款式档案'), true)}
          <div class="grid gap-4 md:grid-cols-2">
            ${renderFormField('颜色', renderSelect('sku-create-color', state.skuCreate.color, colorOptions.map((item) => ({ value: item, label: item })), '选择颜色'), true, '来源：配置工作台 / 颜色')}
            ${renderFormField('尺码', renderSelect('sku-create-size', state.skuCreate.size, sizeOptions.map((item) => ({ value: item, label: item })), '选择尺码'), true, '来源：配置工作台 / 尺码')}
          </div>
          ${renderFormField('花型 / 印花', renderTextInput('sku-create-print', state.skuCreate.print, '例如：花型A / 基础款'))}
          ${renderFormField('条码', renderTextInput('sku-create-barcode', state.skuCreate.barcode, '输入或留空自动生成'))}
          ${
            mode === 'single'
              ? `
                <div class="space-y-2">
                  <div class="text-sm font-medium text-slate-700">编码策略</div>
                  <div class="flex flex-wrap gap-3">
                    ${renderCheckbox('sku-create-code-strategy-auto', state.skuCreate.codeStrategy === 'auto', '自动生成')}
                    ${renderCheckbox('sku-create-code-strategy-manual', state.skuCreate.codeStrategy === 'manual', '手工输入')}
                  </div>
                </div>
                ${state.skuCreate.codeStrategy === 'manual' ? renderFormField('手工编码', renderTextInput('sku-create-manual-code', state.skuCreate.manualCode, '输入规格编码'), true) : ''}
              `
              : `
                <div class="grid gap-4 md:grid-cols-2">
                  ${renderFormField('老系统', renderSelect('sku-create-legacy-system', state.skuCreate.legacySystem, LEGACY_SYSTEM_OPTIONS.map((item) => ({ value: item, label: item })), '选择来源系统'), true)}
                  ${renderFormField('老系统编码', renderTextInput('sku-create-legacy-code', state.skuCreate.legacyCode, '输入老系统 SKU 编码'), true)}
                </div>
                ${renderFormField('正式规格编码', renderTextInput('sku-create-manual-code', state.skuCreate.manualCode, '输入正式规格编码'), true)}
              `
          }
        </div>
      `

  const footer = `
    <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="close-drawers">取消</button>
    <button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-product-archive-action="${mode === 'batch' ? 'submit-sku-batch-create' : 'submit-sku-create'}">${mode === 'batch' ? '确认生成' : '确认创建'}</button>
  `

  return renderDrawerShell(title, description, body, footer)
}

function renderStyleDetailOverview(style: StyleArchiveShellRecord): string {
  const skus = listSkuArchivesByStyleId(style.styleId)
  const styleChannelProducts = listStyleChannelProducts(style)
  const currentChannelProduct = styleChannelProducts[0] || null
  const onSaleChannelCount = countOnSaleChannelProducts(styleChannelProducts)
  const gallery = getStyleImageUrls(style)
  const alreadyFormalized = isStyleArchiveFormalized(style)
  const currentTechPackHref =
    style.currentTechPackVersionId && style.currentTechPackVersionCode
      ? `/pcs/products/styles/${style.styleId}/technical-data/${style.currentTechPackVersionId}`
      : ''
  return `
    <section class="grid gap-4 xl:grid-cols-[2.2fr,1fr]">
      <div class="rounded-lg border bg-white p-5 shadow-sm">
        <div class="flex flex-col gap-5 lg:flex-row">
          <div class="w-full max-w-[320px] shrink-0 space-y-3">
            ${renderStyleImagePreviewButton(style.mainImageUrl, style.styleName, 'md', true)}
            <div class="grid grid-cols-3 gap-2 sm:grid-cols-4">
              ${gallery
                .map((item, index) => renderStyleImagePreviewButton(item, `${style.styleName} ${index + 1}`, 'sm', item === style.mainImageUrl))
                .join('')}
            </div>
            ${
              alreadyFormalized
                ? ''
                : `<button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="open-style-completion" data-style-id="${escapeHtml(style.styleId)}">上传主图</button>`
            }
          </div>
          <div class="min-w-0 flex-1">
            <div class="grid gap-4 md:grid-cols-2">
              <div><div class="text-xs text-slate-500">款式名称</div><div class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(style.styleName)}</div></div>
              <div><div class="text-xs text-slate-500">外文名</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(style.styleNameEn || '-')}</div></div>
              <div><div class="text-xs text-slate-500">款式编码 / 款号</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(style.styleCode)} / ${escapeHtml(style.styleNumber || '-')}</div></div>
              <div><div class="text-xs text-slate-500">品牌</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(style.brandName || '-')}</div></div>
              <div><div class="text-xs text-slate-500">一级类目</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(style.categoryName || '-')}</div></div>
              <div><div class="text-xs text-slate-500">二级类目</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(style.subCategoryName || '-')}</div></div>
              <div><div class="text-xs text-slate-500">年份 / 季节</div><div class="mt-1 text-sm text-slate-700">${escapeHtml([style.yearTag, style.seasonTags.join('/')].filter(Boolean).join(' / ') || '-')}</div></div>
              <div><div class="text-xs text-slate-500">人群标签</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(style.targetAudienceTags.join(' / ') || '-')}</div></div>
              <div><div class="text-xs text-slate-500">风格标签</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(style.styleTags.join(' / ') || '-')}</div></div>
              <div><div class="text-xs text-slate-500">价格带</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(style.priceRangeLabel || '-')}</div></div>
              <div><div class="text-xs text-slate-500">来源项目</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(style.sourceProjectCode ? `${style.sourceProjectCode} · ${style.sourceProjectName}` : '未绑定商品项目')}</div></div>
              <div><div class="text-xs text-slate-500">当前生效技术包</div><div class="mt-1 text-sm text-slate-700">${currentTechPackHref ? `<button type="button" class="font-medium text-slate-900 hover:text-slate-700" data-nav="${escapeHtml(currentTechPackHref)}">${escapeHtml(style.currentTechPackVersionLabel || style.currentTechPackVersionCode)}</button>` : escapeHtml(style.currentTechPackVersionLabel || '未建立当前生效技术包')}</div></div>
              <div class="md:col-span-2"><div class="text-xs text-slate-500">测款渠道</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(style.targetChannelCodes.join(' / ') || '-')}</div></div>
              <div class="md:col-span-2"><div class="text-xs text-slate-500">卖点摘要</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(style.sellingPointText || '-')}</div></div>
              <div class="md:col-span-2"><div class="text-xs text-slate-500">包装信息</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(style.packagingInfo || '-')}</div></div>
              <div class="md:col-span-2"><div class="text-xs text-slate-500">详情描述</div><div class="mt-1 text-sm leading-6 text-slate-700">${escapeHtml(style.detailDescription || '-')}</div></div>
            </div>
          </div>
        </div>
      </div>
      <aside class="space-y-4 rounded-lg border bg-white p-5 shadow-sm">
        <div class="text-sm font-medium text-slate-900">关联合并概览</div>
        <div class="grid gap-3">
          <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <div class="text-xs text-slate-500">规格档案</div>
            <div class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(skus.length)}</div>
          </div>
          <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <div class="text-xs text-slate-500">渠道店铺商品</div>
            <div class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(`${styleChannelProducts.length || style.channelProductCount} 个`)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(currentChannelProduct?.channelProductCode || `在售 ${onSaleChannelCount}`)}</div>
          </div>
          <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <div class="text-xs text-slate-500">价格带 / 渠道</div>
            <div class="mt-1 text-sm text-slate-700">${escapeHtml(style.priceRangeLabel || '-')}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(style.targetChannelCodes.join(' / ') || '-')}</div>
          </div>
          <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
            <div class="text-xs text-slate-500">更新时间</div>
            <div class="mt-1 text-sm text-slate-700">${escapeHtml(formatDateTime(style.updatedAt))}</div>
          </div>
        </div>
      </aside>
    </section>
  `
}

function renderStyleDetailVersions(style: StyleArchiveShellRecord): string {
  const versions = buildTechnicalVersionListByStyle(style.styleId)
  const rows = versions
    .map(
      (item) => `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3">
            <div class="text-sm font-medium text-slate-900">${escapeHtml(item.versionLabel)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.technicalVersionCode)}</div>
          </td>
          <td class="px-4 py-3">${renderBadge(item.versionStatusLabel, item.isCurrentTechPackVersion ? 'border-blue-200 bg-blue-50 text-blue-700' : item.versionStatus === 'PUBLISHED' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-600')}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(`${item.completenessScore}%`)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.sourceTaskText)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.sourceProjectText)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(String(item.versionLogCount))} 条</td>
          <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(formatDateTime(item.updatedAt))}</td>
          <td class="px-4 py-3">
            <div class="flex flex-wrap gap-2">
              <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 hover:bg-slate-50" data-nav="/pcs/products/styles/${escapeHtml(style.styleId)}/technical-data/${escapeHtml(item.technicalVersionId)}">查看版本</button>
              <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 hover:bg-slate-50" data-nav="/pcs/products/styles/${escapeHtml(style.styleId)}/technical-data/${escapeHtml(item.technicalVersionId)}">查看版本日志</button>
              ${item.canActivate ? `<button type="button" class="inline-flex h-8 items-center rounded-md bg-slate-900 px-3 text-xs text-white hover:bg-slate-800" data-pcs-product-archive-action="activate-tech-pack-version" data-style-id="${escapeHtml(style.styleId)}" data-version-id="${escapeHtml(item.technicalVersionId)}">启用为当前生效版本</button>` : ''}
            </div>
          </td>
        </tr>
      `,
    )
    .join('')
  return `
    <section class="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div class="border-b border-slate-200 px-4 py-3">
        <h2 class="text-sm font-medium text-slate-900">技术包版本</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">版本</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 font-medium">完整度</th>
              <th class="px-4 py-3 font-medium">来源任务</th>
              <th class="px-4 py-3 font-medium">来源项目</th>
              <th class="px-4 py-3 font-medium">版本日志</th>
              <th class="px-4 py-3 font-medium">更新时间</th>
              <th class="px-4 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="8" class="px-4 py-10 text-center text-sm text-slate-500">当前款式尚未建立技术包版本。</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `
}

function renderStyleDetailSpecifications(style: StyleArchiveShellRecord): string {
  const skus = listSkuArchivesByStyleId(style.styleId)
  const rows = skus
    .map(
      (item) => `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3">
            <button type="button" class="text-left text-sm font-medium text-slate-900 hover:text-slate-700" data-nav="/pcs/products/specifications/${escapeHtml(item.skuId)}">${escapeHtml(item.skuCode)}</button>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.barcode || '-')}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.colorName)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.sizeName)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.printName || '-')}</td>
          <td class="px-4 py-3">${renderMappingBadge(item.mappingHealth)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.channelMappingCount)} / 已上架 ${escapeHtml(item.listedChannelCount)}</td>
          <td class="px-4 py-3">${renderStatusBadge(item.archiveStatus, 'sku')}</td>
        </tr>
      `,
    )
    .join('')
  return `
    <section class="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <h2 class="text-sm font-medium text-slate-900">规格档案</h2>
        <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 hover:bg-slate-50" data-pcs-product-archive-action="open-sku-create" data-mode="single" data-style-id="${escapeHtml(style.styleId)}">新增规格</button>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">规格编码</th>
              <th class="px-4 py-3 font-medium">颜色</th>
              <th class="px-4 py-3 font-medium">尺码</th>
              <th class="px-4 py-3 font-medium">花型 / 印花</th>
              <th class="px-4 py-3 font-medium">映射健康</th>
              <th class="px-4 py-3 font-medium">渠道状态</th>
              <th class="px-4 py-3 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-slate-500">当前款式尚未建立规格档案。</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `
}

function renderStyleDetailMappings(style: StyleArchiveShellRecord): string {
  const latestVersion = resolveLatestVersionMeta(style.styleId)
  const styleChannelProducts = listStyleChannelProducts(style)
  return `
    <section class="grid gap-4 xl:grid-cols-3">
      <div class="rounded-lg border bg-white p-5 shadow-sm">
        <div class="text-sm font-medium text-slate-900">主关联编码</div>
        <div class="mt-4 space-y-3 text-sm text-slate-700">
          <div><span class="text-slate-500">正式款式编码：</span>${escapeHtml(style.styleCode)}</div>
          <div><span class="text-slate-500">款号：</span>${escapeHtml(style.styleNumber || '-')}</div>
          <div><span class="text-slate-500">当前生效技术包：</span>${escapeHtml(style.currentTechPackVersionLabel || latestVersion.versionLabel || '未建立')}</div>
        </div>
      </div>
      <div class="rounded-lg border bg-white p-5 shadow-sm">
        <div class="text-sm font-medium text-slate-900">来源与继承</div>
        <div class="mt-4 space-y-3 text-sm text-slate-700">
          <div><span class="text-slate-500">来源商品项目：</span>${escapeHtml(style.sourceProjectCode ? `${style.sourceProjectCode} · ${style.sourceProjectName}` : '未绑定')}</div>
          <div><span class="text-slate-500">老系统来源：</span>${escapeHtml(style.legacyOriginProject || '无')}</div>
          <div><span class="text-slate-500">生成人：</span>${escapeHtml(style.generatedBy || '-')}</div>
        </div>
      </div>
      <div class="rounded-lg border bg-white p-5 shadow-sm">
        <div class="text-sm font-medium text-slate-900">同步健康</div>
        <div class="mt-4 space-y-3 text-sm text-slate-700">
          <div><span class="text-slate-500">规格映射健康：</span>${renderMappingBadge(resolveStyleMappingHealth(listSkuArchivesByStyleId(style.styleId)))}</div>
          <div><span class="text-slate-500">渠道店铺商品：</span>${escapeHtml(`${styleChannelProducts.length || style.channelProductCount} 个`)}</div>
          <div><span class="text-slate-500">最近更新：</span>${escapeHtml(formatDateTime(style.updatedAt))}</div>
        </div>
      </div>
    </section>
  `
}

function renderStyleDetailChannels(style: StyleArchiveShellRecord): string {
  const rows = listStyleChannelProducts(style)
    .map(
      (item) => `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3">
            <div class="text-sm font-medium text-slate-900">${escapeHtml(item.channelProductCode)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.projectCode)}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.skuCode || '—')}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.channelName)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.storeName)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.listingTitle)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.upstreamChannelProductCode || '-')}</td>
          <td class="px-4 py-3">${renderBadge(item.channelProductStatus, item.channelProductStatus === '已作废' ? 'border-slate-200 bg-slate-100 text-slate-600' : item.channelProductStatus === '已生效' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-blue-200 bg-blue-50 text-blue-700')}</td>
        </tr>
      `,
    )
    .join('')
  return `
    <section class="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div class="border-b border-slate-200 px-4 py-3">
        <h2 class="text-sm font-medium text-slate-900">渠道店铺商品</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">渠道店铺商品</th>
              <th class="px-4 py-3 font-medium">规格档案</th>
              <th class="px-4 py-3 font-medium">渠道</th>
              <th class="px-4 py-3 font-medium">店铺</th>
              <th class="px-4 py-3 font-medium">标题</th>
              <th class="px-4 py-3 font-medium">上游商品编码</th>
              <th class="px-4 py-3 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-slate-500">当前款式尚未关联渠道店铺商品。</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `
}

function renderStyleDetailLogs(style: StyleArchiveShellRecord): string {
  const logs = [
    { time: style.generatedAt || style.updatedAt, title: '建立款式档案', detail: `${style.generatedBy || '系统初始化'} 创建正式款式档案` },
    { time: style.updatedAt, title: '更新主档信息', detail: `${style.updatedBy || '系统同步'} 更新款式主档状态与映射指针` },
    ...buildTechnicalVersionListByStyle(style.styleId).slice(0, 3).map((item) => ({
      time: item.updatedAt,
      title: `技术包版本 ${item.versionLabel}`,
      detail: `${item.versionStatusLabel}，完整度 ${item.completenessScore}%`,
    })),
  ]

  return `
    <section class="rounded-lg border bg-white p-5 shadow-sm">
      <div class="space-y-4">
        ${logs
          .map(
            (item) => `
              <div class="border-l-2 border-slate-200 pl-4">
                <div class="text-xs text-slate-500">${escapeHtml(formatDateTime(item.time))}</div>
                <div class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(item.title)}</div>
                <div class="mt-1 text-sm text-slate-600">${escapeHtml(item.detail)}</div>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderStyleDetailPage(styleId: string): string {
  ensurePageDataReady()
  if (state.styleDetail.styleId !== styleId) {
    state.styleDetail.styleId = styleId
    state.styleDetail.activeTab = 'overview'
  }

  const style = getStyleArchiveById(styleId)
  if (!style) {
    return `
      <div class="space-y-5 p-4">
        <section class="rounded-lg border bg-white p-4 text-center shadow-sm">
          <h1 class="text-xl font-semibold text-slate-900">未找到款式档案</h1>
          <p class="mt-2 text-sm text-slate-500">请返回款式档案列表重新选择。</p>
          <button type="button" class="mt-4 inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/products/styles">返回列表</button>
        </section>
      </div>
    `
  }

  const tabButtons = STYLE_DETAIL_TABS.map(
    (tab) => `
      <button type="button" class="${escapeHtml(toClassName('inline-flex h-9 items-center rounded-md px-3 text-sm', state.styleDetail.activeTab === tab.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'))}" data-pcs-product-archive-action="set-style-detail-tab" data-value="${escapeHtml(tab.key)}">${escapeHtml(tab.label)}</button>
    `,
  ).join('')

  const tabContent =
    state.styleDetail.activeTab === 'overview'
      ? renderStyleDetailOverview(style)
      : state.styleDetail.activeTab === 'versions'
        ? renderStyleDetailVersions(style)
        : state.styleDetail.activeTab === 'specifications'
          ? renderStyleDetailSpecifications(style)
          : state.styleDetail.activeTab === 'mappings'
            ? renderStyleDetailMappings(style)
            : state.styleDetail.activeTab === 'channels'
              ? renderStyleDetailChannels(style)
              : renderStyleDetailLogs(style)

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      <section class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-start gap-4">
          <button type="button" class="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/products/styles">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>返回列表
          </button>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(style.styleCode)}</h1>
              ${renderStyleLifecycleBadge(style)}
            </div>
            <p class="mt-1 text-sm text-slate-500">${escapeHtml(style.styleName)} · ${escapeHtml(style.categoryName || style.subCategoryName || '未设置类目')}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="open-style-completion" data-style-id="${escapeHtml(style.styleId)}">
            <i data-lucide="square-pen" class="h-4 w-4"></i>完善资料
          </button>
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="open-sku-create" data-mode="single" data-style-id="${escapeHtml(style.styleId)}">
            <i data-lucide="plus" class="h-4 w-4"></i>新增规格
          </button>
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md ${style.archiveStatus === 'ARCHIVED' ? 'bg-slate-900 text-white hover:bg-slate-800' : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'} px-3 text-sm" data-pcs-product-archive-action="toggle-style-status" data-style-id="${escapeHtml(style.styleId)}">
            <i data-lucide="archive" class="h-4 w-4"></i>${style.archiveStatus === 'ARCHIVED' ? '恢复启用' : '归档'}
          </button>
        </div>
      </section>
      <section class="rounded-lg border bg-white p-2 shadow-sm">
        <div class="flex flex-wrap gap-2">${tabButtons}</div>
      </section>
      ${tabContent}
      ${renderSkuCreateDrawer()}
      ${renderStyleCompletionDrawer()}
      ${renderImagePreviewModal()}
    </div>
  `
}

function buildSkuChannelMappingRows(sku: SkuArchiveRecord) {
  return listProjectChannelProducts()
    .filter((item) => item.styleId === sku.styleId && item.channelProductStatus !== '已作废')
    .map((item, index) => ({
      id: `${sku.skuId}_mapping_${index + 1}`,
      channel: item.channelName,
      store: item.storeName,
      storeId: item.storeId,
      platformSkuId: `${item.channelCode.toUpperCase()}-${sku.skuCode}`.slice(0, 32),
      sellerSku: sku.skuCode,
      platformItemId: item.upstreamChannelProductCode || item.channelProductCode,
      status: sku.mappingHealth === 'OK' ? '生效中' : sku.mappingHealth === 'MISSING' ? '待补齐' : '冲突待处理',
      effectiveFrom: item.effectiveAt || item.updatedAt,
      effectiveTo: '',
      source: item.projectCode || item.channelProductCode,
      listingTitle: item.listingTitle,
    }))
}

function renderSkuDetailOverview(sku: SkuArchiveRecord): string {
  return `
    <section class="grid gap-4 xl:grid-cols-[2fr,1fr]">
      <div class="rounded-lg border bg-white p-5 shadow-sm">
        <div class="flex flex-col gap-5 lg:flex-row">
          <div class="w-full max-w-[260px] shrink-0 space-y-3">
            ${renderArchiveImage(sku.skuImageUrl || '', sku.skuCode)}
            <div class="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
              <div>渠道标题</div>
              <div class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(sku.channelTitle || '-')}</div>
            </div>
          </div>
          <div class="min-w-0 flex-1">
            <div class="grid gap-4 md:grid-cols-2">
              <div><div class="text-xs text-slate-500">所属款式</div><div class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(sku.styleCode)} · ${escapeHtml(sku.styleName)}</div></div>
              <div><div class="text-xs text-slate-500">资料版本</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.techPackVersionLabel || '未关联')}</div></div>
              <div><div class="text-xs text-slate-500">SKU 中文名</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.skuName || '-')}</div></div>
              <div><div class="text-xs text-slate-500">SKU 外文名</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.skuNameEn || '-')}</div></div>
              <div><div class="text-xs text-slate-500">颜色</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.colorName)}</div></div>
              <div><div class="text-xs text-slate-500">尺码</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.sizeName)}</div></div>
              <div><div class="text-xs text-slate-500">花型 / 印花</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.printName || '-')}</div></div>
              <div><div class="text-xs text-slate-500">条码</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.barcode || '-')}</div></div>
              <div><div class="text-xs text-slate-500">成本价</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(formatCurrency(sku.costPrice, sku.currency))}</div></div>
              <div><div class="text-xs text-slate-500">含运费成本</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(formatCurrency((sku.costPrice || 0) + (sku.freightCost || 0), sku.currency))}</div></div>
              <div><div class="text-xs text-slate-500">建议售价</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(formatCurrency(sku.suggestedRetailPrice, sku.currency))}</div></div>
              <div><div class="text-xs text-slate-500">计价单位</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.pricingUnit || '-')}</div></div>
              <div><div class="text-xs text-slate-500">重量</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.weightText || '-')}</div></div>
              <div><div class="text-xs text-slate-500">体积</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.volumeText || '-')}</div></div>
              <div class="md:col-span-2"><div class="text-xs text-slate-500">包装信息</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.packagingInfo || '-')}</div></div>
            </div>
          </div>
        </div>
      </div>
      <aside class="space-y-4 rounded-lg border bg-white p-5 shadow-sm">
        <div class="text-sm font-medium text-slate-900">运行状态</div>
        <div class="space-y-3 text-sm text-slate-700">
          <div class="flex items-center justify-between gap-3"><span class="text-slate-500">状态</span><span>${renderStatusBadge(sku.archiveStatus, 'sku')}</span></div>
          <div class="flex items-center justify-between gap-3"><span class="text-slate-500">映射健康</span><span>${renderMappingBadge(sku.mappingHealth)}</span></div>
          <div class="flex items-center justify-between gap-3"><span class="text-slate-500">渠道映射数</span><span>${escapeHtml(sku.channelMappingCount)}</span></div>
          <div class="flex items-center justify-between gap-3"><span class="text-slate-500">最近上架</span><span>${escapeHtml(sku.lastListingAt || '-')}</span></div>
        </div>
      </aside>
    </section>
  `
}

function renderSkuDetailMappings(sku: SkuArchiveRecord): string {
  const rows = buildSkuChannelMappingRows(sku)
    .map(
      (item) => `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.channel)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.store)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.platformSkuId)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.sellerSku)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.platformItemId)}</td>
          <td class="px-4 py-3">${renderBadge(item.status, item.status === '生效中' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : item.status === '待补齐' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-rose-200 bg-rose-50 text-rose-700')}</td>
          <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(formatDateTime(item.effectiveFrom))}</td>
          <td class="px-4 py-3 text-right">
            <button type="button" class="inline-flex h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs text-slate-600 hover:bg-slate-50" data-pcs-product-archive-action="end-sku-mapping" data-sku-id="${escapeHtml(sku.skuId)}">结束映射</button>
          </td>
        </tr>
      `,
    )
    .join('')
  return `
    <section class="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div class="border-b border-slate-200 px-4 py-3">
        <h2 class="text-sm font-medium text-slate-900">渠道映射</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">渠道</th>
              <th class="px-4 py-3 font-medium">店铺</th>
              <th class="px-4 py-3 font-medium">平台 SKU ID</th>
              <th class="px-4 py-3 font-medium">商家 SKU</th>
              <th class="px-4 py-3 font-medium">平台商品 ID</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 font-medium">生效时间</th>
              <th class="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="8" class="px-4 py-10 text-center text-sm text-slate-500">当前规格尚未形成渠道映射。</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `
}

function renderSkuDetailVariants(sku: SkuArchiveRecord): string {
  const rows = buildSkuChannelMappingRows(sku)
    .map(
      (item) => `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.channel)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.store)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.platformItemId)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.listingTitle)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(`${sku.colorName}-${sku.sizeName}`)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.platformSkuId)}</td>
          <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(item.source)}</td>
        </tr>
      `,
    )
    .join('')
  return `
    <section class="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div class="border-b border-slate-200 px-4 py-3">
        <h2 class="text-sm font-medium text-slate-900">渠道变体</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">渠道</th>
              <th class="px-4 py-3 font-medium">店铺</th>
              <th class="px-4 py-3 font-medium">渠道店铺商品 ID</th>
              <th class="px-4 py-3 font-medium">渠道店铺商品名称</th>
              <th class="px-4 py-3 font-medium">变体名称</th>
              <th class="px-4 py-3 font-medium">平台变体 ID</th>
              <th class="px-4 py-3 font-medium">关联链路</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-slate-500">当前规格尚未形成渠道变体。</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `
}

function renderSkuDetailCodeMappings(sku: SkuArchiveRecord): string {
  const rows = [
    {
      type: '老系统 SKU',
      system: sku.legacySystem || 'ERP-A',
      code: sku.legacyCode || '-',
      status: '生效中',
      effective: sku.createdAt,
      owner: sku.createdBy,
    },
    {
      type: '条码',
      system: '商品中心',
      code: sku.barcode || '-',
      status: sku.barcode ? '已绑定' : '待补齐',
      effective: sku.updatedAt,
      owner: sku.updatedBy,
    },
  ]
    .map(
      (item) => `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.type)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.system)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.code)}</td>
          <td class="px-4 py-3">${renderBadge(item.status, item.status === '待补齐' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700')}</td>
          <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(formatDateTime(item.effective))}</td>
          <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(item.owner)}</td>
        </tr>
      `,
    )
    .join('')
  return `
    <section class="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div class="border-b border-slate-200 px-4 py-3">
        <h2 class="text-sm font-medium text-slate-900">外部编码</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">类型</th>
              <th class="px-4 py-3 font-medium">系统</th>
              <th class="px-4 py-3 font-medium">编码</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 font-medium">生效时间</th>
              <th class="px-4 py-3 font-medium">维护人</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>
  `
}

function renderSkuDetailLogs(sku: SkuArchiveRecord): string {
  const logs = [
    { time: sku.createdAt, title: '建立规格档案', detail: `${sku.createdBy} 创建规格 ${sku.skuCode}` },
    { time: sku.updatedAt, title: '更新规格主档', detail: `${sku.updatedBy} 更新状态、映射或条码信息` },
    { time: sku.lastListingAt || sku.updatedAt, title: '最近上架同步', detail: sku.lastListingAt ? `最近上架时间 ${sku.lastListingAt}` : '当前未发生上架同步' },
  ]
  return `
    <section class="rounded-lg border bg-white p-5 shadow-sm">
      <div class="space-y-4">
        ${logs
          .map(
            (item) => `
              <div class="border-l-2 border-slate-200 pl-4">
                <div class="text-xs text-slate-500">${escapeHtml(formatDateTime(item.time))}</div>
                <div class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(item.title)}</div>
                <div class="mt-1 text-sm text-slate-600">${escapeHtml(item.detail)}</div>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderSkuDetailPage(skuId: string): string {
  ensurePageDataReady()
  if (state.skuDetail.skuId !== skuId) {
    state.skuDetail.skuId = skuId
    state.skuDetail.activeTab = 'overview'
  }

  const sku = getSkuArchiveById(skuId)
  if (!sku) {
    return `
      <div class="space-y-5 p-4">
        <section class="rounded-lg border bg-white p-4 text-center shadow-sm">
          <h1 class="text-xl font-semibold text-slate-900">未找到规格档案</h1>
          <p class="mt-2 text-sm text-slate-500">请返回规格档案列表重新选择。</p>
          <button type="button" class="mt-4 inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/products/specifications">返回列表</button>
        </section>
      </div>
    `
  }

  const tabButtons = SKU_DETAIL_TABS.map(
    (tab) => `
      <button type="button" class="${escapeHtml(toClassName('inline-flex h-9 items-center rounded-md px-3 text-sm', state.skuDetail.activeTab === tab.key ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'))}" data-pcs-product-archive-action="set-sku-detail-tab" data-value="${escapeHtml(tab.key)}">${escapeHtml(tab.label)}</button>
    `,
  ).join('')

  const tabContent =
    state.skuDetail.activeTab === 'overview'
      ? renderSkuDetailOverview(sku)
      : state.skuDetail.activeTab === 'channelMappings'
        ? renderSkuDetailMappings(sku)
        : state.skuDetail.activeTab === 'channelVariants'
          ? renderSkuDetailVariants(sku)
          : state.skuDetail.activeTab === 'codeMappings'
            ? renderSkuDetailCodeMappings(sku)
            : renderSkuDetailLogs(sku)

  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      <section class="flex flex-wrap items-center justify-between gap-4">
        <div class="flex items-start gap-4">
          <button type="button" class="inline-flex h-9 items-center gap-1 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-nav="/pcs/products/specifications">
            <i data-lucide="arrow-left" class="h-4 w-4"></i>返回列表
          </button>
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-2xl font-semibold text-slate-900">${escapeHtml(sku.skuCode)}</h1>
              ${renderStatusBadge(sku.archiveStatus, 'sku')}
              ${renderMappingBadge(sku.mappingHealth)}
            </div>
            <p class="mt-1 text-sm text-slate-500">${escapeHtml(sku.styleCode)} · ${escapeHtml(sku.styleName)} · ${escapeHtml(`${sku.colorName}/${sku.sizeName}`)}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="copy-sku-code" data-sku-id="${escapeHtml(sku.skuId)}">
            <i data-lucide="copy" class="h-4 w-4"></i>复制编码
          </button>
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="push-sku-listing" data-sku-id="${escapeHtml(sku.skuId)}">
            <i data-lucide="send" class="h-4 w-4"></i>推送上架
          </button>
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md ${sku.archiveStatus === 'ACTIVE' ? 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50' : 'bg-slate-900 text-white hover:bg-slate-800'} px-3 text-sm" data-pcs-product-archive-action="toggle-sku-status" data-sku-id="${escapeHtml(sku.skuId)}">
            <i data-lucide="power" class="h-4 w-4"></i>${sku.archiveStatus === 'ACTIVE' ? '停用' : '启用'}
          </button>
        </div>
      </section>
      <section class="rounded-lg border bg-white p-2 shadow-sm">
        <div class="flex flex-wrap gap-2">${tabButtons}</div>
      </section>
      ${tabContent}
      ${renderSkuCreateDrawer()}
    </div>
  `
}

function renderSkuStyleLink(sku: SkuArchiveRecord): string {
  return `<button type="button" class="text-left text-sm font-medium text-slate-900 hover:text-slate-700" data-nav="/pcs/products/styles/${escapeHtml(sku.styleId)}">${escapeHtml(sku.styleCode)}</button>`
}

function renderPcsStyleListPage(): string {
  const items = getFilteredStyleItems()
  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderStyleHeader()}
      ${renderStyleStats()}
      ${renderStyleFilters(items.length)}
      ${renderStyleTable(items)}
      ${renderSkuCreateDrawer()}
      ${renderStyleCompletionDrawer()}
      ${renderImagePreviewModal()}
    </div>
  `
}

function renderPcsSkuListPage(): string {
  const items = getFilteredSkuItems()
  return `
    <div class="space-y-5 p-4">
      ${renderNotice()}
      ${renderSkuHeader()}
      ${renderSkuStats()}
      ${renderSkuFilters(items.length)}
      ${renderSkuTable(items)}
      ${renderSkuCreateDrawer()}
      ${renderImagePreviewModal()}
    </div>
  `
}

export function renderPcsStyleArchiveListPage(): string {
  return renderPcsStyleListPage()
}

export function renderPcsStyleArchiveDetailPage(styleId: string): string {
  return renderStyleDetailPage(styleId)
}

export function renderPcsSpecificationListPage(): string {
  return renderPcsSkuListPage()
}

export function renderPcsSpecificationDetailPage(skuId: string): string {
  return renderSkuDetailPage(skuId)
}

function buildSkuRecord(input: {
  style: StyleArchiveShellRecord
  color: string
  size: string
  print: string
  barcode: string
  skuCode: string
  legacySystem?: string
  legacyCode?: string
  mappingHealth?: SkuArchiveMappingHealth
}): SkuArchiveRecord {
  const identity = buildSkuIdentity()
  const latestVersion = resolveLatestVersionMeta(input.style.styleId)
  const fixture = buildSkuFixture(input.style.styleCode, input.style.styleName, input.color, input.size)
  const styleChannelCount = listStyleChannelProducts(input.style).length || input.style.channelProductCount || 0
  return {
    skuId: identity.skuId,
    skuCode: input.skuCode,
    styleId: input.style.styleId,
    styleCode: input.style.styleCode,
    styleName: input.style.styleName,
    skuName: fixture.skuName,
    skuNameEn: fixture.skuNameEn,
    colorName: input.color,
    sizeName: input.size,
    printName: input.print.trim() || '基础款',
    barcode: input.barcode.trim() || `69${identity.timestamp.replace(/\D/g, '').slice(-11)}`.slice(0, 13),
    channelTitle: fixture.channelTitle,
    skuImageUrl: fixture.skuImageUrl,
    archiveStatus: 'ACTIVE',
    mappingHealth: input.mappingHealth || (styleChannelCount > 0 ? 'OK' : 'MISSING'),
    channelMappingCount: Math.max(0, styleChannelCount),
    listedChannelCount: 0,
    techPackVersionId: input.style.currentTechPackVersionId || latestVersion.versionId,
    techPackVersionCode: input.style.currentTechPackVersionCode || latestVersion.versionCode,
    techPackVersionLabel: input.style.currentTechPackVersionLabel || latestVersion.versionLabel,
    legacySystem: input.legacySystem || '',
    legacyCode: input.legacyCode || '',
    costPrice: fixture.costPrice,
    freightCost: fixture.freightCost,
    suggestedRetailPrice: fixture.suggestedRetailPrice,
    currency: fixture.currency,
    pricingUnit: fixture.pricingUnit,
    weightKg: fixture.weightKg,
    lengthCm: fixture.lengthCm,
    widthCm: fixture.widthCm,
    heightCm: fixture.heightCm,
    packagingInfo: fixture.packagingInfo,
    weightText: `${fixture.weightKg}kg`,
    volumeText: `${fixture.lengthCm}*${fixture.widthCm}*${fixture.heightCm}cm`,
    lastListingAt: '',
    createdAt: identity.timestamp,
    createdBy: '系统演示',
    updatedAt: identity.timestamp,
    updatedBy: '系统演示',
    remark: '',
  }
}

function submitSkuCreate(): void {
  const style = state.skuCreate.styleId ? getStyleArchiveById(state.skuCreate.styleId) : null
  if (!style) {
    state.notice = '请先选择所属款式档案。'
    return
  }

  if (state.skuCreate.mode === 'import') {
    if (!state.skuCreate.legacySystem.trim() || !state.skuCreate.legacyCode.trim() || !state.skuCreate.manualCode.trim()) {
      state.notice = '请补齐老系统、老系统编码和正式规格编码。'
      return
    }
  }

  const skuCode =
    state.skuCreate.mode === 'import'
      ? state.skuCreate.manualCode.trim()
      : state.skuCreate.codeStrategy === 'manual'
        ? state.skuCreate.manualCode.trim()
        : buildAutoSkuCode(style.styleCode, state.skuCreate.color, state.skuCreate.size, state.skuCreate.print)

  if (!skuCode) {
    state.notice = '请补齐规格编码。'
    return
  }

  try {
    const created = createSkuArchive(
      buildSkuRecord({
        style,
        color: state.skuCreate.color,
        size: state.skuCreate.size,
        print: state.skuCreate.print,
        barcode: state.skuCreate.barcode,
        skuCode,
        legacySystem: state.skuCreate.mode === 'import' ? state.skuCreate.legacySystem : '',
        legacyCode: state.skuCreate.mode === 'import' ? state.skuCreate.legacyCode : '',
        mappingHealth: state.skuCreate.mode === 'import' ? 'OK' : undefined,
      }),
    )
    resetSkuCreateState()
    state.notice = `已创建规格档案 ${created.skuCode}。`
  } catch (error) {
    state.notice = error instanceof Error ? error.message : '创建规格档案失败。'
  }
}

function submitSkuBatchCreate(): void {
  const style = state.skuCreate.styleId ? getStyleArchiveById(state.skuCreate.styleId) : null
  if (!style) {
    state.notice = '请先选择所属款式档案。'
    return
  }
  if (state.skuCreate.batchColors.length === 0 || state.skuCreate.batchSizes.length === 0) {
    state.notice = '请至少选择一个颜色和一个尺码。'
    return
  }

  const records = state.skuCreate.batchColors.flatMap((color) =>
    state.skuCreate.batchSizes
      .map((size) => {
        const skuCode = buildAutoSkuCode(style.styleCode, color, size, state.skuCreate.batchPrint)
        if (findSkuArchiveByCode(skuCode)) return null
        return buildSkuRecord({
          style,
          color,
          size,
          print: state.skuCreate.batchPrint,
          barcode: '',
          skuCode,
        })
      })
      .filter(Boolean) as SkuArchiveRecord[],
  )

  if (records.length === 0) {
    state.notice = '当前颜色 / 尺码矩阵对应的规格已全部存在。'
    return
  }

  createSkuArchiveBatch(records)
  resetSkuCreateState()
  state.notice = `已批量生成 ${records.length} 条规格档案。`
}

function resolveClosestNode(target: unknown, selector: string): HTMLElement | null {
  if (!target || typeof target !== 'object') return null
  const maybe = target as { closest?: (selector: string) => HTMLElement | null }
  if (typeof maybe.closest === 'function') {
    return maybe.closest(selector)
  }
  if ('dataset' in maybe) return maybe as HTMLElement
  return null
}

function resolveFieldValue(target: Element): { value: string; checked: boolean } {
  const input = target as HTMLInputElement & HTMLSelectElement
  return {
    value: 'value' in input ? input.value : '',
    checked: 'checked' in input ? Boolean(input.checked) : false,
  }
}

function toggleBatchValue(list: string[], value: string, checked: boolean): string[] {
  if (checked) {
    return list.includes(value) ? list : [...list, value]
  }
  return list.filter((item) => item !== value)
}

function handleStyleImageUpload(target: HTMLElement): boolean {
  const input = target as HTMLInputElement
  const files = Array.from(input.files || []).filter((item) => item.type.startsWith('image/'))
  if (files.length === 0) return false
  const uploadedUrls = files.map((item) => URL.createObjectURL(item))
  const nextImageUrls = uniqueImageUrls([...getStyleCompletionImageUrls(), ...uploadedUrls])
  state.styleCompletion.mainImageUrl = nextImageUrls[0] || ''
  state.styleCompletion.galleryImageUrls = nextImageUrls
  input.value = ''
  state.notice = `已添加 ${uploadedUrls.length} 张款式主图，请保存资料后生效。`
  return true
}

export function handlePcsProductArchiveInput(target: Element): boolean {
  const fieldNode = resolveClosestNode(target, '[data-pcs-product-archive-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsProductArchiveField
  if (!field) return false

  if (field === 'style-completion-main-images') {
    return handleStyleImageUpload(fieldNode)
  }

  const { value, checked } = resolveFieldValue(fieldNode)

  switch (field) {
    case 'style-list-search':
      state.styleList.search = value
      return true
    case 'style-list-status':
      state.styleList.status = (value || 'all') as ProductArchivePageState['styleList']['status']
      return true
    case 'style-list-version':
      state.styleList.version = (value || 'all') as StyleVersionFilter
      return true
    case 'style-list-mapping':
      state.styleList.mapping = (value || 'all') as ProductArchivePageState['styleList']['mapping']
      return true
    case 'sku-list-search':
      state.skuList.search = value
      return true
    case 'sku-list-status':
      state.skuList.status = (value || 'all') as ProductArchivePageState['skuList']['status']
      return true
    case 'sku-list-mapping':
      state.skuList.mapping = (value || 'all') as ProductArchivePageState['skuList']['mapping']
      return true
    case 'sku-list-style-id':
      state.skuList.styleId = value
      return true
    case 'sku-create-style-id':
      state.skuCreate.styleId = value
      return true
    case 'sku-create-color':
      state.skuCreate.color = value
      return true
    case 'sku-create-size':
      state.skuCreate.size = value
      return true
    case 'sku-create-print':
      state.skuCreate.print = value
      return true
    case 'sku-create-barcode':
      state.skuCreate.barcode = value
      return true
    case 'sku-create-manual-code':
      state.skuCreate.manualCode = value
      return true
    case 'sku-create-legacy-system':
      state.skuCreate.legacySystem = value
      return true
    case 'sku-create-legacy-code':
      state.skuCreate.legacyCode = value
      return true
    case 'sku-create-batch-print':
      state.skuCreate.batchPrint = value
      return true
    case 'sku-create-code-strategy-auto':
      state.skuCreate.codeStrategy = checked ? 'auto' : state.skuCreate.codeStrategy
      return true
    case 'sku-create-code-strategy-manual':
      state.skuCreate.codeStrategy = checked ? 'manual' : state.skuCreate.codeStrategy
      return true
    case 'sku-create-batch-color':
      state.skuCreate.batchColors = toggleBatchValue(state.skuCreate.batchColors, fieldNode.dataset.value || value, checked)
      return true
    case 'sku-create-batch-size':
      state.skuCreate.batchSizes = toggleBatchValue(state.skuCreate.batchSizes, fieldNode.dataset.value || value, checked)
      return true
    case 'style-completion-style-name':
      state.styleCompletion.styleName = value
      return true
    case 'style-completion-style-number':
      state.styleCompletion.styleNumber = value
      return true
    case 'style-completion-style-type':
      state.styleCompletion.styleType = value
      return true
    case 'style-completion-category-name':
      state.styleCompletion.categoryName = value
      return true
    case 'style-completion-sub-category-name':
      state.styleCompletion.subCategoryName = value
      return true
    case 'style-completion-brand-name':
      state.styleCompletion.brandName = value
      return true
    case 'style-completion-year-tag':
      state.styleCompletion.yearTag = value
      return true
    case 'style-completion-season-tags':
      state.styleCompletion.seasonTags = value
      return true
    case 'style-completion-style-tags':
      state.styleCompletion.styleTags = value
      return true
    case 'style-completion-target-audience-tags':
      state.styleCompletion.targetAudienceTags = value
      return true
    case 'style-completion-target-channel-codes':
      state.styleCompletion.targetChannelCodes = value
      return true
    case 'style-completion-price-range-label':
      state.styleCompletion.priceRangeLabel = value
      return true
    case 'style-completion-selling-point-text':
      state.styleCompletion.sellingPointText = value
      return true
    case 'style-completion-detail-description':
      state.styleCompletion.detailDescription = value
      return true
    case 'style-completion-packaging-info':
      state.styleCompletion.packagingInfo = value
      return true
    case 'style-completion-remark':
      state.styleCompletion.remark = value
      return true
    default:
      return false
  }
}

export function handlePcsProductArchiveEvent(target: HTMLElement): boolean {
  const actionNode = resolveClosestNode(target, '[data-pcs-product-archive-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.pcsProductArchiveAction
  if (!action) return false

  switch (action) {
    case 'close-notice':
      state.notice = null
      return true
    case 'close-drawers':
      resetSkuCreateState()
      resetStyleCompletionState()
      return true
    case 'open-image-preview':
      state.imagePreview = {
        open: true,
        url: actionNode.dataset.url || '',
        title: actionNode.dataset.title || '款式主图预览',
      }
      return true
    case 'close-image-preview':
      resetImagePreviewState()
      return true
    case 'set-style-main-image': {
      const url = actionNode.dataset.url || ''
      if (!url) return true
      const nextImageUrls = uniqueImageUrls([url, ...getStyleCompletionImageUrls().filter((item) => item !== url)])
      state.styleCompletion.mainImageUrl = nextImageUrls[0] || ''
      state.styleCompletion.galleryImageUrls = nextImageUrls
      return true
    }
    case 'remove-style-image': {
      const url = actionNode.dataset.url || ''
      if (!url) return true
      const nextImageUrls = getStyleCompletionImageUrls().filter((item) => item !== url)
      state.styleCompletion.mainImageUrl = nextImageUrls[0] || ''
      state.styleCompletion.galleryImageUrls = nextImageUrls
      return true
    }
    case 'open-style-completion': {
      const styleId = actionNode.dataset.styleId || state.styleDetail.styleId || ''
      const style = styleId ? getStyleArchiveById(styleId) : null
      if (!style) {
        state.notice = '未找到对应款式档案。'
        return true
      }
      openStyleCompletionDrawer(style)
      return true
    }
    case 'submit-style-completion':
      submitStyleCompletion()
      return true
    case 'formalize-style-archive': {
      const styleId = actionNode.dataset.styleId || state.styleDetail.styleId || ''
      const result = formalizeStyleArchive(styleId, '当前用户')
      state.notice = result.message
      return true
    }
    case 'activate-tech-pack-version': {
      const styleId = actionNode.dataset.styleId || state.styleDetail.styleId || ''
      const technicalVersionId = actionNode.dataset.versionId || ''
      if (!styleId || !technicalVersionId) {
        state.notice = '未找到需要启用的技术包版本。'
        return true
      }
      try {
        activateTechPackVersionForStyle(styleId, technicalVersionId, '当前用户')
        state.notice = '已启用当前生效技术包版本。'
      } catch (error) {
        state.notice = error instanceof Error ? error.message : '启用当前生效技术包版本失败。'
      }
      return true
    }
    case 'open-sku-create':
      resetSkuCreateState()
      state.skuCreate.open = true
      state.skuCreate.mode = (actionNode.dataset.mode as SkuCreateMode) || 'single'
      state.skuCreate.styleId = actionNode.dataset.styleId || state.skuCreate.styleId
      return true
    case 'submit-sku-create':
      submitSkuCreate()
      return true
    case 'submit-sku-batch-create':
      submitSkuBatchCreate()
      return true
    case 'style-quick-filter': {
      const filter = actionNode.dataset.filter || 'reset'
      if (filter === 'reset') {
        state.styleList.status = 'all'
        state.styleList.version = 'all'
        state.styleList.mapping = 'all'
      } else if (filter === 'status') {
        state.styleList.status = (actionNode.dataset.value || 'all') as ProductArchivePageState['styleList']['status']
      } else if (filter === 'version') {
        state.styleList.version = (actionNode.dataset.value || 'all') as StyleVersionFilter
      } else if (filter === 'mapping') {
        state.styleList.mapping = (actionNode.dataset.value || 'all') as ProductArchivePageState['styleList']['mapping']
      }
      return true
    }
    case 'sku-quick-filter': {
      const filter = actionNode.dataset.filter || 'reset'
      if (filter === 'reset') {
        state.skuList.status = 'all'
        state.skuList.mapping = 'all'
      } else if (filter === 'status') {
        state.skuList.status = (actionNode.dataset.value || 'all') as ProductArchivePageState['skuList']['status']
      } else if (filter === 'mapping') {
        state.skuList.mapping = (actionNode.dataset.value || 'all') as ProductArchivePageState['skuList']['mapping']
      }
      return true
    }
    case 'toggle-style-status': {
      const styleId = actionNode.dataset.styleId || ''
      const style = styleId ? getStyleArchiveById(styleId) : null
      if (!style) {
        state.notice = '未找到对应款式档案。'
        return true
      }
      const nextStatus = style.archiveStatus === 'ARCHIVED' ? (style.currentTechPackVersionId ? 'ACTIVE' : 'DRAFT') : 'ARCHIVED'
      const restored = updateStyleArchive(style.styleId, {
        archiveStatus: nextStatus,
        updatedAt: nowText(),
        updatedBy: '系统演示',
      })
      const restoredStatus = restored ? STYLE_ARCHIVE_STATUS_RULES[resolveStyleArchiveBusinessStatus(restored)].label : '待完善'
      state.notice = nextStatus === 'ARCHIVED' ? `已归档 ${style.styleCode}。` : `已恢复 ${style.styleCode}，当前状态为${restoredStatus}。`
      return true
    }
    case 'toggle-sku-status': {
      const skuId = actionNode.dataset.skuId || ''
      const sku = skuId ? getSkuArchiveById(skuId) : null
      if (!sku) {
        state.notice = '未找到对应规格档案。'
        return true
      }
      const nextStatus: SkuArchiveStatusCode = sku.archiveStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      updateSkuArchive(sku.skuId, {
        archiveStatus: nextStatus,
        updatedAt: nowText(),
        updatedBy: '系统演示',
      })
      state.notice = nextStatus === 'ACTIVE' ? `已启用 ${sku.skuCode}。` : `已停用 ${sku.skuCode}。`
      return true
    }
    case 'set-style-detail-tab':
      state.styleDetail.activeTab = (actionNode.dataset.value as StyleDetailTabKey) || 'overview'
      return true
    case 'set-sku-detail-tab':
      state.skuDetail.activeTab = (actionNode.dataset.value as SkuDetailTabKey) || 'overview'
      return true
    case 'end-sku-mapping': {
      const skuId = actionNode.dataset.skuId || ''
      const sku = skuId ? getSkuArchiveById(skuId) : null
      if (!sku) {
        state.notice = '未找到对应规格档案。'
        return true
      }
      updateSkuArchive(sku.skuId, {
        mappingHealth: 'MISSING',
        listedChannelCount: 0,
        updatedAt: nowText(),
        updatedBy: '系统演示',
      })
      state.notice = `已结束 ${sku.skuCode} 的当前渠道映射。`
      return true
    }
    case 'copy-sku-code': {
      const sku = actionNode.dataset.skuId ? getSkuArchiveById(actionNode.dataset.skuId) : null
      state.notice = sku ? `已复制规格编码：${sku.skuCode}` : '未找到规格编码。'
      return true
    }
    case 'push-sku-listing': {
      const sku = actionNode.dataset.skuId ? getSkuArchiveById(actionNode.dataset.skuId) : null
      state.notice = sku ? `已发起 ${sku.skuCode} 的上架推送。` : '未找到对应规格档案。'
      return true
    }
    default:
      return false
  }
}

export function isPcsProductArchiveDialogOpen(): boolean {
  return state.skuCreate.open || state.styleCompletion.open || state.imagePreview.open
}
