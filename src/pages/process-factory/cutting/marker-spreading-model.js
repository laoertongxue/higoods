import {
  DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES
} from "./cutting-table-resource.ts";
const numberFormatter = new Intl.NumberFormat("zh-CN");
const CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY = "cuttingMarkerSpreadingLedger";
const MARKER_SIZE_KEYS = ["S", "M", "L", "XL", "2XL", "3XL", "4XL", "onesize", "plusonesize"];
const DEFAULT_HIGH_LOW_PATTERN_KEYS = ["S*1", "XL*1", "L*1+plusonesize", "M*1+onesize", "2XL"];
function normalizeSpreadingIdentityToken(value, fallback) {
  const normalized = String(value || "").trim().replace(/[\\/\s]+/g, "-").replace(/[^A-Za-z0-9\u4e00-\u9fa5_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
  return normalized || fallback;
}
function buildSpreadingSessionIdentityForMarkerBed(source, index = 0) {
  const fallbackIndex = String(index + 1).padStart(2, "0");
  const schemeIdToken = normalizeSpreadingIdentityToken(
    source.sourceSchemeId || source.markerPlanId || source.sourceSchemeNo || source.markerPlanNo,
    `scheme-${fallbackIndex}`
  );
  const bedIdToken = normalizeSpreadingIdentityToken(
    source.sourceBedId || source.markerId || source.sourceBedNo || source.markerNo,
    `bed-${fallbackIndex}`
  );
  const schemeNoToken = normalizeSpreadingIdentityToken(
    source.sourceSchemeNo || source.markerPlanNo || source.sourceSchemeId || source.markerPlanId,
    `MK-${fallbackIndex}`
  );
  const bedNoToken = normalizeSpreadingIdentityToken(
    source.sourceBedNo || source.markerNo || source.sourceBedId || source.markerId,
    `BED-${fallbackIndex}`
  );
  return {
    spreadingSessionId: `spreading-session-${schemeIdToken}-${bedIdToken}`,
    sessionNo: `PB-${schemeNoToken}-${bedNoToken}`
  };
}
const markerModeMeta = {
  normal: {
    label: "\u666E\u901A\u551B\u67B6",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
    detailText: "\u666E\u901A\u551B\u67B6\u94FA\u5E03\u3002"
  },
  high_low: {
    label: "\u9AD8\u4F4E\u5C42\u551B\u67B6",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
    detailText: "\u9AD8\u4F4E\u5C42\u551B\u67B6\u94FA\u5E03\u3002"
  },
  fold_normal: {
    label: "\u5BF9\u6298\u666E\u901A\u551B\u67B6",
    className: "bg-blue-100 text-blue-700 border border-blue-200",
    detailText: "fold_normal\uFF1A\u5BF9\u6298\u666E\u901A\u551B\u67B6\uFF0C\u7528\u4E8E\u5BF9\u6298\u88C1\u7247\u573A\u666F\u3002"
  },
  fold_high_low: {
    label: "\u5BF9\u6298\u9AD8\u4F4E\u5C42\u551B\u67B6",
    className: "bg-violet-100 text-violet-700 border border-violet-200",
    detailText: "fold_high_low\uFF1A\u5BF9\u6298\u9AD8\u4F4E\u5C42\u551B\u67B6\uFF0C\u7528\u4E8E\u5BF9\u6298\u4E14\u9700\u9AD8\u4F4E\u5C42\u6392\u5E03\u7684\u88C1\u7247\u573A\u666F\u3002"
  }
};
const spreadingStatusMeta = {
  DRAFT: {
    label: "\u5F85\u94FA\u5E03",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
    detailText: "\u94FA\u5E03\u5355\u5DF2\u521B\u5EFA\uFF0C\u5C1A\u672A\u5F00\u59CB\u94FA\u5E03\u3002"
  },
  IN_PROGRESS: {
    label: "\u94FA\u5E03\u4E2D",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
    detailText: "\u5F53\u524D\u6B63\u5728\u94FA\u5E03\u3002"
  },
  DONE: {
    label: "\u5DF2\u94FA\u5E03",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    detailText: "\u94FA\u5E03\u5DF2\u5B8C\u6210\uFF0C\u7B49\u5F85\u88C1\u526A\u3002"
  },
  TO_FILL: {
    label: "\u5F85\u94FA\u5E03",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
    detailText: "\u94FA\u5E03\u5355\u5DF2\u521B\u5EFA\uFF0C\u5C1A\u672A\u5F00\u59CB\u94FA\u5E03\u3002"
  }
};
const spreadingListStatusMeta = {
  WAITING_START: {
    label: "\u5F85\u94FA\u5E03",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
    detailText: "\u94FA\u5E03\u5355\u5DF2\u521B\u5EFA\uFF0C\u5C1A\u672A\u5F00\u59CB\u94FA\u5E03\u3002"
  },
  IN_PROGRESS: {
    label: "\u94FA\u5E03\u4E2D",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
    detailText: "\u5F53\u524D\u6B63\u5728\u94FA\u5E03\u3002"
  },
  DONE: {
    label: "\u5DF2\u94FA\u5E03",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    detailText: "\u94FA\u5E03\u5DF2\u5B8C\u6210\uFF0C\u7B49\u5F85\u88C1\u526A\u3002"
  }
};
const spreadingCuttingStatusMeta = {
  WAITING_CUTTING: {
    label: "\u5F85\u88C1\u526A",
    className: "bg-blue-100 text-blue-700 border border-blue-200",
    detailText: "\u94FA\u5E03\u5DF2\u5B8C\u6210\uFF0C\u7B49\u5F85\u5F00\u59CB\u88C1\u526A\u3002"
  },
  CUTTING: {
    label: "\u88C1\u526A\u4E2D",
    className: "bg-violet-100 text-violet-700 border border-violet-200",
    detailText: "\u5F53\u524D\u6B63\u5728\u88C1\u526A\u3002"
  },
  CUTTING_DONE: {
    label: "\u5DF2\u88C1\u526A",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    detailText: "\u88C1\u526A\u5DF2\u5B8C\u6210\u3002"
  }
};
const spreadingOrderStatusMeta = {
  WAITING_SPREADING: {
    label: "\u5F85\u94FA\u5E03",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
    detailText: "\u94FA\u5E03\u5355\u5DF2\u7531\u551B\u67B6\u7F16\u53F7\u751F\u6210\uFF0C\u7B49\u5F85\u5F00\u59CB\u94FA\u5E03\u3002"
  },
  SPREADING: {
    label: "\u94FA\u5E03\u4E2D",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
    detailText: "\u5F53\u524D\u94FA\u5E03\u6B63\u5728\u6267\u884C\u3002"
  },
  SPREAD_DONE: {
    label: "\u5DF2\u94FA\u5E03",
    className: "bg-blue-100 text-blue-700 border border-blue-200",
    detailText: "\u94FA\u5E03\u5DF2\u5B8C\u6210\uFF0C\u7B49\u5F85\u88C1\u526A\u3002"
  },
  WAITING_CUTTING: {
    label: "\u5F85\u88C1\u526A",
    className: "bg-sky-100 text-sky-700 border border-sky-200",
    detailText: "\u94FA\u5E03\u5DF2\u5B8C\u6210\uFF0C\u7B49\u5F85\u5F00\u59CB\u88C1\u526A\u3002"
  },
  CUTTING: {
    label: "\u88C1\u526A\u4E2D",
    className: "bg-violet-100 text-violet-700 border border-violet-200",
    detailText: "\u5F53\u524D\u88C1\u526A\u6B63\u5728\u6267\u884C\u3002"
  },
  CUT_DONE: {
    label: "\u5DF2\u88C1\u526A",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    detailText: "\u88C1\u526A\u5DF2\u5B8C\u6210\u3002"
  },
  CANCELED: {
    label: "\u5DF2\u53D6\u6D88",
    className: "bg-slate-100 text-slate-500 border border-slate-200",
    detailText: "\u94FA\u5E03\u5355\u5DF2\u53D6\u6D88\u3002"
  }
};
function resolveSpreadingOrderStatusFromSession(session) {
  if (!session) return "WAITING_SPREADING";
  if (session.cuttingStatus === "CUTTING_DONE") return "CUT_DONE";
  if (session.cuttingStatus === "CUTTING") return "CUTTING";
  if (session.cuttingStatus === "WAITING_CUTTING") return "WAITING_CUTTING";
  if (session.status === "IN_PROGRESS") return "SPREADING";
  if (session.status === "DONE") return "SPREAD_DONE";
  return "WAITING_SPREADING";
}
const spreadingSupervisorStageMeta = {
  WAITING_START: {
    label: "\u5F85\u94FA\u5E03",
    className: "bg-slate-100 text-slate-700 border border-slate-200",
    detailText: "\u5F53\u524D\u94FA\u5E03\u8FD8\u672A\u8FDB\u5165\u6B63\u5F0F\u6267\u884C\u9636\u6BB5\uFF0C\u9700\u5148\u7EE7\u7EED\u94FA\u5E03\u6216\u8865\u5F55\u6267\u884C\u8BB0\u5F55\u3002"
  },
  IN_PROGRESS: {
    label: "\u94FA\u5E03\u4E2D",
    className: "bg-amber-100 text-amber-700 border border-amber-200",
    detailText: "\u5F53\u524D\u94FA\u5E03\u6B63\u5728\u6267\u884C\u4E2D\uFF0C\u5377\u3001\u5C42\u6570\u6216\u4EBA\u5458\u8BB0\u5F55\u4ECD\u5728\u6301\u7EED\u5F55\u5165\u3002"
  },
  WAITING_REPLENISHMENT: {
    label: "\u5F85\u8865\u6599\u786E\u8BA4",
    className: "bg-rose-100 text-rose-700 border border-rose-200",
    detailText: "\u5F53\u524D\u94FA\u5E03\u5DF2\u5B8C\u6210\uFF0C\u4F46\u8865\u6599\u5DEE\u5F02\u4ECD\u5F85\u8FDB\u5165\u8865\u6599\u7BA1\u7406\u786E\u8BA4\uFF0C\u5BA1\u6838\u901A\u8FC7\u540E\u5C06\u56DE\u4E2D\u8F6C\u4ED3\u914D\u6599\u3002"
  },
  WAITING_FEI_TICKET: {
    label: "\u5F85\u6253\u5370\u83F2\u7968",
    className: "bg-sky-100 text-sky-700 border border-sky-200",
    detailText: "\u5F53\u524D\u94FA\u5E03\u6267\u884C\u5DF2\u5B8C\u6210\uFF0C\u9700\u5148\u786E\u8BA4\u94FA\u5E03\u4E0E\u88C1\u526A\u5DEE\u5F02\u5904\u7406\u7ED3\u679C\uFF0C\u518D\u8FDB\u5165\u83F2\u7968\u6D41\u7A0B\u3002"
  },
  WAITING_BAGGING: {
    label: "\u5F85\u5165\u4ED3\u6682\u5B58",
    className: "bg-violet-100 text-violet-700 border border-violet-200",
    detailText: "\u5F53\u524D\u83F2\u7968\u5DF2\u5177\u5907\uFF0C\u4F46\u5C1A\u672A\u5F62\u6210\u5165\u4ED3\u6682\u5B58\u888B\u8BB0\u5F55\u3002"
  },
  WAITING_WAREHOUSE: {
    label: "\u5F85\u5165\u4ED3",
    className: "bg-cyan-100 text-cyan-700 border border-cyan-200",
    detailText: "\u5F53\u524D\u5DF2\u653E\u5165\u6682\u5B58\u888B\uFF0C\u4F46\u5C1A\u672A\u5F62\u6210\u6B63\u5F0F\u88C1\u7247\u4ED3\u5165\u4ED3\u8BB0\u5F55\u3002"
  },
  DONE: {
    label: "\u5DF2\u5165\u4ED3",
    className: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    detailText: "\u5F53\u524D\u94FA\u5E03\u5355\u7684\u88C1\u7247\u4EA7\u51FA\u5DF2\u8FDB\u5165\u5F85\u4EA4\u51FA\u4ED3\u3002"
  }
};
function resolveSpreadingPrimaryActionMeta(nextStepKey) {
  if (nextStepKey === "COMPLETE_SPREADING") {
    return { key: nextStepKey, label: "\u53BB\u7F16\u8F91\u7EE7\u7EED\u94FA\u5E03", action: "open-spreading-edit" };
  }
  if (nextStepKey === "GO_REPLENISHMENT") {
    return { key: nextStepKey, label: "\u53BB\u8865\u6599\u7BA1\u7406", action: "go-spreading-replenishment" };
  }
  if (nextStepKey === "GO_FEI_TICKET") {
    return { key: nextStepKey, label: "\u53BB\u6253\u5370\u83F2\u7968", action: "go-spreading-fei-tickets" };
  }
  if (nextStepKey === "GO_BAGGING") {
    return { key: nextStepKey, label: "\u53BB\u88C5\u888B", action: "go-spreading-transfer-bags" };
  }
  if (nextStepKey === "GO_WAREHOUSE") {
    return { key: nextStepKey, label: "\u53BB\u88C1\u7247\u4ED3", action: "go-spreading-warehouse" };
  }
  return null;
}
function resolveSpreadingPrimaryActionKeyByStage(stageKey) {
  if (stageKey === "WAITING_START" || stageKey === "IN_PROGRESS") return "COMPLETE_SPREADING";
  if (stageKey === "WAITING_REPLENISHMENT") return "GO_REPLENISHMENT";
  if (stageKey === "WAITING_FEI_TICKET") return "GO_FEI_TICKET";
  if (stageKey === "WAITING_BAGGING") return "GO_BAGGING";
  if (stageKey === "WAITING_WAREHOUSE") return "GO_WAREHOUSE";
  return null;
}
function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => Boolean(value))));
}
function parseTimeWeight(value) {
  if (!value) return 0;
  const timestamp = new Date(value.replace(" ", "T")).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}
function formatQty(value) {
  return numberFormatter.format(Math.max(value, 0));
}
function buildSpreadingPlanUnitDisplayLabel(planUnit) {
  return `${planUnit.color || "\u5F85\u8865\u989C\u8272"} / ${planUnit.materialSku || "\u5F85\u8865\u9762\u6599"} / ${formatQty(planUnit.garmentQtyPerUnit)}\u4EF6/\u5C42`;
}
function formatDateTime(value) {
  return value || "\u5F85\u8865";
}
function createSummaryMeta(key, label, className, detailText) {
  return { key, label, className, detailText };
}
function normalizeMarkerMode(mode) {
  if (mode === "NORMAL") return "normal";
  if (mode === "HIGH_LOW" || mode === "high-low" || mode === "high_low") return "high_low";
  if (mode === "FOLD_HIGH_LOW" || mode === "fold_high_low") return "fold_high_low";
  if (mode === "FOLD_NORMAL" || mode === "FOLDED" || mode === "FOLD" || mode === "folded" || mode === "fold_normal") return "fold_normal";
  if (mode === "normal") return "normal";
  return "normal";
}
function isHighLowMarkerMode(mode) {
  const normalized = normalizeMarkerMode(mode);
  return normalized === "high_low" || normalized === "fold_high_low";
}
function isFoldMarkerMode(mode) {
  const normalized = normalizeMarkerMode(mode);
  return normalized === "fold_normal" || normalized === "fold_high_low";
}
function buildPlannedSizeRatioText(sizeDistribution) {
  return sizeDistribution.filter((item) => item.quantity > 0).map((item) => `${item.sizeLabel}\xD7${item.quantity}`).join(" / ");
}
function createDefaultSizeValueMap() {
  return {
    S: 0,
    M: 0,
    L: 0,
    XL: 0,
    "2XL": 0,
    "3XL": 0,
    "4XL": 0,
    onesize: 0,
    plusonesize: 0
  };
}
function normalizeHighLowCuttingRow(item, markerId, index) {
  const sizeValues = createDefaultSizeValueMap();
  MARKER_SIZE_KEYS.forEach((sizeKey) => {
    sizeValues[sizeKey] = Number(item.sizeValues?.[sizeKey] ?? 0);
  });
  const total = MARKER_SIZE_KEYS.reduce((sum, sizeKey) => sum + Math.max(sizeValues[sizeKey], 0), 0);
  return {
    rowId: item.rowId || `high-low-cutting-${markerId}-${index + 1}`,
    markerId,
    color: item.color || "",
    sizeValues,
    total
  };
}
function normalizeHighLowPatternRow(item, markerId, index, patternKeys) {
  const patternValues = Object.fromEntries(patternKeys.map((key) => [key, Number(item.patternValues?.[key] ?? 0)]));
  const total = patternKeys.reduce((sum, key) => sum + Math.max(patternValues[key] || 0, 0), 0);
  return {
    rowId: item.rowId || `high-low-pattern-${markerId}-${index + 1}`,
    markerId,
    color: item.color || "",
    patternValues,
    total
  };
}
function normalizeMarkerLineItem(item, markerId, index) {
  const markerPieceCount = Number(item.markerPieceCount ?? item.pieceCount ?? 0);
  const markerLength = Number(item.markerLength ?? 0);
  const spreadRepeatCount = Number(item.spreadRepeatCount ?? 1);
  const spreadTotalLength = Number(
    item.spreadTotalLength ?? item.spreadingTotalLength ?? Number((((markerLength || 0) + 0.06) * Math.max(spreadRepeatCount, 0)).toFixed(2))
  );
  return {
    lineItemId: item.lineItemId || item.markerLineItemId || `line-${markerId}-${index + 1}`,
    markerId,
    lineNo: Number(item.lineNo ?? index + 1),
    layoutCode: item.layoutCode || `A-${index + 1}`,
    layoutDetailText: item.layoutDetailText || item.ratioLabel || "",
    color: item.color || "",
    spreadRepeatCount,
    markerLength,
    markerPieceCount,
    singlePieceUsage: Number(item.singlePieceUsage ?? computeSinglePieceUsage(markerLength, markerPieceCount)),
    spreadTotalLength,
    widthHint: item.widthHint || "",
    note: item.note || "",
    markerLineItemId: item.lineItemId || item.markerLineItemId || `line-${markerId}-${index + 1}`,
    ratioLabel: item.layoutDetailText || item.ratioLabel || "",
    pieceCount: markerPieceCount,
    spreadingTotalLength: spreadTotalLength
  };
}
function normalizeMarkerAllocationLine(item, markerId, index) {
  return {
    allocationId: item.allocationId || `allocation-${markerId}-${index + 1}`,
    markerId,
    sourceCutOrderId: item.sourceCutOrderId || "",
    sourceCutOrderNo: item.sourceCutOrderNo || "",
    sourceProductionOrderId: item.sourceProductionOrderId || "",
    sourceProductionOrderNo: item.sourceProductionOrderNo || "",
    styleCode: item.styleCode || "",
    spuCode: item.spuCode || "",
    techPackSpuCode: item.techPackSpuCode || "",
    color: item.color || "",
    materialSku: item.materialSku || "",
    sizeLabel: item.sizeLabel || "",
    plannedGarmentQty: Math.max(Number(item.plannedGarmentQty || 0), 0),
    note: item.note || ""
  };
}
function deriveMarkerTemplateByMode(mode) {
  return isHighLowMarkerMode(mode) ? "matrix-template" : "row-template";
}
function computeSinglePieceUsage(markerLength, markerPieceCount) {
  if (markerPieceCount <= 0) return 0;
  return Number((markerLength / markerPieceCount).toFixed(3));
}
function computeNormalMarkerSpreadTotalLength(lineItems = []) {
  return Number(
    lineItems.reduce(
      (sum, item) => sum + Math.max(
        Number((((item.markerLength || 0) + 0.06) * Math.max(item.spreadRepeatCount || 0, 0)).toFixed(2)),
        0
      ),
      0
    ).toFixed(2)
  );
}
function computeHighLowCuttingTotals(rows = []) {
  const normalizedRows = rows.map((row, index) => normalizeHighLowCuttingRow(row, row.markerId, index));
  return {
    rows: normalizedRows,
    cuttingTotal: normalizedRows.reduce((sum, row) => sum + row.total, 0)
  };
}
function computeHighLowPatternTotals(rows = [], patternKeys = []) {
  const normalizedRows = rows.map((row, index) => normalizeHighLowPatternRow(row, row.markerId, index, patternKeys));
  return {
    rows: normalizedRows,
    patternTotal: normalizedRows.reduce((sum, row) => sum + row.total, 0)
  };
}
function computeUsageSummary(marker) {
  const matrixActualCutQty = isHighLowMarkerMode(marker.markerMode) ? computeHighLowCuttingTotals(marker.highLowCuttingRows || []).cuttingTotal : 0;
  const actualCutQty = Number(marker.actualCutQty ?? (matrixActualCutQty > 0 ? matrixActualCutQty : marker.totalPieces ?? 0));
  const procurementUnitUsage = Number(marker.procurementUnitUsage ?? marker.singlePieceUsage ?? 0);
  const actualUnitUsage = Number(marker.actualUnitUsage ?? marker.singlePieceUsage ?? 0);
  const layerCount = Number(marker.plannedLayerCount ?? 0);
  const markerLengthWithLoss = Math.max(Number(marker.markerLength ?? marker.netLength ?? 0), 0) + 0.06;
  const plannedSpreadLength = Number(marker.spreadTotalLength ?? (layerCount > 0 ? Number((markerLengthWithLoss * layerCount).toFixed(2)) : 0));
  const plannedMaterialMeter = Number(
    marker.plannedMaterialMeter ?? Number(plannedSpreadLength.toFixed(2)) ?? 0
  );
  const actualMaterialMeter = Number(
    marker.actualMaterialMeter ?? Number((Number(marker.spreadTotalLength ?? 0) || markerLengthWithLoss * Math.max(layerCount, 0)).toFixed(2)) ?? 0
  );
  return {
    procurementUnitUsage,
    actualUnitUsage,
    plannedMaterialMeter,
    actualMaterialMeter,
    actualCutQty
  };
}
function validateMarkerModeShape(marker) {
  const mode = normalizeMarkerMode(marker.markerMode);
  const template = deriveMarkerTemplateByMode(mode);
  const issues = [];
  if (template === "row-template" && !(marker.lineItems || []).length) {
    issues.push("\u5F53\u524D\u6A21\u5F0F\u5E94\u4F7F\u7528\u884C\u660E\u7EC6\u6A21\u677F\uFF0C\u4F46\u551B\u67B6\u660E\u7EC6\u4E3A\u7A7A\u3002");
  }
  if (template === "matrix-template") {
    if (!(marker.highLowCuttingRows || []).length) {
      issues.push("\u9AD8\u4F4E\u5C42\u5E8A\u6B21\u7F3A\u5C11\u88C1\u526A\u660E\u7EC6\u77E9\u9635\u3002");
    }
    if (!(marker.highLowPatternRows || []).length) {
      issues.push("\u9AD8\u4F4E\u5C42\u551B\u67B6\u7F3A\u5C11\u5E8A\u6B21\u6A21\u5F0F\u77E9\u9635\u3002");
    }
  }
  return issues;
}
function buildMarkerWarningMessages(marker) {
  const warnings = [];
  const usageSummary = computeUsageSummary(marker);
  if ((marker.spreadTotalLength || 0) > 0 && usageSummary.plannedMaterialMeter > 0 && (marker.spreadTotalLength || 0) > usageSummary.plannedMaterialMeter) {
    warnings.push("\u94FA\u5E03\u603B\u957F\u5EA6\u8D85\u8FC7\u9886\u53D6\u5E03\u6599\u957F\u5EA6\u53C2\u8003\u503C\u3002");
  }
  if (usageSummary.actualMaterialMeter > usageSummary.plannedMaterialMeter && usageSummary.plannedMaterialMeter > 0) {
    warnings.push("\u5B9E\u9645\u4F7F\u7528\u7C73\u6570\u8D85\u8FC7\u9884\u7B97\u7C73\u6570\u3002");
  }
  if (usageSummary.actualUnitUsage > usageSummary.procurementUnitUsage && usageSummary.procurementUnitUsage > 0) {
    warnings.push("\u5B9E\u9645\u5355\u4EF6\u7528\u91CF\u5927\u4E8E\u91C7\u8D2D\u5355\u4EF6\u7528\u91CF\u3002");
  }
  if (isHighLowMarkerMode(marker.markerMode)) {
    const cuttingTotal = computeHighLowCuttingTotals(marker.highLowCuttingRows || []).cuttingTotal;
    const patternTotal = computeHighLowPatternTotals(marker.highLowPatternRows || [], marker.highLowPatternKeys || []).patternTotal;
    const sizeTotal = computeMarkerTotalPieces(marker.sizeDistribution || []);
    if ((cuttingTotal > 0 || patternTotal > 0) && (cuttingTotal !== sizeTotal || patternTotal !== sizeTotal)) {
      warnings.push("\u9AD8\u4F4E\u5C42\u5E8A\u6B21\u77E9\u9635\u5408\u8BA1\u4E0E\u5C3A\u7801\u914D\u6BD4\u603B\u4EF6\u6570\u4E0D\u4E00\u81F4\u3002");
    }
  }
  return uniqueStrings([...validateMarkerModeShape(marker), ...warnings]);
}
function normalizeMarkerRecord(marker) {
  const sizeDistribution = Array.isArray(marker.sizeDistribution) ? marker.sizeDistribution : [];
  const normalizedMode = normalizeMarkerMode(marker.markerMode);
  const allocationLines = (marker.allocationLines || []).map(
    (item, index) => normalizeMarkerAllocationLine(item, marker.markerId, index)
  );
  const lineItems = (marker.lineItems || []).map((item, index) => normalizeMarkerLineItem(item, marker.markerId, index));
  const highLowPatternKeys = uniqueStrings([...marker.highLowPatternKeys || [], ...DEFAULT_HIGH_LOW_PATTERN_KEYS]);
  const highLowCuttingRows = (marker.highLowCuttingRows || []).map((item, index) => normalizeHighLowCuttingRow(item, marker.markerId, index));
  const highLowPatternRows = (marker.highLowPatternRows || []).map(
    (item, index) => normalizeHighLowPatternRow(item, marker.markerId, index, highLowPatternKeys)
  );
  const totalPieces = computeMarkerTotalPieces(sizeDistribution);
  const spreadTotalLength = marker.spreadTotalLength ?? (deriveMarkerTemplateByMode(normalizedMode) === "row-template" ? computeNormalMarkerSpreadTotalLength(lineItems) : Number(marker.actualMaterialMeter ?? 0));
  const usageSummary = computeUsageSummary(marker);
  const derivedWarningMessages = buildMarkerWarningMessages({
    ...marker,
    markerMode: normalizedMode,
    lineItems,
    highLowPatternKeys,
    highLowCuttingRows,
    highLowPatternRows,
    spreadTotalLength,
    totalPieces
  });
  const warningMessages = uniqueStrings([...marker.warningMessages || [], ...derivedWarningMessages]);
  return {
    ...marker,
    cutOrderNos: marker.cutOrderNos || [],
    techPackSpuCode: marker.techPackSpuCode || "",
    markerMode: normalizedMode,
    totalPieces,
    markerGarmentQty: totalPieces,
    spreadTotalLength,
    allocationLines,
    lineItems,
    highLowPatternKeys,
    highLowCuttingRows,
    highLowPatternRows,
    colorSummary: marker.colorSummary || uniqueStrings([...lineItems.map((item) => item.color), ...highLowCuttingRows.map((item) => item.color), ...highLowPatternRows.map((item) => item.color)]).join(" / "),
    sizeRatioPlanText: marker.sizeRatioPlanText || buildPlannedSizeRatioText(sizeDistribution),
    markerLength: marker.markerLength ?? marker.netLength,
    adjustmentRequired: Boolean(marker.adjustmentRequired),
    adjustmentNote: marker.adjustmentNote || marker.adjustmentSummary || "",
    replacementDraftFlag: Boolean(marker.replacementDraftFlag),
    actualUnitUsage: usageSummary.actualUnitUsage,
    procurementUnitUsage: usageSummary.procurementUnitUsage,
    plannedMaterialMeter: usageSummary.plannedMaterialMeter,
    actualMaterialMeter: usageSummary.actualMaterialMeter,
    actualCutQty: usageSummary.actualCutQty,
    warningMessages,
    updatedBy: marker.updatedBy || ""
  };
}
function deriveMarkerModeMeta(mode) {
  const normalized = normalizeMarkerMode(mode);
  const meta = markerModeMeta[normalized];
  return createSummaryMeta(normalized, meta.label, meta.className, meta.detailText);
}
function deriveSpreadingModeMeta(mode) {
  return deriveMarkerModeMeta(mode);
}
function computeMarkerTotalPieces(sizeDistribution) {
  return sizeDistribution.reduce((sum, item) => sum + Math.max(item.quantity, 0), 0);
}
function computeUsableLength(actualLength, headLength, tailLength) {
  return Number((actualLength - headLength - tailLength).toFixed(2));
}
function computeRemainingLength(labeledLength, actualLength) {
  return Number((labeledLength - actualLength).toFixed(2));
}
function findSpreadingPlanUnitById(planUnits, planUnitId) {
  if (!Array.isArray(planUnits) || !planUnits.length) return null;
  if (!planUnitId) return planUnits[0] || null;
  return planUnits.find((item) => item.planUnitId === planUnitId) || null;
}
function deriveMarkerGarmentQtyPerLayer(marker) {
  if (!marker) return 0;
  const lineItemQty = (marker.lineItems || []).find((item) => Number(item.markerPieceCount ?? item.pieceCount ?? 0) > 0);
  if (lineItemQty) return Math.max(Number(lineItemQty.markerPieceCount ?? lineItemQty.pieceCount ?? 0), 0);
  const plannedLayers = Math.max(Number(marker.plannedLayerCount || 0), 0);
  const totalPieces = Math.max(Number(marker.totalPieces || 0), 0);
  if (plannedLayers > 0 && totalPieces > 0) return Math.max(Math.ceil(totalPieces / plannedLayers), 0);
  return totalPieces;
}
function deriveSpreadingSessionGarmentQtyPerLayer(session, marker) {
  const planUnits = session?.planUnits || [];
  const positiveUnits = planUnits.map((unit) => Math.max(Number(unit.garmentQtyPerUnit || 0), 0)).filter((value) => value > 0);
  const uniqueValues = Array.from(new Set(positiveUnits));
  if (uniqueValues.length === 1) return uniqueValues[0];
  return deriveMarkerGarmentQtyPerLayer(marker);
}
function computePlannedCutGarmentQtyFromSession(session, garmentQtyPerLayer) {
  const planUnits = session?.planUnits || [];
  const planUnitTotal = planUnits.reduce((sum, unit) => {
    const storedTotal = Math.max(Number(unit.plannedCutGarmentQty || 0), 0);
    const computedTotal = Math.max(Number(unit.plannedRepeatCount || 0), 0) * Math.max(Number(unit.garmentQtyPerUnit || 0), 0);
    return sum + (storedTotal || computedTotal);
  }, 0);
  if (planUnitTotal > 0) return Math.max(Math.round(planUnitTotal), 0);
  const importedTotal = Math.max(Number(session?.theoreticalActualCutPieceQty || 0), 0);
  if (importedTotal > 0) return Math.max(Math.round(importedTotal), 0);
  return computePlannedCutGarmentQty(Number(session?.plannedLayers || 0), garmentQtyPerLayer);
}
function buildPlannedCutGarmentQtyFormulaFromSession(plannedCutGarmentQty, session, garmentQtyPerLayer) {
  const planUnits = session?.planUnits || [];
  const terms = planUnits.map((unit) => ({
    layers: Math.max(Number(unit.plannedRepeatCount || 0), 0),
    qty: Math.max(Number(unit.garmentQtyPerUnit || 0), 0)
  })).filter((unit) => unit.layers > 0 && unit.qty > 0);
  if (terms.length) {
    const formulaTerms = terms.map((unit) => `${formatQty(unit.layers)} \u5C42 \xD7 ${formatQty(unit.qty)} \u4EF6/\u5C42`);
    return `${formatQty(plannedCutGarmentQty)} \u4EF6 = ${formulaTerms.join(" + ")}`;
  }
  return buildPlannedCutGarmentQtyFormula(plannedCutGarmentQty, Number(session?.plannedLayers || 0), garmentQtyPerLayer);
}
function computeTheoreticalCutQtyFromSession(session, fallbackGarmentQtyPerLayer) {
  const rolls = session.rolls || [];
  if (rolls.length) {
    const rollTotal = rolls.reduce((sum, roll) => {
      const linkedPlanUnit = findSpreadingPlanUnitById(session.planUnits, roll.planUnitId);
      const garmentQtyPerUnit = linkedPlanUnit?.garmentQtyPerUnit || fallbackGarmentQtyPerLayer;
      return sum + computeRollActualCutGarmentQty(Number(roll.layerCount || 0), garmentQtyPerUnit);
    }, 0);
    if (rollTotal > 0) return Math.max(Math.round(rollTotal), 0);
  }
  return computeTheoreticalCutQty(session, fallbackGarmentQtyPerLayer);
}
function buildTheoreticalCutGarmentQtyFormulaFromSession(theoreticalCutGarmentQty, session, rollLayerTotal, actualLayerTotal, fallbackGarmentQtyPerLayer) {
  const terms = (session.rolls || []).map((roll) => {
    const linkedPlanUnit = findSpreadingPlanUnitById(session.planUnits, roll.planUnitId);
    const garmentQtyPerUnit = linkedPlanUnit?.garmentQtyPerUnit || fallbackGarmentQtyPerLayer;
    return {
      layers: Math.max(Number(roll.layerCount || 0), 0),
      qty: Math.max(Number(garmentQtyPerUnit || 0), 0)
    };
  }).filter((item) => item.layers > 0 && item.qty > 0);
  if (terms.length) {
    return `${formatQty(theoreticalCutGarmentQty)} \u4EF6 = ${terms.map((item) => `${formatQty(item.layers)} \u5C42 \xD7 ${formatQty(item.qty)} \u4EF6/\u5C42`).join(" + ")}`;
  }
  return buildTheoreticalCutGarmentQtyFormula(theoreticalCutGarmentQty, rollLayerTotal, actualLayerTotal, fallbackGarmentQtyPerLayer);
}
function computeRollActualCutGarmentQty(layerCount, garmentQtyPerUnit) {
  if (layerCount <= 0 || garmentQtyPerUnit <= 0) return 0;
  return Math.max(Math.round(layerCount * garmentQtyPerUnit), 0);
}
function computeRollActualCutPieceQty(layerCount, markerTotalPieces) {
  return computeRollActualCutGarmentQty(layerCount, markerTotalPieces);
}
function computePlannedCutGarmentQty(plannedLayers, markerTotalPieces) {
  if (plannedLayers <= 0 || markerTotalPieces <= 0) return 0;
  return Math.max(Math.round(plannedLayers * markerTotalPieces), 0);
}
function computeTheoreticalCutQty(session, markerTotalPieces) {
  const rollLayerTotal = summarizeSpreadingRolls(session.rolls || []).totalLayers;
  const actualLayerTotal = Number(session.actualLayers || 0);
  const layerBase = Math.max(rollLayerTotal, actualLayerTotal, 0);
  if (layerBase <= 0 || markerTotalPieces <= 0) return 0;
  return Math.max(Math.round(layerBase * markerTotalPieces), 0);
}
function computeActualCutQty(session) {
  const rollSummary = summarizeSpreadingRolls(session.rolls || []);
  return Math.max(
    Number(
      session.actualCutGarmentQty ?? session.actualCutPieceQty ?? rollSummary.totalActualCutGarmentQty ?? rollSummary.totalActualCutPieceQty ?? 0
    ),
    0
  );
}
function computeLengthVariance(claimedLengthTotal, actualLengthTotal) {
  return Number((Number(claimedLengthTotal || 0) - Number(actualLengthTotal || 0)).toFixed(2));
}
function computeShortageQty(requiredQty, actualCutQty) {
  return Math.max(Number(requiredQty || 0) - Math.max(Number(actualCutQty || 0), 0), 0);
}
function splitSummaryValues(value) {
  return uniqueStrings(
    (value || "").split("/").map((item) => item.trim()).filter(Boolean)
  );
}
function deriveSpreadingColorSummary(options) {
  const rollColors = uniqueStrings((options.rolls || []).map((roll) => roll.color?.trim()).filter(Boolean));
  if (rollColors.length) {
    const value = rollColors.join(" / ");
    return { value, formula: `${value} = \u03A3 \u5377\u8BB0\u5F55\u989C\u8272\u53BB\u91CD` };
  }
  const sourceColors = splitSummaryValues(options.importSourceColorSummary);
  if (sourceColors.length) {
    const value = sourceColors.join(" / ");
    return { value, formula: `${value} = \u03A3 \u6765\u6E90\u989C\u8272\u53BB\u91CD` };
  }
  const contextColors = uniqueStrings((options.contextColors || []).map((item) => item?.trim()).filter(Boolean));
  if (contextColors.length) {
    const value = contextColors.join(" / ");
    return { value, formula: `${value} = \u03A3 \u4E0A\u4E0B\u6587\u989C\u8272\u53BB\u91CD` };
  }
  const fallbackValues = splitSummaryValues(options.fallbackSummary);
  if (fallbackValues.length) {
    const value = fallbackValues.join(" / ");
    return { value, formula: `${value} = \u03A3 \u5DF2\u5B58\u989C\u8272\u53BB\u91CD` };
  }
  return { value: "\u5F85\u8865", formula: "" };
}
function buildTheoreticalActualCutQtyFormula(theoreticalActualCutPieceQty, plannedLayers, markerTotalPieces) {
  return `${formatQty(theoreticalActualCutPieceQty)} \u4EF6 = ${formatQty(plannedLayers)} \u5C42 \xD7 ${formatQty(markerTotalPieces)} \u4EF6/\u5C42`;
}
function buildPlannedCutGarmentQtyFormula(plannedCutGarmentQty, plannedLayers, markerTotalPieces) {
  return `${formatQty(plannedCutGarmentQty)} \u4EF6 = ${formatQty(plannedLayers)} \u5C42 \xD7 ${formatQty(markerTotalPieces)} \u4EF6/\u5C42`;
}
function buildTheoreticalCutGarmentQtyFormula(theoreticalCutGarmentQty, rollLayerTotal, actualLayerTotal, markerTotalPieces) {
  return `${formatQty(theoreticalCutGarmentQty)} \u4EF6 = max(${formatQty(rollLayerTotal)} \u5C42, ${formatQty(actualLayerTotal)} \u5C42) \xD7 ${formatQty(markerTotalPieces)} \u4EF6/\u5C42`;
}
function buildQtySumFormula(result, values) {
  const left = formatQty(result || 0);
  const right = values.length ? values.map((value) => formatQty(value || 0)).join(" + ") : "0";
  return `${left} \u4EF6 = ${right} \u4EF6`;
}
function buildSumFormula(result, values, digits = 2) {
  const left = Number(result || 0).toFixed(digits);
  const right = values.length ? values.map((value) => Number(value || 0).toFixed(digits)).join(" + ") : Number(0).toFixed(digits);
  return `${left} \u7C73 = ${right} \u7C73`;
}
function buildDifferenceFormula(result, minuend, subtrahend, digits = 2) {
  return `${Number(result || 0).toFixed(digits)} \u7C73 = ${Number(minuend || 0).toFixed(digits)} \u7C73 - ${Number(subtrahend || 0).toFixed(digits)} \u7C73`;
}
function buildSpreadingImportedLengthFormula(theoreticalSpreadTotalLength) {
  return `${Number(theoreticalSpreadTotalLength || 0).toFixed(2)} \u7C73 = \u6765\u6E90\u6392\u551B\u67B6\u65B9\u6848\u94FA\u5E03\u603B\u957F\u5EA6`;
}
function buildRollActualCutQtyFormula(actualCutPieceQty, layerCount, markerTotalPieces) {
  return `${formatQty(actualCutPieceQty)} \u4EF6 = ${formatQty(layerCount)} \u5C42 \xD7 ${formatQty(markerTotalPieces)} \u4EF6/\u5C42`;
}
function buildRollActualCutGarmentQtyFormula(actualCutGarmentQty, layerCount, garmentQtyPerUnit) {
  return `${formatQty(actualCutGarmentQty)} \u4EF6 = ${formatQty(layerCount)} \u5C42 \xD7 ${formatQty(garmentQtyPerUnit)} \u4EF6/\u5C42`;
}
function computeOperatorHandledGarmentQty(handledLayerCount, garmentQtyPerUnit) {
  if (handledLayerCount === null || handledLayerCount <= 0 || garmentQtyPerUnit <= 0) return null;
  return Math.max(Math.round(handledLayerCount * garmentQtyPerUnit), 0);
}
function computeOperatorHandledLengthByRoll(handledLayerCount, actualLength, rollLayerCount) {
  if (handledLayerCount === null || handledLayerCount <= 0 || actualLength <= 0 || rollLayerCount <= 0) return null;
  return Number((actualLength / rollLayerCount * handledLayerCount).toFixed(2));
}
function buildOperatorHandledLayerFormula(handledLayerCount, startLayer, endLayer) {
  if (handledLayerCount === null || startLayer === void 0 || endLayer === void 0) return "";
  return `${formatQty(handledLayerCount)} \u5C42 = ${formatQty(endLayer)} \u5C42 - ${formatQty(startLayer)} \u5C42 + 1 \u5C42`;
}
function buildOperatorHandledGarmentQtyFormula(handledGarmentQty, handledLayerCount, garmentQtyPerUnit) {
  if (handledGarmentQty === null || handledLayerCount === null) return "";
  return `${formatQty(handledGarmentQty)} \u4EF6 = ${formatQty(handledLayerCount)} \u5C42 \xD7 ${formatQty(garmentQtyPerUnit)} \u4EF6/\u5C42`;
}
function buildOperatorHandledLengthFormula(handledLength, actualLength, rollLayerCount, handledLayerCount) {
  if (handledLength === null || handledLayerCount === null) return "";
  return `${Number(handledLength || 0).toFixed(2)} \u7C73 = ${Number(actualLength || 0).toFixed(2)} \u7C73 \xF7 ${formatQty(rollLayerCount)} \u5C42 \xD7 ${formatQty(handledLayerCount)} \u5C42`;
}
function buildShortageQtyFormula(shortageQty, requiredQty, actualCutQty) {
  return `${formatQty(shortageQty)} \u4EF6 = max(${formatQty(requiredQty)} \u4EF6 - ${formatQty(actualCutQty)} \u4EF6, 0 \u4EF6)`;
}
function buildWarningRuleText(shortageGarmentQty, varianceLength, missingData) {
  if (missingData) return "\u5F85\u8865\u5F55 = \u9700\u6C42\u6210\u8863\u4EF6\u6570\u3001\u88C1\u5E8A\u5DF2\u9886\u957F\u5EA6\u3001\u603B\u5B9E\u9645\u94FA\u5E03\u957F\u5EA6\u672A\u8865\u9F50";
  if (shortageGarmentQty > 0 || varianceLength < 0) return "\u5DEE\u5F02\u5904\u7406 = \u5B58\u5728\u5B9E\u9645\u5DEE\u5F02\uFF0C\u9700\u5BA1\u6838\u540E\u51B3\u5B9A\u8865\u6599\u3001\u8865\u5F55\u3001\u8865\u6392\u3001\u5173\u95ED\u6216\u4EC5\u8BB0\u5F55";
  return "\u4EC5\u8BB0\u5F55\u5DEE\u5F02 = \u5F53\u524D\u5DEE\u5F02\u4E0D\u89E6\u53D1\u540E\u7EED\u6570\u91CF\u8D26\u4E8B\u4EF6";
}
function buildRoundedDistribution(total, weights, digits = 0) {
  if (!weights.length) return [];
  const scale = 10 ** digits;
  const scaledTotal = Math.round(Math.max(total, 0) * scale);
  const normalizedWeights = weights.map((weight) => Math.max(weight, 0));
  const weightSum = normalizedWeights.reduce((sum, weight) => sum + weight, 0);
  const fallbackWeights = normalizedWeights.map(() => 1);
  const effectiveWeights = weightSum > 0 ? normalizedWeights : fallbackWeights;
  const effectiveSum = effectiveWeights.reduce((sum, weight) => sum + weight, 0);
  const raw = effectiveWeights.map((weight) => scaledTotal * weight / Math.max(effectiveSum, 1));
  const base = raw.map((value) => Math.floor(value));
  let remainder = scaledTotal - base.reduce((sum, value) => sum + value, 0);
  const order = raw.map((value, index) => ({ index, remainder: value - Math.floor(value) })).sort((left, right) => right.remainder - left.remainder);
  for (let index = 0; index < order.length && remainder > 0; index += 1, remainder -= 1) {
    base[order[index].index] += 1;
  }
  return base.map((value) => Number((value / scale).toFixed(digits)));
}
function findContextMaterialLine(context, color, materialSku) {
  const matchedRows = context.materialPrepRows.filter((row) => !color || row.color === color);
  const searchRows = matchedRows.length ? matchedRows : context.materialPrepRows;
  return searchRows.flatMap((row) => row.materialLineItems).find((line) => !materialSku || line.materialSku === materialSku) || context.materialPrepRows.flatMap((row) => row.materialLineItems).find((line) => !materialSku || line.materialSku === materialSku) || null;
}
function buildPlanUnitMaterialIdentity(context, color, materialSku) {
  const line = findContextMaterialLine(context, color, materialSku);
  return {
    materialAlias: line?.materialAlias || "",
    materialImageUrl: line?.materialImageUrl || ""
  };
}
function buildSpreadingReplenishmentLines(options) {
  if (!options.context) return [];
  const grouped = /* @__PURE__ */ new Map();
  options.context.materialPrepRows.forEach((row) => {
    row.materialLineItems.forEach((line) => {
      const key = [row.cutOrderId, line.materialSku || row.materialSkuSummary, row.color || "\u5F85\u8865"].join("::");
      const current = grouped.get(key) || {
        cutOrderId: row.cutOrderId,
        cutOrderNo: row.cutOrderNo,
        materialSku: line.materialSku || row.materialSkuSummary || "\u5F85\u8865",
        materialAlias: line.materialAlias || "",
        materialImageUrl: line.materialImageUrl || "",
        color: row.color || "\u5F85\u8865",
        claimedLengthTotal: 0,
        weight: 0
      };
      current.claimedLengthTotal = Number((current.claimedLengthTotal + Number(line.claimedQty || 0)).toFixed(2));
      current.weight = Number(
        (current.weight + Math.max(Number(line.claimedQty || 0), Number(line.configuredQty || 0), Number(line.requiredQty || 0), 0)).toFixed(2)
      );
      grouped.set(key, current);
    });
  });
  const rows = Array.from(grouped.values());
  if (!rows.length) return [];
  const weights = rows.map((row) => row.weight);
  const requiredGarmentQtyList = buildRoundedDistribution(options.plannedCutGarmentQty, weights, 0);
  const actualCutGarmentQtyList = buildRoundedDistribution(options.actualCutGarmentQty, weights, 0);
  const actualLengthList = buildRoundedDistribution(options.spreadActualLengthM, weights, 2);
  return rows.map((row, index) => {
    const requiredGarmentQty = requiredGarmentQtyList[index] || 0;
    const actualCutGarmentQty = actualCutGarmentQtyList[index] || 0;
    const actualLengthTotal = actualLengthList[index] || 0;
    const shortageGarmentQty = computeShortageQty(requiredGarmentQty, actualCutGarmentQty);
    const suggestedAction = shortageGarmentQty > 0 || actualLengthTotal > row.claimedLengthTotal ? "\u5DEE\u5F02\u5904\u7406" : "\u65E0\u9700\u8865\u6599";
    return {
      lineId: `spread-warning-line-${row.cutOrderId}-${index + 1}`,
      cutOrderId: row.cutOrderId,
      cutOrderNo: row.cutOrderNo,
      materialSku: row.materialSku,
      materialAlias: row.materialAlias,
      materialImageUrl: row.materialImageUrl,
      color: row.color,
      requiredGarmentQty,
      actualCutGarmentQty,
      claimedLengthTotal: row.claimedLengthTotal,
      actualLengthTotal,
      shortageGarmentQty,
      suggestedAction,
      actualCutGarmentQtyFormula: `${formatQty(actualCutGarmentQty)} \u4EF6 = \u5F53\u524D\u884C\u5404\u5377\u88C1\u526A\u6210\u8863\u4EF6\u6570\u5408\u8BA1`,
      shortageGarmentQtyFormula: buildShortageQtyFormula(shortageGarmentQty, requiredGarmentQty, actualCutGarmentQty),
      suggestedActionRuleText: suggestedAction === "\u5DEE\u5F02\u5904\u7406" ? "\u5DEE\u5F02\u5904\u7406 = \u5B58\u5728\u5B9E\u9645\u5DEE\u5F02\uFF0C\u9700\u5BA1\u6838\u540E\u51B3\u5B9A\u8865\u6599\u3001\u8865\u5F55\u3001\u8865\u6392\u3001\u5173\u95ED\u6216\u4EC5\u8BB0\u5F55" : "\u4EC5\u8BB0\u5F55\u5DEE\u5F02 = \u5F53\u524D\u5DEE\u5F02\u4E0D\u89E6\u53D1\u540E\u7EED\u6570\u91CF\u8D26\u4E8B\u4EF6"
    };
  });
}
function buildSpreadingCoreMetrics(options) {
  const session = options.session || null;
  const rollSummary = summarizeSpreadingRolls(session?.rolls || []);
  const plannedLayers = Number(session?.plannedLayers || 0);
  const rollLayerTotal = rollSummary.totalLayers;
  const actualLayerTotal = Number(session?.actualLayers || 0);
  const plannedCutGarmentQty = computePlannedCutGarmentQtyFromSession(session, options.markerTotalPieces);
  const theoreticalCutGarmentQty = computeTheoreticalCutQtyFromSession(session || {}, options.markerTotalPieces);
  const actualCutGarmentQty = computeActualCutQty(session || {});
  const spreadActualLengthM = Number(session?.totalActualLength || rollSummary.totalActualLength || 0);
  const spreadUsableLengthM = Number(session?.totalCalculatedUsableLength || rollSummary.totalCalculatedUsableLength || 0);
  const spreadRemainingLengthM = Number(session?.totalRemainingLength ?? rollSummary.totalRemainingLength ?? 0);
  const varianceLength = computeLengthVariance(options.claimedLengthTotal, spreadActualLengthM);
  const shortageGarmentQty = computeShortageQty(plannedCutGarmentQty, actualCutGarmentQty);
  const missingData = !plannedCutGarmentQty || !options.claimedLengthTotal || !spreadActualLengthM;
  return {
    plannedCutGarmentQty,
    theoreticalCutGarmentQty,
    actualCutGarmentQty,
    configuredLengthTotal: Number(options.configuredLengthTotal.toFixed(2)),
    claimedLengthTotal: Number(options.claimedLengthTotal.toFixed(2)),
    spreadActualLengthM,
    spreadUsableLengthM,
    spreadRemainingLengthM,
    fabricRollCount: session?.rolls?.length || 0,
    spreadLayerCount: Math.max(rollLayerTotal, actualLayerTotal, 0),
    varianceLength,
    shortageGarmentQty,
    plannedCutGarmentQtyFormula: buildPlannedCutGarmentQtyFormulaFromSession(plannedCutGarmentQty, session, options.markerTotalPieces),
    theoreticalCutGarmentQtyFormula: buildTheoreticalCutGarmentQtyFormulaFromSession(
      theoreticalCutGarmentQty,
      session || {},
      rollLayerTotal,
      actualLayerTotal,
      options.markerTotalPieces
    ),
    actualCutGarmentQtyFormula: buildQtySumFormula(
      actualCutGarmentQty,
      (session?.rolls || []).map((roll) => (roll.actualCutGarmentQty ?? roll.actualCutPieceQty) || 0)
    ),
    spreadUsableLengthFormula: buildSumFormula(
      spreadUsableLengthM,
      (session?.rolls || []).map((roll) => computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength)),
      2
    ),
    varianceLengthFormula: buildDifferenceFormula(varianceLength, options.claimedLengthTotal, spreadActualLengthM, 2),
    shortageGarmentQtyFormula: buildShortageQtyFormula(shortageGarmentQty, plannedCutGarmentQty, actualCutGarmentQty),
    warningRuleText: buildWarningRuleText(shortageGarmentQty, varianceLength, missingData),
    replenishmentLines: buildSpreadingReplenishmentLines({
      context: options.context,
      plannedCutGarmentQty,
      actualCutGarmentQty,
      spreadActualLengthM
    })
  };
}
function deriveSpreadingWarningLevel(options) {
  const { requiredQty, actualCutQty, varianceLength, claimedLengthTotal, actualLengthTotal, warningMessages = [] } = options;
  if (!requiredQty || !claimedLengthTotal || !actualLengthTotal) return "\u4E2D";
  if (varianceLength < 0 || computeShortageQty(requiredQty, actualCutQty) > 0) return "\u9AD8";
  if (warningMessages.length > 0 || Math.abs(varianceLength) <= 5) return "\u4E2D";
  return "\u4F4E";
}
function deriveSpreadingSuggestedAction(options) {
  const { requiredQty, actualCutQty, varianceLength, claimedLengthTotal, actualLengthTotal, warningMessages = [] } = options;
  if (!requiredQty || !claimedLengthTotal || !actualLengthTotal) return "\u6570\u636E\u4E0D\u8DB3\uFF0C\u5F85\u8865\u5F55";
  if (computeShortageQty(requiredQty, actualCutQty) > 0 || varianceLength < 0) return "\u5DEE\u5F02\u5904\u7406";
  if (warningMessages.length > 0) return "\u5B58\u5728\u5F02\u5E38\u5DEE\u5F02\uFF0C\u9700\u4EBA\u5DE5\u786E\u8BA4";
  return "\u65E0\u9700\u8865\u6599";
}
function nowText(input = /* @__PURE__ */ new Date()) {
  const year = input.getFullYear();
  const month = `${input.getMonth() + 1}`.padStart(2, "0");
  const day = `${input.getDate()}`.padStart(2, "0");
  const hours = `${input.getHours()}`.padStart(2, "0");
  const minutes = `${input.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
function defaultSizeDistribution(rowCount) {
  const baseline = Math.max(rowCount, 1);
  return MARKER_SIZE_KEYS.map((sizeLabel, index) => ({
    sizeLabel,
    quantity: index < 5 ? [baseline * 12, baseline * 18, baseline * 16, baseline * 10, baseline * 6][index] || 0 : 0
  }));
}
function buildTechPackSeedSizeDistribution(_context) {
  return null;
}
function createDefaultHighLowCuttingRows(markerId, colors, sizeDistribution) {
  const primaryColor = colors[0] || "\u4E3B\u8272";
  const secondaryColor = colors[1] || "";
  const distributionMap = Object.fromEntries(sizeDistribution.map((item) => [item.sizeLabel, item.quantity]));
  return [primaryColor, secondaryColor].filter(Boolean).map(
    (color, index) => normalizeHighLowCuttingRow(
      {
        rowId: `seed-high-low-cutting-${markerId}-${index + 1}`,
        markerId,
        color,
        sizeValues: {
          ...createDefaultSizeValueMap(),
          S: Math.max(Math.floor((distributionMap.S || 0) / Math.max(index + 1, 1)), 0),
          M: Math.max(Math.floor((distributionMap.M || 0) / Math.max(index + 1, 1)), 0),
          L: Math.max(Math.floor((distributionMap.L || 0) / Math.max(index + 1, 1)), 0),
          XL: Math.max(Math.floor((distributionMap.XL || 0) / Math.max(index + 1, 1)), 0),
          "2XL": Math.max(Math.floor((distributionMap["2XL"] || 0) / Math.max(index + 1, 1)), 0),
          "3XL": distributionMap["3XL"] || 0,
          "4XL": distributionMap["4XL"] || 0,
          onesize: distributionMap.onesize || 0,
          plusonesize: distributionMap.plusonesize || 0
        }
      },
      markerId,
      index
    )
  );
}
function createDefaultHighLowPatternRows(markerId, colors, patternKeys) {
  return (colors.length ? colors : ["\u4E3B\u8272"]).map(
    (color, index) => normalizeHighLowPatternRow(
      {
        rowId: `seed-high-low-pattern-${markerId}-${index + 1}`,
        markerId,
        color,
        patternValues: Object.fromEntries(patternKeys.map((key, patternIndex) => [key, patternIndex === index ? 12 : 0]))
      },
      markerId,
      index,
      patternKeys
    )
  );
}
function summarizeMaterialSku(rows) {
  return uniqueStrings(rows.flatMap((row) => row.materialLineItems.map((item) => item.materialSku))).join(" / ");
}
function summarizeTechPackSpuCode(rows) {
  const techPackSpuCodes = uniqueStrings(rows.map((row) => row.techPackSpuCode));
  return techPackSpuCodes.length === 1 ? techPackSpuCodes[0] : "";
}
function getContextRowsByMarkerPlanRef(batch, rowsById) {
  return batch.items.map((item) => rowsById[item.cutOrderId] || rowsById[item.cutOrderNo]).filter((row) => Boolean(row));
}
function buildContext(rows, rowsById, markerPlanRefs, prefilter) {
  if (!prefilter) return null;
  const markerPlanRef = prefilter.markerPlanId && markerPlanRefs.find((batch) => batch.markerPlanId === prefilter.markerPlanId) || prefilter.markerPlanNo && markerPlanRefs.find((batch) => batch.markerPlanNo === prefilter.markerPlanNo);
  if (markerPlanRef) {
    const batchRows = getContextRowsByMarkerPlanRef(markerPlanRef, rowsById);
    if (!batchRows.length) return null;
    return {
      contextType: "marker-plan-ref",
      cutOrderIds: batchRows.map((row) => row.cutOrderId),
      cutOrderNos: batchRows.map((row) => row.cutOrderNo),
      markerPlanId: markerPlanRef.markerPlanId,
      markerPlanNo: markerPlanRef.markerPlanNo,
      productionOrderNos: uniqueStrings(batchRows.map((row) => row.productionOrderNo)),
      styleCode: markerPlanRef.styleCode || batchRows[0]?.styleCode || "",
      spuCode: markerPlanRef.spuCode || batchRows[0]?.spuCode || "",
      techPackSpuCode: summarizeTechPackSpuCode(batchRows),
      styleName: markerPlanRef.styleName || batchRows[0]?.styleName || "",
      materialSkuSummary: markerPlanRef.materialSkuSummary || summarizeMaterialSku(batchRows),
      materialPrepRows: batchRows
    };
  }
  const matchedRow = prefilter.cutOrderId && rowsById[prefilter.cutOrderId] || prefilter.cutOrderNo && rows.find((row) => row.cutOrderNo === prefilter.cutOrderNo) || null;
  if (!matchedRow) return null;
  return {
    contextType: "cut-order",
    cutOrderIds: [matchedRow.cutOrderId],
    cutOrderNos: [matchedRow.cutOrderNo],
    markerPlanId: matchedRow.markerPlanIds[0] || "",
    markerPlanNo: matchedRow.latestMarkerPlanNo || "",
    productionOrderNos: [matchedRow.productionOrderNo],
    styleCode: matchedRow.styleCode,
    spuCode: matchedRow.spuCode,
    techPackSpuCode: matchedRow.techPackSpuCode || "",
    styleName: matchedRow.styleName,
    materialSkuSummary: matchedRow.materialSkuSummary,
    materialPrepRows: [matchedRow]
  };
}
function matchesContext(record, context) {
  if (!context) return false;
  if (context.contextType === "marker-plan-ref") {
    return record.contextType === "marker-plan-ref" && record.markerPlanId === context.markerPlanId;
  }
  return record.contextType === "cut-order" && record.cutOrderIds[0] === context.cutOrderIds[0];
}
function buildSeedMarker(context) {
  const sizeDistribution = buildTechPackSeedSizeDistribution(context) || defaultSizeDistribution(context.materialPrepRows.length);
  const totalPieces = computeMarkerTotalPieces(sizeDistribution);
  const configuredLengthTotal = context.materialPrepRows.reduce(
    (sum, row) => sum + row.materialLineItems.reduce((lineSum, item) => lineSum + item.configuredQty, 0),
    0
  );
  const netLength = Number((configuredLengthTotal > 0 ? configuredLengthTotal : totalPieces * 1.2).toFixed(2));
  const singlePieceUsage = totalPieces > 0 ? Number((netLength / totalPieces).toFixed(3)) : 0;
  const markerId = `seed-marker-${context.contextType}-${context.markerPlanId || context.cutOrderIds[0]}`;
  const markerMode = context.contextType === "marker-plan-ref" ? "high_low" : "normal";
  const highLowPatternKeys = [...DEFAULT_HIGH_LOW_PATTERN_KEYS];
  const colors = uniqueStrings(context.materialPrepRows.map((row) => row.color));
  const plannedLayerCount = Math.max(Math.ceil(totalPieces / 20), 1);
  const lineItemCount = Math.max(context.materialPrepRows.length, 1);
  const markerLengthPerLine = Number((netLength / lineItemCount).toFixed(2));
  const markerPieceQtyPerLayer = Math.max(Math.ceil(totalPieces / plannedLayerCount / lineItemCount), 1);
  const spreadLengthPerLine = Number((((markerLengthPerLine || 0) + 0.06) * plannedLayerCount).toFixed(2));
  const spreadTotalLength = isHighLowMarkerMode(markerMode) ? Number((netLength * 1.1).toFixed(2)) : Number((spreadLengthPerLine * lineItemCount).toFixed(2));
  const allocationLines = context.contextType === "cut-order" && context.materialPrepRows.length === 1 ? sizeDistribution.filter((item) => item.quantity > 0).map((item, index) => ({
    allocationId: `seed-allocation-${markerId}-${index + 1}`,
    markerId,
    sourceCutOrderId: context.materialPrepRows[0].cutOrderId,
    sourceCutOrderNo: context.materialPrepRows[0].cutOrderNo,
    sourceProductionOrderId: context.materialPrepRows[0].productionOrderId,
    sourceProductionOrderNo: context.materialPrepRows[0].productionOrderNo,
    styleCode: context.materialPrepRows[0].styleCode,
    spuCode: context.materialPrepRows[0].spuCode,
    techPackSpuCode: context.materialPrepRows[0].techPackSpuCode || context.techPackSpuCode || "",
    color: context.materialPrepRows[0].color,
    materialSku: context.materialPrepRows[0].materialSkuSummary,
    sizeLabel: item.sizeLabel,
    plannedGarmentQty: item.quantity,
    note: ""
  })) : [];
  const lineItems = isHighLowMarkerMode(markerMode) ? [] : context.materialPrepRows.map((row, index) => ({
    lineItemId: `seed-line-${context.contextType}-${context.markerPlanId || row.cutOrderId}-${index}`,
    markerId,
    lineNo: index + 1,
    layoutCode: `A-${index + 1}`,
    layoutDetailText: sizeDistribution.filter((item) => item.quantity > 0).map((item) => `${item.sizeLabel}*${item.quantity}`).join(" + "),
    color: row.color,
    ratioLabel: sizeDistribution.map((item) => `${item.sizeLabel}\xD7${item.quantity}`).join(" / "),
    spreadRepeatCount: plannedLayerCount,
    markerLength: markerLengthPerLine,
    markerPieceCount: markerPieceQtyPerLayer,
    pieceCount: markerPieceQtyPerLayer,
    singlePieceUsage,
    spreadTotalLength: spreadLengthPerLine,
    spreadingTotalLength: spreadLengthPerLine,
    widthHint: "\u9ED8\u8BA4\u95E8\u5E45 160cm",
    note: `${row.materialSkuSummary} \xB7 \u9ED8\u8BA4\u551B\u67B6\u660E\u7EC6`
  }));
  const highLowCuttingRows = isHighLowMarkerMode(markerMode) ? createDefaultHighLowCuttingRows(markerId, colors, sizeDistribution) : [];
  const highLowPatternRows = isHighLowMarkerMode(markerMode) ? createDefaultHighLowPatternRows(markerId, colors, highLowPatternKeys) : [];
  return {
    markerId,
    markerNo: `MKP-${context.contextType === "marker-plan-ref" ? "B" : "O"}-${(context.markerPlanNo || context.cutOrderNos[0] || "001").slice(-6)}`,
    schemeId: markerId,
    schemeNo: `MKP-${context.contextType === "marker-plan-ref" ? "B" : "O"}-${(context.markerPlanNo || context.cutOrderNos[0] || "001").slice(-6)}`,
    bedId: `${markerId}-bed-A-1`,
    bedNo: "A-1",
    bedMode: markerMode,
    contextType: context.contextType,
    cutOrderIds: [...context.cutOrderIds],
    cutOrderNos: [...context.cutOrderNos],
    markerPlanId: context.markerPlanId,
    markerPlanNo: context.markerPlanNo,
    styleCode: context.styleCode,
    spuCode: context.spuCode,
    techPackSpuCode: context.techPackSpuCode || "",
    materialSkuSummary: context.materialSkuSummary,
    materialAliasSummary: context.materialAliasSummary || "",
    materialImageUrl: context.materialImageUrl || "",
    colorSummary: uniqueStrings(context.materialPrepRows.map((row) => row.color)).join(" / "),
    markerMode,
    sizeDistribution,
    totalPieces,
    netLength,
    singlePieceUsage,
    spreadTotalLength,
    materialCategory: context.materialPrepRows[0]?.materialCategory || "",
    materialAttr: context.materialPrepRows[0]?.materialLabel || "",
    sizeRatioPlanText: buildPlannedSizeRatioText(sizeDistribution),
    plannedLayerCount,
    plannedMarkerCount: context.materialPrepRows.length,
    markerLength: netLength,
    procurementUnitUsage: singlePieceUsage,
    actualUnitUsage: Number((singlePieceUsage * 1.02).toFixed(3)),
    fabricSku: context.materialPrepRows[0]?.materialLineItems[0]?.materialSku || "",
    plannedMaterialMeter: Number((configuredLengthTotal || spreadTotalLength).toFixed(2)),
    actualMaterialMeter: spreadTotalLength,
    actualCutQty: totalPieces,
    allocationLines,
    lineItems,
    highLowPatternKeys,
    highLowCuttingRows,
    highLowPatternRows,
    markerImageUrl: "",
    markerImageName: "",
    adjustmentRequired: false,
    adjustmentNote: "",
    replacementDraftFlag: false,
    adjustmentSummary: "\u540E\u7EED\u53EF\u8865\u551B\u67B6\u8C03\u6574\u8BB0\u5F55 / \u6362\u4E00\u5165\u53E3\u3002",
    note: "\u9ED8\u8BA4\u65B9\u6848\u8349\u7A3F\u3002",
    updatedAt: "",
    updatedBy: "\u7CFB\u7EDF\u9884\u7F6E",
    warningMessages: buildMarkerWarningMessages({
      markerMode,
      sizeDistribution,
      spreadTotalLength,
      procurementUnitUsage: singlePieceUsage,
      actualUnitUsage: Number((singlePieceUsage * 1.02).toFixed(3)),
      plannedMaterialMeter: Number((configuredLengthTotal || spreadTotalLength).toFixed(2)),
      actualMaterialMeter: spreadTotalLength,
      actualCutQty: totalPieces,
      lineItems,
      highLowPatternKeys,
      highLowCuttingRows,
      highLowPatternRows
    })
  };
}
function createSpreadingDraftFromMarker(marker, context, now = /* @__PURE__ */ new Date(), options) {
  const importSource = buildSpreadingImportSource(marker, context, now, options?.reimported, options?.importNote);
  const planLineItems = buildSpreadingPlanLineItemsFromMarker(marker);
  const highLowPlanSnapshot = buildSpreadingHighLowPlanSnapshotFromMarker(marker);
  const planUnits = buildSpreadingPlanUnitsFromMarker(marker, context);
  const plannedLayers = Math.max(Number(marker.plannedLayerCount || Math.ceil(marker.totalPieces / 20) || 1), 1);
  const theoreticalSpreadTotalLength = isHighLowMarkerMode(marker.markerMode) ? Number(marker.spreadTotalLength || marker.actualMaterialMeter || 0) : Number(marker.spreadTotalLength || computeNormalMarkerSpreadTotalLength(marker.lineItems || []));
  const theoreticalActualCutPieceQty = planUnits.reduce((sum, unit) => sum + Math.max(Number(unit.plannedCutGarmentQty || 0), 0), 0) || Math.max(Number(marker.totalPieces || 0), 0);
  const colorSummary = deriveSpreadingColorSummary({
    importSourceColorSummary: marker.colorSummary,
    contextColors: context.materialPrepRows.map((row) => row.color),
    fallbackSummary: marker.colorSummary
  }).value;
  const baseSession = options?.baseSession || null;
  const timestamp = now.getTime();
  return {
    spreadingSessionId: baseSession?.spreadingSessionId || `spreading-session-${timestamp}`,
    sessionNo: baseSession?.sessionNo || `PB-${String(timestamp).slice(-6)}`,
    contextType: context.contextType,
    cutOrderIds: [...context.cutOrderIds],
    markerPlanId: context.markerPlanId,
    markerPlanNo: context.markerPlanNo,
    markerId: marker.markerId,
    markerNo: marker.markerNo || "",
    sourceSchemeId: marker.schemeId || marker.markerId,
    sourceSchemeNo: marker.schemeNo || marker.markerNo || "",
    sourceBedId: marker.bedId || marker.markerId,
    sourceBedNo: marker.bedNo || marker.markerNo || "",
    sourceBedMode: marker.bedMode || marker.markerMode,
    cuttingTableId: baseSession?.cuttingTableId || "",
    cuttingTableNo: baseSession?.cuttingTableNo || "",
    cuttingTableName: baseSession?.cuttingTableName || "",
    plannedStartAt: baseSession?.plannedStartAt || "",
    plannedEndAt: baseSession?.plannedEndAt || "",
    estimatedDurationMinutes: DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES,
    tableScheduleStatus: baseSession?.tableScheduleStatus || "\u672A\u6392\u7A0B",
    sourceMarkerId: marker.markerId,
    sourceMarkerNo: marker.markerNo || "",
    styleCode: context.styleCode,
    spuCode: context.spuCode,
    materialSkuSummary: context.materialSkuSummary,
    materialAliasSummary: context.materialAliasSummary || "",
    materialImageUrl: context.materialImageUrl || "",
    colorSummary: colorSummary === "\u5F85\u8865" ? "" : colorSummary,
    spreadingMode: normalizeMarkerMode(marker.markerMode),
    status: baseSession?.status || "DRAFT",
    importedFromMarker: true,
    isExceptionBackfill: Boolean(baseSession?.isExceptionBackfill),
    exceptionReason: baseSession?.exceptionReason || "",
    ownerAccountId: baseSession?.ownerAccountId || "",
    ownerName: baseSession?.ownerName || "",
    plannedLayers,
    actualLayers: baseSession?.actualLayers || 0,
    totalActualLength: baseSession?.totalActualLength || 0,
    totalHeadLength: baseSession?.totalHeadLength || 0,
    totalTailLength: baseSession?.totalTailLength || 0,
    totalCalculatedUsableLength: baseSession?.totalCalculatedUsableLength || 0,
    totalRemainingLength: baseSession?.totalRemainingLength || 0,
    operatorCount: baseSession?.operatorCount || 0,
    rollCount: baseSession?.rollCount || 0,
    configuredLengthTotal: baseSession?.configuredLengthTotal || 0,
    claimedLengthTotal: baseSession?.claimedLengthTotal || 0,
    varianceLength: baseSession?.varianceLength || 0,
    varianceNote: baseSession?.varianceNote || "",
    actualCutPieceQty: baseSession?.actualCutPieceQty || 0,
    unitPrice: baseSession?.unitPrice || 0,
    totalAmount: baseSession?.totalAmount || 0,
    note: baseSession?.note || "\u94FA\u5E03\u8349\u7A3F\u5DF2\u4ECE\u5F53\u524D\u551B\u67B6\u7F16\u53F7\u8BB0\u5F55\u5BFC\u5165\uFF0C\u53EF\u7EE7\u7EED\u8865\u5F55\u5377\u4E0E\u4EBA\u5458\u3002",
    createdAt: baseSession?.createdAt || nowText(now),
    updatedAt: nowText(now),
    warningMessages: baseSession?.warningMessages || [],
    importSource,
    planUnits,
    planLineItems,
    highLowPlanSnapshot,
    theoreticalSpreadTotalLength,
    theoreticalActualCutPieceQty,
    importAdjustmentRequired: baseSession?.importAdjustmentRequired || false,
    importAdjustmentNote: baseSession?.importAdjustmentNote || "",
    replenishmentWarning: baseSession?.replenishmentWarning || null,
    completionLinkage: baseSession?.completionLinkage || null,
    prototypeLifecycleOverrides: baseSession?.prototypeLifecycleOverrides || null,
    sourceChannel: baseSession?.sourceChannel || "MANUAL",
    sourceWritebackId: baseSession?.sourceWritebackId || "",
    updatedFromPdaAt: baseSession?.updatedFromPdaAt || "",
    rolls: baseSession?.rolls ? [...baseSession.rolls] : [],
    operators: baseSession?.operators ? [...baseSession.operators] : []
  };
}
function buildSpreadingPlanUnitsFromMarker(marker, context) {
  const fallbackMaterialSku = context.materialSkuSummary.split(" / ")[0] || marker.materialSkuSummary?.split(" / ")[0] || "";
  const resolveMaterialSku = (color) => {
    const matchedRow = context.materialPrepRows.find((row) => row.color === color);
    return matchedRow?.materialSkuSummary || fallbackMaterialSku;
  };
  if (marker.lineItems?.length) {
    return marker.lineItems.map((item, index) => {
      const garmentQtyPerUnit = Math.max(Number(item.markerPieceCount ?? item.pieceCount ?? 0), 0);
      const plannedRepeatCount = Math.max(Number(item.spreadRepeatCount || 0), 0);
      const lengthPerUnitM = Number(item.markerLength || 0);
      const color = item.color || context.materialPrepRows[0]?.color || "";
      const materialSku = resolveMaterialSku(color);
      const plannedSpreadLengthM = Number(item.spreadTotalLength || item.spreadingTotalLength || 0) || Number(((lengthPerUnitM + 0.06) * plannedRepeatCount).toFixed(2));
      return {
        planUnitId: `plan-unit-${marker.markerId}-${index + 1}`,
        sourceType: "marker-line",
        sourceLineId: item.lineItemId || item.markerLineItemId || `line-${index + 1}`,
        color,
        materialSku,
        ...buildPlanUnitMaterialIdentity(context, color, materialSku),
        garmentQtyPerUnit,
        plannedRepeatCount,
        lengthPerUnitM,
        plannedCutGarmentQty: garmentQtyPerUnit * plannedRepeatCount,
        plannedSpreadLengthM
      };
    });
  }
  const highLowRows = marker.highLowCuttingRows || [];
  if (highLowRows.length) {
    const rowCount = highLowRows.length;
    const averageLength = rowCount > 0 ? Number((Number(marker.spreadTotalLength || 0) / rowCount).toFixed(2)) : 0;
    const plannedRepeatCount = Math.max(Number(marker.plannedLayerCount || 0), 1);
    return highLowRows.map((row, index) => {
      const plannedCutGarmentQty = Math.max(Number(row.total || 0), 0);
      const color = row.color || context.materialPrepRows[0]?.color || "";
      const materialSku = resolveMaterialSku(color);
      return {
        planUnitId: `plan-unit-${marker.markerId}-${index + 1}`,
        sourceType: "high-low-row",
        sourceLineId: row.rowId || `high-low-${index + 1}`,
        color,
        materialSku,
        ...buildPlanUnitMaterialIdentity(context, color, materialSku),
        garmentQtyPerUnit: plannedRepeatCount > 0 ? Math.max(Math.ceil(plannedCutGarmentQty / plannedRepeatCount), 0) : plannedCutGarmentQty,
        plannedRepeatCount,
        lengthPerUnitM: Number(marker.markerLength || marker.netLength || 0),
        plannedCutGarmentQty,
        plannedSpreadLengthM: averageLength
      };
    });
  }
  return [
    {
      planUnitId: `plan-unit-${marker.markerId}-fallback`,
      sourceType: "exception",
      sourceLineId: marker.markerId,
      color: context.materialPrepRows[0]?.color || "",
      materialSku: fallbackMaterialSku,
      ...buildPlanUnitMaterialIdentity(context, context.materialPrepRows[0]?.color || "", fallbackMaterialSku),
      garmentQtyPerUnit: Math.max(Number(marker.totalPieces || 0), 0),
      plannedRepeatCount: 1,
      lengthPerUnitM: Number(marker.netLength || 0),
      plannedCutGarmentQty: Math.max(Number(marker.totalPieces || 0), 0),
      plannedSpreadLengthM: Number(marker.spreadTotalLength || 0)
    }
  ];
}
function validateMarkerForSpreadingImport(marker) {
  const messages = [];
  const mode = marker.markerMode ? normalizeMarkerMode(marker.markerMode) : null;
  const templateType = mode ? deriveMarkerTemplateByMode(mode) : null;
  if (!mode) messages.push("\u5E8A\u6B21\u6A21\u5F0F\u4E0D\u80FD\u4E3A\u7A7A\uFF0C\u4E0D\u80FD\u53D1\u8D77\u94FA\u5E03\u5BFC\u5165\u3002");
  if (!marker.contextType) messages.push("\u551B\u67B6\u5173\u8054\u4FE1\u606F\u4E0D\u80FD\u4E3A\u7A7A\uFF0C\u4E0D\u80FD\u53D1\u8D77\u94FA\u5E03\u5BFC\u5165\u3002");
  if (!(marker.cutOrderIds || []).length && !marker.markerPlanId && !marker.markerPlanNo) {
    messages.push("\u551B\u67B6\u5FC5\u987B\u81F3\u5C11\u5173\u8054\u88C1\u7247\u5355\u6216\u551B\u67B6\u65B9\u6848\uFF0C\u624D\u80FD\u5BFC\u5165\u94FA\u5E03\u3002");
  }
  if (Number(marker.totalPieces || 0) <= 0) messages.push("\u5E8A\u6B21\u6210\u8863\u4EF6\u6570\u5FC5\u987B\u5927\u4E8E 0\uFF0C\u624D\u80FD\u5BFC\u5165\u94FA\u5E03\u3002");
  if (Number(marker.netLength || 0) <= 0) messages.push("\u5E8A\u6B21\u51C0\u957F\u5EA6\u4E0D\u80FD\u4E3A\u7A7A\uFF0C\u624D\u80FD\u5BFC\u5165\u94FA\u5E03\u3002");
  if (Number(marker.singlePieceUsage || 0) <= 0) messages.push("\u5E8A\u6B21\u5355\u4EF6\u7528\u91CF\u4E0D\u80FD\u4E3A\u7A7A\uFF0C\u624D\u80FD\u5BFC\u5165\u94FA\u5E03\u3002");
  if (templateType === "row-template" && !(marker.lineItems || []).length) {
    messages.push("\u5F53\u524D\u551B\u67B6\u7F16\u53F7\u7F3A\u5C11\u551B\u67B6\u660E\u7EC6\uFF0C\u4E0D\u80FD\u5BFC\u5165\u94FA\u5E03\u8349\u7A3F\u3002");
  }
  if (templateType === "matrix-template") {
    if (!(marker.highLowCuttingRows || []).length) {
      messages.push("\u9AD8\u4F4E\u5C42\u5E8A\u6B21\u7F3A\u5C11\u88C1\u526A\u660E\u7EC6\u77E9\u9635\uFF0C\u4E0D\u80FD\u5BFC\u5165\u94FA\u5E03\u8349\u7A3F\u3002");
    }
    if (!(marker.highLowPatternRows || []).length) {
      messages.push("\u9AD8\u4F4E\u5C42\u551B\u67B6\u7F3A\u5C11\u6A21\u5F0F\u5206\u5E03\u77E9\u9635\uFF0C\u4E0D\u80FD\u5BFC\u5165\u94FA\u5E03\u8349\u7A3F\u3002");
    }
  }
  return {
    allowed: messages.length === 0,
    messages
  };
}
function buildSpreadingPlanLineItemsFromMarker(marker) {
  return (marker.lineItems || []).map((item, index) => ({
    planItemId: `spreading-plan-${marker.markerId}-${index + 1}`,
    sourceMarkerLineItemId: item.lineItemId || item.markerLineItemId || "",
    layoutCode: item.layoutCode || `A-${index + 1}`,
    layoutDetailText: item.layoutDetailText || item.ratioLabel || "",
    color: item.color || "",
    spreadRepeatCount: Number(item.spreadRepeatCount || 0),
    markerLength: Number(item.markerLength || 0),
    markerPieceCount: Number(item.markerPieceCount ?? item.pieceCount ?? 0),
    singlePieceUsage: Number(item.singlePieceUsage || 0) || computeSinglePieceUsage(Number(item.markerLength || 0), Number(item.markerPieceCount ?? item.pieceCount ?? 0)),
    plannedSpreadTotalLength: Number(item.spreadTotalLength || item.spreadingTotalLength || 0) || Number(((Number(item.markerLength || 0) + 0.06) * Math.max(Number(item.spreadRepeatCount || 0), 0)).toFixed(2)),
    widthHint: item.widthHint || "",
    note: item.note || ""
  }));
}
function buildSpreadingHighLowPlanSnapshotFromMarker(marker) {
  if (deriveMarkerTemplateByMode(marker.markerMode) !== "matrix-template") return null;
  const patternKeys = marker.highLowPatternKeys?.length ? [...marker.highLowPatternKeys] : [...DEFAULT_HIGH_LOW_PATTERN_KEYS];
  const cuttingTotals = computeHighLowCuttingTotals(marker.highLowCuttingRows || []);
  const patternTotals = computeHighLowPatternTotals(marker.highLowPatternRows || [], patternKeys);
  return {
    patternKeys,
    cuttingRows: cuttingTotals.rows,
    patternRows: patternTotals.rows,
    cuttingTotal: cuttingTotals.cuttingTotal,
    patternTotal: patternTotals.patternTotal
  };
}
function buildSpreadingImportSource(marker, context, now = /* @__PURE__ */ new Date(), reimported = false, importNote = "") {
  return {
    sourceMarkerId: marker.markerId,
    sourceMarkerNo: marker.markerNo || marker.markerId,
    sourceMarkerMode: normalizeMarkerMode(marker.markerMode),
    sourceContextType: context.contextType,
    sourceCutOrderIds: [...context.cutOrderIds],
    sourceCutOrderNos: [...context.cutOrderNos],
    sourceMarkerPlanId: context.markerPlanId,
    sourceMarkerPlanNo: context.markerPlanNo,
    sourceStyleCode: marker.styleCode || context.styleCode,
    sourceSpuCode: marker.spuCode || context.spuCode,
    sourceMaterialSkuSummary: marker.materialSkuSummary || context.materialSkuSummary,
    sourceColorSummary: marker.colorSummary || uniqueStrings(context.materialPrepRows.map((row) => row.color)).join(" / "),
    importedAt: nowText(now),
    importedBy: "\u7CFB\u7EDF\u5BFC\u5165",
    reimported,
    importNote: importNote || (reimported ? "\u5DF2\u6309\u5BFC\u5165\u7B56\u7565\u91CD\u65B0\u540C\u6B65\u551B\u67B6\u7406\u8BBA\u6570\u636E\u3002" : "\u7531\u551B\u67B6\u8BB0\u5F55\u751F\u6210\u94FA\u5E03\u8349\u7A3F\u3002")
  };
}
function buildSpreadingReplenishmentWarning(options) {
  const session = options.session;
  const claimedLengthTotal = Number(session.claimedLengthTotal || 0);
  const configuredLengthTotal = Number(session.configuredLengthTotal || 0);
  const coreMetrics = buildSpreadingCoreMetrics({
    context: options.context || null,
    session,
    markerTotalPieces: options.markerTotalPieces,
    configuredLengthTotal,
    claimedLengthTotal
  });
  const warningMessages = options.warningMessages || [];
  const warningLevel = deriveSpreadingWarningLevel({
    requiredQty: coreMetrics.plannedCutGarmentQty,
    actualCutQty: coreMetrics.actualCutGarmentQty,
    varianceLength: coreMetrics.varianceLength,
    claimedLengthTotal: coreMetrics.claimedLengthTotal,
    actualLengthTotal: coreMetrics.spreadActualLengthM,
    warningMessages
  });
  const suggestedAction = deriveSpreadingSuggestedAction({
    requiredQty: coreMetrics.plannedCutGarmentQty,
    actualCutQty: coreMetrics.actualCutGarmentQty,
    varianceLength: coreMetrics.varianceLength,
    claimedLengthTotal: coreMetrics.claimedLengthTotal,
    actualLengthTotal: coreMetrics.spreadActualLengthM,
    warningMessages
  });
  return {
    warningId: `spread-warning-${session.spreadingSessionId || Date.now()}`,
    sourceType: "spreading-session",
    sourceContextType: session.contextType || "cut-order",
    spreadingSessionId: session.spreadingSessionId || "",
    spreadingSessionNo: session.sessionNo || session.spreadingSessionId || "",
    cutOrderIds: [...session.cutOrderIds || []],
    cutOrderNos: [...options.cutOrderNos],
    markerPlanId: session.markerPlanId || "",
    markerPlanNo: session.markerPlanNo || "",
    productionOrderNos: [...options.productionOrderNos],
    styleCode: session.styleCode || "",
    spuCode: session.spuCode || "",
    materialSku: session.materialSkuSummary || "",
    materialAttr: options.materialAttr || "",
    plannedCutGarmentQty: coreMetrics.plannedCutGarmentQty,
    theoreticalCutGarmentQty: coreMetrics.theoreticalCutGarmentQty,
    actualCutGarmentQty: coreMetrics.actualCutGarmentQty,
    spreadActualLengthM: coreMetrics.spreadActualLengthM,
    spreadUsableLengthM: coreMetrics.spreadUsableLengthM,
    spreadRemainingLengthM: coreMetrics.spreadRemainingLengthM,
    fabricRollCount: coreMetrics.fabricRollCount,
    spreadLayerCount: coreMetrics.spreadLayerCount,
    plannedCutGarmentQtyFormula: coreMetrics.plannedCutGarmentQtyFormula,
    theoreticalCutGarmentQtyFormula: coreMetrics.theoreticalCutGarmentQtyFormula,
    actualCutGarmentQtyFormula: coreMetrics.actualCutGarmentQtyFormula,
    spreadUsableLengthFormula: coreMetrics.spreadUsableLengthFormula,
    varianceLengthFormula: coreMetrics.varianceLengthFormula,
    shortageGarmentQtyFormula: coreMetrics.shortageGarmentQtyFormula,
    suggestedActionRuleText: coreMetrics.warningRuleText,
    lines: coreMetrics.replenishmentLines.map((line) => ({ ...line, suggestedAction })),
    requiredQty: coreMetrics.plannedCutGarmentQty,
    theoreticalCapacityQty: coreMetrics.theoreticalCutGarmentQty,
    actualCutQty: coreMetrics.actualCutGarmentQty,
    configuredLengthTotal,
    claimedLengthTotal,
    totalActualLength: coreMetrics.spreadActualLengthM,
    totalUsableLength: coreMetrics.spreadUsableLengthM,
    varianceLength: coreMetrics.varianceLength,
    shortageQty: coreMetrics.shortageGarmentQty,
    warningLevel,
    suggestedAction,
    handled: false,
    createdAt: options.createdAt || nowText(),
    note: options.note || warningMessages[0] || "\u5F53\u524D\u7531\u94FA\u5E03\u5B8C\u6210\u52A8\u4F5C\u751F\u6210\u8865\u6599\u9884\u8B66\u57FA\u7840\u6570\u636E\u3002"
  };
}
function validateSpreadingCompletion(options) {
  const { session, markerTotalPieces, selectedCutOrderIds } = options;
  const messages = [];
  const rolls = session.rolls || [];
  if (!rolls.length) {
    messages.push("\u5FC5\u987B\u81F3\u5C11\u5F55\u5165\u4E00\u6761\u5377\u8BB0\u5F55\u540E\uFF0C\u624D\u80FD\u5B8C\u6210\u94FA\u5E03\u3002");
  }
  if (rolls.some((roll) => !roll.rollNo.trim() || !roll.occurredAt || Number(roll.actualLength || 0) <= 0)) {
    messages.push("\u5B58\u5728\u5377\u8BB0\u5F55\u7F3A\u5C11\u5377\u53F7\u3001\u65F6\u95F4\u6216\u5B9E\u9645\u957F\u5EA6\uFF0C\u5F53\u524D\u4E0D\u80FD\u5B8C\u6210\u94FA\u5E03\u3002");
  }
  if (rolls.some((roll) => !String(roll.planUnitId || "").trim())) {
    messages.push("\u5B58\u5728\u5377\u8BB0\u5F55\u5C1A\u672A\u7ED1\u5B9A\u5E8A\u6B21\u9879\uFF0C\u5F53\u524D\u4E0D\u80FD\u5B8C\u6210\u94FA\u5E03\u3002");
  }
  if (markerTotalPieces <= 0) {
    messages.push("\u5F53\u524D\u7F3A\u5C11\u5355\u5C42\u6210\u8863\u4EF6\u6570\uFF0C\u65E0\u6CD5\u51C6\u786E\u63A8\u5BFC\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF0C\u4E0D\u80FD\u5B8C\u6210\u94FA\u5E03\u3002");
  }
  if (session.contextType === "marker-plan-ref" && !selectedCutOrderIds.length) {
    messages.push("\u551B\u67B6\u65B9\u6848\u4E0A\u4E0B\u6587\u4E0B\u5FC5\u987B\u52FE\u9009\u81F3\u5C11\u4E00\u4E2A\u88C1\u7247\u5355\uFF0C\u624D\u80FD\u8054\u52A8\u5B8C\u6210\u94FA\u5E03\u3002");
  }
  if (session.contextType === "cut-order" && !(session.cutOrderIds || []).length) {
    messages.push("\u5F53\u524D\u7F3A\u5C11\u88C1\u7247\u5355\u4E0A\u4E0B\u6587\uFF0C\u4E0D\u80FD\u5B8C\u6210\u94FA\u5E03\u3002");
  }
  return {
    allowed: messages.length === 0,
    messages
  };
}
function finalizeSpreadingCompletion(options) {
  const completedAt = nowText(options.now);
  const replenishmentWarning = buildSpreadingReplenishmentWarning({
    context: options.context || null,
    session: options.session,
    markerTotalPieces: options.markerTotalPieces,
    cutOrderNos: options.linkedCutOrderNos,
    productionOrderNos: options.productionOrderNos,
    materialAttr: options.materialAttr,
    createdAt: completedAt,
    warningMessages: options.warningMessages
  });
  return {
    ...options.session,
    status: "DONE",
    actualEndAt: options.session.actualEndAt || completedAt,
    cuttingStatus: options.session.cuttingStatus || "WAITING_CUTTING",
    cuttingStatusUpdatedAt: options.session.cuttingStatusUpdatedAt || completedAt,
    replenishmentWarning,
    completionLinkage: {
      completedAt,
      completedBy: options.completedBy || "\u94FA\u5E03\u7F16\u8F91\u9875",
      linkedCutOrderIds: [...options.linkedCutOrderIds],
      linkedCutOrderNos: [...options.linkedCutOrderNos],
      generatedWarningId: replenishmentWarning.warningId,
      generatedWarning: true,
      note: replenishmentWarning.suggestedAction === "\u65E0\u9700\u8865\u6599" ? "\u5F53\u524D\u94FA\u5E03\u5DF2\u5B8C\u6210\uFF0C\u672A\u89E6\u53D1\u660E\u663E\u8865\u6599\u9884\u8B66\u3002" : `\u5F53\u524D\u94FA\u5E03\u5DF2\u5B8C\u6210\uFF0C\u5E76\u751F\u6210\u8865\u6599\u9884\u8B66\uFF1A${replenishmentWarning.suggestedAction}\uFF0C\u5EFA\u8BAE\u8FDB\u5165\u8865\u6599\u7BA1\u7406\u786E\u8BA4\u540E\u56DE\u4E2D\u8F6C\u4ED3\u914D\u6599\u3002`
    },
    varianceLength: replenishmentWarning.varianceLength,
    varianceNote: replenishmentWarning.suggestedAction === "\u65E0\u9700\u8865\u6599" ? "\u5F53\u524D\u94FA\u5E03\u5DF2\u5B8C\u6210\uFF0C\u5DEE\u5F02\u672A\u89E6\u53D1\u5DEE\u5F02\u5904\u7406\u3002" : replenishmentWarning.suggestedAction
  };
}
function hasSpreadingActualExecution(session) {
  if (!session) return false;
  return Boolean((session.rolls || []).length || (session.operators || []).length);
}
function summarizeSpreadingRolls(rolls) {
  const totalActualCutGarmentQty = rolls.reduce(
    (sum, roll) => sum + Math.max((roll.actualCutGarmentQty ?? roll.actualCutPieceQty) || 0, 0),
    0
  );
  return {
    totalActualLength: Number(rolls.reduce((sum, roll) => sum + Math.max(roll.actualLength, 0), 0).toFixed(2)),
    totalHeadLength: Number(rolls.reduce((sum, roll) => sum + Math.max(roll.headLength, 0), 0).toFixed(2)),
    totalTailLength: Number(rolls.reduce((sum, roll) => sum + Math.max(roll.tailLength, 0), 0).toFixed(2)),
    totalCalculatedUsableLength: Number(rolls.reduce((sum, roll) => sum + computeUsableLength(roll.actualLength, roll.headLength, roll.tailLength), 0).toFixed(2)),
    totalRemainingLength: Number(rolls.reduce((sum, roll) => sum + computeRemainingLength(roll.labeledLength, roll.actualLength), 0).toFixed(2)),
    totalActualCutPieceQty: totalActualCutGarmentQty,
    totalActualCutGarmentQty,
    rollCount: rolls.length,
    totalLayers: rolls.reduce((sum, roll) => sum + Math.max(roll.layerCount, 0), 0)
  };
}
function parseOptionalNumber(value) {
  if (value === void 0 || value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function computeOperatorHandledLayerCount(startLayer, endLayer) {
  const start = parseOptionalNumber(startLayer);
  const end = parseOptionalNumber(endLayer);
  if (start === null || end === null) return null;
  if (end < start) return null;
  return end - start + 1;
}
function computeOperatorHandledPieceQty(startLayer, endLayer, markerTotalPieces) {
  const handledLayerCount = computeOperatorHandledLayerCount(startLayer, endLayer);
  if (handledLayerCount === null || markerTotalPieces <= 0) return null;
  return handledLayerCount * markerTotalPieces;
}
function computeOperatorCalculatedAmount(options) {
  const pricingMode = options.pricingMode || "\u6309\u4EF6\u8BA1\u4EF7";
  const unitPrice = parseOptionalNumber(options.unitPrice);
  const handledLayerCount = parseOptionalNumber(options.handledLayerCount);
  const handledLength = parseOptionalNumber(options.handledLength);
  const handledPieceQty = parseOptionalNumber(options.handledPieceQty);
  if (unitPrice === null || unitPrice < 0) return null;
  if (pricingMode === "\u6309\u957F\u5EA6\u8BA1\u4EF7") {
    if (handledLength === null) return null;
    return Number((handledLength * unitPrice).toFixed(2));
  }
  if (pricingMode === "\u6309\u5C42\u8BA1\u4EF7") {
    if (handledLayerCount === null) return null;
    return Number((handledLayerCount * unitPrice).toFixed(2));
  }
  if (handledPieceQty === null) return null;
  return Number((handledPieceQty * unitPrice).toFixed(2));
}
function computeOperatorDisplayAmount(operator, calculatedAmount) {
  if (operator.manualAmountAdjusted) {
    return parseOptionalNumber(operator.adjustedAmount);
  }
  return parseOptionalNumber(operator.calculatedAmount) ?? parseOptionalNumber(calculatedAmount);
}
function validateOperatorManualAmountAdjustment(operator) {
  const warnings = [];
  const operatorLabel = operator.operatorName || "\u672A\u547D\u540D\u4EBA\u5458";
  if (!operator.manualAmountAdjusted) return warnings;
  const adjustedAmount = parseOptionalNumber(operator.adjustedAmount);
  if (adjustedAmount === null) {
    warnings.push(`${operatorLabel} \u5DF2\u5F00\u542F\u4EBA\u5DE5\u8C03\u6574\u91D1\u989D\uFF0C\u4F46\u672A\u586B\u5199\u8C03\u6574\u540E\u91D1\u989D\u3002`);
    return warnings;
  }
  if (adjustedAmount < 0) {
    warnings.push(`${operatorLabel} \u7684\u8C03\u6574\u540E\u91D1\u989D\u5C0F\u4E8E 0\uFF0C\u8BF7\u590D\u6838\u3002`);
  }
  return warnings;
}
function buildOperatorAmountAggregation(operators, markerTotalPieces, defaultUnitPrice) {
  const summaryMap = /* @__PURE__ */ new Map();
  let totalHandledLayerCount = 0;
  let totalHandledLength = 0;
  let totalHandledPieceQty = 0;
  let totalHandledGarmentQty = 0;
  let totalCalculatedAmount = 0;
  let totalDisplayAmount = 0;
  let hasManualAdjustedAmount = false;
  let hasAnyAllocationData = false;
  operators.forEach((operator) => {
    const operatorName = operator.operatorName || "\u5F85\u8865\u5F55\u4EBA\u5458";
    const handledLayerCount = parseOptionalNumber(operator.handledLayerCount) ?? computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer) ?? 0;
    const handledLength = parseOptionalNumber(operator.handledLength) ?? 0;
    const handledPieceQty = parseOptionalNumber(operator.handledGarmentQty ?? operator.handledPieceQty) ?? computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces) ?? 0;
    const unitPrice = parseOptionalNumber(operator.unitPrice) ?? parseOptionalNumber(defaultUnitPrice);
    const calculatedAmount = parseOptionalNumber(operator.calculatedAmount) ?? computeOperatorCalculatedAmount({
      pricingMode: operator.pricingMode,
      unitPrice,
      handledLayerCount,
      handledLength,
      handledPieceQty
    }) ?? 0;
    const displayAmount = computeOperatorDisplayAmount(operator, calculatedAmount) ?? 0;
    const current = summaryMap.get(operatorName) || {
      operatorName,
      recordCount: 0,
      handledLayerCountTotal: 0,
      handledLengthTotal: 0,
      handledPieceQtyTotal: 0,
      handledGarmentQtyTotal: 0,
      calculatedAmountTotal: 0,
      displayAmountTotal: 0,
      hasManualAdjustedAmount: false
    };
    current.recordCount += 1;
    current.handledLayerCountTotal += handledLayerCount;
    current.handledLengthTotal = Number((current.handledLengthTotal + handledLength).toFixed(2));
    current.handledPieceQtyTotal += handledPieceQty;
    current.handledGarmentQtyTotal += handledPieceQty;
    current.calculatedAmountTotal = Number((current.calculatedAmountTotal + calculatedAmount).toFixed(2));
    current.displayAmountTotal = Number((current.displayAmountTotal + displayAmount).toFixed(2));
    current.hasManualAdjustedAmount = current.hasManualAdjustedAmount || Boolean(operator.manualAmountAdjusted);
    summaryMap.set(operatorName, current);
    totalHandledLayerCount += handledLayerCount;
    totalHandledLength = Number((totalHandledLength + handledLength).toFixed(2));
    totalHandledPieceQty += handledPieceQty;
    totalHandledGarmentQty += handledPieceQty;
    totalCalculatedAmount = Number((totalCalculatedAmount + calculatedAmount).toFixed(2));
    totalDisplayAmount = Number((totalDisplayAmount + displayAmount).toFixed(2));
    hasManualAdjustedAmount = hasManualAdjustedAmount || Boolean(operator.manualAmountAdjusted);
    hasAnyAllocationData = hasAnyAllocationData || Boolean(handledLayerCount || handledLength || handledPieceQty || displayAmount || unitPrice !== null);
  });
  return {
    rows: Array.from(summaryMap.values()).sort((left, right) => left.operatorName.localeCompare(right.operatorName, "zh-CN")),
    totalHandledLayerCount,
    totalHandledLength,
    totalHandledPieceQty,
    totalHandledGarmentQty,
    totalCalculatedAmount,
    totalDisplayAmount,
    hasManualAdjustedAmount,
    hasAnyAllocationData
  };
}
function summarizeRollOperatorAmounts(operators, markerTotalPieces, defaultUnitPrice) {
  return buildOperatorAmountAggregation(operators, markerTotalPieces, defaultUnitPrice);
}
function summarizeSpreadingOperatorAmounts(operators, markerTotalPieces, defaultUnitPrice) {
  return buildOperatorAmountAggregation(operators, markerTotalPieces, defaultUnitPrice);
}
function buildOperatorAmountWarnings(operators, markerTotalPieces, defaultUnitPrice) {
  const warnings = [];
  const positivePieceRows = operators.map((operator) => ({
    operator,
    handledPieceQty: parseOptionalNumber(operator.handledPieceQty) ?? computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces),
    unitPrice: parseOptionalNumber(operator.unitPrice) ?? parseOptionalNumber(defaultUnitPrice),
    displayAmount: computeOperatorDisplayAmount(operator) ?? computeOperatorCalculatedAmount({
      pricingMode: operator.pricingMode,
      unitPrice: parseOptionalNumber(operator.unitPrice) ?? parseOptionalNumber(defaultUnitPrice),
      handledLayerCount: operator.handledLayerCount,
      handledLength: operator.handledLength,
      handledPieceQty: parseOptionalNumber(operator.handledPieceQty) ?? computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces)
    })
  })).filter((item) => (item.handledPieceQty ?? 0) > 0);
  const pieceAverage = positivePieceRows.length > 1 ? positivePieceRows.reduce((sum, item) => sum + Math.max(item.handledPieceQty || 0, 0), 0) / positivePieceRows.length : 0;
  const amountAverage = positivePieceRows.length > 1 ? positivePieceRows.reduce((sum, item) => sum + Math.max(item.displayAmount || 0, 0), 0) / positivePieceRows.length : 0;
  operators.forEach((operator, index) => {
    const operatorLabel = operator.operatorName || `\u7B2C ${index + 1} \u6761\u4EBA\u5458\u8BB0\u5F55`;
    const handledLayerCount = parseOptionalNumber(operator.handledLayerCount) ?? computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer);
    const handledPieceQty = parseOptionalNumber(operator.handledPieceQty) ?? computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces);
    const pricingMode = operator.pricingMode || "\u6309\u4EF6\u8BA1\u4EF7";
    const unitPrice = parseOptionalNumber(operator.unitPrice) ?? parseOptionalNumber(defaultUnitPrice);
    const calculatedAmount = parseOptionalNumber(operator.calculatedAmount) ?? computeOperatorCalculatedAmount({
      pricingMode,
      unitPrice,
      handledLayerCount,
      handledLength: operator.handledLength,
      handledPieceQty
    });
    const displayAmount = computeOperatorDisplayAmount(operator, calculatedAmount);
    if (unitPrice === null) {
      warnings.push(`${operatorLabel} \u7F3A\u5C11\u5355\u4EF7\uFF0C\u5F53\u524D\u65E0\u6CD5\u5F62\u6210\u5B8C\u6574\u91D1\u989D\u3002`);
    }
    if (handledPieceQty === null) {
      warnings.push(`${operatorLabel} \u7F3A\u5C11\u5F00\u59CB\u5C42 / \u7ED3\u675F\u5C42\u6216\u5355\u5C42\u6210\u8863\u4EF6\u6570\uFF0C\u5F53\u524D\u65E0\u6CD5\u8BA1\u7B97\u8D1F\u8D23\u6210\u8863\u4EF6\u6570\u3002`);
    }
    if (parseOptionalNumber(operator.handledLength) === null) {
      warnings.push(`${operatorLabel} \u7F3A\u5C11\u8D1F\u8D23\u957F\u5EA6\u3002`);
    }
    validateOperatorManualAmountAdjustment(operator).forEach((message) => warnings.push(message));
    if (pieceAverage > 0 && (handledPieceQty || 0) > pieceAverage * 2) {
      warnings.push(`${operatorLabel} \u7684\u8D1F\u8D23\u6210\u8863\u4EF6\u6570\u660E\u663E\u9AD8\u4E8E\u5F53\u524D\u5E73\u5747\u503C\uFF0C\u8BF7\u590D\u6838\u5C42\u6570\u533A\u95F4\u3002`);
    }
    if (amountAverage > 0 && (displayAmount || 0) > amountAverage * 2) {
      warnings.push(`${operatorLabel} \u7684\u91D1\u989D\u660E\u663E\u9AD8\u4E8E\u5F53\u524D\u5E73\u5747\u503C\uFF0C\u8BF7\u590D\u6838\u5355\u4EF7\u6216\u4EBA\u5DE5\u8C03\u6574\u3002`);
    }
  });
  return Array.from(new Set(warnings));
}
function validateRollHandoverContinuity(operators) {
  const warnings = [];
  let overlapDetected = false;
  let gapDetected = false;
  let previousEndLayer = null;
  operators.forEach((operator) => {
    const startLayer = parseOptionalNumber(operator.startLayer);
    const endLayer = parseOptionalNumber(operator.endLayer);
    const operatorLabel = operator.operatorName || "\u672A\u547D\u540D\u4EBA\u5458";
    if (startLayer === null || endLayer === null) {
      warnings.push(`${operatorLabel} \u7F3A\u5C11\u5F00\u59CB\u5C42\u6216\u7ED3\u675F\u5C42\uFF0C\u5F53\u524D\u4EA4\u63A5\u533A\u95F4\u5F85\u8865\u5F55\u3002`);
      return;
    }
    if (endLayer < startLayer) {
      warnings.push(`${operatorLabel} \u7684\u7ED3\u675F\u5C42\u5C0F\u4E8E\u5F00\u59CB\u5C42\uFF0C\u8BF7\u590D\u6838\u4EA4\u63A5\u533A\u95F4\u3002`);
      return;
    }
    if (previousEndLayer !== null) {
      if (startLayer <= previousEndLayer) {
        overlapDetected = true;
        warnings.push(`${operatorLabel} \u7684\u5F00\u59CB\u5C42\u4E0E\u4E0A\u4E00\u6761\u8BB0\u5F55\u91CD\u53E0\uFF0C\u8BF7\u68C0\u67E5\u540C\u5377\u4EA4\u63A5\u5C42\u6570\u3002`);
      } else if (startLayer > previousEndLayer + 1) {
        gapDetected = true;
        warnings.push(`${operatorLabel} \u7684\u5F00\u59CB\u5C42\u4E0E\u4E0A\u4E00\u6761\u8BB0\u5F55\u4E4B\u95F4\u5B58\u5728\u65AD\u6863\uFF0C\u8BF7\u8865\u9F50\u4E2D\u95F4\u5C42\u6570\u3002`);
      }
    }
    previousEndLayer = endLayer;
  });
  return {
    continuityStatus: overlapDetected ? "\u5C42\u6570\u91CD\u53E0" : gapDetected ? "\u5C42\u6570\u65AD\u6863" : warnings.length ? "\u5F85\u8865\u5F55" : "\u8FDE\u7EED",
    overlapDetected,
    gapDetected,
    warnings
  };
}
function validateRollHandledLength(roll, operators) {
  const totalHandledLength = Number(
    operators.reduce((sum, operator) => sum + Math.max(parseOptionalNumber(operator.handledLength) || 0, 0), 0).toFixed(2)
  );
  const lengthExceeded = roll.actualLength > 0 && totalHandledLength - roll.actualLength > 1e-4;
  return {
    totalHandledLength,
    lengthExceeded,
    warnings: lengthExceeded ? [`\u5377 ${roll.rollNo || "\u672A\u547D\u540D\u5377"} \u7684\u4EBA\u5458\u8D1F\u8D23\u957F\u5EA6\u5408\u8BA1\u5DF2\u8D85\u8FC7\u8BE5\u5377\u5B9E\u9645\u957F\u5EA6\u3002`] : []
  };
}
function buildRollHandoverWarnings(roll, operators, markerTotalPieces) {
  const warnings = [];
  const rollLabel = roll.rollNo || "\u672A\u547D\u540D\u5377";
  const continuity = validateRollHandoverContinuity(operators);
  const handledLength = validateRollHandledLength(roll, operators);
  const sortedOperators = [...operators].sort((left, right) => {
    const sortGap = (left.sortOrder || 0) - (right.sortOrder || 0);
    if (sortGap !== 0) return sortGap;
    const startGap = parseTimeWeight(left.startAt) - parseTimeWeight(right.startAt);
    if (startGap !== 0) return startGap;
    return 0;
  });
  const lastOperator = sortedOperators[sortedOperators.length - 1] || null;
  const finalHandledLayer = lastOperator ? parseOptionalNumber(lastOperator.endLayer) : null;
  continuity.warnings.forEach((message) => warnings.push(message));
  handledLength.warnings.forEach((message) => warnings.push(message));
  sortedOperators.forEach((operator, index) => {
    const operatorLabel = operator.operatorName || `\u7B2C ${index + 1} \u6761\u4EBA\u5458\u8BB0\u5F55`;
    const handledLayerCount = computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer);
    const handledPieceQty = computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces);
    if (handledLayerCount === null) {
      warnings.push(`${rollLabel} / ${operatorLabel} \u7F3A\u5C11\u6709\u6548\u5C42\u6570\u533A\u95F4\u3002`);
    }
    if (handledPieceQty === null) {
      warnings.push(`${rollLabel} / ${operatorLabel} \u65E0\u6CD5\u8BA1\u7B97\u8D1F\u8D23\u6210\u8863\u4EF6\u6570\uFF0C\u8BF7\u8865\u5F55\u5C42\u6570\u6216\u5355\u5C42\u6210\u8863\u4EF6\u6570\u3002`);
    }
    if (parseOptionalNumber(operator.handledLength) === null) {
      warnings.push(`${rollLabel} / ${operatorLabel} \u7F3A\u5C11\u8D1F\u8D23\u957F\u5EA6\u3002`);
    }
    if ((operator.actionType === "\u4E2D\u9014\u4EA4\u63A5" || operator.actionType === "\u63A5\u624B\u7EE7\u7EED") && !operator.handoverNotes.trim()) {
      warnings.push(`${rollLabel} / ${operatorLabel} \u5DF2\u6807\u8BB0\u4EA4\u63A5\u52A8\u4F5C\uFF0C\u4F46\u7F3A\u5C11\u4EA4\u63A5\u8BF4\u660E\u3002`);
    }
  });
  if (roll.layerCount > 0 && finalHandledLayer !== null && finalHandledLayer < roll.layerCount) {
    warnings.push(`${rollLabel} \u5F53\u524D\u6700\u540E\u4E00\u6761\u4EBA\u5458\u8BB0\u5F55\u53EA\u94FA\u5230\u7B2C ${finalHandledLayer} \u5C42\uFF0C\u5C1A\u672A\u5B8C\u6574\u94FA\u5B8C\u81F3\u7B2C ${roll.layerCount} \u5C42\u3002`);
  }
  return Array.from(new Set(warnings));
}
function buildRollHandoverViewModel(roll, operators, markerTotalPieces) {
  const sortedOperators = [...operators].sort((left, right) => {
    const sortGap = (left.sortOrder || 0) - (right.sortOrder || 0);
    if (sortGap !== 0) return sortGap;
    const startGap = parseTimeWeight(left.startAt) - parseTimeWeight(right.startAt);
    if (startGap !== 0) return startGap;
    const endGap = parseTimeWeight(left.endAt) - parseTimeWeight(right.endAt);
    if (endGap !== 0) return endGap;
    return 0;
  });
  const continuity = validateRollHandoverContinuity(sortedOperators);
  const handledLength = validateRollHandledLength(roll, sortedOperators);
  const quantifiedOperators = sortedOperators.map((operator, index) => {
    const previousOperator = sortedOperators[index - 1];
    const nextOperator = sortedOperators[index + 1];
    const handledLayerCount = computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer);
    const handledPieceQty = computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces);
    const calculatedAmount = parseOptionalNumber(operator.calculatedAmount) ?? computeOperatorCalculatedAmount({
      pricingMode: operator.pricingMode,
      unitPrice: operator.unitPrice,
      handledLayerCount,
      handledLength: operator.handledLength,
      handledPieceQty
    });
    const displayAmount = computeOperatorDisplayAmount(operator, calculatedAmount);
    return {
      operator,
      previousOperatorName: operator.previousOperatorName || previousOperator?.operatorName || "",
      nextOperatorName: operator.nextOperatorName || nextOperator?.operatorName || "",
      handledLayerCount,
      handledPieceQty,
      handledGarmentQty: handledPieceQty,
      calculatedAmount,
      displayAmount,
      handoverAtLayer: parseOptionalNumber(operator.handoverAtLayer) ?? (operator.actionType === "\u63A5\u624B\u7EE7\u7EED" ? parseOptionalNumber(operator.startLayer) : parseOptionalNumber(operator.endLayer)),
      handoverAtLength: parseOptionalNumber(operator.handoverAtLength) ?? parseOptionalNumber(operator.handledLength)
    };
  });
  const lastOperator = quantifiedOperators[quantifiedOperators.length - 1] || null;
  const finalHandledLayer = lastOperator ? parseOptionalNumber(lastOperator.operator.endLayer) : null;
  const incompleteCoverage = roll.layerCount > 0 && finalHandledLayer !== null && finalHandledLayer < roll.layerCount;
  const warnings = buildRollHandoverWarnings(roll, sortedOperators, markerTotalPieces);
  return {
    rollRecordId: roll.rollRecordId,
    rollNo: roll.rollNo,
    operators: quantifiedOperators,
    hasHandover: quantifiedOperators.length > 1,
    hasWarnings: warnings.length > 0,
    continuityStatus: continuity.continuityStatus,
    totalHandledLength: handledLength.totalHandledLength,
    finalHandledLayer,
    overlapDetected: continuity.overlapDetected,
    gapDetected: continuity.gapDetected,
    lengthExceeded: handledLength.lengthExceeded,
    incompleteCoverage,
    warnings
  };
}
function buildSpreadingHandoverListSummary(rolls, operators, markerTotalPieces) {
  const summaries = rolls.map(
    (roll) => buildRollHandoverViewModel(
      roll,
      operators.filter((operator) => operator.rollRecordId === roll.rollRecordId),
      markerTotalPieces
    )
  );
  const handoverRollCount = summaries.filter((item) => item.hasHandover).length;
  const abnormalRollCount = summaries.filter((item) => item.hasWarnings).length;
  return {
    handoverRollCount,
    abnormalRollCount,
    hasHandover: handoverRollCount > 0,
    hasAbnormalHandover: abnormalRollCount > 0,
    statusLabel: abnormalRollCount > 0 ? `\u6709 ${abnormalRollCount} \u5377\u5B58\u5728\u4EA4\u63A5\u5F02\u5E38` : handoverRollCount > 0 ? `\u5DF2\u8BB0\u5F55 ${handoverRollCount} \u5377\u4EA4\u63A5\u73ED` : "\u65E0\u4EA4\u63A5\u73ED"
  };
}
function summarizeSpreadingOperators(operators) {
  const sortedOperators = [...operators].sort((left, right) => {
    const sortGap = (left.sortOrder || 0) - (right.sortOrder || 0);
    if (sortGap !== 0) return sortGap;
    const startGap = parseTimeWeight(left.startAt) - parseTimeWeight(right.startAt);
    if (startGap !== 0) return startGap;
    const endGap = parseTimeWeight(left.endAt) - parseTimeWeight(right.endAt);
    if (endGap !== 0) return endGap;
    return 0;
  });
  const operatorsByRollId = sortedOperators.reduce((accumulator, operator) => {
    const key = operator.rollRecordId || "__UNBOUND__";
    accumulator[key] = accumulator[key] || [];
    accumulator[key].push(operator);
    return accumulator;
  }, {});
  const handoverRollCount = Object.entries(operatorsByRollId).filter(([rollId, rows]) => rollId !== "__UNBOUND__" && rows.length > 1).length;
  const rollParticipantNames = Object.fromEntries(
    Object.entries(operatorsByRollId).map(([rollId, rows]) => [rollId, uniqueStrings(rows.map((row) => row.operatorName))])
  );
  return {
    operatorCount: sortedOperators.length,
    handoverRollCount,
    sortedOperators,
    operatorsByRollId,
    rollParticipantNames
  };
}
function deriveSpreadingStatus(status) {
  const meta = spreadingStatusMeta[status];
  return createSummaryMeta(status, meta.label, meta.className, meta.detailText);
}
function deriveSpreadingListStatus(status) {
  const key = status === "IN_PROGRESS" ? "IN_PROGRESS" : status === "DONE" ? "DONE" : "WAITING_START";
  const meta = spreadingListStatusMeta[key];
  return createSummaryMeta(key, meta.label, meta.className, meta.detailText);
}
function deriveSpreadingCuttingStatus(status) {
  const meta = spreadingCuttingStatusMeta[status];
  return createSummaryMeta(status, meta.label, meta.className, meta.detailText);
}
function deriveSpreadingSupervisorStage(options) {
  let key;
  if (options.status === "DRAFT" || options.status === "TO_FILL") {
    key = "WAITING_START";
  } else if (options.status === "IN_PROGRESS") {
    key = "IN_PROGRESS";
  } else if (options.pendingReplenishmentConfirmation) {
    key = "WAITING_REPLENISHMENT";
  } else if (!options.feiTicketReady) {
    key = "WAITING_FEI_TICKET";
  } else if (!options.baggingReady) {
    key = "WAITING_BAGGING";
  } else if (!options.warehouseReady) {
    key = "WAITING_WAREHOUSE";
  } else {
    key = "DONE";
  }
  const meta = spreadingSupervisorStageMeta[key];
  return createSummaryMeta(key, meta.label, meta.className, meta.detailText);
}
function buildSpreadingVarianceSummary(context, marker, session) {
  if (!context) return null;
  const configuredLengthTotal = Number(
    context.materialPrepRows.reduce((sum, row) => sum + row.materialLineItems.reduce((lineSum, item) => lineSum + item.configuredQty, 0), 0).toFixed(2)
  );
  const claimedLengthTotal = Number(
    context.materialPrepRows.reduce((sum, row) => sum + row.materialLineItems.reduce((lineSum, item) => lineSum + item.claimedQty, 0), 0).toFixed(2)
  );
  const coreMetrics = buildSpreadingCoreMetrics({
    context,
    session,
    markerTotalPieces: deriveSpreadingSessionGarmentQtyPerLayer(session, marker),
    configuredLengthTotal,
    claimedLengthTotal
  });
  const shortageIndicator = coreMetrics.shortageGarmentQty > 0;
  let replenishmentHint = "\u5F53\u524D\u94FA\u5E03\u6570\u636E\u4E0E\u9886\u6599\u6570\u636E\u57FA\u672C\u5339\u914D\u3002";
  if (!session || !session.rolls.length) {
    replenishmentHint = "\u5F53\u524D\u5C1A\u672A\u5F55\u5165\u94FA\u5E03\u5377\u6570\u636E\uFF0C\u8865\u6599\u5224\u65AD\u4ECD\u9700\u8865\u5F55\u540E\u786E\u8BA4\u3002";
  } else if (shortageIndicator) {
    replenishmentHint = "\u9884\u8BA1\u627F\u8F7D\u6210\u8863\u4EF6\u6570\u4F4E\u4E8E\u8BA1\u5212\u88C1\u526A\u6210\u8863\u4EF6\u6570\uFF0C\u5EFA\u8BAE\u8FDB\u5165\u8865\u6599\u7BA1\u7406\u786E\u8BA4\u540E\u56DE\u4E2D\u8F6C\u4ED3\u914D\u6599\u3002";
  } else if (coreMetrics.varianceLength < 0) {
    replenishmentHint = "\u603B\u5B9E\u9645\u94FA\u5E03\u957F\u5EA6\u8D85\u8FC7\u88C1\u5E8A\u5DF2\u9886\u957F\u5EA6\uFF0C\u5EFA\u8BAE\u590D\u6838\u5DEE\u5F02\u5E76\u6309\u9700\u8FDB\u5165\u8865\u6599\u7BA1\u7406\u56DE\u4E2D\u8F6C\u4ED3\u914D\u6599\u3002";
  }
  return {
    configuredLengthTotal,
    claimedLengthTotal,
    actualLengthTotal: coreMetrics.spreadActualLengthM,
    usableLengthTotal: coreMetrics.spreadUsableLengthM,
    remainingLengthTotal: coreMetrics.spreadRemainingLengthM,
    varianceLength: coreMetrics.varianceLength,
    plannedCutGarmentQty: coreMetrics.plannedCutGarmentQty,
    theoreticalCutGarmentQty: coreMetrics.theoreticalCutGarmentQty,
    actualCutGarmentQty: coreMetrics.actualCutGarmentQty,
    spreadActualLengthM: coreMetrics.spreadActualLengthM,
    spreadUsableLengthM: coreMetrics.spreadUsableLengthM,
    spreadRemainingLengthM: coreMetrics.spreadRemainingLengthM,
    fabricRollCount: coreMetrics.fabricRollCount,
    spreadLayerCount: coreMetrics.spreadLayerCount,
    plannedCutGarmentQtyFormula: coreMetrics.plannedCutGarmentQtyFormula,
    theoreticalCutGarmentQtyFormula: coreMetrics.theoreticalCutGarmentQtyFormula,
    actualCutGarmentQtyFormula: coreMetrics.actualCutGarmentQtyFormula,
    spreadUsableLengthFormula: coreMetrics.spreadUsableLengthFormula,
    varianceLengthFormula: coreMetrics.varianceLengthFormula,
    shortageGarmentQtyFormula: coreMetrics.shortageGarmentQtyFormula,
    warningRuleText: coreMetrics.warningRuleText,
    replenishmentLines: coreMetrics.replenishmentLines,
    estimatedPieceCapacity: coreMetrics.theoreticalCutGarmentQty,
    requiredPieceQty: coreMetrics.plannedCutGarmentQty,
    actualCutPieceQtyTotal: coreMetrics.actualCutGarmentQty,
    garmentQtyTotal: coreMetrics.actualCutGarmentQty,
    requiredGarmentQty: coreMetrics.plannedCutGarmentQty,
    theoreticalCapacityGarmentQty: coreMetrics.theoreticalCutGarmentQty,
    actualCutGarmentQtyTotal: coreMetrics.actualCutGarmentQty,
    shortageGarmentQty: coreMetrics.shortageGarmentQty,
    shortageIndicator,
    replenishmentHint
  };
}
function buildSpreadingTraceAnchor(session) {
  const rollSourceWritebackId = session.rolls.find((item) => item.sourceWritebackId)?.sourceWritebackId || "";
  const operatorSourceWritebackId = session.operators.find((item) => item.sourceWritebackId)?.sourceWritebackId || "";
  const rollUpdatedFromPdaAt = session.rolls.find((item) => item.updatedFromPdaAt)?.updatedFromPdaAt || "";
  const operatorUpdatedFromPdaAt = session.operators.find((item) => item.updatedFromPdaAt)?.updatedFromPdaAt || "";
  return {
    spreadingSessionId: session.spreadingSessionId,
    spreadingSessionNo: session.sessionNo || session.spreadingSessionId,
    contextType: session.contextType,
    cutOrderIds: [...session.cutOrderIds || []],
    cutOrderNos: [...session.completionLinkage?.linkedCutOrderNos || []],
    markerPlanId: session.markerPlanId || "",
    markerPlanNo: session.markerPlanNo || "",
    materialSkuSummary: session.materialSkuSummary || "",
    colorSummary: session.colorSummary || "",
    sourceChannel: session.sourceChannel || "MANUAL",
    sourceWritebackId: session.sourceWritebackId || rollSourceWritebackId || operatorSourceWritebackId || "",
    updatedFromPdaAt: session.updatedFromPdaAt || rollUpdatedFromPdaAt || operatorUpdatedFromPdaAt || "",
    completedAt: session.completionLinkage?.completedAt || "",
    completedBy: session.completionLinkage?.completedBy || ""
  };
}
function buildSpreadingTraceAnchors(store) {
  return [...store.sessions].map((session) => buildSpreadingTraceAnchor(session)).filter((anchor) => anchor.spreadingSessionId).sort((left, right) => {
    const rightWeight = right.completedAt || right.updatedFromPdaAt || "";
    const leftWeight = left.completedAt || left.updatedFromPdaAt || "";
    return rightWeight.localeCompare(leftWeight, "zh-CN");
  });
}
function findSpreadingTraceAnchor(anchors, options) {
  const cutOrderIds = Array.from(new Set((options.cutOrderIds || []).filter(Boolean)));
  const markerPlanId = options.markerPlanId?.trim() || "";
  const materialSku = options.materialSku?.trim() || "";
  const color = options.color?.trim() || "";
  const matches = anchors.filter((anchor) => {
    if (cutOrderIds.length && !anchor.cutOrderIds.some((item) => cutOrderIds.includes(item))) {
      return false;
    }
    if (markerPlanId && anchor.markerPlanId && anchor.markerPlanId !== markerPlanId) {
      return false;
    }
    if (materialSku && anchor.materialSkuSummary && !anchor.materialSkuSummary.includes(materialSku)) {
      return false;
    }
    if (color && anchor.colorSummary && !anchor.colorSummary.includes(color)) {
      return false;
    }
    return Boolean(anchor.spreadingSessionId);
  });
  return matches[0] || null;
}
function buildReplenishmentPreview(summary) {
  if (!summary) {
    return {
      level: "MISSING",
      label: "\u6570\u636E\u5F85\u8865\u5F55",
      detailText: "\u5F53\u524D\u5C1A\u672A\u5F62\u6210\u4E0A\u4E0B\u6587\u6216\u94FA\u5E03\u8BB0\u5F55\uFF0C\u65E0\u6CD5\u751F\u6210\u8865\u6599\u9884\u8B66\u3002",
      shortageIndicator: false
    };
  }
  if (summary.plannedCutGarmentQty <= 0 || summary.spreadActualLengthM <= 0) {
    return {
      level: "MISSING",
      label: "\u6570\u636E\u5F85\u8865\u5F55",
      detailText: "\u5F53\u524D\u65B9\u6848\u8BA1\u5212\u88C1\u526A\u6210\u8863\u4EF6\u6570\u6216\u94FA\u5E03\u957F\u5EA6\u4E0D\u8DB3\uFF0C\u9700\u7EE7\u7EED\u8865\u5F55\u540E\u518D\u5224\u65AD\u8865\u6599\u9700\u6C42\u3002",
      shortageIndicator: false
    };
  }
  if (summary.shortageIndicator || summary.varianceLength < 0) {
    return {
      level: "ALERT",
      label: "\u53EF\u80FD\u9700\u8981\u8865\u6599",
      detailText: summary.replenishmentHint,
      shortageIndicator: true
    };
  }
  if (summary.varianceLength <= 5) {
    return {
      level: "WATCH",
      label: "\u5EFA\u8BAE\u7EE7\u7EED\u89C2\u5BDF",
      detailText: "\u5F53\u524D\u53EF\u7528\u957F\u5EA6\u4E0E\u4ED3\u5E93\u9886\u6599\u957F\u5EA6\u63A5\u8FD1\uFF0C\u5EFA\u8BAE\u5728\u8FDB\u5165\u8865\u6599\u524D\u590D\u6838\u540E\u7EED\u635F\u8017\u3002",
      shortageIndicator: false
    };
  }
  return {
    level: "OK",
    label: "\u65E0\u660E\u663E\u7F3A\u53E3",
    detailText: "\u5F53\u524D\u94FA\u5E03\u6570\u636E\u672A\u8BC6\u522B\u660E\u663E\u957F\u5EA6\u7F3A\u53E3\uFF0C\u53EF\u7EE7\u7EED\u6D41\u5411\u540E\u7EED\u6253\u5370\u83F2\u7968\u94FE\u8DEF\u3002",
    shortageIndicator: false
  };
}
function buildSpreadingWarningMessages(options) {
  const warnings = [];
  const rolls = options.session.rolls || [];
  const operators = options.session.operators || [];
  const rollSummary = summarizeSpreadingRolls(rolls);
  const operatorSummary = summarizeSpreadingOperators(operators);
  const normalizedRollNos = rolls.map((roll) => roll.rollNo.trim()).filter(Boolean);
  const duplicateRollNos = normalizedRollNos.filter((rollNo, index) => normalizedRollNos.indexOf(rollNo) !== index);
  duplicateRollNos.forEach((rollNo) => {
    warnings.push(`\u5377\u53F7 ${rollNo} \u5728\u540C\u4E00\u6761\u94FA\u5E03\u8BB0\u5F55\u4E0B\u91CD\u590D\uFF0C\u8BF7\u8C03\u6574\u5377\u8BB0\u5F55\u3002`);
  });
  if (!rolls.length) {
    warnings.push("\u5F53\u524D\u7F3A\u5C11\u5377\u8BB0\u5F55\uFF0C\u8BF7\u81F3\u5C11\u5F55\u5165\u4E00\u5377\u5B9E\u9645\u94FA\u5E03\u6570\u636E\u3002");
  }
  rolls.forEach((roll, index) => {
    const rollLabel = roll.rollNo || `\u7B2C ${index + 1} \u5377`;
    const usableLength = computeUsableLength(Number(roll.actualLength || 0), Number(roll.headLength || 0), Number(roll.tailLength || 0));
    const remainingLength = computeRemainingLength(Number(roll.labeledLength || 0), Number(roll.actualLength || 0));
    const linkedOperators = operatorSummary.operatorsByRollId[roll.rollRecordId] || [];
    const handoverSummary = buildRollHandoverViewModel(roll, linkedOperators, options.markerTotalPieces);
    if (usableLength < 0) {
      warnings.push(`${rollLabel} \u7684\u5355\u5377\u53EF\u7528\u957F\u5EA6\u5C0F\u4E8E 0\uFF0C\u8BF7\u590D\u6838\u5E03\u5934 / \u5E03\u5C3E\u4E0E\u5B9E\u9645\u957F\u5EA6\u3002`);
    }
    if (remainingLength < 0) {
      warnings.push(`${rollLabel} \u7684\u5355\u5377\u5269\u4F59\u957F\u5EA6\u5C0F\u4E8E 0\uFF0C\u8BF4\u660E\u5B9E\u9645\u4F7F\u7528\u5DF2\u8D85\u8FC7\u6807\u6CE8\u957F\u5EA6\u3002`);
    }
    if (!roll.rollNo || !roll.occurredAt) {
      warnings.push(`${rollLabel} \u7F3A\u5C11\u5377\u53F7\u6216\u65F6\u95F4\uFF0C\u94FA\u5E03\u8BB0\u5F55\u4ECD\u4E0D\u5B8C\u6574\u3002`);
    }
    if (Number(roll.layerCount || 0) <= 0 || options.markerTotalPieces <= 0) {
      warnings.push(`${rollLabel} \u7F3A\u5C11\u94FA\u5E03\u5C42\u6570\u6216\u5355\u5C42\u6210\u8863\u4EF6\u6570\uFF0C\u5B9E\u9645\u88C1\u526A\u6210\u8863\u4EF6\u6570\u6682\u65E0\u6CD5\u51C6\u786E\u63A8\u5BFC\u3002`);
    }
    if (!linkedOperators.length) {
      warnings.push(`${rollLabel} \u7F3A\u5C11\u4EBA\u5458\u8BB0\u5F55\uFF0C\u65E0\u6CD5\u8FFD\u6EAF\u5F00\u59CB\u3001\u4EA4\u63A5\u4E0E\u5B8C\u6210\u60C5\u51B5\u3002`);
    }
    handoverSummary.warnings.forEach((message) => warnings.push(message));
  });
  if (options.claimedLengthTotal > 0 && rollSummary.totalActualLength > options.claimedLengthTotal) {
    warnings.push("\u603B\u5B9E\u9645\u94FA\u5E03\u957F\u5EA6\u8D85\u8FC7\u88C1\u5E8A\u5DF2\u9886\u603B\u957F\u5EA6\uFF0C\u53EF\u80FD\u9700\u8981\u8865\u6599\u3002");
  }
  if (!operators.length) {
    warnings.push("\u5F53\u524D\u7F3A\u5C11\u94FA\u5E03\u4EBA\u5458\u8BB0\u5F55\uFF0C\u8BF7\u8865\u5F55\u5F00\u59CB / \u4EA4\u63A5 / \u5B8C\u6210\u4FE1\u606F\u3002");
  }
  operators.forEach((operator, index) => {
    const operatorLabel = operator.operatorName || `\u7B2C ${index + 1} \u6761\u4EBA\u5458\u8BB0\u5F55`;
    if (!operator.rollRecordId) {
      warnings.push(`${operatorLabel} \u5C1A\u672A\u5173\u8054\u5377\u8BB0\u5F55\uFF0C\u540C\u5377\u6362\u73ED\u5173\u7CFB\u4E0D\u53EF\u8FFD\u6EAF\u3002`);
    }
    if (!operator.operatorName) {
      warnings.push(`\u7B2C ${index + 1} \u6761\u4EBA\u5458\u8BB0\u5F55\u7F3A\u5C11\u4EBA\u5458\u59D3\u540D\u3002`);
    }
    if (!operator.startAt || !operator.endAt) {
      warnings.push(`${operatorLabel} \u7F3A\u5C11\u5F00\u59CB\u6216\u7ED3\u675F\u65F6\u95F4\u3002`);
    }
  });
  buildOperatorAmountWarnings(operators, options.markerTotalPieces, options.session.unitPrice).forEach((message) => warnings.push(message));
  return Array.from(new Set(warnings));
}
function buildMarkerSpreadingNavigationPayload(context, varianceSummary, warning) {
  if (!context) {
    return {
      replenishment: {},
      feiTickets: {},
      cutOrders: {},
      markerPlanRefs: {},
      summary: {}
    };
  }
  const baseCutOrderNo = context.cutOrderNos[0];
  const baseProduction = context.productionOrderNos[0];
  const varianceHint = warning ? String(warning.varianceLength) : varianceSummary ? String(varianceSummary.varianceLength) : void 0;
  const shortageHint = warning ? warning.shortageQty > 0 ? "true" : void 0 : varianceSummary?.shortageIndicator ? "true" : void 0;
  const riskLevel = warning?.warningLevel === "\u9AD8" ? "high" : warning?.warningLevel === "\u4E2D" ? "medium" : warning?.warningLevel === "\u4F4E" ? "low" : void 0;
  return {
    replenishment: {
      spreadingSessionId: warning?.spreadingSessionId,
      warningId: warning?.warningId,
      markerPlanNo: context.contextType === "marker-plan-ref" ? context.markerPlanNo || void 0 : void 0,
      cutOrderNo: context.contextType === "cut-order" ? baseCutOrderNo || void 0 : void 0,
      productionOrderNo: baseProduction || void 0,
      materialSku: context.materialSkuSummary?.split(" / ")[0] || void 0,
      riskLevel,
      varianceLength: varianceHint,
      shortageHint
    },
    feiTickets: {
      markerPlanNo: context.contextType === "marker-plan-ref" ? context.markerPlanNo || void 0 : void 0,
      cutOrderNo: baseCutOrderNo || void 0
    },
    cutOrders: {
      markerPlanNo: context.contextType === "marker-plan-ref" ? context.markerPlanNo || void 0 : void 0,
      cutOrderNo: baseCutOrderNo || void 0,
      productionOrderNo: baseProduction || void 0
    },
    markerPlanRefs: {
      markerPlanId: context.markerPlanId || void 0,
      markerPlanNo: context.markerPlanNo || void 0,
      cutOrderNo: context.contextType === "cut-order" ? baseCutOrderNo || void 0 : void 0
    },
    summary: {
      markerPlanNo: context.contextType === "marker-plan-ref" ? context.markerPlanNo || void 0 : void 0,
      cutOrderNo: context.contextType === "cut-order" ? baseCutOrderNo || void 0 : void 0,
      productionOrderNo: baseProduction || void 0
    }
  };
}
function serializeMarkerSpreadingStorage(store) {
  return JSON["stringify"](store);
}
function deserializeMarkerSpreadingStorage(raw) {
  if (!raw) return { markers: [], sessions: [] };
  try {
    const parsed = JSON.parse(raw);
    return {
      markers: Array.isArray(parsed?.markers) ? parsed.markers.map((item) => normalizeMarkerRecord(item)) : [],
      sessions: Array.isArray(parsed?.sessions) ? parsed.sessions.map((session) => {
        const planUnits = Array.isArray(session.planUnits) ? session.planUnits : [];
        const rolls = Array.isArray(session.rolls) ? session.rolls.map((roll) => {
          const linkedPlanUnit = findSpreadingPlanUnitById(planUnits, roll.planUnitId);
          const normalizedPlanUnitId = roll.planUnitId || linkedPlanUnit?.planUnitId || "";
          const garmentQtyPerUnit = linkedPlanUnit?.garmentQtyPerUnit || 0;
          const derivedActualCutGarmentQty = computeRollActualCutGarmentQty(Number(roll.layerCount || 0), garmentQtyPerUnit);
          return {
            ...roll,
            planUnitId: normalizedPlanUnitId,
            materialSku: linkedPlanUnit?.materialSku || roll.materialSku,
            color: linkedPlanUnit?.color || roll.color,
            sortOrder: Number(roll.sortOrder ?? 0),
            totalLength: Number((Number(roll.actualLength || 0) + Number(roll.headLength || 0) + Number(roll.tailLength || 0)).toFixed(2)),
            remainingLength: roll.remainingLength ?? computeRemainingLength(Number(roll.labeledLength || 0), Number(roll.actualLength || 0)),
            usableLength: roll.usableLength ?? computeUsableLength(Number(roll.actualLength || 0), Number(roll.headLength || 0), Number(roll.tailLength || 0)),
            actualCutPieceQty: derivedActualCutGarmentQty || (roll.actualCutGarmentQty ?? roll.actualCutPieceQty ?? 0),
            actualCutGarmentQty: derivedActualCutGarmentQty || (roll.actualCutGarmentQty ?? roll.actualCutPieceQty ?? 0)
          };
        }) : [];
        const rollSummary = summarizeSpreadingRolls(rolls);
        return {
          ...session,
          spreadingMode: normalizeMarkerMode(session.spreadingMode),
          rolls,
          operators: Array.isArray(session.operators) ? session.operators.map((operator) => ({
            ...operator,
            sortOrder: Number(operator.sortOrder ?? 0),
            rollRecordId: operator.rollRecordId || "",
            actionType: operator.actionType || "\u5F00\u59CB\u94FA\u5E03",
            startLayer: operator.startLayer !== void 0 && operator.startLayer !== null ? Number(operator.startLayer) : void 0,
            endLayer: operator.endLayer !== void 0 && operator.endLayer !== null ? Number(operator.endLayer) : void 0,
            handledLayerCount: operator.handledLayerCount !== void 0 && operator.handledLayerCount !== null ? Number(operator.handledLayerCount) : void 0,
            handledLength: operator.handledLength !== void 0 && operator.handledLength !== null ? Number(operator.handledLength) : void 0,
            handledPieceQty: operator.handledGarmentQty !== void 0 && operator.handledGarmentQty !== null ? Number(operator.handledGarmentQty) : operator.handledPieceQty !== void 0 && operator.handledPieceQty !== null ? Number(operator.handledPieceQty) : void 0,
            handledGarmentQty: operator.handledPieceQty !== void 0 && operator.handledPieceQty !== null ? Number(operator.handledPieceQty) : void 0,
            pricingMode: operator.pricingMode || "\u6309\u4EF6\u8BA1\u4EF7",
            unitPrice: operator.unitPrice !== void 0 && operator.unitPrice !== null ? Number(operator.unitPrice) : void 0,
            calculatedAmount: operator.calculatedAmount !== void 0 && operator.calculatedAmount !== null ? Number(operator.calculatedAmount) : void 0,
            manualAmountAdjusted: Boolean(operator.manualAmountAdjusted),
            adjustedAmount: operator.adjustedAmount !== void 0 && operator.adjustedAmount !== null ? Number(operator.adjustedAmount) : void 0,
            amountNote: operator.amountNote || "",
            handoverNotes: operator.handoverNotes || "",
            nextOperatorAccountId: operator.nextOperatorAccountId || "",
            previousOperatorName: operator.previousOperatorName || "",
            nextOperatorName: operator.nextOperatorName || "",
            handoverAtLayer: operator.handoverAtLayer !== void 0 && operator.handoverAtLayer !== null ? Number(operator.handoverAtLayer) : void 0,
            handoverAtLength: operator.handoverAtLength !== void 0 && operator.handoverAtLength !== null ? Number(operator.handoverAtLength) : void 0
          })) : [],
          totalActualLength: session.totalActualLength || rollSummary.totalActualLength,
          totalHeadLength: session.totalHeadLength || rollSummary.totalHeadLength,
          totalTailLength: session.totalTailLength || rollSummary.totalTailLength,
          totalCalculatedUsableLength: session.totalCalculatedUsableLength || rollSummary.totalCalculatedUsableLength,
          totalRemainingLength: session.totalRemainingLength ?? rollSummary.totalRemainingLength,
          actualCutPieceQty: rollSummary.totalActualCutGarmentQty || (session.actualCutGarmentQty ?? session.actualCutPieceQty ?? 0),
          actualCutGarmentQty: rollSummary.totalActualCutGarmentQty || (session.actualCutGarmentQty ?? session.actualCutPieceQty ?? 0),
          configuredLengthTotal: session.configuredLengthTotal || 0,
          claimedLengthTotal: session.claimedLengthTotal || 0,
          varianceLength: session.varianceLength || 0,
          varianceNote: session.varianceNote || "",
          sourceMarkerId: session.sourceMarkerId || session.markerId || "",
          sourceMarkerNo: session.sourceMarkerNo || session.markerNo || "",
          isExceptionBackfill: Boolean(session.isExceptionBackfill),
          exceptionReason: session.exceptionReason || "",
          ownerAccountId: session.ownerAccountId || "",
          ownerName: session.ownerName || "",
          warningMessages: session.warningMessages || [],
          importSource: session.importSource || null,
          planUnits,
          planLineItems: Array.isArray(session.planLineItems) ? session.planLineItems : [],
          highLowPlanSnapshot: session.highLowPlanSnapshot || null,
          theoreticalSpreadTotalLength: session.theoreticalSpreadTotalLength ?? 0,
          theoreticalActualCutPieceQty: session.theoreticalActualCutPieceQty ?? 0,
          importAdjustmentRequired: Boolean(session.importAdjustmentRequired),
          importAdjustmentNote: session.importAdjustmentNote || "",
          prototypeLifecycleOverrides: session.prototypeLifecycleOverrides || null
        };
      }) : []
    };
  } catch {
    return { markers: [], sessions: [] };
  }
}
function updateSpreadingReplenishmentHandled(store, spreadingSessionId, handled) {
  return {
    ...store,
    sessions: store.sessions.map((session) => {
      if (session.spreadingSessionId !== spreadingSessionId) return session;
      if (!session.replenishmentWarning) return session;
      return {
        ...session,
        replenishmentWarning: {
          ...session.replenishmentWarning,
          handled
        }
      };
    })
  };
}
function buildMarkerSpreadingViewModel(options) {
  const rowsById = Object.fromEntries(options.rows.map((row) => [row.cutOrderId, row]));
  const context = buildContext(options.rows, rowsById, options.markerPlanRefs, options.prefilter);
  const markerRecords = context ? options.store.markers.filter((record) => matchesContext(record, context)) : options.store.markers;
  const spreadingSessions = context ? options.store.sessions.filter((record) => matchesContext(record, context)) : options.store.sessions;
  const warningCount = spreadingSessions.filter((session) => {
    const summary = buildSpreadingVarianceSummary(context, markerRecords[0] || null, session);
    return summary?.shortageIndicator || (summary?.varianceLength || 0) < 0;
  }).length;
  return {
    context,
    prefilter: options.prefilter,
    markerRecords,
    spreadingSessions,
    stats: {
      markerCount: markerRecords.length,
      sessionCount: spreadingSessions.length,
      inProgressCount: spreadingSessions.filter((session) => session.status === "IN_PROGRESS").length,
      doneCount: spreadingSessions.filter((session) => session.status === "DONE").length,
      rollCount: spreadingSessions.reduce((sum, session) => sum + session.rolls.length, 0),
      warningCount,
      contextCutOrderCount: context?.cutOrderIds.length ?? 0,
      contextProductionOrderCount: context?.productionOrderNos.length ?? 0
    }
  };
}
function buildMarkerSeedDraft(context, existing) {
  if (!context) return null;
  return existing ? existing : buildSeedMarker(context);
}
function formatSpreadingLength(value) {
  return `${formatQty(Number(value.toFixed(2)))} \u7C73`;
}
function summarizeContextHint(context) {
  if (!context) return "\u5F53\u524D\u5C1A\u672A\u6536\u5230\u88C1\u7247\u5355\u6216\u551B\u67B6\u65B9\u6848\u4E0A\u4E0B\u6587\uFF0C\u8BF7\u4ECE\u4E0A\u6E38\u9875\u9762\u8FDB\u5165\u3002";
  if (context.contextType === "marker-plan-ref") {
    return `\u5F53\u524D\u4EE5\u551B\u67B6\u65B9\u6848 ${context.markerPlanNo || "\u5F85\u8865\u551B\u67B6\u65B9\u6848\u53F7"} \u4F5C\u4E3A\u6267\u884C\u4E0A\u4E0B\u6587\uFF0C\u5E95\u5C42\u8FFD\u6EAF\u4ECD\u56DE\u843D ${context.cutOrderNos.length} \u4E2A\u88C1\u7247\u5355\u3002`;
  }
  return `\u5F53\u524D\u4EE5\u88C1\u7247\u5355 ${context.cutOrderNos[0]} \u4F5C\u4E3A\u4E0A\u4E0B\u6587\uFF0C\u540E\u7EED\u82E5\u8FDB\u5165\u6253\u5370\u83F2\u7968\uFF0C\u5F52\u5C5E\u4ECD\u56DE\u843D\u8BE5\u88C1\u7247\u5355\u3002`;
}
function createEmptyStore() {
  return { markers: [], sessions: [] };
}
function createDraftId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}
function createRollRecordDraft(spreadingSessionId, materialSku = "", planUnitId = "") {
  return {
    rollRecordId: createDraftId("roll"),
    spreadingSessionId,
    planUnitId,
    sortOrder: 0,
    rollNo: "",
    materialSku,
    color: "",
    width: 0,
    labeledLength: 0,
    actualLength: 0,
    headLength: 0,
    tailLength: 0,
    layerCount: 0,
    totalLength: 0,
    remainingLength: 0,
    actualCutPieceQty: 0,
    occurredAt: "",
    operatorNames: [],
    handoverNotes: "",
    usableLength: 0,
    note: "",
    sourceChannel: "MANUAL",
    sourceWritebackId: "",
    updatedFromPdaAt: ""
  };
}
function createOperatorRecordDraft(spreadingSessionId) {
  return {
    operatorRecordId: createDraftId("operator"),
    spreadingSessionId,
    sortOrder: 0,
    rollRecordId: "",
    operatorAccountId: "",
    operatorName: "",
    startAt: "",
    endAt: "",
    actionType: "\u5F00\u59CB\u94FA\u5E03",
    startLayer: void 0,
    endLayer: void 0,
    handledLayerCount: void 0,
    handledLength: void 0,
    handledPieceQty: void 0,
    pricingMode: "\u6309\u4EF6\u8BA1\u4EF7",
    unitPrice: void 0,
    calculatedAmount: void 0,
    manualAmountAdjusted: false,
    adjustedAmount: void 0,
    amountNote: "",
    handoverFlag: false,
    handoverNotes: "",
    nextOperatorAccountId: "",
    previousOperatorName: "",
    nextOperatorName: "",
    handoverAtLayer: void 0,
    handoverAtLength: void 0,
    note: "",
    sourceChannel: "MANUAL",
    sourceWritebackId: "",
    updatedFromPdaAt: ""
  };
}
function upsertSpreadingSession(session, store, now = /* @__PURE__ */ new Date()) {
  const normalizedRolls = session.rolls.map((roll, index) => {
    const linkedPlanUnit = findSpreadingPlanUnitById(session.planUnits, roll.planUnitId);
    const normalizedPlanUnitId = roll.planUnitId || session.planUnits?.[0]?.planUnitId || "";
    const garmentQtyPerUnit = linkedPlanUnit?.garmentQtyPerUnit || 0;
    return {
      ...roll,
      planUnitId: normalizedPlanUnitId,
      materialSku: linkedPlanUnit?.materialSku || roll.materialSku,
      color: linkedPlanUnit?.color || roll.color,
      sortOrder: Number(roll.sortOrder ?? index + 1),
      actualCutPieceQty: computeRollActualCutGarmentQty(Number(roll.layerCount || 0), garmentQtyPerUnit),
      actualCutGarmentQty: computeRollActualCutGarmentQty(Number(roll.layerCount || 0), garmentQtyPerUnit)
    };
  });
  const linkedMarker = session.markerId ? store.markers.find((item) => item.markerId === session.markerId) || null : null;
  const markerTotalPieces = deriveSpreadingSessionGarmentQtyPerLayer(session, linkedMarker);
  const baseOperators = summarizeSpreadingOperators(
    session.operators.map((operator, index) => ({
      ...operator,
      sortOrder: Number(operator.sortOrder ?? index + 1),
      startLayer: operator.startLayer !== void 0 && operator.startLayer !== null ? Number(operator.startLayer) : void 0,
      endLayer: operator.endLayer !== void 0 && operator.endLayer !== null ? Number(operator.endLayer) : void 0,
      handledLength: operator.handledLength !== void 0 && operator.handledLength !== null ? Number(operator.handledLength) : void 0,
      pricingMode: operator.pricingMode || "\u6309\u4EF6\u8BA1\u4EF7",
      unitPrice: operator.unitPrice !== void 0 && operator.unitPrice !== null ? Number(operator.unitPrice) : void 0,
      calculatedAmount: operator.calculatedAmount !== void 0 && operator.calculatedAmount !== null ? Number(operator.calculatedAmount) : void 0,
      manualAmountAdjusted: Boolean(operator.manualAmountAdjusted),
      adjustedAmount: operator.adjustedAmount !== void 0 && operator.adjustedAmount !== null ? Number(operator.adjustedAmount) : void 0,
      amountNote: operator.amountNote || "",
      nextOperatorAccountId: operator.nextOperatorAccountId || "",
      handoverAtLayer: operator.handoverAtLayer !== void 0 && operator.handoverAtLayer !== null ? Number(operator.handoverAtLayer) : void 0,
      handoverAtLength: operator.handoverAtLength !== void 0 && operator.handoverAtLength !== null ? Number(operator.handoverAtLength) : void 0
    }))
  ).sortedOperators;
  const quantifiedOperatorsById = /* @__PURE__ */ new Map();
  normalizedRolls.forEach((roll) => {
    const handoverSummary = buildRollHandoverViewModel(
      roll,
      baseOperators.filter((operator) => operator.rollRecordId === roll.rollRecordId),
      markerTotalPieces
    );
    handoverSummary.operators.forEach((item) => {
      quantifiedOperatorsById.set(item.operator.operatorRecordId, {
        ...item.operator,
        handledLayerCount: item.handledLayerCount ?? void 0,
        handledPieceQty: item.handledPieceQty ?? void 0,
        handledGarmentQty: item.handledGarmentQty ?? void 0,
        unitPrice: item.operator.unitPrice ?? session.unitPrice ?? void 0,
        pricingMode: item.operator.pricingMode || "\u6309\u4EF6\u8BA1\u4EF7",
        calculatedAmount: computeOperatorCalculatedAmount({
          pricingMode: item.operator.pricingMode || "\u6309\u4EF6\u8BA1\u4EF7",
          unitPrice: item.operator.unitPrice ?? session.unitPrice ?? void 0,
          handledLayerCount: item.handledLayerCount,
          handledLength: item.operator.handledLength,
          handledPieceQty: item.handledPieceQty
        }) ?? void 0,
        manualAmountAdjusted: Boolean(item.operator.manualAmountAdjusted),
        adjustedAmount: item.operator.adjustedAmount ?? void 0,
        amountNote: item.operator.amountNote || "",
        nextOperatorAccountId: item.operator.nextOperatorAccountId || "",
        previousOperatorName: item.previousOperatorName,
        nextOperatorName: item.nextOperatorName,
        handoverAtLayer: item.handoverAtLayer ?? void 0,
        handoverAtLength: item.handoverAtLength ?? void 0
      });
    });
  });
  const normalizedOperators = baseOperators.map((operator) => {
    const quantified = quantifiedOperatorsById.get(operator.operatorRecordId);
    if (quantified) return quantified;
    return {
      ...operator,
      handledLayerCount: computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer) ?? void 0,
      handledPieceQty: computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces) ?? void 0,
      handledGarmentQty: computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces) ?? void 0,
      pricingMode: operator.pricingMode || "\u6309\u4EF6\u8BA1\u4EF7",
      unitPrice: operator.unitPrice ?? session.unitPrice ?? void 0,
      calculatedAmount: computeOperatorCalculatedAmount({
        pricingMode: operator.pricingMode || "\u6309\u4EF6\u8BA1\u4EF7",
        unitPrice: operator.unitPrice ?? session.unitPrice ?? void 0,
        handledLayerCount: computeOperatorHandledLayerCount(operator.startLayer, operator.endLayer),
        handledLength: operator.handledLength,
        handledPieceQty: computeOperatorHandledPieceQty(operator.startLayer, operator.endLayer, markerTotalPieces)
      }) ?? void 0,
      manualAmountAdjusted: Boolean(operator.manualAmountAdjusted),
      adjustedAmount: operator.adjustedAmount ?? void 0,
      amountNote: operator.amountNote || "",
      nextOperatorAccountId: operator.nextOperatorAccountId || "",
      previousOperatorName: operator.previousOperatorName || "",
      nextOperatorName: operator.nextOperatorName || ""
    };
  });
  const operatorNamesByRollId = Object.fromEntries(
    Object.entries(summarizeSpreadingOperators(normalizedOperators).rollParticipantNames).map(([rollId, names]) => [rollId, names])
  );
  const rollsWithOperatorNames = normalizedRolls.map((roll) => ({
    ...roll,
    operatorNames: operatorNamesByRollId[roll.rollRecordId] || []
  }));
  const summary = summarizeSpreadingRolls(rollsWithOperatorNames);
  const operatorAmountSummary = summarizeSpreadingOperatorAmounts(normalizedOperators, markerTotalPieces, session.unitPrice);
  const normalized = {
    ...session,
    rolls: rollsWithOperatorNames,
    operators: normalizedOperators,
    totalActualLength: summary.totalActualLength,
    totalHeadLength: summary.totalHeadLength,
    totalTailLength: summary.totalTailLength,
    totalCalculatedUsableLength: summary.totalCalculatedUsableLength,
    totalRemainingLength: session.totalRemainingLength ?? summary.totalRemainingLength,
    rollCount: rollsWithOperatorNames.length,
    operatorCount: normalizedOperators.length,
    actualLayers: summary.totalLayers,
    actualCutPieceQty: session.actualCutGarmentQty ?? session.actualCutPieceQty ?? summary.totalActualCutGarmentQty,
    actualCutGarmentQty: session.actualCutGarmentQty ?? session.actualCutPieceQty ?? summary.totalActualCutGarmentQty,
    theoreticalCutGarmentQty: session.theoreticalCutGarmentQty ?? session.theoreticalActualCutPieceQty,
    configuredLengthTotal: session.configuredLengthTotal ?? 0,
    claimedLengthTotal: session.claimedLengthTotal ?? 0,
    varianceLength: session.varianceLength ?? 0,
    varianceNote: session.varianceNote || "",
    totalAmount: operatorAmountSummary.hasAnyAllocationData ? operatorAmountSummary.totalDisplayAmount : session.totalAmount ?? Number(((session.unitPrice ?? 0) * (session.actualCutPieceQty ?? 0)).toFixed(2)),
    updatedAt: nowText(now),
    warningMessages: session.warningMessages || [],
    sourceMarkerId: session.sourceMarkerId || session.markerId || "",
    sourceMarkerNo: session.sourceMarkerNo || session.markerNo || "",
    sourceSchemeId: session.sourceSchemeId || session.sourceMarkerId || session.markerId || "",
    sourceSchemeNo: session.sourceSchemeNo || session.sourceMarkerNo || session.markerNo || "",
    sourceBedId: session.sourceBedId || session.sourceMarkerId || session.markerId || "",
    sourceBedNo: session.sourceBedNo || session.sourceMarkerNo || session.markerNo || "",
    sourceBedMode: session.sourceBedMode || session.spreadingMode,
    cuttingTableId: session.cuttingTableId || "",
    cuttingTableNo: session.cuttingTableNo || "",
    cuttingTableName: session.cuttingTableName || "",
    plannedStartAt: session.plannedStartAt || "",
    plannedEndAt: session.plannedEndAt || "",
    estimatedDurationMinutes: session.estimatedDurationMinutes || DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES,
    actualStartAt: session.actualStartAt || "",
    actualEndAt: session.actualEndAt || "",
    actualDurationMinutes: session.actualDurationMinutes || 0,
    cuttingStartedAt: session.cuttingStartedAt || "",
    cuttingFinishedAt: session.cuttingFinishedAt || "",
    tableScheduleStatus: session.tableScheduleStatus || "\u672A\u6392\u7A0B",
    isExceptionBackfill: Boolean(session.isExceptionBackfill),
    exceptionReason: session.exceptionReason || "",
    ownerAccountId: session.ownerAccountId || "",
    ownerName: session.ownerName || "",
    sourceChannel: session.sourceChannel || "MANUAL",
    sourceWritebackId: session.sourceWritebackId || "",
    updatedFromPdaAt: session.updatedFromPdaAt || "",
    planUnits: session.planUnits || [],
    prototypeLifecycleOverrides: session.prototypeLifecycleOverrides || null
  };
  return {
    ...store,
    sessions: [...store.sessions.filter((item) => item.spreadingSessionId !== normalized.spreadingSessionId), normalized].sort(
      (left, right) => right.updatedAt.localeCompare(left.updatedAt, "zh-CN")
    )
  };
}
function upsertMarkerRecord(marker, store, now = /* @__PURE__ */ new Date()) {
  const normalized = normalizeMarkerRecord({
    ...marker,
    totalPieces: computeMarkerTotalPieces(marker.sizeDistribution),
    spreadTotalLength: marker.spreadTotalLength ?? (deriveMarkerTemplateByMode(marker.markerMode) === "row-template" ? computeNormalMarkerSpreadTotalLength(marker.lineItems || []) : Number(marker.actualMaterialMeter ?? 0)),
    sizeRatioPlanText: marker.sizeRatioPlanText || buildPlannedSizeRatioText(marker.sizeDistribution),
    updatedAt: nowText(now),
    updatedBy: marker.updatedBy || "\u551B\u67B6\u7F16\u8F91\u9875"
  });
  return {
    ...store,
    markers: [...store.markers.filter((item) => item.markerId !== normalized.markerId), normalized].sort(
      (left, right) => right.updatedAt.localeCompare(left.updatedAt, "zh-CN")
    )
  };
}
function updateSessionStatus(session, status) {
  return {
    ...session,
    status
  };
}
export {
  CUTTING_MARKER_SPREADING_LEDGER_STORAGE_KEY,
  DEFAULT_HIGH_LOW_PATTERN_KEYS,
  MARKER_SIZE_KEYS,
  buildMarkerSeedDraft,
  buildMarkerSpreadingNavigationPayload,
  buildMarkerSpreadingViewModel,
  buildMarkerWarningMessages,
  buildOperatorAmountWarnings,
  buildOperatorHandledGarmentQtyFormula,
  buildOperatorHandledLayerFormula,
  buildOperatorHandledLengthFormula,
  buildPlannedCutGarmentQtyFormula,
  buildReplenishmentPreview,
  buildRollActualCutGarmentQtyFormula,
  buildRollActualCutQtyFormula,
  buildRollHandoverViewModel,
  buildRollHandoverWarnings,
  buildShortageQtyFormula,
  buildSpreadingCoreMetrics,
  buildSpreadingHandoverListSummary,
  buildSpreadingHighLowPlanSnapshotFromMarker,
  buildSpreadingImportSource,
  buildSpreadingImportedLengthFormula,
  buildSpreadingPlanLineItemsFromMarker,
  buildSpreadingPlanUnitDisplayLabel,
  buildSpreadingPlanUnitsFromMarker,
  buildSpreadingReplenishmentWarning,
  buildSpreadingSessionIdentityForMarkerBed,
  buildSpreadingTraceAnchor,
  buildSpreadingTraceAnchors,
  buildSpreadingVarianceSummary,
  buildSpreadingWarningMessages,
  buildTheoreticalActualCutQtyFormula,
  buildTheoreticalCutGarmentQtyFormula,
  computeActualCutQty,
  computeHighLowCuttingTotals,
  computeHighLowPatternTotals,
  computeLengthVariance,
  computeMarkerTotalPieces,
  computeNormalMarkerSpreadTotalLength,
  computeOperatorCalculatedAmount,
  computeOperatorDisplayAmount,
  computeOperatorHandledGarmentQty,
  computeOperatorHandledLayerCount,
  computeOperatorHandledLengthByRoll,
  computeOperatorHandledPieceQty,
  computePlannedCutGarmentQty,
  computeRemainingLength,
  computeRollActualCutGarmentQty,
  computeRollActualCutPieceQty,
  computeShortageQty,
  computeSinglePieceUsage,
  computeTheoreticalCutQty,
  computeUsableLength,
  computeUsageSummary,
  createEmptyStore,
  createOperatorRecordDraft,
  createRollRecordDraft,
  createSpreadingDraftFromMarker,
  deriveMarkerGarmentQtyPerLayer,
  deriveMarkerModeMeta,
  deriveMarkerTemplateByMode,
  deriveSpreadingColorSummary,
  deriveSpreadingCuttingStatus,
  deriveSpreadingListStatus,
  deriveSpreadingModeMeta,
  deriveSpreadingSessionGarmentQtyPerLayer,
  deriveSpreadingStatus,
  deriveSpreadingSuggestedAction,
  deriveSpreadingSupervisorStage,
  deriveSpreadingWarningLevel,
  deserializeMarkerSpreadingStorage,
  finalizeSpreadingCompletion,
  findSpreadingPlanUnitById,
  findSpreadingTraceAnchor,
  formatSpreadingLength,
  hasSpreadingActualExecution,
  resolveSpreadingOrderStatusFromSession,
  resolveSpreadingPrimaryActionKeyByStage,
  resolveSpreadingPrimaryActionMeta,
  serializeMarkerSpreadingStorage,
  spreadingOrderStatusMeta,
  summarizeContextHint,
  summarizeRollOperatorAmounts,
  summarizeSpreadingOperatorAmounts,
  summarizeSpreadingOperators,
  summarizeSpreadingRolls,
  updateSessionStatus,
  updateSpreadingReplenishmentHandled,
  upsertMarkerRecord,
  upsertSpreadingSession,
  validateMarkerForSpreadingImport,
  validateMarkerModeShape,
  validateOperatorManualAmountAdjustment,
  validateRollHandledLength,
  validateRollHandoverContinuity,
  validateSpreadingCompletion
};
