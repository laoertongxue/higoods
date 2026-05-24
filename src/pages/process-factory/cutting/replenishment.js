import { appStore } from "../../../state/store.ts";
import { escapeHtml, formatDateTime } from "../../../utils.ts";
import {
  buildReplenishmentFollowupActionForResult,
  buildReplenishmentAuditTrail,
  buildReplenishmentReviewItem,
  deserializeReplenishmentActionsStorage,
  deserializeReplenishmentAuditTrailStorage,
  deserializeReplenishmentImpactPlansStorage,
  deserializeReplenishmentReviewsStorage,
  filterReplenishmentRows,
  findReplenishmentByPrefilter,
  replenishmentFollowupActionStatusMetaMap,
  replenishmentFollowupActionTypeMetaMap,
  replenishmentRiskMetaMap,
  replenishmentSourceMeta,
  replenishmentStatusMetaMap,
  resolveNextActionFromReviewResult,
  resolveReviewStatusFromResult,
  serializeReplenishmentActionsStorage,
  serializeReplenishmentAuditTrailStorage,
  serializeReplenishmentImpactPlansStorage,
  serializeReplenishmentReviewsStorage,
  validateReplenishmentReviewAction
} from "./replenishment-model.ts";
import { buildReplenishmentProjection } from "./replenishment-projection.ts";
import {
  CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY,
  CUTTING_REPLENISHMENT_AUDIT_STORAGE_KEY,
  CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY,
  CUTTING_REPLENISHMENT_PENDING_PREP_STORAGE_KEY,
  CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY,
  deserializeReplenishmentPendingPrepStorage,
  serializeReplenishmentPendingPrepStorage
} from "../../../data/fcs/cutting/storage/replenishment-storage.ts";
import {
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  deserializeMarkerSpreadingStorage,
  serializeMarkerSpreadingStorage,
  updateSpreadingReplenishmentHandled
} from "./marker-spreading-model.ts";
import { readMarkerSpreadingPrototypeData } from "./marker-spreading-utils.ts";
import {
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchStateBar
} from "./layout.helpers.ts";
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from "./meta.ts";
import { getWarehouseSearchParams } from "./warehouse-shared.ts";
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  getCuttingNavigationActionLabel,
  hasSummaryReturnContext,
  buildCuttingDrillContext,
  readCuttingDrillContextFromLocation
} from "./navigation-context.ts";
import {
  ACTION_PERMISSION_DENIED_TEXT,
  canReviewReplenishment,
  resolveFcsDemoRole
} from "../../../data/fcs/action-permissions.ts";
import { renderMaterialIdentityBlock } from "./material-identity.ts";
import { updateCuttingOrderProgressWebStage } from "../../../data/fcs/cutting/order-progress.ts";
const closeReasonOptions = [
  { value: "MATERIAL_NO_MORE_ARRIVAL", label: "\u9762\u6599\u4E0D\u518D\u5230\u8D27" },
  { value: "BUSINESS_STOP_RECUT", label: "\u4E1A\u52A1\u51B3\u5B9A\u4E0D\u518D\u8865\u88C1" },
  { value: "FORCED_CLOSE", label: "\u5F3A\u884C\u5B8C\u7ED3" },
  { value: "STYLE_CANCELLED", label: "\u6B3E\u5F0F\u53D6\u6D88" },
  { value: "OTHER", label: "\u5176\u4ED6\u539F\u56E0" }
];
function resolveCloseReasonText(value) {
  return closeReasonOptions.find((option) => option.value === value)?.label || "\u5F3A\u884C\u5B8C\u7ED3";
}
const initialFilters = {
  keyword: "",
  sourceType: "ALL",
  status: "ALL",
  riskLevel: "ALL",
  pendingReviewOnly: false,
  pendingActionOnly: false
};
const state = {
  filters: { ...initialFilters },
  activeTab: "pending",
  prefilter: null,
  drillContext: null,
  querySignature: "",
  activeSuggestionId: null,
  reviews: deserializeReplenishmentReviewsStorage(localStorage.getItem(CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY)),
  impactPlans: deserializeReplenishmentImpactPlansStorage(localStorage.getItem(CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY)),
  actions: deserializeReplenishmentActionsStorage(localStorage.getItem(CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY)),
  audits: deserializeReplenishmentAuditTrailStorage(localStorage.getItem(CUTTING_REPLENISHMENT_AUDIT_STORAGE_KEY)),
  reviewDraft: {
    result: "\u9700\u8981\u8865\u6599",
    status: "APPROVED",
    reason: "",
    note: "",
    closeReasonCode: "BUSINESS_STOP_RECUT",
    closeReason: ""
  },
  feedback: null
};
function nowText(date = /* @__PURE__ */ new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
function formatQty(value) {
  return new Intl.NumberFormat("zh-CN").format(Math.max(value, 0));
}
function formatLength(value) {
  return `${Number(value || 0).toFixed(2)} \u7C73`;
}
function renderFormulaLine(formula) {
  return formula ? `<div class="mt-1 font-mono text-[11px] leading-4 text-muted-foreground">${escapeHtml(formula)}</div>` : "";
}
function renderMetricCard(label, value, options) {
  return `
    <article class="rounded-lg border bg-muted/20 p-3">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 ${options?.valueClassName || "font-medium text-foreground"}">${escapeHtml(value)}</div>
      ${renderFormulaLine(options?.formula)}
    </article>
  `;
}
function buildLengthSumFormula(result, values) {
  const left = Number(result || 0).toFixed(2);
  const right = values.length ? values.map((value) => Number(value || 0).toFixed(2)).join(" + ") : "0";
  return `${left} = ${right}`;
}
function buildQtySumFormula(result, values) {
  const left = formatQty(result || 0);
  const right = values.length ? values.map((value) => formatQty(value || 0)).join(" + ") : "0";
  return `${left} = ${right}`;
}
function buildLengthDifferenceFormula(result, minuend, subtrahend) {
  return `${Number(result || 0).toFixed(2)} = ${Number(minuend || 0).toFixed(2)} - ${Number(subtrahend || 0).toFixed(2)}`;
}
function buildViewModel() {
  return buildReplenishmentProjection({
    reviews: state.reviews,
    impactPlans: state.impactPlans,
    actions: state.actions
  }).viewModel;
}
function refreshDerivedImpactPlans() {
  state.impactPlans = buildViewModel().rows.map((row) => row.impactPlan);
}
function persistStore() {
  refreshDerivedImpactPlans();
  localStorage.setItem(CUTTING_REPLENISHMENT_REVIEWS_STORAGE_KEY, serializeReplenishmentReviewsStorage(state.reviews));
  localStorage.setItem(CUTTING_REPLENISHMENT_IMPACTS_STORAGE_KEY, serializeReplenishmentImpactPlansStorage(state.impactPlans));
  localStorage.setItem(CUTTING_REPLENISHMENT_ACTIONS_STORAGE_KEY, serializeReplenishmentActionsStorage(state.actions));
  localStorage.setItem(CUTTING_REPLENISHMENT_AUDIT_STORAGE_KEY, serializeReplenishmentAuditTrailStorage(state.audits));
}
function readPendingPrepFollowups() {
  return deserializeReplenishmentPendingPrepStorage(
    localStorage.getItem(CUTTING_REPLENISHMENT_PENDING_PREP_STORAGE_KEY)
  );
}
function persistPendingPrepFollowups(records) {
  localStorage.setItem(
    CUTTING_REPLENISHMENT_PENDING_PREP_STORAGE_KEY,
    serializeReplenishmentPendingPrepStorage(records)
  );
}
function buildPendingPrepFollowupRecords(row, review) {
  const sourceSpreadingSessionId = row.context.session?.spreadingSessionId || "";
  const sourceMarkerId = row.context.marker?.markerId || "";
  const sourceMarkerNo = row.context.marker?.markerNo || "";
  return row.lines.map((line) => ({
    followupId: `pending-prep-${row.suggestionId}-${line.lineId}`,
    suggestionId: row.suggestionId,
    sourceReplenishmentRequestId: row.suggestionId,
    sourceSpreadingSessionId,
    sourceMarkerId,
    sourceMarkerNo,
    cutOrderId: line.cutOrderId,
    cutOrderNo: line.cutOrderNo || line.cutOrderId,
    materialSku: line.materialSku,
    color: line.color,
    shortageGarmentQty: line.shortageGarmentQty,
    status: "PENDING_PREP",
    createdAt: review.reviewedAt,
    createdBy: review.reviewedBy,
    note: `\u5BA1\u6838\u786E\u8BA4\u9700\u8981\u8865\u6599\u540E\u8BB0\u5F55\u4E3A\u5F85\u518D\u6B21\u9886\u6599\u9879\uFF0C\u5DEE\u5F02\u6210\u8863\u4EF6\u6570 ${formatQty(line.shortageGarmentQty)} \u4EF6\u3002`
  }));
}
function replacePendingPrepFollowups(suggestionId, records) {
  const retained = readPendingPrepFollowups().filter((item) => item.suggestionId !== suggestionId);
  persistPendingPrepFollowups([...retained, ...records]);
}
function syncSpreadingReplenishmentHandledState(row, handled) {
  const spreadingSessionId = row.context.session?.spreadingSessionId;
  if (!spreadingSessionId) return;
  const rawStore = localStorage.getItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY);
  const prototypeStore = readMarkerSpreadingPrototypeData().store;
  const baseStore = rawStore ? deserializeMarkerSpreadingStorage(rawStore) : prototypeStore;
  const nextStore = updateSpreadingReplenishmentHandled(baseStore, spreadingSessionId, handled);
  localStorage.setItem(CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY, serializeMarkerSpreadingStorage(nextStore));
}
function getPrefilterFromQuery() {
  const params = getWarehouseSearchParams();
  const drillContext = readCuttingDrillContextFromLocation(params);
  const prefilter = {
    cutOrderNo: drillContext?.cutOrderNo || params.get("cutOrderNo") || void 0,
    cutOrderId: drillContext?.cutOrderId || params.get("cutOrderId") || void 0,
    markerPlanNo: drillContext?.markerPlanNo || params.get("markerPlanNo") || void 0,
    markerPlanId: drillContext?.markerPlanId || params.get("markerPlanId") || void 0,
    productionOrderNo: drillContext?.productionOrderNo || params.get("productionOrderNo") || void 0,
    materialSku: drillContext?.materialSku || params.get("materialSku") || void 0,
    color: drillContext?.color || params.get("color") || void 0,
    suggestionId: drillContext?.suggestionId || params.get("suggestionId") || void 0,
    suggestionNo: drillContext?.suggestionNo || params.get("suggestionNo") || void 0,
    spreadingSessionId: params.get("spreadingSessionId") || params.get("spreadingOrderId") || void 0,
    spreadingOrderId: params.get("spreadingOrderId") || params.get("spreadingSessionId") || void 0,
    riskLevel: params.get("riskLevel") || void 0,
    replenishmentStatus: params.get("replenishmentStatus") || void 0
  };
  return Object.values(prefilter).some(Boolean) ? prefilter : null;
}
function getPrefilterStatusLabel(value) {
  if (!value) return "";
  if (value === "APPROVED") return "\u5DF2\u901A\u8FC7\u5F85\u52A8\u4F5C / \u5904\u7406\u4E2D";
  if (value === "APPLIED") return "\u5DF2\u5B8C\u6210";
  return replenishmentStatusMetaMap[value]?.label || value;
}
function syncReviewDraft(row) {
  const result = row?.review?.reviewResult || "\u9700\u8981\u8865\u6599";
  state.reviewDraft = {
    result,
    status: row?.review?.reviewStatus || resolveReviewStatusFromResult(result),
    reason: row?.review?.decisionReason || "",
    note: row?.review?.note || "",
    closeReasonCode: row?.review?.closeReasonCode || "BUSINESS_STOP_RECUT",
    closeReason: row?.review?.closeReason || ""
  };
}
function syncPrefilterFromQuery() {
  const pathname = appStore.getState().pathname;
  if (pathname === state.querySignature) return;
  state.querySignature = pathname;
  state.drillContext = readCuttingDrillContextFromLocation(getWarehouseSearchParams());
  state.prefilter = getPrefilterFromQuery();
  const matched = findReplenishmentByPrefilter(buildViewModel().rows, state.prefilter);
  if (matched) {
    state.activeSuggestionId = matched.suggestionId;
    syncReviewDraft(matched);
  }
}
function getFilteredRows() {
  const rows = filterReplenishmentRows(buildViewModel().rows, state.filters, state.prefilter);
  if (state.activeTab === "all") return rows;
  if (state.activeTab === "pending") {
    return rows.filter((row) => ["PENDING_REVIEW", "PENDING_SUPPLEMENT"].includes(row.statusMeta.key));
  }
  if (state.activeTab === "handled") {
    return rows.filter(
      (row) => ["APPROVED_PENDING_ACTION", "IN_ACTION", "COMPLETED"].includes(row.statusMeta.key) && row.review?.reviewResult !== "\u5173\u95ED\u88C1\u7247\u5355" && row.review?.reviewResult !== "\u4EC5\u8BB0\u5F55\u5DEE\u5F02"
    );
  }
  if (state.activeTab === "closing") return rows.filter((row) => row.review?.reviewResult === "\u5173\u95ED\u88C1\u7247\u5355");
  return rows.filter((row) => row.review?.reviewResult === "\u4EC5\u8BB0\u5F55\u5DEE\u5F02");
}
function getActiveRow() {
  if (!state.activeSuggestionId) return null;
  return buildViewModel().rowsById[state.activeSuggestionId] || null;
}
function getFollowupActionById(actionId) {
  if (!actionId) return null;
  const rows = buildViewModel().rows;
  for (const row of rows) {
    const matched = row.followupActions.find((item) => item.actionId === actionId);
    if (matched) return { row, action: matched };
  }
  return null;
}
function setFeedback(tone, message) {
  state.feedback = { tone, message };
}
function clearFeedback() {
  state.feedback = null;
}
function upsertReview(review) {
  state.reviews = [...state.reviews.filter((item) => item.suggestionId !== review.suggestionId), review];
}
function upsertImpactPlan(impactPlan) {
  state.impactPlans = [...state.impactPlans.filter((item) => item.suggestionId !== impactPlan.suggestionId), impactPlan];
}
function upsertFollowupAction(action) {
  state.actions = [...state.actions.filter((item) => item.actionId !== action.actionId), action];
}
function replaceFollowupActions(suggestionId, actions) {
  state.actions = [...state.actions.filter((item) => item.suggestionId !== suggestionId), ...actions];
}
function closeCutOrdersForReview(row, review) {
  if (review.reviewResult !== "\u5173\u95ED\u88C1\u7247\u5355") return;
  row.cutOrderIds.forEach((cutOrderId) => {
    updateCuttingOrderProgressWebStage(cutOrderId, {
      cuttingStage: "\u5DF2\u5173\u95ED",
      operatorName: review.reviewedBy,
      operatedAt: review.reviewedAt,
      closeReasonCode: review.closeReasonCode,
      closeReasonText: resolveCloseReasonText(review.closeReasonCode),
      closeReason: review.closeReason || review.decisionReason
    });
  });
}
function prependAudit(audit) {
  state.audits = [audit, ...state.audits];
}
function renderTag(label, className) {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${className}">${escapeHtml(label)}</span>`;
}
function renderFilterSelect(label, field, value, options) {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-replenish-field="${field}">
        ${options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
      </select>
    </label>
  `;
}
function renderHeaderActions() {
  const returnToSummary = hasSummaryReturnContext(state.drillContext) ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="return-summary">\u8FD4\u56DE\u88C1\u526A\u603B\u7ED3</button>` : "";
  return `
    <div class="flex flex-wrap gap-2">
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-marker-index">\u8FD4\u56DE\u94FA\u5E03\u5355</button>
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-cut-order-index">\u67E5\u770B\u88C1\u7247\u5355</button>
      ${returnToSummary}
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-summary-index">\u67E5\u770B\u88C1\u526A\u603B\u7ED3</button>
    </div>
  `;
}
function renderStats() {
  const { stats } = buildViewModel();
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard("\u5DEE\u5F02\u5904\u7406\u9879", stats.totalCount, "\u6309\u5DEE\u5F02\u6765\u6E90\u6C47\u603B", "text-slate-900")}
      ${renderCompactKpiCard("\u5F85\u5BA1\u6838\u5DEE\u5F02", stats.pendingReviewCount, "\u5BA1\u6838\u540E\u624D\u51B3\u5B9A\u540E\u7EED\u52A8\u4F5C", "text-amber-600")}
      ${renderCompactKpiCard("\u53EF\u8865\u6392\u551B\u67B6", stats.replanReadyCount, "\u4ECD\u6709\u5DF2\u9886\u9762\u6599\u4F59\u989D", "text-blue-600")}
      ${renderCompactKpiCard("\u53EF\u5173\u95ED\u88C1\u7247\u5355", stats.closeCandidateCount, "\u786E\u8BA4\u4E0D\u518D\u6765\u6599\u65F6\u5173\u95ED", "text-zinc-700")}
      ${renderCompactKpiCard("\u5F85\u8865\u9F50\u6570\u636E", stats.pendingSupplementCount, "\u94FA\u5E03 / \u88C1\u526A / \u9886\u6599\u6570\u91CF\u5F85\u8865\u9F50", "text-orange-600")}
      ${renderCompactKpiCard("\u9AD8\u98CE\u9669", stats.highRiskCount, "\u9700\u4F18\u5148\u5904\u7406", "text-rose-600")}
    </section>
  `;
}
function countRowsByTab(rows, tab) {
  if (tab === "all") return rows.length;
  if (tab === "pending") return rows.filter((row) => ["PENDING_REVIEW", "PENDING_SUPPLEMENT"].includes(row.statusMeta.key)).length;
  if (tab === "handled") {
    return rows.filter(
      (row) => ["APPROVED_PENDING_ACTION", "IN_ACTION", "COMPLETED"].includes(row.statusMeta.key) && row.review?.reviewResult !== "\u5173\u95ED\u88C1\u7247\u5355" && row.review?.reviewResult !== "\u4EC5\u8BB0\u5F55\u5DEE\u5F02"
    ).length;
  }
  if (tab === "closing") return rows.filter((row) => row.review?.reviewResult === "\u5173\u95ED\u88C1\u7247\u5355").length;
  return rows.filter((row) => row.review?.reviewResult === "\u4EC5\u8BB0\u5F55\u5DEE\u5F02").length;
}
function renderWorkbenchTabs() {
  const rows = filterReplenishmentRows(buildViewModel().rows, state.filters, state.prefilter);
  const tabs = [
    { key: "pending", label: "\u5F85\u5BA1\u6838\u5DEE\u5F02", hint: "\u5B9E\u9645\u5DEE\u5F02\u8FDB\u5165\u5BA1\u6838" },
    { key: "handled", label: "\u5DF2\u5904\u7406", hint: "\u5DF2\u6709\u5BA1\u6838\u7ED3\u679C\u548C\u52A8\u4F5C" },
    { key: "closing", label: "\u5173\u95ED\u88C1\u7247\u5355", hint: "\u5FC5\u987B\u5E26\u5173\u95ED\u539F\u56E0" },
    { key: "record-only", label: "\u4EC5\u8BB0\u5F55\u5DEE\u5F02", hint: "\u4E0D\u6539\u53D8\u6570\u91CF\u8D26" },
    { key: "all", label: "\u5168\u90E8\u8BB0\u5F55", hint: "\u67E5\u770B\u5B8C\u6574\u5904\u7406\u9879" }
  ];
  return `
    <section class="rounded-lg border bg-card p-2">
      <div class="grid gap-2 md:grid-cols-5">
        ${tabs.map((tab) => {
    const active = state.activeTab === tab.key;
    return `
              <button type="button" class="rounded-md border px-3 py-2 text-left text-sm ${active ? "border-blue-500 bg-blue-50 text-blue-700" : "hover:bg-muted"}" data-cutting-replenish-action="set-tab" data-tab-key="${tab.key}">
                <div class="flex items-center justify-between gap-2">
                  <span class="font-medium">${escapeHtml(tab.label)}</span>
                  <span class="tabular-nums">${escapeHtml(String(countRowsByTab(rows, tab.key)))}</span>
                </div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(tab.hint)}</div>
              </button>
            `;
  }).join("")}
      </div>
    </section>
  `;
}
function renderFeedbackBar() {
  if (!state.feedback) return "";
  const toneClass = state.feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return `<section class="rounded-lg border px-3 py-2 text-sm ${toneClass}">${escapeHtml(state.feedback.message)}</section>`;
}
function renderPrefilterBar() {
  if (!state.prefilter) return "";
  const labels = [
    ...buildCuttingDrillChipLabels(state.drillContext),
    state.prefilter.color ? `\u989C\u8272\uFF1A${state.prefilter.color}` : "",
    state.prefilter.riskLevel ? `\u98CE\u9669\uFF1A${replenishmentRiskMetaMap[state.prefilter.riskLevel].label}` : "",
    state.prefilter.replenishmentStatus ? `\u72B6\u6001\uFF1A${getPrefilterStatusLabel(state.prefilter.replenishmentStatus)}` : ""
  ].filter(Boolean);
  return renderWorkbenchStateBar({
    summary: buildCuttingDrillSummary(state.drillContext) || "\u5F53\u524D\u6309\u5916\u90E8\u4E0A\u4E0B\u6587\u9884\u7B5B\u8865\u6599\u7EA0\u504F\u9879",
    chips: labels.map((label) => renderWorkbenchFilterChip(label, 'data-cutting-replenish-action="clear-prefilter"', "amber")),
    clearAttrs: 'data-cutting-replenish-action="clear-prefilter"'
  });
}
function renderFilterBar() {
  return renderStickyFilterShell(`
    <div class="space-y-3">
      <div class="flex flex-wrap gap-2">
        ${renderWorkbenchFilterChip(
    state.filters.pendingReviewOnly ? "\u4EC5\u770B\u5F85\u5BA1\u6838\uFF1A\u5DF2\u5F00\u542F" : "\u4EC5\u770B\u5F85\u5BA1\u6838",
    'data-cutting-replenish-action="toggle-pending-review"',
    state.filters.pendingReviewOnly ? "amber" : "blue"
  )}
        ${renderWorkbenchFilterChip(
    state.filters.pendingActionOnly ? "\u4EC5\u770B\u9700\u540E\u7EED\u5904\u7406\uFF1A\u5DF2\u5F00\u542F" : "\u4EC5\u770B\u9700\u540E\u7EED\u5904\u7406",
    'data-cutting-replenish-action="toggle-pending-action"',
    state.filters.pendingActionOnly ? "amber" : "blue"
  )}
        <button type="button" class="rounded-md border px-3 py-1 text-xs hover:bg-muted" data-cutting-replenish-action="clear-filters">\u91CD\u7F6E\u7B5B\u9009</button>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <label class="space-y-2 xl:col-span-2">
          <span class="text-sm font-medium text-foreground">\u5173\u952E\u8BCD</span>
          <input type="text" value="${escapeHtml(state.filters.keyword)}" placeholder="\u652F\u6301\u88C1\u7247\u5355\u53F7 / \u551B\u67B6\u65B9\u6848\u53F7 / \u751F\u4EA7\u5355\u53F7 / \u9762\u6599 SKU" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-replenish-field="keyword" />
        </label>
        ${renderFilterSelect("\u4E1A\u52A1\u5BF9\u8C61", "sourceType", state.filters.sourceType, [
    { value: "ALL", label: "\u5168\u90E8" },
    { value: "cut-order", label: "\u88C1\u7247\u5355" },
    { value: "marker-plan-ref", label: "\u551B\u67B6\u65B9\u6848" },
    { value: "spreading-session", label: "\u94FA\u5E03\u8BB0\u5F55" },
    { value: "pda-feedback", label: "\u73B0\u573A\u53CD\u9988" }
  ])}
        ${renderFilterSelect("\u5904\u7406\u72B6\u6001", "status", state.filters.status, [
    { value: "ALL", label: "\u5168\u90E8" },
    { value: "NO_ACTION", label: "\u65E0\u9700\u8865\u6599" },
    { value: "PENDING_REVIEW", label: "\u5F85\u5BA1\u6838" },
    { value: "PENDING_SUPPLEMENT", label: "\u5F85\u8865\u5F55" },
    { value: "APPROVED_PENDING_ACTION", label: "\u5DF2\u901A\u8FC7\u5F85\u52A8\u4F5C" },
    { value: "IN_ACTION", label: "\u5904\u7406\u4E2D" },
    { value: "REJECTED", label: "\u5BA1\u6838\u9A73\u56DE" },
    { value: "COMPLETED", label: "\u5DF2\u5B8C\u6210" }
  ])}
        ${renderFilterSelect("\u98CE\u9669\u7B49\u7EA7", "riskLevel", state.filters.riskLevel, [
    { value: "ALL", label: "\u5168\u90E8" },
    { value: "HIGH", label: "\u9AD8\u98CE\u9669" },
    { value: "MEDIUM", label: "\u4E2D\u98CE\u9669" },
    { value: "LOW", label: "\u4F4E\u98CE\u9669" }
  ])}
      </div>
    </div>
  `);
}
function renderActionButton(label, action, suggestionId, extraAttrs = "") {
  return `<button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-replenish-action="${action}" data-suggestion-id="${escapeHtml(suggestionId)}" ${extraAttrs}>${escapeHtml(label)}</button>`;
}
function renderNextOptionTags(row) {
  return row.nextOptions.map((option) => `<span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${option.className}">${escapeHtml(option.label)}</span>`).join("");
}
function getNextOptionButtonLabel(option) {
  if (option.key === "WAIT_NEXT_PICKUP") return "\u53BB\u5F85\u52A0\u5DE5\u4ED3";
  if (option.key === "REPLAN_MARKER") return "\u53BB\u53EF\u6392\u551B\u67B6\u88C1\u7247\u5355";
  if (option.key === "CLOSE_CUT_ORDER") return "\u53BB\u88C1\u7247\u5355";
  return option.label;
}
function renderNextOptionButtons(row) {
  return row.nextOptions.map((option) => {
    const label = getNextOptionButtonLabel(option);
    return renderActionButton(label, "go-related", row.suggestionId, `data-target-key="${escapeHtml(option.target)}"`);
  }).join("");
}
function renderRowActions(row) {
  return `
    <div class="flex flex-wrap gap-2">
      ${renderActionButton("\u67E5\u770B\u8BE6\u60C5", "open-detail", row.suggestionId)}
      ${renderNextOptionButtons(row)}
    </div>
  `;
}
function renderTable(rows) {
  if (!rows.length) {
    return '<section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">\u5F53\u524D\u7B5B\u9009\u6761\u4EF6\u4E0B\u6682\u65E0\u5DEE\u5F02\u5904\u7406\u9879\u3002</section>';
  }
  return renderStickyTableScroller(`
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th class="px-4 py-3 text-left">\u6765\u6E90</th>
          <th class="px-4 py-3 text-left">\u9762\u6599\u4E0E\u7EB8\u6837</th>
          <th class="px-4 py-3 text-left">\u5DEE\u5F02</th>
          <th class="px-4 py-3 text-left">\u8BC1\u636E</th>
          <th class="px-4 py-3 text-left">\u5BA1\u6838\u4E0E\u540E\u7EED\u52A8\u4F5C</th>
          <th class="px-4 py-3 text-left">\u64CD\u4F5C</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => {
    const item = buildReplenishmentReviewItem(row);
    return `
            <tr class="border-b align-top bg-card">
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  ${renderTag(item.sourceType, replenishmentSourceMeta[row.sourceType].className)}
                  ${renderTag(row.riskMeta.label, row.riskMeta.className)}
                </div>
                <button type="button" class="mt-2 block font-medium text-blue-700 hover:underline" data-cutting-replenish-action="open-detail" data-suggestion-id="${escapeHtml(row.suggestionId)}">${escapeHtml(item.replenishmentNo)}</button>
                <div class="mt-1 text-xs text-muted-foreground">\u751F\u4EA7\u5355\uFF1A${escapeHtml(row.productionOrderNos.join(" / ") || "\u5F85\u8865")}</div>
                <div class="mt-1 text-xs text-muted-foreground">\u88C1\u7247\u5355\uFF1A${escapeHtml(row.cutOrderNos.join(" / ") || "\u5F85\u8865")}</div>
                <div class="mt-1 text-xs text-muted-foreground">\u94FA\u5E03\u5355\uFF1A${escapeHtml(item.spreadingOrderNo || "\u672A\u5173\u8054")}</div>
                <div class="mt-1 text-xs text-muted-foreground">\u551B\u67B6\u65B9\u6848\uFF1A${escapeHtml(item.markerPlanNo || "\u672A\u5173\u8054")}</div>
              </td>
              <td class="px-4 py-3">
                ${renderMaterialIdentityBlock(
      {
        materialSku: item.materialIdentity.materialSku,
        materialLabel: item.materialIdentity.materialName,
        materialCategory: row.materialCategory,
        materialAlias: item.materialIdentity.materialAlias,
        materialImageUrl: item.materialIdentity.materialImageUrl
      },
      { compact: true, imageSizeClass: "h-9 w-9" }
    )}
                <div class="mt-2 text-xs text-muted-foreground">\u989C\u8272\uFF1A${escapeHtml(item.materialIdentity.materialColor)}</div>
                <div class="mt-1 text-xs text-muted-foreground">\u7EB8\u6837\uFF1A${escapeHtml(item.patternIdentity.patternFileName)}</div>
                <div class="mt-1 text-xs text-muted-foreground">\u6709\u6548\u5E45\u5BBD\uFF1A${escapeHtml(item.patternIdentity.effectiveWidthText)}</div>
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-1">
                  ${renderTag(item.differenceType, item.differenceLevel === "\u9700\u5904\u7406" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700")}
                  ${row.sourceDifferenceCount > 1 ? `<span class="text-xs text-muted-foreground">+${row.sourceDifferenceCount - 1}</span>` : ""}
                </div>
                <div class="mt-2 text-xs text-muted-foreground">\u8BA1\u5212\u503C\uFF1A${escapeHtml(`${formatQty(item.plannedValue)} ${item.unit}`)}</div>
                <div class="mt-1 text-xs text-muted-foreground">\u5B9E\u9645\u503C\uFF1A${escapeHtml(`${formatQty(item.actualValue)} ${item.unit}`)}</div>
                <div class="mt-1 text-xs font-medium ${Math.abs(item.differenceValue) > 0 ? "text-rose-600" : "text-foreground"}">\u5DEE\u5F02\u503C\uFF1A${escapeHtml(`${formatQty(Math.abs(item.differenceValue))} ${item.unit}`)}</div>
                <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.differenceSummary)}</div>
              </td>
              <td class="px-4 py-3">
                <div class="text-xs text-muted-foreground">${escapeHtml(item.evidenceItems[0]?.summary || row.note)}</div>
                <div class="mt-1 text-xs text-muted-foreground">PDA \u53CD\u9988\uFF1A${escapeHtml(row.latestPdaFeedbackSummary || "\u65E0")}</div>
                <div class="mt-1 text-xs text-muted-foreground">\u51ED\u8BC1\uFF1A${escapeHtml(String(item.evidenceItems.filter((evidence) => evidence.evidenceType === "\u7167\u7247").length || row.latestPdaFeedback?.photoProofCount || 0))} \u9879</div>
              </td>
              <td class="px-4 py-3">
                <div class="flex flex-wrap gap-2">
                  ${renderTag(row.statusMeta.label, row.statusMeta.className)}
                  ${row.review?.reviewResult ? renderTag(row.review.reviewResult, row.review.reviewResult === "\u5173\u95ED\u88C1\u7247\u5355" ? "bg-zinc-100 text-zinc-700" : row.review.reviewResult === "\u4EC5\u8BB0\u5F55\u5DEE\u5F02" ? "bg-slate-100 text-slate-700" : "bg-blue-100 text-blue-700") : ""}
                </div>
                <div class="mt-2 flex flex-wrap gap-2">${renderNextOptionTags(row)}</div>
                <div class="mt-1 text-xs text-muted-foreground">\u540E\u7EED\u52A8\u4F5C\uFF1A${escapeHtml(item.nextAction || row.nextActionLabel)}</div>
                <div class="mt-1 text-xs text-muted-foreground">\u6570\u91CF\u8D26\u4E8B\u4EF6\uFF1A${escapeHtml(item.linkedLedgerEventIds.length ? item.linkedLedgerEventIds.join(" / ") : "\u65E0\u76F4\u63A5\u53D8\u66F4")}</div>
              </td>
              <td class="px-4 py-3">
                ${renderRowActions(row)}
              </td>
            </tr>
          `;
  }).join("")}
      </tbody>
    </table>
  `);
}
function renderEvidenceSection(row) {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold text-foreground">\u5DEE\u5F02\u4F9D\u636E</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">\u4E1A\u52A1\u5BF9\u8C61</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.sourceLabel)}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">\u6765\u6E90\u88C1\u7247\u5355</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.cutOrderNos.join(" / ") || "\u5F85\u8865")}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">\u6765\u6E90\u551B\u67B6\u65B9\u6848</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.markerPlanNo || "\u65E0")}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">\u6765\u6E90\u751F\u4EA7\u5355</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.productionOrderNos.join(" / ") || "\u5F85\u8865")}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">\u6765\u6E90\u551B\u67B6</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.context.marker?.markerNo || "\u672A\u5173\u8054")}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">\u6765\u6E90\u94FA\u5E03\u8BB0\u5F55</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.context.session?.sessionNo || "\u672A\u5173\u8054")}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">\u9762\u6599</div>
          <div class="mt-2">${renderMaterialIdentityBlock({
    materialSku: row.materialSku,
    materialLabel: row.materialSku,
    materialCategory: row.materialCategory,
    materialAlias: row.materialAlias,
    materialImageUrl: row.materialImageUrl
  })}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">\u9762\u6599\u7C7B\u522B</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.materialCategory)}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">\u9762\u6599\u5C5E\u6027</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.materialAttr)}</div>
        </article>
      </div>
    </section>
  `;
}
function renderSpreadingDifferenceSection(row) {
  if (!row.sourceDifferences.length) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold text-foreground">\u94FA\u5E03\u4E0E\u88C1\u526A\u5DEE\u5F02</h3>
        <div class="mt-3 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">\u5F53\u524D\u6CA1\u6709\u5173\u8054\u94FA\u5E03\u6216\u88C1\u526A\u5DEE\u5F02\u4E8B\u9879\u3002</div>
      </section>
    `;
  }
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">\u94FA\u5E03\u4E0E\u88C1\u526A\u5DEE\u5F02</h3>
        <span class="text-xs text-muted-foreground">${escapeHtml(`${row.sourceDifferenceCount} \u9879 \xB7 ${row.differenceTypeSummary}`)}</span>
      </div>
      <div class="mt-3 grid gap-3">
        ${row.sourceDifferences.map(
    (difference) => `
              <article class="rounded-lg border bg-muted/20 p-3">
                <div class="flex flex-wrap items-center justify-between gap-3">
                  <div class="flex flex-wrap items-center gap-2">
                    ${renderTag(difference.differenceType, difference.differenceLevel === "\u9700\u5904\u7406" ? "bg-rose-100 text-rose-700" : difference.differenceLevel === "\u9700\u590D\u6838" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700")}
                    ${renderTag(difference.handlingStatus, difference.handlingStatus === "\u5F85\u5904\u7406" ? "bg-amber-100 text-amber-700" : difference.handlingStatus === "\u5DF2\u5904\u7406" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700")}
                    <span class="text-xs text-muted-foreground">${escapeHtml(difference.sourceType)}</span>
                  </div>
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-replenish-action="go-related" data-target-key="markerSpreading" data-suggestion-id="${escapeHtml(row.suggestionId)}">\u67E5\u770B\u94FA\u5E03\u5355</button>
                </div>
                <div class="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-4">
                  <div>\u94FA\u5E03\u5355\uFF1A<span class="font-medium text-foreground">${escapeHtml(difference.spreadingOrderNo)}</span></div>
                  <div>\u8BA1\u5212\u503C\uFF1A<span class="font-medium text-foreground">${escapeHtml(`${formatQty(difference.plannedValue)} ${difference.unit}`)}</span></div>
                  <div>\u5B9E\u9645\u503C\uFF1A<span class="font-medium text-foreground">${escapeHtml(`${formatQty(difference.actualValue)} ${difference.unit}`)}</span></div>
                  <div>\u5DEE\u5F02\u503C\uFF1A<span class="font-medium text-foreground">${escapeHtml(`${formatQty(Math.abs(difference.differenceValue))} ${difference.unit}`)}</span></div>
                </div>
                <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(difference.evidence.summary)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${difference.detectedBy} \xB7 ${formatDateTime(difference.detectedAt)}${difference.evidence.note ? ` \xB7 ${difference.evidence.note}` : ""}`)}</div>
              </article>
            `
  ).join("")}
      </div>
    </section>
  `;
}
function renderDifferenceSection(row) {
  const latestUpdatedAt = row.context.session?.updatedAt || row.context.marker?.updatedAt || row.createdAt;
  const latestOperatorName = row.context.session?.completionLinkage?.completedBy || row.context.marker?.updatedBy || "\u5F85\u8865";
  const lineRequiredValues = row.lines.map((line) => line.requiredGarmentQty);
  const lineActualValues = row.lines.map((line) => line.actualCutGarmentQty);
  const lineClaimedValues = row.lines.map((line) => line.claimedLengthTotal);
  const lineActualLengthValues = row.lines.map((line) => line.actualLengthTotal);
  const lineColorSummary = Array.from(new Set(row.lines.map((line) => line.color).filter(Boolean))).join(" / ") || "\u5F85\u8865";
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold text-foreground">\u5DEE\u5F02\u4E0E\u6570\u91CF\u8D26</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderMetricCard("\u8BA1\u5212\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09", `${formatQty(row.requiredGarmentQty)} \u4EF6`, {
    formula: buildQtySumFormula(row.requiredGarmentQty, lineRequiredValues)
  })}
        ${renderMetricCard("\u7406\u8BBA\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09", `${formatQty(row.theoreticalCutGarmentQty)} \u4EF6`, {
    formula: row.summaryRuleText || `${formatQty(row.theoreticalCutGarmentQty)} = \u94FA\u5E03\u7406\u8BBA\u88C1\u526A\u6210\u8863\u4EF6\u6570`
  })}
        ${renderMetricCard("\u5B9E\u9645\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09", `${formatQty(row.actualCutGarmentQty)} \u4EF6`, {
    formula: buildQtySumFormula(row.actualCutGarmentQty, lineActualValues)
  })}
        ${renderMetricCard("\u5DEE\u5F02\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09", `${formatQty(row.shortageGarmentQty)} \u4EF6`, {
    formula: `max(${formatQty(row.requiredGarmentQty)} - ${formatQty(row.actualCutGarmentQty)}, 0) = ${formatQty(row.shortageGarmentQty)}`,
    valueClassName: row.shortageGarmentQty > 0 ? "font-medium text-rose-600" : "font-medium text-foreground"
  })}
        ${renderMetricCard("\u4E2D\u8F6C\u4ED3\u5DF2\u914D\u6570\u91CF\uFF08m\uFF09", formatLength(row.configuredLengthTotal))}
        ${renderMetricCard("\u88C1\u5E8A\u5DF2\u9886\u6570\u91CF\uFF08m\uFF09", formatLength(row.claimedLengthTotal), {
    formula: buildLengthSumFormula(row.claimedLengthTotal, lineClaimedValues)
  })}
        ${renderMetricCard("\u5B9E\u9645\u6D88\u8017\u6570\u91CF\uFF08m\uFF09", formatLength(row.actualLengthTotal), {
    formula: buildLengthSumFormula(row.actualLengthTotal, lineActualLengthValues)
  })}
        ${renderMetricCard("\u5DF2\u9886\u4F59\u989D\uFF08m\uFF09", formatLength(row.claimedBalanceLength), {
    formula: `max(${Number(row.claimedLengthTotal || 0).toFixed(2)} - ${Number(row.actualLengthTotal || 0).toFixed(2)}, 0) = ${Number(row.claimedBalanceLength || 0).toFixed(2)}`,
    valueClassName: row.claimedBalanceLength > 0 ? "font-medium text-blue-700" : "font-medium text-foreground"
  })}
        ${renderMetricCard("\u9762\u6599\u7F3A\u53E3\u957F\u5EA6\uFF08m\uFF09", formatLength(row.materialGapLength), {
    formula: `max(${Number(row.shortageLengthTotal || 0).toFixed(2)}, ${Number(row.actualLengthTotal || 0).toFixed(2)} - ${Number(row.claimedLengthTotal || 0).toFixed(2)}, 0) = ${Number(row.materialGapLength || 0).toFixed(2)}`,
    valueClassName: row.materialGapLength > 0 ? "font-medium text-rose-600" : "font-medium text-foreground"
  })}
        ${renderMetricCard("\u8D26\u9762\u5DEE\u5F02\u957F\u5EA6\uFF08m\uFF09", formatLength(row.varianceLength), {
    formula: buildLengthDifferenceFormula(row.varianceLength, row.claimedLengthTotal, row.actualLengthTotal),
    valueClassName: row.varianceLength < 0 ? "font-medium text-rose-600" : "font-medium text-foreground"
  })}
        ${renderMetricCard("\u6765\u6E90\u989C\u8272", lineColorSummary)}
        ${renderMetricCard("\u6700\u8FD1\u66F4\u65B0\u65F6\u95F4", formatDateTime(latestUpdatedAt))}
        ${renderMetricCard("\u6700\u8FD1\u64CD\u4F5C\u4EBA", latestOperatorName)}
        ${renderMetricCard("\u5224\u5B9A\u4F9D\u636E", row.summaryRuleText || row.note)}
      </div>
      <div class="mt-3 rounded-lg border border-dashed bg-amber-50/70 p-3 text-xs text-muted-foreground">${escapeHtml(row.note)}</div>
    </section>
  `;
}
function renderSuggestionLineSection(row) {
  if (!row.lines.length) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <h3 class="text-sm font-semibold text-foreground">\u5DEE\u5F02\u660E\u7EC6</h3>
        <div class="mt-3 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">\u5F53\u524D\u5DEE\u5F02\u5C1A\u672A\u62C6\u5230\u88C1\u7247\u5355 \xD7 \u9762\u6599 \xD7 \u989C\u8272\u7EF4\u5EA6\u3002</div>
      </section>
    `;
  }
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-foreground">\u5DEE\u5F02\u660E\u7EC6</h3>
        <span class="text-xs text-muted-foreground">${escapeHtml(`${formatQty(row.lines.length)} \u6761 = \u88C1\u7247\u5355 \xD7 \u9762\u6599 \xD7 \u989C\u8272`)}</span>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        ${row.lines.map(
    (line) => `
              <article class="rounded-lg border bg-muted/20 p-3 text-xs">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div class="font-medium text-foreground">${escapeHtml(line.cutOrderNo || line.cutOrderId)}</div>
                    <div class="mt-1 text-muted-foreground">\u989C\u8272\uFF1A${escapeHtml(line.color || "\u5F85\u8865")}</div>
                  </div>
                  <div>${renderMaterialIdentityBlock({
      materialSku: line.materialSku,
      materialLabel: line.materialSku,
      materialAlias: line.materialAlias,
      materialImageUrl: line.materialImageUrl
    }, { compact: true })}</div>
                </div>
                <div class="mt-3 grid gap-2 sm:grid-cols-2">
                  <div>\u8BA1\u5212\u88C1\u526A\uFF1A<span class="font-medium text-foreground">${escapeHtml(`${formatQty(line.requiredGarmentQty)} \u4EF6`)}</span></div>
                  <div>\u5B9E\u9645\u88C1\u526A\uFF1A<span class="font-medium text-foreground">${escapeHtml(`${formatQty(line.actualCutGarmentQty)} \u4EF6`)}</span></div>
                  <div>\u88C1\u5E8A\u5DF2\u9886\uFF1A<span class="font-medium text-foreground">${escapeHtml(formatLength(line.claimedLengthTotal))}</span></div>
                  <div>\u5B9E\u9645\u6D88\u8017\uFF1A<span class="font-medium text-foreground">${escapeHtml(formatLength(line.actualLengthTotal))}</span></div>
                  <div>\u5DEE\u5F02\u4EF6\u6570\uFF1A<span class="${line.shortageGarmentQty > 0 ? "font-medium text-rose-600" : "font-medium text-foreground"}">${escapeHtml(`${formatQty(line.shortageGarmentQty)} \u4EF6`)}</span></div>
                  <div>\u5EFA\u8BAE\u52A8\u4F5C\uFF1A<span class="font-medium text-foreground">${escapeHtml(line.suggestedAction)}</span></div>
                </div>
                <div class="mt-2 text-muted-foreground">${escapeHtml(line.suggestedActionRuleText)}</div>
              </article>
            `
  ).join("")}
      </div>
    </section>
  `;
}
function renderReviewSection(row) {
  const closingSelected = state.reviewDraft.result === "\u5173\u95ED\u88C1\u7247\u5355";
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold text-foreground">\u5904\u7406\u5224\u65AD</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">\u5F53\u524D\u5904\u7406\u7ED3\u679C</div>
          <div class="mt-1 flex flex-wrap gap-2">
            ${row.review ? renderTag(row.reviewResultLabel, row.review.reviewResult === "\u5173\u95ED\u88C1\u7247\u5355" ? "bg-zinc-100 text-zinc-700" : row.review.reviewResult === "\u9700\u8981\u8865\u5F55" ? "bg-orange-100 text-orange-700" : row.review.reviewResult === "\u4EC5\u8BB0\u5F55\u5DEE\u5F02" ? "bg-slate-100 text-slate-700" : "bg-blue-100 text-blue-700") : '<span class="text-xs text-muted-foreground">\u672A\u5BA1\u6838</span>'}
            ${renderTag(row.statusMeta.label, row.statusMeta.className)}
          </div>
          <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.review?.decisionReason || row.suggestedAction)}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">\u5F53\u524D\u540E\u7EED\u65B9\u5411</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(row.nextActionLabel)}</div>
          <div class="mt-2 text-xs text-muted-foreground">${escapeHtml(row.blockingSummary)}</div>
        </article>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2">
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">\u5904\u7406\u7ED3\u8BBA</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-replenish-review-field="result">
            <option value="\u9700\u8981\u8865\u6599" ${state.reviewDraft.result === "\u9700\u8981\u8865\u6599" ? "selected" : ""}>\u9700\u8981\u8865\u6599</option>
            <option value="\u9700\u8981\u8865\u5F55" ${state.reviewDraft.result === "\u9700\u8981\u8865\u5F55" ? "selected" : ""}>\u9700\u8981\u8865\u5F55</option>
            <option value="\u7EE7\u7EED\u8865\u6392" ${state.reviewDraft.result === "\u7EE7\u7EED\u8865\u6392" ? "selected" : ""}>\u7EE7\u7EED\u8865\u6392</option>
            <option value="\u5173\u95ED\u88C1\u7247\u5355" ${state.reviewDraft.result === "\u5173\u95ED\u88C1\u7247\u5355" ? "selected" : ""}>\u5173\u95ED\u88C1\u7247\u5355</option>
            <option value="\u4EC5\u8BB0\u5F55\u5DEE\u5F02" ${state.reviewDraft.result === "\u4EC5\u8BB0\u5F55\u5DEE\u5F02" ? "selected" : ""}>\u4EC5\u8BB0\u5F55\u5DEE\u5F02</option>
          </select>
        </label>
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">\u51B3\u7B56\u539F\u56E0</span>
          <input type="text" value="${escapeHtml(state.reviewDraft.reason)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="\u586B\u5199\u672C\u6B21\u5904\u7406\u5224\u65AD\u4F9D\u636E" data-cutting-replenish-review-field="reason" />
        </label>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 ${closingSelected ? "" : "hidden"}">
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">\u5173\u95ED\u539F\u56E0</span>
          <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-cutting-replenish-review-field="closeReasonCode">
            ${closeReasonOptions.map(
    (option) => `<option value="${escapeHtml(option.value)}" ${state.reviewDraft.closeReasonCode === option.value ? "selected" : ""}>${escapeHtml(option.label)}</option>`
  ).join("")}
          </select>
        </label>
        <label class="space-y-2">
          <span class="text-xs text-muted-foreground">\u5173\u95ED\u8BF4\u660E</span>
          <input type="text" value="${escapeHtml(state.reviewDraft.closeReason)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="\u5173\u95ED\u88C1\u7247\u5355\u65F6\u5FC5\u586B" data-cutting-replenish-review-field="closeReason" />
        </label>
      </div>
      <label class="mt-3 block space-y-2">
        <span class="text-xs text-muted-foreground">\u8865\u5145\u5907\u6CE8</span>
        <textarea rows="3" class="w-full rounded-md border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500" placeholder="\u8865\u5145\u5904\u7406\u4F9D\u636E\u6216\u7EA0\u504F\u8BF4\u660E" data-cutting-replenish-review-field="note">${escapeHtml(state.reviewDraft.note)}</textarea>
      </label>
    </section>
  `;
}
function renderActionRows(row) {
  if (!row.followupActions.length) {
    return '<div class="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">\u5F53\u524D\u65E0\u9700\u540E\u7EED\u52A8\u4F5C\u3002</div>';
  }
  return `
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            <th class="px-3 py-2 text-left">\u52A8\u4F5C\u7C7B\u578B</th>
            <th class="px-3 py-2 text-left">\u72B6\u6001</th>
            <th class="px-3 py-2 text-left">\u8BF4\u660E</th>
            <th class="px-3 py-2 text-left">\u8DF3\u8F6C\u65B9\u5411</th>
            <th class="px-3 py-2 text-left">\u72B6\u6001\u7EF4\u62A4</th>
          </tr>
        </thead>
        <tbody>
          ${row.followupActions.map((action) => {
    const typeMeta = replenishmentFollowupActionTypeMetaMap[action.actionType];
    const statusMeta = replenishmentFollowupActionStatusMetaMap[action.status];
    return `
                <tr class="border-b align-top">
                  <td class="px-3 py-3">
                    <div class="flex flex-wrap gap-2">
                      ${renderTag(typeMeta.label, typeMeta.className)}
                    </div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(action.title)}</div>
                  </td>
                  <td class="px-3 py-3">
                    ${renderTag(statusMeta.label, statusMeta.className)}
                    <div class="mt-1 text-xs text-muted-foreground">
                      ${escapeHtml(
      action.status === "DONE" ? `${action.completedBy || "\u5F85\u8865"} \xB7 ${action.completedAt || "\u5F85\u8865"}` : action.status === "SKIPPED" ? `${action.decidedBy || "\u5F85\u8865"} \xB7 ${action.decidedAt || "\u5F85\u8865"}` : action.status === "CONFIRMED" ? `${action.decidedBy || "\u5F85\u8865"} \xB7 ${action.decidedAt || "\u5F85\u8865"}` : "\u5F85\u5904\u7406"
    )}
                    </div>
                  </td>
                  <td class="px-3 py-3 text-xs text-muted-foreground">${escapeHtml(action.note || "\u65E0\u8865\u5145\u8BF4\u660E")}</td>
                  <td class="px-3 py-3">
                    <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-replenish-action="go-followup-target" data-action-id="${escapeHtml(action.actionId)}">${escapeHtml(getCuttingNavigationActionLabel(action.targetPageKey))}</button>
                  </td>
                  <td class="px-3 py-3">
                    <div class="flex flex-wrap gap-2">
                      ${action.status === "PENDING" ? `<button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-replenish-action="confirm-followup" data-action-id="${escapeHtml(action.actionId)}">\u786E\u8BA4\u52A8\u4F5C</button>` : ""}
                      ${["PENDING", "CONFIRMED"].includes(action.status) ? `<button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-replenish-action="complete-followup" data-action-id="${escapeHtml(action.actionId)}">\u6807\u8BB0\u5B8C\u6210</button>` : ""}
                      ${["PENDING", "CONFIRMED"].includes(action.status) ? `<button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-cutting-replenish-action="skip-followup" data-action-id="${escapeHtml(action.actionId)}">\u8DF3\u8FC7</button>` : ""}
                    </div>
                  </td>
                </tr>
              `;
  }).join("")}
        </tbody>
      </table>
    </div>
  `;
}
function renderActionsSection(row) {
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-foreground">\u540E\u7EED\u52A8\u4F5C</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.nextActionSummary)}</p>
        </div>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${row.nextOptions.map(
    (option) => `
              <article class="rounded-lg border bg-muted/20 p-3">
                <div class="flex flex-wrap items-center gap-2">
                  <span class="inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${option.className}">${escapeHtml(option.label)}</span>
                </div>
                <p class="mt-2 text-xs leading-5 text-muted-foreground">${escapeHtml(option.detailText)}</p>
                <div class="mt-3">
                  ${renderActionButton(getNextOptionButtonLabel(option), "go-related", row.suggestionId, `data-target-key="${escapeHtml(option.target)}"`)}
                </div>
              </article>
            `
  ).join("")}
      </div>
    </section>
  `;
}
function renderLedgerImpactSection(row) {
  const item = buildReplenishmentReviewItem(row);
  const result = row.review?.reviewResult || "\u5F85\u5BA1\u6838";
  const eventText = result === "\u9700\u8981\u8865\u6599" ? "\u9884\u7559\u8865\u6599\u9700\u6C42\u4E8B\u4EF6\uFF0C\u540E\u7EED\u56DE\u5230\u4E2D\u8F6C\u4ED3\u914D\u6599\u6216\u88C1\u5E8A\u9886\u6599\u540E\u518D\u8FDB\u5165\u6570\u91CF\u8D26\u3002" : result === "\u9700\u8981\u8865\u5F55" ? "\u9884\u7559\u8865\u5F55\u8C03\u6574\u4E8B\u4EF6\uFF0C\u7528\u4E8E\u4FEE\u6B63\u5B9E\u9645\u7528\u91CF\u3001\u88C1\u526A\u6570\u91CF\u6216\u9886\u6599\u8BB0\u5F55\u3002" : result === "\u7EE7\u7EED\u8865\u6392" ? "\u4E0D\u5F3A\u5236\u6539\u6570\u91CF\u8D26\uFF0C\u4FDD\u7559\u540E\u7EED\u53EF\u7528\u4F59\u989D\u5224\u65AD\u548C\u53EF\u6392\u551B\u67B6\u5165\u53E3\u3002" : result === "\u5173\u95ED\u88C1\u7247\u5355" ? "\u9884\u7559\u88C1\u7247\u5355\u5173\u95ED\u4E8B\u4EF6\uFF0C\u4E0D\u5220\u9664\u5386\u53F2\u6570\u91CF\u8D26\u3002" : result === "\u4EC5\u8BB0\u5F55\u5DEE\u5F02" ? "\u4E0D\u4EA7\u751F\u6570\u91CF\u8D26\u53D8\u66F4\u4E8B\u4EF6\uFF0C\u4EC5\u4FDD\u7559\u5DEE\u5F02\u8BB0\u5F55\u3002" : "\u5F85\u5BA1\u6838\u540E\u51B3\u5B9A\u662F\u5426\u751F\u6210\u6570\u91CF\u8D26\u4E8B\u4EF6\u3002";
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold text-foreground">\u6570\u91CF\u8D26\u5F71\u54CD</h3>
      <div class="mt-3 grid gap-3 md:grid-cols-3">
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">\u5904\u7406\u7ED3\u8BBA</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(result)}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">\u540E\u7EED\u52A8\u4F5C</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(item.nextAction || row.nextActionSummary)}</div>
        </article>
        <article class="rounded-lg border bg-muted/20 p-3">
          <div class="text-xs text-muted-foreground">\u6570\u91CF\u8D26\u4E8B\u4EF6</div>
          <div class="mt-1 font-medium text-foreground">${escapeHtml(item.linkedLedgerEventIds.join(" / ") || "\u65E0\u76F4\u63A5\u53D8\u66F4")}</div>
        </article>
      </div>
      <div class="mt-3 rounded-lg border border-dashed bg-muted/20 p-3 text-xs leading-5 text-muted-foreground">${escapeHtml(eventText)}</div>
    </section>
  `;
}
function renderAuditSection(row) {
  const audits = state.audits.filter((item) => item.suggestionId === row.suggestionId).sort((left, right) => right.actionAt.localeCompare(left.actionAt, "zh-CN"));
  const auditActionMeta = {
    SUGGESTED: { label: "\u751F\u6210\u5EFA\u8BAE", className: "bg-slate-100 text-slate-700" },
    APPROVED: { label: "\u5BA1\u6838\u901A\u8FC7", className: "bg-blue-100 text-blue-700" },
    REJECTED: { label: "\u5BA1\u6838\u9A73\u56DE", className: "bg-slate-200 text-slate-700" },
    MARKED_SUPPLEMENT: { label: "\u6807\u8BB0\u5F85\u8865\u5F55", className: "bg-orange-100 text-orange-700" },
    IMPACT_UPDATED: { label: "\u66F4\u65B0\u5F71\u54CD", className: "bg-violet-100 text-violet-700" },
    ACTION_CONFIRMED: { label: "\u786E\u8BA4\u52A8\u4F5C", className: "bg-blue-100 text-blue-700" },
    ACTION_SKIPPED: { label: "\u8DF3\u8FC7\u52A8\u4F5C", className: "bg-slate-100 text-slate-700" },
    ACTION_DONE: { label: "\u52A8\u4F5C\u5B8C\u6210", className: "bg-emerald-100 text-emerald-700" }
  };
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold text-foreground">\u5BA1\u8BA1\u8BB0\u5F55</h3>
      <div class="mt-3 space-y-2 text-xs text-muted-foreground">
        ${audits.map(
    (audit) => `
                <article class="rounded-lg border bg-muted/20 p-3">
                  <div class="flex items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                      ${renderTag(auditActionMeta[audit.action].label, auditActionMeta[audit.action].className)}
                      <span class="font-medium text-foreground">${escapeHtml(audit.payloadSummary)}</span>
                    </div>
                    <span>${escapeHtml(formatDateTime(audit.actionAt))}</span>
                  </div>
                  <div class="mt-1">${escapeHtml(`${audit.actionBy} \xB7 ${audit.note || "\u65E0\u8865\u5145\u8BF4\u660E"}`)}</div>
                </article>
              `
  ).join("") || '<div class="rounded-lg border border-dashed px-3 py-4 text-center">\u5F53\u524D\u6682\u65E0\u5BA1\u8BA1\u8BB0\u5F55\u3002</div>'}
      </div>
    </section>
  `;
}
function renderInlineDetail() {
  const row = getActiveRow();
  if (!row) return "";
  return `
    <section class="space-y-4 rounded-lg border bg-card p-4 text-sm" data-testid="cutting-replenishment-detail-page">
      <div class="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
        <div>
          <h2 class="text-lg font-semibold text-foreground">\u5DEE\u5F02\u5904\u7406\u8BE6\u60C5 \xB7 ${escapeHtml(row.suggestionNo)}</h2>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${row.sourceSummary} \xB7 ${row.differenceTypeSummary}`)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50" data-cutting-replenish-action="submit-review" ${canReviewReplenishment(resolveFcsDemoRole("CUTTING_LEAD")) ? "" : `title="${ACTION_PERMISSION_DENIED_TEXT}" disabled`}>\u63D0\u4EA4\u5BA1\u6838</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-material-prep" data-suggestion-id="${escapeHtml(row.suggestionId)}">\u53BB\u5F85\u52A0\u5DE5\u4ED3</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-related" data-target-key="cuttablePool" data-suggestion-id="${escapeHtml(row.suggestionId)}">\u53BB\u53EF\u6392\u551B\u67B6\u88C1\u7247\u5355</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="go-cut-orders" data-suggestion-id="${escapeHtml(row.suggestionId)}">\u53BB\u88C1\u7247\u5355</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="close-overlay">\u8FD4\u56DE\u8865\u6599\u7BA1\u7406</button>
        </div>
      </div>
      ${renderEvidenceSection(row)}
      ${renderSpreadingDifferenceSection(row)}
      ${renderDifferenceSection(row)}
      ${renderSuggestionLineSection(row)}
      ${renderReviewSection(row)}
      ${renderActionsSection(row)}
      ${renderLedgerImpactSection(row)}
      ${renderAuditSection(row)}
    </section>
  `;
}
function renderPage() {
  syncPrefilterFromQuery();
  const pathname = appStore.getState().pathname;
  const meta = getCanonicalCuttingMeta(pathname, "replenishment");
  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, { actionsHtml: renderHeaderActions() })}
      ${renderStats()}
      ${renderWorkbenchTabs()}
      ${renderFeedbackBar()}
      ${renderPrefilterBar()}
      ${renderFilterBar()}
      ${renderTable(getFilteredRows())}
    </div>
  `;
}
function renderDetailPage() {
  syncPrefilterFromQuery();
  const params = getWarehouseSearchParams();
  const suggestionId = params.get("suggestionId") || params.get("replenishmentId") || state.activeSuggestionId;
  const rows = buildViewModel().rows;
  const row = rows.find((item) => item.suggestionId === suggestionId) || rows[0] || null;
  state.activeSuggestionId = row?.suggestionId || null;
  if (row) syncReviewDraft(row);
  const meta = {
    ...getCanonicalCuttingMeta("/fcs/craft/cutting/replenishment", "replenishment"),
    pageTitle: "\u8865\u6599\u8BE6\u60C5"
  };
  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
    actionsHtml: '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-cutting-replenish-action="close-overlay">\u8FD4\u56DE\u8865\u6599\u7BA1\u7406</button>'
  })}
      ${renderFeedbackBar()}
      ${row ? renderInlineDetail() : '<section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">\u672A\u627E\u5230\u5DEE\u5F02\u5904\u7406\u8BE6\u60C5\u3002</section>'}
    </div>
  `;
}
function navigateBySuggestion(suggestionId, target) {
  if (!suggestionId) return false;
  const row = buildViewModel().rowsById[suggestionId];
  if (!row) return false;
  const payload = target === "spreadingList" ? row.navigationPayload.markerSpreading : row.navigationPayload[target];
  const context = buildCuttingDrillContext(payload, "replenishment", {
    productionOrderNo: row.productionOrderNos[0] || void 0,
    cutOrderNo: row.cutOrderNos[0] || void 0,
    markerPlanNo: row.markerPlanNo || void 0,
    materialSku: row.materialSku,
    suggestionId: row.suggestionId,
    suggestionNo: row.suggestionNo,
    autoOpenDetail: true
  });
  appStore.navigate(
    buildCuttingRouteWithContext(target === "spreadingList" ? "spreadingList" : target, context)
  );
  return true;
}
function navigateByAction(actionId) {
  const matched = getFollowupActionById(actionId);
  if (!matched) return false;
  const context = buildCuttingDrillContext(matched.action.targetQuery, "replenishment", {
    productionOrderNo: matched.row.productionOrderNos[0] || void 0,
    cutOrderNo: matched.row.cutOrderNos[0] || void 0,
    markerPlanNo: matched.row.markerPlanNo || void 0,
    materialSku: matched.row.materialSku,
    suggestionId: matched.row.suggestionId,
    suggestionNo: matched.row.suggestionNo,
    autoOpenDetail: true
  });
  appStore.navigate(buildCuttingRouteWithContext(matched.action.targetPageKey, context));
  return true;
}
function updateFollowupActionStatus(options) {
  const matched = getFollowupActionById(options.actionId);
  if (!matched) return false;
  if (matched.row.review?.reviewStatus !== "APPROVED") {
    setFeedback("warning", "\u8BF7\u5148\u5BA1\u6838\u901A\u8FC7\uFF0C\u518D\u5904\u7406\u540E\u7EED\u52A8\u4F5C\u3002");
    return true;
  }
  const now = nowText();
  const nextAction = {
    ...matched.action,
    status: options.nextStatus,
    note: matched.action.note,
    decidedAt: ["CONFIRMED", "SKIPPED", "DONE"].includes(options.nextStatus) ? matched.action.decidedAt || now : matched.action.decidedAt,
    decidedBy: ["CONFIRMED", "SKIPPED", "DONE"].includes(options.nextStatus) ? matched.action.decidedBy || options.actor : matched.action.decidedBy,
    completedAt: options.nextStatus === "DONE" ? now : "",
    completedBy: options.nextStatus === "DONE" ? options.actor : ""
  };
  upsertFollowupAction(nextAction);
  prependAudit(
    buildReplenishmentAuditTrail({
      suggestion: matched.row,
      action: options.auditAction,
      actionBy: options.actor,
      payloadSummary: `${matched.row.suggestionNo} \xB7 ${matched.action.title} \u5DF2\u66F4\u65B0\u4E3A ${replenishmentFollowupActionStatusMetaMap[options.nextStatus].label}`,
      note: nextAction.note,
      actionAt: now
    })
  );
  persistStore();
  setFeedback("success", options.successMessage);
  return true;
}
function renderCraftCuttingReplenishmentPage() {
  return renderPage();
}
function renderCraftCuttingReplenishmentDetailPage() {
  return renderDetailPage();
}
function handleCraftCuttingReplenishmentEvent(target) {
  const filterFieldNode = target.closest("[data-cutting-replenish-field]");
  if (filterFieldNode) {
    const field = filterFieldNode.dataset.cuttingReplenishField;
    if (!field) return false;
    state.filters = {
      ...state.filters,
      [field]: filterFieldNode.value
    };
    return true;
  }
  const reviewFieldNode = target.closest("[data-cutting-replenish-review-field]");
  if (reviewFieldNode) {
    const field = reviewFieldNode.dataset.cuttingReplenishReviewField;
    if (!field) return false;
    if (field === "result") {
      const result = reviewFieldNode.value;
      state.reviewDraft.result = result;
      state.reviewDraft.status = resolveReviewStatusFromResult(result);
      if (result === "\u9700\u8981\u8865\u5F55" && !state.reviewDraft.reason) state.reviewDraft.reason = "\u8865\u9F50\u94FA\u5E03\u6216\u88C1\u526A\u5B9E\u9645\u6570\u636E\u540E\u518D\u5224\u65AD\u3002";
      return true;
    }
    if (field === "status") state.reviewDraft.status = reviewFieldNode.value;
    if (field === "reason") state.reviewDraft.reason = reviewFieldNode.value;
    if (field === "note") state.reviewDraft.note = reviewFieldNode.value;
    if (field === "closeReasonCode") state.reviewDraft.closeReasonCode = reviewFieldNode.value;
    if (field === "closeReason") state.reviewDraft.closeReason = reviewFieldNode.value;
    return true;
  }
  const actionNode = target.closest("[data-cutting-replenish-action]");
  const action = actionNode?.dataset.cuttingReplenishAction;
  if (!action) return false;
  clearFeedback();
  if (action === "open-detail" || action === "open-review" || action === "open-actions") {
    const suggestionId = actionNode.dataset.suggestionId;
    if (!suggestionId) return false;
    state.activeSuggestionId = suggestionId;
    syncReviewDraft(buildViewModel().rowsById[suggestionId] || null);
    appStore.navigate(`${getCanonicalCuttingPath("replenishment")}-detail?suggestionId=${encodeURIComponent(suggestionId)}`);
    return true;
  }
  if (action === "close-overlay") {
    state.activeSuggestionId = null;
    appStore.navigate(getCanonicalCuttingPath("replenishment"));
    return true;
  }
  if (action === "set-tab") {
    const tabKey = actionNode.dataset.tabKey;
    if (!tabKey) return false;
    state.activeTab = tabKey;
    return true;
  }
  if (action === "clear-prefilter") {
    state.prefilter = null;
    state.drillContext = null;
    state.activeSuggestionId = null;
    state.querySignature = getCanonicalCuttingPath("replenishment");
    appStore.navigate(getCanonicalCuttingPath("replenishment"));
    return true;
  }
  if (action === "clear-filters") {
    state.filters = { ...initialFilters };
    return true;
  }
  if (action === "toggle-pending-review") {
    state.filters.pendingReviewOnly = !state.filters.pendingReviewOnly;
    return true;
  }
  if (action === "toggle-pending-action") {
    state.filters.pendingActionOnly = !state.filters.pendingActionOnly;
    return true;
  }
  if (action === "submit-review") {
    if (!canReviewReplenishment(resolveFcsDemoRole("CUTTING_LEAD"))) {
      setFeedback("warning", ACTION_PERMISSION_DENIED_TEXT);
      return true;
    }
    const row = getActiveRow();
    if (!row) return false;
    const validation = validateReplenishmentReviewAction({
      suggestion: row,
      reviewStatus: resolveReviewStatusFromResult(state.reviewDraft.result),
      reviewResult: state.reviewDraft.result,
      decisionReason: state.reviewDraft.reason,
      closeReason: state.reviewDraft.closeReason
    });
    if (!validation.ok) {
      setFeedback("warning", validation.message);
      return true;
    }
    const reviewedAt = nowText();
    const reviewStatus = resolveReviewStatusFromResult(state.reviewDraft.result);
    const review = {
      reviewId: `review-${row.suggestionId}`,
      suggestionId: row.suggestionId,
      reviewStatus,
      reviewResult: state.reviewDraft.result,
      nextAction: resolveNextActionFromReviewResult(state.reviewDraft.result),
      closeReasonCode: state.reviewDraft.result === "\u5173\u95ED\u88C1\u7247\u5355" ? state.reviewDraft.closeReasonCode : void 0,
      closeReason: state.reviewDraft.result === "\u5173\u95ED\u88C1\u7247\u5355" ? state.reviewDraft.closeReason.trim() : "",
      linkedLedgerEventIds: row.linkedLedgerEventIds,
      reviewedBy: "\u8865\u6599\u5BA1\u6838\u5458 \u5F90\u6D77\u5B81",
      reviewedAt,
      decisionReason: state.reviewDraft.reason.trim(),
      note: state.reviewDraft.note.trim()
    };
    const followupAction = buildReplenishmentFollowupActionForResult({
      suggestion: row,
      navigationPayload: row.navigationPayload,
      result: review.reviewResult || "\u4EC5\u8BB0\u5F55\u5DEE\u5F02",
      decidedAt: review.reviewedAt,
      decidedBy: review.reviewedBy
    });
    upsertReview(review);
    replaceFollowupActions(row.suggestionId, followupAction ? [followupAction] : []);
    replacePendingPrepFollowups(row.suggestionId, review.reviewResult === "\u9700\u8981\u8865\u6599" ? buildPendingPrepFollowupRecords(row, review) : []);
    syncSpreadingReplenishmentHandledState(row, Boolean(review.reviewResult));
    closeCutOrdersForReview(row, review);
    prependAudit(
      buildReplenishmentAuditTrail({
        suggestion: row,
        action: review.reviewResult === "\u9700\u8981\u8865\u6599" || review.reviewResult === "\u7EE7\u7EED\u8865\u6392" || review.reviewResult === "\u5173\u95ED\u88C1\u7247\u5355" || review.reviewResult === "\u4EC5\u8BB0\u5F55\u5DEE\u5F02" ? "APPROVED" : "MARKED_SUPPLEMENT",
        actionBy: review.reviewedBy,
        payloadSummary: `${row.suggestionNo} \u5DF2\u66F4\u65B0\u4E3A ${review.reviewResult || "\u5F85\u5224\u65AD"}\uFF0C\u540E\u7EED\u52A8\u4F5C\uFF1A${review.nextAction || "\u65E0\u540E\u7EED\u52A8\u4F5C"}`,
        note: review.decisionReason || review.note
      })
    );
    persistStore();
    setFeedback(
      "success",
      review.reviewResult === "\u5173\u95ED\u88C1\u7247\u5355" ? "\u5DF2\u5173\u95ED\u88C1\u7247\u5355\u5E76\u8BB0\u5F55\u5173\u95ED\u539F\u56E0\uFF1B\u8BE5\u88C1\u7247\u5355\u4E0D\u4F1A\u8FDB\u5165\u53EF\u6392\u551B\u67B6\u3002" : `\u5DF2\u66F4\u65B0 ${row.suggestionNo} \u7684\u5904\u7406\u7ED3\u679C\uFF1A${review.reviewResult}\u3002`
    );
    return true;
  }
  if (action === "confirm-followup") {
    return updateFollowupActionStatus({
      actionId: actionNode.dataset.actionId,
      nextStatus: "CONFIRMED",
      auditAction: "ACTION_CONFIRMED",
      actor: "\u8865\u6599\u4E13\u5458 \u5B8B\u5B89\u742A",
      successMessage: "\u5DF2\u786E\u8BA4\u540E\u7EED\u52A8\u4F5C\u3002"
    });
  }
  if (action === "skip-followup") {
    return updateFollowupActionStatus({
      actionId: actionNode.dataset.actionId,
      nextStatus: "SKIPPED",
      auditAction: "ACTION_SKIPPED",
      actor: "\u8865\u6599\u4E13\u5458 \u5B8B\u5B89\u742A",
      successMessage: "\u5DF2\u8DF3\u8FC7\u8BE5\u540E\u7EED\u52A8\u4F5C\u3002"
    });
  }
  if (action === "complete-followup") {
    return updateFollowupActionStatus({
      actionId: actionNode.dataset.actionId,
      nextStatus: "DONE",
      auditAction: "ACTION_DONE",
      actor: "\u8865\u6599\u4E13\u5458 \u5B8B\u5B89\u742A",
      successMessage: "\u5DF2\u6807\u8BB0\u540E\u7EED\u52A8\u4F5C\u5B8C\u6210\u3002"
    });
  }
  if (action === "go-followup-target") {
    return navigateByAction(actionNode.dataset.actionId);
  }
  if (action === "go-related") {
    const targetKey = actionNode.dataset.targetKey || "materialPrep";
    return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || void 0, targetKey);
  }
  if (action === "go-marker") return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || void 0, "spreadingList");
  if (action === "go-material-prep") return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || void 0, "materialPrep");
  if (action === "go-cut-orders") return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || void 0, "cutOrders");
  if (action === "go-marker-plan") return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || void 0, "markerPlanRefs");
  if (action === "go-summary") return navigateBySuggestion(actionNode.dataset.suggestionId || state.activeSuggestionId || void 0, "summary");
  if (action === "go-marker-index") {
    appStore.navigate(getCanonicalCuttingPath("spreading-list"));
    return true;
  }
  if (action === "go-cut-order-index") {
    appStore.navigate(getCanonicalCuttingPath("cut-orders"));
    return true;
  }
  if (action === "go-summary-index") {
    appStore.navigate(getCanonicalCuttingPath("summary"));
    return true;
  }
  if (action === "return-summary") {
    const context = buildReturnToSummaryContext(state.drillContext);
    if (!context) return false;
    appStore.navigate(buildCuttingRouteWithContext("summary", context));
    return true;
  }
  return false;
}
function isCraftCuttingReplenishmentDialogOpen() {
  return state.activeSuggestionId !== null;
}
export {
  handleCraftCuttingReplenishmentEvent,
  isCraftCuttingReplenishmentDialogOpen,
  renderCraftCuttingReplenishmentDetailPage,
  renderCraftCuttingReplenishmentPage
};
