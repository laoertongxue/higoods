import { escapeHtml } from '../../utils.ts'

/** A local confirmation keeps the current form intact and does not block other browser tabs. */
export function confirmPmsAction(message: string, confirmLabel: string, title = '确认操作'): Promise<boolean> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div')
    overlay.className = 'fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-4'
    overlay.setAttribute('role', 'dialog'); overlay.setAttribute('aria-modal', 'true'); overlay.setAttribute('aria-label', title)
    overlay.innerHTML = `<section class="w-full max-w-lg rounded-xl border bg-background p-5 shadow-2xl"><h2 class="text-lg font-semibold">${escapeHtml(title)}</h2><p class="my-4 whitespace-pre-wrap text-sm">${escapeHtml(message)}</p><footer class="flex justify-end gap-3"><button type="button" data-pms-confirm-cancel class="rounded-md border px-4 py-2 text-sm">取消</button><button type="button" data-pms-confirm-accept class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">${escapeHtml(confirmLabel)}</button></footer></section>`
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const finish = (accepted: boolean): void => {
      window.removeEventListener('keydown', key, true)
      overlay.remove(); previousFocus?.focus(); resolve(accepted)
    }
    const key = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); finish(false) }
      if (event.key === 'Tab') {
        const buttons = [...overlay.querySelectorAll<HTMLButtonElement>('button')]
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
        event.preventDefault(); buttons[(index + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus()
      }
    }
    overlay.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null
      if (event.target === overlay || target?.closest('[data-pms-confirm-cancel]')) finish(false)
      else if (target?.closest('[data-pms-confirm-accept]')) finish(true)
    })
    window.addEventListener('keydown', key, true)
    document.body.appendChild(overlay)
    overlay.querySelector<HTMLButtonElement>('[data-pms-confirm-cancel]')?.focus()
  })
}

let imagePreview: { src: string; alt: string } | null = null
let actionSequence = 0
let imagePreviewElement: HTMLElement | null = null
let imageReturnFocus: HTMLElement | null = null
let imageEscapeBound = false
const boundPmsImages = new WeakSet<HTMLImageElement>()

function closePmsImagePreview(): boolean {
  if (!imagePreview) return false
  imagePreview = null
  imagePreviewElement?.remove()
  imagePreviewElement = null
  if (imageReturnFocus?.isConnected) imageReturnFocus.focus()
  imageReturnFocus = null
  return true
}

function ensurePmsImageEscapeBinding(): void {
  if (imageEscapeBound || typeof document === 'undefined') return
  imageEscapeBound = true
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Escape' && closePmsImagePreview()) {
        event.preventDefault()
        event.stopImmediatePropagation()
        return
      }
      if (event.key !== 'Tab' || !imagePreviewElement) return
      const controls = Array.from(imagePreviewElement.querySelectorAll<HTMLElement>('button:not([disabled])')).filter(control => control.getClientRects().length > 0)
      const first = controls[0], last = controls.at(-1)
      if (event.shiftKey && document.activeElement === first && last) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last && first) { event.preventDefault(); first.focus() }
    },
    true,
  )
}

export function formatPmsQty(value: number, unit = ''): string {
  const formatted = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(value)
  return unit ? `${formatted} ${unit}` : formatted
}

export type PmsCurrency = 'RMB' | 'USD' | 'IDR'

const PMS_CURRENCY_SYMBOL: Record<PmsCurrency, string> = {
  RMB: '¥',
  USD: '$',
  IDR: 'Rp',
}

/**
 * § 共享层补 IDR:在 5 个 PMS 业务页面曾各自内联 formatFeeAmount / formatMaterialMoney 处理 IDR,
 * 现在统一通过此函数渲染。
 *
 * - RMB / USD:zh-CN locale + 2 位小数 + 前缀货币符号
 * - IDR:id-ID locale + 无小数(印尼盾无小数单位习惯)+ Rp 符号
 */
export function formatPmsMoney(value: number, currency: PmsCurrency = 'RMB'): string {
  if (currency === 'IDR') {
    const formatted = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(value)
    return `${PMS_CURRENCY_SYMBOL.IDR} ${formatted}`
  }
  const formatted = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)
  return `${PMS_CURRENCY_SYMBOL[currency]}${formatted}`
}

export function formatPmsTime(value: string | undefined, includeSeconds = false): string {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return escapeHtml(value)
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

export function renderPmsStatusBadge(text: string, tone: 'blue' | 'green' | 'yellow' | 'red' | 'slate' = 'slate'): string {
  const classes = {
    blue: 'border-blue-200 bg-blue-50 text-blue-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    yellow: 'border-amber-300 bg-amber-50 text-amber-800',
    red: 'border-red-200 bg-red-50 text-red-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  }[tone]
  return `<span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes}">${escapeHtml(text)}</span>`
}

export function renderPmsBusinessImage(src: string, alt: string, sizeClass = 'h-11 w-11'): string {
  return `<button type="button" class="relative shrink-0 overflow-hidden rounded-md border bg-slate-50 ${sizeClass}" data-pms-common-action="open-image" data-image-src="${escapeHtml(src)}" data-image-alt="${escapeHtml(alt)}" data-skip-page-rerender="true" aria-label="查看${escapeHtml(alt)}大图"><img class="h-full w-full object-cover" src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" onload="this.parentElement.querySelector('[data-pms-image-loading]').classList.add('hidden')" onerror="this.classList.add('hidden');this.parentElement.querySelector('[data-pms-image-loading]').classList.add('hidden');this.parentElement.querySelector('[data-pms-image-error]').classList.remove('hidden');this.parentElement.querySelector('[data-pms-image-error]').classList.add('flex')"><span class="absolute inset-0 flex items-center justify-center bg-slate-50 px-1 text-center text-[10px] leading-tight text-slate-500" data-pms-image-loading>图片加载中…</span><span class="hidden h-full w-full items-center justify-center px-1 text-center text-[10px] leading-tight text-red-700" data-pms-image-error>图片加载失败，点击重试</span></button>`
}

export function renderPmsImagePreview(): string {
  if (!imagePreview || imagePreviewElement) return ''
  return `<div class="fixed inset-0 z-[90] flex items-center justify-center p-5" role="dialog" aria-modal="true" aria-label="${escapeHtml(imagePreview.alt)}"><button type="button" class="absolute inset-0 bg-slate-950/75" data-pms-common-action="close-image" data-skip-page-rerender="true" aria-label="关闭大图"></button><section class="relative z-10 max-h-[92vh] max-w-[92vw] overflow-auto rounded-xl bg-white p-4 shadow-2xl"><header class="mb-3 flex items-center justify-between gap-4"><h2 class="font-semibold">${escapeHtml(imagePreview.alt)}</h2><button type="button" class="rounded-md border px-3 py-1.5 text-sm" data-pms-common-action="close-image" data-skip-page-rerender="true">关闭</button></header><img class="max-h-[80vh] max-w-[86vw] object-contain" src="${escapeHtml(imagePreview.src)}" alt="${escapeHtml(imagePreview.alt)}" onload="this.parentElement.querySelector('[data-pms-preview-loading]').classList.add('hidden')" onerror="this.classList.add('hidden');this.parentElement.querySelector('[data-pms-preview-loading]').classList.add('hidden');this.parentElement.querySelector('[data-pms-preview-error]').classList.remove('hidden')"><div class="min-w-80 rounded-md border bg-slate-50 px-8 py-16 text-center text-sm text-slate-500" data-pms-preview-loading>图片加载中…</div><div class="hidden min-w-80 rounded-md border border-red-200 bg-red-50 px-8 py-16 text-center text-sm text-red-700" data-pms-preview-error><p>图片加载失败，请核对该业务对象的原图素材。</p><button type="button" class="mt-4 rounded-md border border-red-300 bg-white px-3 py-1.5 font-medium" data-pms-common-action="retry-image" data-image-src="${escapeHtml(imagePreview.src)}" data-skip-page-rerender="true">重试加载</button></div></section></div>`
}

export function handlePmsCommonImageEvent(target: HTMLElement, event: Event | undefined, _refreshOverlays: () => void): boolean {
  if (event?.type === 'keydown' && event instanceof KeyboardEvent && event.key === 'Escape' && imagePreview) {
    closePmsImagePreview()
    return true
  }
  const actionNode = target.closest<HTMLElement>('[data-pms-common-action]')
  const action = actionNode?.dataset.pmsCommonAction
  if (action === 'open-image') {
    const src = actionNode?.dataset.imageSrc || ''
    if (!src) return true
    const thumbnail = actionNode?.querySelector<HTMLImageElement>('img')
    if (thumbnail?.classList.contains('hidden')) {
      thumbnail.classList.remove('hidden')
      actionNode?.querySelector('[data-pms-image-error]')?.classList.add('hidden')
      actionNode?.querySelector('[data-pms-image-error]')?.classList.remove('flex')
      actionNode?.querySelector('[data-pms-image-loading]')?.classList.remove('hidden')
      thumbnail.src = `${src}${src.includes('?') ? '&' : '?'}retry=${Date.now()}`
      return true
    }
    imagePreview = { src, alt: actionNode?.dataset.imageAlt || '业务对象图片' }
    imageReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const host = document.createElement('div')
    host.innerHTML = renderPmsImagePreview()
    imagePreviewElement = host.firstElementChild as HTMLElement
    imagePreviewElement.dataset.pmsImagePreview = 'true'
    imagePreviewElement.addEventListener('click', (previewEvent) => {
      previewEvent.stopPropagation()
      if (previewEvent.target instanceof HTMLElement) handlePmsCommonImageEvent(previewEvent.target, previewEvent, () => undefined)
    })
    document.body.appendChild(imagePreviewElement)
    hydratePmsSurface(imagePreviewElement, { icons: false })
    imagePreviewElement.querySelector<HTMLButtonElement>('section button')?.focus()
    return true
  }
  if (action === 'retry-image') {
    const src = actionNode?.dataset.imageSrc || ''
    const previewImage = actionNode?.closest('section')?.querySelector<HTMLImageElement>('img')
    if (!src || !previewImage) return true
    previewImage.classList.remove('hidden')
    actionNode?.closest('section')?.querySelector('[data-pms-preview-error]')?.classList.add('hidden')
    actionNode?.closest('section')?.querySelector('[data-pms-preview-loading]')?.classList.remove('hidden')
    previewImage.src = `${src}${src.includes('?') ? '&' : '?'}retry=${Date.now()}`
    return true
  }
  if (action === 'close-image') {
    closePmsImagePreview()
    return true
  }
  return false
}

export function closePmsImagePreviewOnEscape(): boolean {
  if (!imagePreview) return false
  closePmsImagePreview()
  return true
}

export function nextPmsClientActionId(prefix: string): string {
  actionSequence += 1
  return `${prefix}-${Date.now()}-${actionSequence}`
}

export function hydratePmsSurface(surface: ParentNode | null | undefined, options: { icons?: boolean } = {}): void {
  if (!surface) return
  ensurePmsImageEscapeBinding()
  surface.querySelectorAll<HTMLImageElement>('[data-pms-common-action="open-image"] img, section:has([data-pms-preview-loading]) > img').forEach(image => {
    if (boundPmsImages.has(image)) return
    boundPmsImages.add(image)
    const parent = image.parentElement!
    const loading = parent.querySelector<HTMLElement>('[data-pms-image-loading], [data-pms-preview-loading]')
    const error = parent.querySelector<HTMLElement>('[data-pms-image-error], [data-pms-preview-error]')
    const settle = () => {
      if (!image.complete) return
      const failed = image.naturalWidth === 0
      loading?.classList.add('hidden')
      loading?.classList.remove('flex')
      image.classList.toggle('hidden', failed)
      error?.classList.toggle('hidden', !failed)
      if (error?.hasAttribute('data-pms-image-error')) error.classList.toggle('flex', failed)
    }
    image.addEventListener('load', settle)
    image.addEventListener('error', settle)
    if (image.complete) settle()
  })
  if (options.icons !== false) {
    void import('../../components/shell.ts')
      .then(({ hydrateIcons }) => hydrateIcons(surface))
      .catch(() => undefined)
  }
}

export function refreshPmsRoot(selector: string, innerHtml: string): boolean {
  if (typeof document === 'undefined') return false
  const root = document.querySelector<HTMLElement>(selector)
  if (!root) return false
  const scrollContainer = root.closest<HTMLElement>('[data-page-content-root]')
  const scrollTop = scrollContainer?.scrollTop ?? 0
  root.innerHTML = innerHtml
  if (scrollContainer) scrollContainer.scrollTop = scrollTop
  hydratePmsSurface(root)
  return true
}

export function renderPmsFeedback(message: string, ok: boolean): string {
  if (!message) return ''
  return `<div class="rounded-md border px-3 py-2 text-sm ${ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-800'}">${escapeHtml(message)}</div>`
}

export function renderPmsOverlayError(message: string): string {
  if (!message) return ''
  return `<div class="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">${escapeHtml(message)}</div>`
}

export function readNumberField(scope: ParentNode, selector: string): number {
  const field = scope.querySelector<HTMLInputElement>(selector)
  return field ? Number(field.value) : Number.NaN
}

export function readTextField(scope: ParentNode, selector: string): string {
  const field = scope.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(selector)
  return field?.value.trim() ?? ''
}

export function pmsFieldAttr(prefix: string, field: string): string {
  return `data-${prefix}-field="${field}"`
}

export function pmsActionAttr(prefix: string, action: string): string {
  return `data-${prefix}-action="${action}" data-skip-page-rerender="true"`
}
