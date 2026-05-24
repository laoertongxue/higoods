import { escapeHtml } from "../utils";
import { buildPdaCuttingReplenishmentProjection } from "./pda-cutting-replenishment-projection";
import {
  buildPdaCuttingWritebackSource,
  resolvePdaCuttingWritebackIdentity,
  resolvePdaCuttingWritebackOperator
} from "../data/fcs/pda-cutting-writeback-inputs.ts";
import { writePdaReplenishmentFeedbackToFcs } from "../domain/cutting-pda-writeback/bridge.ts";
import {
  buildPdaCuttingExecutionStateKey,
  renderPdaCuttingEmptyState,
  renderPdaCuttingExecutionHero,
  renderPdaCuttingFeedbackNotice,
  renderPdaCuttingOrderSelectionPrompt,
  renderPdaCuttingPageLayout,
  renderPdaCuttingSection,
  renderPdaCuttingSummaryGrid
} from "./pda-cutting-shared";
import {
  buildPdaCuttingExecutionContext,
  readSelectedExecutionOrderIdFromLocation,
  readSelectedExecutionOrderNoFromLocation
} from "./pda-cutting-context";
import { buildPdaCuttingCompletedReturnHref } from "./pda-cutting-nav-context";
const feedbackState = /* @__PURE__ */ new Map();
function getReplenishmentDetail(taskId, executionKey) {
  return buildPdaCuttingReplenishmentProjection(taskId, executionKey ?? void 0);
}
function getState(taskId, executionOrderId, executionOrderNo) {
  const stateKey = buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo);
  const existing = feedbackState.get(stateKey);
  if (existing) return existing;
  const detail = getReplenishmentDetail(taskId, executionOrderId ?? executionOrderNo ?? void 0);
  const initial = {
    operatorName: detail?.latestFeedbackBy && detail.latestFeedbackBy !== "-" ? detail.latestFeedbackBy : "\u73B0\u573A\u53CD\u9988\u4EBA",
    differenceType: detail?.latestFeedbackReason && detail.latestFeedbackReason !== "-" ? detail.latestFeedbackReason : "\u9762\u6599\u4F59\u989D\u4E0D\u8DB3",
    differenceQty: "0",
    unit: "\u7C73",
    note: detail?.latestFeedbackNote && detail.latestFeedbackNote !== "-" ? detail.latestFeedbackNote : "",
    photoProofCount: String(detail?.photoProofCount ?? 0),
    feedbackMessage: "",
    syncStatus: "\u5F85\u63D0\u4EA4",
    backHrefOverride: ""
  };
  feedbackState.set(stateKey, initial);
  return initial;
}
function resolveFeedbackSelection(taskId) {
  const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation();
  const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation();
  if (selectedExecutionOrderId || selectedExecutionOrderNo) {
    return { selectedExecutionOrderId, selectedExecutionOrderNo };
  }
  const context = buildPdaCuttingExecutionContext(taskId, "replenishment-feedback");
  return {
    selectedExecutionOrderId: context.selectedExecutionOrderId,
    selectedExecutionOrderNo: context.selectedExecutionOrderNo
  };
}
function renderFeedbackHistory(detail) {
  if (!detail || !detail.replenishmentFeedbacks.length) {
    return renderPdaCuttingEmptyState("\u5F53\u524D\u88C1\u7247\u5355\u6682\u65E0\u73B0\u573A\u5DEE\u5F02\u53CD\u9988\u8BB0\u5F55", "");
  }
  return `
    <div class="space-y-2">
      ${detail.replenishmentFeedbacks.map(
    (item) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium text-foreground">${escapeHtml(item.id)} / ${escapeHtml(item.reasonLabel)}</div>
                <div class="text-muted-foreground">${escapeHtml(item.feedbackAt)}</div>
              </div>
              <div class="mt-2 text-muted-foreground">\u53CD\u9988\u4EBA\uFF1A${escapeHtml(item.operatorName)}</div>
              <div class="mt-1 text-muted-foreground">\u53CD\u9988\u8BB0\u5F55\uFF1A${escapeHtml(item.note || "\u65E0")}</div>
              <div class="mt-1 text-muted-foreground">\u7167\u7247 / \u51ED\u8BC1\uFF1A${escapeHtml(String(item.photoProofCount))} \u4E2A</div>
            </article>
          `
  ).join("")}
    </div>
  `;
}
function renderFeedbackStatus(detail) {
  return renderPdaCuttingSummaryGrid([
    { label: "\u5F53\u524D\u5DEE\u5F02\u60C5\u51B5", value: detail.replenishmentRiskSummary },
    { label: "\u6700\u8FD1\u53CD\u9988\u65F6\u95F4", value: detail.latestFeedbackAt, hint: detail.latestFeedbackBy },
    { label: "\u6700\u8FD1\u53CD\u9988\u539F\u56E0", value: detail.latestFeedbackReason || "\u6682\u65E0\u53CD\u9988" },
    { label: "\u51ED\u8BC1\u6570\u91CF", value: `${detail.photoProofCount} \u4E2A` }
  ]);
}
function renderPdaCuttingReplenishmentFeedbackPage(taskId) {
  const context = buildPdaCuttingExecutionContext(taskId, "replenishment-feedback");
  const detail = context.detail;
  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: "\u73B0\u573A\u5DEE\u5F02\u53CD\u9988",
      subtitle: "",
      activeTab: "exec",
      body: "",
      backHref: context.backHref
    });
  }
  if (context.requiresCutPieceOrderSelection) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: "\u73B0\u573A\u5DEE\u5F02\u53CD\u9988",
      subtitle: "",
      activeTab: "exec",
      body: renderPdaCuttingOrderSelectionPrompt(detail, context.backHref, context.selectionNotice || void 0),
      backHref: context.backHref
    });
  }
  const form = getState(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo);
  const pageBackHref = form.backHrefOverride || context.backHref;
  const formSection = `
    <div class="space-y-3 text-xs" data-task-id="${escapeHtml(taskId)}">
      <div class="rounded-xl border border-dashed px-3 py-4 text-center">
        <div class="text-sm font-medium text-foreground">\u5F53\u524D\u5DEE\u5F02\u6458\u8981</div>
        <p class="mt-1 text-muted-foreground">${escapeHtml(detail.replenishmentRiskSummary)}</p>
      </div>
      <label class="block space-y-1">
        <span class="text-muted-foreground">\u53CD\u9988\u4EBA</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-replenishment-field="operatorName" value="${escapeHtml(form.operatorName)}" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">\u5DEE\u5F02\u7C7B\u578B</span>
        <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-replenishment-field="reasonLabel">
          ${["\u9886\u6599\u5DEE\u5F02", "\u5B9E\u94FA\u5C0F\u4E8E\u8BA1\u5212", "\u5B9E\u88C1\u5C0F\u4E8E\u8BA1\u5212", "\u5B9E\u9645\u7528\u91CF\u5F02\u5E38", "\u9762\u6599\u4F59\u989D\u4E0D\u8DB3", "\u5377\u8BB0\u5F55\u5F02\u5E38", "\u5E03\u5934\u5E03\u5C3E\u5F02\u5E38", "\u73B0\u573A\u53CD\u9988"].map((item) => `<option value="${escapeHtml(item)}" ${form.differenceType === item ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}
        </select>
      </label>
      <div class="grid grid-cols-2 gap-2">
        <label class="block space-y-1">
          <span class="text-muted-foreground">\u5DEE\u5F02\u6570\u91CF</span>
          <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-replenishment-field="differenceQty" value="${escapeHtml(form.differenceQty)}" />
        </label>
        <label class="block space-y-1">
          <span class="text-muted-foreground">\u5355\u4F4D</span>
          <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-replenishment-field="unit">
            ${["\u7C73", "\u5C42", "\u4EF6", "\u5377", "\u9879"].map((item) => `<option value="${escapeHtml(item)}" ${form.unit === item ? "selected" : ""}>${escapeHtml(item)}</option>`).join("")}
          </select>
        </label>
      </div>
      <label class="block space-y-1">
        <span class="text-muted-foreground">\u73B0\u573A\u8BF4\u660E</span>
        <textarea class="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-cut-replenishment-field="note" placeholder="\u8BF7\u586B\u5199\u73B0\u573A\u5DEE\u5F02\u3001\u8BC1\u636E\u548C\u5EFA\u8BAE\u5904\u7406\u65B9\u5F0F">${escapeHtml(form.note)}</textarea>
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">\u7167\u7247 / \u51ED\u8BC1\u6570\u91CF</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-replenishment-field="photoProofCount" value="${escapeHtml(form.photoProofCount)}" />
      </label>
      <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">\u672C\u6B21\u53CD\u9988\u9884\u89C8</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(form.differenceType)}</div>
        <div class="mt-1 text-muted-foreground">\u5DEE\u5F02\u6570\u91CF\uFF1A${escapeHtml(form.differenceQty || "0")} ${escapeHtml(form.unit)}</div>
        <div class="mt-1 text-muted-foreground">\u73B0\u573A\u8BF4\u660E\uFF1A${escapeHtml(form.note || "\u5F85\u586B\u5199")}</div>
        <div class="mt-1 text-muted-foreground">\u7167\u7247 / \u51ED\u8BC1\uFF1A${escapeHtml(form.photoProofCount || "0")} \u4E2A</div>
        <div class="mt-1 text-muted-foreground">\u540C\u6B65\u72B6\u6001\uFF1A${escapeHtml(form.syncStatus)}</div>
      </div>
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, "success") : ""}
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}">
          \u8FD4\u56DE\u88C1\u7247\u4EFB\u52A1
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-replenishment-action="submit" data-task-id="${escapeHtml(taskId)}">
          \u63D0\u4EA4\u73B0\u573A\u5DEE\u5F02\u53CD\u9988
        </button>
      </div>
    </div>
  `;
  const body = `
    ${renderPdaCuttingExecutionHero("\u73B0\u573A\u5DEE\u5F02\u53CD\u9988", detail)}
    ${renderPdaCuttingSection("\u5F53\u524D\u60C5\u51B5", "", renderFeedbackStatus(detail))}
    ${renderPdaCuttingSection("\u73B0\u573A\u5DEE\u5F02\u53CD\u9988", "", formSection)}
    ${renderPdaCuttingSection("\u6700\u8FD1\u53CD\u9988\u8BB0\u5F55", "", renderFeedbackHistory(detail))}
  `;
  return renderPdaCuttingPageLayout({
    taskId,
    title: "\u73B0\u573A\u5DEE\u5F02\u53CD\u9988",
    subtitle: "",
    activeTab: "exec",
    body,
    backHref: pageBackHref
  });
}
function handlePdaCuttingReplenishmentFeedbackEvent(target) {
  const fieldNode = target.closest("[data-pda-cut-replenishment-field]");
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement || fieldNode instanceof HTMLTextAreaElement) {
    const taskId2 = fieldNode.closest("[data-task-id]")?.dataset.taskId || appTaskIdFromPath();
    if (!taskId2) return true;
    const { selectedExecutionOrderId: selectedExecutionOrderId2, selectedExecutionOrderNo: selectedExecutionOrderNo2 } = resolveFeedbackSelection(taskId2);
    const form = getState(taskId2, selectedExecutionOrderId2, selectedExecutionOrderNo2);
    const field = fieldNode.dataset.pdaCutReplenishmentField;
    if (!field) return true;
    if (field === "operatorName") form.operatorName = fieldNode.value;
    if (field === "reasonLabel") form.differenceType = fieldNode.value;
    if (field === "differenceQty") form.differenceQty = fieldNode.value;
    if (field === "unit") form.unit = fieldNode.value;
    if (field === "note") form.note = fieldNode.value;
    if (field === "photoProofCount") form.photoProofCount = fieldNode.value;
    return true;
  }
  const actionNode = target.closest("[data-pda-cut-replenishment-action]");
  if (!actionNode) return false;
  const action = actionNode.dataset.pdaCutReplenishmentAction;
  const taskId = actionNode.dataset.taskId;
  if (!action || !taskId) return false;
  const { selectedExecutionOrderId, selectedExecutionOrderNo } = resolveFeedbackSelection(taskId);
  if (action === "submit") {
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo);
    const context = buildPdaCuttingExecutionContext(taskId, "replenishment-feedback");
    const identity = resolvePdaCuttingWritebackIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || void 0,
      executionOrderNo: context.selectedExecutionOrderNo || void 0,
      cutOrderId: context.selectedExecutionOrder?.cutOrderId || void 0,
      cutOrderNo: context.selectedExecutionOrder?.cutOrderNo || void 0,
      markerPlanId: context.selectedExecutionOrder?.markerPlanId || void 0,
      markerPlanNo: context.selectedExecutionOrder?.markerPlanNo || void 0,
      materialSku: context.selectedExecutionOrder?.materialSku || void 0
    });
    const operator = resolvePdaCuttingWritebackOperator(taskId, form.operatorName.trim() || "\u73B0\u573A\u53CD\u9988\u4EBA");
    if (!identity || !operator) {
      form.feedbackMessage = "\u5F53\u524D\u6267\u884C\u5BF9\u8C61\u6216\u64CD\u4F5C\u4EBA\u65E0\u6CD5\u8BC6\u522B\uFF0C\u4E0D\u80FD\u63D0\u4EA4\u73B0\u573A\u5DEE\u5F02\u53CD\u9988\u3002";
      return true;
    }
    const result = writePdaReplenishmentFeedbackToFcs({
      identity,
      operator,
      source: buildPdaCuttingWritebackSource("replenishment-feedback", identity.executionOrderId),
      reasonLabel: form.differenceType,
      note: `${form.note.trim() || "\u73B0\u573A\u5DF2\u8BB0\u5F55\u5DEE\u5F02\uFF0C\u5F85\u8865\u6599\u7BA1\u7406\u5BA1\u6838"}\uFF1B\u5DEE\u5F02\u6570\u91CF ${form.differenceQty || "0"} ${form.unit}`,
      photoProofCount: Number(form.photoProofCount || "0") || 0
    });
    if (!result.success) {
      form.feedbackMessage = result.issues.join("\uFF1B");
      form.syncStatus = "\u540C\u6B65\u5931\u8D25";
      return true;
    }
    form.feedbackMessage = "\u73B0\u573A\u5DEE\u5F02\u53CD\u9988\u5DF2\u63D0\u4EA4\uFF0C\u5DF2\u8FDB\u5165\u8865\u6599\u7BA1\u7406\u3002";
    form.syncStatus = "\u5DF2\u540C\u6B65";
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      context.selectedExecutionOrderId,
      context.selectedExecutionOrderNo,
      context.navContext,
      "replenishment-feedback"
    );
    return true;
  }
  return false;
}
function appTaskIdFromPath() {
  if (typeof window === "undefined") return "";
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/replenishment-feedback\/([^/]+)/);
  return matched?.[1] ?? "";
}
export {
  handlePdaCuttingReplenishmentFeedbackEvent,
  renderPdaCuttingReplenishmentFeedbackPage
};
