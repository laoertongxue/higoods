// @page-pattern: list
import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../components/ui/list-table-model.ts'
import { buildUnifiedPrintPreviewLink } from '../data/fcs/print-service.ts'
import {
  appendGarmentIdentityMigrationAudits,
  buildGarmentReplacementPreview,
  completePostFactoryRelabel,
  createGarmentSpuReplacement,
  getGarmentSpuReplacement,
  listGarmentSpuReplacements,
  type GarmentSpuReplacementLine,
  type GarmentSpuReplacementRecord,
} from '../data/fcs/garment-spu-replacement.ts'
import { listPostFinishingIdentityMigrationCandidates } from '../data/fcs/post-finishing-domain.ts'
import { escapeHtml } from '../utils.ts'

type EntryMode = 'POST_FINISHING' | 'WLS'

interface GarmentReplacementPageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | GarmentSpuReplacementRecord['status']
  entryMode: EntryMode
  overlay: null | { kind: 'create' } | { kind: 'detail'; replacementId: string }
  imagePreview: null | { url: string; label: string }
  feedback: string
  feedbackOk: boolean
  overlayError: string
}

const EVENT_PREFIX = 'garment-spu-replacement'
const ROOT_SELECTOR = '[data-garment-spu-replacement-root]'
const state: GarmentReplacementPageState = {
  currentPage: 1,
  sort: null,
  preferences: { order: [], visibleKeys: [], frozenKeys: [], pageSize: 10 },
  preferencesLoaded: false,
  showColumnSettings: false,
  keyword: '',
  status: '',
  entryMode: 'POST_FINISHING',
  overlay: null,
  imagePreview: null,
  feedback: '',
  feedbackOk: true,
  overlayError: '',
}

function formatQty(value: number): string {
  return `${value.toLocaleString('zh-CN')} 件`
}

function renderTargetSku(line: GarmentSpuReplacementLine): string {
  if (!line.replacementRequired) return '<span class="text-xs text-slate-500">仅 A 类历史，无需目标 SKU</span>'
  return `<div class="flex items-center gap-2">${renderBusinessImage(line.target.imageUrl, `${line.target.spuName} ${line.target.color}/${line.target.size}`, 'h-10 w-10')}<strong>${escapeHtml(line.target.skuCode)}</strong></div>`
}

function renderStatus(status: GarmentSpuReplacementRecord['status']): string {
  return status === 'COMPLETED'
    ? '<span class="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">已完成</span>'
    : '<span class="rounded-full bg-amber-50 px-2 py-1 text-xs font-medium text-amber-800">换码中</span>'
}

function renderBusinessImage(url: string, label: string, sizeClass = 'h-12 w-12'): string {
  return `<button type="button" class="group relative shrink-0 rounded-md border bg-slate-50" data-garment-spu-replacement-action="open-image" data-image-url="${escapeHtml(url)}" data-image-label="${escapeHtml(label)}" data-skip-page-rerender="true"><img src="${escapeHtml(url)}" alt="${escapeHtml(label)}" class="${sizeClass} rounded-md object-cover" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="flex ${sizeClass} items-center justify-center p-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`
}

function renderEvidenceCell(record: GarmentSpuReplacementRecord): string {
  if (!record.evidence.length) return '<span class="text-xs text-slate-500">未上传截图（非必填）</span>'
  return `<div class="space-y-2">${record.evidence.map((item) => `<div class="flex items-center gap-2">${item.imageUrl ? renderBusinessImage(item.imageUrl, `现场截图 ${item.fileName}`, 'h-12 w-16') : ''}<div><div class="text-xs font-medium">${escapeHtml(item.fileName)}</div><div class="text-[11px] text-slate-500">${escapeHtml(item.uploadedBy)} · ${escapeHtml(item.uploadedAt)}</div></div></div>`).join('')}</div>`
}

function renderEvidenceSection(record: GarmentSpuReplacementRecord): string {
  return `<section class="rounded-lg border p-4"><h3 class="font-semibold">现场截图</h3><p class="mt-1 text-xs text-slate-500">截图非必填；已上传图片可点击查看原图，用于后续追溯。</p><div class="mt-3">${renderEvidenceCell(record)}</div></section>`
}

function appendDetailEvidence(dialogHtml: string): string {
  if (state.overlay?.kind !== 'detail') return dialogHtml
  const record = getGarmentSpuReplacement(state.overlay.replacementId)
  if (!record) return dialogHtml
  const marker = '</div></section></div>'
  const markerIndex = dialogHtml.lastIndexOf(marker)
  if (markerIndex < 0) return dialogHtml
  return `${dialogHtml.slice(0, markerIndex)}${renderEvidenceSection(record)}${dialogHtml.slice(markerIndex)}`
}

function filteredRows(): GarmentSpuReplacementRecord[] {
  const keyword = state.keyword.trim().toLowerCase()
  return listGarmentSpuReplacements().filter((record) => {
    if (state.status && record.status !== state.status) return false
    if (!keyword) return true
    return [record.replacementNo, record.productionOrderNo, record.sourceSpuCode, record.targetSpuCode, record.sourceColor, record.reason]
      .some((value) => value.toLowerCase().includes(keyword))
  })
}

const columns: StandardListColumn<GarmentSpuReplacementRecord>[] = [
  {
    key: 'replacement', title: '替换单／生产单', width: 210, required: true, freezeable: true, sortable: true,
    sortValue: (row) => row.replacementNo,
    render: (row) => `<strong>${escapeHtml(row.replacementNo)}</strong><div class="mt-1 text-xs text-slate-500">${escapeHtml(row.productionOrderNo)}</div><div class="text-xs text-slate-500">${escapeHtml(row.createdAt)} · ${escapeHtml(row.createdBy)}</div>`,
  },
  {
    key: 'identity', title: '源商品 → 目标商品', width: 340, required: true,
    render: (row) => {
      const target = row.lines[0]?.target
      return `<div class="flex items-center gap-3">${target ? renderBusinessImage(target.imageUrl, `${target.spuName} ${target.color} 商品图`) : ''}<div><div class="text-xs text-slate-500">${escapeHtml(row.sourceSpuCode)} · ${escapeHtml(row.sourceColor)}</div><div class="my-1 text-xs text-blue-700">↓ 整色替换并同步 SKU</div><strong>${escapeHtml(row.targetSpuCode)} · ${escapeHtml(row.targetColor)}</strong><div class="text-xs text-slate-500">${escapeHtml(row.targetSpuName)}</div></div></div>`
    },
  },
  {
    key: 'quantity', title: 'A / B / C / D 数量', width: 300, sortable: true,
    sortValue: (row) => row.originalDemandQty,
    render: (row) => {
      const total = (key: 'soldHistoryQty' | 'finishedWarehouseQty' | 'postFactoryQty' | 'remainingReturnQty') => row.lines.reduce((sum, line) => sum + line[key], 0)
      return `<div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs"><span>A 已售历史</span><strong>${formatQty(total('soldHistoryQty'))}</strong><span>B 成衣仓未售</span><strong>${formatQty(total('finishedWarehouseQty'))}</strong><span>C 后道厂未售</span><strong>${formatQty(total('postFactoryQty'))}</strong><span>D 剩余待回货</span><strong>${formatQty(total('remainingReturnQty'))}</strong></div><div class="mt-2 border-t pt-1 text-xs">生产单原数量：<strong>${formatQty(row.originalDemandQty)}</strong></div>`
    },
  },
  {
    key: 'progress', title: '换码进度', width: 190,
    render: (row) => {
      const cTotal = row.lines.reduce((sum, line) => sum + line.postFactoryQty, 0)
      const cDone = row.lines.reduce((sum, line) => sum + line.postRelabeledQty, 0)
      return `${renderStatus(row.status)}<div class="mt-2 text-xs">后道 C 类：${formatQty(cDone)} / ${formatQty(cTotal)}</div><div class="mt-1 text-xs text-slate-500">成衣仓 B 类进入统一换码任务</div>`
    },
  },
  {
    key: 'evidence', title: '原因／截图', width: 260,
    render: (row) => `<div class="text-sm">${escapeHtml(row.reason)}</div><div class="mt-2">${renderEvidenceCell(row)}</div>`,
  },
  {
    key: 'actions', title: '操作', width: 230, required: true, actionColumn: true,
    render: (row) => `<div class="flex flex-wrap gap-1.5"><button type="button" class="rounded-md border px-2 py-1 text-xs" data-garment-spu-replacement-action="open-detail" data-replacement-id="${escapeHtml(row.replacementId)}" data-skip-page-rerender="true">详情</button><a class="rounded-md bg-blue-600 px-2 py-1 text-xs text-white" href="${escapeHtml(buildUnifiedPrintPreviewLink({ documentType: 'GARMENT_SKU_BARCODE', sourceType: 'PRODUCTION_ORDER', sourceId: row.productionOrderId }))}" data-nav="${escapeHtml(buildUnifiedPrintPreviewLink({ documentType: 'GARMENT_SKU_BARCODE', sourceType: 'PRODUCTION_ORDER', sourceId: row.productionOrderId }))}">打印新条码</a><a class="rounded-md bg-amber-500 px-2 py-1 text-xs text-white" href="${escapeHtml(buildUnifiedPrintPreviewLink({ documentType: 'GARMENT_HANGTAG', sourceType: 'PRODUCTION_ORDER', sourceId: row.productionOrderId }))}" data-nav="${escapeHtml(buildUnifiedPrintPreviewLink({ documentType: 'GARMENT_HANGTAG', sourceType: 'PRODUCTION_ORDER', sourceId: row.productionOrderId }))}">打印新吊牌</a></div>`,
  },
]

const controller = createProcessOrderListController({
  state,
  columns,
  preferenceKey: 'higood:list:garment-spu-replacements',
  pageSizeOptions: [10, 20, 50],
  eventPrefix: EVENT_PREFIX,
  rootSelector: ROOT_SELECTOR,
  tableSurfaceSelector: '[data-garment-spu-replacement-table]',
  paginationSurfaceSelector: '[data-garment-spu-replacement-pagination]',
  overlaysSurfaceSelector: '[data-garment-spu-replacement-column-settings]',
  defaultFrozenKeys: ['replacement'],
  columnSettingsTitle: '成衣 SPU 替换列设置',
  emptyText: '暂无成衣 SPU 替换记录',
  getRows: filteredRows,
  locallyManagedEvents: true,
})

function renderFilters(): string {
  return `<div class="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3"><label class="min-w-[18rem] flex-1"><span class="mb-1 block text-xs text-slate-500">替换单／生产单／SPU／颜色／原因</span><input class="h-9 w-full rounded-md border px-3 text-sm" value="${escapeHtml(state.keyword)}" data-garment-spu-replacement-field="keyword" data-skip-page-rerender="true"></label><label class="min-w-40"><span class="mb-1 block text-xs text-slate-500">状态</span><select class="h-9 w-full rounded-md border bg-white px-3 text-sm" data-garment-spu-replacement-field="status" data-skip-page-rerender="true"><option value="">全部</option><option value="RELABELING" ${state.status === 'RELABELING' ? 'selected' : ''}>换码中</option><option value="COMPLETED" ${state.status === 'COMPLETED' ? 'selected' : ''}>已完成</option></select></label><button class="h-9 rounded-md bg-blue-600 px-4 text-sm text-white" data-garment-spu-replacement-action="apply-filters" data-skip-page-rerender="true">查询</button><button class="h-9 rounded-md border px-4 text-sm" data-garment-spu-replacement-action="reset-filters" data-skip-page-rerender="true">重置</button></div>`
}

function renderCreateDialog(): string {
  if (state.overlay?.kind !== 'create') return ''
  let preview: ReturnType<typeof buildGarmentReplacementPreview> | null = null
  let previewError = ''
  try {
    preview = buildGarmentReplacementPreview({ productionOrderId: 'PO-202603-0001', sourceColor: 'White', targetSpuCode: 'SPU-2024-015', targetColor: 'White' })
  } catch (error) {
    previewError = error instanceof Error ? error.message : String(error)
  }
  return `<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true"><section class="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header class="sticky top-0 z-10 flex items-start justify-between border-b bg-white px-5 py-4"><div><h2 class="text-lg font-semibold">发起成衣整色 SPU 替换</h2><p class="mt-1 text-sm text-slate-500">范围固定为“生产单＋源颜色”；目标 SPU/SKU 只能从商品中心现有有效档案选择。</p></div><button class="rounded-md border px-3 py-1.5 text-sm" data-garment-spu-replacement-action="close-overlay" data-skip-page-rerender="true">关闭</button></header><div class="space-y-4 p-5">${state.overlayError ? `<div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">未保存：${escapeHtml(state.overlayError)}</div>` : ''}${previewError ? `<div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(previewError)}</div>` : ''}<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><label><span class="mb-1 block text-xs text-slate-500">生产单</span><input class="h-9 w-full rounded-md border bg-slate-50 px-3" value="PO-202603-0001" data-garment-spu-replacement-field="productionOrderId" readonly></label><label><span class="mb-1 block text-xs text-slate-500">源颜色</span><input class="h-9 w-full rounded-md border bg-slate-50 px-3" value="White" data-garment-spu-replacement-field="sourceColor" readonly></label><label><span class="mb-1 block text-xs text-slate-500">目标 SPU（商品中心）</span><select class="h-9 w-full rounded-md border bg-white px-3" data-garment-spu-replacement-field="targetSpuCode"><option value="SPU-2024-015">SPU-2024-015 · Kemeja Linen Pria</option></select></label><label><span class="mb-1 block text-xs text-slate-500">目标颜色</span><select class="h-9 w-full rounded-md border bg-white px-3" data-garment-spu-replacement-field="targetColor"><option value="White">White</option></select></label></div>${preview ? `<div class="overflow-x-auto rounded-lg border"><table class="w-full min-w-[1050px] text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="p-3">尺码</th><th class="p-3">源 SKU</th><th class="p-3">唯一目标 SKU</th><th class="p-3 text-right">A 已售历史</th><th class="p-3 text-right">B 成衣仓</th><th class="p-3 text-right">C 后道厂</th><th class="p-3 text-right">D 待回货</th><th class="p-3 text-right">原数量</th></tr></thead><tbody>${preview.lines.map((line) => `<tr class="border-t"><td class="p-3 font-semibold">${escapeHtml(line.size)}</td><td class="p-3">${escapeHtml(line.source.skuCode)}</td><td class="p-3">${renderTargetSku(line)}</td><td class="p-3 text-right">${formatQty(line.soldHistoryQty)}</td><td class="p-3 text-right">${formatQty(line.finishedWarehouseQty)}</td><td class="p-3 text-right">${formatQty(line.postFactoryQty)}</td><td class="p-3 text-right">${formatQty(line.remainingReturnQty)}</td><td class="p-3 text-right font-semibold">${formatQty(line.originalDemandQty)}</td></tr>`).join('')}</tbody><tfoot class="border-t bg-blue-50 font-semibold"><tr><td class="p-3" colspan="3">整色合计</td><td class="p-3 text-right">${formatQty(preview.totals.soldHistoryQty)}</td><td class="p-3 text-right">${formatQty(preview.totals.finishedWarehouseQty)}</td><td class="p-3 text-right">${formatQty(preview.totals.postFactoryQty)}</td><td class="p-3 text-right">${formatQty(preview.totals.remainingReturnQty)}</td><td class="p-3 text-right">${formatQty(preview.totals.originalDemandQty)}</td></tr></tfoot></table></div>` : ''}<label class="block"><span class="mb-1 block text-xs text-slate-500">替换原因（必填）</span><textarea class="min-h-20 w-full rounded-md border p-3" data-garment-spu-replacement-field="reason" placeholder="说明整色质量问题和替换原因"></textarea></label><label class="block"><span class="mb-1 block text-xs text-slate-500">现场截图（非必填）</span><input type="file" accept="image/*" class="block w-full rounded-md border p-2 text-sm" data-garment-spu-replacement-field="evidence"><span class="mt-1 block text-xs text-slate-500">可用于后续追溯；不上传不阻断发起。</span></label><div class="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">确认后：A 类保留原身份；B 类进入成衣仓换码任务；C 类先打印新条码和新吊牌并完成换码；D 类后续回货使用目标 SKU。原生产需求、工厂归属和结算身份不变。</div></div><footer class="sticky bottom-0 flex justify-end gap-2 border-t bg-white px-5 py-4"><button class="rounded-md border px-4 py-2 text-sm" data-garment-spu-replacement-action="close-overlay" data-skip-page-rerender="true">取消</button><button class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white" data-garment-spu-replacement-action="create" data-skip-page-rerender="true" ${preview ? '' : 'disabled'}>确认发起整色替换</button></footer></section></div>`
}

function renderDetailDialog(): string {
  if (state.overlay?.kind !== 'detail') return ''
  const record = getGarmentSpuReplacement(state.overlay.replacementId)
  if (!record) return ''
  const postTotal = record.lines.reduce((sum, line) => sum + line.postFactoryQty, 0)
  const postDone = record.lines.reduce((sum, line) => sum + line.postRelabeledQty, 0)
  const barcodeHref = buildUnifiedPrintPreviewLink({ documentType: 'GARMENT_SKU_BARCODE', sourceType: 'PRODUCTION_ORDER', sourceId: record.productionOrderId })
  const hangtagHref = buildUnifiedPrintPreviewLink({ documentType: 'GARMENT_HANGTAG', sourceType: 'PRODUCTION_ORDER', sourceId: record.productionOrderId })
  return `<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true"><section class="max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header class="sticky top-0 z-10 flex items-start justify-between border-b bg-white px-5 py-4"><div><h2 class="text-lg font-semibold">${escapeHtml(record.replacementNo)}</h2><p class="mt-1 text-sm text-slate-500">${escapeHtml(record.productionOrderNo)} · ${escapeHtml(record.sourceSpuCode)} ${escapeHtml(record.sourceColor)} → ${escapeHtml(record.targetSpuCode)} ${escapeHtml(record.targetColor)}</p></div><button class="rounded-md border px-3 py-1.5 text-sm" data-garment-spu-replacement-action="close-overlay" data-skip-page-rerender="true">关闭</button></header><div class="space-y-4 p-5"><div class="grid gap-3 md:grid-cols-4"><div class="rounded-lg border p-3"><span class="text-xs text-slate-500">状态</span><div class="mt-2">${renderStatus(record.status)}</div></div><div class="rounded-lg border p-3"><span class="text-xs text-slate-500">生产单原数量</span><strong class="mt-2 block">${formatQty(record.originalDemandQty)}</strong></div><div class="rounded-lg border p-3"><span class="text-xs text-slate-500">后道 C 类换码</span><strong class="mt-2 block">${formatQty(postDone)} / ${formatQty(postTotal)}</strong></div><div class="rounded-lg border p-3"><span class="text-xs text-slate-500">瑕疵身份迁移</span><strong class="mt-2 block">${record.migrationAudits.length} 条</strong></div></div><div class="flex flex-wrap gap-2"><a class="rounded-md bg-blue-600 px-3 py-2 text-sm text-white" href="${escapeHtml(barcodeHref)}" data-nav="${escapeHtml(barcodeHref)}">打印新条码</a><a class="rounded-md bg-amber-500 px-3 py-2 text-sm text-white" href="${escapeHtml(hangtagHref)}" data-nav="${escapeHtml(hangtagHref)}">打印新吊牌</a>${postDone < postTotal ? `<button class="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white" data-garment-spu-replacement-action="complete-post" data-replacement-id="${escapeHtml(record.replacementId)}" data-skip-page-rerender="true">确认后道 C 类已全部换码</button>` : '<span class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">后道 C 类已换码，可继续交出</span>'}</div><div class="overflow-x-auto rounded-lg border"><table class="w-full min-w-[1080px] text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="p-3">尺码／图片</th><th class="p-3">原 SKU</th><th class="p-3">当前目标 SKU</th><th class="p-3 text-right">A</th><th class="p-3 text-right">B</th><th class="p-3 text-right">C</th><th class="p-3 text-right">D</th><th class="p-3">后道进度</th></tr></thead><tbody>${record.lines.map((line) => `<tr class="border-t"><td class="p-3"><div class="flex items-center gap-2">${renderBusinessImage(line.target.imageUrl, `${line.target.spuName} ${line.target.color}/${line.size}`, 'h-10 w-10')}<strong>${escapeHtml(line.size)}</strong></div></td><td class="p-3">${escapeHtml(line.source.skuCode)}</td><td class="p-3 font-semibold text-blue-700">${escapeHtml(line.target.skuCode)}</td><td class="p-3 text-right">${formatQty(line.soldHistoryQty)}</td><td class="p-3 text-right">${formatQty(line.finishedWarehouseQty)}</td><td class="p-3 text-right">${formatQty(line.postFactoryQty)}</td><td class="p-3 text-right">${formatQty(line.remainingReturnQty)}</td><td class="p-3">${formatQty(line.postRelabeledQty)} / ${formatQty(line.postFactoryQty)}</td></tr>`).join('')}</tbody></table></div><section class="rounded-lg border p-4"><h3 class="font-semibold">瑕疵迁移与追溯</h3><p class="mt-1 text-xs text-slate-500">瑕疵数量、原因、责任和扣款事实不变；当前归属显示目标 SKU，保留原 SKU 审计。</p>${record.migrationAudits.length ? `<div class="mt-3 overflow-x-auto"><table class="w-full min-w-[860px] text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="p-2">对象</th><th class="p-2">尺码</th><th class="p-2">原 SKU</th><th class="p-2">当前 SKU</th><th class="p-2">迁移时间</th></tr></thead><tbody>${record.migrationAudits.map((audit) => `<tr class="border-t"><td class="p-2">${escapeHtml(audit.objectType)} · ${escapeHtml(audit.objectId)}</td><td class="p-2">${escapeHtml(audit.size)}</td><td class="p-2">${escapeHtml(audit.originalSkuCode)}</td><td class="p-2 font-semibold text-blue-700">${escapeHtml(audit.currentSkuCode)}</td><td class="p-2">${escapeHtml(audit.migratedAt)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mt-3 text-sm text-slate-500">当前范围内尚无已记录的瑕疵 SKU 明细；后续新瑕疵自动归入目标 SKU。</p>'}</section></div></section></div>`
}

function renderImageDialog(): string {
  if (!state.imagePreview) return ''
  return `<div class="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true"><button class="absolute right-5 top-5 rounded-md bg-white px-3 py-2 text-sm" data-garment-spu-replacement-action="close-image" data-skip-page-rerender="true">关闭</button><figure class="max-h-[90vh] max-w-[90vw]"><img src="${escapeHtml(state.imagePreview.url)}" alt="${escapeHtml(state.imagePreview.label)}" class="max-h-[82vh] max-w-[90vw] object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><div hidden class="rounded-lg bg-white p-8 text-red-700">商品大图加载失败，请检查商品中心图片。</div><figcaption class="mt-2 text-center text-sm text-white">${escapeHtml(state.imagePreview.label)}</figcaption></figure></div>`
}

function renderOverlays(): string {
  return `<div data-garment-spu-replacement-column-settings>${controller.renderColumnSettings()}</div>${renderCreateDialog()}${appendDetailEvidence(renderDetailDialog())}${renderImageDialog()}`
}

function renderInner(): string {
  const rows = filteredRows()
  const view = controller.getView(rows)
  const totalReplacementQty = rows.reduce((sum, row) => sum + row.lines.reduce((lineSum, line) => lineSum + line.finishedWarehouseQty + line.postFactoryQty + line.remainingReturnQty, 0), 0)
  return renderStandardListPage({
    title: '成衣 SPU 替换',
    primaryActionsHtml: '<button class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white" data-garment-spu-replacement-action="open-create" data-skip-page-rerender="true">发起整色替换</button>',
    feedbackHtml: state.feedback ? `<div class="rounded-md border p-3 text-sm ${state.feedbackOk ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}">${escapeHtml(state.feedback)}</div>` : '',
    filtersHtml: renderFilters(),
    statsHtml: renderStandardListStats([
      { label: '整色替换单', value: rows.length },
      { label: '换码中', value: rows.filter((row) => row.status === 'RELABELING').length },
      { label: '待／已替换数量', value: formatQty(totalReplacementQty) },
      { label: '范围口径', value: '生产单＋颜色' },
    ]),
    listTitle: state.entryMode === 'WLS' ? '仓储侧成衣 SPU 替换记录' : '后道侧成衣 SPU 替换记录',
    listActionsHtml: '<button class="rounded-md border px-3 py-1.5 text-sm" data-garment-spu-replacement-action="open-column-settings" data-skip-page-rerender="true">列设置</button>',
    tableHtml: `<div data-garment-spu-replacement-table>${view.tableHtml}</div>`,
    paginationHtml: `<div data-garment-spu-replacement-pagination>${view.paginationHtml}</div>`,
    overlaysHtml: `<div data-garment-spu-replacement-overlays>${renderOverlays()}</div>`,
  })
}

function rootElement(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.querySelector<HTMLElement>(ROOT_SELECTOR)
}

function hydrate(root: ParentNode): void {
  void import('../components/shell.ts').then(({ hydrateIcons }) => hydrateIcons(root)).catch(() => undefined)
}

function refreshAll(): void {
  const root = rootElement()
  if (!root) return
  root.innerHTML = renderInner()
  hydrate(root)
}

function refreshOverlays(): void {
  const surface = rootElement()?.querySelector<HTMLElement>('[data-garment-spu-replacement-overlays]')
  if (!surface) return
  surface.innerHTML = renderOverlays()
  hydrate(surface)
}

function renderPage(entryMode: EntryMode): string {
  state.entryMode = entryMode
  resetStandardListEntryTransientStateOnRouteEntry(state, Boolean(rootElement()))
  controller.installColumnDragEvents()
  return `<div data-garment-spu-replacement-root data-entry-mode="${entryMode}" data-skip-page-rerender="true">${renderInner()}</div>`
}

export function renderPostFinishingGarmentSpuReplacementsPage(): string {
  return renderPage('POST_FINISHING')
}

export function renderWlsGarmentSpuReplacementsPage(): string {
  return renderPage('WLS')
}

export function closeGarmentSpuReplacementOverlays(): boolean {
  if (!rootElement()) return false
  if (state.imagePreview) state.imagePreview = null
  else if (state.overlay) state.overlay = null
  else if (state.showColumnSettings) state.showColumnSettings = false
  else return false
  refreshOverlays()
  return true
}

function fieldValue(name: string): string {
  return rootElement()?.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[data-garment-spu-replacement-field="${name}"]`)?.value || ''
}

function createReplacementFromForm(file?: File, evidenceImageUrl?: string): void {
  const record = createGarmentSpuReplacement({
    productionOrderId: fieldValue('productionOrderId'),
    sourceColor: fieldValue('sourceColor'),
    targetSpuCode: fieldValue('targetSpuCode'),
    targetColor: fieldValue('targetColor'),
    reason: fieldValue('reason'),
    evidenceFileName: file?.name,
    evidenceImageUrl,
    operatorName: state.entryMode === 'WLS' ? '成衣仓管理员' : '后道跟单员',
  })
  appendGarmentIdentityMigrationAudits({
    replacementId: record.replacementId,
    candidates: listPostFinishingIdentityMigrationCandidates(record.productionOrderId, record.sourceColor),
  })
  state.overlay = { kind: 'detail', replacementId: record.replacementId }
  state.feedback = `${record.replacementNo} 已发起；B 类已进入成衣仓换码任务，C/D 类已切换到目标执行链路。`
  state.feedbackOk = true
  state.overlayError = ''
  refreshAll()
}

export function handleGarmentSpuReplacementEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape') {
    return closeGarmentSpuReplacementOverlays()
  }
  const field = target.closest<HTMLInputElement | HTMLSelectElement>('[data-garment-spu-replacement-field]')
  if (field) {
    if (field.dataset.garmentSpuReplacementField === 'keyword') state.keyword = field.value
    if (field.dataset.garmentSpuReplacementField === 'status') state.status = field.value as GarmentReplacementPageState['status']
    if (field.dataset.garmentSpuReplacementField === 'pageSize' && event?.type === 'change') {
      controller.setPageSize(Number(field.value)); controller.refresh()
    }
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-garment-spu-replacement-action]')
  const action = actionNode?.dataset.garmentSpuReplacementAction
  if (!actionNode || !action) return false
  if (action === 'prev-page' || action === 'next-page') { controller.stepPage(action === 'prev-page' ? -1 : 1); controller.refresh(); return true }
  if (action === 'sort-column') { controller.cycleSort(actionNode.dataset.columnKey || ''); controller.refresh(); return true }
  if (action === 'apply-filters') { state.currentPage = 1; controller.refresh(); return true }
  if (action === 'reset-filters') { state.keyword = ''; state.status = ''; state.currentPage = 1; refreshAll(); return true }
  if (action === 'open-column-settings') state.showColumnSettings = true
  if (action === 'close-column-settings') state.showColumnSettings = false
  if (action === 'restore-column-settings') controller.restorePreferences()
  if (action === 'toggle-column-visibility' || action === 'toggle-column-freeze') {
    const checkbox = actionNode.closest<HTMLInputElement>('input')
    const key = actionNode.dataset.garmentSpuReplacementColumnKey || actionNode.closest<HTMLElement>('[data-garment-spu-replacement-column-key]')?.dataset.garmentSpuReplacementColumnKey || ''
    controller.updateColumnPreference(action, key, checkbox?.checked)
  }
  if (['open-column-settings', 'close-column-settings', 'restore-column-settings', 'toggle-column-visibility', 'toggle-column-freeze'].includes(action)) { refreshOverlays(); controller.refresh(); return true }
  if (action === 'open-create') { state.overlay = { kind: 'create' }; state.overlayError = ''; refreshOverlays(); return true }
  if (action === 'open-detail') { state.overlay = { kind: 'detail', replacementId: actionNode.dataset.replacementId || '' }; state.overlayError = ''; refreshOverlays(); return true }
  if (action === 'close-overlay') { state.overlay = null; state.overlayError = ''; refreshOverlays(); return true }
  if (action === 'open-image') { state.imagePreview = { url: actionNode.dataset.imageUrl || '', label: actionNode.dataset.imageLabel || '商品大图' }; refreshOverlays(); return true }
  if (action === 'close-image') { state.imagePreview = null; refreshOverlays(); return true }
  if (action === 'create') {
    const file = rootElement()?.querySelector<HTMLInputElement>('[data-garment-spu-replacement-field="evidence"]')?.files?.[0]
    if (file) {
      const reader = new FileReader()
      actionNode.setAttribute('disabled', 'true')
      actionNode.textContent = '正在读取截图…'
      reader.addEventListener('load', () => {
        try {
          createReplacementFromForm(file, typeof reader.result === 'string' ? reader.result : undefined)
        } catch (error) {
          state.overlayError = error instanceof Error ? error.message : String(error)
          refreshOverlays()
        }
      })
      reader.addEventListener('error', () => {
        state.overlayError = '现场截图读取失败，请重新选择图片后再试；也可以不上传截图。'
        refreshOverlays()
      })
      reader.readAsDataURL(file)
      return true
    }
    try {
      createReplacementFromForm()
    } catch (error) {
      state.overlayError = error instanceof Error ? error.message : String(error)
      refreshOverlays()
    }
    return true
  }
  if (action === 'complete-post') {
    try {
      const record = completePostFactoryRelabel({ replacementId: actionNode.dataset.replacementId || '', operatorName: '后道换码员' })
      state.feedback = `${record.replacementNo} 的 C 类成衣已全部完成新条码和新吊牌换码，交出门禁已解除。`
      state.feedbackOk = true
      refreshAll()
    } catch (error) {
      state.feedback = `后道换码未保存：${error instanceof Error ? error.message : String(error)}`
      state.feedbackOk = false
      refreshAll()
    }
    return true
  }
  return false
}
