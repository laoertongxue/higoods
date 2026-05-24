import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeSVG } from 'qrcode.react';
import { escapeHtml } from '../utils';
const qrRootMap = new WeakMap();
const pendingQrNodes = new Set();
let qrHydrationScheduled = false;
function normalizeSize(size, fallback) {
    if (!Number.isFinite(size))
        return fallback;
    return Math.max(48, Math.round(size));
}
export function renderRealQrPlaceholder(options) {
    const value = String(options.value || '').trim();
    if (!value)
        return '';
    const size = normalizeSize(options.size, 160);
    const title = (options.title || '二维码').trim();
    const label = (options.label || title).trim();
    const className = options.className?.trim() ? ` class="${escapeHtml(options.className.trim())}"` : '';
    return `<div data-real-qr data-qr-value="${escapeHtml(value)}" data-qr-size="${size}" data-qr-title="${escapeHtml(title)}" data-qr-label="${escapeHtml(label)}"${className}></div>`;
}
function mountRealQr(node) {
    const value = node.dataset.qrValue?.trim();
    if (!value)
        return;
    const size = normalizeSize(Number.parseInt(node.dataset.qrSize || '160', 10), 160);
    const title = node.dataset.qrTitle?.trim() || '二维码';
    const label = node.dataset.qrLabel?.trim() || title;
    let root = qrRootMap.get(node);
    if (!root) {
        root = createRoot(node);
        qrRootMap.set(node, root);
    }
    root.render(React.createElement(QRCodeSVG, {
        value,
        size,
        level: 'M',
        marginSize: 2,
        title,
        role: 'img',
        'aria-label': label,
    }));
    node.dataset.realQrHydrated = 'true';
}
function scheduleFlush() {
    if (qrHydrationScheduled)
        return;
    qrHydrationScheduled = true;
    const run = typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame.bind(window)
        : (callback) => window.setTimeout(() => callback(performance.now()), 16);
    run(() => {
        const nextNode = pendingQrNodes.values().next().value;
        if (nextNode) {
            pendingQrNodes.delete(nextNode);
            mountRealQr(nextNode);
        }
        qrHydrationScheduled = false;
        if (pendingQrNodes.size > 0) {
            scheduleFlush();
        }
    });
}
export function hydrateRealQRCodes(root = document) {
    const nodes = Array.from(root.querySelectorAll('[data-real-qr]'));
    nodes.forEach((node) => {
        if (node.dataset.realQrHydrated === 'true')
            return;
        pendingQrNodes.add(node);
    });
    if (pendingQrNodes.size > 0) {
        scheduleFlush();
    }
}
