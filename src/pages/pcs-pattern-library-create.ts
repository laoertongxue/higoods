import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  createPatternAsset,
  persistPatternParsedFile,
  getPatternLibraryConfig,
  getPatternTaskSummary,
  listPatternDuplicateCandidates,
  waitForPatternLibraryPersistence,
  type PatternAssetDraftInput,
  type PatternDuplicateCandidate,
} from '../data/pcs-pattern-library'
import {
  getPatternSimilarityStatusText,
  PatternParseService,
  validatePatternSubmitEligibility,
} from '../utils/pcs-pattern-library-services'
import type { PatternParsedFileResult } from '../data/pcs-pattern-library-types'

interface PatternLibraryCreateState {
  mode: 'single' | 'batch'
  file: File | null
  parsedFile: PatternParsedFileResult | null
  duplicateCandidates: PatternDuplicateCandidate[]
  duplicateAction: 'force-new' | 'new-version' | 'merge'
  duplicateTargetAssetId: string
  parseError: string | null
  parsing: boolean
  batchFiles: Array<{ file: File; parsedFile: PatternParsedFileResult | null; error: string | null }>
  batchParsing: boolean
  submitting: boolean
  notice: string | null
  form: {
    patternName: string
    aliases: string
    usageType: string
    category: string
    styleTags: string
    primaryColors: string
    secondaryColors: string
    hotFlag: string
    sourceType: string
    sourceNote: string
    remark: string
    applicableCategories: string
    applicableParts: string
    relatedPartTemplateIds: string
    processDirection: string
    licenseStatus: string
    copyrightOwner: string
    licenseOwner: string
    licenseScope: string
    effectiveAt: string
    expiredAt: string
    attachmentUrls: string
    riskNote: string
    maintenanceStatus: string
    manualReviewConclusion: string
    reviewComment: string
    sourceTaskId: string
    sourceProjectId: string
  }
}

const APP_RENDER_EVENT = 'higood:request-render'
const SINGLE_UPLOAD_INPUT_ID = 'pcs-pattern-library-single-upload'
const BATCH_UPLOAD_INPUT_ID = 'pcs-pattern-library-batch-upload'
const FLASH_NOTICE_KEY = 'pcs_pattern_library_flash_notice'

const state: PatternLibraryCreateState = {
  mode: 'single',
  file: null,
  parsedFile: null,
  duplicateCandidates: [],
  duplicateAction: 'force-new',
  duplicateTargetAssetId: '',
  parseError: null,
  parsing: false,
  batchFiles: [],
  batchParsing: false,
  submitting: false,
  notice: null,
  form: {
    patternName: '',
    aliases: '',
    usageType: '重复花',
    category: '花卉',
    styleTags: '',
    primaryColors: '',
    secondaryColors: '',
    hotFlag: '否',
    sourceType: '自研',
    sourceNote: '',
    remark: '',
    applicableCategories: '',
    applicableParts: '',
    relatedPartTemplateIds: '',
    processDirection: '印花',
    licenseStatus: 'unverified',
    copyrightOwner: '',
    licenseOwner: '',
    licenseScope: '',
    effectiveAt: '',
    expiredAt: '',
    attachmentUrls: '',
    riskNote: '',
    maintenanceStatus: '待补录',
    manualReviewConclusion: '',
    reviewComment: '',
    sourceTaskId: '',
    sourceProjectId: '',
  },
}

function requestRender(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(APP_RENDER_EVENT))
  }
}

function setFlashNotice(message: string): void {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem(FLASH_NOTICE_KEY, message)
  }
}

function revokeObjectUrl(url?: string): void {
  if (url && url.startsWith('blob:')) {
    URL.revokeObjectURL(url)
  }
}

function attachPreviewUrls(parsedFile: PatternParsedFileResult): PatternParsedFileResult {
  return {
    ...parsedFile,
    previewUrl: parsedFile.previewBlob ? URL.createObjectURL(parsedFile.previewBlob) : undefined,
    thumbnailUrl: parsedFile.thumbnailBlob ? URL.createObjectURL(parsedFile.thumbnailBlob) : undefined,
  }
}

function releaseParsedFileUrls(parsedFile: PatternParsedFileResult | null): void {
  if (!parsedFile) return
  revokeObjectUrl(parsedFile.previewUrl)
  revokeObjectUrl(parsedFile.thumbnailUrl)
}

function clearUploadInputs(): void {
  if (typeof document === 'undefined') return
  const singleInput = document.getElementById(SINGLE_UPLOAD_INPUT_ID) as HTMLInputElement | null
  const batchInput = document.getElementById(BATCH_UPLOAD_INPUT_ID) as HTMLInputElement | null
  if (singleInput) singleInput.value = ''
  if (batchInput) batchInput.value = ''
}

function focusCreateField(field: string): void {
  if (typeof document === 'undefined') return
  const node = document.querySelector<HTMLElement>(`[data-pattern-library-create-field="${field}"]`)
  node?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  node?.focus()
}

function getStatusBannerText(): string {
  if (state.submitting) {
    return '正在保存，请稍候'
  }
  if (state.parsing || state.batchParsing) {
    return '解析中'
  }
  if (state.mode === 'batch') {
    if (state.batchFiles.length === 0) return '待上传并解析'
    const successCount = state.batchFiles.filter((item) => item.parsedFile?.parseStatus === 'success').length
    const failedCount = state.batchFiles.filter((item) => item.parsedFile?.parseStatus === 'failed' || item.error).length
    if (failedCount > 0 && successCount === 0) return '解析失败，请重试'
    if (successCount > 0) return '已完成解析，可保存草稿或提交审核'
    return '解析中'
  }
  if (!state.parsedFile) return '待上传并解析'
  if (state.parsedFile.parseStatus === 'failed') return '解析失败，请重试'
  if (state.parsedFile.parseStatus === 'success') return '已完成解析，可保存草稿或提交审核'
  return '待上传并解析'
}

function parseCsvInput(value: string): string[] {
  return value
    .split(/[，,、/]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function readQueryParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const search = pathname.includes('?') ? pathname.slice(pathname.indexOf('?')) : ''
  return new URLSearchParams(search)
}

function syncModeFromQuery(): void {
  const query = readQueryParams()
  state.mode = query.get('mode') === 'batch' ? 'batch' : 'single'
  const sourceTaskId = query.get('sourceTaskId') || ''
  const sourceSummary = sourceTaskId ? getPatternTaskSummary(sourceTaskId) : null
  if (sourceTaskId && state.form.sourceTaskId !== sourceTaskId) {
    state.form.sourceTaskId = sourceTaskId
    state.form.sourceProjectId = sourceSummary?.projectId ?? ''
    state.form.sourceNote = sourceSummary ? `来源任务：${sourceSummary.name}` : state.form.sourceNote
  }
}

function resetSingleUpload(): void {
  releaseParsedFileUrls(state.parsedFile)
  state.file = null
  state.parsedFile = null
  state.duplicateCandidates = []
  state.duplicateAction = 'force-new'
  state.duplicateTargetAssetId = ''
  state.parseError = null
  clearUploadInputs()
}

function getCreateDefaultsFromParsed(parsedFile: PatternParsedFileResult): void {
  if (!state.form.patternName) state.form.patternName = parsedFile.originalFilename.replace(/\.[^.]+$/, '')
  if (!state.form.primaryColors) state.form.primaryColors = parsedFile.dominantColors.join(' / ')
}

async function parseSingleFile(file: File): Promise<void> {
  releaseParsedFileUrls(state.parsedFile)
  state.file = file
  state.parsing = true
  state.parseError = null
  state.parsedFile = null
  state.notice = null
  requestRender()

  try {
    const parsedFile = attachPreviewUrls(await PatternParseService.parseFile(file))
    state.parsedFile = parsedFile
    state.parseError = parsedFile.parseErrorMessage ?? null
    state.duplicateCandidates = parsedFile.parseStatus === 'success' ? listPatternDuplicateCandidates(parsedFile) : []
    state.duplicateTargetAssetId = state.duplicateCandidates[0]?.asset.id ?? ''
    if (parsedFile.parseStatus === 'success') {
      getCreateDefaultsFromParsed(parsedFile)
    }
  } catch (error) {
    state.parseError = error instanceof Error ? error.message : '文件解析失败'
  } finally {
    state.parsing = false
    requestRender()
  }
}

async function parseBatchFiles(files: File[]): Promise<void> {
  state.batchParsing = true
  state.notice = null
  state.batchFiles = files.map((file) => ({ file, parsedFile: null, error: null }))
  requestRender()

  for (let index = 0; index < state.batchFiles.length; index += 1) {
    try {
      const parsedFile = await PatternParseService.parseFile(state.batchFiles[index].file)
      state.batchFiles[index].parsedFile = parsedFile
      state.batchFiles[index].error = parsedFile.parseStatus === 'failed' ? parsedFile.parseErrorMessage ?? '解析失败' : null
    } catch (error) {
      state.batchFiles[index].error = error instanceof Error ? error.message : '解析失败'
    }
    requestRender()
  }

  state.batchParsing = false
  requestRender()
}

function buildDraftInput(parsedFile: PatternParsedFileResult, submitForReview: boolean): PatternAssetDraftInput {
  return {
    patternName: state.form.patternName,
    aliases: parseCsvInput(state.form.aliases),
    usageType: state.form.usageType,
    category: state.form.category,
    styleTags: parseCsvInput(state.form.styleTags),
    colorTags: parseCsvInput(`${state.form.primaryColors}${state.form.secondaryColors ? `,${state.form.secondaryColors}` : ''}`),
    hotFlag: state.form.hotFlag === '是',
    sourceType: state.form.sourceType,
    sourceNote: [state.form.sourceNote, state.form.remark].filter(Boolean).join('；'),
    applicableCategories: parseCsvInput(state.form.applicableCategories),
    applicableParts: parseCsvInput(state.form.applicableParts),
    relatedPartTemplateIds: parseCsvInput(state.form.relatedPartTemplateIds),
    processDirection: state.form.processDirection,
    maintenanceStatus: state.form.maintenanceStatus as PatternAssetDraftInput['maintenanceStatus'],
    manualReviewConclusion: state.form.manualReviewConclusion,
    reviewComment: state.form.reviewComment,
    sourceTaskId: state.form.sourceTaskId || undefined,
    sourceProjectId: state.form.sourceProjectId || undefined,
    createdBy: '档案管理员',
    submitForReview,
    parsedFile,
    duplicateAction: state.duplicateAction,
    duplicateTargetAssetId: state.duplicateTargetAssetId || undefined,
    license: {
      license_status: state.form.licenseStatus as PatternAssetDraftInput['license']['license_status'],
      copyright_owner: state.form.copyrightOwner,
      license_owner: state.form.licenseOwner,
      license_scope: state.form.licenseScope,
      effective_at: state.form.effectiveAt || undefined,
      expired_at: state.form.expiredAt || undefined,
      attachment_urls: parseCsvInput(state.form.attachmentUrls),
      risk_note: state.form.riskNote,
    },
  }
}

async function handleSave(submitForReview: boolean): Promise<boolean> {
  state.notice = null

  if (state.mode === 'batch') {
    const validFiles = state.batchFiles.filter((item) => item.parsedFile)
    if (validFiles.length === 0) {
      state.notice = '请先上传并解析至少一个花型文件。'
      return true
    }
    if (submitForReview && validFiles.some((item) => item.parsedFile?.parseStatus !== 'success')) {
      state.notice = '批量提交审核前，请先处理解析失败的花型文件。'
      return true
    }

    try {
      state.submitting = true
      requestRender()
      for (let index = 0; index < validFiles.length; index += 1) {
        const item = validFiles[index]
        const baseName = item.parsedFile?.originalFilename.replace(/\.[^.]+$/, '') ?? `批量花型${index + 1}`
        const persistedParsedFile = await persistPatternParsedFile(item.parsedFile!)
        const draft = buildDraftInput(persistedParsedFile, submitForReview)
        draft.patternName = state.form.patternName ? `${state.form.patternName}-${index + 1}` : baseName
        draft.duplicateAction = 'force-new'
        draft.duplicateTargetAssetId = undefined
        createPatternAsset(draft)
      }
      await waitForPatternLibraryPersistence()
      setFlashNotice(submitForReview ? `已提交 ${validFiles.length} 条花型记录审核。` : `已保存 ${validFiles.length} 条花型草稿。`)
      appStore.navigate('/pcs/pattern-library')
    } catch (error) {
      state.notice = error instanceof Error ? error.message : '批量保存失败，请重试。'
    } finally {
      state.submitting = false
      requestRender()
    }
    return true
  }

  if (!state.parsedFile) {
    state.notice = '请先上传并完成解析。'
    return true
  }

  const validation = validatePatternSubmitEligibility({
    patternName: state.form.patternName,
    parseStatus: submitForReview ? state.parsedFile.parseStatus : 'success',
  })
  if (!validation.valid) {
    state.notice = validation.message
    if (validation.field) focusCreateField(validation.field)
    return true
  }

  try {
    state.submitting = true
    requestRender()
    const persistedParsedFile = await persistPatternParsedFile(state.parsedFile)
    const asset = createPatternAsset(buildDraftInput(persistedParsedFile, submitForReview))
    await waitForPatternLibraryPersistence()
    setFlashNotice(submitForReview ? '已提交审核，等待审核处理。' : '草稿已保存。')
    appStore.navigate(`/pcs/pattern-library/${asset.id}`)
  } catch (error) {
    state.notice = error instanceof Error ? error.message : '保存失败，请重试。'
  } finally {
    state.submitting = false
    requestRender()
  }
  return true
}

function renderNotice(): string {
  if (!state.notice) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-blue-700">${escapeHtml(state.notice)}</p>
        <button class="h-8 rounded-md border border-blue-300 px-3 text-xs text-blue-700 hover:bg-blue-100" data-pattern-library-create-action="close-notice">知道了</button>
      </div>
    </section>
  `
}

function renderSourceTaskCard(): string {
  if (!state.form.sourceTaskId) return ''
  const task = getPatternTaskSummary(state.form.sourceTaskId)
  if (!task) return ''
  return `
    <section class="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <p class="text-xs text-blue-700">来源任务</p>
      <p class="mt-1 text-sm font-medium text-blue-900">${escapeHtml(task.name)}</p>
      <p class="mt-1 text-xs text-blue-700">${escapeHtml(task.id)}｜项目：${escapeHtml(task.projectName)}</p>
    </section>
  `
}

function renderDuplicateCandidates(): string {
  if (!state.parsedFile) return ''
  const similarityText = getPatternSimilarityStatusText(state.parsedFile.phash, state.duplicateCandidates.length)
  if (state.duplicateCandidates.length === 0) {
    return `
      <section class="rounded-lg border ${state.parsedFile.phash ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'} p-4">
        <p class="text-sm font-medium ${state.parsedFile.phash ? 'text-emerald-800' : 'text-amber-900'}">${escapeHtml(similarityText)}</p>
        <p class="mt-1 text-xs ${state.parsedFile.phash ? 'text-emerald-700' : 'text-amber-700'}">${state.parsedFile.phash ? '当前文件可直接新建为独立花型主档。' : '当前仅完成基础解析，视觉相似检测待补算。'}</p>
      </section>
    `
  }

  return `
    <section class="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
      <div>
        <p class="text-sm font-medium text-amber-900">疑似重复检测</p>
        <p class="mt-1 text-xs text-amber-700">支持选择“合并到已有主档 / 作为已有主档新版本 / 强制新建”。</p>
      </div>
      <div class="flex flex-wrap gap-2">
        ${[
          { value: 'merge', label: '合并到已有主档' },
          { value: 'new-version', label: '作为已有主档新版本' },
          { value: 'force-new', label: '强制新建' },
        ]
          .map((item) => `<button class="h-8 rounded-md px-3 text-xs ${state.duplicateAction === item.value ? 'bg-amber-600 text-white' : 'border border-amber-300 hover:bg-white'}" data-pattern-library-create-action="set-duplicate-action" data-duplicate-action="${item.value}">${item.label}</button>`)
          .join('')}
      </div>
      <div class="space-y-2">
        ${state.duplicateCandidates
          .map(
            (item) => `
              <label class="flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3">
                <input type="radio" name="duplicate-target" class="mt-1 h-4 w-4" value="${item.asset.id}" ${state.duplicateTargetAssetId === item.asset.id ? 'checked' : ''} data-pattern-library-create-action="choose-duplicate-target" data-duplicate-target="${item.asset.id}" />
                <div class="flex-1">
                  <p class="text-sm font-medium">${escapeHtml(item.asset.pattern_name)}</p>
                  <p class="mt-1 text-xs text-gray-500">${escapeHtml(item.asset.pattern_code)}｜${escapeHtml(item.version.version_no)}</p>
                  <p class="mt-1 text-xs text-amber-700">${item.hit.duplicateType === 'sha256' ? '完全重复（sha256 命中）' : `视觉相似（pHash 距离 ${item.hit.distance}）`}｜相似度 ${Math.round(item.hit.similarity * 100)}%</p>
                </div>
              </label>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

function renderSinglePreview(): string {
  if (state.parseError && !state.parsedFile) {
    return `<div class="flex h-[420px] items-center justify-center rounded-lg border border-dashed text-sm text-rose-600">${escapeHtml(state.parseError)}</div>`
  }

  if (state.parsing) {
    return `<div class="flex h-[420px] items-center justify-center rounded-lg border border-dashed text-sm text-gray-500">正在解析文件，请稍候...</div>`
  }

  if (!state.parsedFile) {
    return `<div class="flex h-[420px] items-center justify-center rounded-lg border border-dashed text-sm text-gray-400">上传 JPG / JPEG / PNG / TIF / TIFF 后在这里预览与解析。</div>`
  }

  return `
    <div class="space-y-3">
      <div class="flex h-[420px] items-center justify-center overflow-hidden rounded-lg border bg-slate-50 p-4">
        ${
          state.parsedFile.previewUrl
            ? `<img src="${state.parsedFile.previewUrl}" alt="${escapeHtml(state.parsedFile.originalFilename)}" class="max-h-full max-w-full object-contain" />`
            : state.parsedFile.parseStatus === 'success'
              ? '<span class="text-sm text-gray-400">预览生成中</span>'
              : `<div class="space-y-3 text-center"><p class="text-sm text-rose-600">${escapeHtml(state.parsedFile.parseErrorMessage ?? state.parseError ?? '预览生成失败')}</p><button class="h-9 rounded-md border px-4 text-sm hover:bg-white" data-pattern-library-create-action="retry-parse">重新解析</button></div>`
        }
      </div>
      <div class="rounded-lg border bg-white p-4">
        <div class="grid gap-3 md:grid-cols-2">
          <div>
            <p class="text-xs text-gray-500">解析摘要</p>
            <p class="mt-1 text-sm font-medium">${escapeHtml(state.parsedFile.parseSummary)}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">文件名 Token</p>
            <div class="mt-1 flex flex-wrap gap-1">
              ${state.parsedFile.filenameTokens.map((token) => `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs">${escapeHtml(token.token)}</span>`).join('')}
            </div>
          </div>
          <div>
            <p class="text-xs text-gray-500">主色系建议</p>
            <p class="mt-1 text-sm">${escapeHtml(state.parsedFile.dominantColors.join(' / ') || '待计算')}</p>
          </div>
          <div>
            <p class="text-xs text-gray-500">摘要指标</p>
            <p class="mt-1 text-sm">宽高：${state.parsedFile.imageWidth ?? '-'} x ${state.parsedFile.imageHeight ?? '-'}｜${escapeHtml(state.parsedFile.phash ? `pHash：${state.parsedFile.phash.slice(0, 16)}` : '视觉相似检测未完成')}</p>
          </div>
        </div>
      </div>
    </div>
  `
}

function renderBatchPreview(): string {
  return `
    <div class="space-y-3">
      <div class="flex min-h-[180px] items-center justify-center rounded-lg border border-dashed bg-slate-50 p-4 text-sm text-gray-500">
        批量模式会逐个解析上传文件，并按当前表单公共字段批量入草稿。
      </div>
      <div class="space-y-2">
        ${state.batchFiles.length === 0 ? '<div class="rounded-lg border border-dashed p-4 text-sm text-gray-400">当前还没有批量文件。</div>' : state.batchFiles
          .map((item, index) => `
            <article class="rounded-lg border bg-white p-3">
              <div class="flex items-start justify-between gap-3">
                <div>
            <p class="text-sm font-medium">${index + 1}. ${escapeHtml(item.file.name)}</p>
                  <p class="mt-1 text-xs text-gray-500">${item.parsedFile ? escapeHtml(item.parsedFile.parseSummary) : item.error ? escapeHtml(item.error) : '等待解析'}</p>
                </div>
                <span class="rounded-full px-2 py-0.5 text-xs ${item.parsedFile?.parseStatus === 'success' ? 'bg-emerald-100 text-emerald-700' : item.error || item.parsedFile?.parseStatus === 'failed' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-700'}">${item.parsedFile?.parseStatus === 'success' ? '解析成功' : item.error || item.parsedFile?.parseStatus === 'failed' ? '解析失败' : '解析中'}</span>
              </div>
            </article>
          `)
          .join('')}
      </div>
    </div>
  `
}

function renderUploadControls(): string {
  const inputId = state.mode === 'batch' ? BATCH_UPLOAD_INPUT_ID : SINGLE_UPLOAD_INPUT_ID
  const selectedLabel =
    state.mode === 'batch'
      ? state.batchFiles.length > 0
        ? `已选择 ${state.batchFiles.length} 个文件`
        : '未选择任何文件'
      : state.file?.name ?? state.parsedFile?.originalFilename ?? '未选择任何文件'

  return `
    <div class="space-y-3">
      <input
        id="${inputId}"
        type="file"
        class="sr-only"
        accept=".jpg,.jpeg,.png,.tif,.tiff"
        ${state.mode === 'batch' ? 'multiple' : ''}
        data-pattern-library-create-action="${state.mode === 'batch' ? 'select-batch-files' : 'select-file'}"
      />

      <div class="flex flex-wrap items-center gap-2">
        <label for="${inputId}" class="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-4 text-sm hover:bg-gray-50">
          <i data-lucide="upload" class="h-4 w-4"></i>
          ${state.mode === 'batch' ? '选择多个花型文件' : '选择花型文件'}
        </label>
        <button class="h-9 rounded-md border px-3 text-sm hover:bg-gray-50" data-pattern-library-create-action="reset-upload">清空已上传文件</button>
        <button class="h-9 rounded-md border px-3 text-sm hover:bg-gray-50" data-pattern-library-create-action="go-config">配置规则</button>
      </div>

      <label for="${inputId}" class="block cursor-pointer rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:border-blue-300 hover:bg-blue-50/40">
        <div class="flex min-h-[120px] flex-col items-center justify-center text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
            <i data-lucide="${state.mode === 'batch' ? 'files' : 'image-plus'}" class="h-6 w-6 text-blue-600"></i>
          </div>
          <p class="mt-4 text-sm font-medium text-slate-800">${state.mode === 'batch' ? '点击此处批量上传花型文件' : '点击此处上传花型文件'}</p>
          <p class="mt-1 text-xs text-slate-500">支持 JPG / JPEG / PNG / TIF / TIFF${state.mode === 'batch' ? '，选择后逐个自动解析' : '，选择后自动解析与重复检测'}</p>
          <p class="mt-2 rounded-full bg-white px-3 py-1 text-xs text-slate-600">当前选择：${escapeHtml(selectedLabel)}</p>
        </div>
      </label>
    </div>
  `
}

function renderForm(): string {
  const config = getPatternLibraryConfig()
  return `
    <div class="space-y-6">
      <section class="space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4">
          <div>
            <p class="text-xs text-gray-500">状态条</p>
            <p class="mt-1 text-sm font-medium">${getStatusBannerText()}</p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="h-9 rounded-md border px-3 text-sm hover:bg-gray-50 ${state.submitting ? 'pointer-events-none opacity-60' : ''}" data-pattern-library-create-action="save-draft">${state.submitting ? '保存中...' : '保存草稿'}</button>
            <button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white hover:bg-blue-700 ${state.submitting ? 'pointer-events-none opacity-60' : ''}" data-pattern-library-create-action="submit-review">${state.submitting ? '提交中...' : state.mode === 'batch' ? '批量提交审核' : '提交审核'}</button>
          </div>
        </div>

        ${renderSourceTaskCard()}
        ${renderNotice()}

        <div class="grid gap-4 xl:grid-cols-12">
          <div class="space-y-4 xl:col-span-5">
            <section class="rounded-lg border bg-white p-4">
              <div class="flex items-center justify-between gap-3">
                <div>
              <h3 class="text-base font-semibold">上传与预览区</h3>
                  <p class="mt-1 text-xs text-gray-500">${state.mode === 'batch' ? '支持多文件批量上传。' : '支持单文件上传，自动抽取元数据并生成浏览器内预览。'}</p>
                </div>
                <div class="flex items-center gap-2">
                  <button class="h-8 rounded-md px-3 text-xs ${state.mode === 'single' ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'}" data-pattern-library-create-action="switch-mode" data-mode="single">单文件模式</button>
                  <button class="h-8 rounded-md px-3 text-xs ${state.mode === 'batch' ? 'bg-slate-900 text-white' : 'border hover:bg-gray-50'}" data-pattern-library-create-action="switch-mode" data-mode="batch">批量模式</button>
                </div>
              </div>
              <div class="mt-4">${renderUploadControls()}</div>
              <div class="mt-4">
                ${state.mode === 'batch' ? renderBatchPreview() : renderSinglePreview()}
              </div>
            </section>

            ${state.mode === 'single' ? renderDuplicateCandidates() : ''}
          </div>

          <div class="space-y-4 xl:col-span-7">
            <section class="rounded-lg border bg-white p-4">
              <h3 class="text-base font-semibold">一、基础信息</h3>
              <div class="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label class="mb-1 block text-sm font-medium">花型名称 <span class="text-rose-500">*</span></label>
                  <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.form.patternName)}" data-pattern-library-create-field="patternName" />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">花型编号</label>
                  <div class="flex h-10 items-center rounded-md border bg-slate-50 px-3 text-sm text-gray-500">系统保存后自动生成</div>
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">原文件名</label>
                  <div class="flex h-10 items-center rounded-md border bg-slate-50 px-3 text-sm text-gray-500">${escapeHtml(state.parsedFile?.originalFilename ?? '待上传')}</div>
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">别名/历史名称</label>
                  <input class="h-10 w-full rounded-md border px-3 text-sm" placeholder="多个值用逗号分隔" value="${escapeHtml(state.form.aliases)}" data-pattern-library-create-field="aliases" />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">花型使用方式 <span class="text-rose-500">*</span></label>
                  <select class="h-10 w-full rounded-md border px-3 text-sm" data-pattern-library-create-field="usageType">
                    ${config.usageTypes.map((item) => `<option value="${item}" ${state.form.usageType === item ? 'selected' : ''}>${item}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">题材分类 <span class="text-rose-500">*</span></label>
                  <select class="h-10 w-full rounded-md border px-3 text-sm" data-pattern-library-create-field="category">
                    ${config.categories.map((item) => `<option value="${item}" ${state.form.category === item ? 'selected' : ''}>${item}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">风格标签</label>
                  <input class="h-10 w-full rounded-md border px-3 text-sm" placeholder="多个值用逗号分隔" value="${escapeHtml(state.form.styleTags)}" data-pattern-library-create-field="styleTags" />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">主色系/辅色系</label>
                  <div class="grid grid-cols-2 gap-2">
                    <input class="h-10 w-full rounded-md border px-3 text-sm" placeholder="主色系" value="${escapeHtml(state.form.primaryColors)}" data-pattern-library-create-field="primaryColors" />
                    <input class="h-10 w-full rounded-md border px-3 text-sm" placeholder="辅色系" value="${escapeHtml(state.form.secondaryColors)}" data-pattern-library-create-field="secondaryColors" />
                  </div>
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">是否爆款</label>
                  <select class="h-10 w-full rounded-md border px-3 text-sm" data-pattern-library-create-field="hotFlag">
                    ${['是', '否'].map((value) => `<option value="${value}" ${state.form.hotFlag === value ? 'selected' : ''}>${value}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">来源类型 <span class="text-rose-500">*</span></label>
                  <select class="h-10 w-full rounded-md border px-3 text-sm" data-pattern-library-create-field="sourceType">
                    ${config.sourceTypes.map((item) => `<option value="${item}" ${state.form.sourceType === item ? 'selected' : ''}>${item}</option>`).join('')}
                  </select>
                </div>
                <div class="md:col-span-2">
                  <label class="mb-1 block text-sm font-medium">来源说明 / 备注</label>
                  <textarea class="min-h-[72px] w-full rounded-md border px-3 py-2 text-sm" data-pattern-library-create-field="sourceNote">${escapeHtml(state.form.sourceNote)}</textarea>
                </div>
              </div>
            </section>

            <section class="rounded-lg border bg-white p-4">
              <h3 class="text-base font-semibold">二、业务适配信息</h3>
              <div class="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label class="mb-1 block text-sm font-medium">适用品类</label>
                  <input class="h-10 w-full rounded-md border px-3 text-sm" placeholder="例如：连衣裙, 衬衫" value="${escapeHtml(state.form.applicableCategories)}" data-pattern-library-create-field="applicableCategories" />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">适用部位</label>
                  <input class="h-10 w-full rounded-md border px-3 text-sm" placeholder="例如：前片, 袖口" value="${escapeHtml(state.form.applicableParts)}" data-pattern-library-create-field="applicableParts" />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">关联部位模板</label>
                  <input class="h-10 w-full rounded-md border px-3 text-sm" placeholder="输入模板包/模板记录 ID" value="${escapeHtml(state.form.relatedPartTemplateIds)}" data-pattern-library-create-field="relatedPartTemplateIds" />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">工艺方向</label>
                  <select class="h-10 w-full rounded-md border px-3 text-sm" data-pattern-library-create-field="processDirection">
                    ${['印花', '绣花', '其他'].map((item) => `<option value="${item}" ${state.form.processDirection === item ? 'selected' : ''}>${item}</option>`).join('')}
                  </select>
                </div>
              </div>
            </section>

            <section class="rounded-lg border bg-white p-4">
              <h3 class="text-base font-semibold">三、授权与版权</h3>
              <div class="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label class="mb-1 block text-sm font-medium">授权状态</label>
                  <select class="h-10 w-full rounded-md border px-3 text-sm" data-pattern-library-create-field="licenseStatus">
                    ${getPatternLibraryConfig().licenseStatuses.map((item) => `<option value="${item.value}" ${state.form.licenseStatus === item.value ? 'selected' : ''}>${item.label}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">版权归属</label>
                  <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.form.copyrightOwner)}" data-pattern-library-create-field="copyrightOwner" />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">授权主体</label>
                  <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.form.licenseOwner)}" data-pattern-library-create-field="licenseOwner" />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">授权范围</label>
                  <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.form.licenseScope)}" data-pattern-library-create-field="licenseScope" />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">生效时间</label>
                  <input type="date" class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.form.effectiveAt)}" data-pattern-library-create-field="effectiveAt" />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">截止时间</label>
                  <input type="date" class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.form.expiredAt)}" data-pattern-library-create-field="expiredAt" />
                </div>
                <div class="md:col-span-2">
                  <label class="mb-1 block text-sm font-medium">授权附件</label>
                  <input class="h-10 w-full rounded-md border px-3 text-sm" placeholder="多个附件名称用逗号分隔" value="${escapeHtml(state.form.attachmentUrls)}" data-pattern-library-create-field="attachmentUrls" />
                </div>
                <div class="md:col-span-2">
                  <label class="mb-1 block text-sm font-medium">风险备注</label>
                  <textarea class="min-h-[72px] w-full rounded-md border px-3 py-2 text-sm" data-pattern-library-create-field="riskNote">${escapeHtml(state.form.riskNote)}</textarea>
                </div>
              </div>
            </section>

            <section class="rounded-lg border bg-white p-4">
              <h3 class="text-base font-semibold">四、治理信息</h3>
              <div class="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <label class="mb-1 block text-sm font-medium">维护状态</label>
                  <select class="h-10 w-full rounded-md border px-3 text-sm" data-pattern-library-create-field="maintenanceStatus">
                    ${['待补录', '已维护', '已治理'].map((item) => `<option value="${item}" ${state.form.maintenanceStatus === item ? 'selected' : ''}>${item}</option>`).join('')}
                  </select>
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">标签来源与置信度</label>
                  <div class="flex min-h-[40px] items-center rounded-md border bg-slate-50 px-3 text-sm text-gray-500">上传解析后自动生成，详情页可查看完整记录</div>
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">人工确认结论</label>
                  <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.form.manualReviewConclusion)}" data-pattern-library-create-field="manualReviewConclusion" />
                </div>
                <div>
                  <label class="mb-1 block text-sm font-medium">审核意见</label>
                  <input class="h-10 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.form.reviewComment)}" data-pattern-library-create-field="reviewComment" />
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>

      <section class="grid gap-4 xl:grid-cols-3">
        <article class="rounded-lg border bg-white p-4 xl:col-span-2">
          <h3 class="text-base font-semibold">相似花型</h3>
          <div class="mt-3 space-y-2">
            ${
              state.duplicateCandidates.length === 0
                ? `<p class="text-sm text-gray-500">${escapeHtml(getPatternSimilarityStatusText(state.parsedFile?.phash, 0))}</p>`
                : state.duplicateCandidates.slice(0, 3).map((item) => `
                    <div class="rounded-lg border bg-slate-50 p-3">
                      <p class="text-sm font-medium">${escapeHtml(item.asset.pattern_name)}</p>
                      <p class="mt-1 text-xs text-gray-500">${escapeHtml(item.asset.pattern_code)}｜${item.hit.duplicateType === 'sha256' ? '完全重复' : `pHash 距离 ${item.hit.distance}`}</p>
                    </div>
                  `).join('')
            }
          </div>
        </article>
        <article class="rounded-lg border bg-white p-4">
          <h3 class="text-base font-semibold">版本信息</h3>
          <div class="mt-3 space-y-1 text-sm text-gray-600">
            <p>当前待保存版本：${state.mode === 'batch' ? `批量 ${state.batchFiles.filter((item) => item.parsedFile).length} 个` : 'V1'}</p>
            <p>原文件：${escapeHtml(state.parsedFile?.originalFilename ?? '待上传')}</p>
            <p>解析状态：${escapeHtml(state.parsedFile?.parseStatus === 'success' ? '解析成功' : state.parsedFile?.parseStatus === 'failed' ? '解析失败' : '待解析')}</p>
          </div>
        </article>
        <article class="rounded-lg border bg-white p-4 xl:col-span-3">
          <h3 class="text-base font-semibold">日志摘要</h3>
          <div class="mt-3 rounded-lg border border-dashed p-4 text-sm text-gray-500">
            新建后会自动记录：新建、上传文件、自动解析结果、手工修改标签、提交审核等动作。
          </div>
        </article>
      </section>
    </div>
  `
}

export function handlePcsPatternLibraryCreateEvent(target: HTMLElement): boolean {
  syncModeFromQuery()
  const actionNode = target.closest<HTMLElement>('[data-pattern-library-create-action]')
  const action = actionNode?.dataset.patternLibraryCreateAction
  if (!actionNode || !action) return false

  if (action === 'go-config') {
    appStore.navigate('/pcs/pattern-library/config')
    return true
  }

  if (action === 'switch-mode') {
    const mode = actionNode.dataset.mode === 'batch' ? 'batch' : 'single'
    appStore.navigate(mode === 'batch' ? '/pcs/pattern-library/create?mode=batch' : '/pcs/pattern-library/create')
    return true
  }

  if (action === 'close-notice') {
    state.notice = null
    return true
  }

  if (action === 'reset-upload') {
    resetSingleUpload()
    state.batchFiles = []
    return true
  }

  if (action === 'retry-parse') {
    if (state.file) {
      void parseSingleFile(state.file)
    }
    return true
  }

  if (action === 'select-file') {
    const file = (actionNode as HTMLInputElement).files?.[0]
    if (file) {
      void parseSingleFile(file)
    }
    return true
  }

  if (action === 'select-batch-files') {
    const files = Array.from((actionNode as HTMLInputElement).files ?? [])
    if (files.length > 0) {
      void parseBatchFiles(files)
    }
    return true
  }

  if (action === 'set-duplicate-action') {
    state.duplicateAction = (actionNode.dataset.duplicateAction as PatternLibraryCreateState['duplicateAction']) || 'force-new'
    return true
  }

  if (action === 'choose-duplicate-target') {
    state.duplicateTargetAssetId = actionNode.dataset.duplicateTarget || ''
    return true
  }

  if (action === 'save-draft') {
    void handleSave(false)
    return true
  }

  if (action === 'submit-review') {
    void handleSave(true)
    return true
  }

  return false
}

export function handlePcsPatternLibraryCreateInput(target: Element): boolean {
  syncModeFromQuery()
  const field = (target as HTMLElement).dataset.patternLibraryCreateField
  if (!field) return false
  state.form[field as keyof typeof state.form] = (target as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value
  return true
}

export function isPcsPatternLibraryCreateDialogOpen(): boolean {
  return false
}

export function renderPcsPatternLibraryCreatePage(): string {
  syncModeFromQuery()
  return renderForm()
}
