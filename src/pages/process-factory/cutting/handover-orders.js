import {
  buildHandoverAfterRecordResult,
  buildUniversalHandoverProjection,
  getUniversalHandoverOrderById,
  getUniversalHandoverRecordById
} from "../../../data/fcs/cutting/handover-orders.ts";
import { escapeHtml } from "../../../utils.ts";
import { renderCompactKpiCard } from "./layout.helpers.ts";
import { getCanonicalCuttingMeta, renderCuttingPageHeader } from "./meta.ts";
function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(value);
}
function orderDetailHref(orderId) {
  return `/fcs/craft/cutting/handover-orders/${encodeURIComponent(orderId)}`;
}
function orderRecordsHref(orderId) {
  return `/fcs/craft/cutting/handover-orders/${encodeURIComponent(orderId)}/records`;
}
function recordDetailHref(recordId) {
  return `/fcs/craft/cutting/handover-records/${encodeURIComponent(recordId)}`;
}
function renderStatusPill(label, tone = "slate") {
  const toneClass = tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700" : tone === "rose" ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-700";
  return `<span class="inline-flex rounded-full border px-2 py-0.5 text-xs ${toneClass}">${escapeHtml(label)}</span>`;
}
function renderQuantityList(items, emptyText = "\u6682\u65E0\u6570\u91CF") {
  if (!items.length) return `<div class="text-xs text-muted-foreground">${escapeHtml(emptyText)}</div>`;
  return `
    <div class="grid gap-2 md:grid-cols-2">
      ${items.map((item) => `
          <div class="rounded-md border bg-background px-3 py-2 text-xs">
            <div class="font-medium text-foreground">${escapeHtml(`${item.partName} ${item.size}`)}</div>
            <div class="mt-1 text-muted-foreground">${escapeHtml(`${item.productionOrderNo} / ${item.cutOrderNo}`)}</div>
            <div class="mt-1 font-semibold tabular-nums">${escapeHtml(item.summaryText)}</div>
          </div>
        `).join("")}
    </div>
  `;
}
function renderRiskTips(items) {
  if (!items.length) return '<div class="text-sm text-muted-foreground">\u6682\u65E0\u98CE\u9669\u63D0\u793A\u3002</div>';
  return `
    <div class="grid gap-2 md:grid-cols-2">
      ${items.map((item) => `
          <div class="rounded-md border bg-amber-50 px-3 py-2 text-sm text-amber-800">
            <div class="font-medium">${escapeHtml(item.tipType)}</div>
            <div class="mt-1 text-xs">${escapeHtml(item.tipText)}</div>
          </div>
        `).join("")}
    </div>
  `;
}
function renderOrderCard(order, records) {
  const statusTone = order.status.includes("\u5DEE\u5F02") ? "rose" : order.status.includes("\u63A5\u6536") ? "green" : order.status.includes("\u5F85") ? "amber" : "slate";
  const latest = records.find((record) => record.handoverRecordId === order.latestRecordId) || records[records.length - 1];
  return `
    <article class="rounded-lg border bg-card p-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-base font-semibold text-foreground">${escapeHtml(order.handoverOrderNo)}</h2>
            ${renderStatusPill(order.status, statusTone)}
            ${renderStatusPill(order.handoverType)}
          </div>
          <div class="mt-2 text-sm text-muted-foreground">\u63A5\u6536\u5BF9\u8C61\uFF1A${escapeHtml(order.receiverType)} / ${escapeHtml(order.receiverName)}</div>
          <div class="mt-1 text-xs text-muted-foreground">\u4F9D\u636E\uFF1A${escapeHtml(order.handoverBasis)}</div>
        </div>
        <div class="flex shrink-0 flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(orderDetailHref(order.handoverOrderId))}">\u67E5\u770B\u4EA4\u51FA\u5355</button>
          <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(orderRecordsHref(order.handoverOrderId))}">\u67E5\u770B\u4EA4\u51FA\u8BB0\u5F55</button>
        </div>
      </div>
      <dl class="mt-4 grid gap-3 md:grid-cols-4">
        <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">\u4EA4\u51FA\u8BB0\u5F55</dt><dd class="mt-1 font-semibold">${formatNumber(order.totalRecordCount)} \u6761</dd></div>
        <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">\u8BA1\u5212\u88C1\u7247</dt><dd class="mt-1 font-semibold">${formatNumber(order.totalPlannedPieceQty)} \u7247</dd></div>
        <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">\u5DF2\u4EA4\u51FA</dt><dd class="mt-1 font-semibold">${formatNumber(order.totalHandedOverPieceQty)} \u7247</dd></div>
        <div class="rounded-md border bg-background px-3 py-2"><dt class="text-xs text-muted-foreground">\u63A5\u6536\u56DE\u5199</dt><dd class="mt-1 font-semibold">${formatNumber(order.totalReceivedPieceQty)} \u7247</dd></div>
      </dl>
      <div class="mt-4 rounded-md border bg-muted/20 px-3 py-2 text-sm">
        \u6700\u65B0\u4EA4\u51FA\u8BB0\u5F55\uFF1A${latest ? `<button type="button" class="font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(recordDetailHref(latest.handoverRecordId))}">${escapeHtml(latest.handoverRecordNo)}</button><span class="ml-2 text-muted-foreground">${escapeHtml(latest.receiverWritebackStatus)} / ${escapeHtml(latest.handedOverAt)}</span>` : '<span class="text-muted-foreground">\u6682\u65E0\u8BB0\u5F55</span>'}
      </div>
    </article>
  `;
}
function renderRecordCompactCard(record) {
  const currentQty = record.currentHandedOverSummary.reduce((sum, item) => sum + item.pieceQty, 0);
  const cumulativeQty = record.cumulativeHandedOverSummary.reduce((sum, item) => sum + item.pieceQty, 0);
  const statusTone = record.recordStatus.includes("\u5DEE\u5F02") ? "rose" : record.recordStatus.includes("\u63A5\u6536") ? "green" : "amber";
  const afterResult = buildHandoverAfterRecordResult(record);
  return `
    <article class="rounded-lg border bg-card p-4">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div class="flex flex-wrap items-center gap-2">
            <h3 class="text-base font-semibold">${escapeHtml(record.handoverRecordNo)}</h3>
            ${renderStatusPill(record.recordStatus, statusTone)}
            ${renderStatusPill(record.receiverWritebackStatus, record.receiverWritebackStatus.includes("\u5DEE\u5F02") || record.receiverWritebackStatus.includes("\u5F02\u8BAE") ? "rose" : "slate")}
          </div>
          <div class="mt-2 text-sm text-muted-foreground">\u4EA4\u51FA\u5355\uFF1A${escapeHtml(record.handoverOrderNo)} / \u63A5\u6536\u5BF9\u8C61\uFF1A${escapeHtml(record.receiverName)}</div>
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(recordDetailHref(record.handoverRecordId))}">\u67E5\u770B\u8BB0\u5F55\u8BE6\u60C5</button>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-4">
        <div class="rounded-md border bg-background px-3 py-2"><div class="text-xs text-muted-foreground">\u672C\u6B21\u4EA4\u51FA</div><div class="mt-1 font-semibold">${formatNumber(currentQty)} \u7247</div></div>
        <div class="rounded-md border bg-background px-3 py-2"><div class="text-xs text-muted-foreground">\u7D2F\u8BA1\u4EA4\u51FA</div><div class="mt-1 font-semibold">${formatNumber(cumulativeQty)} \u7247</div></div>
        <div class="rounded-md border bg-background px-3 py-2"><div class="text-xs text-muted-foreground">\u4E2D\u8F6C\u888B</div><div class="mt-1 font-semibold">${formatNumber(record.transferBagUses.length)} \u4E2A</div></div>
        <div class="rounded-md border bg-background px-3 py-2"><div class="text-xs text-muted-foreground">\u5DEE\u5F02 / \u5F02\u8BAE</div><div class="mt-1 font-semibold">${formatNumber(record.discrepancyItems.length)} / ${formatNumber(record.objectionItems.length)}</div></div>
      </div>
      <div class="mt-3 rounded-md border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
        ${escapeHtml(afterResult.completenessResult.summaryText)}
        <div class="mt-1 text-xs">\u4E0B\u4E00\u6B21\u63D0\u4EA4\uFF1A${afterResult.canSubmitNextRecord ? "\u5B58\u5728\u6709\u6548\u53EF\u4EA4\u5BF9\u8C61\u65F6\u53EF\u7EE7\u7EED\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55" : "\u5F53\u524D\u6CA1\u6709\u6709\u6548\u53EF\u4EA4\u5BF9\u8C61\u6216\u8BB0\u5F55\u5DF2\u5173\u95ED"}</div>
      </div>
    </article>
  `;
}
function renderOrderDetail(order, records, recordListOnly = false) {
  const meta = getCanonicalCuttingMeta("handover-order-detail");
  const header = renderCuttingPageHeader(meta, {
    actions: `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="/fcs/craft/cutting/handover-orders">\u8FD4\u56DE\u4EA4\u51FA\u5355</button>`
  });
  return `
    ${header}
    <main class="space-y-4">
      ${recordListOnly ? "" : `
            <section class="rounded-lg border bg-card p-4">
              <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <h1 class="text-lg font-semibold">\u4EA4\u51FA\u5355\u8BE6\u60C5 ${escapeHtml(order.handoverOrderNo)}</h1>
                    ${renderStatusPill(order.status)}
                    ${renderStatusPill(order.handoverType)}
                  </div>
                  <div class="mt-2 text-sm text-muted-foreground">\u6765\u6E90\u4ED3\uFF1A${escapeHtml(order.sourceWarehouseName)} / \u63A5\u6536\u5BF9\u8C61\uFF1A${escapeHtml(order.receiverType)} ${escapeHtml(order.receiverName)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">\u5173\u8054\u751F\u4EA7\u5355\uFF1A${escapeHtml(order.relatedProductionOrderIds.join("\u3001"))}</div>
                </div>
                <div class="text-sm text-muted-foreground">\u521B\u5EFA\uFF1A${escapeHtml(order.createdAt)} / ${escapeHtml(order.createdBy)}</div>
              </div>
              <div class="mt-4 grid gap-3 md:grid-cols-4">
                ${renderCompactKpiCard("\u4EA4\u51FA\u8BB0\u5F55", `${order.totalRecordCount} \u6761`, "\u4E00\u4E2A\u4EA4\u51FA\u5355\u4E0B\u53EF\u591A\u6B21\u4EA4\u51FA", "text-slate-700")}
                ${renderCompactKpiCard("\u5DF2\u4EA4\u51FA\u6570\u91CF", `${formatNumber(order.totalHandedOverPieceQty)} \u7247`, "\u6309\u4EA4\u51FA\u8BB0\u5F55\u7D2F\u8BA1", "text-blue-600")}
                ${renderCompactKpiCard("\u5DF2\u63A5\u6536\u6570\u91CF", `${formatNumber(order.totalReceivedPieceQty)} \u7247`, "\u63A5\u6536\u65B9\u56DE\u5199\u7ED3\u679C", "text-emerald-600")}
                ${renderCompactKpiCard("\u6700\u65B0\u7F3A\u53E3", `${formatNumber(order.shortageAfterLatestRecord)} \u7247`, "\u4EA4\u51FA\u540E\u8BA1\u7B97\u7ED3\u679C", order.shortageAfterLatestRecord ? "text-amber-600" : "text-slate-700")}
              </div>
            </section>
          `}
      <section class="rounded-lg border bg-card p-4">
        <div class="mb-3 flex items-center justify-between">
          <h2 class="text-base font-semibold">\u4EA4\u51FA\u8BB0\u5F55</h2>
          <span class="text-xs text-muted-foreground">${formatNumber(records.length)} \u6761</span>
        </div>
        <div class="grid gap-3">
          ${records.map(renderRecordCompactCard).join("") || '<div class="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">\u6682\u65E0\u4EA4\u51FA\u8BB0\u5F55\u3002</div>'}
        </div>
      </section>
    </main>
  `;
}
function renderRecordDetail(record) {
  const order = getUniversalHandoverOrderById(record.handoverOrderId);
  const afterResult = buildHandoverAfterRecordResult(record);
  const meta = getCanonicalCuttingMeta("handover-record-detail");
  const header = renderCuttingPageHeader(meta, {
    actions: `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(order ? orderDetailHref(order.handoverOrderId) : "/fcs/craft/cutting/handover-orders")}">\u8FD4\u56DE\u4EA4\u51FA\u5355</button>`
  });
  return `
    ${header}
    <main class="space-y-4">
      <section class="rounded-lg border bg-card p-4">
        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-lg font-semibold">\u4EA4\u51FA\u8BB0\u5F55\u8BE6\u60C5 ${escapeHtml(record.handoverRecordNo)}</h1>
              ${renderStatusPill(record.recordStatus)}
              ${renderStatusPill(record.receiverWritebackStatus)}
            </div>
            <div class="mt-2 text-sm text-muted-foreground">\u4EA4\u51FA\u8BB0\u5F55\u53F7\uFF1A${escapeHtml(record.handoverRecordNo)} / \u4EA4\u51FA\u5355\uFF1A${escapeHtml(record.handoverOrderNo)} / \u63A5\u6536\u5BF9\u8C61\uFF1A${escapeHtml(record.receiverType)} ${escapeHtml(record.receiverName)}</div>
            <div class="mt-1 text-xs text-muted-foreground">\u4EA4\u51FA\u4EBA\uFF1A${escapeHtml(record.handedOverBy)} / ${escapeHtml(record.handedOverAt)}</div>
          </div>
          <div class="text-sm text-muted-foreground">\u8BB0\u5F55\u5E8F\u53F7\uFF1A\u7B2C ${record.recordSequence} \u6B21\u4EA4\u51FA</div>
        </div>
      </section>

      <section class="grid gap-4 xl:grid-cols-3">
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">\u4E4B\u524D\u5DF2\u4EA4</h2>
          <div class="mt-3">${renderQuantityList(record.previousHandedOverSummary)}</div>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">\u672C\u6B21\u4EA4\u51FA</h2>
          <div class="mt-3">${renderQuantityList(record.currentHandedOverSummary)}</div>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">\u7D2F\u8BA1\u4EA4\u51FA</h2>
          <div class="mt-3">${renderQuantityList(record.cumulativeHandedOverSummary)}</div>
        </article>
      </section>

      <section class="grid gap-4 xl:grid-cols-2">
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">\u4EA4\u51FA\u540E\u9F50\u5957\u7ED3\u679C</h2>
          <div class="mt-3 text-sm">
            ${renderStatusPill(afterResult.completenessResult.isComplete ? "\u4EA4\u51FA\u540E\u5DF2\u9F50\u5957" : "\u4EA4\u51FA\u540E\u4ECD\u6709\u7F3A\u53E3", afterResult.completenessResult.isComplete ? "green" : "amber")}
            <p class="mt-3 text-muted-foreground">${escapeHtml(afterResult.completenessResult.summaryText)}</p>
            <p class="mt-2 text-xs text-muted-foreground">\u9F50\u5957\u4EC5\u4E3A\u4EA4\u51FA\u540E\u8BA1\u7B97\u7ED3\u679C\uFF0C\u4E0D\u4F5C\u4E3A\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55\u524D\u7F6E\u9650\u5236\u3002</p>
          </div>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">\u4EA4\u51FA\u540E\u7F3A\u53E3</h2>
          <div class="mt-3 space-y-2">
            ${afterResult.shortageItems.length ? afterResult.shortageItems.map((item) => `<div class="rounded-md border bg-background px-3 py-2 text-sm">${escapeHtml(`${item.partName} ${item.size} \u9700\u6C42 ${item.requiredQty} ${item.unit} / \u7D2F\u8BA1\u5DF2\u4EA4 ${item.cumulativeHandedOverQty} ${item.unit} / \u7F3A ${item.shortageQty} ${item.unit}`)}<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.shortageReason)}</div></div>`).join("") : '<div class="text-sm text-muted-foreground">\u6682\u65E0\u7F3A\u53E3\u3002</div>'}
          </div>
        </article>
      </section>

      <section class="grid gap-4 xl:grid-cols-2">
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3\u63D0\u793A</h2>
          <div class="mt-3 space-y-2">
            ${afterResult.specialCraftPendingItems.length ? afterResult.specialCraftPendingItems.map((item) => `<div class="rounded-md border bg-background px-3 py-2 text-sm">${escapeHtml(`${item.partName} ${item.size} \u5F85\u56DE\u4ED3 ${item.pendingQty} \u7247 / ${item.specialCraftType}`)}<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.expectedReturnText)}</div></div>`).join("") : '<div class="text-sm text-muted-foreground">\u6682\u65E0\u7279\u6B8A\u5DE5\u827A\u672A\u56DE\u4ED3\u63D0\u793A\u3002</div>'}
          </div>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">\u98CE\u9669\u63D0\u793A</h2>
          <div class="mt-3">${renderRiskTips(afterResult.riskTips)}</div>
        </article>
      </section>

      <section class="grid gap-4 xl:grid-cols-2">
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">\u4E2D\u8F6C\u888B</h2>
          <div class="mt-3 grid gap-2">
            ${record.transferBagUses.map((bag) => `
                <div class="rounded-md border bg-background px-3 py-2 text-sm">
                  <div class="font-medium">${escapeHtml(bag.bagCode)} / ${escapeHtml(bag.useStage)}</div>
                  <div class="mt-1 text-xs text-muted-foreground">\u88C1\u7247\u6570\u91CF\uFF1A${formatNumber(bag.totalPieceQty)} \u7247 / \u83F2\u7968\uFF1A${escapeHtml(bag.containedFeiTicketIds.join("\u3001"))}</div>
                </div>
              `).join("")}
          </div>
        </article>
        <article class="rounded-lg border bg-card p-4">
          <h2 class="text-base font-semibold">\u63A5\u6536\u56DE\u5199 / \u5DEE\u5F02 / \u5F02\u8BAE</h2>
          <div class="mt-3 space-y-2 text-sm">
            <div class="rounded-md border bg-background px-3 py-2">\u63A5\u6536\u56DE\u5199\uFF1A${escapeHtml(record.receiverWritebackStatus)}${record.receiverWritebackAt ? ` / ${escapeHtml(record.receiverWritebackAt)}` : ""}</div>
            <div class="rounded-md border bg-background px-3 py-2">\u5DEE\u5F02\u6570\u91CF\uFF1A${formatNumber(record.discrepancyItems.length)} \u6761</div>
            <div class="rounded-md border bg-background px-3 py-2">\u5F02\u8BAE\u6570\u91CF\uFF1A${formatNumber(record.objectionItems.length)} \u6761</div>
          </div>
        </article>
      </section>

      ${record.specialCraftItems?.length ? `<section class="rounded-lg border bg-card p-4">
              <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 class="text-base font-semibold">\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA\u660E\u7EC6</h2>
                  <p class="mt-1 text-xs text-muted-foreground">\u672C\u8BB0\u5F55\u590D\u7528\u901A\u7528\u4EA4\u51FA\u8BB0\u5F55\uFF0C\u5DE5\u827A\u660E\u7EC6\u7528\u4E8E\u8FFD\u6EAF\u627F\u63A5\u5DE5\u5382\u548C\u56DE\u4ED3\u3002</p>
                </div>
                ${renderStatusPill(record.handoverType || "\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA", "amber")}
              </div>
              <div class="mt-3 grid gap-3 md:grid-cols-2">
                ${record.specialCraftItems.map((item) => `
                    <div class="rounded-md border bg-background p-3 text-sm">
                      <div class="flex items-start justify-between gap-3">
                        <div>
                          <div class="font-semibold">${escapeHtml(item.craftType)} / ${escapeHtml(item.craftCategory)}</div>
                          <div class="mt-1 text-xs text-muted-foreground">\u627F\u63A5\u5DE5\u5382\uFF1A${escapeHtml(item.receiverFactoryName)}</div>
                        </div>
                        <div class="text-right text-xs font-semibold tabular-nums">${formatNumber(item.pieceQty)} \u7247</div>
                      </div>
                      <div class="mt-2 text-xs text-muted-foreground">\u83F2\u7968\uFF1A${escapeHtml(item.feiTicketId)} / \u90E8\u4F4D\uFF1A${escapeHtml(item.partName)} / \u5C3A\u7801\uFF1A${escapeHtml(item.size)}</div>
                    </div>
                  `).join("")}
              </div>
            </section>` : ""}

      <section class="rounded-lg border bg-card p-4">
        <h2 class="text-base font-semibold">\u83F2\u7968\u660E\u7EC6</h2>
        <div class="mt-3 grid gap-3 md:grid-cols-2">
          ${record.feiTicketItems.map((item) => `
              <div class="rounded-md border bg-background p-3 text-sm">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <div class="font-semibold text-blue-700">${escapeHtml(item.feiTicketNo)}</div>
                    <div class="mt-1 text-muted-foreground">${escapeHtml(item.productionOrderNo)} / ${escapeHtml(item.cutOrderNo)}</div>
                  </div>
                  <div class="text-right text-xs text-muted-foreground">${formatNumber(item.pieceQty)} \u7247</div>
                </div>
                <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(`${item.spuCode} / ${item.color} / ${item.size} / ${item.partName} / \u7F16\u53F7\u8303\u56F4 ${item.pieceSequenceLabel}`)}</div>
                <div class="mt-1 text-xs text-muted-foreground">\u4E2D\u8F6C\u888B\uFF1A${escapeHtml(item.targetTransferBagCode)} / \u7279\u6B8A\u5DE5\u827A\uFF1A${escapeHtml(item.specialCraftDisplay)} / \u627F\u63A5\u5DE5\u5382\uFF1A${escapeHtml(item.receiverFactoryDisplay)}</div>
              </div>
            `).join("")}
        </div>
      </section>
    </main>
  `;
}
function renderCraftCuttingHandoverOrdersPage() {
  const projection = buildUniversalHandoverProjection();
  const meta = getCanonicalCuttingMeta("handover-orders");
  const recordsByOrderId = projection.recordsByOrderId;
  return `
    ${renderCuttingPageHeader(meta)}
    <main class="space-y-4">
      <section class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        ${renderCompactKpiCard("\u4EA4\u51FA\u5355\u6570", projection.summary.orderCount, "\u8F66\u7F1D\u3001\u7279\u6B8A\u5DE5\u827A\u3001\u4ED3\u5E93\u5171\u7528\u6A21\u578B", "text-slate-700")}
        ${renderCompactKpiCard("\u4EA4\u51FA\u8BB0\u5F55\u6570", projection.summary.recordCount, "\u4E00\u4E2A\u4EA4\u51FA\u5355\u53EF\u591A\u6B21\u4EA4\u51FA", "text-slate-700")}
        ${renderCompactKpiCard("\u63A5\u6536\u5BF9\u8C61\u7C7B\u578B", projection.summary.receiverTypeCount, projection.receiverTypes.join("\u3001"), "text-blue-600")}
        ${renderCompactKpiCard("\u5F85\u56DE\u5199\u8BB0\u5F55", projection.summary.pendingWritebackCount, "\u63A5\u6536\u65B9\u5C1A\u672A\u56DE\u5199", "text-amber-600")}
        ${renderCompactKpiCard("\u5DEE\u5F02", projection.summary.discrepancyCount, "\u63A5\u6536\u5DEE\u5F02\u8BB0\u5F55", projection.summary.discrepancyCount ? "text-rose-600" : "text-slate-700")}
        ${renderCompactKpiCard("\u5F02\u8BAE", projection.summary.objectionCount, "\u63A5\u6536\u65B9\u6216\u88C1\u5E8A\u53D1\u8D77\u5F02\u8BAE", projection.summary.objectionCount ? "text-rose-600" : "text-slate-700")}
      </section>
      <section class="grid gap-4">
        ${projection.orders.map((order) => renderOrderCard(order, recordsByOrderId[order.handoverOrderId] || [])).join("")}
      </section>
    </main>
  `;
}
function renderCraftCuttingHandoverOrderDetailPage(handoverOrderId) {
  const projection = buildUniversalHandoverProjection();
  const order = (handoverOrderId ? getUniversalHandoverOrderById(decodeURIComponent(handoverOrderId)) : void 0) || projection.orders[0];
  return renderOrderDetail(order, projection.recordsByOrderId[order.handoverOrderId] || []);
}
function renderCraftCuttingHandoverOrderRecordsPage(handoverOrderId) {
  const projection = buildUniversalHandoverProjection();
  const order = (handoverOrderId ? getUniversalHandoverOrderById(decodeURIComponent(handoverOrderId)) : void 0) || projection.orders[0];
  return renderOrderDetail(order, projection.recordsByOrderId[order.handoverOrderId] || [], true);
}
function renderCraftCuttingHandoverRecordDetailPage(handoverRecordId) {
  const projection = buildUniversalHandoverProjection();
  const record = (handoverRecordId ? getUniversalHandoverRecordById(decodeURIComponent(handoverRecordId)) : void 0) || projection.records[0];
  return renderRecordDetail(record);
}
export {
  renderCraftCuttingHandoverOrderDetailPage,
  renderCraftCuttingHandoverOrderRecordsPage,
  renderCraftCuttingHandoverOrdersPage,
  renderCraftCuttingHandoverRecordDetailPage
};
