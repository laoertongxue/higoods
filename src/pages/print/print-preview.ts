import { appStore } from '../../state/store.ts'
import { escapeHtml } from '../../utils.ts'
import {
  buildPrintDocument,
  renderPrintDocument,
} from '../../data/fcs/print-template-registry.ts'
import type {
  PrintDocumentBuildInput,
  PrintDocumentType,
  PrintSourceType,
} from '../../data/fcs/print-service.ts'
import { renderUnifiedPrintStyles } from './print-styles.ts'

function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function getSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return new URLSearchParams(query ?? '')
}

function resolveInput(input?: Partial<PrintDocumentBuildInput>): PrintDocumentBuildInput {
  const params = getSearchParams()
  const documentType = (input?.documentType || params.get('documentType') || 'TASK_ROUTE_CARD') as PrintDocumentType
  const handoverRecordId = input?.handoverRecordId || params.get('handoverRecordId') || ''
  const sourceType = (input?.sourceType
    || params.get('sourceType')
    || (documentType === 'TASK_DELIVERY_CARD' && handoverRecordId ? 'HANDOVER_RECORD' : '')) as PrintSourceType
  const sourceId = input?.sourceId || params.get('sourceId') || handoverRecordId
  return {
    documentType,
    sourceType,
    sourceId,
    handoverRecordId,
  }
}

function renderPreviewFailure(message: string, backHref = '/fcs/progress/board'): string {
  return `
    ${renderUnifiedPrintStyles()}
    <div class="print-preview-root">
      <div class="print-preview-toolbar print-hidden">
        <button class="rounded-md border bg-white px-3 py-2 text-sm hover:bg-slate-50" data-nav="${escapeHtml(backHref)}">返回</button>
      </div>
      <article class="print-paper-a4">
        <div class="print-card-sheet">
          <div class="print-card-title">打印预览无法生成</div>
          <div class="print-section">
            <div class="print-image-placeholder">${escapeHtml(message)}</div>
          </div>
        </div>
      </article>
    </div>
  `
}

export function renderUnifiedPrintPreviewPage(input?: Partial<PrintDocumentBuildInput>): string {
  const resolved = resolveInput(input)
  if (!resolved.sourceType || !resolved.sourceId) {
    return renderPreviewFailure('缺少打印来源或来源 ID，无法生成打印预览。')
  }

  try {
    const document = buildPrintDocument({
      documentType: resolved.documentType,
      sourceType: decodeParam(resolved.sourceType),
      sourceId: decodeParam(resolved.sourceId),
      handoverRecordId: resolved.handoverRecordId ? decodeParam(resolved.handoverRecordId) : undefined,
    } as PrintDocumentBuildInput)

    return `
      ${renderUnifiedPrintStyles()}
      <div class="print-preview-root">
        <div class="print-preview-toolbar print-hidden">
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3 shadow-sm">
            <div>
              <h1 class="text-lg font-semibold">${escapeHtml(document.documentTitle)}打印预览</h1>
              <p class="mt-1 text-xs text-muted-foreground">打印前请在浏览器打印设置中关闭页眉和页脚。该提示不会被打印。</p>
            </div>
            <div class="flex flex-wrap gap-2">
              ${document.printMeta.returnHref ? `<button class="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-nav="${escapeHtml(document.printMeta.returnHref)}">返回业务单据</button>` : ''}
              <button class="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" onclick="window.print()">打印</button>
            </div>
          </div>
        </div>
        ${renderPrintDocument(document)}
      </div>
    `
  } catch (error) {
    return renderPreviewFailure(error instanceof Error ? error.message : String(error))
  }
}

export function renderPrintPreviewPage(): string {
  return renderUnifiedPrintPreviewPage()
}
