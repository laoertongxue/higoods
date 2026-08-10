import { escapeHtml } from '../../../../utils.ts'
import type { LacePurchaseSourceLine } from '../../../../data/fcs/lace-factory-purchase-projection.ts'

let imagePreview: { src: string; alt: string } | null = null
let actionSequence = 0
let activeImageRefresh: (() => void) | null = null
let imageEscapeBound = false

function closeLaceImagePreview(): boolean {
  if (!imagePreview) return false
  imagePreview = null
  activeImageRefresh?.()
  activeImageRefresh = null
  return true
}

function ensureLaceImageEscapeBinding(): void {
  if (imageEscapeBound || typeof document === 'undefined') return
  imageEscapeBound = true
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !closeLaceImagePreview()) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }, true)
}

export function formatLaceQty(value: number, unit: string): string {
  return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)} ${unit}`
}

export function formatJakartaTime(value: string | undefined, includeSeconds = false): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  const text = new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    ...(includeSeconds ? { second: '2-digit' as const } : {}),
    hour12: false,
  }).format(parsed)
  return `${text.replaceAll('/', '-')} WIB`
}

export function renderLaceStatusBadge(
  text: string,
  tone: 'blue' | 'green' | 'yellow' | 'red' | 'slate' = 'slate',
): string {
  const classes = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    yellow: 'border-amber-300 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }[tone]
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes}">${escapeHtml(text)}</span>`
}

export function renderLaceBusinessImage(
  src: string,
  alt: string,
  sizeClass = 'h-12 w-12',
): string {
  return `<button type="button" class="relative shrink-0 overflow-hidden rounded-md border bg-slate-50 ${sizeClass}" data-lace-common-action="open-image" data-image-src="${escapeHtml(src)}" data-image-alt="${escapeHtml(alt)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(alt)}大图"><img class="h-full w-full object-cover" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" onload="this.parentElement.querySelector('[data-lace-image-loading]').classList.add('hidden')" onerror="this.classList.add('hidden');this.parentElement.querySelector('[data-lace-image-loading]').classList.add('hidden');this.parentElement.querySelector('[data-lace-image-error]').classList.remove('hidden');this.parentElement.querySelector('[data-lace-image-error]').classList.add('flex')"><span class="absolute inset-0 flex items-center justify-center bg-slate-50 px-1 text-[10px] text-slate-500" data-lace-image-loading>图片加载中…</span><span class="hidden h-full w-full items-center justify-center px-1 text-[10px] text-red-700" data-lace-image-error>图片加载失败，点击重试</span></button>`
}

export function renderLaceSourceStyles(
  sourceLines: readonly LacePurchaseSourceLine[],
  sizeClass = 'h-10 w-10',
): string {
  const styles = new Map<string, LacePurchaseSourceLine & { totalQty: number; lineCount: number }>()
  sourceLines.forEach((line) => {
    const key = line.styleId || `${line.styleCode}::${line.styleName}`
    const existing = styles.get(key)
    if (existing) {
      existing.totalQty += line.orderedQty
      existing.lineCount += 1
    } else styles.set(key, { ...line, totalQty: line.orderedQty, lineCount: 1 })
  })
  return `<div class="space-y-2">${[...styles.values()].map((style) => `<div class="flex items-center gap-3">${renderLaceBusinessImage(style.styleImageUrl, `${style.styleName}（${style.styleCode}）款式图`, sizeClass)}<div><div class="font-medium">${escapeHtml(style.styleName)}</div><div class="text-xs text-slate-500">${escapeHtml(style.styleCode)} · ${formatLaceQty(style.totalQty, style.unit)}${style.lineCount > 1 ? ` · ${style.lineCount} 条来源` : ''}</div></div></div>`).join('')}</div>`
}

export function renderLaceImagePreview(): string {
  if (!imagePreview) return ''
  return `<div class="fixed inset-0 z-[90] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="${escapeHtml(imagePreview.alt)}"><button type="button" class="absolute inset-0 bg-slate-950/75" data-lace-common-action="close-image" data-skip-page-rerender="true" aria-label="关闭大图"></button><section class="relative z-10 max-h-[92vh] max-w-[92vw] overflow-auto rounded-xl bg-white p-4 shadow-2xl"><header class="mb-3 flex items-center justify-between gap-4"><h2 class="font-semibold">${escapeHtml(imagePreview.alt)}</h2><button type="button" class="rounded-md border px-3 py-1.5 text-sm" data-lace-common-action="close-image" data-skip-page-rerender="true">关闭</button></header><img class="max-h-[80vh] max-w-[86vw] object-contain" src="${escapeHtml(imagePreview.src)}" alt="${escapeHtml(imagePreview.alt)}" onload="this.parentElement.querySelector('[data-lace-preview-loading]').classList.add('hidden')" onerror="this.classList.add('hidden');this.parentElement.querySelector('[data-lace-preview-loading]').classList.add('hidden');this.parentElement.querySelector('[data-lace-preview-error]').classList.remove('hidden')"><div class="min-w-80 rounded-md border bg-slate-50 px-8 py-16 text-center text-sm text-slate-500" data-lace-preview-loading>图片加载中…</div><div class="hidden min-w-80 rounded-md border border-red-200 bg-red-50 px-8 py-16 text-center text-sm text-red-700" data-lace-preview-error><p>图片加载失败，请核对该业务对象的原图素材。</p><button type="button" class="mt-4 rounded-md border border-red-300 bg-white px-3 py-1.5 font-medium" data-lace-common-action="retry-image" data-image-src="${escapeHtml(imagePreview.src)}" data-skip-page-rerender="true">重试加载</button></div></section></div>`
}

export function handleLaceCommonImageEvent(
  target: HTMLElement,
  event: Event | undefined,
  refreshOverlays: () => void,
): boolean {
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && imagePreview) {
    activeImageRefresh = refreshOverlays
    closeLaceImagePreview()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-lace-common-action]')
  const action = actionNode?.dataset.laceCommonAction
  if (action === 'open-image') {
    const src = actionNode?.dataset.imageSrc || ''
    if (!src) return true
    const thumbnail = actionNode?.querySelector<HTMLImageElement>('img')
    if (thumbnail?.classList.contains('hidden')) {
      thumbnail.classList.remove('hidden')
      actionNode?.querySelector('[data-lace-image-error]')?.classList.add('hidden')
      actionNode?.querySelector('[data-lace-image-error]')?.classList.remove('flex')
      actionNode?.querySelector('[data-lace-image-loading]')?.classList.remove('hidden')
      thumbnail.src = `${src}${src.includes('?') ? '&' : '?'}retry=${Date.now()}`
      return true
    }
    imagePreview = { src, alt: actionNode?.dataset.imageAlt || '业务对象图片' }
    activeImageRefresh = refreshOverlays
    refreshOverlays()
    return true
  }
  if (action === 'retry-image') {
    const src = actionNode?.dataset.imageSrc || ''
    const previewImage = actionNode?.closest('section')?.querySelector<HTMLImageElement>('img')
    if (!src || !previewImage) return true
    previewImage.classList.remove('hidden')
    actionNode?.closest('section')?.querySelector('[data-lace-preview-error]')?.classList.add('hidden')
    actionNode?.closest('section')?.querySelector('[data-lace-preview-loading]')?.classList.remove('hidden')
    previewImage.src = `${src}${src.includes('?') ? '&' : '?'}retry=${Date.now()}`
    return true
  }
  if (action === 'close-image') {
    activeImageRefresh = refreshOverlays
    closeLaceImagePreview()
    return true
  }
  return false
}

export function nextLaceClientActionId(prefix: string): string {
  actionSequence += 1
  return `${prefix}-${Date.now()}-${actionSequence}`
}

export function hydrateLaceSurface(surface: ParentNode | null | undefined): void {
  if (!surface) return
  ensureLaceImageEscapeBinding()
  void import('../../../../components/shell.ts')
    .then(({ hydrateIcons }) => hydrateIcons(surface))
    .catch(() => undefined)
}

export function refreshLaceRoot(selector: string, innerHtml: string): boolean {
  if (typeof document === 'undefined') return false
  const root = document.querySelector<HTMLElement>(selector)
  if (!root) return false
  const scrollContainer = root.closest<HTMLElement>('[data-page-content-root]')
  const scrollTop = scrollContainer?.scrollTop ?? 0
  root.innerHTML = innerHtml
  if (scrollContainer) scrollContainer.scrollTop = scrollTop
  hydrateLaceSurface(root)
  return true
}

export function renderLaceFeedback(message: string, ok: boolean): string {
  if (!message) return ''
  return `<div class="rounded-md border px-3 py-2 text-sm ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}">${escapeHtml(message)}</div>`
}

export function readNumberField(scope: ParentNode, selector: string): number {
  const field = scope.querySelector<HTMLInputElement>(selector)
  return field ? Number(field.value) : Number.NaN
}

export function readTextField(scope: ParentNode, selector: string): string {
  const field = scope.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)
  return field?.value.trim() ?? ''
}
