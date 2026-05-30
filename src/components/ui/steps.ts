// ============ Steps 步骤组件 ============

import { escapeHtml } from '../../utils.ts'

// ============ 类型定义 ============

export type StepsDirection = 'horizontal' | 'vertical'

export interface StepItem {
  key: string
  title: string
  description?: string
  icon?: string // 自定义图标
  status?: 'wait' | 'process' | 'finish' | 'error' // 不传则根据 current/key 自动推断
}

export interface StepsConfig {
  steps: StepItem[]
  current: number // 当前步骤索引（从 0 开始）
  direction?: StepsDirection
  className?: string
  clickable?: boolean // 已完成的步骤是否可点击
}

// ============ 内部常量 ============

const ICON_DONE = `
  <span class="flex h-7 w-7 items-center justify-center rounded-full bg-primary">
    <i data-lucide="check" class="h-4 w-4 text-primary-foreground"></i>
  </span>`

const ICON_ERROR = `
  <span class="flex h-7 w-7 items-center justify-center rounded-full bg-destructive">
    <i data-lucide="x" class="h-4 w-4 text-destructive-foreground"></i>
  </span>`

function stepIcon(index: number, status: 'wait' | 'process' | 'finish' | 'error', customIcon?: string): string {
  if (status === 'finish') return ICON_DONE
  if (status === 'error') return ICON_ERROR
  if (customIcon) {
    return `
      <span class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground">
        <i data-lucide="${customIcon}" class="h-4 w-4"></i>
      </span>`
  }
  if (status === 'process') {
    return `
      <span class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-primary bg-primary text-primary-foreground text-xs font-bold">
        ${index + 1}
      </span>`
  }
  return `
    <span class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-muted-foreground/30 text-muted-foreground text-xs font-medium">
      ${index + 1}
    </span>`
}

// ============ 水平步骤条 ============

function renderHorizontalSteps(config: StepsConfig): string {
  const { steps, current, className = '', clickable } = config

  const stepsHtml = steps
    .map((step, i) => {
      const status = step.status ?? (
        i < current ? 'finish' :
        i === current ? 'process' :
        'wait'
      )
      const iconHtml = stepIcon(i, status, step.icon)

      const titleClass = status === 'wait'
        ? 'text-muted-foreground'
        : status === 'error'
          ? 'text-destructive'
          : 'text-foreground'

      const clickableAttr = clickable && status === 'finish'
        ? `data-step-click="${step.key}" class="cursor-pointer hover:opacity-80"`
        : ''

      return `
        <div class="flex items-center gap-2 ${clickableAttr}">
          ${iconHtml}
          <div class="min-w-0">
            <div class="text-sm font-medium ${titleClass}">${escapeHtml(step.title)}</div>
            ${step.description ? `<div class="text-xs text-muted-foreground mt-0.5">${escapeHtml(step.description)}</div>` : ''}
          </div>
        </div>`
    })
    .join(renderStepConnector())

  return `
    <div class="flex items-start ${className}">
      ${stepsHtml}
    </div>`
}

function renderStepConnector(): string {
  return `<div class="mx-2 mt-3.5 h-px flex-1 min-w-[24px] bg-border last:hidden"></div>`
}

// ============ 垂直步骤条 ============

function renderVerticalSteps(config: StepsConfig): string {
  const { steps, current, className = '', clickable } = config

  const stepsHtml = steps
    .map((step, i) => {
      const status = step.status ?? (
        i < current ? 'finish' :
        i === current ? 'process' :
        'wait'
      )
      const isLast = i === steps.length - 1

      const iconHtml = stepIcon(i, status, step.icon)

      const titleClass = status === 'wait'
        ? 'text-muted-foreground'
        : status === 'error'
          ? 'text-destructive'
          : 'text-foreground'

      const connectorClass = status === 'finish' ? 'bg-primary' : 'bg-border'

      const clickableAttr = clickable && status === 'finish'
        ? `data-step-click="${step.key}" class="relative flex gap-3 cursor-pointer hover:opacity-80"`
        : 'class="relative flex gap-3"'

      return `
        <div ${clickableAttr}>
          ${!isLast ? `<div class="absolute left-3.5 top-7 w-px h-full -bottom-1 ${connectorClass}"></div>` : ''}
          ${iconHtml}
          <div class="pb-6 min-w-0">
            <div class="text-sm font-medium ${titleClass}">${escapeHtml(step.title)}</div>
            ${step.description ? `<div class="text-xs text-muted-foreground mt-1">${escapeHtml(step.description)}</div>` : ''}
          </div>
        </div>`
    })
    .join('')

  return `
    <div class="${className}">
      ${stepsHtml}
    </div>`
}

// ============ 主渲染函数 ============

/**
 * 渲染步骤条
 *
 * 支持水平（horizontal）和垂直（vertical）两种布局
 * 自动根据 current 推断每个步骤的 status：
 * - i < current → finish（已完成）
 * - i === current → process（进行中）
 * - i > current → wait（等待中）
 */
export function renderSteps(config: StepsConfig): string {
  const { direction = 'horizontal' } = config

  if (direction === 'vertical') {
    return renderVerticalSteps(config)
  }
  return renderHorizontalSteps(config)
}
