import { appStore } from '../../state/store.ts'
import { escapeHtml } from '../../utils.ts'
import { renderUnifiedPrintStyles } from './print-styles.ts'
import { buildPrintingConfirmationDocument, buildPrintingInfoSheetDocument, renderPrintingConfirmationDocument, renderPrintingInfoSheetDocument } from './templates/printing-sheet-template.ts'

/** The two online printing forms do not need the other factories' print registries. */
export function renderPrintingSheetPreview(): string {
  const params = new URLSearchParams(appStore.getState().pathname.split('?')[1] || '')
  const confirmation = params.get('documentType') === 'PRINTING_CONFIRMATION'
  let paper: string, title: string
  try {
    const input = { sourceType: 'PRINTING_WORK_ORDER' as const, sourceId: params.get('sourceId') || '', documentType: confirmation ? 'PRINTING_CONFIRMATION' as const : 'PRINTING_INFO_SHEET' as const }
    const document = confirmation ? buildPrintingConfirmationDocument(input) : buildPrintingInfoSheetDocument(input)
    title = document.documentTitle
    paper = confirmation ? renderPrintingConfirmationDocument(document) : renderPrintingInfoSheetDocument(document)
  } catch (error) {
    return `${renderUnifiedPrintStyles()}<div class="print-preview-root"><div class="print-preview-toolbar"><a href="/fcs/craft/printing/work-orders" data-nav="/fcs/craft/printing/work-orders">返回印花加工单</a><p role="alert">${escapeHtml(error instanceof Error ? error.message : String(error))}</p></div></div>`
  }
  return `${renderUnifiedPrintStyles()}<div class="print-preview-root"><div class="print-preview-toolbar print-hidden"><div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3 shadow-sm"><div><h1 class="text-lg font-semibold">${escapeHtml(title)}打印预览</h1><p class="mt-1 text-xs text-muted-foreground">A4 纵向；请关闭页眉和页脚。下载时选择“另存为 PDF”。</p></div><div class="flex gap-2"><a class="rounded-md border px-3 py-2 text-sm" href="/fcs/craft/printing/work-orders" data-nav="/fcs/craft/printing/work-orders">返回印花加工单</a><button class="rounded-md border px-3 py-2 text-sm" data-printing-sheet-print>下载 PDF</button><button class="rounded-md border px-3 py-2 text-sm" data-printing-sheet-print>打印</button></div></div></div>${paper}</div>`
}
