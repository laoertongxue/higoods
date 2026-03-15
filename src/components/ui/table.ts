// ============ 表格组件 ============

import type { TableColumn, TableOptions, ActionConfig } from './types'
import { toActionAttr } from './types'

/**
 * HTML 转义
 */
function escapeHtml(str: string): string {
  if (typeof str !== 'string') return String(str ?? '')
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ============ 基础样式 ============

const TABLE_BASE_CLASSES = 'w-full caption-bottom text-sm'
const TABLE_HEADER_CLASSES = 'h-10 px-4 text-left align-middle font-medium text-muted-foreground'
const TABLE_CELL_CLASSES = 'p-4 align-middle'
const TABLE_ROW_CLASSES = 'border-b transition-colors'

// ============ 表格组件 ============

/**
 * 渲染表格
 */
export function renderTable<T>(
  columns: TableColumn<T>[],
  data: T[],
  options: TableOptions = {}
): string {
  const {
    emptyText = '暂无数据',
    striped = false,
    hoverable = true,
    compact = false,
    className = '',
  } = options

  const tableClass = `${TABLE_BASE_CLASSES} ${className}`
  const cellPadding = compact ? 'p-2' : 'p-4'

  if (data.length === 0) {
    return `
      <div class="relative w-full overflow-auto">
        <table class="${tableClass}">
          ${renderTableHeader(columns, cellPadding)}
          <tbody>
            <tr>
              <td colspan="${columns.length}" class="h-24 text-center text-muted-foreground">
                ${escapeHtml(emptyText)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    `
  }

  const rows = data
    .map((row, index) => renderTableRow(columns, row, index, options, cellPadding, striped, hoverable))
    .join('')

  return `
    <div class="relative w-full overflow-auto">
      <table class="${tableClass}">
        ${renderTableHeader(columns, cellPadding)}
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
  `
}

/**
 * 渲染表格头
 */
export function renderTableHeader<T>(columns: TableColumn<T>[], cellPadding = 'p-4'): string {
  const headers = columns
    .map(col => {
      const width = col.width ? `width: ${col.width};` : ''
      const minWidth = col.minWidth ? `min-width: ${col.minWidth};` : ''
      const style = width || minWidth ? `style="${width}${minWidth}"` : ''
      const align = col.align || 'left'
      const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
      const headerClass = `${TABLE_HEADER_CLASSES} ${alignClass} ${col.className || ''}`
        .replace('p-4', cellPadding)
      
      let sortIcon = ''
      if (col.sortable) {
        sortIcon = '<i data-lucide="chevrons-up-down" class="ml-1 h-3 w-3 inline-block"></i>'
      }

      return `<th class="${headerClass}" ${style}>${escapeHtml(col.title)}${sortIcon}</th>`
    })
    .join('')

  return `
    <thead class="[&_tr]:border-b">
      <tr class="border-b transition-colors hover:bg-muted/50">
        ${headers}
      </tr>
    </thead>
  `
}

/**
 * 渲染表格行
 */
export function renderTableRow<T>(
  columns: TableColumn<T>[],
  row: T,
  index: number,
  options: TableOptions = {},
  cellPadding = 'p-4',
  striped = false,
  hoverable = true
): string {
  const { rowAction } = options

  let rowAttrs = ''
  if (rowAction) {
    const dataValue = (row as any)[rowAction.dataKey]
    rowAttrs = `${toActionAttr(rowAction)} data-${rowAction.prefix}-id="${dataValue}" class="${TABLE_ROW_CLASSES} cursor-pointer`
  } else {
    rowAttrs = `class="${TABLE_ROW_CLASSES}`
  }

  if (striped && index % 2 === 1) {
    rowAttrs += ' bg-muted/50'
  }
  if (hoverable) {
    rowAttrs += ' hover:bg-muted/50'
  }
  rowAttrs += '"'

  const cells = columns
    .map(col => {
      const align = col.align || 'left'
      const alignClass = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
      const cellClass = `${TABLE_CELL_CLASSES} ${alignClass} ${col.className || ''}`
        .replace('p-4', cellPadding)

      let cellContent: string
      if (col.render) {
        cellContent = col.render(row, index)
      } else {
        const value = (row as any)[col.key]
        cellContent = escapeHtml(value)
      }

      return `<td class="${cellClass}">${cellContent}</td>`
    })
    .join('')

  return `<tr ${rowAttrs}>${cells}</tr>`
}

// ============ 表格操作按钮 ============

export interface TableActionButton {
  label: string
  action: ActionConfig
  icon?: string
  variant?: 'default' | 'danger'
}

/**
 * 渲染表格操作列
 */
export function renderTableActions(
  buttons: TableActionButton[],
  rowIdAttr?: string
): string {
  const actionButtons = buttons
    .map(btn => {
      const actionAttr = toActionAttr(btn.action)
      const idAttr = rowIdAttr ? ` data-${btn.action.prefix}-id="${rowIdAttr}"` : ''
      const variantClass = btn.variant === 'danger' ? 'text-rose-600 hover:text-rose-700' : ''
      const iconHtml = btn.icon
        ? `<i data-lucide="${btn.icon}" class="h-4 w-4 ${btn.label ? 'mr-1' : ''}"></i>`
        : ''
      
      return `
        <button class="inline-flex items-center justify-center text-sm font-medium hover:underline ${variantClass}" ${actionAttr}${idAttr}>
          ${iconHtml}${btn.label ? escapeHtml(btn.label) : ''}
        </button>
      `
    })
    .join('<span class="mx-2 text-muted-foreground">|</span>')

  return `<div class="flex items-center justify-end gap-2">${actionButtons}</div>`
}

/**
 * 渲染表格操作列（紧凑版，只有图标）
 */
export function renderTableIconActions(
  buttons: Array<{ icon: string; action: ActionConfig; title?: string; variant?: 'default' | 'danger' }>,
  rowIdAttr?: string
): string {
  const iconButtons = buttons
    .map(btn => {
      const actionAttr = toActionAttr(btn.action)
      const idAttr = rowIdAttr ? ` data-${btn.action.prefix}-id="${rowIdAttr}"` : ''
      const variantClass = btn.variant === 'danger' ? 'hover:text-rose-600' : 'hover:bg-muted'
      const title = btn.title ? `title="${escapeHtml(btn.title)}"` : ''
      
      return `
        <button class="p-1.5 rounded-md ${variantClass}" ${actionAttr}${idAttr} ${title}>
          <i data-lucide="${btn.icon}" class="h-4 w-4"></i>
        </button>
      `
    })
    .join('')

  return `<div class="flex items-center justify-end">${iconButtons}</div>`
}

// ============ 表格选择功能 ============

/**
 * 渲染表格选择框头部
 */
export function renderTableSelectHeader(prefix: string): string {
  return `
    <th class="w-[40px] px-4">
      <input type="checkbox" class="h-4 w-4 rounded border-gray-300" data-${prefix}-action="toggle-select-all">
    </th>
  `
}

/**
 * 渲染表格选择框单元格
 */
export function renderTableSelectCell(prefix: string, id: string, checked = false): string {
  return `
    <td class="w-[40px] px-4">
      <input type="checkbox" class="h-4 w-4 rounded border-gray-300" 
        data-${prefix}-action="toggle-select" 
        data-${prefix}-id="${escapeHtml(id)}"
        ${checked ? 'checked' : ''}>
    </td>
  `
}

// ============ 表格展开行 ============

/**
 * 渲染展开行
 */
export function renderExpandableRow(
  columnsCount: number,
  content: string,
  expanded = false
): string {
  const displayClass = expanded ? '' : 'hidden'
  return `
    <tr class="expandable-row ${displayClass}">
      <td colspan="${columnsCount}" class="p-0">
        <div class="bg-muted/30 p-4 border-b">
          ${content}
        </div>
      </td>
    </tr>
  `
}

/**
 * 渲染展开按钮
 */
export function renderExpandButton(prefix: string, id: string, expanded = false): string {
  const icon = expanded ? 'chevron-up' : 'chevron-down'
  return `
    <button class="p-1 hover:bg-muted rounded" data-${prefix}-action="toggle-expand" data-${prefix}-id="${escapeHtml(id)}">
      <i data-lucide="${icon}" class="h-4 w-4"></i>
    </button>
  `
}

// ============ 简化版表格 ============

/**
 * 渲染简单表格（无复杂功能）
 */
export function renderSimpleTable(
  headers: string[],
  rows: string[][],
  options: { striped?: boolean; compact?: boolean } = {}
): string {
  const { striped = false, compact = false } = options
  const cellPadding = compact ? 'p-2' : 'p-4'

  const headerHtml = headers
    .map(h => `<th class="${TABLE_HEADER_CLASSES.replace('p-4', cellPadding)}">${escapeHtml(h)}</th>`)
    .join('')

  const rowsHtml = rows
    .map((row, i) => {
      const stripedClass = striped && i % 2 === 1 ? 'bg-muted/50' : ''
      const cells = row
        .map(cell => `<td class="${TABLE_CELL_CLASSES.replace('p-4', cellPadding)}">${escapeHtml(cell)}</td>`)
        .join('')
      return `<tr class="${TABLE_ROW_CLASSES} ${stripedClass}">${cells}</tr>`
    })
    .join('')

  return `
    <div class="relative w-full overflow-auto">
      <table class="${TABLE_BASE_CLASSES}">
        <thead class="[&_tr]:border-b">
          <tr class="border-b">${headerHtml}</tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `
}
