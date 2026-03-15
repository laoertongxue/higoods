// ============ 分页组件 ============

import type { PaginationConfig, ActionConfig } from './types'
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

const PAGE_BUTTON_BASE =
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ' +
  'ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'

const PAGE_BUTTON_VARIANT = 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'
const PAGE_BUTTON_ACTIVE = 'bg-primary text-primary-foreground hover:bg-primary/90'
const PAGE_BUTTON_SIZE = 'h-9 px-3'

// ============ 分页组件 ============

/**
 * 渲染分页组件
 */
export function renderPagination(config: PaginationConfig): string {
  const { current, total, pageSize = 20, showTotal = true, prefix = 'page', simple = false } = config

  const totalPages = Math.ceil(total / pageSize)
  if (totalPages <= 1) return ''

  if (simple) {
    return renderSimplePagination(current, totalPages, total, prefix, showTotal)
  }

  return renderFullPagination(current, totalPages, total, prefix, showTotal)
}

/**
 * 渲染简单分页（只有上一页/下一页）
 */
function renderSimplePagination(
  current: number,
  totalPages: number,
  total: number,
  prefix: string,
  showTotal: boolean
): string {
  const prevDisabled = current <= 1 ? 'disabled' : ''
  const nextDisabled = current >= totalPages ? 'disabled' : ''

  const totalHtml = showTotal
    ? `<span class="text-sm text-muted-foreground">共 ${total} 条</span>`
    : ''

  return `
    <div class="flex items-center justify-between">
      ${totalHtml}
      <div class="flex items-center gap-2">
        <button class="${PAGE_BUTTON_BASE} ${PAGE_BUTTON_VARIANT} ${PAGE_BUTTON_SIZE}" 
          ${toActionAttr({ prefix, action: 'prev-page' })} ${prevDisabled}>
          <i data-lucide="chevron-left" class="h-4 w-4"></i>
          上一页
        </button>
        <span class="text-sm text-muted-foreground px-2">
          第 ${current} / ${totalPages} 页
        </span>
        <button class="${PAGE_BUTTON_BASE} ${PAGE_BUTTON_VARIANT} ${PAGE_BUTTON_SIZE}" 
          ${toActionAttr({ prefix, action: 'next-page' })} ${nextDisabled}>
          下一页
          <i data-lucide="chevron-right" class="h-4 w-4"></i>
        </button>
      </div>
    </div>
  `
}

/**
 * 渲染完整分页（带页码）
 */
function renderFullPagination(
  current: number,
  totalPages: number,
  total: number,
  prefix: string,
  showTotal: boolean
): string {
  const pages = generatePageNumbers(current, totalPages)

  const pageButtons = pages
    .map(page => {
      if (page === '...') {
        return `<span class="px-2 text-muted-foreground">...</span>`
      }
      const isActive = page === current
      const buttonClass = isActive
        ? `${PAGE_BUTTON_BASE} ${PAGE_BUTTON_ACTIVE} h-9 w-9`
        : `${PAGE_BUTTON_BASE} ${PAGE_BUTTON_VARIANT} h-9 w-9`
      return `
        <button class="${buttonClass}" ${toActionAttr({ prefix, action: `goto-page-${page}` })}>
          ${page}
        </button>
      `
    })
    .join('')

  const prevDisabled = current <= 1 ? 'disabled' : ''
  const nextDisabled = current >= totalPages ? 'disabled' : ''

  const totalHtml = showTotal
    ? `<span class="text-sm text-muted-foreground">共 ${total} 条</span>`
    : ''

  return `
    <div class="flex items-center justify-between">
      ${totalHtml}
      <div class="flex items-center gap-1">
        <button class="${PAGE_BUTTON_BASE} ${PAGE_BUTTON_VARIANT} h-9 w-9" 
          ${toActionAttr({ prefix, action: 'prev-page' })} ${prevDisabled}>
          <i data-lucide="chevron-left" class="h-4 w-4"></i>
        </button>
        ${pageButtons}
        <button class="${PAGE_BUTTON_BASE} ${PAGE_BUTTON_VARIANT} h-9 w-9" 
          ${toActionAttr({ prefix, action: 'next-page' })} ${nextDisabled}>
          <i data-lucide="chevron-right" class="h-4 w-4"></i>
        </button>
      </div>
    </div>
  `
}

/**
 * 生成页码数组
 */
function generatePageNumbers(current: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const pages: (number | '...')[] = [1]

  if (current > 3) {
    pages.push('...')
  }

  const start = Math.max(2, current - 1)
  const end = Math.min(totalPages - 1, current + 1)

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  if (current < totalPages - 2) {
    pages.push('...')
  }

  pages.push(totalPages)

  return pages
}

// ============ 页码跳转 ============

/**
 * 渲染页码跳转输入框
 */
export function renderPageJumper(prefix: string, totalPages: number): string {
  return `
    <div class="flex items-center gap-2 text-sm">
      <span class="text-muted-foreground">跳转至</span>
      <input type="number" min="1" max="${totalPages}" 
        class="h-9 w-16 rounded-md border border-input bg-background px-2 text-center text-sm"
        data-${prefix}-field="goto-page"
        onkeydown="if(event.key==='Enter'){this.dispatchEvent(new Event('change'))}"
      >
      <span class="text-muted-foreground">页</span>
    </div>
  `
}

// ============ 每页条数选择 ============

/**
 * 渲染每页条数选择
 */
export function renderPageSizeSelect(
  prefix: string,
  current: number,
  options = [10, 20, 50, 100]
): string {
  const optionsHtml = options
    .map(size => {
      const selected = size === current ? 'selected' : ''
      return `<option value="${size}" ${selected}>${size} 条/页</option>`
    })
    .join('')

  return `
    <select class="h-9 rounded-md border border-input bg-background px-2 text-sm" 
      data-${prefix}-filter="page-size">
      ${optionsHtml}
    </select>
  `
}

// ============ 组合分页栏 ============

/**
 * 渲染完整的分页栏（包含总数、分页、每页条数）
 */
export function renderPaginationBar(config: {
  current: number
  total: number
  pageSize: number
  prefix: string
  showPageSize?: boolean
  pageSizeOptions?: number[]
}): string {
  const {
    current,
    total,
    pageSize,
    prefix,
    showPageSize = true,
    pageSizeOptions = [10, 20, 50, 100],
  } = config

  const totalPages = Math.ceil(total / pageSize)

  const pageSizeHtml = showPageSize
    ? renderPageSizeSelect(prefix, pageSize, pageSizeOptions)
    : ''

  return `
    <div class="flex items-center justify-between py-4">
      <div class="flex items-center gap-4">
        <span class="text-sm text-muted-foreground">共 ${total} 条记录</span>
        ${pageSizeHtml}
      </div>
      <div class="flex items-center gap-4">
        ${renderFullPagination(current, totalPages, total, prefix, false)}
        ${renderPageJumper(prefix, totalPages)}
      </div>
    </div>
  `
}
