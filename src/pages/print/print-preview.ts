import { savePartTicketAction } from '../../data/fcs/cutting/part-ticket-records.ts'
import { buildUnifiedPrintPreviewLink } from '../../data/fcs/print-service.ts'
import { appStore } from '../../state/store.ts'
import { recordActualFeiTicketFirstPrintFromPreview } from '../process-factory/cutting/fei-tickets.ts'
import { escapeHtml } from '../../utils.ts'
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

type PrintAdapter = Pick<typeof import('../../data/fcs/print-template-registry.ts'), 'buildPrintDocument' | 'renderPrintDocument'>
/** 部位票和中转袋标签只加载对应模板，避免初始化无关生产确认业务。 */
async function loadPrintAdapter(documentType: PrintDocumentType): Promise<PrintAdapter> {
  if (documentType === 'FEI_TICKET_LABEL' || documentType === 'FEI_TICKET_REPRINT_LABEL'
    || documentType === 'TRANSFER_BAG_LABEL' || documentType === 'TRANSFER_BAG_GOODS_LABEL') {
    const labels = await import('./templates/label-print-template.ts')
    const builders = {
      FEI_TICKET_LABEL: labels.buildFeiTicketLabelPrintDocument,
      FEI_TICKET_REPRINT_LABEL: labels.buildFeiTicketReprintLabelPrintDocument,
      TRANSFER_BAG_LABEL: labels.buildTransferBagLabelPrintDocument,
      TRANSFER_BAG_GOODS_LABEL: labels.buildTransferBagGoodsLabelPrintDocument,
    }
    return { buildPrintDocument: builders[documentType], renderPrintDocument: labels.renderLabelPrintTemplate }
  }
  return import('../../data/fcs/print-template-registry.ts')
}

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

function parseSkuData(value: string | null): PrintDocumentBuildInput['skuData'] {
  if (!value) return undefined
  try {
    const parsed = JSON.parse(value) as unknown
    if (!Array.isArray(parsed)) return undefined
    const rows = parsed.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const skuCode = String((item as { skuCode?: unknown }).skuCode || '').trim()
      const qty = Math.floor(Number((item as { qty?: unknown }).qty))
      return skuCode && Number.isFinite(qty) && qty > 0 ? [{ skuCode, qty }] : []
    })
    return rows.length ? rows : undefined
  } catch {
    return undefined
  }
}

function hasMatchedManualFeiTicket(sourceId: string): boolean {
  const sourceIds = new Set(decodeParam(sourceId).split(',').map((item) => item.trim()).filter(Boolean))
  return listManualFeiTicketSources().some((record) =>
    [record.feiTicketId, record.feiTicketNo, record.sourceOutputLineId].some((value) => sourceIds.has(value)),
  )
}

function inferSourceType(documentType: PrintDocumentType, handoverRecordId: string): PrintSourceType | '' {
  if (documentType === 'DISPATCH_TASK_SHEET') return 'EFFECTIVE_TASK_ASSIGNMENT'
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
  if (documentType === 'POST_FINISHING_OUTBOUND_ORDER' || documentType === 'POST_FINISHING_OUTBOUND_BARCODE') return 'POST_FINISHING_OUTBOUND_ORDER'
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
  const skuData = input?.skuData || parseSkuData(params.get('skuData'))
  return {
    documentType,
    sourceType,
    sourceId,
    handoverRecordId,
    paperColor,
    skuData,
    labelSize: input?.labelSize || params.get('labelSize') as PrintDocumentBuildInput['labelSize'] || undefined,
  }
}

function updatePrintImageState(img: HTMLImageElement, state: 'loading' | 'loaded' | 'error'): void {
  const frame = img.closest<HTMLElement>('[data-print-image-frame]')
  if (!frame) return
  frame.dataset.printImageState = state
  const loading = frame.querySelector<HTMLElement>('[data-print-image-loading]')
  const error = frame.querySelector<HTMLElement>('[data-print-image-error]')
  if (loading) loading.hidden = state !== 'loading'
  if (error) error.hidden = state !== 'error'
  img.style.visibility = state === 'error' ? 'hidden' : 'visible'
}
function bindPrintImages(): void {
  document.querySelectorAll<HTMLImageElement>('.print-preview-root img[data-print-image]').forEach(img => {
    if (!img.dataset.printImageBound) {
      img.dataset.printImageBound = 'true'
      img.addEventListener('load', () => updatePrintImageState(img, 'loaded'))
      img.addEventListener('error', () => updatePrintImageState(img, 'error'))
    }
    updatePrintImageState(img, img.complete ? (img.naturalWidth > 0 ? 'loaded' : 'error') : 'loading')
  })
}

export async function handleUnifiedPrintPreviewEvent(target: HTMLElement): Promise<boolean> {
  const retry = target.closest<HTMLElement>('[data-print-image-retry]')
  if (retry) {
    const img = retry.closest('[data-print-image-frame]')?.querySelector<HTMLImageElement>('img[data-print-image]')
    if (img) { updatePrintImageState(img, 'loading'); const src = img.src; img.removeAttribute('src'); img.src = src }
    return true
  }

  const imageButton = target.closest<HTMLElement>('[data-print-image-url]')
  if (imageButton) {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 print-hidden'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-label', imageButton.dataset.printImageTitle || '图片预览')
    overlay.innerHTML = `<div class="relative max-h-[90vh] max-w-[90vw] rounded-lg bg-white p-3"><button class="absolute right-3 top-3 rounded border bg-white px-3 py-2" data-print-image-close>关闭</button><img class="max-h-[80vh] max-w-full object-contain" src="${escapeHtml(imageButton.dataset.printImageUrl || '')}" alt="${escapeHtml(imageButton.dataset.printImageTitle || '资料图片')}" /><p role="status" data-print-large-image-status>图片加载中…</p><button type="button" data-print-large-retry hidden>重试图片</button></div>`
    const close = () => { overlay.remove(); document.removeEventListener('keydown', onKey, true); imageButton.focus() }
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      close()
    }
    overlay.addEventListener('click', (event) => { if (event.target === overlay || (event.target as HTMLElement).closest('[data-print-image-close]')) close() })
    document.addEventListener('keydown', onKey, true)
    const largeImage = overlay.querySelector<HTMLImageElement>('img')!
    const largeStatus = overlay.querySelector<HTMLElement>('[data-print-large-image-status]')!
    const largeRetry = overlay.querySelector<HTMLButtonElement>('[data-print-large-retry]')!
    const loaded = () => { largeStatus.textContent = ''; largeRetry.hidden = true; largeImage.style.visibility = 'visible' }
    const failed = () => { largeStatus.textContent = `${largeImage.alt}图片加载失败，请重试。`; largeRetry.hidden = false; largeImage.style.visibility = 'hidden' }
    largeImage.addEventListener('load', loaded)
    largeImage.addEventListener('error', failed)
    largeRetry.addEventListener('click', () => { largeStatus.textContent = '图片加载中…'; largeRetry.hidden = true; const src = largeImage.src; largeImage.removeAttribute('src'); largeImage.src = src })
    document.body.append(overlay)
    overlay.querySelector<HTMLButtonElement>('[data-print-image-close]')?.focus()
    if (largeImage.complete) largeImage.naturalWidth ? loaded() : failed()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-print-preview-action]')
  if (!actionNode) return false
  const action = actionNode.dataset.printPreviewAction
  if (action !== 'print' && action !== 'download-pdf') return false
  const input = resolveInput()
  if (['DISPATCH_TASK_SHEET', 'PRODUCTION_CONFIRMATION', 'TMF_PROCESS_SHEET', 'TMF_PACKAGE_LABEL', 'TMF_HANDOVER_SHEET', 'TRANSFER_BAG_GOODS_LABEL'].includes(input.documentType)) {
    void prepareVerifiedDocumentPrint(actionNode)
    return true
  }
  if (action === 'print') {
    if (input.documentType === 'FEI_TICKET_LABEL' || input.documentType === 'FEI_TICKET_REPRINT_LABEL') {
      const document = (await loadPrintAdapter(input.documentType)).buildPrintDocument(input)
      try {
        await savePartTicketAction({ intent: JSON.stringify(input), action: () => {
      if (input.documentType === 'FEI_TICKET_LABEL') {
        recordActualFeiTicketFirstPrintFromPreview({
          sourceIds: decodeParam(input.sourceId).split(',').map((item) => item.trim()).filter(Boolean),
          operator: '裁床打票员',
          templateName: document.templateCode,
        })
      }
      recordManualFeiTicketPrint({
        sourceIds: decodeParam(input.sourceId).split(',').map((item) => item.trim()).filter(Boolean),
        printedBy: '裁床打票员',
        reason: getOperationReason(),
        paperColor: document.thermalPaperColor === 'YELLOW' ? 'YELLOW' : 'WHITE',
        templateCode: document.templateCode,
        labelSize: document.labelSize,
      })
        } })
      } catch (error) {
        const feedback = actionNode.closest('.print-preview-root')?.querySelector<HTMLElement>('[data-print-ready-feedback]')
        if (feedback) feedback.textContent = `尚未保存打印记录：${error instanceof Error ? error.message : String(error)}`
        else window.alert(`尚未保存打印记录：${error instanceof Error ? error.message : String(error)}`)
        return true
      }
    }
  }
  window.print()
  return true
}

async function prepareVerifiedDocumentPrint(button: HTMLElement): Promise<void> {
  const root = button.closest<HTMLElement>('.print-preview-root')
  if (!root || root.dataset.preparingPrint === 'true') return
  root.dataset.preparingPrint = 'true'
  const feedback = root.querySelector<HTMLElement>('[data-print-ready-feedback]')
  const controls = Array.from(root.querySelectorAll<HTMLButtonElement>('[data-print-preview-action]'))
  controls.forEach((control) => { control.disabled = true })
  if (feedback) feedback.textContent = '正在准备图片和条码…'
  try {
    const {buildPrintDocument} = await loadPrintAdapter(resolveInput().documentType)
    const tmfPrintFactsSignature = root.querySelector('[data-tmf-print-signature]')
      ? (await import('./templates/tmf-process-sheet-template.ts')).tmfPrintFactsSignature : undefined
    const verifyTmfFacts = () => {
      const printed = root.querySelector<HTMLElement>('[data-tmf-print-signature]')
      if (printed && tmfPrintFactsSignature && printed.dataset.tmfPrintSignature !== tmfPrintFactsSignature(buildPrintDocument(resolveInput()))) throw new Error('加工要求、数量或生产状态已变化，请重新打开预览后核对。')
    }
    verifyTmfFacts()
    if (root.querySelector('[data-print-image-missing]')) throw new Error('资料图片尚未维护，请补齐对应图片后再打印。')
    const images = Array.from(root.querySelectorAll<HTMLImageElement>('img[data-print-image]'))
    await Promise.all(images.map(async (img) => {
      try {
        if (img.complete && !img.naturalWidth) {
          if (resolveInput().documentType === 'TRANSFER_BAG_GOODS_LABEL') throw new Error('请先重试面料图片')
          const src = img.src; img.removeAttribute('src'); img.src = src
        }
        await Promise.race([img.decode(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('图片加载超时')), 10000))])
        if (!img.naturalWidth) throw new Error()
        updatePrintImageState(img, 'loaded')
      } catch {
        updatePrintImageState(img, 'error')
        throw new Error(`${img.alt || '资料图片'}尚未加载，打印未开始；请检查图片后重试。`)
      }
    }))
    const deadline = Date.now() + 5000
    while (Array.from(root.querySelectorAll('[data-real-qr]')).some((node) => !node.querySelector('svg'))) {
      if (Date.now() > deadline) throw new Error('二维码尚未生成，请稍后重试。')
      await new Promise((resolve) => setTimeout(resolve, 40))
    }
    verifyTmfFacts()
    for (const paper of root.querySelectorAll<HTMLElement>('[data-tmf-label-paper]')) {
      if (paper.scrollHeight > paper.clientHeight + 1 || paper.scrollWidth > paper.clientWidth + 1) throw new Error('标签内容超出当前纸张，请切换A4预览并核对排版。')
    }
    if (!['TMF_PACKAGE_LABEL','TMF_HANDOVER_SHEET','TRANSFER_BAG_GOODS_LABEL'].includes(resolveInput().documentType) && !root.querySelector('[data-real-barcode] rect')) throw new Error('条码尚未生成，请重新打开任务单。')
    if (feedback) feedback.textContent = '图片和条码已就绪。'
    window.print()
  } catch (error) {
    if (feedback) feedback.textContent = error instanceof Error ? error.message : String(error)
  } finally {
    controls.forEach((control) => { control.disabled = false })
    delete root.dataset.preparingPrint
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

export async function renderUnifiedPrintPreviewPage(input?: Partial<PrintDocumentBuildInput>): Promise<string> {
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
    const {buildPrintDocument, renderPrintDocument} = await loadPrintAdapter(resolved.documentType)
    const document = buildPrintDocument({
      documentType: resolved.documentType,
      sourceType: decodeParam(resolved.sourceType),
      sourceId: resolved.documentType.startsWith('TMF_') ? resolved.sourceId : decodeParam(resolved.sourceId),
      handoverRecordId: resolved.handoverRecordId ? decodeParam(resolved.handoverRecordId) : undefined,
      paperColor: resolved.paperColor,
      skuData: resolved.skuData,
      labelSize: resolved.labelSize,
    } as PrintDocumentBuildInput)

    if (typeof window !== 'undefined' && typeof window.setTimeout === 'function') window.setTimeout(bindPrintImages, 0)
    return `
      ${renderUnifiedPrintStyles()}
      <div class="print-preview-root" ${['DISPATCH_TASK_SHEET', 'PRODUCTION_CONFIRMATION', 'TMF_PROCESS_SHEET', 'TMF_PACKAGE_LABEL', 'TMF_HANDOVER_SHEET', 'TRANSFER_BAG_GOODS_LABEL'].includes(resolved.documentType) ? 'data-skip-page-rerender="true"' : ''}>
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
              ${resolved.documentType === 'TMF_PACKAGE_LABEL' ? `<span class="text-xs">现场尺寸待确认 · 共 ${document.totalCopies} 包／张</span>${(['LABEL_150_100','A4'] as const).map(size => `<button class="rounded border px-3 py-2 text-sm" data-nav="${escapeHtml(buildUnifiedPrintPreviewLink({...resolved,labelSize:size}))}">${size==='A4'?'A4预览':'150×100mm预览'}</button>`).join('')}` : ''}
              <button class="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-print-preview-action="download-pdf">下载 PDF</button>
              <button class="rounded-md border px-3 py-2 text-sm hover:bg-slate-50" data-print-preview-action="print">打印</button>
            </div>
          </div>
        </div>
        <p class="print-hidden px-3 text-sm" role="status" data-print-ready-feedback></p>
        ${renderPrintDocument(document)}
      </div>
    `
  } catch (error) {
    return renderPreviewFailure(error instanceof Error ? error.message : String(error))
  }
}

export function renderPrintPreviewPage(): string | Promise<string> {
  if (getSearchParams().get('documentType') === 'REPLACEMENT_FABRIC_LABEL') {
    return import('./replacement-fabric-preview.ts').then(module => module.renderReplacementFabricPrintPreview())
  }
  return renderUnifiedPrintPreviewPage()
}
