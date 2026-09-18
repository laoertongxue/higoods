import { hydrateIcons } from '../shell.ts'
import { renderToast } from './toast.ts'

export function showListFeedback(message: string, variant: 'success' | 'info' | 'warning' | 'danger' = 'success'): void {
  if (typeof document === 'undefined') return
  let host = document.querySelector<HTMLElement>('[data-list-feedback-host]')
  if (!host) {
    host = document.createElement('div')
    host.setAttribute('data-list-feedback-host', 'true')
    host.className = 'fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-2'
    document.body.appendChild(host)
  }
  const wrapper = document.createElement('div')
  wrapper.innerHTML = renderToast({ title: message, variant, duration: 0, dismissible: false })
  const node = wrapper.firstElementChild
  if (!node) return
  host.appendChild(node)
  hydrateIcons(host)
  window.setTimeout(() => {
    node.remove()
    if (!host?.children.length) host.remove()
  }, 4000)
}
