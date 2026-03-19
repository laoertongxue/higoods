import { appStore } from '../state/store'
import { escapeHtml } from '../utils'
import { processTasks, type ProcessTask } from '../data/fcs/process-tasks'
import {
  confirmPdaPickupRecordReceived,
  createPdaPickupRecord,
  findPdaHandoverHead,
  getPdaHeadRuntimeTask,
  getPdaHeadSourceExecutionDoc,
  findPdaPickupRecord,
  createPdaHandoverRecord,
  getPdaPickupRecordsByHead,
  getPdaHandoverRecordsByHead,
  reportPdaHandoverQtyObjection,
  type PdaPickupRecord,
  type PdaHandoverHead,
  type PdaHandoverRecord,
  type HandoverPartyKind,
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
  proofFiles: ProofFile[]
  pickupRecordTime: string
  pickupRecordMode: 'WAREHOUSE_DELIVERY' | 'FACTORY_PICKUP'
  pickupRecordMaterialSummary: string
  pickupRecordQty: string
  pickupRecordRemark: string
  handoverRecordTime: string
  handoverRecordRemark: string
  objectionRecordId: string
  objectionReason: string
  objectionRemark: string
  objectionProofFiles: ProofFile[]
}

const detailState: PdaHandoverDetailState = {
  initializedKey: '',
  proofFiles: [],
  pickupRecordTime: '',
  pickupRecordMode: 'WAREHOUSE_DELIVERY',
  pickupRecordMaterialSummary: '',
  pickupRecordQty: '',
  pickupRecordRemark: '',
  handoverRecordTime: '',
  handoverRecordRemark: '',
  objectionRecordId: '',
  objectionReason: '',
  objectionRemark: '',
  objectionProofFiles: [],
}

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

function syncHandoutState(handoverId: string): void {
  const pathname = appStore.getState().pathname
  const key = `head:${handoverId}|${pathname}`
  if (detailState.initializedKey === key) return

  detailState.initializedKey = key
  detailState.handoverRecordTime = nowDateTimeLocalInput()
  detailState.handoverRecordRemark = ''
  detailState.proofFiles = []
  detailState.pickupRecordTime = ''
  detailState.pickupRecordMode = 'WAREHOUSE_DELIVERY'
  detailState.pickupRecordMaterialSummary = ''
  detailState.pickupRecordQty = ''
  detailState.pickupRecordRemark = ''
  detailState.objectionRecordId = ''
  detailState.objectionReason = ''
  detailState.objectionRemark = ''
  detailState.objectionProofFiles = []
}

function syncPickupState(head: PdaHandoverHead): void {
  const pathname = appStore.getState().pathname
  const key = `pickup:${head.handoverId}|${pathname}`
  if (detailState.initializedKey === key) return

  detailState.initializedKey = key
  detailState.pickupRecordTime = nowDateTimeLocalInput()
  detailState.pickupRecordMode = 'WAREHOUSE_DELIVERY'
  detailState.pickupRecordMaterialSummary = `${head.processName}领料补充批次`
  detailState.pickupRecordQty = String(Math.max(1, head.qtyExpectedTotal - head.qtyActualTotal))
  detailState.pickupRecordRemark = ''
  detailState.proofFiles = []
  detailState.handoverRecordTime = ''
  detailState.handoverRecordRemark = ''
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

function appendTaskAudit(taskId: string, action: string, detail: string, by: string): void {
  const task = processTasks.find((item) => item.taskId === taskId) as ProcessTask | undefined
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
  return { label: '已领料确认', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' }
}

function renderPickupRecordItem(record: PdaPickupRecord, head: PdaHandoverHead): string {
  const meta = getPickupRecordStatusMeta(record.status)
  const diffQty = (record.qtyActual ?? 0) - record.qtyExpected

  return `
    <article class="space-y-2 rounded-lg border bg-card p-3">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div class="flex items-center gap-2">
          <span class="font-mono text-xs text-muted-foreground">${escapeHtml(record.recordId)}</span>
          <span class="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0 text-[10px]">第 ${record.sequenceNo} 次领料</span>
          <span class="inline-flex items-center rounded border px-1.5 py-0 text-[10px] ${meta.className}">${escapeHtml(meta.label)}</span>
        </div>
        <span class="text-[11px] text-muted-foreground">发起时间：${escapeHtml(record.submittedAt)}</span>
      </div>

      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div><span class="text-muted-foreground">领料方式：</span>${escapeHtml(record.pickupModeLabel)}</div>
        <div><span class="text-muted-foreground">物料摘要：</span>${escapeHtml(record.materialSummary)}</div>
        <div><span class="text-muted-foreground">物料名称：</span>${escapeHtml(record.materialName || '—')}</div>
        <div><span class="text-muted-foreground">物料规格：</span>${escapeHtml(record.materialSpec || '—')}</div>
        <div><span class="text-muted-foreground">SKU：</span>${escapeHtml(record.skuCode || '—')}</div>
        <div><span class="text-muted-foreground">颜色/尺码：</span>${escapeHtml(record.skuColor || '—')} / ${escapeHtml(record.skuSize || '—')}</div>
        <div><span class="text-muted-foreground">裁片：</span>${escapeHtml(record.pieceName || '—')}</div>
        <div><span class="text-muted-foreground">本次应领：</span>${record.qtyExpected} ${escapeHtml(record.qtyUnit)}</div>
        <div><span class="text-muted-foreground">本次实领：</span>${typeof record.qtyActual === 'number' ? `${record.qtyActual} ${escapeHtml(record.qtyUnit)}` : '待确认'}</div>
        <div><span class="text-muted-foreground">剩余数量：</span>${
          typeof record.qtyActual === 'number'
            ? `${Math.max(record.qtyExpected - record.qtyActual, 0)} ${escapeHtml(record.qtyUnit)}`
            : `${record.qtyExpected} ${escapeHtml(record.qtyUnit)}`
        }</div>
        <div><span class="text-muted-foreground">备注：</span>${escapeHtml(record.remark || '—')}</div>
        <div><span class="text-muted-foreground">确认时间：</span>${escapeHtml(record.receivedAt || '待确认')}</div>
      </div>

      ${
        typeof record.qtyActual === 'number' && diffQty !== 0
          ? `<div class="rounded-md border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">数量有差异（${diffQty > 0 ? '+' : ''}${diffQty} ${escapeHtml(record.qtyUnit)}）</div>`
          : ''
      }

      ${
        head.completionStatus === 'OPEN' && record.status !== 'RECEIVED'
          ? `
            <div class="flex items-center justify-end gap-2">
              <button
                class="inline-flex h-8 items-center rounded-md border px-3 text-xs hover:bg-muted"
                data-pda-handoverd-action="confirm-pickup-record"
                data-record-id="${escapeHtml(record.recordId)}"
              >确认本次领料</button>
            </div>
          `
          : ''
      }
    </article>
  `
}

function renderPickupHeadDetail(head: PdaHandoverHead): string {
  const records = getPdaPickupRecordsByHead(head.handoverId)
  const isCompleted = head.completionStatus === 'COMPLETED'
  const sourceDoc = getPdaHeadSourceExecutionDoc(head.handoverId)
  const runtimeTask = getPdaHeadRuntimeTask(head.handoverId)

  return `
    ${renderSectionCard(
      '领料信息（领料头）',
      `
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('任务编号', head.taskNo)}
        ${renderFieldRow('生产单号', head.productionOrderNo)}
        ${renderFieldRow('当前工序', head.processName)}
        ${renderFieldRow('任务状态', head.taskStatus === 'DONE' ? '已完工' : '进行中')}
      </div>
      <div class="h-px bg-border"></div>
      ${renderPartyRow('来源仓库', 'WAREHOUSE', head.sourceFactoryName)}
      ${renderPartyRow('领料工厂', 'FACTORY', head.targetName)}
      <div class="h-px bg-border"></div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('来源执行单', sourceDoc?.docNo || sourceDoc?.id || '—')}
        ${renderFieldRow('来源类型', sourceDoc?.docType === 'ISSUE' ? '仓库发料单' : sourceDoc?.docType || '—')}
        ${renderFieldRow('执行范围', head.scopeLabel || '整单')}
        ${renderFieldRow('运行时任务', runtimeTask?.taskId || head.runtimeTaskId || '—')}
      </div>
      <div class="h-px bg-border"></div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('累计领料记录', `${head.recordCount} 次`)}
        ${renderFieldRow('待完成记录', `${head.pendingWritebackCount} 次`)}
        ${renderFieldRow('应领总量', `${head.qtyExpectedTotal} ${head.qtyUnit}`)}
        ${renderFieldRow('累计实领总量', `${head.qtyActualTotal} ${head.qtyUnit}`)}
      </div>
      <div class="rounded-md border ${head.qtyDiffTotal !== 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'} px-2.5 py-1.5 text-xs">
        ${head.qtyDiffTotal !== 0 ? `数量有差异（差异 ${head.qtyDiffTotal > 0 ? '-' : '+'}${Math.abs(head.qtyDiffTotal)} ${head.qtyUnit}）` : '数量一致'}
      </div>
      <div class="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">
        ${isCompleted ? `仓库已发起领料完成：${escapeHtml(head.completedByWarehouseAt || '—')}` : '当前头单待仓库发起完成，工厂不可主动关闭'}
      </div>
    `,
    )}

    ${
      !isCompleted
        ? renderSectionCard(
            '新增领料记录',
            `
      <div class="grid gap-2 md:grid-cols-2">
        <div class="space-y-1">
          <label class="text-xs font-medium">本次领料时间 *</label>
          <input
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            type="datetime-local"
            value="${escapeHtml(detailState.pickupRecordTime)}"
            data-pda-handoverd-field="pickupRecordTime"
          />
        </div>
        <div class="space-y-1">
          <label class="text-xs font-medium">领料方式 *</label>
          <select
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            data-pda-handoverd-field="pickupRecordMode"
          >
            <option value="WAREHOUSE_DELIVERY" ${detailState.pickupRecordMode === 'WAREHOUSE_DELIVERY' ? 'selected' : ''}>仓库配送到厂</option>
            <option value="FACTORY_PICKUP" ${detailState.pickupRecordMode === 'FACTORY_PICKUP' ? 'selected' : ''}>工厂到仓自提</option>
          </select>
        </div>
      </div>
      <div class="space-y-1">
        <label class="text-xs font-medium">物料摘要 *</label>
        <input
          class="h-9 w-full rounded-md border bg-background px-3 text-sm"
          value="${escapeHtml(detailState.pickupRecordMaterialSummary)}"
          data-pda-handoverd-field="pickupRecordMaterialSummary"
          placeholder="例如：主布+辅料包"
        />
      </div>
      <div class="grid gap-2 md:grid-cols-2">
        <div class="space-y-1">
          <label class="text-xs font-medium">本次数量 *</label>
          <input
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            type="number"
            value="${escapeHtml(detailState.pickupRecordQty)}"
            data-pda-handoverd-field="pickupRecordQty"
          />
        </div>
        <div class="space-y-1">
          <label class="text-xs">备注</label>
          <input
            class="h-9 w-full rounded-md border bg-background px-3 text-sm"
            value="${escapeHtml(detailState.pickupRecordRemark)}"
            data-pda-handoverd-field="pickupRecordRemark"
            placeholder="可填写分批说明"
          />
        </div>
      </div>
      <div class="flex justify-end">
        <button
          class="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          data-pda-handoverd-action="submit-pickup-record"
          data-handover-id="${escapeHtml(head.handoverId)}"
        >
          <i data-lucide="plus" class="mr-1.5 h-4 w-4"></i>确认新增领料记录
        </button>
      </div>
      <p class="text-xs text-muted-foreground">领料头完成仅由仓库侧发起，工厂仅维护领料记录与确认。</p>
    `,
          )
        : ''
    }

    ${renderSectionCard(
      '领料记录列表',
      records.length === 0
        ? '<div class="py-4 text-center text-xs text-muted-foreground">暂无领料记录</div>'
        : `<div class="space-y-2">${records.map((record) => renderPickupRecordItem(record, head)).join('')}</div>`,
    )}
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
        <div><span class="text-muted-foreground">物料名称：</span>${escapeHtml(record.materialName || '—')}</div>
        <div><span class="text-muted-foreground">物料规格：</span>${escapeHtml(record.materialSpec || '—')}</div>
        <div><span class="text-muted-foreground">SKU：</span>${escapeHtml(record.skuCode || '—')}</div>
        <div><span class="text-muted-foreground">颜色/尺码：</span>${escapeHtml(record.skuColor || '—')} / ${escapeHtml(record.skuSize || '—')}</div>
        <div><span class="text-muted-foreground">裁片：</span>${escapeHtml(record.pieceName || '—')}</div>
        <div><span class="text-muted-foreground">计划交出：</span>${
          typeof record.plannedQty === 'number'
            ? `${record.plannedQty} ${escapeHtml(record.qtyUnit || '件')}`
            : '—'
        }</div>
        <div><span class="text-muted-foreground">回货单号：</span>${escapeHtml(record.warehouseReturnNo || '待仓库回写')}</div>
        <div><span class="text-muted-foreground">已交数量：</span>${
          typeof record.warehouseWrittenQty === 'number'
            ? `${record.warehouseWrittenQty} ${escapeHtml(record.qtyUnit || '件')}`
            : '待仓库回写'
        }</div>
        <div><span class="text-muted-foreground">剩余数量：</span>${
          typeof record.plannedQty === 'number' && typeof record.warehouseWrittenQty === 'number'
            ? `${Math.max(record.plannedQty - record.warehouseWrittenQty, 0)} ${escapeHtml(record.qtyUnit || '件')}`
            : '待仓库回写'
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
  const isCompleted = head.completionStatus === 'COMPLETED'
  const sourceDoc = getPdaHeadSourceExecutionDoc(head.handoverId)
  const runtimeTask = getPdaHeadRuntimeTask(head.handoverId)

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
        ${renderFieldRow('来源执行单', sourceDoc?.docNo || sourceDoc?.id || '—')}
        ${renderFieldRow('来源类型', sourceDoc?.docType === 'RETURN' ? '工序回货单' : sourceDoc?.docType || '—')}
        ${renderFieldRow('执行范围', head.scopeLabel || '整单')}
        ${renderFieldRow('运行时任务', runtimeTask?.taskId || head.runtimeTaskId || '—')}
      </div>
      <div class="h-px bg-border"></div>
      <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        ${renderFieldRow('累计交出次数', `${head.recordCount} 次`)}
        ${renderFieldRow('待仓库回写', `${head.pendingWritebackCount} 次`)}
        ${renderFieldRow('累计已回写数量', `${head.writtenBackQtyTotal} ${head.qtyUnit}`)}
        ${renderFieldRow('数量异议', `${head.objectionCount} 条`)}
      </div>
      <div class="rounded-md border ${head.qtyDiffTotal !== 0 ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'} px-2.5 py-1.5 text-xs">
        ${head.qtyDiffTotal !== 0 ? `数量有差异（差异 ${head.qtyDiffTotal > 0 ? '-' : '+'}${Math.abs(head.qtyDiffTotal)} ${head.qtyUnit}）` : '数量一致'}
      </div>
      <div class="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs text-blue-700">
        ${isCompleted ? `仓库已发起交出完成：${escapeHtml(head.completedByWarehouseAt || '—')}` : '当前交出头待仓库发起完成，工厂不可主动关闭'}
      </div>
    `,
    )}

    ${
      !isCompleted
        ? renderSectionCard(
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
          )
        : ''
    }

    ${renderSectionCard(
      '交出记录列表',
      records.length === 0
        ? '<div class="py-4 text-center text-xs text-muted-foreground">暂无交出记录，点击上方按钮新增第一条交出记录</div>'
        : `<div class="space-y-2">${records.map((record) => renderHandoutRecordItem(record)).join('')}</div>`,
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

    if (field === 'handoverRecordTime') {
      detailState.handoverRecordTime = fieldNode.value
      return true
    }

    if (field === 'pickupRecordTime') {
      detailState.pickupRecordTime = fieldNode.value
      return true
    }

    if (field === 'pickupRecordMode') {
      detailState.pickupRecordMode =
        fieldNode.value === 'FACTORY_PICKUP' ? 'FACTORY_PICKUP' : 'WAREHOUSE_DELIVERY'
      return true
    }

    if (field === 'pickupRecordMaterialSummary') {
      detailState.pickupRecordMaterialSummary = fieldNode.value
      return true
    }

    if (field === 'pickupRecordQty') {
      detailState.pickupRecordQty = fieldNode.value
      return true
    }

    if (field === 'pickupRecordRemark') {
      detailState.pickupRecordRemark = fieldNode.value
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

  if (action === 'submit-pickup-record') {
    const handoverId = actionNode.dataset.handoverId
    if (!handoverId) return true

    if (!detailState.pickupRecordTime) {
      showPdaHandoverDetailToast('请先填写本次领料时间')
      return true
    }
    if (isFutureLocalDateTime(detailState.pickupRecordTime)) {
      showPdaHandoverDetailToast('本次领料时间不能晚于当前时间')
      return true
    }
    if (!detailState.pickupRecordMaterialSummary.trim()) {
      showPdaHandoverDetailToast('请先填写物料摘要')
      return true
    }
    const qtyExpected = Number(detailState.pickupRecordQty)
    if (!Number.isFinite(qtyExpected) || qtyExpected <= 0) {
      showPdaHandoverDetailToast('请先填写正确的本次数量')
      return true
    }

    const created = createPdaPickupRecord(handoverId, {
      submittedAt: dateTimeLocalInputToTimestamp(detailState.pickupRecordTime),
      pickupMode: detailState.pickupRecordMode,
      materialSummary: detailState.pickupRecordMaterialSummary,
      qtyExpected,
      remark: detailState.pickupRecordRemark,
    })
    if (!created) {
      showPdaHandoverDetailToast('新增领料记录失败，请稍后重试')
      return true
    }

    appendTaskAudit(
      created.taskId,
      'PICKUP_RECORD_CREATE',
      `新增领料记录 ${created.recordId}，第 ${created.sequenceNo} 次领料`,
      'PDA',
    )
    detailState.pickupRecordTime = nowDateTimeLocalInput()
    detailState.pickupRecordMode = 'WAREHOUSE_DELIVERY'
    detailState.pickupRecordMaterialSummary = ''
    detailState.pickupRecordQty = ''
    detailState.pickupRecordRemark = ''
    showPdaHandoverDetailToast(`领料记录已新增：${created.recordId}`)
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
    const updated = confirmPdaPickupRecordReceived(recordId, currentRecord.qtyExpected, nowTimestamp())
    if (!updated) {
      showPdaHandoverDetailToast('当前记录暂不可确认领料')
      return true
    }
    appendTaskAudit(
      updated.taskId,
      'PICKUP_RECORD_CONFIRM',
      `确认领料记录 ${updated.recordId}，实领数量 ${updated.qtyActual ?? updated.qtyExpected}`,
      'PDA',
    )
    showPdaHandoverDetailToast('本次领料已确认')
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

  return false
}
