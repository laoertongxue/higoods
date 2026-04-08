import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { renderRealQrPlaceholder } from '../components/real-qr'
import type { ProcessTask } from '../data/fcs/process-tasks'
import {
  confirmPdaPickupRecordReceived,
  deriveHandoutObjectProfile,
  deriveHandoutRecordProfile,
  findPdaHandoverHead,
  getPdaHeadRuntimeTask,
  getPdaHeadSourceExecutionDoc,
  findPdaPickupRecord,
  getPdaPickupRecordsByHead,
  getPdaHandoverRecordsByHead,
  reportPdaHandoverQtyObjection,
  type HandoverProofFile,
  type PdaPickupRecord,
  type PdaHandoverHead,
  type PdaHandoverRecord,
  type HandoverPartyKind,
} from '../data/fcs/pda-handover-events'
import { createPdaPickupDisputeCase } from '../helpers/fcs-pda-pickup-dispute'
import { getTaskChainTaskById } from '../data/fcs/page-adapters/task-chain-pages-adapter'
import { getPdaTaskFlowTaskById, isCuttingSpecialTask } from '../data/fcs/pda-cutting-execution-source.ts'
import { renderPdaCuttingTaskDetailPage } from './pda-cutting-task-detail'
import { renderPdaFrame } from './pda-shell'

interface ProofFile {
  id: string
  type: 'IMAGE' | 'VIDEO'
  name: string
  uploadedAt: string
}

interface PdaHandoverDetailState {
  initializedKey: string
  selectedPickupRecordId: string
  pickupDisputeRecordId: string
  pickupDisputeQty: string
  pickupDisputeReason: string
  pickupDisputeRemark: string
  pickupDisputeProofFiles: ProofFile[]
  objectionRecordId: string
  objectionReason: string
  objectionRemark: string
  objectionProofFiles: ProofFile[]
}

const detailState: PdaHandoverDetailState = {
  initializedKey: '',
  selectedPickupRecordId: '',
  pickupDisputeRecordId: '',
  pickupDisputeQty: '',
  pickupDisputeReason: '',
  pickupDisputeRemark: '',
  pickupDisputeProofFiles: [],
  objectionRecordId: '',
  objectionReason: '',
  objectionRemark: '',
  objectionProofFiles: [],
}

function nowTimestamp(date: Date = new Date()): string {
  return date.toISOString().replace('T', ' ').slice(0, 19)
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

function syncHandoutState(handoverId: string): void {
  const pathname = appStore.getState().pathname
  const key = `head:${handoverId}|${pathname}`
  if (detailState.initializedKey === key) return

  detailState.initializedKey = key
  detailState.selectedPickupRecordId = ''
  detailState.pickupDisputeRecordId = ''
  detailState.pickupDisputeQty = ''
  detailState.pickupDisputeReason = ''
  detailState.pickupDisputeRemark = ''
  detailState.pickupDisputeProofFiles = []
  detailState.objectionRecordId = ''
  detailState.objectionReason = ''
  detailState.objectionRemark = ''
  detailState.objectionProofFiles = []
}

function syncPickupState(head: PdaHandoverHead): void {
  const pathname = appStore.getState().pathname
  const key = `pickup:${head.handoverId}|${pathname}`
  if (detailState.initializedKey === key) return

  const records = getPdaPickupRecordsByHead(head.handoverId)
  const currentRecord =
    records.find((record) => record.status === 'PENDING_FACTORY_CONFIRM') ??
    records.find((record) => record.status === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_PROCESSING') ??
    records[0]

  detailState.initializedKey = key
  detailState.selectedPickupRecordId = currentRecord?.recordId || ''
  detailState.pickupDisputeRecordId = ''
  detailState.pickupDisputeQty = currentRecord && typeof currentRecord.warehouseHandedQty === 'number' ? String(currentRecord.warehouseHandedQty) : ''
  detailState.pickupDisputeReason = ''
  detailState.pickupDisputeRemark = ''
  detailState.pickupDisputeProofFiles = []
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

function renderPartyRow(label: string, kind: HandoverPartyKind, name: string): string {
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

function appendTaskAudit(taskId: string, action: string, detail: string, by: string): void {
  const task = getTaskChainTaskById(taskId) as ProcessTask | undefined
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

function getPickupRecordStatusMeta(status: PdaPickupRecord['status']): { label: string; className: string } {
  if (status === 'PENDING_WAREHOUSE_DISPATCH') {
    return { label: '待仓库发出', className: 'border-amber-200 bg-amber-50 text-amber-700' }
  }
  if (status === 'PENDING_FACTORY_PICKUP') {
    return { label: '待自提', className: 'border-blue-200 bg-blue-50 text-blue-700' }
  }
  if (status === 'PENDING_FACTORY_CONFIRM') {
    return { label: '待工厂确认', className: 'border-violet-200 bg-violet-50 text-violet-700' }
  }
  if (status === 'RECEIVED') {
    return { label: '已确认领料', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
  }
  if (status === 'OBJECTION_REPORTED') {
    return { label: '已发起数量差异', className: 'border-red-200 bg-red-50 text-red-700' }
  }
  if (status === 'OBJECTION_PROCESSING') {
    return { label: '差异处理中', className: 'border-blue-200 bg-blue-50 text-blue-700' }
  }
  return { label: '平台已裁定', className: 'border-zinc-200 bg-zinc-100 text-zinc-700' }
}

function getPickupCurrentGuide(
  record: PdaPickupRecord,
): { title: string; hint: string; panelClass: string } {
  if (record.status === 'PENDING_FACTORY_CONFIRM') {
    return {
      title: '当前等待你确认',
      hint: '请确认本次领料，或发起数量差异。',
      panelClass: 'border-violet-200 bg-violet-50',
    }
  }
  if (record.status === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_PROCESSING') {
    return {
      title: '当前等待平台处理',
      hint: '查看异常单进度与处理结果。',
      panelClass: 'border-red-200 bg-red-50',
    }
  }
  if (record.status === 'OBJECTION_RESOLVED') {
    return {
      title: '当前结果已确定',
      hint: '平台已给出最终结果。',
      panelClass: 'border-zinc-200 bg-zinc-50',
    }
  }
  if (record.status === 'RECEIVED') {
    return {
      title: '当前记录已确认',
      hint: '本次领料已确认完成。',
      panelClass: 'border-emerald-200 bg-emerald-50',
    }
  }
  return {
    title: '当前等待仓库交付',
    hint: '先查看记录与二维码。',
    panelClass: 'border-blue-200 bg-blue-50',
  }
}

function formatPickupQty(qty: number | undefined, unit: string): string {
  return typeof qty === 'number' ? `${qty} ${unit}` : '—'
}

function renderPickupCurrentMetric(label: string, value: string, emphasis = false): string {
  return `
    <div class="min-w-0">
      <div class="text-[11px] text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 ${emphasis ? 'text-sm' : 'text-xs'} font-semibold leading-5">${escapeHtml(value)}</div>
    </div>
  `
}

function renderPickupCurrentPanel(record: PdaPickupRecord, showPickupDisputeForm: boolean): string {
  const warehouseQtyValue = formatPickupQty(record.warehouseHandedQty, record.qtyUnit)
  const expectedQtyValue = formatPickupQty(record.qtyExpected, record.qtyUnit)
  const confirmedQtyValue = formatPickupQty(record.factoryConfirmedQty, record.qtyUnit)
  const reportedQtyValue = formatPickupQty(record.factoryReportedQty, record.qtyUnit)
  const finalQtyValue = formatPickupQty(record.finalResolvedQty, record.qtyUnit)
  const shouldShowExpectedInPendingConfirm =
    typeof record.warehouseHandedQty === 'number' && record.warehouseHandedQty !== record.qtyExpected

  if (record.status === 'PENDING_FACTORY_CONFIRM') {
    return `
      <div class="grid gap-x-3 gap-y-2 rounded-md bg-background/70 px-2.5 py-2 sm:grid-cols-2 ${shouldShowExpectedInPendingConfirm ? 'lg:grid-cols-3' : ''}">
        ${renderPickupCurrentMetric('仓库交付数量', warehouseQtyValue, true)}
        ${renderPickupCurrentMetric('仓库交付时间', record.warehouseHandedAt || '待仓库扫码交付')}
        ${
          shouldShowExpectedInPendingConfirm
            ? renderPickupCurrentMetric('本次应领数量', expectedQtyValue)
            : ''
        }
      </div>

      <div class="flex flex-wrap gap-2 pt-1">
        <button
          class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-pda-handoverd-action="confirm-pickup-record"
          data-record-id="${escapeHtml(record.recordId)}"
        >确认本次领料</button>
        <button
          class="inline-flex h-9 items-center rounded-md border border-red-200 bg-background px-4 text-sm text-red-700 hover:bg-red-50"
          data-pda-handoverd-action="open-pickup-record-objection"
          data-record-id="${escapeHtml(record.recordId)}"
        >数量有差异</button>
      </div>

      ${
        showPickupDisputeForm
          ? `
              <div class="space-y-3 border-t border-dashed border-red-200 pt-3">
                <div class="grid gap-3 md:grid-cols-2">
                  <label class="space-y-1">
                    <span class="text-xs font-medium">工厂实际收到数量 *</span>
                    <input
                      class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      type="number"
                      value="${escapeHtml(detailState.pickupDisputeQty)}"
                      data-pda-handoverd-field="pickupDisputeQty"
                    />
                  </label>
                  <label class="space-y-1">
                    <span class="text-xs font-medium">差异原因 *</span>
                    <input
                      class="h-9 w-full rounded-md border bg-background px-3 text-sm"
                      value="${escapeHtml(detailState.pickupDisputeReason)}"
                      data-pda-handoverd-field="pickupDisputeReason"
                      placeholder="例如：实际到货少于仓库交付数量"
                    />
                  </label>
                </div>
                <label class="space-y-1">
                  <span class="text-xs font-medium">差异说明</span>
                  <textarea
                    class="min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm"
                    data-pda-handoverd-field="pickupDisputeRemark"
                    placeholder="补充现场复点结果、包装异常或短少说明"
                  >${escapeHtml(detailState.pickupDisputeRemark)}</textarea>
                </label>
                <div class="space-y-1">
                  <span class="text-xs font-medium">图片 / 视频证据</span>
                  ${renderPickupProofFiles(detailState.pickupDisputeProofFiles)}
                </div>
                <div class="flex flex-wrap gap-2">
                  <button
                    class="inline-flex h-9 items-center rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700"
                    data-pda-handoverd-action="submit-pickup-record-objection"
                    data-record-id="${escapeHtml(record.recordId)}"
                  >提交数量差异</button>
                  <button
                    class="inline-flex h-9 items-center rounded-md border px-4 text-sm hover:bg-muted"
                    data-pda-handoverd-action="cancel-pickup-record-objection"
                  >取消</button>
                </div>
              </div>
            `
          : ''
      }
    `
  }

  if (record.status === 'RECEIVED') {
    return `
      <div class="grid gap-x-3 gap-y-2 rounded-md bg-background/70 px-2.5 py-2 sm:grid-cols-2">
        ${renderPickupCurrentMetric('已确认数量', confirmedQtyValue, true)}
        ${renderPickupCurrentMetric('确认时间', record.factoryConfirmedAt || record.receivedAt || '—')}
      </div>
      <div class="text-xs text-emerald-700">本次领料已确认完成。</div>
    `
  }

  if (record.status === 'OBJECTION_REPORTED' || record.status === 'OBJECTION_PROCESSING') {
    return `
      <div class="grid gap-x-3 gap-y-2 rounded-md bg-background/70 px-2.5 py-2 sm:grid-cols-2 lg:grid-cols-3">
        ${renderPickupCurrentMetric('仓库交付数量', warehouseQtyValue, true)}
        ${renderPickupCurrentMetric('工厂申报数量', reportedQtyValue)}
        ${renderPickupCurrentMetric('异常单号', record.exceptionCaseId || '待生成')}
      </div>
      <div class="space-y-2 pt-1 text-xs text-red-700">
        ${record.followUpRemark ? `<p>处理进度：${escapeHtml(record.followUpRemark)}</p>` : ''}
        <div class="flex flex-wrap gap-2">
          <button
            class="inline-flex h-9 items-center rounded-md border border-red-200 bg-background px-4 text-sm hover:bg-red-100"
            data-pda-handoverd-action="goto-pickup-record-exception"
            data-record-id="${escapeHtml(record.recordId)}"
          >去异常定位与处理</button>
        </div>
      </div>
    `
  }

  if (record.status === 'OBJECTION_RESOLVED') {
    return `
      <div class="grid gap-x-3 gap-y-2 rounded-md bg-background/70 px-2.5 py-2 sm:grid-cols-2">
        ${renderPickupCurrentMetric('最终确认数量', finalQtyValue, true)}
        ${renderPickupCurrentMetric('裁定时间', record.finalResolvedAt || '—')}
      </div>
      <div class="space-y-1 pt-1 text-xs text-zinc-700">
        ${record.resolvedRemark ? `<p>处理说明：${escapeHtml(record.resolvedRemark)}</p>` : ''}
      </div>
    `
  }

  return `
    <div class="grid gap-x-3 gap-y-2 rounded-md bg-background/70 px-2.5 py-2 sm:grid-cols-2">
      ${renderPickupCurrentMetric('本次应领数量', expectedQtyValue, true)}
      ${
        record.warehouseHandedAt
          ? renderPickupCurrentMetric('仓库交付时间', record.warehouseHandedAt)
          : ''
      }
    </div>
    <div class="pt-1 text-xs text-blue-700">当前先查看记录与二维码，待仓库交付后再处理。</div>
  `
}

function renderPickupProofFiles(files: ProofFile[]): string {
  return `
    <div class="space-y-2">
      <div class="flex gap-2">
        <button
          type="button"
          class="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-dashed text-xs hover:bg-muted"
          data-pda-handoverd-action="add-pickup-dispute-proof-image"
        >
          <i data-lucide="image" class="h-3.5 w-3.5 text-blue-500"></i>上传图片
        </button>
        <button
          type="button"
          class="inline-flex h-8 flex-1 items-center justify-center gap-1 rounded-md border border-dashed text-xs hover:bg-muted"
          data-pda-handoverd-action="add-pickup-dispute-proof-video"
        >
          <i data-lucide="video" class="h-3.5 w-3.5 text-purple-500"></i>上传视频
        </button>
      </div>
      ${
        files.length === 0
          ? '<div class="text-xs text-muted-foreground">暂无差异证据，可先提交说明后再补充。</div>'
          : files
              .map(
                (file) => `
                  <div class="flex items-center gap-2 rounded-md border bg-muted/30 px-2.5 py-1.5">
                    <i data-lucide="${file.type === 'IMAGE' ? 'image' : 'video'}" class="h-3.5 w-3.5 ${file.type === 'IMAGE' ? 'text-blue-500' : 'text-purple-500'}"></i>
                    <span class="min-w-0 flex-1 truncate text-xs">${escapeHtml(file.name)}</span>
                    <button
                      type="button"
                      class="inline-flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-destructive"
                      data-pda-handoverd-action="remove-pickup-dispute-proof"
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

function selectPickupRecord(record: PdaPickupRecord | undefined): void {
  detailState.selectedPickupRecordId = record?.recordId || ''
  detailState.pickupDisputeRecordId = ''
  detailState.pickupDisputeQty =
    record && typeof record.warehouseHandedQty === 'number'
      ? String(record.warehouseHandedQty)
      : record && typeof record.factoryReportedQty === 'number'
      ? String(record.factoryReportedQty)
      : ''
  detailState.pickupDisputeReason = record?.objectionReason || ''
  detailState.pickupDisputeRemark = record?.objectionRemark || ''
  detailState.pickupDisputeProofFiles = cloneProofFiles(record?.objectionProofFiles ?? [])
}

function renderPickupRecordItem(record: PdaPickupRecord): string {
  const meta = getPickupRecordStatusMeta(record.status)
  const selected = detailState.selectedPickupRecordId === record.recordId
  const materialSubject = [record.materialName, record.materialSpec].filter(Boolean).join(' · ')
  const sceneChips = [
    record.skuCode ? `SKU ${record.skuCode}` : '',
    record.skuColor ? `颜色 ${record.skuColor}` : '',
    record.skuSize ? `尺码 ${record.skuSize}` : '',
    record.pieceName ? `裁片 ${record.pieceName}` : '',
  ].filter(Boolean)
  const sceneRemark = record.remark?.trim() ? record.remark : ''
  const platformRemark =
    record.status === 'OBJECTION_PROCESSING' || record.status === 'OBJECTION_RESOLVED'
      ? (record.resolvedRemark || record.followUpRemark || '').trim()
      : ''
  const warehouseQtyValue = formatPickupQty(record.warehouseHandedQty, record.qtyUnit)
  const factoryQtyValue = typeof record.factoryConfirmedQty === 'number' ? formatPickupQty(record.factoryConfirmedQty, record.qtyUnit) : ''
  const finalQtyValue = typeof record.finalResolvedQty === 'number' ? formatPickupQty(record.finalResolvedQty, record.qtyUnit) : ''
  const progressFields = [
    factoryQtyValue ? renderFieldRow('工厂确认数量', factoryQtyValue, true) : '',
    finalQtyValue ? renderFieldRow('最终确认数量', finalQtyValue, true) : '',
    record.warehouseHandedAt ? renderFieldRow('仓库交付时间', record.warehouseHandedAt) : '',
    record.factoryConfirmedAt || record.receivedAt
      ? renderFieldRow('工厂确认时间', record.factoryConfirmedAt || record.receivedAt || '')
      : '',
    record.exceptionCaseId ? renderFieldRow('异常单号', record.exceptionCaseId, true) : '',
  ].filter(Boolean)
  const resultTitle = record.status === 'OBJECTION_RESOLVED' ? '平台处理结果' : '数量差异处理'
  const shouldShowResultZone = Boolean(record.objectionReason || record.objectionRemark || record.resolvedRemark || record.followUpRemark)

  return `
    <article data-testid="pickup-record-card" class="space-y-2.5 rounded-lg border ${selected ? 'border-primary bg-primary/5 ring-1 ring-primary/10 shadow-sm' : 'bg-card shadow-sm'} p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">第 ${record.sequenceNo} 次领料</span>
          <span class="inline-flex items-center rounded border px-1.5 py-0 text-[10px] ${meta.className}">${escapeHtml(meta.label)}</span>
        </div>
        <button
          type="button"
          class="inline-flex h-7 items-center rounded-md border px-2.5 text-[11px] ${selected ? 'border-primary text-primary' : 'hover:bg-muted'}"
          data-pda-handoverd-action="select-pickup-record"
          data-record-id="${escapeHtml(record.recordId)}"
        >${selected ? '当前处理中' : '查看本条记录'}</button>
      </div>

      <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        ${renderFieldRow('领料方式', record.pickupModeLabel)}
        ${renderFieldRow('物料说明', record.materialSummary)}
        ${renderFieldRow('本次应领数量', formatPickupQty(record.qtyExpected, record.qtyUnit), true)}
        ${renderFieldRow('仓库交付数量', warehouseQtyValue, true)}
      </div>

      ${
        progressFields.length > 0
          ? `
              <div class="h-px bg-border"></div>
              <div class="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                ${progressFields.join('')}
              </div>
            `
          : ''
      }

      ${
        materialSubject || sceneChips.length > 0 || sceneRemark
          ? `
              <div class="h-px bg-border"></div>
              <div class="space-y-2 text-xs text-muted-foreground">
                ${materialSubject ? `<div><span class="font-medium">物料主体：</span>${escapeHtml(materialSubject)}</div>` : ''}
                ${
                  sceneChips.length > 0
                    ? `<div class="flex flex-wrap gap-1.5">${sceneChips
                        .map(
                          (chip) =>
                            `<span class="inline-flex items-center rounded border border-border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">${escapeHtml(chip)}</span>`,
                        )
                        .join('')}</div>`
                    : ''
                }
                ${sceneRemark ? `<div>备注：${escapeHtml(sceneRemark)}</div>` : ''}
              </div>
            `
          : ''
      }

      <div class="h-px bg-border"></div>
      <div data-testid="pickup-record-qr" class="flex flex-wrap items-start justify-between gap-2 text-xs">
        <div class="space-y-1">
          <p class="text-[11px] font-medium text-muted-foreground">领料记录二维码</p>
          <div class="flex items-center gap-2">
            <i data-lucide="qr-code" class="h-4 w-4 text-primary"></i>
            <span class="font-mono text-xs">${escapeHtml(record.qrCodeValue)}</span>
          </div>
        </div>
        <p class="max-w-[220px] text-[11px] text-muted-foreground">仓库扫码对象固定为领料记录。</p>
      </div>

      ${
        shouldShowResultZone
          ? `
            <div class="h-px bg-border"></div>
            <div class="rounded-md border ${
              record.status === 'OBJECTION_RESOLVED' ? 'border-zinc-200 bg-zinc-50 text-zinc-700' : 'border-red-200 bg-red-50 text-red-700'
            } px-2.5 py-2 text-xs" data-testid="pickup-record-result">
              <div class="font-medium">${record.status === 'OBJECTION_RESOLVED' ? '平台处理结果' : '数量差异处理'}</div>
              ${record.objectionReason ? `<div>差异原因：${escapeHtml(record.objectionReason)}</div>` : ''}
              ${record.objectionRemark ? `<div class="mt-1">差异说明：${escapeHtml(record.objectionRemark)}</div>` : ''}
              ${
                record.objectionProofFiles && record.objectionProofFiles.length > 0
                  ? `<div class="mt-1">证据数量：${record.objectionProofFiles.length}</div>`
                  : ''
              }
              ${record.followUpRemark ? `<div class="mt-1">处理进度：${escapeHtml(record.followUpRemark)}</div>` : ''}
              ${platformRemark ? `<div class="mt-1">处理说明：${escapeHtml(platformRemark)}</div>` : ''}
            </div>
          `
          : ''
      }
    </article>
  `
}

function renderPickupTraceabilitySection(head: PdaHandoverHead, sourceDoc: ReturnType<typeof getPdaHeadSourceExecutionDoc>, runtimeTask: ReturnType<typeof getPdaHeadRuntimeTask>): string {
  return `
    <details class="rounded-lg border bg-card" data-testid="pickup-traceability">
      <summary class="cursor-pointer list-none px-3 py-2 text-sm font-medium">
        <span class="flex items-center justify-between gap-2">
          <span>来源与追溯信息</span>
          <i data-lucide="chevron-down" class="h-4 w-4 text-muted-foreground"></i>
        </span>
      </summary>
      <div class="space-y-3 border-t px-3 py-3">
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          ${renderFieldRow('原始任务', head.rootTaskNo || head.taskNo)}
          ${renderFieldRow('来源执行单', sourceDoc?.docNo || '—')}
          ${renderFieldRow('来源类型', sourceDoc?.docType === 'ISSUE' ? '仓库发料单' : sourceDoc?.docType ? '其他单据' : '—')}
          ${renderFieldRow('交接范围', head.scopeLabel || '整单')}
          ${renderFieldRow('当前任务号', runtimeTask?.taskNo || runtimeTask?.taskId || head.taskNo)}
        </div>
      </div>
    </details>
  `
}

function renderPickupHeadDetail(head: PdaHandoverHead): string {
  const records = getPdaPickupRecordsByHead(head.handoverId)
  const isCompleted = head.completionStatus === 'COMPLETED'
  const sourceDoc = getPdaHeadSourceExecutionDoc(head.handoverId)
  const runtimeTask = getPdaHeadRuntimeTask(head.handoverId)
  const currentRecord = detailState.selectedPickupRecordId
    ? records.find((record) => record.recordId === detailState.selectedPickupRecordId) ?? records[0]
    : records[0]
  const currentRecordMeta = currentRecord ? getPickupRecordStatusMeta(currentRecord.status) : null
  const currentGuide = currentRecord ? getPickupCurrentGuide(currentRecord) : null
  const showPickupDisputeForm =
    currentRecord &&
    currentRecord.status === 'PENDING_FACTORY_CONFIRM' &&
    detailState.pickupDisputeRecordId === currentRecord.recordId

  return `
    ${renderSectionCard(
      '领料信息（领料头）',
      `
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('任务编号', head.taskNo)}
        ${renderFieldRow('生产单号', head.productionOrderNo)}
        ${renderFieldRow('当前工序', head.processName)}
      </div>
      <div class="h-px bg-border"></div>
      ${renderPartyRow('来源仓库', 'WAREHOUSE', head.sourceFactoryName)}
      ${renderPartyRow('领料工厂', 'FACTORY', head.targetName)}
      <div class="h-px bg-border"></div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('累计领料记录', `${head.recordCount} 次`)}
        ${renderFieldRow('待处理记录', `${head.pendingWritebackCount} 次`)}
        ${renderFieldRow('应领总量', `${head.qtyExpectedTotal} ${head.qtyUnit}`)}
        ${renderFieldRow('累计最终确认总量', `${head.qtyActualTotal} ${head.qtyUnit}`)}
      </div>
      <div class="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">
        ${
          isCompleted
            ? `这里只处理领料确认与差异；头单已由仓库发起完成。`
            : '这里只处理领料确认与差异；头单完成由仓库发起。'
        }
      </div>
    `,
    )}

    ${renderSectionCard(
      '当前记录处理区',
      !currentRecord
        ? '<div class="py-4 text-center text-xs text-muted-foreground">当前暂无可处理的领料记录</div>'
        : `
            <div data-testid="pickup-current-panel-card" class="space-y-3 rounded-lg border ${currentGuide?.panelClass || 'border-primary/20 bg-primary/5'} px-3 py-3 shadow-sm">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <p class="text-sm font-semibold">当前处理记录</p>
                <span class="inline-flex items-center rounded border px-2 py-1 text-xs ${currentRecordMeta?.className || ''}">${escapeHtml(currentRecordMeta?.label || '—')}</span>
              </div>
              <p class="text-xs text-muted-foreground">${escapeHtml(currentGuide?.hint || '查看当前记录并继续处理。')}</p>
              ${renderPickupCurrentPanel(currentRecord, showPickupDisputeForm)}
            </div>
          `,
    )}

    ${renderSectionCard(
      '仓库已生成的领料记录',
      records.length === 0
        ? '<div class="py-4 text-center text-xs text-muted-foreground">暂无仓库回写的领料记录</div>'
        : `<div class="space-y-2">${records.map((record) => renderPickupRecordItem(record)).join('')}</div>`,
    )}

    ${renderPickupTraceabilitySection(head, sourceDoc, runtimeTask)}
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

function getHandoutObjectionStatusLabel(record: PdaHandoverRecord): string {
  if (record.objectionStatus === 'REPORTED') return '已发起异议'
  if (record.objectionStatus === 'PROCESSING') return '异议处理中'
  if (record.objectionStatus === 'RESOLVED') return '异议已处理'
  return '无'
}

function renderHandoutQrBlock(head: PdaHandoverHead, objectTypeLabel: string): string {
  if (!head.qrCodeValue) return ''

  return `
    <div data-testid="handout-head-qr" class="shrink-0 rounded-md border bg-white p-2">
      ${renderRealQrPlaceholder({
        value: head.qrCodeValue,
        size: 132,
        title: `交出头二维码 ${head.handoverId}`,
        label: `交出头 ${head.handoverId} 二维码`,
      })}
      <div class="mt-2 space-y-1 text-[11px] leading-tight text-muted-foreground">
        <div>交出头编号：${escapeHtml(head.handoverId)}</div>
        <div>任务编号：${escapeHtml(head.taskNo)}</div>
        <div>交出物类型：${escapeHtml(objectTypeLabel)}</div>
      </div>
    </div>
  `
}

function renderHandoutRecordInfoChips(lines: string[]): string {
  if (lines.length === 0) {
    return '<div class="text-xs text-muted-foreground">当前暂无可读的交出物明细</div>'
  }

  return `
    <div class="flex flex-wrap gap-1.5">
      ${lines
        .map(
          (line) =>
            `<span class="inline-flex items-center rounded border border-border bg-muted/30 px-2 py-0.5 text-[11px] text-muted-foreground">${escapeHtml(line)}</span>`,
        )
        .join('')}
    </div>
  `
}

function renderCutPiecePartGroups(profile: ReturnType<typeof deriveHandoutRecordProfile>): string {
  const groups = profile.cutPiecePartGroups ?? []
  if (groups.length === 0) {
    return renderHandoutRecordInfoChips(profile.infoLines)
  }

  return `
    <div class="space-y-2" data-testid="cut-piece-part-groups">
      ${groups
        .map(
          (group) => `
            <div data-testid="cut-piece-part-group" class="space-y-2 rounded-md border bg-muted/20 px-2.5 py-2">
              <div class="flex flex-wrap items-center gap-2 text-xs">
                <span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0 text-[10px]">部位：${escapeHtml(group.partLabel)}</span>
                <span>本次交出裁片片数（片）：<span class="font-medium text-foreground">${group.totalPieceQty} 片</span></span>
                <span>可折算成衣件数（件）：<span class="font-medium text-foreground">${group.totalGarmentEquivalentQty} 件</span></span>
              </div>
              <div class="space-y-1.5">
                ${group.skuLines
                  .map(
                    (line) => `
                      <div data-testid="cut-piece-sku-line" class="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border bg-background px-2.5 py-2 text-xs">
                        ${renderFieldRow('SKU 编码', line.garmentSkuCode, true)}
                        ${renderFieldRow('颜色 / 尺码', `${line.colorLabel || '—'} / ${line.sizeLabel || '—'}`)}
                        ${renderFieldRow('裁片片数（片）', `${line.pieceQty} 片`, true)}
                        ${renderFieldRow('可折算成衣件数（件）', `${line.garmentEquivalentQty} 件`, true)}
                      </div>
                    `,
                  )
                  .join('')}
              </div>
            </div>
          `,
        )
        .join('')}
    </div>
  `
}

function renderHandoutRecordItem(
  record: PdaHandoverRecord,
  head: PdaHandoverHead,
  runtimeTask: ReturnType<typeof getPdaHeadRuntimeTask>,
  sourceDoc: ReturnType<typeof getPdaHeadSourceExecutionDoc>,
): string {
  const meta = getRecordStatusMeta(record.status)
  const showObjectionForm = detailState.objectionRecordId === record.recordId && record.status === 'WRITTEN_BACK'
  const profile = deriveHandoutRecordProfile(record, head, runtimeTask, sourceDoc)

  return `
    <article data-testid="handout-record-card" class="space-y-2 rounded-lg border bg-card p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">第 ${record.sequenceNo} 次交出</span>
          <span class="inline-flex items-center rounded border px-1.5 py-0 text-[10px] ${meta.className}">${escapeHtml(meta.label)}</span>
        </div>
        <span class="text-[11px] text-muted-foreground">发起时间：${escapeHtml(record.factorySubmittedAt)}</span>
      </div>

      <div class="space-y-2 text-xs">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">${escapeHtml(profile.objectTypeLabel)}</span>
          <span class="font-medium">${escapeHtml(profile.itemTitle)}</span>
          ${
            profile.objectType === 'CUT_PIECE' && profile.cutPieceRecordSummary
              ? `
                <span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0 text-[10px]">涉及部位：${profile.cutPieceRecordSummary.involvedPartCount} 种</span>
                <span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0 text-[10px]">涉及 SKU：${profile.cutPieceRecordSummary.involvedSkuCount} 个</span>
              `
              : ''
          }
          ${
            typeof profile.garmentEquivalentQty === 'number'
              ? `<span class="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] text-blue-700">可折算成衣件数（件）：${profile.garmentEquivalentQty} 件</span>`
              : ''
          }
        </div>
        ${profile.objectType === 'CUT_PIECE' ? renderCutPiecePartGroups(profile) : renderHandoutRecordInfoChips(profile.infoLines)}
      </div>

      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div><span class="text-muted-foreground">${escapeHtml(profile.plannedQtyLabel)}：</span>${escapeHtml(profile.plannedQtyText)}</div>
        <div><span class="text-muted-foreground">${escapeHtml(profile.writtenQtyLabel)}：</span>${escapeHtml(profile.writtenQtyText)}</div>
        <div><span class="text-muted-foreground">${escapeHtml(profile.pendingQtyLabel)}：</span>${escapeHtml(profile.pendingQtyText)}</div>
        <div><span class="text-muted-foreground">回货单号：</span>${escapeHtml(record.warehouseReturnNo || '待仓库回写')}</div>
        <div><span class="text-muted-foreground">回写时间：</span>${escapeHtml(record.warehouseWrittenAt || '待仓库回写')}</div>
        <div><span class="text-muted-foreground">异议状态：</span>${escapeHtml(getHandoutObjectionStatusLabel(record))}</div>
        <div><span class="text-muted-foreground">工厂说明：</span>${escapeHtml(record.factoryRemark || '—')}</div>
        <div><span class="text-muted-foreground">回写记录：</span>${record.factoryProofFiles.length > 0 ? `${record.factoryProofFiles.length} 个工厂凭证` : '由仓库回写生成'}</div>
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
  const isCompleted = head.completionStatus === 'COMPLETED'
  const sourceDoc = getPdaHeadSourceExecutionDoc(head.handoverId)
  const runtimeTask = getPdaHeadRuntimeTask(head.handoverId)
  const profile = deriveHandoutObjectProfile(head, records, runtimeTask, sourceDoc)
  const detailLines = profile.objectInfoLines.length
    ? profile.objectInfoLines
        .map((line) => `<div class="truncate">${escapeHtml(line)}</div>`)
        .join('')
    : '<div>当前暂无仓库回写记录</div>'

  return `
    ${renderSectionCard(
      '交出信息（交出头）',
      `
      <div class="flex flex-col gap-3 lg:flex-row">
        <div class="min-w-0 flex-1 space-y-2.5">
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            ${renderFieldRow('任务编号', head.taskNo)}
            ${renderFieldRow('交出头编号', head.handoverId)}
            ${renderFieldRow('原始任务', head.rootTaskNo || head.taskNo)}
            ${renderFieldRow('生产单号', head.productionOrderNo)}
            ${renderFieldRow('当前工序', head.processName)}
            ${renderFieldRow('任务状态', head.taskStatus === 'DONE' ? '已完工' : '进行中')}
          </div>
          <div class="h-px bg-border"></div>
          ${renderPartyRow('交出工厂', 'FACTORY', head.sourceFactoryName)}
          ${renderPartyRow(head.targetKind === 'WAREHOUSE' ? '去向仓库' : '去向工厂', head.targetKind, head.targetName)}
          <div class="h-px bg-border"></div>
          <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            ${renderFieldRow('来源执行单', sourceDoc?.docNo || '—')}
            ${renderFieldRow('来源类型', sourceDoc?.docType === 'RETURN' ? '工序回货单' : sourceDoc?.docType ? '其他单据' : '—')}
            ${renderFieldRow('交接范围', head.scopeLabel || '整单')}
            ${renderFieldRow('当前任务号', runtimeTask?.taskNo || runtimeTask?.taskId || head.taskNo)}
          </div>
        </div>
        ${renderHandoutQrBlock(head, profile.objectTypeLabel)}
      </div>
      <div class="h-px bg-border"></div>
      <div data-testid="handout-head-object-profile" class="space-y-2 rounded-md border bg-muted/20 px-2.5 py-2 text-xs">
        <div class="flex flex-wrap items-center gap-1.5">
          <span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0 text-[10px]">交出物类型：${escapeHtml(profile.objectTypeLabel)}</span>
          ${
            profile.objectType === 'CUT_PIECE' && profile.cutPieceRecordSummary
              ? `
                <span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0 text-[10px]">涉及部位：${profile.cutPieceRecordSummary.involvedPartCount} 种</span>
                <span class="inline-flex items-center rounded border border-border bg-background px-1.5 py-0 text-[10px]">涉及 SKU：${profile.cutPieceRecordSummary.involvedSkuCount} 个</span>
              `
              : ''
          }
          ${
            typeof profile.garmentEquivalentQtyTotal === 'number'
              ? `<span class="inline-flex items-center rounded border border-blue-200 bg-blue-50 px-1.5 py-0 text-[10px] text-blue-700">可折算成衣件数（件）：${profile.garmentEquivalentQtyTotal} 件</span>`
              : ''
          }
        </div>
        <div class="space-y-0.5 text-muted-foreground">${detailLines}</div>
        <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          ${renderFieldRow(profile.primaryQtyLabel, `${profile.totalPlannedQty} ${profile.displayUnit}`, true)}
          ${renderFieldRow(profile.writtenQtyLabel, `${profile.totalWrittenQty} ${profile.displayUnit}`, true)}
          ${renderFieldRow(profile.pendingQtyLabel, `${profile.totalPendingQty} ${profile.displayUnit}`, true)}
          ${renderFieldRow('数量异议', `${head.objectionCount} 条`)}
          ${renderFieldRow('累计交出次数', `${head.recordCount} 次`)}
          ${renderFieldRow('待仓库回写', `${head.pendingWritebackCount} 次`)}
        </div>
      </div>
      <div class="rounded-md border ${head.qtyDiffTotal !== 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'} px-2.5 py-1.5 text-xs">
        ${head.qtyDiffTotal !== 0 ? `数量有差异（差异 ${head.qtyDiffTotal > 0 ? '-' : '+'}${Math.abs(head.qtyDiffTotal)} ${profile.displayUnit}）` : '数量一致'}
      </div>
      <div class="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">
        ${isCompleted ? `仓库已发起交出完成：${escapeHtml(head.completedByWarehouseAt || '—')}` : '当前由仓库收货后自动回写并发起完成，工厂不可手工补录交出信息'}
      </div>
    `,
    )}

    ${renderSectionCard(
      '交出记录列表',
      records.length === 0
        ? '<div class="py-4 text-center text-xs text-muted-foreground">当前等待仓库收货回写，暂未生成交出记录</div>'
        : `<div class="space-y-2">${records.map((record) => renderHandoutRecordItem(record, head, runtimeTask, sourceDoc)).join('')}</div>`,
    )}
  `
}

export function renderPdaHandoverDetailPage(eventId: string): string {
  const head = findPdaHandoverHead(eventId)

  if (!head) {
    const content = `
      <div class="space-y-4 p-4">
        <button class="inline-flex h-8 items-center rounded-md px-2 text-sm text-muted-foreground hover:bg-muted" data-pda-handoverd-action="back">
          <i data-lucide="arrow-left" class="mr-2 h-4 w-4"></i>返回
        </button>
        <article class="rounded-lg border bg-card py-8 text-center text-sm text-muted-foreground">未找到交接头单</article>
      </div>
    `
    return renderPdaFrame(content, 'handover')
  }

  const task = getPdaTaskFlowTaskById(head.taskId)
  if (head.headType === 'PICKUP' && isCuttingSpecialTask(task)) {
    const backHref = head.headType === 'PICKUP' ? '/fcs/pda/handover?tab=pickup' : '/fcs/pda/handover?tab=handout'
    return renderPdaCuttingTaskDetailPage(head.taskId, { backHref })
  }

  if (head.headType === 'PICKUP') {
    syncPickupState(head)
  } else {
    syncHandoutState(head.handoverId)
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
          <span class="text-sm font-semibold">${escapeHtml(head.headType === 'PICKUP' ? '领料详情' : '交出详情')}</span>
        </div>
        <div class="w-16"></div>
      </div>

      <div class="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
        <span class="inline-flex items-center gap-1">
          <i data-lucide="${head.headType === 'PICKUP' ? 'warehouse' : 'factory'}" class="h-3.5 w-3.5 text-muted-foreground"></i>
          <span class="text-muted-foreground">${escapeHtml(head.sourceFactoryName)}</span>
        </span>
        <i data-lucide="arrow-right" class="h-4 w-4 shrink-0 text-muted-foreground"></i>
        <span class="inline-flex items-center gap-1">
          <i data-lucide="${head.targetKind === 'WAREHOUSE' ? 'warehouse' : 'factory'}" class="h-3.5 w-3.5 text-primary"></i>
          <span class="font-medium text-primary">${escapeHtml(head.targetName)}</span>
        </span>
        <div class="ml-auto text-xs text-muted-foreground">一个任务一个${head.headType === 'PICKUP' ? '领料头' : '交出头'}</div>
      </div>

      ${head.headType === 'PICKUP' ? renderPickupHeadDetail(head) : renderHandoutHeadDetail(head)}
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

    if (field === 'pickupDisputeQty') {
      detailState.pickupDisputeQty = fieldNode.value
      return true
    }

    if (field === 'pickupDisputeReason') {
      detailState.pickupDisputeReason = fieldNode.value
      return true
    }

    if (field === 'pickupDisputeRemark') {
      detailState.pickupDisputeRemark = fieldNode.value
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

  if (action === 'add-pickup-dispute-proof-image' || action === 'add-pickup-dispute-proof-video') {
    const type = action === 'add-pickup-dispute-proof-image' ? 'IMAGE' : 'VIDEO'
    const ext = type === 'IMAGE' ? 'jpg' : 'mp4'
    const index = detailState.pickupDisputeProofFiles.length + 1
    detailState.pickupDisputeProofFiles = [
      ...detailState.pickupDisputeProofFiles,
      {
        id: `pdf-${Date.now()}`,
        type,
        name: `领料差异凭证_${String(index).padStart(2, '0')}.${ext}`,
        uploadedAt: nowDisplayTimestamp(),
      },
    ]
    showPdaHandoverDetailToast(type === 'IMAGE' ? '差异图片已添加' : '差异视频已添加')
    return true
  }

  if (action === 'remove-pickup-dispute-proof') {
    const proofId = actionNode.dataset.proofId
    if (proofId) {
      detailState.pickupDisputeProofFiles = detailState.pickupDisputeProofFiles.filter((file) => file.id !== proofId)
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

  if (action === 'confirm-pickup-record') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    const currentRecord = findPdaPickupRecord(recordId)
    if (!currentRecord) {
      showPdaHandoverDetailToast('未找到领料记录')
      return true
    }
    if (currentRecord.status !== 'PENDING_FACTORY_CONFIRM') {
      showPdaHandoverDetailToast('当前记录暂不可确认领料')
      return true
    }
    if (typeof currentRecord.warehouseHandedQty !== 'number' || currentRecord.warehouseHandedQty < 0) {
      showPdaHandoverDetailToast('当前记录缺少仓库交付数量')
      return true
    }
    const updated = confirmPdaPickupRecordReceived(recordId, {
      factoryConfirmedQty: currentRecord.warehouseHandedQty,
      factoryConfirmedAt: nowTimestamp(),
    })
    if (!updated) {
      showPdaHandoverDetailToast('当前记录暂不可确认领料')
      return true
    }
    selectPickupRecord(updated)
    appendTaskAudit(
      updated.taskId,
      'PICKUP_RECORD_CONFIRM',
      `已确认领料数量 ${updated.factoryConfirmedQty ?? updated.qtyExpected} ${updated.qtyUnit}`,
      'PDA',
    )
    showPdaHandoverDetailToast('本次领料已确认')
    return true
  }

  if (action === 'select-pickup-record') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    selectPickupRecord(findPdaPickupRecord(recordId))
    return true
  }

  if (action === 'open-pickup-record-objection') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    const currentRecord = findPdaPickupRecord(recordId)
    if (!currentRecord || currentRecord.status !== 'PENDING_FACTORY_CONFIRM') {
      showPdaHandoverDetailToast('当前记录暂不可发起数量差异')
      return true
    }
    detailState.pickupDisputeRecordId = recordId
    detailState.pickupDisputeQty =
      typeof currentRecord.warehouseHandedQty === 'number'
        ? String(currentRecord.warehouseHandedQty)
        : String(currentRecord.qtyExpected)
    detailState.pickupDisputeReason = ''
    detailState.pickupDisputeRemark = ''
    detailState.pickupDisputeProofFiles = []
    return true
  }

  if (action === 'cancel-pickup-record-objection') {
    detailState.pickupDisputeRecordId = ''
    detailState.pickupDisputeQty = ''
    detailState.pickupDisputeReason = ''
    detailState.pickupDisputeRemark = ''
    detailState.pickupDisputeProofFiles = []
    return true
  }

  if (action === 'submit-pickup-record-objection') {
    const recordId = actionNode.dataset.recordId
    if (!recordId) return true
    const currentRecord = findPdaPickupRecord(recordId)
    if (!currentRecord || currentRecord.status !== 'PENDING_FACTORY_CONFIRM') {
      showPdaHandoverDetailToast('当前记录暂不可发起数量差异')
      return true
    }
    const factoryReportedQty = Number(detailState.pickupDisputeQty)
    if (!Number.isFinite(factoryReportedQty) || factoryReportedQty < 0) {
      showPdaHandoverDetailToast('请先填写工厂实际收到数量')
      return true
    }
    if (!detailState.pickupDisputeReason.trim()) {
      showPdaHandoverDetailToast('请先填写差异原因')
      return true
    }

    const result = createPdaPickupDisputeCase(recordId, {
      factoryReportedQty,
      objectionReason: detailState.pickupDisputeReason.trim(),
      objectionRemark: detailState.pickupDisputeRemark.trim() || undefined,
      objectionProofFiles: cloneProofFiles(detailState.pickupDisputeProofFiles) as HandoverProofFile[],
    })

    if (!result.record || !result.exceptionCase) {
      showPdaHandoverDetailToast(result.issues.join('；') || '数量差异提交失败')
      return true
    }

    appendTaskAudit(
      result.record.taskId,
      'PICKUP_QTY_OBJECTION',
      '已发起领料数量差异，请等待处理',
      'PDA',
    )
    selectPickupRecord(result.record)
    showPdaHandoverDetailToast(`数量差异已提交：${result.exceptionCase.caseId}`)
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
      `已发起交出数量异议：${updated.objectionReason}`,
      'PDA',
    )

    detailState.objectionRecordId = ''
    detailState.objectionReason = ''
    detailState.objectionRemark = ''
    detailState.objectionProofFiles = []
    showPdaHandoverDetailToast('数量异议已提交，等待平台处理')
    return true
  }

  if (action === 'goto-pickup-record-exception') {
    const recordId = actionNode.dataset.recordId
    const record = recordId ? findPdaPickupRecord(recordId) : undefined
    if (!record?.exceptionCaseId) {
      showPdaHandoverDetailToast('当前记录尚未绑定异常单')
      return true
    }
    appStore.navigate(`/fcs/progress/exceptions?caseId=${encodeURIComponent(record.exceptionCaseId)}`)
    return true
  }

  return false
}
