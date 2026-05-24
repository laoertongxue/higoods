import { appStore } from "../../../state/store.ts";
import { escapeHtml } from "../../../utils.ts";
import {
  buildFeiTicketFiveDimTitle,
  buildPrintableUnitDetailViewModel,
  canVoidTicketCard,
  CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY,
  CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY,
  executePrintableUnitPrint,
  filterPrintableUnits,
  getPrintableUnitStatusMeta,
  serializeFeiTicketPrintJobsStorage,
  serializeFeiTicketRecordsStorage,
  isFeiTicketFiveDimComplete,
  voidTicketCard
} from "./fei-tickets-model.ts";
import { renderRealQrPlaceholder } from "../../../components/real-qr.ts";
import {
  renderStickyFilterShell,
  renderStickyTableScroller
} from "./layout.helpers.ts";
import { renderMaterialIdentityBlock } from "./material-identity.ts";
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from "./meta.ts";
import {
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  hasSummaryReturnContext,
  readCuttingDrillContextFromLocation,
  serializeCuttingDrillContext
} from "./navigation-context.ts";
import {
  buildFeiTicketLabelPrintProjection,
  buildFeiTicketPrintProjection
} from "./fei-ticket-print-projection.ts";
import {
  FEI_TICKET_SOURCE_BASIS_TYPE,
  listGeneratedFeiTickets,
  listFeiTicketGenerationEligibilityRows,
  listPieceSequenceRangeScenarioRows
} from "../../../data/fcs/cutting/generated-fei-tickets.ts";
import {
  getSpecialCraftFeiTicketSummary,
  listCuttingSpecialCraftFeiTicketBindings
} from "../../../data/fcs/cutting/special-craft-fei-ticket-flow.ts";
import { findCuttingSewingDispatchByFeiTicketNo } from "../../../data/fcs/cutting/sewing-dispatch.ts";
import { buildSpecialCraftTaskDetailPath } from "../../../data/fcs/special-craft-operations.ts";
import { buildFeiTicketLabelPrintLink } from "../../../data/fcs/fcs-route-links.ts";
const FEI_CODE_FIELD = ["qr", "Payload"].join("");
function getTicketScanCode(source) {
  const value = source[FEI_CODE_FIELD];
  return typeof value === "string" ? value : "";
}
function formatDispatchLabel(value) {
  return value.replaceAll("\u53D1\u6599", "\u4EA4\u51FA");
}
const printableTypeMeta = {
  ALL: "\u5168\u90E8",
  MARKER_PLAN: "\u551B\u67B6\u65B9\u6848",
  CUT_ORDER: "\u88C1\u7247\u5355"
};
const operationTypeMeta = {
  FIRST_PRINT: "\u9996\u6253",
  REPRINT: "\u8865\u6253",
  VOID: "\u4F5C\u5E9F"
};
const ticketCardStatusMeta = {
  VALID: {
    label: "\u6709\u6548",
    className: "border border-emerald-200 bg-emerald-100 text-emerald-700"
  },
  VOIDED: {
    label: "\u5DF2\u4F5C\u5E9F",
    className: "border border-rose-200 bg-rose-100 text-rose-700"
  }
};
const initialFilters = {
  keyword: "",
  printableUnitType: "ALL",
  styleCode: "",
  fabricSku: "",
  productionOrderNo: "",
  printableUnitStatus: "ALL",
  printedFrom: "",
  printedTo: ""
};
const state = {
  filters: { ...initialFilters },
  querySignature: "",
  operationSignature: "",
  operationDraft: createDefaultOperationDraft()
};
function createDefaultOperationDraft() {
  return {
    operator: "\u6253\u7968\u5458-\u5468\u8389",
    printerName: "Zebra ZT411",
    templateName: "\u88C1\u7247\u83F2\u7968\u6807\u51C6\u6A21\u677F",
    reason: "",
    remark: ""
  };
}
function getCurrentPathname() {
  return appStore.getState().pathname.split("?")[0] || getCanonicalCuttingPath("fei-tickets");
}
function getCurrentQueryString() {
  const pathname = appStore.getState().pathname;
  const [, query] = pathname.split("?");
  return query || "";
}
function getCurrentSearchParams() {
  return new URLSearchParams(getCurrentQueryString());
}
function buildRouteWithQuery(pathname, payload) {
  if (!payload) return pathname;
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
function nowText(input = /* @__PURE__ */ new Date()) {
  const year = input.getFullYear();
  const month = `${input.getMonth() + 1}`.padStart(2, "0");
  const day = `${input.getDate()}`.padStart(2, "0");
  const hours = `${input.getHours()}`.padStart(2, "0");
  const minutes = `${input.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => Boolean(value))));
}
function formatCount(value) {
  return new Intl.NumberFormat("zh-CN").format(Math.max(value, 0));
}
function formatDateTime(value) {
  return value || "\u672A\u6253\u5370";
}
function formatMaybeNumber(value, digits = 0) {
  if (value === void 0 || Number.isNaN(value)) return "\u5F85\u8865\u5F55";
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  }).format(value);
}
function truncate(value, maxLength = 36) {
  if (!value) return "\u2014";
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}
function formatOperationTypeLabel(value) {
  return operationTypeMeta[value];
}
function persistTicketRecords(records) {
  localStorage.setItem(CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY, serializeFeiTicketRecordsStorage(records));
}
function persistPrintJobs(printJobs) {
  localStorage.setItem(CUTTING_FEI_TICKET_PRINT_JOBS_STORAGE_KEY, serializeFeiTicketPrintJobsStorage(printJobs));
}
function mapPrintableStatusFromQuery(value) {
  if (!value) return "ALL";
  if (value === "WAITING_PRINT" || value === "PRINTED" || value === "NEED_REPRINT") {
    return value;
  }
  if (value === "NOT_GENERATED") return "WAITING_PRINT";
  if (value === "REPRINTED" || value === "PENDING_SUPPLEMENT" || value === "PARTIAL_PRINTED") return "NEED_REPRINT";
  return "ALL";
}
function inferPrintableUnitType(params) {
  const explicit = params.get("printableUnitType");
  if (explicit === "MARKER_PLAN" || explicit === "CUT_ORDER") return explicit;
  if (params.get("markerPlanId") || params.get("markerPlanNo")) return "MARKER_PLAN";
  if (params.get("cutOrderId") || params.get("cutOrderNo")) return "CUT_ORDER";
  return "ALL";
}
function getCurrentDrillContext() {
  return readCuttingDrillContextFromLocation(getCurrentSearchParams());
}
function filterPrintableUnitsByDrillContext(units, drillContext = getCurrentDrillContext()) {
  if (!drillContext) return units;
  const hasSpreadingSessionAnchor = Boolean(drillContext.spreadingSessionId || drillContext.spreadingSessionNo);
  return units.filter((unit) => {
    if (drillContext.spreadingSessionId && !unit.sourceSpreadingSessionIds.includes(drillContext.spreadingSessionId)) return false;
    if (drillContext.spreadingSessionNo && !unit.sourceSpreadingSessionNos.includes(drillContext.spreadingSessionNo)) return false;
    if (hasSpreadingSessionAnchor) return true;
    if (drillContext.markerPlanId && unit.batchId && unit.batchId !== drillContext.markerPlanId) return false;
    if (drillContext.cutOrderId && !unit.sourceCutOrderIds.includes(drillContext.cutOrderId)) return false;
    return true;
  });
}
function resolvePreferredSpreadingTrace(unit, drillContext = getCurrentDrillContext()) {
  if (drillContext?.spreadingSessionId) {
    const matchedIndex = unit.sourceSpreadingSessionIds.indexOf(drillContext.spreadingSessionId);
    if (matchedIndex >= 0) {
      return {
        id: unit.sourceSpreadingSessionIds[matchedIndex] || "",
        no: unit.sourceSpreadingSessionNos[matchedIndex] || ""
      };
    }
  }
  if (drillContext?.spreadingSessionNo) {
    const matchedIndex = unit.sourceSpreadingSessionNos.indexOf(drillContext.spreadingSessionNo);
    if (matchedIndex >= 0) {
      return {
        id: unit.sourceSpreadingSessionIds[matchedIndex] || "",
        no: unit.sourceSpreadingSessionNos[matchedIndex] || ""
      };
    }
  }
  return {
    id: unit.sourceSpreadingSessionIds[0] || "",
    no: unit.sourceSpreadingSessionNos[0] || ""
  };
}
function buildSpreadingTraceText(unit, drillContext = getCurrentDrillContext()) {
  const preferred = resolvePreferredSpreadingTrace(unit, drillContext);
  const orderedNos = uniqueStrings([preferred.no, ...unit.sourceSpreadingSessionNos]);
  const orderedIds = uniqueStrings([preferred.id, ...unit.sourceSpreadingSessionIds]);
  return orderedNos.join(" / ") || orderedIds.join(" / ") || "\u5F53\u524D\u6309\u88C1\u7247\u5355\u53C2\u8003\u8865\u8DB3";
}
function renderReturnToSummaryButton() {
  if (!hasSummaryReturnContext(getCurrentDrillContext())) return "";
  return `<button type="button" data-cutting-fei-action="return-summary" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">\u8FD4\u56DE\u88C1\u526A\u603B\u7ED3</button>`;
}
function buildFiltersFromQuery(params) {
  const drillContext = readCuttingDrillContextFromLocation(params);
  const hasSpreadingSessionAnchor = Boolean(drillContext?.spreadingSessionId || drillContext?.spreadingSessionNo);
  const keyword = params.get("keyword") || (hasSpreadingSessionAnchor ? "" : drillContext?.printableUnitNo || drillContext?.ticketNo || drillContext?.cutOrderNo || drillContext?.markerPlanNo || "");
  return {
    keyword,
    printableUnitType: hasSpreadingSessionAnchor && !params.get("printableUnitType") ? "ALL" : inferPrintableUnitType(params),
    styleCode: params.get("styleCode") || (hasSpreadingSessionAnchor ? "" : drillContext?.styleCode || ""),
    fabricSku: params.get("fabricSku") || params.get("materialSku") || (hasSpreadingSessionAnchor ? "" : drillContext?.materialSku || ""),
    productionOrderNo: params.get("productionOrderNo") || (hasSpreadingSessionAnchor ? "" : drillContext?.productionOrderNo || ""),
    printableUnitStatus: mapPrintableStatusFromQuery(params.get("printableUnitStatus") || params.get("ticketStatus")),
    printedFrom: params.get("printedFrom") || "",
    printedTo: params.get("printedTo") || ""
  };
}
function hydrateFilterStateFromRoute() {
  const pathname = getCurrentPathname();
  const querySignature = `${pathname}?${getCurrentQueryString()}`;
  if (pathname !== getCanonicalCuttingPath("fei-tickets")) return;
  if (state.querySignature === querySignature) return;
  const params = getCurrentSearchParams();
  state.filters = buildFiltersFromQuery(params);
  state.querySignature = querySignature;
}
function hydrateOperationDraftFromRoute() {
  const pathname = getCurrentPathname();
  const isOperationPage = (/* @__PURE__ */ new Set([
    "fei-ticket-print",
    "fei-ticket-reprint",
    "fei-ticket-void"
  ])).has(getCanonicalCuttingMeta(pathname, "fei-tickets").key);
  const signature = `${pathname}?${getCurrentQueryString()}`;
  if (!isOperationPage) {
    state.operationSignature = "";
    return;
  }
  if (state.operationSignature === signature) return;
  const draft = createDefaultOperationDraft();
  if (pathname === getCanonicalCuttingPath("fei-ticket-reprint")) {
    draft.reason = "\u4F5C\u5E9F\u540E\u8865\u6253";
  }
  if (pathname === getCanonicalCuttingPath("fei-ticket-void")) {
    draft.reason = "";
    draft.printerName = "";
    draft.templateName = "";
  }
  state.operationDraft = draft;
  state.operationSignature = signature;
}
function getDataBundle() {
  hydrateFilterStateFromRoute();
  hydrateOperationDraftFromRoute();
  const projection = buildFeiTicketPrintProjection();
  const drillContext = getCurrentDrillContext();
  const contextualUnits = filterPrintableUnitsByDrillContext(projection.printableViewModel.units, drillContext);
  const contextualViewModel = {
    units: contextualUnits,
    unitsById: Object.fromEntries(contextualUnits.map((unit) => [unit.printableUnitId, unit])),
    statusCounts: {
      WAITING_PRINT: contextualUnits.filter((unit) => unit.printableUnitStatus === "WAITING_PRINT").length,
      PRINTED: contextualUnits.filter((unit) => unit.printableUnitStatus === "PRINTED").length,
      NEED_REPRINT: contextualUnits.filter((unit) => unit.printableUnitStatus === "NEED_REPRINT").length
    }
  };
  return {
    cutOrderRows: projection.cutOrderRows,
    materialPrepRows: projection.materialPrepRows,
    markerPlanRefs: projection.markerPlanRefs,
    markerStore: projection.markerStore,
    ticketRecords: projection.ticketRecords,
    printJobs: projection.printJobs,
    transferBagStore: projection.transferBagStore,
    printableViewModel: contextualViewModel,
    craftTraceProjection: projection.craftTraceProjection,
    filteredUnits: filterPrintableUnits(contextualUnits, state.filters)
  };
}
function buildPrintableUnitQuery(unit) {
  const preferredTrace = resolvePreferredSpreadingTrace(unit);
  return {
    spreadingSessionId: preferredTrace.id || void 0,
    spreadingSessionNo: preferredTrace.no || void 0,
    printableUnitId: unit.printableUnitId,
    printableUnitNo: unit.printableUnitNo,
    printableUnitType: unit.printableUnitType,
    batchId: unit.batchId || void 0,
    batchNo: unit.batchNo || void 0,
    cutOrderId: unit.cutOrderId || void 0,
    cutOrderNo: unit.cutOrderNo || void 0,
    productionOrderId: unit.sourceProductionOrderIds[0] || void 0,
    sourceProductionOrderNo: unit.sourceProductionOrderNos[0] || void 0,
    productionOrderNo: unit.sourceProductionOrderNos[0] || void 0,
    styleCode: unit.styleCode || void 0,
    materialSku: unit.fabricSku || void 0,
    fabricSku: unit.fabricSku || void 0
  };
}
function buildDetailRoute(pageKey, unit, payload) {
  return buildRouteWithQuery(getCanonicalCuttingPath(pageKey), {
    ...serializeCuttingDrillContext(getCurrentDrillContext()),
    ...buildPrintableUnitQuery(unit),
    ...payload
  });
}
function buildActionHref(pageKey, unit, payload) {
  return buildRouteWithQuery(getCanonicalCuttingPath(pageKey), {
    ...serializeCuttingDrillContext(getCurrentDrillContext()),
    ...buildPrintableUnitQuery(unit),
    ...payload
  });
}
function findUnit(bundle) {
  const params = getCurrentSearchParams();
  const printableUnitId = params.get("printableUnitId");
  const printableUnitNo = params.get("printableUnitNo");
  if (printableUnitId && bundle.printableViewModel.unitsById[printableUnitId]) {
    return bundle.printableViewModel.unitsById[printableUnitId];
  }
  if (printableUnitNo) {
    return bundle.printableViewModel.units.find((unit) => unit.printableUnitNo === printableUnitNo) || null;
  }
  return null;
}
function getDetailTab(pathname) {
  if (pathname === getCanonicalCuttingPath("fei-ticket-printed")) return "printed";
  if (pathname === getCanonicalCuttingPath("fei-ticket-records")) return "records";
  const explicit = getCurrentSearchParams().get("tab");
  if (explicit === "printed" || explicit === "records") return explicit;
  return "split";
}
function findTicketCard(detailViewModel) {
  if (!detailViewModel) return null;
  const params = getCurrentSearchParams();
  const ticketId = params.get("ticketRecordId") || params.get("ticketId");
  if (!ticketId) return null;
  return detailViewModel.ticketCards.find((ticket) => ticket.ticketId === ticketId) || null;
}
function renderBadge(label, className) {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`;
}
function renderUnitTypeBadge(type) {
  const className = type === "MARKER_PLAN" ? "border border-violet-200 bg-violet-100 text-violet-700" : "border border-slate-200 bg-slate-100 text-slate-700";
  return renderBadge(printableTypeMeta[type], className);
}
function renderStatusBadge(status) {
  const meta = getPrintableUnitStatusMeta(status);
  return renderBadge(meta.label, meta.className);
}
function renderTicketStatusBadge(status) {
  return renderBadge(ticketCardStatusMeta[status].label, ticketCardStatusMeta[status].className);
}
function renderStatusTab(status, label, count, active) {
  const activeClass = active ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50";
  return `
    <button
      type="button"
      data-cutting-fei-action="set-status"
      data-status="${status}"
      class="inline-flex min-h-9 items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-medium transition whitespace-nowrap ${activeClass}"
    >
      <span>${escapeHtml(label)}</span>
      <span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">${formatCount(count)}</span>
    </button>
  `;
}
function renderFilterArea() {
  return renderStickyFilterShell(`
    <div class="space-y-4">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-sm font-semibold text-slate-900">\u7B5B\u9009\u6761\u4EF6</h2>
        <button type="button" data-cutting-fei-action="reset-filters" class="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50">\u6E05\u7A7A\u7B5B\u9009</button>
      </div>
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">\u53EF\u6253\u5370\u5355\u5143\u53F7</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.keyword)}"
            data-cutting-fei-field="keyword"
            placeholder="\u8F93\u5165\u551B\u67B6\u65B9\u6848\u53F7 / \u88C1\u7247\u5355\u53F7"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">\u5355\u5143\u7C7B\u578B</span>
          <select
            data-cutting-fei-field="printableUnitType"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            ${["ALL", "MARKER_PLAN", "CUT_ORDER"].map((item) => `<option value="${item}" ${item === state.filters.printableUnitType ? "selected" : ""}>${printableTypeMeta[item]}</option>`).join("")}
          </select>
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">\u6B3E\u53F7 / \u6B3E\u5F0F\u7F16\u7801</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.styleCode)}"
            data-cutting-fei-field="styleCode"
            placeholder="\u8F93\u5165\u6B3E\u53F7 / \u6B3E\u5F0F\u7F16\u7801"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">\u9762\u6599</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.fabricSku)}"
            data-cutting-fei-field="fabricSku"
            placeholder="\u8F93\u5165\u9762\u6599 SKU / \u6280\u672F\u5305\u522B\u540D"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">\u6765\u6E90\u751F\u4EA7\u5355\u53F7</span>
          <input
            type="text"
            value="${escapeHtml(state.filters.productionOrderNo)}"
            data-cutting-fei-field="productionOrderNo"
            placeholder="\u8F93\u5165\u6765\u6E90\u751F\u4EA7\u5355\u53F7"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">\u6253\u5370\u72B6\u6001</span>
          <select
            data-cutting-fei-field="printableUnitStatus"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          >
            <option value="ALL" ${state.filters.printableUnitStatus === "ALL" ? "selected" : ""}>\u5168\u90E8</option>
            ${["WAITING_PRINT", "PRINTED", "NEED_REPRINT"].map((status) => {
    const meta = getPrintableUnitStatusMeta(status);
    return `<option value="${status}" ${state.filters.printableUnitStatus === status ? "selected" : ""}>${meta.label}</option>`;
  }).join("")}
          </select>
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">\u6700\u8FD1\u6253\u5370\u5F00\u59CB\u65E5\u671F</span>
          <input
            type="date"
            value="${escapeHtml(state.filters.printedFrom)}"
            data-cutting-fei-field="printedFrom"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
        <label class="space-y-1 text-sm text-slate-600">
          <span class="font-medium text-slate-700">\u6700\u8FD1\u6253\u5370\u7ED3\u675F\u65E5\u671F</span>
          <input
            type="date"
            value="${escapeHtml(state.filters.printedTo)}"
            data-cutting-fei-field="printedTo"
            class="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
          />
        </label>
      </div>
    </div>
  `);
}
function renderStatusTabsArea(bundle) {
  const statusCounts = bundle.printableViewModel.statusCounts;
  const totalCount = bundle.printableViewModel.units.length;
  return `
    <section class="rounded-lg border bg-white p-3 shadow-sm">
      <div class="flex flex-wrap gap-2">
        ${renderStatusTab("ALL", "\u5168\u90E8", totalCount, state.filters.printableUnitStatus === "ALL")}
        ${renderStatusTab("WAITING_PRINT", "\u5F85\u6253\u5370", statusCounts.WAITING_PRINT, state.filters.printableUnitStatus === "WAITING_PRINT")}
        ${renderStatusTab("PRINTED", "\u5DF2\u6253\u5370", statusCounts.PRINTED, state.filters.printableUnitStatus === "PRINTED")}
        ${renderStatusTab("NEED_REPRINT", "\u9700\u8865\u6253", statusCounts.NEED_REPRINT, state.filters.printableUnitStatus === "NEED_REPRINT")}
      </div>
    </section>
  `;
}
const workbenchTabLabels = {
  WAIT_FIRST: "\u5F85\u9996\u6253",
  PRINTED: "\u5DF2\u9996\u6253",
  NEED_REPRINT: "\u9700\u8865\u6253",
  VOIDED: "\u5DF2\u4F5C\u5E9F",
  PRINT_RECORDS: "\u6253\u5370\u8BB0\u5F55"
};
const reprintReasonOptions = ["\u83F2\u7968\u4E22\u5931", "\u83F2\u7968\u7834\u635F", "\u6253\u5370\u4E0D\u6E05\u6670", "\u6570\u91CF\u62C6\u5206\u9700\u8981\u8865\u6253", "\u73B0\u573A\u590D\u6838\u9700\u8981", "\u5176\u4ED6\u539F\u56E0"];
const voidReasonOptions = ["\u6253\u5370\u9519\u8BEF", "\u6570\u91CF\u9519\u8BEF", "\u90E8\u4F4D\u9519\u8BEF", "\u5C3A\u7801\u9519\u8BEF", "\u91CD\u590D\u751F\u6210", "\u73B0\u573A\u635F\u574F", "\u5176\u4ED6\u539F\u56E0"];
function getWorkbenchActiveTab() {
  const value = getCurrentSearchParams().get("tab");
  if (value === "PRINTED" || value === "NEED_REPRINT" || value === "VOIDED" || value === "PRINT_RECORDS") return value;
  return "WAIT_FIRST";
}
function normalizeTicketRouteId(value) {
  return decodeURIComponent(value || "").trim();
}
function buildStandaloneFeiTicketHref(ticketId, suffix = "") {
  return `/fcs/craft/cutting/fei-tickets/${encodeURIComponent(ticketId)}${suffix}`;
}
function buildWorkbenchTabHref(tab) {
  if (tab === "WAIT_FIRST") return getCanonicalCuttingPath("fei-tickets");
  if (tab === "PRINT_RECORDS") return "/fcs/craft/cutting/fei-tickets/print-records";
  return `${getCanonicalCuttingPath("fei-tickets")}?tab=${tab}`;
}
function getTicketRecordVersionLabel(record) {
  const version = Number(record?.version || 0);
  if (Number.isFinite(version) && version > 0) return `V${version}`;
  return "V1";
}
function buildSpecialCraftLinesFromRecord(source) {
  const crafts = source.specialCrafts || [];
  if (!crafts.length) return { specialCraftLines: ["\u65E0"], receiverFactoryLines: ["\u65E0"] };
  return {
    specialCraftLines: crafts.map((craft) => `${craft.craftType} / ${craft.craftCategory}`),
    receiverFactoryLines: crafts.map((craft) => `${craft.craftType}\uFF1A${craft.receiverFactoryName || "\u627F\u63A5\u5DE5\u5382\u5F85\u8865\u5145"}`)
  };
}
function resolveTicketGeneratedRecord(row) {
  return row?.generated || null;
}
function findGeneratedRecordByTicketId(ticketId) {
  const normalized = normalizeTicketRouteId(ticketId);
  return listGeneratedFeiTickets().find(
    (item) => item.feiTicketId === normalized || item.feiTicketNo === normalized || item.sourceOutputLineId === normalized
  ) || null;
}
function findTicketRecordByTicketId(records, ticketId) {
  const normalized = normalizeTicketRouteId(ticketId);
  return records.find(
    (item) => item.ticketRecordId === normalized || item.ticketNo === normalized || item.sourceOutputLineId === normalized
  ) || null;
}
function buildSyntheticReprintRow(generated, record) {
  const lines = buildSpecialCraftLinesFromRecord(generated);
  return {
    tab: "NEED_REPRINT",
    ticketId: `${generated.feiTicketId}:reprint-review`,
    ticketNo: generated.feiTicketNo,
    versionLabel: getTicketRecordVersionLabel(record),
    printStatusLabel: "\u9700\u8865\u6253",
    productionOrderNo: generated.productionOrderNo,
    cutOrderNo: generated.cutOrderNo,
    markerPlanNo: generated.sourceMarkerPlanNo,
    markerNumber: generated.sourceMarkerNo || generated.markerNumber,
    spreadingOrderNo: generated.sourceSpreadingSessionNo || generated.spreadingOrderNo,
    spuCode: generated.sourceTechPackSpuCode,
    color: generated.skuColor || generated.fabricColor,
    size: generated.skuSize,
    partName: generated.partName,
    pieceQty: generated.actualCutPieceQty,
    pieceSequenceLabel: generated.pieceSequenceLabel || "\u4E0D\u53EF\u751F\u6210",
    hasSpecialCraft: generated.hasSpecialCraft,
    specialCraftLines: lines.specialCraftLines,
    receiverFactoryLines: lines.receiverFactoryLines,
    firstPrintedAt: record?.printedAt || "2026-03-24 09:10",
    latestReprintAt: "\u5F85\u8865\u6253",
    printCount: Math.max((record?.reprintCount || 0) + 1, 1),
    printedBy: record?.printedBy || "\u6253\u7968\u5458-\u5468\u8389",
    reason: "\u6253\u5370\u4E0D\u6E05\u6670\uFF0C\u5F85\u8865\u6253",
    record,
    generated
  };
}
function buildSyntheticVoidedRow(generated, record) {
  const lines = buildSpecialCraftLinesFromRecord(generated);
  return {
    tab: "VOIDED",
    ticketId: `${generated.feiTicketId}:void-demo`,
    ticketNo: generated.feiTicketNo,
    versionLabel: getTicketRecordVersionLabel(record),
    printStatusLabel: "\u5DF2\u4F5C\u5E9F",
    productionOrderNo: generated.productionOrderNo,
    cutOrderNo: generated.cutOrderNo,
    markerPlanNo: generated.sourceMarkerPlanNo,
    markerNumber: generated.sourceMarkerNo || generated.markerNumber,
    spreadingOrderNo: generated.sourceSpreadingSessionNo || generated.spreadingOrderNo,
    spuCode: generated.sourceTechPackSpuCode,
    color: generated.skuColor || generated.fabricColor,
    size: generated.skuSize,
    partName: generated.partName,
    pieceQty: generated.actualCutPieceQty,
    pieceSequenceLabel: generated.pieceSequenceLabel || "\u4E0D\u53EF\u751F\u6210",
    hasSpecialCraft: generated.hasSpecialCraft,
    specialCraftLines: lines.specialCraftLines,
    receiverFactoryLines: lines.receiverFactoryLines,
    firstPrintedAt: record?.printedAt || "2026-03-24 08:45",
    latestReprintAt: record?.replacementTicketNo || "\u65E0\u66FF\u4EE3\u7968",
    printCount: Math.max((record?.reprintCount || 0) + 1, 1),
    printedBy: record?.voidedBy || record?.printedBy || "\u6253\u7968\u5458-\u8D75\u5B81",
    reason: record?.voidReason || "\u73B0\u573A\u635F\u574F\uFF0C\u4FDD\u7559\u5386\u53F2\u8BB0\u5F55",
    record,
    generated
  };
}
function buildFeiTicketWorkbenchRows(bundle) {
  const generatedRecords = listGeneratedFeiTickets();
  const printedByOutput = /* @__PURE__ */ new Map();
  bundle.ticketRecords.forEach((record) => {
    const key = record.sourceOutputLineId || record.ticketNo;
    if (!key) return;
    const bucket = printedByOutput.get(key) || [];
    bucket.push(record);
    printedByOutput.set(key, bucket);
  });
  const rows = [];
  generatedRecords.forEach((generated, index) => {
    const relatedRecords = [
      ...printedByOutput.get(generated.sourceOutputLineId) || [],
      ...bundle.ticketRecords.filter((record) => record.ticketNo === generated.feiTicketNo)
    ].filter((record, recordIndex, source) => source.findIndex((item) => item.ticketRecordId === record.ticketRecordId) === recordIndex);
    const sortedRecords = relatedRecords.sort((left, right) => {
      const leftVersion = left.version ?? left.reprintCount + 1;
      const rightVersion = right.version ?? right.reprintCount + 1;
      if (leftVersion !== rightVersion) return rightVersion - leftVersion;
      return (right.printedAt || "").localeCompare(left.printedAt || "", "zh-CN");
    });
    const latestRecord = sortedRecords[0] || null;
    const validRecord = sortedRecords.find((record) => record.status !== "VOIDED") || null;
    const voidedRecord = sortedRecords.find((record) => record.status === "VOIDED") || null;
    const sourceForLines = validRecord || voidedRecord || generated;
    const lines = buildSpecialCraftLinesFromRecord(sourceForLines);
    const baseRow = {
      tab: validRecord ? "PRINTED" : "WAIT_FIRST",
      ticketId: validRecord?.ticketRecordId || generated.feiTicketId,
      ticketNo: validRecord?.ticketNo || generated.feiTicketNo,
      versionLabel: getTicketRecordVersionLabel(validRecord),
      printStatusLabel: validRecord ? validRecord.reprintCount > 0 || (validRecord.version || 1) > 1 ? "\u5DF2\u8865\u6253" : "\u5DF2\u9996\u6253" : "\u5F85\u9996\u6253",
      productionOrderNo: generated.productionOrderNo,
      cutOrderNo: generated.cutOrderNo,
      markerPlanNo: generated.sourceMarkerPlanNo,
      markerNumber: generated.sourceMarkerNo || generated.markerNumber,
      spreadingOrderNo: generated.sourceSpreadingSessionNo || generated.spreadingOrderNo,
      spuCode: generated.sourceTechPackSpuCode,
      color: generated.skuColor || generated.fabricColor,
      size: generated.skuSize,
      partName: generated.partName,
      pieceQty: generated.actualCutPieceQty,
      pieceSequenceLabel: generated.pieceSequenceLabel || "\u4E0D\u53EF\u751F\u6210",
      hasSpecialCraft: generated.hasSpecialCraft,
      specialCraftLines: lines.specialCraftLines,
      receiverFactoryLines: lines.receiverFactoryLines,
      firstPrintedAt: validRecord?.printedAt || "",
      latestReprintAt: validRecord && (validRecord.reprintCount > 0 || (validRecord.version || 1) > 1) ? validRecord.printedAt : "",
      printCount: validRecord ? Math.max((validRecord.reprintCount || 0) + 1, 1) : 0,
      printedBy: validRecord?.printedBy || "",
      reason: "",
      record: validRecord,
      generated
    };
    if (validRecord) rows.push(baseRow);
    else rows.push(baseRow);
    if (voidedRecord) rows.push(buildSyntheticVoidedRow(generated, voidedRecord));
    if (!validRecord && voidedRecord) rows.push(buildSyntheticReprintRow(generated, voidedRecord));
    if (index === 2 && !rows.some((row) => row.tab === "NEED_REPRINT")) rows.push(buildSyntheticReprintRow(generated, latestRecord));
    if (index === 4 && !rows.some((row) => row.tab === "VOIDED")) rows.push(buildSyntheticVoidedRow(generated, latestRecord));
  });
  return rows;
}
function findFeiWorkbenchRow(bundle, ticketId) {
  const normalized = normalizeTicketRouteId(ticketId);
  const rows = buildFeiTicketWorkbenchRows(bundle);
  return rows.find(
    (row) => row.ticketId === normalized || row.ticketNo === normalized || row.generated.feiTicketId === normalized || row.generated.feiTicketNo === normalized || row.generated.sourceOutputLineId === normalized || row.ticketId.replace(/:(reprint-review|void-demo)$/, "") === normalized
  ) || null;
}
function renderGenerationEligibilityArea() {
  const rows = listFeiTicketGenerationEligibilityRows();
  const visibleRows = rows.slice(0, 9);
  return `
    <section class="rounded-lg border bg-white p-3 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-slate-900">\u5B9E\u9645\u88C1\u526A\u4EA7\u51FA\u6821\u9A8C</h2>
        <span class="text-xs text-slate-500">\u6B63\u5F0F\u83F2\u7968\u53EA\u80FD\u4ECE\u5B9E\u9645\u88C1\u526A\u4EA7\u51FA\u751F\u6210</span>
      </div>
      <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        ${visibleRows.map((row) => {
    const ok = row.eligibility.canGenerate;
    const statusClass = ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700";
    const statusText = ok ? "\u53EF\u751F\u6210\u83F2\u7968" : row.eligibility.reasonTexts.join(" / ") || "\u4E0D\u53EF\u751F\u6210";
    return `
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="text-sm font-semibold text-slate-900">${escapeHtml(row.scenarioLabel)}</p>
                    <p class="mt-1 text-xs text-slate-500">${escapeHtml(row.output?.spreadingOrderNo || row.output?.outputNo || "\u5F85\u8865\u5B9E\u9645\u4EA7\u51FA")}</p>
                  </div>
                  <span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${statusClass}">${escapeHtml(statusText)}</span>
                </div>
                <p class="mt-2 text-xs text-slate-500">${escapeHtml(row.output ? `${row.output.cutOrderNo || "\u7F3A\u5C11\u88C1\u7247\u5355"} / ${row.output.partName || "\u5F85\u8865\u90E8\u4F4D"} / ${formatCount(row.output.actualPieceQty)} \u7247` : "\u7F3A\u5C11\u5B9E\u9645\u88C1\u526A\u4EA7\u51FA")}</p>
              </div>
            `;
  }).join("")}
      </div>
    </section>
  `;
}
function renderSpecialCraftSummary(crafts) {
  if (!crafts?.length) return '<span class="text-slate-500">\u65E0</span>';
  return `
    <div class="space-y-1">
      ${crafts.map(
    (craft) => `
            <div class="rounded-md border border-slate-200 bg-white px-2 py-1">
              <p class="text-xs font-semibold text-slate-900">${escapeHtml(`${craft.craftType} / ${craft.craftCategory}`)}</p>
              <p class="text-xs text-slate-500">${escapeHtml(craft.receiverFactoryName || "\u627F\u63A5\u5DE5\u5382\u5F85\u8865\u5145")}</p>
              <p class="text-xs text-slate-500">${escapeHtml(`${craft.affectedPartName || "\u5F85\u8865\u90E8\u4F4D"} / ${craft.affectedSize || "\u5F85\u8865\u5C3A\u7801"} / ${formatCount(craft.affectedPieceQty)} \u7247 / ${craft.requirementSource}`)}</p>
            </div>
          `
  ).join("")}
    </div>
  `;
}
function renderSpecialCraftFieldArea() {
  const tickets = listGeneratedFeiTickets();
  const sampleTickets = tickets.slice(0, 8);
  return `
    <section class="rounded-lg border bg-white p-3 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-slate-900">\u83F2\u7968\u7279\u6B8A\u5DE5\u827A\u5B57\u6BB5</h2>
        <span class="text-xs text-slate-500">\u5B57\u6BB5\u6765\u81EA\u5B9E\u9645\u88C1\u526A\u4EA7\u51FA\u3001\u88C1\u7247\u5355\u660E\u7EC6\u548C\u6280\u672F\u5305\u914D\u7F6E\uFF1B\u627F\u63A5\u5DE5\u5382\u53EA\u4F5C\u540E\u7EED\u5206\u62E3\u6307\u5F15</span>
      </div>
      <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        ${sampleTickets.map(
    (ticket) => `
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="text-sm font-semibold text-slate-900">${escapeHtml(ticket.feiTicketNo)}</p>
                    <p class="mt-1 text-xs text-slate-500">${escapeHtml(`${ticket.partName} / ${ticket.skuSize}`)}</p>
                  </div>
                  <span class="inline-flex rounded-full border ${ticket.hasSpecialCraft ? "border-amber-200 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600"} px-2 py-0.5 text-xs font-medium">${ticket.hasSpecialCraft ? "\u6709\u7279\u6B8A\u5DE5\u827A" : "\u65E0\u7279\u6B8A\u5DE5\u827A"}</span>
                </div>
                <div class="mt-2 text-xs">
                  <p class="font-medium text-slate-700">\u7279\u6B8A\u5DE5\u827A\u7C7B\u578B / \u627F\u63A5\u5DE5\u5382</p>
                  <div class="mt-1">${renderSpecialCraftSummary(ticket.specialCrafts)}</div>
                </div>
              </div>
            `
  ).join("")}
      </div>
    </section>
  `;
}
function renderPieceSequenceSummary(source) {
  if (!source.pieceSequenceRange) {
    return `<span class="text-amber-700">${escapeHtml(source.pieceSequenceCannotGenerateReason || "\u7F3A\u5C11\u5B9E\u9645\u88C1\u526A\u4EA7\u51FA")}</span>`;
  }
  const instanceText = source.pieceSequenceRange.partInstanceNo ? `\u90E8\u4F4D\u5B9E\u4F8B ${source.pieceSequenceRange.partInstanceNo}` : "\u5355\u90E8\u4F4D\u5B9E\u4F8B";
  return `
    <div class="space-y-0.5">
      <p class="font-semibold text-slate-900">${escapeHtml(source.pieceSequenceLabel)}</p>
      <p class="text-xs text-slate-500">${escapeHtml(`${source.pieceSequenceRange.sizeGroupId} / ${instanceText}`)}</p>
      <p class="text-xs text-slate-500">${escapeHtml(`\u4F9D\u636E\uFF1A${source.pieceSequenceRange.actualLayerSource} ${formatCount(source.pieceSequenceRange.actualLayerCount)} \u5C42\u5E8F / \u5B9E\u9645 ${formatCount(source.pieceSequenceRange.actualPieceQty)} \u7247`)}</p>
    </div>
  `;
}
function renderPieceSequenceRangeArea() {
  const rows = listPieceSequenceRangeScenarioRows();
  return `
    <section class="rounded-lg border bg-white p-3 shadow-sm">
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-semibold text-slate-900">\u90E8\u4F4D\u88C1\u7247\u7F16\u53F7\u8303\u56F4</h2>
        <span class="text-xs text-slate-500">\u6309\u5E8A\u6B21\u5C42\u5E8F\u751F\u6210\uFF0C\u9ED8\u8BA4\u4ECE 1 \u5F00\u59CB\uFF0C\u4E0D\u6309\u9700\u6C42\u6570\u91CF\u6216\u8BA1\u5212\u6570\u91CF\u653E\u5927</span>
      </div>
      <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        ${rows.map(
    (row) => `
              <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="text-sm font-semibold text-slate-900">${escapeHtml(row.scenarioLabel)}</p>
                    <p class="mt-1 text-xs text-slate-500">${escapeHtml(`${row.feiTicketNo} / ${row.markerModeLabel}`)}</p>
                  </div>
                  <span class="inline-flex rounded-full border ${row.pieceSequenceRange ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"} px-2 py-0.5 text-xs font-medium">${escapeHtml(row.pieceSequenceLabel)}</span>
                </div>
                <div class="mt-2 text-xs">
                  <p class="font-medium text-slate-700">${escapeHtml(`${row.partName} / ${row.size}`)}</p>
                  <div class="mt-1">${renderPieceSequenceSummary(row)}</div>
                </div>
              </div>
            `
  ).join("")}
      </div>
    </section>
  `;
}
function buildRowActionGroups(unit) {
  const detailHref = buildActionHref("fei-ticket-detail", unit);
  const printedHref = buildActionHref("fei-ticket-printed", unit);
  const recordsHref = buildActionHref("fei-ticket-records", unit);
  const printHref = buildFeiTicketLabelPrintLink(unit.printableUnitId, "first");
  const reprintHref = buildFeiTicketLabelPrintLink(unit.printableUnitId, "reprint");
  if (unit.printableUnitStatus === "WAITING_PRINT") {
    return {
      primary: { label: "\u6253\u5370\u83F2\u7968", href: printHref },
      secondary: { label: "\u67E5\u770B\u8BE6\u60C5", href: detailHref },
      more: []
    };
  }
  if (unit.printableUnitStatus === "NEED_REPRINT") {
    return {
      primary: { label: "\u8865\u6253", href: reprintHref },
      secondary: { label: "\u67E5\u770B\u8BE6\u60C5", href: detailHref },
      more: [
        { label: "\u67E5\u770B\u5DF2\u6253\u5370\u83F2\u7968", href: printedHref },
        { label: "\u67E5\u770B\u6253\u5370\u8BB0\u5F55", href: recordsHref }
      ]
    };
  }
  return {
    primary: null,
    secondary: { label: "\u67E5\u770B\u8BE6\u60C5", href: detailHref },
    more: [
      { label: "\u67E5\u770B\u5DF2\u6253\u5370\u83F2\u7968", href: printedHref },
      { label: "\u67E5\u770B\u6253\u5370\u8BB0\u5F55", href: recordsHref }
    ]
  };
}
function renderRowActions(unit) {
  const actions = buildRowActionGroups(unit);
  return `
    <div class="flex items-center gap-2 whitespace-nowrap">
      ${actions.primary ? `<button type="button" data-nav="${escapeHtml(actions.primary.href)}" class="inline-flex min-h-8 items-center rounded-md border border-blue-600 bg-blue-600 px-3 text-xs font-medium text-white transition hover:bg-blue-700">${escapeHtml(actions.primary.label)}</button>` : ""}
      <button type="button" data-nav="${escapeHtml(actions.secondary.href)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50">${escapeHtml(actions.secondary.label)}</button>
      ${actions.more.length ? `
            <details class="relative">
              <summary class="inline-flex min-h-8 cursor-pointer list-none items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50">\u66F4\u591A</summary>
              <div class="absolute right-0 z-20 mt-2 min-w-[144px] rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                ${actions.more.map(
    (action) => `
                      <button type="button" data-nav="${escapeHtml(action.href)}" class="flex w-full items-center rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50">
                        ${escapeHtml(action.label)}
                      </button>
                    `
  ).join("")}
              </div>
            </details>
          ` : ""}
    </div>
  `;
}
function renderTruncatedText(value, fallback = "\u2014", maxWidthClass = "max-w-[12rem]") {
  const text = value || fallback;
  return `<span class="block ${maxWidthClass} truncate whitespace-nowrap" title="${escapeHtml(text)}">${escapeHtml(text)}</span>`;
}
function renderPrintablePageShell(content) {
  return `<div class="space-y-3 p-4">${content}</div>`;
}
function renderWorkbenchTabs(activeTab, rows, printRecordCount) {
  const counts = {
    WAIT_FIRST: rows.filter((row) => row.tab === "WAIT_FIRST").length,
    PRINTED: rows.filter((row) => row.tab === "PRINTED").length,
    NEED_REPRINT: rows.filter((row) => row.tab === "NEED_REPRINT").length,
    VOIDED: rows.filter((row) => row.tab === "VOIDED").length,
    PRINT_RECORDS: printRecordCount
  };
  return `
    <section class="rounded-lg border bg-white p-3 shadow-sm">
      <div class="flex flex-wrap gap-2">
        ${Object.keys(workbenchTabLabels).map((tab) => {
    const active = activeTab === tab;
    const className = active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50";
    return `<button type="button" data-nav="${escapeHtml(buildWorkbenchTabHref(tab))}" class="inline-flex min-h-10 items-center gap-2 rounded-md border px-3 text-sm font-medium transition ${className}"><span>${escapeHtml(workbenchTabLabels[tab])}</span><span class="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">${formatCount(counts[tab])}</span></button>`;
  }).join("")}
      </div>
    </section>
  `;
}
function renderLifecycleStatusBadge(row) {
  const className = row.tab === "WAIT_FIRST" ? "border border-slate-200 bg-slate-100 text-slate-700" : row.tab === "PRINTED" ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : row.tab === "NEED_REPRINT" ? "border border-amber-200 bg-amber-50 text-amber-700" : "border border-rose-200 bg-rose-50 text-rose-700";
  return renderBadge(row.printStatusLabel, className);
}
function joinCompactLines(lines, max = 2) {
  const visible = lines.filter(Boolean);
  if (!visible.length) return "\u65E0";
  if (visible.length <= max) return visible.join("\uFF1B");
  return `${visible.slice(0, max).join("\uFF1B")}\uFF1B\u53E6 ${visible.length - max} \u9879`;
}
function renderWorkbenchRowActions(row) {
  const detailHref = buildStandaloneFeiTicketHref(row.ticketId);
  const printHref = buildStandaloneFeiTicketHref(row.ticketId, "/print");
  const reprintHref = buildStandaloneFeiTicketHref(row.ticketId, "/reprint");
  const voidHref = buildStandaloneFeiTicketHref(row.ticketId, "/void");
  const recordHref = `/fcs/craft/cutting/fei-tickets/print-records?ticketId=${encodeURIComponent(row.ticketId)}`;
  const canPrint = row.tab === "WAIT_FIRST";
  const canReprint = row.tab === "PRINTED" || row.tab === "NEED_REPRINT";
  const canVoid = row.tab === "PRINTED" || row.tab === "NEED_REPRINT";
  return `
    <div class="flex flex-wrap gap-1.5">
      <button type="button" data-nav="${escapeHtml(detailHref)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">\u67E5\u770B</button>
      ${canPrint ? `<button type="button" data-nav="${escapeHtml(printHref)}" class="inline-flex min-h-8 items-center rounded-md border border-blue-600 bg-blue-600 px-2.5 text-xs font-medium text-white hover:bg-blue-700">\u6253\u5370</button>` : ""}
      ${canReprint ? `<button type="button" data-nav="${escapeHtml(reprintHref)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">\u8865\u6253</button>` : ""}
      ${canVoid ? `<button type="button" data-nav="${escapeHtml(voidHref)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">\u4F5C\u5E9F</button>` : ""}
      <button type="button" data-nav="${escapeHtml(recordHref)}" class="inline-flex min-h-8 items-center rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50">\u67E5\u770B\u8BB0\u5F55</button>
    </div>
  `;
}
function renderFeiTicketWorkbenchCard(row) {
  return `
    <article class="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div class="grid gap-3 xl:grid-cols-[1.05fr_1.2fr_1.25fr_1.1fr_1fr_auto] xl:items-start">
        <div>
          <p class="mb-1 text-xs text-slate-500">\u83F2\u7968\u53F7</p>
          <div class="flex flex-wrap items-center gap-2">
            <button type="button" data-nav="${escapeHtml(buildStandaloneFeiTicketHref(row.ticketId))}" class="text-left text-sm font-semibold text-blue-700 hover:underline">${escapeHtml(row.ticketNo)}</button>
            ${renderLifecycleStatusBadge(row)}
          </div>
          <p class="mt-1 text-xs text-slate-500">${escapeHtml(`${row.versionLabel} / ${row.printStatusLabel}`)}</p>
        </div>
        <div class="space-y-1 text-xs text-slate-600">
          <p class="font-semibold text-slate-900">\u6765\u6E90</p>
          <p><span class="text-slate-400">\u751F\u4EA7\u5355\uFF1A</span><span class="font-medium text-slate-800">${escapeHtml(row.productionOrderNo)}</span></p>
          <p><span class="text-slate-400">\u88C1\u7247\u5355\uFF1A</span><span class="font-medium text-slate-800">${escapeHtml(row.cutOrderNo)}</span></p>
          <p><span class="text-slate-400">\u551B\u67B6\u65B9\u6848\uFF1A</span><span class="font-medium text-slate-800">${escapeHtml(row.markerPlanNo || "\u5F85\u8865")}</span></p>
          <p><span class="text-slate-400">\u94FA\u5E03\u5355\uFF1A</span><span class="font-medium text-slate-800">${escapeHtml(row.spreadingOrderNo || "\u5F85\u8865")}</span></p>
        </div>
        <div class="space-y-1 text-xs text-slate-600">
          <p class="font-semibold text-slate-900">\u88C1\u7247</p>
          <p><span class="text-slate-400">SPU\uFF1A</span><span class="font-medium text-slate-800">${escapeHtml(row.spuCode || "\u5F85\u8865")}</span></p>
          <p><span class="text-slate-400">\u989C\u8272 / \u5C3A\u7801\uFF1A</span><span class="font-medium text-slate-800">${escapeHtml(`${row.color || "\u5F85\u8865"} / ${row.size || "\u5F85\u8865"}`)}</span></p>
          <p><span class="text-slate-400">\u90E8\u4F4D\uFF1A</span><span class="font-medium text-slate-800">${escapeHtml(row.partName || "\u5F85\u8865")}</span></p>
          <p><span class="text-slate-400">\u88C1\u7247\u6570\u91CF\uFF1A</span><span class="font-semibold text-slate-900">${formatCount(row.pieceQty)} \u7247</span><span class="ml-2 text-slate-400">\u7F16\u53F7\u8303\u56F4\uFF1A</span><span class="font-semibold text-slate-900">${escapeHtml(row.pieceSequenceLabel || "\u4E0D\u53EF\u751F\u6210")}</span></p>
        </div>
        <div class="space-y-1 text-xs text-slate-600">
          <p class="font-semibold text-slate-900">\u7279\u6B8A\u5DE5\u827A</p>
          <p><span class="text-slate-400">\u662F\u5426\u6709\u7279\u6B8A\u5DE5\u827A\uFF1A</span><span class="font-medium text-slate-800">${row.hasSpecialCraft ? "\u662F" : "\u65E0"}</span></p>
          <p><span class="text-slate-400">\u7279\u6B8A\u5DE5\u827A\u7C7B\u578B\uFF1A</span><span class="font-medium text-slate-800">${escapeHtml(joinCompactLines(row.specialCraftLines, 2))}</span></p>
          <p><span class="text-slate-400">\u627F\u63A5\u5DE5\u5382\uFF1A</span><span class="font-medium text-slate-800">${escapeHtml(joinCompactLines(row.receiverFactoryLines, 2))}</span></p>
        </div>
        <div class="space-y-1 text-xs text-slate-600">
          <p class="font-semibold text-slate-900">\u6253\u5370\u4FE1\u606F</p>
          <p><span class="text-slate-400">\u9996\u6253\u65F6\u95F4\uFF1A</span><span class="font-medium text-slate-800">${escapeHtml(row.firstPrintedAt || "\u5F85\u9996\u6253")}</span></p>
          <p><span class="text-slate-400">\u6700\u8FD1\u8865\u6253\uFF1A</span><span class="font-medium text-slate-800">${escapeHtml(row.latestReprintAt || "\u65E0")}</span></p>
          <p><span class="text-slate-400">\u6253\u5370\u6B21\u6570\uFF1A</span><span class="font-medium text-slate-800">${formatCount(row.printCount)}</span></p>
          <p><span class="text-slate-400">\u6253\u5370\u4EBA\uFF1A</span><span class="font-medium text-slate-800">${escapeHtml(row.printedBy || "\u5F85\u6253\u5370")}</span></p>
          ${row.reason ? `<p><span class="text-slate-400">\u539F\u56E0\uFF1A</span><span class="font-medium text-slate-800">${escapeHtml(row.reason)}</span></p>` : ""}
        </div>
        <div class="xl:w-[176px]">${renderWorkbenchRowActions(row)}</div>
      </div>
    </article>
  `;
}
function renderPrintRecordsWorkbench(bundle) {
  const rows = bundle.printJobs;
  if (!rows.length) {
    return `<section class="rounded-lg border bg-white p-8 text-center text-sm text-slate-500 shadow-sm">\u6682\u65E0\u6253\u5370\u8BB0\u5F55\u3002</section>`;
  }
  return `
    <section class="rounded-lg border bg-white shadow-sm">
      <div class="divide-y divide-slate-100">
        ${rows.map((record) => {
    const size = record.templateName?.includes("15") ? "15cm x 10cm" : "10cm x 10cm";
    return `
              <article class="grid gap-3 p-3 text-sm xl:grid-cols-[1fr_1fr_1fr_1fr_1fr]">
                <div><p class="text-xs text-slate-500">\u6253\u5370\u8BB0\u5F55\u53F7</p><p class="font-semibold text-slate-900">${escapeHtml(record.printJobNo)}</p></div>
                <div><p class="text-xs text-slate-500">\u83F2\u7968\u53F7</p><p class="font-medium text-slate-900">${escapeHtml((record.ticketRecordIds || []).slice(0, 2).join(" / ") || "\u6309\u6253\u5370\u5355\u5143")}</p></div>
                <div><p class="text-xs text-slate-500">\u6253\u5370\u7C7B\u578B / \u6253\u5370\u5C3A\u5BF8</p><p class="font-medium text-slate-900">${escapeHtml(formatOperationTypeLabel(record.operationType || "FIRST_PRINT"))} / ${escapeHtml(size)}</p></div>
                <div><p class="text-xs text-slate-500">\u6253\u5370\u4EBA / \u6253\u5370\u65F6\u95F4</p><p class="font-medium text-slate-900">${escapeHtml(record.printedBy || "\u5F85\u8865")} / ${escapeHtml(record.printedAt || "\u5F85\u8865")}</p></div>
                <div><p class="text-xs text-slate-500">\u6253\u5370\u539F\u56E0 / \u6253\u5370\u7ED3\u679C</p><p class="font-medium text-slate-900">${escapeHtml(record.reason || record.note || "\u9996\u6253")} / ${escapeHtml(record.status === "CANCELLED" ? "\u5DF2\u53D6\u6D88" : record.status === "REPRINTED" ? "\u5DF2\u8865\u6253" : "\u5DF2\u6253\u5370")}</p></div>
              </article>
            `;
  }).join("")}
      </div>
    </section>
  `;
}
function renderListTable(bundle) {
  if (!bundle.filteredUnits.length) {
    const title = bundle.printableViewModel.units.length ? "\u6682\u65E0\u5339\u914D\u7ED3\u679C" : "\u6682\u65E0\u5F85\u6253\u5370\u5BF9\u8C61";
    return `
      <section class="rounded-lg border bg-white px-6 py-10 text-center shadow-sm">
        <h2 class="text-base font-semibold text-slate-900">${escapeHtml(title)}</h2>
      </section>
    `;
  }
  const tableHtml = `
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 z-10 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-3 text-left font-medium">\u53EF\u6253\u5370\u5355\u5143\u53F7</th>
          <th class="px-3 py-3 text-left font-medium">\u5355\u5143\u7C7B\u578B</th>
          <th class="px-3 py-3 text-left font-medium">\u6B3E\u53F7</th>
          <th class="px-3 py-3 text-left font-medium">\u9762\u6599</th>
          <th class="px-3 py-3 text-left font-medium">\u6765\u6E90\u751F\u4EA7\u5355\u6570</th>
          <th class="px-3 py-3 text-left font-medium">\u6765\u6E90\u88C1\u7247\u5355\u6570</th>
          <th class="px-3 py-3 text-left font-medium">\u5E94\u6253\u83F2\u7968\u6570</th>
          <th class="px-3 py-3 text-left font-medium">\u6709\u6548\u5DF2\u6253\u5370\u6570</th>
          <th class="px-3 py-3 text-left font-medium">\u672A\u6253\u5370 / \u7F3A\u53E3\u6570</th>
          <th class="px-3 py-3 text-left font-medium">\u5DF2\u4F5C\u5E9F\u6570</th>
          <th class="px-3 py-3 text-left font-medium">\u6253\u5370\u72B6\u6001</th>
          <th class="px-3 py-3 text-left font-medium">\u6700\u8FD1\u6253\u5370\u65F6\u95F4</th>
          <th class="px-3 py-3 text-left font-medium">\u6700\u8FD1\u6253\u5370\u4EBA</th>
          <th class="px-3 py-3 text-left font-medium">\u64CD\u4F5C</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        ${bundle.filteredUnits.map((unit) => {
    const statusMeta = getPrintableUnitStatusMeta(unit.printableUnitStatus);
    const spreadingTraceText = buildSpreadingTraceText(unit);
    return `
              <tr class="hover:bg-slate-50/60">
                <td class="px-3 py-2.5">
                  <button type="button" data-nav="${escapeHtml(buildActionHref("fei-ticket-detail", unit))}" class="text-left font-semibold text-blue-700 hover:underline" title="${escapeHtml(unit.printableUnitNo)}">
                    ${renderTruncatedText(unit.printableUnitNo, "\u2014", "max-w-[13rem]")}
                  </button>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(`\u6765\u6E90\u94FA\u5E03\uFF1A${spreadingTraceText}`)}</p>
                </td>
                <td class="px-3 py-2.5 whitespace-nowrap">${renderUnitTypeBadge(unit.printableUnitType)}</td>
                <td class="px-3 py-2.5 text-slate-700">${renderTruncatedText(unit.styleCode || "\u5F85\u8865\u6B3E\u53F7", "\u5F85\u8865\u6B3E\u53F7", "max-w-[8rem]")}</td>
                <td class="px-3 py-2.5 text-slate-700">${renderMaterialIdentityBlock({
      materialSku: unit.fabricSku || "\u5F85\u8865\u9762\u6599",
      materialLabel: unit.fabricSku || "\u5F85\u8865\u9762\u6599",
      materialAlias: unit.materialAlias,
      materialImageUrl: unit.materialImageUrl
    }, { compact: true, imageSizeClass: "h-9 w-9" })}</td>
                <td class="px-3 py-2.5 text-slate-700">${formatCount(unit.sourceProductionOrderCount)}</td>
                <td class="px-3 py-2.5 text-slate-700">${formatCount(unit.sourceCutOrderCount)}</td>
                <td class="px-3 py-2.5 font-medium text-slate-900">${formatCount(unit.requiredTicketCount)}</td>
                <td class="px-3 py-2.5 text-slate-700">${formatCount(unit.validPrintedTicketCount)}</td>
                <td class="px-3 py-2.5 text-slate-700">${formatCount(unit.missingTicketCount)}</td>
                <td class="px-3 py-2.5 text-slate-700">${formatCount(unit.voidedTicketCount)}</td>
                <td class="px-3 py-2.5 whitespace-nowrap">
                  <div class="flex items-center gap-2">
                    ${renderBadge(statusMeta.label, statusMeta.className)}
                    <span class="text-xs text-slate-500">\u7F3A\u53E3 ${formatCount(unit.missingTicketCount)}</span>
                  </div>
                </td>
                <td class="px-3 py-2.5 text-slate-700">${renderTruncatedText(formatDateTime(unit.lastPrintedAt), "\u672A\u6253\u5370", "max-w-[8rem]")}</td>
                <td class="px-3 py-2.5 text-slate-700">${renderTruncatedText(unit.lastPrintedBy || "\u672A\u6253\u5370", "\u672A\u6253\u5370", "max-w-[6rem]")}</td>
                <td class="px-3 py-2.5">
                  <div class="min-w-[180px]">
                    ${renderRowActions(unit)}
                  </div>
                </td>
              </tr>
            `;
  }).join("")}
      </tbody>
    </table>
  `;
  return `
    <section class="rounded-lg border bg-white shadow-sm">
      ${renderStickyTableScroller(tableHtml, "max-h-[68vh]")}
    </section>
  `;
}
function renderListPage() {
  const bundle = getDataBundle();
  const pathname = getCurrentPathname();
  const meta = getCanonicalCuttingMeta(pathname, "fei-tickets");
  const summaryAction = renderReturnToSummaryButton();
  const rows = buildFeiTicketWorkbenchRows(bundle);
  const activeTab = getWorkbenchActiveTab();
  const visibleRows = activeTab === "PRINT_RECORDS" ? [] : rows.filter((row) => row.tab === activeTab);
  const body = `
    ${renderFilterArea()}
    ${renderWorkbenchTabs(activeTab, rows, bundle.printJobs.length)}
    ${activeTab === "PRINT_RECORDS" ? renderPrintRecordsWorkbench(bundle) : visibleRows.length ? `<section class="space-y-2">${visibleRows.map((row) => renderFeiTicketWorkbenchCard(row)).join("")}</section>` : '<section class="rounded-lg border bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">\u5F53\u524D\u9875\u7B7E\u6682\u65E0\u83F2\u7968\u3002</section>'}
  `;
  return renderPrintablePageShell(`
    ${renderCuttingPageHeader(meta, {
    showAliasBadge: isCuttingAliasPath(pathname),
    actionsHtml: summaryAction ? `<div class="flex flex-wrap gap-2">${summaryAction}</div>` : ""
  })}
    ${body}
  `);
}
function renderBackToList(unit) {
  return `<button type="button" data-nav="${escapeHtml(unit ? buildActionHref("fei-tickets", unit) : getCanonicalCuttingPath("fei-tickets"))}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">\u8FD4\u56DE\u6253\u5370\u83F2\u7968\u5217\u8868</button>`;
}
function renderDetailHeaderActions(unit) {
  const actions = buildRowActionGroups(unit);
  return `
    <div class="flex flex-wrap gap-2">
      ${actions.primary ? `<button type="button" data-nav="${escapeHtml(actions.primary.href)}" class="inline-flex min-h-10 items-center rounded-md border border-blue-600 bg-blue-600 px-3 text-sm font-medium text-white transition hover:bg-blue-700">${escapeHtml(actions.primary.label)}</button>` : ""}
      <button type="button" data-nav="${escapeHtml(actions.secondary.href)}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">${escapeHtml(actions.secondary.label)}</button>
      ${actions.more.length ? actions.more.map(
    (action) => `<button type="button" data-nav="${escapeHtml(action.href)}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">${escapeHtml(action.label)}</button>`
  ).join("") : ""}
    </div>
  `;
}
function renderDetailSummary(detailView) {
  const { unit } = detailView;
  const sourceMarkerText = unit.sourceMarkerNos.join(" / ") || "\u5F85\u8865";
  const sourceCutOrderText = unit.sourceCutOrderNos.join(" / ") || "\u5F85\u8865";
  const sourceMarkerPlanText = unit.batchNo || "\u672A\u5173\u8054\u551B\u67B6\u65B9\u6848";
  return `
    <section class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs text-slate-500">\u53EF\u6253\u5370\u5355\u5143\u53F7</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(unit.printableUnitNo)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs text-slate-500">\u5355\u5143\u7C7B\u578B</p>
            <div class="mt-1">${renderUnitTypeBadge(unit.printableUnitType)}</div>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs text-slate-500">\u6B3E\u53F7</p>
            <p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(unit.styleCode || "\u5F85\u8865\u6B3E\u53F7")}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs text-slate-500">\u9762\u6599</p>
            <div class="mt-2">${renderMaterialIdentityBlock({
    materialSku: unit.fabricSku || "\u5F85\u8865\u9762\u6599",
    materialLabel: unit.fabricSku || "\u5F85\u8865\u9762\u6599",
    materialAlias: unit.materialAlias,
    materialImageUrl: unit.materialImageUrl
  }, { compact: true })}</div>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">\u6765\u6E90\u751F\u4EA7\u5355\u6570</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">${formatCount(unit.sourceProductionOrderCount)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">\u6765\u6E90\u88C1\u7247\u5355\u6570</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">${formatCount(unit.sourceCutOrderCount)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">\u5E94\u6253\u83F2\u7968\u6570</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">${formatCount(unit.requiredTicketCount)}</p>
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <span class="inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${unit.ticketCountBasisType === FEI_TICKET_SOURCE_BASIS_TYPE ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}">${escapeHtml(unit.ticketCountBasisLabel)}</span>
              <span class="text-xs text-slate-500">${escapeHtml(unit.ticketCountBasisType === FEI_TICKET_SOURCE_BASIS_TYPE ? "\u6309\u5B9E\u9645\u88C1\u7247\u6570\u91CF\u62C6\u5206" : "\u5F53\u524D\u5C1A\u672A\u5F62\u6210\u5B9E\u9645\u88C1\u526A\u4EA7\u51FA")}</span>
            </div>
            <p class="mt-1 text-xs text-slate-500">${escapeHtml(unit.ticketCountBasisDetail)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">\u6709\u6548\u5DF2\u6253\u5370\u6570</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">${formatCount(unit.validPrintedTicketCount)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">\u5DF2\u4F5C\u5E9F\u6570</p>
            <p class="mt-1 text-xl font-semibold text-slate-900">${formatCount(unit.voidedTicketCount)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">\u5F53\u524D\u72B6\u6001</p>
            <div class="mt-1">${renderStatusBadge(unit.printableUnitStatus)}</div>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">\u6700\u8FD1\u6253\u5370\u65F6\u95F4</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(formatDateTime(unit.lastPrintedAt))}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">\u6700\u8FD1\u6253\u5370\u4EBA</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(unit.lastPrintedBy || "\u672A\u6253\u5370")}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3 md:col-span-2 xl:col-span-4">
            <p class="text-xs text-slate-500">\u6765\u6E90\u94FA\u5E03</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(buildSpreadingTraceText(unit))}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">\u6765\u6E90\u551B\u67B6</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(sourceMarkerText)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">\u6765\u6E90\u88C1\u7247\u5355</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(sourceCutOrderText)}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-white p-3">
            <p class="text-xs text-slate-500">\u6765\u6E90\u551B\u67B6\u65B9\u6848</p>
            <p class="mt-1 text-sm font-medium text-slate-900">${escapeHtml(sourceMarkerPlanText)}</p>
          </div>
        </div>
        ${renderDetailHeaderActions(unit)}
      </div>
    </section>
  `;
}
function renderDetailTabs(unit, activeTab) {
  const tabs = [
    { key: "split", label: "\u83F2\u7968\u62C6\u5206\u660E\u7EC6", href: buildDetailRoute("fei-ticket-detail", unit, { tab: "split" }) },
    { key: "printed", label: "\u5DF2\u6253\u5370\u83F2\u7968", href: buildDetailRoute("fei-ticket-printed", unit) },
    { key: "records", label: "\u6253\u5370\u8BB0\u5F55", href: buildDetailRoute("fei-ticket-records", unit) }
  ];
  return `
    <section class="rounded-lg border bg-white p-3 shadow-sm">
      <div class="flex flex-wrap gap-2">
        ${tabs.map((tab) => {
    const active = tab.key === activeTab;
    const className = active ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50";
    return `<button type="button" data-nav="${escapeHtml(tab.href)}" class="inline-flex min-h-10 items-center rounded-lg border px-4 text-sm font-medium transition ${className}">${escapeHtml(tab.label)}</button>`;
  }).join("")}
      </div>
    </section>
  `;
}
function renderSectionCard(title, _subtitle, content) {
  return `
    <section class="rounded-lg border bg-white shadow-sm">
      <div class="border-b border-slate-200 px-4 py-3">
        <h2 class="text-sm font-semibold text-slate-900">${escapeHtml(title)}</h2>
      </div>
      <div class="p-4">${content}</div>
    </section>
  `;
}
function renderSplitDetailsTab(detailView) {
  const tableHtml = `
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-3 text-left font-medium">\u9762\u6599\u5377\u53F7</th>
          <th class="px-3 py-3 text-left font-medium">\u5E03\u6599\u989C\u8272</th>
          <th class="px-3 py-3 text-left font-medium">\u5C3A\u7801</th>
          <th class="px-3 py-3 text-left font-medium">\u88C1\u7247\u90E8\u4F4D</th>
          <th class="px-3 py-3 text-left font-medium">\u6570\u91CF</th>
          <th class="px-3 py-3 text-left font-medium">\u624E\u53F7</th>
          <th class="px-3 py-3 text-left font-medium">\u914D\u5957\u7F16\u53F7</th>
          <th class="px-3 py-3 text-left font-medium">\u90E8\u4F4D\u88C1\u7247\u7F16\u53F7\u8303\u56F4</th>
          <th class="px-3 py-3 text-left font-medium">\u7279\u6B8A\u5DE5\u827A / \u627F\u63A5\u5DE5\u5382</th>
          <th class="px-3 py-3 text-left font-medium">\u88C1\u7247\u5355</th>
          <th class="px-3 py-3 text-left font-medium">\u751F\u4EA7\u5355</th>
          <th class="px-3 py-3 text-left font-medium">\u7F3A\u53E3\u83F2\u7968\u6570</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        ${detailView.splitDetails.map(
    (detail) => `
              <tr>
                <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(detail.fabricRollNo || "\u6682\u65E0\u6570\u636E")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.fabricColor || "\u6682\u65E0\u6570\u636E")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.size || "\u5F85\u8865\u5C3A\u7801")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.partName)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(detail.quantity)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.bundleNo || "\u6682\u65E0\u6570\u636E")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.pieceSetNoRange || "\u6682\u65E0\u6570\u636E")}</td>
                <td class="px-3 py-3 text-slate-700">${renderPieceSequenceSummary(detail)}</td>
                <td class="px-3 py-3 text-slate-700">${renderSpecialCraftSummary(detail.specialCrafts)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.sourceCutOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.sourceProductionOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(detail.gapCount)}</td>
              </tr>
            `
  ).join("")}
      </tbody>
    </table>
  `;
  return renderSectionCard(
    "\u83F2\u7968\u62C6\u5206\u660E\u7EC6",
    "",
    renderStickyTableScroller(tableHtml, "max-h-[60vh]")
  );
}
function buildTicketPanelHref(unit, ticket, panel) {
  return buildActionHref("fei-ticket-printed", unit, {
    ticketId: ticket.ticketId,
    ticketRecordId: ticket.ticketId,
    panel
  });
}
function findCraftTraceItem(bundle, ticket) {
  if (!ticket) return null;
  return bundle.craftTraceProjection.itemsByTicketId[ticket.ticketId] || bundle.craftTraceProjection.itemsByTicketNo[ticket.ticketNo] || null;
}
function resolveSpecialCraftTaskRoute(ticketNo) {
  const binding = listCuttingSpecialCraftFeiTicketBindings().find((item) => item.feiTicketNo === ticketNo);
  return binding ? buildSpecialCraftTaskDetailPath(binding.operationId, binding.taskOrderId) : "/fcs/craft/cutting/special-processes";
}
function renderSpecialCraftFlowBlock(ticketNo) {
  const summary = getSpecialCraftFeiTicketSummary(ticketNo);
  return `
    <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p class="text-xs text-slate-500">\u7279\u6B8A\u5DE5\u827A\u6D41\u8F6C</p>
      <div class="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <div>
          <p class="text-xs text-slate-500">\u662F\u5426\u9700\u8981\u7279\u6B8A\u5DE5\u827A</p>
          <p class="text-sm font-semibold text-slate-900">${summary.needSpecialCraft ? "\u662F" : "\u65E0"}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">\u7279\u6B8A\u5DE5\u827A</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(summary.operationNames.join(" / ") || "\u5F85\u7ED1\u5B9A")}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">\u5DF2\u5B8C\u6210\u7279\u6B8A\u5DE5\u827A</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(summary.completedOperationNames.join(" / ") || "\u2014")}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">\u5F53\u524D\u7279\u6B8A\u5DE5\u827A</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(summary.currentOperationName)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">\u7279\u6B8A\u5DE5\u827A\u4EFB\u52A1</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(summary.taskOrderNos.join(" / ") || "\u5F85\u7ED1\u5B9A")}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">\u4EA4\u51FA\u72B6\u6001</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(formatDispatchLabel(summary.dispatchStatus))}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">\u56DE\u4ED3\u72B6\u6001</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(summary.returnStatus)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">\u5F53\u524D\u6240\u5728</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml(summary.currentLocation)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">\u539F\u6570\u91CF / \u5F53\u524D\u6570\u91CF</p>
          <p class="text-sm font-semibold text-slate-900">${formatCount(summary.originalQty)} / ${formatCount(summary.currentQty)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">\u7D2F\u8BA1\u62A5\u5E9F / \u7D2F\u8BA1\u8D27\u635F</p>
          <p class="text-sm font-semibold text-slate-900">${formatCount(summary.cumulativeScrapQty)} / ${formatCount(summary.cumulativeDamageQty)}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500">\u5DEE\u5F02\u72B6\u6001</p>
          <p class="text-sm font-semibold text-slate-900">${escapeHtml([summary.receiveDifferenceStatus, summary.returnDifferenceStatus].filter((item) => item !== "\u2014").join(" / ") || "\u65E0")}</p>
        </div>
      </div>
    </div>
  `;
}
function renderTicketPreviewPanel(unit, ticket) {
  if (!ticket) return "";
  const bundle = getDataBundle();
  const craftTrace = findCraftTraceItem(bundle, ticket);
  const specialCraftSummary = getSpecialCraftFeiTicketSummary(ticket.ticketNo);
  const panel = getCurrentSearchParams().get("panel") || "qr";
  const fiveDimTitle = buildFeiTicketFiveDimTitle(ticket);
  const title = panel === "void-info" ? "\u4F5C\u5E9F\u4E0E\u66FF\u4EE3\u4FE1\u606F" : panel === "preview" ? "\u6253\u5370\u9884\u89C8" : "\u83F2\u7968\u7801\u9884\u89C8";
  const body = panel === "void-info" ? `
        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs text-slate-500">\u4F5C\u5E9F\u539F\u56E0</p>
            <p class="mt-1 text-sm text-slate-900">${escapeHtml(ticket.voidReason || "\u6682\u65E0\u4F5C\u5E9F\u539F\u56E0")}</p>
          </div>
          <div class="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p class="text-xs text-slate-500">\u66FF\u4EE3\u83F2\u7968\u53F7</p>
            <p class="mt-1 text-sm text-slate-900">${escapeHtml(ticket.replacementTicketNo || "\u6682\u65E0\u66FF\u4EE3\u83F2\u7968")}</p>
          </div>
        </div>
      ` : panel === "preview" ? `
          <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-xs uppercase tracking-wide text-slate-500">\u88C1\u7247\u83F2\u7968\u9884\u89C8</p>
            <div class="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p class="text-lg font-semibold text-slate-900">${escapeHtml(fiveDimTitle)}</p>
            </div>
            <div class="mt-3 grid gap-3 md:grid-cols-[1fr,140px]">
              <div class="grid gap-3 md:grid-cols-2">
                <div>
                  <p class="text-sm text-slate-500">\u7968\u53F7</p>
                  <p class="text-lg font-semibold text-slate-900">${escapeHtml(ticket.ticketNo)}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">\u88C1\u7247\u5355 / \u751F\u4EA7\u5355</p>
                  <p class="text-sm font-semibold text-slate-900">${escapeHtml(`${craftTrace?.cutOrderNo || ticket.sourceCutOrderNo} / ${craftTrace?.productionOrderNo || ticket.sourceProductionOrderNo || "\u5F85\u8865\u751F\u4EA7\u5355"}`)}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">\u9762\u6599 / \u9762\u6599\u5377\u53F7</p>
                  ${renderMaterialIdentityBlock({
    materialSku: craftTrace?.materialSku || unit.fabricSku || "\u5F85\u8865",
    materialLabel: craftTrace?.materialSku || unit.fabricSku || "\u5F85\u8865",
    materialAlias: unit.materialAlias,
    materialImageUrl: unit.materialImageUrl
  }, { compact: true })}
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(ticket.fabricRollNo || "\u6682\u65E0\u6570\u636E")}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">\u5E03\u6599\u989C\u8272 / \u6210\u8863\u989C\u8272</p>
                  <p class="text-lg font-semibold text-slate-900">${escapeHtml(ticket.fabricColor || "\u6682\u65E0\u6570\u636E")}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(ticket.color || "\u6682\u65E0\u6570\u636E")}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">\u88C1\u7247\u90E8\u4F4D / \u624E\u53F7</p>
                  <p class="text-lg font-semibold text-slate-900">${escapeHtml(ticket.partName)}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(ticket.bundleNo || "\u6682\u65E0\u6570\u636E")}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">\u914D\u5957\u7F16\u53F7</p>
                  <p class="text-lg font-semibold text-slate-900">${escapeHtml(ticket.pieceSetNoRange || "\u6682\u65E0\u6570\u636E")}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(ticket.bundleTicketType || "\u624E\u675F\u83F2\u7968")}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">\u90E8\u4F4D\u88C1\u7247\u7F16\u53F7\u8303\u56F4</p>
                  <div class="mt-1 text-sm">${renderPieceSequenceSummary(ticket)}</div>
                </div>
                <div>
                  <p class="text-sm text-slate-500">\u6570\u91CF / \u88C1\u7247\u6570</p>
                  <p class="text-lg font-semibold text-slate-900">${formatCount(ticket.quantity)}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(`${formatCount(ticket.actualCutPieceQty)} \u7247`)}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">\u5DE5\u827A\u987A\u5E8F</p>
                  <p class="text-sm font-semibold text-slate-900">${escapeHtml(craftTrace?.secondaryCrafts.join(" \u2192 ") || "\u672A\u914D\u7F6E")}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(`\u7248\u672C ${craftTrace?.craftSequenceVersion || "\u5F85\u8865"} / \u5F53\u524D ${craftTrace?.currentCraftStage || "\u672A\u5F00\u59CB"}`)}</p>
                </div>
                <div>
                  <p class="text-sm text-slate-500">\u7279\u6B8A\u5DE5\u827A</p>
                  <p class="text-sm font-semibold text-slate-900">${escapeHtml(ticket.specialCraftDisplayLabel || "\u65E0")}</p>
                  <div class="mt-1">${renderSpecialCraftSummary(ticket.specialCrafts)}</div>
                </div>
                <div>
                  <p class="text-sm text-slate-500">\u4EA4\u51FA\u72B6\u6001 / \u56DE\u4ED3\u72B6\u6001</p>
                  <p class="text-sm font-semibold text-slate-900">${escapeHtml(`${formatDispatchLabel(specialCraftSummary.dispatchStatus)} / ${specialCraftSummary.returnStatus}`)}</p>
                  <p class="mt-1 text-xs text-slate-500">${escapeHtml(specialCraftSummary.currentLocation)}</p>
                </div>
              </div>
              <div>
                ${isFeiTicketFiveDimComplete(ticket) ? renderRealQrPlaceholder({
    value: getTicketScanCode(ticket),
    size: 128,
    title: "\u83F2\u7968\u4E8C\u7EF4\u7801",
    label: `\u83F2\u7968 ${ticket.ticketNo}`
  }) : '<div class="inline-flex h-[128px] w-[128px] items-center justify-center rounded-lg border border-dashed text-xs text-slate-500">\u7F3A\u5C11\u6570\u636E</div>'}
                <p class="mt-2 text-center text-xs text-slate-500">\u83F2\u7968\u4E8C\u7EF4\u7801</p>
              </div>
            </div>
          </div>
        ` : `
          <div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div class="flex flex-wrap items-start gap-4">
              ${isFeiTicketFiveDimComplete(ticket) ? renderRealQrPlaceholder({
    value: getTicketScanCode(ticket),
    size: 128,
    title: "\u83F2\u7968\u4E8C\u7EF4\u7801",
    label: `\u83F2\u7968 ${ticket.ticketNo}`
  }) : '<div class="inline-flex h-[128px] w-[128px] items-center justify-center rounded-lg border border-dashed text-xs text-blue-600">\u7F3A\u5C11\u6570\u636E</div>'}
              <div class="grid flex-1 gap-2 text-sm text-blue-900">
                <div class="font-semibold">${escapeHtml(fiveDimTitle)}</div>
                <div>\u88C1\u7247\u5355\uFF1A${escapeHtml(craftTrace?.cutOrderNo || ticket.sourceCutOrderNo)}</div>
                <div>\u751F\u4EA7\u5355\uFF1A${escapeHtml(craftTrace?.productionOrderNo || ticket.sourceProductionOrderNo || "\u5F85\u8865")}</div>
                <div class="rounded-md bg-white/70 p-2">
                  ${renderMaterialIdentityBlock(
    {
      materialSku: craftTrace?.materialSku || unit.fabricSku || "\u5F85\u8865",
      materialLabel: craftTrace?.materialSku || unit.fabricSku || "\u5F85\u8865",
      materialAlias: unit.materialAlias,
      materialImageUrl: unit.materialImageUrl
    },
    { compact: true, imageSizeClass: "h-9 w-9", showCategory: false }
  )}
                </div>
                <div>\u624E\u53F7\uFF1A${escapeHtml(ticket.bundleNo || "\u6682\u65E0\u6570\u636E")}</div>
                <div>\u914D\u5957\u7F16\u53F7\uFF1A${escapeHtml(ticket.pieceSetNoRange || "\u6682\u65E0\u6570\u636E")}</div>
              </div>
            </div>
          </div>
        `;
  return renderSectionCard(title, "", `${body}${renderSpecialCraftFlowBlock(ticket.ticketNo)}`);
}
function renderPrintedTicketsTab(unit, detailView) {
  const selectedTicket = findTicketCard(detailView);
  const tableHtml = `
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-3 text-left font-medium">\u83F2\u7968\u53F7</th>
          <th class="px-3 py-3 text-left font-medium">\u88C1\u7247\u5355</th>
          <th class="px-3 py-3 text-left font-medium">\u751F\u4EA7\u5355</th>
          <th class="px-3 py-3 text-left font-medium">\u9762\u6599\u5377\u53F7</th>
          <th class="px-3 py-3 text-left font-medium">\u5E03\u6599\u989C\u8272</th>
          <th class="px-3 py-3 text-left font-medium">\u5C3A\u7801</th>
          <th class="px-3 py-3 text-left font-medium">\u88C1\u7247\u90E8\u4F4D</th>
          <th class="px-3 py-3 text-left font-medium">\u6570\u91CF</th>
          <th class="px-3 py-3 text-left font-medium">\u624E\u53F7</th>
          <th class="px-3 py-3 text-left font-medium">\u914D\u5957\u7F16\u53F7</th>
          <th class="px-3 py-3 text-left font-medium">\u90E8\u4F4D\u88C1\u7247\u7F16\u53F7\u8303\u56F4</th>
          <th class="px-3 py-3 text-left font-medium">\u662F\u5426\u9700\u8981\u7279\u6B8A\u5DE5\u827A</th>
          <th class="px-3 py-3 text-left font-medium">\u7279\u6B8A\u5DE5\u827A</th>
          <th class="px-3 py-3 text-left font-medium">\u7279\u6B8A\u5DE5\u827A\u987A\u5E8F</th>
          <th class="px-3 py-3 text-left font-medium">\u5DF2\u5B8C\u6210\u7279\u6B8A\u5DE5\u827A</th>
          <th class="px-3 py-3 text-left font-medium">\u5F53\u524D\u7279\u6B8A\u5DE5\u827A</th>
          <th class="px-3 py-3 text-left font-medium">\u7279\u6B8A\u5DE5\u827A\u4EFB\u52A1</th>
          <th class="px-3 py-3 text-left font-medium">\u539F\u6570\u91CF</th>
          <th class="px-3 py-3 text-left font-medium">\u5F53\u524D\u6570\u91CF</th>
          <th class="px-3 py-3 text-left font-medium">\u7D2F\u8BA1\u62A5\u5E9F</th>
          <th class="px-3 py-3 text-left font-medium">\u7D2F\u8BA1\u8D27\u635F</th>
          <th class="px-3 py-3 text-left font-medium">\u63A5\u6536\u5DEE\u5F02\u72B6\u6001</th>
          <th class="px-3 py-3 text-left font-medium">\u56DE\u4ED3\u5DEE\u5F02\u72B6\u6001</th>
          <th class="px-3 py-3 text-left font-medium">\u4EA4\u51FA\u72B6\u6001</th>
          <th class="px-3 py-3 text-left font-medium">\u56DE\u4ED3\u72B6\u6001</th>
          <th class="px-3 py-3 text-left font-medium">\u5F53\u524D\u6240\u5728</th>
          <th class="px-3 py-3 text-left font-medium">\u4E2D\u8F6C\u5355\u53F7</th>
          <th class="px-3 py-3 text-left font-medium">\u4E2D\u8F6C\u888B\u53F7</th>
          <th class="px-3 py-3 text-left font-medium">\u888B\u5185\u72B6\u6001</th>
          <th class="px-3 py-3 text-left font-medium">\u6240\u5C5E\u4EA4\u51FA\u8BB0\u5F55</th>
          <th class="px-3 py-3 text-left font-medium">\u4EA4\u51FA\u72B6\u6001</th>
          <th class="px-3 py-3 text-left font-medium">\u662F\u5426\u5DF2\u88C5\u888B</th>
          <th class="px-3 py-3 text-left font-medium">\u662F\u5426\u5DF2\u4EA4\u51FA</th>
          <th class="px-3 py-3 text-left font-medium">\u8F66\u7F1D\u56DE\u5199\u72B6\u6001</th>
          <th class="px-3 py-3 text-left font-medium">\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3\u72B6\u6001</th>
          <th class="px-3 py-3 text-left font-medium">\u6253\u5370\u7248\u672C\u53F7</th>
          <th class="px-3 py-3 text-left font-medium">\u6253\u5370\u72B6\u6001</th>
          <th class="px-3 py-3 text-left font-medium">\u4E2D\u8F6C\u888B\u7ED1\u5B9A</th>
          <th class="px-3 py-3 text-left font-medium">\u662F\u5426\u53EF\u4F5C\u5E9F</th>
          <th class="px-3 py-3 text-left font-medium">\u6253\u5370\u65F6\u95F4</th>
          <th class="px-3 py-3 text-left font-medium">\u6253\u5370\u4EBA</th>
          <th class="px-3 py-3 text-left font-medium">\u4F5C\u5E9F\u539F\u56E0 / \u66FF\u4EE3\u7968</th>
          <th class="px-3 py-3 text-left font-medium">\u64CD\u4F5C</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        ${detailView.ticketCards.map((ticket) => {
    const specialCraftSummary = getSpecialCraftFeiTicketSummary(ticket.ticketNo);
    const sewingDispatchSummary = findCuttingSewingDispatchByFeiTicketNo(ticket.ticketNo);
    const actions = ticket.status === "VALID" ? [
      { label: "\u67E5\u770B\u83F2\u7968\u7801", href: buildFeiTicketLabelPrintLink(ticket.ticketId, "first") },
      { label: "\u67E5\u770B\u6253\u5370\u9884\u89C8", href: buildFeiTicketLabelPrintLink(ticket.ticketId, "first") },
      { label: "\u6253\u5370\u83F2\u7968\u6807\u7B7E", href: buildFeiTicketLabelPrintLink(ticket.ticketId, "first") },
      { label: "\u8865\u6253\u6807\u7B7E", href: buildFeiTicketLabelPrintLink(ticket.ticketId, "reprint") },
      {
        label: "\u67E5\u770B\u4EA4\u51FA\u5355",
        href: `${getCanonicalCuttingPath("sewing-dispatch")}?keyword=${encodeURIComponent(ticket.ticketNo)}`
      },
      {
        label: "\u67E5\u770B\u4E2D\u8F6C\u888B",
        href: `${getCanonicalCuttingPath("transfer-bags")}?keyword=${encodeURIComponent(sewingDispatchSummary.transferBag?.transferBagNo || ticket.ticketNo)}`
      },
      {
        label: sewingDispatchSummary.transferBag?.editableBeforeHandover ? "\u5DF2\u88C5\u888B\u672A\u4EA4\u51FA\u53EF\u79FB\u51FA" : "\u5DF2\u4EA4\u51FA\u540E\u4E0D\u53EF\u79FB\u51FA",
        href: `${getCanonicalCuttingPath("sewing-dispatch")}?keyword=${encodeURIComponent(ticket.ticketNo)}`
      },
      ...specialCraftSummary.needSpecialCraft ? [
        { label: "\u67E5\u770B\u7279\u6B8A\u5DE5\u827A\u4EFB\u52A1", href: resolveSpecialCraftTaskRoute(ticket.ticketNo) },
        {
          label: "\u67E5\u770B\u7279\u6B8A\u5DE5\u827A\u4EA4\u51FA",
          href: `${getCanonicalCuttingPath("special-craft-dispatch")}?keyword=${encodeURIComponent(ticket.ticketNo)}`
        },
        {
          label: "\u67E5\u770B\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3",
          href: `${getCanonicalCuttingPath("special-craft-return")}?keyword=${encodeURIComponent(ticket.ticketNo)}`
        }
      ] : [],
      ...!ticket.downstreamLocked ? [{ label: "\u53D1\u8D77\u4F5C\u5E9F", href: buildActionHref("fei-ticket-void", unit, { ticketRecordId: ticket.ticketId }) }] : []
    ] : [
      { label: "\u67E5\u770B\u4F5C\u5E9F\u539F\u56E0", href: buildTicketPanelHref(unit, ticket, "void-info") },
      { label: "\u6253\u5370\u4F5C\u5E9F\u6807\u8BC6", href: buildFeiTicketLabelPrintLink(ticket.ticketId, "void") },
      ...ticket.replacementTicketNo ? [
        {
          label: "\u67E5\u770B\u66FF\u4EE3\u83F2\u7968",
          href: buildActionHref("fei-ticket-printed", unit, {
            ticketRecordId: ticket.replacementTicketId,
            panel: "preview"
          })
        }
      ] : []
    ];
    return `
              <tr>
                <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(ticket.ticketNo)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.sourceCutOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.sourceProductionOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.fabricRollNo || "\u6682\u65E0\u6570\u636E")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.fabricColor || "\u6682\u65E0\u6570\u636E")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.size)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.partName)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(ticket.quantity)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.bundleNo || "\u6682\u65E0\u6570\u636E")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.pieceSetNoRange || "\u6682\u65E0\u6570\u636E")}</td>
                <td class="px-3 py-3 text-slate-700">${renderPieceSequenceSummary(ticket)}</td>
                <td class="px-3 py-3 text-slate-700">${ticket.hasSpecialCraft ? "\u662F" : "\u65E0"}</td>
                <td class="px-3 py-3 text-slate-700">${renderSpecialCraftSummary(ticket.specialCrafts)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.specialCrafts.map((craft) => craft.craftType).join(" \u2192 ") || "\u65E0")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.completedOperationNames.join(" / ") || "\u2014")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.currentOperationName)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.taskOrderNos.join(" / ") || "\u5F85\u7ED1\u5B9A")}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(specialCraftSummary.originalQty)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(specialCraftSummary.currentQty)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(specialCraftSummary.cumulativeScrapQty)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(specialCraftSummary.cumulativeDamageQty)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.receiveDifferenceStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.returnDifferenceStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(formatDispatchLabel(specialCraftSummary.dispatchStatus))}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.returnStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(specialCraftSummary.currentLocation)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(sewingDispatchSummary.dispatchBatch?.transferOrderNo || "\u672A\u88C5\u888B")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(sewingDispatchSummary.transferBag?.transferBagNo || "\u672A\u88C5\u888B")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(sewingDispatchSummary.transferBag ? sewingDispatchSummary.transferBag.packStatus : "\u672A\u88C5\u888B")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(sewingDispatchSummary.dispatchBatch?.handoverRecordNo || "\u5F85\u63D0\u4EA4")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(sewingDispatchSummary.feiTicketSewingStatus)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(sewingDispatchSummary.transferBag ? "\u5DF2\u88C5\u888B" : "\u672A\u88C5\u888B")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(["\u5DF2\u4EA4\u51FA", "\u5DF2\u56DE\u5199", "\u5DEE\u5F02", "\u5F02\u8BAE\u4E2D"].includes(sewingDispatchSummary.feiTicketSewingStatus) ? "\u5DF2\u4EA4\u51FA" : "\u672A\u4EA4\u51FA")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(sewingDispatchSummary.feiTicketSewingStatus === "\u5DF2\u56DE\u5199" ? "\u5DF2\u56DE\u5199" : sewingDispatchSummary.feiTicketSewingStatus === "\u5DEE\u5F02" ? "\u5DEE\u5F02" : sewingDispatchSummary.feiTicketSewingStatus === "\u5F02\u8BAE\u4E2D" ? "\u5F02\u8BAE\u4E2D" : "\u5F85\u56DE\u5199")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(sewingDispatchSummary.specialCraftReturnStatus)}</td>
                <td class="px-3 py-3 text-slate-700">V${formatCount(ticket.version)}</td>
                <td class="px-3 py-3">
                  <div class="space-y-1">
                    ${renderTicketStatusBadge(ticket.status)}
                    ${ticket.downstreamLocked ? `<p class="text-xs text-rose-600">${escapeHtml(ticket.downstreamLockedReason || "\u4E0B\u6E38\u5DF2\u9501\u5B9A")}</p>` : ""}
                  </div>
                </td>
                <td class="px-3 py-3 text-slate-700">${ticket.boundPocketNo ? escapeHtml(`${ticket.boundPocketNo} / ${ticket.boundUsageNo || "\u5F85\u8865\u4F7F\u7528\u5468\u671F\u53F7"}`) : "\u672A\u7ED1\u5B9A\u4E2D\u8F6C\u888B"}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.status === "VALID" ? ticket.downstreamLocked ? "\u4E0D\u53EF\u4F5C\u5E9F" : "\u53EF\u4F5C\u5E9F" : "\u4E0D\u53EF\u4F5C\u5E9F")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(formatDateTime(ticket.printedAt))}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.printedBy || "\u672A\u6253\u5370")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(ticket.status === "VOIDED" ? `${ticket.voidReason || "\u5DF2\u4F5C\u5E9F"}${ticket.replacementTicketNo ? ` / \u66FF\u4EE3\uFF1A${ticket.replacementTicketNo}` : ""}` : "\u2014")}</td>
                <td class="px-3 py-3">
                  <div class="flex min-w-[240px] flex-wrap gap-2">
                    ${actions.map(
      (action) => `<button type="button" data-nav="${escapeHtml(action.href)}" class="inline-flex min-h-9 items-center rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition hover:bg-slate-50">${escapeHtml(action.label)}</button>`
    ).join("")}
                  </div>
                </td>
              </tr>
            `;
  }).join("")}
      </tbody>
    </table>
  `;
  return `
    <div class="space-y-4">
      ${renderTicketPreviewPanel(unit, selectedTicket)}
      ${renderSectionCard(
    "\u5DF2\u6253\u5370\u83F2\u7968",
    "",
    renderStickyTableScroller(tableHtml, "max-h-[60vh]")
  )}
    </div>
  `;
}
function renderPrintRecordsTab(detailView) {
  const tableHtml = `
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-3 text-left font-medium">\u64CD\u4F5C\u7C7B\u578B</th>
          <th class="px-3 py-3 text-left font-medium">\u5173\u8054\u6253\u5370\u5355\u5143\u53F7</th>
          <th class="px-3 py-3 text-left font-medium">\u5173\u8054\u83F2\u7968\u6570</th>
          <th class="px-3 py-3 text-left font-medium">\u64CD\u4F5C\u65F6\u95F4</th>
          <th class="px-3 py-3 text-left font-medium">\u64CD\u4F5C\u4EBA</th>
          <th class="px-3 py-3 text-left font-medium">\u539F\u56E0</th>
          <th class="px-3 py-3 text-left font-medium">\u6253\u5370\u673A / \u6A21\u677F</th>
          <th class="px-3 py-3 text-left font-medium">\u539F\u7968 / \u65B0\u7968</th>
          <th class="px-3 py-3 text-left font-medium">\u5907\u6CE8</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        ${detailView.printRecords.map(
    (record) => `
              <tr>
                <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(formatOperationTypeLabel(record.operationType))}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(record.printableUnitNo)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(record.relatedTicketCount)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(formatDateTime(record.operatedAt))}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(record.operator)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(record.reason || "\u2014")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(`${record.printerName || "\u5F85\u8865\u6253\u5370\u673A"} / ${record.templateName || "\u5F85\u8865\u6A21\u677F"}`)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(record.fromTicketId || record.toTicketId ? `${record.fromTicketId || "\u2014"} -> ${record.toTicketId || "\u2014"}` : "\u2014")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(record.remark || "\u2014")}</td>
              </tr>
            `
  ).join("")}
      </tbody>
    </table>
  `;
  return renderSectionCard(
    "\u6253\u5370\u8BB0\u5F55",
    "",
    renderStickyTableScroller(tableHtml, "max-h-[60vh]")
  );
}
function renderMissingDetailsSummary(detailView) {
  if (!detailView.missingSplitDetails.length) {
    return `<p class="text-sm text-slate-600">\u5F53\u524D\u6CA1\u6709\u5F85\u6253\u5370\u7F3A\u53E3\u3002</p>`;
  }
  return `
    <ul class="space-y-2 text-sm text-slate-700">
      ${detailView.missingSplitDetails.map(
    (detail) => `
            <li class="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <span class="font-medium text-slate-900">${escapeHtml(detail.partName)}</span>
              <span class="mx-2 text-slate-400">/</span>
              <span>${escapeHtml(`${detail.color} / ${detail.size}`)}</span>
              <span class="mx-2 text-slate-400">/</span>
              <span>\u914D\u5957 ${escapeHtml(detail.pieceSetNoRange || "\u6682\u65E0")}</span>
              <span class="mx-2 text-slate-400">/</span>
              <span>\u6765\u6E90 ${escapeHtml(detail.sourceCutOrderNo)}</span>
              <span class="mx-2 text-slate-400">/</span>
              <span>\u7F3A\u53E3 ${formatCount(detail.gapCount)}</span>
            </li>
          `
  ).join("")}
    </ul>
  `;
}
function renderDetailOrChildPage(pageKey) {
  const bundle = getDataBundle();
  const pathname = getCurrentPathname();
  const meta = getCanonicalCuttingMeta(pathname, "fei-ticket-detail");
  const unit = findUnit(bundle);
  if (!unit) {
    return renderPrintablePageShell(`
      ${renderCuttingPageHeader(meta, {
      actionsHtml: renderReturnToSummaryButton() ? `<div class="flex flex-wrap gap-2">${renderReturnToSummaryButton()}</div>` : ""
    })}
      ${renderSectionCard("\u672A\u627E\u5230\u6253\u5370\u5355\u5143", "", `<div class="space-y-3"><p class="text-sm text-slate-600">\u8BF7\u5148\u4ECE\u6253\u5370\u83F2\u7968\u8FDB\u5165\u3002</p>${renderBackToList(null)}</div>`)}
    `);
  }
  const detailView = buildPrintableUnitDetailViewModel({
    unit,
    cutOrderRows: bundle.cutOrderRows,
    materialPrepRows: bundle.materialPrepRows,
    markerPlanRefs: bundle.markerPlanRefs,
    markerStore: bundle.markerStore,
    ticketRecords: bundle.ticketRecords,
    printJobs: bundle.printJobs
  });
  const activeTab = pageKey === "fei-ticket-printed" ? "printed" : pageKey === "fei-ticket-records" ? "records" : getDetailTab(pathname);
  const content = activeTab === "printed" ? renderPrintedTicketsTab(unit, detailView) : activeTab === "records" ? renderPrintRecordsTab(detailView) : renderSplitDetailsTab(detailView);
  return renderPrintablePageShell(`
    ${renderCuttingPageHeader(meta, {
    actionsHtml: `<div class="flex flex-wrap gap-2">${renderBackToList(unit)}${renderReturnToSummaryButton()}</div>`
  })}
    ${renderDetailSummary(detailView)}
    ${renderDetailTabs(unit, activeTab)}
    ${content}
  `);
}
function buildOperationPreviewRows(rows) {
  const tableHtml = `
    <table class="min-w-full text-sm">
      <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
        <tr>
          <th class="px-3 py-3 text-left font-medium">\u9762\u6599\u5377\u53F7</th>
          <th class="px-3 py-3 text-left font-medium">\u5E03\u6599\u989C\u8272</th>
          <th class="px-3 py-3 text-left font-medium">\u5C3A\u7801</th>
          <th class="px-3 py-3 text-left font-medium">\u88C1\u7247\u90E8\u4F4D</th>
          <th class="px-3 py-3 text-left font-medium">\u6570\u91CF</th>
          <th class="px-3 py-3 text-left font-medium">\u624E\u53F7</th>
          <th class="px-3 py-3 text-left font-medium">\u914D\u5957\u7F16\u53F7</th>
          <th class="px-3 py-3 text-left font-medium">\u90E8\u4F4D\u88C1\u7247\u7F16\u53F7\u8303\u56F4</th>
          <th class="px-3 py-3 text-left font-medium">\u7279\u6B8A\u5DE5\u827A</th>
          <th class="px-3 py-3 text-left font-medium">\u88C1\u7247\u5355</th>
          <th class="px-3 py-3 text-left font-medium">\u5F53\u524D\u7F3A\u53E3\u6570</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100 bg-white">
        ${rows.map(
    (detail) => `
              <tr>
                <td class="px-3 py-3 font-medium text-slate-900">${escapeHtml(detail.fabricRollNo || "\u6682\u65E0\u6570\u636E")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.fabricColor || "\u6682\u65E0\u6570\u636E")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.size)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.partName)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(detail.quantity)}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.bundleNo || "\u6682\u65E0\u6570\u636E")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.pieceSetNoRange || "\u6682\u65E0\u6570\u636E")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.pieceSequenceLabel || detail.pieceSequenceCannotGenerateReason || "\u4E0D\u53EF\u751F\u6210")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.specialCraftDisplayLabel || "\u65E0")}</td>
                <td class="px-3 py-3 text-slate-700">${escapeHtml(detail.sourceCutOrderNo)}</td>
                <td class="px-3 py-3 text-slate-700">${formatCount(detail.gapCount)}</td>
              </tr>
            `
  ).join("")}
      </tbody>
    </table>
  `;
  return renderStickyTableScroller(tableHtml, "max-h-[50vh]");
}
function renderOperationFields(pageKey) {
  const needsReason = pageKey === "fei-ticket-reprint" || pageKey === "fei-ticket-void";
  const showPrintConfig = pageKey !== "fei-ticket-void";
  return `
    <div class="grid gap-4 lg:grid-cols-2">
      <label class="space-y-1 text-sm text-slate-600">
        <span class="font-medium text-slate-700">\u64CD\u4F5C\u4EBA</span>
        <input type="text" value="${escapeHtml(state.operationDraft.operator)}" data-cutting-fei-op-field="operator" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" />
      </label>
      ${showPrintConfig ? `<label class="space-y-1 text-sm text-slate-600"><span class="font-medium text-slate-700">\u6253\u5370\u673A</span><input type="text" value="${escapeHtml(state.operationDraft.printerName)}" data-cutting-fei-op-field="printerName" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" /></label>` : ""}
      ${showPrintConfig ? `<label class="space-y-1 text-sm text-slate-600"><span class="font-medium text-slate-700">\u6A21\u677F</span><input type="text" value="${escapeHtml(state.operationDraft.templateName)}" data-cutting-fei-op-field="templateName" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" /></label>` : ""}
      <label class="space-y-1 text-sm text-slate-600 ${showPrintConfig ? "" : "lg:col-span-2"}">
        <span class="font-medium text-slate-700">${needsReason ? "\u539F\u56E0\uFF08\u5FC5\u586B\uFF09" : "\u539F\u56E0\uFF08\u53EF\u9009\uFF09"}</span>
        <input type="text" value="${escapeHtml(state.operationDraft.reason)}" data-cutting-fei-op-field="reason" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="${needsReason ? "\u8BF7\u8F93\u5165\u539F\u56E0" : "\u53EF\u9009\u586B\u5199"}" />
      </label>
      <label class="space-y-1 text-sm text-slate-600 lg:col-span-2">
        <span class="font-medium text-slate-700">\u5907\u6CE8</span>
        <textarea rows="3" data-cutting-fei-op-field="remark" class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200">${escapeHtml(state.operationDraft.remark)}</textarea>
      </label>
    </div>
  `;
}
function renderOperationValidation(message, unit, pageKey) {
  const meta = getCanonicalCuttingMeta(getCurrentPathname(), pageKey);
  return renderPrintablePageShell(`
    ${renderCuttingPageHeader(meta, {
    actionsHtml: `<div class="flex flex-wrap gap-2">${renderBackToList(unit)}${renderReturnToSummaryButton()}</div>`
  })}
    ${renderSectionCard("\u5F53\u524D\u64CD\u4F5C\u4E0D\u53EF\u6267\u884C", "", `<p class="text-sm text-slate-600">${escapeHtml(message)}</p>`)}
  `);
}
function getOperationButtonMeta(pageKey) {
  if (pageKey === "fei-ticket-print") return { label: "\u786E\u8BA4\u9996\u6253", action: "confirm-first-print" };
  if (pageKey === "fei-ticket-reprint") return { label: "\u786E\u8BA4\u8865\u6253", action: "confirm-reprint" };
  return { label: "\u786E\u8BA4\u4F5C\u5E9F", action: "confirm-void-ticket" };
}
function renderOperationPage(pageKey) {
  const bundle = getDataBundle();
  const meta = getCanonicalCuttingMeta(getCurrentPathname(), pageKey);
  const unit = findUnit(bundle);
  if (!unit) return renderOperationValidation("\u672A\u627E\u5230\u5F53\u524D printableUnit\u3002", null, pageKey);
  const detailView = buildPrintableUnitDetailViewModel({
    unit,
    cutOrderRows: bundle.cutOrderRows,
    materialPrepRows: bundle.materialPrepRows,
    markerPlanRefs: bundle.markerPlanRefs,
    markerStore: bundle.markerStore,
    ticketRecords: bundle.ticketRecords,
    printJobs: bundle.printJobs
  });
  const ticket = findTicketCard(detailView);
  if (pageKey === "fei-ticket-print" && unit.printableUnitStatus !== "WAITING_PRINT") {
    return renderOperationValidation("\u53EA\u6709\u5F85\u6253\u5370\u72B6\u6001\u624D\u80FD\u8FDB\u5165\u9996\u6253\u9875\u3002", unit, pageKey);
  }
  if (pageKey === "fei-ticket-reprint" && unit.printableUnitStatus !== "NEED_REPRINT") {
    return renderOperationValidation("\u53EA\u6709\u9700\u8865\u6253\u72B6\u6001\u624D\u80FD\u8FDB\u5165\u8865\u6253\u9875\u3002", unit, pageKey);
  }
  if (pageKey === "fei-ticket-void") {
    const validation = canVoidTicketCard(
      ticket ? bundle.ticketRecords.find((record) => record.ticketRecordId === ticket.ticketId) || null : null
    );
    if (!ticket) return renderOperationValidation("\u5F53\u524D\u6CA1\u6709\u5B9A\u4F4D\u5230\u9700\u8981\u4F5C\u5E9F\u7684\u83F2\u7968\u3002", unit, pageKey);
    if (!validation.allowed) {
      return renderOperationValidation(validation.reason, unit, pageKey);
    }
  }
  const previewDetails = pageKey === "fei-ticket-print" || pageKey === "fei-ticket-reprint" ? detailView.missingSplitDetails : [];
  const invalidPreviewDetails = previewDetails.filter((detail) => !isFeiTicketFiveDimComplete(detail));
  if (invalidPreviewDetails.length) {
    return renderOperationValidation("\u5F53\u524D\u5B58\u5728\u7F3A\u5C11\u4E94\u7EF4\u5B57\u6BB5\u7684\u83F2\u7968\uFF0C\u4E0D\u80FD\u6253\u5370\u3002", unit, pageKey);
  }
  const outputTicketCount = previewDetails.length;
  const buttonMeta = getOperationButtonMeta(pageKey);
  const infoGrid = `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">\u53EF\u6253\u5370\u5355\u5143\u53F7</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(unit.printableUnitNo)}</p></div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">\u5355\u5143\u7C7B\u578B</p><div class="mt-1">${renderUnitTypeBadge(unit.printableUnitType)}</div></div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">\u5F53\u524D\u72B6\u6001</p><div class="mt-1">${renderStatusBadge(unit.printableUnitStatus)}</div></div>
      <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">\u6765\u6E90\u88C1\u7247\u5355\u6570</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(unit.sourceCutOrderCount)}</p></div>
    </div>
  `;
  const operationSpecific = pageKey === "fei-ticket-void" && ticket ? `
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u83F2\u7968\u53F7</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(ticket.ticketNo)}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u9762\u6599</p>${renderMaterialIdentityBlock({
    materialSku: findCraftTraceItem(bundle, ticket)?.materialSku || unit.fabricSku || "\u5F85\u8865",
    materialLabel: findCraftTraceItem(bundle, ticket)?.materialSku || unit.fabricSku || "\u5F85\u8865",
    materialAlias: unit.materialAlias,
    materialImageUrl: unit.materialImageUrl
  }, { compact: true })}<p class="mt-1 text-xs text-slate-500">${escapeHtml(`${ticket.color} / ${ticket.size}`)}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u88C1\u7247\u90E8\u4F4D</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(ticket.partName)}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u662F\u5426\u5B58\u5728\u66FF\u4EE3\u7968</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(ticket.replacementTicketNo || "\u6682\u65E0")}</p></div>
        </div>
      ` : `
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u672C\u6B21\u751F\u6210\u83F2\u7968\u6570\uFF08\u5F20\uFF09</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(outputTicketCount)}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u5F53\u524D\u7F3A\u53E3\u603B\u6570</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(unit.missingTicketCount)}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u6700\u8FD1\u6253\u5370\u65F6\u95F4</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(formatDateTime(unit.lastPrintedAt))}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u6700\u8FD1\u6253\u5370\u4EBA</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(unit.lastPrintedBy || "\u672A\u6253\u5370")}</p></div>
        </div>
      `;
  return renderPrintablePageShell(`
    ${renderCuttingPageHeader(meta, {
    actionsHtml: `<div class="flex flex-wrap gap-2">${renderBackToList(unit)}${renderReturnToSummaryButton()}</div>`
  })}
    ${renderSectionCard("\u5F53\u524D\u6253\u5370\u5355\u5143\u57FA\u7840\u4FE1\u606F", "", `${infoGrid}${operationSpecific}`)}
    ${pageKey === "fei-ticket-void" ? renderSectionCard("\u4F5C\u5E9F\u5BF9\u8C61", "", ticket ? renderTicketPreviewPanel(unit, ticket) : '<p class="text-sm text-slate-600">\u672A\u627E\u5230\u4F5C\u5E9F\u5BF9\u8C61\u3002</p>') : renderSectionCard("\u5B9E\u9645\u88C1\u526A\u4EA7\u51FA\u660E\u7EC6\u9884\u89C8", "", buildOperationPreviewRows(previewDetails))}
    ${renderSectionCard("\u64CD\u4F5C\u8BBE\u7F6E", "", renderOperationFields(pageKey))}
    ${renderSectionCard(
    "\u52A8\u4F5C\u533A",
    "",
    `<div class="flex flex-wrap gap-2"><button type="button" data-cutting-fei-action="${buttonMeta.action}" class="inline-flex min-h-10 items-center rounded-md border border-blue-600 bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">${escapeHtml(buttonMeta.label)}</button><button type="button" data-nav="${escapeHtml(buildActionHref("fei-ticket-detail", unit))}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50">\u53D6\u6D88</button></div>`
  )}
  `);
}
function renderStandaloneBackActions(row) {
  const detailHref = row ? buildStandaloneFeiTicketHref(row.ticketId) : getCanonicalCuttingPath("fei-tickets");
  return `<div class="flex flex-wrap gap-2"><button type="button" data-nav="${escapeHtml(getCanonicalCuttingPath("fei-tickets"))}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">\u8FD4\u56DE\u83F2\u7968\u5DE5\u4F5C\u53F0</button>${row ? `<button type="button" data-nav="${escapeHtml(detailHref)}" class="inline-flex min-h-10 items-center rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">\u8FD4\u56DE\u8BE6\u60C5</button>` : ""}</div>`;
}
function renderStandaloneNotFound(ticketId) {
  return renderPrintablePageShell(`
    ${renderCuttingPageHeader({
    key: "fei-ticket-detail",
    canonicalPath: getCanonicalCuttingPath("fei-tickets"),
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u83F2\u7968\u8BE6\u60C5",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: ""
  }, { actionsHtml: renderStandaloneBackActions(null) })}
    ${renderSectionCard("\u672A\u627E\u5230\u83F2\u7968", "", `<p class="text-sm text-slate-600">\u6CA1\u6709\u627E\u5230 ${escapeHtml(ticketId)} \u5BF9\u5E94\u7684\u83F2\u7968\u3002</p>`)}
  `);
}
function renderStandaloneDetailSections(row) {
  const recordLike = row.record || row.generated;
  const printProjection = buildFeiTicketLabelPrintProjection(recordLike);
  return `
    ${renderSectionCard("\u57FA\u672C\u4FE1\u606F", "", `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">\u83F2\u7968\u53F7</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.ticketNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">\u7248\u672C</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.versionLabel)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">\u6253\u5370\u72B6\u6001</p><div class="mt-1">${renderLifecycleStatusBadge(row)}</div></div>
        <div class="rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">\u751F\u6210\u65F6\u95F4 / \u751F\u6210\u4EBA</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.generated.issuedAt || "\u5F85\u8865")} / ${escapeHtml(row.record?.printedBy || row.generated.qrPayload?.generatedAt ? "\u7CFB\u7EDF\u751F\u6210" : "\u5F85\u8865")}</p></div>
      </div>
    `)}
    ${renderSectionCard("\u6765\u6E90\u4FE1\u606F", "", `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u751F\u4EA7\u5355 / \u88C1\u7247\u5355</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.productionOrderNo)} / ${escapeHtml(row.cutOrderNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u9762\u6599</p>${renderMaterialIdentityBlock({
    materialSku: row.generated.materialIdentity?.materialSku || row.generated.materialSku,
    materialLabel: row.generated.materialIdentity?.materialName || row.generated.materialSku,
    materialAlias: row.generated.materialIdentity?.materialAlias,
    materialImageUrl: row.generated.materialIdentity?.materialImageUrl,
    materialColor: row.generated.materialIdentity?.materialColor
  }, { compact: true })}</div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u7EB8\u6837</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.generated.patternIdentity?.patternFileName || "\u5F85\u8865\u7EB8\u6837")}</p><p class="mt-1 text-xs text-slate-500">${escapeHtml(`${row.generated.patternIdentity?.patternVersion || "\u5F85\u8865\u7248\u672C"} / ${row.generated.patternIdentity?.effectiveWidthValue || ""}${row.generated.patternIdentity?.effectiveWidthUnit || ""}`)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u551B\u67B6\u65B9\u6848 / \u551B\u67B6\u7F16\u53F7</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.markerPlanNo || "\u5F85\u8865")} / ${escapeHtml(row.markerNumber || "\u5F85\u8865")}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u94FA\u5E03\u5355</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.spreadingOrderNo || "\u5F85\u8865")}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u5B9E\u9645\u88C1\u526A\u4EA7\u51FA</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.generated.sourceOutputLineId)}</p></div>
      </div>
    `)}
    ${renderSectionCard("\u88C1\u7247\u4FE1\u606F", "", `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u989C\u8272</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.color)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u5C3A\u7801</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.size)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u90E8\u4F4D</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.partName)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u88C1\u7247\u6570\u91CF</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(row.pieceQty)} \u7247</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u90E8\u4F4D\u88C1\u7247\u7F16\u53F7\u8303\u56F4</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.pieceSequenceLabel)}</p></div>
      </div>
    `)}
    ${renderSectionCard("\u7279\u6B8A\u5DE5\u827A", "", `
      <div class="grid gap-3 md:grid-cols-2">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u662F\u5426\u6709\u7279\u6B8A\u5DE5\u827A</p><p class="mt-1 text-sm font-semibold text-slate-900">${row.hasSpecialCraft ? "\u662F" : "\u65E0"}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u627F\u63A5\u5DE5\u5382</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(joinCompactLines(row.receiverFactoryLines, 4))}</p></div>
        <div class="md:col-span-2 rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u7279\u6B8A\u5DE5\u827A\u660E\u7EC6</p><div class="mt-2">${renderSpecialCraftSummary(row.generated.specialCrafts)}</div></div>
      </div>
    `)}
    ${renderSectionCard("\u4E8C\u7EF4\u7801\u4FE1\u606F", "", `
      <div class="grid gap-4 md:grid-cols-[160px_1fr]">
        <div>
          ${renderRealQrPlaceholder({ value: printProjection.qrDisplayValue, size: 140, title: "\u83F2\u7968\u4E8C\u7EF4\u7801", label: `\u83F2\u7968 ${row.ticketNo}` })}
          <p class="mt-2 text-center text-xs text-slate-500">\u4E8C\u7EF4\u7801\u9884\u89C8</p>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">payload \u7248\u672C</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(printProjection.qrPayload.payloadVersion)}</p></div>
          <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u4E8C\u7EF4\u7801\u7C7B\u578B</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(printProjection.qrPayload.qrType)}</p></div>
          <div class="md:col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-3"><p class="text-xs text-slate-500">\u8FFD\u8E2A\u7801</p><p class="mt-1 break-all text-xs font-medium text-slate-900">${escapeHtml(printProjection.qrDisplayValue.slice(0, 360))}${printProjection.qrDisplayValue.length > 360 ? "..." : ""}</p></div>
        </div>
      </div>
    `)}
    ${renderSectionCard("\u6253\u5370\u8BB0\u5F55", "", `
      <div class="grid gap-3 md:grid-cols-3">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u9996\u6253\u8BB0\u5F55</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.firstPrintedAt || "\u5F85\u9996\u6253")}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u8865\u6253\u8BB0\u5F55</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.latestReprintAt || "\u65E0")}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u4F5C\u5E9F\u8BB0\u5F55</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.tab === "VOIDED" ? row.reason : "\u65E0")}</p></div>
      </div>
    `)}
  `;
}
function renderStandaloneDetailPage(ticketId) {
  const bundle = getDataBundle();
  const row = findFeiWorkbenchRow(bundle, ticketId);
  if (!row) return renderStandaloneNotFound(ticketId);
  return renderPrintablePageShell(`
    ${renderCuttingPageHeader({
    key: "fei-ticket-detail",
    canonicalPath: buildStandaloneFeiTicketHref(row.ticketId),
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u83F2\u7968\u8BE6\u60C5",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: ""
  }, { actionsHtml: renderStandaloneBackActions(row) })}
    ${renderStandaloneDetailSections(row)}
  `);
}
function renderTemplateSizeSelector(row, activeSize) {
  const sizes = ["10cm x 10cm", "15cm x 10cm"];
  return `<div class="flex flex-wrap gap-2">${sizes.map((size) => `<button type="button" data-nav="${escapeHtml(`${buildStandaloneFeiTicketHref(row.ticketId, "/print")}?size=${encodeURIComponent(size)}`)}" class="inline-flex min-h-9 items-center rounded-md border px-3 text-sm font-medium ${size === activeSize ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}">${escapeHtml(size)}</button>`).join("")}</div>`;
}
function renderLabelPreviewCard(row, templateSize) {
  const projection = buildFeiTicketLabelPrintProjection(row.record || row.generated, { templateSize });
  const fields = [
    ["\u83F2\u7968\u53F7", projection.feiTicketNo],
    ["\u751F\u4EA7\u5355", projection.productionOrderNo],
    ["\u88C1\u7247\u5355", projection.cutOrderNo],
    ["SPU", projection.spuCode],
    ["\u989C\u8272", projection.color],
    ["\u5C3A\u7801", projection.size],
    ["\u90E8\u4F4D", projection.partName],
    ["\u88C1\u7247\u6570\u91CF", projection.pieceQtyLabel.replace(/^裁片数量：/, "")],
    ["\u7F16\u53F7\u8303\u56F4", projection.pieceSequenceLabel.replace(/^编号范围：/, "")],
    ["\u551B\u67B6\u65B9\u6848", projection.markerPlanNo],
    ["\u551B\u67B6\u7F16\u53F7", projection.markerNumber],
    ["\u94FA\u5E03\u5355", projection.spreadingOrderNo],
    ["\u7248\u672C", projection.versionLabel],
    ["\u7279\u6B8A\u5DE5\u827A", projection.hasSpecialCraftLabel === "\u6709\u7279\u6B8A\u5DE5\u827A" ? `${projection.hasSpecialCraftLabel}\uFF1A${joinCompactLines(projection.specialCraftDisplayLines, templateSize === "15cm x 10cm" ? 4 : 2)}` : projection.hasSpecialCraftLabel],
    ["\u627F\u63A5\u5DE5\u5382", joinCompactLines(projection.receiverFactoryDisplayLines, templateSize === "15cm x 10cm" ? 4 : 2)]
  ];
  const paperClass = templateSize === "15cm x 10cm" ? "w-[150mm] min-h-[100mm]" : "w-[100mm] min-h-[100mm]";
  return `
    <div class="overflow-hidden rounded-lg border bg-slate-50 p-4">
      <div class="${paperClass} max-w-full rounded-md border border-slate-900 bg-white p-[2mm] text-slate-900 shadow-sm">
        <div class="flex items-start justify-between gap-2 border-b border-slate-900 pb-[2mm]">
          <div>
            <div class="text-sm font-extrabold">\u83F2\u7968</div>
            <div class="mt-1 text-[8px] text-slate-500">${escapeHtml(projection.feiTicketNo)}</div>
          </div>
          <div class="border border-slate-900 px-2 py-1 text-[9px] font-bold">${escapeHtml(projection.versionLabel)}</div>
        </div>
        <div class="mt-[2mm] grid gap-[2mm] ${templateSize === "15cm x 10cm" ? "grid-cols-[1fr_34mm]" : "grid-cols-[1fr_30mm]"}">
          <div class="grid ${templateSize === "15cm x 10cm" ? "grid-cols-3" : "grid-cols-2"} gap-x-[2mm] gap-y-[1mm]">
            ${fields.map(([label, value]) => `<div class="min-w-0 border-b border-slate-300 pb-[0.5mm]"><span class="block text-[7px] text-slate-500">${escapeHtml(label)}</span><strong class="block break-words text-[8px] leading-tight">${escapeHtml(value || "\u2014")}</strong></div>`).join("")}
          </div>
          <div class="text-center">
            <div class="flex min-h-[30mm] items-center justify-center border border-slate-900">${renderRealQrPlaceholder({ value: projection.qrDisplayValue, size: templateSize === "15cm x 10cm" ? 128 : 112, title: "\u83F2\u7968\u4E8C\u7EF4\u7801", label: `\u83F2\u7968 ${row.ticketNo}` })}</div>
            <div class="mt-1 text-[7px] text-slate-500">\u626B\u7801\u67E5\u770B\u83F2\u7968</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
function renderStandalonePrintPage(ticketId) {
  const bundle = getDataBundle();
  const row = findFeiWorkbenchRow(bundle, ticketId);
  if (!row) return renderStandaloneNotFound(ticketId);
  const requestedSize = getCurrentSearchParams().get("size");
  const templateSize = requestedSize === "15cm x 10cm" ? "15cm x 10cm" : "10cm x 10cm";
  return renderPrintablePageShell(`
    ${renderCuttingPageHeader({
    key: "fei-ticket-print",
    canonicalPath: buildStandaloneFeiTicketHref(row.ticketId, "/print"),
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u83F2\u7968\u6253\u5370",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: ""
  }, { actionsHtml: renderStandaloneBackActions(row) })}
    ${renderSectionCard("\u6A21\u677F\u5C3A\u5BF8", "", renderTemplateSizeSelector(row, templateSize))}
    ${renderSectionCard("\u6253\u5370\u6A21\u677F\u9884\u89C8", "", renderLabelPreviewCard(row, templateSize))}
    ${renderSectionCard("\u6253\u5370\u5185\u5BB9\u6838\u5BF9", "", `
      <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u83F2\u7968\u53F7</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.ticketNo)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u88C1\u7247\u6570\u91CF</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(row.pieceQty)} \u7247</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u7F16\u53F7\u8303\u56F4</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.pieceSequenceLabel)}</p></div>
        <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u7279\u6B8A\u5DE5\u827A / \u627F\u63A5\u5DE5\u5382</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(joinCompactLines(row.specialCraftLines, 2))} / ${escapeHtml(joinCompactLines(row.receiverFactoryLines, 2))}</p></div>
      </div>
    `)}
    ${renderSectionCard("\u52A8\u4F5C\u533A", "", `<button type="button" data-nav="${escapeHtml(`/fcs/print/preview?documentType=FEI_TICKET_LABEL&sourceType=FEI_TICKET_RECORD&sourceId=${encodeURIComponent(row.record?.ticketRecordId || row.generated.feiTicketNo)}`)}" class="inline-flex min-h-10 items-center rounded-md border border-blue-600 bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700">\u6253\u5370</button>`)}
  `);
}
function renderImpactScope(row, includeVoidFields = false) {
  return `
    <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u83F2\u7968\u53F7</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.ticketNo)}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u88C1\u7247\u6570\u91CF</p><p class="mt-1 text-sm font-semibold text-slate-900">${formatCount(row.pieceQty)} \u7247</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u90E8\u4F4D\u88C1\u7247\u7F16\u53F7\u8303\u56F4</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(row.pieceSequenceLabel)}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u662F\u5426\u6709\u7279\u6B8A\u5DE5\u827A</p><p class="mt-1 text-sm font-semibold text-slate-900">${row.hasSpecialCraft ? "\u662F" : "\u65E0"}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u7279\u6B8A\u5DE5\u827A\u7C7B\u578B</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(joinCompactLines(row.specialCraftLines, 3))}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u627F\u63A5\u5DE5\u5382</p><p class="mt-1 text-sm font-semibold text-slate-900">${escapeHtml(joinCompactLines(row.receiverFactoryLines, 3))}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u662F\u5426\u5DF2\u6253\u5370</p><p class="mt-1 text-sm font-semibold text-slate-900">${row.firstPrintedAt ? "\u662F" : "\u5426"}</p></div>
      <div class="rounded-lg border border-slate-200 bg-white p-3"><p class="text-xs text-slate-500">\u662F\u5426\u5DF2\u5165\u4ED3 / \u5DF2\u88C5\u888B / \u5DF2\u8FDB\u5165\u4EA4\u51FA\u8BB0\u5F55</p><p class="mt-1 text-sm font-semibold text-slate-900">${includeVoidFields ? "\u5F53\u524D\u9636\u6BB5\u4EC5\u63D0\u793A\u5F71\u54CD\u8303\u56F4\uFF0C\u672A\u63A5\u5165\u540E\u7EED\u5BF9\u8C61" : "\u5982\u5DF2\u6709\u540E\u7EED\u5BF9\u8C61\uFF0C\u9700\u540C\u6B65\u6838\u5BF9"}</p></div>
    </div>
  `;
}
function renderReasonOptions(options) {
  const currentPath = getCurrentPathname();
  const activeReason = getCurrentSearchParams().get("reason") || state.operationDraft.reason;
  return `<div class="flex flex-wrap gap-2">${options.map((option) => {
    const selected = option === activeReason;
    return `<button type="button" data-nav="${escapeHtml(buildRouteWithQuery(currentPath, { reason: option }))}" class="rounded-md border px-3 py-1.5 text-xs ${selected ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}">${escapeHtml(option)}</button>`;
  }).join("")}</div>`;
}
function syncStandaloneReasonControls() {
  const hasReason = Boolean(state.operationDraft.reason.trim());
  document.querySelectorAll('[data-cutting-fei-op-field="reason"]').forEach((input) => {
    if (input.value !== state.operationDraft.reason) input.value = state.operationDraft.reason;
  });
  document.querySelectorAll(
    '[data-cutting-fei-action="standalone-reprint-confirm"], [data-cutting-fei-action="standalone-void-confirm"]'
  ).forEach((button) => {
    const isVoid = button.dataset.cuttingFeiAction === "standalone-void-confirm";
    button.toggleAttribute("disabled", !hasReason);
    button.className = `inline-flex min-h-10 items-center rounded-md border px-4 text-sm font-medium ${hasReason ? isVoid ? "border-rose-600 bg-rose-600 text-white hover:bg-rose-700" : "border-blue-600 bg-blue-600 text-white hover:bg-blue-700" : "border-slate-200 bg-slate-100 text-slate-400"}`;
  });
}
function renderStandaloneReprintPage(ticketId) {
  const bundle = getDataBundle();
  const row = findFeiWorkbenchRow(bundle, ticketId);
  if (!row) return renderStandaloneNotFound(ticketId);
  const currentReason = getCurrentSearchParams().get("reason") || state.operationDraft.reason;
  const canSubmit = Boolean(currentReason.trim());
  return renderPrintablePageShell(`
    ${renderCuttingPageHeader({
    key: "fei-ticket-reprint",
    canonicalPath: buildStandaloneFeiTicketHref(row.ticketId, "/reprint"),
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u83F2\u7968\u8865\u6253",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: ""
  }, { actionsHtml: renderStandaloneBackActions(row) })}
    ${renderSectionCard("\u5F71\u54CD\u8303\u56F4", "", renderImpactScope(row))}
    ${renderSectionCard("\u8865\u6253\u539F\u56E0", "", `
      ${renderReasonOptions(reprintReasonOptions)}
      <label class="mt-3 block space-y-1 text-sm text-slate-600">
        <span class="font-medium text-slate-700">\u8865\u6253\u539F\u56E0\uFF08\u5FC5\u586B\uFF09</span>
        <input type="text" value="${escapeHtml(currentReason)}" data-cutting-fei-op-field="reason" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="\u8BF7\u9009\u62E9\u6216\u8F93\u5165\u8865\u6253\u539F\u56E0" />
      </label>
    `)}
    ${renderSectionCard("\u52A8\u4F5C\u533A", "", `<button type="button" data-cutting-fei-action="standalone-reprint-confirm" ${canSubmit ? "" : "disabled"} class="inline-flex min-h-10 items-center rounded-md border px-4 text-sm font-medium ${canSubmit ? "border-blue-600 bg-blue-600 text-white hover:bg-blue-700" : "border-slate-200 bg-slate-100 text-slate-400"}">\u786E\u8BA4\u8865\u6253</button>`)}
  `);
}
function renderStandaloneVoidPage(ticketId) {
  const bundle = getDataBundle();
  const row = findFeiWorkbenchRow(bundle, ticketId);
  if (!row) return renderStandaloneNotFound(ticketId);
  const currentReason = getCurrentSearchParams().get("reason") || state.operationDraft.reason;
  const canSubmit = Boolean(currentReason.trim());
  return renderPrintablePageShell(`
    ${renderCuttingPageHeader({
    key: "fei-ticket-void",
    canonicalPath: buildStandaloneFeiTicketHref(row.ticketId, "/void"),
    aliases: [],
    menuGroupTitle: "\u88C1\u540E\u5904\u7406",
    pageTitle: "\u83F2\u7968\u4F5C\u5E9F",
    pageSubtitle: "",
    isPlaceholder: false,
    shortDescription: ""
  }, { actionsHtml: renderStandaloneBackActions(row) })}
    ${renderSectionCard("\u5F71\u54CD\u8303\u56F4", "", renderImpactScope(row, true))}
    ${renderSectionCard("\u4F5C\u5E9F\u89C4\u5219", "", `
      <div class="grid gap-2 text-sm text-slate-700">
        <p>\u5DF2\u4F5C\u5E9F\u83F2\u7968\u4E0D\u518D\u53C2\u4E0E\u540E\u7EED\u6D41\u8F6C\u3002</p>
        <p>\u4F5C\u5E9F\u53EA\u4FDD\u7559\u5386\u53F2\u8BB0\u5F55\uFF0C\u4E0D\u5220\u9664\u5B9E\u9645\u88C1\u526A\u4EA7\u51FA\uFF0C\u4E0D\u4FEE\u6539\u88C1\u7247\u5355\u4E3B\u72B6\u6001\uFF0C\u4E5F\u4E0D\u4FEE\u6539\u94FA\u5E03\u5355\u72B6\u6001\u3002</p>
      </div>
    `)}
    ${renderSectionCard("\u4F5C\u5E9F\u539F\u56E0", "", `
      ${renderReasonOptions(voidReasonOptions)}
      <label class="mt-3 block space-y-1 text-sm text-slate-600">
        <span class="font-medium text-slate-700">\u4F5C\u5E9F\u539F\u56E0\uFF08\u5FC5\u586B\uFF09</span>
        <input type="text" value="${escapeHtml(currentReason)}" data-cutting-fei-op-field="reason" class="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200" placeholder="\u8BF7\u9009\u62E9\u6216\u8F93\u5165\u4F5C\u5E9F\u539F\u56E0" />
      </label>
    `)}
    ${renderSectionCard("\u52A8\u4F5C\u533A", "", `<button type="button" data-cutting-fei-action="standalone-void-confirm" ${canSubmit ? "" : "disabled"} class="inline-flex min-h-10 items-center rounded-md border px-4 text-sm font-medium ${canSubmit ? "border-rose-600 bg-rose-600 text-white hover:bg-rose-700" : "border-slate-200 bg-slate-100 text-slate-400"}">\u786E\u8BA4\u4F5C\u5E9F</button>`)}
  `);
}
function renderPrintableUnitPage(pageKey) {
  if (pageKey === "fei-tickets") return renderListPage();
  if (pageKey === "fei-ticket-detail" || pageKey === "fei-ticket-printed" || pageKey === "fei-ticket-records") {
    return renderDetailOrChildPage(pageKey);
  }
  return renderOperationPage(pageKey);
}
function performPrintOperation(pageKey) {
  const bundle = getDataBundle();
  const unit = findUnit(bundle);
  if (!unit) return;
  const detailView = buildPrintableUnitDetailViewModel({
    unit,
    cutOrderRows: bundle.cutOrderRows,
    materialPrepRows: bundle.materialPrepRows,
    markerPlanRefs: bundle.markerPlanRefs,
    markerStore: bundle.markerStore,
    ticketRecords: bundle.ticketRecords,
    printJobs: bundle.printJobs
  });
  if (!detailView.missingSplitDetails.length) return;
  if (!state.operationDraft.operator.trim()) return;
  if (!state.operationDraft.printerName.trim()) return;
  if (!state.operationDraft.templateName.trim()) return;
  if (pageKey === "fei-ticket-reprint" && !state.operationDraft.reason.trim()) return;
  const operationType = pageKey === "fei-ticket-print" ? "FIRST_PRINT" : "REPRINT";
  const params = getCurrentSearchParams();
  const result = executePrintableUnitPrint({
    unit,
    splitDetails: detailView.missingSplitDetails,
    cutOrderRows: bundle.cutOrderRows,
    materialPrepRows: bundle.materialPrepRows,
    markerPlanRefs: bundle.markerPlanRefs,
    markerStore: bundle.markerStore,
    ticketRecords: bundle.ticketRecords,
    printJobs: bundle.printJobs,
    operationType,
    operator: state.operationDraft.operator.trim(),
    operatedAt: nowText(),
    printerName: state.operationDraft.printerName.trim(),
    templateName: state.operationDraft.templateName.trim(),
    reason: state.operationDraft.reason.trim(),
    remark: state.operationDraft.remark.trim(),
    fromTicketId: params.get("ticketRecordId") || void 0
  });
  persistTicketRecords(result.nextRecords);
  persistPrintJobs(result.nextJobs);
  state.operationDraft = createDefaultOperationDraft();
  state.operationSignature = "";
  appStore.navigate(buildActionHref("fei-ticket-printed", unit));
}
function performVoidTicket() {
  const bundle = getDataBundle();
  const unit = findUnit(bundle);
  if (!unit) return;
  const detailView = buildPrintableUnitDetailViewModel({
    unit,
    cutOrderRows: bundle.cutOrderRows,
    materialPrepRows: bundle.materialPrepRows,
    markerPlanRefs: bundle.markerPlanRefs,
    markerStore: bundle.markerStore,
    ticketRecords: bundle.ticketRecords,
    printJobs: bundle.printJobs
  });
  const ticket = findTicketCard(detailView);
  if (!ticket) return;
  if (!state.operationDraft.operator.trim() || !state.operationDraft.reason.trim()) return;
  const result = voidTicketCard({
    recordId: ticket.ticketId,
    ticketRecords: bundle.ticketRecords,
    printJobs: bundle.printJobs,
    operator: state.operationDraft.operator.trim(),
    operatedAt: nowText(),
    reason: state.operationDraft.reason.trim(),
    remark: state.operationDraft.remark.trim(),
    printableUnit: unit
  });
  if (!result) return;
  persistTicketRecords(result.nextRecords);
  persistPrintJobs(result.nextJobs);
  state.operationDraft = createDefaultOperationDraft();
  state.operationSignature = "";
  appStore.navigate(buildActionHref("fei-ticket-printed", unit, { ticketRecordId: ticket.ticketId, panel: "void-info" }));
}
function renderCraftCuttingFeiTicketsPage() {
  return renderPrintableUnitPage("fei-tickets");
}
function renderCraftCuttingFeiTicketDetailPage() {
  const path = getCurrentPathname();
  const match = /^\/fcs\/craft\/cutting\/fei-tickets\/([^/]+)$/.exec(path);
  if (match) return renderStandaloneDetailPage(match[1]);
  return renderPrintableUnitPage("fei-ticket-detail");
}
function renderCraftCuttingFeiTicketPrintedPage() {
  return renderPrintableUnitPage("fei-ticket-printed");
}
function renderCraftCuttingFeiTicketRecordsPage() {
  if (getCurrentPathname() === "/fcs/craft/cutting/fei-tickets/print-records") {
    const bundle = getDataBundle();
    return renderPrintablePageShell(`
      ${renderCuttingPageHeader({
      key: "fei-ticket-records",
      canonicalPath: "/fcs/craft/cutting/fei-tickets/print-records",
      aliases: [],
      menuGroupTitle: "\u88C1\u540E\u5904\u7406",
      pageTitle: "\u6253\u5370\u8BB0\u5F55",
      pageSubtitle: "",
      isPlaceholder: false,
      shortDescription: ""
    }, { actionsHtml: renderStandaloneBackActions(null) })}
      ${renderWorkbenchTabs("PRINT_RECORDS", buildFeiTicketWorkbenchRows(bundle), bundle.printJobs.length)}
      ${renderPrintRecordsWorkbench(bundle)}
    `);
  }
  return renderPrintableUnitPage("fei-ticket-records");
}
function renderCraftCuttingFeiTicketPrintPage() {
  const path = getCurrentPathname();
  const match = /^\/fcs\/craft\/cutting\/fei-tickets\/([^/]+)\/print$/.exec(path);
  if (match) return renderStandalonePrintPage(match[1]);
  return renderPrintableUnitPage("fei-ticket-print");
}
function renderCraftCuttingFeiTicketReprintPage() {
  const path = getCurrentPathname();
  const match = /^\/fcs\/craft\/cutting\/fei-tickets\/([^/]+)\/reprint$/.exec(path);
  if (match) return renderStandaloneReprintPage(match[1]);
  return renderPrintableUnitPage("fei-ticket-reprint");
}
function renderCraftCuttingFeiTicketVoidPage() {
  const path = getCurrentPathname();
  const match = /^\/fcs\/craft\/cutting\/fei-tickets\/([^/]+)\/void$/.exec(path);
  if (match) return renderStandaloneVoidPage(match[1]);
  return renderPrintableUnitPage("fei-ticket-void");
}
function resetFilters() {
  state.filters = { ...initialFilters };
}
function handleCraftCuttingFeiTicketsEvent(target) {
  const fieldNode = target.closest("[data-cutting-fei-field]");
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingFeiField;
    if (!field) return false;
    const input = fieldNode;
    if (field === "printableUnitType") {
      state.filters = { ...state.filters, printableUnitType: input.value };
      return true;
    }
    if (field === "printableUnitStatus") {
      state.filters = { ...state.filters, printableUnitStatus: input.value };
      return true;
    }
    state.filters = { ...state.filters, [field]: input.value };
    return true;
  }
  const opFieldNode = target.closest("[data-cutting-fei-op-field]");
  if (opFieldNode) {
    const field = opFieldNode.dataset.cuttingFeiOpField;
    if (!field) return false;
    const input = opFieldNode;
    state.operationDraft = {
      ...state.operationDraft,
      [field]: input.value
    };
    syncStandaloneReasonControls();
    return true;
  }
  const actionNode = target.closest("[data-cutting-fei-action]");
  if (!actionNode) return false;
  const action = actionNode.dataset.cuttingFeiAction;
  if (!action) return false;
  if (action === "set-status") {
    const status = actionNode.dataset.status;
    if (!status) return false;
    state.filters = { ...state.filters, printableUnitStatus: status };
    return true;
  }
  if (action === "reset-filters") {
    resetFilters();
    return true;
  }
  if (action === "set-operation-reason") {
    const reason = actionNode.dataset.reason || "";
    state.operationDraft = { ...state.operationDraft, reason };
    syncStandaloneReasonControls();
    return true;
  }
  if (action === "return-summary") {
    const context = buildReturnToSummaryContext(getCurrentDrillContext());
    if (!context) return false;
    appStore.navigate(buildCuttingRouteWithContext("summary", context));
    return true;
  }
  if (action === "confirm-first-print") {
    performPrintOperation("fei-ticket-print");
    return true;
  }
  if (action === "confirm-reprint") {
    performPrintOperation("fei-ticket-reprint");
    return true;
  }
  if (action === "confirm-void-ticket") {
    performVoidTicket();
    return true;
  }
  if (action === "standalone-reprint-confirm" || action === "standalone-void-confirm") {
    const currentReason = (getCurrentSearchParams().get("reason") || state.operationDraft.reason).trim();
    if (!currentReason) return true;
    const path = getCurrentPathname();
    const ticketId = path.split("/fei-tickets/")[1]?.split("/")[0] || "";
    const target2 = action === "standalone-reprint-confirm" ? `/fcs/craft/cutting/fei-tickets/print-records?ticketId=${encodeURIComponent(ticketId)}&action=reprint&reason=${encodeURIComponent(currentReason)}` : `/fcs/craft/cutting/fei-tickets/print-records?ticketId=${encodeURIComponent(ticketId)}&action=void&reason=${encodeURIComponent(currentReason)}`;
    state.operationDraft = createDefaultOperationDraft();
    appStore.navigate(target2);
    return true;
  }
  return false;
}
export {
  handleCraftCuttingFeiTicketsEvent,
  renderCraftCuttingFeiTicketDetailPage,
  renderCraftCuttingFeiTicketPrintPage,
  renderCraftCuttingFeiTicketPrintedPage,
  renderCraftCuttingFeiTicketRecordsPage,
  renderCraftCuttingFeiTicketReprintPage,
  renderCraftCuttingFeiTicketVoidPage,
  renderCraftCuttingFeiTicketsPage
};
