import { escapeHtml } from "../utils";
import {
  buildHandoverPickingTaskProjectionFromAllocationProjection,
  buildSewingTaskAllocationProjectionFromInventory
} from "../data/fcs/cutting/sewing-dispatch.ts";
import { buildPdaUniversalHandoverRecordDraft } from "../data/fcs/cutting/handover-orders.ts";
import { buildPdaCuttingHandoverProjection } from "./pda-cutting-handover-projection";
import {
  buildInboundTempBagInventoryRecords,
  buildInboundTempBagsFromTransferBagViewModel
} from "./process-factory/cutting/transfer-bags-model.ts";
import { buildTransferBagsProjection } from "./process-factory/cutting/transfer-bags-projection.ts";
import {
  buildPdaCuttingWritebackSource,
  resolvePdaCuttingWritebackIdentity,
  resolvePdaCuttingWritebackOperator
} from "../data/fcs/pda-cutting-writeback-inputs.ts";
import { writePdaHandoverToFcs } from "../domain/cutting-pda-writeback/bridge.ts";
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
const handoverState = /* @__PURE__ */ new Map();
function getHandoverDetail(taskId, executionKey) {
  return buildPdaCuttingHandoverProjection(taskId, executionKey ?? void 0);
}
function getState(taskId, executionOrderId, executionOrderNo) {
  const stateKey = buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo);
  const existing = handoverState.get(stateKey);
  if (existing) return existing;
  const detail = getHandoverDetail(taskId, executionOrderId ?? executionOrderNo ?? void 0);
  const initial = {
    operatorName: "\u4EA4\u51FA\u64CD\u4F5C\u5458",
    targetLabel: detail?.handoverTargetLabel && detail.handoverTargetLabel !== "\u5F85\u786E\u5B9A\u540E\u9053\u53BB\u5411" ? detail.handoverTargetLabel : "\u88C1\u7247\u4ED3\u4EA4\u51FA\u4F4D",
    note: "",
    feedbackMessage: "",
    backHrefOverride: ""
  };
  handoverState.set(stateKey, initial);
  return initial;
}
function renderHandoverHistory(detail) {
  if (!detail || !detail.handoverRecords.length) {
    return renderPdaCuttingEmptyState("\u5F53\u524D\u88C1\u7247\u5355\u6682\u65E0\u4EA4\u51FA\u8BB0\u5F55", "");
  }
  return `
    <div class="space-y-2">
      ${detail.handoverRecords.map(
    (record) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium text-foreground">${escapeHtml(record.id)} / ${escapeHtml(record.resultLabel)}</div>
                <div class="text-muted-foreground">${escapeHtml(record.handoverAt)}</div>
              </div>
              <div class="mt-2 text-muted-foreground">\u4EA4\u51FA\u5BF9\u8C61\uFF1A${escapeHtml(record.targetLabel)}</div>
              <div class="mt-1 text-muted-foreground">\u64CD\u4F5C\u4EBA\uFF1A${escapeHtml(record.operatorName)}</div>
              <div class="mt-1 text-muted-foreground">\u5907\u6CE8\uFF1A${escapeHtml(record.note || "\u65E0")}</div>
            </article>
          `
  ).join("")}
    </div>
  `;
}
function renderHandoverStatus(detail) {
  return renderPdaCuttingSummaryGrid([
    { label: "\u5F53\u524D\u4EA4\u51FA\u72B6\u6001", value: detail.currentHandoverStatus },
    { label: "\u5F53\u524D\u4EA4\u51FA\u5BF9\u8C61", value: detail.handoverTargetLabel },
    { label: "\u6700\u8FD1\u4EA4\u51FA\u8BB0\u5F55", value: detail.latestHandoverRecordNo || "\u6682\u65E0\u8BB0\u5F55" },
    { label: "\u6700\u8FD1\u4EA4\u51FA\u65F6\u95F4", value: detail.latestHandoverAt, hint: detail.latestHandoverBy }
  ]);
}
function buildPdaHandoverPickingProjection() {
  const transferBagViewModel = buildTransferBagsProjection().viewModel;
  const inboundTempBags = buildInboundTempBagsFromTransferBagViewModel(transferBagViewModel);
  const inboundInventoryRecords = buildInboundTempBagInventoryRecords(inboundTempBags);
  const allocationProjection = buildSewingTaskAllocationProjectionFromInventory(inboundInventoryRecords);
  return buildHandoverPickingTaskProjectionFromAllocationProjection(allocationProjection);
}
function renderPdaPickingFlow(projection) {
  const task = projection.tasks[0];
  if (!task) return renderPdaCuttingEmptyState("\u6682\u65E0\u5F85\u4EA4\u51FA\u4ED3\u88C1\u7247\u914D\u6599\u4EFB\u52A1", "");
  const pickedQty = task.pickedItems.reduce((total, item) => total + item.pickedQty, 0);
  const shortageLabel = task.shortageItems.slice(0, 2).map((item) => `${item.size}/${item.partName}\u7F3A${item.shortageQty}\u7247`).join("\uFF1B") || "\u6682\u65E0\u7F3A\u53E3";
  const failedSync = projection.scanChecks.find((check) => check.syncStatus === "\u540C\u6B65\u5931\u8D25");
  const scanChecks = projection.scanChecks.filter((check) => check.pickingTaskNo === task.pickingTaskNo).slice(0, 5);
  return `
    <div class="space-y-3 text-xs">
      <div class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="text-muted-foreground">\u5F53\u524D\u4EFB\u52A1</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(task.pickingTaskNo)}</div>
        <div class="mt-1 text-muted-foreground">\u8F66\u7F1D\u4EFB\u52A1\uFF1A${escapeHtml(task.sewingTaskNo)}</div>
        <div class="mt-1 text-muted-foreground">\u6765\u6E90\u888B\uFF1A${escapeHtml(task.tempBagSources.map((item) => item.tempBagCode).join("\u3001") || "\u5F85\u626B\u63CF")}</div>
        <div class="mt-1 text-muted-foreground">\u76EE\u6807\u888B\uFF1A${escapeHtml(task.targetTransferBags.map((bag) => bag.bagCode).join("\u3001") || "\u5F85\u626B\u63CF")}</div>
      </div>
      ${renderPdaCuttingSummaryGrid([
    { label: "\u5DF2\u626B\u83F2\u7968", value: `${task.pickedItems.length}/${task.allocatedInventoryItems.length} \u5F20` },
    { label: "\u5DF2\u626B\u6570\u91CF", value: `${pickedQty} \u7247` },
    { label: "\u7F3A\u53E3\u63D0\u793A", value: shortageLabel },
    { label: "\u540C\u6B65\u72B6\u6001", value: failedSync ? "\u540C\u6B65\u5931\u8D25" : "\u5DF2\u540C\u6B65", hint: failedSync?.reason || "\u6700\u8FD1\u63D0\u4EA4\u5DF2\u540C\u6B65" }
  ])}
      <div class="rounded-xl border px-3 py-3">
        <div class="font-medium text-foreground">\u626B\u7801\u987A\u5E8F</div>
        <div class="mt-2 grid grid-cols-2 gap-2 text-muted-foreground">
          <div>1. \u626B\u914D\u6599\u4EFB\u52A1\u7801</div>
          <div>2. \u626B\u6765\u6E90\u5165\u4ED3\u6682\u5B58\u888B</div>
          <div>3. \u626B\u83F2\u7968</div>
          <div>4. \u626B\u76EE\u6807\u4E2D\u8F6C\u888B</div>
        </div>
      </div>
      <div class="space-y-1">
        ${scanChecks.map((check) => `
            <div class="rounded-xl border px-3 py-2">
              <div class="font-medium text-foreground">${escapeHtml(check.scanObject)}\uFF1A${escapeHtml(check.scannedValue)}</div>
              <div class="mt-1 text-muted-foreground">${escapeHtml(check.checkResult)} / ${escapeHtml(check.reason)} / \u540C\u6B65\uFF1A${escapeHtml(check.syncStatus)}</div>
            </div>
          `).join("")}
      </div>
      <button class="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
        \u786E\u8BA4\u88C5\u888B
      </button>
      <button class="inline-flex min-h-9 w-full items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
        \u4E0A\u62A5\u5F02\u5E38
      </button>
    </div>
  `;
}
function renderPdaCuttingHandoverPage(taskId) {
  const context = buildPdaCuttingExecutionContext(taskId, "handover");
  const detail = context.detail;
  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: "\u4EA4\u51FA\u8BB0\u5F55\u626B\u7801",
      subtitle: "",
      activeTab: "handover",
      body: "",
      backHref: context.backHref
    });
  }
  if (context.requiresCutPieceOrderSelection) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: "\u4EA4\u51FA\u8BB0\u5F55\u626B\u7801",
      subtitle: "",
      activeTab: "handover",
      body: renderPdaCuttingOrderSelectionPrompt(detail, context.backHref, context.selectionNotice || void 0),
      backHref: context.backHref
    });
  }
  const form = getState(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo);
  const pageBackHref = form.backHrefOverride || context.backHref;
  const universalDraft = buildPdaUniversalHandoverRecordDraft();
  const specialCraftDraft = buildPdaUniversalHandoverRecordDraft("HO-CUT-AUX-260324-001");
  const confirmSection = `
    <div class="space-y-3 text-xs" data-task-id="${escapeHtml(taskId)}">
      <div class="rounded-xl border bg-muted/20 px-3 py-3">
        <div class="text-muted-foreground">\u901A\u7528\u4EA4\u51FA\u8BB0\u5F55</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(universalDraft.handoverOrderNo)} / \u7B2C ${universalDraft.nextRecordSequence} \u6B21\u4EA4\u51FA</div>
        <div class="mt-1 text-muted-foreground">\u63A5\u6536\u5BF9\u8C61\uFF1A${escapeHtml(universalDraft.receiverType)} ${escapeHtml(universalDraft.receiverName)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(universalDraft.modelHint)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(universalDraft.submitConditionText)}</div>
      </div>
      <label class="block space-y-1">
        <span class="text-muted-foreground">\u64CD\u4F5C\u4EBA</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-handover-field="operatorName" value="${escapeHtml(form.operatorName)}" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">\u4EA4\u51FA\u5BF9\u8C61</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-handover-field="targetLabel" value="${escapeHtml(form.targetLabel)}" placeholder="\u4F8B\u5982\uFF1A\u88C1\u7247\u4ED3\u4EA4\u51FA\u4F4D / \u540E\u9053\u5DE5\u4F4D" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">\u4EA4\u51FA\u5907\u6CE8</span>
        <textarea class="min-h-24 w-full rounded-xl border bg-background px-3 py-2 text-sm" data-pda-cut-handover-field="note" placeholder="\u586B\u5199\u4EA4\u51FA\u63D0\u9192\u3001\u540E\u7EED\u53BB\u5411\u548C\u5F02\u5E38\u8BB0\u5F55">${escapeHtml(form.note)}</textarea>
      </label>
      <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">\u672C\u6B21\u4EA4\u51FA\u9884\u89C8</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(form.targetLabel || "\u5F85\u586B\u5199\u4EA4\u51FA\u5BF9\u8C61")}</div>
        <div class="mt-1 text-muted-foreground">\u5F53\u524D\u4F4D\u7F6E\uFF1A${escapeHtml(detail.inboundZoneLabel)} / ${escapeHtml(detail.inboundLocationLabel)}</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(universalDraft.riskTips[0]?.tipText || "\u63D0\u4EA4\u540E\u6309\u4EA4\u51FA\u8BB0\u5F55\u5C55\u793A\u7D2F\u8BA1\u4EA4\u51FA\u3001\u4EA4\u51FA\u540E\u662F\u5426\u9F50\u5957\u548C\u7F3A\u53E3\u3002")}</div>
      </div>
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, "success") : ""}
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}">
          \u8FD4\u56DE\u88C1\u7247\u4EFB\u52A1
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-handover-action="confirm" data-task-id="${escapeHtml(taskId)}">
          \u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55
        </button>
      </div>
    </div>
  `;
  const specialCraftSection = `
    <div class="space-y-3 text-xs">
      <div class="rounded-xl border bg-violet-50 px-3 py-3 text-violet-900">
        <div class="font-medium">\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA\u626B\u7801</div>
        <div class="mt-1 text-sm font-semibold">${escapeHtml(specialCraftDraft.handoverOrderNo)} / \u7B2C ${specialCraftDraft.nextRecordSequence} \u6B21\u4EA4\u51FA</div>
        <div class="mt-1">\u63A5\u6536\u5BF9\u8C61\uFF1A${escapeHtml(specialCraftDraft.receiverType)} ${escapeHtml(specialCraftDraft.receiverName)}</div>
        <div class="mt-1">\u626B\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA\u5355 \u2192 \u626B\u4E2D\u8F6C\u888B \u2192 \u626B\u83F2\u7968 \u2192 \u786E\u8BA4\u4EA4\u51FA</div>
      </div>
      ${renderPdaCuttingSummaryGrid([
    { label: "\u672C\u6B21\u5DE5\u827A", value: "\u7EE3\u82B1" },
    { label: "\u627F\u63A5\u5DE5\u5382", value: specialCraftDraft.receiverName },
    { label: "\u540C\u6B65\u72B6\u6001", value: "\u5DF2\u540C\u6B65", hint: "\u63D0\u4EA4\u540E\u751F\u6210\u901A\u7528\u4EA4\u51FA\u8BB0\u5F55" },
    { label: "\u540E\u7EED\u56DE\u4ED3", value: "\u5F85\u56DE\u4ED3" }
  ])}
      <button class="inline-flex min-h-10 w-full items-center justify-center rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">
        \u786E\u8BA4\u4EA4\u51FA
      </button>
      <button class="inline-flex min-h-9 w-full items-center justify-center rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
        \u4E0A\u62A5\u5F02\u5E38
      </button>
    </div>
  `;
  const body = `
    ${renderPdaCuttingExecutionHero("\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55", detail)}
    ${renderPdaCuttingSection("\u5F53\u524D\u60C5\u51B5", "", renderHandoverStatus(detail))}
    ${renderPdaCuttingSection("\u5F85\u4EA4\u51FA\u4ED3\u88C1\u7247\u914D\u6599", "", renderPdaPickingFlow(buildPdaHandoverPickingProjection()))}
    ${renderPdaCuttingSection("\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA", "", specialCraftSection)}
    ${renderPdaCuttingSection("\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55", "", confirmSection)}
    ${renderPdaCuttingSection("\u6700\u8FD1\u4EA4\u51FA\u8BB0\u5F55", "", renderHandoverHistory(detail))}
  `;
  return renderPdaCuttingPageLayout({
    taskId,
    title: "\u4EA4\u51FA\u8BB0\u5F55\u626B\u7801",
    subtitle: "",
    activeTab: "handover",
    body,
    backHref: pageBackHref
  });
}
function handlePdaCuttingHandoverEvent(target) {
  const fieldNode = target.closest("[data-pda-cut-handover-field]");
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLTextAreaElement) {
    const taskId2 = fieldNode.closest("[data-task-id]")?.dataset.taskId || appTaskIdFromPath();
    if (!taskId2) return true;
    const selectedExecutionOrderId2 = readSelectedExecutionOrderIdFromLocation();
    const selectedExecutionOrderNo2 = readSelectedExecutionOrderNoFromLocation();
    const form = getState(taskId2, selectedExecutionOrderId2, selectedExecutionOrderNo2);
    const field = fieldNode.dataset.pdaCutHandoverField;
    if (!field) return true;
    if (field === "operatorName") form.operatorName = fieldNode.value;
    if (field === "targetLabel") form.targetLabel = fieldNode.value;
    if (field === "note") form.note = fieldNode.value;
    return true;
  }
  const actionNode = target.closest("[data-pda-cut-handover-action]");
  if (!actionNode) return false;
  const action = actionNode.dataset.pdaCutHandoverAction;
  const taskId = actionNode.dataset.taskId;
  if (!action || !taskId) return false;
  const selectedExecutionOrderId = readSelectedExecutionOrderIdFromLocation();
  const selectedExecutionOrderNo = readSelectedExecutionOrderNoFromLocation();
  if (action === "confirm") {
    const form = getState(taskId, selectedExecutionOrderId, selectedExecutionOrderNo);
    const context = buildPdaCuttingExecutionContext(taskId, "handover");
    const identity = resolvePdaCuttingWritebackIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || void 0,
      executionOrderNo: context.selectedExecutionOrderNo || void 0,
      cutOrderId: context.selectedExecutionOrder?.cutOrderId || void 0,
      cutOrderNo: context.selectedExecutionOrder?.cutOrderNo || void 0,
      markerPlanId: context.selectedExecutionOrder?.markerPlanId || void 0,
      markerPlanNo: context.selectedExecutionOrder?.markerPlanNo || void 0,
      materialSku: context.selectedExecutionOrder?.materialSku || void 0
    });
    const operator = resolvePdaCuttingWritebackOperator(taskId, form.operatorName.trim() || "\u4EA4\u51FA\u64CD\u4F5C\u5458");
    if (!identity || !operator) {
      form.feedbackMessage = "\u5F53\u524D\u6267\u884C\u5BF9\u8C61\u6216\u64CD\u4F5C\u4EBA\u65E0\u6CD5\u8BC6\u522B\uFF0C\u4E0D\u80FD\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55\u3002";
      return true;
    }
    const result = writePdaHandoverToFcs({
      identity,
      operator,
      source: buildPdaCuttingWritebackSource("handover", identity.executionOrderId),
      targetLabel: form.targetLabel.trim() || "\u88C1\u7247\u4ED3\u4EA4\u51FA\u4F4D",
      note: form.note.trim()
    });
    if (!result.success) {
      form.feedbackMessage = result.issues.join("\uFF1B");
      return true;
    }
    form.feedbackMessage = "\u4EA4\u51FA\u8BB0\u5F55\u5DF2\u63D0\u4EA4\u3002";
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      context.selectedExecutionOrderId,
      context.selectedExecutionOrderNo,
      context.navContext,
      "handover"
    );
    return true;
  }
  return false;
}
function appTaskIdFromPath() {
  if (typeof window === "undefined") return "";
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/handover\/([^/]+)/);
  return matched?.[1] ?? "";
}
export {
  handlePdaCuttingHandoverEvent,
  renderPdaCuttingHandoverPage
};
