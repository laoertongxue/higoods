// ============ Progress 进度条组件 ============

import { escapeHtml } from '../../utils.ts'

// ============ 类型定义 ============

export type ProgressVariant = 'default' | 'success' | 'warning' | 'danger'

export interface ProgressConfig {
  value: number // 0-100
  max?: number // 默认 100
  variant?: ProgressVariant
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean // 是否显示百分比文字
  labelPosition?: 'inside' | 'right' // 百分比位置
  className?: string
  indeterminate?: boolean // 不确定进度（加载动画）
}

// ============ 样式映射 ============

const SIZE_CLASSES: Record<string, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
}

const VARIANT_CLASSES: Record<ProgressVariant, string> = {
  default: 'bg-primary',
  success: 'bg-green-500',
  warning: 'bg-yellow-500',
  danger: 'bg-red-500',
}

const TRACK_CLASSES = 'w-full overflow-hidden rounded-full bg-secondary'

// ============ 渲染函数 ============

/**
 * 渲染进度条
 */
export function renderProgress(config: ProgressConfig): string {
  const {
    value,
    max = 100,
    variant = 'default',
    size = 'md',
    showLabel = false,
    labelPosition = 'right',
    className = '',
    indeterminate = false,
  } = config

  const percentage = max > 0 ? Math.min(100, Math.max(0, Math.round((value / max) * 100))) : 0
  const sizeClass = SIZE_CLASSES[size]
  const variantClass = VARIANT_CLASSES[variant]

  if (indeterminate) {
    return renderIndeterminateProgress(size, variant, className)
  }

  const barHtml = `
    <div class="h-full rounded-full ${variantClass} transition-all duration-300 ease-in-out"
      style="width: ${percentage}%"
      role="progressbar"
      aria-valuenow="${value}"
      aria-valuemin="0"
      aria-valuemax="${max}"
    ></div>`

  const labelHtml = showLabel
    ? `<span class="text-xs text-muted-foreground shrink-0 ml-2">${percentage}%</span>`
    : ''

  return `
    <div class="flex items-center gap-2 ${className}">
      <div class="${TRACK_CLASSES} ${sizeClass} flex-1">
        ${barHtml}
      </div>
      ${labelHtml}
    </div>`.trim()
}

/**
 * 渲染不确定进度条（加载动画）
 */
function renderIndeterminateProgress(
  size: string,
  variant: ProgressVariant,
  className: string,
): string {
  const sizeClass = SIZE_CLASSES[size]
  const variantClass = VARIANT_CLASSES[variant]

  return `
    <div class="${TRACK_CLASSES} ${sizeClass} ${className}" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">
      <div class="h-full w-1/2 rounded-full ${variantClass} animate-[indeterminate_1.5s_ease-in-out_infinite]"></div>
    </div>`.trim()
}

/**
 * 渲染带标签的进度条（任务名称 + 百分比）
 */
export function renderLabeledProgress(config: {
  label: string
  value: number
  max?: number
  variant?: ProgressVariant
  size?: 'sm' | 'md' | 'lg'
  className?: string
}): string {
  const { label, value, max = 100, variant, size, className } = config
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0

  return `
    <div class="space-y-1.5 ${className ?? ''}">
      <div class="flex items-center justify-between text-sm">
        <span class="font-medium">${escapeHtml(label)}</span>
        <span class="text-muted-foreground">${escapeHtml(String(value))} / ${escapeHtml(String(max))}（${percentage}%）</span>
      </div>
      ${renderProgress({ value, max, variant, size: size ?? 'sm' })}
    </div>`.trim()
}

/**
 * 渲染带状态颜色的进度条
 */
export function renderStatusProgress(value: number, max = 100): string {
  const percentage = max > 0 ? Math.round((value / max) * 100) : 0
  const variant: ProgressVariant =
    percentage >= 100 ? 'success' :
    percentage >= 70 ? 'default' :
    percentage >= 30 ? 'warning' :
    'danger'

  return renderProgress({ value, max, variant, size: 'sm' })
}

/**
 * 渲染多段组合进度条（如：已完成/进行中/待处理 分段）
 */
export interface ProgressSegment {
  value: number
  variant: ProgressVariant
  label?: string
}

export function renderSegmentedProgress(segments: ProgressSegment[], max = 100, size: 'sm' | 'md' | 'lg' = 'sm'): string {
  const sizeClass = SIZE_CLASSES[size]

  const segmentBars = segments
    .map((seg) => {
      const width = max > 0 ? Math.round((seg.value / max) * 100) : 0
      const variantClass = VARIANT_CLASSES[seg.variant]
      return `<div class="h-full ${variantClass} first:rounded-l-full last:rounded-r-full" style="width: ${width}%" title="${escapeHtml(seg.label ?? '')}"></div>`
    })
    .join('')

  const legendHtml = segments
    .filter((s) => s.label)
    .map((seg) => {
      const dotClass = VARIANT_CLASSES[seg.variant]
      return `
        <span class="flex items-center gap-1 text-xs text-muted-foreground">
          <span class="inline-block h-2 w-2 rounded-full ${dotClass}"></span>
          ${escapeHtml(seg.label!)}
        </span>`
    })
    .join('')

  const legend = legendHtml
    ? `<div class="flex items-center gap-3 mt-1.5">${legendHtml}</div>`
    : ''

  return `
    <div>
      <div class="${TRACK_CLASSES} ${sizeClass} flex">
        ${segmentBars}
      </div>
      ${legend}
    </div>`.trim()
}
