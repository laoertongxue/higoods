import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import {
  getPrintExecutionNodeRecord,
  getPrintReviewStatusLabel,
  getPrintWorkOrderStatusLabel,
  type PrintExecutionNodeCode,
  type PrintReviewStatus,
  type PrintWorkOrder,
  type PrintWorkOrderStatus,
} from '../../../data/fcs/printing-task-domain.ts'
import {
  getQuantityLabel,
  formatProcessQuantityWithUnit,
  type ProcessQuantityContext,
} from '../../../data/fcs/process-quantity-labels.ts'

type BadgeTone = 'muted' | 'info' | 'warning' | 'success' | 'danger'

export function getPrintingSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname || ''
  const query = pathname.split('?')[1] || ''
  return new URLSearchParams(query)
}

export function getSelectedPrintOrderId(fallbackId = ''): string {
  return getPrintingSearchParams().get('printOrderId') || fallbackId
}

export function buildPrintingHref(path: string, printOrderId?: string): string {
  if (!printOrderId) return path
  return `${path}?printOrderId=${encodeURIComponent(printOrderId)}`
}

export function formatPrintQty(value: number | undefined, unit: string | undefined): string {
  return `${value ?? 0} ${escapeHtml(unit || '片')}`
}

export function getPrintQuantityContext(
  order: Pick<PrintWorkOrder, 'printOrderId' | 'objectType' | 'qtyUnit' | 'isPiecePrinting' | 'isFabricPrinting'>,
  qtyPurpose: ProcessQuantityContext['qtyPurpose'] = '计划',
  operationCode?: string,
): ProcessQuantityContext {
  return {
    processType: 'PRINT',
    sourceType: 'PRINT_WORK_ORDER',
    sourceId: order.printOrderId,
    objectType: order.objectType,
    qtyUnit: order.qtyUnit,
    qtyPurpose,
    operationCode,
    isPiecePrinting: order.isPiecePrinting,
    isFabricPrinting: order.isFabricPrinting,
  }
}

export function getPrintQuantityLabel(
  order: Pick<PrintWorkOrder, 'printOrderId' | 'objectType' | 'qtyUnit' | 'isPiecePrinting' | 'isFabricPrinting'>,
  qtyPurpose: ProcessQuantityContext['qtyPurpose'] = '计划',
  operationCode?: string,
): string {
  return getQuantityLabel(getPrintQuantityContext(order, qtyPurpose, operationCode))
}

export function formatPrintProcessQty(
  order: Pick<PrintWorkOrder, 'printOrderId' | 'objectType' | 'qtyUnit' | 'isPiecePrinting' | 'isFabricPrinting'>,
  value: number | undefined,
  qtyPurpose: ProcessQuantityContext['qtyPurpose'] = '计划',
  operationCode?: string,
): string {
  return escapeHtml(formatProcessQuantityWithUnit(value, getPrintQuantityContext(order, qtyPurpose, operationCode)))
}

export function formatPrintTime(value: string | undefined): string {
  return value ? escapeHtml(value) : '—'
}

export function renderBadge(label: string, tone: BadgeTone = 'muted'): string {
  const className =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'warning'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'danger'
          ? 'border-red-200 bg-red-50 text-red-700'
          : tone === 'info'
            ? 'border-blue-200 bg-blue-50 text-blue-700'
            : 'border-slate-200 bg-slate-50 text-slate-700'

  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${className}">${escapeHtml(label)}</span>`
}

export function renderWorkOrderStatusBadge(status: PrintWorkOrderStatus): string {
  const tone: BadgeTone =
    status === 'COMPLETED'
      ? 'success'
      : status === 'REJECTED'
        ? 'danger'
        : status === 'WAIT_HANDOVER' || status === 'HANDOVER_SUBMITTED' || status === 'WAIT_REVIEW'
          ? 'warning'
          : status === 'PRINTING' || status === 'TRANSFERRING' || status === 'REVIEWING'
            ? 'info'
            : 'muted'
  return renderBadge(getPrintWorkOrderStatusLabel(status), tone)
}

export function renderReviewStatusBadge(status: PrintReviewStatus): string {
  const tone: BadgeTone =
    status === 'PASS'
      ? 'success'
      : status === 'REJECTED'
        ? 'danger'
        : status === 'WAIT_REVIEW'
          ? 'warning'
          : 'info'
  return renderBadge(getPrintReviewStatusLabel(status), tone)
}

export function renderMetricCard(title: string, value: string, helper = ''): string {
  return `
    <article class="rounded-lg border bg-card px-4 py-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(title)}</div>
      <div class="mt-2 text-2xl font-semibold text-foreground">${escapeHtml(value)}</div>
      ${helper ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(helper)}</div>` : ''}
    </article>
  `
}

export function renderSection(title: string, body: string, actionHtml = ''): string {
  return `
    <section class="rounded-lg border bg-card">
      <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 class="text-sm font-semibold">${escapeHtml(title)}</h2>
        ${actionHtml}
      </header>
      <div class="p-4">${body}</div>
    </section>
  `
}

export function renderActionButton(input: {
  label: string
  action: string
  attrs?: Record<string, string | number | undefined>
  tone?: 'default' | 'primary' | 'danger'
  disabled?: boolean
  fullWidth?: boolean
}): string {
  const toneClass =
    input.tone === 'primary'
      ? 'border-primary bg-primary text-primary-foreground hover:bg-primary/90'
      : input.tone === 'danger'
        ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
        : 'border-slate-200 bg-white text-foreground hover:bg-muted'
  const attrs = Object.entries(input.attrs || {})
    .filter(([key]) => !(input.action === 'navigate' && key === 'href'))
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `data-${key}="${escapeHtml(String(value))}"`)
    .join(' ')
  const widthClass = input.fullWidth ? 'w-full' : ''
  const href = input.action === 'navigate' ? input.attrs?.href : undefined
  if (href && !input.disabled) {
    const escapedHref = escapeHtml(String(href))
    return `
      <a
        role="button"
        class="inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs ${toneClass} ${widthClass}"
        href="${escapedHref}"
        data-nav="${escapedHref}"
        ${attrs}
      >
        ${escapeHtml(input.label)}
      </a>
    `
  }
  return `
    <button
      class="inline-flex h-8 items-center justify-center rounded-md border px-3 text-xs ${toneClass} ${widthClass} disabled:cursor-not-allowed disabled:opacity-50"
      data-printing-action="${escapeHtml(input.action)}"
      ${attrs}
      ${input.disabled ? 'disabled' : ''}
    >
      ${escapeHtml(input.label)}
    </button>
  `
}

export function renderPageHeader(title: string, subtitle: string, actionHtml = ''): string {
  return `
    <header class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-semibold text-foreground">${escapeHtml(title)}</h1>
        ${subtitle.trim() ? `<p class="mt-1 text-sm text-muted-foreground">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      ${actionHtml}
    </header>
  `
}

export function getPrintNodeRecord(orderId: string, nodeCode: PrintExecutionNodeCode) {
  return getPrintExecutionNodeRecord(orderId, nodeCode)
}

export function getPrintPrinterSummary(order: PrintWorkOrder): {
  printerNo: string
  speedText: string
  outputQty: number
} {
  const printNode = getPrintNodeRecord(order.printOrderId, 'PRINT')
  return {
    printerNo: printNode?.printerNo || '未开始',
    speedText: printNode?.printerSpeedPerHour ? `${printNode.printerSpeedPerHour} 米/小时` : '—',
    outputQty: printNode?.outputQty ?? 0,
  }
}

export function getPrintTransferSummary(order: PrintWorkOrder): {
  usedMaterialQty: number
  actualCompletedQty: number
} {
  const transferNode = getPrintNodeRecord(order.printOrderId, 'TRANSFER')
  return {
    usedMaterialQty: transferNode?.usedMaterialQty ?? 0,
    actualCompletedQty: transferNode?.actualCompletedQty ?? 0,
  }
}
