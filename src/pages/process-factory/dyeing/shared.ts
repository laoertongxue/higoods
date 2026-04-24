import { appStore } from '../../../state/store'
import { escapeHtml } from '../../../utils'
import {
  getDyeExecutionNodeRecord,
  getDyeReviewStatusLabel,
  getDyeWorkOrderStatusLabel,
  type DyeExecutionNodeCode,
  type DyeReviewStatus,
  type DyeWorkOrder,
  type DyeWorkOrderStatus,
} from '../../../data/fcs/dyeing-task-domain.ts'

type BadgeTone = 'muted' | 'info' | 'warning' | 'success' | 'danger'

export function getDyeingSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname || ''
  const query = pathname.split('?')[1] || ''
  return new URLSearchParams(query)
}

export function getSelectedDyeOrderId(fallbackId = ''): string {
  return getDyeingSearchParams().get('dyeOrderId') || fallbackId
}

export function buildDyeingHref(path: string, dyeOrderId?: string): string {
  if (!dyeOrderId) return path
  return `${path}?dyeOrderId=${encodeURIComponent(dyeOrderId)}`
}

export function formatDyeQty(value: number | undefined, unit: string | undefined): string {
  return `${value ?? 0} ${escapeHtml(unit || '米')}`
}

export function formatDyeTime(value: string | undefined): string {
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

export function renderWorkOrderStatusBadge(status: DyeWorkOrderStatus): string {
  const tone: BadgeTone =
    status === 'COMPLETED'
      ? 'success'
      : status === 'REJECTED'
        ? 'danger'
        : status === 'WAIT_HANDOVER' || status === 'HANDOVER_SUBMITTED' || status === 'WAIT_REVIEW'
          ? 'warning'
          : ['DYEING', 'DEHYDRATING', 'DRYING', 'SETTING', 'ROLLING', 'PACKING', 'SAMPLE_TESTING'].includes(status)
            ? 'info'
            : 'muted'
  return renderBadge(getDyeWorkOrderStatusLabel(status), tone)
}

export function renderReviewStatusBadge(status: DyeReviewStatus): string {
  const tone: BadgeTone =
    status === 'PASS'
      ? 'success'
      : status === 'REJECTED'
        ? 'danger'
        : status === 'WAIT_REVIEW'
          ? 'warning'
          : 'info'
  return renderBadge(getDyeReviewStatusLabel(status), tone)
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
      data-dyeing-action="${escapeHtml(input.action)}"
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

export function getDyeNodeRecord(orderId: string, nodeCode: DyeExecutionNodeCode) {
  return getDyeExecutionNodeRecord(orderId, nodeCode)
}

export function getDyeVatSummary(order: DyeWorkOrder): {
  dyeVatNo: string
  outputQty: number
} {
  const dyeNode = getDyeNodeRecord(order.dyeOrderId, 'DYE')
  const packNode = getDyeNodeRecord(order.dyeOrderId, 'PACK')
  return {
    dyeVatNo: dyeNode?.dyeVatNo || getDyeNodeRecord(order.dyeOrderId, 'VAT_PLAN')?.dyeVatNo || '未排缸',
    outputQty: packNode?.outputQty ?? dyeNode?.outputQty ?? 0,
  }
}
