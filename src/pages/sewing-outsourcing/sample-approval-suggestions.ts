// @page-pattern: list

import { renderStandardListFilters, renderStandardListPage } from '../../components/ui/list-page.ts'
import { renderStandardListTable, type StandardListColumn } from '../../components/ui/list-table.ts'
import type { StandardListColumnPreferences } from '../../components/ui/list-table-model.ts'
import { renderTablePagination } from '../../components/ui/pagination.ts'
import { renderTabs as renderUiTabs } from '../../components/ui/tabs.ts'
import { formatOperationLocalWallClock } from '../../data/fcs/sewing-delivery-sla.ts'
import { ensureSewingOutsourcingSampleDemo } from '../../data/fcs/sewing-outsourcing-demo.ts'
import {
  getSewingSampleApprovalRecord,
  handoffPreProductionSampleToApprover,
  listSewingSampleApprovalRecords,
  receivePreProductionSampleByPpic,
  recordSampleApprovalFeedbackToFactory,
  startSampleApproval,
  submitSampleApprovalSuggestion,
  summarizeSampleApprovalStructuredComments,
  type SampleApprovalStructuredComments,
  type SewingSampleApprovalRecord,
} from '../../data/fcs/sewing-sample-approval-suggestion.ts'
import { escapeHtml } from '../../utils.ts'

type PageRole = 'PPIC' | 'SAMPLE_APPROVER'
type SampleSituation = 'PENDING_RETURN' | 'PENDING_APPROVAL' | 'PENDING_FEEDBACK' | 'COMPLETED'
type ApprovalFormState = SampleApprovalStructuredComments & {
  conclusion: 'NO_PROBLEM' | 'HAS_PROBLEM'
  approvalSheetPhotoUrls: string[]
  requiresAnotherApproval: boolean
}
type DialogState =
  | { kind: 'CARD'; assignmentId: string }
  | { kind: 'RECEIVE'; assignmentId: string; error: string; receivedSamplePhotoUrls: string[] }
  | { kind: 'APPROVAL'; assignmentId: string; error: string; form: ApprovalFormState }
  | { kind: 'IMAGE'; imageUrl: string; label: string }
  | null

let activeRole: PageRole = 'PPIC'
let activeSituation: SampleSituation = 'PENDING_RETURN'
let keyword = ''
let draftKeyword = ''
let activePage = 1
let pageSize = 20
let dialog: DialogState = null
let feedback = ''
let commandSequence = 0

const STATUS_LABELS: Record<string, string> = {
  WAITING_FACTORY_PRODUCTION: '待工厂制作',
  WAITING_RETURN_TO_PPIC: '待送回PPIC',
  PPIC_RECEIVED: 'PPIC已接收',
  HANDED_TO_APPROVER: '待批版人员领取',
  APPROVAL_IN_PROGRESS: '批版中',
  SUGGESTION_UPLOADED: '建议已上传待反馈',
  FEEDBACK_SENT: '已反馈工厂',
}

const TASK_KIND_LABELS: Record<string, string> = {
  INDEPENDENT_SEWING: '独立车缝',
  SEWING_IRON_PACK: '车缝+烫包',
  CUTTING_SEWING_IRON_PACK: '裁剪+车缝+烫包',
}

const SITUATION_LABELS: Record<SampleSituation, string> = {
  PENDING_RETURN: '待样衣送回',
  PENDING_APPROVAL: '待批版',
  PENDING_FEEDBACK: '待反馈工厂',
  COMPLETED: '已完成',
}

const STRUCTURED_COMMENT_FIELDS: Array<{
  key: keyof SampleApprovalStructuredComments
  label: string
  offlineLabel: string
  placeholder: string
}> = [
  {
    key: 'fabricApprovalComment',
    label: '批版面料',
    offlineLabel: 'Persetujuan Kain untuk Sampel',
    placeholder: '记录面料、色差、裁片编号或配套方面的批版意见',
  },
  {
    key: 'processComment',
    label: '工艺意见',
    offlineLabel: 'Catatan Proses/Metode Produksi',
    placeholder: '记录车缝工艺、部位位置、线路及制作方法方面的意见',
  },
  {
    key: 'materialUsageComment',
    label: '用料意见',
    offlineLabel: 'Catatan Pemakaian/Penggunaan Bahan',
    placeholder: '记录面辅料用法、松量、拉伸或安装方面的意见',
  },
  {
    key: 'otherComment',
    label: '其他意见',
    offlineLabel: 'Catatan Lainnya',
    placeholder: '记录前述分类之外、工厂生产大货必须注意的事项',
  },
]

function matchesSituation(record: SewingSampleApprovalRecord, situation: SampleSituation): boolean {
  const status = record.sample.status
  if (situation === 'PENDING_RETURN') return ['WAITING_FACTORY_PRODUCTION', 'WAITING_RETURN_TO_PPIC', 'PPIC_RECEIVED'].includes(status)
  if (situation === 'PENDING_APPROVAL') return ['HANDED_TO_APPROVER', 'APPROVAL_IN_PROGRESS'].includes(status)
  if (situation === 'PENDING_FEEDBACK') return status === 'SUGGESTION_UPLOADED'
  return status === 'FEEDBACK_SENT'
}

function nextCommandId(action: string): string {
  commandSequence += 1
  return `CMD-PPIC-SAMPLE-${action}-${Date.now()}-${commandSequence}`
}

function refreshPage(): void {
  const root = document.querySelector<HTMLElement>('[data-sample-approval-page]')
  if (root) root.outerHTML = renderSampleApprovalSuggestionsPage()
}

export function isSampleApprovalSuggestionDialogOpen(): boolean {
  return dialog !== null
}

export function closeSampleApprovalSuggestionDialog(): boolean {
  if (!dialog) return false
  dialog = null
  refreshPage()
  return true
}

function statusTone(status: string): string {
  if (status === 'FEEDBACK_SENT') return 'bg-emerald-50 text-emerald-700'
  if (status === 'SUGGESTION_UPLOADED') return 'bg-amber-50 text-amber-800'
  if (status === 'APPROVAL_IN_PROGRESS' || status === 'HANDED_TO_APPROVER') return 'bg-blue-50 text-blue-700'
  return 'bg-slate-100 text-slate-700'
}

function renderImageButton(imageUrl: string, label: string, classes = 'h-20 w-16'): string {
  return `<button type="button" class="relative ${classes} shrink-0 overflow-hidden rounded border bg-slate-50" data-sample-approval-action="preview-image" data-image-url="${escapeHtml(imageUrl)}" data-image-label="${escapeHtml(label)}" aria-label="查看${escapeHtml(label)}高清图"><img class="h-full w-full object-cover" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}实拍图" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="absolute inset-0 flex items-center justify-center bg-red-50 px-2 text-center text-xs text-red-700">图片加载失败</span></button>`
}

function samplePhotos(record: SewingSampleApprovalRecord): string[] {
  return record.sample.ppicReceivedSamplePhotoUrls.length
    ? record.sample.ppicReceivedSamplePhotoUrls
    : record.sample.samplePhotoUrls
}

function mergePhotoUrls(current: string[], incoming: string[]): string[] {
  return [...new Set([...current, ...incoming].filter(Boolean))]
}

function renderSamplePhotoGallery(photos: string[], labelPrefix: string, classes = 'h-24 w-20'): string {
  if (!photos.length) return '<div class="rounded border border-dashed p-4 text-center text-xs text-slate-500">暂无照片</div>'
  return `<div class="flex flex-wrap gap-2">${photos.map((photo, index) => renderImageButton(photo, `${labelPrefix}${index + 1}`, classes)).join('')}</div>`
}

function renderEditablePhotoGallery(input: {
  photos: string[]
  assignmentId: string
  labelPrefix: string
  removeAction: 'remove-received-photo' | 'remove-approval-sheet-photo'
  emptyText: string
}): string {
  if (!input.photos.length) {
    return `<div class="rounded border border-dashed p-4 text-center text-xs text-slate-500">${escapeHtml(input.emptyText)}</div>`
  }
  return `<div class="grid grid-cols-2 gap-3 sm:grid-cols-3">${input.photos.map((photo, index) => `<div class="rounded border bg-slate-50 p-2"><div class="flex justify-center">${renderImageButton(photo, `${input.labelPrefix}${index + 1}`, 'h-28 w-full')}</div><button type="button" class="mt-2 w-full rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-700" data-sample-approval-action="${input.removeAction}" data-assignment-id="${escapeHtml(input.assignmentId)}" data-photo-index="${index}">删除第${index + 1}张</button></div>`).join('')}</div>`
}

function readApprovalFormFromDom(fallback: ApprovalFormState): ApprovalFormState {
  const read = (name: string) => document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-sample-approval-field="${name}"]`)?.value.trim()
  return {
    conclusion: read('conclusion') === 'HAS_PROBLEM' ? 'HAS_PROBLEM' : 'NO_PROBLEM',
    fabricApprovalComment: read('fabricApprovalComment') ?? fallback.fabricApprovalComment,
    processComment: read('processComment') ?? fallback.processComment,
    materialUsageComment: read('materialUsageComment') ?? fallback.materialUsageComment,
    otherComment: read('otherComment') ?? fallback.otherComment,
    approvalSheetPhotoUrls: fallback.approvalSheetPhotoUrls,
    requiresAnotherApproval: document.querySelector<HTMLInputElement>('[data-sample-approval-field="requiresAnotherApproval"]')?.checked ?? fallback.requiresAnotherApproval,
  }
}

function renderStructuredCommentRows(comments: SampleApprovalStructuredComments): string {
  return STRUCTURED_COMMENT_FIELDS.map((field) => `<section class="grid gap-2 border-t px-4 py-3 sm:grid-cols-[180px_1fr]"><div><b class="text-sm">${field.label}</b><p class="text-[11px] text-slate-500">${field.offlineLabel}</p></div><p class="whitespace-pre-wrap text-sm ${comments[field.key] ? 'text-slate-800' : 'text-slate-400'}">${escapeHtml(comments[field.key] || '无')}</p></section>`).join('')
}

function renderStructuredCommentInputs(form: ApprovalFormState): string {
  return STRUCTURED_COMMENT_FIELDS.map((field) => `<label class="block rounded border p-3 text-sm"><span class="font-semibold">${field.label}</span><span class="ml-2 text-xs text-slate-500">${field.offlineLabel}</span><textarea class="mt-2 min-h-20 w-full rounded border p-3" data-sample-approval-field="${field.key}" placeholder="${escapeHtml(field.placeholder)}">${escapeHtml(form[field.key])}</textarea></label>`).join('')
}

async function readFilesAsDataUrls(files: File[]): Promise<string[]> {
  return Promise.all(files.map((file) => new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener('load', () => resolve(String(reader.result || '')))
    reader.addEventListener('error', () => reject(new Error(`无法读取照片：${file.name}`)))
    reader.readAsDataURL(file)
  })))
}

function renderRowAction(record: SewingSampleApprovalRecord): string {
  const status = record.sample.status
  const assignmentId = escapeHtml(record.assignmentId)
  const actions = [`<button class="text-blue-700" data-sample-approval-action="show-card" data-assignment-id="${assignmentId}">${record.suggestionVersions.length ? '查看批版建议卡' : '查看样衣与依据'}</button>`]
  if (activeRole === 'PPIC' && status === 'WAITING_RETURN_TO_PPIC') {
    actions.push(`<button class="font-semibold text-blue-700" data-sample-approval-action="receive-sample" data-assignment-id="${assignmentId}">上传样衣照片</button>`)
  }
  if (activeRole === 'PPIC' && status === 'PPIC_RECEIVED') {
    actions.push(`<button class="text-blue-700" data-sample-approval-action="handoff-approver" data-assignment-id="${assignmentId}">转交批版人员</button>`)
  }
  if (activeRole === 'PPIC' && status === 'SUGGESTION_UPLOADED') {
    actions.push(`<button class="font-semibold text-emerald-700" data-sample-approval-action="feedback-factory" data-assignment-id="${assignmentId}">记录已截图反馈</button>`)
  }
  if (activeRole === 'SAMPLE_APPROVER' && status === 'HANDED_TO_APPROVER') {
    actions.push(`<button class="text-blue-700" data-sample-approval-action="start-approval" data-assignment-id="${assignmentId}">领取批版</button>`)
  }
  if (activeRole === 'SAMPLE_APPROVER' && status === 'APPROVAL_IN_PROGRESS') {
    actions.push(`<button class="font-semibold text-blue-700" data-sample-approval-action="open-approval" data-assignment-id="${assignmentId}">填写批版建议</button>`)
  }
  return actions.join('<span class="text-slate-300">·</span>')
}

const columns: StandardListColumn<SewingSampleApprovalRecord>[] = [
  {
    key: 'sample',
    title: '款式／产前版样衣',
    width: 300,
    required: true,
    freezeable: true,
    render: (record) => {
      const photos = samplePhotos(record)
      const visiblePhotos = photos.length ? photos.slice(0, 3) : [record.sample.styleImageUrl]
      return `<div class="flex gap-3"><div class="flex -space-x-3">${visiblePhotos.map((photo, index) => renderImageButton(photo, `${record.sample.styleCode}产前版样衣照片${index + 1}`, 'h-20 w-16')).join('')}</div><div><b>${escapeHtml(record.sample.styleCode)}</b><p class="mt-1 text-xs text-slate-500">${escapeHtml(record.sample.styleName)}</p><p class="mt-1 text-xs">实物：${escapeHtml(record.sample.sampleNo)} · 第${record.sample.roundNo}轮</p><p class="mt-1 text-xs text-blue-700">PPIC实物照片：${record.sample.ppicReceivedSamplePhotoUrls.length}张</p></div></div>`
    },
  },
  {
    key: 'task',
    title: '执行任务',
    width: 240,
    required: true,
    render: (record) => `<b>${escapeHtml(record.sample.taskNo)}</b><p class="mt-1 text-xs text-slate-500">${escapeHtml(record.sample.productionOrderNo)}</p><p class="mt-1 font-mono text-[11px] text-slate-500">${escapeHtml(record.sample.runtimeTaskId)}</p>`,
  },
  {
    key: 'factory',
    title: '工厂／PPIC',
    width: 210,
    required: true,
    render: (record) => `<b>${escapeHtml(record.sample.factoryName)}</b><p class="mt-1 text-xs font-semibold text-blue-700">PPIC：${escapeHtml(record.sample.currentPpicName)}</p>`,
  },
  {
    key: 'kind',
    title: '任务类型',
    width: 170,
    render: (record) => escapeHtml(TASK_KIND_LABELS[record.sample.taskKind] || record.sample.taskKind),
  },
  {
    key: 'status',
    title: '当前节点',
    width: 180,
    required: true,
    render: (record) => `<span class="rounded px-2 py-1 text-xs ${statusTone(record.sample.status)}">${escapeHtml(STATUS_LABELS[record.sample.status] || record.sample.status)}</span>`,
  },
  {
    key: 'suggestion',
    title: '最新批版建议／人员',
    width: 320,
    render: (record) => {
      const suggestion = record.suggestionVersions.at(-1)
      const summary = suggestion ? summarizeSampleApprovalStructuredComments(suggestion.structuredComments) : ''
      return suggestion
        ? `<b class="${suggestion.conclusion === 'NO_PROBLEM' ? 'text-emerald-700' : 'text-amber-800'}">${suggestion.conclusion === 'NO_PROBLEM' ? '无问题' : '有问题'}</b><p class="mt-1 max-w-xs text-xs text-slate-600">${escapeHtml(summary || '按当前产前版样衣和生产资料生产大货')}</p><p class="mt-1 text-[11px] text-slate-500">${escapeHtml(suggestion.uploadedByName)} · ${escapeHtml(suggestion.uploadedAt)}</p>`
        : '<span class="text-slate-400">尚未上传</span>'
    },
  },
  {
    key: 'actions',
    title: '操作',
    width: 260,
    required: true,
    actionColumn: true,
    render: (record) => `<div class="flex flex-wrap justify-end gap-2">${renderRowAction(record)}</div>`,
  },
]

const preferences: StandardListColumnPreferences = {
  order: columns.filter((column) => !column.actionColumn).map((column) => column.key),
  visibleKeys: columns.map((column) => column.key),
  frozenKeys: ['sample'],
  pageSize: 20,
}

function renderSuggestionCard(record: SewingSampleApprovalRecord): string {
  const suggestion = record.suggestionVersions.at(-1)
  const photos = samplePhotos(record)
  const visibleSamplePhotos = photos.length ? photos : [record.sample.styleImageUrl]
  const references = (suggestion?.referenceSnapshots || record.referenceSnapshots).slice(0, 6)
  return `<article class="w-full max-w-5xl overflow-hidden rounded-xl border-2 border-slate-800 bg-white text-slate-900" data-sample-approval-screenshot-card>
    <header class="flex flex-wrap items-start justify-between gap-4 bg-slate-900 p-5 text-white"><div><p class="text-xs text-slate-300">车缝外发协同 · 可截图反馈工厂</p><h2 class="mt-1 text-2xl font-semibold">批版建议</h2></div><div class="text-right text-sm"><p>${escapeHtml(record.sample.productionOrderNo)}</p><p class="mt-1">${escapeHtml(record.sample.taskNo)}</p></div></header>
    <div class="grid gap-5 p-5 lg:grid-cols-[280px_1fr]">
      <section><p class="mb-2 text-xs font-semibold text-slate-600">产前版样衣照片（${visibleSamplePhotos.length}张）</p>${renderSamplePhotoGallery(visibleSamplePhotos, `${record.sample.styleCode}产前版样衣照片`, 'h-36 w-[126px]')}</section>
      <div class="space-y-4">
        <div class="grid gap-2 text-sm sm:grid-cols-2"><p><span class="text-slate-500">SPU：</span><b>${escapeHtml(record.sample.styleCode)}</b> · ${escapeHtml(record.sample.styleName)}</p><p><span class="text-slate-500">PO：</span>${escapeHtml(record.sample.productionOrderNo)}</p><p><span class="text-slate-500">三方车缝工厂：</span>${escapeHtml(record.sample.factoryName)}</p><p><span class="text-slate-500">任务PPIC：</span>${escapeHtml(record.sample.currentPpicName)}</p><p><span class="text-slate-500">任务类型：</span>${escapeHtml(TASK_KIND_LABELS[record.sample.taskKind] || record.sample.taskKind)}</p><p><span class="text-slate-500">批版人员／日期：</span>${suggestion ? `${escapeHtml(suggestion.uploadedByName)} · ${escapeHtml(suggestion.uploadedAt)}` : '待批版'}</p></div>
        ${suggestion ? `<section class="overflow-hidden rounded-lg border"><div class="flex items-center justify-between gap-3 px-4 py-3 ${suggestion.conclusion === 'NO_PROBLEM' ? 'bg-emerald-50' : 'bg-amber-50'}"><div><p class="text-xs text-slate-500">批版结论</p><b class="text-xl ${suggestion.conclusion === 'NO_PROBLEM' ? 'text-emerald-700' : 'text-amber-800'}">${suggestion.conclusion === 'NO_PROBLEM' ? '无问题' : '有问题'}</b></div><span class="text-xs text-slate-500">${escapeHtml(suggestion.suggestionNo)}</span></div>${renderStructuredCommentRows(suggestion.structuredComments)}</section>${suggestion.requiresAnotherApproval ? '<p class="rounded bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">批版人员明确要求下一轮再次批版</p>' : ''}` : '<section class="rounded-lg border border-dashed p-5 text-sm text-slate-500">批版建议尚未上传。当前先核对产前版样衣交接和引用资料。</section>'}
      </div>
    </div>
    ${suggestion?.approvalSheetPhotoUrls.length ? `<section class="border-t p-5"><p class="mb-2 text-xs font-semibold text-slate-600">线下批版单照片（${suggestion.approvalSheetPhotoUrls.length}张）</p>${renderSamplePhotoGallery(suggestion.approvalSheetPhotoUrls, '线下批版单照片', 'h-40 w-32')}</section>` : ''}
    <footer class="border-t bg-slate-50 p-4"><p class="mb-2 text-xs font-semibold text-slate-600">本次批版核对依据</p><div class="flex flex-wrap gap-2">${references.map((item) => `<span class="rounded border bg-white px-2 py-1 text-xs">${escapeHtml(item.label)} · ${escapeHtml(item.versionLabel)}</span>`).join('') || '<span class="text-xs text-red-700">引用资料待补齐</span>'}</div></footer>
  </article>`
}

function renderDialog(): string {
  if (!dialog) return ''
  if (dialog.kind === 'IMAGE') {
    return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(dialog.label)}高清大图"><button class="absolute inset-0" data-sample-approval-action="close-dialog" aria-label="关闭大图"></button><section class="relative z-10 max-h-[92vh] max-w-5xl overflow-auto rounded-lg bg-white p-3"><header class="mb-3 flex items-center justify-between gap-3"><b>${escapeHtml(dialog.label)}</b><button class="rounded border px-3 py-1 text-sm" data-sample-approval-action="close-dialog">关闭</button></header><img class="max-h-[78vh] max-w-full object-contain" src="${escapeHtml(dialog.imageUrl)}" alt="${escapeHtml(dialog.label)}高清实拍图"></section></div>`
  }
  const record = getSewingSampleApprovalRecord(dialog.assignmentId)
  if (!record) return ''
  if (dialog.kind === 'RECEIVE') {
    const factoryPhoto = record.sample.samplePhotoUrls[0] || record.sample.styleImageUrl
    return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="上传产前版样衣照片"><button class="absolute inset-0" data-sample-approval-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 max-h-[92vh] w-full max-w-3xl overflow-auto rounded-lg bg-white shadow-2xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">上传产前版样衣照片</h2><p class="mt-1 text-xs text-slate-500">${escapeHtml(record.sample.factoryName)} · ${escapeHtml(record.sample.taskNo)}</p></header><div class="space-y-4 p-5">${dialog.error ? `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(dialog.error)}</div>` : ''}<div class="flex gap-3 rounded border p-3">${renderImageButton(factoryPhoto, `${record.sample.styleCode}工厂提交照片`, 'h-24 w-20')}<div class="text-sm"><b>${escapeHtml(record.sample.styleCode)} · ${escapeHtml(record.sample.styleName)}</b><p class="mt-1 text-slate-500">PPIC拍摄实际收到的产前版样衣，可一次选择多张，也可分次继续添加。</p></div></div><label class="block rounded border border-blue-200 bg-blue-50 p-3 text-sm font-semibold text-blue-800">选择多张产前版样衣照片<input class="mt-2 block w-full rounded border bg-white p-2 font-normal text-slate-700" type="file" accept="image/*" multiple data-sample-approval-field="receivedSamplePhotos" data-sample-approval-action="select-received-photos" data-assignment-id="${escapeHtml(record.assignmentId)}"></label><div><p class="mb-2 text-sm font-semibold">已选择 ${dialog.receivedSamplePhotoUrls.length} 张</p>${renderEditablePhotoGallery({ photos: dialog.receivedSamplePhotoUrls, assignmentId: record.assignmentId, labelPrefix: '待上传产前版样衣照片', removeAction: 'remove-received-photo', emptyText: '尚未选择照片；至少上传1张后才能确认接收' })}</div></div><footer class="flex justify-end gap-2 border-t p-4"><button class="rounded border px-4 py-2 text-sm" data-sample-approval-action="close-dialog">取消</button><button class="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white" data-sample-approval-action="submit-receive" data-assignment-id="${escapeHtml(record.assignmentId)}">上传${dialog.receivedSamplePhotoUrls.length ? `${dialog.receivedSamplePhotoUrls.length}张并` : '并'}确认接收</button></footer></section></div>`
  }
  if (dialog.kind === 'CARD') {
    return `<div class="fixed inset-0 z-50 overflow-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-label="批版建议截图卡"><button class="fixed inset-0" data-sample-approval-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 mx-auto my-4 w-fit max-w-full"><div class="mb-3 flex justify-end"><button class="rounded bg-white px-4 py-2 text-sm" data-sample-approval-action="close-dialog">关闭</button></div>${renderSuggestionCard(record)}</section></div>`
  }
  const form = dialog.form
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="dialog" aria-modal="true" aria-label="填写批版建议"><button class="absolute inset-0" data-sample-approval-action="close-dialog" aria-label="关闭"></button><section class="relative z-10 max-h-[94vh] w-full max-w-4xl overflow-auto rounded-lg bg-white shadow-2xl"><header class="border-b p-5"><h2 class="text-lg font-semibold">填写批版建议</h2><p class="mt-1 text-xs text-slate-500">字段与线下批版单一致；实物仍叫“产前版样衣”，本次业务动作和系统记录叫“批版建议”。</p></header><div class="space-y-4 p-5">${dialog.error ? `<div class="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(dialog.error)}</div>` : ''}<section class="grid gap-3 rounded border bg-slate-50 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3"><p><span class="text-slate-500">SPU：</span><b>${escapeHtml(record.sample.styleCode)}</b></p><p><span class="text-slate-500">PO：</span><b>${escapeHtml(record.sample.productionOrderNo)}</b></p><p><span class="text-slate-500">三方车缝工厂：</span><b>${escapeHtml(record.sample.factoryName)}</b></p><p><span class="text-slate-500">产前版样衣照片：</span>${samplePhotos(record).length}张</p><p><span class="text-slate-500">批版人员：</span><b>${escapeHtml(record.currentApproverName || '当前领取人')}</b></p><p><span class="text-slate-500">批版日期：</span>提交时自动记录</p></section><label class="block text-sm font-semibold">批版结论<select class="mt-1 h-10 w-full rounded border px-3 font-normal" data-sample-approval-field="conclusion"><option value="NO_PROBLEM"${form.conclusion === 'NO_PROBLEM' ? ' selected' : ''}>无问题</option><option value="HAS_PROBLEM"${form.conclusion === 'HAS_PROBLEM' ? ' selected' : ''}>有问题</option></select><span class="mt-1 block text-xs font-normal text-slate-500">选择“有问题”时，下面四类意见至少填写一项。</span></label><section class="space-y-3"><h3 class="text-sm font-semibold">结构化批版意见</h3>${renderStructuredCommentInputs(form)}</section><section class="space-y-3 rounded border p-4"><div><h3 class="text-sm font-semibold">线下批版单照片</h3><p class="mt-1 text-xs text-slate-500">用于保留现场手写单据、签名与日期佐证；可一次选择多张，也可分次添加。</p></div><input class="block w-full rounded border p-2 text-sm" type="file" accept="image/*" multiple data-sample-approval-field="approvalSheetPhotos" data-sample-approval-action="select-approval-sheet-photos" data-assignment-id="${escapeHtml(record.assignmentId)}">${renderEditablePhotoGallery({ photos: form.approvalSheetPhotoUrls, assignmentId: record.assignmentId, labelPrefix: '线下批版单照片', removeAction: 'remove-approval-sheet-photo', emptyText: '暂未上传线下批版单照片（结构化意见仍会作为正式系统记录）' })}</section><label class="flex items-start gap-2 rounded border p-3 text-sm"><input class="mt-1" type="checkbox" data-sample-approval-field="requiresAnotherApproval"${form.requiresAnotherApproval ? ' checked' : ''}><span>明确要求工厂再做一件并进入下一轮批版（不能仅因“有问题”自动勾选）</span></label></div><footer class="flex justify-end gap-2 border-t p-4"><button class="rounded border px-4 py-2 text-sm" data-sample-approval-action="close-dialog">取消</button><button class="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white" data-sample-approval-action="submit-approval" data-assignment-id="${escapeHtml(record.assignmentId)}">提交批版建议</button></footer></section></div>`
}

export function renderSampleApprovalSuggestionsPage(): string {
  ensureSewingOutsourcingSampleDemo()
  const allRecords = listSewingSampleApprovalRecords().filter((item) => item.assignmentId.startsWith('ASG-PPIC-SAMPLE-DEMO'))
  const normalizedKeyword = keyword.trim().toLowerCase()
  const filteredRecords = allRecords
    .filter((item) => matchesSituation(item, activeSituation))
    .filter((item) => !normalizedKeyword || [
      item.sample.styleCode,
      item.sample.styleName,
      item.sample.productionOrderNo,
      item.sample.taskNo,
      item.sample.factoryName,
      item.sample.currentPpicName,
    ].some((value) => value.toLowerCase().includes(normalizedKeyword)))
  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize))
  activePage = Math.min(Math.max(1, activePage), totalPages)
  const start = (activePage - 1) * pageSize
  const records = filteredRecords.slice(start, start + pageSize)
  return `<div data-sample-approval-page data-skip-page-rerender="true">${renderStandardListPage({
    title: '批版建议',
    primaryActionsHtml: `<div class="flex rounded border bg-white p-1"><button class="rounded px-3 py-2 text-sm ${activeRole === 'PPIC' ? 'bg-blue-600 text-white' : ''}" data-sample-approval-action="switch-role" data-role="PPIC">PPIC视角</button><button class="rounded px-3 py-2 text-sm ${activeRole === 'SAMPLE_APPROVER' ? 'bg-blue-600 text-white' : ''}" data-sample-approval-action="switch-role" data-role="SAMPLE_APPROVER">批版人员视角</button></div>`,
    statusTabsHtml: renderUiTabs({
      tabs: (Object.keys(SITUATION_LABELS) as SampleSituation[]).map((situation) => ({ key: situation, label: SITUATION_LABELS[situation], count: allRecords.filter((item) => matchesSituation(item, situation)).length })),
      activeKey: activeSituation,
      variant: 'pills',
      prefix: 'sample-approval',
      action: 'switch-tab',
      fullWidth: true,
    }),
    filtersHtml: renderStandardListFilters({
      actionPrefix: 'sample-approval',
      fieldsHtml: `<input class="h-9 min-w-80 rounded border px-3 text-sm" placeholder="SPU / PO / 执行任务 / 工厂 / PPIC" value="${escapeHtml(draftKeyword)}" data-sample-approval-filter="keyword">`,
    }),
    listTitle: `${SITUATION_LABELS[activeSituation]}的产前版样衣`,
    tableHtml: renderStandardListTable({ columns, rows: records, preferences: { ...preferences, pageSize }, sort: null, eventPrefix: 'sample-approval', emptyText: '当前状态下没有待处理的产前版样衣' }),
    paginationHtml: renderTablePagination({ total: filteredRecords.length, from: filteredRecords.length ? start + 1 : 0, to: Math.min(start + pageSize, filteredRecords.length), currentPage: activePage, totalPages, pageSize, actionPrefix: 'sample-approval', fieldPrefix: 'sample-approval', pageSizeOptions: [20, 50] }),
    overlaysHtml: renderDialog(),
  })}</div>`
}

function actorFor(record: SewingSampleApprovalRecord) {
  return activeRole === 'PPIC'
    ? { actorId: record.sample.currentPpicId, actorName: record.sample.currentPpicName, role: 'PPIC' as const }
    : { actorId: 'SAMPLE-APPROVER-DEMO-001', actorName: '批版人员 林慧', role: 'SAMPLE_APPROVER' as const }
}

export async function handleSampleApprovalSuggestionsEvent(target: HTMLElement, event?: Event): Promise<boolean> {
  const listFilter = target.closest<HTMLInputElement>('[data-sample-approval-filter="keyword"]')
  if (listFilter && !dialog) {
    draftKeyword = listFilter.value
    return true
  }
  const pageSizeField = target.closest<HTMLSelectElement>('[data-sample-approval-field="pageSize"]')
  if (pageSizeField && !dialog) {
    pageSize = Number(pageSizeField.value) || 20
    activePage = 1
    refreshPage()
    return true
  }
  const node = target.closest<HTMLElement>('[data-sample-approval-action]')
  const action = node?.dataset.sampleApprovalAction
  if (!node || !action) return false
  if (
    (action === 'select-received-photos' || action === 'select-approval-sheet-photos')
    && event?.type !== 'change'
  ) return false
  if (action === 'switch-role') {
    activeRole = node.dataset.role === 'SAMPLE_APPROVER' ? 'SAMPLE_APPROVER' : 'PPIC'
    activePage = 1
    feedback = ''
    refreshPage()
    return true
  }
  if (action.startsWith('switch-tab:')) {
    activeSituation = action.slice('switch-tab:'.length) as SampleSituation
    activePage = 1
    feedback = ''
    refreshPage()
    return true
  }
  if (action === 'query') {
    keyword = draftKeyword
    activePage = 1
    feedback = ''
    refreshPage()
    return true
  }
  if (action === 'reset') {
    keyword = ''
    draftKeyword = ''
    activePage = 1
    feedback = ''
    refreshPage()
    return true
  }
  if (action === 'preview-image') {
    dialog = { kind: 'IMAGE', imageUrl: node.dataset.imageUrl || '', label: node.dataset.imageLabel || '图片' }
    refreshPage()
    return true
  }
  if (action === 'close-dialog') {
    dialog = null
    refreshPage()
    return true
  }
  if (action === 'prev-page') {
    activePage = Math.max(1, activePage - 1)
    refreshPage()
    return true
  }
  if (action === 'next-page') {
    activePage += 1
    refreshPage()
    return true
  }
  const assignmentId = node.dataset.assignmentId || ''
  const record = getSewingSampleApprovalRecord(assignmentId)
  if (!record) return false
  if (action === 'show-card') {
    dialog = { kind: 'CARD', assignmentId }
    refreshPage()
    return true
  }
  try {
    const actor = actorFor(record)
    const now = formatOperationLocalWallClock()
    if (action === 'receive-sample') {
      dialog = { kind: 'RECEIVE', assignmentId, error: '', receivedSamplePhotoUrls: [] }
    } else if (action === 'select-received-photos' && dialog?.kind === 'RECEIVE') {
      const files = [...((node as HTMLInputElement).files || [])]
      const selectedPhotoUrls = await readFilesAsDataUrls(files)
      dialog = {
        ...dialog,
        error: '',
        receivedSamplePhotoUrls: mergePhotoUrls(dialog.receivedSamplePhotoUrls, selectedPhotoUrls),
      }
    } else if (action === 'remove-received-photo' && dialog?.kind === 'RECEIVE') {
      const photoIndex = Number(node.dataset.photoIndex)
      dialog = {
        ...dialog,
        error: '',
        receivedSamplePhotoUrls: dialog.receivedSamplePhotoUrls.filter((_, index) => index !== photoIndex),
      }
    } else if (action === 'submit-receive' && dialog?.kind === 'RECEIVE') {
      event?.preventDefault()
      const receivedSamplePhotoUrls = dialog.receivedSamplePhotoUrls
      receivePreProductionSampleByPpic({ commandId: nextCommandId('RECEIVE'), assignmentId, actor, receivedSamplePhotoUrls, receivedAt: now })
      feedback = `已上传${receivedSamplePhotoUrls.length}张产前版样衣实物照片并确认接收。`
      dialog = null
    } else if (action === 'handoff-approver') {
      handoffPreProductionSampleToApprover({ commandId: nextCommandId('HANDOFF'), assignmentId, actor, approverTeamName: '大货批版组', handedAt: now })
      feedback = '已记录样衣转交批版人员。'
    } else if (action === 'start-approval') {
      startSampleApproval({ commandId: nextCommandId('START'), assignmentId, actor })
      feedback = ''
    } else if (action === 'open-approval') {
      dialog = {
        kind: 'APPROVAL',
        assignmentId,
        error: '',
        form: {
          conclusion: 'NO_PROBLEM',
          fabricApprovalComment: '',
          processComment: '',
          materialUsageComment: '',
          otherComment: '',
          approvalSheetPhotoUrls: [],
          requiresAnotherApproval: false,
        },
      }
    } else if (action === 'select-approval-sheet-photos' && dialog?.kind === 'APPROVAL') {
      const currentForm = readApprovalFormFromDom(dialog.form)
      const files = [...((node as HTMLInputElement).files || [])]
      const selectedPhotoUrls = await readFilesAsDataUrls(files)
      dialog = {
        ...dialog,
        error: '',
        form: {
          ...currentForm,
          approvalSheetPhotoUrls: mergePhotoUrls(currentForm.approvalSheetPhotoUrls, selectedPhotoUrls),
        },
      }
    } else if (action === 'remove-approval-sheet-photo' && dialog?.kind === 'APPROVAL') {
      const currentForm = readApprovalFormFromDom(dialog.form)
      const photoIndex = Number(node.dataset.photoIndex)
      dialog = {
        ...dialog,
        error: '',
        form: {
          ...currentForm,
          approvalSheetPhotoUrls: currentForm.approvalSheetPhotoUrls.filter((_, index) => index !== photoIndex),
        },
      }
    } else if (action === 'feedback-factory') {
      recordSampleApprovalFeedbackToFactory({ commandId: nextCommandId('FEEDBACK'), assignmentId, actor, feedbackAt: now, feedbackNote: '已从系统截取批版建议卡并反馈给承接工厂生产负责人。' })
      feedback = '已记录PPIC截图反馈工厂的时间和责任人。'
    } else if (action === 'submit-approval' && dialog?.kind === 'APPROVAL') {
      event?.preventDefault()
      const form = readApprovalFormFromDom(dialog.form)
      submitSampleApprovalSuggestion({
        commandId: nextCommandId('SUBMIT'),
        assignmentId,
        actor,
        conclusion: form.conclusion,
        structuredComments: {
          fabricApprovalComment: form.fabricApprovalComment,
          processComment: form.processComment,
          materialUsageComment: form.materialUsageComment,
          otherComment: form.otherComment,
        },
        approvalSheetPhotoUrls: form.approvalSheetPhotoUrls,
        requiresAnotherApproval: form.requiresAnotherApproval,
        uploadedAt: now,
      })
      feedback = '批版建议已形成新版本，等待PPIC截图反馈工厂。'
      dialog = null
    } else {
      return false
    }
  } catch (error) {
    if (dialog?.kind === 'RECEIVE') {
      dialog = { ...dialog, error: error instanceof Error ? error.message : '照片上传失败' }
    }
    else if (dialog?.kind === 'APPROVAL') {
      dialog = {
        ...dialog,
        error: error instanceof Error ? error.message : '操作失败',
        form: readApprovalFormFromDom(dialog.form),
      }
    }
    else feedback = error instanceof Error ? error.message : '操作失败'
  }
  refreshPage()
  return true
}
