import * as React from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QRCodeSVG } from 'qrcode.react'
export { renderRealQrPlaceholder } from './real-qr-placeholder.ts'

const qrRootMap = new WeakMap<Element, Root>()
const pendingQrNodes = new Set<HTMLElement>()
let qrHydrationScheduled = false

function normalizeSize(size: number | undefined, fallback: number): number {
  if (!Number.isFinite(size)) return fallback
  return Math.max(48, Math.round(size as number))
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

function scheduleFlush(): void {
  if (qrHydrationScheduled) return
  qrHydrationScheduled = true

  const run =
    typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
      ? window.requestAnimationFrame.bind(window)
      : (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 16)

  run(() => {
    const nextNode = pendingQrNodes.values().next().value as HTMLElement | undefined
    if (nextNode) {
      pendingQrNodes.delete(nextNode)
      if (nextNode.isConnected) mountRealQr(nextNode)
      // 多张标签在本帧内批量提交；普通页面仍保持既有逐帧策略。
      if (nextNode.dataset.qrBatch === 'true') {
        const started = performance.now()
        for (const node of pendingQrNodes) {
          if (node.dataset.qrBatch !== 'true' || performance.now() - started > 8) break
          pendingQrNodes.delete(node)
          if (node.isConnected) mountRealQr(node)
        }
      }
    }

    qrHydrationScheduled = false
    if (pendingQrNodes.size > 0) {
      scheduleFlush()
    }
  })
}

export function hydrateRealQRCodes(root: ParentNode | Document = document): void {
  const nodes = Array.from(root.querySelectorAll<HTMLElement>('[data-real-qr]'))
  nodes.forEach((node) => {
    if (node.dataset.realQrHydrated === 'true') return
    pendingQrNodes.add(node)
  })
  if (pendingQrNodes.size > 0) {
    scheduleFlush()
  }
}
