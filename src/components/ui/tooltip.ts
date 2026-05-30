// ============ Tooltip 提示组件 ============

import { escapeHtml } from '../../utils.ts'

// ============ 类型定义 ============

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right'

export interface TooltipConfig {
  text: string
  position?: TooltipPosition
  className?: string
  maxWidth?: string // 最大宽度，如 '200px'
}

// ============ 样式映射 ============

const POSITION_CLASSES: Record<TooltipPosition, string> = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

const ARROW_CLASSES: Record<TooltipPosition, string> = {
  top: 'top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-popover',
  bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-popover',
  left: 'left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-popover',
  right: 'right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-popover',
}

// ============ 渲染函数 ============

/**
 * 渲染内联 Tooltip（包裹一个触发元素）
 *
 * Tooltip 通过 CSS 的 group-hover 实现悬停显示
 * 包裹的元素需要用 class="group" 来标记触发区域
 *
 * @param trigger 触发元素的 HTML
 * @param config Tooltip 配置
 * @returns 包裹了 Tooltip 的 HTML
 */
export function renderTooltip(trigger: string, config: TooltipConfig): string {
  const { text, position = 'top', className = '', maxWidth } = config
  const positionClass = POSITION_CLASSES[position]
  const arrowClass = ARROW_CLASSES[position]
  const maxWidthStyle = maxWidth ? `max-width: ${maxWidth};` : 'max-width: 240px;'

  return `
    <span class="relative inline-flex group/tip ${className}">
      ${trigger}
      <span class="absolute z-50 ${positionClass} hidden group-hover/tip:inline-block pointer-events-none">
        <span class="block rounded-md border bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-md whitespace-nowrap" style="${maxWidthStyle}">
          ${escapeHtml(text)}
        </span>
      </span>
    </span>`.trim()
}

/**
 * 渲染带图标的 Tooltip（常见于表头、字段标签旁）
 *
 * @param text 提示文本
 * @param position 位置
 * @returns 问号图标 + Tooltip 的完整 HTML
 */
export function renderHelpTip(text: string, position: TooltipPosition = 'top'): string {
  return renderTooltip(
    `<i data-lucide="help-circle" class="h-4 w-4 text-muted-foreground cursor-help"></i>`,
    { text, position },
  )
}

/**
 * 渲染纯文本 Tooltip 内容块（不包裹触发元素，用于 JS 动态插入）
 *
 * 适用于通过 JS 在 mouseenter/mouseleave 时动态显示/隐藏的场景
 */
export function renderTooltipContent(text: string, position: TooltipPosition = 'top', maxWidth?: string): string {
  const maxWidthStyle = maxWidth ? `max-width: ${maxWidth};` : 'max-width: 240px;'

  return `
    <span class="absolute z-50 ${POSITION_CLASSES[position]}">
      <span class="block rounded-md border bg-popover px-2 py-1.5 text-xs text-popover-foreground shadow-md whitespace-nowrap" style="${maxWidthStyle}">
        ${escapeHtml(text)}
      </span>
    </span>`.trim()
}

/**
 * 渲染截断文本 + Tooltip（超出显示省略号，悬停显示完整文本）
 *
 * @param text 完整文本
 * @param maxWidthClass 截断宽度 Tailwind 类，如 'max-w-[120px]'
 */
export function renderTruncatedWithTooltip(text: string, maxWidthClass = 'max-w-[120px]'): string {
  return renderTooltip(
    `<span class="block truncate ${maxWidthClass}">${escapeHtml(text)}</span>`,
    { text, position: 'top' },
  )
}
