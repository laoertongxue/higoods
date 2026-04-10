// ============ 筛选栏组件 ============

import type { FilterBarConfig, SearchInputConfig, SelectConfig, ButtonConfig, ActionConfig } from './types.ts'
import { toActionAttr, toFilterAttr } from './types.ts'
import { renderSelect } from './form.ts'
import { renderButton } from './button.ts'

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

// ============ 搜索输入框 ============

/**
 * 渲染搜索输入框
 */
export function renderSearchInput(config: SearchInputConfig): string {
  const { value = '', placeholder = '搜索...', prefix, filter = 'search', className = '' } = config

  return `
    <div class="relative ${className}">
      <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"></i>
      <input 
        type="text"
        value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}"
        class="flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        ${toFilterAttr(prefix, filter)}
      >
    </div>
  `
}

/**
 * 渲染带清除按钮的搜索框
 */
export function renderSearchInputWithClear(config: SearchInputConfig & { clearAction?: ActionConfig }): string {
  const { value = '', placeholder = '搜索...', prefix, filter = 'search', clearAction, className = '' } = config

  const clearButton = value && clearAction
    ? `
      <button class="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded" ${toActionAttr(clearAction)}>
        <i data-lucide="x" class="h-3 w-3 text-muted-foreground"></i>
      </button>
    `
    : ''

  return `
    <div class="relative ${className}">
      <i data-lucide="search" class="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"></i>
      <input 
        type="text"
        value="${escapeHtml(value)}"
        placeholder="${escapeHtml(placeholder)}"
        class="flex h-10 w-full rounded-md border border-input bg-background pl-10 ${value ? 'pr-10' : 'pr-3'} py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        ${toFilterAttr(prefix, filter)}
      >
      ${clearButton}
    </div>
  `
}

// ============ 筛选栏组件 ============

/**
 * 渲染筛选栏
 */
export function renderFilterBar(config: FilterBarConfig): string {
  const { search, filters = [], actions = [], resetAction, className = '' } = config

  // 搜索框
  const searchHtml = search
    ? `<div class="w-64">${renderSearchInput(search)}</div>`
    : ''

  // 筛选下拉框
  const filtersHtml = filters
    .map(filter => `<div class="w-40">${renderSelect(filter)}</div>`)
    .join('')

  // 重置按钮
  const resetHtml = resetAction
    ? `
      <button class="inline-flex items-center justify-center text-sm font-medium text-muted-foreground hover:text-foreground" ${toActionAttr(resetAction)}>
        <i data-lucide="rotate-ccw" class="h-4 w-4 mr-1"></i>
        重置
      </button>
    `
    : ''

  // 操作按钮
  const actionsHtml = actions
    .map(btn => renderButton({ ...btn, action: btn.action }))
    .join('')

  return `
    <div class="flex items-center justify-between gap-4 ${className}">
      <div class="flex items-center gap-3">
        ${searchHtml}
        ${filtersHtml}
        ${resetHtml}
      </div>
      <div class="flex items-center gap-2">
        ${actionsHtml}
      </div>
    </div>
  `
}

/**
 * 渲染紧凑筛选栏（单行）
 */
export function renderCompactFilterBar(config: {
  prefix: string
  searchPlaceholder?: string
  searchValue?: string
  filters?: Array<SelectConfig>
  primaryAction?: ButtonConfig & { action: ActionConfig }
}): string {
  const { prefix, searchPlaceholder = '搜索...', searchValue = '', filters = [], primaryAction } = config

  const searchHtml = renderSearchInput({
    prefix,
    placeholder: searchPlaceholder,
    value: searchValue,
    className: 'w-64',
  })

  const filtersHtml = filters
    .map(filter => `<div class="w-36">${renderSelect(filter)}</div>`)
    .join('')

  const actionHtml = primaryAction
    ? renderButton({ ...primaryAction, action: primaryAction.action })
    : ''

  return `
    <div class="flex items-center gap-3">
      ${searchHtml}
      ${filtersHtml}
      <div class="flex-1"></div>
      ${actionHtml}
    </div>
  `
}

// ============ 高级筛选 ============

/**
 * 渲染高级筛选面板
 */
export function renderAdvancedFilters(config: {
  prefix: string
  filters: Array<{
    label: string
    name: string
    type: 'select' | 'input' | 'date'
    options?: Array<{ value: string; label: string }>
    placeholder?: string
    value?: string
  }>
  applyAction: ActionConfig
  resetAction: ActionConfig
}): string {
  const { prefix, filters, applyAction, resetAction } = config

  const filtersHtml = filters
    .map(filter => {
      let inputHtml: string
      switch (filter.type) {
        case 'select':
          inputHtml = renderSelect({
            options: filter.options || [],
            placeholder: filter.placeholder || '全部',
            value: filter.value,
            prefix,
            filter: filter.name,
          })
          break
        case 'date':
          inputHtml = `
            <input type="date" 
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value="${filter.value || ''}"
              ${toFilterAttr(prefix, filter.name)}
            >
          `
          break
        default:
          inputHtml = `
            <input type="text"
              class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="${escapeHtml(filter.placeholder || '')}"
              value="${filter.value || ''}"
              ${toFilterAttr(prefix, filter.name)}
            >
          `
      }

      return `
        <div class="space-y-1.5">
          <label class="text-sm font-medium">${escapeHtml(filter.label)}</label>
          ${inputHtml}
        </div>
      `
    })
    .join('')

  return `
    <div class="rounded-lg border bg-card p-4 space-y-4">
      <div class="grid grid-cols-4 gap-4">
        ${filtersHtml}
      </div>
      <div class="flex items-center justify-end gap-2 pt-2 border-t">
        <button class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 border border-input bg-background hover:bg-accent" ${toActionAttr(resetAction)}>
          重置
        </button>
        <button class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-4 bg-primary text-primary-foreground hover:bg-primary/90" ${toActionAttr(applyAction)}>
          应用筛选
        </button>
      </div>
    </div>
  `
}

// ============ 标签筛选 ============

/**
 * 渲染标签式筛选（Tabs）
 */
export function renderTabFilters(config: {
  prefix: string
  filterName: string
  tabs: Array<{ value: string; label: string; count?: number }>
  activeValue: string
}): string {
  const { prefix, filterName, tabs, activeValue } = config

  const tabsHtml = tabs
    .map(tab => {
      const isActive = tab.value === activeValue
      const activeClass = isActive
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground'
      const countHtml = tab.count !== undefined
        ? `<span class="ml-1 text-xs ${isActive ? 'bg-muted' : 'bg-muted/50'} px-1.5 py-0.5 rounded-full">${tab.count}</span>`
        : ''

      return `
        <button class="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all ${activeClass}" 
          ${toActionAttr({ prefix, action: `filter-${filterName}-${tab.value}` })}>
          ${escapeHtml(tab.label)}${countHtml}
        </button>
      `
    })
    .join('')

  return `
    <div class="inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
      ${tabsHtml}
    </div>
  `
}

// ============ 快捷筛选按钮 ============

/**
 * 渲染快捷筛选按钮组
 */
export function renderQuickFilters(config: {
  prefix: string
  filters: Array<{
    label: string
    action: string
    icon?: string
    active?: boolean
  }>
}): string {
  const { prefix, filters } = config

  const buttonsHtml = filters
    .map(filter => {
      const activeClass = filter.active
        ? 'bg-primary/10 text-primary border-primary'
        : 'border-input hover:bg-accent'
      const iconHtml = filter.icon
        ? `<i data-lucide="${filter.icon}" class="h-4 w-4 mr-1"></i>`
        : ''

      return `
        <button class="inline-flex items-center justify-center rounded-md text-sm font-medium h-9 px-3 border ${activeClass}" 
          ${toActionAttr({ prefix, action: filter.action })}>
          ${iconHtml}${escapeHtml(filter.label)}
        </button>
      `
    })
    .join('')

  return `<div class="flex items-center gap-2">${buttonsHtml}</div>`
}
