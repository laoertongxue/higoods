import { DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES } from "./cutting-table-resource.ts";
import {
  buildMarkerSeedDraft,
  buildMarkerSpreadingNavigationPayload,
  buildSpreadingReplenishmentWarning,
  buildMarkerWarningMessages,
  buildSpreadingVarianceSummary,
  buildSpreadingWarningMessages,
  computeActualCutQty,
  computeOperatorHandledLayerCount,
  computeOperatorHandledPieceQty,
  computeLengthVariance,
  computeHighLowCuttingTotals,
  computeHighLowPatternTotals,
  computeMarkerTotalPieces,
  computeRemainingLength,
  computeRollActualCutGarmentQty,
  computeRollActualCutPieceQty,
  computeShortageQty,
  computeSinglePieceUsage,
  computeTheoreticalCutQty,
  computeNormalMarkerSpreadTotalLength,
  computeUsableLength,
  computeUsageSummary,
  buildRollHandoverViewModel,
  buildSpreadingHandoverListSummary,
  createEmptyStore,
  createOperatorRecordDraft,
  createRollRecordDraft,
  createSpreadingDraftFromMarker,
  DEFAULT_HIGH_LOW_PATTERN_KEYS,
  findSpreadingPlanUnitById,
  deriveMarkerTemplateByMode,
  deriveMarkerModeMeta,
  deriveSpreadingColorSummary,
  deriveSpreadingModeMeta,
  deserializeMarkerSpreadingStorage,
  buildRollActualCutGarmentQtyFormula,
  MARKER_SIZE_KEYS,
  summarizeSpreadingRolls,
  summarizeSpreadingOperatorAmounts,
  summarizeSpreadingOperators,
  validateMarkerModeShape,
  buildOperatorAmountWarnings
} from "./marker-spreading-model.ts";
import { buildMarkerSpreadingProjection } from "./marker-spreading-projection.ts";
import {
  buildMarkerAllocationSourceRows,
  buildMarkerPieceExplosionViewModel
} from "./marker-piece-explosion.ts";
function buildSessionContext(session, cutOrderRows, batch) {
  if (!cutOrderRows.length && !session.markerPlanId && !session.cutOrderIds.length) return null;
  return {
    contextType: session.contextType,
    cutOrderIds: [...session.cutOrderIds],
    cutOrderNos: cutOrderRows.map((row) => row.cutOrderNo),
    markerPlanId: session.markerPlanId || batch?.markerPlanId || "",
    markerPlanNo: session.markerPlanNo || batch?.markerPlanNo || "",
    productionOrderNos: uniqueStrings(cutOrderRows.map((row) => row.productionOrderNo)),
    styleCode: session.styleCode || cutOrderRows[0]?.styleCode || batch?.styleCode || "",
    spuCode: session.spuCode || cutOrderRows[0]?.spuCode || batch?.spuCode || "",
    techPackSpuCode: uniqueStrings(cutOrderRows.map((row) => row.techPackSpuCode)).length === 1 ? uniqueStrings(cutOrderRows.map((row) => row.techPackSpuCode))[0] : "",
    styleName: batch?.styleName || cutOrderRows[0]?.styleName || "",
    materialSkuSummary: session.materialSkuSummary || batch?.materialSkuSummary || uniqueStrings(cutOrderRows.map((row) => row.materialSkuSummary)).join(" / "),
    materialAliasSummary: uniqueStrings(cutOrderRows.flatMap((row) => row.materialLineItems.map((line) => line.materialAlias))).join(" / "),
    materialImageUrl: cutOrderRows.flatMap((row) => row.materialLineItems).find((line) => line.materialImageUrl)?.materialImageUrl || "",
    materialPrepRows: cutOrderRows
  };
}
function uniqueStrings(values) {
  return Array.from(new Set(values.filter((value) => Boolean(value))));
}
function getCompletedLinkedCutOrderIds(session) {
  if (session.completionLinkage?.linkedCutOrderIds?.length) {
    return session.completionLinkage.linkedCutOrderIds;
  }
  if (session.status === "DONE" && session.contextType === "cut-order") {
    return [...session.cutOrderIds];
  }
  return [];
}
function nowText(input = /* @__PURE__ */ new Date()) {
  const year = input.getFullYear();
  const month = `${input.getMonth() + 1}`.padStart(2, "0");
  const day = `${input.getDate()}`.padStart(2, "0");
  const hours = `${input.getHours()}`.padStart(2, "0");
  const minutes = `${input.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
function buildCutOrderContext(row) {
  return {
    contextType: "cut-order",
    cutOrderIds: [row.cutOrderId],
    cutOrderNos: [row.cutOrderNo],
    markerPlanId: row.markerPlanIds[0] || "",
    markerPlanNo: row.latestMarkerPlanNo || row.markerPlanNos[0] || "",
    productionOrderNos: [row.productionOrderNo],
    styleCode: row.styleCode,
    spuCode: row.spuCode,
    techPackSpuCode: row.techPackSpuCode || "",
    styleName: row.styleName,
    materialSkuSummary: row.materialSkuSummary,
    materialAliasSummary: uniqueStrings(row.materialLineItems.map((line) => line.materialAlias)).join(" / "),
    materialImageUrl: row.materialLineItems.find((line) => line.materialImageUrl)?.materialImageUrl || "",
    materialPrepRows: [row]
  };
}
function buildMarkerPlanRefContext(batch, rowsById) {
  const materialPrepRows = batch.items.map((item) => rowsById[item.cutOrderId]).filter((row) => Boolean(row));
  if (!materialPrepRows.length) return null;
  return {
    contextType: "marker-plan-ref",
    cutOrderIds: materialPrepRows.map((row) => row.cutOrderId),
    cutOrderNos: materialPrepRows.map((row) => row.cutOrderNo),
    markerPlanId: batch.markerPlanId,
    markerPlanNo: batch.markerPlanNo,
    productionOrderNos: uniqueStrings(materialPrepRows.map((row) => row.productionOrderNo)),
    styleCode: batch.styleCode || materialPrepRows[0]?.styleCode || "",
    spuCode: batch.spuCode || materialPrepRows[0]?.spuCode || "",
    techPackSpuCode: uniqueStrings(materialPrepRows.map((row) => row.techPackSpuCode)).length === 1 ? uniqueStrings(materialPrepRows.map((row) => row.techPackSpuCode))[0] : "",
    styleName: batch.styleName || materialPrepRows[0]?.styleName || "",
    materialSkuSummary: batch.materialSkuSummary || uniqueStrings(materialPrepRows.map((row) => row.materialSkuSummary)).join(" / "),
    materialAliasSummary: uniqueStrings(materialPrepRows.flatMap((row) => row.materialLineItems.map((line) => line.materialAlias))).join(" / "),
    materialImageUrl: materialPrepRows.flatMap((row) => row.materialLineItems).find((line) => line.materialImageUrl)?.materialImageUrl || "",
    materialPrepRows
  };
}
const SEED_SESSION_MATRIX = [
  [
    { code: "waiting-start-a", status: "DRAFT" }
  ],
  [
    {
      code: "in-progress-b",
      status: "IN_PROGRESS",
      sourceChannel: "PDA_WRITEBACK",
      sourceWritebackId: "pda-sync-failed-in-progress-b",
      scenarioNote: "PDA \u5DF2\u5199\u56DE\u90E8\u5206\u5377\u8BB0\u5F55\uFF0C\u4F46\u540C\u6B65\u5931\u8D25\uFF0C\u7B49\u5F85 Web \u590D\u6838\u3002"
    }
  ],
  [
    { code: "waiting-cutting-b", status: "DONE", cuttingStatus: "WAITING_CUTTING" }
  ],
  [
    { code: "cutting-b", status: "DONE", cuttingStatus: "CUTTING" }
  ],
  [
    {
      code: "planned-100-actual-80-c",
      status: "DONE",
      cuttingStatus: "CUTTING_DONE",
      plannedLayerCount: 100,
      actualLayerCounts: [50, 30],
      scenarioNote: "\u8BA1\u5212\u94FA 100 \u5C42\uFF0C\u73B0\u573A\u6309\u5DF2\u9886\u9762\u6599\u5148\u5B9E\u94FA 80 \u5C42\u5E76\u5B8C\u6210\u88C1\u526A\u3002"
    },
    {
      code: "second-replan-after-pickup-c",
      status: "DONE",
      cuttingStatus: "CUTTING_DONE",
      plannedLayerCount: 40,
      actualLayerCounts: [24, 16],
      scenarioNote: "\u7B2C\u4E8C\u6B21\u9886\u6599\u540E\u8865\u6392\u551B\u67B6\uFF0C\u7EE7\u7EED\u6309\u53EF\u7528\u9886\u6599\u4F59\u989D\u94FA\u5E03\u88C1\u526A\u3002"
    }
  ],
  [
    {
      code: "pda-sync-failed-h",
      status: "IN_PROGRESS",
      sourceChannel: "PDA_WRITEBACK",
      sourceWritebackId: "pda-sync-failed-h",
      plannedLayerCount: 60,
      actualLayerCounts: [42],
      scenarioNote: "PDA \u5199\u56DE\u5DF2\u5230\u8FBE Web\uFF0C\u4F46\u540C\u6B65\u5931\u8D25\uFF0C\u7B49\u5F85\u4E3B\u7BA1\u590D\u6838\u3002"
    }
  ]
];
const SEED_SESSION_OWNERS = [
  { ownerAccountId: "supervisor-liufang", ownerName: "\u94FA\u5E03\u4E3B\u7BA1-\u5218\u82B3" },
  { ownerAccountId: "supervisor-zhouwei", ownerName: "\u94FA\u5E03\u4E3B\u7BA1-\u5468\u4F1F" },
  { ownerAccountId: "planner-chenjing", ownerName: "\u8BA1\u5212\u5458-\u9648\u9759" }
];
function sanitizeSeedKey(value) {
  return value.trim().replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "na";
}
function formatSeedDateTimeLocal(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
function parseSeedDate(value) {
  if (!value) return null;
  const parsed = new Date(value.includes("T") ? value : value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
function ensureSpreadingScheduleDefaults(session, index) {
  const operatorStartTimes = (session.operators || []).map((operator) => operator.startAt).filter(Boolean).sort((left, right) => left.localeCompare(right, "zh-CN"));
  const operatorEndTimes = (session.operators || []).map((operator) => operator.endAt).filter(Boolean).sort((left, right) => right.localeCompare(left, "zh-CN"));
  const shouldHaveCuttingStartedAt = session.cuttingStatus === "CUTTING" || session.cuttingStatus === "CUTTING_DONE";
  const shouldHaveCuttingFinishedAt = session.cuttingStatus === "CUTTING_DONE";
  if (session.plannedStartAt && session.plannedEndAt && session.ownerName && session.actualStartAt && (session.status !== "DONE" || session.actualEndAt) && (!shouldHaveCuttingStartedAt || session.cuttingStartedAt) && (!shouldHaveCuttingFinishedAt || session.cuttingFinishedAt)) {
    return session;
  }
  const baseDate = parseSeedDate(session.plannedStartAt) || parseSeedDate(session.createdAt) || parseSeedDate(session.updatedAt) || /* @__PURE__ */ new Date(`2026-03-${String(10 + index % 8).padStart(2, "0")}T09:00:00`);
  const endDate = new Date(baseDate);
  endDate.setMinutes(endDate.getMinutes() + (session.estimatedDurationMinutes || DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES));
  const owner = SEED_SESSION_OWNERS[index % SEED_SESSION_OWNERS.length];
  const isUnstartedDraft = session.status === "DRAFT" && !session.plannedStartAt && !session.cuttingTableId;
  return {
    ...session,
    plannedStartAt: isUnstartedDraft ? "" : session.plannedStartAt || formatSeedDateTimeLocal(baseDate),
    plannedEndAt: isUnstartedDraft ? "" : session.plannedEndAt || formatSeedDateTimeLocal(endDate),
    estimatedDurationMinutes: session.estimatedDurationMinutes || DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES,
    tableScheduleStatus: isUnstartedDraft ? session.tableScheduleStatus || "\u672A\u6392\u7A0B" : session.tableScheduleStatus || "\u5DF2\u6392\u7A0B",
    ownerAccountId: isUnstartedDraft ? session.ownerAccountId || "" : session.ownerAccountId || owner.ownerAccountId,
    ownerName: isUnstartedDraft ? session.ownerName || "" : session.ownerName || owner.ownerName,
    actualStartAt: session.actualStartAt || (session.status !== "DRAFT" ? operatorStartTimes[0] || session.updatedFromPdaAt || "" : ""),
    actualEndAt: session.actualEndAt || (session.status === "DONE" ? session.completionLinkage?.completedAt || operatorEndTimes[0] || session.updatedAt || "" : ""),
    cuttingStartedAt: session.cuttingStartedAt || (shouldHaveCuttingStartedAt ? session.cuttingStatusUpdatedAt || session.updatedAt || "" : ""),
    cuttingFinishedAt: session.cuttingFinishedAt || (shouldHaveCuttingFinishedAt ? session.cuttingStatusUpdatedAt || session.updatedAt || "" : "")
  };
}
function createSeedSession(marker, context, contextIndex, profile, profileIndex) {
  const seedDate = /* @__PURE__ */ new Date(`2026-03-${String(10 + contextIndex).padStart(2, "0")}T${String(9 + profileIndex * 2).padStart(2, "0")}:00:00`);
  const seedEndDate = new Date(seedDate);
  seedEndDate.setMinutes(seedEndDate.getMinutes() + DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES);
  const owner = SEED_SESSION_OWNERS[(contextIndex + profileIndex) % SEED_SESSION_OWNERS.length];
  const sessionKeyBase = context.contextType === "marker-plan-ref" ? context.markerPlanId || context.markerPlanNo : context.cutOrderIds[0] || context.cutOrderNos[0];
  const sessionId = `spreading-session-${context.contextType}-${sanitizeSeedKey(sessionKeyBase)}-${profile.code}`;
  const session = createSpreadingDraftFromMarker(marker, context, seedDate, {
    baseSession: {
      spreadingSessionId: sessionId,
      sessionNo: `PB-${String(2400 + contextIndex * 10 + profileIndex).padStart(4, "0")}`,
      status: profile.status,
      plannedStartAt: formatSeedDateTimeLocal(seedDate),
      plannedEndAt: formatSeedDateTimeLocal(seedEndDate),
      estimatedDurationMinutes: DEFAULT_MARKER_BED_SPREADING_DURATION_MINUTES,
      tableScheduleStatus: profile.status === "DONE" ? "\u5DF2\u5B8C\u6210" : profile.status === "IN_PROGRESS" ? "\u6267\u884C\u4E2D" : "\u5DF2\u6392\u7A0B",
      ownerAccountId: owner.ownerAccountId,
      ownerName: owner.ownerName,
      sourceChannel: profile.sourceChannel || "MANUAL",
      sourceWritebackId: profile.sourceWritebackId || "",
      updatedFromPdaAt: profile.sourceChannel === "PDA_WRITEBACK" ? nowText(seedDate) : ""
    }
  });
  const primaryMaterial = context.materialPrepRows[0]?.materialLineItems[0];
  const colors = uniqueStrings(context.materialPrepRows.map((row) => row.color));
  if (profile.plannedLayerCount && profile.plannedLayerCount > 0) {
    session.plannedLayers = profile.plannedLayerCount;
    session.planUnits = (session.planUnits || []).map((unit) => {
      const plannedRepeatCount = profile.plannedLayerCount || unit.plannedRepeatCount;
      const lengthPerUnitM = Number(unit.lengthPerUnitM || marker.markerLength || marker.netLength || 0);
      const plannedSpreadLengthM = Number(((lengthPerUnitM + 0.06) * plannedRepeatCount).toFixed(2));
      return {
        ...unit,
        plannedRepeatCount,
        plannedCutGarmentQty: Math.max(Number(unit.garmentQtyPerUnit || 0), 0) * plannedRepeatCount,
        plannedSpreadLengthM
      };
    });
    session.theoreticalActualCutPieceQty = session.planUnits.reduce(
      (sum, unit) => sum + Math.max(Number(unit.plannedCutGarmentQty || 0), 0),
      0
    );
    session.theoreticalSpreadTotalLength = session.planUnits.reduce(
      (sum, unit) => sum + Math.max(Number(unit.plannedSpreadLengthM || 0), 0),
      0
    );
  }
  const primaryPlanUnit = session.planUnits?.[0] || null;
  const secondaryPlanUnit = session.planUnits?.[1] || primaryPlanUnit;
  const rollA = createRollRecordDraft(session.spreadingSessionId, primaryMaterial?.materialSku || "");
  rollA.planUnitId = primaryPlanUnit?.planUnitId || "";
  rollA.sortOrder = 1;
  rollA.rollNo = `ROLL-${String(contextIndex + 1).padStart(2, "0")}${String(profileIndex + 1).padStart(2, "0")}A`;
  rollA.color = primaryPlanUnit?.color || colors[0] || "";
  rollA.materialSku = primaryPlanUnit?.materialSku || primaryMaterial?.materialSku || "";
  rollA.width = 160;
  rollA.labeledLength = 28 + contextIndex * 2 + profileIndex;
  rollA.actualLength = 27 + contextIndex * 2 + profileIndex;
  rollA.headLength = 0.6;
  rollA.tailLength = 0.4;
  rollA.layerCount = profile.actualLayerCounts?.[0] ?? 10 + contextIndex + profileIndex;
  rollA.totalLength = Number((rollA.actualLength + rollA.headLength + rollA.tailLength).toFixed(2));
  rollA.remainingLength = Number(Math.max(rollA.labeledLength - rollA.actualLength, 0).toFixed(2));
  rollA.actualCutPieceQty = computeRollActualCutGarmentQty(rollA.layerCount, primaryPlanUnit?.garmentQtyPerUnit || marker.totalPieces || 0);
  rollA.occurredAt = nowText(/* @__PURE__ */ new Date(`2026-03-${String(10 + contextIndex).padStart(2, "0")}T10:${String(profileIndex).padStart(2, "0")}:00`));
  rollA.operatorNames = ["\u5F20\u5E08\u5085"];
  rollA.usableLength = computeUsableLength(rollA.actualLength, rollA.headLength, rollA.tailLength);
  rollA.sourceChannel = profile.sourceChannel || "MANUAL";
  rollA.sourceWritebackId = profile.sourceWritebackId || "";
  rollA.updatedFromPdaAt = profile.sourceChannel === "PDA_WRITEBACK" ? rollA.occurredAt || nowText(seedDate) : "";
  const rollB = createRollRecordDraft(session.spreadingSessionId, primaryMaterial?.materialSku || "");
  rollB.planUnitId = secondaryPlanUnit?.planUnitId || "";
  rollB.sortOrder = 2;
  rollB.rollNo = `ROLL-${String(contextIndex + 1).padStart(2, "0")}${String(profileIndex + 1).padStart(2, "0")}B`;
  rollB.color = secondaryPlanUnit?.color || colors[1] || colors[0] || "";
  rollB.materialSku = secondaryPlanUnit?.materialSku || primaryMaterial?.materialSku || "";
  rollB.width = 160;
  rollB.labeledLength = 16 + contextIndex + profileIndex;
  rollB.actualLength = 15 + contextIndex + profileIndex;
  rollB.headLength = 0.5;
  rollB.tailLength = 0.3;
  rollB.layerCount = profile.actualLayerCounts?.[1] ?? 6 + contextIndex + profileIndex;
  rollB.totalLength = Number((rollB.actualLength + rollB.headLength + rollB.tailLength).toFixed(2));
  rollB.remainingLength = Number(Math.max(rollB.labeledLength - rollB.actualLength, 0).toFixed(2));
  rollB.actualCutPieceQty = computeRollActualCutGarmentQty(rollB.layerCount, secondaryPlanUnit?.garmentQtyPerUnit || marker.totalPieces || 0);
  rollB.occurredAt = nowText(/* @__PURE__ */ new Date(`2026-03-${String(10 + contextIndex).padStart(2, "0")}T13:${String(profileIndex).padStart(2, "0")}:00`));
  rollB.operatorNames = ["\u674E\u5E08\u5085", "\u738B\u5E08\u5085"];
  rollB.usableLength = computeUsableLength(rollB.actualLength, rollB.headLength, rollB.tailLength);
  rollB.handoverNotes = "\u540C\u5377\u672A\u94FA\u5B8C\uFF0C\u5348\u540E\u6362\u73ED\u7EE7\u7EED\u5B8C\u6210\u3002";
  rollB.sourceChannel = profile.sourceChannel || "MANUAL";
  rollB.sourceWritebackId = profile.sourceWritebackId || "";
  rollB.updatedFromPdaAt = profile.sourceChannel === "PDA_WRITEBACK" ? rollB.occurredAt || nowText(seedDate) : "";
  const operatorA = createOperatorRecordDraft(session.spreadingSessionId);
  operatorA.sortOrder = 1;
  operatorA.rollRecordId = rollA.rollRecordId;
  operatorA.operatorName = "\u5F20\u5E08\u5085";
  operatorA.operatorAccountId = "CUT001";
  operatorA.startAt = `2026-03-${String(10 + contextIndex).padStart(2, "0")} 09:00`;
  operatorA.endAt = `2026-03-${String(10 + contextIndex).padStart(2, "0")} 12:00`;
  operatorA.actionType = "\u5B8C\u6210\u94FA\u5E03";
  operatorA.startLayer = 1;
  operatorA.endLayer = rollA.layerCount;
  operatorA.handledLength = rollA.actualLength;
  const operatorB = createOperatorRecordDraft(session.spreadingSessionId);
  operatorB.sortOrder = 2;
  operatorB.rollRecordId = rollB.rollRecordId;
  operatorB.operatorName = "\u674E\u5E08\u5085";
  operatorB.operatorAccountId = "CUT002";
  operatorB.startAt = `2026-03-${String(10 + contextIndex).padStart(2, "0")} 13:00`;
  operatorB.endAt = `2026-03-${String(10 + contextIndex).padStart(2, "0")} 15:00`;
  operatorB.actionType = "\u4E2D\u9014\u4EA4\u63A5";
  operatorB.handoverFlag = true;
  operatorB.startLayer = 1;
  operatorB.endLayer = Math.max(Math.floor(rollB.layerCount / 2), 1);
  operatorB.handledLength = Number((rollB.actualLength * 0.45).toFixed(2));
  operatorB.note = "\u5148\u5B8C\u6210\u672C\u5377\u524D\u534A\u6BB5\u94FA\u5E03\u3002";
  operatorB.handoverNotes = "\u5348\u540E\u6362\u73ED\uFF0C\u5C06\u8BE5\u5377\u4EA4\u63A5\u7ED9\u738B\u5E08\u5085\u7EE7\u7EED\u94FA\u3002";
  const operatorC = createOperatorRecordDraft(session.spreadingSessionId);
  operatorC.sortOrder = 3;
  operatorC.rollRecordId = rollB.rollRecordId;
  operatorC.operatorName = "\u738B\u5E08\u5085";
  operatorC.operatorAccountId = "CUT003";
  operatorC.startAt = `2026-03-${String(10 + contextIndex).padStart(2, "0")} 15:00`;
  operatorC.endAt = `2026-03-${String(10 + contextIndex).padStart(2, "0")} 17:30`;
  operatorC.actionType = "\u5B8C\u6210\u94FA\u5E03";
  operatorC.handoverFlag = true;
  operatorC.startLayer = operatorB.endLayer + 1;
  operatorC.endLayer = rollB.layerCount;
  operatorC.handledLength = Number((rollB.actualLength - (operatorB.handledLength || 0)).toFixed(2));
  operatorC.previousOperatorName = operatorB.operatorName;
  operatorC.handoverAtLayer = operatorB.endLayer;
  operatorC.handoverAtLength = operatorB.handledLength;
  operatorC.note = "\u63A5\u624B\u5B8C\u6210\u672C\u5377\u5269\u4F59\u94FA\u5E03\u3002";
  operatorC.handoverNotes = "\u627F\u63A5\u674E\u5E08\u5085\u4EA4\u63A5\uFF0C\u7EE7\u7EED\u94FA\u81F3\u672C\u5377\u7ED3\u675F\u3002";
  const hasExecution = profile.status !== "DRAFT";
  const multiRoll = profile.status === "DONE";
  session.rolls = hasExecution ? multiRoll ? [rollA, rollB] : [rollA] : [];
  session.operators = hasExecution ? multiRoll ? [operatorA, operatorB, operatorC] : [operatorA] : [];
  session.status = profile.status;
  if (profile.status !== "DRAFT") {
    session.actualStartAt = formatSeedDateTimeLocal(seedDate);
  }
  if (profile.status === "DONE") {
    session.cuttingStatus = profile.cuttingStatus || "WAITING_CUTTING";
    session.actualEndAt = formatSeedDateTimeLocal(/* @__PURE__ */ new Date(`2026-03-${String(10 + contextIndex).padStart(2, "0")}T17:30:00`));
    if (session.cuttingStatus === "CUTTING" || session.cuttingStatus === "CUTTING_DONE") {
      session.cuttingStartedAt = formatSeedDateTimeLocal(/* @__PURE__ */ new Date(`2026-03-${String(10 + contextIndex).padStart(2, "0")}T18:00:00`));
    }
    if (session.cuttingStatus === "CUTTING_DONE") {
      session.cuttingFinishedAt = formatSeedDateTimeLocal(/* @__PURE__ */ new Date(`2026-03-${String(10 + contextIndex).padStart(2, "0")}T20:00:00`));
    }
  }
  session.actualCutPieceQty = session.rolls.reduce((sum, roll) => sum + Math.max(roll.actualCutPieceQty || 0, 0), 0);
  session.actualLayers = session.rolls.reduce((sum, roll) => sum + Math.max(roll.layerCount || 0, 0), 0);
  session.unitPrice = 0.46 + contextIndex * 0.04 + profileIndex * 0.01;
  session.note = profile.scenarioNote || (profile.status === "DRAFT" ? "\u5F53\u524D\u5F85\u94FA\u5E03\uFF0C\u5DF2\u5B8C\u6210\u94FA\u5E03\u521B\u5EFA\u4F46\u5C1A\u672A\u5F55\u5165\u5377\u8BB0\u5F55\u3002" : profile.status === "IN_PROGRESS" ? "\u5F53\u524D\u4ECD\u53EF\u7EE7\u7EED\u8865\u5F55\u5269\u4F59\u5377\u4E0E\u4EBA\u5458\u4EA4\u63A5\u3002" : "\u5F53\u524D\u94FA\u5E03\u8BB0\u5F55\u5DF2\u5B8C\u6210\u3002");
  session.updatedAt = nowText(/* @__PURE__ */ new Date(`2026-03-${String(10 + contextIndex).padStart(2, "0")}T18:${String(profileIndex).padStart(2, "0")}:00`));
  if (profile.status === "DONE") {
    session.cuttingStatusUpdatedAt = session.updatedAt;
    const warning = buildSpreadingReplenishmentWarning({
      context,
      session,
      markerTotalPieces: marker.totalPieces,
      cutOrderNos: context.cutOrderNos,
      productionOrderNos: context.productionOrderNos,
      materialAttr: context.materialPrepRows[0]?.materialLabel || "",
      createdAt: session.updatedAt,
      note: "\u5F53\u524D\u4E3A prototype \u5B8C\u6210\u6837\u4F8B\u3002"
    });
    session.replenishmentWarning = {
      ...warning,
      suggestedAction: "\u65E0\u9700\u8865\u6599",
      handled: true,
      shortageQty: 0,
      note: "prototype\uFF1A\u65E0\u9700\u8865\u6599"
    };
  }
  if (profile.status === "DONE") {
    session.completionLinkage = {
      completedAt: session.updatedAt,
      completedBy: profile.sourceChannel === "PDA_WRITEBACK" ? "\u5DE5\u5382\u7AEF\u56DE\u5199" : "\u73B0\u573A\u4E3B\u7BA1",
      linkedCutOrderIds: [...context.cutOrderIds],
      linkedCutOrderNos: [...context.cutOrderNos],
      generatedWarningId: session.replenishmentWarning?.warningId || `warning-${session.spreadingSessionId}`,
      generatedWarning: false,
      note: "\u5F53\u524D\u94FA\u5E03\u5DF2\u5B8C\u6210\u3002"
    };
  }
  return session;
}
function hasMarkerForContext(store, context) {
  if (context.contextType === "marker-plan-ref") {
    return store.markers.some((item) => item.contextType === "marker-plan-ref" && item.markerPlanId === context.markerPlanId);
  }
  return store.markers.some(
    (item) => item.contextType === "cut-order" && item.cutOrderIds[0] === context.cutOrderIds[0]
  );
}
function hasSessionById(store, spreadingSessionId) {
  return store.sessions.some((item) => item.spreadingSessionId === spreadingSessionId);
}
function summarizeMarkerLineItems(lineItems = []) {
  const totalLength = Number(lineItems.reduce((sum, item) => sum + Math.max(item.markerLength, 0), 0).toFixed(2));
  const totalPieces = lineItems.reduce((sum, item) => sum + Math.max(item.markerPieceCount ?? item.pieceCount ?? 0, 0), 0);
  const colorSummary = uniqueStrings(lineItems.map((item) => item.color)).join(" / ");
  return {
    lineCount: lineItems.length,
    colorSummary,
    totalLength,
    totalPieces,
    summaryText: lineItems.length ? `${lineItems.length} \u884C \xB7 ${colorSummary || "\u989C\u8272\u5F85\u8865"} \xB7 ${totalPieces} \u4EF6` : "\u5F53\u524D\u5C1A\u672A\u8865\u5F55\u551B\u67B6\u660E\u7EC6\u3002"
  };
}
function buildMarkerSpreadingPrototypeStore(options) {
  let nextStore = options.stored ? deserializeMarkerSpreadingStorage(JSON["stringify"](options.stored)) : createEmptyStore();
  const executableRows = options.rows.filter(isMaterialPrepRowReadyForSpreadingSeed);
  const executableRowIds = new Set(executableRows.map((row) => row.cutOrderId));
  const rowsById = Object.fromEntries(executableRows.map((row) => [row.cutOrderId, row]));
  const isLinkedToExecutableRows = (cutOrderIds = []) => cutOrderIds.length > 0 && cutOrderIds.every((id) => executableRowIds.has(id));
  const isLinkedToMarkerPlan = (session) => Boolean(
    session.sourceSchemeId && session.sourceSchemeNo && session.sourceBedId && session.sourceBedNo && session.sourceMarkerId && session.sourceMarkerNo && session.planUnits?.length
  );
  const isGeneratedFromConfirmedMarkerPlan = (session) => isLinkedToMarkerPlan(session) && /^MKP-\d{8}-\d{3}$/.test(session.sourceSchemeNo || "");
  nextStore = {
    ...nextStore,
    markers: nextStore.markers.filter((marker) => isLinkedToExecutableRows(marker.cutOrderIds || [])),
    sessions: nextStore.sessions.filter(
      (session) => (isLinkedToExecutableRows(session.cutOrderIds || []) || isGeneratedFromConfirmedMarkerPlan(session)) && isLinkedToMarkerPlan(session)
    ).map((session, index) => ensureSpreadingScheduleDefaults(session, index))
  };
  const cutOrderContexts = executableRows.map((row) => buildCutOrderContext(row)).filter((context, index, all) => all.findIndex((item) => item.cutOrderIds[0] === context.cutOrderIds[0]) === index).slice(0, 3);
  const markerPlanRefContexts = options.markerPlanRefs.map((batch) => buildMarkerPlanRefContext(batch, rowsById)).filter((context) => Boolean(context)).filter((context) => context.cutOrderIds.every((id) => executableRowIds.has(id))).filter((context, index, all) => all.findIndex((item) => item.markerPlanId === context.markerPlanId) === index).slice(0, 3);
  const seedContexts = [...cutOrderContexts, ...markerPlanRefContexts].slice(0, 5);
  const preferredSeedModes = /* @__PURE__ */ new Map();
  if (cutOrderContexts[0]) preferredSeedModes.set(`cut-order:${cutOrderContexts[0].cutOrderIds[0]}`, "normal");
  if (cutOrderContexts[1]) preferredSeedModes.set(`cut-order:${cutOrderContexts[1].cutOrderIds[0]}`, "fold_normal");
  if (cutOrderContexts[2]) preferredSeedModes.set(`cut-order:${cutOrderContexts[2].cutOrderIds[0]}`, "high_low");
  if (markerPlanRefContexts[0]) preferredSeedModes.set(`marker-plan-ref:${markerPlanRefContexts[0].markerPlanId}`, "fold_high_low");
  if (markerPlanRefContexts[1]) preferredSeedModes.set(`marker-plan-ref:${markerPlanRefContexts[1].markerPlanId}`, "normal");
  if (markerPlanRefContexts[2]) preferredSeedModes.set(`marker-plan-ref:${markerPlanRefContexts[2].markerPlanId}`, "high_low");
  seedContexts.forEach((context, index) => {
    const contextKey = context.contextType === "marker-plan-ref" ? `marker-plan-ref:${context.markerPlanId}` : `cut-order:${context.cutOrderIds[0]}`;
    if (!hasMarkerForContext(nextStore, context)) {
      const markerDraft = buildMarkerSeedDraft(context, null);
      if (!markerDraft) return;
      markerDraft.markerMode = preferredSeedModes.get(contextKey) || markerDraft.markerMode;
      markerDraft.markerNo = markerDraft.markerNo || `MKP-${String(index + 1).padStart(4, "0")}`;
      markerDraft.updatedAt = nowText(/* @__PURE__ */ new Date(`2026-03-${String(10 + index).padStart(2, "0")}T08:30:00`));
      nextStore = {
        ...nextStore,
        markers: [...nextStore.markers, markerDraft]
      };
    }
    const marker = nextStore.markers.find(
      (item) => context.contextType === "marker-plan-ref" ? item.contextType === "marker-plan-ref" && item.markerPlanId === context.markerPlanId : item.contextType === "cut-order" && item.cutOrderIds[0] === context.cutOrderIds[0]
    ) || null;
    if (!marker) return;
    const profiles = SEED_SESSION_MATRIX[index] || SEED_SESSION_MATRIX[SEED_SESSION_MATRIX.length - 1];
    profiles.forEach((profile, profileIndex) => {
      const sessionKeyBase = context.contextType === "marker-plan-ref" ? context.markerPlanId || context.markerPlanNo : context.cutOrderIds[0] || context.cutOrderNos[0];
      const sessionId = `spreading-session-${context.contextType}-${sanitizeSeedKey(sessionKeyBase)}-${profile.code}`;
      if (hasSessionById(nextStore, sessionId)) return;
      nextStore = {
        ...nextStore,
        sessions: [...nextStore.sessions, createSeedSession(marker, context, index, profile, profileIndex)]
      };
    });
  });
  return {
    markers: [...nextStore.markers].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, "zh-CN")),
    sessions: [...nextStore.sessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, "zh-CN"))
  };
}
function readMarkerSpreadingPrototypeData() {
  const projection = buildMarkerSpreadingProjection();
  const store = buildMarkerSpreadingPrototypeStore({
    rows: projection.rows,
    markerPlanRefs: projection.markerPlanRefs,
    stored: projection.store
  });
  return {
    rows: projection.rows,
    rowsById: projection.rowsById,
    markerPlanRefs: projection.markerPlanRefs,
    store
  };
}
function buildMarkerListViewModel(options) {
  const batchById = Object.fromEntries(options.markerPlanRefs.map((batch) => [batch.markerPlanId, batch]));
  return options.markerRecords.map((record) => {
    const cutOrderRows = record.cutOrderIds.map((id) => options.rowsById[id]).filter((row) => Boolean(row));
    const cutOrderNos = cutOrderRows.map((row) => row.cutOrderNo);
    const lineSummary = summarizeMarkerLineItems(record.lineItems);
    const batch = record.markerPlanId ? batchById[record.markerPlanId] : null;
    const modeMeta = deriveMarkerModeMeta(record.markerMode);
    const templateType = deriveMarkerTemplateByMode(record.markerMode);
    const highLowCuttingTotal = computeHighLowCuttingTotals(record.highLowCuttingRows || []).cuttingTotal;
    return {
      markerId: record.markerId,
      markerNo: record.markerNo || record.markerId,
      contextType: record.contextType,
      contextLabel: record.contextType === "marker-plan-ref" ? "\u551B\u67B6\u65B9\u6848\u4E0A\u4E0B\u6587" : "\u88C1\u7247\u5355\u4E0A\u4E0B\u6587",
      cutOrderCount: record.cutOrderIds.length,
      cutOrderNos,
      markerPlanNo: record.markerPlanNo || batch?.markerPlanNo || "",
      styleCode: record.styleCode || cutOrderRows[0]?.styleCode || "",
      spuCode: record.spuCode || cutOrderRows[0]?.spuCode || "",
      materialSkuSummary: record.materialSkuSummary || uniqueStrings(cutOrderRows.map((row) => row.materialSkuSummary)).join(" / "),
      materialAliasSummary: record.materialAliasSummary || uniqueStrings(cutOrderRows.flatMap((row) => row.materialLineItems.map((line) => line.materialAlias))).join(" / "),
      materialImageUrl: record.materialImageUrl || cutOrderRows.flatMap((row) => row.materialLineItems).find((line) => line.materialImageUrl)?.materialImageUrl || "",
      colorSummary: record.colorSummary || lineSummary.colorSummary || uniqueStrings(cutOrderRows.map((row) => row.color)).join(" / "),
      markerMode: record.markerMode,
      markerModeLabel: modeMeta.label,
      totalPieces: record.totalPieces || computeMarkerTotalPieces(record.sizeDistribution),
      netLength: record.netLength,
      singlePieceUsage: record.singlePieceUsage,
      spreadTotalLength: record.spreadTotalLength || (templateType === "row-template" ? computeNormalMarkerSpreadTotalLength(record.lineItems || []) : Number(record.actualMaterialMeter || 0)),
      markerImageStatus: record.markerImageName ? "\u5DF2\u4E0A\u4F20" : "\u672A\u4E0A\u4F20",
      hasImage: Boolean(record.markerImageName),
      hasAdjustment: Boolean(record.adjustmentRequired || record.adjustmentNote),
      updatedAt: record.updatedAt,
      lineItemCount: lineSummary.lineCount,
      lineSummary: templateType === "row-template" ? lineSummary.summaryText : `\u9AD8\u4F4E\u5C42\u77E9\u9635 \xB7 ${(record.highLowCuttingRows || []).length} \u8272 \xB7 ${highLowCuttingTotal} \u4EF6`,
      record,
      keywordIndex: uniqueStrings([
        record.markerNo,
        record.markerPlanNo,
        ...cutOrderNos,
        record.styleCode,
        record.spuCode,
        record.materialSkuSummary,
        record.colorSummary,
        modeMeta.label,
        record.adjustmentNote,
        ...(record.lineItems || []).flatMap((item) => [item.layoutCode, item.layoutDetailText])
      ])
    };
  }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, "zh-CN"));
}
function buildSpreadingListViewModel(options) {
  const batchById = Object.fromEntries(options.markerPlanRefs.map((batch) => [batch.markerPlanId, batch]));
  const markerById = Object.fromEntries((options.markerRecords || []).map((marker) => [marker.markerId, marker]));
  return options.spreadingSessions.map((session) => {
    const cutOrderRows = session.cutOrderIds.map((id) => options.rowsById[id]).filter((row) => Boolean(row));
    const rollSummary = summarizeSpreadingRolls(session.rolls);
    const operatorSummary = summarizeSpreadingOperators(session.operators);
    const cutOrderNos = cutOrderRows.map((row) => row.cutOrderNo);
    const modeMeta = deriveSpreadingModeMeta(session.spreadingMode);
    const batch = session.markerPlanId ? batchById[session.markerPlanId] : null;
    const markerRecord = session.markerId ? markerById[session.markerId] || null : null;
    const context = buildSessionContext(session, cutOrderRows, batch);
    const colorSummary = deriveSpreadingColorSummary({
      rolls: session.rolls,
      importSourceColorSummary: session.importSource?.sourceColorSummary,
      contextColors: cutOrderRows.map((row) => row.color),
      fallbackSummary: session.colorSummary
    }).value;
    const varianceSummary = buildSpreadingVarianceSummary(context, markerRecord, session);
    const handoverSummary = buildSpreadingHandoverListSummary(session.rolls, session.operators, markerRecord?.totalPieces || 0);
    const operatorAmountSummary = summarizeSpreadingOperatorAmounts(
      session.operators,
      markerRecord?.totalPieces || 0,
      session.unitPrice
    );
    const warningMessages = buildSpreadingWarningMessages({
      session,
      markerTotalPieces: markerRecord?.totalPieces || 0,
      claimedLengthTotal: varianceSummary?.claimedLengthTotal || 0
    });
    const replenishmentWarning = buildSpreadingReplenishmentWarning({
      context,
      session,
      markerTotalPieces: markerRecord?.totalPieces || 0,
      cutOrderNos,
      productionOrderNos: context?.productionOrderNos || uniqueStrings(cutOrderRows.map((row) => row.productionOrderNo)),
      materialAttr: cutOrderRows[0]?.materialLabel || cutOrderRows[0]?.materialCategory || "",
      warningMessages
    });
    const navigationPayload = buildMarkerSpreadingNavigationPayload(context, varianceSummary, replenishmentWarning);
    const completedCutOrderCount = getCompletedLinkedCutOrderIds(session).length;
    return {
      spreadingSessionId: session.spreadingSessionId,
      sessionNo: session.sessionNo || session.spreadingSessionId,
      contextType: session.contextType,
      contextLabel: session.contextType === "marker-plan-ref" ? "\u551B\u67B6\u65B9\u6848\u4E0A\u4E0B\u6587" : "\u88C1\u7247\u5355\u4E0A\u4E0B\u6587",
      cutOrderCount: session.cutOrderIds.length,
      cutOrderNos,
      markerPlanNo: session.markerPlanNo || batch?.markerPlanNo || "",
      styleCode: session.styleCode || cutOrderRows[0]?.styleCode || "",
      spuCode: session.spuCode || cutOrderRows[0]?.spuCode || "",
      materialSkuSummary: session.materialSkuSummary || uniqueStrings(cutOrderRows.map((row) => row.materialSkuSummary)).join(" / "),
      materialAliasSummary: session.materialAliasSummary || context.materialAliasSummary || "",
      materialImageUrl: session.materialImageUrl || context.materialImageUrl || "",
      colorSummary: colorSummary === "\u5F85\u8865" ? "" : colorSummary,
      spreadingMode: session.spreadingMode,
      spreadingModeLabel: modeMeta.label,
      rollCount: session.rollCount || session.rolls.length,
      operatorCount: session.operatorCount || session.operators.length,
      totalActualLength: session.totalActualLength || rollSummary.totalActualLength,
      totalCalculatedUsableLength: session.totalCalculatedUsableLength || rollSummary.totalCalculatedUsableLength,
      totalRemainingLength: session.totalRemainingLength ?? rollSummary.totalRemainingLength,
      actualCutPieceQty: session.actualCutPieceQty || rollSummary.totalActualCutPieceQty,
      plannedCutGarmentQty: varianceSummary?.plannedCutGarmentQty || replenishmentWarning.plannedCutGarmentQty,
      theoreticalCutGarmentQty: varianceSummary?.theoreticalCutGarmentQty || replenishmentWarning.theoreticalCutGarmentQty,
      actualCutGarmentQty: varianceSummary?.actualCutGarmentQty || replenishmentWarning.actualCutGarmentQty,
      fabricRollCount: varianceSummary?.fabricRollCount || session.rolls.length,
      spreadLayerCount: varianceSummary?.spreadLayerCount || rollSummary.totalLayers,
      spreadActualLengthM: varianceSummary?.spreadActualLengthM || session.totalActualLength || rollSummary.totalActualLength,
      spreadUsableLengthM: varianceSummary?.spreadUsableLengthM || session.totalCalculatedUsableLength || rollSummary.totalCalculatedUsableLength,
      spreadRemainingLengthM: varianceSummary?.spreadRemainingLengthM || session.totalRemainingLength || rollSummary.totalRemainingLength,
      configuredLengthTotal: varianceSummary?.configuredLengthTotal || session.configuredLengthTotal || 0,
      claimedLengthTotal: varianceSummary?.claimedLengthTotal || session.claimedLengthTotal || 0,
      varianceLength: varianceSummary?.varianceLength || session.varianceLength || 0,
      varianceNote: varianceSummary?.replenishmentHint || session.varianceNote || "\u5F53\u524D\u672A\u8BC6\u522B\u660E\u663E\u5DEE\u5F02\u3002",
      hasVariance: Math.abs(varianceSummary?.varianceLength || session.varianceLength || 0) > 0.01,
      differenceStatusLabel: Math.abs(varianceSummary?.varianceLength || session.varianceLength || 0) > 0.01 ? `\u5B58\u5728\u5DEE\u5F02 ${(varianceSummary?.varianceLength || session.varianceLength || 0).toFixed(2)} \u7C73` : "\u65E0\u660E\u663E\u5DEE\u5F02",
      differenceStatusTone: Math.abs(varianceSummary?.varianceLength || session.varianceLength || 0) > 0.01 ? "warning" : "normal",
      completedCutOrderCount,
      hasHandover: handoverSummary.hasHandover,
      hasHandoverWarnings: handoverSummary.hasAbnormalHandover,
      handoverStatusLabel: handoverSummary.statusLabel,
      hasOperatorAllocation: operatorAmountSummary.hasAnyAllocationData,
      operatorAllocationAmountTotal: operatorAmountSummary.totalDisplayAmount,
      hasManualAdjustedAmount: operatorAmountSummary.hasManualAdjustedAmount,
      operatorAllocationStatusLabel: operatorAmountSummary.hasAnyAllocationData ? operatorAmountSummary.hasManualAdjustedAmount ? "\u5DF2\u751F\u6210\u4EBA\u5458\u5206\u644A\uFF0C\u542B\u4EBA\u5DE5\u8C03\u4EF7" : "\u5DF2\u751F\u6210\u4EBA\u5458\u5206\u644A" : "\u5F85\u8865\u5F55\u4EBA\u5458\u5206\u644A",
      hasWarnings: warningMessages.length > 0,
      warningStatusLabel: warningMessages.length > 0 ? `\u6709 ${warningMessages.length} \u6761\u63D0\u9192` : operatorSummary.handoverRollCount > 0 ? `\u5DF2\u8BB0\u5F55 ${operatorSummary.handoverRollCount} \u5377\u4EA4\u63A5` : "\u65E0\u63D0\u9192",
      hasReplenishmentWarning: replenishmentWarning.suggestedAction === "\u5DEE\u5F02\u5904\u7406" || replenishmentWarning.suggestedAction === "\u5B58\u5728\u5F02\u5E38\u5DEE\u5F02\uFF0C\u9700\u4EBA\u5DE5\u786E\u8BA4",
      replenishmentWarningLevel: replenishmentWarning.warningLevel,
      replenishmentSuggestedAction: replenishmentWarning.suggestedAction,
      pendingReplenishmentConfirmation: !replenishmentWarning.handled && replenishmentWarning.suggestedAction !== "\u65E0\u9700\u8865\u6599",
      warningMessages,
      replenishmentWarning,
      replenishmentPayload: navigationPayload.replenishment,
      productionOrderNos: context?.productionOrderNos || uniqueStrings(cutOrderRows.map((row) => row.productionOrderNo)),
      statusLabel: session.status === "DRAFT" ? "\u5F85\u94FA\u5E03" : session.status === "IN_PROGRESS" ? "\u94FA\u5E03\u4E2D" : session.status === "DONE" ? "\u5DF2\u94FA\u5E03" : "\u5F85\u8865\u5F55",
      statusKey: session.status,
      updatedAt: session.updatedAt,
      session,
      keywordIndex: uniqueStrings([
        session.sessionNo,
        session.markerNo,
        session.markerPlanNo,
        ...cutOrderNos,
        ...context?.productionOrderNos || [],
        session.styleCode,
        session.spuCode,
        session.materialSkuSummary,
        ...session.rolls.map((roll) => roll.rollNo),
        ...session.rolls.map((roll) => roll.materialSku),
        ...session.operators.map((operator) => operator.operatorName)
      ])
    };
  }).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, "zh-CN"));
}
function buildSpreadingDetailViewModel(options) {
  const batchById = Object.fromEntries(options.markerPlanRefs.map((batch2) => [batch2.markerPlanId, batch2]));
  const markerById = Object.fromEntries(options.markerRecords.map((marker) => [marker.markerId, marker]));
  const session = options.row.session;
  const batch = session.markerPlanId ? batchById[session.markerPlanId] || null : null;
  const cutOrderRows = session.cutOrderIds.map((id) => options.rowsById[id]).filter((row) => Boolean(row));
  const markerRecord = session.markerId ? markerById[session.markerId] || null : null;
  const context = buildSessionContext(session, cutOrderRows, batch);
  const varianceSummary = buildSpreadingVarianceSummary(context, markerRecord, session);
  const warningMessages = buildSpreadingWarningMessages({
    session,
    markerTotalPieces: markerRecord?.totalPieces || 0,
    claimedLengthTotal: varianceSummary?.claimedLengthTotal || 0
  });
  const operatorSummary = summarizeSpreadingOperators(session.operators);
  const operatorAmountSummary = summarizeSpreadingOperatorAmounts(session.operators, markerRecord?.totalPieces || 0, session.unitPrice);
  const amountWarnings = buildOperatorAmountWarnings(session.operators, markerRecord?.totalPieces || 0, session.unitPrice);
  const handoverSummaryByRollId = Object.fromEntries(
    session.rolls.map((roll) => [
      roll.rollRecordId,
      buildRollHandoverViewModel(roll, operatorSummary.operatorsByRollId[roll.rollRecordId] || [], markerRecord?.totalPieces || 0)
    ])
  );
  const replenishmentWarning = buildSpreadingReplenishmentWarning({
    context,
    session,
    markerTotalPieces: markerRecord?.totalPieces || 0,
    cutOrderNos: cutOrderRows.map((item) => item.cutOrderNo),
    productionOrderNos: context?.productionOrderNos || uniqueStrings(cutOrderRows.map((row) => row.productionOrderNo)),
    materialAttr: cutOrderRows[0]?.materialLabel || cutOrderRows[0]?.materialCategory || "",
    warningMessages
  });
  return {
    row: options.row,
    markerRecord,
    warningMessages,
    varianceSummary,
    replenishmentWarning,
    navigationPayload: buildMarkerSpreadingNavigationPayload(context, varianceSummary, replenishmentWarning),
    linkedRollNos: Object.fromEntries(session.rolls.map((roll) => [roll.rollRecordId, roll.rollNo])),
    linkedCutOrderNos: cutOrderRows.map((item) => item.cutOrderNo),
    sortedOperators: operatorSummary.sortedOperators,
    operatorsByRollId: operatorSummary.operatorsByRollId,
    handoverSummaryByRollId,
    rollParticipantSummary: Object.fromEntries(
      Object.entries(operatorSummary.rollParticipantNames).map(([rollId, names]) => [rollId, names.join(" \u2192 ") || "\u5F85\u8865\u5F55"])
    ),
    operatorAmountSummary,
    amountWarnings
  };
}
function buildMarkerDetailViewModel(row) {
  const lineSummary = summarizeMarkerLineItems(row.record.lineItems);
  const templateType = deriveMarkerTemplateByMode(row.record.markerMode);
  const usageSummary = computeUsageSummary(row.record);
  const highLowPatternKeys = row.record.highLowPatternKeys?.length ? row.record.highLowPatternKeys : [...DEFAULT_HIGH_LOW_PATTERN_KEYS];
  const highLowCuttingTotals = computeHighLowCuttingTotals(row.record.highLowCuttingRows || []);
  const highLowPatternTotals = computeHighLowPatternTotals(row.record.highLowPatternRows || [], highLowPatternKeys);
  const prototypeData = readMarkerSpreadingPrototypeData();
  const sourceRows = buildMarkerAllocationSourceRows(row.record, prototypeData.rowsById);
  const pieceExplosion = buildMarkerPieceExplosionViewModel({
    marker: row.record,
    sourceRows
  });
  const warningMessages = uniqueStrings([...buildMarkerWarningMessages(row.record), ...pieceExplosion.mappingWarnings]);
  return {
    row,
    lineSummary,
    sizeRatioPlanText: row.record.sizeRatioPlanText || row.record.sizeDistribution.filter((item) => item.quantity > 0).map((item) => `${item.sizeLabel}\xD7${item.quantity}`).join(" / "),
    totalLineSpreadLength: computeNormalMarkerSpreadTotalLength(row.record.lineItems || []),
    templateType,
    usageSummary,
    warningMessages,
    highLowPatternKeys,
    highLowCuttingRows: highLowCuttingTotals.rows,
    highLowPatternRows: highLowPatternTotals.rows,
    highLowCuttingTotal: highLowCuttingTotals.cuttingTotal,
    highLowPatternTotal: highLowPatternTotals.patternTotal,
    sourceOrderRows: pieceExplosion.sourceOrderRows,
    allocationRows: pieceExplosion.allocationRows,
    allocationSizeSummary: pieceExplosion.allocationSizeSummary,
    skuSummaryRows: pieceExplosion.skuSummaryRows,
    pieceDetailRows: pieceExplosion.pieceDetailRows,
    mappingWarnings: pieceExplosion.mappingWarnings,
    missingMappings: pieceExplosion.missingMappings,
    totals: pieceExplosion.totals
  };
}
function buildMarkerNavigationPayload(row) {
  return {
    markerId: row.markerId,
    cutOrderId: row.contextType === "cut-order" ? row.record.cutOrderIds[0] : void 0,
    cutOrderNo: row.contextType === "cut-order" ? row.cutOrderNos[0] : void 0,
    markerPlanId: row.contextType === "marker-plan-ref" ? row.record.markerPlanId || void 0 : void 0,
    markerPlanNo: row.contextType === "marker-plan-ref" ? row.markerPlanNo || void 0 : void 0,
    styleCode: row.styleCode || void 0,
    materialSku: row.materialSkuSummary?.split(" / ")[0] || void 0
  };
}
function getDefaultMarkerSpreadingContext(rows, markerPlanRefs, prefilter) {
  if (prefilter?.markerPlanId || prefilter?.markerPlanNo) {
    const rowsById = Object.fromEntries(rows.map((row) => [row.cutOrderId, row]));
    const batch = prefilter.markerPlanId && markerPlanRefs.find((item) => item.markerPlanId === prefilter.markerPlanId) || prefilter.markerPlanNo && markerPlanRefs.find((item) => item.markerPlanNo === prefilter.markerPlanNo) || null;
    if (batch) return buildMarkerPlanRefContext(batch, rowsById);
  }
  if (prefilter?.cutOrderId || prefilter?.cutOrderNo) {
    const row = rows.find(
      (item) => item.cutOrderId === prefilter.cutOrderId || item.cutOrderNo === prefilter.cutOrderNo
    ) || null;
    if (row) return buildCutOrderContext(row);
  }
  return rows[0] ? buildCutOrderContext(rows[0]) : null;
}
function buildMarkerSpreadingCountsByCutOrder(cutOrderId) {
  const prototypeData = readMarkerSpreadingPrototypeData();
  const sourceRow = prototypeData.rowsById[cutOrderId];
  if (!sourceRow || !isMaterialPrepRowReadyForSpreadingSeed(sourceRow)) {
    return createEmptyMarkerSpreadingCounts(sourceRow);
  }
  const { store } = prototypeData;
  const linkedSessions = store.sessions.filter((item) => item.cutOrderIds.includes(cutOrderId));
  const markersById = Object.fromEntries(store.markers.map((marker) => [marker.markerId, marker]));
  const draftCount = linkedSessions.filter((item) => item.status === "DRAFT" || item.status === "TO_FILL").length;
  const doneCount = linkedSessions.filter((item) => item.status === "DONE").length;
  const inProgressCount = linkedSessions.filter((item) => item.status === "IN_PROGRESS").length;
  const latestSession = [...linkedSessions].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, "zh-CN"))[0] || null;
  const latestMarkerTotalPieces = latestSession?.markerId ? markersById[latestSession.markerId]?.totalPieces || 0 : 0;
  const latestAmountSummary = latestSession ? summarizeSpreadingOperatorAmounts(latestSession.operators, latestMarkerTotalPieces, latestSession.unitPrice) : null;
  const completedForCurrentOrder = linkedSessions.some((item) => getCompletedLinkedCutOrderIds(item).includes(cutOrderId));
  const spreadingStatusLabel = completedForCurrentOrder ? "\u5DF2\u94FA\u5E03" : inProgressCount > 0 ? "\u94FA\u5E03\u4E2D" : doneCount > 0 ? "\u5DF2\u94FA\u5E03" : "\u5F85\u94FA\u5E03";
  return {
    markerCount: store.markers.filter((item) => item.cutOrderIds.includes(cutOrderId)).length,
    sessionCount: linkedSessions.length,
    rollCount: linkedSessions.reduce((sum, item) => sum + item.rolls.length, 0),
    operatorCount: linkedSessions.reduce((sum, item) => sum + item.operators.length, 0),
    statusSummary: linkedSessions.length > 0 ? `\u5DF2\u94FA\u5E03 ${doneCount} \u5F20 / \u94FA\u5E03\u4E2D ${inProgressCount} \u5F20 / \u5F85\u94FA\u5E03 ${draftCount} \u5F20` : "\u6682\u65E0\u94FA\u5E03\u8BB0\u5F55",
    spreadingStatusLabel,
    latestSessionNo: latestSession?.sessionNo || "\u6682\u65E0",
    hasReplenishmentWarning: Boolean(latestWarning && latestWarning.suggestedAction !== "\u65E0\u9700\u8865\u6599"),
    warningLevelLabel: latestWarning?.warningLevel || "\u4F4E",
    suggestedAction: latestWarning?.suggestedAction || "\u65E0\u9700\u8865\u6599",
    hasOperatorAllocation: Boolean(latestAmountSummary?.hasAnyAllocationData),
    operatorAmountTotal: latestAmountSummary?.totalDisplayAmount || 0,
    hasManualAdjustedAmount: Boolean(latestAmountSummary?.hasManualAdjustedAmount)
  };
}
function isMaterialPrepRowReadyForSpreadingSeed(row) {
  return row.materialPrepStatus.key === "CONFIGURED" && row.materialClaimStatus.key === "RECEIVED";
}
function createEmptyMarkerSpreadingCounts(row) {
  const stageLabel = row?.currentStage.label || "\u914D\u6599\u6570\u91CF\u5F85\u8865";
  const suggestedAction = row?.currentStage.key === "WAITING_CLAIM" ? "\u7B49\u5F85\u88C1\u5E8A\u9886\u6599" : "\u7B49\u5F85\u88C1\u5E8A\u9886\u6599";
  return {
    markerCount: 0,
    sessionCount: 0,
    rollCount: 0,
    operatorCount: 0,
    statusSummary: "\u6682\u65E0\u94FA\u5E03\u8BB0\u5F55",
    spreadingStatusLabel: stageLabel,
    latestSessionNo: "\u6682\u65E0",
    hasReplenishmentWarning: false,
    warningLevelLabel: "\u4F4E",
    suggestedAction,
    hasOperatorAllocation: false,
    operatorAmountTotal: 0,
    hasManualAdjustedAmount: false
  };
}
export {
  DEFAULT_HIGH_LOW_PATTERN_KEYS,
  MARKER_SIZE_KEYS,
  buildMarkerDetailViewModel,
  buildMarkerListViewModel,
  buildMarkerNavigationPayload,
  buildMarkerSpreadingCountsByCutOrder,
  buildMarkerSpreadingNavigationPayload,
  buildMarkerSpreadingPrototypeStore,
  buildMarkerWarningMessages,
  buildOperatorAmountWarnings,
  buildRollActualCutGarmentQtyFormula,
  buildRollHandoverViewModel,
  buildSpreadingDetailViewModel,
  buildSpreadingHandoverListSummary,
  buildSpreadingListViewModel,
  buildSpreadingReplenishmentWarning,
  buildSpreadingVarianceSummary,
  buildSpreadingWarningMessages,
  computeActualCutQty,
  computeHighLowCuttingTotals,
  computeHighLowPatternTotals,
  computeLengthVariance,
  computeMarkerTotalPieces,
  computeNormalMarkerSpreadTotalLength,
  computeOperatorHandledLayerCount,
  computeOperatorHandledPieceQty,
  computeRemainingLength,
  computeRollActualCutGarmentQty,
  computeRollActualCutPieceQty,
  computeShortageQty,
  computeSinglePieceUsage,
  computeTheoreticalCutQty,
  computeUsableLength,
  computeUsageSummary,
  deriveMarkerModeMeta,
  deriveMarkerTemplateByMode,
  deriveSpreadingModeMeta,
  findSpreadingPlanUnitById,
  getDefaultMarkerSpreadingContext,
  readMarkerSpreadingPrototypeData,
  summarizeMarkerLineItems,
  summarizeSpreadingOperatorAmounts,
  summarizeSpreadingRolls,
  validateMarkerModeShape
};
