import { escapeHtml } from '../../utils.ts'

let focusReturnTarget: HTMLElement | null = null

function safeImageUrl(value?: string): string {
  const url = value?.trim() || ''
  return /^(?:https?:\/\/|\/|data:image\/)/i.test(url) ? url : ''
}

function getPreviewHost(): HTMLElement {
  let host = document.querySelector<HTMLElement>('[data-pda-image-preview-root]')
  if (host) return host
  host = document.createElement('div')
  host.dataset.pdaImagePreviewRoot = 'true'
  ;(document.querySelector('#app') || document.body).append(host)
  return host
}

export function handlePdaImagePreviewEvent(target: HTMLElement): boolean {
  const closeNode = target.closest<HTMLElement>('[data-pda-image-preview-close]')
  if (closeNode) return closePdaImagePreview()

  const openNode = target.closest<HTMLElement>('[data-pda-image-preview-url]')
  if (!openNode) return false
  const imageUrl = safeImageUrl(openNode.dataset.pdaImagePreviewUrl)
  if (!imageUrl) return false

  const title = openNode.dataset.pdaImagePreviewTitle?.trim() || '款式图片'
  focusReturnTarget = openNode
  const host = getPreviewHost()
  host.innerHTML = `
    <div class="fixed inset-0 z-[180] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}大图预览">
      <button type="button" class="absolute inset-0 bg-slate-950/80" data-pda-image-preview-close aria-label="关闭大图预览"></button>
      <section class="relative z-10 flex max-h-full max-w-4xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <header class="flex items-center justify-between gap-3 border-b px-4 py-3">
          <h2 class="truncate text-sm font-semibold">${escapeHtml(title)}</h2>
          <button type="button" class="rounded border px-3 py-1.5 text-sm" data-pda-image-preview-close>关闭</button>
        </header>
        <div class="flex min-h-40 items-center justify-center bg-slate-100 p-3">
          <img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(title)}高清大图" class="max-h-[calc(100vh-8rem)] max-w-[calc(100vw-2rem)] object-contain" onerror="this.hidden=true;this.nextElementSibling.hidden=false">
          <p hidden class="p-8 text-center text-sm text-red-700">图片加载失败，请检查原图后重试。</p>
        </div>
      </section>
    </div>
  `
  host.querySelector<HTMLButtonElement>('[data-pda-image-preview-close]')?.focus()
  return true
}

export function closePdaImagePreview(): boolean {
  const host = document.querySelector<HTMLElement>('[data-pda-image-preview-root]')
  if (!host?.firstElementChild) return false
  host.remove()
  focusReturnTarget?.focus()
  focusReturnTarget = null
  return true
}
