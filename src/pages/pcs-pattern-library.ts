import { appStore } from '../state/store'
import { renderDrawer as uiDrawer } from '../components/ui'
import { escapeHtml, formatDateTime } from '../utils'
import { buildPatternCategoryPath, getPatternSimilarityStatusText } from '../utils/pcs-pattern-library-services'
import {
  PATTERN_DUPLICATE_STATUS_LABELS,
  PATTERN_LICENSE_STATUS_LABELS,
  PATTERN_LIFECYCLE_STATUS_LABELS,
  PATTERN_PARSE_STATUS_LABELS,
  PATTERN_REVIEW_STATUS_LABELS,
  archivePatternAsset,
  batchUpdatePatternAssets,
  disablePatternAsset,
  exportPatternLibraryRows,
  getPatternBlob,
  getPatternCategorySecondaryList,
  getPatternLibraryConfig,
  getPatternLibraryStats,
  getPatternLibraryTabCounts,
  getPatternReferenceAvailability,
  getPatternAssetById,
  listPatternAssets,
  listSimilarPatternAssets,
  restorePatternAsset,
  submitPatternAssetReview,
  type PatternAssetRecord,
} from '../data/pcs-pattern-library'

type PreviewMode = '原图' | '平铺' | '版片'
type PreviewBackground = '浅色' | '深色' | '网格'

interface PatternLibraryPageState {
  currentTab: string
  search: string
  usageType: string
  categoryPrimary: string
  categorySecondary: string
  styleTag: string
  primaryColor: string
  hotFlag: string
  licenseStatus: string
  maintenanceStatus: string
  parseStatus: string
  reviewStatus: string
  sourceType: string
  uploadedBy: string
  updatedWithin: string
  referencedFlag: string
  duplicateFlag: string
  selectedIds: string[]
  previewDrawerOpen: boolean
  previewAssetId: string | null
  previewMode: PreviewMode
  previewBackground: PreviewBackground
  batchDrawerOpen: boolean
  batchMaintenanceStatus: string
  batchReviewStatus: string
  batchLifecycleStatus: string
  notice: string | null
  previewUrls: Record<string, string>
  previewLoadingVersionIds: string[]
}

const state: PatternLibraryPageState = {
  currentTab: '全部',
  search: '',
  usageType: '全部',
  categoryPrimary: '全部',
  categorySecondary: '全部',
  styleTag: '全部',
  primaryColor: '全部',
  hotFlag: '全部',
  licenseStatus: '全部',
  maintenanceStatus: '全部',
  parseStatus: '全部',
  reviewStatus: '全部',
  sourceType: '全部',
  uploadedBy: '全部',
  updatedWithin: '全部',
  referencedFlag: '全部',
  duplicateFlag: '全部',
  selectedIds: [],
  previewDrawerOpen: false,
  previewAssetId: null,
  previewMode: '原图',
  previewBackground: '浅色',
  batchDrawerOpen: false,
  batchMaintenanceStatus: '保持不变',
  batchReviewStatus: '保持不变',
  batchLifecycleStatus: '保持不变',
  notice: null,
  previewUrls: {},
  previewLoadingVersionIds: [],
}

const FLASH_NOTICE_KEY = 'pcs_pattern_library_flash_notice'

function consumeFlashNotice(): string | null {
  if (typeof window === 'undefined') return null
  const value = window.sessionStorage.getItem(FLASH_NOTICE_KEY)
  if (value) {
    window.sessionStorage.removeItem(FLASH_NOTICE_KEY)
  }
  return value
}

function requestRender(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('higood:request-render'))
  }
}

function ensureVersionPreview(record: PatternAssetRecord): void {
  const version = record.currentVersion
  if (!version) return
  if (version.preview_url || version.thumbnail_url) return
  if (state.previewUrls[version.id]) return
  if (state.previewLoadingVersionIds.includes(version.id)) return

  const blobKey = version.preview_blob_key || version.thumbnail_blob_key
  if (!blobKey) return
  state.previewLoadingVersionIds.push(version.id)
  void getPatternBlob(blobKey)
    .then((blob) => {
      if (!blob) return
      state.previewUrls[version.id] = URL.createObjectURL(blob)
    })
    .finally(() => {
      state.previewLoadingVersionIds = state.previewLoadingVersionIds.filter((item) => item !== version.id)
      requestRender()
    })
}

function getVersionPreviewUrl(record: PatternAssetRecord): string {
  ensureVersionPreview(record)
  return record.currentVersion?.preview_url || record.currentVersion?.thumbnail_url || (record.currentVersion ? state.previewUrls[record.currentVersion.id] || '' : '')
}

function getBgClass(background: PreviewBackground): string {
  if (background === '深色') return 'bg-slate-800'
  if (background === '网格') return 'bg-[linear-gradient(45deg,#f8fafc_25%,transparent_25%),linear-gradient(-45deg,#f8fafc_25%,transparent_25%),linear-gradient(45deg,transparent_75%,#e2e8f0_75%),linear-gradient(-45deg,transparent_75%,#e2e8f0_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0px]'
  return 'bg-slate-50'
}

function getFilteredRecords(): PatternAssetRecord[] {
  const keyword = state.search.trim().toLowerCase()
  const now = Date.now()
  return listPatternAssets().filter((record) => {
    if (state.currentTab === '待补录' && record.maintenance_status !== '待补录') return false
    if (state.currentTab === '待审核' && record.review_status !== 'pending') return false
    if (state.currentTab === '解析失败' && record.parse_status !== 'failed') return false
    if (state.currentTab === '疑似重复' && record.duplicate_status !== 'suspected') return false
    if (state.currentTab === '已归档' && record.lifecycle_status !== 'archived') return false

    const text = [
      record.pattern_code,
      record.pattern_name,
      record.original_filename,
      ...record.aliases,
      ...record.style_tags,
      ...record.color_tags,
      ...record.tags.map((tag) => tag.tag_name),
    ]
      .join(' ')
      .toLowerCase()
    if (keyword && !text.includes(keyword)) return false
    if (state.usageType !== '全部' && record.usage_type !== state.usageType) return false
    if (state.categoryPrimary !== '全部' && (record.category_primary ?? record.category) !== state.categoryPrimary) return false
    if (state.categorySecondary !== '全部' && (record.category_secondary ?? '') !== state.categorySecondary) return false
    if (state.styleTag !== '全部' && !record.style_tags.includes(state.styleTag)) return false
    if (state.primaryColor !== '全部' && !record.color_tags.includes(state.primaryColor)) return false
    if (state.hotFlag !== '全部' && (record.hot_flag ? '是' : '否') !== state.hotFlag) return false
    if (state.licenseStatus !== '全部' && record.license_status !== state.licenseStatus) return false
    if (state.maintenanceStatus !== '全部' && record.maintenance_status !== state.maintenanceStatus) return false
    if (state.parseStatus !== '全部' && record.parse_status !== state.parseStatus) return false
    if (state.reviewStatus !== '全部' && record.review_status !== state.reviewStatus) return false
    if (state.sourceType !== '全部' && record.source_type !== state.sourceType) return false
    if (state.uploadedBy !== '全部' && record.updated_by !== state.uploadedBy && record.created_by !== state.uploadedBy) return false
    if (state.referencedFlag !== '全部' && (record.reference_count > 0 ? '已引用' : '未引用') !== state.referencedFlag) return false
    if (state.duplicateFlag !== '全部' && (record.duplicate_status === 'suspected' ? '是' : '否') !== state.duplicateFlag) return false
    if (state.updatedWithin !== '全部') {
      const days = state.updatedWithin === '7天内' ? 7 : 30
      const delta = (now - new Date(record.updated_at).getTime()) / (1000 * 60 * 60 * 24)
      if (delta > days) return false
    }
    return true
  })
}

function getFilterOptions(records: PatternAssetRecord[]) {
  const config = getPatternLibraryConfig()
  return {
    usageTypes: config.usageTypes,
    categoryPrimary: config.categoryTree.map((item) => item.value),
    categorySecondary: state.categoryPrimary === '全部' ? [] : getPatternCategorySecondaryList(state.categoryPrimary),
    styleTags: Array.from(new Set(records.flatMap((item) => item.style_tags).concat(config.styleTags))),
    primaryColors: Array.from(new Set(records.flatMap((item) => item.color_tags).concat(config.primaryColors))),
    sourceTypes: config.sourceTypes,
    uploadedBy: Array.from(new Set(records.map((item) => item.updated_by))),
  }
}

function getStatusBadge(text: string, tone: 'blue' | 'green' | 'amber' | 'rose' | 'slate'): string {
  const map = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    rose: 'bg-rose-100 text-rose-700',
    slate: 'bg-slate-100 text-slate-700',
  }
  return `<span class="inline-flex rounded-full px-2 py-0.5 text-xs ${map[tone]}">${escapeHtml(text)}</span>`
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="h-8 rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-100" data-pattern-library-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderHeader(): string {
  const stats = getPatternLibraryStats()
  return `
    <header class="space-y-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs text-gray-500">工程开发与打样管理 / 花型库</p>
          <h1 class="text-xl font-semibold">花型库</h1>
          <p class="mt-1 text-sm text-gray-500">面向商品中心的花型资产主档，统一承接上传、解析、标签、重复治理、审核、版本与引用闭环。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="inline-flex h-9 items-center gap-2 rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700" data-pattern-library-action="go-create">
            <i data-lucide="upload" class="h-4 w-4"></i>上传花型
          </button>
          <button class="inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm hover:bg-gray-50" data-pattern-library-action="go-batch-create">
            <i data-lucide="files" class="h-4 w-4"></i>批量上传
          </button>
          <button class="inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm hover:bg-gray-50" data-pattern-library-action="go-config">
            <i data-lucide="settings-2" class="h-4 w-4"></i>配置
          </button>
          <button class="inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm hover:bg-gray-50" data-pattern-library-action="open-batch-drawer">
            <i data-lucide="pen-square" class="h-4 w-4"></i>批量编辑
          </button>
          <button class="inline-flex h-9 items-center gap-2 rounded-md border px-4 text-sm hover:bg-gray-50" data-pattern-library-action="export">
            <i data-lucide="download" class="h-4 w-4"></i>导出
          </button>
        </div>
      </div>

      <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-gray-500">花型总数</p>
          <p class="mt-2 text-2xl font-semibold">${stats.total}</p>
        </article>
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-gray-500">启用中</p>
          <p class="mt-2 text-2xl font-semibold text-emerald-700">${stats.active}</p>
        </article>
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-gray-500">待审核</p>
          <p class="mt-2 text-2xl font-semibold text-amber-700">${stats.pendingReview}</p>
        </article>
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-gray-500">疑似重复</p>
          <p class="mt-2 text-2xl font-semibold text-rose-700">${stats.suspectedDuplicate}</p>
        </article>
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-gray-500">已被引用</p>
          <p class="mt-2 text-2xl font-semibold text-blue-700">${stats.referenced}</p>
        </article>
        <article class="rounded-lg border bg-white p-4">
          <p class="text-xs text-gray-500">爆款相关</p>
          <p class="mt-2 text-2xl font-semibold">${stats.hotStyles}</p>
        </article>
      </section>
    </header>
  `
}

function renderTabs(): string {
  const counts = getPatternLibraryTabCounts()
  return `
    <section class="flex flex-wrap gap-2 rounded-lg border bg-white p-3">
      ${['全部', '待补录', '待审核', '解析失败', '疑似重复', '已归档']
        .map(
          (tab) => `
            <button
              class="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm ${state.currentTab === tab ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'}"
              data-pattern-library-action="switch-tab"
              data-tab="${tab}"
            >
              <span>${tab}</span>
              <span class="rounded-full ${state.currentTab === tab ? 'bg-white/20' : 'bg-gray-100'} px-2 py-0.5 text-xs">${counts[tab]}</span>
            </button>
          `,
        )
        .join('')}
    </section>
  `
}

function renderFilters(records: PatternAssetRecord[]): string {
  const options = getFilterOptions(records)
  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="grid gap-3 xl:grid-cols-6">
        <div class="xl:col-span-2">
          <label class="mb-1 block text-xs text-gray-500">关键词</label>
          <input class="h-9 w-full rounded-md border px-3 text-sm" placeholder="编号 / 名称 / 原文件名 / 别名 / 标签" value="${escapeHtml(state.search)}" data-pattern-library-field="search" />
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">花型使用方式</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-library-field="usageType">
            <option value="全部">全部</option>
            ${options.usageTypes.map((value) => `<option value="${value}" ${state.usageType === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">题材一级分类</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-library-field="categoryPrimary">
            <option value="全部">全部</option>
            ${options.categoryPrimary.map((value) => `<option value="${value}" ${state.categoryPrimary === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">题材二级分类</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-library-field="categorySecondary" ${state.categoryPrimary === '全部' ? 'disabled' : ''}>
            <option value="全部">${state.categoryPrimary === '全部' ? '请先选择一级分类' : '全部'}</option>
            ${options.categorySecondary.map((value) => `<option value="${value}" ${state.categorySecondary === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">风格标签</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-library-field="styleTag">
            <option value="全部">全部</option>
            ${options.styleTags.map((value) => `<option value="${value}" ${state.styleTag === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">主色系</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-library-field="primaryColor">
            <option value="全部">全部</option>
            ${options.primaryColors.map((value) => `<option value="${value}" ${state.primaryColor === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">是否爆款</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-library-field="hotFlag">
            ${['全部', '是', '否'].map((value) => `<option value="${value}" ${state.hotFlag === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">授权状态</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-library-field="licenseStatus">
            <option value="全部">全部</option>
            ${Object.entries(PATTERN_LICENSE_STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${state.licenseStatus === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">维护状态</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-library-field="maintenanceStatus">
            ${['全部', '待补录', '已维护', '已治理'].map((value) => `<option value="${value}" ${state.maintenanceStatus === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">解析状态</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-library-field="parseStatus">
            <option value="全部">全部</option>
            ${Object.entries(PATTERN_PARSE_STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${state.parseStatus === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">审核状态</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-library-field="reviewStatus">
            <option value="全部">全部</option>
            ${Object.entries(PATTERN_REVIEW_STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${state.reviewStatus === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">来源类型</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-library-field="sourceType">
            <option value="全部">全部</option>
            ${options.sourceTypes.map((value) => `<option value="${value}" ${state.sourceType === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">上传人</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-library-field="uploadedBy">
            <option value="全部">全部</option>
            ${options.uploadedBy.map((value) => `<option value="${value}" ${state.uploadedBy === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">更新时间</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-library-field="updatedWithin">
            ${['全部', '7天内', '30天内'].map((value) => `<option value="${value}" ${state.updatedWithin === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">是否被引用</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-library-field="referencedFlag">
            ${['全部', '已引用', '未引用'].map((value) => `<option value="${value}" ${state.referencedFlag === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs text-gray-500">是否疑似重复</label>
          <select class="h-9 w-full rounded-md border px-3 text-sm" data-pattern-library-field="duplicateFlag">
            ${['全部', '是', '否'].map((value) => `<option value="${value}" ${state.duplicateFlag === value ? 'selected' : ''}>${value}</option>`).join('')}
          </select>
        </div>
        <div class="flex items-end justify-end">
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-gray-50" data-pattern-library-action="reset-filters">重置筛选</button>
        </div>
      </div>
    </section>
  `
}

function renderPreviewSurface(record: PatternAssetRecord): string {
  const imageUrl = getVersionPreviewUrl(record)
  const bgClass = getBgClass(state.previewBackground)
  if (!imageUrl) {
    const loading = record.currentVersion ? state.previewLoadingVersionIds.includes(record.currentVersion.id) : false
    return `<div class="flex h-[360px] items-center justify-center rounded-lg border border-dashed ${bgClass} text-sm text-gray-400">${loading ? '预览生成中' : '暂无预览'}</div>`
  }

  if (state.previewMode === '平铺') {
    return `
      <div class="h-[360px] rounded-lg border ${bgClass} p-4">
        <div class="h-full rounded-md border bg-white bg-[length:180px_180px]" style="background-image:url('${imageUrl}'); background-repeat:repeat;"></div>
      </div>
    `
  }

  if (state.previewMode === '版片') {
    return `
      <div class="h-[360px] rounded-lg border ${bgClass} p-6">
        <div class="flex h-full items-center justify-center rounded-[28px] border-2 border-dashed border-slate-300 bg-white/80 p-6">
          <img src="${imageUrl}" alt="${escapeHtml(record.pattern_name)}" class="max-h-full max-w-full object-contain shadow-sm" />
        </div>
      </div>
    `
  }

  return `
    <div class="h-[360px] rounded-lg border ${bgClass} p-4">
      <div class="flex h-full items-center justify-center overflow-hidden rounded-md bg-white">
        <img src="${imageUrl}" alt="${escapeHtml(record.pattern_name)}" class="max-h-full max-w-full object-contain" />
      </div>
    </div>
  `
}

function renderPreviewDrawer(): string {
  if (!state.previewDrawerOpen || !state.previewAssetId) return ''
  const record = getPatternAssetById(state.previewAssetId)
  if (!record) return ''
  const similar = listSimilarPatternAssets(record.id).slice(0, 3)
  const availability = getPatternReferenceAvailability(record.id)
  const currentVersion = record.currentVersion

  const content = `
    <div class="space-y-5">
      <section class="space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 class="text-base font-semibold">${escapeHtml(record.pattern_name)}</h3>
            <p class="mt-1 text-xs text-gray-500">${escapeHtml(record.pattern_code)}｜${escapeHtml(record.original_filename)}</p>
          </div>
          <div class="flex flex-wrap gap-1">
            ${(['原图', '平铺', '版片'] as PreviewMode[])
              .map((mode) => `<button class="h-8 rounded-md px-3 text-xs ${state.previewMode === mode ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'}" data-pattern-library-action="set-preview-mode" data-preview-mode="${mode}">${mode}</button>`)
              .join('')}
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          ${(['浅色', '深色', '网格'] as PreviewBackground[])
            .map((mode) => `<button class="h-8 rounded-md px-3 text-xs ${state.previewBackground === mode ? 'bg-slate-900 text-white' : 'border hover:bg-gray-50'}" data-pattern-library-action="set-preview-background" data-preview-background="${mode}">${mode}背景</button>`)
            .join('')}
        </div>
        ${renderPreviewSurface(record)}
      </section>

      <section class="rounded-lg border bg-slate-50 p-4">
        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <p class="text-xs text-gray-500">基础元数据</p>
            <div class="mt-2 space-y-1 text-sm text-gray-700">
              <p>版本：${escapeHtml(currentVersion?.version_no ?? '-')}</p>
              <p>格式：${escapeHtml((currentVersion?.file_ext ?? '-').toUpperCase())} / ${escapeHtml(currentVersion?.mime_type ?? '-')}</p>
              <p>尺寸：${currentVersion?.image_width ?? '-'} x ${currentVersion?.image_height ?? '-'}</p>
              <p>DPI：${currentVersion?.dpi_x ?? '-'} / ${currentVersion?.dpi_y ?? '-'}</p>
              <p>颜色模式：${escapeHtml(currentVersion?.color_mode ?? '-')}</p>
            </div>
          </div>
          <div>
            <p class="text-xs text-gray-500">自动标签摘要</p>
            <div class="mt-2 flex flex-wrap gap-1">
              ${record.tags.slice(0, 8).map((tag) => `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs">${escapeHtml(`${tag.tag_type}:${tag.tag_name}`)}</span>`).join('') || '<span class="text-xs text-gray-400">暂无标签</span>'}
            </div>
            <p class="mt-2 text-xs ${availability.allowed ? 'text-emerald-700' : 'text-rose-600'}">${escapeHtml(availability.allowed ? '当前状态允许正式引用' : availability.reason ?? '当前不可引用')}</p>
          </div>
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <h4 class="text-sm font-semibold">相似花型推荐</h4>
        <div class="mt-3 space-y-3">
          ${similar.length === 0 ? `<p class="text-sm text-gray-500">${escapeHtml(getPatternSimilarityStatusText(record.currentVersion?.phash, 0))}</p>` : similar
            .map((item) => `
              <article class="rounded-lg border bg-slate-50 p-3">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium">${escapeHtml(item.asset.pattern_name)}</p>
                    <p class="mt-1 text-xs text-gray-500">${escapeHtml(item.asset.pattern_code)}｜${escapeHtml(item.version.version_no)}</p>
                  </div>
                  <span class="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">${Math.round(item.hit.similarity * 100)}%</span>
                </div>
                <p class="mt-2 text-xs text-gray-600">${item.hit.duplicateType === 'sha256' ? '命中完全重复（sha256）' : `pHash 距离 ${item.hit.distance}`}</p>
              </article>
            `)
            .join('')}
        </div>
      </section>

      <section class="rounded-lg border bg-white p-4">
        <h4 class="text-sm font-semibold">快捷操作</h4>
        <div class="mt-3 flex flex-wrap gap-2">
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-gray-50" data-pattern-library-action="go-detail" data-asset-id="${record.id}">进入详情页</button>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-gray-50" data-pattern-library-action="submit-review" data-asset-id="${record.id}">提交审核</button>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-gray-50" data-pattern-library-action="${record.lifecycle_status === 'inactive' ? 'restore' : 'disable'}" data-asset-id="${record.id}">${record.lifecycle_status === 'inactive' ? '恢复' : '停用'}</button>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-gray-50" data-pattern-library-action="archive" data-asset-id="${record.id}">归档</button>
        </div>
      </section>
    </div>
  `

  return uiDrawer(
    {
      title: '花型预览',
      subtitle: '右侧预览抽屉，承接大图、标签、相似推荐与快捷治理动作。',
      closeAction: { prefix: 'pattern-library', action: 'close-preview' },
      width: 'lg',
    },
    content,
    {
      cancel: { prefix: 'pattern-library', action: 'close-preview', label: '关闭' },
    },
  )
}

function renderBatchDrawer(): string {
  if (!state.batchDrawerOpen) return ''
  const content = `
    <div class="space-y-4">
      <div class="rounded-lg border bg-slate-50 p-3 text-sm text-gray-600">已选 ${state.selectedIds.length} 条花型记录，支持批量调整治理字段。</div>
      <div>
        <label class="mb-1 block text-sm font-medium">维护状态</label>
        <select class="h-10 w-full rounded-md border px-3 text-sm" data-pattern-library-field="batchMaintenanceStatus">
          ${['保持不变', '待补录', '已维护', '已治理'].map((value) => `<option value="${value}" ${state.batchMaintenanceStatus === value ? 'selected' : ''}>${value}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium">审核状态</label>
        <select class="h-10 w-full rounded-md border px-3 text-sm" data-pattern-library-field="batchReviewStatus">
          ${['保持不变', 'draft', 'pending', 'approved', 'rejected'].map((value) => `<option value="${value}" ${state.batchReviewStatus === value ? 'selected' : ''}>${value === '保持不变' ? value : PATTERN_REVIEW_STATUS_LABELS[value as keyof typeof PATTERN_REVIEW_STATUS_LABELS]}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="mb-1 block text-sm font-medium">生命周期</label>
        <select class="h-10 w-full rounded-md border px-3 text-sm" data-pattern-library-field="batchLifecycleStatus">
          ${['保持不变', 'active', 'inactive', 'archived'].map((value) => `<option value="${value}" ${state.batchLifecycleStatus === value ? 'selected' : ''}>${value === '保持不变' ? value : PATTERN_LIFECYCLE_STATUS_LABELS[value as keyof typeof PATTERN_LIFECYCLE_STATUS_LABELS]}</option>`).join('')}
        </select>
      </div>
    </div>
  `

  return uiDrawer(
    {
      title: '批量编辑',
      subtitle: '历史治理不单开新页面，在列表页通过批量编辑抽屉完成。',
      closeAction: { prefix: 'pattern-library', action: 'close-batch-drawer' },
      width: 'sm',
    },
    content,
    {
      cancel: { prefix: 'pattern-library', action: 'close-batch-drawer', label: '取消' },
      confirm: {
        prefix: 'pattern-library',
        action: 'confirm-batch-update',
        label: '应用更新',
        variant: 'primary',
        disabled: state.selectedIds.length === 0,
      },
    },
  )
}

function renderRow(record: PatternAssetRecord): string {
  const isSelected = state.selectedIds.includes(record.id)
  const thumbnail = getVersionPreviewUrl(record)
  return `
    <tr class="border-b last:border-b-0 hover:bg-gray-50 ${isSelected ? 'bg-blue-50/60' : ''}">
      <td class="px-3 py-3"><input type="checkbox" class="h-4 w-4 rounded border" ${isSelected ? 'checked' : ''} data-pattern-library-action="toggle-select" data-asset-id="${record.id}" /></td>
      <td class="px-3 py-3">
        <button class="block h-14 w-14 overflow-hidden rounded-md border bg-slate-50 text-left" data-pattern-library-action="open-preview" data-asset-id="${record.id}">
          ${thumbnail ? `<img src="${thumbnail}" alt="${escapeHtml(record.pattern_name)}" class="h-full w-full object-cover" />` : '<div class="flex h-full items-center justify-center text-xs text-gray-400">暂无</div>'}
        </button>
      </td>
      <td class="px-3 py-3">
        <button class="text-left text-sm font-medium text-blue-700 hover:underline" data-pattern-library-action="go-detail" data-asset-id="${record.id}">${escapeHtml(record.pattern_code)}</button>
      </td>
      <td class="px-3 py-3">
        <div>
          <p class="font-medium">${escapeHtml(record.pattern_name)}</p>
          <p class="mt-1 text-xs text-gray-500">${escapeHtml(record.aliases.join(' / ') || '无别名')}</p>
        </div>
      </td>
      <td class="px-3 py-3 text-sm text-gray-600">${escapeHtml(record.original_filename)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.usage_type)}</td>
      <td class="px-3 py-3 text-sm">${escapeHtml(buildPatternCategoryPath(record.category_primary ?? record.category, record.category_secondary))}</td>
      <td class="px-3 py-3"><div class="flex flex-wrap gap-1">${record.style_tags.map((tag) => `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs">${escapeHtml(tag)}</span>`).join('') || '<span class="text-xs text-gray-400">-</span>'}</div></td>
      <td class="px-3 py-3 text-sm">${escapeHtml(record.color_tags.join(' / ') || '-')}</td>
      <td class="px-3 py-3 text-sm">${record.hot_flag ? '是' : '否'}</td>
      <td class="px-3 py-3">${getStatusBadge(PATTERN_LICENSE_STATUS_LABELS[record.license_status], record.license_status === 'authorized' ? 'green' : record.license_status === 'restricted' ? 'amber' : 'rose')}</td>
      <td class="px-3 py-3 text-sm">${record.maintenance_status}</td>
      <td class="px-3 py-3">${getStatusBadge(PATTERN_PARSE_STATUS_LABELS[record.parse_status], record.parse_status === 'success' ? 'green' : record.parse_status === 'failed' ? 'rose' : 'amber')}</td>
      <td class="px-3 py-3">${getStatusBadge(PATTERN_DUPLICATE_STATUS_LABELS[record.duplicate_status], record.duplicate_status === 'suspected' ? 'amber' : 'slate')}</td>
      <td class="px-3 py-3 text-sm">${record.reference_count}</td>
      <td class="px-3 py-3 text-xs text-gray-500">${formatDateTime(record.updated_at)}</td>
      <td class="px-3 py-3">
        <div class="flex flex-wrap gap-2">
          <button class="h-8 rounded-md border px-3 text-xs hover:bg-gray-50" data-pattern-library-action="open-preview" data-asset-id="${record.id}">预览</button>
          <button class="h-8 rounded-md border px-3 text-xs hover:bg-gray-50" data-pattern-library-action="go-detail" data-asset-id="${record.id}">详情</button>
        </div>
      </td>
    </tr>
  `
}

function renderTable(records: PatternAssetRecord[]): string {
  return `
    <section class="overflow-hidden rounded-lg border bg-white">
      <div class="overflow-x-auto">
        <table class="w-full min-w-[1800px] text-sm">
          <thead>
            <tr class="border-b bg-gray-50 text-left text-gray-600">
              <th class="px-3 py-3"><input type="checkbox" class="h-4 w-4 rounded border" ${records.length > 0 && state.selectedIds.length === records.length ? 'checked' : ''} data-pattern-library-action="toggle-select-all" /></th>
              <th class="px-3 py-3 font-medium">缩略图</th>
              <th class="px-3 py-3 font-medium">花型编号</th>
              <th class="px-3 py-3 font-medium">花型名称</th>
              <th class="px-3 py-3 font-medium">原文件名</th>
              <th class="px-3 py-3 font-medium">花型使用方式</th>
              <th class="px-3 py-3 font-medium">题材分类</th>
              <th class="px-3 py-3 font-medium">风格标签</th>
              <th class="px-3 py-3 font-medium">主色系</th>
              <th class="px-3 py-3 font-medium">是否爆款</th>
              <th class="px-3 py-3 font-medium">授权状态</th>
              <th class="px-3 py-3 font-medium">维护状态</th>
              <th class="px-3 py-3 font-medium">解析状态</th>
              <th class="px-3 py-3 font-medium">重复检测状态</th>
              <th class="px-3 py-3 font-medium">引用次数</th>
              <th class="px-3 py-3 font-medium">最近更新时间</th>
              <th class="px-3 py-3 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${records.length === 0 ? `
              <tr>
                <td colspan="17" class="px-4 py-16 text-center text-sm text-gray-500">
                  <i data-lucide="image-off" class="mx-auto h-10 w-10 text-gray-300"></i>
                  <p class="mt-3">当前筛选条件下暂无花型资产</p>
                </td>
              </tr>
            ` : records.map(renderRow).join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderPage(): string {
  const records = getFilteredRecords()
  return `
    <div class="space-y-4">
      ${renderHeader()}
      ${renderNotice()}
      ${renderTabs()}
      ${renderFilters(listPatternAssets())}
      ${renderTable(records)}
      ${renderPreviewDrawer()}
      ${renderBatchDrawer()}
    </div>
  `
}

function resetFilters(): void {
  state.search = ''
  state.usageType = '全部'
  state.categoryPrimary = '全部'
  state.categorySecondary = '全部'
  state.styleTag = '全部'
  state.primaryColor = '全部'
  state.hotFlag = '全部'
  state.licenseStatus = '全部'
  state.maintenanceStatus = '全部'
  state.parseStatus = '全部'
  state.reviewStatus = '全部'
  state.sourceType = '全部'
  state.uploadedBy = '全部'
  state.updatedWithin = '全部'
  state.referencedFlag = '全部'
  state.duplicateFlag = '全部'
}

export function handlePcsPatternLibraryEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pattern-library-action]')
  const action = actionNode?.dataset.patternLibraryAction
  if (!actionNode || !action) return false

  if (action === 'go-create') {
    appStore.navigate('/pcs/pattern-library/create')
    return true
  }

  if (action === 'go-batch-create') {
    appStore.navigate('/pcs/pattern-library/create?mode=batch')
    return true
  }

  if (action === 'go-config') {
    appStore.navigate('/pcs/pattern-library/config')
    return true
  }

  if (action === 'open-batch-drawer') {
    if (state.selectedIds.length === 0) {
      state.notice = '请先选择需要批量处理的花型记录。'
      return true
    }
    state.batchDrawerOpen = true
    return true
  }

  if (action === 'close-batch-drawer') {
    state.batchDrawerOpen = false
    return true
  }

  if (action === 'confirm-batch-update') {
    batchUpdatePatternAssets({
      ids: state.selectedIds,
      maintenanceStatus: state.batchMaintenanceStatus === '保持不变' ? undefined : state.batchMaintenanceStatus as PatternAssetRecord['maintenance_status'],
      reviewStatus: state.batchReviewStatus === '保持不变' ? undefined : state.batchReviewStatus as PatternAssetRecord['review_status'],
      lifecycleStatus: state.batchLifecycleStatus === '保持不变' ? undefined : state.batchLifecycleStatus as PatternAssetRecord['lifecycle_status'],
      updatedBy: '档案管理员',
    })
    state.batchDrawerOpen = false
    state.notice = `已批量更新 ${state.selectedIds.length} 条花型记录。`
    return true
  }

  if (action === 'export') {
    const rows = exportPatternLibraryRows()
    state.notice = `当前按筛选条件可导出 ${rows.length} 条花型记录。`
    return true
  }

  if (action === 'switch-tab') {
    state.currentTab = actionNode.dataset.tab || '全部'
    return true
  }

  if (action === 'reset-filters') {
    resetFilters()
    return true
  }

  if (action === 'open-preview') {
    state.previewAssetId = actionNode.dataset.assetId || null
    state.previewDrawerOpen = true
    return true
  }

  if (action === 'close-preview') {
    state.previewDrawerOpen = false
    return true
  }

  if (action === 'set-preview-mode') {
    state.previewMode = (actionNode.dataset.previewMode as PreviewMode) || '原图'
    return true
  }

  if (action === 'set-preview-background') {
    state.previewBackground = (actionNode.dataset.previewBackground as PreviewBackground) || '浅色'
    return true
  }

  if (action === 'toggle-select') {
    const assetId = actionNode.dataset.assetId
    if (!assetId) return false
    state.selectedIds = state.selectedIds.includes(assetId)
      ? state.selectedIds.filter((id) => id !== assetId)
      : [...state.selectedIds, assetId]
    return true
  }

  if (action === 'toggle-select-all') {
    const filteredIds = getFilteredRecords().map((record) => record.id)
    state.selectedIds = state.selectedIds.length === filteredIds.length ? [] : filteredIds
    return true
  }

  if (action === 'go-detail') {
    const assetId = actionNode.dataset.assetId
    if (!assetId) return false
    appStore.navigate(`/pcs/pattern-library/${assetId}`)
    return true
  }

  if (action === 'submit-review') {
    const assetId = actionNode.dataset.assetId
    if (!assetId) return false
    try {
      const asset = submitPatternAssetReview(assetId, '档案管理员')
      state.notice = `${asset.pattern_name} 已提交审核。`
    } catch (error) {
      state.notice = error instanceof Error ? error.message : '提交审核失败。'
    }
    return true
  }

  if (action === 'disable') {
    const assetId = actionNode.dataset.assetId
    if (!assetId) return false
    const asset = disablePatternAsset(assetId, '档案管理员')
    state.notice = `${asset.pattern_name} 已停用。`
    return true
  }

  if (action === 'restore') {
    const assetId = actionNode.dataset.assetId
    if (!assetId) return false
    const asset = restorePatternAsset(assetId, '档案管理员')
    state.notice = `${asset.pattern_name} 已恢复。`
    return true
  }

  if (action === 'archive') {
    const assetId = actionNode.dataset.assetId
    if (!assetId) return false
    const asset = archivePatternAsset(assetId, '档案管理员')
    state.notice = `${asset.pattern_name} 已归档。`
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  return false
}

export function handlePcsPatternLibraryInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.patternLibraryField
  if (!field) return false
  const value = (target as HTMLInputElement | HTMLSelectElement).value

  if (field === 'search') state.search = value
  if (field === 'usageType') state.usageType = value
  if (field === 'categoryPrimary') {
    state.categoryPrimary = value
    state.categorySecondary = '全部'
  }
  if (field === 'categorySecondary') state.categorySecondary = value
  if (field === 'styleTag') state.styleTag = value
  if (field === 'primaryColor') state.primaryColor = value
  if (field === 'hotFlag') state.hotFlag = value
  if (field === 'licenseStatus') state.licenseStatus = value
  if (field === 'maintenanceStatus') state.maintenanceStatus = value
  if (field === 'parseStatus') state.parseStatus = value
  if (field === 'reviewStatus') state.reviewStatus = value
  if (field === 'sourceType') state.sourceType = value
  if (field === 'uploadedBy') state.uploadedBy = value
  if (field === 'updatedWithin') state.updatedWithin = value
  if (field === 'referencedFlag') state.referencedFlag = value
  if (field === 'duplicateFlag') state.duplicateFlag = value
  if (field === 'batchMaintenanceStatus') state.batchMaintenanceStatus = value
  if (field === 'batchReviewStatus') state.batchReviewStatus = value
  if (field === 'batchLifecycleStatus') state.batchLifecycleStatus = value

  return true
}

export function isPcsPatternLibraryDialogOpen(): boolean {
  return state.previewDrawerOpen || state.batchDrawerOpen
}

export function renderPcsPatternLibraryPage(): string {
  if (!state.notice) {
    state.notice = consumeFlashNotice()
  }
  return renderPage()
}
