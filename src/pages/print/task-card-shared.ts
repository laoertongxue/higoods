import { appStore } from '../../state/store.ts'
import { escapeHtml } from '../../utils.ts'
import type {
  TaskPrintBuildFailure,
  TaskPrintInfoRow,
  TaskRouteCardRecordRow,
} from '../../data/fcs/task-print-cards.ts'

export function getCurrentPrintSearchParams(): URLSearchParams {
  const pathname = appStore.getState().pathname
  const [, query] = pathname.split('?')
  return new URLSearchParams(query ?? '')
}

export function renderPrintStyles(): string {
  return `
    <style>
      @media print {
        .print-actions { display: none !important; }
        .print-page { padding: 0 !important; background: #fff !important; }
        .print-sheet { border: none !important; box-shadow: none !important; padding: 0 !important; }
        .print-break-avoid { break-inside: avoid; }
      }
    </style>
  `
}

export function renderFailure(failure: TaskPrintBuildFailure, backHref: string): string {
  return `
    ${renderPrintStyles()}
    <div class="print-page bg-muted/20 p-4">
      <header class="print-actions mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">${escapeHtml(failure.title)}打印预览</h1>
          <p class="mt-1 text-sm text-muted-foreground">当前单据无法生成</p>
        </div>
        <button class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(backHref)}">返回</button>
      </header>
      <article class="print-sheet rounded-xl border bg-background p-6 shadow-sm">
        <div class="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">${escapeHtml(failure.message)}</div>
      </article>
    </div>
  `
}

export function renderTextValue(value: string | number | undefined | null, fallback = '待确认'): string {
  if (value === undefined || value === null || String(value).trim().length === 0) {
    return fallback ? `<span class="text-muted-foreground">${escapeHtml(fallback)}</span>` : ''
  }
  return escapeHtml(String(value))
}

export function renderInfoGrid(rows: TaskPrintInfoRow[], importantLabels: string[] = []): string {
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      ${rows
        .map((row) => {
          const strong = importantLabels.includes(row.label)
          return `
            <div class="rounded-lg border bg-card p-3">
              <div class="text-xs text-muted-foreground">${escapeHtml(row.label)}</div>
              <div class="mt-1 text-sm ${strong ? 'font-semibold' : 'font-medium'}">${renderTextValue(row.value)}</div>
            </div>
          `
        })
        .join('')}
    </div>
  `
}

export function renderImageSection(input: {
  imageUrl: string
  imageLabel: string
  imageSourceLabel: string
  title: string
}): string {
  return `
    <section class="print-break-avoid space-y-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-lg font-semibold">商品图片</h3>
        <span class="rounded-md border bg-muted px-2 py-1 text-xs text-muted-foreground">${escapeHtml(input.imageSourceLabel)}</span>
      </div>
      <figure class="overflow-hidden rounded-lg border bg-white">
        <img src="${escapeHtml(input.imageUrl)}" alt="${escapeHtml(input.imageLabel || input.title)}" class="h-64 w-full object-contain" />
        <figcaption class="border-t px-3 py-2 text-xs text-muted-foreground">${escapeHtml(input.imageLabel || '商品图片')}</figcaption>
      </figure>
    </section>
  `
}

function padRouteRows(rows: TaskRouteCardRecordRow[]): TaskRouteCardRecordRow[] {
  const minRows = 8
  if (rows.length >= minRows) return rows
  const appended = Array.from({ length: minRows - rows.length }, (_, index) => ({
    rowId: `EMPTY-${index + 1}`,
    node: '',
    startedAt: '',
    finishedAt: '',
    completedQty: '',
    exceptionQty: '',
    station: '',
    operator: '',
    remark: '',
  }))
  return [...rows, ...appended]
}

export function renderRouteRecordTable(rows: TaskRouteCardRecordRow[]): string {
  return `
    <section class="space-y-3">
      <h3 class="text-lg font-semibold">流转记录表</h3>
      <div class="overflow-x-auto rounded-lg border">
        <table class="w-full min-w-[1180px] text-sm">
          <thead class="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              ${['节点', '开始时间', '结束时间', '完成对象数量（按单据单位）', '异常对象数量（按单据单位）', '设备/工位', '操作人', '备注', '签字']
                .map((header) => `<th class="px-3 py-2 font-medium">${escapeHtml(header)}</th>`)
                .join('')}
            </tr>
          </thead>
          <tbody>
            ${padRouteRows(rows)
              .map(
                (row) => `
                  <tr class="h-12 border-b last:border-0">
                    <td class="px-3 py-2 font-medium">${renderTextValue(row.node, '')}</td>
                    <td class="px-3 py-2">${renderTextValue(row.startedAt, '')}</td>
                    <td class="px-3 py-2">${renderTextValue(row.finishedAt, '')}</td>
                    <td class="px-3 py-2 text-right">${renderTextValue(row.completedQty, '')}</td>
                    <td class="px-3 py-2 text-right">${renderTextValue(row.exceptionQty, '')}</td>
                    <td class="px-3 py-2">${renderTextValue(row.station, '')}</td>
                    <td class="px-3 py-2">${renderTextValue(row.operator, '')}</td>
                    <td class="px-3 py-2">${renderTextValue(row.remark, '')}</td>
                    <td class="px-3 py-2"></td>
                  </tr>
                `,
              )
              .join('')}
          </tbody>
        </table>
      </div>
    </section>
  `
}
