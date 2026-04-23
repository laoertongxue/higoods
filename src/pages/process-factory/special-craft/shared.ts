import type { SpecialCraftOperationDefinition } from '../../../data/fcs/special-craft-operations.ts'
import {
  buildSpecialCraftStatisticsPath,
  buildSpecialCraftTaskOrdersPath,
  buildSpecialCraftWarehousePath,
} from '../../../data/fcs/special-craft-operations.ts'
import { escapeHtml, formatDateTime } from '../../../utils.ts'

type MetricCard = {
  label: string
  value: string
  tone?: 'slate' | 'blue' | 'green' | 'amber' | 'red' | 'violet'
}

type SubNavKey = 'tasks' | 'warehouse' | 'statistics'

function toneClass(tone: MetricCard['tone']): string {
  if (tone === 'green') return 'border-emerald-200 bg-emerald-50 text-emerald-700'
  if (tone === 'blue') return 'border-blue-200 bg-blue-50 text-blue-700'
  if (tone === 'amber') return 'border-amber-200 bg-amber-50 text-amber-700'
  if (tone === 'red') return 'border-rose-200 bg-rose-50 text-rose-700'
  if (tone === 'violet') return 'border-violet-200 bg-violet-50 text-violet-700'
  return 'border-slate-200 bg-slate-50 text-slate-700'
}

export function formatQty(value: number | undefined): string {
  const safeValue = Number.isFinite(value) ? Number(value) : 0
  return safeValue.toLocaleString('zh-CN', { maximumFractionDigits: 2 })
}

export function renderStatusBadge(label: string): string {
  const tone =
    label.includes('差异') || label.includes('异议') || label.includes('异常')
      ? 'red'
      : label.includes('待领料') || label.includes('待交出')
        ? 'amber'
        : label.includes('加工中')
          ? 'blue'
          : label.includes('已完成') || label.includes('已回写') || label.includes('已入')
            ? 'green'
            : 'slate'
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${toneClass(tone)}">${escapeHtml(label)}</span>`
}

export function renderMetricCards(cards: MetricCard[]): string {
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${cards
        .map(
          (card) => `
            <article class="rounded-2xl border bg-white p-4 shadow-sm">
              <div class="text-sm text-muted-foreground">${escapeHtml(card.label)}</div>
              <div class="mt-2 text-2xl font-semibold ${toneClass(card.tone).split(' ').at(-1)}">${escapeHtml(card.value)}</div>
            </article>
          `,
        )
        .join('')}
    </section>
  `
}

export function renderFilterGrid(items: Array<{ label: string; value: string }>): string {
  return `
    <section class="rounded-2xl border bg-white p-4 shadow-sm">
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${items
          .map(
            (item) => `
              <div class="space-y-1">
                <div class="text-xs font-medium text-muted-foreground">${escapeHtml(item.label)}</div>
                <div class="rounded-xl border bg-slate-50 px-3 py-2 text-sm text-foreground">${escapeHtml(item.value)}</div>
              </div>
            `,
          )
          .join('')}
      </div>
    </section>
  `
}

export function renderTable(headers: string[], rows: string, minWidthClass = 'min-w-[1520px]'): string {
  return `
    <div class="overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <table class="w-full ${minWidthClass} table-auto border-collapse text-sm">
        <thead class="bg-slate-50 text-left text-slate-600">
          <tr>
            ${headers.map((header) => `<th class="px-3 py-3 font-medium">${escapeHtml(header)}</th>`).join('')}
          </tr>
        </thead>
        <tbody class="divide-y">${rows}</tbody>
      </table>
    </div>
  `
}

export function renderEmptyState(message = '暂无数据'): string {
  return `
    <div class="rounded-2xl border border-dashed bg-white px-6 py-10 text-center text-sm text-muted-foreground">
      ${escapeHtml(message)}
    </div>
  `
}

export function renderSpecialCraftPageLayout(input: {
  operation: SpecialCraftOperationDefinition
  title: string
  description: string
  activeSubNav: SubNavKey
  content: string
}): string {
  const { operation, title, description, activeSubNav, content } = input
  const subNavItems: Array<{ key: SubNavKey; label: string; href: string }> = [
    { key: 'tasks', label: `${operation.operationName}任务单`, href: buildSpecialCraftTaskOrdersPath(operation) },
    { key: 'warehouse', label: `${operation.operationName}仓库管理`, href: buildSpecialCraftWarehousePath(operation) },
    { key: 'statistics', label: `${operation.operationName}统计`, href: buildSpecialCraftStatisticsPath(operation) },
  ]

  return `
    <div class="space-y-4">
      <header class="rounded-2xl border bg-white p-5 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div class="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">特殊工艺</div>
            <h1 class="mt-3 text-2xl font-semibold text-foreground">${escapeHtml(title)}</h1>
            <p class="mt-2 text-sm text-muted-foreground">${escapeHtml(description)}</p>
          </div>
          <div class="rounded-2xl border bg-slate-50 px-4 py-3 text-sm">
            <div class="text-xs text-muted-foreground">当前特殊工艺</div>
            <div class="mt-1 font-medium text-foreground">${escapeHtml(operation.operationName)}</div>
            <div class="mt-2 text-xs text-muted-foreground">作用对象：${escapeHtml(operation.targetObject)}</div>
          </div>
        </div>
        <div class="mt-4 flex flex-wrap gap-2 border-t pt-4">
          ${subNavItems
            .map((item) => {
              const active = item.key === activeSubNav
              return `
                <button
                  type="button"
                  class="inline-flex items-center rounded-xl border px-3 py-2 text-sm ${
                    active
                      ? 'border-blue-200 bg-blue-50 font-medium text-blue-700'
                      : 'bg-white text-foreground hover:bg-slate-50'
                  }"
                  data-nav="${item.href}"
                >
                  ${escapeHtml(item.label)}
                </button>
              `
            })
            .join('')}
        </div>
      </header>
      ${content}
    </div>
  `
}

export function renderLinkedRecord(recordNo: string | undefined, href: string | undefined, fallback = '—'): string {
  if (!recordNo || !href) return fallback
  return `<button type="button" class="text-left text-blue-700 hover:underline" data-nav="${escapeHtml(href)}">${escapeHtml(recordNo)}</button>`
}

export function renderDateTime(value: string | undefined): string {
  if (!value) return '—'
  return escapeHtml(formatDateTime(value))
}
