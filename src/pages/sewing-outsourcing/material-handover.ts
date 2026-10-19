import { getSewingMaterialHandoverProjection } from '../../data/fcs/sewing-material-handover.ts'
// @page-pattern: detail

import {
  ensureSewingOutsourcingSampleDemo,
  SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS,
} from '../../data/fcs/sewing-outsourcing-demo.ts'
import { escapeHtml } from '../../utils.ts'

let imageDialog: { imageUrl: string; label: string } | null = null
let imageOpener: HTMLElement | null = null

function refreshPage(): void {
  const host = document.querySelector<HTMLElement>('[data-sewing-material-overlay]')
  if (!host) return
  host.innerHTML = renderDialog()
  const dialog = host.querySelector<HTMLElement>('[role="dialog"]')
  if (!dialog) return
  dialog.querySelector<HTMLButtonElement>('[data-sewing-material-dialog-close]')?.focus()
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopPropagation(); closeSewingMaterialHandoverDialog()
    } else if (event.key === 'Tab') {
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex]')).filter(node => node.tabIndex >= 0 && !node.hasAttribute('disabled') && node.getClientRects().length > 0)
      const first = controls[0], last = controls[controls.length - 1]
      if (first && ((event.shiftKey && document.activeElement === first) || (!event.shiftKey && document.activeElement === last))) {
        event.preventDefault(); (event.shiftKey ? last : first).focus()
      }
    }
  })
  const image = dialog.querySelector<HTMLImageElement>('[data-sewing-material-large-image]')!
  const status = dialog.querySelector<HTMLElement>('[data-sewing-material-image-status]')!
  const loaded = () => { status.textContent = ''; image.style.visibility = 'visible' }
  const failed = () => { status.textContent = '图片加载失败，关闭后可重新打开。'; image.style.visibility = 'hidden' }
  image.addEventListener('load', loaded); image.addEventListener('error', failed)
  if (image.complete) image.naturalWidth ? loaded() : failed()
}

export function isSewingMaterialHandoverDialogOpen(): boolean {
  return imageDialog !== null
}

export function closeSewingMaterialHandoverDialog(): boolean {
  if (!imageDialog) return false
  imageDialog = null
  refreshPage()
  const opener = imageOpener
  imageOpener = null
  if (opener?.isConnected) opener.focus()
  return true
}

function renderMaterialImage(imageUrl: string | undefined, label: string): string {
  if (!imageUrl) return '<span class="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">真实物料图缺失</span>'
  return `<button type="button" class="relative h-16 w-16 shrink-0 overflow-hidden rounded border bg-slate-50" data-sewing-material-action="preview-image" data-image-url="${escapeHtml(imageUrl)}" data-image-label="${escapeHtml(label)}" aria-label="查看${escapeHtml(label)}高清图"><img class="h-full w-full object-cover" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(label)}实拍图" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="absolute inset-0 flex items-center justify-center bg-red-50 px-1 text-center text-[10px] text-red-700">图片加载失败</span></button>`
}

function renderDialog(): string {
  if (!imageDialog) return ''
  return `<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(imageDialog.label)}高清大图"><button type="button" tabindex="-1" class="absolute inset-0" data-sewing-material-action="close-dialog" aria-label="关闭大图"></button><section class="relative z-10 max-h-[92vh] max-w-[calc(100vw-2rem)] overflow-auto rounded-lg bg-white p-3 lg:max-w-5xl"><header class="mb-3 flex items-center justify-between gap-3"><b>${escapeHtml(imageDialog.label)}</b><button type="button" class="rounded border px-3 py-1 text-sm" data-sewing-material-action="close-dialog" data-sewing-material-dialog-close>关闭</button></header><img class="max-h-[78vh] max-w-full object-contain" data-sewing-material-large-image src="${escapeHtml(imageDialog.imageUrl)}" alt="${escapeHtml(imageDialog.label)}高清实拍图"><p role="status" data-sewing-material-image-status>图片加载中…</p></section></div>`
}

export function renderSewingMaterialHandoverPage(): string {
  imageDialog = null
  imageOpener = null
  ensureSewingOutsourcingSampleDemo()
  const assignmentId = new URLSearchParams(location.search).get('assignmentId') || SEWING_SAMPLE_DEMO_ASSIGNMENT_IDS.cuttingSewingIronPack
  let projection: ReturnType<typeof getSewingMaterialHandoverProjection>
  try { projection = getSewingMaterialHandoverProjection(assignmentId) }
  catch { return '<section class="rounded border border-amber-300 bg-amber-50 p-4" role="alert">当前任务尚无可读取的物料需求与实交账，请先在对应辅料仓建立任务领料清单。</section>' }
  const context = projection.context
  return `<div class="space-y-5" data-sewing-material-page data-skip-page-rerender="true">
    <header><p class="text-xs text-slate-500">车缝外发协同 / 物料</p><h1 class="mt-1 text-2xl font-semibold">面辅料交出</h1><p class="mt-2 text-sm text-slate-500">按当前任务读取仓库实交事实，PPIC只跟进，不代替仓库填写数量。</p></header>
    <section class="rounded-lg border bg-white p-4"><div class="grid gap-3 text-sm md:grid-cols-4"><div><span class="text-slate-500">执行任务</span><b class="mt-1 block">${escapeHtml(context.taskNo)}</b></div><div><span class="text-slate-500">承接工厂</span><b class="mt-1 block">${escapeHtml(context.factoryName)}</b></div><div><span class="text-slate-500">任务PPIC</span><b class="mt-1 block text-blue-700">${escapeHtml(context.ppicName)}</b></div><div><span class="text-slate-500">冻结技术包</span><b class="mt-1 block">${escapeHtml(context.snapshotVersionLabel || '待补齐')}</b></div></div></section>
    <section class="grid gap-3 md:grid-cols-3"><article class="rounded-lg border bg-white p-4"><p class="text-sm text-slate-500">面辅料需求</p><b class="mt-2 block text-2xl">${projection.lines.length}项</b></article><article class="rounded-lg border bg-white p-4"><p class="text-sm text-slate-500">仍有差额</p><b class="mt-2 block text-2xl text-amber-700">${projection.materialShortageLineCount}项</b></article><article class="rounded-lg border bg-white p-4"><p class="text-sm text-slate-500">裁片欠片</p><b class="mt-2 block text-2xl text-slate-500">不适用</b></article></section>
    <section class="overflow-hidden rounded-lg border bg-white"><header class="border-b p-4"><h2 class="font-semibold">面辅料数量账（只读）</h2><p class="mt-1 text-xs text-slate-500">应交按冻结BOM单耗、损耗率和任务分配量计算；实交来自仓库交出记录。</p></header><div class="overflow-auto"><table class="w-full min-w-[980px] text-left text-sm"><thead class="bg-slate-50"><tr><th class="p-3">物料</th><th class="p-3">类型／规格</th><th class="p-3 text-right">单耗</th><th class="p-3 text-right">应交</th><th class="p-3 text-right">累计实交</th><th class="p-3 text-right">差额</th><th class="p-3">数据来源</th></tr></thead><tbody>${projection.lines.map((line) => `<tr class="border-t"><td class="p-3"><div class="flex items-center gap-3">${renderMaterialImage(line.imageUrl, `${line.materialCode} ${line.materialName}`)}<div><b>${escapeHtml(line.materialName)}</b><p class="mt-1 text-xs text-slate-500">${escapeHtml(line.materialCode)}</p></div></div></td><td class="p-3">${escapeHtml(line.materialType)}<p class="mt-1 text-xs text-slate-500">${escapeHtml(line.materialSpec || '-')}</p></td><td class="p-3 text-right">${line.unitConsumption.toLocaleString()} ${escapeHtml(line.unit)}/件<p class="text-xs text-slate-500">损耗 ${(line.lossRate * 100).toFixed(1)}%</p></td><td class="p-3 text-right font-semibold">${line.requiredQty.toLocaleString()} ${escapeHtml(line.unit)}</td><td class="p-3 text-right">${line.cumulativeHandedOverQty.toLocaleString()} ${escapeHtml(line.unit)}</td><td class="p-3 text-right ${line.shortageQty ? 'font-semibold text-amber-700' : line.overQty ? 'text-blue-700' : 'text-emerald-700'}">${line.shortageQty ? `少 ${line.shortageQty.toLocaleString()}` : line.overQty ? `多 ${line.overQty.toLocaleString()}` : '一致'} ${escapeHtml(line.unit)}</td><td class="p-3"><span class="rounded bg-slate-100 px-2 py-1 text-xs">仓库交出事实</span></td></tr>`).join('')}</tbody></table></div></section>
    <section class="rounded-lg border bg-white p-4"><h2 class="font-semibold">交出批次</h2><p class="mt-1 text-xs text-slate-500">当前${projection.handoverEvents.length}个仓库确认批次；PPIC页面不提供新增、修改或确认数量按钮。</p>${projection.handoverEvents.length ? `<div class="mt-3 space-y-2">${projection.handoverEvents.map((event) => `<div class="rounded border p-3 text-sm"><b>${escapeHtml(event.sourceRecordNo)}</b> · ${event.lines.length}项 · ${escapeHtml(event.handedOverAt)} · ${escapeHtml(event.handedOverBy)}</div>`).join('')}</div>` : '<p class="mt-3 rounded border border-dashed p-4 text-sm text-slate-500">仓库尚未形成交出批次。</p>'}</section>
    <div data-sewing-material-overlay>${renderDialog()}</div>
  </div>`
}

export async function handleSewingMaterialHandoverEvent(target: HTMLElement): Promise<boolean> {
  const node = target.closest<HTMLElement>('[data-sewing-material-action]')
  const action = node?.dataset.sewingMaterialAction
  if (!node || !action) return false
  if (action === 'preview-image') {
    imageOpener = node
    imageDialog = { imageUrl: node.dataset.imageUrl || '', label: node.dataset.imageLabel || '物料' }
    refreshPage()
    return true
  }
  if (action === 'close-dialog') {
    closeSewingMaterialHandoverDialog()
    return true
  }
  return false
}
