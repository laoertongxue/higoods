// @page-pattern: list
import { renderStandardListPage, renderStandardListStats } from '../components/ui/list-page.ts'
import { createProcessOrderListController, type ProcessOrderListControllerState } from '../components/ui/process-order-list-controller.ts'
import type { StandardListColumn } from '../components/ui/list-table.ts'
import { resetStandardListEntryTransientStateOnRouteEntry } from '../components/ui/list-table-model.ts'
import { buildUnifiedPrintPreviewLink } from '../data/fcs/print-service.ts'
import { productionOrders } from '../data/fcs/production-orders.ts'
import { listSkuArchives } from '../data/pcs-sku-archive-repository.ts'
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

interface GarmentReplacementCreateDraft {
  productionOrderId: string
  sourceColor: string
  targetSpuCode: string
  targetColor: string
  reason: string
}

interface GarmentReplacementPageState extends ProcessOrderListControllerState {
  keyword: string
  status: '' | GarmentSpuReplacementRecord['status']
  entryMode: EntryMode
  overlay: null | { kind: 'create' } | { kind: 'detail'; replacementId: string }
  imagePreview: null | { url: string; label: string }
  feedback: string
  feedbackOk: boolean
  overlayError: string
  createDraft: GarmentReplacementCreateDraft
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
  createDraft: { productionOrderId: '', sourceColor: '', targetSpuCode: '', targetColor: '', reason: '' },
}

function formatQty(value: number): string {
  return `${value.toLocaleString('zh-CN')} 件`
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function listProductionOrderOptions() {
  return productionOrders
    .filter((order) => order.demandSnapshot.skuLines.length > 0)
    .map((order) => ({
      productionOrderId: order.productionOrderId,
      productionOrderNo: order.productionOrderNo,
      spuCode: order.demandSnapshot.spuCode,
      spuName: order.demandSnapshot.spuName,
      colors: Array.from(new Set(order.demandSnapshot.skuLines.map((line) => line.color))),
    }))
}

function findProductionOrderOption(value: string) {
  return listProductionOrderOptions().find((order) => order.productionOrderId === value || order.productionOrderNo === value) || null
}

function listSourceColors(productionOrderId: string): string[] {
  return findProductionOrderOption(productionOrderId)?.colors || []
}

function listTargetSpuOptions() {
  const options = new Map<string, { spuCode: string; spuName: string; colors: Set<string> }>()
  listSkuArchives().filter((sku) => sku.archiveStatus === 'ACTIVE').forEach((sku) => {
    const current = options.get(sku.styleCode) || { spuCode: sku.styleCode, spuName: sku.styleName, colors: new Set<string>() }
    current.colors.add(sku.colorName)
    options.set(sku.styleCode, current)
  })
  return Array.from(options.values())
    .map((item) => ({ ...item, colors: Array.from(item.colors) }))
    .sort((a, b) => a.spuCode.localeCompare(b.spuCode))
}

function findTargetSpuOption(value: string) {
  return listTargetSpuOptions().find((item) => item.spuCode === value) || null
}

function listTargetColors(targetSpuCode: string): string[] {
  return findTargetSpuOption(targetSpuCode)?.colors || []
}

function normalizeCreateDraftDependencies(): void {
  const sourceColors = listSourceColors(state.createDraft.productionOrderId)
  if (!sourceColors.some((color) => normalize(color) === normalize(state.createDraft.sourceColor))) {
    state.createDraft.sourceColor = sourceColors[0] || ''
  }
  const targetColors = listTargetColors(state.createDraft.targetSpuCode)
  if (!targetColors.some((color) => normalize(color) === normalize(state.createDraft.targetColor))) {
    state.createDraft.targetColor = targetColors[0] || ''
  }
}

function createInitialDraft(): GarmentReplacementCreateDraft {
  const occupiedScopes = new Set(listGarmentSpuReplacements().map((record) => record.scopeKey))
  const productionOrderOptions = listProductionOrderOptions()
  let productionOrderId = productionOrderOptions[0]?.productionOrderId || ''
  let sourceColor = productionOrderOptions[0]?.colors[0] || ''
  for (const order of productionOrderOptions) {
    const availableColor = order.colors.find((color) => !occupiedScopes.has(`${order.productionOrderId}::${normalize(color)}`))
    if (!availableColor) continue
    productionOrderId = order.productionOrderId
    sourceColor = availableColor
    break
  }
  const sourceSpuCode = findProductionOrderOption(productionOrderId)?.spuCode || ''
  const targetOptions = listTargetSpuOptions()
  const target = targetOptions.find((item) => item.spuCode === 'SPU-2024-015')
    || targetOptions.find((item) => item.spuCode !== sourceSpuCode)
    || targetOptions[0]
  return {
    productionOrderId,
    sourceColor,
    targetSpuCode: target?.spuCode || '',
    targetColor: target?.colors[0] || '',
    reason: '',
  }
}

function renderTargetSku(line: GarmentSpuReplacementLine): string {
  if (!line.replacementRequired) return '<span class="text-xs text-slate-500">仅已完成销售出库的历史数量，无需目标 SKU</span>'
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
    key: 'quantity', title: '数量分布', width: 320, sortable: true,
    sortValue: (row) => row.originalDemandQty,
    render: (row) => {
      const total = (key: 'soldHistoryQty' | 'finishedWarehouseQty' | 'postFactoryQty' | 'remainingReturnQty') => row.lines.reduce((sum, line) => sum + line[key], 0)
      return `<div class="grid grid-cols-2 gap-x-3 gap-y-1 text-xs"><span>已完成销售出库（历史）</span><strong>${formatQty(total('soldHistoryQty'))}</strong><span>成衣仓未售成衣</span><strong>${formatQty(total('finishedWarehouseQty'))}</strong><span>后道工厂未入仓成衣</span><strong>${formatQty(total('postFactoryQty'))}</strong><span>生产单剩余待回货</span><strong>${formatQty(total('remainingReturnQty'))}</strong></div><div class="mt-2 border-t pt-1 text-xs">生产单原数量：<strong>${formatQty(row.originalDemandQty)}</strong></div>`
    },
  },
  {
    key: 'progress', title: '换码进度', width: 190,
    render: (row) => {
      const cTotal = row.lines.reduce((sum, line) => sum + line.postFactoryQty, 0)
      const cDone = row.lines.reduce((sum, line) => sum + line.postRelabeledQty, 0)
      return `${renderStatus(row.status)}<div class="mt-2 text-xs">后道工厂在手成衣：${formatQty(cDone)} / ${formatQty(cTotal)}</div><div class="mt-1 text-xs text-slate-500">成衣仓未售成衣进入统一换码任务</div>`
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
  const productionOrderOptions = listProductionOrderOptions()
  const targetSpuOptions = listTargetSpuOptions()
  const selectedProductionOrder = findProductionOrderOption(state.createDraft.productionOrderId)
  const selectedTargetSpu = findTargetSpuOption(state.createDraft.targetSpuCode)
  const sourceColors = listSourceColors(state.createDraft.productionOrderId)
  const targetColors = listTargetColors(state.createDraft.targetSpuCode)
  let preview: ReturnType<typeof buildGarmentReplacementPreview> | null = null
  let previewError = ''
  if (!selectedProductionOrder) previewError = '请从搜索下拉中选择有效生产单。'
  else if (!state.createDraft.sourceColor) previewError = '请选择该生产单下需要整色替换的源颜色。'
  else if (!selectedTargetSpu) previewError = '请从搜索下拉中选择商品中心已有的有效目标 SPU。'
  else if (!state.createDraft.targetColor) previewError = '请选择目标 SPU 下的目标颜色。'
  else {
    try {
      preview = buildGarmentReplacementPreview({
        productionOrderId: selectedProductionOrder.productionOrderId,
        sourceColor: state.createDraft.sourceColor,
        targetSpuCode: selectedTargetSpu.spuCode,
        targetColor: state.createDraft.targetColor,
      })
    } catch (error) {
      previewError = error instanceof Error ? error.message : String(error)
    }
  }
  const productionOrderOptionsHtml = productionOrderOptions.map((order) => {
    const label = `${order.productionOrderNo} · ${order.spuCode} ${order.spuName} · ${order.colors.join(' / ')}`
    return `<option value="${escapeHtml(order.productionOrderId)}" label="${escapeHtml(label)}"></option>`
  }).join('')
  const targetSpuOptionsHtml = targetSpuOptions.map((item) => {
    const label = `${item.spuCode} · ${item.spuName} · ${item.colors.join(' / ')}`
    return `<option value="${escapeHtml(item.spuCode)}" label="${escapeHtml(label)}"></option>`
  }).join('')
  const sourceColorOptionsHtml = sourceColors.map((color) => `<option value="${escapeHtml(color)}" ${normalize(color) === normalize(state.createDraft.sourceColor) ? 'selected' : ''}>${escapeHtml(color)}</option>`).join('')
  const targetColorOptionsHtml = targetColors.map((color) => `<option value="${escapeHtml(color)}" ${normalize(color) === normalize(state.createDraft.targetColor) ? 'selected' : ''}>${escapeHtml(color)}</option>`).join('')
  return `<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true"><section class="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header class="sticky top-0 z-10 flex items-start justify-between border-b bg-white px-5 py-4"><div><h2 class="text-lg font-semibold">发起成衣整色 SPU 替换</h2><p class="mt-1 text-sm text-slate-500">范围固定为“生产单＋源颜色”；目标 SPU/SKU 只能从商品中心现有有效档案选择。</p></div><button class="rounded-md border px-3 py-1.5 text-sm" data-garment-spu-replacement-action="close-overlay" data-skip-page-rerender="true">关闭</button></header><div class="space-y-4 p-5">${state.overlayError ? `<div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">未保存：${escapeHtml(state.overlayError)}</div>` : ''}${previewError ? `<div class="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">${escapeHtml(previewError)}</div>` : ''}<div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4"><label><span class="mb-1 block text-xs text-slate-500">生产单（可搜索）</span><input list="garment-replacement-production-orders" autocomplete="off" class="h-9 w-full rounded-md border bg-white px-3" value="${escapeHtml(state.createDraft.productionOrderId)}" placeholder="输入生产单号或 SPU 搜索" aria-label="搜索生产单" data-searchable-select="production-order" data-garment-spu-replacement-field="productionOrderId" data-skip-page-rerender="true"><datalist id="garment-replacement-production-orders">${productionOrderOptionsHtml}</datalist><span class="mt-1 block text-xs text-slate-500">下拉候选同时显示生产单、源 SPU 和可选颜色。</span></label><label><span class="mb-1 block text-xs text-slate-500">源颜色（来自所选生产单）</span><select class="h-9 w-full rounded-md border bg-white px-3" data-garment-spu-replacement-field="sourceColor" data-skip-page-rerender="true" ${sourceColors.length ? '' : 'disabled'}>${sourceColorOptionsHtml || '<option value="">请先选择有效生产单</option>'}</select></label><label><span class="mb-1 block text-xs text-slate-500">目标 SPU（商品中心，可搜索）</span><input list="garment-replacement-target-spus" autocomplete="off" class="h-9 w-full rounded-md border bg-white px-3" value="${escapeHtml(state.createDraft.targetSpuCode)}" placeholder="输入 SPU 编码或商品名称搜索" aria-label="搜索目标 SPU" data-searchable-select="target-spu" data-garment-spu-replacement-field="targetSpuCode" data-skip-page-rerender="true"><datalist id="garment-replacement-target-spus">${targetSpuOptionsHtml}</datalist><span class="mt-1 block text-xs text-slate-500">仅列出商品中心已维护的有效 SPU。</span></label><label><span class="mb-1 block text-xs text-slate-500">目标颜色（来自目标 SPU）</span><select class="h-9 w-full rounded-md border bg-white px-3" data-garment-spu-replacement-field="targetColor" data-skip-page-rerender="true" ${targetColors.length ? '' : 'disabled'}>${targetColorOptionsHtml || '<option value="">请先选择有效目标 SPU</option>'}</select></label></div>${preview ? `<div class="overflow-x-auto rounded-lg border" data-create-preview><table class="w-full min-w-[1280px] text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="p-3">尺码</th><th class="p-3">源 SKU</th><th class="p-3">匹配目标 SKU</th><th class="p-3 text-right">已完成销售出库（历史）</th><th class="p-3 text-right">成衣仓未售成衣</th><th class="p-3 text-right">后道工厂未入仓成衣</th><th class="p-3 text-right">生产单剩余待回货</th><th class="p-3 text-right">原数量</th></tr></thead><tbody>${preview.lines.map((line) => `<tr class="border-t"><td class="p-3 font-semibold">${escapeHtml(line.size)}</td><td class="p-3">${escapeHtml(line.source.skuCode)}</td><td class="p-3">${renderTargetSku(line)}</td><td class="p-3 text-right">${formatQty(line.soldHistoryQty)}</td><td class="p-3 text-right">${formatQty(line.finishedWarehouseQty)}</td><td class="p-3 text-right">${formatQty(line.postFactoryQty)}</td><td class="p-3 text-right">${formatQty(line.remainingReturnQty)}</td><td class="p-3 text-right font-semibold">${formatQty(line.originalDemandQty)}</td></tr>`).join('')}</tbody><tfoot class="border-t bg-blue-50 font-semibold"><tr><td class="p-3" colspan="3">整色合计</td><td class="p-3 text-right">${formatQty(preview.totals.soldHistoryQty)}</td><td class="p-3 text-right">${formatQty(preview.totals.finishedWarehouseQty)}</td><td class="p-3 text-right">${formatQty(preview.totals.postFactoryQty)}</td><td class="p-3 text-right">${formatQty(preview.totals.remainingReturnQty)}</td><td class="p-3 text-right">${formatQty(preview.totals.originalDemandQty)}</td></tr></tfoot></table></div>` : ''}<label class="block"><span class="mb-1 block text-xs text-slate-500">替换原因（必填）</span><textarea class="min-h-20 w-full rounded-md border p-3" data-garment-spu-replacement-field="reason" data-skip-page-rerender="true" placeholder="说明整色质量问题和替换原因">${escapeHtml(state.createDraft.reason)}</textarea></label><label class="block"><span class="mb-1 block text-xs text-slate-500">现场截图（非必填）</span><input type="file" accept="image/*" class="block w-full rounded-md border p-2 text-sm" data-garment-spu-replacement-field="evidence"><span class="mt-1 block text-xs text-slate-500">可用于后续追溯；不上传不阻断发起。</span></label><div class="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">确认后：已完成销售出库的历史数量保留原身份；成衣仓未售成衣进入换码任务；后道工厂未入仓成衣先打印新条码和新吊牌并完成换码；生产单剩余待回货量后续使用目标 SKU。原生产需求、工厂归属和结算身份不变。</div></div><footer class="sticky bottom-0 flex justify-end gap-2 border-t bg-white px-5 py-4"><button class="rounded-md border px-4 py-2 text-sm" data-garment-spu-replacement-action="close-overlay" data-skip-page-rerender="true">取消</button><button class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50" data-garment-spu-replacement-action="create" data-skip-page-rerender="true" ${preview ? '' : 'disabled'}>确认发起整色替换</button></footer></section></div>`
}

function renderDetailDialog(): string {
  if (state.overlay?.kind !== 'detail') return ''
  const record = getGarmentSpuReplacement(state.overlay.replacementId)
  if (!record) return ''
  const postTotal = record.lines.reduce((sum, line) => sum + line.postFactoryQty, 0)
  const postDone = record.lines.reduce((sum, line) => sum + line.postRelabeledQty, 0)
  const barcodeHref = buildUnifiedPrintPreviewLink({ documentType: 'GARMENT_SKU_BARCODE', sourceType: 'PRODUCTION_ORDER', sourceId: record.productionOrderId })
  const hangtagHref = buildUnifiedPrintPreviewLink({ documentType: 'GARMENT_HANGTAG', sourceType: 'PRODUCTION_ORDER', sourceId: record.productionOrderId })
  const postActionHtml = postDone < postTotal
    ? `<button class="rounded-md bg-emerald-600 px-3 py-2 text-sm text-white" data-garment-spu-replacement-action="complete-post" data-replacement-id="${escapeHtml(record.replacementId)}" data-skip-page-rerender="true">确认后道工厂在手成衣已全部换码</button>`
    : '<span class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">后道工厂在手成衣已换码，可继续交出</span>'
  const lineRowsHtml = record.lines.map((line) => `<tr class="border-t"><td class="p-3"><div class="flex items-center gap-2">${renderBusinessImage(line.target.imageUrl, `${line.target.spuName} ${line.target.color}/${line.size}`, 'h-10 w-10')}<strong>${escapeHtml(line.size)}</strong></div></td><td class="p-3">${escapeHtml(line.source.skuCode)}</td><td class="p-3 font-semibold text-blue-700">${escapeHtml(line.target.skuCode)}</td><td class="p-3 text-right">${formatQty(line.soldHistoryQty)}</td><td class="p-3 text-right">${formatQty(line.finishedWarehouseQty)}</td><td class="p-3 text-right">${formatQty(line.postFactoryQty)}</td><td class="p-3 text-right">${formatQty(line.remainingReturnQty)}</td><td class="p-3">${formatQty(line.postRelabeledQty)} / ${formatQty(line.postFactoryQty)}</td></tr>`).join('')
  const migrationRowsHtml = record.migrationAudits.map((audit) => `<tr class="border-t"><td class="p-2">${escapeHtml(audit.objectType)} · ${escapeHtml(audit.objectId)}</td><td class="p-2">${escapeHtml(audit.size)}</td><td class="p-2">${escapeHtml(audit.originalSkuCode)}</td><td class="p-2 font-semibold text-blue-700">${escapeHtml(audit.currentSkuCode)}</td><td class="p-2">${escapeHtml(audit.migratedAt)}</td></tr>`).join('')
  const migrationHtml = record.migrationAudits.length
    ? `<div class="mt-3 overflow-x-auto"><table class="w-full min-w-[860px] text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="p-2">对象</th><th class="p-2">尺码</th><th class="p-2">原 SKU</th><th class="p-2">当前 SKU</th><th class="p-2">迁移时间</th></tr></thead><tbody>${migrationRowsHtml}</tbody></table></div>`
    : '<p class="mt-3 text-sm text-slate-500">当前范围内尚无已记录的瑕疵 SKU 明细；后续新瑕疵自动归入目标 SKU。</p>'
  return `<div class="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true"><section class="max-h-[92vh] w-full max-w-7xl overflow-y-auto rounded-xl bg-white shadow-2xl"><header class="sticky top-0 z-10 flex items-start justify-between border-b bg-white px-5 py-4"><div><h2 class="text-lg font-semibold">${escapeHtml(record.replacementNo)}</h2><p class="mt-1 text-sm text-slate-500">${escapeHtml(record.productionOrderNo)} · ${escapeHtml(record.sourceSpuCode)} ${escapeHtml(record.sourceColor)} → ${escapeHtml(record.targetSpuCode)} ${escapeHtml(record.targetColor)}</p></div><button class="rounded-md border px-3 py-1.5 text-sm" data-garment-spu-replacement-action="close-overlay" data-skip-page-rerender="true">关闭</button></header><div class="space-y-4 p-5"><div class="grid gap-3 md:grid-cols-4"><div class="rounded-lg border p-3"><span class="text-xs text-slate-500">状态</span><div class="mt-2">${renderStatus(record.status)}</div></div><div class="rounded-lg border p-3"><span class="text-xs text-slate-500">生产单原数量</span><strong class="mt-2 block">${formatQty(record.originalDemandQty)}</strong></div><div class="rounded-lg border p-3"><span class="text-xs text-slate-500">后道工厂在手成衣换码</span><strong class="mt-2 block">${formatQty(postDone)} / ${formatQty(postTotal)}</strong></div><div class="rounded-lg border p-3"><span class="text-xs text-slate-500">瑕疵身份迁移</span><strong class="mt-2 block">${record.migrationAudits.length} 条</strong></div></div><div class="flex flex-wrap gap-2"><a class="rounded-md bg-blue-600 px-3 py-2 text-sm text-white" href="${escapeHtml(barcodeHref)}" data-nav="${escapeHtml(barcodeHref)}">打印新条码</a><a class="rounded-md bg-amber-500 px-3 py-2 text-sm text-white" href="${escapeHtml(hangtagHref)}" data-nav="${escapeHtml(hangtagHref)}">打印新吊牌</a>${postActionHtml}</div><div class="overflow-x-auto rounded-lg border"><table class="w-full min-w-[1320px] text-left text-sm"><thead class="bg-slate-50 text-xs text-slate-500"><tr><th class="p-3">尺码／图片</th><th class="p-3">原 SKU</th><th class="p-3">当前目标 SKU</th><th class="p-3 text-right">已完成销售出库（历史）</th><th class="p-3 text-right">成衣仓未售成衣</th><th class="p-3 text-right">后道工厂未入仓成衣</th><th class="p-3 text-right">生产单剩余待回货</th><th class="p-3">后道换码进度</th></tr></thead><tbody>${lineRowsHtml}</tbody></table></div><section class="rounded-lg border p-4"><h3 class="font-semibold">瑕疵迁移与追溯</h3><p class="mt-1 text-xs text-slate-500">瑕疵数量、原因、责任和扣款事实不变；当前归属显示目标 SKU，保留原 SKU 审计。</p>${migrationHtml}</section></div></section></div>`
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

function createReplacementFromForm(file?: File, evidenceImageUrl?: string): void {
  const record = createGarmentSpuReplacement({
    productionOrderId: state.createDraft.productionOrderId,
    sourceColor: state.createDraft.sourceColor,
    targetSpuCode: state.createDraft.targetSpuCode,
    targetColor: state.createDraft.targetColor,
    reason: state.createDraft.reason,
    evidenceFileName: file?.name,
    evidenceImageUrl,
    operatorName: state.entryMode === 'WLS' ? '成衣仓管理员' : '后道跟单员',
  })
  appendGarmentIdentityMigrationAudits({
    replacementId: record.replacementId,
    candidates: listPostFinishingIdentityMigrationCandidates(record.productionOrderId, record.sourceColor),
  })
  state.overlay = { kind: 'detail', replacementId: record.replacementId }
  state.feedback = `${record.replacementNo} 已发起；成衣仓未售成衣已进入换码任务，后道工厂在手成衣和剩余待回货量已切换到目标执行链路。`
  state.feedbackOk = true
  state.overlayError = ''
  refreshAll()
}

export function handleGarmentSpuReplacementEvent(target: HTMLElement, event?: Event): boolean {
  if (!rootElement() && typeof window !== 'undefined') return false
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape') {
    return closeGarmentSpuReplacementOverlays()
  }
  const field = target.closest<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('[data-garment-spu-replacement-field]')
  if (field) {
    const fieldName = field.dataset.garmentSpuReplacementField || ''
    if (fieldName === 'keyword') state.keyword = field.value
    if (fieldName === 'status') state.status = field.value as GarmentReplacementPageState['status']
    if (fieldName === 'productionOrderId') {
      state.createDraft.productionOrderId = field.value
      if (event?.type === 'change' || findProductionOrderOption(field.value)) {
        normalizeCreateDraftDependencies()
        refreshOverlays()
      }
    }
    if (fieldName === 'sourceColor') {
      state.createDraft.sourceColor = field.value
      if (event?.type === 'change') refreshOverlays()
    }
    if (fieldName === 'targetSpuCode') {
      state.createDraft.targetSpuCode = field.value
      if (event?.type === 'change' || findTargetSpuOption(field.value)) {
        normalizeCreateDraftDependencies()
        refreshOverlays()
      }
    }
    if (fieldName === 'targetColor') {
      state.createDraft.targetColor = field.value
      if (event?.type === 'change') refreshOverlays()
    }
    if (fieldName === 'reason') state.createDraft.reason = field.value
    if (fieldName === 'pageSize' && event?.type === 'change') {
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
  if (action === 'open-create') { state.createDraft = createInitialDraft(); state.overlay = { kind: 'create' }; state.overlayError = ''; refreshOverlays(); return true }
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
      state.feedback = `${record.replacementNo} 的后道工厂在手成衣已全部完成新条码和新吊牌换码，交出门禁已解除。`
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
