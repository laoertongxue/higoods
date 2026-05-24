import { buildReplenishmentPreview } from "./marker-spreading-model.ts";
import {
  buildReplenishmentContextRecords
} from "./replenishment-context.ts";
import {
  listPdaReplenishmentFeedbackWritebacks
} from "../../../data/fcs/cutting/pda-execution-writeback-ledger.ts";
import { getBrowserLocalStorage } from "../../../data/browser-storage.ts";
import {
  listSpreadingDifferences
} from "../../../data/fcs/cutting/spreading-differences.ts";
const numberFormatter = new Intl.NumberFormat("zh-CN");
const replenishmentSourceMeta = {
  "cut-order": { label: "\u88C1\u7247\u5355", className: "bg-slate-100 text-slate-700" },
  "marker-plan-ref": { label: "\u551B\u67B6\u65B9\u6848", className: "bg-violet-100 text-violet-700" },
  "spreading-session": { label: "\u94FA\u5E03\u8BB0\u5F55", className: "bg-sky-100 text-sky-700" },
  "pda-feedback": { label: "\u73B0\u573A\u8865\u6599\u53CD\u9988", className: "bg-amber-100 text-amber-700" }
};
const replenishmentStatusMetaMap = {
  NO_ACTION: {
    key: "NO_ACTION",
    label: "\u65E0\u9700\u8865\u6599",
    className: "bg-emerald-100 text-emerald-700",
    detailText: "\u5F53\u524D\u5DEE\u5F02\u672A\u5F62\u6210\u8865\u6599\u52A8\u4F5C\uFF0C\u53EF\u7EE7\u7EED\u89C2\u5BDF\u3002"
  },
  PENDING_REVIEW: {
    key: "PENDING_REVIEW",
    label: "\u5F85\u5BA1\u6838",
    className: "bg-amber-100 text-amber-700",
    detailText: "\u5B9E\u9645\u5DEE\u5F02\u5DF2\u8FDB\u5165\u5904\u7406\u5DE5\u4F5C\u53F0\uFF0C\u7B49\u5F85\u4EBA\u5DE5\u5BA1\u6838\u3002"
  },
  PENDING_SUPPLEMENT: {
    key: "PENDING_SUPPLEMENT",
    label: "\u5F85\u8865\u5F55",
    className: "bg-orange-100 text-orange-700",
    detailText: "\u5F53\u524D\u5DEE\u5F02\u4F9D\u636E\u4E0D\u8DB3\uFF0C\u9700\u8865\u5F55\u518D\u5224\u65AD\u3002"
  },
  REJECTED: {
    key: "REJECTED",
    label: "\u5BA1\u6838\u9A73\u56DE",
    className: "bg-slate-200 text-slate-700",
    detailText: "\u5DEE\u5F02\u5904\u7406\u5DF2\u9A73\u56DE\uFF0C\u5F53\u524D\u4E0D\u8FDB\u5165\u540E\u7EED\u52A8\u4F5C\u3002"
  },
  APPROVED_PENDING_ACTION: {
    key: "APPROVED_PENDING_ACTION",
    label: "\u5DF2\u901A\u8FC7\u5F85\u52A8\u4F5C",
    className: "bg-blue-100 text-blue-700",
    detailText: "\u5BA1\u6838\u5DF2\u901A\u8FC7\uFF0C\u540E\u7EED\u52A8\u4F5C\u5C1A\u672A\u5F00\u59CB\u3002"
  },
  IN_ACTION: {
    key: "IN_ACTION",
    label: "\u5904\u7406\u4E2D",
    className: "bg-violet-100 text-violet-700",
    detailText: "\u540E\u7EED\u52A8\u4F5C\u5DF2\u542F\u52A8\uFF0C\u4F46\u4ECD\u672A\u5168\u90E8\u5B8C\u6210\u3002"
  },
  COMPLETED: {
    key: "COMPLETED",
    label: "\u5DF2\u5B8C\u6210",
    className: "bg-fuchsia-100 text-fuchsia-700",
    detailText: "\u5BA1\u6838\u4E0E\u540E\u7EED\u52A8\u4F5C\u5747\u5DF2\u5B8C\u6210\u3002"
  }
};
const replenishmentRiskMetaMap = {
  HIGH: {
    key: "HIGH",
    label: "\u9AD8\u98CE\u9669",
    className: "bg-rose-100 text-rose-700",
    detailText: "\u5F53\u524D\u7F3A\u53E3\u8F83\u5927\u6216\u4F1A\u5F71\u54CD\u540E\u7EED\u5DE5\u827A\uFF0C\u9700\u4F18\u5148\u5904\u7406\u3002"
  },
  MEDIUM: {
    key: "MEDIUM",
    label: "\u4E2D\u98CE\u9669",
    className: "bg-orange-100 text-orange-700",
    detailText: "\u5F53\u524D\u5B58\u5728\u5DEE\u5F02\uFF0C\u9700\u8981\u4EBA\u5DE5\u786E\u8BA4\u4E0E\u7EA0\u504F\u3002"
  },
  LOW: {
    key: "LOW",
    label: "\u4F4E\u98CE\u9669",
    className: "bg-sky-100 text-sky-700",
    detailText: "\u5F53\u524D\u65E0\u660E\u663E\u7F3A\u53E3\uFF0C\u4EC5\u9700\u5E38\u89C4\u89C2\u5BDF\u3002"
  }
};
const replenishmentFollowupActionStatusMetaMap = {
  PENDING: { key: "PENDING", label: "\u5F85\u5904\u7406", className: "bg-amber-100 text-amber-700" },
  CONFIRMED: { key: "CONFIRMED", label: "\u5DF2\u786E\u8BA4", className: "bg-blue-100 text-blue-700" },
  SKIPPED: { key: "SKIPPED", label: "\u5DF2\u8DF3\u8FC7", className: "bg-slate-100 text-slate-700" },
  DONE: { key: "DONE", label: "\u5DF2\u5B8C\u6210", className: "bg-emerald-100 text-emerald-700" }
};
const replenishmentFollowupActionTypeMetaMap = {
  CREATE_PENDING_PREP: {
    key: "CREATE_PENDING_PREP",
    label: "\u7B49\u5F85\u518D\u6B21\u9886\u6599",
    shortLabel: "\u518D\u6B21\u9886\u6599",
    className: "bg-blue-100 text-blue-700"
  },
  SUPPLEMENT_BACKFILL: {
    key: "SUPPLEMENT_BACKFILL",
    label: "\u8865\u5F55\u5DEE\u5F02",
    shortLabel: "\u8865\u5F55",
    className: "bg-orange-100 text-orange-700"
  },
  REPLAN_MARKER: {
    key: "REPLAN_MARKER",
    label: "\u7EE7\u7EED\u8865\u6392",
    shortLabel: "\u8865\u6392",
    className: "bg-emerald-100 text-emerald-700"
  },
  CLOSE_CUT_ORDER: {
    key: "CLOSE_CUT_ORDER",
    label: "\u5173\u95ED\u88C1\u7247\u5355",
    shortLabel: "\u5173\u95ED",
    className: "bg-zinc-100 text-zinc-700"
  },
  RECORD_ONLY: {
    key: "RECORD_ONLY",
    label: "\u4EC5\u8BB0\u5F55\u5DEE\u5F02",
    shortLabel: "\u8BB0\u5F55",
    className: "bg-slate-100 text-slate-700"
  }
};
function formatQty(value) {
  return numberFormatter.format(Math.max(value, 0));
}
function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => Boolean(value))));
}
function nowText(date = /* @__PURE__ */ new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
function formatDateToken(value) {
  const matched = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!matched) return "00000000";
  return `${matched[1]}${matched[2]}${matched[3]}`;
}
function lowerKeywordIndex(values) {
  return uniqueStrings(values).map((item) => item.toLowerCase());
}
function collectContextMaterialSkus(context) {
  return uniqueStrings(
    context.materialRows.flatMap(
      (row) => row.materialLineItems.length ? row.materialLineItems.map((item) => item.materialSku) : [row.materialSkuSummary]
    )
  );
}
function collectContextMaterialCategories(context) {
  return uniqueStrings(
    context.materialRows.flatMap((row) => row.materialLineItems.map((item) => item.materialCategory))
  );
}
function collectContextMaterialAttrs(context) {
  return uniqueStrings(context.materialRows.flatMap((row) => row.materialLineItems.map((item) => item.materialAttr)));
}
function collectContextMaterialAliases(context) {
  return uniqueStrings(context.materialRows.flatMap((row) => row.materialLineItems.map((item) => item.materialAlias)));
}
function collectContextMaterialImageUrl(context) {
  return context.materialRows.flatMap((row) => row.materialLineItems).find((item) => item.materialImageUrl)?.materialImageUrl || "";
}
function findContextMaterialLine(context, cutOrderId, materialSku) {
  const row = context.materialRows.find((item) => item.cutOrderId === cutOrderId) || context.materialRows.find((item) => item.cutOrderNo === cutOrderId) || null;
  return row?.materialLineItems.find((item) => item.materialSku === materialSku) || context.materialRows.flatMap((item) => item.materialLineItems).find((item) => item.materialSku === materialSku) || null;
}
function buildSuggestionNo(createdAt, index) {
  return `BL-${formatDateToken(createdAt)}-${String(index + 1).padStart(3, "0")}`;
}
function buildStableSuggestionId(context) {
  if (context.session?.spreadingSessionId) return `rep-session-${context.session.spreadingSessionId}`;
  if (context.baseSourceType === "marker-plan-ref" && context.markerPlanId) return `rep-merge-${context.markerPlanId}`;
  return `rep-cut-order-${context.cutOrderIds[0] || context.contextId}`;
}
function deriveEstimatedCapacityQty(options) {
  if (options.varianceSummary) {
    return Math.max(options.varianceSummary.estimatedPieceCapacity, 0);
  }
  if (options.requiredQty <= 0) return 0;
  const fulfilled = Math.max(options.configuredLengthTotal + options.claimedLengthTotal - options.shortageLengthTotal, 0);
  const baseline = Math.max(options.configuredLengthTotal, options.claimedLengthTotal, options.shortageLengthTotal, 1);
  const ratio = Math.max(Math.min(fulfilled / baseline, 1), 0);
  return Math.floor(options.requiredQty * ratio);
}
function deriveReplenishmentRiskLevel(options) {
  if (options.missingData) return "MEDIUM";
  if (options.shortageQty >= Math.max(Math.ceil(options.requiredQty * 0.08), 5)) return "HIGH";
  if (options.varianceLength < -20) return "HIGH";
  if (options.shortageQty > 0 || options.varianceLength < 0) return "MEDIUM";
  return "LOW";
}
function buildSuggestedAction(options) {
  if (options.missingData) {
    return {
      status: "PENDING_SUPPLEMENT",
      text: "\u8865\u5F55\u94FA\u5E03\u3001\u9886\u6599\u5DEE\u5F02\u540E\u5BA1\u6838\u3002"
    };
  }
  if (options.shortageQty > 0 || options.varianceLength < 0) {
    return {
      status: "PENDING_REVIEW",
      text: `\u5B58\u5728 ${formatQty(options.shortageQty)} \u4EF6\u5BF9\u5E94\u5DEE\u5F02\uFF0C\u9700\u5BA1\u6838\u540E\u51B3\u5B9A\u8865\u6599\u3001\u8865\u5F55\u3001\u8865\u6392\u3001\u5173\u95ED\u6216\u4EC5\u8BB0\u5F55\u3002`
    };
  }
  return {
    status: "NO_ACTION",
    text: "\u5F53\u524D\u5DEE\u5F02\u672A\u5F62\u6210\u8865\u6599\u52A8\u4F5C\uFF0C\u7EE7\u7EED\u89C2\u5BDF\u5373\u53EF\u3002"
  };
}
function buildReplenishmentSuggestionFromContext(options) {
  const requiredQty = options.context.varianceSummary?.plannedCutGarmentQty || options.context.marker?.totalPieces || options.context.totalRequiredQty;
  const estimatedCapacityQty = options.context.varianceSummary?.theoreticalCutGarmentQty ?? deriveEstimatedCapacityQty({
    requiredQty,
    configuredLengthTotal: options.context.totalConfiguredLength,
    claimedLengthTotal: options.context.totalClaimedLength,
    shortageLengthTotal: options.context.totalShortageLength,
    usableLengthTotal: options.context.totalUsableLength,
    varianceSummary: options.context.varianceSummary
  });
  const actualCutGarmentQty = options.context.varianceSummary?.actualCutGarmentQty || 0;
  const shortageQty = options.context.varianceSummary?.shortageGarmentQty ?? Math.max(requiredQty - actualCutGarmentQty, 0);
  const varianceLength = options.context.varianceSummary ? Number(options.context.varianceSummary.varianceLength.toFixed(2)) : Number((options.context.totalClaimedLength - options.context.totalConfiguredLength).toFixed(2));
  const preview = buildReplenishmentPreview(options.context.varianceSummary);
  const missingData = !options.context.marker || !options.context.session || preview.level === "MISSING";
  const riskLevel = deriveReplenishmentRiskLevel({
    shortageQty,
    requiredQty,
    varianceLength,
    missingData
  });
  const suggested = buildSuggestedAction({
    shortageQty,
    varianceLength,
    missingData
  });
  const createdAt = options.context.session?.updatedAt || options.context.marker?.updatedAt || options.context.materialRows[0]?.latestClaimRecordAt || nowText();
  const materialSkus = collectContextMaterialSkus(options.context);
  const materialCategories = collectContextMaterialCategories(options.context);
  const materialAttrs = collectContextMaterialAttrs(options.context);
  const materialAliases = collectContextMaterialAliases(options.context);
  return {
    suggestionId: buildStableSuggestionId(options.context),
    suggestionNo: buildSuggestionNo(createdAt, options.index),
    contextId: options.context.contextId,
    sourceType: options.context.sourceType,
    cutOrderIds: options.context.cutOrderIds,
    cutOrderNos: options.context.cutOrderNos,
    markerPlanId: options.context.markerPlanId,
    markerPlanNo: options.context.markerPlanNo,
    productionOrderIds: uniqueStrings(options.context.materialRows.map((row) => row.productionOrderId)),
    productionOrderNos: options.context.productionOrderNos,
    styleCode: options.context.styleCode,
    spuCode: options.context.spuCode,
    styleName: options.context.styleName,
    materialSku: materialSkus.join(" / ") || options.context.materialRows[0]?.materialSkuSummary || "\u5F85\u8865",
    materialSkus,
    materialCategory: materialCategories.join(" / ") || "\u5F85\u8865",
    materialAttr: materialAttrs.join(" / ") || "\u5F85\u8865",
    materialAlias: materialAliases.join(" / "),
    materialImageUrl: collectContextMaterialImageUrl(options.context),
    requiredGarmentQty: requiredQty,
    theoreticalCutGarmentQty: estimatedCapacityQty,
    actualCutGarmentQty,
    shortageGarmentQty: shortageQty,
    actualLengthTotal: options.context.varianceSummary?.spreadActualLengthM || 0,
    summaryRuleText: options.context.varianceSummary?.warningRuleText || "",
    requiredQty,
    estimatedCapacityQty,
    shortageQty,
    configuredLengthTotal: options.context.totalConfiguredLength,
    claimedLengthTotal: options.context.totalClaimedLength,
    usableLengthTotal: options.context.totalUsableLength,
    shortageLengthTotal: options.context.totalShortageLength,
    varianceLength,
    suggestedAction: suggested.text,
    riskLevel,
    createdAt,
    status: suggested.status,
    note: preview.detailText,
    lines: options.context.varianceSummary?.replenishmentLines.map((line) => {
      const materialLine = findContextMaterialLine(options.context, line.cutOrderId, line.materialSku);
      return {
        lineId: line.lineId,
        cutOrderId: line.cutOrderId,
        cutOrderNo: line.cutOrderNo,
        materialSku: line.materialSku,
        materialAlias: materialLine?.materialAlias || "",
        materialImageUrl: materialLine?.materialImageUrl || "",
        color: line.color,
        requiredGarmentQty: line.requiredGarmentQty,
        actualCutGarmentQty: line.actualCutGarmentQty,
        claimedLengthTotal: line.claimedLengthTotal,
        actualLengthTotal: line.actualLengthTotal,
        shortageGarmentQty: line.shortageGarmentQty,
        suggestedAction: line.suggestedAction,
        actualCutGarmentQtyFormula: line.actualCutGarmentQtyFormula,
        shortageGarmentQtyFormula: line.shortageGarmentQtyFormula,
        suggestedActionRuleText: line.suggestedActionRuleText
      };
    }) || []
  };
}
function validateReplenishmentReviewAction(options) {
  const reason = options.decisionReason.trim();
  if (options.suggestion.statusMeta.key === "NO_ACTION" && options.reviewStatus === "APPROVED" && options.reviewResult !== "\u4EC5\u8BB0\u5F55\u5DEE\u5F02") {
    return { ok: false, message: "\u5F53\u524D\u5EFA\u8BAE\u4E3A\u201C\u65E0\u9700\u8865\u6599\u201D\uFF0C\u4E0D\u80FD\u76F4\u63A5\u5BA1\u6838\u901A\u8FC7\u3002" };
  }
  if (options.reviewResult === "\u5173\u95ED\u88C1\u7247\u5355" && !String(options.closeReason || "").trim()) {
    return { ok: false, message: "\u5173\u95ED\u88C1\u7247\u5355\u5FC5\u987B\u586B\u5199\u5173\u95ED\u539F\u56E0\u3002" };
  }
  if ((options.reviewStatus === "REJECTED" || options.reviewStatus === "PENDING_SUPPLEMENT") && !reason) {
    return { ok: false, message: "\u9A73\u56DE\u6216\u6807\u8BB0\u5F85\u8865\u5F55\u65F6\u5FC5\u987B\u586B\u5199\u539F\u56E0\u3002" };
  }
  return { ok: true, message: "" };
}
function buildReplenishmentNavigationPayload(suggestion) {
  const cutOrderId = suggestion.cutOrderIds[0] || void 0;
  const cutOrderNo = suggestion.cutOrderNos[0] || void 0;
  const productionOrderId = suggestion.productionOrderIds[0] || void 0;
  const productionOrderNo = suggestion.productionOrderNos[0] || void 0;
  const markerPlanId = suggestion.markerPlanId || void 0;
  const markerPlanNo = suggestion.markerPlanNo || void 0;
  const materialSku = suggestion.materialSku.split(" / ")[0] || void 0;
  return {
    markerSpreading: { cutOrderId, cutOrderNo, markerPlanId, markerPlanNo, productionOrderId, productionOrderNo, materialSku },
    materialPrep: { cutOrderId, cutOrderNo, productionOrderId, productionOrderNo, materialSku },
    cuttablePool: { cutOrderId, cutOrderNo, productionOrderId, productionOrderNo, markerPlanId, markerPlanNo, materialSku },
    cutOrders: { cutOrderId, cutOrderNo, productionOrderId, productionOrderNo, markerPlanId, markerPlanNo, materialSku },
    markerPlanRefs: { markerPlanId, markerPlanNo, cutOrderId, cutOrderNo, productionOrderId, productionOrderNo, materialSku },
    summary: { cutOrderId, cutOrderNo, markerPlanId, markerPlanNo, productionOrderId, productionOrderNo, materialSku }
  };
}
function buildActionTargetPath(targetPageKey) {
  if (targetPageKey === "materialPrep") return "/fcs/craft/cutting/warehouse-management/wait-process";
  if (targetPageKey === "cuttablePool") return "/fcs/craft/cutting/cuttable-pool";
  if (targetPageKey === "cutOrders") return "/fcs/craft/cutting/cut-orders";
  if (targetPageKey === "markerSpreading") return "/fcs/craft/cutting/spreading-list";
  if (targetPageKey === "markerPlanRefs") return "/fcs/craft/cutting/marker-list";
  return "/fcs/craft/cutting/replenishment";
}
function resolveReviewStatusFromResult(result) {
  if (result === "\u9700\u8981\u8865\u5F55") return "PENDING_SUPPLEMENT";
  return "APPROVED";
}
function resolveNextActionFromReviewResult(result) {
  if (result === "\u9700\u8981\u8865\u6599") return "\u56DE\u5230\u4E2D\u8F6C\u4ED3\u914D\u6599";
  if (result === "\u9700\u8981\u8865\u5F55") return "\u8865\u5F55\u94FA\u5E03\u6216\u88C1\u526A\u6570\u636E";
  if (result === "\u7EE7\u7EED\u8865\u6392") return "\u56DE\u5230\u53EF\u6392\u551B\u67B6";
  if (result === "\u5173\u95ED\u88C1\u7247\u5355") return "\u5173\u95ED\u88C1\u7247\u5355";
  return "\u65E0\u540E\u7EED\u52A8\u4F5C";
}
function resolveFollowupActionFromReviewResult(result) {
  if (!result) return null;
  if (result === "\u9700\u8981\u8865\u6599") {
    return {
      actionType: "CREATE_PENDING_PREP",
      title: "\u56DE\u5230\u4E2D\u8F6C\u4ED3\u914D\u6599",
      targetPageKey: "materialPrep",
      note: "\u5BA1\u6838\u5224\u65AD\u9700\u8981\u8865\u6599\uFF0C\u540E\u7EED\u7531\u4E2D\u8F6C\u4ED3\u5F62\u6210\u8865\u914D\u6570\u91CF\uFF0C\u88C1\u5E8A\u518D\u6B21\u9886\u6599\u540E\u518D\u5224\u65AD\u662F\u5426\u8865\u6392\u3002"
    };
  }
  if (result === "\u9700\u8981\u8865\u5F55") {
    return {
      actionType: "SUPPLEMENT_BACKFILL",
      title: "\u8865\u5F55\u94FA\u5E03\u6216\u88C1\u526A\u6570\u636E",
      targetPageKey: "markerSpreading",
      note: "\u5BA1\u6838\u5224\u65AD\u5148\u8865\u5F55\u5B9E\u9645\u94FA\u5E03\u3001\u88C1\u526A\u6216\u5377\u8BB0\u5F55\uFF0C\u518D\u91CD\u65B0\u8BA1\u7B97\u5DEE\u5F02\u3002"
    };
  }
  if (result === "\u7EE7\u7EED\u8865\u6392") {
    return {
      actionType: "REPLAN_MARKER",
      title: "\u56DE\u5230\u53EF\u6392\u551B\u67B6\u88C1\u7247\u5355",
      targetPageKey: "cuttablePool",
      note: "\u5BA1\u6838\u5224\u65AD\u5F53\u524D\u53EF\u7EE7\u7EED\u8865\u6392\uFF0C\u5F85\u53EF\u7528\u4F59\u989D\u6EE1\u8DB3\u540E\u91CD\u65B0\u8FDB\u5165\u551B\u67B6\u65B9\u6848\u3002"
    };
  }
  if (result === "\u5173\u95ED\u88C1\u7247\u5355") {
    return {
      actionType: "CLOSE_CUT_ORDER",
      title: "\u5173\u95ED\u88C1\u7247\u5355",
      targetPageKey: "cutOrders",
      note: "\u5BA1\u6838\u5224\u65AD\u4E0D\u518D\u8865\u88C1\uFF0C\u88C1\u7247\u5355\u9700\u8BB0\u5F55\u5173\u95ED\u539F\u56E0\u5E76\u9000\u51FA\u53EF\u6392\u551B\u67B6\u3002"
    };
  }
  return {
    actionType: "RECORD_ONLY",
    title: "\u4EC5\u8BB0\u5F55\u5DEE\u5F02",
    targetPageKey: "cutOrders",
    note: "\u5BA1\u6838\u5224\u65AD\u53EA\u4FDD\u7559\u5DEE\u5F02\u8BB0\u5F55\uFF0C\u4E0D\u6539\u53D8\u6570\u91CF\u8D26\u3002"
  };
}
function buildFollowupAction(options) {
  return {
    actionId: `${options.suggestion.suggestionId}-${options.actionType}`,
    suggestionId: options.suggestion.suggestionId,
    actionType: options.actionType,
    title: options.title,
    status: options.status || "PENDING",
    targetPageKey: options.targetPageKey,
    targetPath: buildActionTargetPath(options.targetPageKey),
    targetQuery: options.navigationPayload[options.targetPageKey],
    note: options.note,
    decidedAt: options.decidedAt || "",
    decidedBy: options.decidedBy || "",
    completedAt: options.completedAt || "",
    completedBy: options.completedBy || ""
  };
}
function buildReplenishmentFollowupActionForResult(options) {
  const actionMeta = resolveFollowupActionFromReviewResult(options.result);
  if (!actionMeta) return null;
  return buildFollowupAction({
    suggestion: options.suggestion,
    navigationPayload: options.navigationPayload,
    actionType: actionMeta.actionType,
    title: actionMeta.title,
    targetPageKey: actionMeta.targetPageKey,
    note: actionMeta.note,
    decidedAt: options.decidedAt,
    decidedBy: options.decidedBy
  });
}
function buildDefaultFollowupActions(suggestion, navigationPayload) {
  void suggestion;
  void navigationPayload;
  return [];
}
function mergeStoredActions(options) {
  if (options.storedActions.length) return options.storedActions;
  const defaults = buildDefaultFollowupActions(options.suggestion, options.navigationPayload);
  if (!options.storedActions.length) return defaults;
  const storedByType = new Map(options.storedActions.map((item) => [item.actionType, item]));
  const merged = defaults.map((item) => {
    const stored = storedByType.get(item.actionType);
    if (!stored) return item;
    return {
      ...item,
      status: stored.status,
      note: stored.note || item.note,
      decidedAt: stored.decidedAt || "",
      decidedBy: stored.decidedBy || "",
      completedAt: stored.completedAt || "",
      completedBy: stored.completedBy || ""
    };
  });
  const extraStored = options.storedActions.filter(
    (item) => !merged.some((mergedItem) => mergedItem.actionType === item.actionType)
  );
  return [...merged, ...extraStored];
}
function buildImpactPlanFromActions(options) {
  const completedCount = options.actions.filter((item) => item.status === "DONE").length;
  const skippedCount = options.actions.filter((item) => item.status === "SKIPPED").length;
  const pendingCount = options.actions.filter((item) => !["DONE", "SKIPPED"].includes(item.status)).length;
  const manualConfirmCount = options.actions.filter((item) => item.title.startsWith("\u786E\u8BA4\u662F\u5426")).length;
  const impactSummary = options.actions.length ? options.actions.map((item) => `${replenishmentFollowupActionTypeMetaMap[item.actionType].shortLabel}\xB7${replenishmentFollowupActionStatusMetaMap[item.status].label}`).join(" / ") : "\u5F53\u524D\u65E0\u540E\u7EED\u52A8\u4F5C\u3002";
  const latestCompleted = [...options.actions].filter((item) => item.completedAt).sort((left, right) => right.completedAt.localeCompare(left.completedAt, "zh-CN"))[0];
  const reviewAppliedAt = options.review?.reviewedAt || "";
  const reviewAppliedBy = options.review?.reviewedBy || "";
  const completed = options.review?.reviewStatus === "APPROVED" && pendingCount === 0;
  return {
    impactPlanId: `impact-${options.suggestion.suggestionId}`,
    suggestionId: options.suggestion.suggestionId,
    needReconfigureMaterial: options.actions.some((item) => item.actionType === "CREATE_PENDING_PREP"),
    needReclaimMaterial: options.actions.some((item) => item.actionType === "CREATE_PENDING_PREP"),
    needPendingPrep: options.actions.some((item) => item.actionType === "CREATE_PENDING_PREP" || item.actionType === "REPLAN_MARKER"),
    impactSummary,
    applied: completed,
    appliedAt: latestCompleted?.completedAt || (completed && !options.actions.length ? reviewAppliedAt : ""),
    appliedBy: latestCompleted?.completedBy || (completed && !options.actions.length ? reviewAppliedBy : ""),
    pendingActionCount: pendingCount,
    completedActionCount: completedCount + skippedCount,
    manualConfirmCount,
    blocking: pendingCount > 0
  };
}
function deriveStatusMeta(options) {
  if (options.review?.reviewStatus === "REJECTED") return replenishmentStatusMetaMap.REJECTED;
  if (options.review?.reviewStatus === "PENDING_SUPPLEMENT") return replenishmentStatusMetaMap.PENDING_SUPPLEMENT;
  if (options.review?.reviewStatus === "APPROVED") {
    if (!options.actions.length) return replenishmentStatusMetaMap.COMPLETED;
    const completedCount = options.actions.filter((item) => ["DONE", "SKIPPED"].includes(item.status)).length;
    const pendingCount = options.actions.length - completedCount;
    if (pendingCount <= 0) return replenishmentStatusMetaMap.COMPLETED;
    if (completedCount === 0) return replenishmentStatusMetaMap.APPROVED_PENDING_ACTION;
    return replenishmentStatusMetaMap.IN_ACTION;
  }
  return replenishmentStatusMetaMap[options.suggestion.status];
}
function buildSourceSummary(context) {
  if (context.baseSourceType === "marker-plan-ref") {
    return `\u551B\u67B6\u65B9\u6848 ${context.markerPlanNo || "\u5F85\u8865\u551B\u67B6\u65B9\u6848\u53F7"} \xB7 ${context.cutOrderNos.length} \u4E2A\u88C1\u7247\u5355`;
  }
  return `\u88C1\u7247\u5355 ${context.cutOrderNos[0] || "\u5F85\u8865"}`;
}
function buildDifferenceSummary(suggestion) {
  return [
    `\u8BA1\u5212\u88C1\u526A\u6210\u8863\u4EF6\u6570 ${formatQty(suggestion.requiredGarmentQty)} \u4EF6`,
    `\u7406\u8BBA\u88C1\u526A\u6210\u8863\u4EF6\u6570 ${formatQty(suggestion.theoreticalCutGarmentQty)} \u4EF6`,
    `\u5DEE\u5F02\u6210\u8863\u4EF6\u6570 ${formatQty(suggestion.shortageGarmentQty)} \u4EF6`,
    `\u5DEE\u5F02\u957F\u5EA6 ${numberFormatter.format(suggestion.varianceLength)} \u7C73`
  ].join(" / ");
}
function buildMajorGapSummary(suggestion) {
  if (suggestion.shortageGarmentQty > 0) {
    return `\u7F3A ${formatQty(suggestion.shortageGarmentQty)} \u4EF6 / ${numberFormatter.format(suggestion.shortageLengthTotal)} \u7C73`;
  }
  if (suggestion.varianceLength < 0) {
    return `\u957F\u5EA6\u8D85\u51FA ${numberFormatter.format(Math.abs(suggestion.varianceLength))} \u7C73`;
  }
  return "\u5F53\u524D\u65E0\u660E\u663E\u7F3A\u53E3";
}
function buildClaimedBalanceLength(suggestion) {
  return Number(Math.max(Number(suggestion.claimedLengthTotal || 0) - Number(suggestion.actualLengthTotal || 0), 0).toFixed(2));
}
function buildMaterialGapLength(suggestion) {
  return Number(
    Math.max(
      Number(suggestion.shortageLengthTotal || 0),
      Number(suggestion.actualLengthTotal || 0) - Number(suggestion.claimedLengthTotal || 0),
      0
    ).toFixed(2)
  );
}
function buildReplenishmentNextOptions(suggestion) {
  const claimedBalanceLength = buildClaimedBalanceLength(suggestion);
  const hasGap = suggestion.shortageGarmentQty > 0 || buildMaterialGapLength(suggestion) > 0 || suggestion.varianceLength < 0;
  const missingData = suggestion.status === "PENDING_SUPPLEMENT" || suggestion.lines.length === 0;
  if (!hasGap && !missingData) {
    return [
      {
        key: "NO_GAP",
        label: "\u65E0\u9700\u8865\u6392",
        detailText: "\u5F53\u524D\u6CA1\u6709\u5F62\u6210\u9762\u6599\u7F3A\u53E3\uFF0C\u4E0D\u9700\u8981\u518D\u6B21\u6392\u551B\u67B6\u3002",
        target: "cutOrders",
        className: "bg-emerald-100 text-emerald-700"
      }
    ];
  }
  if (missingData) {
    return [
      {
        key: "CHECK_DATA",
        label: "\u8865\u9F50\u6570\u636E",
        detailText: "\u5148\u8865\u9F50\u94FA\u5E03\u3001\u88C1\u526A\u6216\u9886\u6599\u6570\u91CF\uFF0C\u518D\u5224\u65AD\u662F\u5426\u8865\u6392\u3002",
        target: "markerSpreading",
        className: "bg-orange-100 text-orange-700"
      }
    ];
  }
  const options = [];
  if (claimedBalanceLength > 0) {
    options.push({
      key: "REPLAN_MARKER",
      label: "\u53BB\u8865\u6392\u551B\u67B6",
      detailText: "\u5DF2\u9886\u9762\u6599\u4ECD\u6709\u53EF\u7528\u4F59\u989D\uFF0C\u53EF\u56DE\u5230\u53EF\u6392\u551B\u67B6\u88C1\u7247\u5355\u7EE7\u7EED\u8865\u6392\u3002",
      target: "cuttablePool",
      className: "bg-blue-100 text-blue-700"
    });
  } else {
    options.push({
      key: "WAIT_NEXT_PICKUP",
      label: "\u7B49\u5F85\u518D\u6B21\u9886\u6599",
      detailText: "\u5F53\u524D\u5DF2\u9886\u9762\u6599\u5DF2\u6D88\u8017\u5B8C\uFF0C\u9700\u8981\u518D\u6B21\u9886\u6599\u540E\u624D\u80FD\u7EE7\u7EED\u8865\u6392\u3002",
      target: "materialPrep",
      className: "bg-amber-100 text-amber-700"
    });
  }
  options.push({
    key: "CLOSE_CUT_ORDER",
    label: "\u5173\u95ED\u88C1\u7247\u5355",
    detailText: "\u5982\u679C\u786E\u8BA4\u540E\u7EED\u4E0D\u518D\u6765\u6599\uFF0C\u53EF\u5173\u95ED\u88C1\u7247\u5355\u5E76\u586B\u5199\u5173\u95ED\u539F\u56E0\u3002",
    target: "cutOrders",
    className: "bg-zinc-100 text-zinc-700"
  });
  return options;
}
function buildNextActionSummary(options) {
  return options.map((item) => item.label).join(" / ") || "\u6682\u65E0\u540E\u7EED\u52A8\u4F5C";
}
function buildReviewSummary(review) {
  if (!review) return "\u672A\u5BA1\u6838";
  if (review.reviewStatus === "APPROVED") return "\u5BA1\u6838\u901A\u8FC7";
  if (review.reviewStatus === "REJECTED") return "\u5BA1\u6838\u9A73\u56DE";
  return "\u5F85\u8865\u5F55";
}
function buildBlockingSummary(row) {
  if (row.latestPdaFeedbackSummary) return row.latestPdaFeedbackSummary;
  if (row.statusMeta.key === "NO_ACTION") return "\u5F53\u524D\u4E0D\u5F71\u54CD\u540E\u7EED";
  if (row.statusMeta.key === "REJECTED") return "\u5DF2\u9A73\u56DE\uFF0C\u4E0D\u8FDB\u5165\u540E\u7EED\u52A8\u4F5C";
  if (row.statusMeta.key === "COMPLETED") return "\u7EA0\u504F\u52A8\u4F5C\u5DF2\u95ED\u73AF";
  if (row.statusMeta.key === "PENDING_SUPPLEMENT") return "\u5F85\u8865\u5F55\uFF0C\u4ECD\u5F71\u54CD\u4E0B\u6E38";
  if (row.statusMeta.key === "PENDING_REVIEW") return "\u5F85\u5BA1\u6838\uFF0C\u4ECD\u5F71\u54CD\u4E0B\u6E38";
  if (row.pendingActionCount > 0) return `\u4ECD\u6709 ${row.pendingActionCount} \u9879\u52A8\u4F5C\u672A\u5B8C\u6210`;
  return "\u5F85\u7EE7\u7EED\u5904\u7406";
}
function buildPdaFeedbackSummary(record) {
  if (!record) return "";
  return `\u73B0\u573A\u53CD\u9988\uFF1A${record.reasonLabel}\uFF0C\u7531 ${record.operatorName} \u4E8E ${record.submittedAt} \u63D0\u4EA4`;
}
function matchesPdaFeedbackWithSuggestion(feedback, suggestion) {
  const matchesCutOrder = suggestion.cutOrderIds.includes(feedback.cutOrderId) || suggestion.cutOrderNos.includes(feedback.cutOrderNo);
  if (!matchesCutOrder) return false;
  const matchesProduction = suggestion.productionOrderIds.includes(feedback.productionOrderId) || suggestion.productionOrderNos.includes(feedback.productionOrderNo);
  if (!matchesProduction) return false;
  if (!suggestion.materialSkus.includes(feedback.materialSku)) return false;
  if (feedback.markerPlanId || feedback.markerPlanNo) {
    return suggestion.markerPlanId === feedback.markerPlanId || suggestion.markerPlanNo === feedback.markerPlanNo;
  }
  return !suggestion.markerPlanId && !suggestion.markerPlanNo;
}
function matchesSpreadingDifferenceWithSuggestion(difference, suggestion, context) {
  const matchesCutOrder = difference.cutOrderIds.some((id) => suggestion.cutOrderIds.includes(id)) || difference.cutOrderNos.some((no) => suggestion.cutOrderNos.includes(no));
  if (!matchesCutOrder) return false;
  const matchesProduction = difference.productionOrderIds.some((id) => suggestion.productionOrderIds.includes(id)) || difference.productionOrderNos.some((no) => suggestion.productionOrderNos.includes(no));
  if (!matchesProduction) return false;
  if (suggestion.materialSkus.length && !suggestion.materialSkus.includes(difference.materialSku)) return false;
  if (context?.session?.spreadingSessionId || context?.session?.sessionNo) {
    return difference.spreadingOrderId === context.session.spreadingSessionId || difference.spreadingOrderNo === context.session.sessionNo || difference.sourceObjectId === context.session.spreadingSessionId;
  }
  if (difference.spreadingOrderId || difference.spreadingOrderNo) return false;
  if (suggestion.markerPlanId || suggestion.markerPlanNo) {
    return suggestion.markerPlanId === difference.markerPlanId || suggestion.markerPlanNo === difference.markerPlanNo;
  }
  return true;
}
function matchesSpreadingDifferenceWithPrefilter(difference, prefilter) {
  if (prefilter.spreadingSessionId) {
    return difference.spreadingOrderId === prefilter.spreadingSessionId || difference.spreadingOrderNo === prefilter.spreadingSessionId || difference.sourceObjectId === prefilter.spreadingSessionId;
  }
  if (prefilter.spreadingOrderId) {
    return difference.spreadingOrderId === prefilter.spreadingOrderId || difference.spreadingOrderNo === prefilter.spreadingOrderId;
  }
  return false;
}
function summarizeDifferenceTypes(differences) {
  if (!differences.length) return "\u65E0\u94FA\u5E03\u5DEE\u5F02";
  return uniqueStrings(differences.map((difference) => difference.differenceType)).join(" / ");
}
function buildDifferenceSummaryFromDifferences(differences, fallback) {
  if (!differences.length) return fallback;
  return differences.slice(0, 3).map((difference) => {
    const planned = `${numberFormatter.format(difference.plannedValue)} ${difference.unit}`;
    const actual = `${numberFormatter.format(difference.actualValue)} ${difference.unit}`;
    const gap = `${numberFormatter.format(Math.abs(difference.differenceValue))} ${difference.unit}`;
    return `${difference.differenceType}\uFF1A\u8BA1\u5212 ${planned} / \u5B9E\u9645 ${actual} / \u5DEE\u5F02 ${gap}`;
  }).join("\uFF1B");
}
function buildMajorGapSummaryFromDifferences(differences, fallback) {
  const major = differences.find((difference) => difference.differenceLevel === "\u9700\u5904\u7406") || differences[0];
  if (!major) return fallback;
  return `${major.differenceType} ${numberFormatter.format(Math.abs(major.differenceValue))} ${major.unit}`;
}
function buildHandlingStatusLabel(differences, review) {
  if (review?.reviewResult) return `\u5DF2\u5224\u65AD\uFF1A${review.reviewResult}`;
  if (!differences.length) return "\u65E0\u5DEE\u5F02\u4E8B\u9879";
  return uniqueStrings(differences.map((difference) => difference.handlingStatus)).join(" / ");
}
function buildReviewResultLabel(review) {
  return review?.reviewResult || "\u5F85\u5224\u65AD";
}
function buildNextActionLabel(review, nextOptions) {
  return review?.nextAction || buildNextActionSummary(nextOptions);
}
function collectLinkedLedgerEventIds(differences, review) {
  return uniqueStrings([
    ...review?.linkedLedgerEventIds || [],
    ...differences.flatMap((difference) => difference.linkedLedgerEventIds)
  ]);
}
function buildPdaFeedbackNavigationPayload(feedback) {
  return buildReplenishmentNavigationPayload({
    cutOrderIds: [feedback.cutOrderId],
    cutOrderNos: [feedback.cutOrderNo],
    markerPlanId: feedback.markerPlanId,
    markerPlanNo: feedback.markerPlanNo,
    productionOrderIds: [feedback.productionOrderId],
    productionOrderNos: [feedback.productionOrderNo],
    materialSku: feedback.materialSku
  });
}
function buildSyntheticFeedbackContext(feedback) {
  return {
    contextId: `ctx-${feedback.writebackId}`,
    sourceType: "cut-order",
    baseSourceType: "cut-order",
    markerPlanId: feedback.markerPlanId,
    markerPlanNo: feedback.markerPlanNo,
    cutOrderIds: [feedback.cutOrderId],
    cutOrderNos: [feedback.cutOrderNo],
    productionOrderNos: [feedback.productionOrderNo],
    styleCode: "",
    spuCode: "",
    styleName: "",
    materialRows: [],
    marker: null,
    session: null,
    totalRequiredQty: 0,
    totalConfiguredLength: 0,
    totalClaimedLength: 0,
    totalUsableLength: 0,
    totalShortageLength: 0,
    varianceSummary: null
  };
}
function buildSyntheticFeedbackRow(feedback) {
  const navigationPayload = buildPdaFeedbackNavigationPayload(feedback);
  const statusMeta = replenishmentStatusMetaMap.PENDING_REVIEW;
  const row = {
    suggestionId: `rep-pda-feedback-${feedback.writebackId}`,
    suggestionNo: `BL-${formatDateToken(feedback.submittedAt)}-${feedback.cutOrderNo.slice(-2) || "01"}`,
    contextId: `ctx-${feedback.writebackId}`,
    sourceType: "pda-feedback",
    cutOrderIds: [feedback.cutOrderId],
    cutOrderNos: [feedback.cutOrderNo],
    markerPlanId: feedback.markerPlanId,
    markerPlanNo: feedback.markerPlanNo,
    productionOrderIds: [feedback.productionOrderId],
    productionOrderNos: [feedback.productionOrderNo],
    styleCode: "",
    spuCode: "",
    styleName: "",
    materialSku: feedback.materialSku,
    materialSkus: [feedback.materialSku],
    materialCategory: "\u5F85\u8DDF\u8FDB",
    materialAttr: "\u5F85\u8DDF\u8FDB",
    materialAlias: "",
    materialImageUrl: "",
    requiredGarmentQty: 0,
    theoreticalCutGarmentQty: 0,
    actualCutGarmentQty: 0,
    shortageGarmentQty: 0,
    actualLengthTotal: 0,
    summaryRuleText: "\u5F85\u4EBA\u5DE5\u786E\u8BA4\u73B0\u573A\u53CD\u9988\u540E\u8865\u9F50\u5224\u5B9A\u4F9D\u636E",
    requiredQty: 0,
    estimatedCapacityQty: 0,
    shortageQty: 0,
    configuredLengthTotal: 0,
    claimedLengthTotal: 0,
    usableLengthTotal: 0,
    shortageLengthTotal: 0,
    varianceLength: 0,
    suggestedAction: "\u8BF7\u5148\u786E\u8BA4\u8FD9\u6761\u73B0\u573A\u53CD\u9988\uFF0C\u5E76\u8865\u9F50\u5DEE\u5F02\u5904\u7406\u4F9D\u636E\u3002",
    riskLevel: "MEDIUM",
    createdAt: feedback.submittedAt,
    status: "PENDING_REVIEW",
    note: feedback.note,
    lines: [],
    context: buildSyntheticFeedbackContext(feedback),
    sourceDifferences: [],
    sourceDifferenceCount: 0,
    differenceTypeSummary: "\u73B0\u573A\u53CD\u9988",
    handlingStatusLabel: "\u5F85\u5904\u7406",
    reviewResultLabel: "\u5F85\u5224\u65AD",
    nextActionLabel: "\u8865\u9F50\u6570\u636E",
    closeReason: "",
    linkedLedgerEventIds: [],
    sourceLabel: replenishmentSourceMeta["pda-feedback"].label,
    sourceSummary: `\u73B0\u573A\u53CD\u9988 \xB7 ${feedback.cutOrderNo}`,
    sourceProductionSummary: feedback.productionOrderNo,
    sourceOrderSummary: feedback.cutOrderNo,
    differenceSummary: `\u539F\u56E0 ${feedback.reasonLabel} / \u51ED\u8BC1 ${feedback.photoProofCount} \u4E2A`,
    majorGapSummary: "\u5F85\u4EBA\u5DE5\u786E\u8BA4\u8865\u6599\u5F71\u54CD",
    review: null,
    reviewSummary: "\u5F85\u5BA1\u6838",
    reviewStatusLabel: "\u5F85\u5BA1\u6838",
    impactPlan: {
      impactPlanId: `impact-${feedback.writebackId}`,
      suggestionId: `rep-pda-feedback-${feedback.writebackId}`,
      needReconfigureMaterial: false,
      needReclaimMaterial: false,
      needPendingPrep: false,
      impactSummary: "\u5F85\u6839\u636E\u73B0\u573A\u53CD\u9988\u786E\u8BA4\u5F71\u54CD\u8303\u56F4\u3002",
      applied: false,
      appliedAt: "",
      appliedBy: "",
      pendingActionCount: 0,
      completedActionCount: 0,
      manualConfirmCount: 0,
      blocking: true
    },
    followupActions: [],
    followupActionCount: 0,
    pendingActionCount: 0,
    completedActionCount: 0,
    skippedActionCount: 0,
    followupProgressText: "\u5F85\u8865\u6599\u4EBA\u5458\u8DDF\u8FDB",
    pdaFeedbacks: [feedback],
    pendingPdaFeedbackCount: 1,
    latestPdaFeedback: feedback,
    latestPdaFeedbackSummary: buildPdaFeedbackSummary(feedback),
    claimedBalanceLength: 0,
    materialGapLength: 0,
    nextOptions: [
      {
        key: "CHECK_DATA",
        label: "\u8865\u9F50\u6570\u636E",
        detailText: "\u5148\u786E\u8BA4\u73B0\u573A\u53CD\u9988\uFF0C\u518D\u8865\u9F50\u6B63\u5F0F\u94FA\u5E03\u3001\u88C1\u526A\u6216\u9886\u6599\u6570\u91CF\u3002",
        target: "markerSpreading",
        className: "bg-orange-100 text-orange-700"
      }
    ],
    nextActionSummary: "\u8865\u9F50\u6570\u636E",
    blockingSummary: "",
    statusMeta,
    riskMeta: replenishmentRiskMetaMap.MEDIUM,
    navigationPayload,
    keywordIndex: lowerKeywordIndex([
      feedback.writebackId,
      feedback.taskNo,
      feedback.productionOrderNo,
      feedback.cutOrderNo,
      feedback.markerPlanNo,
      feedback.materialSku,
      feedback.reasonLabel,
      feedback.note
    ])
  };
  return {
    ...row,
    blockingSummary: buildBlockingSummary(row)
  };
}
function buildSyntheticDifferenceContext(difference) {
  return {
    contextId: `ctx-${difference.differenceId}`,
    sourceType: "spreading-session",
    baseSourceType: "spreading-session",
    markerPlanId: difference.markerPlanId,
    markerPlanNo: difference.markerPlanNo,
    cutOrderIds: [...difference.cutOrderIds],
    cutOrderNos: [...difference.cutOrderNos],
    productionOrderNos: [...difference.productionOrderNos],
    styleCode: "",
    spuCode: "",
    styleName: "",
    materialRows: [],
    marker: null,
    session: null,
    totalRequiredQty: 0,
    totalConfiguredLength: 0,
    totalClaimedLength: 0,
    totalUsableLength: 0,
    totalShortageLength: 0,
    varianceSummary: null
  };
}
function buildSyntheticDifferenceRow(difference) {
  const suggestionId = difference.linkedReplenishmentId;
  const navigationPayload = buildReplenishmentNavigationPayload({
    cutOrderIds: [...difference.cutOrderIds],
    cutOrderNos: [...difference.cutOrderNos],
    markerPlanId: difference.markerPlanId,
    markerPlanNo: difference.markerPlanNo,
    productionOrderIds: [...difference.productionOrderIds],
    productionOrderNos: [...difference.productionOrderNos],
    materialSku: difference.materialSku
  });
  const statusMeta = replenishmentStatusMetaMap.PENDING_REVIEW;
  const row = {
    suggestionId,
    suggestionNo: `BL-${formatDateToken(difference.detectedAt)}-${difference.differenceId.slice(-2) || "01"}`,
    contextId: `ctx-${difference.differenceId}`,
    sourceType: "spreading-session",
    cutOrderIds: [...difference.cutOrderIds],
    cutOrderNos: [...difference.cutOrderNos],
    markerPlanId: difference.markerPlanId,
    markerPlanNo: difference.markerPlanNo,
    productionOrderIds: [...difference.productionOrderIds],
    productionOrderNos: [...difference.productionOrderNos],
    styleCode: "",
    spuCode: "",
    styleName: "",
    materialSku: difference.materialSku,
    materialSkus: [difference.materialSku],
    materialCategory: "\u9762\u6599",
    materialAttr: difference.patternFileName,
    materialAlias: difference.materialAlias,
    materialImageUrl: difference.materialImageUrl,
    requiredGarmentQty: 0,
    theoreticalCutGarmentQty: 0,
    actualCutGarmentQty: 0,
    shortageGarmentQty: Math.max(difference.plannedValue - difference.actualValue, 0),
    actualLengthTotal: difference.actualValue,
    summaryRuleText: difference.evidence.summary,
    requiredQty: difference.plannedValue,
    estimatedCapacityQty: difference.actualValue,
    shortageQty: Math.max(difference.plannedValue - difference.actualValue, 0),
    configuredLengthTotal: difference.plannedValue,
    claimedLengthTotal: difference.actualValue,
    usableLengthTotal: 0,
    shortageLengthTotal: Math.max(difference.plannedValue - difference.actualValue, 0),
    varianceLength: difference.differenceValue,
    suggestedAction: "\u5DEE\u5F02\u8FDB\u5165\u8865\u6599\u7BA1\u7406\u540E\uFF0C\u5148\u5BA1\u6838\u5904\u7406\u7ED3\u679C\uFF0C\u518D\u51B3\u5B9A\u662F\u5426\u8865\u6599\u3002",
    riskLevel: difference.differenceLevel === "\u9700\u5904\u7406" ? "HIGH" : "MEDIUM",
    createdAt: difference.detectedAt,
    status: "PENDING_REVIEW",
    note: difference.evidence.note || difference.evidence.summary,
    lines: [],
    context: buildSyntheticDifferenceContext(difference),
    sourceDifferences: [difference],
    sourceDifferenceCount: 1,
    differenceTypeSummary: difference.differenceType,
    handlingStatusLabel: difference.handlingStatus,
    reviewResultLabel: "\u5F85\u5224\u65AD",
    nextActionLabel: "\u5F85\u5BA1\u6838",
    closeReason: "",
    linkedLedgerEventIds: [...difference.linkedLedgerEventIds],
    sourceLabel: replenishmentSourceMeta["spreading-session"].label,
    sourceSummary: `\u94FA\u5E03\u5355 ${difference.spreadingOrderNo}`,
    sourceProductionSummary: difference.productionOrderNos.join(" / ") || "\u5F85\u8865",
    sourceOrderSummary: `${difference.spreadingOrderNo} \xB7 ${difference.cutOrderNos.join(" / ")}`,
    differenceSummary: buildDifferenceSummaryFromDifferences([difference], ""),
    majorGapSummary: buildMajorGapSummaryFromDifferences([difference], ""),
    review: null,
    reviewSummary: "\u5F85\u5BA1\u6838",
    reviewStatusLabel: "\u5F85\u5BA1\u6838",
    impactPlan: {
      impactPlanId: `impact-${suggestionId}`,
      suggestionId,
      needReconfigureMaterial: false,
      needReclaimMaterial: false,
      needPendingPrep: false,
      impactSummary: "\u5F85\u5BA1\u6838\u5DEE\u5F02\u5904\u7406\u7ED3\u679C\uFF1B\u7531\u5BA1\u6838\u7ED3\u679C\u51B3\u5B9A\u540E\u7EED\u52A8\u4F5C\u3002",
      applied: false,
      appliedAt: "",
      appliedBy: "",
      pendingActionCount: 0,
      completedActionCount: 0,
      manualConfirmCount: 0,
      blocking: true
    },
    followupActions: [],
    followupActionCount: 0,
    pendingActionCount: 0,
    completedActionCount: 0,
    skippedActionCount: 0,
    followupProgressText: "\u5F85\u8865\u6599\u4EBA\u5458\u8DDF\u8FDB",
    pdaFeedbacks: [],
    pendingPdaFeedbackCount: 0,
    latestPdaFeedback: null,
    latestPdaFeedbackSummary: "",
    claimedBalanceLength: 0,
    materialGapLength: Math.max(difference.plannedValue - difference.actualValue, 0),
    nextOptions: [
      {
        key: "CHECK_DATA",
        label: "\u5BA1\u6838\u5DEE\u5F02",
        detailText: "\u5148\u5224\u65AD\u8865\u6599\u3001\u8865\u5F55\u3001\u8865\u6392\u3001\u5173\u95ED\u88C1\u7247\u5355\u6216\u4EC5\u8BB0\u5F55\u3002",
        target: "markerSpreading",
        className: "bg-orange-100 text-orange-700"
      }
    ],
    nextActionSummary: "\u5BA1\u6838\u5DEE\u5F02",
    blockingSummary: "",
    statusMeta,
    riskMeta: replenishmentRiskMetaMap[difference.differenceLevel === "\u9700\u5904\u7406" ? "HIGH" : "MEDIUM"],
    navigationPayload,
    keywordIndex: lowerKeywordIndex([
      suggestionId,
      difference.differenceId,
      difference.spreadingOrderNo,
      difference.markerPlanNo,
      ...difference.cutOrderNos,
      ...difference.productionOrderNos,
      difference.materialSku,
      difference.materialAlias,
      difference.patternFileName,
      difference.differenceType,
      difference.evidence.summary
    ])
  };
  return {
    ...row,
    blockingSummary: buildBlockingSummary(row)
  };
}
function applyReviewToSyntheticDifferenceRow(row, review) {
  if (!review) return row;
  const followupAction = review.reviewResult ? buildReplenishmentFollowupActionForResult({
    suggestion: row,
    navigationPayload: row.navigationPayload,
    result: review.reviewResult,
    decidedAt: review.reviewedAt || row.createdAt,
    decidedBy: review.reviewedBy || "\u7CFB\u7EDF\u9884\u7F6E\u5BA1\u6838"
  }) : null;
  const followupActions = followupAction ? [followupAction] : [];
  const impactPlan = buildImpactPlanFromActions({
    suggestion: row,
    actions: followupActions,
    review
  });
  const statusMeta = deriveStatusMeta({
    suggestion: row,
    review,
    actions: followupActions
  });
  const linkedLedgerEventIds = collectLinkedLedgerEventIds(row.sourceDifferences, review);
  const nextActionLabel = buildNextActionLabel(review, row.nextOptions);
  const nextRow = {
    ...row,
    review,
    reviewResultLabel: buildReviewResultLabel(review),
    nextActionLabel,
    closeReason: review.closeReason || "",
    linkedLedgerEventIds,
    reviewSummary: buildReviewSummary(review),
    reviewStatusLabel: buildReviewSummary(review),
    impactPlan,
    followupActions,
    followupActionCount: followupActions.length,
    pendingActionCount: followupActions.filter((item) => !["DONE", "SKIPPED"].includes(item.status)).length,
    completedActionCount: followupActions.filter((item) => item.status === "DONE").length,
    skippedActionCount: followupActions.filter((item) => item.status === "SKIPPED").length,
    followupProgressText: buildFollowupProgressText(followupActions),
    nextActionSummary: nextActionLabel,
    statusMeta
  };
  return {
    ...nextRow,
    blockingSummary: buildBlockingSummary(nextRow)
  };
}
function resolveReviewItemSourceType(row) {
  const difference = row.sourceDifferences[0];
  if (difference?.differenceType === "\u5377\u8BB0\u5F55\u5F02\u5E38") return "\u5377\u8BB0\u5F55\u5F02\u5E38";
  if (difference?.differenceType === "\u5E03\u5934\u5E03\u5C3E\u5F02\u5E38") return "\u5E03\u5934\u5E03\u5C3E\u5F02\u5E38";
  if (difference?.differenceType === "\u9762\u6599\u4F59\u989D\u4E0D\u8DB3") return "\u9762\u6599\u4F59\u989D\u4E0D\u8DB3";
  if (difference?.sourceType === "\u9886\u6599\u5DEE\u5F02\u5EF6\u7EED") return "\u9886\u6599\u5DEE\u5F02";
  if (difference?.sourceType === "PDA \u94FA\u5E03\u56DE\u5199") return "PDA \u94FA\u5E03\u56DE\u5199";
  if (difference?.sourceType === "PDA \u88C1\u526A\u56DE\u5199") return "PDA \u88C1\u526A\u56DE\u5199";
  if (difference?.sourceType === "Web \u590D\u6838") return "Web \u590D\u6838";
  if (row.latestPdaFeedback) return "\u73B0\u573A\u53CD\u9988";
  return "\u5176\u4ED6\u5F02\u5E38";
}
function resolveReviewItemStatus(row) {
  if (row.review?.reviewResult === "\u5173\u95ED\u88C1\u7247\u5355") return "\u5DF2\u5173\u95ED";
  if (row.review?.reviewStatus === "APPROVED") return "\u5DF2\u5904\u7406";
  if (row.review?.reviewStatus === "PENDING_SUPPLEMENT") return "\u5BA1\u6838\u4E2D";
  if (row.review?.reviewStatus === "REJECTED") return "\u5DF2\u53D6\u6D88";
  return "\u5F85\u5BA1\u6838";
}
function buildReviewEvidenceItems(row) {
  const differenceEvidence = row.sourceDifferences.flatMap((difference) => {
    const items = [
      {
        evidenceId: `${difference.differenceId}-summary`,
        evidenceType: difference.sourceType.includes("PDA") ? "PDA \u53CD\u9988" : difference.sourceType === "\u7CFB\u7EDF\u8BA1\u7B97" ? "\u7CFB\u7EDF\u8BA1\u7B97" : "\u5907\u6CE8",
        summary: difference.evidence.summary,
        operatorName: difference.evidence.operatorName || difference.detectedBy,
        occurredAt: difference.evidence.occurredAt || difference.detectedAt
      }
    ];
    if (difference.evidence.rollNos?.length) {
      items.push({
        evidenceId: `${difference.differenceId}-rolls`,
        evidenceType: "\u5377\u8BB0\u5F55",
        summary: `\u5173\u8054\u5E03\u5377 ${difference.evidence.rollNos.join(" / ")}`,
        operatorName: difference.evidence.operatorName || difference.detectedBy,
        occurredAt: difference.evidence.occurredAt || difference.detectedAt
      });
    }
    if (difference.evidence.photoProofCount) {
      items.push({
        evidenceId: `${difference.differenceId}-photo`,
        evidenceType: "\u7167\u7247",
        summary: `\u73B0\u573A\u7167\u7247 / \u51ED\u8BC1 ${difference.evidence.photoProofCount} \u4E2A`,
        operatorName: difference.evidence.operatorName || difference.detectedBy,
        occurredAt: difference.evidence.occurredAt || difference.detectedAt
      });
    }
    return items;
  });
  const feedbackEvidence = row.pdaFeedbacks.map((feedback) => ({
    evidenceId: feedback.writebackId,
    evidenceType: "PDA \u53CD\u9988",
    summary: `${feedback.reasonLabel}\uFF1B${feedback.note || "\u65E0\u8865\u5145\u8BF4\u660E"}\uFF1B\u7167\u7247 / \u51ED\u8BC1 ${feedback.photoProofCount} \u4E2A`,
    operatorName: feedback.operatorName,
    occurredAt: feedback.submittedAt
  }));
  return [...differenceEvidence, ...feedbackEvidence];
}
function buildReplenishmentReviewItem(row) {
  const difference = row.sourceDifferences[0];
  const feedback = row.latestPdaFeedback;
  const plannedValue = difference?.plannedValue ?? row.requiredQty;
  const actualValue = difference?.actualValue ?? row.actualCutGarmentQty;
  const differenceValue = difference?.differenceValue ?? row.varianceLength;
  const materialColor = Array.from(new Set(row.lines.map((line) => line.color).filter(Boolean))).join(" / ") || "\u5F85\u8865";
  return {
    replenishmentId: row.suggestionId,
    replenishmentNo: row.suggestionNo,
    sourceDifferenceId: difference?.differenceId || feedback?.writebackId || row.contextId,
    sourceType: resolveReviewItemSourceType(row),
    differenceType: difference?.differenceType || (feedback ? "\u73B0\u573A\u53CD\u9988" : "\u5176\u4ED6\u5F02\u5E38"),
    differenceLevel: difference?.differenceLevel || row.riskMeta.label,
    productionOrderIds: [...row.productionOrderIds],
    cutOrderIds: [...row.cutOrderIds],
    spreadingOrderId: difference?.spreadingOrderId || row.context.session?.spreadingSessionId || "",
    spreadingOrderNo: difference?.spreadingOrderNo || row.context.session?.sessionNo || "",
    markerPlanId: row.markerPlanId,
    markerPlanNo: row.markerPlanNo,
    materialIdentity: {
      materialSku: row.materialSku,
      materialName: row.materialCategory || row.materialSku,
      materialColor,
      materialAlias: row.materialAlias,
      materialImageUrl: row.materialImageUrl,
      materialUnit: difference?.unit || "\u7C73"
    },
    patternIdentity: {
      patternFileName: difference?.patternFileName || row.materialAttr || "\u7EB8\u6837\u5F85\u8865",
      patternVersion: "\u6280\u672F\u5305\u5F53\u524D\u7248",
      effectiveWidthText: "\u6309\u88C1\u7247\u5355\u7EB8\u6837\u5E45\u5BBD"
    },
    plannedValue,
    actualValue,
    differenceValue,
    unit: difference?.unit || "\u7C73",
    evidenceItems: buildReviewEvidenceItems(row),
    pdaFeedbackId: feedback?.writebackId || "",
    reviewStatus: resolveReviewItemStatus(row),
    reviewResult: row.review?.reviewResult || "",
    nextAction: row.review?.nextAction || "",
    linkedLedgerEventIds: [...row.linkedLedgerEventIds],
    closeCutOrderRequired: row.review?.reviewResult === "\u5173\u95ED\u88C1\u7247\u5355",
    closeReasonCode: row.review?.closeReasonCode || "",
    closeReasonText: row.review?.closeReason || "",
    createdAt: row.createdAt,
    createdBy: difference?.detectedBy || feedback?.operatorName || "\u7CFB\u7EDF",
    reviewedAt: row.review?.reviewedAt || "",
    reviewedBy: row.review?.reviewedBy || "",
    remark: row.review?.note || row.note
  };
}
function buildSeedReplenishmentReviews(differences) {
  const usedResults = /* @__PURE__ */ new Set();
  const resultByDifferenceType = {
    \u9762\u6599\u4F59\u989D\u4E0D\u8DB3: "\u9700\u8981\u8865\u6599",
    \u5B9E\u9645\u7528\u91CF\u5DEE\u5F02: "\u9700\u8981\u8865\u5F55",
    \u5B9E\u94FA\u5C0F\u4E8E\u8BA1\u5212: "\u7EE7\u7EED\u8865\u6392",
    \u5B9E\u88C1\u5C0F\u4E8E\u8BA1\u5212: "\u5173\u95ED\u88C1\u7247\u5355",
    \u5377\u8BB0\u5F55\u5F02\u5E38: "\u4EC5\u8BB0\u5F55\u5DEE\u5F02"
  };
  return differences.map((difference) => {
    const result = resultByDifferenceType[difference.differenceType];
    if (!result || usedResults.has(result)) return null;
    usedResults.add(result);
    const nextAction = resolveNextActionFromReviewResult(result);
    return {
      reviewId: `seed-review-${difference.linkedReplenishmentId}`,
      suggestionId: difference.linkedReplenishmentId,
      reviewStatus: resolveReviewStatusFromResult(result),
      reviewResult: result,
      nextAction,
      closeReasonCode: result === "\u5173\u95ED\u88C1\u7247\u5355" ? "BUSINESS_STOP_RECUT" : void 0,
      closeReason: result === "\u5173\u95ED\u88C1\u7247\u5355" ? "\u4E1A\u52A1\u786E\u8BA4\u4E0D\u518D\u8865\u88C1\uFF0C\u8FDB\u5165\u88C1\u7247\u5355\u5173\u95ED\u94FE\u8DEF\u3002" : "",
      linkedLedgerEventIds: result === "\u4EC5\u8BB0\u5F55\u5DEE\u5F02" ? [] : difference.linkedLedgerEventIds,
      reviewedBy: "\u7CFB\u7EDF\u9884\u7F6E\u5BA1\u6838",
      reviewedAt: difference.detectedAt,
      decisionReason: result === "\u9700\u8981\u8865\u6599" ? "\u9762\u6599\u4F59\u989D\u4E0D\u8DB3\uFF0C\u9700\u8981\u56DE\u5230\u4E2D\u8F6C\u4ED3\u914D\u6599\u6216\u88C1\u5E8A\u9886\u6599\u3002" : result === "\u9700\u8981\u8865\u5F55" ? "\u5B9E\u9645\u7528\u91CF\u5F02\u5E38\uFF0C\u5148\u8865\u5F55\u6216\u590D\u6838\u94FA\u5E03\u88C1\u526A\u6570\u636E\u3002" : result === "\u7EE7\u7EED\u8865\u6392" ? "\u5B9E\u94FA\u5C0F\u4E8E\u8BA1\u5212\u4F46\u4ECD\u53EF\u7EE7\u7EED\u8865\u6392\u3002" : result === "\u5173\u95ED\u88C1\u7247\u5355" ? "\u4E1A\u52A1\u51B3\u5B9A\u4E0D\u518D\u8865\u88C1\uFF0C\u5FC5\u987B\u8BB0\u5F55\u5173\u95ED\u539F\u56E0\u3002" : "\u5377\u8BB0\u5F55\u5F02\u5E38\u4EC5\u8BB0\u5F55\u5DEE\u5F02\uFF0C\u4E0D\u6539\u53D8\u6570\u91CF\u8D26\u3002",
      note: "\u7528\u4E8E\u539F\u578B\u8986\u76D6\u8865\u6599\u7BA1\u7406\u5BA1\u6838\u7ED3\u679C\u4E0E\u540E\u7EED\u52A8\u4F5C\u573A\u666F\u3002"
    };
  }).filter((review) => Boolean(review));
}
function buildFollowupProgressText(actions) {
  if (!actions.length) return "\u65E0\u9700\u540E\u7EED\u52A8\u4F5C";
  const completed = actions.filter((item) => ["DONE", "SKIPPED"].includes(item.status)).length;
  return `${completed}/${actions.length} \u5DF2\u5904\u7406`;
}
function buildStatusFilterAliases(status) {
  return [status];
}
function buildRiskMeta(riskLevel) {
  return replenishmentRiskMetaMap[riskLevel];
}
function buildReplenishmentAuditTrail(options) {
  return {
    auditTrailId: `audit-${options.suggestion.suggestionId}-${options.action}-${Date.now()}`,
    suggestionId: options.suggestion.suggestionId,
    action: options.action,
    actionAt: options.actionAt || nowText(),
    actionBy: options.actionBy,
    payloadSummary: options.payloadSummary,
    note: options.note || ""
  };
}
function serializeReplenishmentReviewsStorage(records) {
  return JSON["stringify"](records);
}
function deserializeReplenishmentReviewsStorage(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function serializeReplenishmentImpactPlansStorage(records) {
  return JSON["stringify"](records);
}
function deserializeReplenishmentImpactPlansStorage(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function serializeReplenishmentAuditTrailStorage(records) {
  return JSON["stringify"](records);
}
function deserializeReplenishmentAuditTrailStorage(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function serializeReplenishmentActionsStorage(records) {
  return JSON["stringify"](records);
}
function normalizeFollowupActionType(value) {
  const candidate = String(value || "");
  if (candidate === "CREATE_PENDING_PREP" || candidate === "SUPPLEMENT_BACKFILL" || candidate === "REPLAN_MARKER" || candidate === "CLOSE_CUT_ORDER" || candidate === "RECORD_ONLY") {
    return candidate;
  }
  return "CREATE_PENDING_PREP";
}
function normalizeFollowupTargetPageKey(value, actionType) {
  const candidate = String(value || "");
  if (candidate === "materialPrep" || candidate === "cuttablePool" || candidate === "cutOrders" || candidate === "markerSpreading" || candidate === "markerPlanRefs") {
    return candidate;
  }
  if (actionType === "CREATE_PENDING_PREP") return "materialPrep";
  if (actionType === "SUPPLEMENT_BACKFILL") return "markerSpreading";
  if (actionType === "REPLAN_MARKER") return "cuttablePool";
  return "cutOrders";
}
function deserializeReplenishmentActionsStorage(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const normalized = parsed.filter((item) => Boolean(item) && typeof item === "object").map((item) => {
      const suggestionId = String(item.suggestionId || "").trim();
      if (!suggestionId) return null;
      const actionType = normalizeFollowupActionType(item.actionType);
      const targetPageKey = normalizeFollowupTargetPageKey(item.targetPageKey, actionType);
      const actionMeta = replenishmentFollowupActionTypeMetaMap[actionType];
      return {
        actionId: String(item.actionId || `${suggestionId}-${actionType}`).trim() || `${suggestionId}-${actionType}`,
        suggestionId,
        actionType,
        title: String(item.title || actionMeta.label).trim() || actionMeta.label,
        status: ["PENDING", "CONFIRMED", "SKIPPED", "DONE"].includes(String(item.status || "")) ? item.status : "PENDING",
        targetPageKey,
        targetPath: buildActionTargetPath(targetPageKey),
        targetQuery: item.targetQuery && typeof item.targetQuery === "object" ? item.targetQuery : {},
        note: String(item.note || "").trim() || (actionType === "CREATE_PENDING_PREP" ? "\u786E\u8BA4\u9700\u8981\u8865\u6599\u540E\uFF0C\u56DE\u5230\u4E2D\u8F6C\u4ED3\u914D\u6599\u5E76\u7531\u88C1\u5E8A\u518D\u6B21\u9886\u6599\u3002" : actionType === "SUPPLEMENT_BACKFILL" ? "\u786E\u8BA4\u9700\u8981\u8865\u5F55\u540E\uFF0C\u8865\u9F50\u94FA\u5E03\u6216\u88C1\u526A\u5B9E\u9645\u6570\u636E\u3002" : actionType === "REPLAN_MARKER" ? "\u786E\u8BA4\u7EE7\u7EED\u8865\u6392\u540E\uFF0C\u56DE\u5230\u53EF\u6392\u551B\u67B6\u88C1\u7247\u5355\u3002" : actionType === "CLOSE_CUT_ORDER" ? "\u786E\u8BA4\u4E0D\u518D\u8865\u88C1\u540E\uFF0C\u5173\u95ED\u88C1\u7247\u5355\u5E76\u4FDD\u7559\u5173\u95ED\u539F\u56E0\u3002" : "\u4EC5\u4FDD\u7559\u5DEE\u5F02\u8BB0\u5F55\uFF0C\u4E0D\u6539\u53D8\u6570\u91CF\u8D26\u3002"),
        decidedAt: String(item.decidedAt || "").trim(),
        decidedBy: String(item.decidedBy || "").trim(),
        completedAt: String(item.completedAt || "").trim(),
        completedBy: String(item.completedBy || "").trim()
      };
    }).filter((item) => Boolean(item));
    return Object.values(
      normalized.reduce((accumulator, item) => {
        const existing = accumulator[item.suggestionId];
        if (!existing) {
          accumulator[item.suggestionId] = item;
          return accumulator;
        }
        const existingRank = existing.status === "DONE" ? 4 : existing.status === "CONFIRMED" ? 3 : existing.status === "SKIPPED" ? 2 : 1;
        const nextRank = item.status === "DONE" ? 4 : item.status === "CONFIRMED" ? 3 : item.status === "SKIPPED" ? 2 : 1;
        accumulator[item.suggestionId] = nextRank >= existingRank ? item : existing;
        return accumulator;
      }, {})
    );
  } catch {
    return [];
  }
}
function buildReplenishmentViewModel(options) {
  const cutOrderRowsById = Object.fromEntries(options.cutOrderRows.map((row) => [row.cutOrderId, row]));
  const impactsBySuggestionId = Object.fromEntries(options.impactPlans.map((plan) => [plan.suggestionId, plan]));
  const actionsBySuggestionId = options.actions.reduce((accumulator, action) => {
    accumulator[action.suggestionId] = accumulator[action.suggestionId] || [];
    accumulator[action.suggestionId].push(action);
    return accumulator;
  }, {});
  const pdaFeedbackWritebacks = options.pdaFeedbackWritebacks ?? listPdaReplenishmentFeedbackWritebacks(getBrowserLocalStorage() || void 0);
  const spreadingDifferences = listSpreadingDifferences({ sessions: options.markerStore.sessions });
  const reviewsBySuggestionId = Object.fromEntries(
    [...buildSeedReplenishmentReviews(spreadingDifferences), ...options.reviews].map((review) => [review.suggestionId, review])
  );
  const contexts = buildReplenishmentContextRecords({
    materialPrepRows: options.materialPrepRows,
    cutOrderRows: options.cutOrderRows,
    markerPlanRefs: options.markerPlanRefs,
    markerStore: options.markerStore
  });
  const rows = contexts.map((context, index) => {
    const suggestion = buildReplenishmentSuggestionFromContext({
      index,
      context,
      cutOrderRowsById
    });
    const navigationPayload = buildReplenishmentNavigationPayload(suggestion);
    const review = reviewsBySuggestionId[suggestion.suggestionId] || null;
    const followupActions = mergeStoredActions({
      suggestion,
      context,
      navigationPayload,
      storedActions: actionsBySuggestionId[suggestion.suggestionId] || []
    });
    const impactPlan = buildImpactPlanFromActions({
      suggestion,
      actions: followupActions,
      review
    });
    const statusMeta = deriveStatusMeta({
      suggestion,
      review,
      actions: followupActions
    });
    const riskMeta = buildRiskMeta(suggestion.riskLevel);
    const sourceLabel = replenishmentSourceMeta[suggestion.sourceType].label;
    const followupActionCount = followupActions.length;
    const pendingActionCount = followupActions.filter((item) => !["DONE", "SKIPPED"].includes(item.status)).length;
    const completedActionCount = followupActions.filter((item) => item.status === "DONE").length;
    const skippedActionCount = followupActions.filter((item) => item.status === "SKIPPED").length;
    const matchedPdaFeedbacks = pdaFeedbackWritebacks.filter((feedback) => matchesPdaFeedbackWithSuggestion(feedback, suggestion));
    const latestPdaFeedback = matchedPdaFeedbacks[0] ?? null;
    const latestPdaFeedbackSummary = buildPdaFeedbackSummary(latestPdaFeedback);
    const matchedDifferences = spreadingDifferences.filter(
      (difference) => matchesSpreadingDifferenceWithSuggestion(difference, suggestion, context)
    );
    const claimedBalanceLength = buildClaimedBalanceLength(suggestion);
    const materialGapLength = buildMaterialGapLength(suggestion);
    const nextOptions = buildReplenishmentNextOptions(suggestion);
    const effectiveStatusMeta = (latestPdaFeedback || matchedDifferences.length > 0) && ["NO_ACTION", "COMPLETED", "REJECTED"].includes(statusMeta.key) ? replenishmentStatusMetaMap.PENDING_REVIEW : statusMeta;
    const linkedLedgerEventIds = collectLinkedLedgerEventIds(matchedDifferences, review);
    const row = {
      ...suggestion,
      context,
      sourceDifferences: matchedDifferences,
      sourceDifferenceCount: matchedDifferences.length,
      differenceTypeSummary: summarizeDifferenceTypes(matchedDifferences),
      handlingStatusLabel: buildHandlingStatusLabel(matchedDifferences, review),
      reviewResultLabel: buildReviewResultLabel(review),
      nextActionLabel: buildNextActionLabel(review, nextOptions),
      closeReason: review?.closeReason || "",
      linkedLedgerEventIds,
      sourceLabel,
      sourceSummary: buildSourceSummary(context),
      sourceProductionSummary: context.productionOrderNos.join(" / ") || "\u5F85\u8865",
      sourceOrderSummary: context.baseSourceType === "marker-plan-ref" ? `${context.markerPlanNo || "\u5F85\u8865\u551B\u67B6\u65B9\u6848\u53F7"} \xB7 ${context.cutOrderNos.join(" / ")}` : context.cutOrderNos.join(" / ") || "\u5F85\u8865",
      differenceSummary: buildDifferenceSummaryFromDifferences(matchedDifferences, buildDifferenceSummary(suggestion)),
      majorGapSummary: buildMajorGapSummaryFromDifferences(matchedDifferences, buildMajorGapSummary(suggestion)),
      review,
      reviewSummary: buildReviewSummary(review),
      reviewStatusLabel: buildReviewSummary(review),
      impactPlan,
      followupActions,
      followupActionCount,
      pendingActionCount,
      completedActionCount,
      skippedActionCount,
      followupProgressText: buildFollowupProgressText(followupActions),
      pdaFeedbacks: matchedPdaFeedbacks,
      pendingPdaFeedbackCount: matchedPdaFeedbacks.length,
      latestPdaFeedback,
      latestPdaFeedbackSummary,
      claimedBalanceLength,
      materialGapLength,
      nextOptions,
      nextActionSummary: buildNextActionSummary(nextOptions),
      statusMeta: effectiveStatusMeta,
      riskMeta,
      navigationPayload,
      blockingSummary: "",
      keywordIndex: lowerKeywordIndex([
        suggestion.suggestionNo,
        ...suggestion.cutOrderNos,
        suggestion.markerPlanNo,
        ...suggestion.productionOrderNos,
        ...suggestion.materialSkus,
        suggestion.materialAlias,
        suggestion.styleCode,
        suggestion.spuCode,
        buildNextActionSummary(nextOptions),
        summarizeDifferenceTypes(matchedDifferences),
        review?.reviewResult,
        review?.nextAction,
        review?.closeReason,
        ...matchedDifferences.flatMap((difference) => [
          difference.differenceId,
          difference.spreadingOrderNo,
          difference.differenceType,
          difference.handlingStatus,
          difference.evidence.summary
        ]),
        ...context.materialRows.flatMap((item) => item.materialLineItems.map((line) => line.materialAlias)),
        ...context.materialRows.flatMap((item) => item.materialLineItems.map((line) => line.materialAttr))
      ])
    };
    return {
      ...row,
      blockingSummary: buildBlockingSummary(row)
    };
  }).filter((row) => row.sourceDifferences.length > 0 || row.pdaFeedbacks.length > 0 || Boolean(row.review) || row.followupActions.length > 0);
  const matchedFeedbackIds = new Set(rows.flatMap((row) => row.pdaFeedbacks.map((item) => item.writebackId)));
  const unmatchedFeedbackRows = pdaFeedbackWritebacks.filter((feedback) => !matchedFeedbackIds.has(feedback.writebackId)).map((feedback) => buildSyntheticFeedbackRow(feedback));
  const matchedDifferenceIds = new Set(rows.flatMap((row) => row.sourceDifferences.map((item) => item.differenceId)));
  const unmatchedDifferenceRows = spreadingDifferences.filter((difference) => !matchedDifferenceIds.has(difference.differenceId)).map((difference) => {
    const row = buildSyntheticDifferenceRow(difference);
    return applyReviewToSyntheticDifferenceRow(row, reviewsBySuggestionId[row.suggestionId]);
  });
  const allRows = [...rows, ...unmatchedFeedbackRows, ...unmatchedDifferenceRows].sort(
    (left, right) => right.createdAt.localeCompare(left.createdAt, "zh-CN")
  );
  const rowsBySuggestionId = Object.fromEntries(allRows.map((row) => [row.suggestionId, row]));
  return {
    rows: allRows,
    rowsById: rowsBySuggestionId,
    stats: {
      totalCount: allRows.length,
      pendingReviewCount: allRows.filter((row) => row.statusMeta.key === "PENDING_REVIEW").length,
      pendingSupplementCount: allRows.filter((row) => row.statusMeta.key === "PENDING_SUPPLEMENT").length,
      approvedPendingActionCount: allRows.filter((row) => row.statusMeta.key === "APPROVED_PENDING_ACTION").length,
      inActionCount: allRows.filter((row) => row.statusMeta.key === "IN_ACTION").length,
      rejectedCount: allRows.filter((row) => row.statusMeta.key === "REJECTED").length,
      completedCount: allRows.filter((row) => row.statusMeta.key === "COMPLETED").length,
      highRiskCount: allRows.filter((row) => row.riskLevel === "HIGH").length,
      waitNextPickupCount: allRows.filter((row) => row.nextOptions.some((item) => item.key === "WAIT_NEXT_PICKUP")).length,
      replanReadyCount: allRows.filter((row) => row.nextOptions.some((item) => item.key === "REPLAN_MARKER")).length,
      closeCandidateCount: allRows.filter((row) => row.nextOptions.some((item) => item.key === "CLOSE_CUT_ORDER")).length
    }
  };
}
function filterReplenishmentRows(rows, filters, prefilter) {
  const keyword = filters.keyword.trim().toLowerCase();
  return rows.filter((row) => {
    if (prefilter?.spreadingSessionId || prefilter?.spreadingOrderId) {
      const matchesSpreading = row.sourceDifferences.some((difference) => matchesSpreadingDifferenceWithPrefilter(difference, prefilter)) || row.context.session?.spreadingSessionId === prefilter.spreadingSessionId || row.context.session?.sessionNo === prefilter.spreadingSessionId || row.context.session?.spreadingSessionId === prefilter.spreadingOrderId || row.context.session?.sessionNo === prefilter.spreadingOrderId;
      if (!matchesSpreading) return false;
      if (keyword && !row.keywordIndex.some((item) => item.includes(keyword))) return false;
      if (filters.sourceType !== "ALL" && row.sourceType !== filters.sourceType) return false;
      if (filters.status !== "ALL" && row.statusMeta.key !== filters.status) return false;
      if (filters.riskLevel !== "ALL" && row.riskLevel !== filters.riskLevel) return false;
      if (filters.pendingReviewOnly && !["PENDING_REVIEW", "PENDING_SUPPLEMENT"].includes(row.statusMeta.key)) return false;
      if (filters.pendingActionOnly && !["APPROVED_PENDING_ACTION", "IN_ACTION"].includes(row.statusMeta.key)) return false;
      return true;
    }
    if (prefilter?.suggestionId && row.suggestionId !== prefilter.suggestionId) return false;
    if (prefilter?.suggestionNo && row.suggestionNo !== prefilter.suggestionNo) return false;
    if (prefilter?.cutOrderNo && !row.cutOrderNos.includes(prefilter.cutOrderNo)) return false;
    if (prefilter?.cutOrderId && !row.cutOrderIds.includes(prefilter.cutOrderId)) return false;
    if (prefilter?.markerPlanNo && row.markerPlanNo !== prefilter.markerPlanNo) return false;
    if (prefilter?.markerPlanId && row.markerPlanId !== prefilter.markerPlanId) return false;
    if (prefilter?.productionOrderNo && !row.productionOrderNos.includes(prefilter.productionOrderNo)) return false;
    if (prefilter?.materialSku && !row.materialSkus.includes(prefilter.materialSku)) return false;
    if (prefilter?.color && !row.lines.some((line) => line.color === prefilter.color)) return false;
    if ((prefilter?.spreadingSessionId || prefilter?.spreadingOrderId) && !row.sourceDifferences.some((difference) => matchesSpreadingDifferenceWithPrefilter(difference, prefilter)) && row.context.session?.spreadingSessionId !== prefilter.spreadingSessionId && row.context.session?.sessionNo !== prefilter.spreadingSessionId && row.context.session?.spreadingSessionId !== prefilter.spreadingOrderId && row.context.session?.sessionNo !== prefilter.spreadingOrderId) {
      return false;
    }
    if (prefilter?.riskLevel && row.riskLevel !== prefilter.riskLevel) return false;
    if (prefilter?.replenishmentStatus && !buildStatusFilterAliases(prefilter.replenishmentStatus).includes(row.statusMeta.key)) {
      return false;
    }
    if (keyword && !row.keywordIndex.some((item) => item.includes(keyword))) return false;
    if (filters.sourceType !== "ALL" && row.sourceType !== filters.sourceType) return false;
    if (filters.status !== "ALL" && row.statusMeta.key !== filters.status) return false;
    if (filters.riskLevel !== "ALL" && row.riskLevel !== filters.riskLevel) return false;
    if (filters.pendingReviewOnly && !["PENDING_REVIEW", "PENDING_SUPPLEMENT"].includes(row.statusMeta.key)) return false;
    if (filters.pendingActionOnly && !["APPROVED_PENDING_ACTION", "IN_ACTION"].includes(row.statusMeta.key)) return false;
    return true;
  });
}
function findReplenishmentByPrefilter(rows, prefilter) {
  if (!prefilter) return null;
  if (prefilter.spreadingSessionId || prefilter.spreadingOrderId) {
    return rows.find(
      (row) => row.sourceDifferences.some((difference) => matchesSpreadingDifferenceWithPrefilter(difference, prefilter)) || row.context.session?.spreadingSessionId === prefilter.spreadingSessionId || row.context.session?.sessionNo === prefilter.spreadingSessionId || row.context.session?.spreadingSessionId === prefilter.spreadingOrderId || row.context.session?.sessionNo === prefilter.spreadingOrderId
    ) || null;
  }
  return rows.find((row) => {
    if (prefilter.suggestionId && row.suggestionId === prefilter.suggestionId) return true;
    if (prefilter.suggestionNo && row.suggestionNo === prefilter.suggestionNo) return true;
    if (prefilter.cutOrderNo && row.cutOrderNos.includes(prefilter.cutOrderNo)) return true;
    if (prefilter.cutOrderId && row.cutOrderIds.includes(prefilter.cutOrderId)) return true;
    if (prefilter.markerPlanNo && row.markerPlanNo === prefilter.markerPlanNo) return true;
    if (prefilter.markerPlanId && row.markerPlanId === prefilter.markerPlanId) return true;
    if (prefilter.productionOrderNo && row.productionOrderNos.includes(prefilter.productionOrderNo)) return true;
    if (prefilter.materialSku && row.materialSkus.includes(prefilter.materialSku)) return true;
    if (prefilter.color && row.lines.some((line) => line.color === prefilter.color)) return true;
    if ((prefilter.spreadingSessionId || prefilter.spreadingOrderId) && (row.sourceDifferences.some((difference) => matchesSpreadingDifferenceWithPrefilter(difference, prefilter)) || row.context.session?.spreadingSessionId === prefilter.spreadingSessionId || row.context.session?.sessionNo === prefilter.spreadingSessionId || row.context.session?.spreadingSessionId === prefilter.spreadingOrderId || row.context.session?.sessionNo === prefilter.spreadingOrderId)) {
      return true;
    }
    return false;
  }) || null;
}
export {
  buildReplenishmentAuditTrail,
  buildReplenishmentFollowupActionForResult,
  buildReplenishmentReviewItem,
  buildReplenishmentSuggestionFromContext,
  buildReplenishmentViewModel,
  deriveReplenishmentRiskLevel,
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
};
