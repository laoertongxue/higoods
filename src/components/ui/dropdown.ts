// ============ Dropdown 下拉菜单组件 ============

import { escapeHtml } from '../../utils.ts'
import type { ActionConfig } from './types.ts'
import { toActionAttr } from './types.ts'

// ============ 类型定义 ============

export type DropdownPlacement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'

export interface DropdownItem {
  key?: string
  label: string
  icon?: string
  action?: ActionConfig
  danger?: boolean
  disabled?: boolean
  divider?: boolean // true 表示在此项前加分隔线
}

export interface DropdownButtonConfig {
  label?: string
  icon?: string
  variant?: 'default' | 'ghost'
  className?: string
  caret?: boolean // 是否显示下拉箭头
}

export interface DropdownConfig {
  trigger: DropdownButtonConfig
  items: DropdownItem[]
  prefix: string
  id?: string
  placement?: DropdownPlacement
  className?: string
}

// ============ 样式映射 ============

const ITEM_BASE = 'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none transition-colors'

function renderDropdownItem(item: DropdownItem, prefix: string): string {
  if (item.label === '__divider__' || item.divider) {
    return '<div class="my-1 border-t"></div>'
  }

  const dangerClass = item.danger ? 'text-destructive hover:bg-destructive/10' : 'hover:bg-accent hover:text-accent-foreground'
  const disabledClass = item.disabled ? 'opacity-50 pointer-events-none' : ''
  const iconHtml = item.icon ? `<i data-lucide="${item.icon}" class="h-4 w-4"></i>` : ''
  const actionAttr = item.action ? toActionAttr(item.action) : ''

  return `
    <button type="button" class="${ITEM_BASE} ${dangerClass} ${disabledClass}" ${actionAttr}>
      ${iconHtml}
      <span>${escapeHtml(item.label)}</span>
    </button>`
}

// ============ 渲染函数 ============

/**
 * 渲染 Dropdown 下拉菜单
 *
 * 核心是一个触发按钮 + 绝对定位的下拉面板
 * 使用 CSS peer 模式或 data-dropdown 属性配合 JS 控制显示/隐藏
 * 默认隐藏，添加 data-dropdown-open="true" 时显示
 */
export function renderDropdown(config: DropdownConfig): string {
  const {
    trigger,
    items,
    prefix,
    id,
    placement = 'bottom-end',
    className = '',
  } = config

  const dropdownId = id ?? `dropdown-${Math.random().toString(36).slice(2, 8)}`

  const triggerLabel = trigger.label ?? ''
  const triggerIcon = trigger.icon
  const showCaret = trigger.caret !== false
  const variantClass = trigger.variant === 'ghost'
    ? 'hover:bg-accent hover:text-accent-foreground'
    : 'border border-input bg-background hover:bg-accent hover:text-accent-foreground'

  const triggerHtml = `
    <button
      type="button"
      class="inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium h-9 px-3 transition-colors ${variantClass} ${trigger.className ?? ''}"
      data-dropdown-trigger="${dropdownId}"
      aria-haspopup="true"
      aria-expanded="false"
    >
      ${triggerIcon ? `<i data-lucide="${triggerIcon}" class="h-4 w-4"></i>` : ''}
      ${triggerLabel ? escapeHtml(triggerLabel) : ''}
      ${showCaret ? '<i data-lucide="chevron-down" class="h-4 w-4 opacity-50"></i>' : ''}
    </button>`

  const placementClasses: Record<DropdownPlacement, string> = {
    'bottom-start': 'left-0 top-full mt-1',
    'bottom-end': 'right-0 top-full mt-1',
    'top-start': 'left-0 bottom-full mb-1',
    'top-end': 'right-0 bottom-full mb-1',
  }

  const placementClass = placementClasses[placement] ?? placementClasses['bottom-end']

  const itemsHtml = items
    .map((item) => renderDropdownItem(item, prefix))
    .join('')

  return `
    <div class="relative inline-block ${className}" data-dropdown="${dropdownId}">
      ${triggerHtml}
      <div
        class="absolute z-50 ${placementClass} hidden min-w-[180px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[dropdown-open]:block"
        data-dropdown-menu="${dropdownId}"
        role="menu"
      >
        ${itemsHtml}
      </div>
    </div>`
}

/**
 * 渲染一个简单的操作下拉菜单（快捷方式）
 *
 * 常见场景：表格每行的「更多操作」按钮
 */
export function renderActionDropdown(options: {
  prefix: string
  items: Array<{
    label: string
    action: string
    icon?: string
    danger?: boolean
    disabled?: boolean
  }>
  id?: string
}): string {
  const { prefix, items, id } = options

  const dropdownId = id ?? `actions-${Math.random().toString(36).slice(2, 8)}`

  const itemsHtml = items
    .map((item) =>
      renderDropdownItem(
        {
          label: item.label,
          icon: item.icon,
          action: { prefix, action: item.action },
          danger: item.danger,
          disabled: item.disabled,
        },
        prefix,
      ),
    )
    .join('')

  return `
    <div class="relative inline-block" data-dropdown="${dropdownId}">
      <button
        type="button"
        class="inline-flex items-center justify-center rounded-md p-2 hover:bg-accent hover:text-accent-foreground transition-colors"
        data-dropdown-trigger="${dropdownId}"
        aria-haspopup="true"
        aria-expanded="false"
      >
        <i data-lucide="more-horizontal" class="h-4 w-4"></i>
      </button>
      <div
        class="absolute right-0 top-full z-50 mt-1 hidden min-w-[140px] rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[dropdown-open]:block"
        data-dropdown-menu="${dropdownId}"
        role="menu"
      >
        ${itemsHtml}
      </div>
    </div>`
}
