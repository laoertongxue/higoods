// ============ 对话框组件 ============

import { escapeHtml } from '../../utils'
import { renderButton, renderPrimaryButton, renderSecondaryButton, renderDangerButton } from './button'
import type { DialogConfig, ConfirmDialogConfig, AlertDialogConfig, DialogWidth, ActionConfig } from './types'

// 对话框宽度映射
const WIDTH_CLASSES: Record<DialogWidth, string> = {
  xs: 'w-[360px]',
  sm: 'w-[420px]',
  md: 'w-[480px]',
  lg: 'w-[600px]',
}

/**
 * 渲染对话框组件
 * @param config 对话框配置
 * @param content 对话框内容HTML
 * @param footer 底部按钮HTML（可选）
 */
export function renderDialog(config: DialogConfig, content: string, footer?: string): string {
  const { title, description, closeAction, width = 'md' } = config
  const backdropAttr = `data-${closeAction.prefix}-action="${closeAction.action}"`
  const widthClass = WIDTH_CLASSES[width]
  
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div class="fixed inset-0 bg-black/45" ${backdropAttr}></div>
      <div class="relative bg-background rounded-lg shadow-lg ${widthClass} max-w-[90vw] p-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <h2 class="text-lg font-semibold">${escapeHtml(title)}</h2>
            ${description ? `<p class="text-sm text-muted-foreground mt-1">${escapeHtml(description)}</p>` : ''}
          </div>
          <button class="p-1 hover:bg-muted rounded-md -mr-2 -mt-2" ${backdropAttr}>
            <i data-lucide="x" class="h-4 w-4"></i>
          </button>
        </div>
        <div class="mb-6">
          ${content}
        </div>
        ${footer ? `<div class="flex justify-end gap-3">${footer}</div>` : ''}
      </div>
    </div>
  `
}

/**
 * 渲染确认对话框
 */
export function renderConfirmDialog(config: ConfirmDialogConfig, content?: string): string {
  const { confirmAction, cancelLabel = '取消', danger = false, closeAction } = config
  
  const cancelBtn = renderSecondaryButton(cancelLabel, closeAction)
  const confirmBtn = danger 
    ? renderDangerButton(confirmAction.label, { prefix: confirmAction.prefix, action: confirmAction.action })
    : renderPrimaryButton(confirmAction.label, { prefix: confirmAction.prefix, action: confirmAction.action })
  
  const footer = `${cancelBtn}${confirmBtn}`
  
  return renderDialog(config, content || '', footer)
}

/**
 * 渲染警告/信息对话框
 */
export function renderAlertDialog(config: AlertDialogConfig, content?: string): string {
  const { variant = 'info', confirmLabel = '确定', closeAction } = config
  
  const iconMap = {
    info: 'info',
    warning: 'alert-triangle',
    danger: 'alert-circle',
    success: 'check-circle-2',
  }
  
  const colorMap = {
    info: 'text-blue-600 bg-blue-50',
    warning: 'text-yellow-600 bg-yellow-50',
    danger: 'text-red-600 bg-red-50',
    success: 'text-green-600 bg-green-50',
  }
  
  const icon = iconMap[variant]
  const colorClass = colorMap[variant]
  
  const iconHtml = `
    <div class="flex items-center justify-center w-12 h-12 rounded-full ${colorClass} mb-4 mx-auto">
      <i data-lucide="${icon}" class="h-6 w-6"></i>
    </div>
  `
  
  const fullContent = `${iconHtml}${content || ''}`
  const footer = renderPrimaryButton(confirmLabel, closeAction)
  
  return renderDialog({ ...config, width: config.width || 'sm' }, fullContent, footer)
}

/**
 * 渲染简单的确认弹窗（快捷方式）
 */
export function renderSimpleConfirmDialog(options: {
  prefix: string
  closeAction: string
  confirmAction: string
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  content?: string
}): string {
  return renderConfirmDialog(
    {
      title: options.title,
      description: options.description,
      closeAction: { prefix: options.prefix, action: options.closeAction },
      confirmAction: { prefix: options.prefix, action: options.confirmAction, label: options.confirmLabel || '确定' },
      cancelLabel: options.cancelLabel,
      danger: options.danger,
    },
    options.content
  )
}

/**
 * 渲染带表单的对话框
 */
export function renderFormDialog(
  config: DialogConfig & { 
    submitAction: ActionConfig & { label?: string }
    cancelLabel?: string
    submitDisabled?: boolean
  },
  formContent: string
): string {
  const cancelBtn = renderSecondaryButton(config.cancelLabel || '取消', config.closeAction)
  const submitBtn = renderButton({
    label: config.submitAction.label || '确定',
    variant: 'primary',
    action: config.submitAction,
    disabled: config.submitDisabled,
  })
  
  const footer = `${cancelBtn}${submitBtn}`
  
  return renderDialog(config, formContent, footer)
}

/**
 * 渲染删除确认对话框（常用快捷方式）
 */
export function renderDeleteConfirmDialog(options: {
  prefix: string
  closeAction: string
  confirmAction: string
  itemName?: string
  customMessage?: string
}): string {
  const message = options.customMessage || 
    (options.itemName ? `确定要删除"${escapeHtml(options.itemName)}"吗？此操作无法撤销。` : '确定要删除吗？此操作无法撤销。')
  
  return renderSimpleConfirmDialog({
    prefix: options.prefix,
    closeAction: options.closeAction,
    confirmAction: options.confirmAction,
    title: '确认删除',
    confirmLabel: '删除',
    danger: true,
    content: `<p class="text-sm text-muted-foreground">${message}</p>`,
  })
}
