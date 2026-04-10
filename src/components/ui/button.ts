// ============ 按钮组件 ============

import { escapeHtml } from '../../utils.ts'
import { toActionAttr } from './types.ts'
import type { ButtonConfig, ButtonVariant, ButtonSize, ActionConfig } from './types.ts'

// 按钮变体样式映射
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
  secondary: 'border border-input bg-background hover:bg-muted',
  danger: 'bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500',
  ghost: 'hover:bg-muted',
  icon: 'p-2 hover:bg-muted',
}

// 按钮尺寸样式映射
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-9 px-4 text-sm',
  lg: 'h-10 px-6 text-base',
}

// 图标尺寸映射
const ICON_SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-3.5 w-3.5',
  md: 'h-4 w-4',
  lg: 'h-5 w-5',
}

/**
 * 渲染按钮组件
 */
export function renderButton(config: ButtonConfig): string {
  const {
    label,
    icon,
    variant = 'secondary',
    size = 'md',
    action,
    disabled = false,
    className = '',
    type = 'button',
  } = config

  const isIconOnly = variant === 'icon' || (!label && icon)
  
  const baseClasses = 'inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50'
  
  const variantClasses = VARIANT_CLASSES[variant]
  const sizeClasses = isIconOnly ? '' : SIZE_CLASSES[size]
  const iconClasses = ICON_SIZE_CLASSES[size]
  
  const actionAttr = action ? toActionAttr(action) : ''
  const disabledAttr = disabled ? 'disabled' : ''
  
  const iconHtml = icon ? `<i data-lucide="${icon}" class="${iconClasses}"></i>` : ''
  const labelHtml = label ? escapeHtml(label) : ''
  
  return `
    <button
      type="${type}"
      class="${baseClasses} ${variantClasses} ${sizeClasses} ${className}"
      ${actionAttr}
      ${disabledAttr}
    >
      ${iconHtml}${labelHtml}
    </button>
  `.trim()
}

/**
 * 渲染主要按钮（蓝色）
 */
export function renderPrimaryButton(label: string, action?: ActionConfig, icon?: string): string {
  return renderButton({ label, icon, variant: 'primary', action })
}

/**
 * 渲染次要按钮（边框）
 */
export function renderSecondaryButton(label: string, action?: ActionConfig, icon?: string): string {
  return renderButton({ label, icon, variant: 'secondary', action })
}

/**
 * 渲染危险按钮（红色）
 */
export function renderDangerButton(label: string, action?: ActionConfig, icon?: string): string {
  return renderButton({ label, icon, variant: 'danger', action })
}

/**
 * 渲染图标按钮
 */
export function renderIconButton(icon: string, action?: ActionConfig, title?: string): string {
  const actionAttr = action ? toActionAttr(action) : ''
  const titleAttr = title ? `title="${escapeHtml(title)}"` : ''
  
  return `
    <button type="button" class="p-2 rounded-md hover:bg-muted" ${actionAttr} ${titleAttr}>
      <i data-lucide="${icon}" class="h-4 w-4"></i>
    </button>
  `.trim()
}

/**
 * 渲染按钮组
 */
export function renderButtonGroup(buttons: string[], className = ''): string {
  return `<div class="flex items-center gap-2 ${className}">${buttons.join('')}</div>`
}
