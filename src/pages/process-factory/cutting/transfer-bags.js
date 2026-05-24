import { appStore } from "../../../state/store.ts";
import { renderRealQrPlaceholder } from "../../../components/real-qr.ts";
import { escapeHtml, formatDateTime } from "../../../utils.ts";
import {
  CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY,
  serializeFeiTicketRecordsStorage
} from "./fei-tickets-model.ts";
import {
  paginateItems,
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchActionCard,
  renderWorkbenchFilterChip,
  renderWorkbenchPagination,
  renderWorkbenchSecondaryPanel,
  renderWorkbenchStateBar
} from "./layout.helpers.ts";
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, renderCuttingPageHeader } from "./meta.ts";
import {
  getWarehouseSearchParams
} from "./warehouse-shared.ts";
import {
  buildCuttingTraceabilityId
} from "../../../data/fcs/cutting/qr-codes.ts";
import { buildTransferBagLabelPrintLink } from "../../../data/fcs/fcs-route-links.ts";
import { formatFactoryDisplayName } from "../../../data/fcs/factory-mock-data.ts";
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  getCuttingSourcePageLabel,
  hasSummaryReturnContext,
  buildCuttingDrillContext,
  readCuttingDrillContextFromLocation
} from "./navigation-context.ts";
import {
  buildTransferBagsProjection
} from "./transfer-bags-projection.ts";
import {
  resolveCarrierScanInput,
  resolveFeiTicketScanInput
} from "./traceability-projection-helpers.ts";
import {
  buildBagUsageAuditTrail,
  buildTransferBagCarrierManagementProjection,
  buildTransferBagParentChildSummary,
  createTransferBagDispatchManifest,
  createTransferBagUsageDraft,
  CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY,
  CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY,
  deriveTransferBagMasterStatus,
  deriveTransferBagUsageStatus,
  deserializeTransferBagSelectedTicketIds,
  ensureUsageContextLockedByTicket,
  serializeTransferBagSelectedTicketIds,
  serializeTransferBagStorage,
  validateTicketBindingEligibility
} from "./transfer-bags-model.ts";
import {
  buildBagReturnAuditTrail,
  buildReuseCycleSummary,
  buildReturnExceptionMeta,
  closeTransferBagUsageCycle,
  createReturnReceiptDraft,
  deriveBagConditionDecision,
  deriveReturnEligibility,
  validateReturnReceiptPayload
} from "./transfer-bag-return-model.ts";
import { renderMaterialIdentityBlock } from "./material-identity.ts";
function nowText(date = /* @__PURE__ */ new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => Boolean(value))));
}
function hasExplicitUsageContext(prefilter) {
  return Boolean(prefilter?.usageId || prefilter?.usageNo);
}
function hasExplicitBagContext(prefilter) {
  return Boolean(prefilter?.bagId || prefilter?.bagCode);
}
function hasSourceContext(prefilter) {
  return Boolean(
    prefilter?.cutOrderId || prefilter?.cutOrderNo || prefilter?.productionOrderId || prefilter?.productionOrderNo || prefilter?.markerPlanId || prefilter?.markerPlanNo || prefilter?.\u551B\u67B6\u65B9\u6848No || prefilter?.materialSku || prefilter?.spreadingSessionId || prefilter?.sourceWritebackId || prefilter?.styleCode || prefilter?.cuttingGroup || prefilter?.warehouseStatus
  );
}
function buildSourceOnlyPrefilter(prefilter) {
  if (!prefilter) return null;
  return {
    cutOrderId: prefilter.cutOrderId,
    cutOrderNo: prefilter.cutOrderNo,
    productionOrderId: prefilter.productionOrderId,
    productionOrderNo: prefilter.productionOrderNo,
    markerPlanId: prefilter.markerPlanId,
    markerPlanNo: prefilter.markerPlanNo,
    \u551B\u67B6\u65B9\u6848No: prefilter.\u551B\u67B6\u65B9\u6848No,
    materialSku: prefilter.materialSku,
    spreadingSessionId: prefilter.spreadingSessionId,
    sourceWritebackId: prefilter.sourceWritebackId,
    styleCode: prefilter.styleCode,
    cuttingGroup: prefilter.cuttingGroup,
    warehouseStatus: prefilter.warehouseStatus
  };
}
function hasResolverLookupContext(prefilter) {
  return Boolean(
    prefilter?.usageId || prefilter?.usageNo || prefilter?.bagId || prefilter?.bagCode || prefilter?.ticketId || prefilter?.ticketNo || prefilter?.sewingTaskNo || prefilter?.cutOrderId || prefilter?.cutOrderNo || prefilter?.productionOrderId || prefilter?.productionOrderNo || prefilter?.markerPlanId || prefilter?.markerPlanNo || prefilter?.\u551B\u67B6\u65B9\u6848No || prefilter?.materialSku || prefilter?.spreadingSessionId || prefilter?.sourceWritebackId || prefilter?.styleCode
  );
}
function getProjection() {
  return buildTransferBagsProjection(void 0, state.store);
}
function hydrateStore() {
  return buildTransferBagsProjection().store;
}
const state = {
  store: hydrateStore(),
  masterKeyword: "",
  masterStatus: "ALL",
  masterPage: 1,
  masterPageSize: 10,
  usageKeyword: "",
  usageStatus: "ALL",
  usageSewingTaskId: "ALL",
  returnKeyword: "",
  returnStatus: "ALL",
  bindingKeyword: "",
  activeMasterId: null,
  activeUsageId: null,
  prefilter: null,
  drillContext: null,
  landingBanner: null,
  querySignature: "",
  preselectedTicketRecordIds: deserializeTransferBagSelectedTicketIds(
    sessionStorage.getItem(CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY)
  ),
  draft: {
    bagId: "",
    bagCodeInput: "",
    sewingTaskId: "",
    ticketInput: "",
    note: ""
  },
  returnDraft: {
    returnWarehouseName: "",
    returnAt: "",
    returnedBy: "",
    receivedBy: "",
    returnedFinishedQty: "",
    returnedTicketCountSummary: "",
    discrepancyType: "NONE",
    discrepancyNote: "",
    note: ""
  },
  conditionDraft: {
    conditionStatus: "GOOD",
    cleanlinessStatus: "CLEAN",
    damageType: "",
    repairNeeded: false,
    reusableDecision: "REUSABLE",
    note: ""
  },
  feedback: null
};
function getViewModel() {
  return getProjection().viewModel;
}
function getReturnViewModel() {
  return getProjection().returnViewModel;
}
function getCarrierManagementProjection() {
  return buildTransferBagCarrierManagementProjection(state.store, getViewModel());
}
function persistStore() {
  localStorage.setItem(CUTTING_TRANSFER_BAG_LEDGER_STORAGE_KEY, serializeTransferBagStorage(state.store));
  const nextTicketRecords = getProjection().ticketRecords;
  localStorage.setItem(CUTTING_FEI_TICKET_RECORDS_STORAGE_KEY, serializeFeiTicketRecordsStorage(nextTicketRecords));
}
function persistSelectedTicketIds() {
  if (state.preselectedTicketRecordIds.length) {
    sessionStorage.setItem(
      CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY,
      serializeTransferBagSelectedTicketIds(state.preselectedTicketRecordIds)
    );
  } else {
    sessionStorage.removeItem(CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY);
  }
}
function setFeedback(tone, message) {
  state.feedback = { tone, message };
}
function syncReusableDecisionSuggestion() {
  const suggested = deriveBagConditionDecision({
    conditionStatus: state.conditionDraft.conditionStatus,
    cleanlinessStatus: state.conditionDraft.cleanlinessStatus,
    damageType: state.conditionDraft.damageType,
    repairNeeded: state.conditionDraft.repairNeeded
  });
  state.conditionDraft = {
    ...state.conditionDraft,
    reusableDecision: suggested.reusableDecision
  };
}
function matchPrefilter(itemValues, search) {
  if (!search) return true;
  return itemValues.some((value) => value?.includes(search));
}
function matchesUsagePrefilter(item, prefilter = state.prefilter) {
  if (!prefilter) return true;
  const bindingItems = item.bindingItems || [];
  const cutOrderIds = uniqueStrings([
    ...bindingItems.map((binding) => binding.cutOrderId),
    item.navigationPayload.cutOrders.cutOrderId
  ]);
  const productionOrderIds = uniqueStrings([
    ...bindingItems.map((binding) => binding.ticket?.productionOrderId),
    item.navigationPayload.cutOrders.productionOrderId
  ]);
  const markerPlanIds = uniqueStrings([
    ...bindingItems.map((binding) => binding.ticket?.markerPlanId),
    item.navigationPayload.cutOrders.markerPlanId
  ]);
  const materialSkus = uniqueStrings(bindingItems.map((binding) => binding.ticket?.materialSku));
  const styleCodes = uniqueStrings([item.styleCode, ...bindingItems.map((binding) => binding.ticket?.styleCode)]);
  return matchPrefilter([item.usageId], prefilter.usageId) && matchPrefilter([item.usageNo], prefilter.usageNo) && matchPrefilter([item.bagId], prefilter.bagId) && matchPrefilter([item.bagCode], prefilter.bagCode) && matchPrefilter(cutOrderIds, prefilter.cutOrderId) && matchPrefilter(item.cutOrderNos, prefilter.cutOrderNo) && matchPrefilter(productionOrderIds, prefilter.productionOrderId) && matchPrefilter(item.productionOrderNos, prefilter.productionOrderNo) && matchPrefilter(markerPlanIds, prefilter.markerPlanId) && matchPrefilter(item.markerPlanNos, prefilter.markerPlanNo || prefilter.\u551B\u67B6\u65B9\u6848No) && matchPrefilter(materialSkus, prefilter.materialSku) && matchPrefilter([item.spreadingSessionId], prefilter.spreadingSessionId) && matchPrefilter([item.spreadingSourceWritebackId], prefilter.sourceWritebackId) && matchPrefilter(styleCodes, prefilter.styleCode) && matchPrefilter([item.sewingTaskNo], prefilter.sewingTaskNo) && matchPrefilter(bindingItems.map((binding) => binding.ticket?.feiTicketId || binding.ticketRecordId), prefilter.ticketId) && matchPrefilter(item.ticketNos, prefilter.ticketNo);
}
function matchesBindingPrefilter(item, prefilter = state.prefilter) {
  if (!prefilter) return true;
  return matchPrefilter([item.ticket?.feiTicketId || item.ticketRecordId], prefilter.ticketId) && matchPrefilter([item.ticketNo], prefilter.ticketNo) && matchPrefilter([item.cutOrderId], prefilter.cutOrderId) && matchPrefilter([item.cutOrderNo], prefilter.cutOrderNo) && matchPrefilter([item.ticket?.productionOrderId || item.navigationPayload.cutOrders.productionOrderId], prefilter.productionOrderId) && matchPrefilter([item.productionOrderNo], prefilter.productionOrderNo) && matchPrefilter([item.ticket?.markerPlanId || item.navigationPayload.cutOrders.markerPlanId], prefilter.markerPlanId) && matchPrefilter([item.markerPlanNo || item.\u551B\u67B6\u65B9\u6848No], prefilter.markerPlanNo || prefilter.\u551B\u67B6\u65B9\u6848No) && matchPrefilter([item.ticket?.materialSku], prefilter.materialSku) && matchPrefilter([item.spreadingSessionId], prefilter.spreadingSessionId) && matchPrefilter([item.spreadingSourceWritebackId], prefilter.sourceWritebackId) && matchPrefilter([item.ticket?.styleCode], prefilter.styleCode) && matchPrefilter([item.bagId], prefilter.bagId) && matchPrefilter([item.bagCode], prefilter.bagCode) && matchPrefilter([item.usageId], prefilter.usageId) && matchPrefilter([item.usage?.usageNo], prefilter.usageNo) && matchPrefilter([item.usage?.sewingTaskNo], prefilter.sewingTaskNo);
}
function findMatchingUsages(prefilter, viewModel = getViewModel()) {
  if (!prefilter || !hasResolverLookupContext(prefilter)) return [];
  return viewModel.usages.filter((item) => matchesUsagePrefilter(item, prefilter));
}
function findMatchingBindings(prefilter, viewModel = getViewModel()) {
  if (!prefilter || !hasResolverLookupContext(prefilter)) return [];
  return viewModel.bindings.filter((item) => matchesBindingPrefilter(item, prefilter));
}
function findMatchingMasters(prefilter, viewModel = getViewModel()) {
  if (!prefilter) return [];
  const matchedBagIds = /* @__PURE__ */ new Set();
  if (prefilter.bagId || prefilter.bagCode) {
    viewModel.masters.filter((item) => matchPrefilter([item.bagId], prefilter.bagId) && matchPrefilter([item.bagCode], prefilter.bagCode)).forEach((item) => matchedBagIds.add(item.bagId));
  }
  findMatchingUsages(prefilter, viewModel).forEach((item) => matchedBagIds.add(item.bagId));
  findMatchingBindings(prefilter, viewModel).forEach((item) => matchedBagIds.add(item.bagId));
  return matchedBagIds.size ? viewModel.masters.filter((item) => matchedBagIds.has(item.bagId)) : [];
}
function matchesMasterStatusFilter(item, filter) {
  if (filter === "ALL") return true;
  return item.visibleStatusKey === filter;
}
function getMasterBaseItems() {
  const keyword = state.masterKeyword.trim().toLowerCase();
  const matchedMasterIds = state.prefilter ? new Set(findMatchingMasters(state.prefilter).map((item) => item.bagId)) : null;
  return getViewModel().masters.filter((item) => {
    if (item.visibleStatusKey === "ARCHIVED") return false;
    if (matchedMasterIds && matchedMasterIds.size && !matchedMasterIds.has(item.bagId)) return false;
    if (keyword) {
      const haystack = [item.bagCode, item.bagType, item.currentLocation, item.latestUsageNo, item.note].join(" ").toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
}
function getFilteredMasters(baseItems = getMasterBaseItems()) {
  return baseItems.filter((item) => matchesMasterStatusFilter(item, state.masterStatus));
}
function getTransferBagListStats(baseItems = getMasterBaseItems()) {
  return [
    {
      label: "\u4E2D\u8F6C\u888B\u603B\u6570",
      count: baseItems.length,
      filter: "ALL",
      accentClass: "text-slate-900"
    },
    {
      label: "\u7A7A\u95F2\u53E3\u888B\u6570",
      count: baseItems.filter((item) => matchesMasterStatusFilter(item, "IDLE")).length,
      filter: "IDLE",
      accentClass: "text-emerald-600"
    },
    {
      label: "\u4F7F\u7528\u4E2D\u53E3\u888B\u6570",
      count: baseItems.filter((item) => matchesMasterStatusFilter(item, "IN_PROGRESS")).length,
      filter: "IN_PROGRESS",
      accentClass: "text-blue-600"
    },
    {
      label: "\u5F85\u4EA4\u51FA\u53E3\u888B\u6570",
      count: baseItems.filter((item) => matchesMasterStatusFilter(item, "READY_HANDOVER")).length,
      filter: "READY_HANDOVER",
      accentClass: "text-violet-600"
    }
  ];
}
function resetMasterPagination() {
  state.masterPage = 1;
}
function getPagedMasters() {
  const baseItems = getMasterBaseItems();
  const filteredItems = getFilteredMasters(baseItems);
  const pageSlice = paginateItems(filteredItems, state.masterPage, state.masterPageSize);
  state.masterPage = pageSlice.page;
  return {
    baseItems,
    filteredItems,
    pageSlice
  };
}
function getFilteredUsages() {
  const keyword = state.usageKeyword.trim().toLowerCase();
  return getViewModel().usages.filter((item) => {
    if (state.usageStatus !== "ALL" && item.usageStatus !== state.usageStatus) return false;
    if (state.usageSewingTaskId !== "ALL" && item.sewingTaskId !== state.usageSewingTaskId) return false;
    if (!matchesUsagePrefilter(item)) return false;
    if (keyword) {
      const haystack = [
        item.usageNo,
        item.bagCode,
        item.usageStageLabel,
        item.sewingTaskNo,
        item.sewingFactoryName,
        item.styleCode,
        item.spuCode,
        item.ticketNos.join(" "),
        item.cutOrderNos.join(" ")
      ].join(" ").toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
}
function getFilteredBindings() {
  const keyword = state.bindingKeyword.trim().toLowerCase();
  return getViewModel().bindings.filter((item) => {
    if (!matchesBindingPrefilter(item)) return false;
    if (keyword) {
      const haystack = [
        item.bagCode,
        item.ticketNo,
        item.cutOrderNo,
        item.productionOrderNo,
        item.markerPlanNo || item.\u551B\u67B6\u65B9\u6848No,
        item.usage?.usageNo
      ].join(" ").toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
}
function getPrefilterFromQuery() {
  const params = getWarehouseSearchParams();
  const drillContext = readCuttingDrillContextFromLocation(params);
  const prefilter = {
    cutOrderId: drillContext?.cutOrderId || params.get("cutOrderId") || void 0,
    cutOrderNo: drillContext?.cutOrderNo || params.get("cutOrderNo") || void 0,
    markerPlanId: drillContext?.markerPlanId || params.get("markerPlanId") || void 0,
    \u551B\u67B6\u65B9\u6848No: drillContext?.markerPlanNo || params.get("\u551B\u67B6\u65B9\u6848No") || void 0,
    markerPlanNo: drillContext?.markerPlanNo || params.get("markerPlanNo") || void 0,
    materialSku: drillContext?.materialSku || params.get("materialSku") || void 0,
    spreadingSessionId: drillContext?.spreadingSessionId || params.get("spreadingSessionId") || params.get("sessionId") || void 0,
    sourceWritebackId: params.get("sourceWritebackId") || params.get("holder") || void 0,
    styleCode: drillContext?.styleCode || params.get("styleCode") || void 0,
    ticketId: drillContext?.ticketId || params.get("ticketId") || params.get("ticketRecordId") || void 0,
    cuttingGroup: drillContext?.cuttingGroup || params.get("cuttingGroup") || void 0,
    warehouseStatus: drillContext?.warehouseStatus || params.get("warehouseStatus") || void 0,
    ticketNo: drillContext?.ticketNo || params.get("ticketNo") || void 0,
    sewingTaskNo: params.get("sewingTaskNo") || void 0,
    bagId: drillContext?.bagId || params.get("bagId") || void 0,
    bagCode: drillContext?.bagCode || params.get("bagCode") || void 0,
    usageId: drillContext?.usageId || params.get("usageId") || void 0,
    usageNo: drillContext?.usageNo || params.get("usageNo") || void 0,
    returnStatus: params.get("returnStatus") || void 0,
    productionOrderId: drillContext?.productionOrderId || params.get("productionOrderId") || void 0,
    productionOrderNo: drillContext?.productionOrderNo || params.get("productionOrderNo") || void 0
  };
  return Object.values(prefilter).some(Boolean) ? prefilter : null;
}
function getActiveMaster() {
  if (!state.activeMasterId) return null;
  return getViewModel().mastersById[state.activeMasterId] ?? null;
}
function getActiveUsage() {
  if (!state.activeUsageId) return null;
  return getViewModel().usagesById[state.activeUsageId] ?? null;
}
function getSourceMaster(bagId) {
  if (!bagId) return null;
  return state.store.masters.find((item) => item.bagId === bagId) ?? null;
}
function getSourceUsage(usageId) {
  if (!usageId) return null;
  return state.store.usages.find((item) => item.usageId === usageId) ?? null;
}
function getSelectedBag() {
  const bagId = state.draft.bagId || getActiveUsage()?.bagId || getActiveMaster()?.bagId || "";
  if (bagId) return getSourceMaster(bagId);
  return resolveCarrierScanInput(state.draft.bagCodeInput, state.store);
}
function getCandidateTickets() {
  const viewModel = getViewModel();
  if (state.preselectedTicketRecordIds.length) {
    return state.preselectedTicketRecordIds.map((id) => viewModel.ticketCandidatesById[id]).filter((item) => Boolean(item));
  }
  if (!state.prefilter) return [];
  return viewModel.ticketCandidates.filter((ticket) => {
    if (state.prefilter.ticketId && ticket.feiTicketId !== state.prefilter.ticketId) return false;
    if (state.prefilter.cutOrderId && ticket.cutOrderId !== state.prefilter.cutOrderId) return false;
    if (state.prefilter.ticketNo && ticket.ticketNo !== state.prefilter.ticketNo) return false;
    if (state.prefilter.cutOrderNo && ticket.cutOrderNo !== state.prefilter.cutOrderNo) return false;
    if (state.prefilter.productionOrderId && ticket.productionOrderId !== state.prefilter.productionOrderId) return false;
    if (state.prefilter.productionOrderNo && ticket.productionOrderNo !== state.prefilter.productionOrderNo) return false;
    if (state.prefilter.markerPlanId && ticket.markerPlanId !== state.prefilter.markerPlanId) return false;
    if (state.prefilter.\u551B\u67B6\u65B9\u6848No && ticket.markerPlanNo !== state.prefilter.\u551B\u67B6\u65B9\u6848No) return false;
    if (state.prefilter.materialSku && ticket.materialSku !== state.prefilter.materialSku) return false;
    if (state.prefilter.spreadingSessionId && ticket.sourceSpreadingSessionId !== state.prefilter.spreadingSessionId) return false;
    if (state.prefilter.styleCode && ticket.styleCode !== state.prefilter.styleCode) return false;
    return true;
  });
}
function getSelectedTicketRecord() {
  const record = resolveFeiTicketScanInput(state.draft.ticketInput, getProjection().ticketRecords);
  if (!record) return null;
  return getViewModel().ticketCandidatesById[record.ticketRecordId] ?? null;
}
function resolveLockedUsageContext(usage, ticket) {
  return ensureUsageContextLockedByTicket({
    usage,
    ticket,
    sewingTasks: getViewModel().sewingTasks,
    sewingTasksById: getViewModel().sewingTasksById
  });
}
function ensureUsageAutoCreatedForTicket(ticket) {
  const existingUsage = getSourceUsage(state.activeUsageId);
  if (existingUsage) return existingUsage;
  const bag = getSelectedBag();
  if (!bag) {
    setFeedback("warning", "\u5F53\u524D\u672A\u9501\u5B9A\u4E2D\u8F6C\u888B\uFF0C\u8BF7\u5148\u4ECE\u5217\u8868\u8FDB\u5165\u8BE6\u60C5\u540E\u518D\u626B\u7801\u88C5\u888B\u3002");
    return null;
  }
  if (!["IDLE", "REUSABLE"].includes(bag.currentStatus)) {
    setFeedback("warning", `${bag.bagCode} \u5F53\u524D\u72B6\u6001\u4E3A\u201C${deriveTransferBagMasterStatus(bag.currentStatus).label}\u201D\uFF0C\u5F53\u524D\u4E0D\u80FD\u5F00\u59CB\u65B0\u7684\u5468\u8F6C\u3002`);
    return null;
  }
  const context = resolveLockedUsageContext(null, ticket);
  if (!context.ok || !context.sewingTask) {
    setFeedback("warning", context.reason || "\u5F53\u524D\u83F2\u7968\u65E0\u6CD5\u81EA\u52A8\u9501\u5B9A\u8F66\u7F1D\u5382 / \u4EFB\u52A1\uFF0C\u6682\u4E0D\u80FD\u88C5\u888B\u3002");
    return null;
  }
  const now = nowText();
  const usage = createTransferBagUsageDraft({
    bag,
    sewingTask: context.sewingTask,
    note: `\u626B\u63CF\u9996\u5F20\u83F2\u7968\u540E\u81EA\u52A8\u9501\u5B9A\u5230 ${context.sewingTask.sewingFactoryName} / ${context.sewingTask.sewingTaskNo}\u3002`,
    existingUsages: state.store.usages,
    nowText: now
  });
  state.store.usages.push(usage);
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action: "\u5F00\u59CB\u672C\u6B21\u5468\u8F6C",
      actionAt: now,
      actionBy: "\u4E2D\u8F6C\u888B\u5DE5\u4F5C\u53F0",
      note: `${usage.bagCode} \u5DF2\u81EA\u52A8\u9501\u5B9A\u5230 ${usage.sewingFactoryName} / ${usage.sewingTaskNo}\u3002`
    })
  );
  refreshDerivedState();
  persistStore();
  syncUsageSelection(usage.usageId);
  return getSourceUsage(usage.usageId);
}
function resolveTransferBagLandingFromPrefilter(prefilter, viewModel = getViewModel()) {
  if (!prefilter) return null;
  if (hasExplicitUsageContext(prefilter)) {
    const matchedUsages2 = viewModel.usages.filter(
      (item) => matchPrefilter([item.usageId], prefilter.usageId) && matchPrefilter([item.usageNo], prefilter.usageNo)
    );
    if (matchedUsages2.length === 1) {
      const matchedUsage = matchedUsages2[0];
      return {
        page: "detail",
        reason: "explicit-usage",
        bagId: matchedUsage.bagId,
        bagCode: matchedUsage.bagCode,
        usageId: matchedUsage.usageId,
        usageNo: matchedUsage.usageNo
      };
    }
    return {
      page: "list",
      reason: matchedUsages2.length ? "ambiguous-usage" : "missing-usage",
      matchedCount: matchedUsages2.length
    };
  }
  if (hasExplicitBagContext(prefilter)) {
    const matchedMasters = viewModel.masters.filter(
      (item) => matchPrefilter([item.bagId], prefilter.bagId) && matchPrefilter([item.bagCode], prefilter.bagCode)
    );
    if (matchedMasters.length === 1) {
      const matchedMaster = matchedMasters[0];
      return {
        page: "detail",
        reason: "explicit-bag",
        bagId: matchedMaster.bagId,
        bagCode: matchedMaster.bagCode,
        usageId: matchedMaster.currentUsage?.usageId || void 0,
        usageNo: matchedMaster.currentUsage?.usageNo || void 0
      };
    }
    return {
      page: "list",
      reason: matchedMasters.length ? "ambiguous-bag" : "missing-bag",
      matchedCount: matchedMasters.length
    };
  }
  if (!hasSourceContext(prefilter)) {
    return {
      page: "list",
      reason: "no-source-context",
      matchedCount: 0
    };
  }
  const sourcePrefilter = buildSourceOnlyPrefilter(prefilter);
  if (!hasResolverLookupContext(sourcePrefilter)) {
    return {
      page: "list",
      reason: "source-context-without-object-signal",
      matchedCount: 0
    };
  }
  const matchedUsages = findMatchingUsages(sourcePrefilter, viewModel);
  if (matchedUsages.length === 1) {
    const matchedUsage = matchedUsages[0];
    return {
      page: "detail",
      reason: "source-unique-usage",
      bagId: matchedUsage.bagId,
      bagCode: matchedUsage.bagCode,
      usageId: matchedUsage.usageId,
      usageNo: matchedUsage.usageNo
    };
  }
  const matchedBindings = findMatchingBindings(sourcePrefilter, viewModel);
  const matchedBindingUsages = uniqueStrings(matchedBindings.map((item) => item.usageId)).map((usageId) => viewModel.usagesById[usageId]).filter((item) => Boolean(item));
  if (matchedBindingUsages.length === 1) {
    const matchedUsage = matchedBindingUsages[0];
    return {
      page: "detail",
      reason: "source-unique-binding-usage",
      bagId: matchedUsage.bagId,
      bagCode: matchedUsage.bagCode,
      usageId: matchedUsage.usageId,
      usageNo: matchedUsage.usageNo
    };
  }
  const matchedBagIds = uniqueStrings([
    ...matchedUsages.map((item) => item.bagId),
    ...matchedBindings.map((item) => item.bagId)
  ]);
  if (matchedBagIds.length === 1) {
    const matchedMaster = viewModel.mastersById[matchedBagIds[0]];
    if (matchedMaster) {
      return {
        page: "detail",
        reason: "source-unique-bag",
        bagId: matchedMaster.bagId,
        bagCode: matchedMaster.bagCode,
        usageId: matchedMaster.currentUsage?.usageId || void 0,
        usageNo: matchedMaster.currentUsage?.usageNo || void 0
      };
    }
  }
  return {
    page: "list",
    reason: matchedBagIds.length || matchedUsages.length || matchedBindingUsages.length ? "source-ambiguous" : "source-not-found",
    matchedCount: Math.max(matchedBagIds.length, matchedUsages.length, matchedBindingUsages.length)
  };
}
function buildTransferBagLandingBanner(prefilter, drillContext, resolution, viewModel = getViewModel()) {
  if (!prefilter || !resolution || resolution.page !== "list" || !hasSourceContext(prefilter)) return null;
  const matchedUsages = findMatchingUsages(prefilter, viewModel);
  const matchedBindings = findMatchingBindings(prefilter, viewModel);
  const sourceMarkerNos = uniqueStrings([
    ...matchedUsages.flatMap((item) => item.sourceMarkerNos),
    ...matchedBindings.map((item) => item.sourceMarkerNo)
  ]);
  const sourceMarkerPlanNos = uniqueStrings([
    ...matchedUsages.flatMap((item) => item.markerPlanNos),
    ...matchedBindings.map((item) => item.markerPlanNo || item.\u551B\u67B6\u65B9\u6848No)
  ]);
  const sourceCutOrderNos = uniqueStrings([
    ...matchedUsages.flatMap((item) => item.cutOrderNos),
    ...matchedBindings.map((item) => item.cutOrderNo)
  ]);
  const sourceSpreadingNos = uniqueStrings([
    ...matchedUsages.map((item) => item.spreadingSessionNo || item.spreadingSessionId),
    ...matchedBindings.map((item) => item.spreadingSessionNo || item.spreadingSessionId)
  ]);
  const chips = Array.from(new Set([
    ...buildCuttingDrillChipLabels(drillContext).filter(
      (label) => !label.startsWith("\u4E2D\u8F6C\u888B\u7801\uFF1A") && !label.startsWith("\u4F7F\u7528\u5468\u671F\uFF1A")
    ),
    !drillContext?.cutOrderNo && sourceCutOrderNos.length ? `\u6765\u6E90\u88C1\u7247\u5355\uFF1A${sourceCutOrderNos.join(" / ")}` : "",
    !drillContext?.markerNo && sourceMarkerNos.length ? `\u6765\u6E90\u551B\u67B6\uFF1A${sourceMarkerNos.join(" / ")}` : "",
    !drillContext?.markerPlanNo && sourceMarkerPlanNos.length ? `\u6765\u6E90\u551B\u67B6\u65B9\u6848\uFF1A${sourceMarkerPlanNos.join(" / ")}` : "",
    !drillContext?.spreadingSessionNo && sourceSpreadingNos.length ? `\u6765\u6E90\u94FA\u5E03\uFF1A${sourceSpreadingNos.join(" / ")}` : ""
  ].filter(Boolean)));
  if (!chips.length) return null;
  const sourceLabel = getCuttingSourcePageLabel(drillContext?.sourcePageKey);
  const summary = resolution.matchedCount && resolution.matchedCount > 1 ? `\u5DF2\u4ECE${sourceLabel}\u5E26\u5165\u4E0A\u4E0B\u6587\uFF0C\u5F53\u524D\u672A\u552F\u4E00\u5339\u914D\u5230\u67D0\u4E2A\u4E2D\u8F6C\u888B\uFF0C\u8BF7\u5148\u9009\u62E9\u53E3\u888B\u6216\u8FDB\u5165\u8BE6\u60C5\u3002` : `\u5DF2\u4ECE${sourceLabel}\u5E26\u5165\u4E0A\u4E0B\u6587\uFF0C\u5F53\u524D\u8FD8\u672A\u5B9A\u4F4D\u5230\u5BF9\u5E94\u4E2D\u8F6C\u888B\uFF0C\u8BF7\u5148\u9009\u62E9\u53E3\u888B\u6216\u8FDB\u5165\u8BE6\u60C5\u3002`;
  return {
    summary,
    chips
  };
}
function refreshDerivedState() {
  const usageMap = /* @__PURE__ */ new Map();
  const closureMap = /* @__PURE__ */ new Map();
  state.store.bindings.forEach((binding) => {
    const current = usageMap.get(binding.usageId);
    if (current) {
      current.push(binding);
    } else {
      usageMap.set(binding.usageId, [binding]);
    }
  });
  state.store.usages.forEach((usage) => {
    const bindings = usageMap.get(usage.usageId) || [];
    usage.packedTicketCount = bindings.length;
    usage.packedCutOrderCount = uniqueStrings(bindings.map((item) => item.cutOrderNo)).length;
    if (usage.usageStatus === "DRAFT" || usage.usageStatus === "PACKING" || usage.usageStatus === "READY_TO_DISPATCH") {
      if (!bindings.length) {
        usage.usageStatus = "DRAFT";
      } else if (usage.usageStatus !== "READY_TO_DISPATCH") {
        usage.usageStatus = "PACKING";
      }
    }
  });
  state.store.closureResults.forEach((closure) => {
    const current = closureMap.get(closure.usageId);
    if (current) {
      current.push(closure);
    } else {
      closureMap.set(closure.usageId, [closure]);
    }
  });
  state.store.masters.forEach((master) => {
    const relatedUsages = state.store.usages.filter((usage) => usage.bagId === master.bagId);
    const latestUsage = relatedUsages.sort((left, right) => right.usageNo.localeCompare(left.usageNo, "zh-CN"))[0] || null;
    if (!latestUsage) {
      master.currentStatus = "IDLE";
      master.latestUsageId = "";
      master.latestUsageNo = "";
      return;
    }
    master.latestUsageId = latestUsage.usageId;
    master.latestUsageNo = latestUsage.usageNo;
    const latestClosure = (closureMap.get(latestUsage.usageId) || []).sort((left, right) => right.closedAt.localeCompare(left.closedAt, "zh-CN"))[0] || null;
    if (latestUsage.usageStatus === "DISPATCHED") {
      master.currentStatus = "DISPATCHED";
      master.currentLocation = latestUsage.sewingFactoryName || "\u8F66\u7F1D\u5DE5\u5382\u5F85\u786E\u8BA4";
    } else if (latestUsage.usageStatus === "PENDING_SIGNOFF") {
      master.currentStatus = "WAITING_SIGNOFF";
      master.currentLocation = latestUsage.sewingFactoryName || "\u5F85\u7B7E\u6536\u5DE5\u5382";
    } else if (latestUsage.usageStatus === "WAITING_RETURN") {
      master.currentStatus = "WAITING_RETURN";
      master.currentLocation = latestUsage.sewingFactoryName || "\u5F85\u56DE\u4ED3\u5DE5\u5382";
    } else if (latestUsage.usageStatus === "RETURN_INSPECTING") {
      master.currentStatus = "RETURN_INSPECTING";
      master.currentLocation = "\u88C1\u7247\u4ED3\u56DE\u8D27\u9A8C\u6536\u533A";
    } else if (latestUsage.usageStatus === "CLOSED" || latestUsage.usageStatus === "EXCEPTION_CLOSED") {
      master.currentStatus = latestClosure?.nextBagStatus || "REUSABLE";
      master.currentLocation = latestClosure?.nextBagStatus === "WAITING_CLEANING" ? "\u88C1\u7247\u4ED3\u5F85\u6E05\u6D01\u533A" : latestClosure?.nextBagStatus === "WAITING_REPAIR" ? "\u7EF4\u4FEE\u5F85\u5904\u7406\u533A" : latestClosure?.nextBagStatus === "DISABLED" ? "\u505C\u7528\u9694\u79BB\u533A" : "\u88C1\u7247\u4ED3\u590D\u7528\u4F4D";
    } else {
      master.currentStatus = "IN_USE";
      master.currentLocation = "\u8F66\u7F1D\u6D41\u8F6C\u5F85\u53D1\u533A";
    }
  });
  state.store.reuseCycles = state.store.masters.map(
    (master) => buildReuseCycleSummary({
      bag: master,
      usages: state.store.usages,
      returnReceipts: state.store.returnReceipts,
      closureResults: state.store.closureResults
    })
  );
}
function syncPrefilterFromQuery() {
  const pathname = appStore.getState().pathname;
  if (pathname === state.querySignature) return;
  state.querySignature = pathname;
  state.drillContext = readCuttingDrillContextFromLocation(getWarehouseSearchParams());
  state.prefilter = getPrefilterFromQuery();
  state.preselectedTicketRecordIds = deserializeTransferBagSelectedTicketIds(
    sessionStorage.getItem(CUTTING_TRANSFER_BAG_SELECTED_TICKET_IDS_STORAGE_KEY)
  );
  const viewModel = getViewModel();
  const detailPage = isTransferBagDetailPage();
  const landing = resolveTransferBagLandingFromPrefilter(state.prefilter, viewModel);
  state.landingBanner = buildTransferBagLandingBanner(state.prefilter, state.drillContext, landing, viewModel);
  if (landing?.page === "detail" && landing.bagId) {
    const matchedMaster = viewModel.mastersById[landing.bagId] || null;
    state.activeMasterId = matchedMaster?.bagId ?? null;
    state.draft.bagCodeInput = matchedMaster?.bagCode || landing.bagCode || "";
    state.draft.bagId = matchedMaster?.bagId || landing.bagId;
    if (landing.usageId && viewModel.usagesById[landing.usageId]) {
      syncUsageSelection(landing.usageId);
    } else if (matchedMaster?.currentUsage) {
      syncUsageSelection(matchedMaster.currentUsage.usageId);
    } else {
      state.activeUsageId = null;
      state.draft.sewingTaskId = "";
      resetReturnDraft(null);
    }
    if (!detailPage) {
      const detailRoute = buildTransferBagDetailRoute({
        bagId: matchedMaster?.bagId || landing.bagId,
        bagCode: matchedMaster?.bagCode || landing.bagCode || void 0,
        usageId: landing.usageId || matchedMaster?.currentUsage?.usageId || void 0,
        usageNo: landing.usageNo || matchedMaster?.currentUsage?.usageNo || void 0
      });
      if (appStore.getState().pathname !== detailRoute) {
        appStore.navigate(detailRoute);
      }
    }
  } else {
    state.activeMasterId = null;
    state.activeUsageId = null;
    state.draft.bagId = "";
    state.draft.bagCodeInput = "";
    state.draft.sewingTaskId = "";
    resetReturnDraft(null);
  }
  if (state.prefilter?.sewingTaskNo) {
    const matchedTask = viewModel.sewingTasks.find((item) => item.sewingTaskNo === state.prefilter?.sewingTaskNo);
    state.draft.sewingTaskId = matchedTask?.sewingTaskId ?? state.draft.sewingTaskId;
  }
  if (state.prefilter?.returnStatus && ["WAITING_RETURN", "RETURN_INSPECTING", "CLOSED", "EXCEPTION_CLOSED"].includes(state.prefilter.returnStatus)) {
    state.returnStatus = state.prefilter.returnStatus;
  }
  if (state.prefilter?.ticketId || state.prefilter?.ticketNo) {
    const matchedTicket = (state.prefilter.ticketId ? viewModel.ticketCandidatesById[state.prefilter.ticketId] : null) || (state.prefilter.ticketNo ? viewModel.ticketCandidatesByNo[state.prefilter.ticketNo] : null) || null;
    state.draft.ticketInput = matchedTicket?.ticketNo || state.prefilter.ticketNo || "";
  }
}
function resetReturnDraft(usageId) {
  const usage = usageId ? getViewModel().usagesById[usageId] ?? null : null;
  const latestReceipt = usage ? (getReturnViewModel().returnReceiptsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.returnAt.localeCompare(left.returnAt, "zh-CN"))[0] || null : null;
  const latestCondition = usage ? (getReturnViewModel().conditionRecordsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.inspectedAt.localeCompare(left.inspectedAt, "zh-CN"))[0] || null : null;
  if (!usage) {
    state.returnDraft = {
      returnWarehouseName: "",
      returnAt: "",
      returnedBy: "",
      receivedBy: "",
      returnedFinishedQty: "",
      returnedTicketCountSummary: "",
      discrepancyType: "NONE",
      discrepancyNote: "",
      note: ""
    };
    state.conditionDraft = {
      conditionStatus: "GOOD",
      cleanlinessStatus: "CLEAN",
      damageType: "",
      repairNeeded: false,
      reusableDecision: "REUSABLE",
      note: ""
    };
    return;
  }
  if (latestReceipt) {
    state.returnDraft = {
      returnWarehouseName: latestReceipt.returnWarehouseName,
      returnAt: latestReceipt.returnAt,
      returnedBy: latestReceipt.returnedBy,
      receivedBy: latestReceipt.receivedBy,
      returnedFinishedQty: String(latestReceipt.returnedFinishedQty),
      returnedTicketCountSummary: String(latestReceipt.returnedTicketCountSummary),
      discrepancyType: latestReceipt.discrepancyType,
      discrepancyNote: latestReceipt.discrepancyNote,
      note: latestReceipt.note
    };
  } else {
    const bindings = getViewModel().bindingsByUsageId[usage.usageId] || [];
    const draft = createReturnReceiptDraft({
      usage: getSourceUsage(usage.usageId) || usage,
      bindingsCount: bindings.length,
      cutOrderCount: uniqueStrings(bindings.map((item) => item.cutOrderNo)).length,
      nowText: nowText()
    });
    state.returnDraft = {
      returnWarehouseName: draft.returnWarehouseName,
      returnAt: draft.returnAt,
      returnedBy: draft.returnedBy,
      receivedBy: draft.receivedBy,
      returnedFinishedQty: String(draft.returnedFinishedQty),
      returnedTicketCountSummary: String(draft.returnedTicketCountSummary),
      discrepancyType: draft.discrepancyType,
      discrepancyNote: draft.discrepancyNote,
      note: draft.note
    };
  }
  if (latestCondition) {
    state.conditionDraft = {
      conditionStatus: latestCondition.conditionStatus,
      cleanlinessStatus: latestCondition.cleanlinessStatus,
      damageType: latestCondition.damageType,
      repairNeeded: latestCondition.repairNeeded,
      reusableDecision: latestCondition.reusableDecision,
      note: latestCondition.note
    };
  } else {
    state.conditionDraft = {
      conditionStatus: "GOOD",
      cleanlinessStatus: "CLEAN",
      damageType: "",
      repairNeeded: false,
      reusableDecision: "REUSABLE",
      note: ""
    };
  }
  syncReusableDecisionSuggestion();
}
function renderTag(label, className) {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`;
}
function getCurrentTransferBagPathname() {
  return appStore.getState().pathname.split("?")[0] || getCanonicalCuttingPath("transfer-bags");
}
function isTransferBagDetailPage() {
  return getCurrentTransferBagPathname() === getCanonicalCuttingPath("transfer-bag-detail");
}
function buildTransferBagDetailRoute(options) {
  return buildCuttingRouteWithContext("transferBags", {
    ...state.drillContext || {},
    sourcePageKey: state.drillContext?.sourcePageKey || "transfer-bags",
    bagId: options.bagId || void 0,
    bagCode: options.bagCode || void 0,
    usageId: options.usageId || void 0,
    usageNo: options.usageNo || void 0,
    autoOpenDetail: true,
    detailTab: options.detailTab || void 0,
    focusSection: options.focusSection || void 0
  });
}
function buildTransferBagListRoute() {
  if (!state.drillContext) return getCanonicalCuttingPath("transfer-bags");
  return buildCuttingRouteWithContext("transferBags", {
    ...state.drillContext,
    bagId: void 0,
    bagCode: void 0,
    usageId: void 0,
    usageNo: void 0,
    detailTab: void 0,
    focusSection: void 0
  });
}
function resolveSourceReturnAction() {
  const sourcePageKey = state.drillContext?.sourcePageKey;
  if (!sourcePageKey || sourcePageKey === "transfer-bags") return null;
  if (sourcePageKey === "cutting-summary") {
    const context = buildReturnToSummaryContext(state.drillContext);
    return context ? {
      label: "\u8FD4\u56DE\u88C1\u526A\u603B\u7ED3",
      href: buildCuttingRouteWithContext("summary", context)
    } : null;
  }
  const sourceTargetMap = {
    replenishment: "replenishment",
    "special-processes": "specialProcesses",
    "material-prep": "materialPrep",
    "marker-spreading": "markerSpreading",
    "fei-tickets": "feiTickets",
    "cut-orders": "cutOrders",
    "production-progress": "productionProgress",
    "cut-piece-warehouse": "cutPieceWarehouse",
    "fabric-warehouse": "fabricWarehouse",
    "marker-list": "markerPlanRefs",
    "cuttable-pool": "cuttablePool"
  };
  const target = sourceTargetMap[sourcePageKey];
  if (!target || !state.drillContext) return null;
  return {
    label: `\u8FD4\u56DE${getCuttingSourcePageLabel(sourcePageKey)}`,
    href: buildCuttingRouteWithContext(target, {
      ...state.drillContext,
      bagId: void 0,
      bagCode: void 0,
      usageId: void 0,
      usageNo: void 0,
      focusSection: void 0
    })
  };
}
function resolveFormalBagQrValue(item) {
  if (!item) return "";
  return item.qrValue || getSourceMaster(item.bagId)?.qrValue || "";
}
function resolveUsageBagQrValue(usage) {
  return usage.bagMaster?.qrValue || getViewModel().mastersById[usage.bagId]?.qrValue || getSourceMaster(usage.bagId)?.qrValue || "";
}
function isTransferBagDetailTab(value) {
  return value === "current" || value === "history" || value === "recovery" || value === "logs";
}
function readTransferBagDetailTab() {
  const detailTab = state.drillContext?.detailTab || getWarehouseSearchParams().get("detailTab");
  return isTransferBagDetailTab(detailTab) ? detailTab : "current";
}
function getDetailFocusedUsage(activeMaster) {
  if (state.activeUsageId) {
    const usage = getViewModel().usagesById[state.activeUsageId] ?? null;
    if (usage && (!activeMaster || usage.bagId === activeMaster.bagId)) return usage;
  }
  return activeMaster?.currentUsage || null;
}
function getDetailBagUsages(activeMaster) {
  if (!activeMaster) return [];
  return getViewModel().usages.filter((item) => item.bagId === activeMaster.bagId).sort((left, right) => right.usageNo.localeCompare(left.usageNo, "zh-CN"));
}
function getDetailReturnUsage(usageId) {
  if (!usageId) return null;
  return getReturnViewModel().waitingReturnUsages.find((item) => item.usageId === usageId) || null;
}
function getDetailBagRecoveryEntries(activeMaster) {
  return getDetailBagUsages(activeMaster).map((usage) => {
    const recovery = getDetailReturnUsage(usage.usageId);
    return {
      usage,
      latestReceipt: recovery?.latestReturnReceipt || null,
      latestCondition: recovery?.latestConditionRecord || null,
      latestClosure: recovery?.latestClosureResult || null,
      recovery
    };
  }).filter((item) => item.latestReceipt || item.latestCondition || item.latestClosure);
}
function formatConditionStatusLabel(status) {
  if (status === "GOOD") return "\u5B8C\u597D";
  if (status === "MINOR_DAMAGE") return "\u8F7B\u5FAE\u635F\u574F";
  if (status === "SEVERE_DAMAGE") return "\u4E25\u91CD\u635F\u574F";
  return "\u5F85\u8BC4\u4F30";
}
function formatCleanlinessStatusLabel(status) {
  if (status === "CLEAN") return "\u5E72\u51C0";
  if (status === "DIRTY") return "\u5F85\u6E05\u6D01";
  return "\u5F85\u8BC4\u4F30";
}
function formatReusableDecisionLabel(decision) {
  if (decision === "REUSABLE") return "\u53EF\u4EE5";
  if (decision === "WAITING_CLEANING") return "\u5F85\u6E05\u6D01\u540E\u518D\u7528";
  if (decision === "WAITING_REPAIR") return "\u5F85\u7EF4\u4FEE\u540E\u518D\u7528";
  if (decision === "DISABLED") return "\u4E0D\u80FD\u7EE7\u7EED\u4F7F\u7528";
  return "\u5F85\u8BC4\u4F30";
}
function formatRecoveryEntryNextStepLabel(entry) {
  if (entry.latestCondition?.reusableDecision) return formatReusableDecisionLabel(entry.latestCondition.reusableDecision);
  if (entry.latestClosure?.nextBagStatus) {
    return ["IDLE", "REUSABLE"].includes(entry.latestClosure.nextBagStatus) ? "\u53EF\u4EE5" : "\u4E0D\u80FD\u7EE7\u7EED\u4F7F\u7528";
  }
  return "\u5F85\u8BC4\u4F30";
}
function renderDetailMetric(label, value, valueClassName = "text-foreground") {
  return `
    <div class="rounded-lg border bg-muted/10 px-3 py-2">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="mt-1 text-sm font-semibold ${valueClassName}">${escapeHtml(value)}</div>
    </div>
  `;
}
function renderTransferBagTraceabilityBlock(focusedUsage) {
  if (!focusedUsage) return "";
  const sourceMarkerSummary = focusedUsage.sourceMarkerNos.join(" / ") || "\u5F53\u524D\u5C1A\u672A\u7ED1\u5B9A\u6B63\u5F0F\u6765\u6E90\u551B\u67B6";
  const sourceOrderSummary = focusedUsage.cutOrderNos.join(" / ") || "\u6682\u65E0";
  const sourceMarkerPlanSummary = focusedUsage.markerPlanNos.join(" / ") || "\u6682\u65E0";
  const isInboundTempUsage = focusedUsage.usageStage === "INBOUND_TEMP";
  return `
    <section class="rounded-lg border ${focusedUsage.bagFirstSatisfied ? "border-emerald-200 bg-emerald-50/30" : "border-rose-200 bg-rose-50/40"} p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 class="text-sm font-semibold text-foreground">${isInboundTempUsage ? "\u94FA\u5E03 / \u5165\u4ED3\u6682\u5B58\u8FFD\u6EAF" : "\u94FA\u5E03 / \u88C5\u888B\u8FFD\u6EAF"}</h3>
          <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(focusedUsage.bagFirstRuleLabel)}</p>
        </div>
        ${renderTag(isInboundTempUsage ? "\u5165\u4ED3\u6682\u5B58\u5DF2\u8BB0\u5F55" : focusedUsage.bagFirstSatisfied ? "\u4EA4\u51FA\u88C5\u888B\u5DF2\u8BB0\u5F55" : "\u4EA4\u51FA\u88C5\u888B\u5F85\u8865", focusedUsage.bagFirstSatisfied ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : "bg-rose-100 text-rose-700 border border-rose-200")}
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderDetailMetric("\u6765\u6E90\u94FA\u5E03", focusedUsage.spreadingSessionNo || focusedUsage.spreadingSessionId || "\u5F53\u524D\u5C1A\u672A\u7ED1\u5B9A\u6B63\u5F0F\u94FA\u5E03")}
        ${renderDetailMetric("\u6765\u6E90\u551B\u67B6", sourceMarkerSummary)}
        ${renderDetailMetric("\u6765\u6E90\u88C1\u7247\u5355", sourceOrderSummary)}
        ${renderDetailMetric("\u6765\u6E90\u551B\u67B6\u65B9\u6848", sourceMarkerPlanSummary)}
      </div>
      <details class="mt-3 rounded-lg border bg-background/70 p-3" data-testid="transfer-bags-traceability-fold" data-default-open="collapsed">
        <summary class="cursor-pointer text-sm font-medium text-foreground">\u8FFD\u6EAF\u4FE1\u606F</summary>
        <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          ${renderDetailMetric("\u5DE5\u5382\u7AEF\u56DE\u5199\u6D41\u6C34", focusedUsage.spreadingSourceWritebackId || "\u5F53\u524D\u5C1A\u65E0\u5DE5\u5382\u7AEF\u56DE\u5199\u6D41\u6C34")}
          ${renderDetailMetric("\u94FA\u5E03\u989C\u8272\u6458\u8981", focusedUsage.spreadingColorSummary || focusedUsage.colorSummary || "\u5F85\u8865")}
          ${renderDetailMetric(isInboundTempUsage ? "\u5165\u4ED3\u6682\u5B58\u89C4\u5219" : "\u4EA4\u51FA\u88C5\u888B\u89C4\u5219", focusedUsage.bagFirstRuleLabel, focusedUsage.bagFirstSatisfied ? "text-emerald-700" : "text-rose-700")}
        </div>
      </details>
    </section>
  `;
}
function getMasterTodoMeta(item) {
  if (item.visibleStatusKey === "IDLE") {
    return {
      label: "\u5F00\u59CB\u88C5\u888B",
      href: buildTransferBagDetailRoute({ bagId: item.bagId, bagCode: item.bagCode, focusSection: "usage-workbench" })
    };
  }
  if (item.visibleStatusKey === "IN_PROGRESS") {
    return {
      label: "\u7EE7\u7EED\u88C5\u888B",
      href: buildTransferBagDetailRoute({
        bagId: item.bagId,
        bagCode: item.bagCode,
        usageId: item.currentUsage?.usageId || void 0,
        usageNo: item.currentUsage?.usageNo || void 0,
        focusSection: "usage-workbench"
      })
    };
  }
  if (item.visibleStatusKey === "READY_HANDOVER") {
    return {
      label: "\u4EA4\u51FA",
      href: buildTransferBagDetailRoute({
        bagId: item.bagId,
        bagCode: item.bagCode,
        usageId: item.currentUsage?.usageId || void 0,
        usageNo: item.currentUsage?.usageNo || void 0,
        focusSection: "usage-workbench"
      })
    };
  }
  if (item.visibleStatusKey === "HANDED_OVER") {
    return {
      label: "\u56DE\u6536",
      href: buildTransferBagDetailRoute({
        bagId: item.bagId,
        bagCode: item.bagCode,
        usageId: item.currentUsage?.usageId || void 0,
        usageNo: item.currentUsage?.usageNo || void 0,
        focusSection: "return-workbench"
      })
    };
  }
  return {
    label: "\u67E5\u770B\u8BE6\u60C5",
    href: buildTransferBagDetailRoute({
      bagId: item.bagId,
      bagCode: item.bagCode,
      usageId: item.currentUsage?.usageId || void 0,
      usageNo: item.currentUsage?.usageNo || void 0
    })
  };
}
function renderHeaderActions() {
  const sourceReturnAction = resolveSourceReturnAction();
  const sourceReturnButton = sourceReturnAction ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(sourceReturnAction.href)}">${escapeHtml(sourceReturnAction.label)}</button>` : "";
  const fallbackWarehouseButton = sourceReturnAction ? "" : '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-cut-piece-warehouse-index">\u8FD4\u56DE\u88C1\u7247\u4ED3</button>';
  if (isTransferBagDetailPage()) {
    return `
      <div class="flex flex-wrap items-center gap-2">
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildTransferBagListRoute())}">\u8FD4\u56DE\u4E2D\u8F6C\u888B\u6D41\u8F6C</button>
        ${sourceReturnButton}
        ${hasSummaryReturnContext(state.drillContext) ? "" : '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-summary-index">\u67E5\u770B\u88C1\u526A\u603B\u7ED3</button>'}
      </div>
    `;
  }
  return `
    <div class="flex flex-wrap items-center gap-2">
      ${sourceReturnButton || fallbackWarehouseButton}
      <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-fei-tickets-index">\u53BB\u6253\u5370\u83F2\u7968</button>
      ${hasSummaryReturnContext(state.drillContext) ? "" : '<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="go-summary-index">\u67E5\u770B\u88C1\u526A\u603B\u7ED3</button>'}
    </div>
  `;
}
function renderStatsCards() {
  const cardsHtml = getTransferBagListStats().map(
    (item) => renderWorkbenchActionCard({
      title: item.label,
      count: item.count,
      hint: "",
      attrs: `data-transfer-bags-action="set-master-status" data-status="${item.filter}"`,
      active: state.masterStatus === item.filter,
      accentClass: item.accentClass
    })
  ).join("");
  return `
    <section class="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
      ${cardsHtml}
    </section>
  `;
}
function renderReturnStatsCards() {
  const summary = getReturnViewModel().summary;
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
      ${renderCompactKpiCard("\u5F85\u56DE\u4ED3\u4F7F\u7528\u5468\u671F\u6570", summary.waitingReturnUsageCount, "", "text-orange-600")}
      ${renderCompactKpiCard("\u56DE\u4ED3\u9A8C\u6536\u4E2D\u4F7F\u7528\u5468\u671F\u6570", summary.inspectingUsageCount, "", "text-cyan-600")}
      ${renderCompactKpiCard("\u5DF2\u5173\u95ED\u4F7F\u7528\u5468\u671F\u6570", summary.closedUsageCount, "", "text-emerald-600")}
      ${renderCompactKpiCard("\u53EF\u590D\u7528\u53E3\u888B\u6570", summary.reusableBagCount, "", "text-emerald-600")}
      ${renderCompactKpiCard("\u5F85\u6E05\u6D01\u53E3\u888B\u6570", summary.waitingCleaningBagCount, "", "text-sky-600")}
      ${renderCompactKpiCard("\u5F85\u7EF4\u4FEE\u53E3\u888B\u6570", summary.waitingRepairBagCount, "", "text-rose-600")}
    </section>
  `;
}
function renderPrefilterBar() {
  const chips = Array.from(
    new Set([
      ...buildCuttingDrillChipLabels(state.drillContext),
      state.prefilter?.sewingTaskNo ? `\u8F66\u7F1D\u4EFB\u52A1\uFF1A${state.prefilter.sewingTaskNo}` : "",
      state.prefilter?.returnStatus ? `\u56DE\u8D27\u72B6\u6001\uFF1A${state.prefilter.returnStatus}` : "",
      state.preselectedTicketRecordIds.length ? `\u9884\u9009\u83F2\u7968\uFF1A${state.preselectedTicketRecordIds.length} \u5F20` : ""
    ].filter(Boolean))
  );
  if (!chips.length) return "";
  return renderWorkbenchStateBar({
    summary: buildCuttingDrillSummary(state.drillContext) || "\u5F53\u524D\u6309\u5916\u90E8\u4E0A\u4E0B\u6587\u9884\u586B\u4E2D\u8F6C\u888B\u6D41\u8F6C\u5DE5\u4F5C\u533A",
    chips: chips.map((label) => renderWorkbenchFilterChip(label, 'data-transfer-bags-action="clear-prefill"', "amber")),
    clearAttrs: 'data-transfer-bags-action="clear-prefill"'
  });
}
function renderFeedbackBar() {
  if (!state.feedback) return "";
  const toneClass = state.feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return `
    <section class="rounded-lg border px-3 py-2 text-sm ${toneClass}">
      ${escapeHtml(state.feedback.message)}
    </section>
  `;
}
function renderLandingBanner() {
  if (!state.landingBanner) return "";
  return renderWorkbenchStateBar({
    summary: state.landingBanner.summary,
    chips: state.landingBanner.chips.map((label) => renderWorkbenchFilterChip(label, 'data-transfer-bags-action="clear-prefill"', "amber")),
    clearAttrs: 'data-transfer-bags-action="clear-prefill"'
  });
}
function renderDemoFixturePanel() {
  return "";
}
function renderCarrierManagementOverview() {
  const projection = getCarrierManagementProjection();
  return `
    <section class="rounded-lg border bg-card">
      <div class="border-b px-4 py-3">
        <h2 class="text-sm font-semibold text-foreground">\u4E2D\u8F6C\u888B\u8F7D\u5177\u7BA1\u7406</h2>
      </div>
      <div class="grid gap-3 p-4 md:grid-cols-3 xl:grid-cols-5">
        ${projection.overviewCards.map((card) => renderCompactKpiCard(card.label, card.value, card.hint, card.label === "\u5F02\u5E38\u8BB0\u5F55" ? "text-rose-600" : "text-blue-600")).join("")}
      </div>
      <div class="grid gap-3 border-t p-4 md:grid-cols-2 xl:grid-cols-5">
        ${[
    ["\u4E2D\u8F6C\u888B\u6863\u6848", "\u888B\u7801\u3001\u89C4\u683C\u3001\u5F53\u524D\u4F4D\u7F6E\u3001\u5F53\u524D\u72B6\u6001"],
    ["\u5165\u4ED3\u6682\u5B58\u4F7F\u7528", "\u5141\u8BB8\u6DF7\u88C5\uFF0C\u4E0D\u7ED1\u5B9A\u8F66\u7F1D\u4EFB\u52A1"],
    ["\u4EA4\u51FA\u88C5\u888B\u4F7F\u7528", "\u4E00\u4E2A\u888B\u53EA\u5BF9\u5E94\u4E00\u4E2A\u8F66\u7F1D\u4EFB\u52A1\u6216\u63A5\u6536\u5BF9\u8C61"],
    ["\u7B7E\u6536\u4E0E\u56DE\u6536", "\u7B7E\u6536\u3001\u8FD4\u4ED3\u3001\u5173\u95ED\u3001\u590D\u7528\u5468\u671F"],
    ["\u5F02\u5E38\u8BB0\u5F55", "\u7834\u635F\u3001\u4E22\u5931\u3001\u9519\u626B\u3001\u6570\u91CF\u5DEE\u5F02"]
  ].map(
    ([title, desc]) => `
              <article class="rounded-lg border bg-muted/10 p-3">
                <div class="text-sm font-semibold text-foreground">${escapeHtml(title)}</div>
                <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(desc)}</div>
              </article>
            `
  ).join("")}
      </div>
    </section>
  `;
}
function renderInboundTempUseSection() {
  const projection = getCarrierManagementProjection();
  const items = projection.inboundTempUses.slice(0, 6);
  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">\u5165\u4ED3\u6682\u5B58\u4F7F\u7528</h2>
        </div>
        <div class="text-xs text-muted-foreground">\u5141\u8BB8\u6DF7\u88C5\uFF0C\u4E0D\u7ED1\u5B9A\u8F66\u7F1D\u4EFB\u52A1</div>
      </div>
      ${items.length ? `<div class="grid gap-3 p-4 xl:grid-cols-2">
            ${items.map(
    (item) => `
                  <article class="rounded-lg border bg-muted/10 p-3 text-sm">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div class="font-semibold text-blue-700">${escapeHtml(item.bagCode)}</div>
                        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.bagUseId)}</div>
                      </div>
                      ${renderTag(item.mixedFlag ? "\u6DF7\u88C5" : "\u5355\u4E00\u6765\u6E90", item.mixedFlag ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-slate-100 text-slate-700 border border-slate-200")}
                    </div>
                    <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>\u83F2\u7968\uFF1A<span class="font-medium text-foreground">${escapeHtml(String(item.containedFeiTickets.length))} \u5F20</span></div>
                      <div>\u88C1\u7247\uFF1A<span class="font-medium text-foreground">${escapeHtml(String(item.containedPieceQty))} \u7247</span></div>
                      <div class="sm:col-span-2">\u6DF7\u88C5\u6982\u51B5\uFF1A<span class="font-medium text-foreground">${escapeHtml(item.mixedSummary)}</span></div>
                      <div class="sm:col-span-2">\u7ED1\u5B9A\u5BF9\u8C61\uFF1A<span class="font-medium text-foreground">\u672A\u7ED1\u5B9A\u8F66\u7F1D\u4EFB\u52A1\uFF0C\u5F85\u540E\u7EED\u5206\u914D</span></div>
                    </div>
                  </article>
                `
  ).join("")}
          </div>` : '<div class="px-6 py-10 text-center text-sm text-muted-foreground">\u6682\u65E0\u5165\u4ED3\u6682\u5B58\u4F7F\u7528\u8BB0\u5F55</div>'}
    </section>
  `;
}
function renderHandoverPackingUseSection() {
  const projection = getCarrierManagementProjection();
  const items = projection.handoverPackingUses.slice(0, 6);
  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">\u4EA4\u51FA\u88C5\u888B\u4F7F\u7528</h2>
        </div>
        <div class="text-xs text-muted-foreground">\u4E00\u4E2A\u4E2D\u8F6C\u888B\u5728\u672C\u4F7F\u7528\u5468\u671F\u5185\u53EA\u7ED1\u5B9A\u4E00\u4E2A\u8F66\u7F1D\u4EFB\u52A1</div>
      </div>
      ${projection.taskBagGroups.length ? `<div class="grid gap-3 border-b p-4 md:grid-cols-2">
            ${projection.taskBagGroups.slice(0, 2).map(
    (group) => `
                  <article class="rounded-lg border bg-emerald-50/40 p-3 text-sm">
                    <div class="font-medium text-foreground">${escapeHtml(group.sewingTaskNo)}</div>
                    <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(formatFactoryDisplayName(group.receiverFactoryName))}</div>
                    <div class="mt-2 text-xs text-emerald-700">\u4E00\u4E2A\u8F66\u7F1D\u4EFB\u52A1\u53EF\u5BF9\u5E94\u591A\u4E2A\u4E2D\u8F6C\u888B\uFF1A${escapeHtml(group.bagCodes.join(" / "))}</div>
                  </article>
                `
  ).join("")}
          </div>` : ""}
      ${items.length ? `<div class="grid gap-3 p-4 xl:grid-cols-2">
            ${items.map(
    (item) => `
                  <article class="rounded-lg border bg-muted/10 p-3 text-sm">
                    <div class="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div class="font-semibold text-blue-700">${escapeHtml(item.bagCode)}</div>
                        <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.bagUseId)}</div>
                      </div>
                      ${renderTag(item.currentStatus, "bg-emerald-100 text-emerald-700 border border-emerald-200")}
                    </div>
                    <div class="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                      <div>\u8F66\u7F1D\u4EFB\u52A1\uFF1A<span class="font-medium text-foreground">${escapeHtml(item.targetObjectNo || "\u5F85\u7ED1\u5B9A")}</span></div>
                      <div>\u63A5\u6536\u5BF9\u8C61\uFF1A<span class="font-medium text-foreground">${escapeHtml(formatFactoryDisplayName(item.receiverFactoryName))}</span></div>
                      <div>\u83F2\u7968\uFF1A<span class="font-medium text-foreground">${escapeHtml(String(item.containedFeiTickets.length))} \u5F20</span></div>
                      <div>\u88C1\u7247\uFF1A<span class="font-medium text-foreground">${escapeHtml(String(item.containedPieceQty))} \u7247</span></div>
                    </div>
                  </article>
                `
  ).join("")}
          </div>` : '<div class="px-6 py-10 text-center text-sm text-muted-foreground">\u6682\u65E0\u4EA4\u51FA\u88C5\u888B\u4F7F\u7528\u8BB0\u5F55</div>'}
    </section>
  `;
}
function renderSignAndReturnUseSection() {
  const projection = getCarrierManagementProjection();
  const items = projection.signedAndReturnUses.slice(0, 6);
  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-sm font-semibold text-foreground">\u7B7E\u6536\u4E0E\u56DE\u6536</h2>
        <div class="text-xs text-muted-foreground">\u7B7E\u6536\u3001\u8FD4\u4ED3\u3001\u5173\u95ED\u3001\u518D\u6B21\u590D\u7528</div>
      </div>
      ${items.length ? `<div class="divide-y">
            ${items.map(
    (item) => `
                  <article class="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1fr,1fr,1fr,auto] md:items-center">
                    <div>
                      <div class="font-medium text-blue-700">${escapeHtml(item.bagCode)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.bagUseId)}</div>
                    </div>
                    <div class="text-xs text-muted-foreground">\u7B7E\u6536\uFF1A<span class="font-medium text-foreground">${escapeHtml(item.signedAt || "\u5F85\u7B7E\u6536")}</span></div>
                    <div class="text-xs text-muted-foreground">\u56DE\u6536\uFF1A<span class="font-medium text-foreground">${escapeHtml(item.returnedAt || "\u5F85\u56DE\u6536")}</span></div>
                    ${renderTag(item.currentStatus, "bg-cyan-100 text-cyan-700 border border-cyan-200")}
                  </article>
                `
  ).join("")}
          </div>` : '<div class="px-6 py-10 text-center text-sm text-muted-foreground">\u6682\u65E0\u7B7E\u6536\u4E0E\u56DE\u6536\u8BB0\u5F55</div>'}
    </section>
  `;
}
function renderCarrierAbnormalSection() {
  const projection = getCarrierManagementProjection();
  const items = projection.abnormalRecords.slice(0, 8);
  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <h2 class="text-sm font-semibold text-foreground">\u5F02\u5E38\u8BB0\u5F55</h2>
        <div class="text-xs text-muted-foreground">\u7834\u635F\u3001\u4E22\u5931\u3001\u9519\u626B\u3001\u6570\u91CF\u5DEE\u5F02\u3001\u672A\u6309\u65F6\u56DE\u6536</div>
      </div>
      ${items.length ? `<div class="divide-y">
            ${items.map(
    (item) => `
                  <article class="grid gap-3 px-4 py-3 text-sm md:grid-cols-[0.8fr,1fr,1.4fr,0.8fr] md:items-center">
                    <div>
                      <div class="font-medium text-foreground">${escapeHtml(item.bagCode)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.relatedObjectId || item.relatedUseId)}</div>
                    </div>
                    <div>${renderTag(item.abnormalType, "bg-rose-100 text-rose-700 border border-rose-200")}</div>
                    <div class="text-xs text-muted-foreground">${escapeHtml(item.description)}</div>
                    <div class="text-xs text-muted-foreground">${escapeHtml(item.handlingStatus)}</div>
                  </article>
                `
  ).join("")}
          </div>` : '<div class="px-6 py-10 text-center text-sm text-muted-foreground">\u6682\u65E0\u5F02\u5E38\u8BB0\u5F55</div>'}
    </section>
  `;
}
function renderTransferBagStageLedgerPanel() {
  const viewModel = getViewModel();
  const stageItems = viewModel.stageLedgerItems;
  if (!stageItems.length) return "";
  const stageSummary = viewModel.stageSummary;
  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">\u4E2D\u8F6C\u888B\u4E1A\u52A1\u9636\u6BB5</h2>
        </div>
        <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-nav="${escapeHtml(getCanonicalCuttingPath("sewing-dispatch"))}">\u67E5\u770B\u4EA4\u51FA\u5355</button>
      </div>
      <div class="grid gap-3 border-b p-4 md:grid-cols-4">
        ${renderCompactKpiCard("\u5165\u4ED3\u6682\u5B58", stageSummary.inboundTempCount, "\u5141\u8BB8\u6DF7\u88C5", "text-blue-600")}
        ${renderCompactKpiCard("\u4EA4\u51FA\u88C5\u888B", stageSummary.handoverPackingCount, "\u7ED1\u5B9A\u4EA4\u51FA\u5173\u7CFB", "text-emerald-600")}
        ${renderCompactKpiCard("\u5DF2\u7ED1\u5B9A\u4EA4\u51FA\u5173\u7CFB", stageSummary.handoverRelationOkCount, "\u4EA4\u51FA\u5355\u6216\u4EA4\u51FA\u8BB0\u5F55", "text-emerald-600")}
        ${renderCompactKpiCard("\u5173\u7CFB\u5F85\u8865", stageSummary.handoverRelationMissingCount, "\u4EA4\u51FA\u88C5\u888B\u9636\u6BB5", "text-amber-600")}
      </div>
      ${renderStickyTableScroller(`
        <table class="min-w-[1080px] w-full text-sm">
          <thead class="bg-muted/60 text-xs text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left">\u9636\u6BB5</th>
              <th class="px-4 py-3 text-left">\u4E2D\u8F6C\u888B</th>
              <th class="px-4 py-3 text-left">\u4E1A\u52A1\u5173\u7CFB</th>
              <th class="px-4 py-3 text-left">\u751F\u4EA7\u5355</th>
              <th class="px-4 py-3 text-left">\u88C1\u7247\u5355</th>
              <th class="px-4 py-3 text-left">\u83F2\u7968</th>
              <th class="px-4 py-3 text-left">\u72B6\u6001</th>
              <th class="px-4 py-3 text-left">\u89C4\u5219</th>
            </tr>
          </thead>
          <tbody>
            ${stageItems.map(
    (item) => `
                  <tr class="border-t">
                    <td class="px-4 py-3">${renderTag(item.stageLabel, item.stage === "INBOUND_TEMP" ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-emerald-100 text-emerald-700 border border-emerald-200")}</td>
                    <td class="px-4 py-3">
                      <div class="font-medium text-blue-700">${escapeHtml(item.carrierCode)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.cycleNo || "\u6682\u65E0\u5468\u671F")}</div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="${item.relationOk ? "text-foreground" : "text-amber-700"}">${escapeHtml(item.relationLabel)}</div>
                      ${item.stage === "HANDOVER_PACKING" ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.dispatchBatchNo || "\u4EA4\u51FA\u8BB0\u5F55\u5F85\u65B0\u589E")}</div>` : ""}
                    </td>
                    <td class="px-4 py-3">${escapeHtml(item.productionOrderNos.join(" / ") || "\u6682\u65E0")}</td>
                    <td class="px-4 py-3">${escapeHtml(item.cutOrderNos.join(" / ") || "\u6682\u65E0")}</td>
                    <td class="px-4 py-3">${escapeHtml(`${item.ticketCount} \u5F20`)}</td>
                    <td class="px-4 py-3">${escapeHtml(item.statusLabel)}</td>
                    <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.ruleLabel)}</td>
                  </tr>
                `
  ).join("")}
          </tbody>
        </table>
      `)}
    </section>
  `;
}
function renderSortingTaskStatusTag(status) {
  const className = status === "\u5F85\u5206\u62E3" ? "bg-amber-100 text-amber-700 border border-amber-200" : status === "\u5206\u62E3\u4E2D" ? "bg-blue-100 text-blue-700 border border-blue-200" : status === "\u5DF2\u88C5\u888B" ? "bg-emerald-100 text-emerald-700 border border-emerald-200" : status === "\u5DF2\u4EA4\u51FA" || status === "\u5DF2\u56DE\u5199" ? "bg-slate-900 text-white border border-slate-900" : "bg-rose-100 text-rose-700 border border-rose-200";
  return renderTag(status, className);
}
function renderCutPieceSortingTaskPanel() {
  return "";
}
function renderMasterSection() {
  const { filteredItems, pageSlice } = getPagedMasters();
  const items = pageSlice.items;
  const carrierRecordsByBagCode = Object.fromEntries(getCarrierManagementProjection().masterRecords.map((item) => [item.bagCode, item]));
  return `
    <div class="space-y-3">
      ${renderStickyFilterShell(`
        <div class="space-y-3">
          <div>
            <h2 class="text-sm font-semibold text-foreground">\u7B5B\u9009\u6761\u4EF6</h2>
          </div>
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label class="space-y-2 xl:col-span-3">
              <span class="text-sm font-medium text-foreground">\u5173\u952E\u8BCD</span>
              <input
                type="text"
                value="${escapeHtml(state.masterKeyword)}"
                placeholder="\u652F\u6301\u888B\u7801 / \u89C4\u683C / \u5F53\u524D\u4F4D\u7F6E / \u4F7F\u7528\u9636\u6BB5 / \u6700\u8FD1\u4F7F\u7528\u5468\u671F"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-transfer-bags-master-field="keyword"
              />
            </label>
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">\u72B6\u6001\u7B5B\u9009</span>
              <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-master-field="status">
                <option value="ALL" ${state.masterStatus === "ALL" ? "selected" : ""}>\u5168\u90E8</option>
                <option value="IDLE" ${state.masterStatus === "IDLE" ? "selected" : ""}>\u53EF\u7528</option>
                <option value="IN_PROGRESS" ${state.masterStatus === "IN_PROGRESS" ? "selected" : ""}>\u4F7F\u7528\u4E2D</option>
                <option value="READY_HANDOVER" ${state.masterStatus === "READY_HANDOVER" ? "selected" : ""}>\u4EA4\u51FA\u88C5\u888B\u4E2D</option>
                <option value="HANDED_OVER" ${state.masterStatus === "HANDED_OVER" ? "selected" : ""}>\u7B7E\u6536\u56DE\u6536\u4E2D</option>
              </select>
            </label>
          </div>
        </div>
      `)}
      <section class="rounded-lg border bg-card">
        <div class="flex items-center justify-between border-b px-4 py-3">
          <div>
            <h2 class="text-sm font-semibold text-foreground">\u4E2D\u8F6C\u888B\u6863\u6848</h2>
          </div>
          <div class="text-xs text-muted-foreground">\u5171 ${filteredItems.length} \u6761\u4E2D\u8F6C\u888B</div>
        </div>
        ${!items.length ? '<div class="px-6 py-10 text-center text-sm text-muted-foreground">\u6682\u65E0\u5339\u914D\u7ED3\u679C</div>' : `${renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">\u4E2D\u8F6C\u888B</th>
                  <th class="px-4 py-3 text-left">\u5F53\u524D\u4F7F\u7528</th>
                  <th class="px-4 py-3 text-left">\u6700\u8FD1\u8BB0\u5F55</th>
                  <th class="px-4 py-3 text-left">\u5F02\u5E38</th>
                  <th class="px-4 py-3 text-left">\u64CD\u4F5C</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(
    (item) => {
      const detailHref = buildTransferBagDetailRoute({
        bagId: item.bagId,
        bagCode: item.bagCode,
        usageId: item.currentUsage?.usageId || void 0,
        usageNo: item.currentUsage?.usageNo || void 0
      });
      const carrierRecord = carrierRecordsByBagCode[item.bagCode];
      return `
                      <tr class="border-b ${state.activeMasterId === item.bagId ? "bg-blue-50/60" : "bg-card"}">
                        <td class="px-4 py-3">
                          <button type="button" class="font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(detailHref)}">${escapeHtml(item.bagCode)}</button>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(carrierRecord?.bagSpec || `${item.bagType} / \u5BB9\u91CF ${item.capacity} \u5F20`)}</div>
                          <div class="mt-2">${renderTag(carrierRecord?.currentStatus || item.visibleStatusMeta.label, item.visibleStatusMeta.className)}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(carrierRecord?.currentUseStage || "\u65E0")}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(carrierRecord?.currentLocation || item.currentLocation || "\u5F85\u547D\u4F4D")}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(carrierRecord?.currentBoundObjectNo || "\u672A\u7ED1\u5B9A\u4E1A\u52A1\u5BF9\u8C61")}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(carrierRecord?.lastUsedAt || item.currentUsage?.startedAt || "\u6682\u65E0\u4F7F\u7528\u8BB0\u5F55")}</div>
                          <div class="mt-1 text-xs text-muted-foreground">\u7B7E\u6536\uFF1A${escapeHtml(carrierRecord?.lastSignedAt || "\u5F85\u7B7E\u6536")}</div>
                          <div class="mt-1 text-xs text-muted-foreground">\u56DE\u6536\uFF1A${escapeHtml(carrierRecord?.lastReturnedAt || "\u5F85\u56DE\u6536")}</div>
                          <div class="mt-1 text-xs text-muted-foreground">\u7D2F\u8BA1\u4F7F\u7528\uFF1A${escapeHtml(String(carrierRecord?.totalUseCount || 0))} \u6B21</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium ${carrierRecord?.abnormalCount ? "text-rose-700" : "text-muted-foreground"}">${escapeHtml(String(carrierRecord?.abnormalCount || 0))} \u6761</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.note || "\u65E0\u5F02\u5E38\u5907\u6CE8")}</div>
                        </td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">\u67E5\u770B\u6863\u6848</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-nav="${escapeHtml(detailHref)}">\u67E5\u770B\u4F7F\u7528\u5468\u671F</button>
                          </div>
                        </td>
                      </tr>
                    `;
    }
  ).join("")}
              </tbody>
            </table>
          `)}
          ${renderWorkbenchPagination({
    page: pageSlice.page,
    pageSize: pageSlice.pageSize,
    total: filteredItems.length,
    actionAttr: "data-transfer-bags-action",
    pageAction: "set-master-page",
    pageSizeAttr: "data-transfer-bags-master-page-size",
    pageSizeOptions: [10, 20, 50]
  })}`}
      </section>
    </div>
  `;
}
function renderMasterDetail(item) {
  if (!item) return "";
  const currentUsage = item.currentUsage;
  const currentBindings = currentUsage?.bindingItems || [];
  const qrValue = resolveFormalBagQrValue(item);
  const historyUsages = getViewModel().usages.filter((usage) => usage.bagId === item.bagId).sort((left, right) => right.usageNo.localeCompare(left.usageNo, "zh-CN"));
  return renderWorkbenchSecondaryPanel({
    title: `\u4E2D\u8F6C\u888B\u8BE6\u60C5\uFF1A${item.bagCode}`,
    hint: "",
    defaultOpen: true,
    body: `
      <div class="grid gap-3 xl:grid-cols-[0.88fr,1.12fr]">
        <div class="space-y-3">
          <div class="space-y-3 rounded-lg border bg-muted/15 p-3 text-sm">
            <div><span class="text-muted-foreground">\u4E2D\u8F6C\u888B\u7801\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(item.bagCode)}</span></div>
            <div><span class="text-muted-foreground">\u53E3\u888B\u72B6\u6001\uFF1A</span>${renderTag(item.pocketStatusMeta.label, item.pocketStatusMeta.className)}</div>
            <div><span class="text-muted-foreground">\u5F53\u524D\u4F7F\u7528\u5468\u671F\u53F7\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.usageNo || "\u6682\u65E0")}</span></div>
            <div><span class="text-muted-foreground">\u5F00\u59CB\u65F6\u95F4\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.startedAt || "\u5F85\u5F00\u59CB")}</span></div>
            <div><span class="text-muted-foreground">\u53D1\u51FA\u65F6\u95F4\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(item.currentDispatchedAt || "\u5F85\u53D1\u51FA")}</span></div>
            <div><span class="text-muted-foreground">\u7B7E\u6536\u65F6\u95F4\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(item.currentSignedAt || "\u5F85\u7B7E\u6536")}</span></div>
            <div><span class="text-muted-foreground">\u56DE\u4ED3\u65F6\u95F4\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(item.currentReturnedAt || "\u5F85\u56DE\u4ED3")}</span></div>
            <div><span class="text-muted-foreground">\u5F53\u524D\u4F4D\u7F6E\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(item.currentLocation || "\u5F85\u547D\u4F4D")}</span></div>
          </div>
          <div class="space-y-3 rounded-lg border bg-muted/15 p-3 text-sm">
            <div><span class="text-muted-foreground">\u5BB9\u91CF / \u5F53\u524D\u7ED1\u5B9A\u6570\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(`${item.capacity} \u5F20 / ${item.packedTicketCount} \u5F20\u83F2\u7968`)}</span></div>
            <div><span class="text-muted-foreground">\u5F53\u524D\u888B\u5185\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(String(item.currentTotalPieceCount))}</span></div>
            <div><span class="text-muted-foreground">\u5F53\u524D\u6B3E\u53F7\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(item.currentStyleCode || "\u5F85\u9501\u5B9A")}</span></div>
            <div><span class="text-muted-foreground">\u6765\u6E90\u94FA\u5E03\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.spreadingSessionNo || currentUsage?.spreadingSessionId || "\u6682\u65E0")}</span></div>
            <div><span class="text-muted-foreground">\u6765\u6E90\u551B\u67B6\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.sourceMarkerNos.join(" / ") || "\u6682\u65E0")}</span></div>
            <div><span class="text-muted-foreground">\u6765\u6E90\u751F\u4EA7\u5355\u96C6\u5408\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.productionOrderNos.join(" / ") || "\u6682\u65E0")}</span></div>
            <div><span class="text-muted-foreground">\u6765\u6E90\u88C1\u7247\u5355\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.cutOrderNos.join(" / ") || "\u6682\u65E0")}</span></div>
            <div><span class="text-muted-foreground">\u6765\u6E90\u551B\u67B6\u65B9\u6848\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.markerPlanNos.join(" / ") || "\u6682\u65E0")}</span></div>
          </div>
          <div class="rounded-lg border bg-card p-4">
            <div class="text-sm font-semibold text-foreground">\u6B63\u5F0F\u4E8C\u7EF4\u7801</div>
            ${qrValue ? `
                  <div class="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                    <div class="inline-flex w-fit rounded-xl border bg-white p-3 shadow-sm">
                      ${renderRealQrPlaceholder({
      value: qrValue,
      size: 168,
      title: `\u4E2D\u8F6C\u888B\u7801 ${item.bagCode}`,
      label: `\u4E2D\u8F6C\u888B ${item.bagCode} \u6B63\u5F0F\u4E8C\u7EF4\u7801`
    })}
                    </div>
                    <div class="space-y-2 text-sm">
                      <div><span class="text-muted-foreground">\u4E2D\u8F6C\u888B\u7801\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(item.bagCode)}</span></div>
                      <div><span class="text-muted-foreground">\u5F53\u524D\u4F7F\u7528\u5468\u671F\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(currentUsage?.usageNo || "\u6682\u65E0")}</span></div>
                      <div><span class="text-muted-foreground">\u4E8C\u7EF4\u7801\uFF1A</span><span class="font-medium text-foreground">\u5DF2\u751F\u6210</span></div>
                    </div>
                  </div>
                ` : '<div class="mt-3 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">\u6682\u65E0\u4E8C\u7EF4\u7801</div>'}
          </div>
          <div class="flex flex-wrap gap-2">
            ${item.pocketStatusKey === "IDLE" ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="use-master" data-bag-id="${escapeHtml(item.bagId)}">\u5F00\u59CB\u88C5\u888B</button>` : ""}
            ${item.pocketStatusKey === "PACKING" ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="use-master" data-bag-id="${escapeHtml(item.bagId)}">\u7EE7\u7EED\u88C5\u888B</button>` : ""}
            ${item.pocketStatusKey === "READY_TO_DISPATCH" && currentUsage ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(currentUsage.usageId)}">\u6253\u5370\u4E2D\u8F6C\u888B\u4E8C\u7EF4\u7801</button><button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(currentUsage.usageId)}">\u53D1\u51FA</button>` : ""}
            ${item.pocketStatusKey === "DISPATCHED" && currentUsage ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="mark-signed" data-usage-id="${escapeHtml(currentUsage.usageId)}">\u7B7E\u6536</button>` : ""}
            ${item.pocketStatusKey === "SIGNED" && currentUsage ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(currentUsage.usageId)}">\u56DE\u4ED3</button>` : ""}
            ${item.pocketStatusKey === "RETURNED" && currentUsage ? `<button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="close-usage-cycle" data-usage-id="${escapeHtml(currentUsage.usageId)}">\u5173\u95ED\u672C\u6B21\u4F7F\u7528\u5468\u671F</button>` : ""}
          </div>
        </div>
        <div class="space-y-3">
          <div class="rounded-lg border">
            <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground">\u888B\u5185\u83F2\u7968\u660E\u7EC6</div>
            ${currentBindings.length ? renderStickyTableScroller(`
                    <table class="min-w-full text-sm">
                      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th class="px-3 py-2 text-left">\u83F2\u7968\u7801</th>
                          <th class="px-3 py-2 text-left">\u6B3E\u53F7</th>
                          <th class="px-3 py-2 text-left">\u9762\u6599</th>
                          <th class="px-3 py-2 text-left">\u90E8\u4F4D</th>
                          <th class="px-3 py-2 text-right">\u83F2\u7968\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
                          <th class="px-3 py-2 text-left">\u6765\u6E90\u751F\u4EA7\u5355\u53F7</th>
                          <th class="px-3 py-2 text-left">\u6765\u6E90\u88C1\u7247\u5355\u53F7</th>
                          <th class="px-3 py-2 text-left">\u6240\u5C5E\u551B\u67B6\u65B9\u6848\u53F7</th>
                          <th class="px-3 py-2 text-left">\u83F2\u7968\u72B6\u6001</th>
                          <th class="px-3 py-2 text-left">\u662F\u5426\u5141\u8BB8\u79FB\u9664</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${currentBindings.map(
      (binding) => `
                              <tr class="border-b bg-card">
                                <td class="px-3 py-2 font-medium text-foreground">${escapeHtml(binding.ticketNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.styleCode || currentUsage?.styleCode || "\u5F85\u8865")}</td>
                                <td class="px-3 py-2">
                                  ${renderMaterialIdentityBlock({
        materialSku: binding.ticket?.materialSku || "\u5F85\u8865",
        materialLabel: binding.ticket?.materialSku || "\u5F85\u8865",
        materialAlias: binding.ticket?.materialAlias || "",
        materialImageUrl: binding.ticket?.materialImageUrl || ""
      }, { compact: true })}
                                  <div class="text-xs text-muted-foreground">${escapeHtml(binding.ticket ? `${binding.ticket.color || "\u5F85\u8865\u989C\u8272"} / ${binding.ticket.size || "\u5F85\u8865\u5C3A\u7801"}` : "\u5F85\u8865")}</div>
                                </td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.partName || "\u5F85\u8865\u90E8\u4F4D")}</td>
                                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(binding.qty))}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.productionOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.cutOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.markerPlanNo || binding.\u551B\u67B6\u65B9\u6848No || "\u2014")}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.ticketStatus === "VOIDED" ? "\u5DF2\u4F5C\u5E9F" : "\u6709\u6548")}</td>
                                <td class="px-3 py-2">
                                  ${binding.removable ? `<button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-transfer-bags-action="remove-binding" data-binding-id="${escapeHtml(binding.bindingId)}">\u53EF\u79FB\u9664</button>` : '<span class="text-xs text-muted-foreground">\u5F53\u524D\u9636\u6BB5\u4E0D\u53EF\u79FB\u9664</span>'}
                                </td>
                              </tr>
                            `
    ).join("")}
                      </tbody>
                    </table>
                  `, "max-h-[24vh]") : '<div class="px-3 py-8 text-center text-sm text-muted-foreground">\u5F53\u524D\u53E3\u888B\u6682\u65E0\u5DF2\u7ED1\u5B9A\u83F2\u7968\u3002</div>'}
          </div>
          <div class="rounded-lg border">
            <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground">\u5386\u53F2\u4F7F\u7528\u5468\u671F</div>
            ${historyUsages.length ? renderStickyTableScroller(`
                    <table class="min-w-full text-sm">
                      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th class="px-3 py-2 text-left">\u4F7F\u7528\u5468\u671F\u53F7</th>
                          <th class="px-3 py-2 text-left">\u72B6\u6001</th>
                          <th class="px-3 py-2 text-left">\u65F6\u95F4</th>
                          <th class="px-3 py-2 text-right">\u7ED1\u5B9A\u83F2\u7968\u6570\u91CF</th>
                          <th class="px-3 py-2 text-left">\u53D1\u51FA / \u7B7E\u6536 / \u56DE\u4ED3</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${historyUsages.map(
      (usage) => `
                              <tr class="border-b bg-card">
                                <td class="px-3 py-2">
                                  <button type="button" class="font-medium text-blue-700 hover:underline" data-nav="${escapeHtml(buildTransferBagDetailRoute({
        bagId: usage.bagId,
        bagCode: usage.bagCode,
        usageId: usage.usageId,
        usageNo: usage.usageNo
      }))}">${escapeHtml(usage.usageNo)}</button>
                                </td>
                                <td class="px-3 py-2">${renderTag(usage.pocketStatusMeta.label, usage.pocketStatusMeta.className)}</td>
                                <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(usage.startedAt || usage.dispatchAt || "\u5F85\u8865")}</td>
                                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(usage.summary.ticketCount))}</td>
                                <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml([usage.dispatchAt || "\u5F85\u53D1\u51FA", usage.signedAt || "\u5F85\u7B7E\u6536", usage.returnedAt || "\u5F85\u56DE\u4ED3"].join(" / "))}</td>
                              </tr>
                            `
    ).join("")}
                      </tbody>
                    </table>
                  `, "max-h-[20vh]") : '<div class="px-3 py-8 text-center text-sm text-muted-foreground">\u5F53\u524D\u8FD8\u6CA1\u6709\u5386\u53F2\u4F7F\u7528\u5468\u671F\u8BB0\u5F55\u3002</div>'}
          </div>
        </div>
      </div>
    `
  });
}
function renderWorkbenchSection() {
  const activeUsage = getActiveUsage();
  const selectedBag = getSelectedBag();
  const selectedTask = getSelectedSewingTask();
  const candidateTickets = getCandidateTickets();
  const currentBindings = activeUsage ? getViewModel().bindingsByUsageId[activeUsage.usageId] || [] : [];
  const currentSummary = activeUsage ? buildTransferBagParentChildSummary(currentBindings) : null;
  const capacityExceeded = Boolean(activeUsage && selectedBag && currentSummary && currentSummary.ticketCount > selectedBag.capacity);
  return `
    <section class="grid gap-3 xl:grid-cols-[1.1fr,0.9fr]">
      <article class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">\u5F53\u524D\u4F7F\u7528\u5468\u671F\u5DE5\u4F5C\u533A</h2>
        </div>
        <div class="grid gap-3 md:grid-cols-2">
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">\u6B65\u9AA4 1\uFF1A\u9009\u62E9\u53E3\u888B</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-workbench-field="bagId">
              <option value="">\u8BF7\u9009\u62E9\u53E3\u888B</option>
              ${getViewModel().masters.map(
    (item) => `<option value="${escapeHtml(item.bagId)}" ${state.draft.bagId === item.bagId ? "selected" : ""}>${escapeHtml(`${item.bagCode} / ${item.statusMeta.label}`)}</option>`
  ).join("")}
            </select>
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">\u6B65\u9AA4 1\uFF1A\u626B\u4E2D\u8F6C\u888B\u7801</span>
            <div class="flex gap-2">
              <input
                type="text"
                value="${escapeHtml(state.draft.bagCodeInput)}"
                placeholder="\u8F93\u5165\u6216\u626B\u63CF\u4E2D\u8F6C\u888B\u7801"
                class="h-10 flex-1 rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-transfer-bags-workbench-field="bagCodeInput"
              />
              <button type="button" class="rounded-md border px-3 text-xs hover:bg-muted" data-transfer-bags-action="match-bag-code">\u5339\u914D</button>
            </div>
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">\u7ED1\u5B9A\u8F66\u7F1D\u4EFB\u52A1</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-workbench-field="sewingTaskId">
              <option value="">\u8BF7\u9009\u62E9\u8F66\u7F1D\u4EFB\u52A1</option>
              ${getViewModel().sewingTasks.map(
    (item) => `<option value="${escapeHtml(item.sewingTaskId)}" ${state.draft.sewingTaskId === item.sewingTaskId ? "selected" : ""}>${escapeHtml(`${item.sewingTaskNo} / ${formatFactoryDisplayName(item.sewingFactoryName)} / ${item.styleCode || item.spuCode}`)}</option>`
  ).join("")}
            </select>
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">\u5907\u6CE8</span>
            <input
              type="text"
                value="${escapeHtml(state.draft.note)}"
                placeholder="\u586B\u5199\u672C\u6B21\u88C5\u888B\u5907\u6CE8"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-workbench-field="note"
            />
          </label>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="create-usage">\u5F00\u59CB\u88C5\u888B</button>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="clear-draft">\u6E05\u7A7A\u5DE5\u4F5C\u53F0</button>
          ${candidateTickets.length ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="import-prefill">\u5BFC\u5165\u5019\u9009\u83F2\u7968\uFF08${candidateTickets.length}\uFF09</button>` : ""}
        </div>
        ${renderCandidatePanel(candidateTickets)}
        <div class="grid gap-3 lg:grid-cols-[1fr,auto]">
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">\u6B65\u9AA4 2\uFF1A\u626B\u83F2\u7968\u7801</span>
            <input
              type="text"
              value="${escapeHtml(state.draft.ticketInput)}"
              placeholder="\u8F93\u5165\u6216\u626B\u63CF\u83F2\u7968\u7801"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-workbench-field="ticketInput"
            />
          </label>
          <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted lg:self-end" data-transfer-bags-action="bind-ticket">\u7ED1\u5B9A\u7236\u5B50\u7801</button>
        </div>
      </article>
      <article class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">\u5F53\u524D\u53E3\u888B\u4F7F\u7528\u5468\u671F\u6458\u8981</h2>
        </div>
        ${activeUsage ? `
            <div class="grid gap-3 md:grid-cols-2">
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">\u4F7F\u7528\u5468\u671F\u53F7\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.usageNo)}</span></div>
                <div><span class="text-muted-foreground">\u4E2D\u8F6C\u888B\u7801\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.bagCode)}</span></div>
                <div><span class="text-muted-foreground">\u5F53\u524D\u9501\u5B9A\u6B3E\u53F7\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.styleCode || "\u5F85\u9501\u5B9A")}</span></div>
                <div><span class="text-muted-foreground">\u8F66\u7F1D\u4EFB\u52A1\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.sewingTaskNo)}</span></div>
                <div><span class="text-muted-foreground">\u8F66\u7F1D\u5DE5\u5382\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(formatFactoryDisplayName(activeUsage.sewingFactoryName))}</span></div>
                <div><span class="text-muted-foreground">\u72B6\u6001\uFF1A</span>${renderTag(activeUsage.statusMeta.label, activeUsage.statusMeta.className)}</div>
              </div>
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">\u5DF2\u7ED1\u5B9A\u83F2\u7968\u6570\u91CF\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.ticketCount || 0))}</span></div>
                <div><span class="text-muted-foreground">\u5F53\u524D\u888B\u5185\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.quantityTotal || 0))}</span></div>
                <div><span class="text-muted-foreground">\u88C1\u7247\u5355\u6570\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.cutOrderCount || 0))}</span></div>
                <div><span class="text-muted-foreground">\u751F\u4EA7\u5355\u6570\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(String(currentSummary?.productionOrderCount || 0))}</span></div>
                <div><span class="text-muted-foreground">\u551B\u67B6\u65B9\u6848\u6C47\u603B\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.markerPlanNos.join(" / ") || "\u65E0")}</span></div>
                <div><span class="text-muted-foreground">\u5BB9\u91CF\u72B6\u6001\uFF1A</span><span class="font-medium ${capacityExceeded ? "text-amber-700" : "text-foreground"}">${capacityExceeded ? "\u5DF2\u8D85\u5BB9\u91CF" : "\u672A\u8D85\u5BB9\u91CF"}</span></div>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(activeUsage.usageId)}">\u6253\u5370\u4E2D\u8F6C\u888B\u4E8C\u7EF4\u7801</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-ready" data-usage-id="${escapeHtml(activeUsage.usageId)}">\u5B8C\u6210\u88C5\u888B</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(activeUsage.usageId)}">\u53D1\u51FA</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-signed" data-usage-id="${escapeHtml(activeUsage.usageId)}">\u7B7E\u6536</button>
            </div>
            <div class="rounded-lg border">
              <div class="border-b px-3 py-2 text-xs font-medium text-muted-foreground">\u888B\u5185\u83F2\u7968\u660E\u7EC6</div>
              ${currentBindings.length ? renderStickyTableScroller(`
                    <table class="min-w-full text-sm">
                      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th class="px-3 py-2 text-left">\u83F2\u7968\u7801</th>
                          <th class="px-3 py-2 text-left">\u9762\u6599\u5377\u53F7</th>
                          <th class="px-3 py-2 text-left">\u5E03\u6599\u989C\u8272</th>
                          <th class="px-3 py-2 text-left">\u5C3A\u7801</th>
                          <th class="px-3 py-2 text-left">\u90E8\u4F4D</th>
                          <th class="px-3 py-2 text-right">\u6570\u91CF</th>
                          <th class="px-3 py-2 text-left">\u624E\u53F7</th>
                          <th class="px-3 py-2 text-left">\u88C1\u7247\u5355</th>
                          <th class="px-3 py-2 text-left">\u751F\u4EA7\u5355</th>
                          <th class="px-3 py-2 text-left">\u551B\u67B6\u65B9\u6848</th>
                          <th class="px-3 py-2 text-left">\u83F2\u7968\u72B6\u6001</th>
                          <th class="px-3 py-2 text-left">\u64CD\u4F5C</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${currentBindings.map(
    (binding) => `
                              <tr class="border-b bg-card">
                                <td class="px-3 py-2">${escapeHtml(binding.ticketNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.fabricRollNo || binding.ticket?.fabricRollNo || "\u6682\u65E0\u6570\u636E")}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.fabricColor || binding.ticket?.fabricColor || "\u6682\u65E0\u6570\u636E")}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.size || binding.ticket?.size || "\u6682\u65E0\u6570\u636E")}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.partName || binding.ticket?.partName || "\u5F85\u8865\u90E8\u4F4D")}</td>
                                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(binding.qty))}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.bundleNo || binding.ticket?.bundleNo || "\u6682\u65E0\u6570\u636E")}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.cutOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.productionOrderNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.markerPlanNo || binding.\u551B\u67B6\u65B9\u6848No || "\u65E0")}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.ticketStatus === "VOIDED" ? "\u5DF2\u4F5C\u5E9F" : "\u6709\u6548")}</td>
                                <td class="px-3 py-2">
                                  ${binding.removable ? `<button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-transfer-bags-action="remove-binding" data-binding-id="${escapeHtml(binding.bindingId)}">\u79FB\u9664\u672A\u9501\u5B9A\u83F2\u7968</button>` : '<span class="text-xs text-muted-foreground">\u5F53\u524D\u9636\u6BB5\u4E0D\u53EF\u79FB\u9664</span>'}
                                </td>
                              </tr>
                            `
  ).join("")}
                      </tbody>
                    </table>
                  `, "max-h-[28vh]") : '<div class="px-3 py-8 text-center text-sm text-muted-foreground">\u5F53\u524D\u4F7F\u7528\u5468\u671F\u6682\u65E0\u5DF2\u7ED1\u5B9A\u83F2\u7968\u3002</div>'}
            </div>
          ` : '<div class="rounded-lg border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">\u5F53\u524D\u5C1A\u672A\u9009\u4E2D\u4F7F\u7528\u5468\u671F\u3002\u8BF7\u5148\u521B\u5EFA\u6216\u4ECE\u53D1\u51FA\u53F0\u8D26\u4E2D\u9009\u62E9\u4E00\u4E2A\u4F7F\u7528\u5468\u671F\u3002</div>'}
      </article>
    </section>
  `;
}
function renderCandidatePanel(candidates) {
  if (!candidates.length) return "";
  return renderWorkbenchSecondaryPanel({
    title: "\u5019\u9009\u83F2\u7968\u9884\u586B",
    hint: "",
    countText: `${candidates.length} \u5F20`,
    defaultOpen: true,
    body: `
      <div class="flex flex-wrap gap-2">
        ${candidates.map((item) => renderWorkbenchFilterChip(`${item.ticketNo} / ${item.cutOrderNo}`, 'data-transfer-bags-action="set-ticket-input" data-ticket-no="' + escapeHtml(item.ticketNo) + '"', "blue")).join("")}
      </div>
    `
  });
}
function renderUsageLedgerSection() {
  const usages = getFilteredUsages();
  const activeUsage = getActiveUsage();
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">\u53D1\u51FA\u4EA4\u63A5\u53F0\u8D26</h2>
        </div>
      </div>
      ${renderStickyFilterShell(`
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label class="space-y-2 xl:col-span-2">
            <span class="text-sm font-medium text-foreground">\u5173\u952E\u8BCD</span>
            <input
              type="text"
              value="${escapeHtml(state.usageKeyword)}"
              placeholder="\u652F\u6301\u4F7F\u7528\u5468\u671F\u53F7 / \u4E2D\u8F6C\u888B\u7801 / \u8F66\u7F1D\u4EFB\u52A1\u53F7 / \u88C1\u7247\u5355"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-usage-field="keyword"
            />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">\u4F7F\u7528\u5468\u671F\u72B6\u6001</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-usage-field="status">
              <option value="ALL" ${state.usageStatus === "ALL" ? "selected" : ""}>\u5168\u90E8</option>
              <option value="DRAFT" ${state.usageStatus === "DRAFT" ? "selected" : ""}>\u8349\u7A3F</option>
              <option value="PACKING" ${state.usageStatus === "PACKING" ? "selected" : ""}>\u88C5\u888B\u4E2D</option>
              <option value="READY_TO_DISPATCH" ${state.usageStatus === "READY_TO_DISPATCH" ? "selected" : ""}>\u5F85\u53D1\u51FA</option>
              <option value="DISPATCHED" ${state.usageStatus === "DISPATCHED" ? "selected" : ""}>\u5DF2\u53D1\u51FA</option>
              <option value="PENDING_SIGNOFF" ${state.usageStatus === "PENDING_SIGNOFF" ? "selected" : ""}>\u5F85\u7B7E\u6536</option>
              <option value="WAITING_RETURN" ${state.usageStatus === "WAITING_RETURN" ? "selected" : ""}>\u5F85\u56DE\u4ED3</option>
              <option value="RETURN_INSPECTING" ${state.usageStatus === "RETURN_INSPECTING" ? "selected" : ""}>\u56DE\u4ED3\u9A8C\u6536\u4E2D</option>
              <option value="CLOSED" ${state.usageStatus === "CLOSED" ? "selected" : ""}>\u5DF2\u5173\u95ED</option>
              <option value="EXCEPTION_CLOSED" ${state.usageStatus === "EXCEPTION_CLOSED" ? "selected" : ""}>\u5F02\u5E38\u5173\u95ED</option>
            </select>
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">\u8F66\u7F1D\u4EFB\u52A1</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-usage-field="sewingTask">
              <option value="ALL" ${state.usageSewingTaskId === "ALL" ? "selected" : ""}>\u5168\u90E8</option>
              ${getViewModel().sewingTasks.map(
    (item) => `<option value="${escapeHtml(item.sewingTaskId)}" ${state.usageSewingTaskId === item.sewingTaskId ? "selected" : ""}>${escapeHtml(item.sewingTaskNo)}</option>`
  ).join("")}
            </select>
          </label>
        </div>
      `)}
      ${!usages.length ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">\u6682\u65E0\u4F7F\u7528\u5468\u671F\u53F0\u8D26</div>' : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">\u4F7F\u7528\u5468\u671F\u53F7</th>
                  <th class="px-4 py-3 text-left">\u4E2D\u8F6C\u888B\u7801</th>
                  <th class="px-4 py-3 text-left">\u9636\u6BB5 / \u8F66\u7F1D\u4EFB\u52A1</th>
                  <th class="px-4 py-3 text-left">\u8F66\u7F1D\u5DE5\u5382</th>
                  <th class="px-4 py-3 text-right">\u83F2\u7968\u6570\u91CF</th>
                  <th class="px-4 py-3 text-right">\u88C1\u7247\u5355\u6570</th>
                  <th class="px-4 py-3 text-left">\u4F7F\u7528\u5468\u671F\u72B6\u6001</th>
                  <th class="px-4 py-3 text-left">\u53D1\u51FA\u65F6\u95F4</th>
                  <th class="px-4 py-3 text-left">\u64CD\u4F5C</th>
                </tr>
              </thead>
              <tbody>
                ${usages.map(
    (item) => `
                      <tr class="border-b ${state.activeUsageId === item.usageId ? "bg-blue-50/60" : "bg-card"}">
                        <td class="px-4 py-3">
                          <button type="button" class="font-medium text-blue-700 hover:underline" data-transfer-bags-action="select-usage" data-usage-id="${escapeHtml(item.usageId)}">${escapeHtml(item.usageNo)}</button>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.note || "\u65E0\u5907\u6CE8")}</div>
                        </td>
                        <td class="px-4 py-3">${escapeHtml(item.bagCode)}</td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-foreground">${escapeHtml(item.usageStageLabel || "\u4EA4\u51FA\u88C5\u888B")}</div>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.sewingTaskNo || (item.usageStage === "INBOUND_TEMP" ? "\u5F85\u5206\u914D" : "\u672A\u7ED1\u5B9A"))}</div>
                        </td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatFactoryDisplayName(item.sewingFactoryName))}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.summary.ticketCount))}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.summary.cutOrderCount))}</td>
                        <td class="px-4 py-3">${renderTag(item.statusMeta.label, item.statusMeta.className)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.dispatchAt || "\u5F85\u53D1\u51FA")}</td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="select-usage" data-usage-id="${escapeHtml(item.usageId)}">\u67E5\u770B\u8BE6\u60C5</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(item.usageId)}">\u6253\u5370\u4E8C\u7EF4\u7801</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(item.usageId)}">\u6807\u8BB0\u53D1\u51FA</button>
                          </div>
                        </td>
                      </tr>
                    `
  ).join("")}
              </tbody>
            </table>
          `)}
      ${renderUsageDetail(activeUsage)}
    </section>
  `;
}
function renderUsageDetail(item) {
  if (!item) return "";
  const auditTrail = (getViewModel().auditTrailByUsageId[item.usageId] || []).slice().sort((left, right) => right.actionAt.localeCompare(left.actionAt, "zh-CN"));
  return renderWorkbenchSecondaryPanel({
    title: `\u4F7F\u7528\u5468\u671F\u8BE6\u60C5\uFF1A${item.usageNo}`,
    hint: "",
    countText: `${item.summary.ticketCount} \u5F20\u7968 / ${item.summary.cutOrderCount} \u4E2A\u88C1\u7247\u5355`,
    defaultOpen: true,
    body: `
      <div class="grid gap-3 xl:grid-cols-[0.9fr,1.1fr]">
        <div class="space-y-3 rounded-lg border bg-muted/15 p-3 text-sm">
          <div><span class="text-muted-foreground">\u4E2D\u8F6C\u888B\u7801\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(item.bagCode)}</span></div>
          <div><span class="text-muted-foreground">\u8F66\u7F1D\u4EFB\u52A1\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(item.sewingTaskNo)}</span></div>
          <div><span class="text-muted-foreground">\u8F66\u7F1D\u5DE5\u5382\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(formatFactoryDisplayName(item.sewingFactoryName))}</span></div>
          <div><span class="text-muted-foreground">\u83F2\u7968\u6570\u91CF\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(String(item.summary.ticketCount))}</span></div>
          <div><span class="text-muted-foreground">\u751F\u4EA7\u5355\u6570\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(String(item.summary.productionOrderCount))}</span></div>
          <div><span class="text-muted-foreground">\u6700\u65B0\u6E05\u5355\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(item.latestManifest?.manifestId || "\u5C1A\u672A\u6253\u5370")}</span></div>
          <div class="flex flex-wrap gap-2">
            <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="go-cut-orders" data-usage-id="${escapeHtml(item.usageId)}">\u53BB\u6765\u6E90\u88C1\u7247\u5355</button>
            <button type="button" class="rounded-md border px-3 py-2 text-xs hover:bg-muted" data-transfer-bags-action="go-summary" data-usage-id="${escapeHtml(item.usageId)}">\u53BB\u88C1\u526A\u603B\u7ED3</button>
          </div>
        </div>
        <div class="space-y-3 rounded-lg border bg-muted/15 p-3">
          <div>
            <h3 class="text-sm font-semibold text-foreground">\u52A8\u4F5C\u5BA1\u8BA1</h3>
          </div>
          ${auditTrail.length ? `<div class="space-y-2">${auditTrail.map(
      (audit) => `
                    <article class="rounded-md border bg-card px-3 py-2 text-sm">
                      <div class="flex items-center justify-between gap-3">
                        <p class="font-medium text-foreground">${escapeHtml(audit.action)}</p>
                        <p class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(audit.actionAt))}</p>
                      </div>
                      <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(audit.actionBy)}</p>
                      <p class="mt-1 text-sm text-foreground">${escapeHtml(audit.note)}</p>
                    </article>
                  `
    ).join("")}</div>` : '<div class="rounded-md border border-dashed px-3 py-6 text-center text-sm text-muted-foreground">\u6682\u65E0\u5BA1\u8BA1\u8BB0\u5F55</div>'}
        </div>
      </div>
    `
  });
}
function renderReturnLedgerSection() {
  const items = getFilteredReturnUsages();
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
      <div>
        <h2 class="text-sm font-semibold text-foreground">\u5F85\u56DE\u4ED3\u4F7F\u7528\u5468\u671F\u5217\u8868</h2>
      </div>
      ${renderStickyFilterShell(`
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label class="space-y-2 xl:col-span-3">
            <span class="text-sm font-medium text-foreground">\u5173\u952E\u8BCD</span>
            <input
              type="text"
              value="${escapeHtml(state.returnKeyword)}"
              placeholder="\u652F\u6301\u4F7F\u7528\u5468\u671F\u53F7 / \u4E2D\u8F6C\u888B\u7801 / \u8F66\u7F1D\u4EFB\u52A1\u53F7 / \u88C1\u7247\u5355\u53F7"
              class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-return-field="keyword"
            />
          </label>
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">\u56DE\u8D27\u72B6\u6001</span>
            <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-field="status">
              <option value="ALL" ${state.returnStatus === "ALL" ? "selected" : ""}>\u5168\u90E8</option>
              <option value="WAITING_RETURN" ${state.returnStatus === "WAITING_RETURN" ? "selected" : ""}>\u5F85\u56DE\u4ED3</option>
              <option value="RETURN_INSPECTING" ${state.returnStatus === "RETURN_INSPECTING" ? "selected" : ""}>\u56DE\u4ED3\u9A8C\u6536\u4E2D</option>
              <option value="CLOSED" ${state.returnStatus === "CLOSED" ? "selected" : ""}>\u5DF2\u5173\u95ED</option>
              <option value="EXCEPTION_CLOSED" ${state.returnStatus === "EXCEPTION_CLOSED" ? "selected" : ""}>\u5F02\u5E38\u5173\u95ED</option>
            </select>
          </label>
        </div>
      `)}
      ${!items.length ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">\u6682\u65E0\u56DE\u8D27\u4F7F\u7528\u5468\u671F</div>' : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">\u4F7F\u7528\u5468\u671F\u53F7</th>
                  <th class="px-4 py-3 text-left">\u4E2D\u8F6C\u888B\u7801</th>
                  <th class="px-4 py-3 text-left">\u8F66\u7F1D\u4EFB\u52A1\u53F7</th>
                  <th class="px-4 py-3 text-left">\u8F66\u7F1D\u5DE5\u5382</th>
                  <th class="px-4 py-3 text-left">\u53D1\u51FA\u65F6\u95F4</th>
                  <th class="px-4 py-3 text-left">\u4F7F\u7528\u5468\u671F\u72B6\u6001</th>
                  <th class="px-4 py-3 text-left">\u53E3\u888B\u72B6\u6001</th>
                  <th class="px-4 py-3 text-left">\u64CD\u4F5C</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(
    (item) => `
                      <tr class="border-b ${state.activeUsageId === item.usageId ? "bg-orange-50/60" : "bg-card"}">
                        <td class="px-4 py-3">
                          <button type="button" class="font-medium text-blue-700 hover:underline" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(item.usageId)}">${escapeHtml(item.usageNo)}</button>
                          <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.latestReturnReceipt?.returnAt || "\u5C1A\u672A\u521B\u5EFA\u56DE\u8D27\u8349\u7A3F")}</div>
                        </td>
                        <td class="px-4 py-3">${escapeHtml(item.bagCode)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.sewingTaskNo)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatFactoryDisplayName(item.sewingFactoryName))}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.dispatchAt || "\u5F85\u53D1\u51FA")}</td>
                        <td class="px-4 py-3">${renderTag(item.statusMeta.label, item.statusMeta.className)}</td>
                        <td class="px-4 py-3">${item.bagStatusMeta ? renderTag(item.bagStatusMeta.label, item.bagStatusMeta.className) : '<span class="text-xs text-muted-foreground">\u5F85\u8865</span>'}</td>
                        <td class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(item.usageId)}">\u56DE\u8D27\u9A8C\u6536</button>
                            <button type="button" class="rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="select-usage" data-usage-id="${escapeHtml(item.usageId)}">\u67E5\u770B\u8BE6\u60C5</button>
                          </div>
                        </td>
                      </tr>
                    `
  ).join("")}
              </tbody>
            </table>
          `)}
    </section>
  `;
}
function renderReturnWorkbenchSection() {
  const activeUsage = state.activeUsageId ? getReturnViewModel().waitingReturnUsages.find((item) => item.usageId === state.activeUsageId) || null : null;
  const decisionMeta = deriveBagConditionDecision({
    conditionStatus: state.conditionDraft.conditionStatus,
    cleanlinessStatus: state.conditionDraft.cleanlinessStatus,
    damageType: state.conditionDraft.damageType,
    repairNeeded: state.conditionDraft.repairNeeded
  });
  const exceptionMeta = buildReturnExceptionMeta(state.returnDraft.discrepancyType);
  return `
    <section class="grid gap-3 xl:grid-cols-[1.15fr,0.85fr]">
      <article class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">\u56DE\u4ED3 / \u9A8C\u6536\u5DE5\u4F5C\u533A</h2>
        </div>
        ${activeUsage ? `
            <div class="grid gap-3 md:grid-cols-2">
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">\u4F7F\u7528\u5468\u671F\u53F7\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.usageNo)}</span></div>
                <div><span class="text-muted-foreground">\u4E2D\u8F6C\u888B\u7801\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.bagCode)}</span></div>
                <div><span class="text-muted-foreground">\u8F66\u7F1D\u4EFB\u52A1\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(activeUsage.sewingTaskNo)}</span></div>
                <div><span class="text-muted-foreground">\u5F53\u524D\u72B6\u6001\uFF1A</span>${renderTag(activeUsage.statusMeta.label, activeUsage.statusMeta.className)}</div>
                <div><span class="text-muted-foreground">\u53E3\u888B\u72B6\u6001\uFF1A</span>${activeUsage.bagStatusMeta ? renderTag(activeUsage.bagStatusMeta.label, activeUsage.bagStatusMeta.className) : '<span class="text-xs text-muted-foreground">\u5F85\u8865</span>'}</div>
              </div>
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3 text-sm">
                <div><span class="text-muted-foreground">\u83F2\u7968\u6570\u91CF\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(String(activeUsage.summary.ticketCount))}</span></div>
                <div><span class="text-muted-foreground">\u88C1\u7247\u5355\u6570\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(String(activeUsage.summary.cutOrderCount))}</span></div>
                <div><span class="text-muted-foreground">\u751F\u4EA7\u5355\u6570\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(String(activeUsage.summary.productionOrderCount))}</span></div>
                <div><span class="text-muted-foreground">\u56DE\u8D27\u8D44\u683C\uFF1A</span><span class="font-medium ${activeUsage.returnEligibility.ok ? "text-emerald-700" : "text-amber-700"}">${escapeHtml(activeUsage.returnEligibility.ok ? "\u53EF\u8FDB\u5165\u56DE\u8D27\u6D41\u7A0B" : activeUsage.returnEligibility.reason)}</span></div>
              </div>
            </div>
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">\u56DE\u8D27\u5165\u4ED3\u70B9</span>
                <input type="text" value="${escapeHtml(state.returnDraft.returnWarehouseName)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnWarehouseName" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">\u56DE\u8D27\u65F6\u95F4</span>
                <input type="text" value="${escapeHtml(state.returnDraft.returnAt)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnAt" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">\u56DE\u8D27\u4EBA</span>
                <input type="text" value="${escapeHtml(state.returnDraft.returnedBy)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnedBy" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">\u63A5\u6536\u4EBA</span>
                <input type="text" value="${escapeHtml(state.returnDraft.receivedBy)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="receivedBy" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">\u56DE\u8D27\u6210\u8863\u4EF6\u6570\u6458\u8981\uFF08\u4EF6\uFF09</span>
                <input type="number" value="${escapeHtml(state.returnDraft.returnedFinishedQty)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnedFinishedQty" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">\u56DE\u8D27\u83F2\u7968\u6570\u91CF\u6458\u8981</span>
                <input type="number" value="${escapeHtml(state.returnDraft.returnedTicketCountSummary)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnedTicketCountSummary" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">\u5DEE\u5F02\u7C7B\u578B</span>
                <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="discrepancyType">
                  <option value="NONE" ${state.returnDraft.discrepancyType === "NONE" ? "selected" : ""}>\u65E0\u5DEE\u5F02</option>
                  <option value="QTY_MISMATCH" ${state.returnDraft.discrepancyType === "QTY_MISMATCH" ? "selected" : ""}>\u4EF6\u6570\u5F02\u5E38</option>
                  <option value="DAMAGED_BAG" ${state.returnDraft.discrepancyType === "DAMAGED_BAG" ? "selected" : ""}>\u53E3\u888B\u635F\u574F</option>
                  <option value="LATE_RETURN" ${state.returnDraft.discrepancyType === "LATE_RETURN" ? "selected" : ""}>\u8FDF\u5F52\u8FD8</option>
                  <option value="MISSING_RECORD" ${state.returnDraft.discrepancyType === "MISSING_RECORD" ? "selected" : ""}>\u7F3A\u8BB0\u5F55</option>
                </select>
              </label>
              <label class="space-y-2 xl:col-span-1">
                <span class="text-sm font-medium text-foreground">\u5DEE\u5F02\u8BF4\u660E</span>
                <input type="text" value="${escapeHtml(state.returnDraft.discrepancyNote)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="discrepancyNote" />
              </label>
            </div>
            <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">\u888B\u51B5</span>
                <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="conditionStatus">
                  <option value="GOOD" ${state.conditionDraft.conditionStatus === "GOOD" ? "selected" : ""}>\u5B8C\u597D</option>
                  <option value="MINOR_DAMAGE" ${state.conditionDraft.conditionStatus === "MINOR_DAMAGE" ? "selected" : ""}>\u8F7B\u5FAE\u635F\u574F</option>
                  <option value="SEVERE_DAMAGE" ${state.conditionDraft.conditionStatus === "SEVERE_DAMAGE" ? "selected" : ""}>\u4E25\u91CD\u635F\u574F</option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">\u6D01\u51C0\u60C5\u51B5</span>
                <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="cleanlinessStatus">
                  <option value="CLEAN" ${state.conditionDraft.cleanlinessStatus === "CLEAN" ? "selected" : ""}>\u5E72\u51C0</option>
                  <option value="DIRTY" ${state.conditionDraft.cleanlinessStatus === "DIRTY" ? "selected" : ""}>\u5F85\u6E05\u6D01</option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">\u635F\u574F\u8BF4\u660E</span>
                <input type="text" value="${escapeHtml(state.conditionDraft.damageType)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="damageType" />
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">\u590D\u7528\u5EFA\u8BAE</span>
                <select class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="reusableDecision">
                  <option value="REUSABLE" ${state.conditionDraft.reusableDecision === "REUSABLE" ? "selected" : ""}>\u53EF\u590D\u7528</option>
                  <option value="WAITING_CLEANING" ${state.conditionDraft.reusableDecision === "WAITING_CLEANING" ? "selected" : ""}>\u5F85\u6E05\u6D01</option>
                  <option value="WAITING_REPAIR" ${state.conditionDraft.reusableDecision === "WAITING_REPAIR" ? "selected" : ""}>\u5F85\u7EF4\u4FEE</option>
                  <option value="DISABLED" ${state.conditionDraft.reusableDecision === "DISABLED" ? "selected" : ""}>\u505C\u7528 / \u62A5\u5E9F</option>
                </select>
              </label>
              <label class="space-y-2">
                <span class="text-sm font-medium text-foreground">\u7EF4\u4FEE\u9700\u6C42</span>
                <label class="flex h-10 items-center gap-2 rounded-md border bg-background px-3 text-sm">
                  <input type="checkbox" ${state.conditionDraft.repairNeeded ? "checked" : ""} data-transfer-bags-condition-toggle="repairNeeded" />
                  <span>\u9700\u8981\u7EF4\u4FEE</span>
                </label>
              </label>
              <label class="space-y-2 md:col-span-2 xl:col-span-5">
                <span class="text-sm font-medium text-foreground">\u888B\u51B5\u5907\u6CE8</span>
                <input type="text" value="${escapeHtml(state.conditionDraft.note)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-condition-field="note" />
              </label>
            </div>
            <div class="rounded-lg border bg-muted/15 p-3 text-sm">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-muted-foreground">\u81EA\u52A8\u5EFA\u8BAE\uFF1A</span>
                ${renderTag(decisionMeta.label, decisionMeta.className)}
                ${exceptionMeta ? renderTag(exceptionMeta.label, exceptionMeta.className) : ""}
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="prepare-return" data-usage-id="${escapeHtml(activeUsage.usageId)}">\u521B\u5EFA\u56DE\u8D27\u8349\u7A3F</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="complete-return-inspection" data-usage-id="${escapeHtml(activeUsage.usageId)}">\u5B8C\u6210\u9A8C\u6536</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="close-usage-cycle" data-usage-id="${escapeHtml(activeUsage.usageId)}">\u5173\u95ED\u4F7F\u7528\u5468\u671F</button>
              <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="clear-return-draft">\u91CD\u7F6E\u56DE\u8D27\u8349\u7A3F</button>
            </div>
          ` : '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u5F85\u56DE\u4ED3\u4F7F\u7528\u5468\u671F</div>'}
      </article>
      <article class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">\u888B\u51B5\u4E0E\u5F02\u5E38\u5904\u7406</h2>
        </div>
        ${renderConditionSection()}
      </article>
    </section>
  `;
}
function renderReuseCycleSection() {
  const cycles = getReturnViewModel().reuseCycles;
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
      <div>
        <h2 class="text-sm font-semibold text-foreground">\u590D\u7528\u5468\u671F\u53F0\u8D26</h2>
      </div>
      ${!cycles.length ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">\u5F53\u524D\u5C1A\u65E0\u590D\u7528\u5468\u671F\u53F0\u8D26\u3002</div>' : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">\u4E2D\u8F6C\u888B\u7801</th>
                  <th class="px-4 py-3 text-right">\u603B\u4F7F\u7528\u6B21\u6570</th>
                  <th class="px-4 py-3 text-right">\u603B\u53D1\u51FA\u6B21\u6570</th>
                  <th class="px-4 py-3 text-right">\u603B\u56DE\u4ED3\u6B21\u6570</th>
                  <th class="px-4 py-3 text-left">\u6700\u8FD1\u53D1\u51FA</th>
                  <th class="px-4 py-3 text-left">\u6700\u8FD1\u56DE\u4ED3</th>
                  <th class="px-4 py-3 text-left">\u5F53\u524D\u72B6\u6001</th>
                  <th class="px-4 py-3 text-left">\u5F53\u524D\u4F4D\u7F6E</th>
                  <th class="px-4 py-3 text-left">\u6700\u65B0\u4F7F\u7528\u5468\u671F\u53F7</th>
                </tr>
              </thead>
              <tbody>
                ${cycles.map(
    (item) => `
                      <tr class="border-b bg-card">
                        <td class="px-4 py-3 font-medium text-foreground">${escapeHtml(item.bagCode)}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.totalUsageCount))}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.totalDispatchCount))}</td>
                        <td class="px-4 py-3 text-right tabular-nums">${escapeHtml(String(item.totalReturnCount))}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.lastDispatchedAt || "\u6682\u65E0")}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.lastReturnedAt || "\u6682\u65E0")}</td>
                        <td class="px-4 py-3">${renderTag(item.bagStatusMeta.label, item.bagStatusMeta.className)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.currentLocation || "\u5F85\u8865")}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.latestUsageNo || "\u6682\u65E0")}</td>
                      </tr>
                    `
  ).join("")}
              </tbody>
            </table>
          `)}
    </section>
  `;
}
function renderConditionSection() {
  const items = getReturnViewModel().conditionItems.slice(0, 8);
  if (!items.length) {
    return '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">\u6682\u65E0\u888B\u51B5\u8BB0\u5F55</div>';
  }
  return renderStickyTableScroller(`
    <table class="min-w-full text-sm">
      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
        <tr>
          <th class="px-4 py-3 text-left">\u4E2D\u8F6C\u888B\u7801</th>
          <th class="px-4 py-3 text-left">\u6700\u65B0\u4F7F\u7528\u5468\u671F\u53F7</th>
          <th class="px-4 py-3 text-left">\u888B\u51B5</th>
          <th class="px-4 py-3 text-left">\u6D01\u51C0\u60C5\u51B5</th>
          <th class="px-4 py-3 text-left">\u635F\u574F\u8BF4\u660E</th>
          <th class="px-4 py-3 text-left">\u590D\u7528\u5EFA\u8BAE</th>
          <th class="px-4 py-3 text-left">\u5904\u7406\u5EFA\u8BAE</th>
        </tr>
      </thead>
      <tbody>
        ${items.map(
    (item) => `
              <tr class="border-b bg-card">
                <td class="px-4 py-3">${escapeHtml(item.bagCode)}</td>
                <td class="px-4 py-3">${escapeHtml(item.latestUsage?.usageNo || "\u5F85\u8865")}</td>
                <td class="px-4 py-3">${escapeHtml(item.conditionStatus === "GOOD" ? "\u5B8C\u597D" : item.conditionStatus === "MINOR_DAMAGE" ? "\u8F7B\u5FAE\u635F\u574F" : "\u4E25\u91CD\u635F\u574F")}</td>
                <td class="px-4 py-3">${escapeHtml(item.cleanlinessStatus === "CLEAN" ? "\u5E72\u51C0" : "\u5F85\u6E05\u6D01")}</td>
                <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.\u635F\u574F\u8BF4\u660E || "\u65E0")}</td>
                <td class="px-4 py-3">${renderTag(item.decisionMeta.label, item.decisionMeta.className)}</td>
                <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.returnExceptionMeta?.label || item.decisionMeta.detailText)}</td>
              </tr>
            `
  ).join("")}
      </tbody>
    </table>
  `, "max-h-[28vh]");
}
function renderReturnAuditSection() {
  const currentUsageId = state.activeUsageId;
  const allAudits = Object.values(getReturnViewModel().returnAuditTrailByUsageId).flat().sort((left, right) => right.actionAt.localeCompare(left.actionAt, "zh-CN"));
  const audits = currentUsageId ? (getReturnViewModel().returnAuditTrailByUsageId[currentUsageId] || []).slice().sort((left, right) => right.actionAt.localeCompare(left.actionAt, "zh-CN")) : allAudits;
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
      <div>
        <h2 class="text-sm font-semibold text-foreground">\u56DE\u8D27\u5BA1\u8BA1\u8BB0\u5F55</h2>
      </div>
      ${audits.length ? `<div class="space-y-2">${audits.slice(0, 10).map(
    (audit) => `
                <article class="rounded-lg border bg-muted/15 px-3 py-2 text-sm">
                  <div class="flex items-center justify-between gap-3">
                    <p class="font-medium text-foreground">${escapeHtml(audit.action)}</p>
                    <p class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(audit.actionAt))}</p>
                  </div>
                  <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(audit.actionBy)}</p>
                  <p class="mt-1 text-sm text-foreground">${escapeHtml(audit.payloadSummary)}</p>
                  <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(audit.note)}</p>
                </article>
              `
  ).join("")}</div>` : '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">\u6682\u65E0\u56DE\u8D27\u5BA1\u8BA1\u8BB0\u5F55</div>'}
    </section>
  `;
}
function renderBindingSection() {
  const bindings = getFilteredBindings();
  return `
    <section class="space-y-3 rounded-lg border bg-card p-3">
        <div>
          <h2 class="text-sm font-semibold text-foreground">\u7236\u5B50\u7801\u6620\u5C04\u660E\u7EC6</h2>
        </div>
      ${renderStickyFilterShell(`
        <label class="space-y-2">
          <span class="text-sm font-medium text-foreground">\u5173\u952E\u8BCD</span>
          <input
            type="text"
            value="${escapeHtml(state.bindingKeyword)}"
            placeholder="\u652F\u6301\u4E2D\u8F6C\u888B\u7801 / \u83F2\u7968\u7801 / \u88C1\u7247\u5355\u53F7 / \u551B\u67B6\u65B9\u6848\u53F7"
            class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            data-transfer-bags-binding-field="keyword"
          />
        </label>
      `)}
      ${!bindings.length ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">\u6682\u65E0\u7236\u5B50\u7801\u6620\u5C04</div>' : renderStickyTableScroller(`
            <table class="min-w-full text-sm">
              <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th class="px-4 py-3 text-left">\u4E2D\u8F6C\u888B\u7801</th>
                  <th class="px-4 py-3 text-left">\u4F7F\u7528\u5468\u671F\u53F7</th>
                  <th class="px-4 py-3 text-left">\u83F2\u7968\u7801</th>
                  <th class="px-4 py-3 text-left">\u9762\u6599\u5377\u53F7</th>
                  <th class="px-4 py-3 text-left">\u5E03\u6599\u989C\u8272</th>
                  <th class="px-4 py-3 text-left">\u5C3A\u7801</th>
                  <th class="px-4 py-3 text-left">\u88C1\u7247\u90E8\u4F4D</th>
                  <th class="px-4 py-3 text-left">\u6570\u91CF</th>
                  <th class="px-4 py-3 text-left">\u624E\u53F7</th>
                  <th class="px-4 py-3 text-left">\u88C1\u7247\u5355\u53F7</th>
                  <th class="px-4 py-3 text-left">\u751F\u4EA7\u5355\u53F7</th>
                  <th class="px-4 py-3 text-left">\u551B\u67B6\u65B9\u6848\u53F7</th>
                  <th class="px-4 py-3 text-left">\u7ED1\u5B9A\u65F6\u95F4</th>
                  <th class="px-4 py-3 text-left">\u7ED1\u5B9A\u4EBA</th>
                  <th class="px-4 py-3 text-left">\u5907\u6CE8</th>
                </tr>
              </thead>
              <tbody>
                ${bindings.map(
    (item) => `
                      <tr class="border-b bg-card">
                        <td class="px-4 py-3">${escapeHtml(item.bagCode)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.usage?.usageNo || "\u5F85\u8865")}</td>
                        <td class="px-4 py-3">${escapeHtml(item.ticketNo)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.fabricRollNo || item.ticket?.fabricRollNo || "\u6682\u65E0\u6570\u636E")}</td>
                        <td class="px-4 py-3">${escapeHtml(item.fabricColor || item.ticket?.fabricColor || "\u6682\u65E0\u6570\u636E")}</td>
                        <td class="px-4 py-3">${escapeHtml(item.size || item.ticket?.size || "\u6682\u65E0\u6570\u636E")}</td>
                        <td class="px-4 py-3">${escapeHtml(item.partName || item.ticket?.partName || "\u6682\u65E0\u6570\u636E")}</td>
                        <td class="px-4 py-3">${escapeHtml(String(item.garmentQty || item.qty || 0))}</td>
                        <td class="px-4 py-3">${escapeHtml(item.bundleNo || item.ticket?.bundleNo || "\u6682\u65E0\u6570\u636E")}</td>
                        <td class="px-4 py-3">${escapeHtml(item.cutOrderNo)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.productionOrderNo)}</td>
                        <td class="px-4 py-3">${escapeHtml(item.markerPlanNo || item.\u551B\u67B6\u65B9\u6848No || "\u65E0")}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(formatDateTime(item.boundAt))}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.boundBy)}</td>
                        <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.note || "\u65E0")}</td>
                      </tr>
                    `
  ).join("")}
              </tbody>
            </table>
          `)}
    </section>
  `;
}
function renderListPage() {
  syncPrefilterFromQuery();
  if (isTransferBagDetailPage()) return renderDetailPage();
  const meta = getCanonicalCuttingMeta(getCurrentTransferBagPathname(), "transfer-bags");
  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta)}
      ${renderDemoFixturePanel()}
      ${renderStatsCards()}
      ${renderPrefilterBar()}
      ${renderLandingBanner()}
      ${renderFeedbackBar()}
      ${renderCarrierManagementOverview()}
      ${renderMasterSection()}
      <div class="grid gap-3 xl:grid-cols-2">
        ${renderInboundTempUseSection()}
        ${renderHandoverPackingUseSection()}
      </div>
      <div class="grid gap-3 xl:grid-cols-2">
        ${renderSignAndReturnUseSection()}
        ${renderCarrierAbnormalSection()}
      </div>
    </div>
  `;
}
function renderDetailEmptyState() {
  return `
    <section class="rounded-lg border border-dashed bg-card px-6 py-12 text-center text-sm text-muted-foreground">
      \u672A\u627E\u5230\u5BF9\u5E94\u4E2D\u8F6C\u888B\uFF0C\u8BF7\u8FD4\u56DE\u5217\u8868\u91CD\u65B0\u9009\u62E9\u3002
    </section>
  `;
}
function renderTransferBagDetailHeader(activeMaster, focusedUsage) {
  const qrValue = resolveFormalBagQrValue(activeMaster);
  const summary = focusedUsage ? buildTransferBagParentChildSummary(focusedUsage.bindingItems || []) : null;
  const statusMeta = focusedUsage?.visibleStatusMeta || activeMaster.visibleStatusMeta;
  const summaryItems = [
    {
      label: "\u4E2D\u8F6C\u888B\u7801",
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(activeMaster.bagCode)}</span>`
    },
    {
      label: "\u5F53\u524D\u72B6\u6001",
      valueHtml: renderTag(statusMeta.label, statusMeta.className)
    },
    {
      label: "\u672C\u6B21\u5468\u8F6C\u53F7",
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(focusedUsage?.usageNo || "\u5C1A\u672A\u5F00\u59CB")}</span>`
    },
    {
      label: "\u8F66\u7F1D\u5DE5\u5382 / \u4EFB\u52A1",
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(focusedUsage ? `${formatFactoryDisplayName(focusedUsage.sewingFactoryName)} / ${focusedUsage.sewingTaskNo}` : "\u5F85\u9996\u5F20\u83F2\u7968\u9501\u5B9A")}</span>`
    },
    {
      label: "\u5F53\u524D\u5DF2\u88C5\u83F2\u7968\u6570\u91CF / \u5BB9\u91CF\uFF08\u5F20\uFF09",
      valueHtml: `<span class="text-sm font-semibold text-foreground">${escapeHtml(`${summary?.ticketCount || 0} \u5F20 / ${activeMaster.capacity} \u5F20`)}</span>`
    }
  ];
  return `
    <section data-transfer-bag-summary-strip class="rounded-xl border bg-card px-4 py-3">
      <div class="flex flex-wrap items-center gap-x-6 gap-y-3 xl:flex-nowrap">
        ${summaryItems.map(
    (item) => `
              <div class="min-w-[128px]">
                <div class="text-[11px] text-muted-foreground">${escapeHtml(item.label)}</div>
                <div class="mt-1">${item.valueHtml}</div>
              </div>
            `
  ).join("")}
        <div data-transfer-bag-summary-qr class="flex items-center gap-3 xl:ml-auto">
          ${qrValue ? `
                <div class="inline-flex shrink-0 rounded-lg border bg-white p-2">
                  ${renderRealQrPlaceholder({
    value: qrValue,
    size: 72,
    title: `\u4E2D\u8F6C\u888B\u7801 ${activeMaster.bagCode}`,
    label: `\u4E2D\u8F6C\u888B\u4E8C\u7EF4\u7801 ${activeMaster.bagCode}`
  })}
                </div>
              ` : '<div class="inline-flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-lg border border-dashed text-[11px] text-muted-foreground">\u6682\u65E0\u4E8C\u7EF4\u7801</div>'}
          <div class="min-w-0">
            <div class="text-[11px] text-muted-foreground">\u4E2D\u8F6C\u888B\u4E8C\u7EF4\u7801</div>
            <div class="mt-1 text-sm font-semibold text-foreground">${escapeHtml(activeMaster.bagCode)}</div>
          </div>
        </div>
      </div>
    </section>
  `;
}
function renderTransferBagDetailTabs(activeMaster, focusedUsage, activeTab) {
  const tabs = [
    { key: "current", label: "\u5F53\u524D\u4F7F\u7528" },
    { key: "history", label: "\u4F7F\u7528\u5468\u671F" },
    { key: "recovery", label: "\u7B7E\u6536\u4E0E\u56DE\u6536" },
    { key: "logs", label: "\u5F02\u5E38\u8BB0\u5F55" }
  ];
  return `
    <nav class="rounded-xl border bg-card p-2" aria-label="\u4E2D\u8F6C\u888B\u8BE6\u60C5\u9875\u7B7E">
      <div class="flex flex-wrap gap-2" role="tablist" aria-label="\u4E2D\u8F6C\u888B\u8BE6\u60C5\u9875\u7B7E">
        ${tabs.map((tab) => {
    const selected = tab.key === activeTab;
    return `
              <button
                type="button"
                id="transfer-bag-tab-${tab.key}"
                role="tab"
                aria-selected="${selected ? "true" : "false"}"
                aria-controls="transfer-bag-tabpanel-${tab.key}"
                class="rounded-lg px-3 py-2 text-sm font-medium ${selected ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"}"
                data-nav="${escapeHtml(buildTransferBagDetailRoute({
      bagId: activeMaster.bagId,
      bagCode: activeMaster.bagCode,
      usageId: focusedUsage?.usageId || void 0,
      usageNo: focusedUsage?.usageNo || void 0,
      detailTab: tab.key
    }))}"
              >${escapeHtml(tab.label)}</button>
            `;
  }).join("")}
      </div>
    </nav>
  `;
}
const transferBagBaggingStepMeta = [
  { id: "scan", index: 1, label: "\u626B\u7801\u88C5\u888B" },
  { id: "review", index: 2, label: "\u6838\u5BF9\u5B8C\u6210" },
  { id: "handover", index: 3, label: "\u4EA4\u51FA" }
];
function getBaggingActiveStepId(focusedUsage, currentSummary) {
  void currentSummary;
  if (!focusedUsage) return "scan";
  if (["DISPATCHED", "PENDING_SIGNOFF", "WAITING_RETURN", "RETURN_INSPECTING", "CLOSED", "EXCEPTION_CLOSED"].includes(focusedUsage.usageStatus)) return null;
  if (focusedUsage.usageStatus === "READY_TO_DISPATCH") return "handover";
  return "scan";
}
function getBaggingStepState(stepId, activeStepId, focusedUsage) {
  if (!focusedUsage) return stepId === "scan" ? "active" : "locked";
  if (!activeStepId) return "done";
  const stepIndex = transferBagBaggingStepMeta.find((item) => item.id === stepId)?.index || 0;
  const activeIndex = transferBagBaggingStepMeta.find((item) => item.id === activeStepId)?.index || 0;
  if (stepIndex < activeIndex) return "done";
  if (stepIndex === activeIndex) return "active";
  return "pending";
}
function buildBaggingStepSummary(stepId, activeMaster, focusedUsage, currentSummary, capacityExceeded) {
  const isInboundTempUsage = focusedUsage?.usageStage === "INBOUND_TEMP";
  if (stepId === "scan") {
    if (!focusedUsage) return `\u626B\u63CF\u9996\u5F20\u83F2\u7968\u540E\uFF0C\u81EA\u52A8\u5F00\u59CB ${activeMaster.bagCode} \u672C\u6B21\u5468\u8F6C`;
    return isInboundTempUsage ? `\u5DF2\u6682\u5B58 ${currentSummary?.ticketCount || 0} \u5F20\u83F2\u7968` : `\u5DF2\u88C5 ${currentSummary?.ticketCount || 0} \u5F20\u83F2\u7968`;
  }
  if (stepId === "review") {
    if (!focusedUsage) return "\u88C5\u888B\u540E\u518D\u6838\u5BF9\u888B\u5185\u5185\u5BB9";
    if (!currentSummary?.ticketCount) return "\u5F53\u524D\u8FD8\u6CA1\u6709\u83F2\u7968\uFF0C\u8BF7\u5148\u626B\u7801\u88C5\u888B";
    if (isInboundTempUsage) return "\u5165\u4ED3\u6682\u5B58\u888B\u5185\u5BB9\u53EF\u6DF7\u88C5\uFF0C\u4EA4\u51FA\u524D\u518D\u6309\u4EA4\u51FA\u5355\u4E8C\u6B21\u5206\u62E3";
    return capacityExceeded ? "\u5F53\u524D\u5BB9\u91CF\u5DF2\u8D85\u51FA\uFF0C\u8BF7\u5148\u6838\u5BF9\u540E\u518D\u5B8C\u6210\u88C5\u888B" : "\u888B\u5185\u5185\u5BB9\u5F85\u6838\u5BF9\uFF0C\u53EF\u6253\u5370\u6E05\u5355\u540E\u5B8C\u6210\u88C5\u888B";
  }
  if (!focusedUsage) return "\u5B8C\u6210\u88C5\u888B\u540E\u624D\u53EF\u4EA4\u51FA";
  if (isInboundTempUsage) return "\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D\u540E\u8FDB\u5165\u4EA4\u51FA\u88C5\u888B\u9636\u6BB5";
  return focusedUsage.dispatchAt ? `\u5DF2\u4E8E ${focusedUsage.dispatchAt} \u4EA4\u51FA` : "\u5B8C\u6210\u6838\u5BF9\u540E\u5373\u53EF\u4EA4\u51FA";
}
function buildBaggingStepHelperText(step) {
  if (step.id === "scan") {
    return step.state === "locked" ? "\u672C\u6B21\u5468\u8F6C\u5B8C\u6210\u540E\u624D\u80FD\u518D\u6B21\u626B\u7801\u88C5\u888B" : "\u5165\u4ED3\u6682\u5B58\u53EF\u6DF7\u88C5\uFF1B\u4EA4\u51FA\u88C5\u888B\u6309\u4EA4\u51FA\u5355\u6216\u4EA4\u51FA\u8BB0\u5F55\u6838\u5BF9";
  }
  if (step.id === "review") {
    return step.state === "locked" ? "\u8BF7\u5148\u626B\u7801\u88C5\u888B\uFF0C\u518D\u6838\u5BF9\u888B\u5185\u5185\u5BB9" : "\u6838\u5BF9\u888B\u5185\u5185\u5BB9\uFF0C\u786E\u8BA4\u540E\u5B8C\u6210\u88C5\u888B";
  }
  return step.state === "locked" ? "\u5B8C\u6210\u88C5\u888B\u540E\u624D\u80FD\u8FDB\u5165\u4E0B\u4E00\u9636\u6BB5" : "\u4EA4\u51FA\u88C5\u888B\u9636\u6BB5\u5FC5\u987B\u7ED1\u5B9A\u4EA4\u51FA\u5355\u6216\u4EA4\u51FA\u8BB0\u5F55";
}
function getBaggingStepViews(activeMaster, focusedUsage, currentSummary, capacityExceeded) {
  const activeStepId = getBaggingActiveStepId(focusedUsage, currentSummary);
  return transferBagBaggingStepMeta.map((meta) => {
    const state2 = getBaggingStepState(meta.id, activeStepId, focusedUsage);
    return {
      ...meta,
      state: state2,
      summary: buildBaggingStepSummary(meta.id, activeMaster, focusedUsage, currentSummary, capacityExceeded),
      helperText: "",
      open: state2 === "active"
    };
  }).map((item) => ({
    ...item,
    helperText: buildBaggingStepHelperText(item)
  }));
}
function getBaggingStepTone(stepState) {
  if (stepState === "done") {
    return {
      railClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
      cardClass: "border-emerald-200 bg-emerald-50/40",
      stateLabel: "\u5DF2\u5B8C\u6210"
    };
  }
  if (stepState === "active") {
    return {
      railClass: "border-amber-200 bg-amber-50 text-amber-700",
      badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
      cardClass: "border-amber-200 bg-amber-50/30 shadow-sm",
      stateLabel: "\u8FDB\u884C\u4E2D"
    };
  }
  if (stepState === "pending") {
    return {
      railClass: "border-slate-200 bg-slate-50 text-slate-600",
      badgeClass: "border-slate-200 bg-slate-50 text-slate-600",
      cardClass: "border-slate-200 bg-card",
      stateLabel: "\u672A\u5F00\u59CB"
    };
  }
  return {
    railClass: "border-dashed border-slate-200 bg-slate-50/70 text-slate-400",
    badgeClass: "border-dashed border-slate-200 bg-slate-50 text-slate-400",
    cardClass: "border-dashed border-slate-200 bg-slate-50/70",
    stateLabel: "\u6682\u4E0D\u53EF\u64CD\u4F5C"
  };
}
function renderBaggingStepRail(steps) {
  return `
    <section class="rounded-xl border bg-card p-3">
      <div class="flex flex-wrap gap-2" aria-label="\u672C\u6B21\u88C5\u888B\u6B65\u9AA4">
        ${steps.map((step) => {
    const tone = getBaggingStepTone(step.state);
    return `
              <div class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${tone.railClass}">
                <span class="inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold ${tone.badgeClass}">${step.index}</span>
                <span class="font-medium">${escapeHtml(step.label)}</span>
              </div>
            `;
  }).join("")}
      </div>
    </section>
  `;
}
function renderCollapsedBaggingStepSummary(step) {
  const tone = getBaggingStepTone(step.state);
  return `
    <summary class="cursor-pointer list-none px-4 py-3 [&::-webkit-details-marker]:hidden">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex min-w-0 items-start gap-3">
          <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold ${tone.badgeClass}">${step.index}</span>
          <div class="min-w-0">
            <div class="text-sm font-semibold text-foreground">${escapeHtml(step.label)}</div>
            <div class="mt-1 text-sm text-muted-foreground">${escapeHtml(step.summary)}</div>
          </div>
        </div>
        <span class="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${tone.badgeClass}">${tone.stateLabel}</span>
      </div>
    </summary>
  `;
}
function renderBaggingStepCard(step, body) {
  const tone = getBaggingStepTone(step.state);
  return `
    <details data-bagging-step="${step.id}" data-step-state="${step.state}" class="rounded-xl border ${tone.cardClass}" ${step.open ? "open" : ""}>
      ${renderCollapsedBaggingStepSummary(step)}
      <div class="border-t px-4 py-4">
        <p class="mb-3 text-sm text-muted-foreground">${escapeHtml(step.helperText)}</p>
        ${body}
      </div>
    </details>
  `;
}
function renderBaggingInlineField(label, value, valueClassName = "text-foreground") {
  return `
    <div class="text-sm">
      <span class="text-muted-foreground">${escapeHtml(label)}\uFF1A</span>
      <span class="font-medium ${valueClassName}">${escapeHtml(value)}</span>
    </div>
  `;
}
function renderBaggedTicketCompactList(currentBindings, focusedUsage) {
  if (!currentBindings.length || !focusedUsage) {
    return '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">\u5F53\u524D\u8FD8\u6CA1\u6709\u5DF2\u88C5\u888B\u83F2\u7968\uFF0C\u8BF7\u5148\u626B\u7801\u52A0\u5165\u672C\u888B\u3002</div>';
  }
  return `
    <div class="rounded-lg border bg-card">
      <div class="border-b px-3 py-2 text-sm font-medium text-foreground">\u5DF2\u88C5\u888B\u83F2\u7968</div>
      ${renderStickyTableScroller(
    `
          <table class="min-w-full text-sm">
            <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th class="px-3 py-2 text-left">\u83F2\u7968\u7801</th>
                <th class="px-3 py-2 text-left">\u88C1\u7247\u5355</th>
                <th class="px-3 py-2 text-left">\u6B3E\u53F7</th>
                <th class="px-3 py-2 text-left">\u8F66\u7F1D\u5DE5\u5382</th>
                <th class="px-3 py-2 text-left">\u4EFB\u52A1\u5355\u53F7</th>
              </tr>
            </thead>
            <tbody>
              ${currentBindings.map(
      (binding) => `
                    <tr class="border-b bg-card">
                      <td class="px-3 py-2 font-medium text-foreground">${escapeHtml(binding.ticketNo)}</td>
                      <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(binding.cutOrderNo || "\u2014")}</td>
                      <td class="px-3 py-2">${escapeHtml(binding.ticket?.styleCode || focusedUsage.styleCode || "\u5F85\u8865")}</td>
                      <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(formatFactoryDisplayName(focusedUsage.sewingFactoryName) || "\u5F85\u9501\u5B9A")}</td>
                      <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(focusedUsage.sewingTaskNo || "\u5F85\u9501\u5B9A")}</td>
                    </tr>
                  `
    ).join("")}
            </tbody>
          </table>
        `,
    "max-h-[18vh]"
  )}
    </div>
  `;
}
function renderBaggingScanStepCard(step, focusedUsage, currentBindings, currentSummary, candidateTickets, capacityExceeded) {
  const canEditBindings = !focusedUsage ? true : !["DISPATCHED", "PENDING_SIGNOFF", "WAITING_RETURN", "RETURN_INSPECTING", "CLOSED", "EXCEPTION_CLOSED"].includes(focusedUsage.usageStatus);
  return renderBaggingStepCard(
    step,
    `
      <div class="space-y-3">
        <div class="grid gap-3 md:grid-cols-[1fr,auto]">
          <label class="space-y-2">
            <span class="text-sm font-medium text-foreground">\u626B\u83F2\u7968\u52A0\u5165\u672C\u888B</span>
            <input
              type="text"
              value="${escapeHtml(state.draft.ticketInput)}"
              placeholder="\u8F93\u5165\u6216\u626B\u63CF\u83F2\u7968\u7801"
              class="h-11 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              data-transfer-bags-workbench-field="ticketInput"
              ${canEditBindings ? "" : "disabled"}
            />
          </label>
          <button type="button" class="rounded-md border px-4 py-2 text-sm hover:bg-muted md:self-end" data-transfer-bags-action="bind-ticket" ${canEditBindings ? "" : "disabled"}>\u52A0\u5165\u672C\u888B</button>
        </div>
        <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          ${renderBaggingInlineField("\u5DF2\u88C5\u83F2\u7968\u6570\u91CF", `${currentSummary.ticketCount} \u5F20`)}
          ${renderBaggingInlineField("\u5BB9\u91CF\u72B6\u6001", capacityExceeded ? "\u5DF2\u8D85\u5BB9\u91CF" : "\u5BB9\u91CF\u6B63\u5E38", capacityExceeded ? "text-amber-700" : "text-foreground")}
          ${focusedUsage ? `
                ${renderBaggingInlineField("\u8F66\u7F1D\u5DE5\u5382", formatFactoryDisplayName(focusedUsage.sewingFactoryName) || "\u5F85\u9501\u5B9A")}
                ${renderBaggingInlineField("\u8F66\u7F1D\u4EFB\u52A1", focusedUsage.sewingTaskNo || "\u5F85\u9501\u5B9A")}
                ${renderBaggingInlineField("\u5F53\u524D\u6B3E\u53F7", focusedUsage.styleCode || "\u5F85\u9501\u5B9A")}
              ` : ""}
        </div>
        ${focusedUsage ? "" : '<div class="rounded-lg border border-dashed px-4 py-4 text-sm text-muted-foreground">\u626B\u63CF\u9996\u5F20\u83F2\u7968\u540E\uFF0C\u4F1A\u81EA\u52A8\u5F00\u59CB\u672C\u6B21\u5468\u8F6C\u5E76\u9501\u5B9A\u8F66\u7F1D\u5DE5\u5382 / \u6B3E\u53F7\u4E0A\u4E0B\u6587\u3002</div>'}
        ${candidateTickets.length ? `
              <div class="space-y-2 rounded-lg border bg-muted/15 p-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <div class="text-sm font-medium text-foreground">\u5019\u9009\u83F2\u7968</div>
                  <button type="button" class="rounded-md border px-3 py-1.5 text-xs hover:bg-muted" data-transfer-bags-action="import-prefill" ${canEditBindings ? "" : "disabled"}>\u5BFC\u5165\u5019\u9009\u83F2\u7968\uFF08${candidateTickets.length}\uFF09</button>
                </div>
                <div class="flex flex-wrap gap-2">
                  ${candidateTickets.map(
      (item) => renderWorkbenchFilterChip(
        `${item.ticketNo} / ${item.cutOrderNo}`,
        `data-transfer-bags-action="set-ticket-input" data-ticket-no="${escapeHtml(item.ticketNo)}"`,
        "blue"
      )
    ).join("")}
                </div>
              </div>
            ` : ""}
        ${renderBaggedTicketCompactList(currentBindings, focusedUsage)}
        ${capacityExceeded ? '<div class="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">\u5F53\u524D\u88C5\u888B\u6570\u91CF\u5DF2\u8D85\u5BB9\u91CF\uFF0C\u8BF7\u5148\u6838\u5BF9\u888B\u5185\u5185\u5BB9\u518D\u7EE7\u7EED\u64CD\u4F5C\u3002</div>' : ""}
        ${canEditBindings ? "" : '<div class="rounded-lg border border-dashed px-4 py-5 text-sm text-muted-foreground">\u5F53\u524D\u72B6\u6001\u4E0B\u4E0D\u53EF\u7EE7\u7EED\u626B\u7801\u88C5\u888B\uFF0C\u8BF7\u5728\u56DE\u6536\u9875\u7B7E\u5904\u7406\u540E\u7EED\u56DE\u6536\u3002</div>'}
      </div>
    `
  );
}
function renderBaggingReviewStepCard(step, focusedUsage, currentBindings, currentSummary, capacityExceeded) {
  return renderBaggingStepCard(
    step,
    !focusedUsage ? '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">\u8BF7\u5148\u5F00\u59CB\u672C\u6B21\u5468\u8F6C\uFF0C\u518D\u6838\u5BF9\u888B\u5185\u5185\u5BB9\u3002</div>' : `
        <div class="space-y-3">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            ${renderDetailMetric("\u5DF2\u7ED1\u83F2\u7968\u6570\u91CF", String(currentSummary.ticketCount))}
            ${renderDetailMetric("\u6765\u6E90\u88C1\u7247\u5355\u6570", String(currentSummary.cutOrderCount))}
            ${renderDetailMetric("\u6765\u6E90\u751F\u4EA7\u5355\u6570", String(currentSummary.productionOrderCount))}
            ${renderDetailMetric("\u5F53\u524D\u6B3E\u53F7", focusedUsage.styleCode || "\u5F85\u9501\u5B9A")}
            ${renderDetailMetric("\u5BB9\u91CF\u72B6\u6001", capacityExceeded ? "\u5DF2\u8D85\u5BB9\u91CF" : "\u5BB9\u91CF\u6B63\u5E38", capacityExceeded ? "text-amber-700" : "text-foreground")}
          </div>
          ${currentBindings.length ? renderStickyTableScroller(
      `
                    <table class="min-w-full text-sm">
                      <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                        <tr>
                          <th class="px-3 py-2 text-left">\u83F2\u7968\u7801</th>
                          <th class="px-3 py-2 text-left">\u9762\u6599\u5377\u53F7</th>
                          <th class="px-3 py-2 text-left">\u5E03\u6599\u989C\u8272</th>
                          <th class="px-3 py-2 text-left">\u5C3A\u7801</th>
                          <th class="px-3 py-2 text-left">\u90E8\u4F4D</th>
                          <th class="px-3 py-2 text-right">\u6570\u91CF</th>
                          <th class="px-3 py-2 text-left">\u624E\u53F7</th>
                          <th class="px-3 py-2 text-left">\u88C1\u7247\u5355</th>
                          <th class="px-3 py-2 text-left">\u72B6\u6001</th>
                          <th class="px-3 py-2 text-left">\u64CD\u4F5C</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${currentBindings.map(
        (binding) => `
                              <tr class="border-b bg-card">
                                <td class="px-3 py-2 font-medium text-foreground">${escapeHtml(binding.ticketNo)}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.fabricRollNo || binding.ticket?.fabricRollNo || "\u6682\u65E0\u6570\u636E")}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.fabricColor || binding.ticket?.fabricColor || "\u6682\u65E0\u6570\u636E")}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.size || binding.ticket?.size || "\u6682\u65E0\u6570\u636E")}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.partName || binding.ticket?.partName || "\u6682\u65E0\u6570\u636E")}</td>
                                <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(binding.qty))}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.bundleNo || binding.ticket?.bundleNo || "\u6682\u65E0\u6570\u636E")}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.cutOrderNo || "\u2014")}</td>
                                <td class="px-3 py-2">${escapeHtml(binding.ticket?.ticketStatus === "VOIDED" ? "\u5DF2\u4F5C\u5E9F" : "\u6709\u6548")}</td>
                                <td class="px-3 py-2">
                                  ${binding.removable ? `<button type="button" class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-transfer-bags-action="remove-binding" data-binding-id="${escapeHtml(binding.bindingId)}">\u79FB\u9664</button>` : '<span class="text-xs text-muted-foreground">\u4E0D\u53EF\u79FB\u9664</span>'}
                                </td>
                              </tr>
                            `
      ).join("")}
                      </tbody>
                    </table>
                  `,
      "max-h-[24vh]"
    ) : '<div class="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">\u5F53\u524D\u8FD8\u6CA1\u6709\u83F2\u7968\uFF0C\u8BF7\u5148\u5B8C\u6210\u6B65\u9AA4 2 \u7684\u88C5\u888B\u7ED1\u5B9A\u3002</div>'}
          <div class="flex flex-wrap gap-2">
            ${currentBindings.length ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="print-manifest" data-usage-id="${escapeHtml(focusedUsage.usageId)}">\u6253\u5370\u4E2D\u8F6C\u888B\u4E8C\u7EF4\u7801</button>` : ""}
            ${currentBindings.length && ["DRAFT", "PACKING"].includes(focusedUsage.usageStatus) ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-ready" data-usage-id="${escapeHtml(focusedUsage.usageId)}">\u5B8C\u6210\u88C5\u888B</button>` : ""}
          </div>
          ${currentBindings.length ? "" : '<div class="text-sm text-muted-foreground">\u5F53\u524D\u8FD8\u6CA1\u6709\u88C5\u5165\u83F2\u7968\uFF0C\u6682\u4E0D\u80FD\u5B8C\u6210\u88C5\u888B\u3002</div>'}
          ${focusedUsage.productionOrderNos.length || focusedUsage.cutOrderNos.length || focusedUsage.markerPlanNos.length ? `
              <details class="rounded-lg border bg-muted/10 p-3" data-testid="transfer-bags-source-trace-fold" data-default-open="collapsed">
                <summary class="cursor-pointer text-sm font-medium text-foreground">\u8FFD\u6EAF\u4FE1\u606F</summary>
                <div class="mt-3 grid gap-3 md:grid-cols-3 text-sm">
                  <div><span class="text-muted-foreground">\u6765\u6E90\u751F\u4EA7\u5355\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(focusedUsage.productionOrderNos.join(" / ") || "\u6682\u65E0")}</span></div>
                  <div><span class="text-muted-foreground">\u6765\u6E90\u88C1\u7247\u5355\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(focusedUsage.cutOrderNos.join(" / ") || "\u6682\u65E0")}</span></div>
                  <div><span class="text-muted-foreground">\u6765\u6E90\u551B\u67B6\u65B9\u6848\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(focusedUsage.markerPlanNos.join(" / ") || "\u6682\u65E0")}</span></div>
                </div>
              </details>
            ` : ""}
        </div>
      `
  );
}
function renderBaggingHandoverStepCard(step, focusedUsage, currentSummary) {
  return renderBaggingStepCard(
    step,
    !focusedUsage ? '<div class="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">\u5B8C\u6210\u88C5\u888B\u540E\uFF0C\u624D\u4F1A\u8FDB\u5165\u4EA4\u51FA\u6B65\u9AA4\u3002</div>' : `
        <div class="space-y-3">
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            ${renderDetailMetric("\u672C\u6B21\u5468\u8F6C\u53F7", focusedUsage.usageNo)}
            ${renderDetailMetric("\u4E2D\u8F6C\u888B\u7801", focusedUsage.bagCode)}
            ${renderDetailMetric("\u8F66\u7F1D\u5DE5\u5382", formatFactoryDisplayName(focusedUsage.sewingFactoryName) || "\u5F85\u9501\u5B9A")}
            ${renderDetailMetric("\u5DF2\u88C5\u83F2\u7968\u6570\u91CF", `${currentSummary.ticketCount}`)}
            ${renderDetailMetric("\u5F53\u524D\u72B6\u6001", focusedUsage.visibleStatusMeta.label)}
          </div>
          <div class="flex flex-wrap gap-2">
            ${focusedUsage.usageStatus === "READY_TO_DISPATCH" ? `<button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="mark-dispatched" data-usage-id="${escapeHtml(focusedUsage.usageId)}">\u4EA4\u51FA</button>` : ""}
          </div>
          ${focusedUsage.usageStatus === "READY_TO_DISPATCH" ? '<div class="text-sm text-muted-foreground">\u6838\u5BF9\u65E0\u8BEF\u540E\u4EA4\u51FA\u5373\u53EF\uFF0C\u88C1\u7247\u4ED3\u4FA7\u4E3B\u6D41\u7A0B\u81F3\u6B64\u5B8C\u6210\u3002</div>' : '<div class="text-sm text-muted-foreground">\u5F53\u524D\u6B65\u9AA4\u4EC5\u4FDD\u7559\u4EA4\u51FA\u7ED3\u679C\u6458\u8981\u3002</div>'}
        </div>
      `
  );
}
function renderTransferBagCurrentTab(activeMaster, focusedUsage) {
  const currentBindings = focusedUsage ? getViewModel().bindingsByUsageId[focusedUsage.usageId] || [] : [];
  const currentSummary = buildTransferBagParentChildSummary(currentBindings);
  const candidateTickets = getCandidateTickets();
  const capacityExceeded = currentSummary.ticketCount > activeMaster.capacity;
  const steps = getBaggingStepViews(activeMaster, focusedUsage, currentSummary, capacityExceeded);
  const finishedFlow = Boolean(
    focusedUsage && ["DISPATCHED", "PENDING_SIGNOFF", "WAITING_RETURN", "RETURN_INSPECTING", "CLOSED", "EXCEPTION_CLOSED"].includes(focusedUsage.usageStatus)
  );
  return `
    <section id="transfer-bag-tabpanel-current" role="tabpanel" aria-labelledby="transfer-bag-tab-current" class="space-y-3">
      ${renderBaggingStepRail(steps)}
      ${renderTransferBagTraceabilityBlock(focusedUsage)}
      ${finishedFlow && focusedUsage ? `
            <article class="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
              <div class="text-sm font-semibold text-foreground">\u672C\u6B21\u5468\u8F6C\u5DF2\u5B8C\u6210\u4EA4\u51FA</div>
              <p class="mt-1 text-sm text-muted-foreground">\u5F53\u524D\u72B6\u6001\u4E3A\uFF1A${escapeHtml(focusedUsage.visibleStatusMeta.label)}\u3002\u88C1\u7247\u4ED3\u4FA7\u7684\u626B\u7801\u88C5\u888B\u3001\u6838\u5BF9\u548C\u4EA4\u51FA\u90FD\u5DF2\u5B8C\u6210\uFF0C\u8BF7\u5230\u7B7E\u6536\u4E0E\u56DE\u6536\u9875\u7B7E\u5904\u7406\u540E\u7EED\u56DE\u6536\u3002</p>
              <div class="mt-3 flex flex-wrap gap-2">
                <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildTransferBagDetailRoute({
    bagId: activeMaster.bagId,
    bagCode: activeMaster.bagCode,
    usageId: focusedUsage.usageId,
    usageNo: focusedUsage.usageNo,
    detailTab: "recovery"
  }))}">\u53BB\u7B7E\u6536\u4E0E\u56DE\u6536</button>
              </div>
            </article>
          ` : ""}
      ${renderBaggingScanStepCard(steps[0], focusedUsage, currentBindings, currentSummary, candidateTickets, capacityExceeded)}
      ${renderBaggingReviewStepCard(steps[1], focusedUsage, currentBindings, currentSummary, capacityExceeded)}
      ${renderBaggingHandoverStepCard(steps[2], focusedUsage, currentSummary)}
    </section>
  `;
}
function renderTransferBagHistoryTab(activeMaster, focusedUsage) {
  const usages = getDetailBagUsages(activeMaster);
  const selectedUsage = focusedUsage && focusedUsage.bagId === activeMaster.bagId ? focusedUsage : usages[0] || null;
  return `
    <section id="transfer-bag-tabpanel-history" role="tabpanel" aria-labelledby="transfer-bag-tab-history" class="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 class="text-sm font-semibold text-foreground">\u4F7F\u7528\u5468\u671F</h2>
      </div>
      ${!usages.length ? '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">\u5F53\u524D\u53E3\u888B\u8FD8\u6CA1\u6709\u8FC7\u5F80\u5468\u8F6C\u8BB0\u5F55\u3002</div>' : `
          ${renderStickyTableScroller(
    `
              <table class="min-w-full text-sm">
                <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th class="px-3 py-2 text-left">\u672C\u6B21\u5468\u8F6C\u53F7</th>
                    <th class="px-3 py-2 text-left">\u72B6\u6001</th>
                    <th class="px-3 py-2 text-left">\u5F00\u59CB\u65F6\u95F4</th>
                    <th class="px-3 py-2 text-left">\u8F66\u7F1D\u4EFB\u52A1</th>
                    <th class="px-3 py-2 text-left">\u8F66\u7F1D\u5DE5\u5382</th>
                    <th class="px-3 py-2 text-right">\u83F2\u7968\u6570\u91CF</th>
                    <th class="px-3 py-2 text-left">\u4EA4\u51FA / \u56DE\u6536</th>
                  </tr>
                </thead>
                <tbody>
                  ${usages.map(
      (item) => `
                        <tr class="border-b ${selectedUsage?.usageId === item.usageId ? "bg-orange-50/60" : "bg-card"}">
                          <td class="px-3 py-2">
                            <button
                              type="button"
                              class="font-medium text-blue-700 hover:underline"
                              data-nav="${escapeHtml(buildTransferBagDetailRoute({
        bagId: item.bagId,
        bagCode: item.bagCode,
        usageId: item.usageId,
        usageNo: item.usageNo,
        detailTab: "history"
      }))}"
                            >${escapeHtml(item.usageNo)}</button>
                          </td>
                          <td class="px-3 py-2">${renderTag(item.visibleStatusMeta.label, item.visibleStatusMeta.className)}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(item.startedAt || "\u5F85\u8865")}</td>
                          <td class="px-3 py-2">${escapeHtml(item.sewingTaskNo)}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(formatFactoryDisplayName(item.sewingFactoryName) || "\u5F85\u8865")}</td>
                          <td class="px-3 py-2 text-right tabular-nums">${escapeHtml(String(item.summary.ticketCount))}</td>
                          <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml([item.dispatchAt || "\u5F85\u4EA4\u51FA", item.returnedAt || "\u5F85\u56DE\u6536"].join(" / "))}</td>
                        </tr>
                      `
    ).join("")}
                </tbody>
              </table>
            `,
    "max-h-[26vh]"
  )}
          ${selectedUsage ? `
                <div class="rounded-xl border bg-muted/15 p-4">
                  <div class="text-sm font-semibold text-foreground">\u5F53\u524D\u6458\u8981</div>
                  <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4 text-sm">
                    <div><span class="text-muted-foreground">\u672C\u6B21\u5468\u8F6C\u53F7\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.usageNo)}</span></div>
                    <div><span class="text-muted-foreground">\u5F00\u59CB\u65F6\u95F4\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.startedAt || "\u5F85\u8865")}</span></div>
                    <div><span class="text-muted-foreground">\u8F66\u7F1D\u4EFB\u52A1\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.sewingTaskNo)}</span></div>
                    <div><span class="text-muted-foreground">\u8F66\u7F1D\u5DE5\u5382\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(formatFactoryDisplayName(selectedUsage.sewingFactoryName) || "\u5F85\u8865")}</span></div>
                    <div><span class="text-muted-foreground">\u83F2\u7968\u6570\u91CF\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(String(selectedUsage.summary.ticketCount))}</span></div>
                    <div><span class="text-muted-foreground">\u4EA4\u51FA\u65F6\u95F4\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.dispatchAt || "\u5F85\u4EA4\u51FA")}</span></div>
                    <div><span class="text-muted-foreground">\u56DE\u6536\u65F6\u95F4\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.returnedAt || "\u5F85\u56DE\u6536")}</span></div>
                    <div><span class="text-muted-foreground">\u56DE\u6536\u65F6\u95F4\uFF1A</span><span class="font-medium text-foreground">${escapeHtml(selectedUsage.returnedAt || "\u5F85\u56DE\u6536")}</span></div>
                  </div>
                </div>
              ` : ""}
        `}
    </section>
  `;
}
function renderTransferBagRecoveryTab(activeMaster, focusedUsage) {
  const recoveryEntries = getDetailBagRecoveryEntries(activeMaster);
  const selectedRecoveryEntry = recoveryEntries.find((item) => item.usage.usageId === focusedUsage?.usageId) || recoveryEntries[0] || null;
  const selectedUsage = focusedUsage || selectedRecoveryEntry?.usage || null;
  if (!selectedUsage && !recoveryEntries.length) {
    return `
      <section id="transfer-bag-tabpanel-recovery" role="tabpanel" aria-labelledby="transfer-bag-tab-recovery" class="space-y-3 rounded-xl border bg-card p-4">
        <div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">\u5F53\u524D\u8FD8\u6CA1\u6709\u53EF\u56DE\u6536\u7684\u5468\u8F6C\u8BB0\u5F55\u3002</div>
      </section>
    `;
  }
  const returnUsage = selectedUsage ? getDetailReturnUsage(selectedUsage.usageId) : null;
  const latestReceipt = returnUsage?.latestReturnReceipt || null;
  const canShowForm = Boolean(
    selectedUsage && returnUsage && returnUsage.returnEligibility.ok
  );
  const recoveryNotice = latestReceipt ? "\u5F53\u524D\u5468\u8F6C\u5DF2\u5B8C\u6210\u56DE\u6536\u767B\u8BB0\uFF0C\u4E0B\u9762\u4FDD\u7559\u6700\u8FD1\u5386\u53F2\u56DE\u6536\u8BB0\u5F55\u3002" : `\u5F53\u524D\u5C1A\u672A\u8FDB\u5165\u56DE\u6536\u9636\u6BB5\uFF0C\u5F53\u524D\u72B6\u6001\u4E3A\uFF1A${(selectedUsage || focusedUsage)?.visibleStatusMeta.label || activeMaster.visibleStatusMeta.label}\u3002\u4E0B\u9762\u4FDD\u7559\u6700\u8FD1\u5386\u53F2\u56DE\u6536\u8BB0\u5F55\u3002`;
  return `
    <section id="transfer-bag-tabpanel-recovery" role="tabpanel" aria-labelledby="transfer-bag-tab-recovery" class="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 class="text-sm font-semibold text-foreground">\u7B7E\u6536\u4E0E\u56DE\u6536</h2>
      </div>
      ${!canShowForm ? `<div class="rounded-lg border border-dashed px-6 py-8 text-sm text-muted-foreground">${escapeHtml(recoveryNotice)}</div>` : `
            <article class="space-y-3 rounded-xl border bg-muted/15 p-4">
              <div>
                <h3 class="text-sm font-semibold text-foreground">\u56DE\u6536\u767B\u8BB0</h3>
                <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(`\u5F53\u524D\u5904\u7406 ${selectedUsage?.usageNo || activeMaster.latestUsageNo || activeMaster.bagCode}\u3002\u767B\u8BB0\u5B8C\u6210\u540E\uFF0C\u53E3\u888B\u4F1A\u76F4\u63A5\u56DE\u5230\u7A7A\u95F2\u3002`)}</p>
              </div>
              <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">\u56DE\u6536\u70B9 / \u56DE\u6536\u4ED3</span>
                  <input type="text" value="${escapeHtml(state.returnDraft.returnWarehouseName)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnWarehouseName" />
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">\u56DE\u6536\u65F6\u95F4</span>
                  <input type="text" value="${escapeHtml(state.returnDraft.returnAt)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="returnAt" />
                </label>
                <label class="space-y-2">
                  <span class="text-sm font-medium text-foreground">\u63A5\u6536\u4EBA</span>
                  <input type="text" value="${escapeHtml(state.returnDraft.receivedBy)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="receivedBy" />
                </label>
                <label class="space-y-2 md:col-span-2 xl:col-span-4">
                  <span class="text-sm font-medium text-foreground">\u5907\u6CE8</span>
                  <input type="text" value="${escapeHtml(state.returnDraft.note)}" class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500" data-transfer-bags-return-draft-field="note" />
                </label>
              </div>
              <div class="flex flex-wrap gap-2">
                <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-transfer-bags-action="complete-return-inspection" data-usage-id="${escapeHtml(selectedUsage?.usageId || "")}">\u5B8C\u6210\u56DE\u6536</button>
              </div>
            </article>
          `}
      ${recoveryEntries.length ? `
            <article class="space-y-3 rounded-xl border bg-muted/10 p-4">
              <div>
                <h3 class="text-sm font-semibold text-foreground">\u6700\u8FD1\u56DE\u6536\u8BB0\u5F55</h3>
              </div>
              ${renderStickyTableScroller(
    `
                  <table class="min-w-full text-sm">
                    <thead class="sticky top-0 z-10 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th class="px-3 py-2 text-left">\u5468\u8F6C\u53F7</th>
                        <th class="px-3 py-2 text-left">\u56DE\u6536\u65F6\u95F4</th>
                        <th class="px-3 py-2 text-left">\u56DE\u6536\u70B9</th>
                        <th class="px-3 py-2 text-left">\u63A5\u6536\u4EBA</th>
                        <th class="px-3 py-2 text-left">\u5907\u6CE8</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${recoveryEntries.map(
      (entry) => `
                            <tr class="border-b ${selectedUsage?.usageId === entry.usage.usageId ? "bg-orange-50/50" : "bg-card"}">
                              <td class="px-3 py-2 font-medium text-foreground">${escapeHtml(entry.usage.usageNo)}</td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(entry.latestReceipt?.returnAt || entry.latestClosure?.closedAt || "\u5F85\u8865")}</td>
                              <td class="px-3 py-2">${escapeHtml(entry.latestReceipt?.returnWarehouseName || "\u5F85\u8865")}</td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(entry.latestReceipt?.receivedBy || "\u5F85\u8865")}</td>
                              <td class="px-3 py-2 text-xs text-muted-foreground">${escapeHtml(entry.latestReceipt?.note || entry.latestClosure?.reason || "\u65E0")}</td>
                            </tr>
                          `
    ).join("")}
                    </tbody>
                  </table>
                `,
    "max-h-[24vh]"
  )}
            </article>
          ` : ""}
    </section>
  `;
}
function renderTransferBagLogsTab(activeMaster, focusedUsage) {
  void focusedUsage;
  const usageIds = getDetailBagUsages(activeMaster).map((item) => item.usageId);
  const abnormalRecords = getCarrierManagementProjection().abnormalRecords.filter((item) => item.bagCode === activeMaster.bagCode);
  const usageAudits = usageIds.flatMap(
    (usageId) => (getViewModel().auditTrailByUsageId[usageId] || []).map((audit) => ({
      actionAt: audit.actionAt,
      action: audit.action,
      actor: audit.actionBy,
      note: audit.note
    }))
  );
  const returnAudits = usageIds.flatMap(
    (usageId) => (getReturnViewModel().returnAuditTrailByUsageId[usageId] || []).map((audit) => ({
      actionAt: audit.actionAt,
      action: audit.action,
      actor: audit.actionBy,
      note: [audit.payloadSummary, audit.note].filter(Boolean).join("\uFF1B")
    }))
  );
  const logs = usageAudits.concat(returnAudits).sort((left, right) => right.actionAt.localeCompare(left.actionAt, "zh-CN"));
  return `
    <section id="transfer-bag-tabpanel-logs" role="tabpanel" aria-labelledby="transfer-bag-tab-logs" class="space-y-3 rounded-xl border bg-card p-4">
      <div>
        <h2 class="text-sm font-semibold text-foreground">\u5F02\u5E38\u8BB0\u5F55</h2>
        <p class="mt-1 text-sm text-muted-foreground">${escapeHtml(`\u5F53\u524D\u67E5\u770B ${activeMaster.bagCode} \u7684\u5F02\u5E38\u548C\u64CD\u4F5C\u8FFD\u6EAF\u3002`)}</p>
      </div>
      ${abnormalRecords.length ? `<div class="grid gap-3 md:grid-cols-2">
              ${abnormalRecords.map(
    (item) => `
                    <article class="rounded-xl border bg-rose-50/40 px-4 py-3 text-sm">
                      <div class="flex flex-wrap items-center justify-between gap-3">
                        <p class="font-medium text-foreground">${escapeHtml(item.abnormalType)}</p>
                        ${renderTag(item.handlingStatus, "bg-rose-100 text-rose-700 border border-rose-200")}
                      </div>
                      <p class="mt-2 text-sm text-foreground">${escapeHtml(item.description)}</p>
                      <p class="mt-2 text-xs text-muted-foreground">${escapeHtml([item.relatedObjectType, item.relatedObjectId, item.reportedAt].filter(Boolean).join(" / "))}</p>
                    </article>
                  `
  ).join("")}
            </div>` : '<div class="rounded-lg border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">\u5F53\u524D\u4E2D\u8F6C\u888B\u6682\u65E0\u5F02\u5E38\u8BB0\u5F55\u3002</div>'}
      <div class="pt-2 text-sm font-semibold text-foreground">\u64CD\u4F5C\u65E5\u5FD7</div>
      ${logs.length ? `<div class="space-y-2">${logs.map(
    (log) => `
                <article class="rounded-xl border bg-muted/15 px-4 py-3 text-sm">
                  <div class="flex items-center justify-between gap-3">
                    <p class="font-medium text-foreground">${escapeHtml(log.action)}</p>
                    <p class="text-xs text-muted-foreground">${escapeHtml(formatDateTime(log.actionAt))}</p>
                  </div>
                  <p class="mt-1 text-xs text-muted-foreground">${escapeHtml(log.actor)}</p>
                  <p class="mt-2 text-sm text-foreground">${escapeHtml(log.note || "\u65E0\u5907\u6CE8")}</p>
                </article>
              `
  ).join("")}</div>` : '<div class="rounded-lg border border-dashed px-6 py-10 text-center text-sm text-muted-foreground">\u5F53\u524D\u8FD8\u6CA1\u6709\u64CD\u4F5C\u65E5\u5FD7\u3002</div>'}
    </section>
  `;
}
function renderTransferBagDetailTabPanel(activeMaster, focusedUsage, activeTab) {
  if (activeTab === "history") return renderTransferBagHistoryTab(activeMaster, focusedUsage);
  if (activeTab === "recovery") return renderTransferBagRecoveryTab(activeMaster, focusedUsage);
  if (activeTab === "logs") return renderTransferBagLogsTab(activeMaster, focusedUsage);
  return renderTransferBagCurrentTab(activeMaster, focusedUsage);
}
function renderDetailPage() {
  syncPrefilterFromQuery();
  const meta = getCanonicalCuttingMeta(getCurrentTransferBagPathname(), "transfer-bag-detail");
  const activeMaster = getActiveMaster();
  const activeTab = readTransferBagDetailTab();
  const focusedUsage = getDetailFocusedUsage(activeMaster);
  return `
    <div class="space-y-3 p-4">
      <header data-transfer-bag-page-header class="flex items-center justify-between gap-3">
        <h1 class="text-xl font-bold">${escapeHtml(meta.pageTitle)}</h1>
        <button type="button" class="rounded-md border px-3 py-2 text-sm hover:bg-muted" data-nav="${escapeHtml(buildTransferBagListRoute())}">\u8FD4\u56DE\u4E2D\u8F6C\u888B\u6D41\u8F6C</button>
      </header>
      ${renderFeedbackBar()}
      ${activeMaster ? renderTransferBagDetailHeader(activeMaster, focusedUsage) : renderDetailEmptyState()}
      ${activeMaster ? renderTransferBagDetailTabs(activeMaster, focusedUsage, activeTab) : ""}
      ${activeMaster ? renderTransferBagDetailTabPanel(activeMaster, focusedUsage, activeTab) : ""}
    </div>
  `;
}
function syncMasterSelection(masterId) {
  const master = getViewModel().mastersById[masterId];
  if (!master) return;
  state.activeMasterId = masterId;
  state.draft.bagId = master.bagId;
  state.draft.bagCodeInput = master.bagCode;
  if (master.currentUsage) {
    syncUsageSelection(master.currentUsage.usageId);
  }
}
function syncUsageSelection(usageId) {
  const usage = getViewModel().usagesById[usageId];
  if (!usage) return;
  state.activeUsageId = usageId;
  state.activeMasterId = usage.bagId;
  state.draft.bagId = usage.bagId;
  state.draft.bagCodeInput = usage.bagCode;
  state.draft.sewingTaskId = usage.sewingTaskId;
  state.draft.note = usage.note;
  resetReturnDraft(usageId);
}
function buildReturnReceiptFromState(usage, bag) {
  const bindings = getViewModel().bindingsByUsageId[usage.usageId] || [];
  const summary = buildTransferBagParentChildSummary(bindings);
  return {
    returnReceiptId: `return-${usage.usageId}`,
    usageId: usage.usageId,
    usageNo: usage.usageNo,
    bagId: bag.bagId,
    bagCode: bag.bagCode,
    sewingTaskId: usage.sewingTaskId,
    sewingTaskNo: usage.sewingTaskNo,
    returnWarehouseName: state.returnDraft.returnWarehouseName.trim(),
    returnAt: state.returnDraft.returnAt.trim(),
    returnedBy: "",
    receivedBy: state.returnDraft.receivedBy.trim(),
    returnedFinishedQty: summary.quantityTotal,
    returnedTicketCountSummary: bindings.length,
    returnedCutOrderCount: uniqueStrings(bindings.map((item) => item.cutOrderNo)).length,
    discrepancyType: "NONE",
    discrepancyNote: "",
    note: state.returnDraft.note.trim()
  };
}
function buildConditionRecordFromState(usage, bag) {
  return {
    conditionRecordId: `condition-${usage.usageId}`,
    usageId: usage.usageId,
    bagId: bag.bagId,
    bagCode: bag.bagCode,
    conditionStatus: state.conditionDraft.conditionStatus,
    cleanlinessStatus: state.conditionDraft.cleanlinessStatus,
    damageType: state.conditionDraft.damageType.trim(),
    repairNeeded: state.conditionDraft.repairNeeded,
    \u590D\u7528\u5EFA\u8BAE: state.conditionDraft.reusableDecision,
    inspectedAt: nowText(),
    inspectedBy: state.returnDraft.receivedBy.trim() || "\u4E2D\u8F6C\u888B\u5DE5\u4F5C\u53F0",
    note: state.conditionDraft.note.trim()
  };
}
function getFilteredReturnUsages() {
  const keyword = state.returnKeyword.trim().toLowerCase();
  return getReturnViewModel().waitingReturnUsages.filter((item) => {
    const returnStatus = item.latestClosureResult?.closureStatus || item.usageStatus;
    if (state.returnStatus !== "ALL" && returnStatus !== state.returnStatus) return false;
    if (state.prefilter?.returnStatus && returnStatus !== state.prefilter.returnStatus) return false;
    if (keyword) {
      const haystack = [
        item.usageNo,
        item.bagCode,
        item.sewingTaskNo,
        item.sewingFactoryName,
        item.cutOrderNos.join(" "),
        item.ticketNos.join(" ")
      ].join(" ").toLowerCase();
      if (!haystack.includes(keyword)) return false;
    }
    return true;
  });
}
function prepareReturnDraft(targetUsageId) {
  const usage = getSourceUsage(targetUsageId || state.activeUsageId);
  if (!usage) {
    setFeedback("warning", "\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u5F85\u56DE\u4ED3\u4F7F\u7528\u5468\u671F\u3002");
    return true;
  }
  const bag = getSourceMaster(usage.bagId);
  const latestClosure = (getReturnViewModel().closureResultsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.closedAt.localeCompare(left.closedAt, "zh-CN"))[0] || null;
  const eligibility = deriveReturnEligibility({ usage, bag, latestClosureResult: latestClosure });
  if (!eligibility.ok) {
    setFeedback("warning", eligibility.reason);
    return true;
  }
  syncUsageSelection(usage.usageId);
  resetReturnDraft(usage.usageId);
  if (usage.usageStatus === "DISPATCHED" || usage.usageStatus === "PENDING_SIGNOFF") {
    usage.usageStatus = "WAITING_RETURN";
    usage.signoffStatus = "SIGNED";
    usage.signedAt = usage.signedAt || nowText();
    if (bag) {
      bag.currentStatus = "WAITING_RETURN";
      bag.currentLocation = usage.sewingFactoryName || "\u5F85\u56DE\u4ED3\u5DE5\u5382";
    }
    state.store.returnAuditTrail.push(
      buildBagReturnAuditTrail({
        usageId: usage.usageId,
        action: "\u56DE\u6536\u767B\u8BB0",
        actionAt: nowText(),
        actionBy: "\u4E2D\u8F6C\u888B\u5DE5\u4F5C\u53F0",
        payloadSummary: `${usage.usageNo} \u5DF2\u8FDB\u5165\u56DE\u6536\u6D41\u7A0B`,
        note: "\u5DF2\u6253\u5F00\u56DE\u6536\u767B\u8BB0\u8868\u5355\uFF0C\u7B49\u5F85\u586B\u5199\u56DE\u6536\u7ED3\u679C\u3002"
      })
    );
    refreshDerivedState();
    persistStore();
  }
  setFeedback("success", `${usage.usageNo} \u5DF2\u5E26\u5165\u56DE\u8D27\u5DE5\u4F5C\u53F0\u3002`);
  return true;
}
function clearReturnDraft() {
  resetReturnDraft(state.activeUsageId);
  setFeedback("success", "\u56DE\u8D27\u9A8C\u6536\u8349\u7A3F\u5DF2\u91CD\u7F6E\u3002");
  return true;
}
function completeReturnInspection(targetUsageId) {
  const usage = getSourceUsage(targetUsageId || state.activeUsageId);
  if (!usage) {
    setFeedback("warning", "\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u4F7F\u7528\u5468\u671F\uFF0C\u518D\u586B\u5199\u56DE\u8D27\u9A8C\u6536\u4FE1\u606F\u3002");
    return true;
  }
  const bag = getSourceMaster(usage.bagId);
  if (!bag) {
    setFeedback("warning", "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u7F3A\u5C11\u53E3\u888B\u4E3B\u6863\uFF0C\u4E0D\u80FD\u9A8C\u6536\u3002");
    return true;
  }
  const receipt = buildReturnReceiptFromState(usage, bag);
  const validation = validateReturnReceiptPayload({
    usage,
    bag,
    receipt
  });
  if (!validation.ok) {
    setFeedback("warning", validation.reason);
    return true;
  }
  const receiptIndex = state.store.returnReceipts.findIndex((item) => item.usageId === usage.usageId);
  if (receiptIndex >= 0) {
    state.store.returnReceipts[receiptIndex] = receipt;
  } else {
    state.store.returnReceipts.push(receipt);
  }
  usage.usageStatus = "CLOSED";
  usage.signoffStatus = usage.signoffStatus === "SIGNED" ? usage.signoffStatus : "SIGNED";
  usage.returnedAt = receipt.returnAt;
  usage.note = "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u5DF2\u5B8C\u6210\u56DE\u6536\u767B\u8BB0\uFF0C\u53E3\u888B\u5DF2\u8FD4\u56DE\u7A7A\u95F2\u3002";
  bag.currentStatus = "IDLE";
  bag.currentLocation = receipt.returnWarehouseName;
  const closure = {
    closureId: buildCuttingTraceabilityId("closure", receipt.returnAt, usage.usageId),
    cycleId: usage.usageId,
    cycleNo: usage.usageNo,
    usageId: usage.usageId,
    usageNo: usage.usageNo,
    closedAt: receipt.returnAt,
    closedBy: receipt.receivedBy || "\u4E2D\u8F6C\u888B\u5DE5\u4F5C\u53F0",
    closureStatus: "CLOSED",
    nextBagStatus: "IDLE",
    reason: "\u56DE\u6536\u5B8C\u6210\u540E\u5DF2\u76F4\u63A5\u8FD4\u56DE\u7A7A\u95F2\uFF0C\u53EF\u518D\u6B21\u590D\u7528\u3002",
    warningMessages: []
  };
  const closureIndex = state.store.closureResults.findIndex((item) => item.usageId === usage.usageId);
  if (closureIndex >= 0) {
    state.store.closureResults[closureIndex] = closure;
  } else {
    state.store.closureResults.push(closure);
  }
  state.store.returnAuditTrail.push(
    buildBagReturnAuditTrail({
      usageId: usage.usageId,
      action: "\u5B8C\u6210\u56DE\u6536",
      actionAt: receipt.returnAt,
      actionBy: receipt.receivedBy,
      payloadSummary: `${receipt.bagCode} \u5DF2\u5B8C\u6210\u56DE\u6536\u767B\u8BB0`,
      note: receipt.note || "\u56DE\u6536\u5B8C\u6210\u540E\u5DF2\u76F4\u63A5\u8FD4\u56DE\u7A7A\u95F2\u3002"
    })
  );
  refreshDerivedState();
  persistStore();
  setFeedback("success", `${usage.usageNo} \u5DF2\u5B8C\u6210\u56DE\u6536\uFF0C${bag.bagCode} \u5DF2\u8FD4\u56DE\u7A7A\u95F2\u3002`);
  return true;
}
function closeUsageCycleAction(targetUsageId) {
  const usage = getSourceUsage(targetUsageId || state.activeUsageId);
  if (!usage) {
    setFeedback("warning", "\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u4F7F\u7528\u5468\u671F\u3002");
    return true;
  }
  const bag = getSourceMaster(usage.bagId);
  if (!bag) {
    setFeedback("warning", "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u7F3A\u5C11\u53E3\u888B\u4E3B\u6863\uFF0C\u4E0D\u80FD\u5173\u95ED\u3002");
    return true;
  }
  const receipt = (getReturnViewModel().returnReceiptsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.returnAt.localeCompare(left.returnAt, "zh-CN"))[0] || null;
  const condition = (getReturnViewModel().conditionRecordsByUsageId[usage.usageId] || []).slice().sort((left, right) => right.inspectedAt.localeCompare(left.inspectedAt, "zh-CN"))[0] || null;
  if (!receipt || !condition) {
    setFeedback("warning", "\u8BF7\u5148\u5B8C\u6210\u56DE\u8D27\u9A8C\u6536\uFF0C\u518D\u5173\u95ED\u4F7F\u7528\u5468\u671F\u3002");
    return true;
  }
  const closure = closeTransferBagUsageCycle({
    usage,
    bag,
    receipt,
    condition,
    nowText: nowText(),
    closedBy: receipt.receivedBy || "\u4E2D\u8F6C\u888B\u5DE5\u4F5C\u53F0"
  });
  const closureIndex = state.store.closureResults.findIndex((item) => item.usageId === usage.usageId);
  if (closureIndex >= 0) {
    state.store.closureResults[closureIndex] = closure;
  } else {
    state.store.closureResults.push(closure);
  }
  usage.usageStatus = closure.closureStatus;
  usage.note = closure.reason;
  bag.currentStatus = closure.nextBagStatus;
  const nextBagVisibleLabel = ["IDLE", "REUSABLE"].includes(closure.nextBagStatus) ? "\u7A7A\u95F2" : "\u4E0D\u53EF\u7EE7\u7EED\u4F7F\u7528";
  bag.currentLocation = closure.nextBagStatus === "WAITING_CLEANING" ? "\u88C1\u7247\u4ED3\u5F85\u6E05\u6D01\u533A" : closure.nextBagStatus === "WAITING_REPAIR" ? "\u7EF4\u4FEE\u5F85\u5904\u7406\u533A" : closure.nextBagStatus === "DISABLED" ? "\u505C\u7528\u9694\u79BB\u533A" : "\u88C1\u7247\u4ED3\u590D\u7528\u4F4D";
  state.store.returnAuditTrail.push(
    buildBagReturnAuditTrail({
      usageId: usage.usageId,
      action: "\u5173\u95ED\u672C\u6B21\u5468\u8F6C",
      actionAt: closure.closedAt,
      actionBy: closure.closedBy,
      payloadSummary: `${usage.usageNo} \u5DF2\u5173\u95ED\uFF0C\u53E3\u888B -> ${nextBagVisibleLabel}`,
      note: closure.reason
    })
  );
  refreshDerivedState();
  persistStore();
  setFeedback(
    closure.warningMessages.length ? "warning" : "success",
    closure.warningMessages.length ? `${usage.usageNo} \u5DF2\u5F02\u5E38\u5173\u95ED\uFF1A${closure.warningMessages.join("\uFF1B")}` : `${usage.usageNo} \u5DF2\u5173\u95ED\uFF0C${bag.bagCode} \u5DF2\u8FD4\u56DE\u201C${nextBagVisibleLabel}\u201D\u72B6\u6001\u3002`
  );
  return true;
}
function createUsage() {
  setFeedback("warning", "\u5F53\u524D\u65E0\u9700\u624B\u52A8\u521B\u5EFA\u5468\u8F6C\u3002\u8BF7\u76F4\u63A5\u626B\u63CF\u9996\u5F20\u83F2\u7968\uFF0C\u7CFB\u7EDF\u4F1A\u81EA\u52A8\u5F00\u59CB\u672C\u6B21\u5468\u8F6C\u3002");
  return true;
}
function bindTicketByInput() {
  const ticket = getSelectedTicketRecord();
  if (!state.draft.ticketInput.trim()) {
    setFeedback("warning", "\u8BF7\u5148\u626B\u63CF\u83F2\u7968\u3002");
    return true;
  }
  if (!ticket) {
    setFeedback("warning", "\u5F53\u524D\u7968\u53F7\u4E0D\u5B58\u5728\uFF0C\u8BF7\u5148\u786E\u8BA4\u83F2\u7968\u8BB0\u5F55\u3002");
    return true;
  }
  let usage = getSourceUsage(state.activeUsageId);
  if (!usage) {
    usage = ensureUsageAutoCreatedForTicket(ticket);
    if (!usage) return true;
  }
  if (usage.usageStatus === "DISPATCHED" || usage.usageStatus === "PENDING_SIGNOFF") {
    setFeedback("warning", `${usage.usageNo} \u5DF2\u8FDB\u5165\u4EA4\u51FA\u9636\u6BB5\uFF0C\u4E0D\u80FD\u7EE7\u7EED\u4FEE\u6539\u88C5\u888B\u5185\u5BB9\u3002`);
    return true;
  }
  const context = resolveLockedUsageContext(usage, ticket);
  if (!context.ok || !context.sewingTask) {
    setFeedback("warning", context.reason || "\u8BF7\u786E\u8BA4\u888B\u5185\u83F2\u7968\u5C5E\u4E8E\u672C\u6B21\u4EA4\u51FA\u8BB0\u5F55\u3002");
    return true;
  }
  const validation = validateTicketBindingEligibility({
    ticket,
    usage,
    sewingTask: context.sewingTask,
    bindings: state.store.bindings,
    usagesById: Object.fromEntries(state.store.usages.map((item) => [item.usageId, item]))
  });
  if (!validation.ok) {
    setFeedback("warning", validation.reason);
    return true;
  }
  state.store.bindings.push({
    bindingId: buildCuttingTraceabilityId("carrier-bind", nowText(), usage.usageId, ticket.ticketRecordId),
    usageId: usage.usageId,
    usageNo: usage.usageNo,
    cycleId: usage.cycleId,
    bagId: usage.bagId,
    bagCode: usage.bagCode,
    carrierId: usage.carrierId || usage.bagId,
    carrierCode: usage.carrierCode || usage.bagCode,
    feiTicketId: ticket.feiTicketId || ticket.ticketRecordId,
    ticketRecordId: ticket.ticketRecordId,
    ticketNo: ticket.ticketNo,
    cutOrderId: ticket.cutOrderId,
    cutOrderNo: ticket.cutOrderNo,
    markerPlanNo: ticket.markerPlanNo,
    productionOrderNo: ticket.productionOrderNo,
    \u551B\u67B6\u65B9\u6848No: ticket.markerPlanNo,
    qty: ticket.qty,
    garmentQty: ticket.qty,
    boundAt: nowText(),
    boundBy: "\u4E2D\u8F6C\u888B\u5DE5\u4F5C\u53F0",
    operator: "\u4E2D\u8F6C\u888B\u5DE5\u4F5C\u53F0",
    status: "BOUND",
    note: "\u5148\u626B\u4E2D\u8F6C\u888B\u7236\u7801\uFF0C\u518D\u626B\u83F2\u7968\u5B50\u7801\uFF0C\u5DF2\u5EFA\u7ACB\u6B63\u5F0F\u7236\u5B50\u6620\u5C04\u3002"
  });
  if (usage.usageStatus === "DRAFT") {
    usage.usageStatus = "PACKING";
  }
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action: "\u626B\u7801\u88C5\u888B",
      actionAt: nowText(),
      actionBy: "\u4E2D\u8F6C\u888B\u5DE5\u4F5C\u53F0",
      note: `${usage.bagCode} -> ${ticket.ticketNo} \u5DF2\u88C5\u888B\uFF0C\u5E76\u9501\u5B9A\u5230 ${usage.sewingFactoryName} / ${usage.sewingTaskNo}\u3002`
    })
  );
  state.draft.ticketInput = "";
  refreshDerivedState();
  persistStore();
  setFeedback("success", `${ticket.ticketNo} \u5DF2\u88C5\u5165 ${usage.bagCode}\u3002`);
  return true;
}
function importCandidateTickets(targetUsageId) {
  let usage = getSourceUsage(targetUsageId || state.activeUsageId);
  const candidates = getCandidateTickets();
  if (!usage) {
    const firstCandidate = candidates[0];
    if (!firstCandidate) {
      setFeedback("warning", "\u5F53\u524D\u6CA1\u6709\u53EF\u5BFC\u5165\u7684\u5019\u9009\u83F2\u7968\u3002");
      return true;
    }
    usage = ensureUsageAutoCreatedForTicket(firstCandidate);
    if (!usage) return true;
  }
  const context = resolveLockedUsageContext(usage, null);
  if (!context.ok || !context.sewingTask) {
    setFeedback("warning", context.reason || "\u5F53\u524D\u5468\u8F6C\u4E0A\u4E0B\u6587\u4E0D\u5B8C\u6574\uFF0C\u4E0D\u80FD\u5BFC\u5165\u5019\u9009\u83F2\u7968\u3002");
    return true;
  }
  if (!candidates.length) {
    setFeedback("warning", "\u5F53\u524D\u6CA1\u6709\u53EF\u5BFC\u5165\u7684\u5019\u9009\u83F2\u7968\u3002");
    return true;
  }
  let successCount = 0;
  const failedIds = [];
  const failedReasons = [];
  candidates.forEach((ticket) => {
    const validation = validateTicketBindingEligibility({
      ticket,
      usage,
      sewingTask: context.sewingTask,
      bindings: state.store.bindings,
      usagesById: Object.fromEntries(state.store.usages.map((item) => [item.usageId, item]))
    });
    if (!validation.ok) {
      failedIds.push(ticket.ticketRecordId);
      failedReasons.push(`${ticket.ticketNo}\uFF1A${validation.reason}`);
      return;
    }
    state.store.bindings.push({
      bindingId: buildCuttingTraceabilityId("carrier-bind", nowText(), usage.usageId, ticket.ticketRecordId, String(successCount + 1)),
      usageId: usage.usageId,
      usageNo: usage.usageNo,
      cycleId: usage.cycleId,
      bagId: usage.bagId,
      bagCode: usage.bagCode,
      carrierId: usage.carrierId || usage.bagId,
      carrierCode: usage.carrierCode || usage.bagCode,
      feiTicketId: ticket.feiTicketId || ticket.ticketRecordId,
      ticketRecordId: ticket.ticketRecordId,
      ticketNo: ticket.ticketNo,
      cutOrderId: ticket.cutOrderId,
      cutOrderNo: ticket.cutOrderNo,
      markerPlanNo: ticket.markerPlanNo,
      productionOrderNo: ticket.productionOrderNo,
      \u551B\u67B6\u65B9\u6848No: ticket.markerPlanNo,
      qty: ticket.qty,
      garmentQty: ticket.qty,
      boundAt: nowText(),
      boundBy: "\u4E2D\u8F6C\u888B\u5DE5\u4F5C\u53F0",
      operator: "\u4E2D\u8F6C\u888B\u5DE5\u4F5C\u53F0",
      status: "BOUND",
      note: "\u901A\u8FC7\u5019\u9009\u83F2\u7968\u6279\u91CF\u5EFA\u7ACB\u6B63\u5F0F\u7236\u5B50\u6620\u5C04\u3002"
    });
    if (usage.usageStatus === "DRAFT") {
      usage.usageStatus = "PACKING";
    }
    successCount += 1;
  });
  if (successCount) {
    state.store.auditTrail.push(
      buildBagUsageAuditTrail({
        usageId: usage.usageId,
        action: "\u5BFC\u5165\u5019\u9009\u83F2\u7968",
        actionAt: nowText(),
        actionBy: "\u4E2D\u8F6C\u888B\u5DE5\u4F5C\u53F0",
        note: `${usage.bagCode} \u6279\u91CF\u5BFC\u5165 ${successCount} \u5F20\u83F2\u7968\u3002`
      })
    );
  }
  state.preselectedTicketRecordIds = failedIds;
  persistSelectedTicketIds();
  refreshDerivedState();
  persistStore();
  if (failedReasons.length) {
    setFeedback("warning", `\u5DF2\u5BFC\u5165 ${successCount} \u5F20\uFF0C\u4ECD\u6709 ${failedReasons.length} \u5F20\u5F85\u5904\u7406\uFF1A${failedReasons.join("\uFF1B")}`);
  } else {
    setFeedback("success", `${usage.usageNo} \u5DF2\u5BFC\u5165 ${successCount} \u5F20\u5019\u9009\u83F2\u7968\u3002`);
  }
  return true;
}
function removeBinding(bindingId) {
  if (!bindingId) return false;
  const binding = state.store.bindings.find((item) => item.bindingId === bindingId);
  if (!binding) return false;
  const usage = getSourceUsage(binding.usageId);
  if (usage && (usage.usageStatus === "DISPATCHED" || usage.usageStatus === "PENDING_SIGNOFF")) {
    setFeedback("warning", `${usage.usageNo} \u5DF2\u8FDB\u5165\u4EA4\u51FA\u540E\u9636\u6BB5\uFF0C\u4E0D\u80FD\u79FB\u9664\u888B\u5185\u6620\u5C04\u3002`);
    return true;
  }
  state.store.bindings = state.store.bindings.filter((item) => item.bindingId !== bindingId);
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: binding.usageId,
      action: "\u79FB\u9664\u7ED1\u5B9A",
      actionAt: nowText(),
      actionBy: "\u4E2D\u8F6C\u888B\u5DE5\u4F5C\u53F0",
      note: `${binding.ticketNo} \u5DF2\u4ECE ${binding.bagCode} \u4E2D\u79FB\u9664\u3002`
    })
  );
  refreshDerivedState();
  persistStore();
  setFeedback("success", `${binding.ticketNo} \u5DF2\u79FB\u9664\u3002`);
  return true;
}
function printManifest(usageId) {
  if (!usageId) return false;
  const usage = getViewModel().usagesById[usageId];
  if (!usage) return false;
  const bindings = getViewModel().bindingsByUsageId[usageId] || [];
  if (!bindings.length) {
    setFeedback("warning", `${usage.usageNo} \u8FD8\u6CA1\u6709\u88C5\u5165\u4EFB\u4F55\u83F2\u7968\uFF0C\u4E0D\u80FD\u6253\u5370\u6D41\u8F6C\u6E05\u5355\u3002`);
    return true;
  }
  const manifest = createTransferBagDispatchManifest({
    usage,
    summary: buildTransferBagParentChildSummary(bindings),
    nowText: nowText(),
    createdBy: "\u4E2D\u8F6C\u888B\u5DE5\u4F5C\u53F0"
  });
  state.store.manifests.push(manifest);
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId,
      action: "\u6253\u5370\u88C5\u888B\u6E05\u5355",
      actionAt: manifest.createdAt,
      actionBy: manifest.createdBy,
      note: `${usage.bagCode} \u5F53\u524D\u5DF2\u6253\u5370\u88C5\u888B\u6E05\u5355\u3002`
    })
  );
  refreshDerivedState();
  persistStore();
  appStore.navigate(buildTransferBagLabelPrintLink(usageId));
  setFeedback("success", `${usage.usageNo} \u7684\u4E2D\u8F6C\u888B\u4E8C\u7EF4\u7801\u5DF2\u8FDB\u5165\u7EDF\u4E00\u6253\u5370\u9884\u89C8\u3002`);
  return true;
}
function updateUsageStatus(usageId, nextStatus) {
  if (!usageId) return false;
  const usage = getSourceUsage(usageId);
  if (!usage) return false;
  if (!usage.packedTicketCount && nextStatus !== "DRAFT") {
    setFeedback("warning", `${usage.usageNo} \u5C1A\u672A\u88C5\u5165\u83F2\u7968\uFF0C\u4E0D\u80FD\u8FDB\u5165\u540E\u7EED\u6D41\u8F6C\u72B6\u6001\u3002`);
    return true;
  }
  if (nextStatus === "DISPATCHED" && !["READY_TO_DISPATCH", "DISPATCHED"].includes(usage.usageStatus)) {
    setFeedback("warning", `${usage.usageNo} \u9700\u5148\u5B8C\u6210\u88C5\u888B\uFF0C\u518D\u6807\u8BB0\u53D1\u51FA\u3002`);
    return true;
  }
  if (nextStatus === "WAITING_RETURN" && !["DISPATCHED", "PENDING_SIGNOFF", "WAITING_RETURN"].includes(usage.usageStatus)) {
    setFeedback("warning", `${usage.usageNo} \u5F53\u524D\u8FD8\u4E0D\u80FD\u7B7E\u6536\uFF0C\u8BF7\u5148\u5B8C\u6210\u53D1\u51FA\u3002`);
    return true;
  }
  const currentSummary = buildTransferBagParentChildSummary(state.store.bindings.filter((item) => item.usageId === usage.usageId));
  usage.usageStatus = nextStatus;
  if (nextStatus === "READY_TO_DISPATCH") {
    usage.finishedPackingAt = nowText();
    usage.note = "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u5DF2\u5B8C\u6210\u6838\u5BF9\uFF0C\u7B49\u5F85\u4EA4\u51FA\u3002";
  }
  if (nextStatus === "DISPATCHED") {
    usage.dispatchAt = nowText();
    usage.dispatchBy = "\u4E2D\u8F6C\u888B\u5DE5\u4F5C\u53F0";
    usage.signoffStatus = "WAITING";
    usage.note = `\u5F53\u524D\u4F7F\u7528\u5468\u671F\u5DF2\u4EA4\u51FA\uFF0C\u5171 ${currentSummary.ticketCount} \u5F20\u83F2\u7968\u3002`;
  }
  if (nextStatus === "WAITING_RETURN") {
    usage.signoffStatus = "SIGNED";
    usage.signedAt = nowText();
    usage.note = "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u5DF2\u5B8C\u6210\u7B7E\u6536\uFF0C\u7B49\u5F85\u56DE\u4ED3\u9A8C\u6536\u3002";
  }
  if (nextStatus === "PENDING_SIGNOFF") {
    usage.signoffStatus = "WAITING";
    usage.note = "\u5F53\u524D\u4F7F\u7528\u5468\u671F\u7B49\u5F85\u540E\u9053\u7B7E\u6536\uFF0C\u56DE\u8D27\u4E0E\u590D\u7528\u5C06\u5728\u4E0B\u4E00\u6B65\u5904\u7406\u3002";
  }
  state.store.auditTrail.push(
    buildBagUsageAuditTrail({
      usageId: usage.usageId,
      action: nextStatus === "READY_TO_DISPATCH" ? "\u5B8C\u6210\u88C5\u888B" : nextStatus === "DISPATCHED" ? "\u4EA4\u51FA" : nextStatus === "WAITING_RETURN" ? "\u6807\u8BB0\u5DF2\u7B7E\u6536" : "\u6807\u8BB0\u5F85\u7B7E\u6536",
      actionAt: nowText(),
      actionBy: "\u4E2D\u8F6C\u888B\u5DE5\u4F5C\u53F0",
      note: `${usage.usageNo} \u5DF2\u66F4\u65B0\u4E3A ${nextStatus === "DISPATCHED" ? "\u5DF2\u4EA4\u51FA" : deriveTransferBagUsageStatus(nextStatus).label}\u3002`
    })
  );
  refreshDerivedState();
  persistStore();
  setFeedback("success", `${usage.usageNo} \u5DF2\u66F4\u65B0\u4E3A\u201C${nextStatus === "DISPATCHED" ? "\u5DF2\u4EA4\u51FA" : deriveTransferBagUsageStatus(nextStatus).label}\u201D\u3002`);
  return true;
}
function clearDraft() {
  state.draft = {
    bagId: "",
    bagCodeInput: "",
    sewingTaskId: "",
    ticketInput: "",
    note: ""
  };
  setFeedback("success", "\u88C5\u888B\u5DE5\u4F5C\u53F0\u5DF2\u6E05\u7A7A\u3002");
  return true;
}
function clearPrefill() {
  state.prefilter = null;
  state.drillContext = null;
  state.landingBanner = null;
  state.preselectedTicketRecordIds = [];
  state.returnStatus = "ALL";
  persistSelectedTicketIds();
  state.querySignature = getCanonicalCuttingPath("transfer-bags");
  appStore.navigate(getCanonicalCuttingPath("transfer-bags"));
  return true;
}
function navigateByPayload(payload, path) {
  const targetMap = {
    [getCanonicalCuttingPath("cut-orders")]: "cutOrders",
    [getCanonicalCuttingPath("summary")]: "summary",
    [getCanonicalCuttingPath("fei-tickets")]: "feiTickets",
    [getCanonicalCuttingPath("cut-piece-warehouse")]: "cutPieceWarehouse"
  };
  const target = targetMap[path];
  if (target) {
    const context = buildCuttingDrillContext(payload, "transfer-bags", {
      autoOpenDetail: true,
      bagCode: payload.bagCode,
      usageNo: payload.usageNo,
      cutOrderNo: payload.cutOrderNo,
      markerPlanNo: payload.markerPlanNo || payload["\u551B\u67B6\u65B9\u6848No"],
      ticketNo: payload.ticketNo,
      productionOrderNo: payload.productionOrderNo
    });
    appStore.navigate(buildCuttingRouteWithContext(target, context));
    return true;
  }
  appStore.navigate(path);
  return true;
}
function renderCraftCuttingTransferBagsPage() {
  return renderListPage();
}
function renderCraftCuttingTransferBagDetailPage() {
  return renderDetailPage();
}
function handleCraftCuttingTransferBagsEvent(target) {
  const masterFieldNode = target.closest("[data-transfer-bags-master-field]");
  if (masterFieldNode) {
    const field = masterFieldNode.dataset.transferBagsMasterField;
    if (!field) return false;
    const input = masterFieldNode;
    if (field === "keyword") {
      state.masterKeyword = input.value;
      resetMasterPagination();
    }
    if (field === "status") {
      state.masterStatus = input.value;
      resetMasterPagination();
    }
    return true;
  }
  const masterPageSizeNode = target.closest("[data-transfer-bags-master-page-size]");
  if (masterPageSizeNode) {
    const input = masterPageSizeNode;
    const nextPageSize = Number.parseInt(input.value || "10", 10);
    state.masterPageSize = Number.isFinite(nextPageSize) && nextPageSize > 0 ? nextPageSize : 10;
    resetMasterPagination();
    return true;
  }
  const usageFieldNode = target.closest("[data-transfer-bags-usage-field]");
  if (usageFieldNode) {
    const field = usageFieldNode.dataset.transferBagsUsageField;
    if (!field) return false;
    const input = usageFieldNode;
    if (field === "keyword") state.usageKeyword = input.value;
    if (field === "status") state.usageStatus = input.value;
    if (field === "sewingTask") state.usageSewingTaskId = input.value;
    return true;
  }
  const workbenchFieldNode = target.closest("[data-transfer-bags-workbench-field]");
  if (workbenchFieldNode) {
    const field = workbenchFieldNode.dataset.transferBagsWorkbenchField;
    if (!field) return false;
    const input = workbenchFieldNode;
    state.draft = {
      ...state.draft,
      [field]: input.value
    };
    return true;
  }
  const bindingFieldNode = target.closest("[data-transfer-bags-binding-field]");
  if (bindingFieldNode) {
    const input = bindingFieldNode;
    state.bindingKeyword = input.value;
    return true;
  }
  const returnFieldNode = target.closest("[data-transfer-bags-return-field]");
  if (returnFieldNode) {
    const field = returnFieldNode.dataset.transferBagsReturnField;
    if (!field) return false;
    const input = returnFieldNode;
    if (field === "keyword") state.returnKeyword = input.value;
    if (field === "status") state.returnStatus = input.value;
    return true;
  }
  const returnDraftFieldNode = target.closest("[data-transfer-bags-return-draft-field]");
  if (returnDraftFieldNode) {
    const field = returnDraftFieldNode.dataset.transferBagsReturnDraftField;
    if (!field) return false;
    const input = returnDraftFieldNode;
    state.returnDraft = {
      ...state.returnDraft,
      [field]: input.value
    };
    return true;
  }
  const conditionFieldNode = target.closest("[data-transfer-bags-condition-field]");
  if (conditionFieldNode) {
    const field = conditionFieldNode.dataset.transferBagsConditionField;
    if (!field) return false;
    const input = conditionFieldNode;
    state.conditionDraft = {
      ...state.conditionDraft,
      [field]: input.value
    };
    if (field !== "reusableDecision" && field !== "note") {
      syncReusableDecisionSuggestion();
    }
    return true;
  }
  const conditionToggleNode = target.closest("[data-transfer-bags-condition-toggle]");
  if (conditionToggleNode) {
    const field = conditionToggleNode.dataset.transferBagsConditionToggle;
    if (field === "repairNeeded") {
      state.conditionDraft = {
        ...state.conditionDraft,
        repairNeeded: conditionToggleNode.checked
      };
      syncReusableDecisionSuggestion();
      return true;
    }
  }
  const actionNode = target.closest("[data-transfer-bags-action]");
  const action = actionNode?.dataset.transferBagsAction;
  if (!action) return false;
  if (action === "clear-prefill") return clearPrefill();
  if (action === "set-master-status") {
    state.masterStatus = actionNode.dataset.status || "ALL";
    resetMasterPagination();
    return true;
  }
  if (action === "set-master-page") {
    const nextPage = Number.parseInt(actionNode.dataset.page || "1", 10);
    state.masterPage = Number.isFinite(nextPage) && nextPage > 0 ? nextPage : 1;
    return true;
  }
  if (action === "clear-draft") return clearDraft();
  if (action === "match-bag-code") {
    const matched = getSelectedBag();
    if (!matched) {
      setFeedback("warning", "\u672A\u5339\u914D\u5230\u8BE5\u4E2D\u8F6C\u888B\u7801\uFF0C\u8BF7\u68C0\u67E5\u8F7D\u5177\u7F16\u7801\u3002");
      return true;
    }
    syncMasterSelection(matched.bagId);
    const masterItem = getViewModel().mastersById[matched.bagId];
    if (masterItem?.pocketStatusKey === "IDLE") {
      setFeedback("success", `${matched.bagCode} \u5DF2\u5E26\u5165\u88C5\u888B\u5DE5\u4F5C\u53F0\uFF0C\u53EF\u5F00\u59CB\u672C\u6B21\u88C5\u888B\u3002`);
    } else if (masterItem?.pocketStatusKey === "PACKING") {
      setFeedback("success", `${matched.bagCode} \u5DF2\u8FDB\u5165\u5F53\u524D\u4F7F\u7528\u5468\u671F\uFF0C\u53EF\u7EE7\u7EED\u88C5\u888B\u3002`);
    } else {
      setFeedback("warning", `${matched.bagCode} \u5F53\u524D\u72B6\u6001\u4E3A\u201C${masterItem?.pocketStatusMeta.label || "\u5F85\u8865"}\u201D\uFF0C\u5DF2\u5E26\u5165\u8BE6\u60C5\u4E0E\u5F53\u524D\u4F7F\u7528\u5468\u671F\u3002`);
    }
    return true;
  }
  if (action === "set-ticket-input") {
    state.draft.ticketInput = actionNode.dataset.ticketNo ?? "";
    return true;
  }
  if (action === "select-master") {
    const bagId = actionNode.dataset.bagId;
    if (!bagId) return false;
    syncMasterSelection(bagId);
    return true;
  }
  if (action === "use-master") {
    const bagId = actionNode.dataset.bagId;
    if (!bagId) return false;
    syncMasterSelection(bagId);
    const masterItem = getViewModel().mastersById[bagId];
    setFeedback("success", `\u5DF2\u5207\u6362\u5230 ${masterItem?.bagCode || "\u5F53\u524D\u53E3\u888B"}\uFF0C\u5F53\u524D\u72B6\u6001\uFF1A${masterItem?.pocketStatusMeta.label || "\u5F85\u8865"}\u3002`);
    return true;
  }
  if (action === "select-usage") {
    const usageId = actionNode.dataset.usageId;
    if (!usageId) return false;
    syncUsageSelection(usageId);
    return true;
  }
  if (action === "create-usage") return createUsage();
  if (action === "bind-ticket") return bindTicketByInput();
  if (action === "import-prefill") return importCandidateTickets();
  if (action === "remove-binding") return removeBinding(actionNode.dataset.bindingId);
  if (action === "print-manifest") return printManifest(actionNode.dataset.usageId || state.activeUsageId || void 0);
  if (action === "mark-ready") return updateUsageStatus(actionNode.dataset.usageId || state.activeUsageId || void 0, "READY_TO_DISPATCH");
  if (action === "mark-dispatched") return updateUsageStatus(actionNode.dataset.usageId || state.activeUsageId || void 0, "DISPATCHED");
  if (action === "mark-signed") return updateUsageStatus(actionNode.dataset.usageId || state.activeUsageId || void 0, "WAITING_RETURN");
  if (action === "mark-pending-signoff") return updateUsageStatus(actionNode.dataset.usageId || state.activeUsageId || void 0, "PENDING_SIGNOFF");
  if (action === "complete-return-inspection") return completeReturnInspection(actionNode.dataset.usageId || state.activeUsageId || void 0);
  if (action === "go-cut-piece-warehouse-index") {
    appStore.navigate(getCanonicalCuttingPath("cut-piece-warehouse"));
    return true;
  }
  if (action === "go-fei-tickets-index") {
    appStore.navigate(getCanonicalCuttingPath("fei-tickets"));
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
  if (action === "go-cut-orders") {
    const usage = getViewModel().usagesById[actionNode.dataset.usageId || state.activeUsageId || ""];
    if (!usage) return false;
    return navigateByPayload(usage.navigationPayload.cutOrders, getCanonicalCuttingPath("cut-orders"));
  }
  if (action === "go-summary") {
    const usage = getViewModel().usagesById[actionNode.dataset.usageId || state.activeUsageId || ""];
    if (!usage) return false;
    return navigateByPayload(usage.navigationPayload.summary, getCanonicalCuttingPath("summary"));
  }
  return false;
}
export {
  handleCraftCuttingTransferBagsEvent,
  renderCraftCuttingTransferBagDetailPage,
  renderCraftCuttingTransferBagsPage
};
