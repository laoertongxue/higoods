// ============ 抽屉组件 ============

import { escapeHtml } from '../../utils'
import { renderButton, renderPrimaryButton, renderSecondaryButton } from './button'
import type { DrawerConfig, DrawerFooterConfig, DrawerWidth, ActionConfig } from './types'

// 抽屉宽度映射
const WIDTH_CLASSES: Record<DrawerWidth, string> = {
  sm: 'sm:max-w-[480px]',
  md: 'sm:max-w-[600px]',
  lg: 'sm:max-w-[720px]',
  xl: 'sm:max-w-[960px]',
}

/**
 * 渲染抽屉头部
 */
function renderDrawerHeader(config: DrawerConfig): string {
  const { title, subtitle, closeAction } = config
  const closeAttr = `data-${closeAction.prefix}-action="${closeAction.action}"`
  
  return `
    <div class="sticky top-0 bg-background border-b px-6 py-4 z-10 flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold">${escapeHtml(title)}</h2>
        ${subtitle ? `<p class="text-sm text-muted-foreground">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      <button class="p-2 hover:bg-muted rounded-md" ${closeAttr}>
        <i data-lucide="x" class="h-5 w-5"></i>
      </button>
    </div>
  `
}

/**
 * 渲染抽屉底部
 */
export function renderDrawerFooter(config: DrawerFooterConfig): string {
  const buttons: string[] = []
  
  if (config.extra) {
    buttons.push(config.extra)
  }
  
  if (config.cancel) {
    const cancelLabel = config.cancel.label || '取消'
    buttons.push(renderSecondaryButton(cancelLabel, { prefix: config.cancel.prefix, action: config.cancel.action }))
  }
  
  if (config.confirm) {
    buttons.push(renderButton({
      label: config.confirm.label,
      variant: config.confirm.variant || 'primary',
      action: { prefix: config.confirm.prefix, action: config.confirm.action },
      disabled: config.confirm.disabled,
    }))
  }
  
  return `
    <div class="sticky bottom-0 bg-background border-t p-6 flex justify-end gap-3">
      ${buttons.join('')}
    </div>
  `
}

/**
 * 渲染抽屉组件
 * @param config 抽屉配置
 * @param content 抽屉内容HTML
 * @param footer 底部配置（可选）
 */
export function renderDrawer(config: DrawerConfig, content: string, footer?: DrawerFooterConfig): string {
  const { closeAction, width = 'sm', animate = true } = config
  const backdropAttr = `data-${closeAction.prefix}-action="${closeAction.action}"`
  const widthClass = WIDTH_CLASSES[width]
  const animateClass = animate ? 'animate-in slide-in-from-right duration-200' : ''
  
  return `
    <div class="fixed inset-0 z-50">
      <div class="absolute inset-0 bg-black/45" ${backdropAttr}></div>
      <div class="absolute inset-y-0 right-0 w-full border-l bg-background shadow-2xl ${widthClass} overflow-y-auto ${animateClass}">
        ${renderDrawerHeader(config)}
        <div class="p-6">
          ${content}
        </div>
        ${footer ? renderDrawerFooter(footer) : ''}
      </div>
    </div>
  `
}

/**
 * 渲染带表单的抽屉（常用快捷方式）
 */
export function renderFormDrawer(
  config: DrawerConfig & { 
    submitAction: ActionConfig & { label?: string }
    submitDisabled?: boolean
  },
  formContent: string
): string {
  return renderDrawer(config, formContent, {
    cancel: config.closeAction,
    confirm: {
      ...config.submitAction,
      label: config.submitAction.label || '保存',
      variant: 'primary',
      disabled: config.submitDisabled,
    },
  })
}

/**
 * 渲染详情抽屉（只有关闭按钮）
 */
export function renderDetailDrawer(config: DrawerConfig, content: string, extraButtons?: string): string {
  return renderDrawer(config, content, {
    extra: extraButtons,
    cancel: { ...config.closeAction, label: '关闭' },
  })
}

/**
 * 简化的抽屉渲染（只需提供前缀和基本信息）
 */
export function renderSimpleDrawer(options: {
  prefix: string
  closeAction: string
  title: string
  subtitle?: string
  content: string
  width?: DrawerWidth
  footer?: DrawerFooterConfig
}): string {
  return renderDrawer(
    {
      title: options.title,
      subtitle: options.subtitle,
      closeAction: { prefix: options.prefix, action: options.closeAction },
      width: options.width,
    },
    options.content,
    options.footer
  )
}
