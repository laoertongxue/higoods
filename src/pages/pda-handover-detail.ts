import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { processTasks, type ProcessTask } from '../data/fcs/process-tasks'
import {
  findPdaHandoverEvent,
  getReceiveSceneLabel,
  shouldRequireReceiptProof,
  updatePdaHandoverEvent,
  type HandoverAction,
  type HandoverEvent,
} from '../data/fcs/pda-handover-events'
import { renderPdaFrame } from './pda-shell'

interface ProofFile {
  id: string
  type: 'IMAGE' | 'VIDEO'
  name: string
  uploadedAt: string
}

interface PdaHandoverDetailState {
  initializedKey: string
  qtyActual: string
  diffNote: string
  proofEventId: string
  proofFiles: ProofFile[]
}

const detailState: PdaHandoverDetailState = {
  initializedKey: '',
  qtyActual: '',
  diffNote: '',
  proofEventId: '',
  proofFiles: [],
}

const MOCK_PROOF_RECORDS: Record<string, ProofFile[]> = {
  'EV-PK-DONE-001': [
    { id: 'pkd1-1', type: 'IMAGE', name: '领料现场_01.jpg', uploadedAt: '2026-03-09 09:01:22' },
    { id: 'pkd1-2', type: 'IMAGE', name: '物料清点_01.jpg', uploadedAt: '2026-03-09 09:03:10' },
  ],
  'EV-PK-DONE-002': [],
  'EV-RC-DONE-001': [
    { id: 'rcd1-1', type: 'IMAGE', name: '到货照片_01.jpg', uploadedAt: '2026-03-08 13:01:09' },
    { id: 'rcd1-2', type: 'IMAGE', name: '开箱清点_01.jpg', uploadedAt: '2026-03-08 13:03:14' },
    { id: 'rcd1-3', type: 'VIDEO', name: '交接确认.mp4', uploadedAt: '2026-03-08 13:06:36' },
  ],
  'EV-RC-DONE-002': [
    { id: 'rcd2-1', type: 'IMAGE', name: '到货照片_01.jpg', uploadedAt: '2026-03-07 15:02:11' },
    { id: 'rcd2-2', type: 'IMAGE', name: '差异部位_01.jpg', uploadedAt: '2026-03-07 15:03:44' },
  ],
  'EV-HO-DONE-001': [
    { id: 'hod1-1', type: 'IMAGE', name: '交出打包_01.jpg', uploadedAt: '2026-03-09 16:28:13' },
    { id: 'hod1-2', type: 'IMAGE', name: '装车照片_01.jpg', uploadedAt: '2026-03-09 16:31:04' },
  ],
  'EV-RC-DISP-001': [
    { id: 'rcs1-1', type: 'IMAGE', name: '异常照片_01.jpg', uploadedAt: '2026-03-10 09:11:04' },
    { id: 'rcs1-2', type: 'IMAGE', name: '异常照片_02.jpg', uploadedAt: '2026-03-10 09:11:42' },
    { id: 'rcs1-3', type: 'VIDEO', name: '接收复核视频.mp4', uploadedAt: '2026-03-10 09:13:18' },
  ],
  'EV-RC-DISP-002': [
    { id: 'rcs2-1', type: 'IMAGE', name: '回仓签收_01.jpg', uploadedAt: '2026-03-11 09:49:31' },
    { id: 'rcs2-2', type: 'VIDEO', name: '接收现场.mp4', uploadedAt: '2026-03-11 09:50:03' },
  ],
}

const runtimeProofRecords: Record<string, ProofFile[]> = {}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
}

function parseNumberOr(value: string, fallback: number): number {
  const parsed = Number(value)
  if (Number.isNaN(parsed)) return fallback
  return parsed
}

function nowDisplayTimestamp(date: Date = new Date()): string {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`
}

function cloneProofFiles(files: ProofFile[]): ProofFile[] {
  return files.map((file) => ({ ...file }))
}

function getProofRecords(event: HandoverEvent): ProofFile[] {
  const runtimeFiles = runtimeProofRecords[event.eventId]
  if (runtimeFiles) return cloneProofFiles(runtimeFiles)

  const eventImageFiles =
    event.receiptProofImages?.map((name, index) => ({
      id: `${event.eventId}-img-${index + 1}`,
      type: 'IMAGE' as const,
      name,
      uploadedAt: event.receivedAt ?? event.confirmedAt ?? nowTimestamp(),
    })) ?? []
  const eventVideoFiles =
    event.receiptProofVideos?.map((name, index) => ({
      id: `${event.eventId}-video-${index + 1}`,
      type: 'VIDEO' as const,
      name,
      uploadedAt: event.receivedAt ?? event.confirmedAt ?? nowTimestamp(),
    })) ?? []

  const files =
    eventImageFiles.length + eventVideoFiles.length > 0
      ? [...eventImageFiles, ...eventVideoFiles]
      : MOCK_PROOF_RECORDS[event.eventId] ?? []

  return cloneProofFiles(files)
}

function addProofFile(type: 'IMAGE' | 'VIDEO', prefix: string): void {
  const ext = type === 'IMAGE' ? 'jpg' : 'mp4'
  const index = detailState.proofFiles.length + 1
  detailState.proofFiles = [
    ...detailState.proofFiles,
    {
      id: `pf-${Date.now()}`,
      type,
      name: `${prefix}_${String(index).padStart(2, '0')}.${ext}`,
      uploadedAt: nowDisplayTimestamp(),
    },
  ]
}

function removeProofFile(id: string): void {
  detailState.proofFiles = detailState.proofFiles.filter((file) => file.id !== id)
}

function syncState(eventId: string, event: HandoverEvent): void {
  const pathname = appStore.getState().pathname
  const key = `${eventId}|${pathname}`
  if (detailState.initializedKey === key) return

  detailState.initializedKey = key
  detailState.qtyActual = String(event.qtyActual ?? event.qtyExpected)
  detailState.diffNote = event.diffNote ?? ''

  if (detailState.proofEventId !== eventId) {
    detailState.proofEventId = eventId
    detailState.proofFiles = getProofRecords(event)
  }
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
  if (event.status === 'CONFIRMED') {
    return event.action === 'PICKUP' ? '已确认领料' : event.action === 'RECEIVE' ? '已确认接收' : '已确认交出'
  }
  return '待处理'
}

function getStatusClass(event: HandoverEvent): string {
  if (event.status === 'CONFIRMED') return 'border-primary/20 bg-primary text-primary-foreground'
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

function renderProofUploadSection(prefix: string, hint: string, required = false): string {
  return `
    <div class="space-y-3">
      <p class="text-xs leading-relaxed text-muted-foreground">${escapeHtml(hint)}</p>
      <div class="flex gap-2">
        <button
          type="button"
          class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed text-xs hover:bg-muted"
          data-pda-handoverd-action="add-proof-image"
          data-name-prefix="${escapeHtml(prefix)}"
        >
          <i data-lucide="image" class="h-3.5 w-3.5 text-blue-500"></i>
          上传图片
        </button>
        <button
          type="button"
          class="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed text-xs hover:bg-muted"
          data-pda-handoverd-action="add-proof-video"
          data-name-prefix="${escapeHtml(prefix)}"
        >
          <i data-lucide="video" class="h-3.5 w-3.5 text-purple-500"></i>
          上传视频
        </button>
      </div>
      ${
        detailState.proofFiles.length > 0
          ? `
              <div class="space-y-1.5">
                <p class="text-xs font-medium text-muted-foreground">已上传材料（${detailState.proofFiles.length} 个文件）</p>
                ${detailState.proofFiles
                  .map(
                    (file) => `
                      <div class="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
                        <i data-lucide="${file.type === 'IMAGE' ? 'image' : 'video'}" class="h-4 w-4 shrink-0 ${
                          file.type === 'IMAGE' ? 'text-blue-500' : 'text-purple-500'
                        }"></i>
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-xs font-medium">${escapeHtml(file.name)}</p>
                          <p class="text-[10px] text-muted-foreground">${file.type === 'IMAGE' ? '图片' : '视频'} · ${escapeHtml(file.uploadedAt)}</p>
                        </div>
                        <button
                          type="button"
                          class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
                          data-pda-handoverd-action="remove-proof"
                          data-proof-id="${escapeHtml(file.id)}"
                        >
                          <i data-lucide="trash-2" class="h-3 w-3"></i>
                        </button>
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            `
          : `
              <div class="flex items-center gap-1.5 py-0.5 text-xs text-muted-foreground">
                <i data-lucide="paperclip" class="h-3.5 w-3.5"></i>
                ${required ? '暂无凭证，确认前需至少上传 1 项（图片或视频）' : '暂无凭证，可直接提交'}
              </div>
            `
      }
    </div>
  `
}

function renderProofViewSection(files: ProofFile[]): string {
  if (files.length === 0) {
    return `
      <div class="flex items-center gap-1.5 py-1 text-xs text-muted-foreground">
        <i data-lucide="paperclip" class="h-3.5 w-3.5"></i>
        暂无凭证
      </div>
    `
  }

  return `
    <div class="space-y-1.5">
      <p class="text-xs font-medium text-muted-foreground">共 ${files.length} 个文件</p>
      ${files
        .map(
          (file) => `
            <div class="flex items-center gap-2 rounded-md border bg-muted/30 px-3 py-2">
              <i data-lucide="${file.type === 'IMAGE' ? 'image' : 'video'}" class="h-4 w-4 shrink-0 ${
                file.type === 'IMAGE' ? 'text-blue-500' : 'text-purple-500'
              }"></i>
              <div class="min-w-0 flex-1">
                <p class="truncate text-xs font-medium">${escapeHtml(file.name)}</p>
                <p class="text-[10px] text-muted-foreground">${file.type === 'IMAGE' ? '图片' : '视频'} · ${escapeHtml(file.uploadedAt)}</p>
              </div>
            </div>
          `,
        )
        .join('')}
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

function mutateTaskByHandover(event: HandoverEvent): void {
  const task = processTasks.find((item) => item.taskId === event.taskId) as (ProcessTask & {
    handoverStatus?: string
    handoutStatus?: string
  }) | undefined
  if (!task) return

  const now = nowTimestamp()
  task.updatedAt = now

  if (event.action === 'PICKUP') {
    task.handoverStatus = 'PICKED_UP'
  } else if (event.action === 'RECEIVE') {
    task.handoverStatus = 'RECEIVED'
  } else {
    task.handoutStatus = 'HANDED_OUT'
  }
}

function handleConfirm(event: HandoverEvent): { ok: boolean; message?: string } {
  const qtyActual = parseNumberOr(detailState.qtyActual, event.action === 'RECEIVE' ? 0 : event.qtyExpected)
  const qtyDiff = Math.abs(qtyActual - event.qtyExpected)
  const proofFiles =
    event.action === 'RECEIVE' || event.action === 'HANDOUT' ? cloneProofFiles(detailState.proofFiles) : []
  const requiresReceiptProof = shouldRequireReceiptProof(event)

  if (event.action === 'RECEIVE' && qtyActual <= 0) {
    return { ok: false, message: '请先填写实收数量，且数量需大于 0' }
  }

  if (event.action === 'RECEIVE' && requiresReceiptProof && proofFiles.length === 0) {
    return { ok: false, message: '请先上传接收凭证（图片或视频至少一项）' }
  }

  updatePdaHandoverEvent(event.eventId, (target) => {
    target.status = 'CONFIRMED'
    target.qtyActual = qtyActual
    target.qtyDiff = qtyDiff > 0 ? qtyDiff : undefined
    target.hasQuantityDiff = qtyDiff > 0
    target.confirmedAt = nowTimestamp()

    if (event.action === 'RECEIVE') {
      target.receiveStatus = '已接收'
      target.receivedAt = target.confirmedAt
      target.receivedBy = 'PDA-接收员'
      target.receiptProofImages = proofFiles.filter((file) => file.type === 'IMAGE').map((file) => file.name)
      target.receiptProofVideos = proofFiles.filter((file) => file.type === 'VIDEO').map((file) => file.name)
      target.diffReason = qtyDiff > 0 ? target.diffReason || '数量有差异待复核' : undefined
      target.diffNote = qtyDiff > 0 ? detailState.diffNote.trim() || target.diffNote : undefined
    }

    if (event.action === 'RECEIVE' || event.action === 'HANDOUT') {
      target.proofCount = proofFiles.length
    } else if (target.proofCount == null) {
      target.proofCount = 0
    }
  })

  if (event.action === 'RECEIVE' || event.action === 'HANDOUT') {
    runtimeProofRecords[event.eventId] = proofFiles
  }

  mutateTaskByHandover(event)
  appendTaskAudit(
    event.taskId,
    `HANDOVER_${event.action}_CONFIRM`,
    `交接确认：${event.eventId}，数量 ${qtyActual}/${event.qtyExpected}`,
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
          ? `<div class="text-xs"><span class="text-muted-foreground">差异说明：</span>${escapeHtml(event.diffReason)}${
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
          </div>
        `
        : ''
    }
  `
}

function renderReceiveDetail(event: HandoverEvent): string {
  const isPending = event.status === 'PENDING'
  const qtyDiff = parseNumberOr(detailState.qtyActual, event.qtyExpected) - event.qtyExpected
  const requiresReceiptProof = shouldRequireReceiptProof(event)
  const receiveSceneLabel = getReceiveSceneLabel(event)

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
      ${renderPartyRow(event.toPartyKind === 'WAREHOUSE' ? '接收仓库' : '接收工厂', event.toPartyKind, event.toPartyName)}
      <div class="flex flex-wrap items-center gap-1.5 text-xs">
        <span class="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0">${escapeHtml(
          receiveSceneLabel,
        )}</span>
        <span class="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0 text-blue-700">仅确认数量</span>
        ${
          requiresReceiptProof
            ? '<span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0">需上传接收凭证</span>'
            : ''
        }
      </div>
      <div class="h-px bg-border"></div>
      <div class="grid grid-cols-3 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('应收数量', `${event.qtyExpected} ${event.qtyUnit}`)}
        ${
          event.qtyActual != null
            ? renderFieldRow('实收数量', `${event.qtyActual} ${event.qtyUnit}`)
            : isPending
              ? ''
              : renderFieldRow('实收数量', `${event.qtyExpected} ${event.qtyUnit}`)
        }
        ${
          !isPending && event.qtyActual != null
            ? renderFieldRow(
                '差异数量',
                `${event.qtyActual - event.qtyExpected > 0 ? '+' : ''}${event.qtyActual - event.qtyExpected} ${
                  event.qtyUnit
                }`,
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
      isPending
        ? renderSectionCard(
            '接收确认',
            `
              <div class="space-y-2">
                <label class="text-xs font-medium">实收数量（${escapeHtml(event.qtyUnit)}）*</label>
                <input
                  class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  type="number"
                  value="${escapeHtml(detailState.qtyActual)}"
                  data-pda-handoverd-field="qtyActual"
                />
                ${
                  qtyDiff !== 0
                    ? `<p class="text-xs text-amber-600">与应收数量差异：${qtyDiff > 0 ? '+' : ''}${qtyDiff} ${escapeHtml(
                        event.qtyUnit,
                      )}</p>`
                    : ''
                }
              </div>
              <div class="space-y-1.5">
                <label class="text-xs">备注（选填）</label>
                <textarea
                  class="min-h-[64px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                  placeholder="可填写接收说明或数量差异备注"
                  data-pda-handoverd-field="diffNote"
                >${escapeHtml(detailState.diffNote)}</textarea>
              </div>
            `,
          )
        : renderSectionCard(
            '接收确认',
            `
              <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                ${renderFieldRow('实收数量', `${event.qtyActual ?? event.qtyExpected} ${event.qtyUnit}`)}
                ${
                  event.qtyActual != null
                    ? renderFieldRow(
                        '差异数量',
                        `${event.qtyActual - event.qtyExpected > 0 ? '+' : ''}${event.qtyActual - event.qtyExpected} ${event.qtyUnit}`,
                      )
                    : ''
                }
              </div>
              ${
                event.diffNote
                  ? `<div class="text-xs text-muted-foreground">备注：${escapeHtml(event.diffNote)}</div>`
                  : ''
              }
            `,
          )
    }

    ${
      !isPending
        ? renderSectionCard('接收凭证', renderProofViewSection(getProofRecords(event)))
        : renderSectionCard(
            `接收凭证（${requiresReceiptProof ? '必填' : '选填'}）`,
            `
              ${
                requiresReceiptProof && detailState.proofFiles.length === 0
                  ? `
                    <div class="mb-1 flex items-start gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs text-blue-700">
                      <i data-lucide="paperclip" class="mt-0.5 h-3.5 w-3.5 shrink-0"></i>
                      <span>确认接收前需上传至少 1 项接收凭证（图片或视频任选其一）</span>
                    </div>
                  `
                  : ''
              }
              ${renderProofUploadSection(
                '接收凭证',
                '请上传到货照片或现场视频，图片/视频至少保留一项后再确认接收',
                requiresReceiptProof,
              )}
            `,
          )
    }

    ${
      isPending
        ? `
          <div class="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            请确认实收数量并上传接收凭证后提交。如与应收不一致，系统会记录数量差异。
          </div>
          <div class="flex gap-3">
            <button
              class="inline-flex h-9 flex-1 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              data-pda-handoverd-action="confirm"
              data-event-id="${escapeHtml(event.eventId)}"
            >
              <i data-lucide="check" class="mr-2 h-4 w-4"></i>确认接收
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
          ? `<div class="text-xs"><span class="text-muted-foreground">差异说明：</span>${escapeHtml(event.diffReason)}</div>`
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
      !isPending
        ? renderSectionCard('交出凭证', renderProofViewSection(getProofRecords(event)))
        : ''
    }

    ${
      isPending
        ? renderSectionCard(
            '交出凭证（选填）',
            renderProofUploadSection('交出凭证', '可上传打包照片、交接现场照片、装车照片或视频等证明材料，当前为选填'),
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
          </div>
        `
        : ''
    }
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

    if (field === 'diffNote') {
      detailState.diffNote = fieldNode.value
      return true
    }
  }

  const actionNode = target.closest<HTMLElement>('[data-pda-handoverd-action]')
  if (!actionNode) return false

  const action = actionNode.dataset.pdaHandoverdAction
  if (!action) return false

  if (action === 'back') {
    appStore.navigate('/fcs/pda/handover')
    return true
  }

  if (action === 'add-proof-image' || action === 'add-proof-video') {
    const prefix = actionNode.dataset.namePrefix || '交接凭证'
    const type = action === 'add-proof-image' ? 'IMAGE' : 'VIDEO'
    addProofFile(type, prefix)
    showPdaHandoverDetailToast(type === 'IMAGE' ? '图片已添加' : '视频已添加')
    return true
  }

  if (action === 'remove-proof') {
    const proofId = actionNode.dataset.proofId
    if (proofId) {
      removeProofFile(proofId)
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

    if (event.action === 'RECEIVE') {
      const qtyActual = parseNumberOr(detailState.qtyActual, event.qtyExpected)
      const hasDiff = qtyActual !== event.qtyExpected
      showPdaHandoverDetailToast(
        hasDiff
          ? `接收已确认，数量差异 ${Math.abs(qtyActual - event.qtyExpected)} ${event.qtyUnit} 已记录`
          : `接收已确认，已上传 ${detailState.proofFiles.length} 个接收凭证`,
      )
    } else if (event.action === 'HANDOUT') {
      showPdaHandoverDetailToast(
        detailState.proofFiles.length > 0
          ? `交出已确认，已上传 ${detailState.proofFiles.length} 个交出凭证`
          : '交出已确认',
      )
    } else {
      showPdaHandoverDetailToast('领料已确认')
    }

    window.setTimeout(() => {
      appStore.navigate('/fcs/pda/handover')
    }, 800)
    return true
  }

  return false
}
