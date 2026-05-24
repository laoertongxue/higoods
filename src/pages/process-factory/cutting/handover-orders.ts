import {
  buildHandoverAfterRecordResult,
  buildUniversalHandoverProjection,
  getUniversalHandoverOrderById,
  getUniversalHandoverRecordById,
  type HandoverOrder,
  type HandoverQuantitySummaryItem,
  type HandoverRecord,
} from '../../../data/fcs/cutting/handover-orders.ts'
import { escapeHtml } from '../../../utils.ts'
import { renderCompactKpiCard } from './layout.helpers.ts'
import { getCanonicalCuttingMeta, renderCuttingPageHeader } from './meta.ts'

function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value)
}

function orderDetailHref(orderId: string): string {
  return `/fcs/craft/cutting/handover-orders/${encodeURIComponent(orderId)}`
}

function orderRecordsHref(orderId: string): string {
  return `/fcs/craft/cutting/handover-orders/${encodeURIComponent(orderId)}/records`
}

function recordDetailHref(recordId: string): string {
  return `/fcs/craft/cutting/handover-records/${encodeURIComponent(recordId)}`
}

function renderStatusPill(label: string, tone = 'slate'): string {
  const toneClass =
    tone === 'green'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-700'
        : tone === 'rose'
          ? 'border-rose-200 bg-rose-50 text-rose-700'
          : 'border-slate-200 bg-slate-50 text-slate-700'
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${toneClass}">${escapeHtml(label)}</span>`
}

function renderQuantityList(items: HandoverQuantitySummaryItem[], emptyText = '暂无数量'): string {
  if (!items.length) return `<div class="text-xs text-muted-foreground">${escapeHtml(emptyText)}</div>`
  return `
    <div class="grid gap-2 md:grid-cols-2">
      ${items
        .map((item) => `
          <div class="rounded-md border bg-background px-3 py-2 text-xs">
            <div class="font-medium text-foreground">${escapeHtml(`${item.partName} ${item.size}`)}</div>
            <div class="mt-1 text-muted-foreground">${escapeHtml(`${item.productionOrderNo} / ${item.cutOrderNo}`)}</div>
            <div class="mt-1 font-semibold tabular-nums">${escapeHtml(item.summaryText)}</div>
          </div>
        `)
        .join('')}
    </div>
  `
}

function renderRiskTips(items: ReturnType<typeof buildHandoverAfterRecordResult>['riskTips']): string {
  if (!items.length) return '<div class="text-sm text-muted-foreground">暂无风险提示。</div>'
  return `
    <div class="grid gap-2 md:grid-cols-2">
      ${items
        .map((item) => `
          <div class="rounded-md border bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <div class="font-medium">${escapeHtml(item.tipType)}</div>
            <div class="mt-1 text-xs">${escapeHtml(item.tipText)}</div>
          </div>
        `)
        .join('')}
    </div>
  `
}

function renderOrderCard(order: HandoverOrder, records: HandoverRecord[]): string {
  const statusTone = order.status.includes('差异') ? 'rose' : order.status.includes('接收') ? 'green' : order.status.includes('待') ? 'amber' : 'slate'
  const latest = records.find((record) => record.handoverRecordId === order.latestRecordId) || records[records.length - 1]
  return `
    <article class="rounded-lg border bg-card p-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-base font-semibold text-foreground">${escapeHtml(order.handoverOrderNo)}</h2>
            ${renderStatusPill(order.status, statusTone)}
            ${renderStatusPill(order.handoverType)}
          </div>
          <div class="mt-2 text-sm text-muted-foreground">接收对象：${escapeHtml(order.receiverType)} / ${escapeHtml(order.receiverName)}</div>
          <div class="mt-1 text-xs text-muted-foreground">依据：${escapeHtml(order.handoverBasis)}</div>
        </div>
        <div class="flex shrink-0 flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(orderDetailHref(order.handoverOrderId))}">查看交出单</button>
          <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(orderRecordsHref(order.handoverOrderId))}">查看交出记录</button>
        </div>
      </div>
      <dl class="mt-4 grid gap-3 md:grid-cols-4">
        <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">交出记录</dt><dd class="mt-1 font-semibold">${formatNumber(order.totalRecordCount)} 条</dd></div>
        <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">计划裁片</dt><dd class="mt-1 font-semibold">${formatNumber(order.totalPlannedPieceQty)} 片</dd></div>
        <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">已交出</dt><dd class="mt-1 font-semibold">${formatNumber(order.totalHandedOverPieceQty)} 片</dd></div>
        <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">接收回写</dt><dd class="mt-1 font-semibold">${formatNumber(order.totalReceivedPieceQty)} 片</dd></div>
      </dl>
      <div class="mt-4 rounded-md border bg-muted/20 px-3 py-2 text-sm">
        最新交出记录：${
          latest
            ? `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(recordDetailHref(latest.handoverRecordId))}">${escapeHtml(latest.handoverRecordNo)}</button><span class="ml-2 text-muted-foreground">${escapeHtml(latest.receiverWritebackStatus)} / ${escapeHtml(latest.handedOverAt)}</span>`
            : '<span class="text-muted-foreground">暂无记录</span>'
        }
      </div>
    </article>
  `
}

function renderRecordCompactCard(record: HandoverRecord): string {
  const currentQty = record.currentHandedOverSummary.reduce((sum, item) => sum + item.pieceQty, 0)
  const cumulativeQty = record.cumulativeHandedOverSummary.reduce((sum, item) => sum + item.pieceQty, 0)
  const statusTone = record.recordStatus.includes('差异') ? 'rose' : record.recordStatus.includes('接收') ? 'green' : 'amber'
  const afterResult = buildHandoverAfterRecordResult(record)
  return `
    <article class="rounded-lg border bg-card p-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-base font-semibold">${escapeHtml(record.handoverRecordNo)}</h3>
            ${renderStatusPill(record.recordStatus, statusTone)}
            ${renderStatusPill(record.receiverWritebackStatus, record.receiverWritebackStatus.includes('差异') || record.receiverWritebackStatus.includes('异议') ? 'rose' : 'slate')}
          </div>
          <div class="mt-2 text-sm text-muted-foreground">交出单：${escapeHtml(record.handoverOrderNo)} / 接收对象：${escapeHtml(record.receiverName)}</div>
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(recordDetailHref(record.handoverRecordId))}">查看记录详情</button>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-4">
        <div class="rounded-md border bg-background px-3 py-2"><div class="text-xs text-muted-foreground">本次交出</div><div class="mt-1 font-semibold">${formatNumber(currentQty)} 片</div></div>
        <div class="rounded-md border bg-background px-3 py-2"><div class="text-xs text-muted-foreground">累计交出</div><div class="mt-1 font-semibold">${formatNumber(cumulativeQty)} 片</div></div>
        <div class="rounded-md border bg-background px-3 py-2"><div class="text-xs text-muted-foreground">中转袋</div><div class="mt-1 font-semibold">${formatNumber(record.transferBagUses.length)} 个</div></div>
        <div class="rounded-md border bg-background px-3 py-2"><div class="text-xs text-muted-foreground">差异 / 异议</div><div class="mt-1 font-semibold">${formatNumber(record.discrepancyItems.length)} / ${formatNumber(record.objectionItems.length)}</div></div>
      </div>
      <div class="mt-3 rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        ${escapeHtml(afterResult.completenessResult.summaryText)}
        <div class="mt-1 text-xs">下一次提交：${afterResult.canSubmitNextRecord ? '存在有效可交对象时可继续新增交出记录' : '当前没有有效可交对象或记录已关闭'}</div>
      </div>
    </article>
  `
}

function renderOrderDetail(order: HandoverOrder, records: HandoverRecord[], recordListOnly = false): string {
  const meta = getCanonicalCuttingMeta('handover-order-detail')
  const header = renderCuttingPageHeader(meta, {
    actions: `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/cutting/handover-orders">返回交出单</button>`,
  })
  return `
    ${header}
    <main class="space-y-4">
      ${
        recordListOnly
          ? ''
          : `
            <section class="rounded-lg border bg-card p-4">
              <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <h1 class="text-lg font-semibold">交出单详情 ${escapeHtml(order.handoverOrderNo)}</h1>
                    ${renderStatusPill(order.status)}
                    ${renderStatusPill(order.handoverType)}
                  </div>
                  <div class="mt-2 text-sm text-muted-foreground">来源仓：${escapeHtml(order.sourceWarehouseName)} / 接收对象：${escapeHtml(order.receiverType)} ${escapeHtml(order.receiverName)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">关联生产单：${escapeHtml(order.relatedProductionOrderIds.join('、'))}</div>
                </div>
                <div class="text-sm text-muted-foreground">创建：${escapeHtml(order.createdAt)} / ${escapeHtml(order.createdBy)}</div>
              </div>
              <div class="mt-4 grid gap-3 md:grid-cols-4">
                ${renderCompactKpiCard('交出记录', `${order.totalRecordCount} 条`, '一个交出单下可多次交出', 'text-slate-700')}
                ${renderCompactKpiCard('已交出数量', `${formatNumber(order.totalHandedOverPieceQty)} 片`, '按交出记录累计', 'text-blue-600')}
                ${renderCompactKpiCard('已接收数量', `${formatNumber(order.totalReceivedPieceQty)} 片`, '接收方回写结果', 'text-emerald-600')}
                ${renderCompactKpiCard('最新缺口', `${formatNumber(order.shortageAfterLatestRecord)} 片`, '交出后计算结果', order.shortageAfterLatestRecord ? 'text-amber-600' : 'text-slate-700')}
              </div>
            </section>
          `
      }
      <section class="rounded-lg border bg-card p-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-base font-semibold">交出记录</h2>
          <span class="text-xs text-muted-foreground">${formatNumber(records.length)} 条</span>
        </div>
        <div class="grid gap-3">
          ${records.map(renderRecordCompactCard).join('') || '<div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">暂无交出记录。</div>'}
        </div>
      </section>
    </main>
  `
}

function renderRecordDetail(record: HandoverRecord): string {
  const order = getUniversalHandoverOrderById(record.handoverOrderId)
  const afterResult = buildHandoverAfterRecordResult(record)
  const meta = getCanonicalCuttingMeta('handover-record-detail')
  const header = renderCuttingPageHeader(meta, {
    actions: `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(order ? orderDetailHref(order.handoverOrderId) : '/fcs/craft/cutting/handover-orders')}">返回交出单</button>`,
  })
  return `
    ${header}
    <main class="space-y-4">
      <section class="rounded-lg border bg-card p-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-lg font-semibold">交出记录详情 ${escapeHtml(record.handoverRecordNo)}</h1>
              ${renderStatusPill(record.recordStatus)}
              ${renderStatusPill(record.receiverWritebackStatus)}
            </div>
            <div class="mt-2 text-sm text-muted-foreground">交出记录号：${escapeHtml(record.handoverRecordNo)} / 交出单：${escapeHtml(record.handoverOrderNo)} / 接收对象：${escapeHtml(record.receiverType)} ${escapeHtml(record.receiverName)}</div>
            <div class="mt-1 text-xs text-muted-foreground">交出人：${escapeHtml(record.handedOverBy)} / ${escapeHtml(record.handedOverAt)}</div>
          </div>
          <div class="text-sm text-muted-foreground">记录序号：第 ${record.recordSequence} 次交出</div>
        </div>
      </section>

      <section class="grid gap-4 xl:grid-cols-3">
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">之前已交</h2>
          <div class="mt-3">${renderQuantityList(record.previousHandedOverSummary)}</div>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">本次交出</h2>
          <div class="mt-3">${renderQuantityList(record.currentHandedOverSummary)}</div>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">累计交出</h2>
          <div class="mt-3">${renderQuantityList(record.cumulativeHandedOverSummary)}</div>
        </article>
      </section>

      <section class="grid gap-4 xl:grid-cols-2">
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">交出后齐套结果</h2>
          <div class="mt-3 text-sm">
            ${renderStatusPill(afterResult.completenessResult.isComplete ? '交出后已齐套' : '交出后仍有缺口', afterResult.completenessResult.isComplete ? 'green' : 'amber')}
            <p class="mt-3 text-muted-foreground">${escapeHtml(afterResult.completenessResult.summaryText)}</p>
            <p class="mt-2 text-xs text-muted-foreground">齐套仅为交出后计算结果，不作为新增交出记录前置限制。</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">交出后缺口</h2>
          <div class="mt-3 space-y-2">
            ${
              afterResult.shortageItems.length
                ? afterResult.shortageItems
                    .map((item) => `<div class="rounded-md border bg-background px-3 py-2 text-sm">${escapeHtml(`${item.partName} ${item.size} 需求 ${item.requiredQty} ${item.unit} / 累计已交 ${item.cumulativeHandedOverQty} ${item.unit} / 缺 ${item.shortageQty} ${item.unit}`)}<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.shortageReason)}</div></div>`)
                    .join('')
                : '<div class="text-sm text-muted-foreground">暂无缺口。</div>'
            }
          </div>
        </article>
      </section>

      <section class="grid gap-4 xl:grid-cols-2">
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">特殊工艺未回仓提示</h2>
          <div class="mt-3 space-y-2">
            ${
              afterResult.specialCraftPendingItems.length
                ? afterResult.specialCraftPendingItems
                    .map((item) => `<div class="rounded-md border bg-background px-3 py-2 text-sm">${escapeHtml(`${item.partName} ${item.size} 待回仓 ${item.pendingQty} 片 / ${item.specialCraftType}`)}<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.expectedReturnText)}</div></div>`)
                    .join('')
                : '<div class="text-sm text-muted-foreground">暂无特殊工艺未回仓提示。</div>'
            }
          </div>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">风险提示</h2>
          <div class="mt-3">${renderRiskTips(afterResult.riskTips)}</div>
        </article>
      </section>

      <section class="grid gap-4 xl:grid-cols-2">
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">中转袋</h2>
          <div class="mt-3 grid gap-2">
            ${record.transferBagUses
              .map((bag) => `
                <div class="rounded-md border bg-background px-3 py-2 text-sm">
                  <div class="font-medium">${escapeHtml(bag.bagCode)} / ${escapeHtml(bag.useStage)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">裁片数量：${formatNumber(bag.totalPieceQty)} 片 / 菲票：${escapeHtml(bag.containedFeiTicketIds.join('、'))}</div>
                </div>
              `)
              .join('')}
          </div>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">接收回写 / 差异 / 异议</h2>
          <div class="mt-3 space-y-2 text-sm">
            <div class="rounded-md border bg-background px-3 py-2">接收回写：${escapeHtml(record.receiverWritebackStatus)}${record.receiverWritebackAt ? ` / ${escapeHtml(record.receiverWritebackAt)}` : ''}</div>
            <div class="rounded-md border bg-background px-3 py-2">差异数量：${formatNumber(record.discrepancyItems.length)} 条</div>
            <div class="rounded-md border bg-background px-3 py-2">异议数量：${formatNumber(record.objectionItems.length)} 条</div>
          </div>
        </article>
      </section>

      ${
        record.specialCraftItems?.length
          ? `<section class="rounded-lg border bg-card p-4">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 class="text-base font-semibold">特殊工艺交出明细</h2>
                  <p class="mt-1 text-xs text-muted-foreground">本记录复用通用交出记录，工艺明细用于追溯承接工厂和回仓。</p>
                </div>
                ${renderStatusPill(record.handoverType || '特殊工艺交出', 'amber')}
              </div>
              <div class="mt-3 grid gap-3 md:grid-cols-2">
                ${record.specialCraftItems
                  .map((item) => `
                    <div class="rounded-md border bg-background p-3 text-sm">
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <div class="font-semibold">${escapeHtml(item.craftType)} / ${escapeHtml(item.craftCategory)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">承接工厂：${escapeHtml(item.receiverFactoryName)}</div>
                        </div>
                        <div class="text-right text-xs font-semibold tabular-nums">${formatNumber(item.pieceQty)} 片</div>
                      </div>
                      <div class="mt-2 text-xs text-muted-foreground">菲票：${escapeHtml(item.feiTicketId)} / 部位：${escapeHtml(item.partName)} / 尺码：${escapeHtml(item.size)}</div>
                    </div>
                  `)
                  .join('')}
              </div>
            </section>`
          : ''
      }

      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-base font-semibold">菲票明细</h2>
        <div class="mt-3 grid gap-3 md:grid-cols-2">
          ${record.feiTicketItems
            .map((item) => `
              <div class="rounded-md border bg-background p-3 text-sm">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="font-semibold text-blue-700">${escapeHtml(item.feiTicketNo)}</div>
                    <div class="mt-1 text-muted-foreground">${escapeHtml(item.productionOrderNo)} / ${escapeHtml(item.cutOrderNo)}</div>
                  </div>
                  <div class="text-right text-xs text-muted-foreground">${formatNumber(item.pieceQty)} 片</div>
                </div>
                <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(`${item.spuCode} / ${item.color} / ${item.size} / ${item.partName} / 编号范围 ${item.pieceSequenceLabel}`)}</div>
                <div class="mt-1 text-xs text-muted-foreground">中转袋：${escapeHtml(item.targetTransferBagCode)} / 特殊工艺：${escapeHtml(item.specialCraftDisplay)} / 承接工厂：${escapeHtml(item.receiverFactoryDisplay)}</div>
              </div>
            `)
            .join('')}
        </div>
      </section>
    </main>
  `
}

export function renderCraftCuttingHandoverOrdersPage(): string {
  const projection = buildUniversalHandoverProjection()
  const meta = getCanonicalCuttingMeta('handover-orders')
  const recordsByOrderId = projection.recordsByOrderId
  return `
    ${renderCuttingPageHeader(meta)}
    <main class="space-y-4">
      <section class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        ${renderCompactKpiCard('交出单数', projection.summary.orderCount, '交出类型：车缝交出、特殊工艺交出、仓库交出', 'text-slate-700')}
        ${renderCompactKpiCard('交出记录数', projection.summary.recordCount, '一个交出单可多次交出', 'text-slate-700')}
        ${renderCompactKpiCard('接收对象类型', projection.summary.receiverTypeCount, projection.receiverTypes.join('、'), 'text-blue-600')}
        ${renderCompactKpiCard('待回写记录', projection.summary.pendingWritebackCount, '接收方尚未回写', 'text-amber-600')}
        ${renderCompactKpiCard('差异 / 异议', `${formatNumber(projection.summary.discrepancyCount)} / ${formatNumber(projection.summary.objectionCount)}`, '接收差异和异议记录', projection.summary.discrepancyCount || projection.summary.objectionCount ? 'text-rose-600' : 'text-slate-700')}
        ${renderCompactKpiCard('异议', projection.summary.objectionCount, '接收方或裁床发起异议', projection.summary.objectionCount ? 'text-rose-600' : 'text-slate-700')}
      </section>
      <section class="grid gap-4">
        ${projection.orders.map((order) => renderOrderCard(order, recordsByOrderId[order.handoverOrderId] || [])).join('')}
      </section>
    </main>
  `
}

export function renderCraftCuttingHandoverOrderDetailPage(handoverOrderId?: string): string {
  const projection = buildUniversalHandoverProjection()
  const order = (handoverOrderId ? getUniversalHandoverOrderById(decodeURIComponent(handoverOrderId)) : undefined) || projection.orders[0]
  return renderOrderDetail(order, projection.recordsByOrderId[order.handoverOrderId] || [])
}

export function renderCraftCuttingHandoverOrderRecordsPage(handoverOrderId?: string): string {
  const projection = buildUniversalHandoverProjection()
  const order = (handoverOrderId ? getUniversalHandoverOrderById(decodeURIComponent(handoverOrderId)) : undefined) || projection.orders[0]
  return renderOrderDetail(order, projection.recordsByOrderId[order.handoverOrderId] || [], true)
}

export function renderCraftCuttingHandoverRecordDetailPage(handoverRecordId?: string): string {
  const projection = buildUniversalHandoverProjection()
  const record = (handoverRecordId ? getUniversalHandoverRecordById(decodeURIComponent(handoverRecordId)) : undefined) || projection.records[0]
  return renderRecordDetail(record)
}
