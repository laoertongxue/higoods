// @page-pattern: dashboard

import {
  getPostFinishingFullFlowOutboundOrder,
  getPostFinishingWaitHandoverWarehouseRecord,
  listPostFinishingFullFlowOutboundOrders,
  listPostFinishingWarehouseReceipts,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostFinishingPageHeader, renderPostStatusBadge } from './shared.ts'

function query(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function authorizationText(record: NonNullable<ReturnType<typeof getPostFinishingFullFlowOutboundOrder>>): string {
  return record.warehouseAuthorizedBy
    ? `${record.warehouseAuthorizedBy.authorizerName} / ${record.warehouseAuthorizationId}`
    : '无差异'
}

function image(line: NonNullable<ReturnType<typeof getPostFinishingFullFlowOutboundOrder>>['lines'][number]): string {
  const label = `${line.sku.skuCode} ${line.sku.colorName} ${line.sku.sizeName}`
  return `<button type="button" class="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(line.sku.imageUrl)}" data-image-label="${escapeHtml(label)}"><img src="${escapeHtml(line.sku.imageUrl)}" alt="${escapeHtml(`${line.sku.spuName} ${line.sku.colorName} ${line.sku.sizeName}`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[9px] text-slate-500">图片加载中…</span></button>`
}

function renderDetail(record: NonNullable<ReturnType<typeof getPostFinishingFullFlowOutboundOrder>>): string {
  const receipt = listPostFinishingWarehouseReceipts().find((item) => item.outboundOrderId === record.outboundOrderId)
  const waitHandover = getPostFinishingWaitHandoverWarehouseRecord(record.outboundOrderId)
  const rows = record.lines.map((line) => `<tr>
    <td class="px-3 py-3"><div class="flex items-center gap-3">${image(line)}<div><div class="font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(line.sku.spuCode)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div></div></div></td>
    <td class="px-3 py-3">${line.outboundQty} 件</td>
    <td class="px-3 py-3">${line.receivedQty ?? '—'}${line.receivedQty === undefined ? '' : ' 件'}</td>
    <td class="px-3 py-3 font-mono text-xs">${escapeHtml(line.sku.barcode)}</td>
    <td class="px-3 py-3"><a data-nav="/fcs/craft/post-finishing/print?type=SKU_LABEL&id=${encodeURIComponent(record.recheckOrderId)}&skuId=${encodeURIComponent(line.sku.skuId)}" class="text-blue-700 underline">打印 40×30 SKU 贴标</a></td>
  </tr>`).join('')
  return `<div class="space-y-4">
    <button type="button" data-nav="/fcs/craft/post-finishing/outbound-orders" class="text-sm text-blue-700 underline">← 返回出货单列表</button>
    <section class="rounded-xl border bg-card p-4"><div class="flex flex-wrap items-start justify-between gap-4"><div><h2 class="font-mono text-xl font-semibold">${escapeHtml(record.outboundOrderNo)}</h2><p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.productionOrderNo)} · 根送货单 ${escapeHtml(record.deliveryOrderNo)} · 复检单 ${escapeHtml(record.recheckOrderNo)}</p></div>${renderPostStatusBadge(record.status)}</div><div class="mt-4 grid gap-3 text-sm md:grid-cols-5"><div><span class="text-xs text-muted-foreground">出货数量</span><div>${record.lines.reduce((sum, line) => sum + line.outboundQty, 0)} 件</div></div><div><span class="text-xs text-muted-foreground">待交出仓</span><div>${escapeHtml(waitHandover ? `${waitHandover.status} / 可用 ${waitHandover.lines.reduce((sum, line) => sum + line.availableQty, 0)} 件` : '待复检入仓')}</div></div><div><span class="text-xs text-muted-foreground">实际接收入库人</span><div>${escapeHtml(record.receivedBy?.actorName || '待接收')}</div></div><div><span class="text-xs text-muted-foreground">差异授权人</span><div>${escapeHtml(authorizationText(record))}</div></div><div><span class="text-xs text-muted-foreground">接收时间</span><div>${escapeHtml(record.receivedAt ? new Date(record.receivedAt).toLocaleString('zh-CN') : '—')}</div></div></div><dl class="mt-4 grid gap-2 border-t pt-4 text-xs md:grid-cols-3"><div><dt class="text-muted-foreground">送货单 / 质检任务</dt><dd class="font-mono">${escapeHtml(record.deliveryOrderNo)} / ${escapeHtml(record.qcTaskNo)}</dd></div><div><dt class="text-muted-foreground">后道单</dt><dd class="font-mono">${escapeHtml(record.postTaskNo || '质检后直达复检')}</dd></div><div><dt class="text-muted-foreground">复检单</dt><dd class="font-mono">${escapeHtml(record.recheckOrderNo)}</dd></div></dl></section>
    <section class="rounded-xl border bg-card p-4"><h3 class="font-semibold">逐 SKU 出货与接收</h3><div class="mt-3 overflow-x-auto"><table class="min-w-[920px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">SKU / 产品</th><th class="px-3 py-2">复检合格 / 出货</th><th class="px-3 py-2">仓库实收</th><th class="px-3 py-2">条码</th><th class="px-3 py-2">SKU 贴标</th></tr></thead><tbody class="divide-y">${rows}</tbody></table></div></section>
    ${receipt ? `<section class="rounded-xl border border-emerald-200 bg-emerald-50 p-4"><h3 class="font-semibold text-emerald-900">仓库接收记录</h3><div class="mt-2 text-sm text-emerald-800">${escapeHtml(receipt.receivedBy.actorName)} · ${escapeHtml(new Date(receipt.receivedAt).toLocaleString('zh-CN'))} · ${escapeHtml(receipt.differenceReason || '数量一致')}</div></section>` : ''}
    <div class="flex flex-wrap gap-2"><a data-nav="/fcs/craft/post-finishing/print?type=OUTBOUND&id=${encodeURIComponent(record.outboundOrderId)}" class="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white">打印后道出货单及出货单条码</a><a data-nav="/fcs/craft/post-finishing/wait-handover-warehouse?tab=inventory" class="rounded-md border px-4 py-2 text-sm">查看待交出仓</a><a data-nav="/fcs/pda/post-finishing/outbound-receive?id=${encodeURIComponent(record.outboundOrderNo)}" class="rounded-md border px-4 py-2 text-sm">仓库 PDA 扫码收货</a><a data-nav="/fcs/craft/post-finishing/audit-records?deliveryId=${encodeURIComponent(record.deliveryId)}" class="rounded-md border px-4 py-2 text-sm">查看全流程</a></div>
    <p class="text-xs text-muted-foreground">“后道出货单条码”用于仓库整单收货；“SKU 贴标”用于单件条码纠错，两者不是同一个打印目标。</p>
  </div>`
}

export function renderPostFinishingOutboundOrdersPage(): string {
  const keyword = query().get('keyword')?.toLowerCase() || ''
  const receiver = query().get('receiver')?.toLowerCase() || ''
  const authorizer = query().get('authorizer')?.toLowerCase() || ''
  const records = listPostFinishingFullFlowOutboundOrders().filter((record) => {
    const text = [record.outboundOrderNo, record.recheckOrderNo, record.postTaskNo, record.qcTaskNo, record.deliveryOrderNo, record.productionOrderNo].filter(Boolean).join(' ').toLowerCase()
    return (!keyword || text.includes(keyword))
      && (!receiver || record.receivedBy?.actorName.toLowerCase().includes(receiver))
      && (!authorizer || [record.warehouseAuthorizedBy?.authorizerName, record.warehouseAuthorizationId].filter(Boolean).join(' ').toLowerCase().includes(authorizer))
  })
  const rows = records.map((record) => `<tr><td class="px-3 py-3 font-mono font-semibold">${escapeHtml(record.outboundOrderNo)}</td><td class="px-3 py-3"><div>${escapeHtml(record.recheckOrderNo)}</div><div class="text-xs text-muted-foreground">${escapeHtml(record.productionOrderNo)}</div></td><td class="px-3 py-3">${record.lines.reduce((sum, line) => sum + line.outboundQty, 0)} 件</td><td class="px-3 py-3">${escapeHtml(record.receivedBy?.actorName || '待接收')}</td><td class="px-3 py-3">${escapeHtml(authorizationText(record))}</td><td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td><td class="px-3 py-3"><a data-nav="/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(record.outboundOrderId)}" class="text-blue-700 underline">详情与打印</a></td></tr>`).join('')
  return `<div class="space-y-4 p-4" data-testid="post-finishing-outbound-orders-page">${renderPostFinishingPageHeader('后道出货单', '复检完成自动且唯一生成；FCK 出货单号是仓库现场唯一收货身份')}<form class="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-3"><label class="text-xs text-muted-foreground">出货单 / 复检单 / 后道任务 / 质检任务 / 送货单 / 生产单<input name="keyword" value="${escapeHtml(query().get('keyword') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><label class="text-xs text-muted-foreground">实际接收人<input name="receiver" value="${escapeHtml(query().get('receiver') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><label class="text-xs text-muted-foreground">差异授权人<input name="authorizer" value="${escapeHtml(query().get('authorizer') || '')}" class="mt-1 h-9 w-full rounded-md border px-3 text-sm" /></label><button class="h-9 rounded-md border text-sm md:col-span-3">筛选</button></form><div class="overflow-x-auto rounded-xl border bg-card"><table class="min-w-[1100px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">后道出货单</th><th class="px-3 py-2">复检单 / 生产单</th><th class="px-3 py-2">出货数量</th><th class="px-3 py-2">实际接收人</th><th class="px-3 py-2">差异授权人</th><th class="px-3 py-2">状态</th><th class="px-3 py-2">操作</th></tr></thead><tbody class="divide-y">${rows || '<tr><td colspan="7" class="p-10 text-center text-muted-foreground">暂无后道出货单。</td></tr>'}</tbody></table></div></div>`
}

export function renderPostFinishingOutboundOrderDetailPage(id: string): string {
  const record = getPostFinishingFullFlowOutboundOrder(id)
  return `<div class="space-y-4 p-4">${renderPostFinishingPageHeader('后道出货单详情', '整单条码用于仓库收货；SKU 贴标用于条码纠错')}${record ? renderDetail(record) : '<div class="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">未找到后道出货单。</div>'}</div>`
}

export function handlePostFinishingOutboundOrderEvent(_target: HTMLElement): boolean {
  return false
}
