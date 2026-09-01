// @page-pattern: dashboard

import {
  POST_FINISHING_ACCEPTANCE_ACTORS,
  getPostFinishingFullFlowRecheckOrder,
  getPostFinishingWaitHandoverWarehouseRecord,
  listPostFinishingFullFlowRecheckOrders,
  releasePostFinishingRecheckOrder,
} from '../../../data/fcs/post-finishing-full-flow.ts'
import { appStore } from '../../../state/store.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderPostFinishingPageHeader, renderPostStatusBadge } from './shared.ts'

type RecheckRecord = NonNullable<ReturnType<typeof getPostFinishingFullFlowRecheckOrder>>

let message = ''

function refresh(): void {
  const current = query()
  current.set('refresh', String(Date.now()))
  appStore.navigate(`/fcs/craft/post-finishing/recheck-orders?${current.toString()}`)
}

function query(): URLSearchParams {
  return typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
}

function image(line: RecheckRecord['lines'][number]): string {
  const label = `${line.sku.skuCode} ${line.sku.colorName} ${line.sku.sizeName}`
  return `<button type="button" class="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-slate-50" data-post-finishing-action="full-flow-zoom-image" data-image-url="${escapeHtml(line.sku.imageUrl)}" data-image-label="${escapeHtml(label)}"><img src="${escapeHtml(line.sku.imageUrl)}" alt="${escapeHtml(`${line.sku.spuName} ${line.sku.colorName} ${line.sku.sizeName}`)}" class="h-full w-full object-cover" onload="this.nextElementSibling.hidden=true" onerror="this.hidden=true;this.nextElementSibling.textContent='图片加载失败';this.nextElementSibling.hidden=false"/><span class="px-1 text-center text-[9px] text-slate-500">图片加载中…</span></button>`
}

function renderDetail(record: RecheckRecord): string {
  const waitHandover = record.outboundOrderNo ? getPostFinishingWaitHandoverWarehouseRecord(record.outboundOrderNo) : undefined
  const rows = record.lines.map((line) => `<tr>
    <td class="px-3 py-3"><div class="flex items-center gap-3">${image(line)}<div><div class="font-semibold">${escapeHtml(line.sku.skuCode)}</div><div class="text-xs text-muted-foreground">${escapeHtml(line.sku.spuCode)} · ${escapeHtml(line.sku.colorName)} / ${escapeHtml(line.sku.sizeName)}</div></div></div></td>
    <td class="px-3 py-3">${line.expectedQty} 件</td>
    <td class="px-3 py-3">${line.passedQty ?? '—'}</td>
    <td class="px-3 py-3">${line.defectQty ?? '—'}</td>
    <td class="px-3 py-3">${renderPostStatusBadge(line.barcodeStatus)}</td>
    <td class="px-3 py-3 text-xs">${line.barcodeEvents.map((event) => `${escapeHtml(event.action)} · ${escapeHtml(event.operator.actorName)} · ${escapeHtml(new Date(event.operatedAt).toLocaleString('zh-CN'))}${event.scannedBarcode ? ` · 实扫 ${escapeHtml(event.scannedBarcode)}` : ''}`).join('<br/>') || '尚未扫描'}</td>
  </tr>`).join('')
  const authorizationText = record.recheckAuthorizedBy
    ? `${record.recheckAuthorizedBy.authorizerName} / ${record.recheckAuthorizationId}`
    : '无差异'
  return `<div class="space-y-4">
    <button type="button" data-nav="/fcs/craft/post-finishing/recheck-orders" class="text-sm text-blue-700 underline">← 返回复检单列表</button>
    <section class="rounded-xl border bg-card p-4"><div class="flex items-start justify-between gap-4"><div><h2 class="font-mono text-lg font-semibold">${escapeHtml(record.recheckOrderNo)}</h2><p class="mt-1 text-sm text-muted-foreground">${escapeHtml(record.productionOrderNo)} · 根送货单 ${escapeHtml(record.deliveryOrderNo)} · ${escapeHtml(record.postTaskNo || '质检后直接复检')}</p></div>${renderPostStatusBadge(record.status)}</div><div class="mt-3 grid gap-3 text-sm md:grid-cols-5"><div><span class="text-xs text-muted-foreground">复检员</span><div>${escapeHtml(record.claimedBy?.actorName || '未领取')}</div></div><div><span class="text-xs text-muted-foreground">领取时间</span><div>${escapeHtml(record.claimedAt ? new Date(record.claimedAt).toLocaleString('zh-CN') : '—')}</div></div><div><span class="text-xs text-muted-foreground">数量授权人</span><div>${escapeHtml(authorizationText)}</div></div><div><span class="text-xs text-muted-foreground">后道出货单</span><div>${escapeHtml(record.outboundOrderNo || '待生成')}</div></div><div><span class="text-xs text-muted-foreground">待交出仓</span><div>${escapeHtml(waitHandover ? `${waitHandover.status} / ${waitHandover.lines.reduce((sum, line) => sum + line.availableQty, 0)} 件` : '复检完成后入仓')}</div></div></div></section>
    <section class="rounded-xl border bg-card p-4"><h3 class="font-semibold">SKU 数量与条码核对</h3><div class="mt-3 overflow-x-auto"><table class="min-w-[980px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">SKU / 产品</th><th class="px-3 py-2">交接数量</th><th class="px-3 py-2">复检合格</th><th class="px-3 py-2">复检瑕疵</th><th class="px-3 py-2">条码状态</th><th class="px-3 py-2">条码过程 / 操作人 / 时间</th></tr></thead><tbody class="divide-y">${rows}</tbody></table></div></section>
    <div class="flex flex-wrap gap-2"><a data-nav="/fcs/pda/post-finishing/recheck?id=${encodeURIComponent(record.recheckOrderNo)}" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">打开 PDA 复检</a>${record.claimedBy && record.status !== '复检完成' ? `<button type="button" class="rounded-md border border-amber-300 px-4 py-2 text-sm text-amber-800" data-post-finishing-action="full-flow-supervisor-release-recheck" data-recheck-id="${escapeHtml(record.recheckOrderId)}">主管释放错误领取</button>` : ''}${record.outboundOrderNo ? `<a data-nav="/fcs/craft/post-finishing/wait-handover-warehouse?tab=inventory" class="rounded-md border px-4 py-2 text-sm">查看待交出仓</a><a data-nav="/fcs/craft/post-finishing/outbound-orders/${encodeURIComponent(record.outboundOrderId || '')}" class="rounded-md border px-4 py-2 text-sm">查看唯一出货单</a>` : ''}<a data-nav="/fcs/craft/post-finishing/audit-records?deliveryId=${encodeURIComponent(record.deliveryId)}" class="rounded-md border px-4 py-2 text-sm">查看全流程</a></div>
  </div>`
}

export function renderPostFinishingRecheckOrderDetailPage(recheckOrderId: string): string {
  const record = getPostFinishingFullFlowRecheckOrder(recheckOrderId)
  return `<div class="space-y-4 p-4">${renderPostFinishingPageHeader('复检单详情', 'Web 只读追溯；数量与 SKU 条码在 PDA 完成')}${message ? `<div role="status" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">${escapeHtml(message)}</div>` : ''}${record ? renderDetail(record) : '<div class="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">未找到复检单。</div>'}</div>`
}

export function renderPostFinishingRecheckOrdersPage(): string {
  const selected = query().get('id')
  if (selected) return renderPostFinishingRecheckOrderDetailPage(selected)
  const keyword = query().get('keyword')?.toLowerCase() || ''
  const records = listPostFinishingFullFlowRecheckOrders().filter((record) => !keyword || [record.recheckOrderNo, record.productionOrderNo, record.postTaskNo, record.qcTaskNo, record.outboundOrderNo].filter(Boolean).join(' ').toLowerCase().includes(keyword))
  const rows = records.map((record) => `<tr><td class="px-3 py-3 font-mono font-semibold">${escapeHtml(record.recheckOrderNo)}</td><td class="px-3 py-3"><div>${escapeHtml(record.productionOrderNo)}</div><div class="text-xs text-muted-foreground">${escapeHtml(record.postTaskNo || record.qcTaskNo)}</div></td><td class="px-3 py-3">${record.lines.reduce((sum, line) => sum + line.expectedQty, 0)} 件</td><td class="px-3 py-3">${record.lines.filter((line) => line.barcodeStatus === '正确').length} / ${record.lines.length} SKU 正确</td><td class="px-3 py-3">${escapeHtml(record.claimedBy?.actorName || '未领取')}</td><td class="px-3 py-3">${renderPostStatusBadge(record.status)}</td><td class="px-3 py-3 font-mono text-xs">${escapeHtml(record.outboundOrderNo || '待生成')}</td><td class="px-3 py-3"><div class="flex flex-wrap gap-2"><a data-nav="/fcs/craft/post-finishing/recheck-orders?id=${encodeURIComponent(record.recheckOrderId)}" class="text-blue-700 underline">查看</a>${record.claimedBy && record.status !== '复检完成' ? `<button type="button" class="text-amber-700 underline" data-post-finishing-action="full-flow-supervisor-release-recheck" data-recheck-id="${escapeHtml(record.recheckOrderId)}">主管释放</button>` : ''}</div></td></tr>`).join('')
  return `<div class="space-y-4 p-4" data-testid="post-finishing-recheck-orders-page">${renderPostFinishingPageHeader('复检单', '质检直达或后道完成自动生成；PDA 领取、点数和条码核对')}${message ? `<div role="status" class="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">${escapeHtml(message)}</div>` : ''}<form class="flex gap-2 rounded-xl border bg-card p-4"><input name="keyword" value="${escapeHtml(query().get('keyword') || '')}" class="h-9 min-w-0 flex-1 rounded-md border px-3 text-sm" placeholder="复检单 / 后道任务 / 质检任务 / 生产单"/><button class="rounded-md border px-4 text-sm">查询</button><a data-nav="/fcs/pda/post-finishing/recheck" class="rounded-md bg-blue-600 px-4 py-2 text-sm text-white">打开 PDA 复检</a></form><div class="overflow-x-auto rounded-xl border bg-card"><table class="min-w-[1050px] w-full text-left text-sm"><thead class="bg-slate-50 text-xs text-muted-foreground"><tr><th class="px-3 py-2">复检单</th><th class="px-3 py-2">来源</th><th class="px-3 py-2">交接数量</th><th class="px-3 py-2">条码进度</th><th class="px-3 py-2">复检员</th><th class="px-3 py-2">状态</th><th class="px-3 py-2">唯一出货单</th><th class="px-3 py-2">操作</th></tr></thead><tbody class="divide-y">${rows || '<tr><td colspan="8" class="p-10 text-center text-muted-foreground">暂无复检单。</td></tr>'}</tbody></table></div></div>`
}

export function handlePostFinishingRecheckOrdersEvent(target: HTMLElement): boolean {
  const actionNode = target.closest<HTMLElement>('[data-post-finishing-action="full-flow-supervisor-release-recheck"]')
  if (!actionNode) return false
  if (!window.confirm('确认由主管释放该复检单？释放后将回到待复检，其他复检员可重新领取。')) return true
  try {
    const record = releasePostFinishingRecheckOrder({
      recheckOrderId: actionNode.dataset.recheckId || '',
      actor: POST_FINISHING_ACCEPTANCE_ACTORS.postSupervisor,
      reason: '主管释放错误领取',
      supervisor: true,
    })
    message = `${record.recheckOrderNo} 已由主管释放并回到待复检。`
  } catch (error) {
    message = error instanceof Error ? error.message : '主管释放失败。'
  }
  refresh()
  return true
}
