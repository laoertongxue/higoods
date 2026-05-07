import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import {
  FACTORY_ONBOARDING_NODE_OPTIONS,
  normalizeReviewResult,
  type FactoryOnboardingApplication,
  type FactoryOnboardingDraftPayload,
  type FactoryOnboardingMachineAbility,
  type FactoryOnboardingNode,
  type FactoryOnboardingRequiredField,
  type FactoryOnboardingSelectedCapability,
} from '../data/fcs/factory-onboarding-domain.ts'
import {
  activateOnboardingSession,
  applyMachineValidation,
  calculateOnboardingCompleteness,
  canEditOnboardingApplication,
  canSubmitOnboardingApplication,
  createCapabilityFromSelection,
  createDefaultMachineDraft,
  createDefaultOnboardingDraft,
  getCompletenessMissingItems,
  getFactoryOnboardingCurrentNodeSummary,
  getPrimaryFactoryType,
  inferFactoryTypesFromCapabilities,
  getLatestReviewRecord,
  getLatestSupplementRecord,
  getOnboardingStatusActionLabel,
  getPdaOnboardingApplicationFromSession,
  listSelectableProcessCraftOptions,
  logoutPdaAccess,
  saveFactoryOnboardingDraft,
  submitFactoryOnboardingApplication,
  validateFactoryOnboardingDraftPayload,
} from '../data/fcs/factory-onboarding-flow.ts'
import { findFactoryOnboardingApplicationByLoginId, getFactoryOnboardingApplicationById } from '../data/fcs/factory-onboarding-store.ts'
import { normalizeSampleReviewResult, type FactorySampleReferenceFile } from '../data/fcs/factory-sample-verification-domain.ts'
import type {
  FactorySampleReceivePayload,
  FactorySampleSubmissionPayload,
} from '../data/fcs/factory-sample-verification-domain.ts'
import {
  confirmFactoryReceivedSample,
  submitFactorySampleReview,
} from '../data/fcs/factory-sample-verification-flow.ts'
import {
  getSampleVerificationByApplicationId,
  getSampleVerificationById,
} from '../data/fcs/factory-sample-verification-store.ts'
import { getPdaRuntimeContext } from './pda-runtime'

interface PdaOnboardingState {
  applicationId: string | null
  selectedProcessCode: string
  confirmPassword: string
  showCompletenessItems: boolean
  draft: FactoryOnboardingDraftPayload
  errorText: string
  successText: string
  sampleReceiveVerificationId: string | null
  sampleReceiveDraft: FactorySampleReceivePayload
  sampleReceiveErrorText: string
  sampleSubmissionDraft: FactorySampleSubmissionPayload
  sampleSubmissionErrorText: string
}

const NEW_APPLICATION_KEY = '__NEW__'

const state: PdaOnboardingState = {
  applicationId: null,
  selectedProcessCode: '',
  confirmPassword: '',
  showCompletenessItems: false,
  draft: createDefaultOnboardingDraft(),
  errorText: '',
  successText: '',
  sampleReceiveVerificationId: null,
  sampleReceiveDraft: {
    factoryReceivedAt: '',
    factoryReceivedBy: '',
    factoryReceiveRemark: '',
  },
  sampleReceiveErrorText: '',
  sampleSubmissionDraft: {
    factorySamplePhotos: [],
    factorySampleVideos: [],
    factoryCraftDescription: '',
    factoryProblemDescription: '',
    factorySubmitRemark: '',
    factorySubmissionFiles: [],
    factorySitePhotos: [],
    factorySiteVideos: [],
    bossIdentityNo: '',
    bossIdentityFiles: [],
  },
  sampleSubmissionErrorText: '',
}

function getCurrentSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return new URLSearchParams(query || '')
}

function getReturnTo(): string {
  return getCurrentSearchParams().get('returnTo') || '/fcs/pda/exec'
}

function hydrateDraftFromApplication(application: FactoryOnboardingApplication | null): void {
  if (!application) {
    state.applicationId = NEW_APPLICATION_KEY
    state.confirmPassword = ''
    state.showCompletenessItems = false
    state.draft = createDefaultOnboardingDraft()
    state.sampleReceiveVerificationId = null
    state.sampleReceiveErrorText = ''
    state.sampleSubmissionErrorText = ''
    return
  }

  state.applicationId = application.applicationId
  state.confirmPassword = application.adminAccount.password
  state.draft = {
    applicationId: application.applicationId,
    applicationNo: application.applicationNo,
    factoryTempId: application.factoryTempId,
    factoryShortName: application.factoryShortName,
    applicantName: application.applicantName,
    identityNo: application.identityNo,
    identityFile: application.identityFile,
    factoryCompanyName: application.factoryCompanyName,
    factoryName: application.factoryCompanyName,
    bossName: application.applicantName,
    mobilePhone: application.mobilePhone,
    mobileOrWhatsapp: application.mobilePhone,
    whatsapp: application.mobilePhone,
    address: application.address,
    sourceChannel: application.sourceChannel,
    ppicName: application.ppicName,
    machineTotalCount: application.machineTotalCount,
    effectiveWorkerCount: application.effectiveWorkerCount,
    availableStartDate: application.availableStartDate,
    selectedCapabilities: application.selectedCapabilities.map((item) => ({ ...item })),
    machines: application.machines.map((item) => ({ ...item })),
    adminAccount: { ...application.adminAccount },
  }
  state.sampleReceiveVerificationId = null
  state.sampleReceiveErrorText = ''
  state.sampleSubmissionErrorText = ''
  state.sampleSubmissionDraft = {
    factorySamplePhotos: [],
    factorySampleVideos: [],
    factoryCraftDescription: '',
    factoryProblemDescription: '',
    factorySubmitRemark: '',
    factorySubmissionFiles: [],
    factorySitePhotos: [],
    factorySiteVideos: [],
    bossIdentityNo: '',
    bossIdentityFiles: [],
  }
}

function syncMachineValidation(): void {
  state.draft.machines = applyMachineValidation(state.draft.machines, state.draft.selectedCapabilities)
}

function syncPageState(): FactoryOnboardingApplication | null {
  const runtime = getPdaRuntimeContext()
  const queryApplicationId = getCurrentSearchParams().get('applicationId')
  const sessionApplication = getPdaOnboardingApplicationFromSession()
  const runtimeApplication = runtime ? findFactoryOnboardingApplicationByLoginId(runtime.loginId) : null
  const application =
    (queryApplicationId ? getFactoryOnboardingApplicationById(queryApplicationId) : null)
    || sessionApplication
    || runtimeApplication
    || null

  const nextKey = application?.applicationId || NEW_APPLICATION_KEY
  if (state.applicationId !== nextKey) {
    hydrateDraftFromApplication(application)
  }

  if (!state.draft.adminAccount.roleId) {
    state.draft.adminAccount.roleId = 'FACTORY_ADMIN'
    state.draft.adminAccount.roleName = '工厂管理员'
  }

  if (!state.selectedProcessCode) {
    state.selectedProcessCode = listSelectableProcessCraftOptions()[0]?.processCode || ''
  }

  syncMachineValidation()
  return application
}

function renderNodeStatusChip(label: string, tone: 'done' | 'current' | 'todo' | 'warn' | 'stop'): string {
  const className =
    tone === 'done'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'current'
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : tone === 'warn'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : tone === 'stop'
            ? 'border-red-200 bg-red-50 text-red-700'
            : 'border-border bg-muted text-muted-foreground'
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-[10px] ${className}">${escapeHtml(label)}</span>`
}

const LEGACY_SAMPLE_REJECTED_STATUS = '样衣审核' + '拒绝'

function getPdaSampleStatusLabel(status: string): string {
  if (status === LEGACY_SAMPLE_REJECTED_STATUS) return '样衣审核退回'
  if (status === '样衣审核通过') return '待转正式合作'
  return status
}

function getNodeTone(status: string): 'done' | 'current' | 'todo' | 'warn' | 'stop' {
  if (status === '已完成') return 'done'
  if (status === '进行中') return 'current'
  if (status === '已退回') return 'warn'
  if (status === '已终止') return 'stop'
  return 'todo'
}

function buildNodeSnapshot(application: FactoryOnboardingApplication | null, nodeName: FactoryOnboardingNode) {
  const log = application?.nodeLogs.find((item) => item.nodeName === nodeName)
  return {
    nodeName,
    nodeStatus: log?.nodeStatus || (application ? '未开始' : nodeName === '填写入驻申请' ? '进行中' : '未开始'),
    elapsedText: log?.elapsedText || (application ? '-' : nodeName === '填写入驻申请' ? '0分钟' : '-'),
    actionCount: log?.actionCount || (application ? 0 : nodeName === '填写入驻申请' ? 1 : 0),
  }
}

function renderFlowCard(application: FactoryOnboardingApplication | null): string {
  return `
    <section data-testid="pda-onboarding-flow" class="rounded-2xl border bg-card p-3 shadow-sm">
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-semibold">入驻流程</h2>
        <span class="text-[11px] text-muted-foreground">共 ${FACTORY_ONBOARDING_NODE_OPTIONS.length} 个节点</span>
      </div>
      <div class="space-y-2">
        ${FACTORY_ONBOARDING_NODE_OPTIONS.map((nodeName) => {
          const snapshot = buildNodeSnapshot(application, nodeName)
          const tone = getNodeTone(snapshot.nodeStatus)
          return `
            <article class="rounded-xl border px-3 py-2 ${tone === 'current' ? 'border-blue-200 bg-blue-50/60' : tone === 'done' ? 'border-emerald-200 bg-emerald-50/60' : tone === 'warn' ? 'border-amber-200 bg-amber-50/60' : tone === 'stop' ? 'border-red-200 bg-red-50/60' : 'border-border bg-muted/30'}">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <div class="text-xs font-medium">${escapeHtml(nodeName)}</div>
                  <div class="mt-1 text-[11px] text-muted-foreground">节点耗时：${escapeHtml(snapshot.elapsedText)} · 动作次数：第${Math.max(0, snapshot.actionCount)}次动作</div>
                </div>
                ${renderNodeStatusChip(snapshot.nodeStatus, tone)}
              </div>
            </article>
          `
        }).join('')}
      </div>
    </section>
  `
}

function renderCurrentStatusCard(application: FactoryOnboardingApplication | null): string {
  if (!application) {
    return `
      <section class="rounded-2xl border bg-card p-3 shadow-sm">
        <h2 class="text-sm font-semibold">当前状态</h2>
        <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div class="rounded-xl border bg-muted/20 px-3 py-2">当前节点：<span class="font-medium">填写入驻申请</span></div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">当前状态：<span class="font-medium">草稿</span></div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">已在当前节点耗时：<span class="font-medium">0分钟</span></div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">当前节点动作次数：<span class="font-medium">第1次动作</span></div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">上次动作：<span class="font-medium">保存草稿</span></div>
          <div class="rounded-xl border bg-muted/20 px-3 py-2">上次操作时间：<span class="font-medium">—</span></div>
        </div>
      </section>
    `
  }

  const summary = getFactoryOnboardingCurrentNodeSummary(application)
  return `
    <section data-testid="pda-onboarding-current-card" class="rounded-2xl border bg-card p-3 shadow-sm">
      <div class="flex items-start justify-between gap-3">
        <h2 class="text-sm font-semibold">当前状态</h2>
        ${renderNodeStatusChip(application.status, application.status === '已转正式合作' ? 'done' : application.accountLocked ? 'stop' : 'current')}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div class="rounded-xl border bg-muted/20 px-3 py-2">当前节点：<span data-testid="pda-onboarding-current-node" class="font-medium">${escapeHtml(summary.currentNode)}</span></div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">当前状态：<span class="font-medium">${escapeHtml(summary.currentStatusLabel)}</span></div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">已在当前节点耗时：<span data-testid="pda-onboarding-current-elapsed" class="font-medium">${escapeHtml(summary.elapsedText)}</span></div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">当前节点动作次数：<span data-testid="pda-onboarding-current-actions" class="font-medium">${escapeHtml(summary.actionCountText)}</span></div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">上次动作：<span data-testid="pda-onboarding-last-action" class="font-medium">${escapeHtml(summary.lastActionName)}</span></div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">上次操作时间：<span class="font-medium">${escapeHtml(summary.lastOperatedAt)}</span></div>
      </div>
    </section>
  `
}

function getSampleVerificationForApplication(application: FactoryOnboardingApplication | null) {
  if (!application) return null
  return (application.sampleVerificationId ? getSampleVerificationById(application.sampleVerificationId) : null)
    || getSampleVerificationByApplicationId(application.applicationId)
}

function renderPdaReferenceFiles(files: FactorySampleReferenceFile[], emptyText: string): string {
  if (files.length <= 0) return `<div class="rounded-xl border border-dashed px-3 py-2 text-muted-foreground">${escapeHtml(emptyText)}</div>`
  return `
    <div class="space-y-2">
      ${files.map((file) => `
        <div class="rounded-xl border px-3 py-2">
          <div class="font-medium">${escapeHtml(file.fileName)}</div>
          <div class="mt-1 text-muted-foreground">大小：${file.fileSizeMb}MB · 上传时间：${escapeHtml(file.uploadedAt)}</div>
        </div>
      `).join('')}
    </div>
  `
}

function nowTimestamp(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function toDatetimeLocalValue(value: string): string {
  return value ? value.replace(' ', 'T').slice(0, 16) : ''
}

function renderFactorySampleSubmittedInfo(sampleVerification: ReturnType<typeof getSampleVerificationForApplication>): string {
  if (!sampleVerification?.factorySubmittedAt) return ''
  return `
    <div class="mt-3 space-y-3 text-xs" data-testid="pda-sample-submitted-info">
      <div class="rounded-xl border bg-muted/20 px-3 py-2">提交时间：${escapeHtml(sampleVerification.factorySubmittedAt)}</div>
      <div class="rounded-xl border bg-muted/20 px-3 py-2">提交人：${escapeHtml(sampleVerification.factorySubmittedBy || '—')}</div>
      <div class="rounded-xl border bg-muted/20 px-3 py-2">工艺说明：${escapeHtml(sampleVerification.factoryCraftDescription || '—')}</div>
      <div class="rounded-xl border bg-muted/20 px-3 py-2">问题说明：${escapeHtml(sampleVerification.factoryProblemDescription || '—')}</div>
      <div class="rounded-xl border bg-muted/20 px-3 py-2">备注：${escapeHtml(sampleVerification.factorySubmitRemark || '—')}</div>
      <div>
        <div class="mb-1 font-medium">已提交样衣照片</div>
        ${renderPdaReferenceFiles(sampleVerification.factorySamplePhotos || [], '暂无已提交样衣照片')}
      </div>
      <div>
        <div class="mb-1 font-medium">已提交样衣视频</div>
        ${renderPdaReferenceFiles(sampleVerification.factorySampleVideos || [], '暂无已提交样衣视频')}
      </div>
      <div>
        <div class="mb-1 font-medium">已提交工厂照片</div>
        ${renderPdaReferenceFiles(sampleVerification.factorySitePhotos || [], '暂无已提交工厂照片')}
      </div>
      <div>
        <div class="mb-1 font-medium">已提交工厂视频</div>
        ${renderPdaReferenceFiles(sampleVerification.factorySiteVideos || [], '暂无已提交工厂视频')}
      </div>
      <div class="rounded-xl border bg-muted/20 px-3 py-2">老板身份证号码/护照号码：${escapeHtml(sampleVerification.bossIdentityNo || '未提交')}</div>
      <div>
        <div class="mb-1 font-medium">老板身份证复印件或照片</div>
        ${renderPdaReferenceFiles(sampleVerification.bossIdentityFiles || [], '暂无老板身份证复印件或照片')}
      </div>
      <div>
        <div class="mb-1 font-medium">补充文件</div>
        ${renderPdaReferenceFiles(sampleVerification.factorySubmissionFiles || [], '暂无补充文件')}
      </div>
    </div>
  `
}

function renderReceiveInfo(sampleVerification: ReturnType<typeof getSampleVerificationForApplication>): string {
  if (!sampleVerification?.factoryReceivedAt) return ''
  return `
    <div class="mt-3 grid grid-cols-1 gap-2 text-xs">
      <div class="rounded-xl border bg-muted/20 px-3 py-2">确认收样时间：${escapeHtml(sampleVerification.factoryReceivedAt)}</div>
      <div class="rounded-xl border bg-muted/20 px-3 py-2">确认收样人：${escapeHtml(sampleVerification.factoryReceivedBy || '—')}</div>
      <div class="rounded-xl border bg-muted/20 px-3 py-2">收样备注：${escapeHtml(sampleVerification.factoryReceiveRemark || '—')}</div>
    </div>
  `
}

function renderFactorySampleSubmitForm(isResubmit = false): string {
  const draft = state.sampleSubmissionDraft
  const errorLines = state.sampleSubmissionErrorText.split('\n').filter(Boolean)
  return `
    <div class="mt-4 rounded-2xl border border-blue-100 bg-blue-50/40 p-3" data-testid="pda-sample-submit-form">
      <h4 class="text-sm font-semibold text-slate-900">${isResubmit ? '重新提交样衣审核' : '提交样衣审核资料'}</h4>
      ${errorLines.length > 0 ? `
        <div class="mt-3 space-y-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" data-testid="pda-sample-submit-error">
          ${errorLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
        </div>
      ` : ''}
      <div class="mt-3 space-y-4 text-xs">
        <section class="space-y-3 rounded-2xl border bg-white/70 p-3">
          <h5 class="text-sm font-semibold">样衣资料</h5>
        <label class="block space-y-1.5">
          <span class="font-medium">上传样衣照片 *</span>
          <input type="file" multiple accept=".jpg,.jpeg,.png,.webp" data-testid="pda-sample-photo-upload" data-pda-onboarding-file="factorySamplePhotos" class="w-full rounded-2xl border bg-white px-3 py-2" />
          <div class="rounded-xl border bg-white px-3 py-2">已上传：${draft.factorySamplePhotos.length > 0 ? escapeHtml(draft.factorySamplePhotos.map((file) => file.fileName).join('、')) : '未上传'}</div>
        </label>
        <label class="block space-y-1.5">
          <span class="font-medium">上传样衣视频 *</span>
          <input type="file" multiple accept=".mp4,.mov" data-testid="pda-sample-video-upload" data-pda-onboarding-file="factorySampleVideos" class="w-full rounded-2xl border bg-white px-3 py-2" />
          <div class="rounded-xl border bg-white px-3 py-2">已上传：${draft.factorySampleVideos.length > 0 ? escapeHtml(draft.factorySampleVideos.map((file) => file.fileName).join('、')) : '未上传'}</div>
        </label>
        <label class="block space-y-1.5">
          <span class="font-medium">工艺说明 *</span>
          <textarea data-testid="pda-sample-craft-description" data-pda-onboarding-field="sampleSubmission-factoryCraftDescription" class="min-h-24 w-full rounded-2xl border bg-white px-3 py-2" placeholder="请说明样衣制作过程、使用工艺、关键注意点">${escapeHtml(draft.factoryCraftDescription)}</textarea>
        </label>
        <label class="block space-y-1.5">
          <span class="font-medium">问题说明</span>
          <textarea data-pda-onboarding-field="sampleSubmission-factoryProblemDescription" class="min-h-20 w-full rounded-2xl border bg-white px-3 py-2" placeholder="如制作过程中存在问题，请填写">${escapeHtml(draft.factoryProblemDescription || '')}</textarea>
        </label>
        <label class="block space-y-1.5">
          <span class="font-medium">备注</span>
          <textarea data-pda-onboarding-field="sampleSubmission-factorySubmitRemark" class="min-h-20 w-full rounded-2xl border bg-white px-3 py-2" placeholder="请输入备注">${escapeHtml(draft.factorySubmitRemark || '')}</textarea>
        </label>
        <label class="block space-y-1.5">
          <span class="font-medium">补充文件</span>
          <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.webp,.mp4,.mov" data-pda-onboarding-file="factorySubmissionFiles" class="w-full rounded-2xl border bg-white px-3 py-2" />
          <div class="rounded-xl border bg-white px-3 py-2">已上传：${draft.factorySubmissionFiles.length > 0 ? escapeHtml(draft.factorySubmissionFiles.map((file) => file.fileName).join('、')) : '未上传'}</div>
        </label>
        </section>
        <section class="space-y-3 rounded-2xl border bg-white/70 p-3">
          <h5 class="text-sm font-semibold">工厂资料</h5>
          <label class="block space-y-1.5">
            <span class="font-medium">上传工厂照片 *</span>
            <input type="file" multiple accept=".jpg,.jpeg,.png,.webp" data-testid="factory-site-photo-upload" data-pda-onboarding-file="factorySitePhotos" class="w-full rounded-2xl border bg-white px-3 py-2" />
            <div class="rounded-xl border bg-white px-3 py-2">已上传：${draft.factorySitePhotos.length > 0 ? escapeHtml(draft.factorySitePhotos.map((file) => file.fileName).join('、')) : '未上传'}</div>
          </label>
          <label class="block space-y-1.5">
            <span class="font-medium">上传工厂视频 *</span>
            <input type="file" multiple accept=".mp4,.mov" data-testid="factory-site-video-upload" data-pda-onboarding-file="factorySiteVideos" class="w-full rounded-2xl border bg-white px-3 py-2" />
            <div class="rounded-xl border bg-white px-3 py-2">已上传：${draft.factorySiteVideos.length > 0 ? escapeHtml(draft.factorySiteVideos.map((file) => file.fileName).join('、')) : '未上传'}</div>
          </label>
        </section>
        <section class="space-y-3 rounded-2xl border bg-white/70 p-3">
          <h5 class="text-sm font-semibold">老板身份资料</h5>
          <label class="block space-y-1.5">
            <span class="font-medium">老板身份证号码/护照号码（可选）</span>
            <input data-testid="boss-identity-no-input" data-pda-onboarding-field="sampleSubmission-bossIdentityNo" value="${escapeHtml(draft.bossIdentityNo || '')}" class="h-10 w-full rounded-2xl border bg-white px-3" placeholder="请输入老板身份证号码/护照号码" />
          </label>
          <label class="block space-y-1.5">
            <span class="font-medium">老板身份证复印件或照片（可选）</span>
            <input type="file" multiple accept=".jpg,.jpeg,.png,.webp,.pdf" data-testid="boss-identity-file-upload" data-pda-onboarding-file="bossIdentityFiles" class="w-full rounded-2xl border bg-white px-3 py-2" />
            <div class="rounded-xl border bg-white px-3 py-2">已上传：${draft.bossIdentityFiles.length > 0 ? escapeHtml(draft.bossIdentityFiles.map((file) => file.fileName).join('、')) : '未上传'}</div>
          </label>
        </section>
        <button type="button" class="h-11 w-full rounded-2xl bg-primary text-sm font-medium text-primary-foreground" data-testid="pda-submit-sample-review" data-pda-onboarding-action="submit-sample-review">${isResubmit ? '重新提交样衣审核' : '提交样衣审核'}</button>
      </div>
    </div>
  `
}

function renderSampleVerificationCard(application: FactoryOnboardingApplication | null): string {
  const sampleVerification = getSampleVerificationForApplication(application)
  if (!sampleVerification) return ''
  const latestSampleReview = sampleVerification.sampleReviewRecords.at(-1)
  const isWaitReceive = sampleVerification.status === '待工厂确认收样'
  const canSubmitSample = sampleVerification.status === '待工厂提交样衣审核' || sampleVerification.status === '样衣审核退回'
  const isReadonlySubmitted = sampleVerification.status === '待平台审核样衣'
  const sampleStatusLabel = getPdaSampleStatusLabel(sampleVerification.status)
  return `
    <section class="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm" data-testid="pda-sample-verification-card">
      <span class="sr-only" data-testid="pda-sample-card">样衣验证</span>
      <div class="flex items-start justify-between gap-3">
        <h3 class="text-sm font-semibold">样衣验证</h3>
        ${renderNodeStatusChip(`当前状态：${sampleStatusLabel}`, 'current')}
      </div>
      <div class="mt-3 grid grid-cols-1 gap-2 text-xs">
        <div class="rounded-xl border bg-muted/20 px-3 py-2">样衣批次号：${escapeHtml(sampleVerification.sampleBatchNo)}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">款号：${escapeHtml(sampleVerification.styleNo)}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">样衣名称：${escapeHtml(sampleVerification.sampleName)}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">样衣件数：${sampleVerification.sampleQuantity} 件</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">样衣说明：${escapeHtml(sampleVerification.sampleDescription)}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">验证目的：${escapeHtml(sampleVerification.verificationPurpose.join('、'))}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">发放方式：${escapeHtml(sampleVerification.issueMethod)}</div>
        ${sampleVerification.courierCompany ? `<div class="rounded-xl border bg-muted/20 px-3 py-2">快递公司：${escapeHtml(sampleVerification.courierCompany)}</div>` : ''}
        ${sampleVerification.trackingNo ? `<div class="rounded-xl border bg-muted/20 px-3 py-2">快递单号：${escapeHtml(sampleVerification.trackingNo)}</div>` : ''}
        <div class="rounded-xl border bg-muted/20 px-3 py-2">发放时间：${escapeHtml(sampleVerification.issuedAt)}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">发放人：${escapeHtml(sampleVerification.issuedBy)}</div>
        ${sampleVerification.expectedReceiveAt ? `<div class="rounded-xl border bg-muted/20 px-3 py-2">预计收样时间：${escapeHtml(sampleVerification.expectedReceiveAt)}</div>` : ''}
        <div class="rounded-xl border bg-muted/20 px-3 py-2">预计提交样衣审核时间：${escapeHtml(sampleVerification.expectedSubmitAt)}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">当前状态：${escapeHtml(sampleStatusLabel)}</div>
        ${application?.assignedPpicName ? `<div class="rounded-xl border bg-muted/20 px-3 py-2">PPIC：${escapeHtml(application.assignedPpicName)}</div>` : ''}
      </div>
      <div class="mt-3 space-y-3 text-xs">
        <div>
          <div class="mb-1 font-medium">平台参考照片</div>
          ${renderPdaReferenceFiles(sampleVerification.platformReferencePhotos, '暂无平台参考照片')}
        </div>
        <div>
          <div class="mb-1 font-medium">平台参考视频</div>
          ${renderPdaReferenceFiles(sampleVerification.platformReferenceVideos, '暂无平台参考视频')}
        </div>
        <div>
          <div class="mb-1 font-medium">平台参考资料</div>
          ${renderPdaReferenceFiles(sampleVerification.platformReferenceFiles, '暂无平台参考资料')}
        </div>
      </div>
      ${renderReceiveInfo(sampleVerification)}
      ${latestSampleReview && sampleVerification.status === '样衣审核退回' ? `
        <div class="mt-3 space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <div>上次样衣审核结果：${escapeHtml(normalizeSampleReviewResult(latestSampleReview.sampleReviewResult))}</div>
          <div>上次样衣审核意见：${escapeHtml(latestSampleReview.sampleReviewOpinion)}</div>
          <div>需重新提交内容：${latestSampleReview.requiredResubmitItems.length > 0 ? escapeHtml(latestSampleReview.requiredResubmitItems.join('、')) : '—'}</div>
        </div>
      ` : ''}
      ${latestSampleReview && sampleVerification.status === LEGACY_SAMPLE_REJECTED_STATUS ? `
        <div class="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">历史审核意见：${escapeHtml(latestSampleReview.sampleReviewOpinion)}</div>
      ` : ''}
      ${isWaitReceive ? `
        <div class="mt-4">
          <button type="button" class="h-11 w-full rounded-2xl bg-primary text-sm font-medium text-primary-foreground" data-testid="pda-confirm-sample-received" data-pda-onboarding-action="open-sample-receive" data-verification-id="${escapeHtml(sampleVerification.verificationId)}">确认收到样衣</button>
        </div>
      ` : ''}
      ${canSubmitSample ? renderFactorySampleSubmitForm(sampleVerification.status === '样衣审核退回') : ''}
      ${isReadonlySubmitted ? `
        <div class="mt-3 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-700">待平台审核样衣</div>
        ${renderFactorySampleSubmittedInfo(sampleVerification)}
      ` : ''}
      ${sampleVerification.status !== '待平台审核样衣' ? renderFactorySampleSubmittedInfo(sampleVerification) : ''}
    </section>
  `
}

function renderSampleReceiveDialog(application: FactoryOnboardingApplication | null): string {
  if (!state.sampleReceiveVerificationId) return ''
  const sampleVerification = getSampleVerificationForApplication(application)
  if (!sampleVerification || sampleVerification.verificationId !== state.sampleReceiveVerificationId) return ''
  const errorLines = state.sampleReceiveErrorText.split('\n').filter(Boolean)
  return `
    <div class="fixed inset-0 z-50" data-pda-onboarding-dialog="sample-receive">
      <button type="button" class="absolute inset-0 bg-black/35" data-pda-onboarding-action="close-sample-receive"></button>
      <section class="absolute left-1/2 top-1/2 w-[92vw] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background p-5 shadow-2xl">
        <div class="flex items-center justify-between gap-3">
          <h3 class="text-base font-semibold">确认收到样衣</h3>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-onboarding-action="close-sample-receive">关闭</button>
        </div>
        ${errorLines.length > 0 ? `
          <div class="mt-3 space-y-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700" data-testid="pda-sample-receive-error">
            ${errorLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
          </div>
        ` : ''}
        <div class="mt-4 space-y-3 text-sm">
          <label class="block space-y-1.5">
            <span class="text-xs font-medium">确认收样时间 *</span>
            <input type="datetime-local" data-pda-onboarding-field="sampleReceive-factoryReceivedAt" value="${escapeHtml(toDatetimeLocalValue(state.sampleReceiveDraft.factoryReceivedAt))}" class="h-10 w-full rounded-2xl border px-3" />
          </label>
          <label class="block space-y-1.5">
            <span class="text-xs font-medium">确认收样人 *</span>
            <input data-pda-onboarding-field="sampleReceive-factoryReceivedBy" value="${escapeHtml(state.sampleReceiveDraft.factoryReceivedBy)}" class="h-10 w-full rounded-2xl border px-3" placeholder="请输入确认收样人" />
          </label>
          <label class="block space-y-1.5">
            <span class="text-xs font-medium">收样备注</span>
            <textarea data-pda-onboarding-field="sampleReceive-factoryReceiveRemark" class="min-h-20 w-full rounded-2xl border px-3 py-2" placeholder="请输入收样备注">${escapeHtml(state.sampleReceiveDraft.factoryReceiveRemark || '')}</textarea>
          </label>
        </div>
        <div class="mt-5 grid grid-cols-2 gap-2">
          <button type="button" class="h-10 rounded-2xl border text-sm font-medium" data-pda-onboarding-action="close-sample-receive">取消</button>
          <button type="button" class="h-10 rounded-2xl bg-primary text-sm font-medium text-primary-foreground" data-pda-onboarding-action="confirm-sample-receive">确认收到样衣</button>
        </div>
      </section>
    </div>
  `
}

function getFactoryTypeLabel(code: string): string {
  const map: Record<string, string> = {
    CUTTING_FACTORY: '裁床厂',
    PRINTING_FACTORY: '印花厂',
    DYEING_FACTORY: '染厂',
    POST_FINISHING_FACTORY: '后道工厂',
    SPECIAL_CRAFT_FACTORY: '特殊工艺厂',
    SEWING_FACTORY: '车缝厂',
    MULTI_CAPABILITY_FACTORY: '全能力工厂',
  }
  return map[code] || code
}

function renderCompletenessCard(application: FactoryOnboardingApplication | null): string {
  const draftLike = application || ({
    ...state.draft,
    completenessItems: [],
  } as FactoryOnboardingApplication)
  const completeness = calculateOnboardingCompleteness(draftLike)
  const missingItems = getCompletenessMissingItems({
    ...draftLike,
    completenessItems: completeness.completenessItems,
  })
  const toneClass =
    completeness.completenessScore >= 95
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : completeness.completenessScore >= 80
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : completeness.completenessScore >= 60
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-red-200 bg-red-50 text-red-700'

  return `
    <section class="rounded-2xl border bg-card p-3 shadow-sm" data-testid="pda-onboarding-completeness-card">
      <div class="flex items-start justify-between gap-3">
        <h3 class="text-sm font-semibold">资料完整性</h3>
        <span class="inline-flex rounded-full border px-2 py-0.5 text-[11px] ${toneClass}">${escapeHtml(completeness.completenessLevel)}</span>
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div class="rounded-xl border bg-muted/20 px-3 py-2">资料完整性评分：<span class="font-medium">${completeness.completenessScore} 分</span></div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">完整性等级：<span class="font-medium">${escapeHtml(completeness.completenessLevel)}</span></div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">待补充项数量：<span class="font-medium">${missingItems.length} 项</span></div>
        <button type="button" class="rounded-xl border bg-background px-3 py-2 text-left text-xs font-medium" data-pda-onboarding-action="toggle-completeness-items">${state.showCompletenessItems ? '收起待补充项' : '查看待补充项'}</button>
      </div>
      ${state.showCompletenessItems ? `
        <div class="mt-3 space-y-2">
          ${missingItems.length > 0 ? missingItems.map((item) => `
            <article class="rounded-xl border border-dashed px-3 py-2 text-xs">
              <div class="font-medium">${escapeHtml(item.itemName)}</div>
              <div class="mt-1 text-muted-foreground">缺失原因：${escapeHtml(item.missingReason)}</div>
            </article>
          `).join('') : '<div class="rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">当前资料已无待补充项。</div>'}
        </div>
      ` : ''}
    </section>
  `
}

function renderField(label: string, inputHtml: string, required = false): string {
  return `
    <label class="block space-y-1.5">
      <span class="text-xs font-medium text-foreground">${escapeHtml(label)}${required ? ' *' : ''}</span>
      ${inputHtml}
    </label>
  `
}

function renderCapabilityTags(capabilities: FactoryOnboardingSelectedCapability[], readonly: boolean): string {
  if (capabilities.length <= 0) {
    return '<div class="rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">请至少选择一个工序工艺</div>'
  }

  return `
    <div class="flex flex-wrap gap-2">
      ${capabilities.map((item, index) => `
        <span class="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs text-blue-700">
          ${escapeHtml(`${item.processName} / ${item.craftName}`)}
          ${readonly ? '' : `<button type="button" class="rounded-full text-blue-700 hover:bg-blue-100" data-pda-onboarding-action="remove-capability" data-capability-index="${index}">移除</button>`}
        </span>
      `).join('')}
    </div>
  `
}

function renderCapabilityPicker(readonly: boolean): string {
  const processOptions = listSelectableProcessCraftOptions()
  const selectedProcess = processOptions.find((item) => item.processCode === state.selectedProcessCode) || processOptions[0]
  const selectedKeys = new Set(state.draft.selectedCapabilities.map((item) => `${item.processCode}:${item.craftCode}`))
  const matchResults = inferFactoryTypesFromCapabilities(state.draft.selectedCapabilities)
  const primaryFactoryType = getPrimaryFactoryType(matchResults)

  return `
    <section class="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold">工序工艺能力</h3>
      </div>
      <div class="mt-3 flex gap-2 overflow-x-auto pb-1">
        ${processOptions.map((item) => `
          <button
            type="button"
            class="rounded-full border px-3 py-1.5 text-xs ${item.processCode === selectedProcess?.processCode ? 'border-blue-200 bg-blue-50 text-blue-700' : 'border-border bg-background text-muted-foreground'}"
            data-pda-onboarding-action="select-process"
            data-process-code="${escapeHtml(item.processCode)}"
            ${readonly ? 'disabled' : ''}
          >
            ${escapeHtml(item.processName)}
          </button>
        `).join('')}
      </div>
      <div class="mt-3 grid grid-cols-1 gap-2">
        ${(selectedProcess?.crafts || []).map((craft) => {
          const checked = selectedKeys.has(`${craft.processCode}:${craft.craftCode}`)
          return `
            <label class="flex items-center gap-3 rounded-xl border px-3 py-2 text-xs ${readonly ? 'opacity-80' : ''}">
              <input
                type="checkbox"
                class="h-4 w-4 rounded border"
                data-pda-onboarding-action="toggle-capability"
                data-process-code="${escapeHtml(craft.processCode)}"
                data-craft-code="${escapeHtml(craft.craftCode)}"
                ${checked ? 'checked' : ''}
                ${readonly ? 'disabled' : ''}
              />
              <span>${escapeHtml(craft.craftName)}</span>
            </label>
          `
        }).join('') || '<div class="rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">当前工序暂无可选工艺</div>'}
      </div>
      <div class="mt-3 space-y-2" data-testid="pda-onboarding-capability-section">
        <div class="text-xs font-medium">已选工序工艺</div>
        ${renderCapabilityTags(state.draft.selectedCapabilities, readonly)}
      </div>
      <div class="mt-3 rounded-2xl bg-slate-50 px-3 py-3 text-xs">
        <div class="font-medium text-slate-900">系统匹配工厂类型：${escapeHtml(getFactoryTypeLabel(primaryFactoryType))}</div>
      </div>
    </section>
  `
}

function getSelectedProcessOptions() {
  const processMap = new Map<string, { processCode: string; processName: string }>()
  state.draft.selectedCapabilities.forEach((item) => {
    if (!processMap.has(item.processCode)) {
      processMap.set(item.processCode, { processCode: item.processCode, processName: item.processName })
    }
  })
  return [...processMap.values()]
}

function getSelectedCraftOptions(processCode: string) {
  return state.draft.selectedCapabilities.filter((item) => item.processCode === processCode)
}

function renderMachineTable(readonly: boolean): string {
  const rows = state.draft.machines
  return `
    <section class="rounded-2xl border bg-card p-3 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold">机器明细</h3>
        ${readonly ? '' : '<button type="button" class="rounded-full border px-3 py-1.5 text-xs" data-pda-onboarding-action="add-machine">添加机器</button>'}
      </div>
      <div class="mt-3 space-y-3" data-testid="pda-onboarding-machine-list">
        ${rows.length > 0 ? rows.map((machine, index) => renderMachineRow(machine, index, readonly)).join('') : '<div class="rounded-xl border border-dashed px-3 py-3 text-xs text-muted-foreground">请至少添加一条机器明细</div>'}
      </div>
    </section>
  `
}

function renderMachineRow(machine: FactoryOnboardingMachineAbility, index: number, readonly: boolean): string {
  const processOptions = getSelectedProcessOptions()
  const craftOptions = getSelectedCraftOptions(machine.linkedProcessCode)
  const disabled = readonly ? 'disabled' : ''
  const invalid = machine.validationStatus !== '通过'
  return `
    <article class="rounded-2xl border p-3 ${invalid ? 'border-red-200 bg-red-50/40' : 'bg-muted/20'}" data-testid="pda-onboarding-machine-row-${index}">
      <div class="mb-2 flex items-center justify-between gap-2">
        <div class="text-xs font-medium">机器 ${index + 1}</div>
        <div class="flex items-center gap-2">
          ${renderNodeStatusChip(machine.validationStatus, invalid ? 'stop' : 'done')}
          ${readonly ? '' : `<button type="button" class="rounded-full border px-2 py-1 text-[11px] text-destructive" data-pda-onboarding-action="remove-machine" data-machine-index="${index}">删除</button>`}
        </div>
      </div>
      <div class="mb-3 rounded-xl border ${invalid ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'} px-3 py-2 text-xs">
        校验状态：${escapeHtml(machine.validationStatus)}${machine.validationMessage ? ` · ${escapeHtml(machine.validationMessage)}` : ''}
      </div>
      <div class="grid grid-cols-1 gap-2 text-xs">
        ${renderField('机器名称', `<input ${disabled} data-pda-onboarding-machine-index="${index}" data-pda-onboarding-machine-field="machineName" value="${escapeHtml(machine.machineName)}" class="h-9 w-full rounded-xl border px-3" placeholder="请输入机器名称" />`, true)}
        ${renderField('机器编号', `<input ${disabled} data-pda-onboarding-machine-index="${index}" data-pda-onboarding-machine-field="machineNo" value="${escapeHtml(machine.machineNo)}" class="h-9 w-full rounded-xl border px-3" placeholder="请输入机器编号" />`)}
        ${renderField('数量', `<input ${disabled} type="number" min="1" data-pda-onboarding-machine-index="${index}" data-pda-onboarding-machine-field="machineCount" value="${machine.machineCount}" class="h-9 w-full rounded-xl border px-3" />`, true)}
        ${renderField('机器状态', `
          <div class="flex gap-2 pt-1">
            ${['可用', '维修中', '停用'].map((item) => `
              <label class="inline-flex items-center gap-1 text-xs">
                <input ${disabled} type="radio" name="machine-condition-${index}" value="${item}" data-pda-onboarding-machine-index="${index}" data-pda-onboarding-machine-field="condition" ${machine.condition === item ? 'checked' : ''} />
                <span>${item}</span>
              </label>
            `).join('')}
          </div>
        `, true)}
        ${renderField('关联工序', `
          <select ${disabled} data-pda-onboarding-machine-index="${index}" data-pda-onboarding-machine-field="linkedProcessCode" class="h-9 w-full rounded-xl border px-3">
            <option value="">请选择工序</option>
            ${processOptions.map((item) => `<option value="${escapeHtml(item.processCode)}" ${item.processCode === machine.linkedProcessCode ? 'selected' : ''}>${escapeHtml(item.processName)}</option>`).join('')}
          </select>
        `, true)}
        ${renderField('关联工艺', `
          <select ${disabled} data-pda-onboarding-machine-index="${index}" data-pda-onboarding-machine-field="linkedCraftCode" class="h-9 w-full rounded-xl border px-3">
            <option value="">请选择工艺</option>
            ${craftOptions.map((item) => `<option value="${escapeHtml(item.craftCode)}" ${item.craftCode === machine.linkedCraftCode ? 'selected' : ''}>${escapeHtml(item.craftName)}</option>`).join('')}
          </select>
        `, true)}
        <label class="col-span-2 block space-y-1.5">
          <span class="text-xs font-medium">备注</span>
          <input ${disabled} data-pda-onboarding-machine-index="${index}" data-pda-onboarding-machine-field="remark" value="${escapeHtml(machine.remark)}" class="h-9 w-full rounded-xl border px-3" placeholder="请输入备注" />
        </label>
      </div>
    </article>
  `
}

function getDraftFieldValue(field: FactoryOnboardingRequiredField): string {
  switch (field) {
    case '工厂简称':
      return state.draft.factoryShortName || '未填写'
    case '姓名':
      return state.draft.applicantName || '未填写'
    case '身份证号码/护照号码':
      return state.draft.identityNo || '未填写'
    case '身份证复印件/电子文件':
      return state.draft.identityFile?.fileName || '未上传'
    case '工厂/公司名称':
      return state.draft.factoryCompanyName || '未填写'
    case '地址':
      return state.draft.address || '未填写'
    case '手机号':
      return state.draft.mobilePhone || '未填写'
    case '来源':
      return state.draft.sourceChannel || '未填写'
    case '收到此通知的 PPIC 姓名':
      return state.draft.ppicName || '未填写'
    case '有效工人数量':
      return state.draft.effectiveWorkerCount > 0 ? String(state.draft.effectiveWorkerCount) : '未填写'
    case '机器数量':
      return state.draft.machineTotalCount > 0 ? String(state.draft.machineTotalCount) : '未填写'
    case '机器明细':
      return state.draft.machines.length > 0 ? state.draft.machines.map((item) => `${item.machineName || '未命名设备'}×${item.machineCount || 0}`).join('、') : '未填写'
    case '工序工艺能力':
      return state.draft.selectedCapabilities.length > 0 ? state.draft.selectedCapabilities.map((item) => `${item.processName}/${item.craftName}`).join('、') : '未填写'
    case '可开始合作时间':
      return state.draft.availableStartDate || '未填写'
    default:
      return '未填写'
  }
}

function renderReviewAndSupplement(application: FactoryOnboardingApplication | null): string {
  const latestReview = getLatestReviewRecord(application)
  const latestSupplement = getLatestSupplementRecord(application)
  const showReview = latestReview && (
    application?.status === '平台审核退回'
    || application?.status === ('平台审核' + '拒绝')
    || application?.status === LEGACY_SAMPLE_REJECTED_STATUS
  )
  if (!showReview) return ''

  return `
    <section class="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm" data-testid="pda-onboarding-review-card">
      <h3 class="text-sm font-semibold">最近审核意见</h3>
      <div class="mt-3 space-y-2 text-xs">
        <div class="rounded-xl border bg-muted/20 px-3 py-2">审核结果：${escapeHtml(normalizeReviewResult(latestReview.reviewResult))}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">审核意见：${escapeHtml(latestReview.reviewOpinion)}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">审核人：${escapeHtml(latestReview.reviewer)}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">审核时间：${escapeHtml(latestReview.reviewedAt)}</div>
      </div>
      ${latestSupplement ? `
        <div class="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" data-testid="pda-onboarding-supplement-card">
          <div class="font-medium">需补充字段</div>
          <div class="mt-2 flex flex-wrap gap-2">
            ${latestSupplement.requiredFields.map((field) => `<span class="rounded-full border border-amber-200 bg-white px-2 py-1">${escapeHtml(field)}</span>`).join('')}
          </div>
          <div class="mt-3 space-y-2">
            ${latestSupplement.requiredFields.map((field) => `
              <div class="rounded-xl border border-amber-200 bg-white px-3 py-2">
                <div class="font-medium">${escapeHtml(field)}</div>
                <div class="mt-1 text-amber-700">当前填写值：${escapeHtml(getDraftFieldValue(field))}</div>
                <div class="mt-1 text-amber-700">修改入口：请在下方表单中更新该字段</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}
    </section>
  `
}

function renderReadonlySummary(): string {
  const capabilityText = state.draft.selectedCapabilities.map((item) => `${item.processName}/${item.craftName}`).join('、') || '未选择'
  return `
    <section class="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
      <h3 class="text-sm font-semibold">提交确认</h3>
      <div class="mt-3 space-y-2 text-xs">
        <div class="rounded-xl border bg-muted/20 px-3 py-2">工厂简称：${escapeHtml(state.draft.factoryShortName || '未填写')}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">姓名：${escapeHtml(state.draft.applicantName || '未填写')}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">身份证号码/护照号码：${escapeHtml(state.draft.identityNo || '未填写')}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">工厂/公司名称：${escapeHtml(state.draft.factoryCompanyName || '未填写')}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">手机号：${escapeHtml(state.draft.mobilePhone || '未填写')}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">地址：${escapeHtml(state.draft.address || '未填写')}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">来源：${escapeHtml(state.draft.sourceChannel || '未填写')}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">PPIC 姓名：${escapeHtml(state.draft.ppicName || '未填写')}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">机器数量：${state.draft.machineTotalCount || 0}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">有效工人数量：${state.draft.effectiveWorkerCount || 0}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">可开始合作时间：${escapeHtml(state.draft.availableStartDate || '未选择')}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">已选工序工艺：${escapeHtml(capabilityText)}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">机器明细数量：${state.draft.machines.length}</div>
        <div class="rounded-xl border bg-muted/20 px-3 py-2">身份证复印件/电子文件：${escapeHtml(state.draft.identityFile?.fileName || '未上传')}</div>
      </div>
    </section>
  `
}

function renderRecords(application: FactoryOnboardingApplication | null): string {
  if (!application) return ''
  return `
    <section class="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold">流程记录</h3>
        <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-onboarding-action="toggle-completeness-items">
          ${state.showCompletenessItems ? '收起' : '查看'}
        </button>
      </div>
      ${state.showCompletenessItems ? `
        <div class="mt-3 space-y-3 text-xs">
          <div>
            <div class="mb-2 font-medium">节点记录</div>
            <div class="space-y-2">
              ${application.nodeLogs.map((item) => `
                <article class="rounded-xl border px-3 py-2">
                  <div class="flex items-center justify-between gap-2">
                    <div class="font-medium">${escapeHtml(item.nodeName)}</div>
                    ${renderNodeStatusChip(item.nodeStatus, getNodeTone(item.nodeStatus))}
                  </div>
                  <div class="mt-1 text-muted-foreground">进入：${escapeHtml(item.enteredAt)} · 离开：${escapeHtml(item.leftAt || '进行中')}</div>
                  <div class="mt-1 text-muted-foreground">节点耗时：${escapeHtml(item.elapsedText)} · 动作次数：第${item.actionCount}次动作</div>
                  <div class="mt-1 text-muted-foreground">上次操作：${escapeHtml(item.lastActionAt || '—')} · 操作人：${escapeHtml(item.operator)}</div>
                  <div class="mt-1 text-muted-foreground">备注：${escapeHtml(item.remark || '—')}</div>
                </article>
              `).join('')}
            </div>
          </div>
          <div>
            <div class="mb-2 font-medium">动作记录</div>
            <div class="space-y-2">
              ${application.actionLogs.map((item) => `
                <article class="rounded-xl border px-3 py-2">
                  <div class="font-medium">${escapeHtml(item.actionName)}</div>
                  <div class="mt-1 text-muted-foreground">所属节点：${escapeHtml(item.nodeName)} · 节点内第${item.actionSequenceInNode}次动作</div>
                  <div class="mt-1 text-muted-foreground">状态变化：${escapeHtml(item.fromStatus)} → ${escapeHtml(item.toStatus)}</div>
                  <div class="mt-1 text-muted-foreground">节点变化：${escapeHtml(item.fromNode)} → ${escapeHtml(item.toNode)}</div>
                  <div class="mt-1 text-muted-foreground">操作人：${escapeHtml(item.operator)} · 时间：${escapeHtml(item.operatedAt)}</div>
                  <div class="mt-1 text-muted-foreground">备注：${escapeHtml(item.remark || '—')}</div>
                </article>
              `).join('') || '<div class="rounded-xl border border-dashed px-3 py-3 text-muted-foreground">当前暂无动作记录</div>'}
            </div>
          </div>
        </div>
      ` : ''}
    </section>
  `
}

function renderActionArea(application: FactoryOnboardingApplication | null): string {
  const readonly = !canEditOnboardingApplication(application)
  const returnTo = getReturnTo()
  return `
    <section class="sticky bottom-4 z-10 rounded-3xl border bg-card/95 p-3 shadow-lg backdrop-blur">
      ${state.errorText ? `<div class="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${escapeHtml(state.errorText)}</div>` : ''}
      ${state.successText ? `<div class="mb-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">${escapeHtml(state.successText)}</div>` : ''}
      <div class="grid grid-cols-1 gap-2">
        ${readonly ? '' : '<button type="button" class="h-11 rounded-2xl border bg-background text-sm font-medium" data-pda-onboarding-action="save-draft">保存草稿</button>'}
        ${canSubmitOnboardingApplication(application)
          ? `<button type="button" class="h-11 rounded-2xl bg-primary text-sm font-medium text-primary-foreground" data-testid="pda-onboarding-submit" data-pda-onboarding-action="submit">${escapeHtml(getOnboardingStatusActionLabel(application))}</button>`
          : '<button type="button" class="h-11 rounded-2xl border bg-muted text-sm font-medium text-muted-foreground" disabled>当前状态仅支持查看</button>'}
        <button type="button" class="h-11 rounded-2xl border bg-background text-sm font-medium" data-pda-onboarding-action="goto-login">返回登录</button>
        ${application?.status === '已转正式合作' ? `<button type="button" class="h-11 rounded-2xl border bg-background text-sm font-medium" data-nav="${escapeHtml(returnTo)}">进入执行</button>` : ''}
      </div>
    </section>
  `
}

function renderMobileFlowSection(application: FactoryOnboardingApplication | null): string {
  const steps = [
    { key: 'draft', nodeNames: ['填写入驻申请'], shortName: '填资料' },
    { key: 'review', nodeNames: ['平台审核'], shortName: '平台审核' },
    { key: 'sample-verify', nodeNames: ['样衣验证'], shortName: '样衣验证' },
    { key: 'sample-review', nodeNames: ['样衣审核'], shortName: '样衣审核' },
    { key: 'formal', nodeNames: ['正式合作'], shortName: '正式合作' },
    { key: 'done', nodeNames: ['完成'], shortName: '完成' },
  ] as const
  const currentNode = application?.currentNode || '填写入驻申请'
  const currentNodeLog =
    application?.nodeLogs.find((item) => item.nodeName === currentNode) ||
    application?.nodeLogs.find((item) => item.nodeStatus === '进行中') ||
    null
  const lastAction = application?.actionLogs[application.actionLogs.length - 1] || null
  const activeStep = steps.find((item) => item.nodeNames.includes(currentNode as never)) || steps[0]

  return `
    <section class="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm" data-testid="pda-onboarding-flow-card">
      <div class="flex items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-slate-900">入驻进度</h3>
          <p class="mt-1 text-[11px] text-slate-500">左右滑动查看步骤</p>
        </div>
        <span class="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-500">${steps.length} 步</span>
      </div>
      <div class="-mx-3 mt-3 overflow-x-auto px-3 pb-1">
        <div class="flex min-w-max gap-2">
          ${steps.map((step) => {
            const relatedLogs = application?.nodeLogs.filter((item) => step.nodeNames.includes(item.nodeName as never)) || []
            const nodeLog = relatedLogs.find((item) => item.nodeStatus === '进行中') || relatedLogs[relatedLogs.length - 1] || null
            const isActive = step.nodeNames.includes(currentNode as never)
            const status = nodeLog?.nodeStatus || (isActive ? '进行中' : '未开始')
            return `
              <article class="w-[110px] shrink-0 rounded-2xl border px-3 py-2 ${isActive ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}">
                <div class="text-xs font-semibold ${isActive ? 'text-blue-700' : 'text-slate-700'}">${step.shortName}</div>
                <div class="mt-2">${renderNodeStatusChip(status, nodeLog ? getNodeTone(status) : 'todo')}</div>
              </article>
            `
          }).join('')}
        </div>
      </div>
      <div class="mt-3 rounded-[24px] bg-slate-900 px-3 py-3 text-white">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-[11px] text-slate-300">当前步骤</div>
            <div class="mt-1 text-base font-semibold">${escapeHtml(activeStep.shortName)}</div>
          </div>
          <span class="rounded-full bg-white/12 px-2.5 py-1 text-[11px] text-white">${escapeHtml(application?.status || '草稿')}</span>
        </div>
        <div class="mt-3 grid grid-cols-2 gap-2 text-[11px]">
          <div class="rounded-2xl bg-white/8 px-3 py-2">
            <div class="text-slate-300">节点耗时</div>
            <div class="mt-1 font-medium text-white">${escapeHtml(currentNodeLog?.elapsedText || '-')}</div>
          </div>
          <div class="rounded-2xl bg-white/8 px-3 py-2">
            <div class="text-slate-300">动作次数</div>
            <div class="mt-1 font-medium text-white">第${currentNodeLog?.actionCount || 0}次动作</div>
          </div>
          <div class="col-span-2 rounded-2xl bg-white/8 px-3 py-2">
            <div class="text-slate-300">上次动作</div>
            <div class="mt-1 font-medium text-white">${escapeHtml(lastAction?.actionName || '暂未操作')}</div>
            <div class="mt-1 text-[10px] text-slate-300">${escapeHtml(lastAction?.operatedAt || '—')}</div>
          </div>
        </div>
      </div>
    </section>
  `
}

function renderOnboardingBody(application: FactoryOnboardingApplication | null): string {
  const readonly = !canEditOnboardingApplication(application)
  return `
    <section class="min-h-screen bg-slate-50 pb-6" data-testid="pda-onboarding-page">
      <header class="sticky top-0 z-20 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-sm font-semibold">工厂入驻&登录</div>
            <div class="text-[11px] text-muted-foreground">入驻</div>
          </div>
          <button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-onboarding-action="logout">退出当前账号</button>
        </div>
      </header>
      <div class="space-y-3 px-4 py-4" data-testid="pda-onboarding-form">
        ${renderMobileFlowSection(application)}
        ${renderReviewAndSupplement(application)}
        ${renderSampleVerificationCard(application)}

        <section class="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
          <h3 class="text-sm font-semibold">基础身份信息</h3>
          <div data-testid="pda-onboarding-basic-section" class="mt-3 grid grid-cols-1 gap-3 text-xs">
            ${renderField('姓名', `<input ${readonly ? 'disabled' : ''} data-pda-onboarding-field="applicantName" value="${escapeHtml(state.draft.applicantName)}" class="h-10 w-full rounded-2xl border px-3" placeholder="请输入姓名" />`, true)}
            ${renderField('身份证号码/护照号码', `<input ${readonly ? 'disabled' : ''} data-pda-onboarding-field="identityNo" value="${escapeHtml(state.draft.identityNo)}" class="h-10 w-full rounded-2xl border px-3" placeholder="请输入身份证号码/护照号码" />`, true)}
          </div>
        </section>

        <section class="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
          <h3 class="text-sm font-semibold">工厂基础信息</h3>
          <div data-testid="pda-onboarding-contact-section" class="mt-3 grid grid-cols-1 gap-3 text-xs">
            ${renderField('工厂简称', `<input ${readonly ? 'disabled' : ''} data-testid="factory-short-name-input" data-pda-onboarding-field="factoryShortName" value="${escapeHtml(state.draft.factoryShortName)}" class="h-10 w-full rounded-2xl border px-3" placeholder="请输入工厂简称" />`, true)}
            ${renderField('工厂/公司名称', `<input ${readonly ? 'disabled' : ''} data-pda-onboarding-field="factoryCompanyName" value="${escapeHtml(state.draft.factoryCompanyName)}" class="h-10 w-full rounded-2xl border px-3" placeholder="请输入工厂/公司名称" />`, true)}
            <label class="block space-y-1.5">
              <span class="text-xs font-medium text-foreground">地址 *</span>
              <textarea ${readonly ? 'disabled' : ''} data-pda-onboarding-field="address" class="min-h-20 w-full rounded-2xl border px-3 py-2" placeholder="请输入详细地址">${escapeHtml(state.draft.address)}</textarea>
            </label>
            ${renderField('手机号', `<input ${readonly ? 'disabled' : ''} data-testid="mobile-phone-input" data-pda-onboarding-field="mobilePhone" value="${escapeHtml(state.draft.mobilePhone)}" class="h-10 w-full rounded-2xl border px-3" placeholder="请输入手机号" />`, true)}
            ${renderField('来源', `<input ${readonly ? 'disabled' : ''} data-pda-onboarding-field="sourceChannel" value="${escapeHtml(state.draft.sourceChannel)}" class="h-10 w-full rounded-2xl border px-3" placeholder="请输入来源" />`, true)}
            ${renderField('收到此通知的 PPIC 姓名', `<input ${readonly ? 'disabled' : ''} data-pda-onboarding-field="ppicName" value="${escapeHtml(state.draft.ppicName)}" class="h-10 w-full rounded-2xl border px-3" placeholder="请输入 PPIC 姓名" />`, true)}
          </div>
        </section>

        <section class="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
          <h3 class="text-sm font-semibold">能力与机器信息</h3>
          <div data-testid="pda-onboarding-workers-section" class="mt-3 grid grid-cols-1 gap-3 text-xs">
            ${renderField('机器数量', `<input ${readonly ? 'disabled' : ''} type="number" min="1" data-pda-onboarding-field="machineTotalCount" value="${state.draft.machineTotalCount || ''}" class="h-10 w-full rounded-2xl border px-3" />`, true)}
            ${renderField('有效工人数量', `<input ${readonly ? 'disabled' : ''} type="number" min="1" data-pda-onboarding-field="effectiveWorkerCount" value="${state.draft.effectiveWorkerCount || ''}" class="h-10 w-full rounded-2xl border px-3" />`, true)}
            ${renderField('可开始合作时间', `<input ${readonly ? 'disabled' : ''} type="date" data-pda-onboarding-field="availableStartDate" value="${escapeHtml(state.draft.availableStartDate)}" class="h-10 w-full rounded-2xl border px-3" />`, true)}
          </div>
        </section>

        <section class="rounded-[28px] border border-slate-200 bg-white p-3 shadow-sm">
          <h3 class="text-sm font-semibold">附件资料</h3>
          <div class="mt-3 grid grid-cols-1 gap-3 text-xs">
            ${renderField('上传身份证复印件/电子文件', `
              <div class="space-y-2">
                <input ${readonly ? 'disabled' : ''} type="file" accept=".jpg,.jpeg,.png,.pdf" data-pda-onboarding-file="identityFile" class="w-full rounded-2xl border px-3 py-2" />
                <div class="rounded-xl border bg-muted/20 px-3 py-2">当前文件：${escapeHtml(state.draft.identityFile?.fileName || '未上传')}</div>
                ${readonly ? '' : '<button type="button" class="rounded-full border px-3 py-1 text-xs" data-pda-onboarding-action="use-demo-identity-file">使用演示身份文件</button>'}
              </div>
            `, true)}
          </div>
        </section>

        ${renderCapabilityPicker(readonly)}
        ${renderMachineTable(readonly)}
        ${renderActionArea(application)}
        ${renderRecords(application)}
      </div>
      ${renderSampleReceiveDialog(application)}
    </section>
  `
}

export function renderPdaOnboardingPage(): string {
  const application = syncPageState()
  return renderOnboardingBody(application)
}

function removeCapability(index: number): void {
  state.draft.selectedCapabilities.splice(index, 1)
  syncMachineValidation()
}

function toggleCapability(processCode: string, craftCode: string): void {
  const capability = createCapabilityFromSelection(processCode, craftCode)
  if (!capability) return
  const existingIndex = state.draft.selectedCapabilities.findIndex((item) => item.processCode === processCode && item.craftCode === craftCode)
  if (existingIndex >= 0) {
    removeCapability(existingIndex)
    return
  }
  state.draft.selectedCapabilities.push(capability)
  syncMachineValidation()
}

function updateMachineDraft(index: number, field: keyof FactoryOnboardingMachineAbility, value: string): void {
  const machine = state.draft.machines[index]
  if (!machine) return
  if (field === 'machineCount') {
    machine.machineCount = Number(value) || 0
    syncMachineValidation()
    return
  }
  if (field === 'linkedProcessCode') {
    machine.linkedProcessCode = value
    machine.linkedProcessName = getSelectedProcessOptions().find((item) => item.processCode === value)?.processName || ''
    machine.linkedCraftCode = ''
    machine.linkedCraftName = ''
    syncMachineValidation()
    return
  }
  if (field === 'linkedCraftCode') {
    machine.linkedCraftCode = value
    machine.linkedCraftName = getSelectedCraftOptions(machine.linkedProcessCode).find((item) => item.craftCode === value)?.craftName || ''
    syncMachineValidation()
    return
  }
  if (field === 'condition') {
    machine.condition = value as FactoryOnboardingMachineAbility['condition']
    syncMachineValidation()
    return
  }
  ;(machine[field] as string) = value
  syncMachineValidation()
}

function updateDraftField(field: string, value: string): void {
  if (field === 'confirmPassword') {
    state.confirmPassword = value
    return
  }
  if (field.startsWith('admin-')) {
    const adminField = field.replace('admin-', '') as keyof FactoryOnboardingDraftPayload['adminAccount']
    ;(state.draft.adminAccount[adminField] as string) = value
    return
  }
  if (field === 'effectiveWorkerCount' || field === 'machineTotalCount') {
    ;(state.draft[field] as number) = Number(value) || 0
    return
  }
  ;(state.draft[field as keyof FactoryOnboardingDraftPayload] as string) = value

  if (field === 'applicantName') {
    state.draft.bossName = value
    state.draft.adminAccount.adminName = value
  }
  if (field === 'factoryCompanyName') {
    state.draft.factoryName = value
  }
  if (field === 'factoryShortName') {
    state.draft.adminAccount.loginId = value
  }
  if (field === 'mobilePhone') {
    state.draft.mobileOrWhatsapp = value
    state.draft.whatsapp = value
    state.draft.adminAccount.mobilePhone = value
    state.draft.adminAccount.mobileOrWhatsapp = value
    state.draft.adminAccount.whatsapp = value
  }
}

function updateIdentityFileFromInput(input: HTMLInputElement): void {
  const file = input.files?.[0]
  if (!file) return
  const extension = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  state.draft.identityFile = {
    fileId: `IDF-DRAFT-${Date.now()}`,
    fileName: file.name,
    fileType: extension === 'jpg' || extension === 'jpeg' || extension === 'png' || extension === 'pdf' ? extension : 'pdf',
    fileSizeMb: Number((file.size / 1024 / 1024).toFixed(2)),
    uploadedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
  }
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
  const uploadedAt = nowTimestamp()
  return files.map((file, index) => ({
    fileId: `FACTORY-SAMPLE-${Date.now()}-${index}`,
    fileName: file.name,
    fileType: getReferenceFileType(file.name),
    fileSizeMb: Number((file.size / 1024 / 1024).toFixed(2)),
    uploadedAt,
  }))
}

function updateSampleFilesFromInput(input: HTMLInputElement, field: string): void {
  const files = buildReferenceFilesFromInput(input)
  if (field === 'factorySamplePhotos') state.sampleSubmissionDraft.factorySamplePhotos = files
  if (field === 'factorySampleVideos') state.sampleSubmissionDraft.factorySampleVideos = files
  if (field === 'factorySubmissionFiles') state.sampleSubmissionDraft.factorySubmissionFiles = files
  if (field === 'factorySitePhotos') state.sampleSubmissionDraft.factorySitePhotos = files
  if (field === 'factorySiteVideos') state.sampleSubmissionDraft.factorySiteVideos = files
  if (field === 'bossIdentityFiles') state.sampleSubmissionDraft.bossIdentityFiles = files
  state.sampleSubmissionErrorText = ''
}

function updateSampleReceiveField(field: string, value: string): boolean {
  if (!field.startsWith('sampleReceive-')) return false
  const key = field.replace('sampleReceive-', '') as keyof FactorySampleReceivePayload
  state.sampleReceiveDraft = {
    ...state.sampleReceiveDraft,
    [key]: value,
  }
  state.sampleReceiveErrorText = ''
  return true
}

function updateSampleSubmissionField(field: string, value: string): boolean {
  if (!field.startsWith('sampleSubmission-')) return false
  const key = field.replace('sampleSubmission-', '') as keyof FactorySampleSubmissionPayload
  state.sampleSubmissionDraft = {
    ...state.sampleSubmissionDraft,
    [key]: value,
  }
  state.sampleSubmissionErrorText = ''
  return true
}

function getCurrentSampleVerification() {
  return getSampleVerificationForApplication(syncPageState())
}

function openSampleReceiveDialog(verificationId: string): void {
  const application = syncPageState()
  const sampleVerification = getSampleVerificationForApplication(application)
  if (!sampleVerification || sampleVerification.verificationId !== verificationId) {
    state.errorText = '未找到样衣验证记录'
    return
  }
  state.errorText = ''
  state.successText = ''
  state.sampleReceiveVerificationId = verificationId
  state.sampleReceiveDraft = {
    factoryReceivedAt: nowTimestamp(),
    factoryReceivedBy: application?.adminAccount.adminName || application?.applicantName || '',
    factoryReceiveRemark: '',
  }
  state.sampleReceiveErrorText = ''
}

async function handleConfirmSampleReceive(): Promise<void> {
  state.sampleReceiveErrorText = ''
  state.errorText = ''
  state.successText = ''
  try {
    const sampleVerification = getCurrentSampleVerification()
    const result = confirmFactoryReceivedSample(
      state.sampleReceiveVerificationId || sampleVerification?.verificationId || '',
      state.sampleReceiveDraft,
      state.sampleReceiveDraft.factoryReceivedBy || '工厂管理员',
    )
    hydrateDraftFromApplication(result.application)
    state.sampleReceiveVerificationId = null
    state.successText = '已确认收到样衣'
  } catch (error) {
    state.sampleReceiveErrorText = error instanceof Error ? error.message : '确认收样失败'
  }
}

async function handleSubmitFactorySampleReview(): Promise<void> {
  state.sampleSubmissionErrorText = ''
  state.errorText = ''
  state.successText = ''
  try {
    const application = syncPageState()
    const sampleVerification = getSampleVerificationForApplication(application)
    if (!sampleVerification) throw new Error('未找到样衣验证记录')
    const result = submitFactorySampleReview(
      sampleVerification.verificationId,
      state.sampleSubmissionDraft,
      application?.adminAccount.adminName || application?.applicantName || '工厂管理员',
    )
    hydrateDraftFromApplication(result.application)
    state.successText = '样衣审核资料已提交'
  } catch (error) {
    state.sampleSubmissionErrorText = error instanceof Error ? error.message : '提交样衣审核资料失败'
  }
}

async function handleSaveDraft(): Promise<void> {
  state.errorText = ''
  state.successText = ''
  try {
    syncMachineValidation()
    const saved = saveFactoryOnboardingDraft(state.draft, state.confirmPassword || '123456')
    hydrateDraftFromApplication(saved)
    state.successText = '草稿已保存'
  } catch (error) {
    state.errorText = error instanceof Error ? error.message : '请先补全入驻信息'
  }
}

async function handleSubmit(): Promise<void> {
  state.errorText = ''
  state.successText = ''
  try {
    syncMachineValidation()
    const saved = submitFactoryOnboardingApplication(state.draft, state.confirmPassword || '123456')
    hydrateDraftFromApplication(saved)
    activateOnboardingSession(saved)
    state.successText = saved.status === '待平台审核' ? '已提交入驻申请' : '已重新提交入驻申请'
  } catch (error) {
    state.errorText = error instanceof Error ? error.message : '请先补全入驻信息'
  }
}

export async function handlePdaOnboardingEvent(target: HTMLElement): Promise<boolean> {
  const fileNode = target.closest<HTMLElement>('[data-pda-onboarding-file]')
  if (fileNode instanceof HTMLInputElement) {
    const fileField = fileNode.dataset.pdaOnboardingFile || ''
    if (fileField === 'identityFile') {
      updateIdentityFileFromInput(fileNode)
    } else {
      updateSampleFilesFromInput(fileNode, fileField)
    }
    return true
  }

  const fieldNode = target.closest<HTMLElement>('[data-pda-onboarding-field]')
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLTextAreaElement || fieldNode instanceof HTMLSelectElement) {
    const field = fieldNode.dataset.pdaOnboardingField || ''
    if (updateSampleReceiveField(field, fieldNode.value)) return true
    if (updateSampleSubmissionField(field, fieldNode.value)) return true
    updateDraftField(field, fieldNode.value)
    return true
  }

  const machineFieldNode = target.closest<HTMLElement>('[data-pda-onboarding-machine-field]')
  if (machineFieldNode instanceof HTMLInputElement || machineFieldNode instanceof HTMLTextAreaElement || machineFieldNode instanceof HTMLSelectElement) {
    const index = Number(machineFieldNode.dataset.pdaOnboardingMachineIndex || '-1')
    const field = machineFieldNode.dataset.pdaOnboardingMachineField as keyof FactoryOnboardingMachineAbility
    if (index >= 0 && field) {
      updateMachineDraft(index, field, machineFieldNode.value)
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-onboarding-action]')
  const action = actionNode?.dataset.pdaOnboardingAction
  if (!action) return false

  if (action === 'goto-login') {
    appStore.navigate('/fcs/pda/auth/login')
    return true
  }

  if (action === 'logout') {
    logoutPdaAccess()
    appStore.navigate('/fcs/pda/auth/login', { historyMode: 'replace' })
    return true
  }

  if (action === 'open-sample-receive') {
    openSampleReceiveDialog(actionNode?.dataset.verificationId || '')
    return true
  }

  if (action === 'close-sample-receive') {
    state.sampleReceiveVerificationId = null
    state.sampleReceiveErrorText = ''
    return true
  }

  if (action === 'confirm-sample-receive') {
    await handleConfirmSampleReceive()
    return true
  }

  if (action === 'submit-sample-review') {
    await handleSubmitFactorySampleReview()
    return true
  }

  if (action === 'select-process') {
    state.selectedProcessCode = actionNode?.dataset.processCode || state.selectedProcessCode
    return true
  }

  if (action === 'toggle-capability') {
    toggleCapability(actionNode?.dataset.processCode || '', actionNode?.dataset.craftCode || '')
    return true
  }

  if (action === 'remove-capability') {
    removeCapability(Number(actionNode?.dataset.capabilityIndex || '-1'))
    return true
  }

  if (action === 'toggle-completeness-items') {
    state.showCompletenessItems = !state.showCompletenessItems
    return true
  }

  if (action === 'use-demo-identity-file') {
    state.draft.identityFile = {
      fileId: `IDF-DEMO-${Date.now()}`,
      fileName: '身份证复印件演示文件.pdf',
      fileType: 'pdf',
      fileSizeMb: 3,
      uploadedAt: new Date().toISOString().slice(0, 19).replace('T', ' '),
    }
    return true
  }

  if (action === 'add-machine') {
    state.draft.machines.push(createDefaultMachineDraft(state.draft.machines.length + 1))
    syncMachineValidation()
    return true
  }

  if (action === 'remove-machine') {
    const index = Number(actionNode?.dataset.machineIndex || '-1')
    if (index >= 0) state.draft.machines.splice(index, 1)
    syncMachineValidation()
    return true
  }

  if (action === 'save-draft') {
    await handleSaveDraft()
    return true
  }

  if (action === 'submit') {
    await handleSubmit()
    return true
  }

  return false
}
