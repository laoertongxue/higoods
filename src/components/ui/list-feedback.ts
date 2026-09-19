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

/**
 * 按页面自身的状态序列把行推进到下一状态。
 * 找不到可推进的状态字段时返回 null，调用方不得声称状态已变化。
 */
export function advanceRowStatus(row: object, statuses: readonly string[]): { key: string; from: string; to: string } | null {
  const targets: Array<{ label: string; record: Record<string, unknown> }> = [
    { label: '', record: row as Record<string, unknown> },
  ]
  // 扁平化行（例如 { order, line }）把状态挂在上游对象上，需要下探一层。
  for (const [key, value] of Object.entries(row as Record<string, unknown>)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      targets.push({ label: key, record: value as Record<string, unknown> })
    }
  }
  for (const target of targets) {
    for (const [key, value] of Object.entries(target.record)) {
      if (typeof value !== 'string' || !/status$/i.test(key)) continue
      const at = statuses.indexOf(value)
      if (at < 0) continue
      if (at === statuses.length - 1) return null
      const to = statuses[at + 1]
      target.record[key] = to
      return { key: target.label ? `${target.label}.${key}` : key, from: value, to }
    }
  }
  return null
}
