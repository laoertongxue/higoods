// ============ Toast 通知组件 ============

import { escapeHtml } from '../../utils.ts'
import type { ActionConfig } from './types.ts'
import { toActionAttr } from './types.ts'

// ============ 类型定义 ============

export type ToastVariant = 'info' | 'success' | 'warning' | 'danger'

export interface ToastConfig {
  title: string
  description?: string
  variant?: ToastVariant
  icon?: string // 自定义图标，不传则按 variant 自动选
  duration?: number // 自动消失毫秒数，0 表示不自动消失
  dismissible?: boolean // 是否显示关闭按钮
  action?: ActionConfig & { label: string } // 操作按钮
}

// ============ 样式映射 ============

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-900',
  success: 'border-green-200 bg-green-50 text-green-900',
  warning: 'border-yellow-200 bg-yellow-50 text-yellow-900',
  danger: 'border-red-200 bg-red-50 text-red-900',
}

const VARIANT_ICONS: Record<ToastVariant, string> = {
  info: 'info',
  success: 'check-circle-2',
  warning: 'alert-triangle',
  danger: 'alert-circle',
}

const VARIANT_ICON_CLASSES: Record<ToastVariant, string> = {
  info: 'text-blue-600',
  success: 'text-green-600',
  warning: 'text-yellow-600',
  danger: 'text-red-600',
}

// ============ 渲染函数 ============

/**
 * 渲染单个 Toast 通知
 */
export function renderToast(config: ToastConfig, id?: string): string {
  const {
    title,
    description,
    variant = 'info',
    icon,
    duration = 4000,
    dismissible = true,
    action,
  } = config

  const iconName = icon ?? VARIANT_ICONS[variant]
  const iconClass = VARIANT_ICON_CLASSES[variant]
  const containerClass = VARIANT_CLASSES[variant]
  const toastId = id ?? `toast-${Math.random().toString(36).slice(2, 10)}`

  const iconHtml = `<i data-lucide="${iconName}" class="h-5 w-5 ${iconClass} shrink-0"></i>`

  const closeHtml = dismissible
    ? `
    <button type="button" class="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100 hover:bg-black/5" data-toast-close="${toastId}">
      <i data-lucide="x" class="h-4 w-4"></i>
    </button>`
    : ''

  const actionHtml = action
    ? `
    <button type="button" class="inline-flex items-center rounded-md border border-current/30 px-3 py-1.5 text-xs font-medium hover:bg-black/5 shrink-0" ${toActionAttr(action)}>
      ${escapeHtml(action.label)}
    </button>`
    : ''

  const durationAttr = duration > 0 ? `data-toast-duration="${duration}"` : ''
  const actionClass = action ? '' : '' // action 存在时不自动消失

  return `
    <div
      class="flex items-start gap-3 rounded-lg border p-4 shadow-lg ${containerClass} ${actionClass}"
      data-toast="${toastId}"
      ${durationAttr}
      role="alert"
    >
      ${iconHtml}
      <div class="flex-1 min-w-0">
        <p class="text-sm font-semibold">${escapeHtml(title)}</p>
        ${description ? `<p class="text-sm mt-1 opacity-80">${escapeHtml(description)}</p>` : ''}
      </div>
      ${actionHtml}
      ${closeHtml}
    </div>
  `.trim()
}

/**
 * 渲染 Toast 容器（固定在页面指定位置）
 *
 * 用法：在页面渲染时将容器放在页面底部，然后通过 renderToast() 向容器内插入 toast
 */
export function renderToastContainer(position: 'top-right' | 'top-center' | 'bottom-right' | 'bottom-center' = 'bottom-right'): string {
  const positionClasses: Record<string, string> = {
    'top-right': 'top-4 right-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-right': 'bottom-4 right-4',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2',
  }

  const positionClass = positionClasses[position] ?? positionClasses['bottom-right']

  return `<div class="fixed ${positionClass} z-[60] flex flex-col gap-2 max-w-sm w-full" data-toast-container></div>`
}

/**
 * 快捷 Toast 渲染
 */
export function renderSuccessToast(title: string, description?: string): string {
  return renderToast({ title, description, variant: 'success' })
}

export function renderWarningToast(title: string, description?: string): string {
  return renderToast({ title, description, variant: 'warning' })
}

export function renderDangerToast(title: string, description?: string): string {
  return renderToast({ title, description, variant: 'danger' })
}

export function renderInfoToast(title: string, description?: string): string {
  return renderToast({ title, description, variant: 'info' })
}

/**
 * 批量渲染多个 Toast
 */
export function renderToastList(toasts: ToastConfig[]): string {
  return toasts.map((t, i) => renderToast(t, `toast-${i}`)).join('')
}
