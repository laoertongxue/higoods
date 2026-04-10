// ============ 徽章组件 ============

import { escapeHtml } from '../../utils.ts'
import type { BadgeVariant, BadgeConfig, StatusBadgeMap } from './types.ts'

// 徽章变体样式映射
const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  danger: 'bg-red-100 text-red-800 border-red-200',
  info: 'bg-blue-100 text-blue-800 border-blue-200',
  neutral: 'bg-gray-100 text-gray-800 border-gray-200',
  outline: 'bg-transparent border-current',
}

// 徽章图标颜色映射
const ICON_CLASSES: Record<BadgeVariant, string> = {
  success: 'text-green-600',
  warning: 'text-yellow-600',
  danger: 'text-red-600',
  info: 'text-blue-600',
  neutral: 'text-gray-600',
  outline: 'text-current',
}

/**
 * 渲染徽章组件
 */
export function renderBadge(text: string, variant: BadgeVariant = 'neutral', icon?: string): string {
  const variantClasses = VARIANT_CLASSES[variant]
  const iconClasses = ICON_CLASSES[variant]
  const iconHtml = icon ? `<i data-lucide="${icon}" class="h-3 w-3 ${iconClasses}"></i>` : ''
  
  return `
    <span class="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium border ${variantClasses}">
      ${iconHtml}${escapeHtml(text)}
    </span>
  `.trim()
}

/**
 * 渲染状态徽章（根据状态映射表）
 */
export function renderStatusBadge(status: string, statusMap: StatusBadgeMap): string {
  const config = statusMap[status]
  if (!config) {
    return renderBadge(status, 'neutral')
  }
  return renderBadge(config.text, config.variant, config.icon)
}

/**
 * 预定义的常用状态徽章
 */
export const STATUS_BADGES = {
  // 通用状态
  active: () => renderBadge('启用', 'success', 'check-circle-2'),
  inactive: () => renderBadge('停用', 'neutral'),
  draft: () => renderBadge('草稿', 'neutral'),
  pending: () => renderBadge('待处理', 'warning', 'clock'),
  approved: () => renderBadge('已通过', 'success', 'check'),
  rejected: () => renderBadge('已驳回', 'danger', 'x'),
  completed: () => renderBadge('已完成', 'success', 'check-circle-2'),
  cancelled: () => renderBadge('已取消', 'neutral'),
  
  // 连接状态
  connected: () => renderBadge('已连接', 'success', 'check-circle-2'),
  disconnected: () => renderBadge('已断开', 'danger', 'x-circle'),
  
  // 健康状态
  healthy: () => renderBadge('健康', 'success', 'check-circle-2'),
  warning: () => renderBadge('警告', 'warning', 'alert-triangle'),
  error: () => renderBadge('异常', 'danger', 'x-circle'),
  
  // 同步状态
  synced: () => renderBadge('已同步', 'success'),
  syncing: () => renderBadge('同步中', 'info'),
  syncFailed: () => renderBadge('同步失败', 'danger'),
}

/**
 * 渲染带计数的徽章
 */
export function renderCountBadge(count: number, variant: BadgeVariant = 'neutral'): string {
  const variantClasses = VARIANT_CLASSES[variant]
  return `
    <span class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-medium ${variantClasses}">
      ${count}
    </span>
  `.trim()
}

/**
 * 渲染标签组（多个标签）
 */
export function renderBadgeGroup(badges: Array<{ text: string; variant?: BadgeVariant }>, maxShow = 3): string {
  const visibleBadges = badges.slice(0, maxShow)
  const hiddenCount = badges.length - maxShow
  
  const badgeHtml = visibleBadges.map(b => renderBadge(b.text, b.variant || 'outline')).join('')
  const moreHtml = hiddenCount > 0 ? `<span class="text-xs text-muted-foreground">+${hiddenCount}</span>` : ''
  
  return `<div class="flex flex-wrap items-center gap-1">${badgeHtml}${moreHtml}</div>`
}

/**
 * 渲染带图标的状态指示器（小圆点）
 */
export function renderStatusDot(status: 'success' | 'warning' | 'danger' | 'info' | 'neutral' = 'neutral'): string {
  const colorMap = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    danger: 'bg-red-500',
    info: 'bg-blue-500',
    neutral: 'bg-gray-400',
  }
  return `<span class="inline-block h-2 w-2 rounded-full ${colorMap[status]}"></span>`
}
