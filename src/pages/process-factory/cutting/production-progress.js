import { renderDrawer as uiDrawer } from "../../../components/ui/index.ts";
import { appStore } from "../../../state/store.ts";
import { escapeHtml } from "../../../utils.ts";
import { formatFactoryDisplayName } from "../../../data/fcs/factory-mock-data.ts";
import {
  CUTTING_REPLENISHMENT_PENDING_PREP_STORAGE_KEY,
  deserializeReplenishmentPendingPrepStorage
} from "../../../data/fcs/cutting/storage/replenishment-storage.ts";
import { getCanonicalCuttingMeta, getCanonicalCuttingPath, isCuttingAliasPath, renderCuttingPageHeader } from "./meta.ts";
import {
  buildProductionProgressSummary,
  configMeta,
  filterProductionProgressRows,
  formatQty,
  receiveMeta,
  riskMeta,
  shipDeltaRangeMeta,
  sortProductionProgressRows,
  stageMeta,
  urgencyMeta
} from "./production-progress-model.ts";
import {
  paginateItems,
  renderCompactKpiCard,
  renderStickyFilterShell,
  renderStickyTableScroller,
  renderWorkbenchFilterChip,
  renderWorkbenchPagination,
  renderWorkbenchStateBar
} from "./layout.helpers.ts";
import { renderMaterialIdentityBlock } from "./material-identity.ts";
import {
  buildCuttingDrillChipLabels,
  buildCuttingDrillSummary,
  buildCuttingRouteWithContext,
  buildReturnToSummaryContext,
  buildCuttingDrillContext,
  readCuttingDrillContextFromLocation
} from "./navigation-context.ts";
import { buildProductionProgressProjection } from "./production-progress-projection.ts";
import {
  getCuttingProgressSnapshots,
  getCuttingSpecialCraftReturnStatusByProductionOrders
} from "../../../data/fcs/progress-statistics-linkage.ts";
import {
  getCuttingSewingDispatchProgressByProductionOrder as getRuntimeSewingDispatchProgressByProductionOrder,
  listAvailableCutPieceInventoryForSewingDispatch,
  listCuttingSewingDispatchBatches,
  listCuttingSewingDispatchOrders,
  listCuttingSewingTransferBags
} from "../../../data/fcs/cutting/sewing-dispatch.ts";
import {
  listMaterialLedgerProjectionsByProductionOrderId
} from "../../../data/fcs/cutting/material-ledger.ts";
import { listSpreadingDifferencesByProductionOrder } from "../../../data/fcs/cutting/spreading-differences.ts";
import { buildMarkerSpreadingProjection } from "./marker-spreading-projection.ts";
const FIELD_TO_FILTER_KEY = {
  keyword: "keyword",
  "production-order": "productionOrderNo",
  urgency: "urgencyLevel",
  "ship-delta": "shipDeltaRange",
  stage: "currentStage",
  completion: "completionState",
  config: "configStatus",
  claim: "receiveStatus",
  risk: "riskFilter",
  sort: "sortBy"
};
const initialFilters = {
  keyword: "",
  productionOrderNo: "",
  urgencyLevel: "ALL",
  shipDeltaRange: "ALL",
  currentStage: "ALL",
  completionState: "ALL",
  configStatus: "ALL",
  receiveStatus: "ALL",
  riskFilter: "ALL",
  sortBy: "URGENCY_THEN_SHIP"
};
const state = {
  filters: { ...initialFilters },
  viewDimension: "CUT_ORDER",
  activeQuickFilter: null,
  activeDetailId: null,
  drillContext: null,
  querySignature: "",
  page: 1,
  pageSize: 20
};
function getAllRows() {
  return buildProductionProgressProjection().rows;
}
function buildStateBadgeClass(label) {
  if (label.includes("\u5DF2") || label.includes("\u6838\u5BF9") || label.includes("\u53EF\u53D1")) {
    return "bg-emerald-100 text-emerald-700";
  }
  if (label.includes("\u5DEE\u5F02") || label.includes("\u5F02\u8BAE") || label.includes("\u5F02\u5E38")) {
    return "bg-rose-100 text-rose-700";
  }
  if (label.includes("\u52A0\u5DE5\u4E2D") || label.includes("\u8FDB\u884C\u4E2D") || label.includes("\u90E8\u5206") || label.includes("\u56DE\u5199")) {
    return "bg-blue-100 text-blue-700";
  }
  return "bg-amber-100 text-amber-700";
}
function getCuttingSnapshotForRow(row) {
  return getCuttingProgressSnapshots().find((item) => item.productionOrderId === row.productionOrderId);
}
function makePartFlowKey(input) {
  return [input.color || "", input.size || input.sizeCode || "", input.partName || ""].map((item) => String(item || "").trim().toLowerCase()).join("::");
}
function createEmptyPartFlowLine(row, input) {
  const color = input.color || "";
  const size = input.size || input.sizeCode || "";
  const partName = input.partName || "\u88C1\u7247";
  return {
    lineId: `${row.productionOrderId}::${makePartFlowKey({ color, size, partName })}`,
    skuLabel: input.skuLabel || [color, size].filter(Boolean).join(" / ") || "\u672A\u547D\u540D SKU",
    color,
    size,
    partName,
    requiredPieceQty: 0,
    actualCutQty: 0,
    waitHandoverStockQty: 0,
    assignedPieceQty: 0,
    handedOverPieceQty: 0,
    gapPieceQty: 0,
    sourceCutOrderNo: input.sourceCutOrderNo || ""
  };
}
function buildProductionPartFlowLines(row) {
  const grouped = /* @__PURE__ */ new Map();
  const upsert = (input) => {
    const key = makePartFlowKey(input);
    const current = grouped.get(key) || createEmptyPartFlowLine(row, input);
    grouped.set(key, current);
    return current;
  };
  row.pieceTruth.gapRows.forEach((item) => {
    const current = upsert({
      color: item.color,
      size: item.size,
      partName: item.partName,
      skuLabel: item.skuCode || [item.color, item.size].filter(Boolean).join(" / "),
      sourceCutOrderNo: resolveGapRowCutOrderNo(row, item)
    });
    current.requiredPieceQty += Number(item.requiredPieceQty || 0);
    current.actualCutQty += Number(item.actualCutQty || 0);
    current.sourceCutOrderNo = current.sourceCutOrderNo || resolveGapRowCutOrderNo(row, item);
  });
  listAvailableCutPieceInventoryForSewingDispatch({ productionOrderId: row.productionOrderId }).forEach((item) => {
    const current = upsert({
      color: item.colorName,
      size: item.sizeCode,
      partName: item.partName,
      skuLabel: [item.colorName, item.sizeCode].filter(Boolean).join(" / "),
      sourceCutOrderNo: item.cutOrderNos.join("\u3001")
    });
    current.waitHandoverStockQty += Number(item.availablePieceQty || 0);
    current.sourceCutOrderNo = current.sourceCutOrderNo || item.cutOrderNos.join("\u3001");
  });
  const handoverBagStatuses = /* @__PURE__ */ new Set(["\u5DF2\u4EA4\u51FA", "\u5DF2\u56DE\u5199", "\u5DEE\u5F02", "\u5F02\u8BAE\u4E2D"]);
  listCuttingSewingTransferBags().filter((bag) => bag.productionOrderId === row.productionOrderId).forEach((bag) => {
    const isHandedOver = handoverBagStatuses.has(bag.status);
    bag.pieceLines.forEach((line) => {
      const current = upsert({
        color: line.colorName,
        size: line.sizeCode,
        partName: line.partName,
        skuLabel: [line.colorName, line.sizeCode].filter(Boolean).join(" / "),
        sourceCutOrderNo: bag.cuttingOrderNos.join("\u3001")
      });
      current.assignedPieceQty += Number(line.scannedPieceQty || 0);
      if (isHandedOver) current.handedOverPieceQty += Number(line.scannedPieceQty || 0);
    });
  });
  return Array.from(grouped.values()).map((item) => {
    const availableAfterCut = Math.max(item.actualCutQty, item.waitHandoverStockQty + item.assignedPieceQty);
    return {
      ...item,
      gapPieceQty: item.requiredPieceQty > 0 ? Math.max(item.requiredPieceQty - availableAfterCut, 0) : 0
    };
  }).sort(
    (left, right) => `${left.skuLabel}-${left.partName}`.localeCompare(`${right.skuLabel}-${right.partName}`, "zh-CN")
  );
}
function formatBundleSummary(lengthValues, widthValues) {
  if (!lengthValues.length && !widthValues.length) return "";
  const lengthText = lengthValues.length ? `\u957F ${lengthValues.join(" / ")} \u5398\u7C73` : "";
  const widthText = widthValues.length ? `\u5BBD ${widthValues.join(" / ")} \u5398\u7C73` : "";
  return [lengthText, widthText].filter(Boolean).join(" \xB7 ");
}
function getCutOrderRelatedQty(row, cutOrderNo, materialSku) {
  const skuQtyMap = /* @__PURE__ */ new Map();
  row.pieceTruth.requirementRows.filter((item) => item.cutOrderNo === cutOrderNo && item.materialSku === materialSku).forEach((item) => {
    const skuKey = [item.skuCode, item.color, item.size].join("::");
    const current = skuQtyMap.get(skuKey) || 0;
    skuQtyMap.set(skuKey, Math.max(current, item.requiredGarmentQty));
  });
  return Array.from(skuQtyMap.values()).reduce((sum, value) => sum + value, 0);
}
function findProgressMaterialIdentity(row, materialSku) {
  return row.materialPrepLines.find((line) => line.materialSku === materialSku) || row.materialClaimLines.find((line) => line.materialSku === materialSku) || row.sourceOrderProgressLines.find((line) => line.materialSku === materialSku) || null;
}
function buildMaterialQuantityLedgerLines(row, cutOrderNo, materialSku) {
  return listMaterialLedgerProjectionsByProductionOrderId(row.productionOrderId).filter((line) => !cutOrderNo || line.cutOrderNo === cutOrderNo || line.cutOrderId === cutOrderNo).filter((line) => !materialSku || line.materialIdentity.materialSku === materialSku).sort((left, right) => left.materialIdentity.materialSku.localeCompare(right.materialIdentity.materialSku, "zh-CN"));
}
function getSpreadingOrderSummaryForProductionOrder(row, projection = buildMarkerSpreadingProjection()) {
  const byId = projection.spreadingOrdersByProductionOrderId[row.productionOrderId] || [];
  const byNo = projection.spreadingOrders.filter((order) => order.productionOrderNos.includes(row.productionOrderNo));
  const orders = Array.from(new Map([...byId, ...byNo].map((order) => [order.spreadingOrderId, order])).values());
  return {
    orders,
    markerPlanCount: new Set(orders.map((order) => order.markerPlanId)).size,
    waitingSpreadingCount: orders.filter((order) => order.status === "WAITING_SPREADING").length,
    spreadingCount: orders.filter((order) => order.status === "SPREADING").length,
    cutDoneCount: orders.filter((order) => order.status === "CUT_DONE").length
  };
}
function buildEmptyMaterialQuantityLedger(materialSku) {
  return {
    cutOrderId: "",
    cutOrderNo: "",
    productionOrderId: "",
    productionOrderNo: "",
    materialIdentity: {
      materialSku,
      materialName: "\u88C1\u7247\u5355\u9762\u6599",
      materialColor: "",
      materialAlias: "",
      materialImageUrl: "",
      materialUnit: "\u7C73"
    },
    patternIdentity: {
      patternFileId: "",
      patternFileName: "",
      patternVersion: "",
      patternKind: "",
      effectiveWidthValue: 0,
      effectiveWidthUnit: "cm",
      piecePartCodes: [],
      piecePartNames: []
    },
    requiredMaterialQty: 0,
    transferWarehouseAllocatedQty: 0,
    cuttingClaimedQty: 0,
    markerLockedQty: 0,
    spreadingConsumedQty: 0,
    returnedQty: 0,
    adjustmentQty: 0,
    availableQty: 0,
    unit: "\u7C73",
    latestClaimEvent: null,
    events: []
  };
}
function buildCutOrderDimensionRows(rows) {
  const snapshotMap = new Map(getCuttingProgressSnapshots().map((item) => [item.productionOrderId, item]));
  return rows.flatMap((row) => {
    const snapshot = snapshotMap.get(row.productionOrderId);
    return row.sourceOrderProgressLines.map((sourceLine) => {
      const specialCraftDetailParts = [
        snapshot?.specialCraftCurrentQty ? `\u5F53\u524D ${formatQty(snapshot.specialCraftCurrentQty)}` : "",
        snapshot?.specialCraftScrapQty ? `\u62A5\u5E9F ${formatQty(snapshot.specialCraftScrapQty)}` : "",
        snapshot?.specialCraftDamageQty ? `\u8D27\u635F ${formatQty(snapshot.specialCraftDamageQty)}` : "",
        snapshot?.specialCraftDifferenceWarning ? "\u5DEE\u5F02\u9884\u8B66" : "",
        snapshot ? formatBundleSummary(snapshot.bundleLengthCmValues, snapshot.bundleWidthCmValues) : ""
      ].filter(Boolean);
      const sewingDispatchDetailParts = [
        snapshot?.transferBagPackStatus ? `\u88C5\u888B ${snapshot.transferBagPackStatus}` : "",
        snapshot?.transferBagCombinedWritebackStatus ? `\u56DE\u5199 ${snapshot.transferBagCombinedWritebackStatus}` : "",
        snapshot?.transferBagBagDifferenceCount ? `\u888B\u5DEE\u5F02 ${snapshot.transferBagBagDifferenceCount}` : "",
        snapshot?.transferBagFeiTicketDifferenceCount ? `\u83F2\u7968\u5DEE\u5F02 ${snapshot.transferBagFeiTicketDifferenceCount}` : ""
      ].filter(Boolean);
      const quantityLedger = buildMaterialQuantityLedgerLines(row, sourceLine.cutOrderNo, sourceLine.materialSku)[0] || buildEmptyMaterialQuantityLedger(sourceLine.materialSku);
      const spreadingDifferences = listSpreadingDifferencesByProductionOrder(row.productionOrderId).filter(
        (difference) => (difference.cutOrderNos.includes(sourceLine.cutOrderNo) || difference.cutOrderIds.includes(sourceLine.cutOrderId)) && (!sourceLine.materialSku || difference.materialSku === sourceLine.materialSku)
      );
      const pendingDifferenceCount = spreadingDifferences.filter((difference) => difference.handlingStatus === "\u5F85\u5904\u7406").length;
      const isClosed = Boolean(row.closeReason || row.closedAt || row.rawStageText.includes("\u5DF2\u5173\u95ED"));
      const mainStatusLabel = isClosed ? "\u5DF2\u5173\u95ED" : row.currentStage.label;
      const mainStatusClassName = isClosed ? "bg-zinc-100 text-zinc-700" : row.currentStage.className;
      const cuttable = !isClosed && row.currentStage.label === "\u5DF2\u5F00\u5DE5" && quantityLedger.cuttingClaimedQty > 0 && quantityLedger.availableQty > 0;
      const cuttableReasonText = isClosed ? row.closeReasonText || row.closeReason || "\u8BE5\u88C1\u7247\u5355\u5DF2\u5173\u95ED" : quantityLedger.cuttingClaimedQty <= 0 ? "\u65E0\u9886\u6599\u8BB0\u5F55" : row.currentStage.label !== "\u5DF2\u5F00\u5DE5" ? "\u672A\u5F00\u5DE5" : quantityLedger.availableQty <= 0 ? "\u53EF\u7528\u4F59\u989D\u4E3A 0" : "\u6EE1\u8DB3\u53EF\u6392\u551B\u67B6\u6761\u4EF6";
      const markerRelationText = quantityLedger.markerLockedQty > 0 ? `\u5DF2\u9501\u5B9A ${formatMaterialLedgerQty(quantityLedger.markerLockedQty, quantityLedger.unit)}` : snapshot?.markerProgress.status || "\u65E0\u551B\u67B6\u65B9\u6848\u5360\u7528";
      const operationResultText = [
        `\u5B9E\u9645\u88C1\u526A\uFF1A${sourceLine.currentStateLabel}`,
        `\u83F2\u7968\uFF1A${snapshot?.feiTicketProgress.status || "\u5F85\u751F\u6210"}`,
        `\u5F85\u4EA4\u51FA\u4ED3\uFF1A${snapshot?.cutPieceWarehouseProgress.status || "\u5F85\u8BB0\u5F55"}`
      ].join(" / ");
      return {
        rowId: `${row.id}::${sourceLine.cutOrderNo}::${sourceLine.materialSku}`,
        parentRowId: row.id,
        cutOrderNo: sourceLine.cutOrderNo,
        productionOrderId: row.productionOrderId,
        productionOrderNo: row.productionOrderNo,
        styleLabel: row.styleCode || row.spuCode || "-",
        styleName: row.styleName || row.spuCode || "-",
        materialSku: sourceLine.materialSku || "\u5F85\u8865\u9762\u6599 SKU",
        materialAlias: sourceLine.materialAlias || "",
        materialImageUrl: sourceLine.materialImageUrl || "",
        factoryName: row.assignedFactoryName || "-",
        relatedQty: getCutOrderRelatedQty(row, sourceLine.cutOrderNo, sourceLine.materialSku),
        quantityLedger,
        plannedShipDateDisplay: row.plannedShipDateDisplay,
        urgencyLabel: row.urgency.label,
        urgencyClassName: row.urgency.className,
        mainStatusLabel,
        mainStatusClassName,
        closeReasonText: row.closeReasonText,
        closeReason: row.closeReason,
        closedAt: row.closedAt,
        cuttableLabel: cuttable ? "\u53EF\u6392\u551B\u67B6" : "\u4E0D\u53EF\u6392\u551B\u67B6",
        cuttableClassName: cuttable ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700",
        cuttableReasonText,
        markerRelationText,
        operationResultText,
        feiTicketLabel: snapshot?.feiTicketProgress.status || "\u5F85\u751F\u6210",
        feiTicketClassName: buildStateBadgeClass(snapshot?.feiTicketProgress.status || "\u5F85\u751F\u6210"),
        specialCraftReturnLabel: snapshot?.specialCraftReturnProgress.status || "\u5F85\u786E\u8BA4",
        specialCraftReturnDetail: specialCraftDetailParts.join(" \xB7 "),
        sewingDispatchLabel: snapshot?.sewingDispatchProgress.status || "\u5F85\u4EA4\u51FA",
        sewingDispatchDetail: sewingDispatchDetailParts.join(" \xB7 "),
        pendingDifferenceCount,
        blockingText: pendingDifferenceCount > 0 ? `\u5F85\u5904\u7406\u5DEE\u5F02 ${pendingDifferenceCount} \u9879` : snapshot?.blockingReasons.length ? snapshot.blockingReasons.map((item) => item.blockingLabel).join("\u3001") : row.riskTags.map((item) => item.label).join("\u3001") || "\u6682\u65E0\u98CE\u9669",
        parentRecordId: row.id
      };
    });
  });
}
function resetPagination() {
  state.page = 1;
}
function renderBadge(label, className) {
  return `<span class="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${className}">${escapeHtml(label)}</span>`;
}
function readPendingPrepFollowups() {
  return deserializeReplenishmentPendingPrepStorage(
    localStorage.getItem(CUTTING_REPLENISHMENT_PENDING_PREP_STORAGE_KEY)
  );
}
function getPendingPrepFollowupsForRow(row) {
  const cutOrderIdSet = new Set(
    row.sourceOrderProgressLines.map((item) => item.cutOrderId).filter((value) => Boolean(value))
  );
  const cutOrderNoSet = new Set(
    row.sourceOrderProgressLines.map((item) => item.cutOrderNo).filter((value) => Boolean(value))
  );
  return readPendingPrepFollowups().filter(
    (item) => cutOrderIdSet.has(item.cutOrderId) || cutOrderNoSet.has(item.cutOrderNo)
  );
}
function buildPendingPrepSummaryText(row) {
  const followups = getPendingPrepFollowupsForRow(row);
  if (!followups.length) return "\u5F53\u524D\u65E0\u8865\u6599\u914D\u6599\u5F85\u5904\u7406";
  const latest = followups[0];
  return `\u8865\u6599\u914D\u6599\u5F85\u5904\u7406 ${followups.length} \u6761\uFF08\u6765\u6E90\u94FA\u5E03 ${latest?.sourceSpreadingSessionId || "\u5F85\u8865"} / \u6765\u6E90\u5DEE\u5F02\u5904\u7406 ${latest?.sourceReplenishmentRequestId || "\u5F85\u8865"}\uFF09`;
}
function buildRouteWithQuery(key, payload) {
  const pathname = getCanonicalCuttingPath(key);
  if (!payload) return pathname;
  const params = new URLSearchParams();
  Object.entries(payload).forEach(([entryKey, entryValue]) => {
    if (entryValue) params.set(entryKey, entryValue);
  });
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
function getCurrentSearchParams() {
  const pathname = appStore.getState().pathname;
  const [, query] = pathname.split("?");
  return new URLSearchParams(query || "");
}
function syncDrillContextFromPath() {
  const pathname = appStore.getState().pathname;
  if (state.querySignature === pathname) return;
  state.querySignature = pathname;
  state.drillContext = readCuttingDrillContextFromLocation(getCurrentSearchParams());
  if (state.drillContext?.productionOrderNo) {
    state.filters.productionOrderNo = state.drillContext.productionOrderNo;
  }
  if (state.drillContext?.blockerSection === "REPLENISHMENT") {
    state.activeQuickFilter = "REPLENISH_GAP";
  } else if (state.drillContext?.blockerSection === "SPREADING") {
    state.activeQuickFilter = "GAP_ONLY";
  } else if (state.drillContext?.blockerSection === "MATERIAL_PREP") {
    state.activeQuickFilter = "PREP_DELAY";
  }
  const matched = state.drillContext?.productionOrderNo ? getAllRows().find((row) => row.productionOrderNo === state.drillContext?.productionOrderNo) : null;
  state.activeDetailId = state.drillContext?.autoOpenDetail ? matched?.id || null : matched?.id || state.activeDetailId;
}
function applyQuickFilter(rows) {
  switch (state.activeQuickFilter) {
    case "URGENT_ONLY":
      return rows.filter((row) => row.urgency.key === "AA" || row.urgency.key === "A");
    case "PREP_DELAY":
      return rows.filter((row) => row.materialPrepSummary.key !== "CONFIGURED");
    case "CLAIM_EXCEPTION":
      return rows.filter((row) => row.materialClaimSummary.key === "EXCEPTION" || row.materialClaimSummary.key === "NOT_RECEIVED");
    case "CUTTING_ACTIVE":
      return rows.filter((row) => row.currentStage.key === "CUTTING" || row.currentStage.key === "WAITING_INBOUND" || row.currentStage.key === "DONE");
    case "INCOMPLETE_ONLY":
      return rows.filter((row) => row.incompleteSkuCount > 0 || row.incompletePartCount > 0);
    case "GAP_ONLY":
      return rows.filter((row) => row.hasPieceGap);
    case "MAPPING_MISSING":
      return rows.filter((row) => row.hasMappingWarnings);
    case "REPLENISH_GAP":
      return rows.filter((row) => row.hasPieceGap && row.riskTags.some((tag) => tag.key === "REPLENISH_PENDING"));
    default:
      return rows;
  }
}
function getDisplayRows() {
  const filteredRows = filterProductionProgressRows(getAllRows(), state.filters);
  const quickFilteredRows = applyQuickFilter(filteredRows);
  return sortProductionProgressRows(quickFilteredRows, state.filters.sortBy);
}
function getQuickFilterLabel(filter) {
  if (filter === "URGENT_ONLY") return "\u5FEB\u6377\u7B5B\u9009\uFF1A\u53EA\u770B\u4E34\u8FD1\u53D1\u8D27";
  if (filter === "PREP_DELAY") return "\u5FEB\u6377\u7B5B\u9009\uFF1A\u53EA\u770B\u914D\u6599\u5F02\u5E38";
  if (filter === "CLAIM_EXCEPTION") return "\u5FEB\u6377\u7B5B\u9009\uFF1A\u53EA\u770B\u9886\u6599\u5DEE\u5F02";
  if (filter === "CUTTING_ACTIVE") return "\u5FEB\u6377\u7B5B\u9009\uFF1A\u53EA\u770B\u5DF2\u5F00\u5DE5";
  if (filter === "INCOMPLETE_ONLY") return "\u5FEB\u6377\u7B5B\u9009\uFF1A\u53EA\u770B\u672A\u5B8C\u6210\u751F\u4EA7\u5355";
  if (filter === "GAP_ONLY") return "\u5FEB\u6377\u7B5B\u9009\uFF1A\u53EA\u770B\u6709\u90E8\u4F4D\u7F3A\u53E3";
  if (filter === "MAPPING_MISSING") return "\u5FEB\u6377\u7B5B\u9009\uFF1A\u53EA\u770B\u6620\u5C04\u7F3A\u5931";
  if (filter === "REPLENISH_GAP") return "\u5FEB\u6377\u7B5B\u9009\uFF1A\u53EA\u770B\u5F85\u8865\u6599\u5BFC\u81F4\u7684\u7F3A\u53E3";
  return null;
}
function getFilterLabels() {
  const labels = [];
  const quickFilterLabel = getQuickFilterLabel(state.activeQuickFilter);
  const completionLabelMap = {
    COMPLETED: "\u5DF2\u5B8C\u6210",
    IN_PROGRESS: "\u8FDB\u884C\u4E2D",
    DATA_PENDING: "\u6570\u636E\u5F85\u8865",
    HAS_EXCEPTION: "\u6709\u5F02\u5E38"
  };
  if (quickFilterLabel) labels.push(quickFilterLabel);
  if (state.filters.keyword) labels.push(`\u5173\u952E\u8BCD\uFF1A${state.filters.keyword}`);
  if (state.filters.productionOrderNo) labels.push(`\u751F\u4EA7\u5355\uFF1A${state.filters.productionOrderNo}`);
  if (state.filters.urgencyLevel !== "ALL") labels.push(`\u7D27\u6025\u7A0B\u5EA6\uFF1A${urgencyMeta[state.filters.urgencyLevel].label}`);
  if (state.filters.shipDeltaRange !== "ALL") labels.push(`\u4E0E\u8BA1\u5212\u53D1\u8D27\u76F8\u6BD4\uFF1A${shipDeltaRangeMeta[state.filters.shipDeltaRange].label}`);
  if (state.filters.currentStage !== "ALL") {
    const stageLabel = state.filters.currentStage === "NOT_STARTED" ? "\u672A\u5F00\u5DE5" : state.filters.currentStage === "STARTED" ? "\u5DF2\u5F00\u5DE5" : stageMeta[state.filters.currentStage].label;
    labels.push(`\u88C1\u5E8A\u4E3B\u72B6\u6001\uFF1A${stageLabel}`);
  }
  if (state.filters.completionState !== "ALL") labels.push(`\u5B8C\u6210\u72B6\u6001\uFF1A${completionLabelMap[state.filters.completionState]}`);
  if (state.filters.configStatus !== "ALL") labels.push(`\u4E2D\u8F6C\u4ED3\u914D\u6599\uFF1A${configMeta[state.filters.configStatus].label}`);
  if (state.filters.receiveStatus !== "ALL") labels.push(`\u88C1\u5E8A\u9886\u6599\uFF1A${receiveMeta[state.filters.receiveStatus].label}`);
  if (state.filters.riskFilter !== "ALL") {
    labels.push(state.filters.riskFilter === "ANY" ? "\u98CE\u9669\uFF1A\u53EA\u770B\u6709\u98CE\u9669" : `\u98CE\u9669\uFF1A${riskMeta[state.filters.riskFilter].label}`);
  }
  if (state.filters.sortBy !== "URGENCY_THEN_SHIP") {
    const sortLabelMap = {
      URGENCY_THEN_SHIP: "\u9ED8\u8BA4\u6392\u5E8F",
      SHIP_DATE_ASC: "\u8BA1\u5212\u53D1\u8D27\u65E5\u671F\u5347\u5E8F",
      ORDER_QTY_DESC: "\u672C\u5355\u6210\u8863\u4EF6\u6570\u964D\u5E8F"
    };
    labels.push(`\u6392\u5E8F\uFF1A${sortLabelMap[state.filters.sortBy]}`);
  }
  return labels;
}
function renderStatsCards(rows) {
  const summary = buildProductionProgressSummary(rows);
  const differences = rows.flatMap((row) => listSpreadingDifferencesByProductionOrder(row.productionOrderId));
  const pendingDifferenceCount = differences.filter((difference) => difference.handlingStatus === "\u5F85\u5904\u7406").length;
  const pendingReplenishmentReviewCount = differences.filter((difference) => difference.handlingStatus !== "\u5DF2\u5904\u7406").length;
  const handledReplenishmentReviewCount = differences.filter((difference) => difference.handlingStatus === "\u5DF2\u5904\u7406").length;
  const latestDifference = differences[0];
  const closedCutOrderCount = rows.filter((row) => Boolean(row.closeReason || row.closedAt || row.rawStageText.includes("\u5DF2\u5173\u95ED"))).length;
  return `
    <section class="grid gap-3 md:grid-cols-2 xl:grid-cols-11">
      ${renderCompactKpiCard("\u751F\u4EA7\u5355\u603B\u6570", summary.totalCount, "\u5F53\u524D\u7B5B\u9009\u8303\u56F4", "text-slate-900")}
      ${renderCompactKpiCard("\u4E34\u8FD1\u53D1\u8D27\u751F\u4EA7\u5355", summary.urgentCount, "\u9700\u4F18\u5148\u8DDF\u8FDB\u4EA4\u4ED8", "text-rose-600")}
      ${renderCompactKpiCard("\u914D\u6599\u5F02\u5E38\u5355", summary.prepExceptionCount, "\u914D\u6599\u6570\u91CF\u4E0D\u8DB3", "text-amber-600")}
      ${renderCompactKpiCard("\u9886\u6599\u5DEE\u5F02\u5355", summary.claimExceptionCount, "\u672A\u4EA7\u751F\u9886\u6599\u8BB0\u5F55\u6216\u73B0\u573A\u5DEE\u5F02", "text-orange-600")}
      ${renderCompactKpiCard("\u5F85\u5904\u7406\u5DEE\u5F02", pendingDifferenceCount, "\u6765\u81EA\u94FA\u5E03 / \u88C1\u526A\u5B9E\u9645\u5DEE\u5F02", pendingDifferenceCount ? "text-rose-600" : "text-emerald-600")}
      ${renderCompactKpiCard("\u5F85\u5BA1\u6838\u8865\u6599", pendingReplenishmentReviewCount, "\u7531\u5BA1\u6838\u7ED3\u679C\u51B3\u5B9A\u662F\u5426\u8865\u6599", pendingReplenishmentReviewCount ? "text-amber-600" : "text-emerald-600")}
      ${renderCompactKpiCard("\u5DF2\u5904\u7406\u8865\u6599", handledReplenishmentReviewCount, "\u5DF2\u5F62\u6210\u5BA1\u6838\u7ED3\u679C", handledReplenishmentReviewCount ? "text-emerald-600" : "text-slate-500")}
      ${renderCompactKpiCard("\u6700\u8FD1\u5DEE\u5F02\u6765\u6E90", latestDifference?.sourceType || "\u6682\u65E0\u5DEE\u5F02", latestDifference?.differenceType || "\u5F53\u524D\u7B5B\u9009\u8303\u56F4\u65E0\u5DEE\u5F02", latestDifference ? "text-blue-600" : "text-slate-500")}
      ${renderCompactKpiCard("\u5DF2\u5173\u95ED\u88C1\u7247\u5355", closedCutOrderCount, "\u5DF2\u8BB0\u5F55\u5173\u95ED\u539F\u56E0", closedCutOrderCount ? "text-zinc-700" : "text-slate-500")}
      ${renderCompactKpiCard("\u5DF2\u5F00\u5DE5\u751F\u4EA7\u5355", summary.cuttingCount + summary.doneCount, "\u542B\u94FA\u5E03\u3001\u88C1\u526A\u3001\u5165\u4ED3\u540E\u7EED", "text-violet-600")}
      ${renderCompactKpiCard("\u5DF2\u8FDB\u5165\u540E\u7EED\u5355", summary.doneCount, "\u542B\u83F2\u7968\u3001\u5165\u4ED3\u6216\u4EA4\u51FA\u540E\u7EED", "text-emerald-600")}
    </section>
  `;
}
function renderFullChainOverviewCards(rows) {
  const rowIds = new Set(rows.map((row) => row.productionOrderId));
  const snapshots = getCuttingProgressSnapshots().filter((item) => rowIds.has(item.productionOrderId));
  const total = rows.length || 1;
  const countBy = (getter) => rows.filter(getter).length;
  const runtimeSummaries = rows.map((row) => getRuntimeSewingDispatchProgressByProductionOrder(row.productionOrderId));
  const dispatchOrders = listCuttingSewingDispatchOrders().filter((order) => rowIds.has(order.productionOrderId));
  const dispatchBatches = listCuttingSewingDispatchBatches().filter((batch) => rowIds.has(batch.productionOrderId));
  const handoverRecordCount = dispatchBatches.filter((batch) => Boolean(batch.handoverRecordId)).length;
  const spreadingProjection = buildMarkerSpreadingProjection();
  const spreadingOrders = spreadingProjection.spreadingOrders.filter(
    (order) => order.productionOrderIds.some((productionOrderId) => rowIds.has(productionOrderId))
  );
  const markerPlanCount = new Set(spreadingOrders.map((order) => order.markerPlanId)).size;
  const waitingSpreadingCount = spreadingOrders.filter((order) => order.status === "WAITING_SPREADING").length;
  const activeSpreadingCount = spreadingOrders.filter((order) => order.status === "SPREADING").length;
  const cutDoneCount = spreadingOrders.filter((order) => order.status === "CUT_DONE").length;
  const blockingReasonCount = snapshots.reduce((sum, snapshot) => sum + snapshot.blockingReasons.length, 0) + runtimeSummaries.reduce((sum, item) => sum + item.blockingReasons.length, 0) + rows.filter((row) => row.pieceGapQty > 0 || row.inboundGapQty > 0).length;
  return `
    <section class="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      ${renderCompactKpiCard("\u4E2D\u8F6C\u4ED3\u914D\u6599", `${countBy((row) => row.materialPrepSummary.key === "CONFIGURED")}/${total}`, "\u6709\u914D\u6599\u6570\u91CF\u751F\u4EA7\u5355", "text-slate-900")}
      ${renderCompactKpiCard("\u88C1\u5E8A\u9886\u6599", `${countBy((row) => row.materialClaimSummary.key === "RECEIVED")}/${total}`, "\u6709\u9886\u6599\u8BB0\u5F55\u751F\u4EA7\u5355", "text-blue-600")}
      ${renderCompactKpiCard("\u88C1\u7247\u5355", rows.reduce((sum, row) => sum + row.cutOrderCount, 0), "\u5F53\u524D\u7B5B\u9009\u8303\u56F4", "text-slate-900")}
      ${renderCompactKpiCard("\u551B\u67B6\u65B9\u6848", `${markerPlanCount} \u4E2A`, "\u5DF2\u786E\u8BA4\u5E76\u751F\u6210\u94FA\u5E03\u5355", "text-violet-600")}
      ${renderCompactKpiCard("\u94FA\u5E03\u5355", `${spreadingOrders.length} \u5F20`, `\u5F85\u94FA\u5E03 ${waitingSpreadingCount} / \u94FA\u5E03\u4E2D ${activeSpreadingCount} / \u5DF2\u88C1\u526A ${cutDoneCount}`, "text-violet-600")}
      ${renderCompactKpiCard("\u83F2\u7968", snapshots.reduce((sum, item) => sum + item.feiTicketProgress.completedQty, 0), "\u5DF2\u751F\u6210\u83F2\u7968\u6570", "text-cyan-600")}
      ${renderCompactKpiCard("\u5F85\u4EA4\u51FA\u4ED3", snapshots.reduce((sum, item) => sum + item.cutPieceWarehouseProgress.completedQty, 0), "\u88C1\u7247\u5E93\u5B58\u8BB0\u5F55", "text-emerald-600")}
      ${renderCompactKpiCard("\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D", runtimeSummaries.reduce((sum, item) => sum + item.dispatchBatchCount, 0), "\u5206\u914D\u6279\u6B21", "text-blue-600")}
      ${renderCompactKpiCard("\u4EA4\u51FA\u5355", dispatchOrders.filter((order) => order.handoverOrderId).length || dispatchOrders.length, "\u5DF2\u751F\u6210 / \u5DF2\u521B\u5EFA", "text-blue-600")}
      ${renderCompactKpiCard("\u4EA4\u51FA\u8BB0\u5F55", handoverRecordCount, "\u5DF2\u63D0\u4EA4\u8BB0\u5F55", "text-blue-600")}
      ${renderCompactKpiCard("\u7F3A\u53E3", blockingReasonCount, "\u88C1\u5E8A\u94FE\u8DEF\u98CE\u9669\u4E0E\u7F3A\u53E3", blockingReasonCount ? "text-amber-600" : "text-emerald-600")}
      ${renderCompactKpiCard("\u4EA4\u51FA\u56DE\u5199", runtimeSummaries.reduce((sum, item) => sum + item.writtenBackTransferBagCount, 0), "\u5DF2\u56DE\u5199\u4E2D\u8F6C\u888B", "text-emerald-600")}
    </section>
  `;
}
function renderSpecialCraftReturnCards(rows) {
  const statusByProductionId = getCuttingSpecialCraftReturnStatusByProductionOrders(rows.map((row) => row.productionOrderId));
  const summaries = rows.map((row) => statusByProductionId.get(row.productionOrderId)).filter((item) => Boolean(item)).filter((item) => item.totalNeedSpecialCraftFeiTickets > 0);
  if (summaries.length === 0) return "";
  const aggregated = summaries.reduce(
    (result, item) => {
      result.totalNeed += item.totalNeedSpecialCraftFeiTickets;
      result.waitDispatch += item.waitDispatchCount;
      result.dispatched += item.dispatchedCount;
      result.received += item.receivedBySpecialFactoryCount;
      result.waitReturn += item.waitReturnCount;
      result.returned += item.returnedCount;
      result.difference += item.differenceCount;
      result.objection += item.objectionCount;
      return result;
    },
    {
      totalNeed: 0,
      waitDispatch: 0,
      dispatched: 0,
      received: 0,
      waitReturn: 0,
      returned: 0,
      difference: 0,
      objection: 0
    }
  );
  const allReturned = summaries.every((item) => item.allReturned);
  return `
    <section class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-foreground">\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3\u6C47\u603B</div>
          <div class="mt-1 text-xs text-muted-foreground">\u53EA\u7EDF\u8BA1\u9700\u8981\u7279\u6B8A\u5DE5\u827A\u7684\u83F2\u7968\uFF0C\u7528\u4E8E\u540E\u7EED\u88C1\u5E8A\u4EA4\u51FA\u524D\u6838\u5BF9\u3002</div>
        </div>
        <div class="text-sm font-medium ${allReturned ? "text-emerald-600" : "text-amber-600"}">\u662F\u5426\u5168\u90E8\u56DE\u4ED3\uFF1A${allReturned ? "\u662F" : "\u5426"}</div>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderCompactKpiCard("\u9700\u8981\u7279\u6B8A\u5DE5\u827A\u83F2\u7968\u6570", aggregated.totalNeed, "\u9700\u7ECF\u8FC7\u7279\u6B8A\u5DE5\u827A\u6D41\u8F6C", "text-slate-900")}
        ${renderCompactKpiCard("\u5F85\u4EA4\u51FA\u83F2\u7968\u6570", aggregated.waitDispatch, "\u88C1\u5E8A\u5382\u5F85\u4EA4\u51FA\u4ED3\u5F85\u5904\u7406", "text-amber-600")}
        ${renderCompactKpiCard("\u5DF2\u4EA4\u51FA\u83F2\u7968\u6570", aggregated.dispatched, "\u88C1\u5E8A\u5382\u5DF2\u521B\u5EFA\u4EA4\u51FA\u8BB0\u5F55", "text-blue-600")}
        ${renderCompactKpiCard("\u5DF2\u63A5\u6536\u83F2\u7968\u6570", aggregated.received, "\u7279\u6B8A\u5DE5\u827A\u5382\u5DF2\u5165\u5F85\u52A0\u5DE5\u4ED3", "text-cyan-600")}
        ${renderCompactKpiCard("\u5F85\u56DE\u4ED3\u83F2\u7968\u6570", aggregated.waitReturn, "\u7279\u6B8A\u5DE5\u827A\u5382\u5F85\u4EA4\u51FA\u4ED3\u5F85\u56DE\u4ED3", "text-amber-600")}
        ${renderCompactKpiCard("\u5DF2\u56DE\u4ED3\u83F2\u7968\u6570", aggregated.returned, "\u5DF2\u56DE\u88C1\u5E8A\u5382\u5F85\u4EA4\u51FA\u4ED3", "text-emerald-600")}
        ${renderCompactKpiCard("\u5DEE\u5F02\u83F2\u7968\u6570", aggregated.difference, "\u4EA4\u51FA\u6216\u56DE\u4ED3\u5B58\u5728\u5DEE\u5F02", "text-rose-600")}
        ${renderCompactKpiCard("\u5F02\u8BAE\u4E2D\u83F2\u7968\u6570", aggregated.objection, "\u6570\u91CF\u5F02\u8BAE\u5904\u7406\u4E2D", "text-rose-600")}
      </div>
    </section>
  `;
}
function renderSewingDispatchProgressCards(rows) {
  const summaries = rows.map((row) => getRuntimeSewingDispatchProgressByProductionOrder(row.productionOrderId));
  const aggregated = summaries.reduce(
    (result, item) => {
      result.totalProductionQty += item.totalProductionQty;
      result.cumulativeDispatchedGarmentQty += item.cumulativeDispatchedGarmentQty;
      result.remainingGarmentQty += item.remainingGarmentQty;
      result.dispatchBatchCount += item.dispatchBatchCount;
      result.transferBagCount += item.transferBagCount;
      result.writtenBackTransferBagCount += item.writtenBackTransferBagCount;
      result.differenceTransferBagCount += item.differenceTransferBagCount;
      result.objectionTransferBagCount += item.objectionTransferBagCount;
      item.blockingReasons.forEach((reason) => result.blockingReasons.add(reason));
      return result;
    },
    {
      totalProductionQty: 0,
      cumulativeDispatchedGarmentQty: 0,
      remainingGarmentQty: 0,
      dispatchBatchCount: 0,
      transferBagCount: 0,
      writtenBackTransferBagCount: 0,
      differenceTransferBagCount: 0,
      objectionTransferBagCount: 0,
      blockingReasons: /* @__PURE__ */ new Set()
    }
  );
  const reasons = Array.from(aggregated.blockingReasons);
  return `
    <section class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-foreground">\u4EA4\u51FA\u5355\u6C47\u603B</div>
          <div class="mt-1 text-xs text-muted-foreground">\u7EDF\u8BA1\u88C1\u5E8A\u5382\u4EA4\u51FA\u5355\u3001\u4EA4\u51FA\u8BB0\u5F55\u3001\u4E2D\u8F6C\u888B\u548C\u56DE\u5199\u7ED3\u679C\u3002</div>
        </div>
        <div class="text-sm font-medium text-amber-600">\u4EA4\u51FA\u540E\u98CE\u9669\u63D0\u793A\uFF1A${reasons.length ? `${reasons.length} \u9879` : "\u65E0"}</div>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        ${renderCompactKpiCard("\u751F\u4EA7\u603B\u6570", aggregated.totalProductionQty, "", "text-slate-900")}
        ${renderCompactKpiCard("\u7D2F\u8BA1\u5DF2\u4EA4\u51FA\u4EF6\u6570", aggregated.cumulativeDispatchedGarmentQty, "", "text-blue-600")}
        ${renderCompactKpiCard("\u5269\u4F59\u672A\u4EA4\u51FA\u4EF6\u6570", aggregated.remainingGarmentQty, "", "text-amber-600")}
        ${renderCompactKpiCard("\u4EA4\u51FA\u8BB0\u5F55\u6570", aggregated.dispatchBatchCount, "", "text-slate-700")}
        ${renderCompactKpiCard("\u4E2D\u8F6C\u888B\u6570", aggregated.transferBagCount, "", "text-slate-700")}
        ${renderCompactKpiCard("\u5DF2\u56DE\u5199\u888B\u6570", aggregated.writtenBackTransferBagCount, "", "text-emerald-600")}
        ${renderCompactKpiCard("\u5DEE\u5F02\u888B\u6570", aggregated.differenceTransferBagCount, "", "text-rose-600")}
        ${renderCompactKpiCard("\u5F02\u8BAE\u4E2D\u888B\u6570", aggregated.objectionTransferBagCount, "", "text-rose-600")}
        ${renderCompactKpiCard("\u4EA4\u51FA\u540E\u7F3A\u53E3", reasons.length ? reasons.join("\u3001") : "\u65E0", "\u7F3A\u53E3\u548C\u5DEE\u5F02\u4F5C\u4E3A\u4EA4\u51FA\u540E\u7ED3\u679C\u5C55\u793A\uFF0C\u4E0D\u62E6\u622A\u6709\u6548\u88C1\u7247\u7EE7\u7EED\u4EA4\u51FA", "text-amber-600")}
      </div>
    </section>
  `;
}
function renderProgressStatisticsLinkageCards(rows) {
  const rowIds = new Set(rows.map((row) => row.productionOrderId));
  const snapshots = getCuttingProgressSnapshots().filter((item) => rowIds.has(item.productionOrderId));
  if (!snapshots.length) return "";
  const countBy = (getter) => snapshots.filter(getter).length;
  const blockingReasons = Array.from(new Set(snapshots.flatMap((snapshot) => snapshot.blockingReasons.map((reason) => reason.blockingLabel))));
  const bundleLengthValues = Array.from(new Set(snapshots.flatMap((snapshot) => snapshot.bundleLengthCmValues).filter((value) => value > 0)));
  const bundleWidthValues = Array.from(new Set(snapshots.flatMap((snapshot) => snapshot.bundleWidthCmValues).filter((value) => value > 0)));
  return `
    <section class="rounded-lg border bg-white p-4 shadow-sm">
      <div class="flex items-center justify-between gap-3">
        <div>
          <div class="text-sm font-semibold text-foreground">\u88C1\u5E8A\u8FDB\u5EA6\u8054\u52A8</div>
          <div class="mt-1 text-xs text-muted-foreground">\u6309\u751F\u4EA7\u5355\u6C47\u603B\u914D\u6599\u6570\u91CF\u3001\u9886\u6599\u6570\u91CF\u3001\u88C1\u526A\u3001\u83F2\u7968\u3001\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3\u3001\u88C1\u7247\u4EA4\u51FA\u548C\u5DEE\u5F02\u98CE\u9669\u3002</div>
        </div>
        <div class="text-sm font-medium text-amber-600">\u4EA4\u51FA\u540E\u98CE\u9669\u63D0\u793A\uFF1A${blockingReasons.length ? `${blockingReasons.length} \u9879` : "\u65E0"}</div>
      </div>
      <div class="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        ${renderCompactKpiCard("\u914D\u6599\u6570\u91CF", countBy((item) => item.materialPrepProgress.status === "\u5DF2\u914D\u7F6E"), `\u5171 ${snapshots.length} \u5355`, "text-slate-900")}
        ${renderCompactKpiCard("\u9886\u6599\u6570\u91CF", countBy((item) => item.pickupProgress.status === "\u5DF2\u5165\u5F85\u52A0\u5DE5\u4ED3"), `\u5DEE\u5F02 ${countBy((item) => item.pickupProgress.status === "\u5DEE\u5F02\u5F85\u5904\u7406")} \u5355`, "text-blue-600")}
        ${renderCompactKpiCard("\u88C1\u526A\u8FDB\u5EA6", countBy((item) => item.cuttingProgress.status === "\u5DF2\u88C1\u526A"), `\u5171 ${snapshots.length} \u5355`, "text-violet-600")}
        ${renderCompactKpiCard("\u83F2\u7968\u8FDB\u5EA6", countBy((item) => item.feiTicketProgress.status === "\u5DF2\u751F\u6210"), `\u90E8\u5206 / \u672A\u751F\u6210 ${countBy((item) => item.feiTicketProgress.status !== "\u5DF2\u751F\u6210")} \u5355`, "text-cyan-600")}
        ${renderCompactKpiCard("\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3", countBy((item) => item.specialCraftReturnProgress.status === "\u5DF2\u56DE\u4ED3" || item.specialCraftReturnProgress.status === "\u4E0D\u9700\u8981\u56DE\u4ED3"), `\u672A\u56DE\u4ED3 ${countBy((item) => item.specialCraftReturnProgress.status.includes("\u672A\u56DE\u4ED3"))} \u5355`, "text-emerald-600")}
        ${renderCompactKpiCard("\u88C1\u7247\u4EA4\u51FA", snapshots.reduce((sum, item) => sum + item.sewingDispatchProgress.completedQty, 0), "\u7D2F\u8BA1\u5DF2\u4EA4\u51FA\u4EF6\u6570", "text-blue-600")}
        ${renderCompactKpiCard("\u7279\u6B8A\u5DE5\u827A\u5F53\u524D\u6570\u91CF", formatQty(snapshots.reduce((sum, item) => sum + item.specialCraftCurrentQty, 0)), "\u5DF2\u56DE\u4ED3\u540E\u5F53\u524D\u53EF\u7528\u6570\u91CF", "text-blue-600")}
        ${renderCompactKpiCard("\u7279\u6B8A\u5DE5\u827A\u62A5\u5E9F / \u8D27\u635F", `${formatQty(snapshots.reduce((sum, item) => sum + item.specialCraftScrapQty, 0))} / ${formatQty(snapshots.reduce((sum, item) => sum + item.specialCraftDamageQty, 0))}`, "\u62A5\u5E9F / \u8D27\u635F", "text-rose-600")}
        ${renderCompactKpiCard("\u9886\u6599\u5355\u5DF2\u5B8C\u6210", countBy((item) => item.pickupOrderCompleted), "\u5DE5\u5382\u4FA7\u5B8C\u6210\u88C1\u5E8A\u9886\u6599", "text-emerald-600")}
        ${renderCompactKpiCard("\u4EA4\u51FA\u5355\u5DF2\u5B8C\u6210", countBy((item) => item.handoutOrderCompleted), "\u5DE5\u5382\u4FA7\u5B8C\u6210\u4EA4\u51FA\u5355", "text-emerald-600")}
        ${renderCompactKpiCard("\u88C5\u888B / \u56DE\u5199", countBy((item) => item.transferBagPackStatus === "\u5DF2\u88C5\u888B" || item.transferBagPackStatus === "\u5DF2\u4EA4\u51FA"), `\u90E8\u5206\u56DE\u5199 ${countBy((item) => item.transferBagCombinedWritebackStatus === "\u90E8\u5206\u56DE\u5199")}`, "text-blue-600")}
        ${renderCompactKpiCard("\u888B\u7EA7 / \u83F2\u7968\u7EA7\u5DEE\u5F02", `${snapshots.reduce((sum, item) => sum + item.transferBagBagDifferenceCount, 0)} / ${snapshots.reduce((sum, item) => sum + item.transferBagFeiTicketDifferenceCount, 0)}`, "\u4E2D\u8F6C\u888B\u5DEE\u5F02 / \u83F2\u7968\u5DEE\u5F02", "text-rose-600")}
        ${renderCompactKpiCard("\u5DEE\u5F02 / \u5F02\u8BAE", countBy((item) => item.blockingReasons.some((reason) => reason.blockingLabel.includes("\u5DEE\u5F02") || reason.blockingLabel.includes("\u5F02\u8BAE"))), "\u6D89\u53CA\u751F\u4EA7\u5355", "text-rose-600")}
        ${bundleLengthValues.length || bundleWidthValues.length ? renderCompactKpiCard(
    "\u6346\u6761\u5C3A\u5BF8",
    `${bundleLengthValues.length ? `\u957F ${bundleLengthValues.join(" / ")}` : "\u957F \u2014"}${bundleWidthValues.length ? ` / \u5BBD ${bundleWidthValues.join(" / ")}` : ""}`,
    "\u4EC5\u5728\u6346\u6761\u5DF2\u7EF4\u62A4\u5C3A\u5BF8\u65F6\u5C55\u793A",
    "text-violet-600"
  ) : ""}
        ${renderCompactKpiCard("\u4EA4\u51FA\u540E\u98CE\u9669", blockingReasons.length ? blockingReasons.slice(0, 3).join("\u3001") : "\u65E0", "\u6709\u53EF\u4EA4\u5E93\u5B58\u65F6\u4ECD\u53EF\u7EE7\u7EED\u65B0\u589E\u4EA4\u51FA\u8BB0\u5F55", "text-amber-600")}
      </div>
    </section>
  `;
}
function renderFilterSelect(label, field, value, options) {
  return `
    <label class="space-y-2">
      <span class="text-sm font-medium text-foreground">${escapeHtml(label)}</span>
      <select
        class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
        data-cutting-progress-field="${field}"
      >
        ${options.map((option) => `<option value="${escapeHtml(option.value)}" ${option.value === value ? "selected" : ""}>${escapeHtml(option.label)}</option>`).join("")}
      </select>
    </label>
  `;
}
function renderQuickFilterRow() {
  const options = [
    { key: "URGENT_ONLY", label: "\u53EA\u770B\u4E34\u8FD1\u53D1\u8D27", tone: "rose" },
    { key: "PREP_DELAY", label: "\u53EA\u770B\u914D\u6599\u4E0D\u8DB3", tone: "amber" },
    { key: "CLAIM_EXCEPTION", label: "\u53EA\u770B\u9886\u6599\u5DEE\u5F02", tone: "rose" },
    { key: "CUTTING_ACTIVE", label: "\u53EA\u770B\u5DF2\u5F00\u5DE5", tone: "blue" },
    { key: "INCOMPLETE_ONLY", label: "\u53EA\u770B\u672A\u5B8C\u6210", tone: "blue" },
    { key: "GAP_ONLY", label: "\u53EA\u770B\u90E8\u4F4D\u7F3A\u53E3", tone: "amber" },
    { key: "MAPPING_MISSING", label: "\u53EA\u770B\u6620\u5C04\u7F3A\u5931", tone: "amber" },
    { key: "REPLENISH_GAP", label: "\u53EA\u770B\u5F85\u8865\u6599\u7F3A\u53E3", tone: "rose" }
  ];
  return `
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-xs font-medium text-muted-foreground">\u5FEB\u6377\u7B5B\u9009</span>
      ${options.map(
    (option) => renderWorkbenchFilterChip(
      option.label,
      `data-cutting-progress-action="toggle-quick-filter" data-quick-filter="${option.key}"`,
      state.activeQuickFilter === option.key ? option.tone : "blue"
    )
  ).join("")}
    </div>
  `;
}
function renderActiveStateBar() {
  const labels = [...buildCuttingDrillChipLabels(state.drillContext), ...getFilterLabels()];
  if (!labels.length) return "";
  return renderWorkbenchStateBar({
    summary: buildCuttingDrillSummary(state.drillContext) || "\u5F53\u524D\u89C6\u56FE\u6761\u4EF6",
    chips: labels.map(
      (label) => renderWorkbenchFilterChip(
        label,
        state.drillContext ? 'data-cutting-progress-action="clear-prefilter"' : 'data-cutting-progress-action="clear-filters"',
        state.drillContext ? "amber" : "blue"
      )
    ),
    clearAttrs: state.drillContext ? 'data-cutting-progress-action="clear-prefilter"' : 'data-cutting-progress-action="clear-filters"'
  });
}
function renderMetricChip(label, value, toneClass = "text-slate-900") {
  return `
    <span class="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs text-muted-foreground">
      <span>${escapeHtml(label)}</span>
      <span class="font-semibold ${toneClass}">${escapeHtml(value)}</span>
    </span>
  `;
}
function formatMaterialLedgerQty(value, unit = "\u7C73") {
  return `${formatQty(Math.round(value * 10) / 10)} ${unit}`;
}
function renderMaterialLedgerLine(line, fields) {
  return `
    <div class="space-y-1.5 rounded-md border bg-background px-2.5 py-2">
      ${renderMaterialIdentityBlock(line.materialIdentity, { compact: true, imageSizeClass: "h-9 w-9" })}
      <div class="grid gap-x-3 gap-y-1 text-xs text-muted-foreground">
        ${fields.map(([label, field]) => {
    const value = typeof line[field] === "number" ? Number(line[field]) : 0;
    return `<div class="flex justify-between gap-3"><span>${escapeHtml(label)}</span><span class="font-medium tabular-nums text-foreground">${escapeHtml(formatMaterialLedgerQty(value, line.unit))}</span></div>`;
  }).join("")}
      </div>
    </div>
  `;
}
function renderStackedLines(lines, emptyText, options = {}) {
  if (!lines.length) {
    return `<div class="text-xs text-muted-foreground">${escapeHtml(emptyText)}</div>`;
  }
  const limit = options.limit ?? lines.length;
  const visibleLines = lines.slice(0, limit);
  const remainingCount = Math.max(lines.length - visibleLines.length, 0);
  return `
    <div class="space-y-1.5">
      ${visibleLines.map((line) => `<div class="text-xs leading-5 text-foreground">${line}</div>`).join("")}
      ${remainingCount > 0 ? `<div class="text-xs text-muted-foreground">+${remainingCount} \u9879</div>` : ""}
    </div>
  `;
}
function renderPrepProgressCell(row) {
  const lines = buildMaterialQuantityLedgerLines(row).map(
    (line) => renderMaterialLedgerLine(
      line,
      [
        ["\u9700\u6C42\u7528\u91CF", "requiredMaterialQty"],
        ["\u4E2D\u8F6C\u4ED3\u5DF2\u914D\u6570\u91CF", "transferWarehouseAllocatedQty"],
        ["\u5DF2\u9501\u5B9A\u6570\u91CF", "markerLockedQty"]
      ]
    )
  );
  return renderStackedLines(lines, "\u6682\u65E0\u9762\u6599\u6570\u91CF\u8D26");
}
function renderClaimProgressCell(row) {
  const lines = buildMaterialQuantityLedgerLines(row).map(
    (line) => renderMaterialLedgerLine(
      line,
      [
        ["\u88C1\u5E8A\u5DF2\u9886\u6570\u91CF", "cuttingClaimedQty"],
        ["\u5DF2\u6D88\u8017\u6570\u91CF", "spreadingConsumedQty"],
        ["\u53EF\u7528\u4F59\u989D", "availableQty"]
      ]
    )
  );
  return renderStackedLines(lines, "\u6682\u65E0\u9762\u6599\u6570\u91CF\u8D26");
}
function renderSkuProgressCell(row) {
  const lines = row.skuProgressLines.map(
    (line) => `<div class="flex items-start justify-between gap-3"><span class="text-muted-foreground">${escapeHtml([line.skuLabel, line.skuDetailLabel].filter(Boolean).join(" / "))}</span><span class="font-medium ${line.completionClassName}">${escapeHtml(line.completionLabel)}</span></div>`
  );
  return renderStackedLines(lines, "\u6682\u65E0 SKU \u8FDB\u5C55");
}
function renderPartDifferenceCell(row) {
  return `
    <div class="space-y-1 text-xs">
      <div class="flex items-center justify-between gap-3">
        <span class="text-muted-foreground">\u5DF2\u5B8C\u6210\u90E8\u4F4D\u7247\u6570</span>
        <span class="font-medium tabular-nums text-emerald-700">${formatQty(row.partDifferenceSummary.completedPieceQty)}</span>
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-muted-foreground">\u672A\u5B8C\u6210\u90E8\u4F4D\u7247\u6570</span>
        <span class="font-medium tabular-nums ${row.partDifferenceSummary.incompletePieceQty > 0 ? "text-amber-700" : "text-slate-900"}">${formatQty(row.partDifferenceSummary.incompletePieceQty)}</span>
      </div>
    </div>
  `;
}
function resolveGapRowCutOrderNo(row, item) {
  if (item.cutOrderNo) return item.cutOrderNo;
  const fallback = row.pieceTruth.cutOrderRows.find(
    (sourceRow) => sourceRow.materialSku === item.materialSku && (sourceRow.gapCutQty > 0 || sourceRow.gapInboundQty > 0)
  );
  return fallback?.cutOrderNo || "-";
}
function renderRiskCell(row) {
  const pendingPrepFollowups = getPendingPrepFollowupsForRow(row);
  if (!row.riskTags.length && !pendingPrepFollowups.length) {
    return '<span class="text-xs text-muted-foreground">\u65E0\u98CE\u9669</span>';
  }
  return `
    <div class="flex flex-wrap gap-1">
      ${row.riskTags.map((riskTag) => renderBadge(riskTag.label, riskTag.className)).join("")}
      ${pendingPrepFollowups.length ? renderBadge(`\u8865\u6599\u914D\u6599\u5F85\u5904\u7406 ${pendingPrepFollowups.length} \u6761`, "bg-amber-100 text-amber-700") : ""}
    </div>
  `;
}
function renderDetailSummaryItem(label, value) {
  return `
    <div class="space-y-1 rounded-md bg-background/60 px-3 py-2">
      <div class="text-xs text-muted-foreground">${escapeHtml(label)}</div>
      <div class="text-sm font-medium text-foreground">${escapeHtml(value || "-")}</div>
    </div>
  `;
}
function renderDetailMaterialLines(lines, emptyText) {
  if (!lines.length) {
    return `<div class="text-sm text-muted-foreground">${escapeHtml(emptyText)}</div>`;
  }
  return `
    <div class="space-y-2">
      ${lines.map((line) => `<div class="text-sm leading-6 text-foreground">${line}</div>`).join("")}
    </div>
  `;
}
function renderMaterialProgressSection(row) {
  const ledgerLines = buildMaterialQuantityLedgerLines(row);
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">\u9762\u6599\u6570\u91CF\u8D26</h3>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[980px] text-sm">
          <thead class="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left font-medium">\u9762\u6599</th>
              <th class="px-4 py-3 text-left font-medium">\u9700\u6C42\u7528\u91CF</th>
              <th class="px-4 py-3 text-left font-medium">\u4E2D\u8F6C\u4ED3\u5DF2\u914D\u6570\u91CF</th>
              <th class="px-4 py-3 text-left font-medium">\u88C1\u5E8A\u5DF2\u9886\u6570\u91CF</th>
              <th class="px-4 py-3 text-left font-medium">\u5DF2\u9501\u5B9A\u6570\u91CF</th>
              <th class="px-4 py-3 text-left font-medium">\u5DF2\u6D88\u8017\u6570\u91CF</th>
              <th class="px-4 py-3 text-left font-medium">\u53EF\u7528\u4F59\u989D</th>
            </tr>
          </thead>
          <tbody>
            ${ledgerLines.length ? ledgerLines.map(
    (line) => `
                        <tr class="border-b last:border-b-0 align-top">
                          <td class="px-4 py-3">${renderMaterialIdentityBlock(line.materialIdentity, { compact: true, imageSizeClass: "h-9 w-9" })}</td>
                          <td class="px-4 py-3 font-medium tabular-nums">${escapeHtml(formatMaterialLedgerQty(line.requiredMaterialQty, line.unit))}</td>
                          <td class="px-4 py-3 font-medium tabular-nums">${escapeHtml(formatMaterialLedgerQty(line.transferWarehouseAllocatedQty, line.unit))}</td>
                          <td class="px-4 py-3 font-medium tabular-nums">${escapeHtml(formatMaterialLedgerQty(line.cuttingClaimedQty, line.unit))}</td>
                          <td class="px-4 py-3 font-medium tabular-nums">${escapeHtml(formatMaterialLedgerQty(line.markerLockedQty, line.unit))}</td>
                          <td class="px-4 py-3 font-medium tabular-nums">${escapeHtml(formatMaterialLedgerQty(line.spreadingConsumedQty, line.unit))}</td>
                          <td class="px-4 py-3 font-medium tabular-nums">${escapeHtml(formatMaterialLedgerQty(line.availableQty, line.unit))}</td>
                        </tr>
                      `
  ).join("") : '<tr><td colspan="7" class="px-4 py-10 text-center text-sm text-muted-foreground">\u6682\u65E0\u9762\u6599\u6570\u91CF\u8D26\u3002</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
function renderFullChainDetailSection(row) {
  const snapshot = getCuttingSnapshotForRow(row);
  const runtimeSewing = getRuntimeSewingDispatchProgressByProductionOrder(row.productionOrderId);
  const dispatchOrders = listCuttingSewingDispatchOrders().filter((order) => order.productionOrderId === row.productionOrderId);
  const dispatchBatches = listCuttingSewingDispatchBatches().filter((batch) => batch.productionOrderId === row.productionOrderId);
  const transferBags = listCuttingSewingTransferBags().filter((bag) => bag.productionOrderId === row.productionOrderId);
  const handoverRecordCount = dispatchBatches.filter((batch) => Boolean(batch.handoverRecordId)).length;
  const spreadingOrderSummary = getSpreadingOrderSummaryForProductionOrder(row);
  const blockingReasons = [
    ...snapshot?.blockingReasons.map((item) => item.blockingLabel) || [],
    ...runtimeSewing.blockingReasons,
    row.pieceGapQty > 0 ? `\u88C1\u7247\u4ECD\u7F3A ${formatQty(row.pieceGapQty)} \u7247` : "",
    row.inboundGapQty > 0 ? `\u5165\u4ED3\u4ECD\u7F3A ${formatQty(row.inboundGapQty)} \u7247` : ""
  ].filter(Boolean);
  const chainItems = [
    {
      label: "\u4E2D\u8F6C\u4ED3\u914D\u6599",
      value: row.materialPrepSummary.label,
      detail: row.materialPrepSummary.detailText,
      tone: row.materialPrepSummary.className
    },
    {
      label: "\u88C1\u5E8A\u9886\u6599",
      value: row.materialClaimSummary.label,
      detail: row.materialClaimSummary.detailText,
      tone: row.materialClaimSummary.className
    },
    {
      label: "\u88C1\u7247\u5355",
      value: `${row.cutOrderCount} \u5F20`,
      detail: row.cutOrderNos.join("\u3001") || "\u6682\u65E0\u88C1\u7247\u5355",
      tone: "bg-slate-100 text-slate-700"
    },
    {
      label: "\u551B\u67B6",
      value: snapshot?.markerProgress.status || "\u5F85\u786E\u8BA4",
      detail: `${formatQty(snapshot?.markerProgress.completedQty || 0)}/${formatQty(snapshot?.markerProgress.plannedQty || 0)}`,
      tone: buildStateBadgeClass(snapshot?.markerProgress.status || "\u5F85\u786E\u8BA4")
    },
    {
      label: "\u94FA\u5E03\u5355",
      value: `${formatQty(spreadingOrderSummary.orders.length)} \u5F20`,
      detail: `\u551B\u67B6\u65B9\u6848 ${formatQty(spreadingOrderSummary.markerPlanCount)} \u4E2A / \u5F85\u94FA\u5E03 ${formatQty(spreadingOrderSummary.waitingSpreadingCount)} / \u94FA\u5E03\u4E2D ${formatQty(spreadingOrderSummary.spreadingCount)} / \u5DF2\u88C1\u526A ${formatQty(spreadingOrderSummary.cutDoneCount)}`,
      tone: spreadingOrderSummary.orders.length ? "bg-violet-100 text-violet-700" : buildStateBadgeClass(snapshot?.spreadingProgress.status || "\u5F85\u786E\u8BA4")
    },
    {
      label: "\u83F2\u7968",
      value: snapshot?.feiTicketProgress.status || "\u5F85\u751F\u6210",
      detail: `\u5DF2\u751F\u6210 ${formatQty(snapshot?.feiTicketProgress.completedQty || 0)} \u5F20`,
      tone: buildStateBadgeClass(snapshot?.feiTicketProgress.status || "\u5F85\u751F\u6210")
    },
    {
      label: "\u5F85\u4EA4\u51FA\u4ED3",
      value: snapshot?.cutPieceWarehouseProgress.status || "\u672A\u5165\u4ED3",
      detail: `\u5E93\u5B58\u8BB0\u5F55 ${formatQty(snapshot?.cutPieceWarehouseProgress.completedQty || 0)} \u6761`,
      tone: buildStateBadgeClass(snapshot?.cutPieceWarehouseProgress.status || "\u672A\u5165\u4ED3")
    },
    {
      label: "\u8F66\u7F1D\u4EFB\u52A1\u5206\u914D",
      value: `${runtimeSewing.dispatchBatchCount} \u6279`,
      detail: `\u4E2D\u8F6C\u888B ${runtimeSewing.transferBagCount} \u4E2A / \u5DF2\u4EA4\u51FA\u888B ${runtimeSewing.dispatchedTransferBagCount} \u4E2A`,
      tone: runtimeSewing.dispatchBatchCount ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
    },
    {
      label: "\u4EA4\u51FA\u5355",
      value: `${dispatchOrders.filter((order) => order.handoverOrderId).length || dispatchOrders.length} \u4E2A`,
      detail: dispatchOrders.map((order) => order.handoverOrderNo || order.dispatchOrderNo).join("\u3001") || "\u6682\u65E0\u4EA4\u51FA\u5355",
      tone: dispatchOrders.length ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
    },
    {
      label: "\u4EA4\u51FA\u8BB0\u5F55",
      value: `${handoverRecordCount} \u6761`,
      detail: dispatchBatches.map((batch) => batch.handoverRecordNo || batch.dispatchBatchNo).join("\u3001") || "\u6682\u65E0\u4EA4\u51FA\u8BB0\u5F55",
      tone: handoverRecordCount ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-700"
    },
    {
      label: "\u7F3A\u53E3",
      value: blockingReasons.length ? `${blockingReasons.length} \u9879` : "\u65E0",
      detail: blockingReasons.slice(0, 4).join("\u3001") || "\u5F53\u524D\u65E0\u88C1\u5E8A\u94FE\u8DEF\u7F3A\u53E3",
      tone: blockingReasons.length ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
    }
  ];
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-4">
        <h3 class="text-sm font-semibold">\u5168\u94FE\u8DEF\u603B\u89C8</h3>
        <div class="flex flex-wrap gap-2">
          ${renderMetricChip("\u8F66\u7F1D\u4EFB\u52A1", `${runtimeSewing.dispatchBatchCount} \u6279`, runtimeSewing.dispatchBatchCount ? "text-blue-600" : "text-slate-700")}
          ${renderMetricChip("\u4E2D\u8F6C\u888B", `${transferBags.length} \u4E2A`, transferBags.length ? "text-blue-600" : "text-slate-700")}
          ${renderMetricChip("\u5DF2\u4EA4\u51FA\u4EF6\u6570", formatQty(runtimeSewing.cumulativeDispatchedGarmentQty), "text-blue-600")}
        </div>
      </div>
      <div class="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        ${chainItems.map(
    (item) => `
              <div class="rounded-md border bg-background px-3 py-2">
                <div class="flex items-center justify-between gap-3">
                  <span class="text-xs text-muted-foreground">${escapeHtml(item.label)}</span>
                  ${renderBadge(item.value, item.tone)}
                </div>
                <div class="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">${escapeHtml(item.detail)}</div>
              </div>
            `
  ).join("")}
      </div>
    </section>
  `;
}
function renderProductionPartFlowSection(row) {
  const rows = buildProductionPartFlowLines(row);
  const totals = rows.reduce(
    (result, item) => {
      result.required += item.requiredPieceQty;
      result.cut += item.actualCutQty;
      result.stock += item.waitHandoverStockQty;
      result.assigned += item.assignedPieceQty;
      result.handedOver += item.handedOverPieceQty;
      result.gap += item.gapPieceQty;
      return result;
    },
    { required: 0, cut: 0, stock: 0, assigned: 0, handedOver: 0, gap: 0 }
  );
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-4">
        <h3 class="text-sm font-semibold">SKU / \u90E8\u4F4D\u6D41\u8F6C\u660E\u7EC6</h3>
        <div class="flex flex-wrap gap-2">
          ${renderMetricChip("\u5DF2\u88C1", formatQty(totals.cut), "text-violet-700")}
          ${renderMetricChip("\u5E93\u5B58", formatQty(totals.stock), "text-emerald-700")}
          ${renderMetricChip("\u5DF2\u5206\u914D", formatQty(totals.assigned), "text-blue-700")}
          ${renderMetricChip("\u5DF2\u4EA4\u51FA", formatQty(totals.handedOver), "text-blue-700")}
          ${renderMetricChip("\u4ECD\u7F3A", formatQty(totals.gap), totals.gap > 0 ? "text-amber-700" : "text-emerald-700")}
        </div>
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[1120px] text-sm">
          <thead class="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left font-medium">SKU / \u90E8\u4F4D</th>
              <th class="px-4 py-3 text-left font-medium">\u6765\u6E90\u88C1\u7247\u5355</th>
              <th class="px-4 py-3 text-left font-medium">\u7406\u8BBA\u7247\u6570</th>
              <th class="px-4 py-3 text-left font-medium">\u5B9E\u9645\u88C1\u526A</th>
              <th class="px-4 py-3 text-left font-medium">\u5F85\u4EA4\u51FA\u4ED3\u5E93\u5B58</th>
              <th class="px-4 py-3 text-left font-medium">\u5DF2\u5206\u914D</th>
              <th class="px-4 py-3 text-left font-medium">\u5DF2\u4EA4\u51FA</th>
              <th class="px-4 py-3 text-left font-medium">\u4ECD\u7F3A</th>
            </tr>
          </thead>
          <tbody>
            ${rows.length ? rows.map(
    (item) => `
                        <tr class="border-b last:border-b-0 align-top">
                          <td class="px-4 py-3">
                            <div class="font-medium">${escapeHtml(item.skuLabel)}</div>
                            <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.partName)}</div>
                          </td>
                          <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.sourceCutOrderNo || "\u2014")}</td>
                          <td class="px-4 py-3 font-medium tabular-nums">${formatQty(item.requiredPieceQty)}</td>
                          <td class="px-4 py-3 tabular-nums">${formatQty(item.actualCutQty)}</td>
                          <td class="px-4 py-3 tabular-nums">${formatQty(item.waitHandoverStockQty)}</td>
                          <td class="px-4 py-3 tabular-nums">${formatQty(item.assignedPieceQty)}</td>
                          <td class="px-4 py-3 tabular-nums">${formatQty(item.handedOverPieceQty)}</td>
                          <td class="px-4 py-3 font-medium tabular-nums ${item.gapPieceQty > 0 ? "text-amber-700" : "text-emerald-700"}">${formatQty(item.gapPieceQty)}</td>
                        </tr>
                      `
  ).join("") : '<tr><td colspan="8" class="px-4 py-10 text-center text-sm text-muted-foreground">\u6682\u65E0 SKU / \u90E8\u4F4D\u6D41\u8F6C\u660E\u7EC6\u3002</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
function renderRiskPromptSection(row) {
  return `
    <section class="rounded-lg border bg-card p-4">
      <h3 class="text-sm font-semibold">\u98CE\u9669\u63D0\u793A</h3>
      <div class="mt-3 flex flex-wrap gap-2">
        ${row.riskTags.length ? row.riskTags.map((riskTag) => renderBadge(riskTag.label, riskTag.className)).join("") : '<span class="text-sm text-muted-foreground">\u65E0\u98CE\u9669</span>'}
      </div>
    </section>
  `;
}
function renderStageOverview(rows) {
  const total = rows.length || 1;
  const configuredCount = rows.filter((row) => row.materialPrepSummary.key === "CONFIGURED").length;
  const claimedCount = rows.filter((row) => row.materialClaimSummary.key === "RECEIVED").length;
  const spreadingProjection = buildMarkerSpreadingProjection();
  const rowIds = new Set(rows.map((row) => row.productionOrderId));
  const generatedSpreadingOrders = spreadingProjection.spreadingOrders.filter(
    (order) => order.productionOrderIds.some((productionOrderId) => rowIds.has(productionOrderId))
  );
  const markerCount = new Set(generatedSpreadingOrders.map((order) => order.markerPlanId)).size;
  const spreadingCount = generatedSpreadingOrders.length;
  const waitingSpreadingCount = generatedSpreadingOrders.filter((order) => order.status === "WAITING_SPREADING").length;
  const activeSpreadingCount = generatedSpreadingOrders.filter((order) => order.status === "SPREADING").length;
  const cutDoneCount = generatedSpreadingOrders.filter((order) => order.status === "CUT_DONE").length;
  const ticketCount = rows.filter((row) => row.pieceCompletionSummary.key !== "NOT_STARTED").length;
  const replenishmentCount = rows.filter((row) => row.riskTags.some((tag) => tag.key === "REPLENISH_PENDING")).length;
  const warehouseCount = rows.filter((row) => row.hasInboundRecord).length;
  const cards = [
    { label: "\u4E2D\u8F6C\u4ED3\u914D\u6599", value: `${configuredCount}/${total} \u6709\u914D\u6599\u6570\u91CF` },
    { label: "\u88C1\u5E8A\u9886\u6599", value: `${claimedCount}/${total} \u6709\u9886\u6599\u8BB0\u5F55` },
    { label: "\u551B\u67B6\u65B9\u6848", value: `${markerCount} \u4E2A\u5DF2\u786E\u8BA4` },
    { label: "\u94FA\u5E03\u5355", value: `${spreadingCount} \u5F20\uFF0C\u5F85\u94FA\u5E03 ${waitingSpreadingCount} / \u94FA\u5E03\u4E2D ${activeSpreadingCount} / \u5DF2\u88C1\u526A ${cutDoneCount}` },
    { label: "\u83F2\u7968", value: `${ticketCount}/${total} \u5DF2\u751F\u6210` },
    { label: "\u8865\u6599\u8BB0\u5F55", value: replenishmentCount ? `${replenishmentCount} \u6761\u5F85\u5904\u7406` : "\u6B63\u5E38" },
    { label: "\u5F85\u4EA4\u51FA\u4ED3\u5E93\u5B58", value: `${warehouseCount}/${total} \u6709\u5165\u4ED3\u8BB0\u5F55` }
  ];
  return `
    <section class="grid gap-3 md:grid-cols-4 xl:grid-cols-7">
      ${cards.map(
    (card) => `
            <article class="rounded-lg border bg-card px-4 py-3">
              <div class="text-xs text-muted-foreground">${escapeHtml(card.label)}</div>
              <div class="mt-2 text-base font-semibold text-foreground">${escapeHtml(card.value)}</div>
            </article>
          `
  ).join("")}
    </section>
  `;
}
const PRODUCTION_PROGRESS_TABLE_HEADERS = [
  "\u7D27\u6025\u7A0B\u5EA6",
  "\u751F\u4EA7\u5355\u53F7",
  "\u6B3E\u53F7 / SPU",
  "\u4E0B\u5355\u4EF6\u6570",
  "\u8BA1\u5212\u53D1\u8D27\u65E5\u671F",
  "\u4E2D\u8F6C\u4ED3\u914D\u6599",
  "\u88C1\u5E8A\u9886\u6599",
  "\u88C1\u7247\u5355\u6570",
  "\u5F53\u524D\u8FDB\u5C55",
  "\u90E8\u4F4D\u5DEE\u5F02",
  "\u98CE\u9669\u63D0\u793A",
  "\u64CD\u4F5C"
];
const CUT_ORDER_PROGRESS_TABLE_HEADERS = [
  "\u88C1\u7247\u5355",
  "\u751F\u4EA7\u5355\u4E0E\u6B3E\u5F0F",
  "\u9762\u6599 / \u7EB8\u6837",
  "\u6570\u91CF\u8D26",
  "\u4E3B\u72B6\u6001\u4E0E\u5224\u65AD",
  "\u4F5C\u4E1A\u5173\u7CFB",
  "\u4EA4\u51FA / \u7F3A\u53E3",
  "\u64CD\u4F5C"
];
function renderViewDimensionActions() {
  return `
    <div class="inline-flex rounded-md border bg-card">
      <button
        type="button"
        class="px-3 py-2 text-sm ${state.viewDimension === "CUT_ORDER" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}"
        data-cutting-progress-action="switch-view-dimension"
        data-view-dimension="CUT_ORDER"
      >
        \u88C1\u7247\u5355\u7EF4\u5EA6
      </button>
      <button
        type="button"
        class="border-l px-3 py-2 text-sm ${state.viewDimension === "PRODUCTION_ORDER" ? "bg-primary text-primary-foreground" : "hover:bg-muted"}"
        data-cutting-progress-action="switch-view-dimension"
        data-view-dimension="PRODUCTION_ORDER"
      >
        \u751F\u4EA7\u5355\u7EF4\u5EA6
      </button>
    </div>
  `;
}
function renderSkuCompletionSection(row) {
  const rows = row.skuProgressLines;
  if (!rows.length) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <div class="flex items-center justify-between gap-4">
          <h3 class="text-sm font-semibold">\u5F53\u524D\u8FDB\u5C55</h3>
        </div>
        <div class="mt-3 text-sm text-muted-foreground">\u5F53\u524D\u5C1A\u672A\u5F62\u6210 SKU \u660E\u7EC6\u3002</div>
      </section>
    `;
  }
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-4">
        <h3 class="text-sm font-semibold">\u5F53\u524D\u8FDB\u5C55</h3>
        <div class="flex flex-wrap gap-2">
          ${renderMetricChip("SKU \u603B\u6570", String(row.skuTotalCount))}
          ${renderMetricChip("\u5DF2\u5B8C\u6210 SKU", String(row.completedSkuCount), row.completedSkuCount < row.skuTotalCount ? "text-blue-600" : "text-emerald-600")}
          ${renderMetricChip("\u672A\u5B8C\u6210 SKU", String(row.incompleteSkuCount), row.incompleteSkuCount > 0 ? "text-amber-600" : "text-emerald-600")}
        </div>
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[860px] text-sm">
          <thead class="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left font-medium">SKU \u540D\u79F0&\u7F16\u7801</th>
              <th class="px-4 py-3 text-left font-medium">\u9700\u6C42\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09</th>
              <th class="px-4 py-3 text-left font-medium">\u5DF2\u88C1\u88C1\u7247\u7247\u6570\uFF08\u7247\uFF09</th>
              <th class="px-4 py-3 text-left font-medium">\u5DF2\u5165\u4ED3\u88C1\u7247\u7247\u6570\uFF08\u7247\uFF09</th>
              <th class="px-4 py-3 text-left font-medium">\u5B8C\u6210\u72B6\u6001</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(
    (item) => `
                  <tr class="border-b last:border-b-0 align-top">
                    <td class="px-4 py-3">
                      <div class="font-medium">${escapeHtml(item.skuLabel || item.skuDetailLabel || "-")}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.skuDetailLabel || "-")}</div>
                    </td>
                    <td class="px-4 py-3 font-medium tabular-nums">${formatQty(item.demandQty)}</td>
                    <td class="px-4 py-3 tabular-nums">${formatQty(item.cutQty)}</td>
                    <td class="px-4 py-3 tabular-nums">${formatQty(item.inboundQty)}</td>
                    <td class="px-4 py-3">
                      ${renderBadge(
      item.completionLabel,
      item.completionClassName.includes("emerald") ? "bg-emerald-100 text-emerald-700" : item.completionClassName.includes("orange") ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-700"
    )}
                    </td>
                  </tr>
                `
  ).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
function renderPieceGapSection(row) {
  const rows = row.pieceTruth.gapRows.filter((item) => Number(item.gapCutQty || 0) > 0 || Number(item.gapInboundQty || 0) > 0);
  if (!rows.length) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <div class="flex items-center justify-between gap-4">
          <h3 class="text-sm font-semibold">\u90E8\u4F4D\u5DEE\u5F02</h3>
          <div class="flex flex-wrap gap-2">
            ${renderMetricChip("\u5DF2\u5B8C\u6210\u90E8\u4F4D\u7247\u6570", formatQty(row.partDifferenceSummary.completedPieceQty), "text-emerald-700")}
            ${renderMetricChip("\u672A\u5B8C\u6210\u90E8\u4F4D\u7247\u6570", formatQty(row.partDifferenceSummary.incompletePieceQty), row.partDifferenceSummary.incompletePieceQty > 0 ? "text-amber-700" : "text-slate-900")}
          </div>
        </div>
        <div class="mt-3 text-sm text-muted-foreground">\u5F53\u524D\u65E0\u672A\u5B8C\u6210\u90E8\u4F4D\u3002</div>
      </section>
    `;
  }
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-4">
        <h3 class="text-sm font-semibold">\u90E8\u4F4D\u5DEE\u5F02</h3>
        <div class="flex flex-wrap gap-2">
          ${renderMetricChip("\u5DF2\u5B8C\u6210\u90E8\u4F4D\u7247\u6570", formatQty(row.partDifferenceSummary.completedPieceQty), "text-emerald-700")}
          ${renderMetricChip("\u672A\u5B8C\u6210\u90E8\u4F4D\u7247\u6570", formatQty(row.partDifferenceSummary.incompletePieceQty), "text-amber-700")}
        </div>
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[1080px] text-sm">
          <thead class="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left font-medium">\u88C1\u7247\u5355\u53F7</th>
              <th class="px-4 py-3 text-left font-medium">\u9762\u6599</th>
              <th class="px-4 py-3 text-left font-medium">SKU</th>
              <th class="px-4 py-3 text-left font-medium">\u90E8\u4F4D\u540D\u79F0</th>
              <th class="px-4 py-3 text-left font-medium">\u7406\u8BBA\u7247\u6570</th>
              <th class="px-4 py-3 text-left font-medium">\u672A\u5B8C\u6210\u7247\u6570</th>
              <th class="px-4 py-3 text-left font-medium">\u5B9E\u9645\u4EA7\u51FA</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(
    (item) => `
                  <tr class="border-b last:border-b-0 align-top">
                    <td class="px-4 py-3 font-medium">${escapeHtml(resolveGapRowCutOrderNo(row, item))}</td>
                    <td class="px-4 py-3">
                      ${renderMaterialIdentityBlock(
      {
        materialSku: item.materialSku,
        materialName: findProgressMaterialIdentity(row, item.materialSku)?.materialName || "\u90E8\u4F4D\u5DEE\u5F02\u9762\u6599",
        materialColor: findProgressMaterialIdentity(row, item.materialSku)?.materialColor || "",
        materialAlias: findProgressMaterialIdentity(row, item.materialSku)?.materialAlias || "",
        materialImageUrl: findProgressMaterialIdentity(row, item.materialSku)?.materialImageUrl || "",
        materialUnit: findProgressMaterialIdentity(row, item.materialSku)?.materialUnit || ""
      },
      { compact: true, imageSizeClass: "h-9 w-9", showCategory: false }
    )}
                    </td>
                    <td class="px-4 py-3">
                      <div class="font-medium">${escapeHtml(item.skuCode || `${item.color}/${item.size}`)}</div>
                      <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(`${item.color} / ${item.size}`)}</div>
                    </td>
                    <td class="px-4 py-3">
                      <div class="font-medium">${escapeHtml(item.partName)}</div>
                      ${item.patternName ? `<div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.patternName)}</div>` : ""}
                    </td>
                    <td class="px-4 py-3 tabular-nums">${formatQty(item.requiredPieceQty)}</td>
                    <td class="px-4 py-3">
                      <div class="font-medium tabular-nums ${item.gapCutQty > 0 ? "text-rose-600" : "text-amber-600"}">
                        ${formatQty(item.gapCutQty > 0 ? item.gapCutQty : item.gapInboundQty)}
                      </div>
                    </td>
                    <td class="px-4 py-3 text-xs text-muted-foreground">${escapeHtml(item.currentStateLabel)}</td>
                  </tr>
                `
  ).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
function renderSourceOrderSection(row) {
  const rows = row.sourceOrderProgressLines;
  if (!rows.length) {
    return `
      <section class="rounded-lg border bg-card p-4">
        <div class="flex items-center justify-between gap-4">
          <h3 class="text-sm font-semibold">\u6765\u6E90\u88C1\u7247\u5355</h3>
          <span class="text-xs text-muted-foreground">\u6682\u65E0\u6765\u6E90\u88C1\u7247\u5355</span>
        </div>
      </section>
    `;
  }
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-4">
        <h3 class="text-sm font-semibold">\u6765\u6E90\u88C1\u7247\u5355</h3>
        ${renderMetricChip("\u88C1\u7247\u5355\u6570", String(row.cutOrderCount), "text-slate-900")}
      </div>
      <div class="mt-4 overflow-x-auto">
        <table class="w-full min-w-[1080px] text-sm">
          <thead class="border-b bg-muted/30 text-muted-foreground">
            <tr>
              <th class="px-4 py-3 text-left font-medium">\u88C1\u7247\u5355\u53F7</th>
              <th class="px-4 py-3 text-left font-medium">\u9762\u6599</th>
              <th class="px-4 py-3 text-left font-medium">\u7EB8\u6837</th>
              <th class="px-4 py-3 text-left font-medium">\u627F\u63A5 SKU \u6570</th>
              <th class="px-4 py-3 text-left font-medium">\u672A\u5B8C\u6210\u90E8\u4F4D\u7247\u6570</th>
              <th class="px-4 py-3 text-left font-medium">\u5B9E\u9645\u4EA7\u51FA</th>
              <th class="px-4 py-3 text-left font-medium">\u64CD\u4F5C</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(
    (item) => `
                  <tr class="border-b last:border-b-0 align-top">
                    <td class="px-4 py-3 font-medium">${escapeHtml(item.cutOrderNo)}</td>
                    <td class="px-4 py-3">
                      ${renderMaterialIdentityBlock(
      {
        materialSku: item.materialSku,
        materialName: item.materialName,
        materialColor: item.materialColor,
        materialAlias: item.materialAlias,
        materialImageUrl: item.materialImageUrl,
        materialUnit: item.materialUnit
      },
      { compact: true, imageSizeClass: "h-9 w-9", showCategory: false }
    )}
                    </td>
                    <td class="px-4 py-3">
                      <div class="space-y-1 text-xs">
                        <div class="text-sm font-medium text-foreground">${escapeHtml(item.patternFileName || "\u5F85\u8865\u7EB8\u6837\u6587\u4EF6")}</div>
                        <div class="text-muted-foreground">\u7248\u672C\uFF1A${escapeHtml(item.patternVersion || "\u5F85\u8865")}</div>
                        <div class="text-muted-foreground">\u6709\u6548\u5E45\u5BBD\uFF1A${escapeHtml(item.effectiveWidthText || "\u5F85\u8865")}</div>
                      </div>
                    </td>
                    <td class="px-4 py-3 tabular-nums">${formatQty(item.skuCount)}</td>
                    <td class="px-4 py-3 tabular-nums">${formatQty(item.incompletePieceQty)}</td>
                    <td class="px-4 py-3">${escapeHtml(item.currentStateLabel)}</td>
                    <td class="px-4 py-3">
                      <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-progress-action="go-cut-orders" data-record-id="${row.id}">\u67E5\u770B\u88C1\u7247\u5355</button>
                    </td>
                  </tr>
                `
  ).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}
function renderMappingWarningSection(row) {
  const mappingIssues = row.pieceTruth.mappingIssues;
  const dataIssues = row.pieceTruth.dataIssues;
  const issues = [...mappingIssues, ...dataIssues];
  return `
    <section class="rounded-lg border bg-card p-4">
      <div class="flex items-center justify-between gap-4">
        <h3 class="text-sm font-semibold">\u6620\u5C04\u4E0E\u6570\u636E\u95EE\u9898</h3>
        ${issues.length ? renderMetricChip("\u95EE\u9898\u9879", String(issues.length), "text-amber-600") : '<span class="text-xs text-muted-foreground">\u5F53\u524D\u65E0\u95EE\u9898</span>'}
      </div>
      ${issues.length ? `
            <div class="mt-3 space-y-2">
              ${issues.map(
    (issue) => `
                    <div class="rounded-lg border ${issue.level === "mapping" ? "border-amber-200 bg-amber-50" : "border-slate-200 bg-slate-50"} px-3 py-2 text-xs">
                      <div class="font-medium ${issue.level === "mapping" ? "text-amber-700" : "text-slate-700"}">${escapeHtml(issue.level === "mapping" ? "\u6620\u5C04\u7F3A\u5931" : "\u6570\u636E\u5F85\u8865")}</div>
                      <div class="mt-1 text-muted-foreground">${escapeHtml(issue.message)}</div>
                    </div>
                  `
  ).join("")}
            </div>
          ` : ""}
    </section>
  `;
}
function renderProductionOrderTable(rows) {
  const pagination = paginateItems(rows, state.page, state.pageSize);
  const columnCount = PRODUCTION_PROGRESS_TABLE_HEADERS.length;
  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">\u751F\u4EA7\u5355\u4E3B\u8868</h2>
          <div class="mt-1 text-xs text-muted-foreground">\u6C47\u603B\u67E5\u770B\u5F53\u524D\u751F\u4EA7\u5355\u5728\u88C1\u5E8A\u7684\u6574\u4F53\u63A8\u8FDB\u60C5\u51B5\u3002</div>
        </div>
        <div class="text-xs text-muted-foreground">\u5171 ${pagination.total} \u6761\u751F\u4EA7\u5355</div>
      </div>
      ${renderStickyTableScroller(
    `
          <table class="w-full min-w-[1440px] text-sm" data-testid="cutting-production-progress-main-table">
            <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
              <tr>
                ${PRODUCTION_PROGRESS_TABLE_HEADERS.map(
      (header) => `<th class="px-4 py-3 text-left font-medium">${header}</th>`
    ).join("")}
              </tr>
            </thead>
            <tbody>
              ${pagination.items.length ? pagination.items.map(
      (row) => `
                          <tr class="border-b last:border-b-0 align-top hover:bg-muted/20">
                            <td class="px-4 py-3">
                              <div>${renderBadge(row.urgency.label, row.urgency.className)}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.shipCountdownText)}</div>
                            </td>
                            <td class="px-4 py-3">
                              <button class="font-medium text-blue-600 hover:underline" data-cutting-progress-action="open-detail" data-record-id="${row.id}">
                                ${escapeHtml(row.productionOrderNo)}
                              </button>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(formatFactoryDisplayName(row.assignedFactoryName))}</div>
                            </td>
                            <td class="px-4 py-3">
                              <div class="font-medium text-foreground">${escapeHtml(row.styleCode || row.spuCode || "-")}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(row.styleName || row.spuCode || "-")}</div>
                            </td>
                            <td class="px-4 py-3 font-medium tabular-nums">${formatQty(row.orderQty)}</td>
                            <td class="px-4 py-3">
                              <div>${escapeHtml(row.plannedShipDateDisplay)}</div>
                            </td>
                            <td class="px-4 py-3">${renderPrepProgressCell(row)}</td>
                            <td class="px-4 py-3">${renderClaimProgressCell(row)}</td>
                            <td class="px-4 py-3 font-medium">${row.cutOrderCount}</td>
                            <td class="px-4 py-3">${renderSkuProgressCell(row)}</td>
                            <td class="px-4 py-3">${renderPartDifferenceCell(row)}</td>
                            <td class="px-4 py-3">${renderRiskCell(row)}</td>
                            <td class="px-4 py-3">
                              <div class="flex flex-wrap gap-2">
                                <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-progress-action="open-detail" data-record-id="${row.id}">\u67E5\u770B\u8BE6\u60C5</button>
                                <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-progress-action="go-marker-spreading" data-record-id="${row.id}">\u53BB\u94FA\u5E03</button>
                              </div>
                            </td>
                          </tr>
                        `
    ).join("") : `<tr><td colspan="${columnCount}" class="px-6 py-12 text-center text-sm text-muted-foreground">\u5F53\u524D\u7B5B\u9009\u6761\u4EF6\u4E0B\u6682\u65E0\u5339\u914D\u751F\u4EA7\u5355\u3002</td></tr>`}
            </tbody>
          </table>
        `,
    "max-h-[64vh]"
  )}
      ${renderWorkbenchPagination({
    page: pagination.page,
    pageSize: pagination.pageSize,
    total: pagination.total,
    actionAttr: "data-cutting-progress-action",
    pageAction: "set-page",
    pageSizeAttr: "data-cutting-progress-page-size"
  })}
    </section>
  `;
}
function renderCutOrderTable(rows) {
  const cutOrderRows = buildCutOrderDimensionRows(rows);
  const pagination = paginateItems(cutOrderRows, state.page, state.pageSize);
  const columnCount = CUT_ORDER_PROGRESS_TABLE_HEADERS.length;
  return `
    <section class="rounded-lg border bg-card">
      <div class="flex items-center justify-between border-b px-4 py-3">
        <div>
          <h2 class="text-sm font-semibold">\u88C1\u7247\u5355\u4E3B\u8868</h2>
          <div class="mt-1 text-xs text-muted-foreground">\u9ED8\u8BA4\u6309\u88C1\u7247\u5355\u7EF4\u5EA6\u67E5\u770B\u5F85\u52A0\u5DE5\u5165\u4ED3\u3001\u94FA\u5E03\u88C1\u526A\u3001\u7279\u6B8A\u5DE5\u827A\u56DE\u4ED3\u548C\u4EA4\u51FA\u8BB0\u5F55\u3002</div>
        </div>
        <div class="text-xs text-muted-foreground">\u5171 ${pagination.total} \u6761\u88C1\u7247\u5355</div>
      </div>
      ${renderStickyTableScroller(
    `
          <table class="w-full table-fixed text-sm" data-testid="cutting-production-progress-cut-order-table">
            <thead class="sticky top-0 z-10 border-b bg-muted/95 text-muted-foreground backdrop-blur">
              <tr>
                <th class="w-[13%] px-4 py-3 text-left font-medium">\u88C1\u7247\u5355</th>
                <th class="w-[14%] px-4 py-3 text-left font-medium">\u751F\u4EA7\u5355\u4E0E\u6B3E\u5F0F</th>
                <th class="w-[19%] px-4 py-3 text-left font-medium">\u9762\u6599 / \u7EB8\u6837</th>
                <th class="w-[17%] px-4 py-3 text-left font-medium">\u6570\u91CF\u8D26</th>
                <th class="w-[13%] px-4 py-3 text-left font-medium">\u4E3B\u72B6\u6001\u4E0E\u5224\u65AD</th>
                <th class="w-[12%] px-4 py-3 text-left font-medium">\u4F5C\u4E1A\u5173\u7CFB</th>
                <th class="w-[8%] px-4 py-3 text-left font-medium">\u4EA4\u51FA / \u7F3A\u53E3</th>
                <th class="w-[4%] px-4 py-3 text-left font-medium">\u64CD\u4F5C</th>
              </tr>
            </thead>
            <tbody>
              ${pagination.items.length ? pagination.items.map(
      (item) => `
                          <tr class="border-b last:border-b-0 align-top hover:bg-muted/20">
                            <td class="px-4 py-3">
                              <div class="font-medium text-blue-600">${escapeHtml(item.cutOrderNo)}</div>
                              <div class="mt-1">${renderBadge(item.urgencyLabel, item.urgencyClassName)}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.plannedShipDateDisplay)}</div>
                            </td>
                            <td class="px-4 py-3">
                              <button class="font-medium text-blue-600 hover:underline" data-cutting-progress-action="open-detail" data-record-id="${item.parentRecordId}">
                                ${escapeHtml(item.productionOrderNo)}
                              </button>
                              <div class="font-medium text-foreground">${escapeHtml(item.styleLabel)}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(item.styleName)}</div>
                              <div class="mt-1 text-xs text-muted-foreground">${escapeHtml(formatFactoryDisplayName(item.factoryName))}</div>
                            </td>
                            <td class="px-4 py-3">
                              <div class="space-y-2">
                                ${renderMaterialIdentityBlock(
        item.quantityLedger.materialIdentity,
        { compact: true, imageSizeClass: "h-9 w-9", showCategory: false }
      )}
                                <div class="text-xs text-muted-foreground">
                                  <div>${escapeHtml(item.quantityLedger.patternIdentity.patternFileName || "\u5F85\u8865\u7EB8\u6837\u6587\u4EF6")}</div>
                                  <div>\u7248\u672C\uFF1A${escapeHtml(item.quantityLedger.patternIdentity.patternVersion || "\u5F85\u8865")} / \u5E45\u5BBD\uFF1A${escapeHtml(`${item.quantityLedger.patternIdentity.effectiveWidthValue || "\u5F85\u8865"}${item.quantityLedger.patternIdentity.effectiveWidthUnit || ""}`)}</div>
                                </div>
                              </div>
                            </td>
                            <td class="px-4 py-3">
                              ${renderMaterialLedgerLine(item.quantityLedger, [
        ["\u9700\u6C42\u7528\u91CF", "requiredMaterialQty"],
        ["\u4E2D\u8F6C\u4ED3\u5DF2\u914D\u6570\u91CF", "transferWarehouseAllocatedQty"],
        ["\u88C1\u5E8A\u5DF2\u9886\u6570\u91CF", "cuttingClaimedQty"],
        ["\u5DF2\u9501\u5B9A\u6570\u91CF", "markerLockedQty"],
        ["\u5DF2\u6D88\u8017\u6570\u91CF", "spreadingConsumedQty"],
        ["\u53EF\u7528\u4F59\u989D", "availableQty"]
      ])}
                            </td>
                            <td class="px-4 py-3">
                              <div class="space-y-2">
                                ${renderBadge(item.mainStatusLabel, item.mainStatusClassName)}
                                ${renderBadge(item.cuttableLabel, item.cuttableClassName)}
                                <div class="text-xs leading-5 text-muted-foreground">
                                  <div>\u5224\u65AD\u539F\u56E0\uFF1A${escapeHtml(item.cuttableReasonText)}</div>
                                  ${item.closeReason ? `<div>\u5173\u95ED\u539F\u56E0\uFF1A${escapeHtml(item.closeReasonText || item.closeReason)}</div>` : ""}
                                </div>
                              </div>
                            </td>
                            <td class="px-4 py-3">
                              <div class="space-y-1 text-xs text-muted-foreground">
                                <div>\u551B\u67B6\u65B9\u6848\uFF1A${escapeHtml(item.markerRelationText)}</div>
                                <div>${escapeHtml(item.operationResultText)}</div>
                                <div>\u7279\u6B8A\u5DE5\u827A\uFF1A${escapeHtml(item.specialCraftReturnLabel)}${item.specialCraftReturnDetail ? ` \xB7 ${escapeHtml(item.specialCraftReturnDetail)}` : ""}</div>
                              </div>
                            </td>
                            <td class="px-4 py-3">
                              <div class="space-y-1 text-xs text-muted-foreground">
                                <div>\u4EA4\u51FA\u5355\uFF1A${escapeHtml(item.sewingDispatchLabel)}</div>
                                <div>${escapeHtml(item.sewingDispatchDetail || "\u6682\u65E0\u888B\u7EA7 / \u83F2\u7968\u7EA7\u56DE\u5199")}</div>
                                <div>\u5F85\u5904\u7406\u5DEE\u5F02\uFF1A${escapeHtml(`${item.pendingDifferenceCount} \u9879`)}</div>
                                <div class="${item.blockingText === "\u6682\u65E0\u98CE\u9669" ? "text-emerald-700" : "text-amber-700"}">${escapeHtml(item.blockingText)}</div>
                              </div>
                            </td>
                            <td class="px-4 py-3">
                              <div class="flex flex-col gap-1">
                                <button class="rounded-md border px-2.5 py-1 text-xs hover:bg-muted" data-cutting-progress-action="open-detail" data-record-id="${item.parentRecordId}">\u67E5\u770B\u8BE6\u60C5</button>
                              </div>
                            </td>
                          </tr>
                        `
    ).join("") : `<tr><td colspan="${columnCount}" class="px-6 py-12 text-center text-sm text-muted-foreground">\u5F53\u524D\u7B5B\u9009\u6761\u4EF6\u4E0B\u6682\u65E0\u5339\u914D\u88C1\u7247\u5355\u3002</td></tr>`}
            </tbody>
          </table>
        `,
    "max-h-[64vh]"
  )}
      ${renderWorkbenchPagination({
    currentPage: pagination.page,
    totalPages: pagination.totalPages,
    pageSize: state.pageSize,
    pageSizeOptions: [10, 20, 50]
  })}
    </section>
  `;
}
function renderMainTable(rows) {
  return state.viewDimension === "CUT_ORDER" ? renderCutOrderTable(rows) : renderProductionOrderTable(rows);
}
function renderDetailDrawer() {
  const row = getAllRows().find((item) => item.id === state.activeDetailId);
  if (!row) return "";
  const content = `
    <div class="space-y-6">
      <section class="grid gap-3 rounded-lg border bg-muted/10 p-4 sm:grid-cols-2 xl:grid-cols-4">
        ${renderDetailSummaryItem("\u751F\u4EA7\u5355\u53F7", row.productionOrderNo)}
        ${renderDetailSummaryItem("\u6B3E\u53F7 / SPU", row.styleCode || row.spuCode || "-")}
        ${renderDetailSummaryItem("\u6B3E\u5F0F\u540D\u79F0", row.styleName || "-")}
        ${renderDetailSummaryItem("\u5DE5\u5382", formatFactoryDisplayName(row.assignedFactoryName) || "-")}
        ${renderDetailSummaryItem("\u672C\u5355\u6210\u8863\u4EF6\u6570\uFF08\u4EF6\uFF09", formatQty(row.orderQty))}
        ${renderDetailSummaryItem("\u8BA1\u5212\u53D1\u8D27\u65E5\u671F", row.plannedShipDateDisplay)}
        ${renderDetailSummaryItem("\u7D27\u6025\u7A0B\u5EA6", `${row.urgency.label} \xB7 ${row.shipCountdownText}`)}
        ${renderDetailSummaryItem("\u88C1\u7247\u5355\u6570", formatQty(row.cutOrderCount))}
        ${renderDetailSummaryItem("\u8865\u6599\u914D\u6599\u5F85\u5904\u7406", buildPendingPrepSummaryText(row))}
      </section>

      ${renderFullChainDetailSection(row)}
      ${renderMaterialProgressSection(row)}
      ${renderProductionPartFlowSection(row)}
      ${renderSkuCompletionSection(row)}
      ${renderPieceGapSection(row)}
      ${renderSourceOrderSection(row)}
      ${renderRiskPromptSection(row)}
    </div>
  `;
  return uiDrawer(
    {
      title: "\u751F\u4EA7\u5355\u8BE6\u60C5",
      subtitle: row.productionOrderNo,
      closeAction: { prefix: "cutting-progress", action: "close-detail" },
      width: "lg"
    },
    content,
    {
      cancel: { prefix: "cutting-progress", action: "close-detail", label: "\u5173\u95ED" }
    }
  );
}
function renderCraftCuttingProductionProgressPage() {
  syncDrillContextFromPath();
  const pathname = appStore.getState().pathname;
  const meta = getCanonicalCuttingMeta(pathname, "production-progress");
  const rows = getDisplayRows();
  return `
    <div class="space-y-3 p-4">
      ${renderCuttingPageHeader(meta, {
    actionsHtml: renderViewDimensionActions(),
    showAliasBadge: isCuttingAliasPath(pathname)
  })}

      ${renderStatsCards(rows)}
      ${renderFullChainOverviewCards(rows)}

      ${renderStickyFilterShell(`
        <div class="space-y-3">
          ${renderQuickFilterRow()}
          <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <label class="space-y-2 md:col-span-2 xl:col-span-2">
              <span class="text-sm font-medium text-foreground">\u5173\u952E\u8BCD</span>
              <input
                type="text"
                value="${escapeHtml(state.filters.keyword)}"
                placeholder="\u652F\u6301\u751F\u4EA7\u5355\u53F7 / \u6B3E\u53F7 / SPU"
                class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-cutting-progress-field="keyword"
              />
            </label>
            <label class="space-y-2">
              <span class="text-sm font-medium text-foreground">\u751F\u4EA7\u5355\u53F7</span>
              <input
                type="text"
                value="${escapeHtml(state.filters.productionOrderNo)}"
                placeholder="PO-..."
                class="h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
                data-cutting-progress-field="production-order"
              />
            </label>
            ${renderFilterSelect("\u5B8C\u6210\u72B6\u6001", "completion", state.filters.completionState, [
    { value: "ALL", label: "\u5168\u90E8" },
    { value: "IN_PROGRESS", label: "\u8FDB\u884C\u4E2D" },
    { value: "COMPLETED", label: "\u5DF2\u5B8C\u6210" },
    { value: "DATA_PENDING", label: "\u6570\u636E\u5F85\u8865" },
    { value: "HAS_EXCEPTION", label: "\u6709\u5F02\u5E38" }
  ])}
            ${renderFilterSelect("\u7D27\u6025\u7A0B\u5EA6", "urgency", state.filters.urgencyLevel, [
    { value: "ALL", label: "\u5168\u90E8" },
    { value: "AA", label: "AA \u7D27\u6025" },
    { value: "A", label: "A \u7D27\u6025" },
    { value: "B", label: "B \u7D27\u6025" },
    { value: "C", label: "C \u4F18\u5148" },
    { value: "D", label: "D \u5E38\u89C4" },
    { value: "UNKNOWN", label: "\u5F85\u8865\u65E5\u671F" }
  ])}
            ${renderFilterSelect("\u4E0E\u8BA1\u5212\u53D1\u8D27\u76F8\u6BD4", "ship-delta", state.filters.shipDeltaRange, [
    { value: "ALL", label: "\u5168\u90E8" },
    { value: "BEFORE_0_3", label: "\u8DDD\u8BA1\u5212\u53D1\u8D27 0~3 \u5929" },
    { value: "BEFORE_4_6", label: "\u8DDD\u8BA1\u5212\u53D1\u8D27 4~6 \u5929" },
    { value: "BEFORE_7_9", label: "\u8DDD\u8BA1\u5212\u53D1\u8D27 7~9 \u5929" },
    { value: "BEFORE_10_13", label: "\u8DDD\u8BA1\u5212\u53D1\u8D27 10~13 \u5929" },
    { value: "BEFORE_14_PLUS", label: "\u8DDD\u8BA1\u5212\u53D1\u8D27 14 \u5929\u4EE5\u4E0A" },
    { value: "OVERDUE_0_3", label: "\u8D85\u8BA1\u5212\u53D1\u8D27 0~3 \u5929" },
    { value: "OVERDUE_4_6", label: "\u8D85\u8BA1\u5212\u53D1\u8D27 4~6 \u5929" },
    { value: "OVERDUE_7_PLUS", label: "\u8D85\u8BA1\u5212\u53D1\u8D27 7 \u5929\u4EE5\u4E0A" },
    { value: "SHIP_DATE_MISSING", label: "\u8BA1\u5212\u53D1\u8D27\u65E5\u671F\u5F85\u8865" }
  ])}
            ${renderFilterSelect("\u88C1\u5E8A\u4E3B\u72B6\u6001", "stage", state.filters.currentStage, [
    { value: "ALL", label: "\u5168\u90E8" },
    { value: "NOT_STARTED", label: "\u672A\u5F00\u5DE5" },
    { value: "STARTED", label: "\u5DF2\u5F00\u5DE5" }
  ])}
            ${renderFilterSelect("\u4E2D\u8F6C\u4ED3\u914D\u6599", "config", state.filters.configStatus, [
    { value: "ALL", label: "\u5168\u90E8" },
    { value: "NOT_CONFIGURED", label: "\u65E0\u914D\u6599\u6570\u91CF" },
    { value: "PARTIAL", label: "\u914D\u6599\u6570\u91CF\u4E0D\u8DB3" },
    { value: "CONFIGURED", label: "\u6709\u914D\u6599\u6570\u91CF" }
  ])}
            ${renderFilterSelect("\u88C1\u5E8A\u9886\u6599", "claim", state.filters.receiveStatus, [
    { value: "ALL", label: "\u5168\u90E8" },
    { value: "NOT_RECEIVED", label: "\u672A\u4EA7\u751F\u9886\u6599\u8BB0\u5F55" },
    { value: "PARTIAL", label: "\u9886\u6599\u6570\u91CF\u4E0D\u8DB3" },
    { value: "RECEIVED", label: "\u6709\u9886\u6599\u8BB0\u5F55" },
    { value: "EXCEPTION", label: "\u9886\u6599\u5DEE\u5F02" }
  ])}
            ${renderFilterSelect("\u98CE\u9669\u72B6\u6001", "risk", state.filters.riskFilter, [
    { value: "ALL", label: "\u5168\u90E8" },
    { value: "ANY", label: "\u4EC5\u770B\u6709\u98CE\u9669" },
    { value: "CONFIG_DELAY", label: "\u4E2D\u8F6C\u4ED3\u6EDE\u540E" },
    { value: "SHIP_URGENT", label: "\u4E34\u8FD1\u53D1\u8D27" },
    { value: "REPLENISH_PENDING", label: "\u5F85\u8865\u6599" },
    { value: "PIECE_GAP", label: "\u88C1\u7247\u7F3A\u53E3" }
  ])}
            ${renderFilterSelect("\u6392\u5E8F", "sort", state.filters.sortBy, [
    { value: "URGENCY_THEN_SHIP", label: "\u9ED8\u8BA4\uFF1A\u7D27\u6025\u7A0B\u5EA6 + \u53D1\u8D27\u65F6\u95F4" },
    { value: "SHIP_DATE_ASC", label: "\u8BA1\u5212\u53D1\u8D27\u65E5\u671F\u5347\u5E8F" },
    { value: "ORDER_QTY_DESC", label: "\u672C\u5355\u6210\u8863\u4EF6\u6570\u964D\u5E8F" }
  ])}
          </div>
        </div>
      `)}

      ${renderActiveStateBar()}
      ${renderMainTable(rows)}
      ${renderDetailDrawer()}
    </div>
  `;
}
function findRowById(recordId) {
  if (!recordId) return void 0;
  return getAllRows().find((row) => row.id === recordId);
}
function navigateToRecordTarget(recordId, key) {
  const row = findRowById(recordId);
  if (!row) return false;
  const payload = key === "spreading-list" || key === "marker-spreading" || key === "marker-list" ? row.filterPayloadForMarkerSpreading : key === "fei-tickets" ? row.filterPayloadForFeiTickets : key === "cuttable-pool" ? row.filterPayloadForCuttablePool : key === "summary" ? row.filterPayloadForSummary : row.filterPayloadForCutOrders;
  const context = buildCuttingDrillContext(payload, "production-progress", {
    productionOrderId: row.productionOrderId,
    productionOrderNo: row.productionOrderNo,
    autoOpenDetail: true
  });
  appStore.navigate(buildCuttingRouteWithContext(
    key === "summary" ? "summary" : key === "cut-orders" ? "cutOrders" : key === "cuttable-pool" ? "cuttablePool" : key === "spreading-list" || key === "marker-spreading" ? "markerSpreading" : key === "marker-list" ? "markerPlan" : key === "fei-tickets" ? "feiTickets" : "productionProgress",
    context
  ));
  return true;
}
function handleCraftCuttingProductionProgressEvent(target) {
  const pageSizeNode = target.closest("[data-cutting-progress-page-size]");
  if (pageSizeNode) {
    const input = pageSizeNode;
    state.pageSize = Number(input.value) || 20;
    state.page = 1;
    return true;
  }
  const fieldNode = target.closest("[data-cutting-progress-field]");
  if (fieldNode) {
    const field = fieldNode.dataset.cuttingProgressField;
    if (!field) return false;
    const filterKey = FIELD_TO_FILTER_KEY[field];
    const input = fieldNode;
    state.filters = {
      ...state.filters,
      [filterKey]: input.value
    };
    resetPagination();
    return true;
  }
  const actionNode = target.closest("[data-cutting-progress-action]");
  const action = actionNode?.dataset.cuttingProgressAction;
  if (!action) return false;
  if (action === "toggle-quick-filter") {
    const quickFilter = actionNode.dataset.quickFilter;
    if (!quickFilter) return false;
    state.activeQuickFilter = state.activeQuickFilter === quickFilter ? null : quickFilter;
    resetPagination();
    return true;
  }
  if (action === "clear-filters") {
    state.filters = { ...initialFilters };
    state.viewDimension = "CUT_ORDER";
    state.activeQuickFilter = null;
    resetPagination();
    return true;
  }
  if (action === "clear-prefilter") {
    state.drillContext = null;
    state.querySignature = getCanonicalCuttingPath("production-progress");
    state.filters = { ...initialFilters };
    state.activeQuickFilter = null;
    state.activeDetailId = null;
    appStore.navigate(getCanonicalCuttingPath("production-progress"));
    return true;
  }
  if (action === "open-detail") {
    state.activeDetailId = actionNode.dataset.recordId ?? null;
    return true;
  }
  if (action === "close-detail") {
    state.activeDetailId = null;
    return true;
  }
  if (action === "set-page") {
    state.page = Number(actionNode.dataset.page) || 1;
    return true;
  }
  if (action === "switch-view-dimension") {
    const nextDimension = actionNode.dataset.viewDimension;
    if (!nextDimension) return false;
    state.viewDimension = nextDimension;
    resetPagination();
    return true;
  }
  if (action === "go-cut-orders") {
    return navigateToRecordTarget(actionNode.dataset.recordId, "cut-orders");
  }
  if (action === "go-material-prep") {
    const row = findRowById(actionNode.dataset.recordId);
    if (!row) return false;
    const context = buildCuttingDrillContext(row.filterPayloadForMaterialPrep, "production-progress", {
      productionOrderId: row.productionOrderId,
      productionOrderNo: row.productionOrderNo,
      autoOpenDetail: true
    });
    appStore.navigate(buildCuttingRouteWithContext("materialPrep", context));
    return true;
  }
  if (action === "go-cuttable-pool") {
    return navigateToRecordTarget(actionNode.dataset.recordId, "cuttable-pool");
  }
  if (action === "go-marker-spreading") {
    return navigateToRecordTarget(actionNode.dataset.recordId, "spreading-list");
  }
  if (action === "go-fei-tickets") {
    return navigateToRecordTarget(actionNode.dataset.recordId, "fei-tickets");
  }
  if (action === "go-summary") {
    return navigateToRecordTarget(actionNode.dataset.recordId, "summary");
  }
  if (action === "go-cuttable-pool-index") {
    appStore.navigate(getCanonicalCuttingPath("cuttable-pool"));
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
function isCraftCuttingProductionProgressDialogOpen() {
  return state.activeDetailId !== null;
}
export {
  handleCraftCuttingProductionProgressEvent,
  isCraftCuttingProductionProgressDialogOpen,
  renderCraftCuttingProductionProgressPage
};
