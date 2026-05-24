import { escapeHtml } from "../utils";
import {
  buildPdaCuttingRoute,
  getPdaCuttingTaskSnapshot,
  getPdaTaskFlowTaskById
} from "../data/fcs/pda-cutting-execution-source.ts";
import {
  readSelectedExecutionOrderIdFromLocation,
  readSelectedExecutionOrderNoFromLocation
} from "./pda-cutting-context";
import { renderMaterialIdentityBlock } from "./process-factory/cutting/material-identity";
import { renderPdaFrame } from "./pda-shell";
function buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo) {
  return `${taskId}::${executionOrderId || executionOrderNo || "default"}`;
}
function renderChip(label, className) {
  return `<span class="inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${className}">${escapeHtml(label)}</span>`;
}
function renderPdaCuttingStatusChip(label, tone = "default") {
  const className = tone === "blue" ? "border-blue-200 bg-blue-50 text-blue-700" : tone === "green" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : tone === "amber" ? "border-amber-200 bg-amber-50 text-amber-700" : tone === "red" ? "border-red-200 bg-red-50 text-red-700" : "border-slate-200 bg-slate-50 text-slate-700";
  return renderChip(label, className);
}
function getPdaCuttingPageContext(taskId) {
  const task = getPdaTaskFlowTaskById(taskId);
  const detail = getPdaCuttingTaskSnapshot(
    taskId,
    readSelectedExecutionOrderIdFromLocation() || readSelectedExecutionOrderNoFromLocation()
  );
  if (!task || !detail) return null;
  return { task, detail };
}
function renderPdaCuttingSummaryGrid(items) {
  return `
    <section class="grid grid-cols-2 gap-2">
      ${items.map(
    (item) => `
            <article class="rounded-xl border bg-card px-2.5 py-2 shadow-sm">
              <div class="text-xs text-muted-foreground">${escapeHtml(item.label)}</div>
              <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(item.value)}</div>
              ${item.hint ? `<div class="mt-0.5 text-[11px] text-muted-foreground">${escapeHtml(item.hint)}</div>` : ""}
            </article>
          `
  ).join("")}
    </section>
  `;
}
function renderPdaCuttingSection(title, _description, content) {
  return `
    <section class="rounded-2xl border bg-card shadow-sm">
      <header class="border-b px-3 py-2">
        <h3 class="text-sm font-semibold text-foreground">${escapeHtml(title)}</h3>
      </header>
      <div class="px-3 py-3">${content}</div>
    </section>
  `;
}
function renderPdaCuttingFeedbackNotice(message, tone = "success") {
  const className = tone === "success" ? "border border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "warning" ? "border border-amber-200 bg-amber-50 text-amber-800" : "border border-slate-200 bg-slate-50 text-slate-700";
  return `<div class="rounded-xl px-2.5 py-2 text-xs ${className}">${escapeHtml(message)}</div>`;
}
function renderPdaCuttingEmptyState(title, _description) {
  return `
    <section class="rounded-2xl border border-dashed bg-muted/20 px-3 py-6 text-center">
      <div class="text-sm font-medium text-foreground">${escapeHtml(title)}</div>
    </section>
  `;
}
function renderPdaCuttingTaskHero(detail) {
  return `
    <section class="rounded-2xl border bg-card px-3 py-3 shadow-sm">
      <div class="flex items-start justify-between gap-2">
        <div class="space-y-1">
          <div class="text-xs text-muted-foreground">\u88C1\u7247\u4EFB\u52A1</div>
          <div class="text-lg font-semibold text-foreground">${escapeHtml(detail.taskNo)}</div>
          <div class="text-xs text-muted-foreground">\u751F\u4EA7\u5355 ${escapeHtml(detail.productionOrderNo)} / \u6267\u884C\u5355 ${escapeHtml(detail.executionOrderNo)}</div>
          <div class="text-xs text-muted-foreground">${escapeHtml(detail.taskProgressLabel)}</div>
        </div>
        ${renderChip(detail.currentStage, "border-blue-200 bg-blue-50 text-blue-700")}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div class="col-span-2 rounded-xl bg-muted/40 px-2.5 py-2">
          <div class="mb-1 text-muted-foreground">\u9762\u6599\u4FE1\u606F</div>
          ${renderMaterialIdentityBlock(
    {
      materialSku: detail.materialSku,
      materialLabel: detail.materialTypeLabel,
      materialAlias: detail.materialAlias,
      materialImageUrl: detail.materialImageUrl
    },
    { compact: true, showCategory: false }
  )}
        </div>
        <div class="rounded-xl bg-muted/40 px-2.5 py-2">
          <div class="text-muted-foreground">\u88C1\u7247\u5355\u4E8C\u7EF4\u7801\u6458\u8981</div>
          <div class="mt-1 font-medium text-foreground">${detail.qrCodeValue ? "\u5DF2\u7ED1\u5B9A\u4E8C\u7EF4\u7801" : "\u5F85\u7ED1\u5B9A\u4E8C\u7EF4\u7801"}</div>
          <div class="mt-1 text-muted-foreground">${escapeHtml(detail.qrVersionNote)}</div>
        </div>
      </div>
    </section>
  `;
}
function renderPdaCuttingExecutionHero(stepTitle, detail) {
  return `
    <section class="rounded-2xl border bg-card px-3 py-3 shadow-sm">
      <div class="flex items-start justify-between gap-2">
        <div class="space-y-1">
          <div class="text-xs text-muted-foreground">\u5F53\u524D\u6B65\u9AA4</div>
          <div class="text-base font-semibold text-foreground">${escapeHtml(stepTitle)}</div>
          <div class="text-xs text-muted-foreground">\u6267\u884C\u5BF9\u8C61 ${escapeHtml(detail.executionOrderNo)}</div>
        </div>
        ${renderChip(detail.taskStatusLabel, "border-blue-200 bg-blue-50 text-blue-700")}
      </div>
      <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
        <article class="rounded-xl border bg-muted/20 px-2.5 py-2">
          <div class="text-muted-foreground">\u5F53\u524D\u751F\u4EA7\u5355</div>
          <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.productionOrderNo)}</div>
        </article>
        <article class="rounded-xl border bg-muted/20 px-2.5 py-2">
          <div class="text-muted-foreground">\u6267\u884C\u5BF9\u8C61</div>
          <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.executionOrderNo)}</div>
          <div class="mt-1 text-[11px] text-muted-foreground">\u7ED1\u5B9A\u88C1\u7247\u5355 ${escapeHtml(detail.cutOrderNo)}</div>
        </article>
        <article class="col-span-2 rounded-xl border bg-muted/20 px-2.5 py-2">
          <div class="mb-1 text-muted-foreground">\u9762\u6599\u4FE1\u606F</div>
          ${renderMaterialIdentityBlock(
    {
      materialSku: detail.materialSku,
      materialLabel: detail.materialTypeLabel,
      materialAlias: detail.materialAlias,
      materialImageUrl: detail.materialImageUrl
    },
    { compact: true, showCategory: false }
  )}
        </article>
        <article class="rounded-xl border bg-muted/20 px-2.5 py-2">
          <div class="text-muted-foreground">\u9762\u6599\u7C7B\u578B</div>
          <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(detail.materialTypeLabel)}</div>
        </article>
      </div>
    </section>
  `;
}
function renderPdaCuttingRiskList(riskTips) {
  if (!riskTips.length) {
    return renderPdaCuttingEmptyState("\u5F53\u524D\u65E0\u4E13\u9879\u98CE\u9669\u63D0\u793A", "");
  }
  return `
    <div class="space-y-1.5">
      ${riskTips.map(
    (tip) => `
            <div class="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs leading-5 text-amber-800">
              ${escapeHtml(tip)}
            </div>
          `
  ).join("")}
    </div>
  `;
}
function renderPdaCuttingPageLayout(options) {
  const context = getPdaCuttingPageContext(options.taskId);
  const backHref = options.backHref ?? "/fcs/pda/exec";
  if (!context) {
    return renderPdaFrame(
      `
        <section class="space-y-3 px-3 py-3">
          <button class="inline-flex items-center rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted" data-nav="${escapeHtml(backHref)}">
            \u8FD4\u56DE
          </button>
          ${renderPdaCuttingEmptyState("\u672A\u627E\u5230\u88C1\u7247\u4EFB\u52A1", "")}
        </section>
      `,
      options.activeTab,
      { disableTodoAutoOpen: true }
    );
  }
  const { detail } = context;
  return renderPdaFrame(
    `
      <section class="space-y-3 px-3 py-3">
        <header class="space-y-2.5">
          <div class="flex items-center justify-between gap-3">
            <button class="inline-flex items-center rounded-md border px-2.5 py-1.5 text-sm hover:bg-muted" data-nav="${escapeHtml(backHref)}">
              \u8FD4\u56DE
            </button>
            ${renderChip(detail.taskTypeLabel, "border-slate-200 bg-slate-50 text-slate-700")}
          </div>
          <div>
            <h1 class="text-xl font-semibold text-foreground">${escapeHtml(options.title)}</h1>
          </div>
        </header>
        ${options.body}
      </section>
    `,
    options.activeTab,
    { disableTodoAutoOpen: true }
  );
}
function normalizePdaCuttingHandoverResultLabel(label) {
  const text = String(label || "").trim();
  if (!text) return "\u65E0\u6362\u73ED";
  if (text === "\u65E0\u6362\u73ED") return text;
  if (text.startsWith("\u4EA4\u63A5\u7ED9\uFF1A") || text.startsWith("\u63A5\u624B\u81EA\uFF1A")) return text;
  const normalized = text.replace(/^换班[:：]\s*/, "").trim();
  if (normalized === "\u5426" || normalized === "\u65E0" || normalized === "\u65E0\u6362\u73ED") return "\u65E0\u6362\u73ED";
  if (normalized === "\u662F") return "\u4EA4\u63A5\u7ED9\uFF1A\u5F85\u786E\u8BA4";
  if (text.startsWith("\u4E2D\u9014\u4EA4\u63A5") || text.startsWith("\u4EA4\u63A5")) {
    const targetName = text.replace(/^(中途交接|交接)[:：]?\s*/, "").trim();
    return targetName ? `\u4EA4\u63A5\u7ED9\uFF1A${targetName}` : "\u4EA4\u63A5\u7ED9\uFF1A\u5F85\u786E\u8BA4";
  }
  if (text.startsWith("\u63A5\u624B\u7EE7\u7EED") || text.startsWith("\u63A5\u624B")) {
    const sourceName = text.replace(/^(接手继续|接手)[:：]?\s*/, "").trim();
    return sourceName ? `\u63A5\u624B\u81EA\uFF1A${sourceName}` : "\u63A5\u624B\u81EA\uFF1A\u5F85\u786E\u8BA4";
  }
  return text;
}
function renderPdaCuttingOrderSelectionPrompt(detail, backHref, notice) {
  return `
    <section class="space-y-3">
      <div class="rounded-2xl border border-dashed bg-muted/20 px-3 py-4 text-center">
        <div class="text-sm font-medium text-foreground">${escapeHtml(notice || "\u5148\u9009\u88C1\u7247\u5355\uFF0C\u518D\u7EE7\u7EED")}</div>
        <div class="mt-1 text-xs text-muted-foreground">\u5F53\u524D\u6709 ${escapeHtml(String(detail.cutPieceOrderCount))} \u5F20\u88C1\u7247\u5355\uFF0C\u9009\u597D\u518D\u8FDB\u5165\u6267\u884C\u5BF9\u8C61\u3002</div>
      </div>
      <button class="inline-flex min-h-9 w-full items-center justify-center rounded-xl border px-3 py-1.5 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(backHref)}">
        \u8FD4\u56DE\u88C1\u7247\u4EFB\u52A1
      </button>
    </section>
  `;
}
function renderPdaCuttingQuickLinks(taskId, options) {
  const links = [
    options?.includeTaskDetail !== false ? {
      label: "\u8FD4\u56DE\u88C1\u7247\u4EFB\u52A1\u8BE6\u60C5",
      href: buildPdaCuttingRoute(taskId, "task", {
        executionOrderId: options?.executionOrderId,
        executionOrderNo: options?.executionOrderNo,
        cutOrderId: options?.cutOrderId,
        cutOrderNo: options?.cutOrderNo,
        markerPlanId: options?.markerPlanId,
        markerPlanNo: options?.markerPlanNo,
        materialSku: options?.materialSku,
        returnTo: options?.returnTo
      })
    } : null,
    { label: "\u94FA\u5E03\u5F55\u5165", href: buildPdaCuttingRoute(taskId, "spreading", options) },
    { label: "\u5165\u4ED3\u626B\u7801", href: buildPdaCuttingRoute(taskId, "inbound", options) },
    { label: "\u4EA4\u63A5\u626B\u7801", href: buildPdaCuttingRoute(taskId, "handover", options) },
    { label: "\u73B0\u573A\u5DEE\u5F02\u53CD\u9988", href: buildPdaCuttingRoute(taskId, "replenishment-feedback", options) }
  ].filter(Boolean);
  return `
    <div class="grid grid-cols-2 gap-2">
      ${links.map(
    (link) => `
            <button class="inline-flex min-h-9 items-center justify-center rounded-xl border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted" data-nav="${escapeHtml(link.href)}">
              ${escapeHtml(link.label)}
            </button>
          `
  ).join("")}
    </div>
  `;
}
export {
  buildPdaCuttingExecutionStateKey,
  getPdaCuttingPageContext,
  normalizePdaCuttingHandoverResultLabel,
  renderPdaCuttingEmptyState,
  renderPdaCuttingExecutionHero,
  renderPdaCuttingFeedbackNotice,
  renderPdaCuttingOrderSelectionPrompt,
  renderPdaCuttingPageLayout,
  renderPdaCuttingQuickLinks,
  renderPdaCuttingRiskList,
  renderPdaCuttingSection,
  renderPdaCuttingStatusChip,
  renderPdaCuttingSummaryGrid,
  renderPdaCuttingTaskHero
};
