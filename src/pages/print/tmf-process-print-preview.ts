// @page-pattern: detail
import { appStore } from '../../state/store.ts'
import { renderUnifiedPrintStyles } from './print-styles.ts'
import { buildTmfProcessSheetPrintDocument, renderTmfProcessSheetTemplate, tmfPrintFactsSignature } from './templates/tmf-process-sheet-template.ts'
import type { PrintDocumentBuildInput } from '../../data/fcs/print-service.ts'
import { escapeHtml } from '../../utils.ts'

function readInput(): PrintDocumentBuildInput {
  const [, query] = appStore.getState().pathname.split('?')
  const params = new URLSearchParams(query || '')
  return {
    documentType: 'TMF_PROCESS_SHEET',
    sourceType: 'TMF_WORK_ORDER',
    sourceId: params.get('sourceId') || '',
  }
}

function renderFailure(message: string): string {
  return `${renderUnifiedPrintStyles()}<div class="print-preview-root"><div class="print-preview-toolbar print-hidden"><a class="rounded-md border bg-white px-3 py-2 text-sm" href="/fcs/craft/accessory/webbing/work-orders" data-nav="/fcs/craft/accessory/webbing/work-orders">返回织带加工单</a></div><article class="print-paper-a4"><div class="print-card-sheet"><div class="print-card-title">打印预览无法生成</div><p class="print-image-placeholder">${escapeHtml(message)}</p></div></article></div>`
}

/**
 * TMF 加工明细单的独立打印入口。它只加载 TMF 模板和事实源，不加载通用打印注册表，
 * 防止打印冷导航把其他工厂的全部模板同步带入当前页面。
 */
export function renderTmfProcessPrintPreviewPage(): string {
  const input = readInput()
  if (!input.sourceId) return renderFailure('缺少加工单来源 ID，无法生成打印预览。')
  try {
    const document = buildTmfProcessSheetPrintDocument(input)
    if (typeof window !== 'undefined') window.setTimeout(() => undefined, 0)
    return `${renderUnifiedPrintStyles()}<div class="print-preview-root" data-skip-page-rerender="true"><div class="print-preview-toolbar print-hidden"><div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3 shadow-sm"><div><h1 class="text-lg font-semibold">${escapeHtml(document.documentTitle)}打印预览</h1><p class="mt-1 text-xs text-muted-foreground">打印前请在浏览器打印设置中关闭页眉和页脚。该提示不会被打印。</p></div><div class="flex flex-wrap gap-2"><a class="rounded-md border px-3 py-2 text-sm" href="${escapeHtml(document.printMeta.returnHref || '/fcs/craft/accessory/webbing/work-orders')}" data-nav="${escapeHtml(document.printMeta.returnHref || '/fcs/craft/accessory/webbing/work-orders')}">返回业务单据</a><button class="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-print-preview-action="download-pdf">下载 PDF</button><button class="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-print-preview-action="print">打印</button></div></div></div><p class="print-hidden px-3 text-sm" role="status" data-print-ready-feedback></p>${renderTmfProcessSheetTemplate(document)}</div>`
  } catch (error) {
    return renderFailure(error instanceof Error ? error.message : String(error))
  }
}

/** Handle only the TMF print action; all checks happen against the current fact snapshot. */
export function handleTmfProcessPrintPreviewEvent(target: HTMLElement): boolean {
  const action = target.closest<HTMLElement>('[data-print-preview-action]')?.dataset.printPreviewAction
  if (action !== 'print' && action !== 'download-pdf') return false
  void prepareTmfPrint(target.closest<HTMLElement>('[data-print-preview-action]')!)
  return true
}

async function prepareTmfPrint(button: HTMLElement): Promise<void> {
  const root = button.closest<HTMLElement>('.print-preview-root')
  if (!root || root.dataset.preparingPrint === 'true') return
  root.dataset.preparingPrint = 'true'
  const feedback = root.querySelector<HTMLElement>('[data-print-ready-feedback]')
  const controls = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-print-preview-action]'))
  controls.forEach((control) => { control.disabled = true })
  try {
    const current = buildTmfProcessSheetPrintDocument(readInput())
    const printed = root.querySelector<HTMLElement>('[data-tmf-print-signature]')
    if (printed && printed.dataset.tmfPrintSignature !== tmfPrintFactsSignature(current)) {
      throw new Error('加工要求、数量或生产状态已变化，请重新打开预览后核对。')
    }
    if (root.querySelector('[data-print-image-missing]')) throw new Error('资料图片尚未维护，请补齐对应图片后再打印。')
    const deadline = Date.now() + 5000
    while (Array.from(root.querySelectorAll('[data-real-qr]')).some((node) => !node.querySelector('svg'))) {
      if (Date.now() > deadline) throw new Error('二维码尚未生成，请稍后重试。')
      await new Promise((resolve) => setTimeout(resolve, 40))
    }
    if (!root.querySelector('[data-real-barcode] rect')) throw new Error('条码尚未生成，请重新打开任务单。')
    if (feedback) feedback.textContent = '图片和条码已就绪。'
    window.print()
  } catch (error) {
    if (feedback) feedback.textContent = error instanceof Error ? error.message : String(error)
  } finally {
    controls.forEach((control) => { control.disabled = false })
    delete root.dataset.preparingPrint
  }
}
