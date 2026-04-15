import { appStore } from '../state/store.ts'
import { escapeHtml, formatDateTime, toClassName } from '../utils.ts'
import { ensurePcsProjectDemoDataReady } from '../data/pcs-project-demo-seed-service.ts'
import {
  bindStyleArchiveToProjectChannelProduct,
  findProjectChannelProductByStyleId,
  listProjectChannelProducts,
} from '../data/pcs-channel-product-project-repository.ts'
import { createStyleArchiveShell, getStyleArchiveById, listStyleArchives, updateStyleArchive } from '../data/pcs-style-archive-repository.ts'
import type { StyleArchiveShellRecord, StyleArchiveStatusCode } from '../data/pcs-style-archive-types.ts'
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
import {
  createTechnicalDataVersionDraft,
  getNextStyleVersionMeta,
  getNextTechnicalVersionIdentity,
  listTechnicalDataVersionsByStyleId,
} from '../data/pcs-technical-data-version-repository.ts'
import {
  listProjectWorkspaceCategories,
  listProjectWorkspaceColors,
  listProjectWorkspaceSizes,
  listProjectWorkspaceStyles,
} from '../data/pcs-project-config-workspace-adapter.ts'
import { getProjectById, getProjectNodeRecordByWorkItemTypeCode, listProjects, updateProjectRecord } from '../data/pcs-project-repository.ts'
import type { PcsProjectRecord } from '../data/pcs-project-types.ts'

type StyleVersionFilter = 'all' | 'has' | 'none'
type StyleDetailTabKey = 'overview' | 'versions' | 'specifications' | 'mappings' | 'channels' | 'logs'
type SkuDetailTabKey = 'overview' | 'channelMappings' | 'channelVariants' | 'codeMappings' | 'logs'
type StyleCreateMode = 'new' | 'project' | 'legacy'
type SkuCreateMode = 'single' | 'batch' | 'import'
type SkuCodeStrategy = 'auto' | 'manual'

interface ProductArchivePageState {
  notice: string | null
  styleList: {
    search: string
    status: 'all' | StyleArchiveStatusCode
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
  styleCreate: {
    open: boolean
    mode: StyleCreateMode
    name: string
    category: string
    tags: string
    priceBand: string
    projectId: string
    legacySystem: string
    legacyCode: string
    createVersion: boolean
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
}

interface StyleArchiveListItemViewModel {
  style: StyleArchiveShellRecord
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
  { key: 'channels', label: '渠道商品' },
  { key: 'logs', label: '日志' },
]

const SKU_DETAIL_TABS: Array<{ key: SkuDetailTabKey; label: string }> = [
  { key: 'overview', label: '概览' },
  { key: 'channelMappings', label: '渠道映射' },
  { key: 'channelVariants', label: '渠道变体' },
  { key: 'codeMappings', label: '外部编码' },
  { key: 'logs', label: '日志' },
]

const STYLE_STATUS_META: Record<StyleArchiveStatusCode, { label: string; className: string }> = {
  DRAFT: { label: '草稿', className: 'border-amber-200 bg-amber-50 text-amber-700' },
  ACTIVE: { label: '启用', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' },
  ARCHIVED: { label: '已归档', className: 'border-slate-200 bg-slate-100 text-slate-600' },
}

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

const FALLBACK_CATEGORY_OPTIONS = ['上衣', '连衣裙', '半裙', '裤子', '套装', '外套']
const PRICE_RANGE_OPTIONS = ['¥159-299', '¥199-399', '¥299-499', '¥399-699']
const LEGACY_SYSTEM_OPTIONS = ['ERP-A', 'ERP-B', 'OMS-旧档', '外部表格导入']
const FALLBACK_SKU_COLOR_OPTIONS = ['Black', 'White', 'Red', 'Blue', 'Green', 'Khaki']
const FALLBACK_SKU_SIZE_OPTIONS = ['S', 'M', 'L', 'XL', 'One Size']

function listConfiguredCategoryOptions(): string[] {
  const options = listProjectWorkspaceCategories()
    .map((item) => item.name.trim())
    .filter(Boolean)
  return options.length > 0 ? options : FALLBACK_CATEGORY_OPTIONS
}

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

function listConfiguredStyleTags(): string[] {
  const options = listProjectWorkspaceStyles()
    .map((item) => item.name.trim())
    .filter(Boolean)
  return options.length > 0 ? options : ['休闲']
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
  styleCreate: {
    open: false,
    mode: 'new',
    name: '',
    category: '',
    tags: '',
    priceBand: '',
    projectId: '',
    legacySystem: '',
    legacyCode: '',
    createVersion: true,
  },
  skuCreate: createDefaultSkuCreateState(),
}

function resetStyleCreateState(): void {
  state.styleCreate = {
    open: false,
    mode: 'new',
    name: '',
    category: '',
    tags: '',
    priceBand: '',
    projectId: '',
    legacySystem: '',
    legacyCode: '',
    createVersion: true,
  }
}

function resetSkuCreateState(): void {
  state.skuCreate = createDefaultSkuCreateState()
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
  resetStyleCreateState()
  resetSkuCreateState()
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

function resolveTags(input: string): string[] {
  return input
    .split(/[，,、/]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function buildStyleIdentity(): { styleId: string; styleCode: string; timestamp: string } {
  const timestamp = nowText()
  const dateKey = timestamp.slice(0, 10).replace(/-/g, '')
  const sequence = listStyleArchives().filter((item) => item.generatedAt.startsWith(timestamp.slice(0, 10))).length + 1
  return {
    styleId: `style_${dateKey}_${String(sequence).padStart(3, '0')}`,
    styleCode: `SPU-${dateKey}-${String(sequence).padStart(3, '0')}`,
    timestamp,
  }
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

function buildStyleListItems(): StyleArchiveListItemViewModel[] {
  ensurePageDataReady()
  const channelProducts = listProjectChannelProducts()
  return listStyleArchives().map((style) => {
    const skus = listSkuArchivesByStyleId(style.styleId)
    const versions = buildTechnicalVersionListByStyle(style.styleId)
    const currentVersion = versions.find((item) => item.isCurrentTechPackVersion) || versions[0] || null
    const styleChannels = channelProducts.filter((item) => item.styleId === style.styleId && item.channelProductStatus !== '已作废')
    return {
      style,
      skuCount: skus.length,
      mappingHealth: resolveStyleMappingHealth(skus),
      currentVersionText: currentVersion ? `${currentVersion.versionLabel}` : '无生效版本',
      currentVersionMetaText: currentVersion?.publishedAt ? `生效于 ${currentVersion.publishedAt.slice(0, 10)}` : '待建立技术包版本',
      channelCount: styleChannels.length || style.channelProductCount,
      onSaleCount: skus.filter((item) => item.listedChannelCount > 0).length,
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

    if (state.styleList.status !== 'all' && item.style.archiveStatus !== state.styleList.status) return false
    if (state.styleList.version === 'has' && item.currentVersionText === '无生效版本') return false
    if (state.styleList.version === 'none' && item.currentVersionText !== '无生效版本') return false
    if (state.styleList.mapping !== 'all' && item.mappingHealth !== state.styleList.mapping) return false

    return true
  })
}

function getStyleStats() {
  const items = buildStyleListItems()
  return {
    total: items.length,
    active: items.filter((item) => item.style.archiveStatus === 'ACTIVE').length,
    hasVersion: items.filter((item) => item.currentVersionText !== '无生效版本').length,
    noVersion: items.filter((item) => item.currentVersionText === '无生效版本').length,
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

function renderStatusBadge(status: StyleArchiveStatusCode | SkuArchiveStatusCode, type: 'style' | 'sku'): string {
  const meta = type === 'style' ? STYLE_STATUS_META[status as StyleArchiveStatusCode] : SKU_STATUS_META[status as SkuArchiveStatusCode]
  return renderBadge(meta.label, meta.className)
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

function renderStyleHeader(): string {
  return `
    <section class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <p class="text-xs text-slate-500">商品中心 / 商品档案</p>
        <h1 class="mt-1 text-2xl font-semibold text-slate-900">款式档案</h1>
        <p class="mt-1 text-sm text-slate-500">对应参照对象的商品档案 - SPU，管理正式款式主档、技术包版本、规格档案与编码映射。</p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md bg-slate-900 px-4 text-sm text-white hover:bg-slate-800" data-pcs-product-archive-action="open-style-create" data-mode="new">
          <i data-lucide="plus" class="h-4 w-4"></i>新建款式档案
        </button>
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="open-style-create" data-mode="project">
          <i data-lucide="folder-kanban" class="h-4 w-4"></i>从项目生成
        </button>
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="open-style-create" data-mode="legacy">
          <i data-lucide="link" class="h-4 w-4"></i>建立老系统映射
        </button>
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="sync-style-mapping">
          <i data-lucide="refresh-cw" class="h-4 w-4"></i>同步映射
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
      ${renderMetricButton('启用中', stats.active, '当前可承接生产与上游同步', 'style-quick-filter', 'data-filter="status" data-value="ACTIVE"')}
      ${renderMetricButton('有生效版本', stats.hasVersion, '已存在当前生效技术包版本', 'style-quick-filter', 'data-filter="version" data-value="has"')}
      ${renderMetricButton('无生效版本', stats.noVersion, '待建立或启用技术包版本', 'style-quick-filter', 'data-filter="version" data-value="none"')}
      ${renderMetricButton('映射健康', stats.mappingOK, '款式下规格映射正常', 'style-quick-filter', 'data-filter="mapping" data-value="OK"')}
      ${renderMetricButton('映射冲突', stats.mappingConflict, '存在规格映射冲突待处理', 'style-quick-filter', 'data-filter="mapping" data-value="CONFLICT"')}
    </section>
  `
}

function renderStyleFilters(total: number): string {
  return `
    <section class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="flex flex-wrap items-center gap-3">
        <div class="min-w-[240px] flex-1">${renderTextInput('style-list-search', state.styleList.search, '搜索款式编码/名称/款号/老系统编码...')}</div>
        <div class="w-full sm:w-40">${renderSelect('style-list-status', state.styleList.status === 'all' ? '' : state.styleList.status, [{ value: 'DRAFT', label: '草稿' }, { value: 'ACTIVE', label: '启用' }, { value: 'ARCHIVED', label: '已归档' }], '全部状态')}</div>
        <div class="w-full sm:w-40">${renderSelect('style-list-version', state.styleList.version === 'all' ? '' : state.styleList.version, [{ value: 'has', label: '有生效版本' }, { value: 'none', label: '无生效版本' }], '生效版本')}</div>
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
            <button type="button" class="text-left text-sm font-medium text-slate-900 hover:text-slate-700" data-nav="/pcs/products/styles/${escapeHtml(item.style.styleId)}">
              ${escapeHtml(item.style.styleCode)}
            </button>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.legacyMappingText)}</div>
          </td>
          <td class="px-4 py-3">
            <div class="text-sm font-medium text-slate-900">${escapeHtml(item.style.styleName)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.originProjectText)}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.style.categoryName || item.style.subCategoryName || '-')}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.style.styleTags.join(' / ') || '-')}</td>
          <td class="px-4 py-3">
            <div class="text-sm font-medium text-slate-900">${escapeHtml(item.currentVersionText)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.currentVersionMetaText)}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.skuCount)}</td>
          <td class="px-4 py-3">${renderMappingBadge(item.mappingHealth)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.channelCount)} / 在售 ${escapeHtml(item.onSaleCount)}</td>
          <td class="px-4 py-3">${renderStatusBadge(item.style.archiveStatus, 'style')}</td>
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
        <button type="button" class="inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-4 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="sync-sku-mapping">
          <i data-lucide="refresh-cw" class="h-4 w-4"></i>同步映射
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
            <button type="button" class="text-left text-sm font-medium text-slate-900 hover:text-slate-700" data-nav="/pcs/products/specifications/${escapeHtml(item.skuId)}">${escapeHtml(item.skuCode)}</button>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.barcode || '-')}</div>
          </td>
          <td class="px-4 py-3">
            <button type="button" class="text-left text-sm font-medium text-slate-900 hover:text-slate-700" data-nav="/pcs/products/styles/${escapeHtml(item.styleId)}">${escapeHtml(item.styleCode)}</button>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.styleName)}</div>
          </td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.colorName)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.sizeName)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.printName || '-')}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.techPackVersionLabel || '未关联')}</td>
          <td class="px-4 py-3">${renderMappingBadge(item.mappingHealth)}</td>
          <td class="px-4 py-3 text-sm text-slate-700">${escapeHtml(item.channelMappingCount)}</td>
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
              <th class="px-4 py-3 font-medium">映射健康</th>
              <th class="px-4 py-3 font-medium">渠道映射数</th>
              <th class="px-4 py-3 font-medium">状态</th>
              <th class="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="10" class="px-4 py-10 text-center text-sm text-slate-500">暂无规格档案数据。</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `
}

function renderStyleCreateDrawer(): string {
  if (!state.styleCreate.open) return ''
  const mode = state.styleCreate.mode
  const categoryOptions = listConfiguredCategoryOptions().map((item) => ({ value: item, label: item }))
  const title = mode === 'project' ? '从商品项目生成款式档案' : mode === 'legacy' ? '建立老系统映射' : '新建款式档案'
  const description =
    mode === 'project'
      ? '从已通过测款结论的商品项目生成正式款式档案，并可同步创建技术包草稿。'
      : mode === 'legacy'
        ? '建立与已有业务系统商品档案的映射关系，补齐正式款式主档。'
        : '创建正式款式主档，可选择同步创建技术包版本草稿。'
  const projectOptions = listProjects()
    .filter((item) => item.projectStatus !== '已终止' && item.projectStatus !== '已归档')
    .map((item) => ({ value: item.projectId, label: `${item.projectCode} · ${item.projectName}` }))

  const body = `
    <div class="space-y-5">
      ${
        mode === 'project'
          ? renderFormField('来源商品项目', renderSelect('style-create-project-id', state.styleCreate.projectId, projectOptions, '选择商品项目'), true)
          : ''
      }
      ${renderFormField('款式名称', renderTextInput('style-create-name', state.styleCreate.name, '输入款式名称'), true)}
      ${renderFormField('类目', renderSelect('style-create-category', state.styleCreate.category, categoryOptions, '选择类目'), true, '来源：配置工作台 / 品类')}
      ${renderFormField('风格标签', renderTextInput('style-create-tags', state.styleCreate.tags, '例如：休闲，基础款，度假风'), false, '多个标签可用中文逗号分隔')}
      ${renderFormField('价格带', renderSelect('style-create-price-band', state.styleCreate.priceBand, PRICE_RANGE_OPTIONS.map((item) => ({ value: item, label: item })), '选择价格带'), true)}
      ${
        mode === 'legacy'
          ? `
            <div class="grid gap-4 md:grid-cols-2">
              ${renderFormField('老系统', renderSelect('style-create-legacy-system', state.styleCreate.legacySystem, LEGACY_SYSTEM_OPTIONS.map((item) => ({ value: item, label: item })), '选择来源系统'), true)}
              ${renderFormField('老系统编码', renderTextInput('style-create-legacy-code', state.styleCreate.legacyCode, '输入老系统 SPU 编码'), true)}
            </div>
          `
          : ''
      }
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        ${renderCheckbox('style-create-create-version', state.styleCreate.createVersion, '同时创建技术包版本 V1 草稿')}
        <div class="mt-2 text-xs text-slate-500">创建后会进入款式详情页；如选择来源商品项目，将同步绑定项目主关联。</div>
      </div>
    </div>
  `
  const footer = `
    <button type="button" class="inline-flex h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="close-drawers">取消</button>
    <button type="button" class="inline-flex h-9 items-center rounded-md bg-slate-900 px-3 text-sm text-white hover:bg-slate-800" data-pcs-product-archive-action="submit-style-create">确认创建</button>
  `
  return renderDrawerShell(title, description, body, footer)
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
  const currentChannelProduct = findProjectChannelProductByStyleId(style.styleId)
  return `
    <section class="grid gap-4 xl:grid-cols-[2fr,1fr]">
      <div class="space-y-4 rounded-lg border bg-white p-5 shadow-sm">
        <div class="grid gap-4 md:grid-cols-2">
          <div>
            <div class="text-xs text-slate-500">款式名称</div>
            <div class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(style.styleName)}</div>
          </div>
          <div>
            <div class="text-xs text-slate-500">类目</div>
            <div class="mt-1 text-sm text-slate-700">${escapeHtml(style.categoryName || style.subCategoryName || '-')}</div>
          </div>
          <div>
            <div class="text-xs text-slate-500">风格标签</div>
            <div class="mt-1 text-sm text-slate-700">${escapeHtml(style.styleTags.join(' / ') || '-')}</div>
          </div>
          <div>
            <div class="text-xs text-slate-500">价格带</div>
            <div class="mt-1 text-sm text-slate-700">${escapeHtml(style.priceRangeLabel || '-')}</div>
          </div>
          <div>
            <div class="text-xs text-slate-500">来源项目</div>
            <div class="mt-1 text-sm text-slate-700">${escapeHtml(style.sourceProjectCode ? `${style.sourceProjectCode} · ${style.sourceProjectName}` : '未绑定商品项目')}</div>
          </div>
          <div>
            <div class="text-xs text-slate-500">当前生效技术包</div>
            <div class="mt-1 text-sm text-slate-700">${escapeHtml(style.currentTechPackVersionLabel || '无生效版本')}</div>
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
            <div class="text-xs text-slate-500">渠道商品</div>
            <div class="mt-1 text-lg font-semibold text-slate-900">${escapeHtml(currentChannelProduct?.channelProductCode || '未生成')}</div>
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
          <td class="px-4 py-3 text-sm text-slate-500">${escapeHtml(formatDateTime(item.updatedAt))}</td>
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
              <th class="px-4 py-3 font-medium">更新时间</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6" class="px-4 py-10 text-center text-sm text-slate-500">当前款式尚未建立技术包版本。</td></tr>'}</tbody>
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
          <div><span class="text-slate-500">渠道商品数：</span>${escapeHtml(findProjectChannelProductByStyleId(style.styleId)?.channelProductCode || '未同步')}</div>
          <div><span class="text-slate-500">最近更新：</span>${escapeHtml(formatDateTime(style.updatedAt))}</div>
        </div>
      </div>
    </section>
  `
}

function renderStyleDetailChannels(style: StyleArchiveShellRecord): string {
  const rows = listProjectChannelProducts()
    .filter((item) => item.styleId === style.styleId)
    .map(
      (item) => `
        <tr class="border-t border-slate-100 align-top">
          <td class="px-4 py-3">
            <div class="text-sm font-medium text-slate-900">${escapeHtml(item.channelProductCode)}</div>
            <div class="mt-1 text-xs text-slate-500">${escapeHtml(item.projectCode)}</div>
          </td>
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
        <h2 class="text-sm font-medium text-slate-900">渠道商品</h2>
      </div>
      <div class="overflow-x-auto">
        <table class="min-w-full text-left text-sm">
          <thead class="bg-slate-50 text-slate-500">
            <tr>
              <th class="px-4 py-3 font-medium">渠道商品</th>
              <th class="px-4 py-3 font-medium">渠道</th>
              <th class="px-4 py-3 font-medium">店铺</th>
              <th class="px-4 py-3 font-medium">标题</th>
              <th class="px-4 py-3 font-medium">上游商品编码</th>
              <th class="px-4 py-3 font-medium">状态</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="6" class="px-4 py-10 text-center text-sm text-slate-500">当前款式尚未关联渠道商品。</td></tr>'}</tbody>
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
              ${renderStatusBadge(style.archiveStatus, 'style')}
            </div>
            <p class="mt-1 text-sm text-slate-500">${escapeHtml(style.styleName)} · ${escapeHtml(style.categoryName || style.subCategoryName || '未设置类目')}</p>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="open-sku-create" data-mode="single" data-style-id="${escapeHtml(style.styleId)}">
            <i data-lucide="plus" class="h-4 w-4"></i>新增规格
          </button>
          <button type="button" class="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50" data-pcs-product-archive-action="sync-style-mapping">
            <i data-lucide="refresh-cw" class="h-4 w-4"></i>同步映射
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
      ${renderStyleCreateDrawer()}
      ${renderSkuCreateDrawer()}
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
      <div class="space-y-4 rounded-lg border bg-white p-5 shadow-sm">
        <div class="grid gap-4 md:grid-cols-2">
          <div><div class="text-xs text-slate-500">所属款式</div><div class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(sku.styleCode)} · ${escapeHtml(sku.styleName)}</div></div>
          <div><div class="text-xs text-slate-500">资料版本</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.techPackVersionLabel || '未关联')}</div></div>
          <div><div class="text-xs text-slate-500">颜色</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.colorName)}</div></div>
          <div><div class="text-xs text-slate-500">尺码</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.sizeName)}</div></div>
          <div><div class="text-xs text-slate-500">花型 / 印花</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.printName || '-')}</div></div>
          <div><div class="text-xs text-slate-500">条码</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.barcode || '-')}</div></div>
          <div><div class="text-xs text-slate-500">重量</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.weightText || '-')}</div></div>
          <div><div class="text-xs text-slate-500">体积</div><div class="mt-1 text-sm text-slate-700">${escapeHtml(sku.volumeText || '-')}</div></div>
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
              <th class="px-4 py-3 font-medium">渠道商品 ID</th>
              <th class="px-4 py-3 font-medium">渠道商品名称</th>
              <th class="px-4 py-3 font-medium">变体名称</th>
              <th class="px-4 py-3 font-medium">平台变体 ID</th>
              <th class="px-4 py-3 font-medium">来源</th>
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
      ${renderStyleCreateDrawer()}
      ${renderSkuCreateDrawer()}
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

function createDraftTechnicalVersionForStyle(style: StyleArchiveShellRecord, project: PcsProjectRecord | null): void {
  const identity = getNextTechnicalVersionIdentity()
  const versionMeta = getNextStyleVersionMeta(style.styleId)
  const transferNode = project ? getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'PROJECT_TRANSFER_PREP') : null

  createTechnicalDataVersionDraft({
    technicalVersionId: identity.technicalVersionId,
    technicalVersionCode: identity.technicalVersionCode,
    versionLabel: versionMeta.versionLabel,
    versionNo: versionMeta.versionNo,
    styleId: style.styleId,
    styleCode: style.styleCode,
    styleName: style.styleName,
    sourceProjectId: project?.projectId || '',
    sourceProjectCode: project?.projectCode || '',
    sourceProjectName: project?.projectName || '',
    sourceProjectNodeId: transferNode?.projectNodeId || '',
    linkedRevisionTaskIds: [],
    linkedPatternTaskIds: [],
    linkedArtworkTaskIds: [],
    createdFromTaskType: 'REVISION',
    createdFromTaskId: '',
    createdFromTaskCode: '',
    baseTechnicalVersionId: '',
    baseTechnicalVersionCode: '',
    linkedPartTemplateIds: [],
    linkedPatternLibraryVersionIds: [],
    versionStatus: 'DRAFT',
    bomStatus: 'EMPTY',
    patternStatus: 'EMPTY',
    processStatus: 'EMPTY',
    gradingStatus: 'EMPTY',
    qualityStatus: 'EMPTY',
    colorMaterialStatus: 'EMPTY',
    designStatus: 'EMPTY',
    attachmentStatus: 'EMPTY',
    bomItemCount: 0,
    patternFileCount: 0,
    processEntryCount: 0,
    gradingRuleCount: 0,
    qualityRuleCount: 0,
    colorMaterialMappingCount: 0,
    designAssetCount: 0,
    attachmentCount: 0,
    completenessScore: 0,
    missingItemCodes: [],
    missingItemNames: [],
    publishedAt: '',
    publishedBy: '',
    createdAt: identity.timestamp,
    createdBy: '系统演示',
    updatedAt: identity.timestamp,
    updatedBy: '系统演示',
    note: '',
    legacySpuCode: style.styleCode,
    legacyVersionLabel: '',
  })

  updateStyleArchive(style.styleId, {
    techPackStatus: '草稿中',
    techPackVersionCount: listTechnicalDataVersionsByStyleId(style.styleId).length,
    updatedAt: identity.timestamp,
    updatedBy: '系统演示',
  })
}

function submitStyleCreate(): void {
  const name = state.styleCreate.name.trim()
  const category = state.styleCreate.category.trim()
  if (!name) {
    state.notice = '请先输入款式名称。'
    return
  }
  if (!category) {
    state.notice = '请先选择类目。'
    return
  }

  const project = state.styleCreate.projectId ? getProjectById(state.styleCreate.projectId) : null
  if (state.styleCreate.mode === 'project' && !project) {
    state.notice = '请先选择来源商品项目。'
    return
  }
  if (state.styleCreate.mode === 'legacy' && (!state.styleCreate.legacySystem.trim() || !state.styleCreate.legacyCode.trim())) {
    state.notice = '请补齐老系统与老系统编码。'
    return
  }

  const identity = buildStyleIdentity()
  const styleCreateNode = project ? getProjectNodeRecordByWorkItemTypeCode(project.projectId, 'STYLE_ARCHIVE_CREATE') : null

  try {
    const created = createStyleArchiveShell({
      styleId: identity.styleId,
      styleCode: identity.styleCode,
      styleName: name,
      styleNumber: identity.styleCode,
      styleType: '成衣',
      sourceProjectId: project?.projectId || '',
      sourceProjectCode: project?.projectCode || '',
      sourceProjectName: project?.projectName || '',
      sourceProjectNodeId: styleCreateNode?.projectNodeId || '',
      categoryId: '',
      categoryName: category.split('/')[0] || category,
      subCategoryId: '',
      subCategoryName: category.split('/')[1] || '',
      brandId: project?.brandId || '',
      brandName: project?.brandName || '',
      yearTag: '2026',
      seasonTags: project?.seasonTags?.length ? [...project.seasonTags] : ['春夏'],
      styleTags:
        resolveTags(state.styleCreate.tags).length > 0
          ? resolveTags(state.styleCreate.tags)
          : project?.styleTags?.length
            ? project.styleTags
            : listConfiguredStyleTags().slice(0, 1),
      targetAudienceTags: project?.targetAudienceTags || [],
      targetChannelCodes: project?.targetChannelCodes || [],
      priceRangeLabel: state.styleCreate.priceBand || '¥199-399',
      archiveStatus: project ? 'ACTIVE' : 'DRAFT',
      baseInfoStatus: '已维护',
      specificationStatus: '未建立',
      techPackStatus: state.styleCreate.createVersion ? '草稿中' : '未建立',
      costPricingStatus: '未建立',
      specificationCount: 0,
      techPackVersionCount: 0,
      costVersionCount: 0,
      channelProductCount: 0,
      currentTechPackVersionId: '',
      currentTechPackVersionCode: '',
      currentTechPackVersionLabel: '',
      currentTechPackVersionStatus: '',
      currentTechPackVersionActivatedAt: '',
      currentTechPackVersionActivatedBy: '',
      remark: '',
      generatedAt: identity.timestamp,
      generatedBy: '系统演示',
      updatedAt: identity.timestamp,
      updatedBy: '系统演示',
      legacyOriginProject:
        state.styleCreate.mode === 'legacy'
          ? `${state.styleCreate.legacySystem.trim()} · ${state.styleCreate.legacyCode.trim()}`
          : '',
    })

    if (state.styleCreate.createVersion) {
      createDraftTechnicalVersionForStyle(created, project)
    }

    if (project) {
      updateProjectRecord(project.projectId, {
        linkedStyleId: created.styleId,
        linkedStyleCode: created.styleCode,
        linkedStyleName: created.styleName,
        linkedStyleGeneratedAt: identity.timestamp,
        updatedAt: identity.timestamp,
      })
      bindStyleArchiveToProjectChannelProduct(
        project.projectId,
        {
          styleId: created.styleId,
          styleCode: created.styleCode,
          styleName: created.styleName,
        },
        '系统演示',
      )
      const styleChannels = listProjectChannelProducts().filter((item) => item.styleId === created.styleId && item.channelProductStatus !== '已作废')
      updateStyleArchive(created.styleId, {
        channelProductCount: styleChannels.length,
        updatedAt: identity.timestamp,
        updatedBy: '系统演示',
      })
    }

    resetStyleCreateState()
    state.notice = `已创建款式档案 ${created.styleCode}。`
    appStore.navigate(`/pcs/products/styles/${created.styleId}`)
  } catch (error) {
    state.notice = error instanceof Error ? error.message : '创建款式档案失败。'
  }
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
  return {
    skuId: identity.skuId,
    skuCode: input.skuCode,
    styleId: input.style.styleId,
    styleCode: input.style.styleCode,
    styleName: input.style.styleName,
    colorName: input.color,
    sizeName: input.size,
    printName: input.print.trim() || '基础款',
    barcode: input.barcode.trim() || `69${identity.timestamp.replace(/\D/g, '').slice(-11)}`.slice(0, 13),
    archiveStatus: 'ACTIVE',
    mappingHealth: input.mappingHealth || (input.style.channelProductCount > 0 ? 'OK' : 'MISSING'),
    channelMappingCount: Math.max(0, input.style.channelProductCount || 0),
    listedChannelCount: input.style.channelProductCount > 0 ? Math.max(1, input.style.channelProductCount) : 0,
    techPackVersionId: input.style.currentTechPackVersionId || latestVersion.versionId,
    techPackVersionCode: input.style.currentTechPackVersionCode || latestVersion.versionCode,
    techPackVersionLabel: input.style.currentTechPackVersionLabel || latestVersion.versionLabel,
    legacySystem: input.legacySystem || '',
    legacyCode: input.legacyCode || '',
    weightText: '0.36kg',
    volumeText: '30*22*4cm',
    lastListingAt: input.style.channelProductCount > 0 ? identity.timestamp.slice(0, 10) : '',
    lastOrderAt: '',
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

export function handlePcsProductArchiveInput(target: Element): boolean {
  const fieldNode = resolveClosestNode(target, '[data-pcs-product-archive-field]')
  if (!fieldNode) return false
  const field = fieldNode.dataset.pcsProductArchiveField
  if (!field) return false

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
    case 'style-create-name':
      state.styleCreate.name = value
      return true
    case 'style-create-category':
      state.styleCreate.category = value
      return true
    case 'style-create-tags':
      state.styleCreate.tags = value
      return true
    case 'style-create-price-band':
      state.styleCreate.priceBand = value
      return true
    case 'style-create-project-id': {
      state.styleCreate.projectId = value
      const project = value ? getProjectById(value) : null
      if (project) {
        state.styleCreate.name = state.styleCreate.name || project.projectName
        state.styleCreate.category = state.styleCreate.category || project.subCategoryName || project.categoryName || ''
        state.styleCreate.tags = state.styleCreate.tags || project.styleTags.join('，')
        state.styleCreate.priceBand = state.styleCreate.priceBand || '¥199-399'
      }
      return true
    }
    case 'style-create-legacy-system':
      state.styleCreate.legacySystem = value
      return true
    case 'style-create-legacy-code':
      state.styleCreate.legacyCode = value
      return true
    case 'style-create-create-version':
      state.styleCreate.createVersion = checked
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
      resetStyleCreateState()
      resetSkuCreateState()
      return true
    case 'open-style-create':
      resetStyleCreateState()
      state.styleCreate.open = true
      state.styleCreate.mode = (actionNode.dataset.mode as StyleCreateMode) || 'new'
      return true
    case 'submit-style-create':
      submitStyleCreate()
      return true
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
    case 'sync-style-mapping':
      state.notice = '已按当前款式与规格关系刷新映射健康状态。'
      return true
    case 'sync-sku-mapping':
      state.notice = '已按当前渠道商品关系刷新规格映射状态。'
      return true
    case 'toggle-style-status': {
      const styleId = actionNode.dataset.styleId || ''
      const style = styleId ? getStyleArchiveById(styleId) : null
      if (!style) {
        state.notice = '未找到对应款式档案。'
        return true
      }
      const nextStatus: StyleArchiveStatusCode = style.archiveStatus === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED'
      updateStyleArchive(style.styleId, {
        archiveStatus: nextStatus,
        updatedAt: nowText(),
        updatedBy: '系统演示',
      })
      state.notice = nextStatus === 'ARCHIVED' ? `已归档 ${style.styleCode}。` : `已恢复启用 ${style.styleCode}。`
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
  return state.styleCreate.open || state.skuCreate.open
}
