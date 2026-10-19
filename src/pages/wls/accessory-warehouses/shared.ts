import { escapeHtml } from '../../../utils.ts'

export const accessoryButtonClass = 'rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:opacity-50'
export function accessoryButton(label: string, action: string, id = '', primary = false): string {
  return `<button type="button" class="${accessoryButtonClass} ${primary ? 'bg-blue-600 text-white hover:bg-blue-700' : ''}" data-accessory-action="${escapeHtml(action)}" data-id="${escapeHtml(id)}">${escapeHtml(label)}</button>`
}
export function accessoryImage(url: string, label: string): string {
  if (!url) return `<span class="text-sm text-red-600">${escapeHtml(label)}缺少对应图片</span>`
  return `<button type="button" class="shrink-0 rounded border p-0.5" data-accessory-action="image" data-image="${escapeHtml(url)}" data-label="${escapeHtml(label)}" aria-label="查看${escapeHtml(label)}大图"><img class="h-12 w-12 object-contain" src="${escapeHtml(url)}" alt="${escapeHtml(label)}" loading="lazy" onload="this.dataset.loaded='true'" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span hidden class="block max-w-24 p-1 text-xs text-red-600">图片加载失败，点击重试</span></button>`
}
export function accessoryOverlay(title: string, content: string, footer = '', closeAction = 'close'): string {
  return `<div class="fixed inset-0 z-50 flex items-center justify-center p-4" data-aw-overlay><button class="absolute inset-0 bg-black/45" aria-label="关闭窗口" data-accessory-action="${escapeHtml(closeAction)}"></button><section role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}" tabindex="-1" class="relative flex max-h-[90vh] w-[1000px] max-w-[95vw] flex-col overflow-hidden rounded-lg border bg-background shadow-xl"><header class="flex items-center justify-between border-b p-4"><h2 class="text-lg font-semibold">${escapeHtml(title)}</h2>${accessoryButton('关闭', closeAction)}</header><div class="overflow-auto p-4" data-aw-dialog-content>${content}</div>${footer ? `<footer class="flex flex-wrap justify-end gap-2 border-t p-4">${footer}</footer>` : ''}</section></div>`
}
const priorFocus: HTMLElement[] = []
export function focusAccessoryOverlay(): void {
  if (document.activeElement instanceof HTMLElement) priorFocus.push(document.activeElement)
  const dialogs = document.querySelectorAll<HTMLElement>('[data-aw-overlay] [role="dialog"]')
  dialogs[dialogs.length - 1]?.focus()
}
export function restoreAccessoryFocus(): void { priorFocus.pop()?.focus() }
/** 只约束当前窗口，避免键盘焦点进入被遮挡的仓库操作。 */
export function trapAccessoryOverlayFocus(event: KeyboardEvent): void {
  const dialogs = document.querySelectorAll<HTMLElement>('[data-aw-overlay] [role="dialog"]')
  const dialog = dialogs[dialogs.length - 1]
  if (!dialog || event.key !== 'Tab') return
  const nodes = [...dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]')].filter(node => node.getClientRects().length)
  const first = nodes[0], last = nodes.at(-1)
  if (!first) { event.preventDefault(); dialog.focus(); return }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) { event.preventDefault(); first.focus() }
}
