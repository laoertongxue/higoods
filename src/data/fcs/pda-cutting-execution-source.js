import { buildFcsCuttingDomainSnapshot } from "../../domain/fcs-cutting-runtime/index.ts";
import {
  getGeneratedCutOrderSourceRecordById,
  listGeneratedCutOrderSourceRecords
} from "./cutting/generated-cut-orders.ts";
import { buildMarkerPlanProjection } from "../../pages/process-factory/cutting/marker-plan-projection.ts";
import {
  getPdaCuttingTaskSourceRecord,
  listPdaCuttingTaskSourceRecords,
  listPdaCuttingExecutionSourceRecords
} from "./cutting/pda-cutting-task-source.ts";
import { listPdaGenericProcessTasks } from "./pda-task-mock-factory.ts";
import { listWoolMobileProcessTasks } from "./wool-task-domain.ts";
import { TEST_FACTORY_ID, TEST_FACTORY_NAME } from "./factory-mock-data.ts";
import {
  getPdaCuttingTaskScenarioByTaskId,
  listPdaCuttingSpreadingPresetExecutions
} from "./cutting/pda-cutting-task-scenarios.ts";
import { getTaskChainTaskById, listTaskChainTasks } from "./page-adapters/task-chain-pages-adapter.ts";
import {
  getLatestPdaCuttingStageWritebackByExecution,
  listPdaCuttingStageWritebacksByExecution
} from "./cutting/pda-cutting-stage-writeback.ts";
import { getLatestClaimDisputeByCutOrderNo } from "../../state/fcs-claim-dispute-store.ts";
const numberFormatter = new Intl.NumberFormat("zh-CN");
function listWorkerVisiblePdaSpreadingTargets(detail) {
  return detail.spreadingTargets.filter((target) => target.targetType === "session");
}
function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== void 0 && value !== null)));
}
function matchPdaExecutionRecord(record, executionKey) {
  const key = executionKey?.trim();
  if (!key) return false;
  return [
    record.executionOrderId,
    record.executionOrderNo,
    record.cutOrderId,
    record.cutOrderNo,
    record.markerPlanId,
    record.markerPlanNo,
    record.materialSku
  ].some((value) => value === key);
}
function mapTaskStatusLabel(status) {
  if (status === "DONE") return "\u5DF2\u5B8C\u6210";
  if (status === "CANCELLED") return "\u5DF2\u4E2D\u6B62";
  if (status === "BLOCKED") return "\u6709\u5F02\u5E38";
  if (status === "IN_PROGRESS") return "\u8FDB\u884C\u4E2D";
  return "\u5F85\u5F00\u59CB";
}
function mapMaterialTypeLabel(record) {
  if (!record) return "\u5F85\u8865\u9762\u6599\u7C7B\u578B";
  if (record.materialCategory) return record.materialCategory;
  if (record.materialType === "PRINT" || record.materialType === "DYE" || record.materialType === "SOLID") return "\u9762\u6599\u4E3B\u6599";
  if (record.materialType === "LINING") return "\u91CC\u8F85\u6599";
  return "\u9762\u6599\u4E3B\u6599";
}
function mapReceiveStatusLabel(status) {
  if (status === "RECEIVED") return "\u5DF2\u9886\u6599\u5165\u4ED3";
  if (status === "PARTIAL") return "\u9886\u6599\u6570\u91CF\u4E0D\u8DB3";
  return "\u5F85\u88C1\u5E8A\u9886\u6599\u786E\u8BA4";
}
function buildPickupSlipNo(cutOrderNo) {
  return `LLD-${cutOrderNo.replace(/^CUT-/, "")}`;
}
function mapSpreadingModeLabel(mode) {
  if (mode === "high-low" || mode === "high_low" || mode === "HIGH_LOW") return "\u9AD8\u4F4E\u5C42\u6A21\u5F0F";
  if (mode === "fold_high_low" || mode === "FOLD_HIGH_LOW") return "\u5BF9\u6298-\u9AD8\u4F4E\u5C42\u6A21\u5F0F";
  if (mode === "folded" || mode === "fold_normal" || mode === "FOLD" || mode === "FOLD_NORMAL") return "\u5BF9\u6298-\u666E\u901A\u6A21\u5F0F";
  return "\u666E\u901A\u6A21\u5F0F";
}
function mapSpreadingModeKey(mode) {
  if (mode === "high_low" || mode === "high-low") return "HIGH_LOW";
  if (mode === "FOLD_HIGH_LOW" || mode === "fold_high_low") return "FOLD_HIGH_LOW";
  if (mode === "FOLD_NORMAL" || mode === "fold_normal" || mode === "folded" || mode === "FOLD") return "FOLD_NORMAL";
  return "NORMAL";
}
function buildQrCodeValue(cutOrderNo) {
  return `QR-${cutOrderNo}`;
}
function buildConfiguredQtyText(record, configuredLength = 0, configuredRollCount = 0) {
  if (configuredRollCount > 0 || configuredLength > 0) {
    return `\u5377\u6570 ${configuredRollCount || 0} \u5377 / \u957F\u5EA6 ${configuredLength || 0} \u7C73`;
  }
  const estimatedRollCount = Math.max(1, Math.ceil(record.requiredQty / 40));
  const estimatedLength = Math.max(record.requiredQty * 2, estimatedRollCount * 30);
  return `\u5377\u6570 ${estimatedRollCount} \u5377 / \u957F\u5EA6 ${estimatedLength} \u7C73`;
}
function buildActualReceivedQtyText(input) {
  if (input.latestPickup?.actualReceivedQtyText) return input.latestPickup.actualReceivedQtyText;
  if ((input.receivedRollCount || 0) > 0 || (input.receivedLength || 0) > 0) {
    return `\u5377\u6570 ${input.receivedRollCount || 0} \u5377 / \u957F\u5EA6 ${input.receivedLength || 0} \u7C73`;
  }
  return "\u5F85\u626B\u7801\u56DE\u5199";
}
function getSnapshot(snapshot) {
  return snapshot ?? buildFcsCuttingDomainSnapshot();
}
function formatQty(value) {
  return numberFormatter.format(Math.max(Number(value || 0), 0));
}
function buildSpreadingPlanUnitLabel(unit) {
  return `${unit.color || "\u5F85\u8865\u989C\u8272"} / ${unit.materialSku || "\u5F85\u8865\u9762\u6599"} / ${formatQty(unit.garmentQtyPerUnit)}\u4EF6/\u5C42`;
}
function toSpreadingPlanUnitOption(unit) {
  return {
    planUnitId: unit.planUnitId,
    sourceType: unit.sourceType,
    sourceLineId: unit.sourceLineId,
    label: buildSpreadingPlanUnitLabel(unit),
    color: unit.color,
    materialSku: unit.materialSku,
    materialAlias: unit.materialAlias || "",
    materialImageUrl: unit.materialImageUrl || "",
    garmentQtyPerUnit: unit.garmentQtyPerUnit,
    plannedRepeatCount: unit.plannedRepeatCount,
    lengthPerUnitM: unit.lengthPerUnitM,
    plannedCutGarmentQty: unit.plannedCutGarmentQty,
    plannedSpreadLengthM: unit.plannedSpreadLengthM
  };
}
function buildFallbackPlanUnitsFromSession(session, execution) {
  const garmentQtyPerUnit = Math.max(Number(session.theoreticalActualCutPieceQty || 0), 0) > 0 && Math.max(Number(session.plannedLayers || 0), 0) > 0 ? Number((Math.max(Number(session.theoreticalActualCutPieceQty || 0), 0) / Math.max(Number(session.plannedLayers || 0), 1)).toFixed(0)) : Math.max(Number(session.actualCutPieceQty || 0), 0);
  const fallbackUnit = {
    planUnitId: `plan-unit-fallback-${session.markerId || session.spreadingSessionId}`,
    sourceType: "exception",
    sourceLineId: session.markerId || session.spreadingSessionId,
    color: session.colorSummary?.split(" / ")[0] || "",
    materialSku: session.materialSkuSummary?.split(" / ")[0] || execution.materialSku || "",
    materialAlias: execution.materialAlias || "",
    materialImageUrl: execution.materialImageUrl || "",
    garmentQtyPerUnit,
    plannedRepeatCount: Math.max(Number(session.plannedLayers || 0), 1),
    lengthPerUnitM: Math.max(Number(session.theoreticalSpreadTotalLength || 0), 0) > 0 && Math.max(Number(session.plannedLayers || 0), 0) > 0 ? Number((Math.max(Number(session.theoreticalSpreadTotalLength || 0), 0) / Math.max(Number(session.plannedLayers || 0), 1)).toFixed(2)) : 0,
    plannedCutGarmentQty: Math.max(Number(session.theoreticalActualCutPieceQty || 0), 0),
    plannedSpreadLengthM: Math.max(Number(session.theoreticalSpreadTotalLength || 0), 0)
  };
  return [toSpreadingPlanUnitOption(fallbackUnit)];
}
function buildFallbackPlanUnitFromExecution(execution) {
  const scenario = getPdaCuttingTaskScenarioByTaskId(execution.taskId);
  const originalRecord = getCutOrderRecord(execution);
  const plannedRepeatCount = Math.max(
    Number(scenario?.executions.find((item) => item.executionOrderId === execution.executionOrderId)?.spreadingPreset?.layerCount || 0),
    100
  );
  const plannedCutGarmentQty = Math.max(Number(scenario?.qty || originalRecord?.requiredQty || 0), 1);
  const garmentQtyPerUnit = Math.max(Math.round(plannedCutGarmentQty / plannedRepeatCount), 1);
  const plannedSpreadLengthM = Number((plannedRepeatCount * 2).toFixed(2));
  const unit = {
    planUnitId: `plan-unit-${execution.executionOrderId}-pda`,
    sourceType: "exception",
    sourceLineId: execution.executionOrderId,
    color: originalRecord?.materialColor || "",
    materialSku: execution.materialSku || originalRecord?.materialSku || "",
    materialAlias: execution.materialAlias || originalRecord?.materialAlias || "",
    materialImageUrl: execution.materialImageUrl || originalRecord?.materialImageUrl || "",
    garmentQtyPerUnit,
    plannedRepeatCount,
    lengthPerUnitM: 2,
    plannedCutGarmentQty,
    plannedSpreadLengthM
  };
  return toSpreadingPlanUnitOption(unit);
}
function buildExecutionMarkerSpreadingContext(execution, input = {}) {
  return {
    contextType: execution.markerPlanId ? "marker-plan-ref" : "cut-order",
    cutOrderIds: execution.cutOrderId ? [execution.cutOrderId] : [],
    cutOrderNos: execution.cutOrderNo ? [execution.cutOrderNo] : [],
    markerPlanId: execution.markerPlanId || "",
    markerPlanNo: execution.markerPlanNo || "",
    productionOrderNos: execution.productionOrderNo ? [execution.productionOrderNo] : [],
    styleCode: input.styleCode || "",
    spuCode: input.spuCode || "",
    techPackSpuCode: input.spuCode || "",
    styleName: input.styleName || "",
    materialSkuSummary: input.markerMaterialSku || execution.materialSku || "",
    materialAliasSummary: execution.materialAlias || "",
    materialImageUrl: execution.materialImageUrl || "",
    materialPrepRows: []
  };
}
function buildPlanUnitsFromCanonicalPlan(plan, execution) {
  const materialSku = (plan.materialSkuSummary || execution.materialSku || "").split(" / ")[0] || execution.materialSku || "";
  const materialAlias = plan.materialAliasSummary || execution.materialAlias || "";
  const materialImageUrl = plan.materialImageUrl || execution.materialImageUrl || "";
  const fallbackColor = (plan.colorSummary || "").split(" / ")[0] || "";
  const bedUnits = Array.isArray(plan.beds) ? plan.beds.filter((bed) => bed.readyForSpreading).map((bed, index) => {
    const unit = {
      planUnitId: `plan-unit-${plan.id}-bed-${bed.bedId || index + 1}`,
      sourceType: bed.bedMode === "high_low" || bed.bedMode === "fold_high_low" ? "high-low-row" : "marker-line",
      sourceLineId: bed.bedId || `${index + 1}`,
      color: bed.colorName || bed.colorCode || fallbackColor,
      materialSku: bed.materialSku || materialSku,
      materialAlias,
      materialImageUrl,
      garmentQtyPerUnit: Number(bed.markerPieceQtyPerLayer || 0),
      plannedRepeatCount: Number(bed.plannedLayerCount || 0),
      lengthPerUnitM: Number(bed.markerLength || 0),
      plannedCutGarmentQty: Number(bed.plannedGarmentQty || 0),
      plannedSpreadLengthM: Number(bed.spreadTotalLength || 0)
    };
    return {
      ...unit,
      label: buildSpreadingPlanUnitLabel(unit)
    };
  }) : [];
  if (bedUnits.length) return bedUnits;
  const layoutUnits = Array.isArray(plan.layoutLines) ? plan.layoutLines.map((line, index) => ({
    planUnitId: `plan-unit-${plan.id}-layout-${line.id || index + 1}`,
    sourceType: "marker-line",
    sourceLineId: line.id || `${index + 1}`,
    label: buildSpreadingPlanUnitLabel({
      planUnitId: `plan-unit-${plan.id}-layout-${line.id || index + 1}`,
      sourceType: "marker-line",
      sourceLineId: line.id || `${index + 1}`,
      color: line.colorCode || fallbackColor,
      materialSku,
      materialAlias,
      materialImageUrl,
      garmentQtyPerUnit: Number(line.markerPieceQty || 0),
      plannedRepeatCount: Number(line.repeatCount || 0),
      lengthPerUnitM: Number(line.markerLength || 0),
      plannedCutGarmentQty: Number(line.markerPieceQty || 0) * Number(line.repeatCount || 0),
      plannedSpreadLengthM: Number(line.spreadLength || 0)
    }),
    color: line.colorCode || fallbackColor,
    materialSku,
    materialAlias,
    materialImageUrl,
    garmentQtyPerUnit: Number(line.markerPieceQty || 0),
    plannedRepeatCount: Number(line.repeatCount || 0),
    lengthPerUnitM: Number(line.markerLength || 0),
    plannedCutGarmentQty: Number(line.markerPieceQty || 0) * Number(line.repeatCount || 0),
    plannedSpreadLengthM: Number(line.spreadLength || 0)
  })) : [];
  if (layoutUnits.length) return layoutUnits;
  const modeUnits = Array.isArray(plan.modeDetailLines) ? plan.modeDetailLines.map((line, index) => ({
    planUnitId: `plan-unit-${plan.id}-mode-${line.id || index + 1}`,
    sourceType: "high-low-row",
    sourceLineId: line.id || `${index + 1}`,
    label: buildSpreadingPlanUnitLabel({
      planUnitId: `plan-unit-${plan.id}-mode-${line.id || index + 1}`,
      sourceType: "high-low-row",
      sourceLineId: line.id || `${index + 1}`,
      color: line.colorCode || fallbackColor,
      materialSku,
      materialAlias,
      materialImageUrl,
      garmentQtyPerUnit: Number(line.markerPieceQty || 0),
      plannedRepeatCount: Number(line.repeatCount || 0),
      lengthPerUnitM: Number(line.markerLength || 0),
      plannedCutGarmentQty: Number(line.markerPieceQty || 0) * Number(line.repeatCount || 0),
      plannedSpreadLengthM: Number(line.spreadLength || 0)
    }),
    color: line.colorCode || fallbackColor,
    materialSku,
    materialAlias,
    materialImageUrl,
    garmentQtyPerUnit: Number(line.markerPieceQty || 0),
    plannedRepeatCount: Number(line.repeatCount || 0),
    lengthPerUnitM: Number(line.markerLength || 0),
    plannedCutGarmentQty: Number(line.markerPieceQty || 0) * Number(line.repeatCount || 0),
    plannedSpreadLengthM: Number(line.spreadLength || 0)
  })) : [];
  if (modeUnits.length) return modeUnits;
  return [
    {
      planUnitId: `plan-unit-${plan.id}-fallback`,
      sourceType: "exception",
      sourceLineId: "fallback",
      label: `${fallbackColor || "\u5F85\u8865\u989C\u8272"} / ${materialSku || "\u5F85\u8865\u9762\u6599"} / ${Number(plan.totalPieces || 0)} \u4EF6`,
      color: fallbackColor,
      materialSku,
      materialAlias,
      materialImageUrl,
      garmentQtyPerUnit: Number(plan.totalPieces || 0),
      plannedRepeatCount: 1,
      lengthPerUnitM: Number(plan.netLength || 0),
      plannedCutGarmentQty: Number(plan.totalPieces || 0),
      plannedSpreadLengthM: Number(plan.plannedSpreadLength || 0)
    }
  ];
}
const pdaCuttingScenarioSpreadingPresetByExecutionId = new Map(
  listPdaCuttingSpreadingPresetExecutions().map((item) => [item.executionOrderId, item.preset])
);
function mapScenarioAssignmentStatus(origin) {
  if (origin === "BIDDING_PENDING" || origin === "BIDDING_QUOTED") return "BIDDING";
  if (origin === "BIDDING_AWARDED") return "AWARDED";
  return "ASSIGNED";
}
function mapScenarioAssignmentMode(origin) {
  return origin === "DIRECT" ? "DIRECT" : "BIDDING";
}
function buildFallbackCuttingTaskFact(record) {
  const scenario = getPdaCuttingTaskScenarioByTaskId(record.taskId);
  const firstExecution = getSourceExecutionsByTaskId(record.taskId)[0] ?? null;
  const originalRecord = firstExecution?.cutOrderId ? getGeneratedCutOrderSourceRecordById(firstExecution.cutOrderId) : null;
  const baseAt = scenario?.notifiedAt || scenario?.quotedAt || scenario?.biddingDeadline || scenario?.dispatchedAt || "2026-03-22 08:00:00";
  const qty = scenario?.qty || originalRecord?.requiredQty || 0;
  const pricing = scenario?.dispatchPrice || scenario?.quotedPrice || scenario?.standardPrice || 6.5;
  const task = {
    taskId: record.taskId,
    taskNo: record.taskNo || record.taskId,
    productionOrderId: record.productionOrderId,
    seq: 1,
    processCode: "PROC_CUT",
    processNameZh: "\u88C1\u7247",
    stage: "CUTTING",
    qty,
    qtyUnit: "\u4EF6",
    assignmentMode: mapScenarioAssignmentMode(scenario?.origin || "DIRECT"),
    assignmentStatus: mapScenarioAssignmentStatus(scenario?.origin || "DIRECT"),
    ownerSuggestion: { kind: "MAIN_FACTORY" },
    assignedFactoryId: scenario?.assignedFactoryId || TEST_FACTORY_ID,
    assignedFactoryName: scenario?.assignedFactoryName || TEST_FACTORY_NAME,
    qcPoints: [],
    attachments: [],
    status: scenario?.taskStatus || "NOT_STARTED",
    acceptDeadline: scenario?.acceptDeadline || "2026-03-28 10:00:00",
    taskDeadline: scenario?.taskDeadline || "2026-03-28 20:00:00",
    dispatchRemark: scenario?.dispatchRemark || scenario?.taskSummaryNote || "PDA \u88C1\u7247\u6267\u884C\u6295\u5F71\u4EFB\u52A1",
    dispatchedAt: scenario?.dispatchedAt || baseAt,
    dispatchedBy: scenario?.dispatchedBy || "\u7CFB\u7EDF\u6D3E\u5355",
    standardPrice: pricing,
    standardPriceCurrency: scenario?.currency || "CNY",
    standardPriceUnit: scenario?.unit || scenario?.qtyUnit || "\u4EF6",
    dispatchPrice: scenario?.dispatchPrice,
    dispatchPriceCurrency: scenario?.currency || "CNY",
    dispatchPriceUnit: scenario?.unit || scenario?.qtyUnit || "\u4EF6",
    priceDiffReason: scenario?.priceDiffReason || (scenario?.origin === "DIRECT" ? "PDA \u88C1\u7247\u6295\u5F71\u6D3E\u5355\u4EF7" : "PDA \u88C1\u7247\u6295\u5F71\u62DB\u6807\u4EF7"),
    acceptanceStatus: scenario?.acceptanceStatus,
    acceptedAt: scenario?.acceptedAt,
    awardedAt: scenario?.notifiedAt,
    acceptedBy: scenario?.acceptedBy,
    tenderId: scenario?.tenderId,
    blockReason: scenario?.blockReason,
    blockRemark: scenario?.blockRemark,
    blockedAt: scenario?.blockedAt,
    startedAt: scenario?.startedAt,
    finishedAt: scenario?.finishedAt,
    rootTaskNo: record.taskNo || record.taskId,
    defaultDocType: "TASK",
    taskTypeMode: "PROCESS",
    createdAt: baseAt,
    updatedAt: baseAt,
    auditLogs: [
      {
        id: `AL-${record.taskId}`,
        action: scenario?.origin === "BIDDING_AWARDED" ? "AWARDED" : scenario?.origin === "BIDDING_PENDING" || scenario?.origin === "BIDDING_QUOTED" ? "BIDDING_OPEN" : "DISPATCHED",
        detail: scenario?.taskSummaryNote || (scenario?.origin === "BIDDING_AWARDED" ? "\u88C1\u7247\u7ADE\u4EF7\u4E2D\u6807\u540E\u5DF2\u540C\u6B65\u4E3A PDA \u6267\u884C\u4EFB\u52A1" : scenario?.origin === "BIDDING_PENDING" || scenario?.origin === "BIDDING_QUOTED" ? "\u88C1\u7247\u7ADE\u4EF7\u4EFB\u52A1\u5DF2\u540C\u6B65\u4E3A PDA \u6267\u884C\u6295\u5F71" : "\u88C1\u7247\u76F4\u63A5\u6D3E\u5355\u4EFB\u52A1\u5DF2\u540C\u6B65\u4E3A PDA \u6267\u884C\u6295\u5F71"),
        at: baseAt,
        by: "SYSTEM"
      }
    ]
  };
  return Object.assign(task, {
    productionOrderNo: firstExecution?.productionOrderNo || record.productionOrderNo
  });
}
function getMarkerStore(snapshot) {
  return snapshot.markerSpreadingState.store;
}
function listTaskFacts() {
  const runtimeTasks = listTaskChainTasks().filter(
    (task) => task.processBusinessCode !== "WOOL" && task.processCode !== "PROC_WOOL" && task.processCode !== "WOOL"
  );
  const runtimeTaskIds = new Set(runtimeTasks.map((task) => task.taskId));
  const genericTasks = listPdaGenericProcessTasks().filter((task) => !runtimeTaskIds.has(task.taskId));
  const existingAfterGenericIds = /* @__PURE__ */ new Set([...runtimeTaskIds, ...genericTasks.map((task) => task.taskId)]);
  const woolTasks = listWoolMobileProcessTasks().filter((task) => !existingAfterGenericIds.has(task.taskId));
  const genericTaskIds = /* @__PURE__ */ new Set([...genericTasks.map((task) => task.taskId), ...woolTasks.map((task) => task.taskId)]);
  const validCuttingCutOrderIds = new Set(listGeneratedCutOrderSourceRecords().map((record) => record.cutOrderId));
  const executableFallbackTaskIds = new Set(
    listPdaCuttingExecutionSourceRecords().filter((record) => validCuttingCutOrderIds.has(record.cutOrderId)).map((record) => record.taskId)
  );
  const fallbackCuttingTasks = listPdaCuttingTaskSourceRecords().filter((record) => executableFallbackTaskIds.has(record.taskId)).filter((record) => !runtimeTaskIds.has(record.taskId) && !genericTaskIds.has(record.taskId)).map((record) => buildFallbackCuttingTaskFact(record));
  return [...runtimeTasks, ...genericTasks, ...woolTasks, ...fallbackCuttingTasks];
}
function getRuntimeTask(taskId) {
  return getTaskChainTaskById(taskId) ?? null;
}
function getSourceExecutionsByTaskId(taskId) {
  return listPdaCuttingExecutionSourceRecords().filter((record) => record.taskId === taskId).sort((left, right) => left.executionOrderNo.localeCompare(right.executionOrderNo, "zh-CN"));
}
function getProgressLine(snapshot, execution) {
  for (const record of snapshot.progressRecords) {
    const line = record.materialLines.find((item) => item.cutOrderId === execution.cutOrderId || item.cutOrderNo === execution.cutOrderNo);
    if (line) return line;
  }
  return null;
}
function getCutOrderRecord(execution) {
  if (!execution.cutOrderId) return null;
  return getGeneratedCutOrderSourceRecordById(execution.cutOrderId);
}
function getLatestPickup(snapshot, execution) {
  const rows = snapshot.pdaExecutionState.pickupWritebacks;
  return rows.find((item) => item.executionOrderId === execution.executionOrderId || item.cutOrderId === execution.cutOrderId) ?? null;
}
function getLatestInbound(snapshot, execution) {
  const rows = snapshot.pdaExecutionState.inboundWritebacks;
  return rows.find((item) => item.executionOrderId === execution.executionOrderId || item.cutOrderId === execution.cutOrderId) ?? null;
}
function getLatestHandover(snapshot, execution) {
  const rows = snapshot.pdaExecutionState.handoverWritebacks;
  return rows.find((item) => item.executionOrderId === execution.executionOrderId || item.cutOrderId === execution.cutOrderId) ?? null;
}
function getLatestReplenishment(snapshot, execution) {
  const rows = snapshot.pdaExecutionState.replenishmentFeedbackWritebacks;
  return rows.find((item) => item.executionOrderId === execution.executionOrderId || item.cutOrderId === execution.cutOrderId) ?? null;
}
function listSessionsForExecution(snapshot, execution) {
  const store = getMarkerStore(snapshot);
  return (store.sessions || []).filter((session) => (session.cutOrderIds || []).includes(execution.cutOrderId) || execution.markerPlanId && session.markerPlanId === execution.markerPlanId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, "zh-CN"));
}
function listMarkersForExecution(snapshot, execution) {
  const store = getMarkerStore(snapshot);
  return (store.markers || []).filter((marker) => (marker.cutOrderIds || []).includes(execution.cutOrderId) || execution.markerPlanId && marker.markerPlanId === execution.markerPlanId).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, "zh-CN"));
}
function listCanonicalMarkerPlansForExecution(snapshot, execution) {
  const projection = buildMarkerPlanProjection(snapshot);
  return projection.viewModel.plans.filter(
    (plan) => plan.cutOrderIds.includes(execution.cutOrderId) || execution.markerPlanId && plan.markerPlanId === execution.markerPlanId
  ).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt, "zh-CN"));
}
function mapMarkerPlanModeToSpreadingMode(mode) {
  if (mode === "high_low") return "HIGH_LOW";
  if (mode === "fold_high_low") return "FOLD_HIGH_LOW";
  if (mode === "fold_normal") return "FOLD_NORMAL";
  return "NORMAL";
}
function buildSpreadingTargets(snapshot, execution) {
  const sessions = listSessionsForExecution(snapshot, execution);
  const sessionTargets = sessions.map((session) => ({
    targetKey: `session:${session.spreadingSessionId}`,
    targetType: "session",
    spreadingSessionId: session.spreadingSessionId,
    markerId: session.markerId || "",
    markerNo: session.markerNo || "",
    sourceMarkerLabel: session.sourceSchemeNo && (session.sourceBedNo || session.markerNo) ? `${session.sourceSchemeNo} / ${session.sourceBedNo || session.markerNo}` : session.markerNo || session.sourceMarkerNo || session.sessionNo || "\u5F85\u5173\u8054\u551B\u67B6\u7F16\u53F7",
    spreadingMode: mapSpreadingModeKey(session.spreadingMode),
    title: session.sessionNo || `\u94FA\u5E03\u5BF9\u8C61 ${session.spreadingSessionId.slice(-6)}`,
    contextLabel: "\u7EE7\u7EED\u5F53\u524D\u94FA\u5E03",
    statusLabel: session.status === "DONE" ? "\u5DF2\u5B8C\u6210" : session.status === "IN_PROGRESS" ? "\u8FDB\u884C\u4E2D" : session.status === "TO_FILL" ? "\u5F85\u8865\u5F55" : "\u8349\u7A3F",
    cutOrderNo: execution.cutOrderNo || "",
    markerPlanNo: execution.markerPlanNo || "",
    productionOrderNo: execution.productionOrderNo || "",
    materialSku: execution.materialSku || "",
    materialAlias: execution.materialAlias || "",
    materialImageUrl: execution.materialImageUrl || "",
    colorSummary: session.colorSummary || "",
    importedFromMarker: Boolean(session.importedFromMarker),
    planUnits: (session.planUnits?.length ? session.planUnits : void 0)?.map(toSpreadingPlanUnitOption) || buildFallbackPlanUnitsFromSession(session, execution)
  }));
  if (sessionTargets.length) return sessionTargets;
  const canonicalTargets = listCanonicalMarkerPlansForExecution(snapshot, execution).map((plan) => ({
    targetKey: `marker-plan:${plan.id}`,
    targetType: "session",
    spreadingSessionId: "",
    markerId: plan.id,
    markerNo: plan.markerNo || plan.contextNo || "",
    sourceMarkerLabel: plan.markerNo || plan.contextNo || "\u5F85\u5173\u8054\u551B\u67B6\u7F16\u53F7",
    spreadingMode: mapMarkerPlanModeToSpreadingMode(plan.markerMode),
    title: plan.markerNo || plan.contextNo || `\u94FA\u5E03\u5BF9\u8C61 ${execution.executionOrderNo}`,
    contextLabel: "\u5F85\u94FA\u5E03",
    statusLabel: "\u5F85\u94FA\u5E03",
    cutOrderNo: execution.cutOrderNo || "",
    markerPlanNo: plan.markerPlanNo || execution.markerPlanNo || "",
    productionOrderNo: execution.productionOrderNo || "",
    materialSku: execution.materialSku || plan.sourceMaterialSku || "",
    materialAlias: execution.materialAlias || plan.materialAliasSummary || "",
    materialImageUrl: execution.materialImageUrl || plan.materialImageUrl || "",
    colorSummary: plan.colorSummary || "",
    importedFromMarker: true,
    planUnits: buildPlanUnitsFromCanonicalPlan(plan, execution)
  }));
  if (canonicalTargets.length) return canonicalTargets;
  if (!isPdaSequenceMockTask(execution.taskId)) return [];
  const fallbackUnit = buildFallbackPlanUnitFromExecution(execution);
  return [{
    targetKey: `pda-sequence:${execution.executionOrderId}`,
    targetType: "session",
    spreadingSessionId: "",
    markerId: execution.markerPlanId || "",
    markerNo: execution.markerPlanNo || "A-1",
    sourceMarkerLabel: execution.markerPlanNo || "PDA \u9A8C\u8BC1\u551B\u67B6\u7F16\u53F7 A-1",
    spreadingMode: "NORMAL",
    title: `\u94FA\u5E03\u5355 ${execution.taskId}`,
    contextLabel: "\u5F85\u94FA\u5E03",
    statusLabel: "\u5F85\u94FA\u5E03",
    cutOrderNo: execution.cutOrderNo || "",
    markerPlanNo: execution.markerPlanNo || "",
    productionOrderNo: execution.productionOrderNo || "",
    materialSku: execution.materialSku || fallbackUnit.materialSku || "",
    materialAlias: execution.materialAlias || fallbackUnit.materialAlias || "",
    materialImageUrl: execution.materialImageUrl || fallbackUnit.materialImageUrl || "",
    colorSummary: fallbackUnit.color || "",
    importedFromMarker: true,
    planUnits: [fallbackUnit]
  }];
}
function getScenarioSpreadingPreset(execution) {
  return pdaCuttingScenarioSpreadingPresetByExecutionId.get(execution.executionOrderId) ?? null;
}
function listRollsForExecution(snapshot, execution) {
  return listSessionsForExecution(snapshot, execution).flatMap(
    (session) => session.rolls.map((roll) => ({ session, roll }))
  );
}
function listOperatorsForExecution(snapshot, execution) {
  return listSessionsForExecution(snapshot, execution).flatMap(
    (session) => session.operators.map((operator) => ({ session, operator }))
  );
}
function buildReplenishmentLabel(latestReplenishment) {
  if (!latestReplenishment) return "\u5F53\u524D\u65E0\u73B0\u573A\u5DEE\u5F02";
  if (latestReplenishment.lifecycleStatus === "CLOSED") return `${latestReplenishment.reasonLabel}\uFF0C\u5DF2\u5173\u95ED`;
  if (latestReplenishment.lifecycleStatus === "PENDING") return `${latestReplenishment.reasonLabel}\uFF0C\u5F85\u5DE5\u827A\u5DE5\u5382\u8DDF\u8FDB`;
  return `${latestReplenishment.reasonLabel}\uFF0C\u5DF2\u63D0\u4EA4\u73B0\u573A\u5DEE\u5F02\u53CD\u9988`;
}
function includesAny(value, keywords) {
  if (!value) return false;
  return keywords.some((keyword) => value.includes(keyword));
}
function hasPendingReplenishmentRisk(label) {
  return !includesAny(label, ["\u5F53\u524D\u65E0\u73B0\u573A\u5DEE\u5F02", "\u6682\u65E0\u73B0\u573A\u5DEE\u5F02", "\u65E0\u9700\u5904\u7406", "\u5DF2\u5173\u95ED"]);
}
function isReceiveCompleted(status) {
  return includesAny(status, ["\u6765\u6599\u5DF2\u5165\u4ED3", "\u5DF2\u56DE\u6267", "\u5DF2\u9886\u53D6"]);
}
function isSpreadingCompleted(status) {
  return includesAny(status, ["\u94FA\u5E03\u5DF2\u5B8C\u6210"]);
}
function isHandoverCompleted(status) {
  return includesAny(status, ["\u5DF2\u4EA4\u63A5"]);
}
function isInboundCompleted(status) {
  return includesAny(status, ["\u5DF2\u5165\u4ED3"]);
}
function resolveCurrentStepCode(input) {
  if (input.mobileStage === "WAIT_PICKUP") return "PICKUP";
  if (input.mobileStage === "WAIT_START") return "START";
  if (input.mobileStage === "WAIT_SPREADING" || input.mobileStage === "SPREADING" || input.mobileStage === "WAIT_CUTTING" || input.mobileStage === "CUTTING") return "SPREADING";
  return "DONE";
}
function resolveMobileStageLabel(stage) {
  if (stage === "WAIT_PICKUP") return "\u5F85\u9886\u6599";
  if (stage === "WAIT_START") return "\u5F85\u5F00\u5DE5";
  if (stage === "WAIT_SPREADING") return "\u5F85\u94FA\u5E03";
  if (stage === "SPREADING") return "\u94FA\u5E03\u4E2D";
  if (stage === "WAIT_CUTTING") return "\u5F85\u88C1\u526A";
  if (stage === "CUTTING") return "\u88C1\u526A\u4E2D";
  return "\u5DF2\u88C1\u526A";
}
function resolveNextAction(line) {
  if (line.taskStatus === "CANCELLED" || line.taskStatus === "BLOCKED") return "\u67E5\u770B\u63D0\u4EA4\u7ED3\u679C";
  if (line.mobileStage === "WAIT_PICKUP") return "\u53BB\u9886\u6599";
  if (line.mobileStage === "WAIT_START") return "\u5F00\u5DE5";
  if (line.mobileStage === "WAIT_SPREADING") return "\u5F00\u59CB\u94FA\u5E03";
  if (line.mobileStage === "SPREADING") return "\u5B8C\u6210\u94FA\u5E03";
  if (line.mobileStage === "WAIT_CUTTING") return "\u5F00\u59CB\u88C1\u526A";
  if (line.mobileStage === "CUTTING") return "\u5B8C\u6210\u88C1\u526A";
  return "\u67E5\u770B\u63D0\u4EA4\u7ED3\u679C";
}
function resolveCurrentState(line) {
  if (line.bindingState === "UNBOUND") return "\u5F85\u7ED1\u5B9A";
  if (line.taskStatus === "CANCELLED") return "\u5DF2\u4E2D\u6B62";
  if (line.taskStatus === "BLOCKED" && line.currentExecutionStatus.includes("\u6682\u505C")) return "\u6267\u884C\u6682\u505C";
  if (line.hasException && !line.pickupSuccess) return "\u9886\u6599\u5DEE\u5F02\u5F85\u5904\u7406";
  if (!line.pickupSuccess) return "\u5F85\u88C1\u5E8A\u9886\u6599";
  if (line.taskStatus === "NOT_STARTED") return "\u5F85\u5F00\u5DE5";
  if (line.currentExecutionStatus === "\u5F85\u94FA\u5E03") return "\u5F85\u94FA\u5E03";
  if (line.currentExecutionStatus === "\u94FA\u5E03\u4E2D") return "\u94FA\u5E03\u4E2D";
  if (line.currentExecutionStatus === "\u5DF2\u94FA\u5E03\u5F85\u88C1\u526A") return "\u5F85\u88C1\u526A";
  if (line.currentExecutionStatus === "\u88C1\u526A\u4E2D") return "\u88C1\u526A\u4E2D";
  if (line.currentExecutionStatus === "\u5DF2\u88C1\u526A") return "\u5DF2\u88C1\u526A";
  if (line.replenishmentLabel.includes("\u5F85\u5DE5\u827A\u5DE5\u5382\u8DDF\u8FDB")) return "\u73B0\u573A\u5DEE\u5F02\u5F85\u5173\u6CE8";
  return line.currentExecutionStatus || "\u5F85\u94FA\u5E03";
}
function resolvePrimaryExecutionRouteKey(input) {
  if (input.bindingState === "UNBOUND") return "spreading";
  if (input.taskStatus === "CANCELLED") return "handover";
  if (input.taskStatus === "BLOCKED" && input.replenishmentLabel !== "\u5F53\u524D\u65E0\u73B0\u573A\u5DEE\u5F02") return "replenishment-feedback";
  if (input.currentStepCode === "PICKUP") return "spreading";
  if (input.currentStepCode === "SPREADING") return "spreading";
  if (input.currentStepCode === "REPLENISHMENT") return "replenishment-feedback";
  if (input.currentStepCode === "INBOUND") return "inbound";
  if (input.currentStepCode === "HANDOVER") return "handover";
  return "handover";
}
function hasSyncedAction(records, actionType) {
  return records.some((record) => record.actionType === actionType && record.syncStatus !== "\u540C\u6B65\u5931\u8D25");
}
function latestSyncedAction(records) {
  return records.find((record) => record.syncStatus !== "\u540C\u6B65\u5931\u8D25") ?? null;
}
function isPdaSequenceMockTask(taskId) {
  return Boolean(taskId?.startsWith("TASK-CUT-PDA-"));
}
function resolveMobileStage(input) {
  if (!input.hasPickupSuccess) return "WAIT_PICKUP";
  if (!input.hasStarted) return "WAIT_START";
  const latestSynced = latestSyncedAction(input.stageActions);
  if (latestSynced?.actionType === "FINISH_CUTTING") return "CUT_DONE";
  if (latestSynced?.actionType === "START_CUTTING") return "CUTTING";
  if (latestSynced?.actionType === "FINISH_SPREADING") return "WAIT_CUTTING";
  if (latestSynced?.actionType === "START_SPREADING") return "SPREADING";
  if (input.taskStatus === "DONE") return "CUT_DONE";
  if (input.preset?.status === "CUT_DONE") return "CUT_DONE";
  if (input.preset?.status === "CUTTING") return "CUTTING";
  if (input.preset?.status === "DONE") return "WAIT_CUTTING";
  if (input.preset?.status === "STARTED") return "SPREADING";
  const latestSession = input.sessions[0] ?? null;
  if (latestSession?.status === "DONE") return "WAIT_CUTTING";
  if (latestSession?.status === "IN_PROGRESS") return "SPREADING";
  return "WAIT_SPREADING";
}
function buildSyncSummary(record) {
  if (!record) return "\u6682\u65E0\u63D0\u4EA4";
  return `${record.syncStatus}\uFF1A${record.actionLabel}${record.varianceFlag ? "\uFF08\u5DF2\u6807\u8BB0\u5DEE\u5F02\uFF09" : ""} / ${record.submittedAt}`;
}
function listRiskTips(line) {
  const tips = [];
  if (line.disputeSummary) tips.push(line.disputeSummary);
  if (!line.hasInbound) tips.push("\u5F53\u524D\u5C1A\u672A\u5B8C\u6210\u5165\u4ED3\u626B\u7801\uFF0C\u540E\u7EED\u4ED3\u52A1\u65E0\u6CD5\u7A33\u5B9A\u56DE\u6D41\u3002");
  if (!line.hasHandover) tips.push("\u5F53\u524D\u5C1A\u672A\u5B8C\u6210\u4EA4\u63A5\u626B\u7801\uFF0C\u540E\u9053\u627F\u63A5\u72B6\u6001\u672A\u95ED\u73AF\u3002");
  if (line.replenishmentLabel !== "\u5F53\u524D\u65E0\u73B0\u573A\u5DEE\u5F02") tips.push(line.replenishmentLabel);
  return unique(tips);
}
function buildTaskOrderLine(execution, sortOrder, snapshot) {
  const scenario = getPdaCuttingTaskScenarioByTaskId(execution.taskId);
  const progressLine = getProgressLine(snapshot, execution);
  const originalRecord = getCutOrderRecord(execution);
  const latestPickup = getLatestPickup(snapshot, execution);
  const latestInbound = getLatestInbound(snapshot, execution);
  const latestHandover = getLatestHandover(snapshot, execution);
  const latestReplenishment = getLatestReplenishment(snapshot, execution);
  const sessions = listSessionsForExecution(snapshot, execution);
  const preset = getScenarioSpreadingPreset(execution);
  const stageActions = listPdaCuttingStageWritebacksByExecution(execution.taskId, execution.executionOrderId);
  const latestStageAction = getLatestPdaCuttingStageWritebackByExecution(execution.taskId, execution.executionOrderId);
  const pickupDispute = execution.cutOrderNo ? getLatestClaimDisputeByCutOrderNo(execution.cutOrderNo) : null;
  const hasInbound = Boolean(latestInbound);
  const hasHandover = Boolean(latestHandover);
  const hasDownstreamWarehouseSignal = hasInbound || hasHandover;
  const useExplicitPickupWriteback = isPdaSequenceMockTask(execution.taskId);
  const currentReceiveStatus = pickupDispute && pickupDispute.status !== "COMPLETED" && pickupDispute.status !== "REJECTED" ? "\u6765\u6599\u5F02\u8BAE\u5904\u7406\u4E2D" : latestPickup?.resultLabel || (useExplicitPickupWriteback ? "\u5F85\u88C1\u5E8A\u9886\u6599" : hasDownstreamWarehouseSignal ? "\u6765\u6599\u5DF2\u5165\u4ED3" : mapReceiveStatusLabel(progressLine?.receiveStatus));
  const hasPickupSuccess = Boolean(latestPickup?.resultLabel?.includes("\u6210\u529F")) || !useExplicitPickupWriteback && (progressLine?.receiveStatus === "RECEIVED" || hasDownstreamWarehouseSignal);
  const hasStarted = scenario?.taskStatus === "IN_PROGRESS" || scenario?.taskStatus === "DONE" || scenario?.taskStatus === "BLOCKED" || Boolean(scenario?.startedAt) || hasSyncedAction(stageActions, "START_WORK");
  const mobileStage = resolveMobileStage({
    taskStatus: scenario?.taskStatus || "NOT_STARTED",
    hasPickupSuccess,
    hasStarted,
    stageActions,
    preset,
    sessions
  });
  const hasSpreading = mobileStage === "SPREADING" || mobileStage === "WAIT_CUTTING" || mobileStage === "CUTTING" || mobileStage === "CUT_DONE";
  const currentExecutionStatus = execution.bindingState === "UNBOUND" ? "\u5F85\u7ED1\u5B9A\u88C1\u7247\u5355" : mobileStage === "WAIT_PICKUP" ? "\u5F85\u9886\u6599" : mobileStage === "WAIT_START" ? "\u5F85\u5F00\u5DE5" : scenario?.taskStatus === "CANCELLED" ? "\u6267\u884C\u5DF2\u4E2D\u6B62" : preset?.status === "BLOCKED" || scenario?.taskStatus === "BLOCKED" ? "\u94FA\u5E03\u5DF2\u6682\u505C" : mobileStage === "WAIT_SPREADING" ? "\u5F85\u94FA\u5E03" : mobileStage === "SPREADING" ? "\u94FA\u5E03\u4E2D" : mobileStage === "WAIT_CUTTING" ? "\u5DF2\u94FA\u5E03\u5F85\u88C1\u526A" : mobileStage === "CUTTING" ? "\u88C1\u526A\u4E2D" : "\u5DF2\u88C1\u526A";
  const currentInboundStatus = latestInbound ? "\u5DF2\u5165\u4ED3" : "\u5F85\u5165\u4ED3\u626B\u7801";
  const currentHandoverStatus = latestHandover ? "\u5DF2\u4EA4\u63A5" : "\u5F85\u4EA4\u63A5\u626B\u7801";
  const replenishmentRiskLabel = buildReplenishmentLabel(latestReplenishment);
  const hasException = currentReceiveStatus.includes("\u5F02\u8BAE") || currentReceiveStatus.includes("\u5DEE\u5F02") || replenishmentRiskLabel.includes("\u5F85\u5DE5\u827A\u5DE5\u5382\u8DDF\u8FDB") || execution.bindingState === "UNBOUND" || currentExecutionStatus.includes("\u6682\u505C") || currentExecutionStatus.includes("\u4E2D\u6B62");
  const currentStepCode = resolveCurrentStepCode({
    mobileStage
  });
  const currentStepLabel = resolveMobileStageLabel(mobileStage);
  const currentStateLabel = resolveCurrentState({
    bindingState: execution.bindingState,
    taskStatus: scenario?.taskStatus || "NOT_STARTED",
    currentExecutionStatus,
    pickupSuccess: hasPickupSuccess,
    hasSpreading,
    hasInbound,
    hasHandover,
    replenishmentLabel: replenishmentRiskLabel,
    hasException
  });
  const primaryExecutionRouteKey = resolvePrimaryExecutionRouteKey({
    bindingState: execution.bindingState,
    taskStatus: scenario?.taskStatus || "NOT_STARTED",
    currentStepCode,
    replenishmentLabel: replenishmentRiskLabel,
    hasException
  });
  const latestSyncStatus = latestStageAction?.syncStatus || (latestPickup ? "\u5DF2\u540C\u6B65" : "\u6682\u65E0\u63D0\u4EA4");
  const latestSyncSummary = latestStageAction ? buildSyncSummary(latestStageAction) : latestPickup ? `\u5DF2\u540C\u6B65\uFF1A\u9886\u6599 / ${latestPickup.submittedAt}` : "\u6682\u65E0\u63D0\u4EA4";
  return {
    executionOrderId: execution.executionOrderId,
    executionOrderNo: execution.executionOrderNo,
    productionOrderId: execution.productionOrderId,
    productionOrderNo: execution.productionOrderNo,
    cutOrderId: execution.cutOrderId,
    cutOrderNo: execution.cutOrderNo,
    markerPlanId: execution.markerPlanId,
    markerPlanNo: execution.markerPlanNo,
    materialSku: execution.materialSku,
    materialAlias: execution.materialAlias || originalRecord?.materialAlias || "",
    materialImageUrl: execution.materialImageUrl || originalRecord?.materialImageUrl || "",
    bindingState: execution.bindingState,
    materialTypeLabel: mapMaterialTypeLabel(originalRecord),
    colorLabel: originalRecord?.colorScope.join(" / ") || progressLine?.color || (execution.bindingState === "UNBOUND" ? "\u5F85\u7ED1\u5B9A" : ""),
    plannedQty: originalRecord?.requiredQty || scenario?.qty || 0,
    currentReceiveStatus,
    currentExecutionStatus,
    currentInboundStatus,
    currentHandoverStatus,
    replenishmentRiskLabel,
    currentStateLabel,
    currentStepCode,
    currentStepLabel,
    primaryExecutionRouteKey,
    nextActionLabel: resolveNextAction({
      mobileStage,
      taskStatus: scenario?.taskStatus || "NOT_STARTED",
      hasException
    }),
    mobileStage,
    latestSyncStatus,
    latestSyncSummary,
    qrCodeValue: buildQrCodeValue(execution.cutOrderNo || execution.executionOrderNo),
    pickupSlipNo: buildPickupSlipNo(execution.cutOrderNo || execution.executionOrderNo),
    isDone: mobileStage === "CUT_DONE" || scenario?.taskStatus === "DONE",
    hasException,
    sortOrder
  };
}
function buildPickupLogs(snapshot, execution) {
  const latestPickup = getLatestPickup(snapshot, execution);
  if (!latestPickup) return [];
  return [{
    executionOrderId: execution.executionOrderId,
    id: latestPickup.writebackId,
    scannedAt: latestPickup.submittedAt,
    operatorName: latestPickup.operatorName,
    resultLabel: latestPickup.resultLabel,
    note: latestPickup.discrepancyNote,
    photoProofCount: latestPickup.photoProofCount
  }];
}
function buildSpreadingRecords(snapshot, execution) {
  const actualRecords = listRollsForExecution(snapshot, execution).map(({ session, roll }) => {
    const linkedOperators = session.operators.filter((operator) => operator.rollRecordId === roll.rollRecordId);
    const latestOperator = [...linkedOperators].sort((left, right) => right.endAt.localeCompare(left.endAt, "zh-CN"))[0] || linkedOperators[0] || null;
    const latestHandoverOperator = [...linkedOperators].sort((left, right) => right.endAt.localeCompare(left.endAt, "zh-CN")).find(
      (operator) => operator.actionType === "\u4E2D\u9014\u4EA4\u63A5" || operator.actionType === "\u63A5\u624B\u7EE7\u7EED" || operator.handoverFlag
    ) || null;
    const handoverResultLabel = latestHandoverOperator?.actionType === "\u63A5\u624B\u7EE7\u7EED" ? `\u63A5\u624B\u81EA\uFF1A${latestHandoverOperator.previousOperatorName || "\u4E0A\u4E00\u4F4D\u94FA\u5E03\u5458"}` : latestHandoverOperator?.actionType === "\u4E2D\u9014\u4EA4\u63A5" ? `\u4EA4\u63A5\u7ED9\uFF1A${latestHandoverOperator.nextOperatorName || "\u4E0B\u4E00\u4F4D\u94FA\u5E03\u5458"}` : "\u65E0\u6362\u73ED";
    return {
      executionOrderId: execution.executionOrderId,
      id: roll.rollRecordId,
      spreadingSessionId: session.spreadingSessionId,
      planUnitId: roll.planUnitId || "",
      rollRecordId: roll.rollRecordId,
      operatorRecordId: latestOperator?.operatorRecordId || "",
      markerId: session.markerId || "",
      markerNo: session.markerNo || "",
      fabricRollNo: roll.rollNo,
      layerCount: roll.layerCount,
      actualLength: roll.actualLength,
      headLength: roll.headLength,
      tailLength: roll.tailLength,
      calculatedLength: roll.actualLength + roll.headLength + roll.tailLength,
      usableLength: roll.usableLength,
      enteredBy: latestOperator?.operatorName || roll.operatorNames[0] || session.operators[0]?.operatorName || "\u73B0\u573A\u94FA\u5E03\u5458",
      enteredByAccountId: latestOperator?.operatorAccountId || "",
      enteredAt: roll.updatedFromPdaAt || latestOperator?.endAt || session.updatedAt,
      sourceType: roll.sourceChannel === "PDA_WRITEBACK" ? "PDA" : "PCS",
      sourceWritebackId: roll.sourceWritebackId || "",
      sourceRollWritebackItemId: roll.rollRecordId,
      handoverFlag: latestHandoverOperator !== null,
      handoverResultLabel,
      note: roll.note
    };
  });
  if (actualRecords.length > 0) return actualRecords;
  const preset = getScenarioSpreadingPreset(execution);
  if (!preset) return [];
  return [
    {
      executionOrderId: execution.executionOrderId,
      id: preset.recordId,
      spreadingSessionId: "",
      planUnitId: "",
      rollRecordId: "",
      operatorRecordId: "",
      markerId: "",
      markerNo: "",
      fabricRollNo: preset.fabricRollNo,
      layerCount: preset.layerCount,
      actualLength: preset.actualLength,
      headLength: preset.headLength,
      tailLength: preset.tailLength,
      calculatedLength: preset.actualLength + preset.headLength + preset.tailLength,
      usableLength: Math.max(preset.actualLength - preset.headLength - preset.tailLength, 0),
      enteredBy: preset.enteredBy,
      enteredByAccountId: "",
      enteredAt: preset.enteredAt,
      sourceType: "PDA",
      sourceWritebackId: "",
      sourceRollWritebackItemId: "",
      handoverFlag: false,
      handoverResultLabel: "\u65E0\u6362\u73ED",
      note: preset.note
    }
  ];
}
function buildPdaCuttingSpreadingTraceMatrix(snapshot = buildFcsCuttingDomainSnapshot()) {
  return listPdaCuttingExecutionSourceRecords().flatMap(
    (execution) => buildSpreadingRecords(snapshot, execution).filter((record) => Boolean(record.spreadingSessionId)).map((record) => ({
      taskId: execution.taskId,
      executionOrderId: execution.executionOrderId,
      executionOrderNo: execution.executionOrderNo,
      cutOrderId: execution.cutOrderId,
      cutOrderNo: execution.cutOrderNo,
      markerPlanId: execution.markerPlanId,
      markerPlanNo: execution.markerPlanNo,
      spreadingSessionId: record.spreadingSessionId,
      markerId: record.markerId,
      markerNo: record.markerNo,
      sourceWritebackId: record.sourceWritebackId || "",
      planUnitId: record.planUnitId || "",
      rollRecordId: record.rollRecordId || "",
      operatorRecordId: record.operatorRecordId || ""
    }))
  ).sort(
    (left, right) => left.executionOrderNo.localeCompare(right.executionOrderNo, "zh-CN") || left.spreadingSessionId.localeCompare(right.spreadingSessionId, "zh-CN") || left.rollRecordId.localeCompare(right.rollRecordId, "zh-CN")
  );
}
function buildInboundRecords(snapshot, execution) {
  const latestInbound = getLatestInbound(snapshot, execution);
  if (!latestInbound) return [];
  return [{
    executionOrderId: execution.executionOrderId,
    id: latestInbound.writebackId,
    scannedAt: latestInbound.submittedAt,
    operatorName: latestInbound.operatorName,
    zoneCode: latestInbound.zoneCode,
    locationLabel: latestInbound.locationLabel,
    note: latestInbound.note
  }];
}
function buildHandoverRecords(snapshot, execution) {
  const latestHandover = getLatestHandover(snapshot, execution);
  if (!latestHandover) return [];
  return [{
    executionOrderId: execution.executionOrderId,
    id: latestHandover.writebackId,
    handoverAt: latestHandover.submittedAt,
    operatorName: latestHandover.operatorName,
    targetLabel: latestHandover.targetLabel,
    resultLabel: "\u4EA4\u63A5\u626B\u7801\u786E\u8BA4\u5B8C\u6210",
    note: latestHandover.note
  }];
}
function buildReplenishmentRecords(snapshot, execution) {
  const latestReplenishment = getLatestReplenishment(snapshot, execution);
  if (!latestReplenishment) return [];
  return [{
    executionOrderId: execution.executionOrderId,
    id: latestReplenishment.writebackId,
    feedbackAt: latestReplenishment.submittedAt,
    operatorName: latestReplenishment.operatorName,
    reasonLabel: latestReplenishment.reasonLabel,
    note: latestReplenishment.note,
    photoProofCount: latestReplenishment.photoProofCount
  }];
}
function buildRecentActions(input) {
  const actions = [];
  const latestPickup = input.pickupLogs[0];
  if (latestPickup) {
    actions.push({
      actionType: "PICKUP",
      actionTypeLabel: "\u626B\u7801\u9886\u53D6",
      operatedBy: latestPickup.operatorName,
      operatedAt: latestPickup.scannedAt,
      summary: latestPickup.resultLabel
    });
  }
  const latestSpreading = input.spreadingRecords[0];
  if (latestSpreading) {
    actions.push({
      actionType: "SPREADING",
      actionTypeLabel: "\u94FA\u5E03\u5F55\u5165",
      operatedBy: latestSpreading.enteredBy,
      operatedAt: latestSpreading.enteredAt,
      summary: `${latestSpreading.fabricRollNo} / ${latestSpreading.layerCount} \u5C42`
    });
  }
  const latestInbound = input.inboundRecords[0];
  if (latestInbound) {
    actions.push({
      actionType: "INBOUND",
      actionTypeLabel: "\u5165\u4ED3\u626B\u7801",
      operatedBy: latestInbound.operatorName,
      operatedAt: latestInbound.scannedAt,
      summary: `${latestInbound.zoneCode} \u533A / ${latestInbound.locationLabel}`
    });
  }
  const latestHandover = input.handoverRecords[0];
  if (latestHandover) {
    actions.push({
      actionType: "HANDOVER",
      actionTypeLabel: "\u4EA4\u63A5\u626B\u7801",
      operatedBy: latestHandover.operatorName,
      operatedAt: latestHandover.handoverAt,
      summary: latestHandover.targetLabel
    });
  }
  const latestReplenishment = input.replenishmentFeedbacks[0];
  if (latestReplenishment) {
    actions.push({
      actionType: "REPLENISHMENT",
      actionTypeLabel: "\u73B0\u573A\u5DEE\u5F02\u53CD\u9988",
      operatedBy: latestReplenishment.operatorName,
      operatedAt: latestReplenishment.feedbackAt,
      summary: latestReplenishment.reasonLabel
    });
  }
  return actions.sort((left, right) => right.operatedAt.localeCompare(left.operatedAt, "zh-CN"));
}
function buildTaskProgressLabel(completedCount, totalCount) {
  if (!totalCount) return "\u6682\u65E0\u6267\u884C\u5BF9\u8C61";
  return `${completedCount}/${totalCount} \u4E2A\u6267\u884C\u5BF9\u8C61\u5DF2\u5B8C\u6210`;
}
function resolveTaskStateLabel(completedCount, totalCount, exceptionCount, taskStatus) {
  if (taskStatus === "CANCELLED") return "\u5DF2\u4E2D\u6B62";
  if (exceptionCount > 0) return "\u6709\u5F02\u5E38";
  if (totalCount > 0 && completedCount === totalCount) return "\u5DF2\u5B8C\u6210";
  if (taskStatus === "IN_PROGRESS") return "\u8FDB\u884C\u4E2D";
  if (taskStatus === "BLOCKED") return "\u6709\u5F02\u5E38";
  return "\u5F85\u5F00\u59CB";
}
function resolveTaskSummary(executions) {
  const first = executions[0];
  const completedCount = executions.filter((item) => item.isDone).length;
  const blockedCount = executions.filter((item) => item.currentExecutionStatus.includes("\u6682\u505C")).length;
  const cancelledCount = executions.filter((item) => item.currentExecutionStatus.includes("\u4E2D\u6B62")).length;
  return {
    currentStage: cancelledCount > 0 ? "\u5B58\u5728\u5DF2\u4E2D\u6B62\u6267\u884C" : blockedCount > 0 ? "\u5B58\u5728\u6682\u505C\u6267\u884C" : completedCount === executions.length && executions.length > 0 ? "\u5DF2\u5168\u90E8\u5B8C\u6210" : first?.currentStateLabel || "\u5F85\u5F00\u59CB",
    materialSku: executions.length === 1 ? first?.materialSku : `${unique(executions.map((item) => item.materialSku)).length} \u79CD\u9762\u6599`,
    materialTypeLabel: first?.materialTypeLabel || "",
    pickupSlipNo: first?.pickupSlipNo || "",
    qrCodeValue: first?.qrCodeValue || "",
    receiveSummary: executions.some((item) => item.currentReceiveStatus.includes("\u5F02\u8BAE")) ? "\u5B58\u5728\u6765\u6599\u5F02\u8BAE" : executions.every((item) => isReceiveCompleted(item.currentReceiveStatus)) ? "\u6765\u6599\u5DF2\u5165\u5F85\u52A0\u5DE5\u4ED3" : "\u5F85\u52A0\u5DE5\u4ED3\u672A\u5165",
    executionSummary: executions.some((item) => item.currentExecutionStatus.includes("\u6682\u505C")) ? "\u5B58\u5728\u94FA\u5E03\u6682\u505C" : executions.some((item) => item.currentExecutionStatus.includes("\u5B8C\u6210")) ? "\u5DF2\u6709\u94FA\u5E03\u5B8C\u6210\u8BB0\u5F55" : executions.some((item) => item.currentExecutionStatus.includes("\u8FDB\u884C\u4E2D")) ? "\u5DF2\u6709\u94FA\u5E03\u8FDB\u884C\u4E2D\u8BB0\u5F55" : executions.some((item) => item.currentExecutionStatus.includes("\u5F85\u7ED1\u5B9A")) ? "\u5B58\u5728\u5F85\u7ED1\u5B9A\u6267\u884C\u5BF9\u8C61" : "\u5F85\u5F00\u59CB\u94FA\u5E03",
    handoverSummary: "\u540E\u7EED\u9636\u6BB5\u5904\u7406"
  };
}
function buildProjectedTask(task, snapshot) {
  const executionRecords = getSourceExecutionsByTaskId(task.taskId);
  if (!executionRecords.length) {
    const genericTask = task;
    const isSpecialCraftTask = task.processNameZh?.includes("\u7279\u6B8A\u5DE5\u827A") || task.processBusinessName?.includes("\u7279\u6B8A\u5DE5\u827A");
    const isCuttingTask = task.processNameZh === "\u88C1\u7247" || task.processBusinessName === "\u88C1\u7247";
    const shouldUseDemoFactory = isSpecialCraftTask || isCuttingTask;
    return Object.assign(task, {
      assignedFactoryId: task.assignedFactoryId || (shouldUseDemoFactory ? TEST_FACTORY_ID : task.assignedFactoryId),
      assignedFactoryName: task.assignedFactoryName || (shouldUseDemoFactory ? TEST_FACTORY_NAME : task.assignedFactoryName),
      taskType: "PROCESS",
      taskTypeLabel: task.taskCategoryZh || `${task.processNameZh}\u4EFB\u52A1`,
      factoryType: "FACTORY",
      factoryTypeLabel: "\u5DE5\u5382\u6267\u884C",
      supportsCuttingSpecialActions: false,
      entryMode: "DEFAULT",
      summary: {
        currentStage: mapTaskStatusLabel(task.status),
        receiveSummary: genericTask.mockReceiveSummary || "-",
        executionSummary: genericTask.mockExecutionSummary || "-",
        handoverSummary: genericTask.mockHandoverSummary || "-"
      }
    });
  }
  const executionRows = executionRecords.map((record, index) => buildTaskOrderLine(record, index + 1, snapshot));
  const completedCount = executionRows.filter((item) => item.isDone).length;
  const exceptionCount = executionRows.filter((item) => item.hasException).length;
  const defaultExecution = executionRows.find((item) => !item.isDone) || executionRows[0];
  return Object.assign(task, {
    taskType: "CUTTING",
    taskTypeLabel: "\u88C1\u7247\u4EFB\u52A1",
    factoryType: "CUTTING_WORKSHOP",
    factoryTypeLabel: "\u88C1\u7247\u6267\u884C",
    supportsCuttingSpecialActions: true,
    entryMode: "CUTTING_SPECIAL",
    productionOrderNo: executionRecords[0]?.productionOrderNo || task.productionOrderId,
    cutOrderIds: unique(executionRecords.map((item) => item.cutOrderId).filter(Boolean)),
    cutOrderNos: unique(executionRecords.map((item) => item.cutOrderNo).filter(Boolean)),
    markerPlanIds: unique(executionRecords.map((item) => item.markerPlanId).filter(Boolean)),
    markerPlanNos: unique(executionRecords.map((item) => item.markerPlanNo).filter(Boolean)),
    executionOrderIds: executionRows.map((item) => item.executionOrderId),
    executionOrderNos: executionRows.map((item) => item.executionOrderNo),
    defaultExecutionOrderId: defaultExecution?.executionOrderId || "",
    defaultExecutionOrderNo: defaultExecution?.executionOrderNo || "",
    cutPieceOrderCount: executionRows.length,
    completedCutPieceOrderCount: completedCount,
    pendingCutPieceOrderCount: executionRows.length - completedCount,
    exceptionCutPieceOrderCount: exceptionCount,
    taskProgressLabel: buildTaskProgressLabel(completedCount, executionRows.length),
    taskStateLabel: resolveTaskStateLabel(completedCount, executionRows.length, exceptionCount, task.status),
    taskNextActionLabel: defaultExecution?.nextActionLabel || "\u67E5\u770B\u4EFB\u52A1",
    hasMultipleCutPieceOrders: executionRows.length > 1,
    taskReadyForDirectExec: executionRows.length === 1,
    summary: resolveTaskSummary(executionRows)
  });
}
function isCuttingSpecialTask(task) {
  if (!task) return false;
  if (typeof task === "string") return Boolean(getPdaCuttingTaskSourceRecord(task));
  return task.taskType === "CUTTING" || task.supportsCuttingSpecialActions === true || Boolean(task.taskId && getPdaCuttingTaskSourceRecord(task.taskId));
}
function listPdaTaskFlowProjectedTasks(snapshot) {
  const currentSnapshot = getSnapshot(snapshot);
  return listTaskFacts().map((task) => buildProjectedTask(task, currentSnapshot)).sort((left, right) => (left.taskNo || left.taskId).localeCompare(right.taskNo || right.taskId, "zh-CN"));
}
function listPdaTaskFlowTasks(snapshot) {
  return listPdaTaskFlowProjectedTasks(snapshot);
}
function getPdaTaskFlowTaskById(taskId, snapshot) {
  return listPdaTaskFlowProjectedTasks(snapshot).find((task) => task.taskId === taskId) ?? null;
}
function listPdaOrdinaryTaskMocks(snapshot) {
  return listPdaTaskFlowProjectedTasks(snapshot).filter((task) => !isCuttingSpecialTask(task));
}
function listPdaCuttingTaskMocks(snapshot) {
  return listPdaTaskFlowProjectedTasks(snapshot).filter((task) => isCuttingSpecialTask(task));
}
function resolveExecutionRecord(taskId, executionKey) {
  const executionRecords = getSourceExecutionsByTaskId(taskId);
  if (!executionRecords.length) return null;
  if (!executionKey && executionRecords.length === 1) return executionRecords[0];
  if (!executionKey) return executionRecords[0] ?? null;
  return executionRecords.find((record) => matchPdaExecutionRecord(record, executionKey)) ?? null;
}
function listPdaCuttingTaskRefs(snapshot) {
  return listPdaCuttingTaskMocks(snapshot);
}
function listPdaCuttingExecutionRowsByTaskId(taskId, snapshot) {
  const currentSnapshot = getSnapshot(snapshot);
  return getSourceExecutionsByTaskId(taskId).map((record, index) => buildTaskOrderLine(record, index + 1, currentSnapshot));
}
function getPdaCuttingExecutionSnapshot(taskId, executionKey, snapshot) {
  return getPdaCuttingTaskSnapshot(taskId, executionKey, snapshot);
}
function getPdaCuttingTaskSnapshot(taskId, executionKey, snapshot) {
  const currentSnapshot = getSnapshot(snapshot);
  const task = getPdaTaskFlowTaskById(taskId, currentSnapshot);
  if (!task || !isCuttingSpecialTask(task)) return null;
  const executionRecords = getSourceExecutionsByTaskId(taskId);
  if (!executionRecords.length) return null;
  const selectedExecutionRecord = resolveExecutionRecord(taskId, executionKey) ?? executionRecords[0];
  if (!selectedExecutionRecord) return null;
  const executionRows = executionRecords.map((record, index) => buildTaskOrderLine(record, index + 1, currentSnapshot));
  const selectedLine = executionRows.find((line) => line.executionOrderId === selectedExecutionRecord.executionOrderId) ?? executionRows[0];
  if (!selectedLine) return null;
  const originalRecord = getCutOrderRecord(selectedExecutionRecord);
  const progressLine = getProgressLine(currentSnapshot, selectedExecutionRecord);
  const pickupLogs = buildPickupLogs(currentSnapshot, selectedExecutionRecord);
  const spreadingTargets = buildSpreadingTargets(currentSnapshot, selectedExecutionRecord);
  const spreadingRecords = buildSpreadingRecords(currentSnapshot, selectedExecutionRecord);
  const inboundRecords = buildInboundRecords(currentSnapshot, selectedExecutionRecord);
  const handoverRecords = buildHandoverRecords(currentSnapshot, selectedExecutionRecord);
  const replenishmentFeedbacks = buildReplenishmentRecords(currentSnapshot, selectedExecutionRecord);
  const latestPickup = pickupLogs[0];
  const latestSpreading = spreadingRecords[0];
  const latestInbound = inboundRecords[0];
  const latestHandover = handoverRecords[0];
  const latestReplenishment = replenishmentFeedbacks[0];
  const operators = listOperatorsForExecution(currentSnapshot, selectedExecutionRecord);
  const pickupDispute = selectedExecutionRecord.cutOrderNo ? getLatestClaimDisputeByCutOrderNo(selectedExecutionRecord.cutOrderNo) : null;
  const riskTips = listRiskTips({
    disputeSummary: pickupDispute && pickupDispute.status !== "COMPLETED" && pickupDispute.status !== "REJECTED" ? `${pickupDispute.disputeReason}\uFF0C\u5F85\u5E73\u53F0\u5904\u7406` : void 0,
    replenishmentLabel: selectedLine.replenishmentRiskLabel,
    hasInbound: selectedLine.currentInboundStatus === "\u5DF2\u5165\u4ED3",
    hasHandover: selectedLine.currentHandoverStatus === "\u5DF2\u4EA4\u63A5"
  });
  const receiveSummary = selectedLine.currentReceiveStatus;
  const executionSummary = spreadingRecords.length > 0 ? `\u5DF2\u6709 ${spreadingRecords.length} \u6761\u94FA\u5E03\u8BB0\u5F55` : "\u5F85\u5F00\u59CB\u94FA\u5E03";
  const handoverSummary = handoverRecords.length > 0 ? "\u4EA4\u63A5\u626B\u7801\u5DF2\u5B8C\u6210" : "\u5F85\u4EA4\u63A5\u626B\u7801";
  const configuredQtyText = buildConfiguredQtyText(
    originalRecord ?? {
      cutOrderId: selectedExecutionRecord.cutOrderId,
      cutOrderNo: selectedExecutionRecord.cutOrderNo,
      generationKey: selectedExecutionRecord.cutOrderId || selectedExecutionRecord.cutOrderNo,
      productionOrderId: selectedExecutionRecord.productionOrderId,
      productionOrderNo: selectedExecutionRecord.productionOrderNo,
      spuCode: "",
      styleId: "",
      styleCode: "",
      styleName: "",
      techPackVersionId: "",
      techPackVersionLabel: "",
      materialSku: selectedExecutionRecord.materialSku,
      materialName: selectedExecutionRecord.materialSku,
      materialColor: "",
      materialType: "SOLID",
      materialLabel: selectedExecutionRecord.materialSku,
      materialCategory: "",
      materialAlias: selectedExecutionRecord.materialAlias || "",
      materialImageUrl: selectedExecutionRecord.materialImageUrl || "",
      materialUnit: "\u7C73",
      materialIdentity: {
        materialSku: selectedExecutionRecord.materialSku,
        materialName: selectedExecutionRecord.materialSku,
        materialColor: "",
        materialAlias: selectedExecutionRecord.materialAlias || selectedExecutionRecord.materialSku,
        materialImageUrl: selectedExecutionRecord.materialImageUrl || "",
        materialUnit: "\u7C73"
      },
      patternIdentity: {
        patternFileId: "",
        patternFileName: "\u5F85\u8865\u7EB8\u6837\u6587\u4EF6",
        patternVersion: "\u5F85\u8865",
        patternKind: "\u5F85\u8865\u7EB8\u6837\u7C7B\u578B",
        effectiveWidthValue: 0,
        effectiveWidthUnit: "cm",
        piecePartCodes: [],
        piecePartNames: []
      },
      markerPlanId: selectedExecutionRecord.markerPlanId,
      markerPlanNo: selectedExecutionRecord.markerPlanNo,
      requiredQty: 0,
      sourceTechPackSpuCode: "",
      colorScope: [],
      skuScopeLines: [],
      pieceRows: [],
      pieceSummary: "\u88C1\u7247\u4FE1\u606F\u5F85\u8865"
    },
    progressLine?.configuredLength,
    progressLine?.configuredRollCount
  );
  const actualReceivedQtyText = buildActualReceivedQtyText({
    latestPickup: getLatestPickup(currentSnapshot, selectedExecutionRecord),
    receivedLength: isPdaSequenceMockTask(selectedExecutionRecord.taskId) && !latestPickup ? 0 : progressLine?.receivedLength,
    receivedRollCount: isPdaSequenceMockTask(selectedExecutionRecord.taskId) && !latestPickup ? 0 : progressLine?.receivedRollCount
  });
  const currentOwnerName = task.assignedFactoryName || "\u5DE5\u827A\u5DE5\u5382\u88C1\u7247\u6267\u884C";
  const orderQty = originalRecord?.requiredQty || 0;
  const latestOperatorName = operators[0]?.operator.operatorName || latestPickup?.operatorName || latestInbound?.operatorName || latestHandover?.operatorName || latestReplenishment?.operatorName || "\u73B0\u573A\u64CD\u4F5C\u5458";
  return {
    taskId,
    taskNo: task.taskNo || task.taskId,
    productionOrderId: selectedExecutionRecord.productionOrderId,
    productionOrderNo: selectedExecutionRecord.productionOrderNo,
    cutOrderId: selectedExecutionRecord.cutOrderId,
    cutOrderNo: selectedExecutionRecord.cutOrderNo,
    cutOrderIds: unique(executionRecords.map((record) => record.cutOrderId).filter(Boolean)),
    cutOrderNos: unique(executionRecords.map((record) => record.cutOrderNo).filter(Boolean)),
    markerPlanId: selectedExecutionRecord.markerPlanId,
    markerPlanNo: selectedExecutionRecord.markerPlanNo,
    markerPlanIds: unique(executionRecords.map((record) => record.markerPlanId).filter(Boolean)),
    markerPlanNos: unique(executionRecords.map((record) => record.markerPlanNo).filter(Boolean)),
    executionOrderId: selectedExecutionRecord.executionOrderId,
    executionOrderNo: selectedExecutionRecord.executionOrderNo,
    cutPieceOrders: executionRows,
    cutPieceOrderCount: executionRows.length,
    completedCutPieceOrderCount: executionRows.filter((item) => item.isDone).length,
    pendingCutPieceOrderCount: executionRows.filter((item) => !item.isDone).length,
    exceptionCutPieceOrderCount: executionRows.filter((item) => item.hasException).length,
    defaultExecutionOrderId: task.defaultExecutionOrderId || selectedExecutionRecord.executionOrderId,
    defaultExecutionOrderNo: task.defaultExecutionOrderNo || selectedExecutionRecord.executionOrderNo,
    currentSelectedExecutionOrderId: selectedExecutionRecord.executionOrderId,
    taskProgressLabel: task.taskProgressLabel || buildTaskProgressLabel(executionRows.filter((item) => item.isDone).length, executionRows.length),
    taskNextActionLabel: task.taskNextActionLabel || selectedLine.nextActionLabel,
    taskTypeLabel: "\u88C1\u7247\u4EFB\u52A1",
    factoryTypeLabel: "\u79FB\u52A8\u6267\u884C\u6295\u5F71",
    assigneeFactoryId: task.assignedFactoryId || "",
    assigneeFactoryName: task.assignedFactoryName || "\u5DE5\u827A\u5DE5\u5382\u88C1\u7247\u6267\u884C",
    orderQty,
    taskStatusLabel: task.taskStateLabel || mapTaskStatusLabel(task.status),
    currentOwnerName,
    materialSku: selectedExecutionRecord.materialSku,
    materialAlias: selectedLine.materialAlias || selectedExecutionRecord.materialAlias || originalRecord?.materialAlias || "",
    materialImageUrl: selectedLine.materialImageUrl || selectedExecutionRecord.materialImageUrl || originalRecord?.materialImageUrl || "",
    materialTypeLabel: selectedLine.materialTypeLabel,
    pickupSlipNo: selectedLine.pickupSlipNo,
    pickupSlipPrintStatusLabel: progressLine?.printSlipStatus === "PRINTED" ? "\u5DF2\u6253\u5370" : "\u5F85\u6253\u5370",
    qrObjectLabel: "\u88C1\u7247\u5355\u4E3B\u7801",
    discrepancyAllowed: true,
    hasQrCode: true,
    qrCodeValue: selectedLine.qrCodeValue,
    qrVersionNote: "\u4E8C\u7EF4\u7801\u4E3B\u7801\u5DF2\u7ED1\u5B9A\u88C1\u7247\u5355",
    currentStage: selectedLine.currentStateLabel,
    currentActionHint: selectedLine.bindingState === "UNBOUND" ? `\u5F53\u524D\u6267\u884C\u5BF9\u8C61 ${selectedLine.executionOrderNo} \u5C1A\u672A\u7ED1\u5B9A\u88C1\u7247\u5355\uFF0C\u8BF7\u5148\u5904\u7406\u7ED1\u5B9A\u5F02\u5E38\u3002` : `\u5F53\u524D\u6267\u884C\u5BF9\u8C61 ${selectedLine.executionOrderNo} \u7ED1\u5B9A\u88C1\u7247\u5355 ${selectedLine.cutOrderNo}\u3002`,
    nextRecommendedAction: selectedLine.nextActionLabel,
    riskFlags: unique([
      ...selectedLine.hasException ? ["\u6267\u884C\u98CE\u9669"] : [],
      ...riskTips.length ? ["\u5F85\u8DDF\u8FDB"] : []
    ]),
    riskTips,
    receiveSummary,
    executionSummary: selectedLine.currentExecutionStatus || executionSummary,
    handoverSummary,
    currentReceiveStatus: selectedLine.currentReceiveStatus,
    currentExecutionStatus: selectedLine.currentExecutionStatus,
    currentInboundStatus: selectedLine.currentInboundStatus,
    currentHandoverStatus: selectedLine.currentHandoverStatus,
    scanResultLabel: latestPickup?.resultLabel || selectedLine.currentReceiveStatus,
    latestReceiveAt: latestPickup?.scannedAt || "-",
    latestReceiveBy: latestPickup?.operatorName || "-",
    latestPickupRecordNo: latestPickup?.id || "",
    latestPickupScanAt: latestPickup?.scannedAt || "-",
    latestPickupOperatorName: latestPickup?.operatorName || "-",
    configuredQtyText,
    actualReceivedQtyText,
    discrepancyNote: latestPickup?.note || pickupDispute?.disputeNote || "\u5F53\u524D\u65E0\u5DEE\u5F02",
    photoProofCount: latestPickup?.photoProofCount || latestReplenishment?.photoProofCount || pickupDispute?.evidenceCount || 0,
    markerSummary: spreadingRecords.length > 0 ? `${spreadingRecords.length} \u6761\u94FA\u5E03\u8BB0\u5F55` : "\u5F85\u94FA\u5E03\u5F55\u5165",
    hasMarkerImage: spreadingRecords.length > 0,
    latestSpreadingAt: latestSpreading?.enteredAt || "-",
    latestSpreadingBy: latestSpreading?.enteredBy || latestOperatorName,
    latestSpreadingRecordNo: latestSpreading?.id || "",
    inboundZoneLabel: latestInbound ? `${latestInbound.zoneCode} \u533A` : "\u5F85\u5206\u914D\u533A\u57DF",
    inboundLocationLabel: latestInbound?.locationLabel || "\u5F85\u5206\u914D\u5E93\u4F4D",
    latestInboundAt: latestInbound?.scannedAt || "-",
    latestInboundBy: latestInbound?.operatorName || "-",
    latestInboundRecordNo: latestInbound?.id || "",
    latestHandoverAt: latestHandover?.handoverAt || "-",
    latestHandoverBy: latestHandover?.operatorName || "-",
    latestHandoverRecordNo: latestHandover?.id || "",
    handoverTargetLabel: latestHandover?.targetLabel || "\u5F85\u786E\u5B9A\u540E\u9053\u53BB\u5411",
    replenishmentRiskSummary: selectedLine.replenishmentRiskLabel,
    latestReplenishmentFeedbackAt: latestReplenishment?.feedbackAt || "-",
    latestReplenishmentFeedbackBy: latestReplenishment?.operatorName || "-",
    latestReplenishmentFeedbackRecordNo: latestReplenishment?.id || "",
    latestFeedbackAt: latestReplenishment?.feedbackAt || "-",
    latestFeedbackBy: latestReplenishment?.operatorName || "-",
    latestFeedbackReason: latestReplenishment?.reasonLabel || "",
    latestFeedbackNote: latestReplenishment?.note || "",
    recentActions: buildRecentActions({ pickupLogs, spreadingRecords, inboundRecords, handoverRecords, replenishmentFeedbacks }),
    pickupLogs,
    spreadingTargets,
    spreadingRecords,
    inboundRecords,
    handoverRecords,
    replenishmentFeedbacks,
    latestSyncStatus: selectedLine.latestSyncStatus,
    latestSyncSummary: selectedLine.latestSyncSummary
  };
}
function getPdaCuttingTaskDetail(taskId, executionKey) {
  return getPdaCuttingTaskSnapshot(taskId, executionKey);
}
function listWorkerVisiblePdaSpreadingTargetsByTask(taskId, executionKey) {
  const detail = getPdaCuttingTaskSnapshot(taskId, executionKey);
  if (!detail) return [];
  return detail.spreadingTargets.filter((target) => target.targetType === "session");
}
function buildPdaCuttingRoute(taskId, routeKey, options = {}) {
  const basePath = routeKey === "task" ? `/fcs/pda/cutting/task/${taskId}` : routeKey === "unit" ? `/fcs/pda/cutting/unit/${taskId}/${options.executionOrderId?.trim() || "default"}` : routeKey === "spreading" ? `/fcs/pda/cutting/spreading/${taskId}` : routeKey === "inbound" ? `/fcs/pda/cutting/inbound/${taskId}` : routeKey === "handover" ? `/fcs/pda/cutting/handover/${taskId}` : `/fcs/pda/cutting/replenishment-feedback/${taskId}`;
  const params = new URLSearchParams();
  if (options.returnTo?.trim()) params.set("returnTo", options.returnTo.trim());
  if (options.executionOrderId?.trim()) params.set("executionOrderId", options.executionOrderId.trim());
  if (options.executionOrderNo?.trim()) params.set("executionOrderNo", options.executionOrderNo.trim());
  if (options.cutOrderId?.trim()) params.set("cutOrderId", options.cutOrderId.trim());
  if (options.cutOrderNo?.trim()) params.set("cutOrderNo", options.cutOrderNo.trim());
  if (options.markerPlanId?.trim()) params.set("markerPlanId", options.markerPlanId.trim());
  if (options.markerPlanNo?.trim()) params.set("markerPlanNo", options.markerPlanNo.trim());
  if (options.materialSku?.trim()) params.set("materialSku", options.materialSku.trim());
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}
function resolvePdaTaskDetailPath(taskId, returnTo) {
  const task = getPdaTaskFlowTaskById(taskId);
  if (!task || !isCuttingSpecialTask(task)) {
    if (!returnTo?.trim()) return `/fcs/pda/task-receive/${taskId}`;
    return `/fcs/pda/task-receive/${taskId}?returnTo=${encodeURIComponent(returnTo.trim())}`;
  }
  return buildPdaCuttingRoute(taskId, "task", { returnTo });
}
function resolvePdaTaskExecPath(taskId, returnTo) {
  const task = getPdaTaskFlowTaskById(taskId);
  if (!task || !isCuttingSpecialTask(task)) {
    if (!returnTo?.trim()) return `/fcs/pda/exec/${taskId}`;
    return `/fcs/pda/exec/${taskId}?returnTo=${encodeURIComponent(returnTo.trim())}`;
  }
  const rows = listPdaCuttingExecutionRowsByTaskId(taskId);
  if (rows.length !== 1) return buildPdaCuttingRoute(taskId, "task", { returnTo });
  const line = rows[0];
  if (!line) return buildPdaCuttingRoute(taskId, "task", { returnTo });
  if (line.currentStepCode === "PICKUP") {
    const query = new URLSearchParams();
    query.set("tab", "pickup");
    query.set("focusTaskId", taskId);
    if (returnTo?.trim()) query.set("returnTo", returnTo.trim());
    return `/fcs/pda/handover?${query.toString()}`;
  }
  if (line.currentStepCode === "START") return buildPdaCuttingRoute(taskId, "task", { returnTo });
  return buildPdaCuttingRoute(taskId, line.primaryExecutionRouteKey, {
    executionOrderId: line.executionOrderId,
    executionOrderNo: line.executionOrderNo,
    cutOrderId: line.cutOrderId,
    cutOrderNo: line.cutOrderNo,
    markerPlanId: line.markerPlanId,
    markerPlanNo: line.markerPlanNo,
    materialSku: line.materialSku,
    returnTo
  });
}
function resolvePdaHandoverDetailPath(handoverId, _returnTo) {
  return `/fcs/pda/handover/${handoverId}`;
}
export {
  buildPdaCuttingRoute,
  buildPdaCuttingSpreadingTraceMatrix,
  getPdaCuttingExecutionSnapshot,
  getPdaCuttingTaskDetail,
  getPdaCuttingTaskSnapshot,
  getPdaTaskFlowTaskById,
  isCuttingSpecialTask,
  listPdaCuttingExecutionRowsByTaskId,
  listPdaCuttingTaskMocks,
  listPdaCuttingTaskRefs,
  listPdaOrdinaryTaskMocks,
  listPdaTaskFlowProjectedTasks,
  listPdaTaskFlowTasks,
  listWorkerVisiblePdaSpreadingTargets,
  listWorkerVisiblePdaSpreadingTargetsByTask,
  resolvePdaHandoverDetailPath,
  resolvePdaTaskDetailPath,
  resolvePdaTaskExecPath
};
