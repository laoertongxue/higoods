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
import {
  listManualFeiTicketSources,
  recordManualFeiTicketPrint,
} from '../../data/fcs/cutting/manual-fei-tickets.ts'

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

function getOperationReason(): string {
  return (getSearchParams().get('reason') || '').trim()
}

function hasMatchedManualFeiTicket(sourceId: string): boolean {
  const sourceIds = new Set(decodeParam(sourceId).split(',').map((item) => item.trim()).filter(Boolean))
  return listManualFeiTicketSources().some((record) =>
    [record.feiTicketId, record.feiTicketNo, record.sourceOutputLineId].some((value) => sourceIds.has(value)),
  )
}

function inferSourceType(documentType: PrintDocumentType, handoverRecordId: string): PrintSourceType | '' {
  if (documentType === 'PRINTING_INFO_SHEET' || documentType === 'PRINTING_CONFIRMATION') return 'PRINTING_WORK_ORDER'
  if (documentType === 'PRINTING_ROLL_LABEL') return 'PRINTING_ROLL_RECORD'
  if (documentType === 'TASK_DELIVERY_CARD' && handoverRecordId) return 'HANDOVER_RECORD'
  if (documentType === 'MATERIAL_PREP_SLIP') return 'MATERIAL_PREP_RECORD'
  if (documentType === 'PICKUP_SLIP') return 'PICKUP_SLIP_RECORD'
  if (documentType === 'ISSUE_SLIP') return 'ISSUE_SLIP_RECORD'
  if (documentType === 'FEI_TICKET_LABEL') return 'FEI_TICKET_RECORD'
  if (documentType === 'FEI_TICKET_REPRINT_LABEL') return 'FEI_TICKET_RECORD'
  if (documentType === 'TRANSFER_BAG_LABEL') return 'TRANSFER_BAG_RECORD'
  if (documentType === 'TRANSFER_BAG_GOODS_LABEL') return 'TRANSFER_BAG_USAGE_RECORD'
  if (documentType === 'CUTTING_ORDER_QR_LABEL') return 'CUTTING_ORDER_RECORD'
  if (documentType === 'HANDOVER_QR_LABEL') return 'HANDOVER_RECORD'
  if (documentType === 'PRODUCTION_CONFIRMATION') return 'PRODUCTION_ORDER'
  if (documentType === 'SETTLEMENT_CHANGE_REQUEST') return 'SETTLEMENT_CHANGE_REQUEST_RECORD'
  if (documentType === 'HANDOVER_DIFFERENCE_REQUEST') return 'HANDOVER_DIFFERENCE_RECORD'
  if (documentType === 'QUALITY_DEDUCTION_CONFIRMATION') return 'QUALITY_DEDUCTION_PENDING_RECORD'
  if (documentType === 'QUALITY_DISPUTE_PROCESSING') return 'QUALITY_DISPUTE_RECORD'
  if (documentType === 'PRODUCTION_QC_MASTER') return 'POST_FINISHING_TASK'
  if (documentType === 'POST_FINISHING_QC_ORDER') return 'POST_FINISHING_QC_ORDER'
  if (documentType === 'MASTER_DATA_CHANGE_REQUEST') return 'MASTER_DATA_CHANGE_REQUEST_RECORD'
  if (documentType === 'GARMENT_SKU_BARCODE' || documentType === 'GARMENT_HANGTAG') return 'PRODUCTION_ORDER'
  return ''
}

function resolveInput(input?: Partial<PrintDocumentBuildInput>): PrintDocumentBuildInput {
  const params = getSearchParams()
  const documentType = (input?.documentType || params.get('documentType') || 'TASK_ROUTE_CARD') as PrintDocumentType
  const handoverRecordId = input?.handoverRecordId || params.get('handoverRecordId') || ''
  const sourceType = (input?.sourceType
    || params.get('sourceType')
    || inferSourceType(documentType, handoverRecordId)) as PrintSourceType
  const sourceId = input?.sourceId || params.get('sourceId') || handoverRecordId
  const paperColor = input?.paperColor || (params.get('paperColor') as PrintDocumentBuildInput['paperColor']) || undefined
  return {
    documentType,
    sourceType,
    sourceId,
    handoverRecordId,
    paperColor,
  }
}

export function handleUnifiedPrintPreviewEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-print-preview-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.printPreviewAction
  if (action !== 'print' && action !== 'download-pdf') return false
  if (action === 'print') {
    const input = resolveInput()
    if (input.documentType === 'FEI_TICKET_LABEL' || input.documentType === 'FEI_TICKET_REPRINT_LABEL') {
      const document = buildPrintDocument(input)
      recordManualFeiTicketPrint({
        sourceIds: decodeParam(input.sourceId).split(',').map((item) => item.trim()).filter(Boolean),
        printedBy: '裁床打票员',
        reason: getOperationReason(),
        paperColor: document.thermalPaperColor === 'YELLOW' ? 'YELLOW' : 'WHITE',
        templateCode: document.templateCode,
        labelSize: document.labelSize,
      })
    }
  }
  window.print()
  return true
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
  const operationReason = getOperationReason()
  if (
    resolved.documentType === 'FEI_TICKET_REPRINT_LABEL'
    && hasMatchedManualFeiTicket(resolved.sourceId)
    && !operationReason
  ) {
    return renderPreviewFailure('手动菲票补打必须填写补打原因，请返回菲票明细重新发起补打。', '/fcs/craft/cutting/fei-tickets')
  }

  try {
    const document = buildPrintDocument({
      documentType: resolved.documentType,
      sourceType: decodeParam(resolved.sourceType),
      sourceId: decodeParam(resolved.sourceId),
      handoverRecordId: resolved.handoverRecordId ? decodeParam(resolved.handoverRecordId) : undefined,
      paperColor: resolved.paperColor,
    } as PrintDocumentBuildInput)

    return `
      ${renderUnifiedPrintStyles()}
      <div class="print-preview-root">
        <div class="print-preview-toolbar print-hidden">
          <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3 shadow-sm">
            <div>
              <h1 class="text-lg font-semibold">${escapeHtml(document.documentTitle)}打印预览</h1>
              <p class="mt-1 text-xs text-muted-foreground">打印前请在浏览器打印设置中关闭页眉和页脚。该提示不会被打印。</p>
              ${document.thermalPaperColor ? `<p class="mt-2 rounded-md border px-3 py-2 text-sm font-semibold ${document.thermalPaperColor === 'YELLOW' ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-blue-300 bg-blue-50 text-blue-800'}">请再次确认打印机已装入${document.thermalPaperColor === 'YELLOW' ? '黄色' : '白色'}热敏纸；本批次 ${document.totalCopies || 1} 张。</p>` : ''}
              ${resolved.documentType === 'TRANSFER_BAG_GOODS_LABEL' ? `<p class="mt-2 text-xs font-medium text-slate-700">纸张规格：100mm × 100mm 黑白热敏标签；续页必须全部打印并按袋号成套插袋。</p>` : ''}
              ${resolved.documentType === 'FEI_TICKET_REPRINT_LABEL' && operationReason ? `<p class="mt-2 text-xs text-slate-600">补打原因：${escapeHtml(operationReason)}</p>` : ''}
            </div>
            <div class="flex flex-wrap gap-2">
              ${document.printMeta.returnHref ? `<button class="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-nav="${escapeHtml(document.printMeta.returnHref)}">返回业务单据</button>` : ''}
              <button class="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-print-preview-action="download-pdf">下载 PDF</button>
              <button class="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-print-preview-action="print">打印</button>
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
