// ============ Skeleton 骨架屏组件 ============

// ============ 样式常量 ============

const SKELETON_BASE = 'animate-pulse rounded-md bg-muted'

// ============ 基础骨架 ============

/**
 * 渲染通用骨架块
 *
 * 基础元素，所有其他骨架组件基于此构建
 */
export function renderSkeleton(className = ''): string {
  return `<div class="${SKELETON_BASE} ${className}"></div>`
}

/**
 * 渲染文本骨架行
 */
export function renderSkeletonText(options?: {
  lines?: number
  lastLineWidth?: string // 最后一行宽度，如 'w-3/4'，模拟段落末尾短行
  className?: string
}): string {
  const { lines = 3, lastLineWidth = 'w-1/2', className = '' } = options ?? {}

  const lineHtmls: string[] = []
  for (let i = 0; i < lines; i++) {
    const isLast = i === lines - 1
    const widthClass = isLast ? lastLineWidth : 'w-full'
    lineHtmls.push(`<div class="${SKELETON_BASE} h-4 ${widthClass} ${className}"></div>`)
  }

  return `<div class="space-y-2">${lineHtmls.join('')}</div>`
}

/**
 * 渲染标题骨架
 */
export function renderSkeletonTitle(className?: string): string {
  return `<div class="${SKELETON_BASE} h-6 w-1/3 ${className ?? ''}"></div>`
}

/**
 * 渲染头像骨架（圆形）
 */
export function renderSkeletonAvatar(size: 'sm' | 'md' | 'lg' = 'md', className?: string): string {
  const sizeMap = { sm: 'h-8 w-8', md: 'h-10 w-10', lg: 'h-12 w-12' }
  return `<div class="${SKELETON_BASE} ${sizeMap[size]} rounded-full ${className ?? ''}"></div>`
}

/**
 * 渲染矩形骨架（图片/缩略图占位）
 */
export function renderSkeletonImage(width: string, height: string, className?: string): string {
  return `<div class="${SKELETON_BASE} ${width} ${height} ${className ?? ''}"></div>`
}

/**
 * 渲染按钮骨架
 */
export function renderSkeletonButton(width = 'w-24', className?: string): string {
  return `<div class="${SKELETON_BASE} h-9 ${width} ${className ?? ''}"></div>`
}

// ============ 组合骨架 ============

/**
 * 渲染段落骨架（标题 + 多行文本）
 */
export function renderSkeletonParagraph(options?: {
  lines?: number
  className?: string
}): string {
  const { lines = 3, className = '' } = options ?? {}

  return `
    <div class="space-y-3 ${className}">
      ${renderSkeletonTitle()}
      ${renderSkeletonText({ lines })}
    </div>`.trim()
}

/**
 * 渲染单个卡片骨架
 */
export function renderSkeletonCard(options?: {
  hasHeader?: boolean
  bodyLines?: number
  hasFooter?: boolean
  className?: string
}): string {
  const { hasHeader = true, bodyLines = 3, hasFooter = false, className = '' } = options ?? {}

  const headerHtml = hasHeader
    ? `<div class="flex items-center justify-between p-6 pb-2">${renderSkeletonTitle('w-1/4')}${renderSkeletonButton('w-20')}</div>`
    : ''

  const footerHtml = hasFooter
    ? `<div class="flex items-center justify-end gap-2 p-6 pt-2">${renderSkeletonButton('w-16')}${renderSkeletonButton('w-20')}</div>`
    : ''

  return `
    <div class="rounded-lg border bg-card text-card-foreground shadow-sm ${className}">
      ${headerHtml}
      <div class="p-6 pt-2">
        ${renderSkeletonText({ lines: bodyLines })}
      </div>
      ${footerHtml}
    </div>`.trim()
}

/**
 * 渲染卡片骨架网格
 */
export function renderSkeletonCardGrid(count = 3, columns = 3, className?: string): string {
  const gridClass = `grid gap-4 md:grid-cols-2 lg:grid-cols-${columns}`
  const cards = Array.from({ length: count }, () => renderSkeletonCard()).join('')

  return `<div class="${gridClass} ${className ?? ''}">${cards}</div>`
}

/**
 * 渲染列表骨架（左侧图标 + 多行文本）
 */
export function renderSkeletonListItem(options?: {
  count?: number
  showAvatar?: boolean
  lines?: number
  className?: string
}): string {
  const { count = 5, showAvatar = true, lines = 2, className = '' } = options ?? {}

  const items = Array.from({ length: count }, () => {
    const avatarHtml = showAvatar
      ? `<div class="shrink-0">${renderSkeletonAvatar('md')}</div>`
      : ''

    return `
      <div class="flex items-start gap-3 py-3">
        ${avatarHtml}
        <div class="flex-1 space-y-2">
          <div class="${SKELETON_BASE} h-4 w-1/3"></div>
          ${Array.from({ length: lines }, (_, i) => {
            const isLast = i === lines - 1
            return `<div class="${SKELETON_BASE} h-3 ${isLast ? 'w-2/3' : 'w-full'}"></div>`
          }).join('')}
        </div>
      </div>`
  }).join('<div class="border-b last:border-0"></div>')

  return `<div class="${className}">${items}</div>`.trim()
}

/**
 * 渲染表格骨架（最常用）
 */
export function renderSkeletonTable(options?: {
  rows?: number
  columns?: number
  showHeader?: boolean
  className?: string
}): string {
  const { rows = 5, columns = 5, showHeader = true, className = '' } = options ?? {}

  const headerHtml = showHeader
    ? `
    <thead>
      <tr class="border-b">
        ${Array.from({ length: columns }, () => `<th class="h-10 px-4"><div class="${SKELETON_BASE} h-4 w-full"></div></th>`).join('')}
      </tr>
    </thead>`
    : ''

  const bodyHtml = `
    <tbody>
      ${Array.from({ length: rows }, () => `
        <tr class="border-b">
          ${Array.from({ length: columns }, () => `<td class="p-4"><div class="${SKELETON_BASE} h-4 w-full"></div></td>`).join('')}
        </tr>
      `).join('')}
    </tbody>`

  return `
    <div class="w-full overflow-auto ${className}">
      <table class="w-full caption-bottom text-sm">
        ${headerHtml}
        ${bodyHtml}
      </table>
    </div>`.trim()
}

/**
 * 渲染表单骨架
 */
export function renderSkeletonForm(fields = 4, className?: string): string {
  const fieldHtmls = Array.from({ length: fields }, () => `
    <div class="space-y-2">
      <div class="${SKELETON_BASE} h-4 w-16"></div>
      <div class="${SKELETON_BASE} h-10 w-full"></div>
    </div>
  `).join('')

  return `
    <div class="space-y-4 ${className ?? ''}">
      <div class="grid grid-cols-2 gap-4">
        ${fieldHtmls}
      </div>
      <div class="flex justify-end gap-2 pt-4">
        ${renderSkeletonButton('w-16')}
        ${renderSkeletonButton('w-20')}
      </div>
    </div>`.trim()
}

/**
 * 渲染页面骨架（标题区 + 表格 + 分页）
 */
export function renderSkeletonPage(options?: {
  className?: string
}): string {
  const { className = '' } = options ?? {}

  return `
    <div class="space-y-6 ${className}">
      <div class="flex items-center justify-between">
        ${renderSkeletonTitle('w-1/4')}
        <div class="flex gap-2">
          ${renderSkeletonButton('w-20')}
          ${renderSkeletonButton('w-28')}
        </div>
      </div>
      <div>${renderSkeletonCard({ hasHeader: false, bodyLines: 0 })}</div>
      ${renderSkeletonTable({ rows: 6, columns: 5 })}
      <div class="flex justify-between">
        <div class="${SKELETON_BASE} h-4 w-24"></div>
        <div class="flex gap-2">
          ${renderSkeletonButton('w-16')}
          ${renderSkeletonButton('w-16')}
        </div>
      </div>
    </div>`.trim()
}
