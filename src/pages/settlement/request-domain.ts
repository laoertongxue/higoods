import {
  state,
  cycleTypeConfig,
  pricingModeConfig,
  getSettlementRequestById,
  getSettlementVersionHistory,
  getSettlementStatusClass,
  getSettlementStatusLabel,
  getChangedFieldsSummary,
  maskBankAccountNo,
  escapeHtml,
} from './context'
import { buildSettlementChangeRequestPrintLink } from '../../data/fcs/fcs-route-links.ts'

export function renderSettlementRequestDetailDialog(): string {
  if (state.dialog.type !== 'request-detail') return ''
  const request = getSettlementRequestById(state.dialog.requestId)
  if (!request) return ''

  const currentEffectiveInfo =
    state.effectiveInfos.find((item) => item.factoryId === request.factoryId) ?? null
  const canReview = request.status === 'PENDING_REVIEW'
  const canReject = request.status === 'PENDING_REVIEW'
  const canPrint = request.status === 'PENDING_REVIEW'
  const targetVersionHint =
    request.status === 'APPROVED' ? request.targetVersionNo : `${request.currentVersionNo} -> ${request.targetVersionNo}`
  const versionHistory = getSettlementVersionHistory(request.factoryId)
    .sort((a, b) => b.effectiveAt.localeCompare(a.effectiveAt))
    .slice(0, 5)
  const versionHistoryCount = versionHistory.length

  const statusText = getSettlementStatusLabel(request.status)
  const statusClass = getSettlementStatusClass(request.status)

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-settle-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[680px]" data-dialog-panel="true">
        <div class="flex h-full flex-col">
          <header class="border-b px-6 py-4">
            <div class="flex items-center justify-between">
              <h3 class="text-lg font-semibold">结算信息修改申请</h3>
              <span class="inline-flex rounded border px-2 py-0.5 text-xs ${statusClass}">${statusText}</span>
            </div>
            <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(request.requestId)} · ${escapeHtml(request.factoryName)}</p>
          </header>

          <div class="flex-1 space-y-4 overflow-y-auto px-6 py-5">
            ${
              state.requestOperateError
                ? `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">${escapeHtml(state.requestOperateError)}</div>`
                : ''
            }

            <section class="rounded-lg border p-4">
              <p class="text-sm font-semibold">申请基础信息</p>
              <div class="mt-2 grid grid-cols-2 gap-3 text-xs">
                <p class="text-muted-foreground">申请号：<span class="font-medium text-foreground">${escapeHtml(request.requestId)}</span></p>
                <p class="text-muted-foreground">工厂：<span class="font-medium text-foreground">${escapeHtml(request.factoryName)}</span></p>
                <p class="text-muted-foreground">申请时间：<span class="font-medium text-foreground">${escapeHtml(request.submittedAt)}</span></p>
                <p class="text-muted-foreground">提交人：<span class="font-medium text-foreground">${escapeHtml(request.submittedBy)}</span></p>
                <p class="text-muted-foreground">当前生效版本：<span class="font-medium text-foreground">${escapeHtml(request.currentVersionNo)}</span></p>
                <p class="text-muted-foreground">目标生效版本：<span class="font-medium text-foreground">${escapeHtml(request.targetVersionNo)}</span></p>
              </div>
            </section>

            <section class="rounded-lg border p-4">
              <p class="text-sm font-semibold">当前版本信息</p>
              <div class="mt-2 grid grid-cols-2 gap-3 text-xs">
                <p class="text-muted-foreground">当前生效版本号：<span class="font-medium text-foreground">${escapeHtml(request.currentVersionNo)}</span></p>
                <p class="text-muted-foreground">最近生效时间：<span class="font-medium text-foreground">${escapeHtml(currentEffectiveInfo?.effectiveAt || request.effectiveAt || request.submittedAt)}</span></p>
                <p class="text-muted-foreground">生效后版本：<span class="font-medium text-foreground">${escapeHtml(targetVersionHint)}</span></p>
                <p class="text-muted-foreground">历史版本数：<span class="font-medium text-foreground">${versionHistoryCount} 个</span></p>
              </div>
              <div class="mt-2 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                <p>结算配置：${escapeHtml(currentEffectiveInfo ? `${cycleTypeConfig[currentEffectiveInfo.settlementConfigSnapshot.cycleType].label} · ${pricingModeConfig[currentEffectiveInfo.settlementConfigSnapshot.pricingMode].label} · ${currentEffectiveInfo.settlementConfigSnapshot.currency}` : '—')}</p>
                <p>收款账号：${escapeHtml(currentEffectiveInfo ? maskBankAccountNo(currentEffectiveInfo.receivingAccountSnapshot.bankAccountNo) : '—')}</p>
                <p>扣款规则：${currentEffectiveInfo ? `${currentEffectiveInfo.defaultDeductionRulesSnapshot.length} 条` : '—'}</p>
              </div>
            </section>

            <section class="rounded-lg border p-4">
              <p class="text-sm font-semibold">版本历史（最近${versionHistoryCount}条）</p>
              <div class="mt-2 space-y-2">
                ${
                  versionHistory.length > 0
                    ? versionHistory
                        .map(
                          (version) => `
                            <div class="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                              <div class="flex items-center justify-between">
                                <span class="font-medium">${escapeHtml(version.versionNo)}</span>
                                <span class="text-muted-foreground">${escapeHtml(version.effectiveAt)}</span>
                              </div>
                              <p class="mt-1 text-muted-foreground">生效人：${escapeHtml(version.effectiveBy)}</p>
                              <p class="mt-1 text-muted-foreground">结算配置：${escapeHtml(cycleTypeConfig[version.settlementConfigSnapshot.cycleType].label)} · ${escapeHtml(pricingModeConfig[version.settlementConfigSnapshot.pricingMode].label)} · ${escapeHtml(version.settlementConfigSnapshot.currency)}</p>
                              <p class="text-muted-foreground">收款账号：${escapeHtml(maskBankAccountNo(version.receivingAccountSnapshot.bankAccountNo))}</p>
                              <p class="text-muted-foreground">扣款规则：${version.defaultDeductionRulesSnapshot.length} 条</p>
                            </div>
                          `,
                        )
                        .join('')
                    : '<p class="text-xs text-muted-foreground">暂无版本历史</p>'
                }
              </div>
            </section>

            <section class="rounded-lg border p-4">
              <p class="text-sm font-semibold">变更前后对比</p>
              <div class="mt-2 grid gap-3 md:grid-cols-2">
                <div class="rounded-md border bg-muted/20 p-3 text-xs">
                  <p class="mb-1 font-medium">变更前（当前生效）</p>
                  <p>开户名：${escapeHtml(request.before.accountHolderName)}</p>
                  <p>证件号：${escapeHtml(request.before.idNumber)}</p>
                  <p>银行名称：${escapeHtml(request.before.bankName)}</p>
                  <p>银行账号：${escapeHtml(maskBankAccountNo(request.before.bankAccountNo))}</p>
                  <p>开户支行：${escapeHtml(request.before.bankBranch || '—')}</p>
                </div>
                <div class="rounded-md border bg-muted/20 p-3 text-xs">
                  <p class="mb-1 font-medium">变更后（申请值）</p>
                  <p>开户名：${escapeHtml(request.after.accountHolderName)}</p>
                  <p>证件号：${escapeHtml(request.after.idNumber)}</p>
                  <p>银行名称：${escapeHtml(request.after.bankName)}</p>
                  <p>银行账号：${escapeHtml(maskBankAccountNo(request.after.bankAccountNo))}</p>
                  <p>开户支行：${escapeHtml(request.after.bankBranch || '—')}</p>
                </div>
              </div>
              <p class="mt-2 text-xs text-blue-700">本次申请仅变更收款账号；审核通过后将复制当前版本生成新版本，结算配置与扣款规则沿用上一版本。</p>
            </section>

            <section class="rounded-lg border p-4">
              <p class="text-sm font-semibold">处理动作</p>
              ${
                canPrint
                  ? `<div class="mt-2"><button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-settle-action="print-settlement-change-form" data-request-id="${escapeHtml(request.requestId)}">打印申请单</button></div>`
                  : ''
              }
              ${
                canReview
                  ? `
                    <div class="mt-2 space-y-2">
                      <div class="flex flex-wrap gap-2">
                        <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-settle-action="upload-settlement-signed-proof" data-request-id="${escapeHtml(request.requestId)}" data-file-type="IMAGE">上传签字证明图片</button>
                        <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-settle-action="upload-settlement-signed-proof" data-request-id="${escapeHtml(request.requestId)}" data-file-type="FILE">上传签字证明附件</button>
                      </div>
                      <p class="text-[11px] text-muted-foreground">请上传工厂线下签字后的变更申请证明，作为审核依据</p>
                      <div class="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                        ${
                          request.signedProofFiles.length > 0
                            ? request.signedProofFiles
                                .map(
                                  (file) =>
                                    `<p>${escapeHtml(file.name)} · ${escapeHtml(file.uploadedAt)} · ${escapeHtml(file.uploadedBy)}</p>`,
                                )
                                .join('')
                            : '<p class="text-muted-foreground">暂未上传签字证明附件</p>'
                        }
                      </div>
                      <label class="inline-flex items-center gap-2 text-xs">
                        <input type="checkbox" data-settle-request-field="paperArchived" ${request.paperArchived ? 'checked' : ''} />
                        纸质文件已留档
                      </label>
                      <label class="block text-xs">
                        <span class="mb-1 block text-muted-foreground">审核备注</span>
                        <textarea class="min-h-[72px] w-full rounded-md border px-3 py-2 text-xs" data-settle-request-field="followupRemark">${escapeHtml(state.requestOperateForm.followupRemark)}</textarea>
                      </label>
                      <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-settle-action="followup-settlement-request" data-request-id="${escapeHtml(request.requestId)}">记录处理备注</button>
                      ${
                        canReject
                          ? `
                            <label class="block text-xs">
                              <span class="mb-1 block text-muted-foreground">不通过原因（不通过时必填）</span>
                              <textarea class="min-h-[72px] w-full rounded-md border px-3 py-2 text-xs" data-settle-request-field="rejectReason">${escapeHtml(state.requestOperateForm.rejectReason)}</textarea>
                            </label>
                          `
                          : ''
                      }
                      <div class="flex gap-2">
                        <button class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-settle-action="reject-settlement-request" data-request-id="${escapeHtml(request.requestId)}">不通过</button>
                        <button class="rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white hover:bg-green-700 ${request.signedProofFiles.length === 0 ? 'pointer-events-none opacity-50' : ''}" data-settle-action="approve-settlement-request" data-request-id="${escapeHtml(request.requestId)}">通过</button>
                      </div>
                    </div>
                  `
                  : ''
              }

              ${
                !canReview
                  ? `
                    <div class="mt-2 rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                      ${
                        request.status === 'APPROVED'
                          ? `已于 ${escapeHtml(request.effectiveAt || '—')} 审核通过，生效版本：${escapeHtml(request.targetVersionNo)}，生效人：${escapeHtml(request.effectiveBy || '—')}`
                          : `不通过原因：${escapeHtml(request.rejectReason || '—')}`
                      }
                    </div>
                  `
                  : ''
              }
            </section>

            <section class="rounded-lg border p-4">
              <p class="text-sm font-semibold">处理日志</p>
              <div class="mt-2 space-y-2">
                ${request.logs
                  .map(
                    (log) => `
                      <div class="rounded-md border bg-muted/20 px-3 py-2 text-xs">
                        <div class="flex items-center justify-between">
                          <span class="font-medium">${escapeHtml(log.action)}</span>
                          <span class="text-muted-foreground">${escapeHtml(log.createdAt)}</span>
                        </div>
                        <p class="mt-1 text-muted-foreground">操作人：${escapeHtml(log.actor)}</p>
                        <p class="text-muted-foreground">${escapeHtml(log.remark)}</p>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            </section>
          </div>

          <footer class="flex items-center justify-end border-t px-6 py-3">
            <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-settle-action="close-dialog">关闭</button>
          </footer>
        </div>
      </section>
    </div>
  `
}

export function renderSettlementRequestPrintDialog(): string {
  if (state.dialog.type !== 'request-print') return ''
  const request = getSettlementRequestById(state.dialog.requestId)
  if (!request) return ''

  return `
    <div class="fixed inset-0 z-50" data-dialog-backdrop="true">
      <button class="absolute inset-0 bg-black/45" data-settle-action="close-dialog" aria-label="关闭"></button>
      <section class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl sm:max-w-[760px]" data-dialog-panel="true">
        <div class="flex h-full flex-col">
          <header class="flex items-center justify-between border-b px-6 py-4">
            <div>
              <h3 class="text-lg font-semibold">结算信息变更申请单</h3>
              <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(request.requestId)} · ${escapeHtml(request.factoryName)}</p>
            </div>
            <div class="flex gap-2">
              <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildSettlementChangeRequestPrintLink(request.requestId))}">进入统一打印预览</button>
              <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-settle-action="close-dialog">关闭</button>
            </div>
          </header>
          <div class="flex-1 overflow-y-auto p-6">
            <article class="mx-auto max-w-[680px] rounded-lg border bg-card p-6 text-sm" id="settlement-print-area">
              <h4 class="text-center text-lg font-semibold">结算信息变更</h4>
              <p class="mt-2 text-center text-xs text-muted-foreground">申请号：${escapeHtml(request.requestId)} · 申请时间：${escapeHtml(request.submittedAt)}</p>

              <section class="mt-4 space-y-1 text-xs">
                <p><span class="text-muted-foreground">工厂名称：</span>${escapeHtml(request.factoryName)}</p>
                <p><span class="text-muted-foreground">提交人：</span>${escapeHtml(request.submittedBy)}</p>
                <p><span class="text-muted-foreground">当前版本号：</span>${escapeHtml(request.currentVersionNo)} · <span class="text-muted-foreground">目标版本号：</span>${escapeHtml(request.targetVersionNo)}</p>
                <p><span class="text-muted-foreground">申请说明：</span>${escapeHtml(request.submitRemark || '—')}</p>
              </section>

              <section class="mt-4 rounded-md border p-3 text-xs leading-6">
                <p>
                  ${escapeHtml(request.factoryName)}，申请将结算信息从原来的
                  开户名“${escapeHtml(request.before.accountHolderName)}”、证件号“${escapeHtml(request.before.idNumber)}”、银行“${escapeHtml(
      request.before.bankName,
    )}”、账号“${escapeHtml(maskBankAccountNo(request.before.bankAccountNo))}”、支行“${escapeHtml(request.before.bankBranch || '—')}”
                  变更为
                  开户名“${escapeHtml(request.after.accountHolderName)}”、证件号“${escapeHtml(request.after.idNumber)}”、银行“${escapeHtml(
      request.after.bankName,
    )}”、账号“${escapeHtml(maskBankAccountNo(request.after.bankAccountNo))}”、支行“${escapeHtml(request.after.bankBranch || '—')}”。
                </p>
              </section>

              <section class="mt-4 grid gap-3 md:grid-cols-3">
                <div class="rounded-md border p-3 text-xs">
                  <p class="font-semibold">签字</p>
                  <p class="mt-8 text-muted-foreground">签字：________________</p>
                  <p class="mt-2 text-muted-foreground">日期：________________</p>
                </div>
                <div class="rounded-md border p-3 text-xs">
                  <p class="font-semibold">平台核实区</p>
                  <p class="mt-8 text-muted-foreground">核实人：________________</p>
                  <p class="mt-2 text-muted-foreground">日期：________________</p>
                </div>
                <div class="rounded-md border p-3 text-xs">
                  <p class="font-semibold">审核区</p>
                  <p class="mt-8 text-muted-foreground">审核人：________________</p>
                  <p class="mt-2 text-muted-foreground">日期：________________</p>
                </div>
              </section>
            </article>
          </div>
        </div>
      </section>
    </div>
  `
}
