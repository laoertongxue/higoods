// ============ Tabs 页签组件 ============

import { escapeHtml } from '../../utils.ts'
import type { ActionConfig } from './types.ts'
import { toActionAttr } from './types.ts'

// ============ 类型定义 ============

export type TabsVariant = 'underline' | 'pills' | 'cards'

export interface TabItem {
  key: string
  label: string
  icon?: string
  count?: number
  disabled?: boolean
}

export interface TabsConfig {
  tabs: TabItem[]
  activeKey: string
  variant?: TabsVariant
  prefix: string
  action?: string // action 名，点击时生成 {prefix}-action="{action}" ，value 为 tab.key
  className?: string
  fullWidth?: boolean
}

// ============ 样式映射 ============

const TAB_BASE = 'inline-flex items-center justify-center gap-1.5 whitespace-nowrap text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'

/**
 * 渲染下划线风格 Tabs
 */
function renderUnderlineTabs(config: TabsConfig): string {
  const { tabs, activeKey, prefix, action = 'tab-change', className = '', fullWidth } = config

  const tabsHtml = tabs
    .map((tab) => {
      const isActive = tab.key === activeKey
      const activeClass = isActive
        ? 'border-primary text-foreground'
        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30'
      const disabled = tab.disabled ? 'disabled' : ''
      const iconHtml = tab.icon ? `<i data-lucide="${tab.icon}" class="h-4 w-4"></i>` : ''
      const countHtml = tab.count !== undefined
        ? `<span class="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs ${isActive ? 'bg-primary/10 text-primary' : ''}">${tab.count}</span>`
        : ''

      return `
        <button
          type="button"
          class="${TAB_BASE} border-b-2 py-2.5 px-1 ${activeClass} ${fullWidth ? 'flex-1' : ''}"
          ${toActionAttr({ prefix, action: `${action}:${tab.key}` })}
          ${disabled}
        >
          ${iconHtml}
          ${escapeHtml(tab.label)}
          ${countHtml}
        </button>`
    })
    .join('')

  const fullClass = fullWidth ? 'w-full' : ''

  return `<div class="border-b ${fullClass} ${className}" role="tablist"><div class="flex ${fullWidth ? '' : 'gap-6'}">${tabsHtml}</div></div>`
}

/**
 * 渲染药丸风格 Tabs
 */
function renderPillsTabs(config: TabsConfig): string {
  const { tabs, activeKey, prefix, action = 'tab-change', className = '', fullWidth } = config

  const tabsHtml = tabs
    .map((tab) => {
      const isActive = tab.key === activeKey
      const activeClass = isActive
        ? 'bg-background text-foreground shadow-sm'
        : 'text-muted-foreground hover:text-foreground'
      const disabled = tab.disabled ? 'disabled' : ''
      const iconHtml = tab.icon ? `<i data-lucide="${tab.icon}" class="h-4 w-4"></i>` : ''
      const countHtml = tab.count !== undefined
        ? `<span class="ml-1.5 rounded-full px-1.5 py-0.5 text-xs ${isActive ? 'bg-muted' : 'bg-muted/50'}">${tab.count}</span>`
        : ''

      return `
        <button
          type="button"
          class="${TAB_BASE} rounded-md px-3 py-1.5 ${activeClass} ${fullWidth ? 'flex-1' : ''}"
          ${toActionAttr({ prefix, action: `${action}:${tab.key}` })}
          ${disabled}
        >
          ${iconHtml}
          ${escapeHtml(tab.label)}
          ${countHtml}
        </button>`
    })
    .join('')

  const fullClass = fullWidth ? 'w-full' : ''

  return `<div class="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground ${fullClass} ${className}" role="tablist">${tabsHtml}</div>`
}

/**
 * 渲染卡片风格 Tabs
 */
function renderCardsTabs(config: TabsConfig): string {
  const { tabs, activeKey, prefix, action = 'tab-change', className = '', fullWidth } = config

  const tabsHtml = tabs
    .map((tab, i) => {
      const isActive = tab.key === activeKey
      const activeClass = isActive
        ? 'bg-background text-foreground shadow-sm border-b-background'
        : 'bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted'
      const disabled = tab.disabled ? 'disabled' : ''
      const isFirst = i === 0
      const isLast = i === tabs.length - 1
      const roundedClass = isFirst ? 'rounded-l-md' : isLast ? 'rounded-r-md' : ''
      const iconHtml = tab.icon ? `<i data-lucide="${tab.icon}" class="h-4 w-4"></i>` : ''
      const countHtml = tab.count !== undefined
        ? `<span class="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">${tab.count}</span>`
        : ''

      return `
        <button
          type="button"
          class="${TAB_BASE} border px-4 py-2 ${activeClass} ${roundedClass} ${fullWidth ? 'flex-1' : ''}"
          ${toActionAttr({ prefix, action: `${action}:${tab.key}` })}
          ${disabled}
        >
          ${iconHtml}
          ${escapeHtml(tab.label)}
          ${countHtml}
        </button>`
    })
    .join('')

  const fullClass = fullWidth ? 'w-full' : ''

  return `<div class="flex ${fullClass} ${className}" role="tablist">${tabsHtml}</div>`
}

// ============ 主渲染函数 ============

/**
 * 渲染 Tabs 页签
 *
 * 三种风格：
 * - underline: 下划线高亮（默认，适合内容区页签）
 * - pills: 药丸按钮组（适合筛选切换）
 * - cards: 卡片式按钮组（适合表单/设置页签）
 */
export function renderTabs(config: TabsConfig): string {
  const { variant = 'underline' } = config

  switch (variant) {
    case 'pills':
      return renderPillsTabs(config)
    case 'cards':
      return renderCardsTabs(config)
    default:
      return renderUnderlineTabs(config)
  }
}
