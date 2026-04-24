import { escapeHtml } from '../../../utils.ts'

export function formatGarmentQty(value: number | undefined, unit = '件'): string {
  const safeValue = Number.isFinite(value) ? Number(value) : 0
  return `${safeValue.toLocaleString('zh-CN')} ${unit}`
}

export function renderPostFinishingPageHeader(title: string, description = ''): string {
  return `
    <header class="rounded-2xl border bg-white p-5 shadow-sm">
      <h1 class="text-2xl font-semibold text-foreground">${escapeHtml(title)}</h1>
      ${description ? `<p class="mt-2 text-sm text-muted-foreground">${escapeHtml(description)}</p>` : ''}
    </header>
  `
}

export function renderPostMetricCard(label: string, value: string, description: string): string {
  return `
    <article class="rounded-2xl border bg-white p-4 shadow-sm">
      <div class="text-sm text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-2 text-2xl font-semibold text-foreground">${escapeHtml(value)}</div>
      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(description)}</div>
    </article>
  `
}

export function renderPostSection(title: string, body: string): string {
  return `
    <section class="rounded-2xl border bg-white p-4 shadow-sm">
      <h2 class="text-base font-semibold text-foreground">${escapeHtml(title)}</h2>
      <div class="mt-4">${body}</div>
    </section>
  `
}

export function renderPostStatusBadge(status: string): string {
  const tone = status.includes('差异')
    ? 'border-rose-200 bg-rose-50 text-rose-700'
    : status.includes('完成') || status.includes('已回写')
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status.includes('中')
        ? 'border-blue-200 bg-blue-50 text-blue-700'
        : 'border-amber-200 bg-amber-50 text-amber-700'
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${tone}">${escapeHtml(status)}</span>`
}

export function renderPostTable(headers: string[], rows: string, minWidth = 'min-w-[1120px]'): string {
  return `
    <div class="overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <table class="w-full ${minWidth} table-auto border-collapse text-sm">
        <thead class="bg-slate-50 text-left text-slate-600">
          <tr>${headers.map((header) => `<th class="px-3 py-3 font-medium">${escapeHtml(header)}</th>`).join('')}</tr>
        </thead>
        <tbody class="divide-y">${rows}</tbody>
      </table>
    </div>
  `
}

export function renderPostAction(label: string, href: string, disabled = false): string {
  if (disabled) return `<button type="button" class="rounded-md border px-2 py-1 text-xs opacity-50" disabled>${escapeHtml(label)}</button>`
  return `<button type="button" class="rounded-md border px-2 py-1 text-xs hover:bg-slate-50" data-nav="${escapeHtml(href)}">${escapeHtml(label)}</button>`
}
