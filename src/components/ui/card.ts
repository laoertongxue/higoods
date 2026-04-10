// ============ 卡片组件 ============

import type { KpiCardConfig, InfoCardConfig, ActionConfig } from './types.ts'
import { toActionAttr } from './types.ts'

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

const CARD_BASE_CLASSES = 'rounded-lg border bg-card text-card-foreground shadow-sm'
const CARD_HEADER_CLASSES = 'flex flex-col space-y-1.5 p-6'
const CARD_CONTENT_CLASSES = 'p-6 pt-0'
const CARD_FOOTER_CLASSES = 'flex items-center p-6 pt-0'

// ============ KPI 卡片 ============

/**
 * 渲染 KPI 指标卡片
 */
export function renderKpiCard(config: KpiCardConfig): string {
  const { title, value, icon, trend, action, tone = '', className = '' } = config

  const iconHtml = icon
    ? `<i data-lucide="${icon}" class="h-4 w-4 text-muted-foreground"></i>`
    : ''

  const trendHtml = trend
    ? `
      <p class="text-xs ${trend.up ? 'text-green-600' : 'text-rose-600'} flex items-center gap-1">
        <i data-lucide="${trend.up ? 'trending-up' : 'trending-down'}" class="h-3 w-3"></i>
        ${escapeHtml(trend.value)}
      </p>
    `
    : ''

  const actionAttr = action ? toActionAttr(action) : ''
  const cursorClass = action ? 'cursor-pointer hover:bg-muted/50 transition-colors' : ''

  return `
    <div class="${CARD_BASE_CLASSES} ${cursorClass} ${className}" ${actionAttr}>
      <div class="p-6">
        <div class="flex items-center justify-between">
          <p class="text-sm font-medium text-muted-foreground">${escapeHtml(title)}</p>
          ${iconHtml}
        </div>
        <div class="mt-2">
          <p class="text-2xl font-bold ${tone}">${escapeHtml(String(value))}</p>
          ${trendHtml}
        </div>
      </div>
    </div>
  `
}

/**
 * 渲染 KPI 卡片组
 */
export function renderKpiCardGroup(cards: KpiCardConfig[], columns = 4): string {
  const gridClass = `grid gap-4 md:grid-cols-2 lg:grid-cols-${columns}`
  const cardsHtml = cards.map(card => renderKpiCard(card)).join('')

  return `<div class="${gridClass}">${cardsHtml}</div>`
}

/**
 * 渲染带统计数据的 KPI 卡片组（带分隔线）
 */
export function renderStatCards(
  stats: Array<{ title: string; value: string | number; icon?: string; tone?: string }>
): string {
  const statItems = stats
    .map((stat, index) => {
      const iconHtml = stat.icon
        ? `<i data-lucide="${stat.icon}" class="h-4 w-4 text-muted-foreground"></i>`
        : ''
      const borderClass = index > 0 ? 'border-l pl-4' : ''

      return `
        <div class="${borderClass}">
          <div class="flex items-center gap-2">
            ${iconHtml}
            <span class="text-sm text-muted-foreground">${escapeHtml(stat.title)}</span>
          </div>
          <p class="text-xl font-semibold mt-1 ${stat.tone || ''}">${escapeHtml(String(stat.value))}</p>
        </div>
      `
    })
    .join('')

  return `
    <div class="${CARD_BASE_CLASSES}">
      <div class="p-4 flex items-center gap-6">
        ${statItems}
      </div>
    </div>
  `
}

// ============ 信息卡片 ============

/**
 * 渲染信息展示卡片
 */
export function renderInfoCard(config: InfoCardConfig): string {
  const { title, items, className = '' } = config

  const itemsHtml = items
    .map(
      item => `
      <div class="flex justify-between py-2 border-b last:border-0">
        <span class="text-muted-foreground">${escapeHtml(item.label)}</span>
        <span class="font-medium">${escapeHtml(item.value)}</span>
      </div>
    `
    )
    .join('')

  return `
    <div class="${CARD_BASE_CLASSES} ${className}">
      <div class="${CARD_HEADER_CLASSES}">
        <h3 class="font-semibold leading-none tracking-tight">${escapeHtml(title)}</h3>
      </div>
      <div class="${CARD_CONTENT_CLASSES}">
        ${itemsHtml}
      </div>
    </div>
  `
}

/**
 * 渲染详情信息卡片（两列布局）
 */
export function renderDetailCard(
  title: string,
  details: Array<{ label: string; value: string }>,
  columns = 2
): string {
  const gridClass = `grid grid-cols-${columns} gap-4`
  const detailsHtml = details
    .map(
      d => `
      <div>
        <p class="text-sm text-muted-foreground">${escapeHtml(d.label)}</p>
        <p class="font-medium">${escapeHtml(d.value)}</p>
      </div>
    `
    )
    .join('')

  return `
    <div class="${CARD_BASE_CLASSES}">
      <div class="${CARD_HEADER_CLASSES}">
        <h3 class="font-semibold leading-none tracking-tight">${escapeHtml(title)}</h3>
      </div>
      <div class="${CARD_CONTENT_CLASSES}">
        <div class="${gridClass}">
          ${detailsHtml}
        </div>
      </div>
    </div>
  `
}

// ============ 通用卡片 ============

/**
 * 渲染通用卡片
 */
export function renderCard(options: {
  title?: string
  description?: string
  content: string
  footer?: string
  className?: string
}): string {
  const { title, description, content, footer, className = '' } = options

  const headerHtml =
    title || description
      ? `
      <div class="${CARD_HEADER_CLASSES}">
        ${title ? `<h3 class="text-lg font-semibold leading-none tracking-tight">${escapeHtml(title)}</h3>` : ''}
        ${description ? `<p class="text-sm text-muted-foreground">${escapeHtml(description)}</p>` : ''}
      </div>
    `
      : ''

  const footerHtml = footer ? `<div class="${CARD_FOOTER_CLASSES}">${footer}</div>` : ''

  return `
    <div class="${CARD_BASE_CLASSES} ${className}">
      ${headerHtml}
      <div class="${CARD_CONTENT_CLASSES}">
        ${content}
      </div>
      ${footerHtml}
    </div>
  `
}

/**
 * 渲染可点击卡片
 */
export function renderClickableCard(options: {
  title: string
  description?: string
  icon?: string
  action: ActionConfig
  className?: string
}): string {
  const { title, description, icon, action, className = '' } = options

  const iconHtml = icon
    ? `<div class="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
        <i data-lucide="${icon}" class="h-5 w-5 text-primary"></i>
       </div>`
    : ''

  return `
    <div class="${CARD_BASE_CLASSES} cursor-pointer hover:bg-muted/50 transition-colors ${className}" ${toActionAttr(action)}>
      <div class="p-6 flex items-start gap-4">
        ${iconHtml}
        <div>
          <h3 class="font-semibold">${escapeHtml(title)}</h3>
          ${description ? `<p class="text-sm text-muted-foreground mt-1">${escapeHtml(description)}</p>` : ''}
        </div>
        <i data-lucide="chevron-right" class="h-5 w-5 text-muted-foreground ml-auto"></i>
      </div>
    </div>
  `
}

// ============ 空状态卡片 ============

/**
 * 渲染空状态卡片
 */
export function renderEmptyCard(options: {
  icon?: string
  title: string
  description?: string
  action?: {
    label: string
    config: ActionConfig
  }
}): string {
  const { icon = 'inbox', title, description, action } = options

  const actionHtml = action
    ? `
      <button class="mt-4 inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2" ${toActionAttr(action.config)}>
        ${escapeHtml(action.label)}
      </button>
    `
    : ''

  return `
    <div class="${CARD_BASE_CLASSES}">
      <div class="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div class="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
          <i data-lucide="${icon}" class="h-6 w-6 text-muted-foreground"></i>
        </div>
        <h3 class="font-semibold">${escapeHtml(title)}</h3>
        ${description ? `<p class="text-sm text-muted-foreground mt-1 max-w-sm">${escapeHtml(description)}</p>` : ''}
        ${actionHtml}
      </div>
    </div>
  `
}

// ============ 加载状态卡片 ============

/**
 * 渲染加载状态
 */
export function renderLoadingCard(message = '加载中...'): string {
  return `
    <div class="${CARD_BASE_CLASSES}">
      <div class="flex items-center justify-center py-12 gap-3">
        <i data-lucide="loader-2" class="h-5 w-5 animate-spin text-muted-foreground"></i>
        <span class="text-muted-foreground">${escapeHtml(message)}</span>
      </div>
    </div>
  `
}

/**
 * 渲染骨架屏卡片
 */
export function renderSkeletonCard(): string {
  return `
    <div class="${CARD_BASE_CLASSES}">
      <div class="p-6 space-y-4">
        <div class="h-4 bg-muted rounded animate-pulse w-1/3"></div>
        <div class="h-8 bg-muted rounded animate-pulse w-1/2"></div>
        <div class="h-4 bg-muted rounded animate-pulse w-2/3"></div>
      </div>
    </div>
  `
}
