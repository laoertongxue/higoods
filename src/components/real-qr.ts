import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QRCodeSVG } from 'qrcode.react'
import { escapeHtml } from '../utils'

interface RealQrPlaceholderOptions {
  value: string
  size?: number
  title?: string
  label?: string
  className?: string
}

const qrRootMap = new WeakMap<Element, Root>()

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

  return `<div data-real-qr data-qr-value="${escapeHtml(value)}" data-qr-size="${size}" data-qr-title="${escapeHtml(title)}" data-qr-label="${escapeHtml(label)}"${className}></div>`
}

function mountRealQr(node: HTMLElement): void {
  const value = node.dataset.qrValue?.trim()
  if (!value) return

  const size = normalizeSize(Number.parseInt(node.dataset.qrSize || '160', 10), 160)
  const title = node.dataset.qrTitle?.trim() || '二维码'
  const label = node.dataset.qrLabel?.trim() || title

  let root = qrRootMap.get(node)
  if (!root) {
    root = createRoot(node)
    qrRootMap.set(node, root)
  }

  root.render(
    React.createElement(QRCodeSVG, {
      value,
      size,
      level: 'M',
      marginSize: 2,
      title,
      role: 'img',
      'aria-label': label,
    }),
  )

  node.dataset.realQrHydrated = 'true'
}

export function hydrateRealQRCodes(root: ParentNode | Document = document): void {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-real-qr]'))
  nodes.forEach((node) => mountRealQr(node))
}
