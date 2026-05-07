import { escapeHtml } from '../utils'
import {
  FACTORY_ONBOARDING_NODE_OPTIONS,
  FACTORY_ONBOARDING_REQUIRED_FIELD_OPTIONS,
  FACTORY_ONBOARDING_REVIEW_RESULTS,
  FACTORY_ONBOARDING_STATUS_OPTIONS,
  normalizeReviewResult,
  type FactoryOnboardingApplication,
  type FactoryOnboardingRequiredField,
  type FactoryOnboardingReviewResult,
} from '../data/fcs/factory-onboarding-domain.ts'
import {
  FACTORY_SAMPLE_ISSUE_METHOD_OPTIONS,
  FACTORY_SAMPLE_CAPACITY_CONCLUSION_OPTIONS,
  FACTORY_SAMPLE_QUALITY_CONCLUSION_OPTIONS,
  FACTORY_SAMPLE_REVIEW_REQUIRED_ITEM_OPTIONS,
  FACTORY_SAMPLE_REVIEW_RESULT_OPTIONS,
  FACTORY_SAMPLE_VERIFICATION_PURPOSE_OPTIONS,
  normalizeSampleReviewResult,
  type FactorySampleIssuePayload,
  type FactorySampleReferenceFile,
  type FactorySampleReviewPayload,
  type FactorySampleReviewRequiredItem,
  type FactorySampleReviewResult,
} from '../data/fcs/factory-sample-verification-domain.ts'
import {
  getFactoryOnboardingCurrentNodeSummary,
  getLatestReviewRecord,
  getLatestSupplementRecord,
  listFactoryOnboardingStatusBuckets,
  listSelectableProcessCraftOptions,
  reviewFactoryOnboardingApplication,
  convertOnboardingToOfficialFactory,
} from '../data/fcs/factory-onboarding-flow.ts'
import {
  getAvailableOnboardingPpicOptions,
  listFactoryOnboardingApplications,
  updateOnboardingPpic,
} from '../data/fcs/factory-onboarding-store.ts'
import {
  createSampleIssuePayload,
  issueSampleForOnboarding,
  reviewFactorySample,
} from '../data/fcs/factory-sample-verification-flow.ts'
import {
  getSampleVerificationByApplicationId,
  getSampleVerificationById,
} from '../data/fcs/factory-sample-verification-store.ts'

interface FactoryOnboardingPageState {
  statusFilter: string
  processFilter: string
  craftFilter: string
  nodeFilter: string
  reviewResultFilter: string
  ppicFilter: string
  keyword: string
  selectedApplicationId: string | null
  detailTab: 'basic' | 'account' | 'capability' | 'machines' | 'flow' | 'review' | 'sample' | 'conversion'
  reviewApplicationId: string | null
  reviewResult: FactoryOnboardingReviewResult
  reviewOpinion: string
  reviewRequiredFields: FactoryOnboardingRequiredField[]
  sampleIssueApplicationId: string | null
  sampleIssueDraft: FactorySampleIssuePayload
  sampleIssueErrorText: string
  sampleReviewApplicationId: string | null
  sampleReviewDraft: FactorySampleReviewPayload
  sampleReviewErrorText: string
  conversionApplicationId: string | null
  conversionErrorText: string
  ppicDialogApplicationId: string | null
  ppicDraftId: string
  ppicChangeReason: string
  ppicErrorText: string
  errorText: string
  successText: string
}

const state: FactoryOnboardingPageState = {
  statusFilter: 'ALL',
  processFilter: 'ALL',
  craftFilter: 'ALL',
  nodeFilter: 'ALL',
  reviewResultFilter: 'ALL',
  ppicFilter: 'ALL',
  keyword: '',
  selectedApplicationId: null,
  detailTab: 'basic',
  reviewApplicationId: null,
  reviewResult: '已通过',
  reviewOpinion: '',
  reviewRequiredFields: [],
  sampleIssueApplicationId: null,
  sampleIssueDraft: createSampleIssuePayload(),
  sampleIssueErrorText: '',
  sampleReviewApplicationId: null,
  sampleReviewDraft: {
    sampleReviewResult: '已通过',
    sampleReviewOpinion: '',
    resubmitAllowed: false,
    requiredResubmitItems: [],
    sampleQualityConclusion: '',
    capacityConclusion: '',
    bossIdentityNo: '',
    bossIdentityFiles: [],
    remark: '',
  },
  sampleReviewErrorText: '',
  conversionApplicationId: null,
  conversionErrorText: '',
  ppicDialogApplicationId: null,
  ppicDraftId: '',
  ppicChangeReason: '',
  ppicErrorText: '',
  errorText: '',
  successText: '',
}

function createDefaultSampleReviewDraft(): FactorySampleReviewPayload {
  return {
    sampleReviewResult: '已通过',
    sampleReviewOpinion: '',
    resubmitAllowed: false,
    requiredResubmitItems: [],
    sampleQualityConclusion: '',
    capacityConclusion: '',
    bossIdentityNo: '',
    bossIdentityFiles: [],
    remark: '',
  }
}

function getCurrentSearchParams(): URLSearchParams {
  if (window.location.hash) {
    const [, hashQuery] = window.location.hash.slice(1).split('?')
    return new URLSearchParams(hashQuery || '')
  }
  return new URLSearchParams(window.location.search || '')
}

function syncDialogStateFromQuery(applications: FactoryOnboardingApplication[]): void {
  const applicationId = getCurrentSearchParams().get('applicationId')
  const dialog = getCurrentSearchParams().get('dialog')
  const detailTab = getCurrentSearchParams().get('tab')
  if (!applicationId || !dialog) return
  const application = applications.find((item) => item.applicationId === applicationId)
  if (!application) return

  if (dialog === 'detail') {
    state.selectedApplicationId = applicationId
    state.reviewApplicationId = null
    if (detailTab && ['basic', 'account', 'capability', 'machines', 'flow', 'review', 'sample', 'conversion'].includes(detailTab)) {
      state.detailTab = detailTab as FactoryOnboardingPageState['detailTab']
    }
    return
  }
  if (dialog === 'ppic') {
    const options = getAvailableOnboardingPpicOptions()
    if (state.ppicDialogApplicationId === applicationId) return
    state.ppicDialogApplicationId = applicationId
    state.ppicDraftId = application.assignedPpicId || options[0]?.ppicId || ''
    state.ppicChangeReason = ''
    state.ppicErrorText = ''
    return
  }
  if (state.selectedApplicationId || state.reviewApplicationId) return
  if (dialog === 'review') {
    if (application.status !== '待平台审核') return
    state.reviewApplicationId = applicationId
    state.reviewResult = '已通过'
    state.reviewOpinion = ''
    state.reviewRequiredFields = []
    return
  }
  if (dialog === 'sample-review') {
    if (application.status !== '待平台审核样衣') return
    if (state.sampleReviewApplicationId === applicationId) return
    state.sampleReviewApplicationId = applicationId
    state.sampleReviewDraft = createDefaultSampleReviewDraft()
    state.sampleReviewErrorText = ''
    return
  }
  if (dialog === 'sample-issue') {
    if (application.status !== '待样衣验证' || application.sampleVerificationId || getSampleVerificationForApplication(application)) return
    if (state.sampleIssueApplicationId === applicationId) return
    state.sampleIssueApplicationId = applicationId
    state.sampleIssueDraft = createSampleIssuePayload()
    state.sampleIssueErrorText = ''
    return
  }
  if (dialog === 'conversion') {
    const sampleVerification = getSampleVerificationForApplication(application)
    if (application.status !== '样衣审核通过待转正式' || sampleVerification?.status !== '样衣审核通过') return
    state.conversionApplicationId = applicationId
    state.conversionErrorText = ''
  }
}

function listApplications(): FactoryOnboardingApplication[] {
  return listFactoryOnboardingApplications()
}

function getSelectedApplication(): FactoryOnboardingApplication | null {
  return listApplications().find((item) => item.applicationId === state.selectedApplicationId) || null
}

function getSampleVerificationForApplication(application: FactoryOnboardingApplication | null) {
  if (!application) return null
  return (application.sampleVerificationId ? getSampleVerificationById(application.sampleVerificationId) : null)
    || getSampleVerificationByApplicationId(application.applicationId)
}

function isIssuedSampleStatus(application: FactoryOnboardingApplication): boolean {
  return [
    '待工厂确认收样',
    '待工厂提交样衣审核',
    '待平台审核样衣',
    '样衣审核退回',
    LEGACY_SAMPLE_REJECTED_STATUS,
    '样衣审核通过待转正式',
  ].includes(application.status)
}

function toDatetimeLocalValue(value: string): string {
  return value ? value.replace(' ', 'T').slice(0, 16) : ''
}

function renderReferenceFiles(files: FactorySampleReferenceFile[], emptyText: string): string {
  if (files.length <= 0) return `<div class="rounded-xl border border-dashed px-3 py-2 text-muted-foreground">${escapeHtml(emptyText)}</div>`
  return `
    <div class="space-y-2">
      ${files.map((file) => `
        <div class="rounded-xl border px-3 py-2">
          <div class="font-medium">${escapeHtml(file.fileName)}</div>
          <div class="mt-1 text-muted-foreground">类型：${escapeHtml(file.fileType)} · 大小：${file.fileSizeMb}MB · 上传时间：${escapeHtml(file.uploadedAt)}</div>
        </div>
      `).join('')}
    </div>
  `
}

function getReferenceFileType(fileName: string): FactorySampleReferenceFile['fileType'] {
  const extension = fileName.split('.').pop()?.toLowerCase() || 'pdf'
  if (extension === 'jpg' || extension === 'jpeg' || extension === 'png' || extension === 'webp' || extension === 'pdf' || extension === 'mp4' || extension === 'mov') {
    return extension
  }
  return 'pdf'
}

function buildReferenceFilesFromInput(input: HTMLInputElement): FactorySampleReferenceFile[] {
  const files = Array.from(input.files || [])
  const uploadedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
  return files.map((file, index) => ({
    fileId: `PLATFORM-SAMPLE-${Date.now()}-${index}`,
    fileName: file.name,
    fileType: getReferenceFileType(file.name),
    fileSizeMb: Number((file.size / 1024 / 1024).toFixed(2)),
    uploadedAt,
  }))
}

function updateSampleReviewFilesFromInput(input: HTMLInputElement, field: string): void {
  if (field !== 'sampleReview-bossIdentityFiles') return
  state.sampleReviewDraft = {
    ...state.sampleReviewDraft,
    bossIdentityFiles: buildReferenceFilesFromInput(input),
  }
  state.sampleReviewErrorText = ''
}

function getLatestActionName(application: FactoryOnboardingApplication): string {
  const action = application.actionLogs[application.actionLogs.length - 1]
  return action?.actionName || '—'
}

function getPrimaryFactoryTypeLabel(code: string): string {
  const map: Record<string, string> = {
    CUTTING_FACTORY: '裁床厂',
    PRINTING_FACTORY: '印花厂',
    DYEING_FACTORY: '染厂',
    POST_FINISHING_FACTORY: '后道工厂',
    SPECIAL_CRAFT_FACTORY: '特殊工艺厂',
    SEWING_FACTORY: '车缝厂',
    MULTI_CAPABILITY_FACTORY: '全能力工厂',
  }
  return map[code] || code || '—'
}

function getApplicationMobilePhone(application: FactoryOnboardingApplication): string {
  return application.mobilePhone || application.mobileOrWhatsapp || ''
}

const LEGACY_PLATFORM_REJECTED_STATUS = '平台审核' + '拒绝'
const LEGACY_SAMPLE_REJECTED_STATUS = '样衣审核' + '拒绝'

function getApplicationStatusDisplay(status: string): string {
  if (status === LEGACY_PLATFORM_REJECTED_STATUS) return '平台审核退回'
  if (status === LEGACY_SAMPLE_REJECTED_STATUS) return '样衣审核退回'
  return status
}

function getSampleStatusDisplay(status: string): string {
  if (status === LEGACY_SAMPLE_REJECTED_STATUS) return '样衣审核退回'
  if (status === '样衣审核通过') return '待转正式合作'
  return status
}

function renderStatusChip(label: string): string {
  const displayLabel = getApplicationStatusDisplay(label)
  const className =
    displayLabel === '已转正式合作'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : displayLabel.includes('样衣')
          ? 'border-blue-200 bg-blue-50 text-blue-700'
        : displayLabel.includes('退回')
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-border bg-muted text-muted-foreground'
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-[11px] ${className}">${escapeHtml(displayLabel)}</span>`
}

function renderDetailStatusPanel(application: FactoryOnboardingApplication): string {
  const latestReview = getLatestReviewRecord(application)
  const latestSupplement = getLatestSupplementRecord(application)
  const requiredFields = latestReview?.requiredFields?.length
    ? latestReview.requiredFields
    : latestSupplement?.requiredFields || []
  return `
    <section class="rounded-2xl border bg-card p-4 text-sm shadow-sm" data-testid="factory-onboarding-status-panel">
      <div class="mb-3 text-sm font-semibold">状态区</div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div class="rounded-xl border px-3 py-2">当前状态：${escapeHtml(getApplicationStatusDisplay(application.status))}</div>
        <div class="rounded-xl border px-3 py-2">当前节点：${escapeHtml(application.currentNode)}</div>
        <div class="rounded-xl border px-3 py-2">最近审核结果：${escapeHtml(latestReview ? normalizeReviewResult(latestReview.reviewResult) : '—')}</div>
        <div class="rounded-xl border px-3 py-2 md:col-span-2">最近审核意见：${escapeHtml(latestReview?.reviewOpinion || '—')}</div>
        <div class="rounded-xl border px-3 py-2 md:col-span-2">需补充字段：${requiredFields.length > 0 ? escapeHtml(requiredFields.join('、')) : '—'}</div>
        ${application.status === '待样衣验证' ? '<div class="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-blue-700 md:col-span-2">待样衣验证</div>' : ''}
      </div>
    </section>
  `
}

function filterApplications(applications: FactoryOnboardingApplication[]): FactoryOnboardingApplication[] {
  return applications.filter((item) => {
    if (state.statusFilter !== 'ALL' && item.status !== state.statusFilter) return false
    if (state.nodeFilter !== 'ALL' && item.currentNode !== state.nodeFilter) return false
    if (state.reviewResultFilter !== 'ALL') {
      const latestReview = getLatestReviewRecord(item)
      if (!latestReview || normalizeReviewResult(latestReview.reviewResult) !== state.reviewResultFilter) return false
    }
    if (state.ppicFilter === 'UNASSIGNED' && item.assignedPpicId) return false
    if (state.ppicFilter !== 'ALL' && state.ppicFilter !== 'UNASSIGNED' && item.assignedPpicId !== state.ppicFilter) return false
    if (state.processFilter !== 'ALL' && !item.selectedCapabilities.some((cap) => cap.processCode === state.processFilter)) return false
    if (state.craftFilter !== 'ALL' && !item.selectedCapabilities.some((cap) => cap.craftCode === state.craftFilter)) return false
    if (state.keyword) {
      const text = [
        item.applicationNo,
        item.factoryShortName,
        item.factoryCompanyName,
        item.applicantName,
        getApplicationMobilePhone(item),
        item.sourceChannel,
        item.ppicName,
        item.assignedPpicName || '',
        ...item.selectedCapabilities.map((cap) => `${cap.processName}${cap.craftName}`),
      ].join('|').toLowerCase()
      if (!text.includes(state.keyword.toLowerCase())) return false
    }
    return true
  })
}

function renderStatCards(): string {
  const buckets = listFactoryOnboardingStatusBuckets()
  return `
    <section class="grid grid-cols-2 gap-3 xl:grid-cols-5">
      ${Object.entries(buckets).map(([label, count]) => `
        <article class="rounded-2xl border bg-card px-4 py-3 shadow-sm">
          <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
          <div class="mt-2 text-2xl font-semibold">${count}</div>
        </article>
      `).join('')}
    </section>
  `
}

function renderFilters(): string {
  const processOptions = listSelectableProcessCraftOptions()
  const craftOptions = state.processFilter !== 'ALL'
    ? (processOptions.find((item) => item.processCode === state.processFilter)?.crafts || [])
    : processOptions.flatMap((item) => item.crafts)
  const ppicOptions = getAvailableOnboardingPpicOptions()
  return `
    <section class="rounded-2xl border bg-card p-4 shadow-sm">
      <div class="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-7">
        <label class="space-y-1 text-xs">
          <span class="font-medium">当前状态</span>
          <select data-factory-onboarding-field="statusFilter" class="h-10 w-full rounded-xl border px-3">
            <option value="ALL">全部状态</option>
            ${FACTORY_ONBOARDING_STATUS_OPTIONS
              .filter((item) => item !== LEGACY_PLATFORM_REJECTED_STATUS && item !== LEGACY_SAMPLE_REJECTED_STATUS)
              .map((item) => `<option value="${escapeHtml(item)}" ${state.statusFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-xs">
          <span class="font-medium">当前节点</span>
          <select data-factory-onboarding-field="nodeFilter" class="h-10 w-full rounded-xl border px-3">
            <option value="ALL">全部节点</option>
            ${FACTORY_ONBOARDING_NODE_OPTIONS.map((item) => `<option value="${escapeHtml(item)}" ${state.nodeFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-xs">
          <span class="font-medium">审核结果</span>
          <select data-factory-onboarding-field="reviewResultFilter" class="h-10 w-full rounded-xl border px-3">
            <option value="ALL">全部审核结果</option>
            ${FACTORY_ONBOARDING_REVIEW_RESULTS.map((item) => `<option value="${escapeHtml(item)}" ${state.reviewResultFilter === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-xs">
          <span class="font-medium">工序</span>
          <select data-factory-onboarding-field="processFilter" class="h-10 w-full rounded-xl border px-3">
            <option value="ALL">全部工序</option>
            ${processOptions.map((item) => `<option value="${escapeHtml(item.processCode)}" ${state.processFilter === item.processCode ? 'selected' : ''}>${escapeHtml(item.processName)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-xs">
          <span class="font-medium">工艺</span>
          <select data-factory-onboarding-field="craftFilter" class="h-10 w-full rounded-xl border px-3">
            <option value="ALL">全部工艺</option>
            ${craftOptions.map((item) => `<option value="${escapeHtml(item.craftCode)}" ${state.craftFilter === item.craftCode ? 'selected' : ''}>${escapeHtml(item.craftName)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-xs">
          <span class="font-medium">PPIC</span>
          <select data-testid="ppic-filter" data-factory-onboarding-field="ppicFilter" class="h-10 w-full rounded-xl border px-3">
            <option value="ALL">全部</option>
            <option value="UNASSIGNED" ${state.ppicFilter === 'UNASSIGNED' ? 'selected' : ''}>未分配</option>
            ${ppicOptions.map((item) => `<option value="${escapeHtml(item.ppicId)}" ${state.ppicFilter === item.ppicId ? 'selected' : ''}>${escapeHtml(item.ppicName)}</option>`).join('')}
          </select>
        </label>
        <label class="space-y-1 text-xs">
          <span class="font-medium">关键词</span>
          <input data-factory-onboarding-field="keyword" value="${escapeHtml(state.keyword)}" class="h-10 w-full rounded-xl border px-3" placeholder="申请编号 / 工厂公司 / 联系方式" />
        </label>
      </div>
    </section>
  `
}

function renderApplicationTable(applications: FactoryOnboardingApplication[]): string {
  return `
    <section class="rounded-2xl border bg-card p-4 shadow-sm">
      ${state.errorText ? `<div class="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${escapeHtml(state.errorText)}</div>` : ''}
      ${state.successText ? `<div class="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">${escapeHtml(state.successText)}</div>` : ''}
      <div class="overflow-x-auto">
        <table data-testid="factory-onboarding-table" class="min-w-full text-sm">
          <thead class="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th class="px-3 py-2 text-left font-medium">入驻申请编号</th>
              <th class="px-3 py-2 text-left font-medium">工厂简称</th>
              <th class="px-3 py-2 text-left font-medium">姓名</th>
              <th class="px-3 py-2 text-left font-medium">身份证号码/护照号码</th>
              <th class="px-3 py-2 text-left font-medium">工厂/公司名称</th>
              <th class="px-3 py-2 text-left font-medium">手机号</th>
              <th class="px-3 py-2 text-left font-medium">来源</th>
              <th class="px-3 py-2 text-left font-medium">PPIC 姓名</th>
              <th class="px-3 py-2 text-left font-medium">PPIC</th>
              <th class="px-3 py-2 text-left font-medium">机器数量</th>
              <th class="px-3 py-2 text-left font-medium">有效工人数量</th>
              <th class="px-3 py-2 text-left font-medium">已选工序工艺</th>
              <th class="px-3 py-2 text-left font-medium">当前节点</th>
              <th class="px-3 py-2 text-left font-medium">当前状态</th>
              <th class="px-3 py-2 text-left font-medium">当前节点耗时</th>
              <th class="px-3 py-2 text-left font-medium">当前节点动作次数</th>
              <th class="px-3 py-2 text-left font-medium">提交时间</th>
              <th class="px-3 py-2 text-left font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            ${applications.length > 0 ? applications.map((item) => {
              const summary = getFactoryOnboardingCurrentNodeSummary(item)
              const canReview = item.status === '待平台审核'
              const sampleVerification = getSampleVerificationForApplication(item)
              const canIssueSample = item.status === '待样衣验证' && !item.sampleVerificationId && !sampleVerification
              const canSampleReview = item.status === '待平台审核样衣' && sampleVerification?.status === '待平台审核样衣'
              const canViewSample = isIssuedSampleStatus(item) || Boolean(sampleVerification)
              const canConvert = item.status === '样衣审核通过待转正式' && sampleVerification?.status === '样衣审核通过' && !item.createdFactoryId
              const canViewFactoryProfile = item.status === '已转正式合作' && Boolean(item.createdFactoryId)
              return `
                <tr class="border-t align-top">
                  <td class="px-3 py-3">${escapeHtml(item.applicationNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.factoryShortName)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.applicantName)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.identityNo)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.factoryCompanyName)}</td>
                  <td class="px-3 py-3">${escapeHtml(getApplicationMobilePhone(item))}</td>
                  <td class="px-3 py-3">${escapeHtml(item.sourceChannel)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.ppicName)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.assignedPpicName || '未分配')}</td>
                  <td class="px-3 py-3">${item.machineTotalCount}</td>
                  <td class="px-3 py-3">${item.effectiveWorkerCount}</td>
                  <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(item.selectedCapabilities.map((cap) => `${cap.processName}/${cap.craftName}`).join('、'))}</td>
                  <td class="px-3 py-3">${escapeHtml(item.currentNode)}</td>
                  <td class="px-3 py-3">${renderStatusChip(item.status)}</td>
                  <td class="px-3 py-3">${escapeHtml(summary.elapsedText)}</td>
                  <td class="px-3 py-3">${escapeHtml(summary.actionCountText)}</td>
                  <td class="px-3 py-3">${escapeHtml(item.submittedAt || '—')}</td>
                  <td class="px-3 py-3">
                    <div class="flex flex-wrap gap-2">
                      <button type="button" class="rounded-full border px-3 py-1 text-xs" data-factory-onboarding-action="view-detail" data-application-id="${item.applicationId}">查看</button>
                      ${canReview ? `<button type="button" class="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700" data-testid="factory-onboarding-review-button" data-factory-onboarding-action="open-review" data-application-id="${item.applicationId}">审核</button>` : ''}
                      ${canIssueSample ? `<button type="button" class="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700" data-testid="factory-sample-issue-button" data-factory-onboarding-action="open-sample-issue" data-application-id="${item.applicationId}">登记并发放样衣</button>` : ''}
                      ${canSampleReview ? `<button type="button" class="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700" data-testid="factory-sample-review-button" data-factory-onboarding-action="open-sample-review" data-application-id="${item.applicationId}">样衣审核</button>` : ''}
                      ${canConvert ? `<button type="button" class="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700" data-testid="factory-official-conversion-button" data-factory-onboarding-action="open-conversion" data-application-id="${item.applicationId}">转正式合作</button>` : ''}
                      ${canViewFactoryProfile ? `<button type="button" class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700" data-nav="/fcs/factories/profile" data-factory-onboarding-action="view-factory-profile">查看工厂档案</button>` : ''}
                      ${canViewSample ? `<button type="button" class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs text-slate-700" data-factory-onboarding-action="view-sample" data-application-id="${item.applicationId}">查看样衣</button>` : ''}
                    </div>
                  </td>
                </tr>
              `
            }).join('') : '<tr><td colspan="18" class="px-3 py-10 text-center text-sm text-muted-foreground">当前没有符合条件的入驻申请</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `
}

function renderSampleVerificationDetail(application: FactoryOnboardingApplication): string {
  const sampleVerification = getSampleVerificationForApplication(application)
  if (!sampleVerification) {
    return `
      <div class="rounded-xl border border-dashed px-3 py-8 text-center text-sm text-muted-foreground" data-testid="factory-sample-empty">
        暂未登记样衣。
      </div>
    `
  }
  return `
    <div class="space-y-3 text-sm" data-testid="factory-sample-verification-detail">
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-xl border px-3 py-2">样衣验证编号：${escapeHtml(sampleVerification.verificationNo)}</div>
        <div class="rounded-xl border px-3 py-2">样衣批次号：${escapeHtml(sampleVerification.sampleBatchNo)}</div>
        <div class="rounded-xl border px-3 py-2">款号：${escapeHtml(sampleVerification.styleNo)}</div>
        <div class="rounded-xl border px-3 py-2">样衣名称：${escapeHtml(sampleVerification.sampleName)}</div>
        <div class="rounded-xl border px-3 py-2">样衣件数：${sampleVerification.sampleQuantity} 件</div>
        <div class="rounded-xl border px-3 py-2">当前样衣状态：${escapeHtml(getSampleStatusDisplay(sampleVerification.status))}</div>
        <div class="rounded-xl border px-3 py-2">验证目的：${escapeHtml(sampleVerification.verificationPurpose.join('、'))}</div>
        <div class="rounded-xl border px-3 py-2">发放方式：${escapeHtml(sampleVerification.issueMethod)}</div>
        <div class="rounded-xl border px-3 py-2">快递公司：${escapeHtml(sampleVerification.courierCompany || '—')}</div>
        <div class="rounded-xl border px-3 py-2">快递单号：${escapeHtml(sampleVerification.trackingNo || '—')}</div>
        <div class="rounded-xl border px-3 py-2">发放时间：${escapeHtml(sampleVerification.issuedAt)}</div>
        <div class="rounded-xl border px-3 py-2">发放人：${escapeHtml(sampleVerification.issuedBy)}</div>
        <div class="rounded-xl border px-3 py-2">预计收样时间：${escapeHtml(sampleVerification.expectedReceiveAt || '—')}</div>
        <div class="rounded-xl border px-3 py-2">预计提交样衣审核时间：${escapeHtml(sampleVerification.expectedSubmitAt)}</div>
        <div class="col-span-2 rounded-xl border px-3 py-2">样衣说明：${escapeHtml(sampleVerification.sampleDescription)}</div>
      </div>
      <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
        <section class="rounded-xl border p-3">
          <div class="mb-2 font-medium">平台参考照片</div>
          ${renderReferenceFiles(sampleVerification.platformReferencePhotos, '暂无平台参考照片')}
        </section>
        <section class="rounded-xl border p-3">
          <div class="mb-2 font-medium">平台参考视频</div>
          ${renderReferenceFiles(sampleVerification.platformReferenceVideos, '暂无平台参考视频')}
        </section>
        <section class="rounded-xl border p-3">
          <div class="mb-2 font-medium">平台参考资料</div>
          ${renderReferenceFiles(sampleVerification.platformReferenceFiles, '暂无平台参考资料')}
        </section>
      </div>
      ${sampleVerification.factoryReceivedAt ? `
        <section class="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <div class="mb-2 font-medium text-emerald-800">工厂已确认收样</div>
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div class="rounded-xl border bg-white px-3 py-2">确认收样时间：${escapeHtml(sampleVerification.factoryReceivedAt)}</div>
            <div class="rounded-xl border bg-white px-3 py-2">确认收样人：${escapeHtml(sampleVerification.factoryReceivedBy || '—')}</div>
            <div class="col-span-2 rounded-xl border bg-white px-3 py-2">收样备注：${escapeHtml(sampleVerification.factoryReceiveRemark || '—')}</div>
          </div>
        </section>
      ` : ''}
      ${sampleVerification.factorySubmittedAt ? `
        <section class="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
          <div class="mb-2 font-medium text-blue-800">工厂已提交样衣审核资料</div>
          <div class="mb-3 grid grid-cols-2 gap-3 text-sm">
            <div class="rounded-xl border bg-white px-3 py-2">提交时间：${escapeHtml(sampleVerification.factorySubmittedAt)}</div>
            <div class="rounded-xl border bg-white px-3 py-2">提交人：${escapeHtml(sampleVerification.factorySubmittedBy || '—')}</div>
            <div class="col-span-2 rounded-xl border bg-white px-3 py-2">工艺说明：${escapeHtml(sampleVerification.factoryCraftDescription || '—')}</div>
            <div class="col-span-2 rounded-xl border bg-white px-3 py-2">问题说明：${escapeHtml(sampleVerification.factoryProblemDescription || '—')}</div>
            <div class="col-span-2 rounded-xl border bg-white px-3 py-2">备注：${escapeHtml(sampleVerification.factorySubmitRemark || '—')}</div>
          </div>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <section class="rounded-xl border bg-white p-3">
              <div class="mb-2 font-medium">样衣照片</div>
              ${renderReferenceFiles(sampleVerification.factorySamplePhotos || [], '暂无样衣照片')}
            </section>
            <section class="rounded-xl border bg-white p-3">
              <div class="mb-2 font-medium">样衣视频</div>
              ${renderReferenceFiles(sampleVerification.factorySampleVideos || [], '暂无样衣视频')}
            </section>
            <section class="rounded-xl border bg-white p-3">
              <div class="mb-2 font-medium">工厂照片</div>
              ${renderReferenceFiles(sampleVerification.factorySitePhotos || [], '暂无工厂照片')}
            </section>
            <section class="rounded-xl border bg-white p-3">
              <div class="mb-2 font-medium">工厂视频</div>
              ${renderReferenceFiles(sampleVerification.factorySiteVideos || [], '暂无工厂视频')}
            </section>
            <section class="rounded-xl border bg-white p-3">
              <div class="mb-2 font-medium">老板身份证复印件或照片</div>
              ${renderReferenceFiles(sampleVerification.bossIdentityFiles || [], '暂无老板身份证复印件或照片')}
            </section>
            <section class="rounded-xl border bg-white p-3">
              <div class="mb-2 font-medium">补充文件</div>
              ${renderReferenceFiles(sampleVerification.factorySubmissionFiles || [], '暂无补充文件')}
            </section>
          </div>
          <div class="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div class="rounded-xl border bg-white px-3 py-2">老板身份证号码/护照号码：${escapeHtml(sampleVerification.bossIdentityNo || '—')}</div>
            <div class="rounded-xl border bg-white px-3 py-2">老板身份资料来源：${escapeHtml(sampleVerification.bossIdentitySource || '—')}</div>
            <div class="rounded-xl border bg-white px-3 py-2">老板身份资料补齐时间：${escapeHtml(sampleVerification.bossIdentityCompletedAt || '—')}</div>
            <div class="rounded-xl border bg-white px-3 py-2">老板身份资料补齐人：${escapeHtml(sampleVerification.bossIdentityCompletedBy || '—')}</div>
          </div>
        </section>
      ` : ''}
      <section class="rounded-xl border p-3">
        <div class="mb-2 font-medium">样衣审核记录</div>
        ${sampleVerification.sampleReviewRecords.length > 0 ? `
          <div class="space-y-2">
            ${sampleVerification.sampleReviewRecords.map((record) => `
              <article class="rounded-xl border bg-white px-3 py-2">
                <div class="font-medium">审核轮次：第${record.sampleReviewRoundNo}轮 · 审核结果：${escapeHtml(normalizeSampleReviewResult(record.sampleReviewResult))}</div>
                <div class="mt-1 text-muted-foreground">审核意见：${escapeHtml(record.sampleReviewOpinion)}</div>
                <div class="mt-1 text-muted-foreground">需重新提交内容：${record.requiredResubmitItems.length > 0 ? escapeHtml(record.requiredResubmitItems.join('、')) : '—'}</div>
                <div class="mt-1 text-muted-foreground">样衣质量结论：${escapeHtml(record.sampleQualityConclusion || '—')} · 能力验证结论：${escapeHtml(record.capacityConclusion || '—')}</div>
                <div class="mt-1 text-muted-foreground">老板身份证号码/护照号码：${escapeHtml(record.bossIdentityNoAtReview || '—')} · 老板身份资料来源：${escapeHtml(record.bossIdentitySourceAtReview || '—')}</div>
                <div class="mt-1 text-muted-foreground">老板身份证复印件或照片：${record.bossIdentityFilesAtReview.length > 0 ? escapeHtml(record.bossIdentityFilesAtReview.map((file) => file.fileName).join('、')) : '—'}</div>
                <div class="mt-1 text-muted-foreground">审核人：${escapeHtml(record.reviewer)} · 审核时间：${escapeHtml(record.reviewedAt)} · 对应提交轮次：第${record.relatedSubmissionRoundNo}轮</div>
                <div class="mt-1 text-muted-foreground">变更前状态：${escapeHtml(getSampleStatusDisplay(record.fromStatus))} · 变更后状态：${escapeHtml(getSampleStatusDisplay(record.toStatus))}</div>
              </article>
            `).join('')}
          </div>
        ` : '<div class="rounded-xl border border-dashed px-3 py-6 text-muted-foreground">暂无样衣审核记录</div>'}
      </section>
    </div>
  `
}

function renderDetailDrawer(application: FactoryOnboardingApplication | null): string {
  if (!application) return ''
  const summary = getFactoryOnboardingCurrentNodeSummary(application)
  const tabs = [
    ['basic', '基础资料'],
    ['account', '登录账号'],
    ['capability', '工序工艺能力'],
    ['machines', '机器能力'],
    ['flow', '流程记录'],
    ['review', '审核记录'],
    ['sample', '样衣验证'],
    ['conversion', '转档记录'],
  ] as const
  let body = ''

  if (state.detailTab === 'basic') {
    body = `
      <section class="mb-3 rounded-xl border p-3 text-sm">
        <div class="mb-2 flex items-center justify-between gap-2">
          <div class="font-medium">当前 PPIC</div>
          <button type="button" class="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs text-blue-700" data-factory-onboarding-action="open-ppic-dialog" data-application-id="${application.applicationId}">修改 PPIC</button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="rounded-xl border px-3 py-2">当前 PPIC：${escapeHtml(application.assignedPpicName || '未分配')}</div>
          <div class="rounded-xl border px-3 py-2">PPIC 手机号：${escapeHtml(application.assignedPpicPhone || '—')}</div>
          <div class="rounded-xl border px-3 py-2">分配时间：${escapeHtml(application.assignedPpicAt || '—')}</div>
          <div class="rounded-xl border px-3 py-2">分配人：${escapeHtml(application.assignedPpicBy || '—')}</div>
        </div>
        <div class="mt-3 font-medium">PPIC 变更记录</div>
        ${application.ppicChangeLogs.length > 0 ? `
          <div class="mt-2 space-y-2">
            ${application.ppicChangeLogs.map((log) => `
              <article class="rounded-xl border px-3 py-2">
                <div>变更时间：${escapeHtml(log.changedAt)} · 变更人：${escapeHtml(log.changedBy)}</div>
                <div class="mt-1 text-muted-foreground">原 PPIC：${escapeHtml(log.fromPpicName || '未分配')} · 新 PPIC：${escapeHtml(log.toPpicName)}</div>
                <div class="mt-1 text-muted-foreground">修改原因：${escapeHtml(log.changeReason || '—')}</div>
              </article>
            `).join('')}
          </div>
        ` : '<div class="mt-2 rounded-xl border border-dashed px-3 py-4 text-muted-foreground">暂无记录</div>'}
      </section>
        <div class="grid grid-cols-2 gap-3 text-sm">
        <div class="rounded-xl border px-3 py-2">工厂简称：${escapeHtml(application.factoryShortName)}</div>
        <div class="rounded-xl border px-3 py-2">姓名：${escapeHtml(application.applicantName)}</div>
        <div class="rounded-xl border px-3 py-2">身份证号码/护照号码：${escapeHtml(application.identityNo)}</div>
        <div class="rounded-xl border px-3 py-2">工厂/公司名称：${escapeHtml(application.factoryCompanyName)}</div>
        <div class="rounded-xl border px-3 py-2">手机号：${escapeHtml(getApplicationMobilePhone(application))}</div>
        <div class="rounded-xl border px-3 py-2">来源：${escapeHtml(application.sourceChannel)}</div>
        <div class="rounded-xl border px-3 py-2">PPIC 姓名：${escapeHtml(application.ppicName)}</div>
        <div class="rounded-xl border px-3 py-2">身份证复印件/电子文件：${escapeHtml(application.identityFile?.fileName || '未上传')}</div>
        <div class="rounded-xl border px-3 py-2">可开始合作时间：${escapeHtml(application.availableStartDate)}</div>
        <div class="col-span-2 rounded-xl border px-3 py-2">地址：${escapeHtml(application.address)}</div>
      </div>
    `
  } else if (state.detailTab === 'account') {
    body = `
      <div class="grid grid-cols-2 gap-3 text-sm">
        <div class="rounded-xl border px-3 py-2">登录账号：${escapeHtml(application.factoryShortName)}</div>
        <div class="rounded-xl border px-3 py-2">管理员姓名：${escapeHtml(application.adminAccount.adminName)}</div>
        <div class="rounded-xl border px-3 py-2">账号状态：${escapeHtml(application.adminAccount.accountStatus)}</div>
        <div class="rounded-xl border px-3 py-2">是否临时账号：${application.adminAccount.isTemporary === false ? '否' : '是'}</div>
      </div>
    `
  } else if (state.detailTab === 'capability') {
    body = `
      <div class="mb-3 grid gap-3 text-sm">
        <div class="rounded-xl border px-3 py-2">系统匹配工厂类型：${escapeHtml(getPrimaryFactoryTypeLabel(application.primaryFactoryType))}</div>
        <div class="rounded-xl border px-3 py-2">匹配依据：${escapeHtml(application.factoryTypeMatchReason || '—')}</div>
      </div>
      <table class="min-w-full text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground"><tr><th class="px-3 py-2 text-left font-medium">工序</th><th class="px-3 py-2 text-left font-medium">工艺</th><th class="px-3 py-2 text-left font-medium">是否可接任务</th><th class="px-3 py-2 text-left font-medium">是否纳入产能</th></tr></thead>
        <tbody>
          ${application.selectedCapabilities.map((item) => `
            <tr class="border-t"><td class="px-3 py-2">${escapeHtml(item.processName)}</td><td class="px-3 py-2">${escapeHtml(item.craftName)}</td><td class="px-3 py-2">${item.canReceiveTask ? '是' : '否'}</td><td class="px-3 py-2">${item.capacityManaged ? '是' : '否'}</td></tr>
          `).join('')}
        </tbody>
      </table>
    `
  } else if (state.detailTab === 'machines') {
    body = `
      <table class="min-w-full text-sm">
        <thead class="bg-muted/40 text-xs text-muted-foreground"><tr><th class="px-3 py-2 text-left font-medium">机器名称</th><th class="px-3 py-2 text-left font-medium">机器编号</th><th class="px-3 py-2 text-left font-medium">数量</th><th class="px-3 py-2 text-left font-medium">关联工序</th><th class="px-3 py-2 text-left font-medium">关联工艺</th><th class="px-3 py-2 text-left font-medium">状态</th><th class="px-3 py-2 text-left font-medium">校验状态</th><th class="px-3 py-2 text-left font-medium">备注</th></tr></thead>
        <tbody>
          ${application.machines.map((item) => `
            <tr class="border-t"><td class="px-3 py-2">${escapeHtml(item.machineName)}</td><td class="px-3 py-2">${escapeHtml(item.machineNo || '—')}</td><td class="px-3 py-2">${item.machineCount}</td><td class="px-3 py-2">${escapeHtml(item.linkedProcessName || '—')}</td><td class="px-3 py-2">${escapeHtml(item.linkedCraftName || '—')}</td><td class="px-3 py-2">${escapeHtml(item.condition)}</td><td class="px-3 py-2">${escapeHtml(item.validationStatus)}</td><td class="px-3 py-2">${escapeHtml(item.remark || item.validationMessage || '—')}</td></tr>
          `).join('')}
        </tbody>
      </table>
    `
  } else if (state.detailTab === 'flow') {
    body = `
      <div class="space-y-4">
        <section>
          <div class="mb-2 text-sm font-medium">流程记录</div>
          <div class="space-y-2">
            ${application.nodeLogs.map((item) => `
              <article class="rounded-xl border px-3 py-2 text-sm">
                <div class="flex items-center justify-between gap-2">
                  <div class="font-medium">${escapeHtml(item.nodeName)}</div>
                  ${renderStatusChip(item.nodeStatus)}
                </div>
                <div class="mt-1 text-muted-foreground">进入时间：${escapeHtml(item.enteredAt)} · 离开时间：${escapeHtml(item.leftAt || '进行中')}</div>
                <div class="mt-1 text-muted-foreground">节点耗时：${escapeHtml(item.elapsedText)} · 动作次数：第${item.actionCount}次动作</div>
                <div class="mt-1 text-muted-foreground">操作人：${escapeHtml(item.operator)} · 上次动作时间：${escapeHtml(item.lastActionAt || '—')}</div>
                <div class="mt-1 text-muted-foreground">备注：${escapeHtml(item.remark || '—')}</div>
              </article>
            `).join('')}
          </div>
        </section>
        <section>
          <div class="mb-2 text-sm font-medium">动作记录区</div>
          <div class="space-y-2">
            ${application.actionLogs.map((item) => `
              <article class="rounded-xl border px-3 py-2 text-sm">
                <div class="font-medium">${escapeHtml(item.actionName)}</div>
                <div class="mt-1 text-muted-foreground">所属节点：${escapeHtml(item.nodeName)} · 节点内第${item.actionSequenceInNode}次动作</div>
                <div class="mt-1 text-muted-foreground">变更前状态：${escapeHtml(getApplicationStatusDisplay(item.fromStatus))} · 变更后状态：${escapeHtml(getApplicationStatusDisplay(item.toStatus))}</div>
                <div class="mt-1 text-muted-foreground">变更前节点：${escapeHtml(item.fromNode)} · 变更后节点：${escapeHtml(item.toNode)}</div>
                <div class="mt-1 text-muted-foreground">操作人：${escapeHtml(item.operator)} · 操作时间：${escapeHtml(item.operatedAt)}</div>
                <div class="mt-1 text-muted-foreground">备注：${escapeHtml(item.remark || '—')}</div>
              </article>
            `).join('')}
          </div>
        </section>
      </div>
    `
  } else if (state.detailTab === 'review') {
    body = application.reviewRecords.length > 0 ? application.reviewRecords.map((item) => `
      <article class="rounded-xl border px-3 py-2 text-sm">
        <div class="font-medium">第${item.reviewRoundNo}轮 · ${escapeHtml(normalizeReviewResult(item.reviewResult))}</div>
        <div class="mt-1 text-muted-foreground">审核意见：${escapeHtml(item.reviewOpinion)}</div>
        <div class="mt-1 text-muted-foreground">需补充字段：${item.requiredFields?.length ? escapeHtml(item.requiredFields.join('、')) : '—'}</div>
        <div class="mt-1 text-muted-foreground">审核人：${escapeHtml(item.reviewer)} · 审核时间：${escapeHtml(item.reviewedAt)}</div>
        <div class="mt-1 text-muted-foreground">变更前状态：${escapeHtml(getApplicationStatusDisplay(item.fromStatus))} · 变更后状态：${escapeHtml(getApplicationStatusDisplay(item.toStatus))}</div>
        <div class="mt-1 text-muted-foreground">变更前节点：${escapeHtml(item.fromNode)} · 变更后节点：${escapeHtml(item.toNode)}</div>
      </article>
    `).join('') : '<div class="rounded-xl border border-dashed px-3 py-6 text-sm text-muted-foreground">暂无审核记录</div>'
  } else if (state.detailTab === 'sample') {
    body = renderSampleVerificationDetail(application)
  } else {
    const records = application.conversionRecords || []
    body = records.length > 0 ? records.map((record) => `
      <article class="rounded-xl border px-3 py-3 text-sm">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="font-medium">转档记录：${escapeHtml(record.conversionId)}</div>
          ${renderStatusChip(record.toStatus)}
        </div>
        <div class="mt-2 grid grid-cols-2 gap-3">
          <div class="rounded-xl border px-3 py-2">是否已转正式：是</div>
          <div class="rounded-xl border px-3 py-2">转档时间：${escapeHtml(record.convertedAt)}</div>
          <div class="rounded-xl border px-3 py-2">转档人：${escapeHtml(record.convertedBy)}</div>
          <div class="rounded-xl border px-3 py-2">工厂档案编号：${escapeHtml(record.createdFactoryNo)}</div>
          <div class="rounded-xl border px-3 py-2">管理员账号是否转正：${record.adminAccountConverted ? '是' : '否'}</div>
          <div class="rounded-xl border px-3 py-2">正式管理员账号：${escapeHtml(record.officialAdminAccountId || application.adminAccount.loginId)}</div>
          <div class="rounded-xl border px-3 py-2">产能档案是否生成：${record.capacityProfileCreated ? '是' : '否'}</div>
          <div class="rounded-xl border px-3 py-2">产能档案编号：${escapeHtml(record.capacityProfileId || '—')}</div>
          <div class="rounded-xl border px-3 py-2">转档前状态：${escapeHtml(getApplicationStatusDisplay(record.fromStatus))}</div>
          <div class="rounded-xl border px-3 py-2">转档后状态：${escapeHtml(getApplicationStatusDisplay(record.toStatus))}</div>
          <div class="col-span-2 rounded-xl border px-3 py-2">备注：${escapeHtml(record.remark || '—')}</div>
        </div>
      </article>
    `).join('') : '<div class="rounded-xl border border-dashed px-3 py-6 text-sm text-muted-foreground">暂无转档记录</div>'
  }

  return `
    <div class="fixed inset-0 z-40" data-factory-onboarding-dialog="detail">
      <button type="button" class="absolute inset-0 bg-black/35" data-factory-onboarding-action="close-detail"></button>
      <aside class="absolute right-0 top-0 h-full w-full max-w-4xl overflow-y-auto border-l bg-background shadow-2xl">
        <div class="sticky top-0 z-10 border-b bg-background px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold">工厂入驻详情</h2>
              <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(application.applicationNo)} · ${escapeHtml(application.factoryCompanyName)}</p>
            </div>
            <button type="button" class="rounded-full border px-3 py-1 text-xs" data-factory-onboarding-action="close-detail">关闭</button>
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            ${tabs.map(([key, label]) => `<button type="button" class="rounded-full border px-3 py-1.5 text-xs ${state.detailTab === key ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-border bg-background text-muted-foreground'}" ${key === 'sample' ? 'data-testid="factory-onboarding-detail-sample-tab"' : key === 'conversion' ? 'data-testid="factory-onboarding-detail-conversion-tab"' : ''} data-factory-onboarding-action="switch-detail-tab" data-tab="${key}">${label}</button>`).join('')}
          </div>
        </div>
        <div class="space-y-3 p-5">${renderDetailStatusPanel(application)}${body}</div>
      </aside>
    </div>
  `
}

function renderReviewDialog(application: FactoryOnboardingApplication | null): string {
  if (!application) return ''
  const needFields = state.reviewResult === '未通过'
  return `
    <div class="fixed inset-0 z-50" data-testid="factory-onboarding-review-dialog" data-factory-onboarding-dialog="review">
      <button type="button" class="absolute inset-0 bg-black/35" data-factory-onboarding-action="close-review"></button>
      <section class="absolute left-1/2 top-1/2 w-[92vw] max-w-xl -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background p-5 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">审核入驻申请</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-factory-onboarding-action="close-review">关闭</button>
        </div>
        <div class="mt-4 space-y-3 text-sm">
          <div class="rounded-xl border bg-muted/20 px-3 py-2">申请编号：${escapeHtml(application.applicationNo)}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">工厂/公司名称：${escapeHtml(application.factoryCompanyName)}</div>
          <label class="block space-y-2">
            <span class="text-sm font-medium">审核结果</span>
            <div class="space-y-2">
              ${FACTORY_ONBOARDING_REVIEW_RESULTS.map((item) => `
                <label class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                  <input type="radio" name="factory-onboarding-review-result" value="${item}" data-factory-onboarding-field="reviewResult" ${state.reviewResult === item ? 'checked' : ''} />
                  <span>${item}</span>
                </label>
              `).join('')}
            </div>
          </label>
          <label class="block space-y-2">
            <span class="text-sm font-medium">审核意见</span>
            <textarea data-factory-onboarding-field="reviewOpinion" class="min-h-28 w-full rounded-2xl border px-3 py-2" placeholder="请输入审核意见">${escapeHtml(state.reviewOpinion)}</textarea>
          </label>
          ${needFields ? `
            <div class="space-y-2" data-testid="factory-onboarding-required-fields">
              <div class="text-sm font-medium">需补充字段</div>
              <div class="grid grid-cols-2 gap-2">
                ${FACTORY_ONBOARDING_REQUIRED_FIELD_OPTIONS.map((field) => `
                  <label class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                    <input type="checkbox" value="${escapeHtml(field)}" data-factory-onboarding-field="reviewRequiredField" ${state.reviewRequiredFields.includes(field) ? 'checked' : ''} />
                    <span>${escapeHtml(field)}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="rounded-xl border px-4 py-2 text-sm" data-factory-onboarding-action="close-review">取消</button>
          <button type="button" class="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground" data-factory-onboarding-action="submit-review">确认审核</button>
        </div>
      </section>
    </div>
  `
}

function renderSampleIssueDialog(application: FactoryOnboardingApplication | null): string {
  if (!application) return ''
  const draft = state.sampleIssueDraft
  const errorLines = state.sampleIssueErrorText.split('\n').filter(Boolean)
  return `
    <div class="fixed inset-0 z-50" data-testid="factory-sample-issue-dialog" data-factory-onboarding-dialog="sample-issue">
      <button type="button" class="absolute inset-0 bg-black/35" data-factory-onboarding-action="close-sample-issue"></button>
      <section class="absolute left-1/2 top-1/2 max-h-[92vh] w-[94vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-background p-5 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">登记并发放样衣</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-factory-onboarding-action="close-sample-issue">关闭</button>
        </div>
        <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-xl border bg-muted/20 px-3 py-2">入驻申请编号：${escapeHtml(application.applicationNo)}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">工厂/公司名称：${escapeHtml(application.factoryCompanyName)}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">姓名：${escapeHtml(application.applicantName)}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">手机号：${escapeHtml(getApplicationMobilePhone(application))}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">机器数量：${application.machineTotalCount}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">有效工人数量：${application.effectiveWorkerCount}</div>
          <div class="col-span-2 rounded-xl border bg-muted/20 px-3 py-2">已选工序工艺：${escapeHtml(application.selectedCapabilities.map((item) => `${item.processName}/${item.craftName}`).join('、'))}</div>
        </div>
        ${errorLines.length > 0 ? `
          <div class="mt-4 space-y-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" data-testid="factory-sample-issue-error">
            ${errorLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
          </div>
        ` : ''}
        <div class="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 text-sm">
          <label class="space-y-1">
            <span class="text-xs font-medium">样衣批次号 *</span>
            <input data-factory-onboarding-field="sampleIssue-sampleBatchNo" value="${escapeHtml(draft.sampleBatchNo)}" class="h-10 w-full rounded-xl border px-3" placeholder="请输入样衣批次号" />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-medium">款号 *</span>
            <input data-factory-onboarding-field="sampleIssue-styleNo" value="${escapeHtml(draft.styleNo)}" class="h-10 w-full rounded-xl border px-3" placeholder="请输入款号" />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-medium">样衣名称 *</span>
            <input data-factory-onboarding-field="sampleIssue-sampleName" value="${escapeHtml(draft.sampleName)}" class="h-10 w-full rounded-xl border px-3" placeholder="请输入样衣名称" />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-medium">样衣件数 *</span>
            <input type="number" min="1" data-factory-onboarding-field="sampleIssue-sampleQuantity" value="${draft.sampleQuantity}" class="h-10 w-full rounded-xl border px-3" placeholder="请输入样衣件数" />
          </label>
          <label class="space-y-1 md:col-span-2">
            <span class="text-xs font-medium">样衣说明 *</span>
            <textarea data-factory-onboarding-field="sampleIssue-sampleDescription" class="min-h-24 w-full rounded-xl border px-3 py-2" placeholder="请输入样衣说明">${escapeHtml(draft.sampleDescription)}</textarea>
          </label>
          <div class="space-y-2 md:col-span-2">
            <div class="text-xs font-medium">验证目的 *</div>
            <div class="grid grid-cols-1 gap-2 md:grid-cols-2">
              ${FACTORY_SAMPLE_VERIFICATION_PURPOSE_OPTIONS.map((purpose) => `
                <label class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                  <input type="checkbox" value="${escapeHtml(purpose)}" data-factory-onboarding-field="sampleIssuePurpose" ${draft.verificationPurpose.includes(purpose) ? 'checked' : ''} />
                  <span>${escapeHtml(purpose)}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="space-y-2 md:col-span-2">
            <div class="text-xs font-medium">发放方式 *</div>
            <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
              ${FACTORY_SAMPLE_ISSUE_METHOD_OPTIONS.map((method) => `
                <label class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                  <input type="radio" name="factory-sample-issue-method" value="${escapeHtml(method)}" data-factory-onboarding-field="sampleIssue-issueMethod" ${draft.issueMethod === method ? 'checked' : ''} />
                  <span>${escapeHtml(method)}</span>
                </label>
              `).join('')}
            </div>
          </div>
          ${draft.issueMethod === '快递发放' ? `
            <label class="space-y-1">
              <span class="text-xs font-medium">快递公司 *</span>
              <input data-factory-onboarding-field="sampleIssue-courierCompany" value="${escapeHtml(draft.courierCompany || '')}" class="h-10 w-full rounded-xl border px-3" placeholder="请输入快递公司" />
            </label>
            <label class="space-y-1">
              <span class="text-xs font-medium">快递单号 *</span>
              <input data-factory-onboarding-field="sampleIssue-trackingNo" value="${escapeHtml(draft.trackingNo || '')}" class="h-10 w-full rounded-xl border px-3" placeholder="请输入快递单号" />
            </label>
          ` : ''}
          <label class="space-y-1">
            <span class="text-xs font-medium">发放时间 *</span>
            <input type="datetime-local" data-factory-onboarding-field="sampleIssue-issuedAt" value="${escapeHtml(toDatetimeLocalValue(draft.issuedAt))}" class="h-10 w-full rounded-xl border px-3" />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-medium">发放人 *</span>
            <input data-factory-onboarding-field="sampleIssue-issuedBy" value="${escapeHtml(draft.issuedBy)}" class="h-10 w-full rounded-xl border px-3" placeholder="请输入发放人" />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-medium">预计收样时间</span>
            <input type="datetime-local" data-factory-onboarding-field="sampleIssue-expectedReceiveAt" value="${escapeHtml(toDatetimeLocalValue(draft.expectedReceiveAt || ''))}" class="h-10 w-full rounded-xl border px-3" />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-medium">预计提交样衣审核时间 *</span>
            <input type="datetime-local" data-factory-onboarding-field="sampleIssue-expectedSubmitAt" value="${escapeHtml(toDatetimeLocalValue(draft.expectedSubmitAt))}" class="h-10 w-full rounded-xl border px-3" />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-medium">平台参考照片</span>
            <input type="file" multiple accept=".jpg,.jpeg,.png,.webp" class="w-full rounded-xl border px-3 py-2 text-xs" />
          </label>
          <label class="space-y-1">
            <span class="text-xs font-medium">平台参考视频</span>
            <input type="file" multiple accept=".mp4,.mov" class="w-full rounded-xl border px-3 py-2 text-xs" />
          </label>
          <label class="space-y-1 md:col-span-2">
            <span class="text-xs font-medium">平台参考资料</span>
            <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.mp4,.mov" class="w-full rounded-xl border px-3 py-2 text-xs" />
          </label>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="rounded-xl border px-4 py-2 text-sm" data-factory-onboarding-action="close-sample-issue">取消</button>
          <button type="button" class="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground" data-factory-onboarding-action="submit-sample-issue">确认发放样衣</button>
        </div>
      </section>
    </div>
  `
}

function renderSampleReviewDialog(application: FactoryOnboardingApplication | null): string {
  if (!application) return ''
  const sampleVerification = getSampleVerificationForApplication(application)
  if (!sampleVerification) return ''
  const draft = state.sampleReviewDraft
  const errorLines = state.sampleReviewErrorText.split('\n').filter(Boolean)
  const needResubmitItems = draft.sampleReviewResult === '未通过'
  return `
    <div class="fixed inset-0 z-50" data-testid="factory-sample-review-dialog" data-factory-onboarding-dialog="sample-review">
      <button type="button" class="absolute inset-0 bg-black/35" data-factory-onboarding-action="close-sample-review"></button>
      <section class="absolute left-1/2 top-1/2 max-h-[92vh] w-[94vw] max-w-4xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-background p-5 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-lg font-semibold">平台样衣审核</h2>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-factory-onboarding-action="close-sample-review">关闭</button>
        </div>
        <div class="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div class="rounded-xl border bg-muted/20 px-3 py-2">入驻申请编号：${escapeHtml(application.applicationNo)}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">工厂/公司名称：${escapeHtml(application.factoryCompanyName)}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">姓名：${escapeHtml(application.applicantName)}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">手机号：${escapeHtml(getApplicationMobilePhone(application))}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">样衣验证编号：${escapeHtml(sampleVerification.verificationNo)}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">样衣批次号：${escapeHtml(sampleVerification.sampleBatchNo)}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">款号：${escapeHtml(sampleVerification.styleNo)}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">样衣名称：${escapeHtml(sampleVerification.sampleName)}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">样衣件数：${sampleVerification.sampleQuantity} 件</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">验证目的：${escapeHtml(sampleVerification.verificationPurpose.join('、'))}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">发放时间：${escapeHtml(sampleVerification.issuedAt)}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">工厂确认收样时间：${escapeHtml(sampleVerification.factoryReceivedAt || '—')}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">工厂提交时间：${escapeHtml(sampleVerification.factorySubmittedAt || '—')}</div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">工厂提交轮次：第${sampleVerification.factorySubmissionRoundNo || 1}轮</div>
        </div>
        <section class="mt-4 rounded-xl border border-blue-100 bg-blue-50/40 p-3 text-sm">
          <div class="mb-2 font-medium text-blue-800">工厂提交资料区</div>
          <div class="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <div class="rounded-xl border bg-white px-3 py-2 md:col-span-2">工艺说明：${escapeHtml(sampleVerification.factoryCraftDescription || '—')}</div>
            <div class="rounded-xl border bg-white px-3 py-2 md:col-span-2">问题说明：${escapeHtml(sampleVerification.factoryProblemDescription || '—')}</div>
            <div class="rounded-xl border bg-white px-3 py-2 md:col-span-2">备注：${escapeHtml(sampleVerification.factorySubmitRemark || '—')}</div>
          </div>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <section class="rounded-xl border bg-white p-3">
              <div class="mb-2 font-medium">样衣照片</div>
              ${renderReferenceFiles(sampleVerification.factorySamplePhotos || [], '暂无样衣照片')}
            </section>
            <section class="rounded-xl border bg-white p-3">
              <div class="mb-2 font-medium">样衣视频</div>
              ${renderReferenceFiles(sampleVerification.factorySampleVideos || [], '暂无样衣视频')}
            </section>
            <section class="rounded-xl border bg-white p-3">
              <div class="mb-2 font-medium">工厂照片</div>
              ${renderReferenceFiles(sampleVerification.factorySitePhotos || [], '暂无工厂照片')}
            </section>
            <section class="rounded-xl border bg-white p-3">
              <div class="mb-2 font-medium">工厂视频</div>
              ${renderReferenceFiles(sampleVerification.factorySiteVideos || [], '暂无工厂视频')}
            </section>
            <section class="rounded-xl border bg-white p-3">
              <div class="mb-2 font-medium">老板身份证复印件或照片</div>
              ${renderReferenceFiles(sampleVerification.bossIdentityFiles || [], '暂无老板身份证复印件或照片')}
            </section>
            <section class="rounded-xl border bg-white p-3">
              <div class="mb-2 font-medium">补充文件</div>
              ${renderReferenceFiles(sampleVerification.factorySubmissionFiles || [], '暂无补充文件')}
            </section>
          </div>
          <div class="mt-3 rounded-xl border bg-white px-3 py-2">老板身份证号码/护照号码：${escapeHtml(sampleVerification.bossIdentityNo || '—')}</div>
        </section>
        <section class="mt-4 rounded-xl border border-amber-100 bg-amber-50/40 p-3 text-sm">
          <div class="mb-2 font-medium text-amber-800">老板身份资料</div>
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            ${sampleVerification.bossIdentityNo ? `
              <div class="rounded-xl border bg-white px-3 py-2">老板身份证号码/护照号码：${escapeHtml(sampleVerification.bossIdentityNo)}</div>
            ` : `
              <label class="space-y-1">
                <span class="text-xs font-medium">老板身份证号码/护照号码</span>
                <input data-factory-onboarding-field="sampleReview-bossIdentityNo" value="${escapeHtml(draft.bossIdentityNo || '')}" class="h-10 w-full rounded-xl border bg-white px-3" placeholder="请输入老板身份证号码/护照号码" />
              </label>
            `}
            ${sampleVerification.bossIdentityFiles?.length ? `
              <section class="rounded-xl border bg-white p-3">
                <div class="mb-2 font-medium">老板身份证复印件或照片</div>
                ${renderReferenceFiles(sampleVerification.bossIdentityFiles, '暂无老板身份证复印件或照片')}
              </section>
            ` : `
              <label class="space-y-1">
                <span class="text-xs font-medium">老板身份证复印件或照片</span>
                <input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" data-factory-onboarding-file="sampleReview-bossIdentityFiles" class="w-full rounded-xl border bg-white px-3 py-2 text-xs" />
                <div class="rounded-xl border bg-white px-3 py-2 text-xs">已上传：${draft.bossIdentityFiles.length > 0 ? escapeHtml(draft.bossIdentityFiles.map((file) => file.fileName).join('、')) : '未上传'}</div>
              </label>
            `}
          </div>
        </section>
        ${errorLines.length > 0 ? `
          <div class="mt-4 space-y-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" data-testid="factory-sample-review-error">
            ${errorLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
          </div>
        ` : ''}
        <div class="mt-4 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
          <div class="space-y-2 md:col-span-2">
            <div class="text-sm font-medium">样衣审核结果 *</div>
            <div class="grid grid-cols-1 gap-2 md:grid-cols-3">
              ${FACTORY_SAMPLE_REVIEW_RESULT_OPTIONS.map((result) => `
                <label class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                  <input type="radio" name="factory-sample-review-result" value="${escapeHtml(result)}" data-factory-onboarding-field="sampleReview-sampleReviewResult" ${draft.sampleReviewResult === result ? 'checked' : ''} />
                  <span>${escapeHtml(result)}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <label class="space-y-1 md:col-span-2">
            <span class="text-xs font-medium">样衣审核意见 *</span>
            <textarea data-factory-onboarding-field="sampleReview-sampleReviewOpinion" class="min-h-24 w-full rounded-xl border px-3 py-2" placeholder="请输入样衣审核意见">${escapeHtml(draft.sampleReviewOpinion)}</textarea>
          </label>
          ${needResubmitItems ? `
            <div class="space-y-2 md:col-span-2">
              <div class="text-xs font-medium">需重新提交内容 *</div>
              <div class="grid grid-cols-2 gap-2 md:grid-cols-3">
                ${FACTORY_SAMPLE_REVIEW_REQUIRED_ITEM_OPTIONS.map((item) => `
                  <label class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                    <input type="checkbox" value="${escapeHtml(item)}" data-factory-onboarding-field="sampleReviewRequiredItem" ${draft.requiredResubmitItems.includes(item) ? 'checked' : ''} />
                    <span>${escapeHtml(item)}</span>
                  </label>
                `).join('')}
              </div>
            </div>
          ` : ''}
          <div class="space-y-2">
            <div class="text-xs font-medium">样衣质量结论</div>
            <div class="space-y-2">
              ${FACTORY_SAMPLE_QUALITY_CONCLUSION_OPTIONS.map((item) => `
                <label class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                  <input type="radio" name="factory-sample-quality-conclusion" value="${escapeHtml(item)}" data-factory-onboarding-field="sampleReview-sampleQualityConclusion" ${draft.sampleQualityConclusion === item ? 'checked' : ''} />
                  <span>${escapeHtml(item)}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <div class="space-y-2">
            <div class="text-xs font-medium">能力验证结论</div>
            <div class="space-y-2">
              ${FACTORY_SAMPLE_CAPACITY_CONCLUSION_OPTIONS.map((item) => `
                <label class="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm">
                  <input type="radio" name="factory-sample-capacity-conclusion" value="${escapeHtml(item)}" data-factory-onboarding-field="sampleReview-capacityConclusion" ${draft.capacityConclusion === item ? 'checked' : ''} />
                  <span>${escapeHtml(item)}</span>
                </label>
              `).join('')}
            </div>
          </div>
          <label class="space-y-1 md:col-span-2">
            <span class="text-xs font-medium">备注</span>
            <textarea data-factory-onboarding-field="sampleReview-remark" class="min-h-20 w-full rounded-xl border px-3 py-2" placeholder="请输入备注">${escapeHtml(draft.remark || '')}</textarea>
          </label>
        </div>
        <div class="mt-5 flex justify-end gap-2">
          <button type="button" class="rounded-xl border px-4 py-2 text-sm" data-factory-onboarding-action="close-sample-review">取消</button>
          <button type="button" class="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground" data-factory-onboarding-action="submit-sample-review">确认审核</button>
        </div>
      </section>
    </div>
  `
}

function renderConversionDialog(application: FactoryOnboardingApplication | null): string {
  if (!application) return ''
  const sampleVerification = getSampleVerificationForApplication(application)
  const latestSampleReview = sampleVerification?.sampleReviewRecords
    ? [...sampleVerification.sampleReviewRecords].sort((left, right) => right.sampleReviewRoundNo - left.sampleReviewRoundNo || right.reviewedAt.localeCompare(left.reviewedAt))[0]
    : null
  return `
    <div class="fixed inset-0 z-50" data-testid="factory-official-conversion-dialog" data-factory-onboarding-dialog="conversion">
      <button type="button" class="absolute inset-0 bg-black/35" data-factory-onboarding-action="close-conversion"></button>
      <aside class="absolute right-0 top-0 h-full w-full max-w-3xl overflow-y-auto border-l bg-background shadow-2xl">
        <div class="sticky top-0 z-10 border-b bg-background px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold">样衣通过后转正式合作</h2>
              <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(application.applicationNo)} · ${escapeHtml(application.factoryCompanyName)}</p>
            </div>
            <button type="button" class="rounded-full border px-3 py-1 text-xs" data-factory-onboarding-action="close-conversion">关闭</button>
          </div>
        </div>
        <div class="space-y-4 p-5">
          ${state.conversionErrorText ? `<div class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(state.conversionErrorText)}</div>` : ''}
          <section class="grid grid-cols-2 gap-3 text-sm">
            <div class="rounded-xl border px-3 py-2">入驻申请编号：${escapeHtml(application.applicationNo)}</div>
            <div class="rounded-xl border px-3 py-2">工厂/公司名称：${escapeHtml(application.factoryCompanyName)}</div>
            <div class="rounded-xl border px-3 py-2">姓名：${escapeHtml(application.applicantName)}</div>
            <div class="rounded-xl border px-3 py-2">手机号：${escapeHtml(getApplicationMobilePhone(application))}</div>
            <div class="col-span-2 rounded-xl border px-3 py-2">地址：${escapeHtml(application.address)}</div>
            <div class="rounded-xl border px-3 py-2">机器数量：${application.machineTotalCount}</div>
            <div class="rounded-xl border px-3 py-2">有效工人数量：${application.effectiveWorkerCount}</div>
            <div class="col-span-2 rounded-xl border px-3 py-2">已选工序工艺：${escapeHtml(application.selectedCapabilities.map((item) => `${item.processName}/${item.craftName}`).join('、'))}</div>
            <div class="rounded-xl border px-3 py-2">机器明细数量：${application.machines.length}</div>
            <div class="rounded-xl border px-3 py-2">样衣验证编号：${escapeHtml(sampleVerification?.verificationNo || '—')}</div>
            <div class="rounded-xl border px-3 py-2">样衣审核结果：${escapeHtml(latestSampleReview ? normalizeSampleReviewResult(latestSampleReview.sampleReviewResult) : '—')}</div>
            <div class="rounded-xl border px-3 py-2">样衣审核时间：${escapeHtml(latestSampleReview?.reviewedAt || '—')}</div>
            <div class="col-span-2 rounded-xl border px-3 py-2">样衣审核意见：${escapeHtml(latestSampleReview?.sampleReviewOpinion || '—')}</div>
          </section>
          <section class="grid grid-cols-2 gap-3 rounded-xl border bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            <div class="rounded-xl border border-emerald-200 bg-white/70 px-3 py-2">工厂档案：生成</div>
            <div class="rounded-xl border border-emerald-200 bg-white/70 px-3 py-2">管理员账号：转正</div>
            <div class="rounded-xl border border-emerald-200 bg-white/70 px-3 py-2">产能档案：生成</div>
            <div class="rounded-xl border border-emerald-200 bg-white/70 px-3 py-2">PDA 权限：开放</div>
          </section>
        </div>
        <div class="sticky bottom-0 flex justify-end gap-2 border-t bg-background px-5 py-4">
          <button type="button" class="rounded-xl border px-4 py-2 text-sm" data-factory-onboarding-action="close-conversion">取消</button>
          <button type="button" class="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground" data-factory-onboarding-action="submit-conversion">确认转正式</button>
        </div>
      </aside>
    </div>
  `
}

function renderPpicDialog(application: FactoryOnboardingApplication | null): string {
  if (!application) return ''
  const options = getAvailableOnboardingPpicOptions()
  const selectedId = state.ppicDraftId || application.assignedPpicId || options[0]?.ppicId || ''
  return `
    <div class="fixed inset-0 z-50" data-testid="ppic-edit-dialog" data-factory-onboarding-dialog="ppic">
      <button type="button" class="absolute inset-0 bg-black/35" data-factory-onboarding-action="close-ppic-dialog"></button>
      <aside class="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto border-l bg-background shadow-2xl">
        <div class="sticky top-0 z-10 border-b bg-background px-5 py-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold">修改 PPIC</h2>
              <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(application.applicationNo)} · ${escapeHtml(application.factoryCompanyName)}</p>
            </div>
            <button type="button" class="rounded-full border px-3 py-1 text-xs" data-factory-onboarding-action="close-ppic-dialog">关闭</button>
          </div>
        </div>
        <div class="space-y-4 p-5">
          ${state.ppicErrorText ? `<div class="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">${escapeHtml(state.ppicErrorText)}</div>` : ''}
          <label class="space-y-1 text-sm">
            <span class="text-xs font-medium">PPIC *</span>
            <select data-factory-onboarding-field="ppicDraftId" class="h-10 w-full rounded-xl border px-3">
              <option value="">请选择 PPIC</option>
              ${options.map((item) => `<option value="${escapeHtml(item.ppicId)}" ${selectedId === item.ppicId ? 'selected' : ''}>${escapeHtml(item.ppicName)}</option>`).join('')}
            </select>
          </label>
          <label class="space-y-1 text-sm">
            <span class="text-xs font-medium">修改原因</span>
            <textarea data-factory-onboarding-field="ppicChangeReason" class="min-h-24 w-full rounded-xl border px-3 py-2">${escapeHtml(state.ppicChangeReason)}</textarea>
          </label>
        </div>
        <div class="sticky bottom-0 flex justify-end gap-2 border-t bg-background px-5 py-4">
          <button type="button" class="rounded-xl border px-4 py-2 text-sm" data-factory-onboarding-action="close-ppic-dialog">取消</button>
          <button type="button" class="rounded-xl bg-primary px-4 py-2 text-sm text-primary-foreground" data-factory-onboarding-action="submit-ppic">确认修改</button>
        </div>
      </aside>
    </div>
  `
}

export function renderFactoryOnboardingPage(): string {
  syncDialogStateFromQuery(listApplications())
  const applications = filterApplications(listApplications())
  const selectedApplication = getSelectedApplication()
  const reviewApplication = state.reviewApplicationId ? listApplications().find((item) => item.applicationId === state.reviewApplicationId) || null : null
  const sampleIssueApplication = state.sampleIssueApplicationId ? listApplications().find((item) => item.applicationId === state.sampleIssueApplicationId) || null : null
  const sampleReviewApplication = state.sampleReviewApplicationId ? listApplications().find((item) => item.applicationId === state.sampleReviewApplicationId) || null : null
  const conversionApplication = state.conversionApplicationId ? listApplications().find((item) => item.applicationId === state.conversionApplicationId) || null : null
  const ppicApplication = state.ppicDialogApplicationId ? listApplications().find((item) => item.applicationId === state.ppicDialogApplicationId) || null : null
  return `
    <section class="space-y-4 p-6" data-testid="factory-onboarding-page">
      <header>
        <h1 class="text-2xl font-semibold text-foreground">工厂入驻管理</h1>
      </header>
      ${renderStatCards()}
      ${renderFilters()}
      ${renderApplicationTable(applications)}
      ${renderDetailDrawer(selectedApplication)}
      ${renderReviewDialog(reviewApplication)}
      ${renderSampleIssueDialog(sampleIssueApplication)}
      ${renderSampleReviewDialog(sampleReviewApplication)}
      ${renderConversionDialog(conversionApplication)}
      ${renderPpicDialog(ppicApplication)}
    </section>
  `
}

function updateSampleIssueField(field: string, value: string, checked?: boolean): void {
  state.sampleIssueErrorText = ''
  if (field === 'sampleIssuePurpose') {
    const purpose = value as FactorySampleIssuePayload['verificationPurpose'][number]
    const next = new Set(state.sampleIssueDraft.verificationPurpose)
    if (checked) {
      next.add(purpose)
    } else {
      next.delete(purpose)
    }
    state.sampleIssueDraft = {
      ...state.sampleIssueDraft,
      verificationPurpose: [...next],
    }
    return
  }
  if (!field.startsWith('sampleIssue-')) return
  const key = field.replace('sampleIssue-', '') as keyof FactorySampleIssuePayload
  if (key === 'sampleQuantity') {
    state.sampleIssueDraft = {
      ...state.sampleIssueDraft,
      sampleQuantity: Number(value),
    }
    return
  }
  state.sampleIssueDraft = {
    ...state.sampleIssueDraft,
    [key]: value,
  }
  if (key === 'issueMethod' && value !== '快递发放') {
    state.sampleIssueDraft.courierCompany = ''
    state.sampleIssueDraft.trackingNo = ''
  }
}

function updateSampleReviewField(field: string, value: string, checked?: boolean): void {
  state.sampleReviewErrorText = ''
  if (field === 'sampleReviewRequiredItem') {
    const item = value as FactorySampleReviewRequiredItem
    const next = new Set(state.sampleReviewDraft.requiredResubmitItems)
    if (checked) {
      next.add(item)
    } else {
      next.delete(item)
    }
    state.sampleReviewDraft = {
      ...state.sampleReviewDraft,
      requiredResubmitItems: [...next],
    }
    return
  }
  if (!field.startsWith('sampleReview-')) return
  const key = field.replace('sampleReview-', '') as keyof FactorySampleReviewPayload
  const nextDraft: FactorySampleReviewPayload = {
    ...state.sampleReviewDraft,
    [key]: value,
  } as FactorySampleReviewPayload
  if (key === 'sampleReviewResult') {
    nextDraft.resubmitAllowed = value === '未通过'
    if (value !== '未通过') nextDraft.requiredResubmitItems = []
  }
  state.sampleReviewDraft = nextDraft
}

function readSampleReviewDraftFromDom(): FactorySampleReviewPayload {
  if (typeof document === 'undefined') return state.sampleReviewDraft
  const result = document.querySelector<HTMLInputElement>('[data-factory-onboarding-field="sampleReview-sampleReviewResult"]:checked')?.value as FactorySampleReviewResult | undefined
  const sampleReviewOpinion = document.querySelector<HTMLTextAreaElement>('[data-factory-onboarding-field="sampleReview-sampleReviewOpinion"]')?.value
  const sampleQualityConclusion = document.querySelector<HTMLInputElement>('[data-factory-onboarding-field="sampleReview-sampleQualityConclusion"]:checked')?.value
  const capacityConclusion = document.querySelector<HTMLInputElement>('[data-factory-onboarding-field="sampleReview-capacityConclusion"]:checked')?.value
  const bossIdentityNo = document.querySelector<HTMLInputElement>('[data-factory-onboarding-field="sampleReview-bossIdentityNo"]')?.value
  const remark = document.querySelector<HTMLTextAreaElement>('[data-factory-onboarding-field="sampleReview-remark"]')?.value
  const requiredResubmitItems = Array.from(document.querySelectorAll<HTMLInputElement>('[data-factory-onboarding-field="sampleReviewRequiredItem"]:checked'))
    .map((item) => item.value as FactorySampleReviewRequiredItem)
  const sampleReviewResult = result || state.sampleReviewDraft.sampleReviewResult
  return {
    ...state.sampleReviewDraft,
    sampleReviewResult,
    sampleReviewOpinion: sampleReviewOpinion ?? state.sampleReviewDraft.sampleReviewOpinion,
    resubmitAllowed: sampleReviewResult === '未通过',
    requiredResubmitItems,
    sampleQualityConclusion: sampleQualityConclusion || state.sampleReviewDraft.sampleQualityConclusion,
    capacityConclusion: capacityConclusion || state.sampleReviewDraft.capacityConclusion,
    bossIdentityNo: bossIdentityNo ?? state.sampleReviewDraft.bossIdentityNo,
    bossIdentityFiles: state.sampleReviewDraft.bossIdentityFiles,
    remark: remark ?? state.sampleReviewDraft.remark,
  }
}

function updateField(field: string, value: string, checked?: boolean): void {
  if (field.startsWith('sampleIssue') || field === 'sampleIssuePurpose') {
    updateSampleIssueField(field, value, checked)
    return
  }
  if (field.startsWith('sampleReview') || field === 'sampleReviewRequiredItem') {
    updateSampleReviewField(field, value, checked)
    return
  }
  if (field === 'statusFilter' || field === 'processFilter' || field === 'craftFilter' || field === 'nodeFilter' || field === 'reviewResultFilter' || field === 'ppicFilter' || field === 'keyword') {
    ;(state[field] as string) = value
    if (field === 'processFilter' && value === 'ALL') {
      state.craftFilter = 'ALL'
    }
    return
  }
  if (field === 'ppicDraftId') {
    state.ppicDraftId = value
    state.ppicErrorText = ''
    return
  }
  if (field === 'ppicChangeReason') {
    state.ppicChangeReason = value
    return
  }
  if (field === 'reviewResult') {
    state.reviewResult = value as FactoryOnboardingReviewResult
    if (state.reviewResult !== '未通过') {
      state.reviewRequiredFields = []
    }
    return
  }
  if (field === 'reviewOpinion') {
    state.reviewOpinion = value
    return
  }
  if (field === 'reviewRequiredField') {
    const fieldValue = value as FactoryOnboardingRequiredField
    if (checked) {
      if (!state.reviewRequiredFields.includes(fieldValue)) state.reviewRequiredFields.push(fieldValue)
    } else {
      state.reviewRequiredFields = state.reviewRequiredFields.filter((item) => item !== fieldValue)
    }
  }
}

export async function handleFactoryOnboardingEvent(target: HTMLElement): Promise<boolean> {
  const fileNode = target.closest<HTMLElement>('[data-factory-onboarding-file]')
  if (fileNode instanceof HTMLInputElement) {
    updateSampleReviewFilesFromInput(fileNode, fileNode.dataset.factoryOnboardingFile || '')
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-factory-onboarding-field]')
  if (fieldNode instanceof HTMLInputElement) {
    updateField(fieldNode.dataset.factoryOnboardingField || '', fieldNode.value, fieldNode.checked)
    return true
  }
  if (fieldNode instanceof HTMLSelectElement || fieldNode instanceof HTMLTextAreaElement) {
    updateField(fieldNode.dataset.factoryOnboardingField || '', fieldNode.value)
    return true
  }

  const actionNode = target.closest<HTMLElement>('[data-factory-onboarding-action]')
  const action = actionNode?.dataset.factoryOnboardingAction
  if (!action) return false

  if (action === 'view-detail') {
    state.selectedApplicationId = actionNode?.dataset.applicationId || null
    state.detailTab = 'basic'
    return true
  }
  if (action === 'view-sample') {
    state.selectedApplicationId = actionNode?.dataset.applicationId || null
    state.detailTab = 'sample'
    return true
  }
  if (action === 'view-factory-profile') {
    window.location.hash = '#/fcs/factories/profile'
    return true
  }
  if (action === 'close-detail') {
    state.selectedApplicationId = null
    return true
  }
  if (action === 'switch-detail-tab') {
    state.detailTab = (actionNode?.dataset.tab as FactoryOnboardingPageState['detailTab']) || 'basic'
    return true
  }
  if (action === 'open-ppic-dialog') {
    const applicationId = actionNode?.dataset.applicationId || ''
    const application = listApplications().find((item) => item.applicationId === applicationId)
    const options = getAvailableOnboardingPpicOptions()
    state.ppicDialogApplicationId = applicationId || null
    state.ppicDraftId = application?.assignedPpicId || options[0]?.ppicId || ''
    state.ppicChangeReason = ''
    state.ppicErrorText = ''
    return true
  }
  if (action === 'close-ppic-dialog') {
    state.ppicDialogApplicationId = null
    state.ppicErrorText = ''
    return true
  }
  if (action === 'submit-ppic') {
    state.errorText = ''
    state.successText = ''
    state.ppicErrorText = ''
    try {
      const dialog = actionNode?.closest<HTMLElement>('[data-factory-onboarding-dialog="ppic"]') || document
      const nextPpicId = dialog.querySelector<HTMLSelectElement>('[data-factory-onboarding-field="ppicDraftId"]')?.value || state.ppicDraftId
      const changeReason = dialog.querySelector<HTMLTextAreaElement>('[data-factory-onboarding-field="ppicChangeReason"]')?.value || state.ppicChangeReason
      const updated = updateOnboardingPpic(
        state.ppicDialogApplicationId || '',
        nextPpicId,
        '平台运营员',
        changeReason,
      )
      state.ppicDialogApplicationId = null
      state.selectedApplicationId = updated.applicationId
      state.detailTab = 'basic'
      state.successText = 'PPIC 已修改'
    } catch (error) {
      state.ppicErrorText = error instanceof Error ? error.message : 'PPIC 修改失败'
    }
    return true
  }
  if (action === 'open-review') {
    state.reviewApplicationId = actionNode?.dataset.applicationId || null
    state.reviewResult = '已通过'
    state.reviewOpinion = ''
    state.reviewRequiredFields = []
    return true
  }
  if (action === 'open-sample-issue') {
    const applicationId = actionNode?.dataset.applicationId || ''
    const application = listApplications().find((item) => item.applicationId === applicationId)
    state.errorText = ''
    state.successText = ''
    if (!application) {
      state.errorText = '未找到入驻申请'
      return true
    }
    if (application.sampleVerificationId || getSampleVerificationForApplication(application)) {
      state.errorText = '当前申请已登记样衣，请勿重复发放。'
      return true
    }
    state.sampleIssueApplicationId = applicationId
    state.sampleIssueDraft = createSampleIssuePayload()
    state.sampleIssueErrorText = ''
    return true
  }
  if (action === 'close-sample-issue') {
    state.sampleIssueApplicationId = null
    state.sampleIssueErrorText = ''
    return true
  }
  if (action === 'open-sample-review') {
    const applicationId = actionNode?.dataset.applicationId || ''
    const application = listApplications().find((item) => item.applicationId === applicationId)
    const sampleVerification = getSampleVerificationForApplication(application || null)
    state.errorText = ''
    state.successText = ''
    if (!application || !sampleVerification) {
      state.errorText = '未找到样衣验证记录'
      return true
    }
    if (sampleVerification.status !== '待平台审核样衣') {
      state.errorText = '当前状态不能进行样衣审核'
      return true
    }
    state.sampleReviewApplicationId = applicationId
    state.sampleReviewDraft = createDefaultSampleReviewDraft()
    state.sampleReviewErrorText = ''
    return true
  }
  if (action === 'open-conversion') {
    const applicationId = actionNode?.dataset.applicationId || ''
    const application = listApplications().find((item) => item.applicationId === applicationId)
    const sampleVerification = getSampleVerificationForApplication(application || null)
    state.errorText = ''
    state.successText = ''
    state.conversionErrorText = ''
    if (!application || application.status !== '样衣审核通过待转正式' || sampleVerification?.status !== '样衣审核通过') {
      state.errorText = '只有样衣审核通过待转正式的申请可以转为正式合作工厂。'
      return true
    }
    state.conversionApplicationId = applicationId
    return true
  }
  if (action === 'close-conversion') {
    state.conversionApplicationId = null
    state.conversionErrorText = ''
    return true
  }
  if (action === 'close-sample-review') {
    state.sampleReviewApplicationId = null
    state.sampleReviewErrorText = ''
    return true
  }
  if (action === 'submit-sample-issue') {
    state.errorText = ''
    state.successText = ''
    state.sampleIssueErrorText = ''
    try {
      const result = issueSampleForOnboarding(
        state.sampleIssueApplicationId || '',
        state.sampleIssueDraft,
        state.sampleIssueDraft.issuedBy || '平台样衣员',
      )
      state.sampleIssueApplicationId = null
      state.selectedApplicationId = result.application.applicationId
      state.detailTab = 'sample'
      state.successText = '样衣已登记并发放'
    } catch (error) {
      state.sampleIssueErrorText = error instanceof Error ? error.message : '发放样衣失败'
    }
    return true
  }
  if (action === 'submit-sample-review') {
    state.errorText = ''
    state.successText = ''
    state.sampleReviewErrorText = ''
    try {
      const application = listApplications().find((item) => item.applicationId === state.sampleReviewApplicationId)
      const sampleVerification = getSampleVerificationForApplication(application || null)
      if (!sampleVerification) throw new Error('未找到样衣验证记录')
      state.sampleReviewDraft = readSampleReviewDraftFromDom()
      const result = reviewFactorySample(
        sampleVerification.verificationId,
        state.sampleReviewDraft,
        '平台样衣审核员',
      )
      state.sampleReviewApplicationId = null
      state.selectedApplicationId = result.application.applicationId
      state.detailTab = 'sample'
      state.successText = '样衣审核结果已保存'
    } catch (error) {
      state.sampleReviewErrorText = error instanceof Error ? error.message : '样衣审核失败'
    }
    return true
  }
  if (action === 'submit-conversion') {
    state.errorText = ''
    state.successText = ''
    state.conversionErrorText = ''
    try {
      const result = await convertOnboardingToOfficialFactory(
        state.conversionApplicationId || '',
        '平台转档员',
      )
      state.conversionApplicationId = null
      state.selectedApplicationId = result.application.applicationId
      state.detailTab = 'conversion'
      state.successText = '已转正式合作，工厂档案、管理员账号和产能档案初始数据已生成'
    } catch (error) {
      state.conversionErrorText = error instanceof Error ? error.message : '转正式失败'
    }
    return true
  }
  if (action === 'close-review') {
    state.reviewApplicationId = null
    return true
  }
  if (action === 'submit-review') {
    state.errorText = ''
    state.successText = ''
    try {
      const updated = reviewFactoryOnboardingApplication({
        applicationId: state.reviewApplicationId || '',
        reviewResult: state.reviewResult,
        reviewOpinion: state.reviewOpinion,
        reviewer: '平台审核员',
        requiredFields: state.reviewRequiredFields,
      })
      state.reviewApplicationId = null
      state.selectedApplicationId = updated.applicationId
      state.detailTab = 'review'
      state.successText = '审核结果已保存'
    } catch (error) {
      state.errorText = error instanceof Error ? error.message : '审核失败'
    }
    return true
  }
  return false
}

export function isFactoryOnboardingDialogOpen(): boolean {
  return Boolean(state.selectedApplicationId || state.reviewApplicationId || state.sampleIssueApplicationId || state.sampleReviewApplicationId || state.conversionApplicationId || state.ppicDialogApplicationId)
}
