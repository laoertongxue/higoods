import { appStore } from '../state/store'
import { escapeHtml, formatDateTime } from '../utils'
import {
  PATTERN_LICENSE_STATUS_LABELS,
  PATTERN_LIFECYCLE_STATUS_LABELS,
  PATTERN_PARSE_STATUS_LABELS,
  PATTERN_REVIEW_STATUS_LABELS,
  approvePatternAsset,
  archivePatternAsset,
  createPatternVersion,
  disablePatternAsset,
  getPatternBlob,
  getPatternAssetById,
  getPatternCategorySecondaryList,
  getPatternLibraryConfig,
  getPatternReferenceAvailability,
  listPatternVersions,
  persistPatternParsedFile,
  rejectPatternAsset,
  restorePatternAsset,
  submitPatternAssetReview,
  updatePatternAsset,
  waitForPatternLibraryPersistence,
} from '../data/pcs-pattern-library'
import { buildPatternCategoryPath, PatternParseService } from '../utils/pcs-pattern-library-services'
import type { PatternAsset, PatternFileVersion, PatternLicenseStatus } from '../data/pcs-pattern-library-types'

const APP_RENDER_EVENT = 'higood:request-render'
const FLASH_NOTICE_KEY = 'pcs_pattern_library_flash_notice'

interface PatternLibraryDetailState {
  assetId: string
  activeTab: string
  selectedVersionId: string | null
  notice: string | null
  versionParsing: boolean
  versionError: string | null
  previewUrls: Record<string, string>
  previewLoadingVersionIds: string[]
  editForm: {
    patternName: string
    aliases: string
    usageType: string
    categoryPrimary: string
    categorySecondary: string
    styleTags: string
    colorTags: string
    sourceType: string
    applicableCategories: string
    applicableParts: string
    processDirection: string
    maintenanceStatus: string
    manualReviewConclusion: string
    reviewComment: string
    licenseStatus: string
    licenseScope: string
    effectiveAt: string
    expiredAt: string
    riskNote: string
  }
}

const state: PatternLibraryDetailState = {
  assetId: '',
  activeTab: '基础信息',
  selectedVersionId: null,
  notice: null,
  versionParsing: false,
  versionError: null,
  previewUrls: {},
  previewLoadingVersionIds: [],
  editForm: {
    patternName: '',
    aliases: '',
    usageType: '',
    categoryPrimary: '',
    categorySecondary: '',
    styleTags: '',
    colorTags: '',
    sourceType: '',
    applicableCategories: '',
    applicableParts: '',
    processDirection: '',
    maintenanceStatus: '',
    manualReviewConclusion: '',
    reviewComment: '',
    licenseStatus: '',
    licenseScope: '',
    effectiveAt: '',
    expiredAt: '',
    riskNote: '',
  },
}

function requestRender(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(APP_RENDER_EVENT))
  }
}

function consumeFlashNotice(): string | null {
  if (typeof window === 'undefined') return null
  const value = window.sessionStorage.getItem(FLASH_NOTICE_KEY)
  if (value) {
    window.sessionStorage.removeItem(FLASH_NOTICE_KEY)
  }
  return value
}

function revokePreviewUrls(): void {
  Object.values(state.previewUrls).forEach((url) => {
    if (url.startsWith('blob:')) {
      URL.revokeObjectURL(url)
    }
  })
  state.previewUrls = {}
  state.previewLoadingVersionIds = []
}

function ensureVersionPreview(version: PatternFileVersion | null): void {
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

function getVersionPreviewUrl(version: PatternFileVersion | null): string {
  if (!version) return ''
  ensureVersionPreview(version)
  return version.preview_url || version.thumbnail_url || state.previewUrls[version.id] || ''
}

function parseCsvInput(value: string): string[] {
  return value
    .split(/[，,、/]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function syncState(assetId: string): void {
  if (state.assetId === assetId) return
  revokePreviewUrls()
  state.assetId = assetId
  state.activeTab = '基础信息'
  state.selectedVersionId = null
  state.notice = consumeFlashNotice()
  state.versionError = null
  const asset = getPatternAssetById(assetId)
  if (!asset) return
  state.selectedVersionId = asset.current_version_id ?? asset.currentVersion?.id ?? null
  state.editForm = {
    patternName: asset.pattern_name,
    aliases: asset.aliases.join(', '),
    usageType: asset.usage_type,
    categoryPrimary: asset.category_primary ?? asset.category,
    categorySecondary: asset.category_secondary ?? '',
    styleTags: asset.style_tags.join(', '),
    colorTags: asset.color_tags.join(', '),
    sourceType: asset.source_type,
    applicableCategories: asset.applicable_categories.join(', '),
    applicableParts: asset.applicable_parts.join(', '),
    processDirection: asset.process_direction,
    maintenanceStatus: asset.maintenance_status,
    manualReviewConclusion: asset.manual_review_conclusion ?? '',
    reviewComment: asset.review_comment ?? '',
    licenseStatus: asset.license?.license_status ?? asset.license_status,
    licenseScope: asset.license?.license_scope ?? '',
    effectiveAt: asset.license?.effective_at ?? '',
    expiredAt: asset.license?.expired_at ?? '',
    riskNote: asset.license?.risk_note ?? '',
  }
}

function getSelectedVersion(assetId: string): PatternFileVersion | null {
  const versions = listPatternVersions(assetId)
  return versions.find((version) => version.id === state.selectedVersionId) ?? versions[0] ?? null
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="h-8 rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-100" data-pattern-library-detail-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderVersionPreview(version: PatternFileVersion | null): string {
  const previewUrl = getVersionPreviewUrl(version)
  if (!version) {
    return '<div class="flex h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-gray-400">当前版本暂无预览</div>'
  }
  if (!previewUrl) {
    if (state.previewLoadingVersionIds.includes(version.id)) {
      return '<div class="flex h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-gray-500">预览生成中</div>'
    }
    if (version.parse_status === 'failed') {
      return `<div class="flex h-[320px] flex-col items-center justify-center rounded-lg border border-dashed px-6 text-center"><p class="text-sm text-rose-600">${escapeHtml(version.parse_error_message ?? '预览生成失败')}</p><p class="mt-2 text-xs text-gray-500">请重新上传版本文件后再试。</p></div>`
    }
    return '<div class="flex h-[320px] items-center justify-center rounded-lg border border-dashed text-sm text-gray-400">当前版本暂无预览</div>'
  }
  return `
    <div class="flex h-[320px] items-center justify-center overflow-hidden rounded-lg border bg-slate-50 p-4">
      <img src="${previewUrl}" alt="${escapeHtml(version.original_filename)}" class="max-h-full max-w-full object-contain" />
    </div>
  `
}

function renderBasicInfoTab(): string {
  const asset = getPatternAssetById(state.assetId)
  if (!asset) return ''
  const config = getPatternLibraryConfig()
  const secondaryCategories = getPatternCategorySecondaryList(state.editForm.categoryPrimary)
  return `
    <section class="grid gap-4 xl:grid-cols-12">
      <div class="space-y-4 xl:col-span-5">
        ${renderVersionPreview(getSelectedVersion(asset.id))}
        <article class="rounded-lg border bg-white p-4">
          <h3 class="text-sm font-semibold">当前有效版本</h3>
          <div class="mt-3 space-y-1 text-sm text-gray-600">
            <p>版本号：${escapeHtml(asset.currentVersion?.version_no ?? '-')}</p>
            <p>原文件：${escapeHtml(asset.currentVersion?.original_filename ?? '-')}</p>
            <p>解析状态：${PATTERN_PARSE_STATUS_LABELS[asset.parse_status]}</p>
          </div>
        </article>
      </div>
      <div class="space-y-4 xl:col-span-7">
        <section class="rounded-lg border bg-white p-4">
          <div class="flex items-center justify-between gap-3">
            <h3 class="text-base font-semibold">基础信息</h3>
            <button class="h-9 rounded-md border px-3 text-sm hover:bg-gray-50" data-pattern-library-detail-action="save-basic">保存修改</button>
          </div>
          <div class="mt-4 grid gap-4 md:grid-cols-2">
            <div>
              <label class="mb-1 block text-sm font-medium">花型名称</label>
              <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.editForm.patternName)}" data-pattern-library-detail-field="patternName" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">花型编号</label>
              <div class="flex h-10 items-center rounded-md border bg-slate-50 px-3 text-sm text-gray-500">${escapeHtml(asset.pattern_code)}</div>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">别名/历史名称</label>
              <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.editForm.aliases)}" data-pattern-library-detail-field="aliases" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">来源类型</label>
              <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.editForm.sourceType)}" data-pattern-library-detail-field="sourceType" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">花型使用方式</label>
              <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.editForm.usageType)}" data-pattern-library-detail-field="usageType" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">题材一级分类</label>
              <select class="h-10 w-full rounded-md border px-3 text-sm" data-pattern-library-detail-field="categoryPrimary">
                <option value="">请选择一级分类</option>
                ${config.categoryTree.map((item) => `<option value="${item.value}" ${state.editForm.categoryPrimary === item.value ? 'selected' : ''}>${item.label}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">题材二级分类</label>
              <select class="h-10 w-full rounded-md border px-3 text-sm" data-pattern-library-detail-field="categorySecondary" ${state.editForm.categoryPrimary ? '' : 'disabled'}>
                <option value="">${state.editForm.categoryPrimary ? '请选择二级分类' : '请先选择一级分类'}</option>
                ${secondaryCategories.map((item) => `<option value="${item}" ${state.editForm.categorySecondary === item ? 'selected' : ''}>${item}</option>`).join('')}
              </select>
              <p class="mt-1 text-xs text-gray-500">${escapeHtml(buildPatternCategoryPath(state.editForm.categoryPrimary, state.editForm.categorySecondary))}</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">风格标签</label>
              <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.editForm.styleTags)}" data-pattern-library-detail-field="styleTags" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">主色系</label>
              <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.editForm.colorTags)}" data-pattern-library-detail-field="colorTags" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">适用品类</label>
              <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.editForm.applicableCategories)}" data-pattern-library-detail-field="applicableCategories" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">适用部位</label>
              <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.editForm.applicableParts)}" data-pattern-library-detail-field="applicableParts" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">工艺方向</label>
              <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.editForm.processDirection)}" data-pattern-library-detail-field="processDirection" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">维护状态</label>
              <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.editForm.maintenanceStatus)}" data-pattern-library-detail-field="maintenanceStatus" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">人工确认结论</label>
              <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.editForm.manualReviewConclusion)}" data-pattern-library-detail-field="manualReviewConclusion" />
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium">审核意见</label>
              <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.editForm.reviewComment)}" data-pattern-library-detail-field="reviewComment" />
            </div>
          </div>
        </section>
      </div>
    </section>
  `
}

function renderVersionTab(): string {
  const asset = getPatternAssetById(state.assetId)
  if (!asset) return ''
  const versions = listPatternVersions(asset.id)
  return `
    <section class="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
      <div class="space-y-4">
        <section class="rounded-lg border bg-white p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <h3 class="text-base font-semibold">文件与版本</h3>
              <p class="mt-1 text-xs text-gray-500">支持查看当前有效版本、新增版本和切换版本。</p>
            </div>
            <label class="inline-flex h-9 cursor-pointer items-center rounded-md border px-3 text-sm hover:bg-gray-50">
              <input type="file" class="hidden" accept=".jpg,.jpeg,.png,.tif,.tiff" data-pattern-library-detail-action="upload-version-file" />
              新增版本
            </label>
          </div>
          ${state.versionError ? `<p class="mt-3 text-sm text-rose-600">${escapeHtml(state.versionError)}</p>` : ''}
          <div class="mt-4 space-y-3">
            ${versions.map((version) => `
              <article class="rounded-lg border ${state.selectedVersionId === version.id ? 'border-blue-300 bg-blue-50' : 'bg-slate-50'} p-3">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <p class="text-sm font-medium">${escapeHtml(version.version_no)}${version.is_current ? '｜当前有效' : ''}</p>
                    <p class="mt-1 text-xs text-gray-500">${escapeHtml(version.original_filename)}</p>
                    <p class="mt-1 text-xs text-gray-500">${formatDateTime(version.created_at)}｜${escapeHtml((version.file_ext || '-').toUpperCase())}｜${version.image_width ?? '-'} x ${version.image_height ?? '-'}</p>
                  </div>
                  <button class="h-8 rounded-md border px-3 text-xs hover:bg-white" data-pattern-library-detail-action="select-version" data-version-id="${version.id}">查看</button>
                </div>
              </article>
            `).join('')}
          </div>
        </section>
      </div>
      <div class="space-y-4">
        ${renderVersionPreview(getSelectedVersion(asset.id))}
        <section class="rounded-lg border bg-white p-4">
          <h4 class="text-sm font-semibold">当前选中版本摘要</h4>
          <div class="mt-3 space-y-1 text-sm text-gray-600">
            <p>颜色模式：${escapeHtml(getSelectedVersion(asset.id)?.color_mode ?? '-')}</p>
            <p>DPI：${getSelectedVersion(asset.id)?.dpi_x ?? '-'} / ${getSelectedVersion(asset.id)?.dpi_y ?? '-'}</p>
            <p>SHA256：${escapeHtml(getSelectedVersion(asset.id)?.sha256?.slice(0, 16) ?? '-')}</p>
            <p>${escapeHtml(getSelectedVersion(asset.id)?.phash ? `pHash：${getSelectedVersion(asset.id)?.phash?.slice(0, 16)}` : '视觉相似检测未完成')}</p>
          </div>
        </section>
      </div>
    </section>
  `
}

function renderTagsTab(): string {
  const asset = getPatternAssetById(state.assetId)
  if (!asset) return ''
  return `
    <section class="grid gap-4 xl:grid-cols-2">
      <article class="rounded-lg border bg-white p-4">
        <h3 class="text-base font-semibold">标签与识别结果</h3>
        <div class="mt-4 space-y-3">
          ${asset.tags.map((tag) => `
            <div class="flex items-center justify-between gap-3 rounded-lg border bg-slate-50 px-3 py-2">
              <div>
                <p class="text-sm font-medium">${escapeHtml(tag.tag_name)}</p>
                <p class="mt-1 text-xs text-gray-500">${escapeHtml(tag.tag_type)}｜来源：${tag.source === 'manual' ? '人工' : tag.source === 'rule' ? '规则' : 'AI'}${tag.locked ? '｜已锁定' : ''}</p>
              </div>
              <span class="text-xs text-gray-500">${Math.round(tag.confidence * 100)}%</span>
            </div>
          `).join('')}
        </div>
      </article>
      <article class="rounded-lg border bg-white p-4">
        <h3 class="text-base font-semibold">解析摘要</h3>
        <pre class="mt-4 overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">${escapeHtml(JSON.stringify(getSelectedVersion(asset.id)?.parse_result_json ?? {}, null, 2))}</pre>
      </article>
    </section>
  `
}

function renderReferencesTab(): string {
  const asset = getPatternAssetById(state.assetId)
  if (!asset) return ''
  const availability = getPatternReferenceAvailability(asset.id)
  return `
    <section class="space-y-4">
      <article class="rounded-lg border bg-white p-4">
        <h3 class="text-base font-semibold">引用关系</h3>
        <p class="mt-1 text-sm ${availability.allowed ? 'text-emerald-700' : 'text-rose-600'}">${escapeHtml(availability.allowed ? '当前满足正式引用条件' : availability.reason ?? '当前不可引用')}</p>
        <div class="mt-4 overflow-x-auto">
          <table class="w-full min-w-[720px] text-sm">
            <thead>
              <tr class="border-b text-left text-gray-500">
                <th class="px-2 py-2 font-medium">引用类型</th>
                <th class="px-2 py-2 font-medium">引用对象</th>
                <th class="px-2 py-2 font-medium">对象 ID</th>
                <th class="px-2 py-2 font-medium">最近引用时间</th>
              </tr>
            </thead>
            <tbody>
              ${asset.references.map((reference) => `
                <tr class="border-b last:border-b-0">
                  <td class="px-2 py-2">${escapeHtml(reference.ref_type)}</td>
                  <td class="px-2 py-2">${escapeHtml(reference.ref_name)}</td>
                  <td class="px-2 py-2 font-mono text-xs">${escapeHtml(reference.ref_id)}</td>
                  <td class="px-2 py-2 text-xs text-gray-500">${formatDateTime(reference.last_referenced_at ?? reference.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </article>
    </section>
  `
}

function renderLicenseTab(): string {
  const asset = getPatternAssetById(state.assetId)
  if (!asset) return ''
  return `
    <section class="rounded-lg border bg-white p-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-base font-semibold">版权与授权</h3>
        <button class="h-9 rounded-md border px-3 text-sm hover:bg-gray-50" data-pattern-library-detail-action="save-basic">保存授权修改</button>
      </div>
      <div class="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label class="mb-1 block text-sm font-medium">授权状态</label>
          <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.editForm.licenseStatus)}" data-pattern-library-detail-field="licenseStatus" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">授权范围</label>
          <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.editForm.licenseScope)}" data-pattern-library-detail-field="licenseScope" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">生效时间</label>
          <input type="date" class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.editForm.effectiveAt)}" data-pattern-library-detail-field="effectiveAt" />
        </div>
        <div>
          <label class="mb-1 block text-sm font-medium">截止时间</label>
          <input type="date" class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.editForm.expiredAt)}" data-pattern-library-detail-field="expiredAt" />
        </div>
        <div class="md:col-span-2">
          <label class="mb-1 block text-sm font-medium">风险备注</label>
          <textarea class="min-h-[88px] w-full rounded-md border px-3 py-2 text-sm" data-pattern-library-detail-field="riskNote">${escapeHtml(state.editForm.riskNote)}</textarea>
        </div>
      </div>
      <div class="mt-4 rounded-lg border bg-slate-50 p-3 text-sm text-gray-600">
        当前页面允许直接维护授权状态，但已过期或禁止使用的花型不允许新增引用。
      </div>
    </section>
  `
}

function renderLogsTab(): string {
  const asset = getPatternAssetById(state.assetId)
  if (!asset) return ''
  return `
    <section class="rounded-lg border bg-white p-4">
      <h3 class="text-base font-semibold">操作日志</h3>
      <div class="mt-4 space-y-3">
        ${asset.logs.map((log) => `
          <article class="rounded-lg border bg-slate-50 p-3">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <p class="text-sm font-medium">${escapeHtml(log.action)}</p>
              <p class="text-xs text-gray-500">${formatDateTime(log.created_at)}｜${escapeHtml(log.operator)}</p>
            </div>
            <p class="mt-2 text-sm text-gray-600">${escapeHtml(log.detail)}</p>
          </article>
        `).join('')}
      </div>
    </section>
  `
}

function renderTabContent(): string {
  if (state.activeTab === '基础信息') return renderBasicInfoTab()
  if (state.activeTab === '文件与版本') return renderVersionTab()
  if (state.activeTab === '标签与识别结果') return renderTagsTab()
  if (state.activeTab === '引用关系') return renderReferencesTab()
  if (state.activeTab === '版权与授权') return renderLicenseTab()
  return renderLogsTab()
}

export function renderPcsPatternLibraryDetailPage(assetId: string): string {
  syncState(assetId)
  const asset = getPatternAssetById(assetId)
  if (!asset) {
    return `
      <div class="space-y-4">
        <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-pattern-library-detail-action="go-list">返回花型库</button>
        <section class="rounded-lg border border-dashed bg-white px-4 py-14 text-center text-gray-500">未找到花型：${escapeHtml(assetId)}</section>
      </div>
    `
  }

  return `
    <div class="space-y-4">
      <header class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-gray-50" data-pattern-library-detail-action="go-list">
            <i data-lucide="arrow-left" class="mr-1 h-3.5 w-3.5"></i>返回花型库
          </button>
          <h1 class="text-xl font-semibold">${escapeHtml(asset.pattern_name)}</h1>
          <p class="text-sm text-gray-500">${escapeHtml(asset.pattern_code)}｜详情页承接当前有效版本、治理、引用和授权信息。</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <span class="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">${PATTERN_PARSE_STATUS_LABELS[asset.parse_status]}</span>
          <span class="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-700">${PATTERN_REVIEW_STATUS_LABELS[asset.review_status]}</span>
          <span class="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-700">${PATTERN_LIFECYCLE_STATUS_LABELS[asset.lifecycle_status]}</span>
          <span class="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-700">${PATTERN_LICENSE_STATUS_LABELS[asset.license_status]}</span>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-gray-50" data-pattern-library-detail-action="submit-review">提交审核</button>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-gray-50" data-pattern-library-detail-action="approve">审核通过</button>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-gray-50" data-pattern-library-detail-action="reject">驳回</button>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-gray-50" data-pattern-library-detail-action="${asset.lifecycle_status === 'inactive' ? 'restore' : 'disable'}">${asset.lifecycle_status === 'inactive' ? '恢复' : '停用'}</button>
          <button class="h-9 rounded-md border px-3 text-sm hover:bg-gray-50" data-pattern-library-detail-action="archive">归档</button>
        </div>
      </header>

      ${renderNotice()}

      <section class="flex flex-wrap gap-2 rounded-lg border bg-white p-3">
        ${['基础信息', '文件与版本', '标签与识别结果', '引用关系', '版权与授权', '操作日志']
          .map((tab) => `<button class="h-9 rounded-md px-3 text-sm ${state.activeTab === tab ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'}" data-pattern-library-detail-action="switch-tab" data-tab="${tab}">${tab}</button>`)
          .join('')}
      </section>

      ${renderTabContent()}
    </div>
  `
}

export function handlePcsPatternLibraryDetailEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-pattern-library-detail-action]')
  const action = actionNode?.dataset.patternLibraryDetailAction
  if (!actionNode || !action) return false

  if (action === 'go-list') {
    appStore.navigate('/pcs/pattern-library')
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'switch-tab') {
    state.activeTab = actionNode.dataset.tab || '基础信息'
    return true
  }

  if (action === 'select-version') {
    state.selectedVersionId = actionNode.dataset.versionId || null
    return true
  }

  if (action === 'save-basic') {
    try {
      const asset = updatePatternAsset(state.assetId, {
        pattern_name: state.editForm.patternName,
        aliases: parseCsvInput(state.editForm.aliases),
        usage_type: state.editForm.usageType,
        category: state.editForm.categoryPrimary,
        category_primary: state.editForm.categoryPrimary || undefined,
        category_secondary: state.editForm.categorySecondary || undefined,
        style_tags: parseCsvInput(state.editForm.styleTags),
        color_tags: parseCsvInput(state.editForm.colorTags),
        source_type: state.editForm.sourceType,
        applicable_categories: parseCsvInput(state.editForm.applicableCategories),
        applicable_parts: parseCsvInput(state.editForm.applicableParts),
        process_direction: state.editForm.processDirection,
        maintenance_status: state.editForm.maintenanceStatus as PatternAsset['maintenance_status'],
        manual_review_conclusion: state.editForm.manualReviewConclusion,
        review_comment: state.editForm.reviewComment,
        updatedBy: '档案管理员',
        license: {
          license_status: state.editForm.licenseStatus as PatternLicenseStatus,
          license_scope: state.editForm.licenseScope,
          effective_at: state.editForm.effectiveAt || undefined,
          expired_at: state.editForm.expiredAt || undefined,
          risk_note: state.editForm.riskNote,
        },
      })
      syncState(asset.id)
      state.notice = '基础信息已保存。'
    } catch (error) {
      state.notice = error instanceof Error ? error.message : '保存失败，请重试。'
    }
    return true
  }

  if (action === 'submit-review') {
    try {
      const asset = submitPatternAssetReview(state.assetId, '档案管理员')
      syncState(asset.id)
      state.notice = '已提交审核，等待审核处理。'
    } catch (error) {
      state.notice = error instanceof Error ? error.message : '提交审核失败'
    }
    return true
  }

  if (action === 'approve') {
    const asset = approvePatternAsset(state.assetId, '审核专员')
    syncState(asset.id)
    state.notice = '审核已通过。'
    return true
  }

  if (action === 'reject') {
    const asset = rejectPatternAsset(state.assetId, '审核专员', '当前识别结果或授权信息待补充，已驳回。')
    syncState(asset.id)
    state.notice = '已驳回当前花型。'
    return true
  }

  if (action === 'disable') {
    const asset = disablePatternAsset(state.assetId, '档案管理员')
    syncState(asset.id)
    state.notice = '花型已停用。'
    return true
  }

  if (action === 'restore') {
    const asset = restorePatternAsset(state.assetId, '档案管理员')
    syncState(asset.id)
    state.notice = '花型已恢复。'
    return true
  }

  if (action === 'archive') {
    const asset = archivePatternAsset(state.assetId, '档案管理员')
    syncState(asset.id)
    state.notice = '花型已归档。'
    return true
  }

  if (action === 'upload-version-file') {
    const file = (actionNode as HTMLInputElement).files?.[0]
    if (!file) return true
    state.versionParsing = true
    state.versionError = null
    requestRender()
    void PatternParseService.parseFile(file)
      .then((parsedFile) => persistPatternParsedFile(parsedFile))
      .then(async (parsedFile) => {
        const asset = createPatternVersion({
          assetId: state.assetId,
          parsedFile,
          updatedBy: '档案管理员',
        })
        await waitForPatternLibraryPersistence()
        revokePreviewUrls()
        syncState(asset.id)
        state.notice = `已新增版本 ${asset.currentVersion?.version_no ?? ''}。`
      })
      .catch((error) => {
        state.versionError = error instanceof Error ? error.message : '新增版本失败'
      })
      .finally(() => {
        state.versionParsing = false
        requestRender()
      })
    return true
  }

  return false
}

export function handlePcsPatternLibraryDetailInput(target: Element): boolean {
  const field = (target as HTMLElement).dataset.patternLibraryDetailField
  if (!field) return false
  const value = (target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
  if (field === 'categoryPrimary') {
    state.editForm.categoryPrimary = value
    const secondaryOptions = getPatternCategorySecondaryList(value)
    if (!secondaryOptions.includes(state.editForm.categorySecondary)) {
      state.editForm.categorySecondary = ''
    }
    return true
  }
  if (field === 'categorySecondary') {
    state.editForm.categorySecondary = value
    return true
  }
  state.editForm[field as keyof typeof state.editForm] = value
  return true
}

export function isPcsPatternLibraryDetailDialogOpen(): boolean {
  return false
}
