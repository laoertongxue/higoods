import { escapeHtml } from '../utils.ts'

interface RealQrPlaceholderOptions {
  value: string
  size?: number
  title?: string
  label?: string
  className?: string
  batch?: boolean
}

function normalizeSize(size: number | undefined, fallback: number): number {
  if (!Number.isFinite(size)) return fallback
  return Math.max(48, Math.round(size as number))
}

export function renderRealQrPlaceholder(options: RealQrPlaceholderOptions): string {
  const value = String(options.value || '').trim()
  if (!value) return ''

  const size = normalizeSize(options.size, 160)
  const title = (options.title || '二维码').trim()
  const label = (options.label || title).trim()
  const className = options.className?.trim() ? ` class="${escapeHtml(options.className.trim())}"` : ''

  return `<div data-real-qr${options.batch ? ' data-qr-batch="true"' : ''} data-qr-value="${escapeHtml(value)}" data-qr-size="${size}" data-qr-title="${escapeHtml(title)}" data-qr-label="${escapeHtml(label)}"${className}></div>`
}
