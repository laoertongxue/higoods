import { appStore } from '../state/store'
import { escapeHtml, toClassName } from '../utils'
import { processTasks, type ProcessTask } from '../data/fcs/process-tasks'
import {
  findPdaHandoverEvent,
  updatePdaHandoverEvent,
  type HandoverAction,
  type HandoverEvent,
  type HandoverQcResult,
} from '../data/fcs/pda-handover-events'
import { renderPdaFrame } from './pda-shell'

interface PdaHandoverDetailState {
  initializedKey: string
  qtyActual: string
  diffReason: string
  diffNote: string
  qcResult: '' | HandoverQcResult
  qcDefectQty: string
  qcIssueType: string
  qcNote: string
  showDisputeDialog: boolean
}

const detailState: PdaHandoverDetailState = {
  initializedKey: '',
  qtyActual: '',
  diffReason: '',
  diffNote: '',
  qcResult: '',
  qcDefectQty: '',
  qcIssueType: '',
  qcNote: '',
  showDisputeDialog: false,
}

const DIFF_REASONS = ['短少', '超发', '破损', '混批', '其他']
const QC_ISSUE_TYPES = ['外观瑕疵', '工艺问题', '污损', '破损', '尺寸偏差', '混批', '其他']

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseNumberOr(value: string, fallback: number): number {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return fallback
  return parsed
}

function syncState(eventId: string, event: HandoverEvent): void {
  const pathname = appStore.getState().pathname
  const key = `${eventId}|${pathname}`
  if (detailState.initializedKey === key) return

  detailState.initializedKey = key
  detailState.qtyActual = String(event.qtyActual ?? event.qtyExpected)
  detailState.diffReason = event.diffReason ?? ''
  detailState.diffNote = event.diffNote ?? ''
  detailState.qcResult = event.qcResult ?? ''
  detailState.qcDefectQty = event.qcDefectQty != null ? String(event.qcDefectQty) : ''
  detailState.qcIssueType = event.qcProblemType ?? ''
  detailState.qcNote = event.qcProblemDesc ?? ''
  detailState.showDisputeDialog = false
}

function showPdaHandoverDetailToast(message: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return

  const rootId = 'pda-handover-detail-toast-root'
  let root = document.getElementById(rootId)

  if (!root) {
    root = document.createElement('div')
    root.id = rootId
    root.className = 'pointer-events-none fixed right-6 top-20 z-[130] flex max-w-sm flex-col gap-2'
    document.body.appendChild(root)
  }

  const toast = document.createElement('div')
  toast.className =
    'pointer-events-auto rounded-md border bg-background px-4 py-3 text-sm text-foreground shadow-md transition-all duration-200'
  toast.textContent = message
  toast.style.opacity = '0'
  toast.style.transform = 'translateY(-6px)'
  root.appendChild(toast)

  window.requestAnimationFrame(() => {
    toast.style.opacity = '1'
    toast.style.transform = 'translateY(0)'
  })

  window.setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(-6px)'

    window.setTimeout(() => {
      toast.remove()
      if (root && root.childElementCount === 0) {
        root.remove()
      }
    }, 180)
  }, 2200)
}

function getActionTitle(action: HandoverAction): string {
  if (action === 'PICKUP') return '领料详情'
  if (action === 'RECEIVE') return '接收详情'
  return '交出详情'
}

function getStatusLabel(event: HandoverEvent): string {
  if (event.status === 'CONFIRMED') return event.action === 'PICKUP' ? '已确认领料' : event.action === 'RECEIVE' ? '已确认接收' : '已确认交出'
  if (event.status === 'DISPUTED') return '争议中'
  return '待处理'
}

function getStatusClass(event: HandoverEvent): string {
  if (event.status === 'CONFIRMED') return 'border-primary/20 bg-primary text-primary-foreground'
  if (event.status === 'DISPUTED') return 'border-destructive/20 bg-destructive text-destructive-foreground'
  return 'border-border bg-background text-muted-foreground'
}

function renderFieldRow(label: string, value: string, highlight = false): string {
  return `
    <div>
      <span class="text-muted-foreground">${escapeHtml(label)}：</span>
      <span class="${highlight ? 'font-medium text-primary' : 'font-medium'}">${escapeHtml(value)}</span>
    </div>
  `
}

function renderSectionCard(title: string, body: string): string {
  return `
    <article class="rounded-lg border bg-card">
      <header class="border-b px-3 py-2.5">
        <h2 class="text-sm font-semibold">${escapeHtml(title)}</h2>
      </header>
      <div class="space-y-2 px-3 pb-3 pt-2.5">
        ${body}
      </div>
    </article>
  `
}

function renderPartyRow(label: string, kind: HandoverEvent['fromPartyKind'], name: string): string {
  return `
    <div class="flex items-center gap-2 text-sm">
      <span class="w-16 shrink-0 text-muted-foreground">${escapeHtml(label)}：</span>
      <span class="inline-flex items-center gap-1">
        <i data-lucide="${kind === 'WAREHOUSE' ? 'warehouse' : 'factory'}" class="h-3.5 w-3.5 text-muted-foreground"></i>
        <span class="font-medium">${escapeHtml(name)}</span>
      </span>
    </div>
  `
}

function renderEvidencePlaceholder(): string {
  return `
    <div class="flex items-center gap-2 rounded-md border p-2 text-xs text-muted-foreground">
      <i data-lucide="camera" class="h-4 w-4 shrink-0"></i>
      <span>现场图片/证据（占位，可拍照上传）</span>
    </div>
  `
}

function appendTaskAudit(taskId: string, action: string, detail: string, by: string): void {
  const task = processTasks.find((item) => item.taskId === taskId) as (ProcessTask & {
    handoverStatus?: string
    handoutStatus?: string
  }) | undefined
  if (!task) return

  const now = nowTimestamp()
  task.updatedAt = now
  task.auditLogs = [
    ...task.auditLogs,
    {
      id: `AL-HO-${Date.now()}`,
      action,
      detail,
      at: now,
      by,
    },
  ]
}

function mutateTaskByHandover(event: HandoverEvent, mode: 'confirm' | 'dispute'): void {
  const task = processTasks.find((item) => item.taskId === event.taskId) as (ProcessTask & {
    handoverStatus?: string
    handoutStatus?: string
  }) | undefined
  if (!task) return

  const now = nowTimestamp()
  task.updatedAt = now

  if (event.action === 'PICKUP') {
    task.handoverStatus = mode === 'confirm' ? 'PICKED_UP' : 'PENDING'
  } else if (event.action === 'RECEIVE') {
    task.handoverStatus = mode === 'confirm' ? 'RECEIVED' : 'PENDING'
  } else {
    task.handoutStatus = mode === 'confirm' ? 'HANDED_OUT' : 'PENDING'
  }
}

function handleConfirm(event: HandoverEvent): { ok: boolean; message?: string } {
  const qtyActual = parseNumberOr(detailState.qtyActual, event.qtyExpected)
  const qtyDiff = Math.abs(qtyActual - event.qtyExpected)

  if (event.action === 'RECEIVE' && !detailState.qcResult) {
    return { ok: false, message: '请先填写质检结论' }
  }

  updatePdaHandoverEvent(event.eventId, (target) => {
    target.status = 'CONFIRMED'
    target.qtyActual = qtyActual
    target.qtyDiff = qtyDiff > 0 ? qtyDiff : undefined
    target.diffReason = qtyDiff > 0 ? target.diffReason || '数量差异待核实' : undefined
    target.diffNote = qtyDiff > 0 ? target.diffNote : undefined
    target.confirmedAt = nowTimestamp()
    if (event.action === 'RECEIVE') {
      target.qcResult = detailState.qcResult || undefined
      target.qcDefectQty = detailState.qcDefectQty ? parseNumberOr(detailState.qcDefectQty, 0) : undefined
      target.qcProblemType = detailState.qcIssueType || undefined
      target.qcProblemDesc = detailState.qcNote || undefined
    }
  })

  mutateTaskByHandover(event, 'confirm')
  appendTaskAudit(
    event.taskId,
    `HANDOVER_${event.action}_CONFIRM`,
    `交接确认：${event.eventId}，数量 ${qtyActual}/${event.qtyExpected}`,
    'PDA',
  )

  return { ok: true }
}

function handleDispute(event: HandoverEvent): { ok: boolean; message?: string } {
  const qtyActual = parseNumberOr(detailState.qtyActual, event.qtyExpected)
  const qtyDiff = Math.abs(qtyActual - event.qtyExpected)

  if (!detailState.diffReason) {
    return { ok: false, message: '请选择差异原因' }
  }
  if (!detailState.diffNote.trim()) {
    return { ok: false, message: '请填写差异说明' }
  }

  updatePdaHandoverEvent(event.eventId, (target) => {
    target.status = 'DISPUTED'
    target.qtyActual = qtyActual
    target.qtyDiff = qtyDiff > 0 ? qtyDiff : undefined
    target.diffReason = detailState.diffReason
    target.diffNote = detailState.diffNote.trim()
    target.confirmedAt = undefined
    if (event.action === 'RECEIVE') {
      target.qcResult = (detailState.qcResult || 'FAIL') as HandoverQcResult
      target.qcDefectQty = detailState.qcDefectQty ? parseNumberOr(detailState.qcDefectQty, 0) : undefined
      target.qcProblemType = detailState.qcIssueType || undefined
      target.qcProblemDesc = detailState.qcNote || detailState.diffNote.trim()
    }
  })

  mutateTaskByHandover(event, 'dispute')
  appendTaskAudit(
    event.taskId,
    `HANDOVER_${event.action}_DISPUTE`,
    `交接争议：${event.eventId}，原因 ${detailState.diffReason}，备注 ${detailState.diffNote.trim()}`,
    'PDA',
  )

  return { ok: true }
}

function renderPickupDetail(event: HandoverEvent): string {
  const isPending = event.status === 'PENDING'
  const qtyDiff = parseNumberOr(detailState.qtyActual, event.qtyExpected) - event.qtyExpected

  return `
    ${renderSectionCard(
      '领料信息',
      `
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('任务编号', event.taskId)}
        ${renderFieldRow('生产单号', event.productionOrderId)}
        ${renderFieldRow('当前工序', event.currentProcess)}
      </div>
      <div class="h-px bg-border"></div>
      ${renderPartyRow('来源仓库', event.fromPartyKind, event.fromPartyName)}
      ${renderPartyRow('领料工厂', event.toPartyKind, event.toPartyName)}
      <div class="h-px bg-border"></div>
      ${
        event.materialSummary
          ? `<div class="text-sm"><span class="text-muted-foreground">面辅料摘要：</span><span>${escapeHtml(event.materialSummary)}</span></div>`
          : ''
      }
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('应领数量', `${event.qtyExpected} ${event.qtyUnit}`)}
        ${event.qtyActual != null ? renderFieldRow('实领数量', `${event.qtyActual} ${event.qtyUnit}`) : ''}
      </div>
      <div class="text-xs text-muted-foreground">领料截止：${escapeHtml(event.deadlineTime)}</div>
      ${
        event.status !== 'PENDING'
          ? `<span class="inline-flex w-fit items-center rounded border px-2 py-0.5 text-xs ${getStatusClass(event)}">${getStatusLabel(event)}</span>`
          : ''
      }
      ${
        event.diffReason
          ? `<div class="text-xs"><span class="text-muted-foreground">差异原因：</span>${escapeHtml(event.diffReason)}${
              event.diffNote ? `<span class="ml-2 text-muted-foreground">· ${escapeHtml(event.diffNote)}</span>` : ''
            }</div>`
          : ''
      }
    `,
    )}

    ${
      isPending
        ? renderSectionCard(
            '确认实领数量',
            `
          <div class="space-y-2">
            <label class="text-xs">实领数量（${escapeHtml(event.qtyUnit)}）</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              type="number"
              value="${escapeHtml(detailState.qtyActual)}"
              data-pda-handoverd-field="qtyActual"
            />
            ${
              qtyDiff !== 0
                ? `<p class="text-xs text-amber-600">与应领数量存在差异（${
                    qtyDiff > 0 ? '+' : ''
                  }${qtyDiff} ${escapeHtml(event.qtyUnit)}）</p>`
                : ''
            }
          </div>
        `,
          )
        : ''
    }

    ${
      isPending
        ? `
          <div class="flex gap-3">
            <button
              class="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              data-pda-handoverd-action="confirm"
              data-event-id="${escapeHtml(event.eventId)}"
            >
              <i data-lucide="check" class="mr-2 h-4 w-4"></i>确认领料
            </button>
            <button
              class="inline-flex h-9 flex-1 items-center justify-center rounded-md border px-3 text-sm hover:bg-muted"
              data-pda-handoverd-action="open-dispute"
            >
              <i data-lucide="alert-triangle" class="mr-2 h-4 w-4"></i>提出差异
            </button>
          </div>
        `
        : ''
    }
  `
}

function renderReceiveDetail(event: HandoverEvent): string {
  const isPending = event.status === 'PENDING'
  const qtyDiff = parseNumberOr(detailState.qtyActual, event.qtyExpected) - event.qtyExpected
  const qcFail = detailState.qcResult === 'FAIL'

  return `
    ${renderSectionCard(
      '接收信息',
      `
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('任务编号', event.taskId)}
        ${renderFieldRow('生产单号', event.productionOrderId)}
        ${event.prevProcess ? renderFieldRow('上一道工序', event.prevProcess) : ''}
        ${renderFieldRow('当前工序', event.currentProcess)}
      </div>
      <div class="h-px bg-border"></div>
      ${renderPartyRow('来源工厂', event.fromPartyKind, event.fromPartyName)}
      ${renderPartyRow('接收工厂', event.toPartyKind, event.toPartyName)}
      <div class="h-px bg-border"></div>
      <div class="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('应收数量', `${event.qtyExpected} ${event.qtyUnit}`)}
        ${
          !isPending && event.qtyActual != null
            ? renderFieldRow('实收数量', `${event.qtyActual} ${event.qtyUnit}`)
            : ''
        }
        ${
          !isPending && event.qtyActual != null
            ? renderFieldRow(
                '差异数量',
                `${event.qtyActual - event.qtyExpected > 0 ? '+' : ''}${
                  event.qtyActual - event.qtyExpected
                } ${event.qtyUnit}`,
              )
            : ''
        }
      </div>
      <div class="text-xs text-muted-foreground">接收截止：${escapeHtml(event.deadlineTime)}</div>
      ${
        event.status !== 'PENDING'
          ? `<span class="inline-flex w-fit items-center rounded border px-2 py-0.5 text-xs ${getStatusClass(event)}">${getStatusLabel(event)}</span>`
          : ''
      }
    `,
    )}

    ${
      renderSectionCard(
        '到货质检',
        !isPending
          ? `
              ${
                event.qcResult
                  ? `
                    <div class="space-y-1.5 text-sm">
                      <div class="flex items-center gap-2">
                        <span class="text-muted-foreground">质检结论：</span>
                        <span class="inline-flex items-center rounded border px-2 py-0.5 text-xs ${
                          event.qcResult === 'PASS'
                            ? 'border-primary/20 bg-primary text-primary-foreground'
                            : 'border-destructive/20 bg-destructive text-destructive-foreground'
                        }">${event.qcResult === 'PASS' ? '合格' : '不合格'}</span>
                      </div>
                      ${
                        event.qcDefectQty != null
                          ? renderFieldRow('不合格数量', `${event.qcDefectQty} ${event.qtyUnit}`)
                          : ''
                      }
                      ${event.qcProblemType ? renderFieldRow('问题类型', event.qcProblemType) : ''}
                      ${event.qcProblemDesc ? renderFieldRow('问题说明', event.qcProblemDesc) : ''}
                    </div>
                  `
                  : '<p class="text-xs text-muted-foreground">暂无质检记录</p>'
              }
            `
          : `
              <div class="space-y-3">
                <div class="space-y-1.5">
                  <label class="text-xs font-medium">质检结论 *</label>
                  <div class="flex gap-4">
                    <button
                      class="inline-flex items-center gap-1.5 text-sm ${
                        detailState.qcResult === 'PASS' ? 'font-medium text-green-700' : 'text-muted-foreground'
                      }"
                      data-pda-handoverd-action="set-qc-result"
                      data-value="PASS"
                    >
                      <span class="inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                        detailState.qcResult === 'PASS' ? 'border-green-600 bg-green-600 text-white' : 'border-border'
                      }">${detailState.qcResult === 'PASS' ? '•' : ''}</span>
                      合格
                    </button>
                    <button
                      class="inline-flex items-center gap-1.5 text-sm ${
                        detailState.qcResult === 'FAIL' ? 'font-medium text-destructive' : 'text-muted-foreground'
                      }"
                      data-pda-handoverd-action="set-qc-result"
                      data-value="FAIL"
                    >
                      <span class="inline-flex h-4 w-4 items-center justify-center rounded-full border ${
                        detailState.qcResult === 'FAIL'
                          ? 'border-destructive bg-destructive text-white'
                          : 'border-border'
                      }">${detailState.qcResult === 'FAIL' ? '•' : ''}</span>
                      不合格
                    </button>
                  </div>
                </div>

                ${
                  qcFail
                    ? `
                      <div class="space-y-1.5">
                        <label class="text-xs">不合格数量（${escapeHtml(event.qtyUnit)}）</label>
                        <input
                          class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                          type="number"
                          placeholder="0"
                          value="${escapeHtml(detailState.qcDefectQty)}"
                          data-pda-handoverd-field="qcDefectQty"
                        />
                      </div>
                      <div class="space-y-1.5">
                        <label class="text-xs">问题类型</label>
                        <select
                          class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                          data-pda-handoverd-field="qcIssueType"
                        >
                          <option value="">请选择</option>
                          ${QC_ISSUE_TYPES.map(
                            (item) =>
                              `<option value="${escapeHtml(item)}" ${
                                detailState.qcIssueType === item ? 'selected' : ''
                              }>${escapeHtml(item)}</option>`,
                          ).join('')}
                        </select>
                      </div>
                      <div class="space-y-1.5">
                        <label class="text-xs">问题说明</label>
                        <textarea
                          class="min-h-[64px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                          placeholder="请描述具体问题（可选）"
                          data-pda-handoverd-field="qcNote"
                        >${escapeHtml(detailState.qcNote)}</textarea>
                      </div>
                      ${renderEvidencePlaceholder()}
                    `
                    : ''
                }

                <div class="h-px bg-border"></div>
                <div class="space-y-1.5">
                  <label class="text-xs font-medium">实收数量（${escapeHtml(event.qtyUnit)}）</label>
                  <input
                    class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    type="number"
                    value="${escapeHtml(detailState.qtyActual)}"
                    data-pda-handoverd-field="qtyActual"
                  />
                  ${
                    qtyDiff !== 0
                      ? `<p class="text-xs text-amber-600">差异：${qtyDiff > 0 ? '+' : ''}${qtyDiff} ${escapeHtml(
                          event.qtyUnit,
                        )}（与应收数量不符）</p>`
                      : ''
                  }
                </div>
              </div>
            `,
      )
    }

    ${
      isPending
        ? `
          <div class="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">接收完成后，具备开工条件。如存在数量差异或质量问题，请提出争议留证。</div>
          <div class="flex gap-3">
            <button
              class="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              data-pda-handoverd-action="confirm"
              data-event-id="${escapeHtml(event.eventId)}"
            >
              <i data-lucide="check" class="mr-2 h-4 w-4"></i>确认接收
            </button>
            <button
              class="inline-flex h-9 flex-1 items-center justify-center rounded-md border px-3 text-sm hover:bg-muted"
              data-pda-handoverd-action="open-dispute"
            >
              <i data-lucide="alert-triangle" class="mr-2 h-4 w-4"></i>提出争议
            </button>
          </div>
        `
        : ''
    }
  `
}

function renderHandoutDetail(event: HandoverEvent): string {
  const isPending = event.status === 'PENDING'
  const qtyDiff = parseNumberOr(detailState.qtyActual, event.qtyExpected) - event.qtyExpected

  return `
    ${renderSectionCard(
      '交出信息',
      `
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('任务编号', event.taskId)}
        ${renderFieldRow('生产单号', event.productionOrderId)}
        ${renderFieldRow('当前工序', event.currentProcess)}
      </div>
      <div class="h-px bg-border"></div>
      ${renderPartyRow('交出工厂', event.fromPartyKind, event.fromPartyName)}
      ${renderPartyRow(event.toPartyKind === 'WAREHOUSE' ? '去向仓库' : '去向工厂', event.toPartyKind, event.toPartyName)}
      <div class="h-px bg-border"></div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('应交数量', `${event.qtyExpected} ${event.qtyUnit}`)}
        ${event.qtyActual != null ? renderFieldRow('实交数量', `${event.qtyActual} ${event.qtyUnit}`) : ''}
      </div>
      <div class="text-xs text-muted-foreground">交出截止：${escapeHtml(event.deadlineTime)}</div>
      ${
        event.status !== 'PENDING'
          ? `<span class="inline-flex w-fit items-center rounded border px-2 py-0.5 text-xs ${getStatusClass(event)}">${getStatusLabel(event)}</span>`
          : ''
      }
      ${
        event.diffReason
          ? `<div class="text-xs"><span class="text-muted-foreground">差异原因：</span>${escapeHtml(event.diffReason)}</div>`
          : ''
      }
    `,
    )}

    ${
      isPending
        ? renderSectionCard(
            '确认实交数量',
            `
          <div class="space-y-2">
            <label class="text-xs">实交数量（${escapeHtml(event.qtyUnit)}）</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              type="number"
              value="${escapeHtml(detailState.qtyActual)}"
              data-pda-handoverd-field="qtyActual"
            />
            ${
              qtyDiff !== 0
                ? `<p class="text-xs text-amber-600">差异：${qtyDiff > 0 ? '+' : ''}${qtyDiff} ${escapeHtml(
                    event.qtyUnit,
                  )}</p>`
                : ''
            }
          </div>
        `,
          )
        : ''
    }

    ${
      isPending
        ? `
          <div class="flex gap-3">
            <button
              class="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              data-pda-handoverd-action="confirm"
              data-event-id="${escapeHtml(event.eventId)}"
            >
              <i data-lucide="check" class="mr-2 h-4 w-4"></i>确认交出
            </button>
            <button
              class="inline-flex h-9 flex-1 items-center justify-center rounded-md border px-3 text-sm hover:bg-muted"
              data-pda-handoverd-action="open-dispute"
            >
              <i data-lucide="alert-triangle" class="mr-2 h-4 w-4"></i>提出差异
            </button>
          </div>
        `
        : ''
    }
  `
}

function renderDisputeDialog(event: HandoverEvent): string {
  if (!detailState.showDisputeDialog) return ''

  const title = event.action === 'RECEIVE' ? '提出交接争议' : event.action === 'PICKUP' ? '提出差异' : '提出差异/异常'
  const qtyLabel = event.action === 'PICKUP' ? '实领数量 *' : event.action === 'RECEIVE' ? '实收数量 *' : '实交数量 *'
  const noteLabel = event.action === 'RECEIVE' ? '争议说明 *' : '差异说明 *'
  const notePlaceholder =
    event.action === 'RECEIVE' ? '请详细描述数量差异或质量问题' : '请详细描述差异情况'

  return `
    <div class="fixed inset-0 z-[120] bg-black/35" data-pda-handoverd-action="close-dispute"></div>
    <div class="fixed inset-0 z-[121] flex items-center justify-center p-4">
      <article class="w-full max-w-sm rounded-lg border bg-background shadow-lg">
        <header class="border-b px-4 py-3">
          <h3 class="text-base font-semibold">${escapeHtml(title)}</h3>
        </header>

        <div class="space-y-3 px-4 py-3">
          <div class="space-y-1.5">
            <label class="text-xs">${escapeHtml(qtyLabel)}</label>
            <input
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              type="number"
              value="${escapeHtml(detailState.qtyActual)}"
              data-pda-handoverd-field="qtyActual"
            />
          </div>
          <div class="space-y-1.5">
            <label class="text-xs">差异原因 *</label>
            <select
              class="h-9 w-full rounded-md border bg-background px-3 text-sm"
              data-pda-handoverd-field="diffReason"
            >
              <option value="">请选择</option>
              ${DIFF_REASONS.map(
                (item) =>
                  `<option value="${escapeHtml(item)}" ${
                    detailState.diffReason === item ? 'selected' : ''
                  }>${escapeHtml(item)}</option>`,
              ).join('')}
            </select>
          </div>
          <div class="space-y-1.5">
            <label class="text-xs">${escapeHtml(noteLabel)}</label>
            <textarea
              class="min-h-[72px] w-full rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="${escapeHtml(notePlaceholder)}"
              data-pda-handoverd-field="diffNote"
            >${escapeHtml(detailState.diffNote)}</textarea>
          </div>
          ${renderEvidencePlaceholder()}
        </div>

        <footer class="flex items-center justify-end gap-2 border-t px-4 py-3">
          <button class="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-muted" data-pda-handoverd-action="close-dispute">取消</button>
          <button
            class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            data-pda-handoverd-action="submit-dispute"
            data-event-id="${escapeHtml(event.eventId)}"
          >提交争议</button>
        </footer>
      </article>
    </div>
  `
}

export function renderPdaHandoverDetailPage(eventId: string): string {
  const event = findPdaHandoverEvent(eventId)

  if (!event) {
    const content = `
      <div class="space-y-4 p-4">
        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted" data-pda-handoverd-action="back">
          <i data-lucide="arrow-left" class="mr-2 h-4 w-4"></i>返回
        </button>
        <article class="rounded-lg border bg-card py-8 text-center text-sm text-muted-foreground">未找到交接事件</article>
      </div>
    `
    return renderPdaFrame(content, 'handover')
  }

  syncState(eventId, event)

  const content = `
    <div class="space-y-3 bg-background p-4 pb-6">
      <div class="flex items-center justify-between">
        <button
          class="inline-flex h-8 items-center rounded-md px-2 text-sm hover:bg-muted"
          data-pda-handoverd-action="back"
        >
          <i data-lucide="arrow-left" class="mr-2 h-4 w-4"></i>返回
        </button>
        <div class="flex items-center gap-2">
          <span class="text-sm font-semibold">${escapeHtml(getActionTitle(event.action))}</span>
        </div>
        <div class="w-16"></div>
      </div>

      <div class="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
        <span class="inline-flex items-center gap-1">
          <i data-lucide="${event.fromPartyKind === 'WAREHOUSE' ? 'warehouse' : 'factory'}" class="h-3.5 w-3.5 text-muted-foreground"></i>
          <span class="text-muted-foreground">${escapeHtml(event.fromPartyName)}</span>
        </span>
        <i data-lucide="arrow-right" class="h-4 w-4 shrink-0 text-muted-foreground"></i>
        <span class="inline-flex items-center gap-1">
          <i data-lucide="${event.toPartyKind === 'WAREHOUSE' ? 'warehouse' : 'factory'}" class="h-3.5 w-3.5 text-primary"></i>
          <span class="font-medium text-primary">${escapeHtml(event.toPartyName)}</span>
        </span>
        <div class="ml-auto flex items-center gap-1">
          <i data-lucide="package" class="h-3.5 w-3.5 text-muted-foreground"></i>
          <span class="text-muted-foreground">${event.qtyExpected} ${escapeHtml(event.qtyUnit)}</span>
        </div>
      </div>

      ${
        event.action === 'PICKUP'
          ? renderPickupDetail(event)
          : event.action === 'RECEIVE'
            ? renderReceiveDetail(event)
            : renderHandoutDetail(event)
      }

      ${renderDisputeDialog(event)}
    </div>
  `

  return renderPdaFrame(content, 'handover')
}

export function handlePdaHandoverDetailEvent(target: HTMLElement): boolean {
  const fieldNode = target.closest<HTMLElement>('[data-pda-handoverd-field]')
  if (
    fieldNode instanceof HTMLInputElement ||
    fieldNode instanceof HTMLTextAreaElement ||
    fieldNode instanceof HTMLSelectElement
  ) {
    const field = fieldNode.dataset.pdaHandoverdField
    if (!field) return true

    if (field === 'qtyActual') {
      detailState.qtyActual = fieldNode.value
      return true
    }
    if (field === 'diffReason') {
      detailState.diffReason = fieldNode.value
      return true
    }
    if (field === 'diffNote') {
      detailState.diffNote = fieldNode.value
      return true
    }
    if (field === 'qcDefectQty') {
      detailState.qcDefectQty = fieldNode.value
      return true
    }
    if (field === 'qcIssueType') {
      detailState.qcIssueType = fieldNode.value
      return true
    }
    if (field === 'qcNote') {
      detailState.qcNote = fieldNode.value
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-handoverd-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaHandoverdAction
  if (!action) return false

  if (action === 'back') {
    detailState.showDisputeDialog = false
    appStore.navigate('/fcs/pda/handover')
    return true
  }

  if (action === 'open-dispute') {
    detailState.showDisputeDialog = true
    return true
  }

  if (action === 'close-dispute') {
    detailState.showDisputeDialog = false
    return true
  }

  if (action === 'set-qc-result') {
    const value = actionNode.dataset.value
    detailState.qcResult = value === 'PASS' || value === 'FAIL' ? value : ''
    if (detailState.qcResult !== 'FAIL') {
      detailState.qcDefectQty = ''
      detailState.qcIssueType = ''
      detailState.qcNote = ''
    }
    return true
  }

  if (action === 'confirm') {
    const eventId = actionNode.dataset.eventId
    if (!eventId) return true
    const event = findPdaHandoverEvent(eventId)
    if (!event) return true

    const result = handleConfirm(event)
    if (!result.ok) {
      showPdaHandoverDetailToast(result.message || '提交失败')
      return true
    }

    showPdaHandoverDetailToast(
      event.action === 'PICKUP' ? '领料已确认' : event.action === 'RECEIVE' ? '接收已确认，质检记录已提交' : '交出已确认',
    )

    detailState.showDisputeDialog = false
    window.setTimeout(() => {
      appStore.navigate('/fcs/pda/handover')
    }, 800)
    return true
  }

  if (action === 'submit-dispute') {
    const eventId = actionNode.dataset.eventId
    if (!eventId) return true
    const event = findPdaHandoverEvent(eventId)
    if (!event) return true

    const result = handleDispute(event)
    if (!result.ok) {
      showPdaHandoverDetailToast(result.message || '提交失败')
      return true
    }

    detailState.showDisputeDialog = false
    showPdaHandoverDetailToast(
      event.action === 'RECEIVE' ? '争议已提出，等待双方核实' : '差异已提出，等待核实',
    )
    window.setTimeout(() => {
      appStore.navigate('/fcs/pda/handover')
    }, 800)
    return true
  }

  return false
}
