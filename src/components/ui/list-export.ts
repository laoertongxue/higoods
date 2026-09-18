import type { StandardListColumn } from './list-table.ts'
import { showListFeedback } from './list-feedback.ts'

function toPlainText(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function exportStandardListRows<T>(options: {
  fileName: string
  columns: readonly StandardListColumn<T>[]
  rows: readonly T[]
}): void {
  const exportColumns = options.columns.filter((column) => !column.actionColumn && !column.leadingControlColumn)
  if (!options.rows.length) {
    showListFeedback('当前查询条件下没有可导出的记录', 'warning')
    return
  }
  const lines = [exportColumns.map((column) => csvCell(column.title)).join(',')]
  for (const row of options.rows) {
    lines.push(exportColumns.map((column) => csvCell(toPlainText(column.render(row, 0)))).join(','))
  }
  const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${options.fileName}.csv`
  link.click()
  URL.revokeObjectURL(url)
  showListFeedback(`已导出 ${options.rows.length} 条记录`)
}
