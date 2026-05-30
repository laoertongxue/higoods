// ============ Collapse 折叠面板组件 ============

import { escapeHtml } from '../../utils.ts'
import type { ActionConfig, BadgeVariant, BadgeConfig } from './types.ts'
import { toActionAttr } from './types.ts'

// ============ 类型定义 ============

export interface CollapseItem {
  key: string
  title: string
  content: string
  icon?: string
  badge?: string | BadgeConfig
  disabled?: boolean
  expanded?: boolean
}

export interface CollapseConfig {
  items: CollapseItem[]
  activeKeys?: string[] // 展开的 key 列表，如果不传则默认全部折叠
  multiple?: boolean // 是否允许多个同时展开
  bordered?: boolean // 是否带边框
  className?: string
  prefix: string
}

// ============ 样式常量 ============

const HEADER_BASE = 'flex w-full items-center justify-between py-3 text-sm font-medium transition-all hover:underline-offset-4 [&[data-state=open]>svg]:rotate-180'

// ============ 渲染函数 ============

/**
 * 渲染折叠面板
 *
 * 支持：
 * - 多个面板同时展开（multiple: true）
 * - 带边框（bordered: true）
 * - 标题左侧自定义图标
 * - 标题右侧徽章
 */
export function renderCollapse(config: CollapseConfig): string {
  const {
    items,
    activeKeys = [],
    multiple = false,
    bordered = true,
    className = '',
    prefix,
  } = config

  const borderClass = bordered ? 'border rounded-lg' : ''
  const itemBorderClass = bordered ? 'border-b last:border-0' : 'border-b last:border-0'

  const itemsHtml = items
    .map((item, i) => {
      const isExpanded = activeKeys.includes(item.key)
      const stateAttr = isExpanded ? 'data-state="open"' : 'data-state="closed"'
      const contentDisplay = isExpanded ? '' : 'hidden'

      // 渲染标题区左侧图标
      const titleIconHtml = item.icon
        ? `<i data-lucide="${item.icon}" class="h-4 w-4 text-muted-foreground shrink-0"></i>`
        : ''

      // 渲染标题区右侧徽章
      const badgeHtml = renderCollapseBadge(item.badge)

      // 展开/收起箭头
      const chevronClass = isExpanded ? 'rotate-180' : ''

      return `
        <div class="${itemBorderClass}" data-collapse-item="${item.key}">
          <button
            type="button"
            class="${HEADER_BASE} px-4"
            ${stateAttr}
            ${toActionAttr({ prefix, action: `collapse-toggle:${item.key}` })}
            ${item.disabled ? 'disabled' : ''}
          >
            <div class="flex items-center gap-2 min-w-0">
              ${titleIconHtml}
              <span class="text-left truncate">${escapeHtml(item.title)}</span>
            </div>
            <div class="flex items-center gap-2 shrink-0 ml-2">
              ${badgeHtml}
              <i data-lucide="chevron-down" class="h-4 w-4 shrink-0 transition-transform duration-200 ${chevronClass}"></i>
            </div>
          </button>
          <div class="${contentDisplay} px-4 pb-4 text-sm" data-collapse-content="${item.key}">
            ${item.content}
          </div>
        </div>`
    })
    .join('')

  return `
    <div class="${borderClass} ${className}">
      ${itemsHtml}
    </div>`
}

/**
 * 渲染单个折叠面板（独立使用）
 */
export function renderCollapseItem(
  item: CollapseItem,
  config: {
    prefix: string
    expanded: boolean
    bordered?: boolean
    className?: string
  },
): string {
  const borderClass = config.bordered ? 'border rounded-lg' : 'border rounded-lg'
  const isExpanded = config.expanded
  const chevronClass = isExpanded ? 'rotate-180' : ''
  const contentDisplay = isExpanded ? '' : 'hidden'
  const titleIconHtml = item.icon
    ? `<i data-lucide="${item.icon}" class="h-4 w-4 text-muted-foreground shrink-0"></i>`
    : ''
  const badgeHtml = renderCollapseBadge(item.badge)

  return `
    <div class="${borderClass} ${config.className ?? ''}">
      <button
        type="button"
        class="${HEADER_BASE} px-4"
        data-state="${isExpanded ? 'open' : 'closed'}"
        ${toActionAttr({ prefix: config.prefix, action: `collapse-toggle:${item.key}` })}
        ${item.disabled ? 'disabled' : ''}
      >
        <div class="flex items-center gap-2 min-w-0">
          ${titleIconHtml}
          <span class="text-left truncate">${escapeHtml(item.title)}</span>
        </div>
        <div class="flex items-center gap-2 shrink-0 ml-2">
          ${badgeHtml}
          <i data-lucide="chevron-down" class="h-4 w-4 shrink-0 transition-transform duration-200 ${chevronClass}"></i>
        </div>
      </button>
      <div class="${contentDisplay} px-4 pb-4 text-sm">
        ${item.content}
      </div>
    </div>`
}

// ============ 内部辅助 ============

function renderCollapseBadge(badge?: string | BadgeConfig): string {
  if (!badge) return ''
  if (typeof badge === 'string') {
    return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium text-muted-foreground">${escapeHtml(badge)}</span>`
  }
  // BadgeConfig 走简单的内联样式，避免循环依赖
  const variantColors: Record<string, string> = {
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    danger: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    neutral: 'bg-gray-100 text-gray-800 border-gray-200',
    outline: 'bg-transparent border-current',
  }
  const colorClass = variantColors[badge.variant] ?? variantColors.neutral
  const iconHtml = badge.icon
    ? `<i data-lucide="${badge.icon}" class="h-3 w-3"></i>`
    : ''
  return `<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${colorClass} ${badge.className ?? ''}">${iconHtml}${escapeHtml(badge.text)}</span>`
}
