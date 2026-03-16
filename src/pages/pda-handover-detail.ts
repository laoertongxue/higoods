import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { processTasks, type ProcessTask } from '../data/fcs/process-tasks'
import {
  createPdaHandoverRecord,
  findPdaHandoutHead,
  findPdaHandoverEvent,
  getPdaHandoverRecordsByHead,
  getReceiveSceneLabel,
  reportPdaHandoverQtyObjection,
  shouldRequireReceiptProof,
  updatePdaHandoverEvent,
  type PdaHandoverHead,
  type PdaHandoverRecord,
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
  handoverRecordTime: string
  handoverRecordRemark: string
  objectionRecordId: string
  objectionReason: string
  objectionRemark: string
  objectionProofFiles: ProofFile[]
}

const detailState: PdaHandoverDetailState = {
  initializedKey: '',
  qtyActual: '',
  diffNote: '',
  proofEventId: '',
  proofFiles: [],
  handoverRecordTime: '',
  handoverRecordRemark: '',
  objectionRecordId: '',
  objectionReason: '',
  objectionRemark: '',
  objectionProofFiles: [],
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

function nowDateTimeLocalInput(date: Date = new Date()): string {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return localDate.toISOString().slice(0, 16)
}

function dateTimeLocalInputToTimestamp(value: string): string {
  if (!value) return ''
  return `${value.replace('T', ' ')}:00`
}

function isFutureLocalDateTime(value: string): boolean {
  if (!value) return false
  const parsed = new Date(value).getTime()
  return Number.isFinite(parsed) && parsed > Date.now()
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

function addObjectionProofFile(type: 'IMAGE' | 'VIDEO'): void {
  const ext = type === 'IMAGE' ? 'jpg' : 'mp4'
  const index = detailState.objectionProofFiles.length + 1
  detailState.objectionProofFiles = [
    ...detailState.objectionProofFiles,
    {
      id: `opf-${Date.now()}`,
      type,
      name: `异议凭证_${String(index).padStart(2, '0')}.${ext}`,
      uploadedAt: nowDisplayTimestamp(),
    },
  ]
}

function removeObjectionProofFile(id: string): void {
  detailState.objectionProofFiles = detailState.objectionProofFiles.filter((file) => file.id !== id)
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

function syncHandoutState(handoverId: string): void {
  const pathname = appStore.getState().pathname
  const key = `head:${handoverId}|${pathname}`
  if (detailState.initializedKey === key) return

  detailState.initializedKey = key
  detailState.handoverRecordTime = nowDateTimeLocalInput()
  detailState.handoverRecordRemark = ''
  detailState.proofEventId = handoverId
  detailState.proofFiles = []
  detailState.objectionRecordId = ''
  detailState.objectionReason = ''
  detailState.objectionRemark = ''
  detailState.objectionProofFiles = []
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

function getRecordStatusMeta(status: PdaHandoverRecord['status']): { label: string; className: string } {
  if (status === 'PENDING_WRITEBACK') {
    return { label: '待仓库回写', className: 'border-amber-200 bg-amber-50 text-amber-700' }
  }
  if (status === 'WRITTEN_BACK') {
    return { label: '已回写', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
  }
  if (status === 'OBJECTION_REPORTED') {
    return { label: '已发起异议', className: 'border-red-200 bg-red-50 text-red-700' }
  }
  if (status === 'OBJECTION_PROCESSING') {
    return { label: '异议处理中', className: 'border-blue-200 bg-blue-50 text-blue-700' }
  }
  return { label: '异议已处理', className: 'border-zinc-200 bg-zinc-100 text-zinc-700' }
}

function renderLegacyHandoutDetail(event: HandoverEvent): string {
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
    `,
    )}
    ${renderSectionCard('交出凭证', renderProofViewSection(getProofRecords(event)))}
  `
}

function renderObjectionProofSection(): string {
  return `
    <div class="space-y-2">
      <div class="flex gap-2">
        <button
          type="button"
          class="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-dashed text-xs hover:bg-muted"
          data-pda-handoverd-action="add-objection-proof-image"
        >
          <i data-lucide="image" class="h-3.5 w-3.5 text-blue-500"></i>上传图片
        </button>
        <button
          type="button"
          class="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-dashed text-xs hover:bg-muted"
          data-pda-handoverd-action="add-objection-proof-video"
        >
          <i data-lucide="video" class="h-3.5 w-3.5 text-purple-500"></i>上传视频
        </button>
      </div>
      ${
        detailState.objectionProofFiles.length === 0
          ? '<div class="text-xs text-muted-foreground">暂无异议凭证（选填）</div>'
          : detailState.objectionProofFiles
              .map(
                (file) => `
                  <div class="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5">
                    <i data-lucide="${file.type === 'IMAGE' ? 'image' : 'video'}" class="h-3.5 w-3.5 ${
                      file.type === 'IMAGE' ? 'text-blue-500' : 'text-purple-500'
                    }"></i>
                    <span class="min-w-0 flex-1 truncate text-xs">${escapeHtml(file.name)}</span>
                    <button
                      type="button"
                      class="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
                      data-pda-handoverd-action="remove-objection-proof"
                      data-proof-id="${escapeHtml(file.id)}"
                    >
                      <i data-lucide="trash-2" class="h-3 w-3"></i>
                    </button>
                  </div>
                `,
              )
              .join('')
      }
    </div>
  `
}

function renderHandoutRecordItem(record: PdaHandoverRecord): string {
  const meta = getRecordStatusMeta(record.status)
  const showObjectionForm = detailState.objectionRecordId === record.recordId && record.status === 'WRITTEN_BACK'

  return `
    <article class="space-y-2 rounded-lg border bg-card p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs text-muted-foreground">${escapeHtml(record.recordId)}</span>
          <span class="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">第 ${record.sequenceNo} 次交出</span>
          <span class="inline-flex items-center rounded border px-1.5 py-0 text-[10px] ${meta.className}">${escapeHtml(meta.label)}</span>
        </div>
        <span class="text-[11px] text-muted-foreground">发起时间：${escapeHtml(record.factorySubmittedAt)}</span>
      </div>

      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div><span class="text-muted-foreground">工厂说明：</span>${escapeHtml(record.factoryRemark || '—')}</div>
        <div><span class="text-muted-foreground">交出凭证：</span>${record.factoryProofFiles.length} 个</div>
        <div><span class="text-muted-foreground">回货单号：</span>${escapeHtml(record.warehouseReturnNo || '待仓库回写')}</div>
        <div><span class="text-muted-foreground">回写数量：</span>${
          typeof record.warehouseWrittenQty === 'number' ? `${record.warehouseWrittenQty}` : '待仓库回写'
        }</div>
        <div><span class="text-muted-foreground">回写时间：</span>${escapeHtml(record.warehouseWrittenAt || '待仓库回写')}</div>
        <div><span class="text-muted-foreground">异议状态：</span>${escapeHtml(
          record.objectionStatus === 'REPORTED'
            ? '已发起异议'
            : record.objectionStatus === 'PROCESSING'
              ? '异议处理中'
              : record.objectionStatus === 'RESOLVED'
                ? '异议已处理'
                : '无',
        )}</div>
      </div>

      ${
        record.objectionReason
          ? `
            <div class="rounded-md border border-red-200 bg-red-50 px-2.5 py-2 text-xs text-red-700">
              <div>异议原因：${escapeHtml(record.objectionReason)}</div>
              ${record.objectionRemark ? `<div class="mt-1">异议说明：${escapeHtml(record.objectionRemark)}</div>` : ''}
              ${record.followUpRemark ? `<div class="mt-1">平台跟进：${escapeHtml(record.followUpRemark)}</div>` : ''}
              ${record.resolvedRemark ? `<div class="mt-1">处理结果：${escapeHtml(record.resolvedRemark)}</div>` : ''}
            </div>
          `
          : ''
      }

      ${
        record.status === 'PENDING_WRITEBACK'
          ? '<div class="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-700">待仓库回写数量，当前记录暂不可发起异议</div>'
          : ''
      }

      ${
        record.status === 'WRITTEN_BACK'
          ? `
            <div class="flex items-center justify-end gap-2">
              <button
                class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
                data-pda-handoverd-action="open-record-objection"
                data-record-id="${escapeHtml(record.recordId)}"
              >发起数量异议</button>
            </div>
          `
          : ''
      }

      ${
        showObjectionForm
          ? `
            <div class="space-y-2 rounded-md border bg-muted/20 p-3">
              <div class="space-y-1">
                <label class="text-xs font-medium">异议原因 *</label>
                <input
                  class="h-8 w-full rounded-md border bg-background px-2.5 text-xs"
                  placeholder="例如：回写数量与工厂交接单不一致"
                  value="${escapeHtml(detailState.objectionReason)}"
                  data-pda-handoverd-field="objectionReason"
                />
              </div>
              <div class="space-y-1">
                <label class="text-xs">异议说明</label>
                <textarea
                  class="min-h-[64px] w-full rounded-md border bg-background px-2.5 py-1.5 text-xs"
                  placeholder="可补充差异明细或现场说明"
                  data-pda-handoverd-field="objectionRemark"
                >${escapeHtml(detailState.objectionRemark)}</textarea>
              </div>
              ${renderObjectionProofSection()}
              <div class="flex justify-end gap-2">
                <button
                  class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
                  data-pda-handoverd-action="cancel-record-objection"
                >取消</button>
                <button
                  class="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                  data-pda-handoverd-action="submit-record-objection"
                  data-record-id="${escapeHtml(record.recordId)}"
                >确认提交异议</button>
              </div>
            </div>
          `
          : ''
      }
    </article>
  `
}

function renderHandoutHeadDetail(head: PdaHandoverHead): string {
  const records = getPdaHandoverRecordsByHead(head.handoverId)

  return `
    ${renderSectionCard(
      '交出信息（交出头）',
      `
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('任务编号', head.taskNo)}
        ${renderFieldRow('生产单号', head.productionOrderNo)}
        ${renderFieldRow('当前工序', head.processName)}
        ${renderFieldRow('任务状态', head.taskStatus === 'DONE' ? '已完工' : '进行中')}
      </div>
      <div class="h-px bg-border"></div>
      ${renderPartyRow('交出工厂', 'FACTORY', head.sourceFactoryName)}
      ${renderPartyRow(head.targetKind === 'WAREHOUSE' ? '去向仓库' : '去向工厂', head.targetKind, head.targetName)}
      <div class="h-px bg-border"></div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('累计交出次数', `${head.recordCount} 次`)}
        ${renderFieldRow('待仓库回写', `${head.pendingWritebackCount} 次`)}
        ${renderFieldRow('累计已回写数量', `${head.writtenBackQtyTotal} ${head.qtyUnit}`)}
        ${renderFieldRow('数量异议', `${head.objectionCount} 条`)}
      </div>
    `,
    )}

    ${renderSectionCard(
      '新增交出记录',
      `
      <div class="space-y-2">
        <label class="text-xs font-medium">本次交出时间 *</label>
        <input
          class="h-9 w-full rounded-md border bg-background px-3 text-sm"
          type="datetime-local"
          value="${escapeHtml(detailState.handoverRecordTime)}"
          data-pda-handoverd-field="handoverRecordTime"
        />
      </div>
      <div class="space-y-1.5">
        <label class="text-xs">本次交出说明</label>
        <textarea
          class="min-h-[64px] w-full rounded-md border bg-background px-3 py-2 text-sm"
          placeholder="例如：第 2 次送货，先送主批次"
          data-pda-handoverd-field="handoverRecordRemark"
        >${escapeHtml(detailState.handoverRecordRemark)}</textarea>
      </div>
      ${renderProofUploadSection('交出凭证', '可上传打包照片、装车照片或视频，本次交出凭证当前为选填')}
      <div class="flex justify-end">
        <button
          class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-pda-handoverd-action="submit-handover-record"
          data-handover-id="${escapeHtml(head.handoverId)}"
        >
          <i data-lucide="plus" class="mr-1.5 h-4 w-4"></i>确认新增交出记录
        </button>
      </div>
      <p class="text-xs text-muted-foreground">工厂仅发起交出记录，最终交出数量以后续仓库回写为准。</p>
    `,
    )}

    ${renderSectionCard(
      '交出记录列表',
      records.length === 0
        ? '<div class="py-4 text-center text-xs text-muted-foreground">暂无交出记录，点击上方按钮新增第一条交出记录</div>'
        : `<div class="space-y-2">${records.map((record) => renderHandoutRecordItem(record)).join('')}</div>`,
    )}
  `
}

export function renderPdaHandoverDetailPage(eventId: string): string {
  const event = findPdaHandoverEvent(eventId)
  const handoutHead = event ? undefined : findPdaHandoutHead(eventId)

  if (!event && !handoutHead) {
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

  if (event) {
    syncState(eventId, event)
  } else if (handoutHead) {
    syncHandoutState(handoutHead.handoverId)
  }

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
          <span class="text-sm font-semibold">${escapeHtml(event ? getActionTitle(event.action) : '交出详情')}</span>
        </div>
        <div class="w-16"></div>
      </div>

      <div class="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
        ${
          event
            ? `
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
            `
            : `
              <span class="inline-flex items-center gap-1">
                <i data-lucide="factory" class="h-3.5 w-3.5 text-muted-foreground"></i>
                <span class="text-muted-foreground">${escapeHtml(handoutHead?.sourceFactoryName ?? '')}</span>
              </span>
              <i data-lucide="arrow-right" class="h-4 w-4 shrink-0 text-muted-foreground"></i>
              <span class="inline-flex items-center gap-1">
                <i data-lucide="${handoutHead?.targetKind === 'WAREHOUSE' ? 'warehouse' : 'factory'}" class="h-3.5 w-3.5 text-primary"></i>
                <span class="font-medium text-primary">${escapeHtml(handoutHead?.targetName ?? '')}</span>
              </span>
              <div class="ml-auto text-xs text-muted-foreground">一个任务一个交出头</div>
            `
        }
      </div>

      ${
        event
          ? event.action === 'PICKUP'
            ? renderPickupDetail(event)
            : event.action === 'RECEIVE'
              ? renderReceiveDetail(event)
              : renderLegacyHandoutDetail(event)
          : handoutHead
            ? renderHandoutHeadDetail(handoutHead)
            : ''
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

    if (field === 'handoverRecordTime') {
      detailState.handoverRecordTime = fieldNode.value
      return true
    }

    if (field === 'handoverRecordRemark') {
      detailState.handoverRecordRemark = fieldNode.value
      return true
    }

    if (field === 'objectionReason') {
      detailState.objectionReason = fieldNode.value
      return true
    }

    if (field === 'objectionRemark') {
      detailState.objectionRemark = fieldNode.value
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

  if (action === 'add-objection-proof-image' || action === 'add-objection-proof-video') {
    const type = action === 'add-objection-proof-image' ? 'IMAGE' : 'VIDEO'
    addObjectionProofFile(type)
    showPdaHandoverDetailToast(type === 'IMAGE' ? '异议图片已添加' : '异议视频已添加')
    return true
  }

  if (action === 'remove-objection-proof') {
    const proofId = actionNode.dataset.proofId
    if (proofId) {
      removeObjectionProofFile(proofId)
    }
    return true
  }

  if (action === 'open-record-objection') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    detailState.objectionRecordId = recordId
    detailState.objectionReason = ''
    detailState.objectionRemark = ''
    detailState.objectionProofFiles = []
    return true
  }

  if (action === 'cancel-record-objection') {
    detailState.objectionRecordId = ''
    detailState.objectionReason = ''
    detailState.objectionRemark = ''
    detailState.objectionProofFiles = []
    return true
  }

  if (action === 'submit-handover-record') {
    const handoverId = actionNode.dataset.handoverId
    if (!handoverId) return true

    if (!detailState.handoverRecordTime) {
      showPdaHandoverDetailToast('请先填写本次交出时间')
      return true
    }

    if (isFutureLocalDateTime(detailState.handoverRecordTime)) {
      showPdaHandoverDetailToast('本次交出时间不能晚于当前时间')
      return true
    }

    const created = createPdaHandoverRecord(handoverId, {
      factorySubmittedAt: dateTimeLocalInputToTimestamp(detailState.handoverRecordTime),
      factoryRemark: detailState.handoverRecordRemark,
      factoryProofFiles: cloneProofFiles(detailState.proofFiles),
    })

    if (!created) {
      showPdaHandoverDetailToast('新增交出记录失败，请稍后重试')
      return true
    }

    const task = processTasks.find((item) => item.taskId === created.taskId) as (ProcessTask & {
      handoutStatus?: 'PENDING' | 'HANDED_OUT'
    }) | undefined
    if (task) {
      task.handoutStatus = 'HANDED_OUT'
    }

    appendTaskAudit(
      created.taskId,
      'HANDOUT_RECORD_CREATE',
      `新增交出记录 ${created.recordId}，第 ${created.sequenceNo} 次交出，待仓库回写`,
      'PDA',
    )

    detailState.handoverRecordTime = nowDateTimeLocalInput()
    detailState.handoverRecordRemark = ''
    detailState.proofFiles = []
    showPdaHandoverDetailToast(`交出记录已新增：${created.recordId}`)
    return true
  }

  if (action === 'submit-record-objection') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true

    if (!detailState.objectionReason.trim()) {
      showPdaHandoverDetailToast('请先填写异议原因')
      return true
    }

    const updated = reportPdaHandoverQtyObjection(recordId, {
      objectionReason: detailState.objectionReason,
      objectionRemark: detailState.objectionRemark,
      objectionProofFiles: cloneProofFiles(detailState.objectionProofFiles),
    })

    if (!updated) {
      showPdaHandoverDetailToast('当前记录暂不可发起异议')
      return true
    }

    appendTaskAudit(
      updated.taskId,
      'HANDOUT_QTY_OBJECTION',
      `对交出记录 ${updated.recordId} 发起数量异议：${updated.objectionReason}`,
      'PDA',
    )

    detailState.objectionRecordId = ''
    detailState.objectionReason = ''
    detailState.objectionRemark = ''
    detailState.objectionProofFiles = []
    showPdaHandoverDetailToast('数量异议已提交，等待平台处理')
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
