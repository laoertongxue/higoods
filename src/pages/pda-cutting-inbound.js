import { escapeHtml } from "../utils";
import { buildPdaCuttingInboundProjection } from "./pda-cutting-inbound-projection";
import { buildTransferBagsProjection } from "./process-factory/cutting/transfer-bags-projection.ts";
import {
  getTransferBagTicketPrintStatusLabel
} from "./process-factory/cutting/transfer-bags-model.ts";
import {
  buildPdaCuttingWritebackSource,
  resolvePdaCuttingWritebackIdentity,
  resolvePdaCuttingWritebackOperator
} from "../data/fcs/pda-cutting-writeback-inputs.ts";
import { writePdaInboundToFcs } from "../domain/cutting-pda-writeback/bridge.ts";
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
const fallbackInboundState = /* @__PURE__ */ new Map();
function getInboundStateStore() {
  if (typeof window === "undefined") return fallbackInboundState;
  if (!window.__higoodPdaCuttingInboundState) {
    window.__higoodPdaCuttingInboundState = /* @__PURE__ */ new Map();
  }
  return window.__higoodPdaCuttingInboundState;
}
function getInboundDetail(taskId, executionKey) {
  return buildPdaCuttingInboundProjection(taskId, executionKey ?? void 0);
}
function getState(taskId, executionOrderId, executionOrderNo) {
  const stateKey = buildPdaCuttingExecutionStateKey(taskId, executionOrderId, executionOrderNo);
  const inboundState = getInboundStateStore();
  const existing = inboundState.get(stateKey);
  if (existing) return existing;
  const initial = {
    operatorName: "\u4ED3\u52A1\u64CD\u4F5C\u5458",
    zoneCode: "B",
    locationLabel: "B-02 \u4E34\u65F6\u4F4D",
    carrierCode: "",
    scanCode: "",
    inboundQty: "",
    scannedTicketNos: [],
    note: "",
    feedbackMessage: "",
    syncStatus: "",
    backHrefOverride: ""
  };
  inboundState.set(stateKey, initial);
  return initial;
}
function resolveInboundEventState(taskId) {
  const locationExecutionOrderId = readSelectedExecutionOrderIdFromLocation();
  const locationExecutionOrderNo = readSelectedExecutionOrderNoFromLocation();
  if (locationExecutionOrderId || locationExecutionOrderNo) {
    return {
      form: getState(taskId, locationExecutionOrderId, locationExecutionOrderNo),
      selectedExecutionOrderId: locationExecutionOrderId,
      selectedExecutionOrderNo: locationExecutionOrderNo
    };
  }
  const context = buildPdaCuttingExecutionContext(taskId, "inbound");
  return {
    form: getState(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo),
    selectedExecutionOrderId: context.selectedExecutionOrderId,
    selectedExecutionOrderNo: context.selectedExecutionOrderNo
  };
}
function syncInboundFormFromControls(form, container) {
  if (!container) return;
  const carrierCodeNode = container.querySelector('[data-pda-cut-inbound-field="carrierCode"]');
  const scanCodeNode = container.querySelector('[data-pda-cut-inbound-field="scanCode"]');
  const zoneCodeNode = container.querySelector('[data-pda-cut-inbound-field="zoneCode"]');
  const locationLabelNode = container.querySelector('[data-pda-cut-inbound-field="locationLabel"]');
  if (carrierCodeNode) form.carrierCode = carrierCodeNode.value;
  if (scanCodeNode) form.scanCode = scanCodeNode.value;
  if (zoneCodeNode) form.zoneCode = zoneCodeNode.value;
  if (locationLabelNode) form.locationLabel = locationLabelNode.value;
}
function resolveInboundFormContainer(actionNode) {
  const currentScope = actionNode.closest("[data-task-id]");
  if (currentScope && currentScope !== actionNode) return currentScope;
  return actionNode.parentElement?.closest("[data-task-id]") || currentScope;
}
function listInboundTicketCandidates() {
  return buildTransferBagsProjection().viewModel.ticketCandidates;
}
function resolveInboundScanTicket(scanCode) {
  const normalized = scanCode.trim().toUpperCase();
  if (!normalized) return null;
  return listInboundTicketCandidates().find(
    (ticket) => [ticket.ticketNo, ticket.feiTicketId, ticket.ticketRecordId].some((value) => String(value || "").toUpperCase() === normalized)
  ) || null;
}
function validateInboundScan(form, scanCode) {
  const normalized = scanCode.trim().toUpperCase();
  if (!normalized) return { ok: false, reason: "\u8BF7\u5148\u626B\u63CF\u83F2\u7968\u4E8C\u7EF4\u7801\u3002", ticket: null };
  if (normalized.includes("WAIT") || normalized.includes("\u672A\u9996\u6253")) return { ok: false, reason: "\u83F2\u7968\u672A\u9996\u6253\uFF0C\u4E0D\u80FD\u5165\u4ED3\u3002", ticket: null };
  if (normalized.includes("VOID") || normalized.includes("\u4F5C\u5E9F")) return { ok: false, reason: "\u83F2\u7968\u5DF2\u4F5C\u5E9F\uFF0C\u4E0D\u80FD\u5165\u4ED3\u3002", ticket: null };
  const ticket = resolveInboundScanTicket(scanCode);
  if (!ticket) return { ok: false, reason: "\u83F2\u7968\u4E0D\u5B58\u5728\uFF0C\u4E0D\u80FD\u5165\u4ED3\u3002", ticket: null };
  if (ticket.ticketStatus === "VOIDED" || ticket.printStatus === "VOIDED") return { ok: false, reason: "\u83F2\u7968\u5DF2\u4F5C\u5E9F\uFF0C\u4E0D\u80FD\u5165\u4ED3\u3002", ticket };
  if (ticket.printStatus === "WAIT_PRINT" && ticket.ticketStatus !== "PRINTED") return { ok: false, reason: "\u83F2\u7968\u672A\u9996\u6253\uFF0C\u4E0D\u80FD\u5165\u4ED3\u3002", ticket };
  if (form.scannedTicketNos.includes(ticket.ticketNo)) return { ok: false, reason: `${ticket.ticketNo} \u5DF2\u626B\u63CF\uFF0C\u672C\u6B21\u5165\u4ED3\u4E0D\u80FD\u91CD\u590D\u3002`, ticket };
  return { ok: true, reason: "", ticket };
}
function renderScannedTickets(form) {
  const candidatesByNo = Object.fromEntries(listInboundTicketCandidates().map((ticket) => [ticket.ticketNo, ticket]));
  const scannedTickets = form.scannedTicketNos.map((ticketNo) => candidatesByNo[ticketNo]).filter((ticket) => Boolean(ticket));
  const totalQty = scannedTickets.reduce((sum, ticket) => sum + Number(ticket.actualCutPieceQty || ticket.qty || 0), 0);
  const productionOrderCount = new Set(scannedTickets.map((ticket) => ticket.productionOrderNo).filter(Boolean)).size;
  const partCount = new Set(scannedTickets.map((ticket) => ticket.partName).filter(Boolean)).size;
  const hasSpecialCraft = scannedTickets.some((ticket) => ticket.hasSpecialCraft);
  return `
    <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs" data-pda-cut-inbound-scanned-summary>
      <div class="text-muted-foreground">\u5DF2\u626B\u83F2\u7968</div>
      <div class="mt-1 text-sm font-semibold text-foreground">${scannedTickets.length} \u5F20 / ${totalQty} \u7247</div>
      <div class="mt-1 text-muted-foreground">\u6D89\u53CA ${productionOrderCount} \u4E2A\u751F\u4EA7\u5355 / ${partCount} \u4E2A\u90E8\u4F4D / ${hasSpecialCraft ? "\u5305\u542B\u7279\u6B8A\u5DE5\u827A\u88C1\u7247" : "\u65E0\u7279\u6B8A\u5DE5\u827A"}</div>
      <div class="mt-2 space-y-1">
        ${scannedTickets.length ? scannedTickets.map((ticket) => `
                <div class="rounded-lg border bg-background px-2 py-2">
                  <div class="font-medium text-foreground">${escapeHtml(ticket.ticketNo)}</div>
                  <div class="mt-1 text-muted-foreground">${escapeHtml(ticket.productionOrderNo)} / ${escapeHtml(ticket.spuCode)} / ${escapeHtml(ticket.color)} / ${escapeHtml(ticket.size)} / ${escapeHtml(ticket.partName)} / ${ticket.actualCutPieceQty || ticket.qty} \u7247</div>
                </div>
              `).join("") : '<div class="text-muted-foreground">\u6682\u65E0\u5DF2\u626B\u83F2\u7968\u3002</div>'}
      </div>
    </div>
  `;
}
function renderInboundHistory(detail) {
  if (!detail || !detail.inboundRecords.length) {
    return renderPdaCuttingEmptyState("\u5F53\u524D\u88C1\u7247\u5355\u6682\u65E0\u5165\u4ED3\u8BB0\u5F55", "");
  }
  return `
    <div class="space-y-2">
      ${detail.inboundRecords.map(
    (record) => `
            <article class="rounded-xl border px-3 py-3 text-xs">
              <div class="flex items-center justify-between gap-2">
                <div class="font-medium text-foreground">${escapeHtml(record.id)} / ${escapeHtml(record.zoneCode)} \u533A / ${escapeHtml(record.locationLabel)}</div>
                <div class="text-muted-foreground">${escapeHtml(record.scannedAt)}</div>
              </div>
              <div class="mt-2 grid grid-cols-2 gap-1 text-muted-foreground">
                <div>\u64CD\u4F5C\u4EBA\uFF1A${escapeHtml(record.operatorName)}</div>
                <div>\u6682\u5B58\u65B9\u5F0F\uFF1A\u53EF\u6DF7\u88C5</div>
              </div>
              <div class="mt-1 text-muted-foreground">\u8BB0\u5F55\uFF1A${escapeHtml(record.note || "\u65E0")}</div>
            </article>
          `
  ).join("")}
    </div>
  `;
}
function renderInboundStatus(detail) {
  return renderPdaCuttingSummaryGrid([
    { label: "\u5F53\u524D\u5165\u4ED3\u72B6\u6001", value: detail.currentInboundStatus },
    { label: "\u6682\u5B58\u9636\u6BB5", value: "\u5165\u4ED3\u6682\u5B58\uFF0C\u53EF\u6DF7\u88C5" },
    { label: "\u5F53\u524D\u5E93\u4F4D", value: detail.inboundLocationLabel },
    { label: "\u6700\u8FD1\u5165\u4ED3\u8BB0\u5F55", value: detail.latestInboundRecordNo || "\u6682\u65E0\u8BB0\u5F55", hint: detail.latestInboundAt }
  ]);
}
function renderPdaCuttingInboundPage(taskId) {
  const context = buildPdaCuttingExecutionContext(taskId, "inbound");
  const detail = context.detail;
  if (!detail) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: "\u5165\u4ED3\u626B\u7801",
      subtitle: "",
      activeTab: "exec",
      body: "",
      backHref: context.backHref
    });
  }
  if (context.requiresCutPieceOrderSelection) {
    return renderPdaCuttingPageLayout({
      taskId,
      title: "\u5165\u4ED3\u626B\u7801",
      subtitle: "",
      activeTab: "exec",
      body: renderPdaCuttingOrderSelectionPrompt(detail, context.backHref, context.selectionNotice || void 0),
      backHref: context.backHref
    });
  }
  const form = getState(taskId, context.selectedExecutionOrderId, context.selectedExecutionOrderNo);
  const pageBackHref = form.backHrefOverride || context.backHref;
  const confirmSection = `
    <div class="space-y-3 text-xs" data-task-id="${escapeHtml(taskId)}">
      <label class="block space-y-1">
        <span class="text-muted-foreground">\u6682\u5B58\u888B / \u5468\u8F6C\u7BB1\u7801</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="carrierCode" value="${escapeHtml(form.carrierCode)}" placeholder="\u626B\u63CF\u6216\u8F93\u5165\u6682\u5B58\u888B\u7801" />
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">\u83F2\u7968 / \u88C1\u7247\u7801</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="scanCode" value="${escapeHtml(form.scanCode)}" placeholder="\u626B\u63CF\u83F2\u7968\u6216\u88C1\u7247\u7801" />
      </label>
      <button class="inline-flex min-h-10 w-full items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-pda-cut-inbound-action="add-ticket" data-task-id="${escapeHtml(taskId)}">
        \u52A0\u5165\u83F2\u7968
      </button>
      <label class="block space-y-1">
        <span class="text-muted-foreground">\u533A\u57DF</span>
        <select class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="zoneCode">
          ${["A", "B", "C"].map((item) => `<option value="${item}" ${form.zoneCode === item ? "selected" : ""}>${item} \u533A</option>`).join("")}
        </select>
      </label>
      <label class="block space-y-1">
        <span class="text-muted-foreground">\u5E93\u4F4D</span>
        <input class="h-10 w-full rounded-xl border bg-background px-3 text-sm" data-pda-cut-inbound-field="locationLabel" value="${escapeHtml(form.locationLabel)}" placeholder="\u4F8B\u5982\uFF1AA-01 \u4E34\u65F6\u4F4D" />
      </label>
      ${renderScannedTickets(form)}
      <div class="rounded-xl border bg-muted/20 px-3 py-3 text-xs">
        <div class="text-muted-foreground">\u672C\u6B21\u5165\u4ED3\u9884\u89C8</div>
        <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(form.carrierCode || "\u5F85\u626B\u888B\u7801")} / ${form.scannedTicketNos.length} \u5F20\u83F2\u7968</div>
        <div class="mt-1 text-muted-foreground">${escapeHtml(form.zoneCode)} \u533A / ${escapeHtml(form.locationLabel || "\u5F85\u586B\u5199\u4F4D\u7F6E")} / \u5165\u4ED3\u6682\u5B58\u888B\u5141\u8BB8\u6DF7\u88C5</div>
      </div>
      ${form.syncStatus ? `<div class="rounded-xl border bg-background px-3 py-2 text-xs">\u540C\u6B65\u72B6\u6001\uFF1A<span class="font-medium text-foreground">${escapeHtml(form.syncStatus)}</span></div>` : ""}
      ${form.feedbackMessage ? renderPdaCuttingFeedbackNotice(form.feedbackMessage, "success") : ""}
      <div class="grid grid-cols-2 gap-2">
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-medium hover:bg-muted" data-nav="${escapeHtml(pageBackHref)}">
          \u8FD4\u56DE\u88C1\u7247\u4EFB\u52A1
        </button>
        <button class="inline-flex min-h-10 items-center justify-center rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:opacity-90" data-pda-cut-inbound-action="confirm" data-task-id="${escapeHtml(taskId)}">
          \u63D0\u4EA4\u5165\u4ED3
        </button>
      </div>
    </div>
  `;
  const body = `
    ${renderPdaCuttingExecutionHero("\u5165\u4ED3\u626B\u7801", detail)}
    ${renderPdaCuttingSection("\u5F53\u524D\u60C5\u51B5", "", renderInboundStatus(detail))}
    ${renderPdaCuttingSection("\u5165\u4ED3\u626B\u7801", "", confirmSection)}
    ${renderPdaCuttingSection("\u6700\u8FD1\u5165\u4ED3\u8BB0\u5F55", "", renderInboundHistory(detail))}
  `;
  return renderPdaCuttingPageLayout({
    taskId,
    title: "\u5165\u4ED3\u626B\u7801",
    subtitle: "",
    activeTab: "exec",
    body,
    backHref: pageBackHref
  });
}
function handlePdaCuttingInboundEvent(target) {
  const fieldNode = target.closest("[data-pda-cut-inbound-field]");
  if (fieldNode instanceof HTMLInputElement || fieldNode instanceof HTMLSelectElement || fieldNode instanceof HTMLTextAreaElement) {
    const taskId2 = fieldNode.closest("[data-task-id]")?.dataset.taskId || appTaskIdFromPath();
    if (!taskId2) return true;
    const { form: form2 } = resolveInboundEventState(taskId2);
    const field = fieldNode.dataset.pdaCutInboundField;
    if (!field) return true;
    if (field === "operatorName") form2.operatorName = fieldNode.value;
    if (field === "zoneCode" && fieldNode instanceof HTMLSelectElement) form2.zoneCode = fieldNode.value;
    if (field === "locationLabel") form2.locationLabel = fieldNode.value;
    if (field === "carrierCode") form2.carrierCode = fieldNode.value;
    if (field === "scanCode") form2.scanCode = fieldNode.value;
    if (field === "inboundQty") form2.inboundQty = fieldNode.value;
    if (field === "note") form2.note = fieldNode.value;
    return true;
  }
  const actionNode = target.closest("[data-pda-cut-inbound-action]");
  if (!actionNode) return false;
  const action = actionNode.dataset.pdaCutInboundAction;
  const taskId = actionNode.dataset.taskId;
  if (!action || !taskId) return false;
  const {
    form,
    selectedExecutionOrderId,
    selectedExecutionOrderNo
  } = resolveInboundEventState(taskId);
  syncInboundFormFromControls(form, resolveInboundFormContainer(actionNode));
  if (action === "add-ticket") {
    const validation = validateInboundScan(form, form.scanCode);
    if (!validation.ok || !validation.ticket) {
      form.feedbackMessage = validation.reason;
      form.syncStatus = "";
      return true;
    }
    form.scannedTicketNos.push(validation.ticket.ticketNo);
    form.scanCode = "";
    form.inboundQty = String(
      form.scannedTicketNos.map((ticketNo) => resolveInboundScanTicket(ticketNo)).filter((ticket) => Boolean(ticket)).reduce((sum, ticket) => sum + Number(ticket.actualCutPieceQty || ticket.qty || 0), 0)
    );
    form.feedbackMessage = `${validation.ticket.ticketNo} \u5DF2\u52A0\u5165\uFF1B${getTransferBagTicketPrintStatusLabel(validation.ticket)}\uFF0C\u5141\u8BB8\u4E0E\u4E0D\u540C\u751F\u4EA7\u5355\u3001SKU\u3001\u90E8\u4F4D\u83F2\u7968\u6DF7\u88C5\u3002`;
    form.syncStatus = "";
    return true;
  }
  if (action === "confirm") {
    const context = buildPdaCuttingExecutionContext(taskId, "inbound");
    const identity = resolvePdaCuttingWritebackIdentity(taskId, {
      executionOrderId: context.selectedExecutionOrderId || void 0,
      executionOrderNo: context.selectedExecutionOrderNo || void 0,
      cutOrderId: context.selectedExecutionOrder?.cutOrderId || void 0,
      cutOrderNo: context.selectedExecutionOrder?.cutOrderNo || void 0,
      markerPlanId: context.selectedExecutionOrder?.markerPlanId || void 0,
      markerPlanNo: context.selectedExecutionOrder?.markerPlanNo || void 0,
      materialSku: context.selectedExecutionOrder?.materialSku || void 0
    });
    const operator = resolvePdaCuttingWritebackOperator(taskId, form.operatorName.trim() || "\u4ED3\u52A1\u64CD\u4F5C\u5458");
    if (!identity || !operator) {
      form.feedbackMessage = "\u5F53\u524D\u6267\u884C\u5BF9\u8C61\u6216\u64CD\u4F5C\u4EBA\u65E0\u6CD5\u8BC6\u522B\uFF0C\u4E0D\u80FD\u786E\u8BA4\u5165\u4ED3\u3002";
      return true;
    }
    if (!form.carrierCode.trim()) {
      form.feedbackMessage = "\u8BF7\u5148\u626B\u63CF\u5165\u4ED3\u6682\u5B58\u888B\u888B\u7801\u3002";
      return true;
    }
    if (!form.scannedTicketNos.length) {
      form.feedbackMessage = "\u8BF7\u5148\u626B\u63CF\u5E76\u52A0\u5165\u81F3\u5C11\u4E00\u5F20\u83F2\u7968\u3002";
      return true;
    }
    const inboundTickets = form.scannedTicketNos.map((ticketNo) => resolveInboundScanTicket(ticketNo)).filter((ticket) => Boolean(ticket));
    const inboundQty = inboundTickets.reduce((sum, ticket) => sum + Number(ticket.actualCutPieceQty || ticket.qty || 0), 0);
    const result = writePdaInboundToFcs({
      identity,
      operator,
      source: buildPdaCuttingWritebackSource("inbound", identity.executionOrderId),
      zoneCode: form.zoneCode,
      locationLabel: form.locationLabel.trim() || `${form.zoneCode}-01 \u4E34\u65F6\u4F4D`,
      note: [
        `\u6682\u5B58\u888B\uFF1A${form.carrierCode.trim()}`,
        `\u83F2\u7968\uFF1A${form.scannedTicketNos.join("\u3001")}`,
        `\u6570\u91CF\uFF1A${inboundQty} \u7247`,
        "\u5165\u4ED3\u6682\u5B58\u888B\u5141\u8BB8\u6DF7\u88C5",
        form.note.trim()
      ].filter(Boolean).join("\uFF1B")
    });
    if (!result.success) {
      form.feedbackMessage = result.issues.join("\uFF1B");
      form.syncStatus = "\u540C\u6B65\u5931\u8D25";
      return true;
    }
    form.scanCode = "";
    form.inboundQty = "";
    form.scannedTicketNos = [];
    form.feedbackMessage = `\u5165\u4ED3\u5DF2\u63D0\u4EA4\uFF0C\u5DF2\u5F62\u6210\u88C1\u5E8A\u5F85\u4EA4\u51FA\u4ED3\u5E93\u5B58\uFF1A${inboundQty} \u7247\u3002`;
    form.syncStatus = "\u5DF2\u540C\u6B65";
    form.backHrefOverride = buildPdaCuttingCompletedReturnHref(
      taskId,
      context.selectedExecutionOrderId,
      context.selectedExecutionOrderNo,
      context.navContext,
      "inbound"
    );
    return true;
  }
  return false;
}
function appTaskIdFromPath() {
  if (typeof window === "undefined") return "";
  const matched = window.location.pathname.match(/\/fcs\/pda\/cutting\/inbound\/([^/]+)/);
  return matched?.[1] ?? "";
}
export {
  handlePdaCuttingInboundEvent,
  renderPdaCuttingInboundPage
};
