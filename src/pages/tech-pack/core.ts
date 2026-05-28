import {
  ensureTechPackPageState,
  escapeHtml,
  getChecklist,
  renderChecklist,
  renderStatusBadge,
  renderTabHeader,
  isTechPackModuleReadOnly,
  currentUser,
  state,
} from './context.ts'
import { getStyleArchiveById } from '../../data/pcs-style-archive-repository.ts'
import { getTechnicalDataVersionById } from '../../data/pcs-technical-data-version-repository.ts'
import { listPatternAssetsForTechPackVersions } from '../../data/pcs-pattern-library-archive-linkage.ts'
import {
  canPublishTechnicalVersionByReview,
  getTechnicalReviewPendingReviewerText,
  getTechnicalReviewStatusText,
  normalizeTechnicalReviewSnapshot,
} from '../../data/pcs-tech-pack-review.ts'
import {
  buildTechPackVersionSourceTaskSummary,
} from '../../data/pcs-tech-pack-task-generation.ts'
import { listTechPackVersionLogsByVersionId } from '../../data/pcs-tech-pack-version-log-repository.ts'
import {
  TECHNICAL_GARMENT_DIFFICULTY_GRADES,
  type TechnicalReviewNode,
  type TechnicalReviewNodeKey,
} from '../../data/pcs-technical-data-version-types.ts'
import { buildTechPackReviewDiffSnapshot } from '../../data/pcs-tech-pack-review-diff.ts'
import { getFixedTechPackReviewers } from '../../data/pcs-tech-pack-reviewer-directory.ts'
import { listTechPackReviewNotificationsByNode } from '../../data/pcs-tech-pack-review-notification-repository.ts'
import { renderAttachmentsTab, renderAddAttachmentDialog, renderAddDesignDialog, renderDesignTab } from './asset-domain.ts'
import { renderBomFormDialog, renderBomTab, renderDesignThumbnailPreviewDialog } from './bom-domain.ts'
import { renderColorMappingTab } from './color-mapping-domain.ts'
import { renderCostTab } from './cost-domain.ts'
import {
  renderPatternDialog,
  renderPatternFormDialog,
  renderPatternTab,
  renderPatternTemplateDialog,
} from './pattern-domain.ts'
import { renderAddTechniqueDialog, renderProcessTab } from './process-domain.ts'
import { renderAddSizeDialog, renderSizeTab } from './size-domain.ts'

function renderCurrentTabContent(): string {
  if (state.activeTab === 'pattern') return renderPatternTab()
  if (state.activeTab === 'bom') return renderBomTab()
  if (state.activeTab === 'process') return renderProcessTab()
  if (state.activeTab === 'cost') return renderCostTab()
  if (state.activeTab === 'color-mapping') return renderColorMappingTab()
  if (state.activeTab === 'size') return renderSizeTab()
  if (state.activeTab === 'design') return renderDesignTab()
  return renderAttachmentsTab()
}

function renderReleaseDialog(): string {
  if (!state.releaseDialogOpen || !state.techPack) return ''

  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-md rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">发布技术包版本</h3>
        </header>
        <footer class="flex items-center justify-end gap-2 px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-release">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-tech-action="confirm-release">确认发布</button>
        </footer>
      </section>
    </div>
  `
}

function renderGarmentDifficultyField(record: ReturnType<typeof getTechnicalDataVersionById>): string {
  const grade = record?.garmentDifficultyGrade || 'B'
  if (isTechPackModuleReadOnly('QUALITY')) {
    return `<div>做货难度：<span class="font-medium text-foreground">${escapeHtml(grade)}</span></div>`
  }
  return `
    <div class="md:col-span-3">
      <div class="flex flex-wrap items-center gap-3">
        <span>做货难度：</span>
        <div class="flex flex-wrap items-center gap-3">
          ${TECHNICAL_GARMENT_DIFFICULTY_GRADES.map((item) => `
            <label class="inline-flex items-center gap-1.5 text-sm text-foreground">
              <input
                type="radio"
                name="tech-pack-garment-difficulty"
                value="${escapeHtml(item)}"
                class="h-4 w-4"
                data-tech-field="garment-difficulty-grade"
                ${item === grade ? 'checked' : ''}
              />
              <span>${escapeHtml(item)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    </div>
  `
}

function renderTechPackSummary(): string {
  if (!state.currentTechnicalVersionId || !state.currentStyleId) return ''
  const record = getTechnicalDataVersionById(state.currentTechnicalVersionId)
  const style = getStyleArchiveById(state.currentStyleId)
  if (!record) return ''
  const sourceSummary = buildTechPackVersionSourceTaskSummary(record)
  const isCurrent = style?.currentTechPackVersionId === record.technicalVersionId
  const patternAssets = listPatternAssetsForTechPackVersions([record])
  return `
    <div class="ml-10 mt-2 grid gap-2 text-sm text-muted-foreground md:grid-cols-3">
      <div>技术包状态：${renderStatusBadge(state.techPack?.status || 'DRAFT')}</div>
      <div>是否当前生效版本：<span class="font-medium text-foreground">${isCurrent ? '是' : '否'}</span></div>
      <div>来源任务链：<span class="font-medium text-foreground">${escapeHtml(sourceSummary.taskChainText)}</span></div>
      ${renderGarmentDifficultyField(record)}
      <div>关联花型库资产：<span class="font-medium text-foreground">${patternAssets.length > 0 ? escapeHtml(patternAssets.map((item) => item.pattern_code).join('、')) : '未关联'}</span></div>
      <div>归档状态：<span class="font-medium text-foreground">${record.archiveCollectedFlag ? '已归档' : '未归档'}</span></div>
      <div>当前花型资产：<span class="font-medium text-foreground">${patternAssets.length} 个</span></div>
    </div>
  `
}

function renderTechPackVersionLogButton(): string {
  if (!state.currentTechnicalVersionId) return ''
  const logs = listTechPackVersionLogsByVersionId(state.currentTechnicalVersionId)
  return `
    <button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-sm hover:bg-muted" data-tech-action="open-version-logs">
      <i data-lucide="history" class="mr-2 h-4 w-4"></i>
      查看版本日志
      <span class="ml-2 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">${escapeHtml(String(logs.length))}</span>
    </button>
  `
}

function renderTechPackVersionLogDialog(): string {
  if (!state.versionLogDialogOpen || !state.currentTechnicalVersionId) return ''
  const logs = listTechPackVersionLogsByVersionId(state.currentTechnicalVersionId)
  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="flex items-center justify-between gap-3 border-b px-6 py-4">
          <div>
            <h3 class="text-lg font-semibold">技术包版本日志</h3>
            <p class="mt-1 text-sm text-muted-foreground">共 ${escapeHtml(String(logs.length))} 条</p>
          </div>
          <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border text-lg leading-none hover:bg-muted" data-tech-action="close-version-logs" aria-label="关闭版本日志">×</button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          ${
            logs.length > 0
              ? `
                <div class="space-y-3">
                  ${logs
                    .map(
                      (item) => `
                        <div class="rounded-lg border bg-muted/20 px-4 py-3">
                          <div class="flex flex-wrap items-center justify-between gap-3">
                            <div class="text-sm font-medium text-foreground">${escapeHtml(item.logType)}</div>
                            <div class="text-xs text-muted-foreground">${escapeHtml(item.createdAt)}</div>
                          </div>
                          <div class="mt-2 text-sm text-muted-foreground">${escapeHtml(item.changeText || '未补充')}</div>
                          <div class="mt-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span>操作人：${escapeHtml(item.createdBy || '-')}</span>
                            <span>来源任务：${escapeHtml(item.sourceTaskCode ? `${item.sourceTaskCode} · ${item.sourceTaskName || item.sourceTaskType}` : '系统操作')}</span>
                          </div>
                        </div>
                      `,
                    )
                    .join('')}
                </div>
              `
              : '<div class="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">暂无技术包版本日志。</div>'
          }
        </div>
        <footer class="flex items-center justify-end border-t px-6 py-4">
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-version-logs">关闭</button>
        </footer>
      </section>
    </div>
  `
}

function renderReviewSubmitDialog(): string {
  if (!state.reviewSubmitDialogOpen) return ''
  const record = state.currentTechnicalVersionId ? getTechnicalDataVersionById(state.currentTechnicalVersionId) : null
  const reviewers = getFixedTechPackReviewers({
    styleId: record?.styleId || state.currentStyleId || '',
    technicalVersionId: record?.technicalVersionId || state.currentTechnicalVersionId || '',
  })
  return `
    <div class="fixed inset-0 z-[60] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true">
      <section class="w-full max-w-xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">确认提交技术包审核</h3>
          <p class="mt-1 text-sm text-muted-foreground">请再次确认技术包已维护齐全且正确。提交后将进入买手、版师并行审核。</p>
          ${state.compatibilityMessage ? `<p class="mt-2 text-sm text-red-600">${escapeHtml(state.compatibilityMessage)}</p>` : ''}
        </header>
        <div class="space-y-4 px-6 py-5 text-sm">
          <div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
            提交前请确认物料清单、核价、纸样管理、款色用料对应、工序工艺、放码规则、花型设计和附件等内容已维护完整。审核中和审核通过的模块将锁定，不允许修改。
          </div>
          <div class="grid gap-2 rounded-lg border bg-muted/20 px-4 py-3">
            <div class="font-medium text-foreground">固定审核人</div>
            <div class="text-muted-foreground">买手审核：<span class="font-medium text-foreground">${escapeHtml(reviewers.buyerReviewer.reviewerName)}</span></div>
            <div class="text-muted-foreground">版师审核：<span class="font-medium text-foreground">${escapeHtml(reviewers.patternMakerReviewer.reviewerName)}</span></div>
            <div class="text-muted-foreground">跟单审核：<span class="font-medium text-foreground">${escapeHtml(reviewers.merchandiserReviewer.reviewerName)}</span></div>
          </div>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-review-submit">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-tech-action="confirm-submit-review">确认提交审核</button>
        </footer>
      </section>
    </div>
  `
}

function getReviewActionTitle(): string {
  if (state.reviewActionType === 'approve') return '填写审核通过意见'
  if (state.reviewActionType === 'reject') return '填写审核不通过意见'
  if (state.reviewActionType === 'return') return '填写打回复审原因'
  return '开始审核'
}

function getReviewActionDescription(): string {
  if (state.reviewActionType === 'start') {
    return '该操作只将节点置为审核中，不产生通过或不通过结论。'
  }
  return '审核结论和审核意见必填，系统会同步写入审核节点和版本日志。'
}

function getReviewActionOpinionPlaceholder(): string {
  if (state.reviewActionType === 'start') return '请输入开始审核说明'
  if (state.reviewActionType === 'return') return '请输入打回复审原因'
  return '请输入审核意见'
}

function getReviewActionConfirmLabel(): string {
  if (state.reviewActionType === 'approve') return '确认通过'
  if (state.reviewActionType === 'reject') return '确认不通过'
  if (state.reviewActionType === 'return') return '确认打回'
  return '确认开始'
}

function renderReviewActionConclusion(): string {
  if (state.reviewActionType === 'start') {
    return `
      <div class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
        <div class="text-xs text-muted-foreground">处理动作</div>
        <div class="mt-1 font-medium text-slate-700">开始审核 · 进入审核中</div>
      </div>
    `
  }
  const isApprove = state.reviewActionType === 'approve'
  const conclusionText = isApprove ? '通过' : state.reviewActionType === 'return' ? '不通过 · 打回上一阶段' : '不通过'
  const className = isApprove
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : 'border-red-200 bg-red-50 text-red-700'
  return `
    <div class="rounded-lg border px-4 py-3 text-sm ${className}">
      <div class="text-xs opacity-80">审核结论</div>
      <div class="mt-1 font-semibold">${escapeHtml(conclusionText)}</div>
    </div>
  `
}

function renderReviewActionDialog(): string {
  if (!state.reviewActionDialogOpen || !state.reviewActionNodeKey) return ''
  return `
    <div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true" data-tech-review-layer="action-dialog">
      <section class="w-full max-w-xl rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">${escapeHtml(getReviewActionTitle())}</h3>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(getReviewActionDescription())}</p>
          ${state.compatibilityMessage ? `<p class="mt-2 text-sm text-red-600">${escapeHtml(state.compatibilityMessage)}</p>` : ''}
        </header>
        <div class="space-y-4 px-6 py-5">
          ${renderReviewActionConclusion()}
          <textarea class="min-h-28 w-full rounded-md border px-3 py-2 text-sm" data-tech-field="review-action-opinion" placeholder="${escapeHtml(getReviewActionOpinionPlaceholder())}">${escapeHtml(state.reviewActionOpinion)}</textarea>
        </div>
        <footer class="flex items-center justify-end gap-2 border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-review-action">取消</button>
          <button class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700" data-tech-action="confirm-review-action">${escapeHtml(getReviewActionConfirmLabel())}</button>
        </footer>
      </section>
    </div>
  `
}

function renderReviewDiffDialog(): string {
  if (!state.reviewDiffDialogNodeKey || !state.currentTechnicalVersionId) return ''
  const record = getTechnicalDataVersionById(state.currentTechnicalVersionId)
  if (!record) return ''
  const diff = buildTechPackReviewDiffSnapshot(record, state.reviewDiffDialogNodeKey)
  const rows = diff.items
    .map(
      (item) => `
        <tr class="border-t">
          <td class="px-3 py-2">${escapeHtml(item.scope)}</td>
          <td class="px-3 py-2">${escapeHtml(item.changeType)}</td>
          <td class="px-3 py-2">${escapeHtml(item.title)}</td>
          <td class="px-3 py-2 text-muted-foreground">${escapeHtml(item.beforeText)}</td>
          <td class="px-3 py-2 text-muted-foreground">${escapeHtml(item.afterText)}</td>
        </tr>
      `,
    )
    .join('')
  return `
    <div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true" data-tech-review-layer="diff-dialog">
      <section class="flex max-h-[82vh] w-full max-w-4xl flex-col rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">审核差异明细</h3>
          <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(diff.summaryText)}</p>
        </header>
        <div class="overflow-auto px-6 py-5">
          <div class="mb-3 text-sm text-muted-foreground">对比基线：${escapeHtml(diff.baselineVersionLabel || '无已发布版本')} ${diff.baselineVersionCode ? `· ${escapeHtml(diff.baselineVersionCode)}` : ''}</div>
          <table class="min-w-full text-left text-sm">
            <thead class="bg-muted/40 text-muted-foreground">
              <tr><th class="px-3 py-2 font-medium">范围</th><th class="px-3 py-2 font-medium">类型</th><th class="px-3 py-2 font-medium">对象</th><th class="px-3 py-2 font-medium">变更前</th><th class="px-3 py-2 font-medium">变更后</th></tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="5" class="px-3 py-10 text-center text-muted-foreground">暂无差异。</td></tr>'}</tbody>
          </table>
        </div>
        <footer class="flex justify-end border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-review-diff">关闭</button>
        </footer>
      </section>
    </div>
  `
}

function renderReviewNotificationDialog(): string {
  if (!state.reviewNotificationDialogNodeKey || !state.currentTechnicalVersionId) return ''
  const records = listTechPackReviewNotificationsByNode(state.currentTechnicalVersionId, state.reviewNotificationDialogNodeKey)
  const rows = records
    .map(
      (item) => `
        <tr class="border-t">
          <td class="px-3 py-2">${escapeHtml(item.notificationType)}</td>
          <td class="px-3 py-2">${escapeHtml(item.reviewerName || '-')}</td>
          <td class="px-3 py-2">${escapeHtml(item.sendStatus)}</td>
          <td class="px-3 py-2">${escapeHtml(item.sentAt)}</td>
          <td class="px-3 py-2 text-muted-foreground">${escapeHtml(item.failedReason || item.feishuMessageId || '-')}</td>
          <td class="px-3 py-2 text-muted-foreground">${escapeHtml(item.diffSummarySnapshot || '-')}</td>
        </tr>
      `,
    )
    .join('')
  return `
    <div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/45 p-4" data-dialog-backdrop="true" data-tech-review-layer="notification-dialog">
      <section class="flex max-h-[82vh] w-full max-w-4xl flex-col rounded-xl border bg-background shadow-2xl" data-dialog-panel="true">
        <header class="border-b px-6 py-4">
          <h3 class="text-lg font-semibold">飞书通知记录</h3>
        </header>
        <div class="overflow-auto px-6 py-5">
          <table class="min-w-full text-left text-sm">
            <thead class="bg-muted/40 text-muted-foreground">
              <tr><th class="px-3 py-2 font-medium">类型</th><th class="px-3 py-2 font-medium">接收人</th><th class="px-3 py-2 font-medium">结果</th><th class="px-3 py-2 font-medium">发送时间</th><th class="px-3 py-2 font-medium">消息/失败原因</th><th class="px-3 py-2 font-medium">差异摘要</th></tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="6" class="px-3 py-10 text-center text-muted-foreground">暂无飞书通知记录。</td></tr>'}</tbody>
          </table>
        </div>
        <footer class="flex justify-end border-t px-6 py-4">
          <button class="rounded-md border px-4 py-2 text-sm hover:bg-muted" data-tech-action="close-review-notifications">关闭</button>
        </footer>
      </section>
    </div>
  `
}

function renderReviewStatusSummary(record: NonNullable<ReturnType<typeof getTechnicalDataVersionById>>): string {
  const review = normalizeTechnicalReviewSnapshot(record)
  const items = [
    ['买手', review.buyerReview.status],
    ['版师', review.patternMakerReview.status],
    ['跟单', review.merchandiserReview.status],
  ]
  return `
    <div class="inline-flex items-center rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground" data-tech-review-header-summary="true">
      ${items
        .map(
          ([label, status]) =>
            `<span>${escapeHtml(label)}：<span class="font-medium text-foreground">${escapeHtml(status)}</span></span>`,
        )
        .join('<span class="mx-1">；</span>')}
    </div>
  `
}

function renderTechPackHeaderReviewAction(input: {
  record: NonNullable<ReturnType<typeof getTechnicalDataVersionById>> | null
  hasIncomplete: boolean
}): string {
  if (!input.record || input.record.versionStatus !== 'DRAFT') return ''
  const review = normalizeTechnicalReviewSnapshot(input.record)
  if (review.reviewStage === '未提交审核') {
    return `
      <button type="button" class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700" data-tech-action="submit-review">
        <i data-lucide="send" class="mr-2 h-4 w-4"></i>
        提交审核
      </button>
    `
  }
  if (canPublishTechnicalVersionByReview(input.record)) {
    const disabled = input.hasIncomplete ? 'pointer-events-none opacity-50' : ''
    return `
      <button type="button" class="inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 ${disabled}" data-tech-action="open-release" title="${input.hasIncomplete ? '核心域未补全，暂不可发布' : ''}">
        <i data-lucide="check" class="mr-2 h-4 w-4"></i>
        发布版本
      </button>
    `
  }
  if (review.reviewStage === '第一阶段并行审核' || review.reviewStage === '跟单复核') {
    return `
      ${renderReviewStatusSummary(input.record)}
      <button type="button" class="inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-muted" data-tech-action="open-review-detail-drawer">
        <i data-lucide="clipboard-check" class="mr-2 h-4 w-4"></i>
        查看审核详情
      </button>
    `
  }
  return ''
}

function renderReviewDetailDrawer(): string {
  if (!state.reviewDetailDrawerOpen || !state.currentTechnicalVersionId) return ''
  const record = getTechnicalDataVersionById(state.currentTechnicalVersionId)
  if (!record) return ''
  const review = normalizeTechnicalReviewSnapshot(record)
  const buyerActions =
    record.versionStatus === 'DRAFT' && review.reviewStage !== '未提交审核'
      ? renderNodeActions(review.buyerReview)
      : ''
  const patternActions =
    record.versionStatus === 'DRAFT' && review.reviewStage !== '未提交审核'
      ? renderNodeActions(review.patternMakerReview)
      : ''
  const merchandiserActions =
    record.versionStatus === 'DRAFT' &&
    review.buyerReview.status === '审核-已通过' &&
    review.patternMakerReview.status === '审核-已通过'
      ? renderNodeActions(review.merchandiserReview)
      : ''
  return `
    <div class="fixed inset-0 z-[60] bg-black/35" data-dialog-backdrop="true" data-tech-review-layer="detail-drawer">
      <section class="ml-auto flex h-full w-full max-w-5xl flex-col overflow-hidden border-l bg-background shadow-2xl" data-dialog-panel="true">
        <header class="flex items-start justify-between gap-4 border-b px-6 py-5">
          <div>
            <h3 class="text-lg font-semibold">技术包审核详情</h3>
            <p class="mt-1 text-sm text-muted-foreground">
              当前阶段：<span class="font-medium text-foreground">${escapeHtml(review.reviewStage)}</span>
              · 当前状态：<span class="font-medium text-foreground">${escapeHtml(getTechnicalReviewStatusText(record))}</span>
            </p>
          </div>
          <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded-md border text-lg leading-none hover:bg-muted" data-tech-action="close-review-detail-drawer" aria-label="关闭审核详情">×</button>
        </header>
        <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div class="mb-4 flex flex-wrap gap-2">
            ${renderReviewStatusSummary(record)}
          </div>
          <div class="grid gap-3 lg:grid-cols-3">
            ${renderReviewNodeCard({
              title: '买手审核',
              scope: '物料清单、核价',
              node: review.buyerReview,
              actions: buyerActions,
              technicalVersionId: record.technicalVersionId,
              record,
            })}
            ${renderReviewNodeCard({
              title: '版师审核',
              scope: '纸样管理、款色用料对应',
              node: review.patternMakerReview,
              actions: patternActions,
              technicalVersionId: record.technicalVersionId,
              record,
            })}
            ${renderReviewNodeCard({
              title: '跟单审核',
              scope: '剩余部分、整体复核',
              node: review.merchandiserReview,
              actions: merchandiserActions,
              technicalVersionId: record.technicalVersionId,
              record,
            })}
          </div>
        </div>
      </section>
    </div>
  `
}

function renderReviewNodeCard(input: {
  title: string
  scope: string
  node: TechnicalReviewNode
  actions: string
  technicalVersionId: string
  record: NonNullable<ReturnType<typeof getTechnicalDataVersionById>>
}): string {
  const diff = buildTechPackReviewDiffSnapshot(input.record, input.node.nodeKey)
  const notifications = listTechPackReviewNotificationsByNode(input.technicalVersionId, input.node.nodeKey)
  const canOperate = isCurrentUserAssigned(input.node)
  const latestNotification = notifications[0]
  return `
    <article class="rounded-lg border bg-muted/10 p-3">
      <div class="flex items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-medium text-foreground">${escapeHtml(input.title)}</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(input.scope)}</p>
        </div>
        <span class="inline-flex rounded border px-2 py-0.5 text-xs">${escapeHtml(input.node.status)}</span>
      </div>
      <div class="mt-3 grid gap-2 text-xs text-muted-foreground">
        <div>指定审核人：<span class="font-medium text-foreground">${escapeHtml(input.node.assignedReviewerName || '未指定')}</span>${canOperate ? '' : `<span class="ml-2 text-amber-600">仅 ${escapeHtml(input.node.assignedReviewerName || '-')} 可审核</span>`}</div>
        <div>审核时间：<span class="font-medium text-foreground">${escapeHtml(input.node.reviewedAt || '-')}</span></div>
        <div>开始说明：<span class="font-medium text-foreground">${escapeHtml(input.node.startedOpinion || '未填写')}</span></div>
        <div>审核意见：<span class="font-medium text-foreground">${escapeHtml(input.node.opinion || '未填写')}</span></div>
        <div>差异：<span class="font-medium text-foreground">${escapeHtml(diff.summaryText || input.node.diffSummaryText || '未生成差异快照')}</span></div>
        <div>飞书提醒：<span class="font-medium text-foreground">${escapeHtml(input.node.lastFeishuNotifyStatus || '未发送')}</span>${input.node.lastFeishuNotifyAt ? ` · ${escapeHtml(input.node.lastFeishuNotifyAt)}` : ''}${latestNotification?.failedReason ? ` · ${escapeHtml(latestNotification.failedReason)}` : ''}</div>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button type="button" class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-tech-action="open-review-diff" data-review-node="${escapeHtml(input.node.nodeKey)}">查看差异</button>
        <button type="button" class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted" data-tech-action="open-review-notifications" data-review-node="${escapeHtml(input.node.nodeKey)}">查看飞书记录</button>
        ${input.actions}
      </div>
    </article>
  `
}

function renderReviewButton(action: string, label: string, nodeKey?: string, style = 'border', extraAttrs = ''): string {
  const className =
    style === 'primary'
      ? 'inline-flex h-8 items-center rounded-md bg-blue-600 px-3 text-xs font-medium text-white hover:bg-blue-700'
      : style === 'danger'
      ? 'inline-flex h-8 items-center rounded-md border border-red-200 bg-white px-3 text-xs text-red-600 hover:bg-red-50'
      : 'inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted'
  return `<button type="button" class="${className}" data-tech-action="${escapeHtml(action)}"${nodeKey ? ` data-review-node="${escapeHtml(nodeKey)}"` : ''}${extraAttrs}>${escapeHtml(label)}</button>`
}

function isCurrentUserAssigned(node: TechnicalReviewNode): boolean {
  if (!node.assignedReviewerId && !node.assignedReviewerName) return true
  return currentUser.id === node.assignedReviewerId || currentUser.name === node.assignedReviewerName
}

function renderNodeActions(node: TechnicalReviewNode): string {
  const disabled = isCurrentUserAssigned(node) ? '' : ' disabled aria-disabled="true" title="仅指定审核人可处理"'
  if (node.status === '审核-已通过') return ''
  if (node.status === '审核中') {
    const nodeKey = node.nodeKey
    if (nodeKey === 'MERCHANDISER') {
      return [
        renderReviewButton('approve-review', '跟单复核通过', nodeKey, 'primary', disabled),
        renderReviewButton('return-review-first-stage', '打回买手、版师复审', nodeKey, 'danger', disabled),
      ].join('')
    }
    return [
      renderReviewButton('approve-review', '审核通过', nodeKey, 'primary', disabled),
      renderReviewButton('reject-review', '审核不通过', nodeKey, 'danger', disabled),
    ].join('')
  }
  return renderReviewButton('start-review', '开始审核', node.nodeKey, 'border', disabled)
}

export function renderTechPackPage(
  rawSpuCode: string,
  options?: {
    spuName?: string
    skuCatalog?: { skuCode: string; color: string; size: string }[]
    activeTab?: 'pattern' | 'bom' | 'process' | 'color-mapping' | 'size' | 'design' | 'attachments' | 'cost'
    styleId?: string
    technicalVersionId?: string
  },
): string {
  ensureTechPackPageState(rawSpuCode, {
    spuName: options?.spuName,
    skuCatalog: options?.skuCatalog,
    activeTab: options?.activeTab,
    styleId: options?.styleId,
    technicalVersionId: options?.technicalVersionId,
  })

  if (state.loading) {
    return '<div class="flex h-64 items-center justify-center text-muted-foreground">加载中...</div>'
  }

  if (!state.techPack || !state.currentSpuCode) {
    return `
      <div class="flex min-h-[320px] items-center justify-center">
        <section class="rounded-lg border bg-card p-8 text-center">
          <p class="text-base font-medium">未找到正式技术包版本</p>
        </section>
      </div>
    `
  }

  const checklist = getChecklist()
  const hasIncomplete = checklist.some((item) => item.required && !item.done)
  const currentRecord = state.currentTechnicalVersionId ? getTechnicalDataVersionById(state.currentTechnicalVersionId) : null
  return `
    <div data-tech-pack-page-root="true" class="space-y-4">
      <header class="flex items-start justify-between">
        <div>
          <div class="mb-1 flex items-center gap-2">
            <button type="button" class="inline-flex h-8 w-8 items-center justify-center rounded hover:bg-muted" data-tech-action="tech-back" aria-label="返回">
              <i data-lucide="arrow-left" class="h-4 w-4"></i>
            </button>
            <h1 class="text-xl font-semibold">技术包版本 - ${escapeHtml(state.currentTechnicalVersionCode || state.currentSpuCode)}</h1>
            ${renderStatusBadge(state.techPack.status)}
            ${state.techPack.versionLabel ? `<span class="text-sm text-muted-foreground">(${escapeHtml(state.techPack.versionLabel)})</span>` : ''}
          </div>
          <p class="ml-10 text-sm text-muted-foreground">${escapeHtml(state.techPack.spuName)}</p>
          ${renderTechPackSummary()}
          ${state.compatibilityMessage ? `<p class="ml-10 mt-2 text-sm text-red-600">${escapeHtml(state.compatibilityMessage)}</p>` : ''}
        </div>

        <div class="flex max-w-[64rem] flex-wrap items-center justify-end gap-3">
          ${renderTechPackVersionLogButton()}
          ${renderTechPackHeaderReviewAction({ record: currentRecord, hasIncomplete })}
          <div class="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
            <span class="mr-1 text-sm font-medium text-muted-foreground">关键项检查:</span>
            ${renderChecklist()}
          </div>
        </div>
      </header>

      ${renderTabHeader()}
      ${renderCurrentTabContent()}

      ${renderPatternDialog()}
      ${renderPatternTemplateDialog()}
      ${renderTechPackVersionLogDialog()}
      ${renderReviewSubmitDialog()}
      ${renderReviewActionDialog()}
      ${renderReviewDiffDialog()}
      ${renderReviewNotificationDialog()}
      ${renderReviewDetailDrawer()}
      ${renderReleaseDialog()}
      ${renderPatternFormDialog()}
      ${renderBomFormDialog()}
      ${renderDesignThumbnailPreviewDialog()}
      ${renderAddTechniqueDialog()}
      ${renderAddSizeDialog()}
      ${renderAddDesignDialog()}
      ${renderAddAttachmentDialog()}
    </div>
  `
}
